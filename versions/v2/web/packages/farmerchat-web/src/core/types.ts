/**
 * Request/response models for all 34 main endpoints + token endpoints + Google
 * geolocate (docs/02-api-reference.md). Field names match the wire format.
 */

// ---------------------------------------------------------------------------
// Google Geolocation
// ---------------------------------------------------------------------------

export interface GeoRequestBody {
  considerIp: boolean;
}

export interface GeoResponse {
  location?: { lat: number; lng: number } | null;
  accuracy?: number | null;
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
  dashboard?: boolean | null;
  created_now?: boolean | null;
  ip_location_fallback_time_limit?: number | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// #2 country_wise_supported_languages / #5 get_all_countries
// ---------------------------------------------------------------------------

export interface SupportedLanguage {
  id: number;
  name?: string | null;
  code?: string | null;
  bcpCode?: string | null;
  latnCode?: string | null;
  display_name?: string | null;
  flag?: string | null;
  ttsVoiceName?: string | null;
  asr_enabled?: boolean | null;
  tts_enabled?: boolean | null;
  country_phone_code?: string | null;
}

export interface SupportedLanguageGroup {
  display_name?: string | null;
  flag?: string | null;
  priority_view?: SupportedLanguage[] | null;
  expanded_view?: SupportedLanguage[] | null;
}

export interface CountryItem {
  code?: string | null;
  display_name?: string | null;
  flag?: string | null;
  id?: number | null;
  name?: string | null;
  phone_country_code?: string | null;
  phone_length?: number | null;
  phone_number_pattern?: string | null;
}

// ---------------------------------------------------------------------------
// #3 get_labels — Map<String,String>
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
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// #6 set_preferred_language / #7 accept_terms
// ---------------------------------------------------------------------------

export interface SetPreferredLanguageRequest {
  user_id: string;
  language_id: number;
}

export interface SetPreferredLanguageResponse {
  user_id?: string | null;
  [key: string]: unknown;
}

export interface AcceptPPandTCRequest {
  user_id: string;
}

export interface AcceptPPandTCResponse {
  message?: string | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// #8 update_user_profile / #9 view_user_profile
// ---------------------------------------------------------------------------

export interface LiveStockDetail {
  id?: number | null;
  name?: string | null;
  count?: number | null;
  [key: string]: unknown;
}

export interface UserNameRequest {
  user_id: string;
  name?: string | null;
  age?: number | null;
  farmer_reach_count?: number | null;
  gender?: string | null;
  land_holding?: string | null;
  live_stock_details?: LiveStockDetail[] | null;
  profile_picture?: string | null;
  receive_com_via_whatsapp?: boolean | null;
  role?: string | null;
  specialization?: string | null;
}

export interface UserNameResponse {
  message?: string | null;
  user_id?: string | null;
  name?: string | null;
  [key: string]: unknown;
}

export interface Address {
  display_address?: string | null;
  country?: string | null;
  state?: string | null;
  district?: string | null;
  [key: string]: unknown;
}

export interface Crop {
  id?: number | null;
  name?: string | null;
  crop_id?: number | null;
  [key: string]: unknown;
}

export interface Memory {
  id?: number | null;
  memory?: string | null;
  [key: string]: unknown;
}

export interface Role {
  id?: number | null;
  name?: string | null;
  [key: string]: unknown;
}

export interface FarmlandDetails {
  id?: number | null;
  land_holding?: string | null;
  [key: string]: unknown;
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
  primary_speaking_countries?: string[] | null;
  [key: string]: unknown;
}

export interface UserProfile {
  address?: Address | null;
  age?: number | null;
  country?: string | null;
  crop_details?: Crop[] | null;
  farmland_details?: FarmlandDetails | null;
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
  role?: Role | string | null;
  show_feedback_prompt?: boolean | null;
  specialization?: string | null;
  user_id?: string | null;
}

export interface FarmerProfile {
  userProfile?: UserProfile | null;
  roleAssigned?: boolean | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// #10 update_build_version
// ---------------------------------------------------------------------------

export interface UpdateBuildVersionRequest {
  user_id: string;
}

export interface UpdateBuildVersionResponse {
  message?: string | null;
  [key: string]: unknown;
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
  osm_response?: Record<string, unknown> | null;
}

export interface GetLocationResponse {
  message?: string | null;
  country?: string | null;
  state?: string | null;
  district?: string | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// #12 images/v2/daily — home feed
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
  id?: string | number | null;
  text?: string | null;
}

export interface SectionDto {
  type?: string | null;
  id?: string | null;
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
  meta?: Record<string, unknown> | null;
  unique_key?: string | null;
  label?: string | null;
}

export interface HomeUdfResponse {
  greeting?: string | null;
  sections?: SectionDto[] | null;
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
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// #14 update_crop_details
// ---------------------------------------------------------------------------

export interface CropDetailItem {
  crop_id: number | string;
  [key: string]: unknown;
}

export interface SetCultivatedCropsRequest {
  user_id: string;
  crop_details: CropDetailItem[];
}

export interface CropResponse {
  message?: string | null;
}

// ---------------------------------------------------------------------------
// #15 new_conversation
// ---------------------------------------------------------------------------

export interface NewConversationRequest {
  user_id: string;
  content_provider_id?: number | string | null;
}

export interface NewConversationResponse {
  conversation_id?: string | null;
  message?: string | null;
  show_popup?: boolean | null;
}

// ---------------------------------------------------------------------------
// #16 transcribe_audio (server STT)
// ---------------------------------------------------------------------------

export interface SetVoiceRequest {
  conversation_id: string;
  /** Base64-encoded audio payload. */
  query: string;
  message_reference_id: string;
  input_audio_encoding_format: string;
  triggered_input_type: string;
  editable_transcription: string;
}

export interface GetVoiceResponse {
  heard_input_query?: string | null;
  confidence_score?: number | null;
  error?: boolean | null;
  message_id?: string | null;
  transcription_id?: string | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// #17/#18/#19/#20/#21 OTP auth
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
  [key: string]: unknown;
}

export interface CheckDeviceRequest {
  device_id: string;
  phone?: string | null;
  phone_country_code?: string | null;
  [key: string]: unknown;
}

export interface WhatsappVerificationRequest {
  phone_country_code: string;
  phone: string;
  token: string;
}

export interface CommunicationChannelItem {
  sms_enabled?: boolean | null;
  whatsapp_enabled?: boolean | null;
  [key: string]: unknown;
}

export interface VerifyOtpRequest {
  otp: string;
  phone: string;
  phone_country_code: string;
  guest_onboarding: boolean;
  user_id: string;
}

export interface VerifyOtpResponse {
  access_token?: string | null;
  refresh_token?: string | null;
  user_id?: string | null;
  existing_user?: boolean | null;
  preferred_language?: PreferredLanguage | null;
  message?: string | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// #22 conversation_list (chat history)
// ---------------------------------------------------------------------------

export interface ConversationListItem {
  conversation_id?: string | null;
  /** The API's display text for a conversation (docs/02 / app ConversationListItem). */
  conversation_title?: string | null;
  message_type?: string | null;
  grouping?: string | null;
  created_on?: string | null;
  content_provider_logo?: string | null;
  content_provider_id?: string | number | null;
  content_provider_name?: string | null;
}

/** Custom deserializer target: the API returns either a bare array or a paginated object. */
export interface ConversationListResponse {
  results: ConversationListItem[];
  next_page?: number | null;
  count?: number | null;
}

// ---------------------------------------------------------------------------
// #23 logout
// ---------------------------------------------------------------------------

export interface LogoutResponse {
  message?: string | null;
}

// ---------------------------------------------------------------------------
// #24 faqs (help/support)
// ---------------------------------------------------------------------------

export interface FaqItem {
  id?: number | string | null;
  question?: string | null;
  title?: string | null;
  url?: string | null;
  /** Primary API field name (docs/02 / app FaqItem); underscore is the alternate. */
  'webview-url'?: string | null;
  webview_url?: string | null;
  'open-mode'?: string | null;
  open_mode?: string | null;
  [key: string]: unknown;
}

/** A legal/FAQ web link — the API sends a `{ title, "webview-url", "open-mode" }` object. */
export interface HelpWebLink {
  title?: string | null;
  'webview-url'?: string | null;
  webview_url?: string | null;
  'open-mode'?: string | null;
  open_mode?: string | null;
  [key: string]: unknown;
}

export interface HelpLegal {
  /** Primary API field names (docs/02 / app HelpLegal); underscore forms are alternates. */
  'terms-of-use'?: HelpWebLink | string | null;
  'privacy-policy'?: HelpWebLink | string | null;
  terms_of_use?: HelpWebLink | string | null;
  privacy_policy?: HelpWebLink | string | null;
  [key: string]: unknown;
}

export interface HelpSupportResponse {
  data?: {
    faqs?: FaqItem[] | null;
    legal?: HelpLegal | null;
    mode?: string | null;
  } | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// #25 images/v2/viewed / #26 images/v2/statement
// ---------------------------------------------------------------------------

export interface ImageViewedRequest {
  statement_id: number;
  user_id: string;
  status: 'viewed';
}

export interface ImageViewedResponse {
  message?: string | null;
  [key: string]: unknown;
}

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
  [key: string]: unknown;
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
   * backend needs the user to disambiguate, confirm, or respond to an urgent situation instead of
   * (or before) giving a normal answer. In that case `response` is typically EMPTY and this
   * carries the prompt message plus quick-reply chips. Null for a normal answer.
   */
  alignments?: Alignment | null;
}

/**
 * A short prompt the user answers by tapping a chip, instead of receiving a normal answer
 * (**2.0.0**).
 *
 * `type` selects the visual treatment (see `AlignmentKind` in `./alignment`); `chips` are the
 * quick replies; `original_query` is the query that triggered the surface, kept for context — it
 * is the chip's `value` that gets sent on tap.
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
 * `action` describes how the chip behaves: the value of `CapabilityChip.ACTION_SELECT` —
 * the string `"invoke"`, NOT `"select"` — marks a chip that invokes a device
 * capability (take a photo, share location) rather than sending its text.
 * Those capability flows ARE wired as of 2026-09-02; see the capability
 * constants below and "The capability-chip gap" in docs/04.
 */
export interface AlignmentChip {
  label?: string | null;
  value?: string | null;
  action?: string | null;
}

// ---------------------------------------------------------------------------
// #28 image_analysis ("Plantix")
// ---------------------------------------------------------------------------

export interface PlantixRequest {
  conversation_id: string;
  /** Base64-encoded image. */
  image: string;
  /** App parity: `triggered_input_type` defaults to "image" on the image path. */
  triggered_input_type?: string;
  query?: string | null;
  /** App `PlantixRequest.kt` sends latitude/longitude as STRINGs (not lat/lng numbers). */
  latitude?: string | null;
  longitude?: string | null;
  image_name: string;
  /** True only when the user taps retry on a failed image query. */
  retry?: boolean;
}

export interface PlantixResponse {
  error?: boolean | null;
  message?: string | null;
  message_id?: string | null;
  response?: string | null;
  query?: string | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// #29 follow_up_questions / #30 follow_up_question_click
// ---------------------------------------------------------------------------

export interface FollowUpQuestionsResponse {
  questions?: Array<string | { question?: string | null; id?: string | number | null }> | null;
  clarification_required?: boolean | null;
  [key: string]: unknown;
}

export interface FollowUpClickRequest {
  follow_up_question: string;
}

export interface FollowUpClickResponse {
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
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// #32 conversation_chat_history
// ---------------------------------------------------------------------------

/**
 * message_type_id: 1=query_text, 2=query_audio, 3=response_text,
 * 7=follow_up_questions, 11=input_image.
 */
export interface ConversationChatHistoryMessageItem {
  message_type_id?: number | null;
  message_type?: string | null;
  message_id?: string | null;
  message_input_time?: string | null;
  section_message_id?: string | null;
  query_text?: string | null;
  heard_query_text?: string | null;
  response_text?: string | null;
  /**
   * type-7 follow-up items. The app sends objects
   * `{ follow_up_question_id, sequence, question }` (a plain string form is
   * tolerated defensively).
   */
  questions?: Array<string | { follow_up_question_id?: string | null; sequence?: number | null; question?: string | null }> | null;
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
  [key: string]: unknown;
}

export interface ConversationChatHistoryResponse {
  /** The API's message array key (docs/02 / app ConversationChatHistoryResponse). */
  data?: ConversationChatHistoryMessageItem[] | null;
  messages?: ConversationChatHistoryMessageItem[] | null;
  results?: ConversationChatHistoryMessageItem[] | null;
  next_page?: number | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// #33 add_query_to_history (MoEngage qapair insert)
// ---------------------------------------------------------------------------

export interface FollowUpQuestionsRequestMoengage {
  conversation_id?: string | null;
  query?: string | null;
  response?: string | null;
  follow_up_questions?: string[] | null;
  user_id?: string | null;
  [key: string]: unknown;
}

export interface AddQueryToHistoryResponse {
  message?: string | null;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// #34 user_question_count
// ---------------------------------------------------------------------------

export interface UserQuestionCountResponse {
  total_questions_asked?: number | null;
  bypass_interstitial?: boolean | null;
}

// ---------------------------------------------------------------------------
// Token endpoints (AuthApi)
// ---------------------------------------------------------------------------

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  access_token?: string | null;
  refresh_token?: string | null;
  [key: string]: unknown;
}

export interface SendNewTokenRequest {
  device_id: string;
  user_id: string;
}
