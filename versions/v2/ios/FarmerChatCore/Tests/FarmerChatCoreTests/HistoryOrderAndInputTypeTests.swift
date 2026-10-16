import XCTest
@testable import FarmerChatCore

/// #32 conversation history as DEMO serves it (captured 2026-10-16): turns NEWEST first, and
/// type-7 follow-ups as `{follow_up_question_id, sequence, question}` objects.
@MainActor
final class HistoryOrderAndInputTypeTests: XCTestCase {

    private let demoPage = #"""
    {"conversation_id":"c1","data":[
     {"message_type_id":1,"message_type":"query_text","message_id":"m2","message_input_time":"2026-10-16T09:29:47.098307Z","query_text":"How often should I spray neem oil?"},
     {"message_type_id":3,"message_type":"response_text","message_id":"m2","message_input_time":"2026-10-16T09:29:47.098307Z","response_text":"Every 7 days.","clarification_required":false},
     {"message_type_id":7,"message_type":"follow_up_questions","message_id":"m2","message_input_time":"2026-10-16T09:29:47.098307Z","questions":[{"follow_up_question_id":"f21","sequence":1,"question":"Can I mix neem oil with soap?"},{"follow_up_question_id":"f22","sequence":2,"question":"Does neem oil harm bees?"}]},
     {"message_type_id":1,"message_type":"query_text","message_id":"m1","message_input_time":"2026-10-16T09:29:28.095635Z","query_text":"How do I control aphids on tomato"},
     {"message_type_id":3,"message_type":"response_text","message_id":"m1","message_input_time":"2026-10-16T09:29:28.095635Z","response_text":"Spray neem oil."},
     {"message_type_id":7,"message_type":"follow_up_questions","message_id":"m1","message_input_time":"2026-10-16T09:29:28.095635Z","questions":[{"follow_up_question_id":"f11","sequence":1,"question":"What fertilizer for tomato?"}]}
    ]}
    """#

    private func decodePage() throws -> ConversationChatHistoryResponse {
        try JSONDecoder().decode(ConversationChatHistoryResponse.self, from: Data(demoPage.utf8))
    }

    func testObjectFollowUpsDecodeInsteadOfDroppingThePage() throws {
        let page = try decodePage()
        XCTAssertEqual(page.messages.count, 6, "one object-shaped type-7 item used to empty the whole page")
        XCTAssertEqual(page.messages[2].questions, ["Can I mix neem oil with soap?", "Does neem oil harm bees?"])
    }

    func testStringFollowUpsStillDecode() throws {
        let json = #"{"data":[{"message_type_id":7,"questions":["A?","B?"]}]}"#
        let page = try JSONDecoder().decode(ConversationChatHistoryResponse.self, from: Data(json.utf8))
        XCTAssertEqual(page.messages.first?.questions, ["A?", "B?"])
    }

    func testHistoryIsOrderedOldestFirstLikeTheApp() throws {
        let messages = ChatViewModel.mapHistory(try decodePage().messages)
        let texts: [String] = messages.map {
            switch $0 {
            case .user(let u): return "Q:" + u.text
            case .aiResponse(let a): return "A:" + a.text
            default: return "?"
            }
        }
        XCTAssertEqual(texts, [
            "Q:How do I control aphids on tomato", "A:Spray neem oil.",
            "Q:How often should I spray neem oil?", "A:Every 7 days."
        ])
        // The newest answer carries its follow-ups as text (the app drops the ids for history).
        if case .aiResponse(let last)? = messages.last {
            XCTAssertEqual(last.followUpQuestions, ["Can I mix neem oil with soap?", "Does neem oil harm bees?"])
        } else {
            XCTFail("last row is not the newest answer")
        }
    }

    func testMissingTimeSortsLastAndTurnOrderIsStable() {
        func item(_ type: Int, _ time: String?) -> ConversationChatHistoryMessageItem {
            let json = time.map { #"{"message_type_id":\#(type),"message_input_time":"\#($0)"}"# } ?? #"{"message_type_id":\#(type)}"#
            return try! JSONDecoder().decode(ConversationChatHistoryMessageItem.self, from: Data(json.utf8))
        }
        let sorted = ChatViewModel.sortedHistory([item(1, nil), item(7, "b"), item(3, "a"), item(1, "a")])
        XCTAssertEqual(sorted.map { $0.messageTypeId }, [3, 1, 7, 1])
    }

    func testLastResponseClarification() throws {
        XCTAssertEqual(ChatViewModel.lastResponseClarification(in: try decodePage().messages), false)
    }

    // MARK: - triggered_input_type (app ChatViewModel.kt:992-996)

    func testFollowUpTriggeredInputType() {
        XCTAssertEqual(ChatViewModel.followUpTriggeredInputType(followUpQuestionId: nil, audioURL: nil), "text",
                       "a question typed into the composer is `text`, not `follow_up`")
        XCTAssertEqual(ChatViewModel.followUpTriggeredInputType(followUpQuestionId: "Q?", audioURL: nil), "follow_up")
        XCTAssertEqual(ChatViewModel.followUpTriggeredInputType(followUpQuestionId: nil, audioURL: URL(fileURLWithPath: "/a.m4a")), "voice")
    }
}
