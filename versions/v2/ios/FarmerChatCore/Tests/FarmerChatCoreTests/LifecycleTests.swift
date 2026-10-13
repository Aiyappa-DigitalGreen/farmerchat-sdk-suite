import XCTest
import Combine
@testable import FarmerChatCore

/// Re-initialize / shutdown / clearAllData / static auth listeners (Android `FarmerChat` parity).
final class LifecycleTests: XCTestCase {

    private final class Recorder: @unchecked Sendable {
        private let lock = NSLock()
        private var _values: [Bool] = []
        var values: [Bool] { lock.lock(); defer { lock.unlock() }; return _values }
        func add(_ value: Bool) { lock.lock(); _values.append(value); lock.unlock() }
    }

    override func setUp() {
        super.setUp()
        FarmerChat.shutdown()
    }

    override func tearDown() {
        FarmerChat.shutdown()
        super.tearDown()
    }

    func testEquivalentReinitializeIsNoOp() {
        let first = FarmerChat.initialize(config: FarmerChatConfig(environment: .dev, fabLabel: "one"))
        let second = FarmerChat.initialize(config: FarmerChatConfig(environment: .dev, fabLabel: "two"))
        XCTAssertTrue(first === second)
        XCTAssertEqual(FarmerChat.shared.config.fabLabel, "one", "first config wins for other fields")
    }

    func testEquivalentReinitializeAppliesNewHostToken() throws {
        func config(_ token: String) -> FarmerChatConfig {
            FarmerChatConfig(environment: .dev, authMode: .hostToken, accessToken: token, refreshToken: "r-" + token)
        }
        let fc = FarmerChat.initialize(config: config("t1"))
        guard fc.tokenStore.accessToken == "t1" else { throw XCTSkip("Keychain unavailable in this test host") }

        let kept = FarmerChat.initialize(config: config("t2"))
        XCTAssertTrue(kept === fc, "no rebuild")
        XCTAssertEqual(fc.tokenStore.accessToken, "t2")
        XCTAssertEqual(fc.tokenStore.refreshToken, "r-t2")
        XCTAssertEqual(fc.config.accessToken, "t2")

        // An identical repeat does not re-push: a token stored since then survives.
        fc.updateTokens(access: "rotated")
        FarmerChat.initialize(config: config("t2"))
        XCTAssertEqual(fc.tokenStore.accessToken, "rotated")
        fc.tokenStore.clear()
        PreferenceStore().remove(.otpVerified)
        PreferenceStore().remove(.nameScreenSeen)
    }

    func testShapeChangeRebuilds() {
        let base = FarmerChat.initialize(config: FarmerChatConfig(environment: .dev, mode: .chatOnly))
        let byMode = FarmerChat.initialize(config: FarmerChatConfig(environment: .dev, mode: .fullJourney))
        XCTAssertFalse(base === byMode)
        let bySettings = FarmerChat.initialize(config: FarmerChatConfig(environment: .dev, mode: .fullJourney, showSettings: false))
        XCTAssertFalse(byMode === bySettings)
        XCTAssertTrue(FarmerChat.shared === bySettings)
    }

    func testStaticAuthListenerSurvivesRebuild() {
        let recorder = Recorder()
        let unsubscribe = FarmerChat.onAuthStateChanged { recorder.add($0) }
        defer { unsubscribe() }
        XCTAssertEqual(recorder.values, [false], "fires immediately with the pre-initialize value")

        FarmerChat.initialize(config: FarmerChatConfig(environment: .dev, mode: .chatOnly))
        let rebuilt = FarmerChat.initialize(config: FarmerChatConfig(environment: .dev, mode: .fullJourney))

        // A change AFTER the rebuild must reach the listener through the new instance.
        let before = recorder.values.count
        let fired = expectation(description: "auth true delivered after rebuild")
        rebuilt.session.markHostAuthenticated()
        DispatchQueue.main.async { fired.fulfill() }
        wait(for: [fired], timeout: 2)
        XCTAssertEqual(recorder.values.dropFirst(before).last, true)

        unsubscribe()
        let count = recorder.values.count
        rebuilt.session.expireSession()
        let drained = expectation(description: "main drained")
        DispatchQueue.main.async { drained.fulfill() }
        wait(for: [drained], timeout: 2)
        XCTAssertEqual(recorder.values.count, count, "unsubscribed listener is not called")
        PreferenceStore().remove(.otpVerified)
        PreferenceStore().remove(.nameScreenSeen)
    }

    func testShutdownMakesSdkUninitialized() {
        FarmerChat.initialize(config: FarmerChatConfig(environment: .dev))
        XCTAssertTrue(FarmerChat.isInitialized)
        FarmerChat.shutdown()
        XCTAssertFalse(FarmerChat.isInitialized)
        FarmerChat.shutdown() // idempotent
        XCTAssertFalse(FarmerChat.isInitialized)
        // A fresh initialize after shutdown builds a new instance.
        FarmerChat.initialize(config: FarmerChatConfig(environment: .dev))
        XCTAssertTrue(FarmerChat.isInitialized)
    }

    func testClearAllDataRemovesOnlyNamespacedKeysAndFlipsAuth() {
        let defaults = UserDefaults.standard
        let fc = FarmerChat.initialize(config: FarmerChatConfig(environment: .dev))
        fc.prefs.setString("night", .appearanceMode)
        defaults.set("x", forKey: "fc_sdk_unlisted_key")
        defaults.set("keep", forKey: "host_app_key")
        fc.tokenStore.saveTokens(access: "a", refresh: "r")
        let keychainWorks = fc.tokenStore.accessToken == "a"

        let recorder = Recorder()
        fc.session.markHostAuthenticated()
        let authed = expectation(description: "authenticated")
        DispatchQueue.main.async { authed.fulfill() }
        wait(for: [authed], timeout: 2)
        let unsubscribe = FarmerChat.onAuthStateChanged { recorder.add($0) }
        defer { unsubscribe() }

        FarmerChat.clearAllData()
        let cleared = expectation(description: "cleared")
        DispatchQueue.main.async { cleared.fulfill() }
        wait(for: [cleared], timeout: 2)

        XCTAssertTrue(FarmerChat.isInitialized, "SDK stays initialized")
        XCTAssertFalse(fc.isAuthenticated)
        XCTAssertEqual(recorder.values, [true, false], "listener saw the wipe flip auth")
        XCTAssertTrue(defaults.dictionaryRepresentation().keys.filter { $0.hasPrefix("fc_sdk_") }.isEmpty)
        XCTAssertNil(fc.prefs.string(.appearanceMode), "appearance is wiped too")
        if keychainWorks {
            XCTAssertNil(fc.tokenStore.accessToken)
            XCTAssertNil(fc.tokenStore.refreshToken)
        }
        XCTAssertEqual(defaults.string(forKey: "host_app_key"), "keep")
        defaults.removeObject(forKey: "host_app_key")
    }

    func testDebugLogLineCarriesPathOnly() {
        var request = URLRequest(url: URL(string: "https://example.org/base/api/user/x/?token=secret")!)
        request.httpMethod = "POST"
        request.setValue("rid-1", forHTTPHeaderField: "X-Request-ID")
        XCTAssertEqual(
            NetworkLog.line(request, outcome: "200", ms: 12),
            "[FarmerChat] POST /base/api/user/x/ -> 200 (12ms) rid=rid-1"
        )
        let timeout = NSError(domain: NSURLErrorDomain, code: NSURLErrorTimedOut)
        XCTAssertEqual(NetworkLog.shortReason(timeout), "timeout")
    }

    func testDebugLoggingFollowsConfig() {
        FarmerChat.initialize(config: FarmerChatConfig(environment: .dev, debugLogging: true))
        XCTAssertTrue(NetworkLog.enabled)
        FarmerChat.shutdown()
        XCTAssertFalse(NetworkLog.enabled)
        FarmerChat.initialize(config: FarmerChatConfig(environment: .dev))
        XCTAssertFalse(NetworkLog.enabled)
    }
}
