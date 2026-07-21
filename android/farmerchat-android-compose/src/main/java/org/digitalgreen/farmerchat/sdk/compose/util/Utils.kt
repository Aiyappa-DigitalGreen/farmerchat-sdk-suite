package org.digitalgreen.farmerchat.sdk.compose.util

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.painter.Painter
import coil.compose.rememberAsyncImagePainter
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.core.labels.LabelManager
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences

/** Convenience accessor for the SDK label manager. */
val labelManager: LabelManager
    get() = FarmerChat.requireGraph().labelManager

/** Shorthand used by every screen/component: all user-visible strings go through this. */
fun label(baseKey: String, englishFallback: String): String =
    labelManager.getLabel(baseKey, englishFallback)

/**
 * Country-scoped farmer illustrations, loaded from farmerchat-core assets.
 * Port of the app's CountryImageAssets.
 */
object CountryImageAssets {

    const val LOOKING_AT_CAMERA = "farmer_looking_at_camera"
    const val LOOKING_AT_PHONE = "farmer_looking_at_phone"
    const val LOOKING_AT_PHONE_SQUARE = "farmer_looking_at_phone_square"
    const val LOOKING_AT_SKY = "farmer_looking_at_sky"

    private val SUPPORTED_COUNTRIES = setOf("ke", "et", "ng", "in")
    private const val FALLBACK_COUNTRY = "ke"

    private fun folderFor(countryCode: String): String {
        val code = countryCode.lowercase()
        return if (code in SUPPORTED_COUNTRIES) code else FALLBACK_COUNTRY
    }

    fun assetUri(countryCode: String, imageName: String): Uri {
        val folder = folderFor(countryCode)
        return Uri.parse("file:///android_asset/$folder/$imageName.webp")
    }
}

/**
 * Returns a [Painter] loading [imageName] from assets for the current user's
 * country (USER_COUNTRY_CODE pref), falling back to Kenya.
 */
@Composable
fun rememberCountryFarmerPainter(imageName: String): Painter {
    val prefs = FarmerChat.requireGraph().prefs
    val countryCode = remember {
        prefs.getString(SdkPreferences.Keys.USER_COUNTRY_CODE, "").trim().ifBlank { "ke" }
    }
    val uri = remember(countryCode, imageName) {
        CountryImageAssets.assetUri(countryCode, imageName)
    }
    return rememberAsyncImagePainter(uri)
}

/** True when the device currently has an internet-capable network. */
fun isNetworkAvailable(context: Context): Boolean {
    return runCatching {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }.getOrDefault(false)
}

/** Simple debounce for click handlers (port of the app's rememberDebouncedClick). */
class DebouncedAction(private val intervalMs: Long = 600L) {
    private var lastClick = 0L
    operator fun invoke(block: () -> Unit) {
        val now = System.currentTimeMillis()
        if (now - lastClick >= intervalMs) {
            lastClick = now
            block()
        }
    }
}

@Composable
fun rememberDebouncedAction(intervalMs: Long = 600L): DebouncedAction =
    remember { DebouncedAction(intervalMs) }
