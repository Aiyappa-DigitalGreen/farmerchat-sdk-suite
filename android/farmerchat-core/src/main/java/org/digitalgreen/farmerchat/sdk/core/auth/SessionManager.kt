package org.digitalgreen.farmerchat.sdk.core.auth

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import org.digitalgreen.farmerchat.sdk.core.base.ApiResult
import org.digitalgreen.farmerchat.sdk.core.model.InitializeGuestUserRequest
import org.digitalgreen.farmerchat.sdk.core.model.InitializeGuestUserResponse
import org.digitalgreen.farmerchat.sdk.core.model.VerifyOtpResponse
import org.digitalgreen.farmerchat.sdk.core.network.DeviceIdProvider
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.usecase.HistoryUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.InitializeGuestUserUseCase

/**
 * Owns the session lifecycle: guest init → OTP login → logout.
 * The host never touches tokens; auth state is observable via [isAuthenticated].
 */
class SessionManager(
    private val prefs: SdkPreferences,
    private val tokenStore: TokenStore,
    private val deviceIdProvider: DeviceIdProvider,
    private val initializeGuestUserUseCase: InitializeGuestUserUseCase,
    private val historyUseCase: HistoryUseCase
) {

    private val _isAuthenticated = MutableStateFlow(
        prefs.getBoolean(SdkPreferences.Keys.OTP_VERIFIED, false)
    )

    /** True only after OTP verification ("signed up"); guest sessions are not authenticated. */
    val isAuthenticated: StateFlow<Boolean> = _isAuthenticated

    fun hasSession(): Boolean = !tokenStore.getAccessToken().isNullOrBlank()

    fun currentUserId(): String = prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "")

    fun deviceId(): String = deviceIdProvider.getDeviceId()

    /**
     * Guest init (endpoint #1). Issues tokens, persists user id + IP-derived location
     * hints. Safe to call repeatedly — server returns the same guest user per device.
     */
    suspend fun initializeGuestUser(
        lat: Double? = null,
        long: Double? = null,
        accuracy: Double? = null
    ): ApiResult<InitializeGuestUserResponse> {
        val request = InitializeGuestUserRequest(
            device_id = deviceId(),
            lat = lat,
            long = long,
            accuracy = accuracy,
            utm_source = prefs.getString(SdkPreferences.Keys.UTM_SOURCE, "").ifBlank { null },
            utm_medium = prefs.getString(SdkPreferences.Keys.UTM_MEDIUM, "").ifBlank { null },
            utm_campaign = prefs.getString(SdkPreferences.Keys.UTM_CAMPAIGN, "").ifBlank { null }
        )
        val result = initializeGuestUserUseCase.initializeGuestUser(request).first()
        if (result is ApiResult.Success) {
            val data = result.data
            tokenStore.saveTokens(data.access_token, data.refresh_token)
            data.user_id?.let { prefs.putString(SdkPreferences.Keys.PREF_USER_ID, it) }
            prefs.putBoolean(SdkPreferences.Keys.SHOW_CROPS_LIVESTOCKS, data.show_crops_livestocks)
            data.country_code?.let { prefs.putString(SdkPreferences.Keys.USER_COUNTRY_CODE, it) }
            data.country?.let { prefs.putString(SdkPreferences.Keys.USER_COUNTRY_NAME, it) }
            data.state?.let { prefs.putString(SdkPreferences.Keys.USER_SELECTED_STATE_CODE, it) }
            data.dashboard?.let { prefs.putBoolean(SdkPreferences.Keys.DASHBOARD, it) }
        }
        return result
    }

    /**
     * Called after a successful verify_otp (endpoint #21): persists tokens + login
     * markers, mirrors the app's Auth success edge (`OTP_VERIFIED=true`,
     * `PHONE_NUMBER_LOGIN`, name screen seen).
     */
    fun onOtpVerified(response: VerifyOtpResponse, phoneE164: String) {
        if (!response.access_token.isNullOrBlank()) {
            tokenStore.saveTokens(response.access_token, response.refresh_token)
        }
        response.id?.let { prefs.putString(SdkPreferences.Keys.PREF_USER_ID, it) }
        prefs.putBoolean(SdkPreferences.Keys.OTP_VERIFIED, true)
        prefs.putString(SdkPreferences.Keys.PHONE_NUMBER_LOGIN, phoneE164)
        prefs.putBoolean(SdkPreferences.Keys.KEY_NAME_SCREEN_SEEN, true)
        response.preferred_language?.let { lang ->
            lang.code?.let { prefs.putString(SdkPreferences.Keys.SELECTED_LANGUAGE_CODE, it) }
            lang.id?.let { prefs.putInt(SdkPreferences.Keys.SELECTED_LANGUAGE_ID, it) }
            lang.asr_enabled?.let { prefs.putBoolean(SdkPreferences.Keys.ASR_ENABLED, it) }
            lang.tts_enabled?.let { prefs.putBoolean(SdkPreferences.Keys.TTS_ENABLED, it) }
        }
        response.name?.takeIf { it.isNotBlank() }?.let {
            prefs.putString(SdkPreferences.Keys.USER_NAME, it)
            prefs.putBoolean(SdkPreferences.Keys.USER_NAME_ADDED, true)
        }
        _isAuthenticated.value = true
    }

    /**
     * Logout (app semantics): POST api/user/logout/ best-effort, clear all SDK prefs
     * (preserving appearance), clear tokens, flip auth state.
     */
    suspend fun logout(): Boolean {
        val apiResult = runCatching { historyUseCase.logoutApp().first() }.getOrNull()
        prefs.clearAll(preserveAppearance = true)
        tokenStore.clear()
        _isAuthenticated.value = false
        return apiResult is ApiResult.Success
    }

    /** Re-sync auth state from prefs (used when the nav graph re-reads OTP_VERIFIED). */
    fun refreshAuthState() {
        _isAuthenticated.value = prefs.getBoolean(SdkPreferences.Keys.OTP_VERIFIED, false)
    }
}
