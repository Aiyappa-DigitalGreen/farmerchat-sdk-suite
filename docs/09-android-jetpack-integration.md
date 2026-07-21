# Integrating FarmerChat into a Jetpack Compose app

A step-by-step guide to adding the FarmerChat SDK to a brand-new (or existing) Android Jetpack Compose project, then restyling it (colors, fonts, shapes, logo) to match your app.

Requirements: **minSdk 26+**, **compileSdk 36**, Kotlin 2.x, AGP 8.x.

---

## 1. Add the repository + dependency

The SDK publishes three artifacts under group `org.digitalgreen.farmerchat`:

| Artifact | What it is |
|---|---|
| `farmerchat-android-compose` | Jetpack Compose UI (use this for a Compose app) |
| `farmerchat-android-views` | XML/Fragments UI (alternative for View-based apps) |
| `farmerchat-core` | headless core — pulled in automatically |

**`settings.gradle.kts`** — add the repository. While the SDK is distributed via your internal Maven (or Maven Central once published), add `mavenCentral()`. To try it locally first, publish to your machine with `./gradlew publishToMavenLocal` from the SDK repo and add `mavenLocal()`:

```kotlin
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        mavenLocal()   // only needed while consuming a locally-published build
    }
}
```

**`app/build.gradle.kts`** — add the dependency (Compose app):

```kotlin
dependencies {
    implementation("org.digitalgreen.farmerchat:farmerchat-android-compose:1.0.0")
    // farmerchat-core comes transitively — no need to add it explicitly
}
```

That's the whole install. The SDK ships its own `Activity`, `FileProvider`, and camera/mic/location permission declarations, and a `consumer-rules.pro` so R8/minified release builds keep its models — **no manifest or ProGuard edits required in your app.**

---

## 2. Initialize once (Application)

```kotlin
import android.app.Application
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.FarmerChatConfig
import org.digitalgreen.farmerchat.sdk.FarmerChatEnvironment
import org.digitalgreen.farmerchat.sdk.FarmerChatAppearance

class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FarmerChat.initialize(
            this,
            FarmerChatConfig.builder(FarmerChatEnvironment.PROD)   // DEV | STAGE | DEMO | PROD | EKS
                .appearance(FarmerChatAppearance.AUTO)             // DAY | NIGHT | AUTO
                .onEvent { name, props -> /* forward to your analytics if you like */ }
                .build()
        )
    }
}
```

Register it in your manifest: `<application android:name=".MyApp" ...>`.

---

## 3. Open the SDK — three ways

```kotlin
// a) Full-screen journey (splash → onboarding → home → chat)
FarmerChat.launch(context)

// b) Deep-link straight into a chat with a question
FarmerChat.openChat(context, question = "How do I treat leaf rust on wheat?")

// c) Drop-in floating button (put it in any Scaffold) — zero extra wiring
Scaffold(floatingActionButton = { FarmerChatFab() }) { padding -> /* your screen */ }

// d) Embed inline inside your own layout (not full-screen)
@Composable
fun MyScreen() {
    Column {
        MyHeader()
        FarmerChatInline(modifier = Modifier.weight(1f))   // fills the space you give it
    }
}
```

---

## 4. Match your app's theme (colors, fonts, shapes, logo)

Pass a `FarmerChatTheme` at init. **Anything you omit falls back to the FarmerChat green brand.** One override recolors every screen — you don't touch individual screens.

```kotlin
import androidx.core.content.res.ResourcesCompat
import org.digitalgreen.farmerchat.sdk.FarmerChatTheme

FarmerChatConfig.builder(FarmerChatEnvironment.PROD)
    .theme(
        FarmerChatTheme.builder()
            // ---- Colors (ARGB ints) ----
            .brandPrimary(0xFF1565C0.toInt())      // app bars, primary brand surfaces
            .brandPrimaryDark(0xFF0D47A1.toInt())  // primary buttons, input tiles
            .brandAccent(0xFF42A5F5.toInt())       // chevrons, active radio dot, spinner
            .onBrand(0xFFFFFFFF.toInt())           // text/icons on brand surfaces
            .background(0xFFF7F7F8.toInt())        // screen background
            .cardSurface(0xFFFFFFFF.toInt())       // cards / list rows
            .error(0xFFD32F2F.toInt())

            // ---- Shape (dp) ----
            .cardCornerRadius(16)
            .buttonCornerRadius(12)
            .inputCornerRadius(12)

            // ---- Typography ----
            .fontFamily(R.font.host_sans)          // a font resource in res/font/
            .typeScale(1.0f)                       // multiply all text sizes

            // ---- Branding ----
            .logo(R.drawable.host_logo)            // replaces the 6-petal mark

            .build()
    )
    .build()
```

### Dark mode
If you set only light colors, sensible dark equivalents are derived automatically. To control dark explicitly, provide a dark color set (same setters, `...Dark(...)` variants where available) — see `FarmerChatTheme.Builder` KDoc. `FarmerChatAppearance.AUTO` follows the system; `DAY`/`NIGHT` force one.

### Fonts
1. Drop your font files in `res/font/` (e.g. `host_sans.ttf` or a `host_sans.xml` font family).
2. Pass the resource id: `.fontFamily(R.font.host_sans)`.
3. Optionally scale everything with `.typeScale(1.1f)` for a larger-text brand.

---

## 5. Optional features (all off/default unless set)

```kotlin
FarmerChatConfig.builder(FarmerChatEnvironment.PROD)
    // Point at your own backend instead of a built-in environment:
    .customBaseUrl("https://api.mycompany.com/farmerchat/")

    // Skip the built-in phone+OTP and use YOUR user's token:
    .authMode(FarmerChatAuthMode.HOST_TOKEN)
    .accessToken(myAccessToken)
    // .tokenProvider { refreshAndReturnNewToken() }

    // Trim the experience:
    .mode(FarmerChatMode.CHAT_ONLY)   // skip onboarding/home, land in chat
    .showSettings(false).showHistory(true).showDrawer(true)
    .enableWeather(true).enableSsfr(false)

    // Semantic callbacks:
    .onChatOpened { /* ... */ }
    .onMessageSent { text -> /* ... */ }
    .onAnswerReceived { messageId -> /* ... */ }
    .onError { code, message -> /* ... */ }

    // Override copy / force a language:
    .stringOverrides(mapOf("fc_v2_app_label_start_chat" to "Ask an expert"))
    .locale("hi")
    .build()
```

Programmatic control from anywhere after init:
```kotlin
FarmerChat.sendQuestion(context, "Best time to sow maize?")
FarmerChat.openConversation(context, conversationId)
FarmerChat.logout()
FarmerChat.isAuthenticated                     // Boolean
FarmerChat.onAuthStateChanged { signedIn -> }  // returns an unsubscribe lambda
```

---

## 6. Minimal complete example

```kotlin
// MyApp.kt
class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FarmerChat.initialize(
            this,
            FarmerChatConfig.builder(FarmerChatEnvironment.PROD)
                .appearance(FarmerChatAppearance.AUTO)
                .theme(
                    FarmerChatTheme.builder()
                        .brandPrimary(0xFF1565C0.toInt())
                        .brandAccent(0xFF42A5F5.toInt())
                        .fontFamily(R.font.host_sans)
                        .build()
                )
                .build()
        )
    }
}

// MainActivity.kt
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Scaffold(floatingActionButton = { FarmerChatFab() }) { padding ->
                    Box(Modifier.padding(padding).fillMaxSize(), Alignment.Center) {
                        Text("My host app — tap the FarmerChat button")
                    }
                }
            }
        }
    }
}
```

Run it, tap the button, and the fully-themed FarmerChat experience opens. See the working samples in the SDK repo under `android/sample-compose/` (Compose) and `android/sample-views/` (XML Views).

---

## Notes
- The SDK owns phone+OTP auth and token refresh internally unless you switch to `HOST_TOKEN`.
- No third-party analytics/marketing SDKs are bundled; all events reach you via `onEvent` / `setAnalyticsListener`.
- Until the artifacts are on Maven Central, consume them from your internal Maven or via `publishToMavenLocal` (`mavenLocal()`), using the identical coordinate.
