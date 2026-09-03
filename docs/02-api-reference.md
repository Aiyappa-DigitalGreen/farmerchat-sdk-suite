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

**Endpoint #2 param semantics (verified live 2026-09-01 on all five envs):**
- `country_code` is **required and must be non-blank**. `?country_code=` → HTTP **400** `{"error": "Country code is required"}`; `?country_code=null` → HTTP 400 `{"error": "Country 'NULL' not found"}`. 400 is non-retryable per the retry table, so a blank value fails the screen silently.
- `state` is a **ranking hint matched on the state display name, not the ISO code**, and never filters the set. For `country_code=IN` all of `KA`, `Karnataka`, `MH`, `Maharashtra`, `""` and `ZZZZ` return the same five languages — but the priority/expanded split differs: `state=Karnataka` → `priority_view=[Kannada, English (India), Hindi]`, whereas `state=KA` (a code) → `priority_view=[Hindi, English (India)]` with Kannada demoted to `expanded_view`. Pass the state **name** as returned by `initialize_user.state`, never a code.

  > **Re-probed live 2026-09-03 — the deployment data changed.** dev, stage, prod and eks now all
  > return **Kenya only** (one group, `English (Kenya)`), for every `country_code` including `IN`,
  > and `state` is completely inert: `Karnataka`, `KA`, `state=` and the parameter omitted return
  > byte-identical responses. The 2026-09-01 observation above was accurate against the data that
  > was deployed then; the `state`-name-not-code rule still describes the CONTRACT, but there is
  > currently no multi-state data to exercise it. Do not "simplify" the rule away on the strength
  > of today's single-country data — and do not hardcode an Indian default on the strength of the
  > older observation either (an earlier SDK build did exactly that; see `docs/04`).
  - *Naming caveat*: the Android preference key is `USER_SELECTED_STATE_CODE` but it stores `initialize_user.state`, i.e. a name (iOS/web use `USER_STATE`). The key name is misleading; the stored shape is correct. Not renamed — it is a persisted key and would need a migration.
| 3 | GET | `api/language/v2/get_labels/` | Server-driven UI labels | `language`(Int) | → `Map<String,String>` |
| 4 | GET | `api/user/privacy_policy/` | Legal links | — | → `PrivacyPolicyResponse` |
| 5 | GET | `api/geography/get_all_countries/` | Country list | — | → `List<CountryItem>` |
| 6 | POST | `api/user/set_preferred_language/` | Save language | — | `SetPreferredLanguageRequest(user_id, language_id)` → `{user_id}` |
| 7 | POST | `api/user/accept_terms/` | Accept T&C | — | `AcceptPPandTCRequest(user_id)` → `AcceptPPandTCResponse` |
| 7a | GET | `api/user/policy_acceptance_status/` | **Terms-of-Use acceptance gate (2.0.0)** | `user_id` (**required**) | → `PolicyAcceptanceStatusResponse` |

**Endpoint #7a — mandatory Terms-of-Use acceptance gate (2.0.0 only, verified live 2026-09-03 on stage):**

Introduced by app v4.1.2 (`fc-compose-agentic`): `ApiConstants.POLICY_ACCEPTANCE_STATUS`,
`ApiServices.fetchPolicyAcceptanceStatus(@Query("user_id"))`, called from
`HomeViewModel.fetchPolicyAcceptanceStatus` on **every Home entry**. When
`requires_acceptance == true` the app overlays Home with a **non-cancellable**
`TermsOfUseUpdatedBottomSheet` until the user accepts via #7.

- `user_id` is **required**. Omitting it → HTTP **400** `{"error":"user_id is required"}`. 400 is
  non-retryable per the retry table, so a blank/`"null"` value fails the gate silently — hence the
  app's guard (`userId.isBlank() || userId.equals("null", true)` → skip the call entirely).
- Priority: **P2** (`PRIORITY_2_NO_FALLBACK`), `apiName = "policy_acceptance_status"`.
- Live response for a **guest** token (`initialize_user` only, no OTP) on stage:

  ```json
  { "requires_acceptance": true, "terms_accepted": false, "terms_accepted_at": null,
    "latest_policy_version": { "id": 2, "policy_type": "combined", "version_label": "v2",
      "published_at": "2026-09-02T14:09:15.601280Z",
      "terms_of_service_url": "https://farmerchat.farmstack.co/v2/farmer_chat_tos_stage/",
      "privacy_policy_url": "https://farmerchat.farmstack.co/farmer_chat_pp/" } }
  ```

  So the gate **does fire for guests** — `initialize_user` persists a `user_id`, the app's guard
  only skips a *missing* one, and the backend answers `requires_acceptance: true` for it. This is
  app behaviour, not an SDK divergence.
- The terms URL the gate's content screen loads is
  `latest_policy_version.terms_of_service_url` — **not** `privacy_policy.farmerchat_terms_of_use`
  (#4). #4 feeds the *other*, dismissible terms dialog; the two are independent.
- **Its seven label keys are all served by #3** (verified live 2026-09-03, stage, `language=1/2/3`):
  `fc_v2_app_terms_of_use_changed`, `_description`, `_read_terms`, `_accept`, `_accept_terms`,
  `_accepted`, `_accepting_one_second` — present in **en, hi and sw**. Note they lack the
  `_label_` infix the rest of the app's `Labels` keys use; that is how the app declares them, so
  they are copied character-for-character. Because the gate is mandatory and non-dismissible,
  a missing key here would mean hardcoded English on a screen a farmer cannot leave — hence the
  check.
| 8 | POST | `api/user/update_user_profile/` | Update name/profile | — | `UserNameRequest` → `UserNameResponse` |
| 9 | GET | `api/user/view_user_profile/` | Fetch profile | `id` | → `FarmerProfile` |
| 10 | PATCH | `api/user/v2/update_build_version/` | Report build version | — | `UpdateBuildVersionRequest(user_id)` → resp |
| 11 | POST | `api/user/update_user_location/` | Save GPS location | — | `UpdateLocationRequest` → `GetLocationResponse` |
| 12 | GET | `api/images/v2/daily/` | Home feed sections | `user_device_time`, `user_id?` | → `HomeUdfResponse` (204 → empty) |

**Endpoint #12 behaviour (verified live 2026-09-01, prod):**
- The response **omits the `greeting` key entirely** when the feed is empty. UI that keys a loading skeleton off `greeting == null` will shimmer forever on a loaded-but-empty feed.
- The feed is **gated on the user having a resolved location**. A guest with `country_code: null` gets HTTP **200** with `{"sections": [], "ssfr_enable": false}` and **no `greeting` key** — an empty feed, not an error. Once location resolves, the same call returns 21 sections plus `greeting`.
- Location resolves via **either** path: passing `lat`/`long` to `initialize_user` (#1), **or** a later `update_user_location` (#11). The backend reverse-geocodes from coordinates alone — `{lat, long, user_id}` with no `country`/`level_2` is sufficient and returns a fully populated `user_profile`.
- `user_device_time` is `HH:mm` (app: `SimpleDateFormat("HH:mm")`). Verified non-load-bearing: `HH:mm`, a full datetime, and any value all return the same feed. It does not gate content.
- **`section.type` values seen in prod**: `image` (3), `plotline_widget` (14), `statement` (2), `question` (2). `plotline_widget` sections contain **only** `type`, `unique_key`, `label` — no `title`, `question_text`, `image_url` or `statement_id`. The app renders them via `PlotlineComposeWidget` (`ui/home/HomeScreen.kt:1091`) and excludes them from card analytics (`:792`). Root CLAUDE.md §6 forbids Plotline in SDK packages, so **the SDK must filter these out** — a catch-all render branch turns them into blank cards.
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
| 27a | POST | `api/chat/get_answer_for_text_query_agentic/` | **Agentic AI answer (2.0.0)** | — | `TextPromptRequest` → **SSE stream** of `AgenticEvent` |
| 28 | POST | `api/chat/image_analysis/` | Image AI ("Plantix") | — | `PlantixRequest(conversation_id, image(base64), query?, lat/lng, image_name)` → `PlantixResponse` |
| 29 | GET | `api/chat/follow_up_questions/` | Follow-ups (post-answer) | `message_id`, `use_latest_prompt=true` | → `FollowUpQuestionsResponse(questions[], clarification_required)` |
| 30 | POST | `api/chat/follow_up_question_click/` | Track follow-up click | — | `{follow_up_question}` → `{message?}` |
| 31 | POST | `api/chat/synthesise_audio/` | Server TTS | — | `SynthesiseAudioRequest(message_id, text, user_id)` → `SynthesiseAudioResponse(audio:url)` |
| 32 | GET | `api/chat/conversation_chat_history/` | Thread history | `conversation_id`, `page` | → `ConversationChatHistoryResponse` |

**Endpoint #32 behaviour (verified live 2026-09-01, prod):**
- **A query and its response SHARE one `message_id`.** One turn returns three items — `message_type_id` 1 (query_text), 3 (response_text) and 7 (follow_up_questions) — all with the *same* `message_id`. `message_id` is therefore a **turn id, not a message id**: it is NOT unique per rendered bubble and must never be used alone as a list key. Compose throws `IllegalArgumentException: Key "…" was already used`; React corrupts list identity silently. Key on `message_id + message_type_id + page + index` (app: `fc-compose ChatViewModel.kt:1027`).
- Out-of-range pages return HTTP **200** with `{"data": []}` (verified pages 2, 3 and 99 on a one-turn conversation), so `items.isNotEmpty() → page + 1` terminates correctly. The response carries no pagination metadata.
| 33 | POST | `api/chat/add_query_to_history/` | MoEngage qapair insert | — | `followUpQuestionsRequestMoengage` → resp |
| 34 | GET | `api/images/v2/user_question_count/` | Question count | — | → `UserQuestionCountResponse(total_questions_asked, bypass_interstitial)` |

### Endpoint #27a — agentic streaming (2.0.0 only)

Introduced by app v4.1.2 (`fc-compose-agentic`). Same `TextPromptRequest` body as #27; the reply
is a stream, not a document. **Endpoint #27 is unchanged and remains the 1.0.0 path.**

**Verified live 2026-09-02** on dev, stage and prod:

```
POST api/chat/get_answer_for_text_query_agentic/
  Accept: application/json          <- NOT text/event-stream (the backend 406s that)
→ HTTP 200
  Content-Type: text/event-stream
  Transfer-Encoding: chunked
```

- **No read timeout.** Agentic answers stream for a long time, so this call must not use the
  ApiPriority timeout client — it needs a dedicated client that still carries the auth
  interceptors so 401 refresh applies.
- **Event contract** (`AgenticEvent`): `ToolCall`, `ToolResult`, `TextDelta`, `Metadata`, `Done`,
  `Failure`. The answer accretes from `TextDelta`; `Metadata` carries the ids needed for TTS (#31)
  and follow-ups (#29); `Failure` is a mid-stream error.

⚠ **Wire framing UNVERIFIED.** A guest with language, location and a conversation received
**0 bytes** on all three environments — the stream opens and delivers nothing. Agentic answers
likely require a signed-up user or a server-side flag. Until a real stream is captured, implement
the app's conservative reader: accept both `data:`-prefixed SSE lines (blank line ends an event)
and bare NDJSON, taking the event type from an SSE `event:` line when present, else a `type` field
in the JSON. Tracked in docs/05.

## Token endpoints (`AuthApi`, non-suspend, called from authenticator)
- POST `api/user/get_new_access_token/` — `RefreshTokenRequest(refresh_token)` → `RefreshTokenResponse(access_token, refresh_token)`
- POST `api/user/send_tokens/` — Header `API-Key`; `SendNewTokenRequest(device_id, user_id)` → `RefreshTokenResponse` (guest-token fallback)

## Key request/response models

- **TextPromptRequest**: `query, conversation_id, message_id, statement_id?, weather_cta_triggered=false, triggered_input_type, ssfr_crop?, use_entity_extraction=true, transcription_id?, retry=false`.
- **TextPromptResponse**: `error, message?, message_id?, query?, response?, resource_url?, translated_response?, follow_up_questions?(always null — fetched via #29), section_message_id?, actual_content_provider?, content_provider_logo?, hide_feedback_icons?, hide_follow_up_question?, hide_share_icon?, hide_tts_speaker?, hide_source?, points?, intent_classification_output{clarification_needed, concern, confidence, intent, rephrased_query, …}`.
  - **2.0.0 adds `alignments?`** — a server-driven surface the user answers by tapping a chip, instead of (or before) a normal answer. `Alignment{type, message, chips[], original_query, blocking?, intent?}`, `AlignmentChip{label, value, action?}`. When an **exclusive** surface is sent, `response` is deliberately **empty** and `alignments.message` carries the prompt: a client that only reads `response` will mistake it for an empty answer and show an error. `type` is one of `alignment-clarify`, `alignment-confirm`, `alignment-escalate`, `gps-prompt`, `upload-photo`, `gender-select`, `commodity-confirm`; `gender-select` and `commodity-confirm` are **additive** (they accompany a real answer), the rest **exclusive** (they replace it). An unrecognised `type` must degrade to a normal answer.
- **ConversationChatHistoryMessageItem**: `message_type_id` (1=query_text, 2=query_audio, 3=response_text, 7=follow_up_questions, 11=input_image), `message_type, message_id, message_input_time?, section_message_id?, query_text?, heard_query_text?, response_text?, questions[]?, query_media_file_url?, reaction?, response_media_file_url?, resource_id?, resource_url?, actual_content_provider?, content_provider_logo?, hide_source?, hide_tts_speaker?, clarification_required?`.
- **InitializeGuestUserRequest**: `device_id, lat?, long?, accuracy?, utm_source?, utm_medium?, utm_campaign?, moengage_id?, google_advertise_id?`. **Response**: `access_token, refresh_token, user_id?, show_crops_livestocks, country_code?, country?, state?, dashboard?, created_now?, ip_location_fallback_time_limit, …`.
  - **Verified live 2026-09-01 (prod)**: `show_crops_livestocks` is returned as the *string* `"True"`/`"False"`, not a JSON boolean. Gson coerces it on Android and iOS uses `@FlexibleBool`; TS wire types are declared `boolean | string | null`.
  - **Verified live 2026-09-01 (prod)**: a fresh guest gets `country_code: null` / `state: null` when the backend cannot resolve the IP. Endpoint #2 rejects a blank `country_code` with **HTTP 400** `{"error": "Country code is required"}` (and `country_code=null` with `Country 'NULL' not found`), so callers MUST substitute a non-blank fallback. **Re-confirmed live 2026-09-03 on prod** (a fresh guest still returns `country_code: null`).

  The SDK derives that fallback the way the app does — from the **device locale's country** via `CountryLatLngProvider` — and only falls back to a literal (`FarmerChatConfig.LAST_RESORT_COUNTRY_CODE`, `"KE"`, matching the app's primary guest-init path) when the locale carries no region. `defaultCountryCode`/`defaultStateCode`/`defaultLatitude`/`defaultLongitude` are OPTIONAL host overrides that default to "unset = derive"; they are not hardcoded values.
- **VerifyOtpResponse.preferred_language** (`PreferredLanguage`): `asr_bcp_code, asr_enabled, tts_bcp_code, tts_enabled, tts_voice_name, code, display_name, id, primary_speaking_countries, …`.
- **SupportedLanguageGroup**: `display_name, flag, priority_view[], expanded_view[]`; `SupportedLanguage(id, name, code, bcpCode, latnCode, display_name, flag?, ttsVoiceName, asr_enabled, tts_enabled, country_phone_code)`.
- **HomeUdfResponse**: `greeting?, sections:[SectionDto], ssfr_enable?`. `SectionDto(type?, id, image_url?, title?, question_text?, statement_id, badge{icon,count,show}?, cta{text,action}?, statement?, selection_type?, options[{id,text}]?, statement_type?, is_viewed?, meta{…}?, unique_key?/label?)`.
- **FarmerProfile**: `userProfile{address, age, country, crop_details, farmland_details, first/last_name, gender, geography_level2..6, id, land_holding, lat/long, live_stock_details, llm_model, memory, preferred_language, phone, phone_country_code, profile_picture, receive_com_via_whatsapp, role, show_feedback_prompt, specialization, user_id}, roleAssigned?`.
- **SetVoiceRequest**: `conversation_id, query(base64 audio), message_reference_id, input_audio_encoding_format, triggered_input_type, editable_transcription="True"`. **GetVoiceResponse**: `heard_input_query?, confidence_score?, error, message_id, transcription_id?, …`. Accept transcription only if `!error && confidence > 0.7 && text not blank`.
- **UpdateLocationRequest**: `lat?, long?, user_id, country?, level_2..6?, display_address?, osm_response?(OSM/Nominatim shape)`.
- **CountryItem**: `code, display_name, flag, id, name, phone_country_code, phone_length, phone_number_pattern?`.
- **UserNameRequest**: `age, farmer_reach_count, gender, land_holding, live_stock_details, name, profile_picture, receive_com_via_whatsapp, role, specialization, user_id`.
- **PolicyAcceptanceStatusResponse** (#7a, 2.0.0): `requires_acceptance: Boolean, terms_accepted: Boolean, terms_accepted_at: String?, latest_policy_version: LatestPolicyVersion?`; `LatestPolicyVersion(id: Int, policy_type: String, version_label: String, published_at: String, terms_of_service_url: String, privacy_policy_url: String)`. Field names verified against the live stage response 2026-09-03 and against the app's `domain/model/policy/PolicyAcceptanceStatusResponse.kt` — identical. `requires_acceptance == true` is the only signal that raises the gate; `terms_accepted` / `terms_accepted_at` are informational and unread by the app's UI.

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

## #27a agentic stream — REAL WIRE CONTRACT, captured live 2026-09-03

**This supersedes every "not verified" note about the agentic framing.** The stream was captured
from stage with a guest token; both captures are checked in under `docs/captures/`:

- `agentic_stream_prose_20260903.sse` — a prose answer (13,273 bytes)
- `agentic_stream_gps_surface_20260903.sse` — a `gps-prompt` alignment surface (4,620 bytes)

### How to reproduce

```bash
# 1. guest WITH coordinates (an unplaceable guest is what produced the earlier 0-byte responses)
curl -s -X POST "$BASE/api/user/initialize_user/" -H "API-Key: $KEY" -H "Build-Version: v2" \
  -H "Content-Type: application/json" \
  -d '{"device_id":"probe","lat":"-0.023559","long":"37.906193"}'
# 2. a real conversation — a BLANK conversation_id returns HTTP 400, not an empty stream
curl -s -X POST "$BASE/api/chat/new_conversation/" -H "Authorization: Bearer $TOK" \
  -H "Build-Version: v2" -H "Content-Type: application/json" \
  -d '{"user_id":"'$USERID'","content_provider_id":null}'
# 3. the stream
curl -s -N -X POST "$BASE/api/chat/get_answer_for_text_query_agentic/" \
  -H "Authorization: Bearer $TOK" -H "Build-Version: v2" \
  -H "Content-Type: application/json" -H "Accept: application/json" -d "$BODY"
```

`Accept: text/event-stream` returns **HTTP 406** (re-confirmed 2026-09-03). Send
`Accept: application/json`, which is what every SDK platform already does.

### Framing

Real SSE: `event: <name>` then `data: <json>`, blank-line separated. **Seven** event names, not the
six the SDK contract assumed:

| `event:` | payload keys | notes |
|---|---|---|
| `status` | `stage` (e.g. `"thinking"`) | progress ping. **Not in the SDK's contract** — currently ignored |
| `tool_call` | `name`, `arguments`, `status_text` | `status_text` e.g. `"Loading your farms"` |
| `tool_result` | `name`, `result`, `status_text`, `latency_ms` | `result.content[]` is MCP-style `{type,text}` |
| `text_delta` | **`delta`** | the incremental prose. 9 deltas in the captured answer |
| `surface` | `id`, `type`, `payload` | an alignment surface delivered MID-STREAM. **Not in the SDK's contract** |
| `done` | `answer`, `alignment`, `surface`, `followups`, `clarifications`, `trace`, `metrics`, `resolution_type`, `query_id`, `trace_id`, `error` | NOT terminal |
| `metadata` | a full `TextPromptResponse` incl. `alignments` | **arrives LAST and is the terminal event** |

Two SDK design decisions are hereby **confirmed correct against the real wire**: `text_delta`'s key
really is `delta` (the SDK's primary alias), and treating `done` as non-terminal while finalizing
from `metadata` matches the observed order exactly.

`status` and `surface` were unhandled when this contract was first written — not misparsed, but
falling into the reader's typeless fallback, carrying no `response`/`follow_up_questions`, mapping
to null and being silently dropped. Consequences were: the `status` progress ping unused, and an
alignment surface picked up only from `metadata.alignments` (which does carry it) rather than as
soon as `surface` arrives.

> **Handled on `versions/v2/android` as of 2026-09-03** (`AgenticEvent.Status` /
> `AgenticEvent.Surface`); still unhandled on ios / react-native / web — see
> `docs/04-parity-matrix.md` §"#27a real wire contract".

### Alignment chips are RICHER than the SDK models

A real `gps-prompt` chip:

```json
{"label": "Give permission", "label_key": "gps.button", "label_en": "Give permission",
 "value": "share_precise_location", "behavior": "invoke_capability", "capability": "location",
 "request": "gps", "action": "invoke",
 "submit": {"kind": "action", "surface_type": "gps-prompt", "action": "grant", "data": {},
            "requires": "location"}}
```

Confirmed correct in the SDK: `action` is **`"invoke"`** and the share value is
**`"share_precise_location"`**.

NOT modelled by the SDK's `AlignmentChip` (which has only `label`/`value`/`action`): `label_key`,
`label_en`, `behavior`, `capability`, `request`, and the whole `submit` object.

**And the decline value differs from the app's constant.** The live `gps-prompt` decline chip is
`value: "use_approximate_location"` with `behavior: "continue"`, NOT the `not_now` that the app's
`AlignmentChip.VALUE_NOT_NOW` declares. `not_now` may belong to other surface types; treat
`VALUE_NOT_NOW` as unconfirmed for `gps-prompt` (docs/05).

The surface `payload` also carries `intent`, `interaction_kind`, `blocking`, `context`
(`required_precision`, `original_query`), `original_query` and `budget` (`asked`, `max`) — the
budget being how many times the backend may re-ask.

### Request fields the SDK does not send

`TextPromptRequest` in the app (`domain/model/chat/TextPromptRequest.kt`) has six fields the SDK's
copy lacks. All are in app source, so none is an invention:

| field | purpose |
|---|---|
| `parent_message_id` | correlates an alignment-chip answer to the surface that asked |
| `location_declined` | the farmer refused the GPS prompt |
| `photo_declined` | the farmer refused the photo prompt |
| `streaming_required` | **per-language**, from the language API's `streaming_required`, persisted by the app under `is_streaming_required` |
| `image_name`, `image` | inline image payload on the text-prompt path |

`streaming_required` was suspected of gating the stream. It does **not**: the endpoint returned a
full stream both with and without it (3,351 vs 4,620 bytes). It is still a fidelity gap, because the
language API returns it per language and the SDK never parses, persists or sends it.

