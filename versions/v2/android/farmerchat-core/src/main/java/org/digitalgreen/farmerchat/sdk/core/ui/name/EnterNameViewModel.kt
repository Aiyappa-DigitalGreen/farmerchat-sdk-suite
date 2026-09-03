package org.digitalgreen.farmerchat.sdk.core.ui.name

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.FarmerChatAnalytics
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsApis
import org.digitalgreen.farmerchat.sdk.core.base.ApiResult
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.base.toUiError
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.CoreViewModel
import org.digitalgreen.farmerchat.sdk.core.usecase.UpdateUserNameUseCase

/**
 * Name entry / edit state machine (Enter Name onboarding + Settings → Name).
 * Port of the app's EnterNameViewModel.
 */
class EnterNameViewModel(
    private val updateUserNameUseCase: UpdateUserNameUseCase,
    private val prefs: SdkPreferences,
    private val analytics: FarmerChatAnalytics
) : CoreViewModel() {

    private val _state = MutableStateFlow(UpdateUserNameState())
    val state: StateFlow<UpdateUserNameState> = _state

    fun onAction(action: UserNameAction, screenName: String) {
        when (action) {
            is UserNameAction.UpdateUserName -> updateUserName(action, screenName)
            is UserNameAction.ConsumeUpdateResult ->
                _state.update { it.copy(updateUserNameState = UiState.Idle) }
        }
    }

    private fun updateUserName(action: UserNameAction.UpdateUserName, screenName: String) {
        _state.update { it.copy(updateUserNameState = UiState.Loading) }
        scope.launch {
            // App EnterNameViewModel.kt:53 — API_Name = "Update Profile".
            analytics.trackApiInitiated(AnalyticsApis.UPDATE_PROFILE, screenName)
            updateUserNameUseCase.updateUserName(action.body).collect { result ->
                when (result) {
                    is ApiResult.Success -> {
                        // App EnterNameViewModel.kt:71.
                        analytics.trackApiSuccess(AnalyticsApis.UPDATE_PROFILE, screenName)
                        action.body.name?.takeIf { it.isNotBlank() }?.let { name ->
                            prefs.putString(SdkPreferences.Keys.USER_NAME, name)
                            prefs.putBoolean(SdkPreferences.Keys.USER_NAME_ADDED, true)
                        }
                        analytics.track(
                            AnalyticsEvents.NAME_SAVE_CLICK,
                            mapOf(AnalyticsProps.SCREEN_NAME to screenName)
                        )
                        _state.update {
                            it.copy(updateUserNameState = UiState.Success(result.data.user_profile))
                        }
                    }
                    is ApiResult.Error -> {
                        // App EnterNameViewModel.kt:109/122.
                        analytics.trackApiError(
                            AnalyticsApis.UPDATE_PROFILE, screenName, result.isTimeout
                        )
                        _state.update { it.copy(updateUserNameState = result.toUiError()) }
                    }
                }
            }
        }
    }

    companion object {
        /**
         * 1:1 port of the app's `normalizeNameInput` (ui/onboarding/name/EnterNameScreen.kt):
         * letters and whitespace only, no leading space, any whitespace run collapsed to a
         * single space. Keeping `isWhitespace()` (not just `' '`) matters for pasted text —
         * "John\tDoe" must normalise to "John Doe", not "JohnDoe".
         */
        fun normalizeNameInput(raw: String): String {
            val lettersAndSpaces = raw.filter { c -> c.isLetter() || c.isWhitespace() }
            val noLeading = lettersAndSpaces.trimStart()
            return noLeading.replace(Regex("\\s+"), " ")
        }

        /**
         * Port of the app's `sanitizeNameForUi` (EnterNameRoute.kt): trims, blanks the
         * backend placeholders ("No Name" / "null") and caps at [MAX_NAME_LENGTH].
         */
        fun sanitizeName(value: String?): String {
            val v = value?.trim().orEmpty()
            if (v.equals("No Name", ignoreCase = true) || v.equals("null", ignoreCase = true)) {
                return ""
            }
            return v.take(MAX_NAME_LENGTH)
        }

        const val MIN_NAME_LENGTH = 3
        const val MAX_NAME_LENGTH = 100
    }
}
