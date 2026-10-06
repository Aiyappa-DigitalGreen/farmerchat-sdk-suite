package org.digitalgreen.farmerchat.sdk.views.internal.theme

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import androidx.annotation.ColorInt
import androidx.annotation.ColorRes
import androidx.core.content.ContextCompat
import org.digitalgreen.farmerchat.sdk.views.R

/**
 * Runtime color/shape token resolution for widgets that are built in code rather than inflated
 * from XML.
 *
 * [FcThemeInflaterFactory] only sees INFLATED views, so a programmatic widget (see
 * `internal/widgets/`) has to resolve the host palette itself. These helpers return the host
 * override when a [org.digitalgreen.farmerchat.sdk.FarmerChatTheme] is configured and the built-in
 * FarmerChat token otherwise — so an agentic surface is themed exactly like the rest of the SDK
 * with no new theme tokens.
 */
internal object FcTokens {

    /**
     * The THEMED value of an SDK colour token — the one gateway for colours resolved in code.
     *
     * A host that overrides the `fc_*` resource itself gets its value straight from
     * [ContextCompat.getColor]; a host [org.digitalgreen.farmerchat.sdk.FarmerChatTheme] then
     * maps the neutral tokens by resource id and the brand tokens by value, exactly as the
     * inflation factory does for XML.
     */
    @ColorInt
    fun color(context: Context, @ColorRes res: Int): Int {
        val raw = ContextCompat.getColor(context, res)
        val colors = FcRecolor.active(context) ?: return raw
        return when (res) {
            R.color.fc_surface_primary -> colors.background
            R.color.fc_surface_secondary, R.color.fc_input_background -> colors.cardSurface
            R.color.fc_surface_reading -> colors.readingSurface
            R.color.fc_foreground_primary -> colors.onBackground
            R.color.fc_on_brand, R.color.fc_button_primary_foreground,
            R.color.fc_brand_foreground_primary -> colors.onBrand
            // Left at its default (the accent): keep the accent unless it would vanish on the
            // dark brand circle it sits on, e.g. a host whose accent IS its brand colour.
            R.color.fc_brand_icon -> if (raw == FcResolvedColors.DEF_GREEN500) {
                colors.accent.takeIf { contrast(it, colors.brandPrimaryDark) >= MIN_ICON_CONTRAST }
                    ?: colors.onBrand
            } else raw
            else -> null
        } ?: colors.remapColor(raw)
    }

    /** WCAG contrast ratio of two opaque colours (1 … 21). */
    private fun contrast(@ColorInt a: Int, @ColorInt b: Int): Double {
        fun lum(c: Int): Double {
            fun ch(v: Int) = (v / 255.0).let { if (it <= 0.03928) it / 12.92 else Math.pow((it + 0.055) / 1.055, 2.4) }
            return 0.2126 * ch(Color.red(c)) + 0.7152 * ch(Color.green(c)) + 0.0722 * ch(Color.blue(c))
        }
        val (hi, lo) = lum(a).let { la -> lum(b).let { lb -> if (la > lb) la to lb else lb to la } }
        return (hi + 0.05) / (lo + 0.05)
    }

    /** WCAG's floor for graphical objects. */
    private const val MIN_ICON_CONTRAST = 3.0

    /** [color] as a single-colour state list (for `*TintList` setters). */
    fun colorStateList(context: Context, @ColorRes res: Int): ColorStateList =
        ColorStateList.valueOf(color(context, res))

    /** Brand accent (Compose `buttonPrimaryAccent`, default Green500). */
    @ColorInt
    fun accent(context: Context): Int =
        FcRecolor.active()?.accent ?: color(context, R.color.fc_green500)

    /** Foreground on a brand fill (Compose `buttonPrimaryForeground`, default White). */
    @ColorInt
    fun onBrand(context: Context): Int =
        FcRecolor.active()?.onBrand ?: color(context, R.color.fc_white)

    /**
     * The feedback/fail color (Compose `feedbackFail`, default Red500). Every urgent agentic
     * treatment — the escalate card and the stream-error card — is derived from this rather than
     * from a dedicated token, so a host that themes `error` gets a coherent result.
     */
    @ColorInt
    fun fail(context: Context): Int =
        FcRecolor.active()?.error ?: color(context, R.color.fc_error)

    /** Selected/active surface tint (Compose `surfaceActive`, default accent @ 16%). */
    @ColorInt
    fun surfaceActive(context: Context): Int =
        FcRecolor.active()?.surfaceActive ?: color(context, R.color.fc_surface_active)

    /** [color] with its alpha replaced by [fraction] of full opacity. */
    @ColorInt
    fun withAlpha(@ColorInt color: Int, fraction: Float): Int = Color.argb(
        (fraction.coerceIn(0f, 1f) * 255f).toInt(),
        Color.red(color),
        Color.green(color),
        Color.blue(color)
    )

    /** A rounded rectangle background, optionally stroked. Radii are in dp. */
    fun roundedRect(
        context: Context,
        radiusDp: Float,
        @ColorInt fill: Int,
        strokeDp: Float = 0f,
        @ColorInt strokeColor: Int = Color.TRANSPARENT
    ): GradientDrawable {
        val density = context.resources.displayMetrics.density
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = radiusDp * density
            setColor(fill)
            if (strokeDp > 0f) {
                setStroke((strokeDp * density).toInt().coerceAtLeast(1), strokeColor)
            }
        }
    }
}
