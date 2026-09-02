package org.digitalgreen.farmerchat.sdk.views.internal.location

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import android.view.LayoutInflater
import android.widget.FrameLayout
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.google.android.gms.common.api.ResolvableApiException
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.LocationSettingsRequest
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.google.android.material.bottomsheet.BottomSheetDialog
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.core.labels.LabelManager
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.network.NetworkUtils
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationErrorType
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptManager
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptState
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationTriggerSource
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcSheetLocationRecoveryBinding
import org.digitalgreen.farmerchat.sdk.views.internal.util.FarmerIllustrations
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.FullScreenMessageView
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.PrimaryButtonView

/**
 * View-based global GPS prompt overlay (doc 01 §3.15). Renders per
 * [LocationPromptManager.state] and reports platform results back into the manager.
 * All Play Services calls are wrapped in runCatching — absence never crashes.
 */
internal class LocationPromptHost(
    private val activity: FragmentActivity,
    private val container: FrameLayout,
    private val lifecycleOwner: LifecycleOwner,
    private val manager: LocationPromptManager,
    private val labels: LabelManager
) {

    private val permissionLauncher: ActivityResultLauncher<Array<String>>
    private val gpsResolutionLauncher: ActivityResultLauncher<IntentSenderRequest>

    private var recoverySheet: BottomSheetDialog? = null
    private var lastHandledState: LocationPromptState? = null
    private var fetchJob: Job? = null

    init {
        val registry = activity.activityResultRegistry
        permissionLauncher = registry.register(
            "fc_sdk_location_permission", lifecycleOwner,
            ActivityResultContracts.RequestMultiplePermissions()
        ) { grants ->
            val granted = grants[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                grants[Manifest.permission.ACCESS_COARSE_LOCATION] == true
            val canAskAgain = granted || activity.shouldShowRequestPermissionRationale(
                Manifest.permission.ACCESS_FINE_LOCATION
            )
            manager.onPermissionResult(granted, canAskAgain)
        }
        gpsResolutionLauncher = registry.register(
            "fc_sdk_gps_resolution", lifecycleOwner,
            ActivityResultContracts.StartIntentSenderForResult()
        ) { result ->
            manager.onGpsEnableResult(result.resultCode == FragmentActivity.RESULT_OK)
        }

        lifecycleOwner.lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onResume(owner: LifecycleOwner) {
                if (manager.state.value is LocationPromptState.Recovery) {
                    manager.onResumedWithPermission(hasLocationPermission())
                }
            }
        })

        lifecycleOwner.lifecycleScope.launch {
            lifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                manager.state.collect { state -> render(state) }
            }
        }
    }

    private fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    private fun render(state: LocationPromptState) {
        val isNew = state !== lastHandledState
        lastHandledState = state
        if (state !is LocationPromptState.Recovery) dismissRecoverySheet()

        when (state) {
            is LocationPromptState.Idle -> {
                fetchJob?.cancel()
                hideOverlay()
            }

            is LocationPromptState.Interstitial -> showInterstitial(loadingLabel = null)

            is LocationPromptState.RequestPermission -> {
                keepInterstitialIfWeather(state.source, null)
                if (isNew) {
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
            }

            is LocationPromptState.RequestEnableGps -> {
                keepInterstitialIfWeather(state.source, null)
                if (isNew) checkGpsSettings()
            }

            is LocationPromptState.FetchingLocation -> {
                keepInterstitialIfWeather(
                    state.source,
                    labels.getLabel(Labels.GETTING_YOUR_LOCATION, "Getting your location...")
                )
                fetchLocation()
            }

            is LocationPromptState.Recovery -> {
                hideOverlay()
                showRecoverySheet()
            }

            is LocationPromptState.Error -> showError(state.type)
        }
    }

    // ------------------------------------------------------------------ overlay rendering

    private fun hideOverlay() {
        container.removeAllViews()
        container.isVisible = false
    }

    private fun keepInterstitialIfWeather(source: LocationTriggerSource, loadingLabel: String?) {
        if (source == LocationTriggerSource.Campaign) {
            // Widget flow shows no UI while permission/GPS/fetch is in progress.
            hideOverlay()
        } else {
            showInterstitial(loadingLabel)
        }
    }

    private fun showInterstitial(loadingLabel: String?) {
        val view = FullScreenMessageView(activity)
        view.bind(
            title = labels.getLabel(Labels.SHARE_LOCATION, "Share Location"),
            mainMessage = labels.getLabel(Labels.GET_ADVICE_YOUR_AREA, "Get advice for your area"),
            subtitle = labels.getLabel(
                Labels.LOCATION_HELPS_SUGGESTIONS,
                "Your location helps us suggest crops, weather, and pests near you."
            ),
            primaryCtaLabel = loadingLabel
                ?: labels.getLabel(Labels.SHARE_LOCATION, "Share Location"),
            primaryButtonState = if (loadingLabel != null) {
                PrimaryButtonView.State.LOADING
            } else {
                PrimaryButtonView.State.CHEVRON
            },
            onPrimaryCta = if (loadingLabel == null) ({ manager.onShareClicked() }) else ({ }),
            illustrationAsset = FarmerIllustrations.LOOKING_AT_PHONE,
            leftIconRes = R.drawable.fc_ic_back,
            onLeftClick = { manager.onSkipClicked() },
            rightLabel = labels.getLabel(Labels.SKIP, "Skip"),
            onRightClick = { manager.onSkipClicked() }
        )
        container.removeAllViews()
        container.addView(view)
        container.isVisible = true
    }

    private fun showError(type: LocationErrorType) {
        val (title, main, subtitle) = when (type) {
            LocationErrorType.NoNetwork -> Triple(
                labels.getLabel(Labels.NO_INTERNET_CONNECTION, "No internet connection"),
                labels.getLabel(Labels.FARMERCHAT_NEEDS_THE_INTERNET, "FarmerChat needs \nthe internet"),
                labels.getLabel(Labels.CHECK_MOBILE_DATA_WIFI_SIGNAL, "Check mobile data or Wi-Fi signal")
            )
            LocationErrorType.GpsUnavailable -> Triple(
                labels.getLabel(Labels.TURN_ON_GPS, "Turn on GPS"),
                labels.getLabel(Labels.GET_LOCAL_ADVICE, "Get local advice"),
                labels.getLabel(
                    Labels.LOCATION_GPS_TURNED_OFF_TURNING_HELPS,
                    "Location and GPS are turned off. Turning this on helps us tailor answers to your area."
                )
            )
            LocationErrorType.LocationFailed -> Triple(
                labels.getLabel(Labels.SOMETHING_WENT_WRONG, "Something went wrong"),
                labels.getLabel(Labels.COULDNT_GET_YOUR_LOCATION, "Couldn't get your location"),
                labels.getLabel(Labels.PLEASE_TRY_AGAIN, "Please try again.")
            )
        }
        val view = FullScreenMessageView(activity)
        view.bind(
            title = title,
            mainMessage = main,
            subtitle = subtitle,
            primaryCtaLabel = labels.getLabel(Labels.TRY_AGAIN, "Try again"),
            primaryButtonState = PrimaryButtonView.State.DEFAULT,
            onPrimaryCta = { manager.onErrorRetry() },
            illustrationAsset = FarmerIllustrations.LOOKING_AT_SKY,
            leftIconRes = R.drawable.fc_ic_close,
            onLeftClick = { manager.dismiss() },
            rightLabel = labels.getLabel(Labels.SKIP, "Skip"),
            onRightClick = { manager.onSkipClicked() }
        )
        container.removeAllViews()
        container.addView(view)
        container.isVisible = true
    }

    private fun showRecoverySheet() {
        if (recoverySheet?.isShowing == true) return
        val binding = FcSheetLocationRecoveryBinding.inflate(LayoutInflater.from(activity))
        binding.fcRecoveryTitle.text =
            labels.getLabel(Labels.WE_NEED_YOUR_LOCATION, "We need your location")
        binding.fcRecoverySubtitle.text = labels.getLabel(
            Labels.LOCATION_TAILOR_ADVICE,
            "Sharing your location helps FarmerChat tailor advice to your farm."
        )
        binding.fcRecoveryButton.text =
            labels.getLabel(Labels.TURN_ON_IN_SETTINGS, "Turn on in settings")
        binding.fcRecoveryButton.setOnClickListener {
            runCatching {
                activity.startActivity(
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.fromParts("package", activity.packageName, null)
                    }
                )
            }
        }
        binding.fcRecoveryClose.setOnClickListener {
            manager.onSkipClicked()
            dismissRecoverySheet()
        }
        recoverySheet = BottomSheetDialog(activity).apply {
            setContentView(binding.root)
            setOnCancelListener { manager.onSkipClicked() }
            show()
        }
    }

    private fun dismissRecoverySheet() {
        recoverySheet?.setOnCancelListener(null)
        runCatching { recoverySheet?.dismiss() }
        recoverySheet = null
    }

    // ------------------------------------------------------------------ platform work

    private fun checkGpsSettings() {
        runCatching {
            val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10_000L).build()
            val settingsRequest = LocationSettingsRequest.Builder()
                .addLocationRequest(request)
                .build()
            LocationServices.getSettingsClient(activity)
                .checkLocationSettings(settingsRequest)
                .addOnSuccessListener { manager.onGpsAlreadyEnabled() }
                .addOnFailureListener { e ->
                    if (e is ResolvableApiException) {
                        runCatching {
                            gpsResolutionLauncher.launch(
                                IntentSenderRequest.Builder(e.resolution).build()
                            )
                        }.onFailure { manager.onGpsAlreadyEnabled() }
                    } else {
                        manager.onGpsAlreadyEnabled()
                    }
                }
        }.onFailure {
            // Play Services absent — proceed as if GPS is enabled; fetch will fall back.
            manager.onGpsAlreadyEnabled()
        }
    }

    @Suppress("MissingPermission")
    private fun fetchLocation() {
        if (!NetworkUtils.isOnline(activity)) {
            manager.onNoNetwork()
            return
        }
        if (!hasLocationPermission()) {
            manager.onLocationFetchFailed(timeout = false)
            return
        }
        fetchJob?.cancel()
        fetchJob = lifecycleOwner.lifecycleScope.launch {
            val result = runCatching {
                val client = LocationServices.getFusedLocationProviderClient(activity)
                val cts = CancellationTokenSource()
                var location: android.location.Location? = null
                var completed = false
                client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.token)
                    .addOnSuccessListener { location = it; completed = true }
                    .addOnFailureListener { completed = true }
                // 10 s timeout on the fresh fix.
                var waited = 0L
                while (!completed && waited < 10_000L) {
                    delay(100L)
                    waited += 100L
                }
                if (!completed) cts.cancel()
                if (location == null) {
                    // Fallback: last known location (2 s budget).
                    var lastCompleted = false
                    client.lastLocation
                        .addOnSuccessListener { location = it; lastCompleted = true }
                        .addOnFailureListener { lastCompleted = true }
                    var lastWaited = 0L
                    while (!lastCompleted && lastWaited < 2_000L) {
                        delay(100L)
                        lastWaited += 100L
                    }
                }
                location
            }.getOrNull()

            when {
                result != null -> manager.onLocationFetched(result.latitude, result.longitude)
                else -> manager.onLocationFetchFailed(timeout = true)
            }
        }
    }
}
