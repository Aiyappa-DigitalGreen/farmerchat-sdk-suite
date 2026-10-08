package org.digitalgreen.farmerchat.sdk.compose.components

import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.clickable
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import kotlinx.coroutines.delay
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import kotlin.math.ceil

// ---------------------------------------------------------------------------
// AiAnswerBlock — client-side "typewriter" reveal for AI answers.
//
// IMPORTANT (honesty note): the FarmerChat backend returns the whole answer in a
// single synchronous JSON response (docs/02 — chat replies are NOT streamed; no
// SSE/WebSocket). This reveal is a purely cosmetic Compose-layer animation that
// re-renders a growing prefix of the already-received markdown. It never touches
// the ViewModel, network, or ChatState. History and pre-generated answers pass
// animate=false and render in full immediately.
// ---------------------------------------------------------------------------

/** Splits into "word + trailing whitespace" chunks so newlines / markdown survive a prefix cut. */
private fun revealChunks(text: String): List<String> =
    Regex("\\S+\\s*").findAll(text).map { it.value }.toList()

@Composable
fun AiAnswerBlock(
    text: String,
    animate: Boolean,
    modifier: Modifier = Modifier,
    color: Color = FarmerChat.requireGraph().config.aiBubbleTextColor?.let { Color(it) }
        ?: LocalContentColors.current.foregroundPrimary,
    onRevealComplete: () -> Unit = {}
) {
    val chunks = remember(text) { revealChunks(text) }
    val total = chunks.size

    // Reveal cursor. Non-animated instances jump straight to the end.
    var revealed by remember(text) { mutableIntStateOf(if (animate) 0 else total) }
    var finished by remember(text) { mutableStateOf(!animate) }

    val completeCb by rememberUpdatedState(onRevealComplete)

    // ~35 ms / word, but bounded so long answers never crawl (chunks-per-tick scales up).
    val intervalMs = 35L
    val maxDurationMs = 6000L
    val perTick = remember(total) {
        if (total <= 0) 1
        else ceil((total * intervalMs).toDouble() / maxDurationMs).toInt().coerceAtLeast(1)
    }

    LaunchedEffect(text, animate) {
        if (!animate || total == 0) {
            revealed = total
            finished = true
            completeCb()
            return@LaunchedEffect
        }
        revealed = 0
        finished = false
        while (revealed < total) {
            delay(intervalMs)
            revealed = (revealed + perTick).coerceAtMost(total)
        }
        finished = true
        completeCb()
    }

    // Blinking caret while revealing.
    var caretOn by remember { mutableStateOf(true) }
    LaunchedEffect(finished) {
        if (finished) return@LaunchedEffect
        while (true) {
            delay(450)
            caretOn = !caretOn
        }
    }

    val display = if (finished) {
        text
    } else {
        val prefix = chunks.take(revealed).joinToString("").trimEnd()
        // "▌" caret glyph appended to the last line; toggles for a subtle blink.
        prefix + (if (caretOn) " ▌" else "")
    }

    // Tap anywhere on the answer to skip the reveal and show the full text.
    val skipModifier = if (!finished) {
        Modifier.clickable(
            interactionSource = remember { MutableInteractionSource() },
            indication = null
        ) {
            revealed = total
            finished = true
            completeCb()
        }
    } else Modifier

    Box(modifier = modifier.then(skipModifier)) {
        MarkdownText(text = display, color = color)
    }
}
