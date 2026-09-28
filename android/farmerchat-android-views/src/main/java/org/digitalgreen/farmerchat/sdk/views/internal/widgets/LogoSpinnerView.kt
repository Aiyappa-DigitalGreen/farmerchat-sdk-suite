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
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcViewTheme
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
        setImageResource(FcViewTheme.hostTheme()?.logo ?: R.drawable.fc_logo_mark)
        setColorFilter(ContextCompat.getColor(context, R.color.fc_foreground_primary))
    }
    private val label = TextView(context).apply {
        setTextColor(ContextCompat.getColor(context, R.color.fc_foreground_primary))
        textSize = 15f
        gravity = Gravity.CENTER
        visibility = GONE
    }

    private val box = FrameLayout(context)

    init {
        box.addView(ring, FrameLayout.LayoutParams(0, 0, Gravity.CENTER))
        box.addView(logo, FrameLayout.LayoutParams(0, 0, Gravity.CENTER))
        addView(box)
        addView(label)
        applyLayout()
    }

    /**
     * Horizontal = the app's in-thread "answer loading" style
     * (`components/LogoSpinnerHorizontal.kt`): a compact 40dp ring with a 23dp logo and the
     * label beside it, 12dp apart, left-aligned. Vertical (the default) is the app's
     * full-screen loader: a 55dp ring with the label underneath.
     *
     * The chat thread uses horizontal; the language / home / history / full-screen chat
     * loaders stay vertical.
     */
    var horizontal: Boolean = false
        set(value) {
            if (field == value) return
            field = value
            applyLayout()
        }

    private fun applyLayout() {
        val ringSize = if (horizontal) 40.dp(context) else 55.dp(context)
        val logoSize = if (horizontal) 23.dp(context) else 32.dp(context)
        val gap = 12.dp(context)

        orientation = if (horizontal) HORIZONTAL else VERTICAL
        gravity = if (horizontal) Gravity.CENTER_VERTICAL else Gravity.CENTER

        ring.layoutParams = FrameLayout.LayoutParams(ringSize, ringSize, Gravity.CENTER)
        logo.layoutParams = FrameLayout.LayoutParams(logoSize, logoSize, Gravity.CENTER)
        box.layoutParams = LayoutParams(ringSize, ringSize)
        label.gravity = if (horizontal) Gravity.START or Gravity.CENTER_VERTICAL else Gravity.CENTER
        label.layoutParams =
            LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
                if (horizontal) marginStart = gap else topMargin = gap
            }
        requestLayout()
    }

    var text: CharSequence
        get() = label.text
        set(value) {
            label.text = value
            label.visibility = if (value.isBlank()) GONE else VISIBLE
        }
}
