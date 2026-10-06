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
    private val hooks: FarmerChatHooks? = null,
    /** User IDENTITY sink — see [org.digitalgreen.farmerchat.sdk.FarmerChatConfig.onUserIdentified]. */
    private val configOnUserIdentified: ((String) -> Unit)? = null,
    /** User ATTRIBUTE sink — see [org.digitalgreen.farmerchat.sdk.FarmerChatConfig.onUserAttribute]. */
    private val configOnUserAttribute: ((String, String) -> Unit)? = null,
    /**
     * Telemetry master switch — [org.digitalgreen.farmerchat.sdk.FarmerChatConfig.enableAnalytics],
     * default FALSE.
     *
     * Everything upstream of this class is unchanged when it is false: events are still
     * constructed with their real names and properties, at the real call sites, in the real
     * order. They are dropped HERE, at the single dispatch point, so turning telemetry on later
     * cannot change any other behaviour.
     */
    private val enabled: Boolean = false
) {

    @Volatile
    var listener: FarmerChatAnalyticsListener? = null

    fun track(event: AnalyticsEvent) {
        if (enabled) {
            runCatching { listener?.onEvent(event.name, event.properties) }
            runCatching { configOnEvent?.invoke(event.name, event.properties) }
        }
        // Semantic hooks are NOT telemetry — they are product callbacks the host wired for
        // behaviour (onChatOpened / onMessageSent / onAnswerReceived / onScreenView / onError).
        // Gating them would be a functional regression, so they fire either way.
        runCatching { dispatchHooks(event) }
    }

    /**
     * Identity, not an event: the app's `AnalyticsUserIdentityManager.identifyUser()` moment.
     * Blank ids are dropped (the app returns early on an empty id too), and a throwing host
     * callback is swallowed — identity reporting must never break the session it describes.
     *
     * Deliberately NOT routed through [FarmerChatAnalyticsListener]: that is a `fun interface`
     * and a second abstract method would break every host's SAM lambda.
     */
    fun identifyUser(userId: String) {
        val id = userId.trim()
        if (id.isEmpty()) return
        if (!enabled) return
        runCatching { configOnUserIdentified?.invoke(id) }
    }

    /**
     * A user PROPERTY (MoEngage `setUserAttribute` / Firebase `setUserProperty` in the app), not
     * an event property. Blank keys/values are dropped, matching the app's own
     * `if (name.isNotBlank())` guards at the carrier call site.
     */
    fun setUserAttribute(key: String, value: String) {
        if (key.isBlank() || value.isBlank()) return
        if (!enabled) return
        runCatching { configOnUserAttribute?.invoke(key, value) }
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

    // ------------------------------------------------------------------ API_Call_* family
    //
    // The app inlines these four at every ViewModel call site with exactly
    // `{screen_name, API_Name}` (see app OnboardingSharedViewModel.kt:205/222/239/257,
    // HomeViewModel.kt:326/351/404, SettingsViewModel.kt:53/70/107/119,
    // EnterNameViewModel.kt:53/71/109/122, LocationPromptHost.kt:456/487/627/661).
    // The helpers below keep the emitted payload identical while removing the
    // copy-paste; `API_Call_Timeout` vs `API_Call_Failed` is selected by
    // `ApiResult.Error.isTimeout`, as the app does.

    fun trackApiInitiated(apiName: String, screenName: String) {
        track(
            AnalyticsEvents.API_CALL_INITIATED,
            mapOf(AnalyticsProps.SCREEN_NAME to screenName, AnalyticsProps.API_NAME to apiName)
        )
    }

    fun trackApiSuccess(apiName: String, screenName: String) {
        track(
            AnalyticsEvents.API_CALL_SUCCESS,
            mapOf(AnalyticsProps.SCREEN_NAME to screenName, AnalyticsProps.API_NAME to apiName)
        )
    }

    fun trackApiFailed(apiName: String, screenName: String) {
        track(
            AnalyticsEvents.API_CALL_FAILED,
            mapOf(AnalyticsProps.SCREEN_NAME to screenName, AnalyticsProps.API_NAME to apiName)
        )
    }

    fun trackApiTimeout(apiName: String, screenName: String) {
        track(
            AnalyticsEvents.API_CALL_TIMEOUT,
            mapOf(AnalyticsProps.SCREEN_NAME to screenName, AnalyticsProps.API_NAME to apiName)
        )
    }

    /** `API_Call_Timeout` when the error was a timeout, else `API_Call_Failed` (app parity). */
    fun trackApiError(apiName: String, screenName: String, isTimeout: Boolean) {
        if (isTimeout) trackApiTimeout(apiName, screenName) else trackApiFailed(apiName, screenName)
    }

    // ------------------------------------------------------------------ home feed cards

    /**
     * Card_Shown / Card_Viewed / Card_Clicked, ported from the app's
     * `AnalyticsManager.trackHomeCardEvent` (app AnalyticsManager.kt:186-226).
     *
     * Quirks preserved verbatim from the app:
     * - `screen_name` is always the Dashboard screen, whatever surface raised the card.
     * - the `State` key carries `data.county` (`AnalyticsProps.STATE to data.county`);
     *   the app declares `County` but never emits it.
     * - `Value` is appended only when a value is supplied (question-card Card_Clicked).
     */
    fun trackHomeCardEvent(
        eventName: String,
        data: HomeCardAnalytics,
        value: String? = null
    ) {
        val baseProps = mapOf(
            AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME,
            AnalyticsProps.CARD_TYPE to data.cardType,
            AnalyticsProps.CARD_CATEGORY to data.cardCategory,
            AnalyticsProps.IMAGE_ID to data.imageId,
            AnalyticsProps.SENTENCE_ID to data.sentenceId,
            AnalyticsProps.TEXT to data.text,
            AnalyticsProps.VIEWS to data.views,
            AnalyticsProps.COUNTRY to data.country,
            AnalyticsProps.STATE to data.county,
            AnalyticsProps.ASSET_TYPE to data.assetType,
            AnalyticsProps.ASSET_NAME to data.assetName,
            AnalyticsProps.STAGE to data.stage,
            AnalyticsProps.CONCERN to data.concern,
            AnalyticsProps.DATE_RANGE to data.dateRange,
            AnalyticsProps.CARD_POSITION to data.cardPosition
        )
        track(
            eventName,
            if (value != null) baseProps + (AnalyticsProps.VALUE to value) else baseProps
        )
    }
}

/**
 * Home-feed card analytics payload, a 1:1 port of the app's `HomeCardAnalytics`
 * (app core/analytics/HomeCardAnalytics.kt).
 */
data class HomeCardAnalytics(
    val cardType: String,
    val cardCategory: String,
    val imageId: String? = null,
    val sentenceId: String? = null,
    val text: String? = null,
    val views: String? = null,
    val country: String? = null,
    val county: String? = null,
    val assetType: String = "",
    val assetName: String? = null,
    val stage: String? = null,
    val concern: String? = null,
    val dateRange: String? = null,
    /** e.g. `"image 1"`, `"statement 2"` along the visible feed; empty for other card types. */
    val cardPosition: String = ""
)

/**
 * `API_Name` property values, a 1:1 port of the app's `AnalyticsApis`
 * (app core/analytics/AnalyticsApis.kt). These strings are what the host's
 * dashboards group by — do not paraphrase them.
 */
object AnalyticsApis {
    const val IP_GEO = "IP Geolocation"
    const val INITIALIZE_GUEST = "Initialise user"
    const val SET_LANGUAGE = "Set Language Preference"
    const val GET_LANGUAGES = "Get Supported Languages"
    const val UPDATE_PROFILE = "Update Profile"
    const val GET_LEGAL_LINKS = "Privacy Policy"
    const val HOME_FEED = "Dashboard Content"
    const val WEATHER = "Weather"

    // GPS / Location
    const val GPS_FETCH_FRESH_LOCATION = "GPS Fetch fresh location"
    const val UPDATE_USER_LOCATION = "Update user location"
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
    const val HELP = "Help & Support Screen"
    const val SETTINGS = "Settings Screen"

    /** "Read Terms" content screen opened from the mandatory Terms-of-Use acceptance gate on Home. */
    const val TERMS_OF_USE_CONTENT_SCREEN = "Terms of Use Content Screen"

    // ---------------------------------------------------------------- SDK-only screen names
    // The app's AnalyticsScreens has no constant for these three surfaces (the app's
    // Chat-History / Settings-Name screens never call trackScreenView, and it has no
    // error screen). They are SDK additions, recorded in docs/04-parity-matrix.md.
    const val CHAT_HISTORY = "Chat History Screen"
    const val SETTINGS_NAME = "Settings Name Screen"
    const val ERROR = "Error Screen"

    // ---------------------------------------------------------------- app call-site literals
    // The app passes these as raw string literals rather than through AnalyticsScreens,
    // and they are NOT the same strings as the constants above. Kept character-for-character.

    /** `screen_name` on `Chat_History_Click_Event` (app DrawerContent.kt:133). */
    const val MENU_LITERAL = "Menu"

    /** `screen_name` on `Chat_History_Click` (app DrawerContent.kt:368). */
    const val SIDE_MENU_LITERAL = "Side Menu"

    /** `screen_name` on `New_Chat_Click_Event` (app ChatHistoryScreen.kt:187). */
    const val CHAT_HISTORY_LITERAL = "Chat History screen"

    /** `screen_name` on `FAQ_Clicked` (app HelpScreen.kt:201). */
    const val HELP_LITERAL = "Help and support screen"

    /** `screen_name` on `ToS_Aug26_Accept_Terms` from the dialog (app TermsOfUseDialog.kt:161). */
    const val TERMS_OF_USE_DIALOG_LITERAL = "TermsOfUseDialog"
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
    // ---- agentic alignment chips (2.0.0). Values copied character-for-character from the app's
    // `core/analytics/AnalyticsProps.kt`. The four status values come from the CONSTANTS, not from
    // that file's KDoc: the doc comment says "skipped_manual" / "shown" / "not_shown" while the
    // constants say "skipped" / "available" / "none", and `toAnalyticsProperties()` compares
    // against the constants — so the KDoc is what the app never actually sends.
    const val AGENTIC_CHIP_STATUS = "agentic_chip_status"
    /** The user tapped a chip. */
    const val CHIP_STATUS_SELECTED = "selected"
    /** A chip was on screen and unselected; the user typed / spoke / uploaded instead. */
    const val CHIP_STATUS_SKIPPED = "skipped"
    /** This query's RESPONSE presented a chip the user has not reacted to yet. */
    const val CHIP_STATUS_AVAILABLE = "available"
    /** No chip involved: none pending when sent, none in the response. */
    const val CHIP_STATUS_NONE = "none"
    const val AGENTIC_CHIP_SKIPPED_TYPE = "agentic_chip_skipped_type"
    const val AGENTIC_CHIP_SHOWN_TYPE = "agentic_chip_shown_type"
    const val AGENTIC_CHIP_TYPE = "agentic_chip_type"
    const val AGENTIC_CHIP_VALUE = "agentic_chip_value"
    const val AGENTIC_CHIP_LABEL = "agentic_chip_label"
    const val INTENT = "intent"
    const val ASSET_TYPE_QUERY = "asset_type"
    const val ASSET_NAME_QUERY = "asset_name"
    const val CONCERN_QUERY = "concern"
    const val STAGE_QUERY = "stage"

    // ---------------------------------------------------------------- app call-site literals
    // Keys the app passes as raw string literals at the call site rather than through its
    // AnalyticsProps object. Values are taken verbatim from the app source; note that several
    // are lowercase or contain a space and are therefore NOT the same key as the
    // similarly-named constants above (`option` != `Option`, `Conversation ID` != `conversation_id`).

    /** `Country_selected` (app AuthScreen.kt:227) — carries the ISO country code, not the name. */
    const val COUNTRY_CODE = "country_code"

    /** `Send_OTP_Click_Event` / `Resend_OTP_Click_Event` / `OTP_Lockout_Reached` (app AuthScreen.kt:161/178/198, AuthViewModel.kt:479/494). */
    const val CHANNEL = "channel"

    /** `Mobile_verification_Started` (app AuthScreen.kt:320) — lowercase, unlike `Trigger`. */
    const val TRIGGER_LOWER = "trigger"

    /** `Login_Completed` (app AuthViewModel.kt:635). */
    const val USER_ID = "user_id"

    /** `Login_Completed` (app AuthViewModel.kt:635) — emitted as a String, not a Boolean. */
    const val IS_NEW_USER = "is_new_user"

    /** `Submit_OTP` (app AuthViewModel.kt:724/798). */
    const val VERIFICATION_STATUS = "verification_status"

    /** `Submit_OTP` / `OTP_Lockout_Reached` (app AuthViewModel.kt:479/724/798). */
    const val ERROR_MESSAGE = "error_message"

    /** `Submit_OTP` failure branch (app AuthViewModel.kt:798). */
    const val ATTEMPT_NUMBER = "attempt_number"

    /** `OTP_Lockout_Reached` (app AuthViewModel.kt:479/494). */
    const val LOCKOUT_TYPE = "lockout_type"

    /** `Menu_Option_Click_Event` / `Settings_Option_Selected` (app DrawerContent.kt:120, SettingsScreen.kt:150) — lowercase, unlike `Option`. */
    const val OPTION_LOWER = "option"

    /** `Settings_Option_Selected` (app SettingsScreen.kt:150) — lowercase, unlike `Value`. */
    const val VALUE_LOWER = "value"

    /** `Chat_History_Click` (app DrawerContent.kt:368). */
    const val CONVERSATION_ID = "conversation_id"

    /** `Chat_History_Click` (app DrawerContent.kt:368). */
    const val QUESTION_INDEX = "question_index"

    /** `New_Chat_Click_Event` (app ChatHistoryScreen.kt:187) — capitalised, with a space. */
    const val CONVERSATION_ID_SPACED = "Conversation ID"

    /** `FAQ_Clicked` (app HelpScreen.kt:201). */
    const val QUESTION = "Question"

    /** `FAQ_Clicked` (app HelpScreen.kt:201). */
    const val ID = "ID"

    /** `ToS_Aug26_Accept_Terms` (app HomeScreen.kt:729, TermsOfUseDialog.kt:161) — emitted as a Boolean. */
    const val ACCEPTED = "Accepted"

    /** `question_card_data_Submitted` (app HomeScreen.kt:1462). */
    const val CROPS = "crops"

    /** `question_card_data_Submitted` (app HomeScreen.kt:1492). */
    const val LIVESTOCK = "livestock"

    /** `question_card_data_Submitted` (app HomeScreen.kt:1407). */
    const val GENDER = "gender"
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

    // Mandatory Terms-of-Use acceptance gate (driven by GET policy_acceptance_status).
    // Names mirror the app's OnboardingAnalyticsEvents.TERMS_OF_USE_* block.
    const val TERMS_OF_USE_SHEET_SHOWN = "Terms_Of_Use_Sheet_Shown"
    const val TERMS_OF_USE_CONTENT_SCREEN_VIEWED = "Terms_Of_Use_Content_Screen_Viewed"
    const val TERMS_OF_USE_CONTENT_SCREEN_EXITED = "Terms_Of_Use_Content_Screen_Exited"
    const val TERMS_OF_USE_ACCEPT_CLICK_EVENT = "Terms_Of_Use_Accept_Click_Event"
    const val TERMS_OF_USE_READ_TERMS_CLICK_EVENT = "Terms_Of_Use_Read_Terms_Click_Event"

    /**
     * The app's `OnboardingAnalyticsEvents.Plotline_Accept_Terms_Click_Event`. The
     * constant name references Plotline but the emitted event goes through the normal
     * analytics fan-out, so the SDK raises it to the host listener like any other event
     * (no Plotline dependency — root CLAUDE.md §6).
     */
    const val PLOTLINE_ACCEPT_TERMS_CLICK_EVENT = "ToS_Aug26_Accept_Terms"
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
    // ---- agentic alignment chips (2.0.0) ----
    /** True when the query came from tapping an alignment surface chip. */
    val isAlignmentChip: Boolean = false,
    /**
     * The surface kind the tapped chip belongs to, in WIRE format
     * ([org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind.analyticsType], e.g.
     * "gps-prompt"). Sent as `agentic_chip_type`; "" when the query is not a chip pick.
     */
    val agenticChipType: String? = null,
    /**
     * Stable machine value of the tapped chip (e.g. "confirm", "male",
     * "use_approximate_location") — language-independent, so this is the one to build funnels on.
     */
    val agenticChipValue: String? = null,
    /** Localized display text of the tapped chip, i.e. what the farmer actually read. */
    val agenticChipLabel: String? = null,
    /**
     * Chip interaction outcome: [AnalyticsProps.CHIP_STATUS_SELECTED] / `_SKIPPED` / `_AVAILABLE` /
     * `_NONE`. Null lets [toAnalyticsProperties] derive selected-or-none from [isAlignmentChip];
     * the skipped and available cases are stamped explicitly by the caller.
     */
    val agenticChipStatus: String? = null,
    /**
     * The surface kind that was on screen but bypassed. Emitted ONLY for
     * [AnalyticsProps.CHIP_STATUS_SKIPPED]; "" otherwise.
     */
    val agenticChipSkippedType: String? = null,
    /**
     * The surface kind the RESPONSE presented. Emitted ONLY for
     * [AnalyticsProps.CHIP_STATUS_AVAILABLE]; "" otherwise.
     */
    val agenticChipShownType: String? = null,
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
            // FIRST, exactly as in the app: a chip tap that also came from an advice card must
            // report align_chip_sel, not read_full_advice. Appending this branch instead of
            // prepending it would silently invert that.
            isAlignmentChip -> "align_chip_sel"
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
            // All seven chip keys go on EVERY Send_Query / Send_Query_Initiated, chip or not —
            // that is what the app does, and a key that appears only on chip payloads is a
            // different schema. Status defaults to "none", the five string keys to "".
            put(
                AnalyticsProps.AGENTIC_CHIP_STATUS,
                agenticChipStatus?.takeIf { it.isNotBlank() }
                    ?: if (isAlignmentChip) AnalyticsProps.CHIP_STATUS_SELECTED
                    else AnalyticsProps.CHIP_STATUS_NONE
            )
            put(
                AnalyticsProps.AGENTIC_CHIP_SKIPPED_TYPE,
                if (agenticChipStatus == AnalyticsProps.CHIP_STATUS_SKIPPED) {
                    agenticChipSkippedType?.takeIf { it.isNotBlank() } ?: ""
                } else ""
            )
            put(
                AnalyticsProps.AGENTIC_CHIP_SHOWN_TYPE,
                if (agenticChipStatus == AnalyticsProps.CHIP_STATUS_AVAILABLE) {
                    agenticChipShownType?.takeIf { it.isNotBlank() } ?: ""
                } else ""
            )
            put(AnalyticsProps.AGENTIC_CHIP_TYPE, agenticChipType?.takeIf { it.isNotBlank() } ?: "")
            put(AnalyticsProps.AGENTIC_CHIP_VALUE, agenticChipValue?.takeIf { it.isNotBlank() } ?: "")
            put(AnalyticsProps.AGENTIC_CHIP_LABEL, agenticChipLabel?.takeIf { it.isNotBlank() } ?: "")
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

/**
 * Builds the [HomeCardAnalytics] payload for a home-feed section, a 1:1 port of the app's
 * private `sectionToAnalytics` (app ui/home/HomeScreen.kt:2042-2057). Every fallback chain
 * below is the app's, in the app's order.
 */
fun org.digitalgreen.farmerchat.sdk.core.model.SectionDto.toHomeCardAnalytics(
    cardPosition: String = ""
): HomeCardAnalytics = HomeCardAnalytics(
    cardType = type ?: "",
    cardCategory = meta?.asset_name?.takeIf { it.isNotBlank() }
        ?: title ?: id?.toString() ?: "",
    imageId = id?.toString() ?: "",
    sentenceId = statement_id?.toString() ?: "",
    text = question_text ?: title ?: statement ?: "",
    views = badge?.count ?: "",
    country = meta?.country ?: meta?.user_country ?: "",
    county = meta?.geography_level2 ?: meta?.user_county ?: "",
    assetType = meta?.asset_category?.takeIf { it.isNotBlank() } ?: type ?: "",
    assetName = meta?.asset_name?.takeIf { it.isNotBlank() }
        ?: title ?: id?.toString() ?: "",
    stage = meta?.growth_stage ?: "",
    concern = meta?.concern ?: "",
    dateRange = meta?.date_range ?: "",
    cardPosition = cardPosition
)

/**
 * `Card_Position` labels for a visible feed, a 1:1 port of the app's private
 * `buildImageStatementSequences` (app ui/home/HomeScreen.kt:2023-2040): image and
 * statement cards get `"<type> <n>"` counted per type in feed order; every other
 * card type gets `""`.
 */
fun cardPositionLabels(
    sections: List<org.digitalgreen.farmerchat.sdk.core.model.SectionDto>
): List<String> {
    val counters = mutableMapOf<String, Int>()
    return sections.map { s ->
        val type = s.type ?: ""
        if (type == "image" || type == "statement") {
            val n = (counters[type] ?: 0) + 1
            counters[type] = n
            "$type $n"
        } else ""
    }
}

/**
 * The `value` on `Settings_Option_Selected` for the appearance row, mapping the SDK's
 * persisted mode ids onto the app's `AppearanceMode` labels
 * (app ui/settings/SettingsScreen.kt:145-150): Day→"Light", Night→"Dark", Auto→"Default".
 *
 * Shared by both UI artifacts so the compose and views rows cannot drift.
 */
fun appearanceAnalyticsValue(mode: String): String = when (mode) {
    "day" -> "Light"
    "night" -> "Dark"
    else -> "Default"
}
