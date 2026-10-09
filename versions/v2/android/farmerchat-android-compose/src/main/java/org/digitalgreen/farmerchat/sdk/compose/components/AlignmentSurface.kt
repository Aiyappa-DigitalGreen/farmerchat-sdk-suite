package org.digitalgreen.farmerchat.sdk.compose.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.digitalgreen.farmerchat.sdk.compose.R
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
    additive: Boolean = kind.isAdditive,
    /**
     * The surface's wire `blocking` flag (2.0.0). True means the backend cannot proceed until this
     * is answered, so the escape hatch is withheld — offering "type or say it" on a blocking
     * surface invites the farmer down a path the backend will just re-ask. Live `gps-prompt`
     * sends `blocking: true`; absent on the wire → false, the pre-2026-09-03 behaviour.
     */
    blocking: Boolean = false,
    /** Listen pill (app AlignmentSurface.kt:76-80) — TTS for the live, exclusive surface. */
    onListenClick: () -> Unit = {},
    listenLoading: Boolean = false,
    listenPlaying: Boolean = false,
    hasAudioUrl: Boolean = false,
    isTtsEnabled: Boolean = true
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

    // Header + chips. Rendered plainly (clarify / confirm / escalate / additive) or inside the
    // bordered capability card. App parity: AlignmentSurface.kt `optionsContent`.
    val optionsContent: @Composable ColumnScope.() -> Unit = {
        if (!isEscalate && !additive) {
            Text(
                text = when (kind) {
                    AlignmentKind.GPS_PROMPT -> label(Labels.SHARE_LOCATION_TITLE, "Share location")
                    AlignmentKind.UPLOAD_PHOTO -> label(Labels.ADD_ONE_CLEAR_PHOTO, "Add one clear photo")
                    AlignmentKind.CONFIRM -> label(Labels.PLEASE_CONFIRM, "Please confirm")
                    else -> label(Labels.CHOOSE_ONE, "Choose one")
                },
                style = MaterialTheme.typography.titleMedium,
                color = colors.foregroundPrimary
            )
        }

        if (chips.isNotEmpty()) {
            // The 16dp gap belongs to the header; escalate and additive have none.
            if (!isEscalate && !additive) Spacer(Modifier.height(16.dp))
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
    }

    // Capability in progress: spinner + label BELOW the (bordered) card, never inside it.
    val progressRow: @Composable ColumnScope.() -> Unit = {
        if (fetchingProgressLabel != null) {
            Spacer(Modifier.height(16.dp))
            LogoSpinner(type = LogoSpinnerType.Horizontal, label = fetchingProgressLabel)
        }
    }

    // Escape hatch: only on an open, exclusive, non-urgent surface that is still the latest.
    // App parity (AlignmentSurface.kt:195): ONE text run — hint (secondary) + " " + the CTA
    // (accent, SemiBold), bodySmall, with only the CTA clickable.
    val escapeHatch: @Composable ColumnScope.() -> Unit = {
        if (chips.isNotEmpty() && !isEscalate && !isCapabilityPrompt && !additive &&
            !hasPick && isLatest && !effectiveLoading && !blocking
        ) {
            Spacer(Modifier.height(12.dp))
            val hint = label(Labels.DONT_SEE_YOUR_OPTION, "Don't see your option?")
            val cta = label(Labels.TYPE_OR_SAY_IT, "Type or say it.")
            val text = buildAnnotatedString {
                withStyle(SpanStyle(color = colors.foregroundSecondary)) { append(hint) }
                append(" ")
                withLink(LinkAnnotation.Clickable(tag = "type_instead") { onTypeInstead() }) {
                    withStyle(
                        SpanStyle(color = colors.buttonPrimaryAccent, fontWeight = FontWeight.SemiBold)
                    ) { append(cta) }
                }
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Icon(
                    painter = painterResource(id = R.drawable.fc_icon_info),
                    contentDescription = null,
                    tint = colors.buttonPrimaryAccent,
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    text = text,
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.foregroundSecondary
                )
            }
        }
    }

    val content: @Composable ColumnScope.() -> Unit = {
        // App parity (AlignmentSurface.kt:226): the prompt goes through the markdown renderer
        // (bodyMedium), not a plain bodyLarge Text.
        if (message.isNotBlank()) {
            MarkdownText(text = message, color = colors.foregroundPrimary)
        }

        // Listen pill — only while this is the live prompt (latest + idle): TTS targets the
        // latest response. Never on the urgent escalate surface or an additive nudge.
        if (!isEscalate && !additive && isLatest && !effectiveLoading) {
            Spacer(Modifier.height(16.dp))
            ListenButton(
                onClick = onListenClick,
                isLoading = listenLoading,
                isPlaying = listenPlaying,
                hasAudioUrl = hasAudioUrl,
                enabled = isTtsEnabled,
                light = true
            )
        }

        Spacer(Modifier.height(16.dp))
        if (isCapabilityPrompt) {
            // App parity (AlignmentSurface.kt:256): header + chips in a thin-bordered radius-16
            // card; no escape hatch; the fetch progress sits below the card.
            val cardShape = SmoothShapes.rounded(Radius.LG)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(cardShape)
                    .border(1.dp, colors.borderDefault, cardShape)
                    .padding(16.dp),
                content = optionsContent
            )
            progressRow()
        } else {
            optionsContent()
            progressRow()
            escapeHatch()
        }
    }

    if (isEscalate) {
        // Urgent surfaces get a tinted, bordered card. App parity: Radius.LG (16), escalateSurface
        // (Red500 8%) + escalateBorder (Red500 16%), derived from feedbackFail.
        val fail = brand.feedbackFail
        val shape = SmoothShapes.rounded(Radius.LG)
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
