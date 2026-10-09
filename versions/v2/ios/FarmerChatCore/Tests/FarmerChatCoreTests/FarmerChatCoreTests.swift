import XCTest
@testable import FarmerChatCore

final class FarmerChatCoreTests: XCTestCase {

    // MARK: - FlexibleID

    func testFlexibleIDDecodesIntStringDouble() throws {
        struct Box: Codable { let id: FlexibleID }
        let intBox = try JSONDecoder().decode(Box.self, from: Data(#"{"id": 42}"#.utf8))
        XCTAssertEqual(intBox.id.intValue, 42)
        let stringBox = try JSONDecoder().decode(Box.self, from: Data(#"{"id": "abc-1"}"#.utf8))
        XCTAssertEqual(stringBox.id.stringValue, "abc-1")
        let doubleBox = try JSONDecoder().decode(Box.self, from: Data(#"{"id": 12.0}"#.utf8))
        XCTAssertEqual(doubleBox.id.stringValue, "12")
    }

    // MARK: - ConversationListResponse dual format

    func testConversationListDecodesBareArray() throws {
        let json = #"[{"conversation_id": 1, "question": "How to grow maize?"}]"#
        let response = try JSONDecoder().decode(ConversationListResponse.self, from: Data(json.utf8))
        XCTAssertEqual(response.items.count, 1)
        XCTAssertNil(response.nextPage)
        XCTAssertEqual(response.items[0].conversationId?.stringValue, "1")
    }

    func testConversationListDecodesPaginatedObject() throws {
        let json = #"{"results": [{"conversation_id": "x", "question": "q"}], "next_page": 2, "count": 40}"#
        let response = try JSONDecoder().decode(ConversationListResponse.self, from: Data(json.utf8))
        XCTAssertEqual(response.items.count, 1)
        XCTAssertEqual(response.nextPage, 2)
        XCTAssertEqual(response.count, 40)
    }

    // MARK: - Retry policy invariants (CLAUDE.md §3)

    func testSupportedLanguageStreamingRequiredDecodes() throws {
        let off = try JSONDecoder().decode(SupportedLanguage.self, from: Data(#"{"id": 1, "code": "hi", "streaming_required": false}"#.utf8))
        XCTAssertEqual(off.streamingRequired, false)
        let absent = try JSONDecoder().decode(SupportedLanguage.self, from: Data(#"{"id": 2, "code": "en"}"#.utf8))
        XCTAssertNil(absent.streamingRequired)
        XCTAssertTrue(absent.streamingRequired ?? true)
    }

    func testTextPromptRequestEncodesStreamingRequired() throws {
        let defaulted = TextPromptRequest(query: "q", conversationId: "c", messageId: "", triggeredInputType: "text")
        let json = try JSONSerialization.jsonObject(with: JSONEncoder().encode(defaulted)) as? [String: Any]
        XCTAssertEqual(json?["streaming_required"] as? Bool, true)
        let off = TextPromptRequest(query: "q", conversationId: "c", messageId: "", triggeredInputType: "text", streamingRequired: false)
        let offJson = try JSONSerialization.jsonObject(with: JSONEncoder().encode(off)) as? [String: Any]
        XCTAssertEqual(offJson?["streaming_required"] as? Bool, false)
    }

    func testStreamingRequiredPrefDefaultsTrue() {
        let suite = "fc_sdk_test_streaming_\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let prefs = PreferenceStore(defaults: defaults)
        XCTAssertTrue(prefs.bool(.streamingRequired, default: true))
        prefs.setBool(false, .streamingRequired)
        XCTAssertFalse(prefs.bool(.streamingRequired, default: true))
        XCTAssertNotNil(defaults.object(forKey: "fc_sdk_is_streaming_required"))
    }

    func testRetryableStatusTable() {
        for code in [408, 500, 502, 503, 504, 404] {
            XCTAssertTrue(RetryPolicy.isRetryable(status: code), "\(code) must be retryable")
        }
        for code in [400, 429, 401, 403] {
            XCTAssertFalse(RetryPolicy.isRetryable(status: code), "\(code) must not be retryable")
        }
    }

    func testBackoffFormula() {
        XCTAssertEqual(RetryPolicy.backoffNanoseconds(attempt: 0), 500_000_000)
        XCTAssertEqual(RetryPolicy.backoffNanoseconds(attempt: 1), 1_000_000_000)
        XCTAssertEqual(RetryPolicy.backoffNanoseconds(attempt: 2), 2_000_000_000)
        XCTAssertEqual(RetryPolicy.backoffNanoseconds(attempt: 3), 3_000_000_000)
        XCTAssertEqual(RetryPolicy.backoffNanoseconds(attempt: 10), 3_000_000_000)
    }

    func testPriorityTable() {
        XCTAssertEqual(ApiPriority.p1.timeoutSeconds, 5)
        XCTAssertEqual(ApiPriority.p1.maxRetries, 1)
        XCTAssertEqual(ApiPriority.p2.timeoutSeconds, 10)
        XCTAssertEqual(ApiPriority.p2.maxRetries, 2)
        XCTAssertEqual(ApiPriority.p3.timeoutSeconds, 30)
        XCTAssertEqual(ApiPriority.p3.maxRetries, 3)
    }

    // MARK: - TokenRefresher skip list

    func testRefresherSkipList() {
        let base = URL(string: "https://v2.api.farmer.chat/")!
        for fragment in ["api/user/generate_otp/", "api/user/verify_otp/", "api/user/get_new_access_token/", "api/user/send_tokens/", "api/user/initialize_user/"] {
            XCTAssertTrue(TokenRefresher.shouldSkip(url: URL(string: fragment, relativeTo: base)))
        }
        XCTAssertFalse(TokenRefresher.shouldSkip(url: URL(string: "api/chat/get_answer_for_text_query/", relativeTo: base)))
    }

    // MARK: - Labels

    func testLabelTemplating() {
        XCTAssertEqual(LabelManager.applyTemplate("Hello {name}!", params: ["name": "Asha"]), "Hello Asha!")
        XCTAssertEqual(LabelManager.applyTemplate("Hello {{name}}!", params: ["name": "Asha"]), "Hello Asha!")
    }

    // MARK: - Transcription acceptance rule

    func testTranscriptionAcceptanceRule() throws {
        let good = #"{"heard_input_query": "rice", "confidence_score": 0.9, "error": false}"#
        let response = try JSONDecoder().decode(GetVoiceResponse.self, from: Data(good.utf8))
        XCTAssertTrue(response.isAcceptable)

        let lowConfidence = #"{"heard_input_query": "rice", "confidence_score": 0.5, "error": false}"#
        XCTAssertFalse(try JSONDecoder().decode(GetVoiceResponse.self, from: Data(lowConfidence.utf8)).isAcceptable)

        let blank = #"{"heard_input_query": "  ", "confidence_score": 0.9, "error": false}"#
        XCTAssertFalse(try JSONDecoder().decode(GetVoiceResponse.self, from: Data(blank.utf8)).isAcceptable)

        let errored = #"{"heard_input_query": "rice", "confidence_score": 0.9, "error": true}"#
        XCTAssertFalse(try JSONDecoder().decode(GetVoiceResponse.self, from: Data(errored.utf8)).isAcceptable)
    }

    // MARK: - Name normalization

    func testNameNormalization() {
        XCTAssertEqual(NameInputNormalizer.normalize("  Asha  Devi 42"), "Asha Devi ")
        XCTAssertEqual(NameInputNormalizer.sanitizeStored("No Name"), "")
        XCTAssertEqual(NameInputNormalizer.sanitizeStored("null"), "")
        XCTAssertEqual(NameInputNormalizer.sanitizeStored(" Asha "), "Asha")
    }

    // MARK: - C5 host string overrides + forced locale

    func testHostStringOverrideWinsAndForcedLocale() {
        let suiteName = "fc_sdk_test_\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suiteName)!
        let prefs = PreferenceStore(defaults: defaults)
        prefs.setString("hi", .selectedLanguageCode)
        let labels = LabelManager(prefs: prefs)
        labels.update(labels: ["greeting_en": "Hello", "greeting_hi": "Namaste"])

        // Without overrides: forced locale nil → uses stored "hi".
        labels.configure(overrides: [:], forcedLocale: nil)
        XCTAssertEqual(labels.label("greeting", fallback: "fallback"), "Namaste")

        // Forced locale "en" overrides the stored language.
        labels.configure(overrides: [:], forcedLocale: "en")
        XCTAssertEqual(labels.label("greeting", fallback: "fallback"), "Hello")

        // Host override wins over everything (server + fallback).
        labels.configure(overrides: ["greeting": "Hey!"], forcedLocale: "en")
        XCTAssertEqual(labels.label("greeting", fallback: "fallback"), "Hey!")

        defaults.removePersistentDomain(forName: suiteName)
    }

    // MARK: - C2/C3/C4 config surface defaults

    func testConfigFeatureDefaults() {
        let c = FarmerChatConfig(environment: .dev)
        XCTAssertEqual(c.authMode, .sdkOtp)
        XCTAssertEqual(c.mode, .fullJourney)
        XCTAssertTrue(c.showSettings)
        XCTAssertTrue(c.showHistory)
        XCTAssertTrue(c.showDrawer)
        XCTAssertTrue(c.enableSsfr)
        XCTAssertTrue(c.stringOverrides.isEmpty)
        XCTAssertNil(c.locale)
        XCTAssertNil(c.theme)
    }
}
