package org.digitalgreen.farmerchat.sdk.views.internal.theme

import android.content.Context
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.AttributeSet
import android.view.LayoutInflater
import android.view.View
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.res.ResourcesCompat
import org.digitalgreen.farmerchat.sdk.views.R

/**
 * A [LayoutInflater.Factory2] that recolors every inflated view to a host
 * [FcResolvedColors] palette. Creation is delegated to [createView] (the AppCompat
 * delegate); layouts and custom views the delegate does not handle are created via
 * reflection so they can be themed too. Each view is then post-processed by
 * [FcRecolor]: brand-colored backgrounds/tints/text/icons are remapped by matching
 * their default token value, and the few stroked brand drawables are re-stroked
 * with the host accent.
 *
 * Installed once on the activity's LayoutInflater, so it also covers fragment views
 * (cloned inflaters inherit the factory) and RecyclerView item views
 * (`LayoutInflater.from(activityContext)`).
 */
internal class FcThemeInflaterFactory(
    private val colors: FcResolvedColors,
    private val createView: (parent: View?, name: String, context: Context, attrs: AttributeSet) -> View?,
) : LayoutInflater.Factory2 {

    override fun onCreateView(
        parent: View?,
        name: String,
        context: Context,
        attrs: AttributeSet,
    ): View? {
        val view = createView(parent, name, context, attrs) ?: fallbackCreate(name, context, attrs)
        if (view != null) runCatching { applyTheme(view, attrs) }
        return view
    }

    override fun onCreateView(name: String, context: Context, attrs: AttributeSet): View? =
        onCreateView(null, name, context, attrs)

    private fun applyTheme(view: View, attrs: AttributeSet) {
        FcRecolor.applyView(view, colors)
        // Stroked brand drawables identified by their background resource id.
        val bgRes = attrs.getAttributeResourceValue(ANDROID_NS, "background", 0)
        if (bgRes != 0) applyStroke(view, bgRes)
        applyHostFont(view)
        applyHostLogo(view, attrs)
        applyNeutrals(view, attrs, bgRes)
    }

    /** Host background / surfaces / text colour, by the colour resource the layout names. */
    private fun applyNeutrals(view: View, attrs: AttributeSet, bgRes: Int) {
        when (bgRes) {
            R.color.fc_surface_primary -> colors.background
            R.color.fc_surface_secondary -> colors.cardSurface
            R.color.fc_surface_reading -> colors.readingSurface
            else -> null
        }?.let { view.setBackgroundColor(it) }
        if (view is TextView &&
            attrs.getAttributeResourceValue(ANDROID_NS, "textColor", 0) == R.color.fc_foreground_primary
        ) {
            colors.onBackground?.let { view.setTextColor(it) }
        }
    }

    /** Host [FarmerChatTheme.fontFamily] on every TextView, keeping its bold/italic style. */
    private fun applyHostFont(view: View) {
        if (view !is TextView) return
        val font = hostFont(view.context) ?: return
        view.typeface = Typeface.create(font, view.typeface?.style ?: Typeface.NORMAL)
    }

    /**
     * Host [FarmerChatTheme.logo] in place of the built-in mark. The layout's tint is kept: the
     * logo is treated as a mark, exactly like the one it replaces, so it follows the palette.
     */
    private fun applyHostLogo(view: View, attrs: AttributeSet) {
        if (view !is ImageView) return
        val logo = FcViewTheme.hostTheme()?.logo ?: return
        val src = attrs.getAttributeResourceValue(ANDROID_NS, "src", 0)
            .takeIf { it != 0 } ?: attrs.getAttributeResourceValue(APP_NS, "srcCompat", 0)
        if (src == R.drawable.fc_logo_mark) view.setImageResource(logo)
    }

    private var fontLoaded = false
    private var font: Typeface? = null

    private fun hostFont(context: Context): Typeface? {
        if (!fontLoaded) {
            fontLoaded = true
            font = FcViewTheme.hostTheme()?.fontFamily?.let { res ->
                runCatching { ResourcesCompat.getFont(context, res) }.getOrNull()
            }
        }
        return font
    }

    private fun applyStroke(view: View, bgRes: Int) {
        val strokePx = when (bgRes) {
            R.drawable.fc_bg_selected_option,
            R.drawable.fc_bg_otp_box_active,
            R.drawable.fc_bg_checkbox_selected -> dp(view.context, 2)
            else -> return
        }
        (view.background as? GradientDrawable)?.let { gd ->
            gd.mutate()
            gd.setStroke(strokePx, colors.accent)
        }
    }

    /** Instantiate a view the AppCompat delegate did not create (layouts, custom views). */
    private fun fallbackCreate(name: String, context: Context, attrs: AttributeSet): View? {
        val inflater = LayoutInflater.from(context)
        return try {
            if (name.indexOf('.') >= 0) {
                inflater.createView(name, null, attrs)
            } else {
                var v: View? = null
                for (prefix in FRAMEWORK_PREFIXES) {
                    v = try {
                        inflater.createView(name, prefix, attrs)
                    } catch (_: ClassNotFoundException) {
                        null
                    }
                    if (v != null) break
                }
                v
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun dp(context: Context, value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()

    companion object {
        private const val ANDROID_NS = "http://schemas.android.com/apk/res/android"
        private const val APP_NS = "http://schemas.android.com/apk/res-auto"
        private val FRAMEWORK_PREFIXES = arrayOf("android.widget.", "android.view.", "android.webkit.")
    }
}
