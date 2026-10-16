# Changelog

All notable changes to the FarmerChat SDK suite. Built from the git history and `docs/04-parity-matrix.md`.
The 2.x line lives in `versions/v2/` (Android, iOS, React Native, Web, widget); 1.x is the top-level
`android/`, `ios/`, `react-native/`, `web/`. Upgrading from 1.x: see `versions/v2/MIGRATION.md`.

## [Unreleased]

### Added (v2, all four platforms unless noted)
- iOS FarmerChatCore: `ChatViewModel.sendAlignmentChip` and `LabelManager.answerGenerationTips()`.
- `FarmerChat.shutdown()`: tears the SDK down; persisted data and host auth listeners are kept.
- `FarmerChat.clearAllData()`: local-only wipe of every `fc_sdk_` item including tokens and appearance.
  There is no server-side delete. React Native returns a Promise.
- `debugLogging` config on iOS, React Native and Web (Android already had it): one line per HTTP
  request (method, path, status, duration, request id). Off by default.
- `onLinkClick(url) -> handled` config hook for links in chat answers (Web, React Native, iOS SwiftUI).
- `FarmerChat.isInitialized()` on Web; static `onAuthStateChanged` on iOS and React Native.
- Apple privacy manifests (`PrivacyInfo.xcprivacy`) in FarmerChatCore, FarmerChatSwiftUI and
  FarmerChatUIKit (v1 and v2), wired into SPM and the CocoaPods spec.
- Repo: Apache-2.0 `LICENSE` and `NOTICE`, `SECURITY.md`, `versions/v2/MIGRATION.md`, and GitHub
  Actions CI that builds and tests each v2 SDK.
- Release readiness: public API baselines checked in CI on every platform (Android, web, React
  Native, iOS Core), size budgets, generated API reference (Dokka, DocC, TypeDoc), production
  `npm audit`, Dependabot, and a tag-driven release workflow that creates a draft release.
- `versions/v2/TROUBLESHOOTING.md` (including a mock-backend test mode) and `VERSIONING.md`.
- Android is ready for Maven Central: signed bundle task (`centralBundle`), javadoc jars from Dokka,
  and a release-workflow upload that waits for a manual Publish. `RELEASING.md` covers account setup.
- Minimum requirements per platform in every README and the integration guide; web build target pinned.

### Changed
- **iOS: `FarmerChatConfig` and the Objective-C `FCFarmerChatConfiguration` now default to the
  DEMO environment (were PROD).** No platform selects production on its own any more; a live app
  must set `environment: .prod` explicitly. All docs, READMEs, guide examples, sample apps and tests
  use DEMO.
- Android Maven group is now `io.github.aiyappa-digitalgreen` (was `org.digitalgreen.farmerchat`).
  Artifact names and Kotlin packages are unchanged; update the group in dependency lines.
- A repeat `initialize` on iOS, React Native and Web now matches Android. It is a no-op unless
  `environment`, `mode` or `showDrawer`/`showHistory`/`showSettings` change. Before, every call
  replaced the instance without tearing the old one down, which leaked listeners. A changed host
  `accessToken` is still applied on all four platforms. Host auth listeners survive a rebuild.
- Android: SDK logs are silent unless `debugLogging` is set. Previously 18 log lines could appear in
  host release builds.
- Web license changed from MIT to Apache-2.0 to match the rest of the suite.
- **iOS FarmerChatCore, source-breaking:** `TextPromptResponse.followUpQuestions` and
  `FollowUpQuestionsResponse.questions` changed from `[String]?` to `[FollowUpQuestionOption]?`.
  The server sends objects (`follow_up_question_id`, `question`, `sequence`), so the old `[String]`
  type never decoded the real payload; no host could have received a question through it. Code
  that names the old type must read `.question` on each item. CI's API check flagged this; under
  `VERSIONING.md` a public type change is MAJOR, so the next version number needs a decision.

### Security
- Chat-answer links open only for `http(s)` on React Native and iOS SwiftUI (v1 and v2). Previously
  `tel:`, `intent:`, `upi:` and app deep links were handed to the OS.
- Android: `Authorization` and `API-Key` are redacted from debug HTTP logs. The PostHog module no
  longer logs key or user-id prefixes. Legal WebViews disallow `file://` and `content://` access.
- Hosted demo: a malformed URL no longer crashes the server; the OTP block on the public stage proxy
  can no longer be bypassed with `//` or case changes; security headers added; proxied request
  bodies are capped at 25 MB.
- Semver-compatible dependency updates in every npm project, which cleared the critical
  `shell-quote` advisory.

### Fixed
- All platforms, matched to the app and checked on DEMO: chats reopened from history were shown
  newest first, with the oldest answer's follow-ups (Android, iOS, React Native, web); history
  follow-up chips no longer report a follow-up click (#30), as in the app; alignment chips send
  `align_chip_sel` with `parent_message_id` (iOS, React Native, web); typed questions report
  `text` (iOS sent `follow_up`, web `card`) and web follow-up chips report `follow_up`; cancelling the
  photo picker on a photo prompt sends the app's "no photo" answer (iOS, React Native, web).
- "Type or say it" now shows on clarify questions on Android as in the app (it was hidden whenever
  the server marked the question blocking).
- iOS: chat history showed an empty page when any turn had follow-ups (decode bug); tips while
  waiting now come from the server (`LabelManager.answerGenerationTips()`); the asked follow-up stays
  in view while its answer loads; UIKit Listen shows the animated bars.
- React Native: Listen shows the playing state and animated bars right away (it lagged ~2.5 s).
- Web: the "stopped playing" analytics event fired twice per clip.
- Android Views: user bubble text was ~2% wider than Compose; Compose language screen showed white
  under the navigation bar.
- React Native: `<FarmerChatFab/>` works on the new architecture (overlay instead of `Modal`), and
  taps on Share, Listen and chips after the first answer were silently ignored.
- iOS: no Listen on normal answers and no follow-up chips (two decode bugs in FarmerChatCore).
- iOS, web, React Native: the follow-up click (#30) sent the question text on every send; it now
  sends the follow-up's id, only when a suggested follow-up is tapped (as the app does).
- Chat UI brought up to the FarmerChat app on iOS (SwiftUI), Android Views, React Native and web.
- iOS SwiftUI `FarmerChatFabButton` drew a second close button over the chat-only chat screen.
- Web and React Native no longer send FarmerChat headers (including `Device-Info`) to Google's
  geolocation API. On web this had blocked location lookup on every website (CORS).
- Repository links in the guide, POMs, podspec and package.json pointed at a non-existent repo.
- Android v1 `sample-consumer` pinned 1.0.0 while the SDK publishes 1.1.0.
- Web `typecheck:test` failed (missing Node types). RN example apps were committed pointing at
  the local mock server and used an invalid `appearance` value.

## [2.2.0] - 2026-10-09

### Breaking
- `mode` defaults to `CHAT_ONLY` (was `FULL_JOURNEY`) on every platform.
- `guestApiKey` renamed to `farmerChatApiKey`, with no alias. The FarmerChat and Geolocation keys
  are built in.

### Added
- A first-time chat-only user picks a language once before the chat.
- Empty-chat placeholder. History is hidden by default in chat-only mode.
- The chat's close (X) closes the SDK on every platform; `onExit` added on Android and iOS.
- Streaming answers: `streaming_required` is sent like the app, so stage streams typed answers.
- Web widget (`@digitalgreenorg/farmerchat-widget`) and a hosted demo with an integration guide.

### Fixed
- The newest question stays pinned after an unanswered alignment surface.

## [1.1.0] - 2026-09-28 (Android)

- Neutral theme colours in the Views flavour, host language in `setHostSession`, and a local-only
  logout in `HOST_TOKEN` mode.
