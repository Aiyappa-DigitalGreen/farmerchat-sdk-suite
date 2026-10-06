package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.util.AttributeSet
import androidx.compose.animation.core.EaseInOutSine
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.AbstractComposeView
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import org.digitalgreen.farmerchat.sdk.views.R
import kotlin.math.cos
import kotlin.math.sin

/**
 * The agentic Home's BACKGROUND, drawn behind the transparent feed — app `HomeScreen.kt`
 * `if (isComposerUi)` band: a brand-green → transparent vertical gradient 36.6% of the screen tall
 * (solid to 58.8%), with the animated [Sunbeams] (280dp) and the yellow glow (148dp) at its top.
 *
 * Ported as Compose, not approximated in XML: views already hosts Compose for its text
 * rasteriser ([FcText]), and the sunbeams are an offscreen-blurred, swaying, twinkling drawing
 * that a drawable cannot express. The drawing code below is the app's `components/Sunbeams.kt`
 * verbatim, so the rays land on the same pixels.
 */
internal class AgenticHomeBackdropView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : AbstractComposeView(context, attrs) {

    /** Brand surfacePrimary (default Green700), already remapped for a host theme by the caller. */
    var brandColor by mutableStateOf(0xFF008236.toInt())

    /** Host accent for the yellow glow bitmap; null keeps FarmerChat's own yellow. */
    var glowTint by mutableStateOf<Int?>(null)

    @Composable
    override fun Content() {
        val configuration = LocalConfiguration.current
        val density = LocalDensity.current
        val bandDp = (configuration.screenHeightDp * 0.366f).dp
        val bandPx = with(density) { bandDp.toPx() }
        val brand = Color(brandColor)
        Box(modifier = Modifier.fillMaxSize()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter)
                    .height(bandDp)
                    .background(
                        Brush.verticalGradient(
                            colorStops = arrayOf(
                                0f to brand,
                                0.588f to brand,
                                1f to brand.copy(alpha = 0f),
                            ),
                            startY = 0f,
                            endY = bandPx,
                        )
                    )
            ) {
                Sunbeams(
                    modifier = Modifier.fillMaxWidth().height(280.dp).align(Alignment.TopCenter)
                )
                // App `Glow(GlowType.Yellow, Modifier.fillMaxWidth().height(148.dp))`: the outer
                // 148dp height wins over Glow's own inner height(88.dp).
                Image(
                    painter = painterResource(id = R.drawable.fc_glow_yellow),
                    contentDescription = null,
                    contentScale = ContentScale.FillBounds,
                    colorFilter = glowTint?.let { ColorFilter.tint(Color(it)) },
                    modifier = Modifier.fillMaxWidth().height(148.dp).align(Alignment.TopCenter)
                )
            }
        }
    }
}

/** App `components/Sunbeams.kt`, unchanged apart from dropping the unused visibility hook. */
@Composable
private fun Sunbeams(modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "sunbeams")
    val sway by transition.animateFloat(
        initialValue = -1.4f,
        targetValue = 1.4f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 16000, easing = EaseInOutSine),
            repeatMode = RepeatMode.Reverse
        ),
        label = "sway"
    )
    val breath by transition.animateFloat(
        initialValue = 0f,
        targetValue = (2 * Math.PI).toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 8000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "breath"
    )

    Box(
        modifier = modifier.drawWithCache {
            val origin = Offset(size.width / 2f, -40.dp.toPx())

            data class BeamSpec(val angleDeg: Float, val length: Float, val alpha: Float)
            val specs = listOf(
                BeamSpec(-52f, 0.62f, 0.07f),
                BeamSpec(-36f, 0.95f, 0.10f),
                BeamSpec(-22f, 0.72f, 0.07f),
                BeamSpec(-8f, 1.00f, 0.11f),
                BeamSpec(7f, 0.78f, 0.07f),
                BeamSpec(21f, 1.00f, 0.10f),
                BeamSpec(37f, 0.68f, 0.07f),
                BeamSpec(51f, 0.90f, 0.08f),
            )

            val scale = 0.5f
            val bmpW = (size.width * scale).toInt().coerceAtLeast(1)
            val bmpH = (size.height * scale).toInt().coerceAtLeast(1)
            val warm = android.graphics.Color.argb(255, 255, 246, 214)
            fun renderGroup(group: List<BeamSpec>): Bitmap {
                val bmp = Bitmap.createBitmap(bmpW, bmpH, Bitmap.Config.ARGB_8888)
                val canvas = android.graphics.Canvas(bmp)
                canvas.scale(scale, scale)
                val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                    shader = android.graphics.LinearGradient(
                        0f, 0f, 0f, size.height * 0.85f,
                        warm, android.graphics.Color.TRANSPARENT,
                        android.graphics.Shader.TileMode.CLAMP
                    )
                    maskFilter = BlurMaskFilter(7.dp.toPx(), BlurMaskFilter.Blur.NORMAL)
                }
                for (spec in group) {
                    val rad = Math.toRadians(spec.angleDeg.toDouble())
                    val dirX = sin(rad).toFloat()
                    val dirY = cos(rad).toFloat()
                    val perpX = dirY
                    val perpY = -dirX
                    val startR = 30.dp.toPx()
                    val endR = size.height * spec.length * 1.35f
                    val startHalf = 3.dp.toPx()
                    val endHalf = 17.dp.toPx()
                    val path = android.graphics.Path().apply {
                        moveTo(origin.x + dirX * startR - perpX * startHalf, origin.y + dirY * startR - perpY * startHalf)
                        lineTo(origin.x + dirX * startR + perpX * startHalf, origin.y + dirY * startR + perpY * startHalf)
                        lineTo(origin.x + dirX * endR + perpX * endHalf, origin.y + dirY * endR + perpY * endHalf)
                        lineTo(origin.x + dirX * endR - perpX * endHalf, origin.y + dirY * endR - perpY * endHalf)
                        close()
                    }
                    paint.alpha = (spec.alpha * 255).toInt()
                    canvas.drawPath(path, paint)
                }
                return bmp
            }
            val groupA = renderGroup(specs.filterIndexed { i, _ -> i % 2 == 0 }).asImageBitmap()
            val groupB = renderGroup(specs.filterIndexed { i, _ -> i % 2 == 1 }).asImageBitmap()
            val dstSize = IntSize(size.width.toInt(), size.height.toInt())

            onDrawBehind {
                val breatheA = 0.55f + 0.45f * sin(breath)
                val breatheB = 0.55f + 0.45f * sin(2f * breath + 2.4f)
                rotate(degrees = sway, pivot = origin) {
                    drawImage(groupA, dstSize = dstSize, alpha = breatheA)
                    drawImage(groupB, dstSize = dstSize, alpha = breatheB)
                }
            }
        }
    )
}
