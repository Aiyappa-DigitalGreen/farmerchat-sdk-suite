package org.digitalgreen.farmerchat.sdk.compose.components

import android.app.ActivityManager
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntSize
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors

/**
 * Text rendered with a slow horizontal gradient sweep — the "AI is thinking" shimmer used for
 * loading text blocks. Works for multi-line content; the gradient is laid out across the text's
 * measured size and translated on a loop. Falls back to a static muted color on low-RAM devices
 * or when `enabled = false`.
 */
@Composable
fun ShimmerText(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = MaterialTheme.typography.bodyLarge,
    baseColor: Color = LocalContentColors.current.foregroundSecondary,
    highlightColor: Color = LocalContentColors.current.borderActive,
    durationMs: Int = 1200,
    enabled: Boolean = true,
    maxLines: Int = Int.MAX_VALUE,
    softWrap: Boolean = true,
    overflow: TextOverflow = TextOverflow.Clip,
) {
    val context = LocalContext.current
    val isLowEnd = remember(context) {
        val am = context.getSystemService(ActivityManager::class.java)
        am?.isLowRamDevice == true
    }

    if (!enabled || isLowEnd) {
        Text(
            text = text,
            style = style,
            color = baseColor,
            modifier = modifier,
            maxLines = maxLines,
            softWrap = softWrap,
            overflow = overflow,
        )
        return
    }

    var size by remember { mutableStateOf(IntSize.Zero) }

    val transition = rememberInfiniteTransition(label = "shimmer")
    val progress by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = durationMs, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmerProgress"
    )

    val width = size.width.toFloat().coerceAtLeast(1f)
    val height = size.height.toFloat().coerceAtLeast(1f)
    val bandWidth = width * 1.2f
    val travel = width + bandWidth
    val bandCenter = -bandWidth / 2f + progress * travel

    val brush = Brush.linearGradient(
        colorStops = arrayOf(
            0.0f to baseColor,
            0.35f to highlightColor,
            0.65f to highlightColor,
            1.0f to baseColor
        ),
        start = Offset(bandCenter - bandWidth / 2f, 0f),
        end = Offset(bandCenter + bandWidth / 2f, height)
    )

    Text(
        text = text,
        style = style.copy(brush = brush),
        modifier = modifier.onSizeChanged { size = it },
        maxLines = maxLines,
        softWrap = softWrap,
        overflow = overflow,
    )
}
