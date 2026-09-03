import XCTest
@testable import FarmerChatCore

/// Guards the "did we actually get a location?" rule and the terminal-source filter behind it.
/// Swift counterpart of Android's `LocationOutcomeTest`.
///
/// Background: the chat GPS_PROMPT flow arms itself on a chip tap and waits for a terminal event.
/// Two bugs lived here:
///
///  1. Nothing was emitted on the decline paths. `runLocationFlow` parks in `.recovery`
///     (permission denied) or `.error` (GPS off / fetch failed) and returns, and `dismissError()`
///     just called `reset()` — so the chat stayed armed forever and the farmer's blocking question
///     was never answered. `dismissError()` now emits a terminal ``LocationPromptEvent/skipped``.
///  2. That fix creates the opposite trap: "settled" is not "successful". A caller treating any
///     terminal event as success would show a location bubble for a location never shared.
///
/// The predicate lives in Core (not duplicated per flavour) precisely so the two rules cannot
/// drift apart between SwiftUI and UIKit.
final class LocationOutcomeTests: XCTestCase {

    func testASavedLocationIsObtained() {
        XCTAssertTrue(LocationPromptEvent.locationSaved(source: .localContext).isLocationObtained)
        // Source does not change the answer — only the case does.
        XCTAssertTrue(LocationPromptEvent.locationSaved(source: .weather).isLocationObtained)
    }

    func testASkippedOrDismissedFlowIsNotObtained() {
        // The whole point of the dismiss emission: it settles the caller WITHOUT claiming success.
        // `.skipped` covers Android's `Cancel` AND its `Continue(reason = "dismissed")`.
        XCTAssertFalse(LocationPromptEvent.skipped(source: .localContext).isLocationObtained)
        XCTAssertFalse(LocationPromptEvent.skipped(source: .weather).isLocationObtained)
    }

    func testAWidgetUpdateIsNotALocationObtainedOutcome() {
        // A widget update refreshes Home; it is not an answer to an armed chat request.
        XCTAssertFalse(LocationPromptEvent.locationUpdatedFromWidget.isLocationObtained)
    }

    /// iOS needs no `LOCATION_OBTAINED_REASONS` set: it has no `reason` field, because it has no
    /// overloaded `Continue` case for a reason string to disambiguate. This pins that shape down —
    /// exactly one case answers true, so a case added later cannot silently join the success side.
    func testExactlyOneCaseIsASuccess() {
        let all: [LocationPromptEvent] = [
            .locationUpdatedFromWidget,
            .locationSaved(source: .localContext),
            .skipped(source: .localContext)
        ]
        XCTAssertEqual(1, all.filter(\.isLocationObtained).count)
    }

    // MARK: - Terminal source filter

    func testTerminalSourceIdentifiesTheFlowAnOutcomeBelongsTo() {
        // An armed chat surface must act only on its OWN flow's outcome.
        XCTAssertEqual(.localContext, LocationPromptEvent.locationSaved(source: .localContext).terminalSource)
        XCTAssertEqual(.localContext, LocationPromptEvent.skipped(source: .localContext).terminalSource)
        XCTAssertEqual(.weather, LocationPromptEvent.locationSaved(source: .weather).terminalSource)
        XCTAssertEqual(.widget, LocationPromptEvent.skipped(source: .widget).terminalSource)
        XCTAssertEqual(.deeplink, LocationPromptEvent.locationSaved(source: .deeplink).terminalSource)
    }

    func testAWidgetUpdateIsNotATerminalPerFlowOutcome() {
        // Nil, so the chat collector ignores it rather than mistaking it for its own outcome —
        // and so `terminalSource == .localContext` is a complete filter on its own.
        XCTAssertNil(LocationPromptEvent.locationUpdatedFromWidget.terminalSource)
    }

    /// The full decision the flavours make, asserted as a table: act only on a terminal outcome
    /// whose source is this screen's, and treat only a saved location as success.
    func testTheChatCollectorsDecisionTable() {
        func decision(_ event: LocationPromptEvent) -> String {
            guard event.terminalSource == .localContext else { return "ignore" }
            return event.isLocationObtained ? "location-bubble" : "decline-query"
        }
        XCTAssertEqual("location-bubble", decision(.locationSaved(source: .localContext)))
        XCTAssertEqual("decline-query", decision(.skipped(source: .localContext)))
        XCTAssertEqual("ignore", decision(.locationSaved(source: .weather)))
        XCTAssertEqual("ignore", decision(.skipped(source: .weather)))
        XCTAssertEqual("ignore", decision(.locationUpdatedFromWidget))
    }
}
