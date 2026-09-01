package org.digitalgreen.farmerchat.sample.jetpack

import android.app.Application
import org.digitalgreen.farmerchat.sdk.FarmerChat

/**
 * Host app. The only SDK wiring required is a single [FarmerChat.initialize]
 * call at startup with your config (see [FarmerChatSetup]).
 */
class GreenAcresApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FarmerChat.initialize(this, FarmerChatSetup.config())
    }
}
