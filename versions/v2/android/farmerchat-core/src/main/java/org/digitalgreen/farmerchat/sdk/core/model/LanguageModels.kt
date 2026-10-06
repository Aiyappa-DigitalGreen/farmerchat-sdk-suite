package org.digitalgreen.farmerchat.sdk.core.model

import com.google.gson.annotations.SerializedName

// ---------------- Supported languages ----------------

data class SupportedLanguage(
    val id: Int,
    val name: String,
    val code: String,
    val bcpCode: String = "",
    val latnCode: String = "",
    @SerializedName("display_name") val displayName: String = "",
    val flag: String? = null,
    val ttsVoiceName: String = "",
    @SerializedName("asr_enabled") val isAsrEnabled: Boolean = false,
    @SerializedName("tts_enabled") val isTtsEnabled: Boolean = false,
    /**
     * Whether the agentic answer should be streamed for THIS language. Sent back on every
     * text-prompt request as `TextPromptRequest.streaming_required` (the app persists it under
     * `is_streaming_required`); it does not gate the stream — docs/02 §#27a.
     */
    @SerializedName("streaming_required") val streaming_required: Boolean = true,
    @SerializedName("country_phone_code") val countryPhoneCode: String = ""
)

data class SupportedLanguageGroup(
    @SerializedName("display_name") val displayName: String = "",
    val flag: String = "",
    @SerializedName("priority_view") val priorityView: List<SupportedLanguage> = emptyList(),
    @SerializedName("expanded_view") val expandedView: List<SupportedLanguage> = emptyList(),
    /**
     * Pre-v2 shape of the same endpoint (`api/language/country_wise_supported_languages/`): one flat
     * list per group instead of priority/expanded views. Served by host backends still on it;
     * normalised into [priorityView] by [normalized]. Absent from the v2 response.
     */
    @SerializedName("languages") val languages: List<SupportedLanguage>? = null
) {
    /** v2 as-is; a pre-v2 group's flat [languages] becomes its [priorityView]. */
    fun normalized(): SupportedLanguageGroup =
        if (priorityView.isEmpty() && expandedView.isEmpty() && !languages.isNullOrEmpty()) {
            copy(priorityView = languages)
        } else this
}

typealias LanguageLabelsResponse = Map<String, String>

// ---------------- Preferred language ----------------

data class SetPreferredLanguageRequest(
    val user_id: String,
    val language_id: String
)

data class SetPreferredLanguageResponse(
    val user_id: String
)

// ---------------- Terms & privacy ----------------

data class AcceptPPandTCRequest(
    val user_id: String
)

data class AcceptPPandTCResponse(
    val message: String,
    val success: Boolean,
    val terms_accepted: Boolean,
    val terms_accepted_at: String
)

data class PrivacyPolicyResponse(
    val url: String?,
    val leaderboard_privacy_policy_url: String?,
    val farmerchat_terms_of_use: String?,
    val leaderboard_terms_of_use: String?
)

data class LegalLinks(
    val privacyPolicyUrl: String?,
    val termsOfUseUrl: String?
)

/**
 * Endpoint #7a (`api/user/policy_acceptance_status/`, 2.0.0) — the mandatory Terms-of-Use
 * acceptance gate. 1:1 port of the app's `domain/model/policy/PolicyAcceptanceStatusResponse`;
 * field names verified against the live stage response 2026-09-03 (doc 02 §Endpoint #7a).
 *
 * `requires_acceptance == true` is the only signal that raises the gate. `terms_accepted` /
 * `terms_accepted_at` are informational — the app's UI never reads them.
 */
data class PolicyAcceptanceStatusResponse(
    val requires_acceptance: Boolean,
    val terms_accepted: Boolean,
    val terms_accepted_at: String?,
    val latest_policy_version: LatestPolicyVersion?
)

data class LatestPolicyVersion(
    val id: Int,
    val policy_type: String,
    val version_label: String,
    val published_at: String,
    val terms_of_service_url: String,
    val privacy_policy_url: String
)

// ---------------- Google Geolocation ----------------

data class GeoRequestBody(
    val considerIp: Boolean = true
)

data class GeoResponse(
    val location: GeoLocation?,
    val accuracy: Double
)

data class GeoLocation(
    val lat: Double?,
    val lng: Double?
)
