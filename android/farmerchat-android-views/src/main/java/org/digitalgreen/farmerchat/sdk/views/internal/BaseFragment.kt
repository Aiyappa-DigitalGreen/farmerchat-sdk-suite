package org.digitalgreen.farmerchat.sdk.views.internal

import android.os.Bundle
import android.view.LayoutInflater
import androidx.fragment.app.Fragment
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.FarmerChatGraph
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcEmbeddedTheme

/**
 * Base for all SDK fragments: graph access, LabelManager shorthand and
 * screen view/exit analytics per app parity.
 */
internal abstract class BaseFragment(layoutId: Int) : Fragment(layoutId) {

    protected val graph: FarmerChatGraph get() = FarmerChat.requireGraph()

    /** Analytics screen name; null disables auto view/exit tracking. */
    protected open val analyticsScreenName: String? = null

    /** Embedded in a host activity: inflate through the host-theme recolor (no-op in FarmerChatActivity). */
    override fun onGetLayoutInflater(savedInstanceState: Bundle?): LayoutInflater =
        FcEmbeddedTheme.themedInflater(this, super.onGetLayoutInflater(savedInstanceState))

    protected fun label(key: String, fallback: String): String =
        graph.labelManager.getLabel(key, fallback)

    override fun onStart() {
        super.onStart()
        analyticsScreenName?.let { graph.analytics.trackScreenView(it) }
    }

    override fun onStop() {
        analyticsScreenName?.let { graph.analytics.trackScreenExit(it) }
        super.onStop()
    }

    /** Collect a flow while the view lifecycle is STARTED. */
    protected fun <T> Flow<T>.collectWhenStarted(action: suspend (T) -> Unit) {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                collect { action(it) }
            }
        }
    }
}
