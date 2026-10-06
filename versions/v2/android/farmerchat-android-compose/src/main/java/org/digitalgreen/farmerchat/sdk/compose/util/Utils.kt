package org.digitalgreen.farmerchat.sdk.compose.util

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import androidx.core.content.ContextCompat
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.platform.LocalContext
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

    /**
     * Country packs actually present in the APK.
     *
     * The SDK bundles ke/et/ng/in, but a single-country host can drop the rest to save ~370 KB
     * each (see android/README.md — `androidResources { ignoreAssetsPattern }`). Resolving
     * against what SHIPPED rather than the compile-time list means a stripped build degrades to
     * a bundled illustration instead of a broken image. Computed once per process.
     */
    private var bundled: Set<String>? = null

    private fun bundledCountries(context: Context): Set<String> = bundled ?: runCatching {
        val root = context.assets.list("")?.toSet().orEmpty()
        SUPPORTED_COUNTRIES.filter { it in root }.toSet()
    }.getOrDefault(SUPPORTED_COUNTRIES).also { bundled = it }

    private fun folderFor(context: Context, countryCode: String): String {
        val code = countryCode.lowercase()
        val present = bundledCountries(context)
        return when {
            code in present -> code
            FALLBACK_COUNTRY in present -> FALLBACK_COUNTRY
            else -> present.firstOrNull() ?: FALLBACK_COUNTRY
        }
    }

    fun assetUri(context: Context, countryCode: String, imageName: String): Uri {
        val folder = folderFor(context, countryCode)
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
    val appContext = LocalContext.current.applicationContext
    val countryCode = remember {
        prefs.getString(SdkPreferences.Keys.USER_COUNTRY_CODE, "").trim().ifBlank { "ke" }
    }
    val uri = remember(countryCode, imageName) {
        CountryImageAssets.assetUri(appContext, countryCode, imageName)
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

/**
 * Live OS location-permission check — the SDK's stand-in for the app's
 * `LocationPromptManager.hasCurrentLocationPermission()`, which core does not expose (core has no
 * Android permission APIs). Fine **or** coarse counts as granted, matching `LocationPromptHost`.
 *
 * Needed wherever a stored GPS fix is displayed: `hasStoredLocation()` stays true after the
 * farmer revokes the permission from system Settings, so a saved exact location can only be
 * trusted when paired with this check.
 */
fun hasLocationPermission(context: Context): Boolean =
    ContextCompat.checkSelfPermission(
        context, Manifest.permission.ACCESS_FINE_LOCATION
    ) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

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
