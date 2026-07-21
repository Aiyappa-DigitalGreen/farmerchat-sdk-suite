package org.digitalgreen.farmerchat.sdk.core.model

import java.io.Serializable

// ---------------- Token models ----------------

data class RefreshTokenRequest(
    val refresh_token: String
)

data class RefreshTokenResponse(
    val access_token: String?,
    val refresh_token: String?
)

data class SendNewTokenRequest(
    val device_id: String,
    val user_id: String
)

// ---------------- OTP / login models ----------------

data class SendOtpRequest(
    val phone: String,
    val phone_country_code: String,
    val channel: List<String>,
    val device_id: String,
    val user_id: String
)

data class SendOtpResponse(
    val message: String?,
    val detail: String?,
    val phone: String?,
    val phone_country_code: String?,
    val device_id: String?,
    val otp: String?,
    val user_id: String?
)

data class VerifyOtpRequest(
    val otp: String,
    val phone: String,
    val phone_country_code: String,
    val guest_onboarding: String,
    val user_id: String
)

data class PreferredLanguage(
    val asr_bcp_code: String?,
    val asr_enabled: Boolean?,
    val asr_inference_model: Any?,
    val asr_service_provider: String?,
    val code: String?,
    val created_by: Any?,
    val created_on: String?,
    val display_name: String?,
    val id: Int?,
    val is_active: Boolean?,
    val is_deleted: Boolean?,
    val latn_code: String?,
    val name: String?,
    val primary_speaking_countries: List<String>?,
    val translation_inference_model: Any?,
    val translation_service_provider: String?,
    val tts_bcp_code: String?,
    val tts_enabled: Boolean?,
    val tts_inference_model: Any?,
    val tts_service_provider: String?,
    val tts_voice_name: Any?,
    val updated_by: Any?,
    val updated_on: String?
)

data class VerifyOtpResponse(
    val access_token: String?,
    val refresh_token: String?,
    val crop_selection_enabled: Boolean?,
    val crop_id: Int?,
    val id: String?,
    val phone: String?,
    val email: String?,
    val role: String?,
    val phone_country_code: String?,
    val message: String?,
    val otp: String?,
    val preferred_language: PreferredLanguage?,
    val lat: String?,
    val existing_user: Boolean?,
    /** User's name for existing users. */
    val name: String?
)

data class WhatsappVerificationRequest(
    val phone_country_code: String,
    val phone: String,
    val token: String
)

data class CheckDeviceRequest(
    val device_id: String,
    val phone: String,
    val phone_country_code: String
)

class GetOtpModeResponse : ArrayList<GetOtpModeResponseItem>()

data class GetOtpModeResponseItem(
    val sms_enabled: Boolean,
    val whatsapp_enabled: Boolean
)

data class CountryItem(
    val code: String,
    val display_name: String,
    val flag: String,
    val id: Int,
    val name: String,
    val phone_country_code: String,
    val phone_length: Int,
    val phone_number_pattern: String? = null
) : Serializable

data class LogoutResponse(
    val message: String?
)

// ---------------- Guest init ----------------

data class InitializeGuestUserRequest(
    val device_id: String,
    val lat: Double? = null,
    val long: Double? = null,
    val accuracy: Double? = null,
    val utm_source: String? = null,
    val utm_medium: String? = null,
    val utm_campaign: String? = null,
    val moengage_id: String? = null,
    val google_advertise_id: String? = null
)

data class InitializeGuestUserResponse(
    val access_token: String,
    val refresh_token: String,
    val user_id: String?,
    val show_crops_livestocks: Boolean,
    val last_location_fetch_threshold: String?,
    val display_address: String?,
    val created_on: String?,
    val location_source: String?,
    val country_code: String?,
    val country: String?,
    val state: String?,
    val dashboard: Boolean?,
    val created_now: Boolean?,
    val geography_level3: String?,
    val geography_level4: String?,
    val geography_level5: String?,
    val geography_level6: String?,
    val ip_location_fallback_time_limit: Long
)
