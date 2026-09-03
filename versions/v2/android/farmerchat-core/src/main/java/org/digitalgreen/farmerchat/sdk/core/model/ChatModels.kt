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
    @SerializedName("retry") val retry: Boolean = false,
    // ---- 2.0.0 fields, all present in the app's `domain/model/chat/TextPromptRequest.kt` ----
    /**
     * Per-LANGUAGE flag from the language API (`SupportedLanguage.streaming_required`), persisted
     * under [org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences.Keys.STREAMING_REQUIRED]
     * and sent on every text-prompt request, exactly as the app does.
     *
     * It does **not** gate the stream: #27a returned a full stream both with and without it
     * (docs/02 §#27a). It is sent for wire fidelity.
     */
    @SerializedName("streaming_required") val streaming_required: Boolean = true,
    /**
     * Unique name for an image-based agentic query (e.g. `image_<uuid>.jpg`). Null for text/voice,
     * and Gson omits it, so those requests are unchanged on the wire. The SDK's image questions
     * still go through #26 (`PlantixRequest`), so nothing populates this yet — it exists so the
     * request model matches the app's (docs/04).
     */
    @SerializedName("image_name") val image_name: String? = null,
    /** Base64 image for an image-based agentic query. Null (omitted) for text/voice. */
    @SerializedName("image") val image: String? = null,
    /**
     * The server `message_id` of the alignment surface this query answers, so the backend can
     * correlate a chip pick to the surface that asked. Null (omitted) on an ordinary query.
     */
    @SerializedName("parent_message_id") val parent_message_id: String? = null,
    /**
     * True when the farmer refused a `gps-prompt` surface — tapped its decline chip
     * ([AlignmentChip.VALUE_USE_APPROXIMATE_LOCATION] on the live wire), or denied/cancelled the
     * OS permission. Only ever sent as `true` (else null → omitted by Gson) so the backend answers
     * from an approximate location instead of waiting for coordinates.
     */
    @SerializedName("location_declined") val location_declined: Boolean? = null,
    /**
     * True when the farmer refused an `upload-photo` surface. Only ever sent as `true` (else null →
     * omitted) so the backend proceeds without an image.
     */
    @SerializedName("photo_declined") val photo_declined: Boolean? = null
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
    @SerializedName("intent_classification_output") val intent_classification_output: IntentClassificationOutput? = null,
    /**
     * Server-driven alignment surface (clarify / confirm / escalate) — **2.0.0**. Present when the
     * backend needs the user to disambiguate, confirm, or respond to an urgent situation instead
     * of (or before) giving a normal answer. In that case [response] is typically empty and this
     * carries the prompt message plus quick-reply chips. Null for a normal answer.
     */
    @SerializedName("alignments")
    val alignments: Alignment? = null
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

// ---------------- Alignment surfaces (2.0.0) ----------------

/**
 * A short prompt the user answers by tapping a chip, instead of receiving a normal answer.
 *
 * [type] selects the visual treatment (see [AlignmentKind]); [chips] are the quick replies;
 * [original_query] is the query that triggered the surface, kept for context — it is the chip's
 * `value` that gets sent on tap.
 */
data class Alignment(
    @SerializedName("type")
    val type: String? = null,
    @SerializedName("message")
    val message: String? = null,
    @SerializedName("chips")
    val chips: List<AlignmentChip>? = null,
    @SerializedName("original_query")
    val original_query: String? = null,
    /** True when the backend needs this answered before it can proceed. */
    @SerializedName("blocking")
    val blocking: Boolean? = null,
    /** Backend intent tag (e.g. "capability", "profile"); informational for the client. */
    @SerializedName("intent")
    val intent: String? = null,
    /**
     * How the surface expects to be interacted with (live value: `"capability"`). Informational —
     * [type] already selects the visual treatment. Captured live 2026-09-03 (docs/02 §#27a).
     */
    @SerializedName("interaction_kind")
    val interaction_kind: String? = null,
    /** Extra context the backend attached to the surface. */
    @SerializedName("context")
    val context: AlignmentContext? = null,
    /** How many times the backend may re-ask this surface. */
    @SerializedName("budget")
    val budget: AlignmentBudget? = null
) : java.io.Serializable {
    /**
     * The query that triggered the surface. The live payload carries it BOTH at the top level and
     * inside [context], and a surface that only populates `context` would otherwise lose it — with
     * it goes the capability flow, which re-sends this query once the capability is satisfied.
     */
    val effectiveOriginalQuery: String?
        get() = original_query?.takeIf { it.isNotBlank() }
            ?: context?.original_query?.takeIf { it.isNotBlank() }
}

/**
 * `payload.context` on an alignment surface. Captured live 2026-09-03: a `gps-prompt` carries
 * `required_precision: "coordinates"` and `original_query`; a `commodity-confirm` carries
 * `subject: "maize"`.
 */
data class AlignmentContext(
    @SerializedName("required_precision")
    val required_precision: String? = null,
    @SerializedName("original_query")
    val original_query: String? = null,
    @SerializedName("subject")
    val subject: String? = null
) : java.io.Serializable

/**
 * `payload.budget` — how many times the backend may re-ask this surface ([asked] of [max]). A
 * client that keeps re-showing an exhausted prompt is the failure mode this guards against.
 */
data class AlignmentBudget(
    @SerializedName("asked")
    val asked: Int? = null,
    @SerializedName("max")
    val max: Int? = null
) : java.io.Serializable

/**
 * A chip's `submit` object — what the backend wants sent when the chip is tapped. Two observed
 * shapes (docs/02 §#27a):
 * - `{"kind":"message","surface_type":"commodity-confirm","text":"Yes, save my maize crop…"}`
 * - `{"kind":"action","surface_type":"gps-prompt","action":"grant","data":{},"requires":"location"}`
 *
 * Modelled for fidelity; the SDK's routing still keys off [AlignmentChip.behavior] /
 * [AlignmentChip.capability] / [AlignmentChip.value], never off this object (docs/04).
 */
data class AlignmentChipSubmit(
    @SerializedName("kind")
    val kind: String? = null,
    @SerializedName("surface_type")
    val surface_type: String? = null,
    @SerializedName("action")
    val action: String? = null,
    /** Present on `kind == "message"`: the exact text the backend wants as the next query. */
    @SerializedName("text")
    val text: String? = null,
    /** Free-form action arguments; `{}` in both live captures. */
    @SerializedName("data")
    val data: Map<String, Any?>? = null,
    /** The device capability the action needs (live value: `"location"`). */
    @SerializedName("requires")
    val requires: String? = null
) : java.io.Serializable

/**
 * One quick-reply chip. [label] is shown, [value] is sent on tap.
 *
 * [action] describes how the chip behaves: the value of [ACTION_SELECT] —
 * the string `"invoke"`, NOT `"select"` — marks a chip that invokes a device
 * capability (take a photo, share location) rather than sending its text.
 * Those capability flows ARE wired as of 2026-09-02; see the capability
 * constants below and "The capability-chip gap" in docs/04.
 */
data class AlignmentChip(
    @SerializedName("label")
    val label: String? = null,
    @SerializedName("value")
    val value: String? = null,
    @SerializedName("action")
    val action: String? = null,
    // ---- fields captured live 2026-09-03 (docs/02 §#27a); all nullable, all informational
    // except [behavior] / [capability], which routing prefers over [action] + [value]. ----
    /** Server-side label key for the chip text (live: `"gps.button"`). */
    @SerializedName("label_key")
    val label_key: String? = null,
    /** English text of the chip, whatever the answer language (live: `"Give permission"`). */
    @SerializedName("label_en")
    val label_en: String? = null,
    /**
     * The backend's EXPLICIT intent for the chip, and the most robust routing signal:
     * [BEHAVIOR_INVOKE_CAPABILITY] means "run a device capability and send only the outcome",
     * [BEHAVIOR_CONTINUE] means "carry on without it" (i.e. a decline). Preferred over
     * [action] + [value] when present — see `routeAlignmentChip`.
     */
    @SerializedName("behavior")
    val behavior: String? = null,
    /** WHICH capability [behavior] refers to (live: [CAPABILITY_LOCATION]). */
    @SerializedName("capability")
    val capability: String? = null,
    /** How the capability should be satisfied (live: `"gps"` / `"use_current"`). */
    @SerializedName("request")
    val request: String? = null,
    /** What the backend wants submitted on tap. Modelled for fidelity; routing ignores it. */
    @SerializedName("submit")
    val submit: AlignmentChipSubmit? = null
) : java.io.Serializable {
    /**
     * Wire values for the capability chips, copied verbatim from the app's
     * `domain/model/chat/TextPromptResponse.kt`. A capability chip does not send its text as a
     * question — it invokes a device capability, and only its OUTCOME is sent.
     *
     * Note [ACTION_SELECT] is the string `"invoke"`, not `"select"`, and [VALUE_SHARE_LOCATION] is
     * `"share_precise_location"` — the app has a `share_location` constant commented out directly
     * above it. Do not "normalize" either one.
     */
    companion object {
        /** `action` marking a chip that invokes a capability rather than sending text. */
        const val ACTION_SELECT = "invoke"

        /** `action` on a decline chip. From app source; `commodity-confirm` sends it live. */
        const val ACTION_DECLINE = "decline"

        /** `action` on the live `gps-prompt` decline chip — NOT [ACTION_DECLINE]. */
        const val ACTION_CONTINUE = "continue"

        /** GPS_PROMPT: start the location flow, then send the original query. */
        const val VALUE_SHARE_LOCATION = "share_precise_location"

        /** UPLOAD_PHOTO: open the camera / the gallery. */
        const val VALUE_TAKE_PHOTO = "take_photo"
        const val VALUE_CHOOSE_FROM_GALLERY = "choose_from_gallery"

        /**
         * The decline chip on a capability prompt, per app source. **Unconfirmed for `gps-prompt`**:
         * the live 2026-09-03 capture sends [VALUE_USE_APPROXIMATE_LOCATION] there instead. The
         * constant is kept (it is app source, and `commodity-confirm` really does send `not_now`)
         * and the decline path recognises both. See docs/05-open-questions.md.
         */
        const val VALUE_NOT_NOW = "not_now"

        /** The live `gps-prompt` decline value, captured 2026-09-03 (docs/02 §#27a). */
        const val VALUE_USE_APPROXIMATE_LOCATION = "use_approximate_location"

        /** [behavior]: run a device capability, send only the outcome. */
        const val BEHAVIOR_INVOKE_CAPABILITY = "invoke_capability"

        /** [behavior]: proceed without the capability — a decline. */
        const val BEHAVIOR_CONTINUE = "continue"

        /** [capability] naming the location capability. */
        const val CAPABILITY_LOCATION = "location"
    }
}

/** The alignment surfaces the backend can ask for. */
enum class AlignmentKind {
    CLARIFY, CONFIRM, ESCALATE, GPS_PROMPT, UPLOAD_PHOTO, GENDER_SELECT, COMMODITY_CONFIRM;

    /**
     * Additive surfaces accompany a normal answer — they render BELOW it as an optional nudge and
     * never suppress the answer or its follow-ups. Exclusive surfaces (clarify / confirm /
     * escalate / capability prompts) own the message area and replace the answer.
     *
     * The backend marks the additive ones non-blocking (`blocking:false`, `intent:"profile"`).
     * Both are single-select: one tap sends immediately and locks the card.
     */
    val isAdditive: Boolean get() = this == GENDER_SELECT || this == COMMODITY_CONFIRM

    /**
     * The exact wire `type` string, reported as the `agentic_chip_type` analytics property so
     * funnels can be segmented by which surface was tapped. Keep these stable and in sync with
     * [fromType] — dashboards depend on them.
     */
    val analyticsType: String get() = when (this) {
        CLARIFY -> "alignment-clarify"
        CONFIRM -> "alignment-confirm"
        ESCALATE -> "alignment-escalate"
        GPS_PROMPT -> "gps-prompt"
        UPLOAD_PHOTO -> "upload-photo"
        GENDER_SELECT -> "gender-select"
        COMMODITY_CONFIRM -> "commodity-confirm"
    }

    companion object {
        /** Wire `type` → kind. Null for an unknown or absent type: render as a normal answer. */
        fun fromType(type: String?): AlignmentKind? = when (type?.trim()?.lowercase()) {
            "alignment-clarify" -> CLARIFY
            "alignment-confirm" -> CONFIRM
            "alignment-escalate" -> ESCALATE
            "gps-prompt" -> GPS_PROMPT
            "upload-photo" -> UPLOAD_PHOTO
            "gender-select" -> GENDER_SELECT
            "commodity-confirm" -> COMMODITY_CONFIRM
            else -> null
        }
    }
}
