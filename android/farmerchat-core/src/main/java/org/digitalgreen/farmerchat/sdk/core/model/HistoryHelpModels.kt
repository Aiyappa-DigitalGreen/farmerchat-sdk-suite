package org.digitalgreen.farmerchat.sdk.core.model

import com.google.gson.JsonDeserializationContext
import com.google.gson.JsonDeserializer
import com.google.gson.JsonElement
import com.google.gson.JsonParseException
import com.google.gson.annotations.SerializedName
import com.google.gson.reflect.TypeToken
import java.lang.reflect.Type

// ---------------- Conversation list (chat history screen + drawer) ----------------

data class ConversationListItem(
    @SerializedName("conversation_id") val conversation_id: String,
    @SerializedName("conversation_title") val conversation_title: String?,
    @SerializedName("created_on") val created_on: String,
    @SerializedName("message_type") val message_type: String?,
    @SerializedName("grouping") val grouping: String?,
    @SerializedName("content_provider_logo") val content_provider_logo: String?,
    @SerializedName("content_provider_id") val content_provider_id: String?,
    @SerializedName("content_provider_name") val content_provider_name: String?
)

/**
 * Paginated response for the conversation list API. Supports both the legacy
 * bare-array format and the paginated object format (custom deserializer below).
 */
data class ConversationListResponse(
    @SerializedName("results") val results: List<ConversationListItem>? = null,
    @SerializedName("count") val count: Int? = null,
    @SerializedName("next") val next: String? = null,
    @SerializedName("previous") val previous: String? = null,
    @SerializedName("page") val page: Int? = null,
    @SerializedName("page_size") val pageSize: Int? = null,
    @SerializedName("total_pages") val totalPages: Int? = null,
    @SerializedName("has_more") val hasMore: Boolean? = null
) {
    fun getItems(): List<ConversationListItem> = results ?: emptyList()

    /** has_more flag > next URL > count comparison > total_pages > non-empty fallback. */
    fun canLoadMore(currentPage: Int, pageSize: Int = 20): Boolean {
        hasMore?.let { return it }
        next?.let { return it.isNotBlank() }
        if (count != null && page != null) {
            val total = (count + pageSize - 1) / pageSize
            return page < total
        }
        if (totalPages != null && page != null) {
            return page < totalPages
        }
        return getItems().isNotEmpty()
    }
}

/** Handles both `[ {...} ]` and `{ "results": [...], "count": ..., "next": ... }`. */
class ConversationListResponseDeserializer : JsonDeserializer<ConversationListResponse> {
    override fun deserialize(
        json: JsonElement,
        typeOfT: Type,
        context: JsonDeserializationContext
    ): ConversationListResponse {
        return when {
            json.isJsonArray -> {
                val items = context.deserialize<List<ConversationListItem>>(
                    json,
                    object : TypeToken<List<ConversationListItem>>() {}.type
                )
                ConversationListResponse(results = items)
            }
            json.isJsonObject -> {
                val obj = json.asJsonObject
                fun jsonString(key: String): String? =
                    obj.get(key)?.takeIf { !it.isJsonNull }?.asString
                fun jsonInt(key: String): Int? =
                    obj.get(key)?.takeIf { !it.isJsonNull }?.asInt
                ConversationListResponse(
                    results = obj.get("results")?.takeIf { !it.isJsonNull }?.let {
                        context.deserialize(it, object : TypeToken<List<ConversationListItem>>() {}.type)
                    },
                    count = jsonInt("count"),
                    next = jsonString("next"),
                    previous = jsonString("previous"),
                    page = jsonInt("page"),
                    pageSize = jsonInt("page_size"),
                    totalPages = jsonInt("total_pages"),
                    hasMore = obj.get("has_more")?.takeIf { !it.isJsonNull }?.asBoolean
                )
            }
            else -> throw JsonParseException("Unexpected JSON format for ConversationListResponse")
        }
    }
}

// ---------------- Help & Support (api/faqs) ----------------

data class HelpSupportResponse(
    val status: String? = null,
    val data: HelpSupportData? = null
)

data class HelpSupportData(
    val faqs: List<FaqItem> = emptyList(),
    val legal: HelpLegal? = null,
    @SerializedName(value = "mode", alternate = ["theme", "appearance"])
    val mode: String? = null
)

data class FaqItem(
    val id: String,
    val title: String,
    @SerializedName(value = "webview-url", alternate = ["webview_url"])
    val webviewUrl: String? = null,
    @SerializedName(value = "open-mode", alternate = ["open_mode"])
    val openMode: String? = null
)

data class HelpLegal(
    @SerializedName(value = "privacy-policy", alternate = ["privacy_policy"])
    val privacyPolicy: HelpWebLink? = null,
    @SerializedName(value = "terms-of-use", alternate = ["terms_of_use"])
    val termsOfUse: HelpWebLink? = null
)

data class HelpWebLink(
    val title: String,
    @SerializedName(value = "webview-url", alternate = ["webview_url"])
    val webviewUrl: String? = null,
    @SerializedName(value = "open-mode", alternate = ["open_mode"])
    val openMode: String? = null
)

// ---------------- Voice (STT) ----------------

data class SetVoiceRequest(
    val conversation_id: String,
    /** Base64-encoded audio payload. */
    val query: String,
    val message_reference_id: String,
    val input_audio_encoding_format: String,
    val triggered_input_type: String,
    val editable_transcription: String = "True"
)

data class GetVoiceResponse(
    val message: String?,
    val heard_input_query: String?,
    val confidence_score: Double?,
    val error: Boolean,
    val message_id: String,
    val section_message_id: String?,
    val message_reference_id: String?,
    val points: Int?,
    val transcription_id: String?
) : java.io.Serializable
