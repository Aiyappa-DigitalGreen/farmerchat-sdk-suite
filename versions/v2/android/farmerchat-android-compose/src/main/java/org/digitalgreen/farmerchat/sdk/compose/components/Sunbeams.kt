package org.digitalgreen.farmerchat.sdk.compose.components

import android.graphics.BlurMaskFilter
import android.graphics.Bitmap
import androidx.compose.animation.core.EaseInOutSine
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import kotlin.math.cos
import kotlin.math.sin

/**
 * Animated sunbeams for the Home header — soft, blurred rays fanning down from
 * the yellow glow, like sun through haze. Mirrors updates/Glow on the Location
 * & Weather 2.0 Figma page. Subtle by design: a slow ±1.4° sway plus two beam
 * groups breathing on different rhythms, so the light twinkles without ever
 * pulling the eye from the content.
 *
 * Built for legacy devices:
 *  - The blur is paid ONCE per size: beams render into two half-resolution
 *    offscreen bitmaps (blurred via [BlurMaskFilter]) inside [drawWithCache].
 *    A frame is then just two blurred-image draws — no per-frame blur, no
 *    allocations, cheaper than drawing the paths directly.
 *  - Animated values are read only in the draw phase; frames never recompose
 *    or relayout anything.
 *  - [visibleProvider] turns frames into a no-op once the header has
 *    scrolled away.
 */
@Composable
fun Sunbeams(
    modifier: Modifier = Modifier,
    visibleProvider: () -> Float = { 1f },
) {
    val transition = rememberInfiniteTransition(label = "sunbeams")
    // Slow sway around the sun's origin, like light shifting through air.
    val sway by transition.animateFloat(
        initialValue = -1.4f,
        targetValue = 1.4f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 16000, easing = EaseInOutSine),
            repeatMode = RepeatMode.Reverse
        ),
        label = "sway"
    )
    // One phase drives both twinkle rhythms (group B runs at 2x so the cycle
    // stays continuous across restarts). 8s base period.
    val breath by transition.animateFloat(
        initialValue = 0f,
        targetValue = (2 * Math.PI).toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 8000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "breath"
    )

    Box(
        modifier = modifier.drawWithCache {
            // Sun origin: horizontally centered, a little above the top edge —
            // where the yellow Glow asset sits.
            val origin = Offset(size.width / 2f, -40.dp.toPx())

            // Angle from vertical (degrees), length fraction, base alpha.
            // Alternating long/short like the Figma comp; split into two
            // groups that twinkle on different rhythms.
            data class BeamSpec(val angleDeg: Float, val length: Float, val alpha: Float)
            val specs = listOf(
                BeamSpec(-52f, 0.62f, 0.07f),
                BeamSpec(-36f, 0.95f, 0.10f),
                BeamSpec(-22f, 0.72f, 0.07f),
                BeamSpec(-8f, 1.00f, 0.11f),
                BeamSpec(7f, 0.78f, 0.07f),
                BeamSpec(21f, 1.00f, 0.10f),
                BeamSpec(37f, 0.68f, 0.07f),
                BeamSpec(51f, 0.90f, 0.08f),
            )

            // Render one beam group into a half-resolution, pre-blurred bitmap.
            val scale = 0.5f
            val bmpW = (size.width * scale).toInt().coerceAtLeast(1)
            val bmpH = (size.height * scale).toInt().coerceAtLeast(1)
            val warm = android.graphics.Color.argb(255, 255, 246, 214)
            fun renderGroup(group: List<BeamSpec>): android.graphics.Bitmap {
                val bmp = Bitmap.createBitmap(bmpW, bmpH, Bitmap.Config.ARGB_8888)
                val canvas = android.graphics.Canvas(bmp)
                canvas.scale(scale, scale)
                val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                    // Vertical sunlight fade: brightest near origin, gone ~85% down.
                    shader = android.graphics.LinearGradient(
                        0f, 0f, 0f, size.height * 0.85f,
                        warm, android.graphics.Color.TRANSPARENT,
                        android.graphics.Shader.TileMode.CLAMP
                    )
                    // Real sun has no hard edges — soften every beam.
                    maskFilter = BlurMaskFilter(7.dp.toPx(), BlurMaskFilter.Blur.NORMAL)
                }
                for (spec in group) {
                    val rad = Math.toRadians(spec.angleDeg.toDouble())
                    val dirX = sin(rad).toFloat()
                    val dirY = cos(rad).toFloat()
                    val perpX = dirY
                    val perpY = -dirX
                    val startR = 30.dp.toPx()
                    val endR = size.height * spec.length * 1.35f
                    val startHalf = 3.dp.toPx()
                    val endHalf = 17.dp.toPx()
                    val path = android.graphics.Path().apply {
                        moveTo(origin.x + dirX * startR - perpX * startHalf, origin.y + dirY * startR - perpY * startHalf)
                        lineTo(origin.x + dirX * startR + perpX * startHalf, origin.y + dirY * startR + perpY * startHalf)
                        lineTo(origin.x + dirX * endR + perpX * endHalf, origin.y + dirY * endR + perpY * endHalf)
                        lineTo(origin.x + dirX * endR - perpX * endHalf, origin.y + dirY * endR - perpY * endHalf)
                        close()
                    }
                    paint.alpha = (spec.alpha * 255).toInt()
                    canvas.drawPath(path, paint)
                }
                return bmp
            }
            val groupA = renderGroup(specs.filterIndexed { i, _ -> i % 2 == 0 }).asImageBitmap()
            val groupB = renderGroup(specs.filterIndexed { i, _ -> i % 2 == 1 }).asImageBitmap()
            val dstSize = IntSize(size.width.toInt(), size.height.toInt())

            onDrawBehind {
                val visible = visibleProvider()
                if (visible <= 0.01f) return@onDrawBehind
                // Two rhythms beating against each other reads as twinkle,
                // not a mechanical pulse.
                val breatheA = 0.55f + 0.45f * sin(breath)
                val breatheB = 0.55f + 0.45f * sin(2f * breath + 2.4f)
                rotate(degrees = sway, pivot = origin) {
                    drawImage(groupA, dstSize = dstSize, alpha = breatheA * visible)
                    drawImage(groupB, dstSize = dstSize, alpha = breatheB * visible)
                }
            }
        }
    )
}
