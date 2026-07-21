package org.digitalgreen.farmerchat.sdk.core.ui.settings

import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.model.SupportedLanguage

/**
 * State for Settings → Language. 1:1 port of the app's LanguageSettingsState
 * (only supported languages + set preferred language; no geo or guest init).
 */
data class LanguageSettingsState(
    val languageState: UiState<List<SupportedLanguage>> = UiState.Idle,
    val expandedLanguages: List<SupportedLanguage> = emptyList(),
    val selectedLanguageId: Int? = null,
    val languageCode: String? = null,
    val labelsRefreshToken: Long = 0L,
    val isFetchingLabels: Boolean = false,
    val fetchingLabelsForId: Int? = null,
    val isSubmittingLanguage: Boolean = false,
    val languageSubmitSuccess: Boolean = false,
    val submitErrorMessage: String? = null
)
