/**
 * All 34 main endpoints + Google geolocate, with the app's exact paths,
 * methods and ApiPriority assignments (docs/02-api-reference.md).
 */

import { HttpClient, ApiResult } from './http';
import { GEOLOCATE_URL } from './config';
import type {
  AcceptPPandTCRequest,
  AcceptPPandTCResponse,
  AddQueryToHistoryResponse,
  CheckDeviceRequest,
  CommunicationChannelItem,
  ConversationChatHistoryResponse,
  ConversationListItem,
  ConversationListResponse,
  CropResponse,
  FarmerProfile,
  FollowUpClickResponse,
  FollowUpQuestionsRequestMoengage,
  FollowUpQuestionsResponse,
  GeoResponse,
  GetLocationResponse,
  GetVoiceResponse,
  HelpSupportResponse,
  HomeUdfResponse,
  ImageStatementRequest,
  ImageStatementResponse,
  ImageViewedRequest,
  ImageViewedResponse,
  InitializeGuestUserRequest,
  InitializeGuestUserResponse,
  LabelsResponse,
  LogoutResponse,
  NewConversationRequest,
  NewConversationResponse,
  PlantixRequest,
  PlantixResponse,
  PrivacyPolicyResponse,
  SendOtpRequest,
  SendOtpResponse,
  SetCultivatedCropsRequest,
  SetPreferredLanguageRequest,
  SetPreferredLanguageResponse,
  SetVoiceRequest,
  SupportedLanguageGroup,
  SynthesiseAudioRequest,
  SynthesiseAudioResponse,
  TextPromptRequest,
  TextPromptResponse,
  UpdateBuildVersionRequest,
  UpdateBuildVersionResponse,
  UpdateLocationRequest,
  UserNameRequest,
  UserNameResponse,
  UserQuestionCountResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  WeatherResponse,
  WhatsappVerificationRequest,
  CountryItem,
} from './types';

export class FarmerChatApi {
  constructor(
    private http: HttpClient,
    private guestApiKey: string,
    private geoApiKey: string,
  ) {}

  // --- Google Geolocation (P1 onboarding-fallback) --------------------------

  geolocate(): Promise<ApiResult<GeoResponse>> {
    return this.http.request<GeoResponse>({
      method: 'POST',
      path: '',
      absoluteUrl: `${GEOLOCATE_URL}?key=${encodeURIComponent(this.geoApiKey)}`,
      body: { considerIp: true },
      priority: 'P1',
      skipAuthHeader: true,
      apiName: 'geolocate',
    });
  }

  // --- #1 guest init ---------------------------------------------------------

  initializeUser(body: InitializeGuestUserRequest): Promise<ApiResult<InitializeGuestUserResponse>> {
    return this.http.request({
      method: 'POST',
      path: 'api/user/initialize_user/',
      body,
      apiKey: this.guestApiKey,
      priority: 'P2',
    });
  }

  // --- #2..#7 onboarding -----------------------------------------------------

  getSupportedLanguages(countryCode: string, state: string): Promise<ApiResult<SupportedLanguageGroup[]>> {
    return this.http.request({
      method: 'GET',
      path: 'api/language/v2/country_wise_supported_languages/',
      query: { country_code: countryCode, state, priority_view: true },
      priority: 'P2',
    });
  }

  getLabels(languageId: number): Promise<ApiResult<LabelsResponse>> {
    return this.http.request({
      method: 'GET',
      path: 'api/language/v2/get_labels/',
      query: { language: languageId },
      priority: 'P2',
    });
  }

  getPrivacyPolicy(): Promise<ApiResult<PrivacyPolicyResponse>> {
    return this.http.request({ method: 'GET', path: 'api/user/privacy_policy/', priority: 'P2' });
  }

  getAllCountries(): Promise<ApiResult<CountryItem[]>> {
    return this.http.request({ method: 'GET', path: 'api/geography/get_all_countries/', priority: 'P2' });
  }

  setPreferredLanguage(body: SetPreferredLanguageRequest): Promise<ApiResult<SetPreferredLanguageResponse>> {
    return this.http.request({ method: 'POST', path: 'api/user/set_preferred_language/', body, priority: 'P2' });
  }

  acceptTerms(body: AcceptPPandTCRequest): Promise<ApiResult<AcceptPPandTCResponse>> {
    return this.http.request({ method: 'POST', path: 'api/user/accept_terms/', body, priority: 'P2' });
  }

  // --- #8..#11 profile ---------------------------------------------------------

  updateUserProfile(body: UserNameRequest): Promise<ApiResult<UserNameResponse>> {
    return this.http.request({ method: 'POST', path: 'api/user/update_user_profile/', body, priority: 'P2' });
  }

  viewUserProfile(id: string): Promise<ApiResult<FarmerProfile>> {
    return this.http.request({ method: 'GET', path: 'api/user/view_user_profile/', query: { id }, priority: 'P2' });
  }

  updateBuildVersion(body: UpdateBuildVersionRequest): Promise<ApiResult<UpdateBuildVersionResponse>> {
    return this.http.request({ method: 'PATCH', path: 'api/user/v2/update_build_version/', body, priority: 'P2' });
  }

  updateUserLocation(body: UpdateLocationRequest): Promise<ApiResult<GetLocationResponse>> {
    return this.http.request({ method: 'POST', path: 'api/user/update_user_location/', body, priority: 'P2' });
  }

  // --- #12..#15 home ------------------------------------------------------------

  /** 204 → empty feed. */
  getDailyFeed(userDeviceTime: string, userId?: string | null): Promise<ApiResult<HomeUdfResponse | null>> {
    return this.http.request({
      method: 'GET',
      path: 'api/images/v2/daily/',
      query: { user_device_time: userDeviceTime, ...(userId ? { user_id: userId } : {}) },
      priority: 'P2',
    });
  }

  getWeather(userId: string): Promise<ApiResult<WeatherResponse>> {
    return this.http.request({
      method: 'POST',
      path: 'api/weather/v2/weather_forecast_lite/',
      body: { user_id: userId },
      priority: 'P2',
    });
  }

  updateCropDetails(body: SetCultivatedCropsRequest): Promise<ApiResult<CropResponse>> {
    return this.http.request({ method: 'POST', path: 'api/user/update_crop_details/', body, priority: 'P2' });
  }

  newConversation(body: NewConversationRequest): Promise<ApiResult<NewConversationResponse>> {
    return this.http.request({ method: 'POST', path: 'api/chat/new_conversation/', body, priority: 'P2' });
  }

  // --- #16 STT (P3 AI runtime) ---------------------------------------------------

  transcribeAudio(body: SetVoiceRequest): Promise<ApiResult<GetVoiceResponse>> {
    return this.http.request({ method: 'POST', path: 'api/chat/transcribe_audio/', body, priority: 'P3' });
  }

  // --- #17..#21 auth ---------------------------------------------------------------

  generateOtp(body: SendOtpRequest): Promise<ApiResult<SendOtpResponse>> {
    return this.http.request({ method: 'POST', path: 'api/user/generate_otp/', body, priority: 'P2' });
  }

  checkDeviceUserLimit(body: CheckDeviceRequest): Promise<ApiResult<SendOtpResponse>> {
    return this.http.request({ method: 'POST', path: 'api/user/check_device_user_limit/', body, priority: 'P2' });
  }

  verifyWhatsappToken(body: WhatsappVerificationRequest): Promise<ApiResult<VerifyOtpResponse>> {
    return this.http.request({
      method: 'POST',
      path: 'api/user/verify_otp_less_android_sdk_token/',
      body,
      priority: 'P2',
    });
  }

  getCommunicationChannels(phoneCountryCode: string): Promise<ApiResult<CommunicationChannelItem[]>> {
    return this.http.request({
      method: 'GET',
      path: 'api/geography/communication_channel/',
      query: { phone_country_code: phoneCountryCode },
      priority: 'P2',
    });
  }

  verifyOtp(body: VerifyOtpRequest): Promise<ApiResult<VerifyOtpResponse>> {
    return this.http.request({ method: 'POST', path: 'api/user/verify_otp/', body, priority: 'P2' });
  }

  // --- #22 chat history list (custom deserializer: bare array or paginated object) ---

  async getConversationList(userId: string, page: number): Promise<ApiResult<ConversationListResponse>> {
    const res = await this.http.request<unknown>({
      method: 'GET',
      path: 'api/chat/conversation_list/',
      query: { user_id: userId, page },
      priority: 'P2',
    });
    if (!res.ok) return res;
    return { ok: true, data: normalizeConversationList(res.data), status: res.status };
  }

  // --- #23 logout --------------------------------------------------------------------

  logout(): Promise<ApiResult<LogoutResponse>> {
    return this.http.request({ method: 'POST', path: 'api/user/logout/', body: {}, priority: 'P2' });
  }

  // --- #24 help/FAQ ---------------------------------------------------------------------

  getHelpSupport(lang: string, limit = 5, theme?: string, country?: string): Promise<ApiResult<HelpSupportResponse>> {
    return this.http.request({
      method: 'GET',
      path: 'api/faqs',
      query: { lang, limit, ...(theme ? { theme } : {}), ...(country ? { country } : {}) },
      priority: 'P2',
    });
  }

  // --- #25/#26 feed cards -------------------------------------------------------------------

  markImageViewed(body: ImageViewedRequest): Promise<ApiResult<ImageViewedResponse>> {
    return this.http.request({ method: 'PATCH', path: 'api/images/v2/viewed/', body, priority: 'P2' });
  }

  getImageStatement(body: ImageStatementRequest): Promise<ApiResult<ImageStatementResponse>> {
    return this.http.request({ method: 'POST', path: 'api/images/v2/statement/', body, priority: 'P2' });
  }

  // --- #27..#31 AI runtime (P3) ----------------------------------------------------------------

  getAnswerForTextQuery(body: TextPromptRequest): Promise<ApiResult<TextPromptResponse>> {
    return this.http.request({ method: 'POST', path: 'api/chat/get_answer_for_text_query/', body, priority: 'P3' });
  }

  imageAnalysis(body: PlantixRequest): Promise<ApiResult<PlantixResponse>> {
    return this.http.request({ method: 'POST', path: 'api/chat/image_analysis/', body, priority: 'P3' });
  }

  getFollowUpQuestions(messageId: string): Promise<ApiResult<FollowUpQuestionsResponse>> {
    return this.http.request({
      method: 'GET',
      path: 'api/chat/follow_up_questions/',
      query: { message_id: messageId, use_latest_prompt: true },
      priority: 'P3',
    });
  }

  trackFollowUpClick(question: string): Promise<ApiResult<FollowUpClickResponse>> {
    return this.http.request({
      method: 'POST',
      path: 'api/chat/follow_up_question_click/',
      body: { follow_up_question: question },
      priority: 'P2',
    });
  }

  synthesiseAudio(body: SynthesiseAudioRequest): Promise<ApiResult<SynthesiseAudioResponse>> {
    return this.http.request({ method: 'POST', path: 'api/chat/synthesise_audio/', body, priority: 'P3' });
  }

  // --- #32 thread history (P3) --------------------------------------------------------------------

  getConversationChatHistory(conversationId: string, page: number): Promise<ApiResult<ConversationChatHistoryResponse>> {
    return this.http.request({
      method: 'GET',
      path: 'api/chat/conversation_chat_history/',
      query: { conversation_id: conversationId, page },
      priority: 'P3',
    });
  }

  // --- #33 qapair insert --------------------------------------------------------------------------------

  addQueryToHistory(body: FollowUpQuestionsRequestMoengage): Promise<ApiResult<AddQueryToHistoryResponse>> {
    return this.http.request({ method: 'POST', path: 'api/chat/add_query_to_history/', body, priority: 'P2' });
  }

  // --- #34 question count -----------------------------------------------------------------------------------

  getUserQuestionCount(): Promise<ApiResult<UserQuestionCountResponse>> {
    return this.http.request({ method: 'GET', path: 'api/images/v2/user_question_count/', priority: 'P2' });
  }
}

/** Endpoint #22 returns either a bare array or a paginated object. */
export function normalizeConversationList(raw: unknown): ConversationListResponse {
  if (Array.isArray(raw)) {
    return { results: raw as ConversationListItem[], next_page: null };
  }
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const results = (obj.results ?? obj.conversations ?? obj.data ?? []) as ConversationListItem[];
    const nextPage =
      typeof obj.next_page === 'number' ? obj.next_page : typeof obj.next === 'number' ? obj.next : null;
    const count = typeof obj.count === 'number' ? obj.count : null;
    return { results: Array.isArray(results) ? results : [], next_page: nextPage, count };
  }
  return { results: [], next_page: null };
}
