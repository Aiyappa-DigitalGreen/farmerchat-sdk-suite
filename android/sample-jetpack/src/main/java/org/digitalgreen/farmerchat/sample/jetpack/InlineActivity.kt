package org.digitalgreen.farmerchat.sample.jetpack

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.digitalgreen.farmerchat.sdk.compose.FarmerChatInline

/**
 * COMPONENT-style usage (C1 inline embedding): FarmerChat is placed as a
 * composable *inside* the host's own screen — the host chrome stays visible and
 * the SDK occupies only the panel it's given, instead of taking over the whole
 * screen (as launch()/the FAB do).
 *
 * The whole integration is `FarmerChatInline(Modifier...)`; `FarmerChat.initialize`
 * already ran in [GreenAcresApp].
 */
class InlineActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Column(Modifier.fillMaxSize()) {
                    // ── Host chrome (your app owns this) ─────────────────────
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF2E7D32))
                            .padding(20.dp)
                    ) {
                        Text("GreenAcres", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                        Text("Advisor embedded in your screen", color = Color(0xFFDCEDDC), fontSize = 13.sp)
                    }
                    HostCard("Field: North paddy", "Stage: tillering · last irrigated 4 days ago")

                    Text(
                        "Ask the advisor",
                        Modifier.padding(start = 16.dp, top = 8.dp, bottom = 6.dp),
                        color = Color(0xFF1C2B26), fontSize = 14.sp, fontWeight = FontWeight.Bold
                    )

                    // ── The SDK, embedded as a COMPONENT in the host layout ──
                    // It fills only this panel (weight), framed by host UI above.
                    FarmerChatInline(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .padding(horizontal = 12.dp)
                            .padding(bottom = 12.dp)
                            .clip(RoundedCornerShape(16.dp))
                    )
                }
            }
        }
    }
}

@Composable
private fun HostCard(title: String, body: String) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(16.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(Color(0xFFF1F5F1))
            .padding(14.dp)
    ) {
        Text(title, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = Color(0xFF1C2B26))
        Text(body, fontSize = 13.sp, color = Color(0xFF55655B))
    }
}
