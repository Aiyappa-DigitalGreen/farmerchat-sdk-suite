package org.digitalgreen.farmerchat.sdk.core.prefs

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * SharedPreferences wrapper for the SDK. Every key is namespaced with `fc_sdk_`
 * so the SDK never collides with the host app's preferences.
 *
 * Key groups mirror the production app's PreferenceKeys (doc 02 §Session & persistence).
 */
class SdkPreferences(context: Context) {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_FILE, Context.MODE_PRIVATE)
    private val gson = Gson()

    companion object {
        private const val PREFS_FILE = "fc_sdk_preferences"
        const val NAMESPACE = "fc_sdk_"
    }

    /** All preference keys used by the SDK (values are automatically namespaced). */
    object Keys {
        // ---- auth / session ----
        const val APP_ACCESS_TOKEN = "farmer_chat_app_access_token"
        const val APP_REFRESH_TOKEN = "farmer_chat_app_refresh_token"
        const val PREF_USER_ID = "logged_user_id_key"
        const val ANDROID_DEVICE_ID = "your_android_device_id"
        const val OTP_VERIFIED = "is_otp_verified_screen_done"
        const val PHONE_NUMBER_LOGIN = "phone_number_login_id"
        const val FIRST_LOGIN_DONE = "isUserFirstLogin"

        // ---- onboarding steps ----
        const val LANGUAGE_DONE = "is_language_screen_done"
        const val KEY_NAME_DONE = "is_name_screen_done"
        const val KEY_NAME_SCREEN_SEEN = "is_name_screen_seen_once"
        const val USER_NAME_ADDED = "is_user_name_added"
        const val BUILD_VERSION_API_CALLED = "is_build_version_api_called"
        /**
         * One-shot gate for the `FirstTimeOnboardingCompleted` event (app
         * `PreferenceKeys.First_Time_Onboarding_Completed`). App semantics: default **true**,
         * flipped to false after the event fires once.
         */
        const val FIRST_TIME_ONBOARDING_COMPLETED = "PREF_FirstTimeOnboardingCompleted"

        /**
         * One-shot gate for the `FirstTimeDashboardViewed` event (app
         * `PreferenceKeys.FIRST_TIME_DASHBOARD_VIEWED`) — a SEPARATE key from the onboarding
         * gate above, which earlier SDK builds reused by mistake.
         */
        const val FIRST_TIME_DASHBOARD_VIEWED = "FirstTimeDashboardViewed"
        const val APP_INSTALL_FIRST = "is_fc_app_install"

        // ---- language / labels ----
        const val SELECTED_LANGUAGE_ID = "language_selected_id"
        const val SELECTED_LANGUAGE_CODE = "language_selected_code_key"
        const val SELECTED_LANGUAGE_DISPLAY_NAME = "language_selected_display_name"
        const val MULTI_LANGUAGE_LABELS = "multi_language_labels_object"
        const val LANGUAGE_LABELS_LOADED = "is_language_labels_loaded"
        const val ASR_ENABLED = "is_asr_enabled"
        const val TTS_ENABLED = "is_tts_enabled"

        /**
         * Per-language `streaming_required` from the language API, persisted under the app's own
         * key name and sent on every text-prompt request (2.0.0, docs/02 §#27a). Defaults to true
         * when unset, so an existing install keeps current behaviour.
         */
        const val STREAMING_REQUIRED = "is_streaming_required"

        // ---- crops ----
        const val SELECTED_CROP_ID = "crop_selected_id"
        const val SELECTED_CROP_NAME = "crop_selected_name"
        const val CROP_SELECTION_ENABLED = "is_crop_enable"
        const val CULTIVATED_CROPS_DONE = "is_cultivated_screen_done"
        const val SHOW_CROPS_LIVESTOCKS = "is_show_crops_livestocks"

        // ---- location ----
        const val FARMER_APP_LATITUDE = "farmer_chat_latitude_key"
        const val FARMER_APP_LONGITUDE = "farmer_chat_longitude_key"
        const val USER_COUNTRY_CODE = "farmer_country_code_key"
        const val USER_COUNTRY_NAME = "user_country_name"
        const val USER_SELECTED_STATE_CODE = "user_selected_state"
        const val APPROX_LOCATION_NAME = "approx_location_name"
        const val LOCATION_DONE = "is_location_screen_done"
        const val SHARE_LOCATION_SHOWN = "is_share_location_shown"
        const val GPS_PERMISSION_SHOULD_ASK = "gps_permission_should_ask"
        const val LOCATION_UPGRADED_TO_GPS = "location_upgraded_to_gps"
        const val GET_USER_SELECTED_COUNTRY_PHONE_CODE = "user_selected_country_code_id"
        const val GPS_LOCATION_SHARED = "gps_location_shared"

        // ---- chat ----
        const val NEW_CONVERSATION_ID = "new_conversation_id"
        /** Effective base URL of the last init — used to invalidate env-scoped cache. */
        const val LAST_BASE_URL = "last_base_url"
        const val FIRST_QUERY_ASKED = "isFirstQueryAsked"
        const val CACHED_HOME_FEED_RESPONSE = "cached_home_feed_response"

        // ---- permission counters ----
        const val PERMISSION_DENY_COUNT = "deny_count"
        const val CAMERA_PERMISSION_DENY_COUNT = "camera_permission_deny_count"
        const val MICROPHONE_PERMISSION_DENY_COUNT = "microphone_permission_deny_count"
        const val CAMERA_PERMISSION_ATTEMPT_COUNT = "camera_permission_attempt_count"
        const val MICROPHONE_PERMISSION_ATTEMPT_COUNT = "microphone_permission_attempt_count"

        // ---- UI ----
        const val APPEARANCE_MODE = "appearance_mode"
        const val FONT_SIZE = "set_font_size_id"
        const val USER_NAME = "user_name"
        const val DASHBOARD = "dashboard"

        // ---- UTM ----
        const val UTM_SOURCE = "utm_source"
        const val UTM_MEDIUM = "utm_medium"
        const val UTM_CAMPAIGN = "utm_campaign"
    }

    private fun namespaced(key: String): String = NAMESPACE + key

    // ---------------- generic accessors ----------------

    fun putString(key: String, value: String?) {
        prefs.edit().putString(namespaced(key), value).apply()
    }

    fun getString(key: String, default: String = ""): String =
        prefs.getString(namespaced(key), default) ?: default

    fun putBoolean(key: String, value: Boolean) {
        prefs.edit().putBoolean(namespaced(key), value).apply()
    }

    fun getBoolean(key: String, default: Boolean = false): Boolean =
        prefs.getBoolean(namespaced(key), default)

    fun putInt(key: String, value: Int) {
        prefs.edit().putInt(namespaced(key), value).apply()
    }

    fun getInt(key: String, default: Int = 0): Int =
        prefs.getInt(namespaced(key), default)

    fun putLong(key: String, value: Long) {
        prefs.edit().putLong(namespaced(key), value).apply()
    }

    fun getLong(key: String, default: Long = 0L): Long =
        prefs.getLong(namespaced(key), default)

    fun remove(key: String) {
        prefs.edit().remove(namespaced(key)).apply()
    }

    fun contains(key: String): Boolean = prefs.contains(namespaced(key))

    /**
     * Clears all SDK preferences. When [preserveAppearance] is true the appearance
     * mode selection survives (logout semantics of the production app).
     */
    fun clearAll(preserveAppearance: Boolean = true) {
        val appearance = if (preserveAppearance) getString(Keys.APPEARANCE_MODE, "") else ""
        val deviceId = getString(Keys.ANDROID_DEVICE_ID, "")
        prefs.edit().clear().apply()
        if (preserveAppearance && appearance.isNotBlank()) {
            putString(Keys.APPEARANCE_MODE, appearance)
        }
        // Device id survives logout (it identifies the install, not the user).
        if (deviceId.isNotBlank()) {
            putString(Keys.ANDROID_DEVICE_ID, deviceId)
        }
    }

    // ---------------- language labels ----------------

    fun saveLanguageLabels(labels: Map<String, String>) {
        putString(Keys.MULTI_LANGUAGE_LABELS, gson.toJson(labels))
        putBoolean(Keys.LANGUAGE_LABELS_LOADED, true)
    }

    fun getLanguageLabels(): Map<String, String>? {
        val json = getString(Keys.MULTI_LANGUAGE_LABELS, "")
        if (json.isBlank()) return null
        return runCatching {
            gson.fromJson<Map<String, String>>(
                json,
                object : TypeToken<Map<String, String>>() {}.type
            )
        }.getOrNull()
    }
}
