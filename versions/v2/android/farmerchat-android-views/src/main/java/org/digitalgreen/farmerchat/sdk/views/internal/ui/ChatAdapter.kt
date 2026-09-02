package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import org.digitalgreen.farmerchat.sdk.FarmerChat
import androidx.core.view.isVisible
import androidx.recyclerview.widget.RecyclerView
import coil.load
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.AlignmentChip
import org.digitalgreen.farmerchat.sdk.core.model.StreamErrorKind
import org.digitalgreen.farmerchat.sdk.core.ui.chat.ChatMessage
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemChatAiBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemChatErrorBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemChatLoadingBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemChatUserBinding
import org.digitalgreen.farmerchat.sdk.views.internal.util.Markdown
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.PrimaryButtonView

/** Chat thread rows. */
internal sealed interface ChatRow {
    val key: String

    data class User(val message: ChatMessage.UserMessage) : ChatRow {
        override val key: String = "user_${message.id}"
    }

    data class Ai(
        val message: ChatMessage.AiResponse,
        val isLast: Boolean,
        val followUps: List<String>,
        val followUpIds: List<String?>,
        val clarificationRequired: Boolean,
        val showReadFullAdvice: Boolean,
        val showActions: Boolean,
        val isTtsEnabled: Boolean,
        val isAudioLoading: Boolean,
        val isAudioPlaying: Boolean,
        /**
         * `ChatState.isLoading` — an alignment surface locks its chips while another answer is in
         * flight (2.0.0 parity with the Compose `AlignmentSurface(isLoading = …)`).
         */
        val isStateLoading: Boolean = false
    ) : ChatRow {
        override val key: String = "ai_${message.id}"
    }

    data class Loading(val id: String) : ChatRow {
        override val key: String = "loading_$id"
    }

    data class InlineError(val message: String) : ChatRow {
        override val key: String = "error"
    }
}

internal class ChatAdapter(
    private val callbacks: Callbacks
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    internal interface Callbacks {
        fun labelFor(key: String, fallback: String): String
        fun onFollowUpClick(question: String, followUpQuestionId: String?)
        fun onReadFullAdvice(question: String)
        fun onShare(message: ChatMessage.AiResponse)
        fun onDownload(message: ChatMessage.AiResponse)
        fun onListen(message: ChatMessage.AiResponse)
        fun onRetry()

        // Agentic (2.0.0)
        /** A quick-reply chip on an alignment surface was tapped. */
        fun onAlignmentChipClick(chip: AlignmentChip)

        /** The alignment escape hatch ("Type or say it.") was tapped: focus the text input. */
        fun onTypeInstead()

        /** The streaming stall hint appeared/disappeared; re-render the thread. */
        fun onStallHintChanged()

        // Voice clip playback (user bubbles)
        fun isClipPlaying(messageId: String): Boolean
        fun clipProgress(messageId: String): Float
        fun clipDurationMs(message: ChatMessage.UserMessage): Long
        fun onClipPlayPause(message: ChatMessage.UserMessage)
    }

    private companion object {
        const val TYPE_USER = 0
        const val TYPE_AI = 1
        const val TYPE_LOADING = 2
        const val TYPE_ERROR = 3

        /**
         * How long a live stream may go without a new token, and without a tool status, before
         * the "Paused, resuming…" hint appears. Compose parity (ChatScreen PAUSE_HINT_DELAY_MS).
         */
        const val PAUSE_HINT_DELAY_MS = 4000L

        /** Marker payload for a token-level stream update — see [submit]. */
        val PAYLOAD_STREAM_TICK = Any()
    }

    var rows: List<ChatRow> = emptyList()
        private set

    fun submit(newRows: List<ChatRow>) {
        val previous = rows
        rows = newRows
        // 2.0.0: while a stream is live EVERY token produces a state emit. A full
        // notifyDataSetChanged() there re-renders every row — re-running Markdown, re-firing every
        // Coil image load and re-inflating every follow-up chip — which visibly flickers. When the
        // row list is structurally identical and the only row whose content changed is the
        // streaming answer, rebind just that row.
        val streamingIndex = onlyStreamingRowChanged(previous, newRows)
        if (streamingIndex != null) {
            // A non-empty payload makes DefaultItemAnimator reuse the holder instead of
            // cross-fading it, so the growing answer does not flicker on every token.
            notifyItemChanged(streamingIndex, PAYLOAD_STREAM_TICK)
        } else {
            notifyDataSetChanged()
        }
    }

    /**
     * Index of the single changed row when that row is a LIVE agentic stream and nothing else
     * moved, else null.
     *
     * Everything else must fall back to notifyDataSetChanged(), because rows deliberately carry
     * voice-clip playback state through [Callbacks] rather than through their own fields: the
     * clip ticker calls refreshRows() every 500 ms with a structurally EQUAL row list and relies
     * on the full rebind to advance the progress bar.
     */
    private fun onlyStreamingRowChanged(old: List<ChatRow>, new: List<ChatRow>): Int? {
        if (old.isEmpty() || old.size != new.size) return null
        var changed = -1
        for (i in old.indices) {
            val before = old[i]
            val after = new[i]
            if (before.key != after.key) return null
            if (before == after) continue
            if (changed >= 0) return null
            changed = i
        }
        if (changed < 0) return null
        val before = old[changed] as? ChatRow.Ai ?: return null
        val after = new[changed] as? ChatRow.Ai ?: return null
        // Only a stream that was and still is live qualifies; a start/finalize transition can
        // change how other rows render.
        if (!before.message.isStreaming || !after.message.isStreaming) return null
        return changed
    }

    // ------------------------------------------------------------------ stall hint (2.0.0)

    private val stallHandler = Handler(Looper.getMainLooper())

    /** "<messageId>:<textLength>" the pending/settled stall hint belongs to. */
    private var stallKey: String? = null
    private var stallVisible = false
    private val stallRunnable = Runnable {
        stallVisible = true
        callbacks.onStallHintChanged()
    }

    /**
     * Arms (or keeps) the stall timer for a live stream and reports whether the hint is due.
     *
     * The timer is keyed on the message id AND the text length, so the next token restarts it and
     * the hint clears on its own — a rebind that changes nothing leaves the pending timer alone.
     */
    private fun trackStall(message: ChatMessage.AiResponse): Boolean {
        val key = "${message.id}:${message.text.length}"
        if (key != stallKey) {
            stallKey = key
            stallVisible = false
            stallHandler.removeCallbacks(stallRunnable)
            stallHandler.postDelayed(stallRunnable, PAUSE_HINT_DELAY_MS)
        }
        return stallVisible
    }

    private fun clearStall() {
        if (stallKey == null && !stallVisible) return
        stallKey = null
        stallVisible = false
        stallHandler.removeCallbacks(stallRunnable)
    }

    override fun onDetachedFromRecyclerView(recyclerView: RecyclerView) {
        clearStall()
        super.onDetachedFromRecyclerView(recyclerView)
    }

    override fun getItemCount(): Int = rows.size

    override fun getItemViewType(position: Int): Int = when (rows[position]) {
        is ChatRow.User -> TYPE_USER
        is ChatRow.Ai -> TYPE_AI
        is ChatRow.Loading -> TYPE_LOADING
        is ChatRow.InlineError -> TYPE_ERROR
    }

    private class UserHolder(val binding: FcItemChatUserBinding) : RecyclerView.ViewHolder(binding.root)
    private class AiHolder(val binding: FcItemChatAiBinding) : RecyclerView.ViewHolder(binding.root)
    private class LoadingHolder(val binding: FcItemChatLoadingBinding) : RecyclerView.ViewHolder(binding.root)
    private class ErrorHolder(val binding: FcItemChatErrorBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return when (viewType) {
            TYPE_USER -> UserHolder(FcItemChatUserBinding.inflate(inflater, parent, false))
            TYPE_AI -> AiHolder(FcItemChatAiBinding.inflate(inflater, parent, false))
            TYPE_LOADING -> LoadingHolder(FcItemChatLoadingBinding.inflate(inflater, parent, false))
            else -> ErrorHolder(FcItemChatErrorBinding.inflate(inflater, parent, false))
        }
    }

    /**
     * Token-level stream updates arrive with [PAYLOAD_STREAM_TICK] (see [submit]). A full rebind is
     * exactly what is wanted — the payload only exists to stop the item animator cross-fading —
     * so this delegates, explicitly rather than through the base class.
     */
    override fun onBindViewHolder(
        holder: RecyclerView.ViewHolder,
        position: Int,
        payloads: MutableList<Any>
    ) {
        onBindViewHolder(holder, position)
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (val row = rows[position]) {
            is ChatRow.User -> bindUser(holder as UserHolder, row.message)
            is ChatRow.Ai -> bindAi(holder as AiHolder, row)
            is ChatRow.Loading -> {
                // App parity (ChatLoadingContent.kt -> LogoSpinnerHorizontal): the in-thread
                // answer loader is a compact horizontal spinner + label, not the tall
                // full-screen stack.
                (holder as LoadingHolder).binding.fcChatLoadingSpinner.apply {
                    horizontal = true
                    text = callbacks.labelFor(Labels.GETTING_YOUR_ANSWER, "Getting your answer…")
                }
            }
            is ChatRow.InlineError -> bindError(holder as ErrorHolder, row)
        }
    }

    private fun bindUser(holder: UserHolder, message: ChatMessage.UserMessage) {
        val b = holder.binding
        val wideBanner = message.userBubbleImageWideBanner && message.imageUri != null
        b.fcUserBanner.isVisible = wideBanner
        if (wideBanner) b.fcUserBanner.load(message.imageUri)

        val thumb = !wideBanner && message.imageUri != null
        b.fcUserThumb.isVisible = thumb
        if (thumb) b.fcUserThumb.load(message.imageUri)

        val hasVoice = message.audioUri != null
        b.fcUserVoice.isVisible = hasVoice
        if (hasVoice) {
            b.fcUserVoice.setPlaying(callbacks.isClipPlaying(message.id))
            b.fcUserVoice.setProgress(callbacks.clipProgress(message.id))
            b.fcUserVoice.setDurationMs(callbacks.clipDurationMs(message))
            b.fcUserVoice.onPlayPauseClick = { callbacks.onClipPlayPause(message) }
        }

        b.fcUserText.isVisible = message.text.isNotBlank()
        b.fcUserText.text = message.text
        b.fcUserBubble.background = ContextCompat.getDrawable(
            b.root.context,
            if (message.isFailed) R.drawable.fc_bg_user_bubble_failed else R.drawable.fc_bg_user_bubble
        )

        // Chat UI customization (null = XML/theme default). Applied per-bind so
        // recycled views stay consistent.
        val cfg = FarmerChat.requireGraph().config
        cfg.userBubbleTextColor?.let { b.fcUserText.setTextColor(it) }
        cfg.messageFontSizeSp?.let { b.fcUserText.setTextSize(TypedValue.COMPLEX_UNIT_SP, it) }
        if (!message.isFailed) {
            (b.fcUserBubble.background as? GradientDrawable)?.let { bg ->
                val d = bg.mutate() as GradientDrawable
                cfg.userBubbleColor?.let { d.setColor(it) }
                cfg.bubbleCornerRadius?.let { r ->
                    val density = b.root.resources.displayMetrics.density
                    val px = r * density
                    val sharp = 6f * density // keep the bottom-right tail
                    // order: top-left, top-right, bottom-right, bottom-left (x,y each)
                    d.cornerRadii = floatArrayOf(px, px, px, px, sharp, sharp, px, px)
                }
                b.fcUserBubble.background = d
            }
        }
    }

    private fun bindAi(holder: AiHolder, row: ChatRow.Ai) {
        val b = holder.binding
        val message = row.message
        val alignmentKind = message.alignmentKind
        // An EXCLUSIVE surface (clarify / confirm / escalate / capability prompt) owns the message
        // area: it replaces the answer, its action row and its related questions. An ADDITIVE one
        // falls through to the normal answer below and renders as a nudge under it.
        val exclusiveAlignment = alignmentKind != null && !alignmentKind.isAdditive

        if (exclusiveAlignment) {
            b.root.minimumHeight = 0
            b.fcAiAlignmentExclusive.isVisible = true
            b.fcAiAlignmentExclusive.bind(
                kind = alignmentKind,
                message = message.text,
                chips = message.alignmentChips.orEmpty(),
                selectedValues = message.alignmentSelectedValues,
                isLoading = row.isStateLoading,
                isLatest = row.isLast,
                additive = false,
                labelFor = callbacks::labelFor,
                onChipClick = { chip -> callbacks.onAlignmentChipClick(chip) },
                onTypeInstead = { callbacks.onTypeInstead() }
            )
            // Reset every other slot — a recycled holder must not keep a previous answer.
            b.fcAiText.isVisible = false
            b.fcAiStreamStatus.isVisible = false
            b.fcAiAlignmentAdditive.isVisible = false
            b.fcAiStreamError.isVisible = false
            b.fcAiReadFull.isVisible = false
            b.fcAiReadFull.setOnClickListener(null)
            b.fcAiActions.isVisible = false
            b.fcAiFollowUpLabel.isVisible = false
            b.fcAiFollowUps.isVisible = false
            b.fcAiFollowUps.removeAllViews()
            if (row.isLast) clearStall()
            return
        }
        b.fcAiAlignmentExclusive.isVisible = false

        // 2.0.0 agentic streaming: while a stream is live the answer grows in place, so reserve a
        // screen's height to pin the question at the top instead of letting the list clamp it
        // downward as text arrives. Also held for the interrupted state so the error card sits
        // near the top.
        b.root.minimumHeight = if (row.isLast && (message.isStreaming || message.isInterrupted)) {
            b.root.resources.displayMetrics.heightPixels
        } else {
            0
        }

        // A streaming answer is NOT animated: the text already arrives a token at a time, so it
        // simply grows in place (the Views flavour has no typewriter reveal to suppress).
        b.fcAiText.isVisible = message.text.isNotEmpty()
        b.fcAiText.text = Markdown.render(message.text)

        // Chat UI customization (null = XML/theme default).
        val cfg = FarmerChat.requireGraph().config
        cfg.aiBubbleTextColor?.let { b.fcAiText.setTextColor(it) }
        cfg.messageFontSizeSp?.let { b.fcAiText.setTextSize(TypedValue.COMPLEX_UNIT_SP, it) }

        // Tool progress, or the initial "getting your answer" state before any text arrived.
        val showToolProgress = message.isStreaming &&
            (message.text.isEmpty() || !message.streamingStatus.isNullOrBlank())
        // Text is flowing but has stalled with no tool status: a transient client-side hint, NOT a
        // failure state. Tracked only for the latest row so a rebind of an older answer cannot
        // cancel the live timer.
        val stallEligible = row.isLast && message.isStreaming &&
            message.text.isNotEmpty() && message.streamingStatus.isNullOrBlank()
        val showStall = if (stallEligible) {
            trackStall(message)
        } else {
            if (row.isLast) clearStall()
            false
        }
        // LogoSpinnerView.text only hides the LABEL when blank — the ring stays — so the spinner's
        // own visibility is what gates it.
        b.fcAiStreamStatus.isVisible = showToolProgress || showStall
        if (showToolProgress || showStall) {
            b.fcAiStreamStatus.horizontal = true
            b.fcAiStreamStatus.text = if (showToolProgress) {
                message.streamingStatus
                    ?: callbacks.labelFor(Labels.GETTING_YOUR_ANSWER, "Getting your answer…")
            } else {
                callbacks.labelFor(Labels.RESPONSE_PAUSED_RESUMING, "Paused, resuming…")
            }
        }

        // ADDITIVE surface: a nudge below the real answer (gender-select / commodity-confirm).
        // Single-tap; the answer above keeps its own action row.
        val additiveAlignment = alignmentKind != null && alignmentKind.isAdditive
        b.fcAiAlignmentAdditive.isVisible = additiveAlignment
        if (additiveAlignment) {
            b.fcAiAlignmentAdditive.bind(
                kind = alignmentKind,
                message = message.alignmentMessage.orEmpty(),
                chips = message.alignmentChips.orEmpty(),
                selectedValues = message.alignmentSelectedValues,
                isLoading = row.isStateLoading,
                isLatest = row.isLast,
                additive = true,
                labelFor = callbacks::labelFor,
                onChipClick = { chip -> callbacks.onAlignmentChipClick(chip) },
                onTypeInstead = {}
            )
        }

        // Interrupted terminal state: keep any partial answer above and offer retry. Only the
        // LATEST answer shows the card — an older failed question keeps its partial text but
        // drops the retry action.
        val showStreamError = message.isInterrupted && row.isLast
        b.fcAiStreamError.isVisible = showStreamError
        if (showStreamError) {
            b.fcAiStreamError.bind(
                errorKind = message.streamErrorKind ?: StreamErrorKind.UNKNOWN,
                hasPartial = message.text.isNotBlank(),
                labelFor = callbacks::labelFor,
                onRetry = { callbacks.onRetry() }
            )
        }

        b.fcAiReadFull.isVisible = row.showReadFullAdvice
        b.fcAiReadFull.text = callbacks.labelFor(Labels.READ_FULL_ADVICE, "Read full advice")
        b.fcAiReadFull.setOnClickListener { callbacks.onReadFullAdvice(row.message.text) }

        b.fcAiActions.isVisible = row.showActions
        if (row.showActions) {
            b.fcActionShare.text = callbacks.labelFor(Labels.SHARE_DOWNLOAD, "Share")
            b.fcActionShare.setOnClickListener { callbacks.onShare(row.message) }
            b.fcActionDownload.text = callbacks.labelFor(Labels.SAVE, "Save")
            b.fcActionDownload.setOnClickListener { callbacks.onDownload(row.message) }
            b.fcActionListen.isVisible = row.isTtsEnabled
            b.fcActionListenLoading.isVisible = row.isAudioLoading
            b.fcActionListen.text = callbacks.labelFor(Labels.LISTEN, "Listen")
            b.fcActionListen.setCompoundDrawablesRelativeWithIntrinsicBounds(
                if (row.isAudioPlaying) R.drawable.fc_ic_pause else R.drawable.fc_ic_play,
                0, 0, 0
            )
            b.fcActionListen.setOnClickListener { callbacks.onListen(row.message) }
        }

        val hasFollowUps = row.isLast && row.followUps.isNotEmpty()
        b.fcAiFollowUpLabel.isVisible = hasFollowUps
        b.fcAiFollowUps.isVisible = hasFollowUps
        b.fcAiFollowUps.removeAllViews()
        if (hasFollowUps) {
            b.fcAiFollowUpLabel.text = if (row.clarificationRequired) {
                callbacks.labelFor(
                    Labels.CHOOSE_A_FOLLOWUP_OPTION_BELOW, "Choose an option from the below"
                )
            } else {
                callbacks.labelFor(Labels.RELATED_QUESTIONS, "Related questions")
            }
            val inflater = LayoutInflater.from(b.root.context)
            row.followUps.forEachIndexed { index, question ->
                val suggested = org.digitalgreen.farmerchat.sdk.views.databinding
                    .FcItemSuggestedQuestionBinding.inflate(inflater, b.fcAiFollowUps, false)
                suggested.fcSuggestedText.text = question
                suggested.fcSuggestedAsk.text = callbacks.labelFor(Labels.ASK, "Ask")
                suggested.root.setOnClickListener {
                    callbacks.onFollowUpClick(question, row.followUpIds.getOrNull(index))
                }
                b.fcAiFollowUps.addView(suggested.root)
            }
        }
    }

    private fun bindError(holder: ErrorHolder, row: ChatRow.InlineError) {
        val b = holder.binding
        b.fcChatErrorText.text = row.message.ifBlank {
            callbacks.labelFor(Labels.SOMETHING_WENT_WRONG, "Something went wrong")
        }
        b.fcChatErrorRetry.text = callbacks.labelFor(Labels.TRY_AGAIN, "Try again")
        b.fcChatErrorRetry.state = PrimaryButtonView.State.DEFAULT
        b.fcChatErrorRetry.setOnClickListener { callbacks.onRetry() }
    }
}
