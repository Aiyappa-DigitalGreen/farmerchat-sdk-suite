package org.digitalgreen.farmerchat.sdk.views.internal.theme

import android.content.Context
import android.content.res.Configuration
import androidx.annotation.ColorInt
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.FarmerChatTheme

/**
 * Views-side equivalent of the Compose `HostTheme` resolver: overlays an optional
 * host [FarmerChatTheme] onto the built-in FarmerChat green tokens (res/values
 * colors.xml). Produces a value-keyed remap (`default brand color int → themed
 * color int`) so the [FcThemeInflaterFactory] can recolor every inflated view —
 * including RecyclerView item views — with ZERO per-screen edits.
 *
 * Brand colors apply to both light and dark appearances; a `*Night` override wins
 * in dark mode. Neutral surfaces keep the SDK palette unless overridden.
 */
internal class FcResolvedColors(
    @ColorInt val brandPrimary: Int,
    @ColorInt val brandPrimaryDark: Int,
    @ColorInt val brandDeep: Int,
    @ColorInt val accent: Int,
    @ColorInt val onBrand: Int,
    @ColorInt val error: Int,
    @ColorInt val surfaceActive: Int,
    // Neutral host overrides — null keeps the SDK token. Matched by the layout's colour
    // RESOURCE id (not value): #FFFFFF is both a surface and the text on brand buttons.
    @ColorInt val background: Int? = null,
    @ColorInt val cardSurface: Int? = null,
    @ColorInt val readingSurface: Int? = null,
    @ColorInt val onBackground: Int? = null,
) {
    /** default-brand-color-int → themed-color-int (opaque colors). */
    val remap: Map<Int, Int> = buildMap {
        put(DEF_GREEN700, brandPrimary)
        put(DEF_GREEN800, brandPrimaryDark)
        put(DEF_BUTTON_PRIMARY_SURFACE, brandPrimaryDark) // == green800 value, listed for clarity
        put(DEF_GREEN950, brandDeep)
        put(DEF_GREEN500, accent)
        put(DEF_RED500, error)
        put(DEF_SURFACE_ACTIVE, surfaceActive)
        // Translucent brand variants (glows, dividers, selected rows): an exact-int match on the
        // opaque token can't reach them, so each keeps its alpha over the host colour.
        put(DEF_ACCENT_28, withAlpha(accent, 0x47))
        put(DEF_ACCENT_0, withAlpha(accent, 0x00))
        put(DEF_BRAND_DIVIDER, withAlpha(brandPrimary, 0x33))
        put(DEF_SURFACE_ACTIVE_DOUBLE, blendOverWhite(accent, 1f - (1f - 0x29 / 255f).let { it * it }))
        // FarmerChat's own accent stops (share-card sweep border, agentic aura): under a host
        // theme they become tints of the host accent / primary instead of cyan and yellow.
        put(DEF_CYAN400, blendOverWhite(accent, 0.55f))
        put(DEF_YELLOW300, blendOverWhite(brandPrimary, 0.35f))
    }

    /** Remap [color] if it matches a known default brand color; else return it unchanged. */
    @ColorInt
    fun remapColor(@ColorInt color: Int): Int = remap[color] ?: color

    fun isBrand(@ColorInt color: Int): Boolean = remap.containsKey(color)

    companion object {
        // Default token values, must match res/values/colors.xml.
        const val DEF_GREEN500 = 0xFF00C950.toInt()
        const val DEF_GREEN700 = 0xFF008236.toInt()
        const val DEF_GREEN800 = 0xFF08361B.toInt()
        const val DEF_GREEN950 = 0xFF032E15.toInt()
        const val DEF_RED500 = 0xFFE5533D.toInt()
        const val DEF_SURFACE_ACTIVE = 0x2900C950
        const val DEF_BUTTON_PRIMARY_SURFACE = DEF_GREEN800
        const val DEF_ACCENT_28 = 0x4700C950
        const val DEF_ACCENT_0 = 0x0000C950
        const val DEF_BRAND_DIVIDER = 0x33008236
        const val DEF_SURFACE_ACTIVE_DOUBLE = 0xFFA6E1C0.toInt()
        const val DEF_CYAN400 = 0xFF22D3EE.toInt()
        const val DEF_YELLOW300 = 0xFFFFF947.toInt()

        @ColorInt
        private fun withAlpha(@ColorInt c: Int, alpha: Int): Int = (alpha shl 24) or (c and 0x00FFFFFF)

        /** [c] at [fraction] opacity composited over white, as an opaque colour. */
        @ColorInt
        private fun blendOverWhite(@ColorInt c: Int, fraction: Float): Int {
            fun ch(shift: Int) = (255 + (((c shr shift) and 0xFF) - 255) * fraction).toInt().coerceIn(0, 255)
            return (0xFF shl 24) or (ch(16) shl 16) or (ch(8) shl 8) or ch(0)
        }
    }
}

internal object FcViewTheme {

    /** The host theme, if any, from the initialized graph. */
    fun hostTheme(): FarmerChatTheme? =
        runCatching { FarmerChat.requireGraph().config.theme }.getOrNull()

    fun isNight(context: Context): Boolean =
        (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES

    /** Resolve the host palette for the given appearance; null theme ⇒ null (no recolor). */
    fun resolve(theme: FarmerChatTheme?, dark: Boolean): FcResolvedColors? {
        theme ?: return null

        val primary = pick(theme.brandPrimary, theme.brandPrimaryNight, dark)
            ?: FcResolvedColors.DEF_GREEN700
        val primaryDark = pick(theme.brandPrimaryDark, theme.brandPrimaryDarkNight, dark)
            ?: FcResolvedColors.DEF_GREEN800
        val accent = pick(theme.brandAccent, theme.brandAccentNight, dark)
            ?: FcResolvedColors.DEF_GREEN500
        val onBrand = pick(theme.onBrand, theme.onBrandNight, dark)
            ?: if (theme.brandPrimary != null || theme.brandPrimaryNight != null) contrastOn(primary)
            else 0xFFFFFFFF.toInt()
        val error = pick(theme.error, theme.errorNight, dark)
            ?: FcResolvedColors.DEF_RED500
        val deep = if (theme.brandPrimaryDark != null || theme.brandPrimaryDarkNight != null) {
            darken(primaryDark, 0.6f)
        } else {
            FcResolvedColors.DEF_GREEN950
        }
        val surfaceActive = withAlpha(accent, 0x29)

        // Neutrals: a light value only overrides the light token (dark keeps the SDK's dark
        // surfaces unless a *Night value is given) — the FarmerChatTheme contract.
        fun neutral(@ColorInt light: Int?, @ColorInt night: Int?): Int? = if (dark) night else light
        val background = neutral(theme.background, theme.backgroundNight)
        val cardSurface = neutral(theme.cardSurface, theme.cardSurfaceNight)
        val readingSurface = neutral(theme.readingSurface, theme.readingSurfaceNight)
        val onBackground = neutral(theme.onBackground, theme.onBackgroundNight)

        // If nothing was actually supplied, treat as no-op.
        if (primary == FcResolvedColors.DEF_GREEN700 &&
            primaryDark == FcResolvedColors.DEF_GREEN800 &&
            accent == FcResolvedColors.DEF_GREEN500 &&
            error == FcResolvedColors.DEF_RED500 &&
            listOf(background, cardSurface, readingSurface, onBackground).all { it == null }
        ) return null

        return FcResolvedColors(
            brandPrimary = primary,
            brandPrimaryDark = primaryDark,
            brandDeep = deep,
            accent = accent,
            onBrand = onBrand,
            error = error,
            surfaceActive = surfaceActive,
            background = background,
            cardSurface = cardSurface,
            readingSurface = readingSurface,
            onBackground = onBackground,
        )
    }

    private fun pick(@ColorInt light: Int?, @ColorInt night: Int?, dark: Boolean): Int? =
        if (dark) (night ?: light) else light

    @ColorInt
    private fun contrastOn(@ColorInt bg: Int): Int {
        val r = ((bg shr 16) and 0xFF) / 255.0
        val g = ((bg shr 8) and 0xFF) / 255.0
        val b = (bg and 0xFF) / 255.0
        val lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
        return if (lum < 0.5) 0xFFFFFFFF.toInt() else 0xFF000000.toInt()
    }

    @ColorInt
    private fun darken(@ColorInt c: Int, factor: Float): Int {
        val a = (c shr 24) and 0xFF
        val r = (((c shr 16) and 0xFF) * factor).toInt().coerceIn(0, 255)
        val g = (((c shr 8) and 0xFF) * factor).toInt().coerceIn(0, 255)
        val b = ((c and 0xFF) * factor).toInt().coerceIn(0, 255)
        return (a shl 24) or (r shl 16) or (g shl 8) or b
    }

    @ColorInt
    private fun withAlpha(@ColorInt c: Int, alpha: Int): Int =
        (alpha shl 24) or (c and 0x00FFFFFF)
}
