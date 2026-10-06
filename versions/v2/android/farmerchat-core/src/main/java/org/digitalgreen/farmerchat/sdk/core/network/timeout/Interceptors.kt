package org.digitalgreen.farmerchat.sdk.core.network.timeout

import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import java.util.concurrent.TimeUnit

/**
 * MUST run FIRST. Runs on the caller's coroutine thread (before OkHttp's dispatcher
 * takes over) so it can read the priority ThreadLocal and pin it to an `X-Request-ID`
 * header for cross-thread access downstream.
 */
class PriorityRequestIdInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (request.header(ApiPriorityContext.HEADER_NAME) != null) {
            return chain.proceed(request)
        }
        val priority = ApiPriorityContext.getPriority()
        return if (priority != null) {
            val requestId = ApiPriorityContext.generateRequestId(priority)
            chain.proceed(
                request.newBuilder()
                    .addHeader(ApiPriorityContext.HEADER_NAME, requestId)
                    .build()
            )
        } else {
            chain.proceed(request)
        }
    }
}

/**
 * MUST run BEFORE [TimeoutTypeInterceptor]. Resolves the API priority (ThreadLocal →
 * request-id map → URL map) and adds it as an `X-Timeout` header (seconds).
 */
class ApiPriorityHeaderInterceptor : Interceptor {

    companion object {
        internal const val HEADER_X_TIMEOUT = "X-Timeout"
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (request.header(HEADER_X_TIMEOUT) != null) {
            return chain.proceed(request)
        }

        var priority = ApiPriorityContext.getPriority()
        if (priority == null) {
            val requestId = request.header(ApiPriorityContext.HEADER_NAME)
            priority = ApiPriorityContext.getPriority(
                requestUrl = request.url.encodedPath,
                requestId = requestId
            )
        }

        return if (priority != null) {
            chain.proceed(
                request.newBuilder()
                    .addHeader(HEADER_X_TIMEOUT, priority.timeoutSeconds.toString())
                    .build()
            )
        } else {
            chain.proceed(request)
        }
    }
}

/**
 * Applies per-request timeouts by cloning the base client with connect/read/write
 * set to the `X-Timeout` header value (default 30 s when absent) and executing the
 * request on the clone. Port of the app's TimeoutTypeInterceptor.
 */
class TimeoutTypeInterceptor(
    private val baseClientProvider: () -> OkHttpClient
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()

        val timeoutHeader = request.header(ApiPriorityHeaderInterceptor.HEADER_X_TIMEOUT)
        val priority = ApiPriorityContext.getPriority()
        val timeoutSeconds = timeoutHeader?.toLongOrNull() ?: priority?.timeoutSeconds

        val newRequest = if (timeoutHeader != null) {
            request.newBuilder().removeHeader(ApiPriorityHeaderInterceptor.HEADER_X_TIMEOUT).build()
        } else {
            request
        }

        val effectiveTimeout = (timeoutSeconds ?: 30L).toInt()
        val clientWithTimeout = baseClientProvider().newBuilder()
            .connectTimeout(effectiveTimeout.toLong(), TimeUnit.SECONDS)
            .readTimeout(effectiveTimeout.toLong(), TimeUnit.SECONDS)
            .writeTimeout(effectiveTimeout.toLong(), TimeUnit.SECONDS)
            // A bound on the WHOLE attempt. The three above are per step, and OkHttp re-arms the
            // connect timeout for every route it tries: an unreachable host with a dozen
            // addresses (googleapis.com from a network that drops it) turned the 5 s geolocate
            // into minutes, and the CHAT_ONLY splash waits on geolocate. 2x leaves slow-but-alive
            // responses (a long #27 answer) untouched.
            .callTimeout(effectiveTimeout * 2L, TimeUnit.SECONDS)
            .build()

        val response = clientWithTimeout.newCall(newRequest).execute()

        // Clean up request-id from the priority map after the request completes.
        newRequest.header(ApiPriorityContext.HEADER_NAME)?.let {
            ApiPriorityContext.clearPriority(requestId = it)
        }

        return response
    }
}
