package org.digitalgreen.farmerchat.sdk.core.navigation

import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import org.digitalgreen.farmerchat.sdk.core.base.ApiResult
import org.digitalgreen.farmerchat.sdk.core.base.isNetworkError

/**
 * Centralized one-shot error navigation (port of the app's ErrorNavigationManager).
 *
 * Uses a buffered Channel (not SharedFlow) so events are never lost to collector
 * timing. Tracks the active screen so background/in-flight failures from screens
 * that are no longer visible cannot hijack the UI, keeps a [hasPendingError] flag
 * (Splash checks it before auto-routing) and one retry action invoked by
 * [retryLastAction].
 */
class ErrorNavigationManager {

    private val _errorEvents = Channel<ErrorEvent>(capacity = Channel.BUFFERED)
    val errorEvents = _errorEvents.receiveAsFlow()

    private var retryAction: (() -> Unit)? = null

    private val _hasPendingError = MutableStateFlow(false)
    val hasPendingError: StateFlow<Boolean> = _hasPendingError

    /** Expected values: "home", "auth", "language", "name", "settings", "chat", ... */
    private val _activeScreen = MutableStateFlow<String?>(null)
    val activeScreen: StateFlow<String?> = _activeScreen

    fun setActiveScreen(screen: String?) {
        _activeScreen.value = screen?.trim()?.lowercase()
    }

    suspend fun navigateToError(
        isNetworkError: Boolean,
        fromScreen: String,
        retry: () -> Unit
    ) {
        val active = _activeScreen.value
        val from = fromScreen.trim().lowercase()
        // Ignore errors from a screen no longer visible (background/in-flight).
        if (!active.isNullOrBlank() && from.isNotBlank() && active != from) {
            return
        }

        _hasPendingError.value = true
        retryAction = retry

        _errorEvents.send(ErrorEvent(isNetworkError = isNetworkError, fromScreen = fromScreen))
    }

    fun retryLastAction() {
        _hasPendingError.value = false
        retryAction?.invoke()
        retryAction = null
    }

    fun clearRetryAction() {
        _hasPendingError.value = false
        retryAction = null
    }
}

data class ErrorEvent(
    val isNetworkError: Boolean,
    val fromScreen: String
)

/**
 * Convenience: route an [ApiResult.Error] into the error screen with a retry,
 * mirroring the app's `result.handleError(errorNavigationManager, fromScreen, retry)`.
 */
suspend fun ApiResult.Error.handleError(
    manager: ErrorNavigationManager,
    fromScreen: String,
    retry: () -> Unit
) {
    manager.navigateToError(
        isNetworkError = isNetworkError(),
        fromScreen = fromScreen,
        retry = retry
    )
}
