package org.digitalgreen.farmerchat.sdk.compose.components

import android.net.Uri
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius

/**
 * Right-aligned user chat bubble supporting text, image (thumbnail or 16:9
 * banner) and voice clip variants (port of the app's UserChatBubble).
 */
@Composable
fun UserChatBubble(
    text: String,
    modifier: Modifier = Modifier,
    imageUri: Uri? = null,
    userBubbleImageWideBanner: Boolean = false,
    audioUri: Uri? = null,
    onRemoveImage: (() -> Unit)? = null,
    showVoiceClip: Boolean = false,
    voiceClipState: VoiceClipState = VoiceClipState.Playback,
    voiceDurationMs: Long = 0L,
    voicePositionMs: Long = 0L,
    onVoicePlayClick: () -> Unit = {},
    onVoicePauseClick: () -> Unit = {}
) {
    val contentColors = LocalContentColors.current

    // Asymmetric shape: 3 corners XL, bottom-right sharp
    val bubbleShape = RoundedCornerShape(
        topStart = Radius.XL,
        topEnd = Radius.XL,
        bottomStart = Radius.XL,
        bottomEnd = 0.dp
    )

    Column(
        modifier = modifier
            .widthIn(max = 290.dp)
            .clip(bubbleShape)
            .background(contentColors.surfaceReadingSecondary)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        if (showVoiceClip || audioUri != null) {
            VoiceClip(
                state = voiceClipState,
                barCount = 26,
                durationMs = voiceDurationMs,
                positionMs = voicePositionMs,
                onPlayClick = onVoicePlayClick,
                onPauseClick = onVoicePauseClick,
                modifier = Modifier.fillMaxWidth(),
                backgroundColor = contentColors.surfaceSecondary
            )
        }

        if (imageUri != null) {
            if (userBubbleImageWideBanner) {
                AsyncImage(
                    model = imageUri.toString(),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .widthIn(max = (290 * 0.85f).dp)
                        .aspectRatio(16f / 9f)
                        .clip(RoundedCornerShape(Radius.SM))
                )
            } else {
                PhotoThumbnail(
                    imageUri = imageUri,
                    onRemove = onRemoveImage ?: {},
                    size = 80,
                    showRemoveButton = onRemoveImage != null
                )
            }
        }

        if (text.isNotBlank()) {
            AnimatedContent(
                targetState = text.trim(),
                transitionSpec = {
                    fadeIn(animationSpec = tween(400)) togetherWith fadeOut(animationSpec = tween(400))
                },
                label = "userBubbleText"
            ) { displayText ->
                Text(
                    text = displayText,
                    style = MaterialTheme.typography.bodyMedium,
                    color = contentColors.foregroundPrimary
                )
            }
        }
    }
}
