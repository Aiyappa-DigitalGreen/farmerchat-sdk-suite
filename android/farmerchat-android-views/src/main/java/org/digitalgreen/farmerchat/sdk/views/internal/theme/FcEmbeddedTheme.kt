package org.digitalgreen.farmerchat.sdk.views.internal.theme

import android.content.Context
import android.content.ContextWrapper
import android.util.AttributeSet
import android.view.LayoutInflater
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.LayoutInflaterCompat
import androidx.fragment.app.Fragment
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.views.FarmerChatActivity

/**
 * Host-theme recolor for the EMBEDDED journey ([org.digitalgreen.farmerchat.sdk.views.FarmerChatFragment]).
 *
 * [FarmerChatActivity] installs [FcThemeInflaterFactory] on its own LayoutInflater before
 * `super.onCreate`. An embedding host's activity cannot take that route: AppCompat has already
 * set its factory, and a second `setFactory2` on the same inflater throws. So embedded fragments
 * inflate through a [ContextWrapper] instead, whose inflater is a clone carrying the recolor
 * factory in front of the host's. Views created by it hold the wrapper as their context, so
 * `LayoutInflater.from(parent.context)` in adapters picks the themed inflater up too.
 */
internal object FcEmbeddedTheme {

    fun themedInflater(fragment: Fragment, inflater: LayoutInflater): LayoutInflater {
        val activity = fragment.activity as? AppCompatActivity ?: return inflater
        if (activity is FarmerChatActivity) return inflater // already themed at the activity
        if (inflater.context is ThemedContext) return inflater
        val theme = runCatching { FarmerChat.requireGraph().config.theme }.getOrNull() ?: return inflater
        val colors = FcViewTheme.resolve(theme, FcViewTheme.isNight(activity)) ?: return inflater
        return ThemedContext(inflater.context, inflater, colors, activity).inflater
    }

    private class ThemedContext(
        base: Context,
        source: LayoutInflater,
        colors: FcResolvedColors,
        activity: AppCompatActivity,
    ) : ContextWrapper(base) {

        private val recolor = FcThemeInflaterFactory(colors) { parent, name, context, attrs ->
            activity.delegate.createView(parent, name, context, attrs)
        }

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
