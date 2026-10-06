package org.digitalgreen.farmerchat.sdk.core.network

import okhttp3.Interceptor
import okhttp3.Response

/**
 * Host endpoint overrides ([org.digitalgreen.farmerchat.sdk.FarmerChatConfig.endpointOverrides]):
 * a host whose backend serves an SDK endpoint under a different path maps the SDK path to its
 * own. Keys and values are paths relative to the base URL (`api/language/v2/get_labels/`).
 * Query strings are kept. Only paths the host listed are touched, so an empty map is a no-op.
 *
 * Runs AFTER [org.digitalgreen.farmerchat.sdk.core.network.timeout.ApiPriorityHeaderInterceptor]:
 * the priority (timeout + retry budget) is resolved from the SDK's own path, not the host's.
 */
internal class EndpointOverrideInterceptor(overrides: Map<String, String>) : Interceptor {

    private val overrides: List<Pair<String, String>> = overrides
        .map { (from, to) -> "/" + from.trim().trimStart('/') to "/" + to.trim().trimStart('/') }
        .filter { (from, to) -> from.length > 1 && from != to }
        .sortedByDescending { it.first.length } // most specific first

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (overrides.isEmpty()) return chain.proceed(request)
        val path = request.url.encodedPath
        val match = overrides.firstOrNull { path.endsWith(it.first) } ?: return chain.proceed(request)
        val newPath = path.removeSuffix(match.first) + match.second
        val url = request.url.newBuilder().encodedPath(newPath).build()
        return chain.proceed(request.newBuilder().url(url).build())
    }
}
