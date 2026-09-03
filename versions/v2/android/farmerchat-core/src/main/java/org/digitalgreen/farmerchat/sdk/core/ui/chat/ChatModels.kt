package org.digitalgreen.farmerchat.sdk.core.ui.chat

import android.net.Uri

/** Where the chat screen was entered from. */
enum class ChatEntrySource {
    Home,
    History
}

/**
 * Represents a single message in the chat thread (port of app's ChatMessage).
 */
sealed class ChatMessage {
    abstract val id: String

    /**
     * User message — supports text, text with image, and text with audio.
     */
    data class UserMessage(
        val text: String,
        val imageUri: Uri? = null,
        val audioUri: Uri? = null,
        /**
         * When true, show [imageUri] as a 16:9 content banner (pre-generated Q with card
         * image, or history user_text with media URL). When false, show a 1:1 thumbnail.
         */
        val userBubbleImageWideBanner: Boolean = false,
        /** Persisted error state so a voice bubble keeps its error visual. */
        val isFailed: Boolean = false,
        override val id: String = java.util.UUID.randomUUID().toString()
    ) : ChatMessage()

    /**
     * AI response (from get_text_prompt or image_analysis).
     * @param messageId Server message_id; used for synthesise_audio (Listen).
     */
    data class AiResponse(
        val text: String,
        val followUpQuestions: List<String>? = null,
        override val id: String = java.util.UUID.randomUUID().toString(),
        /** Identifies pre-generated answers from the home screen. */
        val isPreGenerated: Boolean = false,
        val messageId: String? = null,
        // ---- agentic streaming (SDK 2.0.0, endpoint #27a). All default to the 1.0.0 behaviour,
        // so a synchronous answer is indistinguishable from before. ----
        /** True while the agentic stream is in progress; suppresses the action buttons. */
        val isStreaming: Boolean = false,
        /** Transient tool progress label (e.g. "Checking weather forecast") shown while streaming. */
        val streamingStatus: String? = null,
        /** True when this answer came from the agentic endpoint (drives follow-up chip styling). */
        val isAgentic: Boolean = false,
        /**
         * Terminal outcome of an agentic stream that did NOT complete normally. When true the
         * answer renders with an inline error and a retry action; [text] may still hold a
         * preserved partial answer, or be blank if the stream broke at the start. Always false
         * for a normally finalized answer.
         */
        val isInterrupted: Boolean = false,
        /** Why the stream ended early; only meaningful when [isInterrupted]. */
        val streamErrorKind: org.digitalgreen.farmerchat.sdk.core.model.StreamErrorKind? = null,
        // ---- alignment surfaces (2.0.0) ----
        /**
         * Non-null when this response is an alignment surface (clarify / confirm / escalate or a
         * capability prompt) rather than a normal answer. Drives the chip rendering and the urgent
         * (escalate) treatment in place of the usual action row.
         */
        val alignmentKind: org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind? = null,
        /** Quick-reply chips: label is shown, value is sent on tap. */
        val alignmentChips: List<org.digitalgreen.farmerchat.sdk.core.model.AlignmentChip>? = null,
        /**
         * The surface's own prompt message. For an EXCLUSIVE surface the prompt already lives in
         * [text] (it replaced the answer), so this stays null. For an ADDITIVE surface
         * ([AlignmentKind.isAdditive]) [text] holds the real answer and this carries the nudge
         * rendered below it.
         */
        val alignmentMessage: String? = null,
        /**
         * Chip values already tapped on this surface. Accumulates so every picked chip stays
         * highlighted and locked — each chip is clickable once — while the rest stay tappable.
         */
        val alignmentSelectedValues: List<String> = emptyList(),
        /**
         * The query that triggered this surface. Kept so a capability chip (e.g. "Share my
         * location") can re-send the user's real question once the capability is satisfied,
         * rather than sending the chip label as if it were the question.
         */
        val alignmentOriginalQuery: String? = null,
        /**
         * The surface's `blocking` flag (2.0.0, captured live 2026-09-03 — a `gps-prompt` sends
         * `blocking: true`, a `commodity-confirm` `false`). True means the backend needs this
         * answered before it can proceed, so the surface must NOT offer a way out: the flavours
         * suppress the "type instead" escape hatch on a blocking surface. Absent on the wire →
         * false, i.e. dismissible, which is the pre-2026-09-03 behaviour.
         */
        val alignmentBlocking: Boolean = false
    ) : ChatMessage()

    /**
     * The farmer's resolved location, shown in the thread in place of a text bubble once a
     * GPS_PROMPT alignment chip has been satisfied (2.0.0). Rendered by `LocationChatBubble`.
     */
    data class LocationMessage(
        val address: String,
        override val id: String = java.util.UUID.randomUUID().toString()
    ) : ChatMessage()

    /** Placeholder shown while waiting for the AI response. */
    data class LoadingPlaceholder(
        override val id: String = java.util.UUID.randomUUID().toString()
    ) : ChatMessage()
}

/**
 * Derived UI state for the chat screen (port of app's ChatUiState).
 */
sealed class ChatUiState {
    /** Initial loading — first question being processed. */
    data object Loading : ChatUiState()

    /** Thread with messages — isLoading true while awaiting the AI response. */
    data class Thread(
        val messages: List<ChatMessage>,
        val isLoading: Boolean = false
    ) : ChatUiState()

    data class Error(
        val message: String,
        val onRetry: () -> Unit,
        val questionText: String = "",
        val imageUri: Uri? = null,
        val audioUri: Uri? = null
    ) : ChatUiState()
}
