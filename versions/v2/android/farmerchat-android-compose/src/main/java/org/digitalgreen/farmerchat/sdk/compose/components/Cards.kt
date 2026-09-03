package org.digitalgreen.farmerchat.sdk.compose.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImagePainter
import coil.compose.SubcomposeAsyncImage
import coil.request.ImageRequest
import org.digitalgreen.farmerchat.sdk.compose.R
import org.digitalgreen.farmerchat.sdk.compose.theme.Containers
import org.digitalgreen.farmerchat.sdk.compose.theme.Green500
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.theme.White
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import kotlinx.coroutines.delay
import java.net.URL
import java.net.URLEncoder

private fun encodeImageUrl(url: String): String {
    return try {
        val parsedUrl = URL(url)
        val protocol = parsedUrl.protocol
        val host = parsedUrl.host
        val port = if (parsedUrl.port != -1) ":${parsedUrl.port}" else ""
        val path = parsedUrl.path

        val encodedPath = path.split("/").joinToString("/") { segment ->
            if (segment.isEmpty()) segment
            else URLEncoder.encode(segment, "UTF-8").replace("+", "%20")
        }

        val query = parsedUrl.query?.let { "?${URLEncoder.encode(it, "UTF-8")}" } ?: ""
        "$protocol://$host$port$encodedPath$query"
    } catch (_: Exception) {
        url
    }
}

// ---------------------------------------------------------------------------
// ContentCard (image/statement feed card)
// ---------------------------------------------------------------------------

@Composable
fun ContentCard(
    headline: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    imageUrl: String? = null,
    isImageLoading: Boolean = false,
    viewCount: String? = null,
    personalizationLabel: String? = null,
    isButtonLoading: Boolean = false,
) {
    val context = LocalContext.current
    val contentColors = LocalContentColors.current

    val type = MaterialTheme.typography
    val cardRadius = org.digitalgreen.farmerchat.sdk.compose.theme.LocalFcShapes.current.card
    val cardShape = SmoothShapes.rounded(cardRadius)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .pressScale(onClick = onClick)
            .then(
                Containers.elevated(
                    radius = cardRadius,
                    background = contentColors.surfaceSecondary
                )
            )
            .clip(cardShape)
    ) {
        if (!imageUrl.isNullOrBlank()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 8.dp, end = 8.dp, top = 8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(16f / 9f)
                        .clip(SmoothShapes.rounded(Radius.LG))
                        .background(contentColors.surfacePrimary)
                ) {
                    val encodedUrl = remember(imageUrl) { encodeImageUrl(imageUrl) }
                    val imageRequest = remember(imageUrl, encodedUrl) {
                        ImageRequest.Builder(context)
                            .data(encodedUrl)
                            .memoryCacheKey(imageUrl)
                            .diskCacheKey(imageUrl)
                            .crossfade(durationMillis = 120)
                            .build()
                    }

                    SubcomposeAsyncImage(
                        model = imageRequest,
                        contentDescription = null,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(220.dp)
                            .clip(SmoothShapes.rounded(Radius.LG)),
                    ) {
                        when (painter.state) {
                            // App parity (components/cards/ContentCard.kt): the loading and
                            // error placeholders are DIFFERENT animations, not one shared
                            // gradient. Loading = fog + orbiting bubbles; error = the
                            // magic-eraser dissolve.
                            is AsyncImagePainter.State.Loading -> {
                                AIGeneratingImageOverlay(isLoading = true)
                            }

                            is AsyncImagePainter.State.Success -> {
                                Image(
                                    painter = painter,
                                    contentDescription = null,
                                    modifier = Modifier.fillMaxSize(),
                                    contentScale = ContentScale.Crop
                                )
                            }

                            is AsyncImagePainter.State.Error -> {
                                AIGeneratedGradient(Modifier.fillMaxSize())
                            }

                            else -> {
                                Box(Modifier.background(Color.LightGray))
                            }
                        }
                    }

                    if (viewCount != null && !isImageLoading) {
                        ViewCountBadge(
                            count = viewCount,
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .padding(12.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
        } else {
            if (!personalizationLabel.isNullOrBlank()) {
                PersonalizationTag(
                    label = personalizationLabel,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(10.dp))
            } else {
                Spacer(modifier = Modifier.height(18.dp))
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 24.dp, end = 24.dp, bottom = 20.dp, top = 4.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = headline,
                style = type.bodyLarge,
                color = contentColors.foregroundPrimary,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis
            )

            PrimaryButton(
                label = label(Labels.START_CHAT, "Start chat"),
                state = if (isButtonLoading) PrimaryButtonState.Loading else PrimaryButtonState.Chevron,
                modifier = Modifier.fillMaxWidth(),
                radius = Radius.MD,
                onClick = onClick,
                height = 42,
            )
        }
    }
}

/** Green gradient placeholder used while the AI-generated image loads / fails. */
@Composable
private fun ViewCountBadge(
    count: String?,
    modifier: Modifier = Modifier
) {
    val contentColors = LocalContentColors.current
    val brandColors = LocalBrandColors.current
    val type = MaterialTheme.typography
    val shape = SmoothShapes.rounded(Radius.SM)

    Row(
        modifier = modifier
            .height(28.dp)
            .clip(shape)
            .background(contentColors.scrim)
            .padding(start = 8.dp, end = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Filled.Visibility,
            contentDescription = null,
            tint = brandColors.foregroundSecondary,
            modifier = Modifier.size(20.dp)
        )

        Spacer(modifier = Modifier.width(5.dp))

        Text(
            text = count.toString(),
            style = type.labelSmall,
            color = brandColors.foregroundPrimary
        )
    }
}

@Composable
private fun PersonalizationTag(
    label: String,
    modifier: Modifier = Modifier
) {
    val contentColors = LocalContentColors.current
    val type = MaterialTheme.typography

    Row(
        modifier = modifier
            .graphicsLayer { clip = false }
            .padding(top = 18.dp, start = 18.dp, end = 24.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .graphicsLayer { clip = false },
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier
                    .wrapContentSize(unbounded = true)
                    .size(60.dp)
                    .background(
                        brush = Brush.radialGradient(
                            colors = listOf(
                                contentColors.borderActive.copy(alpha = 0.0f),
                                contentColors.borderActive.copy(alpha = 0.28f),
                                Color.Transparent
                            ),
                            radius = 60f
                        )
                    )
            )
            Icon(
                painter = painterResource(id = R.drawable.fc_icon_personalization),
                contentDescription = null,
                tint = Color.Unspecified,
                modifier = Modifier.size(22.dp)
            )
        }

        Spacer(modifier = Modifier.width(6.dp))

        Text(
            text = label,
            style = type.labelMedium,
            color = contentColors.foregroundPrimary
        )
    }
}

// ---------------------------------------------------------------------------
// SingleSelectCard (gender question)
// ---------------------------------------------------------------------------

private enum class SingleSelectCardUiState { Selecting, Saving, Feedback, Dismissed }

@Composable
fun SingleSelectCard(
    question: String,
    options: List<String>,
    successMessage: String = label(
        Labels.THANK_YOU_YOUR_ANSWER_HELPS_US_GIVE_MORE_ACCURATE_ADVICE,
        "Thank you. Your answer helps us give more accurate advice."
    ),
    confirmLabel: String = label(Labels.CONFIRM, "Confirm"),
    savingLabel: String = label(Labels.SAVING, "Saving"),
    modifier: Modifier = Modifier,
    onConfirmed: (selectedIndex: Int) -> Boolean = { true },
    onDismissed: () -> Unit = {}
) {
    val contentColors = LocalContentColors.current
    val type = MaterialTheme.typography
    val cardShape = SmoothShapes.rounded(Radius.XXL)

    var uiState by remember { mutableStateOf(SingleSelectCardUiState.Selecting) }
    var selectedIndex by remember { mutableIntStateOf(-1) }

    val hasSelection = selectedIndex >= 0
    val radiosEnabled = uiState == SingleSelectCardUiState.Selecting
    val isSaving = uiState == SingleSelectCardUiState.Saving

    var showCheckmark by remember { mutableStateOf(false) }
    var showText by remember { mutableStateOf(false) }

    val checkmarkScale by animateFloatAsState(
        targetValue = if (showCheckmark) 1f else 0.3f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "checkmark_scale"
    )

    LaunchedEffect(uiState) {
        if (uiState == SingleSelectCardUiState.Saving) {
            delay(1000)
            uiState = SingleSelectCardUiState.Feedback
            onDismissed()
        }
    }

    LaunchedEffect(uiState) {
        if (uiState == SingleSelectCardUiState.Feedback) {
            delay(3000)
            uiState = SingleSelectCardUiState.Dismissed
        }
    }

    LaunchedEffect(uiState) {
        if (uiState == SingleSelectCardUiState.Feedback) {
            showCheckmark = true
            delay(150)
            showText = true
        } else {
            showCheckmark = false
            showText = false
        }
    }

    AnimatedVisibility(
        visible = uiState != SingleSelectCardUiState.Dismissed,
        exit = fadeOut(animationSpec = tween(durationMillis = 400))
    ) {
        Column(
            modifier = modifier
                .fillMaxWidth()
                .then(
                    Containers.elevated(radius = Radius.XXL, background = contentColors.surfaceSecondary)
                )
                .clip(cardShape)
                .animateContentSize(animationSpec = tween(durationMillis = 250))
        ) {
            AnimatedContent(
                targetState = uiState,
                transitionSpec = {
                    fadeIn(animationSpec = tween(durationMillis = 250)) togetherWith
                        fadeOut(animationSpec = tween(durationMillis = 150)) using
                        SizeTransform { _, _ -> tween(durationMillis = 250) }
                },
                label = "card_state"
            ) { state ->
                when (state) {
                    SingleSelectCardUiState.Feedback,
                    SingleSelectCardUiState.Dismissed -> {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 40.dp, vertical = 24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .graphicsLayer {
                                        scaleX = checkmarkScale
                                        scaleY = checkmarkScale
                                    }
                                    .clip(SmoothShapes.rounded(Radius.Rounded))
                                    .background(contentColors.borderActive),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Check,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(24.dp)
                                )
                            }

                            AnimatedVisibility(
                                visible = showText,
                                enter = fadeIn(animationSpec = tween(durationMillis = 400))
                            ) {
                                Text(
                                    text = successMessage,
                                    style = type.bodyLarge,
                                    color = contentColors.foregroundPrimary,
                                    textAlign = TextAlign.Center,
                                )
                            }
                        }
                    }

                    SingleSelectCardUiState.Selecting,
                    SingleSelectCardUiState.Saving -> {
                        Column(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(start = 24.dp, end = 24.dp, bottom = 20.dp, top = 26.dp),
                                verticalArrangement = Arrangement.spacedBy(18.dp)
                            ) {
                                Text(
                                    text = question,
                                    style = type.bodyLarge,
                                    color = contentColors.foregroundPrimary
                                )

                                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    options.forEachIndexed { index, optionLabel ->
                                        RadioButton(
                                            label = optionLabel,
                                            selected = selectedIndex == index,
                                            enabled = radiosEnabled,
                                            onClick = {
                                                selectedIndex =
                                                    if (selectedIndex == index) -1 else index
                                            },
                                            modifier = Modifier.fillMaxWidth(),
                                            maxLines = 1,
                                            backgroundColor = contentColors.surfacePrimary
                                        )
                                    }
                                }
                            }

                            if (hasSelection) {
                                val buttonState =
                                    if (isSaving) PrimaryButtonState.Loading else PrimaryButtonState.Default
                                val buttonLabel = if (isSaving) savingLabel else confirmLabel

                                Surface(
                                    color = contentColors.buttonPrimarySurface,
                                    contentColor = contentColors.buttonPrimaryForeground,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    PrimaryButton(
                                        label = buttonLabel,
                                        state = buttonState,
                                        onClick = {
                                            if (!isSaving && onConfirmed(selectedIndex)) {
                                                uiState = SingleSelectCardUiState.Saving
                                            }
                                        },
                                        modifier = Modifier.fillMaxWidth(),
                                        radius = Radius.NONE
                                    )
                                }
                            } else {
                                Spacer(modifier = Modifier.height(0.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// MultiSelectCard (crop / livestock question)
// ---------------------------------------------------------------------------

private enum class MultiSelectCardUiState { Selecting, Saving, Feedback, Dismissed }

@Composable
fun MultiSelectCard(
    question: String,
    options: List<String>,
    optionIds: List<String>? = null,
    successMessage: String = label(
        Labels.THANK_YOU_YOUR_ANSWER_HELPS_US_GIVE_MORE_ACCURATE_ADVICE,
        "Thank you. Your answer helps us give more accurate advice."
    ),
    confirmLabel: String = label(Labels.CONFIRM, "Confirm"),
    savingLabel: String = label(Labels.SAVING, "Saving"),
    modifier: Modifier = Modifier,
    onConfirmed: (selectedIndices: Set<Int>) -> Boolean = { true },
    onDismissed: () -> Unit = {}
) {
    val contentColors = LocalContentColors.current
    val type = MaterialTheme.typography
    val cardShape = SmoothShapes.rounded(Radius.XXL)

    var uiState by remember { mutableStateOf(MultiSelectCardUiState.Selecting) }
    var selectedIndices by remember { mutableStateOf(setOf<Int>()) }

    val hasSelection = selectedIndices.isNotEmpty()
    val checkboxesEnabled = uiState == MultiSelectCardUiState.Selecting
    val isSaving = uiState == MultiSelectCardUiState.Saving

    var showCheckmark by remember { mutableStateOf(false) }
    var showText by remember { mutableStateOf(false) }

    val checkmarkScale by animateFloatAsState(
        targetValue = if (showCheckmark) 1f else 0.3f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "checkmark_scale"
    )

    LaunchedEffect(uiState) {
        if (uiState == MultiSelectCardUiState.Saving) {
            delay(1000)
            uiState = MultiSelectCardUiState.Feedback
            onDismissed()
        }
    }

    LaunchedEffect(uiState) {
        if (uiState == MultiSelectCardUiState.Feedback) {
            delay(3000)
            uiState = MultiSelectCardUiState.Dismissed
        }
    }

    LaunchedEffect(uiState) {
        if (uiState == MultiSelectCardUiState.Feedback) {
            showCheckmark = true
            delay(150)
            showText = true
        } else {
            showCheckmark = false
            showText = false
        }
    }

    AnimatedVisibility(
        visible = uiState != MultiSelectCardUiState.Dismissed,
        exit = fadeOut(animationSpec = tween(durationMillis = 400))
    ) {
        Column(
            modifier = modifier
                .fillMaxWidth()
                .then(
                    Containers.elevated(radius = Radius.XXL, background = contentColors.surfaceSecondary)
                )
                .clip(cardShape)
                .animateContentSize(animationSpec = tween(durationMillis = 250))
        ) {
            AnimatedContent(
                targetState = uiState,
                transitionSpec = {
                    fadeIn(animationSpec = tween(durationMillis = 250)) togetherWith
                        fadeOut(animationSpec = tween(durationMillis = 150)) using
                        SizeTransform { _, _ -> tween(durationMillis = 250) }
                },
                label = "card_state"
            ) { state ->
                when (state) {
                    MultiSelectCardUiState.Feedback,
                    MultiSelectCardUiState.Dismissed -> {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 40.dp, vertical = 24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(40.dp)
                                    .graphicsLayer {
                                        scaleX = checkmarkScale
                                        scaleY = checkmarkScale
                                    }
                                    .clip(SmoothShapes.rounded(Radius.Rounded))
                                    .background(contentColors.borderActive),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Rounded.Check,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(24.dp)
                                )
                            }

                            AnimatedVisibility(
                                visible = showText,
                                enter = fadeIn(animationSpec = tween(durationMillis = 400))
                            ) {
                                Text(
                                    text = successMessage,
                                    style = type.bodyLarge,
                                    color = contentColors.foregroundPrimary,
                                    textAlign = TextAlign.Center,
                                )
                            }
                        }
                    }

                    MultiSelectCardUiState.Selecting,
                    MultiSelectCardUiState.Saving -> {
                        Column(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(start = 24.dp, end = 24.dp, bottom = 20.dp, top = 26.dp),
                                verticalArrangement = Arrangement.spacedBy(20.dp)
                            ) {
                                Text(
                                    text = question,
                                    style = type.bodyLarge,
                                    color = contentColors.foregroundPrimary
                                )

                                Column(
                                    verticalArrangement = Arrangement.spacedBy(6.dp),
                                    modifier = Modifier.heightIn(max = 240.dp)
                                ) {
                                    options.forEachIndexed { index, optionLabel ->
                                        val currentOptionId = optionIds?.getOrNull(index)
                                        val isNoneOfTheAboveById = currentOptionId?.let { id ->
                                            id.equals("profile_crop_all_none_of_the_above", ignoreCase = true) ||
                                                id.equals("none", ignoreCase = true) ||
                                                id.contains("none_of_the_above", ignoreCase = true)
                                        } ?: false

                                        val isNoneOfTheAboveByText = optionLabel.trim()
                                            .equals("none of the above", ignoreCase = true)

                                        val isNoneOfTheAbove = isNoneOfTheAboveById || isNoneOfTheAboveByText

                                        Checkbox(
                                            label = optionLabel,
                                            checked = selectedIndices.contains(index),
                                            enabled = checkboxesEnabled,
                                            onClick = {
                                                if (isNoneOfTheAbove) {
                                                    selectedIndices = if (selectedIndices.contains(index)) {
                                                        selectedIndices - index
                                                    } else {
                                                        setOf(index)
                                                    }
                                                } else {
                                                    val noneOfTheAboveIndex = if (optionIds != null) {
                                                        optionIds.indexOfFirst { id ->
                                                            id.equals("none_of_the_above", ignoreCase = true) ||
                                                                id.equals("none", ignoreCase = true) ||
                                                                id.contains("none_of_the_above", ignoreCase = true)
                                                        }
                                                    } else {
                                                        options.indexOfFirst {
                                                            it.trim().equals("none of the above", ignoreCase = true)
                                                        }
                                                    }

                                                    val updatedIndices =
                                                        if (noneOfTheAboveIndex >= 0 && selectedIndices.contains(noneOfTheAboveIndex)) {
                                                            selectedIndices - noneOfTheAboveIndex
                                                        } else {
                                                            selectedIndices
                                                        }

                                                    selectedIndices = if (updatedIndices.contains(index)) {
                                                        updatedIndices - index
                                                    } else {
                                                        updatedIndices + index
                                                    }
                                                }
                                            },
                                            backgroundColor = contentColors.surfacePrimary,
                                            maxLines = 1
                                        )
                                    }
                                }
                            }

                            if (hasSelection) {
                                val buttonState =
                                    if (isSaving) PrimaryButtonState.Loading else PrimaryButtonState.Default
                                val buttonLabel = if (isSaving) savingLabel else confirmLabel

                                Surface(
                                    color = contentColors.buttonPrimarySurface,
                                    contentColor = contentColors.buttonPrimaryForeground,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    PrimaryButton(
                                        label = buttonLabel,
                                        state = buttonState,
                                        onClick = {
                                            if (!isSaving && onConfirmed(selectedIndices)) {
                                                uiState = MultiSelectCardUiState.Saving
                                            }
                                        },
                                        modifier = Modifier.fillMaxWidth(),
                                        radius = Radius.NONE
                                    )
                                }
                            } else {
                                Spacer(modifier = Modifier.height(0.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// SsfrCard (Site Specific Fertilizer Recommendation)
// ---------------------------------------------------------------------------

@Composable
fun SsfrCard(
    onWheatClick: () -> Unit,
    onMaizeClick: () -> Unit,
    modifier: Modifier = Modifier,
    title: String = label(Labels.SSFR_ADVISORY, "SSFR Advisory"),
    description: String = label(
        Labels.SSFR_ADVISORY_DESCRIPTION,
        "Access site specific fertilizer recommendations"
    ),
    wheatLabel: String = label(Labels.SSFR_WHEAT, "Wheat"),
    maizeLabel: String = label(Labels.SSFR_MAIZE, "Maize"),
) {
    val contentColors = LocalContentColors.current
    val type = MaterialTheme.typography
    val cardShape = SmoothShapes.rounded(Radius.XXL)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .then(
                Containers.elevated(radius = Radius.XXL, background = contentColors.surfaceSecondary)
            )
            .clip(cardShape)
            .padding(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            text = title,
            style = type.bodyMedium.copy(fontWeight = FontWeight.Bold),
            color = contentColors.foregroundPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )

        Text(
            text = description,
            style = type.bodySmall,
            color = contentColors.foregroundPrimary,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )

        Spacer(Modifier.height(4.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            SsfrCropButton(
                emoji = "🌾",
                label = wheatLabel,
                onClick = onWheatClick,
                modifier = Modifier.weight(1f)
            )
            SsfrCropButton(
                emoji = "🌽",
                label = maizeLabel,
                onClick = onMaizeClick,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun SsfrCropButton(
    emoji: String,
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = LocalContentColors.current
    val shape = SmoothShapes.rounded(Radius.MD)
    val type = MaterialTheme.typography

    Surface(
        modifier = modifier
            .height(44.dp)
            .clip(shape)
            .pressScale(onClick = onClick),
        shape = shape,
        color = c.buttonPrimarySurface,
        contentColor = c.buttonPrimaryForeground
    ) {
        Row(
            modifier = Modifier.padding(start = 10.dp, end = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(text = emoji, fontSize = 16.sp, textAlign = TextAlign.Center)

            Text(
                text = label,
                style = type.labelMedium.copy(fontWeight = FontWeight.SemiBold),
                color = c.buttonPrimaryForeground,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )

            Icon(
                imageVector = Icons.Filled.ChevronRight,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = c.buttonPrimaryAccent
            )
        }
    }
}

// ---------------------------------------------------------------------------
// SuggestedCard (follow-up question)
// ---------------------------------------------------------------------------

/**
 * Follow-up / related question suggestion. Reads as a clearly-tappable card: a
 * subtle card surface with a brand-accent hairline border, a comfortable ≥48dp
 * touch target, and a trailing accent "send" affordance. Host theming recolors it
 * automatically (border/affordance use the brand accent, surface uses cardSurface).
 */
@Composable
fun SuggestedCard(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = LocalContentColors.current
    val brand = LocalBrandColors.current
    val cardRadius = org.digitalgreen.farmerchat.sdk.compose.theme.LocalFcShapes.current.card
        .coerceAtMost(Radius.LG)
    val cardShape = SmoothShapes.rounded(cardRadius)
    val accent = brand.foregroundSecondary

    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .clip(cardShape)
            .background(colors.surfaceSecondary)
            .border(width = 1.dp, color = accent.copy(alpha = 0.35f), shape = cardShape)
            .pressScale(onClick = onClick)
            .padding(start = 16.dp, end = 10.dp, top = 12.dp, bottom = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.bodyMedium,
            color = colors.foregroundPrimary,
            modifier = Modifier.weight(1f)
        )

        // Trailing accent affordance — reads as "ask this".
        Box(
            modifier = Modifier
                .size(30.dp)
                .clip(CircleShape)
                .background(accent.copy(alpha = 0.16f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = label(Labels.ASK, "Ask"),
                tint = accent,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}
