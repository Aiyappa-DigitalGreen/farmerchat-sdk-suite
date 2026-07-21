package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import org.digitalgreen.farmerchat.sdk.FarmerChat
import androidx.core.view.isVisible
import androidx.recyclerview.widget.RecyclerView
import coil.load
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
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
        val isAudioPlaying: Boolean
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
    }

    var rows: List<ChatRow> = emptyList()
        private set

    fun submit(newRows: List<ChatRow>) {
        rows = newRows
        notifyDataSetChanged()
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

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (val row = rows[position]) {
            is ChatRow.User -> bindUser(holder as UserHolder, row.message)
            is ChatRow.Ai -> bindAi(holder as AiHolder, row)
            is ChatRow.Loading -> {
                (holder as LoadingHolder).binding.fcChatLoadingSpinner.text =
                    callbacks.labelFor(Labels.GETTING_YOUR_ANSWER, "Getting your answer…")
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
        b.fcAiText.text = Markdown.render(row.message.text)

        // Chat UI customization (null = XML/theme default).
        val cfg = FarmerChat.requireGraph().config
        cfg.aiBubbleTextColor?.let { b.fcAiText.setTextColor(it) }
        cfg.messageFontSizeSp?.let { b.fcAiText.setTextSize(TypedValue.COMPLEX_UNIT_SP, it) }

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
