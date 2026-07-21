package org.digitalgreen.farmerchat.sdk.core.ui.settings

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
import org.digitalgreen.farmerchat.sdk.core.labels.LabelManager
import org.digitalgreen.farmerchat.sdk.core.model.SetPreferredLanguageRequest
import org.digitalgreen.farmerchat.sdk.core.model.SupportedLanguage
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.CoreViewModel
import org.digitalgreen.farmerchat.sdk.core.usecase.GetLanguageLabelsUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.GetSupportedLanguagesUseCase

/**
 * Settings → Language chooser state machine (port of the app's SettingsViewModel
 * over LanguageSettingsState). Language list + per-row label fetch + submit.
 */
class SettingsViewModel(
    private val getSupportedLanguagesUseCase: GetSupportedLanguagesUseCase,
    private val getLanguageLabelsUseCase: GetLanguageLabelsUseCase,
    private val labelManager: LabelManager,
    private val prefs: SdkPreferences,
    private val analytics: FarmerChatAnalytics
) : CoreViewModel() {

    private val _state = MutableStateFlow(LanguageSettingsState())
    val state: StateFlow<LanguageSettingsState> = _state

    private var allLanguages: List<SupportedLanguage> = emptyList()

    fun loadLanguages() {
        _state.update { it.copy(languageState = UiState.Loading) }
        val countryCode = prefs.getString(SdkPreferences.Keys.USER_COUNTRY_CODE, "")
        val stateName = prefs.getString(SdkPreferences.Keys.USER_SELECTED_STATE_CODE, "")
        scope.launch {
            getSupportedLanguagesUseCase.getSupportedLanguages(countryCode, stateName)
                .collect { result ->
                    when (result) {
                        is ApiResult.Success -> {
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
            getSupportedLanguagesUseCase.setPreferredLanguage(
                SetPreferredLanguageRequest(user_id = userId, language_id = languageId.toString())
            ).collect { result ->
                when (result) {
                    is ApiResult.Success -> {
                        val language = allLanguages.firstOrNull { it.id == languageId }
                        prefs.putInt(SdkPreferences.Keys.SELECTED_LANGUAGE_ID, languageId)
                        language?.let {
                            prefs.putString(SdkPreferences.Keys.SELECTED_LANGUAGE_CODE, it.code)
                            prefs.putString(SdkPreferences.Keys.SELECTED_LANGUAGE_DISPLAY_NAME, it.displayName)
                            prefs.putBoolean(SdkPreferences.Keys.ASR_ENABLED, it.isAsrEnabled)
                            prefs.putBoolean(SdkPreferences.Keys.TTS_ENABLED, it.isTtsEnabled)
                        }
                        analytics.track(
                            AnalyticsEvents.SAVE_LANGUAGE_CLICK,
                            mapOf(AnalyticsProps.LANGUAGE_CODE to _state.value.languageCode)
                        )
                        _state.update {
                            it.copy(isSubmittingLanguage = false, languageSubmitSuccess = true)
                        }
                    }
                    is ApiResult.Error -> {
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
