package org.digitalgreen.farmerchat.sdk.compose.screens

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.components.FullScreenMessage
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryButton
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryButtonState
import org.digitalgreen.farmerchat.sdk.compose.theme.LightContentColors
import org.digitalgreen.farmerchat.sdk.compose.util.CountryImageAssets
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.compose.util.rememberCountryFarmerPainter
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationErrorType
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptManager
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptState
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationTriggerSource
import kotlin.coroutines.resume

/**
 * Global GPS/location prompt overlay (doc 01 §3.15) — a port of the app's
 * `ui/location/LocationPromptHost.kt` (fc-compose-agentic). Renders per
 * [LocationPromptManager.state] and owns the permission launcher, the SettingsClient GPS
 * resolution and the fused-location fetch. All Play Services access is wrapped in runCatching so
 * its absence never crashes.
 *
 * Only the WEATHER entry shows the full-screen interstitial; the Home pill, the chat gps-prompt
 * chip, Settings and campaigns go straight to the system dialogs over the current screen.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationPromptHost(
    manager: LocationPromptManager = FarmerChat.requireGraph().locationPromptManager
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val state by manager.state.collectAsState()

    // ---------------- permission launcher (FINE only, as the app requests) ----------------
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> manager.onPermissionResult(granted) }

    // ---------------- GPS resolution launcher ----------------
    // The app re-reads the providers instead of trusting resultCode.
    val gpsResolutionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult()
    ) { _ -> manager.onGpsEnableResult(isGpsOn(context)) }

    // ---------------- state-driven side effects ----------------
    LaunchedEffect(state) {
        when (val s = state) {
            is LocationPromptState.RequestPermission -> {
                runCatching { permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION) }
                    .onFailure { manager.onPermissionResult(granted = false) }
            }

            is LocationPromptState.RequestEnableGps -> {
                // Always ask SettingsClient (never short-circuit on the platform providers): with
                // device location ON but Location Accuracy OFF the app still shows the dialog.
                val launched = runCatching {
                    val request = com.google.android.gms.location.LocationRequest.Builder(
                        com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY, 10_000L
                    ).build()
                    val settingsRequest =
                        com.google.android.gms.location.LocationSettingsRequest.Builder()
                            .addLocationRequest(request)
                            // App parity: without this, Play Services may not re-show the dialog
                            // once the farmer has declined it.
                            .setAlwaysShow(true)
                            .build()
                    com.google.android.gms.location.LocationServices.getSettingsClient(context)
                        .checkLocationSettings(settingsRequest)
                        .addOnSuccessListener { manager.onGpsEnableResult(true) }
                        .addOnFailureListener { exception ->
                            val resolvable = exception as?
                                com.google.android.gms.common.api.ResolvableApiException
                            if (resolvable != null) {
                                runCatching {
                                    gpsResolutionLauncher.launch(
                                        IntentSenderRequest.Builder(resolvable.resolution).build()
                                    )
                                }.onFailure { manager.onGpsEnableResult(false) }
                            } else {
                                manager.onGpsEnableResult(false)
                            }
                        }
                    true
                }.getOrDefault(false)
                // Play Services missing — proceed if the platform GPS is on.
                if (!launched) manager.onGpsEnableResult(isGpsOn(context))
            }

            is LocationPromptState.FetchingLocation -> {
                val fix = fetchFreshLocation(context)
                    // After the retry the app falls back to the last known fix.
                    ?: if (s.attempt >= 1) fetchLastKnownLocation(context) else null
                if (fix != null) manager.onLocationFetched(fix.first, fix.second)
                else manager.onLocationFetchFailed(timeout = true)
            }

            else -> Unit
        }
    }

    // ON_RESUME while Recovery is up: the farmer may have granted the permission in Settings.
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                manager.onResumedWithPermission(hasFinePermission(context))
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // ---------------- UI per state ----------------
    when (val s = state) {
        is LocationPromptState.Idle -> Unit

        is LocationPromptState.Interstitial -> BlockingBox {
            ShareLocationInterstitial(
                ctaLabel = label(Labels.SHARE_LOCATION, "Share Location"),
                busy = false,
                onCta = { manager.onInterstitialCtaClicked() },
                onBack = { manager.cancel() },
                onSkip = { manager.continueWithoutLocation(reason = "skip") }
            )
        }

        is LocationPromptState.RequestPermission,
        is LocationPromptState.RequestEnableGps,
        is LocationPromptState.FetchingLocation -> {
            // Weather keeps the interstitial up (back/skip hidden) so the system dialogs appear on
            // top of it; every other entry shows no UI — the dialogs appear over the current screen.
            if (sourceOf(s) == LocationTriggerSource.Weather) BlockingBox {
                val fetching = s is LocationPromptState.FetchingLocation
                ShareLocationInterstitial(
                    ctaLabel = if (fetching) {
                        label(Labels.GETTING_YOUR_LOCATION, "Getting your location...")
                    } else {
                        label(Labels.SHARE_LOCATION, "Share Location")
                    },
                    busy = fetching,
                    onCta = {},
                    onBack = null,
                    onSkip = null
                )
            }
        }

        is LocationPromptState.Recovery -> {
            val onClose: () -> Unit = {
                manager.trackRecoveryCanceled()
                manager.continueWithoutLocation(reason = "recovery_closed")
            }
            if (s.source == LocationTriggerSource.Weather) BlockingBox {
                ShareLocationInterstitial(
                    ctaLabel = label(Labels.SHARE_LOCATION, "Share Location"),
                    busy = false,
                    onCta = {},
                    onBack = null,
                    onSkip = null
                )
                RecoverySheet(
                    onDismiss = {
                        manager.trackRecoveryCanceled()
                        manager.continueWithoutLocation(reason = "recovery_dismissed")
                    },
                    onClose = onClose,
                    onOpenSettings = {
                        manager.trackRecoverySettingsClicked()
                        org.digitalgreen.farmerchat.sdk.compose.components.openAppSettings(context)
                    }
                )
            } else {
                RecoverySheet(
                    onDismiss = {
                        manager.trackRecoveryCanceled()
                        manager.continueWithoutLocation(reason = "recovery_dismissed")
                    },
                    onClose = onClose,
                    onOpenSettings = {
                        manager.trackRecoverySettingsClicked()
                        org.digitalgreen.farmerchat.sdk.compose.components.openAppSettings(context)
                    }
                )
            }
        }

        is LocationPromptState.Error -> {
            data class Copy(val title: String, val main: String, val sub: String, val image: String)
            val copy = when (s.type) {
                LocationErrorType.NoNetwork -> Copy(
                    label(Labels.NO_INTERNET_CONNECTION, "No internet connection"),
                    label(Labels.FARMERCHAT_NEEDS_THE_INTERNET, "FarmerChat needs \nthe internet"),
                    label(Labels.CHECK_MOBILE_DATA_WIFI_SIGNAL, "Check mobile data or Wi-Fi signal"),
                    CountryImageAssets.LOOKING_AT_SKY
                )
                LocationErrorType.GpsUnavailable -> Copy(
                    label(Labels.TURN_ON_GPS, "Turn on GPS"),
                    label(Labels.GET_LOCAL_ADVICE, "Get local advice"),
                    label(
                        Labels.LOCATION_GPS_TURNED_OFF_TURNING_HELPS,
                        "Location and GPS are turned off. Turning this on helps us tailor answers to your area."
                    ),
                    CountryImageAssets.LOOKING_AT_PHONE
                )
                LocationErrorType.LocationFailed -> Copy(
                    label(Labels.SOMETHING_WENT_WRONG, "Something went wrong"),
                    label(Labels.COULDNT_GET_YOUR_LOCATION, "Couldn't get your location"),
                    label(Labels.PLEASE_TRY_AGAIN, "Please try again."),
                    CountryImageAssets.LOOKING_AT_PHONE
                )
            }
            val painter = rememberCountryFarmerPainter(copy.image)
            // App: error screens have their own title and NO back/skip; the CTA retries when the
            // error is retryable and otherwise closes the flow.
            FullScreenMessage(
                title = copy.title,
                mainMessage = copy.main,
                subtitle = copy.sub,
                illustrationContent = {
                    Image(
                        painter = painter,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                },
                primaryCtaLabel = label(Labels.TRY_AGAIN, "Try again"),
                onPrimaryCta = { manager.onErrorCta() },
                enablePrimaryDebounce = true
            )
        }
    }
}

/** Consumes every touch so nothing reaches the screen underneath. */
@Composable
private fun BlockingBox(content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
                onClick = {}
            )
    ) { content() }
}

@Composable
private fun ShareLocationInterstitial(
    ctaLabel: String,
    busy: Boolean,
    onCta: () -> Unit,
    onBack: (() -> Unit)?,
    onSkip: (() -> Unit)?
) {
    val painter = rememberCountryFarmerPainter(CountryImageAssets.LOOKING_AT_PHONE)
    FullScreenMessage(
        title = label(Labels.SHARE_LOCATION, "Share Location"),
        mainMessage = label(Labels.GET_ADVICE_YOUR_AREA, "Get advice for your area"),
        subtitle = label(
            Labels.LOCATION_HELPS_SUGGESTIONS,
            "Your location helps us suggest crops, weather, and pests near you."
        ),
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
        showIllustrationGradientOverlay = true,
        primaryCtaLabel = ctaLabel,
        primaryButtonState = if (busy) PrimaryButtonState.Loading else PrimaryButtonState.Chevron,
        onPrimaryCta = onCta,
        leftIcon = if (onBack != null) Icons.AutoMirrored.Filled.ArrowBack else null,
        onLeftClick = { onBack?.invoke() },
        rightLabel = if (onSkip != null) label(Labels.SKIP, "Skip") else null,
        onRightClick = { onSkip?.invoke() }
    )
}

/** App "We need your location" sheet: square farmer image with a close chip, centred copy, one CTA. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RecoverySheet(
    onDismiss: () -> Unit,
    onClose: () -> Unit,
    onOpenSettings: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val painter = rememberCountryFarmerPainter(CountryImageAssets.LOOKING_AT_PHONE_SQUARE)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        dragHandle = null,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        containerColor = LightContentColors.surfacePrimary
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(modifier = Modifier.fillMaxWidth()) {
                Image(
                    painter = painter,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(382.dp)
                        .clip(RoundedCornerShape(24.dp))
                )
                IconButton(
                    onClick = onClose,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(12.dp)
                        .size(44.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color.White)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = label(Labels.CLOSE, "Close")
                    )
                }
            }

            Spacer(Modifier.height(4.dp))

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .navigationBarsPadding(),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = label(Labels.WE_NEED_YOUR_LOCATION, "We need your location"),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                    color = LightContentColors.foregroundPrimary,
                    modifier = Modifier.fillMaxWidth()
                )
                Text(
                    text = label(
                        Labels.LOCATION_TAILOR_ADVICE,
                        "Sharing your location helps FarmerChat tailor advice to your farm."
                    ),
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                    color = LightContentColors.foregroundPrimary,
                    modifier = Modifier.fillMaxWidth()
                )
                PrimaryButton(
                    label = label(Labels.TURN_ON_IN_SETTINGS, "Turn on in settings"),
                    state = PrimaryButtonState.Chevron,
                    onClick = onOpenSettings,
                    modifier = Modifier.fillMaxWidth(),
                    height = 56
                )
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

private fun sourceOf(s: LocationPromptState): LocationTriggerSource? = when (s) {
    is LocationPromptState.RequestPermission -> s.source
    is LocationPromptState.RequestEnableGps -> s.source
    is LocationPromptState.FetchingLocation -> s.source
    is LocationPromptState.Recovery -> s.source
    is LocationPromptState.Interstitial -> s.source
    is LocationPromptState.Error -> s.source
    LocationPromptState.Idle -> null
}

private fun hasFinePermission(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED

private fun isGpsOn(context: Context): Boolean = runCatching {
    val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
        lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
}.getOrDefault(false)

/** Fresh fused fix with the app's 10 s timeout; null on timeout / failure / no Play Services. */
private suspend fun fetchFreshLocation(context: Context): Pair<Double, Double>? =
    withTimeoutOrNull(10_000L) {
        suspendCancellableCoroutine<Pair<Double, Double>?> { cont ->
            val resumed = java.util.concurrent.atomic.AtomicBoolean(false)
            fun resumeOnce(value: Pair<Double, Double>?) {
                if (resumed.compareAndSet(false, true) && cont.isActive) cont.resume(value)
            }
            runCatching {
                val client = com.google.android.gms.location.LocationServices
                    .getFusedLocationProviderClient(context)
                val cts = com.google.android.gms.tasks.CancellationTokenSource()
                @Suppress("MissingPermission")
                client.getCurrentLocation(
                    com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY,
                    cts.token
                )
                    .addOnSuccessListener { location ->
                        resumeOnce(location?.let { it.latitude to it.longitude })
                    }
                    .addOnFailureListener { resumeOnce(null) }
                cont.invokeOnCancellation { runCatching { cts.cancel() } }
            }.onFailure { resumeOnce(null) }
        }
    }

/** Last known fused fix with the app's 2 s timeout. */
private suspend fun fetchLastKnownLocation(context: Context): Pair<Double, Double>? =
    withTimeoutOrNull(2_000L) {
        suspendCancellableCoroutine<Pair<Double, Double>?> { cont ->
            val resumed = java.util.concurrent.atomic.AtomicBoolean(false)
            fun resumeOnce(value: Pair<Double, Double>?) {
                if (resumed.compareAndSet(false, true) && cont.isActive) cont.resume(value)
            }
            runCatching {
                val client = com.google.android.gms.location.LocationServices
                    .getFusedLocationProviderClient(context)
                @Suppress("MissingPermission")
                client.lastLocation
                    .addOnSuccessListener { location ->
                        resumeOnce(location?.let { it.latitude to it.longitude })
                    }
                    .addOnFailureListener { resumeOnce(null) }
            }.onFailure { resumeOnce(null) }
        }
    }
