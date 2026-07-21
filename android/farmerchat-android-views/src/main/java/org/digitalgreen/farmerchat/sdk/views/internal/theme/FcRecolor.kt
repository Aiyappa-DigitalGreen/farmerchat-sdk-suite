package org.digitalgreen.farmerchat.sdk.views.internal.theme

import android.content.res.ColorStateList
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.graphics.drawable.RippleDrawable
import android.view.View
import android.widget.ImageView
import android.widget.TextView

/**
 * Shared brand-color remapping used by both the inflation [FcThemeInflaterFactory]
 * and the few adapters that swap brand drawables at RUNTIME (e.g. selection state),
 * which the inflation factory cannot see. Matches a drawable/tint/text color against
 * the default FarmerChat token values and replaces it with the host palette.
 */
internal object FcRecolor {

    /** Resolve the active host palette from the initialized graph, or null (no theme). */
    fun active(): FcResolvedColors? {
        val theme = FcViewTheme.hostTheme() ?: return null
        // Appearance is applied per-activity; resolve for light and let night derive.
        return FcViewTheme.resolve(theme, dark = false)
    }

    /** Recolor a single view's background / tints / text colors if a host theme is active. */
    fun maybeRecolor(view: View) {
        val colors = active() ?: return
        applyView(view, colors)
    }

    fun applyView(view: View, colors: FcResolvedColors) {
        view.background?.let { view.background = recolorDrawable(it, colors) }
        view.backgroundTintList = remapTintList(view.backgroundTintList, colors)
        when (view) {
            is ImageView -> {
                view.imageTintList = remapTintList(view.imageTintList, colors)
                view.drawable?.let { d ->
                    val recolored = recolorDrawable(d, colors)
                    if (recolored !== d) view.setImageDrawable(recolored)
                }
            }
            is TextView -> {
                remapTintList(view.textColors, colors)?.let { view.setTextColor(it) }
                view.compoundDrawableTintList = remapTintList(view.compoundDrawableTintList, colors)
            }
        }
    }

    fun recolorDrawable(input: Drawable, colors: FcResolvedColors): Drawable {
        when (val d = input) {
            is ColorDrawable -> {
                if (colors.isBrand(d.color)) {
                    val out = d.mutate() as ColorDrawable
                    out.color = colors.remapColor(d.color)
                    return out
                }
            }
            is GradientDrawable -> {
                val current = d.color?.defaultColor ?: return d
                if (colors.isBrand(current)) {
                    val out = d.mutate() as GradientDrawable
                    out.setColor(colors.remapColor(current))
                    return out
                }
            }
            is LayerDrawable -> {
                for (i in 0 until d.numberOfLayers) {
                    val layer = d.getDrawable(i)
                    val recolored = recolorDrawable(layer, colors)
                    if (recolored !== layer) d.setDrawableByLayerId(d.getId(i), recolored)
                }
            }
            is RippleDrawable -> {
                for (i in 0 until d.numberOfLayers) recolorDrawable(d.getDrawable(i), colors)
            }
        }
        return input
    }

    fun remapTintList(list: ColorStateList?, colors: FcResolvedColors): ColorStateList? {
        list ?: return null
        val def = list.defaultColor
        if (!colors.isBrand(def)) return list
        return ColorStateList.valueOf(colors.remapColor(def))
    }
}
