import XCTest
import ImageIO
import UniformTypeIdentifiers
@testable import FarmerChatCore

/// Scenario pass 2026-10-17 (Android a689450): C4 host callbacks carry the question text and the
/// server message_id and fire only for real answers; a late #31 reply is dropped.
@MainActor
final class HostCallbacksAndSynthesisTests: XCTestCase {

    private final class Recorder: @unchecked Sendable {
        private let lock = NSLock()
        private var _sent: [String] = []
        private var _answers: [String] = []
        var sent: [String] { lock.lock(); defer { lock.unlock() }; return _sent }
        var answers: [String] { lock.lock(); defer { lock.unlock() }; return _answers }
        func addSent(_ s: String) { lock.lock(); _sent.append(s); lock.unlock() }
        func addAnswer(_ s: String) { lock.lock(); _answers.append(s); lock.unlock() }
    }

    override func setUp() async throws {
        FarmerChat.shutdown()
        StubURLProtocol.reset()
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        FarmerChat.testURLSession = URLSession(configuration: configuration)
    }

    override func tearDown() async throws {
        FarmerChat.shutdown()
        FarmerChat.testURLSession = nil
        StubURLProtocol.reset()
    }

    private func waitUntilSettled(_ vm: ChatViewModel, after count: Int, file: StaticString = #filePath, line: UInt = #line) async {
        for _ in 0..<200 {
            if vm.state.messages.count > count, !vm.state.isLoading, vm.state.messages.contains(where: { if case .loadingPlaceholder = $0 { return true }; return false }) == false,
               !vm.state.messages.isEmpty {
                return
            }
            try? await Task.sleep(nanoseconds: 20_000_000)
        }
        XCTFail("chat did not settle", file: file, line: line)
    }

    func testCallbacksCarryQuestionAndMessageIdAndSkipFailures() async throws {
        let recorder = Recorder()
        let fc = FarmerChat.initialize(config: FarmerChatConfig(
            environment: .dev,
            onMessageSent: { recorder.addSent($0) },
            onAnswerReceived: { recorder.addAnswer($0) }
        ))
        var answerStatus = 200
        StubURLProtocol.handler = { request, _ in
            let path = request.url?.path ?? ""
            if path.contains("get_answer_for_text_query") {
                return (answerStatus, Data(#"{"message_id":"m-42","response":"Spray neem oil weekly."}"#.utf8))
            }
            return (200, Data("{}".utf8))
        }
        let vm = ChatViewModel(env: fc)
        vm.setConversationId("c-1")

        vm.onAction(.sendFollowUpQuestion(question: "How do I control aphids?", followUpQuestionId: nil, transcriptionId: nil, audioURL: nil))
        await waitUntilSettled(vm, after: 0)
        XCTAssertEqual(recorder.sent, ["How do I control aphids?"])
        XCTAssertEqual(recorder.answers, ["m-42"], "the server message_id, once, for a real answer")

        // A failed answer (400: never retried) reports the send but NO answer.
        answerStatus = 400
        let before = vm.state.messages.count
        vm.onAction(.sendFollowUpQuestion(question: "And for mites?", followUpQuestionId: nil, transcriptionId: nil, audioURL: nil))
        await waitUntilSettled(vm, after: before)
        XCTAssertEqual(recorder.sent, ["How do I control aphids?", "And for mites?"])
        XCTAssertEqual(recorder.answers, ["m-42"], "a failure must not fire onAnswerReceived")
    }

    func testSynthesisReplyOnlyPlaysForTheLatestSettledAnswer() {
        let ai1 = ChatMessage.aiResponse(ChatMessage.AiResponse(text: "a", messageId: "m1"))
        let ai2 = ChatMessage.aiResponse(ChatMessage.AiResponse(text: "b", messageId: "m2"))
        let user = ChatMessage.user(ChatMessage.UserMessage(text: "q2"))

        var idle = ChatState()
        idle.messages = [ChatMessage.user(ChatMessage.UserMessage(text: "q")), ai1]
        XCTAssertTrue(ChatViewModel.synthesisStillWanted(requestedMessageId: "m1", state: idle))

        var loading = ChatState()
        loading.messages = [ai1, user, .loadingPlaceholder(id: "p")]
        loading.isLoading = true
        XCTAssertFalse(ChatViewModel.synthesisStillWanted(requestedMessageId: "m1", state: loading), "a newer send is in flight")

        var answered = ChatState()
        answered.messages = [ai1, user, ai2]
        XCTAssertFalse(ChatViewModel.synthesisStillWanted(requestedMessageId: "m1", state: answered), "no longer the latest answer")
    }

    /// B7 (Android 4af5e9d): tapping a language row must not fetch or persist labels — tap → Back
    /// leaves the saved language untouched.
    func testLanguageRowTapDoesNotSwitchLabelsBeforeSave() async throws {
        let fc = FarmerChat.initialize(config: FarmerChatConfig(environment: .dev))
        let previous = fc.prefs.string(.selectedLanguageCode)
        defer {
            if let previous { fc.prefs.setString(previous, .selectedLanguageCode) } else { fc.prefs.remove(.selectedLanguageCode) }
        }
        fc.prefs.setString("en", .selectedLanguageCode)
        StubURLProtocol.handler = { _, _ in (200, Data(#"{"some_label_hi":"x"}"#.utf8)) }
        let vm = SettingsViewModel(env: fc)
        vm.selectLanguage(id: 2, code: "hi")
        try await Task.sleep(nanoseconds: 300_000_000)
        XCTAssertEqual(vm.state.selectedLanguageId, 2)
        XCTAssertEqual(vm.state.selectedLanguageCode, "hi")
        XCTAssertEqual(fc.prefs.string(.selectedLanguageCode), "en", "nothing persisted before Save")
        XCTAssertEqual(StubURLProtocol.calls(to: "label"), 0, "no label fetch on a row tap")
    }

    private final class EventLog: @unchecked Sendable {
        private let lock = NSLock()
        private var _names: [String] = []
        var names: [String] { lock.lock(); defer { lock.unlock() }; return _names }
        func add(_ n: String) { lock.lock(); _names.append(n); lock.unlock() }
    }

    private func tinyJPEG() throws -> Data {
        let ctx = try XCTUnwrap(CGContext(data: nil, width: 4, height: 4, bitsPerComponent: 8, bytesPerRow: 0,
                                          space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue))
        ctx.setFillColor(CGColor(red: 0, green: 0.5, blue: 0, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: 4, height: 4))
        let image = try XCTUnwrap(ctx.makeImage())
        let data = NSMutableData()
        let dest = try XCTUnwrap(CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(dest, image, nil)
        XCTAssertTrue(CGImageDestinationFinalize(dest))
        return data as Data
    }

    /// A photo send reports Send_Query_Initiated and onMessageSent(caption) like every other send
    /// (Android SendQuestionWithImage); the SDK skipped the event for photos.
    func testPhotoSendReportsInitiatedAndCaption() async throws {
        let recorder = Recorder()
        let events = EventLog()
        let fc = FarmerChat.initialize(config: FarmerChatConfig(
            environment: .dev,
            enableAgenticChat: false,
            enableAnalytics: true,
            onEvent: { name, _ in events.add(name) },
            onMessageSent: { recorder.addSent($0) },
            onAnswerReceived: { recorder.addAnswer($0) }
        ))
        StubURLProtocol.handler = { request, _ in
            if (request.url?.path ?? "").contains("image_analysis") {
                return (200, Data(#"{"message_id":"img-1","response":"Leaf blight."}"#.utf8))
            }
            return (200, Data("{}".utf8))
        }
        let vm = ChatViewModel(env: fc)
        vm.setConversationId("c-2")
        vm.onAction(.sendQuestionWithImage(question: "What is this?", imageData: try tinyJPEG(), imageURL: nil))
        await waitUntilSettled(vm, after: 0)
        XCTAssertEqual(recorder.sent, ["What is this?"])
        XCTAssertEqual(recorder.answers, ["img-1"])
        XCTAssertTrue(events.names.contains(AnalyticsEvents.sendQueryInitiated), "\(events.names)")
    }
}
