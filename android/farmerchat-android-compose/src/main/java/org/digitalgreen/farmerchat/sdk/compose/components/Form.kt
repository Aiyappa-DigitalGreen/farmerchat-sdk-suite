package org.digitalgreen.farmerchat.sdk.compose.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.ImageLoader
import coil.compose.SubcomposeAsyncImage
import coil.decode.SvgDecoder
import coil.request.ImageRequest
import kotlinx.coroutines.delay
import org.digitalgreen.farmerchat.sdk.compose.theme.Containers
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.core.labels.Labels

// ---------------------------------------------------------------------------
// SvgImage (Coil + SVG decoder)
// ---------------------------------------------------------------------------

@Composable
fun SvgImage(
    url: String,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val imageLoader = remember(context) {
        ImageLoader.Builder(context)
            .components { add(SvgDecoder.Factory()) }
            .build()
    }

    SubcomposeAsyncImage(
        model = ImageRequest.Builder(context)
            .data(url)
            .crossfade(true)
            .build(),
        imageLoader = imageLoader,
        contentDescription = null,
        modifier = modifier
    )
}

// ---------------------------------------------------------------------------
// TextInput (form)
// ---------------------------------------------------------------------------

enum class TextInputState { Default, Active, Disabled, Error }

@Composable
fun TextInput(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    textFieldModifier: Modifier = Modifier,
    placeholder: String = "",
    label: String? = null,
    hint: String? = null,
    showLabel: Boolean = true,
    showHint: Boolean = true,
    state: TextInputState = TextInputState.Default,
    autofocus: Boolean = false,
    placeCursorAtEnd: Boolean = false,
    focusOnActiveState: Boolean = true,
    keyboardOptions: KeyboardOptions = KeyboardOptions(
        keyboardType = KeyboardType.Text,
        imeAction = ImeAction.Done
    ),
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    inputFilter: (String) -> String = { it },
    containerColor: Color? = null
) {
    val colors = LocalContentColors.current
    val brand = LocalBrandColors.current
    val type = MaterialTheme.typography

    val enabled = state != TextInputState.Disabled
    val isError = state == TextInputState.Error

    val wantsFocus = autofocus || (focusOnActiveState && state == TextInputState.Active)
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(wantsFocus) {
        if (wantsFocus) focusRequester.requestFocus()
    }

    val bg = containerColor ?: colors.surfaceSecondary
    val errorColor = brand.feedbackFail
    val focusedBorder = if (isError) errorColor else colors.borderActive
    val unfocusedBorder = if (isError) errorColor else colors.borderDefault
    val placeholderColor = colors.foregroundSecondary

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedContainerColor = bg,
        unfocusedContainerColor = bg,
        disabledContainerColor = colors.surfaceSecondary,
        errorContainerColor = bg,
        focusedBorderColor = focusedBorder,
        unfocusedBorderColor = unfocusedBorder,
        disabledBorderColor = colors.borderDefault,
        errorBorderColor = errorColor,
        cursorColor = if (isError) errorColor else colors.borderActive,
        errorCursorColor = errorColor,
        focusedTextColor = colors.foregroundPrimary,
        unfocusedTextColor = colors.foregroundPrimary,
        disabledTextColor = colors.foregroundSecondary,
        errorTextColor = colors.foregroundPrimary,
        focusedPlaceholderColor = placeholderColor,
        unfocusedPlaceholderColor = placeholderColor,
        disabledPlaceholderColor = colors.foregroundSecondary,
        errorPlaceholderColor = placeholderColor,
    )

    Column(modifier = modifier.fillMaxWidth()) {
        if (showLabel && !label.isNullOrBlank()) {
            Text(text = label, style = type.labelMedium, color = colors.foregroundPrimary)
            Spacer(modifier = Modifier.height(8.dp))
        }

        if (!placeCursorAtEnd) {
            OutlinedTextField(
                value = value,
                onValueChange = { if (enabled) onValueChange(inputFilter(it)) },
                modifier = textFieldModifier
                    .fillMaxWidth()
                    .focusRequester(focusRequester),
                enabled = enabled,
                singleLine = true,
                isError = isError,
                placeholder = {
                    if (placeholder.isNotBlank()) {
                        Text(text = placeholder, style = type.bodyLarge, color = placeholderColor)
                    }
                },
                textStyle = type.bodyLarge.copy(color = colors.foregroundPrimary),
                shape = SmoothShapes.rounded(Radius.MD),
                colors = fieldColors,
                keyboardOptions = keyboardOptions,
                keyboardActions = keyboardActions
            )
        } else {
            var fieldValue by remember {
                mutableStateOf(TextFieldValue(text = value, selection = TextRange(value.length)))
            }

            LaunchedEffect(value) {
                val filtered = inputFilter(value)
                if (filtered != value) onValueChange(filtered)
                if (filtered != fieldValue.text) {
                    fieldValue = TextFieldValue(text = filtered, selection = TextRange(filtered.length))
                }
            }

            OutlinedTextField(
                value = fieldValue,
                onValueChange = { new ->
                    if (!enabled) return@OutlinedTextField
                    val filtered = inputFilter(new.text)
                    fieldValue = TextFieldValue(text = filtered, selection = TextRange(filtered.length))
                    onValueChange(filtered)
                },
                modifier = textFieldModifier
                    .fillMaxWidth()
                    .focusRequester(focusRequester),
                enabled = enabled,
                singleLine = true,
                isError = isError,
                placeholder = {
                    if (placeholder.isNotBlank()) {
                        Text(text = placeholder, style = type.bodyLarge, color = placeholderColor)
                    }
                },
                textStyle = type.bodyLarge.copy(color = colors.foregroundPrimary),
                shape = SmoothShapes.rounded(Radius.MD),
                colors = fieldColors,
                keyboardOptions = keyboardOptions,
                keyboardActions = keyboardActions
            )
        }

        if (showHint && !hint.isNullOrBlank()) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = hint,
                style = type.labelSmall,
                color = if (isError) errorColor else colors.foregroundSecondary
            )
        }
    }
}

// ---------------------------------------------------------------------------
// RadioButton
// ---------------------------------------------------------------------------

@Composable
fun RadioButton(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    backgroundColor: Color = LocalContentColors.current.surfaceSecondary,
    indicatorColor: Color = LocalContentColors.current.surfaceTertiary,
    countryCode: String? = null,
    flagUrl: String? = null,
    maxLines: Int = 1,
    isLoading: Boolean = false
) {
    val colors = LocalContentColors.current
    val type = MaterialTheme.typography

    val bg = if (selected) colors.surfaceActive else backgroundColor
    val interactionSource = remember { MutableInteractionSource() }

    Surface(
        modifier = modifier
            .then(if (countryCode != null) Modifier.height(48.dp) else Modifier)
            .clickable(
                enabled = enabled,
                interactionSource = interactionSource,
                indication = null
            ) { onClick() },
        color = bg,
        contentColor = colors.foregroundPrimary,
        shape = SmoothShapes.rounded(Radius.MD),
    ) {
        Row(
            modifier = Modifier
                .then(Containers.flat(radius = Radius.MD, background = bg))
                .padding(horizontal = 16.dp, vertical = if (countryCode != null) 12.dp else 14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            val outerShape = SmoothShapes.rounded(Radius.Rounded)

            Box(
                modifier = Modifier
                    .size(20.dp)
                    .background(colors.surfaceSecondary, outerShape),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(if (selected) 10.dp else 20.dp)
                        .background(
                            if (selected) colors.borderActive else indicatorColor,
                            outerShape
                        )
                )
            }

            Spacer(modifier = Modifier.width(if (countryCode != null) 14.dp else 12.dp))

            Text(
                text = label,
                style = type.bodyMedium,
                color = colors.foregroundPrimary,
                maxLines = maxLines,
                overflow = if (maxLines == 1) TextOverflow.Ellipsis else TextOverflow.Clip,
                modifier = Modifier.weight(1f)
            )

            if (isLoading) {
                Spacer(modifier = Modifier.width(14.dp))
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    color = colors.borderActive,
                    strokeWidth = 2.dp
                )
            } else if (!flagUrl.isNullOrBlank() || !countryCode.isNullOrBlank()) {
                Spacer(modifier = Modifier.width(14.dp))
                if (!flagUrl.isNullOrBlank()) {
                    Box(
                        modifier = Modifier
                            .size(width = 30.dp, height = 20.dp)
                            .clip(SmoothShapes.rounded(2.dp))
                    ) {
                        SvgImage(url = flagUrl, modifier = Modifier.size(width = 30.dp, height = 20.dp))
                    }
                } else {
                    Text(
                        text = isoToFlagEmoji(countryCode.orEmpty()),
                        style = type.bodyMedium,
                    )
                }
            }
        }
    }
}

/** ISO ("US") → flag emoji fallback when the API flag URL is missing. */
fun isoToFlagEmoji(iso: String): String {
    val code = iso.trim().uppercase()
    if (code.length != 2) return "🇮🇳"
    val first = code[0] - 'A' + 0x1F1E6
    val second = code[1] - 'A' + 0x1F1E6
    return String(Character.toChars(first)) + String(Character.toChars(second))
}

// ---------------------------------------------------------------------------
// Checkbox
// ---------------------------------------------------------------------------

@Composable
fun Checkbox(
    label: String,
    checked: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    backgroundColor: Color = LocalContentColors.current.surfaceSecondary,
    maxLines: Int = 1
) {
    val colors = LocalContentColors.current
    val type = MaterialTheme.typography

    val bg = if (checked) colors.surfaceActive else backgroundColor
    val border = if (checked) colors.borderActive else colors.borderDefault
    val interactionSource = remember { MutableInteractionSource() }

    Surface(
        modifier = modifier.clickable(
            enabled = enabled,
            interactionSource = interactionSource,
            indication = null
        ) { onClick() },
        color = bg,
        contentColor = colors.foregroundPrimary,
        shape = SmoothShapes.rounded(Radius.MD),
        border = BorderStroke(0.25.dp, border),
    ) {
        Box(
            modifier = Modifier
                .then(Containers.flat(radius = Radius.MD, background = bg))
                .padding(horizontal = 15.dp, vertical = 12.dp),
            contentAlignment = Alignment.CenterStart
        ) {
            Text(
                text = label,
                style = type.bodySmall,
                color = colors.foregroundPrimary,
                maxLines = maxLines,
                overflow = if (maxLines == 1) TextOverflow.Ellipsis else TextOverflow.Clip
            )
        }
    }
}

// ---------------------------------------------------------------------------
// OtpInput (4 boxes)
// ---------------------------------------------------------------------------

@Composable
fun OtpInput(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    isError: Boolean = false,
    enabled: Boolean = true,
    length: Int = 4,
    autoFocus: Boolean = true,
    keyboardActions: KeyboardActions = KeyboardActions.Default
) {
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(enabled) {
        if (enabled && autoFocus) {
            delay(80)
            focusRequester.requestFocus()
        }
    }

    BasicTextField(
        value = value,
        onValueChange = { newValue ->
            val filtered = newValue.filter { it.isDigit() }.take(length)
            onValueChange(filtered)
        },
        modifier = Modifier.focusRequester(focusRequester),
        enabled = enabled,
        singleLine = true,
        keyboardOptions = KeyboardOptions(
            keyboardType = KeyboardType.Number,
            imeAction = ImeAction.Done
        ),
        keyboardActions = keyboardActions,
        decorationBox = {
            Row(
                modifier = modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                repeat(length) { index ->
                    val digit = value.getOrNull(index)?.toString() ?: ""
                    val isActiveBox = index == value.length && !isError && enabled
                    OtpDigitBox(
                        digit = digit,
                        isActive = isActiveBox,
                        isError = isError,
                        enabled = enabled,
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    )
}

@Composable
private fun OtpDigitBox(
    digit: String,
    isActive: Boolean,
    isError: Boolean,
    enabled: Boolean,
    modifier: Modifier = Modifier
) {
    val colors = LocalContentColors.current
    val brand = LocalBrandColors.current

    val borderColor = when {
        isError -> brand.feedbackFail
        isActive -> colors.borderActive
        else -> colors.borderDefault
    }
    val borderWidth = if (isActive || isError) 2.dp else 0.5.dp

    Box(
        modifier = modifier
            .height(64.dp)
            .background(
                color = colors.surfaceSecondary,
                shape = SmoothShapes.rounded(Radius.MD)
            )
            .border(
                width = borderWidth,
                color = borderColor,
                shape = SmoothShapes.rounded(Radius.MD)
            ),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = digit,
            style = MaterialTheme.typography.headlineMedium,
            color = if (enabled) colors.foregroundPrimary else colors.foregroundSecondary,
            textAlign = TextAlign.Center
        )
    }
}

// ---------------------------------------------------------------------------
// SearchInput
// ---------------------------------------------------------------------------

@Composable
fun SearchInput(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = label(Labels.SEARCH, "Search"),
    autofocus: Boolean = false,
    containerColor: Color? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default.copy(imeAction = ImeAction.Search),
    keyboardActions: KeyboardActions = KeyboardActions.Default,
) {
    val colors = LocalContentColors.current
    val type = MaterialTheme.typography

    val focusRequester = remember { FocusRequester() }
    LaunchedEffect(autofocus) {
        if (autofocus) focusRequester.requestFocus()
    }

    val bg = containerColor ?: colors.surfaceSecondary
    val isActive = value.isNotEmpty()
    val borderColor = if (isActive) colors.borderActive else colors.borderDefault

    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier
            .fillMaxWidth()
            .focusRequester(focusRequester),
        singleLine = true,
        leadingIcon = {
            Icon(
                imageVector = Icons.Default.Search,
                contentDescription = "Search",
                modifier = Modifier.size(23.dp),
                tint = colors.foregroundSecondary
            )
        },
        placeholder = {
            if (placeholder.isNotBlank()) {
                Text(text = placeholder, style = type.bodyMedium, color = colors.formPlaceholder)
            }
        },
        textStyle = type.bodyMedium.copy(color = colors.foregroundPrimary),
        shape = SmoothShapes.rounded(Radius.MD),
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = bg,
            unfocusedContainerColor = bg,
            focusedBorderColor = borderColor,
            unfocusedBorderColor = colors.borderDefault,
            cursorColor = colors.borderActive,
            focusedTextColor = colors.foregroundPrimary,
            unfocusedTextColor = colors.foregroundPrimary,
            focusedPlaceholderColor = colors.formPlaceholder,
            unfocusedPlaceholderColor = colors.formPlaceholder,
        ),
        keyboardOptions = keyboardOptions,
        keyboardActions = keyboardActions
    )
}

// ---------------------------------------------------------------------------
// CountryCodeSelector
// ---------------------------------------------------------------------------

@Composable
fun CountryCodeSelector(
    countryCode: String,
    flagUrl: String? = null,
    modifier: Modifier = Modifier
) {
    val colors = LocalContentColors.current

    Row(
        modifier = modifier
            .height(56.dp)
            .widthIn(min = 90.dp)
            .background(
                color = colors.surfaceSecondary,
                shape = SmoothShapes.rounded(Radius.MD)
            )
            .border(
                width = 0.5.dp,
                color = colors.borderDefault,
                shape = SmoothShapes.rounded(Radius.MD)
            )
            .padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        if (!flagUrl.isNullOrBlank()) {
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .clip(SmoothShapes.rounded(Radius.SM))
            ) {
                SvgImage(url = flagUrl, modifier = Modifier.size(20.dp))
            }
        } else {
            Text(
                text = "🇮🇳",
                style = MaterialTheme.typography.bodyMedium
            )
        }

        Text(
            text = countryCode,
            style = MaterialTheme.typography.bodyMedium,
            color = colors.foregroundPrimary,
            maxLines = 1
        )
    }
}
