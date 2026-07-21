# FarmerChat SDK Suite

Multi-platform SDK that packages the complete FarmerChat experience (onboarding → OTP auth → home → chat + history → settings) so any host app can embed it with a single entry point.

Source of truth: the production Android app at `fc-compose` (org.digitalgreen.farmer.chatbot) — MVVM + UDF, Jetpack Compose, Retrofit/OkHttp, Koin.

## Platform Support

| Platform | Package | Min Version | Distribution |
|---|---|---|---|
| Android (Compose) | `farmerchat-android-compose` | API 26 (Android 8.0) | Maven Central AAR |
| Android (XML Views) | `farmerchat-android-views` | API 26 (Android 8.0) | Maven Central AAR |
| iOS (SwiftUI) | `FarmerChatSwiftUI` | iOS 16.0 | SPM XCFramework |
| iOS (UIKit) | `FarmerChatUIKit` | iOS 15.0 | CocoaPods + SPM |
| React Native | `@digitalgreenorg/farmerchat-react-native` | Expo SDK 52+ / RN 0.76+ | npm |
| Web | `@digitalgreenorg/farmerchat-web` | Modern browsers | npm |

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
