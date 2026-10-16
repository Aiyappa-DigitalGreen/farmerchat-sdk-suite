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
  TextPromptRequest,
  TextPromptResponse,
} from '../core/types';
import { UiState, idle, loading, success, failure } from './uiState';
import { nextLocalId } from './helpers';
import {
  ChipStatus,
  manualSendChipContext,
  toAnalyticsProperties,
  withResponseChipStatus,
  withValidResponse,
  type IntentOutputLike,
  type SendQueryProps,
} from '../core/sendQueryAnalytics';
import { kotlinDoubleString, prepareImageForUpload } from '../core/imageUpload';
import { dedupeById, mapHistoryItems } from './historyMapping';
import { followUpTriggeredType, initialQueryTriggeredType } from '../core/triggeredInputType';
import { Events, Screens } from '../core/analytics';
import type { VoiceRecording } from './useVoiceRecorder';
import { sanitizeAgenticFinalText, sanitizeAgenticStreamText } from '../core/agentic';
import { isAbortError } from '../core/agenticStream';
import type { AgenticDoneEvent, StreamErrorKind } from '../core/agentic';
import {
  ALIGN_CHIP_SEL,
  alignmentAnalyticsType,
  alignmentChipSend,
  alignmentKindFromType,
  alignmentRequestFields,
  CapabilityChip,
  isAdditiveAlignment,
  recordAlignmentPick,
} from '../core/alignment';
import type { AlignmentKind, AlignmentRequestFields } from '../core/alignment';

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export interface UserMessage {
  kind: 'user';
  id: string;
  text: string;
  imageUri?: string;
  audioUri?: string;
  /**
   * Length of [audioUri] when known at record time. A MediaRecorder webm blob reports
   * `duration = Infinity` until it is scanned, so the clip would read 0:00 (the app reads the
   * file's real duration, ChatScreen.kt:1390-1401).
   */
  audioDurationMs?: number;
  /** True while this voice clip is being transcribed ("One second..." + loading clip). */
  isTranscribing?: boolean;
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
      /** Home card kind ("image_card" / "text_card"); see initialQueryTriggeredType. */
      contentCardTriggerType?: string | null;
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
      /**
       * True for a tapped suggested follow-up chip (app `SendQueryProperties.isFollowupPrompt`,
       * ChatScreen.kt:959-971): sent as `triggered_input_type: "follow_up"`. False/absent for a
       * typed composer send ("text"). A transcribed voice send is "voice" either way.
       */
      isFollowupPrompt?: boolean;
      transcriptionId?: string | null;
      audioUri?: string | null;
      /** User-bubble text when it differs from the sent [question] (gender-select chips). */
      displayText?: string | null;
    },
  ) => Promise<void>;
  /**
   * A tapped alignment chip (2.0.0). Records the pick on [messageId]'s own surface — so the chip
   * renders selected/locked and the unpicked chips fade back — then sends the chip as the next
   * query, tagged `triggered_input_type: "align_chip_sel"` with the surface's server id as
   * `parent_message_id` (+ `location_declined` / `photo_declined` for a GPS / photo decline),
   * exactly as the app's `sendAlignmentChip` (ChatViewModel.kt:1015-1052).
   *
   * A dedicated action rather than a branch inside [sendFollowUpQuestion], because that one is
   * ALSO the plain text composer's send path: recording there would mark a chip as chosen whenever
   * the farmer happened to type a string matching one.
   */
  selectAlignmentChip: (
    messageId: string,
    kind: AlignmentKind,
    chip: AlignmentChip,
    /** `agentic_chip_value` when it is not the chip's own value (the decline paths send "not_now"). */
    analyticsChipValue?: string,
  ) => Promise<void>;
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
   * App parity on the wire: `triggered_input_type` is `align_chip_sel` and `parent_message_id`
   * is the surface's server `message_id` (ChatViewModel.kt:1071, :1118). One deliberate delta,
   * mirrored from Android: **no `agentic_chip_*` analytics properties** — this reports as an
   * ordinary text query.
   */
  sendLocationSharedQuery: (sourceMessageId: string, address: string) => Promise<void>;
  sendQuestionWithImage: (
    question: string,
    imageBlob: Blob,
    imageObjectUrl: string,
    /** Set when the photo came from an UPLOAD_PHOTO chip: reported as that chip's pick. */
    fromChip?: { value: string; label: string },
  ) => Promise<void>;
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

const sleep = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

/**
 * Everything the shared answer path needs that is not on the wire response. Both the synchronous
 * #27 reply and the agentic `metadata` event settle through it, so analytics, TTS gating,
 * follow-ups (#29) and alignment handling exist once.
 */
interface AnswerContext {
  /** The query sent — its length is Send_Query's `length_of_Text_query` (app base.copy). */
  question: string;
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

  // ---- Send_Query_Initiated / Send_Query (app pendingSendQueryProperties, ChatViewModel.kt) ----
  /** Props of the query in flight; Send_Query fires once, when its answer settles, then clears. */
  const pendingSendQueryRef = useRef<SendQueryProps | null>(null);
  const startSendQuery = useCallback(
    (p: SendQueryProps) => {
      pendingSendQueryRef.current = p;
      analytics.track(Events.SEND_QUERY_INITIATED, toAnalyticsProperties(p));
    },
    [analytics],
  );
  /**
   * Send_Query on the response: success → `Valid_Query: true` + the intent fields and, when the
   * answer shows chips, `available` (ChatViewModel.kt:1706-1721, 2028-2042); a `done`-only or
   * partial answer → true without intent (:1769); failure → false (:1811, :2071, :2153).
   */
  const finishSendQuery = useCallback(
    (valid: boolean, o: { question?: string; intent?: IntentOutputLike | null; shownChipType?: string | null } = {}) => {
      const base = pendingSendQueryRef.current;
      if (!base) return;
      pendingSendQueryRef.current = null;
      const lengthPatch = o.question !== undefined ? { lengthOfTextQuery: o.question.length } : {};
      const props =
        valid && o.intent !== undefined
          ? withResponseChipStatus(withValidResponse(base, o.intent, o.question?.length), o.shownChipType)
          : { ...base, ...lengthPatch, isValidQuery: valid };
      analytics.track(Events.SEND_QUERY, toAnalyticsProperties(props));
    },
    [analytics],
  );
  /**
   * `buildMinimalSendQueryProps` (ChatViewModel.kt:115-135) for a send the farmer made by hand:
   * `manualSendChipContext` over the CURRENT thread (call before the new bubble is added).
   */
  const minimalSendQuery = useCallback(
    (question: string, kind: { image?: boolean; voice?: boolean; sizeKb?: number; audioFormat?: string } = {}): SendQueryProps => {
      const lastAi = [...stateRef.current.messages].reverse().find((m): m is AiResponse => m.kind === 'ai');
      const chip = manualSendChipContext(
        lastAi
          ? {
              analyticsType: lastAi.alignmentKind ? alignmentAnalyticsType(lastAi.alignmentKind) : null,
              chipCount: lastAi.alignmentChips?.length ?? 0,
              selectedCount: lastAi.alignmentSelectedValues?.length ?? 0,
            }
          : null,
      );
      return {
        screenName: Screens.CHAT,
        isFollowupPrompt: false,
        isImageQuery: !!kind.image,
        isTextQuery: !kind.image && !kind.voice,
        isVoiceQuery: !!kind.voice,
        lengthOfTextQuery: question.length,
        sizeOfImageKb: kind.sizeKb ?? 0,
        audioFormat: kind.voice ? (kind.audioFormat ?? '') : '',
        agenticChipStatus: chip.status,
        agenticChipSkippedType: chip.skippedType,
      };
    },
    [],
  );

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

  /** App `getDefaultImageQuery` (ChatViewModel.kt:65, :78-79). */
  const defaultImageQuery = useCallback(
    () => labels.getLabel('fc_v2_app_label_what_is_wrong_with_my_crop', 'What is wrong with my crop?'),
    [labels],
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
      // Server order, ids kept index-aligned with the questions: #30 reports the tapped
      // follow_up_question_id (the field is follow_up_question_id; `id` was never sent).
      const raw = [...(res.data.questions ?? [])].sort((a, b) =>
        (typeof a === 'object' && a ? a.sequence ?? 0 : 0) - (typeof b === 'object' && b ? b.sequence ?? 0 : 0),
      );
      const questions: string[] = [];
      const ids: Array<string | number> = [];
      for (const q of raw) {
        if (typeof q === 'string') {
          if (q) { questions.push(q); ids.push(''); }
        } else if (q && typeof q === 'object' && q.question) {
          questions.push(q.question);
          ids.push(q.follow_up_question_id ?? q.id ?? '');
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
      finishSendQuery(false, { question: ctx.question });
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
    [analytics, finishSendQuery],
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
        // App: clarification comes from #29 only (ChatViewModel.kt:1924); the answer itself
        // resets it (agentic :1700). `intent_classification_output.clarification_needed` is an
        // object {asset, concern, additional_context}, not a flag.
        clarificationRequired: false,
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
        clarificationRequired: false,
      }));

      finishSendQuery(true, {
        question: ctx.question,
        intent: (data.intent_classification_output ?? null) as IntentOutputLike | null,
        shownChipType: alignmentKind != null && (data.alignments?.chips?.length ?? 0) > 0 ? alignmentAnalyticsType(alignmentKind) : null,
      });
      analytics.answerReceived(data.message_id ?? '');

      // Real follow-ups always come from endpoint #29.
      if (data.message_id && !(data.hide_follow_up_question ?? false)) {
        void fetchFollowUps(data.message_id, aiId);
      }
    },
    [analytics, failAnswer, fetchFollowUps, finishSendQuery, labels, markFirstQueryAsked],
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
          finishSendQuery(true, { question: ctx.question });
          finalizeAgenticAnswer(
            streamId,
            doneAnswer.length > 0 ? doneAnswer : fallbackText,
            pendingDone.followUps.length > 0 ? pendingDone.followUps : undefined,
          );
        } else if (errorKind && fallbackText.length > 0) {
          // Genuine error after some text arrived: keep the partial and mark it interrupted so
          // the UI can offer retry.
          // Partial content was delivered: a (partial) valid response (ChatViewModel.kt:1767-1770).
          finishSendQuery(true, { question: ctx.question });
          interruptAgentic(streamId, fallbackText, errorKind);
        } else if (fallbackText.length > 0) {
          // Clean EOF with partial text and no terminal event: some backends stream deltas
          // without a done/metadata. Treat it as the complete answer — flagging it interrupted
          // would make every normal answer on such a backend look broken.
          finishSendQuery(true, { question: ctx.question });
          finalizeAgenticAnswer(streamId, fallbackText, undefined);
        } else {
          // Nothing usable arrived.
          finishSendQuery(false, { question: ctx.question });
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
    [api, applyTextPromptResponse, finalizeAgenticAnswer, finishSendQuery, interruptAgentic, updateStreamingResponse],
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
        /**
         * Alignment-send request fields (`parent_message_id`, `location_declined`,
         * `photo_declined`). See `alignmentRequestFields`. First attempt only: the app's
         * `retryLastRequest` replays the query and its `triggered_input_type` but none of these
         * (ChatViewModel.kt:2197), so the retry closure below drops them too.
         */
        alignment?: AlignmentRequestFields;
        /**
         * A photo question on the agentic path (app ChatViewModel.kt:1866-1882): sent as
         * `image` + `image_name` on #27a. Kept on retry, as the app's IMAGE retry re-sends it.
         */
        image?: { base64: string; imageName: string };
        /**
         * Send_Query_Initiated props for this send (built by the caller, as the app builds
         * `pendingSendQueryProperties`). Absent → `buildMinimalSendQueryProps` over the current
         * thread. `'pending'` → already fired by the caller (voice: fired when recording was sent).
         * A retry fires neither event (the app's retryLastRequest sets no props).
         */
        sendQuery?: SendQueryProps | 'pending';
      },
    ) => {
      if (opts.retry) pendingSendQueryRef.current = null;
      else if (opts.sendQuery !== 'pending') startSendQuery(opts.sendQuery ?? minimalSendQuery(question));
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
        // App ChatViewModel: the selected language's flag, default true when unset. Stage only
        // streams (status + text_delta) when it is true.
        streaming_required: store.getBool(PrefKeys.STREAMING_REQUIRED, true),
        // Spread, never null-filled: absent keys stay off the wire, as Gson omits nulls.
        ...(opts.alignment ?? {}),
        ...(opts.image ? { image: opts.image.base64, image_name: opts.image.imageName } : {}),
      };

      lastRequestRef.current = () =>
        runTextQuery(question, { ...opts, retry: true, reuseUserMessageId: userMsgId, alignment: undefined });

      const ctx: AnswerContext = {
        question,
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
    [analytics, api, applyTextPromptResponse, ensureConversationId, failAnswer, minimalSendQuery, services.config, startSendQuery, streamAgenticAnswer],
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
        // InitializeWithQuestion props (ChatViewModel.kt:214-232); no chip status → "none".
        sendQuery: {
          screenName: Screens.CHAT,
          isFollowupPrompt: false,
          isImageQuery: false,
          isTextQuery: !opts.audioUri,
          isVoiceQuery: !!opts.audioUri,
          lengthOfTextQuery: question.length,
          isWeatherAdviceCTA: opts.isWeatherAdviceCTA ?? false,
          isSSFR: opts.isSSFR ?? false,
          channel: opts.channel ?? null,
          isImageCard: opts.contentCardTriggerType === 'image_card',
          isTextCard: opts.contentCardTriggerType === 'text_card',
        },
        properties: {
          // An explicit type wins; otherwise the app's InitializeWithQuestion rule
          // (ChatViewModel.kt:235-243 → :1391-1395).
          triggeredInputType: opts.triggeredInputType ?? initialQueryTriggeredType(opts),
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
      // App sendFollowUpVoiceQuestion / initializeVoicePrototype (ChatViewModel.kt:370-400,
      // 508-640): the clip shows at once as a user bubble reading `Labels.ONE_SECOND_PLEASE`
      // ("One second...") with its voice clip in the loading state, above an empty placeholder
      // (no spinner while transcribing, ChatThreadContent.kt:618-633). The bubble text then
      // becomes the transcription (success) or the heard text / "Something went wrong" (failure).
      // Send_Query_Initiated fires when the clip is sent, before transcription (app
      // buildMinimalSendQueryProps(isVoiceQuery = true), ChatViewModel.kt:375-382, 534-541);
      // Send_Query then fires on the ANSWER to the transcribed question.
      startSendQuery(minimalSendQuery('', { voice: true, audioFormat: recording.format }));
      const userMsgId = nextLocalId('voice');
      const placeholderId = nextLocalId('loading');
      const oneSecond = labels.getLabel('fc_v2_app_label_one_second_please', 'One second...');
      setState((s) => ({
        ...s,
        messages: [
          ...s.messages,
          {
            kind: 'user',
            id: userMsgId,
            text: oneSecond,
            audioUri: recording.objectUrl,
            audioDurationMs: recording.durationMs > 0 ? recording.durationMs : undefined,
            isTranscribing: true,
            isFailed: false,
          } as UserMessage,
          { kind: 'loading', id: placeholderId } as LoadingPlaceholder,
        ],
        isLoading: true,
        errorMessage: null,
        failedMessageId: null,
        suggestedQuestions: null,
        suggestedQuestionIds: null,
        chatResponseState: loading(),
      }));
      const failVoice = (text: string, message: string) =>
        setState((s) => ({
          ...s,
          messages: s.messages
            .filter((m) => m.id !== placeholderId)
            .map((m) => (m.id === userMsgId && m.kind === 'user' ? { ...m, text, isTranscribing: false, isFailed: true } : m)),
          isLoading: false,
          errorMessage: message,
          failedMessageId: userMsgId,
          chatResponseState: failure(message),
        }));
      // A failed clip retries the whole voice send (app lastFailedVoiceAudioUri).
      lastRequestRef.current = async () => {
        setState((s) => ({ ...s, messages: s.messages.filter((m) => m.id !== userMsgId) }));
        await initializeVoicePrototype(recording, _originScreenName);
      };
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
        const heard = res.data.heard_input_query!.trim();
        // The bubble keeps its clip and now reads the transcription; runTextQuery adds the
        // answer placeholder, so the transcription placeholder goes.
        setState((s) => ({
          ...s,
          messages: s.messages
            .filter((m) => m.id !== placeholderId)
            .map((m) => (m.id === userMsgId && m.kind === 'user' ? { ...m, text: heard, isTranscribing: false } : m)),
        }));
        await runTextQuery(heard, {
          transcriptionId: res.data.transcription_id ?? null,
          audioUri: recording.objectUrl,
          reuseUserMessageId: userMsgId,
          sendQuery: 'pending',
          properties: { triggeredInputType: 'voice' },
        });
      } else {
        analytics.track(Events.TRANSCRIPTION_FAILED, {
          confidence_score: res.ok ? (res.data.confidence_score ?? 0) : 0,
        });
        const somethingWrong = labels.getLabel('fc_v2_app_label_something_went_wrong', 'Something went wrong');
        // Low confidence: the bubble shows what was heard; a failed call: "Something went wrong".
        const heard = res.ok ? (res.data.heard_input_query ?? '') : '';
        const text = res.ok && heard.trim().length > 0 ? heard : somethingWrong;
        failVoice(text, text);
      }
    },
    [analytics, api, ensureConversationId, labels, minimalSendQuery, runTextQuery, startSendQuery],
  );

  // -------------------------------------------------------------------------
  // Follow-ups / image / voice sends
  // -------------------------------------------------------------------------

  const sendFollowUpQuestion = useCallback<ChatActions['sendFollowUpQuestion']>(
    async (question, opts = {}) => {
      // #30 only for a tapped suggested follow-up, with its server id (app ChatViewModel.kt:952-963).
      // Typed questions and alignment chips send nothing; the question text is never sent.
      if (opts.followUpQuestionId !== null && opts.followUpQuestionId !== undefined && opts.followUpQuestionId !== '') {
        void api.trackFollowUpClick(String(opts.followUpQuestionId));
      }
      await runTextQuery(question, {
        transcriptionId: opts.transcriptionId ?? null,
        audioUri: opts.audioUri ?? null,
        displayText: opts.displayText ?? null,
        // A tapped follow-up chip: handleFollowUp's props (ChatScreen.kt:959-971) — follow-up,
        // text, no chip status (→ "none"). A typed send: buildMinimalSendQueryProps with the
        // manual chip context (`skipped` when a surface's chips were left unpicked).
        sendQuery: opts.isFollowupPrompt
          ? {
              screenName: Screens.CHAT,
              isFollowupPrompt: true,
              isImageQuery: false,
              isTextQuery: true,
              isVoiceQuery: false,
              lengthOfTextQuery: question.length,
            }
          : minimalSendQuery(question, { voice: opts.transcriptionId != null }),
        properties: {
          // App ChatViewModel.sendFollowUpQuestion (ChatViewModel.kt:993-997):
          // transcription → "voice", tapped follow-up chip → "follow_up", typed → "text".
          triggeredInputType: followUpTriggeredType(opts),
        },
      });
    },
    [api, minimalSendQuery, runTextQuery],
  );

  const selectAlignmentChip = useCallback<ChatActions['selectAlignmentChip']>(
    async (messageId, kind, chip, analyticsChipValue) => {
      // App rule (alignmentChipSend): the LABEL is shown and sent, the VALUE only marks the chip;
      // gender-select sends the value under its label. The selection is stored verbatim (never
      // trimmed) so it still matches the untrimmed comparison `AlignmentSurface` makes.
      const send = alignmentChipSend(kind, chip);
      if (!send) return;
      // App sendAlignmentChip (ChatViewModel.kt:1015-1052): ignored while an answer is in flight.
      if (stateRef.current.isLoading) return;
      const sendQueryBase = minimalSendQuery(send.query);
      // The server id of the surface that showed the chips, sent back as parent_message_id.
      const source = stateRef.current.messages.find(
        (m): m is AiResponse => m.kind === 'ai' && m.id === messageId,
      );
      setState((s) => {
        const messages = recordAlignmentPick(s.messages, messageId, send.selectionValue);
        return messages === s.messages ? s : { ...s, messages: messages as ChatMessage[] };
      });
      // Straight to the query pipeline, not `sendFollowUpQuestion`: a chip pick is tagged
      // `align_chip_sel` (never the follow-up chip's type) so the backend can tell it from typed
      // text, and it never reports a #30 follow-up click.
      await runTextQuery(send.query, {
        displayText: send.displayText === send.query ? null : send.displayText,
        alignment: alignmentRequestFields(kind, source?.messageId),
        // SendAlignmentChip props (ChatViewModel.kt:286-302): minimal props over the thread
        // BEFORE the pick, then a chip pick — selected, the surface type, chip value and label.
        sendQuery: {
          ...sendQueryBase,
          isAlignmentChip: true,
          agenticChipType: alignmentAnalyticsType(kind),
          agenticChipValue: analyticsChipValue ?? (chip.value || chip.label || ''),
          agenticChipLabel: chip.label || chip.value || '',
          agenticChipStatus: ChipStatus.SELECTED,
        },
        properties: { triggeredInputType: ALIGN_CHIP_SEL },
      });
    },
    [minimalSendQuery, runTextQuery],
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
      // ChatViewModel.kt:1100-1117: reported as a chip pick (gps-prompt, share_precise_location,
      // `Labels.SHARE_LOCATION`), over the thread BEFORE the location bubble.
      const locationSendQuery: SendQueryProps = {
        ...minimalSendQuery(query),
        isAlignmentChip: true,
        agenticChipType: alignmentAnalyticsType('GPS_PROMPT'),
        agenticChipValue: CapabilityChip.VALUE_SHARE_LOCATION,
        agenticChipLabel: labels.getLabel('fc_v2_app_label_share_location', 'Share my location'),
        agenticChipStatus: ChipStatus.SELECTED,
      };

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
      // fires Send_Query_Initiated with the chip-pick props built above.
      await runTextQuery(query, {
        properties: { triggeredInputType: ALIGN_CHIP_SEL },
        sendQuery: locationSendQuery,
        suppressUserMessage: true,
        // ChatViewModel.kt:1071: the GPS_PROMPT surface's server id; no decline flag on success.
        alignment: alignmentRequestFields('GPS_PROMPT', source?.messageId, true),
      });
    },
    [labels, minimalSendQuery, runTextQuery],
  );

  const sendQuestionWithImage = useCallback<ChatActions['sendQuestionWithImage']>(
    async (question, imageBlob, imageObjectUrl, fromChip) => {
      // App ChatViewModel.sendQuestionWithImage (:1121-1149) → fetchPlantixResponse (:1820-1915).
      // The bubble shows only what the farmer typed (blank → image-only); the API always gets a
      // prompt, the default question when the caption is blank.
      const displayText = question.trim();
      const apiQuery = displayText || defaultImageQuery();
      // Send_Query_Initiated at send time. A composer photo: buildMinimalSendQueryProps (image,
      // size, manual chip context; ChatViewModel.kt:310-323). A photo from an upload-photo chip:
      // sendAlignmentPhotoDirect's props — a chip pick (`selected`, `upload-photo`, the chip's
      // value/label, click_type align_chip_sel; ChatScreen.kt:431-455).
      const sizeKb = Math.max(0, Math.floor(imageBlob.size / 1024));
      startSendQuery(
        fromChip
          ? {
              screenName: Screens.CHAT,
              isFollowupPrompt: false,
              isImageQuery: true,
              isTextQuery: false,
              isVoiceQuery: false,
              lengthOfTextQuery: 0,
              sizeOfImageKb: sizeKb,
              isAlignmentChip: true,
              agenticChipType: alignmentAnalyticsType('UPLOAD_PHOTO'),
              agenticChipValue: fromChip.value,
              agenticChipLabel: fromChip.label,
            }
          : minimalSendQuery(displayText, { image: true, sizeKb }),
      );
      if (services.config.enableAgenticChat) {
        // Agentic on (ChatViewModel.kt:1858-1882): NOT image_analysis — the photo rides on the
        // agentic text request as `image` + `image_name`, `triggered_input_type: "image"`, and the
        // answer streams like any text answer (follow-ups, TTS, alignment surfaces included).
        const prepared = await prepareImageForUpload(imageBlob);
        if (!prepared) {
          finishSendQuery(false); // ChatViewModel.kt:1852
          const message = labels.getLabel('fc_v2_app_label_failed_to_process_image', 'Failed to process image');
          patch({ isLoading: false, errorMessage: message, chatResponseState: failure(message) });
          return;
        }
        await runTextQuery(apiQuery, {
          sendQuery: 'pending',
          displayText,
          // The photo shows as the wide 16:9 banner on the question bubble (ChatViewModel.kt:1137).
          contentCardImageUrl: imageObjectUrl,
          image: { base64: prepared.base64, imageName: prepared.imageName },
          properties: { triggeredInputType: 'image' },
        });
        return;
      }
      const userMsgId = nextLocalId('user');
      const placeholderId = nextLocalId('loading');
      setState((s) => ({
        ...s,
        messages: [
          ...s.messages,
          {
            kind: 'user',
            id: userMsgId,
            text: displayText,
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

      analytics.messageSent(question);
      const conversationId = await ensureConversationId();
      const prepared = await prepareImageForUpload(imageBlob);
      if (!prepared) {
        finishSendQuery(false);
        const message = labels.getLabel('fc_v2_app_label_failed_to_process_image', 'Failed to process image');
        setState((s) => ({
          ...s,
          messages: s.messages.filter((m) => m.id !== placeholderId),
          isLoading: false,
          errorMessage: message,
          failedMessageId: userMsgId,
          chatResponseState: failure(message),
        }));
        return;
      }
      // App PlantixRequest latitude/longitude = the fix ImageUtils resolved for the photo (its own
      // EXIF GPS, else the current location with permission already granted) as Kotlin
      // Double.toString(), or null (ChatViewModel.kt:1888-1889).
      const lat = prepared.gps ? kotlinDoubleString(prepared.gps.latitude) : null;
      const lng = prepared.gps ? kotlinDoubleString(prepared.gps.longitude) : null;

      lastRequestRef.current = () => sendQuestionWithImage(question, imageBlob, imageObjectUrl);

      const res = await api.imageAnalysis({
        conversation_id: conversationId,
        image: prepared.base64,
        // App parity (PlantixRequest.kt): triggered_input_type "image",
        // latitude/longitude as STRINGs (the store already holds strings).
        triggered_input_type: 'image',
        // ChatViewModel.kt:1864: a caption-less photo still asks the default question.
        query: apiQuery,
        latitude: lat ?? null,
        longitude: lng ?? null,
        image_name: prepared.imageName,
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
        finishSendQuery(false); // ChatViewModel.kt:2153
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
      finishSendQuery(true); // Plantix success: Valid_Query true, no intent (ChatViewModel.kt:2125)
      analytics.answerReceived(res.data.message_id ?? '');
      if (res.data.message_id) void fetchFollowUps(res.data.message_id, aiId);
    },
    [analytics, api, defaultImageQuery, ensureConversationId, fetchFollowUps, finishSendQuery, labels, minimalSendQuery, patch, runTextQuery, services.config, startSendQuery],
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
        // ChatViewModel.kt:914-922: read-full-advice props.
        sendQuery: {
          screenName: Screens.CHAT,
          isFollowupPrompt: false,
          isImageQuery: false,
          isTextQuery: true,
          isVoiceQuery: false,
          lengthOfTextQuery: question.length,
          isReadFullAdvice: true,
        },
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
        // App parity (ChatViewModel.kt:1204-1230, 1296-1300): history keeps only the question
        // strings and never sets suggestedQuestionIds, so a chip tapped in a reopened conversation
        // sends no #30 — only the query, as "follow_up".
        suggestedQuestionIds: page === 1 ? null : s.suggestedQuestionIds,
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
        // App SetAudioPlaying(true): the pill flips to Playing on the tap, not on the media event.
        patch({ isAudioPlaying: true });
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
      // A finished clip fires `pause` and then `ended` (HTML media spec), so without this latch
      // STOPPED_PLAYING_RESPONSE_AUDIO was reported twice per completed clip; the app reports once.
      let started = false;
      audio.onplay = () => {
        started = true;
        ttsSecondsStartedRef.current = Date.now();
        analytics.track(Events.STARTED_PLAYING_RESPONSE_AUDIO, { message_id: messageId });
        patch({ isAudioPlaying: true });
      };
      const onStop = () => {
        if (started) {
          started = false;
          analytics.track(Events.STOPPED_PLAYING_RESPONSE_AUDIO, {
            message_id: messageId,
            seconds_played: Math.round((Date.now() - ttsSecondsStartedRef.current) / 1000),
          });
        }
        patch({ isAudioPlaying: false });
      };
      audio.onpause = onStop;
      audio.onended = () => {
        onStop();
        patch({ audioPlaybackUrl: null });
        audioRef.current = null;
      };
      // App ChatViewModel.kt:664-670 sets `isAudioPlaying = url != null` in the SAME update that
      // stores the URL, so the pill goes Loading → Playing (pause icon + animated bars) while the
      // clip buffers. Waiting for `onplay` instead showed the Paused state (play icon + static
      // bars) for the whole buffering gap.
      patch({ isLoadingSynthesiseAudio: false, audioPlaybackUrl: url, isAudioPlaying: true });
      try {
        await audio.play();
      } catch (err) {
        // The farmer paused while the clip was still buffering (the pill already shows Playing):
        // play() rejects with AbortError. That is a pause, not a failure — `onpause` has already
        // flipped the pill to Paused, so no error is shown.
        if (isAbortError(err)) return;
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
