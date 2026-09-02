package org.digitalgreen.farmerchat.sdk.compose.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// Radius tokens (port of the app's Containers.kt / SmoothShapes.kt).
object Radius {
    val Rounded = 999.dp
    val XXL = 24.dp
    val XL = 20.dp
    val LG = 16.dp
    val MD = 12.dp
    val SM = 8.dp
    val NONE = 0.dp
}

/**
 * Port of the app's SmoothShapes. The app uses androidx.graphics.shapes for
 * corner smoothing; the SDK avoids that extra dependency and uses standard
 * rounded rectangles (visually equivalent at these radii).
 */
object SmoothShapes {

    fun rounded(radius: Dp): Shape = RoundedCornerShape(radius)

    /** Capsule / pill shape. */
    fun capsule(): Shape = RoundedCornerShape(percent = 50)
}

// Elevation & container helpers (port of the app's Containers.kt).
object Containers {

    private val ShadowStrong = Color(0x3D000000)

    /** Elevated container with soft double shadow. */
    fun elevated(
        radius: Dp = Radius.MD,
        background: Color
    ): Modifier {
        val shape = SmoothShapes.rounded(radius)
        return Modifier
            .shadow(
                elevation = 40.dp,
                shape = shape,
                spotColor = ShadowStrong,
                ambientColor = ShadowStrong,
                clip = false
            )
            .shadow(
                elevation = 10.dp,
                shape = shape,
                spotColor = ShadowStrong,
                ambientColor = ShadowStrong,
                clip = false
            )
            .background(color = background, shape = shape)
    }

    /** Flat container. */
    fun flat(
        radius: Dp = Radius.MD,
        background: Color
    ): Modifier {
        val shape = SmoothShapes.rounded(radius)
        return Modifier.background(color = background, shape = shape)
    }

    /** Flat container rounded only at the top. */
    fun roundedTop(
        radius: Dp = Radius.MD,
        background: Color
    ): Modifier {
        val shape = RoundedCornerShape(
            topStart = radius,
            topEnd = radius,
            bottomStart = 0.dp,
            bottomEnd = 0.dp
        )
        return Modifier.background(color = background, shape = shape)
    }
}
