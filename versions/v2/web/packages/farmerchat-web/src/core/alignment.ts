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
