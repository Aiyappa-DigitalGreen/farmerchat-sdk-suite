package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import android.graphics.Typeface
import android.util.AttributeSet
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.view.isVisible
import androidx.core.widget.TextViewCompat
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens
import kotlin.math.max
import kotlin.math.min

/**
 * Empty-chat placeholder — SDK addition (2026-10-09), Views port of the compose
 * `ChatScreen.ChatEmptyState` and the web reference (`chatParts.tsx` `ChatEmptyState`, CSS
 * `.fcsdk-c-empty*`).
 *
 * A 64dp brand circle with the white logo mark and an 8dp 12%-brand halo, the tagline, the
 * get-started line, then Photo / Speak / Type pills (8dp apart, wrapping, each row centred).
 * Text and callbacks are supplied by the host fragment through [bind], so this view never looks
 * up labels or touches config itself. Colours resolve through [FcTokens] so a host theme applies.
 */
internal class ChatEmptyStateView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : LinearLayout(context, attrs) {

    private val density = resources.displayMetrics.density
    private fun dp(v: Float): Int = (v * density + 0.5f).toInt()

    private val brand = FcTokens.color(context, R.color.fc_brand_surface)

    private val mark = MarkView(context, brand)
    private val title = TextView(context).apply {
        gravity = Gravity.CENTER
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        setTextColor(FcTokens.color(context, R.color.fc_foreground_primary))
        TextViewCompat.setLineHeight(this, spPx(24f))
        maxWidth = dp(300f)
    }
    private val subtitle = TextView(context).apply {
        gravity = Gravity.CENTER
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
        setTextColor(FcTokens.color(context, R.color.fc_foreground_secondary))
        TextViewCompat.setLineHeight(this, spPx(20f))
        maxWidth = dp(280f)
    }
    private val pills = CenteredFlowLayout(context, gapPx = dp(8f))
    private val photoPill = pill(R.drawable.fc_icon_camera)
    private val speakPill = pill(R.drawable.fc_icon_mic)
    private val typePill = pill(R.drawable.fc_icon_keyboard)

    private fun spPx(sp: Float): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, sp, resources.displayMetrics).toInt()

    init {
        orientation = VERTICAL
        gravity = Gravity.CENTER
        setPadding(dp(32f), 0, dp(32f), 0)
        // Halo is drawn outside the mark's 64dp bounds (web box-shadow), so don't clip it.
        clipChildren = false
        clipToPadding = false

        // Gaps: 10dp between items, +6dp under the mark, +10dp above the pills.
        addView(mark, LayoutParams(dp(64f), dp(64f)).apply { bottomMargin = dp(16f) })
        addView(title, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT))
        addView(subtitle, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(10f)
        })
        addView(pills, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(20f)
        })
        pills.addView(photoPill.root)
        pills.addView(speakPill.root)
        pills.addView(typePill.root)
    }

    /**
     * Sets the copy and the pill actions. A null [onPhoto] / [onSpeak] hides that pill (the host
     * disabled images / voice in config).
     */
    fun bind(
        titleText: String,
        subtitleText: String,
        photoLabel: String,
        speakLabel: String,
        typeLabel: String,
        onPhoto: (() -> Unit)?,
        onSpeak: (() -> Unit)?,
        onType: () -> Unit
    ) {
        title.text = titleText
        subtitle.text = subtitleText
        photoPill.label.text = photoLabel
        speakPill.label.text = speakLabel
        typePill.label.text = typeLabel
        photoPill.root.isVisible = onPhoto != null
        speakPill.root.isVisible = onSpeak != null
        photoPill.root.setOnClickListener { onPhoto?.invoke() }
        speakPill.root.setOnClickListener { onSpeak?.invoke() }
        typePill.root.setOnClickListener { onType() }
    }

    /**
     * Shows/hides the placeholder. The 360ms fade + 6dp rise runs only on the hidden → shown
     * transition (callers re-apply on every state emission) and is skipped when the system has
     * animations turned off.
     */
    fun setShown(shown: Boolean) {
        if (shown == isVisible) return
        animate().cancel()
        isVisible = shown
        if (!shown) return
        if (ValueAnimator.areAnimatorsEnabled()) {
            alpha = 0f
            translationY = dp(6f).toFloat()
            animate().alpha(1f).translationY(0f).setDuration(360L).start()
        } else {
            alpha = 1f
            translationY = 0f
        }
    }

    private class Pill(val root: LinearLayout, val label: TextView)

    private fun pill(iconRes: Int): Pill {
        val root = LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(8f), 0, dp(14f), 0)
            background = FcTokens.roundedRect(
                context,
                radiusDp = 999f,
                fill = FcTokens.color(context, R.color.fc_surface_primary),
                strokeDp = 1f,
                strokeColor = FcTokens.color(context, R.color.fc_border_default)
            )
            isClickable = true
            isFocusable = true
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(40f))
        }
        val iconWrap = FrameLayout(context).apply {
            background = FcTokens.roundedRect(
                context, radiusDp = 14f, fill = FcTokens.withAlpha(brand, 0.12f)
            )
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        val icon = ImageView(context).apply {
            setImageResource(iconRes)
            setColorFilter(brand)
        }
        iconWrap.addView(icon, FrameLayout.LayoutParams(dp(20f), dp(20f), Gravity.CENTER))
        root.addView(iconWrap, LayoutParams(dp(28f), dp(28f)))
        val label = TextView(context).apply {
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            setTextColor(FcTokens.color(context, R.color.fc_foreground_primary))
            maxLines = 1
        }
        root.addView(label, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
            marginStart = dp(6f)
        })
        return Pill(root, label)
    }

    /**
     * The 64dp mark: brand circle with a radial highlight (web `radial-gradient(circle at 30% 25%,
     * #2BD46B, brand 70%)`), an 8dp halo at 12% brand OUTSIDE its bounds, and the white logo mark
     * (34dp) centred.
     */
    private class MarkView(context: Context, private val brand: Int) : View(context) {
        private val density = resources.displayMetrics.density
        private val halo = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = FcTokens.withAlpha(brand, 0.12f)
        }
        private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
        private val logo = androidx.core.content.ContextCompat
            .getDrawable(context, R.drawable.fc_logo_mark)?.mutate()?.apply { setTint(Color.WHITE) }

        init {
            importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        }

        override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
            fill.shader = RadialGradient(
                w * 0.30f, h * 0.25f, max(min(w, h).toFloat(), 1f),
                intArrayOf(Color.parseColor("#2BD46B"), brand, brand),
                floatArrayOf(0f, 0.7f, 1f),
                Shader.TileMode.CLAMP
            )
            val logoPx = (34 * density).toInt()
            val l = (w - logoPx) / 2
            val t = (h - logoPx) / 2
            logo?.setBounds(l, t, l + logoPx, t + logoPx)
        }

        override fun onDraw(canvas: Canvas) {
            val cx = width / 2f
            val cy = height / 2f
            val r = min(width, height) / 2f
            canvas.drawCircle(cx, cy, r + 8 * density, halo)
            canvas.drawCircle(cx, cy, r, fill)
            logo?.draw(canvas)
        }
    }

    /** Minimal flow layout: children left-to-right, wrapping, every row centred horizontally. */
    private class CenteredFlowLayout(context: Context, private val gapPx: Int) : ViewGroup(context) {

        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
            val maxWidth = MeasureSpec.getSize(widthMeasureSpec)
            val childSpecW = MeasureSpec.makeMeasureSpec(maxWidth, MeasureSpec.AT_MOST)
            var rowWidth = 0
            var rowHeight = 0
            var totalHeight = 0
            var widest = 0
            for (i in 0 until childCount) {
                val c = getChildAt(i)
                if (c.visibility == GONE) continue
                val lp = c.layoutParams
                val hSpec = if (lp.height > 0) {
                    MeasureSpec.makeMeasureSpec(lp.height, MeasureSpec.EXACTLY)
                } else MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)
                c.measure(childSpecW, hSpec)
                val add = if (rowWidth == 0) c.measuredWidth else gapPx + c.measuredWidth
                if (rowWidth > 0 && rowWidth + add > maxWidth) {
                    totalHeight += rowHeight + gapPx
                    widest = max(widest, rowWidth)
                    rowWidth = c.measuredWidth
                    rowHeight = c.measuredHeight
                } else {
                    rowWidth += add
                    rowHeight = max(rowHeight, c.measuredHeight)
                }
            }
            totalHeight += rowHeight
            widest = max(widest, rowWidth)
            val w = if (MeasureSpec.getMode(widthMeasureSpec) == MeasureSpec.EXACTLY) maxWidth else widest
            setMeasuredDimension(w, resolveSize(totalHeight, heightMeasureSpec))
        }

        override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
            val width = r - l
            val visible = (0 until childCount).map { getChildAt(it) }.filter { it.visibility != GONE }
            var y = 0
            var i = 0
            while (i < visible.size) {
                // Collect one row.
                var rowW = visible[i].measuredWidth
                var rowH = visible[i].measuredHeight
                var j = i + 1
                while (j < visible.size && rowW + gapPx + visible[j].measuredWidth <= width) {
                    rowW += gapPx + visible[j].measuredWidth
                    rowH = max(rowH, visible[j].measuredHeight)
                    j++
                }
                var x = (width - rowW) / 2
                if (layoutDirection == LAYOUT_DIRECTION_RTL) {
                    // Mirror the row order for RTL languages.
                    for (k in j - 1 downTo i) {
                        val c = visible[k]
                        c.layout(x, y + (rowH - c.measuredHeight) / 2, x + c.measuredWidth,
                            y + (rowH - c.measuredHeight) / 2 + c.measuredHeight)
                        x += c.measuredWidth + gapPx
                    }
                } else {
                    for (k in i until j) {
                        val c = visible[k]
                        c.layout(x, y + (rowH - c.measuredHeight) / 2, x + c.measuredWidth,
                            y + (rowH - c.measuredHeight) / 2 + c.measuredHeight)
                        x += c.measuredWidth + gapPx
                    }
                }
                y += rowH + gapPx
                i = j
            }
        }
    }
}
