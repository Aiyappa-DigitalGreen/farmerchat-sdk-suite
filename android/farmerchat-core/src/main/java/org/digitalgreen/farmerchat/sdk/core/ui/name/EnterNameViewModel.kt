package org.digitalgreen.farmerchat.sdk.core.ui.name

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
            updateUserNameUseCase.updateUserName(action.body).collect { result ->
                when (result) {
                    is ApiResult.Success -> {
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
                        _state.update { it.copy(updateUserNameState = result.toUiError()) }
                    }
                }
            }
        }
    }

    companion object {
        /**
         * Port of the app's normalizeNameInput: letters and single spaces only.
         */
        fun normalizeNameInput(raw: String): String {
            val filtered = raw.filter { it.isLetter() || it == ' ' }
            return filtered.replace(Regex(" {2,}"), " ").trimStart()
        }

        /** Sanitizes backend placeholder names ("No Name" / "null"). */
        fun sanitizeName(value: String?): String {
            val v = value?.trim().orEmpty()
            return if (v.equals("No Name", ignoreCase = true) || v.equals("null", ignoreCase = true)) "" else v
        }

        const val MIN_NAME_LENGTH = 3
        const val MAX_NAME_LENGTH = 100
    }
}
