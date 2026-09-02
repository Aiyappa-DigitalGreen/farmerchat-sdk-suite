package org.digitalgreen.farmerchat.sdk.compose.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.digitalgreen.farmerchat.sdk.compose.R
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import kotlin.math.floor

/** Height (and width) of each leaf in the divider. Small + gapless = a subtle texture. */
private val LeafSize = 4.dp

/**
 * Centered section title flanked by a row of leaves on each side. The leaves tile to
 * fill the available width and alternate facing direction (forward / backward), so the
 * pattern stretches or shrinks automatically when the title length changes.
 * Matches the "For your farm" header in Figma 1.2 Home.
 */
@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    titleColor: Color = LocalContentColors.current.foregroundPrimary,
    accentColor: Color = LocalContentColors.current.buttonPrimaryAccent,
    horizontalPadding: Dp = 24.dp,
    // Matches the Figma SectionHeader component's py-16 — gives the title/dividers
    // breathing room above and below rather than sitting flush against neighbours.
    verticalPadding: Dp = 16.dp,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = horizontalPadding, vertical = verticalPadding),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        LeafDivider(color = accentColor, modifier = Modifier.weight(1f))
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium.copy(
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
            ),
            color = titleColor,
            textAlign = TextAlign.Center,
        )
        LeafDivider(color = accentColor, modifier = Modifier.weight(1f))
    }
}

/**
 * A row of leaves tiled across [modifier]'s width, every other one flipped horizontally
 * so they face forward / backward / forward / backward. The count is derived from the
 * measured width, so the divider fills whatever space is left beside the title.
 */
@Composable
private fun LeafDivider(
    color: Color,
    modifier: Modifier = Modifier,
) {
    val leaf = painterResource(id = R.drawable.fc_leaf)
    Canvas(modifier = modifier.height(LeafSize)) {
        val s = size.height                 // leaf is square; sized to the row height
        val gap = 0f                         // gapless — leaves sit right next to each other
        val step = s + gap
        if (step <= 0f || size.width <= 0f) return@Canvas

        val count = floor((size.width + gap) / step).toInt().coerceAtLeast(0)
        val rowWidth = count * step - gap
        val startX = (size.width - rowWidth) / 2f   // centre the tiled row
        val top = (size.height - s) / 2f

        for (i in 0 until count) {
            val x = startX + i * step
            translate(left = x, top = top) {
                if (i % 2 == 1) {
                    // Backward-facing: mirror horizontally about the leaf's centre.
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