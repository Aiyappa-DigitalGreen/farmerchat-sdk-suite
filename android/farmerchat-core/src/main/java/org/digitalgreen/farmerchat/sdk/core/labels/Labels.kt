package org.digitalgreen.farmerchat.sdk.core.labels

/**
 * App label constants from FC V2.0 Build stability tracker - Label(v2).csv
 * 
 * Usage:
 *   LabelManager.getLabel(context, Labels.SETTINGS, "Settings")
 *   context.getLabel(Labels.CHOOSE_YOUR_LANGUAGE, "Choose your language")
 */
object Labels {
    // Splash Screen
    const val FARMERCHAT_STARTING = "fc_v2_app_label_farmerchat_starting"
    
    // Language Selection
    const val CHOOSE_YOUR_LANGUAGE = "fc_v2_app_label_choose_your_language"
    const val YOU_CHANGE_LATER = "fc_v2_app_label_you_change_later"
    const val FARMERCHAT_TAGLINE = "fc_v2_app_label_farmerchat_tagline"
    const val START_USING_FARMERCHAT = "fc_v2_app_label_start_using_farmerchat"
    const val TERMS_PRIVACY_AGREEMENT = "fc_v2_app_label_terms_privacy_agreement"
    const val LOADING_LANGUAGES = "fc_v2_app_label_loading_languages"
    const val TERMS_OF_USE = "fc_v2_app_label_terms_of_use"
    const val PRIVACY_POLICY = "fc_v2_app_label_privacy_policy"
    
    // Enter Name
    const val WHAT_SHOULD_WE_CALL_YOU = "fc_v2_app_label_what_should_we_call_you"
    const val WE_GREET_YOU_NAME = "fc_v2_app_label_we_greet_you_name"
    const val YOUR_NAME_OR_NICKNAME = "fc_v2_app_label_your_name_or_nickname"
    const val SAVE_NAME = "fc_v2_app_label_save_name"
    const val SAVING = "fc_v2_app_label_saving"
    const val SKIP_FOR_NOW = "fc_v2_app_label_skip_for_now"
    
    // Auth Screen
    const val SIGN_UP = "fc_v2_app_label_sign_up"
    const val ENTER_YOUR_PHONE_NUMBER = "fc_v2_app_label_enter_your_phone_number"
    const val ENTER_PHONE_NUMBER = "fc_v2_app_label_enter_phone_number"
    const val SEND_OTP_SIGNIN = "fc_v2_app_label_send_otp_signin"
    const val SEND_OTP_SIGNIN_SHORT = "fc_v2_app_label_send_otp_signin_short"
    const val SEND_ONE_TIME_CODE = "fc_v2_app_label_send_one_time_code"
    const val SEND_VIA_WHATSAPP = "fc_v2_app_label_send_via_whatsapp"
    const val SEND_VIA_SMS = "fc_v2_app_label_send_via_sms"
    const val SENDING_CODE = "fc_v2_app_label_sending_code"
    const val PLEASE_CHECK_TRY_AGAIN = "fc_v2_app_label_please_check_try_again"
    const val BY_CONTINUING_TO_VERIFICATION_YOU_ARE_ACCEPTING_OUR = "fc_v2_app_label_by_continuing_to_verification_you_are_accepting_our"

    const val PLEASE_ALSO_SEE_OUR = "fc_v2_app_label_please_also_see_our"
    const val UNKNOWN_ERROR = "fc_v2_app_label_unknown_error"
    const val UNABLE_TO_LOAD_LEGAL_LINKS = "fc_v2_app_label_unable_to_load_legal_links"
    const val PLEASE_ENTER_A_VALID_NUMBER = "fc_v2_app_label_please_enter_a_valid_number"

    // Auth - OTP Entry
    const val ENTER_CODE_WE_SENT = "fc_v2_app_label_enter_code_we_sent"
    const val CHECK_YOUR_MESSAGES_CODE = "fc_v2_app_label_check_your_messages_code"
    const val VERIFY = "fc_v2_app_label_verify"
    const val VERIFYING = "fc_v2_app_label_verifying"
    const val START_OVER = "fc_v2_app_label_start_over"

    const val PLEASE_ENTER = "fc_v2_app_label_please_enter"

    const val SECONDS = "fc_v2_app_label_seconds"
    const val RESEND_CODE = "fc_v2_app_label_resend_code"
    
    // Country Selector
    const val SELECT_COUNTRY_CODE = "fc_v2_app_label_select_country_code"
    const val SEARCH = "fc_v2_app_label_search"
    const val COUNTRY_PHONE_FORMAT = "fc_v2_app_label_country_phone_format"
    const val SAVE_SELECTION = "fc_v2_app_label_save_selection"
    const val COUNTRY_CODE = "fc_v2_app_label_country_code"
    const val SAVE = "fc_v2_app_label_save"
    const val CANCEL = "fc_v2_app_label_cancel"
    
    // SIM Picker Dialog
    const val CHOOSE_SIM_NUMBER = "fc_v2_app_label_choose_sim_number"
    const val CLOSE = "fc_v2_app_label_close"
    
    // Account Success
    const val ALL_SET = "fc_v2_app_label_all_set"
    const val PREVIOUS_QUESTIONS_MENU = "fc_v2_app_label_previous_questions_menu"
    const val CONTINUE = "fc_v2_app_label_continue"
    const val YOURE_ALL_SET = "fc_v2_app_label_youre_all_set"
    
    // Home
    const val HOW_WE_HELP_YOU_MORNING = "fc_v2_app_label_how_we_help_you_morning"
    const val WHAT_DO_YOU_NEED_HELP_TODAY = "fc_v2_app_label_what_do_you_need_help_today"
    const val HOWS_FARM_LOOKING_MORNING = "fc_v2_app_label_hows_farm_looking_morning"
    const val HOW_WE_HELP_YOU_TODAY = "fc_v2_app_label_how_we_help_you_today"
    const val WHAT_WE_HELP_YOU = "fc_v2_app_label_what_we_help_you"
    const val HOWS_FARM_GOING_TODAY = "fc_v2_app_label_hows_farm_going_today"
    const val HOW_WE_HELP_YOU_EVENING = "fc_v2_app_label_how_we_help_you_evening"
    const val NEED_HELP_ANYTHING_TODAY = "fc_v2_app_label_need_help_anything_today"
    const val HOW_DID_THINGS_GO_TODAY = "fc_v2_app_label_how_did_things_go_today"
    const val GETTING_TODAYS_ADVICE = "fc_v2_app_label_getting_todays_advice"
    const val GETTING_YOUR_LOCATION = "fc_v2_app_label_getting_your_location"
    const val FOR_YOUR_FARM_TODAY = "fc_v2_app_label_for_your_farm_today"
    const val CHECK_YOUR_INTERNET_CONNECTION = "fc_v2_app_label_check_your_internet_connection"
    const val HELLO = "fc_v2_app_label_hello"
    const val COMEBACK_TOMORROW = "fc_v2_app_label_comeback_tomorrow"
    
    // Chat
    const val WHAT_WRONG_MY_CROP = "fc_v2_app_label_what_wrong_my_crop"
    const val READ_FULL_ADVICE = "fc_v2_app_label_read_full_advice"
    const val SAVED_TO_GALLERY = "fc_v2_app_label_saved_to_gallery"
    const val FAILED_TO_SAVE = "fc_v2_app_label_failed_to_save"

    const val AUDIO_NOT_AVAILABLE = "fc_v2_app_label_audio_not_available"
    const val NO_AUDIO_AVAILABLE_MESSAGE = "fc_v2_app_label_no_audio_available_message"
    const val SHARE_APP_MESSAGE = "fc_v2_app_label_share_app_message"
    
    // Chat History
    const val RECENT_CHATS = "fc_v2_app_label_recent_chats"
    const val LOADING_CHATS = "fc_v2_app_label_loading_chats"
    const val LOADING_MORE = "fc_v2_app_label_loading_more"
    const val COULDNT_LOAD_MORE_CHATS = "fc_v2_app_label_couldnt_load_more_chats"
    const val TRY_AGAIN = "fc_v2_app_label_try_again"
    const val NEW_CONVERSATION = "fc_v2_app_label_new_conversation"
    
    // Settings
    const val SETTINGS = "fc_v2_app_label_settings"
    const val APPEARANCE = "fc_v2_app_label_appearance"
    const val DAY = "fc_v2_app_label_day"
    const val NIGHT = "fc_v2_app_label_night"
    const val AUTO = "fc_v2_app_label_auto"
    const val FARMERCHAT_ALWAYS_LIGHT_MODE = "fc_v2_app_label_farmerchat_always_light_mode"
    const val FARMERCHAT_ALWAYS_DARK_MODE = "fc_v2_app_label_farmerchat_always_dark_mode"
    const val FARMERCHAT_ADJUSTS_YOUR_PHONE_SETTINGS = "fc_v2_app_label_farmerchat_adjusts_your_phone_settings"
    const val ACCOUNT_DETAILS = "fc_v2_app_label_account_details"
    const val YOUR_NAME = "fc_v2_app_label_your_name"
    const val LOGOUT = "fc_v2_app_label_logout"
    const val YOUR_NAME_HAS_UPDATED = "fc_v2_app_label_your_name_has_updated"
    
    // Language Selection - Modal
    const val ALL_LANGUAGES = "fc_v2_app_label_all_languages"
    const val APPLY_LANGUAGE = "fc_v2_app_label_apply_language"
    const val APPLYING_LANGUAGE = "fc_v2_app_label_applying_language"

    // Language Chooser
    const val SAVE_LANGUAGE = "fc_v2_app_label_save_language"
    const val SETTING_LANGUAGE = "fc_v2_app_label_setting_language"
    const val LANGUAGE_UPDATED = "fc_v2_app_label_language_updated"
    
    // Settings Name
    const val NAME = "fc_v2_app_label_name"
    const val ENTER_YOUR_NAME = "fc_v2_app_label_enter_your_name"
    
    // Help
    const val HELP = "fc_v2_app_label_help"
    const val HOW_TO_USE_FARMERCHAT = "fc_v2_app_label_how_to_use_farmerchat"
    const val NO_FAQS_AVAILABLE = "fc_v2_app_label_no_faqs_available"
    const val LINK_UNAVAILABLE = "fc_v2_app_label_link_unavailable"
    const val MORE = "fc_v2_app_label_more"
    const val FARMERCHAT_V200 = "fc_v2_app_label_farmerchat_v200"
    const val DIGITAL_GREEN = "fc_v2_app_label_digital_green"
    
    // Error - No Internet
    const val NO_INTERNET_CONNECTION = "fc_v2_app_label_no_internet_connection"
    const val FARMERCHAT_NEEDS_THE_INTERNET = "fc_v2_app_label_farmerchat_needs_the_internet"
    const val CHECK_MOBILE_DATA_WIFI_SIGNAL = "fc_v2_app_label_check_mobile_data_wi-fi_signal"
    
    // Error - API
    const val SOMETHING_WENT_WRONG = "fc_v2_app_label_something_went_wrong"
    const val FARMERCHAT_COULDNT_LOAD = "fc_v2_app_label_farmerchat_couldnt_load"
    const val PLEASE_TRY_AGAIN = "fc_v2_app_label_please_try_again"
    
    // Permission Dialog
    const val CAMERA_PERMISSION_REQUIRED = "fc_v2_app_label_camera_permission_required"
    const val MICROPHONE_PERMISSION_REQUIRED = "fc_v2_app_label_microphone_permission_required"
    const val PLEASE_ENABLE_CAMERA_SETTINGS = "fc_v2_app_label_please_enable_camera_settings"
    const val PLEASE_ENABLE_MICROPHONE_SETTINGS = "fc_v2_app_label_please_enable_microphone_settings"
    const val GO_TO_SETTINGS = "fc_v2_app_label_go_to_settings"
    
    // Photo Input
    const val CAMERA = "fc_v2_app_label_camera"
    const val GALLERY = "fc_v2_app_label_gallery"
    const val NO_CAMERA_APP_AVAILABLE = "fc_v2_app_label_no_camera_app_available"
    
    // GPS
    const val SHARE_LOCATION = "fc_v2_app_label_share_location"
    const val GET_ADVICE_YOUR_AREA = "fc_v2_app_label_get_advice_your_area"
    const val LOCATION_HELPS_SUGGESTIONS = "fc_v2_app_label_location_helps_suggestions"
    const val TURN_LOCATION_ON_NOW = "fc_v2_app_label_turn_location_on_now"
    const val CONTINUE_WITHOUT_LOCATION = "fc_v2_app_label_continue_without_location"
    const val WE_NEED_YOUR_LOCATION = "fc_v2_app_label_we_need_your_location"
    const val LOCATION_TAILOR_ADVICE = "fc_v2_app_label_location_tailor_advice"
    const val TURN_ON_IN_SETTINGS = "fc_v2_app_label_turn_on_in_settings"
    const val TURN_ON_GPS = "fc_v2_app_label_turn_on_gps"
    const val GET_LOCAL_ADVICE = "fc_v2_app_label_get_local_advice"
    const val LOCATION_GPS_TURNED_OFF = "fc_v2_app_label_location_gps_turned_off"
    const val TURNING_HELPS_TAILOR_ANSWERS_YOUR_AREA = "fc_v2_app_label_turning_helps_tailor_answers_your_area"
    const val COULDNT_GET_YOUR_LOCATION = "fc_v2_app_label_couldnt_get_your_location"
    const val PRACTICAL_ADVICE_YOUR_FARM = "fc_v2_app_label_practical_advice_your_farm"
    const val TURN_ON_LOCATION = "fc_v2_app_label_turn_on_location"
    const val LOCATION_WEATHER_ADVICE = "fc_v2_app_label_location_weather_advice"
    const val LOCATION_GPS_TURNED_OFF_TURNING_HELPS = "fc_v2_app_label_location_gps_turned_off_turning_helps"

    // Util
    const val SHARE_DOWNLOAD = "fc_v2_app_label_share_download"
    const val SKIP = "fc_v2_app_label_skip"
    const val BACK = "fc_v2_app_label_back"
    const val NO_NETWORK = "fc_v2_app_label_no_network"
    const val PLEASE_CONNECT_INTERNET_TRY_AGAIN = "fc_v2_app_label_please_connect_internet_try_again"
    const val FARMERCHAT = "fc_v2_app_label_farmerchat"
    
    // SignUp
    const val SAVE_YOUR_QUESTIONS_ANSWERS = "fc_v2_app_label_save_your_questions_answers"
    const val WELL_SAVE_YOUR_CHATS_YOU_CONTINUE = "fc_v2_app_label_well_save_your_chats_you_continue"
    const val SIGN_UP_PHONE_NUMBER = "fc_v2_app_label_sign_up_phone_number"
    
    // Chat tip
    const val ASK_A_FOLLOWUP_QUESTIONS = "fc_v2_app_label_ask_a_followup_questions"
    const val ASK_SPECIFIC_CROPS = "fc_v2_app_label_ask_specific_crops"
    const val UPLOAD_PHOTOS_PLANT_DISEASE_IDENTIFICATION = "fc_v2_app_label_upload_photos_plant_disease_identification"

    // Additional labels for full coverage
    const val LOCATION_UPDATED = "fc_v2_app_label_location_updated"
    const val HOME = "fc_v2_app_label_home"
    const val SEE_ALL = "fc_v2_app_label_see_all"
    const val NO_CHATS_YET = "fc_v2_app_label_no_chats_yet"
    const val HELP_SUPPORT = "fc_v2_app_label_help_support"
    const val FAILED_TO_LOAD_CHATS = "fc_v2_app_label_failed_to_load_chats"
    const val START_CHAT = "fc_v2_app_label_start_chat"
    const val CANT_LOAD_RIGHT_NOW = "fc_v2_app_label_cant_load_right_now"
    const val GETTING_YOUR_ANSWER = "fc_v2_app_label_getting_your_answer"
    const val PHOTO = "fc_v2_app_label_photo"
    const val SPEAK = "fc_v2_app_label_speak"
    const val TYPE = "fc_v2_app_label_type"
    const val LANGUAGE = "fc_v2_app_label_language"
    const val FAQ = "fc_v2_app_label_faq"
    const val WHAT_IS_WRONG_WITH_MY_CROP = "fc_v2_app_label_what_is_wrong_with_my_crop"
    const val ASR_IS_DISABLED_FOR_YOUR_SELECTED_LANGUAGE = "fc_v2_app_label_asr_is_disabled_for_your_selected_language"
    const val FAILED_TO_LOAD_CHAT_HISTORY = "fc_v2_app_label_failed_to_load_chat_history"
    const val FAILED_TO_PROCESS_IMAGE = "fc_v2_app_label_failed_to_process_image"
    const val FAILED_TO_GET_RESPONSE = "fc_v2_app_label_failed_to_get_response"
    const val SOMETHING_WENT_WRONG_PLEASE_TRY_AGAIN = "fc_v2_app_label_something_went_wrong_please_try_again"
    const val REQUEST_TIMED_OUT_PLEASE_TRY_AGAIN = "fc_v2_app_label_request_timed_out_please_try_again"
    const val TRANSCRIPTION_FAILED_PLEASE_TRY_AGAIN = "fc_v2_app_label_transcription_failed_please_try_again"
    const val SETTING_LOADING_STATE_IMMEDIATELY_GPS_FETCH_IN_PROGRESS = "fc_v2_app_label_setting_loading_state_immediately_gps_fetch_in_progress"
    const val BY_CONTINUING_YOU_AGREE_TO_OUR = "fc_v2_app_label_by_continuing_you_agree_to_our"
    const val ALSO_SEE = "fc_v2_app_label_also_see"
    const val LOADING = "fc_v2_app_label_loading"
    const val PLEASE_ENTER_A_VALID_OTP = "fc_v2_app_label_please_enter_a_valid_otp"
    const val LISTEN = "fc_v2_app_label_listen"
    const val THANK_YOU_YOUR_ANSWER_HELPS_US_GIVE_MORE_ACCURATE_ADVICE = "fc_v2_app_label_thank_you_your_answer_helps_us_give_more_accurate_advice"
    const val CONFIRM = "fc_v2_app_label_confirm"
    const val ASK = "fc_v2_app_label_ask"
    const val PHOTOS = "fc_v2_app_label_photos"
    const val EITHER_ICONRES_OR_IMAGEVECTOR_MUST_BE_PROVIDED_WHEN_NOT_LOADING = "fc_v2_app_label_either_iconRes_or_imageVector_must_be_provided_when_not_loading"
    const val SEND = "fc_v2_app_label_send"
    const val VOICE = "fc_v2_app_label_voice"
    const val MICROPHONE_PERMISSION_IS_REQUIRED_FOR_VOICE_INPUT = "fc_v2_app_label_microphone_permission_is_required_for_voice_input"
    const val FAILED_TO_START_RECORDING = "fc_v2_app_label_failed_to_start_recording"
    const val TRANSCRIPTION_UNCLEAR = "fc_v2_app_label_transcription_unclear"
    const val FAILED_TO_PROCESS_AUDIO = "fc_v2_app_label_failed_to_process_audio"
    const val NO_AUDIO_RECORDED_OR_CONVERSATION_NOT_STARTED = "fc_v2_app_label_no_audio_recorded_or_conversation_not_started"
    const val LISTENING = "fc_v2_app_label_listening"
    const val PROCESSING = "fc_v2_app_label_processing"
    const val ASK_YOUR_FARMING_QUESTION = "fc_v2_app_label_ask_your_farming_question"
    const val ONE_SECOND_PLEASE = "fc_v2_app_label_one_second_please"
    const val VOICE_INPUT_IS_STILL_IMPROVING = "fc_v2_app_label_voice_input_is_still_improving"
    const val HAVE_A_GREAT_DAY_COME_BACK_TOMORROW = "fc_v2_app_label_have_a_great_day_come_back_tomorrow"
    const val TIPS_LIST_CANNOT_BE_EMPTY = "fc_v2_app_label_tips_list_cannot_be_empty"





    const val THIS_FUNCTION_REQUIRED_ENABLE_IN_DEVICE_SETTINGS = "fc_v2_app_label_this_permission_is_needed_for_the_app_to_function_properly_please_enable_it_in_your_device_settings"
    const val ASK_ABOUT_YOUR_FARM = "fc_v2_app_label_ask_about_your_farm"
    const val PERMISSIONS_ARE_REQUIRED_TO_AUTO_DETECT_SIM_NUMBER = "fc_v2_app_label_permissions_are_required_to_auto_detect_sim_number."
    const val ASK_A_FOLLOWUP = "fc_v2_app_label_ask_a_followup_questions"
    const val STORAGE_EXCEEDED = "fc_v2_app_label_storage_exceeded"

    const val USER_CANCELLED_OR_USER_PROVIDER_ERROR = "fc_v2_app_label_user_cancelled_or_provider_error"
    const val YOU_CAN_ASK_FOLLOWUP_QUESTIONS_TO_GET_MORE_DETAILS = "fc_v2_app_label_tips_you_can_ask_followup_questions_to_get_more_details"

    const val UPLOAD_PHOTOS_FOR_PLANT_DISEASE_IDENTIFICATION = "fc_v2_app_label_tips_upload_photos_for_plant_disease_identification"
    const val AI_MAY_BE_WRONG_PLEASE_DOUBLE_CHECK = "fc_v2_app_label_tips_ai_may_be_wrong_please_double_check"

    const val RELATED_QUESTIONS = "fc_v2_app_label_related_questions"
    const val CHOOSE_A_FOLLOWUP_OPTION_BELOW = "fc_v2_app_label_choose_a_followup_option_below"
    const val OR_ASK_A_FOLLOWUP_QUESTIONS = "fc_v2_app_label_or_ask_a_followup_questions"
    const val GET_STARTED_BY_CLICKING_ON_PHOTO_SPEAK_OR_TYPE_TO_ASK_YOUR_QUESTION = "fc_v2_app_label_get_started_by_clicking_on_photo_speak_or_type_to_ask_your_question"
    const val WHAT_IS_THE_PRESENT_WEATHER = "fc_v2_app_label_what_is_the_present_weather"
    const val DID_YOU_KNOW = "fc_v2_app_label_tips_did_you_know"
    const val QUICK_TIP = "fc_v2_app_label_tips_quick_tip"
    const val TRY_THIS = "fc_v2_app_label_tips_try_this"
    const val INVALID_REQUEST_PLEASE_TRY_AGAIN = "fc_v2_app_label_invalid_request_please_try_again"
    const val SESSION_EXPIRED_PLEASE_LOGIN_AGAIN = "fc_v2_app_label_session_expired_please_login_again"
    const val ACCESS_DENIED = "fc_v2_app_label_access_denied"
    const val SERVICE_NOT_FOUND = "fc_v2_app_label_service_not_found"
    const val NETWORK_IS_SLOW_PLEASE_TRY_AGAIN = "fc_v2_app_label_network_is_slow_please_try_again"
    const val TOO_MANY_REQUESTS_PLEASE_TRY_AGAIN_LATER = "fc_v2_app_label_too_many_requests_please_try_later"
    const val SERVER_IS_BUSY_PLEASE_TRY_AGAIN = "fc_v2_app_label_server_is_busy_please_try_again"
    const val UNABLE_TO_CONNECT_PLEASE_TRY_AGAIN = "fc_v2_app_label_unable_to_connect_please_try_again"
    const val SECURE_CONNECTION_FAILED = "fc_v2_app_label_secure_connection_failed"
    const val NETWORK_ERROR_PLEASE_TRY_AGAIN = "fc_v2_app_label_network_error_please_try_again"
    const val NAME_MUST_BE_AT_LEAST = "fc_v2_app_label_name_must_be_at_least"
    const val NAME_MUST_BE_AT_MOST = "fc_v2_app_label_name_must_be_at_most"
    const val CHARACTERS = "fc_v2_app_label_characters"
    const val FARMERCHAT_PRACTICAL_ADVICE_FOR_YOUR_CROPS_AND_ANIMALS = "fc_v2_app_label_farmerchat_tagline"
    const val GET_STARTED = "fc_v2_app_label_get_started"
    const val BY_TAPPING_GET_STARTED_YOU_AGREE_TO_OUR = "fc_v2_app_label_by_tapping_get_started_you_agree_to_our"

    // SSFR (Site Specific Fertilizer Recommendation)
    const val SSFR_ADVISORY = "fc_v2_app_label_ssfr_advisory"
    const val SSFR_ADVISORY_DESCRIPTION = "fc_v2_app_label_ssfr_advisory_description"
    const val SSFR_WHEAT = "fc_v2_app_label_ssfr_wheat"
    const val SSFR_MAIZE = "fc_v2_app_label_ssfr_maize"
    const val SSFR_WHEAT_QUESTION = "fc_v2_app_label_ssfr_wheat_question"
    const val SSFR_MAIZE_QUESTION = "fc_v2_app_label_ssfr_maize_question"


    // ---- agentic streaming (2.0.0) ----
    /** "Connection stopped. Your partial answer is saved." */
    const val CONNECTION_STOPPED_PARTIAL_SAVED = "fc_v2_app_label_connection_stopped_partial_saved"
    /** "Paused, resuming…" — transient stall hint while a stream is mid-answer. */
    const val RESPONSE_PAUSED_RESUMING = "fc_v2_app_label_response_paused_resuming"

    // ---- alignment surfaces (2.0.0). All six verified present on endpoint #3. ----
    /** "Share location" — GPS_PROMPT heading. */
    const val SHARE_LOCATION_TITLE = "fc_v2_app_label_share_location_title"
    /** "Add one clear photo" — UPLOAD_PHOTO heading. */
    const val ADD_ONE_CLEAR_PHOTO = "fc_v2_app_label_add_one_clear_photo"
    /** "Please Confirm" — CONFIRM heading. */
    const val PLEASE_CONFIRM = "fc_v2_app_label_please_confirm"
    /** "Choose one" — CLARIFY heading. */
    const val CHOOSE_ONE = "fc_v2_app_label_choose_one"
    /** "Don't see your option?" — escape-hatch hint. */
    const val DONT_SEE_YOUR_OPTION = "fc_v2_app_label_dont_see_your_option"
    /** "Type or say it." — escape-hatch action. */
    const val TYPE_OR_SAY_IT = "fc_v2_app_label_type_or_say_it"
}
