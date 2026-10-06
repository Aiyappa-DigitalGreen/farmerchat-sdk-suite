package org.digitalgreen.farmerchat.sdk.compose.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes

/**
 * Visual treatment for a [Chip].
 *
 * - [Suggested] — a related-question suggestion under a normal answer.
 * - [Agentic]   — a quick reply on an alignment surface (clarify / confirm / capability).
 * - [Escalate]  — the urgent treatment, for `alignment-escalate`.
 */
enum class ChipType { Suggested, Agentic, Escalate }

/**
 * A full-width quick-reply chip (2.0.0). Port of the app's `components/chips/Chip.kt`
 * (fc-compose-agentic @ c0524dd6).
 *
 * @param number optional leading badge, for numbered clarify options.
 * @param selected marks an already-picked option: shows a check badge instead of the number, drops
 *   the chevron, and stops taking taps. Wins over [enabled], because a recorded choice should read
 *   as a record rather than a disabled control.
 *
 * The SDK derives the escalate colours from `feedbackFail` rather than introducing dedicated
 * escalate theme tokens, so a host that already themes the SDK gets a coherent urgent treatment
 * with no extra configuration.
 */
@Composable
fun Chip(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    type: ChipType = ChipType.Suggested,
    number: Int? = null,
    enabled: Boolean = true,
    selected: Boolean = false
) {
    val colors = LocalContentColors.current
    val brand = LocalBrandColors.current
    val isEscalate = type == ChipType.Escalate

    // Escalate palette, derived so hosts need no extra tokens.
    val escalateForeground = brand.feedbackFail
    val escalateSurface = brand.feedbackFail.copy(alpha = 0.12f)

    // A selected chip records a pick: no taps, no chevron.
    val clickable = enabled && !selected
    val showChevron = clickable
    // The accent marking a pick — red on the urgent surface, brand accent elsewhere, so the ring
    // and check badge stay coherent instead of dropping green into a red card.
    val selectedAccent = if (isEscalate) escalateForeground else colors.buttonPrimaryAccent

    val surfaceColor = when {
        selected -> if (isEscalate) escalateSurface else colors.surfaceActive
        !enabled -> colors.surfaceTertiary
        isEscalate -> escalateForeground
        type == ChipType.Agentic -> colors.surfaceActive
        else -> colors.surfaceReadingSecondary
    }
    val labelColor = when {
        selected -> colors.foregroundPrimary
        // Muted but readable: foregroundTertiary collides with surfaceTertiary in dark mode
        // (both Neutral700 = #3F3F46), which made disabled chip text invisible. App
        // components/chips/Chip.kt @ 0c8c740f (e335413b).
        !enabled -> colors.foregroundSecondary
        isEscalate -> colors.buttonPrimaryForeground
        else -> colors.foregroundPrimary
    }
    val chevronColor = when {
        !enabled -> colors.foregroundTertiary
        isEscalate -> colors.buttonPrimaryForeground
        type == ChipType.Agentic -> colors.buttonPrimaryAccent
        else -> colors.foregroundSecondary
    }
    val border = when {
        selected -> BorderStroke(1.5.dp, selectedAccent)
        !enabled -> BorderStroke(0.5.dp, colors.borderDefault)
        else -> null
    }

    Surface(
        onClick = onClick,
        enabled = clickable,
        modifier = modifier.fillMaxWidth(),
        shape = SmoothShapes.rounded(Radius.MD),
        color = surfaceColor,
        contentColor = labelColor,
        border = border
    ) {
        Row(
            modifier = Modifier.padding(start = 14.dp, end = 10.dp, top = 14.dp, bottom = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (selected) {
                ChipCheckBadge(accent = selectedAccent)
            } else if (number != null) {
                ChipNumberBadge(number = number, type = type, enabled = enabled)
            }
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                // REQUESTED: chip labels are bold in every state. The app bolds only the
                // SELECTED chip (`if (selected) FontWeight.Bold else null`, Chip.kt:127) and
                // leaves the rest at labelMedium's 600. Recorded in docs/05.
                fontWeight = FontWeight.Bold,
                color = labelColor,
                modifier = Modifier.weight(1f)
            )
            if (showChevron) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                    contentDescription = null,
                    tint = chevronColor,
                    modifier = Modifier.size(24.dp)
                )
            }
        }
    }
}

/** The "chosen" badge — a filled [accent] circle with a check, replacing the number. */
@Composable
private fun ChipCheckBadge(accent: Color) {
    val colors = LocalContentColors.current
    Box(
        modifier = Modifier
            .size(24.dp)
            .clip(SmoothShapes.rounded(Radius.Rounded))
            .background(accent),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Filled.Check,
            contentDescription = null,
            tint = colors.buttonPrimaryForeground,
            modifier = Modifier.size(16.dp)
        )
    }
}

/** The leading numbered badge — a filled circle with the number centred inside. */
@Composable
private fun ChipNumberBadge(number: Int, type: ChipType, enabled: Boolean) {
    val colors = LocalContentColors.current
    val brand = LocalBrandColors.current
    val isEscalate = type == ChipType.Escalate
    val bg = when {
        // The disabled badge circle used to be surfaceTertiary — exactly the disabled chip
        // surface — so the circle vanished into the chip in BOTH themes. It now uses the
        // muted-but-distinct secondary foreground, as the app does (97832e9a).
        !enabled -> colors.foregroundSecondary
        isEscalate -> colors.buttonPrimaryForeground.copy(alpha = 0.22f)
        else -> colors.buttonPrimaryAccent
    }
    val fg = when {
        // Echo the chip surface on the muted disabled badge so the numeral stays legible in
        // both themes (light numeral over the dark light-mode circle, dark numeral over the
        // light dark-mode one). foregroundTertiary here was the same Neutral700 as the circle.
        !enabled -> colors.surfaceTertiary
        isEscalate -> colors.buttonPrimaryForeground
        else -> colors.buttonPrimaryForeground
    }
    Box(
        modifier = Modifier
            .size(24.dp)
            .clip(SmoothShapes.rounded(Radius.Rounded))
            .background(bg),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = number.toString(),
            // App parity (Chip.kt:197): the badge number is labelMedium with the style's own
            // weight. The SDK had labelSmall + SemiBold, so the number rendered smaller and
            // lighter than the app's.
            style = MaterialTheme.typography.labelMedium,
            color = fg
        )
    }
}
