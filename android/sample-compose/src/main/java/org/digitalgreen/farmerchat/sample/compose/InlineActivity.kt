package org.digitalgreen.farmerchat.sample.compose

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import org.digitalgreen.farmerchat.sdk.compose.FarmerChatInline

/**
 * Demonstrates C1 inline embedding of the Compose SDK: FarmerChatInline placed
 * inside a host layout (not a full-screen launch), sharing the screen with host
 * chrome above it.
 */
class InlineActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            Column(modifier = Modifier.fillMaxSize()) {
                Text(
                    "HOST CHROME — FarmerChatInline embedded below",
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFFFEB3B))
                        .padding(12.dp)
                )
                FarmerChatInline(modifier = Modifier.weight(1f))
            }
        }
    }
}
