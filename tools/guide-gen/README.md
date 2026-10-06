# SDK integration-guide generator

Single source for the FarmerChat SDK integration guide, in both places it is published:

| Output | Path | Checked in |
|---|---|---|
| Shareable HTML page (the artifact) | `tools/guide-gen/farmerchat-sdk-docs.html` | no — generated |
| Theme Studio "Get SDK" tab content | `theme-studio/src/lib/guide.data.json` | **yes** — the Vite build imports it |

Run it:

```bash
python3 tools/guide-gen/build.py            # both outputs
python3 tools/guide-gen/build.py /tmp/x.html  # HTML elsewhere; JSON path is fixed
```

Because both outputs come from the same `PLATFORMS` model, the artifact and the
Studio cannot drift apart. Edit content in `content.py` / `plat_*.py` and re-run —
never hand-edit the JSON or the HTML.

## Layout

- `content.py` — blocks shared by every platform (permissions, the `FarmerChatConfig`
  table, distribution notes). Every platform carries the **same ordered section list**,
  so format parity across the seven flavours is structural, not hand-maintained.
- `plat_android.py` — `COMPOSE`, `VIEWS`
- `plat_ios.py` — `SWIFTUI`, `UIKIT`, `OBJC`
- `plat_js.py` — `RN`, `WEB`
- `build.py` — renders HTML (with build-time syntax highlighting) and dumps the JSON
- `shell.html`, `style.css`, `enhance.js` — the HTML page shell

## Rules

Per the root `CLAUDE.md` no-hallucination rules, everything here must be derivable
from the SDK trees.

**Versions differ per platform — never state one globally.** Android publishes
**2.0.0** (root `versions/v2/android/build.gradle.kts` `farmerChatVersion`; the
`VERSION_NAME=1.0.0` in `gradle.properties` is a dead value that nothing reads —
confirm against the published POM). The iOS podspec, web `core/version.ts` and the
RN `package.json` still declare **1.0.0**, so iOS install snippets pin `1.0.0` /
`~> 1.0` and the git tag is `ios-v1.0.0`. `theme-studio/src/lib/sdk.ts` enforces the
same rule at runtime via `resolveVersion()`.

The syntax highlighter stashes tokens behind `\0N\0` placeholders. They must not be
space- or digit-delimited: an earlier version used ` N ` and collided with real
digits in the samples (`minSdk 26`, a `999` radius).
