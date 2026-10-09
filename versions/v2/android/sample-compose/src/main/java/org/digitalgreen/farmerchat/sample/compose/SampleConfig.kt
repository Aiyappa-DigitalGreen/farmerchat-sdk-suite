package org.digitalgreen.farmerchat.sample.compose

import android.content.Context
import android.util.Log
import org.digitalgreen.farmerchat.sdk.FarmerChatAppearance
import org.digitalgreen.farmerchat.sdk.FarmerChatConfig
import org.digitalgreen.farmerchat.sdk.FarmerChatEnvironment
import org.digitalgreen.farmerchat.sdk.FarmerChatMode
import org.digitalgreen.farmerchat.sdk.FarmerChatTheme
import org.digitalgreen.farmerchat.sdk.analytics.posthog.FarmerChatPostHog

/**
 * Verification harness for the Compose sample. A persisted "profile" selects the
 * FarmerChatConfig, so one sample exercises dev, the local mock, host theming,
 * CHAT_ONLY, the C3 toggles, and host string / locale overrides. Change the
 * profile via a launcher button (persists), then force-stop + relaunch.
 */
object SampleConfig {

    private const val PREFS = "fc_sample"
    private const val KEY_PROFILE = "profile"
    private const val TAG = "FcSampleCompose"

    const val MOCK_URL = "http://10.0.2.2:8899/"

    val PROFILES = listOf(
        "dev", "mock", "themed", "themed_mock", "chatonly", "togglesoff", "override", "studio",
        "agentic", "appstage"
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
            // Theme Studio round-trip: the config below is PASTED VERBATIM from what
            // theme-studio generates for Android (Get SDK ▸ Android). Its only job is to keep
            // the studio's generator honest — if a builder method is ever renamed or dropped,
            // this stops compiling here instead of in a host's app after they copy the snippet.
            "studio" -> b.theme(studioGeneratedTheme()).enableAnalytics(false)
            // 2.0.0 opt-in: agentic streaming chat + the unified InputComposer on Home and Chat
            // (instead of the Photo/Speak/Type row). Without this profile the streaming path and
            // the composer are unreachable at runtime, since `enableAgenticChat` defaults to
            // false — which left the COMPOSE harness unable to exercise the flagship 2.0.0
            // feature at all. Mirrors the same profile in sample-views.
            "agentic" -> b.enableAgenticChat(true)
            // Screen-fidelity harness: the reference app's `stage` flavour host, agentic on
            // (its source hardcodes the agentic + composer flags to true).
            "appstage" -> b.customBaseUrl("https://farmerchat.farmstack.co/mobile-app-stage/")
                .enableAgenticChat(true)
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
            else -> {}
        }
        return b.build()
    }

    /**
     * VERBATIM Theme Studio output (default preset) — do not hand-edit.
     *
     * Regenerate by opening the studio, Get SDK ▸ Android, and copying the `.theme(...)` block.
     * The `.enableAnalytics(false)` the studio also emits is applied at the call site above.
     */
    private fun studioGeneratedTheme(): FarmerChatTheme = FarmerChatTheme.builder()
        .brandPrimary(0xFF008236.toInt())
        .brandPrimaryDark(0xFF08361B.toInt())
        .brandAccent(0xFF00C950.toInt())
        .onBrand(0xFFFFFFFF.toInt())
        .background(0xFFFFFFFF.toInt())
        .readingSurface(0xFFF7F5EF.toInt())
        .cardSurface(0xFFFFFFFF.toInt())
        .onBackground(0xFF1C2B26.toInt())
        .onSurface(0xFF1C2B26.toInt())
        .error(0xFFC94F3D.toInt())
        // One dark override, so the guard covers the *Night emitter too — those ten methods are
        // the newest thing the studio prints and would otherwise be the only part never compiled.
        .brandPrimaryNight(0xFF101820.toInt())
        .cardCornerRadius(24)
        .buttonCornerRadius(999)
        .inputCornerRadius(12)
        .build()

    private fun blueTheme(): FarmerChatTheme = FarmerChatTheme.builder()
        .brandPrimary(0xFF1565C0.toInt())
        .brandPrimaryDark(0xFF0D47A1.toInt())
        .brandAccent(0xFF42A5F5.toInt())
        .build()
}
