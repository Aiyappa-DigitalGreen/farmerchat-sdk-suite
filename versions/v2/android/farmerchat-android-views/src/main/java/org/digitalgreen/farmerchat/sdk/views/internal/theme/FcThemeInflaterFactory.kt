package org.digitalgreen.farmerchat.sdk.views.internal.theme

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.AttributeSet
import android.view.LayoutInflater
import android.view.View
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.res.ResourcesCompat
import androidx.core.widget.TextViewCompat
import org.digitalgreen.farmerchat.sdk.views.R
import kotlin.math.roundToInt

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
    /**
     * Host palette, or null when the host configured no theme. Null means "recolor nothing" —
     * the factory is still installed in that case because it also applies per-script line
     * heights, which every host needs regardless of theming.
     */
    private val colors: FcResolvedColors?,
    private val createView: (parent: View?, name: String, context: Context, attrs: AttributeSet) -> View?,
    /**
     * Selected language code, used to give every inflated `TextView` the per-script line height
     * the app uses (see [FcTypography]). Empty falls back to Roman.
     */
    private val languageCode: String = "en",
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
        if (colors != null) {
            FcRecolor.applyView(view, colors)
            // Stroked brand drawables identified by their background resource id.
            val bgRes = attrs.getAttributeResourceValue(ANDROID_NS, "background", 0)
            if (bgRes != 0) applyStroke(view, bgRes)
            applyNeutrals(view, attrs, bgRes, colors)
            applyAccentIconTint(view, attrs, colors)
        }
        applyLineHeight(view)
        applyHostFont(view)
        applyHostLogo(view, attrs)
    }

    /**
     * Single-colour icons whose brand green is baked into the vector (`fillColor="#00C950"`), so
     * no tint remap can reach them. When the layout leaves one untinted, tint it with the host
     * accent — exactly what the baked green stood for. Layout-tinted uses keep their tint.
     */
    private fun applyAccentIconTint(view: View, attrs: AttributeSet, colors: FcResolvedColors) {
        if (view !is ImageView) return
        // An icon ON the brand surface: resolved by role, not value (see FcTokens.color).
        if (attrs.getAttributeResourceValue(APP_NS, "tint", 0) == R.color.fc_brand_icon) {
            view.imageTintList = ColorStateList.valueOf(FcTokens.color(view.context, R.color.fc_brand_icon))
            return
        }
        if (view.imageTintList != null) return
        val src = attrs.getAttributeResourceValue(ANDROID_NS, "src", 0)
            .takeIf { it != 0 } ?: attrs.getAttributeResourceValue(APP_NS, "srcCompat", 0)
        if (src in BRAND_ACCENT_ICONS || src in BRAND_GLOWS) {
            view.imageTintList = ColorStateList.valueOf(colors.accent)
        }
    }

    /** Host background / surfaces / text colour, by the colour resource the layout names. */
    private fun applyNeutrals(view: View, attrs: AttributeSet, bgRes: Int, colors: FcResolvedColors) {
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

    /** Host [org.digitalgreen.farmerchat.sdk.FarmerChatTheme.fontFamily] on every TextView, keeping bold/italic. */
    private fun applyHostFont(view: View) {
        if (view !is TextView) return
        val font = hostFont(view.context) ?: return
        view.typeface = Typeface.create(font, view.typeface?.style ?: Typeface.NORMAL)
    }

    /**
     * Host [org.digitalgreen.farmerchat.sdk.FarmerChatTheme.logo] in place of the built-in mark. The layout's
     * tint is kept: the logo is treated as a mark, like the one it replaces.
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


    /**
     * Give the view the app's line height for its own text size and the current script.
     *
     * Central on purpose: the views layouts set `textSize` in ~110 places and line spacing in
     * none, so Indic scripts rendered cramped everywhere. Doing it here covers fragment layouts
     * and RecyclerView item views (both inflate through this factory) with no per-layout edits.
     */
    private fun applyLineHeight(view: View) {
        val tv = view as? TextView ?: return
        val density = view.resources.displayMetrics.scaledDensity
        if (density <= 0f) return
        val sizeSp = (tv.textSize / density).roundToInt()
        val lineSp = FcTypography.lineHeightSp(sizeSp, languageCode) ?: return
        TextViewCompat.setLineHeight(tv, (lineSp * density).roundToInt())
    }

    private fun applyStroke(view: View, bgRes: Int) {
        val accent = colors?.accent ?: return
        val strokePx = when (bgRes) {
            R.drawable.fc_bg_selected_option,
            R.drawable.fc_bg_otp_box_active,
            R.drawable.fc_bg_checkbox_selected -> dp(view.context, 2)
            else -> return
        }
        (view.background as? GradientDrawable)?.let { gd ->
            gd.mutate()
            gd.setStroke(strokePx, accent)
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
        /** Drawables whose only colour is a baked-in brand green (see [applyAccentIconTint]). */
        private val BRAND_ACCENT_ICONS = setOf(
            R.drawable.fc_icon_camera,
            R.drawable.fc_icon_card,
            R.drawable.fc_icon_help,
            R.drawable.fc_icon_home,
            R.drawable.fc_icon_keyboard,
            R.drawable.fc_icon_language,
            R.drawable.fc_icon_mic,
            R.drawable.fc_icon_personalization,
            R.drawable.fc_icon_save,
            R.drawable.fc_icon_send,
            R.drawable.fc_icon_settings,
            R.drawable.fc_icon_sms,
            R.drawable.fc_icon_timer,
            R.drawable.fc_icon_whatsapp,
        )
        /**
         * Glow bitmaps (yellow sun / green halo). A PNG can't be value-remapped, so under a host
         * theme it is tinted with the host accent: the tint keeps the bitmap's alpha falloff.
         */
        private val BRAND_GLOWS = setOf(R.drawable.fc_glow_yellow, R.drawable.fc_glow_green)
        private val FRAMEWORK_PREFIXES = arrayOf("android.widget.", "android.view.", "android.webkit.")
    }
}
