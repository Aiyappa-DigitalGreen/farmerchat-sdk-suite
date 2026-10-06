package org.digitalgreen.farmerchat.sdk.compose.components

import androidx.compose.ui.unit.sp
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.EaseInOut
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import org.digitalgreen.farmerchat.sdk.compose.R
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.core.labels.Labels

@Composable
fun FeedHeader(
    title: String,
    modifier: Modifier = Modifier,
    topPadding: Dp = 16.dp,
    bottomPadding: Dp = 16.dp,
) {
    val content = LocalContentColors.current

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(start = 24.dp, end = 24.dp, top = topPadding, bottom = bottomPadding),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            color = content.foregroundPrimary,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )
    }
}

/**
 * End-of-feed sign-off — 1:1 port of the app's `components/FeedFooter.kt` (fc-compose-agentic):
 * a 40sp waving-hand emoji (dark skin tone) above the "Have a great day, come back tomorrow"
 * label. When the footer first scrolls into view the text fades in over 900ms and the hand waves
 * three times (+16° / -12°, pivot at its base) before settling. The SDK previously drew the
 * FarmerChat logo mark over a green glow here, which the app does not have.
 */
@Composable
fun FeedFooter(
    text: String = label(
        Labels.HAVE_A_GREAT_DAY_COME_BACK_TOMORROW,
        "Have a great day,\ncome back tomorrow"
    ),
    modifier: Modifier = Modifier
) {
    val content = LocalContentColors.current
    val density = androidx.compose.ui.platform.LocalDensity.current
    val screenHeightPx = with(density) {
        androidx.compose.ui.platform.LocalConfiguration.current.screenHeightDp.dp.toPx()
    }

    var visible by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    val textAlpha by androidx.compose.animation.core.animateFloatAsState(
        targetValue = if (visible) 1f else 0f,
        animationSpec = androidx.compose.animation.core.tween(durationMillis = 900),
        label = "footerTextFade"
    )

    val waveRotation = androidx.compose.runtime.remember { androidx.compose.animation.core.Animatable(0f) }
    androidx.compose.runtime.LaunchedEffect(visible) {
        if (!visible) return@LaunchedEffect
        kotlinx.coroutines.delay(200)
        val ease = androidx.compose.animation.core.FastOutSlowInEasing
        repeat(3) {
            waveRotation.animateTo(16f, androidx.compose.animation.core.tween(160, easing = ease))
            waveRotation.animateTo(-12f, androidx.compose.animation.core.tween(180, easing = ease))
        }
        waveRotation.animateTo(0f, androidx.compose.animation.core.tween(160, easing = ease))
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .onGloballyPositioned { coords ->
                val bounds = coords.boundsInWindow()
                visible = bounds.height > 0f && bounds.top < screenHeightPx && bounds.bottom > 0f
            }
            .padding(start = 16.dp, end = 16.dp, top = 20.dp, bottom = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = "\uD83D\uDC4B\uD83C\uDFFE",
            fontSize = 40.sp,
            modifier = Modifier.graphicsLayer {
                alpha = textAlpha
                rotationZ = waveRotation.value
                transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.5f, 1f)
            }
        )
        Text(
            text = text,
            style = MaterialTheme.typography.titleMedium,
            color = content.foregroundPrimary,
            textAlign = TextAlign.Center,
            modifier = Modifier.graphicsLayer { alpha = textAlpha }
        )
    }
}

/** Error UI for home feed failures: red circle + "Can't load right now" + retry. */
@Composable
fun HomeFeedErrorUI(
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    val brandColors = LocalBrandColors.current
    val contentColors = LocalContentColors.current

    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        Box(
            modifier = Modifier
                .size(64.dp)
                .background(color = brandColors.feedbackFail, shape = CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Filled.Close,
                contentDescription = "Error",
                tint = Color.White,
                modifier = Modifier.size(32.dp)
            )
        }

        Text(
            text = label(Labels.CANT_LOAD_RIGHT_NOW, "Can't load right now"),
            style = MaterialTheme.typography.bodyLarge,
            color = contentColors.foregroundPrimary,
            textAlign = TextAlign.Center
        )

        Box(
            modifier = Modifier
                .height(48.dp)
                .padding(horizontal = 16.dp)
                .background(
                    color = contentColors.surfaceTertiary,
                    shape = SmoothShapes.rounded(Radius.MD)
                )
                .clickable { onRetry() },
            contentAlignment = Alignment.Center
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Filled.Refresh,
                    contentDescription = "Retry",
                    tint = contentColors.foregroundPrimary,
                    modifier = Modifier.size(20.dp)
                )
                Text(
                    text = label(Labels.TRY_AGAIN, "Try again"),
                    style = MaterialTheme.typography.bodyMedium,
                    color = contentColors.foregroundPrimary
                )
            }
        }
    }
}

/** Bouncing "scroll for more" indicator shown once after the answer renders. */
@Composable
fun ScrollIndicator(
    triggerKey: Any,
    onClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val contentColors = LocalContentColors.current

    var isVisible by remember(triggerKey) { mutableStateOf(false) }
    val bounceOffset = remember(triggerKey) { Animatable(0f) }

    LaunchedEffect(triggerKey) {
        delay(1500)
        isVisible = true
        delay(300)
        repeat(3) {
            bounceOffset.animateTo(14f, animationSpec = tween(280, easing = EaseInOut))
            bounceOffset.animateTo(0f, animationSpec = tween(320, easing = EaseInOut))
            delay(150)
        }
        delay(400)
        isVisible = false
    }

    AnimatedVisibility(
        visible = isVisible,
        enter = fadeIn(animationSpec = tween(200)),
        exit = fadeOut(animationSpec = tween(300)),
        modifier = modifier
    ) {
        Box(
            modifier = Modifier
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = onClick
                )
                .offset { IntOffset(0, bounceOffset.value.toInt()) }
                .size(40.dp)
                .background(
                    color = contentColors.surfaceReadingSecondary,
                    shape = CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            Image(
                painter = painterResource(id = R.drawable.fc_icon_arrow_down),
                contentDescription = "Scroll for more",
                modifier = Modifier.size(20.dp),
                colorFilter = ColorFilter.tint(contentColors.foregroundPrimary)
            )
        }
    }
}
