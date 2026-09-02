package org.digitalgreen.farmerchat.sdk.compose.components

import android.annotation.SuppressLint
import android.net.Uri
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.EaseInOut
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import kotlinx.coroutines.delay
import org.digitalgreen.farmerchat.sdk.compose.R
import org.digitalgreen.farmerchat.sdk.compose.theme.LightContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes

// -----------------------------------------------------------------------------
// Composer geometry — single source of truth for the anchored TextInput.
//
// Goal: behave correctly on BOTH 3-button and gesture navigation, without
// mode-aware branches in calling code. The system reports the right inset for
// each mode via [WindowInsets.navigationBars]:
//   - 3-button: ~48dp (full button bar)
//   - gesture:  ~16-24dp (home indicator / pill zone)
// We consume that inset wholesale, then add a constant visual breathing room
// on top — so the composer's *own* breathing reads consistently across modes.
// -----------------------------------------------------------------------------

/** Padding above the button row, inside the composer sheet. Figma floating: 12. */
private val ComposerTopInside = 12.dp
private val ComposerTopInsideCompact = 10.dp

/** Height of the circular button row (camera/text-field/mic-or-send). */
private val ComposerButtonRow = 48.dp
private val ComposerButtonRowCompact = 42.dp

/** Icon sizes inside the action buttons. Figma uses a uniform 22 for all three. */
private val ComposerActionIcon = 22.dp
private val ComposerActionIconCompact = 20.dp
private val ComposerVoiceIcon = 22.dp
private val ComposerVoiceIconCompact = 20.dp

/** Padding below the button row, inside the composer sheet. Figma floating: 12. */
private val ComposerAtRestGap = 12.dp
private val ComposerAtRestGapCompact = 8.dp

/** Visual breathing room above the IME (keyboard) when focused — matches [ComposerTopInside] for symmetry. */
private val ComposerKeyboardGap = 12.dp
private val ComposerKeyboardGapCompact = 10.dp

/** Floating mode: horizontal inset from screen edges. Figma Home: 10dp. */
private val FloatingHorizontalMargin = 10.dp

/** Floating mode: gap between sheet bottom and the system nav inset. Figma Home: 20dp. */
private val FloatingBottomGap = 20.dp

/** Floating mode: extra surface fade region above the sheet's top edge — gradient transitions to opaque before reaching the bar so content behind the bar is fully hidden. Kept tight so the fade barely peeks above the bar. */
private val FloatingFadeHeight = 0.dp

/** Floating mode: gap between the sheet's bottom edge and the IME (keyboard) when focused. */
private val FloatingKeyboardGap = 4.dp

// Placeholder shimmer sweep period.
private const val ComposerShimmerPeriodMs = 2250

// "Alive" composer aura: a soft multi-colour gradient that flows slowly around the field
// and gently breathes in intensity — ambient and AI-feeling, rather than a hard pulse.
private const val AuraFlowMs = 7000    // one full colour rotation — slow = ambient
private val AuraColors = listOf(
    Color(0xFF00C950), // green (Green500) — brand-forward
    Color(0xFF22D3EE), // cyan accent
    Color(0xFF00C950), // green
    Color(0xFFFFF947), // yellow accent
    Color(0xFF00C950), // green (wrap back for a seamless loop)
)

/** Sample the aura palette at [t] in [0,1) (cyclic). */
private fun auraColorAt(t: Float): Color {
    val seg = t.coerceIn(0f, 1f) * (AuraColors.size - 1)
    val i = seg.toInt().coerceIn(0, AuraColors.size - 2)
    return lerp(AuraColors[i], AuraColors[i + 1], seg - i)
}

/**
 * Height of the anchored composer bar at rest, measured from the bottom of
 * the screen. Used by Home + Chat to reserve content space and to position
 * scroll affordances relative to the composer's top edge.
 *
 * The value adapts automatically to navigation mode because
 * [WindowInsets.navigationBars] does. `compact` shrinks the button row and
 * internal padding for screens (chat) that prefer a tighter composer.
 */
@Composable
fun composerBarHeight(floating: Boolean = false, compact: Boolean = false): Dp {
    val navBar = WindowInsets.navigationBars
        .asPaddingValues()
        .calculateBottomPadding()
    val topInside = if (compact) ComposerTopInsideCompact else ComposerTopInside
    val buttonRow = if (compact) ComposerButtonRowCompact else ComposerButtonRow
    val atRestGap = if (compact) ComposerAtRestGapCompact else ComposerAtRestGap
    // Floating: sit max(nav inset, design gap) above the screen bottom — clears the
    // gesture pill / 3-button bar without stacking an extra gap on top of the inset.
    val restingBottom = if (floating) maxOf(navBar, FloatingBottomGap) else navBar
    return topInside + buttonRow + atRestGap + restingBottom
}

@SuppressLint("UseOfNonLambdaOffsetOverload")
@Composable
fun InputComposer(
    modifier: Modifier = Modifier,
    onSend: (String) -> Unit = {},
    onPhotoClick: () -> Unit = {},
    onVoiceClick: () -> Unit = {},
    onFocusRequest: ((() -> Unit) -> Unit)? = null,
    onSetTextRequest: (((String) -> Unit) -> Unit)? = null,
    onClearRequest: ((() -> Unit) -> Unit)? = null,
    isAnchored: Boolean = false,
    /** When false, the input bar slides off-screen (used to defer reveal until content has loaded). */
    visible: Boolean = true,
    onFocusChange: ((Boolean) -> Unit)? = null,
    /** Attached image URIs. Only the first is used — the composer allows a single image per query. */
    photoUris: List<Uri> = emptyList(),
    onRemovePhoto: (Int) -> Unit = {},
    showScrollButton: Boolean = false,
    onScrollToBottom: () -> Unit = {},
    placeholder: String = "Ask about your farm...",
    /** When non-null and length > 1, the placeholder crossfades through this list every ~3s. */
    placeholders: List<String>? = null,
    /** Launcher mode: when non-null, taps on the text field area fire this instead of focusing the field, and the BasicTextField is not rendered. */
    onTextFieldTap: (() -> Unit)? = null,
    /** Optional override for the composer sheet background. Defaults to surfaceReadingSecondary. */
    surfaceColor: Color? = null,
    /** Optional brush override for the composer sheet background. Takes precedence over [surfaceColor]. */
    surfaceBrush: Brush? = null,
    /** When true, sheet floats with horizontal margins, rounded corners, and a drop shadow above the nav bar. */
    floating: Boolean = false,
    /** Color the floating composer's surrounding fade gradient resolves to at the bottom. Pass the parent screen's surface color so the fade blends in. Defaults to [LocalContentColors.surfacePrimary]. */
    fadeColor: Color? = null,
    /** When true, shrinks button row + internal padding for a tighter chat-style composer. */
    compact: Boolean = false,
    /** When true, the idle "alive" gradient aura flows around the field. Home-only: the aura
     *  is an attention cue for first contact, so the chat screen passes false to keep the
     *  composer calm amid live content. */
    showAura: Boolean = true,
) {
    val contentColors = LocalContentColors.current
    var textFieldValue by remember { mutableStateOf(TextFieldValue("")) }
    var isFocused by remember { mutableStateOf(false) }
    var placeholderIndex by remember { mutableIntStateOf(0) }
    val rotatingPlaceholders = placeholders?.takeIf { it.isNotEmpty() }
    val displayedPlaceholder = rotatingPlaceholders?.get(placeholderIndex % rotatingPlaceholders.size)
        ?: placeholder

    LaunchedEffect(rotatingPlaceholders, isFocused) {
        val list = rotatingPlaceholders
        if (list == null || list.size < 2 || isFocused) return@LaunchedEffect
        while (true) {
            delay(3000)
            placeholderIndex = (placeholderIndex + 1) % list.size
        }
    }

    val focusRequester = remember { FocusRequester() }
    val focusManager = LocalFocusManager.current
    val keyboardController = LocalSoftwareKeyboardController.current
    val density = LocalDensity.current

    val ime = WindowInsets.ime
    val isKeyboardVisible by remember(ime, density) {
        derivedStateOf { ime.getBottom(density) > 0 }
    }
    // System nav-bar inset (≈24dp gesture, ≈48dp 3-button) — used to seat the floating
    // composer the right distance above the screen bottom in either navigation mode.
    val navBarBottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
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

    val setText: (String) -> Unit = { text ->
        textFieldValue = TextFieldValue(text = text, selection = TextRange(text.length))
    }
    LaunchedEffect(Unit) {
        onSetTextRequest?.invoke(setText)
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

    // Field "active" = focused OR has content. Idle no longer tints green — per the
    // 2.2 "Updates/InputComposer" definition (Figma 1211:532) the idle field sits on
    // content/surfaceSecondary, a themed background token (White light / Neutral800
    // dark), so it reads as an input before first touch; the old brand-green idle
    // read as decoration and users didn't recognize it as a field.
    val isFieldActive = isFocused || hasContent
    val fieldBackgroundColor by animateColorAsState(
        targetValue = if (isFieldActive) contentColors.surfaceReadingTertiary
                      else contentColors.surfaceSecondary,
        animationSpec = tween(durationMillis = 220),
        label = "fieldBgFade"
    )
    //   active  → neutral form-placeholder grey (standard placeholder read)
    //   idle    → themed content/foregroundPrimary (per the definition), full strength
    //             so the rotating prompt reads as the field's invitation
    val placeholderColor by animateColorAsState(
        targetValue = if (isFieldActive) contentColors.formPlaceholder
                      else contentColors.foregroundPrimary,
        animationSpec = tween(durationMillis = 220),
        label = "placeholderColorFade"
    )

    // Compact sizing — only active when [compact] is requested AND the field is focused.
    // Animate the transition so the bar smoothly shrinks/grows in place when focus changes.
    // Parent screens reserve content padding at the larger (standard) size, so layout stays
    // stable as the bar resizes within the reservation.
    val effectivelyCompact = compact && isFocused
    val sizeAnim = tween<Dp>(durationMillis = 250)
    val cTopInside by animateDpAsState(
        if (effectivelyCompact) ComposerTopInsideCompact else ComposerTopInside,
        sizeAnim, label = "topInside"
    )
    val cButtonRow by animateDpAsState(
        if (effectivelyCompact) ComposerButtonRowCompact else ComposerButtonRow,
        sizeAnim, label = "buttonRow"
    )
    val cAtRestGap by animateDpAsState(
        if (effectivelyCompact) ComposerAtRestGapCompact else ComposerAtRestGap,
        sizeAnim, label = "atRestGap"
    )
    val cKeyboardGap by animateDpAsState(
        if (effectivelyCompact) ComposerKeyboardGapCompact else ComposerKeyboardGap,
        sizeAnim, label = "keyboardGap"
    )
    val cActionIcon by animateDpAsState(
        if (effectivelyCompact) ComposerActionIconCompact else ComposerActionIcon,
        sizeAnim, label = "actionIcon"
    )
    val cVoiceIcon by animateDpAsState(
        if (effectivelyCompact) ComposerVoiceIconCompact else ComposerVoiceIcon,
        sizeAnim, label = "voiceIcon"
    )

    // Scrim only applies when not anchored — the persistent (anchored) input doesn't dim the screen.
    val scrimColor by animateColorAsState(
        targetValue = if (!isAnchored && isFocused) Color.Black.copy(alpha = 0.25f) else Color.Transparent,
        label = "scrimFade"
    )

    // Offset-based visibility — slides off screen when hidden by reveal gate or (in non-anchored
    // mode) when idle.
    val bottomOffset by animateDpAsState(
        targetValue = when {
            !visible -> 400.dp
            isAnchored || isFocused || hasContent -> 0.dp
            else -> 400.dp
        },
        animationSpec = tween(durationMillis = 300),
        label = "inputSlide"
    )

    // Inner field corner radius — Figma uses Radius.LG (16dp) for the field.
    val inputShape = SmoothShapes.rounded(Radius.LG)

    // "Alive" aura around the field: colours flow slowly + intensity breathes (see AuraColors).
    val borderWidth = 2.4.dp
    val auraTransition = rememberInfiniteTransition(label = "composerAura")
    val auraFlow by auraTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(AuraFlowMs, easing = LinearEasing), RepeatMode.Restart),
        label = "auraFlow",
    )
    // Intensity (alpha) of the aura — kept slow + smooth so it reads as ambient, not
    // animated. Gentle breaths keep it alive; occasionally it ebbs nearly to dark and
    // swells back to full over ~2.7s each way, so the return draws the eye as a graceful
    // swell rather than a snap. No holds, no abrupt pops.
    val auraIntensity = remember { Animatable(0.8f) }
    LaunchedEffect(showAura) {
        if (!showAura) return@LaunchedEffect
        while (true) {
            // Gentle, slow breaths — always lit.
            repeat(2) {
                auraIntensity.animateTo(1f, tween(2400, easing = EaseInOut))
                auraIntensity.animateTo(0.5f, tween(2400, easing = EaseInOut))
            }
            // One deep, slow ebb almost to dark, then a slow swell back to full.
            auraIntensity.animateTo(0.04f, tween(2800, easing = EaseInOut))
            auraIntensity.animateTo(1f, tween(2600, easing = EaseInOut))
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(scrimColor)
            .then(
                when {
                    // Anchored composer (chat): no full-screen tap-to-dismiss scrim, so taps on
                    // the LogoAppBar X button reach their handler instead of just clearing focus.
                    isAnchored -> Modifier
                    !isAnchored && (isFocused || hasContent) -> Modifier.clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() }
                    ) {
                        focusManager.clearFocus(force = true)
                        keyboardController?.hide()
                        if (hasContent) {
                            textFieldValue = TextFieldValue("")
                        }
                    }
                    else -> Modifier
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
            // Scroll-to-bottom pill (chat use)
            if (showScrollButton && isFocused) {
                ScrollToBottomButton(
                    onClick = onScrollToBottom,
                )
            }

            // Input sheet. Floating mode lifts the sheet off the bottom edge with
            // horizontal insets and rounded corners, wrapped in a surface-color
            // gradient that fully obscures scrolling content behind the bar's
            // body and softly fades up beyond its top edge. Non-floating keeps
            // the original full-width slab that bleeds into the nav area.
            // Floating (Figma Home): all-corner radius 24. Anchored fallback keeps top
            // corners 16 with a flush square bottom.
            val sheetShape = if (floating) SmoothShapes.rounded(Radius.XXL)
                             else RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)

            // Wraps the sheet when floating: gradient fades transparent→opaque across
            // exactly [FloatingFadeHeight] above the sheet's top edge, then stays
            // opaque all the way down (covering side gutters + nav-area strip below
            // the bar). Fixed-pixel positions keep the fade size constant regardless
            // of nav-bar inset or sheet height.
            val fadeHeightPx = with(density) { FloatingFadeHeight.toPx() }
            val resolvedFadeColor = fadeColor ?: contentColors.surfacePrimary
            val floatingWrapperModifier = if (floating) {
                Modifier
                    .fillMaxWidth()
                    .background(resolvedFadeColor)
                    .padding(top = FloatingFadeHeight)
            } else Modifier

            Box(modifier = floatingWrapperModifier) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .then(
                        if (floating) Modifier
                            .windowInsetsPadding(
                                WindowInsets.navigationBars.union(WindowInsets.ime)
                            )
                            .padding(
                                start = FloatingHorizontalMargin,
                                end = FloatingHorizontalMargin,
                                // windowInsetsPadding above already consumes the nav inset;
                                // add only the remainder up to the design gap so the total
                                // is max(navInset, FloatingBottomGap) — not their sum.
                                bottom = if (isKeyboardVisible) FloatingKeyboardGap
                                         else (FloatingBottomGap - navBarBottom).coerceAtLeast(0.dp)
                            )
                        else Modifier
                    )
                    .background(
                        brush = surfaceBrush
                            ?: SolidColor(surfaceColor ?: contentColors.surfaceReadingSecondary),
                        shape = sheetShape
                    )
                    .clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() }
                    ) { /* consume taps within the sheet */ }
                    .padding(start = 10.dp, end = 10.dp, top = cTopInside)
                    // Non-floating: consume system insets *inside* the sheet so the
                    // background covers the nav area. Floating mode already consumed
                    // the inset on the outer wrapper, so skip it here.
                    .then(
                        if (floating) Modifier
                        else Modifier.windowInsetsPadding(
                            WindowInsets.navigationBars.union(WindowInsets.ime)
                        )
                    )
                    .padding(
                        bottom = if (isKeyboardVisible) cKeyboardGap
                                 else cAtRestGap
                    )
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Bottom,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    // Camera button (hidden when image attached or text being typed)
                    if (photoUris.isEmpty() && textFieldValue.text.isBlank()) {
                        CompositionLocalProvider(LocalContentColors provides LightContentColors) {
                            val buttonColors = LocalContentColors.current
                            Box(
                                modifier = Modifier
                                    .size(cButtonRow)
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
                                    modifier = Modifier.size(cActionIcon)
                                )
                            }
                        }
                    }

                    // Text field column — animates between transparent (idle, lets composer
                    // green show through) and white (active typing surface).
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .heightIn(min = cButtonRow)
                            .clip(inputShape)
                            .background(surfaceColor ?: contentColors.surfaceReadingSecondary)
                            .background(fieldBackgroundColor)
                            // A single sweep-gradient stroke around the field's rounded-rect
                            // path (drawn on top of the opaque field). The gradient's alpha
                            // ramps 0 → 1 with a hard seam; shifting the seam position each
                            // frame rotates it clockwise.
                            .drawWithCache {
                                val sw = borderWidth.toPx()
                                // Stroke the field's exact (smooth) outline so the aura hugs
                                // the edge with no gap. Centered + clipped to the field = an
                                // inside border; width*2 → ~sw of it shows inside.
                                val edgePath = Path()
                                (inputShape.createOutline(size, LayoutDirection.Ltr, this) as? Outline.Generic)
                                    ?.let { edgePath.addPath(it.path) }
                                val coreStroke = Stroke(width = sw * 2f)
                                // Wider, fainter strokes stacked under the core make a soft inner
                                // bloom — a real-looking glow with NO GPU blur shader, so it stays
                                // light on legacy devices. Built once per size (not per frame).
                                val midStroke = Stroke(width = sw * 3f)
                                val haloStroke = Stroke(width = sw * 4.5f)
                                onDrawWithContent {
                                    drawContent()
                                    // Soft multi-colour aura flowing around the field, breathing
                                    // in intensity — ambient/alive, only while idle and only on
                                    // surfaces that opt in (Home). (When the aura isn't drawn,
                                    // auraFlow isn't read, so the redraw loop stops.)
                                    if (showAura && !isFocused) {
                                        val rot = auraFlow
                                        val intensity = auraIntensity.value
                                        val n = 18
                                        val stops = Array(n + 1) { i ->
                                            val pos = i / n.toFloat()
                                            pos to auraColorAt(((pos - rot) % 1f + 1f) % 1f)
                                        }
                                        val brush = Brush.sweepGradient(colorStops = stops, center = center)
                                        // Bloom: faint wide halo → medium → crisp core.
                                        drawPath(edgePath, brush = brush, alpha = intensity * 0.16f, style = haloStroke)
                                        drawPath(edgePath, brush = brush, alpha = intensity * 0.30f, style = midStroke)
                                        drawPath(edgePath, brush = brush, alpha = intensity, style = coreStroke)
                                    }
                                }
                            }
                            .clickable(
                                indication = null,
                                interactionSource = remember { MutableInteractionSource() }
                            ) { onTextFieldTap?.invoke() ?: requestInputFocus() }
                            .padding(horizontal = 14.dp, vertical = 0.dp),
                        verticalArrangement = Arrangement.Center
                    ) {
                        if (photoUris.isNotEmpty()) {
                            LazyRow(
                                horizontalArrangement = Arrangement.spacedBy(5.dp),
                                modifier = Modifier.padding(bottom = 10.dp)
                            ) {
                                // Single image per query — render only the first attachment.
                                itemsIndexed(photoUris.take(1)) { index, uri ->
                                    PhotoThumbnail(
                                        imageUri = uri,
                                        onRemove = { onRemovePhoto(index) },
                                        size = 64
                                    )
                                }
                            }
                        }

                        if (onTextFieldTap != null) {
                            // Launcher mode: render only the rotating placeholder; never let
                            // the field accept focus, since the parent Column's clickable will
                            // navigate away on tap.
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .heightIn(min = 24.dp),
                                contentAlignment = Alignment.CenterStart,
                            ) {
                                AnimatedContent(
                                    targetState = displayedPlaceholder,
                                    transitionSpec = {
                                        fadeIn(tween(400)) togetherWith fadeOut(tween(400))
                                    },
                                    label = "placeholderRotation"
                                ) { text ->
                                    ShimmerText(
                                        text = text,
                                        style = MaterialTheme.typography.bodyMedium.copy(
                                            textAlign = TextAlign.Start
                                        ),
                                        baseColor = placeholderColor,
                                        durationMs = ComposerShimmerPeriodMs,
                                        enabled = true,
                                        maxLines = 1,
                                        softWrap = false,
                                    )
                                }
                            }
                        } else BasicTextField(
                            value = textFieldValue,
                            onValueChange = { textFieldValue = it },
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(min = 24.dp, max = 72.dp)
                                .focusRequester(focusRequester)
                                .onFocusChanged { focusState ->
                                    isFocused = focusState.isFocused
                                    onFocusChange?.invoke(isFocused)
                                },
                            cursorBrush = SolidColor(contentColors.foregroundPrimary),
                            textStyle = MaterialTheme.typography.bodyMedium.copy(
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
                                        AnimatedContent(
                                            targetState = displayedPlaceholder,
                                            transitionSpec = {
                                                fadeIn(tween(400)) togetherWith fadeOut(tween(400))
                                            },
                                            label = "placeholderRotation"
                                        ) { text ->
                                            ShimmerText(
                                                text = text,
                                                style = MaterialTheme.typography.bodyMedium.copy(
                                                    textAlign = TextAlign.Start
                                                ),
                                                baseColor = placeholderColor,
                                                durationMs = ComposerShimmerPeriodMs,
                                                enabled = !isFocused,
                                                maxLines = 1,
                                                softWrap = false,
                                            )
                                        }
                                    }
                                    innerTextField()
                                }
                            }
                        )
                    }

                    // Mic or Send button — flips icon based on whether there's content
                    CompositionLocalProvider(LocalContentColors provides LightContentColors) {
                        val buttonColors = LocalContentColors.current
                        Box(
                            modifier = Modifier
                                .size(cButtonRow)
                                .clip(CircleShape)
                                .background(buttonColors.buttonPrimarySurface)
                                .clickable {
                                    if (hasContent) {
                                        val text = textFieldValue.text
                                        isFocused = false
                                        focusManager.clearFocus(force = true)
                                        keyboardController?.hide()
                                        onSend(text)
                                        textFieldValue = TextFieldValue("")
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
                                    contentDescription = "Send",
                                    tint = buttonColors.buttonPrimaryAccent,
                                    modifier = Modifier.size(cActionIcon)
                                )
                            } else {
                                Icon(
                                    painter = painterResource(id = R.drawable.fc_icon_mic),
                                    contentDescription = "Voice",
                                    tint = buttonColors.buttonPrimaryAccent,
                                    modifier = Modifier.size(cVoiceIcon)
                                )
                            }
                        }
                    }
                }
            }
            }
        }
    }
}
