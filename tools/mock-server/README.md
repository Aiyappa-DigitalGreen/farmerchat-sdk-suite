# FarmerChat mock backend

A dependency-free local backend for **end-to-end verification** of the FarmerChat
SDK suite (Android, iOS, React Native, Web). It implements every endpoint in
[`docs/02-api-reference.md`](../../docs/02-api-reference.md) with deterministic
happy-path JSON whose field names/shapes match the wire models exactly, so the
real SDK decoders parse it unchanged.

Pure Node standard library (`http`, `url`) — **no npm install, no dependencies**.

## Run

```bash
cd tools/mock-server
node server.js
```

Listens on `http://0.0.0.0:8899`. Every request is logged to stdout as
`METHOD /path -> matched handler` so you can watch SDK traffic live.

Stop with Ctrl-C.

### Advertised asset base URL

`synthesise_audio`, the daily feed image, and chat-history media point at
`http://localhost:8899/static/...` by default. When driving the **Android
emulator**, start the server so it advertises the emulator loopback instead:

```bash
MOCK_PUBLIC_BASE=http://10.0.2.2:8899 node server.js
```

(JSON field shapes are identical either way; this only changes the absolute
media URLs the server hands back.)

## Reachable URLs — set as `customBaseUrl` on the SDK config

| Runtime | Base URL to use |
|---|---|
| Android emulator | `http://10.0.2.2:8899/` |
| iOS simulator / Web / Node | `http://localhost:8899/` |
| React Native on emulator (after `adb reverse tcp:8899 tcp:8899`) | `http://localhost:8899/` |

The base URL **must end with a trailing `/`** (Retrofit / URL-join requirement).

Wire it up per platform:

- **Android** — `FarmerChatConfig.builder(env).customBaseUrl("http://10.0.2.2:8899/")…`
- **iOS** — `FarmerChatConfig(environment: .dev, customBaseURL: "http://localhost:8899/")`
- **React Native** — `{ environment: 'dev', customBaseUrl: 'http://localhost:8899/' }`
- **Web** — `{ environment: 'dev', customBaseUrl: 'http://localhost:8899/' }`

`customBaseUrl` overrides the `environment` base URL when set.

### Cleartext HTTP (sample apps only)

The mock is plain HTTP. The **sample apps** already permit cleartext to the mock
(the SDK libraries do not, and must not):

- **Android samples** (`sample-compose`, `sample-views`, `sample-consumer`) ship
  `res/xml/network_security_config.xml` (cleartext to `10.0.2.2` / `localhost` /
  `127.0.0.1`), referenced from each `AndroidManifest.xml` via
  `android:networkSecurityConfig`.
- **iOS samples** (`SampleApp`, `ConsumerApp`) carry an ATS exception
  (`NSAppTransportSecurity` → `NSAllowsLocalNetworking` + `localhost`/`127.0.0.1`
  insecure-load exceptions) in their generated `Info.plist` (see each
  `project.yml`).

## Endpoints

All 34 main endpoints + the 2 token endpoints (`get_new_access_token`,
`send_tokens`) + a Google-geolocate stub. Notable happy-path behaviors:

- `POST api/user/initialize_user/` → tokens + `user_id`, `show_crops_livestocks:true`,
  `country_code:"IN"`, `country:"India"`, `state:"Karnataka"`.
- `GET api/language/v2/country_wise_supported_languages/` → India group,
  Kannada / English / Hindi in `priority_view`, more in `expanded_view`.
- `GET api/language/v2/get_labels/` → the full English label map (233 keys,
  lifted from the app's `Labels.kt`, served as `${key}_en`).
- `POST api/user/generate_otp/` → `{message:"OTP sent"}`;
  `GET api/geography/communication_channel/` → `[{sms_enabled:true, whatsapp_enabled:true}]`.
- `POST api/user/verify_otp/` → **accepts any 4-digit OTP** (non-4-digit → 400) →
  tokens + `existing_user:false` + `preferred_language` (asr/tts enabled).
- `GET api/images/v2/daily/` → 1 ContentCard w/ image + 1 single-select (gender) +
  1 multi-select (crops); `ssfr_enable:true`.
- `POST api/weather/v2/weather_forecast_lite/` → `{current_temp:"27", …}`.
- `POST api/chat/get_answer_for_text_query/` → **real markdown answer**
  (`error:false`, `response`, `message_id`, `section_message_id`) — never 500.
- `GET api/chat/follow_up_questions/` → 3 questions + `clarification_required:false`.
- `POST api/chat/transcribe_audio/` → `heard_input_query` + `confidence_score:0.93`
  + `transcription_id`.
- `POST api/chat/synthesise_audio/` → `{audio:"…/static/tts.wav"}` (a tiny valid
  WAV synthesized in-process and served at `/static/tts.wav`).
- `POST api/chat/image_analysis/` → markdown answer + 3 follow-ups.
- `GET api/chat/conversation_list/` → paginated threads with grouping headers
  (Today / Yesterday / This week).
- `GET api/chat/conversation_chat_history/` → a thread with query / response /
  audio / image / follow-up message types (`message_type_id` 1/3/2/11/7).

Plus `/health` (JSON status) and static `/static/tts.wav`, `/static/card.png`,
`/static/{faq,legal}.html`.

## Curl smoke test (chat answer)

```bash
curl -s -X POST http://localhost:8899/api/chat/get_answer_for_text_query/ \
  -H 'Content-Type: application/json' \
  -d '{"query":"How do I protect my maize from armyworm","conversation_id":"c1","message_id":"m1","triggered_input_type":"text"}'
```

Returns (abridged):

```json
{
  "error": false,
  "message_id": "…",
  "query": "How do I protect my maize from armyworm",
  "response": "**Protecting your crop: How do I protect my maize from armyworm**\n\nHere is practical, step-by-step guidance:\n\n1. **Scout your field early.** …",
  "section_message_id": "…",
  "actual_content_provider": "FarmerChat Knowledge Base",
  "points": 10,
  "intent_classification_output": { "intent": "pest_management", "confidence": "0.95", "clarification_needed": { "asset": false, "concern": false } }
}
```

More one-liners:

```bash
# guest init
curl -s -X POST http://localhost:8899/api/user/initialize_user/ -H 'API-Key: x' -d '{"device_id":"dev1"}'
# verify any 4-digit OTP
curl -s -X POST http://localhost:8899/api/user/verify_otp/ -d '{"otp":"1234","phone":"9","phone_country_code":"+91","guest_onboarding":"true","user_id":"u1"}'
# daily feed
curl -s "http://localhost:8899/api/images/v2/daily/?user_device_time=x&user_id=u1"
# thread history
curl -s "http://localhost:8899/api/chat/conversation_chat_history/?conversation_id=conv-001&page=1"
```
