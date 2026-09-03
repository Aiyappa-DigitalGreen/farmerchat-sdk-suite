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
import org.digitalgreen.farmerchat.sdk.core.location.CountryLatLngProvider
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.CoreViewModel
import org.digitalgreen.farmerchat.sdk.core.usecase.FetchGeoLocationUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.GetLanguageLabelsUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.GetSupportedLanguagesUseCase
import org.digitalgreen.farmerchat.sdk.FarmerChatConfig
import org.digitalgreen.farmerchat.sdk.core.usecase.UpdateUserLocationUseCase
import org.digitalgreen.farmerchat.sdk.core.model.UpdateLocationRequest

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
    private val appContext: android.content.Context,
    private val fetchGeoLocationUseCase: FetchGeoLocationUseCase,
    private val getSupportedLanguagesUseCase: GetSupportedLanguagesUseCase,
    private val getLanguageLabelsUseCase: GetLanguageLabelsUseCase,
    private val sessionManager: SessionManager,
    private val labelManager: LabelManager,
    private val prefs: SdkPreferences,
    private val analytics: FarmerChatAnalytics,
    private val config: FarmerChatConfig,
    private val updateUserLocationUseCase: UpdateUserLocationUseCase
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
                    // P1 fallback endpoint — tolerated failure. The app does NOT then proceed
                    // with no coordinates: it falls back to the DEVICE LOCALE's country centroid
                    // (`CountryLatLngProvider.getLatLngFromDeviceLocale`) and accepts it only when
                    // `lat != 0.0 && lng != 0.0`. A locale with no region yields (0.0, 0.0), which
                    // must stay unresolved — sending it would place the farmer off West Africa.
                    _state.update { it.copy(geoState = geo.toUiError()) }
                    val (_, localeLat, localeLng) = resolveFallbackCoordinates()
                    if (CountryLatLngProvider.isResolved(localeLat, localeLng)) {
                        lat = localeLat
                        lng = localeLng
                        accuracy = 0.0
                    }
                }
            }

            _state.update { it.copy(guestInitState = UiState.Loading) }
            when (val init = sessionManager.initializeGuestUser(lat, lng, accuracy)) {
                is ApiResult.Success -> {
                    _state.update { it.copy(guestInitState = UiState.Success(init.data)) }
                    // Endpoint #2 400s on a blank `country_code`, and a fresh guest on an
                    // unresolvable IP comes back with country_code == null. Fall through to the
                    // persisted value, then to the host-configured default, never to "".
                    val countryCode = init.data.country_code?.takeIf { it.isNotBlank() }
                        ?: prefs.getString(SdkPreferences.Keys.USER_COUNTRY_CODE, "")
                            .takeIf { it.isNotBlank() }
                        ?: config.resolvedFallbackCountryCode(appContext)
                    val stateName = init.data.state?.takeIf { it.isNotBlank() }
                        ?: prefs.getString(SdkPreferences.Keys.USER_SELECTED_STATE_CODE, "")
                            .takeIf { it.isNotBlank() }
                        ?: config.defaultStateCode
                    // GUEST HOME FIX: endpoint #12 returns an EMPTY feed until the backend has
                    // a resolved location for this user, and it resolves one ONLY from
                    // coordinates (verified live 2026-09-01: a country name alone is rejected).
                    // A guest whose IP the backend cannot place — and who never reaches the GPS
                    // prompt — would otherwise land on a permanently blank home screen.
                    // Seeding #11 with the configured default region guarantees a populated feed.
                    if (init.data.country_code.isNullOrBlank()) {
                        seedDefaultLocation()
                    }
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

    /**
     * The coordinates to use when neither guest init nor GPS resolved a location.
     *
     * Order: the host's explicit config override, then the DEVICE LOCALE's country centroid —
     * the app's own fallback (`CountryLatLngProvider.getLatLngFromDeviceLocale`). Returns
     * (code, 0.0, 0.0) when neither is available, which callers must treat as "no location";
     * see [CountryLatLngProvider.isResolved].
     *
     * There is deliberately NO hardcoded city here. A previous build defaulted to Bengaluru,
     * so every guest the backend could not place — anywhere on earth — was told about Karnataka.
     */
    private fun resolveFallbackCoordinates(): Triple<String, Double, Double> {
        val (lat, lng) = config.resolvedFallbackCoordinates(appContext)
        return Triple(config.resolvedFallbackCountryCode(appContext), lat, lng)
    }

    /**
     * Posts the configured default coordinates to endpoint #11 so a guest with no resolvable
     * location still gets a home feed. Best-effort: a failure just leaves the feed empty, which
     * is the pre-existing behaviour, so it never blocks onboarding.
     */
    private suspend fun seedDefaultLocation() {
        val userId = prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "")
        if (userId.isBlank()) return
        val (lat, lng) = resolveFallbackCoordinates().let { it.second to it.third }
        // Nothing resolved — not the host's config, not the device locale. Send nothing rather
        // than guess: an unplaceable guest gets an empty feed, which is honest, where a guessed
        // city would silently give them another country's advice.
        if (!CountryLatLngProvider.isResolved(lat, lng)) return
        val result = updateUserLocationUseCase.updateUserLocation(
            UpdateLocationRequest(
                lat = lat.toString(),
                long = lng.toString(),
                user_id = userId
            )
        ).first()
        if (result is ApiResult.Success) {
            result.data.user_profile?.let { profile ->
                profile.country_code?.takeIf { it.isNotBlank() }?.let {
                    prefs.putString(SdkPreferences.Keys.USER_COUNTRY_CODE, it)
                }
                profile.geography_level2_name?.takeIf { it.isNotBlank() }?.let {
                    prefs.putString(SdkPreferences.Keys.USER_SELECTED_STATE_CODE, it)
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
