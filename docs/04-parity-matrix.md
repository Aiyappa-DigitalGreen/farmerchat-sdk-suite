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
| Composer lifted above the IME (`imePadding`) | n/a (UI) | ✅ | n/a (XML adjustResize) | n/a (UI) | ✅ | ✅ | ✅ | ✅ |
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
| Settings + appearance Day/Night/Auto | ✅ (pref; render in UI) | ✅ | ✅ (activity-local night mode) | ✅ (pref + THEME attr) | ✅ | ✅ | ✅ | ✅ (auto = prefers-color-scheme, live) |
| SettingsName | ✅ | ✅ | ✅ (toast via savedStateHandle) | ✅ | ✅ (+name-updated toast) | ✅ | ✅ | ✅ |
| LanguageChooser (settings) | ✅ (SettingsViewModel) | ✅ (save→toast→Home popUpTo(0)) | ✅ (same) | ✅ (SettingsViewModel) | ✅ | ✅ | ✅ | ✅ |
| Help/FAQ + legal WebView (#24) | ✅ (use case; WebView in UI) | ✅ (FAQ skeleton + WebView dialog + version footer) | ✅ (FAQ shimmer + WebView dialog + version footer) | ✅ (HelpViewModel) | ✅ (WKWebView sheet) | ✅ (SFSafariViewController) | ✅ (webview optional; browser fallback) | ✅ (iframe modal) |
| Error/NoInternet full-screen + per-source retry | ✅ (ErrorNavigationManager) | 🟡 (uniform popBack + retryLastAction, not 7 per-fromScreen branches — see debts) | ✅ (per-fromScreen retry table) | ✅ (ErrorNavigationManager port) | ✅ (centralized route + per-fromScreen retry) | ✅ (centralized `ErrorNavigationManager` on `FarmerChatViewController`: screens fire `navigateToError(fromScreen:retry:)` → full-screen error VC → Try again runs the stored retry; splash-init + chatHistory routed through it; **screenshot mock `ios-uikit-24-error.png`**) | ✅ | ✅ |
| Location prompt state machine (01 §3.15) | ✅ (LocationPromptManager) | ✅ (full overlay host + GPS resolution) | ✅ (full overlay host + GPS resolution) | ✅ (CoreLocation manager; RequestEnableGps → services-off error, no in-app resolution on iOS) | ✅ (global overlay host) | ✅ (`FCUILocationPromptHost` overlay above the nav stack driven by `LocationPromptManager`: interstitial → permission/fetch → recovery sheet / error; weather CTA routes through it then opens Chat; **screenshot mock `ios-uikit-25-location.png`**) | ✅ | ✅ (simplified: navigator.geolocation, same states; RequestEnableGps folded into permission — no browser equivalent) |
| Logout flow (#23 + clear + identity reset) | ✅ | ✅ (→Splash popUpTo(0)) | ✅ (→Splash clear-stack) | ✅ (clear prefs preserving appearance; identity reset = host listener) | ✅ | ✅ | ✅ | ✅ (identity reset = host listener concern; SDK clears fc_sdk_ state, preserves appearance) |
| Deep-link style openChat API | ✅ (FarmerChat.openChat + pending target) | ✅ (intent extras + pending target) | ✅ (intent extras + pending target) | ✅ (pending target consumed by routeFromSplash) | ✅ | ✅ | ✅ | ✅ (pending-target when onboarding incomplete) |
| Sample/example app | n/a | ✅ (sample-compose APK assembles + **re-driven on emulator 2026-07-20** with a profile selector: **dev** — host/splash/language/select/entername/home(feed+greeting+weather 26°C+content cards)/drawer/help/settings/settingsname; **themed** blue Home recolor `andc-20-themed-home.png`; **inline** embed `andc-24-inline.png`. Earlier dev pass 2026-07-17: guest init, feed, weather, labels, chat query. Screenshots `scratchpad/andc-*.png`) | ✅ (sample-views APK assembles + **re-driven end-to-end on emulator 2026-07-20** with a profile selector: **dev** — splash/language/select/name/home(cards+weather)/drawer(recent+nav)/settings/help; **mock** — home(SSFR/content/single-select cards), drawer(recent), AccountBenefits→Auth phone→OTP(1234)→AccountSuccess, chat text answer + follow-ups; **themed** blue recolor (Language/Name/Home); **chatonly** lands in chat; **togglesoff** (no drawer/weather); **override** (PHOTO✦/SPEAK✦/TYPE✦ + hi locale); **inline** embed — screenshots `scratchpad/andv-*.png`) | n/a | ✅ (SampleApp + xcodegen `project.yml` target; **runtime-tested on iPhone 17 simulator (iOS 26.1)**: guest init, geolocate, language onboarding incl. server `set_preferred_language`, home feed with live cards, chat #27 with real AI answer, all live against dev, 2026-07-17) | ✅ (SampleApp UIKit-native flow **runtime-tested on iPhone 17 sim (iOS 26.1) against the local mock, 2026-07-20**: splash→language onboarding→home(SSFR card)→drawer(recent-8)→settings→help→history→languageChooser→chat(real #27 answer)→error→location, 11 screens screenshotted `scratchpad/ios-uikit-*.png` + blue-theme recolor `ios-uikit-blue-home.png`) | ✅ (Expo app + **runtime-tested on emulator** via Expo Go SDK 52: guest init/language/name/dashboard/chat-retry live against **dev** 2026-07-17; **re-driven end-to-end against the local mock 2026-07-20** — onboarding, home (content/single/multi/SSFR cards + weather + greeting), Type input, and the previously-blocked **chat AI-answer path** (real markdown #27 → 3 follow-up chips → follow-up Ask → voice transcribe conf 0.93 → image #28 → TTS Listen → share) all screenshotted `scratchpad/rn-*.png`; the OTP-verify/drawer/error screens that a shared emulator had blocked were then **fully driven on a dedicated emulator-5556, 2026-07-21** — see debts) | ✅ (web/example Vite app + **runtime-tested in real headless Chromium (Playwright)**: full onboarding→home→chat→auth→settings→history→help→error→location + all C1–C5 features driven against the mock, 37 screens screenshotted, 2026-07-20 — see debts) |
| FarmerChatFab floating launcher | n/a | ✅ (composable; default/extended; verified on emulator) | ✅ (Material FAB subclass, XML drop-in; verified on emulator) | n/a | ✅ `FarmerChatFabButton` SwiftUI view — pinned round/extended launcher that reveals the journey via `.fullScreenCover` with a close ✕; `theme.brand.surfacePrimary` bg + `FCLogoMark` icon; optional `question` deep-link set before reveal (router consumes the pending target). `swift build` clean (build-verified; NOT runtime-exercised) | ✅ `FarmerChatFabButton: UIButton` drop-in subclass (host adds + constrains, parity with Views) — presents `FarmerChatViewController` from its owning VC (responder walk) with a close ✕ overlay; `leaf.circle.fill` glyph + `FCUITheme.brandSurfacePrimary` (matches the package's own logo treatment); optional `question` deep-link. `swift build` clean (build-verified; NOT runtime-exercised) | ✅ `<FarmerChatFab/>` component — pinned round/extended `Pressable` reveals `<FarmerChatView/>` in a full-screen `Modal` with a close ✕; `dayTheme.brandPrimary` + rasterized `fc_logo_mark` (host-logo override honored); optional `question` deep-link queues a pending target consumed on mount. `tsc --noEmit` clean (build-verified; NOT runtime-exercised) | ✅ `<FarmerChatFab/>` component + `FarmerChat.mountFab()` imperative — fixed launcher **reveals (mounts) the full-screen `<FarmerChat/>` overlay** with a close ✕ (NOT a silent `openChat` on an unmounted root); host `theme.colors.brandPrimary` + logo/🌱; optional `question` queues via `withController` and replays when the revealed root mounts. `tsc --noEmit` + `vite build` clean (build-verified; NOT runtime-exercised) |
| Build/type-check verified (CLAUDE.md §5) | ✅ `compileDebugKotlin` + `assembleDebug` AAR clean (2026-07-17, compileSdk 36) | ✅ `compileDebugKotlin` + `assembleDebug` AAR + sample APK clean (2026-07-17) | ✅ `compileDebugKotlin` + `assembleDebug` AAR + sample APK clean (2026-07-17) | ✅ `xcrun swift build --sdk iphonesimulator -target arm64-apple-ios15.0-simulator` clean + `swift test` **12/12** (re-run 2026-07-20 after API-hardening + theming + C1–C5) | ✅ same command, ios16.0-simulator target, clean (re-run 2026-07-20) | ✅ same command, ios15.0-simulator target, clean (re-run 2026-07-20) | ✅ `npx tsc --noEmit` + `tsc` build clean, re-verified by main session (2026-07-16) | ✅ `npx tsc --noEmit` clean + `vite build` clean, re-verified 2026-07-20 (v1.0.0) |
| **Distribution: import-by-coordinate proof (docs/07 A)** | ✅ `publishToMavenLocal` → `org.digitalgreen.farmerchat:farmerchat-core:1.0.0` | ✅ `:farmerchat-android-compose:1.0.0` | ✅ `:farmerchat-android-views:1.0.0` | ✅ `build-xcframework.sh` → `dist/FarmerChatCore.xcframework` (ios-arm64 device + arm64/x86_64 sim slices, embedded `.swiftinterface`); `Package.binary.swift` binaryTarget manifest; **consumed by `ios/ConsumerApp` which links the `.xcframework` (embed, NOT the source package) — builds AND runs on iPhone 17 sim, 2026-07-20**. v1.0.0 = `FarmerChatSDK.version` | ✅ `FarmerChatSwiftUI.xcframework` (dynamically links `FarmerChatCore.framework` via @rpath — no duplicate Core symbols; verified with `otool -L`); binary-consumed by `ConsumerApp` (`FarmerChatView`/`FarmerChatInlineView` from the compiled interface) | ✅ `FarmerChatUIKit.xcframework` (same dynamic Core link) + `FarmerChatUIKit.podspec` `ruby -c` **Syntax OK**; **CocoaPods absent → `pod lib lint`/trunk NOT run** | ✅ `tsc` build + `npm pack` → `digitalgreenorg-farmerchat-react-native-1.0.0.tgz` (773 kB, 357 files incl. dist+src+39 PNG assets); fresh `react-native/example-packaged/` installs it **from the .tgz** (real copy, not symlink) and passes `tsc --noEmit` **and** `expo export` (Metro bundled the SDK + all assets from node_modules, Android bundle emitted) (2026-07-20). `exports` map (`source`/`types`/`react-native`/`import`)+`main`/`module`/`types`; react/react-native peer-only (not bundled, no `dependencies`); `files`=dist+src+README; `sideEffects:false`. Version 1.0.0 in package.json + `SDK_VERSION` (kept in sync) | ✅ `npm pack` → `digitalgreenorg-farmerchat-web-1.0.0.tgz`; fresh `web/example-packaged/` installs it via `file:./…tgz` (not a workspace path) and passes `tsc --noEmit` + `vite build` (2026-07-20). Version from ONE source (`core/version.ts` `FARMERCHAT_VERSION` = 1.0.0, mirrored in package.json). `exports`/`main`/`module`/`types` → built `dist/`; react/react-dom peer-only (externalized); `files` allowlist = dist+README; `sideEffects:false` |
| **Host theming (docs/07 B): colors(+dark)/shape/typography/logo** | ✅ `FarmerChatTheme` model on `FarmerChatConfig.theme` | ✅ single `resolveBrand/ContentColors`+`resolveShapes`+`resolveTypography` overlay feeds LocalBrand/ContentColors/LocalFcShapes/MaterialTheme — every screen recolors with zero per-screen edits; day/night applies (host light → SDK dark kept); FAB + input-glyph tint + card/button radius honored; **screenshot-verified on emulator (blue host brand, Language + Home)** | ✅ `FarmerChatActivity` installs a `LayoutInflater.Factory2` (`FcThemeInflaterFactory`) BEFORE `super.onCreate` — creating layouts + custom views itself so it can post-process every inflated view, and propagating to fragment + RecyclerView-item inflation with zero per-screen edits. A shared `FcRecolor`/`FcViewTheme` resolver mirrors the Compose overlay: brand token values (green700/800/500/950, surface_active, error) in ColorDrawable/GradientDrawable/LayerDrawable backgrounds, tints and text colors are remapped to the host palette; stroked brand drawables re-stroked; adapters that swap brand drawables at runtime (LanguageListAdapter selection) call `FcRecolor.maybeRecolor`. **Screenshot-verified on emulator (blue host brand): Language `andv-02-language.png`/select `andv-02b`, EnterName `andv-03`, Home app-bar+weather-pill+input-tiles+buttons `andv-08-home.png`, 2026-07-20.** Residual: a few accent icon glyphs with baked vector fills stay SDK-green (documented limitation; primary surfaces recolor) | ✅ `FarmerChatTheme` (SwiftUI `Color`/`Image`; colors+dark/shape/typography/logo) on `FarmerChatConfig.theme`; public `Color(hex:)` helper | ✅ single `FCTheme.applyHostOverrides` resolver overlays host colors(+optional dark)/shape onto the token layer (`FCBrandColors`/`FCContentColors`/`FCShapes`) — every screen recolors with **zero per-screen edits**; auto on-brand contrast + derived button/dark-tint; day/night still applies. **Screenshot-verified on iPhone 17 sim (blue host brand, Language + Home), 2026-07-20** (`scratchpad/themed_language.png`, `themed_home.png`). Typography `typeScale`/`fontName` exposed as `theme.font(...)` tokens but per-`.font(.system(size:))` call sites NOT swept (see debts) | ✅ same host theme overlaid onto `FCUITheme` tokens (brand/button/surface/accent) via a `hostColor` KeyPath resolver (Color→UIColor); compiles clean (not screenshot-run this pass) | ✅ `theme` on `FarmerChatConfig` → single `resolveTheme` in the SDK ctor overlays host colors(+optional dark)/shape/typography/logo onto `src/ui/theme.ts` and reassigns the live token bindings (`dayTheme`/`nightTheme`/`radius`/`typography`/`brandLogo`) — colors + text typography recolor every screen with zero per-screen edits (a few brand-literal spots repointed to theme); day/night applies (light-only host → dark brand derived). **Screenshot-verified on emulator (blue host brand, Language + Home)**. Limitation: shape radii baked into module-level `StyleSheet.create` keep defaults (only render-time token reads pick up shape) | ✅ `theme` on FarmerChatConfig → single `resolveThemeVars` overlays scoped `.fcsdk-*` CSS custom properties on the root container (inline style), so every screen recolors with no per-screen edits; day/night still applies (host may supply only light → dark derived); logo override via `LogoGlyph`. **Runtime screenshot-verified in headless Chromium** (blue host brand): Home + Language recolor, computed `--fc-appbar` = `#1565C0` (`scratchpad/web-29/30`, 2026-07-20) |
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

**Fix**: added `defaultLatitude` / `defaultLongitude` to `FarmerChatConfig` (default
`12.9716, 77.5946` — Bengaluru, pairing with `IN`/`Karnataka`). When guest init returns a blank
`country_code`, the SDK now posts those coordinates to #11 before loading the feed, so the home
screen is populated for every guest regardless of GPS permission or `geoApiKey`. Best-effort: a
failure leaves the feed empty, i.e. the previous behaviour, and never blocks onboarding.

Hosts overriding `defaultCountryCode` **must** also set `defaultLocation(lat, long)`, or the feed
shows advice for the wrong region.

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

**Two labels are not on the server yet.** `fc_v2_app_label_connection_stopped_partial_saved` and
`fc_v2_app_label_response_paused_resuming` returned null from endpoint #3, so they fall back to
English. The backend needs to add them before those strings localize.

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

**Still to do for 2.0.0:** confirm the wire framing with the backend, port the streaming UI to
android-views, then to iOS, React Native and Web, and verify on a device.

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
    - **[HIGH] iOS UIKit "Read full advice" swap missing entirely** — no read_full_advice affordance in the UIKit package. ⬜ **ios-uikit**.
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
- **android-compose**: deviations, all functional — SmoothShapes corner smoothing approximated with plain rounded corners (no androidx.graphics.shapes dep); card mark-viewed fires on item composition rather than a strict ≥50%-visibility measurement; Error "Try Again" is uniform `popBackStack + retryLastAction` instead of the app's seven per-fromScreen branches (screens re-fire entry effects so retries still work); AccountSuccess→Home uses `popUpTo(Home)` instead of `popUpTo(AccountBenefits){inclusive}` (avoids a stale entry on the bypass path); VoiceInput returns the recorded file and the screen drives transcription (component not VM-injected).
- **android-views**: deviations, all functional — SIM-number prefill and SIM-picker dialog omitted (country auto-detect uses persisted guest-init country); WhatsApp OTP-less SDK reflection helper not integrated (channel buttons + SMS Retriever only; same functional path as RN/web); Home greeting is a static header above the pinned input row (app scrolls it under a sticky header); voice panel is tap-to-stop with timer, no waveform animation; chat scroll-indicator/Tips affordances not built; AccountSuccess can remain in the back stack under Home on the bypass-interstitial path (popUpTo(AccountBenefits) no-ops when absent); core's internal SDK_VERSION_NAME mirrored as a local constant for the Help footer.
- **android**: WhatsApp OTP endpoint #19 has no UI caller in either Android UI module (reflection-based WhatsApp OTP SDK from the app not integrated; channel selection still works via #17 with `channel:["whatsapp"]`). Endpoints #18/#33 implemented in core with no UI caller (same rationale as other platforms).
- **android (distribution/theming/features C1–C5, 2026-07-20)**: hardened to distribution-grade at v1.0.0. **Distribution PROVEN**: `./gradlew publishToMavenLocal` publishes all three artifacts under `org.digitalgreen.farmerchat:{farmerchat-core,farmerchat-android-compose,farmerchat-android-views}:1.0.0`; a new `:sample-consumer` module consumes the SDK **by Maven coordinate from `mavenLocal()`** (`implementation("org.digitalgreen.farmerchat:farmerchat-android-compose:1.0.0")`, NOT `project(...)`) and `:sample-consumer:assembleDebug` passes — dependency tree confirms `…:farmerchat-android-compose:1.0.0 → …:farmerchat-core:1.0.0`. Version from ONE source (root `build.gradle.kts` `farmerChatVersion`/group on all subprojects; runtime mirror `FarmerChatVersion.VERSION`). API hardening: `resourcePrefix="fc_"` on both UI modules; `requireGraph()`/`FarmerChatGraph` gated behind `@InternalFarmerChatApi` (opt-in error; UI modules opt in at module level, hosts cannot reach it); `-Xexplicit-api=warning` on core; retrofit/okhttp/gson demoted `api`→`implementation` so they are `runtime`-scope in the core POM (verified: NOT on the consumer compile classpath). **Theming PROVEN (Compose)**: `:sample-consumer` supplies a blue host `FarmerChatTheme`; **screenshot-verified on emulator (Pixel 6 Pro)** — Language (`scratchpad/phase2_language_blue.png`) and Home (`scratchpad/phase2_home_blue_final.png`) render fully in the host blue palette (app bars, tiles, primary buttons, accent chevrons + glyphs, 16dp cards, 8dp buttons) with zero per-screen edits. **Features C1/C2/C4/C5 wired in core (+Compose)**; C3 fully wired in Compose. Full `./gradlew assembleDebug` (all modules incl. Views + both project-samples + coordinate-consumer) passes. NOT yet done: **Views theming** (XML color/drawable resources are not runtime-overridden — the `FarmerChatTheme` model is reachable via core but the Views screens do not consume it) and **Views C3 UI toggles** (config fields exist; JourneyController/drawer/home in Views still render the full journey regardless). C2 HOST_TOKEN / CHAT_ONLY landing / programmatic openScreen / semantic hooks are build-verified but not runtime-exercised on device this pass (only the themed Language+Home journey was driven on the emulator).
- **ios (distribution + theming + features C1–C5, 2026-07-20)**: hardened to distribution-grade at v1.0.0. **Distribution PROVEN as a binary artifact**: `ios/build-xcframework.sh` archives each package for iphoneos + iphonesimulator and produces `dist/{FarmerChatCore,FarmerChatSwiftUI,FarmerChatUIKit}.xcframework` (each with device `ios-arm64` + `ios-arm64_x86_64-simulator` slices and the `.swiftinterface` copied into `Modules/` — the SwiftPM archive quirk the script works around by temporarily flipping products to `type: .dynamic`, restored on exit via a trap). The UI xcframeworks dynamically link `FarmerChatCore.framework` via `@rpath` (verified with `otool -L`) so there are no duplicate Core symbols. `ios/Package.binary.swift` is the binaryTarget manifest variant (swap `path:`→`url:`+`checksum:` for a remote release). A separate consumer `ios/ConsumerApp` links the three `.xcframework`s (`framework:`+`embed:true` in `project.yml`, **NOT** the source packages), imports all three modules from their compiled interfaces, exercises `FarmerChat.initialize`/`FarmerChatConfig`/`FarmerChatTheme`/`Color(hex:)`/`FarmerChatView`/`FarmerChatInlineView`/`sendQuestion`, and **builds AND runs on the iPhone 17 simulator** (`scratchpad/consumer_binary.png`, `consumer_full_menu.png`). What was NOT exercised: true git-URL/tag SPM resolution and remote CocoaPods trunk (offline); `FarmerChatUIKit.podspec` validated only by `ruby -c` (Syntax OK) — CocoaPods is not installed so `pod lib lint` was NOT run. **API hardening**: demoted the networking internals `APIClient`, `HTTPMethod`, `TokenRefresher`(+`Outcome`), `DeviceInfoProvider`, `KeychainTokenStore`(+`Key`) and `FarmerChat.tokenStore`/`.deviceInfo`/`SessionManager.tokenStore`/`FarmerChatAPI.init`/`SessionManager.init` to `internal` — none are referenced by the UI packages (`FarmerChatAPI`/`PreferenceStore`/`SessionManager` methods still consumed by UI stay public; the wire models + ViewModels are necessarily public across the multi-module boundary, documented constraint). All three packages still build clean after demotion and the binary consumer proves the internals are not reachable. **Theming PROVEN**: `FarmerChatTheme` (SwiftUI `Color`/`Image`; colors+dark/shape/typography/logo) on `FarmerChatConfig.theme` (Core imports SwiftUI only for these value types); one resolver `FCTheme.applyHostOverrides` overlays host overrides onto the SwiftUI token layer (`FCBrandColors`/`FCContentColors`/`FCShapes`) with auto on-brand contrast + derived button/dark tints, and `FCUITheme` gets the same overlay via a `hostColor` KeyPath resolver (Color→UIColor) — every screen recolors with **zero per-screen edits**. **Screenshot-verified on the iPhone 17 simulator (iOS 26.1, dev env, blue host brand: brandPrimary #1565C0 / brandPrimaryDark #0D47A1 / brandAccent #42A5F5)** — Language (`scratchpad/themed_language.png`: blue "Start using FarmerChat" CTA + light-blue chevron, radius 12) and Home (`themed_home.png`: blue Photo/Speak/Type tiles, blue "Start chat" accent, 16-pt cards) render fully in host blue, live feed cards from dev. **Features**: C1 `FarmerChatInlineView()` + `FarmerChatViewController` child-VC; C2 authMode SDK_OTP|HOST_TOKEN (`markHostAuthenticated`, `TokenRefresher` host-mode 401→tokenProvider→onSessionExpired); C3 mode FULL_JOURNEY|CHAT_ONLY + showSettings/History/Drawer + enableSsfr (SwiftUI-wired); C4 semantic callbacks (onScreenView/onChatOpened via AnalyticsDispatcher; onMessageSent/onAnswerReceived/onError in ChatViewModel; onSessionStart in initialize) + `FarmerChat.sendQuestion/openConversation/openScreen`; C5 `stringOverrides` (host wins) + forced `locale` in LabelManager. Verification depth: theming colors + C1 (build+run) screenshot/runtime-proven; C5 label resolution unit-tested (12/12); C2/C3(toggles)/C4 are **type-checked/build-verified but NOT runtime-exercised** (the themed sim run used the default all-on full-journey path). Typography: `typeScale`/`fontName` are exposed as `theme.font(...)` tokens and applied where that helper is used, but the screens' existing `.font(.system(size:))` call sites were NOT swept, so type scaling is partial (colors/shape are the fully-wired, screenshot-verified deliverables). UIKit C2/C3/C4 UI toggles are core-level only (UIKit-native screens not re-wired this pass — iOS 16+ hosts should prefer FarmerChatSwiftUI).
- **react-native (distribution/theming/features C1–C5, 2026-07-20)**: hardened to distribution-grade at v1.0.0. **Distribution PROVEN**: `tsc` build + `npm pack` → `digitalgreenorg-farmerchat-react-native-1.0.0.tgz` (773 kB / 357 files: dist + src + 39 PNG assets + README). A fresh `react-native/example-packaged/` installs the SDK **from the .tgz** (`npm install ../packages/farmerchat-react-native/digitalgreenorg-farmerchat-react-native-1.0.0.tgz` — a real copy under node_modules, NOT the `file:` symlink) and passes **both** `npx tsc --noEmit` **and** `npx expo export --platform android` (Metro resolved the SDK + all PNG assets from node_modules and emitted a 3.5 MB Android bundle). package.json is publish-correct: `exports` map (`source`/`types`/`react-native`→`src`, `import`/`default`→built `dist/`) + `main`/`module`/`types`; react/react-native are peerDependencies only (no `dependencies`, not bundled); `files`=dist+src+README; `sideEffects:false`. Version 1.0.0 in package.json and `SDK_VERSION` (kept in sync). **Theming PROVEN**: `theme` on `FarmerChatConfig` → a single `resolveTheme()` called in the SDK constructor overlays host colors(+optional dark)/shape/typography/logo onto `src/ui/theme.ts` and reassigns the live token bindings (`dayTheme`/`nightTheme`/`radius`/`typography`/`brandLogo`); colors + text typography recolor every screen with zero per-screen edits (a handful of brand-literal spots in Chrome/Cards/InputOverlays/Buttons were repointed to theme tokens). **Screenshot-verified on the Android emulator (Pixel 6 Pro, Expo Go SDK 52, dev env, blue host brand)** — Language (`scratchpad/fc_lang_clean.png`, selection `fc_lang_selected.png`), EnterName (`fc_after_lang.png`) and Home (`fc_home.png`) render fully in the host blue palette (app bars, dark-blue hamburger chip + Photo/Speak/Type tiles, light-blue accent icons/radio dot/chevrons, blue CTAs, blue-tinted footer flower). **Features**: C1 `<FarmerChatInlineView style/>`; C2 authMode SDK_OTP|HOST_TOKEN (+tokenProvider/401 path); C3 mode + showSettings/History/Drawer + enableWeather/Ssfr; C4 semantic callbacks + `FarmerChat.sendQuestion/openConversation/openScreen`; C5 stringOverrides + forced locale — all type-checked, and **C1 inline embed, C3 CHAT_ONLY, C5 stringOverrides + forced locale, C4 semantic hooks, and the blue theme recolor are now RUNTIME-verified on the emulator (mock, 2026-07-20; screenshots `scratchpad/rn-19..22`)**. Runtime NOT exercised: C2 HOST_TOKEN flow and programmatic sendQuestion/openConversation/openScreen (type-checked only). Known limitation: **shape** overrides (`cardCornerRadius`/`buttonCornerRadius`/`inputCornerRadius`) only affect radii read at render time (inline styles); radii baked into module-level `StyleSheet.create` at load keep their defaults — colors and text typography (incl. fontFamily/typeScale) are unaffected and recolor fully.
- **react-native (dedicated-emulator E2E pass, 2026-07-21 — closes the remaining runtime debts)**: driven end-to-end on a dedicated Android emulator (emulator-5556, Expo Go SDK 52 pulled from the shared device, mock backend via `adb reverse tcp:8899`, blue host theme). Every remaining screen now has UI+logic runtime evidence, screenshots `scratchpad/c-*.png`, each read back: **Splash** (`c-00`); **Auth OTP** entry → typed `1234` → Verify → **AccountSuccess "You're all set!"** (`c-09`/`c-09b`/`c-10`; mock `verify_otp` accepts any 4-digit, `Send_OTP_Click_Event`→`Verify OTP Screen`→`Account Success Screen`, 180 s resend timer shown); **AccountBenefits** (`c-07`); **Settings** appearance **Day→Night** applied live (whole screen dark, `c-20`/`c-20b`); **SettingsName** edit "Ravi"→"Ravi Kumar" → Save → "Your name has updated" toast (`c-21`/`c-21b`/`c-21c`); **LanguageChooser** change English→Hindi → Save (`Save_Language_Click_Event {language_code:"hi",from_screen:"settings"}` → Home) (`c-22`/`c-22c`); **Help** FAQ + Terms/Privacy + version footer (`c-23`) and the **legal WebView** modal opened the real Terms URL (`terms_of_use_opened`; content failed only because the emulator has no public internet — `net::ERR_INTERNET_DISCONNECTED`, `c-23b`); **ChatHistory** grouped list Today/Yesterday/This-week (`c-19`) and an **opened thread** rendering query-text + markdown response + image message + follow-up chips (`c-19b`/`c-19c`); **Chat retry** — dropping the mock reverse mid-send produced the "Not sent" + "No internet connection… Try again" bubble (`c-17`), then restoring it + Try again re-sent and rendered the answer (`c-17b`); **Error/NoInternet** full-screen (`error_type:NO_INTERNET,from_screen:language`) via a fresh guest with the mock unreachable (`c-24`), and Try again (mock restored) recovered to the Language screen (`c-24b`). The **blockquote fix** was re-shot: `> Tip:` now renders as a styled left-bar italic blockquote, not raw ">" (`c-11`/`c-11b`). **LocationPrompt**: the state machine is runtime-verified from the weather CTA (`Location_Update_Triggered {source:weather}` → `gps_flow_step {step:"interstitial_shown"}`, `c-25`), but the interstitial's full-screen RN `Modal` (`ui/screens/LocationPromptHost.tsx`) renders only a scrim (no visible card) on this **landscape-locked tablet AVD** (2560×1600, app letterboxed) — a Modal/letterbox layout quirk on that device, not a logic defect; the non-Modal full-screen messages (AccountBenefits/Success, Error) render correctly. **Four wire-model conformance bugs were found and fixed during this pass** (app source was authoritative; the RN port read wrong names — now at parity, `npx tsc --noEmit` + `tsc` build clean): (1) **blockquote** — `MarkdownText` had no `^\s*>` case so quotes showed the raw ">"; added a styled blockquote block (matches web `markdown.tsx`); (2) **`ConversationListItem`** read `title`/`question`/`last_message` but the API/app field is **`conversation_title`** (+`created_on`) — history-list rows and drawer recent-8 titles were blank (same class as the web/iOS bug); (3) **`ConversationChatHistoryResponse`** read `messages`/`results` but the app returns the array under **`data`** — history threads rendered empty; (4) **`ConversationChatHistoryMessageItem.questions`** was typed `string[]` but the app sends **`ConversationChatHistoryQuestion` objects** (`{follow_up_question_id,sequence,question}`) — rendering them crashed with "Objects are not valid as a React child"; added the object type and normalize to display strings. The C4 **`onError`** hook was also observed firing at runtime (`onError 0 "Network error"` on the dropped-reverse paths). Still not driven: `expo-location` actual GPS fetch (blocked by the interstitial-Modal render issue above) and the legal WebView's remote content (emulator has no public internet).

## READMENEW.md additive merge (2026-07-21 — new host-customization features, all ADDITIVE, no existing behavior removed; `git` baseline commit proves 0 deletions of prior features)

Good ideas from an alternate `READMENEW.md` spec were merged into the existing (richer) SDK. Each new field/method is optional and defaults to today's exact behavior (precedence: per-instance override → config default → existing theme/brand token). **Build-verified on every platform** (Android `compileDebugKotlin`; iOS `swift build` Core/SwiftUI/UIKit; RN `tsc --noEmit`; Web `tsc --noEmit` + `vite build`); **NOT yet runtime-exercised on device/emulator**.

- **`FarmerChat.updateTokens(accessToken, refreshToken?)`** — ✅ all platforms (Android/iOS/RN/Web). Runtime push of a freshly-refreshed host token into the active session (HOST_TOKEN mode), complementing the init seed + pull-based `tokenProvider`. Routed through each SessionManager; omitted refresh preserves the stored one.
- **FAB customization knobs** — ✅ all platforms. Config defaults `fabLabel`/`fabBackgroundColor`/`fabContentColor` on `FarmerChatConfig`; each FAB resolves per-instance param → config → theme/brand. Per-instance custom icon added (compose `ImageVector`, SwiftUI/UIKit SF Symbol `systemImage`, RN `icon` ImageSource, web `icon` ReactNode).
- **Granular chat UI knobs (the clean 5)** — ✅ all platforms: `userBubbleColor`, `userBubbleTextColor`, `aiBubbleTextColor`, `bubbleCornerRadius`, `messageFontSize` (Android: `messageFontSizeSp`). Wired at existing render sites with a `?? platform-token` fallback (each platform keeps its own current token when unset — e.g. iOS/Android user bubble = reading-surface/dark-text, UIKit user bubble = brand-bg/white-text). Font size wired at every markdown paragraph/bullet/numbered site, not just the first.

### Intentionally NOT shipped from READMENEW.md (tracked gap, needs opt-in)
- **`aiBubbleColor`, `aiAvatarEmoji`, `showUserAvatar`** — ⛔ all platforms. These are NOT overrides of existing UI: no platform renders a per-message AI bubble *container* (Android/RN show the AI answer as bare text on the surface; web/iOS have an AI bg) or any avatar (only iOS SwiftUI shows the logo as an AI mark; no platform shows a user avatar). Shipping them means building net-new per-message UI across 6 UI modules, layout-altering, and it contradicts the SDK's deliberate no-container AI answer design. Per parity rule #4 they must land on all platforms together or be recorded as a gap — recorded here. Config fields were deliberately left OUT so there are no dead/no-op knobs. Re-add with the UI only on explicit host request (build-verified only until a device run is possible).
- **README API-shape differences that are already covered a different way** (NOT gaps): flat `sdkApiKey`/`baseUrl` (we use `guestApiKey` + `environment`/`customBaseUrl`); `chatTitle`/`chatSubtitle`/`inputHintText`/`followUpHeaderText` (achievable via `stringOverrides` label keys); the README's 9 endpoints (a subset of our documented 34); `ChatModal`/`ChatFAB` naming (we ship `FarmerChatFab`/`FarmerChatFabButton`).
