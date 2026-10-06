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
        val channel: String? = null,
        /**
         * Home content-card tap in AGENTIC mode: `"image_card"` or `"text_card"`.
         *
         * App parity (`ChatViewModel.kt:214`): with agentic chat on, a content-card tap skips the
         * pre-generated-answer API (#26) and sends the card's question as a normal text query —
         * but it must still tell the backend and analytics where the query came from. This one
         * value feeds BOTH `triggered_input_type` (API) and `click_type` (analytics), which is how
         * the agentic card path stays indistinguishable from the non-agentic one downstream.
         */
        val contentCardTriggerType: String? = null,
        /**
         * DISPLAY-ONLY image for the user's own bubble — the content card's artwork.
         *
         * Emphatically NOT an image query: the URL is remote (https) and the question travels as
         * text. Routing it through `SendQuestionWithImage` would send it to image analysis (#28),
         * which is exactly what the app's agentic card path avoids.
         */
        val userMessageImageUri: Uri? = null
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

    /**
     * The farmer tapped a chip on an alignment surface. 1:1 port of the app's
     * `ChatAction.SendAlignmentChip` (`ui/chat/udf/ChatAction.kt:108`) — same nine parameters, same
     * meanings. Every non-capability chip tap goes through here; the two capability chips run their
     * capability first and come back through here (decline) or through [SendLocationSharedQuery] /
     * [SendQuestionWithImage] (success). See `routeAlignmentChip`.
     *
     * @param query what is sent to the API as the next query on the same conversation. The chip
     *   LABEL for most chips; for GENDER_SELECT the chip VALUE (the backend expects the raw gender
     *   value). When [displayLabel] is null, [query] is also the user-bubble text.
     * @param selectionValue the chip VALUE — used only to mark/highlight the chosen chip on the
     *   source AI response ([sourceMessageId]); never sent as the query.
     * @param sourceMessageId local list id of the AI response that showed the surface. Its SERVER
     *   `messageId` is what goes out as `parent_message_id`.
     * @param displayLabel optional user-bubble override (GENDER_SELECT): the bubble shows this
     *   LABEL while [query] (the VALUE) is what gets sent. Null = the bubble uses [query].
     * @param locationDeclined true only for a GPS_PROMPT decline (the farmer chose not to share, or
     *   denied/cancelled the OS permission); sets `location_declined = true` on the request.
     * @param photoDeclined true only for an UPLOAD_PHOTO decline; sets `photo_declined = true`.
     * @param chipType the surface kind in wire format ([AlignmentKind.analyticsType], e.g.
     *   "gps-prompt"); destined for analytics as `agentic_chip_type`.
     * @param chipValue stable machine value of the tapped chip — language-independent, best for
     *   funnels; destined for `agentic_chip_value`.
     * @param chipLabel localized display text of the tapped chip; destined for
     *   `agentic_chip_label`.
     *
     * The three chip properties are carried and forwarded, but `SendQueryProperties` has no
     * `isAlignmentChip` / `agenticChip*` fields yet, so nothing emits them — the wire half
     * (`triggered_input_type = "align_chip_sel"`, `parent_message_id`) ships regardless. docs/04.
     */
    data class SendAlignmentChip(
        val query: String,
        val selectionValue: String,
        val sourceMessageId: String,
        val displayLabel: String? = null,
        val locationDeclined: Boolean = false,
        val photoDeclined: Boolean = false,
        val chipType: String? = null,
        val chipValue: String? = null,
        val chipLabel: String? = null
    ) : ChatAction()

    /**
     * The GPS_PROMPT surface's "Share my location" chip was satisfied (2.0.0).
     *
     * The chip does not send its own text: the flavour runs the location flow, and on success
     * dispatches this with the resolved [address] so core shows a `LocationMessage` bubble and
     * re-sends the surface's `alignmentOriginalQuery`. A blank [address] is allowed — the query is
     * still re-sent, just without a bubble (app parity).
     */
    data class SendLocationSharedQuery(
        val sourceMessageId: String,
        val address: String
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
