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
