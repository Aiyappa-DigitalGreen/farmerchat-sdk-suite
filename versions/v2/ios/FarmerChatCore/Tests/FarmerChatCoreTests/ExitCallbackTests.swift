import XCTest
@testable import FarmerChatCore

/// The CHAT_ONLY Close (X) must reach the host's `FarmerChatConfig.onExit` (2026-10-09 report:
/// "clicking close is not closing the chat interface"). Inline-embedded SDK UI cannot remove
/// itself, so a dropped callback means the X does nothing at all.
final class ExitCallbackTests: XCTestCase {
    private final class Counter: @unchecked Sendable {
        private let lock = NSLock()
        private var value = 0
        func bump() { lock.lock(); value += 1; lock.unlock() }
        var count: Int { lock.lock(); defer { lock.unlock() }; return value }
    }

    func testDispatcherExitInvokesOnExit() {
        let counter = Counter()
        let analytics = AnalyticsDispatcher(handler: nil, onExit: { counter.bump() })
        analytics.exit()
        XCTAssertEqual(counter.count, 1)
    }

    /// onExit is a lifecycle callback, not telemetry — it must fire with analytics off (default).
    func testExitFiresEvenWhenAnalyticsDisabled() {
        let counter = Counter()
        let analytics = AnalyticsDispatcher(handler: nil, onExit: { counter.bump() }, enabled: false)
        analytics.exit()
        XCTAssertEqual(counter.count, 1)
    }

    func testExitWithoutHostCallbackIsNoOp() {
        AnalyticsDispatcher(handler: nil).exit()
    }

    /// The config field is carried through `FarmerChat.initialize` into the shared dispatcher —
    /// the web bug was exactly this hop silently dropping `onExit`.
    func testConfigOnExitIsWiredThroughInitialize() {
        let counter = Counter()
        let fc = FarmerChat.initialize(config: FarmerChatConfig(environment: .dev, onExit: { counter.bump() }))
        fc.analytics.exit()
        XCTAssertEqual(counter.count, 1)
    }
}
