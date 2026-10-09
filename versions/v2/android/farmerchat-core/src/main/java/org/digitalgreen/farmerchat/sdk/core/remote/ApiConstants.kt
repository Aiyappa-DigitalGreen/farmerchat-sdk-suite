package org.digitalgreen.farmerchat.sdk.core.remote

/** All main-API endpoint paths (doc 02). Dead app constants intentionally not carried over. */
object ApiConstants {
    // Token endpoints (AuthApi)
    const val AUTH_REFRESH = "api/user/get_new_access_token/"
    const val SEND_USER_TOKENS = "api/user/send_tokens/"

    // User / onboarding
    const val INITIALIZE_GUEST_USER = "api/user/initialize_user/"
    const val GET_COUNTRY_WISE_SUPPORTED_LANGUAGES = "api/language/v2/country_wise_supported_languages/"
    const val GET_LANGUAGE_LABELS = "api/language/v2/get_labels/"
    const val GET_PRIVACY_POLICY = "api/user/privacy_policy/"
    const val GET_ALL_COUNTRY_LISTS = "api/geography/get_all_countries/"
    const val POST_SET_PREFERRED_LANGUAGE = "api/user/set_preferred_language/"
    const val ACCEPT_PP_AND_TC = "api/user/accept_terms/"

    /**
     * #7a — mandatory Terms-of-Use acceptance gate (2.0.0). GET, `user_id` required
     * (omitted → 400 `{"error":"user_id is required"}`). See doc 02 §Endpoint #7a.
     */
    const val POLICY_ACCEPTANCE_STATUS = "api/user/policy_acceptance_status/"
    const val UPDATE_USER_NAME = "api/user/update_user_profile/"
    const val GET_USER_PROFILE = "api/user/view_user_profile/"
    const val UPDATE_BUILD_VERSION = "api/user/v2/update_build_version/"
    const val UPDATE_USER_LOCATION = "api/user/update_user_location/"

    // Home
    const val HOME = "api/images/v2/daily/"
    const val WEATHER = "api/weather/v2/weather_forecast_lite/"
    const val UPDATE_CULTIVATED_CROPS = "api/user/update_crop_details/"
    const val MARK_IMAGE_VIEWED = "api/images/v2/viewed/"
    const val IMAGE_STATEMENT = "api/images/v2/statement/"
    const val GET_USER_QUESTION_COUNT = "api/images/v2/user_question_count/"

    // Chat
    const val NEW_CONVERSATION = "api/chat/new_conversation/"
    const val TRANSCRIBE_AUDIO = "api/chat/transcribe_audio/"
    const val GET_TEXT_PROMPT = "api/chat/get_answer_for_text_query/"

    /**
     * #27a — agentic streaming answer (SDK 2.0.0, opt-in via
     * [FarmerChatConfig.enableAgenticChat]). Returns `text/event-stream`; see
     * [org.digitalgreen.farmerchat.sdk.core.remote.AgenticChatDataSource].
     */
    const val GET_TEXT_PROMPT_AGENTIC = "api/chat/get_answer_for_text_query_agentic/"
    const val GET_PLANTIX = "api/chat/image_analysis/"
    const val GET_FOLLOW_UP_QUESTIONS = "api/chat/follow_up_questions/"
    const val POST_TRACK_FOLLOW_UP_QUESTIONS = "api/chat/follow_up_question_click/"
    const val SYNTHESISE_AUDIO = "api/chat/synthesise_audio/"
    const val GET_CHAT_HISTORY = "api/chat/conversation_chat_history/"
    const val ADD_QUERY_TO_HISTORY = "api/chat/add_query_to_history/"

    // Auth (OTP)
    const val SEND_OTP = "api/user/generate_otp/"
    const val POST_CHECK_DEVICE_USER_LIMIT = "api/user/check_device_user_limit/"
    const val POST_WHATSAPP_VERIFICATION_LINK = "api/user/verify_otp_less_android_sdk_token/"
    const val GET_SMS_COMMUNICATION_CHANNEL = "api/geography/communication_channel/"
    const val VERIFY_OTP = "api/user/verify_otp/"

    // Menu / history / session
    const val GET_CONVERSATION_LIST = "api/chat/conversation_list/"
    const val POST_LOGOUT_APP = "api/user/logout/"

    // Help & Support (no trailing slash — some envs 404 with it)
    // Trailing slash is REQUIRED and load-bearing: the app declares `api/faqs/`
    // (fc-compose `ApiConstants.kt:31`, fc-compose-agentic `ApiConstants.kt:32`, and both
    // priority tables), and the react-native/web ports already had it. Android and iOS were the
    // two that dropped it, so Help was the one endpoint the SDK asked for on a different path
    // than the app.
    const val GET_HELP_SUPPORT = "api/faqs/"

    // Google Geolocation
    const val GEOLOCATION = "geolocate"
    const val GOOGLE_GEO_BASE_URL = "https://www.googleapis.com/"

    /**
     * Bundled FarmerChat `API-Key` (initialize_user / send_tokens), used when the host passes no
     * [FarmerChatConfig.farmerChatApiKey] (null or blank). Hosts are not asked to supply one.
     */
    const val DEFAULT_FARMERCHAT_API_KEY = "Y2K3kW5R9uQ0fL2X8zI7hT3aJ7"

    /**
     * Default Google Geolocation key, so an integrator gets a working location fallback without
     * having to obtain one. Overridable via [FarmerChatConfig.geoApiKey].
     *
     * ⚠️ NOT A SECRET, and it cannot be made into one. This ships inside the AAR: `unzip` the
     * artifact and `strings` the dex and it falls straight out. `internal` visibility, ProGuard
     * and native storage all only raise the effort — none of them prevent extraction from an
     * artifact that runs on someone else's device. Treat this exactly as you would a key printed
     * in the README.
     *
     * What you CAN do on the Google Cloud side, and what you cannot:
     *   - DO restrict this key to the **Geolocation API only**. That caps the blast radius of an
     *     extracted key to this one API instead of every API on the project.
     *   - Do NOT add the "Android apps" application restriction. That check relies on
     *     `X-Android-Package` + `X-Android-Cert` headers, and [GoogleGeoApi.geolocate] sends
     *     neither — it is a plain Retrofit POST with `?key=`. Turning it on would break
     *     geolocation for every host rather than protect the key. Making it viable means adding
     *     those headers AND registering each integrator's package + signing SHA-1, at which point
     *     those integrators can use the key for their own calls anyway.
     *   - IP restrictions are not usable either: the callers are phones on mobile networks.
     * So until the proxy below exists, an extracted key is billable against this project.
     *
     * The durable fix is to stop shipping it at all: proxy `geolocate` through the FarmerChat
     * backend, which already fronts every other call, and delete this constant. Tracked in
     * docs/05-open-questions.md.
     */
    const val DEFAULT_GEO_API_KEY = "AIzaSyBr13y53dIh6Pf6G0R6y_870o_x9d-jCSo"
}
