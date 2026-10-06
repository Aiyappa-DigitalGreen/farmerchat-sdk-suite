package org.digitalgreen.farmerchat.sdk.views.internal.widgets

import android.content.Context
import android.util.AttributeSet
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.platform.AbstractComposeView
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.digitalgreen.farmerchat.sdk.views.R
import kotlin.math.floor

/**
 * App `components/SectionHeader.kt` — the agentic Home's "For your farm today" title flanked by
 * two rows of 4dp leaves that alternate facing direction and tile to fill the space either side.
 * Views had a plain centred TextView here and no leaves at all. The leaf-tiling draw is the app's
 * `LeafDivider` verbatim. Used only on Home's fixed header (not in a recycled row).
 */
internal class SectionHeaderView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : AbstractComposeView(context, attrs) {

    var title by mutableStateOf("")
    /** brandColors.foregroundPrimary on Home (default White). */
    var titleColor by mutableStateOf(0xFFFFFFFF.toInt())
    /** contentColors.buttonPrimaryAccent (default Green500). */
    var accentColor by mutableStateOf(0xFF00C950.toInt())

    @Composable
    override fun Content() {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp, vertical = 0.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            LeafDivider(color = Color(accentColor), modifier = Modifier.weight(1f))
            BasicText(
                text = title,
                style = TextStyle(
                    // titleMedium (18/24 w700) copied with fontSize 18, SemiBold.
                    fontFamily = FontFamily.SansSerif,
                    fontSize = 18.sp,
                    lineHeight = 24.sp,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                    color = Color(titleColor)
                )
            )
            LeafDivider(color = Color(accentColor), modifier = Modifier.weight(1f))
        }
    }
}

@Composable
private fun LeafDivider(color: Color, modifier: Modifier = Modifier) {
    val leaf = painterResource(id = R.drawable.fc_leaf)
    Canvas(modifier = modifier.height(4.dp)) {
        val s = size.height
        val step = s
        if (step <= 0f || size.width <= 0f) return@Canvas
        val count = floor(size.width / step).toInt().coerceAtLeast(0)
        val rowWidth = count * step
        val startX = (size.width - rowWidth) / 2f
        val top = (size.height - s) / 2f
        for (i in 0 until count) {
            val x = startX + i * step
            translate(left = x, top = top) {
                if (i % 2 == 1) {
                    scale(scaleX = -1f, scaleY = 1f, pivot = Offset(s / 2f, s / 2f)) {
                        with(leaf) { draw(size = Size(s, s), colorFilter = ColorFilter.tint(color)) }
                    }
                } else {
                    with(leaf) { draw(size = Size(s, s), colorFilter = ColorFilter.tint(color)) }
                }
            }
        }
    }
}
