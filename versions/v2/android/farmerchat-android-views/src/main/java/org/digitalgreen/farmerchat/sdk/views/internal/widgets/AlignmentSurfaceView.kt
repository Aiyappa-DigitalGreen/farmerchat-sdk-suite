package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import org.digitalgreen.farmerchat.sdk.views.internal.util.Markdown
import android.content.Context
import android.graphics.Typeface
import android.util.AttributeSet
import android.view.Gravity
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.view.isVisible
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.AlignmentChip
import org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens
import org.digitalgreen.farmerchat.sdk.views.internal.util.dp

/**
 * A server-driven alignment surface (SDK 2.0.0) — the Views port of the Compose
 * `components/AlignmentSurface.kt`: a short prompt the farmer answers by tapping a chip instead of
 * reading a normal answer.
 *
 * Two shapes, decided by [AlignmentKind.isAdditive]:
 * - **Exclusive** (clarify / confirm / escalate / capability prompts) — owns the message area and
 *   replaces the answer, so it renders its own heading and, where appropriate, an escape hatch.
 * - **Additive** (gender-select / commodity-confirm) — a nudge BELOW a real answer, so it renders
 *   no heading and no escape hatch; the answer above already owns the action row.
 *
 * Escalate gets an urgent treatment derived from the SDK's feedback/fail color, keeping the card
 * coherent rather than dropping the brand accent onto a red surface.
 */
internal class AlignmentSurfaceView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : LinearLayout(context, attrs) {

    // App AlignmentSurface.kt: the prompt is MarkdownText at bodyMedium (17sp).
    private val messageView = TextView(context).apply {
        textSize = 17f
        setLineSpacing(4f * resources.displayMetrics.density, 1f)
        setTextColor(FcTokens.color(context, R.color.fc_foreground_primary))
    }
    private val headingView = TextView(context).apply {
        textSize = 18f // titleMedium
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        setTextColor(FcTokens.color(context, R.color.fc_foreground_primary))
    }
    private val chipsContainer = LinearLayout(context).apply { orientation = VERTICAL }

    /** Listen pill state for the live prompt (app AlignmentSurface.kt:245-258). */
    data class ListenState(
        val enabled: Boolean,
        val loading: Boolean,
        val playing: Boolean,
        val hasAudioUrl: Boolean,
        val onClick: () -> Unit
    )

    // App: a light Listen pill 16dp under the prompt — same pill as the answer's action row.
    private val listenPill = TextView(context, null, 0, R.style.FcChatAction).apply {
        layoutParams = android.widget.FrameLayout.LayoutParams(
            LayoutParams.WRAP_CONTENT, 42.dp(context)
        )
    }
    private val listenSpinner = android.widget.ProgressBar(context).apply {
        indeterminateTintList = android.content.res.ColorStateList.valueOf(FcTokens.accent(context))
        layoutParams = android.widget.FrameLayout.LayoutParams(20.dp(context), 20.dp(context)).apply {
            gravity = Gravity.START or Gravity.CENTER_VERTICAL
            marginStart = 12.dp(context)
        }
    }
    private val listenRow = android.widget.FrameLayout(context).apply {
        addView(listenPill)
        addView(listenSpinner)
    }

    // App progressRow: "Getting your location…" (LogoSpinnerHorizontal) 16dp under the options.
    private val progressRow = LogoSpinnerView(context).apply { horizontal = true }
    // Heading + chips. On a capability prompt (GPS / photo) the app wraps them in a bordered
    // card: 1dp borderDefault, radius 16, 16dp padding (AlignmentSurface.kt:264-271).
    private val optionsCard = LinearLayout(context).apply { orientation = VERTICAL }

    // Escape hatch: "Don't see your option? Type or say it."
    private val escapeIcon = ImageView(context).apply {
        setImageResource(R.drawable.fc_icon_info)
    }
    // App: ONE inline text — the hint, a space, then the action in SemiBold accent.
    private val escapePrompt = TextView(context).apply {
        textSize = 15f // bodySmall
        setTextColor(FcTokens.color(context, R.color.fc_foreground_secondary))
    }
    private val escapeRow = LinearLayout(context).apply {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
    }

    init {
        orientation = VERTICAL

        addView(messageView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
        addView(listenRow, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT))
        optionsCard.addView(headingView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
        optionsCard.addView(
            chipsContainer,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
        )
        addView(optionsCard, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
        addView(progressRow, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT))

        escapeRow.addView(escapeIcon, LayoutParams(16.dp(context), 16.dp(context)))
        escapeRow.addView(
            escapePrompt,
            LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
                marginStart = 6.dp(context)
            }
        )
        addView(escapeRow, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT))
    }

    /**
     * Applies the whole surface. Every slot is written on every call (including the `false` /
     * `null` branches) so a recycled row never keeps the previous surface's heading, chips,
     * escalate card or click listeners.
     *
     * @param additive true when rendering below a real answer; suppresses the heading and the
     *   escape hatch.
     */
    fun bind(
        kind: AlignmentKind,
        message: String,
        chips: List<AlignmentChip>,
        selectedValues: List<String>,
        isLoading: Boolean,
        isLatest: Boolean,
        additive: Boolean,
        /**
         * The surface's wire `blocking` flag (2.0.0): true withholds the escape hatch, because the
         * backend cannot proceed until this surface is answered. Live `gps-prompt` sends
         * `blocking: true`; absent on the wire → false, the pre-2026-09-03 behaviour.
         */
        blocking: Boolean = false,
        /** Listen pill for the live prompt; null = never shown (e.g. additive). */
        listen: ListenState? = null,
        /** Non-null while a location fetch started here runs ("Getting your location…"). */
        fetchingProgressLabel: String? = null,
        labelFor: (String, String) -> String,
        onChipClick: (AlignmentChip) -> Unit,
        onTypeInstead: () -> Unit
    ) {
        val isEscalate = kind == AlignmentKind.ESCALATE
        val isCapabilityPrompt =
            kind == AlignmentKind.GPS_PROMPT || kind == AlignmentKind.UPLOAD_PHOTO
        val hasPick = selectedValues.isNotEmpty()
        // App: an in-flight location fetch counts as loading — chips, escape hatch and the Listen
        // pill all wait for it.
        val effectiveLoading = isLoading || fetchingProgressLabel != null
        // Capability and additive surfaces are single-shot: one tap settles them, so every chip
        // locks. Clarify/confirm stay open so the farmer can pick a different option.
        val chipsLocked = (isCapabilityPrompt || additive) && hasPick

        // Urgent surfaces get a tinted, bordered card so they read differently at a glance.
        if (isEscalate) {
            val fail = FcTokens.fail(context)
            background = FcTokens.roundedRect(
                context,
                RADIUS_LG,
                FcTokens.withAlpha(fail, 0.08f),
                1f,
                FcTokens.withAlpha(fail, 0.16f)
            )
            val pad = 16.dp(context)
            setPadding(pad, pad, pad, pad)
        } else {
            background = null
            setPadding(0, 0, 0, 0)
        }

        // Prompt message.
        val showMessage = message.isNotBlank()
        messageView.isVisible = showMessage
        messageView.text = Markdown.render(message, resources.displayMetrics.density)

        // Heading — exclusive, non-urgent surfaces only.
        val showHeading = !isEscalate && !additive
        headingView.isVisible = showHeading
        if (showHeading) {
            headingView.text = when (kind) {
                AlignmentKind.GPS_PROMPT -> labelFor(Labels.SHARE_LOCATION_TITLE, "Share location")
                AlignmentKind.UPLOAD_PHOTO ->
                    labelFor(Labels.ADD_ONE_CLEAR_PHOTO, "Add one clear photo")
                AlignmentKind.CONFIRM -> labelFor(Labels.PLEASE_CONFIRM, "Please confirm")
                else -> labelFor(Labels.CHOOSE_ONE, "Choose one")
            }
        }

        // Listen pill: only while this is the live prompt (TTS reads the latest response), never
        // on the urgent surface or an additive nudge.
        val showListen = listen != null && !isEscalate && !additive && isLatest && !effectiveLoading
        listenRow.isVisible = showListen
        if (showListen && listen != null) {
            listenRow.topMarginPx = if (showMessage) 16.dp(context) else 0
            ListenPill.bind(
                pill = listenPill,
                spinner = listenSpinner,
                loading = listen.loading,
                playing = listen.playing,
                hasAudioUrl = listen.hasAudioUrl,
                enabled = listen.enabled,
                labelFor = labelFor,
                onClick = listen.onClick
            )
        }

        // The options block sits 16dp under the message on every surface (app :260), the
        // escalate and additive ones included.
        optionsCard.topMarginPx = if (showMessage || showListen) 16.dp(context) else 0
        if (isCapabilityPrompt) {
            optionsCard.background = FcTokens.roundedRect(
                context, RADIUS_LG, android.graphics.Color.TRANSPARENT,
                1f, FcTokens.color(context, R.color.fc_border_default)
            )
            val pad = 16.dp(context)
            optionsCard.setPadding(pad, pad, pad, pad)
        } else {
            optionsCard.background = null
            optionsCard.setPadding(0, 0, 0, 0)
        }

        // Chips.
        chipsContainer.isVisible = chips.isNotEmpty()
        chipsContainer.removeAllViews()
        chipsContainer.topMarginPx = if (showHeading) 16.dp(context) else 0
        chips.forEachIndexed { index, chip ->
            val isSelected =
                (!chip.value.isNullOrBlank() && selectedValues.contains(chip.value)) ||
                    (!chip.label.isNullOrBlank() && selectedValues.contains(chip.label))
            val tappable = !isSelected && !effectiveLoading && !chipsLocked
            // Once a pick exists the unpicked chips fade back to the quiet treatment, so the
            // chosen one reads as the answer rather than one of several live options.
            val chipType = when {
                isEscalate -> if (!hasPick || isSelected) {
                    AgenticChipView.Type.ESCALATE
                } else {
                    AgenticChipView.Type.SUGGESTED
                }
                !hasPick || isSelected -> AgenticChipView.Type.AGENTIC
                else -> AgenticChipView.Type.SUGGESTED
            }
            val chipView = AgenticChipView(context)
            chipView.bind(
                text = chip.label.orEmpty(),
                number = index + 1,
                type = chipType,
                enabled = tappable,
                selected = isSelected,
                onClick = { onChipClick(chip) }
            )
            chipsContainer.addView(
                chipView,
                LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
                    if (index > 0) topMargin = 8.dp(context)
                }
            )
        }

        bindProgress(fetchingProgressLabel)

        // Escape hatch: only on an open, exclusive, non-urgent surface that is still the latest.
        // Without it a farmer whose answer is not among the chips has no way forward.
        val showEscape = chips.isNotEmpty() && !isEscalate && !isCapabilityPrompt && !additive &&
            !hasPick && isLatest && !effectiveLoading && !blocking
        escapeRow.isVisible = showEscape
        if (showEscape) {
            val accent = FcTokens.accent(context)
            escapeIcon.setColorFilter(accent)
            val hint = labelFor(Labels.DONT_SEE_YOUR_OPTION, "Don't see your option?")
            val action = labelFor(Labels.TYPE_OR_SAY_IT, "Type or say it.")
            escapePrompt.text = android.text.SpannableStringBuilder(hint).append(' ').apply {
                val start = length
                append(action)
                setSpan(android.text.style.ForegroundColorSpan(accent), start, length, android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                setSpan(android.text.style.TypefaceSpan("sans-serif-medium"), start, length, android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
            escapeRow.setOnClickListener { onTypeInstead() }
            escapeRow.topMarginPx = 12.dp(context)
        } else {
            escapeRow.setOnClickListener(null)
        }
    }

    private fun bindProgress(label: String?) {
        progressRow.isVisible = label != null
        if (label != null) {
            progressRow.text = label
            progressRow.topMarginPx = 16.dp(context)
        }
    }

    /** Top margin on a direct child of this LinearLayout, in px. */
    private var android.view.View.topMarginPx: Int
        get() = (layoutParams as? MarginLayoutParams)?.topMargin ?: 0
        set(value) {
            val lp = layoutParams as? MarginLayoutParams ?: return
            if (lp.topMargin != value) {
                lp.topMargin = value
                layoutParams = lp
            }
        }

    private companion object {
        const val RADIUS_LG = 16f
    }
}
