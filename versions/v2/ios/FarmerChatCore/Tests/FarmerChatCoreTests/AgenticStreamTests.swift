import XCTest
@testable import FarmerChatCore

/// Covers the agentic (#27a) wire mapping, the stream framing and the stream-text sanitizer.
///
/// These exist because the wire **cannot currently be verified against a live stream**: the
/// endpoint opens (200, `text/event-stream`, chunked) but delivers 0 bytes to a guest on dev,
/// stage and prod (docs/05-open-questions.md). The reader is therefore deliberately permissive,
/// and these tests pin down what "permissive" actually means, so a future backend change that
/// breaks an assumption fails here rather than silently showing farmers "Something went wrong".
final class AgenticStreamTests: XCTestCase {

    // MARK: - Helpers

    private func parse(_ type: String?, _ data: String) -> AgenticEvent? {
        AgenticEventParser.parse(type: type, data: data)
    }

    private func delta(_ event: AgenticEvent?) -> String? {
        if case .textDelta(let text) = event { return text }
        return nil
    }

    /// Status label of a `toolCall`; nil when the event is not a tool call at all (every test
    /// using it expects a label, so the two nil cases never need distinguishing).
    private func toolCallStatus(_ event: AgenticEvent?) -> String? {
        if case .toolCall(_, let status) = event { return status }
        return nil
    }

    private func metadata(_ event: AgenticEvent?) -> TextPromptResponse? {
        if case .metadata(let response) = event { return response }
        return nil
    }

    private func done(_ event: AgenticEvent?) -> (answer: String?, followUps: [String])? {
        if case .done(let answer, let followUps) = event { return (answer, followUps) }
        return nil
    }

    /// Feeds a whole raw stream body through the decoder, exactly as the byte reader does:
    /// split on LF, feed each line, then flush.
    private func decodeAll(_ body: String) -> [AgenticEvent] {
        var decoder = AgenticStreamDecoder()
        var events: [AgenticEvent] = []
        for line in body.components(separatedBy: "\n") {
            if let event = decoder.feed(line: line) { events.append(event) }
        }
        if let event = decoder.finish() { events.append(event) }
        return events
    }

    // MARK: - Framing A: SSE, type from the `event:` line

    func testSseEventNameDrivesTheType() {
        XCTAssertEqual(delta(parse("text_delta", #"{"delta":"Aphids "}"#)), "Aphids ")
    }

    func testEventNameMatchingIgnoresCaseAndSeparators() {
        // TOOL_CALL / tool_call / toolCall must all land on the same branch.
        for name in ["TOOL_CALL", "tool_call", "toolCall"] {
            let event = parse(name, #"{"name":"weather","status_text":"Checking weather"}"#)
            XCTAssertEqual(toolCallStatus(event), "Checking weather", "\(name) should map to toolCall")
        }
    }

    // MARK: - Framing B: bare NDJSON, type from inside the JSON

    func testTypeFieldInsideThePayloadIsUsedWhenNoSseEventLineCame() {
        XCTAssertEqual(delta(parse(nil, #"{"type":"text_delta","delta":"on tomato"}"#)), "on tomato")
    }

    func testToolResultCarriesItsStatusLabel() {
        let event = parse(nil, #"{"type":"tool_result","name":"weather","label":"Weather checked"}"#)
        guard case .toolResult(let name, let status) = event else {
            return XCTFail("expected a toolResult, got \(String(describing: event))")
        }
        XCTAssertEqual(name, "weather")
        XCTAssertEqual(status, "Weather checked")
    }

    // MARK: - Field aliases

    func testDeltaIsReadFromAnyOfTheKnownAliases() {
        // Backends name the incremental chunk differently; losing it would silently break typing.
        for field in ["delta", "text", "content", "token", "chunk"] {
            XCTAssertEqual(delta(parse("text_delta", "{\"\(field)\":\"x\"}")), "x", "alias \(field)")
        }
    }

    func testToolStatusIsReadFromAnyOfTheKnownAliases() {
        for field in ["status_text", "statusText", "status", "label"] {
            let event = parse("tool_call", "{\"name\":\"n\",\"\(field)\":\"Working\"}")
            XCTAssertEqual(toolCallStatus(event), "Working", "alias \(field)")
        }
    }

    func testAToolEventWithoutAStatusLabelStillParsesWithNoLabel() {
        // The consumer skips the dwell for a blank status (`guard ... else { break }`) and keeps
        // reading, so a label-less tool event must parse rather than fail the stream — and must
        // not carry a blank status row into the UI.
        let event = parse("tool_call", #"{"name":"weather"}"#)
        guard case .toolCall(let name, let status) = event else {
            return XCTFail("expected a toolCall, got \(String(describing: event))")
        }
        XCTAssertEqual(name, "weather")
        XCTAssertNil(status)
    }

    func testEmptyDeltaIsDroppedRatherThanEmitted() {
        XCTAssertNil(parse("text_delta", #"{"delta":""}"#))
    }

    // MARK: - Terminal events

    func testMetadataCarriesTheFullResponseAndIsWhatFinalizesAStream() {
        let event = parse("metadata", #"{"error":false,"response":"Use neem oil.","message_id":"m-1"}"#)
        let response = metadata(event)
        XCTAssertEqual(response?.response, "Use neem oil.")
        XCTAssertEqual(response?.messageId?.stringValue, "m-1")
    }

    func testDoneIsAFallbackCarryingAnswerAndFollowUps() {
        let event = parse("done", #"{"answer":"Use neem oil.","followups":["How often?","Is it safe?"]}"#)
        let payload = done(event)
        XCTAssertEqual(payload?.answer, "Use neem oil.")
        XCTAssertEqual(payload?.followUps, ["How often?", "Is it safe?"])
    }

    func testDoneReadsFollowUpsFromAnyKnownAlias() {
        for field in ["followups", "follow_ups", "followUps", "follow_up_questions"] {
            let event = parse("done", "{\"answer\":\"a\",\"\(field)\":[\"q\"]}")
            XCTAssertEqual(done(event)?.followUps, ["q"], "alias \(field)")
        }
    }

    func testDoneAnswerIsReadFromAnyKnownAlias() {
        for field in ["answer", "response", "text", "final_answer"] {
            let event = parse("done", "{\"\(field)\":\"Use neem oil.\"}")
            XCTAssertEqual(done(event)?.answer, "Use neem oil.", "alias \(field)")
        }
    }

    // MARK: - Recovery: typeless payloads

    func testATypelessPayloadHoldingAnAnswerIsRecoveredAsMetadata() {
        // Some backend variants stream the final response as a bare, typeless object. Dropping it
        // would surface to the farmer as "Something went wrong" despite a real answer arriving.
        let event = parse(nil, #"{"response":"Use neem oil.","error":false}"#)
        XCTAssertEqual(metadata(event)?.response, "Use neem oil.")
    }

    func testATypelessPayloadHoldingAChunkIsRecoveredAsADelta() {
        XCTAssertEqual(delta(parse(nil, #"{"content":"partial"}"#)), "partial")
    }

    func testATypelessPayloadCarryingNeitherIsIgnored() {
        // Section headers and similar scaffolding must not become spurious messages.
        XCTAssertNil(parse(nil, #"{"surface":"response"}"#))
    }

    // MARK: - Robustness

    func testBlankDataIsIgnored() {
        XCTAssertNil(parse("text_delta", ""))
        XCTAssertNil(parse(nil, "   "))
    }

    func testMalformedJsonNeverThrows() {
        // A parse failure mid-stream must not take down the chat.
        XCTAssertNil(parse("metadata", "{not json"))
        XCTAssertNil(parse(nil, "]["))
        XCTAssertNil(parse("text_delta", "<html>502 Bad Gateway</html>"))
    }

    // MARK: - Framing: the line state machine

    func testSseFramingWithEventAndDataLines() {
        let body = """
        event: tool_call
        data: {"name":"weather","status_text":"Checking weather"}

        event: text_delta
        data: {"delta":"Use "}

        event: text_delta
        data: {"delta":"neem oil."}

        event: metadata
        data: {"error":false,"response":"Use neem oil.","message_id":"m-1"}

        """
        let events = decodeAll(body)
        XCTAssertEqual(events.count, 4)
        XCTAssertEqual(toolCallStatus(events[0]), "Checking weather")
        XCTAssertEqual(delta(events[1]), "Use ")
        XCTAssertEqual(delta(events[2]), "neem oil.")
        XCTAssertEqual(metadata(events[3])?.messageId?.stringValue, "m-1")
    }

    func testNdjsonFramingDispatchesOneObjectPerLine() {
        let body = """
        {"type":"text_delta","delta":"Use "}
        {"type":"text_delta","delta":"neem oil."}
        {"type":"done","answer":"Use neem oil.","followups":["How often?"]}
        """
        let events = decodeAll(body)
        XCTAssertEqual(events.count, 3)
        XCTAssertEqual(delta(events[0]), "Use ")
        XCTAssertEqual(delta(events[1]), "neem oil.")
        XCTAssertEqual(done(events[2])?.followUps, ["How often?"])
    }

    func testCrlfLineEndingsStillFireEventBoundaries() {
        // Real SSE uses CRLF. A lone "\r" line must read as blank, or every boundary is missed and
        // the whole stream accretes into one unparseable payload.
        let body = "event: text_delta\r\ndata: {\"delta\":\"Use \"}\r\n\r\nevent: text_delta\r\ndata: {\"delta\":\"neem oil.\"}\r\n\r\n"
        let events = decodeAll(body)
        XCTAssertEqual(events.count, 2)
        XCTAssertEqual(delta(events[0]), "Use ")
        XCTAssertEqual(delta(events[1]), "neem oil.")
    }

    func testMultipleDataLinesJoinIntoOnePayload() {
        // Per the SSE spec several data: lines in one event join with a newline — harmless
        // whitespace inside a JSON payload.
        let body = """
        event: metadata
        data: {"error":false,
        data: "response":"Use neem oil."}

        """
        let events = decodeAll(body)
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(metadata(events[0])?.response, "Use neem oil.")
    }

    func testKeepAliveCommentsAreIgnored() {
        let body = """
        : keep-alive

        event: text_delta
        data: {"delta":"Use "}

        """
        let events = decodeAll(body)
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(delta(events[0]), "Use ")
    }

    func testFinalEventWithoutATrailingBlankLineIsFlushed() {
        // A stream that closes right after its last data: line must not lose that event.
        let body = "event: metadata\ndata: {\"error\":false,\"response\":\"Use neem oil.\"}"
        let events = decodeAll(body)
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(metadata(events[0])?.response, "Use neem oil.")
    }

    func testEventLineFollowedByABareObjectUsesTheEventName() {
        // Hybrid framing: an SSE event name, then the payload as a bare NDJSON object.
        let body = """
        event: text_delta
        {"delta":"Use "}
        """
        let events = decodeAll(body)
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(delta(events[0]), "Use ")
    }

    func testDecoderFlagsTheTerminalMetadataEvent() {
        // The reader stops reading on this flag, so a delta must never set it.
        var decoder = AgenticStreamDecoder()
        XCTAssertNotNil(decoder.feed(line: #"{"type":"text_delta","delta":"x"}"#))
        XCTAssertFalse(decoder.sawTerminalMetadata)
        XCTAssertNotNil(decoder.feed(line: #"{"type":"metadata","error":false,"response":"done"}"#))
        XCTAssertTrue(decoder.sawTerminalMetadata)
    }

    func testUnparseableLinesDoNotEmitEvents() {
        let events = decodeAll("<html>\n502 Bad Gateway\n</html>\n")
        XCTAssertTrue(events.isEmpty)
    }

    // MARK: - Sanitizer (mid-stream text)
    //
    // The agentic stream carries control tokens that the clean `metadata.response` does not. They
    // are invisible in the final answer but very visible while the answer types itself, so getting
    // this wrong means farmers watch `<<commodities:chickpea>>` appear mid-sentence.

    func testPlainTextIsUntouched() {
        XCTAssertEqual(sanitizeAgenticStreamText("Use neem oil weekly."), "Use neem oil weekly.")
    }

    func testCompletedControlTokensAreStripped() {
        XCTAssertEqual(
            sanitizeAgenticStreamText("Use neem oil.<<commodities:chickpea>>"),
            "Use neem oil."
        )
    }

    func testMultipleControlTokensAreAllStripped() {
        XCTAssertEqual(
            sanitizeAgenticStreamText("Spray<<a:1>> early.<<resolution:plan_created>>"),
            "Spray early."
        )
    }

    func testACompletedFollowupsBlockIsStripped() {
        let raw = "Use neem oil.\n```followups\nHow often?\nIs it safe?\n```"
        XCTAssertEqual(sanitizeAgenticStreamText(raw), "Use neem oil.")
    }

    func testAHalfArrivedControlTokenIsCutNotShown() {
        // Mid-stream the text can end in a partial token. Showing "<<comm" would be visible junk.
        XCTAssertEqual(sanitizeAgenticStreamText("Use neem oil.<<comm"), "Use neem oil.")
    }

    func testAnUnterminatedFollowupsFenceIsCut() {
        XCTAssertEqual(
            sanitizeAgenticStreamText("Use neem oil.\n```followups\nHow often?"),
            "Use neem oil."
        )
    }

    func testTextConsistingOnlyOfATokenBecomesEmpty() {
        XCTAssertEqual(sanitizeAgenticStreamText("<<resolution:plan_created>>"), "")
    }

    func testTrailingWhitespaceLeftByStrippingIsTrimmed() {
        XCTAssertEqual(sanitizeAgenticStreamText("Use neem oil.   <<a:1>>  "), "Use neem oil.")
    }

    func testEmptyInputStaysEmpty() {
        XCTAssertEqual(sanitizeAgenticStreamText(""), "")
    }

    // MARK: - Alignment surfaces

    func testEveryAlignmentWireTypeMapsToItsKind() {
        XCTAssertEqual(AlignmentKind.fromType("alignment-clarify"), .clarify)
        XCTAssertEqual(AlignmentKind.fromType("alignment-confirm"), .confirm)
        XCTAssertEqual(AlignmentKind.fromType("alignment-escalate"), .escalate)
        XCTAssertEqual(AlignmentKind.fromType("gps-prompt"), .gpsPrompt)
        XCTAssertEqual(AlignmentKind.fromType("upload-photo"), .uploadPhoto)
        XCTAssertEqual(AlignmentKind.fromType("gender-select"), .genderSelect)
        XCTAssertEqual(AlignmentKind.fromType("commodity-confirm"), .commodityConfirm)
    }

    func testAlignmentMappingToleratesCaseAndSurroundingWhitespace() {
        XCTAssertEqual(AlignmentKind.fromType("  ALIGNMENT-CLARIFY "), .clarify)
    }

    func testAnUnknownOrAbsentAlignmentTypeIsNilSoTheAnswerRendersNormally() {
        XCTAssertNil(AlignmentKind.fromType("alignment-something-new"))
        XCTAssertNil(AlignmentKind.fromType(""))
        XCTAssertNil(AlignmentKind.fromType(nil))
    }

    func testAlignmentAnalyticsTypeRoundTripsThroughFromType() {
        // Dashboards key off these exact strings; a rename must fail here, not in a funnel.
        for kind in AlignmentKind.allCases {
            XCTAssertEqual(AlignmentKind.fromType(kind.analyticsType), kind)
        }
    }

    func testOnlyProfileSurfacesAreAdditive() {
        // Additive surfaces sit BELOW a real answer; exclusive ones replace it. Getting this
        // backwards would either hide an answer or show an orphaned nudge.
        XCTAssertTrue(AlignmentKind.genderSelect.isAdditive)
        XCTAssertTrue(AlignmentKind.commodityConfirm.isAdditive)
        for kind in [AlignmentKind.clarify, .confirm, .escalate, .gpsPrompt, .uploadPhoto] {
            XCTAssertFalse(kind.isAdditive, "\(kind) must be exclusive")
        }
    }

    func testAnExclusiveAlignmentSurfaceDecodesWithAnEmptyResponse() {
        // The EXCLUSIVE case that must not be mistaken for an empty answer: `response` is empty on
        // purpose and the prompt lives in `alignments.message`.
        let json = #"""
        {"error":false,"response":"","alignments":{"type":"alignment-clarify",
        "message":"Which crop?","blocking":true,
        "chips":[{"label":"Tomato","value":"tomato","action":"select"}],
        "original_query":"pest problem"}}
        """#
        let response = try? JSONDecoder().decode(TextPromptResponse.self, from: Data(json.utf8))
        XCTAssertEqual(response?.response, "")
        XCTAssertEqual(AlignmentKind.fromType(response?.alignments?.type), .clarify)
        XCTAssertEqual(response?.alignments?.message, "Which crop?")
        XCTAssertEqual(response?.alignments?.chips?.first?.submittedQuery(for: .clarify), "Tomato")
        XCTAssertEqual(response?.alignments?.originalQuery, "pest problem")
    }

    func testAChipWithoutAValueSubmitsItsLabel() {
        XCTAssertEqual(AlignmentChip(label: "Tomato", value: "  ").submittedQuery(for: .clarify), "Tomato")
    }

    /// The bug: a confirm chip sent its VALUE, so the farmer's bubble read "written_plan".
    func testAConfirmChipSubmitsItsLabelNotItsValue() {
        let chip = AlignmentChip(label: "Step-by-step plan", value: "written_plan")
        XCTAssertEqual(chip.submittedQuery(for: .confirm), "Step-by-step plan")
    }

    func testAChipWithoutALabelSubmitsItsValue() {
        XCTAssertEqual(AlignmentChip(label: nil, value: "yes").submittedQuery(for: .confirm), "yes")
    }

    func testGenderSelectSubmitsItsValue() {
        XCTAssertEqual(AlignmentChip(label: "Female", value: "female").submittedQuery(for: .genderSelect), "female")
    }

    // MARK: - Transport

    func testStreamingRequestCarriesNoPriorityTimeoutAndTheRightHeaders() {
        // The one piece of the transport verifiable without a live stream. A URLRequest timeout
        // OVERRIDES the session configuration, so a priority deadline here would cap the stream at
        // 30 s no matter how the streaming session is built.
        let tokenStore = KeychainTokenStore()
        let baseURL = URL(string: "https://example.test/")!
        let deviceInfo = DeviceInfoProvider(deviceId: "test-device")
        let client = APIClient(
            baseURL: baseURL,
            tokenStore: tokenStore,
            refresher: TokenRefresher(
                tokenStore: tokenStore,
                baseURL: baseURL,
                guestApiKey: nil,
                deviceInfo: deviceInfo
            ),
            deviceInfo: deviceInfo
        )
        let request = client.streamingRequest(path: AgenticChatDataSource.path, body: Data("{}".utf8))
        XCTAssertNotNil(request)
        XCTAssertEqual(
            request?.url?.absoluteString,
            "https://example.test/api/chat/get_answer_for_text_query_agentic/"
        )
        XCTAssertEqual(request?.httpMethod, "POST")
        // Accept MUST be application/json: the backend 406s text/event-stream.
        XCTAssertEqual(request?.value(forHTTPHeaderField: "Accept"), "application/json")
        XCTAssertNotEqual(request?.timeoutInterval, ApiPriority.p3.timeoutSeconds)
        XCTAssertNotEqual(request?.timeoutInterval, ApiPriority.p2.timeoutSeconds)
        XCTAssertGreaterThanOrEqual(request?.timeoutInterval ?? 0, 3600)
        // No ApiPriority headers on the streaming path.
        XCTAssertNil(request?.value(forHTTPHeaderField: "X-Timeout"))
        XCTAssertNotNil(request?.value(forHTTPHeaderField: "Build-Version"))
        XCTAssertNotNil(request?.value(forHTTPHeaderField: "Device-Info"))
    }

    func testStreamingSessionHasNoReadOrResourceTimeout() {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = AgenticChatDataSource.noTimeoutInterval
        configuration.timeoutIntervalForResource = AgenticChatDataSource.noTimeoutInterval
        // Read back: URLSession silently ignores unsupported values (0 means "default", not
        // "never"), so assert the value actually stuck.
        XCTAssertEqual(configuration.timeoutIntervalForRequest, AgenticChatDataSource.noTimeoutInterval)
        XCTAssertEqual(configuration.timeoutIntervalForResource, AgenticChatDataSource.noTimeoutInterval)
        XCTAssertGreaterThanOrEqual(AgenticChatDataSource.noTimeoutInterval, 3600)
    }

    // MARK: - Config default

    func testAgenticChatIsOptInAndDefaultsOff() {
        // A host that does nothing must keep the 1.0.0 synchronous #27 contract.
        XCTAssertFalse(FarmerChatConfig(environment: .prod).enableAgenticChat)
        XCTAssertTrue(FarmerChatConfig(environment: .prod, enableAgenticChat: true).enableAgenticChat)
    }
}
