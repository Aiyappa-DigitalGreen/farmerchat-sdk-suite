import XCTest
@testable import FarmerChatCore

/// Covers `sanitizeAgenticFinalText` — the settled-answer clean-up. Regression for the stage
/// backend leaking the follow-up control block into `metadata.response` (weather answer, 2026-10-06).
final class AgenticFinalTextTests: XCTestCase {

    func testCleanAnswerIsUntouched() {
        XCTAssertEqual(sanitizeAgenticFinalText("Use neem oil weekly."), "Use neem oil weekly.")
    }

    func testClosedFollowupsBlockIsRemoved() {
        let raw = "Conditions are fine.\n\n```followups\n[\"Will it rain later today?\"]\n```"
        XCTAssertEqual(sanitizeAgenticFinalText(raw), "Conditions are fine.")
    }

    func testUnclosedTrailingBlockIsRemoved() {
        XCTAssertEqual(sanitizeAgenticFinalText("Answer.\n```followups\n[\"Q?\"]"), "Answer.")
    }

    func testMarkersRemovedButLoneAnglePairKept() {
        XCTAssertEqual(sanitizeAgenticFinalText("Answer.<<commodities:chickpea>>"), "Answer.")
        XCTAssertEqual(sanitizeAgenticFinalText("Ratio a << b holds."), "Ratio a << b holds.")
    }
}
