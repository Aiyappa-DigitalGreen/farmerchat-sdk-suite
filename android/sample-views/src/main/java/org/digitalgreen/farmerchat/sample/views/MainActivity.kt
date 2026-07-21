package org.digitalgreen.farmerchat.sample.views

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import org.digitalgreen.farmerchat.sample.views.databinding.ActivityMainBinding
import org.digitalgreen.farmerchat.sdk.FarmerChat

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var unsubscribeAuth: (() -> Unit)? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // A `profile` extra (from adb) persists a new verification profile; the app
        // must then be force-stopped + relaunched for Application.onCreate to apply it.
        intent?.getStringExtra("profile")?.let { SampleConfig.setProfile(this, it) }

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.profileText.text = "profile: ${SampleConfig.current(this)}"

        unsubscribeAuth = FarmerChat.onAuthStateChanged { authenticated ->
            runOnUiThread { binding.authStateText.text = "Authenticated: $authenticated" }
        }

        binding.launchButton.setOnClickListener { FarmerChat.launch(this) }
        binding.openChatButton.setOnClickListener {
            FarmerChat.openChat(this, question = "How do I protect my maize from armyworm?")
        }
        binding.inlineButton.setOnClickListener {
            startActivity(Intent(this, InlineActivity::class.java))
        }
        binding.logoutButton.setOnClickListener { FarmerChat.logout() }
    }

    override fun onDestroy() {
        unsubscribeAuth?.invoke()
        super.onDestroy()
    }
}
