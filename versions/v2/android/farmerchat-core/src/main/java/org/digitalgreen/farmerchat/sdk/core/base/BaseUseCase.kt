package org.digitalgreen.farmerchat.sdk.core.base

import kotlinx.coroutines.delay
import org.digitalgreen.farmerchat.sdk.core.network.timeout.ApiPriority
import org.digitalgreen.farmerchat.sdk.core.network.timeout.ApiPriorityContext
import retrofit2.Response
import java.io.IOException
import java.net.SocketTimeoutException

/**
 * Base class for all use cases. Provides [executeApiCall] with the exact retry
 * semantics of the production app:
 *
 * - 401 is never retried (TokenAuthenticator's job); returned as an error.
 * - Retryable HTTP codes: 408, 500, 502, 503, 504, 404. Never 400 or 429.
 * - Exceptions: retry only [IOException]; [SocketTimeoutException] flagged `isTimeout`.
 * - Exponential backoff: min(500 * 2^attempt, 3000) ms.
 * - Retry count defaults to the [ApiPriority]'s retryCount.
 */
abstract class BaseUseCase {

    suspend fun <T> executeApiCall(
        apiName: String,
        priority: ApiPriority = ApiPriority.PRIORITY_2_NO_FALLBACK,
        retryCount: Int? = null,
        baseDelayMs: Long = 500,
        maxDelayMs: Long = 3000,
        call: suspend () -> Response<T>
    ): ApiResult<T> {
        val effectiveRetryCount = retryCount ?: priority.retryCount

        // Register the priority so interceptors can resolve it by URL/request id and
        // apply the correct X-Timeout / per-request client timeout.
        ApiPriorityContext.setPriorityForApi(apiName, priority)

        try {
            var attempt = 0
            var lastException: Exception? = null
            var lastHttpCode: Int? = null
            var lastHttpMessage: String? = null
            var lastHttpErrorBody: String? = null

            while (attempt <= effectiveRetryCount) {
                try {
                    val response = call()
                    val code = response.code()

                    // 401 never retried (handled by TokenAuthenticator before we ever see it)
                    if (code == 401) {
                        val rawError = runCatching { response.errorBody()?.string() }.getOrNull()
                        val parsed = ErrorHandler.fromHttp(code, response.message(), rawError)
                        return ApiResult.Error(
                            code = 401,
                            message = parsed.userMessage,
                            apiName = apiName,
                            errorBody = rawError
                        )
                    }

                    if (response.isSuccessful) {
                        val body = response.body()
                        if (body != null) {
                            return ApiResult.Success(body)
                        }
                    }

                    val rawError = runCatching { response.errorBody()?.string() }.getOrNull()
                    val parsed = ErrorHandler.fromHttp(code, response.message(), rawError)
                    lastHttpCode = code
                    lastHttpMessage = parsed.userMessage
                    lastHttpErrorBody = rawError
                    val isTimeout = code == 408

                    if (!shouldRetryHttp(code)) {
                        return ApiResult.Error(
                            code = code,
                            message = parsed.userMessage,
                            apiName = apiName,
                            errorBody = rawError,
                            isTimeout = isTimeout
                        )
                    }

                    if (attempt < effectiveRetryCount) {
                        delay(calcDelayMs(attempt, baseDelayMs, maxDelayMs))
                    }
                } catch (e: Exception) {
                    lastException = e
                    val parsed = ErrorHandler.fromException(e)
                    val isTimeout = e is SocketTimeoutException

                    if (!shouldRetryException(e)) {
                        return ApiResult.Error(
                            code = null,
                            message = parsed.userMessage,
                            apiName = apiName,
                            throwable = e,
                            isTimeout = isTimeout
                        )
                    }

                    if (attempt < effectiveRetryCount) {
                        delay(calcDelayMs(attempt, baseDelayMs, maxDelayMs))
                    }
                }

                attempt++
            }

            // Retries exhausted on HTTP errors → return the last HTTP error
            if (lastHttpCode != null) {
                return ApiResult.Error(
                    code = lastHttpCode,
                    message = lastHttpMessage,
                    apiName = apiName,
                    errorBody = lastHttpErrorBody
                )
            }

            // Retries exhausted on exceptions
            val fallback = lastException ?: IOException("Unknown network error")
            val parsed = ErrorHandler.fromException(fallback)
            return ApiResult.Error(
                code = null,
                message = parsed.userMessage,
                apiName = apiName,
                throwable = lastException,
                isTimeout = lastException is SocketTimeoutException
            )
        } finally {
            ApiPriorityContext.clearPriority(apiName)
        }
    }

    private fun shouldRetryHttp(code: Int): Boolean {
        // Retryable: timeout, server errors, temporary unavailability, 404.
        // 429 (rate limit) never retried — user must see "wait X minutes" immediately.
        // 400 never retried.
        return code == 408 || code == 500 || code == 502 || code == 503 || code == 504 || code == 404
    }

    private fun shouldRetryException(e: Exception): Boolean = e is IOException

    private fun calcDelayMs(attempt: Int, baseDelayMs: Long, maxDelayMs: Long): Long {
        val delay = baseDelayMs * (1L shl attempt) // 500, 1000, 2000, ...
        return minOf(delay, maxDelayMs)
    }
}
