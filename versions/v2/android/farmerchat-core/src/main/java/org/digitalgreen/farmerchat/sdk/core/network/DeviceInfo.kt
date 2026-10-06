package org.digitalgreen.farmerchat.sdk.core.network

import android.annotation.SuppressLint
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.provider.Settings
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.json.JSONObject
import java.net.URLEncoder
import java.util.Locale
import java.util.UUID
import org.digitalgreen.farmerchat.sdk.core.BuildConfig

/**
 * SDK version reported in the Device-Info header.
 *
 * Read from BuildConfig, which the module generates from `project.version`. It was hardcoded
 * "1.0.0" while the root build published **2.0.0**, so every request from a 2.0.0 SDK announced
 * itself to the backend as 1.0.0 — silently, since nothing validates it client-side.
 */
internal val SDK_VERSION_NAME: String = BuildConfig.SDK_VERSION_NAME
internal val SDK_VERSION_CODE: Int =
    SDK_VERSION_NAME.substringBefore('.').toIntOrNull() ?: 1

/**
 * Provides a stable device id. Prefers ANDROID_ID; falls back to a random UUID
 * persisted in the SDK's namespaced prefs.
 */
class DeviceIdProvider(
    private val context: Context,
    private val prefs: SdkPreferences
) {
    @SuppressLint("HardwareIds")
    fun getDeviceId(): String {
        val cached = prefs.getString(SdkPreferences.Keys.ANDROID_DEVICE_ID, "")
        if (cached.isNotBlank()) return cached

        val androidId = runCatching {
            Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        }.getOrNull()

        val id = if (!androidId.isNullOrBlank() &&
            androidId != "9774d56d682e549c" &&
            androidId != "0000000000000000" &&
            androidId.lowercase() != "null"
        ) {
            androidId
        } else {
            UUID.randomUUID().toString()
        }
        prefs.putString(SdkPreferences.Keys.ANDROID_DEVICE_ID, id)
        return id
    }
}

/**
 * Builds the url-encoded JSON `Device-Info` header value, mirroring the app's
 * getEncodedDeviceConfig() (app version fields report the SDK version).
 */
fun buildEncodedDeviceConfig(context: Context, prefs: SdkPreferences): String {
    val androidId = DeviceIdProvider(context, prefs).getDeviceId()

    val deviceConfig = mapOf(
        "Build-Version" to "v2",
        "app_version_name" to SDK_VERSION_NAME,
        "app_version_code" to SDK_VERSION_CODE,
        "manufacturer" to Build.MANUFACTURER.replaceFirstChar {
            if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString()
        },
        "model" to Build.MODEL,
        "brand" to Build.BRAND,
        "hardware" to Build.HARDWARE,
        "product" to Build.PRODUCT,
        "android_sdk_version" to Build.VERSION.SDK_INT,
        "os_version" to Build.VERSION.RELEASE,
        "android_id" to androidId,
        "sdk" to "farmerchat-android"
    )

    return URLEncoder.encode(JSONObject(deviceConfig).toString(), "UTF-8")
}

/** Connectivity check used to short-circuit to the No-Internet screen. */
object NetworkUtils {
    fun isOnline(context: Context): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return false
        val network = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }
}
