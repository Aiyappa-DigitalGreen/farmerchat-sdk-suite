package org.digitalgreen.farmerchat.sample.views

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import org.digitalgreen.farmerchat.sdk.views.FarmerChatFragment

/**
 * Demonstrates C1 inline embedding of the Views SDK: FarmerChatFragment placed
 * inside a host layout (not a full-screen launch), sharing the screen with host
 * chrome above it.
 */
class InlineActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_inline)
        if (savedInstanceState == null) {
            supportFragmentManager.beginTransaction()
                .replace(R.id.inlineContainer, FarmerChatFragment())
                .commit()
        }
    }
}
