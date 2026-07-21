package org.digitalgreen.farmerchat.sdk.compose

import androidx.compose.foundation.layout.size
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.theme.Green700

private fun hostBrandColor(): Color? =
    runCatching { FarmerChat.requireGraph().config.theme?.brandPrimary?.let { Color(it) } }.getOrNull()

private fun hostOnBrandColor(): Color? =
    runCatching { FarmerChat.requireGraph().config.theme?.onBrand?.let { Color(it) } }.getOrNull()

/**
 * Drop-in floating action button that opens FarmerChat. Place it in a Scaffold's
 * `floatingActionButton` slot (or anywhere) — no other wiring needed beyond
 * [FarmerChat.initialize] at app startup.
 *
 * @param question when set, tapping deep-links straight into a chat asking it
 *        (via [FarmerChat.openChat]); when null the full journey launches.
 * @param label when set, renders as an extended FAB with this text.
 */
@Composable
fun FarmerChatFab(
    modifier: Modifier = Modifier,
    question: String? = null,
    label: String? = null,
    containerColor: Color = hostBrandColor() ?: Green700,
    contentColor: Color = hostOnBrandColor() ?: Color.White
) {
    val context = LocalContext.current
    val onClick = {
        if (question != null) FarmerChat.openChat(context, question = question)
        else FarmerChat.launch(context)
    }
    val icon: @Composable () -> Unit = {
        Icon(
            painter = painterResource(R.drawable.fc_logo_mark),
            contentDescription = "FarmerChat",
            modifier = Modifier.size(24.dp),
            tint = contentColor
        )
    }
    if (label != null) {
        ExtendedFloatingActionButton(
            onClick = onClick,
            modifier = modifier,
            containerColor = containerColor,
            contentColor = contentColor,
            icon = icon,
            text = { Text(label) }
        )
    } else {
        FloatingActionButton(
            onClick = onClick,
            modifier = modifier,
            containerColor = containerColor,
            contentColor = contentColor
        ) { icon() }
    }
}
