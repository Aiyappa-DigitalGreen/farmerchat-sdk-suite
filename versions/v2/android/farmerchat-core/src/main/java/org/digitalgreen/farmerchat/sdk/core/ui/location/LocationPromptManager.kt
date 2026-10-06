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
 * Global GPS/location prompt state machine — a port of the app's
 * `core/location/LocationPromptManager.kt` (fc-compose-agentic), doc 01 §3.15.
 *
 * Every trigger runs the app's `trigger()` decision tree:
 *
 *  1. offline                                  → Error(NoNetwork)
 *  2. denied twice and still no FINE permission → Recovery ("We need your location" sheet)
 *  3. permission granted + a stored fix        → RequestEnableGps (no UI, straight to GPS/fetch)
 *  4. Weather, permission granted, no fix      → Interstitial
 *  5. Campaign, permission granted, no fix     → RequestEnableGps
 *  6. LocalContext / Settings / Campaign, or permission already granted
 *                                              → RequestPermission (system dialog, no interstitial)
 *  7. otherwise (Weather, first ask)           → Interstitial
 *
 * The UI host renders per state and reports platform results back through [onPermissionResult],
 * [onGpsEnableResult], [onLocationFetched] and [onLocationFetchFailed]. The host owns the
 * permission launcher, the SettingsClient resolution and the fused-location fetch.
 *
 * Before 2026-10-06 the SDK sent EVERY trigger through the interstitial, decided "permanently
 * denied" from `shouldShowRequestPermissionRationale` (false after merely tapping outside the
 * dialog), let the GPS-off error retry back into the same dialog forever, and showed an error
 * screen when the fix failed. All four diverged from the app.
 */
class LocationPromptManager(
    private val prefs: SdkPreferences,
    private val updateUserLocationUseCase: UpdateUserLocationUseCase,
    private val analytics: FarmerChatAnalytics,
    /** Live `ACCESS_FINE_LOCATION` check. The app checks FINE only, so "Approximate" is a deny. */
    private val hasFineLocationPermission: () -> Boolean = { false },
    /** Live connectivity check (the app's `NetworkUtils.isOnline`). */
    private val isOnline: () -> Boolean = { true }
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

    init {
        // App LocationPromptHost: Screen_Viewed on entering the interstitial, Screen_Exit on
        // leaving it, for "GPS Interstitial Screen". Done here so both flavours emit it identically.
        scope.launch {
            var previous: LocationPromptState? = null
            _state.collect { current ->
                val wasInterstitial = previous is LocationPromptState.Interstitial
                val isInterstitial = current is LocationPromptState.Interstitial
                if (wasInterstitial && !isInterstitial) analytics.trackScreenExit(AnalyticsScreens.GPS_INTERSTITIAL)
                if (isInterstitial && !wasInterstitial) analytics.trackScreenView(AnalyticsScreens.GPS_INTERSTITIAL)
                previous = current
            }
        }
    }

    /** The trigger that started the running flow (app `activeSource` / `activeCampaign`). */
    @Volatile private var activeSource: LocationTriggerSource? = null
    @Volatile private var activeCampaign: LocationCampaignConfig? = null

    /**
     * True while the ACTIVE location flow was raised by the chat `gps-prompt` chip. Port of the
     * app's `activeAgenticChip`: set by [triggerFromLocalContext] and cleared by every other
     * trigger, so it only ever describes the flow currently running.
     */
    @Volatile
    private var agenticChipOrigin: Boolean = false

    /** True when the running flow came from the chat `gps-prompt` chip. */
    fun isAgenticChipOrigin(): Boolean = agenticChipOrigin

    // ------------------------------------------------------------------ GPS analytics
    //
    // Port of the app's `LocationPromptHost.trackGpsEvent`. EVERY GPS event carries
    // `screen_name` = "GPS Screen" plus the `Trigger` label, and `Attempt` where the app supplies
    // one. When the flow was raised by the chat `gps-prompt` chip the whole funnel is
    // re-attributed to Chat (`screen_name` = Chat, `Trigger` = "Chat Screen",
    // `agentic_chip_type = gps-prompt`). The override is applied AFTER [extra] on purpose: the
    // fetch-phase `Location_Update_Triggered` passes `screen_name` = Home as an extra, and the
    // chip attribution has to win over it.

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
        else -> activeSource ?: LocationTriggerSource.Weather
    }

    private fun currentCampaign(): LocationCampaignConfig? = when (val s = _state.value) {
        is LocationPromptState.Interstitial -> s.campaign
        is LocationPromptState.Recovery -> s.campaign
        is LocationPromptState.RequestPermission -> s.campaign
        is LocationPromptState.RequestEnableGps -> s.campaign
        is LocationPromptState.FetchingLocation -> s.campaign
        is LocationPromptState.Error -> s.campaign
        else -> activeCampaign
    }

    // ------------------------------------------------------------------ queries

    /** App `isLocationEnabledOnce()`: a GPS fix has been saved. */
    fun hasStoredLocation(): Boolean =
        prefs.getString(SdkPreferences.Keys.FARMER_APP_LATITUDE, "").isNotBlank() &&
            prefs.getString(SdkPreferences.Keys.FARMER_APP_LONGITUDE, "").isNotBlank()

    /** Live FINE-permission check — the same one the decision tree uses. */
    fun hasCurrentLocationPermission(): Boolean = hasFineLocationPermission()

    /**
     * App `isBlockedByPermission()`: denied twice and still not granted. Unlike the transient
     * [LocationPromptState.Recovery] this stays true after the sheet is dismissed, until the
     * permission is actually granted (e.g. from system Settings).
     */
    fun isBlockedByPermission(): Boolean =
        prefs.getInt(SdkPreferences.Keys.PERMISSION_DENY_COUNT, 0) >= 2 && !hasFineLocationPermission()

    // ------------------------------------------------------------------ triggers

    /**
     * Weather chip tap. With a stored fix the app skips the GPS flow and navigates straight away;
     * otherwise the full flow runs and [pendingNav] fires when it ends (any outcome but [cancel]).
     */
    fun triggerFromWeather(pendingNav: (() -> Unit)? = null) {
        agenticChipOrigin = false
        pendingNavigation = pendingNav
        if (hasStoredLocation()) {
            executePendingNavigation()
            return
        }
        trigger(LocationTriggerSource.Weather, null)
    }

    fun triggerFromCampaign(config: LocationCampaignConfig) {
        agenticChipOrigin = false
        trigger(LocationTriggerSource.Campaign, config)
    }

    /**
     * Home location pill, or the chat `gps-prompt` "Share my location" chip.
     *
     * @param fromAgenticChip true when raised by the chat chip, so the whole GPS funnel is
     * attributed to Chat instead of Home. App parity:
     * `LocationPromptManager.triggerFromLocalContext(fromAgenticChip)`.
     */
    fun triggerFromLocalContext(fromAgenticChip: Boolean = false) {
        agenticChipOrigin = fromAgenticChip
        trigger(LocationTriggerSource.LocalContext, null)
    }

    /** Settings "My Farm" Location row. */
    fun triggerFromSettings() {
        agenticChipOrigin = false
        trigger(LocationTriggerSource.Settings, null)
    }

    /** The app's `trigger()` decision tree — see the class doc. */
    private fun trigger(source: LocationTriggerSource, campaign: LocationCampaignConfig?) {
        if (!isOnline()) {
            activeSource = source
            activeCampaign = campaign
            _state.value = LocationPromptState.Error(
                LocationErrorType.NoNetwork, source, campaign, canRetry = true
            )
            return
        }

        // Already enabled once: only the Weather entry no-ops. Campaign has its own gating, and a
        // manual tap on the pill / Settings row is an explicit request to refresh the location.
        val allowRetrigger = campaign?.allowRetrigger == true ||
            source == LocationTriggerSource.LocalContext ||
            source == LocationTriggerSource.Settings
        if (hasStoredLocation() && source != LocationTriggerSource.Campaign && !allowRetrigger) {
            executePendingNavigation()
            return
        }

        activeSource = source
        activeCampaign = campaign

        val denyCount = prefs.getInt(SdkPreferences.Keys.PERMISSION_DENY_COUNT, 0)
        val hasPermission = hasFineLocationPermission()
        // Denied twice and still not granted → the "We need your location" sheet, for every
        // source. Granted later from Settings → never blocked again.
        if (denyCount >= 2 && !hasPermission) {
            enterRecovery(source, campaign)
            return
        }

        val shouldSkipInterstitial = hasPermission ||
            source == LocationTriggerSource.Campaign ||
            source == LocationTriggerSource.LocalContext ||
            source == LocationTriggerSource.Settings ||
            campaign?.skipInterstitial == true
        val hasFix = hasStoredLocation()

        // App trigger(): Location_Update_Triggered, screen_name Home, Attempt = deny count + 1
        // clamped to 1..2, sent as a string.
        analytics.track(
            AnalyticsEvents.LOCATION_UPDATE_TRIGGERED,
            gpsProps(
                source, campaign, null,
                mapOf(
                    AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME,
                    AnalyticsProps.ATTEMPT to (denyCount + 1).coerceIn(1, 2).toString()
                )
            )
        )

        when {
            hasPermission && hasFix ->
                _state.value = LocationPromptState.RequestEnableGps(source, campaign)
            hasPermission && source == LocationTriggerSource.Weather ->
                _state.value = LocationPromptState.Interstitial(source, campaign)
            hasPermission && source == LocationTriggerSource.Campaign ->
                _state.value = LocationPromptState.RequestEnableGps(source, campaign)
            shouldSkipInterstitial -> enterRequestPermission(source, campaign)
            else -> _state.value = LocationPromptState.Interstitial(source, campaign)
        }
    }

    /**
     * `Permission_popup_shown` + `location_permission_prompt_triggered`, both with Attempt 1, on
     * every entry into RequestPermission (app LocationPromptHost's RequestPermission effect).
     */
    private fun enterRequestPermission(source: LocationTriggerSource, campaign: LocationCampaignConfig?) {
        analytics.track(
            AnalyticsEvents.PERMISSION_POPUP_SHOWN,
            gpsProps(source, campaign, 1, mapOf(AnalyticsProps.PERMISSION_TYPE to "Location"))
        )
        analytics.track(
            AnalyticsEvents.LOCATION_PERMISSION_PROMPT_TRIGGERED,
            gpsProps(source, campaign, 1)
        )
        _state.value = LocationPromptState.RequestPermission(source, campaign)
    }

    /** Recovery sheet + its `Permission_Fallback_Default_Setting_Shown` (Attempt 1). */
    private fun enterRecovery(source: LocationTriggerSource, campaign: LocationCampaignConfig?) {
        analytics.track(AnalyticsEvents.PERMISSION_FALLBACK_SETTING_SHOWN, gpsProps(source, campaign, 1))
        _state.value = LocationPromptState.Recovery(source, campaign)
    }

    // ------------------------------------------------------------------ interstitial / sheet actions

    /** Interstitial "Share Location" CTA. */
    fun onInterstitialCtaClicked() {
        val s = _state.value as? LocationPromptState.Interstitial ?: return
        enterRequestPermission(s.source, s.campaign)
    }

    /**
     * Skip / Recovery close: carry on with the original navigation, using IP-based location.
     * Emits `Continue(reason)`; [reason] is never a success reason.
     */
    fun continueWithoutLocation(reason: String = "continue_without_location") {
        val src = activeSource ?: return dismiss(emitContinue = false)
        val camp = activeCampaign
        emit(LocationPromptEvent.Continue(src, camp, reason))
        executePendingNavigation()
        dismiss(emitContinue = false)
    }

    /** Interstitial back: abandon the original navigation. */
    fun cancel() {
        val src = activeSource ?: return dismiss(emitContinue = false)
        val camp = activeCampaign
        emit(LocationPromptEvent.Cancel(src, camp))
        pendingNavigation = null
        dismiss(emitContinue = false)
    }

    /**
     * Close the flow. With [emitContinue] an active flow settles with `Continue("dismissed")` and
     * the pending navigation runs, so a caller armed for the flow (weather → chat, the chat
     * gps-prompt) never waits forever. "dismissed" is NOT a success reason.
     */
    fun dismiss(emitContinue: Boolean = true) {
        val src = activeSource
        val camp = activeCampaign
        if (emitContinue && src != null) {
            emit(LocationPromptEvent.Continue(src, camp, reason = "dismissed"))
            executePendingNavigation()
        } else {
            pendingNavigation = null
        }
        _state.value = LocationPromptState.Idle
        activeSource = null
        activeCampaign = null
    }

    /** Recovery "Turn on in settings" — the host opens the app's settings page. */
    fun trackRecoverySettingsClicked() {
        analytics.track(
            AnalyticsEvents.PERMISSION_FALLBACK_SETTING_CLICKED,
            gpsProps(attempt = 1, extra = mapOf(AnalyticsProps.PERMISSION_TYPE to "Location"))
        )
    }

    /** Recovery sheet closed without going to settings (close icon, swipe, back). */
    fun trackRecoveryCanceled() {
        analytics.track(
            AnalyticsEvents.PERMISSION_FALLBACK_SETTING_CANCELED,
            gpsProps(attempt = 1, extra = mapOf(AnalyticsProps.PERMISSION_TYPE to "Location"))
        )
    }

    // ------------------------------------------------------------------ host callbacks

    fun onPermissionResult(granted: Boolean) {
        val current = _state.value
        val source: LocationTriggerSource
        val campaign: LocationCampaignConfig?
        when (current) {
            is LocationPromptState.RequestPermission -> { source = current.source; campaign = current.campaign }
            is LocationPromptState.Interstitial -> { source = current.source; campaign = current.campaign }
            is LocationPromptState.Error -> { source = current.source; campaign = current.campaign }
            is LocationPromptState.Recovery -> { source = current.source; campaign = current.campaign }
            else -> return
        }

        if (!granted) {
            val deny = prefs.getInt(SdkPreferences.Keys.PERMISSION_DENY_COUNT, 0) + 1
            prefs.putInt(SdkPreferences.Keys.PERMISSION_DENY_COUNT, deny)
            prefs.putBoolean(SdkPreferences.Keys.GPS_PERMISSION_SHOULD_ASK, true)
            analytics.track(
                AnalyticsEvents.PERMISSION_DENIED,
                gpsProps(source, campaign, deny, mapOf(AnalyticsProps.PERMISSION_TYPE to "Location"))
            )
            analytics.track(AnalyticsEvents.LOCATION_PERMISSION_DENY, gpsProps(source, campaign, deny))
            // The 2nd deny escalates to the Recovery sheet, for every source.
            if (deny >= 2) {
                enterRecovery(source, campaign)
                return
            }
            // Do not block app usage: carry on with IP-based location.
            _state.value = LocationPromptState.Idle
            emit(LocationPromptEvent.Continue(source, campaign, reason = "permission_denied"))
            executePendingNavigation()
            activeSource = null
            activeCampaign = null
            return
        }

        // App LocationPromptHost — Attempt is always 1 on success.
        analytics.track(
            AnalyticsEvents.PERMISSION_GRANTED,
            gpsProps(source, campaign, 1, mapOf(AnalyticsProps.PERMISSION_TYPE to "Location"))
        )
        analytics.track(AnalyticsEvents.LOCATION_PERMISSION_ALLOW, gpsProps(source, campaign, 1))
        prefs.putBoolean(SdkPreferences.Keys.GPS_PERMISSION_SHOULD_ASK, false)
        prefs.putInt(SdkPreferences.Keys.PERMISSION_DENY_COUNT, 0)

        val isFromRecovery = current is LocationPromptState.Recovery
        if (isFromRecovery && hasStoredLocation()) {
            emit(LocationPromptEvent.Continue(source, campaign, reason = "post_settings_preference_exists"))
            executePendingNavigation()
            _state.value = LocationPromptState.Idle
            activeSource = null
            activeCampaign = null
            return
        }
        _state.value = if (isFromRecovery && source == LocationTriggerSource.Weather) {
            LocationPromptState.Interstitial(source, campaign)
        } else {
            LocationPromptState.RequestEnableGps(source, campaign)
        }
    }

    /**
     * ON_RESUME while the Recovery sheet is up: the farmer may have granted the permission in
     * system Settings. App parity: Campaign resumes the flow; every other source goes back to the
     * interstitial so the farmer re-confirms with "Share Location".
     */
    fun onResumedWithPermission(granted: Boolean) {
        val s = _state.value as? LocationPromptState.Recovery ?: return
        if (!granted) return
        if (s.source == LocationTriggerSource.Campaign) {
            onPermissionResult(granted = true)
        } else {
            _state.value = LocationPromptState.Interstitial(s.source, s.campaign)
        }
    }

    /**
     * GPS resolution outcome. Declined → Error(GpsUnavailable) with `canRetry = false`: the farmer
     * can't fix it inside the app, so the error CTA closes the flow instead of reopening the same
     * dialog. The Weather entry skips the error and continues without location.
     */
    fun onGpsEnableResult(enabled: Boolean) {
        val s = _state.value as? LocationPromptState.RequestEnableGps ?: return
        if (enabled) {
            enterFetchingLocation(s.source, s.campaign)
            return
        }
        if (s.source == LocationTriggerSource.Weather && s.campaign == null) {
            continueWithoutLocation(reason = "gps_disabled_no_thanks")
            return
        }
        _state.value = LocationPromptState.Error(
            LocationErrorType.GpsUnavailable, s.source, s.campaign, canRetry = false
        )
    }

    /** GPS already enabled — skip the resolution dialog. */
    fun onGpsAlreadyEnabled() = onGpsEnableResult(true)

    /**
     * Enters `FetchingLocation` and emits the fetch-phase pair, once per attempt:
     * `Location_Update_Triggered` (screen_name OVERRIDDEN to the Dashboard screen) followed by
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

    /**
     * A fix could not be obtained. Attempt 0 retries once; after that the host has already tried
     * the last-known fix, so the flow ends quietly with `Continue("location_failed_fallback")` and
     * the app keeps using IP-based location — no error screen (app `onLocationResult` fallback).
     */
    fun onLocationFetchFailed(timeout: Boolean) {
        val s = _state.value as? LocationPromptState.FetchingLocation ?: return
        analytics.track(
            if (timeout) AnalyticsEvents.LOCATION_FETCH_FAILED_TIMEOUT
            else AnalyticsEvents.LOCATION_FETCH_FAILED,
            gpsProps(s.source, s.campaign, s.attempt + 1)
        )
        analytics.trackApiError(AnalyticsApis.GPS_FETCH_FRESH_LOCATION, AnalyticsScreens.GPS, timeout)
        if (s.attempt < 1) {
            enterFetchingLocation(s.source, s.campaign, s.attempt + 1)
            return
        }
        emit(LocationPromptEvent.Continue(s.source, s.campaign, reason = "location_failed_fallback"))
        executePendingNavigation()
        _state.value = LocationPromptState.Idle
        activeSource = null
        activeCampaign = null
    }

    /** Kept for host compatibility: offline at fetch time. */
    fun onNoNetwork() {
        _state.value = LocationPromptState.Error(
            LocationErrorType.NoNetwork, currentSource(), currentCampaign(), canRetry = true
        )
    }

    /**
     * Error-screen CTA. Retryable errors re-run [trigger] from the same context (respecting the
     * deny count etc.); a non-retryable one (GPS declined) just closes the flow.
     */
    fun onErrorCta() {
        val s = _state.value as? LocationPromptState.Error ?: return
        if (s.canRetry) trigger(s.source, s.campaign) else dismiss()
    }

    /**
     * A fix was obtained (fresh or last-known). Saved to prefs only after `update_user_location`
     * succeeds, as the app does; a guest (no user id) saves immediately. The Weather entry
     * navigates at once and lets the API finish in the background.
     */
    fun onLocationFetched(lat: Double, lng: Double) {
        val s = _state.value as? LocationPromptState.FetchingLocation ?: return
        val source = s.source
        val campaign = s.campaign
        analytics.track(AnalyticsEvents.LOCATION_FETCH_SUCCESS, gpsProps(source, campaign, s.attempt + 1))
        analytics.trackApiSuccess(AnalyticsApis.GPS_FETCH_FRESH_LOCATION, AnalyticsScreens.GPS)

        val userId = prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "").trim()
        if (userId.isBlank()) {
            saveLocation(lat, lng)
            finishWithLocation(source, campaign)
            return
        }
        if (source == LocationTriggerSource.Weather) finishWithLocation(source, campaign)

        scope.launch {
            analytics.trackApiInitiated(AnalyticsApis.UPDATE_USER_LOCATION, AnalyticsScreens.GPS)
            when (val result = updateUserLocationUseCase.updateUserLocation(
                UpdateLocationRequest(lat = lat.toString(), long = lng.toString(), user_id = userId)
            ).first()) {
                is ApiResult.Success -> {
                    analytics.trackApiSuccess(AnalyticsApis.UPDATE_USER_LOCATION, AnalyticsScreens.GPS)
                    analytics.track(AnalyticsEvents.LOCATION_UPDATE_SUCCESS, gpsProps(source, campaign))
                    result.data.user_profile?.let { profile ->
                        val country = profile.country_name.orEmpty()
                        val stateName = profile.geography_level2_name.orEmpty()
                        val district = profile.geography_level3.orEmpty()
                        prefs.putString(SdkPreferences.Keys.USER_COUNTRY_CODE, profile.country_code.orEmpty())
                        prefs.putString(SdkPreferences.Keys.USER_COUNTRY_NAME, country)
                        prefs.putString(SdkPreferences.Keys.USER_SELECTED_STATE_CODE, stateName)
                        // Best readable place name for the pill: district > state > country.
                        district.ifBlank { stateName }.ifBlank { country }
                            .takeIf { it.isNotBlank() }
                            ?.let { prefs.putString(SdkPreferences.Keys.APPROX_LOCATION_NAME, it) }
                    }
                    saveLocation(lat, lng)
                    if (source != LocationTriggerSource.Weather) {
                        if (source == LocationTriggerSource.Campaign) {
                            emit(LocationPromptEvent.LocationUpdatedFromWidget(campaign))
                        }
                        finishWithLocation(source, campaign)
                    }
                }
                is ApiResult.Error -> {
                    analytics.trackApiError(
                        AnalyticsApis.UPDATE_USER_LOCATION, AnalyticsScreens.GPS, result.isTimeout
                    )
                    analytics.track(AnalyticsEvents.LOCATION_UPDATE_FAILURE, gpsProps(source, campaign))
                    // App: Campaign / LocalContext / Settings dismiss; nothing is saved.
                    if (source != LocationTriggerSource.Weather) dismiss()
                }
            }
        }
    }

    private fun saveLocation(lat: Double, lng: Double) {
        prefs.putString(SdkPreferences.Keys.FARMER_APP_LATITUDE, lat.toString())
        prefs.putString(SdkPreferences.Keys.FARMER_APP_LONGITUDE, lng.toString())
        prefs.putBoolean(SdkPreferences.Keys.GPS_LOCATION_SHARED, true)
        prefs.putBoolean(SdkPreferences.Keys.LOCATION_DONE, true)
    }

    private fun finishWithLocation(source: LocationTriggerSource, campaign: LocationCampaignConfig?) {
        _state.value = LocationPromptState.Idle
        emit(LocationPromptEvent.Continue(source, campaign, reason = "location_fetched"))
        executePendingNavigation()
        activeSource = null
        activeCampaign = null
    }

    private fun executePendingNavigation() {
        val nav = pendingNavigation ?: return
        pendingNavigation = null
        runCatching { nav() }
    }

    private fun emit(event: LocationPromptEvent) {
        scope.launch { _events.emit(event) }
    }

    /** Full reset (logout). */
    fun clearState() {
        _state.value = LocationPromptState.Idle
        pendingNavigation = null
        activeSource = null
        activeCampaign = null
    }
}

/**
 * `Trigger` value when the GPS flow was raised by the chat `gps-prompt` chip. Copied from the app,
 * which uses this literal rather than a [gpsTriggerLabel] case — the chip reuses `LocalContext`
 * for BEHAVIOUR, so its trigger label cannot come from the source.
 */
private const val TRIGGER_CHAT_SCREEN = "Chat Screen"

/**
 * `Trigger` values exactly as the app's analytics sheet defines them. An unknown or absent
 * campaign `triggerSource` falls back to "Plotline Campaign", as the app's `else` branch does.
 */
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
 * Every GPS analytics event's base payload, a port of the app's `trackGpsEvent`: `screen_name`
 * is always the GPS screen unless an [extra] overrides it, `Trigger` is the [gpsTriggerLabel],
 * and `Attempt` appears only when supplied.
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
