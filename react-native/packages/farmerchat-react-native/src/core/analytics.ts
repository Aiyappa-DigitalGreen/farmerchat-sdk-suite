/**
 * Analytics — host-pluggable event emitter.
 * No third-party analytics SDKs live inside the SDK (docs/03 §Principles #4);
 * every event the app tracks is emitted with identical names/props through
 * `FarmerChatConfig.onEvent` so hosts forward to their own stacks.
 *
 * Event names are copied character-for-character from the app's
 * `OnboardingAnalyticsEvents.kt` / `GpsAnalyticsEvents.kt` (fc-compose,
 * read-only reference). No invented events.
 */
import type { FarmerChatCallbacks, FarmerChatEventListener } from './config';

export const AnalyticsEvents = {
  // --- app lifecycle ---
  APP_OPENED: 'App_Opened',
  SCREEN_VIEWED: 'Screen_Viewed',
  SCREEN_EXITED: 'Screen_Exited',
  API_CALL_INITIATED: 'API_Call_Initiated',
  API_CALL_SUCCESS: 'API_Call_Success',
  API_CALL_FAILED: 'API_Call_Failed',
  API_CALL_TIMEOUT: 'API_Call_Timeout',
  FIRST_TIME_ONBOARDING_COMPLETED: 'FirstTimeOnboardingCompleted',
  DEVICE_LOCATION_FETCH_INITIATED: 'Device_Location_Fetch_Initiated',
  DEVICE_LOCATION_FETCH_SUCCEEDED: 'Device_Location_Fetch_Succeded', // as per sheet (app typo preserved)
  DEVICE_LOCATION_FETCH_FAILED: 'Device_Location_Fetch_Failed',

  // --- onboarding / language ---
  WELCOME_SCREEN_GET_STARTED_BUTTON_CLICK: 'Welcome_Screen_Get_Started_Button_Click',
  ONBOARDING_COMPLETED_STEP1: 'Onboarding_completed_Step1',
  ONBOARDING_COMPLETED_STEP2: 'Onboarding_completed_Step2',
  SAVE_LANGUAGE_CLICK: 'Save_Language_Click_Event',
  TERMS_OF_USE_OPENED: 'terms_of_use_opened',
  PRIVACY_POLICY_OPENED: 'privacy_policy_opened',

  // --- account benefits ---
  ACCOUNT_BENEFIT_SCREEN_PROCEED: 'Account_Benefit_Screen_Proceed',
  ACCOUNT_BENEFIT_SCREEN_SKIP: 'Account_Benefit_Screen_Skip',

  // --- auth / login ---
  SEND_OTP_CLICK_EVENT: 'Send_OTP_Click_Event',
  MOBILE_VERIFICATION_STARTED: 'Mobile_verification_Started',
  RESEND_OTP_CLICK_EVENT: 'Resend_OTP_Click_Event',
  SUBMIT_OTP: 'Submit_OTP',
  REGISTRATION_COMPLETED: 'Registration_Completed',
  LOGIN_COMPLETED: 'Login_Completed',
  SIGNUP_CONTINUE_CLICKED: 'Signup_Continue_Clicked',
  COUNTRY_SELECTED: 'Country_selected',
  OTP_LOCKOUT_REACHED: 'OTP_Lockout_Reached',
  START_OVER_CLICKED: 'Start_Over_Clicked',

  // --- name screen ---
  NAME_SAVE_CLICK: 'Name_Save_Click_Event',
  NAME_SKIP_CLICK: 'Name_Skip_Click_Event',
  ONBOARDING_COMPLETED: 'Onboarding_completed',

  // --- home / dashboard ---
  FIRST_TIME_DASHBOARD_VIEWED: 'FirstTimeDashboardViewed',
  DASHBOARD_VIEWED: 'Dashboard_Viewed',
  CONTENT_TRY_AGAIN_CLICKED: 'Content_Try_Again_Clicked',
  CARD_SHOWN: 'Card_Shown',
  CARD_VIEWED: 'Card_Viewed',
  CARD_CLICKED: 'Card_Clicked',
  QUESTION_CARD_DATA_SUBMITTED: 'question_card_data_Submitted',
  HAMBURGER_MENU_CLICKED: 'Hamburger_Menu_Clicked',
  CHAT_ICON_CLICKED: 'Chat_Icon_Clicked',
  MICROPHONE_CLICK_EVENT: 'Microphone_Click_Event',
  IMAGE_OPTION_DIALOG_CLICK_EVENT: 'Image_Option_Dialog_Click_Event',
  INPUT_CAPTURE_FAILED: 'Input_Capture_Failed',
  SEND_RECORD_AUDIO_CLICK_EVENT: 'Send_Record_Audio_Click_Event',
  CANCEL_RECORD_AUDIO_CLICK_EVENT: 'Cancel_Record_Audio_Click_Event',
  TRANSCRIPTION_SUCCESS: 'Transcription_Success',
  TRANSCRIPTION_FAILED: 'Transcription_Failed',

  // --- permissions ---
  PERMISSION_POPUP_SHOWN: 'Permission_popup_shown',
  PERMISSION_GRANTED: 'Permission_granted',
  PERMISSION_DENIED: 'Permission_denied',
  PERMISSION_FALLBACK_DEFAULT_SETTING_SHOWN: 'Permission_Fallback_Default_Setting_Shown',
  PERMISSION_FALLBACK_DEFAULT_SETTING_CLICKED: 'Permission_Fallback_Default_Setting_Clicked',
  PERMISSION_FALLBACK_DEFAULT_SETTING_CANCELED: 'Permission_Fallback_Default_Setting_Canceled',

  // --- location / GPS (GpsAnalyticsEvents.kt) ---
  LOCATION_UPDATE_TRIGGERED: 'Location_Update_Triggered',
  LOCATION_PERMISSION_ALLOW: 'location_permission_allow',
  LOCATION_PERMISSION_ALLOWED: 'location_permission_allowed',
  LOCATION_PERMISSION_DENY: 'location_permission_deny',
  LOCATION_PERMISSION_PROMPT_TRIGGERED: 'location_permission_prompt_triggered',
  LOCATION_FALLBACK_USED_IP_BASED_LOCATION: 'location_fallback_used_ip_based_location',
  LOCATION_FETCH_SUCCESS: 'location_fetch_success',
  LOCATION_FETCH_FAILED: 'location_fetch_failed',
  LOCATION_FETCH_FAILED_TIMEOUT: 'location_fetch_failed_timeout',
  LOCATION_SETTINGS_UPDATE_LOCATION_CLICKED: 'location_settings_update_location_clicked',
  LOCATION_SETTINGS_LOCATION_PERMISSION_CLICKED: 'location_settings_location_permission_clicked',
  LOCATION_UPDATE_FAILURE: 'location_update_failure',
  LOCATION_UPDATE_SUCCESS: 'location_update_success',
  LOCATION_SETTINGS_OPENED: 'location_settings_opened',
  WEATHER_FORECAST_VIEWED: 'Weather_Forecast_Viewed',
  /** Firebase gps flow step event (docs/01 §3.15). */
  GPS_FLOW_STEP: 'gps_flow_step',

  // --- navigation / side menu ---
  PROFILE_CLICK: 'Profile_Click',
  LOGOUT_CLICK_EVENT: 'Logout_Click_Event',
  MENU_OPTION_CLICK_EVENT: 'Menu_Option_Click_Event',

  // --- chat & query ---
  CHAT_HISTORY_CLICK: 'Chat_History_Click',
  CHAT_HISTORY_CLICK_EVENT: 'Chat_History_Click_Event',
  CHAT_SCREEN_BACK_BUTTON_CLICK: 'Chat_Screen_Back_Button_Click',
  NEW_CHAT_CLICK: 'New_Chat_Click',
  NEW_CHAT_CLICK_EVENT: 'New_Chat_Click_Event',
  SHARE_BUTTON_CLICKED: 'Answer_Share_Button_Clicked',
  SAVE_BUTTON_CLICKED: 'Answer_Save_Button_Clicked',
  SEND_QUERY: 'Send_Query',
  SEND_QUERY_INITIATED: 'Send_Query_Initiated',
  STARTER_QUESTIONS_GENERATED: 'Starter_Questions_Generated',
  STARTED_PLAYING_RESPONSE_AUDIO: 'Started_Playing_Response_Audio',
  STOPPED_PLAYING_RESPONSE_AUDIO: 'Stopped_Playing_Response_Audio',
  FIRST_QUERY_ASKED: 'FirstQueryAsked',

  // --- account & profile ---
  ACCOUNT_PREFERENCE_CLICK: 'Account_Preference_Click',
  EDIT_PROFILE_CLICK: 'Edit_Profile_Click',
  FAQ_CLICKED: 'FAQ_Clicked',
  SETTINGS_OPTION_SELECTED: 'Settings_Option_Selected',
} as const;

export type AnalyticsEventName =
  (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

/** Screen names — copied from the app's AnalyticsScreens.kt. */
export const ScreenNames = {
  SPLASH: 'Splash Screen',
  LANGUAGE: 'Select Language Screen',
  LANGUAGE_SETTINGS: 'Language Settings Screen',
  NAME: 'Enter Name Screen',
  HOME: 'Dashboard Screen',
  GPS: 'GPS Screen',
  GPS_INTERSTITIAL: 'GPS Interstitial Screen',
  AUTH: 'Login Screen',
  VERIFY_OTP: 'Verify OTP Screen',
  SELECT_COUNTRY: 'Select Country Screen',
  ACCOUNT_BENEFIT: 'Account Benefit Screen',
  ACCOUNT_SUCCESS: 'Account Success Screen',
  CHAT: 'Chat Screen',
  HELP: 'Help & Support Screen',
  SETTINGS: 'Settings Screen',
} as const;

export type ScreenName = (typeof ScreenNames)[keyof typeof ScreenNames];

export class AnalyticsManager {
  private listener: FarmerChatEventListener | null;
  private callbacks: FarmerChatCallbacks;

  constructor(
    listener: FarmerChatEventListener | null,
    callbacks: FarmerChatCallbacks = {},
  ) {
    this.listener = listener;
    this.callbacks = callbacks;
  }

  setListener(listener: FarmerChatEventListener | null): void {
    this.listener = listener;
  }

  private semantic(fn: (() => void) | undefined): void {
    if (!fn) return;
    try {
      fn();
    } catch {
      // host callback errors never break the SDK
    }
  }

  track(name: string, props: Record<string, unknown> = {}): void {
    try {
      this.listener?.(name, props);
    } catch {
      // host listener errors must never break the SDK (app uses runCatching)
    }
  }

  trackScreenView(screen: string, extra: Record<string, unknown> = {}): void {
    this.track(AnalyticsEvents.SCREEN_VIEWED, { screen_name: screen, ...extra });
    // Semantic callbacks (C4): onScreenView for every screen; onChatOpened
    // whenever the Chat screen is shown.
    const cb = this.callbacks;
    this.semantic(cb.onScreenView ? () => cb.onScreenView?.(screen) : undefined);
    if (screen === ScreenNames.CHAT) {
      this.semantic(cb.onChatOpened);
    }
  }

  /** Fire a semantic lifecycle callback (C4) directly. */
  fireCallback<K extends keyof FarmerChatCallbacks>(
    name: K,
    ...args: Parameters<NonNullable<FarmerChatCallbacks[K]>>
  ): void {
    const fn = this.callbacks[name] as ((...a: unknown[]) => void) | undefined;
    this.semantic(fn ? () => fn(...args) : undefined);
  }

  trackScreenExit(screen: string, extra: Record<string, unknown> = {}): void {
    this.track(AnalyticsEvents.SCREEN_EXITED, { screen_name: screen, ...extra });
  }
}
