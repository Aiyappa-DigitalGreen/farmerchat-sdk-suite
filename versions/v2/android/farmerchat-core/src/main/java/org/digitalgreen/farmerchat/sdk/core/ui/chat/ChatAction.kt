package org.digitalgreen.farmerchat.sdk.core.ui.chat

import android.net.Uri
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.analytics.SendQueryProperties

/**
 * Actions dispatched to [ChatViewModel]. 1:1 port of the app's ChatAction.
 */
sealed class ChatAction {
    /**
     * Initialize chat with pre-generated content from Home or a campaign QAPair.
     * @param isFromCampaign When true, call add_query_to_history to log the QAPair.
     * @param isPush/isInApp click_type overrides for Send_Query events.
     * @param homeStatementId Sent as statement_id when user taps Read full advice.
     * @param userMessageImageUri Feed image shown on the first user bubble.
     */
    data class InitializeWithPreGeneratedContent(
        val question: String,
        val answer: String?,
        val followUpQuestions: List<String>?,
        val isFromCampaign: Boolean = false,
        val isPush: Boolean = false,
        val isInApp: Boolean = false,
        val homeStatementId: String? = null,
        val userMessageImageUri: Uri? = null
    ) : ChatAction()

    /**
     * Voice-first flow: show audio bubble, transcribe, then send the transcription.
     */
    data class InitializeVoicePrototype(
        val audioUri: String,
        val originScreenName: String = AnalyticsScreens.CHAT
    ) : ChatAction()

    /**
     * Initialize chat with a question (fetches the answer from the API).
     */
    data class InitializeWithQuestion(
        val question: String,
        val transcriptionId: String? = null,
        val audioUri: Uri? = null,
        val originScreenName: String = AnalyticsScreens.CHAT,
        val isWeatherAdviceCTA: Boolean = false,
        val isPush: Boolean = false,
        val isInApp: Boolean = false,
        val isSSFR: Boolean = false,
        /** "wheat" or "maize", sent as ssfr_crop in the text-prompt API. */
        val ssfrCrop: String? = null,
        /** From deep link ?channel=: sent as triggered_input_type + click_type. */
        val channel: String? = null
    ) : ChatAction()

    /**
     * "Read full advice" (append) or follow-up click on pre-generated content (replace).
     * @param triggerInputType "read_full_advice" → append + sent as triggered_input_type.
     */
    data class ReplacePreGeneratedWithQuestion(
        val question: String,
        val triggerInputType: String? = null
    ) : ChatAction()

    data class SendFollowUpQuestion(
        val question: String,
        val followUpQuestionId: String? = null,
        val transcriptionId: String? = null,
        val audioUri: Uri? = null,
        val sendQueryProperties: SendQueryProperties? = null
    ) : ChatAction()

    data class SendQuestionWithImage(
        val question: String,
        val imageUri: Uri,
        val sendQueryProperties: SendQueryProperties? = null
    ) : ChatAction()

    /**
     * Follow-up voice question in an existing conversation: appends, transcribes, fetches.
     */
    data class SendFollowUpVoiceQuestion(
        val audioUri: String
    ) : ChatAction()

    data class SendQuestionWithAudio(
        val question: String,
        val audioUri: Uri
    ) : ChatAction()

    /**
     * Load chat history from conversation_id (paginated, 1-based).
     */
    data class LoadChatHistory(
        val conversationId: String,
        val page: Int = 1
    ) : ChatAction()

    object RetryLastRequest : ChatAction()

    object ClearError : ChatAction()

    object ClearMessages : ChatAction()

    /** Request audio synthesis for the last AI response (Listen button). */
    object SynthesiseAudio : ChatAction()

    object ClearAudioPlaybackUrl : ChatAction()

    data class SetAudioPlaying(val isPlaying: Boolean) : ChatAction()
}
