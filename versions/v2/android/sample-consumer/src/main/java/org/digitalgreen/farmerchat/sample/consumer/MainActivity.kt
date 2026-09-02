package org.digitalgreen.farmerchat.sample.consumer

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.FarmerChatVersion
import org.digitalgreen.farmerchat.sdk.compose.FarmerChatFab

/**
 * Host screen. The FarmerChat SDK is on the classpath purely via the published
 * Maven coordinate (mavenLocal). The green FAB launches the full SDK journey.
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                var authenticated by remember { mutableStateOf(FarmerChat.isAuthenticated) }
                remember { FarmerChat.onAuthStateChanged { authenticated = it } }
                Scaffold(
                    floatingActionButton = { FarmerChatFab() }
                ) { padding ->
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(padding)
                            .padding(24.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("Coordinate-consumer host", style = MaterialTheme.typography.titleMedium)
                        Text(
                            "FarmerChat SDK ${FarmerChatVersion.VERSION} imported by Maven coordinate " +
                                "(org.digitalgreen.farmerchat:farmerchat-android-compose).",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Text("Authenticated: $authenticated", style = MaterialTheme.typography.bodyMedium)
                        OutlinedButton(onClick = {
                            FarmerChat.openChat(this@MainActivity, question = "How do I protect my maize from armyworm?")
                        }) {
                            Text("Open chat with a question")
                        }
                        OutlinedButton(onClick = { FarmerChat.launch(this@MainActivity) }) {
                            Text("Launch full journey")
                        }
                    }
                }
            }
        }
    }
}
