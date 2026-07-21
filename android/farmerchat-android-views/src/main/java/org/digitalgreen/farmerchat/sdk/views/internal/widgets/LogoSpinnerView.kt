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
 * Branded loading affordance (Compose LogoSpinner, vertical): static logo inside
 * a Green500 circular progress ring (55dp ring / 32dp logo) + label below.
 */
internal class LogoSpinnerView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : LinearLayout(context, attrs) {

    private val ring = ProgressBar(context).apply {
        indeterminateTintList = ContextCompat.getColorStateList(context, R.color.fc_green500)
    }
    private val logo = ImageView(context).apply {
        setImageResource(R.drawable.fc_logo_mark)
        setColorFilter(ContextCompat.getColor(context, R.color.fc_foreground_primary))
    }
    private val label = TextView(context).apply {
        setTextColor(ContextCompat.getColor(context, R.color.fc_foreground_primary))
        textSize = 15f
        gravity = Gravity.CENTER
        visibility = GONE
    }

    init {
        orientation = VERTICAL
        gravity = Gravity.CENTER
        val box = FrameLayout(context)
        box.addView(
            ring,
            FrameLayout.LayoutParams(55.dp(context), 55.dp(context), Gravity.CENTER)
        )
        box.addView(
            logo,
            FrameLayout.LayoutParams(32.dp(context), 32.dp(context), Gravity.CENTER)
        )
        addView(box, LayoutParams(55.dp(context), 55.dp(context)))
        addView(label, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
            topMargin = 12.dp(context)
        })
    }

    var text: CharSequence
        get() = label.text
        set(value) {
            label.text = value
            label.visibility = if (value.isBlank()) GONE else VISIBLE
        }
}
