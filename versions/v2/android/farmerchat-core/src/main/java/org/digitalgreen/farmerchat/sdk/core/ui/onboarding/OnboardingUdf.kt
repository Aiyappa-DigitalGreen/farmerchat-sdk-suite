package org.digitalgreen.farmerchat.sdk.core.ui.onboarding

import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.model.GeoRequestBody
import org.digitalgreen.farmerchat.sdk.core.model.GeoResponse
import org.digitalgreen.farmerchat.sdk.core.model.InitializeGuestUserResponse
import org.digitalgreen.farmerchat.sdk.core.model.SupportedLanguage

/** 1:1 port of the app's OnboardingAction (splash/udf). */
sealed interface OnboardingAction {
    /** -------- GEO -------- */
    data class FetchGeoLocation(
        val body: GeoRequestBody,
        val fromScreen: String = AnalyticsScreens.SPLASH
    ) : OnboardingAction

    data object ConsumeGeoResult : OnboardingAction

    /** -------- LANGUAGE -------- */
    data class FetchSupportedLanguages(
        val countryCode: String,
        val state: String
    ) : OnboardingAction

    data class SelectLanguage(
        val languageId: Int
    ) : OnboardingAction

    data class ApplyLanguageFromModal(
        val languageId: Int,
        val languageCode: String
    ) : OnboardingAction

    object FetchLegalLinks : OnboardingAction

    object GetStartedClicked : OnboardingAction

    /** Accept-terms API (best effort) when user taps "Start using FarmerChat". */
    object AcceptTerms : OnboardingAction

    data object ConsumeLanguageResult : OnboardingAction

    /** -------- ERROR NAVIGATION -------- */
    data object ConsumeErrorNavigation : OnboardingAction

    data object ResetState : OnboardingAction
}

/** 1:1 port of the app's OnboardingState (field names preserved, incl. `langauge_code` typo). */
data class OnboardingState(
    /** -------- GEO -------- */
    val geoState: UiState<GeoResponse> = UiState.Idle,

    /** -------- GUEST INIT -------- */
    val guestInitState: UiState<InitializeGuestUserResponse> = UiState.Idle,

    /** -------- LANGUAGE -------- */
    val languageState: UiState<List<SupportedLanguage>> = UiState.Idle,
    val expandedLanguages: List<SupportedLanguage> = emptyList(),
    val selectedLanguageId: Int? = null,
    var langauge_code: String? = null,
    val labelsRefreshToken: Long = 0L,
    val isFetchingLabels: Boolean = false,
    val fetchingLabelsForId: Int? = null,
    val isApplyingLanguageFromModal: Boolean = false,

    /** -------- LEGAL -------- */
    val privacyPolicyUrl: String? = null,
    val termsOfUseUrl: String? = null,

    /** -------- SUBMIT -------- */
    val isSubmittingLanguage: Boolean = false,
    val languageSubmitSuccess: Boolean = false,
    val submitErrorMessage: String? = null,

    /** -------- ERROR NAVIGATION -------- */
    val shouldNavigateToError: Boolean = false,
    val errorIsNetworkError: Boolean = true,
    val errorFromScreen: String = ""
)
