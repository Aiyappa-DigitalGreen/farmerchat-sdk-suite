# @digitalgreenorg/farmerchat-widget

An Intercom-style widget for the **complete** FarmerChat web SDK. It adds a launcher bubble pinned
to a corner of the page. Clicking it opens FarmerChat in a floating panel: by default straight into
the chat (the SDK's `CHAT_ONLY` default — voice and photos, and the language button in the chat bar;
a first-time visitor picks a language once before the chat);
pass `mode: 'FULL_JOURNEY'` for the whole journey (onboarding, Home, drawer, settings). On phones
the panel becomes a full-screen sheet. In chat-only mode each page load starts a new conversation; closing and
reopening the panel keeps the current one (the panel stays mounted).

It wraps the v2 web SDK (`../packages/farmerchat-web`, a `file:` dependency, so no source is copied).
Every SDK config field works unchanged, including `enableAgenticChat`.

**Live demo:** https://farmerchat-sdk-suite.vercel.app/demo/, a sample host page with the widget against the
stage backend (agentic chat on, answers stream). Version 2.2.0, the same as every v2 platform.

## Requirements

| | Minimum |
|---|---|
| Browser | Chrome / Edge 87+, Firefox 78+, Safari 14+ (iOS 14+). Pinned as the build target. |
| React | none for the script tag: the widget bundles its own. React hosts using the ESM build need React 18. |
| Best appearance | Chrome / Edge 111+, Firefox 113+, Safari 16.2+. Older browsers show a few decorative tints as plain colours. |
| Voice input | Safari 14.1+ (iOS 14.5+) and current Chrome, Edge, Firefox. Where recording is unsupported, the mic button is hidden. |
| HTTPS | Required for voice, camera and location (browsers allow `localhost` for development). |
| Content-Security-Policy | If your site sets one, allow requests to the FarmerChat API domain and `www.googleapis.com` (location lookup). |
| Storage | localStorage; in private browsing it falls back to memory, so the user signs in again next visit. |
| Download size | about 238 KB gzipped for the script-tag bundle (`npm run size:check`) |

There is no minimum RAM or CPU: if the device runs the OS or browser version above, the SDK runs. Full matrix for every platform: the integration guide's "What your app needs" section.

## Drop-in: one script tag (any website, no React needed)

```html
<script>
  window.farmerChatWidgetSettings = {
    config: {
      environment: 'demo',
      // No keys needed: the FarmerChat API key and the geolocation key are built into the SDK
      // (optional overrides: farmerChatApiKey, geoApiKey).
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
// No keys needed: farmerChatApiKey and geoApiKey are built in (pass them only to override).
const FC_CONFIG: FarmerChatConfig = { environment: 'demo' };

export function App() {
  return <FarmerChatWidget config={FC_CONFIG} launcherLabel="Ask FarmerChat" />;
}
```

```bash
npm install @digitalgreenorg/farmerchat-widget @digitalgreenorg/farmerchat-web react react-dom
```

The ESM build keeps `react`, `react-dom` and `@digitalgreenorg/farmerchat-web` external, so it
uses your app's copies (they are peer dependencies). The widget is built and verified against the
**v2** web SDK, which now publishes as `2.2.0` (the same version as every v2 platform); the
peer range is `^2.2.0`. See docs/05.

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
`FC_GUEST_API_KEY` is the FarmerChat API key the SDKs carry (`DEFAULT_FARMERCHAT_API_KEY`); the
proxy adds it only when the request has no `API-Key`. The SDK now sends its built-in key itself, so
the proxy's injection is a fallback.

Demo against the local mock backend:

```bash
node ../../../../tools/mock-server/server.js &      # :8899
python3 -m http.server 5182                          # from this folder
open http://localhost:5182/demo/index.html           # desktop
open http://localhost:5182/demo/mobile.html          # 390×760 phone frame (fullscreen layout)
```

`demo/index.html` reads `?env=`, `?base=`, `?geoKey=` (optional override; a key is built in),
`?mode=FULL_JOURNEY` (default is the SDK's `CHAT_ONLY`), `?left=1` and `?label=` from the URL.

## Hosted demo on Railway (retired 2026-10-22)

Railway took the service down on 2026-10-22; the site now runs on Vercel (next section) at
**https://farmerchat-sdk-suite.vercel.app** (`/` is the guide, `/demo/` the widget demo; add
`?replay=1` for the recorded streaming answer). `railway/server.mjs` still runs the same site locally.

The demo was served by `versions/v2/web/railway/server.mjs`, a zero-dependency Node server:
- `/demo/` serves the demo pages;
- `/dist/` serves the widget script and `illustrations/`;
- `/stage/*` and `/stage-replay/*` go through the same proxy handler as the Vercel version
  (`vercel/api/stage.js`);
- `/healthz` is the health check.

The Railway service (project `farmerchat-widget`, Digital Green Foundation) builds from GitHub
`main` with **root directory `/versions/v2`**, health check `/healthz` and a generated domain on port 8080. That root is needed because the widget build copies
its illustrations from the Android SDK assets. Railway runs `versions/v2/package.json`: `build`
compiles the SDK then the widget, and `start` runs the server.

Deployment happens only through GitHub: push to `main` and Railway builds it. Never deploy by hand
(repo `CLAUDE.md` §8).

To test it locally, the same way Railway runs it:

```bash
cd versions/v2 && npm run build && PORT=8920 npm start   # http://localhost:8920/demo/
```

## Hosted site on Vercel (GitHub CI/CD, since 2026-10-22)

Railway took the service down on 2026-10-22 ("Application not found"), so the same site now
builds on Vercel from GitHub. Vercel's GitHub integration builds every push to `main`; nobody
deploys by hand and no Vercel token lives in this repo or in CI (repo `CLAUDE.md` §8).

| File | What |
|---|---|
| `versions/v2/vercel.json` | build = `npm run build && node web/vercel-site.mjs`, output `vercel-out/`, the `/stage` rewrites, security headers, `Access-Control-Allow-Origin: *` on `/dist/` |
| `versions/v2/web/vercel-site.mjs` | assembles the static twin of `railway/server.mjs`: `/` + `/guide/` (guide), `/showcase/`, `/app/`, `/demo/` (index + mobile only), `/dist/` |
| `versions/v2/api/stage.js` | re-exports `vercel/api/stage.js`, the one proxy shared with the Railway server |
| `versions/v2/api/healthz.js` | `/healthz` → `ok` |

The proxy (`vercel/api/stage.js`) forwards to the fixed DEMO host only, adds the guest `API-Key`
on the two guest endpoints from the `FC_GUEST_API_KEY` env var (set in the Vercel project by its
owner, never in a file), streams responses, and refuses the OTP endpoints with 403 on the
resolved upstream path, so phone login cannot be driven through it on either host.
`/stage-replay/*` is the same except the agentic answer plays a recorded stream (`vercel/api/_replay.js`).
The rewrite uses `/stage/:path(.*)` because `:path*` does not match URLs ending in `/`, and every
FarmerChat endpoint ends in `/`.

Live: **https://farmerchat-sdk-suite.vercel.app** (Vercel project `farmerchat-sdk-suite`, imported
2026-10-22: Root Directory `versions/v2`, Framework Preset "Other"; `vercel.json` supplies the rest).
No environment variable is set: the SDK sends its built-in guest key itself, and the proxy only adds
`FC_GUEST_API_KEY` when a request lacks one. Verified live: guest calls through `/stage/` return 200
and every OTP variant returns 403.

Local check, the same build Vercel runs:

```bash
cd versions/v2 && npm run build && node web/vercel-site.mjs   # → versions/v2/vercel-out
```

`vercel/prepare.mjs` is the older single-widget assembly from the deleted `farmerchat-widget`
project (2026-10-09); it is not used.

## Verification (2026-10-08)

- `tsc --noEmit` and both `vite build`s are clean. The IIFE carries a single React copy (checked
  in the source map).
- Runtime-checked in Chrome against `tools/mock-server` from a plain HTML host with no React:
  open → language → skip name → Home; close/reopen kept Home; `open(question)` produced a chat
  answer; Esc closed; host page styles untouched; 390 px viewport → fullscreen with the drawer
  contained.
- **Not verified:** the real backend, voice/camera permission prompts inside the panel,
  Safari/Firefox.
