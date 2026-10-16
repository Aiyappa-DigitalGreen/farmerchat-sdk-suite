/**
 * Send_Query / Send_Query_Initiated properties — port of the app's
 * `core/analytics/SendQueryAnalytics.kt` (`SendQueryProperties.toAnalyticsProperties`) and of the
 * chip-status helpers in `ui/chat/ChatViewModel.kt` (`manualSendChipContext`,
 * `withResponseChipStatus`, the Send_Query response stamping). Key names are the app's
 * `AnalyticsProps` constants verbatim (AnalyticsProps.kt:44-79). Internal; not re-exported.
 */
import type { AlignmentChip, AlignmentKind, IntentClassificationOutput } from './types';
import { alignmentAnalyticsType } from './types';

/** AnalyticsProps.kt:61-65. */
export const ChipStatus = {
  SELECTED: 'selected',
  SKIPPED: 'skipped',
  AVAILABLE: 'available',
  NONE: 'none',
} as const;

/** App `SendQueryProperties` (SendQueryAnalytics.kt:9-85), camelCase as in the app. */
export interface SendQueryProps {
  screenName: string;
  isFollowupPrompt: boolean;
  isImageQuery: boolean;
  isTextQuery: boolean;
  isVoiceQuery: boolean;
  isWeatherAdviceCTA?: boolean;
  lengthOfAudioInSeconds?: number;
  lengthOfTextQuery?: number;
  sizeOfImageKb?: number;
  audioFormat?: string;
  isOnboardingQuery?: boolean;
  isSSFR?: boolean;
  isPush?: boolean;
  isInApp?: boolean;
  isImageCard?: boolean;
  isTextCard?: boolean;
  isReadFullAdvice?: boolean;
  isAlignmentChip?: boolean;
  agenticChipType?: string | null;
  agenticChipValue?: string | null;
  agenticChipLabel?: string | null;
  agenticChipStatus?: string | null;
  agenticChipSkippedType?: string | null;
  agenticChipShownType?: string | null;
  isValidQuery?: boolean | null;
  assetType?: string | null;
  assetName?: string | null;
  concern?: string | null;
  stage?: string | null;
  intent?: string | null;
  clarificationNeededAsset?: boolean;
  clarificationNeededConcern?: boolean;
  channel?: string | null;
}

const nonBlank = (v: string | null | undefined): string => (v && v.trim().length > 0 ? v : '');

/** SendQueryAnalytics.kt:86-160 `toAnalyticsProperties`, key for key. */
export function sendQueryAnalyticsProperties(p: SendQueryProps): Record<string, unknown> {
  const type = p.isImageQuery ? 'image' : p.isTextQuery ? 'text' : p.isVoiceQuery ? 'voice' : 'text';
  const clickType = p.isAlignmentChip
    ? 'align_chip_sel'
    : p.isReadFullAdvice
      ? 'read_full_advice'
      : p.isFollowupPrompt
        ? 'follow-up'
        : p.isImageCard
          ? 'Image_Card'
          : p.isTextCard
            ? 'Text_Card'
            : p.isWeatherAdviceCTA
              ? 'Weather'
              : p.isSSFR
                ? 'SSFR'
                : p.isPush
                  ? 'Push'
                  : p.isInApp
                    ? 'in-app'
                    : p.isOnboardingQuery
                      ? 'onboarding_query'
                      : nonBlank(p.channel) || type;
  const status =
    nonBlank(p.agenticChipStatus) || (p.isAlignmentChip ? ChipStatus.SELECTED : ChipStatus.NONE);
  const out: Record<string, unknown> = {
    screen_name: p.screenName,
    followup_prompt: p.isFollowupPrompt,
    image_query: p.isImageQuery,
    text_query: p.isTextQuery,
    voice_query: p.isVoiceQuery,
    weather_advice_cta: p.isWeatherAdviceCTA === true,
    length_of_audio_in_seconds: p.isVoiceQuery ? p.lengthOfAudioInSeconds ?? 0 : 0,
    length_of_Text_query: p.isTextQuery ? p.lengthOfTextQuery ?? 0 : 0,
    size_of_image_kb: p.isImageQuery ? p.sizeOfImageKb ?? 0 : 0,
    audio_format: p.isVoiceQuery ? nonBlank(p.audioFormat) : '',
    isOnnboarding_query: p.isOnboardingQuery === true,
    type,
    click_type: clickType,
    agentic_chip_status: status,
    agentic_chip_skipped_type:
      p.agenticChipStatus === ChipStatus.SKIPPED ? nonBlank(p.agenticChipSkippedType) : '',
    agentic_chip_shown_type:
      p.agenticChipStatus === ChipStatus.AVAILABLE ? nonBlank(p.agenticChipShownType) : '',
    agentic_chip_type: nonBlank(p.agenticChipType),
    agentic_chip_value: nonBlank(p.agenticChipValue),
    agentic_chip_label: nonBlank(p.agenticChipLabel),
  };
  if (p.isValidQuery != null) out.Valid_Query = p.isValidQuery;
  out.asset_type = nonBlank(p.assetType);
  out.asset_name = nonBlank(p.assetName);
  out.concern = nonBlank(p.concern);
  out.stage = nonBlank(p.stage);
  out.intent = nonBlank(p.intent);
  out.clarification_needed_asset = p.clarificationNeededAsset === true;
  out.clarification_needed_concern = p.clarificationNeededConcern === true;
  return out;
}

/** The slice of the latest AI message the chip context needs. */
export interface ChipSurfaceSnapshot {
  alignmentKind?: AlignmentKind | null;
  alignmentChips?: AlignmentChip[] | null;
  alignmentSelectedValues?: string[] | null;
}

/**
 * ChatViewModel.kt `manualSendChipContext`: for a query the farmer sent MANUALLY (typed / voice /
 * photo), `skipped` + the surface kind when the latest answer is an alignment surface whose chips
 * are still unselected, else `none`. Evaluate before the new user message is appended.
 */
export function manualSendChipContext(lastAi: ChipSurfaceSnapshot | null | undefined): {
  status: string;
  skippedType: string | null;
} {
  const kind = lastAi?.alignmentKind ?? null;
  const shownUnselected =
    kind !== null &&
    (lastAi?.alignmentChips ?? []).length > 0 &&
    (lastAi?.alignmentSelectedValues ?? []).length === 0;
  return shownUnselected
    ? { status: ChipStatus.SKIPPED, skippedType: alignmentAnalyticsType(kind) }
    : { status: ChipStatus.NONE, skippedType: null };
}

/** ChatViewModel.kt `buildMinimalSendQueryProps` (+ the manual chip context it stamps). */
export function minimalSendQueryProps(params: {
  question: string;
  isImageQuery: boolean;
  isVoiceQuery: boolean;
  sizeOfImageKb?: number;
  audioFormat?: string;
  lastAi?: ChipSurfaceSnapshot | null;
  screenName?: string;
}): SendQueryProps {
  const chip = manualSendChipContext(params.lastAi);
  return {
    screenName: params.screenName ?? 'Chat Screen',
    isFollowupPrompt: false,
    isImageQuery: params.isImageQuery,
    isTextQuery: !params.isImageQuery && !params.isVoiceQuery,
    isVoiceQuery: params.isVoiceQuery,
    lengthOfTextQuery: params.question.length,
    sizeOfImageKb: params.sizeOfImageKb ?? 0,
    audioFormat: params.isVoiceQuery ? params.audioFormat ?? '' : '',
    agenticChipStatus: chip.status,
    agenticChipSkippedType: chip.skippedType,
  };
}

/**
 * ChatViewModel.kt `withResponseChipStatus`: when the RESPONSE presents chips and the query was not
 * itself a chip reaction (status unset / `none`), the status becomes `available` with the shown
 * surface kind. `selected` / `skipped` are left alone. (As in the app, a photo-chip send carries no
 * explicit status, so it reads `selected` unless its own answer presents chips.)
 */
export function withResponseChipStatus(
  p: SendQueryProps,
  shownChipType: string | null,
): SendQueryProps {
  if (
    shownChipType !== null &&
    (p.agenticChipStatus == null || p.agenticChipStatus === ChipStatus.NONE)
  ) {
    return { ...p, agenticChipStatus: ChipStatus.AVAILABLE, agenticChipShownType: shownChipType };
  }
  return p;
}

/**
 * The Send_Query stamping done when the answer lands (ChatViewModel.kt:1706-1722, 2028-2043):
 * `Valid_Query`, the sent query's length, and the intent-classification fields.
 */
export function withSendQueryResult(
  p: SendQueryProps,
  result: { isValid: boolean; question?: string; intent?: IntentClassificationOutput | null },
): SendQueryProps {
  const intent = result.intent ?? null;
  const clarification =
    intent && typeof intent.clarification_needed === 'object' && intent.clarification_needed !== null
      ? intent.clarification_needed
      : null;
  return {
    ...p,
    ...(result.question !== undefined ? { lengthOfTextQuery: result.question.length } : {}),
    isValidQuery: result.isValid,
    ...(intent
      ? {
          assetType: intent.asset_type ?? null,
          assetName: intent.asset_name ?? null,
          concern: intent.concern ?? null,
          stage: intent.stage ?? null,
          intent: intent.intent ?? null,
          clarificationNeededAsset: clarification?.asset === true,
          clarificationNeededConcern: clarification?.concern === true,
        }
      : {}),
  };
}

/**
 * Image size in KB for `size_of_image_kb`. The app reads the picked file's size
 * (`statSize / 1024`); RN has the picker's base64 only, so the size is derived from it.
 */
export function base64SizeKb(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor(((base64.length * 3) / 4 - padding) / 1024));
}
