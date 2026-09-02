package org.digitalgreen.farmerchat.sample.compose

import android.app.Application
import android.util.Log
import org.digitalgreen.farmerchat.sdk.FarmerChat

/**
 * Minimal host app demonstrating FarmerChat.initialize(config) with the config
 * selected by [SampleConfig] (verification profile) + an event-logging listener.
 */
class SampleApp : Application() {

    override fun onCreate() {
        super.onCreate()

        val profile = SampleConfig.current(this)
        Log.i(TAG, "initializing FarmerChat with profile=$profile")
        FarmerChat.initialize(this, SampleConfig.build(profile))

        FarmerChat.setAnalyticsListener { name, properties ->
            Log.i(TAG, "analytics: $name -> $properties")
        }
    }

    companion object {
        private const val TAG = "FcSampleCompose"
    }
}
