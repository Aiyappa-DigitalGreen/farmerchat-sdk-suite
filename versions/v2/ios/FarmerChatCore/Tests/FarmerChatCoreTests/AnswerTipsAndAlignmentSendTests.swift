import XCTest
@testable import FarmerChatCore

/// Server tip discovery (app `ChatLoadingContent.kt answerGenerationTips()`), the alignment-chip
/// send arguments (app `onAlignmentChipClick` → `sendAlignmentChip`) and the three
/// alignment fields on the #27 / #27a body.
final class AnswerTipsAndAlignmentSendTests: XCTestCase {

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

    private func manager(lang: String = "en", labels: [String: String]) -> LabelManager {
        let prefs = PreferenceStore(defaults: defaults)
        prefs.setString(lang, .selectedLanguageCode)
        let manager = LabelManager(prefs: prefs)
        manager.update(labels: labels)
        return manager
    }

    // MARK: - Tips

    func testServerTipsAreDiscoveredSortedAndPaired() {
        // The DEMO label set as served on 2026-10-16 (subset), including the decoys that must
        // NOT become tips: a `_title_statement_` key and plain single-label tip keys.
        let tips = manager(labels: [
            "fc_v2_app_label_tips_try_this_title_en": "Try this",
            "fc_v2_app_label_tips_try_this_statement_en": "Upload photos for plant disease identification",
            "fc_v2_app_label_tips_quick_tip_title_en": "Quick tip",
            "fc_v2_app_label_tips_quick_tip_statement_en": "AI may be wrong. Please double-check.",
            "fc_v2_app_label_tips_quick_tip_title_statement_en": "AI may be wrong. Please double-check.",
            "fc_v2_app_label_tips_did_you_know_title_en": "Did you know?",
            "fc_v2_app_label_tips_did_you_know_statement_en": "You can ask follow-up questions to get more details",
            "fc_v2_app_label_tips_today_is_a_lucky_day_en": "Today is lucky day"
        ]).answerGenerationTips()

        XCTAssertEqual(tips, [
            AnswerGenerationTip(title: "Did you know?", body: "You can ask follow-up questions to get more details"),
            AnswerGenerationTip(title: "Quick tip", body: "AI may be wrong. Please double-check."),
            AnswerGenerationTip(title: "Try this", body: "Upload photos for plant disease identification")
        ])
    }

    func testTipResolvesSelectedLanguageThenEnglish() {
        let tips = manager(lang: "hi", labels: [
            "fc_v2_app_label_tips_a_title_hi": "शीर्षक",
            "fc_v2_app_label_tips_a_title_en": "Title",
            "fc_v2_app_label_tips_a_statement_en": "Body"   // no _hi → falls back to _en
        ]).answerGenerationTips()
        XCTAssertEqual(tips, [AnswerGenerationTip(title: "शीर्षक", body: "Body")])
    }

    func testHalfPairIsDroppedAndEmptyFallsBackToBuiltIns() {
        // A title with no statement in any language is not a tip; with nothing else served the
        // app's three built-in tips are returned (through their label keys).
        let tips = manager(labels: ["fc_v2_app_label_tips_lonely_title_en": "Alone"]).answerGenerationTips()
        XCTAssertEqual(tips.map(\.title), ["Did you know?", "Quick tip", "Try this"])
        XCTAssertEqual(tips[1].body, "Try asking about specific crops or problems")

        XCTAssertEqual(manager(labels: [:]).answerGenerationTips().count, 3)
    }

    func testTipNameRegexPort() {
        XCTAssertEqual(LabelManager.tipName(fromTitleKey: "fc_v2_app_label_tips_quick_tip_title_en"), "quick_tip")
        XCTAssertEqual(LabelManager.tipName(fromTitleKey: "fc_v2_app_label_tips_x_title_bho"), "x")
        XCTAssertNil(LabelManager.tipName(fromTitleKey: "fc_v2_app_label_tips_quick_tip_title_statement_en"))
        XCTAssertNil(LabelManager.tipName(fromTitleKey: "fc_v2_app_label_tips_quick_tip_en"))
        XCTAssertNil(LabelManager.tipName(fromTitleKey: "fc_v2_app_label_tips__title_en"))
        XCTAssertNil(LabelManager.tipName(fromTitleKey: "fc_v2_app_label_tips_a_title_EN"))
        XCTAssertNil(LabelManager.tipName(fromTitleKey: "fc_v2_app_label_tips_a_title_engl"))
    }

    // MARK: - Alignment chip send

    func testClarifyChipSendsLabelAndMarksByValue() {
        let send = AlignmentChipSend(chip: AlignmentChip(label: "Written plan", value: "written_plan"), kind: .clarify)
        XCTAssertEqual(send, AlignmentChipSend(chip: AlignmentChip(label: "Written plan", value: "written_plan"), kind: .clarify))
        XCTAssertEqual(send?.query, "Written plan")
        XCTAssertEqual(send?.selectionValue, "written_plan")
        XCTAssertNil(send?.displayLabel, "the bubble shows the sent label itself")
    }

    func testGenderSelectSendsValueButShowsLabel() {
        let send = AlignmentChipSend(chip: AlignmentChip(label: "Other", value: "other_gender"), kind: .genderSelect)
        XCTAssertEqual(send?.query, "other_gender")
        XCTAssertEqual(send?.selectionValue, "other_gender")
        XCTAssertEqual(send?.displayLabel, "Other")
    }

    func testLabelOnlyChipAndEmptyChip() {
        let labelOnly = AlignmentChipSend(chip: AlignmentChip(label: "Yes", value: nil), kind: .confirm)
        XCTAssertEqual(labelOnly?.query, "Yes")
        XCTAssertEqual(labelOnly?.selectionValue, "Yes")
        XCTAssertNil(AlignmentChipSend(chip: AlignmentChip(label: " ", value: ""), kind: .confirm))
    }

    // MARK: - Request body

    private func body(_ request: TextPromptRequest) throws -> [String: Any] {
        let data = try JSONEncoder().encode(request)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    func testAlignmentFieldsAreOmittedByDefault() throws {
        let json = try body(TextPromptRequest(query: "q", conversationId: "c", messageId: "", triggeredInputType: "text"))
        XCTAssertNil(json["parent_message_id"])
        XCTAssertNil(json["location_declined"])
        XCTAssertNil(json["photo_declined"])
    }

    func testAlignmentFieldsAreSentWhenSet() throws {
        var request = TextPromptRequest(query: "q", conversationId: "c", messageId: "", triggeredInputType: "align_chip_sel")
        request.parentMessageId = "srv-42"
        request.locationDeclined = true
        let json = try body(request)
        XCTAssertEqual(json["parent_message_id"] as? String, "srv-42")
        XCTAssertEqual(json["location_declined"] as? Bool, true)
        XCTAssertNil(json["photo_declined"])
        XCTAssertEqual(json["triggered_input_type"] as? String, "align_chip_sel")

        // Round-trips through the custom decoder.
        let decoded = try JSONDecoder().decode(TextPromptRequest.self, from: JSONEncoder().encode(request))
        XCTAssertEqual(decoded.parentMessageId, "srv-42")
        XCTAssertEqual(decoded.locationDeclined, true)
    }

    // MARK: - #29 applies only to the latest settled answer

    @MainActor
    func testFollowUpsApplyOnlyToLatestSettledAnswer() {
        var state = ChatState()
        state.messages = [
            .user(ChatMessage.UserMessage(text: "q1")),
            .aiResponse(ChatMessage.AiResponse(text: "a1", id: "a1"))
        ]
        XCTAssertTrue(ChatViewModel.isLatestSettledAnswer("a1", in: state))
        // Agentic finalize window: the stream has not reached EOF, so isLoading is still true —
        // #29 for the answer that is already final must still land.
        state.isLoading = true
        XCTAssertTrue(ChatViewModel.isLatestSettledAnswer("a1", in: state))
        state.isLoading = false

        // A newer question is in flight: the old answer's #29 result must not land.
        state.messages.append(.user(ChatMessage.UserMessage(text: "q2")))
        state.messages.append(.loadingPlaceholder(id: "p"))
        state.isLoading = true
        XCTAssertFalse(ChatViewModel.isLatestSettledAnswer("a1", in: state))

        // The newer answer settled: still not a1's turn.
        state.messages.removeLast()
        state.messages.append(.aiResponse(ChatMessage.AiResponse(text: "a2", id: "a2")))
        state.isLoading = false
        XCTAssertFalse(ChatViewModel.isLatestSettledAnswer("a1", in: state))
        XCTAssertTrue(ChatViewModel.isLatestSettledAnswer("a2", in: state))
    }
}
