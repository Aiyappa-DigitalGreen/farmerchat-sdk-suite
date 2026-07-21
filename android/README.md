# FarmerChat Android SDK

Embeds the complete FarmerChat journey — splash → language onboarding → name → home feed → AI chat (text / voice / image) → history / settings / help, with phone + OTP sign-up — into any Android app. Direct port of the production `fc-compose` app, re-packaged per `docs/03-sdk-architecture.md`.

## Modules

| Artifact | Coordinates | What it is |
|---|---|---|
| `farmerchat-core` | `org.digitalgreen.farmerchat:farmerchat-core` | Headless core: Retrofit client for all 34 endpoints + token APIs + Google geolocate, interceptor chain (X-Request-ID → X-Timeout → per-request timeout clone → auth headers → logging) with `TokenAuthenticator` (refresh → guest-token fallback, single-flight), `ApiResult`/`UiState`/retry table, all domain models, repositories, use cases, `SdkPreferences` (`fc_sdk_` namespaced), `LabelManager`, `SessionManager`, analytics dispatcher, and every screen's state machine (plain Kotlin over `StateFlow`). No UI dependencies. |
| `farmerchat-android-compose` | `org.digitalgreen.farmerchat:farmerchat-android-compose` | Full Jetpack Compose UI: `FarmerChatActivity` + embeddable `FarmerChatRoot()` / `FarmerChatInline(modifier)` composables + `FarmerChatFab`, Navigation-Compose graph matching the app 1:1. |
| `farmerchat-android-views` | `org.digitalgreen.farmerchat:farmerchat-android-views` | The same flow in XML + Fragments + Navigation Component + ViewBinding: `FarmerChatActivity` (views variant) + embeddable `FarmerChatFragment` + `FarmerChatFab`. |

Pick **one** UI artifact — each pulls in `farmerchat-core` transitively. `FarmerChat.launch()` auto-resolves whichever UI artifact is on the classpath (Compose is preferred if both are present).

Requirements: minSdk 26, compileSdk 36, Kotlin 2.x, AGP 8.x.

```kotlin
// settings.gradle.kts — repositories: mavenCentral() (or your internal repo / mavenLocal())

dependencies {
    implementation("org.digitalgreen.farmerchat:farmerchat-android-compose:1.0.0")
    // OR
    implementation("org.digitalgreen.farmerchat:farmerchat-android-views:1.0.0")
}
```

### Local distribution proof (this repo)

```bash
./gradlew publishToMavenLocal                 # publishes core + compose + views @ 1.0.0
./gradlew :sample-consumer:assembleDebug      # a host that consumes the SDK BY COORDINATE from mavenLocal()
```

`:sample-consumer` depends on `org.digitalgreen.farmerchat:farmerchat-android-compose:1.0.0` (not `project(...)`), proving import-by-coordinate. Version comes from ONE source: `farmerChatVersion` in the root `build.gradle.kts` (group `org.digitalgreen.farmerchat` on all subprojects), mirrored at runtime by `FarmerChatVersion.VERSION`.

### Public API surface & transitive footprint

The published API is deliberately small: `FarmerChat` (entry object), `FarmerChatConfig` (+ `FarmerChatTheme`, `FarmerChatEnvironment`, `FarmerChatAppearance`, `FarmerChatAuthMode`, `FarmerChatMode`, `FarmerChatHooks`, `FarmerChatAnalyticsListener`, `FarmerChatVersion`), plus the UI entry points (`FarmerChatActivity` / `FarmerChatRoot` / `FarmerChatInline` / `FarmerChatFab` / `FarmerChatFragment`). Internal plumbing (`FarmerChat.requireGraph()`, `FarmerChatGraph`) is gated behind the opt-in `@InternalFarmerChatApi` and is not callable by hosts. Core enables `-Xexplicit-api=warning`; both UI modules set `resourcePrefix = "fc_"`.

Transitive footprint hosts inherit (conservative):
- **core**: kotlinx-coroutines + androidx-core only on the compile classpath. **Retrofit / OkHttp / Gson are `implementation`-scoped** (runtime-only in the POM) — they are NOT exposed on the host's compile classpath, and no public return type leaks a third-party type.
- **compose**: Compose runtime/UI/material3, navigation-compose, lifecycle, coil, kotlinx-serialization, and optional `play-services-location` / `play-services-auth-api-phone` (runtime-guarded — absence never crashes).
- **views**: appcompat, material, fragment/navigation, recyclerview, webkit, coil, and the same optional play-services deps.

## Initialize (Application.onCreate)

```kotlin
FarmerChat.initialize(
    this,
    FarmerChatConfig.builder(FarmerChatEnvironment.PROD)   // DEV | STAGE | DEMO | PROD | EKS
        .geoApiKey("YOUR_GOOGLE_GEOLOCATION_KEY")          // optional: language auto-detect fallback
        .guestApiKey("YOUR_GUEST_API_KEY")                 // optional: overrides built-in guest key
        .appearance(FarmerChatAppearance.AUTO)             // DAY | NIGHT | AUTO
        .languageCode("sw")                                // optional preselect
        .enableVoice(true)
        .enableImages(true)
        .enableWeather(true)
        .debugLogging(BuildConfig.DEBUG)                   // OkHttp body logs; never in release
        .onEvent { name, props -> /* analytics fan-out */ }
        .onSessionExpired { /* token refresh + guest fallback both failed */ }
        .build()
)
```

## Launch

```kotlin
FarmerChat.launch(context)                                  // full journey from splash
FarmerChat.openChat(context, question = "…")                // deep-link style: ask immediately
FarmerChat.openChat(context, conversationId = "…")          // open an existing thread
FarmerChat.logout { success -> }                            // server logout + clears all fc_sdk_ state
FarmerChat.isAuthenticated                                  // true only after OTP verification
val unsubscribe = FarmerChat.onAuthStateChanged { authed -> … }
```

Embedding instead of launching an Activity:

- Compose: call `FarmerChatRoot()` inside your own hierarchy (theme + navigation self-contained).
- Views: add `FarmerChatFragment` to your FragmentManager.

## Config options

| Option | Default | Notes |
|---|---|---|
| `environment` | required | dev/stage/demo base `farmerchat.farmstack.co/mobile-app-*/`; prod `v2.api.farmer.chat`; eks `api.farmerchat.in` |
| `geoApiKey` | null | Google Geolocation (`geolocate`, P1: 5 s / 1 retry). Without it, language detection falls back to guest-init IP data. |
| `guestApiKey` | built-in | `API-Key` header for `initialize_user` / `send_tokens`. |
| `appearance` | AUTO | Day/Night/Auto; user can change it in Settings (persisted, survives logout). |
| `languageCode` | null | Preselects a language; the language screen is skipped only once labels are confirmed for it. |
| `enableVoice` / `enableImages` / `enableWeather` | true | Hide the corresponding inputs/CTAs. |
| `onEvent` | null | Receives every analytics event (same names/props as the production app). |
| `onSessionExpired` | null | Both refresh and guest-token fallback failed. |

## Analytics

No third-party analytics/marketing SDKs are bundled (no Firebase/MoEngage/Plotline/Adjust). Every event the production app tracks — `App_Opened`, `Screen_Viewed`/`Screen_Exited`, `Send_OTP_Click_Event`, `Submit_OTP`, `Registration_Completed`, `Login_Completed`, `Dashboard_Viewed`, `Card_Shown/Viewed/Clicked`, `Send_Query_Initiated`/`Send_Query`, `Transcription_Success/Failed`, `Started/Stopped_Playing_Response_Audio`, `Logout_Click_Event`, the GPS `location_*` family, and more — is emitted with identical names and property keys through:

```kotlin
FarmerChat.setAnalyticsListener { name, properties ->
    yourAnalytics.track(name, properties)
}
```

`FarmerChatConfig.onEvent` receives the same stream (both fire).

## Permissions

The SDK manifests declare `INTERNET`, `ACCESS_NETWORK_STATE`, `RECORD_AUDIO`, `ACCESS_COARSE/FINE_LOCATION`. Camera capture uses the system camera app via `FileProvider` (no CAMERA permission). Runtime prompts (mic, location) are requested in-flow with the app's deny-count + settings-dialog behavior. SMS Retriever and fused location come from optional Play Services; their absence never crashes — flows degrade to manual entry / error states.

## Storage

All persisted state lives in a dedicated `SharedPreferences` file with `fc_sdk_`-prefixed keys — the SDK never touches your app's preferences. `FarmerChat.logout()` clears everything except the appearance selection and the device id.

## ProGuard / R8

Consumer rules ship inside the artifacts (models kept for Gson, Retrofit annotations, entry activities). If you maintain a manual keep-file, mirror `farmerchat-core/consumer-rules.pro`:

```
-keep class org.digitalgreen.farmerchat.sdk.core.model.** { *; }
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
```

## Building this repo

```bash
cd android
./gradlew :farmerchat-core:compileDebugKotlin
./gradlew :farmerchat-android-compose:compileDebugKotlin
./gradlew :farmerchat-android-views:compileDebugKotlin
./gradlew :sample-compose:assembleDebug :sample-views:assembleDebug
./gradlew publishToMavenLocal      # com.digitalgreen:* 1.0.0
```

`sample-compose` / `sample-views` are minimal hosts: initialize + analytics-listener logging + launch/openChat/logout buttons.

## Verification status

See `docs/04-parity-matrix.md` for the honest per-feature ledger. Anything not covered by `compileDebugKotlin` (on-device flows, backend contract drift) is marked UNVERIFIED there.
