package org.digitalgreen.farmerchat.sample.views

import android.app.Application
import android.util.Log
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.analytics.posthog.FarmerChatPostHog

/**
 * Minimal host app for the Views (XML + Fragments) SDK artifact. Initializes with
 * the config selected by [SampleConfig] (verification profile) + logs every event.
 */
class SampleApp : Application() {

    override fun onCreate() {
        super.onCreate()

        // PostHog first: the SDK emits `App_Opened` during initialize(), so a sink wired after
        // that point silently misses the launch event. A blank key (no local.properties entry)
        // leaves PostHog off and logs it — the harness still runs.
        FarmerChatPostHog.setup(
            context = this,
            apiKey = BuildConfig.POSTHOG_API_KEY,
            host = BuildConfig.POSTHOG_HOST,
            appFlavor = SampleConfig.current(this),
            isDebug = BuildConfig.DEBUG
        )

        val profile = SampleConfig.current(this)
        Log.i(TAG, "initializing FarmerChat with profile=$profile")
        FarmerChat.initialize(this, SampleConfig.build(profile))

        FarmerChat.setAnalyticsListener { name, properties ->
            Log.i(TAG, "analytics: $name -> $properties")
        }
    }

    companion object {
        private const val TAG = "FcSampleViews"
    }
}
