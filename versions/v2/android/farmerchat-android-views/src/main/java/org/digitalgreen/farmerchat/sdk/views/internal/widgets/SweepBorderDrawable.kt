package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.RectF
import android.graphics.SweepGradient
import android.graphics.drawable.Drawable
import androidx.annotation.ColorInt

/**
 * The agentic Share pill: a filled rounded rect with a conic (sweep) gradient border.
 *
 * Views equivalent of the Compose flavour's `ActionButton(borderBrush = brand.accentSweepBorder)`
 * (app parity: ChatResponseActions.kt @ bda80659). A shape drawable cannot express this — XML's
 * `android:type="sweep"` carries three stops and the design needs five — so the stroke is painted
 * with a [SweepGradient] instead.
 *
 * Stop placement matches the Compose brush exactly. Android's sweep, like Compose's, starts at
 * 3 o'clock while the design's `conic-gradient(from 0deg)` starts at 12 o'clock, so the stops are
 * rotated +90 degrees (shifted by 0.25): top = green, right = cyan, bottom = green, left = yellow.
 */
internal class SweepBorderDrawable(
    @ColorInt private val fillColor: Int,
    @ColorInt private val green: Int,
    @ColorInt private val cyan: Int,
    @ColorInt private val yellow: Int,
    private val strokeWidthPx: Float,
    private val cornerRadiusPx: Float,
) : Drawable() {

    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = fillColor }
    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = strokeWidthPx
    }
    private val fillRect = RectF()
    private val strokeRect = RectF()

    override fun onBoundsChange(bounds: android.graphics.Rect) {
        // Inset by half the stroke so the border sits INSIDE the bounds, as Compose's
        // Modifier.border and Material3's Surface(border = ...) both do.
        val half = strokeWidthPx / 2f
        strokeRect.set(
            bounds.left + half, bounds.top + half,
            bounds.right - half, bounds.bottom - half,
        )
        // The fill covers the FULL bounds, not the stroke's inset rect: the stroke straddles
        // strokeRect's edge, so filling only that rect leaves the outer half-stroke relying on the
        // stroke's own antialiased edge and can show a hairline of whatever is behind at the
        // rounded corners.
        fillRect.set(
            bounds.left.toFloat(), bounds.top.toFloat(),
            bounds.right.toFloat(), bounds.bottom.toFloat(),
        )
        strokePaint.shader = SweepGradient(
            bounds.exactCenterX(), bounds.exactCenterY(),
            intArrayOf(cyan, green, yellow, green, cyan),
            floatArrayOf(0.00f, 0.25f, 0.50f, 0.75f, 1.00f),
        )
    }

    override fun draw(canvas: Canvas) {
        // drawRoundRect clamps the radius to half the smaller dimension, so a large literal gives
        // a true capsule — the shape ActionButton resolves Radius.Rounded to.
        canvas.drawRoundRect(fillRect, cornerRadiusPx, cornerRadiusPx, fillPaint)
        canvas.drawRoundRect(strokeRect, cornerRadiusPx, cornerRadiusPx, strokePaint)
    }

    override fun setAlpha(alpha: Int) {
        fillPaint.alpha = alpha
        strokePaint.alpha = alpha
    }

    override fun setColorFilter(colorFilter: ColorFilter?) {
        fillPaint.colorFilter = colorFilter
        strokePaint.colorFilter = colorFilter
    }

    @Deprecated("Deprecated in Drawable, still abstract")
    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
}
