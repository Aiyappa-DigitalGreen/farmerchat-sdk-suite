package org.digitalgreen.farmerchat.sample.views

import android.content.Context
import android.util.Log
import org.digitalgreen.farmerchat.sdk.FarmerChatAppearance
import org.digitalgreen.farmerchat.sdk.FarmerChatConfig
import org.digitalgreen.farmerchat.sdk.FarmerChatEnvironment
import org.digitalgreen.farmerchat.sdk.FarmerChatMode
import org.digitalgreen.farmerchat.sdk.FarmerChatTheme
import org.digitalgreen.farmerchat.sdk.analytics.posthog.FarmerChatPostHog

/**
 * Verification harness for the Views sample: a persisted "profile" selects which
 * FarmerChatConfig the SDK is initialized with, so a single sample can exercise
 * dev, the local mock, host theming, CHAT_ONLY, the C3 toggles, and host string /
 * locale overrides. Change the profile via the launcher buttons (persists), then
 * force-stop + relaunch so Application.onCreate rebuilds the graph.
 */
object SampleConfig {

    private const val PREFS = "fc_sample"
    private const val KEY_PROFILE = "profile"
    private const val TAG = "FcSampleViews"

    /** Mock backend as seen from the emulator (also via `adb reverse tcp:8899`). */
    const val MOCK_URL = "http://10.0.2.2:8899/"

    /**
     * The reference app's `stage` flavour host (fc-compose-agentic `app/build.gradle.kts`). The
     * SDK's own STAGE enum now points at the agentic demo backend, so side-by-side screen checks
     * against an installed stage build of the app need this exact host to get the same labels,
     * language list and feed.
     */
    const val APP_STAGE_URL = "https://farmerchat.farmstack.co/mobile-app-stage/"

    val PROFILES = listOf(
        "dev", "mock", "themed", "themed_mock", "chatonly", "togglesoff", "override", "agentic", "appstage", "econet"
    )

    fun current(ctx: Context): String =
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_PROFILE, "dev") ?: "dev"

    fun setProfile(ctx: Context, profile: String) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_PROFILE, profile).commit()
    }

    fun build(profile: String): FarmerChatConfig {
        val b = FarmerChatConfig.builder(FarmerChatEnvironment.DEV)
            .appearance(FarmerChatAppearance.AUTO)
            // The SDK defaults to CHAT_ONLY; this harness exercises the whole journey (onboarding,
            // Home, drawer, settings), so it opts in here. The "chatonly" profile switches back.
            .mode(FarmerChatMode.FULL_JOURNEY)
            .debugLogging(true)
            // The verification harness must still SEE events — enableAnalytics defaults to false
            // in 2.0.0 so a host emits no telemetry until it opts in.
            .enableAnalytics(true)
            // Logged AND forwarded to PostHog. Deliberately not `FarmerChatPostHog.attach(b)`
            // here: attach() REPLACES these callbacks, and the harness has to keep its own
            // logging. A real host with nothing else wired should just call attach().
            .onEvent { name, props ->
                Log.d(TAG, "onEvent: $name $props")
                FarmerChatPostHog.track(name, props)
            }
            // Identity + user attributes go to the host's own analytics vendor. No vendor SDK
            // lives inside the SDK packages (root CLAUDE.md §6) — `farmerchat-analytics-posthog`
            // is a separate, opt-in artifact, which is why it can be referenced from here.
            .onUserIdentified { userId ->
                Log.i(TAG, "onUserIdentified: $userId")
                FarmerChatPostHog.identify(userId)
            }
            .onUserAttribute { key, value ->
                Log.i(TAG, "onUserAttribute: $key = $value")
                FarmerChatPostHog.setUserProperty(key, value)
            }
            .onSessionExpired { Log.w(TAG, "session expired") }
            .onChatOpened { Log.i(TAG, "hook onChatOpened") }
            .onMessageSent { text -> Log.i(TAG, "hook onMessageSent: $text") }
            .onAnswerReceived { id -> Log.i(TAG, "hook onAnswerReceived: $id") }
            .onScreenView { name -> Log.i(TAG, "hook onScreenView: $name") }

        when (profile) {
            "mock" -> b.customBaseUrl(MOCK_URL)
            "themed" -> b.theme(blueTheme())
            "themed_mock" -> b.customBaseUrl(MOCK_URL).theme(blueTheme())
            "chatonly" -> b.customBaseUrl(MOCK_URL).mode(FarmerChatMode.CHAT_ONLY)
            "togglesoff" -> b
                .showSettings(false)
                .showHistory(false)
                .showDrawer(false)
                .enableWeather(false)
                .enableSsfr(false)
            "override" -> b
                .locale("hi")
                .stringOverrides(
                    mapOf(
                        "fc_v2_app_label_type" to "TYPE✦",
                        "fc_v2_app_label_speak" to "SPEAK✦",
                        "fc_v2_app_label_photo" to "PHOTO✦"
                    )
                )
            // 2.0.0 opt-in: agentic streaming chat + the unified InputComposer on Home and
            // Chat (instead of the Photo/Speak/Type row). Without this profile the composer is
            // unreachable at runtime, since `enableAgenticChat` defaults to false.
            "agentic" -> b.enableAgenticChat(true)
            // Screen-fidelity harness: same backend as the installed stage build of the app.
            // Agentic ON: the app's source hardcodes `getAgenticChatEnabled()` and
            // `getComposerUiEnabled()` to true (OnboardingRemoteConfig.kt), so a build from
            // source always shows the composer Home and streams agentic answers.
            "appstage" -> b.customBaseUrl(APP_STAGE_URL).enableAgenticChat(true)
            // Econet-shaped host: CHAT_ONLY, light, navy brand with a navy accent, and the agentic
            // chat UI over the synchronous #27 endpoint (its backend has no #27a).
            "econet" -> b.customBaseUrl(MOCK_URL)
                .mode(FarmerChatMode.CHAT_ONLY)
                .appearance(FarmerChatAppearance.DAY)
                .showDrawer(false)
                .showSettings(false)
                .simulateAgenticStream(true)
                .theme(
                    FarmerChatTheme.builder()
                        .brandPrimary(0xFF2C318C.toInt())
                        .brandPrimaryDark(0xFF223263.toInt())
                        .brandAccent(0xFF2C318C.toInt())
                        .onBrand(0xFFFFFFFF.toInt())
                        .background(0xFFFFFFFF.toInt())
                        .build()
                )
            else -> {} // "dev": plain DEV backend, green brand, full journey
        }
        return b.build()
    }

    /** Host blue palette used to prove theme recolor (replaces the green brand). */
    private fun blueTheme(): FarmerChatTheme = FarmerChatTheme.builder()
        .brandPrimary(0xFF1565C0.toInt())
        .brandPrimaryDark(0xFF0D47A1.toInt())
        .brandAccent(0xFF42A5F5.toInt())
        .build()
}
