# -*- coding: utf-8 -*-
from content import *

def S(id,title,*blocks): return {"id":id,"title":title,"blocks":list(blocks)}
def P(t): return ("p",t)
def SUB(t): return ("sub",t)
def CB(tabs): return ("code",tabs)
def TBL(head,rows): return ("table",head,rows)
def NOTE(*a): return a if len(a)==3 else ("note",a[0],list(a[1:]))

GRADLE_REPO = CB([
 ("settings.gradle.kts","kotlin","settings.gradle.kts","""dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        mavenLocal() // FarmerChat, until a hosted repository is published
    }
}"""),
 ("settings.gradle","groovy","settings.gradle","""dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        mavenLocal() // FarmerChat, until a hosted repository is published
    }
}""")])

ANDROID_INIT_NOTE = ("warn","Register the Application class",[
 "Add <code>android:name=\".MyApp\"</code> to the <code>&lt;application&gt;</code> tag in your "
 "manifest. Without it <code>onCreate</code> never runs, <code>initialize</code> never happens, "
 "and every later call throws &mdash; with nothing in the build to warn you."])

ANDROID_IDENTITY = [
 P("By default the SDK owns identity: farmers start as guests and can sign in with a phone number "
   "and OTP inside the journey. If your app already knows who the farmer is, supply the token "
   "instead and the SDK skips its own auth UI."),
 CB([("Kotlin","kotlin",None,"""FarmerChatConfig.Builder(FarmerChatEnvironment.PROD)
    .authMode(FarmerChatAuthMode.HOST_TOKEN)
    .accessToken(myAuth.currentAccessToken())
    // Called at init when no accessToken was given, and again on a 401.
    .tokenProvider { myAuth.freshAccessToken() }
    .build()""")]),
 P("After your own refresh, push the new token in without reconfiguring:"),
 CB([("Kotlin","kotlin",None,"""FarmerChat.updateTokens(access = newAccess, refresh = newRefresh)

// Session state
val signedIn = FarmerChat.isAuthenticated()
FarmerChat.logout { success -> /* … */ }""")])]

ANDROID_LABELS = [
 P("All farmer-facing text is served by the backend and resolved per language, so the journey "
   "localises itself once the farmer picks a language. To override a specific string, key it by "
   "the canonical label key."),
 CB([("Kotlin","kotlin",None,"""FarmerChatConfig.Builder(FarmerChatEnvironment.PROD)
    .stringOverrides(
        mapOf(
            Labels.RECENT_CHATS to "Past advice",
            Labels.SHARE_LOCATION to "Share my farm"
        )
    )
    .build()""")]),
 LABELS_NOTE]

ANDROID_ANALYTICS = [
 P("The SDK emits the same events the FarmerChat app tracks, with the same names and properties, "
   "through a listener you provide. It bundles no third-party analytics SDK &mdash; forward the "
   "events to whatever you already use."),
 CB([("Kotlin","kotlin",None,"""FarmerChatConfig.Builder(FarmerChatEnvironment.PROD)
    .enableAnalytics(true) // default false
    .onEvent { name, props -> MyAnalytics.track(name, props) }
    .onScreenView { screen -> MyAnalytics.screen(screen) }
    .onChatOpened { /* … */ }
    .onMessageSent { text -> /* … */ }
    .onAnswerReceived { messageId -> /* … */ }
    .onError { code, message -> MyLogger.warn(code, message) }
    .build()""")]),
 ANALYTICS_NOTE]

ANDROID_THEME = [
 P("The SDK ships the FarmerChat look by default. Override the parts that must match your app "
   "&mdash; anything you leave unset keeps the FarmerChat value."),
 CB([("Kotlin","kotlin",None,"""FarmerChatConfig.Builder(FarmerChatEnvironment.PROD)
    .theme(
        FarmerChatTheme(
            brandPrimary = 0xFF00C950.toInt(),
            cardCornerRadius = 24,
            buttonCornerRadius = 999,  // fully rounded, the current default
            inputCornerRadius = 12
        )
    )
    .messageFontSizeSp(15f)
    .bubbleCornerRadius(18)
    .build()""")]),
 ("note","Buttons are pills",[
  "<code>buttonCornerRadius</code> defaults to <code>999</code> (a full pill) as of the "
  "2026-09-15 design pass. Pass a smaller value to square them off."])]

COMPOSE = {
 "id":"android-compose","name":"Android","flavour":"Jetpack Compose","badge":"Kotlin · minSdk 26",
 "intro":["The Compose SDK embeds the FarmerChat journey in a modern Android app. It is the "
   "reference flavour &mdash; the screens here are direct ports of the FarmerChat app itself, so "
   "this is the closest match to what farmers already use.",
   "Everything ships as two artifacts: <code>farmerchat-core</code> (networking, session, state "
   "machines, no UI) and <code>farmerchat-android-compose</code> (the screens). You depend on the "
   "latter; it pulls in the former."],
 "sections":[
  S("install","Install the FarmerChat SDK",
    DISTRIBUTION,
    SUB("Add the repository to your Gradle project"),
    P("The SDK resolves from your declared repositories. Today that means your local Maven cache; "
      "a hosted repository slots into the same block when one exists."),
    GRADLE_REPO,
    P("To populate <code>mavenLocal()</code>, publish once from the SDK checkout:"),
    CB([("shell","shell",None,"cd versions/v2/android\n./gradlew publishToMavenLocal")]),
    SUB("Add the dependency to your app"),
    CB([("Kotlin DSL","kotlin","app/build.gradle.kts","""dependencies {
    implementation("org.digitalgreen.farmerchat:farmerchat-android-compose:2.0.0")
}"""),
        ("Groovy","groovy","app/build.gradle","""dependencies {
    implementation 'org.digitalgreen.farmerchat:farmerchat-android-compose:2.0.0'
}""")]),
    ("warn","Toolchain floor",[
     "The Compose flavour needs <strong>AGP 8.13+</strong> and <code>minSdk 26</code>. Older "
     "toolchains fail at runtime with a <code>VerifyError</code> rather than at build time, so "
     "check this first if the journey crashes on launch."])),

  S("launch","Launch the journey",
    SUB("Initialize the SDK"),
    P("Call <code>initialize</code> once, from your <code>Application</code>. Everything else "
      "throws until you do."),
    CB([("Kotlin","kotlin","MyApp.kt","""class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()

        FarmerChat.initialize(
            this, // the Application IS the Context
            FarmerChatConfig.Builder(FarmerChatEnvironment.PROD)
                .guestApiKey("<your guest API key>")
                .geoApiKey("<your Google Geolocation key>")
                .languageCode("en")
                .defaultCountryCode("IN")
                .build()
        )
    }
}"""),
        ("Java","java","MyApp.java","""public class MyApp extends Application {
    @Override public void onCreate() {
        super.onCreate();

        FarmerChat.INSTANCE.initialize(
            this,
            new FarmerChatConfig.Builder(FarmerChatEnvironment.PROD)
                .guestApiKey("<your guest API key>")
                .geoApiKey("<your Google Geolocation key>")
                .languageCode("en")
                .defaultCountryCode("IN")
                .build()
        );
    }
}""")]),
    ANDROID_INIT_NOTE,
    SUB("Open the journey"),
    P("<code>launch</code> starts the SDK's own activity. This is the one-line integration."),
    CB([("Kotlin","kotlin",None,"""// From a composable
val context = LocalContext.current
Button(onClick = { FarmerChat.launch(context) }) {
    Text("Ask FarmerChat")
}"""),
        ("Java","java",None,"""findViewById(R.id.askButton).setOnClickListener(v ->
    FarmerChat.INSTANCE.launch(this)
);""")]),
    SUB("Or embed it in your own navigation"),
    P("<code>FarmerChatRoot</code> is the journey as a composable, for hosts that own their "
      "scaffold. It expects <code>initialize</code> to have run."),
    CB([("Kotlin","kotlin",None,"""composable("farmerchat") {
    FarmerChatRoot(modifier = Modifier.fillMaxSize())
}""")])),

  S("scope","Scope the experience",
    P("Every surface of the journey can be switched off. The defaults give the full farmer "
      "experience; trim it to fit your app."),
    TBL(["Option","What it controls"], CONFIG_ROWS),
    SUB("Chat only"),
    P("The most common trim: skip onboarding and the advice feed, and land the farmer directly in "
      "chat with history and language still reachable."),
    CB([("Kotlin","kotlin",None,"""FarmerChatConfig.Builder(FarmerChatEnvironment.PROD)
    .guestApiKey("<your guest API key>")
    .mode(FarmerChatMode.CHAT_ONLY)
    .showDrawer(false)    // moves history + language into the chat app bar
    .showHistory(true)    // past-advice icon
    .showSettings(false)
    .showNameScreen(false)
    .build()""")]),
    CHAT_ONLY_NOTE,
    SUB("Turn off a question mode"),
    CB([("Kotlin","kotlin",None,"""FarmerChatConfig.Builder(FarmerChatEnvironment.PROD)
    .enableVoice(false)   // no mic on the composer or the home tiles
    .enableImages(false)  // no camera
    .build()""")])),

  S("identity","Identity and authentication", *ANDROID_IDENTITY),
  S("theming","Theming", *ANDROID_THEME),
  S("labels","Labels and languages", *ANDROID_LABELS),
  S("analytics","Analytics", *ANDROID_ANALYTICS),

  S("permissions","Permissions",
    P("The SDK requests permissions at the moment a farmer uses the feature, and degrades "
      "gracefully when one is refused. You declare them; the host app owns the manifest."),
    CB([("AndroidManifest.xml","xml","app/src/main/AndroidManifest.xml",PERMS_ANDROID)]),
    P("Only declare what you enable. If you set <code>enableVoice(false)</code>, drop "
      "<code>RECORD_AUDIO</code> &mdash; a permission you never exercise still shows on your "
      "store listing.")),

  S("advanced","Advanced",
    SUB("Deep-link into a question"),
    CB([("Kotlin","kotlin",None,"""// Open chat already asking something
FarmerChat.openChat(context, question = "Why are my tomato leaves yellow?")

// Or reopen a past conversation
FarmerChat.openChat(context, conversationId = savedId)""")]),
    SUB("Streaming agentic chat"),
    P("Opt in to the streaming agentic endpoint. Left off, chat keeps the synchronous "
      "request/response contract."),
    CB([("Kotlin","kotlin",None,"""FarmerChatConfig.Builder(FarmerChatEnvironment.PROD)
    .enableAgenticChat(true)
    .build()""")]),
    SUB("Point at your own backend"),
    CB([("Kotlin","kotlin",None,"""FarmerChatConfig.Builder(FarmerChatEnvironment.PROD)
    .customBaseUrl("https://farmerchat.internal.example/")
    .build()""")])),
]}

VIEWS = {
 "id":"android-views","name":"Android","flavour":"XML Views","badge":"Kotlin · minSdk 26",
 "intro":["The Views flavour is for Android codebases that have not moved to Jetpack Compose. It "
   "runs the same journey through fragments and XML layouts, against the identical "
   "<code>farmerchat-core</code>, so behaviour and API match the Compose flavour.",
   "Reach for it when adding Compose to your app is the bigger change. If your app already uses "
   "Compose, prefer that flavour &mdash; it is the reference implementation."],
 "sections":[
  S("install","Install the FarmerChat SDK",
    DISTRIBUTION,
    SUB("Add the repository to your Gradle project"),
    GRADLE_REPO,
    SUB("Add the dependency to your app"),
    CB([("Kotlin DSL","kotlin","app/build.gradle.kts","""dependencies {
    implementation("org.digitalgreen.farmerchat:farmerchat-android-views:2.0.0")
}"""),
        ("Groovy","groovy","app/build.gradle","""dependencies {
    implementation 'org.digitalgreen.farmerchat:farmerchat-android-views:2.0.0'
}""")]),
    ("warn","Do not add both flavours",[
     "If a module ends up with <code>farmerchat-android-compose</code> on the classpath as well, "
     "the Compose implementation wins and you silently get that UI instead."])),

  S("launch","Launch the journey",
    SUB("Initialize the SDK"),
    P("Identical to the Compose flavour &mdash; <code>initialize</code> lives in "
      "<code>farmerchat-core</code> and is shared."),
    CB([("Kotlin","kotlin","MyApp.kt","""class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()

        FarmerChat.initialize(
            this,
            FarmerChatConfig.Builder(FarmerChatEnvironment.PROD)
                .guestApiKey("<your guest API key>")
                .geoApiKey("<your Google Geolocation key>")
                .languageCode("en")
                .defaultCountryCode("IN")
                .build()
        )
    }
}"""),
        ("Java","java","MyApp.java","""public class MyApp extends Application {
    @Override public void onCreate() {
        super.onCreate();

        FarmerChat.INSTANCE.initialize(
            this,
            new FarmerChatConfig.Builder(FarmerChatEnvironment.PROD)
                .guestApiKey("<your guest API key>")
                .geoApiKey("<your Google Geolocation key>")
                .build()
        );
    }
}""")]),
    ANDROID_INIT_NOTE,
    SUB("Open the journey"),
    CB([("Kotlin","kotlin",None,"askButton.setOnClickListener { FarmerChat.launch(this) }"),
        ("Java","java",None,"askButton.setOnClickListener(v -> FarmerChat.INSTANCE.launch(this));")]),
    SUB("Or embed the fragment"),
    P("<code>FarmerChatFragment</code> hosts the journey inside your own activity, for hosts that "
      "own the navigation container."),
    CB([("Kotlin","kotlin",None,"""supportFragmentManager.beginTransaction()
    .replace(R.id.container, FarmerChatFragment())
    .commit()""")])),

  S("scope","Scope the experience",
    P("The configuration surface is shared with the Compose flavour &mdash; same builder, same "
      "semantics."),
    TBL(["Option","What it controls"], CONFIG_ROWS),
    SUB("Chat only"),
    CB([("Kotlin","kotlin",None,"""FarmerChatConfig.Builder(FarmerChatEnvironment.PROD)
    .guestApiKey("<your guest API key>")
    .mode(FarmerChatMode.CHAT_ONLY)
    .showDrawer(false)
    .showHistory(true)
    .showSettings(false)
    .showNameScreen(false)
    .build()""")]),
    CHAT_ONLY_NOTE),

  S("identity","Identity and authentication", *ANDROID_IDENTITY),
  S("theming","Theming",
    P("Same theme object as Compose. The Views flavour resolves it into its own drawables and "
      "styles at runtime."),
    CB([("Kotlin","kotlin",None,"""FarmerChatConfig.Builder(FarmerChatEnvironment.PROD)
    .theme(
        FarmerChatTheme(
            brandPrimary = 0xFF00C950.toInt(),
            cardCornerRadius = 24,
            buttonCornerRadius = 999,
            inputCornerRadius = 12
        )
    )
    .messageFontSizeSp(15f)
    .build()""")])),
  S("labels","Labels and languages", *ANDROID_LABELS),
  S("analytics","Analytics", *ANDROID_ANALYTICS),
  S("permissions","Permissions",
    P("Declared by the host app; requested by the SDK at the point of use."),
    CB([("AndroidManifest.xml","xml","app/src/main/AndroidManifest.xml",PERMS_ANDROID)])),
  S("advanced","Advanced",
    SUB("Deep-link into a question"),
    CB([("Kotlin","kotlin",None,"""FarmerChat.openChat(context, question = "Why are my tomato leaves yellow?")
FarmerChat.openChat(context, conversationId = savedId)""")]),
    SUB("Streaming agentic chat"),
    CB([("Kotlin","kotlin",None,"""FarmerChatConfig.Builder(FarmerChatEnvironment.PROD)
    .enableAgenticChat(true)
    .build()""")]),
    ("note","Known gaps in this flavour",[
     "The Views flavour is a re-creation of the Compose screens rather than a port of the app, "
     "and a few affordances are not built: SIM-number prefill on the auth screen, the WhatsApp "
     "OTP-less vendor handoff, and the voice waveform animation."])),
]}
