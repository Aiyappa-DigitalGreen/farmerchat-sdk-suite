/**
 * useChat — port of `ChatViewModel` + chat UDF (docs/01 §3.8: ChatAction /
 * ChatState / ChatMessage). Covers every action: question / pre-generated /
 * voice / image initialization, follow-ups via endpoint #29, retry,
 * clarification, synthesise-audio TTS, history pagination with position
 * restore hooks.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiSuccess, UiStates, type ApiResult, type UiState } from '../core/apiResult';
import { AnalyticsEvents } from '../core/analytics';
import {
  sanitizeAgenticStreamText,
  StreamErrorKinds,
  type AgenticDoneEvent,
  type StreamErrorKind,
} from '../core/agenticModels';
import type { FarmerChatSdk } from '../core/sdk';
import { StorageKeys } from '../core/sessionStore';
import {
  alignmentAnalyticsType,
  alignmentKindFromType,
  isAdditiveAlignment,
} from '../core/types';
import type {
  AlignmentChip,
  AlignmentKind,
  ConversationChatHistoryMessageItem,
  FollowUpQuestionsResponse,
  TextPromptRequest,
  TextPromptResponse,
} from '../core/types';
import { isTranscriptionAcceptable } from './useHome';

/**
 * Minimum on-screen time per tool status, so back-to-back tool events (latency 0) are not
 * collapsed by React's state batching into just the last one. Port of the Android
 * `TOOL_STATUS_MIN_DWELL_MS`; the async-iterator transport is what makes awaiting it here safe —
 * events queue up instead of being dropped.
 */
const TOOL_STATUS_MIN_DWELL_MS = 700;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  // ---- agentic streaming (SDK 2.0.0, endpoint #27a). Every field defaults to the 1.0.0
  // behaviour, so a synchronous answer is indistinguishable from before. ----
  /** True while the agentic stream is in progress; suppresses the action buttons. */
  isStreaming?: boolean;
  /** Transient tool progress label (e.g. "Checking weather forecast") shown while streaming. */
  streamingStatus?: string | null;
  /** True when this answer came from the agentic endpoint. */
  isAgentic?: boolean;
  /**
   * Terminal outcome of an agentic stream that did NOT complete normally. When true the answer
   * renders with an inline error and a retry action; `text` may still hold a preserved partial
   * answer, or be blank if the stream broke at the start. Always false for a normally finalized
   * answer.
   */
  isInterrupted?: boolean;
  /** Why the stream ended early; only meaningful when `isInterrupted`. */
  streamErrorKind?: StreamErrorKind | null;

  // ---- alignment surfaces (2.0.0) ----
  /**
   * Non-null when this response is an alignment surface (clarify / confirm / escalate or a
   * capability prompt) rather than a normal answer. Drives the chip rendering and the urgent
   * (escalate) treatment in place of the usual action row.
   */
  alignmentKind?: AlignmentKind | null;
  /** Quick-reply chips: label is shown, value is sent on tap. */
  alignmentChips?: AlignmentChip[] | null;
  /**
   * The surface's own prompt message. For an EXCLUSIVE surface the prompt already lives in
   * `text` (it replaced the answer), so this stays null. For an ADDITIVE surface
   * ({@link isAdditiveAlignment}) `text` holds the real answer and this carries the nudge
   * rendered below it.
   */
  alignmentMessage?: string | null;
  /**
   * Chip values already tapped on this surface. Accumulates so every picked chip stays
   * highlighted and locked — each chip is clickable once — while the rest stay tappable.
   */
  alignmentSelectedValues?: string[];
  /**
   * The query that triggered this surface. Kept so a capability chip (e.g. "Share my location")
   * can re-send the user's real question once the capability is satisfied, rather than sending
   * the chip label as if it were the question.
   */
  alignmentOriginalQuery?: string | null;
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
  /**
   * Alignment chip tapped (2.0.0). Records the pick on the surface — so the chip stays
   * highlighted and locked — and sends the chip's `value` (falling back to its `label`) as a
   * follow-up question, exactly like the Compose `onChipClick`.
   *
   * NOTE: the Android core has the `alignmentSelectedValues` field but nothing that fills it —
   * its Compose `onChipClick` only dispatches `SendFollowUpQuestion`, so a tapped chip never
   * locks. This action is an addition on React Native (see the report / docs/04 delta), not a
   * port.
   */
  | {
      type: 'SelectAlignmentChip';
      /** Local id of the AI message carrying the surface. */
      messageId: string;
      chip: AlignmentChip;
      kind: AlignmentKind;
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

  // --- shared answer settling (#27 AND the agentic #27a `metadata` event) --------

  /** Marks the user bubble failed, drops the placeholder / streaming bubble, shows the error. */
  const failQuery = useCallback(
    (failedId: string, placeholderId: string | null, message: string) => {
      mutate((prev) => ({
        ...prev,
        messages: prev.messages
          .filter((m) => m.kind !== 'loading' && m.id !== placeholderId)
          .map((m) => (m.kind === 'user' && m.id === failedId ? { ...m, isFailed: true } : m)),
        isLoading: false,
        errorMessage: message,
        failedMessageId: failedId,
        chatResponseState: UiStates.error(message),
      }));
    },
    [mutate],
  );

  const markFirstQueryAsked = useCallback(() => {
    if (!sdk.store.getBoolean(StorageKeys.FIRST_QUERY_ASKED)) {
      sdk.store.set(StorageKeys.FIRST_QUERY_ASKED, true);
      sdk.analytics.track(AnalyticsEvents.FIRST_QUERY_ASKED, {});
    }
  }, [sdk]);

  /**
   * Settles a {@link TextPromptResponse} into the thread. Port of the Android core's
   * `handleTextPromptResult`.
   *
   * Used by BOTH the synchronous #27 path and the agentic #27a terminal `metadata` event — the
   * `metadata` payload is field-compatible — so analytics, the semantic callbacks, TTS gating,
   * follow-ups (endpoint #29) and the alignment surfaces are shared, not reimplemented.
   */
  const handleTextPromptResult = useCallback(
    (
      result: ApiResult<TextPromptResponse>,
      placeholderId: string,
      ctx: {
        userMessageId: string;
        triggeredInputType: string;
        sendQueryProperties?: SendQueryProperties | null;
        /** Agentic answers reuse the stream bubble's id so it settles in place. */
        isAgentic?: boolean;
      },
    ) => {
      if (!result.ok) {
        if (ctx.sendQueryProperties) {
          sdk.analytics.track(AnalyticsEvents.SEND_QUERY, {
            triggered_input_type: ctx.triggeredInputType,
            ...ctx.sendQueryProperties,
            is_valid_query: false,
          });
        }
        const message =
          result.isNetworkError || result.isTimeout
            ? sdk.labels.getLabel(
                'chat_error_network',
                'No internet connection. Please check your network and try again.',
              )
            : result.message ??
              sdk.labels.getLabel('chat_error_generic', 'Something went wrong. Please try again.');
        failQuery(ctx.userMessageId, placeholderId, message);
        return;
      }

      const data = result.data;
      const alignmentKind = alignmentKindFromType(data.alignments?.type);
      const isExclusiveAlignment = alignmentKind !== null && !isAdditiveAlignment(alignmentKind);
      // First NON-NULL of response / translated_response / message (not first non-blank — an
      // empty `response` ends the chain, exactly like Kotlin's `?:` + `takeIf { isNotBlank() }`).
      const primary = data.response ?? data.translated_response ?? data.message ?? null;
      // An EXCLUSIVE alignment surface arrives with an empty `response` ON PURPOSE: its prompt
      // IS the message. Fall back to alignments.message so it is not mistaken for an empty
      // answer and turned into an error in the farmer's face.
      const answerText =
        primary !== null && primary.trim().length > 0
          ? primary
          : isExclusiveAlignment
            ? data.alignments?.message ?? ''
            : '';

      if (data.error === true || answerText.trim().length === 0) {
        failQuery(
          ctx.userMessageId,
          placeholderId,
          data.message && data.message.trim().length > 0
            ? data.message
            : sdk.labels.getLabel('chat_error_generic', 'Something went wrong. Please try again.'),
        );
        return;
      }

      markFirstQueryAsked();
      const serverMessageId = data.message_id ?? null;
      // The agentic path reuses the streaming bubble's id: the loading bubble became the
      // streaming answer and now becomes the settled answer, in place and without replaying the
      // client-side typewriter over text the farmer already watched arrive. (Android mints a new
      // id here — see the report's deviation list.)
      const aiLocalId = ctx.isAgentic === true ? placeholderId : makeId('ai');
      mutate((prev) => {
        const settled: AiResponse = {
          kind: 'ai',
          id: aiLocalId,
          text: answerText,
          followUpQuestions: null,
          isPreGenerated: false,
          messageId: serverMessageId,
          contentProvider: data.actual_content_provider ?? null,
          contentProviderLogo: data.content_provider_logo ?? null,
          hideTtsSpeaker: data.hide_tts_speaker === true,
          hideShareIcon: data.hide_share_icon === true,
          hideSource: data.hide_source === true,
          isAgentic: ctx.isAgentic === true,
          // 2.0.0: an alignment surface asks the user to clarify/confirm instead of (or
          // alongside) answering. Exclusive surfaces replace the answer, additive ones sit
          // below it — see isAdditiveAlignment.
          alignmentKind,
          alignmentChips: data.alignments?.chips ?? null,
          alignmentMessage:
            alignmentKind !== null && isAdditiveAlignment(alignmentKind)
              ? data.alignments?.message ?? null
              : null,
          alignmentSelectedValues: [],
          alignmentOriginalQuery: data.alignments?.original_query ?? null,
        };
        // Replace IN PLACE when the bubble already exists (agentic: the streaming bubble sits at
        // `placeholderId`). Filter-then-append would move a settling answer to the bottom of the
        // thread if the farmer had already sent a follow-up — Compose does `it[idx] = settled`.
        const index = prev.messages.findIndex((m) => m.id === placeholderId);
        const messages: ChatMessage[] =
          index >= 0
            ? prev.messages.map((m, i) => (i === index ? settled : m))
            : [...prev.messages.filter((m) => m.kind !== 'loading'), settled];
        return {
          ...prev,
          messages,
          isLoading: false,
          errorMessage: null,
          failedMessageId: null,
          chatResponseState: UiStates.success(answerText),
          clarificationRequired:
            data.intent_classification_output?.clarification_needed === true,
        };
      });

      sdk.analytics.track(AnalyticsEvents.SEND_QUERY, {
        triggered_input_type: ctx.triggeredInputType,
        ...(ctx.sendQueryProperties ?? {}),
      });
      // Semantic callback (C4).
      sdk.analytics.fireCallback('onAnswerReceived', serverMessageId ?? aiLocalId);
      // Real follow-ups always come from endpoint #29.
      if (serverMessageId && data.hide_follow_up_question !== true) {
        void fetchFollowUps(serverMessageId, aiLocalId);
      }
    },
    [failQuery, fetchFollowUps, markFirstQueryAsked, mutate, sdk],
  );

  // --- agentic streaming (#27a, SDK 2.0.0) ---------------------------------------

  /** Replaces the loading placeholder / prior streaming bubble with the in-progress answer. */
  const updateStreamingResponse = useCallback(
    (streamId: string, text: string, status: string | null) => {
      mutate((prev) => {
        const streaming: AiResponse = {
          kind: 'ai',
          id: streamId,
          text,
          followUpQuestions: [],
          isPreGenerated: false,
          isStreaming: true,
          streamingStatus: status,
          isAgentic: true,
        };
        const index = prev.messages.findIndex((m) => m.id === streamId);
        let messages: ChatMessage[];
        if (index >= 0) {
          messages = prev.messages.slice();
          messages[index] = streaming;
        } else {
          const last = prev.messages[prev.messages.length - 1];
          const base =
            last !== undefined && last.kind === 'loading'
              ? prev.messages.slice(0, -1)
              : prev.messages;
          messages = [...base, streaming];
        }
        return {
          ...prev,
          messages,
          isLoading: true,
          errorMessage: null,
          failedMessageId: null,
        };
      });
    },
    [mutate],
  );

  /** Settles a streamed answer that finished without a `metadata` event. */
  const finalizeAgenticAnswer = useCallback(
    (streamId: string, text: string, followUps: string[] | null, messageId: string | null) => {
      markFirstQueryAsked();
      mutate((prev) => {
        const settled: AiResponse = {
          kind: 'ai',
          id: streamId,
          text,
          followUpQuestions: followUps,
          isPreGenerated: false,
          messageId,
          isAgentic: true,
        };
        const index = prev.messages.findIndex((m) => m.id === streamId);
        let messages: ChatMessage[];
        if (index >= 0) {
          messages = prev.messages.slice();
          messages[index] = settled;
        } else {
          messages = [...prev.messages.filter((m) => m.kind !== 'loading'), settled];
        }
        return {
          ...prev,
          messages,
          isLoading: false,
          errorMessage: null,
          failedMessageId: null,
          chatResponseState: UiStates.success(text),
          suggestedQuestions: followUps,
          suggestedQuestionIds: null,
        };
      });
    },
    [markFirstQueryAsked, mutate],
  );

  /** Settles a stream that ended early; `text` may hold a preserved partial answer. */
  const interruptAgentic = useCallback(
    (streamId: string, text: string, kind: StreamErrorKind) => {
      mutate((prev) => {
        const settled: AiResponse = {
          kind: 'ai',
          id: streamId,
          text,
          isPreGenerated: false,
          isAgentic: true,
          isInterrupted: true,
          streamErrorKind: kind,
        };
        const index = prev.messages.findIndex((m) => m.id === streamId);
        let messages: ChatMessage[];
        if (index >= 0) {
          messages = prev.messages.slice();
          messages[index] = settled;
        } else {
          messages = [...prev.messages.filter((m) => m.kind !== 'loading'), settled];
        }
        return {
          ...prev,
          messages,
          isLoading: false,
          errorMessage: sdk.labels.getLabel(
            'chat_error_generic',
            'Something went wrong. Please try again.',
          ),
        };
      });
    },
    [mutate, sdk],
  );

  /**
   * Consumes the agentic SSE stream (#27a, gated on `enableAgenticChat`). Port of the Android
   * core's `streamAgenticAnswer`.
   *
   * Accumulates `text_delta`s into the answer bubble for live typing, surfaces tool status labels
   * while tools run, and finalizes on `metadata`. If the stream ends without one, falls back to
   * `done`, then to the accumulated text.
   */
  const streamAgenticAnswer = useCallback(
    async (
      request: TextPromptRequest,
      /**
       * The loading placeholder's id, reused as the stream id so the loading bubble becomes the
       * answer bubble in place, with no remove/insert flicker.
       */
      streamId: string,
      ctx: {
        userMessageId: string;
        triggeredInputType: string;
        sendQueryProperties?: SendQueryProperties | null;
      },
    ) => {
      let accumulated = '';
      let finalized = false;
      // Captured but NOT finalized on arrival: a `metadata` normally follows `done` and is
      // richer (message_id, follow-up ids), so it wins. `done` is only a fallback.
      let pendingDone: AgenticDoneEvent | null = null;

      // Single exit for every "no terminal metadata" outcome — clean EOF, a failure event, or a
      // thrown error. Runs at most once (guarded + latches `finalized`).
      const finalizeStreamOrFail = (errorKind: StreamErrorKind | null): void => {
        if (finalized) return;
        finalized = true;
        const fallbackText = sanitizeAgenticStreamText(accumulated);
        const done = pendingDone;
        const doneAnswer = done?.answer ?? null;
        if (
          done !== null &&
          ((doneAnswer !== null && doneAnswer.trim().length > 0) || fallbackText.length > 0)
        ) {
          // A `done` means the model actually finished → a complete answer, not an interruption,
          // even if the transport dropped right after.
          finalizeAgenticAnswer(
            streamId,
            doneAnswer !== null && doneAnswer.trim().length > 0 ? doneAnswer : fallbackText,
            done.followUps.length > 0 ? done.followUps : null,
            null,
          );
        } else if (errorKind !== null && fallbackText.length > 0) {
          // Genuine error after some text arrived: keep the partial and mark it interrupted so
          // the UI can offer retry.
          interruptAgentic(streamId, fallbackText, errorKind);
        } else if (fallbackText.length > 0) {
          // Clean EOF with partial text and no terminal event: some backends stream deltas
          // without a done/metadata. Treat it as the complete answer — flagging it interrupted
          // would make every normal answer on such a backend look broken.
          finalizeAgenticAnswer(streamId, fallbackText, null, null);
        } else {
          // Nothing usable arrived.
          interruptAgentic(streamId, '', errorKind ?? StreamErrorKinds.UNKNOWN);
        }
      };

      try {
        for await (const event of sdk.agentic.stream(request)) {
          // Screen left / hook unmounted: break so the generator's finally aborts the request.
          // No error card — there is nothing left to show it on.
          if (!mounted.current) return;

          switch (event.type) {
            case 'tool_call':
            case 'tool_result':
              if (event.statusText !== null && event.statusText.trim().length > 0) {
                updateStreamingResponse(
                  streamId,
                  sanitizeAgenticStreamText(accumulated),
                  event.statusText,
                );
                await sleep(TOOL_STATUS_MIN_DWELL_MS);
              }
              break;

            case 'text_delta':
              accumulated += event.delta;
              // Text is flowing; clear any transient tool status.
              updateStreamingResponse(streamId, sanitizeAgenticStreamText(accumulated), null);
              break;

            case 'metadata':
              finalized = true;
              // `metadata` carries a TextPromptResponse — the same shape #27 returns — so
              // finalize through the shared synchronous path and inherit its analytics, TTS
              // gating, follow-ups and alignment handling for free.
              handleTextPromptResult(apiSuccess(event.response), streamId, {
                ...ctx,
                isAgentic: true,
              });
              break;

            // Fallback terminal: remember it, let a following `metadata` win.
            case 'done':
              pendingDone = event;
              break;

            // Don't discard a completed `done`: if it arrived before the failure the answer is
            // still finalized from it.
            case 'failure':
              finalizeStreamOrFail(event.kind);
              break;
          }
          if (finalized) break;
        }
        // Clean EOF with no terminal metadata: no transport error was observed.
        finalizeStreamOrFail(null);
      } catch {
        // A mid-stream throw is a transport problem.
        if (mounted.current) finalizeStreamOrFail(StreamErrorKinds.NETWORK);
      }
    },
    [
      finalizeAgenticAnswer,
      handleTextPromptResult,
      interruptAgentic,
      sdk,
      updateStreamingResponse,
    ],
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

      // Hoisted so the agentic path can reuse it as the stream id (the loading bubble becomes
      // the answer bubble in place) and so both paths remove exactly this placeholder.
      const placeholderId = makeId('ld');

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
          messages: [...prev.messages, userMessage, { kind: 'loading', id: placeholderId }],
          isLoading: true,
          errorMessage: null,
          failedMessageId: null,
          suggestedQuestions: null,
          suggestedQuestionIds: null,
          clarificationRequired: false,
          chatResponseState: UiStates.loading(),
        }));
      } else {
        // retry path — reuse the existing bubble. An interrupted streaming bubble from the
        // previous attempt is intentionally left in place (it keeps its partial text and, no
        // longer being the latest answer, drops its retry card) — Android parity.
        const retryId = userMessageId;
        mutate((prev) => ({
          ...prev,
          messages: [
            ...prev.messages.map((m) =>
              m.kind === 'user' && m.id === retryId ? { ...m, isFailed: false } : m,
            ),
            { kind: 'loading', id: placeholderId },
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
        failQuery(
          userMessageId,
          placeholderId,
          sdk.labels.getLabel('chat_error_generic', 'Something went wrong. Please try again.'),
        );
        return;
      }

      const request: TextPromptRequest = {
        query: question,
        conversation_id: conversationId,
        // App parity: message_id is sent empty (""); the response id is authoritative.
        message_id: '',
        statement_id: params.statementId ?? null,
        weather_cta_triggered: params.isWeatherAdviceCTA === true,
        triggered_input_type: params.triggeredInputType,
        ssfr_crop: params.isSSFR === true ? params.ssfrCrop ?? null : null,
        use_entity_extraction: true,
        transcription_id: params.transcriptionId ?? null,
        retry: params.isRetry === true,
      };
      const ctx = {
        userMessageId,
        triggeredInputType: params.triggeredInputType,
        sendQueryProperties: params.sendQueryProperties,
      };

      if (sdk.config.enableAgenticChat) {
        // 2.0.0 opt-in: streams #27a.
        await streamAgenticAnswer(request, placeholderId, ctx);
        return;
      }

      // 1.0.0 default: one synchronous #27 reply.
      const result = await sdk.api.getAnswerForTextQuery(request);
      if (!mounted.current) return;
      handleTextPromptResult(result, placeholderId, ctx);
    },
    [
      ensureConversationId,
      failQuery,
      handleTextPromptResult,
      mutate,
      sdk,
      streamAgenticAnswer,
    ],
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
        // App parity (PlantixRequest.kt): triggered_input_type "image",
        // latitude/longitude sent as STRINGs.
        triggered_input_type: 'image',
        query: params.question.length > 0 ? params.question : null,
        latitude: lat != null ? String(lat) : null,
        longitude: lng != null ? String(lng) : null,
        image_name: `fc-image-${Date.now()}.jpg`,
        retry: false,
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
          mapHistoryItems(items, page);
        // The #32 response carries no pagination metadata (only
        // {conversation_id, data}); the app pages by "did this page return any
        // items" — page+1 until an empty page comes back. Base this on the RAW
        // items, not the mapped bubbles: a page can hold only type-7 follow-up
        // or unknown-type items that map to zero bubbles yet still advance.
        const nextPage = items.length > 0 ? page + 1 : null;
        mutate((prev) => ({
          ...prev,
          // Pages arrive newest-first; older pages are prepended above the
          // current thread so the scroll position can be restored after prepend.
          // Hard guard: duplicate ids break React list identity (and hard-crash the equivalent
          // Compose LazyColumn), so never trust the wire to be unique.
          messages: dedupeById(isFirstPage ? pageMessages : [...pageMessages, ...prev.messages]),
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
            // App parity: weather-CTA / SSFR queries carry their own
            // triggered_input_type (was always voice/text).
            triggeredInputType: action.isWeatherAdviceCTA
              ? 'weather'
              : action.isSSFR
                ? 'ssfr'
                : action.audioUri
                  ? 'voice'
                  : 'text',
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
            // App parity: read-full-advice sends triggered_input_type
            // "read_full_advice" (was "card"). (statement_id + append-not-replace
            // remain — tracked in docs/04.)
            question: action.question,
            triggeredInputType: 'read_full_advice',
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
        case 'SelectAlignmentChip': {
          // Lock/highlight the tapped chip on its surface, then send it as a follow-up. The
          // chip's `value` is what the backend expects; `label` is the display text and only a
          // fallback.
          const picked = action.chip.value ?? action.chip.label ?? '';
          if (picked.trim().length === 0) break;
          const surfaceId = action.messageId;
          mutate((prev) => ({
            ...prev,
            messages: prev.messages.map((m) =>
              m.kind === 'ai' && m.id === surfaceId
                ? {
                    ...m,
                    alignmentSelectedValues: (m.alignmentSelectedValues ?? []).includes(picked)
                      ? m.alignmentSelectedValues ?? []
                      : [...(m.alignmentSelectedValues ?? []), picked],
                  }
                : m,
            ),
          }));
          void sdk.api.trackFollowUpClick({ follow_up_question: picked });
          void sendTextQuery({
            question: picked,
            triggeredInputType: 'follow_up',
            sendQueryProperties: {
              // Segments the funnel by which alignment surface was tapped. Same property name
              // the Android reference documents on AlignmentKind.analyticsType.
              agentic_chip_type: alignmentAnalyticsType(action.kind),
            },
          });
          break;
        }
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

/**
 * Maps history items (message_type_id: 1=query_text, 2=query_audio,
 * 3=response_text, 7=follow_up_questions, 11=input_image) to ChatMessages.
 */
/** Keeps the first occurrence of each message id — a duplicate key crashes the Compose list. */
function dedupeById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

// A query and its response SHARE one `message_id` (verified live 2026-09-01: a single turn
// returns type 1, 3 and 7 all carrying the same id). Using it as the React list key collides two
// rows — app parity (fc-compose ChatViewModel.kt:1027) keys on
// message_id + message_type_id + page + index. `messageId` keeps the raw API id for TTS/follow-ups.
function mapHistoryItems(items: ConversationChatHistoryMessageItem[], page = 1): {
  messages: ChatMessage[];
  latestFollowUps: string[] | null;
  clarification: boolean;
} {
  const messages: ChatMessage[] = [];
  let latestFollowUps: string[] | null = null;
  let clarification = false;
  let lastAiIndex = -1;

  items.forEach((item, index) => {
    const uiId = `${item.message_id ?? makeId('hist')}_${item.message_type_id ?? 'x'}_${page}_${index}`;
    switch (item.message_type_id) {
      case 1: // query_text
        messages.push({
          kind: 'user',
          id: uiId,
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
          id: uiId,
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
          id: uiId,
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
          id: uiId,
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
