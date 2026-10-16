import XCTest
@testable import FarmerChatCore

/// Regression (2026-10-16): the agentic `metadata` event sends `follow_up_questions` as OBJECTS.
/// Typed as `[String]`, the decode threw, the whole event was dropped, and the answer lost its
/// `message_id` (no Listen; follow-up clicks failed). The payload below was captured from DEMO.
final class AgenticMetadataFollowUpsTests: XCTestCase {
    private let captured = #"{"type": "metadata", "message": "Successful retrieval of response for above query", "query": "How do I control aphids on tomato plants", "error": false, "section_message_id": "91e004e7-3530-4dd8-87c2-2eb1b6f9de11", "message_id": "91e004e7-3530-4dd8-87c2-2eb1b6f9de11", "response": "To control aphids on your tomatoes, spray neem oil at **5 ml/L** of water (which is **100 ml** in a standard **20 L** knapsack sprayer) or mix a mild liquid soap spray at **5 ml/L** to coat the undersides of the leaves where aphids cluster. For severe infestations where biological sprays are insufficient, apply **Acetamiprid 20 SP** at **10 g** per **20 L** knapsack sprayer (**0.5 g/L**), spraying early in the morning when the wind is calm.\n\nInspect the undersides of the leaves twice a week so you catch colonies before they multiply and transmit plant viruses. Avoid excessive top-dressing with nitrogenous fertilizers, as rapid, soft vegetative growth attracts aphids. For minor spots, pinch off heavily infested leaf tips or dislodge the pests using a strong stream of water.\n\n\n", "translated_response": "To control aphids on your tomatoes, spray neem oil at **5 ml/L** of water (which is **100 ml** in a standard **20 L** knapsack sprayer) or mix a mild liquid soap spray at **5 ml/L** to coat the undersides of the leaves where aphids cluster. For severe infestations where biological sprays are insufficient, apply **Acetamiprid 20 SP** at **10 g** per **20 L** knapsack sprayer (**0.5 g/L**), spraying early in the morning when the wind is calm.\n\nInspect the undersides of the leaves twice a week so you catch colonies before they multiply and transmit plant viruses. Avoid excessive top-dressing with nitrogenous fertilizers, as rapid, soft vegetative growth attracts aphids. For minor spots, pinch off heavily infested leaf tips or dislodge the pests using a strong stream of water.\n\n\n", "follow_up_questions": [{"follow_up_question_id": "d43ecbdc-289f-4a78-9b65-f23f8d2de93a", "sequence": 1, "question": "How often should I spray neem oil for aphids?"}, {"follow_up_question_id": "b7cbb37b-8c93-4334-bc4c-02743c574ee8", "sequence": 2, "question": "Can aphids spread viral diseases to my tomatoes?"}, {"follow_up_question_id": "248c9a7a-c3e1-41d4-bd8b-0193f832a19b", "sequence": 3, "question": "What is the harvest interval after spraying Acetamiprid?"}], "resource_url": null, "resource_id": null, "actual_content_provider": "Farmer.Chat", "content_provider_logo": "https://farmerchat-mobile-app-prod.s3.ap-southeast-2.amazonaws.com/dg_logo.jpg", "hide_source": true, "points": 0, "hide_tts_speaker": false, "intent_classification_output": null, "alignments": {}}"#

    func testCapturedMetadataDecodesWithMessageIdAndObjectFollowUps() throws {
        let response = try JSONDecoder().decode(TextPromptResponse.self, from: Data(captured.utf8))
        XCTAssertNotNil(response.messageId)
        XCTAssertEqual(response.followUpQuestions?.count, 3)
        XCTAssertEqual(response.followUpQuestions?.first?.question, "How often should I spray neem oil for aphids?")
    }

    func testParserKeepsTheMetadataEvent() {
        guard case .metadata(let response)? = AgenticEventParser.parse(type: "metadata", data: captured) else {
            return XCTFail("metadata event was dropped")
        }
        XCTAssertNotNil(response.messageId)
    }

    func testUnexpectedFollowUpShapeDoesNotDropTheEvent() {
        let odd = #"{"error":false,"response":"x","message_id":"m-9","follow_up_questions":"nope"}"#
        guard case .metadata(let response)? = AgenticEventParser.parse(type: "metadata", data: odd) else {
            return XCTFail("metadata event was dropped")
        }
        XCTAssertNotNil(response.messageId)
        XCTAssertNil(response.followUpQuestions)
    }

    /// #29 returns objects too (Android `List<Question>`); typed `[String]` the chips never showed.
    func testFollowUpQuestionsResponseDecodesObjectsWithIds() throws {
        let json = #"{"message_id":"m-1","section_message_id":"s-1","clarification_required":false,"questions":[{"follow_up_question_id":"q-2","question":"Second?","sequence":2},{"follow_up_question_id":"q-1","question":"First?","sequence":1}]}"#
        let r = try JSONDecoder().decode(FollowUpQuestionsResponse.self, from: Data(json.utf8))
        XCTAssertEqual(r.questions?.count, 2)
        XCTAssertEqual(r.questions?.first?.followUpQuestionId?.stringValue, "q-2")
        XCTAssertEqual(r.questions?.sorted { ($0.sequence ?? 0) < ($1.sequence ?? 0) }.first?.question, "First?")
    }
}
