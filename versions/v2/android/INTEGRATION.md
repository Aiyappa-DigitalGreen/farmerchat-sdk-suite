# Integrating FarmerChat into an Android app — end to end

Everything a host app needs, in the order you need it. Values here were read out of this
module's sources, not from memory; where a claim is only verified on one host app, it says so.

- **Artifacts:** `org.digitalgreen.farmerchat:*:2.0.0` (`build.gradle.kts:18-19`)
- **SDK floor:** `minSdk 26`, `compileSdk 36`, JVM target **17**, Kotlin 2.3.21, AGP **8.13.0**
- **Nothing to declare in your manifest.** The SDK ships its own entry `Activity`, `FileProvider`
  and permissions, and they merge in.

> The `Building this repo` section of `README.md` still says `com.digitalgreen:* 1.0.0`. That line
> is stale for 2.0.0 — the coordinates above are what the build actually publishes.

---

## Step 0 — Pick one UI artifact

Three modules ship. You depend on **one** UI artifact; it pulls `farmerchat-core` transitively.

| Your app's UI | Depend on | Entry points |
|---|---|---|
| Jetpack Compose | `farmerchat-android-compose` | `FarmerChat.launch()`, `FarmerChatFab()`, `FarmerChatInline(Modifier)`, `FarmerChatRoot()` |
| XML / Fragments / Views | `farmerchat-android-views` | `FarmerChat.launch()`, `FarmerChatFab` (a `View`), `FarmerChatFragment` |

**Do not add both.** `FarmerChat.launch()` resolves the entry `Activity` by reflection and tries
the **compose** class first (`FarmerChat.kt:156-162`), so if both are on the classpath the compose
flavour silently wins and your Views integration will look like it is being ignored.

Compose is the flavour that tracks the reference app screen-for-screen. The Views flavour is a
re-creation of the same screens and has known drift recorded in `docs/04-parity-matrix.md` — if you
have a choice, choose Compose.

---

## Step 1 — Get the artifacts on your machine

### Option A — local (what this repo does today)

```bash
cd versions/v2/android
./gradlew publishToMavenLocal      # -> ~/.m2/repository/org/digitalgreen/farmerchat/
```

Then in your host app's `settings.gradle.kts`:

```kotlin
dependencyResolutionManagement {
    repositories {
        mavenLocal()      // must come first, or the remote copy wins
        google()
        mavenCentral()
    }
}
```

`mavenLocal()` reaches exactly one machine. **Re-run `publishToMavenLocal` after every SDK edit**,
or your host keeps building against the previous AAR — a silent stale-artifact trap that looks like
"my fix did nothing".

### Option B — a real remote

The build wires a `FarmerChat` maven repository that stays inert until you give it a URL, so no
credentials are committed (`build.gradle.kts:30-70`):

```bash
./gradlew publishAllPublicationsToFarmerChatRepository \
  -PfarmerchatRepoUrl=https://maven.pkg.github.com/<org>/<repo> \
  -PfarmerchatRepoUser=<user> -PfarmerchatRepoToken=<token>
```

`FARMERCHAT_REPO_URL` / `_USER` / `_TOKEN` environment variables work instead of the `-P` flags.
Consumers add that same URL to their `dependencyResolutionManagement`.

---

## Step 2 — Host build configuration

```kotlin
// app/build.gradle.kts
android {
    compileSdk = 36

    defaultConfig {
        minSdk = 26          // see the override below if you must stay lower
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    packaging {
        resources {
            excludes += "/META-INF/versions/9/OSGI-INF/MANIFEST.MF"
        }
    }
}

dependencies {
    implementation("org.digitalgreen.farmerchat:farmerchat-android-compose:2.1.0")
    // OR, for XML/Fragment hosts — never both:
    // implementation("org.digitalgreen.farmerchat:farmerchat-android-views:2.1.0")
}
```

Four host-side requirements, each with a concrete failure if you skip it:

| Requirement | What breaks without it |
|---|---|
| `jvmTarget = 17` | The SDK's bytecode is JVM 17 and cannot be inlined into a 1.8 target — the build fails outright. |
| `minSdk 26` | See the override below. |
| The `packaging` exclude | The SDK pulls okhttp up (highest-wins), colliding with jspecify's OSGI entry — a duplicate-resource packaging failure. |
| **AGP 8.13+** on the host | Older host toolchains throw a `VerifyError` at runtime against `farmerchat-android-compose`. The failure is at launch, not at build, which makes it easy to misread as an SDK bug. |

Your Kotlin version does **not** have to match the SDK's — Kotlin 2.2.0 reads the SDK's 2.3.21
metadata without complaint.

### ⚠ A fresh project template will out-version the SDK

A new Android Studio project declares the newest androidx it knows about. Gradle resolves
transitive versions **highest-wins**, so the template's versions beat the SDK's — and the newest
androidx demands a newer AGP and compileSdk than the SDK is built on. Eight or so AAR-metadata
errors on your first build, all naming androidx artifacts and none naming a FarmerChat one:

```
Dependency 'androidx.core:core:1.19.0' requires libraries and applications that
depend on it to compile against version 37 or later of the Android APIs.
:app is currently compiled against android-36.
…requires Android Gradle plugin 9.1.0 or higher.

Dependency 'androidx.lifecycle:lifecycle-viewmodel-compose-android:2.11.0'
  requires Android Gradle plugin 9.1.0 or higher.
```

**The SDK is not the source.** Three things establish that:

| Check | Result |
|---|---|
| The SDK's own AAR metadata | `minCompileSdk=1` |
| What its POM requests | `core-ktx 1.18.0` · `lifecycle 2.10.0` |
| What a consumer app actually resolves | `core 1.18.0` · `lifecycle 2.10.0` |

The SDK's own `sample-jetpack` host consumes it exactly the way your project does and builds clean —
`BUILD SUCCESSFUL` on AGP 8.13.0 at compileSdk 36, no AAR-metadata issues. In its resolved graph
every older request is *raised to* 1.18.0 / 2.10.0 and nothing pushes past. So the 1.19.0 / 2.11.0
enter from your project.

Measured from the published AARs, this is the line you are on the wrong side of:

| Artifact | `minCompileSdk` | At compileSdk 36 |
|---|---|---|
| `androidx.core:core:1.18.0` — what the SDK requests | 36 | works |
| `androidx.core:core:1.19.0` — what a new template requests | 37 | fails |

#### Find the requester before you pin anything

Editing a version key you guessed at is how this drags on. Ask Gradle, in **your** project:

```bash
./gradlew :app:dependencyInsight \
  --configuration debugRuntimeClasspath \
  --dependency androidx.core:core
```

The line ending `(requested 1.19.0)` names the culprit. Repeat with
`--dependency androidx.lifecycle:lifecycle-runtime-compose`. Common answers, none of which a lone
`coreKtx` edit would fix: your version catalog names the lifecycle key something else
(`lifecycleRuntimeKtx`, `androidxLifecycle`); `activity-compose` at a template version pulls `core`
up; or your Compose BOM is newer than the SDK's 2026.05.00.

#### The fix that does not depend on finding it

Put this in your **root** `build.gradle.kts`, so it applies to every module no matter where the
version is declared:

```kotlin
// root build.gradle.kts
allprojects {
    configurations.all {
        resolutionStrategy {
            force(
                "androidx.core:core:1.18.0",
                "androidx.core:core-ktx:1.18.0",
                "androidx.lifecycle:lifecycle-runtime:2.10.0",
                "androidx.lifecycle:lifecycle-runtime-ktx:2.10.0",
                "androidx.lifecycle:lifecycle-runtime-compose:2.10.0",
                "androidx.lifecycle:lifecycle-viewmodel:2.10.0",
                "androidx.lifecycle:lifecycle-viewmodel-ktx:2.10.0",
                "androidx.lifecycle:lifecycle-viewmodel-compose:2.10.0",
                "androidx.lifecycle:lifecycle-viewmodel-savedstate:2.10.0"
            )
        }
    }
}
```

**Force the whole lifecycle family, not the two you saw.** The errors name `-android` variants such
as `lifecycle-viewmodel-compose-android`. Those are platform artifacts of the parent modules, so
pinning only the two named leaves their siblings free to pull the group straight back up and the
same errors return.

Then clear the daemon and re-resolve:

```bash
./gradlew --stop
./gradlew :app:assembleDebug --refresh-dependencies
```

**Identical errors after a real edit** mean a live daemon is holding a cached configuration and
reproducing the previous failure character-for-character — which reads exactly like "the fix did
nothing". If the error text is byte-identical (same AGP version, same eight items, same order),
suspect the daemon before the pin.

Moving the other way — AGP 9.1.0 and compileSdk 37 — also clears it. But the SDK is built on AGP
8.13.0 and untested on 9.x, so prefer pinning down over jumping a major AGP version to silence a
transitive-version warning; if something then broke you would have two variables in play instead of
none.

### Staying below minSdk 26

```xml
<uses-sdk tools:overrideLibrary="org.digitalgreen.farmerchat.sdk.compose,
                                 org.digitalgreen.farmerchat.sdk.core" />
```

(Use `...sdk.views` instead for the Views flavour.) With the override, **gate every SDK
touchpoint** behind `Build.VERSION.SDK_INT >= 26` — including wherever the FAB is added, because
XML inflation would construct it on older devices too. Verified this way on a minSdk-24 host.

---

## Step 3 — Initialize once, in `Application.onCreate`

The SDK builds a dependency graph on `initialize` and holds it in a process-wide singleton, so it
must be rebuilt on every cold start. `Application.onCreate` is the only place that is guaranteed.

```kotlin
class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()

        FarmerChat.initialize(
            this,
            FarmerChatConfig.Builder(FarmerChatEnvironment.STAGE)
                // No keys to pass: the FarmerChat API key and the geolocation key are
                // built in (see "API keys" below). Default mode is CHAT_ONLY.
                .languageCode("en")
                .defaultCountryCode("IN")
                .enableAgenticChat(true)                     // 2.0.0 streaming answers
                .debugLogging(BuildConfig.DEBUG)
                .build()
        )
    }
}
```

`FarmerChat.isInitialized` tells you whether the graph exists. Calling `launch`/`openChat` before
`initialize` throws.

### Environments

`FarmerChatEnvironment` (`FarmerChatConfig.kt:8-33`) — the SDK has **one base URL per
environment, not per build type**, so a debug and a release build of the same environment hit the
same host:

| | Base URL |
|---|---|
| `DEV` | `https://farmerchat.farmstack.co/mobile-app-dev/` |
| `STAGE` | `https://demo.agent.farmer.chat/` |
| `DEMO` | `https://farmerchat.farmstack.co/mobile-app-demo/` |
| `PROD` | `https://v2.api.farmer.chat/` |
| `EKS` | `https://api.farmerchat.in/` |

`STAGE` was pointed at the agentic demo backend on 2026-09-08; the previous farmstack host is kept
commented directly above it in the enum, so reverting is a one-line change. `customBaseUrl(...)`
overrides the selected environment. A custom URL **must end in a trailing slash** — every path is
joined as `baseUrl + "api/..."`, so without it the first request resolves to
`...farmer.chatapi/user/...` and fails.

### API keys are built in — you do not supply any

The SDK bundles both keys it needs: the FarmerChat `API-Key` (guest `initialize_user` /
`send_tokens`) and the Google Geolocation key. `farmerChatApiKey(String?)` and `geoApiKey(String?)`
exist only as **optional overrides**; null or blank means "use the bundled one".

Location still matters: without a resolvable location, endpoint #12 returns **empty feed
sections** (FULL_JOURNEY Home renders with nothing in it), and CHAT_ONLY resolves coordinates
before its guest bootstrap because it skips onboarding, where the geo pipeline normally runs. The
bundled geolocation key covers both; override it only if you want geolocate billed to your own
Google project.

---

## Step 4 — Launch it

Four ways, all valid. Pick by how much of the journey you want.

```kotlin
// 1. Full-screen, from wherever the farmer is. CHAT_ONLY (default) lands in a
//    fresh chat; FULL_JOURNEY routes through splash into the right screen
//    (onboarding / home / resumed chat) based on stored state.
FarmerChat.launch(context)

// 2. Straight into chat with a question already asked.
FarmerChat.openChat(context, question = "How much urea for wheat?")
FarmerChat.openChat(context, conversationId = existingId)   // reopen a thread
FarmerChat.sendQuestion(context, "…")                       // alias for question =
FarmerChat.openConversation(context, id)                    // alias for conversationId =

// 3. A floating button — Compose. No question -> same as launch().
FarmerChatFab()
FarmerChatFab(question = "Prices near me?", label = "Ask")

// 4. Inline, inside your own layout — the SDK fills only its panel and your
//    chrome stays visible.
FarmerChatInline(Modifier.weight(1f))
```

### Getting a `Context`

`launch` and `openChat` take a plain `android.content.Context`:

```kotlin
@JvmStatic
fun launch(context: Context)
```

If Kotlin says **`Function invocation 'context(...)' expected`**, nothing is wrong with the SDK —
the name `context` in that scope resolved to a function rather than a value, so you have no
`Context` in hand. Per host shape:

```kotlin
// In a @Composable — the usual cause. You need this line:
val context = LocalContext.current          // androidx.compose.ui.platform.LocalContext
FarmerChat.launch(context)

FarmerChat.launch(this)                      // in an Activity
FarmerChat.launch(requireContext())          // in a Fragment (its `context` is Context?)
FarmerChat.launch(view.context)              // in a View / onClick lambda
```

```kotlin
import org.digitalgreen.farmerchat.sdk.FarmerChat
import androidx.compose.ui.platform.LocalContext   // Compose only
```

**If `LocalContext.current` itself is red, fix the version conflict above first.** When Gradle
sync is failing, Android Studio has no resolved classpath and marks Compose references unresolved
throughout the file — so `LocalContext` going red is a *symptom of the failed sync, not a second
bug*, and it clears once the sync succeeds. Chasing it as an import problem while the build is
broken wastes the afternoon. If it survives a *successful* sync, it is a genuine missing import, or
`LocalContext.current` is being read outside a `@Composable` (which reports as "@Composable
invocations can only happen from the context of a @Composable function").

`FarmerChatFab()` resolves the Context internally, so it needs none of this — which is why the
reference `sample-jetpack` host never touches `Context` at all:

```kotlin
Scaffold(
    floatingActionButton = { FarmerChatFab() }
) { /* your dashboard */ }
```

XML / Fragment hosts:

```xml
<org.digitalgreen.farmerchat.sdk.views.FarmerChatFab
    android:layout_width="wrap_content"
    android:layout_height="wrap_content" />
```

```kotlin
supportFragmentManager.beginTransaction()
    .replace(R.id.container, FarmerChatFragment())
    .commit()
```

`FarmerChatRoot()` (Compose) is the whole journey as a composable, if you want to host the nav
graph yourself rather than use the SDK's `Activity`.

### Views: the SDK composer on your own screen

`FarmerChatComposerFragment` puts the SDK's input composer on a host screen (your home /
dashboard) with the SDK Home's UI and operations: type and send, the Camera/Gallery photo sheet
(the photo attaches and travels with the text), and the voice sheet. It never opens chat itself —
each submission arrives as a `FarmerChatLaunch` (`question`, `question` + `imageUri`, or
`audioUri`) for you to open chat with:

```xml
<!-- Last child, filling the screen ABOVE your content: only the bar takes touches. -->
<androidx.fragment.app.FragmentContainerView
    android:id="@+id/farmerChatComposer"
    android:layout_width="match_parent"
    android:layout_height="match_parent" />
```

```kotlin
class DashboardFragment : Fragment(), FarmerChatComposerFragment.Listener {
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        if (childFragmentManager.findFragmentById(R.id.farmerChatComposer) == null) {
            childFragmentManager.beginTransaction()
                .replace(R.id.farmerChatComposer, FarmerChatComposerFragment())
                .commit()
        }
    }
    override fun onFarmerChatComposerSubmit(launch: FarmerChatLaunch) =
        openChat(FarmerChatFragment.newInstance(launch))
    override fun onFarmerChatComposerHeightChanged(heightPx: Int) =
        list.updatePadding(bottom = heightPx) // keep your last item clear of the bar
}
```

The listener is the nearest parent fragment implementing it, else the activity. The voice
recording is handed to chat, which transcribes it (the SDK Home transcribes in the sheet instead).

> **Home can look different from the FAB than from the journey.** It is one `HomeScreen` either
> way — the SDK does not build a second copy per entry point. The difference is *state*: a resumed
> chat (`fc_sdk_resume_screen`), whether location and the feed have resolved, and network. If Home
> looks emptier from one entry point, compare those, not the screens.

---

## Step 5 — Configure

`FarmerChatConfig.Builder(environment)` — every setter is optional except the environment.
Grouped by what you are actually deciding.

**How much of the product to show**

| Setter | Notes |
|---|---|
| `mode(FarmerChatMode)` | `CHAT_ONLY` (default) or `FULL_JOURNEY` (onboarding, Home, drawer, settings) |
| `showDrawer(Boolean?)` | Unset by default → resolves to `mode == FULL_JOURNEY`. An explicit value wins |
| `showHistory` / `showSettings` | Chrome toggles (default true) |
| `showNameScreen(Boolean)` | Skip the name step |
| `enableSsfr(Boolean)` | The fertilizer-advisory card |
| `enableVoice` / `enableImages` / `enableWeather` | Feature switches |
| `enableAgenticChat(Boolean)` | 2.0.0 streaming answers (endpoint #27a) |
| `enableComposerUi(Boolean?)` | Defaults to `enableAgenticChat` when left null |
| `simulateAgenticStream(Boolean)` | Default false. Agentic chat UI (status, word-by-word reveal, agentic action row, stream error card) over the synchronous #27 endpoint, for a backend without #27a; also turns the composer on when `enableComposerUi` is null. Ignored when `enableAgenticChat` is true |
| `minSplashDurationMs(Long)` | Splash floor |

**`CHAT_ONLY`** (the default) has no drawer unless you set `showDrawer(true)`: with the drawer off
the chat app bar carries the history and language buttons instead (`showHistory(false)` hides the
history one). The mode also bootstraps headlessly, because it skips the screens that normally do this work:
it resolves coordinates, opens a guest session, identifies the user and raises device attributes,
loads labels (endpoint #3 — otherwise the chat renders hardcoded English), and creates the
conversation (`FarmerChatGraph.kt:440-470`). So the farmer lands straight in chat with none of it
visible.

**Identity and auth**

| Setter | Notes |
|---|---|
| `authMode(FarmerChatAuthMode)` | `SDK_OTP` — the SDK runs its own phone/OTP flow. `HOST_TOKEN` — you supply tokens |
| `accessToken` / `refreshToken` | For `HOST_TOKEN` |
| `tokenProvider(() -> String?)` | Called when a token is needed |
| `farmerChatApiKey(String?)` | Optional override of the built-in `API-Key` for the guest bootstrap |

`FarmerChat.isAuthenticated` is **true only after OTP verification** — a working guest session
reads `false`. `FarmerChat.authState` is the `StateFlow`, `onAuthStateChanged { }` the callback
(it returns an unsubscribe lambda). `FarmerChat.updateTokens(access, refresh)` refreshes in place,
and `FarmerChat.logout { success -> }` clears everything except appearance and device id.

**Location and locale**

`languageCode`, `locale`, `defaultCountryCode` (default `"IN"`), `defaultStateCode`,
`defaultLocation(lat, lng)`, `geoApiKey` (optional override of the built-in key).

**Look and feel**

`theme(FarmerChatTheme?)`, `appearance(DAY | NIGHT | AUTO)`, `fabLabel`, `fabBackgroundColor`,
`fabContentColor`, `userBubbleColor`, `userBubbleTextColor`, `aiBubbleTextColor`,
`bubbleCornerRadius`, `messageFontSizeSp`.

**Copy**

`stringOverrides(Map<String, String>)` replaces individual labels. Keys are the server's label
keys — the real ones, all prefixed **`fc_v2_app_label_`**.

Your override wins over everything. The full order is
**host override → server `${key}_${lang}` → server `${key}_en` → built-in English → the raw key**
(`LabelManager.kt:26-43`), so an override is absolute: it applies in every language, which is what
you want for a brand name and not what you want for prose.

A short key like `"auth_title"` is never served by the labels endpoint, so it falls straight
through to the built-in English in every language — silently. If you are overriding, take the key
from `Labels.kt`; do not guess it.

---

## Step 6 — Theme it

`FarmerChatTheme` is a flat token set with a day value and an optional `…Night` counterpart; an
omitted night value falls back to its day one, and an omitted token keeps the SDK's green.

```kotlin
.theme(
    FarmerChatTheme.Builder()
        .brandPrimary(0xFF1B5E20.toInt())
        .brandAccent(0xFF00C950.toInt())
        .background(0xFFFAFAFA.toInt())
        .backgroundNight(0xFF09090B.toInt())
        .cardCornerRadius(16)
        .typeScale(1.1f)
        .fontFamily(R.font.my_brand_font)
        .logo(R.drawable.my_logo)
        .build()
)
```

Colors: `brandPrimary`, `brandPrimaryDark`, `brandAccent`, `onBrand`, `background`,
`readingSurface`, `cardSurface`, `error`, `onBackground`, `onSurface` — each with a `…Night`
variant. Shape: `cardCornerRadius`, `buttonCornerRadius`, `inputCornerRadius`. Type:
`fontFamily`, `typeScale`. Branding: `logo`.

Theme only `brandPrimary` and the SDK derives the darker button/surface tints and picks a
contrasting on-brand color for you, so buttons do not stay green.

### Views: override the `fc_*` colour tokens (complete control)

With `farmerchat-android-views`, every colour the SDK paints — layouts, shape drawables, vector
icons, glows and colours resolved in code — comes from an `fc_*` colour resource. Define the same
name in your app and yours wins at build time; layout and flow stay the SDK's:

```xml
<!-- app/src/main/res/values/farmerchat_colors.xml -->
<resources>
    <color name="fc_green700">@color/my_brand</color>          <!-- bars, input bar, composer -->
    <color name="fc_green800">@color/my_brand_dark</color>     <!-- chips + buttons on the bar -->
    <color name="fc_button_primary_surface">@color/my_brand_dark</color>
    <color name="fc_green500">@color/my_accent</color>         <!-- icons, focus, highlights -->
    <color name="fc_accent">@color/my_accent</color>
    <color name="fc_border_active">@color/my_accent</color>
</resources>
```

The full token list (and the alpha variants such as `fc_surface_active`, `fc_accent_28`) is the
SDK's `res/values/colors.xml`; `res/values-night/colors.xml` lists the tokens that also need a
`values-night` override. The `FarmerChatTheme` builder and resource overrides combine: the builder
remaps whatever still carries an SDK default. With a `theme`, the glow bitmaps are tinted with
`brandAccent`.

With `showSettings(false)` the host's `appearance(...)` is applied on every launch (the user has no
screen to change it), so an embedded `FarmerChatFragment` follows the host's day/night choice.

---

## Step 7 — Wire your analytics

The SDK ships **no** third-party analytics. Everything goes through host callbacks, so events land
in whatever you already use.

```kotlin
.onEvent { name, props -> Analytics.track(name, props) }
.onUserIdentified { userId -> Analytics.identify(userId) }
.onUserAttribute { key, value -> Analytics.setUserProperty(key, value) }
.onSessionExpired { /* re-auth */ }
.onError { code, message -> Crashlytics.log("FC $code: $message") }
```

Narrower hooks also exist: `onChatOpened`, `onMessageSent`, `onAnswerReceived`, `onScreenView`,
`onSessionStart`. `enableAnalytics(false)` silences all of it.
`FarmerChat.setAnalyticsListener(...)` swaps the listener after `initialize`.

Event names are byte-identical to the reference app's constants, so dashboards line up.

---

## Step 8 — Permissions

### What merges in automatically

You declare **nothing**. Both UI artifacts ship this, and the manifest merger folds it into your
app:

```xml
<!-- from farmerchat-android-compose/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<uses-feature android:name="android.hardware.camera" android:required="false" />
```

`required="false"` matters: it keeps Play from filtering your app off devices with no camera.
The Views flavour adds one more of the same kind:

```xml
<uses-feature android:name="android.hardware.location.gps" android:required="false" />
```

The gallery picker needs **no** permission — the SDK uses `ActivityResultContracts.GetContent()`,
so there is no `READ_MEDIA_IMAGES` / `READ_EXTERNAL_STORAGE` on your listing.

### Runtime requests: the SDK asks, you write nothing

Every runtime prompt is raised by the SDK's own screens, so there is no host-side permission code
to write and no callback to forward:

| Permission | Asked when | Where |
|---|---|---|
| `RECORD_AUDIO` | The farmer taps the mic | `HomeScreen.kt:271` |
| `CAMERA` | The farmer picks "Camera" in the photo sheet | `HomeScreen.kt:250` |
| `ACCESS_FINE_LOCATION` | The location prompt, with a rationale pass | `LocationPromptHost.kt:70-100` |

All three go through `ActivityResultContracts.RequestPermission()`. A refusal degrades the feature
— voice, photos or a precise location — and never crashes.

### ⚠ The two permissions you must opt into yourself

The Auth screen can pre-fill the farmer's phone number from their SIM instead of making them type
it. That needs `READ_PHONE_STATE` + `READ_PHONE_NUMBERS`, and **the SDK deliberately declares
neither**: they are sensitive, a library manifest merges into every host, and a host that never
shows the Auth screen would still inherit them and have to justify them on its store listing.

So this is opt-in. Add them to **your** manifest to turn the feature on:

```xml
<!-- your app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.READ_PHONE_STATE" />
<uses-permission android:name="android.permission.READ_PHONE_NUMBERS" />
```

That is the whole opt-in — no config flag, no code. The SDK reads your merged manifest at runtime
(`SimPhoneNumberProvider.isDeclaredByHost`) and only prompts if both are present:

```kotlin
// AuthScreen.kt:177-179 — the SDK's own gate
if (SimPhoneNumberProvider.isDeclaredByHost(context)) {
    simPermissionLauncher.launch(SimPhoneNumberProvider.requiredPermissions)
}
```

**If you skip it:** the farmer types their number, and sees no prompt and no error. That silence is
intentional — Android denies a request for an undeclared permission instantly and without a
dialog, so asking anyway would show a failure toast for a feature the host never enabled.

Two behaviours worth knowing before you opt in. `canReadPhoneNumber` is a pure runtime check, so an
undeclared or denied permission reads as "no SIM numbers" rather than throwing. And many carriers
simply never write MSISDN to the SIM, so **granted permissions still commonly return nothing** —
build your expectations around a best-effort convenience, not a reliable prefill.

### Dropping a permission you do not want

`enableVoice(false)` / `enableImages(false)` remove the *features*, but the manifest entry still
merges in and still shows on your listing. To strip the declaration, use the manifest merger:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <uses-permission android:name="android.permission.RECORD_AUDIO"
        tools:node="remove" />
    <uses-permission android:name="android.permission.CAMERA"
        tools:node="remove" />
</manifest>
```

Pair it with the matching config flag. Removing `CAMERA` while leaving `enableImages(true)` leaves
the photo sheet reachable and its camera path permanently denied — a dead control the farmer can
still tap.

Do **not** remove `INTERNET` or `ACCESS_NETWORK_STATE`; the SDK cannot function without them.
Removing both location permissions leaves the feed with no resolvable location — see Step 3.

### FileProvider

Hosts with their own `FileProvider` are safe. The SDK declares its provider under its own class
name and its own authority, so the manifest-merger keys never collide:

| Flavour | Authority |
|---|---|
| `farmerchat-android-compose` | `${applicationId}.fc_sdk_fileprovider` |
| `farmerchat-android-views` | `${applicationId}.fc_sdk_views_fileprovider` |

A library that declared `androidx.core.content.FileProvider` directly would fail every such host
with *"Attribute provider#androidx.core.content.FileProvider@authorities … is also present"*.

---

## Step 9 — ProGuard / R8

Consumer rules ship inside the artifacts (models kept for Gson, Retrofit annotations, entry
activities), so a normal release build needs nothing. If you maintain a manual keep-file, mirror
`farmerchat-core/consumer-rules.pro`:

```
-keep class org.digitalgreen.farmerchat.sdk.core.model.** { *; }
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
```

Storage: all persisted state lives in a dedicated `SharedPreferences` file with `fc_sdk_`-prefixed
keys. The SDK never touches your app's preferences.

---

## Step 10 — Verify the integration

In order — each step rules out the failures below it.

1. **Cold start with `debugLogging(true)`.** You should see the graph build and a guest token
   minted. No token means the API key or the base URL is wrong, not the UI.
2. **Language selection appears with a language preselected** and the CTA enabled. A dead-looking
   CTA on a fresh install means language preselection is not running.
3. **(FULL_JOURNEY) Home shows feed sections.** Empty sections = location did not resolve → check
   the `geolocate` call in the logs (and any `geoApiKey` override).
4. **Ask a question.** With `enableAgenticChat(true)` the answer streams in; the question should
   stay pinned while it grows.
5. **Force-stop and relaunch.** This is the check that catches `initialize` being called from an
   `Activity` instead of `Application.onCreate`.
6. **Build a release variant.** R8 problems only appear here.

Before blaming the SDK, curl a guest token against the same base URL with the same key. "Nothing
loads" is far more often a blank parameter or a wrong environment than an SDK fault.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Home renders but the feed is empty | No resolved location — check `geolocate` in the logs; a blank/wrong `geoApiKey` override |
| `VerifyError` at launch | Host AGP below 8.13 |
| Views integration behaves like Compose | Both UI artifacts on the classpath; compose is resolved first |
| Build fails on JVM target | Host not on `jvmTarget = 17` |
| Duplicate `META-INF/versions/9/OSGI-INF/MANIFEST.MF` | Missing `packaging` exclude |
| An SDK fix didn't take effect | `publishToMavenLocal` not re-run, so the host built the old AAR |
| Crash on an old device with the minSdk override | An SDK touchpoint is not gated behind `SDK_INT >= 26` — often the FAB, constructed by XML inflation |
| Works after login, breaks on fresh install | Reading `isAuthenticated` as "has a session"; it is true only after OTP |
| Copy stays English in another language | A short label key. Only `fc_v2_app_label_*` keys are served |
| First request 404s against a custom URL | Missing trailing slash on `customBaseUrl` |
| Wall of AAR-metadata errors demanding compileSdk 37 / AGP 9.1 | Your project's androidx versions, not the SDK's — run `dependencyInsight` to find the requester, then force the whole family from the root build file |
| Identical AAR-metadata errors after a real edit | A live daemon on a cached configuration — `./gradlew --stop`, then rebuild with `--refresh-dependencies` |
| Same errors return after pinning only the two named artifacts | The `-android` variants are platform artifacts of the parent modules; their siblings pull the group back up. Force the whole lifecycle family |
| `Function invocation 'context(...)' expected` | No `Context` in scope — in a Composable add `val context = LocalContext.current` |
| `LocalContext.current` unresolved | Usually a symptom of a failed Gradle sync, not an import problem. Fix the version conflict, sync, then re-check |
| SIM number prefill never appears | `READ_PHONE_STATE` + `READ_PHONE_NUMBERS` not declared in **your** manifest — the SDK stays silent by design |
| SIM permissions granted but still no number | Common: many carriers never write MSISDN to the SIM |
| A permission is on your Play listing after `enableVoice(false)` | The flag removes the feature, not the manifest entry — use `tools:node="remove"` |
| State survives a logout | Expected — appearance and device id are deliberately preserved |

---

## Reference

- `versions/v2/android/README.md` — module layout, size, transitive footprint, agentic details
- `docs/01-app-specification.md` — screens, navigation, lifecycle
- `docs/02-api-reference.md` — endpoints, models, networking, prefs, analytics
- `docs/03-sdk-architecture.md` — the shared public surface across all platforms
- `docs/04-parity-matrix.md` — the honest ledger of what is and is not done per platform
- `sample-jetpack` — smallest end-to-end host; all branding in `FarmerChatSetup.kt`; shows both
  full-screen launch and inline embedding
- `sample-compose` / `sample-views` — minimal hosts per flavour
