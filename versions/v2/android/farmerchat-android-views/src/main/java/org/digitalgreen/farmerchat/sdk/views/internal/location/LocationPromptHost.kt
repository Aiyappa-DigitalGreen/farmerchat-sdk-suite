package org.digitalgreen.farmerchat.sdk.views.internal.location

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.Uri
import android.provider.Settings
import android.view.LayoutInflater
import android.widget.FrameLayout
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
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
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import org.digitalgreen.farmerchat.sdk.core.labels.LabelManager
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationErrorType
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptManager
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptState
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationTriggerSource
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcSheetLocationRecoveryBinding
import org.digitalgreen.farmerchat.sdk.views.internal.util.FarmerIllustrations
import org.digitalgreen.farmerchat.sdk.views.internal.util.loadFarmerIllustration
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.FullScreenMessageView
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.PrimaryButtonView
import kotlin.coroutines.resume

/**
 * View-based global GPS prompt overlay (doc 01 §3.15) — the Views port of the app's
 * `ui/location/LocationPromptHost.kt`, kept step-for-step with the Compose host. Renders per
 * [LocationPromptManager.state] and reports platform results back into the manager. All Play
 * Services calls are wrapped in runCatching — absence never crashes.
 *
 * Only the WEATHER entry shows the full-screen interstitial; the Home pill, the chat gps-prompt
 * chip, Settings and campaigns go straight to the system dialogs over the current screen.
 */
internal class LocationPromptHost(
    private val activity: FragmentActivity,
    private val container: FrameLayout,
    private val lifecycleOwner: LifecycleOwner,
    private val manager: LocationPromptManager,
    private val labels: LabelManager
) {

    private val permissionLauncher: ActivityResultLauncher<String>
    private val gpsResolutionLauncher: ActivityResultLauncher<IntentSenderRequest>

    private var recoverySheet: BottomSheetDialog? = null
    private var lastHandledState: LocationPromptState? = null
    private var fetchJob: Job? = null

    init {
        val registry = activity.activityResultRegistry
        // FINE only, as the app requests: "Approximate" counts as a deny.
        permissionLauncher = registry.register(
            "fc_sdk_location_permission", lifecycleOwner,
            ActivityResultContracts.RequestPermission()
        ) { granted -> manager.onPermissionResult(granted) }
        // The app re-reads the providers instead of trusting resultCode.
        gpsResolutionLauncher = registry.register(
            "fc_sdk_gps_resolution", lifecycleOwner,
            ActivityResultContracts.StartIntentSenderForResult()
        ) { _ -> manager.onGpsEnableResult(isGpsOn(activity)) }

        lifecycleOwner.lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onResume(owner: LifecycleOwner) {
                manager.onResumedWithPermission(hasFinePermission())
            }
        })

        lifecycleOwner.lifecycleScope.launch {
            lifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                manager.state.collect { state -> render(state) }
            }
        }
    }

    private fun hasFinePermission(): Boolean =
        ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    private fun render(state: LocationPromptState) {
        // States are data classes, so identity (not equality) tells a fresh entry apart from a
        // re-collection of the same one after a STOP/START — side effects run once per entry.
        val isNew = state !== lastHandledState
        lastHandledState = state
        if (state !is LocationPromptState.Recovery) dismissRecoverySheet()

        when (state) {
            is LocationPromptState.Idle -> {
                fetchJob?.cancel()
                hideOverlay()
            }

            is LocationPromptState.Interstitial -> showInterstitial(
                ctaLabel = labels.getLabel(Labels.SHARE_LOCATION, "Share Location"),
                busy = false,
                interactive = true
            )

            is LocationPromptState.RequestPermission -> {
                showBusyOverlayIfWeather(state.source, fetching = false)
                if (isNew) {
                    runCatching { permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION) }
                        .onFailure { manager.onPermissionResult(granted = false) }
                }
            }

            is LocationPromptState.RequestEnableGps -> {
                showBusyOverlayIfWeather(state.source, fetching = false)
                if (isNew) checkGpsSettings()
            }

            is LocationPromptState.FetchingLocation -> {
                showBusyOverlayIfWeather(state.source, fetching = true)
                if (isNew) fetchLocation(state.attempt)
            }

            is LocationPromptState.Recovery -> {
                if (state.source == LocationTriggerSource.Weather) {
                    // Weather: the sheet sits on top of the (inert) interstitial.
                    showInterstitial(
                        ctaLabel = labels.getLabel(Labels.SHARE_LOCATION, "Share Location"),
                        busy = false,
                        interactive = false
                    )
                } else {
                    hideOverlay()
                }
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

    /**
     * Weather keeps the interstitial up — back/skip hidden — so the system dialogs appear on top
     * of it. Every other entry shows no UI: the dialogs appear over the current screen.
     */
    private fun showBusyOverlayIfWeather(source: LocationTriggerSource, fetching: Boolean) {
        if (source != LocationTriggerSource.Weather) {
            hideOverlay()
            return
        }
        showInterstitial(
            ctaLabel = if (fetching) {
                labels.getLabel(Labels.GETTING_YOUR_LOCATION, "Getting your location...")
            } else {
                labels.getLabel(Labels.SHARE_LOCATION, "Share Location")
            },
            busy = fetching,
            interactive = false
        )
    }

    private fun showInterstitial(ctaLabel: String, busy: Boolean, interactive: Boolean) {
        val view = FullScreenMessageView(activity)
        view.bind(
            title = labels.getLabel(Labels.SHARE_LOCATION, "Share Location"),
            mainMessage = labels.getLabel(Labels.GET_ADVICE_YOUR_AREA, "Get advice for your area"),
            subtitle = labels.getLabel(
                Labels.LOCATION_HELPS_SUGGESTIONS,
                "Your location helps us suggest crops, weather, and pests near you."
            ),
            primaryCtaLabel = ctaLabel,
            primaryButtonState = if (busy) PrimaryButtonView.State.LOADING else PrimaryButtonView.State.CHEVRON,
            onPrimaryCta = if (interactive) ({ manager.onInterstitialCtaClicked() }) else ({ }),
            illustrationAsset = FarmerIllustrations.LOOKING_AT_PHONE,
            leftIconRes = if (interactive) R.drawable.fc_ic_back else null,
            onLeftClick = if (interactive) ({ manager.cancel() }) else null,
            rightLabel = if (interactive) labels.getLabel(Labels.SKIP, "Skip") else null,
            onRightClick = if (interactive) ({ manager.continueWithoutLocation(reason = "skip") }) else null
        )
        showInOverlay(view)
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
        // App: error screens have their own title and NO back/skip; the CTA retries when the error
        // is retryable and otherwise closes the flow (GPS declined can't be fixed in-app).
        view.bind(
            title = title,
            mainMessage = main,
            subtitle = subtitle,
            primaryCtaLabel = labels.getLabel(Labels.TRY_AGAIN, "Try again"),
            primaryButtonState = PrimaryButtonView.State.DEFAULT,
            onPrimaryCta = { manager.onErrorCta() },
            illustrationAsset = if (type == LocationErrorType.NoNetwork) {
                FarmerIllustrations.LOOKING_AT_SKY
            } else {
                FarmerIllustrations.LOOKING_AT_PHONE
            },
            leftIconRes = null,
            onLeftClick = null,
            rightLabel = null,
            onRightClick = null
        )
        showInOverlay(view)
    }

    /**
     * The overlay view is added long after the window dispatched its insets, so its
     * `fitsSystemWindows` never saw them and the bar/CTA ran under the status and nav bars. Ask
     * for a fresh dispatch once it is attached.
     */
    private fun showInOverlay(view: FullScreenMessageView) {
        container.removeAllViews()
        container.addView(view)
        container.isVisible = true
        ViewCompat.requestApplyInsets(container)
    }

    private fun showRecoverySheet() {
        if (recoverySheet?.isShowing == true) return
        val binding = FcSheetLocationRecoveryBinding.inflate(LayoutInflater.from(activity))
        binding.fcRecoveryImage.clipToOutline = true
        binding.fcRecoveryImage.loadFarmerIllustration(FarmerIllustrations.LOOKING_AT_PHONE_SQUARE)
        binding.fcRecoveryClose.contentDescription = labels.getLabel(Labels.CLOSE, "Close")
        binding.fcRecoveryTitle.text =
            labels.getLabel(Labels.WE_NEED_YOUR_LOCATION, "We need your location")
        binding.fcRecoverySubtitle.text = labels.getLabel(
            Labels.LOCATION_TAILOR_ADVICE,
            "Sharing your location helps FarmerChat tailor advice to your farm."
        )
        binding.fcRecoveryButton.text =
            labels.getLabel(Labels.TURN_ON_IN_SETTINGS, "Turn on in settings")
        binding.fcRecoveryButton.state = PrimaryButtonView.State.CHEVRON
        binding.fcRecoveryButton.setOnClickListener {
            manager.trackRecoverySettingsClicked()
            runCatching {
                activity.startActivity(
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.fromParts("package", activity.packageName, null)
                    }
                )
            }
        }
        binding.fcRecoveryClose.setOnClickListener {
            dismissRecoverySheet()
            manager.trackRecoveryCanceled()
            manager.continueWithoutLocation(reason = "recovery_closed")
        }
        recoverySheet = BottomSheetDialog(activity).apply {
            setContentView(binding.root)
            // App: skipPartiallyExpanded, no drag handle; the sheet draws its own rounded surface.
            behavior.state = BottomSheetBehavior.STATE_EXPANDED
            behavior.skipCollapsed = true
            (binding.root.parent as? android.view.View)?.setBackgroundColor(android.graphics.Color.TRANSPARENT)
            setOnCancelListener {
                manager.trackRecoveryCanceled()
                manager.continueWithoutLocation(reason = "recovery_dismissed")
            }
            show()
        }
    }

    private fun dismissRecoverySheet() {
        recoverySheet?.setOnCancelListener(null)
        runCatching { recoverySheet?.dismiss() }
        recoverySheet = null
    }

    // ------------------------------------------------------------------ platform work

    /**
     * Always asks SettingsClient (with `setAlwaysShow(true)`, as the app does — without it Play
     * Services may not re-show the dialog once declined). Anything that is not a resolvable
     * "turn it on" request is reported as GPS unavailable, never as enabled.
     */
    private fun checkGpsSettings() {
        runCatching {
            val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10_000L).build()
            val settingsRequest = LocationSettingsRequest.Builder()
                .addLocationRequest(request)
                .setAlwaysShow(true)
                .build()
            LocationServices.getSettingsClient(activity)
                .checkLocationSettings(settingsRequest)
                .addOnSuccessListener { manager.onGpsEnableResult(true) }
                .addOnFailureListener { e ->
                    if (e is ResolvableApiException) {
                        runCatching {
                            gpsResolutionLauncher.launch(IntentSenderRequest.Builder(e.resolution).build())
                        }.onFailure { manager.onGpsEnableResult(false) }
                    } else {
                        manager.onGpsEnableResult(false)
                    }
                }
        }.onFailure {
            // Play Services absent — proceed only if the platform GPS is on.
            manager.onGpsEnableResult(isGpsOn(activity))
        }
    }

    /** Fresh fix (10 s); after the retry, the last known fix (2 s), as the app does. */
    private fun fetchLocation(attempt: Int) {
        fetchJob?.cancel()
        fetchJob = lifecycleOwner.lifecycleScope.launch {
            val fix = freshLocation() ?: if (attempt >= 1) lastKnownLocation() else null
            if (fix != null) manager.onLocationFetched(fix.first, fix.second)
            else manager.onLocationFetchFailed(timeout = true)
        }
    }

    @Suppress("MissingPermission")
    private suspend fun freshLocation(): Pair<Double, Double>? = withTimeoutOrNull(10_000L) {
        suspendCancellableCoroutine<Pair<Double, Double>?> { cont ->
            val done = java.util.concurrent.atomic.AtomicBoolean(false)
            fun resumeOnce(v: Pair<Double, Double>?) {
                if (done.compareAndSet(false, true) && cont.isActive) cont.resume(v)
            }
            runCatching {
                val cts = CancellationTokenSource()
                LocationServices.getFusedLocationProviderClient(activity)
                    .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.token)
                    .addOnSuccessListener { resumeOnce(it?.let { l -> l.latitude to l.longitude }) }
                    .addOnFailureListener { resumeOnce(null) }
                cont.invokeOnCancellation { runCatching { cts.cancel() } }
            }.onFailure { resumeOnce(null) }
        }
    }

    @Suppress("MissingPermission")
    private suspend fun lastKnownLocation(): Pair<Double, Double>? = withTimeoutOrNull(2_000L) {
        suspendCancellableCoroutine<Pair<Double, Double>?> { cont ->
            val done = java.util.concurrent.atomic.AtomicBoolean(false)
            fun resumeOnce(v: Pair<Double, Double>?) {
                if (done.compareAndSet(false, true) && cont.isActive) cont.resume(v)
            }
            runCatching {
                LocationServices.getFusedLocationProviderClient(activity).lastLocation
                    .addOnSuccessListener { resumeOnce(it?.let { l -> l.latitude to l.longitude }) }
                    .addOnFailureListener { resumeOnce(null) }
            }.onFailure { resumeOnce(null) }
        }
    }

    private fun isGpsOn(context: Context): Boolean = runCatching {
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ||
            lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
    }.getOrDefault(false)
}
