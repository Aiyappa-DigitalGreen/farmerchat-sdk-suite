/**
 * Pure chat wire rules shared by `useChat` and its tests. Internal: not re-exported from
 * `index.ts`. Kept free of React / native imports so the unit tests can load it directly.
 */
import { AlignmentKinds, type AlignmentKind, type ConversationChatHistoryQuestion } from './types';

/**
 * `triggered_input_type` for every alignment-chip send: a text chip, a capability-chip outcome,
 * and a declined capability. App parity (`ChatViewModel.sendAlignmentChip`, ChatViewModel.kt:1051);
 * the string is part of the #27/#27a contract.
 */
export const ALIGN_CHIP_SEL = 'align_chip_sel';

/** What an alignment-chip send adds to the text-prompt request beyond the query. */
export interface AlignmentChipRequestParams {
  triggeredInputType: typeof ALIGN_CHIP_SEL;
  /** The surface's SERVER message_id (never the local list id); null when it has none yet. */
  parentMessageId: string | null;
  locationDeclined: boolean;
  photoDeclined: boolean;
}

/**
 * Request params for an alignment chip that is SENT AS TEXT (the chip's label, or a gender value).
 *
 * App ChatScreen.kt:1648-1663 + ChatViewModel.kt:1015-1052: the capability chips (share location,
 * take photo, choose from gallery) never reach this path, so a GPS_PROMPT chip that does is the
 * decline chip (`location_declined`) and an UPLOAD_PHOTO chip is the decline chip
 * (`photo_declined`). `parent_message_id` is the server id of the response that showed the chips.
 */
export function alignmentChipRequestParams(
  kind: AlignmentKind | null | undefined,
  sourceServerMessageId: string | null | undefined,
): AlignmentChipRequestParams {
  const parent =
    sourceServerMessageId && sourceServerMessageId.trim().length > 0 ? sourceServerMessageId : null;
  return {
    triggeredInputType: ALIGN_CHIP_SEL,
    parentMessageId: parent,
    locationDeclined: kind === AlignmentKinds.GPS_PROMPT,
    photoDeclined: kind === AlignmentKinds.UPLOAD_PHOTO,
  };
}

/**
 * Display strings of a history `follow_up_questions` item (message_type_id 7). App parity
 * (ChatViewModel.kt:1296-1300): only `.question` is kept. The server does send each item's
 * `follow_up_question_id` (verified on DEMO 2026-10-16), but the app discards it and never sets
 * `suggestedQuestionIds` on a history load, so a tapped history chip carries no id and no
 * endpoint #30 fires. A bare string is tolerated; blank questions are dropped.
 */
export function historyFollowUpQuestions(
  questions: Array<string | Partial<ConversationChatHistoryQuestion> | null | undefined> | null | undefined,
): string[] {
  return (questions ?? [])
    .map((q) => (typeof q === 'string' ? q : q?.question ?? ''))
    .filter((q) => q.length > 0);
}

/**
 * History items in the order the app renders them: ascending `message_input_time`, items without
 * one last, ties kept in wire order (ChatViewModel.kt:1255, a stable
 * `sortedWith(compareBy(nullsLast(naturalOrder())) { it.message_input_time })`). DEMO returns
 * turns newest-first, so without this a reopened conversation reads upside down. The timestamps
 * are ISO-8601 strings, so String natural order = lexicographic, as here.
 */
export function sortHistoryItems<T extends { message_input_time?: string | null }>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const x = a.item.message_input_time ?? null;
      const y = b.item.message_input_time ?? null;
      if (x === y) return a.index - b.index;
      if (x === null) return 1;
      if (y === null) return -1;
      return x < y ? -1 : x > y ? 1 : a.index - b.index;
    })
    .map((e) => e.item);
}

/**
 * Bubble text of a history voice turn (message_type_id 2). App ChatViewModel.kt:1273:
 * `item.query_text ?: item.heard_query_text ?: ""`. Kotlin's `?:` falls back on null only, so a
 * blank `query_text` stays blank (no fallback), exactly as here.
 */
export function historyVoiceText(item: {
  query_text?: string | null;
  heard_query_text?: string | null;
}): string {
  return item.query_text ?? item.heard_query_text ?? '';
}

/**
 * App image name (ChatViewModel.kt:1861-1862): `image_<random UUID>.jpg`, on both the agentic and
 * the Plantix image paths. `uuid` is injectable for tests.
 */
export function imageQueryName(uuid: string = randomUuid()): string {
  return `image_${uuid}.jpg`;
}

/** RFC 4122 v4 from Math.random (no crypto module on every RN runtime). */
export function randomUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * The query an image request carries (ChatViewModel.kt:1127, 1858): what the farmer typed, or the
 * `what_is_wrong_with_my_crop` default when blank. The user bubble still shows only the typed text.
 */
export function imageQueryText(question: string, defaultQuery: string): string {
  const typed = question.trim();
  return typed.length > 0 ? typed : defaultQuery;
}

/**
 * Progress (0..1) of Compose's default `spring()` (dampingRatio 1, stiffness 1500, unit mass)
 * started from rest: x(t) = 1 - (1 + wt) e^(-wt), w = sqrt(1500). Drives the chat's animated pin
 * (the app's `animateScrollToItem` seek, compose-foundation LazyLayoutScrollScope.kt:264).
 */
export function criticallyDampedProgress(seconds: number): number {
  const w = Math.sqrt(1500);
  const wt = w * Math.max(0, seconds);
  return 1 - (1 + wt) * Math.exp(-wt);
}

/** ShareCard.kt:21-24 (Figma character limits). */
export const SHARE_CARD_LIMITS = {
  photo: { title: 50, body: 460 },
  textOnly: { title: 70, body: 940 },
} as const;

/** ShareCard.kt:33-35: truncation by character count (Kotlin `take`). */
export function shareCardText(
  title: string,
  body: string,
  hasPhoto: boolean,
): { title: string; body: string } {
  const limits = hasPhoto ? SHARE_CARD_LIMITS.photo : SHARE_CARD_LIMITS.textOnly;
  return { title: title.slice(0, limits.title), body: body.slice(0, limits.body) };
}
