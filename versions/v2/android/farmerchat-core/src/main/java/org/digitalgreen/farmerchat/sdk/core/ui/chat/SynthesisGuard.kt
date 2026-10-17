package org.digitalgreen.farmerchat.sdk.core.ui.chat

/**
 * Whether a #31 synthesise reply for [requestedMessageId] may still be played: only while that
 * answer is still the latest AI response and no new answer is loading. Otherwise the farmer has
 * moved on and the audio would play the wrong text.
 */
internal fun synthesisStillWanted(requestedMessageId: String, state: ChatState): Boolean {
    if (state.isLoading) return false
    val latest = state.messages.lastOrNull { it is ChatMessage.AiResponse } as? ChatMessage.AiResponse
    return latest?.messageId == requestedMessageId
}
