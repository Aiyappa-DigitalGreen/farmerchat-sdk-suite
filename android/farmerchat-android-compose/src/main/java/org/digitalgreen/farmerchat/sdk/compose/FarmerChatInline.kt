package org.digitalgreen.farmerchat.sdk.compose

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.theme.FarmerChatTheme
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences

/**
 * C1: the full FarmerChat journey as a host-placeable composable (not a full-screen
 * Activity launch). Fills the space its [modifier] gives it. Wraps [FarmerChatRoot]
 * in [FarmerChatTheme] (host theme + appearance + per-language typography), exactly
 * like [FarmerChatActivity] but embeddable in any host Compose tree.
 *
 * [FarmerChat.initialize] must have been called first.
 */
@Composable
fun FarmerChatInline(modifier: Modifier = Modifier) {
    val graph = FarmerChat.requireGraph()

    val appearanceMode = rememberSaveable {
        graph.prefs.getString(SdkPreferences.Keys.APPEARANCE_MODE, "auto").ifBlank { "auto" }
    }
    var languageCode by remember {
        mutableStateOf(
            graph.prefs.getString(SdkPreferences.Keys.SELECTED_LANGUAGE_CODE, "en").ifBlank { "en" }
        )
    }

    val darkTheme = when (appearanceMode) {
        "day" -> false
        "night" -> true
        else -> isSystemInDarkTheme()
    }

    FarmerChatTheme(darkTheme = darkTheme, languageCode = languageCode) {
        FarmerChatRoot(
            modifier = modifier.fillMaxSize(),
            onLanguageChanged = { code -> languageCode = code }
        )
    }
}
