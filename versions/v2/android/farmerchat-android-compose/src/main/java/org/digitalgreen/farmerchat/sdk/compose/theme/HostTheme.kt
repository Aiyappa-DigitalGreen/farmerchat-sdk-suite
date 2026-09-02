package org.digitalgreen.farmerchat.sdk.compose.theme

import androidx.compose.material3.Typography
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.isSpecified
import androidx.compose.ui.unit.sp
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.FarmerChatTheme

// ---------------------------------------------------------------------------
// Single resolver that overlays a host FarmerChatTheme onto the built-in tokens
// (Color.kt / Shapes.kt / Type.kt). Every ported screen reads the resolved
// tokens through the same CompositionLocals, so recoloring needs ZERO per-screen
// edits. Appearance day/night still applies; brand colors apply to both
// appearances, neutral surfaces default to the SDK's own dark palette when the
// host supplies only light colors.
// ---------------------------------------------------------------------------

private fun Int.toColor(): Color = Color(this)

/** Night override wins in dark mode; otherwise the (shared) light value is used. */
private fun pick(light: Int?, night: Int?, dark: Boolean): Int? =
    if (dark) (night ?: light) else light

/** Auto on-color: white on dark brand, black on light brand. */
private fun contrastOn(bg: Color): Color =
    if (bg.luminance() < 0.5f) Color.White else Color.Black

private fun Color.darken(factor: Float): Color =
    Color(red * factor, green * factor, blue * factor, alpha)

// -------------------------------------------------------------- Brand colors

internal fun resolveBrandColors(theme: FarmerChatTheme?, dark: Boolean): BrandColors {
    if (theme == null) return BrandSemanticColors

    val primary = pick(theme.brandPrimary, theme.brandPrimaryNight, dark)?.toColor()
        ?: BrandSemanticColors.surfacePrimary
    val primaryDark = pick(theme.brandPrimaryDark, theme.brandPrimaryDarkNight, dark)?.toColor()
        ?: BrandSemanticColors.surfaceSecondary
    val accent = pick(theme.brandAccent, theme.brandAccentNight, dark)?.toColor()
        ?: BrandSemanticColors.foregroundSecondary
    val onBrand = pick(theme.onBrand, theme.onBrandNight, dark)?.toColor()
        ?: if (theme.brandPrimary != null || theme.brandPrimaryNight != null) contrastOn(primary)
        else BrandSemanticColors.foregroundPrimary
    val fail = pick(theme.error, theme.errorNight, dark)?.toColor()
        ?: BrandSemanticColors.feedbackFail
    val tertiary = when {
        theme.brandPrimaryDark != null || theme.brandPrimaryDarkNight != null -> primaryDark.darken(0.6f)
        else -> BrandSemanticColors.surfaceTertiary
    }

    return BrandColors(
        surfacePrimary = primary,
        surfaceSecondary = primaryDark,
        surfaceTertiary = tertiary,
        foregroundPrimary = onBrand,
        foregroundSecondary = accent,
        feedbackSuccess = accent,
        feedbackFail = fail,
    )
}

// ------------------------------------------------------------ Content colors

/** Host-themed equivalent of [LightContentColors] — used by components that force
 *  a light palette regardless of appearance (input action buttons, full-screen
 *  message). Falls back to the built-in green light palette when no host theme. */
fun hostLightContentColors(): ContentColors {
    val theme = runCatching { FarmerChat.requireGraph().config.theme }.getOrNull()
    return resolveContentColors(theme, dark = false)
}

internal fun resolveContentColors(theme: FarmerChatTheme?, dark: Boolean): ContentColors {
    val base = if (dark) DarkContentColors else LightContentColors
    if (theme == null) return base

    // Neutral surfaces override the matching appearance only (host light values do
    // NOT bleed into dark mode — the SDK's dark palette stays unless a night value
    // is supplied).
    fun surf(light: Int?, night: Int?, fallback: Color): Color =
        (if (dark) night ?: light else light)?.toColor() ?: fallback

    val accent = pick(theme.brandAccent, theme.brandAccentNight, dark)?.toColor()
        ?: base.buttonPrimaryAccent
    val onBrand = pick(theme.onBrand, theme.onBrandNight, dark)?.toColor()
        ?: base.buttonPrimaryForeground
    // Button surface: light uses brandPrimaryDark (Green800), dark uses brandPrimary (Green700).
    val buttonSurface = if (dark) {
        pick(theme.brandPrimary, theme.brandPrimaryNight, dark)?.toColor() ?: base.buttonPrimarySurface
    } else {
        theme.brandPrimaryDark?.toColor() ?: base.buttonPrimarySurface
    }
    val onBg = surf(theme.onBackground, theme.onBackgroundNight, base.foregroundPrimary)

    return base.copy(
        surfacePrimary = surf(theme.background, theme.backgroundNight, base.surfacePrimary),
        surfaceSecondary = surf(theme.cardSurface, theme.cardSurfaceNight, base.surfaceSecondary),
        surfaceActive = accent.copy(alpha = 0.16f),
        surfaceReadingPrimary = surf(theme.readingSurface, theme.readingSurfaceNight, base.surfaceReadingPrimary),
        surfaceReadingSecondary = surf(theme.background, theme.backgroundNight, base.surfaceReadingSecondary),
        surfaceReadingTertiary = surf(theme.readingSurface, theme.readingSurfaceNight, base.surfaceReadingTertiary),
        foregroundPrimary = surf(theme.onSurface, theme.onSurfaceNight, onBg),
        buttonPrimarySurface = buttonSurface,
        buttonPrimaryForeground = onBrand,
        buttonPrimaryAccent = accent,
        borderActive = accent,
    )
}

// -------------------------------------------------------------------- Shapes

/** Resolved corner radii, provided to all shared components (Cards/Buttons/inputs). */
data class FcShapes(
    val card: Dp,
    val button: Dp,
    val input: Dp,
)

val LocalFcShapes = staticCompositionLocalOf {
    FcShapes(card = Radius.XXL, button = Radius.MD, input = Radius.MD)
}

internal fun resolveShapes(theme: FarmerChatTheme?): FcShapes = FcShapes(
    card = theme?.cardCornerRadius?.dp ?: Radius.XXL,
    button = theme?.buttonCornerRadius?.dp ?: Radius.MD,
    input = theme?.inputCornerRadius?.dp ?: Radius.MD,
)

// ---------------------------------------------------------------- Typography

private fun TextUnit.scaled(scale: Float): TextUnit =
    if (isSpecified && scale != 1f) (value * scale).sp else this

private fun TextStyle.scaled(scale: Float, family: FontFamily?): TextStyle = copy(
    fontSize = fontSize.scaled(scale),
    lineHeight = lineHeight.scaled(scale),
    fontFamily = family ?: fontFamily,
)

internal fun resolveTypography(base: Typography, theme: FarmerChatTheme?): Typography {
    val scale = theme?.typeScale ?: 1f
    val family = theme?.fontFamily?.let { FontFamily(Font(it)) }
    if (scale == 1f && family == null) return base
    return base.copy(
        displayLarge = base.displayLarge.scaled(scale, family),
        displayMedium = base.displayMedium.scaled(scale, family),
        displaySmall = base.displaySmall.scaled(scale, family),
        headlineLarge = base.headlineLarge.scaled(scale, family),
        headlineMedium = base.headlineMedium.scaled(scale, family),
        headlineSmall = base.headlineSmall.scaled(scale, family),
        titleLarge = base.titleLarge.scaled(scale, family),
        titleMedium = base.titleMedium.scaled(scale, family),
        titleSmall = base.titleSmall.scaled(scale, family),
        bodyLarge = base.bodyLarge.scaled(scale, family),
        bodyMedium = base.bodyMedium.scaled(scale, family),
        bodySmall = base.bodySmall.scaled(scale, family),
        labelLarge = base.labelLarge.scaled(scale, family),
        labelMedium = base.labelMedium.scaled(scale, family),
        labelSmall = base.labelSmall.scaled(scale, family),
    )
}
