package org.digitalgreen.farmerchat.sdk.views.internal.util

import android.content.Context
import android.util.TypedValue
import android.widget.ImageView
import coil.ImageLoader
import coil.decode.SvgDecoder
import coil.load
import coil.request.ImageRequest
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.views.R

internal fun Int.dp(context: Context): Int =
    TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP, this.toFloat(), context.resources.displayMetrics
    ).toInt()

/** Farmer illustration asset names in farmerchat-core assets/{country}/. */
internal object FarmerIllustrations {
    const val LOOKING_AT_CAMERA = "farmer_looking_at_camera.webp"
    const val LOOKING_AT_PHONE = "farmer_looking_at_phone.webp"
    const val LOOKING_AT_SKY = "farmer_looking_at_sky.webp"
    const val LOOKING_AT_PHONE_SQUARE = "farmer_looking_at_phone_square.webp"

    private val supportedCountries = setOf("ke", "et", "in", "ng")

    /**
     * Country packs actually present in the APK.
     *
     * The SDK bundles ke/et/in/ng, but a single-country host can drop the rest to save ~370 KB
     * each (see android/README.md — `androidResources { ignoreAssetsPattern }`). Resolving
     * against what SHIPPED rather than the compile-time list means a stripped build degrades to
     * a bundled illustration instead of a broken image. Computed once per process.
     */
    private var bundled: Set<String>? = null

    private fun bundledCountries(context: Context): Set<String> = bundled ?: runCatching {
        val root = context.assets.list("")?.toSet().orEmpty()
        supportedCountries.filter { it in root }.toSet()
    }.getOrDefault(supportedCountries).also { bundled = it }

    fun assetUrl(context: Context, name: String): String {
        val country = runCatching {
            FarmerChat.requireGraph().prefs
                .getString(SdkPreferences.Keys.USER_COUNTRY_CODE, "")
        }.getOrDefault("").trim().lowercase().ifBlank { "ke" }
        val present = bundledCountries(context)
        val resolved = when {
            country in present -> country
            "ke" in present -> "ke"
            else -> present.firstOrNull() ?: "ke"
        }
        return "file:///android_asset/$resolved/$name"
    }
}

/** Loads a farmer illustration (country-specific) from farmerchat-core assets via coil. */
internal fun ImageView.loadFarmerIllustration(assetName: String) {
    val url = FarmerIllustrations.assetUrl(context, assetName)
    load(url) { crossfade(true) }
}

private var svgLoader: ImageLoader? = null

/** Coil loader with SVG support (weather icons come as SVG URLs). */
internal fun svgImageLoader(context: Context): ImageLoader {
    return svgLoader ?: ImageLoader.Builder(context.applicationContext)
        .components { add(SvgDecoder.Factory()) }
        .build()
        .also { svgLoader = it }
}

internal fun ImageView.loadSvgOrImage(url: String?) {
    if (url.isNullOrBlank()) return
    val request = ImageRequest.Builder(context)
        .data(url)
        .crossfade(true)
        .target(this)
        .build()
    svgImageLoader(context).enqueue(request)
}

/** Weather icon fallback drawable when the icon URL fails / is a keyword. */
internal fun weatherFallbackRes(icon: String?): Int = when {
    icon == null -> R.drawable.fc_weather_sun
    icon.contains("rain", ignoreCase = true) -> R.drawable.fc_weather_rain
    icon.contains("cloud", ignoreCase = true) -> R.drawable.fc_weather_sunclouds
    else -> R.drawable.fc_weather_sun
}
