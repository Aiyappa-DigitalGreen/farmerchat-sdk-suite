package org.digitalgreen.farmerchat.sdk.views.internal.theme

import android.content.Context
import android.util.AttributeSet
import android.view.LayoutInflater
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.view.ContextThemeWrapper
import androidx.core.view.LayoutInflaterCompat
import androidx.fragment.app.Fragment
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.views.FarmerChatActivity
import org.digitalgreen.farmerchat.sdk.views.R

/**
 * Theme for the EMBEDDED journey ([org.digitalgreen.farmerchat.sdk.views.FarmerChatFragment]).
 *
 * [FarmerChatActivity] gets `Theme.FarmerChatSdk` from its manifest entry and installs
 * [FcThemeInflaterFactory] on its own LayoutInflater before `super.onCreate`. Embedded, neither
 * happens: the host activity's theme (whatever its `colorPrimary`, `colorSurface`, global
 * `textColor`) would drive every Material default, and AppCompat has already set that inflater's
 * factory, so a second `setFactory2` throws.
 *
 * So embedded fragments inflate through a [ContextThemeWrapper] on `Theme.FarmerChatSdk` — the
 * same theme the activity path runs on — whose inflater is a clone carrying the host-theme recolor
 * factory in front of the host's. Views created by it hold the wrapper as their context, so
 * `LayoutInflater.from(parent.context)` in adapters picks both up too.
 */
internal object FcEmbeddedTheme {

    fun themedInflater(fragment: Fragment, inflater: LayoutInflater): LayoutInflater {
        val activity = fragment.activity as? AppCompatActivity ?: return inflater
        if (activity is FarmerChatActivity) return inflater // themed at the activity already
        if (inflater.context is ThemedContext) return inflater
        val theme = runCatching { FarmerChat.requireGraph().config.theme }.getOrNull()
        val colors = theme?.let { FcViewTheme.resolve(it, FcViewTheme.isNight(activity)) }
        // Same inputs FarmerChatActivity.installHostThemeFactory() uses.
        val languageCode = runCatching {
            FarmerChat.requireGraph().prefs.getString(SdkPreferences.Keys.SELECTED_LANGUAGE_CODE, "en")
        }.getOrNull()?.ifBlank { "en" } ?: "en"
        return ThemedContext(inflater.context, inflater, colors, languageCode, activity).inflater
    }

    private class ThemedContext(
        base: Context,
        source: LayoutInflater,
        colors: FcResolvedColors?,
        languageCode: String,
        activity: AppCompatActivity,
    ) : ContextThemeWrapper(base, R.style.Theme_FarmerChatSdk) {

        // Installed even with no host colours, like the activity path: it also applies the
        // per-script line heights every host needs.
        private val recolor = FcThemeInflaterFactory(colors, { parent, name, context, attrs ->
            activity.delegate.createView(parent, name, context, attrs)
        }, languageCode)

        val inflater: LayoutInflater = source.cloneInContext(this).also {
            // Merged in FRONT of the cloned factories. Fragment containers are left to the
            // FragmentManager's factory behind it (returning null falls through): only it can
            // attach the NavHostFragment an `android:name` FragmentContainerView declares.
            LayoutInflaterCompat.setFactory2(it, object : LayoutInflater.Factory2 {
                override fun onCreateView(parent: View?, name: String, context: Context, attrs: AttributeSet): View? =
                    if (name == "fragment" || name.endsWith("FragmentContainerView")) null
                    else recolor.onCreateView(parent, name, context, attrs)

                override fun onCreateView(name: String, context: Context, attrs: AttributeSet): View? =
                    onCreateView(null, name, context, attrs)
            })
        }

        override fun getSystemService(name: String): Any? =
            if (name == Context.LAYOUT_INFLATER_SERVICE) inflater else super.getSystemService(name)
    }
}
