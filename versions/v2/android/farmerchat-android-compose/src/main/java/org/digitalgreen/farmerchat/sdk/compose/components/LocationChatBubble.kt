package org.digitalgreen.farmerchat.sdk.compose.components


import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import org.digitalgreen.farmerchat.sdk.compose.R
import org.digitalgreen.farmerchat.sdk.compose.theme.FarmerChatTheme
import org.digitalgreen.farmerchat.sdk.compose.theme.Green500
import org.digitalgreen.farmerchat.sdk.compose.theme.Green500_16
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius


/**
 * A chat bubble that displays a location the user has shared, shown after location permission
 * is granted. Renders a map-style header with a location pin and a footer with the resolved
 * address (e.g. "Nandi Hills, Nandi County, Kenya").
 *
 * @param address The human-readable address to display (e.g. display_address from the location response)
 * @param modifier Modifier for the bubble
 * @param label The caption shown above the address (default "Your location:")
 */
@Composable
fun LocationChatBubble(
    address: String,
    modifier: Modifier = Modifier,
    label: String = "Your location:"
) {
    val contentColors = LocalContentColors.current

    // Asymmetric shape: 3 corners rounded (XL = 20dp), bottom-right sharp (matches UserChatBubble)
    val bubbleShape = RoundedCornerShape(
        topStart = Radius.XL,
        topEnd = Radius.XL,
        bottomStart = Radius.XL,
        bottomEnd = 0.dp
    )

    // Figma card: fixed 290 x 184.
    Column(
        modifier = modifier
            .size(width = 290.dp, height = 184.dp)
            .clip(bubbleShape)
            .background(contentColors.surfaceReadingSecondary)
    ) {
        // Map-style header with centered location pin — fills the height left above the address footer.
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .background(Green500_16),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    imageVector = Icons.Filled.LocationOn,
                    contentDescription = null,
                    tint = Green500,
                    modifier = Modifier.size(44.dp)
                )
                Image(
                    painter = painterResource(id = R.drawable.fc_ellipse_icon),
                    contentDescription = null,
                    modifier = Modifier.size(width = 28.dp, height = 8.dp)
                )
            }
        }

        // Footer with label + resolved address
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = contentColors.foregroundSecondary
            )
            Text(
                text = address,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = contentColors.foregroundPrimary
            )
        }
    }
}

@Preview(showBackground = true, backgroundColor = 0xFFFFFFFF)
@Composable
private fun LocationChatBubblePreview() {
    FarmerChatTheme {
        LocationChatBubble(
            address = "Nandi Hills, Nandi County, Kenya"
        )
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF18181B)
@Composable
private fun LocationChatBubbleDarkPreview() {
    FarmerChatTheme(darkTheme = true) {
        LocationChatBubble(
            address = "Nandi Hills, Nandi County, Kenya"
        )
    }
}
