/**
 * ChatViewModel port — chat/udf ChatAction / ChatState / ChatMessage
 * (docs/01 §3.8). Every action is implemented:
 * initialize (question / pre-generated / voice prototype / image), follow-ups
 * (endpoint #29 — TextPromptResponse.follow_up_questions is always null),
 * clarification, retry, TTS via HTMLAudioElement, voice-clip playback data,
 * history pagination.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { onSuspendMedia } from '../core/mediaSuspend';
import type { SdkServices } from '../core/services';
import { PrefKeys } from '../core/storage';
import type {
  AlignmentChip,
  ConversationChatHistoryMessageItem,
  TextPromptRequest,
  TextPromptResponse,
} from '../core/types';
import { UiState, idle, loading, success, failure } from './uiState';
import { blobToBase64, nextLocalId } from './helpers';
import { Events } from '../core/analytics';
import type { VoiceRecording } from './useVoiceRecorder';
import { sanitizeAgenticFinalText, sanitizeAgenticStreamText } from '../core/agentic';
import { isAbortError } from '../core/agenticStream';
import type { AgenticDoneEvent, StreamErrorKind } from '../core/agentic';
import {
  alignmentAnalyticsType,
  alignmentChipSend,
  alignmentKindFromType,
  CapabilityChip,
  isAdditiveAlignment,
  recordAlignmentPick,
} from '../core/alignment';
import type { AlignmentKind } from '../core/alignment';

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

  // ---- agentic streaming (SDK 2.0.0, endpoint #27a). All optional and all falsy by default,
  // so a synchronous #27 answer is indistinguishable from 1.0.0. ----
  /** True while the agentic stream is in progress; suppresses the action buttons. */
  isStreaming?: boolean;
  /** Transient tool progress label (e.g. "Checking weather forecast") shown while streaming. */
  streamingStatus?: string | null;
  /** True when this answer came from the agentic endpoint (also disables the typewriter reveal). */
  isAgentic?: boolean;
  /**
   * Terminal outcome of an agentic stream that did NOT complete normally. When true the answer
   * renders with an inline error card and a retry action; `text` may still hold a preserved
   * partial answer, or be empty if the stream broke at the start. Always false for a normally
   * finalized answer.
   */
  isInterrupted?: boolean;
  /** Why the stream ended early; only meaningful when `isInterrupted`. */
  streamErrorKind?: StreamErrorKind | null;

  // ---- alignment surfaces (2.0.0) ----
  /**
   * Non-null when this response is an alignment surface (clarify / confirm / escalate or a
   * capability prompt) rather than a normal answer. Drives chip rendering and the urgent
   * (escalate) treatment in place of the usual action row.
   */
  alignmentKind?: AlignmentKind | null;
  /** Quick-reply chips: label is shown, value is sent on tap. */
  alignmentChips?: AlignmentChip[] | null;
  /**
   * The surface's own prompt message. For an EXCLUSIVE surface the prompt already lives in `text`
   * (it replaced the answer), so this stays null. For an ADDITIVE surface it carries the nudge
   * rendered below the real answer.
   */
  alignmentMessage?: string | null;
  /**
   * Chip values already tapped on this surface. Present for parity with Android, where nothing
   * writes it either — a tap sends a follow-up, which supersedes the surface.
   */
  alignmentSelectedValues?: string[];
  /**
   * The query that triggered this surface. Kept so a capability chip (e.g. "Share my location")
   * can re-send the user's real question once the capability is satisfied.
   */
  alignmentOriginalQuery?: string | null;
}

export interface LoadingPlaceholder {
  kind: 'loading';
  id: string;
}

/**
 * The farmer's resolved location, shown in the thread in place of a text bubble once a GPS_PROMPT
 * alignment chip has been satisfied (2.0.0). Rendered by `LocationChatBubble`.
 *
 * Port of Kotlin `ChatMessage.LocationMessage(address, id)` (`core/ui/chat/ChatModels.kt:95`).
 *
 * Constructed by {@link ChatActions.sendLocationSharedQuery} — the ONLY producer, exactly as on
 * Android, where `ChatViewModel.sendLocationSharedQuery` is the only `LocationMessage(` in the
 * tree. A blank address yields no bubble at all (app parity), so the variant is real but not
 * guaranteed on every share-location success.
 */
export interface LocationMessage {
  kind: 'location';
  id: string;
  /** Human-readable address, e.g. `display_address` from the location response. */
  address: string;
}

export type ChatMessage = UserMessage | AiResponse | LoadingPlaceholder | LocationMessage;

export type ChatEntrySource = 'home' | 'history';

export interface SendQueryProperties {
  triggeredInputType?: string;
  isWeatherAdviceCTA?: boolean;
  isSSFR?: boolean;
  ssfrCrop?: string | null;
  statementId?: number | null;
  channel?: string | null;
  /**
   * 2.0.0: which alignment surface a tapped chip came from (`AlignmentKind.analyticsType`).
   * Reported as the `agentic_chip_type` property on the existing SEND_QUERY_INITIATED event.
   */
  agenticChipType?: string | null;
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
      /** Display-only Home card image for the question bubble (compose `contentCardImageUrl`). */
      contentCardImageUrl?: string | null;
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
    opts?: {
      followUpQuestionId?: string | number | null;
      transcriptionId?: string | null;
      audioUri?: string | null;
      /** 2.0.0: set when the question came from an alignment chip (see [selectAlignmentChip]). */
      agenticChipType?: string | null;
      /** User-bubble text when it differs from the sent [question] (gender-select chips). */
      displayText?: string | null;
    },
  ) => Promise<void>;
  /**
   * A tapped alignment chip (2.0.0). Records the pick on [messageId]'s own surface — so the chip
   * renders selected/locked and the unpicked chips fade back — then sends the chip's value as a
   * follow-up.
   *
   * A dedicated action rather than a branch inside [sendFollowUpQuestion], because that one is
   * ALSO the plain text composer's send path: recording there would mark a chip as chosen whenever
   * the farmer happened to type a string matching one.
   */
  selectAlignmentChip: (messageId: string, kind: AlignmentKind, chip: AlignmentChip) => Promise<void>;
  /**
   * The GPS_PROMPT "Share my location" chip succeeded (2.0.0): show [address] as a
   * `LocationMessage` bubble and re-send the surface's `alignmentOriginalQuery`.
   *
   * Port of Kotlin `ChatViewModel.sendLocationSharedQuery`. The location bubble takes the place of
   * the user text bubble an ordinary send would add — the farmer never typed anything, they shared
   * a location — and a blank [address] yields no bubble at all while the query is still re-sent,
   * matching the app.
   *
   * The capability flow itself belongs to the screen: `ChatScreen` runs the browser location flow
   * and calls this only on a `location_fetched` outcome. A declined / cancelled / failed outcome
   * sends the decline label through [sendFollowUpQuestion] instead.
   *
   * Two deliberate deltas from the app, both mirrored from Android and recorded in docs/04:
   *  - **no `parent_message_id`.** `TextPromptRequest` has no such field, so no alignment-chip
   *    send carries it — an SDK-wide gap, not specific to this path.
   *  - **no `agentic_chip_*` analytics properties.** This reports as an ordinary text query;
   *    `triggered_input_type` IS sent as `align_chip_sel` (app parity).
   */
  sendLocationSharedQuery: (sourceMessageId: string, address: string) => Promise<void>;
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

/**
 * Minimum on-screen time per tool status, so back-to-back tool events (latency 0) are not
 * collapsed by React's state batching into just the last one. Parity with Android's
 * `TOOL_STATUS_MIN_DWELL_MS`.
 */
const TOOL_STATUS_MIN_DWELL_MS = 700;

/**
 * `triggered_input_type` for a query re-sent after an alignment capability chip was satisfied.
 * Kotlin `ChatViewModel.ALIGN_CHIP_SEL` — the app's own string, sent verbatim.
 */
const ALIGN_CHIP_SEL = 'align_chip_sel';

const sleep = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

/**
 * Everything the shared answer path needs that is not on the wire response. Both the synchronous
 * #27 reply and the agentic `metadata` event settle through it, so analytics, TTS gating,
 * follow-ups (#29) and alignment handling exist once.
 */
interface AnswerContext {
  /** Loading placeholder (or live streaming bubble) to replace. */
  placeholderId: string;
  /** User bubble to flag on failure. */
  userMsgId: string;
  conversationId: string;
  triggeredInputType: string;
  /**
   * Local id for the settled AI bubble. The agentic path passes its stream id so the streaming
   * bubble becomes the final answer in place, with no remove/insert flicker.
   */
  aiMessageLocalId?: string;
  /** True when the answer arrived over the agentic stream (#27a). */
  isAgentic?: boolean;
}

export function useChat(services: SdkServices): [ChatState, ChatActions] {
  const [state, setState] = useState<ChatState>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const { api, session, store, labels, analytics } = services;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const lastRequestRef = useRef<(() => Promise<void>) | null>(null);
  const ttsSecondsStartedRef = useRef(0);
  /** In-flight agentic stream (#27a). Aborted on unmount, on retry and on clearMessages. */
  const streamAbortRef = useRef<AbortController | null>(null);

  const patch = useCallback((p: Partial<ChatState>) => setState((s) => ({ ...s, ...p })), []);

  // Release the TTS player when unmounting (ON_STOP / onDispose parity), and abort any live
  // agentic stream — leaving the chat must close the request, not keep reading it.
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
    };
  }, []);

  // docs/02 Step 3: the conversation belonged to the replaced guest; the next send creates one.
  useEffect(
    () =>
      session.onGuestReplaced(() => {
        conversationIdRef.current = null;
      }),
    [session],
  );

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
  // Shared answer settling (#27 reply AND #27a `metadata` — field-compatible payloads)
  // -------------------------------------------------------------------------

  /** Flags the user bubble, drops the placeholder and surfaces the inline error + retry. */
  const failAnswer = useCallback(
    (ctx: AnswerContext, message: string, code?: number, isNetwork = false) => {
      setState((s) => ({
        ...s,
        messages: s.messages
          .filter((m) => m.id !== ctx.placeholderId)
          .map((m) => (m.id === ctx.userMsgId && m.kind === 'user' ? { ...m, isFailed: true } : m)),
        isLoading: false,
        errorMessage: message,
        failedMessageId: ctx.userMsgId,
        chatResponseState: failure(message, code, isNetwork),
      }));
      analytics.error(code, message);
    },
    [analytics],
  );

  const markFirstQueryAsked = useCallback(() => {
    if (!store.getBool(PrefKeys.FIRST_QUERY_ASKED, false)) {
      store.setBool(PrefKeys.FIRST_QUERY_ASKED, true);
      analytics.track(Events.FIRST_QUERY_ASKED, {});
    }
  }, [analytics, store]);

  /**
   * Settles a successful text-prompt response. Shared by #27 and the agentic `metadata` event —
   * the streamed payload is field-compatible, so analytics, TTS gating, follow-ups and the
   * alignment surfaces are implemented once, not twice.
   */
  const applyTextPromptResponse = useCallback(
    (data: TextPromptResponse, ctx: AnswerContext) => {
      const alignmentKind = alignmentKindFromType(data.alignments?.type);
      const isExclusive = alignmentKind != null && !isAdditiveAlignment(alignmentKind);
      // An EXCLUSIVE alignment surface arrives with an empty `response` ON PURPOSE: its prompt IS
      // the message. Fall back to alignments.message so it is not mistaken for an empty answer
      // and turned into an error.
      const response = ctx.isAgentic ? sanitizeAgenticFinalText(data.response ?? '') : (data.response ?? '');
      const answerText =
        response.trim().length > 0
          ? response
          : isExclusive
            ? (data.alignments?.message ?? '')
            : '';

      if (data.error || answerText.trim().length === 0) {
        failAnswer(
          ctx,
          data.message ?? labels.getLabel('chat_generic_error', 'Something went wrong. Please try again.'),
        );
        return;
      }

      markFirstQueryAsked();
      const aiId = ctx.aiMessageLocalId ?? nextLocalId('ai');
      const aiMsg: AiResponse = {
        kind: 'ai',
        id: aiId,
        text: answerText,
        isPreGenerated: false,
        messageId: data.message_id ?? undefined,
        hideShareIcon: data.hide_share_icon ?? false,
        hideTtsSpeaker: data.hide_tts_speaker ?? false,
        hideFollowUpQuestion: data.hide_follow_up_question ?? false,
        actualContentProvider: data.actual_content_provider ?? null,
        clarificationRequired: data.intent_classification_output?.clarification_needed ?? false,
        isAgentic: ctx.isAgentic ?? false,
        // 2.0.0: an alignment surface asks the user to clarify/confirm instead of (or alongside)
        // answering. Exclusive surfaces replace the answer, additive ones sit below it.
        alignmentKind,
        alignmentChips: data.alignments?.chips ?? null,
        alignmentMessage: alignmentKind != null && isAdditiveAlignment(alignmentKind) ? (data.alignments?.message ?? null) : null,
        alignmentSelectedValues: [],
        alignmentOriginalQuery: data.alignments?.original_query ?? null,
      };
      setState((s) => ({
        ...s,
        messages: s.messages.filter((m) => m.id !== ctx.placeholderId && m.id !== aiId).concat(aiMsg),
        isLoading: false,
        errorMessage: null,
        failedMessageId: null,
        chatResponseState: success(answerText),
        clarificationRequired: data.intent_classification_output?.clarification_needed ?? false,
      }));

      analytics.track(Events.SEND_QUERY, {
        triggered_input_type: ctx.triggeredInputType,
        conversation_id: ctx.conversationId,
        message_id: data.message_id ?? '',
      });
      analytics.answerReceived(data.message_id ?? '');

      // Real follow-ups always come from endpoint #29.
      if (data.message_id && !(data.hide_follow_up_question ?? false)) {
        void fetchFollowUps(data.message_id, aiId);
      }
    },
    [analytics, failAnswer, fetchFollowUps, labels, markFirstQueryAsked],
  );

  // -------------------------------------------------------------------------
  // Agentic streaming (#27a, SDK 2.0.0 — gated on config.enableAgenticChat)
  // -------------------------------------------------------------------------

  /** Replaces the loading placeholder / prior streaming bubble with the in-progress answer. */
  const updateStreamingResponse = useCallback((streamId: string, text: string, status: string | null) => {
    setState((s) => {
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
      const idx = s.messages.findIndex((m) => m.id === streamId);
      let messages: ChatMessage[];
      if (idx >= 0) {
        messages = s.messages.slice();
        messages[idx] = streaming;
      } else {
        const last = s.messages[s.messages.length - 1];
        const base = last && last.kind === 'loading' ? s.messages.slice(0, -1) : s.messages;
        messages = base.concat(streaming);
      }
      return { ...s, messages, isLoading: true, errorMessage: null, failedMessageId: null };
    });
  }, []);

  /** Settles a streamed answer that finished without a `metadata` event. */
  const finalizeAgenticAnswer = useCallback(
    (streamId: string, text: string, followUps: string[] | undefined) => {
      markFirstQueryAsked();
      setState((s) => {
        const settled: AiResponse = {
          kind: 'ai',
          id: streamId,
          text,
          followUpQuestions: followUps,
          isPreGenerated: false,
          isAgentic: true,
        };
        const idx = s.messages.findIndex((m) => m.id === streamId);
        let messages: ChatMessage[];
        if (idx >= 0) {
          messages = s.messages.slice();
          messages[idx] = settled;
        } else {
          messages = s.messages.filter((m) => m.kind !== 'loading').concat(settled);
        }
        return {
          ...s,
          messages,
          isLoading: false,
          errorMessage: null,
          failedMessageId: null,
          chatResponseState: success(text),
          suggestedQuestions: followUps ?? null,
          suggestedQuestionIds: null,
        };
      });
    },
    [markFirstQueryAsked],
  );

  /** Settles a stream that ended early; `text` may hold a preserved partial answer. */
  const interruptAgentic = useCallback(
    (streamId: string, text: string, kind: StreamErrorKind) => {
      const message = labels.getLabel('chat_generic_error', 'Something went wrong. Please try again.');
      setState((s) => {
        const settled: AiResponse = {
          kind: 'ai',
          id: streamId,
          text,
          isPreGenerated: false,
          isAgentic: true,
          isInterrupted: true,
          streamErrorKind: kind,
        };
        const idx = s.messages.findIndex((m) => m.id === streamId);
        let messages: ChatMessage[];
        if (idx >= 0) {
          messages = s.messages.slice();
          messages[idx] = settled;
        } else {
          messages = s.messages.filter((m) => m.kind !== 'loading').concat(settled);
        }
        return {
          ...s,
          messages,
          isLoading: false,
          // Deliberately NOT set: the interrupted bubble renders its own StreamErrorCard with
          // retry, and `errorMessage` would stack a second, duplicate error block below it.
          errorMessage: null,
          chatResponseState: failure(message, undefined, kind === 'NETWORK'),
        };
      });
      analytics.error(undefined, message);
    },
    [analytics, labels],
  );

  /**
   * Consumes the agentic stream. Faithful port of Android's `streamAgenticAnswer`.
   *
   * Accumulates `text_delta`s into the answer bubble for live typing, surfaces tool status labels
   * while tools run, and finalizes on `metadata` through {@link applyTextPromptResponse}. If the
   * stream ends without one, falls back to `done`, then to the accumulated text.
   */
  const streamAgenticAnswer = useCallback(
    async (request: TextPromptRequest, ctx: AnswerContext) => {
      // Reuse the placeholder's id as the stream id so the loading bubble becomes the answer
      // bubble in place, with no remove/insert flicker.
      const streamId = ctx.placeholderId;
      // A retry (or a fast second send) must not leave the previous stream writing into state.
      streamAbortRef.current?.abort();
      const controller = new AbortController();
      streamAbortRef.current = controller;

      let accumulated = '';
      let finalized = false;
      // Captured but NOT finalized on arrival: a `metadata` normally follows `done` and is richer
      // (message_id, follow-up ids), so it wins. `done` is only a fallback.
      let pendingDone: AgenticDoneEvent | null = null;

      // Single exit for every "no terminal metadata" outcome — clean EOF, a failure event, or a
      // thrown error. Runs at most once (guarded + latches `finalized`).
      const finalizeStreamOrFail = (errorKind?: StreamErrorKind) => {
        // An aborted stream settles NOTHING: the reader ends the iteration silently on abort (it
        // does not throw), so without this guard a clean-EOF finalize would run and a superseded
        // stream could write a stale answer — or an error card — over the live one. This is the
        // web equivalent of Android rethrowing CancellationException.
        if (finalized || controller.signal.aborted) return;
        finalized = true;
        const fallbackText = sanitizeAgenticStreamText(accumulated);
        const doneAnswer = sanitizeAgenticFinalText(pendingDone?.answer ?? '').trim();
        if (pendingDone && (doneAnswer.length > 0 || fallbackText.length > 0)) {
          // A `done` means the model actually finished → a complete answer, not an interruption,
          // even if the transport dropped right after.
          finalizeAgenticAnswer(
            streamId,
            doneAnswer.length > 0 ? doneAnswer : fallbackText,
            pendingDone.followUps.length > 0 ? pendingDone.followUps : undefined,
          );
        } else if (errorKind && fallbackText.length > 0) {
          // Genuine error after some text arrived: keep the partial and mark it interrupted so
          // the UI can offer retry.
          interruptAgentic(streamId, fallbackText, errorKind);
        } else if (fallbackText.length > 0) {
          // Clean EOF with partial text and no terminal event: some backends stream deltas
          // without a done/metadata. Treat it as the complete answer — flagging it interrupted
          // would make every normal answer on such a backend look broken.
          finalizeAgenticAnswer(streamId, fallbackText, undefined);
        } else {
          // Nothing usable arrived.
          interruptAgentic(streamId, '', errorKind ?? 'UNKNOWN');
        }
      };

      try {
        for await (const event of api.streamAnswerForTextQueryAgentic(request, controller.signal)) {
          if (event.type === 'tool_call' || event.type === 'tool_result') {
            if ((event.statusText ?? '').trim().length > 0) {
              updateStreamingResponse(streamId, sanitizeAgenticStreamText(accumulated), event.statusText);
              await sleep(TOOL_STATUS_MIN_DWELL_MS);
            }
          } else if (event.type === 'text_delta') {
            accumulated += event.delta;
            // Text is flowing; clear any transient tool status.
            updateStreamingResponse(streamId, sanitizeAgenticStreamText(accumulated), null);
          } else if (event.type === 'metadata') {
            finalized = true;
            // `metadata` carries a TextPromptResponse — the same shape #27 returns — so finalize
            // through the shared path and inherit its analytics, TTS gating and follow-ups.
            applyTextPromptResponse(event.response, { ...ctx, aiMessageLocalId: streamId, isAgentic: true });
            return;
          } else if (event.type === 'done') {
            // Fallback terminal: remember it, let a following `metadata` win.
            pendingDone = event;
          } else {
            // Failure. Don't discard a completed `done`: if it arrived before the failure the
            // answer is still finalized from it.
            finalizeStreamOrFail(event.kind);
            return;
          }
        }
        // Clean EOF with no terminal metadata: no transport error was observed.
        finalizeStreamOrFail();
      } catch (err) {
        // Chat left / stream aborted: never write a stale error card (Android rethrows
        // CancellationException for exactly this reason).
        if (isAbortError(err, controller.signal)) return;
        finalizeStreamOrFail('NETWORK');
      } finally {
        if (streamAbortRef.current === controller) streamAbortRef.current = null;
      }
    },
    [api, applyTextPromptResponse, finalizeAgenticAnswer, interruptAgentic, updateStreamingResponse],
  );

  // -------------------------------------------------------------------------
  // Core text-query pipeline (#27, or #27a when enableAgenticChat)
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
        /**
         * Skip the user text bubble this normally appends. Set by
         * {@link ChatActions.sendLocationSharedQuery}, whose caller has already appended a
         * `LocationMessage` bubble in its place — Kotlin gets this for free because its
         * `fetchTextPromptResponse` never adds a bubble of its own.
         *
         * Carried through the retry closure below (it spreads `opts`), so a retry does not
         * suddenly grow the bubble the first attempt suppressed.
         */
        suppressUserMessage?: boolean;
        /**
         * Display-only image for the question bubble (compose `contentCardImageUrl`): a Home card's
         * picture shown as a 16:9 banner. Never sent — the query stays a text query.
         */
        contentCardImageUrl?: string | null;
        /** User-bubble text when it differs from the sent [question] (gender-select chips). */
        displayText?: string | null;
      },
    ) => {
      const userMsgId = opts.reuseUserMessageId ?? nextLocalId('user');
      const placeholderId = nextLocalId('loading');
      const props = opts.properties ?? {};

      setState((s) => {
        let messages = s.messages;
        if (opts.suppressUserMessage) {
          // No bubble to add, and none to un-fail on retry. `failAnswer(ctx.userMsgId)` then
          // matches no message and degrades to a no-op — the inline error card is the retry
          // affordance, as it is on Android where this path has no user bubble either.
        } else if (opts.reuseUserMessageId) {
          messages = messages.map((m) => (m.id === userMsgId && m.kind === 'user' ? { ...m, isFailed: false } : m));
        } else {
          const userMsg: UserMessage = {
            kind: 'user',
            id: userMsgId,
            text: opts.displayText ?? question,
            audioUri: opts.audioUri ?? undefined,
            imageUri: opts.contentCardImageUrl ?? undefined,
            userBubbleImageWideBanner: !!opts.contentCardImageUrl,
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
        triggered_input_type: props.triggeredInputType ?? 'text',
        // Only present for an alignment-chip tap, so ordinary sends keep their v1 payload.
        ...(props.agenticChipType ? { agentic_chip_type: props.agenticChipType } : {}),
      });
      analytics.messageSent(question);

      const conversationId = await ensureConversationId();
      const request: TextPromptRequest = {
        query: question,
        conversation_id: conversationId,
        // App parity: TextPromptRequest.message_id is sent empty ("") — the
        // response message_id is authoritative for follow-ups/TTS.
        message_id: '',
        statement_id: props.statementId ?? null,
        weather_cta_triggered: props.isWeatherAdviceCTA ?? false,
        triggered_input_type: props.triggeredInputType ?? 'text',
        ssfr_crop: props.isSSFR ? (props.ssfrCrop ?? null) : null,
        use_entity_extraction: true,
        transcription_id: opts.transcriptionId ?? null,
        retry: opts.retry ?? false,
      };

      lastRequestRef.current = () =>
        runTextQuery(question, { ...opts, retry: true, reuseUserMessageId: userMsgId });

      const ctx: AnswerContext = {
        placeholderId,
        userMsgId,
        conversationId,
        triggeredInputType: request.triggered_input_type,
      };

      if (services.config.enableAgenticChat) {
        // 2.0.0 opt-in: streams #27a instead of one synchronous #27 reply.
        await streamAgenticAnswer(request, ctx);
        return;
      }

      const res = await api.getAnswerForTextQuery(request);
      if (!res.ok) {
        failAnswer(ctx, res.message, res.code, res.isNetworkError || res.isTimeout);
        return;
      }
      applyTextPromptResponse(res.data, ctx);
    },
    [analytics, api, applyTextPromptResponse, ensureConversationId, failAnswer, services.config, streamAgenticAnswer],
  );

  // -------------------------------------------------------------------------
  // Initialization actions
  // -------------------------------------------------------------------------

  const initializeWithQuestion = useCallback<ChatActions['initializeWithQuestion']>(
    async (question, opts = {}) => {
      await runTextQuery(question, {
        transcriptionId: opts.transcriptionId ?? null,
        audioUri: opts.audioUri ?? null,
        contentCardImageUrl: opts.contentCardImageUrl ?? null,
        properties: {
          triggeredInputType: opts.triggeredInputType ?? (opts.audioUri ? 'voice' : 'text'),
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
        triggered_input_type: 'voice',
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
          properties: { triggeredInputType: 'voice' },
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
        displayText: opts.displayText ?? null,
        properties: {
          triggeredInputType: opts.audioUri ? 'mic' : 'card',
          agenticChipType: opts.agenticChipType ?? null,
        },
      });
    },
    [analytics, api, runTextQuery],
  );

  const selectAlignmentChip = useCallback<ChatActions['selectAlignmentChip']>(
    async (messageId, kind, chip) => {
      // App rule (alignmentChipSend): the LABEL is shown and sent, the VALUE only marks the chip;
      // gender-select sends the value under its label. The selection is stored verbatim (never
      // trimmed) so it still matches the untrimmed comparison `AlignmentSurface` makes.
      const send = alignmentChipSend(kind, chip);
      if (!send) return;
      setState((s) => {
        const messages = recordAlignmentPick(s.messages, messageId, send.selectionValue);
        return messages === s.messages ? s : { ...s, messages: messages as ChatMessage[] };
      });
      await sendFollowUpQuestion(send.query, {
        // Segments the funnel by which alignment surface was tapped. Existing event, existing
        // property name (`AlignmentKind.analyticsType` on Android) — no new event is introduced.
        agenticChipType: alignmentAnalyticsType(kind),
        displayText: send.displayText === send.query ? null : send.displayText,
      });
    },
    [sendFollowUpQuestion],
  );

  const sendLocationSharedQuery = useCallback<ChatActions['sendLocationSharedQuery']>(
    async (sourceMessageId, address) => {
      if (stateRef.current.isLoading) return;
      const source = stateRef.current.messages.find(
        (m): m is AiResponse => m.kind === 'ai' && m.id === sourceMessageId,
      );
      // No original query means nothing to ask — bail BEFORE mutating state (defensive; the
      // gps-prompt contract always carries original_query).
      const query = source?.alignmentOriginalQuery ?? '';
      if (query.trim().length === 0) return;

      setState((s) => {
        // Mark share_precise_location as picked so the source chip locks/highlights exactly as a
        // plain chip tap would. `selectAlignmentChip` cannot do it — the chip's text is never sent
        // as the question, so there is nothing for it to match on.
        const marked = recordAlignmentPick(
          s.messages,
          sourceMessageId,
          CapabilityChip.VALUE_SHARE_LOCATION,
        ) as ChatMessage[];
        // A blank address yields no bubble at all (app parity); the query is still re-sent.
        const additions: ChatMessage[] =
          address.trim().length > 0
            ? [{ kind: 'location', id: nextLocalId('location'), address } as LocationMessage]
            : [];
        return {
          ...s,
          messages: [...marked, ...additions],
          errorMessage: null,
          failedMessageId: null,
          suggestedQuestions: null,
          suggestedQuestionIds: null,
        };
      });

      // `runTextQuery` adds the loading placeholder after the bubble above, sets isLoading and
      // owns SEND_QUERY_INITIATED — deliberately with NO agenticChipType, so this reports as an
      // ordinary text query (Android delta, docs/04).
      await runTextQuery(query, {
        properties: { triggeredInputType: ALIGN_CHIP_SEL },
        suppressUserMessage: true,
      });
    },
    [runTextQuery],
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
        // App parity (PlantixRequest.kt): triggered_input_type "image",
        // latitude/longitude as STRINGs (the store already holds strings).
        triggered_input_type: 'image',
        query: question || null,
        latitude: lat ?? null,
        longitude: lng ?? null,
        image_name: `fc_web_${Date.now()}.jpg`,
        retry: false,
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
        // App parity: the read-full-advice query's triggered_input_type is
        // "read_full_advice" (was "card"). (statement_id + append-not-replace
        // remain — tracked in docs/04.)
        properties: { triggeredInputType: 'read_full_advice' },
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
      const { messages, trailingQuestions, clarification } = mapHistoryItems(items, page);
      setState((s) => ({
        ...s,
        // Older pages are prepended above the existing thread.
        // Hard guard: duplicate ids break React list identity (and hard-crash the equivalent
        // Compose LazyColumn), so never trust the wire to be unique.
        messages: dedupeById(page === 1 ? messages : [...messages, ...s.messages]),
        suggestedQuestions: page === 1 ? trailingQuestions : s.suggestedQuestions,
        clarificationRequired: page === 1 ? clarification : s.clarificationRequired,
        // The #32 response carries no pagination metadata (only
        // {conversation_id, data}); the app pages by "did this page return any
        // items" — page+1 until an empty page comes back. Base this on the RAW
        // items, not the mapped bubbles (a page can be all type-7/unknown).
        historyNextPage: items.length > 0 ? page + 1 : null,
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

  // Hidden SDK (widget closed): stop reading the answer aloud.
  useEffect(() => onSuspendMedia(() => audioRef.current?.pause()), []);

  const clearError = useCallback(() => {
    patch({ errorMessage: null, failedMessageId: null });
  }, [patch]);

  const clearMessages = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    // A live agentic stream would keep writing into a thread the user has left.
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
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
      selectAlignmentChip,
      sendLocationSharedQuery,
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

/** Keeps the first occurrence of each message id — a duplicate key breaks list identity. */
function dedupeById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
}

// A query and its response SHARE one `message_id` (verified live 2026-09-01: a single turn returns
// type 1, 3 and 7 all carrying the same id). Using it as the React key collides two rows — app
// parity (fc-compose ChatViewModel.kt:1027) keys on message_id + message_type_id + page + index.
// `messageId` keeps the raw API id for TTS/follow-ups.
function mapHistoryItems(items: ConversationChatHistoryMessageItem[], page = 1): {
  messages: ChatMessage[];
  trailingQuestions: string[] | null;
  clarification: boolean;
} {
  const messages: ChatMessage[] = [];
  let trailingQuestions: string[] | null = null;
  let clarification = false;

  for (const [index, item] of items.entries()) {
    const typeId = item.message_type_id ?? typeIdFromName(item.message_type);
    const uiId = `${item.message_id ?? nextLocalId('hist')}_${typeId ?? 'x'}_${page}_${index}`;
    switch (typeId) {
      case 1:
        messages.push({
          kind: 'user',
          id: uiId,
          text: item.query_text ?? '',
          isFailed: false,
        });
        trailingQuestions = null;
        break;
      case 2:
        messages.push({
          kind: 'user',
          id: uiId,
          text: item.heard_query_text ?? item.query_text ?? '',
          audioUri: item.query_media_file_url ?? undefined,
          isFailed: false,
        });
        trailingQuestions = null;
        break;
      case 11:
        messages.push({
          kind: 'user',
          id: uiId,
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
          id: uiId,
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
        // The app sends type-7 questions as objects
        // `{ follow_up_question_id, sequence, question }`; tolerate a plain
        // string form too. Typing them as `string[]` previously discarded
        // every historical follow-up chip against the real backend.
        const qs = (item.questions ?? [])
          .map((q) => (typeof q === 'string' ? q : (q?.question ?? '')))
          .filter((q): q is string => q.length > 0);
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
