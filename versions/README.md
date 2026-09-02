# Versions

The SDK ships as **one codebase, multiple published versions**. There is no `v1/` or `v2/`
source tree — `android/`, `ios/`, `react-native/` and `web/` are the only implementations, and a
version is a *release* of them, not a copy.

| Version | Chat transport | Status |
|---|---|---|
| **1.0.0** | Synchronous JSON (`get_answer_for_text_query`, endpoint #27) | Shipped; verified on device inside RationSmart |
| **2.0.0** | Agentic SSE streaming (`get_answer_for_text_query_agentic`) | In progress — see [v2/](v2/) |

## Why not a `v2/` source copy

A full copy of all eight packages duplicates roughly 40,000 lines. Every fix then has to be made
twice, and the two trees drift. The eight fixes landed on 2026-09-01 alone — the blank
`country_code` guard, the duplicate-key chat-history crash, IME insets, drawer order, the label
bootstrap, the plotline filter, the guest-home location seed, the greeting fallback — would each
have needed applying in two places.

Instead, agentic streaming lands **behind a config flag** in the existing codebase. A host that
does nothing keeps the 1.0.0 behaviour; a host that opts in gets the streaming chat.

## How a host picks a version

Version selection is what package registries already do. Once published:

```kotlin
// Android — synchronous chat
implementation("org.digitalgreen.farmerchat:farmerchat-android-views:1.0.0")

// Android — agentic streaming
implementation("org.digitalgreen.farmerchat:farmerchat-android-views:2.0.0")
```

```jsonc
// npm
"@digitalgreenorg/farmerchat-web": "^1.0.0"   // or "^2.0.0"
```

```swift
// Swift Package Manager — resolved from a git tag
.package(url: "…/farmerchat-sdk-suite.git", from: "1.0.0")
```

A host on 1.0.0 keeps receiving patch releases (1.0.x) for bug fixes, because the fixes live in
the same code. That is the whole point of not forking.

> **Blocked:** none of the above works yet. Nothing is published to any registry and the repo has
> no git remote — see [../docs/10-distribution-and-integration.md](../docs/10-distribution-and-integration.md).
> Publishing 1.0.0 is the prerequisite for offering a choice of versions at all.
