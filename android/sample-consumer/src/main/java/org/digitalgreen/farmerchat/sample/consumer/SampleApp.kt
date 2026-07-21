package org.digitalgreen.farmerchat.sample.consumer

import android.app.Application
import android.util.Log
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.FarmerChatAppearance
import org.digitalgreen.farmerchat.sdk.FarmerChatConfig
import org.digitalgreen.farmerchat.sdk.FarmerChatEnvironment
import org.digitalgreen.farmerchat.sdk.FarmerChatTheme

/**
 * Host app that consumes the FarmerChat SDK **by Maven coordinate** from
 * mavenLocal() (see build.gradle.kts) — the distribution proof. It also supplies
 * a blue host [FarmerChatTheme] so the whole journey recolors from the built-in
 * green brand to the host palette (theming proof).
 */
class SampleApp : Application() {

    override fun onCreate() {
        super.onCreate()

        FarmerChat.initialize(
            this,
            FarmerChatConfig.builder(FarmerChatEnvironment.DEV)
                .appearance(FarmerChatAppearance.DAY)
                .theme(
                    FarmerChatTheme.builder()
                        .brandPrimary(0xFF1565C0.toInt())      // host blue (app bars)
                        .brandPrimaryDark(0xFF0D47A1.toInt())  // primary buttons / tiles
                        .brandAccent(0xFF42A5F5.toInt())       // chevrons / active dot / spinner
                        .cardCornerRadius(16)
                        .buttonCornerRadius(8)
                        .build()
                )
                .debugLogging(BuildConfig.DEBUG)
                .onEvent { name, props -> Log.d(TAG, "onEvent: $name $props") }
                .build()
        )
    }

    companion object {
        private const val TAG = "FcSampleConsumer"
    }
}
