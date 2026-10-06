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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.digitalgreen.farmerchat.sdk.FarmerChat
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
    // Chat UI customization (null = current theme behavior).
    val config = FarmerChat.requireGraph().config
    val cornerRadius = config.bubbleCornerRadius?.dp ?: Radius.XL

    // Asymmetric shape: 3 corners XL, bottom-right sharp
    val bubbleShape = RoundedCornerShape(
        topStart = cornerRadius,
        topEnd = cornerRadius,
        bottomStart = cornerRadius,
        bottomEnd = 0.dp
    )

    // App UserChatBubble.kt:72-76: a photo with no caption and no voice is shown bare —
    // 220x160dp, 16dp corners, no bubble behind it.
    if (imageUri != null && text.isBlank() && audioUri == null && !showVoiceClip) {
        AsyncImage(
            model = imageUri.toString(),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = modifier
                .size(width = 220.dp, height = 160.dp)
                .clip(RoundedCornerShape(16.dp))
        )
        return
    }

    Column(
        modifier = modifier
            .widthIn(max = 290.dp)
            .clip(bubbleShape)
            .background(config.userBubbleColor?.let { Color(it) } ?: contentColors.surfaceReadingSecondary)
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
                    // App UserChatBubble.kt:129-138: full bubble width, 16:9, 16dp corners.
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(16f / 9f)
                        .clip(RoundedCornerShape(16.dp))
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
                    style = config.messageFontSizeSp?.let {
                        MaterialTheme.typography.bodyMedium.copy(fontSize = it.sp)
                    } ?: MaterialTheme.typography.bodyMedium,
                    color = config.userBubbleTextColor?.let { Color(it) } ?: contentColors.foregroundPrimary
                )
            }
        }
    }
}
