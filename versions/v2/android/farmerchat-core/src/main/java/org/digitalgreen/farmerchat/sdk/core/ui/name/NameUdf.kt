package org.digitalgreen.farmerchat.sdk.core.ui.name

import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.model.UpdateUserName
import org.digitalgreen.farmerchat.sdk.core.model.UserNameRequest

/** 1:1 port of the app's UserNameAction. */
sealed interface UserNameAction {

    data class UpdateUserName(val body: UserNameRequest) : UserNameAction

    object ConsumeUpdateResult : UserNameAction
}

/** 1:1 port of the app's UpdateUserNameState. */
data class UpdateUserNameState(
    val updateUserNameState: UiState<UpdateUserName> = UiState.Idle
)
