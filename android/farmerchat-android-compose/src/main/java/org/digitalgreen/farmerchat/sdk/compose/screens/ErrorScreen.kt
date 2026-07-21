package org.digitalgreen.farmerchat.sdk.compose.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.components.FullScreenMessage
import org.digitalgreen.farmerchat.sdk.compose.util.CountryImageAssets
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.compose.util.rememberCountryFarmerPainter
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.labels.Labels

enum class ErrorType { NO_INTERNET, API_ERROR }

/**
 * Full-screen error (NO_INTERNET vs API_ERROR copy) with debounced Try again
 * (doc 01 §3.14).
 */
@Composable
fun ErrorScreen(
    errorType: ErrorType,
    onTryAgain: () -> Unit,
    modifier: Modifier = Modifier
) {
    val graph = FarmerChat.requireGraph()

    LaunchedEffect(Unit) {
        graph.analytics.trackScreenView(AnalyticsScreens.ERROR)
    }
    DisposableEffect(Unit) {
        onDispose { graph.analytics.trackScreenExit(AnalyticsScreens.ERROR) }
    }

    val (title, mainMessage, subtitle) = when (errorType) {
        ErrorType.NO_INTERNET -> Triple(
            label(Labels.NO_INTERNET_CONNECTION, "No internet connection"),
            label(Labels.FARMERCHAT_NEEDS_THE_INTERNET, "FarmerChat needs \nthe internet"),
            label(Labels.CHECK_MOBILE_DATA_WIFI_SIGNAL, "Check mobile data or Wi-Fi signal")
        )
        ErrorType.API_ERROR -> Triple(
            label(Labels.SOMETHING_WENT_WRONG, "Something went wrong"),
            label(Labels.FARMERCHAT_COULDNT_LOAD, "FarmerChat couldn't load"),
            label(Labels.PLEASE_TRY_AGAIN, "Please try again")
        )
    }

    val painter = rememberCountryFarmerPainter(CountryImageAssets.LOOKING_AT_SKY)

    FullScreenMessage(
        title = title,
        mainMessage = mainMessage,
        subtitle = subtitle,
        primaryCtaLabel = label(Labels.TRY_AGAIN, "Try again"),
        onPrimaryCta = onTryAgain,
        modifier = modifier,
        illustrationContent = {
            Image(
                painter = painter,
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier
                    .fillMaxSize()
                    .widthIn(max = 322.dp)
            )
        },
        enablePrimaryDebounce = true,
    )
}
