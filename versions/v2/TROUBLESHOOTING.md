# Troubleshooting the FarmerChat SDK (2.x)

Start with diagnostics: set `debugLogging = true`. Every platform then logs one line per HTTP
request (`[FarmerChat] POST /api/... -> 200 (184ms) rid=...`) without tokens or bodies. Turn it off
for release builds. Then find your symptom below.

## Errors reported to your app

`onError(code, message)` fires when an SDK request fails after its retries.

| `code` | Meaning | What to check |
|---|---|---|
| HTTP status (`400`, `404`, `500`, ...) | The FarmerChat backend answered with an error | `message` names the failed call. `5xx` and `404` were already retried with backoff. |
| `401` | The session could not be refreshed | In `HOST_TOKEN` mode, push a fresh token with `FarmerChat.updateTokens(...)`. `onSessionExpired` fires too. |
| `-1` | Timeout or no network | The device is offline or the request exceeded its timeout (5 s, 10 s or 30 s depending on the call). |

The SDK never retries `400`, `401` or `429`.

## Setup problems

### The app crashes when the chat screen first opens (Android, Compose)
`java.lang.VerifyError: ... InputComposerKt ... expected Boolean`: your app builds with an Android
Gradle Plugin older than **8.13.0**. The SDK is built with AGP 8.13 and Kotlin 2.3, and an older D8
mis-verifies one of its Compose functions. Upgrade AGP in your app. The Views artifact is not
affected.

### Manifest merging fails (Android, minSdk below 26)
The SDK's minSdk is 26. If your app targets lower and uses `tools:overrideLibrary`, list every SDK
package, including `org.digitalgreen.farmerchat.sdk.compose`, not only `.views` and `.core`.

### The home screen is empty (FULL_JOURNEY mode)
The home feed is returned only once the user's location has resolved to a country. Until then the
backend sends an empty feed, not an error, so no error state appears.
- Location comes from coordinates sent at guest sign-in (through the Geolocation key, built in since
  2.2.0) or from the location-permission prompt.
- If you override `geoApiKey`, make sure the key is valid and allowed to call the Geolocation API.
  A blank value means "use the built-in key".
- Fewer cards than the FarmerChat app is expected: some app sections are third-party widgets the SDK
  does not render.

### The chat shows English text when another language was chosen
Labels load from the server for the chosen language. With `debugLogging` on, confirm that the
labels request returns `200`. In `CHAT_ONLY` mode the SDK loads them in the background on first
launch, so a request failure there leaves English fallbacks in place.

### Nothing happens when the user closes the chat (CHAT_ONLY)
If you embed the SDK view yourself, implement `onExit` and remove the view there. The SDK's own
presenters (Activity, view controller, modal) close themselves.

### Analytics events never arrive
Since 2.0, events are off by default. Set `enableAnalytics = true`.

### Re-initializing seems to ignore my new settings
A repeat `initialize` rebuilds the SDK only when `environment`, `mode`, `showDrawer`,
`showHistory` or `showSettings` change. For other settings the first config stays in effect; a new
host `accessToken` is still applied. To apply other changes, call `FarmerChat.shutdown()` and
then `initialize` again.

### Voice, camera or location do nothing (iOS)
Your app must declare the usage strings in Info.plist: microphone, camera, photo library and
location when-in-use. The SDK checks permissions and turns the feature off when one is missing.

### Legal pages open in the browser, or answers share as plain text (React Native)
Two peer packages are optional. Without `react-native-webview`, legal and FAQ pages open in the
external browser. Without `react-native-view-shot`, answers are shared as text instead of an image
card. In both cases the SDK prints a console warning naming the missing package. Install it to get
the in-app behaviour.

## Test mode: a local mock backend

To build and test your screens without a real account or OTP messages, point the SDK at the mock
server in this repository. It implements every endpoint with fixed responses.

```bash
node tools/mock-server/server.js        # listens on port 8899
```

Then set the base URL override:

| Platform | Setting | Value |
|---|---|---|
| Android emulator | `customBaseUrl` | `http://10.0.2.2:8899/` |
| iOS simulator | `customBaseURL` | `http://localhost:8899/` |
| React Native | `customBaseUrl` | `http://localhost:8899/` (Android emulator: run `adb reverse tcp:8899 tcp:8899`) |
| Web | `customBaseUrl` | `http://localhost:8899/` |

Your debug build must allow plain HTTP to that host (Android `network_security_config`, iOS ATS
exception). The sample apps in this repo show both. Never ship a build with `customBaseUrl` set.
