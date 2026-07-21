package org.digitalgreen.farmerchat.sdk.core.analytics

import org.digitalgreen.farmerchat.sdk.FarmerChatAnalyticsListener
import org.digitalgreen.farmerchat.sdk.FarmerChatHooks

/** A single analytics event (same names/props as the production app). */
data class AnalyticsEvent(
    val name: String,
    val properties: Map<String, Any?> = emptyMap()
)

/**
 * SDK analytics dispatcher. The production app fans out to Firebase/MoEngage/
 * Plotline/Adjust; the SDK instead emits every event through the host-settable
 * [FarmerChatAnalyticsListener] (plus the optional config onEvent callback),
 * with identical event names and property keys.
 */
class FarmerChatAnalytics(
    private val configOnEvent: ((String, Map<String, Any?>) -> Unit)? = null,
    /** C4: semantic host hooks, dispatched from the same event stream. */
    private val hooks: FarmerChatHooks? = null
) {

    @Volatile
    var listener: FarmerChatAnalyticsListener? = null

    fun track(event: AnalyticsEvent) {
        runCatching { listener?.onEvent(event.name, event.properties) }
        runCatching { configOnEvent?.invoke(event.name, event.properties) }
        runCatching { dispatchHooks(event) }
    }

    /**
     * C4: maps known analytics events to the semantic [FarmerChatHooks]. These
     * fire from the same well-known emit sites the app already tracks, so payloads
     * are best-effort from event props where the raw value is available.
     */
    private fun dispatchHooks(event: AnalyticsEvent) {
        val h = hooks ?: return
        when (event.name) {
            AnalyticsEvents.SCREEN_VIEWED -> {
                val screen = event.properties[AnalyticsProps.SCREEN_NAME] as? String
                screen?.let { h.onScreenView?.invoke(it) }
                if (screen == AnalyticsScreens.CHAT) h.onChatOpened?.invoke()
            }
            AnalyticsEvents.SEND_QUERY_INITIATED -> {
                val text = (event.properties[AnalyticsProps.TEXT]
                    ?: event.properties[AnalyticsProps.TEXT_QUERY]) as? String
                h.onMessageSent?.invoke(text ?: "")
            }
            AnalyticsEvents.SEND_QUERY -> {
                val id = (event.properties["message_id"] ?: event.properties["messageId"]) as? String
                h.onAnswerReceived?.invoke(id ?: "")
            }
            AnalyticsEvents.API_CALL_FAILED, AnalyticsEvents.API_CALL_TIMEOUT -> {
                val code = (event.properties["code"] as? Int)
                    ?: (event.properties["code"] as? Number)?.toInt() ?: -1
                val msg = (event.properties[AnalyticsProps.FAILURE_REASON]
                    ?: event.properties[AnalyticsProps.API_NAME]) as? String
                h.onError?.invoke(code, msg ?: "")
            }
            // onSessionStart is fired deterministically from FarmerChat.initialize().
        }
    }

    fun track(name: String, properties: Map<String, Any?> = emptyMap()) {
        track(AnalyticsEvent(name, properties))
    }

    fun trackScreenView(screenName: String, extra: Map<String, Any?> = emptyMap()) {
        track(
            AnalyticsEvents.SCREEN_VIEWED,
            mapOf(AnalyticsProps.SCREEN_NAME to screenName) + extra
        )
    }

    fun trackScreenExit(screenName: String, extra: Map<String, Any?> = emptyMap()) {
        track(
            AnalyticsEvents.SCREEN_EXITED,
            mapOf(AnalyticsProps.SCREEN_NAME to screenName) + extra
        )
    }
}

/** Screen names, mirroring the app's AnalyticsScreens. */
object AnalyticsScreens {
    const val SPLASH = "Splash Screen"
    const val LANGUAGE = "Select Language Screen"
    const val LANGUAGE_SETTINGS = "Language Settings Screen"
    const val NAME = "Enter Name Screen"
    const val HOME = "Dashboard Screen"
    const val GPS = "GPS Screen"
    const val GPS_INTERSTITIAL = "GPS Interstitial Screen"
    const val AUTH = "Login Screen"
    const val VERIFY_OTP = "Verify OTP Screen"
    const val SELECT_COUNTRY = "Select Country Screen"
    const val ACCOUNT_BENEFIT = "Account Benefit Screen"
    const val ACCOUNT_SUCCESS = "Account Success Screen"
    const val CHAT = "Chat Screen"
    const val CHAT_HISTORY = "Chat History Screen"
    const val HELP = "Help & Support Screen"
    const val SETTINGS = "Settings Screen"
    const val SETTINGS_NAME = "Settings Name Screen"
    const val ERROR = "Error Screen"
}

/** Property keys, mirroring the app's AnalyticsProps (including sheet typos, kept intentionally). */
object AnalyticsProps {
    const val SCREEN_NAME = "screen_name"
    const val API_NAME = "API_Name"
    const val LANGUAGE_CODE = "langauge_code" // typo kept as per analytics sheet
    const val TRIGGER = "Trigger"
    const val ATTEMPT = "Attempt"
    const val PERMISSION_TYPE = "Permission_type"
    const val CARD_TYPE = "Card_Type"
    const val CARD_CATEGORY = "Card_category"
    const val IMAGE_ID = "image_id"
    const val SENTENCE_ID = "sentence_id"
    const val TEXT = "Text"
    const val VIEWS = "Views"
    const val COUNTRY = "Country"
    const val COUNTY = "County"
    const val STATE = "State"
    const val ASSET_TYPE = "Asset_Type"
    const val ASSET_NAME = "Asset_Name"
    const val STAGE = "Stage"
    const val CONCERN = "Concern"
    const val DATE_RANGE = "Date Range"
    const val CARD_POSITION = "Card_Position"
    const val VALUE = "Value"
    const val ICON_TYPE = "Icon"
    const val OPTION = "Option"
    const val INPUT_TYPE = "Input_type"
    const val SOURCE = "Source"
    const val FAILURE_REASON = "Failure_Reason"
    const val CONFIDENCE_SCORE = "Confidence_Score"
    const val NO_OF_SECONDS_PLAYED = "No_of_seconds_played"
    const val STARTER_PROMPT = "starter_prompt"
    const val FOLLOWUP_PROMPT = "followup_prompt"
    const val IMAGE_QUERY = "image_query"
    const val TEXT_QUERY = "text_query"
    const val VOICE_QUERY = "voice_query"
    const val WEATHER_ADVICE_CTA = "weather_advice_cta"
    const val LENGTH_OF_AUDIO_IN_SECONDS = "length_of_audio_in_seconds"
    const val LENGTH_OF_TEXT_QUERY = "length_of_Text_query"
    const val SIZE_OF_IMAGE_KB = "size_of_image_kb"
    const val AUDIO_FORMAT = "audio_format"
    const val VALID_QUERY = "Valid_Query"
    const val CLARIFICATION_NEEDED_ASSET = "clarification_needed_asset"
    const val CLARIFICATION_NEEDED_CONCERN = "clarification_needed_concern"
    const val ONBOARDING_QUERY = "isOnnboarding_query" // typo kept as per analytics sheet
    const val TYPE = "type"
    const val CLICK_TYPE = "click_type"
    const val INTENT = "intent"
    const val ASSET_TYPE_QUERY = "asset_type"
    const val ASSET_NAME_QUERY = "asset_name"
    const val CONCERN_QUERY = "concern"
    const val STAGE_QUERY = "stage"
}

/** Event names, mirroring the app's analytics constant objects (~90+ events). */
object AnalyticsEvents {
    // App lifecycle
    const val APP_INSTALLED = "App_Installed"
    const val APP_UPDATED = "App_Updated"
    const val APP_OPENED = "App_Opened"
    const val SCREEN_VIEWED = "Screen_Viewed"
    const val SCREEN_EXITED = "Screen_Exited"

    // API tracking
    const val API_CALL_INITIATED = "API_Call_Initiated"
    const val API_CALL_SUCCESS = "API_Call_Success"
    const val API_CALL_FAILED = "API_Call_Failed"
    const val API_CALL_TIMEOUT = "API_Call_Timeout"

    // Onboarding
    const val FIRST_TIME_ONBOARDING_COMPLETED = "FirstTimeOnboardingCompleted"
    const val DEVICE_LOCATION_FETCH_INITIATED = "Device_Location_Fetch_Initiated"
    const val DEVICE_LOCATION_FETCH_SUCCEEDED = "Device_Location_Fetch_Succeded" // as per sheet
    const val DEVICE_LOCATION_FETCH_FAILED = "Device_Location_Fetch_Failed"
    const val WELCOME_SCREEN_GET_STARTED_BUTTON_CLICK = "Welcome_Screen_Get_Started_Button_Click"
    const val ONBOARDING_COMPLETED_STEP1 = "Onboarding_completed_Step1"
    const val ONBOARDING_COMPLETED_STEP2 = "Onboarding_completed_Step2"
    const val SAVE_LANGUAGE_CLICK = "Save_Language_Click_Event"
    const val TERMS_OF_USE_OPENED = "terms_of_use_opened"
    const val PRIVACY_POLICY_OPENED = "privacy_policy_opened"
    const val ONBOARDING_COMPLETED = "Onboarding_completed"

    // Auth
    const val ACCOUNT_BENEFIT_SCREEN_PROCEED = "Account_Benefit_Screen_Proceed"
    const val ACCOUNT_BENEFIT_SCREEN_SKIP = "Account_Benefit_Screen_Skip"
    const val SEND_OTP_CLICK_EVENT = "Send_OTP_Click_Event"
    const val MOBILE_VERIFICATION_STARTED = "Mobile_verification_Started"
    const val RESEND_OTP_CLICK_EVENT = "Resend_OTP_Click_Event"
    const val SUBMIT_OTP = "Submit_OTP"
    const val REGISTRATION_COMPLETED = "Registration_Completed"
    const val LOGIN_COMPLETED = "Login_Completed"
    const val SIGNUP_CONTINUE_CLICKED = "Signup_Continue_Clicked"
    const val COUNTRY_SELECTED = "Country_selected"
    const val OTP_LOCKOUT_REACHED = "OTP_Lockout_Reached"
    const val START_OVER_CLICKED = "Start_Over_Clicked"

    // Name
    const val NAME_SAVE_CLICK = "Name_Save_Click_Event"
    const val NAME_SKIP_CLICK = "Name_Skip_Click_Event"

    // Home / dashboard
    const val FIRST_TIME_DASHBOARD_VIEWED = "FirstTimeDashboardViewed"
    const val DASHBOARD_VIEWED = "Dashboard_Viewed"
    const val CONTENT_TRY_AGAIN_CLICKED = "Content_Try_Again_Clicked"
    const val CARD_SHOWN = "Card_Shown"
    const val CARD_VIEWED = "Card_Viewed"
    const val CARD_CLICKED = "Card_Clicked"
    const val QUESTION_CARD_DATA_SUBMITTED = "question_card_data_Submitted"
    const val HAMBURGER_MENU_CLICKED = "Hamburger_Menu_Clicked"
    const val CHAT_ICON_CLICKED = "Chat_Icon_Clicked"
    const val MICROPHONE_CLICK_EVENT = "Microphone_Click_Event"
    const val IMAGE_OPTION_DIALOG_CLICK_EVENT = "Image_Option_Dialog_Click_Event"
    const val WEATHER_FORECAST_VIEWED = "Weather_Forecast_Viewed"

    // Permissions
    const val PERMISSION_POPUP_SHOWN = "Permission_popup_shown"
    const val PERMISSION_GRANTED = "Permission_granted"
    const val PERMISSION_DENIED = "Permission_denied"
    const val PERMISSION_FALLBACK_SETTING_SHOWN = "Permission_Fallback_Default_Setting_Shown"
    const val PERMISSION_FALLBACK_SETTING_CLICKED = "Permission_Fallback_Default_Setting_Clicked"
    const val PERMISSION_FALLBACK_SETTING_CANCELED = "Permission_Fallback_Default_Setting_Canceled"
    const val INPUT_CAPTURE_FAILED = "Input_Capture_Failed"

    // Voice
    const val SEND_RECORD_AUDIO_CLICK_EVENT = "Send_Record_Audio_Click_Event"
    const val CANCEL_RECORD_AUDIO_CLICK_EVENT = "Cancel_Record_Audio_Click_Event"
    const val TRANSCRIPTION_SUCCESS = "Transcription_Success"
    const val TRANSCRIPTION_FAILED = "Transcription_Failed"

    // GPS / location
    const val LOCATION_PERMISSION_ALLOWED = "location_permission_allowed"
    const val LOCATION_PERMISSION_ALLOW = "location_permission_allow"
    const val LOCATION_PERMISSION_DENY = "location_permission_deny"
    const val LOCATION_FALLBACK_USED_IP_BASED_LOCATION = "location_fallback_used_ip_based_location"
    const val LOCATION_FETCH_FAILED_TIMEOUT = "location_fetch_failed_timeout"
    const val LOCATION_FETCH_SUCCESS = "location_fetch_success"
    const val LOCATION_FETCH_FAILED = "location_fetch_failed"
    const val LOCATION_SETTINGS_UPDATE_LOCATION_CLICKED = "location_settings_update_location_clicked"
    const val LOCATION_SETTINGS_LOCATION_PERMISSION_CLICKED = "location_settings_location_permission_clicked"
    const val LOCATION_PERMISSION_PROMPT_TRIGGERED = "location_permission_prompt_triggered"
    const val LOCATION_UPDATE_FAILURE = "location_update_failure"
    const val LOCATION_UPDATE_SUCCESS = "location_update_success"
    const val LOCATION_SETTINGS_OPENED = "location_settings_opened"
    const val LOCATION_UPDATE_TRIGGERED = "Location_Update_Triggered"

    // Menu / navigation
    const val PROFILE_CLICK = "Profile_Click"
    const val LOGOUT_CLICK_EVENT = "Logout_Click_Event"
    const val CHAT_HISTORY_CLICK = "Chat_History_Click"
    const val CHAT_SCREEN_BACK_BUTTON_CLICK = "Chat_Screen_Back_Button_Click"
    const val NEW_CHAT_CLICK = "New_Chat_Click"
    const val MENU_OPTION_CLICK_EVENT = "Menu_Option_Click_Event"
    const val CHAT_HISTORY_CLICK_EVENT = "Chat_History_Click_Event"
    const val NEW_CHAT_CLICK_EVENT = "New_Chat_Click_Event"
    const val ACCOUNT_PREFERENCE_CLICK = "Account_Preference_Click"
    const val EDIT_PROFILE_CLICK = "Edit_Profile_Click"

    // Chat
    const val SHARE_BUTTON_CLICKED = "Answer_Share_Button_Clicked"
    const val SAVE_BUTTON_CLICKED = "Answer_Save_Button_Clicked"
    const val SEND_QUERY = "Send_Query"
    const val SEND_QUERY_INITIATED = "Send_Query_Initiated"
    const val STARTER_QUESTIONS_GENERATED = "Starter_Questions_Generated"
    const val STARTED_PLAYING_RESPONSE_AUDIO = "Started_Playing_Response_Audio"
    const val STOPPED_PLAYING_RESPONSE_AUDIO = "Stopped_Playing_Response_Audio"
    const val FIRST_QUERY_ASKED = "FirstQueryAsked"

    // Settings / help
    const val FAQ_CLICKED = "FAQ_Clicked"
    const val SETTINGS_OPTION_SELECTED = "Settings_Option_Selected"
}

/**
 * Payload for Send_Query_Initiated and Send_Query analytics events.
 * Build when a query is sent (text/image/voice), then add response fields for Send_Query.
 */
data class SendQueryProperties(
    val screenName: String,
    val isFollowupPrompt: Boolean,
    val isImageQuery: Boolean,
    val isTextQuery: Boolean,
    val isVoiceQuery: Boolean,
    val isWeatherAdviceCTA: Boolean = false,
    val lengthOfAudioInSeconds: Long = 0L,
    val lengthOfTextQuery: Int = 0,
    val sizeOfImageKb: Int = 0,
    /** Only set for voice (e.g. "ogg", "aac"); empty string for text/image. */
    val audioFormat: String = "",
    val isOnboardingQuery: Boolean = false,
    val isSSFR: Boolean = false,
    val isPush: Boolean = false,
    val isInApp: Boolean = false,
    val isImageCard: Boolean = false,
    val isTextCard: Boolean = false,
    val isReadFullAdvice: Boolean = false,
    // Send_Query only (from API response)
    val isValidQuery: Boolean? = null,
    val assetType: String? = null,
    val assetName: String? = null,
    val concern: String? = null,
    val stage: String? = null,
    val intent: String? = null,
    val clarificationNeededAsset: Boolean = false,
    val clarificationNeededConcern: Boolean = false,
    /** From deep link ?channel=; overrides click_type when non-null. */
    val channel: String? = null
) {
    fun toAnalyticsProperties(): Map<String, Any?> {
        val type = when {
            isImageQuery -> "image"
            isTextQuery -> "text"
            isVoiceQuery -> "voice"
            else -> "text"
        }
        val clickType = when {
            isReadFullAdvice -> "read_full_advice"
            isFollowupPrompt -> "follow-up"
            isImageCard -> "Image_Card"
            isTextCard -> "Text_Card"
            isWeatherAdviceCTA -> "Weather"
            isSSFR -> "SSFR"
            isPush -> "Push"
            isInApp -> "in-app"
            isOnboardingQuery -> "onboarding_query"
            !channel.isNullOrBlank() -> channel
            else -> type
        }
        return buildMap {
            put(AnalyticsProps.SCREEN_NAME, screenName)
            put(AnalyticsProps.FOLLOWUP_PROMPT, isFollowupPrompt)
            put(AnalyticsProps.IMAGE_QUERY, isImageQuery)
            put(AnalyticsProps.TEXT_QUERY, isTextQuery)
            put(AnalyticsProps.VOICE_QUERY, isVoiceQuery)
            put(AnalyticsProps.WEATHER_ADVICE_CTA, isWeatherAdviceCTA)
            put(AnalyticsProps.LENGTH_OF_AUDIO_IN_SECONDS, if (isVoiceQuery) lengthOfAudioInSeconds else 0L)
            put(AnalyticsProps.LENGTH_OF_TEXT_QUERY, if (isTextQuery) lengthOfTextQuery else 0)
            put(AnalyticsProps.SIZE_OF_IMAGE_KB, if (isImageQuery) sizeOfImageKb else 0)
            put(AnalyticsProps.AUDIO_FORMAT, if (isVoiceQuery && audioFormat.isNotBlank()) audioFormat else "")
            put(AnalyticsProps.ONBOARDING_QUERY, isOnboardingQuery)
            put(AnalyticsProps.TYPE, type)
            put(AnalyticsProps.CLICK_TYPE, clickType)
            isValidQuery?.let { put(AnalyticsProps.VALID_QUERY, it) }
            put(AnalyticsProps.ASSET_TYPE_QUERY, assetType?.takeIf { it.isNotBlank() } ?: "")
            put(AnalyticsProps.ASSET_NAME_QUERY, assetName?.takeIf { it.isNotBlank() } ?: "")
            put(AnalyticsProps.CONCERN_QUERY, concern?.takeIf { it.isNotBlank() } ?: "")
            put(AnalyticsProps.STAGE_QUERY, stage?.takeIf { it.isNotBlank() } ?: "")
            put(AnalyticsProps.INTENT, intent?.takeIf { it.isNotBlank() } ?: "")
            put(AnalyticsProps.CLARIFICATION_NEEDED_ASSET, clarificationNeededAsset)
            put(AnalyticsProps.CLARIFICATION_NEEDED_CONCERN, clarificationNeededConcern)
        }
    }
}
