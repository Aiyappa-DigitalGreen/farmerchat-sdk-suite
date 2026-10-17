/**
 * Pure chat wire rules shared by `useChat` and its tests. Internal: not re-exported from
 * `index.ts`. Kept free of React / native imports so the unit tests can load it directly.
 */
import {
  AlignmentKinds,
  isAdditiveAlignment,
  type AlignmentKind,
  type ConversationChatHistoryQuestion,
} from './types';

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

/**
 * Whether an answer's follow-ups are fetched from endpoint #29. App ChatViewModel.kt:2020-2025:
 * never after an EXCLUSIVE alignment surface (clarify / confirm / escalate / gps-prompt /
 * upload-photo) — its chips are the next step — but still after a normal answer and after an
 * ADDITIVE one (gender-select / commodity-confirm); and only with a server message id and no
 * `hide_follow_up_question`.
 */
export function fetchesFollowUps(
  alignmentKind: AlignmentKind | null | undefined,
  messageId: string | null | undefined,
  hideFollowUpQuestion: boolean | null | undefined,
): boolean {
  if (!messageId || hideFollowUpQuestion === true) return false;
  return alignmentKind == null || isAdditiveAlignment(alignmentKind);
}

/**
 * Drops null / undefined members, as the app's Gson does when it serialises a request (no
 * `serializeNulls()`; AgenticChatDataSource.kt:58 `gson.toJson(request)`, and Retrofit's Gson
 * converter for #27): an unset field is absent from the body, never `null`.
 */
export function omitNullFields<T extends object>(body: T): T {
  return Object.fromEntries(
    Object.entries(body).filter(([, v]) => v !== null && v !== undefined),
  ) as T;
}

/**
 * Whether a #31 synthesise reply for the answer `requestedAnswerId` (local list id) may still play:
 * only while that answer is still the latest AI message and no new answer is loading. A slow reply
 * that lands after the farmer moved on (new question, follow-up chip) is dropped, so the OLD answer
 * never plays over the new turn (Android scenario pass 2026-10-17, `SynthesisGuard`; the app has
 * the same race — a deliberate improvement).
 */
export function synthesisStillWanted(
  requestedAnswerId: string,
  messages: ReadonlyArray<{ kind: string; id: string }>,
  isLoading: boolean,
): boolean {
  if (isLoading) return false;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m && m.kind === 'ai') return m.id === requestedAnswerId;
  }
  return false;
}

/**
 * Whether a Home card that became >= 50 % visible is marked viewed (#25). App HomeScreen.kt:2092:
 * only `type == "image"` cards with a statement id that are not already viewed. Statement / other
 * cards are not (DEMO 404s them).
 */
export function marksCardViewed(section: {
  type?: string | null;
  statement_id?: string | number | null;
  is_viewed?: boolean | null;
}): boolean {
  return section.type === 'image' && statementIdOf(section) !== null && section.is_viewed !== true;
}

/**
 * A Home card's statement id as the app sends it: `statement_id?.toString()` (HomeScreen.kt:2093).
 * DEMO sends a UUID string; a number is tolerated. Null when absent or blank.
 */
export function statementIdOf(section: { statement_id?: string | number | null }): string | null {
  const v = section.statement_id;
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
}

/**
 * Home weather chip text — app HomeScreen.kt:345 `current_temp ?: "--°"`, rendered verbatim (the
 * server already sends the unit, e.g. "27 °C"; appending "°" drew "27 °C°").
 */
export function weatherChipText(currentTemp: string | null | undefined): string {
  return currentTemp != null && currentTemp !== '' ? currentTemp : '--°';
}

/**
 * Remote weather icon to draw, or null for the bundled glyph. The server sends SVG icons, which
 * the app draws with a Coil SvgDecoder (WeatherButton.kt:117-119); RN `Image` cannot decode SVG and
 * drew an empty 24dp square, so SVG (and non-http) URLs fall back like the iOS SDK does.
 */
export function weatherIconUri(url: string | null | undefined): string | null {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const path = url.split(/[?#]/)[0] ?? '';
  return path.toLowerCase().endsWith('.svg') ? null : url;
}

/** Drawer destinations (ui/navigation/DrawerContent.tsx). */
export type DrawerRoute = 'home' | 'settings' | 'settings/language' | 'help' | 'chatHistory';

/**
 * `Menu_Option_Click_Event.option` for a drawer row — app DrawerContent.kt
 * `trackMenuOptionClick("Home" | "Language" | "Settings" | "Help_Support" | "Signup")`.
 * "See all" / "Recent chats" track Chat_History_Click_Event instead (null here).
 */
export function drawerMenuOption(route: DrawerRoute | 'signup'): string | null {
  switch (route) {
    case 'home':
      return 'Home';
    case 'settings/language':
      return 'Language';
    case 'settings':
      return 'Settings';
    case 'help':
      return 'Help_Support';
    case 'signup':
      return 'Signup';
    case 'chatHistory':
      return null;
  }
}

/**
 * Collapsed language list — app LanguageChooserScreen.kt:138-149: when the selected language is
 * only in the expanded list, it is shown first above the priority list so the current choice
 * stays visible (and selected).
 */
export function collapsedLanguages<T extends { id: number }>(
  priority: readonly T[],
  all: readonly T[],
  selectedId: number | null,
): T[] {
  const selected = selectedId == null ? undefined : all.find((l) => l.id === selectedId);
  if (!selected || priority.some((l) => l.id === selected.id)) return [...priority];
  return [selected, ...priority];
}

/**
 * Legal links from endpoint #4 — app GetSupportedLanguagesUseCase.kt:75-78
 * `LegalLinks(privacyPolicyUrl = url, termsOfUseUrl = farmerchat_terms_of_use)`. The RN SDK used
 * to read `privacy_policy_url` / `terms_of_use_url`, which the app model does not have, so the
 * links stayed null; those remain only as a fallback. Blank strings count as missing.
 */
export function legalLinksOf(response: {
  url?: string | null;
  farmerchat_terms_of_use?: string | null;
  privacy_policy_url?: string | null;
  privacy_policy?: string | null;
  terms_of_use_url?: string | null;
  terms_of_use?: string | null;
}): { privacyPolicyUrl: string | null; termsOfUseUrl: string | null } {
  const first = (...values: Array<string | null | undefined>): string | null => {
    for (const v of values) if (v != null && v.trim() !== '') return v.trim();
    return null;
  };
  return {
    privacyPolicyUrl: first(response.url, response.privacy_policy_url, response.privacy_policy),
    termsOfUseUrl: first(response.farmerchat_terms_of_use, response.terms_of_use_url, response.terms_of_use),
  };
}
