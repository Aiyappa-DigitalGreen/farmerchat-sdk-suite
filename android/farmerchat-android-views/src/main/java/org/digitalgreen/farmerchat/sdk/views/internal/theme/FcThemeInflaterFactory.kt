package org.digitalgreen.farmerchat.sdk.views.internal.theme

import android.content.Context
import android.graphics.drawable.GradientDrawable
import android.util.AttributeSet
import android.view.LayoutInflater
import android.view.View
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
        private val FRAMEWORK_PREFIXES = arrayOf("android.widget.", "android.view.", "android.webkit.")
    }
}
