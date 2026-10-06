# Versions

Each version is a **complete, self-contained SDK** — all four platforms, buildable and publishable
on its own. A host picks a version and gets the whole flow for it, not a base plus patches.

```
farmerchat-sdk-suite-fcs2026/
  android/  ios/  react-native/  web/     v1.0.0  — synchronous chat
  versions/
    v2/
      android/  ios/  react-native/  web/  v2.0.0 — agentic streaming
```

| Version | Chat transport | Source of truth |
|---|---|---|
| **1.0.0** | Synchronous JSON — endpoint #27 | `fc-compose` @ `9f5e4ca` (app v4.0.3) |
| **2.0.0** | Agentic SSE streaming — endpoint #27a | `fc-compose-agentic` @ `193dbd64` (app v4.1.3, versionCode 108) |

## Picking a version

Both publish to the same group with different versions, so they resolve side by side:

```kotlin
// v1 — synchronous chat
implementation("org.digitalgreen.farmerchat:farmerchat-android-views:1.0.0")

// v2 — agentic streaming
implementation("org.digitalgreen.farmerchat:farmerchat-android-views:2.0.0")
```

Verified locally — `publishToMavenLocal` from each tree produces:

```
farmerchat-core/1.0.0            farmerchat-core/2.0.0
farmerchat-android-views/1.0.0   farmerchat-android-views/2.0.0
farmerchat-android-compose/1.0.0
```

## Building a version

Each tree is a standalone project. From `android/` for v1, or `versions/v2/android/` for v2:

```bash
./gradlew :farmerchat-core:assembleDebug
./gradlew :farmerchat-core:testDebugUnitTest
./gradlew :farmerchat-core:publishToMavenLocal
```

## The cost of this layout, stated plainly

The two trees are independent copies, so **a fix made in one does not reach the other.** Anything
found in v1 must be applied to `versions/v2/` as well, and vice versa. The 2026-09-01 fixes —
the blank `country_code` guard, the duplicate-key chat-history crash, IME insets, drawer order,
the label bootstrap, the plotline filter, the guest-home location seed, the greeting fallback —
are all present in **both** trees because v2 was branched after them. Fixes made from now on are
not, unless applied twice.

`docs/04-parity-matrix.md` remains the single ledger for both versions.

## Versioning discipline

- **v1 is frozen** apart from bug fixes. No agentic code belongs in it.
- v2 carries the agentic transport and the new flow, and inherits every v1 screen it does not
  change — which is what makes it a complete SDK rather than a delta.
