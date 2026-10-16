/**
 * useChat — port of `ChatViewModel` + chat UDF (docs/01 §3.8: ChatAction /
 * ChatState / ChatMessage). Covers every action: question / pre-generated /
 * voice / image initialization, follow-ups via endpoint #29, retry,
 * clarification, synthesise-audio TTS, history pagination with position
 * restore hooks.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiSuccess, UiStates, type ApiResult, type UiState } from '../core/apiResult';
import { AnalyticsEvents, ScreenNames } from '../core/analytics';
import {
  sanitizeAgenticStreamText,
  sanitizeAgenticFinalText,
  StreamErrorKinds,
  type AgenticDoneEvent,
  type StreamErrorKind,
} from '../core/agenticModels';
import type { FarmerChatSdk } from '../core/sdk';
import { StorageKeys } from '../core/sessionStore';
import { Labels } from '../core/labels';
import { gpsFromPickerExif, writeGpsExif } from '../core/imageExif';
import { shrinkForUpload } from '../core/imageShrink';
import { currentLocationIfPermitted } from './imageLocation';
import {
  ChipStatus,
  minimalSendQueryProps,
  sendQueryAnalyticsProperties,
  withResponseChipStatus,
  withSendQueryResult,
  base64SizeKb,
  type SendQueryProps,
} from '../core/sendQueryAnalytics';
import {
  alignmentAnalyticsType,
  alignmentChipSend,
  AlignmentChipWire,
  AlignmentKinds,
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
import {
  ALIGN_CHIP_SEL,
  alignmentChipRequestParams,
  historyFollowUpQuestions,
  historyVoiceText,
  imageQueryName,
  imageQueryText,
  sortHistoryItems,
} from '../core/chatWire';

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

/**
 * The farmer's resolved location, shown in the thread in place of a text bubble once a
 * GPS_PROMPT alignment chip has been satisfied (2.0.0). Rendered right-aligned by
 * `LocationChatBubble` on ChatScreen.
 *
 * 1:1 port of the Android core `ChatMessage.LocationMessage` (farmerchat-core
 * `ui/chat/ChatModels.kt`:95) — same two fields, same role.
 *
 * PRODUCED BY {@link ChatAction} `SendLocationSharedQuery` — the capability-chip outcome path
 * (2.0.0). The chat screen arms the shared location flow when a `gps-prompt` chip whose action
 * is `invoke` is tapped, and dispatches that action once a real fix is stored. A blank address
 * yields NO bubble at all, matching the app. (Earlier revisions of this SDK defined and
 * rendered the variant with no producer on any platform — that open question is closed.)
 */
export interface LocationMessage {
  kind: 'location';
  id: string;
  /** Human-readable address — the #16 response's `display_address`. */
  address: string;
}

export type ChatMessage = UserMessage | AiResponse | LoadingPlaceholder | LocationMessage;

export type ChatEntrySource = 'home' | 'history';

/**
 * The app's `SendQueryProperties` (core/analytics/SendQueryAnalytics.kt), carried from a send to
 * its Send_Query. See core/sendQueryAnalytics.ts.
 */
export type SendQueryProperties = SendQueryProps;

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
      /**
       * App `SendQueryProperties.isFollowupPrompt`: true for a follow-up chip / related question
       * (app ChatScreen.kt:959-971 `handleFollowUp`), false for text typed in the composer (app
       * ChatScreen.kt:1764-1811). Decides `triggered_input_type` (app ChatViewModel.kt:993-997).
       * Omitted = true (the pre-existing SDK behaviour for non-composer callers).
       */
      isFollowupPrompt?: boolean;
      transcriptionId?: string | null;
      audioUri?: string | null;
      sendQueryProperties?: SendQueryProperties | null;
    }
  | {
      type: 'SendQuestionWithImage';
      question: string;
      imageUri: string;
      imageBase64: string;
      /** expo-image-picker `exif` (the photo's own GPS). */
      imageExif?: Record<string, unknown> | null;
      imageWidth?: number | null;
      imageHeight?: number | null;
      sendQueryProperties?: SendQueryProperties | null;
    }
  /**
   * Alignment chip tapped (2.0.0). Records the pick on the surface — so the chip stays
   * highlighted and locked — and sends the chip's `value` (falling back to its `label`) as a
   * follow-up question, exactly like the Compose `onChipClick`.
   *
   * PARITY: the Android core fills `alignmentSelectedValues` from core itself —
   * `ChatViewModel.recordAlignmentPick()` (farmerchat-core `ui/chat/ChatViewModel.kt`:906) runs
   * on every `SendFollowUpQuestion` and locks the chip when the question matches one of the
   * surface's own chip `value`/`label`s, so both Compose and Views light up without knowing
   * about selection state. React Native records the pick explicitly in this action instead of
   * pattern-matching the question, which is the same behaviour reached a more direct way.
   */
  | {
      type: 'SelectAlignmentChip';
      /** Local id of the AI message carrying the surface. */
      messageId: string;
      chip: AlignmentChip;
      kind: AlignmentKind;
      /**
       * `agentic_chip_value` when it differs from the chip's own value: the app reports a
       * decline sent on the farmer's behalf (permission denied / picker cancelled) as `not_now`.
       */
      analyticsChipValue?: string;
    }
  /**
   * The OUTCOME of a satisfied `gps-prompt` capability chip (2.0.0): the farmer shared a real
   * location, so mark `share_precise_location` picked on the surface, show the resolved address
   * as a {@link LocationMessage} in place of a text bubble, and re-send the surface's
   * `alignmentOriginalQuery` — never the chip's own text.
   *
   * Port of the Android core's `ChatAction.SendLocationSharedQuery` +
   * `ChatViewModel.sendLocationSharedQuery`. The chat screen owns the permission/GPS flow and
   * dispatches this only for an outcome it armed itself.
   */
  | { type: 'SendLocationSharedQuery'; sourceMessageId: string; address: string }
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
  | {
      type: 'SetAudioPlaying';
      isPlaying: boolean;
      /** Seconds of the clip played so far, reported on a stop (app `No_of_seconds_played`). */
      secondsPlayed?: number;
    };

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

  // docs/02 Step 3: the conversation belonged to the replaced guest; the next send creates one.
  useEffect(
    () =>
      sdk.session.addGuestReplacedListener(() => {
        conversationIdRef.current = null;
      }),
    [sdk],
  );

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

  // --- Send_Query (app: fired when the answer lands, ChatViewModel.kt pending props) ---------
  const reportSendQuery = useCallback(
    (
      ctx: { sendQueryProperties?: SendQueryProperties | null; question?: string },
      outcome: {
        isValid: boolean;
        intent?: TextPromptResponse['intent_classification_output'];
        shownChipType?: string | null;
      },
    ) => {
      const base = ctx.sendQueryProperties;
      if (!base) return;
      const stamped = withResponseChipStatus(
        withSendQueryResult(base, {
          isValid: outcome.isValid,
          question: ctx.question,
          intent: outcome.intent ?? null,
        }),
        outcome.shownChipType ?? null,
      );
      sdk.analytics.track(AnalyticsEvents.SEND_QUERY, sendQueryAnalyticsProperties(stamped));
    },
    [sdk],
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
        /** The query as sent (Send_Query `length_of_Text_query`). */
        question?: string;
        /** Agentic answers reuse the stream bubble's id so it settles in place. */
        isAgentic?: boolean;
      },
    ) => {
      if (!result.ok) {
        // App ChatViewModel.kt:2066-2076: a failed answer still reports Send_Query, Valid_Query false.
        reportSendQuery(ctx, { isValid: false });
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
      const rawPrimary = data.response ?? data.translated_response ?? data.message ?? null;
      const primary =
        rawPrimary !== null && ctx.isAgentic === true ? sanitizeAgenticFinalText(rawPrimary) : rawPrimary;
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

      // App ChatViewModel.kt:1706-1722 / 2028-2043: Send_Query fires on the answer, Valid_Query
      // true + the intent fields, and `available` when this answer presents chips.
      reportSendQuery(ctx, {
        isValid: true,
        intent: data.intent_classification_output ?? null,
        shownChipType:
          alignmentKind !== null && (data.alignments?.chips ?? []).length > 0
            ? alignmentAnalyticsType(alignmentKind)
            : null,
      });
      // Semantic callback (C4).
      sdk.analytics.fireCallback('onAnswerReceived', serverMessageId ?? aiLocalId);
      // Real follow-ups always come from endpoint #29.
      if (serverMessageId && data.hide_follow_up_question !== true) {
        void fetchFollowUps(serverMessageId, aiLocalId);
      }
    },
    [failQuery, fetchFollowUps, markFirstQueryAsked, mutate, reportSendQuery, sdk],
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
        question?: string;
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
        const doneAnswer = done?.answer != null ? sanitizeAgenticFinalText(done.answer) : null;
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
          reportSendQuery(ctx, { isValid: true });
        } else if (errorKind !== null && fallbackText.length > 0) {
          // Genuine error after some text arrived: keep the partial and mark it interrupted so
          // the UI can offer retry.
          interruptAgentic(streamId, fallbackText, errorKind);
          // App ChatViewModel.kt:1766-1771: partial content counts as a valid response.
          reportSendQuery(ctx, { isValid: true });
        } else if (fallbackText.length > 0) {
          // Clean EOF with partial text and no terminal event: some backends stream deltas
          // without a done/metadata. Treat it as the complete answer — flagging it interrupted
          // would make every normal answer on such a backend look broken.
          finalizeAgenticAnswer(streamId, fallbackText, null, null);
          reportSendQuery(ctx, { isValid: true });
        } else {
          // Nothing usable arrived.
          interruptAgentic(streamId, '', errorKind ?? StreamErrorKinds.UNKNOWN);
          // App ChatViewModel.kt:1808-1816: nothing usable → Valid_Query false.
          reportSendQuery(ctx, { isValid: false });
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
      reportSendQuery,
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
      /**
       * 2.0.0 capability-chip outcome: the caller has ALREADY staged the thread (a
       * {@link LocationMessage} standing in for the user's text bubble, plus the loading
       * placeholder) in one atomic update, so this send must not append its own bubbles.
       * `anchorId` stands in for the user-bubble id on the failure and retry paths — nothing
       * of kind `user` carries it, so nothing gets marked failed and a retry only appends a
       * fresh placeholder. Mirrors Android calling `fetchTextPromptResponse` with a
       * placeholder id it prepared itself.
       */
      staged?: { placeholderId: string; anchorId: string } | null;
      /** User-bubble text when it differs from the sent [question] (gender-select chips). */
      displayText?: string | null;
      /**
       * Alignment-chip sends only (app ChatViewModel.fetchTextPromptResponse): the server
       * `message_id` of the surface the pick answers -> `parent_message_id`.
       */
      parentMessageId?: string | null;
      /** GPS_PROMPT declined -> `location_declined: true`. */
      locationDeclined?: boolean;
      /** UPLOAD_PHOTO declined -> `photo_declined: true`. */
      photoDeclined?: boolean;
    }) => {
      const question = params.question.trim();
      if (question.length === 0) return;

      // App buildMinimalSendQueryProps: callers that know more (chip picks, follow-up chips, read
      // full advice, voice) pass their own props; anything else is a manual text/voice send whose
      // chip context is read from the thread BEFORE this send changes it.
      const analyticsProps: SendQueryProps =
        params.sendQueryProperties ??
        minimalSendQueryProps({
          question,
          isImageQuery: false,
          isVoiceQuery: Boolean(params.transcriptionId),
          lastAi: lastAiMessage(stateRef.current.messages),
        });

      // Hoisted so the agentic path can reuse it as the stream id (the loading bubble becomes
      // the answer bubble in place) and so both paths remove exactly this placeholder.
      const placeholderId = params.staged?.placeholderId ?? makeId('ld');

      let userMessageId = params.userMessageId ?? null;
      if (params.staged) {
        // Thread already staged by the caller — no bubble to append.
        userMessageId = params.staged.anchorId;
      } else if (userMessageId === null) {
        userMessageId = makeId('user');
        const userMessage: UserMessage = {
          kind: 'user',
          id: userMessageId,
          text: params.displayText ?? question,
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
          // App clearAudioPlayback() on every new send: stop and release the previous answer's clip.
          audioPlaybackUrl: null,
          isAudioPlaying: false,
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
        // `staged: null` so a retry of a capability-chip send does not append a SECOND location
        // bubble; `userMessageId` (the staged anchor) keeps it off the user-bubble path too, so
        // the retry just adds a fresh placeholder — Android's retry behaviour for this path.
        void sendTextQuery({
          ...params,
          staged: null,
          userMessageId,
          isRetry: true,
          sendQueryProperties: analyticsProps,
        });

      // App AnalyticsManager.trackSendQueryInitiated: the same property map Send_Query uses.
      sdk.analytics.track(
        AnalyticsEvents.SEND_QUERY_INITIATED,
        sendQueryAnalyticsProperties(analyticsProps),
      );
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
        // App parity: the selected language's flag (default true); the store is hydrated in memory.
        streaming_required: sdk.store.getBoolean(StorageKeys.STREAMING_REQUIRED, true),
        // App parity (ChatViewModel.kt:1416-1420): these are null -> omitted by Gson unless set,
        // so they are spread in only when set and an ordinary query's body is unchanged.
        ...(params.parentMessageId ? { parent_message_id: params.parentMessageId } : {}),
        ...(params.locationDeclined === true ? { location_declined: true } : {}),
        ...(params.photoDeclined === true ? { photo_declined: true } : {}),
      };
      const ctx = {
        userMessageId,
        triggeredInputType: params.triggeredInputType,
        sendQueryProperties: analyticsProps,
        question,
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
  // --- capability-chip outcome: location shared (2.0.0) ---------------------------

  /**
   * Sends the surface's ORIGINAL query after the farmer shared a real location, and puts the
   * resolved address in the thread as a {@link LocationMessage}.
   *
   * Port of the Android core's `ChatViewModel.sendLocationSharedQuery`. The location bubble
   * takes the place of the user text bubble a normal send would add — the farmer never typed
   * anything, they shared a location — and a blank address yields no bubble at all, matching
   * the app.
   *
   * App parity: `triggered_input_type` is `align_chip_sel` and `parent_message_id` is the
   * surface's server `message_id` (app ChatViewModel.kt:1069-1071), so the backend correlates
   * the answer with the prompt. Two deliberate deltas, mirroring the Android SDK (docs/04):
   *  - **no `agentic_chip_*` analytics properties.** This reports as an ordinary text query;
   *    `triggered_input_type` IS `align_chip_sel` (app parity).
   *  - **no endpoint #30 (`track_follow_up_click`).** The chip's text is not the question, so
   *    there is no follow-up click to attribute — Android's location path skips it too.
   */
  const sendLocationSharedQuery = useCallback(
    (sourceMessageId: string, address: string) => {
      const current = stateRef.current;
      if (current.isLoading) return;
      const source = current.messages.find(
        (m): m is AiResponse => m.kind === 'ai' && m.id === sourceMessageId,
      );
      // No original query means nothing to ask. Bail BEFORE mutating: sendTextQuery early-
      // returns on a blank question, which would leave the thread spinning behind an orphan
      // placeholder. (Defensive — the gps-prompt contract always carries original_query.)
      const query = source?.alignmentOriginalQuery?.trim() ?? '';
      if (query.length === 0) return;

      const resolved = address.trim();
      const placeholderId = makeId('ld');
      const bubbleId = makeId('loc');
      mutate((prev) => {
        // Mark share_precise_location as picked so the source chip locks/highlights exactly as
        // a plain chip tap would — the chip's text is never sent as the question, so the
        // ordinary `SelectAlignmentChip` bookkeeping never runs for it.
        const marked = prev.messages.map((m) =>
          m.kind === 'ai' &&
          m.id === sourceMessageId &&
          !(m.alignmentSelectedValues ?? []).includes(AlignmentChipWire.VALUE_SHARE_LOCATION)
            ? {
                ...m,
                alignmentSelectedValues: [
                  ...(m.alignmentSelectedValues ?? []),
                  AlignmentChipWire.VALUE_SHARE_LOCATION,
                ],
              }
            : m,
        );
        const additions: ChatMessage[] = [];
        // App parity: a blank address adds no bubble, only the loading placeholder.
        if (resolved.length > 0) {
          additions.push({ kind: 'location', id: bubbleId, address: resolved });
        }
        additions.push({ kind: 'loading', id: placeholderId });
        return {
          ...prev,
          messages: [...marked, ...additions],
          isLoading: true,
          errorMessage: null,
          failedMessageId: null,
          chatResponseState: UiStates.loading(),
          // App clearAudioPlayback() on every new send: stop and release the previous answer's clip.
          audioPlaybackUrl: null,
          isAudioPlaying: false,
          suggestedQuestions: null,
          suggestedQuestionIds: null,
          clarificationRequired: false,
        };
      });

      void sendTextQuery({
        question: query,
        triggeredInputType: ALIGN_CHIP_SEL,
        // App ChatViewModel.kt:1102-1117: reported as a chip selection (gps-prompt /
        // share_precise_location / the "Share my location" label).
        sendQueryProperties: {
          ...minimalSendQueryProps({ question: query, isImageQuery: false, isVoiceQuery: false }),
          isAlignmentChip: true,
          agenticChipType: alignmentAnalyticsType(AlignmentKinds.GPS_PROMPT),
          agenticChipValue: AlignmentChipWire.VALUE_SHARE_LOCATION,
          agenticChipLabel: sdk.labels.getLabel(Labels.SHARE_LOCATION, 'Share my location'),
          agenticChipStatus: ChipStatus.SELECTED,
        },
        parentMessageId: source?.messageId ?? null,
        staged: {
          placeholderId,
          anchorId: resolved.length > 0 ? bubbleId : sourceMessageId,
        },
      });
    },
    [mutate, sdk, sendTextQuery],
  );

  // --- image query (endpoint #28) ------------------------------------------------

  const sendImageQuery = useCallback(
    async (params: {
      question: string;
      imageUri: string;
      imageBase64: string;
      imageExif?: Record<string, unknown> | null;
      imageWidth?: number | null;
      imageHeight?: number | null;
      userMessageId?: string | null;
      sendQueryProperties?: SendQueryProperties | null;
      isRetry?: boolean;
    }) => {
      // Hoisted: on the agentic path it is also the stream id, so the loading bubble becomes the
      // answer in place (as sendTextQuery does).
      const placeholderId = makeId('ld');
      // App ChatViewModel.kt:310-322: an image send's props (manual chip context read before the
      // thread changes), unless the caller supplied its own (a photo-chip pick).
      const analyticsProps: SendQueryProps =
        params.sendQueryProperties ??
        minimalSendQueryProps({
          question: params.question,
          isImageQuery: true,
          isVoiceQuery: false,
          sizeOfImageKb: base64SizeKb(params.imageBase64),
          lastAi: lastAiMessage(stateRef.current.messages),
        });
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
            { kind: 'loading', id: placeholderId },
          ],
          isLoading: true,
          errorMessage: null,
          failedMessageId: null,
          suggestedQuestions: null,
          suggestedQuestionIds: null,
          chatResponseState: UiStates.loading(),
          // App clearAudioPlayback() on every new send: stop and release the previous answer's clip.
          audioPlaybackUrl: null,
          isAudioPlaying: false,
        }));
      } else {
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
        void sendImageQuery({
          ...params,
          userMessageId,
          isRetry: true,
          sendQueryProperties: analyticsProps,
        });

      sdk.analytics.track(
        AnalyticsEvents.SEND_QUERY_INITIATED,
        sendQueryAnalyticsProperties(analyticsProps),
      );
      // Semantic callback (C4) — image queries may have empty question text.
      sdk.analytics.fireCallback('onMessageSent', params.question);

      const conversationId = await ensureConversationId();
      if (!conversationId) {
        fail(sdk.labels.getLabel('chat_error_generic', 'Something went wrong. Please try again.'));
        return;
      }

      // App ChatViewModel.kt:1858-1862: the typed text, else the default crop question; and an
      // `image_<uuid>.jpg` name. The bubble keeps showing only what was typed.
      const queryForApi = imageQueryText(
        params.question,
        sdk.labels.getLabel(Labels.WHAT_IS_WRONG_WITH_MY_CROP, 'What is wrong with my crop?'),
      );
      const imageName = imageQueryName();
      const isRetry = params.isRetry === true;
      // App ImageUtils.kt:155-252: the photo's own GPS, else the current location (only with a
      // permission already granted), written into the JPEG as a GPS-only EXIF; the same point is
      // Plantix's latitude/longitude.
      const gps = gpsFromPickerExif(params.imageExif) ?? (await currentLocationIfPermitted());
      // App ImageUtils.kt:198-207: fit within 1000x1000 at JPEG 80 (optional peer
      // expo-image-manipulator; absent → the picker's JPEG 80 as-is), THEN the GPS EXIF.
      const shrunk = await shrinkForUpload({
        uri: params.imageUri,
        base64: params.imageBase64,
        width: params.imageWidth,
        height: params.imageHeight,
      });
      if (!mounted.current) return;
      const imageBase64 = writeGpsExif(shrunk.base64, gps);
      const lat = gps?.latitude ?? null;
      const lng = gps?.longitude ?? null;

      if (sdk.config.enableAgenticChat) {
        // App ChatViewModel.kt:1864-1881: with agentic chat on, an image query does NOT hit
        // Plantix (#28). The base64 image + image_name ride on the agentic text request (#27a)
        // and the answer streams like any text answer. Not ported: the app first writes the
        // device GPS into the photo's EXIF (ImageUtils.addGpsToImageAndConvertToBase64), which
        // needs a native module.
        const request: TextPromptRequest = {
          query: queryForApi,
          conversation_id: conversationId,
          message_id: '',
          weather_cta_triggered: false,
          triggered_input_type: 'image',
          use_entity_extraction: true,
          retry: isRetry,
          image: imageBase64,
          image_name: imageName,
          streaming_required: sdk.store.getBoolean(StorageKeys.STREAMING_REQUIRED, true),
        };
        await streamAgenticAnswer(request, placeholderId, {
          userMessageId: userMessageId as string,
          triggeredInputType: 'image',
          sendQueryProperties: analyticsProps,
          question: queryForApi,
        });
        return;
      }

      const result = await sdk.api.imageAnalysis({
        conversation_id: conversationId,
        image: imageBase64,
        // App parity (PlantixRequest.kt, ChatViewModel.kt:1884-1893): triggered_input_type
        // "image", latitude/longitude sent as STRINGs.
        triggered_input_type: 'image',
        query: queryForApi,
        latitude: lat != null ? String(lat) : null,
        longitude: lng != null ? String(lng) : null,
        image_name: imageName,
        retry: isRetry,
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
        // App ChatViewModel.kt:2121-2127: Plantix success → Send_Query, Valid_Query true.
        reportSendQuery({ sendQueryProperties: analyticsProps }, { isValid: true });
        // Semantic callback (C4).
        sdk.analytics.fireCallback('onAnswerReceived', serverMessageId ?? aiLocalId);
        if (serverMessageId) void fetchFollowUps(serverMessageId, aiLocalId);
      } else {
        const message = result.ok
          ? result.data.message ??
            sdk.labels.getLabel('chat_error_generic', 'Something went wrong. Please try again.')
          : result.message ??
            sdk.labels.getLabel('chat_error_generic', 'Something went wrong. Please try again.');
        // App ChatViewModel.kt:2149-2155: Plantix failure → Send_Query, Valid_Query false.
        reportSendQuery({ sendQueryProperties: analyticsProps }, { isValid: false });
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
    [ensureConversationId, fetchFollowUps, mutate, reportSendQuery, sdk, streamAgenticAnswer],
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
        // App clearAudioPlayback() on every new send: stop and release the previous answer's clip.
        audioPlaybackUrl: null,
        isAudioPlaying: false,
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
          // App buildMinimalSendQueryProps(voice): voice_query + audio_format.
          sendQueryProperties: minimalSendQueryProps({
            question: heard,
            isImageQuery: false,
            isVoiceQuery: true,
            audioFormat: params.audioFormat,
            lastAi: lastAiMessage(stateRef.current.messages),
          }),
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
      // App loadChatHistory -> clearAudioPlayback() (ChatViewModel.kt:1174).
      patch({ audioPlaybackUrl: null, isAudioPlaying: false });
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
        // App ChatViewModel.kt:664-670: the URL and `isAudioPlaying = url != null` land in ONE
        // update, so the Listen pill goes Loading -> Playing at once. Setting it only after the
        // player had prepared left ~2 s of plain "Listen" between the two.
        patch({
          isLoadingSynthesiseAudio: false,
          audioPlaybackUrl: result.data.audio,
          isAudioPlaying: true,
        });
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
            // App ChatViewModel.kt:213-233 (InitializeWithQuestion props): weather / SSFR flags.
            sendQueryProperties: {
              ...minimalSendQueryProps({
                question: action.question,
                isImageQuery: false,
                isVoiceQuery: Boolean(action.audioUri),
                lastAi: lastAiMessage(stateRef.current.messages),
              }),
              isWeatherAdviceCTA: action.isWeatherAdviceCTA === true,
              isSSFR: action.isSSFR === true,
            },
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
            // App SendQueryProperties.isReadFullAdvice → click_type "read_full_advice".
            sendQueryProperties: {
              ...minimalSendQueryProps({ question: action.question, isImageQuery: false, isVoiceQuery: false }),
              isReadFullAdvice: true,
            },
          });
          break;
        case 'SendFollowUpQuestion': {
          // App ChatViewModel.kt:958-964: endpoint #30 is called only for a tapped follow-up
          // chip, and its body is the follow-up question's ID (never the question text, never
          // for typed text).
          if (action.followUpQuestionId) {
            void sdk.api.trackFollowUpClick({ follow_up_question: action.followUpQuestionId });
          }
          // App ChatViewModel.kt:993-997: voice -> "voice"; follow-up prompt -> "follow_up";
          // otherwise (typed in the composer) -> "text".
          const triggeredInputType = action.transcriptionId
            ? 'voice'
            : action.isFollowupPrompt !== false
              ? 'follow_up'
              : 'text';
          void sendTextQuery({
            question: action.question,
            transcriptionId: action.transcriptionId,
            audioUri: action.audioUri,
            triggeredInputType,
            // App ChatScreen.kt:959-971 `handleFollowUp`: a follow-up chip is a follow-up prompt
            // (no chip context → status none). Typed / voice sends get the manual-send props.
            sendQueryProperties:
              action.sendQueryProperties ??
              (triggeredInputType === 'follow_up'
                ? {
                    screenName: ScreenNames.CHAT,
                    isFollowupPrompt: true,
                    isImageQuery: false,
                    isTextQuery: true,
                    isVoiceQuery: false,
                    lengthOfTextQuery: action.question.length,
                  }
                : null),
          });
          break;
        }
        case 'SelectAlignmentChip': {
          // App rule (alignmentChipSend): the LABEL is shown and sent, the VALUE only marks the
          // chip; gender-select sends the value under its label.
          const send = alignmentChipSend(action.kind, action.chip);
          if (!send) break;
          const picked = send.selectionValue;
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
          // No endpoint #30 here: the app's sendAlignmentChip (ChatViewModel.kt:1015-1052) never
          // calls trackFollowUpQuestionClick (only sendFollowUpQuestion does, :961-963, with a
          // follow-up ID). Sending the chip text as `follow_up_question` 500'd on DEMO and
          // surfaced a spurious onError(500) to the host.
          // App parity (ChatViewModel.kt:1019-1022, 1051; ChatScreen.kt:1648-1663):
          // triggered_input_type "align_chip_sel", parent_message_id = the surface's SERVER
          // message_id, and the decline flags for a GPS / photo surface's text chip.
          const surface = stateRef.current.messages.find(
            (m): m is AiResponse => m.kind === 'ai' && m.id === surfaceId,
          );
          const wire = alignmentChipRequestParams(action.kind, surface?.messageId);
          void sendTextQuery({
            question: send.query,
            displayText: send.displayText === send.query ? null : send.displayText,
            triggeredInputType: wire.triggeredInputType,
            parentMessageId: wire.parentMessageId,
            locationDeclined: wire.locationDeclined,
            photoDeclined: wire.photoDeclined,
            // App ChatViewModel.kt:286-302: a chip pick — click_type align_chip_sel, status
            // selected, and the surface kind / chip value / chip label.
            sendQueryProperties: {
              ...minimalSendQueryProps({ question: send.query, isImageQuery: false, isVoiceQuery: false }),
              isAlignmentChip: true,
              agenticChipType: alignmentAnalyticsType(action.kind),
              agenticChipValue: action.analyticsChipValue ?? action.chip.value ?? action.chip.label ?? null,
              agenticChipLabel: action.chip.label ?? action.chip.value ?? null,
              agenticChipStatus: ChipStatus.SELECTED,
            },
          });
          break;
        }
        case 'SendLocationSharedQuery':
          sendLocationSharedQuery(action.sourceMessageId, action.address);
          break;
        case 'SendQuestionWithImage':
          void sendImageQuery({
            question: action.question,
            imageUri: action.imageUri,
            imageBase64: action.imageBase64,
            imageExif: action.imageExif ?? null,
            imageWidth: action.imageWidth ?? null,
            imageHeight: action.imageHeight ?? null,
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
          // App ChatScreen.kt:1080-1097, 1316-1340: screen_name on both; a stop also reports the
          // seconds played (AnalyticsProps.NO_OF_SECONDS_PLAYED = "No_of_seconds_played").
          sdk.analytics.track(
            action.isPlaying
              ? AnalyticsEvents.STARTED_PLAYING_RESPONSE_AUDIO
              : AnalyticsEvents.STOPPED_PLAYING_RESPONSE_AUDIO,
            action.isPlaying
              ? { screen_name: ScreenNames.CHAT }
              : {
                  screen_name: ScreenNames.CHAT,
                  No_of_seconds_played: Math.max(0, Math.floor(action.secondsPlayed ?? 0)),
                },
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
      sendLocationSharedQuery,
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

/** The latest AI message — the surface a manual send may be skipping. */
function lastAiMessage(messages: ChatMessage[]): AiResponse | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m && m.kind === 'ai') return m;
  }
  return null;
}

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
      // App ChatViewModel.kt:1665 reads `follow_up_question_id`; the SDK used to read a
      // non-existent `id`, so #30 never had an id to send.
      ids.push(q.follow_up_question_id ?? '');
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

  // App ChatViewModel.kt:1255: render in message_input_time order (DEMO sends newest-first).
  sortHistoryItems(items).forEach((item, index) => {
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
          // App ChatViewModel.kt:1273: query_text first, heard_query_text only when it is null.
          text: historyVoiceText(item),
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
        // The API returns these as objects ({follow_up_question_id, sequence,
        // question}); like the app, keep only the display strings (see historyFollowUpQuestions).
        const questions = historyFollowUpQuestions(item.questions);
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
