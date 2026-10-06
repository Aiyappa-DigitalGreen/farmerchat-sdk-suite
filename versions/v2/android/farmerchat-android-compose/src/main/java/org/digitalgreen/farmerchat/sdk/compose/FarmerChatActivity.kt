package org.digitalgreen.farmerchat.sdk.compose

import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.theme.FarmerChatTheme
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences

/**
 * Single-activity host for the full FarmerChat journey (Compose UI package
 * entry point). Launch via FarmerChat.launch(context) / FarmerChat.openChat(...).
 *
 * Manages appearance mode (day/night/auto → darkTheme) and the language code
 * (typography per script), wraps everything in FarmerChatTheme, renders
 * FarmerChatRoot() (which includes the LocationPromptHost overlay + toast).
 */
class FarmerChatActivity : ComponentActivity() {

    private var appearanceModeState = mutableStateOf("auto")
    private var languageCodeState = mutableStateOf("en")
    private var newIntentTickState = mutableIntStateOf(0)

    /**
     * Whether this instance came back from a process death rather than a cold start. Android
     * kills the app when a runtime permission is toggled in system Settings — the flow the SDK
     * sends a farmer through for the microphone — so this is the common case, not an edge case.
     */
    private var isRecreated = false

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        isRecreated = savedInstanceState != null

        if (!FarmerChat.isInitialized) {
            Log.e(
                "FarmerChatActivity",
                "FarmerChat is not initialized. Call FarmerChat.initialize(context, config) " +
                    "before launching FarmerChatActivity."
            )
            finish()
            return
        }

        val graph = FarmerChat.requireGraph()
        appearanceModeState.value = graph.prefs
            .getString(SdkPreferences.Keys.APPEARANCE_MODE, "auto").ifBlank { "auto" }
        languageCodeState.value = graph.prefs
            .getString(SdkPreferences.Keys.SELECTED_LANGUAGE_CODE, "en").ifBlank { "en" }

        // Intent extras are informational here: FarmerChat.openChat already saved
        // the pending target through the RouteDecider before starting the activity.
        consumeOpenChatExtras(intent)

        setContent {
            val appearanceMode by appearanceModeState
            val languageCode by languageCodeState
            val newIntentTick by newIntentTickState

            val darkTheme = when (appearanceMode) {
                "day" -> false
                "night" -> true
                else -> isSystemInDarkTheme()
            }

            FarmerChatTheme(
                darkTheme = darkTheme,
                languageCode = languageCode
            ) {
                FarmerChatRoot(
                    onAppearanceModeChanged = { mode -> appearanceModeState.value = mode },
                    onLanguageChanged = { code -> languageCodeState.value = code },
                    newIntentTick = newIntentTick,
                    isRecreated = isRecreated
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (consumeOpenChatExtras(intent)) {
            newIntentTickState.intValue++
        }
    }

    /**
     * Returns true when the intent carries openChat extras. The pending target
     * itself is persisted by FarmerChat.openChat via RouteDecider.savePendingTarget;
     * extras only signal that a (re-)route is wanted.
     */
    private fun consumeOpenChatExtras(intent: Intent?): Boolean {
        val question = intent?.getStringExtra(FarmerChat.EXTRA_OPEN_CHAT_QUESTION)
        val conversationId = intent?.getStringExtra(FarmerChat.EXTRA_OPEN_CHAT_CONVERSATION_ID)
        return !question.isNullOrBlank() || !conversationId.isNullOrBlank()
    }
}
