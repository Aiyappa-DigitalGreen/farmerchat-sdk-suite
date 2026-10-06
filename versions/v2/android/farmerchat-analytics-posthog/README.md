# farmerchat-analytics-posthog

An **optional** PostHog sink for the FarmerChat Android SDK.

## Why it is its own module

Root `CLAUDE.md` §6 bans vendor analytics SDKs inside `farmerchat-core`, `-compose` and `-views`.
This artifact does not change that. The SDK still emits every event the production app tracks —
identical names, identical property keys — through its host-pluggable
`FarmerChatAnalyticsListener`, and a host that never depends on this module links no PostHog at
all.

What this module adds is the **naming translation**, ported line-for-line from iOS so both
platforms land on the same event names in the same PostHog project. Getting that wrong is invisible
at runtime and silently splits every insight, which is why it is pinned by unit tests rather than
left to each host.

## Use

```kotlin
class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()

        // BEFORE FarmerChat.initialize — the SDK emits App_Opened during initialize(),
        // so a sink wired after it misses the launch event.
        FarmerChatPostHog.setup(
            context = this,
            apiKey = BuildConfig.POSTHOG_API_KEY,
            host = BuildConfig.POSTHOG_HOST,      // defaults to https://us.i.posthog.com
            appFlavor = "prod",
            isDebug = BuildConfig.DEBUG
        )

        val config = FarmerChatPostHog
            .attachExclusive(FarmerChatConfig.builder(FarmerChatEnvironment.PROD))
            .build()

        FarmerChat.initialize(this, config)
    }
}
```

`attachExclusive()` wires events, identity and user attributes, and forces
`enableAnalytics(true)` — which defaults to **false**, and is the single likeliest reason for
"PostHog receives nothing".

It is called *Exclusive* because it **replaces** `onEvent` / `onUserIdentified` /
`onUserAttribute`: the builder's setters overwrite rather than accumulate, so calling it on a
builder where you already set one of those silently drops your callback. **If you have your own
analytics, do not call it** — call `FarmerChatPostHog.track` / `identify` / `setUserProperty` from
inside your own callbacks and set `enableAnalytics(true)` yourself. That is what both samples do.

## Credentials

`POSTHOG_API_KEY` and `POSTHOG_HOST` come from `local.properties` (gitignored) or `-P`:

```bash
./gradlew :sample-compose:assembleDebug \
  -PPOSTHOG_API_KEY=phc_xxxx -PPOSTHOG_HOST=https://us.i.posthog.com
```

Never commit a key. A blank key means **PostHog off**, logged at warn — a missing key degrades to
silence, never a launch crash.

## What it deliberately does

| | Why |
|---|---|
| `captureApplicationLifecycleEvents = false` | PostHog emits `Application Installed/Opened/Updated` **unprefixed**, double-counting against the app's own `App_Installed/Opened/Updated` |
| `captureScreenViews = false` | the app sends `Screen_Viewed` itself |
| Buffers person properties until `identify` | PostHog discards them on events sent while anonymous; SDK attributes are set during onboarding, which runs before guest init returns the id |
| Suppresses `Dashboard_Viewed`, `Microphone_Click_Event` | each always fires alongside an event recording the same action |
| Merges `Card_Shown` + `Card_Viewed` → `card_viewed` | one idea, two detectors; which one fired survives as `detection` |

Verification: `./gradlew :farmerchat-analytics-posthog:testDebugUnitTest` (14 tests).
