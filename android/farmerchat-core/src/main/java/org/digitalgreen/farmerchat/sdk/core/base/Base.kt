package org.digitalgreen.farmerchat.sdk.core.base

/**
 * Result of a single API call executed via [BaseUseCase.executeApiCall].
 * Direct port of the production app's ApiResult.
 */
sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()

    data class Error(
        val code: Int?,
        val message: String?,
        val apiName: String,
        /** Raw server error body when available. */
        val errorBody: String? = null,
        /** Underlying exception when the failure was not an HTTP error. */
        val throwable: Throwable? = null,
        val isTimeout: Boolean = false
    ) : ApiResult<Nothing>()
}

/**
 * Screen-facing state wrapper. Direct port of the production app's UiState.
 */
sealed class UiState<out T> {
    object Idle : UiState<Nothing>()
    object Loading : UiState<Nothing>()
    data class Success<T>(val data: T) : UiState<T>()
    data class Error(
        val message: String,
        val code: Int? = null,
        val isNetworkError: Boolean = false
    ) : UiState<Nothing>()
}

/** True when this error represents a connectivity failure (no internet / cannot connect). */
fun ApiResult.Error.isNetworkError(): Boolean {
    val t = throwable ?: return false
    return t is java.net.UnknownHostException || t is java.net.ConnectException
}

/** Map an [ApiResult.Error] to a [UiState.Error] with a user-facing message. */
fun ApiResult.Error.toUiError(): UiState.Error = UiState.Error(
    message = message ?: "Something went wrong. Please try again.",
    code = code,
    isNetworkError = isNetworkError()
)
