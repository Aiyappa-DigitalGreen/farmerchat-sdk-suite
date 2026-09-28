package org.digitalgreen.farmerchat.sdk.core.usecase

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import org.digitalgreen.farmerchat.sdk.core.base.ApiResult
import org.digitalgreen.farmerchat.sdk.core.base.BaseUseCase
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
import org.digitalgreen.farmerchat.sdk.core.model.GeoRequestBody
import org.digitalgreen.farmerchat.sdk.core.model.GeoResponse
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
import org.digitalgreen.farmerchat.sdk.core.model.LegalLinks
import org.digitalgreen.farmerchat.sdk.core.model.LogoutResponse
import org.digitalgreen.farmerchat.sdk.core.model.NewConversationRequest
import org.digitalgreen.farmerchat.sdk.core.model.NewConversationResponse
import org.digitalgreen.farmerchat.sdk.core.model.PlantixRequest
import org.digitalgreen.farmerchat.sdk.core.model.PlantixResponse
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
import org.digitalgreen.farmerchat.sdk.core.model.WhatsappVerificationRequest
import org.digitalgreen.farmerchat.sdk.core.model.followUpQuestionsRequestMoengage
import org.digitalgreen.farmerchat.sdk.core.model.followUpQuestionsResponseMoengage
import org.digitalgreen.farmerchat.sdk.core.network.timeout.ApiPriority
import org.digitalgreen.farmerchat.sdk.core.repository.AuthRepository
import org.digitalgreen.farmerchat.sdk.core.repository.ChatRepository
import org.digitalgreen.farmerchat.sdk.core.repository.GeoRepository
import org.digitalgreen.farmerchat.sdk.core.repository.GuestAuthRepository
import org.digitalgreen.farmerchat.sdk.core.repository.HelpRepository
import org.digitalgreen.farmerchat.sdk.core.repository.HistoryRepository
import org.digitalgreen.farmerchat.sdk.core.repository.HomeRepository
import org.digitalgreen.farmerchat.sdk.core.repository.LanguageRepository
import org.digitalgreen.farmerchat.sdk.core.repository.LocationRepository
import org.digitalgreen.farmerchat.sdk.core.repository.NameRepository
import org.digitalgreen.farmerchat.sdk.core.repository.ProfileRepository

inline fun <T, R> ApiResult<T>.mapSuccess(mapper: (T) -> R): ApiResult<R> = when (this) {
    is ApiResult.Success -> ApiResult.Success(mapper(data))
    is ApiResult.Error -> this
}

// ---------------------------------------------------------------------------
// Geo (Google geolocate) — P1 (5 s / 1 retry)
// ---------------------------------------------------------------------------

class FetchGeoLocationUseCase(
    private val repo: GeoRepository,
    private val geoApiKey: () -> String?
) : BaseUseCase() {

    fun fetchGeoLocation(body: GeoRequestBody = GeoRequestBody()): Flow<ApiResult<GeoResponse>> = flow {
        val key = geoApiKey()
        if (key.isNullOrBlank()) {
            emit(
                ApiResult.Error(
                    code = null,
                    message = "Geo API key not configured",
                    apiName = "geolocate"
                )
            )
            return@flow
        }
        emit(
            executeApiCall(
                apiName = "geolocate",
                priority = ApiPriority.PRIORITY_1_ONBOARDING_FALLBACK
            ) { repo.geolocate(key, body) }
        )
    }
}

// ---------------------------------------------------------------------------
// Guest init — P2
// ---------------------------------------------------------------------------

class InitializeGuestUserUseCase(
    private val repo: GuestAuthRepository,
    private val guestApiKey: () -> String
) : BaseUseCase() {

    fun initializeGuestUser(body: InitializeGuestUserRequest): Flow<ApiResult<InitializeGuestUserResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "initialize_guest_user",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.initializeGuestUser(guestApiKey(), body) }
        )
    }
}

// ---------------------------------------------------------------------------
// Language — P2
// ---------------------------------------------------------------------------

class GetSupportedLanguagesUseCase(
    private val repo: LanguageRepository
) : BaseUseCase() {

    fun getSupportedLanguages(countryCode: String, state: String): Flow<ApiResult<List<SupportedLanguageGroup>>> = flow {
        emit(
            executeApiCall(
                apiName = "get_supported_languages",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.getSupportedLanguages(countryCode, state) }
                .let { r -> if (r is ApiResult.Success) ApiResult.Success(r.data.map { it.normalized() }) else r }
        )
    }

    fun setPreferredLanguage(request: SetPreferredLanguageRequest): Flow<ApiResult<SetPreferredLanguageResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "set_preferred_language",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.setPreferredLanguage(request) }
        )
    }

    fun acceptTerms(request: AcceptPPandTCRequest): Flow<ApiResult<AcceptPPandTCResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "accept_terms",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.acceptTerms(request) }
        )
    }

    fun fetchPrivacyPolicy(): Flow<ApiResult<LegalLinks>> = flow {
        emit(
            executeApiCall(
                apiName = "get_privacy_policy",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.fetchPrivacyPolicy() }.mapSuccess { response ->
                LegalLinks(
                    privacyPolicyUrl = response.url,
                    termsOfUseUrl = response.farmerchat_terms_of_use
                )
            }
        )
    }
}

class GetLanguageLabelsUseCase(
    private val repo: LanguageRepository
) : BaseUseCase() {

    fun getLanguageLabels(languageId: Int): Flow<ApiResult<Map<String, String>>> = flow {
        emit(
            executeApiCall(
                apiName = "get_language_labels",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.getLanguageLabels(languageId) }
        )
    }
}

// ---------------------------------------------------------------------------
// Name / profile — P2
// ---------------------------------------------------------------------------

class UpdateUserNameUseCase(
    private val repo: NameRepository
) : BaseUseCase() {

    fun updateUserName(body: UserNameRequest): Flow<ApiResult<UserNameResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "update_user_profile",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.updateUserName(body) }
        )
    }
}

class GetUserProfileUseCase(
    private val repo: ProfileRepository
) : BaseUseCase() {

    fun fetchUserProfile(userId: String): Flow<ApiResult<FarmerProfile>> = flow {
        emit(
            executeApiCall(
                apiName = "fetch_user_profile",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.fetchUserProfile(userId) }
        )
    }
}

class UpdateBuildVersionUseCase(
    private val repo: ProfileRepository
) : BaseUseCase() {

    fun updateBuildVersion(userId: String): Flow<ApiResult<UpdateBuildVersionResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "update_build_version",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.updateBuildVersion(UpdateBuildVersionRequest(user_id = userId)) }
        )
    }
}

class UpdateUserLocationUseCase(
    private val repo: LocationRepository
) : BaseUseCase() {

    fun updateUserLocation(request: UpdateLocationRequest): Flow<ApiResult<GetLocationResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "update_user_location",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.updateUserLocation(request) }
        )
    }
}

// ---------------------------------------------------------------------------
// Home — P2
// ---------------------------------------------------------------------------

class HomeUseCase(
    private val repo: HomeRepository
) : BaseUseCase() {

    fun getDailyHomeSections(userDeviceTime: String, userId: String?): Flow<ApiResult<HomeUdfResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "home_feed",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.getDailyHomeSections(userDeviceTime, userId) }
        )
    }

    fun getWeatherForecast(userId: String): Flow<ApiResult<org.digitalgreen.farmerchat.sdk.core.model.WeatherResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "weather",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.getWeatherForecast(userId) }
        )
    }

    fun updateCultivatedCrops(request: SetCultivatedCropsRequest): Flow<ApiResult<CropResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "update_crops",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.updateCultivatedCrops(request) }
        )
    }

    fun markImageViewed(request: ImageViewedRequest): Flow<ApiResult<ImageViewedResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "mark_image_viewed",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.markImageViewed(request) }
        )
    }

    fun getImageStatement(request: ImageStatementRequest): Flow<ApiResult<ImageStatementResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "image_statement",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.getImageStatement(request) }
        )
    }

    fun getUserQuestionCount(): Flow<ApiResult<UserQuestionCountResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "user_question_count",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.getUserQuestionCount() }
        )
    }
}

// ---------------------------------------------------------------------------
// Chat — AI endpoints P3 (30 s / 3 retries); new_conversation P2
// ---------------------------------------------------------------------------

class ChatUseCase(
    private val repo: ChatRepository
) : BaseUseCase() {

    fun newConversation(request: NewConversationRequest): Flow<ApiResult<NewConversationResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "new_conversation",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.newConversation(request) }
        )
    }

    fun transcribeAudio(request: SetVoiceRequest): Flow<ApiResult<GetVoiceResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "transcribe_audio",
                priority = ApiPriority.PRIORITY_3_AI_RUNTIME
            ) { repo.transcribeAudio(request) }
        )
    }

    fun getTextPrompt(request: TextPromptRequest): Flow<ApiResult<TextPromptResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "get_text_prompt",
                priority = ApiPriority.PRIORITY_3_AI_RUNTIME
            ) { repo.getTextPrompt(request) }
        )
    }

    fun getPlantix(request: PlantixRequest): Flow<ApiResult<PlantixResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "get_plantix",
                priority = ApiPriority.PRIORITY_3_AI_RUNTIME
            ) { repo.getPlantix(request) }
        )
    }

    fun getFollowUpQuestions(messageId: String): Flow<ApiResult<FollowUpQuestionsResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "get_follow_up_questions",
                priority = ApiPriority.PRIORITY_3_AI_RUNTIME
            ) { repo.getFollowUpQuestions(messageId) }
        )
    }

    fun trackFollowUpQuestionClick(question: String): Flow<ApiResult<FollowUpQuestionClickResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "track_follow_up_question_click",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.trackFollowUpQuestionClick(FollowUpQuestionClickRequest(question)) }
        )
    }

    fun synthesiseAudio(request: SynthesiseAudioRequest): Flow<ApiResult<SynthesiseAudioResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "synthesise_audio",
                priority = ApiPriority.PRIORITY_3_AI_RUNTIME
            ) { repo.synthesiseAudio(request) }
        )
    }

    /** Note: app comment claimed P2 but code used P3 — SDK uses P3 per spec. */
    fun getChatHistory(conversationId: String, page: Int): Flow<ApiResult<ConversationChatHistoryResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "get_chat_history",
                priority = ApiPriority.PRIORITY_3_AI_RUNTIME
            ) { repo.getChatHistory(conversationId, page) }
        )
    }

    fun addQueryToHistory(request: followUpQuestionsRequestMoengage): Flow<ApiResult<followUpQuestionsResponseMoengage>> = flow {
        emit(
            executeApiCall(
                apiName = "add_query_to_history",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.addQueryToHistory(request) }
        )
    }
}

// ---------------------------------------------------------------------------
// Phone auth — P2
// ---------------------------------------------------------------------------

class PhoneAuthUseCases(
    private val repo: AuthRepository
) : BaseUseCase() {

    fun getAllCountries(): Flow<ApiResult<List<CountryItem>>> = flow {
        emit(
            executeApiCall(
                apiName = "get_all_country_list",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.getAllCountryList() }
        )
    }

    fun sendOtp(request: SendOtpRequest): Flow<ApiResult<SendOtpResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "send_otp",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.sendOtp(request) }
        )
    }

    fun checkDeviceLimit(request: CheckDeviceRequest): Flow<ApiResult<SendOtpResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "check_device_user_limit",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.checkDeviceLimit(request) }
        )
    }

    fun whatsappVerification(request: WhatsappVerificationRequest): Flow<ApiResult<VerifyOtpResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "whatsapp_verification",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.getWhatsappVerificationLink(request) }
        )
    }

    fun verifyOtp(request: VerifyOtpRequest): Flow<ApiResult<VerifyOtpResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "verify_otp",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.verifyOtp(request) }
        )
    }

    fun getOtpMode(phoneCountryCode: String): Flow<ApiResult<GetOtpModeResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "get_otp_mode",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.getOtpMode(phoneCountryCode) }
        )
    }
}

// ---------------------------------------------------------------------------
// History / session — P2
// ---------------------------------------------------------------------------

class HistoryUseCase(
    private val repo: HistoryRepository
) : BaseUseCase() {

    fun getConversationList(userId: String, page: Int): Flow<ApiResult<ConversationListResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "get_conversation_list",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.getConversationLists(userId, page) }
        )
    }

    fun logoutApp(): Flow<ApiResult<LogoutResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "logout_app",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.logoutApp() }
        )
    }
}

// ---------------------------------------------------------------------------
// Help — P2
// ---------------------------------------------------------------------------

class GetHelpSupportUseCase(
    private val repo: HelpRepository
) : BaseUseCase() {

    fun getHelpSupport(
        lang: String,
        limit: Int = 5,
        theme: String? = null,
        country: String? = null
    ): Flow<ApiResult<HelpSupportResponse>> = flow {
        emit(
            executeApiCall(
                apiName = "get_help_support",
                priority = ApiPriority.PRIORITY_2_NO_FALLBACK
            ) { repo.getHelpSupport(lang, limit, theme, country) }
        )
    }
}
