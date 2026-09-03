package org.digitalgreen.farmerchat.sdk.compose.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

/**
 * "AI is generating this image" placeholder shown while a ContentCard photo loads —
 * faithful port of the app's `ui/home/components/AIGeneratingImageOverlay.kt`.
 *
 * A radial fog layer plus 26 orbiting Google-coloured bubbles while [isLoading]; when
 * loading flips false the bubbles are replaced by a 40-particle white "water blast"
 * (600 ms) and the fog fades out (500 ms).
 */
@Composable
fun AIGeneratingImageOverlay(
    isLoading: Boolean,
    modifier: Modifier = Modifier
) {
    val fogAlpha = remember { Animatable(1f) }
    val bubbleProgress = remember { Animatable(0f) }
    val blastProgress = remember { Animatable(0f) }

    LaunchedEffect(isLoading) {
        if (isLoading) {
            fogAlpha.snapTo(1f)
            blastProgress.snapTo(0f)
            bubbleProgress.animateTo(1f, tween(2500, easing = LinearEasing))
        } else {
            blastProgress.animateTo(1f, tween(600, easing = FastOutSlowInEasing))
            fogAlpha.animateTo(0f, tween(500))
        }
    }

    val bubbles = remember { createBubbles() }
    val spray = remember { createSprayParticles() }

    Canvas(modifier = modifier.fillMaxSize()) {
        if (fogAlpha.value > 0f) {
            drawFogLayer(fogAlpha.value)
        }

        if (isLoading) {
            drawBubbles(bubbles, bubbleProgress.value)
        } else {
            drawWaterBlast(spray, blastProgress.value)
        }
    }
}

/**
 * Fallback surface for a ContentCard photo that failed to load — faithful port of the
 * app's `ui/home/components/AIGeneratedGradient.kt`: a neutral base with the
 * "magic eraser processing" overlay drawn over it.
 */
@Composable
fun AIGeneratedGradient(
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .background(Color(0xFFF2F3F5)) // neutral base
    ) {
        MagicEraserProcessingOverlay(
            modifier = Modifier.matchParentSize()
        )
    }
}

/**
 * One-shot dissolve/reveal: fog, a soft radial dissolve growing over 2200 ms, a
 * fading processing ring, 24 sticky Google-coloured bubbles that drift once over
 * 3000 ms and then stop, plus 40 grains of very light noise.
 */
@Composable
private fun MagicEraserProcessingOverlay(
    modifier: Modifier = Modifier
) {
    val reveal = remember { Animatable(0f) }
    val float = remember { Animatable(0f) }

    LaunchedEffect(Unit) {
        reveal.animateTo(1f, tween(2200, easing = LinearEasing))
    }

    // Bubble motion runs only once.
    LaunchedEffect(Unit) {
        float.animateTo(1f, tween(3000, easing = LinearEasing))
    }

    val bubbles = remember {
        List(24) {
            StickyBubble(
                angle = Random.nextFloat() * 360f,
                baseDistance = Random.nextFloat() * 0.35f + 0.15f,
                size = Random.nextFloat() * 5f + 4f,
                speed = Random.nextFloat() * 0.4f + 0.6f,
                color = GOOGLE_COLORS.random()
            )
        }
    }

    Canvas(modifier = modifier) {
        val minRadius = 1f
        val radius = (size.minDimension * (0.2f + reveal.value * 0.9f))
            .coerceAtLeast(minRadius)

        /* Fog */
        drawRect(color = Color(0xFFF5F6F7))

        /* Soft dissolve */
        drawCircle(
            brush = Brush.radialGradient(
                colors = listOf(
                    Color.Transparent,
                    Color(0xFFEDEFF2).copy(alpha = 0.7f),
                    Color(0xFFEDEFF2).copy(alpha = 0.95f)
                ),
                center = center,
                radius = radius
            ),
            radius = radius,
            center = center
        )

        /* Processing ring (fades out) */
        drawCircle(
            color = Color.White.copy(alpha = (1f - reveal.value) * 0.2f),
            radius = radius * 1.1f,
            center = center,
            style = Stroke(width = size.minDimension * 0.014f)
        )

        /* Sticky bubbles — move once then stop */
        bubbles.forEach { bubble ->
            val drift = float.value * (0.08f + bubble.speed * 0.05f)
            val r = radius * (bubble.baseDistance + drift)

            val angleRad = Math.toRadians((bubble.angle + float.value * 30f).toDouble())

            val x = center.x + (r * cos(angleRad)).toFloat()
            val y = center.y + (r * sin(angleRad)).toFloat()

            drawCircle(
                color = bubble.color.copy(alpha = 0.9f),
                radius = bubble.size,
                center = Offset(x, y)
            )
        }

        /* Very light grain */
        repeat(40) {
            drawCircle(
                color = Color.White.copy(alpha = 0.02f),
                radius = 1.2f,
                center = Offset(
                    x = size.width * Random.nextFloat(),
                    y = size.height * Random.nextFloat()
                )
            )
        }
    }
}

// ---------------------------------------------------------------------------
// Bubbles
// ---------------------------------------------------------------------------

private val GOOGLE_COLORS = listOf(
    Color(0xFF4285F4), // Blue
    Color(0xFF34A853), // Green
    Color(0xFFFBBC05), // Yellow
    Color(0xFFEA4335)  // Red
)

private data class OrbitBubble(
    val angle: Float,
    val radius: Float,
    val size: Float,
    val color: Color
)

private data class StickyBubble(
    val angle: Float,
    val baseDistance: Float,
    val size: Float,
    val speed: Float,
    val color: Color
)

private fun createBubbles(): List<OrbitBubble> = List(26) {
    OrbitBubble(
        angle = Random.nextFloat() * 360f,
        radius = Random.nextFloat() * 0.35f + 0.15f,
        size = Random.nextFloat() * 6f + 4f,
        color = GOOGLE_COLORS.random()
    )
}

private fun DrawScope.drawBubbles(bubbles: List<OrbitBubble>, p: Float) {
    bubbles.forEach { b ->
        val r = size.minDimension * b.radius * (0.6f + p * 0.4f)
        val a = Math.toRadians((b.angle + p * 40f).toDouble())

        val x = center.x + (r * cos(a)).toFloat()
        val y = center.y + (r * sin(a)).toFloat()

        drawCircle(b.color.copy(alpha = 0.9f), b.size, Offset(x, y))
    }
}

// ---------------------------------------------------------------------------
// Water blast
// ---------------------------------------------------------------------------

private data class Spray(
    val angle: Float,
    val speed: Float,
    val size: Float
)

private fun createSprayParticles(): List<Spray> = List(40) {
    Spray(
        angle = Random.nextFloat() * 360f,
        speed = Random.nextFloat() * 1.2f + 0.5f,
        size = Random.nextFloat() * 2.5f + 1.5f
    )
}

private fun DrawScope.drawWaterBlast(particles: List<Spray>, p: Float) {
    particles.forEach { s ->
        val a = Math.toRadians(s.angle.toDouble())
        val dist = p * size.minDimension * 0.35f * s.speed

        val x = center.x + (dist * cos(a)).toFloat()
        val y = center.y + (dist * sin(a)).toFloat()

        drawCircle(
            Color.White.copy(alpha = (1f - p) * 0.8f),
            radius = s.size,
            center = Offset(x, y)
        )
    }
}

// ---------------------------------------------------------------------------
// Fog
// ---------------------------------------------------------------------------

private fun DrawScope.drawFogLayer(alpha: Float) {
    drawRect(
        brush = Brush.radialGradient(
            colors = listOf(
                Color.Transparent,
                Color(0xFFEFF2F5).copy(alpha = 0.7f * alpha),
                Color(0xFFEFF2F5).copy(alpha = 0.95f * alpha)
            ),
            center = center,
            radius = size.minDimension * 0.9f
        )
    )
}
