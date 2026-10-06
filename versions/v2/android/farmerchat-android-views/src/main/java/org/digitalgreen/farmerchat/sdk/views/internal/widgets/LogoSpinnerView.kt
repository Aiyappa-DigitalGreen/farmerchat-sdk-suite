package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import android.content.Context
import android.util.AttributeSet
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.content.res.ColorStateList
import androidx.core.content.ContextCompat
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcViewTheme
import org.digitalgreen.farmerchat.sdk.views.internal.util.dp

/**
 * Branded loading affordance (Compose LogoSpinner, vertical): static logo inside
 * a Green500 circular progress ring (55dp ring / 32dp logo) + label below.
 *
 * **The ring and the glyph share one colour**, which is the app's contract: `LogoSpinner` takes a
 * single `spinnerColor` (defaulting to Green500) and applies it to the `CircularProgressIndicator`
 * AND to the logo as `ColorFilter.tint` (`LogoSpinner.kt:186`). This port previously tinted the
 * glyph `foreground_primary`, so the flower rendered **black** inside a green arc — the gap
 * recorded in docs/04. Both now resolve through [FcTokens.accent], which also makes the spinner
 * follow a host `brandAccent` override instead of being pinned to the built-in green.
 *
 * The label is a [ShimmerTextView] and **sweeps only in the horizontal variant**. That is the
 * app's split: `LogoSpinner.kt` renders the full-screen loader's label as a plain `Text`, while
 * `LogoSpinnerHorizontal.kt:219` renders the in-thread stream status through `ShimmerText`. The
 * SDK folded the two components into one [horizontal] flag and lost the sweep with them — the
 * other half of the docs/04 gap. Both use the same size and weight; the sweep is the only
 * difference, so the "bold" in that gap's description was wrong.
 */
internal class LogoSpinnerView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : LinearLayout(context, attrs) {

    /** App parity: one colour for the arc and the flower inside it. */
    private val spinnerColor = FcTokens.accent(context)

    // Material Components' indicator, not the platform ProgressBar: it is the same indeterminate
    // arc motion as the app's Compose `CircularProgressIndicator(strokeWidth = 2.5.dp)`, where
    // the platform spinner drew a thicker ring with a different rhythm.
    private val ring = com.google.android.material.progressindicator.CircularProgressIndicator(context).apply {
        isIndeterminate = true
        setIndicatorColor(spinnerColor)
        trackColor = android.graphics.Color.TRANSPARENT
        trackThickness = (2.5f * resources.displayMetrics.density).toInt()
    }
    private val logo = ImageView(context).apply {
        setImageResource(FcViewTheme.hostTheme()?.logo ?: R.drawable.fc_logo_mark)
        setColorFilter(spinnerColor)
    }
    private val label = ShimmerTextView(context).apply {
        setTextColor(FcTokens.color(context, R.color.fc_foreground_primary))
        baseColor = FcTokens.color(context, R.color.fc_foreground_primary)
        textSize = 15f
        // labelMedium is w600 (theme/Type.kt); this rendered at 400.
        typeface = if (android.os.Build.VERSION.SDK_INT >= 28) {
            android.graphics.Typeface.create(android.graphics.Typeface.SANS_SERIF, 600, false)
        } else {
            android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
        }
        gravity = Gravity.CENTER
        visibility = GONE
        // App/Compose `ShimmerText` default. The ShimmerTextView default of 2250ms is the
        // COMPOSER placeholder's slower period, not this one.
        durationMs = 1200
        shimmerEnabled = false
    }

    private val box = FrameLayout(context)

    /** App LogoWithSpinner: every 3s the mark turns 360° over 600ms, ease-out. */
    private val spin = object : Runnable {
        override fun run() {
            logo.animate().rotationBy(360f).setDuration(600)
                .setInterpolator(android.view.animation.DecelerateInterpolator()).start()
            postDelayed(this, 3600)
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        removeCallbacks(spin)
        postDelayed(spin, 3000)
    }

    override fun onDetachedFromWindow() {
        removeCallbacks(spin)
        logo.animate().cancel()
        super.onDetachedFromWindow()
    }

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

        ring.indicatorSize = ringSize
        ring.layoutParams = FrameLayout.LayoutParams(ringSize, ringSize, Gravity.CENTER)
        logo.layoutParams = FrameLayout.LayoutParams(logoSize, logoSize, Gravity.CENTER)
        box.layoutParams = LayoutParams(ringSize, ringSize)
        label.gravity = if (horizontal) Gravity.START or Gravity.CENTER_VERTICAL else Gravity.CENTER
        label.shimmerEnabled = horizontal
        label.layoutParams =
            LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
                if (horizontal) marginStart = gap else topMargin = gap
            }
        requestLayout()
    }

    var text: CharSequence
        get() = label.text
        set(value) {
            // setShimmerText re-measures the sweep for the new string; a bare `text =` would keep
            // a shader sized for the previous status, and tool statuses change constantly.
            label.setShimmerText(value.toString())
            label.visibility = if (value.isBlank()) GONE else VISIBLE
        }
}
