package org.digitalgreen.farmerchat.sdk.compose.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.StreamErrorKind

/**
 * Inline card shown when an agentic stream ends without a complete answer (2.0.0). Renders below
 * the AI response — below the preserved partial text, if any — with a state-specific message and a
 * full-width "Try again" action.
 *
 * Port of the app's `ui/chat/component/StreamErrorCard.kt` (fc-compose-agentic @ c0524dd6).
 *
 * The copy is driven by [errorKind] and [hasPartial], because "we lost the connection but kept
 * what you have" and "nothing arrived" are very different messages to a farmer:
 * - [hasPartial] → "Connection stopped. Your partial answer is saved."
 * - network      → "No internet connection"
 * - otherwise    → "Something went wrong"
 *
 * The tint comes from `feedbackFail` so a host that themes the SDK gets its own failure colour
 * rather than a hardcoded red.
 */
@Composable
fun StreamErrorCard(
    errorKind: StreamErrorKind,
    hasPartial: Boolean,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    val contentColors = LocalContentColors.current
    val brandColors = LocalBrandColors.current
    val type = MaterialTheme.typography

    val title = when {
        hasPartial -> label(
            Labels.CONNECTION_STOPPED_PARTIAL_SAVED,
            "Connection stopped. Your partial answer is saved."
        )
        errorKind == StreamErrorKind.NETWORK ->
            label(Labels.NO_INTERNET_CONNECTION, "No internet connection")
        else -> label(Labels.SOMETHING_WENT_WRONG, "Something went wrong")
    }

    val icon = if (errorKind == StreamErrorKind.NETWORK) Icons.Filled.WifiOff else Icons.Filled.Warning
    val fail = brandColors.feedbackFail
    val shape = SmoothShapes.rounded(Radius.MD)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(top = 16.dp)
            .clip(shape)
            .background(fail.copy(alpha = 0.08f))
            .border(1.dp, fail.copy(alpha = 0.16f), shape)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = fail,
                modifier = Modifier.size(20.dp)
            )
            Text(
                text = title,
                style = type.bodyMedium,
                color = contentColors.foregroundPrimary
            )
        }

        PrimaryButton(
            label = label(Labels.TRY_AGAIN, "Try again"),
            onClick = onRetry,
            modifier = Modifier.fillMaxWidth()
        )
    }
}
