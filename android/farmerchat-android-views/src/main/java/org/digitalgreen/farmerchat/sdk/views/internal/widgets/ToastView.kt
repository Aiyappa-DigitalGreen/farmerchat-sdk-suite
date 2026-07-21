package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import android.content.Context
import android.util.AttributeSet
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.core.content.ContextCompat
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.internal.util.dp

/**
 * In-app toast (Compose Toast parity): full-width white rounded-16 card with a
 * 32dp colored circle (check / close / spinner) and the message text.
 */
internal class ToastView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : FrameLayout(context, attrs) {

    enum class Type { SUCCESS, ERROR, LOADING }

    private val card = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        background = ContextCompat.getDrawable(context, R.drawable.fc_bg_toast_card)
        elevation = 8.dp(context).toFloat()
        val padH = 16.dp(context)
        val padV = 13.dp(context)
        setPadding(padH, padV, padH, padV)
    }
    private val circle = FrameLayout(context)
    private val icon = ImageView(context).apply {
        setColorFilter(ContextCompat.getColor(context, R.color.fc_white))
    }
    private val spinner = ProgressBar(context).apply {
        indeterminateTintList = ContextCompat.getColorStateList(context, R.color.fc_white)
        visibility = GONE
    }
    private val label = TextView(context).apply {
        setTextColor(ContextCompat.getColor(context, R.color.fc_foreground_primary))
        textSize = 15f
    }

    private val hideRunnable = Runnable { visibility = GONE }

    init {
        circle.addView(icon, LayoutParams(18.dp(context), 18.dp(context), Gravity.CENTER))
        circle.addView(spinner, LayoutParams(18.dp(context), 18.dp(context), Gravity.CENTER))
        card.addView(circle, LinearLayout.LayoutParams(32.dp(context), 32.dp(context)))
        card.addView(
            label,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginStart = 12.dp(context)
            }
        )
        val margin = 20.dp(context)
        addView(
            card,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
                leftMargin = margin
                rightMargin = margin
            }
        )
        visibility = GONE
    }

    fun show(message: String, type: Type = Type.SUCCESS, durationMs: Long = 3000L) {
        removeCallbacks(hideRunnable)
        label.text = message
        val circleColor = if (type == Type.ERROR) R.color.fc_red500 else R.color.fc_green500
        circle.background = ContextCompat.getDrawable(
            context,
            if (type == Type.ERROR) R.drawable.fc_bg_circle_error else R.drawable.fc_bg_circle_green500
        )
        circle.backgroundTintList = ContextCompat.getColorStateList(context, circleColor)
        spinner.visibility = if (type == Type.LOADING) VISIBLE else GONE
        icon.visibility = if (type == Type.LOADING) GONE else VISIBLE
        icon.setImageResource(
            if (type == Type.ERROR) R.drawable.fc_ic_close else R.drawable.fc_ic_check
        )
        visibility = VISIBLE
        if (type != Type.LOADING && durationMs > 0) {
            postDelayed(hideRunnable, durationMs)
        }
    }

    fun hide() {
        removeCallbacks(hideRunnable)
        visibility = GONE
    }
}
