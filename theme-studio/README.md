# FarmerChat Theme Studio

A **React + Vite + [shadcn/ui](https://ui.shadcn.com)** app to design a FarmerChat
SDK theme, preview it on live app screens, and get ready-to-paste
`FarmerChatConfig` + per-platform SDK setup. Three top-level tabs:

- **Studio** — edit the theme; preview it on shadcn-composed app screens; export config.
- **Gallery** — every installed shadcn/ui component rendered for reference.
- **Get SDK** — version-aware, per-platform setup: install command, your themed
  `initialize()` code, launch usage, a downloadable quick-start (`.md`), and source links.

> **v2 note:** the studio UI was rebuilt on shadcn/ui (Radix + Tailwind v4). The
> earlier v1 was a zero-dependency vanilla site served by `node server.js`; that
> is no longer the case — it now needs `npm install` and a build step.

## Run

```bash
cd theme-studio
npm install
npm run dev          # → http://localhost:4700  (Vite dev server, HMR)
```

Other scripts:

```bash
npm run build        # tsc -b + vite build → ./dist  (what Vercel deploys)
npm run preview      # serve the production build locally on :4700
npm run typecheck    # tsc -b --noEmit
npm run test:e2e     # Playwright end-to-end (builds, serves :4799, drives system Chrome)
```

### End-to-end tests

`e2e/theme-studio.spec.ts` drives the production build in the system Chrome
(`channel: "chrome"` — no Playwright browser download). Covers: the three tabs,
preset → export re-theming, per-platform export code, phone-screen navigation,
chat send, night mode, the Gallery, and the Get SDK download + deep-link params.
Run with `npm run test:e2e`.

## What it does

- **Pick a preset** theme, then fine-tune brand colors, shape (radii), typography,
  the floating button (FAB), and chat-message styling.
- **Live preview** of the app screens (now composed from shadcn/ui, themed via a
  token bridge) updates as you edit. It honors the SDK's real precedence rule:
  `config knob ?? theme token ?? built-in default`.
- **Pick a platform** (Web · React Native · Android · iOS) — the exported code
  switches to that platform's exact API.
- **Export**: *Copy code*, *Download snippet* (`.ts` / `.kt` / `.swift`), or
  *Download `theme.json`*.
- **Get SDK tab**: per-platform install + themed setup + a downloadable quick-start
  (`.md`) with your live config, plus links to the real source (repo / tag `ios-v1.0.0`).
  Only shipped versions are listed (`1.0.0` today) — see `src/lib/sdk.ts`.

### Using the export

- **Web / React Native** — paste the snippet, or import `theme.json` directly:
  ```ts
  import theme from './farmerchat-theme.json';
  FarmerChat.initialize(theme);
  ```
- **Android** — paste into `Application.onCreate`. Colors are ARGB ints
  (`0xFF……​.toInt()`). A custom font needs a `res/font` resource (`@FontRes`).
- **iOS** — paste into your `@main App` init. `Color(hex:)` ships in `FarmerChatCore`.

## Architecture

| Path | Role |
|---|---|
| `src/lib/theme.ts` | Frozen theme model, schema, and the 15 presets. |
| `src/lib/export.ts` | Platform code generators — **byte-verified** against the SDK (see below). |
| `src/lib/sdk.ts` | SDK download/setup metadata (versions, package ids, install, source links) — grounded in `INTEGRATION.md`; reuses `export.ts` for themed code. |
| `src/components/Controls.tsx` | Schema-driven controls, built from shadcn primitives. |
| `src/components/ExportPanel.tsx` | Platform picker + generated code + copy/download. |
| `src/components/PhonePreview.tsx` + `phone.css` | App screens composed from shadcn/ui, themed via a `ThemeState → shadcn token` bridge. Prior faithful SDK re-render kept in `PhonePreview.faithful.tsx.bak`. |
| `src/components/Gallery.tsx` | Reference gallery of all installed shadcn components. |
| `src/components/SdkDownloads.tsx` | "Get SDK" view — per-platform setup + themed quick-start downloads + source links. |
| `src/components/ui/*` | shadcn/ui components (added via `npx shadcn@latest add`). |

**shadcn/ui coverage:** button, card, tabs, select, slider, input, label, switch,
separator, badge, tooltip, scroll-area, sonner (toasts). The **phone preview is
intentionally *not* shadcn** — it simulates the SDK's own rendered UI, driven by
`--fc-*` CSS variables, so rebuilding it from shadcn primitives would misrepresent
what the SDK actually draws.

## Scope / honesty notes

- The configurable fields are **exactly the SDK's shipped, overridable surface**.
  `aiBubbleColor` / `aiAvatarEmoji` / `showUserAvatar` are intentionally absent —
  they are not shipped (see `../docs/04-parity-matrix.md`), so the studio never
  generates config a platform can't consume.
- The export generators are a **verbatim port** of the v1 tool and were verified
  **byte-for-byte** against golden fixtures across the full matrix (default preset,
  all-optional-knobs-set, all-empty) × {web, rn, android, ios} + `theme.json`.
- The preview is **one approximate shared design** — the SDK renders consistently
  across platforms; the platform tabs change the exported code, not the render.
- **Dark mode is a preview toggle only** in v1/v2; the export is the light theme.
  (The separate studio-chrome light/dark toggle only restyles the studio itself.)
- Generated snippets are verified against the SDK's API shapes; they are **not**
  compiled against a host app here.
