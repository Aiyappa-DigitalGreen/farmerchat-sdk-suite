package org.digitalgreen.farmerchat.sdk.core.ui.location

import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.FarmerChatAnalytics
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

    private val _events = Channel<LocationPromptEvent>(capacity = Channel.BUFFERED)
    val events = _events.receiveAsFlow()

    /** Navigation the caller wants to perform after the flow completes (weather → chat). */
    var pendingNavigation: (() -> Unit)? = null

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
        pendingNavigation = pendingNav
        analytics.track(
            AnalyticsEvents.LOCATION_UPDATE_TRIGGERED,
            mapOf(AnalyticsProps.TRIGGER to "weather")
        )
        _state.value = LocationPromptState.Interstitial(LocationTriggerSource.Weather)
    }

    fun triggerFromCampaign(config: LocationCampaignConfig) {
        analytics.track(
            AnalyticsEvents.LOCATION_UPDATE_TRIGGERED,
            mapOf(AnalyticsProps.TRIGGER to (config.triggerSource ?: "campaign"))
        )
        _state.value = if (config.skipInterstitial) {
            LocationPromptState.RequestPermission(LocationTriggerSource.Campaign, config)
        } else {
            LocationPromptState.Interstitial(LocationTriggerSource.Campaign, config)
        }
    }

    fun triggerFromLocalContext() {
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
        analytics.track(AnalyticsEvents.LOCATION_PERMISSION_PROMPT_TRIGGERED)
        _state.value = LocationPromptState.RequestPermission(LocationTriggerSource.Settings, null)
    }

    // ------------------------------------------------------------------ interstitial actions

    /** Interstitial "Turn location on now" / Recovery "Turn on in settings". */
    fun onShareClicked() {
        analytics.track(AnalyticsEvents.LOCATION_PERMISSION_PROMPT_TRIGGERED)
        _state.value = LocationPromptState.RequestPermission(currentSource(), currentCampaign())
    }

    /** Interstitial "Continue without location" / back. */
    fun onSkipClicked() {
        val source = currentSource()
        val campaign = currentCampaign()
        _state.value = LocationPromptState.Idle
        scope.launch {
            _events.send(LocationPromptEvent.Cancel(source, campaign))
        }
        // Weather flow: continue navigation without location.
        pendingNavigation?.invoke()
        pendingNavigation = null
    }

    fun dismiss() {
        _state.value = LocationPromptState.Idle
        pendingNavigation = null
    }

    // ------------------------------------------------------------------ host callbacks

    fun onPermissionResult(granted: Boolean, canAskAgain: Boolean = true) {
        val source = currentSource()
        val campaign = currentCampaign()
        if (granted) {
            analytics.track(AnalyticsEvents.LOCATION_PERMISSION_ALLOW)
            prefs.putBoolean(SdkPreferences.Keys.GPS_PERMISSION_SHOULD_ASK, false)
            _state.value = LocationPromptState.RequestEnableGps(source, campaign)
        } else {
            analytics.track(AnalyticsEvents.LOCATION_PERMISSION_DENY)
            prefs.putBoolean(SdkPreferences.Keys.GPS_PERMISSION_SHOULD_ASK, true)
            _state.value = if (!canAskAgain) {
                // Permanently denied → recovery sheet ("Turn on in settings").
                LocationPromptState.Recovery(source, campaign)
            } else {
                LocationPromptState.Idle
            }
            if (_state.value is LocationPromptState.Idle) {
                scope.launch { _events.send(LocationPromptEvent.Cancel(source, campaign)) }
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

    fun onGpsEnableResult(enabled: Boolean) {
        val source = currentSource()
        val campaign = currentCampaign()
        _state.value = if (enabled) {
            LocationPromptState.FetchingLocation(source, campaign)
        } else {
            LocationPromptState.Error(LocationErrorType.GpsUnavailable, source, campaign)
        }
    }

    /** GPS already enabled — skip the resolution dialog. */
    fun onGpsAlreadyEnabled() {
        _state.value = LocationPromptState.FetchingLocation(currentSource(), currentCampaign())
    }

    fun onLocationFetchFailed(timeout: Boolean) {
        analytics.track(
            if (timeout) AnalyticsEvents.LOCATION_FETCH_FAILED_TIMEOUT
            else AnalyticsEvents.LOCATION_FETCH_FAILED
        )
        val s = _state.value
        if (s is LocationPromptState.FetchingLocation && s.attempt < 1) {
            // 1 retry before last-known fallback / error.
            _state.value = s.copy(attempt = s.attempt + 1)
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
        _state.value = when (s.type) {
            LocationErrorType.NoNetwork -> LocationPromptState.FetchingLocation(s.source, s.campaign)
            LocationErrorType.GpsUnavailable -> LocationPromptState.RequestEnableGps(s.source, s.campaign)
            LocationErrorType.LocationFailed -> LocationPromptState.FetchingLocation(s.source, s.campaign)
        }
    }

    fun onLocationFetched(lat: Double, lng: Double) {
        analytics.track(AnalyticsEvents.LOCATION_FETCH_SUCCESS)
        val source = currentSource()
        val campaign = currentCampaign()

        prefs.putString(SdkPreferences.Keys.FARMER_APP_LATITUDE, lat.toString())
        prefs.putString(SdkPreferences.Keys.FARMER_APP_LONGITUDE, lng.toString())
        prefs.putBoolean(SdkPreferences.Keys.GPS_LOCATION_SHARED, true)
        prefs.putBoolean(SdkPreferences.Keys.LOCATION_DONE, true)

        val userId = prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "")
        scope.launch {
            if (userId.isNotBlank()) {
                when (val result = updateUserLocationUseCase.updateUserLocation(
                    UpdateLocationRequest(
                        lat = lat.toString(),
                        long = lng.toString(),
                        user_id = userId
                    )
                ).first()) {
                    is ApiResult.Success -> {
                        analytics.track(AnalyticsEvents.LOCATION_UPDATE_SUCCESS)
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
                        analytics.track(AnalyticsEvents.LOCATION_UPDATE_FAILURE)
                        // Location is still saved locally; flow continues.
                    }
                }
            }

            _state.value = LocationPromptState.Idle
            if (source == LocationTriggerSource.Campaign) {
                _events.send(LocationPromptEvent.LocationUpdatedFromWidget(campaign))
            }
            _events.send(LocationPromptEvent.Continue(source, campaign, reason = "location_fetched"))
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
