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
Config callbacks (all optional): `onChatOpened()`, `onMessageSent(text)`, `onAnswerReceived(messageId)`, `onScreenView(name)`, `onError(code, message)`, `onSessionStart()`. These are semantic, in addition to the raw `onEvent(name, props)` analytics fan-out.
Programmatic methods on the entry singleton/object: `sendQuestion(text)`, `openConversation(id)` (openChat already covers deep-link), `openScreen(destination)`.

### C5. Host string overrides + forced locale
- `config.stringOverrides: Map<labelKey, String>` — highest precedence, wins over server labels and English fallback. Resolution order becomes: host override → server `${key}_${lang}` → server `${key}_en` → built-in English → raw key.
- `config.locale: String?` — force a language code regardless of device/onboarding.

## Verification bar for this workstream
1. A coordinate/package-consuming sample builds on every platform (not `project(...)`/local path).
2. A themed sample (host palette, e.g. blue) renders the Language + Home screens in the host colors — screenshot-verified on emulator/simulator where one is available.
3. `docs/04-parity-matrix.md` gets a "Distribution (import-by-coordinate)" row and a "Host theming" row, filled honestly.
