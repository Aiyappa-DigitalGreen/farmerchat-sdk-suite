package org.digitalgreen.farmerchat.sample.jetpack

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.Button
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.digitalgreen.farmerchat.sdk.compose.FarmerChatFab

/**
 * A plain host-app screen (a mock "GreenAcres" farm dashboard). The only
 * FarmerChat touch-point is [FarmerChatFab] in the Scaffold's FAB slot — tapping
 * it opens the FarmerChat chat screen (CHAT_ONLY mode, see [FarmerChatSetup]).
 *
 * To instead deep-link into chat with a starter question:
 *   FarmerChatFab(question = "How do I treat leaf rust on wheat?")
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Scaffold(
                    // The whole integration in the UI: drop the FAB in. It reads
                    // the label/colors from FarmerChatSetup's config.
                    floatingActionButton = { FarmerChatFab() }
                ) { padding ->
                    Dashboard(
                        modifier = Modifier.padding(padding),
                        onOpenInline = { startActivity(Intent(this, InlineActivity::class.java)) }
                    )
                }
            }
        }
    }
}

@Composable
private fun Dashboard(modifier: Modifier = Modifier, onOpenInline: () -> Unit = {}) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
    ) {
        // Host app header (your own branding — not the SDK).
        Column(
            Modifier
                .fillMaxWidth()
                .background(Color(0xFF2E7D32))
                .padding(20.dp)
        ) {
            Text("GreenAcres", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
            Text("Good morning, Aiyappa", color = Color(0xFFDCEDDC), fontSize = 14.sp)
        }

        Column(
            Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            InfoCard("Today's weather", "28°C · light clouds · good day to irrigate")
            InfoCard("Crop tip", "Sow wheat between Nov 1–15 for the best yield in your region.")
            InfoCard("Need advice?", "Tap “Ask FarmerChat” (bottom-right) for the full-screen assistant.")
            // Inline-embed button intentionally hidden: the demo surface is the
            // FarmerChatFab ("Ask FarmerChat", bottom-right). InlineActivity is still
            // wired via onOpenInline and reachable directly for C1 testing.
        }
    }
}

@Composable
private fun InfoCard(title: String, body: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(title, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color(0xFF1C2B26))
            Text(body, fontSize = 14.sp, color = Color(0xFF55655B))
        }
    }
}
