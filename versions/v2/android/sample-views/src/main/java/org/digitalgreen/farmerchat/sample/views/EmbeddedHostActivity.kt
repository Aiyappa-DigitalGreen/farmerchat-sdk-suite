package org.digitalgreen.farmerchat.sample.views

import android.os.Bundle
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import androidx.core.view.updatePadding
import org.digitalgreen.farmerchat.sdk.FarmerChatLaunch
import org.digitalgreen.farmerchat.sdk.views.FarmerChatComposerFragment
import org.digitalgreen.farmerchat.sdk.views.FarmerChatFragment

/**
 * A host shaped like Econet's MainActivity: edge-to-edge, with a `fitsSystemWindows`
 * CoordinatorLayout root that keeps its content below the status bar yet still passes the insets
 * on. Guards the embedded fragment against padding for the system bars a second time.
 *
 * With `--ez composer true` it is a host DASHBOARD instead: host content plus the SDK's
 * [FarmerChatComposerFragment]; a submission opens the SDK chat with that launch.
 *
 * `adb shell am start -n org.digitalgreen.farmerchat.sample.views/.EmbeddedHostActivity [--ez composer true]`
 */
class EmbeddedHostActivity : AppCompatActivity(), FarmerChatComposerFragment.Listener {

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_embedded_host)
        val dashboard = intent.getBooleanExtra("composer", false)
        findViewById<TextView>(R.id.embeddedDashboard).isVisible = dashboard
        if (savedInstanceState == null) {
            supportFragmentManager.beginTransaction()
                .replace(
                    R.id.embeddedContainer,
                    if (dashboard) FarmerChatComposerFragment() else FarmerChatFragment()
                )
                .commit()
        }
    }

    override fun onFarmerChatComposerSubmit(launch: FarmerChatLaunch) {
        findViewById<TextView>(R.id.embeddedDashboard).isVisible = false
        supportFragmentManager.beginTransaction()
            .replace(R.id.embeddedContainer, FarmerChatFragment.newInstance(launch))
            .addToBackStack(null)
            .commit()
    }

    override fun onFarmerChatComposerHeightChanged(heightPx: Int) {
        findViewById<TextView>(R.id.embeddedDashboard).updatePadding(bottom = heightPx)
    }
}
