package org.digitalgreen.farmerchat.sdk.core.model

import com.google.gson.annotations.SerializedName
import java.io.Serializable

// ---------------- Conversation ----------------

data class NewConversationRequest(
    val user_id: String,
    val content_provider_id: String?
)

data class NewConversationResponse(
    val conversation_id: String,
    val message: String,
    val show_popup: Boolean
)

// ---------------- Text prompt (main AI answer) ----------------

data class TextPromptRequest(
    @SerializedName("query") val query: String,
    @SerializedName("conversation_id") val conversation_id: String,
    @SerializedName("message_id") val message_id: String,
    @SerializedName("statement_id") val statement_id: String? = null,
    @SerializedName("weather_cta_triggered") val weather_cta_triggered: Boolean = false,
    @SerializedName("triggered_input_type") val triggered_input_type: String,
    @SerializedName("ssfr_crop") val ssfr_crop: String? = null,
    @SerializedName("use_entity_extraction") val use_entity_extraction: Boolean = true,
    @SerializedName("transcription_id") val transcription_id: String? = null,
    /** True when user taps retry from the inline error on the chat screen. */
    @SerializedName("retry") val retry: Boolean = false
)

data class TextPromptResponse(
    @SerializedName("error") val error: Boolean,
    @SerializedName("message") val message: String?,
    @SerializedName("message_id") val message_id: String?,
    @SerializedName("query") val query: String?,
    @SerializedName("response") val response: String?,
    @SerializedName("resource_url") val resource_url: String?,
    @SerializedName("translated_response") val translated_response: String?,
    /** Always null from this API; real follow-ups come from GET follow_up_questions. */
    @SerializedName("follow_up_questions") val follow_up_questions: List<FollowUpQuestionOption>?,
    @SerializedName("section_message_id") val section_message_id: String?,
    @SerializedName("actual_content_provider") val actual_content_provider: String?,
    @SerializedName("content_provider_logo") val content_provider_logo: String?,
    @SerializedName("hide_feedback_icons") val hide_feedback_icons: Boolean? = null,
    @SerializedName("hide_follow_up_question") val hide_follow_up_question: Boolean? = null,
    @SerializedName("hide_share_icon") val hide_share_icon: Boolean? = null,
    @SerializedName("hide_tts_speaker") val hide_tts_speaker: Boolean? = null,
    @SerializedName("hide_source") val hide_source: Boolean? = null,
    @SerializedName("points") val points: Int?,
    @SerializedName("intent_classification_output") val intent_classification_output: IntentClassificationOutput? = null
) : Serializable

data class IntentClassificationOutput(
    @SerializedName("asset_name") val asset_name: String? = null,
    @SerializedName("asset_status") val asset_status: String? = null,
    @SerializedName("asset_type") val asset_type: String? = null,
    @SerializedName("clarification_needed") val clarification_needed: ClarificationNeeded? = null,
    @SerializedName("concern") val concern: String? = null,
    @SerializedName("confidence") val confidence: String? = null,
    @SerializedName("intent") val intent: String? = null,
    @SerializedName("likely_activity") val likely_activity: String? = null,
    @SerializedName("rephrased_query") val rephrased_query: String? = null,
    @SerializedName("seasonal_relevance") val seasonal_relevance: String? = null,
    @SerializedName("stage") val stage: String? = null
) : Serializable

data class ClarificationNeeded(
    @SerializedName("additional_context") val additional_context: String?,
    @SerializedName("asset") val asset: Boolean?,
    @SerializedName("concern") val concern: Boolean?
) : Serializable

data class FollowUpQuestionOption(
    @SerializedName("follow_up_question_id") val follow_up_question_id: String?,
    @SerializedName("sequence") val sequence: Int,
    @SerializedName("question") val question: String?
) : Serializable

// ---------------- Image analysis ("Plantix") ----------------

data class PlantixRequest(
    @SerializedName("conversation_id") val conversation_id: String,
    @SerializedName("image") val image: String,
    @SerializedName("triggered_input_type") val triggered_input_type: String = "image",
    @SerializedName("query") val query: String? = null,
    @SerializedName("latitude") val latitude: String? = null,
    @SerializedName("longitude") val longitude: String? = null,
    /** Unique name per image request. */
    @SerializedName("image_name") val image_name: String,
    @SerializedName("retry") val retry: Boolean = false
)

data class PlantixResponse(
    @SerializedName("audio") val audio: String?,
    @SerializedName("error") val error: Boolean,
    @SerializedName("hide_tts_speaker") val hide_tts_speaker: Boolean?,
    @SerializedName("message") val message: String,
    @SerializedName("message_id") val message_id: String,
    @SerializedName("response") val response: String,
    @SerializedName("section_message_id") val section_message_id: String,
    @SerializedName("actual_content_provider") val actual_content_provider: String?,
    @SerializedName("content_provider_logo") val content_provider_logo: String?,
    @SerializedName("points") val points: Int?,
    @SerializedName("follow_up_questions") val follow_up_questions: List<FollowUpQuestionOption>?
) : Serializable

// ---------------- Follow-up questions ----------------

data class FollowUpQuestionsResponse(
    @SerializedName("message_id") val message_id: String,
    @SerializedName("questions") val questions: List<Question>?,
    @SerializedName("section_message_id") val section_message_id: String,
    @SerializedName("clarification_required") val clarification_required: Boolean
) : Serializable

data class Question(
    @SerializedName("follow_up_question_id") val follow_up_question_id: String,
    @SerializedName("question") val question: String,
    @SerializedName("sequence") val sequence: Int
) : Serializable

data class FollowUpQuestionClickRequest(
    @SerializedName("follow_up_question") val follow_up_question: String
)

data class FollowUpQuestionClickResponse(
    @SerializedName("message") val message: String? = null
)

// ---------------- TTS ----------------

data class SynthesiseAudioRequest(
    @SerializedName("message_id") val message_id: String,
    @SerializedName("text") val text: String,
    @SerializedName("user_id") val user_id: String
)

data class SynthesiseAudioResponse(
    @SerializedName("message") val message: String? = null,
    @SerializedName("error") val error: Boolean = false,
    @SerializedName("audio") val audio: String? = null,
    @SerializedName("text") val text: String? = null,
    @SerializedName("section_message_id") val section_message_id: String? = null
)

// ---------------- Thread history ----------------

data class ConversationChatHistoryResponse(
    @SerializedName("conversation_id") val conversation_id: String,
    @SerializedName("data") val data: List<ConversationChatHistoryMessageItem>
)

data class ConversationChatHistoryQuestion(
    @SerializedName("follow_up_question_id") val follow_up_question_id: String,
    @SerializedName("sequence") val sequence: Int,
    @SerializedName("question") val question: String
)

/**
 * message_type_id: 1 = query_text, 2 = query_audio, 3 = response_text,
 * 7 = follow_up_questions, 11 = input_image
 */
data class ConversationChatHistoryMessageItem(
    @SerializedName("message_type_id") val message_type_id: Int,
    @SerializedName("message_type") val message_type: String,
    @SerializedName("message_id") val message_id: String,
    @SerializedName("message_input_time") val message_input_time: String? = null,
    @SerializedName("section_message_id") val section_message_id: String? = null,
    @SerializedName("query_text") val query_text: String? = null,
    @SerializedName("heard_query_text") val heard_query_text: String? = null,
    @SerializedName("response_text") val response_text: String? = null,
    @SerializedName("questions") val questions: List<ConversationChatHistoryQuestion>? = null,
    @SerializedName("query_media_file_url") val query_media_file_url: String? = null,
    @SerializedName("reaction") val reaction: String? = null,
    @SerializedName("response_media_file_url") val response_media_file_url: String? = null,
    @SerializedName("resource_id") val resource_id: String? = null,
    @SerializedName("resource_url") val resource_url: String? = null,
    @SerializedName("actual_content_provider") val actual_content_provider: String? = null,
    @SerializedName("content_provider_logo") val content_provider_logo: String? = null,
    @SerializedName("hide_source") val hide_source: Boolean? = null,
    @SerializedName("hide_tts_speaker") val hide_tts_speaker: Boolean? = null,
    @SerializedName("clarification_required") val clarification_required: Boolean? = null
)

// ---------------- Campaign QAPair insert (add_query_to_history) ----------------
// Class/field names kept identical to the app (backend contract fidelity).

@Suppress("ClassName")
data class followUpQuestionsMoengage(
    val message: String?
)

@Suppress("ClassName")
data class videoResourcesMoengage(
    val resource_string: String?,
    val resource_type: String?
)

@Suppress("ClassName")
data class followUpQuestionsRequestMoengage(
    val conversation_id: String?,
    val query: String?,
    val response: String?,
    val follow_up_questions: List<followUpQuestionsMoengage>,
    val video_resources: List<videoResourcesMoengage>,
    val triggered_input_type: String?
)

@Suppress("ClassName")
data class messageMoengage(
    val id: String?,
    val conversation_id: String?,
    val original_message: String?,
    val message_response: String?,
    val input_type: String?,
    val source: String?
)

@Suppress("ClassName")
data class followUpQuestionsReponseMoengageApi(
    val id: String?,
    val message: String?,
    val ref_id: String?,
    val follow_up_question_type: String?,
    val sequence: String?
)

@Suppress("ClassName")
data class videoResourcesRespopnseMoengage(
    val id: String?,
    val message_id: String?,
    val resource_string: String?,
    val resource_type: String?
)

@Suppress("ClassName")
data class followUpQuestionsResponseMoengage(
    val message: messageMoengage,
    val follow_up_questions: List<followUpQuestionsReponseMoengageApi>,
    val video_resources: List<videoResourcesRespopnseMoengage>,
    val error: Boolean?
)
