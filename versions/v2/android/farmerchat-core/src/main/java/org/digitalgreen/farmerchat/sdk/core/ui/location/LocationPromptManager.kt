package org.digitalgreen.farmerchat.sdk.core.ui.location

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.FarmerChatAnalytics
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsApis
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.base.ApiResult
import org.digitalgreen.farmerchat.sdk.core.model.UpdateLocationRequest
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.CoreViewModel
import org.digitalgreen.farmerchat.sdk.core.usecase.UpdateUserLocationUseCase

/**
 * Global GPS/location prompt state machine (port of the app's LocationPromptManager,
 * doc 01 §3.15). The UI host renders per state and reports platform results back:
 *
 * Idle → Interstitial → RequestPermission → RequestEnableGps → FetchingLocation
 *      → (success → Idle + Continue) | Recovery | Error(type)
 *
 * The host owns the actual permission launcher, SettingsClient resolution and
 * fused-location fetch (10 s, 1 retry → last-known fallback), calling back into
 * [onPermissionResult] / [onGpsEnableResult] / [onLocationFetched] /
 * [onLocationFetchFailed].
 */
class LocationPromptManager(
    private val prefs: SdkPreferences,
    private val updateUserLocationUseCase: UpdateUserLocationUseCase,
    private val analytics: FarmerChatAnalytics
) : CoreViewModel() {

    private val _state = MutableStateFlow<LocationPromptState>(LocationPromptState.Idle)
    val state: StateFlow<LocationPromptState> = _state

    /**
     * Outcome events, BROADCAST to every collector.
     *
     * This was a `Channel(BUFFERED).receiveAsFlow()`, which delivers each event to exactly ONE
     * collector. There are already two long-lived collectors — `FarmerChatRoot` (widget toast) and
     * `HomeScreen` (feed reload) — so a location update raced: whichever won consumed the event and
     * the other never saw it, giving a toast with no reload or a reload with no toast, at random.
     * The chat GPS_PROMPT flow adds a third collector, which would have made it worse.
     *
     * The app uses `replay = 1`; the SDK deliberately uses `replay = 0`. Every SDK collector is
     * subscribed before the flow it cares about can emit, and a replayed stale event would make
     * `HomeScreen` reload its feed on every recomposition.
     */
    private val _events = MutableSharedFlow<LocationPromptEvent>(
        replay = 0,
        extraBufferCapacity = 16
    )
    val events: SharedFlow<LocationPromptEvent> = _events.asSharedFlow()

    /** Navigation the caller wants to perform after the flow completes (weather → chat). */
    var pendingNavigation: (() -> Unit)? = null

    // ------------------------------------------------------------------ GPS analytics
    //
    // Port of the app's `LocationPromptHost.trackGpsEvent` / `triggerLabel`
    // (app ui/location/LocationPromptHost.kt:133-201). EVERY GPS event carries
    // `screen_name` = "GPS Screen" plus the `Trigger` label, and `Attempt` where the
    // app supplies one.

    /**
     * True while the ACTIVE location flow was raised by the chat `gps-prompt` chip. Port of the
     * app's `activeAgenticChip` (`core/location/LocationPromptManager.kt:58`): set by
     * [triggerFromLocalContext] and cleared by every other trigger, so it only ever describes the
     * flow currently running.
     */
    @Volatile
    private var agenticChipOrigin: Boolean = false

    /** True when the running flow came from the chat `gps-prompt` chip. */
    fun isAgenticChipOrigin(): Boolean = agenticChipOrigin

    /**
     * `{screen_name, Trigger}` (+ `Attempt`, + extras) — the app's trackGpsEvent payload,
     * defaulted to the current flow's source/campaign. See [gpsAnalyticsProps].
     *
     * When the flow was raised by the chat `gps-prompt` chip the whole GPS funnel is re-attributed
     * to Chat (`screen_name` = Chat, `Trigger` = "Chat Screen") and carries
     * `agentic_chip_type = gps-prompt`, exactly as the app does. The override is applied AFTER
     * [extra] on purpose: the fetch-phase `Location_Update_Triggered` passes `screen_name` = Home
     * as an extra, and the chip attribution has to win over it (app parity —
     * `LocationPromptManager.kt:438`).
     */
    private fun gpsProps(
        source: LocationTriggerSource = currentSource(),
        campaign: LocationCampaignConfig? = currentCampaign(),
        attempt: Int? = null,
        extra: Map<String, Any?> = emptyMap()
    ): Map<String, Any?> {
        val base = gpsAnalyticsProps(source, campaign, attempt, extra)
        if (!agenticChipOrigin) return base
        return base + mapOf(
            AnalyticsProps.SCREEN_NAME to AnalyticsScreens.CHAT,
            AnalyticsProps.TRIGGER to TRIGGER_CHAT_SCREEN,
            AnalyticsProps.AGENTIC_CHIP_TYPE to
                org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind.GPS_PROMPT.analyticsType
        )
    }

    private fun currentSource(): LocationTriggerSource = when (val s = _state.value) {
        is LocationPromptState.Interstitial -> s.source
        is LocationPromptState.Recovery -> s.source
        is LocationPromptState.RequestPermission -> s.source
        is LocationPromptState.RequestEnableGps -> s.source
        is LocationPromptState.FetchingLocation -> s.source
        is LocationPromptState.Error -> s.source
        else -> LocationTriggerSource.Weather
    }

    private fun currentCampaign(): LocationCampaignConfig? = when (val s = _state.value) {
        is LocationPromptState.Interstitial -> s.campaign
        is LocationPromptState.Recovery -> s.campaign
        is LocationPromptState.RequestPermission -> s.campaign
        is LocationPromptState.RequestEnableGps -> s.campaign
        is LocationPromptState.FetchingLocation -> s.campaign
        is LocationPromptState.Error -> s.campaign
        else -> null
    }

    fun hasStoredLocation(): Boolean =
        prefs.getString(SdkPreferences.Keys.FARMER_APP_LATITUDE, "").isNotBlank() &&
            prefs.getString(SdkPreferences.Keys.FARMER_APP_LONGITUDE, "").isNotBlank()

    // ------------------------------------------------------------------ triggers

    /** Weather chip tap without a known location: full interstitial flow. */
    fun triggerFromWeather(pendingNav: (() -> Unit)? = null) {
        agenticChipOrigin = false
        pendingNavigation = pendingNav
        _state.value = LocationPromptState.Interstitial(LocationTriggerSource.Weather)
    }

    fun triggerFromCampaign(config: LocationCampaignConfig) {
        agenticChipOrigin = false
        _state.value = if (config.skipInterstitial) {
            LocationPromptState.RequestPermission(LocationTriggerSource.Campaign, config)
        } else {
            LocationPromptState.Interstitial(LocationTriggerSource.Campaign, config)
        }
    }

    /**
     * @param fromAgenticChip true when raised by the chat `gps-prompt` "Share my location" chip, so
     * the whole GPS funnel is attributed to Chat (`screen_name` = Chat, `Trigger` = "Chat Screen",
     * `agentic_chip_type` = gps-prompt) instead of Home. Home's own location pill passes false
     * (the default). App parity: `LocationPromptManager.triggerFromLocalContext(fromAgenticChip)`.
     */
    fun triggerFromLocalContext(fromAgenticChip: Boolean = false) {
        agenticChipOrigin = fromAgenticChip
        _state.value = LocationPromptState.Interstitial(LocationTriggerSource.LocalContext)
    }

    /**
     * 2.0.0: the Settings "My Farm" row.
     *
     * Goes straight to the permission request rather than through the interstitial: the farmer
     * has already navigated to Settings and tapped a location row, so the interstitial would be
     * asking them to opt into something they just explicitly chose.
     */
    fun triggerFromSettings() {
        agenticChipOrigin = false
        trackPermissionPromptShown(LocationTriggerSource.Settings, null)
        _state.value = LocationPromptState.RequestPermission(LocationTriggerSource.Settings, null)
    }

    /**
     * `Permission_popup_shown` + `location_permission_prompt_triggered`, both stamped with
     * the NEXT attempt number (app LocationPromptHost.kt:370-390).
     */
    private fun trackPermissionPromptShown(
        source: LocationTriggerSource,
        campaign: LocationCampaignConfig?
    ) {
        val nextAttempt = prefs.getInt(SdkPreferences.Keys.PERMISSION_DENY_COUNT, 0) + 1
        analytics.track(
            AnalyticsEvents.PERMISSION_POPUP_SHOWN,
            gpsProps(
                source, campaign, nextAttempt,
                mapOf(AnalyticsProps.PERMISSION_TYPE to "Location")
            )
        )
        analytics.track(
            AnalyticsEvents.LOCATION_PERMISSION_PROMPT_TRIGGERED,
            gpsProps(source, campaign, nextAttempt)
        )
    }

    // ------------------------------------------------------------------ interstitial actions

    /** Interstitial "Turn location on now" / Recovery "Turn on in settings". */
    fun onShareClicked() {
        trackPermissionPromptShown(currentSource(), currentCampaign())
        _state.value = LocationPromptState.RequestPermission(currentSource(), currentCampaign())
    }

    /** Interstitial "Continue without location" / back. */
    fun onSkipClicked() {
        val source = currentSource()
        val campaign = currentCampaign()
        _state.value = LocationPromptState.Idle
        scope.launch {
            _events.emit(LocationPromptEvent.Cancel(source, campaign))
        }
        // Weather flow: continue navigation without location.
        pendingNavigation?.invoke()
        pendingNavigation = null
    }

    fun dismiss() {
        // Capture before clearing: currentSource() derives from _state and falls back to Weather
        // once the state is Idle.
        val wasActive = _state.value !is LocationPromptState.Idle
        val source = currentSource()
        val campaign = currentCampaign()
        _state.value = LocationPromptState.Idle
        pendingNavigation = null
        // Every terminal exit MUST emit, or a collector armed for this flow waits forever. The
        // error branch has no other exit: onLocationFetchFailed / onNoNetwork /
        // onGpsEnableResult(false) all park in State.Error and dismiss() is how the user leaves
        // it. "dismissed" is deliberately NOT one of the success reasons, so the chat gps-prompt
        // settles into its decline query and the blocking question still gets answered.
        // App parity: `dismiss(emitContinue = true)` emits Continue(reason = "dismissed").
        // onLocationFetched already sets Idle before emitting, so a dismiss following a success
        // sees wasActive = false and does not emit a second, contradictory event.
        if (wasActive) {
            scope.launch {
                _events.emit(LocationPromptEvent.Continue(source, campaign, reason = "dismissed"))
            }
        }
    }

    // ------------------------------------------------------------------ host callbacks

    fun onPermissionResult(granted: Boolean, canAskAgain: Boolean = true) {
        val source = currentSource()
        val campaign = currentCampaign()
        if (granted) {
            // App LocationPromptHost.kt:232/241 — Attempt is always 1 on success, and
            // Permission_granted additionally carries Permission_type.
            analytics.track(
                AnalyticsEvents.PERMISSION_GRANTED,
                gpsProps(source, campaign, 1, mapOf(AnalyticsProps.PERMISSION_TYPE to "Location"))
            )
            analytics.track(
                AnalyticsEvents.LOCATION_PERMISSION_ALLOW,
                gpsProps(source, campaign, 1)
            )
            prefs.putBoolean(SdkPreferences.Keys.GPS_PERMISSION_SHOULD_ASK, false)
            prefs.putInt(SdkPreferences.Keys.PERMISSION_DENY_COUNT, 0)
            _state.value = LocationPromptState.RequestEnableGps(source, campaign)
        } else {
            // App LocationPromptHost.kt:254/263 — Attempt is the NEXT deny count.
            val nextAttempt = prefs.getInt(SdkPreferences.Keys.PERMISSION_DENY_COUNT, 0) + 1
            prefs.putInt(SdkPreferences.Keys.PERMISSION_DENY_COUNT, nextAttempt)
            analytics.track(
                AnalyticsEvents.PERMISSION_DENIED,
                gpsProps(
                    source, campaign, nextAttempt,
                    mapOf(AnalyticsProps.PERMISSION_TYPE to "Location")
                )
            )
            analytics.track(
                AnalyticsEvents.LOCATION_PERMISSION_DENY,
                gpsProps(source, campaign, nextAttempt)
            )
            prefs.putBoolean(SdkPreferences.Keys.GPS_PERMISSION_SHOULD_ASK, true)
            _state.value = if (!canAskAgain) {
                // App LocationPromptHost.kt:411 — the recovery sheet is the permission
                // fallback surface.
                analytics.track(
                    AnalyticsEvents.PERMISSION_FALLBACK_SETTING_SHOWN,
                    gpsProps(
                        source, campaign, nextAttempt,
                        mapOf(AnalyticsProps.PERMISSION_TYPE to "Location")
                    )
                )
                // Permanently denied → recovery sheet ("Turn on in settings").
                LocationPromptState.Recovery(source, campaign)
            } else {
                LocationPromptState.Idle
            }
            if (_state.value is LocationPromptState.Idle) {
                scope.launch { _events.emit(LocationPromptEvent.Cancel(source, campaign)) }
                pendingNavigation?.invoke()
                pendingNavigation = null
            }
        }
    }

    /** Re-check on ON_RESUME while in Recovery (user may have granted from settings). */
    fun onResumedWithPermission(granted: Boolean) {
        if (_state.value is LocationPromptState.Recovery && granted) {
            _state.value = LocationPromptState.RequestEnableGps(currentSource(), currentCampaign())
        }
    }

    /**
     * Enters `FetchingLocation` and emits the app's fetch-phase pair, once per attempt
     * (app LocationPromptHost.kt:435-462): `Location_Update_Triggered` — whose `screen_name`
     * the app OVERRIDES to the Dashboard screen rather than the GPS screen — followed by
     * `API_Call_Initiated` for "GPS Fetch fresh location".
     */
    private fun enterFetchingLocation(
        source: LocationTriggerSource,
        campaign: LocationCampaignConfig?,
        attempt: Int = 0
    ) {
        analytics.track(
            AnalyticsEvents.LOCATION_UPDATE_TRIGGERED,
            gpsProps(
                source, campaign, attempt + 1,
                mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME)
            )
        )
        analytics.trackApiInitiated(AnalyticsApis.GPS_FETCH_FRESH_LOCATION, AnalyticsScreens.GPS)
        _state.value = LocationPromptState.FetchingLocation(source, campaign, attempt)
    }

    fun onGpsEnableResult(enabled: Boolean) {
        val source = currentSource()
        val campaign = currentCampaign()
        if (enabled) {
            enterFetchingLocation(source, campaign)
            return
        }
        _state.value = LocationPromptState.Error(
            LocationErrorType.GpsUnavailable, source, campaign
        )
    }

    /** GPS already enabled — skip the resolution dialog. */
    fun onGpsAlreadyEnabled() {
        enterFetchingLocation(currentSource(), currentCampaign())
    }

    fun onLocationFetchFailed(timeout: Boolean) {
        // App LocationPromptHost.kt:626/660.
        analytics.track(
            if (timeout) AnalyticsEvents.LOCATION_FETCH_FAILED_TIMEOUT
            else AnalyticsEvents.LOCATION_FETCH_FAILED,
            gpsProps(attempt = ((_state.value as? LocationPromptState.FetchingLocation)?.attempt ?: 0) + 1)
        )
        // App LocationPromptHost.kt:627/661 — the fresh-location fetch is also tracked as an
        // API_Call_Timeout / API_Call_Failed with API_Name = "GPS Fetch fresh location".
        analytics.trackApiError(
            AnalyticsApis.GPS_FETCH_FRESH_LOCATION, AnalyticsScreens.GPS, timeout
        )
        val s = _state.value
        if (s is LocationPromptState.FetchingLocation && s.attempt < 1) {
            // 1 retry before last-known fallback / error. The app's fetch-phase effect re-runs
            // on the attempt change, so the retry re-emits the pair with Attempt = 2.
            enterFetchingLocation(s.source, s.campaign, s.attempt + 1)
            return
        }
        _state.value = LocationPromptState.Error(
            LocationErrorType.LocationFailed, currentSource(), currentCampaign()
        )
    }

    fun onNoNetwork() {
        _state.value = LocationPromptState.Error(
            LocationErrorType.NoNetwork, currentSource(), currentCampaign()
        )
    }

    fun onErrorRetry() {
        val s = _state.value as? LocationPromptState.Error ?: return
        when (s.type) {
            LocationErrorType.NoNetwork -> enterFetchingLocation(s.source, s.campaign)
            LocationErrorType.GpsUnavailable ->
                _state.value = LocationPromptState.RequestEnableGps(s.source, s.campaign)
            LocationErrorType.LocationFailed -> enterFetchingLocation(s.source, s.campaign)
        }
    }

    fun onLocationFetched(lat: Double, lng: Double) {
        // App LocationPromptHost.kt:486/487.
        analytics.track(AnalyticsEvents.LOCATION_FETCH_SUCCESS, gpsProps(attempt = 1))
        analytics.trackApiSuccess(AnalyticsApis.GPS_FETCH_FRESH_LOCATION, AnalyticsScreens.GPS)
        val source = currentSource()
        val campaign = currentCampaign()

        prefs.putString(SdkPreferences.Keys.FARMER_APP_LATITUDE, lat.toString())
        prefs.putString(SdkPreferences.Keys.FARMER_APP_LONGITUDE, lng.toString())
        prefs.putBoolean(SdkPreferences.Keys.GPS_LOCATION_SHARED, true)
        prefs.putBoolean(SdkPreferences.Keys.LOCATION_DONE, true)

        val userId = prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "")
        scope.launch {
            if (userId.isNotBlank()) {
                analytics.trackApiInitiated(
                    AnalyticsApis.UPDATE_USER_LOCATION, AnalyticsScreens.GPS
                )
                when (val result = updateUserLocationUseCase.updateUserLocation(
                    UpdateLocationRequest(
                        lat = lat.toString(),
                        long = lng.toString(),
                        user_id = userId
                    )
                ).first()) {
                    is ApiResult.Success -> {
                        // App LocationPromptHost.kt:521 — API_Name = "Update user location".
                        analytics.trackApiSuccess(
                            AnalyticsApis.UPDATE_USER_LOCATION, AnalyticsScreens.GPS
                        )
                        analytics.track(
                            AnalyticsEvents.LOCATION_UPDATE_SUCCESS,
                            gpsProps(source, campaign)
                        )
                        result.data.user_profile?.let { profile ->
                            profile.country_name?.let {
                                prefs.putString(SdkPreferences.Keys.USER_COUNTRY_NAME, it)
                            }
                            profile.country_code?.let {
                                prefs.putString(SdkPreferences.Keys.USER_COUNTRY_CODE, it)
                            }
                            profile.geography_level2_name?.let {
                                prefs.putString(SdkPreferences.Keys.USER_SELECTED_STATE_CODE, it)
                            }
                            profile.display_address?.let {
                                prefs.putString(SdkPreferences.Keys.APPROX_LOCATION_NAME, it)
                            }
                        }
                    }
                    is ApiResult.Error -> {
                        analytics.trackApiError(
                            AnalyticsApis.UPDATE_USER_LOCATION,
                            AnalyticsScreens.GPS,
                            result.isTimeout
                        )
                        analytics.track(
                            AnalyticsEvents.LOCATION_UPDATE_FAILURE,
                            gpsProps(source, campaign)
                        )
                        // Location is still saved locally; flow continues.
                    }
                }
            }

            _state.value = LocationPromptState.Idle
            if (source == LocationTriggerSource.Campaign) {
                _events.emit(LocationPromptEvent.LocationUpdatedFromWidget(campaign))
            }
            _events.emit(LocationPromptEvent.Continue(source, campaign, reason = "location_fetched"))
            pendingNavigation?.invoke()
            pendingNavigation = null
        }
    }

    /** Full reset (logout). */
    fun clearState() {
        _state.value = LocationPromptState.Idle
        pendingNavigation = null
    }
}

/**
 * `Trigger` values exactly as the app's analytics sheet defines them
 * (app ui/location/LocationPromptHost.kt:133-146). An unknown or absent campaign
 * `triggerSource` falls back to "Plotline Campaign", as the app's `else` branch does.
 */
/**
 * `Trigger` value when the GPS flow was raised by the chat `gps-prompt` chip. Copied from the app
 * (`LocationPromptManager.kt:439`), which uses this literal rather than a [gpsTriggerLabel] case —
 * the chip reuses `LocalContext` for BEHAVIOUR, so its trigger label cannot come from the source.
 */
private const val TRIGGER_CHAT_SCREEN = "Chat Screen"

fun gpsTriggerLabel(
    source: LocationTriggerSource,
    campaign: LocationCampaignConfig? = null
): String = when (source) {
    LocationTriggerSource.Weather -> "Weather Icon"
    LocationTriggerSource.LocalContext -> "Home Screen"
    LocationTriggerSource.Settings -> "Settings Screen"
    LocationTriggerSource.Campaign -> when (campaign?.triggerSource) {
        "moengage" -> "MoEngage Campaign"
        "plotline" -> "Plotline Campaign"
        else -> "Plotline Campaign"
    }
}

/**
 * Every GPS analytics event's base payload, a port of the app's `trackGpsEvent`
 * (app ui/location/LocationPromptHost.kt:169-201): `screen_name` is always the GPS screen
 * unless an [extra] overrides it (the fetch-phase `Location_Update_Triggered` does),
 * `Trigger` is the [gpsTriggerLabel], and `Attempt` appears only when supplied.
 */
fun gpsAnalyticsProps(
    source: LocationTriggerSource,
    campaign: LocationCampaignConfig? = null,
    attempt: Int? = null,
    extra: Map<String, Any?> = emptyMap()
): Map<String, Any?> = buildMap {
    put(AnalyticsProps.SCREEN_NAME, AnalyticsScreens.GPS)
    put(AnalyticsProps.TRIGGER, gpsTriggerLabel(source, campaign))
    attempt?.let { put(AnalyticsProps.ATTEMPT, it) }
    putAll(extra)
}
