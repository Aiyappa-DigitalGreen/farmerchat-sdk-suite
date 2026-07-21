package org.digitalgreen.farmerchat.sample.compose

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.FarmerChatFab

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        intent?.getStringExtra("profile")?.let { SampleConfig.setProfile(this, it) }

        setContent {
            MaterialTheme {
                val context = LocalContext.current
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
                        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("Host app (Compose)", style = MaterialTheme.typography.titleMedium)
                        Text(
                            "profile: ${SampleConfig.current(context)}",
                            style = MaterialTheme.typography.titleSmall
                        )
                        Text("Authenticated: $authenticated", style = MaterialTheme.typography.bodyMedium)
                        Button(onClick = { FarmerChat.launch(this@MainActivity) }) {
                            Text("Launch journey")
                        }
                        OutlinedButton(onClick = {
                            FarmerChat.openChat(this@MainActivity, question = "How do I protect my maize from armyworm?")
                        }) { Text("Open chat with a question") }
                        OutlinedButton(onClick = {
                            startActivity(Intent(this@MainActivity, InlineActivity::class.java))
                        }) { Text("Embed inline (composable)") }
                        OutlinedButton(onClick = { FarmerChat.logout() }) { Text("Logout") }
                    }
                }
            }
        }
    }
}
