# FarmerChat iOS SDK

Full app-as-SDK: one entry point launches the complete FarmerChat journey —
splash → language → name → home feed → AI chat (text/voice/image) → history →
settings, with OTP auth reachable from the drawer/settings. Behavior is
specified by `docs/01-app-specification.md`, `docs/02-api-reference.md` and
`docs/03-sdk-architecture.md` at the repository root.

## Packages

| Package | Min iOS | What it is |
|---|---|---|
| `FarmerChatCore` | 15.0 | Headless core: URLSession async/await API client (all 34 endpoints + token endpoints + Google geolocate), Codable models, priority timeouts + retry/backoff, actor-based 401 refresh with guest fallback, Keychain token store, `fc_sdk_`-namespaced UserDefaults prefs, LabelManager (server-driven i18n), SessionManager, analytics dispatcher, audio record/playback services, and every UDF view model (Onboarding, EnterName, Auth, Home, Chat, ChatHistory, Settings, Help, UserProfile, LocationPrompt). No UI. |
| `FarmerChatSwiftUI` | 16.0 | Complete SwiftUI implementation: `FarmerChatView()` root with NavigationStack router (routeFromSplash tree, back-stack reset semantics, drawer side-overlay, centralized error route with per-source retry) and every screen from the spec. Also `FarmerChat.shared.present(from:)` to launch from UIKit via UIHostingController. |
| `FarmerChatUIKit` | 15.0 | `FarmerChatViewController` entry with genuinely UIKit-native screens (Auth, Home feed via UICollectionView compositional layout, Chat via UICollectionView bubble cells, ChatHistory, Settings, Language, Help, onboarding, full-screen errors) for iOS 15 hosts. Ships `FarmerChatUIKit.podspec`. |

> Packaging note: SPM does not allow an iOS 15 package to depend on an iOS 16
> package, so `FarmerChatUIKit` does not link `FarmerChatSwiftUI`. iOS 16+
> hosts that prefer the SwiftUI experience should depend on
> `FarmerChatSwiftUI` and call `FarmerChat.shared.present(from: viewController)`
> — that is the "host the SwiftUI flow in a UIHostingController" path.
> `FarmerChatUIKit` stays fully native so iOS 15 devices get the same journey.

## Install

### Swift Package Manager

```swift
// Package.swift or Xcode → Add Package Dependencies (local or git)
.package(path: "ios/FarmerChatCore"),
.package(path: "ios/FarmerChatSwiftUI"),   // iOS 16+ SwiftUI UI
.package(path: "ios/FarmerChatUIKit"),     // iOS 15+ UIKit UI
```

### CocoaPods

```ruby
pod 'FarmerChatUIKit', :path => 'ios/FarmerChatUIKit'
# The pod bundles the FarmerChatCore sources; no separate Core pod needed.
```

### Binary distribution (XCFramework)

For consumers who want prebuilt binaries instead of building from source:

```bash
cd ios
./build-xcframework.sh          # all three packages (or: ./build-xcframework.sh Core)
# → dist/FarmerChatCore.xcframework, FarmerChatSwiftUI.xcframework, FarmerChatUIKit.xcframework
#   each with iphoneos (ios-arm64) + iphonesimulator (arm64/x86_64) slices.
```

Consume the built frameworks either by adding the `.xcframework`s directly to
an Xcode target's *Frameworks, Libraries, and Embedded Content* (embed & sign),
or via the `binaryTarget` manifest `ios/Package.binary.swift` (rename to
`Package.swift` in a distribution repo; for a remote release swap each
`binaryTarget(path:)` for `url:`+`checksum:`). The SwiftUI/UIKit frameworks
dynamically link `FarmerChatCore.framework`, so link Core alongside them.

`ios/ConsumerApp` is a worked example that links only the built `.xcframework`s
(not the source packages) and builds/runs on the simulator.

The version is single-sourced from `FarmerChatSDK.version` (currently `1.0.0`);
SPM package versions come from the git tag (`ios-v1.0.0`).

## Initialize + launch

```swift
import FarmerChatCore

FarmerChat.initialize(config: FarmerChatConfig(
    environment: .prod,          // dev | stage | demo | prod | eks
    geoApiKey: "…",              // Google Geolocation. Also gates the HOME FEED: without it,
                                 // location comes from backend IP only, and endpoint #12 returns
                                 // an empty `sections` list until a location resolves.
    guestApiKey: "…",            // overrides built-in guest init API key
    appearance: .auto,           // day | night | auto
    languageCode: nil,           // preselect a language, skips language screen if valid
    defaultCountryCode: "IN",    // fallback for the language list when initialize_user
    defaultStateCode: "Karnataka", // returns no country_code (endpoint #2 400s on a blank one)
    enableVoice: true,
    enableImages: true,
    enableWeather: true,
    onEvent: { name, props in /* analytics fan-out */ },
    onSessionExpired: { /* refresh + guest fallback both failed */ }
))
```

SwiftUI (iOS 16+):

```swift
import FarmerChatSwiftUI

FarmerChatView()                       // embed
FarmerChat.shared.present(from: self)  // modal from UIKit
```

UIKit (iOS 15+):

```swift
import FarmerChatUIKit

present(FarmerChatViewController(), animated: true)
```

Deep-link style entry, auth state, logout:

```swift
FarmerChat.shared.openChat(question: "…")            // or conversationId:
FarmerChat.shared.isAuthenticated                    // OTP-verified state
FarmerChat.shared.onAuthStateChanged                 // Combine publisher
FarmerChat.shared.setAnalyticsListener { name, props in … }
await FarmerChat.shared.logout()
```

## Theming (docs/07 Part B)

Everything is optional; omitted values keep the built-in FarmerChat green brand.
A single resolver overlays the host theme onto the SwiftUI (`FCTheme`) and UIKit
(`FCUITheme`) token layers, so every screen recolors with no per-screen edits.

```swift
FarmerChat.initialize(config: FarmerChatConfig(
    environment: .prod,
    theme: FarmerChatTheme(
        brandPrimary: Color(hex: 0x1565C0),      // app bars / brand surfaces
        brandPrimaryDark: Color(hex: 0x0D47A1),  // primary buttons / input tiles
        brandAccent: Color(hex: 0x42A5F5),       // chevrons / active dot / spinner
        onBrand: .white,
        cardCornerRadius: 16,
        buttonCornerRadius: 12,
        fontName: "HostSans",                    // optional
        typeScale: 1.0,                          // optional
        logo: Image("host_logo")                 // optional 6-petal-mark override
    )
))
```

Optional dark-mode overrides (`darkBrandPrimary`, …) fall back to their light
counterparts; on-brand text contrast is derived automatically. Colors and shape
are fully wired; `typeScale`/`fontName` apply through the `theme.font(...)`
helper (existing fixed `.font(.system(size:))` sizes are not auto-scaled).

## Feature flags & callbacks (docs/07 Part C)

All additive; defaults preserve today's behavior.

```swift
FarmerChatConfig(
    environment: .prod,

    // C2 identity injection
    authMode: .hostToken,                 // .sdkOtp (default) | .hostToken
    accessToken: "…",                     // host token; skips the phone/OTP UI
    tokenProvider: { await host.freshToken() },  // called on 401

    // C3 scope + toggles
    mode: .chatOnly,                      // .fullJourney (default) | .chatOnly
    showSettings: true, showHistory: true, showDrawer: true,
    enableWeather: true, enableSsfr: true,

    // 2.0.0 agentic streaming chat (#27a) — default false keeps 1.0.0 chat
    enableAgenticChat: true,

    // C5 host strings + forced locale
    stringOverrides: ["chat_title": "Ask AgroBot"],   // host wins over server
    locale: "hi",                                     // force language

    // C4 semantic callbacks (alongside onEvent)
    onChatOpened: { … },
    onMessageSent: { text in … },
    onAnswerReceived: { messageId in … },
    onScreenView: { name in … },
    onError: { code, message in … },
    onSessionStart: { … }
)
```

Programmatic navigation + inline embedding:

```swift
FarmerChat.shared.sendQuestion("How do I treat leaf rust?")
FarmerChat.shared.openConversation("conv-123")
FarmerChat.shared.openScreen(.chatHistory)   // .home/.settings/.help/.language

FarmerChatInlineView()          // C1: fills its container, not the whole screen
FarmerChatViewController()      // C1 UIKit: usable as a child view controller
```

## Analytics listener

No third-party analytics/marketing SDKs are embedded. The SDK emits the app's
event names (`App_Opened`, `Screen_Viewed`/`Screen_Exited`, `Send_OTP_Click_Event`,
`Submit_OTP`, `Registration_Completed`, `Login_Completed`, `Dashboard_Viewed`,
`Card_Shown/Viewed/Clicked`, `Send_Query`, `FirstQueryAsked`,
`Transcription_Success/Failed`, `Started/Stopped_Playing_Response_Audio`,
`Logout_Click_Event`, `gps_flow_step`, …) through `config.onEvent` and
`setAnalyticsListener`. User attributes are surfaced as `User_Attribute_Set`
events with `attribute`/`value` props so hosts can map them onto identity.

## Host Info.plist keys (required for full functionality)

| Key | Why |
|---|---|
| `NSMicrophoneUsageDescription` | Voice questions (Speak input, voice follow-ups) |
| `NSCameraUsageDescription` | Photo questions via camera |
| `NSPhotoLibraryUsageDescription` | Photo questions from the gallery |
| `NSPhotoLibraryAddUsageDescription` | "Download" answer card to Photos |
| `NSLocationWhenInUseUsageDescription` | Location prompt (weather/local advice) |

The SDK checks availability gracefully — missing permissions degrade the
feature (with a toast), they don't crash.

## Storage & session

- Tokens live in the Keychain (`farmer_chat_app_access_token`,
  `farmer_chat_app_refresh_token`, user id, stable device id).
- Everything else lives in UserDefaults under the `fc_sdk_` prefix (language,
  labels JSON, onboarding steps, location, chat, appearance, permission
  counters) — the SDK never collides with host keys.
- Logout calls `api/user/logout/`, clears prefs (preserving appearance) and
  wipes tokens. The host never touches tokens.

## Networking behavior (parity with the app)

- Headers on every call: `Build-Version: v2`, `Device-Info` (URL-encoded JSON
  device config), `Authorization: Bearer` when present, `X-Request-ID`,
  `X-Timeout`.
- Priorities: P1 geolocate 5 s/1 retry · P2 default 10 s/2 · P3 AI runtime
  30 s/3 (text prompt, image analysis, follow-ups, synthesise, transcribe,
  thread history).
- Retryable HTTP: 408/500/502/503/504/404, never 400/429/401; backoff
  `min(500·2^n, 3000)` ms.
- 401 → actor-based single-flight refresh (`get_new_access_token`) with guest
  `send_tokens` fallback (API-Key), skip-list for auth endpoints, loop guard 2.
- Chat replies are synchronous JSON — no streaming/SSE/WebSocket **on the 1.0.0
  path (#27)**. 2.0.0 adds the opt-in agentic stream (#27a); see below.

## Voice pipeline

Record m4a/AAC (44.1 kHz mono) via `AVAudioRecorder` → base64 →
`transcribe_audio` with `input_audio_encoding_format: "aac"` → accepted only if
`!error && confidence_score > 0.7 && text not blank` → `get_answer_for_text_query`.
Listen (TTS) uses `synthesise_audio` → AVPlayer.

## Agentic streaming chat (2.0.0, opt-in)

`enableAgenticChat` defaults to **false**: a host that does nothing keeps the
1.0.0 synchronous #27 contract unchanged. When true, **text** queries stream
endpoint **#27a** `api/chat/get_answer_for_text_query_agentic/` (voice
transcription and image analysis stay synchronous, as on Android).

```swift
FarmerChatConfig(environment: .prod, enableAgenticChat: true)
```

### Transport (verified live 2026-09-02 on dev/stage/prod)

- The request sends `Accept: application/json` — the backend **406s**
  `Accept: text/event-stream`. The response is `text/event-stream`, chunked.
- The stream runs on a **dedicated `URLSession` with no read/resource timeout**
  (`AgenticChatDataSource.noTimeoutInterval`) and never goes through the
  `ApiPriority` path. Note a `URLRequest.timeoutInterval` *overrides* the session
  configuration, so the streaming request carries no priority deadline either
  (and no `X-Timeout` / `X-Request-ID`, matching Android's agentic client).
- `Authorization: Bearer`, `Build-Version`, `Device-Info` and the 401 refresh
  (skip-list + loop guard 2, shared single-flight `TokenRefresher`) behave exactly
  as on every other call.

### Events and API

`FarmerChatAPI.streamAnswerForTextQueryAgentic(_:)` returns an
`AsyncThrowingStream<AgenticEvent, Error>` with six cases (`toolCall`,
`toolResult`, `textDelta`, `metadata`, `done`, `failure`). Transport failures are
delivered as `.failure` and then the stream finishes; only cancellation throws, so
a consumer that left the screen writes no stale error.

Finalization routes the terminal `metadata` event back through the *same*
handler the synchronous #27 response uses — its payload is field-compatible with
`TextPromptResponse` — so the C4 callbacks, TTS gating and follow-ups (#29) are
shared, not reimplemented. Four-way finalize: `done` present → complete answer
(not interrupted, even if the transport dropped after); error + partial text →
interrupted with the partial kept; clean EOF with partial text → **not**
interrupted (some backends stream deltas with no terminal event); nothing → error.

### ⚠ Wire framing is NOT verified against a live stream

The endpoint opens but has never been observed emitting an event (a guest receives
0 bytes on all three environments — `docs/05-open-questions.md`). The reader is
therefore deliberately permissive, exactly like Android's: it accepts both
`data:`-prefixed SSE (blank line ends an event, CRLF tolerated, `:` keep-alives
ignored) and bare NDJSON, resolves the type from an `event:` line else a
`type`/`event` field, matches types case/separator-insensitively
(`TOOL_CALL == tool_call == toolCall`), and reads every documented field alias.
Because the wire cannot be exercised, the mapping, the framing state machine, the
sanitizer and the no-timeout request are pinned by **45 unit tests**
(`AgenticStreamTests`).

`sanitizeAgenticStreamText` strips the control tokens the stream carries but the
clean `metadata.response` does not (`<<commodities:chickpea>>`, a
```` ```followups ``` ```` block) *including* a half-arrived `<<` or an unterminated
fence — without it the farmer watches raw tokens type themselves into the answer.

### Streaming UI (`FarmerChatSwiftUI`)

Live text with no typewriter animation, a tool-progress spinner (min 700 ms dwell
per status so back-to-back tool events are not collapsed), a 4 s "Paused,
resuming…" stall hint that clears on the next delta, and `FCStreamErrorCard`
whose copy depends on both the error kind and whether partial text exists.

### Alignment surfaces

`TextPromptResponse.alignments` carries a server-driven prompt answered by tapping
a chip (`AlignmentSurface` / `AlignmentChip` / `AlignmentKind`, 7 kinds). An
**exclusive** surface (clarify / confirm / escalate / gps-prompt / upload-photo)
arrives with `response` EMPTY on purpose — its prompt is `alignments.message`, and
it replaces the answer; escalate gets an urgent tint. An **additive** one
(gender-select / commodity-confirm) renders below a real answer.

> The Core model is named `AlignmentSurface`, not `Alignment` as on Android:
> `SwiftUI.Alignment` owns that name, and a public `Alignment` in Core would make
> every `Alignment` reference ambiguous in host files importing both modules. The
> wire key is still `alignments`.

Known iOS-only gaps for 2.0.0: the streaming/alignment UI exists in
`FarmerChatSwiftUI` only (`FarmerChatUIKit` still renders 1.0.0 chat), and
`alignmentSelectedValues` is never populated (faithful to Android core, so a
tapped chip is not highlighted on either platform).

## Verification status

Commands run on macOS (Xcode toolchain), 2026-07-16:

```
cd ios/FarmerChatCore   && xcrun swift build --sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" -Xswiftc -target -Xswiftc arm64-apple-ios15.0-simulator   # Build complete
cd ios/FarmerChatCore   && swift test    # 10/10 tests pass (macOS host run)

2.0.0 agentic work re-run on 2026-09-02 (paths under `versions/v2/ios/`):

```
cd versions/v2/ios/FarmerChatCore    && swift build                                   # Build complete
cd versions/v2/ios/FarmerChatCore    && swift test                                    # 57/57 tests pass (45 new agentic + 12 pre-existing)
cd versions/v2/ios/FarmerChatCore    && xcrun swift build --sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" -Xswiftc -target -Xswiftc arm64-apple-ios15.0-simulator   # Build complete
cd versions/v2/ios/FarmerChatSwiftUI && xcrun swift build --sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" -Xswiftc -target -Xswiftc arm64-apple-ios16.0-simulator   # Build complete
cd versions/v2/ios/FarmerChatUIKit   && xcrun swift build --sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" -Xswiftc -target -Xswiftc arm64-apple-ios15.0-simulator   # Build complete
```

The agentic stream itself is **not** verified end-to-end: it has never been
observed emitting a byte (see above), so no run in this environment could
exercise it.
cd ios/FarmerChatSwiftUI && xcrun swift build --sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" -Xswiftc -target -Xswiftc arm64-apple-ios16.0-simulator # Build complete
cd ios/FarmerChatUIKit  && xcrun swift build --sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" -Xswiftc -target -Xswiftc arm64-apple-ios15.0-simulator  # Build complete
```

Unverified (documented, not claimed):
- No simulator/device run against the live backend (no API keys in this
  environment); endpoint payloads follow docs/02 exactly.
- CocoaPods `pod lint` not run (no CocoaPods in this environment).
- SampleApp requires creating an Xcode app target (see `SampleApp/README.md`).

Known intentional gaps and conservative choices are recorded in
`docs/04-parity-matrix.md` and `docs/05-open-questions.md`.
