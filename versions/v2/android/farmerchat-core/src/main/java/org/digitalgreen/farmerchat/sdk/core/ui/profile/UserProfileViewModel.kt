package org.digitalgreen.farmerchat.sdk.core.ui.profile

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.core.base.ApiResult
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.base.toUiError
import org.digitalgreen.farmerchat.sdk.core.model.FarmerProfile
import org.digitalgreen.farmerchat.sdk.core.navigation.ErrorNavigationManager
import org.digitalgreen.farmerchat.sdk.core.navigation.handleError
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.CoreViewModel
import org.digitalgreen.farmerchat.sdk.core.usecase.GetUserProfileUseCase

/**
 * Fetches the user profile (used by Settings + EnterName). Port of the app's
 * UserProfileViewModel: clears/saves USER_NAME; errors route to the error screen.
 */
class UserProfileViewModel(
    private val getUserProfileUseCase: GetUserProfileUseCase,
    private val prefs: SdkPreferences,
    private val errorNavigationManager: ErrorNavigationManager
) : CoreViewModel() {

    private val _profileState = MutableStateFlow<UiState<FarmerProfile>>(UiState.Idle)
    val profileState: StateFlow<UiState<FarmerProfile>> = _profileState

    fun fetchProfile(fromScreen: String) {
        val userId = prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "")
        if (userId.isBlank()) {
            _profileState.value = UiState.Idle
            return
        }
        _profileState.value = UiState.Loading
        scope.launch {
            getUserProfileUseCase.fetchUserProfile(userId).collect { result ->
                when (result) {
                    is ApiResult.Success -> {
                        val name = result.data.userProfile.displayName()
                        if (name.isNotBlank()) {
                            prefs.putString(SdkPreferences.Keys.USER_NAME, name)
                        } else {
                            prefs.remove(SdkPreferences.Keys.USER_NAME)
                        }
                        _profileState.value = UiState.Success(result.data)
                    }
                    is ApiResult.Error -> {
                        _profileState.update { result.toUiError() }
                        result.handleError(errorNavigationManager, fromScreen) {
                            fetchProfile(fromScreen)
                        }
                    }
                }
            }
        }
    }
}
