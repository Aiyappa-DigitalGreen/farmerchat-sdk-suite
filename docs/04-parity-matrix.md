# Feature Parity Matrix — honest ledger

Legend: ✅ implemented & verified · 🟡 implemented, UNVERIFIED (no build/type-check run) · ⛔ not implemented (reason required) · n/a not applicable per docs/03 adaptation table.

Update this file with every change. Never mark ✅ for stubbed, partial, or unverified code. "Verified" means the platform's minimum check in root CLAUDE.md §5 passed.

| Feature (docs/01 ref) | android-core | android-compose | android-views | ios-core | ios-swiftui | ios-uikit | react-native | web |
|---|---|---|---|---|---|---|---|---|
| All 34 endpoints + token APIs (02) | ✅ | n/a (core) | n/a (core) | ✅ (FarmerChatAPI) | n/a (core) | n/a (core) | ✅ | ✅ |
| Interceptor chain / headers (02) | ✅ | n/a | n/a | ✅ (APIClient) | n/a | n/a | ✅ | ✅ |
| ApiPriority timeouts + retry table (02) | ✅ | n/a | n/a | ✅ (+unit tests) | n/a | n/a | ✅ | ✅ |
| 401 refresh + guest fallback (02) | ✅ (single-flight lock) | n/a | n/a | ✅ (TokenRefresher actor, single-flight) | n/a | n/a | ✅ | ✅ |
| Session store (fc_sdk_ namespaced) | ✅ | n/a | n/a | ✅ (Keychain tokens + UserDefaults prefs) | n/a | n/a | ✅ | ✅ |
| LabelManager server-driven strings | ✅ (app Labels.kt keys ported 1:1) | ✅ (all strings via labelManager + app English fallbacks) | ✅ (same) | ✅ (resolution chain + templating; see debt: SDK base keys) | ✅ (all strings via fcLabel) | ✅ (all strings via fcuiLabel) | ✅ | ✅ |
| Analytics listener (app event names) | ✅ | ✅ (screen view/exit + events via graph.analytics) | ✅ (same) | ✅ (AnalyticsDispatcher + config.onEvent + setAnalyticsListener) | ✅ | ✅ | ✅ | ✅ |
| Guest init flow (endpoint #1) | ✅ (SessionManager) | ✅ (Language screen geo→guest-init) | ✅ (same) | ✅ (SessionManager.ensureGuestSession) | ✅ (Splash) | ✅ (Splash) | ✅ | ✅ |
| Splash + routeFromSplash tree (01 §2) | n/a | ✅ | ✅ | ✅ (SplashRouter shared) | ✅ | ✅ | ✅ | ✅ |
| Language onboarding (01 §3.2) | ✅ (OnboardingSharedViewModel) | ✅ (priority+expand, per-row label fetch, legal dialog) | ✅ (same) | ✅ (OnboardingViewModel) | ✅ (priority+expand, legal links, bottom bar) | 🟡 (table UI; no legal-links footer/tagline) | ✅ | ✅ |
| Blank-`country_code` guard on #2 (`defaultCountryCode`/`defaultStateCode`) | ✅ | ✅ (via core) | ✅ (via core) | ✅ | ✅ (via core) | ✅ (via core) | ✅ | ✅ |
| Enter Name (01 §3.3) | ✅ (EnterNameViewModel) | ✅ | ✅ | ✅ (EnterNameViewModel + normalizer) | ✅ | ✅ | ✅ | ✅ |
| Auth phone entry + country picker (01 §3.4) | ✅ (AuthViewModel) | ✅ (full-screen picker w/ search) | ✅ (picker dialog w/ search; no SIM prefill — see debts) | ✅ (AuthViewModel) | ✅ (picker sheet w/ search) | ✅ (picker w/ UISearchController) | ✅ | ✅ |
| Auth OTP entry + 180s timer (01 §3.4) | ✅ (state; timer in UI) | ✅ | ✅ (CountDownTimer) | ✅ (timer in VM) | ✅ | ✅ | ✅ | ✅ |
| OTP channels WhatsApp/SMS (#20) | ✅ | ✅ (channel buttons) | ✅ (channel buttons) | ✅ | ✅ | ✅ | ✅ | ✅ |
| SMS auto-read | n/a | ✅ (SMS Retriever, runCatching-guarded) | ✅ (SMS Retriever, runCatching-guarded) | n/a | ✅ .oneTimeCode autofill | ✅ .oneTimeCode autofill | ⛔ platform | 🟡 WebOTP (needs Chrome/Android runtime test) |
| AccountBenefits + AccountSuccess | ✅ (question-count gate) | ✅ (back-stack nuance — see debts) | ✅ (back-stack nuance — see debts) | ✅ (shouldBypassInterstitial) | ✅ | ✅ | ✅ | ✅ |
| Home feed sections (content/single/multi/SSFR) | ✅ (HomeViewModel) | ✅ (all four card types) | ✅ (all four card types) | ✅ (HomeViewModel + cache fallback) | ✅ (all four card types) | ✅ (content/single/multi + **SSFR card** now rendered above the feed, C3+`ssfr_enable` gated; **screenshot mock `ios-uikit-05-home.png`**) | ✅ | ✅ |
| Guest home: seed #11 with default coords when country unresolved | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Composer lifted above the IME (`imePadding`) | n/a (UI) | ✅ | ✅ (root-inset listener — **not** `adjustResize`, see below) | n/a (UI) | ✅ | ✅ | ✅ | ✅ |

> **Correction (2026-09-02).** This row previously read `n/a (XML adjustResize)` for
> android-views. That was wrong: the SDK theme draws edge-to-edge, and under transparent
> system bars `windowSoftInputMode="adjustResize"` does not shrink a bottom-gravity
> overlay, so the input stayed behind the IME. Both android-views input surfaces —
> `InputOverlaysController.applyImeInsets()` (v1 + v2) and `InputComposerView.applyImeInsets()`
> (v2) — pad from `ViewCompat.getRootWindowInsets`, deliberately not from the dispatched
> insets, which a sibling of a `fitsSystemWindows="true"` container sees zeroed. Do not
> "simplify" either one back to `onApplyWindowInsets(insets)`.

| Drawer order matches app (nav → divider → recent) | n/a (UI) | ✅ | ✅ | n/a (UI) | ✅ | ✅ | ✅ | ✅ |
| `plotline_widget` sections filtered from feed + analytics | ✅ | ✅ | ✅ | ✅ | ✅ (via core) | ✅ (via core) | ✅ | ✅ |
| Greeting falls back to label when #12 omits it | n/a (UI) | ✅ | ✅ (static label) | n/a (UI) | ✅ | n/a | ✅ | ✅ |
| Home greeting + weather chip | ✅ | ✅ (greeting skeleton + weather chip) | ✅ (greeting static above pinned inputs — see debts) | ✅ | ✅ | 🟡 (greeting ✅; weather = nav-bar temp text only) | ✅ | ✅ |
| Home Photo/Speak/Type inputs | ✅ (AudioRecorder/transcribe) | ✅ (sticky row + overlays) | ✅ (pinned row + overlays; simple voice panel) | ✅ (AudioRecorderService m4a/aac) | ✅ (overlays) | ✅ (pinned header; Type = alert input) | ✅ | ✅ |
| Card mark-viewed + dismiss | ✅ | ✅ (fires on composition ≈ visibility — see debts) | ✅ (≥50% visibility measured) | ✅ (dedup per statement) | ✅ (onAppear ≈ visibility) | ✅ (willDisplay + dismiss button) | ✅ | ✅ |
| Chat: text query (#27) | ✅ (ChatViewModel) | ✅ (all 5 init modes) | ✅ (all 5 init modes) | ✅ (ChatViewModel) | ✅ | ✅ | ✅ | ✅ |
| Chat: image query (#28) camera/gallery | ✅ (base64 + GPS from prefs) | ✅ (FileProvider camera + gallery) | ✅ (FileProvider camera + gallery) | ✅ (base64 + GPS from prefs) | ✅ (PHPicker + camera) | ✅ (UIImagePickerController) | ✅ | ✅ |
| Chat: voice → transcribe (#16, conf>0.7) | ✅ | ✅ | ✅ | ✅ (isAcceptable rule + tests) | ✅ | ✅ | ✅ | ✅ |
| Chat: follow-ups via #29 | ✅ | ✅ | ✅ | ✅ (never from #27 response) | ✅ | ✅ | ✅ | ✅ |
| Chat: pre-generated content entry | ✅ (incl. campaign #33) | ✅ (+Read-full-advice) | ✅ (+Read-full-advice) | ✅ (+Read-full-advice swap; #33 client-only, see debts) | ✅ | ✅ | ✅ | ✅ |
| Chat: clarification labels | ✅ | ✅ | ✅ (label switch) | ✅ (clarificationRequired in state) | ✅ (chip title switches) | 🟡 (chips render; no clarification-specific title) | ✅ | ✅ |
| Chat: retry failed message | ✅ (retry=true flag) | ✅ (inline retry) | ✅ (inline error + RetryLastRequest) | ✅ (retry=true flag, per-request closure) | ✅ | ✅ | ✅ | ✅ |
| Chat: Listen TTS (#31) | ✅ (+AudioPlayback) | ✅ | ✅ | ✅ (AVPlayer service) | ✅ | ✅ | ✅ | ✅ |
| Chat: voice-clip bubbles play/pause | ✅ (AudioPlayback + duration) | ✅ (waveform + duration) | ✅ (play/pause + duration) | ✅ (position/duration published) | ✅ (progress + duration) | 🟡 (play/pause; no progress bar) | ✅ | ✅ |
| Chat: share/download answer card | n/a (UI concern) | ✅ (graphicsLayer→PNG; share intent + MediaStore save) | ✅ (offscreen view→Bitmap; FileProvider share + MediaStore save) | n/a | ✅ (ImageRenderer card + share sheet; download → Photos) | 🟡 (UIGraphicsImageRenderer card + share sheet; no separate download action) | ✅ (view-shot optional; save = share sheet) | ✅ (canvas PNG + navigator.share / download) |
| Chat: history load + pagination (#32) | ✅ | ✅ (scroll restore) | ✅ (anchor-based restore + one-time scroll-to-bottom) | ✅ (pages by raw `data` non-empty — app parity, **2026-07-30 fix**) | ✅ (load-earlier + position-preserving prepend) | ✅ (load-earlier row + offset-preserving prepend, **2026-07-30**) | ✅ (pages by raw items) | ✅ (pages by raw items) |
| Chat: unique history bubble ids (no duplicate list keys) | ✅ | ✅ | ✅ | ✅ | ✅ (via core) | ✅ (via core) | ✅ | ✅ |
| Chat: cosmetic answer reveal + follow-up/action restyle (UI-only, **NOT streaming**) | n/a (no core/ChatState change) | ✅ **android-compose only**: client-side typewriter reveal of *fresh* answers (blinking caret + tap-to-skip; history + pre-generated render in full immediately, no reveal), restyled "Related questions" suggestion cards, brand-accent Share/Save/Listen chips, and a pulsing logo "thinking" indicator — all driven by existing theme tokens (green/blue/dark screenshot-verified on emulator 2026-07-21, `scratchpad/chat-redesign-*`). Chat replies stay synchronous JSON per guardrail #3; the reveal is a purely cosmetic Compose animation over the already-received text | ⛔ not ported (intentional UI-only parity gap) | n/a | ⛔ not ported | ⛔ not ported | ⛔ not ported | ⛔ not ported |
| ChatHistory screen grouped + paginated (#22) | ✅ (ChatHistoryViewModel) | ✅ | ✅ | ✅ (dual-format decode + grouping) | ✅ | ✅ | ✅ | ✅ |
| Drawer (recent 8, nav) | ✅ (recentDrawerQuestions) | ✅ (side drawer, typed icons, sign-up card; recent-chats + History gated `isAuthenticated && showHistory`) | ✅ (recent-8, typed icons; recent-chats + See-all gated `isAuthenticated && showHistory`, guests see sign-up card, `refreshSilently` + onAuthStateChanged refresh auth-only — **2026-07-30 fix**; authed+showHistory=false shows neither history nor sign-up, minor gap vs compose) | ✅ (recentQuestions in VM) | ✅ (side overlay, typed icons; recent-chats + History row gated `isAuthenticated && showHistory`, guests see sign-up card, silent refresh auth-only — **2026-07-30 fix**) | ✅ (real slide-in drawer: header, active-row, recent-8 typed rows + See all, C3-gated Language/Settings/Help; recent-chats + History row gated `isAuthenticated && showHistory`, guest sign-up footer, silent refresh + onAuthStateChanged refresh auth-only — **2026-07-30 fix**; **screenshot mock `ios-uikit-19-drawer.png`**) | ✅ (DrawerContent recent-chats section gated `isAuthenticated && showHistory`, guests see sign-up card, ChatHistory screen mount refresh auth-guarded — **2026-07-30 fix**; `tsc` clean) | ✅ (side drawer, typed icons; recent-chats + History row gated `isAuthenticated && showHistory`, guests see the sign-up card, silent refresh + onAuthStateChanged refresh auth-only, ChatHistory screen self-guards its mount refresh + shows a sign-up card for guests — **2026-07-30 fix**; `tsc --noEmit` + `vite build` clean) |
| Settings + appearance Day/Night/Auto (**v2 2.1.1 android core: with `showSettings=false` the host `appearance` is re-seeded every init; GAP — iOS `FarmerChat.swift:148` seeds only when nil, RN `ui/context.tsx:63` prefers the stored pref, web not checked**) | ✅ (pref; render in UI) | ✅ | ✅ (activity-local night mode) | ✅ (pref + THEME attr) | ✅ | ✅ | ✅ | ✅ (auto = prefers-color-scheme, live) |
| SettingsName | ✅ | ✅ | ✅ (toast via savedStateHandle) | ✅ | ✅ (+name-updated toast) | ✅ | ✅ | ✅ |
| LanguageChooser (settings) | ✅ (SettingsViewModel) | ✅ (save→toast→Home popUpTo(0)) | ✅ (same) | ✅ (SettingsViewModel) | ✅ | ✅ | ✅ | ✅ |
| Help/FAQ + legal WebView (#24) | ✅ (use case; WebView in UI) | ✅ (FAQ skeleton + WebView dialog + version footer) | ✅ (FAQ shimmer + WebView dialog + version footer) | ✅ (HelpViewModel) | ✅ (WKWebView sheet) | ✅ (SFSafariViewController) | ✅ (webview optional; browser fallback) | ✅ (iframe modal) |
| Error/NoInternet full-screen + per-source retry | ✅ (ErrorNavigationManager) | 🟡 (uniform popBack + retryLastAction, not 7 per-fromScreen branches — see debts) | ✅ (per-fromScreen retry table) | ✅ (ErrorNavigationManager port) | ✅ (centralized route + per-fromScreen retry) | ✅ (centralized `ErrorNavigationManager` on `FarmerChatViewController`: screens fire `navigateToError(fromScreen:retry:)` → full-screen error VC → Try again runs the stored retry; splash-init + chatHistory routed through it; **screenshot mock `ios-uikit-24-error.png`**) | ✅ | ✅ |
| Location prompt state machine (01 §3.15) | ✅ (LocationPromptManager) | ✅ (full overlay host + GPS resolution) | ✅ (full overlay host + GPS resolution) | ✅ (CoreLocation manager; RequestEnableGps → services-off error, no in-app resolution on iOS) | ✅ (global overlay host) | ✅ (`FCUILocationPromptHost` overlay above the nav stack driven by `LocationPromptManager`: interstitial → permission/fetch → recovery sheet / error; weather CTA routes through it then opens Chat; **screenshot mock `ios-uikit-25-location.png`**) | ✅ | ✅ (simplified: navigator.geolocation, same states; RequestEnableGps folded into permission — no browser equivalent) |
| Logout flow (#23 + clear + identity reset) | ✅ | ✅ (→Splash popUpTo(0)) | ✅ (→Splash clear-stack) | ✅ (clear prefs preserving appearance; identity reset = host listener) | ✅ | ✅ | ✅ | ✅ (identity reset = host listener concern; SDK clears fc_sdk_ state, preserves appearance) |
| Deep-link style openChat API | ✅ (FarmerChat.openChat + pending target) | ✅ (intent extras + pending target) | ✅ (intent extras + pending target) | ✅ (pending target consumed by routeFromSplash) | ✅ | ✅ | ✅ | ✅ (pending-target when onboarding incomplete) |
| Sample/example app | n/a | ✅ (sample-compose APK assembles + **re-driven on emulator 2026-07-20** with a profile selector: **dev** — host/splash/language/select/entername/home(feed+greeting+weather 26°C+content cards)/drawer/help/settings/settingsname; **themed** blue Home recolor `andc-20-themed-home.png`; **inline** embed `andc-24-inline.png`. Earlier dev pass 2026-07-17: guest init, feed, weather, labels, chat query. Screenshots `scratchpad/andc-*.png`) | ✅ (sample-views APK assembles + **re-driven end-to-end on emulator 2026-07-20** with a profile selector: **dev** — splash/language/select/name/home(cards+weather)/drawer(recent+nav)/settings/help; **mock** — home(SSFR/content/single-select cards), drawer(recent), AccountBenefits→Auth phone→OTP(1234)→AccountSuccess, chat text answer + follow-ups; **themed** blue recolor (Language/Name/Home); **chatonly** lands in chat; **togglesoff** (no drawer/weather); **override** (PHOTO✦/SPEAK✦/TYPE✦ + hi locale); **inline** embed — screenshots `scratchpad/andv-*.png`) | n/a | ✅ (SampleApp + xcodegen `project.yml` target; **runtime-tested on iPhone 17 simulator (iOS 26.1)**: guest init, geolocate, language onboarding incl. server `set_preferred_language`, home feed with live cards, chat #27 with real AI answer, all live against dev, 2026-07-17) | ✅ (SampleApp UIKit-native flow **runtime-tested on iPhone 17 sim (iOS 26.1) against the local mock, 2026-07-20**: splash→language onboarding→home(SSFR card)→drawer(recent-8)→settings→help→history→languageChooser→chat(real #27 answer)→error→location, 11 screens screenshotted `scratchpad/ios-uikit-*.png` + blue-theme recolor `ios-uikit-blue-home.png`) | ✅ (Expo app + **runtime-tested on emulator** via Expo Go SDK 52: guest init/language/name/dashboard/chat-retry live against **dev** 2026-07-17; **re-driven end-to-end against the local mock 2026-07-20** — onboarding, home (content/single/multi/SSFR cards + weather + greeting), Type input, and the previously-blocked **chat AI-answer path** (real markdown #27 → 3 follow-up chips → follow-up Ask → voice transcribe conf 0.93 → image #28 → TTS Listen → share) all screenshotted `scratchpad/rn-*.png`; the OTP-verify/drawer/error screens that a shared emulator had blocked were then **fully driven on a dedicated emulator-5556, 2026-07-21** — see debts) | ✅ (web/example Vite app + **runtime-tested in real headless Chromium (Playwright)**: full onboarding→home→chat→auth→settings→history→help→error→location + all C1–C5 features driven against the mock, 37 screens screenshotted, 2026-07-20 — see debts) |
| FarmerChatFab floating launcher | n/a | ✅ (composable; default/extended; verified on emulator) | ✅ (Material FAB subclass, XML drop-in; verified on emulator) | n/a | ✅ `FarmerChatFabButton` SwiftUI view — pinned round/extended launcher that reveals the journey via `.fullScreenCover` with a close ✕; `theme.brand.surfacePrimary` bg + `FCLogoMark` icon; optional `question` deep-link set before reveal (router consumes the pending target). `swift build` clean (build-verified; NOT runtime-exercised) | ✅ `FarmerChatFabButton: UIButton` drop-in subclass (host adds + constrains, parity with Views) — presents `FarmerChatViewController` from its owning VC (responder walk) with a close ✕ overlay; `leaf.circle.fill` glyph + `FCUITheme.brandSurfacePrimary` (matches the package's own logo treatment); optional `question` deep-link. `swift build` clean (build-verified; NOT runtime-exercised) | ✅ `<FarmerChatFab/>` component — pinned round/extended `Pressable` reveals `<FarmerChatView/>` in a full-screen `Modal` with a close ✕; `dayTheme.brandPrimary` + rasterized `fc_logo_mark` (host-logo override honored); optional `question` deep-link queues a pending target consumed on mount. `tsc --noEmit` clean (build-verified; NOT runtime-exercised) | ✅ `<FarmerChatFab/>` component + `FarmerChat.mountFab()` imperative — fixed launcher **reveals (mounts) the full-screen `<FarmerChat/>` overlay** with a close ✕ (NOT a silent `openChat` on an unmounted root); host `theme.colors.brandPrimary` + logo/🌱; optional `question` queues via `withController` and replays when the revealed root mounts. `tsc --noEmit` + `vite build` clean (build-verified; NOT runtime-exercised) |
| Intercom-style web widget (`versions/v2/web/widget`, 2026-10-08) | n/a | n/a (web-only) | n/a (web-only) | n/a | n/a (web-only) | n/a (web-only) | n/a (web-only) | ✅ v2 only — `@digitalgreenorg/farmerchat-widget`: launcher + floating panel hosting `<FarmerChat inline/>`; panel stays mounted on close (conversation + back stack survive, unlike `FarmerChatFab`); fullscreen sheet + slim close bar below the `shouldUseFullscreen` breakpoint; `config.onExit` collapses the panel; Esc closes, focus returns to the launcher; the SDK is initialized at boot (sync, no requests) so `.sdk.logout()/isAuthenticated()/onAuthStateChanged()` work before first open; `update()` merges options and keeps the session unless a new `config` object is passed; `open(question)` deep-links via a post-mount effect (survives `shutdown()`→`boot()`); script-tag IIFE (React bundled, single copy) with `window.farmerChatWidgetSettings` auto-boot. **Runtime-verified in Chrome against tools/mock-server** (plain HTML host, no React): open → language → name skip → Home; close/reopen kept Home; `open(question)` deep-link produced a chat answer; Esc closed; host page styles untouched; 390×760 iframe → fullscreen, drawer contained in the panel; `.sdk.onAuthStateChanged` before first open registers; `update({position})` kept the same SDK root + Home; shutdown→boot→`open(question)` answered. `tsc --noEmit` + both `vite build`s clean. NOT verified: real backend, voice/camera permissions inside the panel, Safari/Firefox. v1 `web/` has no widget. |
| Build/type-check verified (CLAUDE.md §5) | ✅ `compileDebugKotlin` + `assembleDebug` AAR clean (2026-07-17, compileSdk 36) | ✅ `compileDebugKotlin` + `assembleDebug` AAR + sample APK clean (2026-07-17) | ✅ `compileDebugKotlin` + `assembleDebug` AAR + sample APK clean (2026-07-17) | ✅ `xcrun swift build --sdk iphonesimulator -target arm64-apple-ios15.0-simulator` clean + `swift test` **12/12** (re-run 2026-07-20 after API-hardening + theming + C1–C5) | ✅ same command, ios16.0-simulator target, clean (re-run 2026-07-20) | ✅ same command, ios15.0-simulator target, clean (re-run 2026-07-20) | ✅ `npx tsc --noEmit` + `tsc` build clean, re-verified by main session (2026-07-16) | ✅ `npx tsc --noEmit` clean + `vite build` clean, re-verified 2026-07-20 (v1.0.0) |
| **Distribution: import-by-coordinate proof (docs/07 A)** | ✅ `publishToMavenLocal` → `org.digitalgreen.farmerchat:farmerchat-core:1.0.0` | ✅ `:farmerchat-android-compose:1.0.0` | ✅ `:farmerchat-android-views:1.0.0` | ✅ `build-xcframework.sh` → `dist/FarmerChatCore.xcframework` (ios-arm64 device + arm64/x86_64 sim slices, embedded `.swiftinterface`); `Package.binary.swift` binaryTarget manifest; **consumed by `ios/ConsumerApp` which links the `.xcframework` (embed, NOT the source package) — builds AND runs on iPhone 17 sim, 2026-07-20**. v1.0.0 = `FarmerChatSDK.version` | ✅ `FarmerChatSwiftUI.xcframework` (dynamically links `FarmerChatCore.framework` via @rpath — no duplicate Core symbols; verified with `otool -L`); binary-consumed by `ConsumerApp` (`FarmerChatView`/`FarmerChatInlineView` from the compiled interface) | ✅ `FarmerChatUIKit.xcframework` (same dynamic Core link) + `FarmerChatUIKit.podspec` `ruby -c` **Syntax OK**; **CocoaPods absent → `pod lib lint`/trunk NOT run** | ✅ `tsc` build + `npm pack` → `digitalgreenorg-farmerchat-react-native-1.0.0.tgz` (773 kB, 357 files incl. dist+src+39 PNG assets); fresh `react-native/example-packaged/` installs it **from the .tgz** (real copy, not symlink) and passes `tsc --noEmit` **and** `expo export` (Metro bundled the SDK + all assets from node_modules, Android bundle emitted) (2026-07-20). `exports` map (`source`/`types`/`react-native`/`import`)+`main`/`module`/`types`; react/react-native peer-only (not bundled, no `dependencies`); `files`=dist+src+README; `sideEffects:false`. Version 1.0.0 in package.json + `SDK_VERSION` (kept in sync) | ✅ `npm pack` → `digitalgreenorg-farmerchat-web-1.0.0.tgz`; fresh `web/example-packaged/` installs it via `file:./…tgz` (not a workspace path) and passes `tsc --noEmit` + `vite build` (2026-07-20). Version from ONE source (`core/version.ts` `FARMERCHAT_VERSION` = 1.0.0, mirrored in package.json). `exports`/`main`/`module`/`types` → built `dist/`; react/react-dom peer-only (externalized); `files` allowlist = dist+README; `sideEffects:false` |
| **Host theming (docs/07 B): colors(+dark)/shape/typography/logo** | ✅ `FarmerChatTheme` model on `FarmerChatConfig.theme` | ✅ single `resolveBrand/ContentColors`+`resolveShapes`+`resolveTypography` overlay feeds LocalBrand/ContentColors/LocalFcShapes/MaterialTheme — every screen recolors with zero per-screen edits; day/night applies (host light → SDK dark kept); FAB + input-glyph tint + card/button radius honored; **screenshot-verified on emulator (blue host brand, Language + Home)** | ✅ `FarmerChatActivity` installs a `LayoutInflater.Factory2` (`FcThemeInflaterFactory`) BEFORE `super.onCreate` — creating layouts + custom views itself so it can post-process every inflated view, and propagating to fragment + RecyclerView-item inflation with zero per-screen edits. A shared `FcRecolor`/`FcViewTheme` resolver mirrors the Compose overlay: brand token values (green700/800/500/950, surface_active, error) in ColorDrawable/GradientDrawable/LayerDrawable backgrounds, tints and text colors are remapped to the host palette; stroked brand drawables re-stroked; adapters that swap brand drawables at runtime (LanguageListAdapter selection) call `FcRecolor.maybeRecolor`. **Screenshot-verified on emulator (blue host brand): Language `andv-02-language.png`/select `andv-02b`, EnterName `andv-03`, Home app-bar+weather-pill+input-tiles+buttons `andv-08-home.png`, 2026-07-20.** **v2 2.1.1 (2026-09-30)**: colours resolved in CODE now go through the theme too (`FcTokens.color` is the single gateway — composer sheet, system-bar backdrop, toast, primary button, voice clip, FAB, FullScreenMessage, `FcText` attrs); translucent brand variants (accent 28%/0%, brand divider, double surface-active) and the cyan/yellow accent stops (share sweep border, composer aura) remap; gradient-shape stops remap; glow PNGs tinted with the host accent; baked `#00C950` vector fills now reference `@color/fc_accent`, so **host `fc_*` resource overrides** reach every painted colour (documented in versions/v2/android/INTEGRATION.md Step 6). With `showSettings=false` the host `appearance` is re-applied every init (core; compose shares it). Compile-verified (core + views + compose, core unit tests) and consumed by the Econet host build; NOT yet screenshot-verified on device. Residual: shape STROKE colours (e.g. focused-input border) follow resource overrides only — the builder can't read a GradientDrawable's stroke; compose/iOS/RN/web unchanged (iOS + RN ported 2026-10-09, see "Latest question pinned to the top") (their overlays already cover code paths). | ✅ `FarmerChatTheme` (SwiftUI `Color`/`Image`; colors+dark/shape/typography/logo) on `FarmerChatConfig.theme`; public `Color(hex:)` helper | ✅ single `FCTheme.applyHostOverrides` resolver overlays host colors(+optional dark)/shape onto the token layer (`FCBrandColors`/`FCContentColors`/`FCShapes`) — every screen recolors with **zero per-screen edits**; auto on-brand contrast + derived button/dark-tint; day/night still applies. **Screenshot-verified on iPhone 17 sim (blue host brand, Language + Home), 2026-07-20** (`scratchpad/themed_language.png`, `themed_home.png`). Typography `typeScale`/`fontName` exposed as `theme.font(...)` tokens but per-`.font(.system(size:))` call sites NOT swept (see debts) | ✅ same host theme overlaid onto `FCUITheme` tokens (brand/button/surface/accent) via a `hostColor` KeyPath resolver (Color→UIColor); compiles clean (not screenshot-run this pass) | ✅ `theme` on `FarmerChatConfig` → single `resolveTheme` in the SDK ctor overlays host colors(+optional dark)/shape/typography/logo onto `src/ui/theme.ts` and reassigns the live token bindings (`dayTheme`/`nightTheme`/`radius`/`typography`/`brandLogo`) — colors + text typography recolor every screen with zero per-screen edits (a few brand-literal spots repointed to theme); day/night applies (light-only host → dark brand derived). **Screenshot-verified on emulator (blue host brand, Language + Home)**. Limitation: shape radii baked into module-level `StyleSheet.create` keep defaults (only render-time token reads pick up shape) | ✅ `theme` on FarmerChatConfig → single `resolveThemeVars` overlays scoped `.fcsdk-*` CSS custom properties on the root container (inline style), so every screen recolors with no per-screen edits; day/night still applies (host may supply only light → dark derived); logo override via `LogoGlyph`. **Runtime screenshot-verified in headless Chromium** (blue host brand): Home + Language recolor, computed `--fc-appbar` = `#1565C0` (`scratchpad/web-29/30`, 2026-07-20) **v2 web 2026-10-08:** the resolver was rewritten onto compose's `--fc-c-*` roles (a port of HostTheme.kt `resolveBrandColors`/`resolveContentColors`); the screenshots above predate it. Re-verified in headless Chromium with the blue host palette (`fidelity.html?theme=blue`): band, app bars, buttons (host 12dp radius), pill, drawer surface and sign-up card recolor; drawer nav icons and composer buttons stay green, as in compose (untinted drawables / forced `LightContentColors`). |
| **C1 inline embeddable (`<FarmerChat inline/>`)** | n/a | ✅ `@Composable FarmerChatInline(modifier)` wraps FarmerChatRoot in themed shell | ✅ `FarmerChatFragment` (embeddable). **Runtime-verified on emulator (2026-07-20)**: hosted in a sample `InlineActivity` below host chrome — SDK journey fills the container, not full-screen (`scratchpad/andv-24-inline.png`) | n/a | ✅ `FarmerChatInlineView()` wraps the journey, fills its container (no full-viewport assumptions); binary-consumed by `ConsumerApp` (builds+launches from the .xcframework) | ✅ `FarmerChatViewController` usable as a child VC (hosted via `UIViewControllerRepresentable` in the sample) — confirmed | ✅ `<FarmerChatInlineView style/>` fills its container (flex root + host-passed style), not the screen; shares AppNavGraph with the full-screen `<FarmerChatView/>`. **Runtime-verified on the Android emulator (mock, 2026-07-20)**: rendered inside a bordered host card with host header/footer chrome around it — SDK content fills the container, no full-screen takeover (`scratchpad/rn-22-inline-embed.png`) | ✅ `inline` prop (+`mount(el,{inline})`) → `fcsdk-root--inline` fills the host container; no `vh/vw`/`position:fixed` viewport assumptions (overlays are `position:absolute` within the root) |
| **C2 authMode SDK_OTP\|HOST_TOKEN** | ✅ graph seeds `accessToken`(+`refreshToken`), marks OTP_VERIFIED; TokenAuthenticator host-mode → `tokenProvider`→`onSessionExpired` on 401 (skips guest/refresh grants) | ✅ (authenticated ⇒ OTP UI skipped) | ✅ (same, core-level) | ✅ `authMode`; HOST_TOKEN seeds `accessToken`(+`refreshToken`) at init → `session.markHostAuthenticated()` (skips OTP UI, `isAuthenticated`→true, name step skipped); `TokenRefresher` host-mode 401 → `tokenProvider`→`onSessionExpired` (no guest `send_tokens` fallback). Type-checked; not runtime-exercised | ✅ authenticated host-token ⇒ OTP/sign-up flow unreachable (drawer sign-up card gated by `isAuthenticated`) | 🟡 core wiring applies (host-token authenticated); UIKit auth screens not separately gated | ✅ `authMode`; HOST_TOKEN seeds `accessToken`(+`refreshToken`) or `tokenProvider` at init (skips phone/OTP UI, `isAuthenticated`→true, guest-init keeps host token & only harvests user_id/country); TokenAuthenticator host-mode 401 → refresh-token then `tokenProvider`→`onSessionExpired` (no guest send_tokens fallback). Type-checked; not runtime-exercised | ✅ `authMode`; HOST_TOKEN seeds `accessToken`(+`refreshToken`), marks authenticated (skips phone/OTP UI), and on 401 calls `tokenProvider`→`onSessionExpired` instead of the SDK refresh/guest grants. **Runtime-verified in headless Chromium**: OTP UI skipped, drawer shows no Sign up + Settings shows Log out (`scratchpad/web-34/35`) |
| **C3 mode + showSettings/History/Drawer/Weather/Ssfr** | ✅ config fields | ✅ all wired: CHAT_ONLY lands in fresh chat; `showDrawer` drops drawer; `showSettings`/`showHistory` gate drawer items; `enableWeather`/`enableSsfr` gate Home | ✅ all wired: CHAT_ONLY (`SplashFragment` gate + `NavRoutes.navigateChatOnly`) lands directly in a fresh Chat clearing the stack; `showDrawer=false` locks the drawer closed (`JourneyController.openDrawer` no-ops + `setDrawerLockMode`) and hides the Home/Chat hamburger; `showSettings`/`showHistory` gate the drawer rows; `enableWeather` gates the Home weather pill; `enableSsfr` gates the SSFR card (`HomeFragment` adapter submit). **Runtime-verified on emulator (mock/dev, 2026-07-20): CHAT_ONLY `andv-21-chatonly.png` (Splash→Chat, no onboarding), togglesoff `andv-23-togglesoff-home.png` (no hamburger, no weather pill), SSFR card renders when on `andv-08b-home-mock.png`.** | ✅ config fields (mode/showSettings/showHistory/showDrawer/enableSsfr; enableWeather pre-existing) | ✅ CHAT_ONLY routeFromSplash → fresh chat root; `showDrawer` suppresses overlay+`openDrawer`; `showSettings`/`showHistory` gate drawer rows; `enableSsfr` gates the Home SSFR card; `enableWeather` pre-existing. Type-checked (themed run exercised the default all-on path) | ✅ UIKit-native toggles wired: CHAT_ONLY `routeFromSplash` lands directly in a fresh Chat; `showDrawer` hides the Home hamburger + suppresses `openDrawer`; `showSettings`/`showHistory` gate drawer rows; `enableSsfr` gates the Home SSFR card; `enableWeather` pre-existing. Runtime-verified (mock; drawer/SSFR/CHAT_ONLY screenshots) | ✅ `mode=FULL_JOURNEY\|CHAT_ONLY` (CHAT_ONLY routeFromSplash + chat-close land in a fresh chat); `showDrawer` hides the Home hamburger; `showSettings`/`showHistory` gate drawer items; `enableWeather`/`enableSsfr` gate Home. **CHAT_ONLY runtime-verified on the Android emulator (mock, 2026-07-20)**: fresh launch routed Splash → Chat directly, no onboarding/home, onChatOpened fired (`scratchpad/rn-21-chat-only.png`) | ✅ `mode=FULL_JOURNEY\|CHAT_ONLY` (CHAT_ONLY lands in a fresh chat); `showDrawer` hides hamburger+drawer; `showSettings`/`showHistory` gate drawer items + `openScreen`; `enableWeather`/`enableSsfr` gate Home. **Runtime-verified in headless Chromium**: CHAT_ONLY lands directly in a fresh chat (`scratchpad/web-31`) |
| **C4 callbacks + programmatic API** | ✅ `FarmerChatHooks` dispatched from Analytics stream (onScreenView/onChatOpened/onMessageSent/onAnswerReceived/onError) + deterministic onSessionStart in initialize; `sendQuestion`/`openConversation`/`openScreen` on `FarmerChat` | ✅ (openScreen routes to Settings/History/Help) | ✅ (openScreen routing wired in NavRoutes) | ✅ semantic callbacks: onScreenView/onChatOpened via `AnalyticsDispatcher.screenViewed`; onMessageSent/onAnswerReceived/onError from `ChatViewModel`; onSessionStart once in `initialize`; programmatic `sendQuestion`/`openConversation`/`openScreen` on `FarmerChat` (pending targets). Type-checked | ✅ `openScreen` consumed by `FCRouter` (`pendingScreenTarget`→drawer routes); openChat pending target pre-existing | ✅ `openScreen` now consumed by `FarmerChatViewController` (`pendingScreenTarget` → `navigateDrawerRoute` home/chatHistory/settings/help/language); openChat pending target pre-existing; semantic callbacks fire from Core | ✅ callbacks onScreenView/onChatOpened (from Analytics.trackScreenView), onMessageSent/onAnswerReceived (useChat), onError (HttpClient final errors, code 0=transport), onSessionStart (session, once) — alongside raw onEvent; `FarmerChat`.sendQuestion/openConversation/openScreen queue a pending target consumed by the mounted graph. **Runtime-verified on the Android emulator (mock, 2026-07-20)** from the Metro console: onSessionStart, onScreenView (per screen), onChatOpened, onMessageSent, onAnswerReceived (real message_id) all fired; onError/programmatic API not separately exercised (type-checked) | ✅ callbacks onChatOpened/onMessageSent/onAnswerReceived/onScreenView/onError/onSessionStart (dispatched at source via Analytics/session/chat, alongside raw onEvent); `FarmerChat`/`FarmerChatSDK`.sendQuestion/openConversation/openScreen (queued until a root mounts). **Runtime-verified in headless Chromium**: all six semantic hooks fired (onScreenView per screen, onSessionStart, onChatOpened, onMessageSent, onAnswerReceived w/ real message_id, onError API+network) + 32 raw analytics events, captured from the console (2026-07-20) |
| **C5 stringOverrides (host wins) + forced locale** | ✅ LabelManager: host override → `${key}_${lang}` → `${key}_en` → English fallback → raw key; `locale` forces language + skips language screen | ✅ (all strings via labelManager) | ✅ same LabelManager resolution. **Runtime-verified on emulator (2026-07-20)**: `stringOverrides` visibly changed Home input tiles to "PHOTO✦/SPEAK✦/TYPE✦" over server labels (`scratchpad/andv-25-override-home.png`); `locale:"hi"` forced the language (skipped the Language screen → EnterName) and loaded the hi label set (copy differs from dev-default, `andv-25-override-language.png`) | ✅ `LabelManager`: host `stringOverrides[key]` → server `${key}_${lang}` → `${key}_en` → English fallback → raw key; `locale` forces language (`forcedLocale` + persisted `selectedLanguageCode`). **Unit-tested** (host-override precedence + forced locale; 12/12) | ✅ all strings via `fcLabel` → LabelManager (inherits C5) | ✅ all strings via `fcuiLabel` → LabelManager (inherits C5) | ✅ LabelManager resolution: host `stringOverrides[key]` → server `${key}_${lang}` → `${key}_en` → built-in English → raw key; `locale` forces the language code (wins over stored/onboarding). **Runtime-verified on the Android emulator (mock, 2026-07-20)**: `stringOverrides` visibly changed the Language screen — title "Pick your preferred language" + subtitle "Host override active — you can switch anytime" (over the server/English labels), incl. inside the inline embed (`scratchpad/rn-19-stringoverride.png`); `locale:'hi'` forced the language and **skipped the Language screen** entirely (Splash → EnterName, no Select-Language event, `scratchpad/rn-20-forced-locale.png`) | ✅ LabelManager resolution: host override → `${key}_${lang}` → `${key}_en` → English fallback → raw key; `locale` forces the language code and is not overridden by onboarding selection. **Runtime-verified in headless Chromium**: `stringOverrides` visibly change copy — app bar "AgriAssist", feed header "Your AgriAssist briefing", Language "Pick your language (host copy)" + "Continue with AgriAssist" (`scratchpad/web-32/33`). `locale` is wired (forces langCode) but not separately visible with the mock's label set, which ships no localized strings under the SDK's base keys |

## Fix — blank `country_code` blanked the language screen (2026-09-01)

**Symptom reported**: "nothing loading in ui for language & all screens".

**Root cause (verified against the live prod API, not inferred)**: `initialize_user` returns
`country_code: null` / `state: null` for a fresh guest whose IP the backend cannot resolve.
Endpoint #2 then rejects the blank value with **HTTP 400** `{"error": "Country code is required"}`.
400 is non-retryable per the root-CLAUDE.md invariants, so the language list failed silently to
empty — and because the language screen is the first screen, nothing downstream ever loaded.

The reference app guards this with a hardcoded fallback (`fc-compose`
`OnboardingSharedViewModel.kt:402` → `?: "KE"` / `?: "NY"`, and `:191` → `?: "IN"` / `?: "KA"` —
the app is internally inconsistent here, worth reporting upstream). The SDK had dropped the
guard on three of four platforms:

| Platform | Before | Status |
|---|---|---|
| android-core | `?: prefs.getString(USER_COUNTRY_CODE, "")` → `""` | was **broken** |
| ios-core | `?? prefs.string(.userCountryCode) ?? ""` → `""` | was **broken** |
| web | `store.getString(...) ?? ''` (never read the init response at all) | was **broken** |
| react-native | `?? 'IN'` | worked incidentally |

`?:` / `??` only catch `null`, never `""`, so even the persisted-preference hop could not save it.

**Fix**: added `defaultCountryCode` / `defaultStateCode` to `FarmerChatConfig` on all four
platforms (defaults `"IN"` / `"KA"`, host-overridable — an SDK cannot hardcode a deployment
country the way a single-program app can). Every call site now resolves
*init response → persisted pref → config default* with a **blank-safe** test at each hop, applied
to both the onboarding path and the Settings → Language chooser path (which had the same bug).

**Defaults are `"IN"` / `"Karnataka"`** — note the state is a *name*, not a code. Endpoint #2
matches `state` on the display name and uses it only to rank languages: verified live,
`state=Karnataka` returns `priority_view=[Kannada, English (India), Hindi]` while `state=KA`
returns `priority_view=[Hindi, English (India)]` with Kannada demoted to "All languages". Both
return the same five languages, so a code was never *broken* — just a worse first screen. See
docs/02 endpoint #2 param semantics.

**Verified 2026-09-01**:
- `?country_code=IN&state=Karnataka` returns a non-empty India group on **all five envs**
  (dev / stage / demo / prod / eks — 1 group, 5 languages each), so the default is safe
  everywhere, not just prod.
- No direct `countryWiseSupportedLanguages` / `getSupportedLanguages` call sites exist in
  `ios/FarmerChatSwiftUI`, `ios/FarmerChatUIKit`, `android-compose`, or `android-views` — all four
  UI packages route through the two Core view models fixed here, so the "via core" cells above are
  accurate.
- Per-platform checks per root CLAUDE.md §5 all passed:
  `:farmerchat-core:compileDebugKotlin` ✅, `swift build` ✅, `tsc --noEmit` (rn + web) ✅,
  `vite build` ✅.

**Adjacent inconsistency, NOT changed** (out of scope for this fix, tracked here so it is not
lost): `android-compose/util/Utils.kt:56` and `android-views/util/Ui.kt:31` fall back to `"ke"`
(Kenya) when `USER_COUNTRY_CODE` is blank, for the phone-picker flag. That default now disagrees
with `defaultCountryCode = "IN"`. Changing it would move the auth country picker's default, which
is a separate behavioural decision — raise it before touching it.

**Not changed**: endpoint constants and wire models were already character-for-character
identical to the app on all platforms — nothing needed re-integrating there.

## Fix — empty / blank home screen (2026-09-01)

**Symptom reported**: "why nothing loads on home screen".

Two independent causes, both verified against the live prod API.

### (a) Empty feed — the same null-location chain as the language bug

Endpoint #12 is **gated on a resolved location**. A guest with `country_code: null` gets HTTP 200
`{"sections": [], "ssfr_enable": false}` with no `greeting` — an empty feed, not an error, so no
error state ever shows. Verified: guest init **with** `lat`/`long` returns
`country_code: IN, state: Karnataka` and a **21-section** feed; **without** them, on an
unresolvable IP, `country_code: null` and **0 sections**. `update_user_location` (#11) repairs it
after the fact, and coordinates alone are enough — the backend reverse-geocodes, so the
`{lat, long, user_id}` body that iOS and web already send is sufficient.

**react-native had the ordering inverted.** `useOnboarding.ts` called
`sdk.session.ensureGuestSession()` with **no arguments** and ran `geolocate()` *afterwards*,
storing coords that guest init had already missed. `ensureGuestSession` no-ops once a session
exists, so the first (and only) guest init was permanently coordinate-less → null country →
empty home feed forever. Android, iOS and web already geolocate first and pass the coords in, matching
the app. **Fixed**: RN now geolocates first and passes `{lat, long, accuracy}` into guest init.

| Platform | geolocate → guest-init order | |
|---|---|---|
| android-core | geo first, coords passed | was correct |
| ios-core | geo first, coords passed | was correct |
| web | geo first, coords passed | was correct |
| react-native | **init first, geo after, coords dropped** | **fixed** |

### (b) 14 blank cards — unfiltered `plotline_widget` sections

`plotline_widget` sections carry **only** `type`, `unique_key`, `label` — no headline, image or
statement id. In prod they were **14 of 21** sections. The app renders them with
`PlotlineComposeWidget` (`ui/home/HomeScreen.kt:1091`) and skips them in card analytics (`:792`);
root CLAUDE.md §6 forbids Plotline inside SDK packages, so the SDK must **drop** them.

`android-compose` and `android-views` had no `plotline_widget` case — the `else ->` catch-all
rendered each as a `ContentCard` with an empty headline, no image and no badge. That is a wall of
blank boxes, which is what "nothing loads on home" looked like. react-native and web were already
filtering in their render paths, but still **counted** the widgets in `DASHBOARD_VIEWED` /
`CARD_SHOWN` analytics, diverging from the app.

**Fixed**: added one filter at the model layer on every platform —
`HomeUdfResponse.renderableSections()` (Kotlin / Swift) and `renderableSections()` in
`core/types.ts` (RN / web) — and routed **both** the render paths and the analytics paths through
it, so the exclusion cannot be forgotten in one renderer.

| Platform | Before | |
|---|---|---|
| android-compose | catch-all rendered 14 blank ContentCards | **fixed** |
| android-views | same catch-all via adapter | **fixed** |
| react-native | filtered when rendering; counted in analytics | **fixed (analytics)** |
| web | filtered when rendering; counted in analytics | **fixed (analytics)** |

**Not changed**: home wire models already matched the live response exactly (`type`, `id`,
`image_url`, `title`, `question_text`, `statement_id`, `badge{icon,count,show}`,
`cta{text,action}`, `is_viewed`, `meta{...}`, plus top-level `greeting` / `ssfr_enable`).

**Verified 2026-09-01**: `:farmerchat-core:` + `:farmerchat-android-compose:` +
`:farmerchat-android-views:compileDebugKotlin` ✅, `swift build` ✅, `tsc --noEmit` (rn + web) ✅,
`vite build` ✅.

### (c) Permanent greeting skeleton on a loaded-but-empty feed

The #12 response omits the `greeting` key entirely when the feed is empty. `android-compose` and
`react-native` rendered `greeting != null ? Text : Skeleton`, so a *successfully loaded* empty feed
left a shimmer bar at the top of the screen forever — the most literal reading of "nothing loads
on home". The app never hits this because it does not use the API greeting at all: `fc-compose`
`ui/home/HomeScreen.kt:892-893` reads the
`fc_v2_app_label_get_started_by_clicking_on_photo_speak_or_type_to_ask_your_question` label and has
the response greeting commented out.

**Fixed** on android-compose and react-native: prefer the API greeting when non-blank, else that
label; the skeleton now shows only while the feed is genuinely loading.

| Platform | Greeting when API omits it | |
|---|---|---|
| android-compose | permanent skeleton | **fixed** |
| react-native | permanent skeleton | **fixed** |
| android-views | already seeded from the label in `renderStaticTexts()` | was correct |
| ios-swiftui | already falls back to `fcLabel("home_greeting")` | was correct |
| web | already falls back to `label('home_greeting_fallback')` | was correct |

### Verified section-type behaviour

Confirmed by dumping each type from the live prod feed (not inferred from the key union):
- `statement` (2 of 21) carries `title`, `question_text`, `statement_id`, `cta`, `meta` — it renders
  as a real content card through the Android catch-all and is **not** broken. No platform has an
  explicit `statement` branch; behaviour is correct, so none was added.
- `question` (2 of 21) carries `statement`, `selection_type`, `options[]` (e.g. the gender card) and
  is handled by an explicit branch on every platform.

### ⚠ Precondition this fix does NOT remove: `geoApiKey`

Coordinates reach guest init only via Google `geolocate`, which every platform skips when
`FarmerChatConfig.geoApiKey` is unset (Android: `FetchGeoLocationUseCase` returns an error without
it; iOS: `FarmerChatAPI.swift:425` returns `"Missing geoApiKey"`). **With no `geoApiKey`, guest
init falls back to backend IP geolocation** — which is what returned `country_code: null` in every
probe from this machine. On a host that does not set `geoApiKey`, and whose users are on IPs the
backend cannot resolve, the home feed will still be empty and no code change here prevents that.

Hosts embedding the SDK **must** set `geoApiKey`, or accept IP-only location. Not auto-recovered
today: the SDK does not call `update_user_location` (#11) on its own when guest init comes back
with a null `country_code` — that call only happens through the location-permission prompt. A
follow-up worth considering is firing #11 automatically once coordinates become available from any
source. Tracked here rather than implemented, because it changes when a permission-gated call runs.

## Fix — chat history click crashed the host app (2026-09-01)

```
java.lang.IllegalArgumentException: Key "msg_31e2a14b-…" was already used.
If you are using LazyColumn/Row please make sure you provide a unique key for each item.
```

**Root cause (verified live, not inferred):** a query and its response **share one
`message_id`**. Endpoint #32 returns a single turn as three items — `message_type_id` 1 (query),
3 (response) and 7 (follow-ups) — all carrying the *same* `message_id`. Every platform mapped the
bubble id straight from it (`id = item.message_id`), so types 1 and 3 produced two messages with
identical ids. Compose hard-crashes on a duplicate `LazyColumn` key; React silently corrupts list
identity. This fired on **every conversation with at least one turn**.

`?:` / `??` fallbacks did not help — they only trigger when `message_id` is null, and it never is.

**Fix** (all four platforms): key on `message_id + message_type_id + page + index`, matching the
app (`fc-compose ChatViewModel.kt:1027`, which uses `message_id + message_type_id + index`; `page`
is added because the index restarts per page and older pages are prepended). `messageId` still
carries the raw API id for TTS (#31) and follow-ups (#29). A `distinctBy`/`dedupeById` guard was
added at every page-merge point as well — a duplicate key takes the HOST app down, so the wire is
never trusted here.

| Platform | Before | After |
|---|---|---|
| android-core (+compose/views) | `id = item.message_id` → **hard crash** | ✅ unique id + `distinctBy` |
| ios-core | `idBase = messageId` → broken list identity | ✅ unique id + dedup filter |
| react-native | `id: item.message_id ?? …` | ✅ unique id + `dedupeById` |
| web | `id: item.message_id ?? …` | ✅ unique id + `dedupeById` |

**Pagination checked while here**: out-of-range pages return `{"data": []}` (verified pages 2, 3
and 99 on a one-turn conversation), so the `items.isNotEmpty() → page + 1` guard terminates
correctly on all four platforms. No infinite-append loop.

**Verified on a real device** (motorola edge 60 fusion, API 36) inside RationSmart: a conversation
whose history genuinely contains duplicate `message_id`s was opened from Past Advice — the thread
rendered in full, `FATAL EXCEPTION`/`was already used` count **0**, process pid unchanged.

## Fix — chat input row did not match the app (2026-09-01)

Two differences, both on `android-compose`:

1. **Icon tint.** The SDK applied `ColorFilter.tint(brandColor.foregroundSecondary)` to the
   Photo/Speak/Type icons; the app applies none. Both apps' vectors already carry
   `fillColor="#00C950"`, so the tint was overriding the intended green with a flat secondary
   colour. Removed — verified the drawables are self-coloured first, so they do not vanish.
2. **Show/hide behaviour.** The app never adds/removes this row: it **slides** it 150.dp down over
   450ms while an answer is generating (`ChatThreadContent.kt:151`) and slides it back. The SDK
   hard-removed it with `if (!textComposerActive)`, so it popped in and out. Now it slides with
   the app's exact animation, and the SDK's own composer rule (the text composer carries its own
   camera/mic) is applied through the same slide instead of a removal.

## Sample apps — demo surface reduced (2026-09-01)

Per request, the host-demo surface is **Launch journey + Open chat + FAB** only. "Embed inline"
and "Logout" are hidden, not deleted — `InlineActivity` and `FarmerChat.logout()` remain public
API and reachable in code.

| Sample | Change |
|---|---|
| `android/sample-compose` | "Embed inline (composable)" + "Logout" buttons removed from MainActivity |
| `android/sample-views` | `inlineButton` + `logoutButton` set `visibility="gone"` (kept so findViewById bindings stay valid) |
| `android/sample-jetpack` | "Open embedded assistant (inline component)" button removed; FAB is the surface |
| `ios/SampleApp` | "Log out" row removed from the Session section |
| `android/sample-consumer` | already only Launch + Open chat — unchanged |
| `react-native/example`, `web/example` | no such buttons — unchanged |

## Fix — guest home screen was permanently empty (2026-09-01)

**Requirement**: a guest must never land on a blank home screen.

Endpoint #12 is gated on the backend having a resolved location for the user, and the decisive
finding is **how** it can be resolved. Verified live on a fresh guest:

| Attempt | Result |
|---|---|
| `initialize_user` with no coords, IP unresolvable | `country_code: null` → **0 sections** |
| `update_user_location` with `{user_id, country: "India", level_2: "Karnataka"}` | profile stays empty → **0 sections** |
| `update_user_location` with `{user_id, lat, long}` | profile resolved → **21 sections** |

**Coordinates are the only thing the backend accepts.** A country name is rejected, so no
config value alone could fix this — the SDK has to post a real lat/long.

**Fix**: added `defaultLatitude` / `defaultLongitude` to `FarmerChatConfig`. When guest init
returns a blank `country_code`, the SDK posts fallback coordinates to #11 before loading the feed,
so the home screen is populated for every guest regardless of GPS permission or `geoApiKey`.
Best-effort: a failure leaves the feed empty, i.e. the previous behaviour, and never blocks
onboarding.

> **SUPERSEDED in part (2026-09-03).** This fix originally shipped a hardcoded default of
> `12.9716, 77.5946` (Bengaluru, pairing with `IN`/`Karnataka`). That was wrong — see
> "Fix — hardcoded fallback location replaced with the app's device-locale derivation" below.
> The seeding behaviour described here is unchanged; only where the coordinates come from changed.

| Platform | Status |
|---|---|
| android-core (+compose/views) | ✅ `seedDefaultLocation()` in `OnboardingSharedViewModel` |
| ios-core | ✅ `seedDefaultLocation()` in `OnboardingViewModel` |
| react-native | ✅ in `useOnboarding.bootstrapLanguages` |
| web | ✅ in `useOnboardingLanguage.bootstrap` |

**Known gap, tracked not fixed**: this runs on the onboarding path. A host launching straight
into `CHAT_ONLY` skips onboarding and therefore skips the seed — same shape as
`[[chat-only-guest-bootstrap]]`. Also, iOS's `GetLocationResponse` models only the flat
`country`/`state` fields while the live #11 response nests everything under `user_profile`, so
iOS cannot persist the resolved values (the call still sets the location server-side, which is
what unblocks the feed).

## Fix — hardcoded fallback location replaced with the app's device-locale derivation (2026-09-03)

The guest-home fix above shipped a **hardcoded Bengaluru** fallback — `defaultLatitude = 12.9716`,
`defaultLongitude = 77.5946`, plus an invented `defaultCountryCode = "IN"` and
`defaultStateCode = "Karnataka"`. Consequence: every guest the backend could not place — anywhere
on earth — was seeded with Karnataka and got Karnataka's advice.

**The app has no hardcoded coordinates.** On IP-geolocation failure it calls
`CountryLatLngProvider.getLatLngFromDeviceLocale(context)` (app `utils/CountryLatLngProvider.kt`),
takes that country's centroid, and accepts it **only when `lat != 0.0 && lng != 0.0`**.

**Fix**, on every platform:

- The three config defaults became sentinels meaning *"unset → derive"*: country `""`, state `""`,
  lat/lng `0.0`. **No coercion** back to a literal — an empty value stays empty. A host that sets
  any of them explicitly still wins.
- A last-resort country constant (`LAST_RESORT_COUNTRY_CODE` / `lastResortCountryCode` = `"KE"`)
  exists only because endpoint #2 **400s on a blank `country_code`** (verified live 2026-09-03 on
  prod: `{"error": "Country code is required"}`). `"KE"` is the app's own literal on its primary
  guest-init path, and dev/stage/prod/eks all return Kenya only (verified live 2026-09-03).
- Country fallback chain: server `country_code` → persisted → host config (if non-blank) →
  **device-locale region** → `"KE"`.
- Geo-failure path: falls back to the device locale's centroid, used **only if `isResolved`**. The
  centroid is deliberately **not** persisted as the user's location — it is not a real fix and
  writing it would leak a fake precise location into every later read. It only feeds guest init.
- Seed path (#11): posts the resolved fallback; if nothing resolves it **sends nothing at all**.
  `(0,0)` is a real point in the Gulf of Guinea — sending it is a wrong answer, not a missing one.
- The `state` default is now empty and must stay so: the #2 `state` param is **inert** on every
  environment (`Karnataka`, `KA`, blank and omitted all return the identical set — verified live
  2026-09-03). Do not reinstate `"Karnataka"`.

The 247-entry centroid table is **generated verbatim** from the app source on every platform and
must be regenerated, never hand-edited — a wrong centroid fails silently.

**Web-specific**: a browser language such as plain `en` carries **no region**, so
`regionFromLocaleTag` returns `''` and the centroid is `[0, 0]` — that is the unknown-country case
and takes the send-nothing branch. A language is never guessed into a country. Web also reaches the
locale fallback when the host configured **no `geoApiKey`** (so `geolocate` was never called at
all), which is the same "no coordinates" state Android reaches on a failed call; `geoState` is left
`idle` in that case, because a call that was never made is not a failed call.

| Platform | Status |
|---|---|
| android-core (+compose/views), v1 + v2 | ✅ `core/location/CountryLatLngProvider.kt` (247 entries, generated) + `FarmerChatConfig.resolvedFallbackCountryCode()` / `resolvedFallbackCoordinates()`, used by all five call sites (onboarding geo-failure branch, country chain, #11 seed, settings chooser, graph label bootstrap); **9 unit tests** — `CountryLatLngProviderTest` 5 + `FallbackCountryTest` 4. The country resolver is split into a `Context`-free `internal` overload taking the locale region, so the never-blank invariant is testable without mocking `Context` |
| ios-core (+SwiftUI/UIKit), v1 + v2 | ✅ `Utils/CountryLatLngProvider.swift`, `FarmerChatConfig.resolvedFallbackCountryCode` / `resolvedFallbackCoordinates`, geo-failure `else` branch + `isResolved` guard in `seedDefaultLocation()`; 9 unit tests |
| react-native, v1 + v2 | ✅ `core/countryLatLng.ts` (247 entries, generated) + `LAST_RESORT_COUNTRY_CODE`/`COORDINATE_UNSET`/`resolveFallbackCoordinates()`/`resolveCountryCode()` in `core/config.ts`; wired into `useOnboarding.bootstrapLanguages` (geo-failure branch + #11 seed) and `useSettings.loadLanguages`; 12 out-of-tree assertion groups (no test runner added) |
| web, v1 + v2 | ✅ `core/countryLatLng.ts` (247 entries) + new `core/fallbackLocation.ts` (`resolveFallbackCoordinates` / `resolveCountryCode`); wired in `useOnboardingLanguage.bootstrap` (geo-failure branch **and** the #11 seed) and in `useSettingsLanguage.loadLanguages`; 44 assertions in `test/countryLatLng.test.ts`. Verified in both trees: `tsc --noEmit`, `tsc -p tsconfig.test.json --noEmit`, `vite build`, `npm test` all clean. |

**Public API change** (docs/03): the four `FarmerChatConfig` static fallbacks
(`defaultCountryCodeFallback`, `defaultStateCodeFallback`, `defaultLatitudeFallback`,
`defaultLongitudeFallback` on iOS; equivalents elsewhere) were **removed** and replaced by
`lastResortCountryCode`, `defaultStateCodeUnset` and `coordinateUnset`. The instance field names
and types are unchanged, so hosts that only *set* config are unaffected; a host that *read* a
static fallback must migrate. No in-repo sample referenced them.

**Web is the exception, deliberately**: `DEFAULT_COUNTRY_CODE`, `DEFAULT_STATE_CODE`,
`DEFAULT_LATITUDE` and `DEFAULT_LONGITUDE` are **kept as names** in
`web/.../src/core/config.ts` and re-pointed at the unset sentinels (`''`, `''`,
`COORDINATE_UNSET`, `COORDINATE_UNSET`), so nothing that imported them breaks. React-native
dropped its `DEFAULT_LATITUDE`/`DEFAULT_LONGITUDE` and uses `?? COORDINATE_UNSET` inline instead.
Both are correct; the shape differs only in whether the old names survive as aliases.

### Known gaps, tracked not fixed

| Gap | Where |
|---|---|
| ~~The settings language chooser reads `config.defaultCountryCode` **raw**, so with the new empty default it can send a blank `country_code` and 400.~~ **CLOSED on all four platforms 2026-09-03.** Found independently by the iOS, react-native and web ports — a genuine regression introduced by making the default empty. Android was the last one open and is now fixed too: `FarmerChatConfig` gained `resolvedFallbackCountryCode(Context)` / `resolvedFallbackCoordinates(Context)`, and **all five** Android call sites route through them (settings chooser, the graph's label bootstrap, and three in onboarding) in BOTH trees. Guarded by `FallbackCountryTest` (4 tests), whose load-bearing assertion is that the resolved country is **never blank** | `android/farmerchat-core/src/main/java/org/digitalgreen/farmerchat/sdk/core/ui/settings/SettingsViewModel.kt:45` and `versions/v2/android/.../core/ui/settings/SettingsViewModel.kt:45` |
| The checked-in prebuilt `ios/dist` xcframework (v1 tree, consumed via `Package.binary.swift`) still carries the OLD Bengaluru default. Source consumers get the fix immediately; **binary consumers do not until `ios/build-xcframework.sh` is re-run** | `ios/dist`, `ios/Package.binary.swift` |
| iOS applies the locale fallback for **both** a failed geolocate and a success carrying no `location`; Android's branch is keyed on `ApiResult.Error` only, so success-with-null-location still proceeds with no coordinates | `OnboardingSharedViewModel.fetchGeoAndInitialize` (android, both trees) |
| The mock backend always returns a non-null `country_code`, so a green mock E2E is **not** evidence this path works — see docs/08 | all platforms |

## Fix — composer hidden behind the keyboard (2026-09-01)

"I am not able to see what I type." `TextInputOverlay` is bottom-aligned inside a `fillMaxSize`
Box, so under edge-to-edge + `adjustResize` it sits at the **raw screen bottom — behind the IME**.
The app passes `Modifier.imePadding().navigationBarsPadding()` at both of its call sites
(`ChatInputOverlays.kt:49`, `HomeScreen.kt:1276`); the SDK passed no modifier at all, so the
default `Modifier` applied neither.

**Fixed** on `android-compose` Chat and Home. `navigationBarsPadding()` also keeps the composer
clear of the gesture bar when the keyboard is closed.

## Fix — side menu order did not match the app (2026-09-01)

The **views** drawer (`fc_drawer.xml`) had a different structure from the app and from the SDK's
own Compose drawer:

| | App / Compose SDK | views SDK (before) |
|---|---|---|
| Order | Home → Language → Settings → Help → divider → Recent chats → Sign up | Home → Recent chats → divider → Settings → Language → Help → Sign up |

The nav items were split across the divider and Settings preceded Language. `fc_drawer.xml` now
matches the app: all four nav rows together, then the divider, then recent chats.

## Voice recording — checked, no difference found

Compared against `fc-compose` and found **identical** on every axis: `MediaRecorder` with
OGG/OPUS above API 28 and MPEG_4/AAC below, `AudioSource.MIC`, 48 kHz sampling, 30 s cap
(`AppConstants.MAX_AUDIO_DURATION_SEC` = SDK `MAX_RECORDING_SECONDS` = 30), 36 waveform bars at
the call site, and the same label keys and Delete/Waveform/Send row. Both use synthetic
amplitudes rather than `getMaxAmplitude()`. **No change made** — the reported difference could
not be reproduced from the code, so it needs a specific description of what looks wrong.

## Cross-platform audit of the 2026-09-01 fixes

Asked directly whether every fix landed on every platform. Audited by grep + a live key
intersection rather than from memory. Honest result: **most did, two did not.**

| Fix | android | ios | react-native | web |
|---|---|---|---|---|
| `defaultCountryCode` / `defaultStateCode` blank guard | ✅ | ✅ | ✅ | ✅ |
| `state` = display name, not ISO code | ✅ | ✅ | ✅ | ✅ |
| `plotline_widget` filtered (render + analytics) | ✅ | ✅ | ✅ | ✅ |
| Unique history bubble ids + dedupe guard | ✅ | ✅ | ✅ | ✅ |
| Guest home: seed #11 with default coords | ✅ | ✅ | ✅ | ✅ |
| `defaultLatitude` / `defaultLongitude` knobs | ✅ | ✅ | ✅ | ✅ |
| Greeting falls back to label | ✅ | ✅ was already correct | ✅ | ✅ was already correct |
| geolocate BEFORE guest init | ✅ was correct | ✅ was correct | ✅ **fixed** | ✅ was correct |
| Drawer order (Home → Language → Settings → Help → divider → recent) | ✅ **fixed (views)** | ✅ **fixed** | ✅ **fixed** | ✅ **fixed** |
| Composer lifted above the IME | ✅ **fixed** (`imePadding`) | ✅ SwiftUI handles it | ✅ **fixed** (`behavior` was a no-op on Android) | ✅ browser handles it |
| Chat input icon tint removed | ✅ **fixed** | n/a — no tint override | n/a | n/a |
| Composer slide (150.dp / 450 ms) | ✅ **fixed** | ⛔ **NOT PORTED** | ⛔ **NOT PORTED** | ⛔ **NOT PORTED** |

### ⛔ Major pre-existing gap found during this audit: iOS and web never localize

`LabelManager` resolves `"\(baseKey)_\(lang)"` → `"\(baseKey)_en"` → hardcoded fallback. The
server's keys are all `fc_v2_app_label_*`. Intersecting each platform's key set against the 276
base keys returned live by endpoint #3:

| Platform | distinct keys used | match the server | |
|---|---|---|---|
| Android | 229 | **222** | 96% — localization works |
| iOS | 127 | **1** | **0%** |
| web | 147 | **0** | **0%** |

iOS and web use invented keys (`drawer_language`, `help_title`, `account_benefits_cta`, …) that
exist nowhere in the API response, so **every string falls through to its hardcoded English
fallback and the UI stays English no matter which language the user picks.** This violates root
CLAUDE.md §2 ("user-visible text … always resolved through LabelManager").

**Not fixed here — deliberately.** Remapping ~270 literals is mechanical but only ~50% can be
resolved automatically: joining each call's English fallback text against the server's `_en`
values matches 63/126 on iOS and 68/142 on web. The remaining half have reworded fallbacks and
need a human to choose the right key, and guessing would silently show farmers the wrong string.
This should be its own focused task.

## Feature — land a fresh install straight on Home (2026-09-01)

Asked whether the FAB could open Home instead of onboarding on a fresh install,
without touching geolocation or the API flow. It can. `routeFromSplash()` checks exactly two
gates before Home:

1. `isLanguageSelected()` — already clearable via the existing C5 `config.locale`, which sets
   `LANGUAGE_DONE`.
2. `!isProfileDone() && !hasSeenNameScreenOnce()` — gated on `showNameScreen`, which
   `RouteDecider` already modelled as a constructor lambda but the graph hard-coded to `{ true }`.

**Added** `FarmerChatConfig.showNameScreen` (default `true`, so no behaviour change for existing
hosts) and wired it into `RouteDecider`. `locale` + `showNameScreen(false)` now lands Home.

**The correctness catch**: the language screen is also the only caller of #3 `get_labels` and
#6 `set_preferred_language`. Skipping it left a fresh install with zero server labels — every
string falling back to its hardcoded English — and a backend that never learned the user's
language. Added `FarmerChatGraph.ensureSkippedOnboardingBootstrap()`, called from both splash
implementations, which runs that work headlessly: guest init → #2 languages → resolve the
configured code to its id → #3 labels → #6 preferred language. Best-effort and idempotent — it
no-ops once labels exist, and any failure just leaves the English fallbacks, i.e. the
pre-existing behaviour, so it can never block the splash.

**Verified on device** (motorola edge 60 fusion, API 36, RationSmart, STAGE) after a clean
uninstall/reinstall: `Splash Screen → Dashboard Screen`, no language screen, no name screen;
prefs show `is_language_screen_done=true`, `is_name_screen_done=true`,
`is_language_labels_loaded=true`, `language_selected_id=1`, and **275** `fc_v2_app_label_*`
entries stored.

| Platform | Status |
|---|---|
| android-core (+compose/views) | ✅ `showNameScreen` knob + headless bootstrap |
| ios / react-native / web | ⛔ **NOT PORTED** — `locale` already skips the language screen on those platforms, but they have no `showNameScreen` knob and no headless label bootstrap, so a fresh install there would still hit the name screen and run on English fallbacks. |

## 2.0.0 — agentic streaming chat (started 2026-09-02)

Source of truth: `fc-compose-agentic` @ `c0524dd6` (app v4.1.2). See `versions/v2/README.md`.

> **The table immediately below is a SUPERSEDED early snapshot**, kept for history — it was taken
> when only android-core and android-compose existed. Its ⛔ cells for ios / react-native / web are
> no longer true. The authoritative status is
> ["2.0.0 status after the parallel build-out"](#200-status-after-the-parallel-build-out-2026-09-02)
> further down this file.

| Piece | android-core | android UI | ios | react-native | web |
|---|---|---|---|---|---|
| `AgenticEvent` model + payloads | ✅ | n/a | ⛔ | ⛔ | ⛔ |
| `AgenticChatDataSource` (SSE reader) | ✅ | n/a | ⛔ | ⛔ | ⛔ |
| Dedicated no-read-timeout client | ✅ | n/a | ⛔ | ⛔ | ⛔ |
| `enableAgenticChat` config flag | ✅ | ✅ (via core) | ⛔ | ⛔ | ⛔ |
| Streaming send path in ChatViewModel | ✅ | ✅ (via core) | ⛔ | ⛔ | ⛔ |
| `AiResponse` streaming fields | ✅ | ✅ (via core) | ⛔ | ⛔ | ⛔ |
| Streaming UI (live text, tool status, error card) | n/a | ✅ compose · ⛔ views | ⛔ | ⛔ | ⛔ |
| `alignments` wire model + `AlignmentKind` | ✅ | ✅ (via core) | ⛔ | ⛔ | ⛔ |
| Alignment state on `AiResponse` + finalize wiring | ✅ | ✅ (via core) | ⛔ | ⛔ | ⛔ |
| `AlignmentSurface` UI (chips, escalate treatment) | n/a | ✅ compose · ⛔ views | ⛔ | ⛔ | ⛔ |
| `Chip` (Suggested / Agentic / Escalate) | n/a | ✅ compose · ⛔ views | ⛔ | ⛔ | ⛔ |
| `InputComposer` (unified composer bar) | n/a | ✅ compose · ⛔ views | ⛔ | ⛔ | ⛔ |
| `ShimmerText` | n/a | ✅ compose · ⛔ views | ⛔ | ⛔ | ⛔ |
| `MarkdownText` v2 (tables, header scale) | n/a | ✅ compose · ⛔ views | ⛔ | ⛔ | ⛔ |
| `Sunbeams`, `SectionHeader` | n/a | ✅ compose · ⛔ views | ⛔ | ⛔ | ⛔ |
| `LocationChatBubble`, `LocationButton` | n/a | ✅ compose · ⛔ views | ⛔ | ⛔ | ⛔ |
| `TermsOfUseDialog` | n/a | ✅ compose · ⛔ views | ⛔ | ⛔ | ⛔ |
| `StreamErrorCard` + retry | n/a | ✅ compose · ⛔ views | ⛔ | ⛔ | ⛔ |
| Stall hint ("Paused, resuming…", 4 s) | n/a | ✅ compose · ⛔ views | ⛔ | ⛔ | ⛔ |

**Opt-in.** `enableAgenticChat` defaults to **false**, so on 2.0.0 artifacts a host that does
nothing keeps the 1.0.0 synchronous contract (#27) byte-for-byte. Nothing about the existing chat
path changed.

**Design note.** Finalization routes the `metadata` event back through the *existing*
`handleTextPromptResult`. That event carries a `TextPromptResponse` — the same shape #27 returns —
so analytics, TTS gating, follow-ups (#29) and first-query marking are shared with the synchronous
path rather than reimplemented. Only text accretion is new code.

### ⚠ Not verified against a live stream

The endpoint opens but has never been observed emitting an event: a guest with language, location
and a conversation received **0 bytes** on dev, stage and prod (docs/05). The reader is
deliberately permissive — it accepts both `data:`-prefixed SSE and bare NDJSON, and resolves the
type from an `event:` line or a `type` field.

Because the wire cannot be exercised, the mapping is pinned by **14 unit tests**
(`AgenticEventParsingTest`) covering both framings, the delta aliases, terminal `metadata`/`done`,
typeless-payload recovery, and malformed JSON. All pass.

Writing them surfaced a real defect: the parser's failure path calls `android.util.Log.w`, which
throws "not mocked" under JVM unit tests — so the one path that must never take down the chat was
the one path that could not be tested. Fixed with `testOptions.unitTests.isReturnDefaultValues`.

**The stream consumer is a faithful port, second pass.** The first version was my own design and
was wrong in ways that mattered. Re-read against the app's `consumeAgenticStream`
(ChatViewModel.kt:1444) and corrected:

| Missed first time | Why it matters |
|---|---|
| `sanitizeStreamingText` | The stream carries control tokens (`<<commodities:chickpea>>`, a ```` ```followups ``` ```` block) absent from the clean `metadata.response`. Without stripping, the farmer watches raw tokens type themselves into the answer. |
| Reusing `placeholderId` as the stream id | The loading bubble becomes the answer bubble in place; my version removed and re-inserted, which flickers. |
| `TOOL_STATUS_MIN_DWELL_MS` (700 ms) | Back-to-back tool events are otherwise collapsed by StateFlow conflation into just the last one, so the farmer never sees the earlier steps. |
| Clean EOF with partial text is **not** an interruption | Some backends stream deltas with no `done`/`metadata`. Flagging that interrupted would make every normal answer on such a backend look broken. |
| `done` arriving before a transport drop still finalizes | The model finished; the answer should not be discarded because the socket closed after. |

`sanitizeAgenticStreamText` is covered by **9 further unit tests** including the mid-stream cases
(a half-arrived `<<comm`, an unterminated fence), since tokens arrive character by character.
Totals: **23 unit tests, all passing.**

### Compose streaming UI (2026-09-02)

Ported from the app's `ChatThreadContent.kt:405-495`. Four behaviours, each of which only exists
because the answer is now partial for a while:

| Behaviour | Why |
|---|---|
| Screen-height reserve while streaming | The answer grows in place; without it the list clamps the question downward as text arrives. Also held for the interrupted state so the error card sits near the top. |
| Typewriter reveal **disabled** while streaming | The text is already arriving a token at a time — animating it again double-types it. |
| Tool-progress spinner | Shown when there is no text yet, or a tool status is set. |
| Stall hint after 4 s | Text flowing but no status → a transient "Paused, resuming…". Client-side only, NOT a failure; keyed on `text.length` so the next delta clears it. |
| `StreamErrorCard` on the latest answer only | An older failed question keeps its partial text but drops the retry action, so retry always means "the newest one". |

The card's copy is driven by both `errorKind` and `hasPartial` — "connection stopped, your partial
answer is saved" is a materially different message from "nothing arrived", and it tints from
`feedbackFail` so a themed host gets its own failure colour.

**Ten labels are not on the server — not two.** Corrected 2026-09-02 against a LIVE endpoint #3
probe on stage (guest token via `initialize_user`; `language=1` and `language=2` both return 283
entries). The earlier "two" was an undercount.

Server keys carry the language suffix (`${key}_${lang}`, e.g. `fc_v2_app_label_my_farm_en`), so a
naive comparison of bare SDK keys against the response reports **every** key as missing. Any future
audit must strip the suffix first. Of the 256 keys the SDK declares, 246 are served and these 10
are not:

```
fc_v2_app_label_cant_load_right_now
fc_v2_app_label_connection_stopped_partial_saved
fc_v2_app_label_failed_to_load_chats
fc_v2_app_label_no_camera_app_available
fc_v2_app_label_no_chats_yet
fc_v2_app_label_permissions_are_required_to_auto_detect_sim_number.   (trailing "." is the app's)
fc_v2_app_label_response_paused_resuming
fc_v2_app_label_storage_exceeded
fc_v2_app_label_this_permission_is_needed_for_the_app_to_function_properly_please_enable_it_in_your_device_settings
fc_v2_app_label_user_cancelled_or_provider_error
```

All ten exist in the app's own `Labels.kt`, so none is an SDK invention — the app relies on English
fallbacks for them too. Impact is **localization only, never a raw key on screen**: 7 of the 10 are
used and every call site passes an English fallback (each verified, including the multi-line calls);
`LabelManager.getLabel` ends in `englishFallback.ifBlank { baseKey }`, so an omitted fallback WOULD
have shown a farmer the literal `fc_v2_app_label_storage_exceeded`. The other 3 —
`PERMISSIONS_ARE_REQUIRED_TO_AUTO_DETECT_SIM_NUMBER`, `STORAGE_EXCEEDED`,
`USER_CANCELLED_OR_USER_PROVIDER_ERROR` — are declared but never used.

Cached response used for the first (wrong) count: 276 keys. Live stage now serves 283, so re-probe
rather than trusting a cache. Snapshot kept at `scratchpad/labels_stage_en_20260902.json`.

### `InputComposer` port (2026-09-02)

The v2 composer replaces v1's `TextInput` + `PrimaryInputButtons` pair with a single bar:
camera / text field / mic-or-send, in floating (Home) or anchored (Chat) mode, with rotating
placeholders, an ambient gradient aura, IME-aware seating and single-image attachment.

Ported by **copying the app file and remapping its dependencies**, not by rewriting it. The
first agentic attempt was a from-scratch design and diverged in five visible ways; a 737-line
animated component would diverge far worse. Fidelity checked structurally rather than by eye:

| Check | Result |
|---|---|
| Brace balance vs original | 79 / 79 — identical |
| Composable surface | identical |
| Lines dropped | 10, every one accounted for |

The 10: the package line plus 9 imports (remapped to SDK equivalents), 3 `PLabel` call sites, and
3 drawable references renamed to `fc_icon_*`. `PLabel`/`PlotlineConstants` are **deliberately
dropped** — root CLAUDE.md §6 bans Plotline inside SDK packages — so the composer carries no
analytics-label hooks. Nothing else changed.

`ShimmerText` came across with it (the composer depends on it); `ScrollToBottomButton` and
`LightContentColors` already existed in the SDK.

### Component batch (2026-09-02)

Six more components ported into `versions/v2/` with the same copy-and-remap recipe, driven by a
reusable script rather than by hand:

| Component | Lines | Note |
|---|---|---|
| `MarkdownText` | 249 → 549 | v2 rewrite: tables, header→type-scale mapping, inline trailing slot, paragraph spacing |
| `LocationButton` | 241 | |
| `TermsOfUseDialog` | 179 → 168 | app analytics call removed, see below |
| `Sunbeams` | 150 | |
| `LocationChatBubble` | 129 | |
| `SectionHeader` | 107 | |

Brace balance matches the original for **every** file, and no `org.digitalgreen.farmer.chatbot`
reference remains anywhere in `versions/v2/`.

Two deliberate SDK adaptations, both required by root CLAUDE.md §6:

- **Plotline removed.** `PLabel` / `PlotlineConstants` hooks are stripped (`InputComposer`), so
  the SDK carries no Plotline labels.
- **App analytics removed.** `TermsOfUseDialog` tracked a Plotline ToS event through the app's
  `AnalyticsManager`. The SDK never calls it — events reach the host via `FarmerChatAnalytics` /
  `config.onEvent` — so the dialog now exposes a plain `onAcceptAndContinue` callback and the
  caller owns tracking.

Ten new labels added across this and the previous slice, **all verified present on endpoint #3**
with matching English fallbacks. Two drawables copied (`fc_ellipse_icon`, `fc_leaf`).

### 2.0.0 status after the parallel build-out (2026-09-02)

Five agents built the four platforms concurrently. Everything below lives in `versions/v2/` only;
the v1 trees are byte-clean.

| Piece | android core | android compose | android views | ios | react-native | web |
|---|---|---|---|---|---|---|
| Agentic transport (#27a, SSE) | ✅ | n/a | n/a | ✅ | ✅ | ✅ |
| `AgenticEvent` + payload aliases | ✅ | n/a | n/a | ✅ | ✅ | ✅ |
| No-timeout stream client | ✅ | n/a | n/a | ✅ | ✅ | ✅ |
| `enableAgenticChat` (default false) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Stream consumer + 4-way finalize | ✅ | n/a | n/a | ✅ | ✅ | ✅ |
| `sanitizeAgenticStreamText` | ✅ | n/a | n/a | ✅ | ✅ | ✅ |
| Live streaming UI (no typewriter) | n/a | ✅ | ✅ | ✅ SwiftUI | ✅ | ✅ |
| Tool progress + 4 s stall hint | n/a | ✅ | ✅ | ✅ SwiftUI | ✅ | ✅ |
| `StreamErrorCard` + retry | n/a | ✅ | ✅ | ✅ SwiftUI | ✅ | ✅ |
| `alignments` model + `AlignmentKind` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `AlignmentSurface` UI + chips | n/a | ✅ | ✅ | ✅ SwiftUI | ✅ | ✅ |
| `InputComposer` wired into screens | n/a | ✅ | ✅ | ⛔ | ✅ | ✅ |
| Home agentic layout | n/a | ✅ | 🟡 composer + title only | ⛔ | 🟡 no sunbeams | 🟡 no sunbeams; pill is prefs-driven |
| `LocationChatBubble` | n/a | ✅ | ✅ `fc_item_chat_location` | ✅ both | ✅ | ✅ |
| **Location bubble actually PRODUCED** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Capability chips (`gps-prompt`, `upload-photo`)** | ✅ | ✅ | ✅ | ✅ both | ✅ | ✅ |
| `TermsOfUseDialog` wired | n/a | ✅ | ⛔ | ⛔ | ✅ | ✅ via `openScreen('termsofuse')` |
| **#7a `policy_acceptance_status` (endpoint + wire model)** | ✅ | n/a | n/a | ⛔ | ⛔ | ⛔ |
| **`HomeAction.FetchPolicyAcceptanceStatus` + `HomeState.policyAcceptanceState`/`acceptTermsState`** | ✅ | n/a | n/a | ⛔ | ⛔ | ⛔ |
| **Mandatory ToU gate sheet + content screen, rendered from Home** | n/a | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| `MarkdownText` v2 (tables, dividers, nesting) | n/a | ✅ | ⛔ | ⛔ | ⛔ | ✅ |
| Alignment chip pick recorded per message | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Settings "My Farm" rows | n/a | ✅ | ⛔ | ⛔ | ⛔ | ⛔ |
| iOS UIKit 2.0.0 UI | — | — | — | ✅ | — | — |

`InputComposer` on **iOS is ⛔ by scope, not by oversight**: the unified composer bar was never
part of the capability-chip/location round, and iOS still uses its 1.0.0 input surface. It is the
only remaining ⛔ in the streaming/alignment feature set, and it blocks nothing else — the agentic
chat, alignment surfaces, capability chips and location bubble all work without it.

The two **bold** rows are the ones worth reading twice. Before 2026-09-02 every cell in the
`LocationChatBubble` row that said ✅ was true and useless: the component rendered, and **no code
on any platform ever constructed the message it renders**, because every alignment chip sent its
own text as the question. See "The capability-chip gap" below.

### The capability-chip gap (2026-09-02)

**What was wrong.** Every alignment chip tap dispatched a plain
`SendFollowUpQuestion(chip.value ?: chip.label)`. That is right for 5 of the 7 `AlignmentKind`s and
wrong for the two CAPABILITY surfaces, which must invoke a device capability and send only the
OUTCOME:

- `gps-prompt` never started the location flow, so `LocationChatBubble` — built and rendering on
  four platforms — could never appear.
- `upload-photo` never opened camera or gallery. Tapping "Take photo" sent the farmer's question as
  the literal string `take_photo`.

Found while porting the bubble to react-native: the agent reported that nothing produced a
`LocationMessage` on any platform and declined to invent a producer (correct — §2). The app HAS
producers (`ui/chat/ChatViewModel.kt` `sendLocationSharedQuery`, and its history mapping), so this
was a missing port, not an upstream gap.

**What was built**, android core first as the reference, then fanned out:

| Piece | where |
|---|---|
| 5 wire constants | `AlignmentChip` companion (`core/model/ChatModels.kt`) |
| `SendLocationSharedQuery` action | `core/ui/chat/ChatAction.kt` |
| `sendLocationSharedQuery()` producer | `core/ui/chat/ChatViewModel.kt` |
| chip routing + armed outcome collector | both flavours' chat screen |

The exact wire strings, which are easy to "normalize" and fail silently — a mismatch drops the chip
to the text path and sends the constant as the question:

```
ACTION_SELECT             = "invoke"                    NOT "select"
VALUE_SHARE_LOCATION      = "share_precise_location"    the app has "share_location" commented out above it
VALUE_TAKE_PHOTO          = "take_photo"
VALUE_CHOOSE_FROM_GALLERY = "choose_from_gallery"
VALUE_NOT_NOW             = "not_now"
```

**Where the routing rule lives.** android keeps it per-flavour and tests a local mirror;
ios/react-native/web each put it in a shared core module so the screen and the test exercise **one
function**. The latter is better and is the pattern to follow — a screen holding an inline copy of
the table passes the test while diverging from it.

**Deltas recorded, not built** (identical on all four platforms):

- ~~**No `parent_message_id`.**~~ **CLOSED for android on 2026-09-03** — the field, and the other
  five missing `TextPromptRequest` fields, are now sent; both the chip path and the location path
  resolve it from the source surface's SERVER `messageId`. See "#27a real wire contract" at the end
  of this document. **Still open for ios / react-native / web.** (It was recorded rather than built
  because the endpoint returned 0 bytes to a guest and the field was unexercisable; the live capture
  removed that objection.)
- **No `agentic_chip_*` analytics.** `SendQueryProperties` has no `isAlignmentChip` / chip
  type-value-label-status fields, so these report as ordinary text queries. `triggered_input_type`
  IS sent as `align_chip_sel`.
- **Chat history `message_type_id 12 → location_shared` NOT ported.** The app's own
  `TODO(location-history)` says the type id and the address field (`query_text`) are unconfirmed
  placeholders. Consequence: **a location bubble does not survive a conversation reload.**
- **Address composition.** android uses the app's `APPROX_LOCATION_NAME, USER_SELECTED_STATE_CODE,
  USER_COUNTRY_NAME`. ios/react-native have no `APPROX_LOCATION_NAME` (web v2 ported it 2026-10-08 — see "Web v2 compose-fidelity pass"; android v2 writes it
  as district → state → country since 2026-10-06, app parity; before that from `display_address`) and substitute
  district → state → country. No pref key was invented. A **guest** has none of these stored, so
  the address is blank and no bubble renders — the app-parity branch.

### Three producer bugs found by re-implementing the same flow

All three are in a PRODUCER's completeness, not in any consumer's logic — every consumer was written
correctly against a producer that quietly did not emit on all paths, or did not emit to everyone.
Reviewing the consumer, where the feature appears to live, would not have surfaced any of them.

1. **`LocationPromptManager.events` was single-consumer (android).** A
   `Channel(BUFFERED).receiveAsFlow()` delivers each event to exactly ONE collector, and v2 compose
   has two long-lived ones — `FarmerChatRoot` (widget toast) and `HomeScreen` (feed reload). A
   location update raced: whichever won consumed the event and the other never saw it, giving a
   toast with no reload or a reload with no toast, at random. Now a broadcast `SharedFlow`.
   `replay = 0` deliberately, though the app uses `replay = 1` — a replayed stale event would make
   `HomeScreen` reload its feed on every recomposition. All five collectors audited afterwards:
   side effects are disjoint, nothing double-fires.
   **v1 is NOT affected** — it has one collector per flavour (compose OR views, never both), so the
   frozen tree needed no change. Verified, not assumed.
2. **`dismiss()` emitted nothing (android + ios).** The error branch has no other exit —
   `onLocationFetchFailed` / `onNoNetwork` / `onGpsEnableResult(false)` all park in `State.Error`,
   and dismiss is how the user leaves it (views: the error card's **X**; compose: the recovery
   sheet's swipe-away). A chat surface armed by a chip tap therefore waited **forever** and the
   farmer's blocking question was never answered. android now emits
   `Continue(reason = "dismissed")`; ios emits a terminal `.skipped(source:)`; react-native and web
   settle theirs as a cancel. Found by the web agent doing this same port; ios had the identical
   hole.
3. **The opposite trap, closed at the same time.** After fix 2, a "flow ended" signal no longer
   implies success — treating one as success shows a location bubble for a location that was never
   shared. **Every platform now exposes the success test as one shared core function** that its
   flavours and its tests both call (`isLocationObtained` / `isLocationObtained()` / a shared
   module), replacing the per-flavour `reason == "location_fetched"` string comparisons.

   What differs per platform is the test's *internals*, not its location. android compares against
   `LOCATION_OBTAINED_REASONS` (the app's three reasons, though the SDK only ever emits
   `location_fetched`) because its `Continue` case became overloaded by the dismiss emission. ios
   deliberately has **no reason set at all**: its events carry no `reason` field, so the event case
   itself is the discriminator, and inventing a reason string would add a wire-adjacent field with
   no discriminating power (§2).

Two more, ios-only, found by the same port:

- **Both ios location hosts would have rendered zero pixels** for a chip-triggered flow:
  `LocationPromptHostView` and `FCUILocationPromptHost` gated the permission/fetch overlay to
  `source == .weather`. `.localContext` now shares it. **android is not affected** — compose does
  not gate on source at all, and views' `keepInterstitialIfWeather` hides only for `Campaign` (the
  widget flow), despite the misleading name.
- **UIKit subscribe/trigger asymmetry:** `observeLocationOutcomes()` no-op'd silently on a nil nav
  controller while the chip branch resolved the manager independently, so the whole GPS flow could
  run with nothing listening. The subscription is now idempotent and the chip branch refuses to
  start unless it is active.

A third, react-native-only: `AppNavGraph`'s logout handler called `dismissError()` on an **idle**
machine, which after fix 2 would have handed an armed chat surface a decline the farmer never
triggered. Guarded with android's `wasActive` check (capture state before clearing, emit only if it
was not already Idle). android's `clearState()` (logout) is silent by design and was already
correct.

### Verification, 2026-09-02 (all re-run, none an incremental no-op)

```
android   :farmerchat-core / :farmerchat-android-compose / :farmerchat-android-views
          / :sample-compose / :sample-views  assembleDebug     BUILD SUCCESSFUL
          :farmerchat-core:testDebugUnitTest --rerun-tasks     43 tests, 0 failures
          (AlignmentKind 5, AlignmentPick 3, CapabilityChip 7, LocationOutcome 5,
           AgenticEventParsing 14, AgenticStreamText 9)

ios       FarmerChatCore  swift build + swift test             79 tests, 0 failures
          FarmerChatCore    arm64-apple-ios15.0-simulator      Build complete!
          FarmerChatSwiftUI arm64-apple-ios16.0-simulator      Build complete!
          FarmerChatUIKit   arm64-apple-ios15.0-simulator      Build complete!

web       npx tsc --noEmit / tsc -p tsconfig.test.json         exit 0
          npx vite build                                       ✓ built
          npm test                                             174 assertions
          (agentic 73, agenticStream 12, alignmentPick 11, capabilityChip 36, markdown 42)

rn        npx tsc --noEmit                                      exit 0
          86 assertions run out-of-tree (no test runner in the package)
```

`FarmerChatSwiftUI` declares `.iOS(.v16)`; building it at 15.0 produces five spurious
"only available in iOS 16" errors. Build each ios package at its own declared minimum.

**Nothing has run on a device, simulator or browser.** Everything in 2.0.0 is build- and
test-verified only, and the agentic wire still delivers 0 bytes to a guest, so no real `gps-prompt`
surface has ever been exercised end to end.

### Three defects the parallel build found in my own core

Independent implementers reading the same contract caught what a single pass missed. Each was
verified before fixing, and each is fixed in **core**, so every flavour inherits it:

1. **`alignmentSelectedValues` was never written.** Declared, read by two UI flavours, populated by
   nothing — so the entire selected/locked chip treatment was dead code everywhere. The field had a
   `= emptyList()` default, so every read compiled and always took the "nothing selected" branch;
   `assembleDebug` passed on both flavours. Core now records a pick on chip tap, matched strictly
   against that surface's own chips so a farmer-typed follow-up cannot mark a chip chosen.
   Guarded by 3 new tests. Reported independently by the views, RN and web agents.
2. **Two error UIs at once.** `interruptAgentic` set `isInterrupted` on the message *and*
   `state.errorMessage`, so the UI rendered `StreamErrorCard` **plus** a generic inline error —
   two messages, two "Try again" buttons. Core no longer sets `errorMessage`; the card owns it.
   Reported independently by the views, iOS, RN and web agents.
3. **The typewriter replayed a streamed answer.** The `metadata` path minted a fresh message id, so
   the settled answer was absent from the reveal-once set and Compose re-typed text the farmer had
   just watched arrive token by token. `handleTextPromptResult` now accepts a `reuseId`; the
   agentic path passes its stream id. Reported independently by the iOS and RN agents.

### Test coverage (the wire cannot be exercised, so tests are the only guard)

| Platform | Tests |
|---|---|
| android | **31** unit tests (parser 14, sanitizer 9, AlignmentKind 5, alignment pick 3) |
| ios | **57** (`swift test`), incl. no-timeout session assertions |
| web | **138** assertions on Node's native TS — 85 agentic + 11 alignment-pick + 42 markdown; includes a JSON object split one byte per chunk, a cut inside a 3-byte Devanagari sequence, and the nested-emphasis / GFM-table cases the 1.0.0 renderer could not express |
| react-native | **86** assertions, run out-of-tree — the package has no test runner and none was added; 46 agentic/alignment + **40 capability-chip / location-outcome** mirroring android's `CapabilityChipTest` + `LocationOutcomeTest` |

### Platform transport notes worth knowing

- **web** uses `fetch` + `getReader()`, *not* `EventSource` — EventSource cannot POST or set
  headers and forces the `Accept` value the backend 406s. Two-stage buffering: one streaming
  `TextDecoder` for split multi-byte characters, plus a line buffer that retains the trailing
  fragment.
- **react-native** uses `XMLHttpRequest` incremental mode; RN's `fetch` has no `response.body` at
  all. Honest caveat from that agent: `responseText` accumulates the whole response in memory, and
  any buffering interposer (Flipper's network plugin, a buffering proxy) collapses it to a single
  chunk so the answer appears at the end — events still parse correctly.
- **ios** sets a 7-day session timeout and deliberately does **not** build on `buildRequest`,
  because a `URLRequest.timeoutInterval` overrides the session config and would have capped the
  stream at the P3 deadline of 30 s.
- `X-Timeout` / `X-Request-ID` are **not** sent on the stream on any platform, matching Android's
  agentic client, which omits the priority interceptors. Root CLAUDE.md §3 lists `X-Timeout` as a
  header invariant — this is a deliberate, recorded exception: advertising a timeout on a request
  that has none would be a lie.

### Naming deviation (iOS)

iOS names the model `AlignmentSurface`, not `Alignment` — `SwiftUI.Alignment` owns that name and a
public `Alignment` in Core made `FarmerChatFabButton` ambiguous for any host importing both
modules. The wire key is still `alignments`.

### The mandatory Terms-of-Use gate (#7a) — closed on android 2.0.0, 2026-09-03

The app has a **blocking** policy-acceptance gate the SDK had no trace of: not the endpoint, not
the model, not the UDF fields, not the UI. It is fully-implemented app code
(`ui/home/HomeViewModel.kt:107/176`, `ui/home/udf/HomeState.kt`,
`domain/model/policy/PolicyAcceptanceStatusResponse.kt`, `ui/home/HomeScreen.kt:858/1818`), and it
is **not** the Plotline-triggered `TermsOfUseDialog` that was already ported — the app's own
comment at `HomeScreen.kt:331` says this one is "driven by GET policy_acceptance_status rather
than a campaign card". The two are independent and both now exist on android.

**Verified live before implementing** (2026-09-03, stage, guest token):
`GET api/user/policy_acceptance_status/?user_id=<uuid>` → **200** with exactly the app's field
set; omitting `user_id` → **400** `{"error":"user_id is required"}`. Shape and field names match
`PolicyAcceptanceStatusResponse` character-for-character, so nothing went to docs/05. Recorded in
docs/02 §Endpoint #7a with the live body.

What landed:

| Layer | android-core | android-compose | android-views |
|---|---|---|---|
| `ApiConstants.POLICY_ACCEPTANCE_STATUS`, `ApiServices.fetchPolicyAcceptanceStatus` | ✅ | — | — |
| `PolicyAcceptanceStatusResponse` + `LatestPolicyVersion` (snake_case, 1:1) | ✅ | — | — |
| `LanguageRepository.fetchPolicyAcceptanceStatus`, `GetSupportedLanguagesUseCase.fetchPolicyAcceptanceStatus` (P2, `apiName="policy_acceptance_status"`) | ✅ | — | — |
| `HomeAction.FetchPolicyAcceptanceStatus`, `HomeState.policyAcceptanceState`, `HomeState.acceptTermsState` | ✅ | — | — |
| Dispatched on **every** Home entry | — | ✅ | ✅ |
| Non-cancellable sheet + "Read terms" content screen | — | ✅ `TermsOfUseGate.kt` | ✅ `TermsOfUseGateController.kt` |
| 5 app analytics events, host-raised | — | ✅ | ✅ |
| 7 app label keys (**all live on #3 in en/hi/sw**) | ✅ | ✅ | ✅ |
| Shared gate predicate + 9 unit tests | ✅ | uses it | uses it |

**The bug this round deliberately did not ship.** The SDK's pre-existing `acceptTerms` was
fire-and-forget — `collect { /* best-effort */ }`, writing no state. The gate's only exit is
`acceptTermsState is UiState.Success`, so shipping the sheet on top of that would have produced a
**non-dismissible overlay permanently covering Home**. `HomeViewModel.acceptTerms` now writes
`Loading → Success/Error` like the app's, and the app's reset (`fetchPolicyAcceptanceStatus` sets
`policyAcceptanceState = Loading, acceptTermsState = Idle` in one update) is ported verbatim — a
stale `Success` from the dismissible dialog earlier in the session would otherwise suppress a
freshly-required re-acceptance. Both are covered by `TermsOfUseGateTest`.

**The gate fires for guests, and that is app behaviour.** `initialize_user` persists a `user_id`
(app `OnboardingSharedViewModel.kt:387`, SDK `SessionManager.kt:62`), the app's guard skips only a
*missing* userId (`isBlank() || equals("null")`), and the backend answers
`requires_acceptance: true` for a guest token — that is exactly what the live probe returned. The
guard is ported literally, so a guest-only host (e.g. the CHAT_ONLY bootstrap) will see the sheet
on Home. Its error path is retryable on both flavours: `UiState.Error` re-enables both buttons and
surfaces the reason as a toast.

**Recorded deltas from the app:**
- **No Adjust tokens and no `Plotline_Accept_Terms_Click_Event`** (`"ToS_Aug26_Accept_Terms"`).
  The other five events are ported character-for-character
  (`Terms_Of_Use_Sheet_Shown`, `…_Content_Screen_Viewed`, `…_Content_Screen_Exited`,
  `…_Accept_Click_Event`, `…_Read_Terms_Click_Event`) with
  `AnalyticsScreens.TERMS_OF_USE_CONTENT_SCREEN = "Terms of Use Content Screen"`. The app's
  components self-track through `AnalyticsManager`; the SDK raises them from the caller through
  `FarmerChatAnalytics` instead (root CLAUDE.md §6). The app's timing quirk is kept:
  `Terms_Of_Use_Accept_Click_Event` fires on API **success**, not on the tap, tagged with which of
  the two CTAs initiated it.
- The app's optional `bannerRes` sheet variant is not ported (Home always passes `null`, so the
  icon variant is the only one the app ever renders). `ic_tou_info.xml` is copied as
  `fc_ic_tou_info.xml`.
- The content screen's app-bar close button is **inert** rather than **dimmed** while #7 is in
  flight on compose: the app passes `rightEnabled` to its `DefaultAppBar`, which the SDK's shared
  `DefaultAppBar` does not have, and adding a parameter to a component five screens share was not
  worth the churn. Taps are ignored, which is the load-bearing half.
- The gate predicate is extracted to core (`HomeState.requiresTermsAcceptance()`,
  `latestTermsOfServiceUrl()`) rather than left inline as the app has it. The app has one UI; the
  SDK has two, and a duplicated inline predicate is exactly how the two flavours drift.
- **`showContentScreen` is not saved across a config change**, matching the app's plain
  `remember`. Rotating with the content screen open drops back to the sheet; the gate itself is
  re-derived from state and stays up.
- **Views-only visual delta**: the content screen's bottom action bar uses `fc_bg_rounded_top`
  (white / `surface_secondary`) where compose and the app use `brand.foregroundPrimary`.

**Labels checked, not assumed.** All seven keys are served by #3 on stage in **en, hi and sw**
(probed 2026-09-03, `language=1/2/3`). This mattered more than usual: the gate cannot be dismissed,
so a missing key would strand a non-English farmer on a hardcoded-English screen with no way out.
Recorded in docs/02 §Endpoint #7a.

**Verified 2026-09-03**: `:farmerchat-core:assembleDebug`, `:farmerchat-android-compose:assembleDebug`,
`:farmerchat-android-views:assembleDebug`, `:sample-compose:assembleDebug`,
`:sample-views:assembleDebug`, `:farmerchat-core:testDebugUnitTest` → **BUILD SUCCESSFUL**, core
unit tests **76 total / 0 failures** (9 new). **NOT verified: nothing ran on a device or emulator** —
the gate has never been seen on a screen. `TermsOfUseGateTest` pins the predicate given a state;
that `HomeViewModel.acceptTerms` writes that state, and that both flavours construct the sheet, is
build-and-inspection evidence only.

**Not done in this lane:** iOS, react-native and web have none of #7a — no endpoint, model, state
or UI. That is the honest ⛔ in the matrix rows above, not a partial.

### Home sweep (android 2.0.0, same round)

Diffed the app's `ui/home/` against both android flavours. Findings, so the next reader does not
re-derive them:

- **UDF is now exactly 1:1.** App `HomeAction` has 14 members, SDK had 13 — the single delta was
  `FetchPolicyAcceptanceStatus`. App `HomeState` has 11 fields, SDK had 9 — the delta was
  `policyAcceptanceState` + `acceptTermsState`. All three are now present, so the action/state
  surfaces match member-for-member with no renames.
- **Feed section types**: app renders `image`, `statement`, `question` (`single`/multi
  `selection_type`) and `plotline_widget`. Both flavours cover the first three and filter
  `plotline_widget` through `HomeUdfResponse.renderableSections()` — correct per docs/02 §#12,
  which warns a catch-all branch turns those into blank cards. No gap.
- **Weather CTA**: present on both (`onWeatherClick` → location prompt when unresolved → chat with
  `isWeatherAdviceCTA`); the pill is additionally gated by `config.enableWeather`, an SDK-only
  host knob. No gap.
- **Crops / livestock submission targets** match the app: `single` gender →
  `UserNameRequest(gender)`; livestock (`statement_type` contains "livestock") →
  `UserNameRequest(live_stock_details)`; crops → `UpdateCultivatedCrops` (#14). No gap.
- **`MarkImageViewed`, image-statement, question-count** are all wired on both flavours.
  Question-count is called where the app calls it — the sign-up routing decision
  (`bypass_interstitial ? Auth : AccountBenefits`), app `AppNavGraph.kt:143`, SDK
  `FarmerChatRoot.kt:236` / `JourneyController.kt:244` — not from Home. No gap.
- **Greeting logic**: both flavours render the API greeting with the app's agentic/plain split.
- **Still open (unchanged this round, confirmed):** Settings "My Farm" rows and the agentic Home
  visuals (sunbeams, gradient, pinned header) are compose-only; views has the composer and the
  "For your farm today" title but not the surface treatment. Matrix rows above are accurate.

**Still to do for 2.0.0:**
1. **Confirm the wire framing with the backend.** Still the biggest risk: the endpoint emits 0
   bytes to a guest on all three environments, so no platform's reader has ever seen a real event.
   Four questions are listed in docs/05.
2. **No device or browser run anywhere.** Everything is build- and test-verified only.
3. `TermsOfUseDialog` is now wired on **android-compose**, **react-native** and **web**; still
   unwired on android-views and iOS. On web the open request arrives through the existing public
   entry point — `openScreen('termsofuse')` lands on Home and raises a flag — mirroring
   android-compose's `SCREEN_TERMS_OF_USE`, because the app's trigger is a Plotline card CTA and
   root CLAUDE.md §6 bans Plotline inside SDK packages. The dialog renders the URL in a sandboxed
   `<iframe>` (no WebView on the web), the same mechanism `LegalContentModal` already uses.
   The Settings "My Farm" rows are **done on android-compose** (`SettingsScreen.kt`, the row +
   `fc_icon_location`/`fc_icon_name`/`fc_icon_phone`, label `fc_v2_app_label_my_farm` — verified
   present on endpoint #3) and still unwired on android-views, iOS, react-native and web. Core has
   `HomeAction.AcceptTerms` / `FetchPrivacyPolicy` / `HomeState.farmerchatTermsOfUse`,
   `LocationTriggerSource.Settings` / `triggerFromSettings()` and the verified labels, so the
   blockers are gone and only the UI wiring remains.
4. ~~Device-capability chip flows (camera / location) are unwired on all platforms — chips
   uniformly send value-or-label as a follow-up.~~ **DONE on all four platforms (2026-09-02)** —
   see "The capability-chip gap" above for the reference implementation, the exact wire constants
   and the recorded deltas. Note the discriminator is `chip.action == "invoke"`, **not** `"select"`
   as this item originally said; `ACTION_SELECT` is only the constant's NAME.
   ~~web~~ — **done** (2026-09-02): the routing rule lives in `core/alignment.ts`
   (`capabilityChipRoute` + the `CapabilityChip` constants, `action === "invoke"`,
   `share_precise_location` / `take_photo` / `choose_from_gallery`), `ChatScreen.tsx` switches on
   it — location → the shared `LocationPromptActions.triggerFromLocalContext` flow armed with the
   source message id, photo → a hidden `<input type="file">` (camera one with `capture`), so a
   capability chip never sends its own text. `not_now` and every non-capability chip still route
   `TEXT` through `selectAlignmentChip`. 36 assertions in `test/capabilityChip.test.ts` mirror
   android's `CapabilityChipTest`. Matches the android reference.
   ~~react-native~~ — **done** (2026-09-02): the routing rule is `routeAlignmentChip` +
   `AlignmentChipWire` in `core/types.ts` (`action === "invoke"`, `share_precise_location` /
   `take_photo` / `choose_from_gallery`), which `ChatScreen.tsx`'s `handleAlignmentChip` switches
   on at BOTH chip sites (the exclusive surface and the additive one inside `AiBubble`) — see
   "react-native capability chips" below. `not_now`, a chip with no `invoke` action, a capability
   value on the wrong surface and every non-capability surface still route `TEXT` through
   `SelectAlignmentChip`.
   ~~ios~~ — **done** (2026-09-02), BOTH flavours: the routing rule is
   `AlignmentChip.capability(for:)` + the five wire constants in Core `ChatModels.swift`
   (`actionSelect == "invoke"`, `share_precise_location` / `take_photo` / `choose_from_gallery` /
   `not_now`), which `ChatView.handleAlignmentChip` (SwiftUI) and
   `FCUIChatViewController.handleAlignmentChip` (UIKit) switch on at BOTH chip sites (the
   exclusive surface and the additive one) — see "iOS capability chips" below. `not_now`, a chip
   with no `invoke` action, a capability value on the wrong surface and every non-capability
   surface still send value-or-label through `.sendFollowUpQuestion`.
5. ~~android-views has no `LocationChatBubble` port~~ — **done**: `fc_item_chat_location.xml`
   with its own `TYPE_LOCATION` view type, `bindLocation`, and the `bubbleCornerRadius` /
   `messageFontSizeSp` knobs. ~~react-native~~ — **done** (`LocationChatBubble.tsx` +
   `ChatMessage` `'location'` variant, rendered right-aligned in `ChatScreen`). ~~web~~ —
   **done** (`ui/components/LocationChatBubble.tsx`, inline SVG for the pin/ellipse since the
   package ships no image assets, + the `'location'` variant on `ChatMessage`, rendered
   right-aligned from `ChatScreen`). ~~iOS still shows the address in the ordinary user bubble~~
   — **done** (2026-09-02): iOS had **no location variant at all**;
   `ChatMessage.location(LocationMessage(address:id:))` now exists in Core and renders in BOTH
   flavours (`FCLocationChatBubble` in SwiftUI `ChatComponents.swift`, `FCUILocationBubbleCell` +
   its own `Row.location` in UIKit `ChatCells.swift`), honouring the `bubbleCornerRadius` /
   `messageFontSize` knobs, WITH a producer — see "iOS capability chips" below.

   **On all of android, react-native and web the variant is never CONSTRUCTED.**
   `grep 'LocationMessage('` finds no constructor anywhere in the android reference either — the
   GPS_PROMPT chip still sends its value as an ordinary follow-up (item 4 above). The renderers
   are wired and reachable, so whichever platform first appends one lights up everywhere; no
   platform invented an appender, which would have been a behaviour the app does not have.

   **Producer gap, every platform.** Nothing anywhere *creates* a `LocationMessage`: the
   `GPS_PROMPT` chip only dispatches `SendFollowUpQuestion`, so the bubble's render path is
   reachable but never reached at runtime. Android core has had this shape since the variant
   landed (`ChatModels.kt`:95 defines it, `ChatScreen.kt`:699 and `ChatAdapter.kt`:276 render it,
   no producer). react-native mirrored the gap rather than inventing the flow; **its producer
   landed 2026-09-02** now that the android reference has one — see below and docs/05.

   **Closed on web (2026-09-02), following the android reference which now has a producer.**
   `useChat.sendLocationSharedQuery(sourceMessageId, address)` — the only constructor of the
   `'location'` variant — marks `share_precise_location` picked on the source surface, appends the
   bubble (blank address → no bubble, app parity), then re-sends that surface's
   `alignmentOriginalQuery` with `triggered_input_type = align_chip_sel` and NO user text bubble
   (new `runTextQuery({ suppressUserMessage })`). Called only from `ChatScreen`'s
   `location_fetched` outcome. Deltas mirrored from android, not fixed: no `parent_message_id`
   (`TextPromptRequest` has no such field) and no `agentic_chip_*` properties on this path.

   **Closed on react-native (2026-09-02), same reference, same shape.**
   `useChat`'s `sendLocationSharedQuery` — reached only through the new
   `ChatAction.SendLocationSharedQuery` — is the only constructor of the `'location'` variant. It
   marks `share_precise_location` picked on the source surface, appends the bubble (blank address
   → no bubble, app parity) then the loading placeholder in ONE atomic update, and re-sends that
   surface's `alignmentOriginalQuery` with `triggered_input_type = align_chip_sel` and no user
   text bubble (new `sendTextQuery({ staged })`). Dispatched only from `ChatScreen`'s armed
   `location_fetched` outcome. Same deltas mirrored from android, not fixed: no
   `parent_message_id`, no `agentic_chip_*` properties, and no endpoint #30 on this path (the
   chip's text is not the question).
6. ~~iOS UIKit still renders the 1.0.0 chat.~~ — **stale as of 2026-09-02.** `FarmerChatUIKit`
   now carries the 2.0.0 chat: `FCUIStreamStatusView`, `FCUIStreamStallHintView` and
   `FCUIStreamErrorCardView` are configured from `ai.isStreaming` / `ai.isInterrupted` in
   `FCUIChatBubbleCell`, `FCUIAlignmentSurfaceCell` renders an exclusive surface with its own
   `Row.alignment` case, `FCUIAlignmentSurfaceView` renders an additive one below a real answer,
   and (2026-09-02) `FCUILocationBubbleCell` + capability-chip routing landed — see "iOS
   capability chips" below. Caveat on provenance: `AgenticViews.swift` was still untracked in git
   when this line was rewritten, so the streaming/alignment part of it belongs to the concurrent
   UIKit agentic port, not to the capability-chip change; only the capability-chip and location
   bubble claims here were made by that change. Nothing in UIKit has been run on a device or
   simulator, like the rest of 2.0.0.
7. The Home **agentic layout** (grey reading surface, green→transparent gradient band,
   sunbeams, pinned logo + leaf-flanked header + location pill, and the composer's idle
   gradient aura) is complete only on android-compose. **react-native** now carries all of it
   except the sunbeams and the idle aura (both need a blur/shader primitive the package's
   dependency set does not have) — see "react-native composer + agentic Home wiring" below.
   **web** carries all of it *including* the idle aura (a conic-gradient ring, already in
   `theme.ts`) and the band's scroll fade, with two gaps: no sunbeams, and the location pill is
   not Compose's `HomeLocationPill` (web has no such widget — it reads the district/state/country
   prefs the location flow writes and otherwise invites sharing) — see "web composer, markdown
   and agentic Home wiring" below.
   `InputComposer` itself is wired on android-views too — see "android-views composer wiring".
8. **Ten** labels remain absent from the server (corrected from "two" on 2026-09-02 against a
   live stage probe — see the label section above for the full list and why the earlier count was
   wrong), so those strings fall back to English on every platform until the backend adds them.
   Every other label used by v2 was verified
   present on endpoint #3 before use.
9. iOS, react-native and web still carry the **pre-existing v1 label-key mismatch**, so their UI
   does not localize at all. That is unrelated to v2 and unchanged by it.

### android-views composer wiring (2026-09-02)

`InputComposerView` + `fc_view_input_composer.xml` existed but were **orphaned** — referenced by
nothing, so the class compiled and rendered nowhere. Wired now, gated exactly like Compose's
`isComposerUi` (`graph.config.enableAgenticChat`, still default **false**):

| | 1.0.0 path (flag off) | 2.0.0 path (flag on) |
|---|---|---|
| Chat input | `fcChatInputButtons` (Photo/Speak/Type) + overlay panels | `fcChatComposer`, compact, green700 sheet on `fc_surface_reading` band |
| Home input | `fcHomeInputButtons` + overlay panels | `fcHomeComposer`, standard metrics, green700 sheet and band |
| Home header | `GET_STARTED_BY_CLICKING…` / API greeting | `FOR_YOUR_FARM_TODAY` (title only) |
| List padding | XML `paddingBottom=24dp` | `barHeightPx − navBar inset`, from `onBarHeightChanged` |

Both composers are direct children of each fragment's root `FrameLayout`, at the **same nesting
level as the `fc_view_input_overlays` include** — deliberately, because that is the position whose
IME handling is already proven: a sibling of the `fitsSystemWindows="true"` content
`LinearLayout` sees zeroed dispatched insets, so `InputComposerView.applyImeInsets()` reads
`ViewCompat.getRootWindowInsets`, the same mechanism as `InputOverlaysController.applyImeInsets()`
(fix of 2026-09-01, must not regress). The widget's `init` calls `requestApplyInsets` before it is
attached, where it is a no-op, so both fragments re-request on the root after wiring.

Live behaviour now driven from the fragments: send (`ChatAction.SendFollowUpQuestion` /
`SendQuestionWithImage`; Home navigates instead), the mic behind the existing `ASR_ENABLED` gate,
the camera behind the existing permission/deny-count flow, `setBarVisible()` on the Compose rhythm
`!(isThread && state.isLoading)`, and `AlignmentSurfaceView`'s "type instead" escape hatch, which
now focuses the composer rather than opening the legacy text panel over it (it would have stacked
two input surfaces).

**Deviation from android-compose, resolved in favour of the app.** A picked image is **attached**
to the composer and sent with the typed text (app: `photoUris = listOf(uri)` in both
`ChatScreen.kt:499/550` and `HomeScreen.kt:338/374`). The android-compose port instead sends /
navigates the instant the picker returns, which leaves its own `photoUris`, thumbnail strip and
`onRemovePhoto` permanently dead. Views follows the app source (root CLAUDE.md §1). **Gap:
android-compose should be brought to the app behaviour** — not done here (v2 compose was out of
scope for this change).

Still not ported on android-views, all decorative or Home-layout-wide:
- the composer's idle gradient **aura** (Home-only attention cue);
- the agentic Home **surface + gradient band + sunbeams + pinned logo/leaf/location-pill header**
  (`fc_leaf.xml` exists in `res/drawable/` and is referenced by nothing until that lands);
- Home **voice transcription still navigates straight to chat** rather than filling the composer
  with the transcript — same as android-compose, so this is not a views-only gap.

Verified: `:farmerchat-android-views:assembleDebug` and `:farmerchat-core:testDebugUnitTest`
clean. **Not run on a device**, consistent with the rest of 2.0.0. `sample-views` gained an
`agentic` profile (`adb … -e profile agentic`), without which the composer is unreachable at
runtime; `sample-compose` has no such profile.

### react-native composer + agentic Home wiring (2026-09-02)

`src/ui/components/InputComposer.tsx` existed but was **orphaned** — no screen imported it, so
the file typechecked and rendered nowhere (the same defect android-views had). Wired now, gated
exactly like Compose's `isComposerUi` (`sdk.config.enableAgenticChat`, still default **false**),
so a host that has not opted in sees the untouched 1.0.0 input surface:

| | 1.0.0 path (flag off) | 2.0.0 path (flag on) |
|---|---|---|
| Chat input | `PrimaryInputButtons` (Photo/Speak/Type) + `TextInputOverlay` in a `KeyboardAvoidingView` | `<InputComposer floating isAnchored compact bottomInset={0}>`, brand-green sheet on `surfaceReadingPrimary` |
| Home input | `PrimaryInputButtons` (sticky) + `TextInputOverlay` | `<InputComposer floating isAnchored>`, brand-green sheet |
| Home surface | `brand.surfacePrimary` (green) | `content.surfacePrimary` (grey) + gradient band |
| Home app bar | green + yellow glow | `showBackground={false}` — green and glow come from the band |
| Home header row | API greeting / `GET_STARTED_BY_CLICKING…` | pinned+fading logo mark + leaf-flanked `FOR_YOUR_FARM_TODAY` + location pill |
| Home sticky slot | Photo/Speak/Type tiles | kept but empty (Compose renders `Spacer(0.dp)`) |
| In-feed `FeedHeader` | rendered | skipped (the top-of-feed `SectionHeader` already carries the title) |
| Card tap | `FetchImageStatement` (#13) → pre-generated answer | **skips #13**; sends `question_text ?? title` into Chat as a plain text query with `homeStatementId` |

Behaviour ported alongside the visuals: send (`SendFollowUpQuestion` / `SendQuestionWithImage`;
Home navigates instead), `visible={!(uiState.kind === 'thread' && state.isLoading)}` on Chat so
the bar slides off while an answer generates, the `CHAT_ICON_CLICKED` (`Icon: 'Text'`) event on
focus gain and (`Icon: 'Image'`) on camera — both existing event names, no new ones.

**IME:** the composer owns its own keyboard handling (`Keyboard` listeners, iOS-only lift; on
Android the host activity's `windowSoftInputMode="adjustResize"` already resizes the window). It
is therefore deliberately **not** wrapped in Chat's existing `KeyboardAvoidingView` — doing so
would double the bottom inset, the RN counterpart of the Compose `imePadding()` double-inset
note. The `KeyboardAvoidingView` still wraps `TextInputOverlay` on the 1.0.0 path, unchanged.

**Layout model deviation (documented in `InputComposer.tsx`'s own header, not new here):** the RN
composer is a bottom **flow** element, not a `fillMaxSize` overlay, because `FloatingFadeHeight`
is 0 and the floating wrapper paints `fadeColor` opaquely, so nothing behind it is ever visible.
Consequence: Compose's `contentPadding = composerBarHeight(floating = true)` reserve is **not**
applied on either list — the list is already shortened by the bar, and reserving it again would
double the gap. `composerBarHeight()` is therefore exported but currently called by no RN screen.

**Deviation from android-compose, resolved in favour of the app** (the same call android-views
made): a picked image is **attached** to the composer and sent with the typed text (app:
`photoUris = listOf(uri)`, `ChatScreen.kt:499/550`, `HomeScreen.kt:338/374`). android-compose
still sends/navigates the instant the picker returns, leaving its own `photoUris`, thumbnail strip
and `onRemovePhoto` permanently dead. Gap on android-compose, unchanged here.

**Terms-of-use dialog.** `TermsOfUseDialog.tsx` mirrors the Compose component; its accept action
is a plain `onAcceptAndContinue` host callback (root CLAUDE.md §6 — the app's `AnalyticsManager`
call has no analogue in an SDK package). Reached the same way Compose reaches it: `useHome` gained
`HomeState.farmerchatTermsOfUse` + `HomeAction.FetchPrivacyPolicy` (#4, fetched on every Home
entry) + `HomeAction.AcceptTerms` (#7, best-effort); `FarmerChatScreen` gained `'termsofuse'`
(Android's `SCREEN_TERMS_OF_USE` key), which `AppNavigator.openScreenTarget` routes to Home and
then raises through `AppNavGraph` into `HomeScreen`'s `openTermsOfUseRequested` prop. The open
request waits up to 5 s for the URL, then toasts `UNABLE_TO_LOAD_LEGAL_LINKS` and consumes itself.

Six labels added to `core/labels.ts`, all copied verbatim from the Android core `Labels.kt`
(`SET_YOUR_LOCATION`, `LOCATION_FOUND`, `CHANGE`, `ALLOW_LOCATION_IN_SETTINGS`,
`ACCEPT_AND_CONTINUE`, `YOUR_LOCATION`) — no invented keys.

Not ported on react-native, all because the dependency set has no gradient / shader / blur / SVG
primitive (no `react-native-svg`, no `expo-linear-gradient`) and the asset set is a fixed PNG list:
- the composer's idle **aura** and placeholder **shimmer** (already documented in
  `InputComposer.tsx`'s header before this change);
- the Home **sunbeams** (Compose blurs beam paths into cached offscreen bitmaps);
- the header's green→transparent band is a **24-step stacked-alpha ramp** rather than a real
  vertical gradient (a vertical ramp is faithfully steppable; the rotating sweep aura is not);
- the leaf divider in `SectionHeader` tiles 4x4 rounded **pips** instead of the `fc_leaf` drawable;
- the location pin in `LocationChatBubble` / the Home pill is **drawn from Views** (no
  `Icons.Filled.LocationOn`, no `fc_ellipse_icon` raster).

Location-pill deviations forced by the RN core (not cosmetic):
- the pill drives the **widget** flow — the silent one, which is the behaviour the pill wants.
  (`useLocationPrompt` had no `LocalContext` source at all when the pill was written; the
  capability-chip work below added `'localContext'`, and the pill deliberately keeps `widget`);
- **no Blocked state**: there is no location permission deny-count key in `sessionStore.ts`
  (camera/mic only) and inventing one is out of bounds (root CLAUDE.md §2), so a blocked
  permission surfaces through the shared prompt host's Recovery / GPS-error path;
- the place name comes from `USER_DISTRICT → USER_STATE → USER_COUNTRY_NAME` (all filled by #16)
  because the RN store has no `APPROX_LOCATION_NAME` key;
- no haptics and no width-morph spring.

Also corrected: the comment on `ChatAction.SelectAlignmentChip` in `state/useChat.ts` claimed the
Android core "has the field but nothing that fills it" and that the action was an RN-only
addition. Stale — core fills it in `ChatViewModel.recordAlignmentPick()` (:906) as of the fix
recorded under "Three defects the parallel build found in my own core" above.

Structural deviation worth knowing: Compose keeps the Home `stickyHeader` slot in agentic mode
and renders `Spacer(0.dp)` in it, because its entry is a keyed DSL item. RN drops the row
entirely instead — a zero-height cell listed in `stickyHeaderIndices` is **not** a no-op (it is
still measured and pinned, and it rides the same viewability path that drives `MarkImageViewed`),
so `stickyIndex` comes back `-1` and `stickyHeaderIndices` is left `undefined`. Nothing is sticky
in agentic mode either way.

Verified: `npx tsc --noEmit` clean in `versions/v2/react-native/packages/farmerchat-react-native`
(exit 0, no output). The package has no test runner and none was added. **Not run on a device or
in Expo Go**, consistent with the rest of 2.0.0.

**Unmeasured on device, called out explicitly:** the agentic Home header's pin/fade and the
gradient band's fade are driven from `onScroll` (`scrollEventThrottle={16}`) writing one
`Animated.Value` with `setValue`, consumed by exactly three interpolations (header opacity,
header `translateY`, band opacity) — the band's 24 fade rows share that one parent opacity.
Compose reads `firstVisibleItemScrollOffset` in the draw phase and pays nothing per frame; the RN
equivalent is a non-native-driven JS update per scroll event. Correct by construction, but its
cost on a low-end Android device has **not** been measured, and cannot be without a device run.

### react-native capability chips (2026-09-02)

The defect: **every** alignment chip sent its own text as the question, so the two CAPABILITY
surfaces did nothing — `gps-prompt` never started the location flow and `upload-photo` never
opened a picker. A capability chip must invoke a capability and send only the OUTCOME. Ported
from the android reference (`AlignmentChip` companion constants, `sendLocationSharedQuery`,
Compose's `handleAlignmentChip` + armed collector, `CapabilityChipTest`).

- **The routing rule lives in core, not the screen.** `core/types.ts` gained `AlignmentChipWire`
  (`ACTION_SELECT = "invoke"` — *not* `"select"`; `VALUE_SHARE_LOCATION =
  "share_precise_location"` — *not* the commented-out `share_location`; `VALUE_TAKE_PHOTO`,
  `VALUE_CHOOSE_FROM_GALLERY`, `VALUE_NOT_NOW`), `AlignmentChipRoutes` and
  `routeAlignmentChip(kind, chip)`. Android duplicates the `when` per flavour and tests a local
  mirror; RN exports one function so the screen and the tests exercise the SAME code. A
  capability fires only when kind, `action` and `value` all agree.
- **Both chip sites route through it.** `ChatScreen.handleAlignmentChip` is called from the
  exclusive surface's `onChipPress` *and* the additive one's `onAlignmentChipPress` inside
  `AiBubble`. It is a plain function in the render body, not a `useCallback([])`, because it
  reads `locationPrompt.state` live — a memoized closure would freeze the Idle guard at mount.
- **The producer.** New `ChatAction.SendLocationSharedQuery` → `useChat.sendLocationSharedQuery`,
  the only constructor of the `'location'` `ChatMessage` variant (closes the producer gap in
  item 5 above and the docs/05 question). Validates `isLoading` + a non-blank
  `alignmentOriginalQuery` BEFORE mutating, so a bail can never leave an orphan placeholder
  spinning; then one atomic update marks `share_precise_location` picked, appends the bubble
  (blank address → no bubble) and the placeholder; then `sendTextQuery({ staged })` sends the
  ORIGINAL query with `triggered_input_type = align_chip_sel` and appends no user bubble. A retry
  of that send passes `staged: null` with the bubble id as its anchor, so it re-asks with a fresh
  placeholder and never a second location bubble.
- **The address.** Assembled as the app's `composeResolvedAddress` does: best place name, state,
  country — blanks dropped, de-duplicated, `", "`-joined. RN has no `APPROX_LOCATION_NAME` key
  (android writes it from `user_profile.display_address`, which this store does not model), so
  `USER_DISTRICT` stands in for it — the same substitution the Home location pill already
  documents. A **guest** has none of the three written, so the address is blank and no bubble is
  appended: the app-parity branch, not a failure.
- **The location flow.** `useLocationPrompt` gained the `'localContext'` source +
  `triggerFromLocalContext()` (android `LocationTriggerSource.LocalContext` /
  `triggerFromLocalContext`) and the terminal `Continue { source, reason }` / `Cancel { source }`
  events android core already had. `ChatScreen` subscribes for the life of the screen but stays
  inert until armed with the source message id — held in a **ref**, since the listener is
  registered once and a `useState` read would be stale forever — so an outcome belonging to Home
  or Settings is ignored. It only starts when the machine is `Idle` (Compose's guard).
  `LocationPromptHost` needed no change: its `silentDuringFetch` excludes only `'widget'`, so
  `localContext` inherits the interstitial + fetch overlay exactly like android.
- **Every terminal exit settles the armed caller, and settling is not succeeding** (android's
  later fix, ported). All six non-Idle states now settle: `Interstitial` / `RequestPermission` /
  `RequestEnableGps` / `FetchingLocation` exit through `skip` (the host's secondary, close and
  `onRequestClose`), `Recovery` and `Error` through `dismissError` — their primary buttons
  (`shareLocation` / `retryFromRecovery`) re-enter the flow rather than ending it, so
  `dismissError` is their only TERMINAL exit — plus a permission denial that lands back on Idle,
  and the fetch itself. Both terminal actions emit `Cancel` (what Compose's own error-card
  buttons do via `onSkipClicked`; android's `dismiss()` emits `Continue("dismissed")` instead —
  equally non-success). Without an emission the chat surface would wait forever and the blocking
  question would never be answered.
- **…but only when a flow was actually running.** `skip` / `dismissError` capture the state
  before clearing it and emit only if it was not already `Idle` — android's `wasActive` guard,
  and not optional here: `AppNavGraph`'s logout handler calls `dismissError()` on an idle
  machine, which would otherwise hand an armed chat surface a decline the farmer never
  triggered. A `stateRef` mirrors the machine synchronously (React state cannot be read back
  after a `set`; android reads its `_state` StateFlow). The armed id is likewise cleared
  *before* dispatching, so a fetch that lands after a skip is dropped rather than double-sent. The success rule therefore is NOT an inline `reason ===
  'location_fetched'`: `core/locationOutcome.ts` (the RN counterpart of
  `LocationPromptModels.kt`) owns the event union, `LOCATION_OBTAINED_REASONS`
  (`location_fetched`, `location_fetched_pending_api`, `post_settings_preference_exists` —
  verbatim from core; RN emits only the first), `isLocationObtained()` and
  `isTerminalLocationOutcome()`. It is deliberately a module with **no runtime imports**, unlike
  `useLocationPrompt` (`expo-location` + React), so the rule is testable out-of-tree at all.
- **Decline / cancel / failure** send `fc_v2_app_label_location_permission_declined` (real key,
  app `Labels.kt:222`, **verified present on endpoint #3**, English fallback "Continue without
  sharing my location" kept as the usual safety net) as an ordinary follow-up, so the blocking question still resolves. Added
  to `core/labels.ts` verbatim — no invented key.
- **RN adaptation, more complete than android** (the same call web made): android's error /
  recovery `dismiss()` emits no event, leaving a chat surface armed forever; RN settles both
  `skip` and `dismissError` as a `Cancel`. Since this host also uses `dismissError` for the
  Recovery sheet, RN answers a blocking question android would leave hanging.
- **Photo chips** call `captureImageFromCamera` / `pickImageFromGallery` — extracted from
  `PhotoInputSheet` so the picker opens **directly** instead of re-asking Camera-or-Photos, which
  the chip already answered. The result follows Compose's launchers: in composer mode it is
  ATTACHED (thumbnail + typed question); on the 1.0.0 surface it sends immediately with an empty
  question. Neither photo chip is marked picked (android does that for location only).
- **Also corrected:** the `AlignmentChip.action` doc comment in `core/types.ts` said `"select"`
  invokes a capability — the wrong string, and precisely the trap these constants exist to avoid.
- **Not ported.** The app's chat-history `message_type_id 12 → location_shared` mapping stays
  out: its own `TODO(location-history)` says the type id and address field are unconfirmed
  placeholders. Deltas mirrored from android, deliberately not "fixed": no `parent_message_id`
  (the SDK's `TextPromptRequest` has no such field) and no `agentic_chip_*` analytics properties
  on the location path.

Verified: `npx tsc --noEmit` clean (exit 0, no output) in
`versions/v2/react-native/packages/farmerchat-react-native`; **40 assertions** in 14 cases
mirroring android's `CapabilityChipTest` (routing rule + literal wire strings) and
`LocationOutcomeTest` (obtained-vs-settled), run out-of-tree — `node capabilityChip.test.ts` on
Node 26's native type stripping, importing the real `routeAlignmentChip` from `src/core/types.ts`
and `isLocationObtained` from `src/core/locationOutcome.ts`, so the tested rule and the shipped
rule cannot diverge — 14 cases passed, 0 failed. The package still has no test runner and none
was added. **Not run on a device or in Expo Go**, and the wire itself still cannot be exercised.

### web composer, markdown and agentic Home wiring (2026-09-02)

Five gaps closed in `versions/v2/web/packages/farmerchat-web`. Three of them were **orphaned or
dead code that compiled** — the same defect class android-views and react-native hit.

**1. `alignmentSelectedValues` was never written (web copy of core defect #1).**
`state/useChat.ts` declared it, initialised it to `[]`, and `ChatScreen.tsx` read it at two
render sites — but nothing appended, so the selected/locked chip treatment could never trigger.
Fixed as a pure reducer, `recordAlignmentPick` in `core/alignment.ts`, called from a new
`ChatActions.selectAlignmentChip(messageId, kind, chip)`.

Two deliberate differences from the Kotlin, both because web's `sendFollowUpQuestion` is *shared*
by the alignment chips, the related-question chips **and** the text composer:

- The action takes the surface's own `messageId`, so the match is structural. Recording inside
  `sendFollowUpQuestion` (as Android can, because its action carries only a question string and it
  re-checks that string against the last surface's chips) would mark a chip as chosen whenever a
  farmer happened to type a matching string.
- The pick is stored **verbatim, never trimmed**. `AlignmentSurface` compares it against
  `chip.value` / `chip.label` untrimmed, so the previous call site's `.trim()` would have recorded
  a string that can never match — the chip would stay unhighlighted. Pinned by two assertions.

`agentic_chip_type` (`AlignmentKind.analyticsType`) now rides the **existing**
`SEND_QUERY_INITIATED` event, and only for a chip tap, so ordinary sends keep their 1.0.0 payload.
No new event name (root CLAUDE.md §2).

**2. `InputComposer.tsx` + `composerLayout.ts` were orphaned** — they typechecked and no screen
imported them. Wired into both screens, gated exactly like Compose's
`isComposerUi = config.enableAgenticChat` (still default **false**), so a host that has not opted
in sees the untouched 1.0.0 input surface:

| | 1.0.0 path (flag off) | 2.0.0 path (flag on) |
|---|---|---|
| Chat input | `PrimaryInputButtons` + `TextInputOverlay` | `<InputComposer floating compact>`, slides out while an answer generates |
| Home input | `PrimaryInputButtons` (sticky) + `TextInputOverlay` | `<InputComposer floating showAura>` |
| Home surface | green | grey reading surface + gradient band |
| Home app bar | green | transparent — green and glow come from the band |
| Home sticky slot | Photo/Speak/Type | not rendered |
| In-feed `FeedHeader` | rendered | skipped (top-of-feed header already carries the title) |
| Card tap | #13 `fetchImageStatement` → pre-generated answer | **skips #13**, sends the card question as a plain text query |
| Scroll padding | none | `composerBarHeight({floating:true})`, so the last card clears the bar |

Details worth recording:

- `onSend` is `(text) => void`, so the attachment is parent state (Compose's `photoUris`).
  `ComposerAttachment` gained an optional `file`, since the web needs both the object URL (preview)
  and the `File` (payload) where Compose needs only a `Uri`.
- `PhotoInputOverlay` gained `attachOnly`. In composer mode it hands the image straight back as an
  attachment and the composer field owns the question — asking for the question twice would be a
  dead end.
- The alignment escape hatch ("Type or say it.") previously opened the very overlay the composer
  replaces. It now focuses the composer field in composer mode (Compose calls `focusTextInput`),
  via the existing `onReady` imperative handle.

**3. `markdown.tsx` → v2.** Parsing moved to a new pure `ui/components/markdownParse.ts` (no DOM,
no React) so it runs under the framework-less Node test runner; `markdown.tsx` is now render-only.
Added from the Kotlin: GFM tables (2-line separator look-ahead, per-column alignment, 1–2 columns
weighted / 3+ columns scrollable with a right-edge fade, alternating rows), `---`/`***`/`___`
dividers, header levels clamped 1..3, and the 24/20/16/12/5px block-pair rhythm
(`blockTopSpacing`). The regex tokenizer was replaced by a recursive scanner mirroring
`appendEmphasis` / `findItalicClose`: the old `\*[^*\n]+\*` **structurally could not** match
`*italic **bold** italic*`, and an unmatched marker used to eat the rest of the line.

Two supersets of the Kotlin kept deliberately (§3 no-regression — parity here is additive):
fenced code, blockquotes, links and inline code spans have no Compose counterpart but web has
rendered them since 1.0.0. Two web-only notes: list items are parsed one block each (for the
rhythm) then regrouped into `<ul>`/`<ol>` by the renderer so the list keeps its screen-reader
semantics, which Compose does not need since it draws its own bullets; and a `href` containing
parentheses is still unsupported (the pattern stops at the first `)`), which is unchanged 1.0.0
behaviour. Non-`http(s)` schemes are never linkified.

**One visible rendering change, taken deliberately for parity.** 1.0.0 joined consecutive
non-blank lines into a single `<p>` separated by `<br>`; Compose emits one `Paragraph` block per
non-blank line, and the 20px consecutive-paragraph rhythm is defined on that. Web now matches
Compose, so **hard-wrapped** prose renders with 20px between each wrapped line rather than as one
tight block. In practice the API sends a paragraph as one long line separated by blank lines, which
is unaffected; history messages and pre-generated statements have not been checked against real
payloads, so this is the change to look at first if wrapped text ever looks too airy.

**4. `LocationChatBubble`.** New `ui/components/LocationChatBubble.tsx` plus a `'location'`
variant on `ChatMessage`, rendered right-aligned from `ChatScreen`. Fixed 290x184, three corners
at 20px with the bottom-right sharp, tinted map header, caption + bold address footer. The pin and
its ellipse are inline SVG because the package ships no image assets. **The variant is never
constructed — matching android, where `grep 'LocationMessage('` finds no constructor either.** No
appender was invented; see item 5 of "Still to do".

**Update (2026-09-02) — the variant is now produced.** The android reference gained
`ChatViewModel.sendLocationSharedQuery`, so web ported it: `useChat.sendLocationSharedQuery` is the
one and only constructor of the `'location'` variant, driven from `ChatScreen`'s capability-chip
routing (item 4 of "Still to do"). Web-specific notes:

- **Address assembly.** The app joins approximate-location-name → state → country, blank parts
  dropped, de-duplicated, `", "`-joined. *(Superseded 2026-10-08: web v2 now has
  `APPROX_LOCATION_NAME` and uses it first.)* Previously: web had no `APPROX_LOCATION_NAME` key — android writes it
  from `user_profile.display_address`, which web's `GetLocationResponse` does not model — so
  `USER_DISTRICT` stands in for it, the same substitution `HomeScreen`'s location pill already
  documents. State/country come from `USER_STATE` / `USER_COUNTRY_NAME`.
- **The location flow.** `useLocationPrompt` gained `triggerFromLocalContext(onOutcome)` (android
  `LocationPromptManager.triggerFromLocalContext`, source `'chat'` = `LocationTriggerSource.
  LocalContext`) and `cancelPendingOutcome()`. The outcome callback is armed per tap, so an outcome
  from Home's weather flow or Settings can never land on a chat surface, and it is dropped when
  `ChatScreen` unmounts. Deliberately no `hasKnownLocation()` short-circuit: the chip asks for a
  fresh fix. It no-ops unless the machine is `Idle` (Compose's guard).
- **Web adaptation, more complete than android.** Android's error/recovery `dismiss()` emits no
  event, leaving a chat surface armed forever; web settles `skip` and `dismissError` as a cancel,
  so the blocking question always gets an answer — the decline label
  `fc_v2_app_label_location_permission_declined` (real key, app `Labels.kt:222`, **not served by
  endpoint #3 yet**, English fallback "Continue without sharing my location") sent as an ordinary
  follow-up.
- **Photo chips.** `take_photo` / `choose_from_gallery` click hidden file inputs directly rather
  than opening the Photo overlay's source picker. The picked file follows Compose's launchers: in
  composer mode it is ATTACHED (thumbnail + typed question); otherwise it sends immediately with an
  empty question.
- **Not ported.** The app's chat-history `message_type_id 12 → location_shared` mapping stays out:
  its own `TODO(location-history)` says the type id and address field are unconfirmed placeholders.

**5. `TermsOfUseDialog` + agentic Home visuals.** New
`ui/components/TermsOfUseDialog.tsx`; `useHome` gained `farmerchatTermsOfUse`, `fetchPrivacyPolicy`
(#4) and `acceptTerms` (#7), with the fetch on **every** Home entry (app parity — an open request
can arrive before it lands, so Home waits up to 5 s for a non-blank URL, then toasts and consumes
the request). The trigger is the existing public `openScreen('termsofuse')`, mirroring
android-compose's `SCREEN_TERMS_OF_USE`, because the app's trigger is a Plotline card CTA and §6
bans Plotline. No WebView on the web, so the document loads in a sandboxed `<iframe>` — the same
mechanism `LegalContentModal` already uses. No Plotline ToS event is emitted; only the existing
`TERMS_OF_USE_OPENED`.

**Gap: `openScreen('termsofuse')` is a no-op in `CHAT_ONLY`.** That mode has no Home (docs/07 C3 —
`routeFromSplash` lands straight in chat and `ChatScreen.onClose` exits the SDK instead of popping
to Home), and Home is what renders the dialog. Rather than let `replaceAll` blow the chat away and
strand the user on an excluded screen, the request is ignored — the same silent-ignore the
neighbouring `settings` / `chatHistory` cases use when their config flag is off. A CHAT_ONLY host
needing the terms must present them itself. Android has the same shape of hole (its
`SCREEN_TERMS_OF_USE` also routes via Home) but was not audited for it here.

Home visuals ported: grey reading surface, green→transparent band (solid to 58.8% of a band 36.6%
of the surface tall) with the yellow glow and a fade over the first 215px of scroll, centred 42px
logo mark, leaf-flanked header, location pill, centred greeting. *(Superseded 2026-10-08 by the
"Web v2 compose-fidelity pass": Sunbeams and the 5-state pill are ported and the greeting is gone
in agentic mode, as in compose.)* **Two gaps (then):** the decorative
swaying `Sunbeams` are not ported, and the location pill is not Compose's `HomeLocationPill` (web
has no such widget — it reads the district/state/country prefs the location flow writes, and
otherwise invites sharing).

**Verified:** `npx tsc --noEmit` clean, `npx tsc -p tsconfig.test.json` clean, `npx vite build`
clean (59 modules), `npm test` **138 assertions** across 4 files — the two new ones,
`test/alignmentPick.test.ts` (11) and `test/markdown.test.ts` (42), were added to the `test`
script. **Not run in a browser** — no screen has been rendered, so all of the above is build- and
test-verified only, like the rest of 2.0.0.

### iOS capability chips (2026-09-02)

The same defect the android / react-native / web sections describe, fixed on **both** iOS
flavours: every alignment chip sent its own text as the question, so `gps-prompt` never started
the location flow and `upload-photo` never opened a picker. A capability chip must invoke a
capability and send only the OUTCOME. Ported from the android reference (`AlignmentChip`
companion constants, `sendLocationSharedQuery`, Compose's `handleAlignmentChip` + armed
collector, `CapabilityChipTest`, `isLocationObtained()`). iOS additionally had **no `ChatMessage`
location variant at all**, so there was nothing to render a shared location with.

- **The routing rule lives in Core, not the screens.** `AlignmentChip` gained the five wire
  constants — `actionSelect = "invoke"` (*not* `"select"`), `valueShareLocation =
  "share_precise_location"` (*not* the commented-out `share_location`), `valueTakePhoto`,
  `valueChooseFromGallery`, `valueNotNow` — plus `capability(for kind:) -> AlignmentCapability?`
  and the `AlignmentCapability` enum (`shareLocation` / `takePhoto` / `chooseFromGallery`). Like
  react-native and web, and unlike android (which duplicates the `when` per flavour and tests a
  local mirror), both flavours and the tests exercise the SAME function. A capability fires only
  when kind, `action` and `value` all agree; everything else — `not_now` included — returns nil
  and stays on the plain follow-up path. The stale `AlignmentChip.action` doc comment claiming
  `"select"` invokes a capability (the exact trap these constants exist to avoid) was corrected.
- **The location variant.** New `ChatMessage.location(LocationMessage(address:id:))`, id-prefixed
  `location_` alongside `user_` / `ai_` / `loading_`. Rendered right-aligned in **both** flavours:
  `FCLocationChatBubble` (SwiftUI, `ChatComponents.swift`) and `FCUILocationBubbleCell` (UIKit,
  `ChatCells.swift`, with its own `Row.location` case and cell registration). Fixed 290x184, three
  corners at the `bubbleCornerRadius` knob with the bottom-trailing tail sharp, green-at-16% map
  band, centred pin over a soft ellipse, caption + bold address at the `messageFontSize` knob —
  the same two knobs the user/AI bubbles honour. The pin is an SF Symbol and the ellipse is drawn
  (`UIBezierPath` / `Ellipse()`) because neither package ships image assets, the same substitution
  web made with inline SVG. `FCUIChatBubbleCell` handles `.location` defensively (right-aligned
  address text) so a routing regression degrades instead of rendering a blank bubble.
- **The producer.** New `ChatAction.sendLocationSharedQuery(sourceMessageId:address:)` →
  `ChatViewModel.sendLocationSharedQuery`, the only constructor of the variant. Guards `isLoading`
  and a non-blank `alignmentOriginalQuery` BEFORE mutating (a bail after the append would orphan
  the bubble with no answer coming); then marks `share_precise_location` picked on the source
  surface — `recordAlignmentPick` cannot, since the chip's text is never sent, so there is nothing
  for it to match on — appends the bubble (blank address → **no bubble**, app parity) and calls
  `sendQuestionInternal(..., triggeredInputType: "align_chip_sel", replaceExistingUserBubble:
  true)`, which suppresses the user bubble and appends its own placeholder after the location
  bubble. A retry of that send reuses the same path, so it re-asks with a fresh placeholder and
  never a second location bubble. `sourceMessageId` is the raw `AiResponse.id`, not the prefixed
  `ChatMessage.id`; UIKit's cell registrations hand out the prefixed one, so both flavours unwrap
  via `messagesById[...]` first.
- **The address.** The app composes `display_address, geography_level2_name, country_name`. iOS's
  `#11` response (`GetLocationResponse`) carries `district / state / country`, and the three prefs
  it writes (`USER_DISTRICT` / `USER_STATE` / `USER_COUNTRY_NAME`) are the only location prefs this
  SDK has — **no `fc_sdk_` key was invented** (§2), so the address is those three, blanks dropped,
  de-duplicated, `", "`-joined. The same substitution react-native documents for its missing
  `APPROX_LOCATION_NAME`. A **guest** has none of them written, so the address is blank and no
  bubble is appended: the app-parity branch, not a failure.
- **The location flow.** `LocationPromptSource` gained `.localContext` and
  `LocationPromptManager` gained `triggerFromLocalContext()` (android
  `LocationTriggerSource.LocalContext` / `triggerFromLocalContext`). `events` is a Combine
  `PassthroughSubject` — **confirmed** to multicast to every subscriber, so unlike android (which
  had to convert a single-consumer channel) no plumbing change was needed; it has **no replay**,
  which is exactly why both flavours subscribe for the life of the screen and gate on an arming
  token (`pendingLocationSourceId`) rather than subscribing on the chip tap. An outcome belonging
  to Home or a widget trigger is therefore ignored. The flow starts only when the machine is
  `.idle` (Compose's guard); a nil UIKit nav controller (no host mounted) is a no-op — neither
  flavour ever falls back to sending the chip's text, which is the defect being replaced.
- **iOS-only manager change, matching android's later `dismiss()` fix.** iOS's manager emitted
  **nothing** on the decline paths: `runLocationFlow` parks in `.recovery` (permission denied) or
  `.error` (GPS off / fetch failed) and returns, and `dismissError()` just called `reset()` — so an
  armed chat surface would have hung forever and the blocking question never resolved, the same
  hole android's `dismiss()` had. `LocationPromptEvent` is now `locationUpdatedFromWidget` /
  `locationSaved(source:)` / `skipped(source:)`, and `dismissError()` emits the terminal `skipped`
  that covers gpsUnavailable, permission-denied-recovery and fetch-failed alike. `.recovery`
  deliberately stays non-terminal (`onAppForeground()` can re-run the flow out of it);
  `locationUpdatedFromWidget` stays payload-free because `FarmerChatView` compares it with `==`;
  `reset()` stays silent because it is teardown, like android's `clearState()`. Emissions read
  `source` **before** `reset()` and happen at the terminal call sites, never inside `reset()` —
  `saveLocation` already calls `reset()` before emitting, so a cancel inside `reset()` would fire
  on every success. `dismissError()` carries android's `wasActive` guard for the same reason: a
  dismiss after a success must not send a second, contradictory event.
- **The success predicate is in Core, shared by both flavours**, as android's
  `LocationPromptEvent.isLocationObtained()` is: `isLocationObtained` plus `terminalSource`, and
  the flavours' collector is `guard event.terminalSource == .localContext` then
  `if event.isLocationObtained`. **No reason-string set was added, deliberately.** Android needs
  `LOCATION_OBTAINED_REASONS` because its `Continue` case is overloaded — `dismiss()` emits
  `Continue(reason = "dismissed")`, so `Continue` alone stopped meaning success. iOS has no
  `reason` field and no overloaded case: `.locationSaved` is the single success emission and
  `.skipped` the single settled-without-location one, so the case itself carries the meaning and a
  `reason` would be a wire-adjacent field with no discriminating power (§2). Android's two extra
  reasons (`location_fetched_pending_api`, `post_settings_preference_exists`) belong to the app's
  post-Settings recovery paths that no SDK ports, and its own comment says the SDK only ever emits
  `location_fetched`.
- **Both hosts show the overlay for the new source.** `LocationPromptHostView` (SwiftUI) and
  `FCUILocationPromptHost` (UIKit) gated their permission/fetch loading overlay to
  `source == .weather`, which would have put **zero pixels** on screen for a chip-triggered flow;
  `.localContext` now shares it. Compose's host keeps the interstitial for every source; widget /
  deeplink stay silent by design.
- **Decline / cancel / failure** send `fc_v2_app_label_location_permission_declined` (real key,
  app `Labels.kt:222`, **verified present on endpoint #3**, English fallback "Continue without
  sharing my location" kept as the usual safety net) as an ordinary follow-up, so the blocking question still resolves. Added
  verbatim to `AgenticLabels` alongside `fc_v2_app_label_your_location` for the bubble caption —
  no invented key. (Both localize; the surrounding v1 short keys still do not — item 9 above.)
- **Photo chips** open the picker **directly** — SwiftUI sets `showCamera` (after
  `FCCameraPermission.request()`) or `showGallery`, skipping the Camera-or-Photos sheet the chip
  already answered; UIKit presents a `UIImagePickerController` with the explicit `sourceType`,
  falling back to `.photoLibrary` when the camera is unavailable (simulator). Neither photo chip
  is marked picked (android does that for location only).
- **Not ported.** The app's chat-history `message_type_id 12 → location_shared` mapping stays out:
  its own `TODO(location-history)` says the type id and address field are unconfirmed
  placeholders. Deltas mirrored from android, deliberately not "fixed": no `parent_message_id`
  (`TextPromptRequest` has no such field, so no chip send carries it) and no `agentic_chip_*`
  analytics properties (iOS's analytics props are a flat dictionary with no chip
  type/value/label/status fields), so the location send reports as an ordinary text query —
  `triggered_input_type` IS `align_chip_sel`.
- **Also corrected:** the `alignmentSelectedValues` doc comment claimed the field is never
  populated on either platform. `recordAlignmentPick` has populated it since the alignment-pick
  fix; `sendLocationSharedQuery` is now its second writer.

**Verified** (exact commands, `.build` deleted first so none is an incremental no-op):

```
versions/v2/ios/FarmerChatCore    $ swift build                        → Build complete! (8.70s)
versions/v2/ios/FarmerChatCore    $ swift test                         → 79 tests, 0 failures
SIM=$(xcrun --sdk iphonesimulator --show-sdk-path)
versions/v2/ios/FarmerChatCore    $ xcrun swift build --sdk "$SIM" \
    -Xswiftc -target -Xswiftc arm64-apple-ios15.0-simulator            → Build complete! (7.34s)
versions/v2/ios/FarmerChatSwiftUI $ xcrun swift build --sdk "$SIM" \
    -Xswiftc -target -Xswiftc arm64-apple-ios16.0-simulator            → Build complete! (10.40s)
versions/v2/ios/FarmerChatUIKit   $ xcrun swift build --sdk "$SIM" \
    -Xswiftc -target -Xswiftc arm64-apple-ios15.0-simulator            → Build complete! (8.92s)
```

The 79 (up from 60) include two new files mirroring android's tests: `CapabilityChipTests` (12
cases — the five literal wire strings, the decline label key + English fallback,
`align_chip_sel`, the routing rule in both directions, a `CaseIterable` guard that every
`AlignmentCapability` is reachable, the `location_` id prefix) and `LocationOutcomeTests` (7
cases — android's `LocationOutcomeTest`: saved → obtained, skipped/dismissed → NOT obtained,
widget update → neither obtained nor terminal, exactly one case is a success, the
terminal-source filter, and the flavours' full decision table). **Not run on a device or
simulator** — build- and test-verified only, like the rest of 2.0.0.

## Known intentional gaps (docs/03 adaptation table)
- Play in-app update/review: all platforms ⛔ (host concern).
- Plotline/MoEngage/Adjust/Firebase SDKs: all platforms ⛔ (replaced by analytics listener).
- SIM number prefill: Android only.

## E2E verification infrastructure (2026-07-20)
- **Local mock backend** at `tools/mock-server/` (`node server.js`, Node stdlib only, no deps) serves every endpoint in docs/02 (34 + `get_new_access_token`/`send_tokens` + geolocate stub) on `http://0.0.0.0:8899` with deterministic happy-path JSON matching the wire model field names/shapes. Verified by curl: `initialize_user`, `verify_otp` (accepts any 4-digit OTP), `get_answer_for_text_query` (real markdown, never 500), daily feed (ContentCard+image / single-select gender / multi-select crops, `ssfr_enable:true`), `conversation_chat_history` (query/response/audio/image/follow-up message types), follow-ups (3), transcribe (conf 0.93), synthesise (serves a valid `/static/tts.wav`), weather, `get_labels` (233 English keys from `Labels.kt`), conversation_list (paginated + grouping). See `tools/mock-server/README.md`.
- **`customBaseUrl` on `FarmerChatConfig`** now exists on all four platforms (overrides the `environment` base URL when set — a real shipped feature + the way samples target the mock): Android `customBaseUrl: String?` (+Builder, `resolvedBaseUrl` used by Retrofit; `compileDebugKotlin` clean); iOS `customBaseURL: String?` (+`resolvedBaseURL`, used by APIClient/TokenRefresher; `swift build` clean + Core `swift test` 12/12); RN `customBaseUrl?` (resolveConfig; `tsc --noEmit` clean); Web `customBaseUrl?` (resolveConfig; `tsc --noEmit` + `vite build` clean). Sample-app cleartext permitted (NOT the libraries): Android samples (compose/views/consumer) ship `res/xml/network_security_config.xml` (10.0.2.2/localhost/127.0.0.1) referenced from their manifests; iOS samples (SampleApp/ConsumerApp) carry an ATS `NSAllowsLocalNetworking` + localhost exception in their generated Info.plist. Sample base URLs: Android emulator `http://10.0.2.2:8899/`, iOS sim / Web / Node `http://localhost:8899/`, RN emulator `http://localhost:8899/` after `adb reverse tcp:8899 tcp:8899`.

## Open verification debts
(record here anything claimed but not proven — keep current)

- **CHAT_ONLY guest chat — real-backend gap found & fixed on android-compose (2026-07-27)**: the C3 row (line ~58) marked CHAT_ONLY ✅, but that was only verified *landing* in a fresh chat against the **mock**. Driven against **real dev** (emulator Pixel 6 Pro, guest, `sample-jetpack`), a guest CHAT_ONLY chat could NOT complete: `get_answer_for_text_query` returned **500** because CHAT_ONLY skips onboarding+Home, which are where the guest session and the conversation are established. Root causes + fixes (android only):
  - **No guest session** → `401 "Authorization credentials were not provided"`. Fix: `FarmerChatRoot.navigateFromSplash()` now calls `sessionManager.initializeGuestUser()` (idempotent) on CHAT_ONLY entry when `!hasSession()`.
  - **Empty `conversation_id`** (Home normally creates it via `new_conversation`) → 500. Fix: CHAT_ONLY entry now creates a conversation (`chatUseCase.newConversation`) and stores `NEW_CONVERSATION_ID` before entering chat.
  - **First typed message classified as `triggered_input_type:"follow_up"`** (composer always dispatches `SendFollowUpQuestion`) — a follow-up to an empty chat. Fix (core `ChatViewModel`, covers compose+views): first turn (`messages` has no `UserMessage`) sends `"text"`.
  - **Text composer overlapped the Photo/Speak/Type bar** (mode-agnostic, compose `ChatScreen`): the composer overlay and `PrimaryInputButtons` were both rendered at the bottom, so the tiles peeked above the text field. Fix: wired `TextInputOverlay(onFocusChange=…)` to a `textComposerActive` flag and hid `PrimaryInputButtons` while the composer is focused (the composer has its own camera/mic). Runtime-verified.
  - **Chat close (X) navigated to SDK `Home`** — but CHAT_ONLY has no Home, so it dumped the user on the SDK's home feed instead of returning to the host app. Fix (`FarmerChatRoot` chat `onClose`): in CHAT_ONLY, `(context as? Activity)?.finish()` exits the SDK back to the host. Runtime-verified: FAB → ask → close now lands on the host's `MainActivity`.
  - Runtime-verified on real dev 2026-07-27: `initialize_user 201 → new_conversation 200 → get_answer_for_text_query 200` with a real AI answer. `set_preferred_language` turned out NOT to be required. `./gradlew :farmerchat-core:compileDebugKotlin :farmerchat-android-compose:compileDebugKotlin` clean; `:sample-jetpack:assembleDebug` + `installDebug` runtime-verified.
  - **Cross-platform port status (2026-07-27):**
    - **Bootstrap (A)** was refactored into a shared core helper `FarmerChatGraph.ensureChatOnlySession()` (guest-init if `!hasSession` + `newConversation` → `NEW_CONVERSATION_ID`). **android-compose** (`FarmerChatRoot.navigateFromSplash`) and **android-views** (`SplashFragment`) both call it. ✅ compose runtime-verified; views compile-verified (`:farmerchat-android-views:compileDebugKotlin` clean). **iOS/RN/web do NOT need (A)** — their Splash establishes the guest session for all modes AND their `ChatViewModel/useChat.ensureConversationId()` creates the conversation lazily before the first send (so `conversation_id` is never empty). Android was the outlier (its `ChatViewModel.conversationId()` only reads the pref, never creates).
    - **Close→exit (B)**: android-compose (`FarmerChatRoot` onClose) + android-views (`ChatFragment` close) → `Activity.finish()` in CHAT_ONLY. ✅ compose runtime-verified, views compiled. **DONE 2026-07-27 (build/type-check-verified, not runtime):** ios SwiftUI (`ChatView` X → `exitSdk()` dismisses the top presented VC when `args.source=="chatOnly"`; `swift build` clean), ios UIKit (`ChatViewController.close()` → `presentingViewController?.dismiss` for `source=="chatOnly"`; `swift build` clean), react-native (added public `onExit` to `FarmerChatCallbacks`; `AppNavigator.navigateChatCloseToHome` CHAT_ONLY fires `analytics.fireCallback('onExit')`; `tsc` clean), web (added public `onExit` + `analytics.exit()`; `FarmerChatRoot` onClose fires it in CHAT_ONLY; `tsc`+`vite build` clean). New `onExit` callback documented in docs/07.
    - **Composer overlap (C)**: android-compose (`ChatScreen` hide `PrimaryInputButtons` when `textComposerActive`). ✅ N/A on android-views (full-screen overlay `fcOverlayRoot` covers the buttons) and iOS-UIKit (composer is a modal `UIAlertController`) and web (overlay covers via z-index, no visible overlap). **DONE 2026-07-27 (build/type-check-verified):** ios SwiftUI (`ChatView` gates `inputBar` on `!showTextInput`; `swift build` clean), react-native (`ChatScreen.tsx` gates `PrimaryInputButtons` on `!textInputVisible && !voiceInputVisible && !photoInputVisible`; `tsc` clean).
    - The core `triggered_input_type` first-turn fix already covers android-views via shared core; iOS/RN/web build their query with a real conversation_id so it doesn't apply.
    - **iOS SwiftUI RUNTIME-verified (2026-07-30, iPhone 17 sim, real dev)**: `ios/SampleApp` (source packages) launched `-fcChatOnly -fcAutoOpenChat` → guest `initialize_user 201 → new_conversation 200 → get_answer 200` (real armyworm answer rendered, `scratchpad/ios_chatonly2.png`); the input bar renders with no Photo/Speak/Type overlap (Fix C). Fix B (X→exit) remains build-verified only — no idb/XCUITest tap driver available to exercise the button.
    - **Env-scoped conversation-id invalidation (D) — FIXED + iOS RUNTIME-verified (2026-07-30):** a stored `NEW_CONVERSATION_ID` is only valid on the backend that created it, so a `conv-*` id left over from a mock/other-env run made `get_answer` 500 with no self-recovery (this is what 500'd the very first iOS run above, on a stale `conv-1060`). Fix: at SDK-init the composition root records the current base URL under `fc_sdk_LAST_BASE_URL` and, if it differs from the stored value, drops `NEW_CONVERSATION_ID` so the next chat mints a fresh conversation. Applied to **all platforms**: android-core (`FarmerChatGraph` init block + `SdkPreferences.LAST_BASE_URL`), ios-core (`FarmerChat.init` + `PrefKey.lastBaseURL`), react-native (`FarmerChatSdk.ready()` hydrate + `StorageKeys.LAST_BASE_URL`), web (`createServices` + `PrefKeys.LAST_BASE_URL`). **iOS runtime proof** (iPhone 17 sim; foreign id `conv-FOREIGN-42` + `LAST_BASE_URL=http://localhost:8899/` seeded into the app's own container store, then launched against dev): init logged the base-URL mismatch and cleared the id → `ensureConversationId` saw `pending=nil` → `new_conversation 200 → get_answer 200 → follow_up_questions 200` (was 4×500 on the foreign id before the fix). A clean-slate dev run (no stale id) is likewise `new_conversation 200 → get_answer 200`. `swift build` clean after removing the temporary trace logs. android/rn/web carry the identical logic, re-compiled clean 2026-07-30 (`:farmerchat-core:compileDebugKotlin` BUILD SUCCESSFUL; rn `tsc --noEmit` clean; web `tsc --noEmit` + `vite build` clean). **Web + RN also RUNTIME-verified 2026-07-30** via Node harnesses that execute the actual fix code from source (esbuild-bundled): **web** runs `createServices({environment:'dev'})` against a localStorage-shaped store pre-seeded with `LAST_BASE_URL=http://localhost:8899/` + `NEW_CONVERSATION_ID=conv-STALE-web` → the id is dropped and `LAST_BASE_URL` becomes the dev base (`WEB-INVALIDATION-PASS`); a same-env second init keeps a fresh id (`WEB-CONTROL-PASS`, guards against false invalidation). **RN** runs the real `FarmerChatSdk.ready()` with a Map-backed mock `@react-native-async-storage/async-storage` (expo-* / react-native stubbed — they degrade gracefully, matching the optional-peer rule) pre-seeded with `conv-STALE-rn` + mock base → the id is cleared in both the in-memory cache and AsyncStorage and the base becomes dev (`RN-INVALIDATION-PASS` + `RN-CONTROL-PASS`). Only **android** (D) remains runtime-unverified-in-isolation (its CHAT_ONLY happy path was runtime-verified on the dev emulator 2026-07-27); the init-block logic is identical and compiles. NB: on the iOS **simulator**, external `xcrun simctl defaults write` writes a *global* prefs domain that cfprefsd shadows over the app's *container* store, so seeding the stale id that way produces a false negative (app reads global, writes container) — the faithful test seeds the container plist while the sim is shut down.

- **web (real headless-browser E2E run, 2026-07-20)**: the `web/example` Vite app was driven end-to-end in **real headless Chromium (Playwright 1.61, chromium 149.0.7827.55)**, 37 screens/features screenshotted into `scratchpad/web-*.png` and each read back. Backend: **the local mock (`http://localhost:8899`) for ALL web paths** — dev cannot be used from a browser because the dev guest API key ships blank on web (`initialize_user` → 403, `get_labels` → 401 without it), so mock is the honest backend for the whole web run (docs/08 fallback rule; the mock already carries permissive CORS + OPTIONS handling). Verified at runtime against the mock: Splash (`web-01`), Language + select (`web-02/03`), EnterName + typed/save (`web-04/05`), Home feed with greeting/weather-chip/content+single+multi+SSFR cards (`web-06/06b`), Home Type overlay (`web-07`), **Photo overlay** via real `<input type=file>` upload showing the question composer (`web-08`), **Speak/voice overlay** via `--use-fake-device-for-media-stream` — "Listening…" + timer + record button rendered, MediaRecorder available headless (`web-09`), Chat **real AI answer** (markdown, #27 via mock, `web-10`), follow-ups #29 (`web-11`), **TTS Listen → playing/Pause** (synthesise #31 + HTMLAudioElement, `web-12`), share/download (`web-13`; `navigator.share` absent headless → canvas PNG download path + toast), **retry** (aborted request → inline error + failed-bubble Try again, `web-14`), Drawer with previous-questions populated for an authenticated user (`web-15`), AccountBenefits (`web-16`), Auth phone with India +91 + WhatsApp/SMS channels (`web-17`), **OTP `1234` → Verify → success** (`web-18`), AccountSuccess (`web-19`), Settings Day/Night/Auto + Log out (`web-20`), SettingsName (`web-21`), LanguageChooser (`web-22`), Help FAQ + **legal iframe modal** (`web-23/23b`), ChatHistory grouped list (`web-24`), **history thread** with query/response/voice-clip/image bubbles (`web-25`), Error/NoInternet via offline (`web-26`), LocationPrompt "Share Location" interstitial (`web-27`). Features: **inline embed** filling a sized host `<div>` on a wide viewport (C1, `web-28`); **blue-brand recolor** with computed `--fc-appbar` = `#1565C0` on Home + Language (theming, `web-29/30`); **CHAT_ONLY** lands in a fresh chat (C3, `web-31`); **stringOverrides** visibly change copy — app bar "AgriAssist", feed header "Your AgriAssist briefing", Language "Pick your language (host copy)" + "Continue with AgriAssist" (C5, `web-32/33`); **HOST_TOKEN** skips OTP and lands authenticated — drawer shows no Sign up, Settings shows Log out (C2, `web-34/35`); **all C4 semantic hooks fired** in-browser (onScreenView for every screen, onSessionStart, onChatOpened, onMessageSent, onAnswerReceived with a real message_id, onError for both API + network) alongside 32 distinct raw analytics events matching the app's names, captured from the console. **Four web-only field-name conformance bugs were found and fixed during the run** (mock/app source were correct; the web port read wrong names — now brought to parity, `tsc --noEmit` + `vite build` clean): (1) `ConversationListItem` read `question`/`title` → now `conversation_title` (history-list + drawer titles were blank); (2) `ConversationChatHistoryResponse` read `messages`/`results` → now also `data` (history threads rendered empty); (3) `FaqItem`/(4) `HelpLegal` read `url`/`terms_of_use` → now the API's `webview-url` and nested `{ "webview-url" }` objects under `terms-of-use`/`privacy-policy` (FAQ/legal links never opened). Remaining web runtime gaps: verified against mock only, not a live/prod backend (dev needs a provisioned guest key); Web OTP SMS autofill (`navigator.credentials` OTP) not exercised (no real SMS); real camera/mic hardware not used (fake device covers the recorder logic + the picker `<input>`, not physical capture); typeScale still scales only the base/em-relative sizes, not absolute-px component CSS (docs unchanged on this).
- **web**: WhatsApp OTP-less token endpoint (#19 `verify_otp_less_android_sdk_token`) is implemented in the API client but has no UI caller — on web the WhatsApp channel only triggers `generate_otp` with `channel:["whatsapp"]` + manual code entry (docs/03: "channel buttons only").
- **web**: endpoint #18 `check_device_user_limit` and #33 `add_query_to_history` are implemented in the API client but not called from any screen (app calls them from MoEngage/device-limit flows that have no web equivalent).
- **web**: home feed cache pref `CACHED_HOME_FEED_RESPONSE` is written but not used for offline render (app renders cached feed while offline; web shows the error screen with retry).
- **react-native**: example Expo app launched on an Android emulator (Pixel 6 Pro, Expo Go 2.32.20 / SDK 52) against the live dev environment on 2026-07-17. Verified end-to-end at runtime: guest init (#1), language list + save, enter-name save, splash routing (session persisted across JS reload), dashboard (feed 204-empty state), analytics event stream (App_Opened → Screen_Viewed/Exited → Save_Language_Click_Event → Onboarding_completed_Step1 → Name_Save_Click_Event → Dashboard_Viewed → Chat_Icon_Clicked → Send_Query_Initiated), chat text send with "Not sent" + Try again retry path. Two example-app fixes were needed to run it: `example/metro.config.js` (watch the symlinked package, block its own node_modules to avoid duplicate React) and adding `expo-asset` as a direct dependency (npm nested it under `expo/node_modules` where @expo/metro-config cannot resolve it).
- **react-native (E2E mock run, 2026-07-20 — closes the AI-answer debt)**: the Expo example was driven end-to-end on the Android emulator (Pixel 6 Pro, Expo Go SDK 52) against the **local mock** (`customBaseUrl: 'http://localhost:8899/'` + `adb reverse tcp:8899/8081`), blue host brand, with a screenshot read back for every step. **The previously-blocked chat AI-answer render path is now PROVEN**: Type input → send → Chat renders the **real markdown answer** (`get_answer_for_text_query` #27, never 500 on mock: bold/italic/numbered-list/blockquote + "Source: FarmerChat Knowledge Base") with the user question bubble (`rn-11`/`rn-11b`); **3 follow-up chips** (#29) render with Ask buttons and tapping one sends a `follow_up` query that returns a new answer (`rn-12`/`rn-12b`/`rn-12c`); **voice** Speak → record (mic permission granted) → send → `transcribe_audio` #16 accepted at **confidence 0.93** (>0.7) → auto-sent as a `voice` query → answer (`rn-13*`); **image** Photo → gallery pick → `image_analysis` #28 → answer ("Source: FarmerChat Vision", `rn-14*`); **TTS Listen** → `synthesise_audio` #31 → expo-av Started/Stopped_Playing_Response_Audio (`rn-15`); **Share** → native Android share sheet with the answer text (`rn-16`, react-native-view-shot absent in Expo Go so it degrades to text share). Onboarding + Home also re-driven on mock: Language(+select) `rn-02*`, EnterName(+typed/save) `rn-03*`, Home feed with greeting/weather-chip(27°)/content+single-select+multi-select+SSFR(Fertilizer advisory Wheat/Maize) cards `rn-05*`, Home Type overlay `rn-06*`, Drawer `rn-18`, AccountBenefits `rn-07`, Auth phone with +91 India + WhatsApp/SMS channels + empty-number validation `rn-08*`. Analytics/hooks stream observed live in Metro (App_Opened → Screen_Viewed/Exited, Save_Language, Onboarding_completed_Step1, Name_Save, Dashboard_Viewed+Card_Shown×3, Chat_Icon_Clicked, Send_Query_Initiated/Send_Query, FirstQueryAsked, Transcription_Success, Started/Stopped_Playing_Response_Audio, Answer_Share_Button_Clicked, Permission_granted; semantic cbs onSessionStart/onScreenView/onChatOpened/onMessageSent/onAnswerReceived). No SDK code changes were needed — `npx tsc --noEmit` clean for both package and example; every screen rendered correctly at runtime.
- **react-native**: NOT completed at runtime this pass **due to the shared emulator being actively driven by the concurrent Android-native agent** (it continuously re-foregrounded `org.digitalgreen.farmerchat.sample.{compose,views}` and cycled the adb server, breaking any multi-tap in-app flow on Expo Go — an environment constraint, not an SDK defect): OTP **entry+verify** (`1234`→success→AccountSuccess) — the phone screen + SMS `generate_otp` initiation (`Mobile_verification_Started`) were reached, but the multi-step verify could not be completed in a stable focus window (mock `verify_otp` accepts any 4-digit code, so this is expected to pass once run in isolation); the drawer-reached screens **Settings/SettingsName/LanguageChooser/Help**; **ChatHistory** (needs an authenticated session for `conversation_list` data); **Error/NoInternet**, **LocationPrompt**, and the dev-500 **chat retry** path (mock never 500s; retry was proven on dev 2026-07-17). The SDK code for all of these is complete and type-checked; they should be re-driven on a non-shared emulator. `expo-location` fetch also not exercised.
- **react-native**: WhatsApp OTP-less token endpoint (#19 `verify_otp_less_android_sdk_token`) is implemented in the API client but has no UI caller — the WhatsApp channel triggers `generate_otp` with `channel:["whatsapp"]` + manual code entry (docs/03: "channel buttons only").
- **react-native**: endpoints #18 `check_device_user_limit` and #33 `add_query_to_history` are implemented in the API client but not called from any screen (app calls them from device-limit / MoEngage qapair flows that have no SDK equivalent).
- **react-native**: SoundPool success/error tones omitted (trigger commented out in the app per docs/01 §3.8); haptics omitted.
- **react-native (UI fidelity pass, 2026-07-20)**: the UI layer was reworked to 1:1 with the Compose SDK module (`android/farmerchat-android-compose`) after emulator screenshots showed deviations. Theme is now a direct port of the app's `theme/` package (Green500 #00C950 / Green700 / Green800 / Green950, zinc neutrals, `Light/DarkContentColors`, `BrandSemanticColors`, radii 24/12, Type.kt sizes). The app's vector drawables (6-petal `fc_logo_mark` + camera/mic/keyboard/send/mode/home/settings/etc.) were rasterized from their VectorDrawable path data into black+alpha PNGs under `src/assets/`, tinted at runtime via `Image` `tintColor` (no `react-native-svg` dep added). Labels now resolve through the exact `fc_v2_app_label_*` keys — a generated `src/core/labels.ts` copied 1:1 from core `Labels.kt` (235 keys) — so server translations resolve (supersedes docs/05 #7 for RN). **Re-verified on the Android emulator (Pixel 6 Pro, Expo Go, dev env, 2026-07-20)**: Language and Home screens now match the Compose reference (black flower logo, white rounded-card radios with green fill + dot when selected, white "All languages" pill, dark-green chevron CTA, "Terms of use · Privacy policy" legal row; Home green surface + yellow-glow app bar with dark-green hamburger chip, greeting skeleton, Green800 Photo/Speak/Type tiles with green icons, server label "What are farmers asking today?", green-glow empty-feed footer). Screenshots: `scratchpad/fc_lang_clean.png`, `fc_lang_selected.png`, `fc_name.png`, `fc_home.png`. Metro bundles from `src` via the package `react-native` field so the PNG assets resolve in the example app.
- **ios (all)**: SampleApp (SwiftUI path) **runtime-tested on an iPhone 17 simulator (iOS 26.1) against the live dev environment on 2026-07-17**: guest init #1 (incl. IP-country refresh on repeat init), Google geolocate, languages #2, `set_preferred_language`, splash routing, home feed with live cards, `new_conversation` + text query #27 returning a rendered AI answer, `openChat(question:)` deep link, and the 500-retry path (P3 ×3 with backoff, backend message surfaced) were all exercised end-to-end. Five real bugs were found and fixed during the run: (1) ios-core had no built-in default guest `API-Key` (docs/03 says `guestApiKey` *overrides* a built-in default; Android has `DEFAULT_GUEST_USER_API_KEY`) — added `FarmerChatConfig.defaultGuestApiKey` fallback; (2) `bootstrapLanguages` ran guest-init *before* geolocate and never re-sent coords, so the dev server never resolved a country and languages #2 400-looped ("Country code is required") — reordered to the app's geo → init(with coords) → languages chain, country/state params now always sent (empty when unknown, Retrofit parity), and init failure now routes to the error screen (app parity); (3) `ensureGuestSession` early-returned when tokens existed, blocking the country refresh — now always calls the API like Android's `initializeGuestUser` ("safe to call repeatedly"); (4) `initialize_user` decode failed on `show_crops_livestocks: "False"` (string, not bool) — added `FlexibleBool` wrapper to Core; (5) `IntentClassificationOutput` typed `clarification_needed` as `Bool?` and `confidence` as `Double?`, but the app model (`TextPromptResponse.kt`) has a nested `ClarificationNeeded{asset,concern,additional_context}` object and a String confidence — chat #27 decode failed until the model was corrected. Additionally ios-swiftui's language-screen silent retry cancelled its own in-flight request (the retry `.task` lived on the error-branch view that the `.loading` transition destroys) — retry work is now an unstructured Task. Still NOT exercised at runtime: AVAudioRecorder capture/transcribe, AVPlayer TTS, PHPicker/camera capture, CoreLocation prompt flow, share/download card, OTP auth, and the entire FarmerChatUIKit screen set. CocoaPods `pod lint` not run (no CocoaPods in environment).
- **ios sample**: the runnable target is generated with xcodegen (`ios/SampleApp/project.yml`, bundle id `org.digitalgreen.farmerchat.sample`, iOS 16, local SPM deps on all three packages). Two environment findings: the app must be at least ad-hoc signed (`CODE_SIGN_IDENTITY: "-"`) or simulator Keychain writes fail with missing-entitlement and every request goes out tokenless (server 401 "Authorization credentials were not provided"); and the **dev** backend only resolves a guest's country (required by languages #2) from lat/long sent on `initialize_user` — its IP-based fallback never populated `country_code` in our runs — so the sample ships the app's dev `GEO_KEY` as `geoApiKey`. Chat #27 also 500s server-side for users with no server-side language/location state; completing real language onboarding first (the sample's `-fcAutoOnboard` automation hook drives it through the public `OnboardingViewModel`) makes #27 return answers. `weather_forecast_lite` 404s (`{"profile":"User profile not found"}`) for fresh guests without GPS location and Home degrades gracefully (same as RN).
- **ios-core**: endpoints #18 `check_device_user_limit`, #19 `verify_otp_less_android_sdk_token`, and #33 `add_query_to_history` are implemented in `FarmerChatAPI` but have no UI caller (same rationale as web/RN; docs/03 "wa.me deep link channel" — WhatsApp channel sends `generate_otp` with `channel:["whatsapp"]` + manual entry with `.oneTimeCode` autofill).
- **ios-core**: label keys use short SDK base keys (e.g. `choose_language_title`) with the app's English fallbacks, same debt as react-native (docs/05 #7); server translations resolve only once keys are mapped to the app's `Labels.kt` keys. (Exception: the Language-screen tagline now uses the app's real server key `fc_v2_app_label_farmerchat_tagline` with the Compose English fallback "Practical advice for your crops and animals".)
- **ios-swiftui (UI fidelity pass, 2026-07-20)**: reworked the SwiftUI layer to 1:1 with the Compose SDK module (`android/farmerchat-android-compose`) after simulator screenshots showed deviations. `FCLogoMark` is now the real 6-petal `logo_mark` flower — a `Shape` that parses the VectorDrawable path data (130×130 viewBox, 12 petals) — tinted `foregroundPrimary` (black on onboarding, green on the AI bubble/spinner), replacing the old `leaf.circle.fill` glyph. `FCPrimaryButton` fill is now always `buttonPrimarySurface` (Green800) and stays dark when disabled — only content alpha drops (SwiftUI `.disabled()` was dimming the whole button to sage, so hit-testing is gated via `.allowsHitTesting` instead); radius corrected 16→12, chevron now `buttonPrimaryAccent` (Green500). `FCRadioRow` is a full-width card (white default / `surfaceActive` translucent-green when selected) with a filled indicator (gray unselected, white ring + green dot selected), radius 12. `FCSecondaryButton` is now a filled `surfaceSecondary` card (was an outline). Inputs/OTP corrected to radius 12. Language screen: black logo (44), displaySmall title, white "All languages" pill, correct tagline, two-line "Terms of use · Privacy policy" legal row. EnterName: centered, black logo, filled Skip. Chat: user bubble is now the light reading surface with the asymmetric bottom-trailing-sharp corner (was a green bubble), follow-up rows use the green "Ask" pill (SuggestedCard). Home: feed cards radius 24, greeting displaySmall (24), centered "For your farm today". Auth: displaySmall titles, selector radius 12. **Re-verified on the iPhone 17 simulator (iOS 26.1, dev env, 2026-07-20)**: Language, EnterName, Home and Chat screens match the Compose reference. Screenshots: `scratchpad/ios-lang-fixed.png`, `ios-entername.png`, `ios-home-fixed.png`, `ios-chat-fixed.png`. Not visually re-verified this pass (shared components updated, code aligned but no screenshot): Auth, Account, Settings, ChatHistory, Help, LanguageChooser, Drawer, LocationPrompt, FullScreenMessage.
- **ios-core**: `RequestEnableGps` state exists but iOS has no in-app GPS-enable resolution (no Play Services equivalent); services-off maps to `error(.gpsUnavailable)` with a settings hint.
- **ios-swiftui**: mark-viewed uses `onAppear` in the LazyVStack as the ≥50%-visible approximation; scroll-position restore after history prepend is approximate (load-earlier button rather than scroll-triggered prepend).
- **ios-uikit (parity pass, 2026-07-20)**: brought the iOS-15-native path to app parity on the previously-reduced items and **runtime-verified on the iPhone 17 sim (iOS 26.1) against the local mock** (backend recorded per screenshot; mock chosen because it deterministically serves the SSFR feed, real #27 answers, OTP and grouped history that dev cannot). **Closed this pass**: (1) real slide-in **drawer** `FCUIDrawerViewController` (scrim + 300pt panel animating in from the left; header, active Home row, recent-8 typed rows + See all, C3-gated History/Language/Settings/Help, guest sign-up footer) replacing the action sheet — `ios-uikit-19-drawer.png`; (2) **SSFR card** `FCUISsfrCell` rendered above the feed, gated by `ssfr_enable` + `config.enableSsfr` — `ios-uikit-05-home.png`; (3) **`FCUILocationPromptHost`** overlay above the nav stack driven by `LocationPromptManager` (interstitial/permission/fetch/recovery/error), weather CTA now routes through it — `ios-uikit-25-location.png`; (4) **centralized error route** via an `ErrorNavigationManager` on `FarmerChatViewController` (splash-init + chatHistory now fire `navigateToError(fromScreen:retry:)` instead of ad-hoc `present`) — `ios-uikit-24-error.png`; (5) **C3 screen toggles** at the UIKit UI level (CHAT_ONLY `routeFromSplash`, `showDrawer` hides hamburger, `showSettings`/`showHistory` gate drawer rows, `enableSsfr` gates the SSFR card); (6) **C4 `openScreen`** consumed by `FarmerChatViewController.pendingScreenTarget`→`navigateDrawerRoute`; C2 host-token already gates the sign-up affordances via `isAuthenticated`. Blue-theme recolor also screenshot-verified (`ios-uikit-blue-home.png`). **Still simplified (below app fidelity, documented)**: Type/follow-up input is a UIAlertController text field (no bottom-sheet composer overlay); Home weather chip is a nav-bar temp/icon button (no full weather chip); onboarding Language has no legal-links footer/tagline; no clarification-specific chip title; no in-thread load-earlier affordance; voice-clip bubble lacks a progress bar; share only (no separate download-to-Photos); Chat has a close/back button rather than a hamburger→drawer. iOS 16+ hosts may still prefer FarmerChatSwiftUI (`FarmerChat.shared.present(from:)`). Screens NOT separately screenshotted on the UIKit path this pass (code present, reachable via the flow): EnterName, Auth phone/OTP, AccountBenefits/Success, SettingsName, in-chat voice/image/TTS/share/retry.
- **Whole-suite audit (2026-07-31) — findings + fix ledger.** A five-area cross-platform audit (onboarding/auth, home-feed/content, chat-send, networking/analytics, settings/help/drawer) against the app source + docs. Networking invariants (priorities, retry set, backoff, 401 single-flight, headers, base URLs, prefs namespacing, dead-endpoint absence) verified CLEAN on all platforms. Confirmed divergences below (Android is the clean reference for nearly all); each value app-verified. **Status: ✅=fixed+built this pass, ⬜=pending (turnkey — app-correct value given).**
  - **Chat send-path** (app: `PlantixRequest.kt`, `TextPromptRequest.kt`, `ChatViewModel.kt`):
    - **[HIGH] Image query GPS wire keys** `lat`/`lng` (numeric) → must be **`latitude`/`longitude` (String)**; also add `triggered_input_type:"image"` + `retry`. ✅ web, ✅ react-native; ⬜ **iOS** (`ChatModels.swift` PlantixRequest CodingKeys `lat`/`lng`, populated `ChatViewModel.swift:~623`).
    - **[MED] `triggered_input_type` values** — app canon: `text`/`voice`/`image`/`follow_up`/`read_full_advice`/`ssfr`/`weather` (wire field; analytics uses the same value under prop `click_type`). Fixed typed→text, voice→voice, read_full_advice, ssfr/weather where applicable: ✅ web (typed/voice/transcribe/read_full_advice), ✅ react-native (read_full_advice + ssfr/weather; text/voice/image/follow_up were already correct); ⬜ **iOS** (sends `keyboard`/`card`; also SSFR/weather ignored at `ChatViewModel.swift:~162`).
    - **[LOW] `#27 message_id`** must be sent **`""`** (app hardcodes it; response id is authoritative). ✅ web, ✅ react-native; ⬜ **iOS** (`ChatViewModel.swift:~394` `UUID().uuidString`).
    - **[LOW-MED] Image request** must also send `triggered_input_type:"image"` + `retry` (retry=true on image-retry). ✅ web/RN added the fields with `retry:false`; wiring `retry:true` on the retry invocation ⬜ all three (minor). ⬜ **iOS** whole item.
  - **Home feed / pre-generated content** (app `HomeScreen.kt`):
    - **[HIGH] `#26 ImageStatementResponse.follow_up_questions`** typed `string[]` but the wire sends **objects** `{follow_up_question_id, sequence, question}` (sort by sequence, map to strings) — breaks decode (iOS) / renders `[object Object]` (RN/web). ⬜ **iOS, react-native, web** (`HomeModels.swift:~188`, rn `types.ts:~622`, web `types.ts:~549`). (Same class as the #29/#32 fix already applied — mirror it.)
    - **[HIGH] iOS SwiftUI select cards never render** — `HomeView.swift:~231-253` switches `type` on `"single_select"`/`"multi_select"`; real cards are `type=="question"` + `selection_type` `"single"`/`"multiple"` (UIKit `HomeCells.swift` is correct). ⬜ **ios-swiftui**.
    - **[HIGH] iOS UIKit "Read full advice" swap missing entirely** — no read_full_advice affordance in the UIKit package. ⬜ **ios-uikit**. **Closed in versions/v2 on 2026-10-08** (see "Chat screen re-sync with app dev/v2.5"); v1 still ⬜.
    - **[MED] Content-card tap `triggered_input_type`** `"card"` → **`"image_card"`/`"text_card"`** by section type. ✅ android-compose; ⬜ **ios-swiftui/uikit, react-native, web** (android-views already correct).
    - **[MED] Nav question order** `title ?: question_text` → **`question_text ?: title`**. ✅ android-compose; ⬜ **react-native** (`HomeScreen.tsx:~363`). (iOS/web already correct.)
    - **[MED] Weather CTA label** wrong key `"weather_advice_question"` → **`WHAT_IS_THE_PRESENT_WEATHER`**. ⬜ **ios-swiftui/uikit, web**. (android, RN correct.)
    - **[MED] `WeatherResponse` fields** typed numeric → app sends **String** (verbatim; drop `Math.round`/`Double`). ⬜ **iOS, react-native, web**.
    - **[MED] Read-full-advice `statement_id` + append-not-replace** — the query must carry `statement_id` and KEEP the pre-gen block (append). ⬜ **iOS, react-native, web** (the `triggered_input_type` value is fixed on web/RN; statement_id + append remain).
    - **[LOW] On-card headline order** (cosmetic) `title`-first → `question_text`-first. ✅ android-compose; ⬜ others.
    - **[LOW] iOS UIKit livestock→crop-endpoint mis-route** (`HomeViewController.swift:~364`); single-select sends option text not id. ⬜ ios-uikit.
    - **[LOW] `statement_id` typed number + `typeof==='number'` gate** (app: Int OR String) — a string UUID skips pre-gen fetch/mark-viewed. ⬜ react-native, web.
  - **Help / Settings / Language** (app `HelpSupportResponse.kt`, `SettingsViewModel.kt`, `LabelManager.kt`):
    - **[HIGH] Help FAQ/legal dead wire models** — FAQ reads flat `url`, legal reads flat `terms_of_use`/`privacy_policy`; app returns **`webview-url`** (alt `webview_url`) + nested **`terms-of-use`/`privacy-policy`** objects each with `webview-url`. FAQ taps + legal links are dead. ⬜ **iOS (SwiftUI+UIKit via core `HelpModels.swift`), react-native** (`types.ts:~575`, `HelpScreen.tsx`). (Android + web already correct — copy web's shape.)
    - **[MED] Settings→Language save doesn't persist `SELECTED_LANGUAGE_DISPLAY_NAME`** → drawer shows the OLD language. ⬜ **react-native** (`useSettings.ts:~109`), **web** (`useSettingsLanguage.ts:~97`). (Android, iOS correct.)
    - **[MED] Help `theme` query param** wrong/missing (map appearance→light/dark/default). ⬜ android-compose (passes raw mode), react-native (null), web (omitted), iOS (nil). (android-views correct.)
    - **[LOW] Label code not `.trim().lowercase()`d before `${key}_${lang}` lookup** → any casing/whitespace misses every localized key. ⬜ react-native, web, iOS. (Android correct.)
    - **[LOW] Web select-language previews replace label map without committing code** (transient English revert); drop non-app `language_id` from save analytics. ⬜ web.
    - **[LOW] `api/faqs` missing trailing slash** → redirect. ⬜ react-native, web.
    - **[LOW] iOS drawer See-all no offline pre-check** (no reachability primitive in the iOS SDK at all). ⬜ ios. **[LOW] Android location no-network checked late.** ⬜ android.
  - **Analytics** (app `OnboardingAnalyticsEvents.kt`/`GpsAnalyticsEvents.kt`/`AnalyticsScreens.kt` — names must match CHARACTER-FOR-CHARACTER; Android/RN/web conform):
    - **[HIGH] iOS wrong/invented event names** (`AnalyticsDispatcher.swift`): `Weather_Clicked`→**Weather_Forecast_Viewed**, `Share_Response_Clicked`→**Answer_Share_Button_Clicked**, `Download_Response_Clicked`→**Answer_Save_Button_Clicked**, `Name_Updated`→**Name_Save_Click_Event**, `Name_Skipped`→**Name_Skip_Click_Event**, `Language_Selected`/`Language_Submitted`→**Save_Language_Click_Event**; invented `Follow_Up_Question_Clicked`/`Read_Full_Advice_Clicked`/`Card_Dismissed`/`GPS_Location_*` → mirror Android (or remove; GPS→app lowercase names). ⬜ **iOS**.
    - **[MED] `screen_name` prop values** short tokens (`"SPLASH"`,`"HOME"`,`"CHAT"`) → app strings (`"Splash Screen"`,`"Dashboard Screen"`,`"Chat Screen"`, …). ⬜ **iOS** (`AnalyticsDispatcher.swift:~62`), **web** (`analytics.ts:~100`).
    - **[MED] iOS force-update event casing** (`:57-58`, latent, no emitter). ⬜ iOS.
    - **[LOW] RN HOST_TOKEN 401 ordering** — `tokenAuthenticator.ts:~51` runs SDK refresh before the HOST_TOKEN branch (iOS/web short-circuit HOST_TOKEN first). ⬜ react-native.
  - **NOT a bug (verified faithful, do not "fix"):** web onboarding `accept_terms` failure→error-screen matches the app's `handleError`/`shouldNavigateToError` pattern; null-confidence transcription rejection (`(conf ?? 0) > 0.7`) is a documented stricter-than-app simplification; location fetch chain has no IP fallback (iOS matches).
  - **FIXED + BUILD-VERIFIED (2026-07-31, done by hand after the parallel fix agents all failed on API-connection errors):**
    - **iOS** (Core+SwiftUI+UIKit `swift build` all clean): chat-send image GPS `lat/lng`→`latitude/longitude` String + `triggered_input_type:"image"`; `message_id ""`; `triggered_input_type` typed→text / follow-up→follow_up / read_full_advice / weather / ssfr; **#26 follow-up objects** (new `HomeFollowUpQuestion` string-or-object decoder + sorted `[String]` computed prop); **WeatherResponse** temp/precip→String (+ SwiftUI/UIKit render); **SwiftUI select cards** discriminator (`type=="question"`+`selection_type`); content-card `image_card`/`text_card` (SwiftUI+UIKit); weather label `WHAT_IS_THE_PRESENT_WEATHER` (SwiftUI+UIKit); **Help FAQ/legal `webview-url`** (new decoders, computed `.url`/`.termsOfUse`/`.privacyPolicy`); **analytics** 9 event renames (Weather_Forecast_Viewed, Answer_Share/Save_Button_Clicked, Name_Save/Skip_Click_Event, Save_Language_Click_Event×2, Force_Update casing×2) + all `screen_name`→app strings; label code `.trim().lowercased()`; help `theme` from appearance.
    - **web** (`tsc`+`vite build` clean): chat-send (image GPS String, message_id "", triggered_input_type text/voice/read_full_advice); **#26 follow-up objects**; content-card `image_card`/`text_card`.
    - **react-native** (`tsc` clean): chat-send (image GPS String, message_id "", read_full_advice, SSFR/weather); **#26 follow-up objects**; nav-question `question_text`-first; **Help FAQ/legal `webview-url`**.
    - **android-compose** (`compileDebugKotlin` clean): content-card `image_card`/`text_card`, nav-question order, headline order.
  - **ALSO FIXED 2026-07-31 (continued):** **react-native** — content-card `image_card`/`text_card`, WeatherResponse String (+ render), Settings→Language **display-name persistence**, help `theme` from appearance, label `.trim().toLowerCase()`, `api/faqs/` slash, **HOST_TOKEN 401 ordering** (host `tokenProvider` short-circuits before Step-1 SDK refresh) — `tsc` clean. **web** — WeatherResponse String (+ render), weather label `WHAT_IS_THE_PRESENT_WEATHER`, display-name persistence (+ dropped non-app `language_id` from save analytics), help `theme`, label lowercasing, all `screen_name`→app strings, `api/faqs/` slash — `tsc`+`vite build` clean. **iOS** — read-full-advice `triggered_input_type` now `"read_full_advice"` (`swift build` clean).
  - **STILL ⬜ (iOS-only remainder; each needs a new feature or app/Android semantic verification, not a mechanical fix):** UIKit read-full-advice affordance (new UI); read-full-advice `statement_id` + append-not-replace (`ChatMessage.AiResponse` doesn't carry the pre-gen `statement_id` — needs plumbing); GPS analytics names + `Card_Dismissed`/`Follow_Up_Question_Clicked` (the app defines neither `Card_Dismissed` nor `Follow_Up_Question_Clicked` as events and its GPS names are lowercase `location_*`/`Permission_*` — mapping the 3 iOS `GPS_Location_*` emission points to the right app events needs per-site semantic tracing); UIKit multi-select livestock→`update_user_profile`(`live_stock_details`) routing + single-select gender-id (no wired livestock core action; needs a new action + app verification of the gender value); image `retry:true`-on-retry wiring (all platforms — minor). RN/web/android are otherwise complete.
- **Chat-history cross-platform audit + fix (2026-07-30).** A four-way audit (reference app + docs = ground truth, vs each SDK) found the list screen, server-driven grouping, and integer-`message_type_id` thread reconstruction faithful, but real bugs in reopening a past conversation — all confirmed against the app wire models (`ConversationChatHistoryResponse.kt` = `{conversation_id, data}` only; `ConversationListResponse.kt` `next` = a **URL string**). All fixed this pass; **Phase 1 (functional)** below is done + verified, **Phase 2 (guest gating)** is tracked as a separate follow-up.
  - **(#32) thread pagination — iOS/RN/web only ever loaded page 1.** They derived `historyNextPage` from `next_page`/`total_pages`, which the #32 response never carries → always null → scroll-up/load-earlier never fired. The app pages by `data.isNotEmpty()` → `page+1` until an empty page. Fixed to base "more" on the **raw** response array length (not the mapped bubbles — a page can be all type-7/unknown): ios-core `ChatViewModel.loadChatHistory` (`response.messages.isEmpty ? nil : page+1`), rn `useChat.loadChatHistory` (`items.length > 0 ? page+1 : null`), web `useChat.loadChatHistory` (same). android already did this (unchanged — it's the correct reference). *(Web's prior E2E passed only because the mock faked `next_page`.)*
  - **(#22) list pagination — web only stuck on page 1.** Web's `normalizeConversationList` accepted only a numeric `next_page`/`next`; the real `next` is a URL string. Rewrote it to mirror the app's `canLoadMore` priority (`has_more` → `next` URL non-blank → count/page math → `total_pages` → items-non-empty). **Runtime-verified**: 13/13 cases in a Node harness (`scratchpad/web_history_test.cjs`), incl. the URL-`next` case. RN/android already parsed the URL.
  - **Web dropped historical follow-up chips.** #32 `questions` are objects `{follow_up_question_id, sequence, question}` but web typed them `string[]` and filtered `typeof q === 'string'` → all discarded. Fixed the type + mapper to read `q.question` (RN/iOS already did). Also fixed web `itemIcon` aliases (`audio/voice/image/statement`) and added list-append dedupe by `conversation_id`.
  - **Hallucinated wire fields removed (rule §2).** web `ConversationListItem` had `question`/`title`/`created_at`/`[key:string]` and ios `ConversationListItem` had `question`/`title`/`created_at`/`updated_at`; the app model has only `conversation_id, conversation_title, message_type, grouping, created_on, content_provider_*`. Trimmed both; iOS `displayText` no longer prefers a non-existent `question` field (now `conversation_title`). tsc/build caught every downstream reference (Drawer, FarmerChatRoot).
  - **iOS SwiftUI/UIKit prepend UX.** Fixing pagination exposed a scroll bug (loading older messages jumped to the newest). SwiftUI now scrolls to bottom only on a new **bottom** turn and pins the previously-top message after a prepend (dropped the 800 ms sleep hack); UIKit gained the missing **load-earlier** row (tap → next older page) + offset-preserving prepend.
  - **Verification**: android-core `:farmerchat-core:compileDebugKotlin` clean; ios `swift build` clean on Core+SwiftUI+UIKit; rn `tsc` clean; web `tsc` + `vite build` clean + the 13/13 list-pagination unit harness. **Web data-layer E2E against the LIVE mock backend (2026-07-30, 13/13, `scratchpad/web_mock_e2e.cjs`)**: drove the real `normalizeConversationList` over actual mock HTTP — #22 page1→more / page2→stop (`has_more:false`) / cross-page dedupe; #32 type-7 `questions` are objects and the fix recovers the chips (with a regression assertion that the old `string[]` filter drops all), page1→`historyNextPage=2`, page2 empty→`null` (load-earlier terminates, no infinite loop). This required fixing the mock itself (`tools/mock-server/server.js`): `conversation_list` now serves two real pages with a URL-string `next` + `has_more` flip, and `conversation_chat_history` now honors `page` (page≥2 → empty `data`) instead of ignoring it and looping forever. Full UI-level browser automation (Playwright driving the rendered React through auth→drawer→history→thread scroll, incl. the guest sign-up-card gating render) was NOT run this pass — gating + rendering stay compile/inspection-verified. iOS thread pagination shares core logic mirrored from android but was not re-run on the sim this pass; UIKit load-earlier is **build-verified only** (no XCUITest tap driver). **NOT faithful-to-app but kept (minor):** SwiftUI/compose/rn/web show a "No chats yet" empty state on the full list that the app lacks (better UX, harmless).
  - **Phase 2 — guest gating (DONE 2026-07-30, all platforms).** The app hard-gates history behind auth; guests get a "Sign up to save your questions" card. Now mirrored on every surface: android-compose (already correct, reference) + **android-views** (`JourneyController`: recent-chats section + See-all + silent-refresh + on-auth-flip all gated on `isAuthenticated && showHistory`), **ios-swiftui** (`DrawerView` recent section + History row + `openDrawer` silent refresh gated), **ios-uikit** (`DrawerLocationError` recent section + History row gated + the previously-missing on-auth `refresh` added), **react-native** (`DrawerContent` recent section gated + `ChatHistoryScreen` mount refresh auth-guarded), **web** (`Drawer` recent section + History nav gated, `ChatHistoryScreen` mount refresh guarded + guest sign-up card). Guests see the sign-up affordance and cannot reach the ChatHistory screen; **OTP-verified AND HOST_TOKEN users still see history** — HOST_TOKEN counts as authenticated on every platform (android + web both seed `OTP_VERIFIED=true` in their host-token path — web `SessionManager.seedHostToken` — so `isAuthenticated()` was already true for HOST_TOKEN, consistent with the web-34/35 E2E where a host-token session showed "Log out", no "Sign up"; ios `markHostAuthenticated`; rn `accessToken` present). The web change also added a redundant `authMode==='HOST_TOKEN' && accessToken` branch to `isAuthenticated()` as a safety net (harmless — it only widens the true-set for a case the `OTP_VERIFIED` seed already covers; verified no existing caller — Settings, EnterName, drawer, splash, home/location/auth — changes behavior for guest/OTP/HOST_TOKEN personas). Verified: android-views `:farmerchat-android-views:compileDebugKotlin` clean; ios `swift build` clean (SwiftUI+UIKit); rn `tsc` clean; web `tsc` + `vite build` clean. Minor edge (android-views): an authed user with `showHistory=false` sees neither history nor a sign-up card (they're already signed up) — harmless.
- **ios-core (bug fix, 2026-07-20)**: `ConversationListItem` decoded `title`/`question` but the real API + app model (`ConversationListItem.kt`) field is `conversation_title` — history-list rows and drawer recent-8 titles were blank. Added the `conversation_title` CodingKey (+ non-empty `displayText` fallback). Fixes BOTH ios-swiftui and ios-uikit drawer + ChatHistory titles (screenshot-verified: `ios-uikit-19-drawer.png`, `ios-uikit-17-history.png`). (The web port had the same class of bug, fixed separately — see web debts.)
- **ios-uikit**: SPM platform floor prevents FarmerChatUIKit (iOS 15) from depending on FarmerChatSwiftUI (iOS 16), so the "host SwiftUI flow via UIHostingController on iOS 16+" option lives in FarmerChatSwiftUI (`present(from:)`) rather than inside FarmerChatUIKit (docs/05 iOS entry).
- **android (all)**: ✅ above means Kotlin compile + AAR/APK assembly passed (root CLAUDE.md §5 minimum, exceeded — full `assembleDebug` chain verified by the main session on 2026-07-17 after bumping compileSdk/targetSdk 35→36 repo-wide, required by androidx.activity 1.13 / compose BOM 2026.05; matches the production app's compileSdk 36). NOT yet runtime-tested on a device/emulator: no end-to-end API call, MediaRecorder capture, camera/FileProvider flow, fused-location fetch, or share/MediaStore save has been exercised.
- **android-compose**: deviations, all functional — SmoothShapes corner smoothing approximated with plain rounded corners (no androidx.graphics.shapes dep); card mark-viewed fires on item composition rather than a strict ≥50%-visibility measurement; ~~Error "Try Again" is uniform `popBackStack + retryLastAction`~~ **FIXED 2026-09-03 — the app's full per-`fromScreen` retry tree is now in `FarmerChatRoot.kt`**; ~~AccountSuccess→Home uses `popUpTo(Home)`~~ **FIXED 2026-09-03 — `popUpTo<AccountBenefits>{inclusive}` + `BackHandler`, matching the app**; VoiceInput returns the recorded file and the screen drives transcription (component not VM-injected).
- **android-views**: deviations, all functional — SIM-number prefill and SIM-picker dialog omitted (country auto-detect uses persisted guest-init country); WhatsApp OTP-less SDK reflection helper not integrated (channel buttons + SMS Retriever only; same functional path as RN/web); Home greeting is a static header above the pinned input row (app scrolls it under a sticky header); voice panel is tap-to-stop with timer, no waveform animation; chat scroll-indicator/Tips affordances not built; AccountSuccess can remain in the back stack under Home on the bypass-interstitial path (popUpTo(AccountBenefits) no-ops when absent — same in the app, and now in Compose too); core's internal SDK_VERSION_NAME mirrored as a local constant for the Help footer.
- **android**: WhatsApp OTP endpoint #19 has no UI caller in either Android UI module (reflection-based WhatsApp OTP SDK from the app not integrated; channel selection still works via #17 with `channel:["whatsapp"]`). Endpoints #18/#33 implemented in core with no UI caller (same rationale as other platforms).
- **android (distribution/theming/features C1–C5, 2026-07-20)**: hardened to distribution-grade at v1.0.0. **Distribution PROVEN**: `./gradlew publishToMavenLocal` publishes all three artifacts under `org.digitalgreen.farmerchat:{farmerchat-core,farmerchat-android-compose,farmerchat-android-views}:1.0.0`; a new `:sample-consumer` module consumes the SDK **by Maven coordinate from `mavenLocal()`** (`implementation("org.digitalgreen.farmerchat:farmerchat-android-compose:1.0.0")`, NOT `project(...)`) and `:sample-consumer:assembleDebug` passes — dependency tree confirms `…:farmerchat-android-compose:1.0.0 → …:farmerchat-core:1.0.0`. Version from ONE source (root `build.gradle.kts` `farmerChatVersion`/group on all subprojects; runtime mirror `FarmerChatVersion.VERSION`). API hardening: `resourcePrefix="fc_"` on both UI modules; `requireGraph()`/`FarmerChatGraph` gated behind `@InternalFarmerChatApi` (opt-in error; UI modules opt in at module level, hosts cannot reach it); `-Xexplicit-api=warning` on core; retrofit/okhttp/gson demoted `api`→`implementation` so they are `runtime`-scope in the core POM (verified: NOT on the consumer compile classpath). **Theming PROVEN (Compose)**: `:sample-consumer` supplies a blue host `FarmerChatTheme`; **screenshot-verified on emulator (Pixel 6 Pro)** — Language (`scratchpad/phase2_language_blue.png`) and Home (`scratchpad/phase2_home_blue_final.png`) render fully in the host blue palette (app bars, tiles, primary buttons, accent chevrons + glyphs, 16dp cards, 8dp buttons) with zero per-screen edits. **Features C1/C2/C4/C5 wired in core (+Compose)**; C3 fully wired in Compose. Full `./gradlew assembleDebug` (all modules incl. Views + both project-samples + coordinate-consumer) passes. NOT yet done: **Views theming** (XML color/drawable resources are not runtime-overridden — the `FarmerChatTheme` model is reachable via core but the Views screens do not consume it) and **Views C3 UI toggles** (config fields exist; JourneyController/drawer/home in Views still render the full journey regardless). C2 HOST_TOKEN / CHAT_ONLY landing / programmatic openScreen / semantic hooks are build-verified but not runtime-exercised on device this pass (only the themed Language+Home journey was driven on the emulator).
- **ios (distribution + theming + features C1–C5, 2026-07-20)**: hardened to distribution-grade at v1.0.0. **Distribution PROVEN as a binary artifact**: `ios/build-xcframework.sh` archives each package for iphoneos + iphonesimulator and produces `dist/{FarmerChatCore,FarmerChatSwiftUI,FarmerChatUIKit}.xcframework` (each with device `ios-arm64` + `ios-arm64_x86_64-simulator` slices and the `.swiftinterface` copied into `Modules/` — the SwiftPM archive quirk the script works around by temporarily flipping products to `type: .dynamic`, restored on exit via a trap). The UI xcframeworks dynamically link `FarmerChatCore.framework` via `@rpath` (verified with `otool -L`) so there are no duplicate Core symbols. `ios/Package.binary.swift` is the binaryTarget manifest variant (swap `path:`→`url:`+`checksum:` for a remote release). A separate consumer `ios/ConsumerApp` links the three `.xcframework`s (`framework:`+`embed:true` in `project.yml`, **NOT** the source packages), imports all three modules from their compiled interfaces, exercises `FarmerChat.initialize`/`FarmerChatConfig`/`FarmerChatTheme`/`Color(hex:)`/`FarmerChatView`/`FarmerChatInlineView`/`sendQuestion`, and **builds AND runs on the iPhone 17 simulator** (`scratchpad/consumer_binary.png`, `consumer_full_menu.png`). What was NOT exercised: true git-URL/tag SPM resolution and remote CocoaPods trunk (offline); `FarmerChatUIKit.podspec` validated only by `ruby -c` (Syntax OK) — CocoaPods is not installed so `pod lib lint` was NOT run. **API hardening**: demoted the networking internals `APIClient`, `HTTPMethod`, `TokenRefresher`(+`Outcome`), `DeviceInfoProvider`, `KeychainTokenStore`(+`Key`) and `FarmerChat.tokenStore`/`.deviceInfo`/`SessionManager.tokenStore`/`FarmerChatAPI.init`/`SessionManager.init` to `internal` — none are referenced by the UI packages (`FarmerChatAPI`/`PreferenceStore`/`SessionManager` methods still consumed by UI stay public; the wire models + ViewModels are necessarily public across the multi-module boundary, documented constraint). All three packages still build clean after demotion and the binary consumer proves the internals are not reachable. **Theming PROVEN**: `FarmerChatTheme` (SwiftUI `Color`/`Image`; colors+dark/shape/typography/logo) on `FarmerChatConfig.theme` (Core imports SwiftUI only for these value types); one resolver `FCTheme.applyHostOverrides` overlays host overrides onto the SwiftUI token layer (`FCBrandColors`/`FCContentColors`/`FCShapes`) with auto on-brand contrast + derived button/dark tints, and `FCUITheme` gets the same overlay via a `hostColor` KeyPath resolver (Color→UIColor) — every screen recolors with **zero per-screen edits**. **Screenshot-verified on the iPhone 17 simulator (iOS 26.1, dev env, blue host brand: brandPrimary #1565C0 / brandPrimaryDark #0D47A1 / brandAccent #42A5F5)** — Language (`scratchpad/themed_language.png`: blue "Start using FarmerChat" CTA + light-blue chevron, radius 12) and Home (`themed_home.png`: blue Photo/Speak/Type tiles, blue "Start chat" accent, 16-pt cards) render fully in host blue, live feed cards from dev. **Features**: C1 `FarmerChatInlineView()` + `FarmerChatViewController` child-VC; C2 authMode SDK_OTP|HOST_TOKEN (`markHostAuthenticated`, `TokenRefresher` host-mode 401→tokenProvider→onSessionExpired); C3 mode FULL_JOURNEY|CHAT_ONLY + showSettings/History/Drawer + enableSsfr (SwiftUI-wired); C4 semantic callbacks (onScreenView/onChatOpened via AnalyticsDispatcher; onMessageSent/onAnswerReceived/onError in ChatViewModel; onSessionStart in initialize) + `FarmerChat.sendQuestion/openConversation/openScreen`; C5 `stringOverrides` (host wins) + forced `locale` in LabelManager. Verification depth: theming colors + C1 (build+run) screenshot/runtime-proven; C5 label resolution unit-tested (12/12); C2/C3(toggles)/C4 are **type-checked/build-verified but NOT runtime-exercised** (the themed sim run used the default all-on full-journey path). Typography: `typeScale`/`fontName` are exposed as `theme.font(...)` tokens and applied where that helper is used, but the screens' existing `.font(.system(size:))` call sites were NOT swept, so type scaling is partial (colors/shape are the fully-wired, screenshot-verified deliverables). UIKit C2/C3/C4 UI toggles are core-level only (UIKit-native screens not re-wired this pass — iOS 16+ hosts should prefer FarmerChatSwiftUI).
- **react-native (distribution/theming/features C1–C5, 2026-07-20)**: hardened to distribution-grade at v1.0.0. **Distribution PROVEN**: `tsc` build + `npm pack` → `digitalgreenorg-farmerchat-react-native-1.0.0.tgz` (773 kB / 357 files: dist + src + 39 PNG assets + README). A fresh `react-native/example-packaged/` installs the SDK **from the .tgz** (`npm install ../packages/farmerchat-react-native/digitalgreenorg-farmerchat-react-native-1.0.0.tgz` — a real copy under node_modules, NOT the `file:` symlink) and passes **both** `npx tsc --noEmit` **and** `npx expo export --platform android` (Metro resolved the SDK + all PNG assets from node_modules and emitted a 3.5 MB Android bundle). package.json is publish-correct: `exports` map (`source`/`types`/`react-native`→`src`, `import`/`default`→built `dist/`) + `main`/`module`/`types`; react/react-native are peerDependencies only (no `dependencies`, not bundled); `files`=dist+src+README; `sideEffects:false`. Version 1.0.0 in package.json and `SDK_VERSION` (kept in sync). **Theming PROVEN**: `theme` on `FarmerChatConfig` → a single `resolveTheme()` called in the SDK constructor overlays host colors(+optional dark)/shape/typography/logo onto `src/ui/theme.ts` and reassigns the live token bindings (`dayTheme`/`nightTheme`/`radius`/`typography`/`brandLogo`); colors + text typography recolor every screen with zero per-screen edits (a handful of brand-literal spots in Chrome/Cards/InputOverlays/Buttons were repointed to theme tokens). **Screenshot-verified on the Android emulator (Pixel 6 Pro, Expo Go SDK 52, dev env, blue host brand)** — Language (`scratchpad/fc_lang_clean.png`, selection `fc_lang_selected.png`), EnterName (`fc_after_lang.png`) and Home (`fc_home.png`) render fully in the host blue palette (app bars, dark-blue hamburger chip + Photo/Speak/Type tiles, light-blue accent icons/radio dot/chevrons, blue CTAs, blue-tinted footer flower). **Features**: C1 `<FarmerChatInlineView style/>`; C2 authMode SDK_OTP|HOST_TOKEN (+tokenProvider/401 path); C3 mode + showSettings/History/Drawer + enableWeather/Ssfr; C4 semantic callbacks + `FarmerChat.sendQuestion/openConversation/openScreen`; C5 stringOverrides + forced locale — all type-checked, and **C1 inline embed, C3 CHAT_ONLY, C5 stringOverrides + forced locale, C4 semantic hooks, and the blue theme recolor are now RUNTIME-verified on the emulator (mock, 2026-07-20; screenshots `scratchpad/rn-19..22`)**. Runtime NOT exercised: C2 HOST_TOKEN flow and programmatic sendQuestion/openConversation/openScreen (type-checked only). Known limitation: **shape** overrides (`cardCornerRadius`/`buttonCornerRadius`/`inputCornerRadius`) only affect radii read at render time (inline styles); radii baked into module-level `StyleSheet.create` at load keep their defaults — colors and text typography (incl. fontFamily/typeScale) are unaffected and recolor fully.
- **react-native (dedicated-emulator E2E pass, 2026-07-21 — closes the remaining runtime debts)**: driven end-to-end on a dedicated Android emulator (emulator-5556, Expo Go SDK 52 pulled from the shared device, mock backend via `adb reverse tcp:8899`, blue host theme). Every remaining screen now has UI+logic runtime evidence, screenshots `scratchpad/c-*.png`, each read back: **Splash** (`c-00`); **Auth OTP** entry → typed `1234` → Verify → **AccountSuccess "You're all set!"** (`c-09`/`c-09b`/`c-10`; mock `verify_otp` accepts any 4-digit, `Send_OTP_Click_Event`→`Verify OTP Screen`→`Account Success Screen`, 180 s resend timer shown); **AccountBenefits** (`c-07`); **Settings** appearance **Day→Night** applied live (whole screen dark, `c-20`/`c-20b`); **SettingsName** edit "Ravi"→"Ravi Kumar" → Save → "Your name has updated" toast (`c-21`/`c-21b`/`c-21c`); **LanguageChooser** change English→Hindi → Save (`Save_Language_Click_Event {language_code:"hi",from_screen:"settings"}` → Home) (`c-22`/`c-22c`); **Help** FAQ + Terms/Privacy + version footer (`c-23`) and the **legal WebView** modal opened the real Terms URL (`terms_of_use_opened`; content failed only because the emulator has no public internet — `net::ERR_INTERNET_DISCONNECTED`, `c-23b`); **ChatHistory** grouped list Today/Yesterday/This-week (`c-19`) and an **opened thread** rendering query-text + markdown response + image message + follow-up chips (`c-19b`/`c-19c`); **Chat retry** — dropping the mock reverse mid-send produced the "Not sent" + "No internet connection… Try again" bubble (`c-17`), then restoring it + Try again re-sent and rendered the answer (`c-17b`); **Error/NoInternet** full-screen (`error_type:NO_INTERNET,from_screen:language`) via a fresh guest with the mock unreachable (`c-24`), and Try again (mock restored) recovered to the Language screen (`c-24b`). The **blockquote fix** was re-shot: `> Tip:` now renders as a styled left-bar italic blockquote, not raw ">" (`c-11`/`c-11b`). **LocationPrompt**: the state machine is runtime-verified from the weather CTA (`Location_Update_Triggered {source:weather}` → `gps_flow_step {step:"interstitial_shown"}`, `c-25`), but the interstitial's full-screen RN `Modal` (`ui/screens/LocationPromptHost.tsx`) renders only a scrim (no visible card) on this **landscape-locked tablet AVD** (2560×1600, app letterboxed) — a Modal/letterbox layout quirk on that device, not a logic defect; the non-Modal full-screen messages (AccountBenefits/Success, Error) render correctly. **Four wire-model conformance bugs were found and fixed during this pass** (app source was authoritative; the RN port read wrong names — now at parity, `npx tsc --noEmit` + `tsc` build clean): (1) **blockquote** — `MarkdownText` had no `^\s*>` case so quotes showed the raw ">"; added a styled blockquote block (matches web `markdown.tsx`); (2) **`ConversationListItem`** read `title`/`question`/`last_message` but the API/app field is **`conversation_title`** (+`created_on`) — history-list rows and drawer recent-8 titles were blank (same class as the web/iOS bug); (3) **`ConversationChatHistoryResponse`** read `messages`/`results` but the app returns the array under **`data`** — history threads rendered empty; (4) **`ConversationChatHistoryMessageItem.questions`** was typed `string[]` but the app sends **`ConversationChatHistoryQuestion` objects** (`{follow_up_question_id,sequence,question}`) — rendering them crashed with "Objects are not valid as a React child"; added the object type and normalize to display strings. The C4 **`onError`** hook was also observed firing at runtime (`onError 0 "Network error"` on the dropped-reverse paths). Still not driven: `expo-location` actual GPS fetch (blocked by the interstitial-Modal render issue above) and the legal WebView's remote content (emulator has no public internet).

## Third-party SDK boundary audit (2026-09-03)

Audited every third-party SDK in the production app (`fc-compose-agentic`, read-only) against the
SDK suite, per root `CLAUDE.md` §6: **no Firebase / Plotline / MoEngage / Adjust dependency may
enter an SDK package**; events reach the host through the pluggable analytics listener only.
Confirmed the rule holds — `grep` for those four vendors across `versions/v2/{android,ios,react-native,web}`
returns zero dependency declarations and zero imports. The catalogue and the host integration
guide live in `docs/07-customization-and-distribution.md` **Part D**.

### Remote Config flags: app → SDK

The app reads five booleans from Firebase Remote Config (`core/firebase/OnboardingRemoteConfig.kt:24-30`,
keys in `core/constants/RemoteConfigKeys.kt`). The SDK carries no Remote Config client; the host
supplies resolved values at `initialize()`.

| App RC key | App default | App read sites | SDK status |
|---|---|---|---|
| `v2_show_name_screen_onboarding` | `true` | `AppNavigator.kt:42`, `OnboardingSharedViewModel.kt:715` | ✅ `showNameScreen` (pre-existing), default `true` |
| `v2_agentic_chat_enabled` | `false` in the defaults map, **getter hardcoded `= true`** (`OnboardingRemoteConfig.kt:72-73`) | `ChatViewModel.kt:1425,1867`, `HomeScreen.kt:221,654,884`, `HomeViewModel.kt:830`, `OnboardingSharedViewModel.kt:727` | ✅ `enableAgenticChat` (pre-existing), default **`false`** — deliberate divergence from the app, which ships it on; §3 freezes the synchronous #27 contract for a host that opts into nothing |
| `v2_composer_ui_enabled` | `false` in the defaults map, **getter hardcoded `= true`** (`:81-82`) | `ChatScreen.kt:155`, `HomeScreen.kt:220,883`, `HomeViewModel.kt:825`, `OnboardingSharedViewModel.kt:721` | ✅ **NEW this pass** — `enableComposerUi` on android/react-native/web; ⛔ gap on iOS (no composer surface exists to gate) |
| `v2_wobble_animation_enabled` | `true` | `AttentionWobble.kt:42` | ⛔ **GAP, no knob added.** No platform in the suite has a home-card attention animation, so the flag has nothing to gate; a knob would be a dead no-op in the public API (same reasoning as the `aiBubbleColor` decision below) |
| `v2_stop_animation_on_first_card_click` | **inconsistent in the app**: defaults map says `true` (`OnboardingRemoteConfig.kt:27`), the KDoc says "Default false" (`RemoteConfigKeys.kt:16`) | `AttentionWobble.kt:43` | ⛔ **GAP, no knob added** — same reason (no wobble in the suite) |

Two further keys are declared in the app but **dead**: `google_ads_enabled` and `native_ads_enabled`
(`RemoteConfigKeys.kt:30-31`) are absent from the defaults map and have zero read sites, so they
never even reach Firebase as fetched keys. No SDK equivalent needed. Also note
`RemoteConfigKeys.kt:35-46` holds `GUEST_USER_API_KEY`, `MOENGAGE_APP_ID`, `ADJUST_APP_TOKEN` and
`PLOTLINE_API_KEY_DEV/PROD` — hardcoded vendor **constants**, not Remote Config values, despite
the file name.

### android-views embedded fixes (v2 2.2.0, 2026-09-30)

All runtime-verified on emulator (Pixel_6_Pro, mock, sample-views `econet` profile; embedded host =
new `EmbeddedHostActivity`, shaped like Econet's MainActivity).

| Fix | Detail |
|---|---|
| Double system-bar padding when embedded | A `fitsSystemWindows` CoordinatorLayout host pads itself yet passes the insets on, so the SDK padded a second status-bar height into the app bar (and nav bar under the composer). `FarmerChatFragment` now hands descendants insets trimmed to its on-screen bounds (`internal/util/FcInsets.kt`); the four raw `getRootWindowInsets` readers use the same trim. No-op in `FarmerChatActivity`. |
| Follow-up question scrolled out of view | A follow-up appends [question, placeholder]; the placeholder step POSTED a smooth scroll-to-bottom that ran after the streaming row's question pin and parked the viewport on the empty reserve. The pin now cancels it, and the placeholder anchors like core `chatScrollAnchorIndex`. |
| Voice recorder UI | Legacy count-up/X/Stop panel replaced by `VoiceRecorderView`, a 1:1 port of the app's `VoiceInput` sheet (fc-compose-agentic `VoiceInput.kt` via compose `UserInput.kt`): title/subtitle, [Delete · 36-bar waveform with 30 s countdown, 5 s pulse, auto-send · Send], info footer, 16dp sheet, 300 ms slide-up; haptic on send. |
| Session reset on backend change (core, all Android flavours) | `FarmerChatGraph` already recorded `LAST_BASE_URL` but on a change dropped only the conversation id; the old backend's token + user id survived, so every call 401'd, refresh 401'd and the guest fallback (`send_tokens` with the foreign `user_id`) 400'd — no recovery. Now the whole session is cleared (appearance + device id kept). Verified on emulator: an Econet host moved from Econet's backend to FarmerChat dev → fresh `initialize_user`, labels, `new_conversation`, `#27a` agentic answer, follow-ups all 2xx. ⛔ GAP iOS/RN/web: same check not ported. |
| `FarmerChatLaunch.screen` (NEW public option) + CHAT_ONLY screen routing | Embedded hosts can open the SDK on a well-known screen (`FarmerChatScreens.HISTORY` …). In CHAT_ONLY the screen now opens ABOVE the chat on both flavours (views `NavRoutes.navigateChatOnly`; compose `FarmerChatRoot` CHAT_ONLY branch, which also skipped the guest bootstrap for a pending screen) — previously views dropped the request and compose stacked it on the hidden Home. Views verified on emulator in the Econet host (drawer → SDK history → Back → chat → Back → host). ⛔ GAP iOS/RN/web. |
| Overall call timeout (core) | `TimeoutTypeInterceptor` adds `callTimeout = 2 × priority timeout`: connect/read/write are per step and the connect timeout re-arms per route, so an unreachable multi-address host (googleapis geolocate) could hold the CHAT_ONLY splash for minutes. |
| Agentic progress text | Already implemented: tool `status_text` (`tool_call` / `tool_result`) → `streamingStatus` → shimmer status row (views `ChatAdapter`, compose `ChatScreen`), app parity (fc-compose-agentic shows tool status_text only; `status.stage` → generic "Getting your answer…" on all three). Verified on emulator against FarmerChat dev: "Loading your profile information" rendered. New debug-only log of every stream event (`FcSdkChatViewModel`, `debugLogging`). |
| Photo upload always failed (core, v1 AND v2) | `ImageUtils.prepareImageForUpload` treated the bounds-pass `decodeStream` result as the readability check, but with `inJustDecodeBounds` it is ALWAYS null — every photo question ended in "Failed to process image" before any request. Now: unreadable = no stream or no size. v2 verified on emulator (sample, mock): photo → `image_analysis` → answer. v1 compile-verified. iOS/RN/web use their own image code (not affected). |
| Photo + history answers wear the agentic action row | With the agentic UI on (`enableAgenticChat` or `simulateAgenticStream`), image answers (#28) and history answers get `isAgentic`. History = app parity (fc-compose-agentic ChatViewModel.kt:1343-1357); image = product request (the app keeps its legacy row). Verified on emulator: accuracy note + sweep Share + Listen, no Save. ⛔ GAP iOS/RN/web. |
| Markdown `> quote` (views + compose) | New Quote block: 3dp borderDefault bar + 12dp indent, `>` stripped (previously rendered raw — the app's parser has no quote either). Views verified on emulator; compose compile-verified. ⛔ GAP iOS/RN/web. |
| Geolocate ceiling (core) | `FetchGeoLocationUseCase` wraps the call in `withTimeoutOrNull(12 s)`: a DNS lookup stuck in `getaddrinfo` is not interruptible by OkHttp timeouts and held the CHAT_ONLY splash indefinitely (thread dump confirmed). Verified on emulator with a hung resolver: chat ready in ~15 s, falling back to device-locale location. |
| Photo input UI → app (views; bubble also compose) | Re-ported from fc-compose-agentic: PhotoInput sheet (no title, one 168dp row of Camera · Photos tiles on surfaceTertiary/16dp, 32dp foregroundPrimary icons, labelMedium foregroundSecondary, 300 ms slide + 25% scrim; voice sheet scrim also 25%); composer thumbnail clipped to 8dp + crossfade; user bubble: photo-only = bare 220x160/16dp, wide banner INSIDE the bubble at full width 16:9/16dp with caption below, thumbnail 80dp/8dp. Core: a sent photo now sets `userBubbleImageWideBanner` (app ChatViewModel.kt:1138) — it was missing, so every sent photo showed the small thumbnail. Views verified on emulator; compose bubble compile-verified. ⛔ GAP iOS/RN/web. |
| Host-opened screen is the journey root (CHAT_ONLY, views + compose) | A screen the host requests (`FarmerChatLaunch.screen` / `openScreen`) is now the ROOT, flagged (views `NavRoutes.ARG_EXIT_TO_HOST`, compose `screenOpenedByHost`): Back / save / failure leave the journey to the host instead of landing in a chat the farmer never opened; history → conversation → Back still returns to history. Supersedes the earlier "screen above the chat" behaviour. Views verified in the Econet host on emulator (history and language, app-bar and system Back, language save); compose compile-verified. |
| CRITICAL: chat thread lost after Past Advice / language (views + compose) | Views: the chat toolbar opened history/language with `drawerOptions` (popUpTo start) and `ChatFragment.onDestroyView` sent `ClearMessages`, so leaving the chat wiped it and on return `initializeIfNeeded()` re-ran the launch args (the farmer saw the chat restart from their first question). Now: opened on top (singleTop), clear only in `onDestroy` (not on rotation), `leaveSecondaryScreen` pops back to the screen beneath, and `FarmerChatFragment` owns system Back while its nav stack can pop (hosts no longer need to set it as primary navigation fragment). Compose: same — toolbar routes stack on top, no ClearMessages on dispose (VM is nav-entry scoped), `leaveSecondaryScreen` pops back. Views verified on emulator (sample + Econet host, system and app-bar Back, language save, a follow-up afterwards; nothing re-sent); compose compile-verified. |
| Chat scroll → app (views) | Loading placeholder and a failed question's error row hold the viewport reserve; question / location pin to the top with an animated SNAP_TO_START scroll after 150 ms (app ChatThreadContent.kt:229-285); list bottom padding = composer bar + 16dp (legacy 16dp); history prefetch within 2 rows of the top with the restore anchored on the first visible row and consumed only once the page lands; app ScrollIndicator (40dp accent circle, 1.5 s delay, fade 200, 3 bounces of 14dp 280/320/150 ms, fade 300; only when real content is below; tap = bottom) and ScrollToBottomButton in the composer (36dp surfaceSecondary, 24dp soft shadow, 18dp arrow; while focused and a row is below; tap pins the latest question). Verified on emulator (sample, mock). Compose not ported. |
| Agentic answer cards → app (views) | Diffed against fc-compose-agentic and fixed: agentic follow-ups are numbered `AgenticChipView` chips with chevrons (Suggested / Agentic when clarification required), header titleMedium 18sp bold foregroundPrimary, 16dp/10dp spacing + 40dp after, hidden under an additive nudge with chips (non-agentic answers keep the legacy Ask cards); Share/Save/Listen icons 23dp; Listen pill states (idle VolumeUp+label, loading 20dp spinner + "Loading...", playing Pause + 14-bar `SoundWaveDrawable`); stream error card (24dp icon, 12dp gap, bold title, 16dp, full-width radius-12 retry row with Refresh icon); alignment surface (markdown 17sp message, options 16dp under the message on every surface, escalate radius 16, capability prompt in a 1dp borderDefault radius-16 card, "Please confirm", one-line escape hatch, escalate badge solid onBrand with a fail numeral, picked escalate 8%); thread items 20dp horizontal, list top 12; no gap above the streaming status row; composer cursor = foregroundPrimary. Composer otherwise already matched (agent diff). Verified on emulator (sample, mock): follow-ups, action row, Listen playing, error card. Alignment surface compile-verified only. Follow-up pass: shared `ListenPill` (idle / loading "Loading..." / playing Pause+wave / paused PlayArrow+still wave when audio is fetched but not playing / disabled 40%) used by the action row AND a new Listen pill on the alignment surface (live prompt only: not escalate, not additive, latest, not loading; 16dp under the message); GPS-prompt "Getting your location…" progress row (`LogoSpinnerView` horizontal, 16dp under the options, below the bordered card) driven by `pendingLocationSourceId` + `LocationPromptState` RequestPermission / RequestEnableGps / FetchingLocation / Interstitial (app ChatScreen.kt:335), which also locks chips + escape hatch. Verified on emulator: surface Listen pill + loading (Econet host, FarmerChat dev). Playing/paused not observable on the no-audio emulator (playing seen earlier with the mock); progress row compile-verified (no GPS prompt on demand). NOT done: 300 ms answer fade. ⛔ GAP compose / iOS / RN / web. |
| `FarmerChatScreens.LANGUAGE` | Opens the in-chat language chooser (views `fc_dest_settings_language`, compose `Destination.SettingsLanguage`), in CHAT_ONLY above the chat. Used by the Econet host's Settings → App language; the host mirrors `onLanguageChanged` into its own language by code. Verified on emulator in the Econet host. |
| Keyboard + composer seating (embedded) | Two follow-ups to the inset trim, both device-reproduced on a soft-keyboard AVD: (1) keyboard VISIBILITY is read from the raw root insets — the trimmed IME inset is 0 in a host that lifts content by the IME itself, and the composer then closed the keyboard on tap; (2) the trim measures the laid-out (untranslated) position and clamps gaps at 0 — the composer's slide-off during loading gave a negative gap, a phantom ~300px IME inset, and a bar left floating mid-screen after sending. |
| Chat history opens at the FIRST question | Product decision (deliberately differs from fc-compose-agentic `ChatScreen.kt:1210-1227`, which pins the LAST question): the initial history page positions at row 0; older pages still load on a user scroll-up. Verified in the Econet host on emulator. |
| `FarmerChatComposerFragment` (NEW public API, views) | The SDK composer on a HOST screen with SDK Home UI + operations (type/send, photo sheet → attach → send with text, voice sheet); each submission reaches the host as a `FarmerChatLaunch`. Delta vs SDK Home: voice is handed to chat (chat transcribes) instead of transcribing in the sheet. Verified on emulator (sample `EmbeddedHostActivity --ez composer true`: text → chat answer, photo sheet; Econet dashboard renders it, touches pass through). ⛔ GAP compose / iOS / RN / web — no equivalent host composer yet. |
| `fc_brand_icon` | Accent glyph ON the brand surface (composer camera/mic, recorder Delete/Send): keeps the accent unless its WCAG contrast on `brandPrimaryDark` is < 3, then `onBrand`. |

**Compose flavour (same pass, compile + unit tests only — NOT rendered):** embedded inset trim (`compose/util/FcInsets.kt`: `FcInsetTrim` at the `FarmerChatRoot` root consumes the host gap for modifier inset reads; raw `asPaddingValues()` reads go through `fcStatusBarsTop` / `fcNavigationBarsBottom` / `fcImeBottomPx`; keyboard-visible checks stay raw); follow-up pin (placeholder holds the reserve height, auto-scroll keyed on the last message id + `isLoading`); history opens at the first question (older pages only on scroll-up; prepend-restore also keyed on `historyNextPage`). Voice sheet already the app's `VoiceInput` — unchanged. iOS/RN/web unchanged (iOS + RN ported 2026-10-09, see "Latest question pinned to the top").

### `simulateAgenticStream` — new knob (v2 2.2.0, 2026-09-30)

Agentic chat PRESENTATION over the synchronous #27 endpoint, for hosts whose backend has no #27a
(Econet: #27a 404 on dev + stage, probed 2026-09-30). The wire is unchanged — one #27 request, one
JSON reply — so guardrail #3 holds. `ChatViewModel.revealSynchronousAnswer` drives the SAME bubble
lifecycle as `streamAgenticAnswer` (status label → word-boundary reveal, ≤80 frames × 30 ms →
settle via `handleTextPromptResult(isAgentic = true)`; failure → `interruptAgentic` stream error
card + invalid `SEND_QUERY`). Also the composer default (`resolvedComposerUi`).

| Platform | Status |
|---|---|
| android (core → compose + views) | ✅ config + builder + `newBuilder` round-trip; `SimulateAgenticStreamConfigTest`; **views runtime-verified on emulator (Pixel_6_Pro, mock, sample-views `econet` profile, 2026-09-30)**: word-by-word reveal → agentic row (accuracy note, sweep-border Share, Listen, no Save) + navy Ask follow-ups + composer; mock stopped → NETWORK stream error card → Try again → answer. Compose flavour compiled, not rendered. New token `fc_brand_icon` (accent icon ON the brand surface; composer camera/mic) |
| iOS / react-native / web | ⛔ GAP — not implemented |

### `enableComposerUi` — new knob (2026-09-03)

Before this pass all four platforms hardcoded `isComposerUi = config.enableAgenticChat`, collapsing
two flags the app documents as independent (`RemoteConfigKeys.kt:22-27`: the composer flag "only
controls the composer UI, not which API the query is routed to"). Added as a **nullable** knob whose
`null`/omitted default resolves to `enableAgenticChat`, so an existing host — including one that set
`enableAgenticChat(true)` — sees byte-identical behaviour.

| Platform | Status | Where |
|---|---|---|
| android | ✅ `FarmerChatConfig.enableComposerUi: Boolean?` + `Builder.enableComposerUi()`; read via new `resolvedComposerUi` at `compose/screens/HomeScreen.kt`, `compose/screens/ChatScreen.kt`, `views/internal/ui/HomeFragment.kt`, `views/internal/ui/ChatFragment.kt` | `farmerchat-core/.../FarmerChatConfig.kt` |
| react-native | ✅ `enableComposerUi?: boolean` → resolved `config.composerUi`; `ui/screens/{Home,Chat}Screen.tsx` read it | `src/core/config.ts` |
| web | ✅ same shape (`enableComposerUi?` → `composerUi`); `ui/screens/{Home,Chat}Screen.tsx` read it | `src/core/config.ts` |
| ios | ⛔ **GAP** — iOS has no unified `InputComposer` at all (`grep -i composer` over `versions/v2/ios` finds only incidental comments; no such view exists). Adding a config field there would be a knob that gates nothing. Closes when the iOS composer is built. |

Also fixed while in `FarmerChatConfig.newBuilder()` (android): it did not round-trip
`enableAgenticChat` or `showNameScreen`, so a `newBuilder()` reconfigure silently reset a host's
feature gating to the defaults. All three RC-mirroring knobs now round-trip. `newBuilder()` has no
call sites today, so this was latent, not live. **Still lossy and NOT fixed** (outside this lane —
reported, not touched): `defaultCountryCode`, `defaultStateCode`, `defaultLatitude/Longitude`,
`minSplashDurationMs`.

### Full catalogue — every third-party SDK in the app, with an SDK-suite verdict

Evidence read from the app's `gradle/libs.versions.toml`, root + `app/build.gradle.kts`,
`app/google-services.json` and `app/src/main/AndroidManifest.xml` — not from imports alone.
`google-services.json` declares project `farmer-chat-fcm` (project number 149082202998) for
package `org.digitalgreen.farmer.chat`, with only `appinvite_service` in its services block: the
Firebase **products in use are determined by the Gradle deps and plugins**, not by that file.

| SDK / product | Version | What the app uses it for | Touchpoints (file:line) | SDK-suite equivalent |
|---|---|---|---|---|
| **Firebase Analytics** | `firebase-bom 34.18.0` | primary event sink; user id + user properties | `libs.versions.toml:88`, `app/build.gradle.kts:250`; `core/analytics/AnalyticsManager.kt:17,45-57`; `AnalyticsUserIdentityManager.kt:37`; `UserAttributeTracker.kt:31` | ✅ events via `config.onEvent` (same names/props); ◐ user-id / user-property now expressible on android v2 via `config.onUserIdentified` / `config.onUserAttribute`, but only 7 of 54 attributes are raised (see event-boundary gaps) |
| **Firebase Crashlytics** | plugin `3.0.8` | crash reporting + custom keys/logs | `libs.versions.toml:89,116`, root `build.gradle.kts:8`, `app/build.gradle.kts:11,251`; `core/crashlytics/CrashlyticsManager.kt:18`; `FarmerChatApplication.kt:116-125` | ◐ partial — a host can breadcrumb from `onEvent` and record from `onError` (docs/07 Part D); ⛔ no `recordException` path for throws the SDK swallows internally |
| **Firebase Remote Config** | (BOM) | 5 feature flags | `libs.versions.toml:56`, `app/build.gradle.kts:253`; `core/firebase/OnboardingRemoteConfig.kt`; `core/constants/RemoteConfigKeys.kt` | ✅/⛔ per flag — see the Remote Config table above (3 of 5 have knobs, 2 are gaps) |
| **Firebase Performance** | plugin `2.0.2` | startup/screen traces + OkHttp network timing | `libs.versions.toml:87,115`, root `build.gradle.kts:7`, `app/build.gradle.kts:10,249`; `FarmerChatApplication.kt:169-193` (`isPerformanceCollectionEnabled = true`, `:176`); `core/performance/FirebasePerformanceInterceptor.kt`, `NetworkTracker.kt`, `ScreenPerformanceTracker.kt`, `AppStartupTracker.kt`; manifest kill-switch `firebase_performance_collection_enabled` set to **`false`** (`AndroidManifest.xml:141-143`) and re-enabled at runtime in code (`FarmerChatApplication.kt:176`); `core/firebase/FirebaseConfigGuard.kt` | ⛔ **GAP.** No equivalent and no hook shape for one: there is no `onNetworkTiming(api, ms, code)` / trace callback, so a host cannot instrument the SDK's HTTP calls at all. Not closable without a new listener; the SDK's own `ApiPriority` timeouts and the `API_Call_*` analytics events are the nearest signal a host gets |
| **Firebase Messaging** | (BOM) | FCM token → handed to MoEngage; push-driven chat deeplinks | `libs.versions.toml:90`, `app/build.gradle.kts:252`; `MainActivity.kt:419-426` (`FirebaseMessaging.getInstance().token` → `MoEFireBaseHelper.passPushToken`); `AndroidManifest.xml:102-105` (`MoEFireBaseMessagingService` bound to `com.google.firebase.MESSAGING_EVENT`) | ⛔ **GAP, and a feature gap not just a vendor one.** The SDK has no push at all — no token handling, no `CustomPushMessageListener` analogue, and no equivalent of the app's push-payload deeplink into a chat (`utils/CustomPushMessageListener.kt` → `navigation/AppNavigator.kt:244`, which reads `query` / `response` / `follow_up_questions` off the payload). A host owning its own FCM can reach chat via `FarmerChat.openChat`, but the SDK cannot consume a push payload |
| **MoEngage** | catalog `9.2.0` (`core`, `inapp`, `pushAmp`, `richNotification`) | events, user attributes, push, in-app | `settings.gradle.kts:25-28` (its own version catalog) + custom repo; `app/build.gradle.kts:224-227`; `FarmerChatApplication.kt:210-229` (`initialiseDefaultInstance`, `registerMessageListener`), `:142` `enableAdIdTracking`; `AnalyticsManager.kt:30-41`; `AndroidManifest.xml:95` `MoEActivity` | ✅ events via `onEvent` (docs/07 Part D shows the `Properties` conversion + the app's MoEngage-excludes-screen-events routing); ◐ identity + attributes now reachable on android v2 (`config.onUserIdentified` / `config.onUserAttribute`, 7 of 54 keys raised); ⛔ push |
| **Plotline** | `5.2.5` (custom maven `android-sdk.plotline.so`) | events, in-product nudges/tours keyed on `PLabel` tags, feature gating (`show_app_review`) | `settings.gradle.kts:19-21`; `libs.versions.toml:81`, `app/build.gradle.kts:216`; `FarmerChatApplication.kt:103,158-167`; `AnalyticsManager.kt:60-70`; `AnalyticsUserIdentityManager.kt:42-62`; `core/constants/PlotlineConstants.kt` + `PLabel(...)` tags on widgets (e.g. `components/appbars/HomeAppBar.kt:100`, `components/cards/ContentCard.kt:300`, `SuggestedCard.kt:65`); `AndroidManifest.xml:98` `PlotlinePushActivity` | ✅ events via `onEvent`; ⛔ **`PLabel` widget tagging has no analogue** — the SDK's views/composables carry no Plotline tags, so a host cannot target SDK UI with Plotline nudges. Tagging would mean a Plotline dependency inside the SDK (§6) |
| **Adjust** | `5.8.0` + signature `5.5.0` | attribution + per-event tokens, deferred deeplinks, FB app id | `libs.versions.toml:82-83`, `app/build.gradle.kts:219-220`; `FarmerChatApplication.kt:195-208` (`Adjust.initSdk`, `setOnDeferredDeeplinkResponseListener`, `setFbAppId`, `:206`); `AnalyticsManager.kt:73-85`; `core/analytics/AdjustEventTokens.kt` (81 tokens) | ◐ events reachable via `onEvent` **but the token is not passed** — host supplies its own `Map<eventName, token>` (docs/07 Part D). ⛔ attribution, deferred deeplink and global params have no equivalent |
| **Google Ads identifier** | `play-services-ads-identifier 18.3.0` | GAID for Adjust/MoEngage ad-id tracking | `libs.versions.toml:78`, `app/build.gradle.kts:221`; `utils/Extensions.kt:8,172` (`AdvertisingIdClient.getAdvertisingIdInfo`); `FarmerChatApplication.kt:142`; `AndroidManifest.xml:17` `uses-permission com.google.android.gms.permission.AD_ID` | ⛔ **none, and deliberately.** An SDK that pulls the advertising id would force the AD_ID permission and a Play data-safety declaration onto every host. Marketing attribution is host-owned (§6) |
| **Install Referrer** | `installreferrer 2.2` | UTM / install attribution | `libs.versions.toml:84`, `app/build.gradle.kts:230`; `MainActivity.kt:70,110,354,445-449` (`InstallReferrerManager`) | ⛔ none, deliberately — install attribution is a property of the *host app's* Play listing, not of an embedded SDK |
| **Play Location** | `play-services-location 21.4.0` | GPS fix + Location Settings resolution | `libs.versions.toml:91`, `app/build.gradle.kts:256`; app `core/location/*` | ✅ implemented in both Android UI modules, `runCatching`-guarded (see optional-SDK table below) |
| **SMS Retriever** | `play-services-auth-api-phone 18.3.1` | OTP autofill | `libs.versions.toml:92`, `app/build.gradle.kts:258` | ✅ implemented in both Android UI modules, `runCatching`-guarded (below) |
| **WhatsApp OTP SDK** | **no dependency** | hand OTP intent to WhatsApp | reflection only — `utils/whatsapp/WhatsAppOtpSdk.kt:15` (`Class.forName("com.whatsapp.otp.android.sdk.WhatsAppOtpHandler")`) | ⛔ pre-existing gap (already in the android-views deviation list). Endpoint #19 exists in core with no UI caller |
| **Play App Update** | `app-update-ktx 2.1.0` | force/flexible in-app update | `libs.versions.toml:52`, `app/build.gradle.kts:233`; `core/update/ForceUpdateManager.kt:6-9,20`; `MainActivity.kt:51,78,132` | ⛔ none, **correctly** — an SDK cannot update its host app; the host owns its own update prompt |
| **Play In-App Review** | `play-review-ktx 2.0.2` | rating prompt, gated on a Plotline flag | `libs.versions.toml:93`, `app/build.gradle.kts:234`; `core/review/InAppReviewCoordinator.kt:9,36`; `MainActivity.kt:634` | ⛔ none, **correctly** — a review prompt is about the host's Play listing. A host wanting to trigger one off SDK engagement can do so from `onEvent` |
| **libphonenumber** | `9.0.38` | phone validation safety net | `libs.versions.toml:75`, `app/build.gradle.kts:245`; `ui/auth/AuthViewModel.kt:890-896` | ◐ **intentional deviation, already documented in code** — the SDK ships no libphonenumber and reimplements the app's own country-length/regex chain plus a 6..15-digit fallback (`core/ui/auth/AuthViewModel.kt:47-83`). Keeps the AAR small; behaviour matches for the countries the app enumerates |
| **Coil** | `2.7.0` (+ `coil-svg`) | image loading | `libs.versions.toml:53-54`, `app/build.gradle.kts:236-237` | ✅ present in both Android UI modules (`farmerchat-android-compose/build.gradle.kts:70-71`, `farmerchat-android-views/build.gradle.kts:65-66`) — a rendering library, not an analytics/marketing SDK, so §6 does not apply |
| **Koin** | `4.2.2` | DI | `app/build.gradle.kts:201-203` | ✅ n/a by design — the SDK uses a hand-rolled `FarmerChatGraph` instead, so no DI framework is imposed on a host |

Net: of the app's third-party surface, the SDK reproduces **events** (host-forwarded) and the two
**Play Services** platform integrations. It deliberately reproduces none of the attribution/ad-id
stack, and it is **missing** four things that are not purely vendor concerns and would need new SDK
surface to close: user identity/attributes, network-performance instrumentation, push, and Plotline
widget tagging.

### Event-boundary gaps — item 1 partly CLOSED on android v2 (2026-09-03)

Things the app sends to third parties that `onEvent(name, props)` structurally cannot carry.
Documented for hosts in docs/07 Part D. Item 1 now has a host surface on android v2 (with the
caveats listed under it); items 2 and 3 remain closed-by-documentation by design.

1. ◐ **`onUserIdentified` / `onUserAttribute` — SURFACE NOW EXISTS ON ANDROID v2; ⛔ ios / react-native / web.**
   The app sets user *identity* on all four vendors (`AnalyticsUserIdentityManager.identifyUser()`:
   MoEngage `identifyUser`, Firebase `setUserId`, Plotline `init`/`initAnonymousUser`, Adjust global
   partner+callback params — file `core/analytics/AnalyticsUserIdentityManager.kt:15-71`) and user
   *attributes* over 54 keys (`UserAttributeTracker.track()` → MoEngage `setUserAttribute`, Firebase
   `setUserProperty`, Plotline `identify`, Adjust global partner param —
   `core/analytics/UserAttributeTracker.kt:13-49`; keys in `core/analytics/UserAttributeKeys.kt`).
   Identity is not an event and a user property is not an event property, so no amount of event
   parity closes this.

   **Shipped (android v2, 2026-09-03):** `FarmerChatConfig.onUserIdentified((userId: String) -> Unit)?`
   and `FarmerChatConfig.onUserAttribute((key: String, value: String) -> Unit)?` (+ builder setters,
   + the `newBuilder()` round-trip), dispatched by `FarmerChatAnalytics.identifyUser()` /
   `.setUserAttribute()`. Deliberately NOT added to `FarmerChatAnalyticsListener`: it is a
   `fun interface`, so a second abstract method would break every host's SAM lambda. Both are
   blank-guarded and wrap the host callback in `runCatching`.

   Three caveats, so nobody reads this as parity:
   - **7 of 54 attributes** are raised (the device/carrier set: `Carrier_Name`, `Carrier_Code`,
     `Device_Type`, `Brand`, `Model`, `Manufacturer`, `OS`). The other 47 — IP/profile location,
     app version, `GPS_Location_Shared`, `Mobile_No_Verified`, registration date, … — have no raise
     site yet.
   - **`value` was narrowed to `String`**, not the `Any?` this section originally requested. Every
     value in scope today is a string, but the app tracks `GPS_Location_Shared` as a Boolean and
     `App_Version_Code` as an Int. Whoever wires those must stringify, because widening
     `(String, String) -> Unit` to `(String, Any?) -> Unit` later is a source-breaking change to a
     shipped public callback (root CLAUDE.md §3). Decided, not overlooked.
   - Identity fires at three sites: onboarding guest-init success (app
     `OnboardingSharedViewModel.kt:392`), `verify_otp` success (app `AuthViewModel.kt:652`), and the
     CHAT_ONLY bootstrap (SDK-only, since it skips onboarding).

   ⛔ ios / react-native / web still have no equivalent of either callback — out of lane for the
   android v2 change that added them, recorded here per root CLAUDE.md §4.
2. ℹ️ **Per-sink routing is unrepresentable, and that is accepted.** `AnalyticsManager.trackScreenView`
   / `trackScreenExit` (`:96-137`) deliberately send `Screen_Viewed` / `Screen_Exited` to Firebase,
   Adjust and Plotline but **not** MoEngage; every other event goes to all four. A flat listener
   cannot express it. Closed by documentation instead — docs/07 Part D publishes the routing rule
   and the host-side filter — no SDK change wanted.
3. ℹ️ **Adjust event tokens are not forwarded, deliberately.** `AnalyticsEvent.adjustToken` drives
   `AnalyticsManager.trackAdjust` (`:73-85`) and Adjust rejects an untokened event. The SDK's
   `onEvent` passes the name only. Not closed by shipping the app's table: the 81 tokens in
   `core/analytics/AdjustEventTokens.kt` are opaque ids issued by **Digital Green's** Adjust app and
   are meaningless in a host's account. docs/07 Part D instead shows the host-owned
   `Map<eventName, token>` pattern and points at the app file for anyone reporting into our account.

### Optional platform SDKs — `android/CLAUDE.md` requirement re-verified (no fix needed)

| Integration | Dependency shape | Guard | Verdict |
|---|---|---|---|
| SMS Retriever (`play-services-auth-api-phone`) | hard `implementation` in both UI modules | all calls in `runCatching`, receiver nulled on failure, unregister in `runCatching` — `compose/screens/AuthScreen.kt:129-166`, `views/internal/ui/AuthFragment.kt:240-273` | ✅ absence degrades to "no OTP autofill", cannot crash |
| Fused location + Location Settings (`play-services-location`) | hard `implementation` in both UI modules | `runCatching` with explicit "Play Services absent — proceed as if GPS is enabled" fallback — `views/internal/location/LocationPromptHost.kt:282-305`, `compose/screens/LocationPromptHost.kt:110-130` | ✅ absence degrades to "GPS treated as enabled, fetch falls back" |
| WhatsApp OTP SDK | **not a dependency anywhere** — the app reaches it purely by `Class.forName` (`utils/whatsapp/WhatsAppOtpSdk.kt`) | n/a | ⛔ pre-existing gap, unchanged: not integrated in either Android UI module (already recorded in the android-views deviation list above). Endpoint #19 exists in core with no UI caller |

Because both Play Services artifacts are hard `implementation` deps they normally reach the host
transitively via the POM; absence arises only if a host `exclude`s them, and the guards cover that.

### Verification (2026-09-03, actually run)

- **android**: `./gradlew :farmerchat-core:assembleDebug :farmerchat-android-compose:assembleDebug :farmerchat-android-views:assembleDebug :sample-compose:assembleDebug :sample-views:assembleDebug :farmerchat-core:testDebugUnitTest` → `BUILD SUCCESSFUL in 13s`, `178 actionable tasks: 39 executed, 139 up-to-date`, exit 0. (An intermediate re-run failed for ~5 minutes on a cause outside this lane — `core/ui/onboarding/OnboardingSharedViewModel.kt:327` and `core/ui/settings/SettingsViewModel.kt:141` referenced `AnalyticsScreens` without importing it, from a concurrent event-parity edit. Left untouched to avoid a two-writer race; that lane landed the import at 11:38 and the command was re-run clean.)
- **react-native**: `npx tsc --noEmit` in `packages/farmerchat-react-native` → clean, exit 0.
- **web**: `npx tsc --noEmit` → clean, exit 0; `npx vite build` → `✓ built in 262ms` (296.63 kB ESM / 218.00 kB CJS), exit 0.
- **react-native / web `dist/`**: `dist` is a build artifact (not git-tracked; RN regenerates it via `prepublishOnly`). Both were rebuilt anyway so the local tree is consistent — `npm run build` exit 0 in each, and `dist/core/config.d.ts` now carries `enableComposerUi?: boolean` + `composerUi: boolean` in both packages. Relevant because RN's `exports` map points `import`/`default`/`types` at `dist/`, so a tarball consumer would not see the option from `src/` alone.
- **ios**: `swift build` **NOT run this pass** — no iOS source was changed (the iOS composer gap is recorded, not coded).
- Not runtime-exercised: no emulator/device run of `enableComposerUi(true)` + `enableAgenticChat(false)`. The knob is build-verified and the resolution is a one-line `?:` / `??`, but the decoupled combination has never been rendered.


## READMENEW.md additive merge (2026-07-21 — new host-customization features, all ADDITIVE, no existing behavior removed; `git` baseline commit proves 0 deletions of prior features)

Good ideas from an alternate `READMENEW.md` spec were merged into the existing (richer) SDK. Each new field/method is optional and defaults to today's exact behavior (precedence: per-instance override → config default → existing theme/brand token). **Build-verified on every platform** (Android `compileDebugKotlin`; iOS `swift build` Core/SwiftUI/UIKit; RN `tsc --noEmit`; Web `tsc --noEmit` + `vite build`); **NOT yet runtime-exercised on device/emulator**.

- **`FarmerChat.updateTokens(accessToken, refreshToken?)`** — ✅ all platforms (Android/iOS/RN/Web). Runtime push of a freshly-refreshed host token into the active session (HOST_TOKEN mode), complementing the init seed + pull-based `tokenProvider`. Routed through each SessionManager; omitted refresh preserves the stored one.
- **FAB customization knobs** — ✅ all platforms. Config defaults `fabLabel`/`fabBackgroundColor`/`fabContentColor` on `FarmerChatConfig`; each FAB resolves per-instance param → config → theme/brand. Per-instance custom icon added (compose `ImageVector`, SwiftUI/UIKit SF Symbol `systemImage`, RN `icon` ImageSource, web `icon` ReactNode).
- **Granular chat UI knobs (the clean 5)** — ✅ all platforms: `userBubbleColor`, `userBubbleTextColor`, `aiBubbleTextColor`, `bubbleCornerRadius`, `messageFontSize` (Android: `messageFontSizeSp`). Wired at existing render sites with a `?? platform-token` fallback (each platform keeps its own current token when unset — e.g. iOS/Android user bubble = reading-surface/dark-text, UIKit user bubble = brand-bg/white-text). Font size wired at every markdown paragraph/bullet/numbered site, not just the first.

### Intentionally NOT shipped from READMENEW.md (tracked gap, needs opt-in)
- **`aiBubbleColor`, `aiAvatarEmoji`, `showUserAvatar`** — ⛔ all platforms. These are NOT overrides of existing UI: no platform renders a per-message AI bubble *container* (Android/RN show the AI answer as bare text on the surface; web/iOS have an AI bg) or any avatar (only iOS SwiftUI shows the logo as an AI mark; no platform shows a user avatar). Shipping them means building net-new per-message UI across 6 UI modules, layout-altering, and it contradicts the SDK's deliberate no-container AI answer design. Per parity rule #4 they must land on all platforms together or be recorded as a gap — recorded here. Config fields were deliberately left OUT so there are no dead/no-op knobs. Re-add with the UI only on explicit host request (build-verified only until a device run is possible).
- **README API-shape differences that are already covered a different way** (NOT gaps): flat `sdkApiKey`/`baseUrl` (we use `guestApiKey` + `environment`/`customBaseUrl`); `chatTitle`/`chatSubtitle`/`inputHintText`/`followUpHeaderText` (achievable via `stringOverrides` label keys); the README's 9 endpoints (a subset of our documented 34); `ChatModal`/`ChatFAB` naming (we ship `FarmerChatFab`/`FarmerChatFabButton`).

---

## Screen / UI / validation / navigation fidelity sweep — v2 android only (2026-09-03)

Scope: `versions/v2/android` **compose + views** flavours. v1 and `versions/v2/{ios,web,react-native}`
untouched — every fix below is therefore an **android-only parity gap on the other platforms** until
the corresponding lane picks it up (parity rule §4(b)).

### Six flagged app composables — three were already present under another name

| App composable | Verdict | SDK equivalent |
|---|---|---|
| `NoInternetScreen` (`ui/error/NoInternetScreen.kt`) | **✅ already faithful — no work.** In the app this is a *legacy wrapper* that delegates to `ErrorScreen(ErrorType.NO_INTERNET)` and has **zero live call sites** (the three grep hits are `HomeViewModel.navigateToNoInternetScreen` — a differently-named private fn — plus its own `@Preview` and a comment). | compose `screens/ErrorScreen.kt` + `components/FullScreenMessage.kt`; views `ErrorFragment` + `FullScreenMessageView` |
| `LanguageSelectionScreen` (`ui/onboarding/language/LanguageScreen.kt`) | **✅ present, 2 fidelity fixes applied** (below) | compose `screens/LanguageScreen.kt`; views `LanguageFragment` |
| `LegalContentDialog` (private, inside `LanguageScreen.kt`) | **✅ superseded.** The app itself routes legal links through `dialog<Destination.LegalContent>` → `PolicyWebViewScreen`; the private in-screen dialog is the pre-nav-graph path. The SDK uses the nav-graph dialog on both flavours, which is the app's live path. | compose `dialog<Destination.LegalContent>` → `screens/LegalContentScreen.kt`; views `LegalContentDialogFragment` |
| `PolicyWebViewScreen` (`ui/onboarding/language/PolicyWebViewScreen.kt.kt`) | **✅ present.** Its `showBottomButtons` Close/Continue row is **dead code on the only live path** — `AppNavGraph.kt:906` passes `showBottomButtons = false, onContinue = null` — so the SDK omitting it is correct, not a gap. `faq_terms` sentinel renamed (`"faq"` → `"faq_terms"`) but internally consistent SDK-wide; one flavour-parity fix applied (case-insensitive match in compose, matching views). | compose `screens/LegalContentScreen.kt`; views `LegalContentDialogFragment` |
| `AIGeneratingImageOverlay` (`ui/home/components/AIGeneratingImageOverlay.kt`) | **⛔ WAS MISSING — now ported to both flavours.** | new compose `components/AiImageOverlays.kt`; new views `widgets/AiImageOverlayView.kt` |
| `MagicEraserProcessingOverlay` (private, inside `ui/home/components/AIGeneratedGradient.kt`) | **⛔ WAS MISSING — now ported to both flavours** (as its only public caller, `AIGeneratedGradient`). | same two new files |

### The image-placeholder gap (the real missing UI)

The app's `ContentCard` (`components/cards/ContentCard.kt:177/200`) drives **two different
animations** off the Coil painter state:

| Coil state | App | SDK before | SDK now |
|---|---|---|---|
| `Loading` | `AIGeneratingImageOverlay(isLoading = true)` — radial fog + 26 orbiting Google-coloured bubbles (2500 ms), and a 40-particle white water blast + fog fade on exit | a **static green linear gradient** (`private fun AiGeneratedGradient`) | ✅ faithful port |
| `Error` | `AIGeneratedGradient` — neutral base + `MagicEraserProcessingOverlay` (fog, 2200 ms radial dissolve, fading processing ring, 24 sticky bubbles drifting once over 3000 ms, light grain) | **the same static green gradient** | ✅ faithful port |

Same colours, same particle counts, same durations, same maths on both flavours. The static
`AiGeneratedGradient` stand-in was deleted.

- **compose** — `components/AiImageOverlays.kt` (`AIGeneratingImageOverlay`, `AIGeneratedGradient`,
  private `MagicEraserProcessingOverlay`), wired into `components/Cards.kt` at the exact two branches.
- **views** — there is no per-state hook on an `ImageView`, so the two animations live in one custom
  `View` (`widgets/AiImageOverlayView`, `Mode.{LOADING,ERROR,HIDDEN}`) drawn over the card image
  inside a new `FrameLayout` in `fc_item_home_content_card.xml`, driven from Coil's
  `load { listener(onStart/onSuccess/onError/onCancel) }` in `HomeFeedAdapter`. Canvas is clipped to
  the card's 16 dp rounded rect (`FcShapeRounded16`).

**Adjacent gap NOT closed:** the app's `Success` branch uses `FogRevealImage`
(`ui/home/components/FogRevealImage.kt`) with a `rememberSaveable` reveal-once guard and an
`enableRevealAnimation` flag (false in scrollable lists to avoid jank). Neither flavour has it — both
render a plain `Image`/`ImageView` on success. **⛔ NOT IMPLEMENTED, both flavours + all other platforms.**

### Navigation edges fixed (docs/01 §2 already documented all of these — the code diverged, not the docs)

| Edge | App | SDK before | Now |
|---|---|---|---|
| `Error` → `onTryAgain` | 5-branch tree on `fromScreen` | **compose**: uniform `popBackStack + retryLastAction`; **views**: already faithful | ✅ compose ported **from views**, which was already app-faithful — no re-derivation from app source. The one place the two flavours cannot share code is the `"drawer"` branch's history refresh: views resolves `activityCoreVm("chat_history")`, compose uses the graph-level `rememberCoreViewModel("sharedChatHistory")`. **Verified these are each flavour's single shared instance** — views uses the key `"chat_history"` at all three sites (`FarmerChatActivity`, `ChatHistoryFragment`, `ErrorFragment`) and compose has exactly one `chatHistoryViewModel()` call site — so both refresh the same VM the drawer and ChatHistory screen read. The key *names* differ; the instance semantics do not. |
| `AccountSuccess` → back | `BackHandler` → Home, `popUpTo(AccountBenefits){inclusive}` | **compose**: no `BackHandler`, `popUpTo<Home>{inclusive=false}`; **views**: already faithful | ✅ compose now has `BackHandler` + `popUpTo<AccountBenefits>{inclusive}` |
| `AccountBenefits` primary CTA offline | `errorNavigationManager.navigateToError(isNetworkError=true, fromScreen="auth", retry={navigate(Auth)})` | **both flavours** navigated straight to the Error destination, so **`retryLastAction()` was a no-op** — "Try again" left the user on Error | ✅ both flavours route through `navigateToError` with the retry registered |
| Drawer/Settings sign-up offline | app has **no** pre-flight check — `getUserQuestionCount()` simply fails to return Success and the user lands on `AccountBenefits` | **compose**: falls back to `AccountBenefits` (app-equivalent); **views**: navigated to the **Error screen** — a flavour split *and* a divergence from the app | ✅ views now falls through to `AccountBenefits` |

The Error retry tree, verbatim on both flavours: still-offline + `isNetworkError` → stay put;
`drawer` → history refresh + pop; `chathistory` → pop + re-enter ChatHistory (singleTop);
`home_weather`/`home_card` → pop only, **no** `retryLastAction()` (no API was triggered);
otherwise pop, and if nothing popped re-navigate by `language`/`name`/`auth`, then `retryLastAction()`.

**Nav edge recorded, deliberately NOT implemented:** `Home` → `SettingsLanguage` after an app update
(`AppInstallUpdateTracker.isUpdateLanguageScreenPending`, Kenya-excluded; docs/01 §2 row
"Home (post-update, non-Kenya)"). An SDK embedded in a host app has no meaningful "the app was
updated" signal — the host's versionCode is not the SDK's. ⛔ NOT IMPLEMENTED, all platforms.
See docs/05.

### Validation ported 1:1

| Rule | App source | SDK before | Now |
|---|---|---|---|
| `isPhoneValid` | `ui/auth/AuthViewModel.kt:861` | **no Ethiopia rule**; treated `phone_number_pattern` as the *final* answer instead of one of several hard gates | ✅ 1:1: `+251` → starts 7\|9 **and** exactly 9 digits (short-circuits, applies even with no country selected); then `phone_length` hard gate; then `phone_number_pattern` hard gate (malformed regex → reject, never throw); then unknown-country fallback `6..15`. Extracted to `AuthViewModel.isPhoneValid(countryCode, phoneLocal, country)` — **11 new unit tests**. **One deliberate deviation, not 1:1:** both the length gate and the input cap are guarded with `phone_length > 0`, so a `phone_length: 0` row from endpoint #16 degrades to the pattern/`6..15` path instead of locking the field at zero characters as the app would. Conservative reading; open question in docs/05 |
| phone input cap | `setPhoneLocal` caps at `selectedCountry?.phone_length ?: 15` | **no cap** — the user could type past the country length | ✅ capped |
| `setOtp` | 4 digits; `otpError` deliberately **sticky** ("keeps OTP boxes red after a failed attempt, per UX requirement") | cleared `otpError` on every keystroke | ✅ sticky |
| `normalizeNameInput` | `isLetter() \|\| isWhitespace()`, `trimStart()`, then `Regex("\\s+") → " "` | filtered `it == ' '` only, so a pasted `"John\tDoe"` became `"JohnDoe"` | ✅ 1:1 |
| `sanitizeNameForUi` | trim, blank `"No Name"`/`"null"`, `.take(100)` | no `.take(100)` | ✅ 1:1 |
| name min/max + toasts | 3 / 100, `NAME_MUST_BE_AT_LEAST`/`NAME_MUST_BE_AT_MOST` + `CHARACTERS` | ✅ already faithful (both flavours) | unchanged |
| OTP length / verify gate | 4 digits | ✅ already faithful (both flavours) | unchanged |

Unverifiable-by-design note: the app also runs Google **libphonenumber** as a *safety net* but
explicitly does not hard-fail when it is absent (`if (libOk == false) return false`, `null` when the
library is missing). The SDK ships no libphonenumber dependency, so it takes the app's own
library-absent branch. ⛔ libphonenumber cross-check NOT IMPLEMENTED, all platforms.

### English label fallbacks realigned to the app's exact copy (root CLAUDE.md §2)

A mechanical diff of every `getLabel(Labels.X, "…")` in the app against every
`label(Labels.X, "…")` / `labelManager.getLabel(Labels.X, "…")` in the v2 android tree found
**34 keys whose English fallback did not match the app**. **44 literals across 19 files** were
corrected to the app's exact string. Only fallbacks changed — no key was added, removed or renamed.

Two of them were not cosmetic:

- **`SSFR_WHEAT_QUESTION` / `SSFR_MAIZE_QUESTION`** are the **query text sent to the chat API**,
  not decoration. The SDK asked *"Give me fertilizer recommendation for my wheat farm"*; the app asks
  *"What is the recommended quantity of fertiliser for wheat?"*. Fixed in both flavours. Scope of the
  effect, stated precisely: both keys (`fc_v2_app_label_ssfr_{wheat,maize}_question`, byte-identical
  to the app's) **are served by endpoint #3** — they are not among the ten unserved keys in docs/05 —
  so whenever labels resolve, the server value wins and this change is cosmetic. It only changes what
  the farmer actually asks on the **fallback path** (labels not yet fetched, or the key missing for a
  language), where the SDK was previously sending a question the app never sends.
- **`PLEASE_ENABLE_CAMERA_SETTINGS` / `PLEASE_ENABLE_MICROPHONE_SETTINGS`** in views
  `InputOverlaysController` were *truncated* concatenated literals (`"…get instant "` + `"advice…"`).
  The rewrite initially duplicated the tail; caught and repaired — verified by reading the file back.

Other notable ones: `FARMERCHAT_TAGLINE` (SDK invented *"Practical advice for your crops and
animals"*; app is *"FarmerChat: Practical advice\nfor your crops & livestock"*),
`GET_STARTED_BY_CLICKING_…` , `CHOOSE_A_FOLLOWUP_OPTION_BELOW`, `RECENT_CHATS` (views said
*"Past Advice"*), `PREVIOUS_QUESTIONS_MENU`, `LOCATION_HELPS_SUGGESTIONS`, `LOCATION_TAILOR_ADVICE`,
`WE_GREET_YOU_NAME`, plus a batch of `…` → `...` ellipsis mismatches.

**⛔ The same audit has NOT been run on ios / web / react-native** (out of lane). Given that a
majority of the 34 mismatches were shared-origin wording, the other three platforms very likely
carry the same drift. Recorded as a gap for those lanes.

**Known limit of the audit, so the next person does not over-trust it:** the detector matches
`…(Labels.X, "literal"` and therefore reads only the **first fragment** of a multi-line concatenated
fallback. That is exactly how the two truncated `PLEASE_ENABLE_*_SETTINGS` literals were both found
*and* briefly mis-rewritten. Re-running the same diff after the pass reports zero remaining
mismatches for all 34 keys (proof nothing was clobbered by the concurrent lanes), but a *correctly*
concatenated multi-line fallback is only partially covered — `TERMS_OF_USE_DESCRIPTION`, added by
another lane during this pass, shows up as a false positive for this reason and was verified by hand
to concatenate to the app's exact string in both flavours.

Also fixed while in `AuthScreen`: the SDK appended `"${countryCode} ${phoneLocal}"` after
`CHECK_YOUR_MESSAGES_CODE`; the app renders that label alone (`ui/auth/AuthScreen.kt:1030`).
Compose now matches views.

### `displayedLanguages` row ordering (app rule, was missing on both flavours)

The app pins the current selection to the **top of the priority list** when it lives only in the
collapsed "All languages" list (`LanguageScreen.kt` + `LanguageChooserScreen.kt`, identical code).
Compose rendered the priority list unmodified (selection invisible while collapsed); views instead
**force-expanded** the whole list. Both now share one core implementation,
`core/ui/settings/LanguageDisplayOrder.rowsToShow(...)` — **5 new unit tests**.

### LanguageScreen divergences recorded, deliberately NOT churned

The SDK screen is a faithful *port*, not a pixel copy, and these differences all resolve through the
SDK's own theme tokens. Recorded so the ledger is honest, not as work items: `titleLarge` vs
`displaySmall` for "Choose your language"; logo mark 32 dp/`borderActive` vs 44 dp/`foregroundPrimary`;
`Scaffold`+`bottomBar`+220 dp spacer vs weighted `Column`; the "All languages" chip on
`buttonPrimarySurface` vs `surfaceSecondary`; app picks one loading label from
`guestInitState`/`languageState` while the SDK rotates both through `LogoSpinner`; app's Start button
is `Chevron` when enabled / `Default` otherwise while the SDK adds a `Loading` + `SETTING_LANGUAGE`
submitting state. Chasing these is unbounded and none changes behaviour.

### Third-party SDK boundary (root CLAUDE.md §6)

Every ported screen was checked. The app's `FullScreenMessage`, `ErrorScreen`,
`LanguageSelectionScreen`, `PolicyWebViewScreen` and the `AccountBenefits` nav entry all call
`so.plotline.insights.Plotline.trackPage/track`; `LanguageSelectionScreen` and `AccountBenefits`
additionally call `AnalyticsManager.track(... AdjustEventTokens …)` and
`OnboardingRemoteConfig.refresh()` (Firebase). **None of that is in the SDK** — the ported screens
raise `graph.analytics.trackScreenView/trackScreenExit/track` only, which reaches the host through
`config.onEvent`. The two new overlay files are pure drawing code with no analytics in the app either.
No new third-party dependency was added (notably **not** libphonenumber).

### Verification (actually run, 2026-09-03)

`./gradlew :farmerchat-core:assembleDebug :farmerchat-android-compose:assembleDebug
:farmerchat-android-views:assembleDebug :sample-compose:assembleDebug :sample-views:assembleDebug
:farmerchat-core:testDebugUnitTest` — **BUILD SUCCESSFUL**; `testDebugUnitTest` reported
**76 tests, 0 failures** across 11 classes (the 43 documented for 2.0.0, this lane's **16 new**
— 11 `PhoneValidationTest` + 5 `LanguageDisplayOrderTest` — and the rest added by the lanes running
concurrently in the same tree). Build-verified only: **nothing in this pass ran on a device or
emulator**, so the two ported animations have never been *seen* — their fidelity is argued from a
line-by-line port of the app's colours, counts, durations and maths, not from a screenshot.

---

## 2.0.0 android — analytics event fidelity (lane: analytics events + properties, 2026-09-03)

Scope: `versions/v2/android` only. Full enumeration of every event name and property key
the app can emit (`core/analytics/*.kt` **plus every call site**, since call sites pass keys
the constants file never declares), diffed against the SDK, then closed.

### Diff summary

**Emitted by both, but the SDK sent a DIFFERENT property key or value — all fixed:**

| Event | App key/value | SDK before | Now |
|---|---|---|---|
| `Country_selected` | `country_code` = `selected.code` | `Country` = `country.name` | `country_code` = `country.code` (+ `screen_name`) |
| `Send_OTP_Click_Event` / `Resend_OTP_Click_Event` | `channel` | `type` | `channel`; resend attributed to `Verify OTP Screen` |
| `Submit_OTP` | `verification_status`, `error_message` (+ `attempt_number` on failure), **no** `screen_name`; fired on the RESULT | `screen_name` only; fired on submit | app payload, fired on success + failure |
| `Login_Completed` | fires for **all** users with `user_id` + `is_new_user` (String) | fired only for existing users, no props | app payload, fires for all users |
| `OTP_Lockout_Reached` | `screen_name`, `lockout_type` (`rate_limit`/`device_limit`), `error_message`, `channel` | no props | app payload |
| `Settings_Option_Selected` | `option` = `"Appearance"`, `value` = `Light`/`Dark`/`Default`; `option` = `"Signup"` on sign-up | `Option` = `"appearance_$mode"`; no sign-up event | both app payloads |
| `New_Chat_Click_Event` | `screen_name` = `"Chat History screen"`, `Conversation ID` (space) | `Chat History Screen`, `conversation_id` | app payload |
| `FAQ_Clicked` | `screen_name` = `"Help and support screen"`, `Question`, `ID` | no props | app payload |
| `question_card_data_Submitted` | `screen_name` + `crops` / `livestock` / `gender` | `Card_Type` + `Value` | app payload for all three cards in **both** UI artifacts (crops via `HomeViewModel`; gender + livestock at the compose `onSingleConfirmed`/`onMultiConfirmed` and the views `onSingleSelect`/`onMultiSelectConfirm`), each paired with the app's question-card `Card_Clicked` carrying the selection as `Value` (app HomeScreen.kt:1401/1454) |
| `Mobile_verification_Started` | `screen_name`, `trigger` = `"Signup button"` | no props | app payload |
| `Transcription_Success` (Home) | `{screen_name, Input_type, Source}`, **no** `Confidence_Score` | `Confidence_Score` + `audio_format` | app payload (`audio_format` removed — the app never sends it here) |
| `Transcription_Failed` | above + `Confidence_Score` as a **String** (`"N/A"` when unavailable) | `Confidence_Score` as a Double | app payload |
| `Card_Clicked` / `Card_Viewed` | full 15-key `trackHomeCardEvent` payload | 2 keys | full payload |
| `Logout_Click_Event`, `Hamburger_Menu_Clicked`, `Weather_Forecast_Viewed`, `Content_Try_Again_Clicked`, `Answer_Share/Save_Button_Clicked`, `Started/Stopped_Playing_Response_Audio`, `Name_Skip_Click_Event`, `Save_Language_Click_Event`, `Start_Over_Clicked`, `terms_of_use_opened`, `privacy_policy_opened`, `Microphone_Click_Event`, `Chat_Icon_Clicked`, `Image_Option_Dialog_Click_Event`, `Send/Cancel_Record_Audio_Click_Event`, `Input_Capture_Failed`, `Permission_granted/denied/popup_shown`, `Permission_Fallback_Default_Setting_Shown` | each carries `screen_name` and, per event, `Icon` / `Option` / `Input_type` / `Source` / `Failure_Reason` / `Permission_type` / `Attempt` / `No_of_seconds_played` | mostly bare | app payloads |

**App-only → now emitted by the SDK (were declared but reached from nowhere):**

| Event(s) | Where wired |
|---|---|
| `API_Call_Initiated` / `_Success` / `_Failed` / `_Timeout` | 36 sites across `OnboardingSharedViewModel`, `HomeViewModel`, `SettingsViewModel`, `EnterNameViewModel`, `LocationPromptManager` via new `FarmerChatAnalytics.trackApi*` helpers. New `AnalyticsApis` object ports the app's ten `API_Name` values verbatim. `Timeout` vs `Failed` selected by `ApiResult.Error.isTimeout`, as the app does |
| `Device_Location_Fetch_Initiated` / `_Succeded` / `_Failed` | `OnboardingSharedViewModel` geolocate, always `screen_name = Splash Screen` |
| `Onboarding_completed`, `FirstTimeOnboardingCompleted` | `OnboardingSharedViewModel` set-language success, `screen_name = Select Language Screen`; the one-shot gate now uses the app's default-**true** semantics |
| `Card_Shown` | both UI layers, one per visible section when the feed lands |
| `ToS_Aug26_Accept_Terms` | compose `TermsOfUseDialog` accept, `{screen_name: "TermsOfUseDialog", Accepted: true}` |
| `Permission_popup_shown` + `location_permission_prompt_triggered` + `Permission_granted/denied` + `Permission_Fallback_Default_Setting_Shown` on the GPS flow | `LocationPromptManager`, via a port of the app's `trackGpsEvent`/`triggerLabel` (every GPS event now carries `screen_name = "GPS Screen"`, the app's `Trigger` label — `Weather Icon`/`Home Screen`/`Settings Screen`/`Plotline Campaign`/`MoEngage Campaign` — and `Attempt`) |
| `Location_Update_Triggered` | `LocationPromptManager.enterFetchingLocation`. The app has exactly **one** emit site and it is in the **fetch** phase, not at trigger time (app `LocationPromptHost.kt:435-452`, inside the `LaunchedEffect(state)` fused-location effect): `Attempt = s.attempt + 1`, and `screen_name` is **overridden to `Dashboard Screen`**, not the GPS screen. A first draft of this lane emitted it from all four trigger entry points with `screen_name = "GPS Screen"` — that was wrong and was corrected before landing |

**App-only, NOT closed (recorded with reason):**

| Event | Reason |
|---|---|
| `App_Installed`, `App_Updated` | the app's `AppInstallUpdateTracker` observes install/update of the **host** app, which is not the SDK's to observe. No emit point exists |
| `Force_Update_Popup_Shown` / `_Update_clicked` / `_Cancel_clicked` | the SDK has no force-update feature at all (`grep -ri force_update` → 0 hits). No feature, no emit point; building one is out of this lane |
| `Chat_History_Click` `question_index`/`conversation_id` in **views** | the views drawer has no previous-questions list; the compose drawer emits the full payload |
| `ToS_Aug26_Accept_Terms` from Home | the app's Home site is driven by the Plotline widget event bus (`PlotlineHomeEvents.acceptTerms`), which the SDK has no equivalent of (§6). The dialog site IS emitted |
| `Onboarding_completed_Step2` | declared in the app's constants but the app has **no live call site**. Not invented here |
| `Starter_Questions_Generated`, `Profile_Click`, `New_Chat_Click`, `Account_Preference_Click`, `location_permission_allowed`, `location_fallback_used_ip_based_location`, `location_settings_opened`, `location_settings_update_location_clicked`, `location_settings_location_permission_clicked` | same: declared in the app's constant files, zero live app call sites (several are commented out at the call site). Left unemitted rather than guessing a trigger |

**SDK-only emissions (no §2 name violation — every name below is declared in the app's own
`OnboardingAnalyticsEvents`/`GpsAnalyticsEvents` — but the app never fires them):**

| Event | Justification |
|---|---|
| `Registration_Completed` | app-declared; the app expresses new-vs-returning as `Login_Completed` + `is_new_user`. The SDK now emits the app's `Login_Completed` payload for **all** users and keeps `Registration_Completed` as an additional new-user signal for hosts already consuming it. A host wanting exact app shape should read `is_new_user` |
| `Chat_Screen_Back_Button_Click` | app-declared, no live app call site; kept because the SDK's chat back affordance is a real, distinct user action worth a signal |
| `Edit_Profile_Click` | app-declared, no live app call site (`Account_Preference_Click` is commented out in `DrawerContent.kt:219`) |
| `location_update_success`, `location_update_failure` | app-declared, no live app call site; the app tracks the same outcome only as `API_Call_Success/Failed` for `Update user location`, which the SDK **also** now emits alongside |
| screen names `"Chat History Screen"`, `"Settings Name Screen"`, `"Error Screen"` | the app's `AnalyticsScreens` has no constant for these three surfaces (its Chat-History/Settings-Name screens never call `trackScreenView`, and it has no error screen). Kept as SDK additions and labelled as such in `AnalyticsScreens` |

No SDK-only **event name** exists that is absent from the app's constant files.

### Preserved app quirks (asserted in tests, do not "fix")

- Property-key typos frozen by the analytics sheet: `langauge_code`, `isOnnboarding_query`,
  `length_of_Text_query`.
- Event-name typo: `Device_Location_Fetch_Succeded`.
- `trackHomeCardEvent` maps `AnalyticsProps.STATE to data.county` — the `State` key carries the
  **county** value and `County` is never emitted, despite being declared.
- `screen_name` on card events is always `Dashboard Screen`, whatever surface raised the card.
- Call-site literals that are NOT the `AnalyticsScreens`/`AnalyticsProps` constants for the same
  thing and must stay distinct: `"Menu"`, `"Side Menu"`, `"Chat History screen"`,
  `"Help and support screen"`, `"TermsOfUseDialog"`; `option`/`value`/`trigger` (lowercase) vs
  `Option`/`Value`/`Trigger`; `Conversation ID` (capitalised, with a space) vs `conversation_id`.
- `Confidence_Score` is emitted as a **String** (`"N/A"` when the API failed), never a number.
- `Attempt` is `1` on a permission grant and the **next** deny count on a denial.

### Trigger-timing deltas between the two Android UI artifacts (recorded, not closed)

| Event | App trigger | android-views | android-compose |
|---|---|---|---|
| `Card_Viewed` | `Modifier.onGloballyPositioned`, fires at **≥50% visible** (app HomeScreen.kt:2059-2080) | ✅ same — measured from `getGlobalVisibleRect` in `trackVisibleCards()` | ⚠️ fires from `LaunchedEffect(section.stableId())`, i.e. **entered composition**. `LazyColumn` composes ahead of the viewport, so compose can report a card viewed slightly before it is 50% visible. Closing this needs an `onGloballyPositioned` visibility port and is out of this lane's scope |
| `Card_Shown` | `LaunchedEffect(homeFeedResponse)` — once per feed response | ✅ guarded by `shownFeedKey` (the views state collector re-enters `UiState.Success` on every unrelated emission — card dismissal, weather, crop update — so an unguarded batch would re-fire each time) | ✅ `LaunchedEffect(feed)`, keyed on the feed as the app is |

### Preference-key correction made by this lane

`FirstTimeDashboardViewed` was gated on `SdkPreferences.Keys.FIRST_TIME_ONBOARDING_COMPLETED`
(`"PREF_FirstTimeOnboardingCompleted"`), which is the app's **onboarding** gate. The app uses two
separate keys. Added `FIRST_TIME_DASHBOARD_VIEWED = "FirstTimeDashboardViewed"` and moved the
dashboard gate onto it; the onboarding key now carries the app's default-true semantics for
`FirstTimeOnboardingCompleted`.

Two one-off migration effects on installs upgraded from an earlier 2.0.0 build, both accepted:
`FirstTimeDashboardViewed` fires once more (its new key has never been written), and an install
whose old `PREF_FirstTimeOnboardingCompleted` was set to `true` (which used to mean "dashboard
seen") now reads as "not yet fired" under the app's default-true semantics, so it can emit one
spurious `FirstTimeOnboardingCompleted` on its next set-language success.

### Left to the agentic-chip lane (not touched here, by agreement)

`SendQueryProperties`' chip fields and the chip send path are owned by the `SendAlignmentChip`
lane. Findings handed over: the app puts **seven** chip keys on *every* `Send_Query` /
`Send_Query_Initiated` (not only chip ones) — `agentic_chip_status` defaulting to `"none"` and
`agentic_chip_type` / `_value` / `_label` / `_skipped_type` / `_shown_type` defaulting to `""`;
the shipping status values are the `AnalyticsProps.CHIP_STATUS_*` constants
(`selected`/`skipped`/`available`/`none`), **not** the `skipped_manual`/`shown`/`not_shown`
strings in that file's KDoc; and `isAlignmentChip -> "align_chip_sel"` is the **first** branch of
the app's `click_type` `when`, ahead of `isReadFullAdvice`. `agentic_chip_type` on GPS events
(app `LocationPromptHost.kt:181-188`) is likewise left to that lane.

> **Handed over and BUILT the same day** — see §"Chip analytics — BUILT" at the end of this
> document. All three findings above were implemented as stated (including the constants-not-KDoc
> point and the `align_chip_sel`-first precedence) and are guarded by literal assertions that took
> `AnalyticsNamesTest` from 19 to 28 tests.

### Verification (actually run, 2026-09-03)

`./gradlew :farmerchat-core:assembleDebug :farmerchat-android-compose:assembleDebug
:farmerchat-android-views:assembleDebug :farmerchat-core:testDebugUnitTest` — **BUILD SUCCESSFUL**;
`testDebugUnitTest` reported **117 tests, 0 failures, 0 errors** across 13 classes, of which this
lane's new `AnalyticsNamesTest` contributes **22** (event names, property keys, screen names,
`API_Name` values, the emitted `API_Call_*` and card payloads, `cardPositionLabels`,
`toHomeCardAnalytics` fallbacks, the five `gpsTriggerLabel` strings + `gpsAnalyticsProps` shape,
and `appearanceAnalyticsValue` — all asserted as **literals** transcribed from the app, never by
referencing the constant under test). `gpsTriggerLabel` / `gpsAnalyticsProps` /
`appearanceAnalyticsValue` were lifted out of the UI files into core precisely so these
hand-transcribed strings could be tested and cannot drift between the two UI artifacts. Build- and test-verified only: **nothing ran on a device or
emulator**, so no event was observed arriving at a host listener at runtime.

## #27a real wire contract — android v2 brought in line (2026-09-03)

The agentic stream was captured live from stage for the first time on 2026-09-03. The contract and
the two raw captures are in **docs/02 §#27a** / `docs/captures/`; they are the ground truth for
everything below. Scope of this pass: **`versions/v2/android` only**. v1 untouched;
`core/analytics/` untouched (a parallel lane owns it).

### Confirmed correct, left alone

`text_delta`'s payload key really is `delta`; `done` really is non-terminal with `metadata` last;
`Accept: application/json` is right (`text/event-stream` → HTTP 406, re-confirmed);
`ACTION_SELECT == "invoke"` and `VALUE_SHARE_LOCATION == "share_precise_location"` match the wire.

### What changed on android

| # | Change | Where |
|---|---|---|
| 1 | `event: status` (`{"stage":"thinking"}`) handled — was dropped by the typeless fallback. New `AgenticEvent.Status`; surfaced like a tool status label, so the loading placeholder becomes a live bubble before the first delta (6.7 s TTFT on the capture) | `AgenticModels.kt`, `AgenticChatDataSource.parseEvent`, `ChatViewModel.streamAgenticAnswer` |
| 2 | `event: surface` handled — an alignment surface now renders MID-STREAM instead of waiting for `metadata.alignments`. New `AgenticEvent.Surface` | same three + `ChatViewModel.applyStreamSurface` |
| 3 | `AlignmentChip` gains `label_key`, `label_en`, `behavior`, `capability`, `request`, `submit{kind,surface_type,action,text,data,requires}`. Routing prefers `behavior`/`capability`, keeps the value match | `ChatModels.kt`, new `core/ui/chat/AlignmentChipRouting.kt` |
| 4 | `VALUE_USE_APPROXIMATE_LOCATION` added; the decline path recognises it as well as `not_now` | `ChatModels.kt`, `AlignmentChipRouting.kt`, docs/05 |
| 5 | Surface payload gains `intent`, `interaction_kind`, `blocking`, `context{required_precision,original_query,subject}`, `budget{asked,max}`. `blocking` drives dismissibility — the "type or say it" escape hatch is withheld on a blocking surface | `ChatModels.kt`, `ChatModels.kt` (ui), both `AlignmentSurface`s |
| 6 | Six `TextPromptRequest` fields added and sent: `parent_message_id`, `location_declined`, `photo_declined`, `streaming_required`, `image_name`, `image`. `streaming_required` is wired end to end: `SupportedLanguage.streaming_required` → prefs `is_streaming_required` → every text-prompt request | `ChatModels.kt`, `LanguageModels.kt`, `SdkPreferences`, `OnboardingSharedViewModel`, `SettingsViewModel`, `ChatViewModel.fetchTextPromptResponse` |
| 7 | `ChatAction.SendAlignmentChip` ported (the app's 18th action; SDK had 17) with the app's exact 9-parameter signature and `sendAlignmentChip` implementation. Both flavours' chip taps and both location-decline paths now route through it | `ChatAction.kt`, `ChatViewModel.kt`, both flavours' chat screens |

**Routing table moved into core.** The previous pass kept it per-flavour and tested a local mirror;
this doc already called that the worse pattern. `routeAlignmentChip(kind, chip)` in
`core/ui/chat/AlignmentChipRouting.kt` is now the single table, called by the Compose screen, the
Views fragment and `CapabilityChipTest` (which was rewritten onto it, deleting its mirror).

`behavior` beats `action`, and `capability` alone can never select the invoke path — **both** live
`gps-prompt` chips carry `capability: "location"`, so keying on it would send the decline chip into
the permission dialog the farmer just refused.

### Three defects the captures exposed

1. **Every non-`metadata` finalize path erased a mid-stream surface.** `finalizeAgenticAnswer` and
   `interruptAgentic` build a fresh `AiResponse` with no alignment fields. On the gps capture
   `done.answer` is `null` and there are ZERO deltas, so a stream that dropped after `done` fell all
   the way to `interruptAgentic` — the farmer's blocking question replaced by an error card. The
   rendered surface is now threaded through finalize, plus a new "surface rendered, no metadata →
   settle it" branch ahead of the error branches.
2. **`handleTextPromptResult` removed-then-appended.** With `reuseId` it now replaces IN PLACE.
   Removing and appending re-ordered the settled answer behind anything added meanwhile and would
   have duplicated a surface the farmer had already answered. This is also what makes the
   `surface` + `metadata.alignments` pair ONE message rather than two: both write the same id.
3. **The reader never closed its channel on the terminal event** (drive-by, same file). `dispatch`
   returning true did `return@use`, skipping `producer.close()`, so `callbackFlow`'s collector
   suspended until its scope was cancelled. Safe to fix: `finalized` is already true post-metadata,
   so the now-reachable `finalizeStreamOrFail()` is a no-op.

**Not test-covered.** `AgenticCaptureReplayTest` asserts what the PARSER emits; there are no
ChatViewModel-level tests in the module, so all three of the above — the finalize branches,
`applyStreamSurface`/`settleStreamSurface`, and the in-place replace — are argued from the captured
event ordering and read, not exercised by a test. Treat them as reasoned, not verified.

`blocking` also drives whether a mid-stream surface settles immediately: while `state.isLoading` is
true the flavours disable every chip, so a blocking surface that stayed "loading" would render the
question and refuse the taps. Blocking/exclusive surfaces settle on arrival; an additive nudge
attaches to the still-streaming answer and unlocks at finalize (a terminal settle forces
`isStreaming = false` even for a non-blocking additive surface — otherwise the bubble stays in the
streaming state forever, with no action row and a stall hint that never clears).

**Caveat on change 2, so the entry is not read as an unqualified win.** The mid-stream render only
buys anything when `metadata` is LATE — and that is exactly when a chip tapped from the early
surface sends `parent_message_id = null`, because the bubble's server `messageId` is only populated
by `metadata`. The same tap also lets a late `metadata` reset `isLoading` under the new in-flight
request. On both captures `done` + `surface` + `metadata` arrive in one flush, so the window is
milliseconds wide and no farmer can hit it; it is recorded because the null-`parent_message_id`
case is the gap this pass closed everywhere else.

### Testing

New `AgenticCaptureReplayTest` (**11 tests**) copies both captures into
`farmerchat-core/src/test/resources/wire-captures/` (NOT `captures/` — `.gitignore`'s Android-Studio-profiler rule swallows any directory of that name; the same rule had left `docs/captures/` itself untracked, and is now negated for it) and replays them through the PRODUCTION reader —
`AgenticChatDataSource.readEvents`, extracted from `stream()` for exactly this purpose — asserting
the full parsed sequence. It also asserts each capture's byte length (13,273 / 4,620, per docs/02)
so a stale copy cannot pass.

```
prose: Status, ToolCall, ToolResult, TextDelta ×9, Done, Surface, Metadata   (15 events)
gps:   Status, Surface, Done, Metadata                                       (4 events)
```

The 9 deltas concatenate **exactly** to `metadata.response`, and `sanitizeAgenticStreamText` of that
concatenation equals `metadata.response.trimEnd()` — i.e. the sanitizer is a pure trim on a clean
answer and strips nothing real. `CapabilityChipTest` grew from 7 to **15 tests**, now including the
two verbatim live chips. `AgenticEventParsingTest` (14) is retained for the permissive fallbacks the
captures do not exercise, its "cannot be verified against a live stream" class doc corrected.

**Verification (actually run, 2026-09-03, in `versions/v2/android`):**

```
./gradlew :farmerchat-core:assembleDebug :farmerchat-android-compose:assembleDebug \
          :farmerchat-android-views:assembleDebug :sample-compose:assembleDebug \
          :sample-views:assembleDebug :farmerchat-core:testDebugUnitTest
BUILD SUCCESSFUL in 4s
178 actionable tasks: 10 executed, 168 up-to-date
```

`testDebugUnitTest`: **123 tests, 0 failures** across 13 classes (`AgenticCaptureReplayTest` 11 new,
`CapabilityChipTest` 7 → 15, `AnalyticsNamesTest` 19 → 28). Build- and test-verified only —
**nothing in this pass ran on a device or emulator**, so the mid-stream surface render and the
blocking-surface escape-hatch suppression have never been *seen*.

### Chip analytics — BUILT (the analytics lane landed mid-pass and handed these over)

Originally recorded here as "needed from the analytics lane". That lane finished and released
`SendQueryProperties`, so the chip analytics were implemented in this pass rather than deferred.

`SendQueryProperties` gains six fields — `isAlignmentChip`, `agenticChipType/Value/Label/Status`,
`agenticChipSkippedType`, `agenticChipShownType` — and `AnalyticsProps` gains ten constants. Three
things about it are easy to get wrong and are each guarded by a literal assertion in
`AnalyticsNamesTest`:

1. **Seven keys on EVERY `Send_Query` / `Send_Query_Initiated`, chip or not** — `agentic_chip_status`
   defaulting to `"none"` and the other five string keys to `""`. A key that appears only on chip
   payloads is a different schema from the app's; before this, non-chip payloads were seven keys
   short too, not just the chip path.
2. **The status values come from the app's CONSTANTS, not its KDoc.** `SendQueryAnalytics.kt`'s doc
   comment says `skipped_manual` / `shown` / `not_shown`; `AnalyticsProps` declares `selected` /
   `skipped` / `available` / `none`, and the app's own `toAnalyticsProperties()` compares against
   the constants. Transcribing the KDoc would emit values the app never sends.
3. **`isAlignmentChip -> "align_chip_sel"` is the FIRST `click_type` branch**, ahead of
   `isReadFullAdvice`. Appended instead of prepended, a chip tapped on an advice card would report
   `read_full_advice`.

Both chip senders stamp them: `sendAlignmentChip` from the action's `chipType`/`chipValue`/
`chipLabel` with status `selected`, and `sendLocationSharedQuery` reports a SUCCESSFUL location
share as a chip pick (`gps-prompt` / `share_precise_location` / the `SHARE_LOCATION` label), which
the app does at `ChatViewModel.kt:1105` and which the location path would otherwise bypass entirely.

**`agentic_chip_type` on the GPS funnel** is also done, the half the events lane deliberately left
open. `LocationPromptManager` gains `agenticChipOrigin` (port of the app's `activeAgenticChip`): set
by `triggerFromLocalContext(fromAgenticChip = true)`, which both flavours now pass from the
share-location chip, and cleared by every other trigger so it only ever describes the running flow.
While set, every GPS event is re-attributed to Chat — `screen_name` = Chat, `Trigger` = "Chat
Screen", `agentic_chip_type` = `gps-prompt`. The override is applied AFTER the per-call extras on
purpose: the fetch-phase `Location_Update_Triggered` passes `screen_name` = Home as an extra and the
chip attribution has to win over it (app `LocationPromptManager.kt:438`).

`agenticChipStatus`'s `skipped` and `available` cases are modelled and tested but not yet STAMPED by
any SDK caller — the app sets them from a `manualSendChipContext()` / response-time hook that is not
ported. Recorded as a gap, not claimed.

### An additive surface now suppresses the follow-up list (app 43ba5de4)

The reference app was updated mid-pass (`fc-compose-agentic` HEAD `c0524dd6` → `0c8c740f`).
Commit **43ba5de4 "no follow up in case of chips"** adds to `ChatThreadContent.kt`:

```kotlin
showFollowUps = !(alignmentKind != null && alignmentKind.isAdditive && !message.alignmentChips.isNullOrEmpty()),
```

Ported to both flavours, **ANDed** with the existing gate rather than replacing it — compose's
`followUps.isNotEmpty() && !isLoading && errorMessage == null && lastAnswerRevealed`, views'
`isLast && settled`. Without it an additive surface (`gender-select` / `commodity-confirm`) renders
AND the follow-up list renders beneath it, offering the farmer two competing lists.

The live capture independently corroborates the rule: the prose answer's `metadata` carries
`"followups_gated_by": "commodity-confirm"` with `followups: []`, i.e. the backend suppresses its
own follow-ups for exactly this case. Not a client-side guess.

Also from that pull and confirmed ALREADY present in the SDK, so untouched: the chat-history
`isAgentic = getAgenticChatEnabled()` mirroring.

### Parity: what ios / react-native / web still need (root CLAUDE.md §4)

Recorded as gaps, not silently skipped. Nothing here was applied off-android in this pass.

| Change | ios | react-native | web | Notes |
|---|---|---|---|---|
| 1. `status` event → progress signal | ⛔ | ⛔ | ⛔ | Same symptom on all three: the ping falls into the typeless fallback and the farmer sees a bare spinner for the whole TTFT |
| 2. `surface` event → mid-stream render | ⛔ | ⛔ | ⛔ | **Highest priority.** All three also carry defect (1) above — a dropped stream after `done` on a gps surface produces an error card in place of the question |
| 3. Richer chip fields + `behavior`/`capability` routing | ⛔ | ⛔ | ⛔ | ios/rn/web already keep the routing table in a shared core module, so this is one function each |
| 4. `use_approximate_location` decline value | ⛔ | ⛔ | ⛔ | Until fixed, the live decline chip sends no `location_declined` on any of the three |
| 5. Surface `blocking` / `context` / `budget` / `interaction_kind` | ⛔ | ⛔ | ⛔ | Includes the `original_query` ← `context.original_query` fallback, without which a `context`-only surface loses its capability re-send |
| 6. Six `TextPromptRequest` fields + `streaming_required` chain | ⛔ | ⛔ | ⛔ | `parent_message_id` was the largest known fidelity gap; it is now android-only closed |
| 7. `SendAlignmentChip` equivalent | ⛔ | ⛔ | ⛔ | All three still dispatch a bare follow-up for a chip tap, so no `parent_message_id`, no chip marking by value, and the location-decline path is untagged |
| 8. Seven `agentic_chip_*` keys on every query payload | ⛔ | ⛔ | ⛔ | Includes the `align_chip_sel`-first `click_type` precedence and the constants-not-KDoc status values. All three platforms are currently seven keys short on EVERY `Send_Query`, not only chip ones |
| 8b. `agentic_chip_type` on the GPS funnel | ⛔ | ⛔ | ⛔ | Needs each platform's location manager to carry an agentic-chip-origin flag set by the share-location chip |
| 9. Additive surface suppresses the follow-up list (app 43ba5de4) | ⛔ | ⛔ | ⛔ | Newest app commit; all three still render an additive surface AND the follow-up list |
| Capture-replay tests | ⛔ | ⛔ | ⛔ | The captures are checked in and platform-agnostic; each platform can copy them into its own test resources and replay them through its own reader |

`streaming_required` is deliberately NOT persisted from `verify_otp`'s `preferred_language` on
android, because the app persists it only at its two language-SELECTION sites. Intentional, not a
miss.

## App re-baselined: `c0524dd6` → `0c8c740f` (app v4.1.3, versionCode 108) — 2026-09-03

The reference app was pulled forward 21 commits (`features/dev_v2.3`, merged from `origin/dev/v2.4`),
`31 files changed, 1130 insertions(+), 76 deletions(-)`. HEAD was committed 2026-09-02, i.e. BEFORE
that day's SDK work, so several lanes were already reading the new code without knowing it — which
is why the policy-acceptance gate turned up in the gap audit at all.

Coverage of the delta, item by item:

| App change | commit | SDK status |
|---|---|---|
| `TermsOfUseUpdatedBottomSheet` + `TermsOfUseContentDialog` (+466) | `02f60337`, `0b26291d`, `2b5e4ffa` | ✅ ported both flavours (policy-gate lane) |
| `policy_acceptance_status` endpoint, model, use case, repo, `HomeAction`/`HomeState`/`HomeViewModel`/`HomeScreen` | same | ✅ ported, endpoint verified live (docs/02 #7a) |
| 7 × `fc_v2_app_terms_of_use_*` labels | `78675b96`, `14da13d6` | ✅ in SDK, all 7 verified served by #3 in en/hi/sw |
| 6 × `Terms_Of_Use_*` events + `Terms of Use Content Screen` | `d1530a98` etc. | ✅ (event-parity lane supplied the constants) |
| chat history `isAgentic = getAgenticChatEnabled()` | `dc7b4d1b` | ✅ already implemented |
| `getComposerUiEnabled() = true` | `df190b2d` | ✅ `enableComposerUi` knob added (android/RN/web; ⛔ iOS — no composer exists there) |
| "no follow up in case of chips" — `showFollowUps` on additive chip surfaces | `43ba5de4` | 🟡 assigned to the agentic lane; SDK's views computed `isLast && settled` with no additive term, compose had no gate at all |
| auth agreement info card + privacy-consent text (+147) | `9966b905` | ✅ ported **both android v2 flavours**; 5 new labels added, all verified served by #3. See ["Auth agreement card and privacy consent"](#auth-agreement-card-and-privacy-consent-android-v2-both-flavours-2026-09-03). ⛔ ios / react-native / web. **Copy revised by `2a5cf2b8`/`ae37b28e` and re-ported 2026-09-08 — 2 further labels, NOT probed (docs/05).** See ["Re-baseline to `193dbd64`"](#re-baseline-to-193dbd64-2026-09-08) |
| `Chip.kt` dark-mode fix | `e335413b`, `97832e9a` | ✅ **android v2 both flavours** (compose `components/Chip.kt`, views `AgenticChipView`). Collision confirmed in the SDK's OWN palettes, not just the app's: compose `DarkContentColors` has `surfaceTertiary = Neutral700 = #3F3F46` AND `foregroundTertiary = Neutral700 = #3F3F46` (`theme/Color.kt:153,160`); views `values-night/colors.xml` has `fc_surface_tertiary #3F3F46` AND `fc_foreground_tertiary #3F3F46` (lines 6, 12). Light mode was also failing: `#E4E4E7` on `#D4D4D8` ≈ 1.1:1. Fixes: disabled label → `foregroundSecondary` (dark `#9F9FA9`, light `#52525C`); disabled badge CIRCLE → `foregroundSecondary`; disabled badge NUMERAL → `surfaceTertiary`. Note the badge is a SLOT SWAP, not the app's token substitution: the SDK had circle=`surfaceTertiary` / numeral=`foregroundTertiary` where the app had the reverse, so a mechanical substitution would have left the circle exactly the chip surface. The `!enabled -> foregroundTertiary` branch of `chevronColor` is deliberately left alone — it is unreachable (`showChevron = clickable`, `chevron.isVisible = clickable`). **No chip drawables exist** in the views flavour — `AgenticChipView` builds its backgrounds programmatically via `FcTokens.roundedRect`; the only `tertiary`-referencing drawables are `fc_bg_retry_button.xml` and `fc_radio_dot_unselected.xml`, neither a chip. ⛔ ios/react-native/web: same fix needed wherever each renders a disabled chip — NOT applied (out of lane) |
| `DefaultAppBar` (+4), `OnboardingSharedViewModel` (+25) | — | ✅ **android v2**. `DefaultAppBar` gained `rightEnabled: Boolean = true`, passed to the right `ActionButton`'s existing `enabled` (compose `components/AppBars.kt`); the views flavour has no analogue to port: its shared `fc_view_appbar.xml` right slot is a plain `TextView` (`fcAppBarRightLabel`) with no enabled/disabled treatment, and the knob's only app consumer — the ToU content dialog — is a separate views screen (`fc_fragment_terms_content.xml`) that already blocks a double-accept via its own `PrimaryButtonView.State.LOADING` (`TermsOfUseGateController.kt:260,296`), not via an app-bar action. The `OnboardingSharedViewModel` +25 IS the device/carrier attribute block — see the row below; it was ported additively at the guest-init success site and none of the same-day device-locale/`resolveFallbackCoordinates`/API-analytics work was reverted. ⛔ ios/react-native/web: `rightEnabled` not added (out of lane); only the app's ToU dialog uses it |
| `DeviceTypeProvider` (new), `CarrierInfoProvider` hardening, 7 user-attribute keys (`Carrier_Name`, `Carrier_Code`, `Device_Type`, `Brand`, `Model`, `Manufacturer`, `OS`) | `15b1c33d`, `2d5ee864`, `2fbe0924` | ✅ **android v2** — and it required the new host surface below. Ported: `core/device/DeviceTypeProvider.kt` + `core/device/CarrierInfoProvider.kt` (pure Kotlin + Android framework, no vendor SDK, no new permission — `simOperator`/`simOperatorName` need none), `core/analytics/UserAttributeKeys.kt` (the 7 keys only), `core/analytics/DeviceUserAttributes.kt` raises them through `FarmerChatAnalytics.setUserAttribute` → `config.onUserAttribute`. `ACTUAL_DEVICE = "physical_device"` is verbatim from the app (the constant NAME says "actual"; the VALUE is what lands in a dashboard). Raise sites: onboarding guest-init success (the app's own site) and `FarmerChatGraph.ensureChatOnlySession` (SDK-only path that skips onboarding entirely) — deliberately NOT `ensureLabelsLoaded`, which is shared with the skipped-onboarding flow and would double-raise. Carrier reads run on `Dispatchers.IO` (Binder IPC on the splash path). Tests: `UserAttributeKeysTest` (7 key literals, distinctness, `Device_Type` values, `OS`-key-vs-`OS`-value), `CarrierInfoProviderTest` (absent telephony, throwing `simState`, throwing operator reads, not-ready SIM, blank values → null; happy path trims), `AnalyticsUserSurfaceTest` (both callbacks actually dispatched, blank-guarded, host exceptions swallowed) — 20 tests, all passing. Deviation: a blank value raises NO attribute (the app would send `""`). ⛔ ios/react-native/web: providers + attributes NOT ported (out of lane) |
| Adjust token for ToU (+10) | `9a28929e` | ⛔ by design (§6). Adjust tokens are DG-account-scoped opaque ids and meaningless in a host's Adjust app; docs/07 documents the host-owned `Map<eventName, token>` pattern instead |
| Plotline 5.2.5 bump, `libs.versions.toml` | `bedbca3a` | ⛔ by design (§6) — no vendor SDK enters an SDK package |
| `bg_termsofuse_banner.png` (528 KB), `ic_tou_info.xml` | — | ✅ `fc_ic_tou_info.xml` already present in **both** android v2 flavours (policy-gate lane), byte-identical to the app's. It is **not** used by the agreement card — in the app it is referenced only by `TermsOfUseUpdatedBottomSheet`, so the auth lane vendored no duplicate. **The 528 KB PNG is deliberately NOT vendored** — it would add ~0.5 MB to every host's APK for one banner; recorded as a deviation, host-themable instead |

### Standing risk this exposes

The SDK tracks a **moving** app. This re-baseline was only caught because the user mentioned the
pull; nothing in the repo detects it. `versions/README.md` and `docs/03` now cite `0c8c740f`, but
the honest position is that any SDK claim of "app parity" is parity **as of a named commit**, and
the app is on an active branch. Before the next parity claim, re-run
`git -C <app> log --oneline <cited-commit>..HEAD` and diff the areas it touches.

## Auth agreement card and privacy consent, android v2 both flavours (2026-09-03)

App commit `9966b905` "added agreement info card and privacy policy consent text to auth phone
entry screen". The commit itself touches exactly two app files — `core/labels/Labels.kt` (+5) and
`ui/auth/AuthScreen.kt` (+114). **No `AuthViewModel` change belongs to this lane**: the `+25` that
shows up in a `c0524dd6..HEAD -- '*AuthViewModel.kt'` diff is the carrier / device-attribute work
(`15b1c33d`, `2d5ee864`, `2fbe0924`), which is a different row in the re-baseline table.
`legalLinks` already existed on `AuthUiState` and `fetchLegalLinks()` was already called on both
flavours, so nothing in `farmerchat-core` needed new state.

### What shipped

| Piece | compose | views |
|---|---|---|
| 5 label constants in `farmerchat-core` `Labels.kt` (app's exact names + English fallbacks) | ✅ shared | ✅ shared |
| "What you are agreeing to:" card, between the phone row and the send-code buttons | ✅ `AgreementCard()` / `AgreementBulletPoint()` in `screens/AuthScreen.kt`, called from `PhoneEntryContent` | ✅ `fcAgreementCard` block in `fc_fragment_auth.xml` + `renderAgreementCard()` in `AuthFragment` |
| Three bullet points | ✅ 16 dp bullet column, per the app | ✅ `BulletSpan(16 dp)` — same hanging indent for wrapped lines |
| Consent copy below the buttons, only "Privacy Policy" clickable + underlined | ✅ `AuthConsentText()` → `BasicText` + `LinkAnnotation.Clickable` (the app's own migration off deprecated `ClickableText`) | ✅ `fcAuthConsent` + `SpannableStringBuilder`/`ClickableSpan`/`UnderlineSpan` + `LinkMovementMethod`, the pattern `LanguageFragment.renderLegal()` already uses |
| `privacy_policy_opened` on tap, `SCREEN_NAME = Login Screen`, then navigate only if the URL is non-blank | ✅ | ✅ `fc_dest_legal_content` |

Every user-visible string resolves through `LabelManager` (`label(Labels.X, "<app's English>")`) —
no hardcoded copy. The card's new drawable was **not** needed (see the `ic_tou_info` row above).

### Four deliberate deviations from a literal port

1. **Theme tokens instead of the app's literals.** The app hardcodes `Neutral200` for the card and
   `Color(0xFF000000)` / `Color(0xA3000000)` for the text. The SDK uses
   `colors.surfaceTertiary` / `foregroundPrimary` / `foregroundSecondary`. `Color.kt:19`+`:130`
   make `surfaceTertiary == Neutral200`, so **light mode is pixel-identical to the app**, while a
   themed host and dark mode both keep contrast. A token background with hardcoded black text
   would have reproduced exactly the `Chip.kt` dark-mode defect this same re-baseline fixed.
   **Both pairs were checked for that collision, not assumed:** compose dark is
   `surfaceTertiary = Green950` / `foregroundPrimary = White` (`Color.kt:74-76`), and views
   `values-night/colors.xml` flips *both* halves — `fc_surface_tertiary` `#E4E4E7` → `#3F3F46`
   and `fc_foreground_primary` `#000000` → `#FFFFFF`. No white-on-light-grey card on either.
2. **The compose annotated string is keyed, defensively.** The app's `remember {}` takes no keys.
   In the SDK `label()` resolves at call time against an asynchronously populated `LabelManager`,
   so a keyless `remember` would pin the consent line to its English fallback if it ever composed
   before endpoint #3 landed. In practice auth is only reachable after language onboarding has
   fetched labels (`is_language_labels_loaded`), so this is belt-and-braces rather than a bug fix
   — which is why the **views** flavour was deliberately left resolving once in
   `renderStaticTexts()` at `onViewCreated`, exactly like every other string in that fragment
   (`fcPhoneTitle`, `fcAuthLegal`, …). If a late-label case is ever observed, the fix belongs to
   `AuthFragment.renderStaticTexts()` as a whole, not to this one line.
3. **`onOpenPrivacyPolicy` is not threaded as a new parameter.** The app added one because its
   `PhoneEntryContent` had no legal callback; the SDK's already receives `onOpenLegal`, so the
   lambda is built at the call site (the same shape line 411 already uses).
4. **Transient loading state.** Compose's `PhoneEntryContent` gates the whole phone row + buttons
   block behind `if (state.countries.isEmpty())`; the card and consent line sit in the same branch
   as their neighbours, so during the (brief) country fetch the screen shows only the spinner. The
   app instead swaps just the country selector for a spinner and keeps the card visible. Not
   churned — inverting that gate is a rewrite of the whole composable, not this lane's change. The
   views flavour has no such gate and always shows the card.

### Recorded, deliberately NOT churned: the auth screen now shows two consent blurbs

The app's older `LegalConsentText` ("By Continuing to Verification, you're accepting our Terms of
Use…") is **commented out at its call site** (`AuthScreen.kt:492`) and has been since before
`c0524dd6` — the app renders only the new card + consent line. The SDK ported that legal row as
*active* on both flavours (compose's terms · privacy row, views' `fcAuthLegal`). Removing it would
drop the only Terms-of-Use link on the signup screen, which root CLAUDE.md §3 makes a decision
requiring its own entry — and it is not this lane's call. So v2 auth currently renders the new
consent line **and** the legacy legal row, both linking Privacy Policy. Flagged here for whoever
owns the copy decision; one line deletes it on each flavour.

`docs/01` §3.4 does not yet describe the agreement card. Left unedited (this lane's docs scope is
04) but it is now under-specified.

### Parity (root CLAUDE.md §4)

| Platform | Status |
|---|---|
| android v2 compose | ✅ |
| android v2 views | ✅ |
| android v1 (both flavours) | ⛔ out of scope by design — v1 tracks the 1.0.0 app contract |
| ios v2 (SwiftUI + UIKit) | ⛔ **GAP** — user-visible auth UI, all 5 labels served, needs the card + consent link. Still open after the 2026-09-08 copy revision: whoever closes it should port the **current** two-bullet card + attribution line, not the three-bullet original |
| react-native v2 | ⛔ **GAP** — same |
| web v2 | ⛔ **GAP** — same |

### Verification (actually run, 2026-09-03)

```
cd versions/v2/android
./gradlew :farmerchat-core:assembleDebug :farmerchat-android-compose:assembleDebug \
          :farmerchat-android-views:assembleDebug :sample-compose:assembleDebug \
          :sample-views:assembleDebug :farmerchat-core:testDebugUnitTest
BUILD SUCCESSFUL — 123 core unit tests, 0 failures
```

## Chat-screen fidelity against the app, driven on a device (2026-09-04)

Triggered by a host report that the assistant embedded in **RationSmart**
(`feed-formulation-frontend`) "is not according to the original app". Method: the reference app
(`org.digitalgreen.farmer.chat`, **v4.1.3 / versionCode 108** = the `0c8c740f` baseline) and the
SDK were driven side by side on the same emulator with the same question, and the captures
compared. Screens covered: splash, chat (empty / streaming / settled answer). Not covered this
pass: history, language, settings, error, location.

### Root cause: `isAgentic` was erased at finalize (android core)

The agentic stream finalizes through the shared `handleTextPromptResult` (see the design note
above). That function **rebuilds** the settled `AiResponse`, and `isAgentic` was not among the
fields it carried over — so every streamed answer that ended with a `metadata` event, which is the
normal prose case, reached the UI with the flag cleared.

The UI then took the **legacy** branch of `ChatResponseActions`. Visible result on both android
flavours: the answer footer showed **Share + Save + Listen and no accuracy note**, where the app's
agentic answer shows the **"AI may be wrong / Local conditions may vary" note above Share +
Listen, with no Save** (app `ChatResponseActions.kt:85`).

`handleTextPromptResult` now takes an explicit `isAgentic` parameter, passed `true` from the
`Metadata` branch. Not inferred from `reuseId`, so the intent survives a future refactor.

| Platform | Status |
|---|---|
| android v2 core | ✅ **fixed** — the flag now survives finalize |
| ios v2 | ✅ was already correct (`ChatViewModel.swift:762` passes `isAgentic: true`) |
| react-native v2 | ✅ was already correct (`useChat.ts:529`) |
| web v2 | ✅ was already correct (`useChat.ts:655`) |

Android was the outlier; no §4 gap is opened by this fix.

### Fixed on android v2 — compose

| Item | Was | Now (app spec) |
|---|---|---|
| Answer action pill | outlined white pill, 1dp brand border, **green** 16dp glyphs, `surfaceSecondary` | borderless **filled** `surfaceReadingSecondary` pill, `foregroundPrimary` glyph AND label, 42dp tall, 23dp icon, true `RoundedCornerShape(percent=50)`, 12/16dp padding, 10dp gap (6dp for Listen) — `ActionButton` + `ListenButton(light=true)` |

### Fixed on android v2 — views

| Item | Was | Now (app spec) |
|---|---|---|
| Accuracy note under an answer | **absent from the layout entirely** | `fcAiWarning` row: 18dp `fc_icon_info` tinted `fc_accent`, 13sp/500 `foregroundSecondary` label, above the action row |
| Agentic action row | fixed Share + **Save** + Listen | Share + Listen; Save hidden when `isAgentic && !isPreGenerated` |
| Listen glyph | `fc_ic_play` (play triangle) | `fc_ic_volume_up` — the app's idle glyph is `VolumeUp`; play/pause is the *playing* state |
| Action pill shape/metrics | `fc_bg_suggested` (12dp corners), 14dp padding, 8dp gap, regular weight | `fc_bg_chat_action` pill, 42dp, 12/16dp padding, 10dp gap, 500 weight |
| **User question bubble** | **`green700` fill, white text**, 6dp bottom-end corner, 12dp padding | `surfaceReadingSecondary` fill, `foregroundPrimary` text, **0dp** bottom-end corner, 16dp padding, 290dp max width, 17sp (`bodyMedium`) — `UserChatBubble.kt:74`. `userBubbleColor`/`userBubbleTextColor` still override at runtime; only the DEFAULT changed |
| List bullet | stock `BulletSpan(16)` — 4px radius, reads as `·` | `FcBulletSpan`: 5dp-diameter filled circle, 10dp gap, 10dp top offset (`MarkdownText.kt:180`). Drawn rather than using the 3-arg `BulletSpan`, which is API 28+ against minSdk 26 |
| Markdown block spacing | source blank lines rendered literally → a stray blank line before lists and a dead band after the answer | block parser that drops blank lines and applies the app's fixed spacing (header 24/20, consecutive list items 5, consecutive paragraphs 20, else 12) |

### Still ⛔ on android v2 views — honest gaps

| Gap | Detail |
|---|---|
| Loading tips carousel | ~~While an answer streams the app **replaces the composer** with a pageable "Quick tip" card + page dots. Views just hides the composer, leaving a bare green strip.~~ **✅ FIXED 2026-09-04 on BOTH flavours — and this row was wrong: compose did not have the carousel either.** See "Answer-generation tips carousel" below. |
| `ShimmerText` status | ~~App's stream status is bold with a two-tone shimmer sweep and shows tool statuses. Views renders a plain regular-weight label.~~ **✅ FIXED 2026-09-04 on BOTH flavours.** Also two corrections: the app's label is NOT bold (`labelMedium` in both variants), and views did already render tool statuses — the missing piece was only the sweep. See "LogoSpinner glyph + stream-status shimmer" below. |
| Composer idle aura | App draws an animated gradient border around the idle field (`showAura`). Views' composer is flat. |
| `LogoSpinnerView` glyph | ~~Views draws the flower **black** inside a green arc; the app's is green.~~ **✅ FIXED 2026-09-04** — ring and glyph now share one `FcTokens.accent` colour, as the app shares one `spinnerColor`. |
| Status bar | Views draws a solid dark-green status bar with light icons; the app extends the app-bar gradient behind it with dark icons. |
| Legacy (non-agentic) action row | App: Listen/Share/Save each `weight(1f)` full width, then 16dp, the note at `foregroundTertiary`, 24dp, then a 3dp rounded divider. Views keeps three compact pills and no note. Unreachable for any host with `enableAgenticChat(true)`, so **deliberately not churned** this pass. |
| Markdown `Divider` / `Table` blocks | The views renderer has no block type for either; the app renders both. |

**The 2.0.0 component table further up this file is stale in both directions** — it marks
`InputComposer`, `ShimmerText`, `Chip` and friends `⛔ views` when the views flavour does render
them, just incompletely (composer without aura/shimmer). Read this section, not that table, for
the views UI state. **Update 2026-09-04:** the composer's placeholder *shimmer* now works —
see the `ShimmerTextView` root cause in "LogoSpinner glyph + stream-status shimmer" below.
The aura border remains absent. The live ledger is "Gaps still open on android v2" at the end
of this file.

### Guarded by a test

`SettledAiResponseTest` (5 cases) pins `buildSettledAiResponse` — the builder that constructs the
settled answer for BOTH #27 and the #27a `metadata` finalize. It was extracted out of
`handleTextPromptResult` for exactly this reason: the builder replaces the streaming message
wholesale, so a field it forgets is destroyed silently. **Mutation-checked**: putting
`isAgentic = false` back into the builder fails the suite.

### Two claims deliberately NOT overstated

- **`FcBulletSpan` on API 26–27 is unverified.** It was written as a custom `LeadingMarginSpan`
  precisely *because* the 3-arg `BulletSpan(gap, color, radius)` is API 28+ and the SDK ships
  minSdk 26 — but every run this pass was on **API 36**. `drawLeadingMargin` and the first-line
  guard are stable across versions, so the risk is low, but no API 26/27 image was run.
- **Inter-block markdown spacing is approximate.** The gap is expressed as an `AbsoluteSizeSpan`
  on a bare newline, and a newline's line height is font-metric-driven, so the rendered gap may
  not be exactly the requested dp. It removes the dead bands (which was the visible defect) but
  is not guaranteed dp-exact against the app's `Spacer`.

### Verification (actually run, 2026-09-04, API 36 emulator)

```
versions/v2/android:
  :farmerchat-core:compileDebugKotlin            BUILD SUCCESSFUL
  :farmerchat-android-compose:compileDebugKotlin BUILD SUCCESSFUL
  :farmerchat-android-views:compileDebugKotlin   BUILD SUCCESSFUL
  :farmerchat-core:testDebugUnitTest              148 tests, 0 failures
```

Device-verified in RationSmart against **STAGE**, both flavours, same question in both:
compose (`rs-12-final-compose.png`) and views (`sv-07-views-spacing.png`) against the reference
app's `app-08-final.png`. ios / react-native / web were **not** re-driven this pass — their
`isAgentic` handling was read from source, not run.

## End-to-end app audit against `0c8c740f` — dimension sweep (2026-09-04)

A second pass over the same baseline, this time sweeping **dimensions** rather than screens:
endpoints, navigation destinations and their parameters, permissions, analytics properties, and
the view-model surface. Scope: **android v2 core + both flavours**; ios/rn/web touched only where
the same string was wrong (`api/faqs/`) and otherwise recorded, not half-ported.

### 1. Endpoints — one real defect in 41

`api/faqs` was missing its trailing slash. Both reference apps declare `api/faqs/`
(`fc-compose` `ApiConstants.kt:31`, `fc-compose-agentic` `ApiConstants.kt:32`, and both priority
tables), and **react-native and web already had it** — android and iOS were the two ports that
dropped it, in v1 *and* v2. Per CLAUDE.md §1 the docs were proven wrong against the app source, so
`docs/02` row #24 was corrected first, then all four files.

| Platform | v1 | v2 |
|---|---|---|
| android | ✅ fixed | ✅ fixed |
| ios | ✅ fixed | ✅ fixed |
| react-native | ✅ was already correct | ✅ was already correct |
| web | ✅ was already correct | ✅ was already correct |

The SDK's own `ApiPriority` map already keyed on `api/faqs/`; its normalizer does
`path.trimEnd('/')`, so the priority/timeout lookup was **not** affected — only the request path.

Also recorded in `docs/02`: `GET_ALL_COUNTRY_LIST = "api/user/countries/"` is a **dead constant**
in the app (declared, never referenced) and must not be added anywhere. The live country list is
#5 `api/geography/get_all_countries/`.

### 2. `Destination.Chat` — two of 17 parameters were missing, and the path was misrouted

The app's Chat destination carries 17 parameters, one per entry point. The SDK carried 14.
`plotlinePreGeneratedAnswer` is correctly absent (§6, no Plotline). The other two were a real gap,
and closing them exposed three further defects on the same path — the **agentic Home
content-card tap**:

| # | Defect | Effect before the fix |
|---|---|---|
| 1 | `contentCardTriggerType` had no carrier | `triggered_input_type` went out **null**; the backend could not tell an `image_card`/`text_card` query from a typed one |
| 2 | `click_type` never set | `SendQueryProperties.isImageCard`/`isTextCard` existed (`Analytics.kt:580`) but nothing assigned them — card taps were invisible in analytics |
| 3 | `contentCardImageUrl` had no carrier | the card artwork was dropped; the app shows it as a **display-only** banner on the user bubble |
| 4 | compose gated the branch on `resolvedComposerUi` | the app branches on `getAgenticChatEnabled()`, and the two flags are independent by design — a host with composer-UI but no agentic chat skipped the pre-generated answer it should have fetched, and vice versa |
| 5 | compose passed `homeStatementId` on this path | that routed the tap into `ChatScreen`'s **pre-generated** branch, which had no answer, fell back to a bare `initializeWithQuestion()`, and therefore fired **neither `Send_Query_Initiated` nor `Send_Query`** |
| 6 | views had **no agentic branch at all** | every card tap fetched the pre-generated answer (#26) even with agentic chat on |
| 7 | non-agentic fallback sent a literal `"card"` | the app falls back to `statement_type`, then `"NA"` |

Fixed in `farmerchat-core` (`ChatAction.InitializeWithQuestion` gained `contentCardTriggerType` +
`userMessageImageUri`; the trigger-type chain and the analytics props now read them;
`initializeWithQuestion` renders the banner via `userBubbleImageWideBanner`), and in both
flavours' Home/Chat wiring.

**Device-verified** on `sample-views` (agentic profile, API 36 emulator): tapping an image card
emits `Send_Query_Initiated {… click_type=Image_Card, screen_name=Dashboard Screen …}`, renders
the artwork as a banner above the grey question bubble, and sends the question as a **text**
query — `scratchpad/parity/sv-14-card-chat.png`.

Guarded by `TriggeredInputTypeTest` (7 cases), which pins the precedence
`push > in-app > weather > ssfr > channel > contentCard` — the ordering, not just the values.

### 3. Settings — views was missing two of four sections

| Section | app | compose | views (before) | views (now) |
|---|---|---|---|---|
| Appearance | ✅ | ✅ | ✅ | ✅ |
| **My Farm** (Location row + helper) | ✅ | ✅ | ⛔ **absent** | ✅ added |
| **Your phone** | ✅ | ✅ | ⛔ **absent** | ✅ added |
| Your name / Logout / Sign up | ✅ | ✅ | ✅ | ✅ |

A farmer on the views flavour could neither see the location their advice was based on nor change
it from Settings, and never saw their own number. Both sections were added with the app's value
states (`—` / `Getting your location` / `Place (approximate)` / `Place`), the two-branch helper
caption with its Green700 accent span, the `source == Settings` filter so a Home-initiated
location flow does not animate this row, and the "Location found" toast.

The state flow is collected with `BaseFragment.collectWhenStarted` (`repeatOnLifecycle(STARTED)`),
not a bare `lifecycleScope.launch` — the row touches `binding`, so the collector must not run
while the view is stopped. That also removes the need for a separate resume hook: a permission
granted or revoked in system Settings does not change the flow's value, but a StateFlow replays
its current value to each new collector and `repeatOnLifecycle` re-collects on every STARTED.

**Device-verified, three of four value states** (API 36 emulator):

| State | Verified | Screenshot |
|---|---|---|
| no stored place → `—` + "Estimated. Share your location…" | ✅ | `sv-13-settings.png` |
| permission granted → helper flips to "Advice and weather… Change anytime." | ✅ | `sv-17-loc-after.png` |
| place name, exact | ✅ | `sv-18-loc-named.png` |
| place name, permission revoked → `Bengaluru Urban (approximate)` + "Estimated." | ✅ | `sv-19-loc-approx.png` |
| **`Getting your location` + trailing spinner, and the "Location found" toast** | ⛔ **NOT driven** — needs a live GPS fetch | — |

### 4. Checked and found CORRECT — no change made

Recorded so the next sweep does not re-open them:

- **`api/chat/get_plantix/`** appears only in the app's *priority table*; the app's real endpoint
  constant is `api/chat/image_analysis/`, which is what the SDK uses. The documented quirk.
- **`CarrierInfoProvider`** reads `simOperatorName`/`simOperator`/`simState` — **no runtime
  permission required**, so the absence of `READ_PHONE_STATE` is not a gap.
- **`displayName()`** already sanitizes `"No Name"` and `"null"` in the SDK, identically to the
  app; the app's extra caller-side guards are redundant there too.
- **`fc_icon_name`** is an info-style glyph — byte-identical to the app's `icon_name.xml`. The
  odd-looking name-row icon is app-faithful.
- **SMS Retriever / OTP auto-read** is implemented on both flavours.
- **`UserProfileViewModel`** exists in core (`core/ui/profile/`).

### 4b. A second analytics hole on the same mechanism

Fixing the agentic card path exposed its twin. `addPreGeneratedMessagesToState` has an
SDK-only fallback — "no answer yet → fetch it like a normal question" — that the app does not
have. It called the PRIVATE `initializeWithQuestion(question)` directly, and that helper does not
build `SendQueryProperties`: the action handler does. So the **non-agentic** content-card path,
whenever `#26` returned a blank `short_answer`, sent the query but emitted neither
`Send_Query_Initiated` nor `Send_Query` (the latter is gated on the pending props being non-null).

The fallback now routes through `initializeWithQuestionAction` so the analytics fire. The fallback
itself is kept — the app reaches a dead end here and the SDK's recovery is better behaviour — but
it no longer does so silently.

### 5. Deliberately NOT ported, with reasons

| Item | Reason |
|---|---|
| **SIM phone-number auto-detect** (`SimPhoneNumberProvider`, picker dialog, `READ_PHONE_STATE`/`READ_PHONE_NUMBERS`) | The app's `permissionsLauncher` for these permissions is **declared and never invoked** anywhere in the app, so `canReadPhoneNumber()` is false on any fresh install and the picker is unreachable. Porting it would add two sensitive permissions to every host's merged manifest for a feature the reference app does not actually deliver. The SDK's `AuthViewModel.setCountryCodeFromSim` is correspondingly dead code — faithful to the app. Revisit if a later app version wires the launcher. |
| `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`, `VIBRATE`, `ACCESS_WIFI_STATE` | Push/reminder/campaign infrastructure the SDK excludes by design (§6 — no Firebase/MoEngage/Plotline). Not gaps. |
| `USER_NAME_ADDED` on profile fetch | The app writes it there; the SDK writes it from `EnterNameViewModel` and `SessionManager` only. The SDK **never reads** the key, so nothing observes the difference today. Left alone rather than adding a write with no reader. |
| Settings phone source | The app refreshes it from `view_user_profile`; the SDK shows `PHONE_NUMBER_LOGIN` from OTP verification. Documented adaptation, same value in the normal case. |

### Verification (actually run, 2026-09-04)

```
versions/v2/android:
  :farmerchat-core:compileDebugKotlin             BUILD SUCCESSFUL
  :farmerchat-android-compose:assembleDebug       BUILD SUCCESSFUL
  :farmerchat-android-views:assembleDebug         BUILD SUCCESSFUL
  :farmerchat-core:testDebugUnitTest              155 tests, 0 failures
```

Device: `sample-views` agentic profile on an API 36 emulator — Settings sections and the agentic
content-card path driven end to end. **ios / react-native / web were not built or driven this
pass**; only the `api/faqs/` string was changed there, and it is a one-token edit in a path
constant.

## Telemetry gate + SIM number pre-fill (2026-09-04)

Two requested changes, plus the location states left undriven by the previous pass.

### 1. `enableAnalytics` — telemetry off until a host opts in

New `FarmerChatConfig.enableAnalytics`, **default false**. Events, identity and user attributes are
constructed exactly as before and dropped at the one dispatch point in `FarmerChatAnalytics`;
nothing upstream changes, so turning telemetry on later cannot alter any other behaviour.

The C4 semantic hooks (`onChatOpened`, `onMessageSent`, `onAnswerReceived`, `onScreenView`,
`onError`) are deliberately **not** gated — they are product callbacks, not telemetry, and
silencing them would be a functional regression dressed up as a privacy setting.

| | gate closed (default) | gate open |
|---|---|---|
| `onEvent` / `FarmerChatAnalyticsListener` | ⛔ dropped | ✅ |
| `onUserIdentified` / `onUserAttribute` | ⛔ dropped | ✅ |
| semantic hooks | ✅ **still fire** | ✅ |

⚠️ Behaviour change for hosts already receiving events — one line restores it. Both samples set
`enableAnalytics(true)` so the harness still exercises the event stream.

Guarded by `AnalyticsGateTest` (5 cases), which pins the hooks-survive-the-gate half too.
**Device-verified**: the identical RationSmart chat journey that previously logged
`event=Screen_Viewed` / `App_Opened` / `Send_Query_Initiated` now logs **zero** events, with the
chat fully functional and no crashes.

### 2. SIM number pre-fill — ported, with the app's guard and two divergences

Previously declined (see the 2026-09-04 dimension-sweep section) because the app's own permission
launcher is never invoked. Now implemented:

| Piece | Status |
|---|---|
| `core/device/SimPhoneNumberProvider` | ✅ port of the app's provider, hardened to never throw |
| `core/util/PhoneNumberSplitter` | ✅ dial-code split, longest-prefix-first, **no libphonenumber** — 10 tests |
| `AuthViewModel.applySimNumber` / `shouldAutoDetectFromSim` | ✅ |
| compose Auth: auto-detect, permission request, picker dialog | ✅ |
| views Auth: same | ✅ |
| Permissions in the SDK manifest | ⛔ **deliberately not declared** — host opt-in |

Three things worth carrying forward:

- **The SDK declares neither permission.** A library manifest merges into every host and these are
  sensitive. `isDeclaredByHost()` checks the merged manifest before prompting, so a host that did
  not opt in never sees a dialog. `sample-views`/`sample-compose` opt in; **RationSmart
  deliberately does not** — it runs `CHAT_ONLY` and never reaches the Auth screen.
- **The app's `if (savedIso.isBlank())` guard is load-bearing.** Porting the SIM read without it
  produced a real race on device: the SIM pre-filled country + number, then ~10 ms later the
  deferred GPS `applyIso` called `selectCountry`, which clears `phoneLocal`, and the number
  vanished. Traced with instrumented logging, then fixed by porting the guard.
- **The views flavour had no state→field path for the phone input.** `doAfterTextChanged` pushed
  one way only, so a number set programmatically updated the view model and never appeared on
  screen. Added, guarded on inequality so the watcher cannot loop.

Both divergences from the app (requesting the permission at all; splitting without libphonenumber)
are recorded in `docs/05-open-questions.md` with questions for the app team.

**Device-verified** (API 36 emulator, `sample-views` with the permissions declared):

| Step | Result |
|---|---|
| Permission dialog appears on Auth when the host declared them | ✅ `sv-20-auth.png` |
| SIM read + split + state applied | ✅ instrumented trace: `raw='+15551234567'` → `cc=+1 local=5551234567` → `state.phoneLocal='5551234567'` |
| Guard: country already resolved → SIM skipped, no prompt, no wipe | ✅ `sv-24-guard.png` |
| **Pre-filled number rendered on screen** | ⛔ **not observed** — this emulator always resolves a country from location before Auth opens, which is exactly when the app (and now the SDK) skips the SIM. Verified through the trace above plus the new state→field sync, not on screen. |

### 2b. Two defects the SIM work introduced, found and fixed before shipping

Both were in code added this pass, on the views flavour:

- **The state→field sync ate keystrokes.** Syncing the EditText on raw inequality fought the
  farmer while typing: `setPhoneLocal` truncates to the country's `phone_length`, so a digit past
  the limit made state and field disagree, and the sync then called `setText` +
  `setSelection(end)` — dropping the keystroke and yanking the caret out of a number being
  edited. Now gated on `!hasFocus()`: an unfocused field is never being typed into, which is
  exactly when a programmatic pre-fill lands. **Device-verified**: 14 digits typed into a
  10-digit country render in full with the caret at the end (`sv-25-typing.png`).
- **Rotation re-prompted for permissions.** `simAutoDetectDone` was a plain field, so recreation
  reset it and a device where the guard passes would show a second permission dialog. Now saved
  in `onSaveInstanceState` (compose already used `rememberSaveable`).

### 3. Location row states from the previous pass

Still **not driven**: the `Getting your location` spinner and the "Location found" toast need a
live GPS fetch. The other four states remain verified — see the previous section's table.

### Verification (actually run, 2026-09-04)

```
versions/v2/android:
  :farmerchat-core:assembleDebug                  BUILD SUCCESSFUL
  :farmerchat-android-compose:assembleDebug       BUILD SUCCESSFUL
  :farmerchat-android-views:assembleDebug         BUILD SUCCESSFUL
  :sample-compose:assembleDebug                   BUILD SUCCESSFUL
  :sample-views:assembleDebug                     BUILD SUCCESSFUL
  :farmerchat-core:testDebugUnitTest              170 tests, 0 failures
```

ios / react-native / web are **untouched** by this pass: `enableAnalytics` and the SIM pre-fill
exist on android v2 only, and are recorded here as §4 gaps for the other three platforms.

## CHAT_ONLY navigation: history + language in chat, v1 parity (2026-09-04)

A full FAB-to-exit flow was driven in RationSmart (compose flavour, `CHAT_ONLY`,
`showDrawer(false)`, `showHistory(true)`). It surfaced four defects, all of the same shape: the
compose flavour assumed the drawer exists.

### What was wrong

| # | Defect | Effect |
|---|---|---|
| 1 | Chat app bar had **no** Past Advice / Language icons | With the drawer off these are the only routes to either screen, so **both were unreachable**. The views flavour has had `setUpAppBarActions` for this all along — this is the v1 behaviour that went missing on the compose flavour. |
| 2 | Past Advice app bar showed a hamburger | `openDrawer()` is a no-op with the drawer off → **dead button**, farmer stranded on the list. |
| 3 | A thread opened FROM history showed a hamburger | Same dead button, stranded inside the thread. |
| 4 | Language save navigated to `Destination.Home` | CHAT_ONLY has no Home — it would clear the stack to a screen the host switched off. |

### And one that had nothing to do with CHAT_ONLY

**Saving a language never navigated, in any mode.** `LaunchedEffect(state.languageSubmitSuccess)`
called `vm.consumeLanguageResult()` *first*, which clears `languageSubmitSuccess` — the effect's
own KEY. Changing the key cancelled the coroutine during the following `delay(500L)`, so
`onLanguageSaved()` never ran.

The save itself always worked: instrumented on device, `set_preferred_language` returned success
and the prefs were written. The farmer simply stayed on the language screen with no toast and no
signal that anything had happened. Fixed by consuming **after** navigating.

### Fixes

- `LogoAppBar` gained an `actions` slot for multiple right-hand icons; the chat bar now carries
  Past Advice (`fc_icon_timer`) + Language (`fc_icon_language`), gated exactly as views:
  history on `!showDrawer && showHistory`, language on `!showDrawer`.
- `ChatHistoryScreen`, `LanguageChooserScreen` and the history-entry chat bar swap the hamburger
  for a back arrow when the drawer is off, and pop back instead of calling `openDrawer()`.
- New `navigateHomeOrChat()` in `FarmerChatRoot` — port of the views `NavRoutes.navigateHomeOrChat`
  — routes CHAT_ONLY to chat instead of Home. It delegates to the existing `navigateClearingStack`
  (`popUpTo(0) { inclusive = true }`); a hand-rolled `popUpTo(graph.startDestinationId)` silently
  did nothing.

### Device-verified end to end (API 36 emulator, RationSmart, compose flavour)

| Step | Result |
|---|---|
| FAB → splash → chat | ✅ `run-2-chat.png`, both app-bar icons present |
| Ask a question → agentic answer | ✅ `flow-B2-answer.png` (alignment chips, disclaimer, action pills) |
| GPS capability prompt on a location-dependent question | ✅ `run-3-crop.png` |
| Past Advice → conversation listed under its month | ✅ `flow-B3-crop.png` |
| Open a thread from history | ✅ `run-5-thread-crop.png`, back arrow not hamburger |
| Back from thread → history list | ✅ `run-6-back-to-history-crop.png` |
| Language → change → save → **returns to chat** | ✅ `run-11-lang-done.png` |
| Close (X) → back to the host's MainActivity | ✅ |
| Crashes across the whole flow | ✅ 0 |
| Analytics events emitted (gate off) | ✅ 0 |

### Observed, not fixed

`Past Advice` keeps a "Loading more…" row visible under the last page. It does not block
interaction and the list is usable, but it never resolves when there is only one page of history.
Not investigated this pass.

### Verification

```
versions/v2/android:
  :farmerchat-android-compose:assembleDebug  BUILD SUCCESSFUL
  :farmerchat-android-views:assembleDebug    BUILD SUCCESSFUL
  :farmerchat-core:testDebugUnitTest         170 tests, 0 failures
```

android-views already had all of this (it is where the correct behaviour was read from); ios /
react-native / web are unchanged and carry the same CHAT_ONLY navigation gap — recorded here as a
§4 gap, not fixed this pass.

## Theme Studio re-aligned to the 2.0.0 SDK (2026-09-04)

`theme-studio/` generates the `FarmerChatConfig` snippet a host copies, so anything stale there
ships as someone else's bug. Audited every emitted knob against the real builders.

### The one that actually broke a copy-paste

The Android install line used group **`org.digitalgreen`**. The real coordinate is
**`org.digitalgreen.farmerchat`** (`versions/v2/android/build.gradle.kts`, `farmerChatGroup`), so
the snippet resolved nowhere. Fixed, and pinned by an e2e assertion.

### Versions are per-platform, and the repo is inconsistent

Discovered while fixing the above and worth recording on its own: **the iOS, web and react-native
trees under `versions/v2` were never version-bumped.** Android declares `2.0.0`; the iOS podspec,
web `core/version.ts` and the RN `package.json` all still declare `1.0.0`.

A single global version selector would therefore have printed `npm install …@2.0.0` for web — a
version that does not exist. `SdkMeta` now carries per-platform `versions` and `resolveVersion()`
falls back to the platform's newest, with the badge marked "(latest)" when the two differ.

Whether the non-android v2 trees *should* be 2.0.0 is a release decision, not a studio one — left
alone deliberately.

### Other corrections

| Item | Before | After |
|---|---|---|
| `enableAnalytics` | absent | emitted **explicitly** as `.enableAnalytics(false)` with a comment. Android only — the other trees have no such flag, and emitting it there would be a fabricated API |
| Android requirements | "Compose or Views" | adds **AGP 8.13+** for the Compose flavour (older toolchains mis-dex `InputComposer` → `VerifyError`) |
| Android notes | "Host needs no manifest changes" | false below minSdk 26 — `tools:overrideLibrary` must now name the **compose** package too; plus the SIM-permission opt-in |
| Install snippet | compose only, views as a trailing comment | both artifacts explained, including that adding both is supported and Compose wins |
| Source link | `/tree/main/android` | `/tree/main/versions/v2/android` |

`enableAnalytics` is emitted unconditionally, unlike the theme knobs around it. Those encode
"omitted = inherit", so leaving them out is meaningful; this one defaults to **off and silent**,
so omission is the failure mode — a host would wire everything up, see nothing reach `onEvent`,
and have nothing in their own code to explain why.

### Dark palette — now exposed, and it is four different APIs

The SDK's overridable surface includes an optional dark palette, which the studio could not reach.
It is now a "Dark mode colors" section: ten optional swatches, empty = omit = the SDK inherits the
light value (so an unset colour is never emitted as a duplicate, which would silently freeze dark
mode to the light palette).

The reason this belongs in the studio: **every platform names it differently**, and a designer
should not have to know that.

| Platform | Shape | Verified in |
|---|---|---|
| android | `.brandPrimaryNight(…)` on the same builder | `FarmerChatTheme.kt` (10 `*Night` methods) |
| web | `theme.dark` — a sibling of `theme.colors` | `web/.../core/config.ts:119` |
| react-native | `theme.colors.dark` — nested INSIDE colors | `react-native/.../core/config.ts:82` |
| iOS | flat `darkBrandPrimary:` prefixed properties | `FarmerChatTheme.swift:47` |

`theme.json` follows the web object, since that is what `FarmerChat.initialize(JSON.parse(…))`
consumes. An e2e test sets one dark colour and asserts all four emissions, so the shapes cannot
drift apart silently.

Still not exposed: `logo` (android `@DrawableRes`, web `string | ReactNode`, RN
`FarmerChatLogoSource`) — the three types have no common editor representation, so it needs a
product decision rather than a swatch.

### Generator round-trip — the studio's output now compiles against the SDK

The studio promises its snippet is "verified against SDK source", but nothing enforced it. The
Android output (default preset, captured verbatim from the running app) is now a `studio` profile
in `sample-compose`, so **the sample stops compiling** if a builder method is renamed or dropped —
before a host ever copies the snippet.

Device-verified on an API 36 emulator: `sample-compose` with `profile=studio` launches with the
generated brand green and 12dp button radius on the FAB, and the SDK's own screens pick up the
generated `background` / `brandPrimary` / `brandPrimaryDark`
(`scratchpad/parity/theme-02-sample.png`, `theme-03-journey.png`, `theme-04-screen.png`).

### Verification

```
theme-studio: npm run typecheck   ✅
              npm run build       ✅
              npm run test:e2e    12 passed (3 new)
versions/v2/android:
              :sample-compose:assembleDebug  BUILD SUCCESSFUL (studio profile)
```

Deployed to production and **verified against the live bundle** at
https://theme-studio-hazel.vercel.app — correct Maven group present, old group absent,
`enableAnalytics` / `2.0.0` / the AGP note all served.

## Bundled Geolocation key — android v2 only, deliberately (2026-09-04)

`ApiConstants.DEFAULT_GEO_API_KEY` ships a Google Geolocation key; `FarmerChatGraph` falls back to
it when the host supplies none, mirroring the existing `guestApiKey` fallback. Blank is treated as
absent — a host piping an unset Gradle property straight through (exactly how RationSmart wires
`FC_GEO_API_KEY`) means "no key", not "an empty one".

**Device-verified end to end**: RationSmart, which supplies **no** geo key, cold-started from
`pm clear` and resolved `fc_sdk_farmer_country_code_key = IN` / `user_country_name = India`. The
key itself was confirmed live against `https://www.googleapis.com/geolocation/v1/geolocate`
(HTTP 200). Before this change that call failed immediately on a null key.

### Parity: android v2 only, and that is the point

| Tree | Status |
|---|---|
| android v2 | ✅ default key + fallback |
| android v1 | ⛔ still host-supplied |
| ios / react-native / web (v2) | ⛔ still host-supplied |

Normally §4 would require applying this everywhere. **Not here.** This is a live credential, and
copying it into five source trees multiplies the number of published artifacts it can be extracted
from — which works directly against the reason it was asked for. android v2 is the tree that ships
to the live host; the others keep requiring a host-supplied key until the backend proxy in
`docs/05-open-questions.md` replaces the embedded key altogether, at which point every platform
gets it for free and none of them ship a secret.

⚠️ The repo has no git remote configured today, but `SDK_REPO` points at a public GitHub org. Once
pushed, this key is in history permanently — rotation then means rotating in Google Cloud, not
editing the file.

## Answer-generation tips carousel — android v2, both flavours (2026-09-04)

Continuing the honest-gaps list from the fidelity pass above. The tips carousel was the largest
remaining visible divergence: it occupies the bottom third of the screen for the **entire** answer
wait, which is the state a farmer sees most.

### The recorded gap was understated

The row above read "Views just hides the composer", which implies the compose flavour had the
carousel. It did not. `TipData` existed nowhere under `versions/v2/android`, and compose's loading
branch rendered only `ThinkingIndicator`. Per CLAUDE.md §1 the doc was proven wrong against the
app source, so that row was corrected first and the feature then built on **both** flavours.

The three tip labels (`DID_YOU_KNOW`, `QUICK_TIP`, `TRY_THIS`) had been carried into
`Labels.kt` all along with nothing consuming them — which is why the gap read as smaller than it
was.

### The tip set is server-driven by convention, not a list in the SDK

This is the part worth carrying forward. The app does not enumerate its tips; it regexes the label
payload for pairs

```
fc_v2_app_label_tips_<name>_title_<lang>
fc_v2_app_label_tips_<name>_statement_<lang>
```

so the backend can add, translate or retire a tip with no app release. Ported faithfully into
`farmerchat-core` as `core/labels/AnswerGenerationTips.discover()`, which required two additive
read-only accessors on `LabelManager` (`labelMap()`, `languageCode()`) because the keys are not
known ahead of time and so cannot go through `getLabel`. Discovery scans title keys in **any**
language and then resolves each name in the farmer's language with an English fallback, so a tip
that exists only in Hindi is still discovered for an English user.

Kept in core, not in a flavour, so both UIs show the same set — and so the discovery is
unit-testable without a device.

| Piece | Status |
|---|---|
| `core/labels/AnswerGenerationTips` + `TipData` | ✅ discovery, ordering, 3 built-in fallbacks |
| `LabelManager.labelMap()` / `.languageCode()` | ✅ additive, read-only |
| `Labels.TIPS_ASK_SPECIFIC_CROPS` | ✅ added — see the name-collision note below |
| compose `components/Tips.kt` (`Tips`, `Tip`, `TipPaginationIndicator`) | ✅ port |
| compose `components/AttentionWobble.kt` | ✅ port, gates dropped (below) |
| views `widgets/TipsCarouselView` (card + drawn indicator) | ✅ port |
| views `drawable/fc_ic_lightbulb.xml` | ✅ Material outlined lightbulb, the glyph compose renders |
| Wired into compose `ChatScreen` (initial-loading AND thread) | ✅ |
| Wired into views `ChatFragment.updateTips` + `fc_fragment_chat.xml` | ✅ |
| ios / react-native / web | ⛔ **NOT IMPLEMENTED** — §4 gap, see below |

### A label name-collision that would have shipped the wrong string

The app declares **both** `fc_v2_app_label_ask_specific_crops` and
`fc_v2_app_label_tips_ask_specific_crops`. Only the second is used (inline in the app's
`fallbackTips`); the first is declared and never referenced — and the SDK's `Labels.kt` already
had the unused one as `ASK_SPECIFIC_CROPS`. Adding the real key under the obvious name would have
collided, and picking the existing constant would have resolved the wrong label. The new constant
is therefore `TIPS_ASK_SPECIFIC_CROPS`, with the trap documented at both declarations.

Confirmed against the live DEV label payload, which sends
`fc_v2_app_label_ask_specific_crops_en = "Try asking about specific crops or problems,"`.

### Deliberate divergences, all recorded rather than silent

| Divergence | Why |
|---|---|
| **`attentionWobble` gates dropped.** The app gates the bulb's jiggle on a Firebase Remote Config kill-switch AND `CardAnimationManager`'s once-per-calendar-day budget. | §6 excludes Firebase; the app's own RC default for the switch is `true`. The day-budget is prefs-only and portable, but the app spends it on its **home cards** — the SDK has exactly one wobble call site, so porting the budget would mean the bulb animates once on a farmer's first day and never again. Machinery whose only observable effect is to hide itself. |
| **views uses `RecyclerView` + `PagerSnapHelper`, not `ViewPager2`.** | ViewPager2 is not a dependency of `farmerchat-android-views`; adding one lands in every host's graph for a decoration. RecyclerView is already there for the chat list. |
| **views draws the indicator in `onDraw`** instead of assembling dot views. | The active dot's fill tracks the countdown and repaints every frame; one drawing view beats re-laying-out a dot row at 60fps. |
| **A blank label counts as missing** in discovery (the app checks null only). | Matches `LabelManager`'s own `isNullOrBlank` resolution. A blank server label would otherwise render an empty tip card. |
| **`Tips` renders nothing on an empty list** where the app has `require(tips.isNotEmpty())`. | `discover` never returns empty, so an empty list means a caller mistake. Taking the chat screen down over a decoration is not a trade the SDK gets to make for a host. |

### Guarded by a test

`AnswerGenerationTipsTest` (10 cases) pins discovery: language preference and English fallback,
dropping a half-translated tip, blank-as-missing, name ordering, ignoring tips-prefixed labels that
are **not** tips (`fc_v2_app_label_tips_list_cannot_be_empty` is the real trap), the three
built-ins, and that the built-ins still resolve through the label manager so a host override wins.

The ordering and the "not a tip" cases matter most: if the regex stops matching, the failure is
three hardcoded English tips shown to every farmer in every language, which looks like working
software.

### Verification (actually run, 2026-09-04, API 36 emulator `rs_qa`)

```
versions/v2/android:
  :farmerchat-core:assembleDebug             BUILD SUCCESSFUL
  :farmerchat-android-compose:assembleDebug  BUILD SUCCESSFUL
  :farmerchat-android-views:assembleDebug    BUILD SUCCESSFUL
  :sample-compose:assembleDebug              BUILD SUCCESSFUL
  :sample-views:assembleDebug                BUILD SUCCESSFUL
  :farmerchat-core:testDebugUnitTest         180 tests, 0 failures  (was 170)
```

**Device-driven end to end on the agentic streaming path**, both flavours, same question
("How do I control armyworm in maize"), against DEV:

| Step | compose | views |
|---|---|---|
| Carousel appears for the pre-text thinking/tool phase | ✅ `tips/e13-stream-2.png` | ✅ `tips/v06-stream-2.png` |
| Server-discovered tip content (not the built-ins) | ✅ "Quick tip / AI may be wrong. Please double-check." | ✅ same |
| Auto-advance at 8s, indicator countdown fill tracks it | ✅ `e13-stream-6.png` (2nd tip, 2nd dot) | ✅ |
| Neighbour pages peek at 0.6 alpha | ✅ | ✅ |
| Hidden the moment the answer produces text | ✅ `e13-stream-10.png` | ✅ `v06-stream-6.png` (capability surface) |
| Agentic footer still correct (note + Share + Listen, no Save) | ✅ | ✅ |
| Crashes | 0 | 0 |
| Analytics events (gate open on samples) | fired | fired |

Screenshots under `scratchpad/tips/`.

Re-driven on compose after a late change to the `remember` key in `answerGenerationTips` (see
below) so the device claim matches the shipped binary: `tips/e21-reverify-2.png`, a second
question whose carousel opened on a different tip — which also demonstrates the per-binding
shuffle.

The compose `answerGenerationTips()` memo is keyed on `labels.size`, **not** on the label map.
The composable is in the tree for the whole streaming wait, so `remember(map)` would run full
`Map` equality over ~1000 entries on every recomposition the stream causes. Endpoint #3 replaces
the payload wholesale, so a size change is the signal that matters.

### Harness gap fixed on the way

**`sample-compose` had no `agentic` profile** — only `sample-views` did. The compose flavour could
therefore not exercise agentic streaming, the composer UI, or anything else behind
`enableAgenticChat` at all, which is the flagship 2.0.0 feature and the primary flavour. Added,
mirroring `sample-views`. This is why the first verification run of this pass exercised the
synchronous path by mistake.

### Parity: §4 gap on the other three platforms

| Tree | Status |
|---|---|
| android v2 (core + compose + views) | ✅ implemented |
| android v1 | ⛔ not applicable — the tips carousel is a 2.0.0 surface |
| ios v2 | ⛔ **NOT IMPLEMENTED** |
| react-native v2 | ⛔ **NOT IMPLEMENTED** |
| web v2 | ⛔ **NOT IMPLEMENTED** |

Not ported this pass, and recorded rather than half-done (§6: no stubs). The discovery logic is
the reusable part and is ~60 lines with the regex and the fallback table; each platform then needs
its own pager. Whoever picks this up should port
`core/labels/AnswerGenerationTips.kt` plus `AnswerGenerationTipsTest` first — the label-key
convention and the `TIPS_ASK_SPECIFIC_CROPS` collision are the parts that are easy to get subtly
wrong, and the tests catch both.

### Observed, not fixed

- **The views Home screen renders "What are farmers asking today?" twice** — once as the app-bar
  headline and once as a feed section header (`tips/v04-home.png`). Compose shows it once. Not
  touched this pass; it is a Home-screen defect, unrelated to the carousel.
- The gaps from the previous pass that remain open: views `ShimmerText` stream status (plain
  label, no shimmer, no tool statuses), views composer idle aura, `LogoSpinnerView` glyph colour,
  views status-bar treatment, views markdown `Divider`/`Table` blocks, and the Past Advice
  "Loading more…" row that never resolves on a single page of history.

## LogoSpinner glyph + stream-status shimmer (2026-09-04)

Two more items off the honest-gaps list, and one of them had a root cause that disabled a
component everywhere it was used.

### 1. views: the flower rendered black inside a green arc

The app's `LogoSpinner` takes a **single** `spinnerColor` (default Green500) and applies it to the
`CircularProgressIndicator` **and** to the logo via `ColorFilter.tint`
(`LogoSpinner.kt:186`, `LogoSpinnerHorizontal.kt:198`). The views port tinted the ring
`fc_green500` but the glyph `fc_foreground_primary` — black.

Both now resolve through `FcTokens.accent(context)`, held in one `spinnerColor` field so they
cannot drift again. Side effect worth having: the ring was previously pinned to the built-in green
via a static resource, so it ignored a host `brandAccent`; it now follows host theming like every
other programmatic widget.

Before / after on the same screen: `tips/v06-stream-2.png` (black) → `tips/v11-spinner-2.png`
(green).

### 2. The stream-status shimmer — and why it never worked ANYWHERE

The recorded gap said the app's stream status is "bold with a two-tone shimmer sweep". **The bold
half is wrong** — the app uses `MaterialTheme.typography.labelMedium` for this label in both
variants. The shimmer half is right, and the SDK was missing it on **both** flavours, not just
views (the same understatement as the tips row).

The app splits what the SDK merged:

| App component | Label treatment | SDK equivalent |
|---|---|---|
| `LogoSpinner.kt` (full-screen loader) | plain `Text`, `labelMedium` | `LogoSpinnerType.Vertical` |
| `LogoSpinnerHorizontal.kt:219` (in-thread stream status) | **`ShimmerText`**, `labelMedium` | `LogoSpinnerType.Horizontal` |

The SDK folded both into one `type` flag with a single plain-`Text` label helper, losing the sweep.
Fixed on both flavours, shimmering **only** in the horizontal variant:

- compose: `SpinnerLabelText` gained a `shimmer` flag, `true` only from the `Horizontal` branch.
- views: `LogoSpinnerView`'s label is now a `ShimmerTextView` with `shimmerEnabled = horizontal`
  and `durationMs = 1200` — the app's and Compose `ShimmerText`'s default. `ShimmerTextView`'s own
  default of 2250ms is the **composer placeholder's** slower period and was the wrong one here.

#### The root cause: `ShimmerTextView` had never animated, anywhere

Verifying the views fix on device showed the label still static. `canShimmer()` requires a
measured `width > 0`, but **every** entry point that called `startSweep()` —
`onAttachedToWindow`, `onVisibilityAggregated`, the `shimmerEnabled` setter, `setShimmerText` —
runs before first layout, when width is still 0. Each one bailed out. `onSizeChanged`, the one
callback that fires *after* the width is known, called `rebuildShader()` and **never started the
animator**. Net effect: the view painted its flat base colour and never swept.

`onSizeChanged` now starts the sweep. This is why the 2.0.0 component table's "composer without
shimmer" note existed too — **one root cause behind two separately recorded gaps**, and the
composer placeholder gets its sweep back for free.

#### Measured, not eyeballed

A shimmer cannot be proven from one screenshot. Six frames 0.45s apart, diffing the label region
(mean absolute pixel difference):

```
views, BEFORE the onSizeChanged fix:  consecutive pairs 0.00, 0.00   -> static
views, AFTER:                         8.42, 8.17, 8.53, 47.11, 9.40 -> 5/5 pairs differ
compose (thread branch), AFTER:       53.29, 1.69, 3.39             -> animating
```

The ~8 is the sweep; the ~47/53 spikes are the label text changing to a tool status.

### Found while verifying, NOT fixed

**compose's initial-loading branch uses `ThinkingIndicator`, the app uses
`LogoSpinnerHorizontal`.** `ThinkingIndicator` is `LogoSpinner(Horizontal)` + a plain `Text` +
`ThreeDotPulse`; the app's `ChatLoadingContent.kt:91` uses `LogoSpinnerHorizontal`, whose label
shimmers and which has no pulsing dots. So on the very first question the SDK shows plain text and
three dots where the app shows a shimmering label — measurable above as the two `0.00` pairs
before the thread branch takes over.

Not fixed: `ThinkingIndicator` is used from two places and is an established SDK component, so
replacing it is a wider change than this pass. Recorded here as an open gap.

### Parity

| Tree | LogoSpinner glyph colour | Horizontal-label shimmer |
|---|---|---|
| android v2 compose | ✅ was already correct (`ColorFilter.tint(spinnerColor)`) | ✅ fixed |
| android v2 views | ✅ fixed | ✅ fixed (+ the `ShimmerTextView` root cause) |
| ios / react-native / web v2 | ⛔ UNVERIFIED — not inspected this pass | ⛔ UNVERIFIED |

The other three platforms were not read for either item, so they are recorded as UNVERIFIED rather
than as either correct or broken.

### Verification (actually run, 2026-09-04, API 36 emulator `rs_qa`)

```
versions/v2/android:
  :farmerchat-core:assembleDebug             BUILD SUCCESSFUL
  :farmerchat-android-compose:assembleDebug  BUILD SUCCESSFUL
  :farmerchat-android-views:assembleDebug    BUILD SUCCESSFUL
  :sample-compose:assembleDebug              BUILD SUCCESSFUL
  :sample-views:assembleDebug                BUILD SUCCESSFUL
  :farmerchat-core:testDebugUnitTest         180 tests, 0 failures
```

Device: both flavours driven on the agentic profile, 0 FATALs. No new unit tests — both changes are
view-layer wiring with no branch worth pinning; the shimmer is verified by the frame diff above.

## Gaps still open on android v2 views/compose after 2026-09-04

The running ledger, so the next pass does not have to reconstruct it:

| Gap | Where | Notes |
|---|---|---|
| Composer idle **aura** (animated gradient border on the idle field) | views | The placeholder *shimmer* half of this is now fixed by the `ShimmerTextView` root cause; the aura border is still absent |
| Status bar treatment | views | Views paints a solid dark-green bar with light icons; the app extends the app-bar gradient behind it with dark icons |
| Markdown `Divider` / `Table` blocks | views | No block type for either; the app renders both |
| `ThinkingIndicator` vs `LogoSpinnerHorizontal` on first load | compose + views | Found this pass — see above |
| Past Advice "Loading more…" row never resolves on a single page | compose | Observed 2026-09-04, not investigated |
| Duplicate "What are farmers asking today?" header | views Home | Observed this pass (`tips/v04-home.png`); compose shows it once |
| Legacy (non-agentic) action row treatment | views | Deliberately not churned — unreachable for any host with `enableAgenticChat(true)` |
| Tips carousel, `enableAnalytics`, SIM pre-fill, CHAT_ONLY nav, bundled geo key | ios / rn / web | §4 gaps from this and prior passes |
| `typeScale` barely affects the phone preview | theme-studio | The shadcn-composed screens use rem-based Tailwind text classes, which follow the document root rather than `.phone`. Pre-existing |
| Agentic preview not deployed | theme-studio | The live bundle still serves the legacy preview |

## Theme Studio preview rebuilt on the agentic (2.0.0) UI (2026-09-04)

The studio previewed the **legacy** UI while generating a 2.0.0 config: Home and Chat showed the
Photo/Speak/Type tile row, a green/white user bubble and a Listen/Share/**Save** action row with no
accuracy note. A designer picking colours was therefore theming surfaces the shipped SDK no longer
renders, and the two surfaces that dominate the agentic screen — the tip card and the alignment
chips — could not be seen at all.

### Replaced, not toggled

No "agentic / legacy" switch. The studio already emits `enableAnalytics`, the 2.0.0 Maven
coordinate and per-platform versions; it is a 2.0.0 tool, and a toggle would imply the legacy row
is still a supported choice for a new host while doubling the preview to maintain.

**Scope: Home and Chat only.** Nothing in Language, Name, OTP or Settings branches on
`enableAgenticChat` — read from source, not driven side by side in both profiles — so they were
deliberately left alone rather than churned.

### What the preview now shows

| Surface | Before | Now |
|---|---|---|
| Home input | Photo/Speak/Type tile row (2 copies: a sticky header row AND a bottom row) | the unified **InputComposer** — camera / "Ask about your farm…" / mic, swapping to send once there is a draft |
| Home header | "Tap a button to ask a question" | logo, "What are farmers asking today?", **Set your location** pill |
| Home feed | generic cards with "Start chat" | content cards with the **view-count badge** and **Ask Now**, as the app renders them |
| Chat input | a "Type" button that opened an input | the composer, always on screen |
| User bubble | `--secondary` ground | **`surfaceReadingSecondary`** (`#ECECEE` / `#27272A`) with primary ink — the real 2.0.0 default |
| Answer wait | none (the answer appeared instantly) | **shimmering stream status** + branded spinner, and the **tip carousel** with its countdown indicator |
| Answer footer | Listen + Share + **Save**, then a divider | the **accuracy note** above **Share + Listen**, no Save |
| Alignment surface | absent | numbered chips on `surfaceActive`, with the prompt above them |

The tip copy is the SDK's three built-in fallbacks verbatim, with a comment noting they are
normally **discovered** from the label payload.

### Two bridge tokens added, and two inline copies removed

The preview re-themes through `shadcnVars()`. The agentic surfaces are dominated by two SDK
`ContentColors` that had no var in that bridge, and the file was already faking one of them inline
in two places:

- `--fc-surface-active` — accent @ 16%, the tip card and chip grounds. Replaces the inline
  `color-mix(in srgb, var(--fc-accent) 16%, var(--card))` at the selected language row and the
  card thumbnail, so there is now one definition instead of N copies to drift.
- `--fc-reading-2` — `surfaceReadingSecondary`, the user bubble and action-pill ground.

Plus `--fc-reading`, `--fc-fg-2` and `--fc-shimmer-base` for the carousel fade, the accuracy note
and the sweep's base colour. Verified in both appearances against `LightContentColors` /
`DarkContentColors`.

### A CSS bug worth remembering: background-clip:text + no-repeat eats glyphs

The first shimmer implementation used `background-repeat: no-repeat` with a travelling
`background-position`. With `background-clip: text` and `color: transparent`, any glyph the
gradient band does not cover is painted with **nothing** and renders fully invisible — letters
disappeared as the band moved, which read like clipped text.

Measuring the container ruled clipping out (`scrollWidth === clientWidth === 300`,
`scrollLeft === 0`), which is what pointed at transparency instead. Fixed with `repeat-x`: both end
stops are the base colour, so tiling is seamless and every glyph always has paint. That is the CSS
equivalent of the Android shader's `Shader.TileMode.CLAMP`.

Separately, a long tool status ("Checking elevation for your location") is wider than the 300px
phone and sized the flex column to itself, pushing every `ml-auto` user bubble past the bezel —
fixed with `min-w-0` on the row and `flex-1 min-w-0` on the label so it wraps.

### The e2e suite caught the change, as it should have

Two existing tests asserted the legacy UI (a `Type` button, the placeholder "Type your question…")
and failed immediately. Updated, and four tests added: the composer replacing the tile row, the
footer having no Save, the alignment chips, and the tips carousel appearing for the wait and going
away afterwards.

One of the new assertions was wrong in a way worth recording: `getByRole("button", { name: "Save" })`
matches a **substring** of the accessible name by default, and the alignment chip
"Yes, save maize" contains "save" — so the no-Save assertion failed against correct markup.
`exact: true` is load-bearing there.

The composer's camera and mic also needed labels that do not collide with the legacy tile names,
or the "no Photo/Speak/Type" assertion would pass vacuously. They use the SDK's **real** content
descriptions — `"Camera"` and `"Voice"` (`InputComposer.kt:512` / `:715`), with `"Send"` once
there is a draft — rather than names invented to satisfy the test, so the preview's accessible
names now match the shipped SDK instead of drifting from it.

### Verification (actually run, 2026-09-04)

```
theme-studio: npm run typecheck   ✅
              npm run build       ✅
              npm run test:e2e    16 passed (was 12; 2 rewritten, 4 new)
```

Driven in a real browser at `localhost:4700` and compared against the same day's device captures:
Home against `tips/e10-home.png`, the wait against `tips/e13-stream-2.png`, the settled answer
against `tips/e13-stream-10.png`. Both appearances checked.

**Not deployed.** The live studio at https://theme-studio-hazel.vercel.app still serves the legacy
preview until someone deploys this.

### Known simplifications, deliberate

- The carousel shows one card; the SDK's pager peeks its neighbours at 0.6 alpha. At 300px the
  peek is noise, and the studio's own header says "Approximate shared design".
- `typeScale` still does not reach the shadcn-composed screens (they use rem-based Tailwind text
  classes, which follow the document root, not `.phone`). Pre-existing, not introduced here, and
  not newly wired — but it means the type-scale knob has little visible effect on the preview.
  Recorded as an open studio gap.

## Nine-item punch list from device testing (2026-09-04)

Reported after driving the agentic build on a device. All nine worked, on android v2. The two
biggest — the settings round trip and the legal screen — were **real defects with system-level
causes**, not styling.

### 1. Terms of Use / Privacy Policy UI — the dialog was not edge-to-edge

Both open `Destination.LegalContent`, and the SDK registers it as a `dialog<>` with
`usePlatformDefaultWidth = false` — which **matches the app exactly** (`AppNavGraph.kt:886`), so
the presentation was never the problem.

The problem: a Compose `Dialog` gets its **own window**, and that window does not inherit the
activity's `enableEdgeToEdge()`. With `decorFitsSystemWindows` at its default the window is inset
below the status bar and above the nav bar, so `DefaultAppBar`'s own
`WindowInsets.statusBars` read returned **zero**. Result: a dark band above the app bar and a grey
strip below the content, on the only screen in the SDK that showed them.

Fixed with `decorFitsSystemWindows = false` on the dialog plus
`windowInsetsPadding(WindowInsets.navigationBars)` on the screen's root, so the app bar's green
extends behind the status bar like every other screen and the WebView's last line clears the nav
bar. Before / after: `punch/23-terms.png` → `punch/24-terms-fixed.png`.

### 2. Listen — the sound wave was missing

The app's `ListenButton` has four states, and once audio exists it **replaces the "Listen" label
with 14 animated bars**, swapping the glyph to Pause (playing) or Play (paused)
(`components/buttons/ListenButton.kt:161`). The SDK had no `ListenButton` at all — Listen was a
generic `ChatActionChip` showing a static label in every state, so a farmer got no feedback that
audio was playing beyond the glyph.

Ported as `compose/components/ListenButton.kt` with `SoundWaveAnimation`: the app's Figma bar
silhouette, each bar animating toward a target biased by its own base height so the wave keeps its
shape instead of degenerating into noise; bars are `buttonPrimaryAccent` on the light pill so they
pop against the grey. Wired into both the agentic and legacy action rows, and the call site now
passes `hasAudioUrl` (`state.audioPlaybackUrl != null`) — the input the Paused state needs and
which the SDK was not plumbing at all.

**Device-verified**: `punch/29-listen.png` shows Pause + the green wave; a 5-frame diff of the
pill region 0.4s apart gives 4/4 pairs differing (2.3–2.8 mean abs diff) — animating, not a static
graphic.

### 3. Microphone → Settings → back landed on splash/Home ⚠️ the real bug

**Root cause, from the system's own log.** Toggling a runtime permission in system Settings makes
Android kill the app. In the faithful flow the activity is recreated, but the Compose nav graph
restarts at `startDestination = Splash`, so `navigateFromSplash()` → `routeFromSplash()` re-decided
from prefs — and prefs know nothing about the thread the farmer was reading. They landed on Home
with the conversation gone.

(A harsher repro — killing the process while foregrounded — produces
`ActivityTaskManager: Force removing ActivityRecord{…FarmerChatActivity}: app died, no saved
state`, dropping the farmer to the host's own activity. The real flow stops the activity first, so
saved state exists and the activity IS restored; the routing is what threw the position away.)

Fixed **without touching the frozen decision tree** (§3 / docs/01 §2):

- new `SdkPreferences.Keys.RESUME_SCREEN`, written by the existing
  `addOnDestinationChangedListener` for post-onboarding screens only — splash/language/name must
  always re-run their own decision;
- `FarmerChatActivity` passes `isRecreated = savedInstanceState != null`;
- `navigateFromSplash()` returns early to `resumeDestination()` when recreated **and no pending
  target exists** — an explicit `openChat`/`openScreen` deep link still wins. Chat resumes only
  when `NEW_CONVERSATION_ID` can reopen the thread; a thread with no id falls through to the
  normal decision rather than opening an empty chat.

`routeFromSplash()` itself is unchanged and still governs every genuine cold start.

**Device-verified** end to end: in chat with a settled answer → app's system settings page →
mic permission toggled (process killed, pid changes) → Back. Before: Home, thread gone
(`punch/05-returned.png`). After: back in the chat thread (`punch/11-after-settings.png`).

### 4. Streaming → chips now stay in one flow

An **exclusive** alignment surface `return@item`ed *before* the `streamReserve` Column, so the
screen-height reserve that pins the question at the top vanished the instant the surface arrived
and the whole thread collapsed upward — the streamed text and the chips that follow read as two
separate jumps.

The surface now renders inside the same reserve, and the reserve is also held while the latest
answer still carries an unanswered alignment surface. Verified: `punch/27-answer.png` (clarify
surface pinned at the top, no collapse).

### 5. Fonts — views had no per-script line heights

Compose was fine: it ports all six of the app's `Typography` sets and resolves them with
`typographyForLanguage()`, and `resolveTypography` returns the base untouched when a host sets no
`typeScale`. So compose type **is** the app's.

**views was the gap.** The app's six typographies share font sizes but differ in **line height** —
Kannada `titleLarge` is 32sp where Roman is 28 — and the views layouts set `textSize` in ~110
places and line spacing in **none**, so every Indic script rendered with the platform default:
cramped, clipping tall glyph stacks.

Ported as `views/internal/theme/FcTypography.kt`: the app's six size→line-height tables plus its
exact script groups (`mr`/`ne`/`bho` are Devanagari and must not fall through to Roman). Views has
no `Typography` object to swap, so the mapping is keyed on the one thing an inflated `TextView`
reliably knows — its own text size, which maps to exactly one line height per script. Applied
centrally in `FcThemeInflaterFactory`, which every fragment layout and RecyclerView item view
already inflates through, so no per-layout edits.

**That factory was only installed when a host configured a theme** — it returned early otherwise —
so it now installs for every host with a nullable palette (recolor nothing, still apply line
heights). Off-scale sizes (12/14/20sp exist in the layouts) are left at the platform default
rather than guessed at.

### 6. Gradient on the chat composer's placeholder field — REQUESTED DIVERGENCE

The aura exists in the SDK's `InputComposer` and Home passes `showAura = true`; **chat passed
`false`, matching the app**, whose own KDoc says the aura is "Home-only … the chat screen passes
false to keep the composer calm amid live content".

Turned on for chat **by request**. Still idle-only — the draw is gated on `showAura && !isFocused`,
so it stops the moment a farmer taps in. **Device-verified**: a 5-frame diff of the chat composer
field 0.5s apart gives 4/4 pairs differing (1.9–4.6) — drawing. Recorded in `docs/05`.

### 7. Chip text bold — REQUESTED DIVERGENCE, plus a parity fix found alongside

Chip labels are now `FontWeight.Bold` in every state. The app bolds only the **selected** chip
(`if (selected) FontWeight.Bold else null`) and leaves the rest at `labelMedium`'s 600. Requested,
recorded in `docs/05`.

Found while there — a genuine parity defect: the numbered badge was `labelSmall` + `SemiBold`
where the app uses `labelMedium` (`Chip.kt:197`), so the number rendered smaller and lighter than
the app's. Fixed. Both visible in `punch/27-answer.png` / `punch/28-answer2.png`.

### 8. Input overlapped by an attached image

`composerBarHeight()` sums `topInside + buttonRow + atRestGap + restingBottom` and **did not count
the attached-photo strip**. Callers reserve that height as the list's bottom content padding, so
with a photo attached the composer grew 74dp taller (a 64dp `PhotoThumbnail` plus its 10dp gap)
over content that had made no room for it.

`composerBarHeight` now takes `hasAttachment`; Chat and Home pass `photoUris.isNotEmpty()`.

### 9. Home screen colour

The app paints the Home base with `contentColor.surfacePrimary` — the grey reading surface — with
**no conditional**, and says so explicitly: *"Non-agentic looks identical — the list still sits on
this same grey base."* The green lives only in the gradient band.

The SDK had `if (isComposerUi) colors.surfacePrimary else brand.surfacePrimary`, so **non-agentic
Home was brand green** — wrong ground colour for any host that had not opted into agentic chat.
The agentic gradient block itself already matched the app line for line. Now unconditional, as the
app is.

### Verification (actually run, 2026-09-04, API 36 emulator `rs_qa`)

```
versions/v2/android:
  :farmerchat-core:assembleDebug             BUILD SUCCESSFUL
  :farmerchat-android-compose:assembleDebug  BUILD SUCCESSFUL
  :farmerchat-android-views:assembleDebug    BUILD SUCCESSFUL
  :sample-compose:assembleDebug              BUILD SUCCESSFUL
  :sample-views:assembleDebug                BUILD SUCCESSFUL
  :farmerchat-core:testDebugUnitTest         180 tests, 0 failures
```

Driven end to end on the agentic profile, 0 FATALs. Animated behaviour (the listen wave, the
composer aura) verified by frame-diffing the region rather than by eyeballing a screenshot — a
static capture cannot distinguish a drawn-once graphic from a running animation.

### Parity and honest gaps from this pass

| Item | android v2 | ios / rn / web |
|---|---|---|
| Legal dialog insets | ✅ compose | ⛔ UNVERIFIED — not inspected |
| Listen sound wave | ✅ compose | ⛔ NOT IMPLEMENTED |
| Resume after process death | ✅ compose | ⛔ NOT IMPLEMENTED (views also still affected) |
| Stream→chip reserve | ✅ compose | ⛔ UNVERIFIED |
| Per-script line heights | ✅ compose (already) + views (new) | ⛔ UNVERIFIED |
| Chat composer aura | ✅ compose | ⛔ views has no aura at all (pre-existing gap) |
| Chip bold + badge parity | ✅ compose | ⛔ views chip weight UNVERIFIED |
| Attachment reserve | ✅ compose | ⛔ UNVERIFIED |
| Home base colour | ✅ compose | ⛔ UNVERIFIED |

**Not fixed this pass, and worth naming:** items 2, 3, 4, 8 and 9 were fixed on the **compose**
flavour only. The views flavour got items 5 (line heights) and the shared core change for 3's pref
key, but its own Listen row, chip weights, attachment reserve and Home base were not re-driven —
the reporter was testing compose. No unit tests were added for the view-layer changes; item 3 is
the one that deserves one and does not have it, because the behaviour it fixes lives in the
activity/nav layer rather than in a testable core function.

### Follow-up verification on the punch list (2026-09-04, same day)

Two items were re-driven on the emulator after review, because the first pass had verified
them from the wrong starting screen / had not measured the cost at all.

**Item 3 (resume after process death) — verified from the Home origin, not just Chat.**

The first pass only proved the Chat origin. The mic rationale is an in-place Compose dialog
inside `HomeScreen`/`ChatScreen` (both call `openAppSettings` from `components/Dialogs.kt`),
never a nav destination, so `RESUME_SCREEN` can only ever hold `home` or `chat` for this flow —
the SDK's own Settings screen is not on this path and cannot be recorded by mistake.

Round trip driven on `rs_qa` (API 36): Home (`fc_sdk_resume_screen=home`) → app-details Settings
via the exact `ACTION_APPLICATION_DETAILS_SETTINGS` intent `openAppSettings()` fires → process
death → Back. Result: the same `ActivityRecord` is recreated and lands **on Home**, no Splash.
Frame-by-frame (28 frames at 4 fps, `back2.mp4`): App info → a few frames of bare window
background → Home with the drawer button, weather chip and composer already present. The
"Getting today's advice" spinner in those frames is `HomeScreen.kt:667`'s feed placeholder, not
Splash.

Note for anyone re-running this: `pm grant` does **not** kill the process on API 36, and
`pm revoke` is a no-op if the permission is already denied — neither reproduces the bug on its
own. `am kill` while Settings is foreground is the faithful simulation (process dies, task and
saved state survive).

**Item 6 (chat composer aura) — cost measured, no gate needed.**

Turning the aura on in chat means a 7 s infinite transition and three stacked `drawPath` strokes
now run on the same screen as the shimmer sweep, the tips carousel and token-by-token text. Live
agentic stream measured with `dumpsys gfxinfo` (confirmed on the streaming path: `POST
api/chat/get_answer_for_text_query_agentic/` → `200`, `Content-Type: text/event-stream`):

| metric | value |
|---|---|
| Total frames rendered | 1291 |
| Janky frames | 23 (**1.78 %**) |
| 90th / 95th / 99th percentile | 36 ms / 38 ms / 57 ms |
| Frame deadline missed | 23 |
| `Choreographer: Skipped` events | 1 |

The single Choreographer skip is timestamped `17:47:05.365` — the send/navigation moment, 745 ms
*before* the stream's first byte at `17:47:06.125`. So it is the screen transition, not the aura
under live content. No `isLoading` gate added. (Ignore the "Janky frames (legacy) 97.75 %" line:
that metric compares against a 16 ms budget and is meaningless on an emulator whose 50th
percentile is 31 ms.)

`SdkPreferences.Keys.RESUME_SCREEN` was also moved out of the `// ---- chat ----` group into a new
`// ---- navigation ----` group, where it belongs. `:farmerchat-core:compileDebugKotlin` +
`testDebugUnitTest` after the move: **180 tests, 0 failures**.


## Re-baseline to `193dbd64` (2026-09-08)

The v2 source of truth moved from `fc-compose-agentic` @ `0c8c740f` to `193dbd64` — 17 commits,
8 app files, +143/−33. App version is **unchanged** (v4.1.3, versionCode 108); only the sha moved.
No new endpoint, no new wire field, no new analytics event. The full change-by-change table lives
in [`versions/v2/README.md`](../versions/v2/README.md); this section is the honest ledger of what
was **not** ported and what was found while checking.

**Scope: `versions/v2/` only.** `versions/README.md` names `fc-compose-agentic` as 2.0.0's source
of truth and `fc-compose` @ `9f5e4ca` as 1.0.0's, and `fc-compose` has not moved. v1 is untouched.

### Ported, all platforms that have the surface

| Item | android core | compose | views | ios | react-native | web |
|---|---|---|---|---|---|---|
| 2 new auth labels (`agreement_card_info_text`, `auth_consent_suffix`) | ✅ | ✅ | ✅ | ⛔ no card | ⛔ no card | ⛔ no card |
| Agreement card: 3 bullets → 2 + italic attribution | n/a | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| Consent suffix sentence + coloured link span | n/a | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| Auth scroll + navigation-bar inset | n/a | ✅ | ✅ already scrolled | ⛔ | ⛔ | ⛔ |
| Chat composer idle aura | n/a | ✅ already on | ⛔ no aura at all | ⛔ | ⛔ | ⛔ |
| Chat reserve: viewport-derived height | n/a | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| Chat reserve: held for a finished short answer | n/a | ✅ | ✅ | ⛔ | ⛔ | ⛔ |
| Auto-scroll anchored to the reserved row (SDK-only companion fix) | n/a | ✅ | ✅ | n/a | n/a | n/a |
| Home location-name backfill from #9 | ✅ | ✅ | ✅ via Settings | ✅ | ✅ | 🟡 |
| **New core unit tests** for both of the above | ✅ 18 | — | — | ⛔ | ⛔ | ⛔ |
| Language legal intro names the AI | n/a | ✅ | ✅ | ✅ | ✅ | ✅ |

### NOT ported — recorded, not silently dropped

| App behaviour | Why not | Where it would go |
|---|---|---|
| **Scroll-down indicator suppressed inside the reserve** (`9023b57f`) | **Neither flavour ever shows a scroll-down indicator in chat**, so the suppression has nothing to suppress. Precisely: compose *has* the component (`ScrollToBottomButton`, reachable via `InputComposer(showScrollButton=…)` and `UserInput(showScrollToBottom=…)`) but **both params default to `false` and no call site in `screens/` passes `true`**; views has no pill view in `fc_fragment_chat.xml` at all and only ever calls `scrollToBottom()` programmatically. There is no `hiddenBelow`/`twoLinesPx` computation on either side to attach the suppression to. This is a **previously unrecorded gap**, logged here for the first time | compose: enable `showScrollButton` from `ChatScreen` and port the app's `derivedStateOf` visibility rule **including** the reserve suppression — enabling the pill WITHOUT the suppression would point it into a screen of empty reserved space, which is exactly the bug `9023b57f` fixed. Views: needs the pill first |
| **Failed-last-message reserve** (`9023b57f`) | The app reserves a viewport under a failed question because its retry card renders **inline in the message list**, where the removed `LoadingPlaceholder` collapses the space. The SDK renders its error card **outside** the list (compose `ChatScreen.kt:1204`), so the collapse the app is compensating for cannot occur. Ported literally it would reserve a screen of empty space for nothing | n/a — structural difference, not a gap |
| **`IS_PROFILE_LOADED` reset-ordering move** (`b72ea4da`) | An app global in `AppConstants` gating `HomeScreen`'s fetch. Android SDK core has no equivalent flag, so there was nothing to reorder — and inventing a guard to host the reordering would be adding machinery to mimic a line, not behaviour. See `docs/05` | n/a |
| **`IP_APPROX_LOCATION_NAME` seeding** (`b72ea4da`) | The SDK has ONE approx-name key by design (documented at compose `HomeScreen.kt` `HomeLocationPill`); the app has two. Inventing the second key is barred by root CLAUDE.md §2 | n/a — deliberate reduction |
| **`fc_v2_app_label_agreement_point_surveys` rendering** | Folded into `..._agreement_point_updates` by the app. The constant is **kept** on both flavours (the app kept it too — it is a served key) but nothing renders it | n/a — matches the app |

### 🟡 web: the backfill has no Home-entry trigger

`useUserProfile.fetchProfile` now fills `USER_DISTRICT` / `USER_STATE` / `USER_COUNTRY_NAME` when
blank, exactly as android/ios/react-native do — but **nothing on web calls #9 from Home.** The app,
android and RN all fetch the profile on Home entry; web's `useHome` does not, and
`useUserProfile` is reached only from Settings and EnterName.

Consequence: a web farmer whose place name exists only server-side keeps seeing the "Share your
location" invite until they visit Settings or EnterName, at which point the pill resolves and
stays resolved. The backfill is correct where it runs; the trigger is the gap. Adding a Home-entry
profile fetch to web is a deliberate separate change (it is a new API call on every Home entry)
and is **not** done here.

### Found while checking — genuine defects, not app-delta items

**1. Views dropped the chat reserve for an exclusive alignment surface.** `ChatAdapter.bindAi` set
`b.root.minimumHeight = 0` in the `exclusiveAlignment` branch and returned early. Both compose
(`Column(modifier = streamReserve)` around `AlignmentSurface`) and the app (its
`streamReserveModifier` Column encloses the alignment branch) keep the reserve there. So on views,
the instant an exclusive surface replaced a streamed answer the reserved screen-height vanished and
the thread collapsed upward — the streamed text and the chips that follow it read as two separate
jumps instead of one continuous flow. **Fixed**: both branches now go through one
`holdsReserve(row)` / `reserveHeightPx(root)` pair.

**2. The reserve widening needed an auto-scroll fix the app does not need.** The app deliberately
disables auto-scroll during streaming and scrolls only when a new follow-up is submitted. The SDK
re-scrolls whenever `state.messages.size` **or `state.isLoading`** changes, and core clears
`isLoading` exactly when a stream settles. Extending the reserve to a finished answer without
touching the scroll would have parked the viewport at the top of the newly reserved space and
pushed the question off-screen — reintroducing the jump commit `28be342` had just fixed, at the
settle transition instead of during the stream. Both flavours now anchor the row above **whichever**
row holds the reserve.

**The rule was moved into core to make that literally true.** It first landed as three separate
copies of the same boolean (compose `streamReserve`, the compose scroll effect, views
`ChatAdapter.holdsReserve`) held "in step" by comment — which is exactly the drift
`versions/v2/android/CLAUDE.md` forbids ("state machines live in core… the two flavours must not
drift"). It is now one file, `farmerchat-core/.../ui/chat/ChatReserve.kt`, exposing
`AiResponse.holdsChatReserve(isLastResponse, isLoading)` and `ChatState.chatScrollAnchorIndex()`;
all four call sites read it and nothing else decides the question. Only the reserve *height* stays
per-flavour, because that genuinely is a pixel concern.

Moving it also resolved an ambiguity the three copies had: they disagreed about what "last" means.
`streamReserve` keyed on the newest **AI response** while the scroll copy keyed on the final **row**
of any type. `chatScrollAnchorIndex` now settles it explicitly — the anchor shifts only when the
reserve holder is the final row, because if a question or placeholder is rendered below it the
ordinary bottom anchor is correct. `ChatReserveTest` pins that agreement across the whole
`isLoading` × `isStreaming` grid.

Also worth pinning: **`isLoading` does not mean the same thing in the SDK as in the app.** Core
sets it `true` for the whole duration of a stream (`updateStreamingResponse`) and keeps it true for
a blocking alignment surface on purpose. The app has already cleared it in both cases. So
`isStreaming` and the alignment clause remain load-bearing in the SDK's reserve predicate where the
app's `!isLoading` alone suffices — the predicate is deliberately *not* a literal copy.

**3. ios / react-native / web `UserProfile` was missing two fields the app's #9 model has.**
`geography_level2_name` and `country_name` are in the app's `FarmerProfile.kt` and in android's
`ProfileUser`, but had been omitted from all three ports. They are the readable place names the
location pill needs (bare `geography_level2` is an id), so the backfill was impossible without
them. **Added** to `UserModels.swift` (+ `CodingKeys`) and both `types.ts`. Field names are the
wire's, unchanged; no convenience fields added.

**4. ios and web resolved the language screen's legal intro through invented label keys.**
`legal_agree_prefix` (ios) and `language_legal_prefix` (web) are served by nobody, so endpoint #3
could never translate that line and **every farmer read the English fallback** regardless of
language. Both now use the app's real key `fc_v2_app_label_by_continuing_you_agree_to_our`, which
android and react-native were already using. This is one instance of the broader short-key debt
already recorded above for ios-core and react-native (`docs/05` #7) — the rest of that debt is
untouched here.

### Base URL: STAGE now differs between v1 and v2 (requested 2026-09-08)

v2's `stage` points at `https://demo.agent.farmer.chat/` on all four platforms; v1 keeps
`https://farmerchat.farmstack.co/mobile-app-stage/`. Applies to debug and release alike (the SDK
has one base URL per environment, not per build type). The old value is kept **commented directly
above the new one** in each config file so a revert is one line per platform. Details, and why the
missing base path is harmless for `ApiPriority`, in `docs/02` §Base URLs.

### Verification (actually run, 2026-09-08)

```
cd versions/v2/android
./gradlew :farmerchat-core:compileDebugKotlin :farmerchat-android-compose:compileDebugKotlin \
          :farmerchat-android-views:compileDebugKotlin
BUILD SUCCESSFUL
./gradlew :farmerchat-core:testDebugUnitTest --rerun-tasks
BUILD SUCCESSFUL — 198 tests, 0 failures   (was 180; +18 new, see below)

cd versions/v2/ios/FarmerChatCore && swift build   # Build complete
                                     swift test    # 88 tests, 0 failures

cd versions/v2/react-native/packages/farmerchat-react-native && npx tsc --noEmit   # clean
cd versions/v2/web/packages/farmerchat-web        && npx tsc --noEmit   # clean
                                                     npm run build     # built in 246ms
                                                     npm test          # 218 assertions passed
```

### New tests (+18, `farmerchat-core`)

The two riskiest changes here are pure logic, and `versions/v2/README.md` already states that
"because the wire cannot be exercised, tests are the only guard" — so they are now pinned rather
than eyeballed:

| Suite | Tests | What it pins |
|---|---|---|
| `ui/chat/ChatReserveTest` | 13 | the reserve predicate across streaming / interrupted / settled / follow-up-in-flight / pending-and-picked alignment, on both `isLastResponse` values; the anchor index for an empty thread, a lone answer, a reserving last row and a question rendered below one; and that the predicate and the anchor **agree** across the full `isLoading` × `isStreaming` grid |
| `ui/home/ApproxPlaceNameTest` | 5 | the district → state → country precedence, and that **blank is treated as absent at every level** (the API returns `""` for unset geography as often as it omits the key, and a blank would be written to prefs and render as a name-less pill) |

`approxPlaceName()` was extracted out of `HomeViewModel` into `HomeUdf.kt` to make the precedence
testable without a prefs double; the prefs write stays in the view model.

### Device run on RationSmart, 2026-09-08 — what it did and did NOT verify

The re-baselined SDK was published to mavenLocal and consumed by **RationSmart**
(`feed-formulation-frontend`, `CHAT_ONLY` + `enableAgenticChat` + `enableComposerUi`) on the
`rs_qa` emulator (API 36). Debug **and** release assemble; the release APK's dex contains
`https://demo.agent.farmer.chat/` and **not** the old farmstack stage URL, so the whole chain
(SDK edit → `publishToMavenLocal` → host APK) is confirmed.

Logcat at launch, from a `Log.d` added to the host's `FarmerChatSetup` for exactly this purpose:

```
D FarmerChat: FarmerChat initialized (env=STAGE, baseUrl=https://demo.agent.farmer.chat/)
W FarmerChat: FarmerChat session expired          ← ~400 ms later
```

**Positively verified on screen:** the chat shell composes (green app bar, logo, tips + language
icons), the composer works end to end (typing swaps mic → send, the field expands), the user
bubble keeps the app's grey styling, the error card renders, and **no crash** — in particular no
`VerifyError`, so the AGP 8.13 floor still holds for this build. `chatScrollAnchorIndex()` ran on
the send (a one-message thread → anchor 0) without misbehaving.

**NOT verified, and this is the important part: the reserve itself never ran.** The session is dead
(see below), so no `AiResponse` was ever added to the thread — and both `holdsChatReserve` and the
shifted anchor apply to `AiResponse` rows only. The screenshot *looks* like the reserve working
(question pinned at top, error card beneath, empty space below) but that layout is simply a short
top-aligned list with no answer in it. **Do not read that run as verification of the reserve.**

#### Why the session dies: STAGE rejects the SDK's built-in guest key

Probed directly, 2026-09-08. Every path on `demo.agent.farmer.chat` answers:

```
401 {"error":"unauthorized","message":"Invalid or missing API key"}
```

— with no key, **and** with `ApiConstants.DEFAULT_GUEST_USER_API_KEY`, under six header spellings
(`API-Key`, `x-api-key`, `apikey`, `X-API-KEY`, `Api-Key`, `Authorization: Bearer`). For contrast,
the old farmstack stage host answers the same call with Django's own
`{"detail":"Authorization credentials were not provided."}` — i.e. the request *reaches the
application* there and only lacks a bearer token.

So this is a **credentials/provisioning gap, not an SDK defect**: no client change can fix it, and
`guestApiKey(...)` must carry a key valid for the new host. Until then a host on STAGE gets
`onSessionExpired` and an unusable chat. `-PFC_ENV=PROD` is the workaround for local verification.

### Still NOT verified on a device or in a browser

What most wants a device, in order:

1. **The chat reserve + scroll, both flavours** — still the top item, because the 2026-09-08
   device run could not reach it (no answer ever arrived). It needs a session that actually
   streams: a valid STAGE key, or a PROD/DEMO build. The views scroll path is the one that went
   blank on a device before (`28be342`), and no unit test can see a viewport.
2. **The auth screen's new navigation-bar inset.** Inset double-counting is invisible to a
   compiler — the reason it is written as `WindowInsets.ime.union(navigationBars)` rather than two
   chained modifiers is precisely that the chained form *sums* them. Worth checking with the
   keyboard both up and down, on a gesture-navigation device.
3. **The viewport-derived reserve settles over one frame.** It reads `layoutInfo.viewportSize` to
   size items *inside that same list*, so the first frame reserves `screenHeightDp` (the fallback)
   and the second reserves the smaller measured viewport. It converges, and the app does exactly
   the same thing, but a one-frame settle is invisible to a compiler and potentially visible to a
   farmer. It cannot *loop*, which is the thing worth being sure of when a layout reads its own
   layout: `viewportSize` is the list's own measured size and does not depend on item heights, so
   the reserve depending on it is not a cycle. (`layoutInfo.visibleItemsInfo` would have been.)
4. **The Home backfill** wants a farmer account whose profile carries geography while the local
   prefs are empty — a reinstall, or a fresh host app against an existing account.
5. **The stage base URL**, which no gate in this repo can validate. See the probe recorded in
   `docs/02` §Base URLs: reachable and API-key-gated, mounting unconfirmed without a key.


## Screen-fidelity pass against the app, driven side by side on a device (2026-09-08)

Triggered by: *"the ui does not match, check all screens from original & implement to all sdk, u
did not update anything there are lot of changes."*

**That report was correct, and the re-baseline above could not have caught it.** Diffing
`0c8c740f..193dbd64` finds what the APP changed; it cannot find what the SDK never ported
faithfully in the first place. Those are two different defect classes and they need two different
instruments. This section uses the right one.

### Method (reusable — this is how to find drift)

1. **Build the app and the SDK sample side by side on the same backend.** The reference app's
   working tree does **not** build — `gradle/libs.versions.toml` has `agp = "9."`, a truncated
   edit — so it was cloned to a scratch dir at `193dbd64` and built there. The reference repo is
   read-only (root `CLAUDE.md` §1) and was not touched. Both were run on the **dev** environment,
   because `sample-compose` defaults to `DEV` and the app has a `dev` flavour: same language list,
   same labels, so any difference on screen is the SDK's.
2. **Screenshot the same screen in both** and compare element by element.
3. **Then read the two sources side by side** for the block that differs. The visual diff says
   *where* to look; the source says *what* the value should be. Neither alone is enough — a
   component-inventory grep (`grep -oE '^\s+[A-Z][A-Za-z0-9]*\('` on both, then `comm -23`) was
   tried first and returned almost pure noise, because the SDK legitimately restructures the app's
   private composables and its superset of components swamps the diff.

### Language screen — 8 drifts found, all fixed (compose)

| # | Element | App | SDK before | Fix |
|---|---|---|---|---|
| 1 | **Language pre-selection** | first language auto-selected on `get_languages` success, applied, and **its labels fetched** | only a *persisted* language preselected — nothing on a fresh install | core `OnboardingSharedViewModel`: `selectedLanguageId ?: savedId ?: allLanguages.first().id`, routed through `selectLanguage()` |
| 2 | **Whole-screen language** | Kannada on first paint (consequence of #1) | **English** until the farmer tapped a row | fixed by #1 |
| 3 | **CTA state** | enabled, white text | stuck in `Default` (grey text), since both flavours gate on `selectedLanguageId != null` | fixed by #1 |
| 4 | **Logo colour** | `borderActive` — brand **green** | `foregroundPrimary` — **black** | tint changed |
| 5 | Logo size | 32 dp | 44 dp | 32 dp |
| 6 | **"All languages" chip** | filled `buttonPrimarySurface` / `buttonPrimaryForeground` — white on dark green, `labelLarge`, 20 dp | `surfaceSecondary` / `foregroundPrimary` — dark on **white**, `labelMedium`, 18 dp | matched |
| 7 | **Tagline** | `titleLarge` on `foregroundPrimary` — bold dark headline | `bodySmall` on `foregroundSecondary` — small grey caption | matched |
| 8 | Heading type + padding | `titleLarge`; 24 dp h / 32 dp top / 24 dp bottom; 14 dp after logo | `displaySmall`; 20 dp h / 24 dp top / 16 dp bottom; 20 dp after logo | matched |

**#1 is the one that mattered.** It is a single omitted fallback in core, and it produced four of
the eight visible symptoms — including a farmer in Karnataka being shown an English screen. Note
it was routed through the existing `selectLanguage()` rather than a bare
`copy(selectedLanguageId = …)`: the bare write would have fixed the radio button and left the
language **unapplied**, which is the worse bug (right-looking screen, wrong language persisted, ASR
/ TTS / `streaming_required` flags never written).

**Device-verified after the fix**: green logo, Kannada pre-selected with the light-green row, whole
screen in Kannada, filled green "All languages", bold tagline, enabled CTA — matching the app
capture element for element. One cosmetic difference is left and NOT fixed: the app wraps its legal
sentence over three lines with the two links inline in the flow, the SDK renders two lines plus a
separate `Terms · Privacy` row. Recorded, not churned.

### Scope of this pass, stated honestly

- **compose only.** Views is documented as a re-creation that drifts, and compose is what a host
  actually runs (`FarmerChat.resolveActivityClass()` prefers it — confirmed in RationSmart's
  logcat this session). Fixing compose first is where the fidelity value is.
- **#1 is in core, so BOTH android flavours get it.** #4–#8 are compose-only token/geometry
  changes; views needs its own pass and does not inherit them.
- **ios / react-native / web are NOT fixed and NOT verified.** #1 has a direct counterpart on each
  (they all preselect only a persisted language) and should be ported — that is the highest-value
  item for them. #4–#8 are Compose token/geometry values with no mechanical translation.
- **The remaining screens are NOT done.** Auth, ChatHistory, Settings, LanguageChooser, Splash,
  Help, SettingsName, AccountSuccess, NoInternet. Given eight drifts on the *simplest* screen,
  assume a comparable count on each. The method above is written down so the pass is repeatable
  rather than exploratory.

### Chat + Home + EnterName pass (2026-09-08, same method)

**Home came out clean.** Side by side on dev, the SDK's agentic Home matched the app element for
element: green band with the top-centre glow, hamburger, weather pill, white logo mark, "What are
farmers asking today?" with its squiggle flanks, the dark-green location pill with `Change` in
bright green, image + text feed cards with `Ask Now`, and the composer. No fixes needed. The two
things that *looked* different — the sunbeam rays and the composer aura — are both animations
(7 s aura rotation, swaying beams), so a single-frame comparison cannot judge them; not treated as
drift.

**EnterName had the Language screen's drift, verbatim.** Same six values, same direction:

| Element | App | SDK before |
|---|---|---|
| **Logo tint** | `borderActive` (green) | `foregroundPrimary` (**black**) |
| Logo size | 32 dp | 44 dp |
| Spacer after logo | 14 dp | 20 dp |
| Title style | `titleLarge` | `displaySmall` |
| Spacer after title | 8 dp | 6 dp |
| Subtitle width cap | `widthIn(max = 260.dp)` | none (ran full width) |
| Spacer after subtitle | 24 dp | 28 dp |
| Horizontal / top padding | 24 dp / 32 dp | 20 dp / 48 dp |

All fixed and device-verified (green mark, tighter scale). A **full audit of every `fc_logo_mark`
tint** was done rather than fixing them one screen at a time: Language and EnterName were the only
two wrong. Splash, Home and the chat app bar correctly use `foregroundPrimary`, because those sit
on a green surface where that token resolves to white — verified against the app and deliberately
left alone.

**Chat: three real drifts, all fixed.**

| # | Element | App | SDK before | Fix |
|---|---|---|---|---|
| 1 | **App-bar left icon, entry from Home** | back arrow | **✕ close** | icon now follows the behaviour: `onClose` pops back to Home in FULL_JOURNEY and only finishes the Activity in CHAT_ONLY (`FarmerChatRoot.kt:512`), so ✕ is shown **only** when the tap really leaves the SDK |
| 2 | **Order of the additive alignment nudge** | answer → caption + Share/Listen + follow-ups → **then** the nudge | nudge → caption + Share/Listen | the two blocks were transposed; the nudge moved below the interrupted/actions if-else chain, matching `ChatThreadContent.kt` |
| 3 | **Scroll anchor ignored the loading placeholder** | anchors the question; no auto-scroll during streaming | anchored the **placeholder**, pushing the just-asked question off the top — and then STUCK there, because replacing the placeholder with the streaming answer changes neither `messages.size` nor `isLoading`, so the effect never re-ran | `chatScrollAnchorIndex` now treats a trailing `LoadingPlaceholder` as holding space, exactly like the reserve |

#3 is worth dwelling on: it is the same class of bug as `28be342`, it was introduced by neither
this pass nor the re-baseline, and it explains a symptom that reads as "the reserve doesn't work" —
the question scrolling away during a follow-up. The SDK's own comment already said the placeholder
exists so "the scroll-to-anchor pins the question at the top while that placeholder holds the
space"; the anchor simply never implemented that half.

**And a correction to this document.** The re-baseline section above claims "neither flavour ever
shows a scroll-down indicator in chat, so the suppression has nothing to suppress." **That was
wrong**, twice over. Compose has `ScrollIndicator` (`components/Feed.kt:194`), rendered from
`ChatScreen` whenever `lastAiMessage != null && !state.isLoading` — a bouncing chevron with no
check for whether anything lies below it. With the reserve now held on a finished answer, that is
precisely the bug app commit `9023b57f` fixed: the indicator invited the farmer to scroll into a
screen of empty reserved space. The app's rule **is** now ported — suppress when the last item fits
inside the reserve, otherwise require at least two lines (`48.dp`) of genuinely hidden content. The
earlier grep missed it because it searched for `hiddenBelow`/`twoLinesPx`/`ScrollToBottomButton`
and the component is named neither; `ScrollToBottomButton` does exist but is dead
(`showScrollButton` defaults to `false` and no call site passes `true`).

**A flow difference, recorded not fixed:** the SDK shows the EnterName screen after language where
the app went straight to Home on the same dev backend and the same fresh guest. Not investigated
in this pass — it is a routing question (`routeFromSplash`/onboarding-step prefs), not fidelity,
and changing it blind risks skipping name capture for hosts that want it.

### Remaining screens (2026-09-08) — the drift is a systematic type-scale substitution

Rather than read nine screens end to end, the audit was run as a **token sweep**: for each app
screen and its SDK counterpart, count `MaterialTheme.typography.*` uses and diff the multisets.
That surfaced the pattern in one pass — **the SDK consistently substituted a neighbouring type
token**, almost always one step *smaller* than the app:

| Screen | Element | App | SDK before |
|---|---|---|---|
| Auth | "Enter your phone number" | `titleLarge`, centred | `displaySmall`, **left-aligned** |
| Auth | "Enter the code we sent" | `titleLarge`, centred | `displaySmall`, **left-aligned** |
| Auth | **phone-step subtitle** | `bodyMedium` | **MISSING ENTIRELY** |
| Settings | Appearance / My Farm / Account details | `labelLarge` ×3 | `titleSmall` ×3 |
| Settings | Day / Night / Auto chip caption | `labelSmall` | `labelMedium` (too *large* — the one overshoot) |
| ChatHistory | date-group heading | `labelLarge` | `titleSmall` |
| ChatHistory | "Couldn't load more chats" | `bodyMedium` | `bodySmall` |
| LanguageChooser | "All languages" | `labelLarge` | `labelMedium` |
| Help | "How to use FarmerChat" / "More" | `labelLarge` ×2 | `titleSmall` ×2 |
| Home (legacy) | greeting | `titleMedium` | `displaySmall` (two steps too large) |
| AccountSuccess | app-bar title | `SIGN_UP` | `ALL_SET` (wrong label — read "All set" above "You're all set!") |
| AccountSuccess | subtitle | `bodyLarge` override | override omitted → `bodyMedium` default |

All fixed. **The type scales themselves are identical between app and SDK** (`labelLarge` = 17sp/600,
`titleSmall` = 16sp/700, and so on, verified in both `Type.kt`s), so every row above is a genuine
rendered-size difference, not a naming artefact.

**Two of these are more than cosmetic:**

- **The Auth phone-step subtitle was missing outright.** Both its labels (`SEND_OTP_SIGNIN`,
  `SEND_OTP_SIGNIN_SHORT`) were declared in `Labels.kt` and rendered by nothing, so the sign-up
  screen never showed its only explanation of why a phone number is wanted. Now rendered, with the
  app's is-sending copy swap. Device-verified.
- **`attentionWobble` had no call site.** The modifier was ported into
  `components/AttentionWobble.kt` and invoked nowhere; the app applies it to the legacy Home
  greeting. Now wired there. Same class of gap as the `LocationChatBubble` one in
  `versions/v2/README.md` — a component that exists is not a feature until something calls it.

**Screens that came out CLEAN** (checked, nothing to fix): Splash (no typography; logo tint already
correct), SettingsName, and the whole `FullScreenMessage` family — the SDK's `ErrorScreen`
(= the app's NoInternet) delegates to it and its `bodyMedium` / `displaySmall` / `bodyMedium`
values match the app's component exactly.

**Recorded, deliberately NOT changed:** the OTP resend row. The app renders "Resend code" and
"Start over" as `labelLarge` text with a separate `bodyMedium` timer line; the SDK renders a
combined "Resend code · N seconds" line and then two `SecondaryButton`s. That is a structural port
decision the views flavour shares (`fcResendButton` / `fcStartOverButton` in
`fc_fragment_auth.xml`), so changing compose alone would split the two flavours. Flagged for a
decision rather than churned.

**Device-verified after the fixes:** the Auth screen renders the centred `titleLarge` heading, the
restored subtitle, the two-bullet agreement card with its italic attribution line, and the consent
sentence with its suffix — matching the app.

### Views flavour — same pass, same drift (2026-09-08)

Views expresses the type scale as raw `android:textSize` sp, and the app's tokens map 1:1
(`labelLarge` = 17sp/600, `titleSmall` = 16sp/700, `labelSmall` = 13sp, `titleLarge` = 22sp,
`bodyMedium` = 17sp, `bodyLarge` = 19sp). So the audit is the same one, run against XML.

**Views had the drift too — in several places worse than compose.**

| Screen / layout | Element | App | Views before |
|---|---|---|---|
| `fc_item_language_header` | logo | 32 dp, `borderActive` | **44 dp, `fc_foreground_primary`** (black) |
| `fc_item_language_header` | title | `titleLarge` 22sp | 24sp |
| `fc_item_language_expander` | "All languages" | filled dark green, white, 17sp, 20 dp pad, 16 dp top | **white pill**, dark text, 15sp, 18 dp pad, 10 dp top |
| `fc_fragment_language` | tagline | `titleLarge` 22sp bold, foregroundPrimary | **15sp**, foregroundSecondary |
| `fc_fragment_enter_name` | logo | 32 dp, `borderActive` | **44 dp**, foreground_primary (black) |
| `fc_fragment_enter_name` | title | 22sp | 24sp |
| `fc_fragment_auth` | phone title | 22sp, **centred** | 24sp, left |
| `fc_fragment_auth` | phone subtitle | 17sp, centred, 8 dp top | 15sp, left, 4 dp top |
| `fc_fragment_auth` | OTP title / subtitle | 22sp / 17sp, centred | 24sp / 15sp, left |
| `fc_fragment_settings` | Appearance / Account details | `labelLarge` 17sp | **13sp** |
| `fc_fragment_settings` | My Farm | 17sp | 16sp |
| `FcAppearanceButtonLabel` | Day / Night / Auto | `labelSmall` 13sp | 14sp |
| `fc_item_history_header` | date-group heading | 17sp | **13sp** |
| `fc_fragment_help` | FAQ / More titles | 17sp | **13sp** |
| `fc_fragment_help` | copyright | 13sp | 12sp |
| `AccountSuccessFragment` | app-bar title | `SIGN_UP` | `ALL_SET` (wrong label) |
| `FullScreenMessageView` | account-success subtitle | `bodyLarge` 19sp | no override → 17sp |
| `fc_item_chat_ai` | additive alignment surface | **after** the caption + action row | **before** them (transposed) |
| `ChatFragment` | chat app-bar icon, entry from Home | back arrow | **✕ close** |

All fixed. Two new resources were needed and added: `drawable/fc_bg_pill_primary.xml` (the filled
green pill the app draws for "All languages"; mirrors `fc_bg_pill_white` apart from the fill) and
`color/fc_button_primary_foreground` (#FFFFFF — the app's `buttonPrimaryForeground`, which views
had no token for). `FullScreenMessageView.bind` gained a `subtitleSizeSp` parameter, the Views
stand-in for the app's `subtitleTextStyle`, defaulting to 17sp so every other caller is unchanged.

**The chat app-bar icon and the additive-surface order were the SAME two bugs compose had**, fixed
the same way — the icon now follows the behaviour (✕ only in `CHAT_ONLY`, where the tap really
leaves the SDK), and the surface moved below the action row.

**Device-verified** on `sample-views`: green 32 dp logo, Kannada auto-selected with the light-green
row (the core language fix reaching views), filled dark-green "All languages" chip with white text,
and the bold 22 sp tagline — matching both the app and the compose flavour.

**Not separately verified on a device:** the views Auth, Settings, Help, ChatHistory and
AccountSuccess changes. They are XML size/colour edits that compile and assemble, but only the
language screen was driven end to end.

### Where this leaves the platforms

- **android compose** — Language, EnterName, Auth, Chat, Home and the settings-family screens
  swept and fixed.
- **android views** — same sweep, same fixes, as above.
- **ios / react-native / web** — audited and fixed too; see the next section.

### ios / react-native / web fidelity pass (2026-09-08)

Each platform expresses type differently — iOS raw `.font(.system(size:weight:))`, react-native a
token object, web inline px plus injected CSS — so the sweep was run per platform against the app's
scale (`titleLarge` 22/700, `bodyMedium` 17/400, `labelLarge` 17/600, `labelSmall` 13/600).

**All three had the SAME drift as android, element for element.** The language screen in particular
was wrong in the identical way on all four platforms, which says the four ports were made from one
slightly-wrong reading rather than drifting independently:

| Platform | Element | App | Before |
|---|---|---|---|
| ios | language logo | 32, `borderActive` green | 44, `foregroundPrimary` **black** |
| ios | language title / paddings | 22, 14/32/24 | 24, 20/24/20 |
| ios | "All languages" | filled green, white, 17/600, 20 pad | `surfaceSecondary`, dark, 15/600, 18 pad |
| ios | tagline | 22/700 primary | 15 regular secondary |
| ios | EnterName logo / title | 32 green / 22 | 44 black / 24 |
| ios | history date header | 17/600, primary, natural case | 13/600, grey, **forced UPPERCASE** |
| ios | LanguageChooser "All languages" | 17/600 | 15/600 |
| react-native | language logo | 32 green | 44 black |
| react-native | language title | `titleLarge` | `displaySmall` |
| react-native | "All languages" | filled green + `labelLarge` | `surfaceSecondary` + `labelMedium` |
| react-native | EnterName title | `titleLarge` (22) | legacy `title` alias (**24**) |
| react-native | Settings Appearance / Account details | `labelLarge` | `titleSmall` |
| web | "All languages" | filled green pill, 17px | transparent text link, 14px, **plus a chevron** |
| web | tagline | 22px/700 primary | 13.5px muted |

**And a worse class of bug on all three: invented label keys with invented copy.**

The Auth screens on iOS, react-native and web used `auth_title` / `auth_subtitle` / `otp_title` /
`otp_subtitle` (web: `auth_phone_title` / `auth_phone_subtitle` / …). **None of those keys exists**
— endpoint #3 serves the `fc_v2_app_label_*` namespace — so they could never resolve and every
farmer read the English fallback whatever language they chose. The fallbacks were invented too:

| Shown before | The app's actual copy |
|---|---|
| "Sign up with phone number" | "Enter your phone number" |
| "We'll send you a verification code" | "We'll send a one-time code to sign you in" |
| "Enter the 4-digit code" | "Enter the code we sent" |
| "Sent to +91 98…" / "Code sent to {name}" | "Check your messages for the code" (**no phone number**) |

Web's language screen was the same: `language_title`, `language_subtitle`,
`language_all_languages`, `language_tagline` — the last with copy ("Your personal farming adviser")
that appears nowhere in the app. All replaced with the app's real keys and strings.

This is the same debt already recorded for the language-screen legal line earlier in this document,
and it is broader than these screens (`docs/05` #7). The Auth and Language screens are now correct;
**the rest of the short-key debt on ios/react-native/web is untouched** and still wants a sweep of
its own.

> One process note: while fixing web I typed a key from memory — `..._you_can_change_this_later` —
> and it was wrong; the app's is `fc_v2_app_label_you_change_later`. Caught by grepping the app's
> `Labels.kt` before committing to it. Every key in this pass was taken from the app source, never
> from the English string.

### The ios verification in §5 does not compile the UI packages

Worth fixing in the process, not just the code. `docs/CLAUDE.md` §5 specifies `swift build` in
**FarmerChatCore** for ios — and that package contains no SwiftUI or UIKit code. Running
`swift build` in `FarmerChatSwiftUI` fails with ~11 errors that have nothing to do with the SDK
(`UIKeyboardType`, `UITextContentType`, `.phonePad`, `UnevenRoundedRectangle is only available in
macOS 13`) because SwiftPM targets **macOS** on a Mac, and both UI packages are iOS-only.

So every SwiftUI/UIKit change in this repo has been landing unverified by the documented check.
The command that actually compiles them:

```bash
cd versions/v2/ios/FarmerChatSwiftUI
xcodebuild -scheme FarmerChatSwiftUI -destination 'generic/platform=iOS Simulator' build   # ** BUILD SUCCEEDED **
cd ../FarmerChatUIKit
xcodebuild -scheme FarmerChatUIKit  -destination 'generic/platform=iOS Simulator' build   # ** BUILD SUCCEEDED **
```

Both pass with this pass's changes. Recommend adding these two commands to §5 alongside the
existing `swift build` / `swift test` on Core.

### Verification (actually run, 2026-09-08)

```
android   :farmerchat-core/:compose/:views compileDebugKotlin      BUILD SUCCESSFUL
android   :farmerchat-core:testDebugUnitTest                        198 tests, 0 failures
ios       FarmerChatCore  swift build / swift test                  88 tests, 0 failures
ios       FarmerChatSwiftUI xcodebuild -sdk iphonesimulator         BUILD SUCCEEDED
ios       FarmerChatUIKit   xcodebuild -sdk iphonesimulator         BUILD SUCCEEDED
react-native  npx tsc --noEmit                                      clean
web       npx tsc --noEmit / vite build / npm test                   clean / built / 218 assertions
```

**NOT verified visually on ios, react-native or web.** None of the three can be compared against
the app the way android can, because the reference app only exists on Android — so these fixes are
source-parity against the app's Compose values plus a successful compile, and nothing more. The
android equivalents of the same fixes WERE device-verified, which is the strongest available
evidence that the values are right.

---

## iOS pass against the native app (`FarmerChat-iOS-Agentic-v2.3`)

Until now iOS/RN/web had no side-by-side reference — the app existed only on Android, so the
iOS SDK was verified by reading Kotlin and writing Swift. `/Users/Aiyappa/Desktop/FarmerChat-iOS-Agentic-v2.3`
is a native SwiftUI port of the same app and finally supplies an iOS ground truth, including an
82KB `PARITY.md` of its own measured sweep.

### Lineage — read this before trusting the app's numbers

Its `PARITY.md` names its source as `fc-compose` @ `features/dev_v2.3` commit `e20264b`.
That commit **is** an ancestor of this SDK's v2 baseline `193dbd64`, **51 commits behind**. So:

- the iOS app is authoritative for **SwiftUI technique** — how to express an Android construct
  in SwiftUI, which is knowledge the SDK had no source for before;
- **Android remains authoritative for values** (root CLAUDE.md §1). The app's own `PARITY.md`
  tables list rows where the *app* still differs from Android — e.g. its Auth subtitle renders at
  a 25.0 pt pitch against Android's 27 (`PARITY.md:339`), and its chat answer uses `bodyMedium`
  where Android uses `bodyLarge` 19/27 (`PARITY.md:343`). Porting those to the SDK would import
  the app's gaps. Every slot below is therefore cited to an Android source, not to the iOS app.

### Finding 1 — the iOS SDK had NO line-height layer at all (fixed)

`grep -rn "lineSpacing\|lineHeight"` over `versions/v2/ios` returned **nothing**. All 142 text
call sites were a bare `.font(.system(size:))`. Android varies *line height* per script
(Devanagari/Ethiopic/Kannada/Oriya/Telugu need more leading than Roman at the same point size)
while holding size and weight fixed — six tables in `theme/Type.kt`. The SDK applied none of it,
so every multi-line string rendered at the system font's natural pitch, and a Hindi or Kannada
answer was measurably tighter than the same answer in the app. This affected every screen at once.

This is a *different* defect from the app's. The app had the layer but computed
`lineSpacing = lineHeight - size`, which double-counts the font's built-in leading — Compose's
`lineHeight` is the TOTAL line box, while SwiftUI's `.lineSpacing` is leading added ON TOP OF the
font's own line height. That put its `bodyLarge` at a 31 pt pitch against Android's 27.1
(`PARITY.md:326`). Its fix — subtract `UIFont.systemFont(ofSize:weight:).lineHeight`, not the
point size — measured **27.00** afterwards (`PARITY.md:330`).

**Fixed** by `FarmerChatSwiftUI/Sources/FarmerChatSwiftUI/Theme/FCTypography.swift` (new), which
ports all six per-script tables verbatim and uses the app's corrected formula. Because the formula
is identical and the inputs are identical, the app's measured 27.00 pitch carries to the SDK by
construction — this is an inference from a shared formula, **not** an independent on-device
measurement, and is recorded as such.

Two deliberate differences from the app's copy:

- **It stays themable.** The app renders one fixed scale; the SDK lets a host supply `typeScale`
  and `fontName` (docs/07). Both change the arithmetic — `typeScale` scales the target line height
  as well as the point size, and a custom family has different natural metrics — so leading cannot
  be baked into a static table the way the app bakes it. It is resolved per
  (script, typeScale, fontName) and cached: `FCTheme.theme(for:appearance:)` is a computed
  property re-evaluated every SwiftUI body pass, and resolving a scale measures 13 fonts, so an
  uncached resolve would re-measure 13 fonts per frame in a scrolling feed. A host font is asked
  for its metrics by name; a name that does not resolve falls back to the system font's metrics
  rather than guessing.
- **Spec and resolved style are separate types.** `FCTextSpec` is the unscaled declaration,
  `FCTextStyle` the resolved result. One combined type would allow an already-scaled table to be
  re-resolved and silently scaled twice; separating them makes that unrepresentable.

Reached as `theme.typography.<slot>` — hung on `FCTheme` rather than a second environment key,
because every screen already reads `theme`, so no call site needed new plumbing. The language
comes from `prefs.string(.selectedLanguageCode)`, seeded at `initialize` from `config.languageCode`
or the device locale, so a script-specific scale is picked before the farmer reaches language
selection.

### Finding 2 — host `typeScale` / `fontName` were dead code (fixed by the same change)

`FCTheme.font(size:weight:)` applies `typeScale` and `fontName` and had **0 call sites**. All 142
sites used raw `.system(size:)` instead, so a host setting `typeScale: 1.3` for accessibility, or
`fontName:` for a brand family, saw **nothing change** anywhere in the SDK — a documented public
surface (docs/07) that silently did nothing. Routing call sites through `theme.typography` fixes
this as a side effect, since the resolved scale carries both. `FCTheme.font` is kept (removing
public API would require a docs/03 change) and re-documented as the escape hatch for genuinely
off-scale sizes that have no slot to name.

### Migrated this pass — 26 call sites, each cited to an Android source

Scope was held to the five screens already touched in this session, so every slot could be
justified against the Android SDK's compose screens (brought to app fidelity earlier in this same
effort) or the app itself. The remainder is listed as open below rather than guessed at.

| iOS site | was | now | Android source |
|---|---|---|---|
| AuthView:81,197 phone/OTP headings | 22/bold | `titleLarge` | SDK AuthScreen.kt:405,707 |
| AuthView:89,205 subtitles | 17 | `bodyMedium` | SDK AuthScreen.kt:421,717 |
| AuthView:135,222 phone/OTP error | 13/regular | `labelSmall` | SDK AuthScreen.kt:733 — weight was wrong too |
| AuthView:181 legal line | 12 | `bodySmall` | app AuthScreen.kt:1199 |
| AuthView:236 resend countdown | 14 | `bodySmall` | SDK AuthScreen.kt:753 |
| AuthView:244 resend / start-over links | 15/semibold | `labelLarge` | app AuthScreen.kt:1112,1122,1135 |
| EnterNameView:24,30 | 22/bold, 17 | `titleLarge`, `bodyMedium` | SDK EnterNameScreen.kt:195,205 |
| LanguageSelectionView:87,142 headings | 22/bold | `titleLarge` | app parity, already noted in-file |
| LanguageSelectionView:93 subtitle | 17 | `bodyMedium` | app parity, already noted in-file |
| LanguageSelectionView:116 "All languages" | 17/semibold | `labelLarge` | LanguageChooserScreen.kt:210 |
| LanguageSelectionView:205 terms/privacy | 13 | `bodySmall` | app AuthScreen.kt:1199 (same legal treatment) |
| ChatHistoryView:56 empty state | 16 | `bodyMedium` | SDK ChatHistoryScreen.kt:136 |
| ChatHistoryView:73 section title | 17/semibold | `labelLarge` | SDK ChatHistoryScreen.kt:164 |
| ChatHistoryView:106,119 pagination error / loading | 14 | `bodyMedium` | SDK ChatHistoryScreen.kt:232 |
| SettingsViews:88 Day/Night/Auto caption | 13/semibold | `labelSmall` | SDK SettingsScreen.kt:460 — size right, gains leading |
| SettingsViews:229 expand languages | 17/semibold | `labelLarge` | SDK SettingsScreen.kt:228 |
| SettingsViews:306,318 help error / empty | 14 | `bodySmall` | SDK SettingsScreen.kt:344 |
| SettingsViews:309 "Try again" | 14/semibold | `labelMedium` | nearest slot; see open items |
| SettingsViews:350 SDK version footer | 12 | `caption` | SDK-only chrome, no app element; `caption` is Android's 13/18-regular slot |

Note the systemic shape, the same one found on android earlier in this effort: the SDK was
**almost always one step smaller** than the app — 12 where the app has 15, 14 where it has 17,
13 where it has 15. Off-scale sizes 11/12/14 accounted for 30 of the 142 sites and appear nowhere
in Android's type scale.

**Verified:** `xcodebuild -scheme FarmerChatSwiftUI -destination 'generic/platform=iOS Simulator' build`
→ BUILD SUCCEEDED, both after landing the token layer alone and after migrating the call sites.
Numeric pitch is **UNVERIFIED on device** — see the inference note in Finding 1.

### Completing the pass — the scale moved to Core, and both flavours migrated

The first two batches put the six per-script tables inside `FarmerChatSwiftUI`. That is the shape
the android rule warns about — `android/CLAUDE.md`: state machines live in core, "the two flavours
must not drift" — and it was about to bite, because `FarmerChatUIKit` needs the same numbers with
a **different formula**:

| Flavour | Line-height mechanism | Is it a total line box? | Arithmetic |
|---|---|---|---|
| Compose (reference) | `TextStyle.lineHeight` | yes | use the number |
| SwiftUI | `.lineSpacing` | **no — additive leading** | subtract `UIFont.lineHeight` |
| UIKit | `NSParagraphStyle.min/maximumLineHeight` | yes | use the number |
| React Native | `TextStyle.lineHeight` | yes | use the number |
| CSS | `line-height` | yes | use the number |

So the numbers now live once, as data, in
`FarmerChatCore/Sources/FarmerChatCore/Theme/FCTypeScale.swift` — `FCTypeSpec`, `FCTypeScale`,
`FCScript`, and a plain `FCFontWeight` enum so Core carries no UI-framework type. Each flavour
resolves them its own way and neither restates a single number.

**SwiftUI — complete.** 98 text call sites now use `fcTextStyle(theme.typography.<slot>)`.
Three remain, all deliberately: `DrawerView.swift:32` (drawer wordmark),
`HomeComponents.swift:67` (weather temperature) and `:105` (feed footer) have **no Android
counterpart to cite**, so per root CLAUDE.md §2 they are logged in docs/05 rather than guessed at.
37 `Image(systemName:)` glyph sizes stay raw by design, and 3 monospaced timers must.

**UIKit — newly covered, was untouched before this pass.** `FCUITypography.swift` (new) resolves
the Core scale into `UIFont` plus an exact `NSParagraphStyle`. All 43 text sites migrated. Three
remain, and two of them *should*: `ChatViewController.swift:690,705` are the share-card image
renderer, drawing onto a 720 px canvas at 30/36 pt — those are canvas-relative sizes, not screen
type, and pulling them onto the scale would shrink the shared image's text. The third is the
drawer wordmark, the same uncited element as SwiftUI's.

A UIKit constraint worth recording: **`UILabel` has no line-height property** — line height only
exists via attributed text. So the helper is split. `fcApplyFont` (font only) is safe anywhere and
is enough for single-line labels, which have no line box to correct. `fcSetText` also applies the
line height, so it must be the call that sets the string, and it bakes in the label's `textColor`
and `textAlignment` because attributed runs ignore a later `textColor` assignment. It is applied
to the multi-line bodies that matter: both chat bubbles, the location address, the
alignment-surface message, the feed card title/statement, and the full-screen message
title/subtitle (whose assignments had to be reordered — they set `text` before `textColor`).
Remaining multi-line labels have correct **size** but still natural leading; listed in docs/05.

One further slot correction found here: the alignment-surface message is `bodyLarge`
(`AlignmentSurface.kt:90`), not `bodyMedium` — the one place the answer-body slot and the
alignment-message slot differ.

Two `.uppercased()` forcings were also dropped, on `DrawerLocationError.swift` and
`HistorySettingsHelpViewControllers.swift` section headers, plus `.textCase(.uppercase)` on
SwiftUI's `FCListCard` — the same defect already fixed on ChatHistory's section titles earlier in
this effort. Android renders these as titles, not as forced-uppercase system captions.

**Verified:** `swift build` + **88 tests, 0 failures** in FarmerChatCore;
`xcodebuild -destination 'generic/platform=iOS Simulator' build` → BUILD SUCCEEDED for
FarmerChatSwiftUI and FarmerChatUIKit.

### Parity obligation from this pass (root CLAUDE.md §4)

The *technique* fix is iOS-only: `.lineSpacing` being additive leading is a SwiftUI quirk with no
analogue elsewhere. But the ~24 **slot corrections** are not iOS-specific, and the systemic
one-step-smaller substitution found earlier in this effort was "ported four times", so each
platform was checked:

| Platform | Line-height layer | Per-script tables | Verdict |
|---|---|---|---|
| android | Compose `lineHeight` per slot, six `typographyForLanguage` tables | ✅ | correct — the reference |
| ios | **was absent; fixed this pass** | ✅ all six ported | fixed |
| react-native | ✅ `style(size, lineHeight, weight)`, full scale matching the app's roman table exactly (`theme.ts:304-325`) | ❌ **roman only** | narrow gap, below |
| web | ❌ **no named type scale at all** | ❌ | real gap, below |

React Native is correct by construction: RN's `lineHeight` is a *total line box* like Compose, so
no leading arithmetic is needed and its 13 slots carry Android's exact size/lineHeight pairs. Its
one gap is that only the **roman** table exists — `typographyForLanguage` is not ported, so a
Devanagari or Kannada farmer gets roman leading. Narrower than iOS's was (the slots themselves are
right), and it is a table-addition, not a formula change. **NOT IMPLEMENTED.**

Web is the larger gap. `web/.../src/ui/theme.ts` has **no named type scale**: sizes are literal
per-class `font-size` declarations inside a CSS template literal, and there is a single blanket
`line-height: 1.45` at `theme.ts:76` with almost no per-element override. Android's ratios are not
constant — `bodyLarge` is 27/19 = 1.42, `titleMedium` 24/18 = 1.33, `labelSmall` 18/13 = 1.38 — so
one blanket value is wrong for every slot, mostly too airy. The sizes are off-scale too, in the
same one-step-smaller direction found everywhere else. Spot checks against Android:

| web class | web | Android slot | Android |
|---|---|---|---|
| `.fcsdk-feedheader` (`theme.ts:238`) | 16/700 | `titleMedium` | 18/24/700 |
| `.fcsdk-card-title` (`theme.ts:255`) | 16/700 | `titleMedium` | 18/24/700 |
| `.fcsdk-card-statement` (`theme.ts:256`) | 15/400 | `bodyMedium` | 17/25/400 |
| `.fcsdk-fullmsg-title` (`theme.ts:217`) | 24/800 | `displaySmall` | 24/32/700 — weight overshoots |
| `.fcsdk-greeting` (`theme.ts:237`) | 21/800 | `titleMedium` | 18/24/700 |
| `.fcsdk-chip` (`theme.ts:245`) | 14/600 | `labelMedium` | 15/20/600 |

The fix is the same shape as the iOS one — declare the 13 slots (plus the six per-script line-height
sets) as CSS custom properties and reference them per class, rather than repeating literals — but it
is a full platform pass rather than a follow-on, so it is recorded here rather than half-done.
**NOT IMPLEMENTED on web.**

### Language changes now rebuild the type scale (iOS)

Found while verifying the above and worth calling out, because it would have made the per-script
tables dead code on the one path that matters most.

`FCTheme.theme(for:appearance:)` resolves the script from `prefs.string(.selectedLanguageCode)`,
but `UserDefaults` is outside SwiftUI's observation graph. `FarmerChatView` already carried an
`appearanceTick` — evidence that whoever wrote it had hit this for *appearance* — and had no
equivalent for language. Of the six writers of that key, the ones in `SettingsViewModel` happen to
re-evaluate `body` (it is a `@StateObject` on the view), but `OnboardingViewModel` is created per
screen and observed by nothing above it. Language selection is the **first screen a farmer sees**,
so picking Hindi would have left roman leading in place for the whole rest of onboarding, until the
next launch.

Fixed by publishing the change once at the single choke point every writer already passes through —
`PreferenceStore.setString` now emits `languageDidChange` when, and only when,
`selectedLanguageCode` actually changes value (several paths re-write the same code on session
restore and label reload, and each would otherwise rebuild the theme for nothing).
`FarmerChatView` consumes it with a `languageTick` mirroring the appearance one. This is an iOS
propagation fix, not a behaviour change — android recomposes from `StateFlow` already, and RN/web
re-render from React state — so it carries no parity obligation.

**Verified:** `swift build` in FarmerChatCore + `xcodebuild … 'generic/platform=iOS Simulator' build`
for FarmerChatSwiftUI and FarmerChatUIKit → all succeed.

### PARITY.md's "approximations, not ports" list, worked through (2026-09-09)

The reference iOS app's `PARITY.md:356-388` lists seven components that "rendered plausibly and
so survived earlier screenshot diffs, but were not built from the Kotlin". Each was checked
against the SDK. Five were real gaps here too; one was already correct; one was correct on one
card and wrong on the other.

**1. `SingleSelectCard` — the explicit-Confirm machine was missing (functional, not cosmetic).**
`FCSingleSelectCard` committed on option TAP: `action: { selectedId = option.id; onSubmit(option) }`.
Android always requires an explicit Confirm, and re-tapping the selected radio *clears* it
(Cards.kt:492) — so a farmer who mis-tapped on iOS could not change their mind and the answer was
already sent. Ported the whole `Selecting → Saving → Feedback → Dismissed` machine: 1000ms to
Feedback (notifying the parent so the section can leave the feed), 3000ms to Dismissed, checkmark
first with the text 150ms behind it, and Compose's bouncy spring mapped exactly — Compose's
`spring(DampingRatioMediumBouncy = 0.5, StiffnessLow = 200)` is SwiftUI's
`interpolatingSpring(stiffness: 200, damping: 14.14)`, since damping for unit mass is
`2 · ratio · √stiffness`.

`FCMultiSelectCard` already required an explicit Save, so PARITY.md's tap-commits finding was
**half** true of the SDK. It was missing everything after the tap, though, plus two other things:
its options were capsule chips in a `LazyVGrid` where Android uses full-width selectable rows
(Form.kt:352 — the control carries its state in the fill and border, and has no tick glyph at
all), and it had no **"none of the above" mutual exclusion** (Cards.kt:705-735: picking it clears
everything else, and picking anything else clears it).

The machine is written **once**, as `FCSelectCardShell`, with the two cards differing only in how
they render options. Android implements it twice with identical timings; one copy is the same
reasoning that moved the type scale into Core.

**2. `MarkdownText` — no block handling at all.** The SDK parsed answers with
`AttributedString(markdown:)` using `.inlineOnlyPreservingWhitespace`, which handles inline
emphasis and deliberately ignores every block construct. So `# Heading` rendered as the literal
string "# Heading" at body size, `- item` as "- item" with no dot and no hanging indent, `1. item`
with the marker inline, `---` as three hyphens, and a GFM table as raw pipe text. Answers are the
primary product surface, so this was the largest remaining gap.

Now parses into typed blocks (header/paragraph/bullet/numbered/divider/table) and renders each as
Android does, including Compose's **per-block-pair spacing table**, which is not uniform:
dividers and headers take 24pt, a block after a header 20pt, tables 16pt, consecutive list items
tighten to **5pt**, and consecutive paragraphs open to **20pt**. Bullets get a real 5pt dot at a
10pt top offset with a 10pt gap so the text hangs. Headers map `#`/`##`/`###` onto
`titleLarge`/`titleMedium`/`titleSmall`, clamped at three levels. Tables carry per-column
alignment from the separator row, alternating row fills, and go horizontally scrollable at 3+
columns. Inline emphasis is still delegated to `AttributedString(markdown:)` per block, which is
correct once the block markers are stripped.

This also collapsed a real drift: `FCMarkdownTextColored`, the streaming-reveal variant, was a
near-copy that had already diverged — only one of the two read the theme, and only one honoured
`config.messageFontSize`. So a host setting that knob watched the answer resize as it streamed and
snap back when it settled. One component now, with the knob applied at every text-bearing block as
docs/04 requires.

**3. `LogoSpinner` — stroke, spacing, label slot and the shimmer.** Geometry was already 55/32 and
40/23, but the stroke was 3 for both layouts where Android's horizontal is **2.5**
(LogoSpinner.kt:101), and the vertical stack was 16pt where Android is 12pt. The label was
`labelLarge`; the general spinner uses `SpinnerLabelText` → **`labelMedium`**. (`labelLarge` at
LogoSpinner.kt:249 belongs to `LogoSpinnerVertical`, a *separate* full-screen loader with its own
error state and retry — an earlier batch in this pass cited :249 for this component and was
wrong.) And the horizontal variant shimmers its label while the vertical one does not; the SDK had
no `ShimmerText` at all, so **4. `ShimmerText`** is newly ported alongside it — Android's exact
gradient (stops at 0/0.35/0.65/1, a band 1.2× the text width travelling its own width plus the
band, 1200ms linear). Android disables the sweep on low-RAM devices; iOS has no `isLowRamDevice`,
so **Reduce Motion** takes that role, which is the platform's own reason to drop a looping
animation.

**5. `FullScreenMessage` — geometry.** `displaySmall` was fixed in an earlier batch; the rest was
not. CTA height 54 → **64** (FullScreenMessage.kt:167), CTA inset 24 → **20** with an 8pt bottom
gap (kt:152-153), text column inset 32 → **28** with 10pt internal spacing and a 28pt gap above
the CTA (kt:120-144), illustration to a 16pt vertical inset, secondary CTA from a fixed 48pt row to
a 12pt-padded text link (kt:184), and the app-bar glow from an 84pt circle to Android's **80pt**
in-bar extent (AppBars.kt:192). The primary CTA's label was `bodyMedium` and is now `labelLarge`,
because Android routes it through `PrimaryButton` (Buttons.kt:110) — `bodyMedium` at
FullScreenMessage.kt:59 is the **subtitle** parameter default, which an earlier batch in this pass
misread as the CTA's.

**6. Settings / Help rows.** `FCListCard` had an 18pt radius and no inset; Android's is
**Radius.MD (12pt)** and the card owns a 16pt horizontal inset with a 6/4 top/bottom
(Lists.kt:47-54). `FCListItem` used a uniform 13pt vertical padding inside *its own* 16pt
horizontal inset, so rows drifted taller than Android's **fixed 48pt** and text sat 32pt from the
card edge instead of 16 (Lists.kt:81-89 — 48pt fixed when single-line, 12pt vertical only when the
row wraps).

**7. `SsfrCard` — crop buttons.** Exactly as PARITY.md describes: a pale `surfaceActive` chip with
an SF symbol and no trailing affordance, where Android's is a solid green `buttonPrimarySurface`
pill with the crop **emoji** (🌾 / 🌽), a semibold `labelMedium` label, and a 20pt chevron in
`buttonPrimaryAccent` (Cards.kt:848-889). Height 46 → 44, radius 14 → 12, insets 10/8. The card
also gained the **description** line it never had, and its title moved from `titleMedium` to
Android's bold `bodyMedium` with 4pt row spacing.

While fixing it, four **invented label keys** surfaced on this card — `ssfr_title`,
`ssfr_description`, `ssfr_wheat`, `ssfr_maize`. Endpoint #3 serves only `fc_v2_app_label_*`, so
every farmer read the English fallback regardless of language. Corrected to the real keys
(Labels.kt:326-329): `fc_v2_app_label_ssfr_advisory`, `..._ssfr_advisory_description`,
`..._ssfr_wheat`, `..._ssfr_maize`, with Android's own English fallbacks. One of those four was
mine — added minutes earlier in this same edit — which is exactly the failure mode the
invented-keys table in this document exists to catch.

### The chat thread had no scroll affordance at all

Same defect class as the compose fix earlier in this effort, and worse here. `FCScrollToBottomButton`
existed but was **never rendered anywhere** — dead code. With the streaming auto-scroll correctly
absent (the thread must stay still while an answer grows), an answer that ran past the fold had
nothing to say so and nothing to tap.

Ported `ScrollIndicator` (Feed.kt:192-250) with Android's exact timeline: 1500ms wait, fade in over
200ms, 300ms settle, three bounces of 280ms down / 320ms up with a 150ms gap, 400ms, fade out over
300ms; a 40pt `surfaceReadingSecondary` circle with a 20pt arrow, bottom-centre at a 12pt inset,
re-triggered per answer id.

The measurement needed a layout change. `LazyVStack` **cannot** answer "how much is below the
fold": it does not measure what it has not realised, so a trailing marker's geometry is stale
forever once it drops off screen — the reference app tried exactly that twice (`PARITY.md:598`,
including a `GeometryReader` on the stack's own background, which reports the *visible* extent, not
the content height). Compose gets away with a `LazyColumn` because `layoutInfo` knows about
unrealised items; SwiftUI on iOS 17 has no equivalent (`onScrollGeometryChange` is iOS 18). So the
thread is now a plain **`VStack`** — one conversation is a handful of rows, laziness bought nothing,
and with every row realised the marker's `minY − viewportHeight` is exactly the `hiddenBelow`
Compose computes. Gate: a last AI answer exists, not loading, and `hiddenBelow >= 48` (Android's
2 × 24dp threshold).

Compose additionally suppresses the indicator when the last answer fits inside its reserved
viewport, because everything under the text is then empty reserved space. **iOS has no chat reserve
at all** — the "last response reserves a viewport so the question stays pinned" behaviour is absent
— so that clause has nothing to guard against here, and the simpler rule is correct rather than a
shortcut. The missing reserve itself is a separate gap, recorded below.

**Verified:** `swift build` + **88 tests, 0 failures** in FarmerChatCore;
`xcodebuild -destination 'generic/platform=iOS Simulator' build` → BUILD SUCCEEDED for
FarmerChatSwiftUI and FarmerChatUIKit.

### Still open on iOS after this pass

- **No chat reserve.** Android reserves a viewport of height for the last response so the question
  stays pinned while the answer streams (`farmerchat-core/ui/chat/ChatReserve.kt` + the compose
  `viewportSize` reserve). iOS Core has no equivalent, so the iOS thread simply scrolls. This is a
  behavioural port, not a geometry fix, and it is the largest single remaining iOS gap.
- **UIKit's select cards** were not touched — the confirm machine, checkbox rows and
  none-of-the-above exclusion are SwiftUI-only so far. `FarmerChatUIKit` also has no markdown block
  renderer and no scroll indicator.
- The six uncited text elements and the remaining multi-line `UILabel` leading, both in docs/05.

### Open on iOS — found, not fixed

- **51 text call sites remain** (see the classified count below). For calibration the app itself
  is only partly migrated — 133 `fcTextStyle` against 45 remaining raw — so full migration is not
  the bar. The largest remaining groups are `CoreComponents.swift` (11), `DrawerView.swift` (8),
  `ChatView.swift` (7) and `AgenticComponents.swift` (6).

### Chat + Home batch — 24 further call sites, and two structural findings

Chat and Home were taken next because that is where multi-line text dominates, so it is where a
missing leading layer is most visible.

| iOS site | was | now | Android source |
|---|---|---|---|
| ChatComponents:16,21 AI answer (`FCMarkdownText`) | 16 | `bodyMedium` | MarkdownText.kt:168 via AiAnswer.kt:128 |
| ChatComponents:134,139 answer reveal | `messageFontSize ?? 16` | `bodyMedium(atSize:)`, default 17 | same slot, host override preserved |
| ChatComponents:165 farmer's own bubble | `messageFontSize ?? 16` | `bodyMedium(atSize:)`, default 17 | UserChatBubble.kt:116 |
| ChatComponents:400,477 action labels | 15/semibold | `labelMedium` | size+weight already right, gains leading |
| ChatComponents:443 | 13/semibold | `labelSmall` | as above |
| ChatComponents:559 chip label | 14/medium | `labelMedium` | Chip.kt:126 |
| ChatComponents:611,617 ShareCard wordmark/question | 18/bold, 16/semibold | `titleMedium`, `titleSmall` | ChatScreen.kt:1783,1791 |
| ChatComponents:710,713 location bubble | `fontSize` | `bodyMedium(atSize:)` | LocationChatBubble.kt:98,103 |
| HomeComponents:32 capability chip | 14/semibold | `labelMedium` | Chip.kt:126 |
| HomeComponents:91 feed header | 18/bold | `titleMedium` | SectionHeader.kt:60 |
| HomeComponents:126,131 feed error + retry | 16, 16/semibold | `bodyLarge`, `bodyMedium` | Feed.kt:155,184 |
| HomeComponents:165,216,262,339 card titles | 17/semibold | `titleMedium` | Feed.kt:72,117 |
| HomeComponents:313 option row | 14/medium | `bodyMedium` | Cards.kt:930 |
| HomeComponents:355 | 15/semibold | `labelMedium` | Chip.kt:126 |
| HomeComponents:387 composer field | 17 | `bodyLarge` | UserInput.kt:793,816 |

**Correction — the answer body is `bodyMedium` (17/25), not `bodyLarge`.** A first pass through
this section recorded `bodyLarge` (19/27) on the strength of `PARITY.md:343`. That was a misread
of the table: its columns are *Before | After*, so "body at 19pt/27 pitch" was the iOS **app's own
buggy before-state**, and the after-column's "**bodyMedium**, pitch 25.0 vs **25.14**" gives
Android's real value as 25.14 — i.e. `bodyMedium`. The primary source settles it:
`MarkdownText.kt:168,188,202,207` styles paragraphs, bullets and numbered items at
`type.bodyMedium`, and `AiAnswer.kt:128` routes the answer through `MarkdownText`. The code and the
table above were corrected; the answer body was 16 → 17, so the size error was 1 pt and the
**leading** is the substantive fix.

Hosts that set `config.messageFontSize` keep their intent and now get script-correct leading: a
host asking for 22 pt against a 17/25 spec is exactly `typeScale: 22/17`, so `bodyMedium(atSize:)`
reuses the ordinary resolver rather than inventing a second formula. That matters because the
line-height *ratio* differs per script — roman `bodyMedium` is 17/25 but kannada is 17/26 — and a
host point size must not flatten it. The theme's own `typeScale` still composes on top:
`messageFontSize` replaces the slot's spec size, it does not opt out of the host's global
multiplier.

Two things surfaced that were not typography at all:

1. **`FCShareCard` inherited no theme.** It is built by `ImageRenderer`, which constructs its
   content *outside* the view hierarchy, so `@Environment` reaches it with default values only.
   The card previously used hardcoded `.white`, so the gap was invisible; naming a typography slot
   exposed it as a compile error. `FCShareCardRenderer.render` now takes a theme and injects it,
   matching what the app does and documents for the same reason (`ShareCard.swift:130`). Without
   this, a shared image would silently use the roman scale at `typeScale` 1.0 regardless of the
   farmer's language or the host's theme — including the host's colors, once any are read.
2. **`FCMarkdownTextColored` had no theme** either — the reveal path's private variant of
   `FCMarkdownText`. It is the component that renders a *streaming* answer, so it is the one a
   farmer actually watches; it now resolves from the theme like its sibling.

**Verified:** `xcodebuild -scheme FarmerChatSwiftUI -destination 'generic/platform=iOS Simulator' build`
→ BUILD SUCCEEDED. 50 text call sites migrated in total across both batches.

### Counting the remaining sites honestly

An earlier draft of this section reported "118 raw `.system(size:)` sites remain" as debt. That
number is wrong as a target, because most of what it counted should never be migrated:

| Category | Count | Disposition |
|---|---|---|
| Text | **51** | genuine remaining debt |
| `Image(systemName:)` glyph sizes | 37 | **correct as raw — do not migrate** |
| `design: .monospaced` | 3 | **must stay raw** |
| Inside the theme files themselves | 3 | correct by definition |

Icons are the important one: Compose sizes icons with `Modifier.size(dp)`, which does **not**
track font scale, whereas `sp` does. Leaving iOS glyph sizes on `.system(size:)` is therefore the
parity-correct choice, not an omission — migrating them would make icons grow with `typeScale`
where Android's do not. The monospaced sites are the voice-clip duration
(`ChatComponents.swift:226`) and the recording timer (`HomeComponents.swift:448`); `FCTextStyle`
builds `.system(size:weight:)` only, so migrating them would swap to proportional digits and make
a live countdown jitter. Both are single-line, so no leading is lost by leaving them.
- **`FarmerChatUIKit` has 46 `UIFont.systemFont` sites of its own** and likewise no line-height
  handling. The typography layer currently lives in the SwiftUI package; sharing it with UIKit
  would mean moving it to Core (which already imports SwiftUI for `FarmerChatTheme.logo`).
  NOT IMPLEMENTED.
- **AuthView:103** country code at 17/`medium` — off-scale weight (`labelLarge` is 17/semibold);
  left alone rather than guessed. Single-line, so no leading is lost.
- **`SettingsViews:309` "Try again"** was mapped to `labelMedium` as the nearest slot; Android
  renders this as a `PrimaryButton`, not a text link, so the structural difference outlives the
  type fix.
- PARITY.md's "components that were approximations, not ports" list is **not yet worked through**
  against the SDK: `MarkdownText`, the `SingleSelect`/`MultiSelectCard` explicit-Confirm machine,
  `LogoSpinner` geometry (55/32/3 vertical, 40/23/2.5 horizontal), `FullScreenMessage`
  (`displaySmall` headline, 64 pt CTA, 20 pt insets), Settings/Help `ListCard` rows (12 pt radius,
  fixed 48 pt row), and the suppressed scroll affordances at `PARITY.md:598` — that last one being
  the same defect class already fixed on compose in this effort.

---

## App delta `193dbd64` → `cbfdcff8` (11 commits, 9 dated 2026-09-15) — ported 2026-09-16

Source: `/Users/Aiyappa/AndroidStudioProjects/fc-compose-agentic`, 14 files, 122 insertions.
Four categories: button/footer geometry, one copy string, two chat-thread changes, and a Home
feed caching optimisation. Android `Radius.Rounded` is `999.dp` (a pill), `Radius.MD` is `12.dp`.

### Ported — geometry

| App change | android compose | android views | ios | react-native | web |
|---|---|---|---|---|---|
| `PrimaryButton` radius `MD` → `Rounded` | ✅ `FcShapes.button` (HostTheme.kt:129,134) | ✅ `fc_bg_primary_button.xml` 12→999dp | ✅ `FCShapes.button` 12→999 **+ wired up** (see below) | ✅ `Buttons.tsx` `radius.md`→`radius.rounded` | ✅ already `--fc-radius-btn: 999px` |
| `SecondaryButton` shape `MD` → `Rounded` | ✅ `Buttons.kt:194` | ✅ `fc_bg_secondary_button.xml` 12→999dp | ✅ `FCSecondaryButton` via the token | ✅ `styles.secondary` | ✅ shares `--fc-radius-btn` |
| `WeatherButton` height `42`→`44`, radius `MD`→`Rounded` | ✅ `Buttons.kt:337,338` | ✅ `fc_bg_weather_pill.xml` 16→999dp, `fc_view_appbar.xml:114` 42→44dp | 🔴 no weather-button surface | ✅ `styles.weather` (was `radius.lg`) | 🔴 no weather-button surface |
| `HomeAppBar` menu button `MD` → `Rounded` | ✅ `AppBars.kt:210` | ✅ new `fc_bg_appbar_chip_round.xml`, applied in `HomeFragment.kt` | 🔴 not ported | ✅ `Chrome.tsx` menu `ActionButton` | 🔴 not ported |
| `ContentCard` start-chat button `MD` → `Rounded` | ✅ `Cards.kt:236` | 🔴 not ported | 🔴 not ported | ✅ inherits the `PrimaryButton` default | 🔴 not ported |
| `FeedFooter` padding `38/20` → `20/40` | ✅ `Feed.kt:104` | ✅ `fc_item_home_footer.xml` | 🟡 `FCFeedFooter` exists but is a different component (see below) | ✅ `Chrome.tsx` `feedFooterBody` | 🟡 footer exists but is a different component (see below) |
| `Tip` card ground → `Green800`, text → `White` | ✅ `Tips.kt:234,267,273` | ✅ `TipsCarouselView.kt` | 🔴 no tip-carousel surface | 🔴 no tip-carousel surface | 🔴 no tip-carousel surface |

Four notes, because none of these is a literal transcription:

- **`FcShapes.button` looked like the widest-blast-radius change here; it is not.** The only reader
  on android compose is `Buttons.kt:66` (`PrimaryButton`) — enumerated, not assumed — so it moves
  exactly the component the app moved. `input` deliberately stays `Radius.MD`; the app did not
  round inputs.
- **iOS: the same token was dead code, and this pass revived it.** `FCShapes.button` was assigned
  from the host's `buttonCornerRadius` at `FCTheme.swift:231` and read by **nothing** —
  `FCPrimaryButton` and `FCSecondaryButton` both hardcoded `cornerRadius: 12`. Changing the default
  alone would have been a no-op, so both buttons were pointed at `theme.shapes.button`. That ports
  the app change *and* fixes a silently dead public theming option. iOS inputs/cards (`FCTextField`,
  `FCOtpInput`, `FCRadioRow`, `FCListCard`) still hardcode 12 and are untouched, matching the app.
- **The Tip card uses `brandColors.surfaceSecondary` on compose, not a literal `Green800`.** That
  token resolves to `Green800` in both light and dark whenever a host supplies no
  `brandPrimaryDark` (`HostTheme.kt:48`), so the default is identical to the app while a themed
  host still gets its own brand. Views has no brand-token accessor in `FcTokens`, so it uses
  `@color/fc_green800` — the idiom its own `fc_bg_appbar_chip` / `fc_bg_weather_pill` already use.
- **Views needed a NEW drawable for the menu button rather than an edit.** `fc_bg_appbar_chip` is
  shared by the chat / settings / language / full-screen-message app bars' back and close buttons,
  which the app did **not** round. `fc_bg_appbar_chip_round.xml` is applied only on the Home app
  bar, in `HomeFragment`.

The app's old footer padding was `38/20`; compose and views were both on `44/56` and RN on `44/56`
— all three had **already** diverged before this pass, with no docs/04 row recording it. All are
now `20/40`, so the drift is closed rather than overwritten.

### Ported — copy

`RELATED_QUESTIONS` English fallback `"Related questions"` → `"You can also ask"`, on all five
packages: compose `ChatScreen.kt:1314` (+ a stale KDoc at :1563), views `ChatAdapter.kt:547`, ios
`ChatView.swift:268`, react-native `ChatScreen.tsx:1125`, web `ChatScreen.tsx:503`. The label
**key** is unchanged, so a server-supplied string still wins where the key resolves at all — see
the iOS/RN/web key finding in docs/05.

### NOT ported — recorded, not silently dropped

**1. The commented-out "Ask a follow-up question 👇" prompt.**
`ChatResponseActions.kt:246-250` wraps the prompt in `/* … */` rather than deleting it, and the doc
comments describing it (lines 67, 200) still present it as live — the marks of a provisional
working-tree edit, not a decision. Moot regardless: **the SDK never had this prompt on any
platform**, so the app moved toward the SDK. No code change, no gap.

**2. The `LocationMessage` scroll anchor.** The app added an invisible `anchor-<id>` item before
each shared-location bubble, a `lastSeenLastLocationMessageId` / `hasScannedInitialMessages` pair,
and a `findAnchorIndex` rewrite counting `LocationMessage` as 2 items, so a newly shared GPS
location scrolls to the top like a typed follow-up while reopening an old conversation does not.

**The SDK already has this behaviour by a more general mechanism**, so there is nothing to port.
Its anchor is positional (`core/ui/chat/ChatReserve.kt.chatScrollAnchorIndex`), not keyed on marker
items. After a GPS share the thread is either `[…, LocationMessage]` — the last row is not a
reserve holder, so the anchor is `lastIndex`, the location bubble — or
`[…, LocationMessage, LoadingPlaceholder]` — the placeholder holds space, so the anchor is
`lastIndex - 1`, again the location bubble. The app needed a special case only because its anchors
are explicit items that existed for `UserMessage` alone. `hasScannedInitialMessages` is covered by
the compose effect's `isHistoryEntry || initialScrollDone` guard and the views fragment's
equivalent.

**3. `HomeScreen` guest/non-guest branching removal — already converged, with one deliberate
difference.** The app collapsed a guest branch so all four Home-entry actions now fire
unconditionally. The SDK's Home effect (`HomeScreen.kt:355-379`) already fires all four with no
guest branch, so there is nothing to port. The one difference is deliberate: the SDK passes
`userId = if (isAuthenticated) userId else null`, which is the app's *old* guest handling, where
the app now passes a blank/`"null"` string for guests. The SDK's null is the safer contract and is
kept.

**4. Home feed caching (`AppConstants.IS_PROFILE_LOADED`) — deliberately NOT ported.**
The app added: `loadHome` serves `CACHED_HOME_FEED_RESPONSE` and returns without calling the API
when the flag is false (falling back to `UiState.Error("No cached data available")` with no cache);
`fetchUserProfile` returns early on the same condition; the flag is set true after a successful
`update_user_location` (3 sites) and language change (2 sites).

Read the whole flag, not just the diff: it is declared `var IS_PROFILE_LOADED = true` and is a
*"the home feed is stale, refetch"* dirty flag despite the name. Its only `= false` write is at the
end of a successful `fetchUserProfile`; five sites set it true.

Three concrete reasons it has no SDK shape:

- **The `= false` write site does not exist in the SDK.** It sits inside the `UserAttributeTracker`
  block (Plotline / MoEngage), which root CLAUDE.md §6 forbids in SDK packages.
- **Three of the five `= true` sites are app shell** — `MainActivity.onResume`, `SplashScreen`,
  `AuthViewModel.verifyOtp`. The SDK has no guaranteed Activity resume or splash across
  `CHAT_ONLY` / embedded modes, so the flag would latch false and Home would serve a frozen cache
  for the life of the process.
- **The SDK has no cache writer.** `CACHED_HOME_FEED_RESPONSE` is declared at
  `SdkPreferences.kt:100` and is read and written by nothing, so porting the read means inventing
  the write too.

The failure mode if the flag latches is a hard `UiState.Error` screen traded for a performance
optimisation — not a trade the SDK should make on a host's behalf. The pref key is now annotated
in place as RESERVED so it does not read as half-wired. If this is wanted later it needs a
deliberate SDK design (an explicit `FarmerChat.invalidateHomeCache()`, or a pref-backed flag with
an SDK-owned lifecycle), not a transcription.

### Found while checking — genuine defects, not app-delta items

**A. Chat auto-scroll anchored one row too high on paginated history (compose) — FIXED.**

The app's `findAnchorIndex` commit is really about one invariant: *keep index arithmetic in step
with the items the list actually emits.* The SDK's version of that invariant was broken.

`core`'s `chatScrollAnchorIndex()` returns an index into `state.messages`, but compose passed it
straight to `listState.animateScrollToItem()`, which wants a **LazyColumn item index**. The list
emits a leading `history_loading_top` spinner when `isHistoryEntry && historyNextPage != null` — a
condition the auto-scroll effect's guard does **not** exclude (it only rules out
`prependOldCount != null` and a pre-initial-scroll history entry). So asking a follow-up inside a
paginated history conversation anchored one row too high, for the whole stream.

Fixed at `ChatScreen.kt:449` with a named `leadingItemCount` offset, keeping core on message
indices and the translation in the flavour that owns the item layout — the split `ChatReserve.kt`
already states for the reserve height. Verified the offset is sufficient: inside the message loop
the four message types (`LocationMessage`, `UserMessage`, `AiResponse`, `LoadingPlaceholder`) emit
exactly one `item` each in mutually exclusive branches, so message-index → item-index is a constant
shift, not a walk. Trailing `inline_error` / `followups` need no handling.

**Views is not affected and needed no change**: `ChatFragment` derives its anchor from
`adapter.rows.lastIndex`, already an item index. The two flavours have not drifted.

**B. iOS `buttonCornerRadius` was dead — FIXED** as part of the geometry port above.

**C. iOS/RN/web label keys do not match the server's — found, NOT fixed.** See docs/05.

### Verification (actually run, 2026-09-16)

| Check | Result |
|---|---|
| `./gradlew :farmerchat-core:compileDebugKotlin :farmerchat-android-compose:compileDebugKotlin` | **BUILD SUCCESSFUL**; all warnings pre-existing, none in touched files |
| `./gradlew :farmerchat-android-views:assembleDebug` | **BUILD SUCCESSFUL** (resources + Kotlin) |
| `./gradlew :farmerchat-core:testDebugUnitTest` | SUCCESSFUL — **up-to-date, not a fresh run**: this pass changed no core logic, only a KDoc on a pref key |
| `swift build` + `swift test` (FarmerChatCore) | **Build complete; 88 tests, 0 failures** |
| `xcodebuild -scheme FarmerChatSwiftUI -destination 'generic/platform=iOS Simulator' build` | **BUILD SUCCEEDED** |
| `xcodebuild -scheme FarmerChatUIKit -destination 'generic/platform=iOS Simulator' build` | **BUILD SUCCEEDED** |
| `npx tsc --noEmit` (farmerchat-react-native) | **clean** |
| `npx tsc --noEmit` + `npx vite build` (farmerchat-web) | **clean; built in 244ms** |

### Correction + a bigger finding: the feed footer is a different component on every platform

The row above was first written claiming ios and web had "no feed-footer surface". That was wrong —
both have one (`FCFeedFooter` at `HomeComponents.swift:98`; `.fcsdk-feedfooter` at web
`HomeScreen.tsx:430`). Corrected above. Checking it properly surfaced that **no platform matches
the app's footer**, and the padding ported in this pass is the only part that now agrees:

| | icon | text | label key |
|---|---|---|---|
| app `FeedFooter.kt` | `👋🏾` at 40sp, fade-in on scroll-into-view + 3× wave about the wrist | "Have a great day,\ncome back tomorrow" | canonical |
| compose | `fc_logo_mark` 34dp + a `Glow` the app does not have; no animation | ✅ same text | ✅ canonical |
| views | `fc_logo_mark` 34dp; no animation | ✅ same text | ✅ canonical |
| react-native | `LogoMark` 34 + `Glow`; no animation | ✅ same text | ✅ canonical |
| ios | `FCLogoMark` 28 | ❌ **"You're all caught up for today"** | ❌ `feed_footer` (invented) |
| web | none | ❌ **"That's all for today. Ask me anything!"** | ❌ `home_feed_footer` (invented) |

So three separate divergences sit in one small component: the emoji→logo substitution plus the
added `Glow` (all four non-app platforms), the missing wave/fade animation (all four), and
fabricated copy on ios and web. None was recorded anywhere before this pass.

This is not isolated. Measuring it across the whole surface found that **80% of iOS label keys,
96% of web's, and 100% of react-native's raw-string call sites are invented** — they have no
counterpart among the 261 canonical `fc_v2_app_label_*` keys, so those platforms cannot resolve a
server translation and in places render copy that appears nowhere in the app. Full measurement,
root cause and remediation options are in
`docs/05-open-questions.md` §"iOS / react-native / web do not use the app's label keys OR its
copy". **That is a larger and more user-visible gap than anything in this app-delta pass**, and it
is not fixed here.

**Not verified on a device or in a browser.** Every change in this pass is geometry, colour or
copy; a compile cannot show that a pill radius, the new footer padding or the dark-green tip card
looks right. Highest-value things to eyeball: the tip card in dark mode (compose uses a brand token
where views uses a literal, so they can diverge under a host theme), and the iOS buttons, which
changed radius for the first time now that the token is actually read.

---

## iOS label-key remediation (2026-09-16)

Follow-on from the finding recorded in the previous section. Scope: iOS only — react-native and
web are unchanged and still carry the same defect.

| | before | after |
|---|---|---|
| label call sites (SwiftUI `fcLabel` + UIKit `fcuiLabel` + direct `labels.label`) | 333 | 333 |
| **actually resolving a real server key** | **13** | **225** |
| passing a key the server does not serve | 320 | **108** |
| canonical constants table | none | `FCLabels`, 263 keys, 1:1 with Android `Labels.kt` |

The earlier measurement said 166 iOS sites; that counted only SwiftUI's `fcLabel` and missed
UIKit's separate `fcuiLabel` helper (114) plus 51 direct `labels.label(` calls. The real figure
was 333.

**Method** (reusable for react-native and web): build `key → English copy` from the app plus the
Android SDK, classify every iOS site as (A) already-canonical-or-prefix-only, (B) matchable to a
canonical key by its English copy, or (C) no counterpart. Apply A and B mechanically, leave C.
The rewrite is verified by re-running the classifier: A and B must both be 0 afterwards and C must
be unchanged — a key-string edit compiles either way, so the count is the only real assertion.

Note the before-figure: only **13 of 333** sites resolved against the server. Bucket A was
"already-canonical **or** needs only the prefix", and 84 of its 97 sites were bare keys that never
resolved. iOS was ~96% broken, not ~70%.

**Also corrected in the same edit:** 12 English fallbacks that differed from the app's exact copy
(§2) — e.g. `"Log out"` → `"Logout"`, `"Save your questions and answers"` → `"Save your past
questions"`. These change rendered text.

A first pass over-corrected 19 further sites across 4 keys (`getting_your_location`,
`privacy_policy`, `recent_chats`, `terms_of_use`) where the app uses **several** spellings and the
script took the alphabetically-first. Where iOS's existing string was already one of the app's own
variants it is now left alone — changing `"Privacy policy"` to `"Privacy Policy"` is churn, not
parity.

**Breaking for iOS hosts:** `stringOverrides` must now be keyed on `FCLabels` values. Recorded in
`ios/README.md` under "Label keys — BREAKING CHANGE", whose own example had been demonstrating the
broken bare-key pattern (`"chat_title"`, which is not a canonical key).

**Not done:** bucket C — 108 sites / 66 keys with no backend counterpart, listed in docs/05 with
the three options. react-native (89 raw-string keys) and web (164) are untouched.

### Verification (actually run, 2026-09-16)

| Check | Result |
|---|---|
| classifier re-run after rewrite | **A=0, B=0, C=108 (unchanged)**; 225 sites on `FCLabels` |
| `swift build` + `swift test` (FarmerChatCore) | **Build complete; 88 tests, 0 failures** |
| `xcodebuild -scheme FarmerChatSwiftUI -destination 'generic/platform=iOS Simulator' build` | **BUILD SUCCEEDED** |
| `xcodebuild -scheme FarmerChatUIKit -destination 'generic/platform=iOS Simulator' build` | **BUILD SUCCEEDED** |

**Not verified on a device.** A compile cannot show that a key now resolves. The decisive check is
to run the SDK in a non-English language and confirm screens render translated text where they
previously rendered English — that has never been demonstrated on iOS and remains the open
question in docs/05.

---

## Config-parity audit (2026-09-16) — "is every feature available and configurable on all platforms?"

Screens are not the problem. All 17 screens in docs/01 §3 exist on all six packages (UIKit lacks a
distinct Profile and LegalContent surface; everything else is present everywhere). The gaps are
**inside** the screens and in the config surface.

Root CLAUDE.md §3: "Public API (`FarmerChatConfig` fields) is shared across all six packages.
Renaming or removing anything requires updating docs/03 + all platforms in the same change."
Measured against Android's 53 fields, that rule is currently broken in both directions.

### Fields that exist on Android and nowhere else

| field | android | ios | react-native | web |
|---|---|---|---|---|
| `showNameScreen` | ✅ honored (`FarmerChatGraph.kt:293` → `RouteDecider.kt:90`) | ❌ absent | ❌ absent | ❌ absent |
| `enableAnalytics` | ✅ 2 sites | ❌ absent | ❌ absent | ❌ absent |
| `debugLogging` | ✅ 1 site | ❌ absent | ❌ absent | ❌ absent |

`showNameScreen` is the notable one: iOS `SplashRouter.swift:8`, RN `AppNavigator.ts:88` and web
`router.ts:84` each carry a comment saying the SDK has no Remote Config equivalent and the name
screen simply always shows. So a host that suppresses the name step on Android cannot on the other
three.

### Fields declared on Android but consumed by NOTHING (dead config)

| field | android | ios | react-native | web |
|---|---|---|---|---|
| `enableVoice` | **🔴 0 consumption sites** | ✅ 4 | ✅ 6 | ✅ 5 |
| `enableImages` | **🔴 0 consumption sites** | ✅ 4 | ✅ 5 | ✅ 5 |

This is a live defect, not a documentation gap. `FarmerChatConfig.enableVoice(false)` /
`.enableImages(false)` are public builder methods that compile, are accepted, and do nothing —
`InputComposer.kt` has no conditional on mic or camera at all. iOS gates both explicitly
(`ChatViewController.swift:296,299`; `HomeCells.swift:52,53`), as do RN and web. A host disabling
voice on Android still ships a mic button to farmers.

Same dead-declaration pattern as the iOS `FCShapes.button` defect fixed earlier today: a public
knob wired to nothing. Worth a standing check — *declared* is not *honored*.

### Correctly shared (spot-checked, consumed on all four)

`showDrawer`, `showHistory`, `showSettings`, `enableWeather`, `enableSsfr`, `enableAgenticChat`,
`authMode`, `mode`, `messageFontSize`/`messageFontSizeSp`, `minSplashDurationMs`.

### Method note

Two earlier passes of this audit produced false zeros and were discarded: one scanned only each
platform's UI directories and missed the gating that lives in `farmerchat-core` (`showNameScreen`,
`enableAgenticChat` both looked dead and are not); another used a `\b`-terminated pattern that
failed on suffixed names (`messageFontSizeSp`, `minSplashDurationMs` both looked dead and are not).
Any re-run must scan core + every UI flavour, and must not assume the field name is identical
across platforms.

### Not measured here

Whether each screen *behaves* like the app's. Screen-file existence says nothing about fidelity,
and today's feed-footer finding (a different component on all five packages, with fabricated copy
on two) shows the drift lives at that level. There is no systematic app-vs-SDK behavioural audit
for any platform, and the 2026-07-20 fidelity passes for ios/react-native were measured against
the Compose SDK module rather than the app — so compose's own drift was never in scope.

---

## Closing the config-parity gaps (2026-09-16)

Acting on the audit in the previous section. Three of the four gaps are closed; the fourth is
deliberately left open with a reason.

### 1. `enableVoice` / `enableImages` now honoured on Android (was a live defect)

Public builder methods that compiled, were accepted, and did nothing. Now gated at every surface,
matching ios `HomeCells.swift:52-53` and `ChatViewController.swift:296,299`:

| surface | file |
|---|---|
| Home Photo / Speak tiles | `compose/components/UserInput.kt` `PrimaryInputButtons` |
| 2.0.0 composer camera + mic | `compose/components/InputComposer.kt` |
| 1.0.0 composer camera + mic | `compose/components/UserInput.kt` `TextInputOverlay` |
| views Home tiles | `views/.../HomeFragment.kt` |
| views Chat tiles | `views/.../ChatFragment.kt` |
| views 2.0.0 composer | `views/.../widgets/InputComposerView.kt` `applyContentState` |

The mic and Send share one button on both composers, so the rule is `hasContent || enableVoice` —
with voice off the button exists only to send, rather than rendering a mic that does nothing.
Consumption count went 0 → 8 on Android.

### 2. `showNameScreen` added to ios / react-native / web

Android alone could suppress the Enter-Name step. Semantics mirror `RouteDecider.kt:90` exactly —
when false, **mark the profile done and fall through**, so a later launch does not re-evaluate:

- ios `Config/FarmerChatConfig.swift` + `Navigation/SplashRouter.swift`
- react-native `core/config.ts` + `ui/navigation/AppNavigator.ts`
- web `core/config.ts` + `ui/router.ts` (threaded through `useNavigator` from `FarmerChatRoot.tsx`)

Default `true` on all three, so no existing host changes behaviour.

### 3. `enableAnalytics` added to ios / react-native / web — **behaviour change**

Previously recorded as a §4 gap (see "ios / react-native / web are untouched by this pass" above).
Closing it because the divergence was user-visible: a host wiring `onEvent` received events on
three platforms and silence on Android, from identical host code.

Gated at the single dispatch point on each platform, mirroring `core/analytics/Analytics.kt` —
events are still constructed with their real names, properties and ordering, and dropped only at
`track()`, so enabling telemetry later cannot change any other behaviour.

**Default is `false`, matching Android.** That means an ios / react-native / web host that wires
`onEvent` and does nothing else **stops receiving events** until it adds `enableAnalytics: true`.
This is the documented contract (docs/04 §"`enableAnalytics` — telemetry off until a host opts
in"), but it is a breaking change for those three platforms and needs calling out in their
READMEs.

### 4. `debugLogging` — deliberately NOT added to ios / react-native / web

Android gates OkHttp's `HttpLoggingInterceptor` level on it (`FarmerChatGraph.kt:130`). The other
three platforms have **no HTTP logger at all**, so adding the field would create exactly the
dead-knob anti-pattern this pass exists to remove — a public switch wired to nothing, which is how
`enableVoice` and iOS's `FCShapes.button` got there. It needs a logger first; the flag is
meaningless without one.

### Verification (actually run, 2026-09-16)

| Check | Result |
|---|---|
| `:farmerchat-core:compileDebugKotlin` + `:farmerchat-android-compose:compileDebugKotlin` + `:farmerchat-android-views:assembleDebug` | **BUILD SUCCESSFUL** |
| `swift build` + `swift test` (FarmerChatCore) | **88 tests, 0 failures** |
| `xcodebuild` FarmerChatSwiftUI / FarmerChatUIKit | **BUILD SUCCEEDED** (both) |
| `npx tsc --noEmit` (react-native) | **clean** |
| `npx tsc --noEmit` + `npx vite build` (web) | **clean** |
| flag-consumption re-audit | `enableVoice`/`enableImages` android 0 → 8; `showNameScreen` and `enableAnalytics` now non-zero on all four |
| `npx vitest run` (web) | **6 files fail with "No test suite found" — PRE-EXISTING**, reproduced identically with these changes stashed. Not investigated further this pass; web has effectively no running test coverage right now, which is itself worth fixing |

**Not device-verified.** Nobody has run a build with `enableVoice(false)` and confirmed the mic is
gone, or with `showNameScreen(false)` on iOS and confirmed the step is skipped. Those are the two
checks that would actually close this out.

---

## PRD "Channels: Mobile SDKs" — what is and is not delivered (2026-09-16)

Audited against the four rows in the requirements table.

| PRD row | Package exists | Feature-complete | **Consumable by a partner today** |
|---|---|---|---|
| Android SDK for Jetpack Compose | ✅ `farmerchat-android-compose` | ✅ all 17 screens | ❌ no published artifact |
| Android SDK for XML Views | ✅ `farmerchat-android-views` | ✅ all 17 screens | ❌ no published artifact |
| iOS SDK for SwiftUI | ✅ `FarmerChatSwiftUI` | ✅ all 17 screens | ❌ no git tag / remote |
| **iOS SDK for Objective-C** | **❌ NOT DELIVERED** | — | ❌ |

### 1. Objective-C is the one genuinely missing channel

`FarmerChatUIKit` is a **UIKit** SDK, which is not the same thing. It is written in Swift and
exposes nothing to Objective-C. Four hard blockers, each verified:

- `FarmerChat` is `public final class`, not `NSObject`-derived — invisible to Objective-C.
- `FarmerChatConfig` is a `public struct`. **Swift structs cannot be exposed to Objective-C at
  all**, so the entire configuration surface is unreachable.
- `FarmerChatEnvironment` / `FarmerChatMode` are `String`-raw-value enums; `@objc` enums must be
  `Int`-backed.
- All 6 `@objc` annotations in the iOS tree are `private` selector handlers for
  `addTarget`/`NSNotification`. None is public API.

Nuance worth keeping: a **mixed** Obj-C/Swift project *can* consume it by adding a Swift bridge
file, which covers part of the PRD's "mixed Objective-C and Swift projects" intent. A **pure**
Objective-C codebase cannot call this SDK from a `.m` file at all.

Closing it means an `@objc` facade in the UIKit package: an `NSObject`-derived `FCFarmerChat`
singleton, an `NSObject` config class mirroring `FarmerChatConfig`, `Int`-backed `@objc` enums, and
closure→block bridging for the callbacks. That is a real piece of work, not an annotation pass.

### 2. "Faster distribution, reach" is not realised for ANY row

The value column on all four rows is distribution, and no channel is currently installable:

- **Android** — `maven-publish` is wired but needs `-PfarmerchatRepoUrl` / `FARMERCHAT_REPO_URL`,
  which is unset. Only `publishToMavenLocal` works, i.e. the author's machine.
- **iOS** — the repo has **0 git tags** and no configured remote. The podspec's
  `s.source` requires tag `ios-v1.0.0`, so `pod install` fails; SPM by URL likewise.
- **react-native / web** — `npm view` returns **E404** for both
  `@digitalgreenorg/farmerchat-react-native` and `@digitalgreenorg/farmerchat-web`.

Everything builds; nothing ships. This is the largest gap against the table's stated benefit and it
is orthogonal to code quality.

### 3. The table omits two channels that exist

React Native and Web SDKs are built and feature-complete but appear in no row of
"Channels: Mobile SDKs". React Native in particular is a mobile channel and covers partners on
neither native stack. Either the table should gain rows for them, or their status should be
recorded deliberately elsewhere.

### 4. "Authentication and farmer context handoff" — auth yes, context partial

Auth handoff is complete: `authMode`, `accessToken`, `refreshToken`, `tokenProvider`, `guestApiKey`.

"Farmer context handoff" is **not defined in docs/01-03** — it is PRD language with no spec. What
exists is geographic seeding (`defaultCountryCode`, `defaultStateCode`, `defaultLatitude`,
`defaultLongitude`); the farmer's identity and profile come from the backend via the token, not
from the host. A partner that already holds farmer records cannot seed name, crops or livestock.
Whether that counts as delivered depends on a definition nobody has written down — it needs one
before it can be called done either way.

---

## Objective-C channel delivered (2026-09-16)

Closes the one PRD row that had no implementation. `FarmerChatUIKit` was a **UIKit** SDK, which is
not the same thing as an Objective-C SDK — it was written in Swift and exposed nothing usable to a
`.m`.

### What was actually reachable before

Measured from the generated `FarmerChatUIKit-Swift.h`, not assumed:

| symbol | before |
|---|---|
| `FarmerChatViewController` | ✅ class + `-init` exposed (inherits `UINavigationController`) — presentation already worked |
| `FarmerChatFabButton` | 🔴 class exposed but **both inits `SWIFT_UNAVAILABLE`** — not instantiable from Obj-C |
| `FarmerChat.initialize` / config / session / auth | 🔴 entirely absent |

So the gap was narrower than "nothing works" and wider than "add `@objc`": presentation worked,
but a host could not configure or initialise the SDK at all, which makes presentation useless.

### Added

- `Sources/FarmerChatUIKit/FarmerChatObjC.swift` — `FCFarmerChat` (`NSObject` facade),
  `FCFarmerChatConfiguration` (`NSObject` mirror of the `FarmerChatConfig` **struct**, which cannot
  be bridged), `FCAuthObservation`, and Int-backed `FCEnvironment` / `FCAppearance` / `FCAuthMode`
  / `FCMode`.
- `Sources/FarmerChatUIKit/FCLabelKeys.swift` — 263 canonical label keys as Obj-C class
  properties. Without this an Obj-C host populating `stringOverrides` would hand-type bare keys and
  reintroduce the exact defect fixed earlier today; overrides match on the canonical key, so a bare
  key silently never applies. `continue` / `auto` are suffixed `Label` (C keywords).
  Every member **references `FCLabels` rather than restating the literal** — a first cut generated
  a second copy of the same 263 strings, which would have drifted the first time a key was added
  to one table and not the other, with nothing to catch it. Now Core is the single source of truth
  and a renamed key fails this file's compilation.
- `Sources/FarmerChatObjCSmoke/` — a compile-only Obj-C target, **not a package product**, so
  consumers never see it and the podspec glob (`Sources/FarmerChatUIKit/**/*.swift`) excludes it.

### Bridging decisions (each forced, not stylistic)

| Swift | Obj-C | reason |
|---|---|---|
| `FarmerChatConfig` struct | `NSObject` class | structs are unbridgeable, full stop |
| String-raw-value enums | Int-backed `@objc` enums | `@objc` enums must be Int-backed |
| `CGFloat?` | `NSNumber *` | no optional scalars in Obj-C; **nil ≠ 0** |
| `Color?` | `UIColor *` | SwiftUI `Color` is not representable |
| `() async -> String?` | block taking a completion block | no `async`. Hops to main to *start* the refresh, and guards a double-call with a **lock**, not a plain `Bool` — the host's completion can return on any queue, so two racing calls could otherwise both resume the continuation, which traps |
| `onError(Int?, String)` | `onError(NSNumber *, NSString *)` | `code ?? 0` would have erased the difference between "no HTTP status" and "status 0" |
| `logout() async` | `+logoutWithCompletion:` | same |
| `AnyPublisher<Bool>` | `+observeAuthState:` → `FCAuthObservation` | Combine is not representable |

### Deliberately NOT bridged (§3 requires these be stated, not dropped silently)

- `theme` (`FarmerChatTheme` struct) — individual colour knobs are bridged; full theming needs a
  one-file Swift bridge on the host side.
- `prefs` / `labels` / `analytics` / `api` / `session` — Swift-only internals, large surface, no
  PRD benefit.
- `pendingChatTarget` / `pendingScreenTarget` Combine subjects — superseded by
  `+openChatWithQuestion:conversationId:`.

### Verification — why the usual builds prove nothing here

`swift build` and `xcodebuild` succeed whether or not a symbol is Obj-C-visible. That is the same
blind spot that hid the dead `FCShapes.button`, the unread `enableVoice` and 96% of iOS label keys.
The assertion that actually discriminates is a `.m` compiled by clang.

| Check | Result |
|---|---|
| Obj-C smoke target (clang, `.m`, exercises every facade member) | **Build complete** |
| **Negative control** — corrupt one `_Static_assert` | **build fails as expected**, so the harness is not a no-op |
| Facade symbols present in generated `FarmerChatUIKit-Swift.h` | ✅ `FCFarmerChat`, `FCFarmerChatConfiguration`, `FCAuthObservation`, `FCLabelKeys`, all four enums with correct raw values |
| `swift build` + `swift test` (FarmerChatCore) | Build complete; **88 tests, 0 failures** |
| `xcodebuild` FarmerChatSwiftUI / FarmerChatUIKit | **BUILD SUCCEEDED** (both) |

The smoke target needs `-Xcc -target … -Xcc -isysroot …` as well as the `-Xswiftc` flags; without
them clang compiles the `.m` against the macOS SDK and fails on `Foundation`. Command is in
`ios/README.md`.

### Status of this PRD row, stated precisely

**"Delivered" here means "provably compiles and links from Objective-C in-tree."** It does NOT mean
a partner has installed it: the repo still has **0 git tags**, and the podspec's `s.source`
requires `ios-v1.0.0`, so `pod install` cannot resolve. The distribution gap recorded in the
previous section is unchanged and still blocks all four PRD rows.

One thing the generated header still shows, correctly: `FarmerChatFabButton`'s own initialisers
remain `SWIFT_UNAVAILABLE` to Objective-C (its designated init has defaulted parameters, which do
not bridge, and `init(coder:)` is explicitly unavailable). That is routed around by the
`+makeFabButton…` factories rather than changed — the class is intentionally not directly
instantiable from a `.m`, so the header output is not a bug.

Also unverified: nobody has run an Objective-C host app against this on a device or simulator. The
facade is compile-proven, not runtime-proven.

---

## Theme Studio / integration-guide alignment (2026-09-17)

Two deliverables shared one root cause: the integration guide existed only as a session-scoped
generator and a published artifact, with nothing in the repo, and the Studio's phone preview had
drifted from the compose screens it claims to mirror.

### Version declarations — one is dead, and it misleads

| Platform | Declared version | Where |
|---|---|---|
| Android (all three artifacts) | **2.0.0** | `versions/v2/android/build.gradle.kts:19` `farmerChatVersion`; every module reads `project.version` |
| iOS | **1.0.0** | `FarmerChatUIKit.podspec` `s.version`; tag `ios-v1.0.0` |
| React Native | **1.0.0** | `packages/farmerchat-react-native/package.json` |
| Web | **1.0.0** | `packages/farmerchat-web/src/core/version.ts` `FARMERCHAT_VERSION` |

`versions/v2/android/gradle.properties:12` still says `VERSION_NAME=1.0.0`. **Nothing reads it** —
no `.kts`, `.kt` or `.gradle` file in the tree references `VERSION_NAME` — and the published POM in
`~/.m2` says `2.0.0`. It is a stale leftover that reads as authoritative. Left in place rather than
edited (out of scope for this change), but recorded here because it cost real time.

Consequence for docs: **never state one global SDK version.** The artifact had claimed
`FarmerChat SDK v2.0.0` in its masthead and pinned iOS at `from: "2.0.0"` / `~> 2.0` /
`ios-v2.0.0` — all three unresolvable. Corrected to 1.0.0 / `~> 1.0` / `ios-v1.0.0`, and the
masthead now names versions per platform. `theme-studio/src/lib/sdk.ts` already enforced this at
runtime via `resolveVersion()`; the Get SDK tab's prose now derives the same sentence from
`SDK_META` instead of hardcoding it.

### Guide content model moved into the repo

`tools/guide-gen/` (was `/tmp`) renders both outputs from one `PLATFORMS` model:

| Output | Path | Tracked |
|---|---|---|
| Shareable HTML artifact | `tools/guide-gen/farmerchat-sdk-docs.html` | no (gitignored) |
| Studio "Get SDK" tab | `theme-studio/src/lib/guide.data.json` | **yes** |

7 flavours, 63 sections, 104 code blocks. Because both come from the same model they cannot drift.
The Studio renders it via `IntegrationGuide.tsx`, **additive** to the four themed download cards —
those carry the user's live theme, which static docs cannot, so they remain the primary path.

### Phone-preview fidelity — 8 drifts fixed, sourced to compose

| Screen | Was | Now | Source |
|---|---|---|---|
| Home | "What are farmers asking today?" | **For your farm today** | `HomeScreen.kt:777` `FOR_YOUR_FARM_TODAY` |
| Home | card CTA "Ask Now" | **Start chat** | `Cards.kt:233` `START_CHAT` |
| OTP | clock pill + "Please enter in 2:58 seconds" + "Resend code" | one muted line **"Resend code · 158 seconds"** | `AuthScreen.kt:747-754` |
| Language | "By continuing, you agree to our" | **"FarmerChat uses AI. By continuing, you agree to our"** | `LanguageScreen.kt:379` |
| Language | "Terms of Use" / "Privacy Policy" + "also see" | **"Terms of use" · "Privacy policy"** | `LanguageScreen.kt:370-371`, separator `·` at :405 |
| Language | tagline on one line | explicit line break | `FARMERCHAT_TAGLINE` |
| Settings | no My Farm section | **My Farm → Location + "approximate" + helper copy** | `SettingsScreen.kt:280-336` |
| Settings | no phone row | **Your phone**, before Your name | `SettingsScreen.kt:365,373` |

Checked and found **already correct**: the Home composer (the preview's claim that the legacy
Photo/Speak/Type tile row is gone is right — `HomeScreen.kt:839` renders it only when
`!isComposerUi`), the location pill copy ("Set your location", `LocationButton.kt:161`), and chat's
"You can also ask" (`RELATED_QUESTIONS`).

### Scope and limits — stated honestly

- **The preview mocks 6 of the 15 routes** in `Destination.kt`. Not mocked: `Splash`,
  `SettingsName`, `Help`, `SettingsLanguage`, `ChatHistory`, `Error`, `AccountBenefits`,
  `AccountSuccess`, `LegalContent`. This was a deliberate scope call — the reported problem was
  fidelity of the existing screens, not coverage. Adding the other nine is unstarted work.
- **Fidelity was verified against the Android compose source only** — strings, structure and
  section order. Spacing, proportions and rendered type were **not** checked against a device or
  emulator. Per the standing rule that "check the app" means comparing rendered screens, this
  remains UNVERIFIED for layout.
- The preview is a shared approximation, not a per-platform render; iOS/RN/web were not compared.

### Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | clean |
| `npx vite build` | built, no errors |
| Guide rendered in a browser (`vite preview`) | 7 platforms, 17 code blocks on the default tab, highlighting live, **no `\0` placeholder leakage** |
| Narrow viewport (500px) | sidebar collapses to a `<details>` disclosure, all 7 platforms reachable — nav is never `display:none` |
| Pre-existing issue, NOT introduced here | `PlatformCard`'s header overflows ~25px at a 500px viewport (`SdkDownloads.tsx` card chrome, untouched by this change) |

---

## Preview fidelity, re-done against a running device (2026-09-17, second pass)

The first pass compared the Theme Studio preview against **compose source fallbacks** and was
wrong in four places. This pass ran the SDK on the `rs_qa` emulator (`sample-compose`, profile
`agentic`) and compared rendered screens.

### The rule the first pass broke

`label(Labels.X, "fallback")` renders the **server** label, not the fallback. The fallback only
applies when `get_labels` has no entry. Reading fallbacks out of compose source therefore does not
tell you what a farmer sees.

Ground truth is the served label cache — on device at
`shared_prefs/fc_sdk_preferences.xml`, key `fc_sdk_multi_language_labels_object` (289 entries for
this tenant). Of the 45 keys the preview touches, **7 have a served value that differs from the
source fallback**:

| Key | Served (renders) | Source fallback |
|---|---|---|
| `for_your_farm_today` | **What are farmers asking today?** | For your farm today |
| `start_chat` | **Ask Now** | Start chat |
| `terms_of_use` | **Terms of Use** | Terms of use |
| `farmerchat_tagline` | one line, no `\n` | `…advice\nfor your crops…` |
| `your_name_or_nickname` | **Your name** | Your name or nickname |
| `enter_code_we_sent` | **Enter the One time code/password (OTP) we sent** | Enter the code we sent |
| `check_your_messages_code` | **Check your messages for One time password (OTP)** | Check your messages for the code |

The first four were *regressions introduced by the first pass* and are now reverted; the last three
were pre-existing drift and are now fixed.

### Structural drift the source diff could not have found

| Screen | Was | Device |
|---|---|---|
| Chat / OTP | close `X` chip | **back arrow**; chat keeps the centred logo |
| Home | menu chip same shape as the others | Home's menu is a **circle**; Chat/Settings chips are rounded squares (app rounded only Home — `AppBars.kt:210`) |
| Home | feed image carried an eye/view-count badge | **no badge** on any served card |
| AppBar | `28°` | **`28 °C`** |
| Name | vertically centred; grey secondary Skip | **top-aligned**; pill field with accent ring; **white** Skip pill |
| Settings | small muted headings, outlined toggles, two separate account buttons | **bold black headings**, plain white cards, one account card with a divider, location helper split `Estimated.` + green invite |

### Still not covered

- 6 of 15 routes are mocked (unchanged): no Splash, SettingsName, Help, SettingsLanguage,
  ChatHistory, Error, AccountBenefits, AccountSuccess, LegalContent.
- The OTP **entry** step was not captured — reaching it sends a real SMS. Its copy comes from the
  served cache above, not from a screenshot; its layout is unverified.
- Verified against the Android compose flavour only, one tenant's labels, light appearance.
- Served labels are **tenant- and environment-specific**. These values are DEV. A different
  backend can legitimately render different copy — the preview can only match one.

---

## Preview now covers all 15 routes (2026-09-17, third pass)

The nine unmocked routes were added. Method as before: run the SDK on `rs_qa`
(`sample-compose`, profile `agentic`), capture the screen, read copy from the served label cache.

### Device-captured (6 of 9)

| Route | Reached by | Notes |
|---|---|---|
| `Splash` | cold start after `pm clear` | logo + arc spinner, **"FarmerChat is Starting..."** |
| `SettingsName` | Settings → Your name | appbar "Name"; label "Your name"; placeholder "Enter your name" |
| `SettingsLanguage` | drawer → Language | same list as onboarding, but **"All languages" is a WHITE pill** here (dark green in onboarding) and a pinned "Save language" CTA |
| `Help` | drawer → Help & Support | FAQ card + "More" card + footer "FarmerChat v.2.0.0 / © Digital Green" |
| `LegalContent` | Language → Terms of Use | X close; server HTML — serif display heading, italic revision date, rule |
| `Error` | `svc wifi disable` then any network action | full-bleed brand, oval illustration, "No internet connection" |

### Source + served-label derived (3 of 9) — NOT device-verified

`ChatHistory`, `AccountBenefits` and `AccountSuccess` are gated behind real authentication
(`Drawer.kt:295` requires `isAuthenticated`; `AccountSuccess` follows OTP verify), and
`AccountBenefits` additionally needs `bypass_interstitial == false`, which this tenant does not
return. Reaching them needs a real SMS, so they were not captured.

Their **layout** is still device-grounded: all three of `Error`, `AccountBenefits` and
`AccountSuccess` render the same `components/FullScreenMessage.kt`, and Error *was* captured — so
the shared layout is verified even though two of the three screens were not.

Their copy came from the label cache, which caught **5 more served-vs-fallback differences**:

| Key | Served (renders) | Source fallback |
|---|---|---|
| `recent_chats` | **Past Advice** | Recent Chats |
| `save_your_questions_answers` | **Your advice stays with you.** | Save your questions\nand answers |
| `well_save_your_chats_you_continue` | **Keep important crop recommendations safe and come back to them anytime** | We'll save your chats so you can continue later. |
| `youre_all_set` | **You’re all set!** (curly apostrophe) | You're all set! |
| `previous_questions_menu` | **See your old questions in the menu** | Find your previous questions in the menu and continue anytime. |

A source-only pass would have titled the history screen "Recent Chats". It is "Past Advice".

### Correction to the second pass

The second pass removed the feed card's view-count badge, having seen a card without one. The
drawer capture shows a served card **with** an eye badge reading `23`. The badge is conditional on
the card carrying a count — it has been **restored**, with the condition noted.

### Still not covered

- The **drawer** itself (an overlay, not one of the 15 routes) is not mocked: FarmerChat title,
  Home / Language / Settings / Help rows, and the sign-up promo card. Chat history rows appear
  there only when authenticated.
- The OTP **entry** step remains uncaptured (sending a real SMS).
- Android compose only, one tenant, light appearance.

### Correction: the FullScreenMessage illustration is a real photo, not a stand-in

The first version of these three screens drew an emoji in a tinted oval. The app renders an actual
country-scoped farmer photograph. Fixed by copying the SDK's own bundled assets into the studio:

| | |
|---|---|
| Source | `farmerchat-core/src/main/assets/<cc>/farmer_looking_at_{camera,phone,sky}.webp` |
| Copied to | `theme-studio/public/farmer/<cc>/` — all four shipped packs (`ke`, `et`, `ng`, `in`), 12 files, 1.1 MB |
| Studio default | `in`, set by `FARMER_COUNTRY` in `PhonePreview.tsx` (one line to change) |
| SDK behaviour | pack chosen from the `USER_COUNTRY_CODE` pref, falling back to `ke` (`Utils.kt` `CountryImageAssets`) |

Per-screen asset, from the compose sources: AccountBenefits → `LOOKING_AT_CAMERA`
(`AccountScreens.kt:27`); AccountSuccess → `LOOKING_AT_SKY` (`:75`); Error → `LOOKING_AT_SKY`
(`ErrorScreen.kt:54`). `LOOKING_AT_PHONE` ships but no screen in this flavour uses it.

Geometry now follows `FullScreenMessage.kt:199-201` exactly — max 300 dp wide, 300:450 (2:3)
aspect, `ContentScale.Crop`, clipped with `Radius.Rounded`. Rendered at 83 % of the frame, which is
300 dp of a 360 dp-wide device.

### Home re-verified (fourth pass) — one rendering bug, three structural misses

Re-checked against the `05-home-agentic` device capture after the screens were reported as still
wrong. Four fixes:

| # | Problem | Cause / device truth |
|---|---|---|
| 1 | **Card 1 rendered as an image only** — its text and "Ask Now" were invisible | A real bug, not a copy issue: radix `<AspectRatio>` uses percentage padding, which collapsed inside the flex `Card`, and `overflow-hidden` then clipped the rest. Measured **106 px rendered of 306 px of content**. Replaced with native `aspect-[16/9]` and dropped `overflow-hidden`. |
| 2 | Feed ground was **white**, so white cards had no separation | `HomeScreen.kt:573` — the base is the grey `surfacePrimary` "in BOTH modes". Now `bg-muted`. |
| 3 | Brand surface met the feed with a hard **rounded white sheet** | `HomeScreen.kt:608-612` is a `Brush.verticalGradient` from `surfacePrimary` to transparent — a soft fade, no rounded corner. |
| 4 | Header title had **no leaf dividers** | `SectionHeader.kt` flanks the title with `LeafDivider`: the `fc_leaf` glyph (an 11×11 lens path) tiled gaplessly at 4 dp, every other leaf mirrored, in `buttonPrimaryAccent`. Reproduced as an SVG `<pattern>` so it re-themes. Title also dropped 17 px → 15 px: 18 sp on a 360 dp device scales to ~15 px in the preview frame, and at 17 px the title filled the row and collapsed the dividers to zero width. |

The feed card image also moved from a 🌾 emoji to a real bundled photo. Card images are API content
the studio cannot have, so it uses `farmer_looking_at_phone.webp` — a genuine SDK asset — purely to
get the photographic treatment right. The subject will not match the card's text.

**Process note:** items 2-4 were all readable in the compose source and were missed by the earlier
passes, which focused on strings. Item 1 was invisible in source and only showed up by measuring
`scrollHeight` against `getBoundingClientRect().height` in the rendered DOM — worth doing routinely
for any card that contains a media box.

---

## Theme Studio ↔ SDK config alignment (2026-09-17)

### The emitted snippet was verified by compiling it, on every platform

| Platform | Check | Result |
|---|---|---|
| Android | generated Kotlin compiled in `sample-compose` | `compileDebugKotlin` **passed** |
| iOS | generated Swift compiled in `FarmerChatSwiftUI` | `xcodebuild … iOS Simulator` **BUILD SUCCEEDED** |
| Web | generated TS compiled against the real package | `tsc --noEmit` **clean** |
| React Native | generated TS compiled against the real package | `tsc --noEmit` **clean** |

Negative control: renaming one builder method to a bogus name failed the Android build, so the
check is not a no-op.

### Three latent iOS bugs this found — all pre-existing

Swift inits are **order-sensitive**; the studio was emitting in the shared cross-platform order,
which does not compile:

1. `error` must precede `onBackground` / `onSurface` in `FarmerChatTheme.init` — the studio put
   `error` last (the Android/web order). **Every iOS theme snippet the studio has ever produced
   failed to compile.**
2. Every `dark*` override must precede the three corner radii.
3. `fontName` must precede `typeScale`.

Fixed by tagging each emitted line with its position in the real init and sorting:
`IOS_THEME_ORDER` (from `FarmerChatTheme.swift`) and `IOS_ARG_ORDER` (from
`FarmerChatConfig.swift:247`) in `theme-studio/src/lib/export.ts`.

### 18 runtime config knobs added

The studio previously exposed only theme, shape, typography, FAB and chat-bubble values — none of
the journey, feature or environment configuration. Added, in three panels:

| Panel | Knobs |
|---|---|
| Environment & identity | `environment`, `guestApiKey`, `geoApiKey` |
| Journey & locale | `mode`, `appearance`, `languageCode`, `defaultCountryCode`, `defaultStateCode`, `showDrawer`, `showHistory`, `showSettings`, `showNameScreen` |
| Features | `enableVoice`, `enableImages`, `enableWeather`, `enableSsfr`, `enableAgenticChat`, `enableAnalytics` |

Every one is a real builder method on Android **and** a real field on iOS / RN / web, so the same
knob emits on all four. Defaults mirror `FarmerChatConfig.kt`, and a line is printed only when the
value differs — except `enableAnalytics`, printed always, since a host who never sees the flag
cannot work out why no events arrive.

`enableComposerUi` was deliberately **excluded**: Android, RN and web have it, iOS does not.

`environment` is now driven by the studio instead of being hardcoded `PROD` in all four emitters
and in `theme.json`.

### Also

- `sample-compose`'s `studio` profile was stale at `buttonCornerRadius(12)`; re-synced to the
  studio's current `999`. That harness exists to fail the build if the generator drifts.
- The **Gallery** tab is hidden from the header. The route is untouched — `?view=gallery` still
  renders it, and restoring the trigger is a one-line change.

---

## App delta `cbfdcff8..1b0553d2` ported (2026-09-17)

Six commits on `fc-compose-agentic` (`/Users/Aiyappa/AndroidStudioProjects/fc-compose-agentic`),
five distinct changes across five app files. **Target tree: `versions/v2/` only.** The root
`android/ ios/ react-native/ web/` trees are the 1.0.0 line; the precedent is the previous app
delta (`b72ea4da`, "language screen legal intro names the AI"), which landed in `versions/v2/` on
all four platforms and in neither root package — verified by grepping for its copy in both trees.

### 1. Tip card minimum height — `33837fc3`

`heightIn(min = 104.dp)` on the tip card so a one-line body no longer renders a shorter card than
a two-line one and the auto-advancing carousel stops jumping.

| Package | Status |
|---|---|
| android compose | ✅ `components/Tips.kt` `Tip()`. Load-bearing here specifically: the `HorizontalPager` above sets no page height and uses `verticalAlignment = Bottom`, so it takes the tallest page and shorter ones shift. **Measured on emulator-5554 (rs_qa, 420dpi)**: the card is exactly **273px = 104.0dp** at a column clear of the rounded corners (`scratchpad/c1-tips.png`) |
| android views | ✅ `widgets/TipsCarouselView.kt` `TipCardView.minimumHeight = 104.dp(context)`. `minimumHeight` feeds `getSuggestedMinimumHeight()` and includes padding, matching the Compose modifier's position ahead of `.padding()`. The `onMeasure` override in that file belongs to the pagination indicator, not the card, so nothing overrides it |
| ios swiftui / ios uikit / react-native / web | ⛔ **NOT APPLICABLE — the tips carousel does not exist on these platforms at all.** They carry the `tips_*` label keys (`FCLabelKeys.swift`, `core/labels.ts`) but no component renders them. The missing thing here is not a 104dp minimum, it is four carousels; that is an order of magnitude past this delta and is left for the host to scope |

### 2. Related-questions fade-in — `0456f364`

`fadeIn(tween(300))` with `ExitTransition.None`, driven by `MutableTransitionState(false).apply {
targetState = true }`. The app is explicit that it is **fade only, no size or position animation**,
"so surrounding content doesn't shift" — the block sits directly under an answer a farmer is still
reading.

| Package | Status |
|---|---|
| android compose | ✅ `screens/ChatScreen.kt`. Was `fadeIn(tween(350)) + slideInVertically(tween(350)) { it / 4 }` — the slide is dropped, 350→300, `ExitTransition.None` added. The answer-actions row above keeps its own 350ms fade+slide; the app's commit does not touch it |
| android views | ✅ `ui/ChatAdapter.kt`. New: no fade machinery existed there at all. `View.animate().alpha()` over 300ms on the label + list. **Guarded by a `fadedFollowUps` ledger keyed on the message id** — `onBindViewHolder` runs on every recycle, so an unguarded animation would re-fade the block each time the farmer scrolled it back into view; the app's `remember { … }` fires once per composition and the ledger is what "once" means in a RecyclerView. A half-finished fade is cancelled and alpha restored on rebind |
| ios swiftui | ✅ `Screens/ChatView.swift`. Was `.transition(.opacity.combined(with: .move(edge: .bottom)))`; now `.transition(.opacity.animation(.easeOut(duration: 0.3)))`. `.animation` on the transition overrides the container's 0.35s `easeOut` for this insertion alone, leaving the actions row's timing intact |
| react-native | ✅ `screens/ChatScreen.tsx`. The shared `FadeIn` helper was 350ms **plus `translateY(8→0)`** — a slide, not a pure fade, and it is shared with the answer-actions row. Given a `rise` / `durationMs` opt-out rather than changed in place, and the follow-ups block passes `durationMs={300} rise={false}`; the actions row is untouched |
| ios uikit | ⛔ **GAP.** Follow-ups are individual `Row.followUp` cells in a diffable snapshot, animated by UIKit's own insertion animation, and there is no title row. A single 300ms fade of the whole block would mean restructuring the chips into one cell — disproportionate to a timing change. Recorded, not done |

`web`'s `.fcsdk-fade-in` was also 0.32s **with `translateY(6px)`**, likewise shared with the actions
row; a `.fcsdk-fade-in-only` keyframe (0.3s, opacity only) was added and the follow-ups block moved
onto it. ✅

### 3. Language-screen legal paragraph — `47bc8524`

One flowing justified paragraph with the two legal links inline, joined by the served `also_see`
connector instead of a bare `·`, trailing `.` outside the link span; and the `\n` removed from the
`FARMERCHAT_TAGLINE` fallback.

**Checked before porting** (served labels beat source fallbacks): `also_see` **is served**
— `fc_v2_app_label_also_see_en` = `"also see"` in the on-device label cache on DEV. Had it not
been, this port would have replaced a clean `·` with the literal fallback string. The served
tagline is likewise one line, so the `\n` removal matches what actually renders.

The app's diff is dense with `AnalyticsManager.track(… AdjustEventTokens …)`. **Not ported** —
CLAUDE.md §6 bars Adjust from SDK packages and every platform already routes through its own
`onOpenLegal` / analytics call. Only the structure was taken.

| Package | Status |
|---|---|
| android compose | ✅ `screens/LanguageScreen.kt` `LegalLinksRow` rewritten with `buildAnnotatedString` + `withLink(LinkAnnotation.Clickable)` + `TextLinkStyles`, `TextAlign.Justify`, `widthIn(max = 260.dp)`. Requires Compose UI 1.7+; the BOM here is `2026.05.00` |
| android views | ✅ `ui/LanguageFragment.kt` + `res/layout/fc_fragment_language.xml`. The two TextViews (`fcLanguageLegal` intro + `fcLanguageLegalLinks`) collapse into one; links are inline `ClickableSpan`s. `android:justificationMode="inter_word"` (API 26, this module's minSdk), `maxWidth="260dp"`, `gravity="start"` — Compose's `Justify` puts the last line at start. The link span restates `fc_foreground_primary` because the merged paragraph now renders in `foregroundSecondary` |
| ios swiftui | ✅ `Screens/LanguageSelectionView.swift`. One `AttributedString` with `.link` runs on custom-scheme URLs (`farmerchat-legal://terms` / `://privacy`) intercepted by an `OpenURLAction`. `Text(a) + Text(b)` concatenation loses per-span hit-testing and a `Button` cannot live inside a run of text, so the link attribute is the only mechanism |
| react-native | ✅ `screens/LanguageSelectionScreen.tsx`. Nested `<Text>` keeps each link independently pressable inside the run. **Also fixed: the tagline fallback read `'Practical advice for your crops and animals'`** — not the app's string at all, and on RN the fallback *is* the rendered UI wherever the v1 label-key mismatch (item 9 above) bites |
| web | ✅ `screens/LanguageSelectionScreen.tsx` + `ui/theme.ts`. Already one flowing block; the connector was an invented `language_legal_and` key ("and") — replaced with the real `fc_v2_app_label_also_see`. Added the trailing `.`, `text-align: justify`, `max-width: 260px` |
| ios uikit | ⛔ **GAP.** `FCUILanguageViewController` has no tagline and no legal row at all — a table view plus a Save button. The whole consent block is absent, not just its layout. Pre-existing; surfaced by this pass |

**Justification is a real platform split, not an oversight:** Compose and Android Views justify;
CSS justifies; **SwiftUI has no justified alignment** (`.multilineTextAlignment` is
leading/center/trailing only) and takes `.leading`; **RN's `textAlign: 'justify'` is iOS-only** and
falls back to left on Android. Leading is where the app's justified text puts its last line, so the
degradation is graceful on both.

### 4. Home scroll fade-out — `70adc5fd`

The agentic Home header stops being a pinned-and-fading list item and becomes a **fixed overlay**;
the background band stops fading on scroll; the feed's top strip is masked so cards **dissolve into**
the band as they rise behind the header instead of covering it.

| Package | Status |
|---|---|
| android compose | ✅ `screens/HomeScreen.kt`. Band fixed (no `gradientAlpha`, `Sunbeams` at `1f`); header content (logo, `FOR_YOUR_FARM_TODAY`, location pill) hoisted out of the `LazyColumn` into a `TopCenter` overlay measured with `onSizeChanged`; item 0 becomes a `Spacer` of exactly that height, preserving every downstream feed index; the list carries `CompositingStrategy.Offscreen` + a `drawWithContent` `BlendMode.DstIn` gradient ending at `headerContentPx`. **The SDK's pre-existing deviation is unchanged**: the app's overlay also carries the app bar, but here the app bar sits in the `Column` above the list because it must survive the loading and error branches, which render no list at all |
| web | ✅ `screens/HomeScreen.tsx` + `ui/theme.ts`. Band loses its scroll opacity (`HOME_BAND_FADE_PX` deleted); `.fcsdk-home-agentic-head` becomes `position: absolute` above the scroller, measured with a `ResizeObserver`; the scroller reserves that height as `padding-top` and carries a `mask-image` linear-gradient — the CSS equivalent of `DstIn` — ending at the same measured height. The greeting stays IN the scroller: it is feed content, and Compose's overlay does not carry it either |
| react-native | ⛔ **GAP.** The agentic Home and its pinned header exist, but the top-strip mask does not: this package has **no mask, offscreen-composite, gradient or blur primitive** in its peer-dependency set (no `react-native-svg`, no `expo-linear-gradient`, no `@react-native-masked-view` — the same constraint already recorded for the composer aura, the stepped gradient band and the missing Sunbeams). Landing the fixed header *without* the mask would ship exactly the ghosting the app's commit exists to remove — cards visible through the gaps around the logo and title — so the existing pinned-and-fading header is kept as a coherent whole. Adding a peer dependency for a visual polish item is a real cost to every host integrator and is the host's call, not ours |
| android views / ios swiftui / ios uikit | ⛔ **NOT APPLICABLE.** None of them implements the agentic Home surface at all (no `composerUi` gating in `HomeView.swift` or the UIKit Home; Views records "the agentic surface + gradient + pinned header are not ported" in `HomeFragment.kt:248` and `versions/v2/README.md`). There is no header here to fix |

**Verified at runtime**, not just compiled — this is a layout change and a clean compile proves
nothing about it. `sample-compose` on emulator-5554 with the `agentic` profile
(`am start --es profile agentic`, then force-stop and relaunch — the profile extra is read by
`MainActivity` after the Application has already initialised): header fixed with the band solid
behind it
(`scratchpad/j5-top.png`), the resting first card fully opaque — crisp image, sharp "25" eye badge
— and a card mid-scroll visibly dissolving into the green under the location pill
(`scratchpad/j4-scrolled.png`).

### 5. Markdown tables: wide tables become row cards — `69a6db10` + `1b0553d2`

A 3+ column table used to keep a 160dp/160px per-column minimum and overflow horizontally behind a
right-edge fade, so the reader had to pan a table sideways inside a vertically scrolling thread.
Each data row now becomes its own card: cell 0 is the title, every other column a label/value pair,
label muted and leading, value bold and trailing. 1–2 column tables are unchanged.

This is a **render-only** change. The GFM scanner, the alignment parsing and the 2-line look-ahead
are all untouched on every platform; the wide branch simply ignores `block.alignments`, as the app's
does.

| Package | Status |
|---|---|
| android compose | ✅ `components/MarkdownText.kt` split into `MarkdownRowCards` / `MarkdownWeightedTable`. Thirteen now-dead imports removed. `MarkdownText`'s public `onTableAction` parameter is **kept** (nothing in the tree passes it, and it is part of a published signature) and documented as reserved |
| ios swiftui | ✅ `Components/ChatComponents.swift` `FCMarkdownTable`; the `ScrollView(.horizontal)` branch is replaced by `rowCards` |
| web | ✅ `ui/components/markdown.tsx` + `markdownParse.ts` + `ui/theme.ts`. **`isTableScrollable` renamed to `isWideTable`** — the threshold is unchanged but it no longer selects "scrolls", and `test/markdown.test.ts` asserted the old meaning by name; the test is updated with it. `.fcsdk-md-table--wide`, `.fcsdk-md-tablewrap--scroll` and `.fcsdk-md-tablefade` are gone |
| android views / react-native / ios uikit | ⛔ **GAP — markdown tables are not rendered at all on these three.** `views/internal/util/Markdown.kt` has no table branch, `react-native/.../components/Markdown.tsx` has none, and UIKit's `ChatCells.swift` has no markdown renderer. A GFM table arrives as raw pipe soup there today; that is a pre-existing gap this pass surfaces, and the row-card treatment is moot until a table renders at all |

### Verification run

| Check | Result |
|---|---|
| `:farmerchat-android-compose:compileDebugKotlin` | ✅ clean. **Negative control**: renaming `MarkdownRowCards` → `MarkdownRowCardsXX` fails with `Unresolved reference` at `MarkdownText.kt:234`, so the check is not a no-op |
| `:farmerchat-android-views:compileDebugKotlin` + `assembleDebug` | ✅ clean. `assembleDebug` is what validates the edited `fc_fragment_language.xml`; `compileDebugKotlin` alone would not have |
| iOS `FarmerChatCore` `swift build` + `swift test` | ✅ 88 tests, 0 failures |
| iOS `FarmerChatSwiftUI` `xcodebuild -destination 'generic/platform=iOS Simulator'` | ✅ BUILD SUCCEEDED |
| iOS `FarmerChatUIKit` `xcodebuild -destination 'generic/platform=iOS Simulator'` | ✅ BUILD SUCCEEDED |
| react-native `tsc --noEmit` | ✅ clean |
| web `tsc --noEmit` + `vite build` + `npm test` | ✅ clean; 218 assertions across 6 suites |
| **Runtime**, `sample-compose` on emulator-5554 (`agentic` profile) | ✅ Home fixed header + dissolve, tip card measured at 104.0dp, chat answer renders, Language legal paragraph + inline link tap |
| **Runtime**, `sample-views` on emulator-5554 (`dev` profile) | ✅ Language legal paragraph justified as one block, inline link tap opens the policy, no crash in logcat |

**Runtime evidence for change 3** (`scratchpad/lang-compose.png`, `lang-views.png`): on both Android
flavours the consent text renders as ONE justified block with no centred stub line, both links
underlined, the served Kannada `also_see` ("ಸಹ ನೋಡಿ") between them, the trailing "." outside the
underline, and the last line start-aligned. Tapping the inline privacy span opens the policy on
both (`lang-compose-privacy.png`, `lang-views-privacy.png`) — so `withLink(LinkAnnotation.Clickable)`
and the Views `ClickableSpan` + `LinkMovementMethod` both hit-test correctly inside the merged
paragraph. The 260dp cap makes justification loose on the first lines; that is the app's own
measure and its own `TextAlign.Justify`, so it is faithful rather than a defect.

### Two things this pass did NOT render

1. **The related-questions fade.** The live DEV answer opened an **additive alignment surface**
   ("Help us tailor your advice"), and the SDK's own rule (43ba5de4) suppresses the follow-up list
   while such a surface is on screen — correct behaviour, but the faded block never rendered in
   this run. Compile-verified on all five packages that took it; unverified at runtime.
2. **The web fixed header and its mask (change 4) and the row-card tables (change 5) on web and
   SwiftUI.** `tsc` + `vite build` + `xcodebuild` all pass, but by this document's own standard a
   clean compile proves nothing about a layout change. `web/example` was not driven and the iOS
   simulator was not run. **Compile-verified only.**

### Theme Studio brought back in step

`theme-studio/src/components/PhonePreview.tsx`'s Language screen still rendered the OLD legal
layout — an intro line plus a centred `Terms of Use · Privacy Policy` row — so the moment change 3
landed, the preview drifted from the SDK it is meant to preview. Rebuilt as the same single
justified 260px paragraph with the links inline and the `also see` connector, trailing "." outside
the link. `tsc --noEmit` + `vite build` clean. The preview is not itself a platform, but it is the
artefact the studio ships to integrators, and a preview that shows a layout the SDK no longer has
is worse than no preview.

### The Theme Studio e2e suite was already red

Running `npx playwright test` after this pass found **7 failures out of 16**, and none of them are
this port. Six assert Studio UI that **earlier work in the same session** removed or changed, with
the spec never brought in step; the seventh is a genuine flake. Final state: **15 pass, 1 red.**

| Test | Why it was stale | Now |
|---|---|---|
| `loads with the three top-level tabs` | the Gallery **trigger** was removed (route kept) | asserts two tabs + the trigger's absence, so the trigger-gone and route-kept facts can't drift apart |
| `android export states the analytics default, and only android does` | asserted `enableAnalytics` was Android-only. **It is not** — it is a real field on all four: iOS `config.enableAnalytics` (`FarmerChat.swift:117`), and `enableAnalytics?: boolean` in both web and RN `core/config.ts`. The emitters were right and the test was wrong | asserts every platform prints it |
| `phone preview navigates between app screens` | asserted `"Related questions"`, the compose **fallback**; the preview renders the **served** `"You can also ask"` | asserts the served label |
| `Get SDK: shows real package ids and downloads a themed quick-start` | the themed platform cards and their quick-start downloads were removed; the tab is guide-only | asserts the guide heading and the quick-start button's absence |
| `Get SDK: android uses the real Maven group and its own version` | the install line moved from a card into a guide code block | asserts inside `.fcg-body` |
| `deep-link params open the requested view` | asserted the removed `"Get the FarmerChat SDK"` heading | asserts `"Integration guide"` |
| `chat: asking a question shows the tips carousel for the wait, then settles` | **FLAKY, still red, and NOT fixed.** It fails on `.fc-shimmer` never reaching count 0 inside its 15s budget, though the preview's wait/settle machine (`PhonePreview.tsx:246-262`) should settle in 4 × 1100 + 700 = 5.1 s. Observed failing alone under `-g`, passing in one 17.7-minute full run, and failing again in a 1.0-minute full run — i.e. it is timing-sensitive, not stale. Nothing in this pass touches that state machine. Left red deliberately: widening the timeout would hide a real intermittent bug in the preview's simulation, and a green suite bought that way is worth less than an honest red one. **Worth its own debugging pass.** |
| `phone preview navigates between app screens` (the Settings half) | a SECOND failure the first fix exposed: `getByText("Appearance", { exact: true })` was page-wide, and the config panels added earlier in the session introduced an `appearance` knob whose `<label>` is an exact match too — two elements, strict-mode violation. Scoped to `.phone`, which is what the assertion always meant |

One bug in web's change 4 was caught by review rather than by a build and is fixed: the fixed head
was `position: absolute` with no `top` inside `.fcsdk-screen`, which is a **flex column** — an
absolutely-positioned flex child resolves its static position to the flex container's content-box
origin, not its DOM-order slot, so the head would have landed over the app bar and swallowed the
menu and weather taps. The head and the scroller now share a `.fcsdk-home-feedwrap`
(`position: relative`), mirroring Compose's `Box { LazyColumn(…); header }`, and the head takes an
explicit `top: 0` against it. No amount of `tsc` would have shown this.

---

## App delta `1b0553d2..919e5b2f` — 13 commits (2026-09-21)

Ported from `/Users/Aiyappa/AndroidStudioProjects/fc-compose-agentic`, Android first, into
`versions/v2/` only. One commit (`919e5b2f`) is a host build bump — `versionCode` 109→112, Kotlin
2.4.20, Compose BOM 2026.09.00, the demo flavour renamed "FarmerChat(Beta)" — and is not portable:
the SDK pins its own BOM at `2026.05.00`.

### What each commit is

| Commit(s) | Change |
|---|---|
| `197a7973` | InputComposer photo strip `padding(bottom = 10)` → `padding(top = 10, bottom = 10)` |
| `1b961130`, `b193a95c` | `DefaultAppBar` gains `leftRadius`/`rightRadius` (default `Radius.MD`); callers pass `Radius.Rounded` |
| `e5dc1a90` | Home `headerContentPx`: `remember` → `rememberSaveable` (survives Chat → back) |
| `e8b382e6` | Home fixed-header inner Column `padding(top = 2.dp)` → `0.dp` |
| `2cd71328` | `HomeAppBar` weather pill `Radius.LG` → `Radius.Rounded` |
| `e8b382e6` | `HomeAppBar` `barHeight` 64dp → **52dp** (same commit as the header padding above) |
| `40b12a24` | Tips pager drops `.alpha(0.6f)` — peeking cards are fully opaque |
| `bda80659` | `ActionButton` gains `borderBrush`/`borderWidth`; `Cyan400`/`Yellow300` + `accentSweepBorder`; the **agentic** Share button uses it |
| `10a87f9c`, `a40da3c4`, `bd829ae9`, `04b38e8f` | Markdown: new `isCard()` + `MarkdownAnswerCard`; `MarkdownRowCards` threshold 3+ → **2+**; its label/value pair `Row` → full-width `Column` |
| `919e5b2f` | build version — host only, not ported |

Not a blanket sweep: the app deliberately left **SettingsName** and **onboarding Language** on
`Radius.MD`, and left the **legacy** (non-agentic) Share button unbordered. Both exceptions are
honoured on every platform.

### Per platform

| Change | android-compose | android-views | iOS SwiftUI | react-native | web |
|---|---|---|---|---|---|
| Composer photo strip 10/10 | ✅ | ✅ `layout_marginTop` | — gap A | ✅ already 10/10 | ✅ `padding: 10px 0` |
| App-bar left/right radius | ✅ params + 9 call sites | ✅ `fc_bg_appbar_chip_round` ×5 | — gap B | ✅ `DefaultAppBar` nav | ✅ already `border-radius: 50%` |
| Home `rememberSaveable` | ✅ | — gap C | — gap C | — gap C | — gap C |
| Home head top 2→0 | ✅ | — gap C | — gap C | ✅ `agenticHeader` | ✅ `.fcsdk-home-agentic-head` |
| Home bar 52 + round weather | ✅ both | weather ✅ already 999dp; height — gap D | — gap B | ✅ `barHeightDp={52}` | ✅ scoped 52px; weather already 999px |
| Tips fully opaque | ✅ | ✅ `TipsCarouselView` | — gap E | — gap E | — gap E |
| Share accent sweep border | ✅ | ✅ `SweepBorderDrawable` | ✅ `AngularGradient` | — gap F | ✅ `conic-gradient` |
| Markdown answer cards | ✅ | — gap G | ✅ | — gap G | ✅ + tests |

**Gaps, with reasons**

- **A** — iOS has no composer photo-attachment strip at all (no `photoUris` equivalent in
  `AgenticComponents.swift`). Pre-existing.
- **B** — iOS's app bar is a plain 56pt SwiftUI bar whose leading/trailing controls are bare SF
  Symbols with **no chip background**, so there is no corner radius to change and no `barHeight`
  in the Compose sense. Pre-existing structural difference.
- **C** — four different reasons, none of them "skipped":
  - **android-views** has no agentic fixed header at all (`HomeFragment.kt:196` says so — it keeps
    the 1.0.0 greeting + Photo/Speak/Type shape), so neither `e5dc1a90` nor `e8b382e6` has a
    surface there.
  - **iOS** likewise has no agentic fixed Home header.
  - **react-native** pins its header as the FlatList's *first item*, countering the scroll offset
    and fading it out — the approach Compose itself abandoned in `70adc5fd` because the pin fought
    the list. There is no measured height and no reserving Spacer, so there is nothing to promote
    to a saveable. **This is a real divergence worth its own fix**, not a no-op: RN should adopt
    the measured-overlay + item-0-Spacer design before `e5dc1a90` means anything there. The 2→0
    padding (`e8b382e6`) still applies and was ported.
  - **web** measures the head with a `ResizeObserver` into state; the head is a sibling of the
    scroller, not a list item, so the Compose design is already in place — but the measured value
    resets on remount, the same first-frame shift `e5dc1a90` fixed. Not yet addressed.
- **D** — android-views has **one** `fc_view_appbar.xml` shared by every screen, and its Home has
  no logo under the bar, so the 52dp trim has no visual rationale there and would shorten the bar
  on Settings/Help/History too. Left at 64dp deliberately.
- **E** — no tips carousel on iOS, RN or web.
- **F** — React Native has no conic/sweep gradient primitive without adding a dependency
  (`react-native-svg` or `expo-linear-gradient`, and the latter is linear only). The SDK ships no
  such dependency, so the RN Share button keeps its plain border. The genuine no-primitive gap —
  SwiftUI's `AngularGradient` and CSS's `conic-gradient` are honest equivalents and were used.
- **G** — android-views' `Markdown.Block` has no `Table` case and RN's `Markdown.tsx` (172 lines)
  has no table support. Both pre-existing, both already recorded above for the previous delta.

### Fidelity fixes found during this port (NOT from the 13 commits)

Measured against the app on emulator-5554 (rs_qa, 1080×2400, density 420), both APKs rebuilt from
`919e5b2f` / current SDK, same DEV backend, same language.

1. **First Home card sat 8 dp too low.** SDK feed cards carried
   `padding(horizontal = 16.dp, vertical = 8.dp)` at all four branches; the app's `cardModifier`
   (HomeScreen.kt:1310) and its `SsfrCard` (:1241) use **`horizontal = 16.dp` only**, with the
   list on `Arrangement.spacedBy(0.dp)` and the card composables carrying their own spacing.
   Measured: identical header on both (location pill y 508..612), app first card top y=655, SDK
   y=676. After removing the vertical pad both read **y=655**, and a same-card-type pair
   (ContentCard → MultiSelectCard) measures **41.9 dp between cards on both**.
2. **MultiSelectCard options rendered as narrow chips.** The SDK used a plain `Column`, which wraps
   to its widest child; the app uses `LazyVerticalGrid(columns = GridCells.Fixed(1))`
   (MultiSelectCard.kt:234), which stretches every cell to the full column width **and** scrolls
   inside the `heightIn(max = 240.dp)` cap instead of clipping. Ported the construction. Verified
   on device: dragging inside the options scrolls them while the header and the card above stay
   byte-identical (0 pixels changed).
3. **AccountBenefits left icon** was `Icons.Filled.Close`; the app uses
   `Icons.AutoMirrored.Filled.ArrowBack` (AppNavGraph.kt:812). The SDK's `onSkip` is already
   `popBackStack()`, exactly the app's `onLeftClick`, so only the glyph differed.

**Still divergent, recorded not changed:** the SDK's AccountBenefits **left** button fires
`ACCOUNT_BENEFIT_SCREEN_SKIP`; the app fires that event only from the right-hand "Skip" and fires
nothing on the back arrow. Changing it is an analytics decision, not a layout one.

### Verification

| Package | Check | Result |
|---|---|---|
| android-compose | `:farmerchat-android-compose:compileDebugKotlin` | ✅ |
| android-views | `:farmerchat-android-views:compileDebugKotlin` | ✅ |
| android sample | `:sample-compose:assembleDebug` + install | ✅ |
| iOS Core | `swift build` + `swift test` | ✅ 88 XCTest tests, 0 failures |
| iOS SwiftUI | `xcodebuild -scheme FarmerChatSwiftUI -destination 'generic/platform=iOS Simulator' build` | ✅ BUILD SUCCEEDED |
| iOS UIKit | `xcodebuild -scheme FarmerChatUIKit -destination 'generic/platform=iOS Simulator' build` | ✅ BUILD SUCCEEDED |
| react-native | `npx tsc --noEmit` | ✅ |
| web | `npx tsc --noEmit`, `npx vite build`, `npm test` | ✅ 219 assertions across 6 files |

`swift test` prints a second, separate summary from the swift-testing runner — `Test run with 0
tests in 0 suites passed`. That is not a discovery failure: this package's tests are XCTest, and
their result is the `Executed 88 tests, with 0 failures` line above it. Do not read only the tail.

**How far each platform's verification actually goes** — do not read the table above as equal
confidence:

- **android-compose** — compiled, installed, and measured against the app on device (below).
- **android-views** — compiled and installed; the composer margin, tips opacity, round chips and
  `SweepBorderDrawable` have **not been seen rendered**. The views sample's chat answer would not
  load on this backend across three attempts (no request was even issued; unrelated to this port),
  so the sweep border in particular is reasoned and compile-verified only. It is the one edit here
  whose geometry is worth an eyeball when someone next has a working views chat.
- **iOS** — SwiftUI and UIKit both build; Core's 88 tests pass. Nothing rendered in a simulator.
- **react-native** — `tsc` only. There is no RN runner in this environment, so that is the ceiling.
- **web** — typechecks, builds, and its 219 unit assertions pass. Nothing rendered in a browser.

On-device fidelity (android-compose vs the app, both at `919e5b2f`):

| State | Result |
|---|---|
| Home at rest | location pill y 508..612 and first card top y=655 — **identical on both** |
| Home scrolled | header fixed, same DstIn dissolve, same fade edge at the pill |
| Home after Chat → back | pill and card top unchanged at 508..612 / 655 — `rememberSaveable` verified |
| Multi-select options drag | options scroll internally; header + card above 0 px changed |

**Emulator note:** the AVD had been launched with `--host-dns=192.168.0.1`, a resolver that no
longer exists since the host changed networks, so every request failed `UnknownHostException` and
Home rendered "Can't load right now". A reboot does not fix it — the AVD must be relaunched with
`emulator -avd rs_qa -dns-server 8.8.8.8,1.1.1.1`. Worth checking before blaming the SDK.

**Web test threshold change:** `isWideTable` went 3+ → 2+, so
`test/markdown.test.ts` now asserts `[1,2,3,4] → [false,true,true,true]`, and a new case pins
`isCardTable`'s strictness (a trailing header cell with text, or any column count but 3, is not a
card).

---

## Android compose fidelity pass — Help, Settings, LanguageChooser, SettingsName, Auth (2026-09-21)

Continuation of the screen-by-screen pass against the app at `919e5b2f` on emulator-5554
(rs_qa, 1080×2400, density 420), same DEV backend, same language (Kannada). **Android compose
only** — none of these changes were needed on views/iOS/RN/web, which are tracked separately
below.

| Screen | Before | After |
|---|---|---|
| Help | 576 px | **2 px** (the version string's own width) |
| Settings | 325 px | **1 px** |
| LanguageChooser | 97 px | **0 px** |
| SettingsName | 42 px | **0 px** |
| Auth (phone entry) | 386 px | **0 px** |
| LegalContent | — | **0 px** (already matched) |

### Behaviour changes (not layout) shipped in this pass

Two of the Auth fixes change what the screen *does*, not just where things sit. Flagged here so a
host looking for behavioural deltas does not have to read the layout findings to find them.

| Change | Before | After | Why |
|---|---|---|---|
| Phone field `autofocus` | `true` — keyboard opened on entry, covering the agreement card and both send buttons | `false` | The app auto-focuses only its OTP input (`OtpInput.kt:43`), never the phone field |
| Phone field `placeholder` | `label(ENTER_PHONE_NUMBER, …)` — the **heading's** label key, so a full Kannada sentence sat inside the input | literal `"00000 00000"` | Label-key misuse, same class as the Terms/Privacy titles. A sweep for other labels used as both a heading and a placeholder found **no further instances** |

### The one systemic cause

Four of the five screens were wrong for the **same** reason: the SDK used a flat `padding(16.dp)`
with a single uniform `verticalArrangement`, where the app uses **20dp sides / 32dp ends** and a
two-level rhythm — an outer Column at `spacedBy(24-28.dp)` between SECTIONS, each section its own
Column at `spacedBy(10.dp)` holding its title plus its card. Flattening that put every section
title 16dp too high, every title-to-card gap 6-18dp wrong, and every row 4dp wide of the app's.
Auth is the same mistake in a different form: a uniform `spacedBy(24.dp)` where the app writes
explicit `Spacer`s of 8 / 24 / 20 / 12 / 8.

Worth checking first on any screen not yet compared.

### Per-screen findings

**Help** — `ListItem` (shared, so this fixed Settings too) carried `weight(1f)` on the **label**
instead of the value. The app comments the rule explicitly (ListItem.kt:88): the label side is
never weighted, so a long value can never ellipsize it, and the value absorbs the flexible space.
Inverted, a long value was squeezed instead, and on a chevron-only row the chevron was pushed to
the far edge where the app tucks it right after the text. The chevron glyph was also
`KeyboardArrowRight`, not the app's `ChevronRight`.
Terms of Use / Privacy Policy read the **#legal payload's own `title`** and fell back to the label
only when null — that endpoint returns untranslated titles, so both rows rendered in English on a
Kannada device. The app reads the served label and never those titles. The version footer used
`label(FARMERCHAT_V200, …)`, which resolves to Kannada script; the app hardcodes a Latin literal
(`"FarmerChat v.${VERSION_NAME}"`) and never translates it.

**Settings** — the appearance tile marked selection by filling with `surfaceActive` and tinting
its icon `borderActive`; the app keeps ONE surface (`surfaceSecondary`) for all three tiles and
marks selection with a **2dp `borderActive` ring**, icon always `foregroundPrimary`. Radius was MD
not LG, icon 26dp not 18dp, and a fixed `height(76.dp)` where the app lets `top = 16 / bottom = 14`
with a 10dp gap set the height. The appearance hint used `bodySmall` (15/22) where the app's
`caption` is 13/18, which wrapped it onto a second line. The "Your name" row passed `null` for an
empty value; the app passes `"—"`, so the SDK's row showed only a chevron.

**LanguageChooser** — the "All languages" chip was a `surfaceSecondary` Box with dark text; the app
uses a FILLED `buttonPrimarySurface` Surface with `buttonPrimaryForeground` text, i.e. the SDK had
it inverted. (Material3's `Surface(onClick=)` also applies `minimumInteractiveComponentSize()`,
which is what sets the chip's true height — the same detail that closed the last 5px on the
onboarding Language screen.) The footer had no `surfaceSecondary` background, and the save button
was `PrimaryButtonState.Default` where the app uses `Chevron`.

**SettingsName** — flat 16dp padding, and `height = 56` on the save button where the app passes no
height at all and takes `PrimaryButton`'s 48dp default.

**Auth** — the phone field's placeholder was `label(ENTER_PHONE_NUMBER, …)`, which is the
**heading's** string, so a full Kannada sentence sat in the input; the app uses the literal
`"00000 00000"`. The field also passed `autofocus = true`: the app auto-focuses only its OTP input
(OtpInput.kt:43), never the phone field, so the SDK opened the keyboard on entry and covered the
agreement card and both send buttons. The two send-code buttons were a 56dp chevron
`PrimaryButton` plus a white `SecondaryButton`; the app uses **two equal 48dp filled
PrimaryButtons with leading channel icons and no chevron** (`fc_icon_whatsapp` / `fc_icon_sms`,
both already present in the SDK's drawables).

  **Verified for the phone step only.** `AuthStep.OtpEntry` renders inside the *same* container
  whose padding changed (`horizontal = 20.dp`, `top = 32.dp`, `bottom = 24.dp`), but reaching it
  needs a real OTP, so its internal spacing is **unmeasured**. The container change is sound by
  derivation from the app source; the OTP step's own spacers are not claimed to match.

### `caption` already existed — it just had zero readers

The app's `caption` is 13sp/18sp @400. The SDK's `labelSmall` is the same metrics at **600** and
its `bodySmall` is 15/22, so neither is a substitute. After hand-writing
`labelSmall.copy(fontWeight = FontWeight.Normal)` at a third and fourth call site, a reader count
turned up the actual cause: `theme/Type.kt:23` **already defines** `val caption =
langStyle(13.sp, 18.sp, FontWeight(400))` — ported faithfully from the app's own `Type.kt` and
then never wired to anything. Classic zero-reader port: present, correct, and invisible.

All four sites (`LanguageScreen`, `SettingsScreen`, `HelpScreen` ×2) now read that token, and it
carries a doc comment explaining why it is deliberately *not* a Material3 `Typography` slot. A
flat value is metrically right in every script because all six per-script `Typography` blocks
define `labelSmall` at the same 13/18 — only the weight differs.

Re-measured after the switch, since it is only a no-op if the resulting `TextStyle` is identical:
**Settings 1 px, Help 2 px** — the same numbers as before, on freshly captured pairs.

### Recorded, not changed

* **AccountBenefits / Error routing.** Online, the app's drawer Sign-up goes straight to **Auth**
  (`bypass_interstitial`), skipping AccountBenefits entirely. Offline, the app checks
  `NetworkUtils.isOnline()` at the drawer and routes to its full-screen **Error**, while the SDK
  shows **AccountBenefits** and defers the network check to the next tap. Neither screen can be
  paired for a pixel diff until that routing is reconciled — it is a navigation decision.
* **AccountBenefits left-button analytics.** The SDK's left (back) action fires
  `ACCOUNT_BENEFIT_SCREEN_SKIP`; the app fires that only from the right-hand Skip and fires
  nothing on the back arrow. (The glyph itself was fixed in the 13-commit pass.)
* **Drawer corner antialiasing.** The drawer panel measured a peak of 0 last session and now
  measures 188 px, all of it in two ~13px slivers at the rounded corners of the sign-up pill.
  Nothing in the drawer changed on either side; the app is now built on Compose BOM 2026.09.00
  while the SDK pins 2026.05.00. Toolchain AA, not drift.

### Still not compared

ChatHistory and AccountSuccess need a real OTP; EnterName is skipped by the app for this guest
(already recorded); Chat is non-deterministic and only its chrome is comparable — the new
`MarkdownAnswerCard` cannot be pixel-verified until the backend returns a card-shaped table.

---

## Label-key resolution audit — iOS and web call sites that can never resolve (2026-09-21)

Found while pixel-matching **Chat**: the SDK sample's Chat composer rendered its placeholder in
**English** on a Kannada device while the app rendered Kannada — and the SDK's own **Home**
composer rendered Kannada correctly. That asymmetry turned up one real bug on android compose and
a larger one on iOS and web.

### Method — measured against the served map, not grepped from source

Per the standing rule *served labels beat source fallbacks*, the ground truth here is what
endpoint #3 actually returns, dumped from the device after a real session:

```bash
adb shell run-as org.digitalgreen.farmerchat.sample.compose \
  cat shared_prefs/fc_sdk_preferences.xml            # key: fc_sdk_multi_language_labels_object
```

**287 entries, every one of them `fc_v2_*`-prefixed** (279 `fc_v2_app_label_*`, 8
`fc_v2_app_terms_of_use_*` / `fc_v2_approximate`). There are no short keys in the served map at
all, so any ad-hoc key is unresolvable by construction. Each platform's literal keys were then
tested against that set rather than eyeballed.

### Results

| Platform | call sites | distinct keys | resolve | **cannot resolve** |
|---|---|---|---|---|
| android compose (`Labels.kt`) | — | 273 constants | 265 | 8 † |
| iOS catalogue (`FCLabels`) | 123 | 262 constants | 255 | 7 † |
| **iOS raw-string `fcLabel("…")`** | **46** | **41** | **0** | **41** |
| **web `label('…')`** | **214** | **170** | **9** | **161** |

† These are correctly-shaped `fc_v2_app_label_*` keys the backend does not serve yet — the same
benign class already tracked for android. Not this bug.

So iOS's catalogue is healthy and the damage is confined to 46 call sites that bypass it; **web
has no catalogue at all** (`core/labels.ts` defines the manager, no constants) and 161 of its 170
distinct keys are invented. Web's `LabelManager.getLabel` itself is correct — it implements the
documented `override → ${key}_${lang} → ${key}_en → fallback → key` chain exactly, and applies no
prefix, which is why a short key silently lands on the English fallback.

An English fallback is indistinguishable from a correct render unless the UI is exercised in a
non-English language — which is the likeliest reason this survived, though the testing history
was not examined, so treat that as inference.

### Fixed in this pass (every one a zero-guess change)

| Platform | File | Change |
|---|---|---|
| android compose | `components/InputComposer.kt` | `placeholder` defaulted to the raw literal `"Ask about your farm..."`; now `label(Labels.ASK_ABOUT_YOUR_FARM, …)`. `HomeScreen.kt:1150` passed the label explicitly, which masked it on Home; `ChatScreen` took the default. **Verified on emulator-5554** — Chat now reads `ನಿಮ್ಮ ತೋಟದ ಬಗ್ಗೆ ಕೇಳಿ…`, the same served string the app shows |
| iOS | `ChatView.swift:69`, `HomeView.swift:43` | `fcLabel("type_placeholder", …)` → `fcLabel(FCLabels.askAboutYourFarm, …)`, the constant that already existed at `Labels.swift:42` and is served |
| iOS | `AuthView.swift:121` | `fcLabel("phone_placeholder", "Phone number")` → literal `"00000 00000"` — app parity, matching the android Auth fix |
| react-native | `AuthScreen.tsx:132` | `label('auth_phone_hint', …)` → literal `"00000 00000"` |
| web | `AuthScreen.tsx:150` | placeholder → literal `"00000 00000"`; `autoFocus` **removed** (app never focuses the phone field); `ariaLabel` → the served `fc_v2_app_label_enter_your_phone_number` |
| web | `inputs.tsx:82,90` | `label('input_type_placeholder', …)` → `label('fc_v2_app_label_ask_about_your_farm', …)` |

`farmerchat-android-views` needed nothing — all three call sites already resolved the label
(`ChatFragment.kt:256`, `HomeFragment.kt:253`, `InputOverlaysController.kt:165`); its
`Ask about your farm...` strings are `tools:` design-time attributes that do not render. RN's
composer was already correct at `ChatScreen.tsx:704` and `HomeScreen.tsx:793/833`.

Verification: android `compileDebugKotlin` ✅ and on-device ✅; iOS `xcodebuild -scheme
FarmerChatSwiftUI -destination 'generic/platform=iOS Simulator'` ✅ **BUILD SUCCEEDED**; web
`tsc --noEmit` ✅, `vite build` ✅, `npm test` ✅ 219 assertions; RN `tsc --noEmit` ✅.

### NOT fixed — the remaining 202 keys (open decision)

Re-measured against the served dump *after* the fixes above, **198 distinct keys are still
unresolvable**, and turning them green is a separate piece of work, not a side effect of a pixel
pass:

* **iOS: 39 distinct raw-string keys across 43 call sites** (every remaining raw-string site).
  Tractable — `FCLabels` already carries 262 confirmed constants, so most of these are a lookup
  away, but each still has to be confirmed against the served map.
* **web: 159 distinct keys across 201 call sites** — 201 of web's 213 `label()` calls. The
  catalogue has to be **built** first; only 10 distinct web keys resolve today.

CLAUDE.md §2 forbids inventing label keys, so each mapping must be read off the app's catalogue
and confirmed against the served dump — a wrong guess is silently invisible, because it just keeps
rendering English. The verification for that work already exists: dump
`fc_sdk_multi_language_labels_object` and assert every key the UI passes is present, which is
exactly the check used to produce the table above and is worth landing as a test.

### Follow-on: auto-focus parity on the Auth screen

Removing the phone field's `autofocus` on android raised the obvious question on the other
platforms, and the answer differed on each. The app's rule is **exactly one focused field**: its
`OtpInput` self-focuses on mount (`OtpInput.kt:46-52`, a `FocusRequester` in
`LaunchedEffect(enabled)`), and the phone field is never focused — which is why the keyboard does
not cover the agreement card and the two send buttons.

Critically, that focus lives **inside the OtpInput component**, not at the call site, so checking
only `AuthScreen` misses half the picture.

| Platform | phone field | OTP field | Action |
|---|---|---|---|
| android compose | `autofocus = false` ✅ | `Form.kt:401` `autoFocus = true` + `LaunchedEffect` ✅ | none — already a faithful port |
| react-native | `autoFocus` ✗ | `Inputs.tsx:213` `autoFocus` ✅ | **removed** the phone field's `autoFocus` |
| web | `autoFocus` ✗ | **no focus at all** ✗ | removed the phone field's; **added** a mount focus to `OtpInput` so the OTP box takes it |
| iOS | not focused ✅ | not verified | see below |

Web was the worst case and the one this pass could have made *worse*: taking `autoFocus` off the
phone field would have left the screen with no focused field anywhere, since its `OtpInput`'s only
`useEffect` is the Web OTP API autofill and never calls `.focus()`. Both halves shipped together.

**iOS is recorded, not fixed.** `AuthView` does not focus the phone field, which is correct, but
whether `FCOtpInput` takes focus on appear was not verified — SwiftUI focus needs a running
simulator and this pass only built. Flagged rather than changed blind.

---

## Analytics: MoEngage/Adjust/Plotline removal + PostHog adapter (2026-09-21)

### 1. There was nothing to remove

A grep for real SDK identifiers — `com.moengage`, `MoEngage`, `com.adjust`, `AdjustEvent`,
`io.plotline`, `Plotline`, `com.google.firebase`, `FirebaseAnalytics` — across every platform
tree returns **no dependency, no import, and no init call**. Root CLAUDE.md §6 has held since the
port: the SDK emits every event through the host-pluggable `FarmerChatAnalyticsListener` instead.

Every hit is one of four harmless things, and **three of them must not be deleted**:

| Kind | Example | Action |
|---|---|---|
| Explanatory comment | "the app tracks a Plotline ToS event; the SDK emits none" | keep |
| Endpoint name | `// #33 add_query_to_history (MoEngage qapair insert)` | keep — that is the endpoint's name |
| **Analytics property VALUE** | `LocationPromptManager.kt:487-488` maps `triggerSource` to `"MoEngage Campaign"` / `"Plotline Campaign"` | **keep** |
| Doc/README prose | "No Plotline, MoEngage, Adjust or Firebase" | keep |

The third row is the trap. Those strings are **values the app sends to the backend**, not
references to a linked SDK, and `AlignmentKindTest.kt:44` says so outright: *"Dashboards key off
these exact strings; a rename must fail here."* Deleting them would be a parity regression
dressed up as compliance. Renaming them is a backend-coordinated decision, not a code cleanup.

### 2. PostHog — a separate, opt-in adapter module

Added `:farmerchat-analytics-posthog` (`com.posthog:posthog-android:3.11.2`).

**It is deliberately NOT inside `farmerchat-core` / `-compose` / `-views`.** §6 bans vendor
analytics SDKs in the SDK packages, and this respects that: the SDK is unchanged, still emits
through its listener, and a host that never depends on this artifact links no PostHog at all. The
adapter is simply the best-known host sink, shipped so a host does not have to re-derive the
naming rules — which are subtle, and which iOS already paid for.

`PostHogNaming` is a line-for-line port of iOS `CompositeAnalytics.swift` › `PostHogNaming`
(FarmerChat-iOS-Agentic-v2.3). Both platforms report into the **one** PostHog project, so those
strings are a cross-platform wire contract; a divergence silently splits every insight. Pinned by
**14 unit tests** (`PostHogNamingTest`, all green), covering the snake rule, the capital-run rule
(`API_Call_Success` → `api_call_success`, not `a_p_i_…`), the four case-collision pairs, the `ToS`
event override, both misspelled property keys, the lower-case screen-name value, suppression, and
the card merge.

Ported behaviours that are bugs iOS already hit, not preferences:

* `captureApplicationLifecycleEvents = false` — PostHog emits `Application Installed/Opened/Updated`
  **unprefixed**, double-counting against the app's own `App_Installed/Opened/Updated`.
* `captureScreenViews = false` — the app sends `Screen_Viewed` itself.
* Person properties are **buffered until `identify`**. PostHog discards person properties on
  events sent while the device is still anonymous, so draining early does not merely fail — it
  throws the attributes away. SDK attributes are set during onboarding, which runs *before* guest
  init returns the id, so in the normal flow every one of them lands in that dead window.
* `enableAnalytics(true)` is forced by `attach()` — it defaults to **false** in 2.0.0, so without
  it the SDK builds every event correctly and drops it at the dispatch point, and PostHog receives
  nothing with no error to explain why.

**Credentials are never committed.** `POSTHOG_API_KEY` / `POSTHOG_HOST` come from `local.properties`
(gitignored) or `-P` gradle properties, into `BuildConfig`. A blank key means "PostHog off", logged
at warn — a missing key degrades to silence, never a launch crash. Same choice iOS made after
finding plaintext keys in a git history.

### 3. Verified on device (emulator-5554), not just compiled

Built with a dummy key pointed at an unreachable host (`http://10.0.2.2:1`) so **nothing left the
machine** — the connect failures in the log are the proof of that. Measured against one real
session of SDK traffic:

| SDK event | n | → PostHog | n | |
|---|---|---|---|---|
| `Dashboard_Viewed` | 1 | `dashboard_viewed` | **0** | suppressed ✅ |
| `Microphone_Click_Event` | 0 | `microphone_click_event` | 0 | suppressed (not exercised) |
| `Card_Shown` + `Card_Viewed` | 7 + 3 | `card_viewed` | **10** | merged, nothing lost ✅ |
| `API_Call_Initiated` | 2 | `api_call_initiated` | 2 | capital-run rule ✅ |
| `App_Opened` | 1 | `app_opened` | 1 | ✅ |
| `Screen_Viewed` | 2 | `screen_viewed` | 2 | ✅ |

Both paths exercised: with a key, `PostHog ON host=… key=phc_loca… flavor=agentic debug=true` and
events queue under the translated names; without one,
`PostHog is OFF: no API key supplied. Events will be dropped.` and the harness runs normally. The
shipped debug APK was rebuilt afterwards and contains no key.

Wired into **both** `sample-compose` and `sample-views`. The samples call the three functions
directly rather than `attach()`, because `attach()` REPLACES the callbacks and the harness must
keep its own logging; a real host with nothing else wired should just call `attach()`.

### Not done — iOS/RN/web parity for this adapter

An equivalent adapter exists on iOS **in the app, not the SDK** (that is where `PostHogAnalytics`
lives). RN and web have no PostHog sink. Recorded as a gap rather than built: those hosts wire
their own analytics listener today, and nothing was requested for them.

---

## Label keys, resolved (2026-09-21, later the same day)

### Correction to the audit above: "198 unresolvable" conflated two different things

The earlier entry counted every key absent from the served map as one problem. It is two, and
only one of them is a bug:

* **(a) A served translation EXISTS and the code uses a different key.** The user sees English
  where a translation was available. A real bug.
* **(b) The backend serves no entry for that string at all.** `getLabel` falls through to the
  English fallback, which is the only behaviour available. Not a code bug — a **content gap**.

Splitting them needed the English label map, which the earlier pass did not have (the device dump
is one language at a time, and it held Kannada). Fetched it directly:

```bash
curl "$BASE/api/language/v2/get_labels/?language=1" -H "Authorization: Bearer $TOKEN"   # 289 labels
```

The query param is **`language`, an integer id** (not `language_code`); English is `1` on DEV,
from `country_wise_supported_languages` (which itself requires `country_code` **and** `state`).

### Method: matched on the served English TEXT, so every mapping is verified

Each broken key's English fallback was normalised (case, trailing punctuation, ellipsis,
whitespace) and matched against the 289 served English values. Three tiers, and nothing was
applied on a score alone:

| Tier | Rule | web | iOS |
|---|---|---|---|
| A | exact normalised text match | 86 | 1 |
| B | ambiguous, resolved by what the CALL SITE means | 5 | — |
| C | fuzzy ≥ 0.88, each one eyeballed individually | 4 | 5 |

Fuzzy top-1 is **not** trustworthy on its own and was not trusted: `"Location unavailable"` →
`link_unavailable` scores 0.83 and is plainly wrong; `"Saved!"` → `save` scores 0.80 and is a
toast matched to a button. Those were rejected. Where a candidate was arguable it was settled
against **android's own call site**, not by score — `home_share_location` → `set_your_location`
because `LocationButton.kt:161` uses exactly that key in exactly that position, and
`select_country` → `select_country_code` because `AuthScreen.kt:817` does.

### Result

| | before | after |
|---|---|---|
| web distinct keys resolving | 10 / 169 | **84 / 148** |
| web unresolvable CALL SITES | 201 | **80** |
| iOS raw-string keys resolving | 0 / 39 | 6 mapped, all onto existing `FCLabels` constants |

121 web call sites and 6 iOS call sites rewritten. The remaining 64 web keys and 33 iOS keys are
category (b) — the backend has no entry, so English is correct behaviour. They are now **tracked**
rather than merely absent.

### The guard that stops it recurring

`web/test/labelKeys.test.ts` + two fixtures:

* `servedLabelKeys.json` — the 289 keys endpoint #3 returns.
* `unservedLabelKeys.json` — the 64 with no server entry, an explicit allowlist.

A key must land in one list or the other, deliberately. The test also ratchets the allowlist
(`<= 64`, meant to fall) and asserts nothing allowlisted is actually served. **Verified it fails
on a regression**, not just that it passes: injecting `label('totally_invented_key', 'x')` fails
the run and names the file. Wired into `npm test`.

Verification: web `tsc --noEmit` ✅, `vite build` ✅, `npm test` ✅ (219 assertions + 3 guard tests);
iOS `xcodebuild -scheme FarmerChatSwiftUI` ✅ **BUILD SUCCEEDED**.

### Still open

iOS has no equivalent guard — the fixtures live in the web package. Worth lifting into a shared
check, since iOS is the platform with a healthy catalogue that call sites can still bypass.

---

## End-to-end device pass, compose + views (2026-09-21)

Driven on emulator-5554 from a wiped install (`pm clear`) through onboarding → language →
EnterName → Home → drawer → Settings → Help → Chat, on **both** Android flavours. No crash, no
ANR, no unhandled exception on either. Two real bugs found, both fixed and both re-verified on
device.

### BUG 1 — the Home greeting was invisible (compose, legacy/non-composer Home)

White text on the page's light grey: **#FFFFFF on #ECECEE, contrast 1.18:1**, where WCAG AA wants
3.0:1 for large text. The line rendered and could not be read.

Cause: the SDK's greeting `Crossfade` carried **no modifier at all**, where the app's
(`HomeScreen.kt:1121`) carries
`.fillMaxWidth().heightIn(min = 40.dp).background(brandColor.surfacePrimary).wrapContentHeight(...)`.
The missing `.background()` is the whole bug — the text colour is `foregroundPrimary`, which is
WHITE on this brand and only ever intended to sit on the green band.

Fixed by porting the app's chain. Re-measured on device: **4.95:1**, which clears AA for normal
text, not just large.

Scope: this is the `!isComposerUi` (legacy) Home only, and both the 1.18:1 and 4.95:1 readings
were taken there. The agentic Home draws the fixed overlay header instead and never renders this
greeting, so it was never affected and is not covered by that measurement.

### BUG 2 — the Home greeting rendered English on a Kannada device (compose AND views)

Independent of Bug 1 and worse, because it is a localisation failure rather than a styling one.

Both flavours preferred the #12 response's `greeting` field over the label:

```kotlin
val greetingText = feed.greeting?.takeIf { it.isNotBlank() } ?: label(GET_STARTED_…, "…")
```

The API's `greeting` is **English-only**. The label is translated — the served values are:

| | |
|---|---|
| `…_en` | `Ask by Voice, Photo or Text` |
| `…_kn` | `ಮಾತನಾಡಿ, ಫೋಟೋ ಕಳುಹಿಸಿ ಅಥವಾ ಬರೆದು ಕೇಳಿ` |
| **rendered** | `Get started by clicking on Photo, Speak, or Type to ask your question` |

The rendered string matched **neither** the served value nor the source fallback, which is what
gave the API field away.

**The app reads `.greeting` nowhere** — `grep '\.greeting'` on its HomeScreen returns nothing. Its
variable is misleadingly *named* `greetingFromApi` while holding `getLabel(...)`, which is very
likely how the port went wrong.

The old code's justification ("prefer the API greeting … never a permanent skeleton") inverts:
`label()` always returns something — served string, fallback, or the key — so the label alone can
never be null and the skeleton cannot stick. Both flavours now use the label only
(`HomeScreen.kt`, `HomeFragment.kt`).

Verified on device, and the two flavours were verified on different branches — worth stating
rather than implying one run covered both:

* **compose** — on the **legacy** Home (`!isComposerUi`), which is where this code path lives. The
  agentic Home never renders this greeting.
* **views** — on its Home, where the greeting is the `renderStaticTexts()`-seeded TextView that
  the API field used to overwrite.

### Views flavour — chat CONFIRMED WORKING

Previously recorded as "never seen rendering a chat answer" across three attempts. It works:
question bubble, full Kannada streamed answer, the read-full CTA, the Share/Download/Listen row,
and the follow-up section with its chip all render. The earlier failure was the emulator's DNS
outage, **not** a views defect — that entry should be read as retracted.

### Smaller divergences observed, recorded not fixed

* **EnterName autofocus**: compose focuses the name field (keyboard opens); views does not. Not
  checked against the app — it skips this screen for this guest.
* **EnterName subtitle wrap**: compose wraps to two lines, views renders one full-width line.
  Different horizontal padding; a candidate for the same section-rhythm fix applied to the other
  screens.

### Method note worth keeping

`pm clear` + a single `am start --es profile agentic` does **not** apply the profile — the sample
reads the extra *after* `Application.onCreate`, so the first run silently uses `dev`. That is why
the first pass exercised the legacy Home (and found both bugs there). Force-stop and relaunch, then
confirm with `run-as … cat shared_prefs/fc_sample.xml` before trusting which UI you are looking at.

### Verification

android `:farmerchat-core` / `-compose` / `-views` compile ✅, posthog adapter tests ✅ 14,
both samples assemble ✅, both exercised on device ✅; web `tsc` ✅ `vite build` ✅ `npm test` ✅
(219 assertions + 3 label-key guards); RN `tsc` ✅; iOS `xcodebuild` ✅.

### BUG 3 — views agentic Home printed the section title twice

Found by running the **views** sample on the `agentic` profile (the first pass had silently used
`dev`, see the method note above).

In composer mode `HomeFragment.renderStaticTexts():199` sets the header TextView to
`FOR_YOUR_FARM_TODAY`, and `HomeFeedAdapter.submit()` **also** emitted `Item.Header`, which binds
the same label. The one served string rendered twice, stacked — large, then small
("ರೈತರು ಹೆಚ್ಚು ಏನು ಕೇಳುತ್ತಿದ್ದಾರೆ ಎಂದು ತಿಳಿಯಿರಿ").

Compose has always guarded this (`HomeScreen.kt:926`, `if (!isComposerUi) { item("feedHeader") … }`)
with a comment saying exactly why. Views never got the guard. `submit()` now takes
`showHeader: Boolean = true` and `HomeFragment` passes `!isComposerUi`. Re-verified on device: the
title renders once.

**Why it went unseen:** the views sample defaults to the `dev` profile, and the profile extra is
only applied on the *second* launch. Every casual run of views therefore exercises the legacy Home,
and this bug only exists in composer mode.

---

## Views agentic pass, screen by screen (2026-09-21)

Views had **zero** pixel verification before this — the whole fidelity harness was "android compose
vs the app". Comparing views directly against the app (ground truth, `919e5b2f`), on the `agentic`
profile.

### Screen 1: the navigation drawer — was substantially wrong

The panel was **white**. The app's is dark green. Measured at the same pixel on both:
app `(8,54,27)`, views `(255,255,255)`.

**Root cause: the two palettes share member names.** `surfaceSecondary` is `#FFFFFF` in the
NEUTRAL palette and `#08361B` in the BRAND palette. Compose's drawer takes
`brandColors.surfaceSecondary` (`Drawer.kt:233`); views' layout took `@color/fc_surface_secondary`
— the neutral one — and every text colour followed it into the light-theme set. One wrong token
inverted the entire surface.

Seven divergences found and fixed, each derived from `Drawer.kt` and confirmed against the app:

| | app / compose | views before | fix |
|---|---|---|---|
| Panel | `brandColors.surfaceSecondary` #08361B | `fc_surface_secondary` #FFFFFF | → `fc_brand_surface_secondary` |
| Header | `fc_logo_wordmark`, 16dp tall, inset 24dp | `fc_logo_mark`, 44dp | wordmark copied from the compose module (not recreated) |
| Header top inset | — | 48.8 dp too low | 56dp → 7dp; measured 128px offset, now **1px** |
| Row icons | intrinsic #00C950 green | `drawableTint` forced them WHITE | tint removed — `fc_icon_*` already carry the green |
| Selected row | current route filled `surfaceTertiary` @ Radius.MD | **no selected state at all** | `highlightCurrentRow()` off `navController.currentDestination` |
| Footer | `surfaceTertiary` card, 12dp inset, Radius.LG, centred | unbacked, left-aligned 20dp block | rebuilt as the card; title/subtitle colours were also **swapped** vs `Drawer.kt:471/480` |
| Sign-up CTA | Green700 pill + chevron | **no pill at all** — dark-on-dark | `fc_bg_primary_button_on_brand` (#008236) + `State.CHEVRON` |

The CTA is the same class of bug as the panel: `PrimaryButtonView` fills with
`fc_button_primary_surface` (#08361B), correct on the light reading surface and invisible on the
drawer. Compose solves it by swapping in `DarkContentColors`, whose `buttonPrimarySurface` is
Green700 — the exact #008236 measured on the app's CTA.

**After:** panel, footer card and CTA all match the app at identical coordinates —
`(8,54,27)` / `(3,46,21)` / `(0,130,54)`. Panel-interior `pixdiff` is **5.59%**, and the residual
is characterised, not unexplained:

* the wordmark is **pixel-identical in width and x** (both 328×41 at x 63..391), offset **1px**
  vertically — enough to make every glyph edge differ;
* all four nav rows start at **exactly x=165** on both sides with matching row tops;
* what remains is Compose-text vs `TextView` rasterisation of the same Kannada strings.

### Two method notes worth keeping

**`pixdiff` missed the selected-row fix.** Before the fix the Home row was `(8,54,27)` against the
app's `(3,46,21)` — a per-channel delta of 5/8/6, **under the default tolerance of 28**. The whole
drawer read as "no selection" to the eye while the tool reported no difference there. Sampling
named pixels caught it. Treat a low pixdiff as *necessary, not sufficient*, for dark-on-dark UI.

**The row font weight went the other way from the token.** `labelMedium` is nominally 600, so
`textFontWeight=600` looked like the correct port — it rendered visibly LIGHTER than the app
(ink to x=496 vs the app's x=513). Compose synthesises 600 against the system family and lands
heavier than a TextView does. Kept `bold` **on the measurement, against the nominal token**.

### Screen 2: Help — five defects, four of them user-visible

| # | Defect | Cause | Fix |
|---|---|---|---|
| 1 | Footer read **"FarmerChat v.1.0.0"** on a tree that publishes 2.0.0 | `HelpFragment.SDK_VERSION` hardcoded | see the version section below |
| 2 | **Terms of Use / Privacy Policy rendered in ENGLISH** on a Kannada device | `terms?.title ?: label(...)` preferred the #legal payload's English title | row titles now take the served label; the payload title still names the WebView page. Identical to the compose fix (`HelpScreen.kt:198`) |
| 3 | Copyright line **effectively invisible** | `fc_foreground_tertiary` (#D4D4D8) on a near-white surface; compose uses `foregroundSecondary` for BOTH footer lines | → `fc_foreground_secondary` |
| 4 | FAQ rows **wrapped to two lines**; the app ellipsizes to one | no `maxLines`/`ellipsize` | `maxLines=1` + `ellipsize=end` |
| 5 | **No dividers** between rows | not declared | `divider` + `showDividers="middle"` on both list cards |

Plus a compounding layout error: rows were `wrap_content` + 16dp vertical padding where compose
uses a **fixed `height(48.dp)`** (`Lists.kt:88`). Each row came out ~8dp taller and **the error
accumulated** — by the footer the two screens were **146px apart**. With the fixed height, rows
align 1:1 and the worst band deviation is **≤22px**, down from 146.

Screen rhythm also corrected: `padding="20dp"` uniform → **20dp sides / 32dp ends**, section gap
28→24dp, matching `HelpScreen.kt:117-118` (the same systemic fix already applied to compose).

**Recorded, not fixed:** the app tucks the chevron immediately after the row text (it moves with
the label); views pins it to the right edge. This is the `ListItem` weight behaviour fixed in
compose, and needs the same treatment in the views row layout.

### The SDK reported the wrong version to the backend

Chasing defect 1 found something larger. The root build publishes **2.0.0**
(`farmerChatVersion`), but three places hardcoded `1.0.0`:

| | effect |
|---|---|
| `DeviceInfo.SDK_VERSION_NAME` | **sent as `app_version_name` in the Device-Info header on EVERY request** — a 2.0.0 SDK announced itself to the backend as 1.0.0 |
| `FarmerChatVersion.VERSION` | the public runtime version constant, whose own doc comment claims it is "kept in sync with the `farmerChatVersion` declared in the root build script" |
| `HelpFragment.SDK_VERSION` | views' Help footer |

…while compose's Help separately hardcoded `"2.0.0"`, so the two flavours disagreed with each
other as well as with Gradle.

Fixed by making Gradle the single source: `farmerchat-core` now generates
`BuildConfig.SDK_VERSION_NAME` from `project.version`, and all four sites read it. Verified on
device — views Help shows **v.2.0.0**. Nothing client-side validates the header, which is why
this survived: the only symptom was a wrong number in someone else's dashboard.

### Screen 3: Settings — six defects

| # | Defect | Cause | Fix |
|---|---|---|---|
| 1 | Selected appearance tile **filled light green** `#C6E6D5`; the app keeps it **white** `#FFFFFF` and rings it | `fc_bg_selected_option` fills with `fc_surface_active` | new `fc_bg_appearance_tile[_selected]` — surfaceSecondary + 2dp `borderActive` ring at Radius.LG, verified against the app's own `SettingsScreen.kt:436-441`. The shared drawable has other callers, so this is a new one rather than a mutation |
| 2 | Account rows rendered as a **two-line stack** (13sp label above a 16sp value) | a vertical `LinearLayout` per row | rebuilt as the app's single line: label unweighted at natural width, value weighted + end-aligned, both `bodyMedium` 17sp (`Lists.kt:116`) |
| 3 | Two separate cards with a 10dp gap; the app draws **one card with a hairline** | — | merged, `showDividers="middle"` |
| 4 | Name row's **value column blank** | **two writers** — `renderTexts()` applied the em-dash placeholder, the profile-state collector did not, and it ran second and overwrote it | one `renderNameValue()` helper, used by both |
| 5 | Chevron **all but invisible** (`fc_foreground_tertiary` #D4D4D8 on white, 20dp) | — | 24dp, `foregroundPrimary` — the app's measures `#000000` (`Lists.kt:168`) |
| 6 | Rows `wrap_content` + 16dp padding | — | fixed 48dp rows in a card padded 16/6/16/4 (`Lists.kt:53,88`) |

Screen rhythm corrected as on Help: `padding="20dp"` uniform → **20dp sides / 32dp ends**.

**Result:** both account rows now match the app's x-extents *exactly* — `101..982` against the
app's `101..983`, and `101..963` against `101..963`. Worst band deviation **36px**, down from an
accumulating **71px** with a structurally different account block.

Residual is accumulation: the appearance tile renders 6px taller (207 vs 201) and each section
gap is a few px long. Every x-extent matches; the drift is vertical only.

#4 is the most interesting defect of the three screens. It is not a layout or token mistake —
it is **two code paths writing the same view**, where only one knew the rule. A screenshot showed
a blank column; only reading both writers explained it.

### Screen 4: LanguageChooser — and the systemic cause of every views vertical drift

Four defects, plus the finding that explains the accumulating offsets on **all** views screens.

| # | Defect | Fix |
|---|---|---|
| 1 | Selected row rendered `#C6E6D5`; the app renders `#A6E1C0` | see below — it is a **double** composite |
| 2 | List flush under the app bar (13dp above the app's first row) | `paddingTop=32dp`, `paddingBottom=20dp`, `clipToPadding=false` (`LanguageChooserScreen.kt:156`) |
| 3 | Save button had no chevron | `State.CHEVRON` when idle (`:238`) |
| 4 | "All languages" chip 18px too wide | `textStyle="bold"` (700) → `textFontWeight="600"`, matching `labelLarge` |

**The selected-row colour was not a wrong token.** Views used `fc_surface_active` (#2900C950) —
the *right* token, applied once. Compose's `RadioButton` applies that translucent value **twice**:
`Surface(color = bg)` and again on the inner Row via `Containers.flat(background = bg)`
(`Form.kt:271,277`). Two composites over the page produce the opaque `#A6E1C0`.

Settled by measuring three renderers at the same pixel rather than reading code:

| app | compose | views |
|---|---|---|
| `#A6E1C0` | `#A6E1C0` | `#C6E6D5` ✗ |

A single XML `<shape>` cannot stack an alpha twice, so `fc_surface_active_double` states the
composite result, with the derivation in the comment. It is shared with the Home select-card
options, which use the same component in compose.

### `includeFontPadding` — the systemic vertical drift

**Compose 1.6+ defaults `includeFontPadding` to FALSE; a TextView defaults it to TRUE** and adds
~3dp of leading per line. Views set it nowhere, so **every** text row ran ~8px taller than the
app's and the error accumulated down each screen.

Applied through the theme's default `TextView` style so it reaches every row at once
(`themes.xml` → `FcTextView`). Measured before/after, per screen:

| Screen | max \|dy\| before | after |
|---|---|---|
| LanguageChooser | ~8px **per row**, accumulating | **3 px** |
| Settings | 36 px | **18 px** |
| Help | 32 px | 33 px (unchanged) |

Net win, kept. Checked for the obvious risk — Kannada ascenders/descenders (ಫಾರ್ಮರ್‌ಚಾಟ್,
ಪ್ರಶ್ನೆಗಳನ್ನು) render **uncliped** on both Help and Settings.

Help also gained compose's `ListCard` vertical padding (6dp top / 4dp bottom, `Lists.kt:53`),
which pulled its footer from **-31px to -4px**. Its horizontal padding stays on the row: rows are
added programmatically with `container.addView(...)`, and padding on the card did not inset them
(measured: text jumped 43px left), so the row keeps its own 16dp.

**One measurement corrected a fix of mine.** I had changed the save button from a fixed 56dp to
`wrap_content`, reasoning from the SettingsName screen where the app takes PrimaryButton's 48dp
default. The app's LanguageChooser button measures y2169..2315 = 146px = **55.6dp** — 56dp was
right, and the two screens genuinely differ. Restored; the button now matches the app **exactly**
(`2169..2315`, `x63..1016`).

**Recorded, not a layout bug:** the app's chooser shows "English" where views shows
"English (India)" (a 141px x-delta that dominates the raw `banddiff` number). Both flavours run
identical code — `language.displayName.ifBlank { language.name }` — so this is a data difference
in which list the two sessions were served, not a rendering one.

### Screen 5: SettingsName — 927px → 8px

| # | Defect | Fix |
|---|---|---|
| 1 | **No "Your name" label** above the field — the screen opened with an unlabelled box | `labelMedium`, `foregroundPrimary`, 8dp clear of the input (`Form.kt:65-67`) |
| 2 | Field **did not take focus**; the app opens with the keyboard up | `requestFocus()` + show the IME (`SettingsNameScreen.kt:148`, `autofocus = true`) |
| 3 | **Focused border was grey** — a focused field looked identical to an idle one | focus-aware selector; focused = 2dp `borderActive` Green500, measured on the app at `(0,201,80)` (`Form.kt:39,48`) |
| 4 | Field text 16sp | 19sp — compose uses `bodyLarge` |
| 5 | Screen padding 20dp uniform; label→button gap 20dp | 20 sides / 32 ends; gap 16dp (`spacedBy(16.dp)`) |

**Result: max deviation 8px (3dp), every x-extent exact.** The label lands within 1px.

Note #3 is a state bug, not a static one: views had **one** drawable for both states, so nothing
in a screenshot of an idle field would ever reveal it. It only showed up because the app's capture
had the field focused and views' did not — i.e. the *autofocus* fix (#2) is what exposed it.

### Screen 6: Auth (phone step) — four defects

| # | Defect | Fix |
|---|---|---|
| 1 | **The app bar was white with dark text** — the only screen in the flavour whose bar was not the brand green one | Auth hand-rolled its own 56dp `FrameLayout` bar instead of the shared `fc_view_appbar` include every other screen uses (compose also uses the shared `DefaultAppBar` here, `AuthScreen.kt:316`). Swapped to the include; close glyph + round chip set in the fragment |
| 2 | Phone hint was `label(ENTER_PHONE_NUMBER, …)` — the screen's **HEADING**, so a full Kannada sentence sat inside the input | literal `"00000 00000"` |
| 3 | Channel buttons had **no leading icons** | `PrimaryButtonView` gained `setLeadingIcon()` — 24dp icon, 8dp gap (`Buttons.kt:212-215`); Auth passes `fc_icon_whatsapp` / `fc_icon_sms` (`AuthScreen.kt:515,530`) |
| 4 | Screen offsets | app bar swap alone pulled the body from -52px to -31px |

Defect 2 is the **fifth** platform to carry that exact label-key misuse — compose, iOS, RN and web
were fixed earlier the same day. Views was missed because the earlier sweep searched `label(` /
`fcLabel(` call sites in Kotlin/Swift/TS UI code and views sets the hint imperatively on a binding.

**Not a defect:** the app showed ONE channel button (SMS) where views shows two. Views gates on
`state.availableChannels.whatsappEnabled` — the identical field compose uses — so this is the
per-country channel config from endpoint #20 differing between the two sessions, not a code
divergence.

Still open on this screen: body content sits ~31px above the app's, and the country chip renders
a `↓` caret the app does not show. Recorded, not chased.

### Screen 7: LegalContent — 0 px

Two defects, both already seen elsewhere:

1. **The same hand-rolled white 56dp app bar as Auth.** Swapped to the shared `fc_view_appbar`
   include with a round close chip (compose uses `DefaultAppBar` here too,
   `LegalContentScreen.kt:62`).
2. **The title rendered in English** — "Terms of Use" where the app shows "ಬಳಕೆಯ ನಿಯಮಗಳು".

**Result: 0 px across all 25 bands.** The WebView content was already identical — every content
band measured `dy -21 / dx ±0` before the fix, i.e. perfectly aligned and uniformly shifted by
the wrong bar height. Fixing the bar alone brought the whole screen to zero.

**A correction to my own earlier note.** When fixing the Help row titles I wrote that the #legal
payload's `title` "is still the right thing to pass to the WebView as its page title." That was
wrong, and the app disproves it: its legal screen bar reads the Kannada label. Both call sites now
pass the served label, and the incorrect comment is removed rather than left to mislead.

Worth noting how this one was found: the app bar was the ONLY defect, and it produced a uniform
21px offset on all 24 content bands. A whole-screen `pixdiff` would have reported a large area
differing and said nothing about why; the per-band `dy/dx` split made it obvious in one read that
the content was perfect and only the chrome above it was wrong.

### Screens 8-9: onboarding Language, and the agentic Home header

**Language (onboarding).** Views used 20dp horizontal where the app uses **24dp**
(`LanguageScreen.kt:170`) and had no top inset at all.

| | before | after |
|---|---|---|
| logo mark | 21px high | **exact** (212..295 both) |
| rows | x53..1026 vs the app's x63..1016 | within **1px** |
| rows (vertical) | 21px+ high, accumulating | within **5px** |

The top inset is **8dp, not compose's 32dp** — a measured value that contradicts the source.
Views' container is `fitsSystemWindows=true`, so the parent has already consumed the status-bar
inset that compose adds explicitly as `topInset + 32.dp`. Copying compose's number overshot by
63px; the measurement said 21px (8dp).

Footer still renders ~75px taller: views' legal paragraph wraps to more lines than the app's at
the same measured width (x199..878 vs x200..879). Recorded, not chased.

**Home (agentic header).** Two of the three missing pieces are now ported:

| Piece | Before | After |
|---|---|---|
| Centred logo mark (42dp) | absent | ✅ added, gated on composer mode |
| Title | 24sp → wrapped to TWO lines | ✅ 18sp `titleMedium` (`SectionHeader`), one line |
| **Location pill** | absent | ❌ **still absent** |

The title was 24sp where compose's `SectionHeader` is `titleMedium` = **18sp**; the oversize is
what forced the Kannada string onto a second line.

**The location pill is deliberately NOT ported.** It is not markup — `HomeLocationPill`
(`HomeScreen.kt:1429-1500+`) carries live state: a resume-tick permission re-check, `denyCount >= 2`
persistent-block handling, four `LocationTriggerSource` states for interstitial/permission/GPS/
fetching, and a profile-backfill fallback for the approximate place name. Each drives WHAT the
pill says — exact location, approximate, "Set your location", or "Getting your location".

A half-ported pill would show a farmer the wrong location status, which is worse than no pill.
Scoped as its own task. It accounts for the remaining 74px: the app's first card rests at y655,
views' at y581, and the gap is exactly the pill's band (app y542..574).

---

## Source-level sweep of all 18 named components (2026-09-22)

Several of these cannot be captured at runtime — `TermsOfUseUpdatedBottomSheet` needs a ToS
version bump, `PermissionSettingsDialog` needs a twice-denied permission, `ChatHistoryScreen` and
`AccountSuccessScreen` need a real OTP, and `SplashScreen` lives for ~200ms. For those the **app
source is the only ground truth**, so the sweep compares design VALUES rather than pixels.

### Method

`tools/fidelity/valdiff.py` extracts the ordered design constants a composable uses — `dp`/`sp`
numbers, `colors.*` tokens, typography slots, `Radius.*`, font weights — from the app's function
body and the SDK's, and diffs the multisets.

It is a **screening tool, not proof**: it ignores *where* a value is used, so every hit was read
in context before being called a defect. Two caveats it taught:

* It initially reported "0 distinct app values" for `HelpScreen`, `SettingsScreen` and
  `LanguageChooserScreen` — a bug in the tool, not a finding. `src.index("{", …)` grabbed a
  **default-argument lambda** (`onOpenUrl: (…) -> Unit = { _, _ -> }`) as the function body. Fixed
  by skipping the parameter list first.
* A delta of the form `app x0 / sdk x1` is usually **additive**, not conflicting — the SDK naming
  a token the app leaves to a component default. `EnterNameScreen`'s five "differences" are all of
  this kind, and every dp value matches.

### Defects found and fixed

| Component | Defect | Source |
|---|---|---|
| **SplashScreen** (compose) | rotating logo **72dp**, app is **100dp** | `SplashScreen.kt:203` |
| **SplashScreen** (views) | same logo at **96dp** — a third value | `fc_fragment_splash.xml` |
| **FarmerIllustration** (4 call sites) | capped at **300dp**; every app site that supplies its own illustration uses **322dp** | `AccountSuccessScreen.kt:82`, `AppNavGraph.kt:832`, `LocationPromptHost.kt:746/791/864` |
| **ChatHistoryScreen** | list `PaddingValues(16.dp)` flat; app is **20dp horizontal / 8dp vertical** | `ChatHistoryScreen.kt:160` |
| **ChatHistoryScreen** | date-group header `top 8 / bottom 4`; app is **12 / 8** | `:170` |
| **ChatHistoryScreen** | pagination spinner `vertical 12dp`; app is **24dp** | `:213` |

The illustration fix is a **parameter, not a changed default**. 300dp is correct — it mirrors
`FullScreenMessage`'s own fallback box (app `NoInternetScreen.kt:158`). The 322dp values are
call-site overrides, so `FarmerIllustration` gained `maxWidth: Dp = 300.dp` and the four SDK call
sites pass 322. Readers were enumerated before touching the shared component, per the standing
rule.

The ChatHistory list padding is the **fourth** screen with the same flat-padding mistake already
corrected on Help, Settings and LanguageChooser.

### Verified clean — no action

| Component | Evidence |
|---|---|
| `PermissionSettingsDialog` | 18 app values, **0 differ** |
| `TermsOfUseDialog` | 5 values, **0 differ** |
| `TermsOfUseContentDialog` | 7 values, **0 differ** |
| `AppDrawer` (compose) | **0 differ** |
| `SettingsNameScreen` | 4 values, **0 differ** |
| `EnterNameScreen` | all dp match; 5 additive token names |
| `TermsOfUseUpdatedBottomSheet` | see below |

**`TermsOfUseUpdatedBottomSheet` is a deliberate non-defect.** The tool flagged a missing 180dp
header banner. The app's `bannerRes` parameter defaults to null and its **only call site**
(`HomeScreen.kt:1836`) never passes one — so the banner is dead code in the app too, and the SDK
rendering only the info-icon branch is correct. Recorded so it is not "fixed" later.

### Already runtime-verified — source deltas are implementation differences

`HelpScreen` (2px), `SettingsScreen` (1px), `LanguageChooserScreen` (0px), `LanguageScreen` (0px)
and `AppDrawer` were measured against the app on device. Their remaining source deltas (the SDK
using a 48dp fixed row height where the app pads, an extracted shimmer skeleton) produce identical
output — a rendered 0-2px measurement is stronger evidence than a value count, so no action.

### Not verified either way

`SplashScreen` at runtime — it lives ~200ms and the capture caught the app's boot icon against a
compose frame that had already routed. The 72→100dp fix is **source-derived, not pixel-confirmed**.

---

## Strict per-pixel sweep: compose is matched, views has a structural ceiling (2026-09-22)

Every earlier number in this document came from `banddiff`, which compares ink-BAND geometry. This
pass compares **every pixel** (tolerance 28/channel) against the app, for both flavours.

### The measurement harness had to be rebuilt first

Three successive capture runs produced **invalid data** before this worked:

1. Blind coordinate taps drifted — all of `settings`/`help`/`legal` captured the *same* screen.
   Caught only because three different pairs returned an identical diff count (127724), which is
   not possible by chance.
2. A views capture returned the **app's** Auth screen byte-for-byte: the views `am start` had
   silently failed and the app's task was restored. Now asserted via `topResumedActivity`.
3. The views APK install had gone stale mid-run (`Activity class does not exist` right after a
   successful install).

Fixed by driving navigation from **`uiautomator dump`** — tapping the centre of the node whose
text matches the served Kannada label. Both flavours resolve the *same* served labels, so one
selector drives both. Every capture now logs the node it hit and a crop signature.

**Any pixel number produced by blind coordinate taps should be treated as unverified.**

### Results (tolerance 28, y150..2320; drawer measured panel-only, x0..780)

| Screen | app vs **compose** | app vs **views** |
|---|---|---|
| drawer | **0.02%** | 5.90% |
| settingsname | **0.05%** | 3.75% |
| langchooser | **0.13%** | 2.62% |
| settings | **0.15%** | 5.29% |
| legal | capture invalid | 1.48% |
| help | capture invalid | 6.81% |
| auth | capture invalid | 20.68% † |

† inflated by content, not layout: the app's session offered ONE channel (SMS), views' offered two.
Both gate on the same `availableChannels` field.

**Compose is pixel-matched to the app — 0.02%-0.15% on every screen captured validly.** That is
the flagship UI and it is done.

### Why views cannot reach that, and it is not a layout defect

Splitting views' residual by row:

| | rows | differing px |
|---|---|---|
| rows containing app text | 774 | **118,223** |
| rows with no text | 1,396 | 5,838 |

**95.3% of every differing pixel is on a row containing text.** The non-text majority of the
screen — cards, surfaces, spacing, dividers, colours — differs by 0.27%. views' layout is right.

The cause is text-engine weight synthesis, measured on the "Appearance" section title (same string,
same nominal 17sp, same y on all three):

| | ink width |
|---|---|
| app (Compose, `labelLarge` 600) | **189px** |
| compose SDK | **189px** — identical, diff of exactly **0** in that band |
| views `textStyle="bold"` (700) | 199px (+10) |
| views `textFontWeight="600"` | 180px (−9) |

**The app's weight sits between what a TextView renders at 600 and at 700.** Compose synthesises
an intermediate weight from the system family that the platform `TextView` cannot reproduce with
either value. Neither is "the bug"; there is no correct value to port.

Kept at **600** — it is the nominal token value and marginally closer (−9 vs +10).

**Conclusion: `farmerchat-android-views` can be made structurally and chromatically identical to
the app, but not pixel-identical, while it renders text through `TextView`.** Pixel-identity would
require the views flavour to draw its text with Compose, which is the one thing a Views flavour
exists not to do. If pixel-identity is a ship requirement, ship the compose flavour.

### Real defects this sweep still found and fixed (views Settings)

Visible in the diff mask, missed by every band-level pass:

| Defect | Detail |
|---|---|
| **Appearance icons were the wrong drawables** | views used `fc_ic_sun/moon/auto`; the app and compose use `icon_mode_day/night/auto`. Different glyphs — the "auto" icon was a spiky asterisk against the app's half-filled circle. The app's three icons are now copied into views |
| **Location row had no chevron** and inverted styling | 13sp grey label over a 16sp dark value; compose routes this row through the shared `ListItem` — both sides 17sp, label `foregroundPrimary` natural-width, value `foregroundSecondary` weighted and end-aligned, then a 24dp chevron |

Neither was visible to `banddiff`: the icons occupy the same band, and the chevron is
`foregroundPrimary` inside an existing band.

---

## Views renders text through Compose — `FcText` (2026-09-22)

### Correcting my own conclusion

The previous entry concluded views had a "structural ceiling" it could not cross. **That was
partly wrong, and the correction matters.** Two of the three causes were fixable:

| Cause | Verdict |
|---|---|
| Font-weight synthesis | **FIXABLE, fixed.** `android:textFontWeight` only interpolates against a *named* family; with the default typeface it snapped to normal/bold, so a nominal 600 rendered at 400's width (180px vs the app's 189px). `android:fontFamily="sans-serif"` on the default TextView style fixed the metrics — title to 191px, and the 400-weight hint line to **exactly** the app's 900px |
| Paint flags | **Not the cause.** Both engines lay out through `StaticLayout`; forcing `SUBPIXEL_TEXT_FLAG` + `LINEAR_TEXT_FLAG` moved the diff 0.06%. Reverted |
| Glyph rasteriser | **Real.** With metrics matched, one aligned line of the same string at the same 900px width still differed by **12,784px** — more than its own 8,866px of ink — while app-vs-compose in that band was **0** |

### `FcText`

`internal/widgets/FcText.kt` — an `AbstractComposeView` that renders `BasicText` with the app's
type values. It exposes a `text` property and `setTextColor(Int)`, so existing view-binding call
sites (`binding.x.text = "…"`) compile unchanged.

Deliberate choices:

* **`BasicText`, not material3 `Text`** — the only thing needed from Compose is the rasteriser, so
  the module takes `compose.ui` + `compose.foundation` and **not** material3.
* **Views does NOT depend on `:farmerchat-android-compose`.** That would put its
  `FarmerChatActivity` on every views host's classpath, and `FarmerChat.resolveActivityClass()`
  tries the compose activity FIRST — a views host would silently launch the Compose UI. Raw Compose
  libraries only.
* Line height comes from the existing per-script `FcTypography` table, so a converted view keeps
  the Indic line spacing it already had.

### Proof on the Settings section title

| | ink bbox | glyph px | diff vs app |
|---|---|---|---|
| app | `(54,243,385,421)` | 2235 | — |
| views, `textFontWeight=600` | width 180 | — | — |
| views, + `fontFamily` | width 191 | — | — |
| **views, `FcText`** | **`(54,243,385,421)`** — identical | **2235** — identical | **2789** |
| **views, `FcText` + correct colour** | identical | identical | **0** |

The last 2789 pixels were **not** rendering at all — the views title used
`fc_foreground_secondary` (#52525C) where the app and compose use `foregroundPrimary` (#000000),
which a glyph-colour sample exposed once the shapes already matched. `FcText` had made the text
pixel-exact; the remaining difference was a wrong token that had been hiding behind it.

**Title band: 2789 → 0 px. Pixel-identical text in the views flavour is achievable.**

### Rollout status

Converted so far: the Settings section titles (2 of them). Whole-screen Settings is 5.31% → 5.17%
— as expected, since only two elements are converted. Every remaining `TextView` in the flavour is
a candidate; each conversion is mechanical but must be measured, because the colour bug above shows
a wrong token can hide behind a rendering difference.

**Cost to note:** each `FcText` is a composition host. Dozens per screen, and RecyclerView rows in
particular, carry real overhead that a `TextView` does not. Worth measuring scroll performance on
Home and ChatHistory before converting list item layouts.

---

## FcText rollout + the app-bar glow (2026-09-22, later)

### The perf gate: FcText is for STATIC screens only

Measured before rolling out, on the views Home feed (700+ frames of flinging), with ONE title
per row converted:

| | TextView | FcText |
|---|---|---|
| janky frames | 0.00% | **3.25%** |
| janky (legacy) | 17.86% | **96.19%** |
| 90th percentile | 19ms | **34ms** |
| 99th percentile | 24ms | **73ms** |

73ms is four times the 16.7ms budget — visible stutter. **Reverted.** `HomeFeedAdapter`,
`LanguageListAdapter`, `ChatAdapter` and the drawer's recent-chat rows keep `TextView` and accept
the rasterisation difference as the price of smooth scrolling. Recorded in `FcText.kt` so nobody
re-litigates it.

### The app-bar glow — one defect on EVERY views screen

The largest single source of pixel difference on Settings was the **app bar**: 37,180 differing
pixels, 32% of the screen's total.

The app's bar is flat `#008236`; views' was `(31,145,56)`→`(48,154,57)` — brighter toward the
centre. Views' shared `fc_view_appbar.xml` always drew `fc_glow_yellow`. The app draws that
sunbeam on **Home only** — its Settings passes `showGlow = false` (app `SettingsScreen.kt:121`),
and compose renders flat there too.

Glow now defaults to `gone`; `HomeFragment` turns it on. **App-bar band: 37,180 → 2,587 px.**
This affected every views screen with a bar — Settings, Help, LanguageChooser, SettingsName, Auth,
ChatHistory and Legal.

### FcText rollout — 42 static TextViews converted

`fc_fragment_settings` (13), `fc_fragment_auth` (16), `fc_view_appbar` (3), `fc_fragment_help` (4),
`fc_fragment_language` (2), `fc_fragment_settings_name`, `fc_fragment_chat_history`,
`fc_fragment_terms_content`, `fc_dialog_country_picker` (1 each).

Converted with `tools/fidelity/toFcText.py`, which maps `android:textSize/textColor/textStyle/
textFontWeight/maxLines/ellipsize/textAlignment` onto the `app:fc*` equivalents and drops
`fontFamily`/`includeFontPadding` (Compose text has neither).

**Not converted:** every `fc_item_*` layout (recycled — see the perf gate), and `fc_drawer.xml`.
The drawer's nav rows use `android:drawableStart` for their icons and `FcText` has no drawable
support; converting them needs that added first.

### Appearance tile metrics

Compose (`SettingsScreen.kt:473`) is `top 16 / bottom 14`, `spacedBy(10.dp)`, icon **18dp**. Views
had `14/14`, no gap, icon **24dp** — the tile block rendered 16px taller and pushed every section
below it out of alignment. Corrected.

### Measured result

| Screen | start | now | compose floor |
|---|---|---|---|
| **legal** | 1.48% | **0.11%** | — |
| settings | 5.45% | **3.43%** | 0.15% |
| help | 6.81% | **5.25%** | — |
| settingsname | 3.75% | ~2-4% † | 0.05% |
| drawer | 5.90% | 5.90% ‡ | 0.02% |

† two measurements used different crops; not directly comparable, needs a clean re-measure.
‡ unchanged: the drawer has no app bar, and its text is still `TextView` pending drawable support.

**`legal` at 0.11% is below the compose floor measured on Settings (0.15%)** — a views screen is
now as pixel-close to the app as the compose flavour is.

### Still open

* `fc_drawer.xml` — needs `drawableStart` support in `FcText`.
* Help at 5.25% and Settings at 3.43% — the remaining difference is no longer text rendering
  (that is now identical) but residual layout offsets of 2-10px per band.
* Auth, LanguageChooser, ChatHistory — converted but not re-measured in this round.

### FcText: drawable support, the drawer, and where the lever runs out

**`FcText` gained a leading drawable** (`fcDrawableStart` / `fcDrawableTint` / `fcDrawableSizeDp`
/ `fcDrawablePaddingDp`, plus `setLeadingDrawable`). The drawer's nav rows use
`android:drawableStart` and could not convert without it. A zero tint means "keep the drawable's
own colours", which matters — `fc_icon_*` carry their own brand green and tinting them flat was a
real defect fixed earlier.

Converted with it: the 4 drawer nav rows and the 8 drawer footer texts. The rows now use the
**true weight 600**, which retires the earlier `bold` workaround — that was measured with the
flawed TextView setup (no explicit `fontFamily`, and an ink threshold that measured the
BACKGROUND on a dark surface, not the text).

**`PrimaryButtonView`'s label is now `FcText` too.** It is used on Language, LanguageChooser,
Auth, Settings, SettingsName, EnterName and the drawer, so a `TextView` there left button text
mismatched on nearly every screen. Its old `sans-serif-medium` typeface is weight 500 against the
app's `labelLarge` 600.

Two breakages the conversion caused, both found by compiling and both genuine constraints:

* **`FcText` cannot host clickable spans.** Auth's consent line and Language's legal paragraph use
  `LinkMovementMethod` for the Terms/Privacy links. Both reverted to `TextView` with a note; the
  rasterisation difference is accepted there.
* **`FcText.text` must be nullable**, like `TextView.text` — several call sites assign nullable
  strings. Also `xmlns:app` had to be declared in `fc_fragment_language.xml`, which had none;
  every layout is now validated as parseable.

### Where the lever runs out — measured, not assumed

| Screen | start | best | after the last conversion round |
|---|---|---|---|
| legal | 1.48% | **0.11%** | — |
| settings | 5.45% | **3.43%** | 3.43% (unchanged) |
| drawer | 5.90% | 5.15% | **5.37%** (slightly worse) |

Converting the drawer footer and every button label moved nothing, and the drawer marginally
backwards. **Text rendering is no longer the constraint on these screens.** The band map puts the
drawer's remaining 87-90k differing pixels at y1750-2349 — the sign-up card — so what is left is
the card's own geometry, not its glyphs.

**Conclusion for whoever picks this up:** stop converting text. `legal` at 0.11% proves the text
path is solved. The residual on drawer/settings/help is per-element LAYOUT offset of 2-10px per
band, and closing it means measuring each element against the app the way the earlier screens were
done — not more `FcText`.

---

## Regression guards for the parity work (2026-09-22)

Until now nothing stopped this work from being silently undone. Two JVM test suites now pin it:
`ViewsAppParityTest` (13 tests) and `ComposeAppParityTest` (8).

### Why not screenshot tests

Every number in this document came from diffing a flavour against the real FarmerChat app on an
emulator, both on the same backend and language. **CI cannot reproduce that** — it needs the
reference APK, a booted AVD, network, and a matching served-label set. A golden-image suite would
be red for reasons unrelated to the code.

So the guards assert the **causes** instead. Almost every defect found in this whole effort was a
wrong resource or source value: the app-bar glow, the tile geometry, the mode icons, the drawer's
palette, the selected-row composite, fixed row heights, the padding rhythm, the splash logo size,
the illustration width, the composer's placeholder default, the caption token, Auth's autofocus.
Each is now a one-line assertion carrying the measurement or app source line behind it.

### The guard that nearly did not work

The first version passed — and was **useless**. Gradle does not treat `src/main/res` as an input
to a JVM unit-test task, so after a resource-only change the task reported UP-TO-DATE and never
re-ran. Found by mutating four resources and watching **three go undetected** while the suite
still reported green.

Fixed by declaring the inputs explicitly in both modules:

```kotlin
tasks.withType<Test>().configureEach {
    inputs.dir(layout.projectDirectory.dir("src/main/res"))   // or src/main/java for compose
        .withPropertyName("parityTestResources")
        .withPathSensitivity(PathSensitivity.RELATIVE)
}
```

**A guard that reads files off the filesystem must declare them as task inputs, or it is a green
light that never looks.**

### Both suites are mutation-verified

Each guard was proven to FAIL when its invariant is broken, not merely to pass:

| Mutation | Result |
|---|---|
| re-show the app-bar glow | CAUGHT |
| selected row back to the single composite | CAUGHT |
| shrink the splash logo (views 100→96dp) | CAUGHT |
| mode icons back to the wrong set | CAUGHT |
| flat `padding="20dp"` back on Settings | CAUGHT |
| `FcText` back into a recycled row | CAUGHT |
| shrink the splash logo (compose 100→72dp) | CAUGHT |
| flatten ChatHistory list padding | CAUGHT |
| drop `maxWidth` from an illustration call site | CAUGHT |
| re-enable Auth autofocus | CAUGHT |
| — all reverted — | green |

### `recycledRowsMustNotUseFcText`

The one guard that encodes a **performance** decision rather than an appearance one. `FcText` in a
recycled row was measured to take the 99th-percentile frame from 24ms to 73ms — four times the
budget. That trade-off is easy to undo by accident, so it fails the build: any `fc_item_*` layout
containing `widgets.FcText` is reported by name.

### Android test totals

| module | tests |
|---|---|
| farmerchat-core | 198 |
| farmerchat-android-views | 13 (new) |
| farmerchat-analytics-posthog | 14 |
| farmerchat-android-compose | 8 (new) |
| **total** | **233, 0 failures** |

`farmerchat-android-compose` and `-views` had **zero** tests before this.

### Still unguarded

* iOS, RN and web parity work — no equivalent suites. Web has the label-key guard only.
* Anything that is genuinely a rendering regression rather than a value change. These guards
  catch causes, not pixels; the device sweep in `tools/fidelity/` remains the only check for that.

---

## Parity guards on the remaining three platforms (2026-09-22)

The Android guards left iOS, RN and web unprotected. All three now have suites, and all are
mutation-verified.

### react-native had a real defect this exposed

RN was previously reported here as "already correct" on label keys. **That was wrong, and the
correction matters:** the check had only covered `Labels.ASK_ABOUT_YOUR_FARM`. Writing the guard
found **93 bare label keys** — the same class as web's 159 and iOS's 39, and unresolvable for the
same reason (every served key is `fc_v2_*`-prefixed; 287 on DEV, zero short keys).

Fixed by the same verified method — match each key's English fallback against the served English
map, resolve ambiguity at the call site:

| | |
|---|---|
| exact served-text match | 49 keys |
| ambiguous, resolved by call site | 3 (`gps_interstitial_title`→`_title`, `gps_share`→button, `name_hint`→`_or_nickname`) |
| **applied** | **63 call sites across 14 files** |
| remaining, backend serves nothing | 44 (allowlisted and ratcheted) |

### The suites

| Platform | Suite | Tests | Notes |
|---|---|---|---|
| web | `test/appParity.test.ts` | 5 | wired into `npm test` |
| react-native | `test/appParity.test.ts` | 6 | **this package had no tests and no runner at all** |
| iOS | `AppParityGuardTests.swift` | 4 | lives in `FarmerChatCore` |

**react-native now has a test runner.** It uses the setup the web package chose — Node's native
TypeScript support plus a resolve hook, no framework — so a published SDK gains no dependency.

**The iOS guard lives in `FarmerChatCore` on purpose.** The fixes are in `FarmerChatSwiftUI`,
which is iOS-only; `swift test` targets macOS and cannot compile it (root CLAUDE.md §5). So it
reads the SwiftUI sources off disk and asserts on their text, resolving paths from `#filePath` —
`FarmerChatSwiftUI` is a SIBLING package, four levels up from the test file, not three.

### Ratchets are measured, not guessed

`testBareLabelKeyCountDoesNotGrow` bounds the bare keys in five iOS screens. I guessed 12 and the
test failed: the real count is **18**. The bound is now the measured number, with a note that it
came from running the test. A guessed ratchet is either dead weight or a false failure.

### Mutation-verified

| Mutation | Result |
|---|---|
| web: re-add the phone `autoFocus` | CAUGHT |
| RN: revert a mapped key to its bare form | CAUGHT |
| iOS: composer placeholder back to `type_placeholder` | CAUGHT |
| — all reverted — | green |

### Totals

| | tests |
|---|---|
| android (4 modules) | 233 |
| iOS FarmerChatCore | 92 (was 88) |
| web | 8 (3 label-key + 5 parity) |
| react-native | 6 (was 0) |

Verified: Android builds + both samples assemble; iOS `swift test` 92 green and
`xcodebuild -scheme FarmerChatSwiftUI` **BUILD SUCCEEDED**; web `tsc` + `vite build` + tests;
RN `tsc` + tests.

### What remains genuinely unguarded

Rendering regressions. Every one of these suites asserts a CAUSE — a resource or source value —
because no CI can diff against the reference Android app. The device sweep in `tools/fidelity/`
is still the only check for pixels, and it needs the app, an emulator and a matching served-label
set.

---

## The views location pill — ported (2026-09-22)

The last structurally missing piece of the views agentic Home. It was deferred twice on purpose:
it is not markup, and a half-ported pill tells a farmer the wrong thing about their own location.

### The state machine, ported not approximated

`LocationPillView` mirrors compose `HomeLocationPill` + `LocationButton`
(`HomeScreen.kt:1429-1530`, `components/LocationButton.kt`). Five states, in this precedence:

| State | Condition | Shows |
|---|---|---|
| Blocked | `denyCount >= 2 && !hasPermission` | "Allow location in Settings", GpsOff icon |
| Searching | `RequestEnableGps`/`FetchingLocation` from `LocalContext` | spinner + "Getting your location" |
| Success | 1500ms after the flow completes with a stored fix | check + "Location found" |
| Located | exact fix, or a profile-derived approximate name | Place icon + "`<Place>` - Change" |
| Invite | otherwise | MyLocation icon + "Set your location" |

Three subtleties carried over deliberately, each with the reasoning in the source:

* **Blocked is NOT keyed on `LocationPromptState.Recovery`.** Dismissing the "We need your
  location" sheet must not make the pill fall back to approximate text while the permission is
  still blocked.
* **Permission is re-checked on every state change, not cached.** It changes in system Settings,
  and `hasStoredLocation()` alone only means "a fix was once saved" — it stays true after a
  revocation, so the pill would show a stale exact location.
* **The tap re-runs the flow** rather than jumping to system Settings: with `denyCount >= 2` and
  no permission the manager lands on `Recovery`, which is what re-shows the sheet with its own
  "Turn on in Settings" button.

Only "Change" takes the secondary colour in the Located state — a `ForegroundColorSpan` on the
tail, matching compose's `withStyle(SpanStyle(...))` (`LocationButton.kt:141-149`). The label
resolver is injected rather than reached for statically, so the view does not require an
initialised graph. Its text renders through `FcText`, so it matches the app's rasteriser.

Four Material glyphs (`MyLocation`, `Place`, `GpsOff`, plus the existing check) were added as
vector drawables — compose gets them from `Icons.Filled`, which views has no access to.

### Two offsets it exposed

Adding the pill made the header's real geometry measurable, and two defects fell out:

1. **Home's app bar was 12dp too tall.** `HomeAppBar` is **52dp** (`AppBars.kt:186`) where the
   shared `DefaultAppBar` is 64dp (`:96`). Views has one include at 64dp, so Home's entire header
   sat 12dp low. `HomeFragment` now overrides the height.
2. **The header carried extra padding.** Compose is `Column(padding(top = 0.dp, bottom = 16.dp),
   spacedBy(12.dp))` (`HomeScreen.kt:1128`); views had a 12dp logo margin and a 16dp title bottom
   padding on top of that.

### Measured

| Element | app | views | Δ |
|---|---|---|---|
| app-bar icons | 182..211 | 181..211 | **-1** |
| logo mark | 267..372 | 266..371 | **-1** |
| title | 413..468 | 412..467 | **-1** |
| **location pill** | 542..574 | 538..566 | **-4** |
| first card top | **655** | **654** | **-1** |

**The first card was +73px out before this and is now -1px.** The views agentic Home header now
matches the app's structure element for element: logo mark, single-line title, location pill,
feed.

Verified on device with no crash, on the `agentic` profile, rendering the Located state
("Bengaluru Urban - ಬದಲಾವಣೆ") with only the Change half in the secondary colour.

### Remaining on views Home

The agentic **surface** treatment — the reading-surface gradient and the pinned/dissolving header
— is still the v1 green. That is a separate unported feature from the header content, and it is
what the `HomeFragment.kt:250` note refers to.

---

## Views vs app — screen-by-screen re-measure against app source HEAD (2026-09-28)

Triggered by: *"do you think xml version of android matches the actual android app … its not
even 5%"* → *"check screen by screen & i need exactly same as original app i need 100% match"*.

### Oracle — which app build, stated exactly

* **Built from source**: `fc-compose-agentic` local `dev/v2.5` @ `919e5b2f` (4.1.4 / 112), **stage**
  flavour, cloned to a scratch dir (reference repo untouched). `origin/dev/v2.5` is ahead only by
  CI-workflow commits; `origin/dev/v2.4` has one unmerged "location changes" commit, NOT used.
* **The 4.1.4 APK that was already installed on the emulator was NOT that source.** It showed
  the legacy Photo/Speak/Type Home and an Auth screen without the consent card, while source
  HEAD hardcodes `getAgenticChatEnabled()` / `getComposerUiEnabled()` to `true`
  (`OnboardingRemoteConfig.kt:72,81`). Screenshots of that APK are misleading for this work.
* **Same backend on both sides.** The stage flavour calls
  `https://farmerchat.farmstack.co/mobile-app-stage/`, whereas the SDK's `STAGE` enum now points
  at the agentic demo host. Both samples got an `appstage` profile
  (`customBaseUrl` = the app's stage host, `enableAgenticChat(true)`). On DEV the language list
  even differs ("English (India)" vs "English"), so a DEV-vs-stage comparison is invalid.
* Device: `Pixel_6_Pro` AVD, 1440x3120 @ 560dpi, light mode, en, guest, animations 0,
  SystemUI demo clock. Diff = share of pixels with RGB delta > 30, status + nav bar cropped.

### Result — app vs compose vs views, same device, same backend, same state

| Screen | compose | views | notes |
|---|---|---|---|
| Language (kn, first paint) | 1.80% | 17.74% | views: title/subtitle 21px low, legal line **bold** 13sp (app `caption` = 13/18 **w400**), 4 lines vs 3, bottom card taller |
| Language (en) | 0.22% | 12.60% | same causes |
| Language (all expanded) | 1.00% | 13.47% | same |
| Drawer | 1.33% | 27.39% | views: header 13px higher, rows 26px higher, sign-up card body 14sp vs app ~17sp and a smaller card |
| Settings | 1.45% | 15.14% | views: appearance tiles taller + labels w400 (app w600 small), location value wraps to 2 lines (app single line ellipsised), "Share your location…" is plain grey (app: green link), every section below shifted ~22px |
| Settings → Name | 1.44% | 1.31% | matches |
| Help | 1.41% | 8.63% | row offsets |
| Language chooser | 1.44% | 5.53% | row offsets |
| Auth (phone) | 8.00% | 17.41% | views: consent card without bullets / italics, 13sp rhythm; country chip shows a ↓ glyph the app does not; placeholder colour lighter; status bar NOT green |
| Country picker | 33.61% | 77.93% | **views is a different design**: no green app bar (back arrow on grey), plain radio rows with no row cards, no flags, no selected-row fill |
| Home (agentic) | ~46% | ~47% | dominated by feed content/scroll; element-level below |
| Splash | timing | timing | views leaves splash sooner; the layouts are equivalent |

**Compose sits at 0.2–1.8% on every static screen; views at 5–78%.** Views' only near-match is
SettingsName.

### Element-level gaps that are NOT pixel noise

Views only:
1. **Home location pill says "Set your location"** while the app (and compose) show the
   IP-resolved "Bengaluru Urban - Change". Views Settings on the same run shows
   "Bengaluru Urban (approximate)", so the location is known — the views pill is not reading it.
2. **Home first card binds a different field**: app/compose "Why "Pehla Doodh" is a MUST for
   Strong Goat Kids!", views "Goat (Meat) - Colostrum Management" for the same image.
3. **Home**: no sunbeam glow, no squiggle flanks around the title, no composer aura, card surface
   is green (v1) instead of the app's light reading surface.
4. **EnterName shown when the app skips it**: on a fresh install whose server profile already has a
   name, the app goes Language → Home; views goes Language → EnterName.
5. **Status bar is not drawn green** on Auth / Country picker (edge-to-edge not applied there).
6. **Text input overlay** (legacy): views has no camera icon and its send button has no
   content description.

Shared by compose AND views (core or both UIs) — must be fixed in core / both flavours:
7. **Auth shows "Send via WhatsApp"**; the app shows SMS only for India on the same backend.
8. **Auth "Send via SMS" is enabled-looking** with an empty number; the app renders it disabled
   (dimmed label) until the number is valid.
9. **Compose**: bullets present but country picker / Auth app bar carries the sunbeam glow and a
   back arrow; the app uses a flat bar and a close ✕ on the picker.

### Not yet captured against the HEAD build

Chat (composer, streaming, answer, action row, follow-ups), history in the drawer, legal dialog,
NoInternet, AccountBenefits, AccountSuccess, OTP step, location prompt. The first pass (against
the older installed APK) showed the chat answer and the loading state also differ in views.

### What this measurement says about "100%"

Hand-porting has kept views 5–78% away from the app, and each earlier pass stalled at 3–5% on the
screens it finished. Compose is the app's own composables and lands within 2% with no per-screen
work. **Wrapping the compose screens inside the views fragments** is the only route that reaches
the app on every screen and keeps it there when the app changes. Views already puts
`compose.ui` + `compose.foundation` on host classpaths through `FcText`, so a views host is
already a Compose runtime host. The constraints that remain are the AGP 8.13+ VerifyError on old
toolchains and `resolveActivityClass()` (views must not ship the compose `FarmerChatActivity`).

**Decision (user, 2026-09-28): "fix xml"** — keep views hand-written, close the gaps screen by
screen. Result of the first fixing pass follows.

### Fixing pass 1 — measured after, same device / backend / state

| Screen | views before | **views after** | compose |
|---|---|---|---|
| Language (en) | 12.60% | **2.75%** | 0.22% |
| Language (all) | 13.47% | **2.90%** | 1.00% |
| Drawer (panel only, x<1040) | — | **2.48% → fixed width, re-measure pending** | 0.03% |
| Settings | 15.14% | **1.14%** | 1.45% |
| Settings → Name | 1.31% | **1.19%** | 1.44% |
| Help | 8.63% | **3.36%** (FAQ card padding fix not yet re-measured) | 1.41% |
| Language chooser | 5.53% | **1.50%** | 1.44% |
| Auth (phone) | 17.41% | **2.91%** | 8.00% |
| Country picker | 77.93% | **2.55%** | 33.61% |
| Home (agentic, top) | 46.83% | **13.51%** (rest = different feed items the server returned) | 45.86% |

What changed, by cause (all measured against app source `dev/v2.5` @ `919e5b2f`):

* **System bars (every screen with a bar).** Views painted whole roots green to get a green status
  bar, so the nav-bar strip was green too; Auth/country picker had no green at all.
  `util/SystemBarBackdrop.kt` paints only the status inset brand-green and the nav strip in the
  screen's own surface.
* **Country picker** rebuilt to the app's `CountryPickerScreen`: green close bar, search as first
  list item, 48dp card rows with SVG flags and the page-coloured empty dot, white fixed bottom
  area; label `name (code)` and prefix filter as the app.
* **Auth**: app padding (20/32/24), `CountryCodeSelector` (no dropdown glyph, 0.5dp border, SVG
  flag — the plain Coil loader could not decode it and always showed the India PNG), 19sp input
  with secondary placeholder, bulleted agreement card with the app's untrimmed 27sp line boxes and
  bold-italic info line, 48dp send buttons 8dp apart, disabled until the number is valid, one
  "Sending code…" button while sending.
* **Core bug (both android flavours): endpoint #20 was called with `+91`** (`%2B91`), which returns
  no row, so the fallback enabled WhatsApp for India. App strips the `+` (AuthViewModel.kt:362); so
  does iOS already (`AuthViewModel.swift:154`). RN/web do not call #20 — **gap, not changed here**.
* **Language**: header spacing (+6dp title, 8dp subtitle, 24dp before rows), legal caption back to
  13/18 **w400** (was bold → 4 lines vs 3), links in secondary grey.
* **Drawer**: the app's `ModalDrawerSheet(widthIn(max = 300.dp))` COERCES the 320dp content to
  300dp; wordmark 56dp from the screen top regardless of status-bar height; sign-up card 18/24
  title + 17/25 body.
* **Settings**: tile labels 13/18 w600 (the XML text size was ignored by `FcText`, so they rendered
  17sp), location value one line with ellipsis, helper 15/22 with the Green700 span (FcText now
  carries colour/underline/bold/italic spans), ListCard 6/48/4 row geometry, 48dp SecondaryButton
  17 w600.
* **Help**: rows are the app `ListItem` (17sp label at natural width, 24dp chevron straight after
  it, 16dp ListCard insets so dividers are inset), section titles labelLarge primary.
* **Home (agentic)**: grey page with the brand band (36.6% of screen, solid to 58.8%) + the app's
  `Sunbeams` + 148dp yellow glow BEHIND a transparent feed; header as a fixed transparent overlay
  the feed scrolls under with the app's DstIn top fade (`FadeTopRecyclerView`); leaf-flanked
  `SectionHeader`; location pill now re-reads after the profile backfill (was stuck on "Set your
  location"); card headline `question_text ?: title` (was reversed); view-count badge and
  personalisation tag added; floating composer band grey, and the **idle rainbow aura** ported
  (`ComposerAuraDrawable`). Sunbeams / section header are the app's composables run in views'
  existing Compose runtime, not approximations.

### Still open on views (next pass)

* **Chat**: app bar status-area glow and logo hidden while the answer is pending; LogoSpinner
  label weight (app bold); tips card type scale ("Try this" 17sp); the composer on Chat.
* **Splash** exits faster than the app's (timing, layout equivalent). EnterName is shown when the
  server profile already has a name (the app skips it) — core routing, affects both flavours.
* Not yet captured on the HEAD build: OTP step, AccountBenefits/Success, NoInternet, history in
  the drawer, legal dialog, location prompt.
* Measurement note: the emulator was shared with another session mid-pass (an unrelated app was
  reinstalled and launched), so the chat captures from that window are discarded.

### Chat pass (2026-09-28, `rs_qa` 1080x2400, animations ON — the app's streaming reveal is frame-driven)

| State | views vs app |
|---|---|
| sent / thinking / streaming | **3.4–3.5%** (top bar 1.5%) |
| answer done / scrolled | 26–34% — the answers themselves differ (two guest users, two generations) and the app user got a "save chilli" follow-up where views got the gender card; top bar 1.9–2.6% |

Fixed (views only; compose already matched):
* **Chat app bar**: the app's `LogoAppBar` draws the 80dp yellow glow from the SCREEN top (under
  the status bar) — views drew a flat bar; the mark shows only when `isThread && !isLoading`
  (views showed it as soon as a message existed).
* **Pending row** (`LogoSpinnerHorizontal`): Material `CircularProgressIndicator` ring (40dp,
  2.5dp) instead of the thicker platform spinner, the 3s logo spin, label labelMedium **w600**.
* **Tips**: labelLarge 17/22 w600 title + bodySmall 15/22 body (views had 14/13sp).
* **Markdown**: block gaps actually render (20dp paragraph→paragraph etc. — the old
  AbsoluteSizeSpan-on-newline produced no gap); `---` dividers; `#`..`######` headers at the
  app's 22/18/16sp. Tables are still NOT rendered as tables in views — open.
* **Composer on Chat** shows the idle aura (app ChatInputOverlays.kt:73).
* **Chips**: unselected labels w600 (were 400); number badge labelMedium 15sp (was 13sp) —
  *this last change is written but NOT yet device-verified* (see below).

**Blocked:** a concurrent session is editing `versions/v2/android` (core config/graph/routing,
views theme/navigation). At 16:21 its `FcThemeInflaterFactory` signature change left
`FcEmbeddedTheme.kt:48` not compiling, so the chip-badge change could not be rebuilt. Nothing in
that session's files was modified here.

## CHAT_ONLY: one conversation per journey (2026-10-06)

| Item | App | Before | Now |
|---|---|---|---|
| New question from host (CHAT_ONLY) | new conversation per Home entry (`HomeScreen.kt:855`) | reused the stored `NEW_CONVERSATION_ID` forever → history showed one item | `FarmerChatGraph.beginChatOnlyJourney()` clears it unless a `PendingTarget.Chat` (thread resume) is pending; called before `ensureChatOnlySession()` in views `SplashFragment` and compose `FarmerChatRoot` |
| Follow-up / align chip / location in a thread | same conversation | same | same — verified (Econet, FarmerChat dev): two dashboard questions → two conversations, both in Past Advice; follow-up, align chip and location answer stayed on the thread's id |
| Location prompt | interstitial "Getting your location…" → location bubble → answer | — | matches (views, Econet emulator) |
| "Getting your answer…" position | directly under the question (`ChatThreadContent.kt:623`, content top-aligned in the fill-height placeholder) | centred in the reserve-height row (`gravity="center_vertical"`) | `fc_item_chat_loading.xml` gravity `top\|start` — verified in Econet |

## Re-initialize to switch mode (Android v2, 2026-10-06)

| Item | Before | Now |
|---|---|---|
| `FarmerChat.initialize()` called again, same environment | no-op — `mode` and the show* toggles of the FIRST config stuck for the process, so a host could not offer both a full-journey and a CHAT_ONLY entry point | the graph is rebuilt when `environment`, `mode`, `showDrawer`, `showHistory` or `showSettings` differ; any other difference is still ignored. Session state lives in prefs, so the rebuild keeps the user's token/conversation; the per-graph CHAT_ONLY bootstrap re-runs (idempotent). Host must call it only while no SDK screen is showing |

Driver: the `LastCheckSDKCompose` / `LastCheckSDKXML` check apps, each with a full-flow FAB and a
chat-only FAB that re-initialize before launching (`FarmerChatSetup.kt` in each, app stage backend).
Verified 2026-10-06: `:farmerchat-core:compileDebugKotlin` + publishToMavenLocal clean; both hosts
`assembleDebug` clean; on the Pixel_6_Pro emulator, in ONE process, Full → Back → Chat only → Back → Full
rendered language screen → chat (no drawer, X close) → language screen again, on both views (XML host)
and compose (Compose host); no crash, no VerifyError (host AGP 8.13.2). Not exercised: asking a question
in either mode after a switch.
⛔ GAP iOS / RN / web: not ported — a repeat `initialize` there keeps its existing behaviour.

## Home feed: gap between cards (Android v2, 2026-10-06)

| Item | App | Before | Now |
|---|---|---|---|
| Space between feed cards | trailing `Spacer(16.dp)` after every non-plotline section (`HomeScreen.kt:1507`, commit 891142ce) | compose: 0 dp — cards touched (the uncommitted first-card fix dropped `vertical = 8.dp` without adding the app's spacer); views: 12 dp `layout_marginBottom` | compose: trailing 16 dp Spacer per section item (first card position unchanged); views: 16 dp |

Verified: compose screenshot on Pixel_6_Pro via LastCheckSDKCompose (16 dp gap visible, first card unmoved);
views compile-only. ⛔ iOS/RN/web not checked against 891142ce.

## Location prompt: app decision tree + host parity (Android v2 2.2.0, 2026-10-06)

Reported: "share location after giving permission not popping up, sometimes asking again & again,
UI mismatch". Re-ported `LocationPromptManager.trigger()` and `LocationPromptHost` from
fc-compose-agentic into **core** (shared by both flavours) and both hosts. docs/01 §3.15 now records
the tree. What was wrong on android v2 before:

- **Every trigger went through the full-screen interstitial**, including the Home pill and chat chip
  with permission already granted — so every pill tap re-asked. The app skips it for
  LocalContext/Settings/Campaign and whenever permission is held; a pill tap with permission + a
  stored fix goes straight to the silent GPS/fetch.
- **GPS-off loop:** declining the GPS dialog parked in `Error(GpsUnavailable)` whose "Try again"
  reopened the same dialog, forever (screenshot-reproduced on views). App: `canRetry = false`, the
  CTA closes; Weather continues without location.
- **GPS dialog could stop appearing:** the `LocationSettingsRequest` lacked `setAlwaysShow(true)`;
  compose also short-circuited on `isProviderEnabled` (skips the dialog when location is on but
  Location Accuracy is off) and views treated a non-resolvable failure as "enabled".
- **"Permanently denied"** came from `shouldShowRequestPermissionRationale`, which is false after
  merely dismissing the dialog. Now the app's `deny_count >= 2` (and FINE-only, as the app checks).
- **Fetch failure showed an error screen**; the app ends quietly with
  `Continue("location_failed_fallback")`. Fix saved only after `update_user_location` succeeds.
- **UI:** interstitial CTA is "Share Location" (was "Turn location on now") with no "Continue without
  location"; during permission/GPS/fetch only Weather keeps the (inert, back/skip hidden) interstitial;
  recovery sheet ported (382dp square farmer image + white close chip, centred copy, single chevron
  CTA, no drag handle — new asset `farmer_looking_at_phone_square.webp` ×4 countries copied from the
  app); error screens use the app's per-type copy/images and have no back/skip. Views overlay now
  re-requests insets (its bar sat under the status bar and the CTA under the nav bar).
- Home (both flavours) reloads feed **and weather** on a pill / widget success, as the app does
  (views reloaded nothing; compose reloaded the feed only).

Verified on `rs_qa` (API 36) in LastCheckSDKCompose + LastCheckSDKXML against 2.2.0 from mavenLocal:
pill → system dialog directly; deny ×2 → recovery sheet + "Allow location in Settings" pill; grant in
Settings + resume → interstitial → Share → fix → one `update_user_location` → feed+weather reload;
re-tap with fix → no prompt; GPS off → dialog → No thanks → GPS error → Try again closes. Compiled
core/compose/views; core unit tests pass. NOT exercised: Weather entry, campaign, chat gps-prompt chip
in CHAT_ONLY, offline, approximate-only grant.

Deliberate deltas kept: events `replay = 0` (see above); no Firebase `gps_flow_step`, MoEngage or
user-attribute tracking (§6). The "illustration gradient overlay" is NOT a gap: the app's
`FullScreenMessage` only draws it on its fallback-illustration path, and every location screen
passes its own illustration, so the app never shows it there (compose's matching parameter is
equally inert). Views `FullScreenMessageView` (location overlay AND error/benefits/success
fragments) now draws its glow bar behind the status bar like the app, instead of padding the whole
screen with `fitsSystemWindows` (emulator-verified on the views Error screen).
**ios / react-native / web (v2): ported 2026-10-06** from the same spec (decision tree, deny-count
recovery, exits, non-retryable GPS error, quiet fetch fallback, save-after-API, Weather-only
interstitial, app recovery-sheet layout, error screens without back/skip, Home error routing +
weather guards + reload). Compile/test-verified only — **no runtime run on any of the three.**
Verification: ios `swift build` + `swift test` in FarmerChatCore (106 tests, 0 failures) and
`xcodebuild … generic/platform=iOS Simulator` for FarmerChatSwiftUI + FarmerChatUIKit; react-native
`npx tsc --noEmit` + `npm test`; web `npx tsc --noEmit` + `vite build` + `npm test`. Platform gaps:

| | ios | react-native | web |
|---|---|---|---|
| Square farmer image on the recovery sheet | ⛔ no image assets in the iOS packages (SF Symbols); slot kept | ✅ copied ×4 countries | ✅ v2 (2026-10-08): the ×4-country webps ship in `dist/illustrations/`, loaded via `config.assetBaseUrl` (widget defaults it); without it the slot stays empty |
| Settings "My Farm" Location row | ⛔ no row on iOS | ✅ built new | ✅ built new |
| Offline → `Error(NoNetwork)` | ✅ NWPathMonitor | ⛔ no connectivity dep — `isOnline()` is always true | ✅ |
| GPS / services prompt | services off → GpsUnavailable (no in-app prompt on iOS) | Android `enableNetworkProviderAsync` when services off; Accuracy-off case not covered | n/a — no browser equivalent |
| "Approximate" = deny | ⛔ iOS has no fine/coarse split — counted as granted | ✅ on Android | n/a |
| Campaign source / GPS deep link | implemented, unreachable (no producer) | implemented, unreachable | not ported (no campaign on web) |
| GPS Interstitial Screen_Viewed/Exit | ✅ | ✅ | ⛔ no such screen constant on web |
| `deny_count` pref key | `fc_sdk_PERMISSION_DENY_COUNT` (new) | `PERMISSION_DENY_COUNT` (new) | `fc_sdk_deny_count` (new) |
| `APPROX_LOCATION_NAME` | ⛔ key absent; writes country/state/district | ⛔ same | ⛔ same |

The three new deny-count keys are the app's `PreferenceKeys.PERMISSION_DENY_COUNT`, named in each
package's own convention — see docs/05. Recovery "Turn on in settings" on web cannot open site
settings; it re-reads the permission instead.

**Second pass (same day) — Home / Settings / deep-link call sites against the app:**
- **Location error on Home → shared Error screen** (app HomeScreen.kt:258-266): any
  `LocationPromptState.Error` while Home is showing navigates to `Destination.Error(isNetworkError =
  NoNetwork, fromScreen = "home")` and closes the flow with `dismiss(emitContinue = false)` — so on
  Home a declined GPS dialog shows the generic "Something went wrong / FarmerChat couldn't start"
  screen, not the GPS card. Mirrored as the app does it (questionable UX — raise with the app team).
  Chat / Settings still show the host's own error card. Both flavours.
- **"Getting your location" feed spinner is CAMPAIGN-only** and spans permission → GPS → fetch; compose
  showed it for ANY fetch (a pill tap blanked the feed), views never showed it.
- **Weather chip guards:** ignored while the feed is loading or a location flow is running; compose
  also lacked the offline → No Internet (`home_weather`) route — added via a new `onNavigateToError`
  HomeScreen callback, which also gives compose feed / SSFR card taps the app's offline `home_card`
  route (views already had both).
- **GPS deep link (`SplashRoute.HomeWithGps`):** compose triggered LocalContext (wrong source, no
  spinner, "Home Screen" analytics); both flavours now run the app's Campaign flow tagged `plotline`
  (views said `native`). Campaign frequency gating (`max_shows` / `min_interval_ms`, app per-campaign
  `loc_shown_count_*` / `loc_last_shown_at_*` counters) is **N/A, not a gap**: nothing in the SDK
  produces `PendingTarget.Gps` (the app's producers are Plotline/MoEngage, barred by §6), so the gate
  would be dead code — and its pref keys are not in docs/02. Revisit only if a host-facing GPS deep
  link is added.
- **Settings Location row** uses the manager's FINE-only check (was FINE-or-COARSE) in both flavours.
- **`Screen_Viewed` / `Screen_Exit` for "GPS Interstitial Screen"** — the constant existed but nothing
  emitted it; now emitted from core on entering / leaving the interstitial.
- Checked and already matching: chat gps-prompt chip arming + outcome handling (both flavours),
  `LocationButton` (identical to the app's), `IP_APPROX_LOCATION_NAME` (deliberately absent, above).
Verified on `rs_qa`: GPS-off "No thanks" from the pill → shared Error → Try again → Home; fresh
install → weather chip → interstitial → Share → permission → fix → Chat "What is the present weather?".

Version: `farmerChatVersion` was still `2.1.0` while the hosts consumed a hand-published `2.2.0`; it
is now `2.2.0` in `versions/v2/android/build.gradle.kts` (single source, README + sample-consumer
updated).

## Agentic answer showed a raw ```followups block (Android v2, 2026-10-06)

Reported: "follow-up is not coming in UI when asked what's the present weather, but in the app it's
good". On the stage backend (`mobile-app-stage`) the agentic weather answer's settled text ended with
a literal ```` ```followups ["Will it rain later today?", …] ``` ```` block, which the markdown
renderer (no fence support — identical to the app's `MarkdownText`) printed under the answer. The SDK
already stripped it from the STREAMING text; the settled `metadata.response` / `done.answer` is now
cleaned too (`sanitizeAgenticFinalText`, core `ChatViewModel.kt`; unit test `AgenticFinalTextTest`).
Not an app-parity port: the app renders `metadata.response` verbatim, presumably because its backend
sends it clean. Emulator-verified on `rs_qa`.

The follow-up CHIPS themselves are correctly hidden in that capture: #29 returned 3 questions, but
the answer also carried the additive gender-select nudge, and the app hides follow-ups while an
additive surface with chips is open (`ChatThreadContent.kt:587`, `showFollowUps`). A fresh guest has
no gender, so the nudge appears; an account that already answered it sees the follow-ups. Same rule
on both flavours — no change.

**ios / react-native / web (v2): same leak, same fix (2026-10-06).** All three sanitized only the
STREAMING text; the settled `metadata.response` (shared handler, agentic only) and the `done.answer`
fallback went through raw. Each now has `sanitizeAgenticFinalText` beside its stream sanitizer
(ios `ChatViewModel.swift`, rn `core/agenticModels.ts`, web `core/agentic.ts`) applied at both
points. Tests: ios `AgenticFinalTextTests` (110 tests, 0 failures) + SwiftUI/UIKit
`xcodebuild … iOS Simulator` BUILD SUCCEEDED; rn `test/agenticFinalText.test.ts` (4/4) + `tsc
--noEmit`; web `agentic.test.ts` (78 assertions) + `tsc --noEmit` + `vite build`. Not run against a
live stream on those platforms.

## Screen-fidelity pass: app vs compose vs XML, 2.2.0 (Android v2, 2026-10-06)

Oracle: fc-compose-agentic HEAD `31a789e0` built from a scratch clone (`assembleStageDebug`,
backend `mobile-app-stage`); SDK 2.2.0 in LastCheckSDKCompose / LastCheckSDKXML on the same
backend; `rs_qa` API 36, 1080x2400, same guest state. Captured side by side.

**Matching (no change):** Splash, Language (onboarding + chooser + all-languages), Name, Home header /
weather / location pill / composer, Drawer, Settings, Help, Sign up (phone), camera + voice sheets,
loading tips (both shuffle — a different first tip is chance), chat answer + action row + gender nudge.

**Fixed:**
- **Home content card** (both): rendered a "✦ Preventive pest management" tag from `meta.asset_name`
  and a view-count badge on statement cards; the app's Home never passes `personalizationLabel` and
  only passes `viewCount` for image cards (HomeScreen.kt:1337-1355).
- **Feed footer** (both): the SDK drew the logo mark over a green glow; the app draws a waving-hand
  emoji with a fade-in + 3 waves (`FeedFooter.kt`). XML text colour was white (now foregroundPrimary).
- **App bar glow** (compose): Settings, Help, Language chooser, SettingsName, ChatHistory and Auth
  showed the radial glow; the app passes `showGlow = false` on all of them.
- **Chat back button** (both): from Home the app draws its `leftbutton` drawable — a circle; the SDK
  used the 12dp rounded square.
- **Sign up "Send via" buttons** (compose): enabled with an empty number; the app gates on
  `isPhoneValid` (AuthScreen.kt:888).
- **XML system bars:** white status icons on light screens; now day/night-aware like the app's
  `enableEdgeToEdge`.
- **XML SettingsName:** Save enabled while empty, pale hint, caps keyboard; now app-matched. XML
  EnterName now opens the keyboard on entry like compose/app.
- **XML composer IME:** newline key instead of the app's ✓ Done (`textMultiLine` overrode
  `actionDone`).
- **XML full-screen message illustration:** capped at 300dp; the app's screens pass 322dp.
- **XML input sheets:** the nav-bar strip under the camera/voice sheet showed scrim; the sheet now runs
  behind the nav bar like the app's ModalBottomSheet.

**Not changed / not compared:**
- Splash: matches — both flavours show the app's `boot_bg` gradient + white logo (captured at
  ~0.3s; a later capture lands on the Language-loading spinner, which the app shows too).
- OTP, AccountBenefits/Success, Past Advice (ChatHistory) and drawer recents need a signed-in
  account (real SMS) — not captured.
- Chat loading label: compose showed a grey "Getting your answer… •••" at the capture instant vs the
  app's green shimmer; not reproduced reliably, not changed.

Compile-verified (core/compose/views); every fix above re-captured on `rs_qa` against the app.

## Web v2 compose-fidelity pass — the web UI rebuilt from the compose module (2026-10-08)

Triggered by: *"check the entire ui its completly different when compared to actual android (xml &
compose) ui i need same pixel to pixel for intercom"*. The report was correct: the v2 web UI was a
separate design (teal `#146152` palette, system font, emoji icons, invented layouts), not drift.
This pass rebuilt it from the compose module, which the 2026-10-06 pass verified against the app.
**Tree: `versions/v2/web` only** (what the Intercom widget ships). v1 `web/`, iOS and react-native
are **not** ported — they keep their previous UI (CLAUDE.md §4 gap).

**Method (reusable, `tools/fidelity/web/`):** Android compose 2.2.0 in LastCheckSDKCompose on
`rs_qa` (1080x2400 @420dpi = 411x914dp) against the app's stage backend; web in headless Chrome at
411x914 CSS px, DPR 2.625, through a local CORS proxy to the same backend
(`widget/demo/stage-proxy.mjs` — the backend's preflight rejects the SDK's custom headers, so a
browser cannot call it directly) with India pinned. `pair.py` pairs every text element and prints
dp deltas; `sbs.py` overlays the two captures.

**Foundations:** compose `BrandColors`/`ContentColors` as `--fc-c-*` (light + dark), HostTheme.kt
resolver; bundled Roboto (variable, latin + latin-ext, OFL, inlined — **+~76 KB gzip**); the Type.kt
scale with per-script line heights; **Compose's `LineHeightStyle` Trim.Both emulated** (a CSS text box
is n·lineHeight, a Compose one natural + (n−1)·lineHeight — without the trim every element drifted a
few dp per line); 32 app drawables + 26 Material icons as SVG (`scripts/gen-icons.py`); raster
drawables shrunk and inlined (~12 KB, `scripts/gen-assets.py`).

**Measured within ~1 dp of Android** (text-element positions): Language, Name, Settings, Help,
Home header/pill/CTAs/composer, Drawer sign-up card, Auth phone entry. Structurally matched by overlay:
Chat (loading + Tips, settled agentic answer, legacy pre-generated), night mode Home + Drawer.

**Ported per screen:** Splash (boot gradient, spin), Language (flattened rows, pinned selection,
48dp chip, legal paragraph), Name, LanguageChooser, Settings (+ hint line, Your phone row),
SettingsName, Help (FarmerChat v.X footer), Legal (full-bleed), Chat History, Drawer, Home (band,
Sunbeams, 5-state LocationButton pill, WeatherButton, Cards.kt cards incl. question-card
Saving → thank-you → fade, SSFR, FeedFooter, legacy tiles), Chat (LogoAppBar, bare answers, reserve +
question pinning, Tips, Chip/SuggestedCard follow-ups, Share-sweep/Save/Listen + SoundWave,
ScrollIndicator, StreamErrorCard, alignment chips, MarkdownText rows, ShareCard), Auth (agreement
card, consent, OTP boxes, country picker), FullScreenMessage (Account, Error, location interstitial
/ error / recovery sheet), input sheets, VoiceClip, LocationChatBubble, Toast (success/error/loading).

**Web additions / behaviour changes:**
- `config.assetBaseUrl` (web only, docs/03): the `farmer_looking_at_*` illustrations ship as files in
  `dist/illustrations/` (copied from the Android assets at build time, not inlined: ~1.5 MB). The
  widget script defaults it to its own folder; an ESM host must set it or the slot stays empty.
- `--farmerchat-inset-top/bottom` host CSS variables (default `env(safe-area-inset-*)`), standing in
  for Compose's WindowInsets.
- `APPROX_LOCATION_NAME` ported (GPS flow district > state > country + Home profile backfill).
- `contentCardImageUrl` ported: an agentic card tap shows the card image as a display-only banner
  on the question bubble, and **no longer sends `homeStatementId`** (compose HomeScreen.kt:1027-1051).
- Weather: served icons are S3 SVGs with `Content-Type: binary/octet-stream` and no CORS, which
  `<img>` refuses and `fetch` cannot read — web falls back to `fc_weather_sunclouds` (compose's
  fallback). Backend fix needed for parity.
- Label guard: 60 invented web keys retired; allowlist 67 → 7 (3 real compose keys the backend
  does not serve: `cant_load_right_now`, `failed_to_load_chats`, `no_chats_yet`).

**Known differences that are NOT UI:** feed cards, tips order and agentic replies differ per
session; the place name ("Bengaluru Urban" vs "Karnataka") differs because the Android host has a
`geoApiKey` and the harness does not; Indic scripts render with system fonts in Chrome, not Noto
(row heights are matched via a per-script line-box factor). The harness offsets status-bar-drawn
surfaces (Home band, drawer) by 49 dp — a web widget has no status bar.

**Not verified:** OTP send/verify (would text a real number), voice/camera permission flows,
Safari/Firefox, the widget inside a native WebView.

## Switching backend wipes the stored session — v2 iOS / RN / web (2026-10-08)

Reported from the widget demo: Home stuck on "Can't load right now". Both demo pages share one
origin, so a guest session issued by the mock backend was sent to the stage backend: every call
401'd, `get_new_access_token` failed, and the guest fallback (`send_tokens` with the foreign
`user_id`) 400'd — the SDK could never recover. Android v2 already handled this in
`FarmerChatGraph` (`prefs.clearAll(preserveAppearance = true)` when `LAST_BASE_URL` changes); v2
iOS, react-native and web only dropped the conversation id.

| | android v2 | ios v2 | react-native v2 | web v2 | v1 line (all platforms) |
|---|---|---|---|---|---|
| Base-URL change clears tokens / user / labels / conversation (keeps appearance) | ✅ (already) | ✅ `prefs.clearAll(preservingAppearance:)` — `swift build` + 110 core tests | ✅ `store.clearAllPreservingAppearance()` — `tsc --noEmit` | ✅ `store.clearAll([APPEARANCE_MODE])` — reproduced mock→stage in Chrome before/after | ⛔ NOT fixed: still drops only the conversation id |

Matters to any host that changes `environment` / `customBaseUrl` on an existing install.

## Guest re-initialisation on a rejected guest identity — docs/02 Step 3, all platforms (2026-10-08)

Follow-up to the entry above. A browser (or device) that still holds a guest the backend no longer
knows — a session from another backend before the wipe existed, or a deactivated guest — 401'd on
every call, `get_new_access_token` failed and `send_tokens` returned 400 "User not found or
inactive.", so the SDK could only end in session-expired and Home showed "Can't load right now".
User decision (docs/05, resolved same day): "yes implement auto new guest everywhere".

Step 3 (docs/02 TokenAuthenticator) runs only when **all** hold: the session is a guest
(`OTP_VERIFIED` false), the mode is not HOST_TOKEN, and the identity was rejected — `send_tokens`
answered 400/401/403/404, or there is no user/device id to send. It never runs on a network error,
timeout or 5xx (a guest is never discarded for a flaky network) and never for a phone-verified
user. Action: `initialize_user` (endpoint #1, guest API key, `{device_id, lat?, long?}`) → save
access/refresh + `user_id`, drop `NEW_CONVERSATION_ID`, retry the original request. Still
single-flight and inside the loop guard of 2.

| | android v1 | android v2 | ios v1 | ios v2 | react-native v1 | react-native v2 | web v1 | web v2 |
|---|---|---|---|---|---|---|---|---|
| Step 3 guest re-init | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Verified by | compile + `TokenAuthenticatorTest` (6 cases; module 21 tests pass) | compile + `TokenAuthenticatorTest` (6 cases; module 218 tests pass) | `swift build` + `TokenRefresherGuestReinitTests` (5; 26 total pass) | `swift build` + `TokenRefresherGuestReinitTests` (5; 115 total pass) | `tsc --noEmit` only — ⚠️ UNVERIFIED at runtime (package has no HTTP-client tests) | `tsc --noEmit` only — ⚠️ UNVERIFIED at runtime | `tsc --noEmit` + `test/authRecovery.test.ts` 4/4 | `tsc --noEmit` + `test/authRecovery.test.ts` 4/4 + Chrome repro against stage: `send_tokens` 400 → `initialize_user` 201 → feed 200, Home loads |

Known difference: Android's token calls (Steps 1–3) go through `authClient`, which has no
`AuthHeaderInterceptor`, so its `initialize_user` carries no `Build-Version` / `Device-Info`
(pre-existing for refresh / `send_tokens`). Stage accepts it (201) but records the guest with
`build_version: "v1"`; iOS / RN / web send both headers. Not changed here.

### Follow-up the same day: the new guest had no location, and stale requests overwrote the reload

Reported from the widget ("why nothing loads"): after Step 3, Home showed only "Have a great day,
come back tomorrow". The calls were 200, but the new guest had **no location server-side**, so
endpoint #12 returned `{"sections":[]}`, and the pill still showed the OLD user's state. Cause:
onboarding seeds the server location with fallback coordinates that are never stored, so Step 3's
"stored GPS fix only" sent none (verified on stage: `initialize_user` without lat/long gives an empty
feed; with lat/long the feed returns sections). Also, requests built before the replacement (the
retried one and concurrent ones) still carried the old `user_id`: `new_conversation` 400 "Invalid
user", weather/profile 404 (retryable, so they repeat), and they could land after the reload.

Fix (docs/02 Step 3, all eight trees): coordinates = stored fix → onboarding fallback (host default
→ device-locale centroid) → none; old place keys removed and the response's country/state
persisted; a guest-replaced signal + guest-generation counter; Home reloads (bypassing the loading
guard) and drops superseded results; Chat drops its cached conversation id.

| | android v1 | android v2 | ios v1 | ios v2 | react-native v1 | react-native v2 | web v1 | web v2 |
|---|---|---|---|---|---|---|---|---|
| Fallback coordinates + place rewrite + signal + generation guard | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Verified by | core compile + 29 unit tests (`TokenAuthenticatorTest` 14/14) + compose & views compile | core compile + 226 unit tests (`TokenAuthenticatorTest` 14/14) + compose & views compile | `swift build` + 30 tests (`TokenRefresherGuestReinitTests` 9) + `xcodebuild` SwiftUI & UIKit (iOS Simulator) | `swift build` + 119 tests (9 re-init) + `xcodebuild` SwiftUI & UIKit | `tsc --noEmit` only — ⚠️ UNVERIFIED at runtime | `tsc --noEmit` only — ⚠️ UNVERIFIED at runtime | `tsc` + `vite build` + `authRecovery.test.ts` 6/6 | `tsc` + build + `authRecovery.test.ts` 6/6 + Chrome on stage, 3 runs: stale guest → `send_tokens` 400 → `initialize_user` 201 → `new_conversation` / feed / weather / profile 200, 21 feed sections, stale 404s dropped |

Per-platform differences (honest ledger):
- Place keys: Android clears `APPROX_LOCATION_NAME` + `USER_SELECTED_STATE_CODE` + `USER_COUNTRY_NAME`
  (no district key); iOS / RN / web v1 have no approx-name key and clear district/state/country name.
- Web v1 Home does not fetch the profile on entry, so its reload is three calls, not four.
- Android chat never creates a conversation on send: FULL_JOURNEY relies on Home's reload (a Home
  ViewModel that is not alive when the signal fires runs its normal entry loads when next created);
  CHAT_ONLY's chat ViewModel creates one.
- Android compose Home re-reads `user_id` on each guest generation (it was `remember`ed once); the
  Views screens already read it fresh.
- iOS has no Home place pill; an already-open Settings shows the old place until it reloads.
- Only country/state are rewritten; the first init's `SHOW_CROPS_LIVESTOCKS` / `DASHBOARD` writes are
  not repeated. The v2 terms-of-use check is not re-run for the new guest.
- Delivery-path tests (signal → Home reload / Chat reset) exist only as the web Chrome run; native
  platforms are unit-tested at the authenticator and build-verified above it.

## Widget logic review (web v2 widget + SDK, 2026-10-08)

Review of `versions/v2/web/widget` against the SDK it hosts. Fixed:

| Issue | Fix | Verified (Chrome, stage) |
|---|---|---|
| Closing the panel left the microphone recording (no time limit) and TTS / voice clips playing — the panel only hides | SDK: page-level media-suspend signal (`core/mediaSuspend.ts`) + web-only `<FarmerChat active>` prop; recorder cancels (discards, never sends; also a start still waiting on the permission prompt), TTS and voice clips pause. Widget passes `active={open}` | stubbed `getUserMedia`: track `live` → `ended` on close |
| Landscape phones got a ~300 px floating panel; `layout.ts` still carried a `TODO(you)` stub | fullscreen when narrower than panel + 80 px **or** shorter than 560 px (`FULLSCREEN_MAX_HEIGHT`) | rule checked on 390×844, 844×390, 1440×900, 768×1024, 1366×550, 1280×560 |
| Esc closed the whole widget, and swallowed the event so the Terms dialog's own Esc never fired | Esc dismisses the topmost SDK layer (open drawer, bottom sheet, terms dialog — via its scrim) first; only with none open closes the panel; the location-permission modal is left to its buttons | real key events: drawer closes, widget stays; second Esc closes it, focus back on launcher |
| Launcher painted unstyled for one frame (styles injected in `useEffect`) | `useLayoutEffect` | styles present when the launcher is inserted |
| Scrolling past the end of an SDK list scrolled the host page | `overscroll-behavior: contain` on the panel and its descendants (host page untouched) | computed style |
| `hideLauncher` + floating panel had no close control | panel close bar shown whenever the launcher is hidden | bar visible, closes the panel |
| `defaultOpen` took focus from the host page on load | focus moves into the panel only on user-initiated opens | — (code only) |
| After `shutdown()`, SDK calls (`.sdk.openChat` …) went to the dead root and were lost | SDK clears its controller when the root unmounts, so calls queue for the next root | `.sdk.openChat(q)` after shutdown → boot → question delivered |

Not changed: a React host passing an inline `config={{…}}` rebuilds the session on every render
(documented in the widget README). iOS Safari can still scroll the page behind a fullscreen panel
when the touch starts on a non-scrolling area — fixing that needs host-page styling, which the
web rules forbid. Verified: `tsc --noEmit` + builds for the SDK and the widget; auth tests 6/6.

### Mobile pass on the widget (same day)

Emulated phone (390×844 @3x, touch, iPhone UA, fresh profile, stage via proxy), plus 844×390
landscape and 390×508 (on-screen keyboard stand-in). Walked launcher → language → name → Home →
drawer → chat answer → close → reopen. No horizontal overflow at any size; the fullscreen sheet
covers the viewport with the 40 px close bar above the SDK; the launcher hides while open and
returns on close; chat state survives close/reopen; the composer stays pinned with the
list scrolling above it on Home and Chat at every height. Fixed:

| Issue | Fix |
|---|---|
| Inline root kept the standalone `min-height: 480px`, so in a 350 px landscape panel the bottom of every screen was cut off | `.fcsdk-root--inline { min-height: 0 }` — the host container owns the height (web v1 + v2) |
| Landscape language screen: the pinned welcome panel took the whole height, no language visible | `@media (max-height: 520px)`: the language screen scrolls as one page (list first, panel after) — v2 |
| Landscape drawer: content 504 px in a 350 px drawer, "Sign up" off-screen and unscrollable | same media query: the drawer scrolls as a whole — v2 |

Not verified: a real device (iOS Safari's visual-viewport behaviour with the real keyboard, safe
areas / notch), Firefox. v1 web has no widget; its language screen / drawer were not re-laid out.

## Alignment chips sent their machine value instead of their label — v2 web / RN / iOS (2026-10-08)

Seen in the widget: tapping "Step-by-step plan" on a "Please confirm" surface put `written_plan`
in the farmer's bubble and sent it as the question. The app
(fc-compose-agentic `ui/chat/ChatScreen.kt:1639-1663`) shows AND sends the chip **label**, and
uses the **value** only to mark the chosen chip; `gender-select` alone sends the value (the
backend expects it) under its label. Android v2 (`routeAlignmentChip`) already did this; web, RN
and iOS v2 sent `value ?? label`.

| Platform | Fix | Verified |
|---|---|---|
| Android v2 | — (already correct) | — |
| web v2 | `alignmentChipSend()` in `core/alignment.ts`; `selectAlignmentChip` sends `query`, marks `selectionValue`, bubble shows `displayText` | tsc + vite build; `alignmentPick` test (6 new assertions); headless on stage: commodity-confirm chip sent "Yes, save tomatoes", bubble matches, stage answered |
| RN v2 | same helper in `core/types.ts`; `SelectAlignmentChip` uses it; `sendTextQuery` gains `displayText` | tsc |
| iOS v2 | `AlignmentChip.submittedQuery(for:)` — label first, value first for `genderSelect` | `swift test` (122 pass, 3 new) + simulator builds of SwiftUI and UIKit |

**Gap (iOS v2):** a `gender-select` bubble shows the sent value (e.g. `female`) rather than the
label, because `sendFollowUpQuestion` has no bubble-text override. Web / RN / Android show the label.

Chips on stage now also carry `submit: {kind, text, surface_type}` (docs/02 §#27a). On a decline
chip `submit.text` differs from the label ("No, do not save tomatoes to my farmer profile" vs
"Not now"). The app does not read `submit`, so no SDK reads it either.

## Chat screen re-sync with app dev/v2.5 @393c5bb0 — all v2 platforms (2026-10-08)

Reported from the widget: the chat loader "doesn't change text as per the API" and the UI is "not gradient".

**Live streaming on the backend.** The stage proxy now logs every agentic stream event as it arrives. A widget question on `mobile-app-stage` received NOTHING for 7.2 s, then `done` + `metadata` together. Five curl variants (topics, India/Kenya guests, `Build-Version`, direct dev and stage) gave the same result, with `trace` showing one `llm` step and no tools. **The backend is not streaming today**, so no client can change the loader text on it; the app on this host would also sit on "Getting your answer…". The SDK path was verified instead by replaying `docs/captures/agentic_stream_prose_20260903.sse` (`REPLAY_SSE=… PORT=8896 node demo/stage-proxy.mjs`). Web walked "Getting your answer…" → "Loading your farms" → "Farms loaded" → streamed text. The handling already matched the app (`status_text` aliases, 700 ms dwell, 4 s "Paused, resuming…", tips hidden once text flows).

**Two real drifts from the app, fixed on every v2 platform:**

| App source | Was in the SDK | Now |
|---|---|---|
| `ChatThreadContent.kt` ~583: `useChips = true` for EVERY answer (new upstream). `ChatResponseActions.kt`: Read full advice XOR action row | agentic row (note + Share with accent sweep border + Listen) and numbered chips only for agentic answers; legacy #27 and pre-generated answers got flat Share/Save/Listen and question cards; web/compose showed Read full advice AND the row | agentic row and chips for every answer; Read full advice replaces the row |
| `LoadingPlaceholder` → `LogoSpinnerHorizontal` with a `ShimmerText` primary-colour label | an invented `ThinkingIndicator` (muted plain label + 3 pulsing dots) on web, compose, SwiftUI, UIKit, RN; the app never had it | horizontal logo spinner + shimmering label (the component the stream status uses); `ThinkingIndicator` deleted |

| Platform | Verified |
|---|---|
| web v2 | tsc, tests, vite build; headless: replay (shimmer placeholder, tool labels) and a mock #27 answer (gradient Share + Listen + numbered chips) |
| Android v2 compose + views | `compileDebugKotlin` core/compose/views/samples; `testDebugUnitTest` core 226, compose 8, views 13 — 0 failures. Not run on a device |
| iOS v2 SwiftUI + UIKit | `swift build` + `swift test` (122) + simulator `xcodebuild` for both, exit 0. Not run on a simulator. UIKit gained Read full advice (closes the HIGH gap above for v2) and a conic sweep border |
| RN v2 | tsc + tests. Not run on a device |

**Gaps left (UNVERIFIED on device everywhere except web):** _(several closed 2026-10-09: wobble, Listen dimmed, compose follow-up header — see the line-by-line re-sync below)_
- ~~RN: no shimmer, 4-solid-side Share border~~ — closed the same day, see below.
- All platforms: no attention wobble on Read full advice. Listen is hidden when TTS is off; the app shows it disabled. The placeholder is not hidden while a voice question is still transcribing (app `isTranscribing`).
- Compose: the follow-up header keeps the accent dot + `titleSmall` secondary; the app uses `titleMedium` primary. The Read-full predicate is `== null` vs the app's `!= message.id`.
- Views: the pre-thread loader is still centred rather than under the question; `fc_item_suggested_question.xml` is now unused.
- SwiftUI: chat no longer offers Save (no Save in the agentic row); `FCThinkingIndicator` was removed from the public surface. iOS Listen now needs a server `messageId`, the same rule as web.
- UIKit still has no follow-up title row or fade.

### RN v2 gradients without a gradient library (same day)

RN has no gradient primitive, and even react-native-svg cannot draw a sweep (conic) gradient. So `src/ui/components/Gradients.tsx` builds the app's effects from plain Views, with no new dependency:

| App effect | RN now | Was |
|---|---|---|
| `brand.accentSweepBorder` on Share (3dp sweep) | `SweepBorder`: 72 coloured spokes clipped to the pill, content inset 3dp, so the corners are truly rounded | one solid colour per side |
| `InputComposer` aura (2.4dp sweep, 7s rotation, breathing 1↔0.5, ebb to 0.04) | `SweepBorder` with `rotateMs` + the same intensity loop; new `showAura` prop (default true, as in Compose); hidden while focused | skipped |
| `ShimmerText` on the horizontal LogoSpinner label (labelMedium, primary → borderActive, 1200ms) | `ShimmerText`: highlight copy in 3 nested sliding clip windows (soft band edges); label now labelMedium | static bodyMedium |
| `ShimmerText` on the composer placeholder (2250ms) | same `ShimmerText` | static colour |

Reduce Motion stops the rotation and the shimmer.

Verified with `tsc` + package tests, and by rendering `Gradients.tsx` through react-native-web in headless Chrome: sweep orientation (cyan right, green bottom, yellow left), rounded pill ring, aura rotating between frames, shimmer band passing. **Not run on a device**; Expo Go on the emulator was not set up this pass.

Remaining deltas: the aura has no faint bloom strokes; the placeholder's base colour switches rather than fading over 220ms; there is no low-RAM fallback (the app shows static text on low-RAM devices).

## Chat screen, line-by-line re-sync with the app's ChatThreadContent — all v2 platforms (2026-10-09)

Reported: "the ui in chat screen does not resemble exactly as android sdk or orginal android code
… i need ui to be exactly same pixel to pixel". **The 2026-10-08 re-sync above was incomplete.**
It fixed the action row and the loader. It did not touch layout, because the SDK chat screens were
ported from the app's older single-file `ChatScreen.kt`. That file predates the split into
`ChatThreadContent.kt` / `ChatLoadingContent.kt` / `ChatErrorContent.kt` /
`InlineErrorContent.kt`, which changed padding, error placement and follow-up placement.

**Method.** The app (fc-compose-agentic, built from a scratch clone of origin `dev/v2.5`
@393c5bb0, stage) and the widget (`demo/index.html?stage=1` at 411×914 @2.625) were captured on
the same questions. Three read-only agents produced value tables for every composable the chat
screen draws. Web was fixed first and re-captured; Android, iOS and RN were then ported from one
spec. The local `fc-compose-agentic` checkout (31a789e0) is 9 commits behind origin. The only
chat-UI difference between them is `useChips` (`isAgentic && !isPreGenerated` locally, `true` on
origin). The SDKs follow origin (`true`).

| App source | Was | Now (all v2) |
|---|---|---|
| `ChatThreadContent.kt:300-309`: LazyColumn padding h20 / top 20; bottom = composer height + 16 | 16 / 16; bottom = composer height | 20 / 20; + 16 |
| User row `padding(start = 64)` + bubble `widthIn(max 290)`; item fades in 500ms | 290 cap only | both |
| `InlineErrorContent.kt`: 48dp red disc + X, fixed "Something went wrong" label, grey radius-12 "↻ Try again" pill; inside the failed user item (spacedBy 12), holding a viewport reserve when last | raw error text in red + full-width pill button, appended after all messages | as the app. Voice failure: right-aligned retry pill |
| `ChatResponseActions.kt`: Column(top 24); follow-ups INSIDE it (16, titleMedium, 10, chips 8 apart), then 28 + 12 | follow-ups a separate list item after the last answer's full-viewport reserve, so off screen until scrolled; dot + titleSmall secondary title; 10 between chips; 12 above | as the app; not hidden by an error |
| `ListenButton(enabled = isTtsEnabled)`: alpha 0.4 when off | hidden | dimmed, inert |
| `Chip.kt`: labelMedium 600, Bold only when selected; escalate badge white with red number | always 700 (requested divergence, docs/05 §2) | as the app; docs/05 §2 marked superseded |
| `StreamErrorCard.kt`: 24dp icon, gap 12, bold title, radius-12 button, padding v14, green Refresh 20, bold label | 20dp icon, regular title, pill PrimaryButton | as the app |
| `AlignmentSurface.kt`: MarkdownText message, Listen on the live prompt, capability card (16 radius, 1dp border), one-run escape hatch, radius-16 escalate | bodyLarge plain text, no Listen, no card, radius 12 | as the app |
| `LogoSpinnerHorizontal.kt`: Material3 1.4.0 ring (6s, 10→87%, round caps), mark turns every 3s, ShimmerText black → #00C950 | 1.33s arc (10→75%, square caps), static mark, grey → black shimmer (web) | as the app |
| `LogoAppBar.kt`: glow clipped to the bar; Home entry uses `leftbutton.xml` (stroked arrow); logo fades out over 300ms | 16px of glow under the header (web); filled Material arrow | as the app |
| `ScrollIndicator.kt`: #00C950 disc, white arrow, composer + 16 up, bounce `IntOffset(0, 14)` = 14 device px | grey disc, black arrow, 14dp bounce | as the app |
| `InputComposer.kt`: placeholder ShimmerText band 1.2W, no wrap; hide offset 400dp, FastOutSlowIn | band 0.55W with a wrap-around copy; 160% offset, `ease` (web) | as the app |
| Android core: #27 error → `failedMessageId = last user message` | the dropped placeholder's id, so the error could not sit under the question | as the app |

**Text width (web only).** Android lays the same Roboto file out narrower than Chrome at 420dpi
(hinted advances). Measured on matched strings: regular 98.4–98.7%, semibold 99.3–99.6%, bold
99.0%. The web root now carries per-weight `letter-spacing` (-0.0066em / -0.0026em / -0.0052em),
emulating the reference device the same way the line-height trim does. It closes the user's own
example: "How to control aphids in mustard?" is 255.6dp on the device vs 259dp in Chrome, and wrapped
in the 258dp bubble. It is now 669 vs 671 device px and stays on one line.

| Platform | Verified |
|---|---|
| web v2 | tsc, package + widget build. Headless captures on `?stage=1` at phone size and desktop panel size: loading, answer, follow-ups, stream-error card, inline error (forced failure). Inline error measured against the app: disc 53→157 vs 53→158, pill 633→855 vs 633→855 |
| Android v2 compose + views | `compileDebugKotlin` core/compose/views; unit tests core 226 (forced rerun) + compose/views parity tests, 0 failures. Not run on a device |
| iOS v2 SwiftUI + UIKit | `swift build`, `swift test` 122/0, `xcodebuild` both schemes BUILD SUCCEEDED. Not run on a simulator |
| RN v2 | tsc 0, tests 10/0. Not run on a device |

**Gaps left:**
- **Header glow on web.** In the app the glow's bright top sits behind the status bar, so the 64dp bar shows only its tail. The widget has no status bar, so the whole band shows in the bar, which looks brighter. Left as is.
- **iOS:** no question-pinning scroll or viewport reserve; answers still sit in a grey card (follow-ups follow the card); no branded app bar/glow (UIKit uses the system nav bar); no composer. **UIKit only:** the alignment message is plain text, the bubble is still brand green, and there is no 500ms fade.
- **RN:** no question-pinning scroll / finished-answer reserve (still `scrollToEnd`); the stream card uses the info icon (no wifi-off/warning assets); the invented "Not sent" caption and `chat_clarification_required` banner remain.
- **Views:** the error is its own row (it looks the same); no wobble; no user fade; the Material Components ring animation differs from Compose's 6s cycle.
- **All platforms:** the wobble always runs (the app gates it on remote config and a once-per-day rule).

## Latest question pinned to the top; Home wheel scrolling in the widget (2026-10-09)

Reported: "whenever i ask question latest question should be on top of screen not first question
& scroll should not hide the latest question … in intercom why scroll is not working in home screen".

**Chat pinning.** The app (`ChatThreadContent.kt`) scrolls a newly asked question to the top of
the viewport and lets the answer grow into a viewport-high reserve below it. It never follows
streamed text. Android core already encodes this (`ChatReserve.kt` `holdsChatReserve` /
`chatScrollAnchorIndex`).

| Platform | Was | Now | Verified |
|---|---|---|---|
| web v2 | pinned | unchanged | headless, stage, phone + desktop panel: a typed follow-up and a chip follow-up ("Not sure") both sit 20px under the header, before and after the answer |
| Android compose | pinned | unchanged | emulator (LastCheckSDKCompose, chat-only, stage): the 2nd question's bubble text at y=391px both while loading and after the answer |
| Android views | pinned | unchanged | emulator (LastCheckSDKXML): same, y=391px |
| iOS SwiftUI | `scrollTo(last, .bottom)` on every new message | row min-height reserve + anchor = the row above a reserve holder, pinned 20pt below the top; follow-ups moved inside the last answer's block | builds; 122 core tests. **UNVERIFIED on simulator** |
| iOS UIKit | scroll to bottom | reserve as a dynamic bottom `contentInset`; same anchor | builds. **UNVERIFIED on simulator** |
| RN v2 | `scrollToEnd` on every new message | `ReserveRow` min-height + `scrollToIndex(viewOffset 20)` on the anchor; indicator stops at real content | tsc + tests. **UNVERIFIED on device** |

Known difference: SwiftUI keeps the reserve on the last AI response even when a failed follow-up
follows it (the literal Android/web rule), so scrolling up shows a screen of space above the
failed question. UIKit reserves only for the final holder.

**Widget Home did not scroll with a mouse wheel / trackpad.** `widget/src/styles.ts` put
`overscroll-behavior: contain` on every element in the panel. An `overflow: hidden` feed card is a
scroll container, so the wheel latched onto the card and could not chain to the feed (headless:
four wheel events, zero scroll events). Chat chips and code blocks had the same problem. Contain
now sits on `.fcw-panel` only. The feed scrolls 0 → end, and the host page (868px scrollable)
stays at scrollY 0. Touch scrolling was not affected.

## Answers did not stream on stage: streaming_required was never sent — web / RN / iOS (2026-10-09)

Reported: "still response loads at once in web intercom ui like not typing format check android
code & fix it". The app (`TextPromptRequest.streaming_required`, default true) sends the selected
language's `streaming_required` on every text query. Android v2 already did. Web, RN and iOS did
not (row 6 of the 2026-09 agentic table marked them ⛔), and docs/02 claimed the field did not gate
the stream. On stage it does:

| Request | What stage sent |
|---|---|
| without `streaming_required` | `done` + `metadata` only, after 11–19 s (16 answers today) |
| with `"streaming_required": true` | `status` ~2 s, then six `text_delta` chunks over ~1.3 s, then `done` + `metadata` |

Now on all v2 platforms: `SupportedLanguage.streaming_required` (default true), persisted as
`fc_sdk_is_streaming_required` at onboarding language selection and settings save (settings seeded
from storage), and sent on every `TextPromptRequest`.

| Platform | Verified |
|---|---|
| web v2 | tsc, tests, build. Live on stage (local proxy and https://farmerchat-widget.vercel.app): the widget types the answer, 55 → 311 → 557 → 617 chars |
| RN v2 | tsc + tests. Not run on a device |
| iOS v2 | core build + 125 tests (3 new: decode, encode, pref default); SwiftUI + UIKit simulator builds. Not run on a simulator |
| Android v2 | already sent it (unchanged) |

Stage's `status` event is `{"stage":"thinking"}` with no `status_text`, so the loader stays on
"Getting your answer…" until text arrives. That is correct (the app does the same).

## Chat-only by default; `guestApiKey` → `farmerChatApiKey`; keys built in — all v2 platforms (2026-10-09)

Requested: "make only chat screen openable in all platforms, dont delete code"; "guestapikey change
it to farmerchatapikey & geoapikey use ours for all sdk dont ask other parties to put theirs".
Decided with the user:
- chat-only is the **default**, and hosts can still pass `FULL_JOURNEY`;
- the chat bar keeps history and language;
- the old key name is **removed** (no alias).

| | Android | iOS | RN | web + widget |
|---|---|---|---|---|
| `mode` default `CHAT_ONLY`; `showDrawer` unset → `mode == FULL_JOURNEY` | ✅ | ✅ (Swift + ObjC) | ✅ | ✅ |
| Headless chat-only bootstrap (guest init, languages, labels, preferred language) | ✅ already | ✅ **new**, public `ensureChatOnlyBootstrap()` | ✅ **new** | ✅ **new**: first visit used to hit the language screen |
| Fresh conversation per chat-only journey (a history thread keeps its id) | ✅ already | ✅ **new**, public `beginChatOnlyJourney()` | ✅ **new** | ✅ **new** (widget: per page load, not per panel reopen) |
| Drawer off: history + language in the chat bar; drawer-level screens show back | ✅ already (views); compose via `showDrawer` | ✅ **new** | ✅ **new** | ✅ already |
| `farmerChatApiKey` (built in, optional) | ✅ | ✅ | ✅ | ✅ (web shipped a **blank** guest key before) |
| `geoApiKey` built in (same value as Android) | ✅ already | ✅ **new** | ✅ **new** | ✅ **new** |

Verified:
- **web:** in a browser on stage, a first open lands in chat (close / history / language), and the
  answer streams. A plain HTML page on another origin with only the two widget tags (script from
  Vercel, `customBaseUrl` = the Vercel stage proxy) does the same.
- **Android:** core 232 tests (6 new), compose, views and the three samples build.
- **iOS:** core 128 tests, SwiftUI, UIKit, SampleApp, ConsumerApp and the ObjC smoke target build.
- **RN:** tsc and 19 tests.
- **Device and simulator runs:** none for iOS or RN. Android chat-only was device-verified before
  this change (LastCheck hosts).

Known exposure, recorded in docs/05: the FarmerChat guest key and the Google geolocation key now
ship inside every SDK bundle (npm, widget script, iOS binary), as they already did in the Android
AAR. The Google key is **unrestricted** (geolocate accepted it from an arbitrary web origin), so it
should be restricted to the Geolocation API in Google Cloud.

Plain websites: the backends' CORS preflight allows any origin, but not the SDK headers (`API-Key`,
`Build-Version`, `Device-Info`, `X-Request-ID`) on stage, prod or EKS. A page on another site
therefore needs a proxy until the backend adds them to `CORS_ALLOW_HEADERS`. This is an ask for the
backend team.

## Latest question lost its pin after an unanswered alignment surface — all v2 platforms (2026-10-09)

Reported on the widget: after several questions the chat showed an earlier question instead of the
newest one. Reproduced on Railway: ask a question that gets an alignment surface (e.g. "What
fertilizer should I use for paddy?" → "Share location"), then type the next question instead of
tapping a chip.

**Cause.** `holdsChatReserve`'s alignment clause (`alignmentKind != null && no selection`) kept
the reserve on the previous answer even after a newer question was below it, because that answer
was still the newest *AI response* while the follow-up was in flight. Two rows held a screenful
each, so the pin target was a screen too low; when the old reserve collapsed, the browser's scroll
anchoring pulled the view back toward the first question.

**Fix.** `isLastResponse` now means *newest response AND the thread's final row* (KDoc in core
`ChatReserve.kt`). Callers pass that:

| Platform | Change |
|---|---|
| android compose | `isLastResponse = isLastAi && message.id == state.messages.lastOrNull()?.id` |
| android views | `ChatRow.Ai.isFinalRow`; `holdsReserve` uses `isLast && isFinalRow` |
| ios SwiftUI | `reserveRows` no longer adds the newest answer separately; only the final row holds it |
| ios UIKit | no change: its reserve inset already keys on the final row only |
| react-native | `holdsReserve(item, isLast && item.id === tailId)` |
| web | `holdsReserve(ai, isLastAi && isFinal)`; plus web-only: `overflow-anchor: none` on the chat scroller, and the pin re-checks itself ~700 ms after the smooth scroll and snaps to the question unless the farmer scrolled by hand (a hidden page never animates `behavior: 'smooth'`, and a mid-animation layout change can cut it short) |

Verified: android `:farmerchat-core:compileDebugKotlin :farmerchat-android-compose:compileDebugKotlin
:farmerchat-android-views:compileDebugKotlin :farmerchat-core:testDebugUnitTest` (exit 0); ios
`xcodebuild -scheme FarmerChatSwiftUI -destination 'generic/platform=iOS Simulator' build` (exit 0);
react-native `npx tsc --noEmit`; web `tsc` + build + tests (fail 0), widget build + tsc. Browser, live
stage: Q1 → Q2 (location surface) → typed Q3 — each new question lands at the top (scrollTop =
question offset − 20) and the unanswered surface collapses. Android/iOS/RN were not re-run on a
device for this change: UNVERIFIED on device.
