/**
 * ChatViewModel port — chat/udf ChatAction / ChatState / ChatMessage
 * (docs/01 §3.8). Every action is implemented:
 * initialize (question / pre-generated / voice prototype / image), follow-ups
 * (endpoint #29 — TextPromptResponse.follow_up_questions is always null),
 * clarification, retry, TTS via HTMLAudioElement, voice-clip playback data,
 * history pagination.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SdkServices } from '../core/services';
import { PrefKeys } from '../core/storage';
import type { ConversationChatHistoryMessageItem, TextPromptRequest } from '../core/types';
import { UiState, idle, loading, success, failure } from './uiState';
import { blobToBase64, nextLocalId } from './helpers';
import { Events } from '../core/analytics';
import type { VoiceRecording } from './useVoiceRecorder';

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export interface UserMessage {
  kind: 'user';
  id: string;
  text: string;
  imageUri?: string;
  audioUri?: string;
  userBubbleImageWideBanner?: boolean;
  isFailed: boolean;
}

export interface AiResponse {
  kind: 'ai';
  id: string;
  text: string;
  followUpQuestions?: string[];
  isPreGenerated: boolean;
  messageId?: string;
  clarificationRequired?: boolean;
  hideShareIcon?: boolean;
  hideTtsSpeaker?: boolean;
  hideFollowUpQuestion?: boolean;
  actualContentProvider?: string | null;
}

export interface LoadingPlaceholder {
  kind: 'loading';
  id: string;
}

export type ChatMessage = UserMessage | AiResponse | LoadingPlaceholder;

export type ChatEntrySource = 'home' | 'history';

export interface SendQueryProperties {
  triggeredInputType?: string;
  isWeatherAdviceCTA?: boolean;
  isSSFR?: boolean;
  ssfrCrop?: string | null;
  statementId?: number | null;
  channel?: string | null;
}

export interface ChatState {
  messages: ChatMessage[];
  suggestedQuestions: string[] | null;
  suggestedQuestionIds: Array<string | number> | null;
  clarificationRequired: boolean;
  chatResponseState: UiState<string>;
  errorMessage: string | null;
  failedMessageId: string | null;
  isLoading: boolean;
  isLoadingSynthesiseAudio: boolean;
  audioPlaybackUrl: string | null;
  isAudioPlaying: boolean;
  historyNextPage: number | null;
  isInitialHistoryLoaded: boolean;
  isLoadingMoreHistory: boolean;
  readFullAdviceRequestedForMessageId: string | null;
  isTtsEnabled: boolean;
}

const initialState: ChatState = {
  messages: [],
  suggestedQuestions: null,
  suggestedQuestionIds: null,
  clarificationRequired: false,
  chatResponseState: idle(),
  errorMessage: null,
  failedMessageId: null,
  isLoading: false,
  isLoadingSynthesiseAudio: false,
  audioPlaybackUrl: null,
  isAudioPlaying: false,
  historyNextPage: null,
  isInitialHistoryLoaded: false,
  isLoadingMoreHistory: false,
  readFullAdviceRequestedForMessageId: null,
  isTtsEnabled: true,
};

export interface ChatActions {
  initializeWithQuestion: (
    question: string,
    opts?: {
      transcriptionId?: string | null;
      audioUri?: string | null;
      isWeatherAdviceCTA?: boolean;
      isSSFR?: boolean;
      ssfrCrop?: string | null;
      channel?: string | null;
      triggeredInputType?: string;
    },
  ) => Promise<void>;
  initializeWithPreGeneratedContent: (
    question: string,
    answer?: string | null,
    followUpQuestions?: string[] | null,
    homeStatementId?: number | null,
    userMessageImageUri?: string | null,
  ) => void;
  initializeVoicePrototype: (recording: VoiceRecording, originScreenName: string) => Promise<void>;
  sendFollowUpQuestion: (
    question: string,
    opts?: { followUpQuestionId?: string | number | null; transcriptionId?: string | null; audioUri?: string | null },
  ) => Promise<void>;
  sendQuestionWithImage: (question: string, imageBlob: Blob, imageObjectUrl: string) => Promise<void>;
  sendFollowUpVoiceQuestion: (recording: VoiceRecording) => Promise<void>;
  replacePreGeneratedWithQuestion: (question: string, triggerInputType?: string) => Promise<void>;
  loadChatHistory: (conversationId: string, page?: number) => Promise<void>;
  retryLastRequest: () => Promise<void>;
  clearError: () => void;
  clearMessages: () => void;
  synthesiseAudio: (messageId: string, text: string) => Promise<void>;
  setAudioPlaying: (isPlaying: boolean) => void;
  clearAudioPlaybackUrl: () => void;
}

// ---------------------------------------------------------------------------

export function useChat(services: SdkServices): [ChatState, ChatActions] {
  const [state, setState] = useState<ChatState>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const { api, session, store, labels, analytics } = services;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const lastRequestRef = useRef<(() => Promise<void>) | null>(null);
  const ttsSecondsStartedRef = useRef(0);

  const patch = useCallback((p: Partial<ChatState>) => setState((s) => ({ ...s, ...p })), []);

  // Release the TTS player when unmounting (ON_STOP / onDispose parity).
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const ensureConversationId = useCallback(async (): Promise<string> => {
    if (conversationIdRef.current) return conversationIdRef.current;
    const saved = store.getString(PrefKeys.NEW_CONVERSATION_ID);
    if (saved) {
      conversationIdRef.current = saved;
      return saved;
    }
    const res = await api.newConversation({ user_id: session.userId ?? '' });
    if (res.ok && res.data.conversation_id) {
      conversationIdRef.current = res.data.conversation_id;
      store.setString(PrefKeys.NEW_CONVERSATION_ID, res.data.conversation_id);
      return res.data.conversation_id;
    }
    return '';
  }, [api, session, store]);

  // -------------------------------------------------------------------------
  // Follow-ups (#29): TextPromptResponse.follow_up_questions is always null.
  // -------------------------------------------------------------------------

  const fetchFollowUps = useCallback(
    async (messageId: string, aiMessageLocalId: string) => {
      const res = await api.getFollowUpQuestions(messageId);
      if (!res.ok) return;
      const raw = res.data.questions ?? [];
      const questions: string[] = [];
      const ids: Array<string | number> = [];
      for (const q of raw) {
        if (typeof q === 'string') {
          questions.push(q);
        } else if (q && typeof q === 'object') {
          if (q.question) questions.push(q.question);
          if (q.id !== null && q.id !== undefined) ids.push(q.id);
        }
      }
      const clarification = res.data.clarification_required ?? false;
      setState((s) => ({
        ...s,
        suggestedQuestions: questions.length > 0 ? questions : s.suggestedQuestions,
        suggestedQuestionIds: ids.length > 0 ? ids : s.suggestedQuestionIds,
        clarificationRequired: clarification,
        messages: s.messages.map((m) =>
          m.kind === 'ai' && m.id === aiMessageLocalId
            ? { ...m, followUpQuestions: questions, clarificationRequired: clarification }
            : m,
        ),
      }));
    },
    [api],
  );

  // -------------------------------------------------------------------------
  // Core text-query pipeline (#27)
  // -------------------------------------------------------------------------

  const runTextQuery = useCallback(
    async (
      question: string,
      opts: {
        transcriptionId?: string | null;
        audioUri?: string | null;
        properties?: SendQueryProperties;
        retry?: boolean;
        reuseUserMessageId?: string;
      },
    ) => {
      const userMsgId = opts.reuseUserMessageId ?? nextLocalId('user');
      const placeholderId = nextLocalId('loading');
      const props = opts.properties ?? {};

      setState((s) => {
        let messages = s.messages;
        if (opts.reuseUserMessageId) {
          messages = messages.map((m) => (m.id === userMsgId && m.kind === 'user' ? { ...m, isFailed: false } : m));
        } else {
          const userMsg: UserMessage = {
            kind: 'user',
            id: userMsgId,
            text: question,
            audioUri: opts.audioUri ?? undefined,
            isFailed: false,
          };
          messages = [...messages, userMsg];
        }
        return {
          ...s,
          messages: [...messages, { kind: 'loading', id: placeholderId } as LoadingPlaceholder],
          isLoading: true,
          errorMessage: null,
          failedMessageId: null,
          suggestedQuestions: null,
          suggestedQuestionIds: null,
          chatResponseState: loading(),
        };
      });

      analytics.track(Events.SEND_QUERY_INITIATED, {
        triggered_input_type: props.triggeredInputType ?? 'keyboard',
      });
      analytics.messageSent(question);

      const conversationId = await ensureConversationId();
      const request: TextPromptRequest = {
        query: question,
        conversation_id: conversationId,
        message_id: nextLocalId('msg'),
        statement_id: props.statementId ?? null,
        weather_cta_triggered: props.isWeatherAdviceCTA ?? false,
        triggered_input_type: props.triggeredInputType ?? 'keyboard',
        ssfr_crop: props.isSSFR ? (props.ssfrCrop ?? null) : null,
        use_entity_extraction: true,
        transcription_id: opts.transcriptionId ?? null,
        retry: opts.retry ?? false,
      };

      lastRequestRef.current = () =>
        runTextQuery(question, { ...opts, retry: true, reuseUserMessageId: userMsgId });

      const res = await api.getAnswerForTextQuery(request);

      if (!res.ok || res.data.error || !res.data.response) {
        const message = !res.ok
          ? res.message
          : (res.data.message ?? labels.getLabel('chat_generic_error', 'Something went wrong. Please try again.'));
        setState((s) => ({
          ...s,
          messages: s.messages
            .filter((m) => m.id !== placeholderId)
            .map((m) => (m.id === userMsgId && m.kind === 'user' ? { ...m, isFailed: true } : m)),
          isLoading: false,
          errorMessage: message,
          failedMessageId: userMsgId,
          chatResponseState: failure(message, res.ok ? undefined : res.code, !res.ok && (res.isNetworkError || res.isTimeout)),
        }));
        analytics.error(res.ok ? undefined : res.code, message);
        return;
      }

      const data = res.data;
      const aiId = nextLocalId('ai');
      const aiMsg: AiResponse = {
        kind: 'ai',
        id: aiId,
        text: data.response ?? '',
        isPreGenerated: false,
        messageId: data.message_id ?? undefined,
        hideShareIcon: data.hide_share_icon ?? false,
        hideTtsSpeaker: data.hide_tts_speaker ?? false,
        hideFollowUpQuestion: data.hide_follow_up_question ?? false,
        actualContentProvider: data.actual_content_provider ?? null,
        clarificationRequired: data.intent_classification_output?.clarification_needed ?? false,
      };
      setState((s) => ({
        ...s,
        messages: s.messages.filter((m) => m.id !== placeholderId).concat(aiMsg),
        isLoading: false,
        chatResponseState: success(data.response ?? ''),
        clarificationRequired: data.intent_classification_output?.clarification_needed ?? false,
      }));

      analytics.track(Events.SEND_QUERY, {
        triggered_input_type: request.triggered_input_type,
        conversation_id: conversationId,
        message_id: data.message_id ?? '',
      });
      analytics.answerReceived(data.message_id ?? '');
      if (!store.getBool(PrefKeys.FIRST_QUERY_ASKED, false)) {
        store.setBool(PrefKeys.FIRST_QUERY_ASKED, true);
        analytics.track(Events.FIRST_QUERY_ASKED, {});
      }

      if (data.message_id && !(data.hide_follow_up_question ?? false)) {
        void fetchFollowUps(data.message_id, aiId);
      }
    },
    [analytics, api, ensureConversationId, fetchFollowUps, labels, store],
  );

  // -------------------------------------------------------------------------
  // Initialization actions
  // -------------------------------------------------------------------------

  const initializeWithQuestion = useCallback<ChatActions['initializeWithQuestion']>(
    async (question, opts = {}) => {
      await runTextQuery(question, {
        transcriptionId: opts.transcriptionId ?? null,
        audioUri: opts.audioUri ?? null,
        properties: {
          triggeredInputType: opts.triggeredInputType ?? (opts.audioUri ? 'mic' : 'keyboard'),
          isWeatherAdviceCTA: opts.isWeatherAdviceCTA ?? false,
          isSSFR: opts.isSSFR ?? false,
          ssfrCrop: opts.ssfrCrop ?? null,
          channel: opts.channel ?? null,
        },
      });
    },
    [runTextQuery],
  );

  const initializeWithPreGeneratedContent = useCallback<ChatActions['initializeWithPreGeneratedContent']>(
    (question, answer, followUpQuestions, homeStatementId, userMessageImageUri) => {
      const userMsg: UserMessage = {
        kind: 'user',
        id: nextLocalId('user'),
        text: question,
        imageUri: userMessageImageUri ?? undefined,
        userBubbleImageWideBanner: !!userMessageImageUri,
        isFailed: false,
      };
      const aiId = nextLocalId('ai');
      const aiMsg: AiResponse = {
        kind: 'ai',
        id: aiId,
        text: answer ?? '',
        followUpQuestions: followUpQuestions ?? undefined,
        isPreGenerated: true,
        messageId: homeStatementId != null ? String(homeStatementId) : undefined,
      };
      setState((s) => ({
        ...s,
        messages: [...s.messages, userMsg, aiMsg],
        suggestedQuestions: followUpQuestions ?? null,
        isLoading: false,
        chatResponseState: success(answer ?? ''),
      }));
    },
    [],
  );

  const initializeVoicePrototype = useCallback<ChatActions['initializeVoicePrototype']>(
    async (recording, _originScreenName) => {
      patch({ isLoading: true, chatResponseState: loading() });
      const conversationId = await ensureConversationId();
      const res = await api.transcribeAudio({
        conversation_id: conversationId,
        query: recording.base64,
        message_reference_id: nextLocalId('voice'),
        input_audio_encoding_format: recording.format,
        triggered_input_type: 'mic',
        editable_transcription: 'True',
      });
      // Accept only if !error && confidence > 0.7 && text not blank (docs/02).
      if (
        res.ok &&
        !res.data.error &&
        (res.data.confidence_score ?? 0) > 0.7 &&
        (res.data.heard_input_query ?? '').trim().length > 0
      ) {
        analytics.track(Events.TRANSCRIPTION_SUCCESS, { confidence_score: res.data.confidence_score ?? 0 });
        await runTextQuery(res.data.heard_input_query!.trim(), {
          transcriptionId: res.data.transcription_id ?? null,
          audioUri: recording.objectUrl,
          properties: { triggeredInputType: 'mic' },
        });
      } else {
        analytics.track(Events.TRANSCRIPTION_FAILED, {
          confidence_score: res.ok ? (res.data.confidence_score ?? 0) : 0,
        });
        const message = labels.getLabel(
          'chat_transcription_failed',
          "We couldn't hear that clearly. Please try speaking again.",
        );
        patch({ isLoading: false, errorMessage: message, chatResponseState: failure(message) });
      }
    },
    [analytics, api, ensureConversationId, labels, patch, runTextQuery],
  );

  // -------------------------------------------------------------------------
  // Follow-ups / image / voice sends
  // -------------------------------------------------------------------------

  const sendFollowUpQuestion = useCallback<ChatActions['sendFollowUpQuestion']>(
    async (question, opts = {}) => {
      // Follow-up clicks are tracked server-side via endpoint #30.
      void api.trackFollowUpClick(question);
      await runTextQuery(question, {
        transcriptionId: opts.transcriptionId ?? null,
        audioUri: opts.audioUri ?? null,
        properties: { triggeredInputType: opts.audioUri ? 'mic' : 'card' },
      });
    },
    [analytics, api, runTextQuery],
  );

  const sendQuestionWithImage = useCallback<ChatActions['sendQuestionWithImage']>(
    async (question, imageBlob, imageObjectUrl) => {
      const userMsgId = nextLocalId('user');
      const placeholderId = nextLocalId('loading');
      setState((s) => ({
        ...s,
        messages: [
          ...s.messages,
          {
            kind: 'user',
            id: userMsgId,
            text: question,
            imageUri: imageObjectUrl,
            userBubbleImageWideBanner: true,
            isFailed: false,
          } as UserMessage,
          { kind: 'loading', id: placeholderId } as LoadingPlaceholder,
        ],
        isLoading: true,
        errorMessage: null,
        failedMessageId: null,
        suggestedQuestions: null,
        chatResponseState: loading(),
      }));

      analytics.track(Events.SEND_QUERY_INITIATED, { triggered_input_type: 'camera' });
      analytics.messageSent(question);
      const conversationId = await ensureConversationId();
      const base64 = await blobToBase64(imageBlob);
      const lat = store.getString(PrefKeys.FARMER_APP_LATITUDE);
      const lng = store.getString(PrefKeys.FARMER_APP_LONGITUDE);

      lastRequestRef.current = () => sendQuestionWithImage(question, imageBlob, imageObjectUrl);

      const res = await api.imageAnalysis({
        conversation_id: conversationId,
        image: base64,
        query: question || null,
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
        image_name: `fc_web_${Date.now()}.jpg`,
      });

      if (!res.ok || res.data.error || !res.data.response) {
        const message = !res.ok
          ? res.message
          : (res.data.message ?? labels.getLabel('chat_generic_error', 'Something went wrong. Please try again.'));
        setState((s) => ({
          ...s,
          messages: s.messages
            .filter((m) => m.id !== placeholderId)
            .map((m) => (m.id === userMsgId && m.kind === 'user' ? { ...m, isFailed: true } : m)),
          isLoading: false,
          errorMessage: message,
          failedMessageId: userMsgId,
          chatResponseState: failure(message, res.ok ? undefined : res.code, !res.ok && (res.isNetworkError || res.isTimeout)),
        }));
        analytics.error(res.ok ? undefined : res.code, message);
        return;
      }

      const aiId = nextLocalId('ai');
      setState((s) => ({
        ...s,
        messages: s.messages.filter((m) => m.id !== placeholderId).concat({
          kind: 'ai',
          id: aiId,
          text: res.data.response ?? '',
          isPreGenerated: false,
          messageId: res.data.message_id ?? undefined,
        } as AiResponse),
        isLoading: false,
        chatResponseState: success(res.data.response ?? ''),
      }));
      analytics.track(Events.SEND_QUERY, { triggered_input_type: 'camera', conversation_id: conversationId });
      analytics.answerReceived(res.data.message_id ?? '');
      if (res.data.message_id) void fetchFollowUps(res.data.message_id, aiId);
    },
    [analytics, api, ensureConversationId, fetchFollowUps, labels, store],
  );

  const sendFollowUpVoiceQuestion = useCallback<ChatActions['sendFollowUpVoiceQuestion']>(
    async (recording) => {
      await initializeVoicePrototype(recording, 'CHAT');
    },
    [initializeVoicePrototype],
  );

  const replacePreGeneratedWithQuestion = useCallback<ChatActions['replacePreGeneratedWithQuestion']>(
    async (question, triggerInputType) => {
      const preGenerated = stateRef.current.messages.find((m) => m.kind === 'ai' && m.isPreGenerated) as
        | AiResponse
        | undefined;
      patch({ readFullAdviceRequestedForMessageId: preGenerated?.id ?? null });
      // Remove the pre-generated pair and re-ask for the full advice.
      setState((s) => ({ ...s, messages: s.messages.filter((m) => !(m.kind === 'ai' && m.isPreGenerated)) }));
      await runTextQuery(question, {
        properties: { triggeredInputType: triggerInputType ?? 'card' },
        reuseUserMessageId: stateRef.current.messages.find((m) => m.kind === 'user')?.id,
      });
      patch({ readFullAdviceRequestedForMessageId: null });
    },
    [analytics, patch, runTextQuery],
  );

  // -------------------------------------------------------------------------
  // History (#32) with pagination
  // -------------------------------------------------------------------------

  const loadChatHistory = useCallback<ChatActions['loadChatHistory']>(
    async (conversationId, page = 1) => {
      conversationIdRef.current = conversationId;
      if (page === 1) {
        patch({ isLoading: true, chatResponseState: loading() });
      } else {
        patch({ isLoadingMoreHistory: true });
      }
      const res = await api.getConversationChatHistory(conversationId, page);
      if (!res.ok) {
        patch({
          isLoading: false,
          isLoadingMoreHistory: false,
          errorMessage: res.message,
          chatResponseState: failure(res.message, res.code, res.isNetworkError || res.isTimeout),
        });
        return;
      }
      const items = res.data.data ?? res.data.messages ?? res.data.results ?? [];
      const { messages, trailingQuestions, clarification } = mapHistoryItems(items);
      setState((s) => ({
        ...s,
        // Older pages are prepended above the existing thread.
        messages: page === 1 ? messages : [...messages, ...s.messages],
        suggestedQuestions: page === 1 ? trailingQuestions : s.suggestedQuestions,
        clarificationRequired: page === 1 ? clarification : s.clarificationRequired,
        historyNextPage: res.data.next_page ?? null,
        isInitialHistoryLoaded: page === 1 ? true : s.isInitialHistoryLoaded,
        isLoading: false,
        isLoadingMoreHistory: false,
        chatResponseState: success(''),
      }));
    },
    [api, patch],
  );

  // -------------------------------------------------------------------------
  // Retry / error / cleanup
  // -------------------------------------------------------------------------

  const retryLastRequest = useCallback(async () => {
    const retry = lastRequestRef.current;
    if (retry) await retry();
  }, []);

  const clearError = useCallback(() => {
    patch({ errorMessage: null, failedMessageId: null });
  }, [patch]);

  const clearMessages = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    conversationIdRef.current = null;
    lastRequestRef.current = null;
    setState(initialState);
  }, []);

  // -------------------------------------------------------------------------
  // TTS (#31) via HTMLAudioElement
  // -------------------------------------------------------------------------

  const synthesiseAudio = useCallback<ChatActions['synthesiseAudio']>(
    async (messageId, text) => {
      const s = stateRef.current;
      // Toggle pause when already playing.
      if (s.isAudioPlaying && audioRef.current) {
        audioRef.current.pause();
        return;
      }
      if (s.audioPlaybackUrl && audioRef.current) {
        void audioRef.current.play();
        return;
      }
      patch({ isLoadingSynthesiseAudio: true });
      const res = await api.synthesiseAudio({ message_id: messageId, text, user_id: session.userId ?? '' });
      if (!res.ok || !res.data.audio) {
        patch({
          isLoadingSynthesiseAudio: false,
          errorMessage: res.ok
            ? labels.getLabel('chat_tts_failed', 'Could not play the audio. Please try again.')
            : res.message,
        });
        return;
      }
      const url = res.data.audio;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => {
        ttsSecondsStartedRef.current = Date.now();
        analytics.track(Events.STARTED_PLAYING_RESPONSE_AUDIO, { message_id: messageId });
        patch({ isAudioPlaying: true });
      };
      const onStop = () => {
        analytics.track(Events.STOPPED_PLAYING_RESPONSE_AUDIO, {
          message_id: messageId,
          seconds_played: Math.round((Date.now() - ttsSecondsStartedRef.current) / 1000),
        });
        patch({ isAudioPlaying: false });
      };
      audio.onpause = onStop;
      audio.onended = () => {
        onStop();
        patch({ audioPlaybackUrl: null });
        audioRef.current = null;
      };
      patch({ isLoadingSynthesiseAudio: false, audioPlaybackUrl: url });
      try {
        await audio.play();
      } catch {
        patch({
          isAudioPlaying: false,
          errorMessage: labels.getLabel('chat_tts_failed', 'Could not play the audio. Please try again.'),
        });
      }
    },
    [analytics, api, labels, patch, session],
  );

  const setAudioPlaying = useCallback(
    (isPlaying: boolean) => {
      const audio = audioRef.current;
      if (!audio) return;
      if (isPlaying) void audio.play();
      else audio.pause();
    },
    [],
  );

  const clearAudioPlaybackUrl = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    patch({ audioPlaybackUrl: null, isAudioPlaying: false });
  }, [patch]);

  return [
    state,
    {
      initializeWithQuestion,
      initializeWithPreGeneratedContent,
      initializeVoicePrototype,
      sendFollowUpQuestion,
      sendQuestionWithImage,
      sendFollowUpVoiceQuestion,
      replacePreGeneratedWithQuestion,
      loadChatHistory,
      retryLastRequest,
      clearError,
      clearMessages,
      synthesiseAudio,
      setAudioPlaying,
      clearAudioPlaybackUrl,
    },
  ];
}

// ---------------------------------------------------------------------------
// History mapping — message_type_id: 1=query_text, 2=query_audio,
// 3=response_text, 7=follow_up_questions, 11=input_image (docs/02).
// ---------------------------------------------------------------------------

function mapHistoryItems(items: ConversationChatHistoryMessageItem[]): {
  messages: ChatMessage[];
  trailingQuestions: string[] | null;
  clarification: boolean;
} {
  const messages: ChatMessage[] = [];
  let trailingQuestions: string[] | null = null;
  let clarification = false;

  for (const item of items) {
    const typeId = item.message_type_id ?? typeIdFromName(item.message_type);
    switch (typeId) {
      case 1:
        messages.push({
          kind: 'user',
          id: item.message_id ?? nextLocalId('user'),
          text: item.query_text ?? '',
          isFailed: false,
        });
        trailingQuestions = null;
        break;
      case 2:
        messages.push({
          kind: 'user',
          id: item.message_id ?? nextLocalId('user'),
          text: item.heard_query_text ?? item.query_text ?? '',
          audioUri: item.query_media_file_url ?? undefined,
          isFailed: false,
        });
        trailingQuestions = null;
        break;
      case 11:
        messages.push({
          kind: 'user',
          id: item.message_id ?? nextLocalId('user'),
          text: item.query_text ?? '',
          imageUri: item.query_media_file_url ?? undefined,
          userBubbleImageWideBanner: true,
          isFailed: false,
        });
        trailingQuestions = null;
        break;
      case 3:
        messages.push({
          kind: 'ai',
          id: item.message_id ?? nextLocalId('ai'),
          text: item.response_text ?? '',
          isPreGenerated: false,
          messageId: item.message_id ?? undefined,
          hideTtsSpeaker: item.hide_tts_speaker ?? false,
          actualContentProvider: item.actual_content_provider ?? null,
          clarificationRequired: item.clarification_required ?? false,
        });
        if (item.clarification_required) clarification = true;
        trailingQuestions = null;
        break;
      case 7: {
        const qs = (item.questions ?? []).filter((q): q is string => typeof q === 'string');
        // Attach to the previous AI response; keep as trailing suggestions too.
        for (let i = messages.length - 1; i >= 0; i--) {
          const m = messages[i]!;
          if (m.kind === 'ai') {
            messages[i] = { ...m, followUpQuestions: qs };
            break;
          }
        }
        trailingQuestions = qs.length > 0 ? qs : null;
        if (item.clarification_required) clarification = true;
        break;
      }
      default:
        // Unknown message types are skipped, matching the app's tolerant parsing.
        break;
    }
  }
  return { messages, trailingQuestions, clarification };
}

function typeIdFromName(name: string | null | undefined): number {
  switch (name) {
    case 'query_text':
      return 1;
    case 'query_audio':
      return 2;
    case 'response_text':
      return 3;
    case 'follow_up_questions':
      return 7;
    case 'input_image':
      return 11;
    default:
      return 0;
  }
}
