package org.digitalgreen.farmerchat.sdk.core.base

import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.json.JSONObject
import java.io.IOException
import java.net.ConnectException
import java.net.ProtocolException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLHandshakeException

/**
 * Maps HTTP failures and exceptions to localized, user-facing messages.
 * Port of the app's ErrorHandler; labels resolve through [labelResolver]
 * (wired to LabelManager by the SDK graph) with English fallbacks.
 */
object ErrorHandler {

    /** Wired by the SDK service graph to LabelManager.getLabel(baseKey, fallback). */
    @Volatile
    var labelResolver: ((baseKey: String, englishFallback: String) -> String)? = null

    private fun label(baseKey: String, fallback: String): String =
        labelResolver?.invoke(baseKey, fallback) ?: fallback

    data class ParsedError(
        val userMessage: String,
        val isNetworkError: Boolean,
        val backendMessage: String? = null
    )

    /** Use for HTTP failures (a Response<T> exists). */
    fun fromHttp(code: Int, retrofitMessage: String?, errorBody: String?): ParsedError {
        val backendMsg = extractBackendMessage(errorBody)

        val userMsg = backendMsg ?: when (code) {
            400 -> label(Labels.INVALID_REQUEST_PLEASE_TRY_AGAIN, "Invalid request. Please try again.")
            401 -> label(Labels.SESSION_EXPIRED_PLEASE_LOGIN_AGAIN, "Session expired. Please login again.")
            403 -> label(Labels.ACCESS_DENIED, "Access denied.")
            404 -> label(Labels.SERVICE_NOT_FOUND, "Service not found.")
            408 -> label(Labels.NETWORK_IS_SLOW_PLEASE_TRY_AGAIN, "Network is slow. Please try again.")
            429 -> label(Labels.TOO_MANY_REQUESTS_PLEASE_TRY_AGAIN_LATER, "Too many requests. Please try later.")
            in 500..599 -> label(Labels.SERVER_IS_BUSY_PLEASE_TRY_AGAIN, "Server is busy. Please try again.")
            else -> retrofitMessage?.takeIf { it.isNotBlank() }
                ?: label(Labels.SOMETHING_WENT_WRONG_PLEASE_TRY_AGAIN, "Something went wrong. Please try again.")
        }

        return ParsedError(userMessage = userMsg, isNetworkError = false, backendMessage = backendMsg)
    }

    /** Use for exceptions (no HTTP code). */
    fun fromException(t: Throwable): ParsedError {
        val userMsg = when (t) {
            is UnknownHostException -> label(Labels.NO_INTERNET_CONNECTION, "No internet connection.")
            is SocketTimeoutException -> label(Labels.NETWORK_IS_SLOW_PLEASE_TRY_AGAIN, "Network is slow. Please try again.")
            is ConnectException -> label(Labels.UNABLE_TO_CONNECT_PLEASE_TRY_AGAIN, "Unable to connect. Please try again.")
            // OkHttp throws this when server responses violate the HTTP spec; treat as a server error.
            is ProtocolException -> label(Labels.SOMETHING_WENT_WRONG_PLEASE_TRY_AGAIN, "Something went wrong. Please try again.")
            is SSLHandshakeException -> label(Labels.SECURE_CONNECTION_FAILED, "Secure connection failed.")
            is IOException -> label(Labels.NETWORK_ERROR_PLEASE_TRY_AGAIN, "Network error. Please try again.")
            else -> label(Labels.SOMETHING_WENT_WRONG_PLEASE_TRY_AGAIN, "Something went wrong. Please try again.")
        }

        return ParsedError(
            userMessage = userMsg,
            // Only true connectivity failures count as "network error".
            isNetworkError = when (t) {
                is UnknownHostException, is ConnectException -> true
                else -> false
            }
        )
    }

    /**
     * Extract a backend-provided message. Backends are inconsistent:
     * { "message": "..." }, { "detail": "..." }, { "otp": ["..."] }, { "non_field_errors": [...] }, ...
     */
    private fun extractBackendMessage(errorBody: String?): String? {
        if (errorBody.isNullOrBlank()) return null

        return runCatching {
            val json = JSONObject(errorBody)
            val keys = listOf(
                "message", "otp", "error", "detail", "msg",
                "error_message", "description", "non_field_errors"
            )

            for (k in keys) {
                val v = json.optString(k)
                if (v.isNotBlank() && !v.startsWith("{") && !v.startsWith("[")) return v
            }
            for (k in keys) {
                val arr = json.optJSONArray(k)
                val first = arr?.optString(0)
                if (!first.isNullOrBlank()) return first
            }
            for (k in keys) {
                val nested = json.optJSONObject(k)
                val nestedMsg = nested?.optString("message")
                if (!nestedMsg.isNullOrBlank()) return nestedMsg
            }
            null
        }.getOrNull()
    }
}
