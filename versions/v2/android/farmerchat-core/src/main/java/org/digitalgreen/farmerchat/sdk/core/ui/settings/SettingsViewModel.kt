package org.digitalgreen.farmerchat.sdk.core.ui.settings

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
import org.digitalgreen.farmerchat.sdk.core.labels.LabelManager
import org.digitalgreen.farmerchat.sdk.core.model.SetPreferredLanguageRequest
import org.digitalgreen.farmerchat.sdk.core.model.SupportedLanguage
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.CoreViewModel
import org.digitalgreen.farmerchat.sdk.core.usecase.GetLanguageLabelsUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.GetSupportedLanguagesUseCase
import org.digitalgreen.farmerchat.sdk.FarmerChatConfig

/**
 * Settings → Language chooser state machine (port of the app's SettingsViewModel
 * over LanguageSettingsState). Language list + per-row label fetch + submit.
 */
class SettingsViewModel(
    private val appContext: android.content.Context,
    private val getSupportedLanguagesUseCase: GetSupportedLanguagesUseCase,
    private val getLanguageLabelsUseCase: GetLanguageLabelsUseCase,
    private val labelManager: LabelManager,
    private val prefs: SdkPreferences,
    private val analytics: FarmerChatAnalytics,
    private val config: FarmerChatConfig
) : CoreViewModel() {

    private val _state = MutableStateFlow(LanguageSettingsState())
    val state: StateFlow<LanguageSettingsState> = _state

    private var allLanguages: List<SupportedLanguage> = emptyList()

    fun loadLanguages() {
        _state.update { it.copy(languageState = UiState.Loading) }
        // Same guard as onboarding: endpoint #2 400s on a blank `country_code`, and the pref is
        // empty whenever guest init never resolved one.
        // resolvedFallbackCountryCode, never config.defaultCountryCode: that field defaults to
        // "" (meaning "derive from the device locale"), so a raw read sends a blank value and 400s.
        val countryCode = prefs.getString(SdkPreferences.Keys.USER_COUNTRY_CODE, "")
            .takeIf { it.isNotBlank() } ?: config.resolvedFallbackCountryCode(appContext)
        val stateName = prefs.getString(SdkPreferences.Keys.USER_SELECTED_STATE_CODE, "")
            .takeIf { it.isNotBlank() } ?: config.defaultStateCode
        scope.launch {
            // App SettingsViewModel.kt:53 — attributed to the Select Language screen.
            analytics.trackApiInitiated(AnalyticsApis.GET_LANGUAGES, AnalyticsScreens.LANGUAGE)
            getSupportedLanguagesUseCase.getSupportedLanguages(countryCode, stateName)
                .collect { result ->
                    when (result) {
                        is ApiResult.Success -> {
                            // App SettingsViewModel.kt:70.
                            analytics.trackApiSuccess(
                                AnalyticsApis.GET_LANGUAGES, AnalyticsScreens.LANGUAGE
                            )
                            val groups = result.data
                            val priority = groups.flatMap { it.priorityView }
                            val expanded = groups.flatMap { it.expandedView }
                            allLanguages = priority + expanded
                            val savedId = prefs.getInt(SdkPreferences.Keys.SELECTED_LANGUAGE_ID, -1)
                            _state.update {
                                it.copy(
                                    languageState = UiState.Success(priority),
                                    expandedLanguages = expanded,
                                    selectedLanguageId = savedId.takeIf { id -> id > 0 },
                                    languageCode = prefs.getString(
                                        SdkPreferences.Keys.SELECTED_LANGUAGE_CODE, ""
                                    ).ifBlank { null }
                                )
                            }
                        }
                        is ApiResult.Error -> {
                            // App SettingsViewModel.kt:107/119.
                            analytics.trackApiError(
                                AnalyticsApis.GET_LANGUAGES,
                                AnalyticsScreens.LANGUAGE,
                                result.isTimeout
                            )
                            _state.update { it.copy(languageState = result.toUiError()) }
                        }
                    }
                }
        }
    }

    fun selectLanguage(languageId: Int, languageCode: String) {
        if (_state.value.isFetchingLabels && _state.value.fetchingLabelsForId == languageId) return
        _state.update {
            it.copy(
                selectedLanguageId = languageId,
                languageCode = languageCode,
                isFetchingLabels = true,
                fetchingLabelsForId = languageId
            )
        }
        scope.launch {
            getLanguageLabelsUseCase.getLanguageLabels(languageId).collect { result ->
                when (result) {
                    is ApiResult.Success -> {
                        labelManager.saveLabels(result.data)
                        _state.update {
                            it.copy(
                                isFetchingLabels = false,
                                fetchingLabelsForId = null,
                                labelsRefreshToken = System.currentTimeMillis()
                            )
                        }
                    }
                    is ApiResult.Error -> {
                        // Labels fetch failure → caller routes via onFetchLabelsFailure.
                        _state.update {
                            it.copy(
                                isFetchingLabels = false,
                                fetchingLabelsForId = null,
                                languageState = result.toUiError()
                            )
                        }
                    }
                }
            }
        }
    }

    fun submitLanguage() {
        val languageId = _state.value.selectedLanguageId ?: return
        if (_state.value.isSubmittingLanguage) return
        val userId = prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "")
        _state.update { it.copy(isSubmittingLanguage = true, submitErrorMessage = null) }
        scope.launch {
            // App SettingsViewModel.kt:215 — attributed to the Language Settings screen.
            analytics.trackApiInitiated(
                AnalyticsApis.SET_LANGUAGE, AnalyticsScreens.LANGUAGE_SETTINGS
            )
            getSupportedLanguagesUseCase.setPreferredLanguage(
                SetPreferredLanguageRequest(user_id = userId, language_id = languageId.toString())
            ).collect { result ->
                when (result) {
                    is ApiResult.Success -> {
                        // App SettingsViewModel.kt:234.
                        analytics.trackApiSuccess(
                            AnalyticsApis.SET_LANGUAGE, AnalyticsScreens.LANGUAGE_SETTINGS
                        )
                        val language = allLanguages.firstOrNull { it.id == languageId }
                        prefs.putInt(SdkPreferences.Keys.SELECTED_LANGUAGE_ID, languageId)
                        language?.let {
                            prefs.putString(SdkPreferences.Keys.SELECTED_LANGUAGE_CODE, it.code)
                            prefs.putString(SdkPreferences.Keys.SELECTED_LANGUAGE_DISPLAY_NAME, it.displayName)
                            prefs.putBoolean(SdkPreferences.Keys.ASR_ENABLED, it.isAsrEnabled)
                            prefs.putBoolean(SdkPreferences.Keys.TTS_ENABLED, it.isTtsEnabled)
                            // Per-language; sent as TextPromptRequest.streaming_required (app parity).
                            prefs.putBoolean(
                                SdkPreferences.Keys.STREAMING_REQUIRED, it.streaming_required
                            )
                        }
                        // The backend now has this language for the user; a host sharing that user
                        // keeps its own language state in step through this hook.
                        runCatching {
                            config.hooks.onLanguageChanged?.invoke(languageId, language?.code.orEmpty())
                        }
                        analytics.track(
                            AnalyticsEvents.SAVE_LANGUAGE_CLICK,
                            // App LanguageChooserScreen.kt:295 — Language Settings Screen.
                            mapOf(
                                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.LANGUAGE_SETTINGS,
                                AnalyticsProps.LANGUAGE_CODE to _state.value.languageCode
                            )
                        )
                        _state.update {
                            it.copy(isSubmittingLanguage = false, languageSubmitSuccess = true)
                        }
                    }
                    is ApiResult.Error -> {
                        // App SettingsViewModel.kt:290/302.
                        analytics.trackApiError(
                            AnalyticsApis.SET_LANGUAGE,
                            AnalyticsScreens.LANGUAGE_SETTINGS,
                            result.isTimeout
                        )
                        _state.update {
                            it.copy(isSubmittingLanguage = false, submitErrorMessage = result.message)
                        }
                    }
                }
            }
        }
    }

    fun consumeLanguageResult() {
        _state.update { it.copy(languageSubmitSuccess = false, submitErrorMessage = null) }
    }
}
