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
                                  // Android v2 (2.2.0): a repeat call rebuilds the graph only when environment,
                                  // mode or showDrawer/showHistory/showSettings differ — lets one host offer a
                                  // full-journey AND a CHAT_ONLY entry. Other platforms: first config wins (docs/04 gap).
FarmerChat.launch(...)            // Android: Activity/Compose entry; iOS: UIViewController/View; RN: <FarmerChatView/>; Web: <FarmerChat/> or mount(el)
FarmerChat.openChat(question?, conversationId?)   // deep-link style entry
FarmerChat.updateTokens(accessToken, refreshToken?)  // HOST_TOKEN: push a freshly-refreshed token at runtime (refresh omitted preserves stored)
FarmerChat.logout()
FarmerChat.isAuthenticated / onAuthStateChanged
FarmerChat.setAnalyticsListener(listener)
FarmerChat.ensureChatOnlyBootstrap() / FarmerChat.beginChatOnlyJourney()
                                  // iOS public (2.2.0); internal on Android (FarmerChatGraph), RN (sdk.ts) and
                                  // web (chatOnlyBootstrap.ts): headless guest init + languages + labels, and a
                                  // fresh conversation per chat-only journey (a history thread keeps its id).

// Floating launcher (host drop-in, opens/reveals the SDK on tap):
//   Android Compose: FarmerChatFab(question?, label?) composable
//   Android Views:   <org.digitalgreen.farmerchat.sdk.views.FarmerChatFab/> (Material FAB subclass)
//   iOS SwiftUI:     FarmerChatFabButton(question?, label?, bottomLeading?) — .fullScreenCover reveal
//   iOS UIKit:       FarmerChatFabButton(question?, title?) : UIButton — presents FarmerChatViewController
//   React Native:    <FarmerChatFab question? label? position?/> — reveals FarmerChatView in a Modal
//   Web:             <FarmerChatFab question? label? position?/> + FarmerChat.mountFab() — reveals the overlay

FarmerChatConfig {
  environment: dev|stage|demo|prod|eks
  // v2 2.2.0 (2026-10-09): both keys are BUILT IN on every platform; hosts are not asked for keys.
  farmerChatApiKey?               // optional override of the built-in FarmerChat guest-init API-Key
                                  //   (renamed from guestApiKey — the old name was removed, no alias)
  geoApiKey?                      // optional override of the built-in Google geolocation key
  mode = CHAT_ONLY                // v2 default (was FULL_JOURNEY): first launch shows the language screen
                                  //   once (skipped if languageCode/locale is set), then chat; later launches
                                  //   open straight into chat with a headless guest bootstrap.
                                  //   FULL_JOURNEY (onboarding → Home → chat …) still ships.
  showDrawer?                     // unset → (mode == FULL_JOURNEY); chat-only puts language (+ history if on) in the chat bar
  showHistory?                    // unset → (mode == FULL_JOURNEY): no history in chat-only (guests have none); explicit wins
  showSettings = true, showNameScreen = true
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
| `versions/v2/web/packages/farmerchat-web` (UI rebuilt from the compose module 2026-10-08) | TypeScript, React 18 | Web-only additions: `config.assetBaseUrl` (where the shipped `dist/illustrations/{ke,et,ng,in}/farmer_looking_at_*.webp` are served from; unset → full-screen messages render without the picture) and the host CSS variables `--farmerchat-inset-top` / `--farmerchat-inset-bottom` (WindowInsets equivalent, default `env(safe-area-inset-*)`). Bundles Roboto (OFL). |
| `versions/v2/web/widget` (`@digitalgreenorg/farmerchat-widget`, added 2026-10-08) | TypeScript, React 18 | Intercom-style wrapper over the v2 web SDK (consumed via `file:` dep, no source copy): launcher bubble + floating 400×680 panel hosting the full journey (`inline`), fullscreen sheet on narrow viewports. Panel stays mounted when closed. ESM build for React hosts + a self-contained IIFE (`farmerchat-widget.iife.js`, React bundled) exposing `window.FarmerChatWidget.boot/open/close/toggle/isOpen/shutdown/update` and `.sdk` (the SDK statics). Web-only — no native counterpart planned. No new endpoints, events, or preference keys. |

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

### Type scale (v2)

The app declares 13 slots (the Material3 scale it uses, plus a separate `caption`) and varies
**line height** per script while holding size and weight fixed — six tables selected by
`typographyForLanguage(code)` in `theme/Type.kt`, because Devanagari, Ethiopic, Kannada, Oriya and
Telugu need more leading than Roman at the same point size. Platforms must carry both the slots and
the per-script tables; see docs/04 for current per-platform status.

**Where the numbers live:** `FarmerChatCore/Theme/FCTypeScale.swift` holds the scale as data —
`FCTypeSpec` (size, total line box, weight), `FCTypeScale` (the 13 slots), `FCScript` +
`FCScript.forLanguage(_:)` (the port of `typographyForLanguage`), and a plain `FCFontWeight` enum
so Core carries no UI-framework type. Both iOS flavours resolve from this one copy; neither
restates a number. This matters because the two flavours need **different arithmetic** over the
same numbers:

| Flavour | Mechanism | Total line box? | Arithmetic |
|---|---|---|---|
| Compose (reference) | `TextStyle.lineHeight` | yes | use the number |
| SwiftUI | `.lineSpacing` | **no — additive leading** | subtract `UIFont.lineHeight` |
| UIKit | `NSParagraphStyle.min/maximumLineHeight` | yes | use the number |
| React Native | `TextStyle.lineHeight` | yes | use the number |
| CSS | `line-height` | yes | use the number |

**iOS public surface (added 2026-09-09):**

| Symbol | Shape |
|---|---|
| `FCTypography` | the 13 resolved slots — `displayLarge/Medium/Small`, `titleLarge/Medium/Small`, `bodyLarge/Medium/Small`, `labelLarge/Medium/Small`, `caption` |
| `FCTypography.forLanguage(_:typeScale:fontName:)` | resolves the script-correct, host-scaled scale; cached per (script, typeScale, fontName) |
| `FCTypography.roman` | the scale-1.0 roman default |
| `FCTypography.bodyLarge(atSize:)` / `.bodyMedium(atSize:)` | one slot re-resolved at a host-supplied point size, for `config.messageFontSize`; preserves the script's line-height ratio |
| `FCTextStyle` | one resolved slot — `size`, `lineHeight`, `lineSpacing`, `weight`, `font` |
| `FCTheme.typography` | the resolved scale for the current language + host theme |
| `View.fcTextStyle(_:)` | applies font + the script-correct `lineSpacing` in one call |
| `PreferenceStore.languageDidChange` (Core) | emits on an actual change of `selectedLanguageCode`, so language-derived UI can rebuild |

`FarmerChatUIKit` mirrors it, resolving the same Core specs into UIKit types:

| Symbol | Shape |
|---|---|
| `FCUITypography` | the 13 resolved slots, plus `bodyMedium(atSize:)` / `bodyLarge(atSize:)` |
| `FCUITypography.forLanguage(_:typeScale:fontName:)` | cached resolve, as SwiftUI's |
| `FCUITypography.current` | the scale for the farmer's language + host theme; UIKit has no environment to inherit, so this reads the same prefs and host config `FCTheme` does |
| `FCUITextStyle` | `size`, `lineHeight`, `font: UIFont`, `paragraphStyle(alignment:lineBreakMode:)` |
| `UILabel.fcApplyFont(_:)` | font/weight only — safe anywhere, sufficient for single-line labels |
| `UILabel.fcSetText(_:style:)` | sets the string **with** line height; must be the call that sets the text, and bakes in `textColor`/`textAlignment` |
| `UIButton.fcApplyTitleFont(_:)`, `UITextField.fcApplyFont(_:)` | as above for those types |

Two deliberate exclusions on both flavours. `Image(systemName:)` / icon point sizes stay raw,
because Compose sizes icons with `Modifier.size(dp)`, which does **not** track font scale while
`sp` does — putting icons on the scale would make them grow with `typeScale` where Android's do
not. Monospaced timers stay raw so a live countdown does not jitter on proportional digits.
`FCTheme.font(size:weight:)` remains as the escape hatch for genuinely off-scale sizes (a
glyph-as-text, an offscreen render canvas).

---

## Versioning (added 2026-09-02)

Each version is a **complete, self-contained SDK** — all four platforms, buildable and publishable
independently:

```
android/  ios/  react-native/  web/          v1.0.0  synchronous chat (endpoint #27)
versions/v2/android/  ios/  react-native/  web/   v2.0.0  agentic streaming (#27a)
```

| Version | Chat transport | App source of truth |
|---|---|---|
| 1.0.0 | Synchronous JSON, #27 | `fc-compose` @ `9f5e4ca` (v4.0.3) |
| 2.0.0 | Agentic SSE streaming, #27a | `fc-compose-agentic` @ `193dbd64` (v4.1.3, versionCode 108) |

Both publish to the same group at different versions, so a host selects one with an ordinary
dependency coordinate and gets that version's whole flow.

**`FarmerChatConfig.environment` keeps the same shape in both versions, but `stage` no longer
resolves to the same URL** (2026-09-08): 2.0.0 points it at `https://demo.agent.farmer.chat/`,
1.0.0 keeps `https://farmerchat.farmstack.co/mobile-app-stage/`. Nothing in the public surface
above changes — a host still passes `stage` — so this is invisible at the API and visible only in
where the traffic goes. The per-environment URLs, the probe of the new host and the revert
instructions live in `docs/02-api-reference.md` §Base URLs.

**Trade-off, recorded deliberately:** the trees are independent copies, so a fix in one does not
reach the other and must be applied twice. This was chosen over a shared codebase with a feature
flag so that a host on 1.0.0 can never be affected by v2 work. `versions/README.md` carries the
detail; `docs/04-parity-matrix.md` is the ledger for both.
