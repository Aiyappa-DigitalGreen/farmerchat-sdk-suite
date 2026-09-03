package org.digitalgreen.farmerchat.sdk.compose.components

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes

@Composable
fun ListCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    val colors = LocalContentColors.current

    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(SmoothShapes.rounded(Radius.MD))
            .background(colors.surfaceSecondary)
            .padding(start = 16.dp, end = 16.dp, top = 6.dp, bottom = 4.dp),
        content = content
    )
}

@Composable
fun ListItem(
    textLeft: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    @DrawableRes iconRes: Int? = null,
    showIcon: Boolean = icon != null || iconRes != null,
    textRight: String? = null,
    showTextRight: Boolean = textRight != null,
    textRightMaxLines: Int = 1,
    showChevron: Boolean = true,
    /**
     * 2.0.0: replaces the chevron with a small spinner while an action raised by this row is in
     * flight (Settings' "My Farm" location row during acquisition). Takes precedence over
     * [showChevron], matching the app, so a call site does not have to clear the chevron too.
     */
    showTrailingSpinner: Boolean = false,
    showDivider: Boolean = false
) {
    val colors = LocalContentColors.current
    val hasIcon = icon != null || iconRes != null
    val multilineRight = textRightMaxLines > 1

    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .then(
                    if (multilineRight) Modifier.padding(vertical = 12.dp)
                    else Modifier.height(48.dp)
                )
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = onClick
                ),
            verticalAlignment = if (multilineRight) Alignment.Top else Alignment.CenterVertically
        ) {
            if (showIcon && hasIcon) {
                if (iconRes != null) {
                    Image(
                        painter = painterResource(id = iconRes),
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                        colorFilter = ColorFilter.tint(colors.foregroundPrimary)
                    )
                } else if (icon != null) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                        tint = colors.foregroundPrimary
                    )
                }
                Spacer(modifier = Modifier.width(12.dp))
            }

            Text(
                text = textLeft,
                style = MaterialTheme.typography.bodyMedium,
                color = colors.foregroundPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = if (multilineRight) Modifier else Modifier.weight(1f)
            )

            if (showTextRight && textRight != null) {
                Spacer(modifier = Modifier.width(12.dp))
                if (multilineRight) {
                    Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.TopEnd) {
                        Text(
                            text = textRight,
                            style = MaterialTheme.typography.bodyMedium,
                            color = colors.foregroundSecondary,
                            maxLines = textRightMaxLines,
                            overflow = TextOverflow.Ellipsis,
                            textAlign = TextAlign.End
                        )
                    }
                } else {
                    Text(
                        text = textRight,
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.foregroundSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            if (showTrailingSpinner) {
                Spacer(modifier = Modifier.width(12.dp))
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp,
                    color = colors.foregroundSecondary
                )
            } else if (showChevron) {
                Spacer(modifier = Modifier.width(12.dp))
                Icon(
                    imageVector = Icons.AutoMirrored.Outlined.KeyboardArrowRight,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                    tint = colors.foregroundPrimary
                )
            }
        }

        if (showDivider) {
            HorizontalDivider(
                modifier = Modifier.fillMaxWidth(),
                thickness = 1.dp,
                color = colors.borderDefault
            )
        }
    }
}
