package org.digitalgreen.farmerchat.sdk.core.ui.onboarding

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.FarmerChatAnalytics
import org.digitalgreen.farmerchat.sdk.core.auth.SessionManager
import org.digitalgreen.farmerchat.sdk.core.base.ApiResult
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.base.isNetworkError
import org.digitalgreen.farmerchat.sdk.core.base.toUiError
import org.digitalgreen.farmerchat.sdk.core.labels.LabelManager
import org.digitalgreen.farmerchat.sdk.core.model.AcceptPPandTCRequest
import org.digitalgreen.farmerchat.sdk.core.model.SetPreferredLanguageRequest
import org.digitalgreen.farmerchat.sdk.core.model.SupportedLanguage
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.CoreViewModel
import org.digitalgreen.farmerchat.sdk.core.usecase.FetchGeoLocationUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.GetLanguageLabelsUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.GetSupportedLanguagesUseCase

/**
 * Shared onboarding state machine driving Splash + Language screens
 * (port of the app's OnboardingSharedViewModel over splash/udf classes).
 *
 * Flow: FetchGeoLocation (P1, geolocate — fallback tolerated) → guest init
 * (endpoint #1, issues tokens) → FetchSupportedLanguages → SelectLanguage
 * (fetch labels for id) → GetStartedClicked (set_preferred_language) +
 * AcceptTerms (best-effort).
 */
class OnboardingSharedViewModel(
    private val fetchGeoLocationUseCase: FetchGeoLocationUseCase,
    private val getSupportedLanguagesUseCase: GetSupportedLanguagesUseCase,
    private val getLanguageLabelsUseCase: GetLanguageLabelsUseCase,
    private val sessionManager: SessionManager,
    private val labelManager: LabelManager,
    private val prefs: SdkPreferences,
    private val analytics: FarmerChatAnalytics
) : CoreViewModel() {

    private val _state = MutableStateFlow(OnboardingState())
    val state: StateFlow<OnboardingState> = _state

    /** Flat list of priority languages + a lookup of expanded ("All languages") entries. */
    private var allLanguages: List<SupportedLanguage> = emptyList()

    fun onAction(action: OnboardingAction) {
        when (action) {
            is OnboardingAction.FetchGeoLocation -> fetchGeoAndInitialize(action)
            is OnboardingAction.ConsumeGeoResult ->
                _state.update { it.copy(geoState = UiState.Idle) }
            is OnboardingAction.FetchSupportedLanguages ->
                fetchSupportedLanguages(action.countryCode, action.state)
            is OnboardingAction.SelectLanguage -> selectLanguage(action.languageId)
            is OnboardingAction.ApplyLanguageFromModal ->
                applyLanguageFromModal(action.languageId, action.languageCode)
            is OnboardingAction.FetchLegalLinks -> fetchLegalLinks()
            is OnboardingAction.GetStartedClicked -> submitLanguage()
            is OnboardingAction.AcceptTerms -> acceptTerms()
            is OnboardingAction.ConsumeLanguageResult ->
                _state.update {
                    it.copy(
                        languageSubmitSuccess = false,
                        submitErrorMessage = null,
                        isSubmittingLanguage = false
                    )
                }
            is OnboardingAction.ConsumeErrorNavigation ->
                _state.update {
                    it.copy(shouldNavigateToError = false, errorIsNetworkError = true, errorFromScreen = "")
                }
            is OnboardingAction.ResetState -> _state.value = OnboardingState()
        }
    }

    // ------------------------------------------------------------------ geo + guest init

    private fun fetchGeoAndInitialize(action: OnboardingAction.FetchGeoLocation) {
        if (_state.value.guestInitState is UiState.Success &&
            _state.value.languageState is UiState.Success
        ) {
            return
        }
        _state.update { it.copy(geoState = UiState.Loading) }
        scope.launch {
            var lat: Double? = null
            var lng: Double? = null
            var accuracy: Double? = null

            when (val geo = fetchGeoLocationUseCase.fetchGeoLocation(action.body).first()) {
                is ApiResult.Success -> {
                    lat = geo.data.location?.lat
                    lng = geo.data.location?.lng
                    accuracy = geo.data.accuracy
                    _state.update { it.copy(geoState = UiState.Success(geo.data)) }
                }
                is ApiResult.Error -> {
                    // P1 fallback endpoint — tolerated failure; guest init proceeds IP-based.
                    _state.update { it.copy(geoState = geo.toUiError()) }
                }
            }

            _state.update { it.copy(guestInitState = UiState.Loading) }
            when (val init = sessionManager.initializeGuestUser(lat, lng, accuracy)) {
                is ApiResult.Success -> {
                    _state.update { it.copy(guestInitState = UiState.Success(init.data)) }
                    val countryCode = init.data.country_code
                        ?: prefs.getString(SdkPreferences.Keys.USER_COUNTRY_CODE, "")
                    val stateName = init.data.state
                        ?: prefs.getString(SdkPreferences.Keys.USER_SELECTED_STATE_CODE, "")
                    fetchSupportedLanguages(countryCode, stateName)
                }
                is ApiResult.Error -> {
                    _state.update {
                        it.copy(
                            guestInitState = init.toUiError(),
                            shouldNavigateToError = true,
                            errorIsNetworkError = init.isNetworkError(),
                            errorFromScreen = action.fromScreen
                        )
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------------ languages

    private fun fetchSupportedLanguages(countryCode: String, stateName: String) {
        _state.update { it.copy(languageState = UiState.Loading) }
        scope.launch {
            getSupportedLanguagesUseCase.getSupportedLanguages(countryCode, stateName)
                .collect { result ->
                    when (result) {
                        is ApiResult.Success -> {
                            val groups = result.data
                            val priority = groups.flatMap { it.priorityView }
                            val expanded = groups.flatMap { it.expandedView }
                            allLanguages = priority + expanded
                            _state.update {
                                it.copy(
                                    languageState = UiState.Success(priority),
                                    expandedLanguages = expanded
                                )
                            }
                            // Preselect persisted or config-provided language when present.
                            val savedId = prefs.getInt(SdkPreferences.Keys.SELECTED_LANGUAGE_ID, -1)
                            if (savedId > 0 && allLanguages.any { it.id == savedId }) {
                                _state.update { it.copy(selectedLanguageId = savedId) }
                            }
                        }
                        is ApiResult.Error -> {
                            _state.update { it.copy(languageState = result.toUiError()) }
                        }
                    }
                }
        }
    }

    private fun selectLanguage(languageId: Int) {
        if (_state.value.isFetchingLabels && _state.value.fetchingLabelsForId == languageId) return
        val language = allLanguages.firstOrNull { it.id == languageId } ?: return
        _state.update {
            it.copy(
                selectedLanguageId = languageId,
                langauge_code = language.code,
                isFetchingLabels = true,
                fetchingLabelsForId = languageId
            )
        }
        scope.launch {
            getLanguageLabelsUseCase.getLanguageLabels(languageId).collect { result ->
                when (result) {
                    is ApiResult.Success -> {
                        labelManager.saveLabels(result.data)
                        prefs.putInt(SdkPreferences.Keys.SELECTED_LANGUAGE_ID, languageId)
                        prefs.putString(SdkPreferences.Keys.SELECTED_LANGUAGE_CODE, language.code)
                        prefs.putString(SdkPreferences.Keys.SELECTED_LANGUAGE_DISPLAY_NAME, language.displayName)
                        prefs.putBoolean(SdkPreferences.Keys.ASR_ENABLED, language.isAsrEnabled)
                        prefs.putBoolean(SdkPreferences.Keys.TTS_ENABLED, language.isTtsEnabled)
                        _state.update {
                            it.copy(
                                isFetchingLabels = false,
                                fetchingLabelsForId = null,
                                labelsRefreshToken = System.currentTimeMillis()
                            )
                        }
                    }
                    is ApiResult.Error -> {
                        _state.update { it.copy(isFetchingLabels = false, fetchingLabelsForId = null) }
                    }
                }
            }
        }
    }

    private fun applyLanguageFromModal(languageId: Int, languageCode: String) {
        _state.update { it.copy(isApplyingLanguageFromModal = true) }
        selectLanguage(languageId)
        _state.update { it.copy(langauge_code = languageCode, isApplyingLanguageFromModal = false) }
    }

    // ------------------------------------------------------------------ legal

    private fun fetchLegalLinks() {
        if (_state.value.privacyPolicyUrl != null && _state.value.termsOfUseUrl != null) return
        scope.launch {
            getSupportedLanguagesUseCase.fetchPrivacyPolicy().collect { result ->
                if (result is ApiResult.Success) {
                    _state.update {
                        it.copy(
                            privacyPolicyUrl = result.data.privacyPolicyUrl,
                            termsOfUseUrl = result.data.termsOfUseUrl
                        )
                    }
                }
            }
        }
    }

    private fun acceptTerms() {
        val userId = prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "")
        if (userId.isBlank()) return
        scope.launch {
            // Best-effort — failures do not block onboarding.
            getSupportedLanguagesUseCase.acceptTerms(AcceptPPandTCRequest(user_id = userId))
                .collect { }
        }
    }

    // ------------------------------------------------------------------ submit

    private fun submitLanguage() {
        val languageId = _state.value.selectedLanguageId ?: return
        val userId = prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "")
        if (_state.value.isSubmittingLanguage) return
        _state.update { it.copy(isSubmittingLanguage = true, submitErrorMessage = null) }
        analytics.track(
            AnalyticsEvents.SAVE_LANGUAGE_CLICK,
            mapOf(AnalyticsProps.LANGUAGE_CODE to _state.value.langauge_code)
        )
        scope.launch {
            getSupportedLanguagesUseCase.setPreferredLanguage(
                SetPreferredLanguageRequest(user_id = userId, language_id = languageId.toString())
            ).collect { result ->
                when (result) {
                    is ApiResult.Success -> {
                        prefs.putBoolean(SdkPreferences.Keys.LANGUAGE_DONE, true)
                        analytics.track(AnalyticsEvents.ONBOARDING_COMPLETED_STEP1)
                        _state.update {
                            it.copy(isSubmittingLanguage = false, languageSubmitSuccess = true)
                        }
                    }
                    is ApiResult.Error -> {
                        _state.update {
                            it.copy(
                                isSubmittingLanguage = false,
                                submitErrorMessage = result.message,
                                shouldNavigateToError = true,
                                errorIsNetworkError = result.isNetworkError(),
                                errorFromScreen = "language"
                            )
                        }
                    }
                }
            }
        }
    }
}
