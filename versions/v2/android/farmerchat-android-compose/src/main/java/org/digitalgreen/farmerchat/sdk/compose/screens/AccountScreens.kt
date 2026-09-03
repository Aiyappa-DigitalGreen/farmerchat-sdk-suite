package org.digitalgreen.farmerchat.sdk.compose.screens

import androidx.activity.compose.BackHandler
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
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
        leftIcon = Icons.Filled.Close,
        onLeftClick = {
            graph.analytics.track(AnalyticsEvents.ACCOUNT_BENEFIT_SCREEN_SKIP)
            onSkip()
        },
        rightLabel = label(Labels.SKIP, "Skip"),
        onRightClick = {
            graph.analytics.track(AnalyticsEvents.ACCOUNT_BENEFIT_SCREEN_SKIP)
            onSkip()
        },
        illustrationContent = {
            FarmerIllustration(painter = painter)
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
        title = label(Labels.ALL_SET, "All set"),
        mainMessage = label(Labels.YOURE_ALL_SET, "You're all set!"),
        subtitle = label(
            Labels.PREVIOUS_QUESTIONS_MENU,
            "Find your previous questions in the menu and continue anytime."
        ),
        primaryCtaLabel = label(Labels.CONTINUE, "Continue"),
        onPrimaryCta = {
            graph.analytics.track(AnalyticsEvents.SIGNUP_CONTINUE_CLICKED)
            onContinue()
        },
        illustrationContent = {
            FarmerIllustration(painter = painter)
        }
    )
}
