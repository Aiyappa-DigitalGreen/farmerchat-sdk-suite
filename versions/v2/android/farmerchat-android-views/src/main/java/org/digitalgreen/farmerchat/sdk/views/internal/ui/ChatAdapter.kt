package org.digitalgreen.farmerchat.sdk.views.internal.ui

import org.digitalgreen.farmerchat.sdk.views.internal.widgets.ListenPill
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.AlignmentSurfaceView
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.AgenticChipView
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
import org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind
import org.digitalgreen.farmerchat.sdk.core.model.StreamErrorKind
import org.digitalgreen.farmerchat.sdk.core.ui.chat.ChatMessage
import org.digitalgreen.farmerchat.sdk.core.ui.chat.holdsChatReserve
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemChatAiBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemChatErrorBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemChatLoadingBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemChatLocationBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemChatUserBinding
import org.digitalgreen.farmerchat.sdk.views.internal.util.Markdown
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.PrimaryButtonView
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.SweepBorderDrawable

/** Chat thread rows. */
internal sealed interface ChatRow {
    val key: String

    data class User(val message: ChatMessage.UserMessage) : ChatRow {
        override val key: String = "user_${message.id}"
    }

    /**
     * 2.0.0: the farmer's resolved location, standing in for the text bubble they would
     * otherwise have sent in reply to a GPS_PROMPT chip. Rendered by the dedicated
     * fc_item_chat_location bubble (Compose parity: components/LocationChatBubble.kt).
     */
    data class Location(val message: ChatMessage.LocationMessage) : ChatRow {
        override val key: String = "loc_${message.id}"
    }

    data class Ai(
        val message: ChatMessage.AiResponse,
        val isLast: Boolean,
        /** This answer is the thread's final row (nothing, e.g. a newer question, below it). */
        val isFinalRow: Boolean,
        val followUps: List<String>,
        val followUpIds: List<String?>,
        val clarificationRequired: Boolean,
        val showReadFullAdvice: Boolean,
        val showActions: Boolean,
        val isTtsEnabled: Boolean,
        val isAudioLoading: Boolean,
        val isAudioPlaying: Boolean,
        /** Synthesised audio is loaded (Listen shows the paused state when not playing). */
        val hasAudioUrl: Boolean = false,
        /** A location fetch started from this GPS prompt is in flight ("Getting your location…"). */
        val locationFetching: Boolean = false,
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
        /** [messageId] and [kind] are needed to route capability chips (gps-prompt / upload-photo). */
        fun onAlignmentChipClick(messageId: String, kind: AlignmentKind, chip: AlignmentChip)

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
        const val TYPE_LOCATION = 4

        /**
         * How long a live stream may go without a new token, and without a tool status, before
         * the "Paused, resuming…" hint appears. Compose parity (ChatScreen PAUSE_HINT_DELAY_MS).
         */
        const val PAUSE_HINT_DELAY_MS = 4000L

        /**
         * Related-questions fade duration. App parity: `fadeIn(tween(durationMillis = 300))`
         * in `ChatResponseActions.kt` (0456f364).
         */
        const val FOLLOW_UP_FADE_MS = 300L

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

    // -------------------------------------------------- related-questions fade (2.0.0)

    /**
     * Message ids whose related-questions block has already faded in.
     *
     * App parity (`ChatResponseActions.kt` 0456f364) fades the block once, on first composition,
     * via `remember { MutableTransitionState(false) }`. A RecyclerView has no equivalent:
     * `onBindViewHolder` runs again on every recycle, so an unguarded `animate()` would re-fade
     * the same block each time the farmer scrolled it back into view. This ledger makes the
     * animation fire exactly once per answer, which is what "on first composition" means here.
     */
    private val fadedFollowUps = mutableSetOf<String>()

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
        is ChatRow.Location -> TYPE_LOCATION
        is ChatRow.Ai -> TYPE_AI
        is ChatRow.Loading -> TYPE_LOADING
        is ChatRow.InlineError -> TYPE_ERROR
    }

    private class UserHolder(val binding: FcItemChatUserBinding) : RecyclerView.ViewHolder(binding.root)
    private class LocationHolder(val binding: FcItemChatLocationBinding) :
        RecyclerView.ViewHolder(binding.root)
    private class AiHolder(val binding: FcItemChatAiBinding) : RecyclerView.ViewHolder(binding.root)
    private class LoadingHolder(val binding: FcItemChatLoadingBinding) : RecyclerView.ViewHolder(binding.root)
    private class ErrorHolder(val binding: FcItemChatErrorBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return when (viewType) {
            TYPE_USER -> UserHolder(FcItemChatUserBinding.inflate(inflater, parent, false))
            TYPE_LOCATION ->
                LocationHolder(FcItemChatLocationBinding.inflate(inflater, parent, false))
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
            is ChatRow.Location -> bindLocation(holder as LocationHolder, row.message)
            is ChatRow.Ai -> bindAi(holder as AiHolder, row)
            is ChatRow.Loading -> {
                // App parity (ChatLoadingContent.kt -> LogoSpinnerHorizontal): the in-thread
                // answer loader is a compact horizontal spinner + label, not the tall
                // full-screen stack.
                val loading = holder as LoadingHolder
                loading.binding.fcChatLoadingSpinner.apply {
                    horizontal = true
                    text = callbacks.labelFor(Labels.GETTING_YOUR_ANSWER, "Getting your answer…")
                }
                // App ChatThreadContent.kt:623: the placeholder fills the viewport
                // (fillParentMaxHeight), which is what lets the just-sent question pin to the top.
                loading.binding.root.minimumHeight = reserveHeightPx(loading.binding.root)
            }
            is ChatRow.InlineError -> {
                bindError(holder as ErrorHolder, row)
                // App ChatThreadContent.kt:338-347 (failReserveModifier): a failed question keeps
                // a viewport of space under it, so it stays pinned with the retry below.
                holder.itemView.minimumHeight = reserveHeightPx(holder.itemView)
            }
        }
    }

    /**
     * The location bubble (2.0.0). Compose parity: `LocationChatBubble` is a fixed 290x184 card,
     * so nothing here is size-dependent — only the label and the resolved address, plus the same
     * bubble-radius customization knob the user bubble honours (the bottom-right stays sharp).
     */
    private fun bindLocation(holder: LocationHolder, message: ChatMessage.LocationMessage) {
        val b = holder.binding
        b.fcLocationLabel.text = callbacks.labelFor(Labels.YOUR_LOCATION, "Your location:")
        b.fcLocationAddress.text = message.address

        val cfg = FarmerChat.requireGraph().config
        cfg.messageFontSizeSp?.let {
            b.fcLocationLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, it)
            b.fcLocationAddress.setTextSize(TypedValue.COMPLEX_UNIT_SP, it)
        }
        cfg.bubbleCornerRadius?.let { r ->
            (b.fcLocationBubble.background as? GradientDrawable)?.let { bg ->
                val d = bg.mutate() as GradientDrawable
                val px = r * b.root.resources.displayMetrics.density
                // order: top-left, top-right, bottom-right, bottom-left (x,y each)
                d.cornerRadii = floatArrayOf(px, px, px, px, 0f, 0f, px, px)
                b.fcLocationBubble.background = d
            }
        }
    }

    private fun bindUser(holder: UserHolder, message: ChatMessage.UserMessage) {
        val b = holder.binding
        val density = b.root.resources.displayMetrics.density
        val hasImage = message.imageUri != null
        // App UserChatBubble.kt: a photo with no caption and no voice is shown bare, no bubble.
        val imageOnly = hasImage && message.text.isBlank() && message.audioUri == null
        b.fcUserImageOnly.isVisible = imageOnly
        b.fcUserBubble.isVisible = !imageOnly
        if (imageOnly) {
            b.fcUserImageOnly.clipToOutline = true
            b.fcUserImageOnly.load(message.imageUri) { crossfade(true) }
        }

        // Wide banner: inside the bubble, which then takes its full 290dp so the 16:9 photo
        // spans it (app: bubble widthIn(max = 290), image fillMaxWidth).
        val wideBanner = !imageOnly && message.userBubbleImageWideBanner && hasImage
        b.fcUserBanner.isVisible = wideBanner
        b.fcUserBubble.layoutParams = b.fcUserBubble.layoutParams.apply {
            width = if (wideBanner) (290 * density).toInt() else ViewGroup.LayoutParams.WRAP_CONTENT
        }
        if (wideBanner) {
            val inner = ((290 - 2 * 16) * density).toInt()
            b.fcUserBanner.layoutParams = b.fcUserBanner.layoutParams.apply { height = inner * 9 / 16 }
            b.fcUserBanner.clipToOutline = true
            b.fcUserBanner.load(message.imageUri) { crossfade(true) }
        }

        val thumb = !imageOnly && !wideBanner && hasImage
        b.fcUserThumb.isVisible = thumb
        if (thumb) {
            b.fcUserThumb.clipToOutline = true
            b.fcUserThumb.load(message.imageUri) { crossfade(true) }
        }

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

    /**
     * Height reserved below the pinned question for the last response, in px.
     *
     * App parity (fc-compose-agentic ChatThreadContent.kt, commit 9023b57f) and Compose parity
     * (`ChatScreen.kt` `reserveHeightDp`): measure the LIST's viewport, not the display. The
     * display height ignores the app bar, the composer and the system bars, so it over-reserves
     * by exactly that much and leaves a band of scrollable empty space under a finished answer.
     * Falls back to the display height on the first bind, before the RecyclerView is measured.
     */
    private fun reserveHeightPx(itemRoot: android.view.View): Int {
        val viewport = (itemRoot.parent as? android.view.View)?.height ?: 0
        return if (viewport > 0) viewport else itemRoot.resources.displayMetrics.heightPixels
    }

    /**
     * Whether this row is the one holding the reserve.
     *
     * The rule itself lives in core (`ui/chat/ChatReserve.kt`) so this flavour and Compose cannot
     * drift on it; `ChatFragment`'s scroll anchor calls this too, so all three read one predicate.
     */
    internal fun holdsReserve(row: ChatRow.Ai): Boolean =
        row.message.holdsChatReserve(
            // Newest answer AND final row: see the isLastResponse KDoc in core ChatReserve.kt.
            isLastResponse = row.isLast && row.isFinalRow,
            isLoading = row.isStateLoading
        )

    private fun bindAi(holder: AiHolder, row: ChatRow.Ai) {
        val b = holder.binding
        val message = row.message
        val alignmentKind = message.alignmentKind
        // An EXCLUSIVE surface (clarify / confirm / escalate / capability prompt) owns the message
        // area: it replaces the answer, its action row and its related questions. An ADDITIVE one
        // falls through to the normal answer below and renders as a nudge under it.
        val exclusiveAlignment = alignmentKind != null && !alignmentKind.isAdditive

        if (exclusiveAlignment) {
            // Compose wraps the exclusive surface in the SAME `streamReserve` as an answer, and
            // so does the app (its `streamReserveModifier` Column encloses the alignment branch).
            // Views used to zero the reserve here, so the instant an exclusive surface replaced a
            // streamed answer the reserved screen-height vanished and the whole thread collapsed
            // upward — the streamed text and the chips that follow it read as two separate jumps
            // instead of one continuous flow. Recorded in docs/04.
            b.root.minimumHeight = if (holdsReserve(row)) reserveHeightPx(b.root) else 0
            b.fcAiAlignmentExclusive.isVisible = true
            b.fcAiAlignmentExclusive.bind(
                kind = alignmentKind,
                message = message.text,
                chips = message.alignmentChips.orEmpty(),
                selectedValues = message.alignmentSelectedValues,
                isLoading = row.isStateLoading,
                isLatest = row.isLast,
                additive = false,
                blocking = message.alignmentBlocking,
                listen = AlignmentSurfaceView.ListenState(
                    enabled = row.isTtsEnabled,
                    loading = row.isAudioLoading,
                    playing = row.isAudioPlaying,
                    hasAudioUrl = row.hasAudioUrl,
                    onClick = { callbacks.onListen(message) }
                ),
                fetchingProgressLabel = if (row.locationFetching) {
                    callbacks.labelFor(Labels.GETTING_YOUR_LOCATION, "Getting your location…")
                } else null,
                labelFor = callbacks::labelFor,
                onChipClick = { chip -> callbacks.onAlignmentChipClick(message.id, alignmentKind, chip) },
                onTypeInstead = { callbacks.onTypeInstead() }
            )
            // Reset every other slot — a recycled holder must not keep a previous answer.
            b.fcAiText.isVisible = false
            b.fcAiStreamStatus.isVisible = false
            b.fcAiAlignmentAdditive.isVisible = false
            b.fcAiStreamError.isVisible = false
            b.fcAiReadFull.isVisible = false
            b.fcAiReadFull.setOnClickListener(null)
            b.fcAiWarning.isVisible = false
            b.fcAiActions.isVisible = false
            b.fcAiFollowUpLabel.isVisible = false
            b.fcAiFollowUps.isVisible = false
            b.fcAiFollowUps.removeAllViews()
            resetFollowUpFade(b.fcAiFollowUpLabel, b.fcAiFollowUps)
            if (row.isLast) clearStall()
            return
        }
        b.fcAiAlignmentExclusive.isVisible = false

        // The last response reserves at least a viewport of height below the pinned question, so
        // the question stays at the top and the answer grows into the space beneath it instead of
        // the list clamping and dragging the question back toward the centre. See [holdsReserve]
        // for which rows hold it and [reserveHeightPx] for why it is the list's height, not the
        // display's.
        b.root.minimumHeight = if (holdsReserve(row)) reserveHeightPx(b.root) else 0

        // A streaming answer is NOT animated: the text already arrives a token at a time, so it
        // simply grows in place (the Views flavour has no typewriter reveal to suppress).
        b.fcAiText.isVisible = message.text.isNotEmpty()
        b.fcAiText.text =
            Markdown.render(message.text, b.root.resources.displayMetrics.density)

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
        // App parity (ChatThreadContent.kt:598): only once the message stops streaming, 16dp below.
        val additiveAlignment = alignmentKind != null && alignmentKind.isAdditive && !message.isStreaming
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
                onChipClick = { chip -> callbacks.onAlignmentChipClick(message.id, alignmentKind, chip) },
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

        // App parity (ChatResponseActions.kt:89): the branches are EXCLUSIVE. A pre-generated
        // answer whose full advice was not yet requested shows ONLY "Read full advice" — no note,
        // no Share/Listen. The app renders the whole block only under the latest settled answer
        // (ChatThreadContent.kt:566 `isLastResponse && !isLoading`), hence the showActions gate.
        val readFull = row.showActions && row.showReadFullAdvice
        b.fcAiReadFull.isVisible = readFull
        b.fcAiReadFull.text = callbacks.labelFor(Labels.READ_FULL_ADVICE, "Read full advice")
        b.fcAiReadFull.setOnClickListener { callbacks.onReadFullAdvice(row.message.text) }

        // App parity (ChatThreadContent.kt:584 `useChips = true`): EVERY answer — agentic, legacy
        // #27 and pre-generated — gets the agentic row: accuracy note above, then Share (accent
        // sweep border) then Listen, and NO Save.
        val showActionRow = row.showActions && !readFull

        b.fcAiWarning.isVisible = showActionRow
        if (showActionRow) {
            b.fcAiWarningText.text = callbacks.labelFor(
                Labels.AI_MAY_BE_WRONG_PLEASE_DOUBLE_CHECK,
                "AI may be wrong. Please double-check."
            )
        }

        b.fcAiActions.isVisible = showActionRow
        if (showActionRow) {
            b.fcActionShare.text = callbacks.labelFor(Labels.SHARE_DOWNLOAD, "Share")
            b.fcActionShare.setOnClickListener { callbacks.onShare(row.message) }
            val shareCtx = b.fcActionShare.context
            b.fcActionShare.background = SweepBorderDrawable(
                fillColor = FcTokens.color(shareCtx, R.color.fc_surface_reading_secondary),
                green = FcTokens.accent(shareCtx),
                cyan = FcTokens.color(shareCtx, R.color.fc_cyan400),
                yellow = FcTokens.color(shareCtx, R.color.fc_yellow300),
                strokeWidthPx = 3f * shareCtx.resources.displayMetrics.density,
                cornerRadiusPx = 100f * shareCtx.resources.displayMetrics.density,
            )
            // Save is absent from the agentic row in the app.
            b.fcActionDownload.isVisible = false
            // App parity (ChatResponseActions.kt:131): Listen is always drawn; with TTS off
            // ListenPill dims it to 40% and drops its taps rather than hiding it.
            b.fcActionListen.isVisible = true
            ListenPill.bind(
                pill = b.fcActionListen,
                spinner = b.fcActionListenLoading,
                loading = row.isAudioLoading,
                playing = row.isAudioPlaying,
                hasAudioUrl = row.hasAudioUrl,
                enabled = row.isTtsEnabled,
                labelFor = callbacks::labelFor,
                onClick = { callbacks.onListen(row.message) }
            )
            // App ActionButton.kt: 23dp icons (the drawables are 24dp intrinsically).
            b.fcActionShare.setCompoundDrawablesRelative(ListenPill.icon(b.fcActionShare, R.drawable.fc_icon_share), null, null, null)
        }

        // App ChatThreadContent.kt:587: an additive nudge WITH chips below the answer replaces the
        // related questions (its chips are the way forward).
        val additiveWithChips = row.message.alignmentKind?.isAdditive == true &&
            !row.message.alignmentChips.isNullOrEmpty()
        val hasFollowUps = row.isLast && row.followUps.isNotEmpty() && !additiveWithChips
        b.fcAiFollowUpLabel.isVisible = hasFollowUps
        b.fcAiFollowUps.isVisible = hasFollowUps
        b.fcAiFollowUps.removeAllViews()
        resetFollowUpFade(b.fcAiFollowUpLabel, b.fcAiFollowUps)
        if (hasFollowUps) {
            b.fcAiFollowUpLabel.text = if (row.clarificationRequired) {
                callbacks.labelFor(
                    Labels.CHOOSE_A_FOLLOWUP_OPTION_BELOW, "Choose an option from the below"
                )
            } else {
                callbacks.labelFor(Labels.RELATED_QUESTIONS, "You can also ask")
            }
            val density = b.root.resources.displayMetrics.density
            row.followUps.forEachIndexed { index, question ->
                val onPick = { callbacks.onFollowUpClick(question, row.followUpIds.getOrNull(index)) }
                // App ChatResponseActions.kt:228-265: numbered chips for every answer (Suggested;
                // Agentic when clarification is required), 8dp apart — never SuggestedCards.
                val chip = AgenticChipView(b.root.context)
                chip.bind(
                    text = question,
                    number = index + 1,
                    type = if (row.clarificationRequired) AgenticChipView.Type.AGENTIC
                    else AgenticChipView.Type.SUGGESTED,
                    enabled = true,
                    selected = false,
                    onClick = onPick
                )
                chip.layoutParams = android.widget.LinearLayout.LayoutParams(
                    android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                    android.view.ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply { if (index > 0) topMargin = (8 * density).toInt() }
                b.fcAiFollowUps.addView(chip)
            }
            // Header: titleMedium 18sp bold, foregroundPrimary; 10dp to the list.
            b.fcAiFollowUpLabel.textSize = 18f
            b.fcAiFollowUpLabel.setTextColor(FcTokens.color(b.root.context, R.color.fc_foreground_primary))
            // App ChatResponseActions.kt: after "Read full advice" comes Spacer 16, after the
            // agentic row Spacer 1; then the follow-up block's own Spacer 16.
            (b.fcAiFollowUpLabel.layoutParams as android.view.ViewGroup.MarginLayoutParams).topMargin =
                ((if (readFull) 16 + 16 else 1 + 16) * density).toInt()
            (b.fcAiFollowUps.layoutParams as android.view.ViewGroup.MarginLayoutParams).apply {
                topMargin = (10 * density).toInt()
                bottomMargin = (40 * density).toInt() // app: 28dp + 12dp spacers after the list
            }
            // App parity (ChatResponseActions.kt 0456f364): ease the whole related-questions
            // block in over 300ms the first time it appears, instead of snapping in. Alpha only —
            // no translation or height animation — so the content around it does not shift.
            if (fadedFollowUps.add(row.message.id)) {
                for (view in arrayOf(b.fcAiFollowUpLabel, b.fcAiFollowUps)) {
                    view.alpha = 0f
                    view.animate()
                        .alpha(1f)
                        .setDuration(FOLLOW_UP_FADE_MS)
                        .start()
                }
            }
        }
    }

    /** Stop any in-flight related-questions fade and restore full opacity. */
    private fun resetFollowUpFade(vararg views: android.view.View) {
        for (view in views) {
            view.animate().cancel()
            view.alpha = 1f
        }
    }

    /**
     * App parity (InlineErrorContent.kt): the row always reads the fixed SOMETHING_WENT_WRONG
     * label — never the raw error text — with a surfaceTertiary radius-12 "Try again" pill.
     * Colours resolve through FcTokens so a host theme / fc_* override applies.
     */
    private fun bindError(holder: ErrorHolder, row: ChatRow.InlineError) {
        val b = holder.binding
        val ctx = b.root.context
        b.fcChatErrorText.text = callbacks.labelFor(Labels.SOMETHING_WENT_WRONG, "Something went wrong")
        b.fcChatErrorText.setTextColor(FcTokens.color(ctx, R.color.fc_foreground_primary))
        b.fcChatErrorRetry.background =
            FcTokens.roundedRect(ctx, 12f, FcTokens.color(ctx, R.color.fc_surface_tertiary))
        b.fcChatErrorRetryIcon.setColorFilter(FcTokens.color(ctx, R.color.fc_foreground_primary))
        b.fcChatErrorRetryLabel.text = callbacks.labelFor(Labels.TRY_AGAIN, "Try again")
        b.fcChatErrorRetryLabel.setTextColor(FcTokens.color(ctx, R.color.fc_foreground_primary))
        b.fcChatErrorRetryLabel.typeface = if (android.os.Build.VERSION.SDK_INT >= 28) {
            android.graphics.Typeface.create(android.graphics.Typeface.SANS_SERIF, 600, false)
        } else {
            android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
        }
        b.fcChatErrorRetry.setOnClickListener { callbacks.onRetry() }
    }
}
