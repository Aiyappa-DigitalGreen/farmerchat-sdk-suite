# FarmerChat SDK — Architecture & Public API Surface

Applies to all six packages. Read `01-app-specification.md` (screens/nav/lifecycle) and `02-api-reference.md` (endpoints/networking) first — those define the behavior; this file defines how it is packaged.

## Principles

1. **Full app-as-SDK.** One entry point launches the complete journey: bootstrap (splash) → language → name → home → chat/history → settings; OTP auth reachable from drawer/settings.
2. **SDK owns auth.** Phone + OTP UI and token lifecycle (guest init → OTP login → refresh → guest-token fallback) are internal. Host never touches tokens.
3. **Headless core + UI shells per platform.** Core = models, API client (priority timeouts, retry/backoff, 401 refresh), session store, label manager, use cases, per-screen state machines (UDF Action/State ported as-is). UI packages consume the core.
4. **No third-party analytics/marketing SDKs inside the SDK.** Plotline/MoEngage/Adjust/Firebase are app-level concerns. The SDK emits every analytics event (same names/props as the app) through `FarmerChatAnalyticsListener`; hosts forward to their own stacks. Plotline widgets/campaign surfaces are omitted; deep-link → chat routing is exposed via SDK API instead.
5. **Namespaced storage.** Prefs/Keychain/localStorage keys prefixed `fc_sdk_` so the SDK never collides with the host app.
6. **Server-driven labels everywhere.** All UI strings resolve via LabelManager (endpoint #3) with English fallbacks, exactly like the app.
7. **Environment-aware.** `dev | stage | demo | prod` (+ `eks`) selectable at init.

## Shared public surface (identical shape on every platform)

```
FarmerChat.initialize(config: FarmerChatConfig)
FarmerChat.launch(...)            // Android: Activity/Compose entry; iOS: UIViewController/View; RN: <FarmerChatView/>; Web: <FarmerChat/> or mount(el)
FarmerChat.openChat(question?, conversationId?)   // deep-link style entry
FarmerChat.updateTokens(accessToken, refreshToken?)  // HOST_TOKEN: push a freshly-refreshed token at runtime (refresh omitted preserves stored)
FarmerChat.logout()
FarmerChat.isAuthenticated / onAuthStateChanged
FarmerChat.setAnalyticsListener(listener)

// Floating launcher (host drop-in, opens/reveals the SDK on tap):
//   Android Compose: FarmerChatFab(question?, label?) composable
//   Android Views:   <org.digitalgreen.farmerchat.sdk.views.FarmerChatFab/> (Material FAB subclass)
//   iOS SwiftUI:     FarmerChatFabButton(question?, label?, bottomLeading?) — .fullScreenCover reveal
//   iOS UIKit:       FarmerChatFabButton(question?, title?) : UIButton — presents FarmerChatViewController
//   React Native:    <FarmerChatFab question? label? position?/> — reveals FarmerChatView in a Modal
//   Web:             <FarmerChatFab question? label? position?/> + FarmerChat.mountFab() — reveals the overlay

FarmerChatConfig {
  environment: dev|stage|demo|prod|eks
  geoApiKey?                      // Google geolocation (language auto-detect fallback)
  guestApiKey?                    // overrides built-in guest init API key
  appearance: day|night|auto
  languageCode?                   // preselect, skips language screen if valid
  enableVoice = true, enableImages = true, enableWeather = true
  // FAB customization (config defaults; per-instance FAB params win):
  fabLabel?, fabBackgroundColor?, fabContentColor?
  // Chat UI customization (null/omitted = current theme behavior):
  userBubbleColor?, userBubbleTextColor?, aiBubbleTextColor?, bubbleCornerRadius?, messageFontSize?  (Android: messageFontSizeSp)
  onEvent?: (name, props) -> Unit // analytics fan-out
  onSessionExpired?: () -> Unit
}
```

> Chat UI knobs `aiBubbleColor`, `aiAvatarEmoji`, `showUserAvatar` (from READMENEW.md) are intentionally NOT shipped — they require net-new per-message UI (AI bubble container / avatars) that no platform renders today. Tracked in `04-parity-matrix.md`.

## Screen modules every platform must ship

Bootstrap(splash) · LanguageSelection · EnterName · Home(feed, weather, greeting, cards: content/single-select/multi-select/SSFR, photo/speak/type inputs) · Chat(thread, follow-ups, retry, share/download card, listen-TTS, voice clips, image queries, history pagination, clarification labels) · ChatHistory(grouped, paginated) · Drawer(recent 8 questions, nav) · Auth(phone entry w/ country picker + OTP entry w/ 180 s timer, WhatsApp/SMS channels) · AccountBenefits · AccountSuccess · Settings(appearance, name) · SettingsName · LanguageChooser · Help(FAQ + legal WebView) · Error/NoInternet(full-screen, per-source retry) · LocationPrompt(interstitial → permission → GPS enable → fetch → recovery/error).

Navigation graph, back-stack semantics (`popUpTo` equivalents), and the `routeFromSplash()` decision tree must match `01-app-specification.md` §2.

## Platform packaging

| Package | Language/stack | Notes |
|---|---|---|
| `android/farmerchat-core` | Kotlin, OkHttp/Retrofit/Gson, coroutines | Direct port of app's core/domain/data. No Compose deps. |
| `android/farmerchat-android-compose` | Compose, Navigation-Compose | Screens ported from app; entry `FarmerChatActivity` + `FarmerChatRoot()` composable. minSdk 26. |
| `android/farmerchat-android-views` | XML + Fragments + Navigation Component | Same flows in Views; entry `FarmerChatActivity` (views) / `FarmerChatFragment`. Shares farmerchat-core. |
| `ios/FarmerChatCore` | Swift, URLSession, Codable, async/await | Interceptor chain replicated (priority timeouts via per-request URLSessionConfiguration, 401 refresh actor). Keychain token store. |
| `ios/FarmerChatSwiftUI` | SwiftUI, NavigationStack | iOS 16+. Entry `FarmerChatView()` / `FarmerChat.present(from:)`. |
| `ios/FarmerChatUIKit` | UIKit wrapper | iOS 15+. `FarmerChatViewController` hosting the flow (UIKit-native screens where SwiftUI unavailable). |
| `react-native/packages/farmerchat-react-native` | TypeScript, pure JS core + RN components, react-navigation | Expo 52+/RN 0.76+. AsyncStorage session, expo-av/rn-audio for voice, fetch client. |
| `web/packages/farmerchat-web` | TypeScript, React 18 | Embeddable `<FarmerChat/>`; MediaRecorder for voice, localStorage session. |

## Platform-specific adaptations (fidelity map)

| App feature | Android SDK | iOS SDK | RN / Web |
|---|---|---|---|
| SMS Retriever auto-OTP | keep (Play Services optional) | iOS OTP autofill (`textContentType = .oneTimeCode`) | manual entry (Web OTP API on web where available) |
| WhatsApp OTP SDK | keep (reflection, optional) | wa.me deep link channel | channel buttons only |
| SIM number prefill | keep behind permission | n/a | n/a |
| MediaRecorder OGG/OPUS | keep | AVAudioRecorder (Opus/CAF→m4a, format field per platform) | expo-av (m4a) / MediaRecorder (webm/opus) |
| MediaPlayer TTS/voice | keep | AVPlayer | expo-av / HTMLAudioElement |
| FileProvider camera | keep | UIImagePickerController/PHPicker | expo-image-picker / `<input capture>` |
| Share/download answer card | keep (graphicsLayer→PNG) | UIGraphicsImageRenderer + share sheet | react-native-view-shot / canvas + navigator.share |
| Play in-app update/review | omitted (host concern) | omitted | omitted |
| Plotline/MoEngage/Adjust/Firebase | omitted → analytics listener | same | same |
| Google geolocate fallback | keep (config key) | keep | keep (web: navigator.geolocation first) |
| Appearance Day/Night/Auto | keep | keep | keep (web: prefers-color-scheme) |

## Design tokens (shared)
Green brand surface (`#146152`-family as in app theme), reading surface for chat, day/night palettes, logo-spinner loading affordance, full-screen green error/message layout. Each platform defines tokens in its idiom (Compose theme / UIKit+SwiftUI assets / TS theme object) matching the app's `theme/` package.
