/**
 * Send_Query_Initiated / Send_Query payload. Port of the app's `SendQueryProperties`
 * (fc-compose-agentic `core/analytics/SendQueryAnalytics.kt`), its property keys
 * (`core/analytics/AnalyticsProps.kt:44-75`) and the ViewModel helpers that stamp it
 * (`ui/chat/ChatViewModel.kt:115-176`: `buildMinimalSendQueryProps`, `manualSendChipContext`,
 * `withResponseChipStatus`).
 *
 * The app fires Send_Query_Initiated when the farmer sends, keeps the same props as
 * `pendingSendQueryProperties`, and fires Send_Query ONCE when the answer settles — with
 * `Valid_Query: true` plus the intent fields on success, `Valid_Query: false` on failure. React-free.
 */

/** AnalyticsProps.kt:61-65 — `agentic_chip_status` values. */
export const ChipStatus = {
  SELECTED: 'selected',
  SKIPPED: 'skipped',
  AVAILABLE: 'available',
  NONE: 'none',
} as const;

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
  // Send_Query only (from the response)
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

const blank = (s: string | null | undefined): string => (s && s.trim().length > 0 ? s : '');

/** `SendQueryProperties.toAnalyticsProperties()` — same keys, same derivations, same order. */
export function toAnalyticsProperties(p: SendQueryProps): Record<string, unknown> {
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
                      : blank(p.channel)
                        ? p.channel!
                        : type;
  const status = blank(p.agenticChipStatus) || (p.isAlignmentChip ? ChipStatus.SELECTED : ChipStatus.NONE);
  const out: Record<string, unknown> = {
    screen_name: p.screenName,
    followup_prompt: p.isFollowupPrompt,
    image_query: p.isImageQuery,
    text_query: p.isTextQuery,
    voice_query: p.isVoiceQuery,
    weather_advice_cta: p.isWeatherAdviceCTA ?? false,
    length_of_audio_in_seconds: p.isVoiceQuery ? (p.lengthOfAudioInSeconds ?? 0) : 0,
    length_of_Text_query: p.isTextQuery ? (p.lengthOfTextQuery ?? 0) : 0,
    size_of_image_kb: p.isImageQuery ? (p.sizeOfImageKb ?? 0) : 0,
    audio_format: p.isVoiceQuery && blank(p.audioFormat) ? p.audioFormat : '',
    isOnnboarding_query: p.isOnboardingQuery ?? false,
    type,
    click_type: clickType,
    agentic_chip_status: status,
    agentic_chip_skipped_type: p.agenticChipStatus === ChipStatus.SKIPPED ? blank(p.agenticChipSkippedType) : '',
    agentic_chip_shown_type: p.agenticChipStatus === ChipStatus.AVAILABLE ? blank(p.agenticChipShownType) : '',
    agentic_chip_type: blank(p.agenticChipType),
    agentic_chip_value: blank(p.agenticChipValue),
    agentic_chip_label: blank(p.agenticChipLabel),
  };
  if (p.isValidQuery !== undefined && p.isValidQuery !== null) out.Valid_Query = p.isValidQuery;
  out.asset_type = blank(p.assetType);
  out.asset_name = blank(p.assetName);
  out.concern = blank(p.concern);
  out.stage = blank(p.stage);
  out.intent = blank(p.intent);
  out.clarification_needed_asset = p.clarificationNeededAsset ?? false;
  out.clarification_needed_concern = p.clarificationNeededConcern ?? false;
  return out;
}

/**
 * `manualSendChipContext` (ChatViewModel.kt:148-157): for a typed / voice / image send, `skipped`
 * + the surface kind when the latest AI response is an alignment surface whose chips are still
 * unpicked; else `none`. Call BEFORE the new user message is added.
 */
export function manualSendChipContext(lastAi: {
  analyticsType: string | null;
  chipCount: number;
  selectedCount: number;
} | null): { status: string; skippedType: string | null } {
  if (lastAi && lastAi.analyticsType && lastAi.chipCount > 0 && lastAi.selectedCount === 0) {
    return { status: ChipStatus.SKIPPED, skippedType: lastAi.analyticsType };
  }
  return { status: ChipStatus.NONE, skippedType: null };
}

/**
 * `withResponseChipStatus` (ChatViewModel.kt:168-176): on Send_Query, a response that shows chips
 * upgrades a `none` / unset status to `available` with `agentic_chip_shown_type`; `selected` and
 * `skipped` are kept.
 */
export function withResponseChipStatus(p: SendQueryProps, shownChipType: string | null | undefined): SendQueryProps {
  if (shownChipType && (!p.agenticChipStatus || p.agenticChipStatus === ChipStatus.NONE)) {
    return { ...p, agenticChipStatus: ChipStatus.AVAILABLE, agenticChipShownType: shownChipType };
  }
  return p;
}

/** The intent block on a #27 / #27a answer (app `IntentClassificationOutput`, TextPromptResponse.kt:167-199). */
export interface IntentOutputLike {
  asset_type?: string | null;
  asset_name?: string | null;
  concern?: string | null;
  stage?: string | null;
  intent?: string | null;
  clarification_needed?: { asset?: boolean | null; concern?: boolean | null } | boolean | null;
}

/** Send_Query success fields (ChatViewModel.kt:1706-1721, 2028-2042). */
export function withValidResponse(p: SendQueryProps, intentOut: IntentOutputLike | null | undefined, questionLength?: number): SendQueryProps {
  const clar = intentOut?.clarification_needed;
  const clarObj = clar && typeof clar === 'object' ? clar : null;
  return {
    ...p,
    ...(questionLength !== undefined ? { lengthOfTextQuery: questionLength } : {}),
    isValidQuery: true,
    assetType: intentOut?.asset_type ?? null,
    assetName: intentOut?.asset_name ?? null,
    concern: intentOut?.concern ?? null,
    stage: intentOut?.stage ?? null,
    intent: intentOut?.intent ?? null,
    clarificationNeededAsset: clarObj?.asset === true,
    clarificationNeededConcern: clarObj?.concern === true,
  };
}
