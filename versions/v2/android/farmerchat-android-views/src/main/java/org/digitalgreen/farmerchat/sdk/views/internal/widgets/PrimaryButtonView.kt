package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens
import android.content.Context
import android.graphics.Typeface
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
import androidx.annotation.DrawableRes

/**
 * 1:1 port of the Compose PrimaryButton: dark-green fill (buttonPrimarySurface,
 * never dimmed), 12dp radius, labelLarge white text, trailing Green500 chevron /
 * 20dp Green500 spinner. Disabled dims TEXT + accent to 50%, not the fill.
 */
internal class PrimaryButtonView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : FrameLayout(context, attrs) {

    enum class State { DEFAULT, CHEVRON, LOADING }

    private val row = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER
    }
    /**
     * Compose-rendered, like every other static label in the flavour — see [FcText]. This one
     * matters disproportionately: PrimaryButtonView is used on Language, LanguageChooser, Auth,
     * Settings, SettingsName, EnterName and the drawer, so a `TextView` here left button text
     * mismatched on nearly every screen.
     *
     * `labelLarge` is 17sp/600 (Type.kt); the old `sans-serif-medium` typeface is weight 500.
     */
    private val label = FcText(context).apply {
        setTextColor(FcTokens.color(context, R.color.fc_white))
        setTextSizeSp(17f)
        setTextWeight(600)
        setMaxLines(1)
    }
    /**
     * Optional LEADING icon. Compose parity (Buttons.kt:212-215 + AuthScreen.kt:515,530): a 24dp
     * icon 8dp before the label. The Auth channel buttons are the app's only use — it shows
     * "Send via WhatsApp"/"Send via SMS" each with its channel glyph, and views rendered both
     * as bare text.
     */
    private val leadingIcon = ImageView(context).apply {
        visibility = GONE
    }
    private val chevron = ImageView(context).apply {
        setImageResource(R.drawable.fc_ic_chevron_right)
        setColorFilter(FcTokens.color(context, R.color.fc_green500))
        visibility = GONE
    }
    private val progress = ProgressBar(context).apply {
        indeterminateTintList = FcTokens.colorStateList(context, R.color.fc_green500)
        visibility = GONE
    }

    private var isEnabledExternally: Boolean = true

    var state: State = State.DEFAULT
        set(value) {
            field = value
            chevron.visibility = if (value == State.CHEVRON) VISIBLE else GONE
            progress.visibility = if (value == State.LOADING) VISIBLE else GONE
            isEnabled = isEnabledExternally && value != State.LOADING
            applyContentAlpha()
        }

    init {
        background = ContextCompat.getDrawable(context, R.drawable.fc_bg_primary_button)
        isClickable = true
        isFocusable = true
        minimumHeight = 48.dp(context)
        val padStart = 24.dp(context)
        val padEnd = 16.dp(context)
        setPadding(padStart, 0, padEnd, 0)
        row.addView(leadingIcon, LinearLayout.LayoutParams(24.dp(context), 24.dp(context)).apply {
            marginEnd = 8.dp(context)
        })
        row.addView(label)
        row.addView(chevron, LinearLayout.LayoutParams(24.dp(context), 24.dp(context)).apply {
            marginStart = 8.dp(context)
        })
        row.addView(progress, LinearLayout.LayoutParams(20.dp(context), 20.dp(context)).apply {
            marginStart = 12.dp(context)
        })
        addView(row, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT, Gravity.CENTER))
    }

    /** Sets (or with null, clears) the leading icon. Tinted to match the label. */
    fun setLeadingIcon(@DrawableRes resId: Int?) {
        if (resId == null) {
            leadingIcon.visibility = GONE
            return
        }
        leadingIcon.setImageResource(resId)
        leadingIcon.setColorFilter(FcTokens.color(context, R.color.fc_white))
        leadingIcon.visibility = VISIBLE
    }

    var text: CharSequence
        get() = label.text ?: ""
        set(value) {
            label.text = value
        }

    /** Square corners (full-bleed card confirm button parity, radius = NONE). */
    fun setSquareCorners() {
        background = ContextCompat.getDrawable(context, R.drawable.fc_bg_primary_button_square)
    }

    fun setButtonEnabled(enabled: Boolean) {
        isEnabledExternally = enabled
        isEnabled = enabled && state != State.LOADING
        applyContentAlpha()
    }

    /** Fill never dims; label + chevron drop to 50% alpha when disabled. */
    private fun applyContentAlpha() {
        val contentAlpha = if (isEnabledExternally) 1f else 0.5f
        label.alpha = contentAlpha
        chevron.alpha = contentAlpha
    }
}
