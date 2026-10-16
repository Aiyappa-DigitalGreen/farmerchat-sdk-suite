# SDK integration-guide generator

Single source for the FarmerChat SDK integration guide, in both places it is published:

| Output | Path | Checked in |
|---|---|---|
| Hosted guide (served at `/` and `/guide/` by `versions/v2/web/railway/server.mjs`) | `versions/v2/web/railway/guide/index.html` | **yes** — Railway serves it as is |
| Theme Studio "Get SDK" tab content | `theme-studio/src/lib/guide.data.json` | **yes** — the Vite build imports it |

Run it:

```bash
python3 tools/guide-gen/build.py            # both outputs
python3 tools/guide-gen/build.py /tmp/x.html  # HTML elsewhere; JSON path is fixed
```

Both outputs come from the same `PLATFORMS` model, so the hosted guide and the Studio cannot
drift apart. Edit content here and re-run — never hand-edit the JSON or `guide/index.html`
(the next build overwrites it). Check the page with
`PORT=<port> node versions/v2/web/railway/server.mjs` and open `/guide/`.

## Layout

- `content.py` — `VERSION` / `MAVEN_GROUP`, and the blocks shared by every platform
  (release status, permissions, the `FarmerChatConfig` table, chat-only and analytics notes).
  Every platform carries the **same ordered section list**, so format parity across the seven
  flavours is structural, not hand-maintained.
- `plat_android.py` — `COMPOSE`, `VIEWS`
- `plat_ios.py` — `SWIFTUI`, `UIKIT`, `OBJC`
- `plat_js.py` — `RN`, `WEB`
- `build.py` — renders the page (build-time syntax highlighting), the platform rail, and the
  three-step quick start, and dumps the JSON. `SITE` holds each platform's rail icon, short name
  and its three quick-start steps; a step names a SUB heading and reuses that heading, the
  paragraph after it (launch steps only) and the first tab of the next code block, so the quick
  start always matches the full guide.
- `site.html` — the page around the guide: top bar, hero, "What farmers get", "How it works",
  the plain-HTML widget section, requirements, FAQ, footer. Placeholders: `{{CSS}}`, `{{JS}}`,
  `{{HERO_IMG}}`, `{{STEP_CHIPS}}`, `{{STEP_LISTS}}`, `{{RAIL}}`, `{{BODY}}`, `{{VERSION}}`.
- `style.css`, `enhance.js` — inlined into the page.
- `hero-chat.webp` — the hero phone screenshot, inlined as a data URI.

## Rules

Per the root `CLAUDE.md` no-hallucination rules, everything here must be derivable from the SDK
trees — API names, config fields, environments, install lines, requirements.

- **Version.** Every v2 package is **2.2.0** (`content.py` `VERSION`): Android
  `versions/v2/android/build.gradle.kts` `farmerChatVersion`; iOS `DeviceInfoProvider.swift` and
  `FarmerChatUIKit.podspec` (git tag `ios-v<version>`); RN `package.json`; web `package.json` +
  `src/core/version.ts`. Bump all of them together, then `VERSION`, then re-run.
- **Distribution.** Android resolves from Maven Central as `io.github.aiyappa-digitalgreen`
  (`farmerChatGroup`); the first release is still being set up, so the guide keeps the
  `mavenLocal()` fallback. iOS, React Native and web are not on CocoaPods / SPM / npm and the repo
  has no tags, so their installs are local-path installs.
- **Environment.** Every example uses `DEMO`. Never `PROD`.
- **Keys.** `farmerChatApiKey` / `geoApiKey` are optional (the SDK bundles both). `guestApiKey`
  no longer exists (renamed in 2.2.0, no alias); the build fails if it appears in the output.
- `theme-studio/src/lib/sdk.ts` carries the same version and distribution facts for the Studio.

The syntax highlighter stashes tokens behind `\0N\0` placeholders. They must not be
space- or digit-delimited: an earlier version used ` N ` and collided with real
digits in the samples (`minSdk 26`, a `999` radius). `theme-studio/src/lib/guide.ts` has a TS
copy of the highlighter; keep the two in step.
