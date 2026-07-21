package org.digitalgreen.farmerchat.sdk.compose.components

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.vectorResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.SubcomposeAsyncImage
import org.digitalgreen.farmerchat.sdk.compose.R
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.core.labels.Labels

enum class PrimaryButtonState { Default, Chevron, Loading }

enum class IconPosition { Leading, Trailing }

@Composable
fun PrimaryButton(
    label: String,
    state: PrimaryButtonState = PrimaryButtonState.Default,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    @DrawableRes iconRes: Int? = null,
    iconPosition: IconPosition = IconPosition.Trailing,
    height: Int = 48,
    interactionSource: MutableInteractionSource? = null,
    radius: Dp = org.digitalgreen.farmerchat.sdk.compose.theme.LocalFcShapes.current.button,
    enabled: Boolean = true
) {
    val c = LocalContentColors.current
    val shape = SmoothShapes.rounded(radius)
    val hasCustomIcon = (icon != null || iconRes != null) && state != PrimaryButtonState.Loading
    val startPad =
        if (hasCustomIcon && iconPosition == IconPosition.Leading) 8.dp
        else if (state == PrimaryButtonState.Chevron || hasCustomIcon || state == PrimaryButtonState.Loading) 16.dp
        else 24.dp
    val endPad =
        if (hasCustomIcon && iconPosition == IconPosition.Trailing) 8.dp
        else if (state == PrimaryButtonState.Chevron || state == PrimaryButtonState.Loading) 8.dp
        else 16.dp
    val isEnabled = enabled && state != PrimaryButtonState.Loading

    Surface(
        modifier = modifier
            .height(height.dp)
            .clip(shape)
            .clickable(
                indication = null,
                enabled = isEnabled,
                onClick = onClick,
                interactionSource = interactionSource ?: remember { MutableInteractionSource() },
            ),
        shape = shape,
        color = c.buttonPrimarySurface,
        contentColor = c.buttonPrimaryForeground
    ) {
        Row(
            modifier = Modifier.padding(
                PaddingValues(start = startPad, end = endPad, top = 0.dp, bottom = 0.dp)
            ),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            if (hasCustomIcon && iconPosition == IconPosition.Leading) {
                ButtonIcon(icon, iconRes, c.buttonPrimaryAccent.copy(alpha = if (enabled) 1f else 0.5f))
                Spacer(Modifier.width(8.dp))
            }

            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
                color = c.buttonPrimaryForeground.copy(alpha = if (enabled) 1f else 0.5f),
                textAlign = TextAlign.Center
            )

            when (state) {
                PrimaryButtonState.Default -> Unit
                PrimaryButtonState.Chevron -> {
                    Spacer(Modifier.width(8.dp))
                    Icon(
                        imageVector = Icons.Filled.ChevronRight,
                        contentDescription = null,
                        modifier = Modifier.size(24.dp),
                        tint = c.buttonPrimaryAccent.copy(alpha = if (enabled) 1f else 0.5f)
                    )
                }
                PrimaryButtonState.Loading -> {
                    Spacer(Modifier.width(12.dp))
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp,
                        color = c.buttonPrimaryAccent
                    )
                }
            }

            if (hasCustomIcon && iconPosition == IconPosition.Trailing) {
                Spacer(Modifier.width(8.dp))
                ButtonIcon(icon, iconRes, c.buttonPrimaryAccent.copy(alpha = if (enabled) 1f else 0.5f))
            }
        }
    }
}

@Composable
private fun ButtonIcon(icon: ImageVector?, @DrawableRes iconRes: Int?, tint: Color) {
    if (iconRes != null) {
        Icon(
            painter = painterResource(id = iconRes),
            contentDescription = null,
            modifier = Modifier.size(24.dp),
            tint = tint
        )
    } else if (icon != null) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(24.dp),
            tint = tint
        )
    }
}

@Composable
fun SecondaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    iconPosition: IconPosition = IconPosition.Trailing,
    isLoading: Boolean = false,
    enabled: Boolean = true,
    height: Dp = 48.dp,
    backgroundColor: Color = LocalContentColors.current.surfaceSecondary,
    contentColor: Color = LocalContentColors.current.foregroundPrimary,
    iconColor: Color = contentColor,
    textStyle: TextStyle = MaterialTheme.typography.labelLarge
) {
    val hasIcon = icon != null && !isLoading
    val startPad =
        if (hasIcon && iconPosition == IconPosition.Leading) 8.dp
        else if (hasIcon || isLoading) 16.dp else 24.dp
    val endPad =
        if (hasIcon && iconPosition == IconPosition.Trailing) 8.dp
        else if (isLoading) 8.dp else 16.dp
    val isEnabled = enabled && !isLoading
    val contentAlpha = if (isEnabled) 1f else 0.5f
    val effectiveContentColor = contentColor.copy(alpha = contentAlpha)
    val effectiveIconColor = iconColor.copy(alpha = contentAlpha)

    Surface(
        modifier = modifier,
        onClick = onClick,
        enabled = isEnabled,
        shape = SmoothShapes.rounded(Radius.MD),
        color = backgroundColor,
        contentColor = effectiveContentColor
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(height)
                .padding(PaddingValues(start = startPad, end = endPad)),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            if (hasIcon && iconPosition == IconPosition.Leading) {
                Icon(
                    imageVector = icon!!,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                    tint = effectiveIconColor
                )
                Spacer(Modifier.width(8.dp))
            }

            Text(text = label, style = textStyle, color = effectiveContentColor)

            if (hasIcon && iconPosition == IconPosition.Trailing) {
                Spacer(Modifier.width(8.dp))
                Icon(
                    imageVector = icon!!,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                    tint = effectiveIconColor
                )
            }

            if (isLoading) {
                Spacer(Modifier.width(12.dp))
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp,
                    color = effectiveIconColor
                )
            }
        }
    }
}

enum class ActionButtonLabelPosition { Left, Right }

/** App-bar circular/pill action button (port of the app's ActionButton). */
@Composable
fun ActionButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    background: Color? = null,
    iconColor: Color? = null,
    radius: Dp = Radius.MD,
    label: String? = null,
    labelPosition: ActionButtonLabelPosition = ActionButtonLabelPosition.Right,
    labelColor: Color? = null,
    textStyle: TextStyle = MaterialTheme.typography.labelMedium,
    enabled: Boolean = true
) {
    val view = LocalView.current
    val colors = LocalContentColors.current
    val resolvedBackground = background ?: colors.buttonPrimarySurface
    val resolvedIconColor = iconColor ?: colors.buttonPrimaryAccent
    val resolvedLabelColor = labelColor ?: colors.buttonPrimaryForeground
    val shape = SmoothShapes.rounded(radius)
    val height = 42.dp
    val iconSize = 23.dp
    val gap = 10.dp

    val hasIcon = icon != null
    val hasLabel = !label.isNullOrBlank()

    val (padStart, padEnd) = when {
        !hasLabel && hasIcon -> 0.dp to 0.dp
        hasLabel && !hasIcon -> 16.dp to 16.dp
        labelPosition == ActionButtonLabelPosition.Left -> 12.dp to 12.dp
        else -> 12.dp to 16.dp
    }

    val sizeModifier =
        if (!hasLabel && hasIcon) Modifier.size(height)
        else Modifier.height(height)

    Surface(
        onClick = {
            view.performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS)
            onClick()
        },
        enabled = enabled,
        color = resolvedBackground,
        contentColor = resolvedIconColor,
        shape = shape,
        modifier = modifier.then(sizeModifier)
    ) {
        Row(
            modifier = Modifier
                .padding(start = padStart, end = padEnd)
                .height(height),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            if (hasLabel && labelPosition == ActionButtonLabelPosition.Left) {
                Text(text = label!!, style = textStyle, color = resolvedLabelColor, maxLines = 1)
                if (hasIcon) Spacer(Modifier.width(gap))
            }

            if (hasIcon) {
                Icon(
                    imageVector = icon!!,
                    contentDescription = null,
                    tint = resolvedIconColor,
                    modifier = Modifier.size(iconSize)
                )
            }

            if (hasLabel && labelPosition == ActionButtonLabelPosition.Right) {
                if (hasIcon) Spacer(Modifier.width(gap))
                Text(text = label!!, style = textStyle, color = resolvedLabelColor, maxLines = 1)
            }
        }
    }
}

enum class WeatherCondition(@DrawableRes val iconRes: Int) {
    Sun(R.drawable.fc_weather_sun),
    Rain(R.drawable.fc_weather_rain),
    SunClouds(R.drawable.fc_weather_sunclouds),
}

enum class WeatherButtonState { Default, Loading }

@Composable
fun WeatherButton(
    onClick: () -> Unit,
    modifier: Modifier,
    state: WeatherButtonState = WeatherButtonState.Default,
    condition: WeatherCondition = WeatherCondition.SunClouds,
    text: String = "35°",
    weatherIconUrl: String? = null,
    height: Dp = 42.dp,
    radius: Dp = Radius.MD,
) {
    val brandColors = LocalBrandColors.current
    val shape = SmoothShapes.rounded(radius)
    val interactionSource = remember { MutableInteractionSource() }
    val type = MaterialTheme.typography

    val backgroundColor = brandColors.surfaceSecondary
    val textColor = brandColors.foregroundPrimary
    val chevronColor = brandColors.foregroundSecondary

    val startPadding = 14.dp
    val endPadding = if (state == WeatherButtonState.Loading) 16.dp else 8.dp

    Surface(
        onClick = onClick,
        color = Color.Transparent,
        contentColor = textColor,
        modifier = modifier
            .height(height)
            .clip(shape)
            .background(backgroundColor)
            .padding(start = startPadding, end = endPadding)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.clickable(
                interactionSource = interactionSource,
                indication = null
            ) { onClick() }
        ) {
            when (state) {
                WeatherButtonState.Loading -> {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp,
                        color = textColor,
                        trackColor = chevronColor
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = label(Labels.LOADING, "Loading..."),
                        style = type.labelMedium,
                        color = textColor
                    )
                }

                WeatherButtonState.Default -> {
                    if (!weatherIconUrl.isNullOrEmpty()) {
                        if (weatherIconUrl.endsWith(".svg")) {
                            SvgImage(url = weatherIconUrl, modifier = Modifier.size(24.dp))
                        } else {
                            SubcomposeAsyncImage(
                                model = weatherIconUrl,
                                contentDescription = "Weather Icon",
                                modifier = Modifier.size(24.dp)
                            )
                        }
                    } else {
                        Image(
                            painter = painterResource(condition.iconRes),
                            contentDescription = null,
                            modifier = Modifier.size(24.dp)
                        )
                    }

                    Spacer(modifier = Modifier.width(8.dp))
                    Text(text = text, style = type.labelMedium, color = textColor)
                    Spacer(modifier = Modifier.width(2.dp))
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                        contentDescription = null,
                        tint = chevronColor,
                        modifier = Modifier.size(22.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun ScrollToBottomButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = LocalContentColors.current

    Surface(
        onClick = onClick,
        color = colors.surfaceSecondary,
        shape = CircleShape,
        modifier = modifier
            .shadow(
                elevation = 24.dp,
                shape = CircleShape,
                spotColor = Color.Black.copy(alpha = 0.08f),
                ambientColor = Color.Black.copy(alpha = 0.05f),
                clip = false
            )
            .size(36.dp)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Icon(
                imageVector = ImageVector.vectorResource(R.drawable.fc_icon_arrow_down),
                contentDescription = "Scroll to bottom",
                tint = colors.foregroundPrimary,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}
