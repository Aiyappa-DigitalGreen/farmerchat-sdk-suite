package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import android.animation.ValueAnimator
import android.app.ActivityManager
import android.content.Context
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Shader
import android.util.AttributeSet
import android.view.animation.LinearInterpolator
import androidx.annotation.ColorInt
import androidx.appcompat.widget.AppCompatTextView
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens

/**
 * Text with a slow horizontal gradient sweep — the Views port of Compose
 * `components/ShimmerText.kt`, used for the composer's placeholder.
 *
 * Compose parity:
 *  - band width = 1.2x the text width, travelling `width + band` per cycle;
 *  - stops are base → highlight → highlight → base at 0 / .35 / .65 / 1;
 *  - a low-RAM device (or [shimmerEnabled] = false) falls back to flat [baseColor],
 *    exactly like the composable's `isLowRamDevice` guard.
 *
 * The sweep is a shader on the paint translated by a [Matrix] each frame, so nothing is
 * re-measured or re-laid out while it runs.
 */
internal class ShimmerTextView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : AppCompatTextView(context, attrs) {

    /** Compose default for the composer placeholder (ComposerShimmerPeriodMs). */
    var durationMs: Int = 2250

    @ColorInt
    var baseColor: Int = currentTextColor
        set(value) {
            field = value
            setTextColor(value)
            rebuildShader()
        }

    /** Compose highlight default: `LocalContentColors.borderActive` (accent). */
    @ColorInt
    var sweepColor: Int = FcTokens.accent(context)
        set(value) {
            field = value
            rebuildShader()
        }

    var shimmerEnabled: Boolean = true
        set(value) {
            if (field == value) return
            field = value
            if (value) startSweep() else stopSweep()
        }

    private val isLowRam: Boolean = runCatching {
        (context.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager)?.isLowRamDevice
            ?: false
    }.getOrDefault(false)

    private val matrix = Matrix()
    private var shader: LinearGradient? = null
    private var translate = 0f
    private var animator: ValueAnimator? = null

    init {
        // Adopt the XML textColor as the sweep's base so the flat fallback and the shimmer
        // agree; [sweepColor] already defaults to the accent (Compose `borderActive`).
        baseColor = currentTextColor
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        rebuildShader()
        // START the sweep here, not just rebuild the shader.
        //
        // [canShimmer] requires a measured width, but EVERY other entry point that calls
        // [startSweep] — onAttachedToWindow, onVisibilityAggregated, the [shimmerEnabled] setter,
        // [setShimmerText] — runs BEFORE first layout, when width is still 0. So each one bailed
        // out, and this callback (the only one that fires once the width is known) rebuilt the
        // shader without ever starting the animator. Net effect: the view rendered its base
        // colour and never swept, anywhere it was used.
        if (shimmerEnabled) startSweep()
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (shimmerEnabled) startSweep()
    }

    override fun onDetachedFromWindow() {
        stopSweep()
        super.onDetachedFromWindow()
    }

    override fun onVisibilityAggregated(isVisible: Boolean) {
        super.onVisibilityAggregated(isVisible)
        if (isVisible && shimmerEnabled) startSweep() else stopSweep()
    }

    private fun canShimmer(): Boolean =
        shimmerEnabled && !isLowRam && width > 0 && text?.isNotEmpty() == true

    private fun rebuildShader() {
        if (!canShimmer()) {
            paint.shader = null
            invalidate()
            return
        }
        val band = width * 1.2f
        shader = LinearGradient(
            0f, 0f, band, height.toFloat(),
            intArrayOf(baseColor, sweepColor, sweepColor, baseColor),
            floatArrayOf(0f, 0.35f, 0.65f, 1f),
            Shader.TileMode.CLAMP
        )
        paint.shader = shader
        applyTranslate()
    }

    private fun applyTranslate() {
        val s = shader ?: return
        val band = width * 1.2f
        matrix.reset()
        matrix.setTranslate(-band + translate * (width + band), 0f)
        s.setLocalMatrix(matrix)
        invalidate()
    }

    private fun startSweep() {
        if (!canShimmer()) {
            if (paint.shader != null) {
                paint.shader = null
                invalidate()
            }
            return
        }
        if (animator?.isRunning == true) return
        if (shader == null) rebuildShader()
        animator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = durationMs.toLong()
            interpolator = LinearInterpolator()
            repeatCount = ValueAnimator.INFINITE
            addUpdateListener {
                translate = it.animatedValue as Float
                applyTranslate()
            }
            start()
        }
    }

    private fun stopSweep() {
        animator?.cancel()
        animator = null
        paint.shader = null
        invalidate()
    }

    /** Sets the text and (re)starts the sweep for the new measured width. */
    fun setShimmerText(value: String) {
        text = value
        rebuildShader()
        if (shimmerEnabled) startSweep()
    }
}
