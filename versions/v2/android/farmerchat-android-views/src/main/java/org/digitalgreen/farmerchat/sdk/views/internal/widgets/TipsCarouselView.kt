package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import android.animation.Animator
import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.AttributeSet
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.View
import android.view.ViewGroup
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.LinearInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.graphics.drawable.DrawableCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.PagerSnapHelper
import androidx.recyclerview.widget.RecyclerView
import org.digitalgreen.farmerchat.sdk.core.labels.TipData
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens
import org.digitalgreen.farmerchat.sdk.views.internal.util.dp

/**
 * Bottom-anchored tip carousel shown for the whole answer-generation wait — the Views port of the
 * Compose `components/Tips.kt`, which itself ports the app's `components/Tips.kt` + `Tip.kt`.
 *
 * Structure, top to bottom: a 24dp fade from transparent into the reading surface, the tip pager,
 * a 14dp gap, and the page indicator, over 44dp of bottom padding.
 *
 * Two deliberate implementation differences from the Compose flavour, neither visible:
 *
 *  - **`RecyclerView` + [PagerSnapHelper] instead of `ViewPager2`.** ViewPager2 is not a
 *    dependency of this artifact and adding one would land in every host's dependency graph for
 *    a decoration. RecyclerView is already here for the chat list.
 *  - **The indicator is drawn in [TipIndicatorView.onDraw]** rather than assembled from views.
 *    The active dot's fill tracks the countdown to the next tip and so is repainted on every
 *    frame; a single drawing view avoids re-laying-out a row of dots at 60fps.
 *
 * The "infinite" loop is the app's trick: the adapter reports [VIRTUAL_PAGE_COUNT] items and maps
 * position to `position % tipCount`, starting in the middle, so the carousel can advance forever
 * in one direction without ever hitting an edge.
 */
internal class TipsCarouselView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : LinearLayout(context, attrs) {

    private companion object {
        const val TIP_DURATION_MS = 8000L
        const val TIP_SLIDE_DURATION_MS = 400L
        const val VIRTUAL_PAGE_COUNT = 10_000
        /** Off-page cards are dimmed to this, exactly as the Compose pager does. */
    }

    private val pager = RecyclerView(context)
    private val indicator = TipIndicatorView(context)
    private val fade = View(context)
    private val layoutManager = LinearLayoutManager(context, HORIZONTAL, false)

    private var tips: List<TipData> = emptyList()
    private var timer: ValueAnimator? = null
    private var currentPosition = 0

    init {
        orientation = VERTICAL
        // The carousel paints its own ground: it sits over the scrolling answer, so anything
        // showing through would read as a rendering bug rather than as transparency.
        val pageBg = FcTokens.color(context, R.color.fc_surface_reading)

        fade.background = GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(FcTokens.withAlpha(pageBg, 0f), pageBg)
        )
        addView(fade, LayoutParams(LayoutParams.MATCH_PARENT, 24.dp(context)))

        val body = LinearLayout(context).apply {
            orientation = VERTICAL
            setBackgroundColor(pageBg)
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(0, 0, 0, 44.dp(context))
        }

        pager.apply {
            this.layoutManager = this@TipsCarouselView.layoutManager
            // contentPadding = 24dp horizontal with page peeking, the Compose pager's
            // `contentPadding` + `pageSpacing`.
            clipToPadding = false
            setPadding(24.dp(context), 0, 24.dp(context), 0)
            // The carousel drives itself; a farmer waiting for an answer should not have to.
            isNestedScrollingEnabled = false
            overScrollMode = OVER_SCROLL_NEVER
            PagerSnapHelper().attachToRecyclerView(this)
            itemAnimator = null
        }
        body.addView(
            pager,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
        )

        body.addView(
            View(context),
            LayoutParams(LayoutParams.MATCH_PARENT, 14.dp(context))
        )

        body.addView(
            indicator,
            LayoutParams(LayoutParams.WRAP_CONTENT, 8.dp(context))
        )

        addView(body, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))

        // Swallow touches: the carousel is decoration over the answer area, and letting a drag
        // reach the chat list underneath would scroll a list the farmer cannot see.
        isClickable = true
    }

    /**
     * Shows [newTips], restarting the rotation. Order is shuffled once per binding, as the app
     * does, so a farmer who asks several questions does not read the same tip first every time.
     */
    fun bind(newTips: List<TipData>) {
        if (newTips.isEmpty()) {
            stop()
            return
        }
        val shuffled = newTips.shuffled()
        val sameContent = shuffled.size == tips.size && shuffled.toSet() == tips.toSet()
        if (sameContent && timer?.isRunning == true) return

        tips = shuffled
        indicator.pageCount = tips.size
        indicator.currentPage = 0
        pager.adapter = TipAdapter(tips)
        currentPosition = (VIRTUAL_PAGE_COUNT / 2).let { mid -> mid - (mid % tips.size) }
        layoutManager.scrollToPosition(currentPosition)
        startTimer()
    }

    private fun startTimer() {
        stopTimer()
        if (tips.isEmpty()) return
        timer = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = TIP_DURATION_MS
            interpolator = LinearInterpolator()
            repeatCount = ValueAnimator.INFINITE
            addUpdateListener {
                indicator.progress = it.animatedValue as Float
            }
            addListener(object : android.animation.AnimatorListenerAdapter() {
                override fun onAnimationRepeat(animation: Animator) {
                    advance()
                }
            })
            start()
        }
    }

    private fun advance() {
        if (tips.isEmpty()) return
        currentPosition += 1
        indicator.currentPage = currentPosition % tips.size
        pager.smoothScrollToPosition(currentPosition)
        // Haptic after the tip lands, matching the Compose `CLOCK_TICK` on page settle.
        postDelayed({
            performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
            wobbleCurrentIcon()
        }, TIP_SLIDE_DURATION_MS)
    }

    private fun wobbleCurrentIcon() {
        val holder = pager.findViewHolderForAdapterPosition(currentPosition) as? TipViewHolder
        holder?.wobbleIcon()
    }

    private fun stopTimer() {
        timer?.cancel()
        timer = null
    }

    /** Stops the rotation; safe to call when already stopped. */
    fun stop() {
        stopTimer()
        indicator.progress = 0f
    }

    override fun onDetachedFromWindow() {
        stopTimer()
        super.onDetachedFromWindow()
    }

    override fun onVisibilityAggregated(isVisible: Boolean) {
        super.onVisibilityAggregated(isVisible)
        if (isVisible && tips.isNotEmpty()) {
            if (timer?.isRunning != true) startTimer()
        } else {
            stopTimer()
        }
    }

    // ---------------------------------------------------------------- adapter

    private inner class TipAdapter(private val data: List<TipData>) :
        RecyclerView.Adapter<TipViewHolder>() {

        override fun getItemCount(): Int = VIRTUAL_PAGE_COUNT

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TipViewHolder =
            TipViewHolder(TipCardView(parent.context))

        override fun onBindViewHolder(holder: TipViewHolder, position: Int) {
            holder.bind(data[position % data.size])
            // Keep every card fully opaque so the peeking side cards are the same color as the
            // active one (no dimmed/inactive look) — app parity, Tips.kt @ 40b12a24.
            holder.itemView.alpha = 1f
        }
    }

    private inner class TipViewHolder(private val card: TipCardView) :
        RecyclerView.ViewHolder(card) {

        init {
            // Each page is the pager's width minus the 24dp content padding on both sides,
            // with the 8dp page spacing carried as a trailing margin.
            card.layoutParams = RecyclerView.LayoutParams(
                RecyclerView.LayoutParams.MATCH_PARENT,
                RecyclerView.LayoutParams.WRAP_CONTENT
            ).apply { marginEnd = 8.dp(context) }
        }

        fun bind(tip: TipData) = card.bind(tip)

        fun wobbleIcon() = card.wobbleIcon()
    }

    // ---------------------------------------------------------------- the card

    /** One tip card — the Views port of the app's `components/Tip.kt`. */
    private class TipCardView(context: Context) : LinearLayout(context) {

        private val icon = ImageView(context)
        private val iconBox = FrameLayout(context)
        // App Tip.kt: title labelLarge (17/22 w600), body bodySmall (15/22 w400). These were
        // 14sp / 13sp — an older type scale — so every tip read visibly smaller than the app's.
        private val titleView = TextView(context).apply {
            textSize = 17f
            typeface = if (android.os.Build.VERSION.SDK_INT >= 28) {
                Typeface.create(Typeface.SANS_SERIF, 600, false)
            } else {
                Typeface.create("sans-serif-medium", Typeface.NORMAL)
            }
            includeFontPadding = false
            if (android.os.Build.VERSION.SDK_INT >= 28) lineHeight = (22 * resources.displayMetrics.scaledDensity).toInt()
        }
        private val bodyView = TextView(context).apply {
            textSize = 15f
            includeFontPadding = false
            if (android.os.Build.VERSION.SDK_INT >= 28) lineHeight = (22 * resources.displayMetrics.scaledDensity).toInt()
        }

        init {
            orientation = HORIZONTAL
            gravity = Gravity.TOP
            background = FcTokens.roundedRect(
                context,
                radiusDp = 16f, // Radius.LG
                // App parity (components/Tip.kt, 2026-09-15): the tip card is a dark-green
                // ground with white text, no longer the neutral surfaceActive.
                fill = FcTokens.color(context, R.color.fc_green800)
            )
            setPadding(20.dp(context), 16.dp(context), 20.dp(context), 16.dp(context))
            // App parity (components/Tip.kt 33837fc3 `heightIn(min = 104.dp)`): a fixed minimum
            // keeps every card uniform, so a single-line body no longer renders a shorter card
            // than a two-line one and the auto-advancing carousel doesn't jump. Longer bodies
            // still grow past 104dp rather than clip. `minimumHeight` is the Views equivalent —
            // it feeds getSuggestedMinimumHeight() and includes padding, exactly like the
            // Compose modifier's position ahead of .padding(). TipCardView keeps the default
            // LinearLayout onMeasure (the onMeasure override further down belongs to the
            // pagination indicator), so nothing overrides it.
            minimumHeight = 104.dp(context)

            val accent = FcTokens.accent(context)
            iconBox.background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(accent)
            }
            icon.setImageResource(R.drawable.fc_ic_lightbulb)
            DrawableCompat.setTint(icon.drawable.mutate(), FcTokens.onBrand(context))
            iconBox.addView(
                icon,
                FrameLayout.LayoutParams(18.dp(context), 18.dp(context)).apply {
                    gravity = Gravity.CENTER
                }
            )
            addView(iconBox, LayoutParams(36.dp(context), 36.dp(context)))
            addView(View(context), LayoutParams(12.dp(context), 1))

            val textColumn = LinearLayout(context).apply { orientation = VERTICAL }
            val fg = FcTokens.color(context, R.color.fc_white)
            titleView.setTextColor(fg)
            bodyView.setTextColor(fg)
            textColumn.addView(
                titleView,
                LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
            )
            textColumn.addView(
                View(context),
                LayoutParams(LayoutParams.MATCH_PARENT, 6.dp(context))
            )
            textColumn.addView(
                bodyView,
                LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
            )
            addView(
                textColumn,
                LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f)
            )
        }

        fun bind(tip: TipData) {
            titleView.text = tip.title
            bodyView.text = tip.body
        }

        /**
         * The app's `attentionWobble` on the bulb: a bounce, then a small rotation wobble.
         *
         * The app's gating (a Firebase kill-switch and a once-per-day budget spent on its home
         * cards) is not ported — see the Compose `AttentionWobble.kt` for why.
         */
        fun wobbleIcon() {
            val bounceDown = ObjectAnimator.ofFloat(iconBox, SCALE_X, 1f, 0.85f)
            val bounceDownY = ObjectAnimator.ofFloat(iconBox, SCALE_Y, 1f, 0.85f)
            val bounceUp = ObjectAnimator.ofFloat(iconBox, SCALE_X, 0.85f, 1f)
            val bounceUpY = ObjectAnimator.ofFloat(iconBox, SCALE_Y, 0.85f, 1f)
            val wobble = ObjectAnimator.ofFloat(iconBox, ROTATION, 0f, 3f, -3f, 0f, 3f, -3f, 0f)

            AnimatorSet().apply {
                play(bounceDown).with(bounceDownY)
                play(bounceUp).with(bounceUpY).after(bounceDown)
                play(wobble).after(bounceUp)
                bounceDown.duration = 90
                bounceUp.duration = 140
                bounceUp.interpolator = OvershootInterpolator(2.5f)
                wobble.duration = 480
                wobble.interpolator = AccelerateDecelerateInterpolator()
                start()
            }
        }
    }

    // ---------------------------------------------------------------- indicator

    /**
     * Dots for the inactive tips; the active one is a 24dp track whose fill tracks the countdown
     * to the next tip, so the carousel says "still working" rather than just "still here".
     */
    private class TipIndicatorView(context: Context) : View(context) {

        private val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = FcTokens.surfaceActive(context)
        }
        private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = FcTokens.accent(context)
        }
        private val rect = RectF()

        private val dot = 8f.dpF()
        private val gap = 10f.dpF()
        private val activeWidth = 24f.dpF()

        var pageCount: Int = 0
            set(value) {
                field = value
                requestLayout()
            }

        var currentPage: Int = 0
            set(value) {
                field = value
                invalidate()
            }

        var progress: Float = 0f
            set(value) {
                field = value.coerceIn(0f, 1f)
                invalidate()
            }

        private fun Float.dpF(): Float = this * context.resources.displayMetrics.density

        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
            if (pageCount <= 0) {
                setMeasuredDimension(0, 0)
                return
            }
            val width = (pageCount - 1) * (dot + gap) + activeWidth
            setMeasuredDimension(width.toInt(), dot.toInt())
        }

        override fun onDraw(canvas: Canvas) {
            if (pageCount <= 0) return
            var x = 0f
            for (index in 0 until pageCount) {
                if (index == currentPage) {
                    rect.set(x, 0f, x + activeWidth, dot)
                    canvas.drawRoundRect(rect, dot / 2f, dot / 2f, trackPaint)
                    if (progress > 0f) {
                        rect.set(x, 0f, x + activeWidth * progress, dot)
                        canvas.drawRoundRect(rect, dot / 2f, dot / 2f, fillPaint)
                    }
                    x += activeWidth + gap
                } else {
                    canvas.drawCircle(x + dot / 2f, dot / 2f, dot / 2f, trackPaint)
                    x += dot + gap
                }
            }
        }
    }
}
