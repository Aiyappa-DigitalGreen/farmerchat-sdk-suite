package org.digitalgreen.farmerchat.sdk.core.model

import com.google.gson.annotations.SerializedName

// ---------------- Home feed (api/images/v2/daily/) ----------------

data class HomeUdfResponse(
    val greeting: String?,
    val sections: List<SectionDto>,
    val ssfr_enable: Boolean? = null
) {
    /**
     * Feed with host-unrenderable sections removed.
     *
     * `plotline_widget` sections carry only `type`/`unique_key`/`label` — no headline, image or
     * statement id (verified live 2026-09-01: 14 of 21 prod sections were these). The app renders
     * them with `PlotlineComposeWidget`, but root CLAUDE.md §6 forbids Plotline inside SDK
     * packages, so the SDK must DROP them. Rendering them through a catch-all branch produces
     * blank cards, which is what "nothing loads on home" looked like.
     */
    fun renderableSections(): List<SectionDto> = sections.filterNot { it.isHostOnlyWidget() }
}

data class SectionDto(
    val type: String?,
    /** Int or String from backend. */
    val id: Any?,
    // image + statement cards
    val image_url: String?,
    val title: String?,
    val question_text: String?,
    val statement_id: Any?,
    val badge: BadgeDto?,
    val cta: CtaDto?,
    // question card
    val statement: String?,
    val selection_type: String?,
    val options: List<OptionDto>?,
    val statement_type: String?,
    val is_viewed: Boolean?,
    val meta: SectionMetaDto? = null,
    // plotline_widget card (omitted in SDK rendering; kept for parse fidelity)
    val unique_key: String? = null,
    val label: String? = null
) {
    fun stableId(): String = (id ?: statement_id ?: title ?: "").toString()

    /**
     * True for sections the SDK deliberately cannot render (third-party host widgets).
     * See [HomeUdfResponse.renderableSections].
     */
    fun isHostOnlyWidget(): Boolean = type?.lowercase() == "plotline_widget"
}

data class SectionMetaDto(
    val country: String? = null,
    val county: String? = null,
    val asset_name: String? = null,
    val asset_category: String? = null,
    val growth_stage: String? = null,
    val user_country: String? = null,
    val user_county: String? = null,
    val concern: String? = null,
    val date_range: String? = null,
    val geography_level2: String? = null
)

data class BadgeDto(
    val icon: String?,
    val count: String?,
    val show: Boolean?
)

data class CtaDto(
    val text: String?,
    val action: String?
)

data class OptionDto(
    val id: String?,
    val text: String?
)

// ---------------- Card viewed / statement ----------------

data class ImageViewedRequest(
    val statement_id: String,
    val user_id: String,
    val status: String = "viewed"
)

data class ImageViewedResponse(
    val image_id: String,
    val statement_id: String,
    val view_count: Int,
    val status: String
)

data class ImageStatementRequest(
    val statement_id: String?,
    val triggered_input_type: String?
)

data class ImageStatementFollowUpQuestion(
    @SerializedName("follow_up_question_id") val follow_up_question_id: String,
    @SerializedName("sequence") val sequence: Int,
    @SerializedName("question") val question: String
)

data class ImageStatementResponse(
    /** Int or String (UUID) — handle both. */
    val id: Any?,
    val short_answer: String?,
    @SerializedName("follow_up_questions") val follow_up_questions: List<ImageStatementFollowUpQuestion>? = null,
    @SerializedName("message_id") val message_id: String?,
    @SerializedName("conversation_id") val conversation_id: String?
)

// ---------------- Weather ----------------

data class WeatherResponse(
    val current_temp: String,
    val precipitation_probability: String,
    val weather_icon: String
)

// ---------------- Crops ----------------

data class SetCultivatedCropsRequest(
    val user_id: String,
    val crop_details: List<String>
)

data class CropResponse(
    val message: String
)

// ---------------- Question count ----------------

data class UserQuestionCountResponse(
    val total_questions_asked: Int,
    val bypass_interstitial: Boolean
)
