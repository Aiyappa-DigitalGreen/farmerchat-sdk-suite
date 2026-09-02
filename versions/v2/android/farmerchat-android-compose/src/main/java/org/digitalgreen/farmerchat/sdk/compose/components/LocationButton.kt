package org.digitalgreen.farmerchat.sdk.compose.components

import android.os.Build
import android.view.HapticFeedbackConstants
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.core.tween
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.GpsOff
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors

/**
 * Mirrors the Figma `updates/LocationButton` component set on Sprint: Location 2.0.
 * Error variant exists in Figma but isn't needed here — location fetch errors
 * are surfaced via the shared GPS Error screen instead of this pill.
 */
enum class LocationButtonState {
    Invite,     // "Set your location"
    Searching,  // "Getting your location"
    Success,    // "Location found" — held briefly before settling
    Located,    // "<Place> - Change"
    Blocked,    // "Allow location in Settings" — permission denied twice
}

/**
 * The inline location button that sits under the Home section header. One pill
 * carries the whole acquisition lifecycle; the width morphs smoothly between
 * states via [AnimatedContent]'s size transform so label swaps never snap.
 */
@Composable
fun LocationButton(
    state: LocationButtonState,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    placeName: String = "",
) {
    val brand = LocalBrandColors.current
    val type = MaterialTheme.typography
    val context = LocalContext.current
    val shape = RoundedCornerShape(percent = 50)
    val interactionSource = remember { MutableInteractionSource() }

    // Figma: the pill is Green800 at 72% only while inviting; once acquisition
    // starts (and after), it solidifies to 100%.
    val fillAlpha by animateFloatAsState(
        targetValue = if (state == LocationButtonState.Invite) 0.72f else 1f,
        animationSpec = tween(durationMillis = 300),
        label = "locationButtonFill"
    )

    // Haptics ride the state machine, not the raw tap, so dead taps (mid-search)
    // stay silent: a light key tick when acquisition starts, a success confirm
    // when the location lands. Documented in the Figma notes under screens 1/4/5.
    val view = LocalView.current
    LaunchedEffect(state) {
        when (state) {
            LocationButtonState.Searching ->
                view.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)

            LocationButtonState.Success ->
                view.performHapticFeedback(
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) HapticFeedbackConstants.CONFIRM
                    else HapticFeedbackConstants.VIRTUAL_KEY
                )

            else -> Unit
        }
    }

    Row(
        modifier = modifier
            .clip(shape)
            .background(brand.surfaceSecondary.copy(alpha = fillAlpha))
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick
            )
    ) {
        AnimatedContent(
            targetState = state to placeName,
            transitionSpec = {
                // Old content fades fast, new content fades in once the pill has
                // mostly reached its new width; the width itself follows a soft
                // spring. No slides, no scale — just a fluid morph.
                (fadeIn(tween(durationMillis = 240, delayMillis = 100)) togetherWith
                        fadeOut(tween(durationMillis = 100)))
                    .using(
                        SizeTransform(clip = false) { _, _ ->
                            spring(dampingRatio = 0.85f, stiffness = 380f)
                        }
                    )
            },
            label = "locationButtonContent"
        ) { (target, place) ->
            // Figma per-state metrics: 14/22 asymmetric padding (icon side
            // tighter, text side wider to balance), 22dp icon, and a shorter
            // 40dp pill once acquisition succeeds.
            val pillHeight = when (target) {
                LocationButtonState.Success, LocationButtonState.Located -> 40.dp
                else -> 42.dp
            }
            val iconGap = when (target) {
                LocationButtonState.Searching -> 8.dp
                LocationButtonState.Success, LocationButtonState.Located -> 4.dp
                else -> 6.dp
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .height(pillHeight)
                    .padding(start = 14.dp, end = 22.dp)
            ) {
                when (target) {
                    LocationButtonState.Invite -> {
                        Icon(
                            imageVector = Icons.Filled.MyLocation,
                            contentDescription = null,
                            tint = brand.foregroundSecondary,
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(Modifier.width(iconGap))
                        Text(
                            text = label(Labels.SET_YOUR_LOCATION, "Set your location"),
                            style = type.labelMedium,
                            color = brand.foregroundPrimary,
                            maxLines = 1
                        )
                    }

                    LocationButtonState.Searching -> {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                            color = brand.foregroundSecondary,
                            trackColor = brand.foregroundPrimary.copy(alpha = 0.15f)
                        )
                        Spacer(Modifier.width(iconGap))
                        Text(
                            text = label(Labels.GETTING_YOUR_LOCATION, "Getting your location"),
                            style = type.labelMedium,
                            color = brand.foregroundPrimary,
                            maxLines = 1
                        )
                    }

                    LocationButtonState.Success -> {
                        Icon(
                            imageVector = Icons.Filled.Check,
                            contentDescription = null,
                            tint = brand.foregroundSecondary,
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(Modifier.width(iconGap))
                        Text(
                            text = label(Labels.LOCATION_FOUND, "Location found"),
                            style = type.labelMedium,
                            color = brand.foregroundPrimary,
                            maxLines = 1
                        )
                    }

                    LocationButtonState.Located -> {
                        Icon(
                            imageVector = Icons.Filled.Place,
                            contentDescription = null,
                            tint = brand.foregroundSecondary,
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(Modifier.width(iconGap))
                        Text(
                            text = buildAnnotatedString {
                                append(place)
                                append(" - ")
                                withStyle(SpanStyle(color = brand.foregroundSecondary)) {
                                    append(label(Labels.CHANGE, "Change"))
                                }
                            },
                            style = type.labelMedium,
                            color = brand.foregroundPrimary,
                            maxLines = 1
                        )
                    }

                    LocationButtonState.Blocked -> {
                        Icon(
                            imageVector = Icons.Filled.GpsOff,
                            contentDescription = null,
                            tint = brand.foregroundSecondary,
                            modifier = Modifier.size(22.dp)
                        )
                        Spacer(Modifier.width(iconGap))
                        Text(
                            text = label(Labels.ALLOW_LOCATION_IN_SETTINGS, "Allow location in Settings"),
                            style = type.labelMedium,
                            color = brand.foregroundPrimary,
                            maxLines = 1
                        )
                    }
                }
            }
        }
    }
}
