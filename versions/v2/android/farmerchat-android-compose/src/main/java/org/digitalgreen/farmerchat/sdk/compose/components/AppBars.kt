package org.digitalgreen.farmerchat.sdk.compose.components

import org.digitalgreen.farmerchat.sdk.compose.util.fcStatusBarsTop
import androidx.annotation.DrawableRes
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import org.digitalgreen.farmerchat.sdk.compose.R
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius

enum class GlowType { Green, Yellow }

@Composable
fun Glow(
    type: GlowType,
    modifier: Modifier = Modifier,
) {
    Image(
        painter = painterResource(id = glowRes(type)),
        contentDescription = null,
        contentScale = ContentScale.FillBounds,
        modifier = modifier
            .fillMaxWidth()
            .height(88.dp)
    )
}

@DrawableRes
private fun glowRes(type: GlowType): Int = when (type) {
    GlowType.Green -> R.drawable.fc_glow_green
    GlowType.Yellow -> R.drawable.fc_glow_yellow
}

@Composable
fun DefaultAppBar(
    title: String,
    modifier: Modifier = Modifier,
    showGlow: Boolean = true,
    glowType: GlowType = GlowType.Yellow,
    glowAlpha: Float = 1.0f,
    containerColor: Color? = null,
    leftIcon: ImageVector? = null,
    /**
     * Corner radius for the [leftIcon] button. Defaults to [Radius.MD] (rounded square); pass
     * [Radius.Rounded] for the round back/close button that matches Home's hamburger.
     */
    leftRadius: Dp = Radius.MD,
    onLeftClick: () -> Unit = {},
    rightIcon: ImageVector? = null,
    rightLabel: String? = null,
    /** Corner radius for the right action button. [Radius.MD] by default; [Radius.Rounded] for a pill. */
    rightRadius: Dp = Radius.MD,
    onRightClick: () -> Unit = {},
    /**
     * Lets a caller grey out the right action while its work is in flight — the app's
     * TermsOfUseContentDialog uses it to block a double "Accept" (app DefaultAppBar.kt @ 0c8c740f).
     */
    rightEnabled: Boolean = true
) {
    val brand = LocalBrandColors.current
    val bg = containerColor ?: brand.surfacePrimary

    val topInset = fcStatusBarsTop()
    val barHeight = 64.dp + topInset
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(barHeight)
            .background(bg)
    ) {
        if (showGlow) {
            Glow(
                type = glowType,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(80.dp)
                    .align(Alignment.TopCenter)
                    .alpha(glowAlpha)
            )
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(barHeight)
                .padding(top = topInset, start = 16.dp, end = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            if (leftIcon != null) {
                ActionButton(
                    onClick = onLeftClick,
                    icon = leftIcon,
                    background = brand.surfaceSecondary,
                    iconColor = brand.foregroundPrimary,
                    radius = leftRadius
                )
            } else {
                Box(modifier = Modifier.size(42.dp))
            }

            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = brand.foregroundPrimary,
                textAlign = TextAlign.Center,
                modifier = Modifier.weight(1f)
            )

            if (rightIcon != null || rightLabel != null) {
                ActionButton(
                    onClick = onRightClick,
                    icon = rightIcon,
                    label = rightLabel,
                    background = brand.surfaceSecondary,
                    iconColor = brand.foregroundPrimary,
                    labelColor = brand.foregroundPrimary,
                    radius = rightRadius,
                    enabled = rightEnabled
                )
            } else {
                Box(modifier = Modifier.size(42.dp))
            }
        }
    }
}

@Composable
fun HomeAppBar(
    openDrawer: () -> Unit,
    modifier: Modifier = Modifier,
    menuButtonModifier: Modifier = Modifier,
    weatherButtonModifier: Modifier = Modifier,
    navPaddingStart: Dp = 0.dp,
    weatherState: WeatherButtonState = WeatherButtonState.Default,
    weatherCondition: WeatherCondition = WeatherCondition.SunClouds,
    weatherMessage: String,
    weatherIconUrl: String? = null,
    showWeather: Boolean = true,
    onWeatherClick: () -> Unit = {},
    /**
     * App parity (HomeScreen.kt:1023, `appBar(showBackground)`): the 2.0.0 agentic Home draws
     * one green gradient band behind the whole top section, so the bar itself must be
     * transparent and must not stack a second glow on top of the band's. Default `true`
     * keeps the 1.0.0 opaque bar with its own glow, unchanged.
     */
    showBackground: Boolean = true
) {
    val brand = LocalBrandColors.current

    val topInset = fcStatusBarsTop()
    // 52dp (was 64dp) trims the empty space below the vertically-centered menu/weather buttons so
    // the logo below the app bar isn't left with a large gap under the bar.
    val barHeight = 52.dp + topInset

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(barHeight)
            .then(
                if (showBackground) Modifier.background(brand.surfacePrimary) else Modifier
            )
    ) {
        if (showBackground) {
            Glow(
                type = GlowType.Yellow,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(80.dp)
                    .align(Alignment.TopCenter)
                    .alpha(1.0f)
            )
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(barHeight)
                .padding(top = topInset, start = 16.dp, end = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            ActionButton(
                icon = Icons.Filled.Menu,
                background = brand.surfaceSecondary,
                iconColor = brand.foregroundPrimary,
                radius = Radius.Rounded,
                onClick = openDrawer,
                modifier = menuButtonModifier.padding(start = navPaddingStart)
            )

            if (showWeather) {
                WeatherButton(
                    onClick = onWeatherClick,
                    modifier = weatherButtonModifier,
                    state = weatherState,
                    condition = weatherCondition,
                    text = weatherMessage,
                    radius = Radius.Rounded,
                    weatherIconUrl = weatherIconUrl
                )
            }
        }
    }
}

@Composable
fun LogoAppBar(
    modifier: Modifier = Modifier,
    showLogo: Boolean = true,
    leftIcon: ImageVector? = null,
    /**
     * Corner radius of the left action button. Defaults to Radius.MD; the chat bar passes
     * [Radius.Rounded] for its back arrow, matching the app's `leftbutton` drawable (a 42dp
     * Green800 circle with a white back arrow) that it draws instead of an ActionButton.
     */
    leftRadius: Dp = Radius.MD,
    onLeftClick: () -> Unit = {},
    rightIcon: ImageVector? = null,
    rightLabel: String? = null,
    onRightClick: () -> Unit = {},
    /**
     * Trailing slot for MULTIPLE right-hand actions, used by the chat bar in `CHAT_ONLY` to carry
     * Past Advice + Language side by side (the views flavour's `fcAppBarActions` row). Takes
     * precedence over [rightIcon]/[rightLabel], which stay for the single-action callers.
     */
    actions: (@Composable RowScope.() -> Unit)? = null
) {
    val brand = LocalBrandColors.current
    val topInset = fcStatusBarsTop()
    val barHeight = 64.dp + topInset

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(barHeight)
            .background(brand.surfacePrimary)
    ) {
        Glow(
            type = GlowType.Yellow,
            modifier = Modifier
                .fillMaxWidth()
                .height(80.dp)
                .align(Alignment.TopCenter)
                .alpha(1.0f)
        )

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(barHeight)
                .padding(top = topInset, start = 16.dp, end = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            if (leftIcon != null) {
                ActionButton(
                    onClick = onLeftClick,
                    icon = leftIcon,
                    background = brand.surfaceSecondary,
                    iconColor = brand.foregroundPrimary,
                    radius = leftRadius
                )
            } else {
                Box(modifier = Modifier.size(42.dp))
            }

            Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                val logoAlpha = remember { Animatable(0f) }
                LaunchedEffect(showLogo) {
                    logoAlpha.animateTo(
                        targetValue = if (showLogo) 1f else 0f,
                        animationSpec = if (showLogo)
                            tween(durationMillis = 600, easing = EaseOut)
                        else
                            tween(durationMillis = 300, easing = EaseOut)
                    )
                }

                if (logoAlpha.value > 0f) {
                    Image(
                        painter = painterResource(id = R.drawable.fc_logo_mark),
                        contentDescription = "FarmerChat",
                        modifier = Modifier
                            .size(36.dp)
                            .graphicsLayer { alpha = logoAlpha.value },
                        colorFilter = ColorFilter.tint(brand.foregroundPrimary)
                    )
                }
            }

            when {
                actions != null -> Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    content = actions
                )

                rightIcon != null || rightLabel != null -> ActionButton(
                    onClick = onRightClick,
                    icon = rightIcon,
                    label = rightLabel,
                    background = brand.surfaceSecondary,
                    iconColor = brand.foregroundPrimary,
                    labelColor = brand.foregroundPrimary,
                    radius = Radius.MD
                )

                else -> Box(modifier = Modifier.size(42.dp))
            }
        }
    }
}
