package org.digitalgreen.farmerchat.sdk.core.repository

import org.digitalgreen.farmerchat.sdk.core.model.AcceptPPandTCRequest
import org.digitalgreen.farmerchat.sdk.core.model.CheckDeviceRequest
import org.digitalgreen.farmerchat.sdk.core.model.GeoRequestBody
import org.digitalgreen.farmerchat.sdk.core.model.ImageStatementRequest
import org.digitalgreen.farmerchat.sdk.core.model.ImageViewedRequest
import org.digitalgreen.farmerchat.sdk.core.model.InitializeGuestUserRequest
import org.digitalgreen.farmerchat.sdk.core.model.NewConversationRequest
import org.digitalgreen.farmerchat.sdk.core.model.PlantixRequest
import org.digitalgreen.farmerchat.sdk.core.model.SendOtpRequest
import org.digitalgreen.farmerchat.sdk.core.model.SetCultivatedCropsRequest
import org.digitalgreen.farmerchat.sdk.core.model.SetPreferredLanguageRequest
import org.digitalgreen.farmerchat.sdk.core.model.SetVoiceRequest
import org.digitalgreen.farmerchat.sdk.core.model.SynthesiseAudioRequest
import org.digitalgreen.farmerchat.sdk.core.model.TextPromptRequest
import org.digitalgreen.farmerchat.sdk.core.model.UpdateBuildVersionRequest
import org.digitalgreen.farmerchat.sdk.core.model.UpdateLocationRequest
import org.digitalgreen.farmerchat.sdk.core.model.UserNameRequest
import org.digitalgreen.farmerchat.sdk.core.model.VerifyOtpRequest
import org.digitalgreen.farmerchat.sdk.core.model.WhatsappVerificationRequest
import org.digitalgreen.farmerchat.sdk.core.model.FollowUpQuestionClickRequest
import org.digitalgreen.farmerchat.sdk.core.model.followUpQuestionsRequestMoengage
import org.digitalgreen.farmerchat.sdk.core.remote.ApiServices
import org.digitalgreen.farmerchat.sdk.core.remote.GoogleGeoApi

/**
 * One repository per feature (thin suspend wrappers returning Retrofit Response<T>),
 * mirroring the production app's data/repository layer.
 */

class GeoRepository(private val geoApi: GoogleGeoApi) {
    suspend fun geolocate(apiKey: String, body: GeoRequestBody = GeoRequestBody()) =
        geoApi.geolocate(apiKey, body)
}

class GuestAuthRepository(private val api: ApiServices) {
    suspend fun initializeGuestUser(apiKey: String, body: InitializeGuestUserRequest) =
        api.initializeGuestUser(apiKey, body)
}

class LanguageRepository(private val api: ApiServices) {
    suspend fun getSupportedLanguages(countryCode: String, state: String) =
        api.getSupportedLanguages(countryCode, state)

    suspend fun getLanguageLabels(languageId: Int) = api.getLanguageLabels(languageId)

    suspend fun fetchPrivacyPolicy() = api.fetchPrivacyPolicy()

    suspend fun setPreferredLanguage(request: SetPreferredLanguageRequest) =
        api.setPreferredLanguage(request)

    suspend fun acceptTerms(request: AcceptPPandTCRequest) = api.acceptTerms(request)
}

class NameRepository(private val api: ApiServices) {
    suspend fun updateUserName(request: UserNameRequest) = api.updateUserName(request)
}

class ProfileRepository(private val api: ApiServices) {
    suspend fun fetchUserProfile(userId: String) = api.fetchUserProfile(userId)

    suspend fun updateBuildVersion(request: UpdateBuildVersionRequest) =
        api.updateBuildVersion(request)
}

class LocationRepository(private val api: ApiServices) {
    suspend fun updateUserLocation(request: UpdateLocationRequest) =
        api.updateUserLocation(request)
}

class HomeRepository(private val api: ApiServices) {
    suspend fun getDailyHomeSections(userDeviceTime: String, userId: String?) =
        api.getDailyHomeSections(userDeviceTime, userId)

    suspend fun getWeatherForecast(userId: String) =
        api.getWeatherForecast(mapOf("user_id" to userId))

    suspend fun updateCultivatedCrops(request: SetCultivatedCropsRequest) =
        api.updateCultivatedCrops(request)

    suspend fun markImageViewed(request: ImageViewedRequest) = api.markImageViewed(request)

    suspend fun getImageStatement(request: ImageStatementRequest) = api.getImageStatement(request)

    suspend fun getUserQuestionCount() = api.getUserQuestionCount()
}

class ChatRepository(private val api: ApiServices) {
    suspend fun newConversation(request: NewConversationRequest) = api.newConversation(request)

    suspend fun transcribeAudio(request: SetVoiceRequest) = api.transcribeAudio(request)

    suspend fun getTextPrompt(request: TextPromptRequest) = api.getTextPrompt(request)

    suspend fun getPlantix(request: PlantixRequest) = api.getPlantix(request)

    suspend fun getFollowUpQuestions(messageId: String, useLatestPrompt: Boolean = true) =
        api.getFollowUpQuestions(messageId, useLatestPrompt)

    suspend fun trackFollowUpQuestionClick(request: FollowUpQuestionClickRequest) =
        api.trackFollowUpQuestionClick(request)

    suspend fun synthesiseAudio(request: SynthesiseAudioRequest) = api.synthesiseAudio(request)

    suspend fun getChatHistory(conversationId: String, page: Int) =
        api.getChatHistory(conversationId, page)

    suspend fun addQueryToHistory(request: followUpQuestionsRequestMoengage) =
        api.followUpQuestionsMoengage(request)
}

class AuthRepository(private val api: ApiServices) {
    suspend fun sendOtp(request: SendOtpRequest) = api.sendOTP(request)

    suspend fun checkDeviceLimit(request: CheckDeviceRequest) = api.checkDeviceLimit(request)

    suspend fun getWhatsappVerificationLink(request: WhatsappVerificationRequest) =
        api.getWhatsappVerificationLink(request)

    suspend fun getOtpMode(phoneCountryCode: String) = api.getOtpViaSmsWhatsapp(phoneCountryCode)

    suspend fun verifyOtp(request: VerifyOtpRequest) = api.verifyOTP(request)

    suspend fun getAllCountryList() = api.getAllCountryList()
}

class HistoryRepository(private val api: ApiServices) {
    suspend fun getConversationLists(userId: String, page: Int) =
        api.getConversationLists(userId, page)

    suspend fun logoutApp() = api.logoutApp()
}

class HelpRepository(private val api: ApiServices) {
    suspend fun getHelpSupport(lang: String, limit: Int, theme: String?, country: String?) =
        api.getHelpSupport(lang, limit, theme, country)
}
