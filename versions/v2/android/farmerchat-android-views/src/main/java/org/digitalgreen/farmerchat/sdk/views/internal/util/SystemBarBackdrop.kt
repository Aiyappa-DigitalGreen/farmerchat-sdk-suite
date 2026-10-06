package org.digitalgreen.farmerchat.sdk.views.internal.util

import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.drawable.Drawable
import android.view.View
import androidx.annotation.ColorInt
import androidx.annotation.ColorRes
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens

/**
 * Paints a `fitsSystemWindows` root the way the app's screens paint the system-bar insets.
 *
 * The app draws its green `DefaultAppBar` UNDER the status bar (`statusBarsPadding()` inside the
 * bar) and leaves the navigation-bar strip in the screen's own surface colour. Views could only
 * approximate that by giving the whole root a green background, which also turned the nav-bar
 * strip green on every screen with a bar (measured: app `(236,236,238)`, views `(0,130,54)` at
 * the bottom of Settings/Help/Name/LanguageChooser), and Auth + the country picker, whose roots
 * were surface-coloured, lost the green status bar entirely.
 *
 * The inset heights are read from the view's own padding at draw time, which is exactly what
 * `fitsSystemWindows` writes, so no insets listener is needed.
 */
private class SystemBarBackdropDrawable(
    private val host: View,
    @ColorInt private val top: Int,
    @ColorInt private val body: Int,
    @ColorInt private val bottom: Int
) : Drawable() {

    private val paint = Paint()

    override fun draw(canvas: Canvas) {
        val b = bounds
        paint.color = body
        canvas.drawRect(b, paint)
        val topH = host.paddingTop
        if (topH > 0) {
            paint.color = top
            canvas.drawRect(b.left.toFloat(), b.top.toFloat(), b.right.toFloat(), (b.top + topH).toFloat(), paint)
        }
        val bottomH = host.paddingBottom
        if (bottomH > 0 && bottom != body) {
            paint.color = bottom
            canvas.drawRect(b.left.toFloat(), (b.bottom - bottomH).toFloat(), b.right.toFloat(), b.bottom.toFloat(), paint)
        }
    }

    override fun setAlpha(alpha: Int) = Unit
    override fun setColorFilter(colorFilter: ColorFilter?) = Unit
    @Deprecated("Deprecated in Java")
    override fun getOpacity(): Int = PixelFormat.OPAQUE
}

/**
 * Brand-green status bar over a [bodyRes] screen, with the nav-bar strip in [bottomRes]
 * (defaults to the body). Honours a host theme: the green is remapped like every other brand
 * token.
 */
internal fun View.applySystemBarBackdrop(
    @ColorRes bodyRes: Int = R.color.fc_surface_primary,
    @ColorRes bottomRes: Int = bodyRes,
    @ColorRes topRes: Int = R.color.fc_green700
) {
    val top = FcTokens.color(context, topRes)
    background = SystemBarBackdropDrawable(
        host = this,
        top = top,
        body = FcTokens.color(context, bodyRes),
        bottom = FcTokens.color(context, bottomRes)
    )
}
