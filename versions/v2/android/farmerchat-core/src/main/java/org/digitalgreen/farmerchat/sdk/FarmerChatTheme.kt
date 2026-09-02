package org.digitalgreen.farmerchat.sdk

import androidx.annotation.ColorInt
import androidx.annotation.DrawableRes
import androidx.annotation.FontRes

/**
 * Optional host theme. Everything is nullable / defaulted — omitted values fall
 * back to the built-in FarmerChat green brand. Colors are ARGB [ColorInt]s.
 *
 * Each color has a light value (used for both light and dark unless a `*Dark`
 * override is supplied). Brand colors (primary/accent/onBrand/error) apply to
 * both appearances; neutral surface/background/text colors only override the
 * matching light-mode token, so a host that supplies only light colors still
 * gets the SDK's sensible dark surfaces. On-colors are auto-derived for contrast
 * when not supplied.
 *
 * ```
 * FarmerChatConfig.builder(FarmerChatEnvironment.PROD)
 *   .theme(
 *     FarmerChatTheme.builder()
 *       .brandPrimary(0xFF1565C0.toInt())
 *       .brandAccent(0xFF42A5F5.toInt())
 *       .cardCornerRadius(16)
 *       .fontFamily(R.font.host_sans)
 *       .logo(R.drawable.host_logo)
 *       .build()
 *   )
 *   .build()
 * ```
 */
class FarmerChatTheme private constructor(
    // --- Colors (light / default) -------------------------------------------
    @ColorInt val brandPrimary: Int?,
    @ColorInt val brandPrimaryDark: Int?,
    @ColorInt val brandAccent: Int?,
    @ColorInt val onBrand: Int?,
    @ColorInt val background: Int?,
    @ColorInt val readingSurface: Int?,
    @ColorInt val cardSurface: Int?,
    @ColorInt val error: Int?,
    @ColorInt val onBackground: Int?,
    @ColorInt val onSurface: Int?,
    // --- Colors (optional dark-set overrides) -------------------------------
    @ColorInt val brandPrimaryNight: Int?,
    @ColorInt val brandPrimaryDarkNight: Int?,
    @ColorInt val brandAccentNight: Int?,
    @ColorInt val onBrandNight: Int?,
    @ColorInt val backgroundNight: Int?,
    @ColorInt val readingSurfaceNight: Int?,
    @ColorInt val cardSurfaceNight: Int?,
    @ColorInt val errorNight: Int?,
    @ColorInt val onBackgroundNight: Int?,
    @ColorInt val onSurfaceNight: Int?,
    // --- Shape (dp) ----------------------------------------------------------
    val cardCornerRadius: Int?,
    val buttonCornerRadius: Int?,
    val inputCornerRadius: Int?,
    // --- Typography ----------------------------------------------------------
    @FontRes val fontFamily: Int?,
    val typeScale: Float?,
    // --- Branding ------------------------------------------------------------
    @DrawableRes val logo: Int?,
) {

    class Builder {
        @ColorInt private var brandPrimary: Int? = null
        @ColorInt private var brandPrimaryDark: Int? = null
        @ColorInt private var brandAccent: Int? = null
        @ColorInt private var onBrand: Int? = null
        @ColorInt private var background: Int? = null
        @ColorInt private var readingSurface: Int? = null
        @ColorInt private var cardSurface: Int? = null
        @ColorInt private var error: Int? = null
        @ColorInt private var onBackground: Int? = null
        @ColorInt private var onSurface: Int? = null

        @ColorInt private var brandPrimaryNight: Int? = null
        @ColorInt private var brandPrimaryDarkNight: Int? = null
        @ColorInt private var brandAccentNight: Int? = null
        @ColorInt private var onBrandNight: Int? = null
        @ColorInt private var backgroundNight: Int? = null
        @ColorInt private var readingSurfaceNight: Int? = null
        @ColorInt private var cardSurfaceNight: Int? = null
        @ColorInt private var errorNight: Int? = null
        @ColorInt private var onBackgroundNight: Int? = null
        @ColorInt private var onSurfaceNight: Int? = null

        private var cardCornerRadius: Int? = null
        private var buttonCornerRadius: Int? = null
        private var inputCornerRadius: Int? = null

        @FontRes private var fontFamily: Int? = null
        private var typeScale: Float? = null

        @DrawableRes private var logo: Int? = null

        fun brandPrimary(@ColorInt c: Int?) = apply { brandPrimary = c }
        fun brandPrimaryDark(@ColorInt c: Int?) = apply { brandPrimaryDark = c }
        fun brandAccent(@ColorInt c: Int?) = apply { brandAccent = c }
        fun onBrand(@ColorInt c: Int?) = apply { onBrand = c }
        fun background(@ColorInt c: Int?) = apply { background = c }
        fun readingSurface(@ColorInt c: Int?) = apply { readingSurface = c }
        fun cardSurface(@ColorInt c: Int?) = apply { cardSurface = c }
        fun error(@ColorInt c: Int?) = apply { error = c }
        fun onBackground(@ColorInt c: Int?) = apply { onBackground = c }
        fun onSurface(@ColorInt c: Int?) = apply { onSurface = c }

        fun brandPrimaryNight(@ColorInt c: Int?) = apply { brandPrimaryNight = c }
        fun brandPrimaryDarkNight(@ColorInt c: Int?) = apply { brandPrimaryDarkNight = c }
        fun brandAccentNight(@ColorInt c: Int?) = apply { brandAccentNight = c }
        fun onBrandNight(@ColorInt c: Int?) = apply { onBrandNight = c }
        fun backgroundNight(@ColorInt c: Int?) = apply { backgroundNight = c }
        fun readingSurfaceNight(@ColorInt c: Int?) = apply { readingSurfaceNight = c }
        fun cardSurfaceNight(@ColorInt c: Int?) = apply { cardSurfaceNight = c }
        fun errorNight(@ColorInt c: Int?) = apply { errorNight = c }
        fun onBackgroundNight(@ColorInt c: Int?) = apply { onBackgroundNight = c }
        fun onSurfaceNight(@ColorInt c: Int?) = apply { onSurfaceNight = c }

        /** Card / list corner radius in dp (default 24). */
        fun cardCornerRadius(dp: Int?) = apply { cardCornerRadius = dp }
        /** Primary button corner radius in dp (default 12). */
        fun buttonCornerRadius(dp: Int?) = apply { buttonCornerRadius = dp }
        /** Input field / tile corner radius in dp (default 12). */
        fun inputCornerRadius(dp: Int?) = apply { inputCornerRadius = dp }

        /** Host font resource (Android `@font/...`). Default: SDK per-language sans. */
        fun fontFamily(@FontRes res: Int?) = apply { fontFamily = res }
        /** Multiplier on all text sizes (default 1.0). */
        fun typeScale(scale: Float?) = apply { typeScale = scale }

        /** Host logo drawable overriding the 6-petal mark. */
        fun logo(@DrawableRes res: Int?) = apply { logo = res }

        fun build(): FarmerChatTheme = FarmerChatTheme(
            brandPrimary, brandPrimaryDark, brandAccent, onBrand, background,
            readingSurface, cardSurface, error, onBackground, onSurface,
            brandPrimaryNight, brandPrimaryDarkNight, brandAccentNight, onBrandNight,
            backgroundNight, readingSurfaceNight, cardSurfaceNight, errorNight,
            onBackgroundNight, onSurfaceNight,
            cardCornerRadius, buttonCornerRadius, inputCornerRadius,
            fontFamily, typeScale, logo
        )
    }

    companion object {
        @JvmStatic
        fun builder(): Builder = Builder()
    }
}
