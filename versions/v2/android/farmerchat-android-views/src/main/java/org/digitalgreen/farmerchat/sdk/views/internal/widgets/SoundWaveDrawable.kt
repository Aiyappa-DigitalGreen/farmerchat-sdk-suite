package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import android.animation.ValueAnimator
import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.drawable.Animatable
import android.graphics.drawable.Drawable
import android.view.animation.LinearInterpolator
import androidx.annotation.ColorInt
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.sin

/**
 * The Listen pill's playing wave — app `ListenButton.kt` (`light = true`): 14 bars of 2dp in the
 * accent colour inside a 54x26dp box, rising and falling while audio plays. Used as a compound
 * drawable, so it redraws through the TextView's drawable callback.
 */
internal class SoundWaveDrawable(
    private val density: Float,
    @ColorInt color: Int
) : Drawable(), Animatable {

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color }
    private val bar = RectF()
    private var phase = 0f

    private val animator = ValueAnimator.ofFloat(0f, 1f).apply {
        duration = 1200L
        repeatCount = ValueAnimator.INFINITE
        interpolator = LinearInterpolator()
        addUpdateListener { phase = it.animatedValue as Float; invalidateSelf() }
    }

    override fun getIntrinsicWidth(): Int = (54 * density).toInt()
    override fun getIntrinsicHeight(): Int = (26 * density).toInt()

    override fun draw(canvas: Canvas) {
        val b = bounds
        val barW = 2f * density
        val gap = (b.width() - BARS * barW) / (BARS - 1)
        val minH = 4f * density
        for (i in 0 until BARS) {
            // A travelling sine so neighbouring bars rise in turn; still at rest when stopped.
            val wave = abs(sin((phase * 2 * PI + i * 0.55).toFloat()))
            val h = if (animator.isRunning) minH + (b.height() - minH) * wave else minH + (b.height() - minH) * 0.35f
            val left = b.left + i * (barW + gap)
            val top = b.exactCenterY() - h / 2
            bar.set(left, top, left + barW, top + h)
            canvas.drawRoundRect(bar, barW / 2, barW / 2, paint)
        }
    }

    override fun start() { if (!animator.isRunning) animator.start() }
    override fun stop() { animator.cancel(); invalidateSelf() }
    override fun isRunning(): Boolean = animator.isRunning

    override fun setAlpha(alpha: Int) { paint.alpha = alpha }
    override fun setColorFilter(colorFilter: ColorFilter?) { paint.colorFilter = colorFilter }
    @Deprecated("Deprecated in Java")
    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT

    private companion object {
        const val BARS = 14
    }
}
