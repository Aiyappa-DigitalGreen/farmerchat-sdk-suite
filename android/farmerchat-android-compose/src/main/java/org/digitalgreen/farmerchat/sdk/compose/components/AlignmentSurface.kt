package org.digitalgreen.farmerchat.sdk.compose.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.AlignmentChip
import org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind

/**
 * A server-driven alignment surface (2.0.0): a short prompt the farmer answers by tapping a chip,
 * instead of reading a normal answer. Port of the app's `ui/chat/component/AlignmentSurface.kt`
 * (fc-compose-agentic @ c0524dd6).
 *
 * Two shapes, decided by [AlignmentKind.isAdditive]:
 * - **Exclusive** (clarify / confirm / escalate / capability prompts) — owns the message area and
 *   replaces the answer, so it renders its own heading and, where appropriate, an escape hatch.
 * - **Additive** (gender-select / commodity-confirm) — a nudge BELOW a real answer, so it renders
 *   no heading and no escape hatch; the answer above already owns the action row.
 *
 * Escalate gets an urgent treatment derived from `feedbackFail`, keeping the card coherent rather
 * than dropping the brand accent into a red surface.
 */
@Composable
fun AlignmentSurface(
    kind: AlignmentKind,
    message: String,
    chips: List<AlignmentChip>,
    selectedValues: List<String>,
    isLoading: Boolean,
    isLatest: Boolean,
    onChipClick: (AlignmentChip) -> Unit,
    modifier: Modifier = Modifier,
    onTypeInstead: () -> Unit = {},
    /**
     * Non-null while a device capability this surface triggered is in flight (e.g. GPS_PROMPT
     * fetching a location): every chip locks and this label shows beneath them with a spinner.
     */
    fetchingProgressLabel: String? = null,
    /** True when rendering below a real answer; suppresses the heading and escape hatch. */
    additive: Boolean = kind.isAdditive
) {
    val colors = LocalContentColors.current
    val brand = LocalBrandColors.current
    val isEscalate = kind == AlignmentKind.ESCALATE
    val effectiveLoading = isLoading || fetchingProgressLabel != null

    val isCapabilityPrompt = kind == AlignmentKind.GPS_PROMPT || kind == AlignmentKind.UPLOAD_PHOTO
    val hasPick = selectedValues.isNotEmpty()
    // Capability and additive surfaces are single-shot: one tap settles them, so every chip locks.
    // Clarify/confirm stay open so the farmer can pick a different option.
    val chipsLocked = (isCapabilityPrompt || additive) && hasPick

    val content: @Composable ColumnScope.() -> Unit = {
        if (message.isNotBlank()) {
            Text(
                text = message,
                style = MaterialTheme.typography.bodyLarge,
                color = colors.foregroundPrimary
            )
            Spacer(Modifier.height(if (isEscalate || additive) 12.dp else 16.dp))
        }

        if (!isEscalate && !additive) {
            Text(
                text = when (kind) {
                    AlignmentKind.GPS_PROMPT -> label(Labels.SHARE_LOCATION_TITLE, "Share location")
                    AlignmentKind.UPLOAD_PHOTO -> label(Labels.ADD_ONE_CLEAR_PHOTO, "Add one clear photo")
                    AlignmentKind.CONFIRM -> label(Labels.PLEASE_CONFIRM, "Please Confirm")
                    else -> label(Labels.CHOOSE_ONE, "Choose one")
                },
                style = MaterialTheme.typography.titleMedium,
                color = colors.foregroundPrimary
            )
            Spacer(Modifier.height(16.dp))
        }

        if (chips.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                chips.forEachIndexed { index, chip ->
                    val isSelected =
                        (!chip.value.isNullOrBlank() && selectedValues.contains(chip.value)) ||
                            (!chip.label.isNullOrBlank() && selectedValues.contains(chip.label))
                    val tappable = !isSelected && !effectiveLoading && !chipsLocked
                    // Once a pick exists the unpicked chips fade back to Suggested, so the chosen
                    // one reads as the answer rather than one of several live options.
                    val chipType = when {
                        isEscalate -> if (!hasPick || isSelected) ChipType.Escalate else ChipType.Suggested
                        !hasPick || isSelected -> ChipType.Agentic
                        else -> ChipType.Suggested
                    }
                    Chip(
                        label = chip.label.orEmpty(),
                        onClick = { onChipClick(chip) },
                        type = chipType,
                        number = index + 1,
                        enabled = tappable,
                        selected = isSelected
                    )
                }
            }
        }

        if (fetchingProgressLabel != null) {
            Spacer(Modifier.height(16.dp))
            LogoSpinner(type = LogoSpinnerType.Horizontal, label = fetchingProgressLabel)
        }

        // Escape hatch: only on an open, exclusive, non-urgent surface that is still the latest.
        // Without it a farmer whose answer is not among the chips has no way forward.
        if (chips.isNotEmpty() && !isEscalate && !isCapabilityPrompt && !additive &&
            !hasPick && isLatest && !effectiveLoading
        ) {
            Spacer(Modifier.height(12.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Icon(
                    imageVector = Icons.Filled.Info,
                    contentDescription = null,
                    tint = colors.buttonPrimaryAccent,
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    text = label(Labels.DONT_SEE_YOUR_OPTION, "Don't see your option?"),
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.foregroundSecondary
                )
                Text(
                    text = label(Labels.TYPE_OR_SAY_IT, "Type or say it."),
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.SemiBold,
                    color = colors.buttonPrimaryAccent,
                    modifier = Modifier.clickable(onClick = onTypeInstead)
                )
            }
        }
    }

    if (isEscalate) {
        // Urgent surfaces get a tinted, bordered card so they read differently at a glance.
        val fail = brand.feedbackFail
        val shape = SmoothShapes.rounded(Radius.MD)
        Column(
            modifier = modifier
                .fillMaxWidth()
                .clip(shape)
                .background(fail.copy(alpha = 0.08f))
                .border(1.dp, fail.copy(alpha = 0.16f), shape)
                .padding(16.dp),
            content = content
        )
    } else {
        Column(modifier = modifier.fillMaxWidth(), content = content)
    }
}
