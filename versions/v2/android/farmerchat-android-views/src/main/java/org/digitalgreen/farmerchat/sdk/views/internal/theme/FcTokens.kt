package org.digitalgreen.farmerchat.sdk.views.internal.theme

import android.content.Context
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

    @ColorInt
    fun color(context: Context, @ColorRes res: Int): Int = ContextCompat.getColor(context, res)

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
