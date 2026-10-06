package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Shader
import android.util.AttributeSet
import androidx.recyclerview.widget.RecyclerView

/**
 * RecyclerView with the agentic Home's top fade mask (app `HomeScreen.kt` LazyColumn
 * `drawWithContent { … BlendMode.DstIn }`): the list's top strip is transparent through the
 * fixed header's body and ramps to opaque over the last 20% of it, so cards dissolve into the
 * green backdrop as they scroll up behind the header, and the resting first card — which sits
 * exactly at [fadeEndPx] — is never faded.
 *
 * An end of 0 (the default) disables the mask entirely (legacy Home), so this is a drop-in
 * RecyclerView.
 */
internal class FadeTopRecyclerView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : RecyclerView(context, attrs) {

    var fadeEndPx: Int = 0
        private set
    private var fadeStartPx: Int = 0

    /** Transparent above [startPx], ramping to fully kept at [endPx] (view coordinates). */
    fun setFade(startPx: Int, endPx: Int) {
        if (startPx == fadeStartPx && endPx == fadeEndPx) return
        fadeStartPx = startPx.coerceIn(0, endPx)
        fadeEndPx = endPx
        shader = null
        invalidate()
    }

    private val maskPaint = Paint().apply { xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_IN) }
    private var shader: LinearGradient? = null

    override fun draw(canvas: Canvas) {
        if (fadeEndPx <= 0) {
            super.draw(canvas)
            return
        }
        // Offscreen layer so DST_IN blends against the list only, not the window.
        val save = canvas.saveLayer(0f, 0f, width.toFloat(), height.toFloat(), null)
        super.draw(canvas)
        val s = shader ?: LinearGradient(
            0f, fadeStartPx.toFloat(), 0f, fadeEndPx.toFloat(),
            Color.TRANSPARENT, Color.BLACK,
            Shader.TileMode.CLAMP
        ).also { shader = it }
        maskPaint.shader = s
        canvas.drawRect(0f, 0f, width.toFloat(), fadeEndPx.toFloat(), maskPaint)
        canvas.restoreToCount(save)
    }
}
