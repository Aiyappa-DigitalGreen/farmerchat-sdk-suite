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

`farmerchat-widget.iife.js` bundles React, ReactDOM and the SDK (≈118 kB gzip). If you'd rather
boot later, skip the settings object and call `FarmerChatWidget.boot({ config: {...} })` yourself.

Configuration is JavaScript, not `data-*` attributes, because callbacks such as `onEvent`,
`tokenProvider` and `onSessionExpired` are functions.

## JavaScript API (`window.FarmerChatWidget`)

```js
FarmerChatWidget.boot(options)        // mount (a second boot updates instead of stacking)
FarmerChatWidget.update(options)      // re-render with new options; the open panel keeps its state
FarmerChatWidget.open()               // open the panel
FarmerChatWidget.open('How do I treat leaf blight?')  // open straight into a chat with this question
FarmerChatWidget.close()
FarmerChatWidget.toggle()
FarmerChatWidget.isOpen()
FarmerChatWidget.shutdown()           // unmount the widget entirely
FarmerChatWidget.sdk                  // the SDK statics: logout(), sendQuestion(), openScreen(),
                                      // isAuthenticated(), onAuthStateChanged(), updateTokens() …
```

Calls made before the widget mounts are queued and replayed.

## React hosts

```tsx
import { FarmerChatWidget } from '@digitalgreenorg/farmerchat-widget';

<FarmerChatWidget config={{ environment: 'prod', guestApiKey, geoApiKey }} launcherLabel="Ask FarmerChat" />
```

The ESM build keeps `react`, `react-dom` and `@digitalgreenorg/farmerchat-web` external, so your
app's copies are used. Keep the `config` object stable (useMemo or a module constant). When its
identity changes, the SDK rebuilds its services.

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
| `hideLauncher` | `false` | drive the widget from your own button with the API |
| `defaultOpen` | `false` | |
| `preload` | `false` | mount the SDK on page load instead of first open (saves the splash, costs guest-init requests up front) |
| `zIndex` | `2147483000` | |
| `onOpen` / `onClose` | — | widget state callbacks. These are **not** analytics events; the SDK's event names are unchanged |

## Behaviour

- **Closing hides the panel; it does not unmount it.** The conversation, scroll position and
  screen stack are there when the panel reopens. (`FarmerChatFab` unmounts, so it replays the
  splash every time.) The SDK mounts lazily on first open unless `preload` is set.
- **Layout.** `src/layout.ts → shouldUseFullscreen()` decides when the panel becomes a full-screen
  sheet. It runs on mount and on every resize. In fullscreen the launcher hides, since it would
  cover the composer, and a slim bar above the SDK carries the close chevron.
- **Isolation.** The widget's classes are all `fcw-` prefixed and the SDK's are `.fcsdk-`. Neither
  styles the host page. The panel is the containing block (`transform`) for anything positioned
  inside it, so SDK overlays such as the drawer, modals and location prompt stay inside the panel.
- **Keyboard and accessibility.** Esc closes the panel. Focus moves into the panel on open and
  back to the launcher on close. The launcher carries `aria-expanded` / `aria-controls`.
- **One widget per page.** The SDK holds page-level singleton state.

## Develop

```bash
npm install && npm approve-scripts esbuild && npm rebuild esbuild   # this repo's npm blocks postinstall
(cd ../packages/farmerchat-web && npm run build)                    # the widget consumes the SDK's dist
npm run build          # dist/farmerchat-widget.js (ESM) + dist/farmerchat-widget.iife.js + d.ts
npx tsc --noEmit
```

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
