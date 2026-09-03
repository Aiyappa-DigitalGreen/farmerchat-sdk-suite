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
| `defaultCountryCode` | `string` | `''` (derive) | OPTIONAL override for the country used in the language list (endpoint #2) when `initialize_user` cannot resolve one — a fresh guest often gets `country_code: null`, and the endpoint returns HTTP 400 for a blank value. **Leave it unset and the SDK derives the country from the device locale**, exactly as the app does. Set it only to pin the SDK to one region. |
| `defaultStateCode` | `string` | `''` (omitted) | OPTIONAL `state` param for endpoint #2. Safe to leave empty: the parameter is inert on every environment — `Karnataka`, `KA`, blank and omitted all return the identical set (verified live 2026-09-03). |
| `defaultLatitude` | `number` | `0` (derive) | OPTIONAL override for the coordinates posted to endpoint #11 when nothing else resolved a location. **Leave it at `0` and the SDK uses the device locale's country centroid**, as the app does on IP-geolocation failure. |
| `defaultLongitude` | `number` | `0` (derive) | see `defaultLatitude` |
| `enableVoice` | `boolean` | `true` | Speak input + Listen TTS |
| `enableImages` | `boolean` | `true` | Photo queries |
| `enableWeather` | `boolean` | `true` | weather chip + advice CTA |
| `onEvent` | `(name, props) => void` | – | analytics fan-out |
| `onSessionExpired` | `() => void` | – | refresh + guest fallback both failed |

### Fallback location (no hardcoded city)

Endpoint #12 (home feed) stays empty until the backend has a resolved location, and it resolves
one ONLY from coordinates — a country name alone is rejected. When the Google `geolocate` call
fails (or no `geoApiKey` is configured), the SDK does what the app does: it derives the **device
locale's country** and uses that country's centroid from a 247-entry table ported verbatim from
the app's `CountryLatLngProvider`, accepting it only when `lat != 0 && lng != 0`.

- The chain for `country_code` is: server `country_code` → persisted → your `defaultCountryCode`
  (when non-blank) → device-locale region → `'KE'` (the app's own literal; endpoint #2 returns
  HTTP 400 on a blank value, so a floor has to exist).
- If nothing resolves, **no coordinates are sent at all**. `(0, 0)` is a real point in the Gulf of
  Guinea, so sending it would be a wrong answer rather than a missing one — the guest gets an
  empty feed, which is honest.
- There is **no hardcoded city**. An earlier build defaulted to Bengaluru, so every guest the
  backend could not place was given Karnataka's advice.
- `expo-localization` is an optional peer used for the locale region; when it is absent the SDK
  falls back to `Intl` and never crashes.

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
