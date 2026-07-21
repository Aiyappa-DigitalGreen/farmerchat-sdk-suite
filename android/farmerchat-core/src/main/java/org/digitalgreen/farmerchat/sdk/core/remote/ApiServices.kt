package org.digitalgreen.farmerchat.sdk.core.remote

import org.digitalgreen.farmerchat.sdk.core.model.AcceptPPandTCRequest
import org.digitalgreen.farmerchat.sdk.core.model.AcceptPPandTCResponse
import org.digitalgreen.farmerchat.sdk.core.model.CheckDeviceRequest
import org.digitalgreen.farmerchat.sdk.core.model.ConversationChatHistoryResponse
import org.digitalgreen.farmerchat.sdk.core.model.ConversationListResponse
import org.digitalgreen.farmerchat.sdk.core.model.CountryItem
import org.digitalgreen.farmerchat.sdk.core.model.CropResponse
import org.digitalgreen.farmerchat.sdk.core.model.FarmerProfile
import org.digitalgreen.farmerchat.sdk.core.model.FollowUpQuestionClickRequest
import org.digitalgreen.farmerchat.sdk.core.model.FollowUpQuestionClickResponse
import org.digitalgreen.farmerchat.sdk.core.model.FollowUpQuestionsResponse
import org.digitalgreen.farmerchat.sdk.core.model.GetLocationResponse
import org.digitalgreen.farmerchat.sdk.core.model.GetOtpModeResponse
import org.digitalgreen.farmerchat.sdk.core.model.GetVoiceResponse
import org.digitalgreen.farmerchat.sdk.core.model.HelpSupportResponse
import org.digitalgreen.farmerchat.sdk.core.model.HomeUdfResponse
import org.digitalgreen.farmerchat.sdk.core.model.ImageStatementRequest
import org.digitalgreen.farmerchat.sdk.core.model.ImageStatementResponse
import org.digitalgreen.farmerchat.sdk.core.model.ImageViewedRequest
import org.digitalgreen.farmerchat.sdk.core.model.ImageViewedResponse
import org.digitalgreen.farmerchat.sdk.core.model.InitializeGuestUserRequest
import org.digitalgreen.farmerchat.sdk.core.model.InitializeGuestUserResponse
import org.digitalgreen.farmerchat.sdk.core.model.LogoutResponse
import org.digitalgreen.farmerchat.sdk.core.model.NewConversationRequest
import org.digitalgreen.farmerchat.sdk.core.model.NewConversationResponse
import org.digitalgreen.farmerchat.sdk.core.model.PlantixRequest
import org.digitalgreen.farmerchat.sdk.core.model.PlantixResponse
import org.digitalgreen.farmerchat.sdk.core.model.PrivacyPolicyResponse
import org.digitalgreen.farmerchat.sdk.core.model.SendOtpRequest
import org.digitalgreen.farmerchat.sdk.core.model.SendOtpResponse
import org.digitalgreen.farmerchat.sdk.core.model.SetCultivatedCropsRequest
import org.digitalgreen.farmerchat.sdk.core.model.SetPreferredLanguageRequest
import org.digitalgreen.farmerchat.sdk.core.model.SetPreferredLanguageResponse
import org.digitalgreen.farmerchat.sdk.core.model.SetVoiceRequest
import org.digitalgreen.farmerchat.sdk.core.model.SupportedLanguageGroup
import org.digitalgreen.farmerchat.sdk.core.model.SynthesiseAudioRequest
import org.digitalgreen.farmerchat.sdk.core.model.SynthesiseAudioResponse
import org.digitalgreen.farmerchat.sdk.core.model.TextPromptRequest
import org.digitalgreen.farmerchat.sdk.core.model.TextPromptResponse
import org.digitalgreen.farmerchat.sdk.core.model.UpdateBuildVersionRequest
import org.digitalgreen.farmerchat.sdk.core.model.UpdateBuildVersionResponse
import org.digitalgreen.farmerchat.sdk.core.model.UpdateLocationRequest
import org.digitalgreen.farmerchat.sdk.core.model.UserNameRequest
import org.digitalgreen.farmerchat.sdk.core.model.UserNameResponse
import org.digitalgreen.farmerchat.sdk.core.model.UserQuestionCountResponse
import org.digitalgreen.farmerchat.sdk.core.model.VerifyOtpRequest
import org.digitalgreen.farmerchat.sdk.core.model.VerifyOtpResponse
import org.digitalgreen.farmerchat.sdk.core.model.WeatherResponse
import org.digitalgreen.farmerchat.sdk.core.model.WhatsappVerificationRequest
import org.digitalgreen.farmerchat.sdk.core.model.followUpQuestionsRequestMoengage
import org.digitalgreen.farmerchat.sdk.core.model.followUpQuestionsResponseMoengage
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Query

/**
 * Single Retrofit interface for all 34 main-API endpoints (doc 02).
 */
interface ApiServices {

    // #1 Guest init (issues tokens)
    @POST(ApiConstants.INITIALIZE_GUEST_USER)
    suspend fun initializeGuestUser(
        @Header("API-Key") apiKey: String,
        @Body body: InitializeGuestUserRequest
    ): Response<InitializeGuestUserResponse>

    // #2 Language list
    @GET(ApiConstants.GET_COUNTRY_WISE_SUPPORTED_LANGUAGES)
    suspend fun getSupportedLanguages(
        @Query("country_code") countryCode: String,
        @Query("state") state: String,
        @Query("priority_view") priorityView: Boolean = true
    ): Response<List<SupportedLanguageGroup>>

    // #3 Server-driven UI labels
    @GET(ApiConstants.GET_LANGUAGE_LABELS)
    suspend fun getLanguageLabels(
        @Query("language") languageId: Int
    ): Response<Map<String, String>>

    // #4 Legal links
    @GET(ApiConstants.GET_PRIVACY_POLICY)
    suspend fun fetchPrivacyPolicy(): Response<PrivacyPolicyResponse>

    // #5 Country list
    @GET(ApiConstants.GET_ALL_COUNTRY_LISTS)
    suspend fun getAllCountryList(): Response<List<CountryItem>>

    // #6 Save language
    @POST(ApiConstants.POST_SET_PREFERRED_LANGUAGE)
    suspend fun setPreferredLanguage(
        @Body request: SetPreferredLanguageRequest
    ): Response<SetPreferredLanguageResponse>

    // #7 Accept T&C
    @POST(ApiConstants.ACCEPT_PP_AND_TC)
    suspend fun acceptTerms(
        @Body request: AcceptPPandTCRequest
    ): Response<AcceptPPandTCResponse>

    // #8 Update name/profile
    @POST(ApiConstants.UPDATE_USER_NAME)
    suspend fun updateUserName(
        @Body request: UserNameRequest
    ): Response<UserNameResponse>

    // #9 Fetch profile
    @GET(ApiConstants.GET_USER_PROFILE)
    suspend fun fetchUserProfile(
        @Query("id") id: String
    ): Response<FarmerProfile>

    // #10 Report build version
    @PATCH(ApiConstants.UPDATE_BUILD_VERSION)
    suspend fun updateBuildVersion(
        @Body body: UpdateBuildVersionRequest
    ): Response<UpdateBuildVersionResponse>

    // #11 Save GPS location
    @POST(ApiConstants.UPDATE_USER_LOCATION)
    suspend fun updateUserLocation(
        @Body request: UpdateLocationRequest
    ): Response<GetLocationResponse>

    // #12 Home feed sections (204 → empty)
    @GET(ApiConstants.HOME)
    suspend fun getDailyHomeSections(
        @Query("user_device_time") userDeviceTime: String,
        @Query("user_id") userId: String? = null
    ): Response<HomeUdfResponse>

    // #13 Weather chip
    @POST(ApiConstants.WEATHER)
    suspend fun getWeatherForecast(
        @Body request: Map<String, String>
    ): Response<WeatherResponse>

    // #14 Save crops
    @POST(ApiConstants.UPDATE_CULTIVATED_CROPS)
    suspend fun updateCultivatedCrops(
        @Body request: SetCultivatedCropsRequest
    ): Response<CropResponse>

    // #15 New conversation
    @POST(ApiConstants.NEW_CONVERSATION)
    suspend fun newConversation(
        @Body request: NewConversationRequest
    ): Response<NewConversationResponse>

    // #16 Server STT
    @POST(ApiConstants.TRANSCRIBE_AUDIO)
    suspend fun transcribeAudio(
        @Body request: SetVoiceRequest
    ): Response<GetVoiceResponse>

    // #17 Send OTP
    @POST(ApiConstants.SEND_OTP)
    suspend fun sendOTP(
        @Body requestBody: SendOtpRequest
    ): Response<SendOtpResponse>

    // #18 Device limit
    @POST(ApiConstants.POST_CHECK_DEVICE_USER_LIMIT)
    suspend fun checkDeviceLimit(
        @Body requestBody: CheckDeviceRequest
    ): Response<SendOtpResponse>

    // #19 WhatsApp OTP-less verification
    @POST(ApiConstants.POST_WHATSAPP_VERIFICATION_LINK)
    suspend fun getWhatsappVerificationLink(
        @Body requestBody: WhatsappVerificationRequest
    ): Response<VerifyOtpResponse>

    // #20 OTP channels for country
    @GET(ApiConstants.GET_SMS_COMMUNICATION_CHANNEL)
    suspend fun getOtpViaSmsWhatsapp(
        @Query("phone_country_code") phoneCountryCode: String
    ): Response<GetOtpModeResponse>

    // #21 Verify OTP (login)
    @POST(ApiConstants.VERIFY_OTP)
    suspend fun verifyOTP(
        @Body requestBody: VerifyOtpRequest
    ): Response<VerifyOtpResponse>

    // #22 Chat history list (custom deserializer: bare-array or paginated object)
    @GET(ApiConstants.GET_CONVERSATION_LIST)
    suspend fun getConversationLists(
        @Query("user_id") userId: String,
        @Query("page") page: Int
    ): Response<ConversationListResponse>

    // #23 Logout
    @POST(ApiConstants.POST_LOGOUT_APP)
    suspend fun logoutApp(): Response<LogoutResponse>

    // #24 Help/FAQ
    @GET(ApiConstants.GET_HELP_SUPPORT)
    suspend fun getHelpSupport(
        @Query("lang") lang: String,
        @Query("limit") limit: Int,
        @Query("theme") theme: String? = null,
        @Query("country") country: String? = null
    ): Response<HelpSupportResponse>

    // #25 Mark card viewed
    @PATCH(ApiConstants.MARK_IMAGE_VIEWED)
    suspend fun markImageViewed(
        @Body request: ImageViewedRequest
    ): Response<ImageViewedResponse>

    // #26 Card pre-gen answer
    @POST(ApiConstants.IMAGE_STATEMENT)
    suspend fun getImageStatement(
        @Body request: ImageStatementRequest
    ): Response<ImageStatementResponse>

    // #27 Main AI answer
    @POST(ApiConstants.GET_TEXT_PROMPT)
    suspend fun getTextPrompt(
        @Body request: TextPromptRequest
    ): Response<TextPromptResponse>

    // #28 Image AI ("Plantix")
    @POST(ApiConstants.GET_PLANTIX)
    suspend fun getPlantix(
        @Body request: PlantixRequest
    ): Response<PlantixResponse>

    // #29 Follow-ups (post-answer)
    @GET(ApiConstants.GET_FOLLOW_UP_QUESTIONS)
    suspend fun getFollowUpQuestions(
        @Query("message_id") messageId: String,
        @Query("use_latest_prompt") useLatestPrompt: Boolean = true
    ): Response<FollowUpQuestionsResponse>

    // #30 Track follow-up click
    @POST(ApiConstants.POST_TRACK_FOLLOW_UP_QUESTIONS)
    suspend fun trackFollowUpQuestionClick(
        @Body requestBody: FollowUpQuestionClickRequest
    ): Response<FollowUpQuestionClickResponse>

    // #31 Server TTS
    @POST(ApiConstants.SYNTHESISE_AUDIO)
    suspend fun synthesiseAudio(
        @Body request: SynthesiseAudioRequest
    ): Response<SynthesiseAudioResponse>

    // #32 Thread history
    @GET(ApiConstants.GET_CHAT_HISTORY)
    suspend fun getChatHistory(
        @Query("conversation_id") conversationId: String,
        @Query("page") page: Int
    ): Response<ConversationChatHistoryResponse>

    // #33 Campaign qapair insert
    @POST(ApiConstants.ADD_QUERY_TO_HISTORY)
    suspend fun followUpQuestionsMoengage(
        @Body requestBody: followUpQuestionsRequestMoengage
    ): Response<followUpQuestionsResponseMoengage>

    // #34 Question count
    @GET(ApiConstants.GET_USER_QUESTION_COUNT)
    suspend fun getUserQuestionCount(): Response<UserQuestionCountResponse>
}
