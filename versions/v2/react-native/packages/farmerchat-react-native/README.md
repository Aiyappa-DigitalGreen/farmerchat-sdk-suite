# @digitalgreenorg/farmerchat-react-native

FarmerChat — Digital Green's AI agronomy assistant for farmers — packaged as a
full-app React Native / Expo SDK. One component launches the complete journey:
splash → language selection → name → home feed (weather, daily advice cards,
photo/speak/type inputs) → AI chat (text, voice, image queries, TTS, share
cards) → chat history → settings, with phone + OTP sign-in owned entirely by
the SDK.

- **TypeScript strict**, pure JS/TS — no custom native modules (new-architecture safe).
- Targets **Expo SDK 52+ / React Native 0.76+** (works on 0.74+).
- Session persisted in AsyncStorage under the `fc_sdk_` namespace — never
  collides with your app's storage.
- No third-party analytics/marketing SDKs inside — every event the production
  app tracks is emitted through your `onEvent` callback with identical names.

## Installation

### Expo (recommended)

```sh
npx expo install @digitalgreenorg/farmerchat-react-native \
  expo-av expo-image-picker expo-location expo-device expo-constants \
  @react-native-async-storage/async-storage \
  react-native-safe-area-context react-native-screens \
  react-native-gesture-handler react-native-reanimated

npx expo install @react-navigation/native @react-navigation/native-stack @react-navigation/drawer
```

Optional (recommended) peers:

```sh
npx expo install react-native-webview      # in-app legal/FAQ pages (else external browser)
npx expo install react-native-view-shot    # share answers as image cards (else text share)
```

#### app.json — permissions via config plugins

```json
{
  "expo": {
    "plugins": [
      ["expo-av", { "microphonePermission": "FarmerChat uses the microphone so you can ask questions with your voice." }],
      ["expo-image-picker", {
        "cameraPermission": "FarmerChat uses the camera so you can ask questions about photos of your crops.",
        "photosPermission": "FarmerChat lets you pick crop photos to ask questions about."
      }],
      ["expo-location", { "locationWhenInUsePermission": "FarmerChat uses your location to give weather and advice for your exact area." }]
    ]
  }
}
```

### Bare React Native

Install the same packages with `npm install`, then:

1. `cd ios && pod install`
2. Add the usage descriptions to `ios/<App>/Info.plist`:
   `NSMicrophoneUsageDescription`, `NSCameraUsageDescription`,
   `NSPhotoLibraryUsageDescription`, `NSLocationWhenInUseUsageDescription`.
3. Android permissions are merged automatically from the expo module manifests
   (`RECORD_AUDIO`, `CAMERA`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`).
4. Follow the standard setup for `react-native-gesture-handler` /
   `react-native-reanimated` (babel plugin) and `react-native-screens`.

## Usage

```tsx
import React from 'react';
import {
  FarmerChat,
  FarmerChatProvider,
  FarmerChatView,
} from '@digitalgreenorg/farmerchat-react-native';

FarmerChat.initialize({
  environment: 'prod', // 'dev' | 'stage' | 'demo' | 'prod' | 'eks'
  appearance: 'auto', // 'day' | 'night' | 'auto'
  geoApiKey: '<google-geolocation-key>', // optional — language auto-detect fallback
  // guestApiKey: '<override>',          // optional — overrides the built-in guest key
  enableVoice: true,
  enableImages: true,
  enableWeather: true,
  onEvent: (name, props) => {
    // Same event names/props as the production app — forward to your stack.
    analytics.logEvent(name, props);
  },
  onSessionExpired: () => console.warn('FarmerChat session expired'),
});

export default function App() {
  return (
    <FarmerChatProvider>
      <FarmerChatView />
    </FarmerChatProvider>
  );
}
```

### Public API

```ts
FarmerChat.initialize(config)                  // must be called first
FarmerChat.openChat(question?, conversationId?) // deep-link style entry
FarmerChat.logout()                            // server logout + local wipe
FarmerChat.isAuthenticated()                   // OTP-verified?
FarmerChat.addAuthStateListener(cb)            // returns unsubscribe
FarmerChat.setAnalyticsListener(cb)            // replace onEvent after init
```

`FarmerChatConfig`:

| Field | Type | Default | Notes |
|---|---|---|---|
| `environment` | `'dev'\|'stage'\|'demo'\|'prod'\|'eks'` | — (required) | selects the backend base URL |
| `geoApiKey` | `string` | – | Google Geolocation key for language auto-detect. Also gates the **home feed**: coordinates are passed to `initialize_user`, and endpoint #12 returns an empty `sections` list until the backend has a resolved location. Without this key the SDK relies on backend IP geolocation, which can return a null `country_code` and an empty home screen. |
| `guestApiKey` | `string` | built-in | overrides the guest-init API key |
| `appearance` | `'day'\|'night'\|'auto'` | `'auto'` | theme mode |
| `languageCode` | `string` | – | preselect a language, skips the language screen |
| `defaultCountryCode` | `string` | `'IN'` | Fallback country for the language list (endpoint #2) when `initialize_user` cannot resolve one — a fresh guest often gets `country_code: null`, and the endpoint returns HTTP 400 for a blank value. Set this to your deployment country. |
| `defaultStateCode` | `string` | `'Karnataka'` | state/region paired with `defaultCountryCode`; endpoint #2 matches the state **display name**, not the ISO code, and uses it only to rank languages |
| `enableVoice` | `boolean` | `true` | Speak input + Listen TTS |
| `enableImages` | `boolean` | `true` | Photo queries |
| `enableWeather` | `boolean` | `true` | weather chip + advice CTA |
| `enableAgenticChat` | `boolean` | `false` | **2.0.0 opt-in.** Streams the answer from endpoint #27a instead of the synchronous #27. See [Agentic streaming chat](#agentic-streaming-chat-200-opt-in). |
| `onEvent` | `(name, props) => void` | – | analytics fan-out |
| `onSessionExpired` | `() => void` | – | refresh + guest fallback both failed |

## Agentic streaming chat (2.0.0, opt-in)

`enableAgenticChat: true` routes chat answers through endpoint #27a
`api/chat/get_answer_for_text_query_agentic/`, which responds
`Content-Type: text/event-stream` and streams for as long as the agent needs. The default is
`false`: a host that does nothing keeps 1.0.0 behaviour (one synchronous #27 reply).

What it adds to the chat screen: live answer text with **no** typewriter animation (the tokens
are already arriving one at a time), a tool-progress indicator with a 700 ms minimum dwell per
status, a transient "Paused, resuming…" hint after 4 s of silence that clears on the next chunk,
and an inline retry card if the stream ends without a complete answer (keeping any partial text).

### Transport: XMLHttpRequest, and what that costs

React Native's `fetch` is a polyfill over the native networking module and does **not** expose a
readable `response.body` — `ReadableStream` is absent from the RN runtime — so `await fetch(...)`
only resolves once the whole response is buffered. The SDK therefore uses `XMLHttpRequest`, which
switches RN's native networking into incremental mode when an `onprogress` / `onreadystatechange`
handler is attached, and then grows `xhr.responseText` while `readyState === 3`. The reader keeps
a cursor into `responseText` and holds back the tail after the last newline so a half-arrived line
is never parsed. `react-native-sse` uses the same mechanism; it is not added as a dependency.

Honest limitations:

- The entire response accumulates in memory in `responseText` for the life of the request.
- Any network interposer that buffers responses — Flipper's network plugin on Android, a proxy
  with buffering, a host that monkey-patches `XMLHttpRequest` — collapses the body into one
  chunk. Events are still parsed correctly; the answer simply appears all at once instead of
  typing in.
- On React Native Web the browser XHR is used. Incremental `responseText` works there, but a
  gzip-buffering or CORS-restricted intermediary can again collapse it.
- `timeout` is set to `0`. RN's `timeout` is a whole-request deadline, not a read timeout, so any
  nonzero value would kill a multi-minute answer. This request never goes through the
  ApiPriority/`AbortController` path for the same reason. Auth is unaffected: the same
  `Build-Version` / `Device-Info` / `Authorization` headers are sent and a 401 refreshes the
  token once (single-flight, shared with `HttpClient`) and replays the stream.
- Header parity with the Android `agenticClient`: **no `X-Request-ID` and no `X-Timeout`** are
  sent on this endpoint, because deriving an `X-Timeout` would advertise a deadline the request
  does not have.
- The **wire framing is not confirmed against a live stream** (a guest receives 0 bytes on
  dev/stage/prod; agentic answers appear to be gated on an OTP-verified user). The reader accepts
  both `data:`-prefixed SSE and bare NDJSON, and takes the event type from an `event:` line or a
  `type`/`event` field in the JSON, case- and separator-insensitively.

### Alignment surfaces

`TextPromptResponse.alignments` carries a server-driven prompt the farmer answers by tapping a
chip. It is handled on the **synchronous #27 path too** and is not gated on `enableAgenticChat`.
Exclusive surfaces (`alignment-clarify` / `-confirm` / `-escalate`, `gps-prompt`, `upload-photo`)
arrive with `response` **empty on purpose** and replace the answer with `alignments.message`;
additive ones (`gender-select`, `commodity-confirm`) render below a real answer. Escalate gets an
urgent tint derived from the theme's failure colour.

### Known gaps vs. the Android reference

- `AlignmentChip.action` (`"select"` invokes a device capability, `"decline"` opts out) is parsed
  into the type and otherwise ignored — matching Android, where no device flow consumes it
  either. No GPS/photo capability flow is wired on either platform, so a capability chip is sent
  back as a plain follow-up.
- The Compose `AlignmentSurface` has a `fetchingProgressLabel` slot for a capability in flight;
  it is not ported, for the same reason.
- The stream error card uses the `info` icon for both states (this package's bundled icon set has
  no wifi-off/warning glyph); the copy still distinguishes them.
- Tapping an alignment chip records the pick so the chip locks and stays highlighted — an
  **addition** on React Native. The Android core has the `alignmentSelectedValues` field but
  nothing that fills it, so a tapped chip never locks there.
- When an agentic answer settles from the terminal `metadata` event, the settled bubble **keeps
  the stream's id** instead of minting a new one as Android does. Android's fresh id makes its
  reveal-tracking set miss, which replays the typewriter animation over text the farmer just
  watched stream in.

### Localization caveat

User-visible strings resolve through the label manager, but this package has a **known
pre-existing bug**: several of its label base keys do not match the keys the server ships, so
those strings fall back to their English defaults. The agentic/alignment strings use the same base
keys as the Android SDK, but localization on React Native is **not verified**.

## Networking guarantees (parity with the production app)

- Per-request timeouts by priority class: P1 5 s / 1 retry (geolocate),
  P2 10 s / 2 retries (default), P3 30 s / 3 retries (AI endpoints).
- Retryable HTTP: 408/500/502/503/504/404 — never 400/429.
- Exponential backoff `min(500·2^n, 3000)` ms; network exceptions only.
- Headers on every call: `Build-Version: v2`, `Device-Info` (URL-encoded JSON),
  `X-Request-ID`, `X-Timeout`, `Authorization: Bearer` when present.
- 401 → single-flight token refresh → guest `send_tokens` fallback, with the
  app's skip-list and loop guard. Hosts never touch tokens.

## Platform notes

- Voice is recorded as m4a/AAC via expo-av and transcribed server-side
  (`input_audio_encoding_format: "aac"`).
- SMS auto-read (Android SMS Retriever) is not available in RN — the OTP field
  uses `textContentType="oneTimeCode"` / `autoComplete="sms-otp"` for keyboard
  suggestions and manual entry.
- Without `react-native-view-shot` answers are shared as text; without
  `react-native-webview` legal/FAQ pages open in the external browser. The SDK
  logs a console warning and degrades — it never crashes on a missing optional
  peer.

## License

Apache-2.0 © Digital Green
