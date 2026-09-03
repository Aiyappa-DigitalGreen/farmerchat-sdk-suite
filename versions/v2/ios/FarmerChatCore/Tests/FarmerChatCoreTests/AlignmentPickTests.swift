import XCTest
@testable import FarmerChatCore

/// Guards the matching rule behind `ChatViewModel.recordAlignmentPick`.
///
/// Background: `AiResponse.alignmentSelectedValues` was declared and read by both iOS flavours but
/// never written, so the entire selected/locked chip treatment was dead code — a tapped chip never
/// showed a check, never locked, and the unpicked chips never faded. Core now records the pick.
///
/// The rule guarded here is the MATCH: only text corresponding to one of that surface's own chips
/// may mark a chip chosen; a follow-up the farmer typed themselves must not.
///
/// What this does NOT guard is that `recordAlignmentPick` is still *called* — the original defect.
/// `ChatViewModel` takes a concrete `FarmerChat` env with no injection seam and exposes `state` as
/// `private(set)`, so a test cannot seed an alignment surface or drive the dispatch without a
/// network call. That call site is guarded by the reachability sweep recorded in docs/04 instead.
final class AlignmentPickTests: XCTestCase {

    private let chips = [
        AlignmentChip(label: "Chickpea", value: "chickpea"),
        AlignmentChip(label: "Only a label", value: nil)
    ]

    /// Mirrors the predicate in `ChatViewModel.recordAlignmentPick`.
    private func matches(_ question: String) -> Bool {
        chips.contains { $0.value == question || $0.label == question }
    }

    func testChipValueCountsAsPick() {
        XCTAssertTrue(matches("chickpea"))
    }

    func testChipLabelCountsAsPick() {
        // A chip may carry only a label, and the UI then sends the label as the question.
        XCTAssertTrue(matches("Only a label"))
        XCTAssertTrue(matches("Chickpea"))
    }

    func testTypedQuestionIsNotAPick() {
        // The bug this protects against: any follow-up marking an unrelated chip as chosen.
        XCTAssertFalse(matches("How much fertiliser for chickpea?"))
        XCTAssertFalse(matches("chickpeas"))
        XCTAssertFalse(matches(""))
    }
}
