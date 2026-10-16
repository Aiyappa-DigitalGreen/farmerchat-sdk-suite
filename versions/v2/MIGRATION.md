# Migrating from FarmerChat SDK 1.x to 2.x

2.x lives in `versions/v2/`; 1.x is the top-level `android/`, `ios/`, `react-native/`, `web/`.
Everything below comes from diffing the two trees' `FarmerChatConfig` and public entry points.
Read the **Behaviour changes** section even if your code compiles: three defaults changed.

## 1. Update the dependency

| Platform | 1.x | 2.x |
|---|---|---|
| Android | `org.digitalgreen.farmerchat:farmerchat-android-{compose,views}:1.1.0` | `io.github.aiyappa-digitalgreen:farmerchat-android-{compose,views}:2.2.0` (**new group**, from Maven Central; optional `farmerchat-analytics-posthog`) |
| iOS | `FarmerChatCore` / `FarmerChatSwiftUI` / `FarmerChatUIKit` 1.x | same packages, 2.2.0 (tag `ios-v2.2.0`) |
| React Native | `@digitalgreenorg/farmerchat-react-native@1.x` | `@2.2.0` |
| Web | `@digitalgreenorg/farmerchat-web@1.x` | `@2.2.0`; new script-tag widget `@digitalgreenorg/farmerchat-widget` |

## 2. Breaking changes (code will not compile, or will silently misbehave)

| 1.x | 2.x | What to do |
|---|---|---|
| Maven group `org.digitalgreen.farmerchat` | `io.github.aiyappa-digitalgreen` (Android) | Change the group in your dependency lines. Artifact names and Kotlin package names (`org.digitalgreen.farmerchat.sdk…`) are unchanged, so imports stay the same. |
| `guestApiKey` | `farmerChatApiKey` | Rename. The old name was removed with no alias. Both keys are now built in, so most hosts can delete the line entirely. |

## 3. Behaviour changes (same code, different result)

| Setting | 1.x default | 2.x default | Keep the 1.x behaviour with |
|---|---|---|---|
| `mode` | `FULL_JOURNEY` (onboarding → home → chat) | `CHAT_ONLY` (language once, then straight into chat) | `mode = FULL_JOURNEY` |
| `showDrawer` / `showHistory` | `true` | unset → follow `mode` (on for `FULL_JOURNEY`, off for `CHAT_ONLY`) | set them explicitly |
| Analytics events to your listener | always delivered (no switch existed) | **off**: `enableAnalytics = false` | `enableAnalytics = true` |

The analytics one is the easy miss: a 1.x host that forwarded events to its own analytics gets
nothing after upgrading until it sets `enableAnalytics = true`.

## 4. New in 2.x (all optional)

- **Agentic chat**: `enableAgenticChat` (streams `text/event-stream` answers from the agentic
  endpoint; endpoint #27 keeps the synchronous 1.0.0 contract when this is off).
- **Composer UI** `enableComposerUi`, `minSplashDurationMs`.
- **Host hooks**: `onExit` (the chat-only close), `onUserIdentified`, `onUserAttribute`.
- **Lifecycle (2.2.x)**: `FarmerChat.shutdown()`, `FarmerChat.clearAllData()` (local wipe, including
  tokens and appearance; no server call), and a repeat `initialize` that is a no-op unless
  `environment`, `mode` or `showDrawer`/`showHistory`/`showSettings` change, on every platform.
- **Diagnostics**: `debugLogging` on every platform. Off by default: release builds log nothing.
- **Links**: `onLinkClick(url) -> handled` on web, React Native and iOS SwiftUI, for links in chat
  answers. Only `http(s)` links are tappable anywhere.
- **iOS privacy manifests** ship in all three packages; you still own the Info.plist usage strings.

## 5. Checklist

1. Bump the dependency.
2. Rename `guestApiKey` → `farmerChatApiKey`, or delete it.
3. Decide `mode` deliberately; set `FULL_JOURNEY` to keep the 1.x journey.
4. Set `enableAnalytics = true` if you consume SDK events.
5. In `CHAT_ONLY` hosts, implement `onExit` to remove the SDK view when the user closes chat.
