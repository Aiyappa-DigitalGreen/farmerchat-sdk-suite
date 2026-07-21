# FarmerChat SDK Suite — Working Rules (READ FIRST, ALWAYS)

These rules bind every contributor and every AI agent working in this repository. They exist to prevent hallucination, drift, and regression across six parallel SDK packages.

## 1. Source-of-truth chain (never invert it)

```
fc-compose Android app source (/Users/Aiyappa/AndroidStudioProjects/fc-compose — READ-ONLY reference)
  └─> docs/01-app-specification.md   (screens, navigation, lifecycle)
  └─> docs/02-api-reference.md       (endpoints, models, networking, prefs, analytics)
  └─> docs/03-sdk-architecture.md    (public SDK surface, packaging, adaptations)
        └─> platform code (android/ ios/ react-native/ web/)
              └─> docs/04-parity-matrix.md (status tracking — updated LAST, reflects reality)
```

- Code must be derivable from the docs. Docs must be derivable from the app source.
- If code and docs disagree, the docs win until proven wrong against the app source; then fix the docs FIRST, then the code on ALL platforms.
- NEVER modify anything under `/Users/Aiyappa/AndroidStudioProjects/fc-compose` — it is reference only.

## 2. No-hallucination rules (STRICT)

- **Endpoints**: only the 34 endpoints + 2 token endpoints + Google geolocate in docs/02 exist. Never invent a path, method, query param, or header. The dead constants listed in docs/02 (`auth/login`, `chat/send`, `chat/history`, `UPLOAD_IMAGE`, `UPLOAD_AUDIO`) must NOT appear in SDK code.
- **Model fields**: every field name/type must appear in docs/02 or in the app's `domain/model/` / `ui/*/model/` sources. Field names are snake_case exactly as the API sends them. Do not add convenience fields to wire models.
- **Event names**: analytics event names must match the app's constants (`OnboardingAnalyticsEvents.kt`, `GpsAnalyticsEvents.kt`) character-for-character. No new events.
- **Base URLs**: only the five environments in docs/02. Never guess URLs.
- **Preference keys**: use the documented key names under the `fc_sdk_` namespace prefix. Do not invent keys.
- **Copy/strings**: user-visible text = the app's English strings, always resolved through LabelManager (`${key}_${lang}` → `${key}_en` → English fallback → raw key).
- If something is genuinely not covered by the docs: (1) check the app source; (2) if still ambiguous, implement the conservative reading and add it to `docs/05-open-questions.md` — never silently guess.

## 3. No-regression rules

- The screen list in docs/01 §3 and the navigation graph in §2 are the frozen feature set. No screen, action, state field, or navigation edge may be dropped on any platform without an explicit entry in docs/04 with a reason.
- Public API (`FarmerChat.initialize/launch/openChat/logout/isAuthenticated/onAuthStateChanged`, `FarmerChatConfig` fields) is shared across all six packages. Renaming or removing anything requires updating docs/03 + all platforms in the same change.
- Behavioral invariants that must never change without a docs update:
  - ApiPriority: P1 = 5 s / 1 retry, P2 = 10 s / 2, P3 = 30 s / 3.
  - Retryable HTTP: 408, 500, 502, 503, 504, 404. Never retry 400, 429, 401.
  - Backoff: `min(500 * 2^attempt, 3000)` ms.
  - 401 refresh: skip-list (`generate_otp`, `verify_otp`, `get_new_access_token`, `send_tokens`, `initialize_user`), loop guard at 2, refresh → guest `send_tokens` fallback, never on main thread, single-flight.
  - Headers: `Build-Version: v2`, `Device-Info` (URL-encoded JSON), `Authorization: Bearer` when present, `X-Request-ID`, `X-Timeout`.
  - Voice transcription accepted only if `!error && confidence_score > 0.7 && text not blank`.
  - OTP: 4 digits, 180 s resend timer, WhatsApp/SMS channels per country (endpoint #20).
  - `routeFromSplash()` decision tree and all `popUpTo` back-stack semantics per docs/01 §2.
  - Follow-up questions come from endpoint #29, never from `TextPromptResponse.follow_up_questions` (always null).
  - Chat replies are synchronous JSON. Do not introduce streaming/SSE/WebSocket.
- Preserve the documented app quirks in docs/02 §"Known app quirks" exactly as specified there (P1=5s, history=P3, plantix priority mapped to `image_analysis`).

## 4. Parity rule

Any behavior change or bug fix must either (a) be applied to android, ios, react-native, and web in the same effort, or (b) be recorded as a gap in `docs/04-parity-matrix.md`. The matrix is the honest ledger — keep it truthful, including "NOT IMPLEMENTED" and "UNVERIFIED" entries. Never mark a matrix cell done for stubbed or partial code.

## 5. Verification requirements (before claiming done)

| Area | Minimum check |
|---|---|
| android/ | `./gradlew :farmerchat-core:compileDebugKotlin` (or full assemble if env allows) |
| ios/ | `swift build` in FarmerChatCore (SourceKit editor errors like "No such module 'PackageDescription'" are IDE-indexing noise; trust `swift build`) |
| react-native/ | `npx tsc --noEmit` in the package |
| web/ | `npx tsc --noEmit` + `vite build` |

If an environment prevents a check, say so explicitly in the platform README and in docs/04 — do not claim verified.

## 6. Conventions

- Storage: prefix all persisted keys with `fc_sdk_` (SharedPreferences / Keychain+UserDefaults / AsyncStorage / localStorage).
- No third-party analytics/marketing SDKs (Plotline, MoEngage, Adjust, Firebase) inside SDK packages — events go through the host-pluggable analytics listener only.
- No TODO-stub screens. If time-boxed, ship a complete simple version and log the delta in docs/04.
- Package ids: `org.digitalgreen.farmerchat.sdk` (Android), `FarmerChatCore/SwiftUI/UIKit` (iOS), `@digitalgreenorg/farmerchat-react-native`, `@digitalgreenorg/farmerchat-web`.
- Platform-specific rules live in `<platform>/CLAUDE.md` and add to (never override) this file.

## 7. Keeping docs up to date

Every substantive code change ends with: docs/01–03 still accurate? docs/04 updated? platform README updated? If any answer is no, the change is not finished.
