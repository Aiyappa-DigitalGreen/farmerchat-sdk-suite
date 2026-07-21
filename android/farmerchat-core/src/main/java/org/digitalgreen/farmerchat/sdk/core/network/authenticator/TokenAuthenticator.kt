package org.digitalgreen.farmerchat.sdk.core.network.authenticator

import android.os.Looper
import android.util.Log
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import org.digitalgreen.farmerchat.sdk.core.auth.AuthApi
import org.digitalgreen.farmerchat.sdk.core.auth.TokenStore
import org.digitalgreen.farmerchat.sdk.core.remote.ApiConstants
import org.digitalgreen.farmerchat.sdk.core.model.RefreshTokenRequest
import org.digitalgreen.farmerchat.sdk.core.model.SendNewTokenRequest

/**
 * Handles 401s:
 * 1. Skip-list: auth endpoints (generate_otp, verify_otp, get_new_access_token,
 *    send_tokens, initialize_user) are never refreshed.
 * 2. Loop guard: gives up after 2 prior responses.
 * 3. Step 1 — refresh via get_new_access_token; save tokens; retry with new Bearer.
 * 4. Step 2 — fallback: send_tokens(device_id, user_id) with the guest API key.
 * 5. Never runs on the main thread; refresh is single-flight (concurrent 401s wait
 *    on a lock, then reuse the token the winning thread saved).
 *
 * When both steps fail, [onSessionExpired] fires so the host can react.
 */
class TokenAuthenticator(
    private val tokenStore: TokenStore,
    private val authApiProvider: () -> AuthApi,
    private val guestApiKey: String,
    private val onSessionExpired: (() -> Unit)? = null,
    /** C2: when true, refresh delegates to [hostTokenProvider] instead of the OTP/guest flow. */
    private val hostTokenMode: Boolean = false,
    /** C2: HOST_TOKEN refresh source — returns a fresh access token or null (session expired). */
    private val hostTokenProvider: (() -> String?)? = null
) : Authenticator {

    private val refreshLock = Any()

    override fun authenticate(route: Route?, response: Response): Request? {
        // Guard against ANR
        if (Looper.myLooper() == Looper.getMainLooper()) {
            return null
        }

        val requestUrl = response.request.url.toString()
        if (shouldSkipAuthentication(requestUrl)) {
            return null
        }

        // Avoid infinite retry loop
        if (responseCount(response) >= 2) {
            return null
        }

        synchronized(refreshLock) {
            // Single-flight: if another thread already refreshed while we waited,
            // just retry with the newly saved token.
            val failedToken = response.request.header("Authorization")
                ?.removePrefix("Bearer ")?.trim()
            val currentToken = tokenStore.getAccessToken()
            if (!currentToken.isNullOrBlank() && currentToken != failedToken) {
                return response.request.newBuilder()
                    .header("Authorization", "Bearer $currentToken")
                    .build()
            }

            return doRefresh(response)
        }
    }

    private fun doRefresh(response: Response): Request? {
        // ---------- C2: HOST_TOKEN mode — ask the host, never touch OTP/guest ----------
        if (hostTokenMode) {
            return try {
                val fresh = hostTokenProvider?.invoke()
                if (!fresh.isNullOrBlank()) {
                    tokenStore.saveTokens(fresh, tokenStore.getRefreshToken())
                    response.request.newBuilder()
                        .header("Authorization", "Bearer $fresh")
                        .build()
                } else {
                    onSessionExpired?.invoke()
                    null
                }
            } catch (e: Exception) {
                Log.e("TokenAuthenticator", "Host token refresh failed: ${e.localizedMessage}")
                onSessionExpired?.invoke()
                null
            }
        }

        return try {
            val authApi = authApiProvider()

            // ---------- STEP 1: refresh token ----------
            val refreshToken = tokenStore.getRefreshToken()
            if (!refreshToken.isNullOrBlank()) {
                val refreshRes = authApi.refreshToken(RefreshTokenRequest(refresh_token = refreshToken)).execute()
                if (refreshRes.isSuccessful) {
                    val body = refreshRes.body()
                    val newAccess = body?.access_token
                    val newRefresh = body?.refresh_token ?: refreshToken
                    if (!newAccess.isNullOrBlank()) {
                        tokenStore.saveTokens(newAccess, newRefresh)
                        return response.request.newBuilder()
                            .header("Authorization", "Bearer $newAccess")
                            .build()
                    }
                }
            }

            // ---------- STEP 2: fallback → send_tokens (guest token) ----------
            val deviceId = tokenStore.getDeviceId()
            val userId = tokenStore.getUserId()
            if (deviceId.isNullOrBlank() || userId.isNullOrBlank()) {
                onSessionExpired?.invoke()
                return null
            }

            val sendTokenRes = authApi.sendUserTokens(
                guestApiKey,
                SendNewTokenRequest(device_id = deviceId, user_id = userId)
            ).execute()

            if (sendTokenRes.isSuccessful) {
                val body = sendTokenRes.body()
                val newAccess = body?.access_token
                val newRefresh = body?.refresh_token
                if (!newAccess.isNullOrBlank()) {
                    tokenStore.saveTokens(newAccess, newRefresh)
                    return response.request.newBuilder()
                        .header("Authorization", "Bearer $newAccess")
                        .build()
                }
            }

            onSessionExpired?.invoke()
            null
        } catch (e: Exception) {
            Log.e("TokenAuthenticator", "Auth failed: ${e.localizedMessage}")
            null
        }
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }

    private fun shouldSkipAuthentication(url: String): Boolean {
        return url.contains(ApiConstants.SEND_OTP) ||
            url.contains(ApiConstants.VERIFY_OTP) ||
            url.contains(ApiConstants.AUTH_REFRESH) ||
            url.contains(ApiConstants.SEND_USER_TOKENS) ||
            url.contains(ApiConstants.INITIALIZE_GUEST_USER)
    }
}
