import XCTest
import Combine
@testable import FarmerChatCore

/// Decision tree, deny-count recovery, exits and quiet fetch fallback of `LocationPromptManager`
/// — the iOS port of the app's `core/location/LocationPromptManager.kt` (2026-10-06).
@MainActor
final class LocationPromptFlowTests: XCTestCase {

    private final class Recorder: @unchecked Sendable {
        private let lock = NSLock()
        private var _names: [String] = []
        func add(_ name: String) { lock.lock(); _names.append(name); lock.unlock() }
        var names: [String] { lock.lock(); defer { lock.unlock() }; return _names }
    }

    private struct Fake {
        var online = true
        var permission = false
        var services = true
        var grantOnRequest = false
        var fresh: (lat: Double, lng: Double)? = (12.9, 77.5)
        var lastKnown: (lat: Double, lng: Double)? = nil
        var userId: String? = nil
        var apiSucceeds = true
    }

    private var fake = Fake()
    private var prefs: PreferenceStore!
    private var recorder = Recorder()
    private var events: [LocationPromptEvent] = []
    private var cancellables = Set<AnyCancellable>()
    private var requestCount = 0
    private var freshCount = 0

    override func setUp() async throws {
        let suite = "fc_sdk_test_location_\(UUID().uuidString)"
        prefs = PreferenceStore(defaults: UserDefaults(suiteName: suite)!)
        fake = Fake()
        recorder = Recorder()
        events = []
        requestCount = 0
        freshCount = 0
    }

    private func makeManager() -> LocationPromptManager {
        let rec = recorder
        let analytics = AnalyticsDispatcher(handler: { name, _ in rec.add(name) }, enabled: true)
        let env = LocationPromptEnvironment(
            prefs: prefs,
            analytics: analytics,
            userId: { [unowned self] in self.fake.userId },
            updateUserLocation: { [unowned self] _ in
                self.fake.apiSucceeds
                    ? .success(GetLocationResponse(message: nil, country: "India", state: "KA", district: "BLR", error: nil))
                    : .error(ApiError(code: 500, apiName: "update_user_location"))
            }
        )
        let platform = LocationPromptPlatform(
            hasPermission: { [unowned self] in self.fake.permission },
            servicesEnabled: { [unowned self] in self.fake.services },
            requestPermission: { [unowned self] in
                // Mirrors the production platform: an already-held permission returns true at once.
                if self.fake.permission { return true }
                self.requestCount += 1
                if self.fake.grantOnRequest { self.fake.permission = true }
                return self.fake.grantOnRequest
            },
            fetchFresh: { [unowned self] _ in self.freshCount += 1; return self.fake.fresh },
            lastKnown: { [unowned self] _ in self.fake.lastKnown },
            isOnline: { [unowned self] in self.fake.online }
        )
        let manager = LocationPromptManager(environment: env, platform: platform)
        manager.events.sink { [unowned self] in self.events.append($0) }.store(in: &cancellables)
        return manager
    }

    /// Lets the effect tasks run to completion.
    private func settle() async {
        for _ in 0..<50 { await Task.yield() }
    }

    // MARK: - Decision tree

    func testOfflineIsRetryableNoNetworkError() async {
        fake.online = false
        let m = makeManager()
        m.triggerFromLocalContext()
        XCTAssertEqual(m.state, .error(.noNetwork))
        XCTAssertTrue(m.errorCanRetry)
    }

    func testOnlyWeatherShowsInterstitial() async {
        let weather = makeManager()
        weather.triggerFromWeather()
        XCTAssertEqual(weather.state, .interstitial)
        XCTAssertTrue(recorder.names.contains(AnalyticsEvents.screenViewed))

        fake.grantOnRequest = false
        let chip = makeManager()
        chip.triggerFromLocalContext()
        XCTAssertEqual(chip.state, .requestPermission, "chat chip goes straight to the system dialog")
        XCTAssertTrue(recorder.names.contains(AnalyticsEvents.permissionPopupShown))
        XCTAssertTrue(recorder.names.contains(AnalyticsEvents.locationPermissionPromptTriggered))
    }

    func testWeatherWithStoredFixRunsNavigationWithoutFlow() async {
        prefs.setDouble(1, .latitude)
        prefs.setDouble(2, .longitude)
        let m = makeManager()
        var navigated = false
        m.triggerFromWeather { navigated = true }
        XCTAssertTrue(navigated)
        XCTAssertEqual(m.state, .idle)
        XCTAssertTrue(events.isEmpty)
    }

    func testCampaignWithPermissionSkipsDialog() async {
        fake.permission = true
        let m = makeManager()
        m.triggerFromWidget()
        XCTAssertEqual(m.state, .requestEnableGps)
        XCTAssertTrue(m.isCampaignLocationLoading)
        await settle()
        XCTAssertEqual(requestCount, 0)
        XCTAssertEqual(events, [.locationSaved(source: .widget)], "guest save is immediate")
    }

    // MARK: - Deny count

    func testFirstDenyContinuesSecondDenyRecovers() async {
        let m = makeManager()
        var navigations = 0
        m.triggerFromWeather { navigations += 1 }
        m.shareLocationTapped()
        await settle()
        XCTAssertEqual(m.state, .idle)
        XCTAssertEqual(prefs.int(.permissionDenyCount), 1)
        XCTAssertEqual(events, [.skipped(source: .weather)])
        XCTAssertEqual(navigations, 1, "first deny still runs the pending navigation")

        m.triggerFromWeather { navigations += 1 }
        m.shareLocationTapped()
        await settle()
        XCTAssertEqual(m.state, .recovery)
        XCTAssertEqual(prefs.int(.permissionDenyCount), 2)

        m.recoveryClosed()
        XCTAssertEqual(m.state, .idle)
        XCTAssertEqual(navigations, 2)
        XCTAssertTrue(recorder.names.contains(AnalyticsEvents.permissionFallbackSettingCanceled))

        // Third trigger: straight to Recovery, every source.
        let chip = makeManager()
        chip.triggerFromLocalContext()
        XCTAssertEqual(chip.state, .recovery)
    }

    func testRecoveryForegroundWithPermissionReturnsToInterstitialForWeather() async {
        prefs.setInt(2, .permissionDenyCount)
        let m = makeManager()
        m.triggerFromWeather()
        XCTAssertEqual(m.state, .recovery)
        fake.permission = true
        m.onAppForeground()
        XCTAssertEqual(m.state, .interstitial)
    }

    func testRecoveryForegroundCampaignWithStoredFixIsSuccess() async {
        prefs.setInt(2, .permissionDenyCount)
        prefs.setDouble(1, .latitude)
        prefs.setDouble(2, .longitude)
        let m = makeManager()
        m.triggerFromWidget()
        XCTAssertEqual(m.state, .recovery)
        fake.permission = true
        m.onAppForeground()
        XCTAssertEqual(m.state, .idle)
        XCTAssertEqual(events, [.locationSaved(source: .widget)])
        XCTAssertEqual(prefs.int(.permissionDenyCount), 0)
    }

    // MARK: - Exits

    func testBackDropsNavigationSkipRunsIt() async {
        let m = makeManager()
        var navigated = false
        m.triggerFromWeather { navigated = true }
        m.cancel()
        XCTAssertFalse(navigated)
        XCTAssertEqual(events, [.skipped(source: .weather)])

        m.triggerFromWeather { navigated = true }
        m.skipTapped()
        XCTAssertTrue(navigated)
        XCTAssertEqual(m.state, .idle)
        XCTAssertTrue(recorder.names.contains(AnalyticsEvents.screenExited))
    }

    func testSilentDismissEmitsNothing() async {
        fake.online = false
        let m = makeManager()
        var navigated = false
        m.triggerFromWeather { navigated = true }
        XCTAssertEqual(m.state, .error(.noNetwork))
        m.dismiss(emitContinue: false)
        XCTAssertEqual(m.state, .idle)
        XCTAssertFalse(navigated)
        XCTAssertTrue(events.isEmpty)
    }

    // MARK: - GPS

    func testGpsOffWeatherContinuesOthersGetNonRetryableError() async {
        fake.permission = true
        fake.services = false
        let weather = makeManager()
        var navigated = false
        weather.triggerFromWeather { navigated = true }
        XCTAssertEqual(weather.state, .interstitial)
        weather.shareLocationTapped()
        await settle()
        XCTAssertEqual(weather.state, .idle)
        XCTAssertTrue(navigated)

        events = []
        let chip = makeManager()
        chip.triggerFromLocalContext()
        await settle()
        XCTAssertEqual(chip.state, .error(.gpsUnavailable))
        XCTAssertFalse(chip.errorCanRetry)
        chip.onErrorCta()
        XCTAssertEqual(chip.state, .idle, "non-retryable CTA closes instead of re-prompting")
        XCTAssertEqual(events, [.skipped(source: .localContext)])
    }

    func testServicesOffDoesNotCountAsDeny() async {
        fake.services = false
        let m = makeManager()
        m.triggerFromLocalContext()
        await settle()
        XCTAssertEqual(prefs.int(.permissionDenyCount), 0)
        XCTAssertEqual(requestCount, 0)
        XCTAssertEqual(m.state, .error(.gpsUnavailable))
    }

    // MARK: - Fetch

    func testFailedFixRetriesOnceThenEndsQuietly() async {
        fake.permission = true
        fake.fresh = nil
        let m = makeManager()
        var navigated = false
        m.triggerFromWeather { navigated = true }
        m.shareLocationTapped()
        await settle()
        XCTAssertEqual(freshCount, 2)
        XCTAssertEqual(m.state, .idle, "no error screen for a failed fix")
        XCTAssertEqual(events, [.skipped(source: .weather)])
        XCTAssertTrue(navigated)
    }

    func testLastKnownFallbackAfterRetry() async {
        fake.permission = true
        fake.fresh = nil
        fake.lastKnown = (1, 2)
        let m = makeManager()
        m.triggerFromLocalContext()
        await settle()
        XCTAssertEqual(events, [.locationSaved(source: .localContext)])
        XCTAssertEqual(prefs.double(.latitude), 1)
    }

    func testLoggedInSavesOnlyAfterApiSuccess() async {
        fake.permission = true
        fake.userId = "u1"
        fake.apiSucceeds = false
        let m = makeManager()
        m.triggerFromLocalContext()
        await settle()
        XCTAssertNil(prefs.double(.latitude), "nothing saved when update_user_location fails")
        XCTAssertEqual(events, [.skipped(source: .localContext)])

        events = []
        fake.apiSucceeds = true
        m.triggerFromWidget()
        await settle()
        XCTAssertEqual(prefs.double(.latitude), 12.9)
        XCTAssertEqual(prefs.string(.userDistrict), "BLR")
        XCTAssertEqual(events, [.locationUpdatedFromWidget, .locationSaved(source: .widget)])
    }
}
