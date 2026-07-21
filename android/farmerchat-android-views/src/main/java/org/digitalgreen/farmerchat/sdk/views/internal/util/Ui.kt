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
    const val LOOKING_AT_PHONE_SQUARE = "farmer_looking_at_phone_square.webp"
    const val LOOKING_AT_SKY = "farmer_looking_at_sky.webp"

    private val supportedCountries = setOf("ke", "et", "in", "ng")

    fun assetUrl(context: Context, name: String): String {
        val country = runCatching {
            FarmerChat.requireGraph().prefs
                .getString(SdkPreferences.Keys.USER_COUNTRY_CODE, "")
        }.getOrDefault("").trim().lowercase().ifBlank { "ke" }
        val resolved = if (country in supportedCountries) country else "ke"
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
