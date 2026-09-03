# Customization API + Distribution (cross-platform contract)

This is the single source of truth for (1) how host apps import the SDK by coordinate/package, and (2) how they restyle it to match their own app theme. Every platform implements the SAME conceptual surface with idiomatic types.

## Part A — Distribution (import-by-coordinate, must be PROVEN not just configured)

| Platform | Coordinate / package | Local proof (this repo) | Real registry |
|---|---|---|---|
| Android | `org.digitalgreen.farmerchat:farmerchat-android-compose:<v>` (+ `-views`, `-core`) | `./gradlew publishToMavenLocal` → a consumer module that uses `mavenLocal()` + `implementation("org.digitalgreen.farmerchat:...:<v>")` and BUILDS | Maven Central (Sonatype + GPG signing) |
| iOS | SPM package (git URL + tag) or binary `XCFramework`; CocoaPods `FarmerChatUIKit.podspec` | build an `.xcframework` per package via a script; a consumer that references the built framework / local package URL and BUILDS | SPM git tag + Cocoapods trunk |
| React Native | `@digitalgreenorg/farmerchat-react-native` | `npm pack` → install the resulting `.tgz` into a fresh example that BUILDS/type-checks | npm publish |
| Web | `@digitalgreenorg/farmerchat-web` | `npm pack` → install `.tgz` into a fresh Vite example that BUILDS | npm publish |

Rule: "verified" for distribution means the artifact was consumed **as a package/coordinate**, not via `project(...)`/local path. Version comes from ONE source (`FarmerChatVersion`), currently `1.0.0`.

### API-surface hardening (so the published artifact has a clean, safe public API)
- Kotlin: enable `explicitApiWarning()` where feasible; make internal plumbing `internal` (e.g. `FarmerChat.requireGraph()` must NOT be public — move behind `@InternalFarmerChatApi` or `internal`). Set `android { resourcePrefix = "fc_" }`.
- Dependencies: do NOT leak `api(...)` transitive deps the host shouldn't see. Retrofit/OkHttp/Gson → `implementation`. If a public return type exposes a third-party type, wrap it. Document the (small, conservative) transitive footprint.
- iOS: mark internal types non-`public`; only the documented surface is `public`.
- TS: `exports` map + `types`; only intended symbols exported from the package root.

## Part B — Theming / customization contract

Everything below is OPTIONAL. Omitted values fall back to the built-in FarmerChat green brand. A host supplies a theme at init.

### FarmerChatTheme

**Colors** (each optional; provide a light set and optionally a dark set — if only one set is given it is used for both, with automatic on-color contrast):
- `brandPrimary`   — app bars, primary brand surfaces (default `#008236` Green700)
- `brandPrimaryDark` — primary buttons, input tiles (default `#08361B` Green800)
- `brandAccent`    — chevrons, active radio dot, spinner (default `#00C950` Green500)
- `onBrand`        — content/text on brand surfaces (default white)
- `background`     — screen background (default light zinc / near-white)
- `readingSurface` — chat reading background (default near-white)
- `cardSurface`    — card/list background (default white)
- `error`          — error accents (default app error red)
- `onBackground` / `onSurface` — text colors (default zinc-900/zinc-100)

**Shape**:
- `cardCornerRadius` (default 24)
- `buttonCornerRadius` (default 12)
- `inputCornerRadius` (default 12)

**Typography**:
- `fontFamily` — host font (Android: font resource / family name; iOS: font name; RN/Web: family string). Default: platform default.
- `typeScale` — multiplier on all text sizes (default 1.0)

**Branding**:
- `logo` — optional override of the 6-petal mark (Android: `@DrawableRes`; iOS: `Image`/asset name; RN: require()/uri; Web: URL/ReactNode). Default: built-in mark.

### Per-platform init shape

```kotlin
// Android
FarmerChatConfig.builder(FarmerChatEnvironment.PROD)
  .theme(
    FarmerChatTheme.builder()
      .brandPrimary(0xFF1565C0.toInt())         // host blue instead of green
      .brandAccent(0xFF42A5F5.toInt())
      .cardCornerRadius(16)
      .fontFamily(R.font.host_sans)
      .logo(R.drawable.host_logo)
      .build()
  )
  .build()
```
```swift
// iOS
FarmerChatConfig(
  environment: .prod,
  theme: FarmerChatTheme(
    brandPrimary: Color(hex: 0x1565C0),
    cardCornerRadius: 16,
    fontName: "HostSans",
    logo: Image("host_logo")
  )
)
```
```tsx
// React Native / Web (identical shape)
<FarmerChat config={{
  environment: 'prod',
  theme: {
    colors: { brandPrimary: '#1565C0', brandAccent: '#42A5F5' },
    shape:  { cardCornerRadius: 16 },
    typography: { fontFamily: 'HostSans' },
    logo: require('./host-logo.png'),   // web: '/host-logo.svg' | ReactNode
  },
}}/>
```

### Implementation rule
Each platform already centralizes tokens (Compose `theme/Color.kt`+`Shapes.kt`, iOS `FCTheme`, RN/web `theme.ts`). The theme override must feed THOSE tokens — one resolver that merges host overrides onto the defaults — so every ported screen picks up the host palette with zero per-screen changes. Appearance (day/night/auto) still applies on top; a host that supplies only light colors gets sensible dark derivations.

## Part C — Feature scope (confirmed; same shape every platform)

All additive and backward-compatible. Defaults keep today's behavior (full journey, SDK-owned OTP, all screens, no host callbacks).

### C1. Inline embeddable view (not only full-screen launch)
Expose the journey/chat as a host-placeable component, in addition to `launch()`:
- Android Compose: `@Composable FarmerChatInline(modifier)` (wraps `FarmerChatRoot`); Views: `FarmerChatFragment` (embeddable) + document adding it to any container.
- iOS SwiftUI: `FarmerChatInlineView()`; UIKit: `FarmerChatViewController` usable as a child VC.
- RN: `<FarmerChatInlineView style={...}/>` (fills its container, not the screen).
- Web: `<FarmerChat inline/>` already fills its container — document + ensure no full-viewport assumptions.

### C2. Host identity injection (`authMode`)
`FarmerChatConfig.authMode = SDK_OTP` (default) | `HOST_TOKEN`.
- `HOST_TOKEN`: host supplies `accessToken` (+ optional `refreshToken`) or a `tokenProvider` callback; SDK skips the phone/OTP UI, treats the user as authenticated, and calls `tokenProvider`/`onSessionExpired` on 401 instead of forcing OTP. `SDK_OTP` = today's behavior.

### C3. Screen/feature toggles
- `mode = FULL_JOURNEY` (default) | `CHAT_ONLY` (skip onboarding/home; land in chat).
- `showSettings`, `showHistory`, `showDrawer`, `enableWeather`, `enableSsfr` (bool; default true). Existing `enableVoice/Images` stay.

### C4. Event hooks + programmatic API
Config callbacks (all optional): `onChatOpened()`, `onMessageSent(text)`, `onAnswerReceived(messageId)`, `onScreenView(name)`, `onError(code, message)`, `onSessionStart()`, `onExit()`. These are semantic, in addition to the raw `onEvent(name, props)` analytics fan-out. `onExit()` fires when the user closes the SDK from a surface with nowhere to go back to (e.g. CHAT_ONLY chat close) so a component-embedding host (React Native `<FarmerChatView>`, web) can unmount/hide the SDK; on Android/iOS the SDK finishes/dismisses its own Activity/VC, so wiring `onExit` there is optional.
Programmatic methods on the entry singleton/object: `sendQuestion(text)`, `openConversation(id)` (openChat already covers deep-link), `openScreen(destination)`.

### C5. Host string overrides + forced locale
- `config.stringOverrides: Map<labelKey, String>` — highest precedence, wins over server labels and English fallback. Resolution order becomes: host override → server `${key}_${lang}` → server `${key}_en` → built-in English → raw key.
- `config.locale: String?` — force a language code regardless of device/onboarding.

## Part D — Third-party SDKs: the host owns them (Firebase / MoEngage / Plotline / Adjust)

### Why the SDK embeds none of them

The production app fans every analytics event out to four vendor SDKs at once
(`core/analytics/AnalyticsManager.kt:23-26`) and reads feature flags from Firebase Remote Config
(`core/firebase/OnboardingRemoteConfig.kt`). **None of that ships inside the SDK packages**, by
rule (root `CLAUDE.md` §6). Three concrete reasons, so the next reader does not "fix" it:

1. **Version collision.** A host app almost always already has Firebase. Two `firebase-bom`
   versions, or a library-imposed one, is a dependency conflict the host cannot resolve without
   forking us.
2. **`google-services.json` becomes mandatory.** The Firebase Gradle plugin fails the build when
   the file is missing, and the file is *per-project* — bundling Firebase would force every host
   to adopt Digital Green's Firebase project or wire a second one. The app's own
   `core/firebase/FirebaseConfigGuard.kt` exists precisely because a blank API key in that file
   used to crash it — and the app ships with `firebase_performance_collection_enabled=false` in the
   manifest (`AndroidManifest.xml:141-143`), flipped on in code only after that guard passes.
3. **Vendor keys are ours, not the host's.** `MOENGAGE_APP_ID`, `ADJUST_APP_TOKEN` and the
   Plotline API keys are hardcoded Digital Green account credentials in the app
   (`core/constants/RemoteConfigKeys.kt:36-46` — note they are *constants*, not Remote Config
   values, despite the filename). Shipping them in a distributed SDK would post every host's
   traffic into our analytics accounts.

So the boundary is: **the SDK raises events; the host forwards them.** Nothing is lost — the SDK
emits the same event names and property keys the app tracks. Forwarding is a few lines.

### Forwarding SDK events to your own Firebase / Crashlytics / MoEngage

`config.onEvent(name, props)` fires for every analytics event, on the caller's thread, wrapped in
`runCatching` by the SDK — a throw in your handler can never break a user flow.

**Android** (the host already has Firebase + MoEngage on its own classpath):

```kotlin
import android.os.Bundle
import com.google.firebase.analytics.ktx.analytics
import com.google.firebase.crashlytics.ktx.crashlytics
import com.google.firebase.ktx.Firebase
import com.moengage.core.Properties
import com.moengage.core.analytics.MoEAnalyticsHelper
import org.digitalgreen.farmerchat.sdk.FarmerChatConfig
import org.digitalgreen.farmerchat.sdk.FarmerChatEnvironment

val config = FarmerChatConfig.builder(FarmerChatEnvironment.PROD)
    .geoApiKey(BuildConfig.GEO_API_KEY)
    .onEvent { name, props ->
        // --- Firebase Analytics -------------------------------------------------
        val bundle = Bundle()
        props.forEach { (k, v) ->
            when (v) {
                is String -> bundle.putString(k, v)
                is Int -> bundle.putInt(k, v)
                is Long -> bundle.putLong(k, v)
                is Boolean -> bundle.putBoolean(k, v)
                is Double -> bundle.putDouble(k, v)
                null -> Unit
                else -> bundle.putString(k, v.toString())
            }
        }
        Firebase.analytics.logEvent(name, bundle)

        // --- Crashlytics breadcrumb (so a crash shows the last SDK screens) -----
        Firebase.crashlytics.log("fc:$name ${props["screen_name"] ?: ""}")

        // --- MoEngage -----------------------------------------------------------
        val moe = Properties()
        props.forEach { (k, v) ->
            when (v) {
                is String -> moe.addAttribute(k, v)
                is Int -> moe.addAttribute(k, v)
                is Boolean -> moe.addAttribute(k, v)
                is Double -> moe.addAttribute(k, v)
                null -> Unit
                else -> moe.addAttribute(k, v.toString())
            }
        }
        MoEAnalyticsHelper.trackEvent(applicationContext, name, moe)
    }
    .onError { code, message ->
        Firebase.crashlytics.recordException(IllegalStateException("FarmerChat $code: $message"))
    }
    .build()
```

The `Bundle`/`Properties` type switches above are the app's own conversions verbatim
(`AnalyticsManager.kt:31-41` and `:46-55`) — copy them rather than reinventing the coercions.

**iOS**:

```swift
import FirebaseAnalytics
import FirebaseCrashlytics
import FarmerChatCore

let config = FarmerChatConfig(
    environment: .prod,
    onEvent: { name, props in
        Analytics.logEvent(name, parameters: props.compactMapValues { $0 as? NSObject })
        Crashlytics.crashlytics().log("fc:\(name)")
    }
)
```

**React Native** (`@react-native-firebase/analytics`):

```ts
import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';
import type { FarmerChatConfig } from '@digitalgreenorg/farmerchat-react-native';

export const config: FarmerChatConfig = {
  environment: 'prod',
  onEvent: (name, props) => {
    void analytics().logEvent(name, props as Record<string, string | number | boolean>);
    crashlytics().log(`fc:${name}`);
  },
};
```

**Web** (`firebase/analytics`):

```ts
import { getAnalytics, logEvent } from 'firebase/analytics';
import type { FarmerChatConfig } from '@digitalgreenorg/farmerchat-web';

const fa = getAnalytics();
export const config: FarmerChatConfig = {
  environment: 'prod',
  onEvent: (name, props) => logEvent(fa, name, props),
};
```

### Two things `onEvent(name, props)` structurally cannot carry

Both are limits of the listener contract, not bugs in a call site. Recorded in
`docs/04-parity-matrix.md`.

**1. Per-sink routing.** The app deliberately sends `Screen_Viewed` / `Screen_Exited` to Firebase,
Adjust and Plotline but **not** to MoEngage (`AnalyticsManager.kt:96-137`, comments say so
explicitly). Every other event goes to all four. A flat `onEvent` cannot express that, so a host
that wants app-identical routing must filter on its own side:

```kotlin
// App-identical routing: MoEngage skips the two screen-lifecycle events.
private val MOENGAGE_EXCLUDED = setOf("Screen_Viewed", "Screen_Exited")

.onEvent { name, props ->
    Firebase.analytics.logEvent(name, props.toBundle())        // all events
    if (name !in MOENGAGE_EXCLUDED) {
        MoEAnalyticsHelper.trackEvent(applicationContext, name, props.toMoEProperties())
    }
}
```

**2. Adjust event tokens.** The app carries an `adjustToken` on every event
(`AnalyticsEvent.adjustToken` → `AnalyticsManager.trackAdjust`, `:73-85`) and Adjust rejects an
event without one. The SDK's `onEvent` hands you the *name*, not a token — deliberately: the 81
tokens in the app's `core/analytics/AdjustEventTokens.kt` are opaque 6-character ids issued by
**Digital Green's** Adjust app, and they are meaningless in a host's own Adjust account. A host
forwarding to its own Adjust supplies its own map:

```kotlin
// Your own Adjust dashboard's tokens, keyed by the SDK event name.
private val ADJUST_TOKENS = mapOf(
    "Screen_Viewed" to "abc123",
    "Send_Query" to "def456",
    // ... one row per event you care about; unmapped events are simply not sent to Adjust.
)

.onEvent { name, props ->
    ADJUST_TOKENS[name]?.let { token ->
        val e = AdjustEvent(token)
        props.forEach { (k, v) -> v?.let { e.addPartnerParameter(k, it.toString()) } }
        Adjust.trackEvent(e)
    }
}
```

If you need Digital Green's own token values (i.e. you are reporting into our Adjust app), take
them from `core/analytics/AdjustEventTokens.kt` in the app repo — they are not duplicated here,
because a copy would silently rot.

### Not yet forwardable: user identity and user attributes

The app also sets user *identity* and *attributes* on all four vendors —
`AnalyticsUserIdentityManager.identifyUser()` (MoEngage `identifyUser`, Firebase `setUserId`,
Plotline `init`/`initAnonymousUser`, Adjust global params) and `UserAttributeTracker.track()`
(MoEngage `setUserAttribute`, Firebase `setUserProperty`, Plotline `identify`, Adjust global
partner param), over the 54 keys in `core/analytics/UserAttributeKeys.kt`.

`onEvent(name, props)` cannot express either: identity is not an event, and a user property is not
an event property. **There is no `onUserIdentified` / `onUserAttribute` callback in
`FarmerChatConfig` today.** Until there is, a host that needs Firebase `setUserId` must set it
itself from its own login state; SDK-derived attributes (resolved country/state/district, preferred
language, carrier, `Mobile_No_Verified`, …) are not reachable. Tracked in `docs/04-parity-matrix.md`.

### Supplying your own Remote Config values

The app reads five boolean flags from Firebase Remote Config. The SDK carries no Remote Config
client — it takes the *resolved values* from the host at `initialize()`, so a host that already
fetches Remote Config (or LaunchDarkly, or its own backend) just passes them in.

| App Remote Config key | SDK knob | SDK default |
|---|---|---|
| `v2_show_name_screen_onboarding` | `showNameScreen` | `true` |
| `v2_agentic_chat_enabled` | `enableAgenticChat` | `false` |
| `v2_composer_ui_enabled` | `enableComposerUi` | `null` → follows `enableAgenticChat` |
| `v2_wobble_animation_enabled` | *none* — the SDK has no home-card attention animation | n/a |
| `v2_stop_animation_on_first_card_click` | *none* — same reason | n/a |

```kotlin
// Host already owns Firebase Remote Config; hand the SDK the resolved values.
val rc = FirebaseRemoteConfig.getInstance()
rc.fetchAndActivate().addOnCompleteListener {
    FarmerChat.initialize(
        context = this,
        config = FarmerChatConfig.builder(FarmerChatEnvironment.PROD)
            .geoApiKey(BuildConfig.GEO_API_KEY)
            .showNameScreen(rc.getBoolean("v2_show_name_screen_onboarding"))
            .enableAgenticChat(rc.getBoolean("v2_agentic_chat_enabled"))
            .enableComposerUi(rc.getBoolean("v2_composer_ui_enabled"))
            .build()
    )
}
```

`enableComposerUi` is nullable on purpose. Omit it and the SDK keeps the historical collapse
(`composer == enableAgenticChat`), so an existing host sees no change; set it and the two decouple,
which is how the app documents them (`RemoteConfigKeys.kt:22-27`: the composer flag "only controls
the composer UI, not which API the query is routed to").

**One divergence to know about.** In the app today, `getAgenticChatEnabled()` and
`getComposerUiEnabled()` are hardcoded `= true` with the Remote Config read commented out
(`OnboardingRemoteConfig.kt:72-73`, `:81-82`) — the app ships agentic chat and the composer
unconditionally on. The SDK defaults both to **off**, because root `CLAUDE.md` §3 freezes the
synchronous #27 chat contract for a host that opts into nothing. That is deliberate; do not
"align" the default without changing §3.

Config is immutable after `initialize()`, so there is no SDK analogue of the app's post-fetch
re-read (`OnboardingRemoteConfig.refresh()` on the Language screen and on every Home feed state
change). A host needing a live flip re-initializes.

### Optional platform SDKs — absence must never crash (verified)

`android/CLAUDE.md` requires SMS Retriever and the WhatsApp OTP SDK to stay optional. Verified
against the code:

| Integration | How the SDK depends on it | Guard |
|---|---|---|
| SMS Retriever (`play-services-auth-api-phone`) | hard `implementation` in both UI modules, so it reaches the host transitively via the POM | every call inside `runCatching`, receiver nulled on failure — `AuthScreen.kt:129-166`, `AuthFragment.kt:240-273` |
| Fused location + Location Settings (`play-services-location`) | hard `implementation` in both UI modules | `runCatching` with an explicit "Play Services absent — proceed as if GPS is enabled" fallback — `views/.../LocationPromptHost.kt:282-305`, `compose/.../LocationPromptHost.kt:110-130` |
| WhatsApp OTP SDK | **no dependency at all** (the app reaches it by `Class.forName` in `utils/whatsapp/WhatsAppOtpSdk.kt`) | not integrated in the SDK; endpoint #19 OTP-less verification is present, the vendor SDK handoff is not |

Because both Play Services artifacts are hard `implementation` deps, their classes are normally
present; absence only arises if a host `exclude`s them. The `runCatching` guards make that case
degrade (no OTP autofill, GPS treated as already enabled) rather than crash.

## Verification bar for this workstream
1. A coordinate/package-consuming sample builds on every platform (not `project(...)`/local path).
2. A themed sample (host palette, e.g. blue) renders the Language + Home screens in the host colors — screenshot-verified on emulator/simulator where one is available.
3. `docs/04-parity-matrix.md` gets a "Distribution (import-by-coordinate)" row and a "Host theming" row, filled honestly.
