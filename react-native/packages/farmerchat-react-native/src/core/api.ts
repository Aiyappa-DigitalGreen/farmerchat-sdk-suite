/**
 * FarmerChatApi — the 34 main endpoints + Google geolocate
 * (docs/02-api-reference.md §Endpoints), typed end to end.
 *
 * Priorities: P1 → geolocate only; P3 → text prompt, plantix (image_analysis),
 * follow-ups, synthesise, transcribe, chat history (per the doc, including
 * the "getChatHistory says P2 but code uses P3" quirk); P2 → everything else.
 */
import type { ApiResult } from './apiResult';
import { GOOGLE_GEOLOCATE_URL, type ResolvedFarmerChatConfig } from './config';
import type { HttpClient } from './httpClient';
import { ApiPriorities } from './priorities';
import type * as M from './types';

export class FarmerChatApi {
  constructor(
    private readonly http: HttpClient,
    private readonly config: ResolvedFarmerChatConfig,
  ) {}

  // --- Google Geolocation (P1) --------------------------------------------

  geolocate(): Promise<ApiResult<M.GeoResponse>> {
    return this.http.request<M.GeoResponse>({
      method: 'POST',
      path: `${GOOGLE_GEOLOCATE_URL}?key=${encodeURIComponent(this.config.geoApiKey ?? '')}`,
      apiName: 'geolocate',
      body: { considerIp: true } satisfies M.GeoRequestBody,
      priority: ApiPriorities.P1_ONBOARDING_FALLBACK,
      auth: false,
    });
  }

  // --- #1 guest init --------------------------------------------------------

  initializeGuestUser(
    body: M.InitializeGuestUserRequest,
  ): Promise<ApiResult<M.InitializeGuestUserResponse>> {
    const headers: Record<string, string> = {};
    if (this.config.guestApiKey) headers['API-Key'] = this.config.guestApiKey;
    return this.http.request<M.InitializeGuestUserResponse>({
      method: 'POST',
      path: 'api/user/initialize_user/',
      apiName: 'initialize_user',
      body,
      headers,
      auth: false,
    });
  }

  // --- #2 languages ---------------------------------------------------------

  getSupportedLanguages(
    countryCode: string,
    state?: string | null,
  ): Promise<ApiResult<M.SupportedLanguageGroup[]>> {
    return this.http.request<M.SupportedLanguageGroup[]>({
      method: 'GET',
      path: 'api/language/v2/country_wise_supported_languages/',
      apiName: 'country_wise_supported_languages',
      query: { country_code: countryCode, state: state ?? undefined, priority_view: true },
    });
  }

  // --- #3 labels ------------------------------------------------------------

  getLabels(languageId: number): Promise<ApiResult<M.LabelsResponse>> {
    return this.http.request<M.LabelsResponse>({
      method: 'GET',
      path: 'api/language/v2/get_labels/',
      apiName: 'get_labels',
      query: { language: languageId },
    });
  }

  // --- #4 legal links ---------------------------------------------------------

  getPrivacyPolicy(): Promise<ApiResult<M.PrivacyPolicyResponse>> {
    return this.http.request<M.PrivacyPolicyResponse>({
      method: 'GET',
      path: 'api/user/privacy_policy/',
      apiName: 'privacy_policy',
    });
  }

  // --- #5 countries -----------------------------------------------------------

  getAllCountries(): Promise<ApiResult<M.CountryItem[]>> {
    return this.http.request<M.CountryItem[]>({
      method: 'GET',
      path: 'api/geography/get_all_countries/',
      apiName: 'get_all_countries',
    });
  }

  // --- #6 preferred language ---------------------------------------------------

  setPreferredLanguage(
    body: M.SetPreferredLanguageRequest,
  ): Promise<ApiResult<M.SetPreferredLanguageResponse>> {
    return this.http.request<M.SetPreferredLanguageResponse>({
      method: 'POST',
      path: 'api/user/set_preferred_language/',
      apiName: 'set_preferred_language',
      body,
    });
  }

  // --- #7 accept terms ---------------------------------------------------------

  acceptTerms(body: M.AcceptPPandTCRequest): Promise<ApiResult<M.AcceptPPandTCResponse>> {
    return this.http.request<M.AcceptPPandTCResponse>({
      method: 'POST',
      path: 'api/user/accept_terms/',
      apiName: 'accept_terms',
      body,
    });
  }

  // --- #8 update profile / name -------------------------------------------------

  updateUserProfile(body: M.UserNameRequest): Promise<ApiResult<M.UserNameResponse>> {
    return this.http.request<M.UserNameResponse>({
      method: 'POST',
      path: 'api/user/update_user_profile/',
      apiName: 'update_user_profile',
      body,
    });
  }

  // --- #9 view profile -----------------------------------------------------------

  viewUserProfile(userId: string): Promise<ApiResult<M.FarmerProfile>> {
    return this.http.request<M.FarmerProfile>({
      method: 'GET',
      path: 'api/user/view_user_profile/',
      apiName: 'view_user_profile',
      query: { id: userId },
    });
  }

  // --- #10 build version -----------------------------------------------------------

  updateBuildVersion(
    body: M.UpdateBuildVersionRequest,
  ): Promise<ApiResult<M.UpdateBuildVersionResponse>> {
    return this.http.request<M.UpdateBuildVersionResponse>({
      method: 'PATCH',
      path: 'api/user/v2/update_build_version/',
      apiName: 'update_build_version',
      body,
    });
  }

  // --- #11 location ------------------------------------------------------------------

  updateUserLocation(
    body: M.UpdateLocationRequest,
  ): Promise<ApiResult<M.GetLocationResponse>> {
    return this.http.request<M.GetLocationResponse>({
      method: 'POST',
      path: 'api/user/update_user_location/',
      apiName: 'update_user_location',
      body,
    });
  }

  // --- #12 home feed ---------------------------------------------------------------------

  getDailyFeed(
    userDeviceTime: string,
    userId?: string | null,
  ): Promise<ApiResult<M.HomeUdfResponse | null>> {
    return this.http.request<M.HomeUdfResponse | null>({
      method: 'GET',
      path: 'api/images/v2/daily/',
      apiName: 'daily_feed',
      query: { user_device_time: userDeviceTime, user_id: userId ?? undefined },
    });
  }

  // --- #13 weather ------------------------------------------------------------------------

  getWeatherForecastLite(userId: string): Promise<ApiResult<M.WeatherResponse>> {
    return this.http.request<M.WeatherResponse>({
      method: 'POST',
      path: 'api/weather/v2/weather_forecast_lite/',
      apiName: 'weather_forecast_lite',
      body: { user_id: userId } satisfies M.WeatherRequest,
    });
  }

  // --- #14 crops ----------------------------------------------------------------------------

  updateCropDetails(
    body: M.SetCultivatedCropsRequest,
  ): Promise<ApiResult<M.CropResponse>> {
    return this.http.request<M.CropResponse>({
      method: 'POST',
      path: 'api/user/update_crop_details/',
      apiName: 'update_crop_details',
      body,
    });
  }

  // --- #15 new conversation ---------------------------------------------------------------------

  newConversation(
    body: M.NewConversationRequest,
  ): Promise<ApiResult<M.NewConversationResponse>> {
    return this.http.request<M.NewConversationResponse>({
      method: 'POST',
      path: 'api/chat/new_conversation/',
      apiName: 'new_conversation',
      body,
    });
  }

  // --- #16 transcribe (P3) ------------------------------------------------------------------------

  transcribeAudio(body: M.SetVoiceRequest): Promise<ApiResult<M.GetVoiceResponse>> {
    return this.http.request<M.GetVoiceResponse>({
      method: 'POST',
      path: 'api/chat/transcribe_audio/',
      apiName: 'transcribe_audio',
      body,
      priority: ApiPriorities.P3_AI_RUNTIME,
    });
  }

  // --- #17 send OTP ----------------------------------------------------------------------------------

  generateOtp(body: M.SendOtpRequest): Promise<ApiResult<M.SendOtpResponse>> {
    return this.http.request<M.SendOtpResponse>({
      method: 'POST',
      path: 'api/user/generate_otp/',
      apiName: 'generate_otp',
      body,
    });
  }

  // --- #18 device limit --------------------------------------------------------------------------------

  checkDeviceUserLimit(body: M.CheckDeviceRequest): Promise<ApiResult<M.SendOtpResponse>> {
    return this.http.request<M.SendOtpResponse>({
      method: 'POST',
      path: 'api/user/check_device_user_limit/',
      apiName: 'check_device_user_limit',
      body,
    });
  }

  // --- #19 WhatsApp OTP-less ----------------------------------------------------------------------------

  verifyWhatsappToken(
    body: M.WhatsappVerificationRequest,
  ): Promise<ApiResult<M.VerifyOtpResponse>> {
    return this.http.request<M.VerifyOtpResponse>({
      method: 'POST',
      path: 'api/user/verify_otp_less_android_sdk_token/',
      apiName: 'verify_otp_less_android_sdk_token',
      body,
    });
  }

  // --- #20 channels ---------------------------------------------------------------------------------------

  getCommunicationChannels(
    phoneCountryCode: string,
  ): Promise<ApiResult<M.CommunicationChannelResponse>> {
    return this.http.request<M.CommunicationChannelResponse>({
      method: 'GET',
      path: 'api/geography/communication_channel/',
      apiName: 'communication_channel',
      query: { phone_country_code: phoneCountryCode },
    });
  }

  // --- #21 verify OTP ----------------------------------------------------------------------------------------

  verifyOtp(body: M.VerifyOtpRequest): Promise<ApiResult<M.VerifyOtpResponse>> {
    return this.http.request<M.VerifyOtpResponse>({
      method: 'POST',
      path: 'api/user/verify_otp/',
      apiName: 'verify_otp',
      body,
    });
  }

  // --- #22 conversation list (dual format) --------------------------------------------------------------------

  getConversationList(
    userId: string,
    page: number,
  ): Promise<ApiResult<M.ConversationListResponse>> {
    return this.http.request<M.ConversationListResponse>({
      method: 'GET',
      path: 'api/chat/conversation_list/',
      apiName: 'conversation_list',
      query: { user_id: userId, page },
    });
  }

  // --- #23 logout ------------------------------------------------------------------------------------------------

  logout(): Promise<ApiResult<M.LogoutResponse>> {
    return this.http.request<M.LogoutResponse>({
      method: 'POST',
      path: 'api/user/logout/',
      apiName: 'logout',
      body: {},
    });
  }

  // --- #24 FAQs -----------------------------------------------------------------------------------------------------

  getHelpSupport(params: {
    lang: string;
    limit?: number;
    theme?: string | null;
    country?: string | null;
  }): Promise<ApiResult<M.HelpSupportResponse>> {
    return this.http.request<M.HelpSupportResponse>({
      method: 'GET',
      path: 'api/faqs',
      apiName: 'faqs',
      query: {
        lang: params.lang,
        limit: params.limit ?? 5,
        theme: params.theme ?? undefined,
        country: params.country ?? undefined,
      },
    });
  }

  // --- #25 mark card viewed ---------------------------------------------------------------------------------------------

  markImageViewed(body: M.ImageViewedRequest): Promise<ApiResult<M.ImageViewedResponse>> {
    return this.http.request<M.ImageViewedResponse>({
      method: 'PATCH',
      path: 'api/images/v2/viewed/',
      apiName: 'image_viewed',
      body,
    });
  }

  // --- #26 card statement ------------------------------------------------------------------------------------------------

  getImageStatement(
    body: M.ImageStatementRequest,
  ): Promise<ApiResult<M.ImageStatementResponse>> {
    return this.http.request<M.ImageStatementResponse>({
      method: 'POST',
      path: 'api/images/v2/statement/',
      apiName: 'image_statement',
      body,
    });
  }

  // --- #27 main AI answer (P3) ----------------------------------------------------------------------------------------------

  getAnswerForTextQuery(body: M.TextPromptRequest): Promise<ApiResult<M.TextPromptResponse>> {
    return this.http.request<M.TextPromptResponse>({
      method: 'POST',
      path: 'api/chat/get_answer_for_text_query/',
      apiName: 'get_answer_for_text_query',
      body,
      priority: ApiPriorities.P3_AI_RUNTIME,
    });
  }

  // --- #28 image analysis / Plantix (P3; real path is image_analysis) ------------------------------------------------------------

  imageAnalysis(body: M.PlantixRequest): Promise<ApiResult<M.PlantixResponse>> {
    return this.http.request<M.PlantixResponse>({
      method: 'POST',
      path: 'api/chat/image_analysis/',
      apiName: 'image_analysis',
      body,
      priority: ApiPriorities.P3_AI_RUNTIME,
    });
  }

  // --- #29 follow-ups (P3) ----------------------------------------------------------------------------------------------------------

  getFollowUpQuestions(messageId: string): Promise<ApiResult<M.FollowUpQuestionsResponse>> {
    return this.http.request<M.FollowUpQuestionsResponse>({
      method: 'GET',
      path: 'api/chat/follow_up_questions/',
      apiName: 'follow_up_questions',
      query: { message_id: messageId, use_latest_prompt: true },
      priority: ApiPriorities.P3_AI_RUNTIME,
    });
  }

  // --- #30 follow-up click ------------------------------------------------------------------------------------------------------------

  trackFollowUpClick(
    body: M.FollowUpQuestionClickRequest,
  ): Promise<ApiResult<M.FollowUpQuestionClickResponse>> {
    return this.http.request<M.FollowUpQuestionClickResponse>({
      method: 'POST',
      path: 'api/chat/follow_up_question_click/',
      apiName: 'follow_up_question_click',
      body,
    });
  }

  // --- #31 TTS (P3) --------------------------------------------------------------------------------------------------------------------

  synthesiseAudio(
    body: M.SynthesiseAudioRequest,
  ): Promise<ApiResult<M.SynthesiseAudioResponse>> {
    return this.http.request<M.SynthesiseAudioResponse>({
      method: 'POST',
      path: 'api/chat/synthesise_audio/',
      apiName: 'synthesise_audio',
      body,
      priority: ApiPriorities.P3_AI_RUNTIME,
    });
  }

  // --- #32 thread history (P3 — app quirk, comment says P2 but code uses P3) ------------------------------------------------------------

  getConversationChatHistory(
    conversationId: string,
    page: number,
  ): Promise<ApiResult<M.ConversationChatHistoryResponse>> {
    return this.http.request<M.ConversationChatHistoryResponse>({
      method: 'GET',
      path: 'api/chat/conversation_chat_history/',
      apiName: 'conversation_chat_history',
      query: { conversation_id: conversationId, page },
      priority: ApiPriorities.P3_AI_RUNTIME,
    });
  }

  // --- #33 add query to history --------------------------------------------------------------------------------------------------------------

  addQueryToHistory(
    body: M.FollowUpQuestionsRequestMoengage,
  ): Promise<ApiResult<M.AddQueryToHistoryResponse>> {
    return this.http.request<M.AddQueryToHistoryResponse>({
      method: 'POST',
      path: 'api/chat/add_query_to_history/',
      apiName: 'add_query_to_history',
      body,
    });
  }

  // --- #34 question count ---------------------------------------------------------------------------------------------------------------------

  getUserQuestionCount(): Promise<ApiResult<M.UserQuestionCountResponse>> {
    return this.http.request<M.UserQuestionCountResponse>({
      method: 'GET',
      path: 'api/images/v2/user_question_count/',
      apiName: 'user_question_count',
    });
  }
}
