package org.digitalgreen.farmerchat.sdk.views.internal.util

import android.view.View
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * System-bar / IME insets trimmed to the part that actually OVERLAPS a view.
 *
 * Window insets are measured from the window's edges. [FarmerChatActivity] fills its window, so
 * the two agree; an embedded [org.digitalgreen.farmerchat.sdk.views.FarmerChatFragment] may not.
 * A host that already lays it out below the status bar (e.g. a `fitsSystemWindows`
 * CoordinatorLayout, which pads itself yet still passes the insets on) would otherwise have the
 * SDK pad a second status-bar height into its app bar, and a second nav-bar height under the
 * composer.
 */
internal object FcInsets {

    /** [type]'s ROOT window insets, trimmed to [view]'s on-screen bounds. */
    fun overlapping(view: View, type: Int): Insets {
        val raw = ViewCompat.getRootWindowInsets(view)?.getInsets(type) ?: return Insets.NONE
        return trim(view, raw)
    }

    /** [raw] minus the part of each edge the host's own layout already keeps clear of [view]. */
    fun trim(view: View, raw: Insets): Insets {
        val root = view.rootView
        if (!view.isLaidOut || root.height == 0) return raw
        val loc = IntArray(2)
        view.getLocationInWindow(loc)
        // Laid-out position, not the animated one: the composer slides off-screen (translationY)
        // while an answer loads, and a view past the window edge gave a NEGATIVE gap — which
        // turned a closed keyboard (0) into a phantom ~300px inset and left the bar floating
        // mid-screen once it slid back. A gap can only ever reduce an inset.
        val top = loc[1] - view.translationY.toInt()
        val topGap = top.coerceAtLeast(0)
        val bottomGap = (root.height - (top + view.height)).coerceAtLeast(0)
        return Insets.of(
            raw.left,
            (raw.top - topGap).coerceAtLeast(0),
            raw.right,
            (raw.bottom - bottomGap).coerceAtLeast(0)
        )
    }

    /**
     * Make [root] hand its descendants insets trimmed to its own bounds, and re-dispatch when it
     * moves (the first pass runs before layout, when the position is still unknown).
     */
    fun trimForDescendants(root: View) {
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val builder = WindowInsetsCompat.Builder(insets)
            TYPES.forEach { type -> builder.setInsets(type, trim(v, insets.getInsets(type))) }
            builder.build()
        }
        var lastTop = Int.MIN_VALUE
        var lastBottom = Int.MIN_VALUE
        root.addOnLayoutChangeListener { v, _, _, _, _, _, _, _, _ ->
            val loc = IntArray(2)
            v.getLocationInWindow(loc)
            val bottom = loc[1] + v.height
            if (loc[1] != lastTop || bottom != lastBottom) {
                lastTop = loc[1]
                lastBottom = bottom
                v.post { ViewCompat.requestApplyInsets(v) }
            }
        }
    }

    private val TYPES = listOf(
        WindowInsetsCompat.Type.statusBars(),
        WindowInsetsCompat.Type.navigationBars(),
        WindowInsetsCompat.Type.captionBar(),
        WindowInsetsCompat.Type.displayCutout(),
        WindowInsetsCompat.Type.ime(),
        WindowInsetsCompat.Type.tappableElement(),
    )
}
