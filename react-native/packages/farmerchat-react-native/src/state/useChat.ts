/**
 * useChat — port of `ChatViewModel` + chat UDF (docs/01 §3.8: ChatAction /
 * ChatState / ChatMessage). Covers every action: question / pre-generated /
 * voice / image initialization, follow-ups via endpoint #29, retry,
 * clarification, synthesise-audio TTS, history pagination with position
 * restore hooks.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { UiStates, type UiState } from '../core/apiResult';
import { AnalyticsEvents } from '../core/analytics';
import type { FarmerChatSdk } from '../core/sdk';
import { StorageKeys } from '../core/sessionStore';
import type {
  ConversationChatHistoryMessageItem,
  FollowUpQuestionsResponse,
} from '../core/types';
import { isTranscriptionAcceptable } from './useHome';

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export interface UserMessage {
  kind: 'user';
  id: string;
  text: string;
  imageUri?: string | null;
  audioUri?: string | null;
  userBubbleImageWideBanner: boolean;
  isFailed: boolean;
}

export interface AiResponse {
  kind: 'ai';
  id: string;
  text: string;
  followUpQuestions?: string[] | null;
  isPreGenerated: boolean;
  messageId?: string | null;
  contentProvider?: string | null;
  contentProviderLogo?: string | null;
  hideTtsSpeaker?: boolean;
  hideShareIcon?: boolean;
  hideSource?: boolean;
}

export interface LoadingPlaceholder {
  kind: 'loading';
  id: string;
}

export type ChatMessage = UserMessage | AiResponse | LoadingPlaceholder;

export type ChatEntrySource = 'home' | 'history';

export interface SendQueryProperties {
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type ChatAction =
  | {
      type: 'InitializeWithPreGeneratedContent';
      question: string;
      answer?: string | null;
      followUpQuestions?: string[] | null;
      isFromCampaign?: boolean;
      isPush?: boolean;
      isInApp?: boolean;
      homeStatementId?: string | null;
      userMessageImageUri?: string | null;
    }
  | {
      type: 'InitializeVoicePrototype';
      audioUri: string;
      audioBase64: string;
      audioFormat: string;
      originScreenName: string;
    }
  | {
      type: 'InitializeWithQuestion';
      question: string;
      transcriptionId?: string | null;
      audioUri?: string | null;
      originScreenName: string;
      isWeatherAdviceCTA?: boolean;
      isPush?: boolean;
      isInApp?: boolean;
      isSSFR?: boolean;
      ssfrCrop?: string | null;
      channel?: string | null;
      statementId?: number | null;
    }
  | { type: 'ReplacePreGeneratedWithQuestion'; question: string; triggerInputType?: string | null }
  | {
      type: 'SendFollowUpQuestion';
      question: string;
      followUpQuestionId?: string | null;
      transcriptionId?: string | null;
      audioUri?: string | null;
      sendQueryProperties?: SendQueryProperties | null;
    }
  | {
      type: 'SendQuestionWithImage';
      question: string;
      imageUri: string;
      imageBase64: string;
      sendQueryProperties?: SendQueryProperties | null;
    }
  | {
      type: 'SendFollowUpVoiceQuestion';
      audioUri: string;
      audioBase64: string;
      audioFormat: string;
    }
  | { type: 'SendQuestionWithAudio'; question: string; audioUri: string }
  | { type: 'LoadChatHistory'; conversationId: string; page?: number }
  | { type: 'RetryLastRequest' }
  | { type: 'ClearError' }
  | { type: 'ClearMessages' }
  | { type: 'SynthesiseAudio'; messageId?: string | null; text?: string | null }
  | { type: 'ClearAudioPlaybackUrl' }
  | { type: 'SetAudioPlaying'; isPlaying: boolean };

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface ChatState {
  messages: ChatMessage[];
  suggestedQuestions: string[] | null;
  suggestedQuestionIds: string[] | null;
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

const initialChatState: ChatState = {
  messages: [],
  suggestedQuestions: null,
  suggestedQuestionIds: null,
  clarificationRequired: false,
  chatResponseState: UiStates.idle(),
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

export type ChatUiState =
  | { kind: 'loading'; questionText: string | null; imageUri: string | null; audioUri: string | null }
  | { kind: 'thread'; messages: ChatMessage[]; isLoading: boolean }
  | {
      kind: 'error';
      message: string;
      questionText: string | null;
      imageUri: string | null;
      audioUri: string | null;
    };

export function deriveChatUiState(state: ChatState): ChatUiState {
  const firstUser = state.messages.find((m): m is UserMessage => m.kind === 'user');
  if (state.errorMessage !== null && state.messages.filter((m) => m.kind === 'ai').length === 0) {
    return {
      kind: 'error',
      message: state.errorMessage,
      questionText: firstUser?.text ?? null,
      imageUri: firstUser?.imageUri ?? null,
      audioUri: firstUser?.audioUri ?? null,
    };
  }
  if (state.isLoading && state.messages.filter((m) => m.kind === 'ai').length === 0) {
    return {
      kind: 'loading',
      questionText: firstUser?.text ?? null,
      imageUri: firstUser?.imageUri ?? null,
      audioUri: firstUser?.audioUri ?? null,
    };
  }
  return { kind: 'thread', messages: state.messages, isLoading: state.isLoading };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

let idCounter = 0;
function makeId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface UseChatResult {
  state: ChatState;
  onAction: (action: ChatAction) => void;
}

export function useChat(sdk: FarmerChatSdk): UseChatResult {
  const [state, setState] = useState<ChatState>(initialChatState);
  const mounted = useRef(true);
  const stateRef = useRef(state);
  stateRef.current = state;
  const conversationIdRef = useRef<string | null>(null);
  const lastRequestRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const patch = useCallback((partial: Partial<ChatState>) => {
    if (!mounted.current) return;
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const mutate = useCallback((fn: (prev: ChatState) => ChatState) => {
    if (!mounted.current) return;
    setState(fn);
  }, []);

  // --- conversation id --------------------------------------------------------

  const ensureConversationId = useCallback(async (): Promise<string | null> => {
    if (conversationIdRef.current) return conversationIdRef.current;
    const stored = sdk.store.getString(StorageKeys.NEW_CONVERSATION_ID);
    if (stored) {
      conversationIdRef.current = stored;
      return stored;
    }
    const userId = sdk.session.userId;
    if (!userId) return null;
    const result = await sdk.api.newConversation({ user_id: userId });
    if (result.ok) {
      conversationIdRef.current = result.data.conversation_id;
      sdk.store.set(StorageKeys.NEW_CONVERSATION_ID, result.data.conversation_id);
      return result.data.conversation_id;
    }
    return null;
  }, [sdk]);

  // --- follow-ups (endpoint #29 — TextPromptResponse.follow_up_questions is always null) ---

  const fetchFollowUps = useCallback(
    async (messageId: string, aiMessageLocalId: string) => {
      const result = await sdk.api.getFollowUpQuestions(messageId);
      if (!mounted.current || !result.ok) return;
      const { questions, ids } = extractFollowUps(result.data);
      mutate((prev) => ({
        ...prev,
        suggestedQuestions: questions,
        suggestedQuestionIds: ids,
        clarificationRequired: result.data.clarification_required === true,
        messages: prev.messages.map((m) =>
          m.kind === 'ai' && m.id === aiMessageLocalId
            ? { ...m, followUpQuestions: questions }
            : m,
        ),
      }));
    },
    [mutate, sdk],
  );

  // --- core text query ---------------------------------------------------------

  const sendTextQuery = useCallback(
    async (params: {
      question: string;
      userMessageId?: string | null;
      imageUri?: string | null;
      audioUri?: string | null;
      transcriptionId?: string | null;
      triggeredInputType: string;
      isWeatherAdviceCTA?: boolean;
      isSSFR?: boolean;
      ssfrCrop?: string | null;
      statementId?: number | null;
      isRetry?: boolean;
      sendQueryProperties?: SendQueryProperties | null;
    }) => {
      const question = params.question.trim();
      if (question.length === 0) return;

      let userMessageId = params.userMessageId ?? null;
      if (userMessageId === null) {
        userMessageId = makeId('user');
        const userMessage: UserMessage = {
          kind: 'user',
          id: userMessageId,
          text: question,
          imageUri: params.imageUri ?? null,
          audioUri: params.audioUri ?? null,
          userBubbleImageWideBanner: false,
          isFailed: false,
        };
        mutate((prev) => ({
          ...prev,
          messages: [...prev.messages, userMessage, { kind: 'loading', id: makeId('ld') }],
          isLoading: true,
          errorMessage: null,
          failedMessageId: null,
          suggestedQuestions: null,
          suggestedQuestionIds: null,
          clarificationRequired: false,
          chatResponseState: UiStates.loading(),
        }));
      } else {
        // retry path — reuse the existing bubble
        const retryId = userMessageId;
        mutate((prev) => ({
          ...prev,
          messages: [
            ...prev.messages.map((m) =>
              m.kind === 'user' && m.id === retryId ? { ...m, isFailed: false } : m,
            ),
            { kind: 'loading', id: makeId('ld') },
          ],
          isLoading: true,
          errorMessage: null,
          failedMessageId: null,
          chatResponseState: UiStates.loading(),
        }));
      }

      lastRequestRef.current = () =>
        void sendTextQuery({ ...params, userMessageId, isRetry: true });

      sdk.analytics.track(AnalyticsEvents.SEND_QUERY_INITIATED, {
        triggered_input_type: params.triggeredInputType,
        ...(params.sendQueryProperties ?? {}),
      });
      // Semantic callback (C4).
      sdk.analytics.fireCallback('onMessageSent', question);

      const conversationId = await ensureConversationId();
      if (!conversationId) {
        failQuery(userMessageId, sdk.labels.getLabel('chat_error_generic', 'Something went wrong. Please try again.'));
        return;
      }

      const result = await sdk.api.getAnswerForTextQuery({
        query: question,
        conversation_id: conversationId,
        message_id: makeId('ref'),
        statement_id: params.statementId ?? null,
        weather_cta_triggered: params.isWeatherAdviceCTA === true,
        triggered_input_type: params.triggeredInputType,
        ssfr_crop: params.isSSFR === true ? params.ssfrCrop ?? null : null,
        use_entity_extraction: true,
        transcription_id: params.transcriptionId ?? null,
        retry: params.isRetry === true,
      });
      if (!mounted.current) return;

      if (result.ok && result.data.error !== true && (result.data.response ?? '').length > 0) {
        const responseText = result.data.response ?? '';
        const serverMessageId = result.data.message_id ?? null;
        const aiLocalId = makeId('ai');
        mutate((prev) => ({
          ...prev,
          messages: [
            ...prev.messages.filter((m) => m.kind !== 'loading'),
            {
              kind: 'ai',
              id: aiLocalId,
              text: responseText,
              followUpQuestions: null,
              isPreGenerated: false,
              messageId: serverMessageId,
              contentProvider: result.data.actual_content_provider ?? null,
              contentProviderLogo: result.data.content_provider_logo ?? null,
              hideTtsSpeaker: result.data.hide_tts_speaker === true,
              hideShareIcon: result.data.hide_share_icon === true,
              hideSource: result.data.hide_source === true,
            },
          ],
          isLoading: false,
          chatResponseState: UiStates.success(responseText),
          clarificationRequired:
            result.data.intent_classification_output?.clarification_needed === true,
        }));
        sdk.analytics.track(AnalyticsEvents.SEND_QUERY, {
          triggered_input_type: params.triggeredInputType,
          ...(params.sendQueryProperties ?? {}),
        });
        // Semantic callback (C4).
        sdk.analytics.fireCallback('onAnswerReceived', serverMessageId ?? aiLocalId);
        if (!sdk.store.getBoolean(StorageKeys.FIRST_QUERY_ASKED)) {
          sdk.store.set(StorageKeys.FIRST_QUERY_ASKED, true);
          sdk.analytics.track(AnalyticsEvents.FIRST_QUERY_ASKED, {});
        }
        if (
          serverMessageId &&
          result.data.hide_follow_up_question !== true
        ) {
          void fetchFollowUps(serverMessageId, aiLocalId);
        }
      } else {
        const message = result.ok
          ? result.data.message ??
            sdk.labels.getLabel('chat_error_generic', 'Something went wrong. Please try again.')
          : (result.isNetworkError || result.isTimeout)
            ? sdk.labels.getLabel(
                'chat_error_network',
                'No internet connection. Please check your network and try again.',
              )
            : result.message ??
              sdk.labels.getLabel('chat_error_generic', 'Something went wrong. Please try again.');
        failQuery(userMessageId, message);
      }

      function failQuery(failedId: string, message: string): void {
        mutate((prev) => ({
          ...prev,
          messages: prev.messages
            .filter((m) => m.kind !== 'loading')
            .map((m) =>
              m.kind === 'user' && m.id === failedId ? { ...m, isFailed: true } : m,
            ),
          isLoading: false,
          errorMessage: message,
          failedMessageId: failedId,
          chatResponseState: UiStates.error(message),
        }));
      }
    },
    [ensureConversationId, fetchFollowUps, mutate, sdk],
  );

  // --- image query (endpoint #28) ------------------------------------------------

  const sendImageQuery = useCallback(
    async (params: {
      question: string;
      imageUri: string;
      imageBase64: string;
      userMessageId?: string | null;
      sendQueryProperties?: SendQueryProperties | null;
    }) => {
      let userMessageId = params.userMessageId ?? null;
      if (userMessageId === null) {
        userMessageId = makeId('user');
        mutate((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              kind: 'user',
              id: userMessageId as string,
              text: params.question,
              imageUri: params.imageUri,
              audioUri: null,
              userBubbleImageWideBanner: true,
              isFailed: false,
            },
            { kind: 'loading', id: makeId('ld') },
          ],
          isLoading: true,
          errorMessage: null,
          failedMessageId: null,
          suggestedQuestions: null,
          suggestedQuestionIds: null,
          chatResponseState: UiStates.loading(),
        }));
      } else {
        const retryId = userMessageId;
        mutate((prev) => ({
          ...prev,
          messages: [
            ...prev.messages.map((m) =>
              m.kind === 'user' && m.id === retryId ? { ...m, isFailed: false } : m,
            ),
            { kind: 'loading', id: makeId('ld') },
          ],
          isLoading: true,
          errorMessage: null,
          failedMessageId: null,
          chatResponseState: UiStates.loading(),
        }));
      }

      lastRequestRef.current = () =>
        void sendImageQuery({ ...params, userMessageId });

      sdk.analytics.track(AnalyticsEvents.SEND_QUERY_INITIATED, {
        triggered_input_type: 'image',
        ...(params.sendQueryProperties ?? {}),
      });
      // Semantic callback (C4) — image queries may have empty question text.
      sdk.analytics.fireCallback('onMessageSent', params.question);

      const conversationId = await ensureConversationId();
      const lat = sdk.store.getDouble(StorageKeys.FARMER_APP_LATITUDE);
      const lng = sdk.store.getDouble(StorageKeys.FARMER_APP_LONGITUDE);
      if (!conversationId) {
        fail(sdk.labels.getLabel('chat_error_generic', 'Something went wrong. Please try again.'));
        return;
      }

      const result = await sdk.api.imageAnalysis({
        conversation_id: conversationId,
        image: params.imageBase64,
        query: params.question.length > 0 ? params.question : null,
        lat,
        lng,
        image_name: `fc-image-${Date.now()}.jpg`,
      });
      if (!mounted.current) return;

      if (result.ok && result.data.error !== true && (result.data.response ?? '').length > 0) {
        const aiLocalId = makeId('ai');
        const serverMessageId = result.data.message_id ?? null;
        mutate((prev) => ({
          ...prev,
          messages: [
            ...prev.messages.filter((m) => m.kind !== 'loading'),
            {
              kind: 'ai',
              id: aiLocalId,
              text: result.data.response ?? '',
              followUpQuestions: null,
              isPreGenerated: false,
              messageId: serverMessageId,
              contentProvider: result.data.actual_content_provider ?? null,
              contentProviderLogo: result.data.content_provider_logo ?? null,
              hideTtsSpeaker: result.data.hide_tts_speaker === true,
              hideShareIcon: result.data.hide_share_icon === true,
              hideSource: result.data.hide_source === true,
            },
          ],
          isLoading: false,
          chatResponseState: UiStates.success(result.data.response ?? ''),
        }));
        sdk.analytics.track(AnalyticsEvents.SEND_QUERY, { triggered_input_type: 'image' });
        // Semantic callback (C4).
        sdk.analytics.fireCallback('onAnswerReceived', serverMessageId ?? aiLocalId);
        if (serverMessageId) void fetchFollowUps(serverMessageId, aiLocalId);
      } else {
        const message = result.ok
          ? result.data.message ??
            sdk.labels.getLabel('chat_error_generic', 'Something went wrong. Please try again.')
          : result.message ??
            sdk.labels.getLabel('chat_error_generic', 'Something went wrong. Please try again.');
        fail(message);
      }

      function fail(message: string): void {
        const failedId = userMessageId as string;
        mutate((prev) => ({
          ...prev,
          messages: prev.messages
            .filter((m) => m.kind !== 'loading')
            .map((m) =>
              m.kind === 'user' && m.id === failedId ? { ...m, isFailed: true } : m,
            ),
          isLoading: false,
          errorMessage: message,
          failedMessageId: failedId,
          chatResponseState: UiStates.error(message),
        }));
      }
    },
    [ensureConversationId, fetchFollowUps, mutate, sdk],
  );

  // --- voice query: transcribe (endpoint #16) → text query -----------------------

  const sendVoiceQuery = useCallback(
    async (params: {
      audioUri: string;
      audioBase64: string;
      audioFormat: string;
      originScreenName: string;
    }) => {
      const userMessageId = makeId('user');
      mutate((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            kind: 'user',
            id: userMessageId,
            text: '',
            imageUri: null,
            audioUri: params.audioUri,
            userBubbleImageWideBanner: false,
            isFailed: false,
          },
          { kind: 'loading', id: makeId('ld') },
        ],
        isLoading: true,
        errorMessage: null,
        failedMessageId: null,
        chatResponseState: UiStates.loading(),
      }));

      lastRequestRef.current = () => void sendVoiceQuery(params);

      const conversationId = await ensureConversationId();
      if (!conversationId) {
        failVoice(sdk.labels.getLabel('chat_error_generic', 'Something went wrong. Please try again.'));
        return;
      }
      const transcription = await sdk.api.transcribeAudio({
        conversation_id: conversationId,
        query: params.audioBase64,
        message_reference_id: makeId('ref'),
        input_audio_encoding_format: params.audioFormat,
        triggered_input_type: 'voice',
        editable_transcription: 'True',
      });
      if (!mounted.current) return;

      if (transcription.ok && isTranscriptionAcceptable(transcription.data)) {
        sdk.analytics.track(AnalyticsEvents.TRANSCRIPTION_SUCCESS, {
          confidence: transcription.data.confidence_score ?? 0,
        });
        const heard = (transcription.data.heard_input_query ?? '').trim();
        // Reflect the heard text in the user bubble, drop the placeholder,
        // then run the standard text-query pipeline on the same bubble.
        mutate((prev) => ({
          ...prev,
          messages: prev.messages
            .filter((m) => m.kind !== 'loading')
            .map((m) =>
              m.kind === 'user' && m.id === userMessageId ? { ...m, text: heard } : m,
            ),
        }));
        await sendTextQuery({
          question: heard,
          userMessageId,
          transcriptionId: transcription.data.transcription_id ?? null,
          triggeredInputType: 'voice',
          audioUri: params.audioUri,
        });
      } else {
        sdk.analytics.track(AnalyticsEvents.TRANSCRIPTION_FAILED, {
          confidence: transcription.ok ? transcription.data.confidence_score ?? 0 : null,
        });
        failVoice(
          sdk.labels.getLabel(
            'transcription_failed',
            "We couldn't hear that clearly. Please try again.",
          ),
        );
      }

      function failVoice(message: string): void {
        mutate((prev) => ({
          ...prev,
          messages: prev.messages
            .filter((m) => m.kind !== 'loading')
            .map((m) =>
              m.kind === 'user' && m.id === userMessageId ? { ...m, isFailed: true } : m,
            ),
          isLoading: false,
          errorMessage: message,
          failedMessageId: userMessageId,
          chatResponseState: UiStates.error(message),
        }));
      }
    },
    [ensureConversationId, mutate, sdk, sendTextQuery],
  );

  // --- pre-generated content -------------------------------------------------------

  const initializeWithPreGenerated = useCallback(
    (params: {
      question: string;
      answer?: string | null;
      followUpQuestions?: string[] | null;
      homeStatementId?: string | null;
      userMessageImageUri?: string | null;
    }) => {
      const answer = params.answer ?? '';
      const aiId = makeId('ai');
      const messages: ChatMessage[] = [
        {
          kind: 'user',
          id: makeId('user'),
          text: params.question,
          imageUri: params.userMessageImageUri ?? null,
          audioUri: null,
          userBubbleImageWideBanner: false,
          isFailed: false,
        },
        {
          kind: 'ai',
          id: aiId,
          text: answer,
          followUpQuestions: params.followUpQuestions ?? null,
          isPreGenerated: true,
          messageId: params.homeStatementId ?? null,
        },
      ];
      patch({
        messages,
        suggestedQuestions: params.followUpQuestions ?? null,
        isLoading: false,
        chatResponseState: UiStates.success(answer),
      });
    },
    [patch],
  );

  // --- history (endpoint #32) with pagination ------------------------------------

  const loadChatHistory = useCallback(
    async (conversationId: string, page: number) => {
      conversationIdRef.current = conversationId;
      const isFirstPage = page <= 1;
      if (isFirstPage) {
        patch({ isLoading: true, errorMessage: null });
      } else {
        patch({ isLoadingMoreHistory: true });
      }
      const result = await sdk.api.getConversationChatHistory(conversationId, page);
      if (!mounted.current) return;
      if (result.ok) {
        const items =
          result.data.data ?? result.data.messages ?? result.data.results ?? [];
        const { messages: pageMessages, latestFollowUps, clarification } =
          mapHistoryItems(items);
        const nextPage = resolveHistoryNextPage(result.data, page);
        mutate((prev) => ({
          ...prev,
          // Pages arrive newest-first; older pages are prepended above the
          // current thread so the scroll position can be restored after prepend.
          messages: isFirstPage ? pageMessages : [...pageMessages, ...prev.messages],
          suggestedQuestions: isFirstPage ? latestFollowUps : prev.suggestedQuestions,
          clarificationRequired: isFirstPage ? clarification : prev.clarificationRequired,
          isLoading: false,
          isLoadingMoreHistory: false,
          historyNextPage: nextPage,
          isInitialHistoryLoaded: isFirstPage ? true : prev.isInitialHistoryLoaded,
          chatResponseState: UiStates.success(''),
        }));
      } else {
        patch({
          isLoading: false,
          isLoadingMoreHistory: false,
          errorMessage:
            result.message ??
            sdk.labels.getLabel('chat_history_error', 'Could not load this chat.'),
          chatResponseState: UiStates.error(result.message ?? 'history failed'),
        });
      }
    },
    [mutate, patch, sdk],
  );

  // --- TTS (endpoint #31) -----------------------------------------------------------

  const synthesiseAudio = useCallback(
    async (messageId?: string | null, text?: string | null) => {
      const userId = sdk.session.userId;
      if (!userId) return;
      let targetId = messageId ?? null;
      let targetText = text ?? null;
      if (targetId === null || targetText === null) {
        const lastAi = [...stateRef.current.messages]
          .reverse()
          .find((m): m is AiResponse => m.kind === 'ai');
        if (!lastAi) return;
        targetId = targetId ?? lastAi.messageId ?? lastAi.id;
        targetText = targetText ?? lastAi.text;
      }
      patch({ isLoadingSynthesiseAudio: true });
      const result = await sdk.api.synthesiseAudio({
        message_id: targetId,
        text: targetText,
        user_id: userId,
      });
      if (!mounted.current) return;
      if (result.ok && result.data.audio) {
        patch({ isLoadingSynthesiseAudio: false, audioPlaybackUrl: result.data.audio });
      } else {
        patch({ isLoadingSynthesiseAudio: false });
      }
    },
    [patch, sdk],
  );

  // --- dispatcher ---------------------------------------------------------------------

  const onAction = useCallback(
    (action: ChatAction) => {
      switch (action.type) {
        case 'InitializeWithPreGeneratedContent':
          initializeWithPreGenerated(action);
          break;
        case 'InitializeVoicePrototype':
          void sendVoiceQuery({
            audioUri: action.audioUri,
            audioBase64: action.audioBase64,
            audioFormat: action.audioFormat,
            originScreenName: action.originScreenName,
          });
          break;
        case 'InitializeWithQuestion':
          void sendTextQuery({
            question: action.question,
            transcriptionId: action.transcriptionId,
            audioUri: action.audioUri,
            triggeredInputType: action.audioUri ? 'voice' : 'text',
            isWeatherAdviceCTA: action.isWeatherAdviceCTA,
            isSSFR: action.isSSFR,
            ssfrCrop: action.ssfrCrop,
            statementId: action.statementId,
          });
          break;
        case 'ReplacePreGeneratedWithQuestion':
          // no dedicated analytics event — READ_FULL_ADVICE_CLICKED is
          // commented out in the app's OnboardingAnalyticsEvents.kt
          mutate((prev) => {
            const lastAi = [...prev.messages]
              .reverse()
              .find((m): m is AiResponse => m.kind === 'ai' && m.isPreGenerated);
            return {
              ...prev,
              readFullAdviceRequestedForMessageId: lastAi?.id ?? null,
              // drop the pre-generated bubble pair — the full query replaces it
              messages: prev.messages.filter(
                (m) => !(m.kind === 'ai' && m.isPreGenerated),
              ),
              suggestedQuestions: null,
            };
          });
          void sendTextQuery({
            question: action.question,
            triggeredInputType: action.triggerInputType ?? 'card',
          });
          break;
        case 'SendFollowUpQuestion':
          // follow-up clicks are tracked server-side via endpoint #30
          void sdk.api.trackFollowUpClick({ follow_up_question: action.question });
          void sendTextQuery({
            question: action.question,
            transcriptionId: action.transcriptionId,
            audioUri: action.audioUri,
            triggeredInputType: 'follow_up',
            sendQueryProperties: action.sendQueryProperties,
          });
          break;
        case 'SendQuestionWithImage':
          void sendImageQuery({
            question: action.question,
            imageUri: action.imageUri,
            imageBase64: action.imageBase64,
            sendQueryProperties: action.sendQueryProperties,
          });
          break;
        case 'SendFollowUpVoiceQuestion':
          void sendVoiceQuery({
            audioUri: action.audioUri,
            audioBase64: action.audioBase64,
            audioFormat: action.audioFormat,
            originScreenName: 'chat',
          });
          break;
        case 'SendQuestionWithAudio':
          void sendTextQuery({
            question: action.question,
            audioUri: action.audioUri,
            triggeredInputType: 'voice',
          });
          break;
        case 'LoadChatHistory':
          void loadChatHistory(action.conversationId, action.page ?? 1);
          break;
        case 'RetryLastRequest':
          patch({ errorMessage: null });
          lastRequestRef.current?.();
          break;
        case 'ClearError':
          patch({ errorMessage: null, failedMessageId: null });
          break;
        case 'ClearMessages':
          conversationIdRef.current = null;
          lastRequestRef.current = null;
          setState(initialChatState);
          break;
        case 'SynthesiseAudio':
          void synthesiseAudio(action.messageId, action.text);
          break;
        case 'ClearAudioPlaybackUrl':
          patch({ audioPlaybackUrl: null, isAudioPlaying: false });
          break;
        case 'SetAudioPlaying':
          patch({ isAudioPlaying: action.isPlaying });
          sdk.analytics.track(
            action.isPlaying
              ? AnalyticsEvents.STARTED_PLAYING_RESPONSE_AUDIO
              : AnalyticsEvents.STOPPED_PLAYING_RESPONSE_AUDIO,
            {},
          );
          break;
      }
    },
    [
      initializeWithPreGenerated,
      loadChatHistory,
      mutate,
      patch,
      sdk,
      sendImageQuery,
      sendTextQuery,
      sendVoiceQuery,
      synthesiseAudio,
    ],
  );

  return { state, onAction };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractFollowUps(response: FollowUpQuestionsResponse): {
  questions: string[];
  ids: string[];
} {
  const questions: string[] = [];
  const ids: string[] = [];
  for (const q of response.questions ?? []) {
    if (typeof q === 'string') {
      questions.push(q);
      ids.push('');
    } else if (q && typeof q.question === 'string') {
      questions.push(q.question);
      ids.push(q.id ?? '');
    }
  }
  return { questions, ids };
}

function resolveHistoryNextPage(
  data: { next?: string | number | null; total_pages?: number | null; current_page?: number | null },
  currentPage: number,
): number | null {
  if (data.next !== null && data.next !== undefined) {
    if (typeof data.next === 'number') return data.next;
    const match = /[?&]page=(\d+)/.exec(data.next);
    return match && match[1] ? parseInt(match[1], 10) : currentPage + 1;
  }
  if (typeof data.total_pages === 'number' && currentPage < data.total_pages) {
    return currentPage + 1;
  }
  return null;
}

/**
 * Maps history items (message_type_id: 1=query_text, 2=query_audio,
 * 3=response_text, 7=follow_up_questions, 11=input_image) to ChatMessages.
 */
function mapHistoryItems(items: ConversationChatHistoryMessageItem[]): {
  messages: ChatMessage[];
  latestFollowUps: string[] | null;
  clarification: boolean;
} {
  const messages: ChatMessage[] = [];
  let latestFollowUps: string[] | null = null;
  let clarification = false;
  let lastAiIndex = -1;

  items.forEach((item, index) => {
    switch (item.message_type_id) {
      case 1: // query_text
        messages.push({
          kind: 'user',
          id: item.message_id ?? makeId('hist-u') + index,
          text: item.query_text ?? '',
          imageUri: null,
          audioUri: null,
          userBubbleImageWideBanner: false,
          isFailed: false,
        });
        break;
      case 2: // query_audio
        messages.push({
          kind: 'user',
          id: item.message_id ?? makeId('hist-a') + index,
          text: item.heard_query_text ?? item.query_text ?? '',
          imageUri: null,
          audioUri: item.query_media_file_url ?? null,
          userBubbleImageWideBanner: false,
          isFailed: false,
        });
        break;
      case 11: // input_image
        messages.push({
          kind: 'user',
          id: item.message_id ?? makeId('hist-i') + index,
          text: item.query_text ?? '',
          imageUri: item.query_media_file_url ?? null,
          audioUri: null,
          userBubbleImageWideBanner: true,
          isFailed: false,
        });
        break;
      case 3: // response_text
        messages.push({
          kind: 'ai',
          id: item.message_id ?? makeId('hist-r') + index,
          text: item.response_text ?? '',
          followUpQuestions: null,
          isPreGenerated: false,
          messageId: item.message_id ?? null,
          contentProvider: item.actual_content_provider ?? null,
          contentProviderLogo: item.content_provider_logo ?? null,
          hideTtsSpeaker: item.hide_tts_speaker === true,
          hideSource: item.hide_source === true,
        });
        lastAiIndex = messages.length - 1;
        if (item.clarification_required === true) clarification = true;
        break;
      case 7: {
        // follow_up_questions — attach to the preceding AI response.
        // The app returns these as objects ({follow_up_question_id, sequence,
        // question}); normalize to display strings (accept plain strings too).
        const questions = (item.questions ?? [])
          .map((q) => (typeof q === 'string' ? q : q?.question ?? ''))
          .filter((q) => q.length > 0);
        if (lastAiIndex >= 0) {
          const ai = messages[lastAiIndex];
          if (ai && ai.kind === 'ai') {
            messages[lastAiIndex] = { ...ai, followUpQuestions: questions };
          }
        }
        latestFollowUps = questions;
        if (item.clarification_required === true) clarification = true;
        break;
      }
      default:
        // unknown message types are skipped (fidelity: app renders known types only)
        break;
    }
  });

  return { messages, latestFollowUps, clarification };
}
