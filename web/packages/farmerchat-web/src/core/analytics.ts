/**
 * Analytics emitter. No third-party SDKs inside the SDK — every event is
 * emitted through the host-pluggable listener (docs/02 "Analytics", docs/03
 * principle 4). Event names below are copied character-for-character from the
 * app's `core/analytics/OnboardingAnalyticsEvents.kt` and `GpsAnalyticsEvents.kt`.
 */

import type { FarmerChatCallbacks, FarmerChatEventListener } from './config';

export const Events = {
  // App lifecycle
  APP_OPENED: 'App_Opened',
  SCREEN_VIEWED: 'Screen_Viewed',
  SCREEN_EXITED: 'Screen_Exited',
  FIRST_TIME_ONBOARDING_COMPLETED: 'FirstTimeOnboardingCompleted',
  // Onboarding
  WELCOME_SCREEN_GET_STARTED_BUTTON_CLICK: 'Welcome_Screen_Get_Started_Button_Click',
  ONBOARDING_COMPLETED_STEP1: 'Onboarding_completed_Step1',
  ONBOARDING_COMPLETED_STEP2: 'Onboarding_completed_Step2',
  ONBOARDING_COMPLETED: 'Onboarding_completed',
  SAVE_LANGUAGE_CLICK: 'Save_Language_Click_Event',
  TERMS_OF_USE_OPENED: 'terms_of_use_opened',
  PRIVACY_POLICY_OPENED: 'privacy_policy_opened',
  NAME_SAVE_CLICK: 'Name_Save_Click_Event',
  NAME_SKIP_CLICK: 'Name_Skip_Click_Event',
  // Auth
  ACCOUNT_BENEFIT_SCREEN_PROCEED: 'Account_Benefit_Screen_Proceed',
  ACCOUNT_BENEFIT_SCREEN_SKIP: 'Account_Benefit_Screen_Skip',
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
  // Home / dashboard
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
  WEATHER_FORECAST_VIEWED: 'Weather_Forecast_Viewed',
  // Permissions
  PERMISSION_POPUP_SHOWN: 'Permission_popup_shown',
  PERMISSION_GRANTED: 'Permission_granted',
  PERMISSION_DENIED: 'Permission_denied',
  PERMISSION_FALLBACK_DEFAULT_SETTING_SHOWN: 'Permission_Fallback_Default_Setting_Shown',
  PERMISSION_FALLBACK_DEFAULT_SETTING_CLICKED: 'Permission_Fallback_Default_Setting_Clicked',
  PERMISSION_FALLBACK_DEFAULT_SETTING_CANCELED: 'Permission_Fallback_Default_Setting_Canceled',
  INPUT_CAPTURE_FAILED: 'Input_Capture_Failed',
  // Voice
  SEND_RECORD_AUDIO_CLICK_EVENT: 'Send_Record_Audio_Click_Event',
  CANCEL_RECORD_AUDIO_CLICK_EVENT: 'Cancel_Record_Audio_Click_Event',
  TRANSCRIPTION_SUCCESS: 'Transcription_Success',
  TRANSCRIPTION_FAILED: 'Transcription_Failed',
  // Chat & query
  CHAT_HISTORY_CLICK: 'Chat_History_Click',
  CHAT_SCREEN_BACK_BUTTON_CLICK: 'Chat_Screen_Back_Button_Click',
  NEW_CHAT_CLICK: 'New_Chat_Click',
  ANSWER_SHARE_BUTTON_CLICKED: 'Answer_Share_Button_Clicked',
  ANSWER_SAVE_BUTTON_CLICKED: 'Answer_Save_Button_Clicked',
  SEND_QUERY: 'Send_Query',
  SEND_QUERY_INITIATED: 'Send_Query_Initiated',
  STARTER_QUESTIONS_GENERATED: 'Starter_Questions_Generated',
  STARTED_PLAYING_RESPONSE_AUDIO: 'Started_Playing_Response_Audio',
  STOPPED_PLAYING_RESPONSE_AUDIO: 'Stopped_Playing_Response_Audio',
  FIRST_QUERY_ASKED: 'FirstQueryAsked',
  // Navigation & side menu
  PROFILE_CLICK: 'Profile_Click',
  LOGOUT_CLICK_EVENT: 'Logout_Click_Event',
  MENU_OPTION_CLICK_EVENT: 'Menu_Option_Click_Event',
  CHAT_HISTORY_CLICK_EVENT: 'Chat_History_Click_Event',
  NEW_CHAT_CLICK_EVENT: 'New_Chat_Click_Event',
  // Account & settings
  ACCOUNT_PREFERENCE_CLICK: 'Account_Preference_Click',
  EDIT_PROFILE_CLICK: 'Edit_Profile_Click',
  FAQ_CLICKED: 'FAQ_Clicked',
  SETTINGS_OPTION_SELECTED: 'Settings_Option_Selected',
  // GPS (GpsAnalyticsEvents.kt)
  LOCATION_UPDATE_TRIGGERED: 'Location_Update_Triggered',
  LOCATION_PERMISSION_ALLOW: 'location_permission_allow',
  LOCATION_PERMISSION_DENY: 'location_permission_deny',
  LOCATION_PERMISSION_PROMPT_TRIGGERED: 'location_permission_prompt_triggered',
  LOCATION_FETCH_SUCCESS: 'location_fetch_success',
  LOCATION_FETCH_FAILED: 'location_fetch_failed',
  LOCATION_FETCH_FAILED_TIMEOUT: 'location_fetch_failed_timeout',
  GPS_FLOW_STEP: 'gps_flow_step',
} as const;

/** Screen names used in Screen_Viewed / Screen_Exited props. */
export const Screens = {
  SPLASH: 'SPLASH',
  LANGUAGE: 'LANGUAGE',
  ENTER_NAME: 'ENTER_NAME',
  HOME: 'HOME',
  CHAT: 'CHAT',
  CHAT_HISTORY: 'CHAT_HISTORY',
  AUTH: 'AUTH',
  VERIFY_OTP: 'VERIFY_OTP',
  ACCOUNT_BENEFITS: 'ACCOUNT_BENEFITS',
  ACCOUNT_SUCCESS: 'ACCOUNT_SUCCESS',
  SETTINGS: 'SETTINGS',
  SETTINGS_NAME: 'SETTINGS_NAME',
  LANGUAGE_CHOOSER: 'LANGUAGE_CHOOSER',
  HELP: 'HELP',
  ERROR: 'ERROR',
  FULL_SCREEN_MESSAGE: 'FULL_SCREEN_MESSAGE',
  LEGAL_CONTENT: 'LEGAL_CONTENT',
} as const;

export class Analytics {
  private listener?: FarmerChatEventListener;

  constructor(
    listener?: FarmerChatEventListener,
    /** C4 — semantic host callbacks (docs/07 Part C). */
    private callbacks: FarmerChatCallbacks = {},
  ) {
    this.listener = listener;
  }

  setListener(listener?: FarmerChatEventListener): void {
    this.listener = listener;
  }

  private safe(fn?: (...args: never[]) => void, ...args: unknown[]): void {
    try {
      (fn as ((...a: unknown[]) => void) | undefined)?.(...args);
    } catch {
      // host callback errors never break the SDK (runCatching parity)
    }
  }

  track(name: string, props: Record<string, unknown> = {}): void {
    try {
      this.listener?.(name, props);
    } catch {
      // host listener errors never break the SDK (runCatching parity)
    }
  }

  screenView(screen: string, extra: Record<string, unknown> = {}): void {
    this.track(Events.SCREEN_VIEWED, { screen_name: screen, ...extra });
    this.safe(this.callbacks.onScreenView, screen);
    if (screen === Screens.CHAT) this.safe(this.callbacks.onChatOpened);
  }

  screenExit(screen: string, extra: Record<string, unknown> = {}): void {
    this.track(Events.SCREEN_EXITED, { screen_name: screen, ...extra });
  }

  // --- Semantic callbacks (C4) — invoked at their source alongside raw events ---
  messageSent(text: string): void {
    this.safe(this.callbacks.onMessageSent, text);
  }

  answerReceived(messageId: string): void {
    this.safe(this.callbacks.onAnswerReceived, messageId);
  }

  sessionStart(): void {
    this.safe(this.callbacks.onSessionStart);
  }

  error(code: number | undefined, message: string): void {
    this.safe(this.callbacks.onError, code, message);
  }
}
