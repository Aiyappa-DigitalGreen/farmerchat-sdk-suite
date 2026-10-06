/**
 * All request/response models from docs/02-api-reference.md — every endpoint (#1–#34),
 * the token endpoints and the Google geolocate call. Field names match the backend JSON.
 */

// ---------------------------------------------------------------------------
// Google Geolocation (language auto-detect fallback)
// ---------------------------------------------------------------------------

export interface GeoRequestBody {
  considerIp: boolean;
}

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface GeoResponse {
  location: GeoLocation;
  accuracy: number;
}

// ---------------------------------------------------------------------------
// #1 initialize_user (guest init)
// ---------------------------------------------------------------------------

export interface InitializeGuestUserRequest {
  device_id: string;
  lat?: number | null;
  long?: number | null;
  accuracy?: number | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  moengage_id?: string | null;
  google_advertise_id?: string | null;
}

export interface InitializeGuestUserResponse {
  access_token: string;
  refresh_token: string;
  user_id?: string | null;
  /** Wire value is the *string* `"True"`/`"False"`, not a JSON bool. Coerce before testing. */
  show_crops_livestocks?: boolean | string | null;
  country_code?: string | null;
  country?: string | null;
  state?: string | null;
  dashboard?: string | null;
  created_now?: boolean | null;
  ip_location_fallback_time_limit?: number | null;
  message?: string | null;
}

// ---------------------------------------------------------------------------
// #2 country_wise_supported_languages
// ---------------------------------------------------------------------------

export interface SupportedLanguage {
  id: number;
  name: string;
  code: string;
  bcpCode?: string | null;
  latnCode?: string | null;
  display_name: string;
  flag?: string | null;
  ttsVoiceName?: string | null;
  asr_enabled?: boolean | null;
  tts_enabled?: boolean | null;
  country_phone_code?: string | null;
}

export interface SupportedLanguageGroup {
  display_name?: string | null;
  flag?: string | null;
  priority_view: SupportedLanguage[];
  expanded_view: SupportedLanguage[];
}

// ---------------------------------------------------------------------------
// #3 get_labels — Map<String, String>
// ---------------------------------------------------------------------------

export type LabelsResponse = Record<string, string>;

// ---------------------------------------------------------------------------
// #4 privacy_policy
// ---------------------------------------------------------------------------

export interface PrivacyPolicyResponse {
  privacy_policy?: string | null;
  terms_of_use?: string | null;
  privacy_policy_url?: string | null;
  terms_of_use_url?: string | null;
  message?: string | null;
}

// ---------------------------------------------------------------------------
// #5 get_all_countries
// ---------------------------------------------------------------------------

export interface CountryItem {
  code: string;
  display_name: string;
  flag?: string | null;
  id: number;
  name: string;
  phone_country_code: string;
  phone_length?: number | null;
  phone_number_pattern?: string | null;
}

// ---------------------------------------------------------------------------
// #6 set_preferred_language
// ---------------------------------------------------------------------------

export interface SetPreferredLanguageRequest {
  user_id: string;
  language_id: number;
}

export interface SetPreferredLanguageResponse {
  user_id?: string | null;
  message?: string | null;
}

// ---------------------------------------------------------------------------
// #7 accept_terms
// ---------------------------------------------------------------------------

export interface AcceptPPandTCRequest {
  user_id: string;
}

export interface AcceptPPandTCResponse {
  message?: string | null;
  user_id?: string | null;
}

// ---------------------------------------------------------------------------
// #8 update_user_profile — UserNameRequest
// ---------------------------------------------------------------------------

export interface LiveStockDetail {
  id?: number | null;
  name?: string | null;
  count?: number | null;
}

export interface UserNameRequest {
  age?: number | null;
  farmer_reach_count?: number | null;
  gender?: string | null;
  land_holding?: string | null;
  live_stock_details?: LiveStockDetail[] | null;
  name?: string | null;
  profile_picture?: string | null;
  receive_com_via_whatsapp?: boolean | null;
  role?: string | null;
  specialization?: string | null;
  user_id: string;
}

export interface UserNameResponse {
  message?: string | null;
  user_id?: string | null;
  name?: string | null;
}

// ---------------------------------------------------------------------------
// #9 view_user_profile — FarmerProfile
// ---------------------------------------------------------------------------

export interface Address {
  city?: string | null;
  country?: string | null;
  district?: string | null;
  state?: string | null;
  street?: string | null;
  pincode?: string | null;
}

export interface Crop {
  id: number;
  name?: string | null;
  image_url?: string | null;
}

export interface Memory {
  id?: number | null;
  memory?: string | null;
  created_at?: string | null;
}

export interface Role {
  id?: number | null;
  name?: string | null;
}

export interface FarmlandDetails {
  id?: number | null;
  land_holding?: string | null;
  irrigation_type?: string | null;
  soil_type?: string | null;
}

export interface UserProfile {
  address?: Address | null;
  age?: number | null;
  country?: string | null;
  crop_details?: Crop[] | null;
  farmland_details?: FarmlandDetails[] | null;
  first_name?: string | null;
  last_name?: string | null;
  gender?: string | null;
  geography_level2?: string | null;
  // Present in the app's `FarmerProfile` (#9) and in android's `ProfileUser`, but omitted from
  // this port until now. They are the readable place names the Home location pill needs — the
  // bare `geography_level2` is an id — so the profile fetch could not backfill without them.
  geography_level2_name?: string | null;
  country_name?: string | null;
  geography_level3?: string | null;
  geography_level4?: string | null;
  geography_level5?: string | null;
  geography_level6?: string | null;
  id?: number | null;
  land_holding?: string | null;
  lat?: number | null;
  long?: number | null;
  live_stock_details?: LiveStockDetail[] | null;
  llm_model?: string | null;
  memory?: Memory[] | null;
  preferred_language?: PreferredLanguage | null;
  phone?: string | null;
  phone_country_code?: string | null;
  profile_picture?: string | null;
  receive_com_via_whatsapp?: boolean | null;
  role?: Role | null;
  show_feedback_prompt?: boolean | null;
  specialization?: string | null;
  user_id?: string | null;
}

export interface FarmerProfile {
  userProfile?: UserProfile | null;
  roleAssigned?: boolean | null;
  message?: string | null;
}

// ---------------------------------------------------------------------------
// #10 update_build_version
// ---------------------------------------------------------------------------

export interface UpdateBuildVersionRequest {
  user_id: string;
}

export interface UpdateBuildVersionResponse {
  message?: string | null;
}

// ---------------------------------------------------------------------------
/**
 * True for feed sections the SDK deliberately cannot render (third-party host widgets).
 *
 * `plotline_widget` sections carry only `type`/`unique_key`/`label` — no headline, image or
 * statement id (verified live 2026-09-01: 14 of 21 prod sections were these). The app renders
 * them with Plotline, but root CLAUDE.md §6 forbids Plotline inside SDK packages, so the SDK
 * drops them rather than rendering blank cards.
 */
export function isHostOnlyWidget(section: { type?: string | null }): boolean {
  return (section.type ?? '').toLowerCase() === 'plotline_widget';
}

/** Feed sections with host-unrenderable widgets removed. Use for rendering AND analytics. */
export function renderableSections<T extends { type?: string | null }>(
  sections: T[] | null | undefined,
): T[] {
  return (sections ?? []).filter((s) => !isHostOnlyWidget(s));
}

// #11 update_user_location
// ---------------------------------------------------------------------------

export interface OsmAddress {
  village?: string | null;
  county?: string | null;
  state_district?: string | null;
  state?: string | null;
  postcode?: string | null;
  country?: string | null;
  country_code?: string | null;
  [key: string]: unknown;
}

export interface OsmResponse {
  place_id?: number | null;
  licence?: string | null;
  lat?: string | null;
  lon?: string | null;
  display_name?: string | null;
  address?: OsmAddress | null;
  [key: string]: unknown;
}

export interface UpdateLocationRequest {
  lat?: number | null;
  long?: number | null;
  user_id: string;
  country?: string | null;
  level_2?: string | null;
  level_3?: string | null;
  level_4?: string | null;
  level_5?: string | null;
  level_6?: string | null;
  display_address?: string | null;
  osm_response?: OsmResponse | null;
}

export interface GetLocationResponse {
  message?: string | null;
  country?: string | null;
  state?: string | null;
  district?: string | null;
}

// ---------------------------------------------------------------------------
// #12 images/v2/daily — HomeUdfResponse
// ---------------------------------------------------------------------------

export interface SectionBadge {
  icon?: string | null;
  count?: number | null;
  show?: boolean | null;
}

export interface SectionCta {
  text?: string | null;
  action?: string | null;
}

export interface SectionOption {
  id: string;
  text: string;
}

export interface SectionMeta {
  [key: string]: unknown;
}

export interface SectionDto {
  type?: string | null;
  id: string;
  image_url?: string | null;
  title?: string | null;
  question_text?: string | null;
  statement_id?: number | null;
  badge?: SectionBadge | null;
  cta?: SectionCta | null;
  statement?: string | null;
  selection_type?: string | null;
  options?: SectionOption[] | null;
  statement_type?: string | null;
  is_viewed?: boolean | null;
  meta?: SectionMeta | null;
  unique_key?: string | null;
  label?: string | null;
}

export interface HomeUdfResponse {
  greeting?: string | null;
  sections: SectionDto[];
  ssfr_enable?: boolean | null;
}

// ---------------------------------------------------------------------------
// #13 weather_forecast_lite
// ---------------------------------------------------------------------------

export interface WeatherRequest {
  user_id: string;
}

export interface WeatherResponse {
  // App parity (WeatherResponse.kt): Strings, rendered verbatim (was number).
  current_temp?: string | null;
  precipitation_probability?: string | null;
  weather_icon?: string | null;
  message?: string | null;
}

// ---------------------------------------------------------------------------
// #14 update_crop_details
// ---------------------------------------------------------------------------

export interface CropDetailEntry {
  crop_id: number;
}

export interface SetCultivatedCropsRequest {
  user_id: string;
  crop_details: CropDetailEntry[];
}

export interface CropResponse {
  message?: string | null;
}

// ---------------------------------------------------------------------------
// #15 new_conversation
// ---------------------------------------------------------------------------

export interface NewConversationRequest {
  user_id: string;
  content_provider_id?: number | null;
}

export interface NewConversationResponse {
  conversation_id: string;
  message?: string | null;
  show_popup?: boolean | null;
}

// ---------------------------------------------------------------------------
// #16 transcribe_audio (server STT)
// ---------------------------------------------------------------------------

export interface SetVoiceRequest {
  conversation_id: string;
  /** base64 audio */
  query: string;
  message_reference_id: string;
  input_audio_encoding_format: string;
  triggered_input_type: string;
  editable_transcription: string; // "True"
}

export interface GetVoiceResponse {
  heard_input_query?: string | null;
  confidence_score?: number | null;
  error?: boolean | null;
  message?: string | null;
  message_id?: string | null;
  transcription_id?: string | null;
}

// ---------------------------------------------------------------------------
// #17 generate_otp / #18 check_device_user_limit
// ---------------------------------------------------------------------------

export interface SendOtpRequest {
  phone: string;
  phone_country_code: string;
  channel: string[];
  device_id: string;
  user_id: string;
}

export interface SendOtpResponse {
  message?: string | null;
  otp?: string | null;
  error?: boolean | null;
  status?: string | null;
}

export interface CheckDeviceRequest {
  device_id: string;
  phone?: string | null;
  phone_country_code?: string | null;
}

// ---------------------------------------------------------------------------
// #19 verify_otp_less_android_sdk_token (WhatsApp OTP-less)
// ---------------------------------------------------------------------------

export interface WhatsappVerificationRequest {
  phone_country_code: string;
  phone: string;
  token: string;
}

// ---------------------------------------------------------------------------
// #20 communication_channel
// ---------------------------------------------------------------------------

export interface CommunicationChannelItem {
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
}

export type CommunicationChannelResponse = CommunicationChannelItem[];

// ---------------------------------------------------------------------------
// #21 verify_otp
// ---------------------------------------------------------------------------

export interface VerifyOtpRequest {
  otp: string;
  phone: string;
  phone_country_code: string;
  guest_onboarding: boolean;
  user_id: string;
}

export interface PreferredLanguage {
  asr_bcp_code?: string | null;
  asr_enabled?: boolean | null;
  tts_bcp_code?: string | null;
  tts_enabled?: boolean | null;
  tts_voice_name?: string | null;
  code?: string | null;
  display_name?: string | null;
  id?: number | null;
  name?: string | null;
  primary_speaking_countries?: string[] | null;
}

export interface VerifyOtpResponse {
  access_token?: string | null;
  refresh_token?: string | null;
  existing_user?: boolean | null;
  user_id?: string | null;
  message?: string | null;
  error?: boolean | null;
  preferred_language?: PreferredLanguage | null;
  name?: string | null;
}

// ---------------------------------------------------------------------------
// #22 conversation_list — dual format (custom deserializer in the app):
// either a bare array of conversations or a paginated object.
// ---------------------------------------------------------------------------

// Field names mirror the app's ConversationListItem.kt exactly (docs/02).
export interface ConversationListItem {
  conversation_id: string;
  conversation_title?: string | null;
  created_on?: string | null;
  message_type?: string | null;
  grouping?: string | null;
  content_provider_logo?: string | null;
  content_provider_id?: string | null;
  content_provider_name?: string | null;
}

export interface PaginatedConversationList {
  results: ConversationListItem[];
  count?: number | null;
  next?: string | number | null;
  previous?: string | number | null;
  total_pages?: number | null;
  current_page?: number | null;
}

/** Union replicating the app's custom deserializer: bare-array or paginated object. */
export type ConversationListResponse =
  | ConversationListItem[]
  | PaginatedConversationList;

export interface NormalizedConversationList {
  items: ConversationListItem[];
  nextPage: number | null;
}

export function normalizeConversationList(
  response: ConversationListResponse,
  currentPage: number,
): NormalizedConversationList {
  if (Array.isArray(response)) {
    return { items: response, nextPage: null };
  }
  let nextPage: number | null = null;
  if (response.next !== null && response.next !== undefined) {
    if (typeof response.next === 'number') {
      nextPage = response.next;
    } else {
      const match = /[?&]page=(\d+)/.exec(response.next);
      nextPage = match && match[1] ? parseInt(match[1], 10) : currentPage + 1;
    }
  } else if (
    typeof response.total_pages === 'number' &&
    currentPage < response.total_pages
  ) {
    nextPage = currentPage + 1;
  }
  return { items: response.results ?? [], nextPage };
}

// ---------------------------------------------------------------------------
// #23 logout
// ---------------------------------------------------------------------------

export interface LogoutResponse {
  message?: string | null;
}

// ---------------------------------------------------------------------------
// #24 faqs — Help/FAQ
// ---------------------------------------------------------------------------

export interface FaqItem {
  id?: number | null;
  question?: string | null;
  title?: string | null;
  // App parity (HelpSupportResponse.kt): FAQ link is `webview-url` (alt `webview_url`),
  // not a flat `url`; `open-mode` controls presentation.
  'webview-url'?: string | null;
  webview_url?: string | null;
  'open-mode'?: string | null;
  lang?: string | null;
}

export interface HelpLegalLink {
  'webview-url'?: string | null;
  webview_url?: string | null;
}

export interface HelpLegal {
  // App parity: nested `terms-of-use` / `privacy-policy` objects, each with a webview-url.
  'terms-of-use'?: HelpLegalLink | null;
  'privacy-policy'?: HelpLegalLink | null;
}

export interface HelpSupportData {
  faqs: FaqItem[];
  legal?: HelpLegal | null;
  mode?: string | null;
}

export interface HelpSupportResponse {
  data?: HelpSupportData | null;
  message?: string | null;
}

// ---------------------------------------------------------------------------
// #25 images/v2/viewed
// ---------------------------------------------------------------------------

export interface ImageViewedRequest {
  statement_id: number;
  user_id: string;
  status: 'viewed';
}

export interface ImageViewedResponse {
  message?: string | null;
}

// ---------------------------------------------------------------------------
// #26 images/v2/statement — card pre-generated answer
// ---------------------------------------------------------------------------

export interface ImageStatementRequest {
  statement_id: number;
  triggered_input_type: string;
}

export interface ImageStatementResponse {
  short_answer?: string | null;
  // App parity: #26 sends follow-up OBJECTS {follow_up_question_id, sequence, question};
  // a bare string is tolerated. (Was `string[]`, which rendered [object Object].)
  follow_up_questions?:
    | Array<string | { follow_up_question_id?: string | null; sequence?: number | null; question?: string | null }>
    | null;
  message_id?: string | null;
  conversation_id?: string | null;
  message?: string | null;
}

// ---------------------------------------------------------------------------
// #27 get_answer_for_text_query — main AI answer
// ---------------------------------------------------------------------------

export interface TextPromptRequest {
  query: string;
  conversation_id: string;
  message_id: string;
  statement_id?: number | null;
  weather_cta_triggered: boolean;
  triggered_input_type: string;
  ssfr_crop?: string | null;
  use_entity_extraction: boolean;
  transcription_id?: string | null;
  retry: boolean;
}

export interface IntentClassificationOutput {
  clarification_needed?: boolean | null;
  concern?: string | null;
  confidence?: number | null;
  intent?: string | null;
  rephrased_query?: string | null;
  [key: string]: unknown;
}

export interface TextPromptResponse {
  error?: boolean | null;
  message?: string | null;
  message_id?: string | null;
  query?: string | null;
  response?: string | null;
  resource_url?: string | null;
  translated_response?: string | null;
  /** Always null in practice — real follow-ups come from endpoint #29. */
  follow_up_questions?: string[] | null;
  section_message_id?: string | null;
  actual_content_provider?: string | null;
  content_provider_logo?: string | null;
  hide_feedback_icons?: boolean | null;
  hide_follow_up_question?: boolean | null;
  hide_share_icon?: boolean | null;
  hide_tts_speaker?: boolean | null;
  hide_source?: boolean | null;
  points?: number | null;
  intent_classification_output?: IntentClassificationOutput | null;
  /**
   * Server-driven alignment surface (clarify / confirm / escalate) — **2.0.0**. Present when the
   * backend needs the user to disambiguate, confirm, or respond to an urgent situation instead
   * of (or before) giving a normal answer. In that case {@link TextPromptResponse.response} is
   * typically EMPTY and this carries the prompt message plus quick-reply chips. Null for a
   * normal answer.
   *
   * Arrives on the synchronous #27 response and on the agentic #27a `metadata` event alike, so
   * it is NOT gated on `enableAgenticChat`.
   */
  alignments?: Alignment | null;
}

// ---------------------------------------------------------------------------
// Alignment surfaces (2.0.0) — port of Android core `ChatModels.kt`
// ---------------------------------------------------------------------------

/**
 * A short prompt the user answers by tapping a chip, instead of receiving a normal answer.
 *
 * `type` selects the visual treatment (see {@link AlignmentKind}); `chips` are the quick
 * replies; `original_query` is the query that triggered the surface, kept for context — it is
 * the chip's `value` that gets sent on tap.
 */
export interface Alignment {
  type?: string | null;
  message?: string | null;
  chips?: AlignmentChip[] | null;
  original_query?: string | null;
  /** True when the backend needs this answered before it can proceed. */
  blocking?: boolean | null;
  /** Backend intent tag (e.g. "capability", "profile"); informational for the client. */
  intent?: string | null;
}

/**
 * One quick-reply chip. `label` is shown, `value` is sent on tap.
 *
 * `action` describes how the chip behaves. A chip whose action is
 * {@link AlignmentChipWire.ACTION_SELECT} on one of the two CAPABILITY surfaces
 * (`gps-prompt` / `upload-photo`) does NOT send its own text as the question — it invokes a
 * device capability and only the OUTCOME is sent (see {@link routeAlignmentChip}). Every other
 * chip, the decline chip included, sends its `value` (falling back to `label`) as a follow-up.
 */
export interface AlignmentChip {
  label?: string | null;
  value?: string | null;
  action?: string | null;
}

/**
 * Wire values for the capability chips, copied verbatim from the app's
 * `domain/model/chat/TextPromptResponse.kt` (and 1:1 with the Android core's
 * `AlignmentChip` companion constants).
 *
 * Note {@link AlignmentChipWire.ACTION_SELECT} is the string `"invoke"`, not `"select"`, and
 * {@link AlignmentChipWire.VALUE_SHARE_LOCATION} is `"share_precise_location"` — the app has a
 * `share_location` constant commented out directly above it. Do NOT "normalize" either one: a
 * mismatch fails silently, the chip falls through to the text path, and the farmer sends the
 * string "share_precise_location" as their question.
 */
export const AlignmentChipWire = {
  /** `action` marking a chip that invokes a capability rather than sending text. */
  ACTION_SELECT: 'invoke',

  /** GPS_PROMPT: start the location flow, then send the original query. */
  VALUE_SHARE_LOCATION: 'share_precise_location',

  /** UPLOAD_PHOTO: open the camera / the gallery. */
  VALUE_TAKE_PHOTO: 'take_photo',
  VALUE_CHOOSE_FROM_GALLERY: 'choose_from_gallery',

  /** The decline chip on a capability prompt. */
  VALUE_NOT_NOW: 'not_now',
} as const;

/** Where a tapped alignment chip goes. Anything but `text` invokes a device capability. */
export const AlignmentChipRoutes = {
  LOCATION: 'location',
  CAMERA: 'camera',
  GALLERY: 'gallery',
  TEXT: 'text',
} as const;

export type AlignmentChipRoute =
  (typeof AlignmentChipRoutes)[keyof typeof AlignmentChipRoutes];

/**
 * The capability-chip routing rule — the single place that decides whether a chip tap invokes a
 * capability or sends text.
 *
 * Port of the app's `onAlignmentChipClick` (`ui/chat/ChatScreen.kt`) and of the `when` block in
 * the Android SDK's Compose/Views chip handlers. Kept in core (rather than duplicated in the
 * screen, as Android does) so the UI and the tests exercise the SAME function.
 *
 * A capability fires only when all three agree: the surface KIND is a capability prompt, the
 * `action` is exactly `invoke`, and the `value` belongs to that kind. Everything else — a
 * decline chip (`not_now`), a chip with no action, a capability value on the wrong surface, any
 * non-capability surface — sends text, which is the 1.0.0 behaviour.
 */
export function routeAlignmentChip(
  kind: AlignmentKind | null,
  chip: AlignmentChip,
): AlignmentChipRoute {
  const isInvoke = chip.action === AlignmentChipWire.ACTION_SELECT;
  const isPhoto = kind === AlignmentKinds.UPLOAD_PHOTO && isInvoke;
  if (
    kind === AlignmentKinds.GPS_PROMPT &&
    isInvoke &&
    chip.value === AlignmentChipWire.VALUE_SHARE_LOCATION
  ) {
    return AlignmentChipRoutes.LOCATION;
  }
  if (isPhoto && chip.value === AlignmentChipWire.VALUE_TAKE_PHOTO) {
    return AlignmentChipRoutes.CAMERA;
  }
  if (isPhoto && chip.value === AlignmentChipWire.VALUE_CHOOSE_FROM_GALLERY) {
    return AlignmentChipRoutes.GALLERY;
  }
  return AlignmentChipRoutes.TEXT;
}

/** The alignment surfaces the backend can ask for. */
export const AlignmentKinds = {
  CLARIFY: 'CLARIFY',
  CONFIRM: 'CONFIRM',
  ESCALATE: 'ESCALATE',
  GPS_PROMPT: 'GPS_PROMPT',
  UPLOAD_PHOTO: 'UPLOAD_PHOTO',
  GENDER_SELECT: 'GENDER_SELECT',
  COMMODITY_CONFIRM: 'COMMODITY_CONFIRM',
} as const;

export type AlignmentKind = (typeof AlignmentKinds)[keyof typeof AlignmentKinds];

/** Wire `type` → kind. Null for an unknown or absent type: render as a normal answer. */
export function alignmentKindFromType(
  type: string | null | undefined,
): AlignmentKind | null {
  switch (type?.trim().toLowerCase()) {
    case 'alignment-clarify':
      return AlignmentKinds.CLARIFY;
    case 'alignment-confirm':
      return AlignmentKinds.CONFIRM;
    case 'alignment-escalate':
      return AlignmentKinds.ESCALATE;
    case 'gps-prompt':
      return AlignmentKinds.GPS_PROMPT;
    case 'upload-photo':
      return AlignmentKinds.UPLOAD_PHOTO;
    case 'gender-select':
      return AlignmentKinds.GENDER_SELECT;
    case 'commodity-confirm':
      return AlignmentKinds.COMMODITY_CONFIRM;
    default:
      return null;
  }
}

/**
 * Additive surfaces accompany a normal answer — they render BELOW it as an optional nudge and
 * never suppress the answer or its follow-ups. Exclusive surfaces (clarify / confirm / escalate
 * / capability prompts) own the message area and replace the answer.
 *
 * The backend marks the additive ones non-blocking (`blocking:false`, `intent:"profile"`). Both
 * are single-select: one tap sends immediately and locks the card.
 */
export function isAdditiveAlignment(kind: AlignmentKind): boolean {
  return kind === AlignmentKinds.GENDER_SELECT || kind === AlignmentKinds.COMMODITY_CONFIRM;
}

/**
 * The exact wire `type` string, reported as the `agentic_chip_type` analytics property so
 * funnels can be segmented by which surface was tapped. Keep these stable and in sync with
 * {@link alignmentKindFromType} — dashboards depend on them.
 */
export function alignmentAnalyticsType(kind: AlignmentKind): string {
  switch (kind) {
    case AlignmentKinds.CLARIFY:
      return 'alignment-clarify';
    case AlignmentKinds.CONFIRM:
      return 'alignment-confirm';
    case AlignmentKinds.ESCALATE:
      return 'alignment-escalate';
    case AlignmentKinds.GPS_PROMPT:
      return 'gps-prompt';
    case AlignmentKinds.UPLOAD_PHOTO:
      return 'upload-photo';
    case AlignmentKinds.GENDER_SELECT:
      return 'gender-select';
    case AlignmentKinds.COMMODITY_CONFIRM:
      return 'commodity-confirm';
  }
}

// ---------------------------------------------------------------------------
// #28 image_analysis (Plantix)
// ---------------------------------------------------------------------------

export interface PlantixRequest {
  conversation_id: string;
  /** base64 image */
  image: string;
  /** App parity: defaults to "image" on the image path. */
  triggered_input_type?: string;
  query?: string | null;
  /** App `PlantixRequest.kt` sends latitude/longitude as STRINGs (not lat/lng numbers). */
  latitude?: string | null;
  longitude?: string | null;
  image_name: string;
  /** True only when the user retries a failed image query. */
  retry?: boolean;
}

export interface PlantixResponse {
  error?: boolean | null;
  message?: string | null;
  message_id?: string | null;
  response?: string | null;
  query?: string | null;
  crop_name?: string | null;
  disease_name?: string | null;
  image_url?: string | null;
  hide_tts_speaker?: boolean | null;
  hide_share_icon?: boolean | null;
  hide_source?: boolean | null;
  actual_content_provider?: string | null;
  content_provider_logo?: string | null;
}

// ---------------------------------------------------------------------------
// #29 follow_up_questions
// ---------------------------------------------------------------------------

export interface FollowUpQuestionItem {
  id?: string | null;
  question?: string | null;
}

export interface FollowUpQuestionsResponse {
  questions?: Array<string | FollowUpQuestionItem> | null;
  clarification_required?: boolean | null;
  message?: string | null;
}

// ---------------------------------------------------------------------------
// #30 follow_up_question_click
// ---------------------------------------------------------------------------

export interface FollowUpQuestionClickRequest {
  follow_up_question: string;
}

export interface FollowUpQuestionClickResponse {
  message?: string | null;
}

// ---------------------------------------------------------------------------
// #31 synthesise_audio (server TTS)
// ---------------------------------------------------------------------------

export interface SynthesiseAudioRequest {
  message_id: string;
  text: string;
  user_id: string;
}

export interface SynthesiseAudioResponse {
  audio?: string | null;
  message?: string | null;
}

// ---------------------------------------------------------------------------
// #32 conversation_chat_history
// ---------------------------------------------------------------------------

/**
 * message_type_id: 1=query_text, 2=query_audio, 3=response_text,
 * 7=follow_up_questions, 11=input_image
 */
/** History follow-up entry (app's ConversationChatHistoryQuestion.kt). */
export interface ConversationChatHistoryQuestion {
  follow_up_question_id: string;
  sequence?: number | null;
  question: string;
}

export interface ConversationChatHistoryMessageItem {
  message_type_id: number;
  message_type?: string | null;
  message_id?: string | null;
  message_input_time?: string | null;
  section_message_id?: string | null;
  query_text?: string | null;
  heard_query_text?: string | null;
  response_text?: string | null;
  // The app returns follow-ups as objects; accept strings too for resilience.
  questions?: Array<string | ConversationChatHistoryQuestion> | null;
  query_media_file_url?: string | null;
  reaction?: number | null;
  response_media_file_url?: string | null;
  resource_id?: number | null;
  resource_url?: string | null;
  actual_content_provider?: string | null;
  content_provider_logo?: string | null;
  hide_source?: boolean | null;
  hide_tts_speaker?: boolean | null;
  clarification_required?: boolean | null;
}

export interface ConversationChatHistoryResponse {
  // The app's ConversationChatHistoryResponse.kt returns the messages under `data`.
  data?: ConversationChatHistoryMessageItem[] | null;
  messages?: ConversationChatHistoryMessageItem[] | null;
  results?: ConversationChatHistoryMessageItem[] | null;
  next?: string | number | null;
  previous?: string | number | null;
  total_pages?: number | null;
  current_page?: number | null;
  conversation_id?: string | null;
  message?: string | null;
}

// ---------------------------------------------------------------------------
// #33 add_query_to_history (MoEngage qapair insert)
// ---------------------------------------------------------------------------

export interface FollowUpQuestionsRequestMoengage {
  user_id: string;
  conversation_id: string;
  query: string;
  response: string;
  follow_up_questions?: string[] | null;
}

export interface AddQueryToHistoryResponse {
  message?: string | null;
  message_id?: string | null;
}

// ---------------------------------------------------------------------------
// #34 user_question_count
// ---------------------------------------------------------------------------

export interface UserQuestionCountResponse {
  total_questions_asked?: number | null;
  bypass_interstitial?: boolean | null;
}

// ---------------------------------------------------------------------------
// Token endpoints (AuthApi — called from the authenticator)
// ---------------------------------------------------------------------------

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  message?: string | null;
}

export interface SendNewTokenRequest {
  device_id: string;
  user_id: string;
}
