package org.digitalgreen.farmerchat.sdk.compose.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import kotlin.random.Random

/** The four states the app's `ListenButton` renders. */
private enum class ListenState { Default, Loading, Playing, Paused }

/**
 * The "Listen" (text-to-speech) action — port of the app's `components/buttons/ListenButton.kt`.
 *
 * The state the SDK was missing is the **sound wave**: once audio exists, the app replaces the
 * "Listen" LABEL with 14 animated bars and swaps the glyph to Pause (playing) or Play (paused).
 * The SDK previously kept the static "Listen" label in every state, so a farmer got no feedback
 * that audio was actually playing beyond the glyph.
 *
 * @param light the compact agentic pill — neutral-grey surface, dark icon/label, pill radius and
 *   wrap width. `false` keeps the classic full-width dark-green button.
 */
@Composable
internal fun ListenButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isLoading: Boolean = false,
    isPlaying: Boolean = false,
    hasAudioUrl: Boolean = false,
    /**
     * App parity (ListenButton.kt:73): when TTS is off the pill is still DRAWN — its surface at
     * 40% alpha — but takes no taps. The SDK used to hide it entirely.
     */
    enabled: Boolean = true,
    light: Boolean = false
) {
    val c = LocalContentColors.current
    // App parity: the light (agentic) pill is a TRUE semicircle-ended pill with no corner
    // smoothing; the classic button keeps the smoothed MD radius.
    val shape = if (light) RoundedCornerShape(percent = 50) else SmoothShapes.rounded(Radius.MD)

    val container = if (light) c.surfaceReadingSecondary else c.buttonPrimarySurface
    val content = if (light) c.foregroundPrimary else c.buttonPrimaryForeground
    val accent = if (light) c.foregroundPrimary else c.buttonPrimaryAccent
    // The bars stay brand-green in the light pill so they pop against the grey; the classic
    // button keeps white-on-dark-green.
    val waveColor = if (light) c.buttonPrimaryAccent else content

    val state = when {
        isLoading -> ListenState.Loading
        isPlaying -> ListenState.Playing
        hasAudioUrl -> ListenState.Paused
        else -> ListenState.Default
    }

    // App parity (ListenButton.kt:97): a Surface whose colour dims to 40% when disabled; not
    // clickable while disabled or loading; no ripple; the four states cross-fade over 500ms.
    // The icon / label keep their explicit full-strength colours, exactly as the app's do.
    Surface(
        modifier = modifier
            .then(if (light) Modifier else Modifier.width(160.dp))
            .height(42.dp)
            .clip(shape)
            .clickable(
                enabled = enabled && state != ListenState.Loading,
                onClick = onClick,
                interactionSource = remember { MutableInteractionSource() },
                indication = null
            ),
        shape = shape,
        color = if (enabled) container else container.copy(alpha = 0.4f),
        contentColor = if (enabled) content else content.copy(alpha = 0.4f)
    ) {
        AnimatedContent(
            targetState = state,
            transitionSpec = {
                fadeIn(animationSpec = tween(500)) togetherWith
                    fadeOut(animationSpec = tween(500))
            },
            contentAlignment = Alignment.Center,
            label = "listenButtonContent"
        ) { currentState ->
            Row(
                modifier = Modifier.padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                when (currentState) {
                    ListenState.Default -> {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.VolumeUp,
                            contentDescription = null,
                            modifier = Modifier.size(23.dp),
                            tint = accent
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = label(Labels.LISTEN, "Listen"),
                            style = MaterialTheme.typography.labelMedium,
                            color = content
                        )
                    }

                    ListenState.Loading -> {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp,
                            color = accent,
                            trackColor = accent.copy(alpha = 0.3f),
                            strokeCap = StrokeCap.Round
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = label(Labels.LOADING, "Loading..."),
                            style = MaterialTheme.typography.labelMedium,
                            color = content,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }

                    ListenState.Playing -> {
                        Icon(
                            imageVector = Icons.Filled.Pause,
                            contentDescription = null,
                            modifier = Modifier.size(23.dp),
                            tint = accent
                        )
                        Spacer(Modifier.width(6.dp))
                        SoundWaveAnimation(
                            modifier = Modifier.width(54.dp).height(26.dp),
                            isAnimating = true,
                            barColor = waveColor
                        )
                    }

                    ListenState.Paused -> {
                        Icon(
                            imageVector = Icons.Filled.PlayArrow,
                            contentDescription = null,
                            modifier = Modifier.size(23.dp),
                            tint = accent
                        )
                        Spacer(Modifier.width(6.dp))
                        SoundWaveAnimation(
                            modifier = Modifier.width(54.dp).height(26.dp),
                            isAnimating = false,
                            barColor = waveColor
                        )
                    }
                }
            }
        }
    }
}

/**
 * 14 bars that jitter while audio plays and settle to a fixed silhouette when it pauses.
 *
 * The heights are the app's Figma pattern, not random: each bar animates toward a target biased
 * by its own base height plus its current value, so the wave keeps a recognisable shape instead
 * of degenerating into noise.
 */
@Composable
private fun SoundWaveAnimation(
    modifier: Modifier = Modifier,
    barCount: Int = 14,
    isAnimating: Boolean = true,
    barColor: Color = LocalContentColors.current.buttonPrimaryForeground
) {
    val staticHeights = remember {
        listOf(
            0.15f, 0.23f, 0.31f, 0.50f, 0.31f, 0.54f, 0.73f,
            0.50f, 0.73f, 0.38f, 0.50f, 0.50f, 0.31f, 0.15f
        )
    }

    val bars = remember(barCount) {
        List(barCount) { i -> Animatable(staticHeights.getOrElse(i) { 0.3f }) }
    }

    LaunchedEffect(isAnimating) {
        while (true) {
            if (isAnimating) {
                bars.forEachIndexed { i, bar ->
                    launch {
                        val baseHeight = staticHeights.getOrElse(i) { 0.3f }
                        val bias = bar.value * 0.5f + Random.nextFloat() * 0.5f
                        val target = (baseHeight * 0.5f + bias * 0.5f).coerceIn(0.15f, 0.85f)
                        bar.animateTo(
                            targetValue = target,
                            animationSpec = tween(
                                durationMillis = Random.nextInt(80, 150),
                                easing = FastOutSlowInEasing
                            )
                        )
                    }
                }
                delay(Random.nextLong(100, 150))
            } else {
                bars.forEachIndexed { i, bar ->
                    launch {
                        bar.animateTo(
                            targetValue = staticHeights.getOrElse(i) { 0.3f },
                            animationSpec = tween(durationMillis = 200)
                        )
                    }
                }
                delay(100)
            }
        }
    }

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        bars.forEach { animatable ->
            Box(
                modifier = Modifier
                    .width(2.dp)
                    .fillMaxHeight(animatable.value)
                    .background(barColor, shape = RoundedCornerShape(8.dp))
            )
        }
    }
}
