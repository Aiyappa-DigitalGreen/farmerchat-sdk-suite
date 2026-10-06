package org.digitalgreen.farmerchat.sdk.compose.util

import android.view.View
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.statusBars
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInWindow
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

/**
 * System-bar / IME insets trimmed to the part that actually OVERLAPS the SDK root.
 *
 * Compose counterpart of the views flavour's `internal/util/FcInsets.kt`. Window insets are
 * measured from the window's edges. [org.digitalgreen.farmerchat.sdk.compose.FarmerChatActivity]
 * fills its window, so the two agree and every gap below measures 0 (a no-op). An embedded
 * `FarmerChatInline` / `FarmerChatRoot` may not: a host that already lays it out below the status
 * bar (e.g. an edge-to-edge activity whose root is a `fitsSystemWindows` CoordinatorLayout, which
 * pads itself yet still passes the insets on) would otherwise have the SDK pad a second status-bar
 * height into its app bar and a second nav-bar height under the composer.
 *
 * Two mechanisms, because Compose has two kinds of inset read:
 *  - modifier reads (`windowInsetsPadding`, `navigationBarsPadding`, `imePadding`, …) honour
 *    consumption, so [FcInsetTrim] `consumeWindowInsets` the gap once at the root;
 *  - raw reads (`WindowInsets.X.asPaddingValues()`, `.getBottom(density)`) IGNORE consumption,
 *    so they go through [fcStatusBarsTop] / [fcNavigationBarsBottom] / [fcImeBottomPx], which
 *    subtract the same gap. Never combine the two at one site — that trims twice.
 *
 * Keyboard-VISIBLE checks must keep reading the raw IME inset: a trimmed IME inset can be 0 while
 * the keyboard is up (host content below the SDK taller than the keyboard).
 */
internal data class FcInsetGap(
    /** The view the gap was measured in. Dialogs / bottom sheets get their own window + view. */
    val view: View?,
    val top: Dp,
    val bottom: Dp
)

internal val LocalFcInsetGap = compositionLocalOf { FcInsetGap(null, 0.dp, 0.dp) }

/**
 * The gap for the CURRENT window. A CompositionLocal leaks into dialog / bottom-sheet content
 * (which lives in its own full-window, edge-to-edge window), while consumption does not — so the
 * gap only applies when the reading composable is in the same view it was measured in.
 */
@Composable
private fun currentGap(): FcInsetGap {
    val gap = LocalFcInsetGap.current
    return if (gap.view != null && gap.view === LocalView.current) gap
    else FcInsetGap(null, 0.dp, 0.dp)
}

/** Status-bar top inset minus what the host already keeps clear of the SDK root. */
@Composable
internal fun fcStatusBarsTop(): Dp {
    val raw = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()
    return (raw - currentGap().top).coerceAtLeast(0.dp)
}

/** Nav-bar bottom inset minus what the host already keeps clear of the SDK root. */
@Composable
internal fun fcNavigationBarsBottom(): Dp {
    val raw = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    return (raw - currentGap().bottom).coerceAtLeast(0.dp)
}

/** IME bottom inset in px, minus the host's bottom gap. For PADDING only — not visibility. */
@Composable
internal fun fcImeBottomPx(): Int {
    val density = LocalDensity.current
    val raw = WindowInsets.ime.getBottom(density)
    val gapPx = with(density) { currentGap().bottom.roundToPx() }
    return (raw - gapPx).coerceAtLeast(0)
}

/**
 * Measures where the SDK root sits in its window and hands [content] insets trimmed to it:
 * `consumeWindowInsets` for modifier-based paddings, [LocalFcInsetGap] for raw reads.
 * Full-window (FarmerChatActivity) the gap is 0 and this changes nothing.
 */
@Composable
internal fun FcInsetTrim(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val view = LocalView.current
    val density = LocalDensity.current
    var gapTopPx by remember { mutableStateOf(0) }
    var gapBottomPx by remember { mutableStateOf(0) }
    val gapTop = with(density) { gapTopPx.toDp() }
    val gapBottom = with(density) { gapBottomPx.toDp() }

    Box(
        modifier = modifier
            .onGloballyPositioned { coords ->
                val windowHeight = view.rootView.height
                if (windowHeight <= 0) return@onGloballyPositioned
                val top = coords.positionInWindow().y.roundToInt()
                val bottom = windowHeight - (top + coords.size.height)
                val newTop = top.coerceAtLeast(0)
                val newBottom = bottom.coerceAtLeast(0)
                if (newTop != gapTopPx) gapTopPx = newTop
                if (newBottom != gapBottomPx) gapBottomPx = newBottom
            }
            .consumeWindowInsets(PaddingValues(top = gapTop, bottom = gapBottom))
    ) {
        CompositionLocalProvider(
            LocalFcInsetGap provides FcInsetGap(view, gapTop, gapBottom)
        ) {
            content()
        }
    }
}
