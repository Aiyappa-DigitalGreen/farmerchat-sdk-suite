package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import android.content.Context
import android.util.AttributeSet
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.AbstractComposeView
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens
import kotlin.random.Random

/**
 * The voice recorder sheet body — app `components/userinput/VoiceInput.kt` (fc-compose-agentic)
 * via the compose SDK port (`compose/components/UserInput.kt` `VoiceInput` + `VoiceClip`):
 *
 *   title / subtitle (Speak now · Ask about your farm or livestock → Processing… · One second)
 *   [Delete] [waveform pill, 30 s countdown] [Send]
 *   (i) Keep background noise low
 *
 * The countdown pulses for its last 5 s and fires [onAutoSend] at 0:00, like the app. Colours are
 * SDK tokens through [FcTokens], so a host theme / `fc_*` override recolours it; the two circle
 * buttons use `fc_brand_icon` for their glyphs (an accent icon ON the brand surface).
 */
internal class VoiceRecorderView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : AbstractComposeView(context, attrs) {

    enum class Mode { Listening, Processing }

    var mode by mutableStateOf(Mode.Listening)
    /** True once the recorder actually started — Send stays disabled until then (app parity). */
    var hasStarted by mutableStateOf(false)
    /** Bumped on every new recording so the countdown and bars restart. */
    var session by mutableIntStateOf(0)

    var title by mutableStateOf("")
    var subtitle by mutableStateOf("")
    var footer by mutableStateOf("")

    var onDelete: () -> Unit = {}
    var onSend: () -> Unit = {}
    var onAutoSend: () -> Unit = {}

    private fun c(res: Int) = Color(FcTokens.color(context, res))

    @Composable
    override fun Content() {
        val fg = c(R.color.fc_foreground_primary)
        Column(
            modifier = Modifier.fillMaxWidth().height(320.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Label(title, 22.sp, 28.sp, FontWeight.Bold, fg) // titleLarge
                Label(subtitle, 19.sp, 27.sp, FontWeight.Normal, fg) // bodyLarge
            }
            Spacer(Modifier.height(32.dp))
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                CircleAction(R.drawable.fc_ic_delete, 28.dp, enabled = true, loading = false) { onDelete() }
                Waveform(Modifier.weight(1f))
                Box(Modifier.padding(start = 2.dp)) {
                    CircleAction(
                        R.drawable.fc_icon_send, 22.dp,
                        enabled = mode == Mode.Listening && hasStarted,
                        loading = mode == Mode.Processing
                    ) { onSend() }
                }
            }
            Spacer(Modifier.height(32.dp))
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Image(
                    painter = painterResource(R.drawable.fc_icon_info),
                    contentDescription = null,
                    modifier = Modifier.size(23.dp),
                    colorFilter = ColorFilter.tint(c(R.color.fc_border_active))
                )
                BasicText(
                    text = footer,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    style = textStyle(15.sp, 22.sp, FontWeight.Normal, c(R.color.fc_foreground_secondary)) // bodySmall
                )
            }
        }
    }

    @Composable
    private fun Label(text: String, size: TextUnit, line: TextUnit, weight: FontWeight, color: Color) {
        BasicText(text = text, style = textStyle(size, line, weight, color).copy(textAlign = TextAlign.Center))
    }

    private fun textStyle(size: TextUnit, line: TextUnit, weight: FontWeight, color: Color) = TextStyle(
        fontFamily = hostFontFamily ?: FontFamily.SansSerif,
        fontSize = size,
        lineHeight = line,
        fontWeight = weight,
        color = color
    )

    /** App `InputActionButton`: 48 dp circle on buttonPrimarySurface. */
    @Composable
    private fun CircleAction(icon: Int, iconSize: Dp, enabled: Boolean, loading: Boolean, onClick: () -> Unit) {
        val glyph = c(R.color.fc_brand_icon)
        Box(
            modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(c(R.color.fc_button_primary_surface))
                .clickable(enabled = enabled && !loading) { onClick() },
            contentAlignment = Alignment.Center
        ) {
            if (loading) {
                val spin = rememberInfiniteTransition(label = "spin")
                val angle by spin.animateFloat(
                    0f, 360f, infiniteRepeatable(tween(1000, easing = LinearEasing)), label = "angle"
                )
                Canvas(Modifier.size(iconSize - 2.dp).rotate(angle)) {
                    drawArc(glyph, 0f, 270f, false, style = Stroke(2.5.dp.toPx(), cap = StrokeCap.Round))
                }
            } else {
                Image(
                    painter = painterResource(icon),
                    contentDescription = null,
                    modifier = Modifier.size(iconSize).alpha(if (enabled) 1f else 0.5f),
                    colorFilter = ColorFilter.tint(glyph)
                )
            }
        }
    }

    /** App `VoiceClip` in its Recording / Processing states (36 bars, 30 s countdown). */
    @Composable
    private fun Waveform(modifier: Modifier) {
        val active = c(R.color.fc_accent)
        val inactive = c(R.color.fc_foreground_tertiary)
        val recording = mode == Mode.Listening
        val currentSession = session

        var remaining by remember(currentSession) { mutableIntStateOf(MAX_SECONDS) }
        var timerVisible by remember(currentSession) { mutableStateOf(true) }
        val bars = remember(currentSession) {
            List(BAR_COUNT) { Animatable(Random.nextFloat().coerceIn(0.15f, 1f)) }
        }

        LaunchedEffect(currentSession, recording) {
            while (recording && remaining > 0) {
                delay(1000L)
                remaining--
                if (remaining == 0) onAutoSend()
            }
        }
        LaunchedEffect(currentSession, recording, remaining <= 5) {
            timerVisible = true
            while (recording && remaining in 1..5) {
                timerVisible = !timerVisible
                delay(500L)
            }
            timerVisible = true
        }
        LaunchedEffect(currentSession, recording) {
            while (recording) {
                bars.forEach { bar ->
                    launch {
                        val target = (bar.value * 0.6f + Random.nextFloat() * 0.4f).coerceIn(0.15f, 1f)
                        bar.animateTo(target, tween(Random.nextInt(70, 130), easing = FastOutSlowInEasing))
                    }
                }
                delay(Random.nextLong(80, 120))
            }
        }

        val progressIndex = ((1f - remaining.toFloat() / MAX_SECONDS) * BAR_COUNT).toInt()
        Row(
            modifier = modifier
                .clip(RoundedCornerShape(50))
                .background(c(R.color.fc_surface_primary))
                .height(50.dp)
                .padding(start = 18.dp, end = 16.dp, top = 6.dp, bottom = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Row(
                modifier = Modifier.weight(1f).height(38.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                bars.forEachIndexed { index, bar ->
                    val h = if (index < progressIndex) (bar.value * 30).dp.coerceIn(6.dp, 30.dp) else 8.dp
                    val color = if (recording && index < progressIndex) active else inactive
                    Box(Modifier.width(3.dp).height(h).background(color, RoundedCornerShape(8.dp)))
                }
            }
            BasicText(
                text = "0:${remaining.toString().padStart(2, '0')}",
                modifier = Modifier.alpha(if (timerVisible) 1f else 0f),
                style = textStyle(
                    13.sp, 18.sp, FontWeight.SemiBold, // labelSmall
                    if (recording) c(R.color.fc_foreground_secondary) else inactive
                )
            )
        }
    }

    private companion object {
        const val MAX_SECONDS = 30
        const val BAR_COUNT = 36
    }
}
