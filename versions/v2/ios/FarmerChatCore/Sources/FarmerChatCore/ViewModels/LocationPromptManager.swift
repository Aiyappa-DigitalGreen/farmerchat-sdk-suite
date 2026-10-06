import Foundation
import Combine
import CoreLocation
import Network

// MARK: - State machine (port of LocationPromptState, doc 01 §3.15)

public enum LocationErrorType: Sendable, Equatable {
    case noNetwork
    case gpsUnavailable
    /// Kept for source compatibility. Since 2026-10-06 a failed fix ends the flow QUIETLY (app
    /// `onLocationResult` fallback), so the manager no longer enters this state.
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

/// Where the prompt was triggered from. Maps onto the app's `LocationTriggerSource`:
/// `weather` → Weather, `localContext` → LocalContext (on iOS only the chat gps-prompt chip — the
/// SDK has no Home location pill), `widget` / `deeplink` → Campaign. iOS has no Settings location
/// row, so the app's Settings source has no entry point here.
public enum LocationPromptSource: Sendable, Equatable {
    case weather
    case widget
    case deeplink
    /// 2.0.0: the chat GPS_PROMPT "Share my location" capability chip. Mirrors Android's
    /// `LocationTriggerSource.LocalContext` — the outcome is routed back into the chat thread, so
    /// an outcome carrying any OTHER source must be ignored by the chat collector.
    case localContext

    /// The app's Campaign source (Plotline widget / deep link).
    var isCampaign: Bool { self == .widget || self == .deeplink }
}

/// Terminal outcomes of a location flow, broadcast to every subscriber (``PassthroughSubject``
/// multicasts; there is no replay, so subscribe before triggering).
///
/// Every case is terminal and every terminal path emits exactly one — that matters for the chat
/// share-location flow, which arms itself on a chip tap and must be disarmed by whatever happens
/// next. The ONE silent exit is Home's `dismiss(emitContinue: false)` after it routes a location
/// error to the shared Error screen (app `HomeScreen.kt:258-266`).
public enum LocationPromptEvent: Sendable, Equatable {
    /// A Campaign (widget / deep link) flow saved a location — Home reloads its feed and weather.
    /// Always followed by ``locationSaved(source:)`` for the same flow.
    case locationUpdatedFromWidget
    /// The location was saved. Android's `Continue(reason = "location_fetched")` and
    /// `Continue(reason = "post_settings_preference_exists")` — the two success reasons.
    case locationSaved(source: LocationPromptSource)
    /// The flow settled with no location: interstitial Skip / Back, a first permission denial,
    /// recovery sheet closed, GPS declined, a failed fix, an error screen closed, a failed
    /// `update_user_location`. Covers Android's `Cancel` AND every non-success `Continue`.
    case skipped(source: LocationPromptSource)

    /// True when this event ends a location flow **WITH** a usable location.
    ///
    /// Kept in Core so both flavours share one rule — the analogue of Android's
    /// `LocationPromptEvent.isLocationObtained()`. iOS has no `reason` field: ``locationSaved(source:)``
    /// is the single success emission and ``skipped(source:)`` the single "settled, no location"
    /// one, so the case itself carries the meaning.
    public var isLocationObtained: Bool {
        if case .locationSaved = self { return true }
        return false
    }

    /// The trigger source this **terminal** outcome belongs to, or nil when the event is not a
    /// per-flow terminal outcome (``locationUpdatedFromWidget`` is a broadcast for Home to reload).
    public var terminalSource: LocationPromptSource? {
        switch self {
        case .locationSaved(let source), .skipped(let source): return source
        case .locationUpdatedFromWidget: return nil
        }
    }
}

// MARK: - Dependencies (injectable so the decision tree is unit-testable)

/// Platform effects the state machine drives. Production wires CoreLocation + NWPathMonitor;
/// tests substitute closures.
struct LocationPromptPlatform {
    /// Live "When In Use"/"Always" check. Reduced (approximate) accuracy still counts as granted —
    /// iOS has no FINE/COARSE split, so the app's FINE-only rule has no equivalent.
    var hasPermission: @MainActor () -> Bool
    /// Location Services on system-wide (the Android GPS-provider check).
    var servicesEnabled: @MainActor () async -> Bool
    /// Shows the system dialog and returns the result. Returns false IMMEDIATELY when the dialog
    /// cannot be shown (already denied/restricted, or the host lacks the Info.plist usage string) —
    /// iOS fires no callback in those cases, so waiting would hang the flow.
    var requestPermission: @MainActor () async -> Bool
    /// A fresh fix within the timeout, or nil.
    var fetchFresh: @MainActor (TimeInterval) async -> (lat: Double, lng: Double)?
    /// The cached/last-known fix within the timeout, or nil.
    var lastKnown: @MainActor (TimeInterval) async -> (lat: Double, lng: Double)?
    /// Live connectivity (app `NetworkUtils.isOnline`).
    var isOnline: @MainActor () -> Bool
}

/// Environment pieces the manager reads/writes.
struct LocationPromptEnvironment {
    var prefs: PreferenceStore
    var analytics: AnalyticsDispatcher
    var userId: () -> String?
    var updateUserLocation: (UpdateLocationRequest) async -> ApiResult<GetLocationResponse>
}

/// Process-wide connectivity monitor for the location flow's offline check.
///
/// "No path update yet" is treated as ONLINE: the monitor reports asynchronously, and blocking a
/// tap made in the first instant after launch on an unknown status would be worse than letting the
/// request fail normally.
public final class FCNetworkMonitor: @unchecked Sendable {
    public static let shared = FCNetworkMonitor()

    private let monitor = NWPathMonitor()
    private let lock = NSLock()
    private var status: NWPath.Status?

    private init() {
        monitor.pathUpdateHandler = { [weak self] path in
            guard let self else { return }
            self.lock.lock()
            self.status = path.status
            self.lock.unlock()
        }
        monitor.start(queue: DispatchQueue(label: "org.digitalgreen.farmerchat.network-monitor"))
    }

    /// True unless the last reported path is unsatisfied.
    public var isOnline: Bool {
        lock.lock()
        defer { lock.unlock() }
        guard let status else { return true }
        return status == .satisfied
    }
}

// MARK: - Manager (port of the app's core/location/LocationPromptManager.kt + LocationPromptHost effects)

/// Global GPS/location prompt state machine — a port of the app's
/// `core/location/LocationPromptManager.kt` (fc-compose-agentic), via the Android SDK's
/// `core/ui/location/LocationPromptManager.kt`.
///
/// Every trigger runs the app's `trigger()` decision tree:
///
///  1. offline                                     → error(.noNetwork), retryable
///  2. Weather with a stored fix                   → run the pending navigation, no flow
///  3. denied twice and still no permission        → recovery (every source)
///  4. permission granted + a stored fix           → requestEnableGps (no UI)
///  5. Weather, permission granted, no fix         → interstitial
///  6. Campaign, permission granted, no fix        → requestEnableGps
///  7. LocalContext / Campaign, or permission held → requestPermission (system dialog, no interstitial)
///  8. otherwise (Weather, first ask)              → interstitial
///
/// So ONLY the Weather entry ever shows the full-screen interstitial. Unlike Android, where the
/// UI host owns the permission launcher and fused-location client, iOS has no Activity-scoped
/// launcher, so the manager runs the platform effect itself on entering `requestPermission`,
/// `requestEnableGps` and `fetchingLocation` (``LocationPromptPlatform``). A generation counter
/// drops any effect result that arrives after the flow moved on.
@MainActor
public final class LocationPromptManager: NSObject, ObservableObject {
    @Published public private(set) var state: LocationPromptState = .idle
    @Published public private(set) var source: LocationPromptSource = .weather
    /// For ``LocationPromptState/error(_:)``: true → the CTA re-runs the trigger tree from the same
    /// source; false (GPS declined) → the CTA closes the flow. Never loops back into the same prompt.
    @Published public private(set) var errorCanRetry: Bool = true

    public let events = PassthroughSubject<LocationPromptEvent, Never>()

    /// Navigation the caller wants once the flow ends (weather → Chat). Runs on every outcome
    /// except interstitial Back (``cancel()``) and the silent ``dismiss(emitContinue:)``.
    public private(set) var pendingNavigation: (@MainActor () -> Void)?

    private var envDeps: LocationPromptEnvironment
    private var platform: LocationPromptPlatform!
    private let manager = CLLocationManager()
    private var permissionContinuation: CheckedContinuation<Bool, Never>?
    private var locationContinuation: CheckedContinuation<CLLocation?, Never>?

    /// The source of the running flow (app `activeSource`); nil when idle.
    private var activeSource: LocationPromptSource?
    /// 0 for the first fetch, 1 for the single retry.
    private var fetchAttempt = 0
    /// Bumped on every state change; effect results carrying an older value are dropped.
    private var generation = 0
    private var effectTask: Task<Void, Never>?

    public init(env: FarmerChat = .shared) {
        self.envDeps = LocationPromptEnvironment(
            prefs: env.prefs,
            analytics: env.analytics,
            userId: { env.session.userId },
            updateUserLocation: { await env.api.updateUserLocation($0) }
        )
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        platform = coreLocationPlatform()
    }

    /// Test seam: substitute every platform effect and the environment.
    init(environment: LocationPromptEnvironment, platform: LocationPromptPlatform) {
        self.envDeps = environment
        super.init()
        self.platform = platform
    }

    // MARK: - Queries

    /// App `isLocationEnabledOnce()`: a GPS fix has been saved.
    public var isLocationKnown: Bool {
        envDeps.prefs.double(.latitude) != nil && envDeps.prefs.double(.longitude) != nil
    }

    /// Live connectivity, for callers that pre-check before triggering (Home weather chip).
    public var isOnline: Bool { platform.isOnline() }

    /// App HomeScreen `isWidgetGpsLoading`: a CAMPAIGN flow is asking for permission / GPS /
    /// fetching. Home shows its "Getting your location" spinner only then.
    public var isCampaignLocationLoading: Bool {
        guard source.isCampaign else { return false }
        switch state {
        case .requestPermission, .requestEnableGps, .fetchingLocation: return true
        default: return false
        }
    }

    // MARK: - Triggers

    /// Weather chip. With a stored fix the app skips the flow and navigates at once; otherwise the
    /// full flow runs and `pendingNavigation` fires when it ends (any outcome but ``cancel()``).
    public func triggerFromWeather(pendingNavigation: (@MainActor () -> Void)? = nil) {
        self.pendingNavigation = pendingNavigation
        if isLocationKnown {
            executePendingNavigation()
            return
        }
        trigger(.weather)
    }

    /// Campaign (Plotline widget / deep link) trigger: no interstitial.
    public func triggerFromWidget() {
        trigger(.widget)
    }

    /// 2.0.0: the chat GPS_PROMPT "Share my location" capability chip (the app's LocalContext with
    /// `fromAgenticChip = true`). Goes straight to the system dialog — no interstitial. The caller
    /// arms itself first and consumes the terminal event off ``events``.
    public func triggerFromLocalContext() {
        pendingNavigation = nil
        trigger(.localContext)
    }

    public func setPendingNavigation(_ navigation: (@MainActor () -> Void)?) {
        pendingNavigation = navigation
    }

    /// The app's `trigger()` decision tree — see the class doc.
    private func trigger(_ newSource: LocationPromptSource) {
        if !platform.isOnline() {
            activeSource = newSource
            source = newSource
            errorCanRetry = true
            setState(.error(.noNetwork))
            return
        }

        // Already enabled once: only the Weather entry no-ops. LocalContext is an explicit tap
        // (never silently no-op) and Campaign has its own gating.
        if isLocationKnown && newSource == .weather {
            executePendingNavigation()
            return
        }

        activeSource = newSource
        source = newSource
        fetchAttempt = 0

        let denyCount = envDeps.prefs.int(.permissionDenyCount)
        let hasPermission = platform.hasPermission()
        // Denied twice and still not granted → the "We need your location" sheet, every source.
        if denyCount >= 2 && !hasPermission {
            enterRecovery()
            return
        }

        let hasFix = isLocationKnown
        // App trigger(): Location_Update_Triggered, screen_name Home, Attempt = deny + 1 in 1...2.
        track(AnalyticsEvents.locationUpdateTriggered, extra: [
            "screen_name": ScreenNames.home,
            "Attempt": String(min(max(denyCount + 1, 1), 2))
        ])
        trackStep("triggered")

        if hasPermission && hasFix {
            setState(.requestEnableGps)
        } else if hasPermission && newSource == .weather {
            enterInterstitial()
        } else if hasPermission && newSource.isCampaign {
            setState(.requestEnableGps)
        } else if hasPermission || newSource == .localContext || newSource.isCampaign {
            enterRequestPermission()
        } else {
            enterInterstitial()
        }
    }

    private func enterInterstitial() {
        trackStep("interstitial_shown")
        setState(.interstitial)
    }

    /// `Permission_popup_shown` + `location_permission_prompt_triggered`, both Attempt 1, on every
    /// entry into RequestPermission (app LocationPromptHost's RequestPermission effect).
    private func enterRequestPermission() {
        track(AnalyticsEvents.permissionPopupShown, attempt: 1, extra: ["Permission_type": "Location"])
        track(AnalyticsEvents.locationPermissionPromptTriggered, attempt: 1)
        trackStep("permission_requested")
        setState(.requestPermission)
    }

    /// Recovery sheet + `Permission_Fallback_Default_Setting_Shown` (Attempt 1).
    private func enterRecovery() {
        track(AnalyticsEvents.permissionFallbackSettingShown, attempt: 1)
        trackStep("permission_denied_recovery")
        setState(.recovery)
    }

    // MARK: - Interstitial / sheet / error actions

    /// Interstitial "Share Location" CTA. (Kept tolerant of the pre-2026-10-06 call sites that
    /// also wired it to the error screen's CTA.)
    public func shareLocationTapped() {
        switch state {
        case .interstitial:
            trackStep("share_clicked")
            enterRequestPermission()
        case .error:
            onErrorCta()
        default:
            break
        }
    }

    /// Interstitial "Skip": carry on with the original navigation, no location.
    public func skipTapped() {
        trackStep("skipped")
        envDeps.prefs.setBool(true, .locationPromptSkipped)
        envDeps.analytics.track(AnalyticsEvents.gpsLocationSkipped)
        continueWithoutLocation()
    }

    /// Interstitial Back (←): abandon the flow AND the original navigation.
    public func cancel() {
        guard let ended = activeSource else { return dismiss(emitContinue: false) }
        trackStep("cancelled")
        pendingNavigation = nil
        clearFlow()
        events.send(.skipped(source: ended))
    }

    /// Recovery "Turn on in settings" — the UI layer opens `UIApplication.openSettingsURLString`;
    /// the flow stays in Recovery until ``onAppForeground()`` re-checks.
    public func recoveryConfirmed() {
        track(AnalyticsEvents.permissionFallbackSettingClicked, attempt: 1, extra: ["Permission_type": "Location"])
        trackStep("recovery_settings_clicked")
    }

    /// Recovery sheet closed without going to Settings (close button, swipe, backdrop tap).
    public func recoveryClosed() {
        guard state == .recovery else { return }
        track(AnalyticsEvents.permissionFallbackSettingCanceled, attempt: 1, extra: ["Permission_type": "Location"])
        continueWithoutLocation()
    }

    /// Error-screen CTA: retryable errors re-run the trigger tree from the same source; a
    /// non-retryable one (GPS declined) closes the flow.
    public func onErrorCta() {
        guard case .error = state else { return }
        if errorCanRetry, let retrySource = activeSource {
            trigger(retrySource)
        } else {
            dismiss()
        }
    }

    /// Closes a recovery sheet or error screen. Kept for source compatibility; equals
    /// `dismiss(emitContinue: true)`.
    public func dismissError() {
        dismiss()
    }

    /// Close the flow. With `emitContinue` an active flow settles with ``LocationPromptEvent/skipped(source:)``
    /// (Android `Continue("dismissed")`) and the pending navigation runs, so an armed caller never
    /// waits forever. Without it the pending navigation is dropped silently (Home routing a
    /// location error to the shared Error screen).
    public func dismiss(emitContinue: Bool = true) {
        let ended = activeSource
        let navigation = pendingNavigation
        pendingNavigation = nil
        clearFlow()
        if emitContinue, let ended {
            events.send(.skipped(source: ended))
            navigation?()
        }
    }

    /// App resume while Recovery is up: the farmer may have granted the permission in Settings.
    /// Campaign resumes the flow; every other source returns to the interstitial so the farmer
    /// re-confirms with "Share Location".
    public func onAppForeground() {
        guard state == .recovery, platform.hasPermission() else { return }
        if source.isCampaign {
            onPermissionResult(granted: true)
        } else {
            trackStep("interstitial_shown")
            setState(.interstitial)
        }
    }

    /// Teardown (logout), not a user-facing exit: deliberately silent, like Android `clearState()`.
    public func reset() {
        pendingNavigation = nil
        clearFlow()
    }

    // MARK: - Effect results (Android host callbacks)

    private func onPermissionResult(granted: Bool) {
        switch state {
        case .requestPermission, .interstitial, .error, .recovery: break
        default: return
        }
        let fromRecovery = state == .recovery

        if !granted {
            let deny = envDeps.prefs.int(.permissionDenyCount) + 1
            envDeps.prefs.setInt(deny, .permissionDenyCount)
            // The 2nd deny escalates to the Recovery sheet, for every source.
            if deny >= 2 {
                enterRecovery()
                return
            }
            trackStep("permission_denied")
            // Do not block app usage: carry on without a location.
            continueWithoutLocation()
            return
        }

        trackStep("permission_granted")
        envDeps.prefs.setInt(0, .permissionDenyCount)

        if fromRecovery && isLocationKnown {
            // Android `Continue("post_settings_preference_exists")` — a SUCCESS.
            finishWithLocation()
            return
        }
        if fromRecovery && source == .weather {
            trackStep("interstitial_shown")
            setState(.interstitial)
        } else {
            setState(.requestEnableGps)
        }
    }

    /// GPS / Location Services outcome. Off → Weather continues without location; every other
    /// source gets a NON-retryable GpsUnavailable error (no in-app resolution exists on iOS).
    private func onGpsEnableResult(enabled: Bool) {
        if enabled {
            enterFetchingLocation()
            return
        }
        trackStep("gps_unavailable")
        envDeps.analytics.track(AnalyticsEvents.gpsLocationFailed, props: ["reason": "gps_unavailable"])
        if source == .weather {
            continueWithoutLocation()
            return
        }
        errorCanRetry = false
        setState(.error(.gpsUnavailable))
    }

    /// Fetch phase: `Location_Update_Triggered` with screen_name overridden to the Dashboard
    /// screen and Attempt = attempt + 1, once per attempt.
    private func enterFetchingLocation() {
        track(AnalyticsEvents.locationUpdateTriggered, attempt: fetchAttempt + 1, extra: ["screen_name": ScreenNames.home])
        trackStep(fetchAttempt == 0 ? "fetch_started" : "fetch_retry")
        setState(.fetchingLocation)
    }

    /// No fix: the first failure retries once; after the retry (which already tried the
    /// last-known fix) the flow ends QUIETLY — no error screen (app `onLocationResult` fallback).
    private func onLocationFetchFailed() {
        guard state == .fetchingLocation else { return }
        if fetchAttempt < 1 {
            fetchAttempt += 1
            enterFetchingLocation()
            return
        }
        trackStep("fetch_failed")
        envDeps.analytics.track(AnalyticsEvents.gpsLocationFailed, props: ["reason": "location_failed"])
        continueWithoutLocation()
    }

    /// A fix was obtained. Saved only after `update_user_location` succeeds (app parity); a guest
    /// (no user id) saves immediately. Weather navigates at once and lets the API finish in the
    /// background.
    private func onLocationFetched(lat: Double, lng: Double) {
        guard state == .fetchingLocation else { return }
        let flowSource = source
        let flowGeneration = generation
        trackStep("fetch_success")

        let userId = envDeps.userId()?.trimmingCharacters(in: .whitespaces) ?? ""
        if userId.isEmpty {
            saveLocation(lat: lat, lng: lng, response: nil)
            finishWithLocation()
            return
        }
        if flowSource == .weather { finishWithLocation() }

        Task { @MainActor [weak self] in
            guard let self else { return }
            let result = await self.envDeps.updateUserLocation(
                UpdateLocationRequest(userId: userId, lat: lat, long: lng)
            )
            // Weather already finished; the save still lands. Every other source must still be
            // in THIS flow, or a late reply would emit into a flow that was torn down.
            let stillOurs = self.generation == flowGeneration && self.state == .fetchingLocation
            switch result {
            case .success(let response):
                if flowSource == .weather {
                    self.saveLocation(lat: lat, lng: lng, response: response)
                } else if stillOurs {
                    self.saveLocation(lat: lat, lng: lng, response: response)
                    if flowSource.isCampaign { self.events.send(.locationUpdatedFromWidget) }
                    self.finishWithLocation()
                }
            case .error:
                self.trackStep("save_failed")
                // App: Campaign / LocalContext dismiss; nothing is saved.
                if flowSource != .weather && stillOurs { self.dismiss() }
            }
        }
    }

    private func saveLocation(lat: Double, lng: Double, response: GetLocationResponse?) {
        let prefs = envDeps.prefs
        if let response {
            if let country = response.country { prefs.setString(country, .userCountryName) }
            if let state = response.state { prefs.setString(state, .userState) }
            if let district = response.district { prefs.setString(district, .userDistrict) }
        }
        prefs.setDouble(lat, .latitude)
        prefs.setDouble(lng, .longitude)
        prefs.setBool(true, .gpsLocationShared)
        envDeps.analytics.track(AnalyticsEvents.gpsLocationShared)
        envDeps.analytics.setUserAttribute("GPS_LOCATION_SHARED", value: "true")
        trackStep("location_saved")
    }

    /// Success terminal: Android `Continue(reason = "location_fetched")`.
    private func finishWithLocation() {
        guard let ended = activeSource else { return }
        let navigation = pendingNavigation
        pendingNavigation = nil
        clearFlow()
        events.send(.locationSaved(source: ended))
        navigation?()
    }

    /// Non-success terminal (Skip, first deny, recovery closed, GPS off for Weather, failed fix):
    /// emit, RUN the pending navigation, go idle.
    private func continueWithoutLocation() {
        guard let ended = activeSource else { return dismiss(emitContinue: false) }
        let navigation = pendingNavigation
        pendingNavigation = nil
        clearFlow()
        events.send(.skipped(source: ended))
        navigation?()
    }

    private func executePendingNavigation() {
        let navigation = pendingNavigation
        pendingNavigation = nil
        navigation?()
    }

    private func clearFlow() {
        activeSource = nil
        fetchAttempt = 0
        errorCanRetry = true
        setState(.idle)
    }

    // MARK: - State + effects

    private func setState(_ new: LocationPromptState) {
        let old = state
        effectTask?.cancel()
        effectTask = nil
        generation += 1
        state = new
        // App LocationPromptHost: Screen_Viewed / Screen_Exited for the GPS interstitial on
        // entering / leaving it. Here, not in the views, so both flavours emit it identically.
        if old == .interstitial && new != .interstitial {
            envDeps.analytics.screenExited(ScreenNames.locationPrompt)
        }
        if new == .interstitial && old != .interstitial {
            envDeps.analytics.screenViewed(ScreenNames.locationPrompt)
        }
        runEffect(for: new, generation: generation)
    }

    private func runEffect(for state: LocationPromptState, generation gen: Int) {
        let platform = self.platform!
        switch state {
        case .requestPermission:
            effectTask = Task { @MainActor [weak self] in
                // Services off system-wide reads as "denied" on iOS; that must not count as a
                // permission denial, so it routes to the GPS branch instead.
                guard await platform.servicesEnabled() else {
                    guard let self, self.generation == gen else { return }
                    self.onGpsEnableResult(enabled: false)
                    return
                }
                guard self?.generation == gen else { return }
                let granted = await platform.requestPermission()
                guard let self, self.generation == gen else { return }
                self.onPermissionResult(granted: granted)
            }
        case .requestEnableGps:
            effectTask = Task { @MainActor [weak self] in
                let enabled = await platform.servicesEnabled()
                guard let self, self.generation == gen else { return }
                self.onGpsEnableResult(enabled: enabled)
            }
        case .fetchingLocation:
            let attempt = fetchAttempt
            effectTask = Task { @MainActor [weak self] in
                var fix = await platform.fetchFresh(10)
                // After the retry the app falls back to the last-known fix.
                if fix == nil && attempt >= 1 {
                    fix = await platform.lastKnown(2)
                }
                guard let self, self.generation == gen else { return }
                if let fix {
                    self.onLocationFetched(lat: fix.lat, lng: fix.lng)
                } else {
                    self.onLocationFetchFailed()
                }
            }
        default:
            break
        }
    }

    // MARK: - Analytics

    /// Port of the app's `trackGpsEvent`: every GPS event carries `screen_name` = "GPS Screen", the
    /// app's `Trigger` label and `Attempt` when supplied; `extra` overrides. A LocalContext flow on
    /// iOS is always the chat gps-prompt chip, so it gets the app's chip attribution (screen_name
    /// Chat, Trigger "Chat Screen", `agentic_chip_type` = gps-prompt), applied AFTER `extra` so it
    /// wins over the fetch-phase Home override — as Android does.
    private func track(_ name: String, attempt: Int? = nil, extra: [String: String] = [:]) {
        var props: [String: String] = [
            "screen_name": ScreenNames.gps,
            "Trigger": triggerLabel
        ]
        if let attempt { props["Attempt"] = String(attempt) }
        props.merge(extra) { _, new in new }
        if source == .localContext {
            props["screen_name"] = ScreenNames.chat
            props["Trigger"] = "Chat Screen"
            props["agentic_chip_type"] = AlignmentKind.gpsPrompt.analyticsType
        }
        envDeps.analytics.track(name, props: props)
    }

    /// The app's `Trigger` values. Campaign with no known trigger source → "Plotline Campaign"
    /// (the app's `else` branch).
    private var triggerLabel: String {
        switch source {
        case .weather: return "Weather Icon"
        case .localContext: return "Chat Screen"
        case .widget, .deeplink: return "Plotline Campaign"
        }
    }

    /// iOS's pre-existing step-level funnel event, kept (not an app event; see docs/04).
    private func trackStep(_ step: String) {
        envDeps.analytics.track(AnalyticsEvents.gpsFlowStep, props: ["step": step, "source": sourceName])
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

    private func coreLocationPlatform() -> LocationPromptPlatform {
        LocationPromptPlatform(
            hasPermission: { [weak self] in self?.currentAuthorizationGranted() ?? false },
            servicesEnabled: {
                // `locationServicesEnabled()` blocks; keep it off the main thread.
                await Task.detached { CLLocationManager.locationServicesEnabled() }.value
            },
            requestPermission: { [weak self] in
                guard let self else { return false }
                return await self.requestPermission()
            },
            fetchFresh: { [weak self] timeout in
                guard let self, let location = await self.fetchFreshLocation(timeout: timeout) else { return nil }
                return (location.coordinate.latitude, location.coordinate.longitude)
            },
            lastKnown: { [weak self] timeout in
                guard let self, let location = await self.lastKnownLocation(timeout: timeout) else { return nil }
                return (location.coordinate.latitude, location.coordinate.longitude)
            },
            isOnline: { FCNetworkMonitor.shared.isOnline }
        )
    }

    private func currentAuthorizationGranted() -> Bool {
        let status = manager.authorizationStatus
        #if os(iOS)
        return status == .authorizedWhenInUse || status == .authorizedAlways
        #else
        return status == .authorizedAlways || status == .authorized
        #endif
    }

    private func requestPermission() async -> Bool {
        if currentAuthorizationGranted() { return true }
        // Already denied / restricted: iOS shows no dialog and fires no callback.
        guard manager.authorizationStatus == .notDetermined else { return false }
        // No usage string in the host's Info.plist: iOS silently ignores the request (host
        // responsibility, documented in ios/README.md) — treat as a deny instead of hanging.
        let hasUsageString = Bundle.main.object(forInfoDictionaryKey: "NSLocationWhenInUseUsageDescription") != nil
            || Bundle.main.object(forInfoDictionaryKey: "NSLocationAlwaysAndWhenInUseUsageDescription") != nil
        guard hasUsageString else { return false }
        // Never leave an earlier continuation dangling.
        permissionContinuation?.resume(returning: false)
        return await withCheckedContinuation { continuation in
            permissionContinuation = continuation
            manager.requestWhenInUseAuthorization()
        }
    }

    private func fetchFreshLocation(timeout: TimeInterval) async -> CLLocation? {
        locationContinuation?.resume(returning: nil)
        locationContinuation = nil
        return await withCheckedContinuation { continuation in
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
