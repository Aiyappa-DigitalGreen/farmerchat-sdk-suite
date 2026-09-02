package org.digitalgreen.farmerchat.sdk.core.auth

import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences

interface TokenStore {
    fun getAccessToken(): String?
    fun getRefreshToken(): String?
    fun saveTokens(accessToken: String?, refreshToken: String?)
    fun getUserId(): String?
    fun getDeviceId(): String?
    /** Removes only tokens (keys mirror the app: access/refresh). */
    fun clear()
}

/**
 * Preference-backed token store. Key names match the production app's
 * (`farmer_chat_app_access_token`, `farmer_chat_app_refresh_token`,
 * `logged_user_id_key`, `your_android_device_id`) inside the `fc_sdk_` namespace.
 */
class PreferenceTokenStore(
    private val prefs: SdkPreferences
) : TokenStore {

    override fun getAccessToken(): String? =
        prefs.getString(SdkPreferences.Keys.APP_ACCESS_TOKEN, "")

    override fun getRefreshToken(): String? =
        prefs.getString(SdkPreferences.Keys.APP_REFRESH_TOKEN, "")

    override fun saveTokens(accessToken: String?, refreshToken: String?) {
        prefs.putString(SdkPreferences.Keys.APP_ACCESS_TOKEN, accessToken)
        prefs.putString(SdkPreferences.Keys.APP_REFRESH_TOKEN, refreshToken)
    }

    override fun getUserId(): String? =
        prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "")

    override fun getDeviceId(): String? =
        prefs.getString(SdkPreferences.Keys.ANDROID_DEVICE_ID, "")

    override fun clear() {
        prefs.remove(SdkPreferences.Keys.APP_ACCESS_TOKEN)
        prefs.remove(SdkPreferences.Keys.APP_REFRESH_TOKEN)
    }
}
