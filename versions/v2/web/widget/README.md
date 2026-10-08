# @digitalgreenorg/farmerchat-widget

An Intercom-style widget for the **complete** FarmerChat web SDK. It adds a launcher bubble pinned
to a corner of the page. Clicking it opens the whole FarmerChat journey (onboarding, Home, chat,
voice, photos, history, settings) in a floating panel. On phones the panel becomes a full-screen sheet.

It wraps the v2 web SDK (`../packages/farmerchat-web`, a `file:` dependency, so no source is copied).
Every SDK config field works unchanged, including `enableAgenticChat`.

## Drop-in: one script tag (any website, no React needed)

```html
<script>
  window.farmerChatWidgetSettings = {
    config: {
      environment: 'prod',
      guestApiKey: 'YOUR_GUEST_KEY',
      geoApiKey: 'YOUR_GOOGLE_GEO_KEY',
      onEvent: function (name, props) { /* forward to your analytics */ },
    },
    // optional: position: 'bottom-left', launcherLabel: 'Ask FarmerChat', panelWidth: 420
  };
</script>
<script src="https://your-cdn/farmerchat-widget.iife.js"></script>
```

`farmerchat-widget.iife.js` bundles React, ReactDOM, the SDK and its Roboto font (≈238 kB gzip).
**Deploy the `illustrations/` folder from `dist/` beside it** — the full-screen messages (sign up,
errors, location) load their farmer pictures from there (the script finds its own folder; override
with `config.assetBaseUrl`). If you'd rather
boot later, skip the settings object and call `FarmerChatWidget.boot({ config: {...} })` yourself.

Configuration is JavaScript, not `data-*` attributes, because callbacks such as `onEvent`,
`tokenProvider` and `onSessionExpired` are functions.

## JavaScript API (`window.FarmerChatWidget`)

```js
FarmerChatWidget.boot(options)        // mount (a second boot updates instead of stacking)
FarmerChatWidget.update(options)      // merge new options; omit `config` to keep the live session
FarmerChatWidget.open()               // open the panel
FarmerChatWidget.open('How do I treat leaf blight?')  // open straight into a chat with this question
FarmerChatWidget.close()
FarmerChatWidget.toggle()
FarmerChatWidget.isOpen()
FarmerChatWidget.shutdown()           // unmount the widget entirely
FarmerChatWidget.sdk                  // the SDK statics: logout(), sendQuestion(), openScreen(),
                                      // isAuthenticated(), onAuthStateChanged(), updateTokens() …
```

Calls made before the widget mounts are queued and replayed. The SDK is initialized during
`boot()`. That step is synchronous and makes no requests, so `FarmerChatWidget.sdk.logout()`,
`isAuthenticated()` and `onAuthStateChanged()` work even on a page load where the user never
opens the panel. **Call `sdk.logout()` from your own sign-out** so the previous user's FarmerChat
session does not stay on a shared device.

`update({ position: 'bottom-left' })` keeps the conversation. Passing a **new `config` object**
rebuilds the SDK services and remounts the panel, so pass `config` only when it actually changed.

## React hosts

```tsx
import { FarmerChatWidget, type FarmerChatConfig } from '@digitalgreenorg/farmerchat-widget';

// A module constant (or useMemo): a new config object rebuilds the SDK and remounts the panel.
const FC_CONFIG: FarmerChatConfig = { environment: 'prod', guestApiKey: GUEST_KEY, geoApiKey: GEO_KEY };

export function App() {
  return <FarmerChatWidget config={FC_CONFIG} launcherLabel="Ask FarmerChat" />;
}
```

```bash
npm install @digitalgreenorg/farmerchat-widget @digitalgreenorg/farmerchat-web react react-dom
```

The ESM build keeps `react`, `react-dom` and `@digitalgreenorg/farmerchat-web` external, so it
uses your app's copies (they are peer dependencies). The widget is built and verified against the
**v2** web SDK. Both web lines currently publish as `1.0.0`, so the peer range cannot enforce
that; see docs/05.

## Options

| Option | Default | |
|---|---|---|
| `config` | — (required) | `FarmerChatConfig`, passed to the SDK. `onExit` also collapses the panel. |
| `position` | `'bottom-right'` | or `'bottom-left'` |
| `horizontalPadding` / `verticalPadding` | `20` / `20` | px from the viewport edges |
| `panelWidth` / `panelHeight` | `400` / `680` | floating panel size, clamped to the viewport |
| `launcherColor` | `config.fabBackgroundColor` → `theme.colors.brandPrimary` → `#146152` | |
| `launcherIconColor` | `config.fabContentColor` → `theme.colors.onBrand` → white | |
| `launcherLabel` | `config.fabLabel` | adds text beside the icon (extended launcher) |
| `launcherIcon` | `theme.logo` → chat bubble | React node (ESM only) |
| `hideLauncher` | `false` | drive the widget from your own button with the API; the panel then shows its own close bar |
| `defaultOpen` | `false` | opens on load without taking focus from the page |
| `preload` | `false` | mount the SDK on page load instead of first open (saves the splash, costs guest-init requests up front) |
| `zIndex` | `2147483000` | |
| `onOpen` / `onClose` | — | widget state callbacks. These are **not** analytics events; the SDK's event names are unchanged |

## Behaviour

- **Closing hides the panel; it does not unmount it.** The conversation, scroll position and
  screen stack are there when the panel reopens. (`FarmerChatFab` unmounts, so it replays the
  splash every time.) The SDK mounts lazily on first open unless `preload` is set.
- **Closing stops live media.** The SDK is rendered with `active={open}`: on close a voice
  recording in progress is cancelled (discarded, never sent) and any answer being read aloud or
  voice clip playing is paused. Nothing resumes on its own.
- **Layout.** See below.
- **Isolation.** The widget's classes are all `fcw-` prefixed and the SDK's are `.fcsdk-`. Neither
  styles the host page. The panel is the containing block (`transform`) for anything positioned
  inside it, so SDK overlays such as the drawer, modals and location prompt stay inside the panel.
- **Keyboard and accessibility.** Esc first dismisses the topmost SDK layer (drawer, bottom sheet,
  terms dialog); with none open it closes the panel. The location-permission modal is left to its
  own buttons. Focus moves into the panel when the user opens it and back to the launcher on close.
- **Scroll containment.** Scrolling past the end of an SDK list does not scroll the host page
  (`overscroll-behavior: contain`, scoped to the panel). The launcher carries `aria-expanded` / `aria-controls`.
- **Deep links survive re-boots.** `open(question)` hands the question to the SDK in an effect
  after the SDK root mounts, so it is not lost after a `shutdown()` → `boot()` cycle.
- **One widget per page.** The SDK holds page-level singleton state.

## Layout

`src/layout.ts → shouldUseFullscreen(viewportWidth, viewportHeight, panelWidth, panelHeight)`
decides when the floating panel becomes a full-screen sheet. It runs on mount and on every
resize or orientation change. In fullscreen the launcher hides, since it would cover the
composer, and a slim bar above the SDK carries the close chevron. The shipped policy:
fullscreen when the viewport is narrower than the panel plus 80 px, **or** shorter than
560 px (`FULLSCREEN_MAX_HEIGHT`) — so a landscape phone gets the full sheet instead of a
~300 px floating panel.

Things to weigh when tuning it:

- **Tablets near the cutoff.** A 768 px portrait tablet fits a 400 px panel comfortably, but a
  floating panel over a tablet page can feel odd. Intercom keeps it floating.
- **Slack.** The `+ 80` leaves room for the side paddings and some page behind the panel. Less
  slack makes a cramped panel; more sends small laptops to fullscreen.

## Develop

```bash
npm install && npm approve-scripts esbuild && npm rebuild esbuild   # this repo's npm blocks postinstall
(cd ../packages/farmerchat-web && npm run build)                    # the widget consumes the SDK's dist
npm run build          # dist/farmerchat-widget.js (ESM) + dist/farmerchat-widget.iife.js + d.ts
npx tsc --noEmit
```

The UI is the compose module's, ported and measured screen by screen (docs/04 "Web v2
compose-fidelity pass"; harness in `tools/fidelity/web/`).

Demo servers (they do not outlive the terminal; start them from the repo root):

```bash
python3 -m http.server 5182 --directory versions/v2/web/widget          # the demo pages
node tools/mock-server/server.js                                          # :8899 mock backend
FC_GUEST_API_KEY=<key> node versions/v2/web/widget/demo/stage-proxy.mjs   # :8898 real stage backend
```

- `http://localhost:5182/demo/index.html` (mock) · `…/index.html?stage=1` (stage, agentic)
- `http://localhost:5182/demo/mobile.html` — 390×760 phone frame
- `http://localhost:5182/demo/fidelity.html` — 411×914 harness (`?appearance=night`, `?theme=blue`, `?agentic=0`)

The stage proxy is needed because the backend's CORS preflight rejects the SDK's custom headers.
`FC_GUEST_API_KEY` is the guest key the Android SDK carries (`ApiConstants.DEFAULT_GUEST_USER_API_KEY`);
it is injected server-side so it never lands in a page.

Demo against the local mock backend:

```bash
node ../../../../tools/mock-server/server.js &      # :8899
python3 -m http.server 5182                          # from this folder
open http://localhost:5182/demo/index.html           # desktop
open http://localhost:5182/demo/mobile.html          # 390×760 phone frame (fullscreen layout)
```

`demo/index.html` reads `?env=`, `?base=`, `?guestKey=`, `?geoKey=`, `?mode=CHAT_ONLY`, `?left=1`
and `?label=` from the URL. Do not commit keys into the page.

## Verification (2026-10-08)

- `tsc --noEmit` and both `vite build`s are clean. The IIFE carries a single React copy (checked
  in the source map).
- Runtime-checked in Chrome against `tools/mock-server` from a plain HTML host with no React:
  open → language → skip name → Home; close/reopen kept Home; `open(question)` produced a chat
  answer; Esc closed; host page styles untouched; 390 px viewport → fullscreen with the drawer
  contained.
- **Not verified:** the real backend, voice/camera permission prompts inside the panel,
  Safari/Firefox.
