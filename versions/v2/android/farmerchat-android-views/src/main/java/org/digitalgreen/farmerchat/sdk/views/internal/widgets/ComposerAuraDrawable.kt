package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.AnimatorSet
import android.animation.ValueAnimator
import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.SweepGradient
import android.graphics.drawable.Drawable
import android.view.animation.LinearInterpolator
import android.view.animation.PathInterpolator
import androidx.core.graphics.ColorUtils
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcResolvedColors

/**
 * The idle "alive" aura around the composer's text field — app `InputComposer.kt`
 * (`showAura && !isFocused`): a sweep gradient over the palette green → cyan → green → yellow →
 * green that rotates once every 7s, drawn as three stacked strokes (halo 4.5x @16%, mid 3x @30%,
 * core 2x @100% of the 2.4dp border width) clipped to the field, so ~one border width shows
 * inside the edge with a soft inner bloom. Its intensity breathes: 1 ↔ 0.5 twice, then a deep ebb
 * to 0.04 and a slow swell back, forever.
 *
 * Views listed this as a known gap ("composer idle aura"); it is drawn as the field's foreground so
 * it sits on top of the fill exactly like the app's `drawWithContent`.
 */
internal class ComposerAuraDrawable(
    private val borderWidthPx: Float,
    private val cornerRadiusPx: Float,
    /** Host palette (null = FarmerChat's green/cyan/yellow): the stops follow the host accent. */
    colors: FcResolvedColors? = null,
) : Drawable() {

    private val palette: IntArray =
        if (colors == null) PALETTE else IntArray(PALETTE.size) { colors.remapColor(PALETTE[it]) }

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val rect = RectF()
    private val path = Path()
    private var flow = 0f
    private var intensity = 0.8f
    private var running = false

    private val flowAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
        duration = FLOW_MS
        interpolator = LinearInterpolator()
        repeatCount = ValueAnimator.INFINITE
        addUpdateListener { flow = it.animatedValue as Float; invalidateSelf() }
    }

    private var breathing: AnimatorSet? = null

    fun start() {
        if (running) return
        running = true
        flowAnimator.start()
        startBreathing()
        invalidateSelf()
    }

    fun stop() {
        if (!running) return
        running = false
        flowAnimator.cancel()
        breathing?.removeAllListeners()
        breathing?.cancel()
        breathing = null
        invalidateSelf()
    }

    private fun startBreathing() {
        fun step(to: Float, ms: Long) = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = ms
            interpolator = EASE_IN_OUT
            var from = intensity
            addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationStart(animation: Animator) { from = intensity }
            })
            addUpdateListener {
                intensity = from + (to - from) * (it.animatedValue as Float)
                invalidateSelf()
            }
        }
        val set = AnimatorSet().apply {
            playSequentially(
                step(1f, 2400), step(0.5f, 2400),
                step(1f, 2400), step(0.5f, 2400),
                step(0.04f, 2800), step(1f, 2600),
            )
            addListener(object : AnimatorListenerAdapter() {
                private var cancelled = false
                override fun onAnimationCancel(animation: Animator) { cancelled = true }
                override fun onAnimationEnd(animation: Animator) {
                    if (!cancelled && running) startBreathing()
                }
            })
        }
        breathing = set
        set.start()
    }

    override fun draw(canvas: Canvas) {
        if (!running) return
        val b = bounds
        if (b.isEmpty) return
        rect.set(b)
        path.reset()
        path.addRoundRect(rect, cornerRadiusPx, cornerRadiusPx, Path.Direction.CW)

        // 19 stops, each sampling the cyclic palette offset by the rotation (app auraColorAt).
        val n = 18
        val colors = IntArray(n + 1)
        val positions = FloatArray(n + 1)
        for (i in 0..n) {
            val pos = i / n.toFloat()
            positions[i] = pos
            colors[i] = colorAt(palette, ((pos - flow) % 1f + 1f) % 1f)
        }
        paint.shader = SweepGradient(rect.centerX(), rect.centerY(), colors, positions)

        val save = canvas.save()
        canvas.clipPath(path)
        paint.strokeWidth = borderWidthPx * 4.5f
        paint.alpha = (intensity * 0.16f * 255).toInt().coerceIn(0, 255)
        canvas.drawPath(path, paint)
        paint.strokeWidth = borderWidthPx * 3f
        paint.alpha = (intensity * 0.30f * 255).toInt().coerceIn(0, 255)
        canvas.drawPath(path, paint)
        paint.strokeWidth = borderWidthPx * 2f
        paint.alpha = (intensity * 255).toInt().coerceIn(0, 255)
        canvas.drawPath(path, paint)
        canvas.restoreToCount(save)
    }

    override fun setAlpha(alpha: Int) = Unit
    override fun setColorFilter(colorFilter: ColorFilter?) = Unit
    @Deprecated("Deprecated in Java")
    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT

    private companion object {
        const val FLOW_MS = 7000L
        val EASE_IN_OUT = PathInterpolator(0.42f, 0f, 0.58f, 1f)
        val PALETTE = intArrayOf(
            0xFF00C950.toInt(), // green (Green500)
            0xFF22D3EE.toInt(), // cyan
            0xFF00C950.toInt(), // green
            0xFFFFF947.toInt(), // yellow
            0xFF00C950.toInt(), // green (seamless loop)
        )

        fun colorAt(palette: IntArray, t: Float): Int {
            val seg = t.coerceIn(0f, 1f) * (palette.size - 1)
            val i = seg.toInt().coerceIn(0, palette.size - 2)
            return ColorUtils.blendARGB(palette[i], palette[i + 1], seg - i)
        }
    }
}
