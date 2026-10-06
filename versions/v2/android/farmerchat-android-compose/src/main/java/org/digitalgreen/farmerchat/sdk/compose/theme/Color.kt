package org.digitalgreen.farmerchat.sdk.compose.theme

import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

// ---------------------------------------------------------------------------
// Color primitives (faithful port of the app's ColorPrimitives.kt)
// ---------------------------------------------------------------------------

// Base
val White = Color(0xFFFFFFFF)
val Black = Color(0xFF000000)
val Transparent = Color.Transparent

// Neutral (Zinc)
val Neutral50 = Color(0xFFFAFAFA)
val Neutral100 = Color(0xFFF4F4F5)
val Neutral150 = Color(0xFFECECEE)
val Neutral200 = Color(0xFFE4E4E7)
val Neutral300 = Color(0xFFD4D4D8)
val Neutral400 = Color(0xFF9F9FA9)
val Neutral500 = Color(0xFF71717B)
val Neutral600 = Color(0xFF52525C)
val Neutral700 = Color(0xFF3F3F46)
val Neutral800 = Color(0xFF27272A)
val Neutral900 = Color(0xFF18181B)
val Neutral950 = Color(0xFF09090B)

// Opacity ramp — Black
val Black50 = Color(0x80000000)
val Black60 = Color(0x99000000)

// Brand — Green
val Green500 = Color(0xFF00C950)
val Green700 = Color(0xFF008236)
val Green800 = Color(0xFF08361B)
val Green950 = Color(0xFF032E15)

// Brand — Green (Alpha)
val Green500_8 = Color(0x1400C950)
val Green500_16 = Color(0x2900C950)

// Sky
val Sky400 = Color(0xFF00BCFF)
val Sky700 = Color(0xFF0069A8)

// Sun
val Sun300 = Color(0xFFF9FF47)

// Accent gradient stops (Share button conic/sweep border)
val Cyan400 = Color(0xFF22D3EE)
val Yellow300 = Color(0xFFFFF947)

// Red
val Red500 = Color(0xFFE5533D)

// ---------------------------------------------------------------------------
// Brand semantic colors (ColorBrandSemantic.kt)
// ---------------------------------------------------------------------------

val LocalBrandColors = staticCompositionLocalOf<BrandColors> {
    error("No BrandColors provided")
}

data class BrandColors(
    val surfacePrimary: Color,
    val surfaceSecondary: Color,
    val surfaceTertiary: Color,
    val foregroundPrimary: Color,
    val foregroundSecondary: Color,
    val feedbackSuccess: Color,
    val feedbackFail: Color,
    // Accent gradient stops for the Share button's conic/sweep border. Defaulted so a host that
    // constructs BrandColors itself stays source-compatible — the app has no such constructor.
    val accentGradientGreen: Color = Green500,
    val accentGradientCyan: Color = Cyan400,
    val accentGradientYellow: Color = Yellow300,
) {
    /**
     * Compose equivalent of the design's
     * `conic-gradient(from 0deg at 50% 50%, green 0deg, cyan 90deg, green 180deg, yellow 270deg, green 360deg)`.
     *
     * A sweep gradient IS Compose's conic gradient, but its 0 degrees starts at 3 o'clock (right)
     * whereas CSS `conic-gradient(from 0deg)` starts at 12 o'clock (top). The stops below are
     * therefore rotated +90 degrees (shifted by 0.25) so the visual orientation matches the design:
     * top = green, right = cyan, bottom = green, left = yellow.
     */
    val accentSweepBorder: Brush
        get() = Brush.sweepGradient(
            0.00f to accentGradientCyan,   // right  (CSS 90)
            0.25f to accentGradientGreen,  // bottom (CSS 180)
            0.50f to accentGradientYellow, // left   (CSS 270)
            0.75f to accentGradientGreen,  // top    (CSS 0/360)
            1.00f to accentGradientCyan,   // back to right
        )
}

val BrandSemanticColors = BrandColors(
    surfacePrimary = Green700,
    surfaceSecondary = Green800,
    surfaceTertiary = Green950,
    foregroundPrimary = White,
    foregroundSecondary = Green500,
    feedbackSuccess = Green500,
    feedbackFail = Red500,
    accentGradientGreen = Green500,
    accentGradientCyan = Cyan400,
    accentGradientYellow = Yellow300,
)

// ---------------------------------------------------------------------------
// Content semantic colors (ColorContentSemantic.kt)
// ---------------------------------------------------------------------------

val LocalContentColors = staticCompositionLocalOf<ContentColors> {
    error("No ContentColors provided")
}

data class ContentColors(
    // Surface
    val surfacePrimary: Color,
    val surfaceSecondary: Color,
    val surfaceTertiary: Color,
    val surfaceActive: Color,

    // Reading
    val surfaceReadingPrimary: Color,
    val surfaceReadingSecondary: Color,
    val surfaceReadingTertiary: Color,

    // Foreground
    val foregroundPrimary: Color,
    val foregroundSecondary: Color,
    val foregroundTertiary: Color,

    // Button
    val buttonPrimarySurface: Color,
    val buttonPrimaryForeground: Color,
    val buttonPrimaryAccent: Color,

    // Border
    val borderDefault: Color,
    val borderActive: Color,

    // Form
    val formPlaceholder: Color,

    // Utility
    val scrim: Color,
    val shimmer: Color,
    val shine: Color,

    // Misc
    val transparent: Color,
)

val LightContentColors = ContentColors(
    surfacePrimary = Neutral150,
    surfaceSecondary = White,
    surfaceTertiary = Neutral200,
    surfaceActive = Green500_16,
    surfaceReadingPrimary = White,
    surfaceReadingSecondary = Neutral150,
    surfaceReadingTertiary = White,
    foregroundPrimary = Black,
    foregroundSecondary = Neutral600,
    foregroundTertiary = Neutral300,
    buttonPrimarySurface = Green800,
    buttonPrimaryForeground = White,
    buttonPrimaryAccent = Green500,
    borderDefault = Neutral300,
    borderActive = Green500,
    formPlaceholder = Neutral500,
    scrim = Black50,
    shimmer = Neutral100,
    shine = Black,
    transparent = Transparent,
)

val DarkContentColors = ContentColors(
    surfacePrimary = Neutral900,
    surfaceSecondary = Neutral800,
    surfaceTertiary = Neutral700,
    surfaceActive = Green500_16,
    surfaceReadingPrimary = Neutral900,
    surfaceReadingSecondary = Neutral800,
    surfaceReadingTertiary = Neutral900,
    foregroundPrimary = White,
    foregroundSecondary = Neutral400,
    foregroundTertiary = Neutral700,
    buttonPrimarySurface = Green700,
    buttonPrimaryForeground = White,
    buttonPrimaryAccent = Green500,
    borderDefault = Neutral700,
    borderActive = Green500,
    formPlaceholder = Neutral400,
    scrim = Black60,
    shimmer = Neutral900,
    shine = White,
    transparent = Transparent,
)
