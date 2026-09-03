package org.digitalgreen.farmerchat.sample.views

import android.content.Context
import android.util.Log
import org.digitalgreen.farmerchat.sdk.FarmerChatAppearance
import org.digitalgreen.farmerchat.sdk.FarmerChatConfig
import org.digitalgreen.farmerchat.sdk.FarmerChatEnvironment
import org.digitalgreen.farmerchat.sdk.FarmerChatMode
import org.digitalgreen.farmerchat.sdk.FarmerChatTheme

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

    val PROFILES = listOf(
        "dev", "mock", "themed", "themed_mock", "chatonly", "togglesoff", "override", "agentic"
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
            .debugLogging(true)
            .onEvent { name, props -> Log.d(TAG, "onEvent: $name $props") }
            // Identity + user attributes: a host forwards these to its own analytics vendor
            // (MoEngage setUserAttribute / Firebase setUserProperty / ...). No vendor SDK lives
            // inside the SDK packages.
            .onUserIdentified { userId -> Log.i(TAG, "onUserIdentified: $userId") }
            .onUserAttribute { key, value -> Log.i(TAG, "onUserAttribute: $key = $value") }
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
