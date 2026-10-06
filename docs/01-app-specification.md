# FarmerChat — End-to-End App Specification (Screens, Navigation, Lifecycle)

Source: production Android app `fc-compose`, package `org.digitalgreen.farmer.chatbot`. Jetpack Compose, single-Activity, Koin DI, Navigation-Compose with type-safe `@Serializable` destinations, UDF (Action/State) pattern in feature `udf/` subdirs. Flavors: `dev`, `stage`, `demo`, `eks`, `prod`.

This document is the authoritative behavioral spec that every SDK platform (Android Compose/XML, iOS SwiftUI/UIKit, React Native, Web) must reproduce.

---

## 1. Startup: Application & MainActivity

### FarmerChatApplication
- `Application`, implements `ImageLoaderFactory` (Coil): 25% memory cache, 2% disk cache at `cacheDir/image_cache`, crossfade on, `respectCacheHeaders(false)`.
- `init{}` calls `AppStartupTracker.onProcessStart()` first line.
- `onCreate()` sequence:
  1. Reads `BuildConfig.FLAVOR / DEBUG / VERSION_NAME / VERSION_CODE`.
  2. `AppStartupTracker.initialize` + `onApplicationCreateStart`.
  3. `Plotline.registerApplication(this)` (guarded).
  4. `FirebaseConfigGuard.disablePerformanceIfMisconfigured` (avoids crash on blank google-services key).
  5. `OnboardingRemoteConfig.initialize` (Remote Config defaults + fetch, e.g. `show_name_screen`).
  6. Main thread: `CrashlyticsManager.initialize`, then `initDI()` (`startKoin { modules(appModules) }`).
  7. Background `sdkInitScope` (Main dispatcher, SupervisorJob): parallel `async` inits — Plotline notif metadata, Firebase Performance, Adjust, MoEngage — then `registerPushListener` (MoEngage `CustomPushMessageListener`) + `AppInstallUpdateTracker.checkAndHandleInstallOrUpdate`, then `enableAdIdTracking`.
- SDK config: Adjust (`ADJUST_APP_TOKEN`, sandbox in debug, deferred deeplink listener, FB App ID), MoEngage (`MOENGAGE_APP_ID`, `DATA_CENTER_3`, notification icon `app_icon`).

### MainActivity
- `ComponentActivity`, `launchMode=singleTop`, portrait, splash theme.
- `onCreate`: `installSplashScreen()`, `enableEdgeToEdge`, builds `ForceUpdateManager` (in-app update via `updateLauncher` `StartIntentSenderForResult`; tracks `FORCE_UPDATE_POPUP_UPDATE_CLICKED` / `CANCEL_CLICKED`, finishes on cancel).
- Injected (Koin): `OnboardingStore`, `PreferenceHelperManager`, `LocationPromptManager`, `UpdateUserLocationUseCase`.
- `setContent`: manages **appearance mode** (`AppearanceMode.Day/Night/Auto` from `APPEARANCE_MODE` pref) → `darkTheme` and **languageCode** (`SELECTED_LANGUAGE_CODE`) state; wraps in `FarmerChatTheme`. Root `Box` sets `testTagsAsResourceId = true` (Appium).
- Creates `rememberNavController()` + `AppNavigator` (remembered once), stored in `appNavigator`.
- `LaunchedEffect(Unit)` startup effects:
  - Adjust deeplink reattribution: `Adjust.processDeeplink(AdjustDeeplink(uri))`, then `navigator.captureIntentTarget(intent)`.
  - Registers **Plotline redirect listener** (`Plotline.setPlotlineRedirectListener`) → `handlePlotlineRedirect(...)` on UI thread; also `setupPlotlineListener(this)`.
  - Collects `locationPromptManager.events`; on `LocationUpdatedFromWidget` → show "Location updated" toast + set `shouldRefreshHome`.
  - `shouldRefreshHome` effect: if not already on Home, navigate to Home (`popUpTo(Home){inclusive}`, singleTop); if on Home, let HomeScreen refresh in place (avoids double LoadHome).
- Renders `AppNavGraph(...)`, then global `LocationPromptHost(manager)` and a global `Toast` for widget location updates.
- `LaunchedEffect(appearanceMode)`: tracks THEME user attribute (Light/Dark/Default).
- Deferred (after first frame via `Choreographer.postFrameCallback`): `forceUpdateManager.checkAndUpdate()`, `initInstallReferrer()` (Install Referrer + UTM tracking), `maybeRequestFcmToken()` (FCM token → MoEngage `passPushToken`, `MoEPushHelper.pushPermissionResponse(true)`, `Adjust.setPushToken`, `PlotlinePush.setFcmToken`; skipped offline).
- `onResume`: `forceUpdateManager.resumeUpdateIfNeeded()`, marks first-activity-resume, `IS_PROFILE_LOADED = true`.
- `onNewIntent`: `setIntent`, Adjust deeplink reattribution, `appNavigator?.captureIntentTarget(intent)`.
- First-draw tracked via `ViewTreeObserver.OnPreDrawListener`.

### Deep links / intent handling
`AndroidManifest.xml` intent-filters on `MainActivity` (`autoVerify=true`):
- `http/https insights.go.link` (Adjust/Plotline links)
- `https farmerchat.farmstack.co`

`AppNavigator.captureIntentTarget(intent)` parses:
- URI query `?nav=home|chat` (+ `?query=`, `?channel=`), `navigation_screen=gps|location|auth|signup|login|account_benefits`, `notification_type=query|qapair`, `query`/`question`, `action=enable_location…`, `chatId`/`chat_id`. Default → Home.
- Notification extras (MoEngage) with same keys; `follow_up_question_*` collected; `qapair` w/ `response` uses `PendingPreGeneratedContent` (no API), plain `query` clears it (API call).
- If onboarding incomplete → `store.savePendingTarget(...)`; else navigate immediately.
- `PendingTarget` types: `Chat(chatId)`, `ChatQuery(question, source, channel)`, `Gps(action)`, `Home`.

`MainActivity.handlePlotlineRedirect` handles Plotline in-app KV pairs: `navigation_screen=gps/location` (builds `enable_location?...` action), `action=enable_location…`, `scroll_to_card=gender|crop|livestock` (emits to `PlotlineHomeEvents.scrollToCard`, navigating Home first if needed), `show_app_review=true` (`InAppReviewCoordinator.launchPlayInAppReview`), `qapair` pre-generated chat, `PlotlineWidgetInputHandler` (TYPE/MIC/PHOTO input actions), and `navigation_screen` routing.

---

## 2. Navigation

### Destination.kt — all routes
Sealed interface, `@Serializable`:

| Destination | Type | Arguments |
|---|---|---|
| `Splash` | object | — |
| `Language` | object | — |
| `Name` | object | — |
| `Home` | object | — |
| `Chat` | **data class** | `source="home"`, `question?`, `conversationId?`, `imageUri?`, `transcriptionId?`, `audioUri?`, `statementId?:Int`, `homeStatementId?`, `preGeneratedAnswer?`, `follow_up_questions?:List`, `isWeatherAdviceCTA=false`, `plotlinePreGeneratedAnswer?`, `isSSFR=false`, `ssfrCrop?`, `channel?` |
| `Settings` | object | — |
| `SettingsName` | object | — |
| `Help` | object | — |
| `SettingsLanguage` | object | — |
| `ChatHistory` | object | — |
| `Error` | data class | `isNetworkError=true`, `fromScreen=""` |
| `AccountBenefits` | object | — |
| `Auth` | object | — |
| `AccountSuccess` | object | — |
| `LegalContent` | data class (**dialog**) | `url`, `title` |

### AppNavGraph
`startDestination = Splash`; global fade transitions (500 ms). Shared drawer state (`AppDrawer`) wraps Home/Chat/Settings/Help/SettingsLanguage/ChatHistory. Graph-level state: `drawerLanguageDisplay/Code`, `settingsUserName`, `isAuthenticated` (from `OTP_VERIFIED` pref), `showNameUpdatedToast`. `chatHistoryVM` shared across drawer.

Key effects in the graph:
- `LaunchedEffect(isAuthenticated)` → `chatHistoryVM.refresh(context)` when authenticated.
- `LaunchedEffect(Unit)` collects `errorNavigationManager.errorEvents` → navigate to `Error(isNetworkError, fromScreen)`, singleTop.
- `DisposableEffect(navController)` `OnDestinationChangedListener`: updates `PlotlineWidgetInputSurfaceHolder`, `errorNavigationManager.setActiveScreen(screenId)`, re-syncs drawer language/username/auth from prefs, marks `AppStartupTracker.onFullDisplayReady` once (skipping Splash/Error).

**Navigation edges:**

| From | Trigger | To | Backstack behavior |
|---|---|---|---|
| Splash | `onReady` → `navigator.routeFromSplash()` | Language / Name / Chat / Home (pending target) | `popUpTo(0){inclusive}` |
| Language | submit success | `routeFromSplash()` → Name or Home | popUpTo(0) |
| Name | save/skip success | `routeFromSplash()` | popUpTo(0) |
| Home weather | `onWeatherClick` | `Chat(source=home, question, isWeatherAdviceCTA=true)` | push |
| Home content card | `onContentCardTap` | `Chat(question, preGeneratedAnswer, follow_up_questions, homeStatementId, imageUri)` | push |
| Home input | `onSendMessage` | `Chat(question, imageUri, transcriptionId, audioUri)` | push |
| Home SSFR | `onSsfrClick` | `Chat(question, isSSFR=true, ssfrCrop)` | push |
| Home (post-update, non-Kenya) | `AppInstallUpdateTracker.isUpdateLanguageScreenPending` | `SettingsLanguage` | singleTop |
| Chat | `onClose` (Home entry) | `Home` | `popUpTo(Home){!inclusive}`, singleTop |
| Drawer `home` | `navigateDrawerRoute` | Home | `popUpTo(startDestinationId)`, singleTop |
| Drawer `settings`/`settings/language`/`help`/`chatHistory` | drawer | respective | `popUpTo(startDestinationId)`, singleTop |
| Drawer recent question | `chat/history?conversationId=`/`?question=` | `Chat(source=history, conversationId/question)` | push |
| Drawer/Settings/Chat/Help/Home "See all" | `onSeeAllClick` | offline→`Error(fromScreen=chatHistory)`, else `ChatHistory` | singleTop |
| Drawer/Settings sign-up | `handleSignUpClick` → `getUserQuestionCount()` | `bypass_interstitial`→`Auth`, else `AccountBenefits` | push |
| Settings | `onNameClick` | `SettingsName` | push |
| Settings | `onLogOutClick` | `Splash` | logout: `historyUseCase.logoutApp()`, `prefClearAll` (preserve appearance), `DashboardPreferenceManager.clearAll`, `MoECoreHelper.logoutUser`, clear location prompt; `popUpTo(0){inclusive}` |
| SettingsName | `onSaveComplete` | back (popBackStack) + toast flag |
| SettingsLanguage | `onLanguageSaved` | Home (delay 500) `popUpTo(0){inclusive}` |
| SettingsLanguage | `onFetchLabelsFailure` | Home `popUpTo(Home)` |
| Help | `onOpenUrl` | `LegalContent(url,title)` dialog | singleTop |
| ChatHistory | `onOpenChatFromHistory` | `Chat(source=history, conversationId)` | push |
| ChatHistory | `onNavigateToError` | `Error(fromScreen=chatHistory)` | singleTop |
| AccountBenefits | primary CTA | offline→`Error(fromScreen=auth)`, else `Auth` | push |
| AccountBenefits | Skip / back | popBackStack |
| Auth | `onSuccess(phoneE164, existingUser)` | sets `OTP_VERIFIED=true`, `PHONE_NUMBER_LOGIN`, `KEY_NAME_SCREEN_SEEN=true` → `AccountSuccess` | `popUpTo(Auth){inclusive}`, singleTop |
| Auth | `onClose` | popBackStack |
| Auth | `onOpenLegal` | `LegalContent` dialog |
| AccountSuccess | Continue / BackHandler | `Home` | `popUpTo(AccountBenefits){inclusive}`, singleTop |
| Error | `onTryAgain` | varies by `fromScreen` (drawer/chathistory/home_weather/home_card/language/name/auth) → popBackStack or re-navigate + `errorNavigationManager.retryLastAction()` |
| LegalContent (dialog) | onBack | popBackStack; onDispose re-tracks parent Plotline page |

### AppNavigator
`routeFromSplash()` decision tree: `!isLanguageSelected` → Language; `!isProfileDone && !hasSeenNameScreenOnce` → (RemoteConfig `getShowNameScreen()` false ⇒ `markProfileDone` + fall through; true ⇒ Name); else consume `PendingTarget` → Chat/ChatQuery/Gps(Home+prompt)/Home. All with `popUpTo(0){inclusive}`. Also `navigateToChat`, `navigateToSettings`, `captureIntentTarget`, `popBackStack`, `navigate`.

### ErrorNavigationManager (core/navigation)
Central one-shot error nav via buffered `Channel<ErrorEvent>` (`errorEvents` flow). Tracks `activeScreen` (ignores errors from a screen no longer visible), `hasPendingError` StateFlow (Splash checks this before auto-routing), and a `retryAction` (invoked by `retryLastAction()`). `navigateToError(isNetworkError, fromScreen, retry)`; `clearRetryAction()`.

---

## 3. Screens

### 3.1 Splash — `ui/onboarding/splash/SplashScreen.kt`
- **UI:** `boot_bg` full-bleed image + rotating `logo_mark` (tinted `brandColors.foregroundPrimary`; keyframe rotation holds 3 s then spins). `Toast` (Loading) "FarmerChat is starting…" after 2 s.
- **State observed:** `errorNavigationManager.hasPendingError`.
- **Lifecycle:** `DisposableEffect` hides nav bars (restores onDispose). `LaunchedEffect(Unit)`: Plotline trackPage SPLASH, `IS_PROFILE_LOADED=true`, `AppStartupTracker.onInitialDisplayReady`, min-duration delay (200 ms), analytics (`APP_OPENED`, screen view, identify user, `BUILD_VERSION=V2`), then `onReady()` unless a pending error exists. `LaunchedEffect(hasPendingError)` gates toast. onDispose tracks screen exit off main thread.
- **Actions:** none (auto). No back handling (start destination).
- **UDF** (`splash/udf/OnboardingAction.kt`, `OnboardingState.kt`) — used by `OnboardingSharedViewModel`. Actions: `FetchGeoLocation(body, fromScreen)`, `ConsumeGeoResult`, `FetchSupportedLanguages(countryCode, state)`, `SelectLanguage(languageId)`, `ApplyLanguageFromModal(languageId, languageCode)`, `FetchLegalLinks`, `GetStartedClicked`, `AcceptTerms`, `ConsumeLanguageResult`, `ConsumeErrorNavigation`, `ResetState`. State fields: `geoState`, `guestInitState`, `languageState`, `expandedLanguages`, `selectedLanguageId`, `langauge_code`, `labelsRefreshToken`, `isFetchingLabels`, `fetchingLabelsForId`, `isApplyingLanguageFromModal`, `privacyPolicyUrl`, `termsOfUseUrl`, `isSubmittingLanguage`, `languageSubmitSuccess`, `submitErrorMessage`, `shouldNavigateToError`, `errorIsNetworkError`, `errorFromScreen`.

### 3.2 Language onboarding — `ui/onboarding/language/LanguageScreen.kt` (`LanguageSelectionScreen`)
- **VM:** `OnboardingSharedViewModel`.
- **UI:** `Scaffold`; scroll `Column` with `logo_mark`, title "Choose your language", subtitle "You can change this later", `RadioButton` list (priority + expandable "All languages" chip → `expandedLanguages`), per-row loading (`fetchingLabelsForId`). Bottom bar (`Containers.roundedTop`): tagline, `PrimaryButton` "Start using FarmerChat" (enabled when `selectedLanguageId != null && languageState is Success`), `ClickableText` legal (Terms/Privacy → `LegalContentDialog` WebView).
- **State observed:** `sharedVM.state` (`OnboardingState`), `privacyPolicyState`.
- **Loading/error/empty:** `languageState` Idle/Loading → `LogoSpinner` ("FarmerChat is Starting…" / "Loading languages…"); Error → same spinner (no error UI — silently retries). Success → list.
- **Actions → VM:** `SelectLanguage(id)` (debounced), `FetchGeoLocation`, `FetchLegalLinks`, `AcceptTerms` + `GetStartedClicked` (on Start), `ResetState` (if `LANGUAGE_DONE` false).
- **Lifecycle:** Plotline trackPage LANGUAGE; `DisposableEffect` sets active screen "language"; `LaunchedEffect` fetches geo/legal, refreshes RemoteConfig, `updateBuildVersionUseCase`; `LaunchedEffect(languageSubmitSuccess)` → `onLanguageSubmitted()` (`navigator.routeFromSplash()`). Screen view/exit analytics.

### 3.3 Enter Name — `ui/onboarding/name/EnterNameScreen.kt` + `components/EnterNameRoute.kt`
- **VMs:** `EnterNameViewModel` (`onAction(context, UserNameAction, screenName)`), `UserProfileViewModel`.
- **UI:** `Scaffold`; `logo_mark`, title "What should we call you?", subtitle, `TextInput` (letters/single-spaces via `normalizeNameInput`, autofocus, keyboard shown), `PrimaryButton` "Save name" (Loading/Chevron/Default; enabled 1..max), animated `SecondaryButton` "Skip for now" (hidden once text typed).
- **Route logic (`EnterNameRoute`):** name `rememberSaveable` (sanitizes "No Name"/"null"); fetches profile when logged in; prefers server name; validation (min 3 / max 100 → error toast); on `UpdateUserName` success sets `KEY_NAME_DONE`, saves `USER_NAME`/`USER_NAME_ADDED`, `ConsumeUpdateResult`, `navigator.routeFromSplash()`. Skip: track + `KEY_NAME_DONE=true` + routeFromSplash.
- **UDF** (`name/udf/`): `UserNameAction`: `UpdateUserName(body: UserNameRequest)`, `ConsumeUpdateResult`. `UpdateUserNameState`: `updateUserNameState: UiState<UpdateUserName>`.
- **Lifecycle:** Plotline ENTER_NAME, screen view/exit, keyboard auto-show; navigation only on API `Success` (one-time).

### 3.4 Auth (Phone + OTP) — `ui/auth/AuthScreen.kt`
- **VM:** `AuthViewModel` (`AuthState`, `AuthStep.{PhoneEntry, OtpEntry}`, `AuthToast`, `AvailableChannels`).
- **UI:** `DefaultAppBar` (Close). Two steps:
  - `PhoneEntryContent`: `CountryCodeSelector` (+ flag), phone `TextInput`, WhatsApp/SMS `PrimaryButton`s (conditional on `availableChannels`), country spinner while loading. Dialogs: SIM picker, manual country-code, full-screen `CountryPickerScreen` (search + `RadioButton` list + Save).
  - `OtpEntryContent`: `OtpInput` (4 digits), Verify button, 180 s countdown timer, Resend/Start-over (after timeout). No auto-submit.
- **State observed:** `vm.state` (step, countryCode, phoneLocal, otp, errors, `sendOtpState`, `verifyOtpState`, `availableChannels`, `countries`, `selectedCountry`, `toast`, `existingUser`).
- **VM functions:** `autoDetectCountryFromLocation`, `fetchCountries`, `setCountryCodeFromSim`, `setPhoneLocal`, `showLocationDetectionError`, `refreshOtpModeForCountry`, `sendOtp(context, "whatsapp"/"sms")`, `verifyOtp`, `startOver`, `selectCountry`, `setCountryCode`, `setOtp`, `isPhoneValid`, `consumeToast`.
- **Lifecycle:** Plotline AUTH, screen view/exit (AUTH + VERIFY_OTP per step), keyboard auto-show, `Mobile_verification_Started`. Timer effect; SMS Retriever `BroadcastReceiver` registered only on OTP step (`extractOtpFromMessage`); WhatsApp OTP SDK; permission launcher for SIM read. On `verifyOtpState` Success → track phone attr, delay 800, `onSuccess(e164, existingUser)`.

### 3.5 AccountBenefits (interstitial) — inline in `AppNavGraph.kt` via `FullScreenMessage`
- **UI:** `FullScreenMessage` "Sign up" / "Save your questions and answers" / farmer illustration (`LOOKING_AT_CAMERA`) / "Sign up with phone number" CTA + Skip.
- **Lifecycle:** `DisposableEffect` tracks Plotline `Screen_Viewed`/`Screen_Exited` (Plotline-only). CTA offline → error; else `Auth`.

### 3.6 AccountSuccess — `ui/auth/AccountSuccessScreen.kt`
- **UI:** `FullScreenMessage` "You're all set!" + `LOOKING_AT_SKY` illustration + Continue.
- **Back handling:** `BackHandler` → Home (`popUpTo(AccountBenefits){inclusive}`). Continue same. Tracks `Signup_Continue_Clicked` + Plotline ACCOUNT_SUCCESS.

### 3.7 Home — `ui/home/HomeScreen.kt` (1544 lines)
- **VMs:** `HomeViewModel` (`vm`), `EnterNameViewModel` (`vmProfile`, for gender/livestock profile updates).
- **UI:** `Box` → `LazyColumn` with sticky header:
  - `HomeAppBar` (hamburger → openDrawer + `HAMBURGER_MENU_CLICKED`, weather button w/ temp+icon, fades via `weatherAlpha`).
  - Greeting (`Crossfade` + `GreetingSkeleton`, `attentionWobble`).
  - **stickyHeader** `PrimaryInputButtons(HomeScreen)` (Photo/Speak/Type).
  - Plotline widgets (`PlotlineComposeWidget` top/bottom/below-SSFR).
  - `SsfrCard` (wheat/maize) when `ssfr_enable`.
  - `FeedHeader` "For your farm today".
  - Feed sections (`itemsIndexed`): `ContentCard` (image/statement), `SingleSelectCard` (gender question), `MultiSelectCard` (crop/livestock), `plotline_widget`. `FeedFooter`.
  - Overlays: `TextInput` (bottom, `imePadding`), `VoiceInput`, `PhotoInput`, `Toast`, `PermissionSettingsDialog` (camera/mic).
- **State observed:** `homeState` (`HomeState`) + `locationPromptManager.state`.
- **Loading/error/empty:** `homeFeedState` Loading or widget-GPS loading → `LogoSpinnerVertical` ("Getting today's advice" / "Getting your location…"); Error → `HomeFeedErrorUI` (retry → LoadHome, `Content_Try_Again_Clicked`); feed fades in via `feedAlpha`.
- **Actions → VM (`HomeViewModel.onAction`)**: `LoadHome`, `LoadWeather`, `NewConversation`, `FetchUserProfile`, `FetchImageStatement` (content-card tap → then nav to Chat), `MarkImageViewed` (on card ≥50% visible), `UpdateCultivatedCrops` (crop card), `ClearTranscriptionState`; `vm.dismissCard(sectionId)`; `vmProfile.onAction(UpdateUserName(...))` for gender/livestock. Weather click routes through `LocationPromptManager` (triggerFromWeather / setPendingNavigation) or straight to Chat if location known. Camera/gallery/mic launchers with permission-attempt/deny counting + settings dialog after 2 denials.
- **Lifecycle:** Plotline trackPage HOME + `PlotlineWidgetInputSurfaceHolder=HOME` (DisposableEffect). `LaunchedEffect(Unit)`: NewConversation, FetchUserProfile, screenView, dashboard events, LoadHome + LoadWeather (guest passes `userId=null`). Collects `PlotlineWidgetInputEvents.inputActions` (TYPE/MIC/PHOTO), `PlotlineHomeEvents.scrollToCard` (waits ≤3 s for section, animate-scrolls), `locationPromptManager.events` (widget location refresh). Post-feed: after 5 s requests MoEngage push permission (coordinating with Plotline visibility). `updateBuildVersionUseCase`.
- **UDF** (`home/udf/`):
  - **HomeAction**: `LoadHome(context, userDeviceTime, userId?, skipLoadingCheck)`, `LoadWeather(context, userId, skipLoadingCheck)`, `FetchUserProfile(context, userId)`, `UpdateCultivatedCrops(context, userId, cropIds)`, `NewConversation(context, userId, contentProviderId?)`, `TranscribeAudio(context, conversationId, query, messageReferenceId, audioFormat, triggeredType)`, `MarkImageViewed(statementId, userId)`, `FetchImageStatement(statementId, triggered_input_type)`, `ClearTranscriptionState`, `ConsumeResult`, `SetLoadingState`.
  - **HomeState**: `homeFeedState: UiState<HomeUdfResponse>`, `weatherState: UiState<WeatherResponse>`, `cropUpdateState: UiState<CropResponse>`, `newConversationState: UiState<NewConversationResponse>`, `voiceTranscribeState: UiState<GetVoiceResponse>`, `imageViewedState: UiState<ImageViewedResponse>`, `imageStatementState: UiState<ImageStatementResponse>`, `dismissedCardIds: Set<String>`.
  - VM private handlers: `loadHome`, `loadWeather`, `updateCultivatedCrops`, `newConversation`, `transcribeAudio`, `markImageViewed`, `fetchImageStatement`, `fetchUserProfile`, `dismissCard`, `handleNoInternet`/`navigateToNoInternetScreen`/`showApiErrorWithRetry`, `saveToPreferences`.

### 3.8 Chat — `ui/chat/ChatScreen.kt` (1827 lines)
- **VM:** `ChatViewModel`.
- **UI:** `Box(surfaceReadingPrimary)` → `LogoAppBar` (Close if Home entry / Menu if History entry; logo shown when Thread & not loading). Body by `ChatUiState`:
  - `Loading` → `ChatLoadingContent` (first question bubble + spinner).
  - `Thread` → `ChatThreadContent` (messages, suggested/related questions, Read-full-advice, share/download/listen, scroll indicator, TTS state, chat-bubble audio).
  - `Error` → `ChatErrorContent` (message, retry, question bubble, input buttons).
  - Invisible `ShareCard` captured via `rememberGraphicsLayer` for share/download.
  - `ChatInputOverlays` (text/voice/photo + camera/gallery), `Toast`, permission dialogs.
- **Derived `ChatUiState`**: Loading / Thread(messages, isLoading) / Error(message, onRetry, questionText, imageUri, audioUri).
- **Actions → VM (`ChatViewModel.onAction`)** — initialization `LaunchedEffect` picks one of: `LoadChatHistory` (history entry), `InitializeVoicePrototype` (audio-only), `InitializeWithPreGeneratedContent` (has answer), `SendQuestionWithImage` (imageUri), or `InitializeWithQuestion`. Follow-ups: `SendFollowUpQuestion`, `SendFollowUpVoiceQuestion`, `SendQuestionWithImage`. `ReplacePreGeneratedWithQuestion` (Read full advice), `RetryLastRequest`, `SynthesiseAudio`/`SetAudioPlaying`/`ClearAudioPlaybackUrl` (Listen), `ClearMessages` (onDispose).
- **Voice/audio/streaming/images:**
  - **Chat-bubble audio playback** (user voice clips): single `MediaPlayer`, play/pause, position polling (falls back to elapsed-time for URL streams), duration preloaded via `getAudioDurationMs` (downloads http OGG to temp for `MediaMetadataRetriever`).
  - **Synthesised answer audio (Listen/TTS):** `SynthesiseAudio` → `audioPlaybackUrl` → `MediaPlayer` with play/pause; analytics for started/stopped seconds; disabled via `isTtsEnabled`.
  - **Sound effects:** `SoundPool` success/error tones (trigger currently commented out) + haptics.
  - **Images:** camera (`TakePicture` + FileProvider temp URI) / gallery (`GetContent`); image query via `SendQuestionWithImage`; share/download rendered card to PNG (`shareImage`/`downloadImage` to MediaStore).
  - **History pagination:** one-time scroll-to-bottom on `isInitialHistoryLoaded`; load-more when scrolled up (`historyNextPage`), scroll-position restore after prepend.
- **Lifecycle:** Plotline CHAT + surface holder; screen view/exit; `LifecycleEventObserver` ON_STOP pauses all audio; onDispose releases players + `ClearMessages`.
- **UDF** (`chat/udf/`):
  - **ChatAction**: `InitializeWithPreGeneratedContent(question, answer?, followUpQuestions?, isFromCampaign, isPush, isInApp, homeStatementId?, userMessageImageUri?)`, `InitializeVoicePrototype(audioUri, originScreenName)`, `InitializeWithQuestion(question, transcriptionId?, audioUri?, originScreenName, isWeatherAdviceCTA, isPush, isInApp, isSSFR, ssfrCrop?, channel?)`, `ReplacePreGeneratedWithQuestion(question, triggerInputType?)`, `SendFollowUpQuestion(question, followUpQuestionId?, transcriptionId?, audioUri?, sendQueryProperties?)`, `SendQuestionWithImage(question, imageUri, sendQueryProperties?)`, `SendFollowUpVoiceQuestion(audioUri)`, `SendQuestionWithAudio(question, audioUri)`, `LoadChatHistory(conversationId, page=1)`, `RetryLastRequest`, `ClearError`, `ClearMessages`, `SynthesiseAudio`, `ClearAudioPlaybackUrl`, `SetAudioPlaying(isPlaying)`.
  - **ChatState**: `messages: List<ChatMessage>`, `suggestedQuestions?`, `suggestedQuestionIds?`, `clarificationRequired`, `chatResponseState: UiState<String>`, `errorMessage?`, `failedMessageId?`, `isLoading`, `isLoadingSynthesiseAudio`, `audioPlaybackUrl?`, `isAudioPlaying`, `historyNextPage?`, `isInitialHistoryLoaded`, `readFullAdviceRequestedForMessageId?`, `isTtsEnabled`.
  - **ChatMessage**: `UserMessage(text, imageUri?, audioUri?, userBubbleImageWideBanner, isFailed, id)`, `AiResponse(text, followUpQuestions?, id, isPreGenerated, messageId?)`, `LoadingPlaceholder(id)`.
  - **ChatEntrySource**: `Home`, `History`.

### 3.9 ChatHistory — `ui/chat/history/ChatHistoryScreen.kt`
- **VM:** `ChatHistoryViewModel` (shared instance from graph).
- **UI:** `DefaultAppBar` (Menu → openDrawer, "Recent Chats"); grouped `LazyColumn` (`ListCard`/`ListItem`, icon by `message_type`), section headers from API `grouping`.
- **State:** `ChatHistoryUiState`: `items`, `isLoading`, `errorMessage`, `isNetworkError`, `canLoadMore`, `query`.
- **Loading/error/empty:** center `LogoSpinner` when loading + empty; inline retry `PrimaryButton` for pagination errors; initial-load failure → `onNavigateToError(isNetworkError)`; "Loading more…" footer spinner.
- **Actions → VM:** `refresh`, `loadNextPage`, `filteredItems`; item click → `onOpenChatFromHistory(conversationId)` + `New_Chat_Click_Event`.
- **Lifecycle:** Plotline CHAT_HISTORY; `refresh` on entry; pagination via `snapshotFlow` on scroll near bottom.

### 3.10 Settings — `ui/settings/SettingsScreen.kt`
- **UI:** `DefaultAppBar` (Menu, "Settings"). Appearance selector (`AppearanceModeButton` Day/Night/Auto with icons). Account details `ListCard` → "Your name" row (→ `onNameClick`). `SecondaryButton` Logout (if authenticated) / Sign up. `Toast` "Your name has been updated."
- **State:** `appearanceMode`, `isAuthenticated`, `userName`, `showNameUpdatedToast` (graph-level). Graph fetches profile via `UserProfileViewModel` on entry.
- **Actions:** `onAppearanceModeChange` (tracks `Settings_Option_Selected`, THEME attr), `onNameClick`→SettingsName, `onSignUpClick`→`handleSignUpClick`, `onLogOutClick` (full logout in graph).
- **Lifecycle:** Plotline SETTINGS; toast delayed 500 ms after page transition.

### 3.11 SettingsName — `ui/settings/SettingsNameScreen.kt`
- **VM:** `EnterNameViewModel`.
- **UI:** `DefaultAppBar` (Back, "Name"); `TextInput` (normalized) + `PrimaryButton` "Save name" (Loading/Default). Min-3/max-100 validation + error toast.
- **Actions:** `UserNameAction.UpdateUserName(UserNameRequest(user_id, name))` with `screenName=SETTINGS`; on Success saves `USER_NAME`, `ConsumeUpdateResult`, `onSaveComplete()`.
- **Lifecycle:** Plotline SETTINGS_NAME; one-shot on API success.

### 3.12 Help — `ui/settings/HelpScreen.kt`
- **UI:** `DefaultAppBar` (Menu, "Help"); "How to use FarmerChat" FAQ `ListCard` (skeleton rows via `Crossfade`, empty state, FAQ items → `onOpenUrl("faq", url)`), "More" section (Terms of use / Privacy policy), footer version + "© Digital Green".
- **Data:** `GetHelpSupportUseCase.getHelpSupport(lang, limit=5, theme, country)`; on Error → `result.handleError(errorNavigationManager, fromScreen="help", retry)`.
- **Lifecycle:** Plotline HELP; screen view; reload on `reloadToken`.

### 3.13 LanguageChooser (Settings→Language) — `ui/settings/LanguageChooserScreen.kt`
- **VM:** `SettingsViewModel` (state `LanguageSettingsState`).
- **UI:** `DefaultAppBar` (Menu, "Choose your language"); `RadioButton` list (priority + "All languages" expand), per-row label-fetch loading; bottom `PrimaryButton` "Save language"/"Setting language".
- **Actions → VM:** `loadLanguages`, `selectLanguage(id, code)`, `submitLanguage`, `consumeLanguageResult`. On success (+labels loaded) → toast, track preferred language attr, `onLanguageSaved()`. `languageState` Error → `onFetchLabelsFailure()`.
- **Lifecycle:** Plotline LANGUAGE_CHOOSER; loadLanguages on entry.

### 3.14 NoInternet / Error — `ui/error/NoInternetScreen.kt`
Defines `FullScreenMessage` (shared green full-screen composable: app bar with yellow glow, illustration, main/subtitle text, forced-light-mode primary button, optional secondary CTA, optional debounce). `ErrorScreen(errorType)` picks NO_INTERNET vs API_ERROR copy + `LOOKING_AT_SKY` illustration, `enablePrimaryDebounce`. `NoInternetScreen` = legacy wrapper. Plotline ERROR / FULL_SCREEN_MESSAGE tracked.

### 3.15 Location prompt (GPS) — `ui/location/LocationPromptHost.kt` (1538 lines)
Global non-blocking host rendered in MainActivity, driven by `LocationPromptManager.state` (`LocationPromptState`): `Idle`, `Interstitial`, `RequestPermission`, `RequestEnableGps`, `FetchingLocation`, `Recovery`, `Error`.
- **UI:** `Interstitial` → `FullScreenMessage` "Share Location" (`LOOKING_AT_PHONE`, Share/Skip/Back). During permission/GPS/fetch: Weather flow keeps interstitial overlay (loading CTA); Widget flow shows nothing. `Recovery` → `ModalBottomSheet` "We need your location" → "Turn on in settings". `Error` → `FullScreenMessage` per `LocationErrorType` (NoNetwork/GpsUnavailable/LocationFailed).
- **Behavior:** permission launcher + GPS settings resolution (`ResolvableApiException` → `StartIntentSenderForResult`); fresh location fetch (10 s, 1 retry) → last-known fallback (2 s); logged-in user calls `updateUserLocationUseCase.updateUserLocation` (saves country/state/district + GPS_* attrs, `GPS_LOCATION_SHARED=true`), guest saves locally only. Emits `LocationUpdatedFromWidget` for campaign source. Extensive GPS analytics + `gps_flow_step` Firebase events. `ON_RESUME` re-checks permission when in Recovery.
- **Trigger decision tree (`LocationPromptManager.trigger`, fc-compose-agentic):** offline → `Error(NoNetwork)`; Weather with a stored fix → navigate directly (no flow); `deny_count >= 2` and no FINE permission → `Recovery` (every source); FINE granted + stored fix → `RequestEnableGps`; Weather + granted + no fix → `Interstitial`; Campaign + granted + no fix → `RequestEnableGps`; LocalContext (Home pill, chat gps-prompt chip) / Settings / Campaign / already granted → `RequestPermission` (no interstitial); otherwise → `Interstitial`. Only the Weather entry ever shows the interstitial.
- **Permission:** requests and checks `ACCESS_FINE_LOCATION` only ("Approximate" counts as a deny). A deny increments `deny_count`; the 2nd deny → `Recovery`, otherwise `Idle` + `Continue("permission_denied")`. Grant resets `deny_count`.
- **Exits:** interstitial Back → `cancel()` (Cancel, drops pending nav); Skip / Recovery close or swipe → `continueWithoutLocation(reason)`; `dismiss()` emits `Continue("dismissed")` and RUNS the pending navigation. Recovery + permission granted on resume → Campaign continues to GPS, every other source back to `Interstitial`.
- **GPS:** `SettingsClient` with `setAlwaysShow(true)`; result re-reads the providers. Declined → Weather continues without location (`gps_disabled_no_thanks`); others → `Error(GpsUnavailable, canRetry = false)` whose CTA closes the flow. Error screens have no Back/Skip.
- **Fetch failure:** after the retry and the last-known fallback the flow ends quietly with `Continue("location_failed_fallback")` — no error screen. A fix is saved to prefs only after `update_user_location` succeeds (guest: saved immediately); `APPROX_LOCATION_NAME` = `geography_level3` → `geography_level2_name` → `country_name`. API error on LocalContext/Settings/Campaign → `dismiss()`. Weather navigates as soon as the fix is in.

### 3.16 Profile — `ui/profile/`
No composable screen; **`UserProfileViewModel`** only (`fetchProfile(context, fromScreen)` via `GetUserProfileUseCase`; clears/saves `USER_NAME`; `handleError` routes to error screen). Used by Settings, EnterName. Data models: `UserProfile`, `Address`, `Crop`, `LiveStockDetail`, `Memory`, `Role`, `farmland/FarmlandDetails`.

### 3.17 LegalContent (dialog) — `AppNavGraph.kt` + `PolicyWebViewScreen.kt.kt`
`dialog<Destination.LegalContent>` (full-width, dismissOnBackPress). Renders `PolicyWebViewScreen` (WebView with JS, Close app bar, loading spinner, `faq_terms` toggles title to "FAQ"). onDispose re-tracks the parent Plotline page.

---

## 4. Shared drawer (`components/drawer/`)
Wraps Home/Chat/Settings/Help/SettingsLanguage/ChatHistory. Params: `currentRoute`, `onNavigate(route)`, `isAuthenticated`, `onSeeAllClick`, `onSignUpClick`, `currentLanguage`, `currentQuestion`, `previousQuestions: List<DrawerQuestion>` (recent 8 from `chatHistoryVM`, typed Camera/Mic/Keyboard/Card), `historyErrorMessage`, `onRetryHistory`, `onDrawerOpened` (`refreshSilently`), `isLoadingHistory`. Provides `openDrawer` lambda to content.

---

## 5. Reusable components (`components/`)
- appbars: `DefaultAppBar`, `HomeAppBar`, `LogoAppBar`, `ChatAppBar`
- buttons: `PrimaryButton` (`PrimaryButtonState` Default/Chevron/Loading), `SecondaryButton`, `ActionButton`, `ListenButton`, `ScrollToBottomButton`, `WeatherButton`
- cards: `ContentCard`, `SingleSelectCard`, `MultiSelectCard`, `SsfrCard`, `SuggestedCard`
- chat: `UserChatBubble`
- dialogs: `PermissionSettingsDialog`
- form: `TextInput`, `RadioButton`, `Checkbox`, `OtpInput`, `SearchInput`, `CountryCodeSelector`
- list: `ListCard`, `ListItem`
- userinput: `PrimaryInputButtons`, `TextInput`, `VoiceInput`, `PhotoInput`, `PhotoThumbnail`, `VoiceClip`, `FakeVoiceRecorder`, `InputActionButton`
- misc: `Toast`/`rememberToastState`, `LogoSpinner`(+Vertical/Horizontal), `FeedHeader`/`FeedFooter`, `HomeFeedErrorUI`, `MarkdownText`, `SvgImage`, `Glow`, `ScrollIndicator`, `AttentionWobble`, `PressScale`, `Tip`/`Tips`, `PlaySoundEffect`
- chat composition: `ChatThreadContent`, `ChatLoadingContent`, `ChatErrorContent`, `ChatInputOverlays`, `ChatResponseActions`, `InlineErrorContent`, `ShareCard`

---

## 6. Completeness notes
- The Chat destination is the only parameterized non-dialog route; all campaign/deep-link entry funnels into it (`source` = home/history/plotline/moengage/deeplink).
- Auth is the only true "signed up" gate (`OTP_VERIFIED`); entering a name does not authenticate.
- Error handling is centralized through `ErrorNavigationManager` + `Destination.Error(fromScreen)`, with per-`fromScreen` retry semantics.
- GPS/location is a global overlay (`LocationPromptHost`) rather than a route; weather and campaign CTAs trigger it via `LocationPromptManager`.
