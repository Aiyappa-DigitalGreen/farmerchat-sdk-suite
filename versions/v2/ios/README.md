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

The version is single-sourced from `FarmerChatSDK.version` (currently `2.2.0`, the same as
Android, React Native and web); SPM package versions come from the git tag (`ios-v2.2.0`).

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
    defaultCountryCode: "",      // OPTIONAL region pin. Leave EMPTY (the default) and the SDK
    defaultStateCode: "",        // derives the country from the DEVICE LOCALE, exactly as the
                                 // app does, falling back to "KE" only when the locale carries
                                 // no region (endpoint #2 400s on a blank country_code).
                                 // `state` is inert on every environment — leave it empty.
    defaultLatitude: 0.0,        // OPTIONAL coordinate pin for the #11 seed. 0.0 = "unset →
    defaultLongitude: 0.0,       // use the device locale's country centroid". There is NO
                                 // hardcoded city: if nothing resolves, no coordinates are sent
                                 // rather than guessing a region for the farmer.
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
    // Keys are the CANONICAL server keys — use `FCLabels`, never a bare string.
    stringOverrides: [FCLabels.recentChats: "Past advice"],  // host wins over server
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

## Label keys — BREAKING CHANGE (2026-09-16)

`stringOverrides` keys, and any label you resolve yourself, must be the **canonical**
`fc_v2_app_label_*` keys. Use the generated `FCLabels` constants in `FarmerChatCore`:

```swift
FCLabels.recentChats   // "fc_v2_app_label_recent_chats"
FCLabels.shareLocation // "fc_v2_app_label_share_location"
```

**What changed.** Until now the SDK's own screens passed bare keys (`"feed_footer"`,
`"settings_title"`) to its internal label helpers. `LabelManager.label` looks a key up as
`"<key>_<lang>"`, and the server serves `fc_v2_app_label_<key>_<lang>`, so **none of them ever
resolved** — every iOS screen rendered its hardcoded English no matter which language the farmer
selected. 225 call sites were migrated to `FCLabels`; see
`docs/05-open-questions.md` for the full measurement.

**What you must do.** If you pass `stringOverrides`, re-key them. A host currently overriding
`"chat_title"` is matching a key the SDK no longer asks for, and that override will silently stop
applying. There is no deprecation shim, because the old keys never worked against the server
either — only against this one lookup.

**Still outstanding:** 108 call sites (66 distinct keys) have no canonical counterpart at all and
still pass literals — `api_error_title`, `feed_footer` and similar. Those are listed in docs/05 and
need either a backend key or a decision to hardcode the app's English; they are unaffected by this
change and continue to render their fallback.

## Objective-C hosts

`FarmerChatUIKit` ships an Objective-C facade, so a pure `.m` codebase can use the SDK without
writing any Swift. Import the module and use the `FC`-prefixed types:

```objc
@import FarmerChatUIKit;

FCFarmerChatConfiguration *cfg =
    [[FCFarmerChatConfiguration alloc] initWithEnvironment:FCEnvironmentProd];
cfg.languageCode      = @"en";
cfg.defaultCountryCode = @"IN";
cfg.guestApiKey       = @"<your guest key>";
cfg.mode              = FCModeChatOnly;   // or FCModeFullJourney
cfg.showDrawer        = NO;
cfg.enableAnalytics   = YES;              // default NO, matching Android

// Host-supplied auth (optional). The async Swift tokenProvider becomes a completion block.
cfg.authMode      = FCAuthModeHostToken;
cfg.tokenProvider = ^(void (^done)(NSString *_Nullable)) {
    [MyAuth refreshWithCompletion:^(NSString *token) { done(token); }];
};

// String overrides MUST use canonical keys — FCLabelKeys, never a hand-typed string.
cfg.stringOverrides = @{ FCLabelKeys.recentChats : @"Past advice" };

[FCFarmerChat initializeWithConfiguration:cfg];

// Present the journey
[FCFarmerChat presentFrom:self animated:YES completion:nil];

// …or embed the launcher
UIButton *fab = [FCFarmerChat makeFabButton];
[self.view addSubview:fab];
```

Other members: `+makeViewController`, `+openChatWithQuestion:conversationId:`,
`+isAuthenticated`, `+logoutWithCompletion:`, `+updateTokensWithAccessToken:refreshToken:`, and
`+observeAuthState:` (the block form of the Combine `onAuthStateChanged` publisher — keep the
returned `FCAuthObservation` alive, and call `-invalidate` to stop).

### Bridging notes

| Swift | Objective-C | Why |
|---|---|---|
| `FarmerChatConfig` (struct) | `FCFarmerChatConfiguration` (`NSObject`) | Swift structs cannot be exposed to Obj-C at all |
| String-raw-value enums | `FCEnvironment` / `FCMode` / `FCAuthMode` / `FCAppearance`, `Int`-backed | `@objc` enums must be Int-backed |
| `CGFloat?` (`bubbleCornerRadius`, `messageFontSize`) | `NSNumber *` | Obj-C has no optional scalar. **nil means "SDK default", not 0** |
| `Color?` | `UIColor *` | SwiftUI `Color` is not Obj-C representable |
| `tokenProvider: () async -> String?` | block taking a completion block | Obj-C has no `async` |
| `logout() async` | `+logoutWithCompletion:` | same |
| `onAuthStateChanged: AnyPublisher` | `+observeAuthState:` → `FCAuthObservation` | Combine is not Obj-C representable |

### Not bridged

- `theme` (the full `FarmerChatTheme` struct). The individual colour knobs above cover most of it;
  Obj-C hosts needing full theming must add a one-file Swift bridge.
- `prefs` / `labels` / `analytics` / `api` / `session` — Swift-only internals, deliberately not
  part of the Obj-C surface.
- `pendingChatTarget` / `pendingScreenTarget` Combine subjects. Use
  `+openChatWithQuestion:conversationId:` instead.

### How this is verified

`swift build` and `xcodebuild` pass whether or not a symbol is visible to Objective-C, so they
prove nothing here. `Sources/FarmerChatObjCSmoke/FCObjCSmoke.m` is a compile-only target built by
clang **as Objective-C**, exercising every facade member and `_Static_assert`-ing the enum raw
values (which are ABI for any host already compiled against them). Build it with:

```sh
cd FarmerChatUIKit
SDK="$(xcrun --sdk iphonesimulator --show-sdk-path)"
xcrun swift build --sdk "$SDK" \
  -Xswiftc -target -Xswiftc arm64-apple-ios15.0-simulator \
  -Xcc -target -Xcc arm64-apple-ios15.0-simulator -Xcc -isysroot -Xcc "$SDK"
```

The `-Xcc` flags are required: without them clang compiles the `.m` against the macOS SDK and
fails on `Foundation`.

## Analytics is off by default — BREAKING CHANGE (2026-09-16)

`enableAnalytics` now gates every event, **default `false`**, matching Android. A host that wires
`onEvent` and nothing else will stop receiving events until it opts in:

```
enableAnalytics: true
```

Why: until now this platform emitted every event to `onEvent` unconditionally while Android dropped
them at the dispatch point, so identical host code behaved differently per platform. Events are
still constructed with their real names, properties and ordering — they are dropped only at
`track()`, so enabling telemetry later cannot change any other behaviour.

`showNameScreen` was added in the same change (default `true`, so no behaviour change). Set it
`false` to skip the Enter-Name step, as on Android.

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
| `NSLocationWhenInUseUsageDescription` | Location prompt (weather/local advice, and the 2.0.0 `gps-prompt` capability chip) |

The SDK checks availability gracefully — missing permissions degrade the
feature (with a toast), they don't crash.

**Location prompt (2026-10-06 app port).** `LocationPromptManager` runs the app's trigger
decision tree: only the Weather chip shows the full-screen "Share Location" interstitial;
the chat `gps-prompt` chip and campaign triggers go straight to the system dialog. A second
denial (persisted as `fc_sdk_PERMISSION_DENY_COUNT`) opens the "We need your location"
sheet (Turn on in settings). With Location Services off, Weather continues without a
location and other sources get a non-retryable "Turn on GPS" screen. A failed fix retries
once, then falls back to the last-known fix, then ends quietly with no error screen. The
fix is saved only after `update_user_location` succeeds (guests save immediately). Without
`NSLocationWhenInUseUsageDescription` the request counts as a denial; it never hangs.

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

### Capability chips (2.0.0)

The two CAPABILITY surfaces do not send text. A chip whose `action` is `"invoke"`
and whose `value` belongs to its own surface invokes a device capability, and only
the OUTCOME is sent:

| Surface | `value` | What happens |
|---|---|---|
| `gps-prompt` | `share_precise_location` | Runs the location flow, then re-sends the surface's `original_query` with `triggered_input_type = align_chip_sel`, showing the resolved address as a location bubble |
| `upload-photo` | `take_photo` | Opens the camera directly (no photo-source sheet) |
| `upload-photo` | `choose_from_gallery` | Opens the gallery directly |
| any | `not_now`, or no `invoke` action | Ordinary follow-up — the chip's `value`/`label` is sent as the question |

The rule is one Core function, `AlignmentChip.capability(for:)`, so SwiftUI and
UIKit cannot drift apart; `AlignmentChip.actionSelect` / `valueShareLocation` /
`valueTakePhoto` / `valueChooseFromGallery` / `valueNotNow` hold the exact wire
strings (note `"invoke"`, **not** `"select"`, and `"share_precise_location"`,
**not** `"share_location"`).

Declining, cancelling or a failed fetch still answers the blocking question: the
label `fc_v2_app_label_location_permission_declined` is sent as a follow-up
(English fallback "Continue without sharing my location"; the key is verified
present on endpoint #3). `LocationPromptEvent.isLocationObtained` /
`.terminalSource` in Core are the shared predicate both flavours filter on, so a
location outcome belonging to Home is never mistaken for a chat one.

A shared location renders as `ChatMessage.location(LocationMessage)` —
`FCLocationChatBubble` (SwiftUI) / `FCUILocationBubbleCell` (UIKit), honouring the
same `bubbleCornerRadius` and `messageFontSize` knobs as the other bubbles. The
address is `USER_DISTRICT, USER_STATE, USER_COUNTRY_NAME` (blanks dropped,
de-duplicated); a guest has none of those, so the address is blank and no bubble
is appended — app parity, not a failure. `NSLocationWhenInUseUsageDescription` and
`NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` are therefore
required for these chips to do anything (see the Info.plist table above).

Known iOS-only deltas for 2.0.0, both mirrored from the Android reference rather
than "fixed": the location send carries no `parent_message_id` (`TextPromptRequest`
has no such field) and no `agentic_chip_*` analytics properties, so it reports as
an ordinary text query. The app's chat-history `message_type_id 12 →
location_shared` mapping is deliberately not ported (the app's own
`TODO(location-history)` calls its type id and address field unconfirmed
placeholders).

## Verification status

Commands run on macOS (Xcode toolchain), 2026-07-16:

```
cd ios/FarmerChatCore   && xcrun swift build --sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" -Xswiftc -target -Xswiftc arm64-apple-ios15.0-simulator   # Build complete
cd ios/FarmerChatCore   && swift test    # 10/10 tests pass (macOS host run)

2.0.0 agentic work re-run on 2026-09-02 (paths under `versions/v2/ios/`):

```
cd versions/v2/ios/FarmerChatCore    && swift build                                   # Build complete
cd versions/v2/ios/FarmerChatCore    && swift test                                    # 79/79 tests pass (60 pre-existing + 19 new: CapabilityChipTests 12, LocationOutcomeTests 7)
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
