package org.digitalgreen.farmerchat.sdk.compose.screens

import androidx.activity.compose.BackHandler
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.components.FarmerIllustration
import org.digitalgreen.farmerchat.sdk.compose.components.FullScreenMessage
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryButtonState
import org.digitalgreen.farmerchat.sdk.compose.util.CountryImageAssets
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.compose.util.rememberCountryFarmerPainter
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.ui.unit.dp

/**
 * AccountBenefits interstitial — "Sign up" / "Save your questions and answers"
 * + farmer LOOKING_AT_CAMERA + CTA + Skip (doc 01 §3.5).
 */
@Composable
fun AccountBenefitsScreen(
    onSignUp: () -> Unit,
    onSkip: () -> Unit
) {
    val graph = FarmerChat.requireGraph()
    val painter = rememberCountryFarmerPainter(CountryImageAssets.LOOKING_AT_CAMERA)

    LaunchedEffect(Unit) {
        graph.analytics.trackScreenView(AnalyticsScreens.ACCOUNT_BENEFIT)
    }
    DisposableEffect(Unit) {
        onDispose { graph.analytics.trackScreenExit(AnalyticsScreens.ACCOUNT_BENEFIT) }
    }

    FullScreenMessage(
        title = label(Labels.SIGN_UP, "Sign up"),
        mainMessage = label(Labels.SAVE_YOUR_QUESTIONS_ANSWERS, "Save your questions\nand answers"),
        subtitle = label(
            Labels.WELL_SAVE_YOUR_CHATS_YOU_CONTINUE,
            "We'll save your chats so you can continue later."
        ),
        primaryCtaLabel = label(Labels.SIGN_UP_PHONE_NUMBER, "Sign up with phone number"),
        onPrimaryCta = {
            graph.analytics.track(AnalyticsEvents.ACCOUNT_BENEFIT_SCREEN_PROCEED)
            onSignUp()
        },
        // App parity (AppNavGraph.kt:812): the app's AccountBenefits left action is ArrowBack,
        // not Close — and its onLeftClick is popBackStack(), which is exactly what onSkip does
        // here, so only the glyph differed.
        leftIcon = Icons.AutoMirrored.Filled.ArrowBack,
        leftRadius = Radius.Rounded,
        onLeftClick = {
            graph.analytics.track(AnalyticsEvents.ACCOUNT_BENEFIT_SCREEN_SKIP)
            onSkip()
        },
        rightLabel = label(Labels.SKIP, "Skip"),
        rightRadius = Radius.Rounded,
        onRightClick = {
            graph.analytics.track(AnalyticsEvents.ACCOUNT_BENEFIT_SCREEN_SKIP)
            onSkip()
        },
        illustrationContent = {
            FarmerIllustration(painter = painter, maxWidth = 322.dp)
        },
        primaryButtonState = PrimaryButtonState.Chevron
    )
}

/**
 * AccountSuccess — "You're all set!" + LOOKING_AT_SKY + Continue; BackHandler →
 * Home (doc 01 §3.6).
 */
@Composable
fun AccountSuccessScreen(
    onContinue: () -> Unit
) {
    val graph = FarmerChat.requireGraph()
    val painter = rememberCountryFarmerPainter(CountryImageAssets.LOOKING_AT_SKY)

    LaunchedEffect(Unit) {
        graph.analytics.trackScreenView(AnalyticsScreens.ACCOUNT_SUCCESS)
    }
    DisposableEffect(Unit) {
        onDispose { graph.analytics.trackScreenExit(AnalyticsScreens.ACCOUNT_SUCCESS) }
    }

    BackHandler {
        onContinue()
    }

    FullScreenMessage(
        // App parity (AccountSuccessScreen.kt:57): the app bar title is SIGN_UP, not ALL_SET —
        // ALL_SET is a different label and left the success screen titled "All set" above a
        // "You're all set!" headline, saying the same thing twice.
        title = label(Labels.SIGN_UP, "Sign up"),
        mainMessage = label(Labels.YOURE_ALL_SET, "You're all set!"),
        subtitle = label(
            Labels.PREVIOUS_QUESTIONS_MENU,
            "Find your previous questions in the menu and continue anytime."
        ),
        // App parity (AccountSuccessScreen.kt:60): this screen overrides the subtitle to
        // bodyLarge. Omitting it fell back to FullScreenMessage's bodyMedium default.
        subtitleTextStyle = MaterialTheme.typography.bodyLarge,
        primaryCtaLabel = label(Labels.CONTINUE, "Continue"),
        onPrimaryCta = {
            graph.analytics.track(AnalyticsEvents.SIGNUP_CONTINUE_CLICKED)
            onContinue()
        },
        illustrationContent = {
            FarmerIllustration(painter = painter, maxWidth = 322.dp)
        }
    )
}
