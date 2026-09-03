# @digitalgreenorg/farmerchat-web

Embeddable FarmerChat SDK for the web (React 18). Ships the complete FarmerChat
journey — splash → language onboarding → name → home feed → AI chat (text,
voice, image) → chat history → settings/help — plus phone + OTP auth, inside a
single component you drop into any page. TypeScript strict, zero runtime
dependencies beyond React.

## Install

```bash
npm install @digitalgreenorg/farmerchat-web react react-dom
```

`react` / `react-dom` (>= 18) are peer dependencies.

## Embed as a React component

```tsx
import { FarmerChat } from '@digitalgreenorg/farmerchat-web';

export function SupportPage() {
  return (
    <div style={{ width: 420, height: 720 }}>
      <FarmerChat
        config={{
          environment: 'prod',
          appearance: 'auto',
          geoApiKey: 'GOOGLE_GEOLOCATION_KEY',
          guestApiKey: 'GUEST_INIT_API_KEY',
          onEvent: (name, props) => myAnalytics.track(name, props),
          onSessionExpired: () => console.warn('FarmerChat session expired'),
        }}
      />
    </div>
  );
}
```

The SDK renders edge-to-edge inside its container element — size the container
(width/height) to control the layout. It is mobile-first and responsive.

## Embed imperatively (no React in the host page)

```html
<div id="farmerchat" style="width: 420px; height: 720px"></div>
<script type="module">
  import { FarmerChat } from '@digitalgreenorg/farmerchat-web';

  const handle = FarmerChat.mount(document.getElementById('farmerchat'), {
    environment: 'prod',
  });
  // later: handle.unmount();
</script>
```

## Static API

```ts
FarmerChat.initialize(config);                    // pre-create the core (optional)
FarmerChat.mount(element, config?);               // imperative mount → { unmount }
FarmerChat.openChat(question?, conversationId?);  // deep-link style entry into chat
await FarmerChat.logout();                        // server logout + clear local session
FarmerChat.isAuthenticated();                     // true only after OTP verification
FarmerChat.onAuthStateChanged((isAuthed) => {});  // returns unsubscribe
FarmerChat.setAnalyticsListener((name, props) => {});
```

`openChat` called before onboarding completes is stored as a pending target and
consumed by the splash router, exactly like the app's deep-link handling.

## Config

| Field | Type | Default | Description |
|---|---|---|---|
| `environment` | `'dev' \| 'stage' \| 'demo' \| 'prod' \| 'eks'` | — (required) | Selects the API base URL. |
| `geoApiKey` | `string` | `''` | Google Geolocation key for the language auto-detect fallback. Without it, geolocate is skipped and the server infers location from IP at guest init. Also gates the **home feed**: coordinates are passed to `initialize_user`, and endpoint #12 returns an empty `sections` list until the backend has a resolved location. Without this key the SDK relies on backend IP geolocation, which can return a null `country_code` and an empty home screen. |
| `guestApiKey` | `string` | `''` | API key for guest initialization (`initialize_user`) and the guest-token refresh fallback (`send_tokens`). Required for the SDK to work — provisioned per host. |
| `appearance` | `'day' \| 'night' \| 'auto'` | `'auto'` | `auto` follows `prefers-color-scheme` live. |
| `languageCode` | `string` | — | Preselects the UI language code. |
| `defaultCountryCode` | `string` | `''` (derive) | OPTIONAL override for the endpoint #2 `country_code` when `initialize_user` cannot resolve one (a fresh guest often gets `country_code: null`). **Leave it unset and the SDK derives the country from the browser locale**, exactly as the Android app does. Endpoint #2 returns HTTP 400 for a blank value, so if the locale carries no region either (e.g. a plain `en` browser), `'KE'` — the app's own last-resort literal — is sent. Set it only to pin the SDK to one region. |
| `defaultStateCode` | `string` | `''` (omit) | OPTIONAL `state` query param for endpoint #2. Safe to leave empty: the parameter is inert on every environment (`Karnataka`, `KA`, blank and omitted all return the identical set — verified live 2026-09-03). |
| `defaultLatitude` / `defaultLongitude` | `number` | `0` (derive) | OPTIONAL override for the coordinates posted to endpoint #11 when nothing else resolved a location. **Leave them at `0` and the SDK uses the browser locale's country centroid**, the app's own IP-geolocation fallback. If neither these nor the locale resolve, **no coordinates are sent at all** — a guess would put the farmer's advice in the wrong place. |
| `enableVoice` | `boolean` | `true` | Speak input + voice-clip playback (needs MediaRecorder). |
| `enableImages` | `boolean` | `true` | Photo input + image analysis queries. |
| `enableWeather` | `boolean` | `true` | Weather chip on Home + weather advice CTA. |
| `theme` | `FarmerChatTheme` | — | Host palette/shape/typography/logo override (see Theming). |
| `authMode` | `'SDK_OTP' \| 'HOST_TOKEN'` | `'SDK_OTP'` | `HOST_TOKEN` trusts host tokens and skips the phone/OTP UI. |
| `accessToken` / `refreshToken` | `string` | — | HOST_TOKEN seed tokens. |
| `tokenProvider` | `() => HostToken \| null \| Promise<…>` | — | HOST_TOKEN: (re)supply a token; called on 401. |
| `mode` | `'FULL_JOURNEY' \| 'CHAT_ONLY'` | `'FULL_JOURNEY'` | `CHAT_ONLY` skips onboarding/home and lands in chat. |
| `showSettings` / `showHistory` / `showDrawer` | `boolean` | `true` | Hide the drawer entirely, or its Settings/History entries. |
| `enableSsfr` | `boolean` | `true` | Home SSFR (fertilizer) card. |
| `stringOverrides` | `Record<labelKey, string>` | — | Highest-precedence label overrides (host wins over server + English). |
| `locale` | `string` | — | Force a language code regardless of device/onboarding. |
| `onEvent` | `(name, props) => void` | — | Analytics fan-out (see below). |
| `onSessionExpired` | `() => void` | — | Fired when 401 refresh **and** the guest-token fallback both fail. |
| `onChatOpened` / `onMessageSent` / `onAnswerReceived` / `onScreenView` / `onError` / `onSessionStart` | callbacks | — | Semantic host callbacks (in addition to `onEvent`). |

## Theming (host brand)

Everything is optional; omitted values fall back to the built-in FarmerChat
green brand. A single resolver overlays your palette onto scoped `.fcsdk-*` CSS
custom properties on the SDK root, so **every** screen recolors with no
per-screen work, and day/night still applies on top (supply only a light set and
the SDK derives sensible dark values).

```tsx
<FarmerChat config={{
  environment: 'prod',
  theme: {
    colors: { brandPrimary: '#1565C0', brandPrimaryDark: '#0D47A1', brandAccent: '#42A5F5', onBrand: '#fff' },
    dark:   { brandPrimary: '#1E88E5', brandAccent: '#64B5F6' },   // optional
    shape:  { cardCornerRadius: 16, buttonCornerRadius: 12, inputCornerRadius: 12 },
    typography: { fontFamily: 'Inter, sans-serif', typeScale: 1.0 },
    logo: '/host-logo.svg',   // URL or a React node
  },
}}/>
```

Color keys mirror the other platforms: `brandPrimary`, `brandPrimaryDark`,
`brandAccent`, `onBrand`, `background`, `readingSurface`, `cardSurface`,
`error`, `onBackground`, `onSurface`.

## Inline embedding

`<FarmerChat inline/>` (or `FarmerChat.mount(el, { inline: true })`) fills its
host container flush (no rounded frame, no full-viewport assumptions). Size the
container to control the layout.

## Programmatic API

```ts
import { FarmerChatSDK } from '@digitalgreenorg/farmerchat-web';
FarmerChatSDK.sendQuestion('How do I treat leaf blight?');
FarmerChatSDK.openConversation('conversation-id');
FarmerChatSDK.openScreen('home' | 'settings' | 'help' | 'chatHistory' | 'chat' | 'settingsLanguage');
```

Calls made before a root mounts are queued and replayed once it does.
`FarmerChatSDK` is an alias of `FarmerChat`.

## Analytics listener

No third-party analytics SDKs are bundled. Every event the production app
tracks is emitted through `onEvent` (or `FarmerChat.setAnalyticsListener`) with
the app's exact event names — `App_Opened`, `Screen_Viewed`, `Send_Query`,
`Send_OTP_Click_Event`, `Registration_Completed`, `Transcription_Success`,
`Started_Playing_Response_Audio`, `location_fetch_success`, … — so hosts can
forward them to their own analytics stack:

```ts
FarmerChat.setAnalyticsListener((name, props) => {
  window.gtag?.('event', name, props);
});
```

## Browser permissions

| Feature | API used | Notes |
|---|---|---|
| Voice questions | `navigator.mediaDevices.getUserMedia` + `MediaRecorder` (webm/opus, ogg/mp4 fallback) | Requires a secure context (HTTPS). Buttons hide automatically when unsupported; denial shows an in-app message. |
| Photo questions | `<input type="file" accept="image/*" capture>` | Mobile browsers open the camera; desktop opens a file picker. No permission prompt until used. |
| Location (weather advice) | `navigator.geolocation` | Requested only from the "Share Location" interstitial; blocked permission shows a recovery sheet. Requires HTTPS. |
| OTP autofill | Web OTP API (`navigator.credentials.get({ otp })`) | Chrome on Android only; everywhere else the 4-digit code is typed manually. |
| Share answer card | `navigator.share` with files | Falls back to a PNG download when unavailable. |

## Storage

All persisted state lives in `localStorage` under the `fc_sdk_` prefix and
never collides with host keys. Logout clears everything except the appearance
preference. When `localStorage` is unavailable the SDK degrades to in-memory
storage (session-only).

## Build

```bash
npm run typecheck   # tsc --noEmit (strict)
npm run build       # vite library build (ESM + CJS) + .d.ts
```
