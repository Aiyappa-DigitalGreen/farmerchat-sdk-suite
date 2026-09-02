package org.digitalgreen.farmerchat.sdk.core.network.timeout

import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * API priority levels for timeout and retry configuration.
 *
 * | Priority | Timeout | Retries | Used by |
 * |---|---|---|---|
 * | P1 onboarding-fallback | 5 s  | 1 | geolocate |
 * | P2 no-fallback (default) | 10 s | 2 | most endpoints |
 * | P3 AI runtime | 30 s | 3 | text prompt, image analysis, follow-ups, synthesise, transcribe, chat history |
 */
enum class ApiPriority(val timeoutSeconds: Long, val retryCount: Int) {
    PRIORITY_1_ONBOARDING_FALLBACK(timeoutSeconds = 5L, retryCount = 1),
    PRIORITY_2_NO_FALLBACK(timeoutSeconds = 10L, retryCount = 2),
    PRIORITY_3_AI_RUNTIME(timeoutSeconds = 30L, retryCount = 3)
}

/**
 * Cross-thread carrier of per-call [ApiPriority]. A ThreadLocal covers the common
 * same-thread case; a URL/request-id keyed map covers OkHttp's dispatcher threads.
 * Port of the app's ApiPriorityContext (with the plantix priority mapped to the
 * real `image_analysis` endpoint — known app quirk fixed per spec).
 */
object ApiPriorityContext {
    private val priorityThreadLocal = ThreadLocal<ApiPriority?>()
    private val priorityMap = ConcurrentHashMap<String, ApiPriority>()

    const val HEADER_NAME = "X-Request-ID"

    fun setPriorityForApi(apiName: String, priority: ApiPriority) {
        priorityThreadLocal.set(priority)
        priorityMap[normalizeApiName(apiName)] = priority
    }

    fun setPriority(priority: ApiPriority) {
        priorityThreadLocal.set(priority)
    }

    /** Generate a request id header value and register the priority for it. */
    fun generateRequestId(priority: ApiPriority): String {
        val requestId = UUID.randomUUID().toString()
        priorityMap[requestId] = priority
        return requestId
    }

    fun getPriority(requestUrl: String? = null, requestId: String? = null): ApiPriority? {
        priorityThreadLocal.get()?.let { return it }
        requestId?.let { id -> priorityMap[id]?.let { return it } }
        requestUrl?.let { url -> priorityMap[normalizeApiName(url)]?.let { return it } }
        return null
    }

    fun clearPriority(apiName: String? = null, requestId: String? = null) {
        priorityThreadLocal.remove()
        requestId?.let { priorityMap.remove(it) }
        apiName?.let { priorityMap.remove(normalizeApiName(it)) }
    }

    private fun normalizeApiName(apiName: String): String {
        var path = apiName.split("?").first()

        // Strip environment base-path prefixes so lookups match regardless of env.
        path = path
            .removePrefix("/mobile-app-dev/")
            .removePrefix("/mobile-app-stage/")
            .removePrefix("/mobile-app-demo/")
            .removePrefix("/mobile-app/")
            .removePrefix("/")

        // Descriptive api names → real endpoint paths.
        val apiNameToEndpoint = mapOf(
            // Chat
            "get_text_prompt" to "api/chat/get_answer_for_text_query/",
            "get_plantix" to "api/chat/image_analysis/",
            "get_chat_history" to "api/chat/conversation_chat_history/",
            "new_conversation" to "api/chat/new_conversation/",
            "transcribe_audio" to "api/chat/transcribe_audio/",
            "synthesise_audio" to "api/chat/synthesise_audio/",
            "get_follow_up_questions" to "api/chat/follow_up_questions/",
            "track_follow_up_question_click" to "api/chat/follow_up_question_click/",
            "add_query_to_history" to "api/chat/add_query_to_history/",
            // Home
            "home_feed" to "api/images/v2/daily/",
            "weather" to "api/weather/v2/weather_forecast_lite/",
            "update_crops" to "api/user/update_crop_details/",
            "mark_image_viewed" to "api/images/v2/viewed/",
            "image_statement" to "api/images/v2/statement/",
            "user_question_count" to "api/images/v2/user_question_count/",
            // Auth
            "get_all_country_list" to "api/geography/get_all_countries/",
            "send_otp" to "api/user/generate_otp/",
            "verify_otp" to "api/user/verify_otp/",
            "get_otp_mode" to "api/geography/communication_channel/",
            "check_device_user_limit" to "api/user/check_device_user_limit/",
            "whatsapp_verification" to "api/user/verify_otp_less_android_sdk_token/",
            // Language
            "get_supported_languages" to "api/language/v2/country_wise_supported_languages/",
            "get_language_labels" to "api/language/v2/get_labels/",
            "set_preferred_language" to "api/user/set_preferred_language/",
            "accept_terms" to "api/user/accept_terms/",
            "get_privacy_policy" to "api/user/privacy_policy/",
            // User
            "initialize_guest_user" to "api/user/initialize_user/",
            "fetch_user_profile" to "api/user/view_user_profile/",
            "update_user_profile" to "api/user/update_user_profile/",
            "update_user_location" to "api/user/update_user_location/",
            "update_build_version" to "api/user/v2/update_build_version/",
            // History / session
            "get_conversation_list" to "api/chat/conversation_list/",
            "logout_app" to "api/user/logout/",
            // Help & Support
            "get_help_support" to "api/faqs/",
            // Google Geo API
            "geolocate" to "geolocate"
        )

        apiNameToEndpoint[path.lowercase()]?.let { path = it }
        return path.trimEnd('/').lowercase()
    }
}
