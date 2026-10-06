package org.digitalgreen.farmerchat.sdk.compose.components

import org.digitalgreen.farmerchat.sdk.compose.util.fcNavigationBarsBottom
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import org.digitalgreen.farmerchat.sdk.compose.theme.LightContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import androidx.compose.ui.unit.Dp

/**
 * Shared "green full-screen message" layout used by error screens, sign-up
 * interstitial, account success and location prompts (port of the app's
 * FullScreenMessage in ui/error/NoInternetScreen.kt).
 */
@Composable
fun FullScreenMessage(
    title: String,
    mainMessage: String,
    subtitle: String,
    primaryCtaLabel: String,
    onPrimaryCta: () -> Unit,
    modifier: Modifier = Modifier,
    illustrationContent: (@Composable () -> Unit)? = null,
    showIllustrationGradientOverlay: Boolean = false,
    subtitleTextStyle: TextStyle = MaterialTheme.typography.bodyMedium,
    primaryButtonState: PrimaryButtonState = PrimaryButtonState.Default,
    leftIcon: ImageVector? = null,
    leftRadius: Dp = Radius.MD,
    onLeftClick: () -> Unit = {},
    rightLabel: String? = null,
    rightRadius: Dp = Radius.MD,
    onRightClick: () -> Unit = {},
    secondaryCtaLabel: String? = null,
    onSecondaryCta: (() -> Unit)? = null,
    enablePrimaryDebounce: Boolean = false,
    onBackgroundTap: (() -> Unit)? = null,
    primaryButtonModifier: Modifier = Modifier
) {
    val brand = LocalBrandColors.current
    val bottomInset = fcNavigationBarsBottom()

    var didTapPrimary by remember { mutableStateOf(false) }
    LaunchedEffect(didTapPrimary, enablePrimaryDebounce) {
        if (enablePrimaryDebounce && didTapPrimary) {
            delay(1500)
            didTapPrimary = false
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(brand.surfacePrimary)
            .let { base ->
                if (onBackgroundTap != null) {
                    base.clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() }
                    ) { onBackgroundTap() }
                } else base
            }
    ) {
        DefaultAppBar(
            title = title,
            glowType = GlowType.Yellow,
            glowAlpha = 1.0f,
            leftIcon = leftIcon,
            leftRadius = leftRadius,
            onLeftClick = onLeftClick,
            rightLabel = rightLabel,
            rightRadius = rightRadius,
            onRightClick = onRightClick
        )

        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(vertical = 16.dp),
                contentAlignment = Alignment.Center
            ) {
                if (illustrationContent != null) {
                    illustrationContent()
                }
            }

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = mainMessage,
                    style = MaterialTheme.typography.displaySmall,
                    color = brand.foregroundPrimary,
                    textAlign = TextAlign.Center
                )

                Text(
                    text = subtitle,
                    style = subtitleTextStyle,
                    color = brand.foregroundPrimary,
                    textAlign = TextAlign.Center
                )
            }
        }

        // Bottom button — forced to light mode (app parity)
        CompositionLocalProvider(LocalContentColors provides org.digitalgreen.farmerchat.sdk.compose.theme.hostLightContentColors()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 8.dp + bottomInset)
            ) {
                PrimaryButton(
                    label = primaryCtaLabel,
                    state = if (enablePrimaryDebounce && didTapPrimary) PrimaryButtonState.Loading
                    else primaryButtonState,
                    onClick = {
                        if (enablePrimaryDebounce && didTapPrimary) return@PrimaryButton
                        if (enablePrimaryDebounce) didTapPrimary = true
                        onPrimaryCta()
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .then(primaryButtonModifier),
                    height = 64
                )
            }
        }

        if (!secondaryCtaLabel.isNullOrBlank() && onSecondaryCta != null) {
            Text(
                text = secondaryCtaLabel,
                style = MaterialTheme.typography.bodyMedium,
                color = brand.foregroundPrimary,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(
                        indication = null,
                        interactionSource = remember { MutableInteractionSource() }
                    ) { onSecondaryCta() }
                    .padding(vertical = 12.dp)
            )
        }
    }
}

/** Rounded farmer illustration used inside [FullScreenMessage]. */
@Composable
fun FarmerIllustration(
    painter: androidx.compose.ui.graphics.painter.Painter,
    modifier: Modifier = Modifier,
    showGradientOverlay: Boolean = false,
    /**
     * App parity. 300dp is `FullScreenMessage`'s own FALLBACK box (app NoInternetScreen.kt:158),
     * which is what this default mirrors. Every screen that supplies its own
     * `illustrationContent` overrides it to **322dp** — AccountSuccessScreen.kt:82,
     * AppNavGraph.kt:832 (AccountBenefits) and LocationPromptHost.kt:746/791/864. The SDK's call
     * sites took the 300 default, so all four rendered 22dp narrower than the app's.
     *
     * A parameter rather than a changed default: the 300 is correct for the fallback path.
     */
    maxWidth: Dp = 300.dp
) {
    Box(
        modifier = modifier
            .widthIn(max = maxWidth)
            .aspectRatio(300f / 450f)
            .clip(SmoothShapes.rounded(Radius.Rounded))
    ) {
        Image(
            painter = painter,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )

        if (showGradientOverlay) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colorStops = arrayOf(
                                0.77f to Color.Transparent,
                                1f to Color.Black.copy(alpha = 0.4f)
                            )
                        )
                    )
            )
        }
    }
}
