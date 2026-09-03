import XCTest
@testable import FarmerChatCore

/// Guards the capability-chip routing rule and the exact wire strings behind it.
/// Swift port of Android's `CapabilityChipTest`.
///
/// Background: every alignment chip used to send its own text as the question, so the two
/// CAPABILITY surfaces did nothing — `gps-prompt` never started the location flow and
/// `upload-photo` never opened a picker. A capability chip must invoke a capability and send only
/// the OUTCOME; every other chip still sends text.
///
/// The constants are asserted literally because they are easy to "helpfully" normalize and a
/// mismatch fails silently — the chip would fall through to the text path and the farmer would
/// send the string "share_precise_location" as their question.
final class CapabilityChipTests: XCTestCase {

    private func invoke(_ value: String) -> AlignmentChip {
        AlignmentChip(label: "l", value: value, action: AlignmentChip.actionSelect)
    }

    func testWireConstantsAreExactlyTheAppsStrings() {
        // ACTION_SELECT is "invoke", NOT "select"; and the location value is the *precise* one —
        // the app has a `share_location` constant commented out directly above it.
        XCTAssertEqual("invoke", AlignmentChip.actionSelect)
        XCTAssertEqual("share_precise_location", AlignmentChip.valueShareLocation)
        XCTAssertEqual("take_photo", AlignmentChip.valueTakePhoto)
        XCTAssertEqual("choose_from_gallery", AlignmentChip.valueChooseFromGallery)
        XCTAssertEqual("not_now", AlignmentChip.valueNotNow)
    }

    /// The label sent when the farmer declines: real key, English fallback, because endpoint #3
    /// does not serve it yet.
    func testDeclineLabelKeyAndFallback() {
        XCTAssertEqual(
            "fc_v2_app_label_location_permission_declined",
            AgenticLabels.locationPermissionDeclined
        )
        XCTAssertEqual(
            "Continue without sharing my location",
            AgenticLabels.locationPermissionDeclinedFallback
        )
        XCTAssertEqual("fc_v2_app_label_your_location", AgenticLabels.yourLocation)
    }

    /// `triggered_input_type` for a chip-triggered send (app parity).
    func testAlignChipSelInputType() {
        XCTAssertEqual("align_chip_sel", FCAlignChipSelInputType)
    }

    func testCapabilityChipsInvokeTheirCapability() {
        XCTAssertEqual(.shareLocation, invoke("share_precise_location").capability(for: .gpsPrompt))
        XCTAssertEqual(.takePhoto, invoke("take_photo").capability(for: .uploadPhoto))
        XCTAssertEqual(.chooseFromGallery, invoke("choose_from_gallery").capability(for: .uploadPhoto))
    }

    func testDeclineChipSendsTextItDoesNotInvokeAnything() {
        // "Not now" on a capability prompt is an ordinary answer to the blocking question.
        XCTAssertNil(invoke("not_now").capability(for: .gpsPrompt))
        XCTAssertNil(invoke("not_now").capability(for: .uploadPhoto))
    }

    func testActionMustBeInvokeForACapabilityChipToFire() {
        // A chip carrying the same value but no `invoke` action is a plain text chip.
        let noAction = AlignmentChip(label: "l", value: "share_precise_location", action: nil)
        XCTAssertNil(noAction.capability(for: .gpsPrompt))
        // ...and "select" is NOT the action string, however plausible it reads.
        let wrongAction = AlignmentChip(label: "l", value: "share_precise_location", action: "select")
        XCTAssertNil(wrongAction.capability(for: .gpsPrompt))
    }

    func testTheValueMustMatchItsOwnKind() {
        // take_photo under gps-prompt, or share_location under upload-photo, is not a capability.
        XCTAssertNil(invoke("take_photo").capability(for: .gpsPrompt))
        XCTAssertNil(invoke("share_precise_location").capability(for: .uploadPhoto))
    }

    func testNonCapabilitySurfacesAlwaysSendText() {
        for kind in [
            AlignmentKind.clarify, .confirm, .escalate, .genderSelect, .commodityConfirm
        ] {
            XCTAssertNil(
                invoke("share_precise_location").capability(for: kind),
                "\(kind) must not invoke a capability"
            )
        }
        // Unknown / absent surface type: a normal answer, so a normal chip.
        XCTAssertNil(invoke("take_photo").capability(for: nil))
    }

    func testOnlyTheTwoCapabilityKindsAreNonAdditivePromptsThatInvoke() {
        // Sanity-check the additive split the surfaces depend on.
        XCTAssertFalse(AlignmentKind.gpsPrompt.isAdditive)
        XCTAssertFalse(AlignmentKind.uploadPhoto.isAdditive)
        XCTAssertTrue(AlignmentKind.genderSelect.isAdditive)
        XCTAssertTrue(AlignmentKind.commodityConfirm.isAdditive)
    }

    /// Every capability is reachable from some (kind, value) pair — a `CaseIterable` guard so a
    /// future capability added to the enum but never routed fails here.
    func testEveryCapabilityIsReachable() {
        let routed: Set<AlignmentCapability> = [
            invoke(AlignmentChip.valueShareLocation).capability(for: .gpsPrompt),
            invoke(AlignmentChip.valueTakePhoto).capability(for: .uploadPhoto),
            invoke(AlignmentChip.valueChooseFromGallery).capability(for: .uploadPhoto)
        ].compactMap { $0 }.reduce(into: Set()) { $0.insert($1) }
        XCTAssertEqual(Set(AlignmentCapability.allCases), routed)
    }

    // MARK: - Location message

    /// The bubble the share-location outcome appends. A blank address must never reach it — the
    /// view model skips the append instead (app parity).
    func testLocationMessageCarriesItsAddressAndAStableId() {
        let message = ChatMessage.LocationMessage(address: "Nandi Hills, Nandi County, Kenya")
        XCTAssertEqual("Nandi Hills, Nandi County, Kenya", message.address)
        let entry = ChatMessage.location(message)
        XCTAssertEqual("location_\(message.id)", entry.id)
        // The prefixed id must not collide with the ai/user/loading namespaces.
        XCTAssertFalse(entry.id.hasPrefix("ai_"))
        XCTAssertFalse(entry.id.hasPrefix("user_"))
    }

    // MARK: - Location prompt events

    /// The chat flow arms on a chip tap and must be disarmed by whatever happens next, so every
    /// terminal outcome has to carry the source that produced it.
    func testLocationPromptEventsCarryTheirSource() {
        XCTAssertEqual(
            LocationPromptEvent.locationSaved(source: .localContext),
            LocationPromptEvent.locationSaved(source: .localContext)
        )
        XCTAssertNotEqual(
            LocationPromptEvent.locationSaved(source: .localContext),
            LocationPromptEvent.locationSaved(source: .weather)
        )
        XCTAssertNotEqual(
            LocationPromptEvent.locationSaved(source: .localContext),
            LocationPromptEvent.skipped(source: .localContext)
        )
        // Kept payload-free: FarmerChatView compares this one with `==`.
        XCTAssertEqual(
            LocationPromptEvent.locationUpdatedFromWidget,
            LocationPromptEvent.locationUpdatedFromWidget
        )
    }
}
