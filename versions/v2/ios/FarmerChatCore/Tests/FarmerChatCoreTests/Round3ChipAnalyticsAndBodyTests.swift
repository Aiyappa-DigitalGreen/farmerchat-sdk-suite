import XCTest
@testable import FarmerChatCore

/// Chip analytics keys (app SendQueryAnalytics.kt:118-150), the exact #27a bodies of the capability
/// declines and the photo send, and voice-history text.
@MainActor
final class Round3ChipAnalyticsAndBodyTests: XCTestCase {

    private var suiteName = ""
    private var defaults: UserDefaults!

    override func setUp() {
        super.setUp()
        suiteName = "fc_sdk_test_\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)!
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        super.tearDown()
    }

    private var labels: LabelManager { LabelManager(prefs: PreferenceStore(defaults: defaults)) }

    // MARK: - agentic_chip_* + click_type

    func testNoChipSendCarriesAllSevenKeysWithAppDefaults() {
        let props = ChipAnalytics.none.merged(into: ["input_type": "text"], triggeredInputType: "text")
        XCTAssertEqual(props["agentic_chip_status"], "none")
        for key in ["agentic_chip_skipped_type", "agentic_chip_shown_type", "agentic_chip_type",
                    "agentic_chip_value", "agentic_chip_label"] {
            XCTAssertEqual(props[key], "", key)
        }
        XCTAssertEqual(props["click_type"], "text")
        XCTAssertEqual(props["input_type"], "text", "existing keys are kept")
    }

    func testChipTapIsSelectedWithAlignChipSelClickType() {
        let chip = ChipAnalytics.selected(type: "alignment-clarify", value: "not_sure", label: "Not sure")
        let props = chip.merged(into: [:], triggeredInputType: "align_chip_sel")
        XCTAssertEqual(props["agentic_chip_status"], "selected")
        XCTAssertEqual(props["agentic_chip_type"], "alignment-clarify")
        XCTAssertEqual(props["agentic_chip_value"], "not_sure")
        XCTAssertEqual(props["agentic_chip_label"], "Not sure")
        XCTAssertEqual(props["agentic_chip_skipped_type"], "")
        XCTAssertEqual(props["click_type"], "align_chip_sel")
    }

    func testTypingPastUnpickedChipsIsSkipped() {
        let surface = ChatMessage.AiResponse(
            text: "What stage?", id: "a1", alignmentKind: .clarify,
            alignmentChips: [AlignmentChip(label: "Seedling", value: "seedling")]
        )
        var messages: [ChatMessage] = [.user(ChatMessage.UserMessage(text: "q")), .aiResponse(surface)]
        let skipped = ChipAnalytics.manualSend(messages: messages).merged(into: [:], triggeredInputType: "text")
        XCTAssertEqual(skipped["agentic_chip_status"], "skipped")
        XCTAssertEqual(skipped["agentic_chip_skipped_type"], "alignment-clarify")
        XCTAssertEqual(skipped["click_type"], "text")

        // Once a chip was picked, a typed send is no longer a skip.
        var picked = surface
        picked.alignmentSelectedValues = ["seedling"]
        messages[1] = .aiResponse(picked)
        XCTAssertEqual(ChipAnalytics.manualSend(messages: messages), .none)
    }

    func testClickTypeMapping() {
        XCTAssertEqual(ChipAnalytics.clickType(triggeredInputType: "follow_up", isAlignmentChip: false), "follow-up")
        XCTAssertEqual(ChipAnalytics.clickType(triggeredInputType: "weather", isAlignmentChip: false), "Weather")
        XCTAssertEqual(ChipAnalytics.clickType(triggeredInputType: "ssfr", isAlignmentChip: false), "SSFR")
        XCTAssertEqual(ChipAnalytics.clickType(triggeredInputType: "read_full_advice", isAlignmentChip: false), "read_full_advice")
        XCTAssertEqual(ChipAnalytics.clickType(triggeredInputType: "voice", isAlignmentChip: false), "voice")
        XCTAssertEqual(ChipAnalytics.clickType(triggeredInputType: "image", isAlignmentChip: false), "image")
        XCTAssertEqual(ChipAnalytics.clickType(triggeredInputType: "follow_up", isAlignmentChip: true), "align_chip_sel",
                       "a chip tap wins the precedence, as in the app")
    }

    // MARK: - Exact request bodies

    private func json(_ request: TextPromptRequest) throws -> [String: Any] {
        try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: Any])
    }

    private func declineBody(_ decline: CapabilityDecline) throws -> [String: Any] {
        let send = CapabilityDeclineSend(decline, labels: labels)
        return try json(ChatViewModel.makeTextPromptRequest(
            query: send.query,
            conversationId: "conv-1",
            triggeredInputType: "align_chip_sel",
            streamingRequired: true,
            parentMessageId: "srv-msg-9",
            locationDeclined: send.locationDeclined,
            photoDeclined: send.photoDeclined
        ))
    }

    func testLocationDeclineBody() throws {
        let body = try declineBody(.location)
        XCTAssertEqual(body as NSDictionary, [
            "query": "Continue without sharing my location",
            "conversation_id": "conv-1",
            "message_id": "",
            "weather_cta_triggered": false,
            "triggered_input_type": "align_chip_sel",
            "use_entity_extraction": true,
            "retry": false,
            "streaming_required": true,
            "parent_message_id": "srv-msg-9",
            "location_declined": true
        ] as NSDictionary)
    }

    func testPhotoDeclineBodies() throws {
        let denied = try declineBody(.photoPermissionDenied)
        XCTAssertEqual(denied["query"] as? String, "I don't want to share a photo right now")
        XCTAssertEqual(denied["photo_declined"] as? Bool, true)
        XCTAssertNil(denied["location_declined"])
        XCTAssertEqual(denied["parent_message_id"] as? String, "srv-msg-9")

        let notShared = try declineBody(.photoNotShared)
        XCTAssertEqual(notShared["query"] as? String, "I don't have a photo to share right now")
        XCTAssertEqual(notShared["photo_declined"] as? Bool, true)
        XCTAssertEqual(notShared["triggered_input_type"] as? String, "align_chip_sel")
    }

    func testDeclineAnalyticsFields() {
        XCTAssertEqual(CapabilityDeclineSend(.location, labels: labels).chipType, "gps-prompt")
        XCTAssertEqual(CapabilityDeclineSend(.photoNotShared, labels: labels).chipType, "upload-photo")
    }

    func testAgenticPhotoBody() throws {
        let body = try json(ChatViewModel.makeTextPromptRequest(
            query: ChatViewModel.imageQueryForApi("  ", defaultQuery: "What is wrong with my crop?"),
            conversationId: "conv-1",
            triggeredInputType: "image",
            streamingRequired: true,
            image: "QUJD",
            imageName: "image_x.jpg"
        ))
        XCTAssertEqual(body["query"] as? String, "What is wrong with my crop?")
        XCTAssertEqual(body["triggered_input_type"] as? String, "image")
        XCTAssertEqual(body["image"] as? String, "QUJD")
        XCTAssertEqual(body["image_name"] as? String, "image_x.jpg")
        XCTAssertNil(body["parent_message_id"])
        XCTAssertEqual(ChatViewModel.imageQueryForApi("Spots on leaves", defaultQuery: "x"), "Spots on leaves")
    }

    // MARK: - Voice history text (app ChatViewModel.kt:1273)

    func testVoiceHistoryPrefersQueryText() throws {
        let json = #"{"data":[{"message_type_id":2,"query_text":"typed text","heard_query_text":"heard text"},{"message_type_id":2,"heard_query_text":"only heard"}]}"#
        let page = try JSONDecoder().decode(ConversationChatHistoryResponse.self, from: Data(json.utf8))
        let texts = ChatViewModel.mapHistory(page.messages).compactMap { m -> String? in
            if case .user(let u) = m { return u.text }; return nil
        }
        XCTAssertEqual(texts, ["typed text", "only heard"])
    }
}
