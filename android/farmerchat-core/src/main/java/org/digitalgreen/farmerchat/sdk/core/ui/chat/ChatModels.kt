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
        val messageId: String? = null
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
