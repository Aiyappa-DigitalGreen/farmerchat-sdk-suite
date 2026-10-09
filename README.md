# FarmerChat SDK Suite

Multi-platform SDK that packages the complete FarmerChat experience (onboarding → OTP auth → home → chat + history → settings) so any host app can embed it with a single entry point.

Source of truth: the production Android app at `fc-compose` (org.digitalgreen.farmer.chatbot) — MVVM + UDF, Jetpack Compose, Retrofit/OkHttp, Koin.

## Two lines: v1 and v2

| Line | Where | Version | What it is |
|---|---|---|---|
| **v2 (current)** | `versions/v2/` | **2.2.0 on every platform** | The agentic app (`fc-compose-agentic`, `dev/v2.5`): composer UI, streaming chat, alignment chips, and the web widget. Start here. |
| v1 | `android/ ios/ react-native/ web/` (repo root) | 1.0.0 | The original `fc-compose` port. Synchronous chat only. Kept for hosts already on it. |

- **Integration guide (all seven flavours):** https://claude.ai/artifact/BqBKuAzn2wvALENkme1pLe (Digital Green org).
- **Live web widget demo:** https://farmerchat-widget.vercel.app — the Intercom-style widget on a sample
  host page, talking to the stage backend. Test controls (bottom left) include a streaming replay.
- **Defaults (v2):** the SDK opens straight into chat (`mode` defaults to `CHAT_ONLY`; a first-time user picks a
  language once first, unless the host sets `languageCode`; pass
  `FULL_JOURNEY` for onboarding, Home and the drawer). The FarmerChat API key (`farmerChatApiKey`,
  formerly `guestApiKey`) and the Google geolocation key are built in, so hosts don't supply keys.
- **Plain HTML website:** two `<script>` tags (see `versions/v2/web/widget/README.md`). Until the
  backend allows the SDK headers in CORS, a page on another site must go through a proxy.
- **Status ledger:** `docs/04-parity-matrix.md` records every platform's parity with the app, gaps and
  how each change was verified.

## Platform Support

| Platform | Package | Min Version | Distribution |
|---|---|---|---|
| Android (Compose) | `farmerchat-android-compose` | API 26 (Android 8.0) | AAR (Maven coordinates `org.digitalgreen.farmerchat`) |
| Android (XML Views) | `farmerchat-android-views` | API 26 (Android 8.0) | AAR |
| iOS (SwiftUI) | `FarmerChatSwiftUI` | iOS 16.0 | SPM / XCFramework |
| iOS (UIKit) | `FarmerChatUIKit` | iOS 15.0 | CocoaPods + SPM |
| React Native | `@digitalgreenorg/farmerchat-react-native` | Expo SDK 52+ / RN 0.76+ | npm |
| Web | `@digitalgreenorg/farmerchat-web` | Modern browsers | npm |
| Web widget | `@digitalgreenorg/farmerchat-widget` | Modern browsers | npm + one `<script>` (IIFE) |

**Not published yet.** None of these is on Maven Central, CocoaPods trunk or npm, and the repo has no
release tags. Build from source and consume locally: `./gradlew publishToMavenLocal` (Android),
an SPM path dependency (iOS), or `npm install <path>` / `npm pack` (React Native, web). Each
platform README under `versions/v2/` has the exact steps.

## Confirmed design decisions

- **Scope: full app-as-SDK.** The SDK ships the entire FarmerChat journey. Host apps call one entry point (`FarmerChat.launch(...)` / `<FarmerChatProvider/>`) and get the complete flow.
- **Auth: SDK owns the phone + OTP flow** and manages access/refresh tokens internally (mirrors the app's `TokenAuthenticator` refresh behavior).
- **Environment-aware:** `dev | stage | demo | prod` base URLs selectable at SDK init (mirrors the app's product flavors).
- **Shared-core per platform:** each platform has a headless core (API client, models, business logic, session) consumed by its UI package(s), so Compose/XML and SwiftUI/UIKit pairs don't duplicate logic.

## Repository layout

```
docs/                      End-to-end app specification (screens, APIs, navigation, lifecycle)
android/
  farmerchat-core/         Headless Kotlin core: network, auth, repos, use cases
  farmerchat-android-compose/
  farmerchat-android-views/
  sample-compose/  sample-views/
ios/
  FarmerChatCore/          Headless Swift core
  FarmerChatSwiftUI/  FarmerChatUIKit/  SampleApp/
react-native/
  packages/farmerchat-react-native/  example/
web/
  packages/farmerchat-web/  example/
```

## Docs

- `docs/01-app-specification.md` — screen-by-screen end-to-end spec of the production app (UI, state, actions, API calls, navigation, lifecycle)
- `docs/02-api-reference.md` — every endpoint with request/response models
- `docs/03-sdk-architecture.md` — public SDK surface per platform
