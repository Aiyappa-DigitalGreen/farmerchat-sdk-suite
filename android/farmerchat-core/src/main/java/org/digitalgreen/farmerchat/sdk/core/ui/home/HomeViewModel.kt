package org.digitalgreen.farmerchat.sdk.core.ui.home

import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.FarmerChatAnalytics
import org.digitalgreen.farmerchat.sdk.core.base.ApiResult
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.base.toUiError
import org.digitalgreen.farmerchat.sdk.core.model.HomeUdfResponse
import org.digitalgreen.farmerchat.sdk.core.model.ImageStatementRequest
import org.digitalgreen.farmerchat.sdk.core.model.ImageViewedRequest
import org.digitalgreen.farmerchat.sdk.core.model.NewConversationRequest
import org.digitalgreen.farmerchat.sdk.core.model.SetCultivatedCropsRequest
import org.digitalgreen.farmerchat.sdk.core.model.SetVoiceRequest
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.CoreViewModel
import org.digitalgreen.farmerchat.sdk.core.usecase.ChatUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.GetUserProfileUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.HomeUseCase
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Home (dashboard) state machine. Port of the app's HomeViewModel over
 * HomeAction/HomeState. Feed errors stay in-state (HomeFeedErrorUI renders them
 * in place); weather/card errors are non-blocking.
 */
class HomeViewModel(
    private val homeUseCase: HomeUseCase,
    private val chatUseCase: ChatUseCase,
    private val getUserProfileUseCase: GetUserProfileUseCase,
    private val prefs: SdkPreferences,
    private val analytics: FarmerChatAnalytics,
    /** docs/02 Step 3 guest-replaced signal + guest generation. Null = no reload (tests). */
    private val guestReplacedSignal: org.digitalgreen.farmerchat.sdk.core.auth.GuestReplacedSignal? = null
) : CoreViewModel() {

    private val _state = MutableStateFlow(HomeState())
    val state: StateFlow<HomeState> = _state

    // ---- docs/02 Step 3: which entry loads this screen ran, so a guest replacement can re-run
    // them for the new user_id. Jobs are kept so the stale calls (built with the OLD user_id and
    // possibly still retrying) are cancelled and cannot overwrite the fresh results.
    private var feedRequested = false
    private var feedHadUserId = false
    private var weatherRequested = false
    private var profileRequested = false
    private var conversationRequested = false
    private var conversationContentProviderId: String? = null
    private var feedJob: Job? = null
    private var weatherJob: Job? = null
    private var profileJob: Job? = null
    private var conversationJob: Job? = null

    init {
        guestReplacedSignal?.let { signal -> scope.launch { signal.events.collect { onGuestReplaced() } } }
    }

    /** Current guest generation; a load whose captured value no longer matches drops its result. */
    private fun generation(): Int = guestReplacedSignal?.generation ?: 0

    /**
     * docs/02 Step 3: the 401 authenticator replaced a rejected guest with a new one. Everything
     * this screen loaded (and the conversation it created) was for the old user_id, so re-run the
     * entry loads with the new one — bypassing the "already loading" guards, since the stale call
     * may still be in flight — and clear the old place name so the profile backfill re-fills it.
     */
    private fun onGuestReplaced() {
        val userId = prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "").trim()
        listOf(feedJob, weatherJob, profileJob, conversationJob).forEach { it?.cancel() }
        if (conversationRequested && userId.isNotBlank()) {
            newConversation(userId, conversationContentProviderId)
        }
        if (profileRequested && userId.isNotBlank()) fetchUserProfile(userId)
        if (feedRequested) {
            loadHome(
                userDeviceTime = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).format(Date()),
                userId = if (feedHadUserId && userId.isNotBlank()) userId else null,
                skipLoadingCheck = true
            )
        }
        if (weatherRequested && userId.isNotBlank()) loadWeather(userId, skipLoadingCheck = true)
    }

    fun onAction(action: HomeAction) {
        when (action) {
            is HomeAction.LoadHome -> loadHome(action)
            is HomeAction.LoadWeather -> loadWeather(action)
            is HomeAction.FetchUserProfile -> {
                profileRequested = true
                fetchUserProfile(action.userId)
            }
            is HomeAction.UpdateCultivatedCrops -> updateCultivatedCrops(action)
            is HomeAction.NewConversation -> newConversation(action)
            is HomeAction.TranscribeAudio -> transcribeAudio(action)
            is HomeAction.MarkImageViewed -> markImageViewed(action)
            is HomeAction.FetchImageStatement -> fetchImageStatement(action)
            is HomeAction.ClearTranscriptionState ->
                _state.update { it.copy(voiceTranscribeState = UiState.Idle) }
            is HomeAction.ConsumeResult ->
                _state.update {
                    it.copy(
                        cropUpdateState = UiState.Idle,
                        imageStatementState = UiState.Idle
                    )
                }
            is HomeAction.SetLoadingState ->
                _state.update { it.copy(homeFeedState = UiState.Loading) }
        }
    }

    fun dismissCard(sectionId: String) {
        _state.update { it.copy(dismissedCardIds = it.dismissedCardIds + sectionId) }
    }

    // ------------------------------------------------------------------ feed

    private fun loadHome(action: HomeAction.LoadHome) {
        feedRequested = true
        feedHadUserId = action.userId != null
        loadHome(action.userDeviceTime, action.userId, action.skipLoadingCheck)
    }

    private fun loadHome(userDeviceTime: String, userId: String?, skipLoadingCheck: Boolean) {
        if (!skipLoadingCheck && _state.value.homeFeedState is UiState.Loading) return
        _state.update { it.copy(homeFeedState = UiState.Loading) }
        val gen = generation()
        feedJob = scope.launch {
            homeUseCase.getDailyHomeSections(userDeviceTime, userId)
                .collect { result ->
                    if (gen != generation()) return@collect  // stale: built for a replaced guest
                    when (result) {
                        is ApiResult.Success -> {
                            _state.update { it.copy(homeFeedState = UiState.Success(result.data)) }
                            analytics.track(AnalyticsEvents.DASHBOARD_VIEWED)
                            if (!prefs.getBoolean(SdkPreferences.Keys.FIRST_TIME_ONBOARDING_COMPLETED, false)) {
                                prefs.putBoolean(SdkPreferences.Keys.FIRST_TIME_ONBOARDING_COMPLETED, true)
                                analytics.track(AnalyticsEvents.FIRST_TIME_DASHBOARD_VIEWED)
                            }
                        }
                        is ApiResult.Error -> {
                            // 204 → empty feed is delivered by Retrofit as a null-body success;
                            // executeApiCall treats null body as an error, so surface an empty
                            // feed for 204s and a real error otherwise.
                            if (result.code == 204) {
                                _state.update {
                                    it.copy(
                                        homeFeedState = UiState.Success(
                                            HomeUdfResponse(greeting = null, sections = emptyList())
                                        )
                                    )
                                }
                            } else {
                                _state.update { it.copy(homeFeedState = result.toUiError()) }
                            }
                        }
                    }
                }
        }
    }

    private fun loadWeather(action: HomeAction.LoadWeather) {
        weatherRequested = true
        loadWeather(action.userId, action.skipLoadingCheck)
    }

    private fun loadWeather(userId: String, skipLoadingCheck: Boolean) {
        if (!skipLoadingCheck && _state.value.weatherState is UiState.Loading) return
        _state.update { it.copy(weatherState = UiState.Loading) }
        val gen = generation()
        weatherJob = scope.launch {
            homeUseCase.getWeatherForecast(userId).collect { result ->
                if (gen != generation()) return@collect  // stale: built for a replaced guest
                when (result) {
                    is ApiResult.Success -> {
                        _state.update { it.copy(weatherState = UiState.Success(result.data)) }
                    }
                    is ApiResult.Error -> {
                        // Weather chip failures are silent (chip just hides).
                        _state.update { it.copy(weatherState = result.toUiError()) }
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------------ profile / crops

    private fun fetchUserProfile(userId: String) {
        if (userId.isBlank()) return
        val gen = generation()
        profileJob = scope.launch {
            getUserProfileUseCase.fetchUserProfile(userId).collect { result ->
                if (gen != generation()) return@collect  // stale: built for a replaced guest
                if (result is ApiResult.Success) {
                    val name = result.data.userProfile.displayName()
                    if (name.isNotBlank()) {
                        prefs.putString(SdkPreferences.Keys.USER_NAME, name)
                    }
                }
            }
        }
    }

    private fun updateCultivatedCrops(action: HomeAction.UpdateCultivatedCrops) {
        _state.update { it.copy(cropUpdateState = UiState.Loading) }
        scope.launch {
            homeUseCase.updateCultivatedCrops(
                SetCultivatedCropsRequest(user_id = action.userId, crop_details = action.cropIds)
            ).collect { result ->
                when (result) {
                    is ApiResult.Success -> {
                        analytics.track(
                            AnalyticsEvents.QUESTION_CARD_DATA_SUBMITTED,
                            mapOf(
                                AnalyticsProps.CARD_TYPE to "crop",
                                AnalyticsProps.VALUE to action.cropIds.joinToString(",")
                            )
                        )
                        _state.update { it.copy(cropUpdateState = UiState.Success(result.data)) }
                    }
                    is ApiResult.Error ->
                        _state.update { it.copy(cropUpdateState = result.toUiError()) }
                }
            }
        }
    }

    // ------------------------------------------------------------------ conversation / voice

    private fun newConversation(action: HomeAction.NewConversation) {
        conversationRequested = true
        conversationContentProviderId = action.contentProviderId
        newConversation(action.userId, action.contentProviderId)
    }

    private fun newConversation(userId: String, contentProviderId: String?) {
        _state.update { it.copy(newConversationState = UiState.Loading) }
        val gen = generation()
        conversationJob = scope.launch {
            chatUseCase.newConversation(
                NewConversationRequest(
                    user_id = userId,
                    content_provider_id = contentProviderId
                )
            ).collect { result ->
                if (gen != generation()) return@collect  // stale: built for a replaced guest
                when (result) {
                    is ApiResult.Success -> {
                        prefs.putString(
                            SdkPreferences.Keys.NEW_CONVERSATION_ID,
                            result.data.conversation_id
                        )
                        _state.update { it.copy(newConversationState = UiState.Success(result.data)) }
                    }
                    is ApiResult.Error ->
                        _state.update { it.copy(newConversationState = result.toUiError()) }
                }
            }
        }
    }

    private fun transcribeAudio(action: HomeAction.TranscribeAudio) {
        _state.update { it.copy(voiceTranscribeState = UiState.Loading) }
        scope.launch {
            chatUseCase.transcribeAudio(
                SetVoiceRequest(
                    conversation_id = action.conversationId,
                    query = action.query,
                    message_reference_id = action.messageReferenceId,
                    input_audio_encoding_format = action.audioFormat,
                    triggered_input_type = action.triggeredType
                )
            ).collect { result ->
                when (result) {
                    is ApiResult.Success -> {
                        val data = result.data
                        val accepted = !data.error &&
                            (data.confidence_score ?: 0.0) > 0.7 &&
                            !data.heard_input_query.isNullOrBlank()
                        analytics.track(
                            if (accepted) AnalyticsEvents.TRANSCRIPTION_SUCCESS
                            else AnalyticsEvents.TRANSCRIPTION_FAILED,
                            mapOf(
                                AnalyticsProps.CONFIDENCE_SCORE to (data.confidence_score ?: 0.0),
                                AnalyticsProps.AUDIO_FORMAT to action.audioFormat
                            )
                        )
                        _state.update { it.copy(voiceTranscribeState = UiState.Success(data)) }
                    }
                    is ApiResult.Error -> {
                        analytics.track(
                            AnalyticsEvents.TRANSCRIPTION_FAILED,
                            mapOf(AnalyticsProps.CONFIDENCE_SCORE to "N/A")
                        )
                        _state.update { it.copy(voiceTranscribeState = result.toUiError()) }
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------------ cards

    private fun markImageViewed(action: HomeAction.MarkImageViewed) {
        scope.launch {
            homeUseCase.markImageViewed(
                ImageViewedRequest(statement_id = action.statementId, user_id = action.userId)
            ).collect { result ->
                when (result) {
                    is ApiResult.Success -> {
                        analytics.track(
                            AnalyticsEvents.CARD_VIEWED,
                            mapOf(AnalyticsProps.SENTENCE_ID to action.statementId)
                        )
                        _state.update { it.copy(imageViewedState = UiState.Success(result.data)) }
                    }
                    is ApiResult.Error ->
                        _state.update { it.copy(imageViewedState = result.toUiError()) }
                }
            }
        }
    }

    private fun fetchImageStatement(action: HomeAction.FetchImageStatement) {
        _state.update { it.copy(imageStatementState = UiState.Loading) }
        scope.launch {
            homeUseCase.getImageStatement(
                ImageStatementRequest(
                    statement_id = action.statementId,
                    triggered_input_type = action.triggered_input_type
                )
            ).collect { result ->
                when (result) {
                    is ApiResult.Success -> {
                        result.data.conversation_id?.let {
                            prefs.putString(SdkPreferences.Keys.NEW_CONVERSATION_ID, it)
                        }
                        _state.update { it.copy(imageStatementState = UiState.Success(result.data)) }
                    }
                    is ApiResult.Error ->
                        _state.update { it.copy(imageStatementState = result.toUiError()) }
                }
            }
        }
    }
}

/** Acceptance rule for a server transcription (doc 02): !error && confidence > 0.7 && text not blank. */
fun org.digitalgreen.farmerchat.sdk.core.model.GetVoiceResponse.isAcceptedTranscription(): Boolean =
    !error && (confidence_score ?: 0.0) > 0.7 && !heard_input_query.isNullOrBlank()
