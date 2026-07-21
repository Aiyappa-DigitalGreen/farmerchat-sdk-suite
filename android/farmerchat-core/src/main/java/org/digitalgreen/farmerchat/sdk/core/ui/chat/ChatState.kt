package org.digitalgreen.farmerchat.sdk.core.ui.chat

import org.digitalgreen.farmerchat.sdk.core.base.UiState

/**
 * State for the chat screen. 1:1 port of the app's ChatState.
 */
data class ChatState(
    val messages: List<ChatMessage> = emptyList(),

    /** Suggested follow-up questions (display text). */
    val suggestedQuestions: List<String>? = null,

    /** IDs for suggested questions, same order (from follow_up_questions API). */
    val suggestedQuestionIds: List<String>? = null,

    /**
     * True → "choose an option" label; false/null → "related questions" label.
     * Sourced from the follow_up_questions API response.
     */
    val clarificationRequired: Boolean = false,

    val chatResponseState: UiState<String> = UiState.Idle,

    /** Error message for the last failed message. */
    val errorMessage: String? = null,

    /** ID of the failed message (error shown inline). */
    val failedMessageId: String? = null,

    val isLoading: Boolean = false,

    /** synthesise_audio in progress (Listen button). */
    val isLoadingSynthesiseAudio: Boolean = false,

    /** Audio URL after synthesise_audio success; cleared when playback finishes. */
    val audioPlaybackUrl: String? = null,

    /** Whether synthesised audio is playing (only relevant when audioPlaybackUrl != null). */
    val isAudioPlaying: Boolean = false,

    /** Next history page to load when scrolled up (null when not history / no more pages). */
    val historyNextPage: Int? = null,

    /** True once the first page of history loaded (scroll to bottom once). */
    val isInitialHistoryLoaded: Boolean = false,

    /** When set, "Read full advice" is hidden for this AI message. */
    val readFullAdviceRequestedForMessageId: String? = null,

    /** Whether TTS is enabled for the current language (Listen button gate). */
    val isTtsEnabled: Boolean = true
)
