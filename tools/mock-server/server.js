#!/usr/bin/env node
/*
 * FarmerChat SDK suite — local mock backend.
 *
 * Node standard library ONLY (http, url). No npm deps, no express.
 * Implements every endpoint in docs/02-api-reference.md with deterministic
 * happy-path JSON matching the wire model field names/shapes exactly
 * (snake_case). See docs/08-e2e-verification-protocol.md for the contract.
 *
 * Run:   node server.js
 * Listens on 0.0.0.0:8899.
 *
 * Reachable base URLs (set FarmerChatConfig.customBaseUrl to one of these):
 *   Android emulator          -> http://10.0.2.2:8899/
 *   iOS simulator / web / node -> http://localhost:8899/
 *   RN on emulator (adb reverse tcp:8899 tcp:8899) -> http://localhost:8899/
 */

'use strict';

const http = require('http');
const { URL } = require('url');

const HOST = '0.0.0.0';
const PORT = 8899;

// The base URL the server advertises back to clients for static assets (TTS /
// card image). Overridable via MOCK_PUBLIC_BASE so an emulator gets 10.0.2.2.
const PUBLIC_BASE =
  (process.env.MOCK_PUBLIC_BASE || `http://localhost:${PORT}`).replace(/\/$/, '');

// ---------------------------------------------------------------------------
// Small deterministic helpers
// ---------------------------------------------------------------------------

let counter = 1000;
function nextId() {
  counter += 1;
  return counter;
}
function uuid() {
  // Deterministic-enough pseudo-UUID (not crypto — mock only).
  const h = () => Math.floor((Math.random() * 0x10000)).toString(16).padStart(4, '0');
  return `${h()}${h()}-${h()}-4${h().slice(1)}-8${h().slice(1)}-${h()}${h()}${h()}`;
}
function nowIso() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Tiny valid audio file (WAV, 8 kHz mono 16-bit, ~0.4s 440 Hz tone).
// Served at /static/tts.wav — synthesise_audio returns a URL to this.
// ---------------------------------------------------------------------------

function makeWav() {
  const sampleRate = 8000;
  const seconds = 0.4;
  const numSamples = Math.floor(sampleRate * seconds);
  const dataSize = numSamples * 2; // 16-bit mono
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < numSamples; i++) {
    const v = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 8000);
    buf.writeInt16LE(v, 44 + i * 2);
  }
  return buf;
}
const TTS_WAV = makeWav();

// A minimal but valid 1x1 opaque PNG (used for the content card image_url).
const CARD_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

// ---------------------------------------------------------------------------
// Server-driven labels (get_labels). Keys lifted 1:1 from the app's Labels.kt
// (233 base keys). Served as `${baseKey}_en` -> English string so the SDK's
// LabelManager `${key}_${lang}` -> `${key}_en` chain resolves.
// ---------------------------------------------------------------------------

const LABEL_KEYS = [
  'fc_v2_app_label_access_denied',
  'fc_v2_app_label_account_details',
  'fc_v2_app_label_all_languages',
  'fc_v2_app_label_all_set',
  'fc_v2_app_label_also_see',
  'fc_v2_app_label_appearance',
  'fc_v2_app_label_apply_language',
  'fc_v2_app_label_applying_language',
  'fc_v2_app_label_ask',
  'fc_v2_app_label_ask_a_followup_questions',
  'fc_v2_app_label_ask_about_your_farm',
  'fc_v2_app_label_ask_specific_crops',
  'fc_v2_app_label_ask_your_farming_question',
  'fc_v2_app_label_asr_is_disabled_for_your_selected_language',
  'fc_v2_app_label_audio_not_available',
  'fc_v2_app_label_auto',
  'fc_v2_app_label_back',
  'fc_v2_app_label_by_continuing_to_verification_you_are_accepting_our',
  'fc_v2_app_label_by_continuing_you_agree_to_our',
  'fc_v2_app_label_by_tapping_get_started_you_agree_to_our',
  'fc_v2_app_label_camera',
  'fc_v2_app_label_camera_permission_required',
  'fc_v2_app_label_cancel',
  'fc_v2_app_label_cant_load_right_now',
  'fc_v2_app_label_characters',
  'fc_v2_app_label_check_mobile_data_wi-fi_signal',
  'fc_v2_app_label_check_your_internet_connection',
  'fc_v2_app_label_check_your_messages_code',
  'fc_v2_app_label_choose_a_followup_option_below',
  'fc_v2_app_label_choose_sim_number',
  'fc_v2_app_label_choose_your_language',
  'fc_v2_app_label_close',
  'fc_v2_app_label_comeback_tomorrow',
  'fc_v2_app_label_confirm',
  'fc_v2_app_label_continue',
  'fc_v2_app_label_continue_without_location',
  'fc_v2_app_label_couldnt_get_your_location',
  'fc_v2_app_label_couldnt_load_more_chats',
  'fc_v2_app_label_country_code',
  'fc_v2_app_label_country_phone_format',
  'fc_v2_app_label_day',
  'fc_v2_app_label_digital_green',
  'fc_v2_app_label_either_iconRes_or_imageVector_must_be_provided_when_not_loading',
  'fc_v2_app_label_enter_code_we_sent',
  'fc_v2_app_label_enter_phone_number',
  'fc_v2_app_label_enter_your_name',
  'fc_v2_app_label_enter_your_phone_number',
  'fc_v2_app_label_failed_to_get_response',
  'fc_v2_app_label_failed_to_load_chat_history',
  'fc_v2_app_label_failed_to_load_chats',
  'fc_v2_app_label_failed_to_process_audio',
  'fc_v2_app_label_failed_to_process_image',
  'fc_v2_app_label_failed_to_save',
  'fc_v2_app_label_failed_to_start_recording',
  'fc_v2_app_label_faq',
  'fc_v2_app_label_farmerchat',
  'fc_v2_app_label_farmerchat_adjusts_your_phone_settings',
  'fc_v2_app_label_farmerchat_always_dark_mode',
  'fc_v2_app_label_farmerchat_always_light_mode',
  'fc_v2_app_label_farmerchat_couldnt_load',
  'fc_v2_app_label_farmerchat_needs_the_internet',
  'fc_v2_app_label_farmerchat_starting',
  'fc_v2_app_label_farmerchat_tagline',
  'fc_v2_app_label_farmerchat_v200',
  'fc_v2_app_label_for_your_farm_today',
  'fc_v2_app_label_gallery',
  'fc_v2_app_label_get_advice_your_area',
  'fc_v2_app_label_get_local_advice',
  'fc_v2_app_label_get_started',
  'fc_v2_app_label_get_started_by_clicking_on_photo_speak_or_type_to_ask_your_question',
  'fc_v2_app_label_getting_todays_advice',
  'fc_v2_app_label_getting_your_answer',
  'fc_v2_app_label_getting_your_location',
  'fc_v2_app_label_go_to_settings',
  'fc_v2_app_label_have_a_great_day_come_back_tomorrow',
  'fc_v2_app_label_hello',
  'fc_v2_app_label_help',
  'fc_v2_app_label_help_support',
  'fc_v2_app_label_home',
  'fc_v2_app_label_how_did_things_go_today',
  'fc_v2_app_label_how_to_use_farmerchat',
  'fc_v2_app_label_how_we_help_you_evening',
  'fc_v2_app_label_how_we_help_you_morning',
  'fc_v2_app_label_how_we_help_you_today',
  'fc_v2_app_label_hows_farm_going_today',
  'fc_v2_app_label_hows_farm_looking_morning',
  'fc_v2_app_label_invalid_request_please_try_again',
  'fc_v2_app_label_language',
  'fc_v2_app_label_language_updated',
  'fc_v2_app_label_link_unavailable',
  'fc_v2_app_label_listen',
  'fc_v2_app_label_listening',
  'fc_v2_app_label_loading',
  'fc_v2_app_label_loading_chats',
  'fc_v2_app_label_loading_languages',
  'fc_v2_app_label_loading_more',
  'fc_v2_app_label_location_gps_turned_off',
  'fc_v2_app_label_location_gps_turned_off_turning_helps',
  'fc_v2_app_label_location_helps_suggestions',
  'fc_v2_app_label_location_tailor_advice',
  'fc_v2_app_label_location_updated',
  'fc_v2_app_label_location_weather_advice',
  'fc_v2_app_label_logout',
  'fc_v2_app_label_microphone_permission_is_required_for_voice_input',
  'fc_v2_app_label_microphone_permission_required',
  'fc_v2_app_label_more',
  'fc_v2_app_label_name',
  'fc_v2_app_label_name_must_be_at_least',
  'fc_v2_app_label_name_must_be_at_most',
  'fc_v2_app_label_need_help_anything_today',
  'fc_v2_app_label_network_error_please_try_again',
  'fc_v2_app_label_network_is_slow_please_try_again',
  'fc_v2_app_label_new_conversation',
  'fc_v2_app_label_night',
  'fc_v2_app_label_no_audio_available_message',
  'fc_v2_app_label_no_audio_recorded_or_conversation_not_started',
  'fc_v2_app_label_no_camera_app_available',
  'fc_v2_app_label_no_chats_yet',
  'fc_v2_app_label_no_faqs_available',
  'fc_v2_app_label_no_internet_connection',
  'fc_v2_app_label_no_network',
  'fc_v2_app_label_one_second_please',
  'fc_v2_app_label_or_ask_a_followup_questions',
  'fc_v2_app_label_permissions_are_required_to_auto_detect_sim_number.',
  'fc_v2_app_label_photo',
  'fc_v2_app_label_photos',
  'fc_v2_app_label_please_also_see_our',
  'fc_v2_app_label_please_check_try_again',
  'fc_v2_app_label_please_connect_internet_try_again',
  'fc_v2_app_label_please_enable_camera_settings',
  'fc_v2_app_label_please_enable_microphone_settings',
  'fc_v2_app_label_please_enter',
  'fc_v2_app_label_please_enter_a_valid_number',
  'fc_v2_app_label_please_enter_a_valid_otp',
  'fc_v2_app_label_please_try_again',
  'fc_v2_app_label_practical_advice_your_farm',
  'fc_v2_app_label_previous_questions_menu',
  'fc_v2_app_label_privacy_policy',
  'fc_v2_app_label_processing',
  'fc_v2_app_label_read_full_advice',
  'fc_v2_app_label_recent_chats',
  'fc_v2_app_label_related_questions',
  'fc_v2_app_label_request_timed_out_please_try_again',
  'fc_v2_app_label_resend_code',
  'fc_v2_app_label_save',
  'fc_v2_app_label_save_language',
  'fc_v2_app_label_save_name',
  'fc_v2_app_label_save_selection',
  'fc_v2_app_label_save_your_questions_answers',
  'fc_v2_app_label_saved_to_gallery',
  'fc_v2_app_label_saving',
  'fc_v2_app_label_search',
  'fc_v2_app_label_seconds',
  'fc_v2_app_label_secure_connection_failed',
  'fc_v2_app_label_see_all',
  'fc_v2_app_label_select_country_code',
  'fc_v2_app_label_send',
  'fc_v2_app_label_send_one_time_code',
  'fc_v2_app_label_send_otp_signin',
  'fc_v2_app_label_send_otp_signin_short',
  'fc_v2_app_label_send_via_sms',
  'fc_v2_app_label_send_via_whatsapp',
  'fc_v2_app_label_sending_code',
  'fc_v2_app_label_server_is_busy_please_try_again',
  'fc_v2_app_label_service_not_found',
  'fc_v2_app_label_session_expired_please_login_again',
  'fc_v2_app_label_setting_language',
  'fc_v2_app_label_setting_loading_state_immediately_gps_fetch_in_progress',
  'fc_v2_app_label_settings',
  'fc_v2_app_label_share_app_message',
  'fc_v2_app_label_share_download',
  'fc_v2_app_label_share_location',
  'fc_v2_app_label_sign_up',
  'fc_v2_app_label_sign_up_phone_number',
  'fc_v2_app_label_skip',
  'fc_v2_app_label_skip_for_now',
  'fc_v2_app_label_something_went_wrong',
  'fc_v2_app_label_something_went_wrong_please_try_again',
  'fc_v2_app_label_speak',
  'fc_v2_app_label_ssfr_advisory',
  'fc_v2_app_label_ssfr_advisory_description',
  'fc_v2_app_label_ssfr_maize',
  'fc_v2_app_label_ssfr_maize_question',
  'fc_v2_app_label_ssfr_wheat',
  'fc_v2_app_label_ssfr_wheat_question',
  'fc_v2_app_label_start_chat',
  'fc_v2_app_label_start_over',
  'fc_v2_app_label_start_using_farmerchat',
  'fc_v2_app_label_storage_exceeded',
  'fc_v2_app_label_terms_of_use',
  'fc_v2_app_label_terms_privacy_agreement',
  'fc_v2_app_label_thank_you_your_answer_helps_us_give_more_accurate_advice',
  'fc_v2_app_label_this_permission_is_needed_for_the_app_to_function_properly_please_enable_it_in_your_device_settings',
  'fc_v2_app_label_tips_ai_may_be_wrong_please_double_check',
  'fc_v2_app_label_tips_did_you_know',
  'fc_v2_app_label_tips_list_cannot_be_empty',
  'fc_v2_app_label_tips_quick_tip',
  'fc_v2_app_label_tips_try_this',
  'fc_v2_app_label_tips_upload_photos_for_plant_disease_identification',
  'fc_v2_app_label_tips_you_can_ask_followup_questions_to_get_more_details',
  'fc_v2_app_label_too_many_requests_please_try_later',
  'fc_v2_app_label_transcription_failed_please_try_again',
  'fc_v2_app_label_transcription_unclear',
  'fc_v2_app_label_try_again',
  'fc_v2_app_label_turn_location_on_now',
  'fc_v2_app_label_turn_on_gps',
  'fc_v2_app_label_turn_on_in_settings',
  'fc_v2_app_label_turn_on_location',
  'fc_v2_app_label_turning_helps_tailor_answers_your_area',
  'fc_v2_app_label_type',
  'fc_v2_app_label_unable_to_connect_please_try_again',
  'fc_v2_app_label_unable_to_load_legal_links',
  'fc_v2_app_label_unknown_error',
  'fc_v2_app_label_upload_photos_plant_disease_identification',
  'fc_v2_app_label_user_cancelled_or_provider_error',
  'fc_v2_app_label_verify',
  'fc_v2_app_label_verifying',
  'fc_v2_app_label_voice',
  'fc_v2_app_label_voice_input_is_still_improving',
  'fc_v2_app_label_we_greet_you_name',
  'fc_v2_app_label_we_need_your_location',
  'fc_v2_app_label_well_save_your_chats_you_continue',
  'fc_v2_app_label_what_do_you_need_help_today',
  'fc_v2_app_label_what_is_the_present_weather',
  'fc_v2_app_label_what_is_wrong_with_my_crop',
  'fc_v2_app_label_what_should_we_call_you',
  'fc_v2_app_label_what_we_help_you',
  'fc_v2_app_label_what_wrong_my_crop',
  'fc_v2_app_label_you_change_later',
  'fc_v2_app_label_your_name',
  'fc_v2_app_label_your_name_has_updated',
  'fc_v2_app_label_your_name_or_nickname',
  'fc_v2_app_label_youre_all_set',
];

// Hand-written English for the strings where a derived title would read poorly
// or where templating ({name}) matters.
const LABEL_OVERRIDES = {
  'fc_v2_app_label_farmerchat': 'FarmerChat',
  'fc_v2_app_label_farmerchat_tagline': 'Practical advice for your crops and animals',
  'fc_v2_app_label_farmerchat_starting': 'Starting FarmerChat...',
  'fc_v2_app_label_choose_your_language': 'Choose your language',
  'fc_v2_app_label_you_change_later': 'You can change this later',
  'fc_v2_app_label_start_using_farmerchat': 'Start using FarmerChat',
  'fc_v2_app_label_terms_privacy_agreement':
    'By continuing you agree to our Terms of use and Privacy policy',
  'fc_v2_app_label_terms_of_use': 'Terms of use',
  'fc_v2_app_label_privacy_policy': 'Privacy policy',
  'fc_v2_app_label_what_should_we_call_you': 'What should we call you?',
  'fc_v2_app_label_we_greet_you_name': 'Hello, {name}!',
  'fc_v2_app_label_your_name_or_nickname': 'Your name or nickname',
  'fc_v2_app_label_save_name': 'Save',
  'fc_v2_app_label_skip_for_now': 'Skip for now',
  'fc_v2_app_label_hello': 'Hello',
  'fc_v2_app_label_for_your_farm_today': 'For your farm today',
  'fc_v2_app_label_what_do_you_need_help_today': 'What do you need help with today?',
  'fc_v2_app_label_how_we_help_you_morning': 'Good morning! How can we help you today?',
  'fc_v2_app_label_photo': 'Photo',
  'fc_v2_app_label_speak': 'Speak',
  'fc_v2_app_label_type': 'Type',
  'fc_v2_app_label_ask_your_farming_question': 'Ask your farming question',
  'fc_v2_app_label_send': 'Send',
  'fc_v2_app_label_listen': 'Listen',
  'fc_v2_app_label_ask': 'Ask',
  'fc_v2_app_label_start_chat': 'Start chat',
  'fc_v2_app_label_related_questions': 'Related questions',
  'fc_v2_app_label_settings': 'Settings',
  'fc_v2_app_label_help': 'Help',
  'fc_v2_app_label_logout': 'Log out',
  'fc_v2_app_label_recent_chats': 'Recent chats',
  'fc_v2_app_label_new_conversation': 'New conversation',
  'fc_v2_app_label_try_again': 'Try again',
  'fc_v2_app_label_verify': 'Verify',
  'fc_v2_app_label_enter_your_phone_number': 'Enter your phone number',
  'fc_v2_app_label_send_via_sms': 'Send via SMS',
  'fc_v2_app_label_send_via_whatsapp': 'Send via WhatsApp',
  'fc_v2_app_label_ssfr_advisory': 'Fertilizer advisory',
  'fc_v2_app_label_ssfr_advisory_description':
    'Get a site-specific fertilizer recommendation for your crop',
  'fc_v2_app_label_ssfr_wheat': 'Wheat',
  'fc_v2_app_label_ssfr_maize': 'Maize',
  'fc_v2_app_label_ssfr_wheat_question': 'How much fertilizer should I apply to my wheat?',
  'fc_v2_app_label_ssfr_maize_question': 'How much fertilizer should I apply to my maize?',
};

// English labels as the real stage backend serves them (endpoint #3, language 1, captured
// 2026-10-08). They win over everything below: the SDK renders the SERVED string, so a mock that
// invents text (e.g. "Share download" for `share_download`, which stage serves as "Share") makes
// the UI look wrong in ways the real backend never does. Refresh this file from stage when labels
// change; keys stage does not serve fall back to the overrides, then to text built from the key.
const SERVED_EN = require('./served-labels-en.json');

function deriveEnglish(key) {
  if (SERVED_EN[`${key}_en`] !== undefined) return SERVED_EN[`${key}_en`];
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key];
  let s = key
    .replace(/^fc_v2_app_label_/, '')
    .replace(/^tips_/, '')
    .replace(/\.$/, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildLabelMap() {
  const map = {};
  for (const key of LABEL_KEYS) {
    map[`${key}_en`] = deriveEnglish(key);
  }
  // Served keys the list above does not name yet, so the mock never lags the real backend.
  for (const [fullKey, value] of Object.entries(SERVED_EN)) {
    if (!(fullKey in map)) map[fullKey] = value;
  }
  return map;
}
const LABEL_MAP = buildLabelMap();

// ---------------------------------------------------------------------------
// A real markdown answer for get_answer_for_text_query (NEVER a 500).
// ---------------------------------------------------------------------------

function markdownAnswer(query) {
  const q = (query || 'your crop').trim();
  return [
    `**Protecting your crop: ${q}**`,
    '',
    'Here is practical, step-by-step guidance:',
    '',
    '1. **Scout your field early.** Walk the field two or three times a week and look at the newest leaves and the whorl, where pests like fall armyworm feed first.',
    '2. **Identify the damage.** Ragged holes, "windowpane" feeding, and moist sawdust-like frass in the whorl are classic armyworm signs.',
    '3. **Act at the right threshold.** Treat when about 20% of plants show fresh whorl damage. Below that, natural predators often keep pests in check.',
    '4. **Use an integrated approach:**',
    '   - Hand-pick and destroy egg masses and larvae where practical.',
    '   - Apply a recommended biopesticide such as *Bacillus thuringiensis* (Bt) in the evening.',
    '   - Rotate chemistries to avoid resistance if you must spray.',
    '5. **Support plant health.** Balanced fertilization and adequate water help the crop recover from feeding.',
    '',
    '> Tip: Early morning or late evening is the best time to scout and to spray, when larvae are active and pollinators are not.',
    '',
    'If damage keeps spreading after treatment, share a photo and I can help narrow down the cause.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Response payload builders (field names match docs/02 + core model classes).
// ---------------------------------------------------------------------------

function initializeUserResponse() {
  return {
    access_token: `mock-access-${uuid()}`,
    refresh_token: `mock-refresh-${uuid()}`,
    user_id: 'mock-user-1',
    show_crops_livestocks: true,
    last_location_fetch_threshold: '24',
    display_address: 'Bengaluru, Karnataka, India',
    created_on: nowIso(),
    location_source: 'ip',
    country_code: 'IN',
    country: 'India',
    state: 'Karnataka',
    dashboard: true,
    created_now: true,
    geography_level3: 'Bengaluru Urban',
    geography_level4: null,
    geography_level5: null,
    geography_level6: null,
    ip_location_fallback_time_limit: 300,
  };
}

function supportedLanguages() {
  const lang = (id, name, code, bcp, latn, display, flag, asr, tts, phone) => ({
    id,
    name,
    code,
    bcpCode: bcp,
    latnCode: latn,
    display_name: display,
    flag,
    ttsVoiceName: `${code}-voice`,
    asr_enabled: asr,
    tts_enabled: tts,
    country_phone_code: phone,
  });
  return [
    {
      display_name: 'India',
      flag: '🇮🇳',
      priority_view: [
        lang(1, 'Kannada', 'kn', 'kn-IN', 'kn-Latn', 'ಕನ್ನಡ', '🇮🇳', true, true, '+91'),
        lang(2, 'English', 'en', 'en-IN', 'en-Latn', 'English', '🇮🇳', true, true, '+91'),
        lang(3, 'Hindi', 'hi', 'hi-IN', 'hi-Latn', 'हिन्दी', '🇮🇳', true, true, '+91'),
      ],
      expanded_view: [
        lang(4, 'Telugu', 'te', 'te-IN', 'te-Latn', 'తెలుగు', '🇮🇳', true, true, '+91'),
        lang(5, 'Tamil', 'ta', 'ta-IN', 'ta-Latn', 'தமிழ்', '🇮🇳', true, true, '+91'),
        lang(6, 'Marathi', 'mr', 'mr-IN', 'mr-Latn', 'मराठी', '🇮🇳', false, true, '+91'),
      ],
    },
  ];
}

function homeFeed() {
  return {
    greeting: 'Good morning! How can we help you today?',
    ssfr_enable: true,
    sections: [
      {
        type: 'content',
        id: 1001,
        image_url: `${PUBLIC_BASE}/static/card.png`,
        title: 'Protect your maize from fall armyworm this week',
        question_text: 'Protect your maize from fall armyworm this week',
        statement_id: 'stmt-1001',
        badge: { icon: 'eye', count: '1.2k', show: true },
        cta: { text: 'Read full advice', action: 'open_statement' },
        statement: null,
        selection_type: null,
        options: null,
        statement_type: 'content_card',
        is_viewed: false,
        meta: {
          country: 'India',
          county: 'Bengaluru Urban',
          asset_name: 'Maize',
          asset_category: 'crop',
          growth_stage: 'vegetative',
          user_country: 'India',
          user_county: 'Bengaluru Urban',
          concern: 'pest',
          date_range: null,
          geography_level2: 'Karnataka',
        },
        unique_key: null,
        label: null,
      },
      {
        type: 'question',
        id: 1002,
        image_url: null,
        title: 'What is your gender?',
        question_text: null,
        statement_id: 'stmt-1002',
        badge: null,
        cta: null,
        statement: 'What is your gender?',
        selection_type: 'single',
        options: [
          { id: 'male', text: 'Male' },
          { id: 'female', text: 'Female' },
          { id: 'other', text: 'Other' },
        ],
        statement_type: 'single_select',
        is_viewed: false,
        meta: null,
        unique_key: null,
        label: null,
      },
      {
        type: 'question',
        id: 1003,
        image_url: null,
        title: 'Which crops do you grow?',
        question_text: null,
        statement_id: 'stmt-1003',
        badge: null,
        cta: null,
        statement: 'Which crops do you grow?',
        selection_type: 'multi',
        options: [
          { id: 'maize', text: 'Maize' },
          { id: 'wheat', text: 'Wheat' },
          { id: 'rice', text: 'Rice' },
          { id: 'tomato', text: 'Tomato' },
          { id: 'cotton', text: 'Cotton' },
        ],
        statement_type: 'multi_select',
        is_viewed: false,
        meta: null,
        unique_key: null,
        label: null,
      },
    ],
  };
}

function preferredLanguage() {
  return {
    asr_bcp_code: 'en-IN',
    asr_enabled: true,
    asr_inference_model: null,
    asr_service_provider: 'mock',
    code: 'en',
    created_by: null,
    created_on: nowIso(),
    display_name: 'English',
    id: 2,
    is_active: true,
    is_deleted: false,
    latn_code: 'en-Latn',
    name: 'English',
    primary_speaking_countries: ['IN'],
    translation_inference_model: null,
    translation_service_provider: 'mock',
    tts_bcp_code: 'en-IN',
    tts_enabled: true,
    tts_inference_model: null,
    tts_service_provider: 'mock',
    tts_voice_name: 'en-IN-voice',
    updated_by: null,
    updated_on: nowIso(),
  };
}

function verifyOtpResponse() {
  return {
    access_token: `mock-access-${uuid()}`,
    refresh_token: `mock-refresh-${uuid()}`,
    crop_selection_enabled: true,
    crop_id: null,
    id: 'mock-user-1',
    phone: '9999999999',
    email: null,
    role: 'farmer',
    phone_country_code: '+91',
    message: 'OTP verified',
    otp: null,
    preferred_language: preferredLanguage(),
    lat: null,
    existing_user: false,
    name: null,
  };
}

function textPromptResponse(query) {
  const messageId = uuid();
  return {
    error: false,
    message: null,
    message_id: messageId,
    query: query || '',
    response: markdownAnswer(query),
    resource_url: null,
    translated_response: null,
    follow_up_questions: null, // always null; real follow-ups from endpoint #29
    section_message_id: uuid(),
    actual_content_provider: 'FarmerChat Knowledge Base',
    content_provider_logo: null,
    hide_feedback_icons: false,
    hide_follow_up_question: false,
    hide_share_icon: false,
    hide_tts_speaker: false,
    hide_source: false,
    points: 10,
    intent_classification_output: {
      asset_name: 'Maize',
      asset_status: 'growing',
      asset_type: 'crop',
      clarification_needed: {
        additional_context: null,
        asset: false,
        concern: false,
      },
      concern: 'pest_management',
      confidence: '0.95',
      intent: 'pest_management',
      likely_activity: 'crop_protection',
      rephrased_query: query || '',
      seasonal_relevance: 'high',
      stage: 'vegetative',
    },
  };
}

function followUpQuestions() {
  return {
    message_id: uuid(),
    section_message_id: uuid(),
    clarification_required: false,
    questions: [
      {
        follow_up_question_id: uuid(),
        question: 'Which biopesticide is safest for maize at this stage?',
        sequence: 1,
      },
      {
        follow_up_question_id: uuid(),
        question: 'How often should I scout my field for armyworm?',
        sequence: 2,
      },
      {
        follow_up_question_id: uuid(),
        question: 'What natural predators help control armyworm?',
        sequence: 3,
      },
    ],
  };
}

function conversationList(page) {
  const p = page || 1;
  // Two real pages so the SDK's list pagination is exercised end-to-end.
  // `next` is a URL STRING (as the real backend sends it, NOT a numeric
  // next_page) and `has_more` flips false on the last page.
  const page1 = [
    {
      conversation_id: 'conv-001',
      conversation_title: 'How do I protect my maize from armyworm?',
      created_on: nowIso(),
      message_type: 'query_text',
      grouping: 'Today',
      content_provider_logo: null,
      content_provider_id: null,
      content_provider_name: null,
    },
    {
      conversation_id: 'conv-002',
      conversation_title: 'Best fertilizer schedule for wheat',
      created_on: new Date(Date.now() - 86400000).toISOString(),
      message_type: 'query_text',
      grouping: 'Yesterday',
      content_provider_logo: null,
      content_provider_id: null,
      content_provider_name: null,
    },
    {
      conversation_id: 'conv-003',
      conversation_title: 'Why are my tomato leaves curling?',
      created_on: new Date(Date.now() - 5 * 86400000).toISOString(),
      message_type: 'query_audio',
      grouping: 'This week',
      content_provider_logo: null,
      content_provider_id: null,
      content_provider_name: null,
    },
  ];
  const page2 = [
    {
      conversation_id: 'conv-004',
      conversation_title: 'When should I sow mustard?',
      created_on: new Date(Date.now() - 8 * 86400000).toISOString(),
      message_type: 'query_text',
      grouping: 'This week',
      content_provider_logo: null,
      content_provider_id: null,
      content_provider_name: null,
    },
    {
      conversation_id: 'conv-005',
      conversation_title: 'Organic pest control options',
      created_on: new Date(Date.now() - 20 * 86400000).toISOString(),
      message_type: 'card',
      grouping: 'Earlier',
      content_provider_logo: null,
      content_provider_id: null,
      content_provider_name: null,
    },
  ];
  if (p >= 2) {
    return {
      results: page2,
      count: 5,
      next: null,
      previous: `${PUBLIC_BASE}/api/chat/conversation_list/?page=1`,
      page: p,
      page_size: 3,
      total_pages: 2,
      has_more: false,
    };
  }
  return {
    results: page1,
    count: 5,
    next: `${PUBLIC_BASE}/api/chat/conversation_list/?page=2`,
    previous: null,
    page: 1,
    page_size: 3,
    total_pages: 2,
    has_more: true,
  };
}

function conversationChatHistory(conversationId, page) {
  const cid = conversationId || 'conv-001';
  // The #32 response carries no pagination metadata; the SDK pages by "did this
  // page return items". Page 1 has the thread; later pages are empty so
  // load-earlier terminates (matches the real backend, not the old always-full
  // behavior that would loop forever).
  if ((page || 1) > 1) return { conversation_id: cid, data: [] };
  return {
    conversation_id: cid,
    data: [
      {
        message_type_id: 1,
        message_type: 'query_text',
        message_id: uuid(),
        message_input_time: new Date(Date.now() - 600000).toISOString(),
        section_message_id: null,
        query_text: 'How do I protect my maize from armyworm?',
        heard_query_text: null,
        response_text: null,
        questions: null,
        query_media_file_url: null,
        reaction: null,
        response_media_file_url: null,
        resource_id: null,
        resource_url: null,
        actual_content_provider: null,
        content_provider_logo: null,
        hide_source: null,
        hide_tts_speaker: null,
        clarification_required: null,
      },
      {
        message_type_id: 3,
        message_type: 'response_text',
        message_id: uuid(),
        message_input_time: new Date(Date.now() - 590000).toISOString(),
        section_message_id: uuid(),
        query_text: null,
        heard_query_text: null,
        response_text: markdownAnswer('How do I protect my maize from armyworm?'),
        questions: null,
        query_media_file_url: null,
        reaction: null,
        response_media_file_url: `${PUBLIC_BASE}/static/tts.wav`,
        resource_id: null,
        resource_url: null,
        actual_content_provider: 'FarmerChat Knowledge Base',
        content_provider_logo: null,
        hide_source: false,
        hide_tts_speaker: false,
        clarification_required: false,
      },
      {
        message_type_id: 2,
        message_type: 'query_audio',
        message_id: uuid(),
        message_input_time: new Date(Date.now() - 500000).toISOString(),
        section_message_id: null,
        query_text: null,
        heard_query_text: 'What fertilizer should I use for wheat?',
        response_text: null,
        questions: null,
        query_media_file_url: `${PUBLIC_BASE}/static/tts.wav`,
        reaction: null,
        response_media_file_url: null,
        resource_id: null,
        resource_url: null,
        actual_content_provider: null,
        content_provider_logo: null,
        hide_source: null,
        hide_tts_speaker: null,
        clarification_required: null,
      },
      {
        message_type_id: 11,
        message_type: 'input_image',
        message_id: uuid(),
        message_input_time: new Date(Date.now() - 400000).toISOString(),
        section_message_id: null,
        query_text: 'What is wrong with this leaf?',
        heard_query_text: null,
        response_text: null,
        questions: null,
        query_media_file_url: `${PUBLIC_BASE}/static/card.png`,
        reaction: null,
        response_media_file_url: null,
        resource_id: null,
        resource_url: null,
        actual_content_provider: null,
        content_provider_logo: null,
        hide_source: null,
        hide_tts_speaker: null,
        clarification_required: null,
      },
      {
        message_type_id: 7,
        message_type: 'follow_up_questions',
        message_id: uuid(),
        message_input_time: new Date(Date.now() - 390000).toISOString(),
        section_message_id: uuid(),
        query_text: null,
        heard_query_text: null,
        response_text: null,
        questions: [
          {
            follow_up_question_id: uuid(),
            sequence: 1,
            question: 'Which biopesticide is safest for maize at this stage?',
          },
          {
            follow_up_question_id: uuid(),
            sequence: 2,
            question: 'How often should I scout my field for armyworm?',
          },
          {
            follow_up_question_id: uuid(),
            sequence: 3,
            question: 'What natural predators help control armyworm?',
          },
        ],
        query_media_file_url: null,
        reaction: null,
        response_media_file_url: null,
        resource_id: null,
        resource_url: null,
        actual_content_provider: null,
        content_provider_logo: null,
        hide_source: null,
        hide_tts_speaker: null,
        clarification_required: false,
      },
    ],
  };
}

function farmerProfile() {
  return {
    user_profile: {
      address: {
        country: 'India',
        level_2: 'Karnataka',
        level_3: 'Bengaluru Urban',
        level_4: null,
        level_5: null,
        level_6: null,
        city: 'Bengaluru',
        state: 'Karnataka',
        state_district: 'Bengaluru Urban',
      },
      age: 34,
      country: 1,
      country_name: 'India',
      crop_details: [{ id: 'maize', text: 'Maize' }],
      farmland_details: [],
      farmer_reach_count: 0,
      first_name: 'Ravi',
      gender: 'male',
      geography_display_address: 'Bengaluru, Karnataka, India',
      geography_level2: 1,
      geography_level2_name: 'Karnataka',
      geography_level3: 'Bengaluru Urban',
      geography_level4: null,
      geography_level5: null,
      geography_level6: null,
      id: 'mock-user-1',
      land_holding: '2 acres',
      last_name: 'Kumar',
      lat: '12.9716',
      live_stock_details: [],
      llm_model: 'mock-model',
      long: '77.5946',
      memory: [],
      preferred_language: 'en',
      phone: '9999999999',
      phone_country_code: '+91',
      profile_picture: null,
      receive_com_via_whatsapp: true,
      role: [{ id: 'farmer', text: 'Farmer' }],
      show_feedback_prompt: false,
      specialization: null,
      user_id: 'mock-user-1',
    },
    role_assigned: {
      id: 1,
      role_name: 'farmer',
      role_display_name: 'Farmer',
    },
  };
}

function countries() {
  return [
    {
      code: 'IN',
      display_name: 'India',
      flag: '🇮🇳',
      id: 1,
      name: 'India',
      phone_country_code: '+91',
      phone_length: 10,
      phone_number_pattern: '^[6-9]\\d{9}$',
    },
    {
      code: 'KE',
      display_name: 'Kenya',
      flag: '🇰🇪',
      id: 2,
      name: 'Kenya',
      phone_country_code: '+254',
      phone_length: 9,
      phone_number_pattern: null,
    },
    {
      code: 'ET',
      display_name: 'Ethiopia',
      flag: '🇪🇹',
      id: 3,
      name: 'Ethiopia',
      phone_country_code: '+251',
      phone_length: 9,
      phone_number_pattern: null,
    },
  ];
}

function helpSupport() {
  return {
    status: 'success',
    data: {
      faqs: [
        {
          id: 'faq-1',
          title: 'How do I ask a question?',
          'webview-url': `${PUBLIC_BASE}/static/faq.html`,
          'open-mode': 'webview',
        },
        {
          id: 'faq-2',
          title: 'How do I change my language?',
          'webview-url': `${PUBLIC_BASE}/static/faq.html`,
          'open-mode': 'webview',
        },
      ],
      legal: {
        'privacy-policy': {
          title: 'Privacy policy',
          'webview-url': `${PUBLIC_BASE}/static/legal.html`,
          'open-mode': 'webview',
        },
        'terms-of-use': {
          title: 'Terms of use',
          'webview-url': `${PUBLIC_BASE}/static/legal.html`,
          'open-mode': 'webview',
        },
      },
      mode: 'auto',
    },
  };
}

// ---------------------------------------------------------------------------
// Route table.  key = "METHOD /path/"  ->  (ctx) => payload | {status, body}
// ctx = { body, query, method, path }
// A returned plain object is sent as 200 JSON. Return { __status, __body } for
// custom status / raw payloads (arrays are fine to return directly).
// ---------------------------------------------------------------------------

const routes = {
  // ---- auth / user / onboarding ----
  'POST /api/user/initialize_user/': () => initializeUserResponse(),
  'GET /api/language/v2/country_wise_supported_languages/': () => supportedLanguages(),
  'GET /api/language/v2/get_labels/': () => LABEL_MAP,
  'GET /api/user/privacy_policy/': () => ({
    url: `${PUBLIC_BASE}/static/legal.html`,
    leaderboard_privacy_policy_url: `${PUBLIC_BASE}/static/legal.html`,
    farmerchat_terms_of_use: `${PUBLIC_BASE}/static/legal.html`,
    leaderboard_terms_of_use: `${PUBLIC_BASE}/static/legal.html`,
  }),
  'GET /api/geography/get_all_countries/': () => countries(),
  'POST /api/user/set_preferred_language/': (ctx) => ({
    user_id: (ctx.body && ctx.body.user_id) || 'mock-user-1',
  }),
  'POST /api/user/accept_terms/': () => ({
    message: 'Terms accepted',
    success: true,
    terms_accepted: true,
    terms_accepted_at: nowIso(),
  }),
  'POST /api/user/update_user_profile/': (ctx) => ({
    message: 'Profile updated',
    user_profile: {
      id: 'mock-user-1',
      user_id: 'mock-user-1',
      first_name: (ctx.body && ctx.body.name) || 'Ravi',
      last_name: '',
      gender: (ctx.body && ctx.body.gender) || null,
      age: (ctx.body && ctx.body.age) || null,
      land_holding: (ctx.body && ctx.body.land_holding) || null,
      role: (ctx.body && ctx.body.role) || null,
      specialization: null,
      preferred_language: 'en',
      profile_picture: null,
      receive_com_via_whatsapp: false,
      crop_details: [],
      live_stock_details: [],
    },
  }),
  'GET /api/user/view_user_profile/': () => farmerProfile(),
  'PATCH /api/user/v2/update_build_version/': (ctx) => ({
    message: 'Build version updated',
    build_version: 'v2',
    user_id: (ctx.body && ctx.body.user_id) || 'mock-user-1',
  }),
  'POST /api/user/update_user_location/': (ctx) => ({
    error_message: null,
    user_profile: {
      user_id: (ctx.body && ctx.body.user_id) || 'mock-user-1',
      country_name: 'India',
      country_code: 'IN',
      geography_level2_name: 'Karnataka',
      geography_level3: 'Bengaluru Urban',
      geography_level4: null,
      geography_level5: null,
      geography_level6: null,
      display_address: 'Bengaluru, Karnataka, India',
      latitude: (ctx.body && Number(ctx.body.lat)) || 12.9716,
      longitude: (ctx.body && Number(ctx.body.long)) || 77.5946,
    },
  }),

  // ---- home / weather / crops ----
  'GET /api/images/v2/daily/': () => homeFeed(),
  'POST /api/weather/v2/weather_forecast_lite/': () => ({
    current_temp: '27',
    precipitation_probability: '20',
    weather_icon: 'cloudy',
  }),
  'POST /api/user/update_crop_details/': () => ({ message: 'Crops updated' }),
  'PATCH /api/images/v2/viewed/': (ctx) => ({
    image_id: 'img-1001',
    statement_id: (ctx.body && ctx.body.statement_id) || 'stmt-1001',
    view_count: 1201,
    status: 'viewed',
  }),
  'POST /api/images/v2/statement/': (ctx) => ({
    id: (ctx.body && ctx.body.statement_id) || 'stmt-1001',
    short_answer: markdownAnswer('Protect your maize from fall armyworm'),
    follow_up_questions: [
      { follow_up_question_id: uuid(), sequence: 1, question: 'Which biopesticide is safest for maize?' },
      { follow_up_question_id: uuid(), sequence: 2, question: 'How often should I scout for armyworm?' },
      { follow_up_question_id: uuid(), sequence: 3, question: 'What natural predators control armyworm?' },
    ],
    message_id: uuid(),
    conversation_id: `conv-${nextId()}`,
  }),
  'GET /api/images/v2/user_question_count/': () => ({
    total_questions_asked: 3,
    bypass_interstitial: false,
  }),

  // ---- OTP / login ----
  'POST /api/user/generate_otp/': (ctx) => ({
    message: 'OTP sent',
    detail: null,
    phone: (ctx.body && ctx.body.phone) || null,
    phone_country_code: (ctx.body && ctx.body.phone_country_code) || null,
    device_id: (ctx.body && ctx.body.device_id) || null,
    otp: null,
    user_id: (ctx.body && ctx.body.user_id) || 'mock-user-1',
  }),
  'POST /api/user/check_device_user_limit/': (ctx) => ({
    message: 'OK',
    detail: null,
    phone: (ctx.body && ctx.body.phone) || null,
    phone_country_code: (ctx.body && ctx.body.phone_country_code) || null,
    device_id: (ctx.body && ctx.body.device_id) || null,
    otp: null,
    user_id: 'mock-user-1',
  }),
  'POST /api/user/verify_otp_less_android_sdk_token/': () => verifyOtpResponse(),
  'GET /api/geography/communication_channel/': () => [
    { sms_enabled: true, whatsapp_enabled: true },
  ],
  'POST /api/user/verify_otp/': (ctx) => {
    // Accept ANY 4-digit OTP (docs/08).
    const otp = ctx.body && ctx.body.otp;
    if (typeof otp !== 'string' || !/^\d{4}$/.test(otp)) {
      return {
        __status: 400,
        __body: { otp: 'Please enter a valid 4-digit OTP', error: true },
      };
    }
    return verifyOtpResponse();
  },
  'GET /api/chat/conversation_list/': (ctx) =>
    conversationList(Number(ctx.query.page) || 1),
  'POST /api/user/logout/': () => ({ message: 'Logged out' }),
  'GET /api/faqs': () => helpSupport(),

  // ---- chat ----
  'POST /api/chat/new_conversation/': () => ({
    conversation_id: `conv-${nextId()}`,
    message: 'Conversation created',
    show_popup: false,
  }),
  'POST /api/chat/transcribe_audio/': () => ({
    message: null,
    heard_input_query: 'How do I protect my maize from armyworm',
    confidence_score: 0.93,
    error: false,
    message_id: uuid(),
    section_message_id: uuid(),
    message_reference_id: uuid(),
    points: 0,
    transcription_id: uuid(),
  }),
  'POST /api/chat/get_answer_for_text_query/': (ctx) =>
    textPromptResponse(ctx.body && ctx.body.query),
  'POST /api/chat/image_analysis/': (ctx) => {
    const messageId = uuid();
    return {
      audio: null,
      error: false,
      hide_tts_speaker: false,
      message: '',
      message_id: messageId,
      response: markdownAnswer((ctx.body && ctx.body.query) || 'this plant leaf'),
      section_message_id: uuid(),
      actual_content_provider: 'FarmerChat Vision',
      content_provider_logo: null,
      points: 10,
      follow_up_questions: [
        { follow_up_question_id: uuid(), sequence: 1, question: 'Is this a fungal or bacterial infection?' },
        { follow_up_question_id: uuid(), sequence: 2, question: 'What treatment do you recommend?' },
        { follow_up_question_id: uuid(), sequence: 3, question: 'How do I stop it spreading?' },
      ],
    };
  },
  'GET /api/chat/follow_up_questions/': () => followUpQuestions(),
  'POST /api/chat/follow_up_question_click/': () => ({ message: 'ok' }),
  'POST /api/chat/synthesise_audio/': () => ({
    message: null,
    error: false,
    audio: `${PUBLIC_BASE}/static/tts.wav`,
    text: null,
    section_message_id: uuid(),
  }),
  'GET /api/chat/conversation_chat_history/': (ctx) =>
    conversationChatHistory(ctx.query.conversation_id, Number(ctx.query.page) || 1),
  'POST /api/chat/add_query_to_history/': () => ({
    message: {
      id: uuid(),
      conversation_id: `conv-${nextId()}`,
      original_message: null,
      message_response: null,
      input_type: 'text',
      source: 'campaign',
    },
    follow_up_questions: [],
    video_resources: [],
    error: false,
  }),

  // ---- token endpoints ----
  'POST /api/user/get_new_access_token/': () => ({
    access_token: `mock-access-${uuid()}`,
    refresh_token: `mock-refresh-${uuid()}`,
  }),
  'POST /api/user/send_tokens/': () => ({
    access_token: `mock-access-${uuid()}`,
    refresh_token: `mock-refresh-${uuid()}`,
  }),

  // ---- Google geolocate (stub; SDKs call googleapis.com directly, kept for completeness) ----
  'POST /geolocation/v1/geolocate': () => ({
    location: { lat: 12.9716, lng: 77.5946 },
    accuracy: 1500.0,
  }),
};

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      // Guard against runaway bodies (base64 audio/images can be large but bounded).
      if (size <= 25 * 1024 * 1024) chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        resolve({ __raw: raw });
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  });
  res.end(body);
}

function matchRoute(method, pathname) {
  // Try exact, then toggle trailing slash.
  const candidates = [
    `${method} ${pathname}`,
    pathname.endsWith('/')
      ? `${method} ${pathname.slice(0, -1)}`
      : `${method} ${pathname}/`,
  ];
  for (const key of candidates) {
    if (routes[key]) return { key, handler: routes[key] };
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const method = req.method.toUpperCase();
  const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsed.pathname;

  // CORS preflight (web SDK).
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    });
    res.end();
    return;
  }

  // Static assets.
  if (method === 'GET' && pathname === '/static/tts.wav') {
    console.log(`${method} ${pathname} -> static:tts.wav`);
    res.writeHead(200, {
      'Content-Type': 'audio/wav',
      'Content-Length': TTS_WAV.length,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(TTS_WAV);
    return;
  }
  if (method === 'GET' && pathname === '/static/card.png') {
    console.log(`${method} ${pathname} -> static:card.png`);
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': CARD_PNG.length,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(CARD_PNG);
    return;
  }
  if (method === 'GET' && (pathname === '/static/faq.html' || pathname === '/static/legal.html')) {
    console.log(`${method} ${pathname} -> static:html`);
    const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>FarmerChat mock</title></head><body style="font-family:sans-serif;padding:24px"><h1>FarmerChat mock page</h1><p>This is a placeholder legal / FAQ page served by the local mock backend.</p></body></html>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(html);
    return;
  }

  // Health check.
  if (method === 'GET' && (pathname === '/' || pathname === '/health')) {
    console.log(`${method} ${pathname} -> health`);
    sendJson(res, 200, { ok: true, service: 'farmerchat-mock', endpoints: Object.keys(routes).length });
    return;
  }

  const match = matchRoute(method, pathname);
  const body = method === 'GET' ? {} : await readBody(req);
  const query = Object.fromEntries(parsed.searchParams.entries());

  if (!match) {
    console.log(`${method} ${pathname} -> 404 NO MATCH`);
    sendJson(res, 404, { error: true, message: `No mock handler for ${method} ${pathname}` });
    return;
  }

  console.log(`${method} ${pathname} -> ${match.key}`);
  let result;
  try {
    result = match.handler({ body, query, method, path: pathname });
  } catch (e) {
    console.log(`  ! handler error: ${e && e.message}`);
    sendJson(res, 500, { error: true, message: 'mock handler threw' });
    return;
  }

  if (result && typeof result === 'object' && '__status' in result) {
    sendJson(res, result.__status, result.__body);
  } else {
    sendJson(res, 200, result);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`FarmerChat mock backend listening on http://${HOST}:${PORT}`);
  console.log(`  Android emulator : http://10.0.2.2:${PORT}/`);
  console.log(`  iOS sim/web/node : http://localhost:${PORT}/`);
  console.log(`  RN (adb reverse) : http://localhost:${PORT}/  (adb reverse tcp:${PORT} tcp:${PORT})`);
  console.log(`  ${Object.keys(routes).length} JSON routes + /static/{tts.wav,card.png} + /health`);
  console.log(`  Static/asset base advertised to clients: ${PUBLIC_BASE}`);
});
