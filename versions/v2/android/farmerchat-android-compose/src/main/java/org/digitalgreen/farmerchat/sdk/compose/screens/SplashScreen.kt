package org.digitalgreen.farmerchat.sdk.compose.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.EaseOut
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.R
import org.digitalgreen.farmerchat.sdk.compose.components.Toast
import org.digitalgreen.farmerchat.sdk.compose.components.ToastState
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import androidx.compose.runtime.collectAsState

/**
 * Splash — boot background + rotating logo mark; waits a min duration, tracks
 * APP_OPENED, gates on hasPendingError, then routes via routeFromSplash (doc 01 §3.1).
 */
@Composable
fun SplashScreen(
    onReady: () -> Unit
) {
    val graph = FarmerChat.requireGraph()
    val brand = LocalBrandColors.current
    val hasPendingError by graph.errorNavigationManager.hasPendingError.collectAsState()

    var showStartingToast by remember { mutableStateOf(false) }

    // Rotating logo: hold 3 s, then spin 360°.
    val rotation = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(3000L)
            rotation.animateTo(
                targetValue = rotation.value + 360f,
                animationSpec = tween(durationMillis = 600, easing = EaseOut)
            )
        }
    }

    LaunchedEffect(Unit) {
        delay(2000L)
        showStartingToast = true
    }

    LaunchedEffect(Unit) {
        graph.analytics.trackScreenView(AnalyticsScreens.SPLASH)
        // Min-duration delay before routing (app parity: 200 ms).
        delay(200L)
        graph.analytics.track(AnalyticsEvents.APP_OPENED)
        if (!graph.errorNavigationManager.hasPendingError.value) {
            onReady()
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            graph.analytics.trackScreenExit(AnalyticsScreens.SPLASH)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(brand.surfacePrimary)
    ) {
        Image(
            painter = painterResource(id = R.drawable.fc_boot_bg),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )

        Image(
            painter = painterResource(id = R.drawable.fc_logo_mark),
            contentDescription = "FarmerChat",
            colorFilter = ColorFilter.tint(brand.foregroundPrimary),
            modifier = Modifier
                .align(Alignment.Center)
                .size(72.dp)
                .graphicsLayer { rotationZ = rotation.value }
        )

        Toast(
            message = label(Labels.FARMERCHAT_STARTING, "FarmerChat is starting…"),
            state = ToastState.Loading,
            visible = showStartingToast && !hasPendingError,
            onDismiss = { showStartingToast = false }
        )
    }
}
