package org.digitalgreen.farmerchat.sdk.compose.components

import android.view.HapticFeedbackConstants
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.EaseInOut
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalView
import kotlinx.coroutines.launch

/** Scale-on-press click modifier (port of the app's pressScale; sound effect omitted). */
fun Modifier.pressScale(
    onClick: () -> Unit,
    targetScale: Float = 0.95f,
    pressDuration: Int = 100,
    releaseDuration: Int = 200,
    haptic: Boolean = true
): Modifier = composed {
    val view = LocalView.current
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()

    val scale by animateFloatAsState(
        targetValue = if (isPressed) targetScale else 1f,
        animationSpec = if (isPressed)
            tween(pressDuration, easing = EaseOut)
        else
            tween(releaseDuration, easing = EaseInOut),
        label = "pressScale"
    )

    LaunchedEffect(isPressed) {
        if (isPressed && haptic) {
            view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
        }
    }

    this
        .graphicsLayer {
            scaleX = scale
            scaleY = scale
        }
        .clickable(
            indication = null,
            interactionSource = interactionSource,
            onClick = onClick
        )
}

/** Tap bounce modifier (port of the app's tapScale). */
fun Modifier.tapScale(
    onClick: () -> Unit,
    targetScale: Float = 0.92f,
    pressDuration: Int = 100,
    releaseDuration: Int = 200,
    haptic: Boolean = true
): Modifier = composed {
    val view = LocalView.current
    val scope = rememberCoroutineScope()
    val scale = remember { Animatable(1f) }

    this
        .graphicsLayer {
            scaleX = scale.value
            scaleY = scale.value
        }
        .pointerInput(Unit) {
            detectTapGestures(
                onTap = {
                    if (haptic) {
                        view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
                    }
                    scope.launch {
                        scale.animateTo(targetScale, animationSpec = tween(pressDuration, easing = EaseOut))
                        scale.animateTo(1f, animationSpec = tween(releaseDuration, easing = EaseInOut))
                    }
                    onClick()
                }
            )
        }
}
