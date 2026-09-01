# 10 — Distribution & Integration

Why the SDK could not be used outside this folder, what was changed, and what still needs a
human decision.

## The problem, precisely

Nothing was published anywhere. Verified 2026-09-01:

| Platform | State found | Consequence |
|---|---|---|
| Android | `publishing { publications { … } }` in all three library modules, but **no `repositories { }` block** | maven-publish could only run `publishToMavenLocal` → the AAR existed in `~/.m2` on **one machine**. No other app, developer or CI could resolve it. |
| web | `npm view @digitalgreenorg/farmerchat-web` → **404** | never published |
| react-native | `npm view @digitalgreenorg/farmerchat-react-native` → **404** | never published |
| iOS | podspec exists for `FarmerChatUIKit` only; **no git tags** | SPM cannot resolve a version without a tag |
| repo | **no git remote** | the repository itself existed only on this machine |

So "I can't integrate this into another app" was not a code problem. The artifacts did not exist
anywhere another project could reach.

## What was fixed

`android/build.gradle.kts` now adds a real publish repository to every module that applies
`maven-publish`, configured entirely from Gradle properties or environment variables so **no
credentials are committed**. It is inert until a URL is supplied, so `publishToMavenLocal` keeps
working exactly as before.

```bash
./gradlew publishAllPublicationsToFarmerChatRepository \
  -PfarmerchatRepoUrl=https://maven.pkg.github.com/digitalgreenorg/farmerchat-sdk-suite \
  -PfarmerchatRepoUser=<user> -PfarmerchatRepoToken=<token>
```

or via `FARMERCHAT_REPO_URL` / `FARMERCHAT_REPO_USER` / `FARMERCHAT_REPO_TOKEN`.

Consumers add the same URL to `dependencyResolutionManagement.repositories`.

## What still needs a decision (not done here)

These need credentials or an org-level choice and were deliberately left to a human:

1. **Pick the Android registry** — GitHub Packages (private, easy) vs Maven Central (public,
   requires a Sonatype account + GPG signing). Then run the publish command above from CI.
2. **`npm publish`** the two TS packages under the `@digitalgreenorg` scope (needs an npm token
   with publish rights on that scope).
3. **Tag the repo** (`v1.0.0`) so SPM consumers can pin a version, and add a `FarmerChatCore` /
   `FarmerChatSwiftUI` podspec alongside the existing UIKit one.
4. **Add a git remote** and push.

Until 1–4 are done, `publishToMavenLocal` remains the only distribution path, and it only works
for projects on the same machine.

## Verified integration: RationSmart (`cattle_feed.org`)

Done end-to-end on 2026-09-01 against `/Users/Aiyappa/AndroidStudioProjects/feed-formulation-frontend`.

**Before**: RationSmart included `:farmerchat-sdk` as a **source module by absolute path** from a
different, older SDK checkout (`com.farmerchat.sdk.FarmerChatSdk`, a `fc_live_`-style partner key
and its own base URL). That coupled the host to the SDK repo's AGP/Kotlin toolchain and to every
`libs.*` alias its build file used, and worked on exactly one machine.

**After** — consumed as a published artifact:

```kotlin
// settings.gradle.kts — dependencyResolutionManagement.repositories
mavenLocal()   // ahead of google() / mavenCentral()

// app/build.gradle.kts
implementation("org.digitalgreen.farmerchat:farmerchat-android-views:1.0.0")
```

`farmerchat-core` arrives transitively. Re-run `publishToMavenLocal` after **any** SDK edit —
mavenLocal serves a snapshot, not a live source link.

### Host-side requirements hit in practice

| Requirement | Detail |
|---|---|
| `jvmTarget = 17` | SDK bytecode is JVM 17. RationSmart already had this. |
| minSdk | SDK declares **26**, RationSmart ships **24**. Resolved with `<uses-sdk tools:overrideLibrary="org.digitalgreen.farmerchat.sdk.views, org.digitalgreen.farmerchat.sdk.core" />` **plus** a runtime gate — `FarmerChatSetup.isSupported` returns false below API 26, so `initialize()` is never called and the FAB is never inflated. On a 24/25 device the host behaves as if the assistant were absent. Raising the host to 26 would drop Android 7 users, which is a product decision, not an integration one. |
| `packaging { excludes += "/META-INF/versions/9/OSGI-INF/MANIFEST.MF" }` | SDK pulls okhttp up; collides with jspecify's OSGI entry. Already present. |
| Merged manifest | Gains `FarmerChatActivity`, `FarmerChatFileProvider`, and `RECORD_AUDIO` / `CAMERA` / `ACCESS_FINE|COARSE_LOCATION`. Play-listing visible. |

### Config translation (old SDK → this SDK)

The two SDKs share no API. The old one took a partner key and a free-form base URL; this one
selects a named environment and takes a guest-init key.

| Old | New |
|---|---|
| `FarmerChatSdk.initialize(context, config)` | `FarmerChat.initialize(context, config)` |
| `sdkApiKey = "fc_live_…"` | `guestApiKey(…)` — different purpose (the `API-Key` header on guest init / send_tokens) |
| `baseUrl = "https://…"` | `FarmerChatConfig.builder(FarmerChatEnvironment.PROD)` — one of five named envs |
| `FarmerChatFabView` + `app:fc_containerColor` | `FarmerChatFab` + `android:backgroundTint` (config `fabBackgroundColor` applies only when XML declares no explicit tint) |
| `SdkAnalyticsListener` interface | `.onEvent { name, props -> }` |
| `clearSession(context)` | `logout()` |
| `updateTokens(context, a, r)` | `updateTokens(a, r)` |
| — | `geoApiKey(…)` — **new and important**, see below |

### `geoApiKey` is effectively required

RationSmart was integrated without one, and the result is exactly what docs/04 predicts: guest
init could not send coordinates, the backend's IP geolocation returned `country_code: null`,
nothing was persisted (no `fc_sdk_user_country_code` key in the app's prefs), and the home feed
came back with zero sections. The language screen still worked — but only because of the
`defaultCountryCode`/`defaultStateCode` fallback added the same day.

Set `-PFC_GEO_API_KEY=…` (wired to `BuildConfig.FC_GEO_API_KEY` in RationSmart) for a populated
home feed from first launch.

### On-device verification (motorola edge 60 fusion, API 36)

| Flow | Result |
|---|---|
| Host app boot with SDK initialized | ✅ `FarmerChat initialized (env=PROD)`, no crash |
| FAB → full journey | ✅ Splash → Language |
| Language screen | ✅ populated — ಕನ್ನಡ, English, हिंदी (Kannada first, proving the `state=Karnataka` name-not-code fix) |
| Home / dashboard | ✅ greeting label + Photo/Speak/Type (green icons) + feed cards once location resolved |
| Home before location resolved | ✅ correct empty state, **no stuck shimmer** (greeting fallback fix) |
| Drawer, Settings, Language, Help | ✅ |
| Past Advice (history list) | ✅ conversations grouped by month |
| Open a conversation with duplicate `message_id`s | ✅ thread rendered, **0** `FATAL EXCEPTION` / `was already used`, pid unchanged |
