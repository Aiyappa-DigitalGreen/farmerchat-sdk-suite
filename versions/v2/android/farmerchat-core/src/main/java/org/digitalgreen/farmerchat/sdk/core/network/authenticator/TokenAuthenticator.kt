package org.digitalgreen.farmerchat.sdk.core.network.authenticator

import android.os.Looper
import android.util.Log
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import org.digitalgreen.farmerchat.sdk.core.auth.AuthApi
import org.digitalgreen.farmerchat.sdk.core.auth.TokenStore
import org.digitalgreen.farmerchat.sdk.core.location.CountryLatLngProvider
import org.digitalgreen.farmerchat.sdk.core.remote.ApiConstants
import org.digitalgreen.farmerchat.sdk.core.model.InitializeGuestUserRequest
import org.digitalgreen.farmerchat.sdk.core.model.InitializeGuestUserResponse
import org.digitalgreen.farmerchat.sdk.core.model.RefreshTokenRequest
import org.digitalgreen.farmerchat.sdk.core.model.SendNewTokenRequest

/**
 * Handles 401s:
 * 1. Skip-list: auth endpoints (generate_otp, verify_otp, get_new_access_token,
 *    send_tokens, initialize_user) are never refreshed.
 * 2. Loop guard: gives up after 2 prior responses.
 * 3. Step 1 — refresh via get_new_access_token; save tokens; retry with new Bearer.
 * 4. Step 2 — fallback: send_tokens(device_id, user_id) with the guest API key.
 * 5. Step 3 — guest re-initialisation (docs/02 "TokenAuthenticator (401 refresh)"). Runs only
 *    when NOT [hostTokenMode], Step 2 produced no token, the session is a guest
 *    ([isPhoneVerified] false — a phone-verified identity is never replaced), AND Step 2 failed
 *    because the identity was rejected: send_tokens answered 400/401/403/404, or there was no
 *    user_id/device_id to send. A network error, timeout or 5xx never triggers it.
 *    Action: initialize_user with the guest API key and {device_id, lat?, long?} (existing
 *    device id via [deviceIdSupplier]; lat/long from the stored GPS fix [storedLatLong], else
 *    the onboarding fallback [fallbackLatLong]; (0, 0) / unresolved → no coordinates, see
 *    [step3Coordinates]). On a response with an access_token: save access + refresh tokens and
 *    user_id, call [onGuestReinitialized] with the response (the graph drops
 *    NEW_CONVERSATION_ID + the old place names, persists the response's country/state, then
 *    emits the guest-replaced signal), and retry the original request. Otherwise
 *    [onSessionExpired]. No analytics event.
 * 6. Never runs on the main thread; refresh is single-flight (concurrent 401s wait
 *    on a lock, then reuse the token the winning thread saved).
 *
 * When every applicable step fails, [onSessionExpired] fires so the host can react.
 */
class TokenAuthenticator(
    private val tokenStore: TokenStore,
    private val authApiProvider: () -> AuthApi,
    private val guestApiKey: String,
    private val onSessionExpired: (() -> Unit)? = null,
    /** C2: when true, refresh delegates to [hostTokenProvider] instead of the OTP/guest flow. */
    private val hostTokenMode: Boolean = false,
    /** C2: HOST_TOKEN refresh source — returns a fresh access token or null (session expired). */
    private val hostTokenProvider: (() -> String?)? = null,
    /** Step 3 gate: true once phone OTP is verified (prefs `OTP_VERIFIED`). Default keeps Step 3 off. */
    private val isPhoneVerified: () -> Boolean = { true },
    /** Step 3: the install's device id (creates + persists one when none is stored). */
    private val deviceIdSupplier: () -> String? = { tokenStore.getDeviceId() },
    /** Step 3: stored `FARMER_APP_LATITUDE` / `FARMER_APP_LONGITUDE`, null when absent. */
    private val storedLatLong: () -> Pair<Double?, Double?> = { null to null },
    /**
     * Step 3, when no GPS fix is stored: the SAME fallback onboarding seeds the server with on a
     * geo failure (host `defaultLatitude/defaultLongitude`, else the device-locale country
     * centroid — `FarmerChatConfig.resolvedFallbackCoordinates`). Null or (0, 0) = unresolved.
     * Called on an OkHttp thread; a throw counts as unresolved.
     */
    private val fallbackLatLong: () -> Pair<Double, Double>? = { null },
    /**
     * Step 3 success hook, after tokens + user_id are saved: drop session state that belonged to
     * the old user, persist the new guest's location from [InitializeGuestUserResponse], and emit
     * the guest-replaced signal. Must not block (it runs inside the refresh lock).
     */
    private val onGuestReinitialized: (InitializeGuestUserResponse) -> Unit = {},
    /** ANR guard; injectable only so JVM tests (where Looper is a stub) can exercise the flow. */
    private val isMainThread: () -> Boolean = { Looper.myLooper() == Looper.getMainLooper() }
) : Authenticator {

    private val refreshLock = Any()

    override fun authenticate(route: Route?, response: Response): Request? {
        // Guard against ANR
        if (isMainThread()) {
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
            val identityRejected: Boolean
            if (deviceId.isNullOrBlank() || userId.isNullOrBlank()) {
                identityRejected = true
            } else {
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
                identityRejected = sendTokenRes.code() in IDENTITY_REJECTED_CODES
            }

            // ---------- STEP 3: guest re-initialisation (rejected guest identity only) ----------
            if (identityRejected && !isPhoneVerified()) {
                return reinitializeGuest(authApi, response)
            }

            onSessionExpired?.invoke()
            null
        } catch (e: Exception) {
            Log.e("TokenAuthenticator", "Auth failed: ${e.localizedMessage}")
            null
        }
    }

    /**
     * Step 3: initialize_user with the guest API key. Success → tokens + user_id saved,
     * [onGuestReinitialized], original request retried. Anything else (including a network
     * failure) → [onSessionExpired] + null.
     */
    private fun reinitializeGuest(authApi: AuthApi, response: Response): Request? {
        return try {
            val (lat, long) = step3Coordinates()
            val deviceId = deviceIdSupplier()
            if (deviceId.isNullOrBlank()) {
                onSessionExpired?.invoke()
                return null
            }
            val initRes = authApi.initializeGuestUser(
                guestApiKey,
                InitializeGuestUserRequest(device_id = deviceId, lat = lat, long = long)
            ).execute()
            val body = if (initRes.isSuccessful) initRes.body() else null
            // access_token is non-null in the model, but Gson can still leave it null.
            val newAccess: String? = body?.access_token
            if (body == null || newAccess.isNullOrBlank()) {
                onSessionExpired?.invoke()
                return null
            }
            tokenStore.saveTokens(newAccess, body.refresh_token)
            body.user_id?.takeIf { it.isNotBlank() }?.let { tokenStore.saveUserId(it) }
            // A failing hook must not lose the retry: the new tokens are already saved.
            try {
                onGuestReinitialized(body)
            } catch (e: Exception) {
                Log.e("TokenAuthenticator", "Guest re-init hook failed: ${e.localizedMessage}")
            }
            response.request.newBuilder()
                .header("Authorization", "Bearer $newAccess")
                .build()
        } catch (e: Exception) {
            Log.e("TokenAuthenticator", "Guest re-init failed: ${e.localizedMessage}")
            onSessionExpired?.invoke()
            null
        }
    }

    /**
     * Step 3 coordinates (docs/02): the stored GPS fix when both values are present and resolved,
     * else the onboarding fallback, else none. A guest created without coordinates has no
     * location server-side and endpoint #12 returns an empty feed until one is set.
     */
    private fun step3Coordinates(): Pair<Double?, Double?> {
        val (storedLat, storedLong) = storedLatLong()
        if (storedLat != null && storedLong != null &&
            CountryLatLngProvider.isResolved(storedLat, storedLong)
        ) {
            return storedLat to storedLong
        }
        val fallback = try {
            fallbackLatLong()
        } catch (e: Exception) {
            null
        }
        if (fallback != null && CountryLatLngProvider.isResolved(fallback.first, fallback.second)) {
            return fallback.first to fallback.second
        }
        return null to null
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

    private companion object {
        /** send_tokens codes meaning "this identity is unknown/inactive" (stage: 400 User not found). */
        val IDENTITY_REJECTED_CODES = setOf(400, 401, 403, 404)
    }
}
