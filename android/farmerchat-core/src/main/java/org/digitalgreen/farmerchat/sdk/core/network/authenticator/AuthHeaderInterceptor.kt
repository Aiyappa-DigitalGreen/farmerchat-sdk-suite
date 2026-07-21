package org.digitalgreen.farmerchat.sdk.core.network.authenticator

import android.content.Context
import okhttp3.Interceptor
import okhttp3.Response
import org.digitalgreen.farmerchat.sdk.core.auth.TokenStore
import org.digitalgreen.farmerchat.sdk.core.network.buildEncodedDeviceConfig
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences

/**
 * Adds `Build-Version: v2` + `Device-Info: <url-encoded JSON>` to every request and a
 * `Authorization: Bearer <access>` header when a token is present.
 */
class AuthHeaderInterceptor(
    private val tokenStore: TokenStore,
    private val context: Context,
    private val prefs: SdkPreferences
) : Interceptor {

    private val deviceInfo: String by lazy { buildEncodedDeviceConfig(context, prefs) }

    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenStore.getAccessToken()

        val requestBuilder = chain.request()
            .newBuilder()
            .addHeader("Build-Version", "v2")
            .addHeader("Device-Info", deviceInfo)

        if (!token.isNullOrEmpty()) {
            requestBuilder.addHeader("Authorization", "Bearer $token")
        }

        return chain.proceed(requestBuilder.build())
    }
}
