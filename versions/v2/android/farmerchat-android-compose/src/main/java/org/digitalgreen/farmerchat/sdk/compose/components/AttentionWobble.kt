package org.digitalgreen.farmerchat.sdk.compose.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.EaseInOut
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.graphicsLayer
import kotlinx.coroutines.delay

/**
 * Attention bounce plus an optional rotation wobble — port of the app's
 * `components/AttentionWobble.kt`.
 *
 * The animation itself is ported 1:1 (spring bounce to [shrinkScale] and back, then [cycles]
 * rotations through ±[angle]). Both of the app's **gates** are dropped, deliberately:
 *
 *  - the Firebase Remote Config kill-switch (`v2_wobble_animation_enabled`) — §6 excludes
 *    Firebase from SDK packages, and the app's own default for that key is `true`;
 *  - `CardAnimationManager`'s once-per-calendar-day budget, which the app spends on its
 *    home-screen cards. The SDK has exactly one wobble call site (the tips carousel), so
 *    porting the budget would mean the tip icon animates once on the first day a farmer opens
 *    chat and then never again — machinery whose only observable effect is to hide itself.
 *
 * Recorded as a deliberate divergence in `docs/04-parity-matrix.md`.
 */
internal fun Modifier.attentionWobble(
    enabled: Boolean = true,
    /** Restarts the animation whenever this value changes. `false`/`0` means "do not play". */
    trigger: Any = true,
    delayMs: Long = 0L,
    angle: Float = 1.5f,
    cycleDuration: Int = 60,
    cycles: Int = 2,
    shrinkScale: Float = 0.95f,
    wobbleRotation: Boolean = true,
    bounceCycles: Int = 1
): Modifier = composed {
    if (!enabled) return@composed this

    val rotation = remember { Animatable(0f) }
    val scale = remember { Animatable(1f) }

    LaunchedEffect(trigger) {
        if (trigger == false || trigger == 0) return@LaunchedEffect
        if (delayMs > 0) delay(delayMs)

        repeat(bounceCycles) { i ->
            scale.animateTo(shrinkScale, animationSpec = spring(dampingRatio = 0.7f, stiffness = 800f))
            scale.animateTo(1f, animationSpec = spring(dampingRatio = 0.35f, stiffness = 400f))
            if (i < bounceCycles - 1) delay(60)
        }

        if (wobbleRotation) {
            repeat(cycles) {
                rotation.animateTo(angle, animationSpec = tween(cycleDuration, easing = EaseInOut))
                rotation.animateTo(-angle, animationSpec = tween(cycleDuration * 2, easing = EaseInOut))
                rotation.animateTo(0f, animationSpec = tween(cycleDuration, easing = EaseInOut))
            }
        }
    }

    this.graphicsLayer {
        rotationZ = rotation.value
        scaleX = scale.value
        scaleY = scale.value
    }
}
