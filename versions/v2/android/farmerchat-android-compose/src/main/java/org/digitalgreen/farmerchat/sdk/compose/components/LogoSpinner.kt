package org.digitalgreen.farmerchat.sdk.compose.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.EaseInOut
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import org.digitalgreen.farmerchat.sdk.compose.R
import org.digitalgreen.farmerchat.sdk.compose.theme.Green500
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.core.labels.Labels

enum class LogoSpinnerType { Vertical, Horizontal }

/** Branded loading indicator (port of the app's LogoSpinner). */
@Composable
fun LogoSpinner(
    modifier: Modifier = Modifier,
    type: LogoSpinnerType = LogoSpinnerType.Vertical,
    label: String? = null,
    labels: List<String> = emptyList(),
    labelIntervalMs: Long = 3000L,
    color: Color? = null,
    spinnerColor: Color? = null
) {
    val contentColors = LocalContentColors.current

    val isCycling = labels.isNotEmpty()
    var currentLabelIndex by remember { mutableIntStateOf(0) }

    if (isCycling) {
        LaunchedEffect(labels) {
            while (true) {
                delay(labelIntervalMs)
                currentLabelIndex = (currentLabelIndex + 1) % labels.size
            }
        }
    }

    val displayLabel = when {
        isCycling -> labels[currentLabelIndex]
        label != null -> label
        else -> null
    }

    val textColor = color ?: contentColors.foregroundPrimary
    val logoColor = spinnerColor ?: Green500

    when (type) {
        LogoSpinnerType.Vertical -> Column(
            modifier = modifier,
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            LogoWithSpinner(55.dp, 32.dp, 3.dp, logoColor)
            if (displayLabel != null) {
                SpinnerLabelText(displayLabel, isCycling, textColor, shimmer = false)
            }
        }

        LogoSpinnerType.Horizontal -> Row(
            modifier = modifier,
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            LogoWithSpinner(40.dp, 23.dp, 2.5.dp, logoColor)
            if (displayLabel != null) {
                // App parity: the HORIZONTAL spinner shimmers its label, the vertical one does
                // not. The app splits these into two components (`LogoSpinner.kt` uses a plain
                // `Text`; `LogoSpinnerHorizontal.kt:219` uses `ShimmerText`); the SDK folded them
                // into one `type` and, until now, lost the shimmer with them.
                SpinnerLabelText(displayLabel, isCycling, textColor, shimmer = true)
            }
        }
    }
}

@Composable
private fun LogoWithSpinner(
    spinnerSize: Dp,
    logoSize: Dp,
    strokeWidth: Dp,
    spinnerColor: Color
) {
    Box(contentAlignment = Alignment.Center) {
        CircularProgressIndicator(
            modifier = Modifier.size(spinnerSize),
            color = spinnerColor,
            strokeWidth = strokeWidth
        )
        Image(
            painter = painterResource(id = R.drawable.fc_logo_mark),
            contentDescription = "FarmerChat",
            modifier = Modifier.size(logoSize),
            colorFilter = ColorFilter.tint(spinnerColor)
        )
    }
}

/**
 * The spinner's label.
 *
 * [shimmer] selects between the app's two treatments — `LogoSpinner.kt`'s plain `Text` for the
 * full-screen loader and `LogoSpinnerHorizontal.kt`'s `ShimmerText` for the in-thread stream
 * status. Both use `labelMedium`: the shimmer is the only difference, NOT the weight.
 */
@Composable
private fun SpinnerLabelText(
    text: String,
    isCycling: Boolean,
    color: Color,
    shimmer: Boolean
) {
    @Composable
    fun render(value: String) {
        if (shimmer) {
            ShimmerText(
                text = value,
                style = MaterialTheme.typography.labelMedium,
                baseColor = color
            )
        } else {
            Text(text = value, style = MaterialTheme.typography.labelMedium, color = color)
        }
    }

    if (isCycling) {
        AnimatedContent(
            targetState = text,
            transitionSpec = {
                fadeIn(animationSpec = tween(400, easing = EaseInOut)) togetherWith
                    fadeOut(animationSpec = tween(400, easing = EaseInOut))
            },
            label = "LabelFade"
        ) { l -> render(l) }
    } else {
        render(text)
    }
}

enum class LogoSpinnerVerticalState { Loading, Error }

/** Vertical logo spinner with Loading + Error states (rotating logo every 3 s). */
@Composable
fun LogoSpinnerVertical(
    modifier: Modifier = Modifier,
    state: LogoSpinnerVerticalState = LogoSpinnerVerticalState.Loading,
    label: String? = null,
    labels: List<String> = emptyList(),
    labelIntervalMs: Long = 3000L,
    onRetryClick: () -> Unit = {},
    retryLabel: String = label(Labels.TRY_AGAIN, "Try again")
) {
    val contentColors = LocalContentColors.current
    val brandColors = LocalBrandColors.current

    val isCycling = labels.isNotEmpty()
    var currentLabelIndex by remember { mutableIntStateOf(0) }

    if (isCycling && state == LogoSpinnerVerticalState.Loading) {
        LaunchedEffect(labels) {
            while (true) {
                delay(labelIntervalMs)
                currentLabelIndex = (currentLabelIndex + 1) % labels.size
            }
        }
    }

    val displayLabel = when {
        isCycling -> labels[currentLabelIndex]
        label != null -> label
        else -> null
    }

    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(
            if (state == LogoSpinnerVerticalState.Error) 16.dp else 12.dp
        )
    ) {
        when (state) {
            LogoSpinnerVerticalState.Loading -> {
                RotatingLogoWithSpinner()
                if (displayLabel != null) {
                    LabelTextLarge(displayLabel, isCycling, contentColors.foregroundPrimary)
                }
            }

            LogoSpinnerVerticalState.Error -> {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(55.dp)
                            .background(
                                color = brandColors.feedbackFail,
                                shape = SmoothShapes.rounded(Radius.Rounded)
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Close,
                            contentDescription = "Error",
                            tint = Color.White,
                            modifier = Modifier.size(28.dp)
                        )
                    }
                    if (displayLabel != null) {
                        Text(
                            text = displayLabel,
                            style = MaterialTheme.typography.labelLarge,
                            color = contentColors.foregroundPrimary
                        )
                    }
                }

                SecondaryButton(
                    label = retryLabel,
                    onClick = onRetryClick,
                    backgroundColor = contentColors.surfaceReadingSecondary
                )
            }
        }
    }
}

@Composable
private fun RotatingLogoWithSpinner() {
    val rotation = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(3000L)
            rotation.animateTo(
                targetValue = rotation.value + 360f,
                animationSpec = tween(durationMillis = 600, easing = EaseOut)
            )
        }
    }

    Box(contentAlignment = Alignment.Center) {
        CircularProgressIndicator(
            modifier = Modifier.size(55.dp),
            color = Green500,
            strokeWidth = 3.dp
        )
        Image(
            painter = painterResource(id = R.drawable.fc_logo_mark),
            contentDescription = "FarmerChat",
            modifier = Modifier
                .size(32.dp)
                .graphicsLayer { rotationZ = rotation.value },
            colorFilter = ColorFilter.tint(Green500)
        )
    }
}

@Composable
private fun LabelTextLarge(text: String, isCycling: Boolean, color: Color) {
    if (isCycling) {
        AnimatedContent(
            targetState = text,
            transitionSpec = {
                fadeIn(animationSpec = tween(400, easing = EaseInOut)) togetherWith
                    fadeOut(animationSpec = tween(400, easing = EaseInOut))
            },
            label = "LabelFade"
        ) { l ->
            Text(text = l, style = MaterialTheme.typography.labelLarge, color = color)
        }
    } else {
        Text(text = text, style = MaterialTheme.typography.labelLarge, color = color)
    }
}
