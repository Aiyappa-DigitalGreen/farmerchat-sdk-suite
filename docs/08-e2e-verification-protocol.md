# End-to-End Verification Protocol (the definition of "completed")

A feature is **DONE** on a platform only when BOTH are true and evidenced:
1. **UI**: the screen has been rendered on a device/emulator/simulator/browser and screenshot into `scratchpad/` (path recorded).
2. **Logic**: its primary action has been exercised at runtime and the result observed (against the local mock backend below).

`docs/04-parity-matrix.md` cells may be ✅ ONLY with that evidence. Everything else stays 🟡/⛔. No "compiles therefore done."

## Primary target = the live DEV instance (NOT prod, NOT mock-by-default)

All samples default to `environment = dev` and MUST stay there. Verification runs against the real dev backend (`https://farmerchat.farmstack.co/mobile-app-dev/`) for every path dev can serve — guest init, languages, labels, feed, weather, profile, history, conversation list, etc. (all confirmed working on dev in earlier runs).

The mock below is a **targeted fallback**, used ONLY for the paths the dev instance cannot currently serve deterministically, so their UI+logic can still be proven:
- `get_answer_for_text_query` / `image_analysis` — dev returns HTTP 500.
- `verify_otp` / `generate_otp` — no real phone/SMS in a headless run.
- `transcribe_audio` / `synthesise_audio` — need deterministic audio in/out.

Each screenshot/verification must record WHICH backend served it (dev vs mock), so the evidence is honest. Prefer dev; use mock only where noted.

## The local mock backend (fallback for the paths dev can't serve)

Built once at `tools/mock-server/` (Node, standard library only, no deps). Runs on `http://0.0.0.0:8899`. Implements every endpoint in `docs/02` with deterministic happy-path data. Key behaviors:

- `POST api/user/initialize_user/` → tokens + `user_id`, `show_crops_livestocks:true`, `country_code:"IN"`, `country:"India"`, `state:"Karnataka"`.
- `GET country_wise_supported_languages/` → Kannada / English (India) / Hindi priority + a few in expanded.
- `GET get_labels/` → the full English label map (same keys the app ships).
- `POST generate_otp/` → `{message:"OTP sent"}`; `GET communication_channel/` → `[{sms_enabled:true, whatsapp_enabled:true}]`.
- `POST verify_otp/` → **accepts any 4-digit OTP** → tokens + `existing_user:false` + `preferred_language` (asr/tts enabled).
- `GET images/v2/daily/` → 3 sections: one ContentCard w/ image, one single-select (gender), one multi-select (crops); `ssfr_enable:true`.
- `POST weather_forecast_lite/` → `{current_temp:"27", precipitation_probability:"20", weather_icon:"cloudy"}`.
- `POST new_conversation/` → `conversation_id`.
- `POST get_answer_for_text_query/` → **real markdown answer** (`error:false`, `response`, `message_id`, `section_message_id`) — NEVER 500.
- `GET follow_up_questions/` → 3 questions + `clarification_required:false`.
- `POST transcribe_audio/` → `heard_input_query:"How do I protect my maize from armyworm"`, `confidence_score:0.93`, `transcription_id`.
- `POST synthesise_audio/` → `audio:"http://0.0.0.0:8899/static/tts.mp3"` (serve a tiny valid mp3/wav).
- `POST image_analysis/` → answer like text query.
- `GET conversation_list/` → paginated sample threads w/ grouping headers.
- `GET conversation_chat_history/` → a thread with query+response+audio+image message types.
- `POST update_user_profile/`, `set_preferred_language/`, `accept_terms/`, `update_user_location/`, `update_crop_details/`, `viewed/`, `statement/`, `faqs`, `user_question_count/`, `get_new_access_token/`, `send_tokens/` → sensible OKs.

A `README` in that folder documents `node server.js` and the reachable URLs:
- Android emulator → `http://10.0.2.2:8899/`
- iOS simulator / web / Node → `http://localhost:8899/`
- RN on emulator via `adb reverse tcp:8899 tcp:8899` → `http://localhost:8899/`

## SDK change required: custom base URL

Add `customBaseUrl: String?` to `FarmerChatConfig` on all four platforms (overrides `environment` when set). This is also a legitimate shipped feature (point the SDK at your own backend). Samples set it to the mock URL for verification. Android/iOS samples must permit cleartext HTTP to the mock (network-security-config / ATS exception in the SAMPLE only, never the library).

## Screen × platform checklist (every cell needs UI+logic evidence)

Screens: Splash · Language · EnterName · Auth(phone) · Auth(OTP) · AccountBenefits · AccountSuccess · Home(feed+greeting+weather) · Home cards (content/single/multi/SSFR) · Home inputs (photo/voice/type) · Chat(text answer) · Chat(follow-ups) · Chat(voice→transcribe) · Chat(image) · Chat(TTS listen) · Chat(share/download) · Chat(retry) · ChatHistory · Drawer · Settings · SettingsName · LanguageChooser · Help · Error/NoInternet · LocationPrompt.

Platforms to drive at runtime: **Android Compose, Android Views, iOS SwiftUI, iOS UIKit, React Native, Web(headless browser)**.

Feature checklist (C1–C5): inline embed · host-token auth (skip OTP) · chat-only mode · screen toggles · event hooks fire · programmatic sendQuestion/openConversation/openScreen · host string override · forced locale · theme recolor.

## Known gaps this pass MUST close
- Android **Views**: theming recolor + C3 toggles wired at runtime (currently config-only).
- iOS **UIKit**: bring the native screen set + feature toggles to parity (currently reduced).
- **Web**: run in a real (headless) browser — install Playwright/Chromium; nothing web is runtime-verified yet.
- All: drive auth/voice/camera(where possible)/location/TTS/share/follow-ups/history against the mock and screenshot them.

## What still needs the USER (cannot be faked)
- A production backend that doesn't 500 on `get_answer_for_text_query` (mock proves the SDK; prod proves the service).
- Real device runs for: live SMS OTP autofill, physical camera, real GPS. Mock + emulator cover the logic; final sign-off is a real-device pass.
