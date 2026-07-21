package org.digitalgreen.farmerchat.sdk.compose.components

import android.net.Uri
import androidx.annotation.DrawableRes
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.compose.R
import org.digitalgreen.farmerchat.sdk.compose.theme.LightContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.theme.Containers
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.core.audio.AudioRecorder
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import java.io.File
import kotlin.random.Random

// ---------------------------------------------------------------------------
// PrimaryInputButtons (Photo / Speak / Type)
// ---------------------------------------------------------------------------

enum class PrimaryInputButtonsType { HomeScreen, ChatScreen }

@Composable
fun PrimaryInputButtons(
    type: PrimaryInputButtonsType,
    onPhotoClick: () -> Unit,
    onSpeakClick: () -> Unit,
    onTypeClick: () -> Unit,
    modifier: Modifier = Modifier,
    extraTopPadding: Dp = 0.dp,
    isSticky: Boolean = false
) {
    val brandColor = LocalBrandColors.current
    val navBarPadding = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()

    val (buttonHeight, buttonPaddingTop, buttonPaddingBottom, containerPaddingBottom) = when (type) {
        PrimaryInputButtonsType.HomeScreen -> ButtonVariant(78.dp, 17.dp, 12.dp, 10.dp)
        PrimaryInputButtonsType.ChatScreen -> ButtonVariant(72.dp, 13.dp, 9.dp, navBarPadding)
    }

    val topBorderModifier = if (type == PrimaryInputButtonsType.ChatScreen) {
        Modifier.drawBehind {
            drawLine(
                color = Color.Black.copy(alpha = 0.1f),
                start = Offset(0f, 0f),
                end = Offset(size.width, 0f),
                strokeWidth = 0.5.dp.toPx()
            )
        }
    } else {
        Modifier
    }

    val shadowAlpha by animateFloatAsState(
        targetValue = if (isSticky && type == PrimaryInputButtonsType.HomeScreen) 0.12f else 0f,
        animationSpec = tween(durationMillis = 250),
        label = "stickyShadow"
    )

    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(brandColor.surfacePrimary)
            .drawWithContent {
                drawContent()
                if (shadowAlpha > 0f) {
                    val shadowHeight = 16.dp.toPx()
                    drawRect(
                        brush = Brush.verticalGradient(
                            colors = listOf(
                                Color.Black.copy(alpha = shadowAlpha),
                                Color.Transparent
                            ),
                            startY = size.height,
                            endY = size.height + shadowHeight
                        ),
                        topLeft = Offset(0f, size.height),
                        size = Size(size.width, shadowHeight)
                    )
                }
            }
            .then(topBorderModifier)
            .padding(
                start = 16.dp,
                end = 16.dp,
                top = extraTopPadding + 8.dp,
                bottom = containerPaddingBottom
            ),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        UserInputButton(
            label = label(Labels.PHOTO, "Photo"),
            iconRes = R.drawable.fc_icon_camera,
            onClick = onPhotoClick,
            modifier = Modifier.weight(1f),
            height = buttonHeight,
            paddingTop = buttonPaddingTop,
            paddingBottom = buttonPaddingBottom
        )

        UserInputButton(
            label = label(Labels.SPEAK, "Speak"),
            iconRes = R.drawable.fc_icon_mic,
            onClick = onSpeakClick,
            modifier = Modifier.weight(1f),
            height = buttonHeight,
            paddingTop = buttonPaddingTop,
            paddingBottom = buttonPaddingBottom
        )

        UserInputButton(
            label = label(Labels.TYPE, "Type"),
            iconRes = R.drawable.fc_icon_keyboard,
            onClick = onTypeClick,
            modifier = Modifier.weight(1f),
            height = buttonHeight,
            paddingTop = buttonPaddingTop,
            paddingBottom = buttonPaddingBottom
        )
    }
}

private data class ButtonVariant(
    val height: Dp,
    val paddingTop: Dp,
    val paddingBottom: Dp,
    val containerPaddingBottom: Dp
)

@Composable
private fun UserInputButton(
    label: String,
    @DrawableRes iconRes: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    height: Dp = 78.dp,
    paddingTop: Dp = 15.dp,
    paddingBottom: Dp = 12.dp
) {
    val type = MaterialTheme.typography
    val shape = SmoothShapes.rounded(Radius.LG)
    val brandColor = LocalBrandColors.current
    val contentColor = LocalContentColors.current

    Column(
        modifier = modifier
            .height(height)
            .tapScale(onClick = onClick)
            .clip(shape)
            .then(Containers.flat(radius = Radius.LG, background = brandColor.surfaceSecondary))
            .padding(start = 8.dp, end = 8.dp, top = paddingTop, bottom = paddingBottom),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        val density = LocalDensity.current
        Image(
            painter = painterResource(id = iconRes),
            contentDescription = null,
            modifier = Modifier.size(28.dp),
            colorFilter = androidx.compose.ui.graphics.ColorFilter.tint(brandColor.foregroundSecondary)
        )

        Text(
            text = label,
            style = type.labelSmall.copy(
                fontSize = with(density) { type.labelSmall.fontSize / fontScale }
            ),
            color = contentColor.buttonPrimaryForeground
        )
    }
}

// ---------------------------------------------------------------------------
// InputActionButton (circular action, always light-mode colors)
// ---------------------------------------------------------------------------

@Composable
fun InputActionButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    @DrawableRes iconRes: Int? = null,
    imageVector: ImageVector? = null,
    contentDescription: String? = null,
    isLoading: Boolean = false,
    enabled: Boolean = true,
    size: Dp = 48.dp,
    iconSize: Dp = 22.dp,
    overrideBackgroundColor: Color? = null,
    overrideIconTint: Color? = null
) {
    CompositionLocalProvider(LocalContentColors provides org.digitalgreen.farmerchat.sdk.compose.theme.hostLightContentColors()) {
        val buttonColors = LocalContentColors.current

        Box(
            modifier = modifier
                .size(size)
                .clip(CircleShape)
                .background(overrideBackgroundColor ?: buttonColors.buttonPrimarySurface)
                .clickable(enabled = enabled && !isLoading) { onClick() },
            contentAlignment = Alignment.Center
        ) {
            if (isLoading) {
                val infiniteTransition = rememberInfiniteTransition(label = "loading")
                val rotation by infiniteTransition.animateFloat(
                    initialValue = 0f,
                    targetValue = 360f,
                    animationSpec = infiniteRepeatable(
                        animation = tween(1000, easing = LinearEasing)
                    ),
                    label = "rotation"
                )
                CircularProgressIndicator(
                    modifier = Modifier
                        .size(iconSize - 2.dp)
                        .rotate(rotation),
                    color = buttonColors.buttonPrimaryAccent,
                    strokeWidth = 2.5.dp,
                    strokeCap = StrokeCap.Round,
                    trackColor = Color.Transparent
                )
            } else {
                when {
                    iconRes != null -> Icon(
                        painter = painterResource(id = iconRes),
                        contentDescription = contentDescription,
                        tint = overrideIconTint ?: buttonColors.buttonPrimaryAccent,
                        modifier = Modifier.size(iconSize)
                    )
                    imageVector != null -> Icon(
                        imageVector = imageVector,
                        contentDescription = contentDescription,
                        tint = overrideIconTint ?: buttonColors.buttonPrimaryAccent,
                        modifier = Modifier.size(iconSize)
                    )
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// PhotoThumbnail
// ---------------------------------------------------------------------------

@Composable
fun PhotoThumbnail(
    imageUri: Uri? = null,
    onRemove: () -> Unit = {},
    modifier: Modifier = Modifier,
    size: Int = 64,
    showRemoveButton: Boolean = true
) {
    val contentColors = LocalContentColors.current
    val context = LocalContext.current

    Box(modifier = modifier.size(size.dp)) {
        AsyncImage(
            model = ImageRequest.Builder(context)
                .data(imageUri)
                .crossfade(true)
                .build(),
            contentDescription = "Attached photo",
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .size(size.dp)
                .clip(SmoothShapes.rounded(Radius.SM))
        )

        if (showRemoveButton) {
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(3.dp)
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(contentColors.surfaceSecondary)
                    .clickable { onRemove() },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Filled.Close,
                    contentDescription = "Remove photo",
                    tint = contentColors.foregroundPrimary,
                    modifier = Modifier.size(14.dp)
                )
            }
        }
    }
}

// ---------------------------------------------------------------------------
// VoiceClip (waveform + play/pause + timer)
// ---------------------------------------------------------------------------

enum class VoiceClipState { Recording, Processing, Playback, Loading, Playing, Error }

private const val MAX_RECORDING_SECONDS = 30

@Composable
fun VoiceClip(
    state: VoiceClipState,
    modifier: Modifier = Modifier,
    barCount: Int = 40,
    durationMs: Long = 0L,
    positionMs: Long = 0L,
    onPlayClick: () -> Unit = {},
    onPauseClick: () -> Unit = {},
    onRecordingComplete: () -> Unit = {},
    backgroundColor: Color? = null
) {
    val contentColors = LocalContentColors.current
    val activeColor = contentColors.buttonPrimaryAccent
    val inactiveColor = contentColors.foregroundTertiary

    var recordingSecondsRemaining by remember { mutableIntStateOf(MAX_RECORDING_SECONDS) }
    var isTimerVisible by remember { mutableStateOf(true) }

    val amplitudes = remember(barCount) {
        List(barCount) { Random.nextFloat().coerceIn(0.15f, 1f) }
    }

    val animatedBars = remember(barCount) {
        List(barCount) { i ->
            androidx.compose.animation.core.Animatable(amplitudes[i])
        }
    }

    LaunchedEffect(state) {
        if (state == VoiceClipState.Recording) {
            recordingSecondsRemaining = MAX_RECORDING_SECONDS
            while (recordingSecondsRemaining > 0) {
                delay(1000L)
                recordingSecondsRemaining--
                if (recordingSecondsRemaining == 0) {
                    onRecordingComplete()
                }
            }
        }
    }

    LaunchedEffect(state, recordingSecondsRemaining) {
        if (state == VoiceClipState.Recording && recordingSecondsRemaining <= 5) {
            while (recordingSecondsRemaining > 0) {
                isTimerVisible = !isTimerVisible
                delay(500L)
            }
        } else {
            isTimerVisible = true
        }
    }

    LaunchedEffect(state) {
        if (state == VoiceClipState.Recording) {
            while (true) {
                animatedBars.forEach { bar ->
                    launch {
                        val target = (bar.value * 0.6f + Random.nextFloat() * 0.4f).coerceIn(0.15f, 1f)
                        bar.animateTo(
                            targetValue = target,
                            animationSpec = tween(
                                durationMillis = Random.nextInt(70, 130),
                                easing = androidx.compose.animation.core.FastOutSlowInEasing
                            )
                        )
                    }
                }
                delay(Random.nextLong(80, 120))
            }
        }
    }

    val recordingProgress = remember(recordingSecondsRemaining) {
        1f - (recordingSecondsRemaining.toFloat() / MAX_RECORDING_SECONDS)
    }

    val playbackProgress = if (durationMs > 0) {
        (positionMs.toFloat() / durationMs).coerceIn(0f, 1f)
    } else 0f

    val showButton = state in listOf(
        VoiceClipState.Playback, VoiceClipState.Loading, VoiceClipState.Playing, VoiceClipState.Error
    )

    val timerText = when (state) {
        VoiceClipState.Recording -> "0:${recordingSecondsRemaining.toString().padStart(2, '0')}"
        VoiceClipState.Processing -> "0:${recordingSecondsRemaining.toString().padStart(2, '0')}"
        VoiceClipState.Error -> "0:00"
        VoiceClipState.Playback, VoiceClipState.Loading -> {
            val totalSeconds = (durationMs / 1000).toInt()
            val minutes = totalSeconds / 60
            val seconds = totalSeconds % 60
            "$minutes:${seconds.toString().padStart(2, '0')}"
        }
        VoiceClipState.Playing -> {
            val currentSeconds = (positionMs / 1000).toInt()
            val minutes = currentSeconds / 60
            val seconds = currentSeconds % 60
            "$minutes:${seconds.toString().padStart(2, '0')}"
        }
    }

    val timerColor = when (state) {
        VoiceClipState.Processing -> contentColors.foregroundTertiary
        else -> contentColors.foregroundSecondary
    }

    val timerAlpha = when {
        state == VoiceClipState.Error -> 0.5f
        state == VoiceClipState.Recording && recordingSecondsRemaining <= 5 ->
            if (isTimerVisible) 1f else 0f
        else -> 1f
    }

    Row(
        modifier = modifier
            .clip(SmoothShapes.rounded(Radius.Rounded))
            .background(backgroundColor ?: contentColors.surfacePrimary)
            .height(50.dp)
            .padding(
                start = if (showButton) 8.dp else 18.dp,
                end = 16.dp,
                top = 6.dp,
                bottom = 6.dp
            ),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(if (showButton) 8.dp else 6.dp)
    ) {
        if (showButton) {
            val brandColors = LocalBrandColors.current
            InputActionButton(
                onClick = {
                    when (state) {
                        VoiceClipState.Playback -> onPlayClick()
                        VoiceClipState.Playing -> onPauseClick()
                        else -> {}
                    }
                },
                imageVector = when (state) {
                    VoiceClipState.Error -> Icons.Filled.Close
                    VoiceClipState.Playing -> Icons.Filled.Pause
                    else -> Icons.Filled.PlayArrow
                },
                contentDescription = when (state) {
                    VoiceClipState.Error -> "Error"
                    VoiceClipState.Playing -> "Pause"
                    else -> "Play"
                },
                isLoading = state == VoiceClipState.Loading,
                enabled = state != VoiceClipState.Error,
                size = 38.dp,
                iconSize = if (state == VoiceClipState.Error) 28.dp else 24.dp,
                overrideBackgroundColor = if (state == VoiceClipState.Error) brandColors.feedbackFail else null,
                overrideIconTint = if (state == VoiceClipState.Error) Color.White else null
            )
        }

        Row(
            modifier = Modifier
                .weight(1f)
                .height(38.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            amplitudes.forEachIndexed { index, amplitude ->
                val recordingProgressIndex = (recordingProgress * barCount).toInt()
                val playbackProgressIndex = (playbackProgress * barCount).toInt()

                val barHeight = when (state) {
                    VoiceClipState.Error -> 9.dp
                    VoiceClipState.Processing, VoiceClipState.Recording -> {
                        if (index < recordingProgressIndex) {
                            (animatedBars[index].value * 30).dp.coerceIn(6.dp, 30.dp)
                        } else {
                            8.dp
                        }
                    }
                    else -> (amplitude * 30).dp.coerceIn(6.dp, 30.dp)
                }

                val barColor = when (state) {
                    VoiceClipState.Recording ->
                        if (index < recordingProgressIndex) activeColor else inactiveColor
                    VoiceClipState.Playing ->
                        if (index <= playbackProgressIndex) activeColor else inactiveColor
                    else -> inactiveColor
                }

                Box(
                    modifier = Modifier
                        .width(3.dp)
                        .height(barHeight)
                        .background(barColor, shape = RoundedCornerShape(8.dp))
                )
            }
        }

        Text(
            text = timerText,
            style = MaterialTheme.typography.labelSmall,
            color = timerColor,
            modifier = Modifier.alpha(timerAlpha)
        )
    }
}

// ---------------------------------------------------------------------------
// TextInputOverlay (bottom chat text input sheet)
// ---------------------------------------------------------------------------

@Composable
fun TextInputOverlay(
    modifier: Modifier = Modifier,
    onSend: (String, Uri?) -> Unit,
    onPhotoClick: () -> Unit = {},
    onVoiceClick: () -> Unit = {},
    onFocusRequest: ((() -> Unit) -> Unit)? = null,
    onClearRequest: ((() -> Unit) -> Unit)? = null,
    onTextChange: ((String) -> Unit)? = null,
    isAnchored: Boolean = false,
    onFocusChange: ((Boolean) -> Unit)? = null,
    photoUris: List<Uri> = emptyList(),
    onRemovePhoto: (Int) -> Unit = {},
    showScrollButton: Boolean = false,
    onScrollToBottom: () -> Unit = {},
    placeholder: String = label(Labels.ASK_ABOUT_YOUR_FARM, "Ask about your farm...")
) {
    val contentColors = LocalContentColors.current
    var textFieldValue by remember { mutableStateOf(TextFieldValue("")) }
    var isFocused by remember { mutableStateOf(false) }
    val focusRequester = remember { FocusRequester() }
    val focusManager = LocalFocusManager.current
    val keyboardController = LocalSoftwareKeyboardController.current
    val density = LocalDensity.current

    val imeBottom = WindowInsets.ime.getBottom(density)
    val isKeyboardVisible = imeBottom > 0
    val currentIsFocused by rememberUpdatedState(isFocused)

    LaunchedEffect(isKeyboardVisible) {
        if (!isKeyboardVisible && currentIsFocused) {
            focusManager.clearFocus()
        }
    }

    val requestInputFocus: () -> Unit = { focusRequester.requestFocus() }
    LaunchedEffect(Unit) {
        onFocusRequest?.invoke(requestInputFocus)
    }

    val clearText: () -> Unit = {
        textFieldValue = TextFieldValue("")
        isFocused = false
        focusManager.clearFocus(force = true)
        keyboardController?.hide()
    }
    LaunchedEffect(Unit) {
        onClearRequest?.invoke(clearText)
    }

    val hasContent = textFieldValue.text.isNotBlank() || photoUris.isNotEmpty()
    val isActive = isFocused || hasContent

    val scrimColor by animateColorAsState(
        targetValue = if (isFocused) Color.Black.copy(alpha = 0.25f) else Color.Transparent,
        label = "scrimFade"
    )

    val bottomOffset by animateDpAsState(
        targetValue = if (isAnchored || isFocused || hasContent) 0.dp else 400.dp,
        animationSpec = tween(durationMillis = 300),
        label = "inputSlide"
    )

    val inputShape =
        if (isActive) SmoothShapes.rounded(Radius.LG) else SmoothShapes.rounded(Radius.Rounded)

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(scrimColor)
            .then(
                if (isFocused || hasContent) {
                    Modifier.clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() }
                    ) {
                        focusManager.clearFocus(force = true)
                        keyboardController?.hide()
                        if (hasContent) {
                            textFieldValue = TextFieldValue("")
                            onTextChange?.invoke("")
                        }
                    }
                } else {
                    Modifier
                }
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .offset(y = bottomOffset),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (showScrollButton && isFocused) {
                ScrollToBottomButton(
                    onClick = onScrollToBottom,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        color = contentColors.surfaceSecondary,
                        shape = RoundedCornerShape(topStart = Radius.LG, topEnd = Radius.LG)
                    )
                    .padding(start = 12.dp, end = 12.dp, top = 16.dp, bottom = 12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    // Camera button (hidden when image attached or text typed)
                    if (photoUris.isEmpty() && textFieldValue.text.isBlank()) {
                        CompositionLocalProvider(LocalContentColors provides org.digitalgreen.farmerchat.sdk.compose.theme.hostLightContentColors()) {
                            val buttonColors = LocalContentColors.current
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(CircleShape)
                                    .background(buttonColors.buttonPrimarySurface)
                                    .clickable {
                                        focusManager.clearFocus(force = true)
                                        keyboardController?.hide()
                                        onPhotoClick()
                                    },
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    painter = painterResource(id = R.drawable.fc_icon_camera),
                                    contentDescription = "Camera",
                                    tint = buttonColors.buttonPrimaryAccent,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                        }
                    }

                    // Text field
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .clip(inputShape)
                            .background(contentColors.surfacePrimary)
                            .clickable(
                                indication = null,
                                interactionSource = remember { MutableInteractionSource() }
                            ) { requestInputFocus() }
                            .padding(horizontal = 14.dp, vertical = 12.dp)
                    ) {
                        if (photoUris.isNotEmpty()) {
                            LazyRow(
                                horizontalArrangement = Arrangement.spacedBy(5.dp),
                                modifier = Modifier.padding(bottom = 10.dp)
                            ) {
                                itemsIndexed(photoUris) { index, uri ->
                                    PhotoThumbnail(
                                        imageUri = uri,
                                        onRemove = { onRemovePhoto(index) },
                                        size = 64
                                    )
                                }
                            }
                        }

                        BasicTextField(
                            value = textFieldValue,
                            onValueChange = {
                                textFieldValue = it
                                onTextChange?.invoke(it.text)
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 24.dp, max = 72.dp)
                                .focusRequester(focusRequester)
                                .onFocusChanged { focusState ->
                                    isFocused = focusState.isFocused
                                    onFocusChange?.invoke(isFocused)
                                },
                            cursorBrush = SolidColor(contentColors.foregroundPrimary),
                            textStyle = MaterialTheme.typography.bodyLarge.copy(
                                color = contentColors.foregroundPrimary,
                                textAlign = TextAlign.Start
                            ),
                            maxLines = 3,
                            keyboardOptions = KeyboardOptions.Default.copy(
                                capitalization = KeyboardCapitalization.Sentences,
                                imeAction = ImeAction.Done,
                            ),
                            keyboardActions = KeyboardActions(
                                onDone = {
                                    focusManager.clearFocus()
                                    keyboardController?.hide()
                                }
                            ),
                            decorationBox = { innerTextField ->
                                Box(
                                    modifier = Modifier.fillMaxWidth(),
                                    contentAlignment = Alignment.CenterStart
                                ) {
                                    if (textFieldValue.text.isEmpty()) {
                                        Text(
                                            text = placeholder,
                                            style = MaterialTheme.typography.bodyLarge.copy(
                                                color = contentColors.formPlaceholder,
                                                textAlign = TextAlign.Start
                                            ),
                                        )
                                    }
                                    innerTextField()
                                }
                            }
                        )
                    }

                    // Mic or Send button — always light-mode colors
                    CompositionLocalProvider(LocalContentColors provides org.digitalgreen.farmerchat.sdk.compose.theme.hostLightContentColors()) {
                        val buttonColors = LocalContentColors.current
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .background(buttonColors.buttonPrimarySurface)
                                .clickable {
                                    if (hasContent) {
                                        val imageUri = photoUris.firstOrNull()
                                        isFocused = false
                                        focusManager.clearFocus(force = true)
                                        keyboardController?.hide()
                                        onSend(textFieldValue.text, imageUri)
                                    } else {
                                        focusManager.clearFocus(force = true)
                                        keyboardController?.hide()
                                        onVoiceClick()
                                    }
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            if (hasContent) {
                                Icon(
                                    painter = painterResource(id = R.drawable.fc_icon_send),
                                    contentDescription = label(Labels.SEND, "Send"),
                                    tint = buttonColors.buttonPrimaryAccent,
                                    modifier = Modifier.size(22.dp)
                                )
                            } else {
                                Icon(
                                    painter = painterResource(id = R.drawable.fc_icon_mic),
                                    contentDescription = label(Labels.VOICE, "Voice"),
                                    tint = buttonColors.buttonPrimaryAccent,
                                    modifier = Modifier.size(22.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// VoiceInput (recording bottom sheet)
// ---------------------------------------------------------------------------

private enum class VoiceInputState { Listening, Processing }

/**
 * Voice recording sheet. Self-contained recorder: the parent supplies open via
 * [onOpenRequest], receives the recorded OGG/OPUS file through [onAudioRecorded],
 * and drives transcription itself (Home → HomeAction.TranscribeAudio,
 * Chat → ChatAction.SendFollowUpVoiceQuestion).
 */
@Composable
fun VoiceInput(
    modifier: Modifier = Modifier,
    onCancel: () -> Unit = {},
    onAudioRecorded: (File) -> Unit,
    onOpenRequest: ((() -> Unit) -> Unit)? = null,
    onActiveChange: ((Boolean) -> Unit)? = null,
    onRecordingFailed: (message: String) -> Unit = {},
) {
    val context = LocalContext.current
    val contentColors = LocalContentColors.current
    var isOpen by remember { mutableStateOf(false) }
    var state by remember { mutableStateOf(VoiceInputState.Listening) }
    val audioRecorder = remember { AudioRecorder(context) }
    var hasRecordingStarted by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        onOpenRequest?.invoke {
            isOpen = true
            state = VoiceInputState.Listening
            hasRecordingStarted = false
        }
    }

    LaunchedEffect(isOpen) {
        if (isOpen && !hasRecordingStarted) {
            val started = audioRecorder.startRecording()
            if (started) {
                hasRecordingStarted = true
            } else {
                onRecordingFailed(label(Labels.FAILED_TO_START_RECORDING, "Failed to start recording"))
                isOpen = false
            }
        }
        onActiveChange?.invoke(isOpen)
    }

    DisposableEffect(Unit) {
        onDispose {
            audioRecorder.cancelRecording()
            audioRecorder.release()
        }
    }

    val scrimColor by animateColorAsState(
        targetValue = if (isOpen) Color.Black.copy(alpha = 0.25f) else Color.Transparent,
        animationSpec = tween(durationMillis = 300),
        label = "voiceScrimFade"
    )

    val bottomOffset by animateDpAsState(
        targetValue = if (isOpen) 0.dp else 400.dp,
        animationSpec = tween(durationMillis = 300),
        label = "voiceSheetSlide"
    )

    fun handleCancel() {
        audioRecorder.cancelRecording()
        isOpen = false
        state = VoiceInputState.Listening
        hasRecordingStarted = false
        onCancel()
    }

    fun handleSave() {
        state = VoiceInputState.Processing
        val audioFile = audioRecorder.stopRecording()
        if (audioFile != null) {
            onAudioRecorded(audioFile)
        } else {
            onRecordingFailed(
                label(
                    Labels.NO_AUDIO_RECORDED_OR_CONVERSATION_NOT_STARTED,
                    "No audio recorded or conversation not started"
                )
            )
        }
        isOpen = false
        state = VoiceInputState.Listening
        hasRecordingStarted = false
    }

    Box(
        modifier = if (isOpen || scrimColor != Color.Transparent) modifier.fillMaxSize()
        else modifier.wrapContentSize()
    ) {
        if (isOpen || scrimColor != Color.Transparent) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(scrimColor)
                    .clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() }
                    ) { handleCancel() }
            ) {
                val navBarPadding = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .align(Alignment.BottomCenter)
                        .offset(y = bottomOffset)
                        .clip(RoundedCornerShape(topStart = Radius.LG, topEnd = Radius.LG))
                        .background(contentColors.surfaceSecondary)
                        .clickable(
                            indication = null,
                            interactionSource = remember { MutableInteractionSource() }
                        ) { /* consume clicks */ }
                        .padding(start = 8.dp, end = 8.dp, top = 16.dp, bottom = 8.dp + navBarPadding),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(320.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = if (state == VoiceInputState.Listening)
                                    label(Labels.LISTENING, "Speak now")
                                else
                                    label(Labels.PROCESSING, "Processing..."),
                                style = MaterialTheme.typography.titleLarge,
                                color = contentColors.foregroundPrimary,
                                textAlign = TextAlign.Center
                            )
                            Text(
                                text = if (state == VoiceInputState.Listening)
                                    label(Labels.ASK_YOUR_FARMING_QUESTION, "Ask about your farm or livestock")
                                else
                                    label(Labels.ONE_SECOND_PLEASE, "One second, please..."),
                                style = MaterialTheme.typography.bodyLarge,
                                color = contentColors.foregroundPrimary,
                                textAlign = TextAlign.Center
                            )
                        }

                        Box(modifier = Modifier.height(32.dp))

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            InputActionButton(
                                onClick = { handleCancel() },
                                imageVector = Icons.Filled.Delete,
                                contentDescription = "Delete",
                                iconSize = 28.dp
                            )

                            VoiceClip(
                                state = when (state) {
                                    VoiceInputState.Listening -> VoiceClipState.Recording
                                    VoiceInputState.Processing -> VoiceClipState.Processing
                                },
                                modifier = Modifier.weight(1f),
                                barCount = 36,
                                onRecordingComplete = { handleSave() }
                            )

                            InputActionButton(
                                onClick = { handleSave() },
                                modifier = Modifier.padding(start = 2.dp),
                                iconRes = R.drawable.fc_icon_send,
                                contentDescription = "Send",
                                isLoading = state == VoiceInputState.Processing,
                                enabled = state == VoiceInputState.Listening && hasRecordingStarted,
                                iconSize = 22.dp
                            )
                        }

                        Box(modifier = Modifier.height(32.dp))

                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Info,
                                contentDescription = null,
                                modifier = Modifier.size(23.dp),
                                tint = contentColors.borderActive
                            )

                            Text(
                                text = label(Labels.VOICE_INPUT_IS_STILL_IMPROVING, "Keep background noise low"),
                                style = MaterialTheme.typography.bodySmall,
                                color = contentColors.foregroundSecondary,
                                textAlign = TextAlign.Center,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// PhotoInput (camera / gallery bottom sheet)
// ---------------------------------------------------------------------------

@Composable
fun PhotoInput(
    modifier: Modifier = Modifier,
    onCameraClick: () -> Unit = {},
    onGalleryClick: () -> Unit = {},
    onOpenRequest: ((() -> Unit) -> Unit)? = null,
    onCloseRequest: ((() -> Unit) -> Unit)? = null
) {
    val contentColors = LocalContentColors.current
    var isOpen by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        onOpenRequest?.invoke { isOpen = true }
    }

    LaunchedEffect(Unit) {
        onCloseRequest?.invoke { isOpen = false }
    }

    val scrimColor by animateColorAsState(
        targetValue = if (isOpen) Color.Black.copy(alpha = 0.25f) else Color.Transparent,
        animationSpec = tween(durationMillis = 300),
        label = "photoScrimFade"
    )

    val bottomOffset by animateDpAsState(
        targetValue = if (isOpen) 0.dp else 300.dp,
        animationSpec = tween(durationMillis = 300),
        label = "photoSheetSlide"
    )

    if (isOpen || scrimColor != Color.Transparent) {
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(scrimColor)
                .clickable(
                    indication = null,
                    interactionSource = remember { MutableInteractionSource() }
                ) { isOpen = false }
        ) {
            val navBarPadding = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .offset(y = bottomOffset)
                    .clip(RoundedCornerShape(topStart = Radius.LG, topEnd = Radius.LG))
                    .background(contentColors.surfaceSecondary)
                    .clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() }
                    ) { /* consume clicks */ }
                    .padding(start = 12.dp, end = 12.dp, top = 24.dp, bottom = 8.dp + navBarPadding)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(168.dp)
                        .padding(horizontal = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(168.dp)
                            .clip(SmoothShapes.rounded(Radius.LG))
                            .background(contentColors.surfaceTertiary)
                            .clickable { onCameraClick() },
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                painter = painterResource(id = R.drawable.fc_icon_camera),
                                contentDescription = label(Labels.CAMERA, "Camera"),
                                tint = contentColors.foregroundPrimary,
                                modifier = Modifier.size(32.dp)
                            )
                            Text(
                                text = label(Labels.CAMERA, "Camera"),
                                color = contentColors.foregroundSecondary,
                                style = MaterialTheme.typography.labelMedium
                            )
                        }
                    }

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(168.dp)
                            .clip(SmoothShapes.rounded(Radius.LG))
                            .background(contentColors.surfaceTertiary)
                            .clickable { onGalleryClick() },
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Filled.PhotoLibrary,
                                contentDescription = label(Labels.PHOTOS, "Photos"),
                                tint = contentColors.foregroundPrimary,
                                modifier = Modifier.size(32.dp)
                            )
                            Text(
                                text = label(Labels.PHOTOS, "Photos"),
                                color = contentColors.foregroundSecondary,
                                style = MaterialTheme.typography.labelMedium
                            )
                        }
                    }
                }
            }
        }
    }
}
