package org.digitalgreen.farmerchat.sdk.core.ui.home

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.analytics.FarmerChatAnalytics
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsApis
import org.digitalgreen.farmerchat.sdk.core.base.ApiResult
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.base.toUiError
import org.digitalgreen.farmerchat.sdk.core.model.HomeUdfResponse
import org.digitalgreen.farmerchat.sdk.core.model.ImageStatementRequest
import org.digitalgreen.farmerchat.sdk.core.model.ImageViewedRequest
import org.digitalgreen.farmerchat.sdk.core.model.NewConversationRequest
import org.digitalgreen.farmerchat.sdk.core.model.ProfileUser
import org.digitalgreen.farmerchat.sdk.core.model.SetCultivatedCropsRequest
import org.digitalgreen.farmerchat.sdk.core.model.SetVoiceRequest
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.CoreViewModel
import org.digitalgreen.farmerchat.sdk.core.usecase.ChatUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.GetUserProfileUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.HomeUseCase

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
    /** 2.0.0: owns accept_terms (#7) and privacy_policy (#4) for `TermsOfUseDialog`. */
    private val legalUseCase: org.digitalgreen.farmerchat.sdk.core.usecase.GetSupportedLanguagesUseCase
) : CoreViewModel() {

    private val _state = MutableStateFlow(HomeState())
    val state: StateFlow<HomeState> = _state

    fun onAction(action: HomeAction) {
        when (action) {
            is HomeAction.LoadHome -> loadHome(action)
            is HomeAction.LoadWeather -> loadWeather(action)
            is HomeAction.FetchUserProfile -> fetchUserProfile(action.userId)
            is HomeAction.UpdateCultivatedCrops -> updateCultivatedCrops(action)
            is HomeAction.NewConversation -> newConversation(action)
            is HomeAction.TranscribeAudio -> transcribeAudio(action)
            is HomeAction.AcceptTerms -> acceptTerms(action.userId)
            is HomeAction.FetchPolicyAcceptanceStatus -> fetchPolicyAcceptanceStatus(action.userId)
            is HomeAction.FetchPrivacyPolicy -> fetchPrivacyPolicy()
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
        if (!action.skipLoadingCheck && _state.value.homeFeedState is UiState.Loading) return
        _state.update { it.copy(homeFeedState = UiState.Loading) }
        scope.launch {
            // App HomeViewModel.kt:326 — API_Name = "Dashboard Content".
            analytics.trackApiInitiated(AnalyticsApis.HOME_FEED, AnalyticsScreens.HOME)
            homeUseCase.getDailyHomeSections(action.userDeviceTime, action.userId)
                .collect { result ->
                    when (result) {
                        is ApiResult.Success -> {
                            // App HomeViewModel.kt:351.
                            analytics.trackApiSuccess(AnalyticsApis.HOME_FEED, AnalyticsScreens.HOME)
                            _state.update { it.copy(homeFeedState = UiState.Success(result.data)) }
                            analytics.track(AnalyticsEvents.DASHBOARD_VIEWED)
                            // App HomeScreen.kt:2016 — gated on its OWN key
                            // (DashboardPreferenceManager), not the onboarding one.
                            if (!prefs.getBoolean(SdkPreferences.Keys.FIRST_TIME_DASHBOARD_VIEWED, false)) {
                                prefs.putBoolean(SdkPreferences.Keys.FIRST_TIME_DASHBOARD_VIEWED, true)
                                analytics.track(AnalyticsEvents.FIRST_TIME_DASHBOARD_VIEWED)
                            }
                        }
                        is ApiResult.Error -> {
                            // App HomeViewModel.kt:404 — Timeout vs Failed by isTimeout.
                            analytics.trackApiError(
                                AnalyticsApis.HOME_FEED, AnalyticsScreens.HOME, result.isTimeout
                            )
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

    /**
     * Accepts the terms of use (#7), from either the dismissible `TermsOfUseDialog` or the
     * mandatory acceptance gate's two CTAs. 1:1 port of the app's `HomeViewModel.acceptTerms`
     * (`HomeViewModel.kt:146`).
     *
     * **This must write [HomeState.acceptTermsState].** The gate's dismissal condition is
     * `requires_acceptance == true && acceptTermsState !is UiState.Success`, so a
     * fire-and-forget call here would leave the non-cancellable sheet on screen forever.
     * The `UiState.Error` branch is what re-enables its buttons for a retry.
     *
     * Guest / not-yet-provisioned users (blank or the literal `"null"` userId) are skipped so
     * the SDK never POSTs `user_id="null"` — same guard as [fetchPolicyAcceptanceStatus].
     */
    private fun acceptTerms(userId: String) {
        val isGuest = userId.isBlank() || userId.equals("null", ignoreCase = true)
        if (isGuest) return
        _state.update { it.copy(acceptTermsState = UiState.Loading) }
        scope.launch {
            legalUseCase.acceptTerms(
                org.digitalgreen.farmerchat.sdk.core.model.AcceptPPandTCRequest(user_id = userId)
            ).collect { result ->
                when (result) {
                    is ApiResult.Success ->
                        _state.update { it.copy(acceptTermsState = UiState.Success(result.data)) }
                    is ApiResult.Error ->
                        _state.update { it.copy(acceptTermsState = result.toUiError()) }
                }
            }
        }
    }

    /**
     * #7a — checks whether the user must (re-)accept the Terms of Use. Dispatched on every Home
     * entry so an updated policy version re-prompts. Drives the mandatory
     * `TermsOfUseUpdatedBottomSheet` via [HomeState.policyAcceptanceState]. 1:1 port of the
     * app's `HomeViewModel.fetchPolicyAcceptanceStatus` (`HomeViewModel.kt:176`).
     *
     * `acceptTermsState` is reset to `Idle` in the same update, verbatim from the app: a stale
     * `Success` left over from the dismissible `TermsOfUseDialog` earlier in this session would
     * otherwise suppress a freshly-required re-acceptance.
     *
     * Guests are skipped exactly as the app skips them — a *missing* userId only. Note that
     * `initialize_user` does persist a `user_id` for guests, and the backend answers
     * `requires_acceptance: true` for it (verified live, doc 02 §Endpoint #7a), so the gate
     * legitimately fires for guest sessions. That is app behaviour, not an SDK divergence.
     */
    private fun fetchPolicyAcceptanceStatus(userId: String) {
        val isGuest = userId.isBlank() || userId.equals("null", ignoreCase = true)
        if (isGuest) return
        _state.update {
            it.copy(policyAcceptanceState = UiState.Loading, acceptTermsState = UiState.Idle)
        }
        scope.launch {
            legalUseCase.fetchPolicyAcceptanceStatus(userId).collect { result ->
                when (result) {
                    is ApiResult.Success ->
                        _state.update { it.copy(policyAcceptanceState = UiState.Success(result.data)) }
                    is ApiResult.Error ->
                        _state.update { it.copy(policyAcceptanceState = result.toUiError()) }
                }
            }
        }
    }

    /** Fetches the legal links (#4) so `TermsOfUseDialog` can link out to the terms. */
    private fun fetchPrivacyPolicy() {
        scope.launch {
            run {
                // Collect rather than first()+is-check: `when` over ApiResult is the pattern
                // used everywhere else in this file, and it smart-casts without a star projection.
                legalUseCase.fetchPrivacyPolicy().collect { result ->
                    when (result) {
                        is ApiResult.Success ->
                            _state.update { it.copy(farmerchatTermsOfUse = result.data.termsOfUseUrl) }
                        is ApiResult.Error -> Unit  // legal links are best-effort
                    }
                }
            }
        }
    }

    private fun loadWeather(action: HomeAction.LoadWeather) {
        if (!action.skipLoadingCheck && _state.value.weatherState is UiState.Loading) return
        _state.update { it.copy(weatherState = UiState.Loading) }
        scope.launch {
            // App HomeViewModel.kt:468 — API_Name = "Weather".
            analytics.trackApiInitiated(AnalyticsApis.WEATHER, AnalyticsScreens.HOME)
            homeUseCase.getWeatherForecast(action.userId).collect { result ->
                when (result) {
                    is ApiResult.Success -> {
                        // App HomeViewModel.kt:489.
                        analytics.trackApiSuccess(AnalyticsApis.WEATHER, AnalyticsScreens.HOME)
                        _state.update { it.copy(weatherState = UiState.Success(result.data)) }
                    }
                    is ApiResult.Error -> {
                        // App HomeViewModel.kt:504.
                        analytics.trackApiError(
                            AnalyticsApis.WEATHER, AnalyticsScreens.HOME, result.isTimeout
                        )
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
        scope.launch {
            getUserProfileUseCase.fetchUserProfile(userId).collect { result ->
                if (result is ApiResult.Success) {
                    val profile = result.data.userProfile
                    val name = profile.displayName()
                    if (name.isNotBlank()) {
                        prefs.putString(SdkPreferences.Keys.USER_NAME, name)
                    }
                    backfillApproxLocationName(profile)
                }
            }
        }
    }

    /**
     * Fills the location pill's place name from the profile's geography when the local pref is
     * empty (app parity: `HomeViewModel.fetchUserProfile`, b72ea4da).
     *
     * `APPROX_LOCATION_NAME` is normally written by the GPS flow, from #16's `display_address`
     * ([LocationPromptManager]). A farmer who has geography saved SERVER-side but nothing in this
     * install's prefs therefore sees a name-less pill: a reinstall, a fresh host app, or any
     * already-onboarded user reaching Home without re-running the GPS flow. The profile already
     * carries the place, so fill it from there.
     *
     * NOTE this is NOT the app's stated reason. The app is repairing its own V1→V2 upgrade, where
     * the lat/lng prefs survived but `APPROX_LOCATION_NAME` was a V2-only key that had never been
     * written. The SDK has always had that key, so that premise does not apply — the mechanism is
     * ported, the rationale is the one above. Recorded in docs/05.
     *
     * Fill-WHEN-BLANK, never overwrite: a live GPS fix produces a more precise
     * `display_address` than the profile's coarse geography, and this runs on every Home entry.
     *
     * The app also seeds a second, never-overwritten `IP_APPROX_LOCATION_NAME` key. The SDK has
     * ONE approx-name key by design (documented at compose `HomeScreen.kt` `HomeLocationPill`),
     * so that half is deliberately not ported rather than inventing a key (CLAUDE.md §2).
     */
    private fun backfillApproxLocationName(profile: ProfileUser) {
        val placeName = profile.approxPlaceName() ?: return

        if (prefs.getString(SdkPreferences.Keys.APPROX_LOCATION_NAME, "").isBlank()) {
            prefs.putString(SdkPreferences.Keys.APPROX_LOCATION_NAME, placeName)
        }
        // Published UNCONDITIONALLY, not gated on the pref having been blank: the pill reads the
        // pref non-reactively, so this state write is the only thing that makes it recompose once
        // the async profile fetch lands.
        _state.update { it.copy(approxLocationName = placeName) }
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
                            // App HomeScreen.kt:1462 — `{screen_name, crops}`.
                            mapOf(
                                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME,
                                AnalyticsProps.CROPS to action.cropIds.joinToString(",")
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
        _state.update { it.copy(newConversationState = UiState.Loading) }
        scope.launch {
            chatUseCase.newConversation(
                NewConversationRequest(
                    user_id = action.userId,
                    content_provider_id = action.contentProviderId
                )
            ).collect { result ->
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

    /**
     * `{screen_name, Input_type, Source}` (+ `Confidence_Score` when supplied) — the app's
     * Home voice-overlay payload (app HomeScreen.kt:1670-1723).
     */
    private fun micProps(confidenceScore: String? = null): Map<String, Any?> = buildMap {
        put(AnalyticsProps.SCREEN_NAME, AnalyticsScreens.HOME)
        put(AnalyticsProps.INPUT_TYPE, "Audio")
        put(AnalyticsProps.SOURCE, "Mic")
        if (confidenceScore != null) put(AnalyticsProps.CONFIDENCE_SCORE, confidenceScore)
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
                        // App HomeScreen.kt:1684 / :1698 — always
                        // `{screen_name, Input_type, Source}`; `Confidence_Score` is added
                        // on FAILURE only, as a String ("N/A" when unavailable). The app
                        // never puts `audio_format` on a transcription event.
                        analytics.track(
                            if (accepted) AnalyticsEvents.TRANSCRIPTION_SUCCESS
                            else AnalyticsEvents.TRANSCRIPTION_FAILED,
                            if (accepted) micProps()
                            else micProps(data.confidence_score?.toString() ?: "N/A")
                        )
                        _state.update { it.copy(voiceTranscribeState = UiState.Success(data)) }
                    }
                    is ApiResult.Error -> {
                        // App HomeScreen.kt:1698 — "N/A" when the API itself failed.
                        analytics.track(AnalyticsEvents.TRANSCRIPTION_FAILED, micProps("N/A"))
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
                        // Card_Viewed is emitted by the UI layer on 50% visibility with the
                        // full HomeCardAnalytics payload (app HomeScreen.kt:2074), not here.
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
