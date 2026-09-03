import Foundation
import Combine
import CoreLocation

// MARK: - State machine (port of LocationPromptState, doc 01 §3.15)

public enum LocationErrorType: Sendable, Equatable {
    case noNetwork
    case gpsUnavailable
    case locationFailed
}

public enum LocationPromptState: Sendable, Equatable {
    case idle
    case interstitial
    case requestPermission
    case requestEnableGps
    case fetchingLocation
    case recovery
    case error(LocationErrorType)
}

/// Where the prompt was triggered from — weather and localContext keep the
/// interstitial overlay during permission/fetch, widget/campaign shows nothing.
public enum LocationPromptSource: Sendable, Equatable {
    case weather
    case widget
    case deeplink
    /// 2.0.0: the chat GPS_PROMPT "Share my location" capability chip. Mirrors Android's
    /// `LocationTriggerSource.LocalContext` — the outcome is routed back into the chat thread, so
    /// an outcome carrying any OTHER source must be ignored by the chat collector.
    case localContext
}

/// Terminal outcomes of a location flow, broadcast to every subscriber (``PassthroughSubject``
/// multicasts; there is no replay, so subscribe before triggering).
///
/// Every case is terminal and every terminal path emits exactly one — that matters for the chat
/// share-location flow, which arms itself on a chip tap and must be disarmed by whatever happens
/// next. ``LocationPromptState/recovery`` is deliberately NOT terminal: `onAppForeground()` can
/// re-run the flow out of it, so the event is emitted when the sheet is actually dismissed.
public enum LocationPromptEvent: Sendable, Equatable {
    /// Widget/campaign flow saved a location — kept payload-free (`FarmerChatView` compares it
    /// with `==`).
    case locationUpdatedFromWidget
    /// The location was saved. Android's equivalent is
    /// `Continue(source, reason = "location_fetched")`; there is no `reason` here because this is
    /// the single success emission, so the case itself carries that meaning.
    case locationSaved(source: LocationPromptSource)
    /// The farmer skipped the interstitial, or dismissed a recovery sheet / error screen — the
    /// flow ended with no location. Covers Android's `Cancel(source, campaign)` AND its
    /// `Continue(reason = "dismissed")`: both mean "settled, no location", and iOS keeps them one
    /// case because nothing here distinguishes them.
    case skipped(source: LocationPromptSource)

    /// True when this event ends a location flow **WITH** a usable location.
    ///
    /// Kept in Core so both flavours share one rule — the analogue of Android's
    /// `LocationPromptEvent.isLocationObtained()`. On Android the predicate has to inspect a
    /// `reason` string against `LOCATION_OBTAINED_REASONS`, because its `Continue` case is
    /// overloaded: `dismiss()` emits `Continue(reason = "dismissed")`, so `Continue` alone does
    /// NOT mean success and a caller treating it as such would show the chat GPS_PROMPT bubble for
    /// a location the farmer never shared.
    ///
    /// iOS has no `reason` field and no overloaded case — ``locationSaved(source:)`` is the single
    /// success emission and ``skipped(source:)`` the single "settled, no location" one — so the
    /// case itself carries the meaning and no reason set is needed. Adding one would be inventing
    /// a wire-adjacent field with no discriminating power (root CLAUDE.md §2).
    public var isLocationObtained: Bool {
        if case .locationSaved = self { return true }
        return false
    }

    /// The trigger source this **terminal** outcome belongs to, or nil when the event is not a
    /// per-flow terminal outcome (``locationUpdatedFromWidget`` is a broadcast for Home to reload).
    ///
    /// A caller armed for its own flow — the chat share-location capability chip — must ignore an
    /// outcome carrying any other source, so this is the filter both flavours apply before acting.
    public var terminalSource: LocationPromptSource? {
        switch self {
        case .locationSaved(let source), .skipped(let source): return source
        case .locationUpdatedFromWidget: return nil
        }
    }
}

// MARK: - Manager (port of LocationPromptManager + LocationPromptHost logic)

@MainActor
public final class LocationPromptManager: NSObject, ObservableObject {
    @Published public private(set) var state: LocationPromptState = .idle
    @Published public private(set) var source: LocationPromptSource = .weather

    public let events = PassthroughSubject<LocationPromptEvent, Never>()

    /// Navigation the caller wants after a successful share (e.g. weather → Chat).
    public private(set) var pendingNavigation: (@MainActor () -> Void)?

    private let env: FarmerChat
    private let manager = CLLocationManager()
    private var fetchTask: Task<Void, Never>?
    private var permissionContinuation: CheckedContinuation<Bool, Never>?
    private var locationContinuation: CheckedContinuation<CLLocation?, Never>?
    private var didRetryFetch = false

    public init(env: FarmerChat = .shared) {
        self.env = env
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    public var isLocationKnown: Bool {
        env.prefs.double(.latitude) != nil && env.prefs.double(.longitude) != nil
    }

    // MARK: - Triggers

    /// Weather CTA: show interstitial first (unless location already shared).
    public func triggerFromWeather(pendingNavigation: (@MainActor () -> Void)? = nil) {
        self.pendingNavigation = pendingNavigation
        source = .weather
        trackStep("interstitial_shown")
        state = .interstitial
    }

    /// Campaign/widget/deeplink trigger: silent flow (no interstitial overlay).
    public func triggerFromWidget() {
        source = .widget
        trackStep("widget_trigger")
        Task { await runLocationFlow() }
    }

    /// 2.0.0: the chat GPS_PROMPT "Share my location" capability chip. Full interstitial flow, the
    /// same shape as weather (port of Android's `triggerFromLocalContext`). The caller arms itself
    /// first and consumes the terminal event off ``events``.
    public func triggerFromLocalContext() {
        pendingNavigation = nil
        source = .localContext
        trackStep("interstitial_shown")
        state = .interstitial
    }

    public func setPendingNavigation(_ navigation: (@MainActor () -> Void)?) {
        pendingNavigation = navigation
    }

    // MARK: - Interstitial actions

    public func shareLocationTapped() {
        trackStep("share_clicked")
        Task { await runLocationFlow() }
    }

    public func skipTapped() {
        trackStep("skipped")
        env.prefs.setBool(true, .locationPromptSkipped)
        env.analytics.track(AnalyticsEvents.gpsLocationSkipped)
        // `reset()` does not clear `source`, but read it first anyway — the same discipline
        // `saveLocation` uses with `wasWidget`.
        let endedSource = source
        reset()
        events.send(.skipped(source: endedSource))
    }

    /// Dismisses a recovery sheet or an error screen. This is the flow's terminal "no location"
    /// exit for permission-denied, GPS-off and fetch-failed alike — `runLocationFlow` sets a state
    /// and returns without emitting, so without this emission a caller armed on ``events`` (the
    /// chat share-location flow) would wait forever and the farmer's blocking question would never
    /// be answered. Mirrors Android's `dismiss()` emitting `Continue(reason = "dismissed")`.
    public func dismissError() {
        // Capture before clearing. `wasActive` mirrors Android's guard: `saveLocation` already
        // resets to `.idle` BEFORE emitting its success, so a dismiss following a success must not
        // send a second, contradictory event.
        let wasActive = state != .idle
        let endedSource = source
        reset()
        if wasActive {
            events.send(.skipped(source: endedSource))
        }
    }

    /// Recovery sheet → "Turn on in settings" (host opens app settings URL).
    public func recoveryConfirmed() {
        trackStep("recovery_settings_clicked")
        // The UI layer opens UIApplication.openSettingsURLString; we stay in
        // Recovery until onAppForeground() re-checks.
    }

    /// ON_RESUME parity: while in Recovery, re-check permission.
    public func onAppForeground() {
        guard state == .recovery else { return }
        if currentAuthorizationGranted() {
            Task { await runLocationFlow() }
        }
    }

    /// Teardown, not a user-facing exit: deliberately silent, like Android's `clearState()`. Every
    /// path a farmer can take out of a live flow emits through ``skipTapped()`` /
    /// ``dismissError()`` / `saveLocation` instead.
    public func reset() {
        fetchTask?.cancel()
        fetchTask = nil
        state = .idle
        pendingNavigation = nil
        didRetryFetch = false
    }

    // MARK: - Flow

    private func runLocationFlow() async {
        // Services off → GPS unavailable error (no in-app resolution on iOS).
        let servicesEnabled = await Task.detached { CLLocationManager.locationServicesEnabled() }.value
        guard servicesEnabled else {
            trackStep("gps_unavailable")
            state = .error(.gpsUnavailable)
            env.analytics.track(AnalyticsEvents.gpsLocationFailed, props: ["reason": "gps_unavailable"])
            return
        }

        // Permission.
        if !currentAuthorizationGranted() {
            if authorizationDenied() {
                trackStep("permission_denied_recovery")
                state = .recovery
                return
            }
            state = .requestPermission
            trackStep("permission_requested")
            let granted = await requestPermission()
            guard granted else {
                trackStep("permission_denied_recovery")
                state = .recovery
                return
            }
            trackStep("permission_granted")
        }

        // Fetch: fresh (10 s, 1 retry) → last-known fallback (2 s window).
        state = .fetchingLocation
        trackStep("fetch_started")
        var location = await fetchFreshLocation(timeout: 10)
        if location == nil && !didRetryFetch {
            didRetryFetch = true
            trackStep("fetch_retry")
            location = await fetchFreshLocation(timeout: 10)
        }
        if location == nil {
            location = await lastKnownLocation(timeout: 2)
        }

        guard let location else {
            trackStep("fetch_failed")
            env.analytics.track(AnalyticsEvents.gpsLocationFailed, props: ["reason": "location_failed"])
            state = .error(.locationFailed)
            return
        }
        await saveLocation(location)
    }

    private func saveLocation(_ location: CLLocation) async {
        let lat = location.coordinate.latitude
        let long = location.coordinate.longitude
        env.prefs.setDouble(lat, .latitude)
        env.prefs.setDouble(long, .longitude)

        if env.session.isAuthenticated || env.session.userId != nil, let userId = env.session.userId {
            // Logged-in (or guest with server user id): push to backend.
            let result = await env.api.updateUserLocation(UpdateLocationRequest(userId: userId, lat: lat, long: long))
            switch result {
            case .success(let response):
                if let country = response.country { env.prefs.setString(country, .userCountryName) }
                if let state = response.state { env.prefs.setString(state, .userState) }
                if let district = response.district { env.prefs.setString(district, .userDistrict) }
            case .error(let error):
                if error.isNetworkError {
                    trackStep("save_no_network")
                    state = .error(.noNetwork)
                    return
                }
                // Non-network save failure: keep local coordinates, continue.
            }
        }
        env.prefs.setBool(true, .gpsLocationShared)
        env.analytics.track(AnalyticsEvents.gpsLocationShared)
        env.analytics.setUserAttribute("GPS_LOCATION_SHARED", value: "true")
        trackStep("location_saved")

        let navigation = pendingNavigation
        let savedSource = source
        reset()
        if savedSource == .widget {
            events.send(.locationUpdatedFromWidget)
        } else {
            events.send(.locationSaved(source: savedSource))
        }
        navigation?()
    }

    private func trackStep(_ step: String) {
        env.analytics.track(AnalyticsEvents.gpsFlowStep, props: ["step": step, "source": sourceName])
    }

    private var sourceName: String {
        switch source {
        case .weather: return "weather"
        case .widget: return "widget"
        case .deeplink: return "deeplink"
        // Mirrors Android's `LocationTriggerSource.LocalContext`, snake_cased like its siblings.
        case .localContext: return "local_context"
        }
    }

    // MARK: - CoreLocation plumbing

    private func currentAuthorizationGranted() -> Bool {
        let status = manager.authorizationStatus
        #if os(iOS)
        return status == .authorizedWhenInUse || status == .authorizedAlways
        #else
        return status == .authorizedAlways || status == .authorized
        #endif
    }

    private func authorizationDenied() -> Bool {
        let status = manager.authorizationStatus
        return status == .denied || status == .restricted
    }

    private func requestPermission() async -> Bool {
        await withCheckedContinuation { continuation in
            permissionContinuation = continuation
            manager.requestWhenInUseAuthorization()
        }
    }

    private func fetchFreshLocation(timeout: TimeInterval) async -> CLLocation? {
        let location: CLLocation? = await withCheckedContinuation { continuation in
            locationContinuation = continuation
            manager.requestLocation()
            Task { [weak self] in
                try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
                await MainActor.run {
                    guard let self, let pending = self.locationContinuation else { return }
                    self.locationContinuation = nil
                    pending.resume(returning: nil)
                }
            }
        }
        return location
    }

    private func lastKnownLocation(timeout: TimeInterval) async -> CLLocation? {
        if let cached = manager.location { return cached }
        try? await Task.sleep(nanoseconds: UInt64(timeout * 1_000_000_000))
        return manager.location
    }
}

// MARK: - CLLocationManagerDelegate

extension LocationPromptManager: CLLocationManagerDelegate {
    public nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor [weak self] in
            guard let self, let continuation = self.permissionContinuation else { return }
            guard status != .notDetermined else { return }
            self.permissionContinuation = nil
            #if os(iOS)
            let granted = status == .authorizedWhenInUse || status == .authorizedAlways
            #else
            let granted = status == .authorizedAlways || status == .authorized
            #endif
            continuation.resume(returning: granted)
        }
    }

    public nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let latest = locations.last
        Task { @MainActor [weak self] in
            guard let self, let continuation = self.locationContinuation else { return }
            self.locationContinuation = nil
            continuation.resume(returning: latest)
        }
    }

    public nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor [weak self] in
            guard let self, let continuation = self.locationContinuation else { return }
            self.locationContinuation = nil
            continuation.resume(returning: nil)
        }
    }
}
