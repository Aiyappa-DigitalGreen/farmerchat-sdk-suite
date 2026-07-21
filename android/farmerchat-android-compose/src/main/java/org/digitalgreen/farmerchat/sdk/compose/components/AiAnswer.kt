package org.digitalgreen.farmerchat.sdk.compose.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors
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
    color: Color = LocalContentColors.current.foregroundPrimary,
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

// ---------------------------------------------------------------------------
// ThinkingIndicator — branded "thinking" state shown before the answer arrives.
// Reuses the LogoSpinner mark and adds a pulsing three-dot affordance.
// ---------------------------------------------------------------------------

@Composable
fun ThinkingIndicator(
    label: String,
    modifier: Modifier = Modifier
) {
    val colors = LocalContentColors.current

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        LogoSpinner(type = LogoSpinnerType.Horizontal)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = colors.foregroundSecondary
            )
            ThreeDotPulse()
        }
    }
}

@Composable
private fun ThreeDotPulse() {
    val brand = LocalBrandColors.current
    val transition = rememberInfiniteTransition(label = "dots")

    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        repeat(3) { i ->
            val alpha by transition.animateFloat(
                initialValue = 0.25f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(600, delayMillis = i * 180, easing = LinearEasing),
                    repeatMode = RepeatMode.Reverse
                ),
                label = "dot$i"
            )
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .alpha(alpha)
                    .clip(CircleShape)
                    .background(brand.foregroundSecondary)
            )
        }
    }
}
