/**
 * Alignment surfaces (**SDK 2.0.0**) — a short prompt the farmer answers by tapping a chip,
 * instead of receiving a normal answer. Served on `TextPromptResponse.alignments` (see
 * `./types`), by both the synchronous #27 reply and the agentic #27a `metadata` event.
 *
 * TypeScript port of Kotlin's `AlignmentKind` enum (`core/model/ChatModels.kt`). Kotlin's enum
 * members become a string union plus three free functions, because `enum` is not usable here:
 * `isolatedModules` + Node's type-stripping test runner both reject it.
 */

/** The alignment surfaces the backend can ask for. */
export type AlignmentKind =
  | 'CLARIFY'
  | 'CONFIRM'
  | 'ESCALATE'
  | 'GPS_PROMPT'
  | 'UPLOAD_PHOTO'
  | 'GENDER_SELECT'
  | 'COMMODITY_CONFIRM';

/**
 * Wire `type` → kind. Null for an unknown or absent type: render as a normal answer.
 * (Kotlin `AlignmentKind.fromType`.)
 */
export function alignmentKindFromType(type: string | null | undefined): AlignmentKind | null {
  switch ((type ?? '').trim().toLowerCase()) {
    case 'alignment-clarify':
      return 'CLARIFY';
    case 'alignment-confirm':
      return 'CONFIRM';
    case 'alignment-escalate':
      return 'ESCALATE';
    case 'gps-prompt':
      return 'GPS_PROMPT';
    case 'upload-photo':
      return 'UPLOAD_PHOTO';
    case 'gender-select':
      return 'GENDER_SELECT';
    case 'commodity-confirm':
      return 'COMMODITY_CONFIRM';
    default:
      return null;
  }
}

/**
 * Additive surfaces accompany a normal answer — they render BELOW it as an optional nudge and
 * never suppress the answer or its follow-ups. Exclusive surfaces (clarify / confirm / escalate /
 * capability prompts) own the message area and replace the answer.
 *
 * The backend marks the additive ones non-blocking (`blocking:false`, `intent:"profile"`).
 * Both are single-select: one tap sends immediately and locks the card.
 * (Kotlin `AlignmentKind.isAdditive`.)
 */
export function isAdditiveAlignment(kind: AlignmentKind): boolean {
  return kind === 'GENDER_SELECT' || kind === 'COMMODITY_CONFIRM';
}

/**
 * The exact wire `type` string, reported as the `agentic_chip_type` analytics property so funnels
 * can be segmented by which surface was tapped. Keep these stable and in sync with
 * {@link alignmentKindFromType} — dashboards depend on them.
 * (Kotlin `AlignmentKind.analyticsType`.)
 */
export function alignmentAnalyticsType(kind: AlignmentKind): string {
  switch (kind) {
    case 'CLARIFY':
      return 'alignment-clarify';
    case 'CONFIRM':
      return 'alignment-confirm';
    case 'ESCALATE':
      return 'alignment-escalate';
    case 'GPS_PROMPT':
      return 'gps-prompt';
    case 'UPLOAD_PHOTO':
      return 'upload-photo';
    case 'GENDER_SELECT':
      return 'gender-select';
    case 'COMMODITY_CONFIRM':
      return 'commodity-confirm';
  }
}

/**
 * The minimum shape {@link recordAlignmentPick} needs from a chat message. Declared structurally
 * (rather than importing `AiResponse`) so this module stays free of the React state layer and can
 * be exercised by the framework-less Node test runner.
 */
export interface AlignmentPickTarget {
  kind: string;
  id: string;
  alignmentSelectedValues?: string[];
}

/**
 * Records a tapped alignment chip on its own message so the surface can render it as picked.
 *
 * Port of Kotlin `ChatViewModel.recordAlignmentPick` (`core/ui/chat/ChatViewModel.kt`), which the
 * Compose/Views flavours both rely on: a chip tap dispatches a plain follow-up send, so without
 * this the `alignmentSelectedValues` list stays empty forever and the entire selected/locked chip
 * treatment is dead code — the tapped chip never shows a check, never locks, and the unpicked
 * chips never fade back.
 *
 * Differences from the Kotlin, both deliberate:
 * - Android searches for the LAST surface message and re-checks the picked string against that
 *   surface's own chips, because its action carries only a question string. Here the caller passes
 *   the surface's own [messageId], so the match is structural and the value-or-label re-check is
 *   unnecessary — and, more importantly, a follow-up the farmer typed themselves can never be
 *   mistaken for a chip pick.
 * - [picked] is stored VERBATIM, never trimmed. `AlignmentSurface` compares it against
 *   `chip.value` / `chip.label` untrimmed, so trimming here would record a string that can never
 *   match and the chip would stay unhighlighted.
 *
 * Returns the original array unchanged when the message is absent or already holds [picked], so a
 * caller's `setState` stays referentially stable on a no-op.
 */
export function recordAlignmentPick<T extends AlignmentPickTarget>(
  messages: readonly T[],
  messageId: string,
  picked: string,
): readonly T[] {
  if (picked.length === 0) return messages;
  const index = messages.findIndex((m) => m.kind === 'ai' && m.id === messageId);
  if (index < 0) return messages;
  const target = messages[index]!;
  const existing = target.alignmentSelectedValues ?? [];
  if (existing.includes(picked)) return messages;
  const next = messages.slice();
  next[index] = { ...target, alignmentSelectedValues: [...existing, picked] };
  return next;
}

// ---------------------------------------------------------------------------
// Capability chips (2.0.0)
// ---------------------------------------------------------------------------

/**
 * Wire values for the capability chips, copied verbatim from the app's
 * `domain/model/chat/TextPromptResponse.kt` (Kotlin `AlignmentChip`'s companion object).
 *
 * A capability chip does NOT send its text as a question — it invokes a device capability and only
 * its OUTCOME is sent. Every other chip keeps sending text.
 *
 * Note {@link CapabilityChip.ACTION_SELECT} is the string `"invoke"`, not `"select"`, and
 * {@link CapabilityChip.VALUE_SHARE_LOCATION} is `"share_precise_location"` — the app has a
 * `share_location` constant commented out directly above it. Do not "normalize" either one: a
 * mismatch fails silently, falling through to the text path so the farmer sends the literal string
 * `"share_precise_location"` as their question.
 */
export const CapabilityChip = {
  /** `action` marking a chip that invokes a capability rather than sending text. */
  ACTION_SELECT: 'invoke',
  /** GPS_PROMPT: start the location flow, then send the original query. */
  VALUE_SHARE_LOCATION: 'share_precise_location',
  /** UPLOAD_PHOTO: open the camera / the gallery. */
  VALUE_TAKE_PHOTO: 'take_photo',
  VALUE_CHOOSE_FROM_GALLERY: 'choose_from_gallery',
  /** The decline chip on a capability prompt — an ordinary text answer, not a capability. */
  VALUE_NOT_NOW: 'not_now',
} as const;

/** Where a tapped alignment chip must go. `TEXT` is the ordinary send-the-chip's-value path. */
export type CapabilityChipRoute = 'LOCATION' | 'CAMERA' | 'GALLERY' | 'TEXT';

/**
 * The minimum shape {@link capabilityChipRoute} needs from a chip. Declared structurally (rather
 * than importing `AlignmentChip` from `./types`) so this module stays dependency-free and can be
 * exercised by the framework-less Node test runner — `AlignmentChip` satisfies it.
 */
export interface CapabilityChipInput {
  value?: string | null;
  action?: string | null;
}

/**
 * Routes an alignment chip tap. Port of the `when` in Kotlin's flavour-level
 * `handleAlignmentChip` (compose `screens/ChatScreen.kt`), lifted into this React-free module so
 * `ChatScreen.tsx` and `test/capabilityChip.test.ts` share ONE routing table — a table the screen
 * re-implemented inline would pass its test while the UI diverged.
 *
 * The rule: a chip routes to a capability only when its `action` is
 * {@link CapabilityChip.ACTION_SELECT} AND its `value` belongs to its own surface's kind.
 * Anything else — a decline chip, a value under the wrong kind, a chip with no action, any
 * non-capability surface — is `TEXT`.
 */
export function capabilityChipRoute(
  kind: AlignmentKind | null | undefined,
  chip: CapabilityChipInput,
): CapabilityChipRoute {
  const isInvoke = chip.action === CapabilityChip.ACTION_SELECT;
  const isPhoto = kind === 'UPLOAD_PHOTO' && isInvoke;
  if (kind === 'GPS_PROMPT' && isInvoke && chip.value === CapabilityChip.VALUE_SHARE_LOCATION) {
    return 'LOCATION';
  }
  if (isPhoto && chip.value === CapabilityChip.VALUE_TAKE_PHOTO) return 'CAMERA';
  if (isPhoto && chip.value === CapabilityChip.VALUE_CHOOSE_FROM_GALLERY) return 'GALLERY';
  return 'TEXT';
}

/** What a plain-text alignment chip tap sends, shows, and marks. See {@link alignmentChipSend}. */
export interface AlignmentChipSend {
  /** Sent to the API as the next query. */
  query: string;
  /** Recorded on the surface to highlight/lock the tapped chip; never sent. */
  selectionValue: string;
  /** The user-bubble text. */
  displayText: string;
}

/**
 * The text a non-capability chip tap sends. Port of the app's `onAlignmentChipClick` else-branches
 * (fc-compose-agentic `ui/chat/ChatScreen.kt:1639-1663`) and Android's `routeAlignmentChip`:
 *
 * - **Every kind except gender-select:** the chip LABEL is shown in the bubble AND sent as the
 *   query; the VALUE only marks the chosen chip. Sending the value instead puts machine strings
 *   such as `written_plan` in the farmer's bubble and asks the backend a question nobody typed.
 * - **gender-select:** the VALUE is sent (the backend expects the raw gender value) while the
 *   LABEL is shown.
 *
 * Each side falls back to the other when blank. Null when the chip carries neither.
 */
export function alignmentChipSend(
  kind: AlignmentKind | null | undefined,
  chip: { label?: string | null; value?: string | null },
): AlignmentChipSend | null {
  const label = chip.label && chip.label.trim().length > 0 ? chip.label : null;
  const value = chip.value && chip.value.trim().length > 0 ? chip.value : null;
  const shown = label ?? value;
  const marked = value ?? label;
  if (shown === null || marked === null) return null;
  if (kind === 'GENDER_SELECT') return { query: marked, selectionValue: marked, displayText: shown };
  return { query: shown, selectionValue: marked, displayText: shown };
}
