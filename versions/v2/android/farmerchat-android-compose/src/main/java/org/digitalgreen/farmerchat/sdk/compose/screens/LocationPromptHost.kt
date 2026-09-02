package org.digitalgreen.farmerchat.sdk.compose.screens

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.components.FarmerIllustration
import org.digitalgreen.farmerchat.sdk.compose.components.FullScreenMessage
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryButton
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryButtonState
import org.digitalgreen.farmerchat.sdk.compose.components.SecondaryButton
import org.digitalgreen.farmerchat.sdk.compose.util.CountryImageAssets
import org.digitalgreen.farmerchat.sdk.compose.util.isNetworkAvailable
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.compose.util.rememberCountryFarmerPainter
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationErrorType
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptManager
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptState
import kotlin.coroutines.resume

/**
 * Global GPS/location prompt overlay (doc 01 §3.15). Renders per
 * [LocationPromptManager.state]; owns the permission launcher, SettingsClient
 * GPS resolution and fused-location fetch (10 s + last-known fallback). All
 * Play Services access is wrapped in runCatching so absence never crashes.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LocationPromptHost(
    manager: LocationPromptManager = FarmerChat.requireGraph().locationPromptManager
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val state by manager.state.collectAsState()

    fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

    // ---------------- permission launcher ----------------
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val granted = results.values.any { it }
        val activity = context.findActivity()
        val canAskAgain = if (activity != null) {
            androidx.core.app.ActivityCompat.shouldShowRequestPermissionRationale(
                activity, Manifest.permission.ACCESS_FINE_LOCATION
            )
        } else true
        manager.onPermissionResult(granted = granted, canAskAgain = granted || canAskAgain)
    }

    // ---------------- GPS resolution launcher ----------------
    val gpsResolutionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult()
    ) { result ->
        manager.onGpsEnableResult(result.resultCode == Activity.RESULT_OK)
    }

    // ---------------- state-driven side effects ----------------
    LaunchedEffect(state) {
        when (val s = state) {
            is LocationPromptState.RequestPermission -> {
                if (hasLocationPermission()) {
                    manager.onPermissionResult(granted = true)
                } else {
                    runCatching {
                        permissionLauncher.launch(
                            arrayOf(
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                            )
                        )
                    }.onFailure { manager.onPermissionResult(granted = false) }
                }
            }

            is LocationPromptState.RequestEnableGps -> {
                if (isGpsEnabled(context)) {
                    manager.onGpsAlreadyEnabled()
                } else {
                    val launched = runCatching {
                        val request = com.google.android.gms.location.LocationRequest.Builder(
                            com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY, 10_000L
                        ).build()
                        val settingsRequest =
                            com.google.android.gms.location.LocationSettingsRequest.Builder()
                                .addLocationRequest(request)
                                .build()
                        val client = com.google.android.gms.location.LocationServices
                            .getSettingsClient(context)
                        client.checkLocationSettings(settingsRequest)
                            .addOnSuccessListener { manager.onGpsAlreadyEnabled() }
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

                    if (!launched) {
                        // Play Services missing — proceed if the platform GPS is on.
                        if (isGpsEnabled(context)) manager.onGpsAlreadyEnabled()
                        else manager.onGpsEnableResult(false)
                    }
                }
            }

            is LocationPromptState.FetchingLocation -> {
                if (!isNetworkAvailable(context)) {
                    manager.onNoNetwork()
                    return@LaunchedEffect
                }
                val location = fetchLocation(context)
                if (location != null) {
                    manager.onLocationFetched(location.first, location.second)
                } else {
                    manager.onLocationFetchFailed(timeout = true)
                }
            }

            else -> Unit
        }
    }

    // ON_RESUME re-check while in Recovery (user may have granted from settings).
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                manager.onResumedWithPermission(hasLocationPermission())
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // ---------------- UI per state ----------------
    when (val s = state) {
        is LocationPromptState.Idle -> Unit

        is LocationPromptState.Interstitial,
        is LocationPromptState.RequestPermission,
        is LocationPromptState.RequestEnableGps,
        is LocationPromptState.FetchingLocation -> {
            // Interstitial overlay; while permission/GPS/fetch in flight the CTA loads.
            val isBusy = s !is LocationPromptState.Interstitial
            val painter = rememberCountryFarmerPainter(CountryImageAssets.LOOKING_AT_PHONE)
            FullScreenMessage(
                title = label(Labels.SHARE_LOCATION, "Share Location"),
                mainMessage = label(Labels.GET_ADVICE_YOUR_AREA, "Get advice for your area"),
                subtitle = label(
                    Labels.LOCATION_HELPS_SUGGESTIONS,
                    "Your location helps us give better suggestions"
                ),
                primaryCtaLabel = label(Labels.TURN_LOCATION_ON_NOW, "Turn location on now"),
                primaryButtonState = if (isBusy) PrimaryButtonState.Loading else PrimaryButtonState.Chevron,
                onPrimaryCta = { if (!isBusy) manager.onShareClicked() },
                leftIcon = Icons.AutoMirrored.Filled.ArrowBack,
                onLeftClick = { manager.onSkipClicked() },
                rightLabel = label(Labels.SKIP, "Skip"),
                onRightClick = { manager.onSkipClicked() },
                secondaryCtaLabel = label(Labels.CONTINUE_WITHOUT_LOCATION, "Continue without location"),
                onSecondaryCta = { manager.onSkipClicked() },
                illustrationContent = { FarmerIllustration(painter = painter) }
            )
        }

        is LocationPromptState.Recovery -> {
            // App parity (LocationPromptHost.kt:133 / v2 delta): the recovery sheet's two exits
            // are tracked. Both cancel paths (scrim/back dismiss, "Continue without location")
            // fire CANCELED; only one of them can run per sheet, so this does not double-count.
            // "Turn on in settings" fires CLICKED. Same screen/permission_type/attempt shape the
            // rest of the location events use.
            val analytics = FarmerChat.requireGraph().analytics
            val recoveryProps = mapOf(
                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.GPS,
                AnalyticsProps.PERMISSION_TYPE to "Location",
                AnalyticsProps.ATTEMPT to 1
            )
            ModalBottomSheet(
                onDismissRequest = {
                    analytics.track(
                        AnalyticsEvents.PERMISSION_FALLBACK_SETTING_CANCELED,
                        recoveryProps
                    )
                    manager.dismiss()
                }
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp, vertical = 16.dp)
                ) {
                    Text(
                        text = label(Labels.WE_NEED_YOUR_LOCATION, "We need your location"),
                        style = MaterialTheme.typography.titleLarge
                    )
                    Text(
                        text = label(
                            Labels.LOCATION_TAILOR_ADVICE,
                            "Your location helps us tailor advice to your area"
                        ),
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(top = 8.dp, bottom = 20.dp)
                    )
                    PrimaryButton(
                        label = label(Labels.TURN_ON_IN_SETTINGS, "Turn on in settings"),
                        onClick = {
                            analytics.track(
                                AnalyticsEvents.PERMISSION_FALLBACK_SETTING_CLICKED,
                                recoveryProps
                            )
                            org.digitalgreen.farmerchat.sdk.compose.components.openAppSettings(context)
                        },
                        modifier = Modifier.fillMaxWidth(),
                        height = 56
                    )
                    SecondaryButton(
                        label = label(Labels.CONTINUE_WITHOUT_LOCATION, "Continue without location"),
                        onClick = {
                            analytics.track(
                                AnalyticsEvents.PERMISSION_FALLBACK_SETTING_CANCELED,
                                recoveryProps
                            )
                            manager.onSkipClicked()
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 10.dp, bottom = 16.dp)
                    )
                }
            }
        }

        is LocationPromptState.Error -> {
            val painter = rememberCountryFarmerPainter(CountryImageAssets.LOOKING_AT_SKY)
            val (title, mainMessage, subtitle) = when (s.type) {
                LocationErrorType.NoNetwork -> Triple(
                    label(Labels.NO_NETWORK, "No network"),
                    label(Labels.NO_INTERNET_CONNECTION, "No internet connection"),
                    label(
                        Labels.PLEASE_CONNECT_INTERNET_TRY_AGAIN,
                        "Please connect to the internet and try again"
                    )
                )
                LocationErrorType.GpsUnavailable -> Triple(
                    label(Labels.TURN_ON_GPS, "Turn on GPS"),
                    label(Labels.LOCATION_GPS_TURNED_OFF, "Location (GPS) is turned off"),
                    label(
                        Labels.TURNING_HELPS_TAILOR_ANSWERS_YOUR_AREA,
                        "Turning it on helps us tailor answers to your area"
                    )
                )
                LocationErrorType.LocationFailed -> Triple(
                    label(Labels.SHARE_LOCATION, "Share Location"),
                    label(Labels.COULDNT_GET_YOUR_LOCATION, "Couldn't get your location"),
                    label(Labels.PLEASE_TRY_AGAIN, "Please try again")
                )
            }
            FullScreenMessage(
                title = title,
                mainMessage = mainMessage,
                subtitle = subtitle,
                primaryCtaLabel = label(Labels.TRY_AGAIN, "Try again"),
                onPrimaryCta = { manager.onErrorRetry() },
                leftIcon = Icons.AutoMirrored.Filled.ArrowBack,
                onLeftClick = { manager.onSkipClicked() },
                rightLabel = label(Labels.SKIP, "Skip"),
                onRightClick = { manager.onSkipClicked() },
                illustrationContent = { FarmerIllustration(painter = painter) },
                enablePrimaryDebounce = true
            )
        }
    }
}

private fun Context.findActivity(): Activity? {
    var ctx = this
    while (ctx is android.content.ContextWrapper) {
        if (ctx is Activity) return ctx
        ctx = ctx.baseContext
    }
    return null
}

private fun isGpsEnabled(context: Context): Boolean = runCatching {
    val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
        lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
}.getOrDefault(false)

/**
 * Fresh fused location with a 10 s timeout, falling back to last-known.
 * Returns null when unavailable (missing permission / Play Services / timeout).
 */
private suspend fun fetchLocation(context: Context): Pair<Double, Double>? {
    // Fresh fix (10 s timeout)
    val fresh = withTimeoutOrNull(10_000L) {
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
    if (fresh != null) return fresh

    // Last-known fallback (2 s)
    return withTimeoutOrNull(2_000L) {
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
}
