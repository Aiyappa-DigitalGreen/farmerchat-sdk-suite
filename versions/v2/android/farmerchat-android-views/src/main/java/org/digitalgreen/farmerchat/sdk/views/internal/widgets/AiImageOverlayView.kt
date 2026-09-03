package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.util.AttributeSet
import android.view.View
import android.view.animation.LinearInterpolator
import android.view.animation.PathInterpolator
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.random.Random

/**
 * Views-flavour port of the app's two ContentCard image placeholders
 * (`ui/home/components/AIGeneratingImageOverlay.kt` and
 * `ui/home/components/AIGeneratedGradient.kt`).
 *
 * The Compose app renders these as two separate composables selected by the Coil
 * painter state. Views has one ImageView, so the same two animations live here behind
 * [Mode], driven from the Coil `listener { onStart / onError / onSuccess }` callbacks.
 *
 * - [Mode.LOADING]  — radial fog + 26 orbiting Google-coloured bubbles (2500 ms).
 * - [Mode.ERROR]    — the "magic eraser" dissolve: fog, a soft radial dissolve growing
 *                     over 2200 ms, a fading processing ring, 24 sticky bubbles that
 *                     drift once over 3000 ms, plus light grain.
 * - [Mode.HIDDEN]   — leaving LOADING plays the 40-particle white water blast (600 ms)
 *                     and fades the fog out (500 ms), then the view goes invisible.
 *
 * The canvas is clipped to the card image's 16 dp rounded rect (`FcShapeRounded16`).
 */
internal class AiImageOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    enum class Mode { HIDDEN, LOADING, ERROR }

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val clipPath = Path()
    private val bounds = RectF()
    private val cornerRadiusPx = 16f * resources.displayMetrics.density
    private val random = Random(0)

    private var mode: Mode = Mode.HIDDEN

    // Animation progress, mirroring the app's Animatable values.
    private var fogAlpha = 1f
    private var bubbleProgress = 0f
    private var blastProgress = 0f
    private var reveal = 0f
    private var float = 0f

    private var runningAnimators = mutableListOf<ValueAnimator>()

    private val orbitBubbles = List(26) {
        OrbitBubble(
            angle = random.nextFloat() * 360f,
            radius = random.nextFloat() * 0.35f + 0.15f,
            size = random.nextFloat() * 6f + 4f,
            color = GOOGLE_COLORS.random(random)
        )
    }

    private val spray = List(40) {
        Spray(
            angle = random.nextFloat() * 360f,
            speed = random.nextFloat() * 1.2f + 0.5f,
            size = random.nextFloat() * 2.5f + 1.5f
        )
    }

    private val stickyBubbles = List(24) {
        StickyBubble(
            angle = random.nextFloat() * 360f,
            baseDistance = random.nextFloat() * 0.35f + 0.15f,
            size = random.nextFloat() * 5f + 4f,
            speed = random.nextFloat() * 0.4f + 0.6f,
            color = GOOGLE_COLORS.random(random)
        )
    }

    /** Switches the animation. Idempotent for a mode already running. */
    fun setMode(next: Mode) {
        if (mode == next && next != Mode.HIDDEN) return
        val wasLoading = mode == Mode.LOADING
        mode = next
        cancelAnimators()

        when (next) {
            Mode.LOADING -> {
                visibility = VISIBLE
                fogAlpha = 1f
                blastProgress = 0f
                bubbleProgress = 0f
                animate(2500L, LinearInterpolator()) { bubbleProgress = it }
            }

            Mode.ERROR -> {
                visibility = VISIBLE
                reveal = 0f
                float = 0f
                animate(2200L, LinearInterpolator()) { reveal = it }
                animate(3000L, LinearInterpolator()) { float = it }
            }

            Mode.HIDDEN -> {
                if (!wasLoading) {
                    visibility = GONE
                    return
                }
                // Leaving LOADING: water blast, then fade the fog out.
                blastProgress = 0f
                animate(600L, FAST_OUT_SLOW_IN) { blastProgress = it }
                animate(500L, LinearInterpolator(), onEnd = { visibility = GONE }) {
                    fogAlpha = 1f - it
                }
            }
        }
        invalidate()
    }

    private fun animate(
        duration: Long,
        interpolator: android.animation.TimeInterpolator,
        onEnd: (() -> Unit)? = null,
        apply: (Float) -> Unit
    ) {
        val animator = ValueAnimator.ofFloat(0f, 1f).apply {
            this.duration = duration
            this.interpolator = interpolator
            addUpdateListener {
                apply(it.animatedValue as Float)
                invalidate()
            }
            if (onEnd != null) {
                addListener(object : android.animation.AnimatorListenerAdapter() {
                    override fun onAnimationEnd(animation: android.animation.Animator) {
                        onEnd()
                    }
                })
            }
        }
        runningAnimators += animator
        animator.start()
    }

    private fun cancelAnimators() {
        runningAnimators.forEach { it.cancel() }
        runningAnimators.clear()
    }

    override fun onDetachedFromWindow() {
        cancelAnimators()
        super.onDetachedFromWindow()
    }

    override fun onDraw(canvas: Canvas) {
        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0f || h <= 0f || mode == Mode.HIDDEN && visibility != VISIBLE) return

        bounds.set(0f, 0f, w, h)
        clipPath.reset()
        clipPath.addRoundRect(bounds, cornerRadiusPx, cornerRadiusPx, Path.Direction.CW)
        val save = canvas.save()
        canvas.clipPath(clipPath)

        when (mode) {
            Mode.ERROR -> drawMagicEraser(canvas, w, h)
            else -> {
                if (fogAlpha > 0f) drawFogLayer(canvas, w, h, fogAlpha)
                if (mode == Mode.LOADING) {
                    drawOrbitBubbles(canvas, w, h, bubbleProgress)
                } else {
                    drawWaterBlast(canvas, w, h, blastProgress)
                }
            }
        }

        canvas.restoreToCount(save)
    }

    // ----------------------------------------------------------------- loading

    private fun drawFogLayer(canvas: Canvas, w: Float, h: Float, alpha: Float) {
        val minDim = min(w, h)
        paint.shader = RadialGradient(
            w / 2f, h / 2f, minDim * 0.9f,
            intArrayOf(
                Color.TRANSPARENT,
                withAlpha(0xEFF2F5, 0.7f * alpha),
                withAlpha(0xEFF2F5, 0.95f * alpha)
            ),
            floatArrayOf(0f, 0.5f, 1f),
            Shader.TileMode.CLAMP
        )
        paint.style = Paint.Style.FILL
        canvas.drawRect(0f, 0f, w, h, paint)
        paint.shader = null
    }

    private fun drawOrbitBubbles(canvas: Canvas, w: Float, h: Float, p: Float) {
        val minDim = min(w, h)
        paint.style = Paint.Style.FILL
        orbitBubbles.forEach { b ->
            val r = minDim * b.radius * (0.6f + p * 0.4f)
            val a = Math.toRadians((b.angle + p * 40f).toDouble())
            val x = w / 2f + (r * cos(a)).toFloat()
            val y = h / 2f + (r * sin(a)).toFloat()
            paint.color = withAlpha(b.color, 0.9f)
            canvas.drawCircle(x, y, b.size, paint)
        }
    }

    private fun drawWaterBlast(canvas: Canvas, w: Float, h: Float, p: Float) {
        val minDim = min(w, h)
        paint.style = Paint.Style.FILL
        spray.forEach { s ->
            val a = Math.toRadians(s.angle.toDouble())
            val dist = p * minDim * 0.35f * s.speed
            val x = w / 2f + (dist * cos(a)).toFloat()
            val y = h / 2f + (dist * sin(a)).toFloat()
            paint.color = withAlpha(0xFFFFFF, (1f - p) * 0.8f)
            canvas.drawCircle(x, y, s.size, paint)
        }
    }

    // ----------------------------------------------------------------- error

    private fun drawMagicEraser(canvas: Canvas, w: Float, h: Float) {
        val minDim = min(w, h)
        val cx = w / 2f
        val cy = h / 2f
        val radius = (minDim * (0.2f + reveal * 0.9f)).coerceAtLeast(1f)

        /* Fog */
        paint.shader = null
        paint.style = Paint.Style.FILL
        paint.color = 0xFFF5F6F7.toInt()
        canvas.drawRect(0f, 0f, w, h, paint)

        /* Soft dissolve */
        paint.shader = RadialGradient(
            cx, cy, radius,
            intArrayOf(
                Color.TRANSPARENT,
                withAlpha(0xEDEFF2, 0.7f),
                withAlpha(0xEDEFF2, 0.95f)
            ),
            floatArrayOf(0f, 0.5f, 1f),
            Shader.TileMode.CLAMP
        )
        canvas.drawCircle(cx, cy, radius, paint)
        paint.shader = null

        /* Processing ring (fades out) */
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = minDim * 0.014f
        paint.color = withAlpha(0xFFFFFF, (1f - reveal) * 0.2f)
        canvas.drawCircle(cx, cy, radius * 1.1f, paint)

        /* Sticky bubbles — move once then stop */
        paint.style = Paint.Style.FILL
        stickyBubbles.forEach { bubble ->
            val drift = float * (0.08f + bubble.speed * 0.05f)
            val r = radius * (bubble.baseDistance + drift)
            val angleRad = Math.toRadians((bubble.angle + float * 30f).toDouble())
            val x = cx + (r * cos(angleRad)).toFloat()
            val y = cy + (r * sin(angleRad)).toFloat()
            paint.color = withAlpha(bubble.color, 0.9f)
            canvas.drawCircle(x, y, bubble.size, paint)
        }

        /* Very light grain */
        paint.color = withAlpha(0xFFFFFF, 0.02f)
        repeat(40) {
            canvas.drawCircle(w * random.nextFloat(), h * random.nextFloat(), 1.2f, paint)
        }
    }

    private data class OrbitBubble(
        val angle: Float,
        val radius: Float,
        val size: Float,
        val color: Int
    )

    private data class StickyBubble(
        val angle: Float,
        val baseDistance: Float,
        val size: Float,
        val speed: Float,
        val color: Int
    )

    private data class Spray(val angle: Float, val speed: Float, val size: Float)

    private companion object {
        val GOOGLE_COLORS = listOf(
            0x4285F4, // Blue
            0x34A853, // Green
            0xFBBC05, // Yellow
            0xEA4335  // Red
        )

        val FAST_OUT_SLOW_IN = PathInterpolator(0.4f, 0f, 0.2f, 1f)

        /** rgb (0xRRGGBB) + fractional alpha → ARGB int. */
        fun withAlpha(rgb: Int, alpha: Float): Int {
            val a = (alpha.coerceIn(0f, 1f) * 255f).toInt()
            return (a shl 24) or (rgb and 0x00FFFFFF)
        }
    }
}
