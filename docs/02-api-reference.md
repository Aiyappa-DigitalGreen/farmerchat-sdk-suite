# FarmerChat — API Reference & Data/Domain/Core Layer Spec

Source: `data/remote/ApiServices.kt`, `core/network/`, `core/auth/`, `domain/`. HTTP: Retrofit + OkHttp + Gson. Chat replies arrive as **single JSON HTTP responses** — no WebSocket/SSE/streaming anywhere in the app.

## Base URLs (per environment)

| Env | Base URL |
|---|---|
| dev | `https://farmerchat.farmstack.co/mobile-app-dev/` |
| stage | `https://farmerchat.farmstack.co/mobile-app-stage/` |
| demo | `https://farmerchat.farmstack.co/mobile-app-demo/` |
| prod | `https://v2.api.farmer.chat/` |
| eks | `https://api.farmerchat.in/` |

Google Geolocation: `https://www.googleapis.com/geolocation/v1/geolocate?key=<GEO_API_KEY>` (POST `GeoRequestBody(considerIp=true)` → `GeoResponse(location{lat,lng}, accuracy)`).

## Endpoints (main API)

| # | Method | Path | Purpose | Params | Request → Response |
|---|--------|------|---------|--------|--------------------|
| 1 | POST | `api/user/initialize_user/` | Guest init (issues tokens) | Header `API-Key` | `InitializeGuestUserRequest` → `InitializeGuestUserResponse` |
| 2 | GET | `api/language/v2/country_wise_supported_languages/` | Language list | `country_code`, `state`, `priority_view=true` | → `List<SupportedLanguageGroup>` |
| 3 | GET | `api/language/v2/get_labels/` | Server-driven UI labels | `language`(Int) | → `Map<String,String>` |
| 4 | GET | `api/user/privacy_policy/` | Legal links | — | → `PrivacyPolicyResponse` |
| 5 | GET | `api/geography/get_all_countries/` | Country list | — | → `List<CountryItem>` |
| 6 | POST | `api/user/set_preferred_language/` | Save language | — | `SetPreferredLanguageRequest(user_id, language_id)` → `{user_id}` |
| 7 | POST | `api/user/accept_terms/` | Accept T&C | — | `AcceptPPandTCRequest(user_id)` → `AcceptPPandTCResponse` |
| 8 | POST | `api/user/update_user_profile/` | Update name/profile | — | `UserNameRequest` → `UserNameResponse` |
| 9 | GET | `api/user/view_user_profile/` | Fetch profile | `id` | → `FarmerProfile` |
| 10 | PATCH | `api/user/v2/update_build_version/` | Report build version | — | `UpdateBuildVersionRequest(user_id)` → resp |
| 11 | POST | `api/user/update_user_location/` | Save GPS location | — | `UpdateLocationRequest` → `GetLocationResponse` |
| 12 | GET | `api/images/v2/daily/` | Home feed sections | `user_device_time`, `user_id?` | → `HomeUdfResponse` (204 → empty) |
| 13 | POST | `api/weather/v2/weather_forecast_lite/` | Weather chip | — | `{user_id}` → `WeatherResponse(current_temp, precipitation_probability, weather_icon)` |
| 14 | POST | `api/user/update_crop_details/` | Save crops | — | `SetCultivatedCropsRequest(user_id, crop_details[])` → `CropResponse(message)` |
| 15 | POST | `api/chat/new_conversation/` | New conversation | — | `NewConversationRequest(user_id, content_provider_id?)` → `NewConversationResponse(conversation_id, message, show_popup)` |
| 16 | POST | `api/chat/transcribe_audio/` | Server STT | — | `SetVoiceRequest` → `GetVoiceResponse(heard_input_query, confidence_score, transcription_id, …)` |
| 17 | POST | `api/user/generate_otp/` | Send OTP | — | `SendOtpRequest(phone, phone_country_code, channel[], device_id, user_id)` → `SendOtpResponse` |
| 18 | POST | `api/user/check_device_user_limit/` | Device limit | — | `CheckDeviceRequest` → `SendOtpResponse` |
| 19 | POST | `api/user/verify_otp_less_android_sdk_token/` | WhatsApp OTP-less | — | `WhatsappVerificationRequest(phone_country_code, phone, token)` → `VerifyOtpResponse` |
| 20 | GET | `api/geography/communication_channel/` | OTP channels for country | `phone_country_code` | → `[{sms_enabled, whatsapp_enabled}]` |
| 21 | POST | `api/user/verify_otp/` | Verify OTP (login) | — | `VerifyOtpRequest(otp, phone, phone_country_code, guest_onboarding, user_id)` → `VerifyOtpResponse(access_token, refresh_token, existing_user, preferred_language{asr/tts config}, …)` |
| 22 | GET | `api/chat/conversation_list/` | Chat history list | `user_id`, `page` | → `ConversationListResponse` (custom deserializer: bare-array or paginated object) |
| 23 | POST | `api/user/logout/` | Logout | — | → `LogoutResponse(message?)` |
| 24 | GET | `api/faqs` | Help/FAQ | `lang`, `limit=5`, `theme?`, `country?` | → `HelpSupportResponse{data{faqs[], legal, mode}}` |
| 25 | PATCH | `api/images/v2/viewed/` | Mark card viewed | — | `ImageViewedRequest(statement_id, user_id, status="viewed")` → resp |
| 26 | POST | `api/images/v2/statement/` | Card pre-gen answer | — | `ImageStatementRequest(statement_id, triggered_input_type)` → `ImageStatementResponse(short_answer, follow_up_questions, message_id, conversation_id)` |
| 27 | POST | `api/chat/get_answer_for_text_query/` | **Main AI answer** | — | `TextPromptRequest` → `TextPromptResponse` |
| 28 | POST | `api/chat/image_analysis/` | Image AI ("Plantix") | — | `PlantixRequest(conversation_id, image(base64), query?, lat/lng, image_name)` → `PlantixResponse` |
| 29 | GET | `api/chat/follow_up_questions/` | Follow-ups (post-answer) | `message_id`, `use_latest_prompt=true` | → `FollowUpQuestionsResponse(questions[], clarification_required)` |
| 30 | POST | `api/chat/follow_up_question_click/` | Track follow-up click | — | `{follow_up_question}` → `{message?}` |
| 31 | POST | `api/chat/synthesise_audio/` | Server TTS | — | `SynthesiseAudioRequest(message_id, text, user_id)` → `SynthesiseAudioResponse(audio:url)` |
| 32 | GET | `api/chat/conversation_chat_history/` | Thread history | `conversation_id`, `page` | → `ConversationChatHistoryResponse` |
| 33 | POST | `api/chat/add_query_to_history/` | MoEngage qapair insert | — | `followUpQuestionsRequestMoengage` → resp |
| 34 | GET | `api/images/v2/user_question_count/` | Question count | — | → `UserQuestionCountResponse(total_questions_asked, bypass_interstitial)` |

## Token endpoints (`AuthApi`, non-suspend, called from authenticator)
- POST `api/user/get_new_access_token/` — `RefreshTokenRequest(refresh_token)` → `RefreshTokenResponse(access_token, refresh_token)`
- POST `api/user/send_tokens/` — Header `API-Key`; `SendNewTokenRequest(device_id, user_id)` → `RefreshTokenResponse` (guest-token fallback)

## Key request/response models

- **TextPromptRequest**: `query, conversation_id, message_id, statement_id?, weather_cta_triggered=false, triggered_input_type, ssfr_crop?, use_entity_extraction=true, transcription_id?, retry=false`.
- **TextPromptResponse**: `error, message?, message_id?, query?, response?, resource_url?, translated_response?, follow_up_questions?(always null — fetched via #29), section_message_id?, actual_content_provider?, content_provider_logo?, hide_feedback_icons?, hide_follow_up_question?, hide_share_icon?, hide_tts_speaker?, hide_source?, points?, intent_classification_output{clarification_needed, concern, confidence, intent, rephrased_query, …}`.
- **ConversationChatHistoryMessageItem**: `message_type_id` (1=query_text, 2=query_audio, 3=response_text, 7=follow_up_questions, 11=input_image), `message_type, message_id, message_input_time?, section_message_id?, query_text?, heard_query_text?, response_text?, questions[]?, query_media_file_url?, reaction?, response_media_file_url?, resource_id?, resource_url?, actual_content_provider?, content_provider_logo?, hide_source?, hide_tts_speaker?, clarification_required?`.
- **InitializeGuestUserRequest**: `device_id, lat?, long?, accuracy?, utm_source?, utm_medium?, utm_campaign?, moengage_id?, google_advertise_id?`. **Response**: `access_token, refresh_token, user_id?, show_crops_livestocks, country_code?, country?, state?, dashboard?, created_now?, ip_location_fallback_time_limit, …`.
- **VerifyOtpResponse.preferred_language** (`PreferredLanguage`): `asr_bcp_code, asr_enabled, tts_bcp_code, tts_enabled, tts_voice_name, code, display_name, id, primary_speaking_countries, …`.
- **SupportedLanguageGroup**: `display_name, flag, priority_view[], expanded_view[]`; `SupportedLanguage(id, name, code, bcpCode, latnCode, display_name, flag?, ttsVoiceName, asr_enabled, tts_enabled, country_phone_code)`.
- **HomeUdfResponse**: `greeting?, sections:[SectionDto], ssfr_enable?`. `SectionDto(type?, id, image_url?, title?, question_text?, statement_id, badge{icon,count,show}?, cta{text,action}?, statement?, selection_type?, options[{id,text}]?, statement_type?, is_viewed?, meta{…}?, unique_key?/label?)`.
- **FarmerProfile**: `userProfile{address, age, country, crop_details, farmland_details, first/last_name, gender, geography_level2..6, id, land_holding, lat/long, live_stock_details, llm_model, memory, preferred_language, phone, phone_country_code, profile_picture, receive_com_via_whatsapp, role, show_feedback_prompt, specialization, user_id}, roleAssigned?`.
- **SetVoiceRequest**: `conversation_id, query(base64 audio), message_reference_id, input_audio_encoding_format, triggered_input_type, editable_transcription="True"`. **GetVoiceResponse**: `heard_input_query?, confidence_score?, error, message_id, transcription_id?, …`. Accept transcription only if `!error && confidence > 0.7 && text not blank`.
- **UpdateLocationRequest**: `lat?, long?, user_id, country?, level_2..6?, display_address?, osm_response?(OSM/Nominatim shape)`.
- **CountryItem**: `code, display_name, flag, id, name, phone_country_code, phone_length, phone_number_pattern?`.
- **UserNameRequest**: `age, farmer_reach_count, gender, land_holding, live_stock_details, name, profile_picture, receive_com_via_whatsapp, role, specialization, user_id`.

## Networking behavior (must be reproduced by every SDK core)

### Interceptor chain (main client)
1. `FirebasePerformanceInterceptor` (app-only; SDK: optional perf hook)
2. `PriorityRequestIdInterceptor` — adds `X-Request-ID`, stores priority
3. `ApiPriorityHeaderInterceptor` — adds `X-Timeout` = priority.timeoutSeconds
4. `TimeoutTypeInterceptor` — per-request client clone with connect/read/write = X-Timeout (default 30 s)
5. `AuthHeaderInterceptor` — always `Build-Version: v2` + `Device-Info: <url-encoded JSON device config>`; `Authorization: Bearer <access>` when present
6. Logging (debug only)
7. `.authenticator(TokenAuthenticator)`

### ApiPriority
| Priority | Timeout | Retries | Used by |
|---|---|---|---|
| P1 onboarding-fallback | 5 s | 1 | geolocate |
| P2 no-fallback (default) | 10 s | 2 | most endpoints |
| P3 AI runtime | 30 s | 3 | text prompt, plantix, follow-ups, synthesise, transcribe, chat history |

### executeApiCall retry semantics
- 401 → never retried (authenticator's job); returns error.
- Retryable HTTP: 408, 500, 502, 503, 504, 404. Never: 400, 429.
- Exceptions: retry only `IOException`; `SocketTimeoutException` flagged `isTimeout`.
- Exponential backoff: `min(500 * 2^attempt, 3000)` ms.
- Result types: `ApiResult.Success(data)` / `ApiResult.Error(code?, message?, apiName, errorBody?, throwable?, isTimeout)`. UI layer: `UiState { Idle, Loading, Success(data), Error(message, code?, isNetworkError) }`.
- `ErrorHandler.fromHttp` maps 400/401/403/404/408/429/5xx to localized labels, preferring backend message from JSON keys `message, otp, error, detail, msg, error_message, description, non_field_errors`.

### TokenAuthenticator (401 refresh)
- Skip URLs containing: `generate_otp`, `verify_otp`, `get_new_access_token`, `send_tokens`, `initialize_user`.
- Loop guard: ≥2 prior responses → give up.
- Step 1: refresh via `get_new_access_token`; save tokens; retry with new Bearer.
- Step 2 fallback: `send_tokens(device_id, user_id)` with guest API key; save; retry.
- Never run on main thread.

## Session & persistence
- TokenStore keys: access `farmer_chat_app_access_token`, refresh `farmer_chat_app_refresh_token`, userId `logged_user_id_key`, deviceId `your_android_device_id`. `clear()` removes only tokens.
- Pref key groups: auth/session (`OTP_VERIFIED`, `PHONE_NUMBER_LOGIN`, `FIRST_LOGIN_DONE`…), onboarding steps (`LANGUAGE_DONE`, `KEY_NAME_DONE`, `USER_NAME_ADDED`, `BUILD_VERSION_API_CALLED`…), language (`SELECTED_LANGUAGE_ID/CODE/DISPLAY_NAME`, labels JSON + `LANGUAGE_LABELS_LOADED`), crops, location (`FARMER_APP_LATITUDE/LONGITUDE`, `USER_COUNTRY_CODE/NAME`…), chat (`NEW_CONVERSATION_ID`, `FIRST_QUERY_ASKED`, `CACHED_HOME_FEED_RESPONSE`), permissions deny/attempt counts, UI (`APPEARANCE_MODE`, `FONT_SIZE`), UTM.
- Logout: `api/user/logout/` + clear all prefs (preserve appearance) + reset analytics identity.

## Server-driven labels (i18n)
`LabelManager.getLabel(baseKey, englishFallback, params?)`: labels from endpoint #3 stored as JSON map; resolves `${baseKey}_${langCode}` → `${baseKey}_en` → fallback → raw key; `{name}`/`{{name}}` template substitution. All SDK UI strings must go through this.

## Voice pipeline (all server-side AI)
- Record: OGG/OPUS 48 kHz (AAC fallback on old devices) → base64 → `transcribe_audio` → text → `get_answer_for_text_query`.
- Listen (TTS): `synthesise_audio` → audio URL → platform media player.

## Analytics (app-level SDKs: MoEngage, Firebase, Plotline, Adjust)
`AnalyticsManager.track(AnalyticsEvent(name, props, adjustToken?))` fans out to all four in `runCatching`. Screen view/exit skips MoEngage. ~90+ event constants (App_Opened, Screen_Viewed/Exited, Send_OTP_Click_Event, Submit_OTP, Registration_Completed, Login_Completed, Dashboard_Viewed, Card_Shown/Viewed/Clicked, Send_Query, Send_Query_Initiated, FirstQueryAsked, Transcription_Success/Failed, Started/Stopped_Playing_Response_Audio, Logout_Click_Event, GPS events, …).
**SDK design decision:** third-party analytics SDKs stay out of the embeddable SDKs; all events are emitted through a host-pluggable `FarmerChatAnalyticsListener` with identical event names/props so hosts can forward to their own stacks.

## Known app quirks (documented for fidelity decisions)
- `PRIORITY_1` timeout is 5 s in code (doc comment says 2 s) — SDKs use 5 s.
- `getChatHistory` comment says P2 but code uses P3 — SDKs use P3.
- Plantix priority URL-map mismatch (`api/chat/get_plantix/` vs real `api/chat/image_analysis/`) — SDKs map priority correctly to `image_analysis`.
- Dead constants (`auth/login`, `chat/send`, …) not carried over.
- `TextPromptResponse.follow_up_questions` is always null; real follow-ups come from endpoint #29.
