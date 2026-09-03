import Foundation
import Combine

// MARK: - Agentic stream text sanitizing (2.0.0)

private let fcControlTokenRegex = try? NSRegularExpression(pattern: "<<[^>]*>>")
private let fcFollowupsBlockRegex = try? NSRegularExpression(pattern: "```followups[\\s\\S]*?```")

/// Minimum on-screen time per tool status, so back-to-back tool events (latency 0) are not
/// collapsed by `@Published` coalescing into just the last one.
let fcToolStatusMinDwellNanoseconds: UInt64 = 700_000_000

/// `triggered_input_type` for a send whose real trigger was an alignment-chip selection rather
/// than something the farmer typed or dictated (app parity — `align_chip_sel`).
///
/// Internal (not private) so the capability-chip tests can assert the literal.
let FCAlignChipSelInputType = "align_chip_sel"

/// Strips agentic control tokens that trail the streamed text but are absent from the clean
/// `metadata.response` — e.g. `<<commodities:chickpea>>` and a ```` ```followups ... ``` ```` block.
/// Without this the farmer watches raw control tokens type themselves into the answer.
///
/// Also cuts a still-streaming, not-yet-terminated token: mid-stream the text may end in a partial
/// `<<comm` or an unclosed fence, which must not be shown either.
///
/// Internal (not private) so it can be unit-tested — the live stream cannot be exercised yet.
func sanitizeAgenticStreamText(_ raw: String) -> String {
    var text = raw
    for regex in [fcFollowupsBlockRegex, fcControlTokenRegex] {
        guard let regex else { continue }
        text = regex.stringByReplacingMatches(
            in: text,
            options: [],
            range: NSRange(text.startIndex..<text.endIndex, in: text),
            withTemplate: ""
        )
    }
    if let fence = text.range(of: "```followups") {
        text = String(text[text.startIndex..<fence.lowerBound])
    }
    if let token = text.range(of: "<<") {
        text = String(text[text.startIndex..<token.lowerBound])
    }
    while let last = text.last, last.isWhitespace { text.removeLast() }
    return text
}

// MARK: - Message model (port of chat/udf ChatMessage)

public enum ChatMessage: Identifiable, Sendable, Equatable {
    case user(UserMessage)
    case aiResponse(AiResponse)
    /// The farmer's resolved location (2.0.0) — see ``LocationMessage``.
    case location(LocationMessage)
    case loadingPlaceholder(id: String)

    public struct UserMessage: Sendable, Equatable {
        public var text: String
        public var imageURL: URL?
        public var audioURL: URL?
        public var userBubbleImageWideBanner: Bool
        public var isFailed: Bool
        public var id: String

        public init(
            text: String,
            imageURL: URL? = nil,
            audioURL: URL? = nil,
            userBubbleImageWideBanner: Bool = false,
            isFailed: Bool = false,
            id: String = UUID().uuidString
        ) {
            self.text = text
            self.imageURL = imageURL
            self.audioURL = audioURL
            self.userBubbleImageWideBanner = userBubbleImageWideBanner
            self.isFailed = isFailed
            self.id = id
        }
    }

    public struct AiResponse: Sendable, Equatable {
        public var text: String
        public var followUpQuestions: [String]?
        public var id: String
        public var isPreGenerated: Bool
        /// Server message id (used for TTS + follow-up fetch).
        public var messageId: String?

        // ---- agentic streaming (SDK 2.0.0, endpoint #27a). All default to the 1.0.0 behaviour,
        // so a synchronous answer is indistinguishable from before. ----

        /// True while the agentic stream is in progress; suppresses the action buttons.
        public var isStreaming: Bool
        /// Transient tool progress label (e.g. "Checking weather forecast") shown while streaming.
        public var streamingStatus: String?
        /// True when this answer came from the agentic endpoint. Also suppresses the typewriter
        /// reveal on a finalized streamed answer (the text already typed itself once).
        public var isAgentic: Bool
        /// Terminal outcome of an agentic stream that did NOT complete normally. When true the
        /// answer renders with an inline error and a retry action; ``text`` may still hold a
        /// preserved partial answer, or be blank if the stream broke at the start. Always false
        /// for a normally finalized answer.
        public var isInterrupted: Bool
        /// Why the stream ended early; only meaningful when ``isInterrupted``.
        public var streamErrorKind: StreamErrorKind?

        // ---- alignment surfaces (2.0.0) ----

        /// Non-nil when this response is an alignment surface (clarify / confirm / escalate or a
        /// capability prompt) rather than a normal answer. Drives the chip rendering and the
        /// urgent (escalate) treatment in place of the usual action row.
        public var alignmentKind: AlignmentKind?
        /// Quick-reply chips: label is shown, value is sent on tap.
        public var alignmentChips: [AlignmentChip]?
        /// The surface's own prompt message. For an EXCLUSIVE surface the prompt already lives in
        /// ``text`` (it replaced the answer), so this stays nil. For an ADDITIVE surface
        /// (``AlignmentKind/isAdditive``) ``text`` holds the real answer and this carries the
        /// nudge rendered below it.
        public var alignmentMessage: String?
        /// Chip values already tapped on this surface. Accumulates so every picked chip stays
        /// highlighted and locked — each chip is clickable once — while the rest stay tappable.
        ///
        /// Two writers, both in this file: ``recordAlignmentPick(_:)`` for an ordinary chip (which
        /// matches on the text it sent), and ``sendLocationSharedQuery(sourceMessageId:address:)``
        /// for the share-location capability chip (whose text is never sent, so there is nothing
        /// for the matcher to find).
        public var alignmentSelectedValues: [String]
        /// The query that triggered this surface. Kept so a capability chip (e.g. "Share my
        /// location") can re-send the user's real question once the capability is satisfied,
        /// rather than sending the chip label as if it were the question.
        public var alignmentOriginalQuery: String?

        public init(
            text: String,
            followUpQuestions: [String]? = nil,
            id: String = UUID().uuidString,
            isPreGenerated: Bool = false,
            messageId: String? = nil,
            isStreaming: Bool = false,
            streamingStatus: String? = nil,
            isAgentic: Bool = false,
            isInterrupted: Bool = false,
            streamErrorKind: StreamErrorKind? = nil,
            alignmentKind: AlignmentKind? = nil,
            alignmentChips: [AlignmentChip]? = nil,
            alignmentMessage: String? = nil,
            alignmentSelectedValues: [String] = [],
            alignmentOriginalQuery: String? = nil
        ) {
            self.text = text
            self.followUpQuestions = followUpQuestions
            self.id = id
            self.isPreGenerated = isPreGenerated
            self.messageId = messageId
            self.isStreaming = isStreaming
            self.streamingStatus = streamingStatus
            self.isAgentic = isAgentic
            self.isInterrupted = isInterrupted
            self.streamErrorKind = streamErrorKind
            self.alignmentKind = alignmentKind
            self.alignmentChips = alignmentChips
            self.alignmentMessage = alignmentMessage
            self.alignmentSelectedValues = alignmentSelectedValues
            self.alignmentOriginalQuery = alignmentOriginalQuery
        }
    }

    /// The farmer's resolved location, shown in the thread in place of a text bubble once a
    /// GPS_PROMPT alignment chip has been satisfied (2.0.0). Rendered by `FCLocationChatBubble`
    /// (SwiftUI) / `FCUILocationBubbleCell` (UIKit), ports of Compose's `LocationChatBubble`.
    ///
    /// It stands in for the user text bubble a normal send would add — the farmer never typed
    /// anything, they shared a location.
    public struct LocationMessage: Sendable, Equatable {
        /// The resolved, human-readable address. Never blank: a blank address yields no bubble at
        /// all (app parity — see `ChatViewModel.sendLocationSharedQuery`).
        public var address: String
        public var id: String

        public init(address: String, id: String = UUID().uuidString) {
            self.address = address
            self.id = id
        }
    }

    public var id: String {
        switch self {
        case .user(let message): return "user_\(message.id)"
        case .aiResponse(let message): return "ai_\(message.id)"
        case .location(let message): return "location_\(message.id)"
        case .loadingPlaceholder(let id): return "loading_\(id)"
        }
    }
}

public enum ChatEntrySource: String, Sendable {
    case home
    case history
}

// MARK: - UDF Action (port of chat/udf/ChatAction.kt)

public enum ChatAction: Sendable {
    case initializeWithPreGeneratedContent(
        question: String,
        answer: String?,
        followUpQuestions: [String]?,
        isFromCampaign: Bool,
        homeStatementId: String?,
        userMessageImageURL: URL?
    )
    case initializeVoicePrototype(audioURL: URL, originScreenName: String)
    case initializeWithQuestion(
        question: String,
        transcriptionId: String?,
        audioURL: URL?,
        originScreenName: String,
        isWeatherAdviceCTA: Bool,
        isSSFR: Bool,
        ssfrCrop: String?,
        channel: String?
    )
    case replacePreGeneratedWithQuestion(question: String, triggerInputType: String?)
    case sendFollowUpQuestion(question: String, followUpQuestionId: String?, transcriptionId: String?, audioURL: URL?)
    /// A GPS_PROMPT "Share my location" capability chip succeeded (2.0.0): show `address` as a
    /// location bubble and re-send the surface's own `alignmentOriginalQuery`.
    ///
    /// `sourceMessageId` is the raw ``ChatMessage/AiResponse/id`` of the surface that offered the
    /// chip (NOT the prefixed ``ChatMessage/id``), so the pick is recorded on the right message.
    case sendLocationSharedQuery(sourceMessageId: String, address: String)
    case sendQuestionWithImage(question: String, imageData: Data, imageURL: URL?)
    case sendFollowUpVoiceQuestion(audioURL: URL, base64Audio: String)
    case sendQuestionWithAudio(question: String, audioURL: URL)
    case loadChatHistory(conversationId: String, page: Int)
    case retryLastRequest
    case clearError
    case clearMessages
    case synthesiseAudio
    case clearAudioPlaybackUrl
    case setAudioPlaying(Bool)
}

// MARK: - UDF State (port of chat/udf/ChatState.kt)

public struct ChatState: Sendable {
    public var messages: [ChatMessage] = []
    public var suggestedQuestions: [String]?
    public var suggestedQuestionIds: [String]?
    public var clarificationRequired: Bool = false
    public var chatResponseState: UiState<String> = .idle
    public var errorMessage: String?
    public var failedMessageId: String?
    public var isLoading: Bool = false
    public var isLoadingSynthesiseAudio: Bool = false
    public var audioPlaybackUrl: String?
    public var isAudioPlaying: Bool = false
    public var historyNextPage: Int?
    public var isInitialHistoryLoaded: Bool = false
    public var readFullAdviceRequestedForMessageId: String?
    public var isTtsEnabled: Bool = true

    public init() {}
}

// MARK: - ViewModel (port of ChatViewModel)

@MainActor
public final class ChatViewModel: ObservableObject {
    @Published public private(set) var state = ChatState()

    private let env: FarmerChat
    private var conversationId: String?
    /// Retry closure for the last failed request (RetryLastRequest).
    private var lastRequest: (@MainActor () async -> Void)?
    private var didAskFirstQuery = false

    public init(env: FarmerChat = .shared) {
        self.env = env
        state.isTtsEnabled = true
    }

    // MARK: - Action dispatch

    public func onAction(_ action: ChatAction) {
        switch action {
        case .initializeWithPreGeneratedContent(let question, let answer, let followUps, _, let homeStatementId, let imageURL):
            initializeWithPreGenerated(question: question, answer: answer, followUps: followUps, homeStatementId: homeStatementId, imageURL: imageURL)
        case .initializeVoicePrototype(let audioURL, _):
            initializeVoicePrototype(audioURL: audioURL)
        case .initializeWithQuestion(let question, let transcriptionId, let audioURL, let origin, let isWeatherCTA, let isSSFR, let ssfrCrop, _):
            Task {
                await self.sendQuestion(
                    question,
                    transcriptionId: transcriptionId,
                    audioURL: audioURL,
                    // App parity: weather-CTA / SSFR carry their own type; else voice/text (not "keyboard").
                    triggeredInputType: isWeatherCTA ? "weather" : (isSSFR ? "ssfr" : (audioURL != nil ? "voice" : "text")),
                    weatherCtaTriggered: isWeatherCTA,
                    ssfrCrop: isSSFR ? ssfrCrop : nil,
                    originScreen: origin
                )
            }
        case .replacePreGeneratedWithQuestion(let question, let triggerInputType):
            replacePreGenerated(question: question, triggerInputType: triggerInputType)
        case .sendFollowUpQuestion(let question, let followUpQuestionId, let transcriptionId, let audioURL):
            // If this question came from an alignment surface's chip, record it on that message
            // before the send starts, so the chip locks immediately on tap.
            recordAlignmentPick(question)
            Task {
                if followUpQuestionId != nil || self.state.suggestedQuestions?.contains(question) == true {
                    _ = await self.env.api.followUpQuestionClick(FollowUpClickRequest(followUpQuestion: question))
                    self.env.analytics.track(AnalyticsEvents.followUpQuestionClicked, props: ["question": question])
                }
                await self.sendQuestion(
                    question,
                    transcriptionId: transcriptionId,
                    audioURL: audioURL,
                    // App parity: keyboard follow-up sends "follow_up" (not "keyboard").
                    triggeredInputType: audioURL != nil ? "voice" : "follow_up",
                    weatherCtaTriggered: false,
                    ssfrCrop: nil,
                    originScreen: ScreenNames.chat
                )
            }
        case .sendLocationSharedQuery(let sourceMessageId, let address):
            sendLocationSharedQuery(sourceMessageId: sourceMessageId, address: address)
        case .sendQuestionWithImage(let question, let imageData, let imageURL):
            Task { await self.sendImageQuestion(question: question, imageData: imageData, imageURL: imageURL) }
        case .sendFollowUpVoiceQuestion(let audioURL, let base64Audio):
            Task { await self.sendVoiceQuestion(audioURL: audioURL, base64Audio: base64Audio) }
        case .sendQuestionWithAudio(let question, let audioURL):
            Task {
                await self.sendQuestion(
                    question,
                    transcriptionId: nil,
                    audioURL: audioURL,
                    triggeredInputType: "voice",
                    weatherCtaTriggered: false,
                    ssfrCrop: nil,
                    originScreen: ScreenNames.chat
                )
            }
        case .loadChatHistory(let conversationId, let page):
            Task { await self.loadChatHistory(conversationId: conversationId, page: page) }
        case .retryLastRequest:
            retryLastRequest()
        case .clearError:
            state.errorMessage = nil
            state.chatResponseState = .idle
        case .clearMessages:
            state = ChatState()
            conversationId = nil
            lastRequest = nil
        case .synthesiseAudio:
            Task { await self.synthesiseAudio() }
        case .clearAudioPlaybackUrl:
            state.audioPlaybackUrl = nil
            state.isAudioPlaying = false
        case .setAudioPlaying(let isPlaying):
            state.isAudioPlaying = isPlaying
            env.analytics.track(
                isPlaying ? AnalyticsEvents.startedPlayingResponseAudio : AnalyticsEvents.stoppedPlayingResponseAudio
            )
        }
    }

    // MARK: - Conversation management

    /// Uses the pending conversation (created by Home's NewConversation) or
    /// creates a fresh one.
    private func ensureConversationId() async -> String? {
        if let conversationId { return conversationId }
        if let pending = env.prefs.string(.newConversationId), !pending.isEmpty {
            conversationId = pending
            return pending
        }
        guard let userId = env.session.userId else { return nil }
        let result = await env.api.newConversation(NewConversationRequest(userId: userId))
        if case .success(let response) = result, let newId = response.conversationId?.stringValue {
            conversationId = newId
            env.prefs.setString(newId, .newConversationId)
            return newId
        }
        return nil
    }

    public func setConversationId(_ id: String) {
        conversationId = id
    }

    // MARK: - Initialization paths

    private func initializeWithPreGenerated(question: String, answer: String?, followUps: [String]?, homeStatementId: String?, imageURL: URL?) {
        guard state.messages.isEmpty else { return }
        state.messages.append(.user(ChatMessage.UserMessage(
            text: question,
            imageURL: imageURL,
            userBubbleImageWideBanner: imageURL != nil
        )))
        if let answer, !answer.isEmpty {
            state.messages.append(.aiResponse(ChatMessage.AiResponse(
                text: answer,
                followUpQuestions: followUps,
                isPreGenerated: true,
                messageId: homeStatementId
            )))
            state.suggestedQuestions = followUps
            state.chatResponseState = .success(answer)
        } else {
            // No answer supplied — behave like a plain question.
            Task {
                await self.sendQuestionInternal(
                    question,
                    transcriptionId: nil,
                    audioURL: nil,
                    triggeredInputType: "card",
                    weatherCtaTriggered: false,
                    ssfrCrop: nil,
                    statementId: homeStatementId.map { FlexibleID($0) },
                    replaceExistingUserBubble: true
                )
            }
        }
    }

    /// Audio-only entry: show voice bubble, transcribe, then ask.
    private func initializeVoicePrototype(audioURL: URL) {
        guard state.messages.isEmpty else { return }
        Task {
            guard let base64 = try? Data(contentsOf: audioURL).base64EncodedString() else {
                state.errorMessage = env.labels.label("transcription_failed", fallback: "We couldn't hear that. Please try again.")
                return
            }
            await sendVoiceQuestion(audioURL: audioURL, base64Audio: base64)
        }
    }

    /// "Read full advice": swaps the pre-generated card content for a real
    /// AI answer to the same question.
    private func replacePreGenerated(question: String, triggerInputType: String?) {
        if case .aiResponse(let ai) = state.messages.last, ai.isPreGenerated {
            state.readFullAdviceRequestedForMessageId = ai.id
            state.messages.removeLast()
        }
        env.analytics.track(AnalyticsEvents.readFullAdviceClicked, props: ["question": question])
        Task {
            await self.sendQuestionInternal(
                question,
                transcriptionId: nil,
                audioURL: nil,
                // App parity: read-full-advice sends "read_full_advice" (was "card").
                // (statement_id + append-not-replace remain — AiResponse doesn't
                // carry the pre-gen statement_id; tracked in docs/04.)
                triggeredInputType: "read_full_advice",
                weatherCtaTriggered: false,
                ssfrCrop: nil,
                statementId: nil,
                replaceExistingUserBubble: true
            )
        }
    }

    // MARK: - Text question pipeline

    private func sendQuestion(
        _ question: String,
        transcriptionId: String?,
        audioURL: URL?,
        triggeredInputType: String,
        weatherCtaTriggered: Bool,
        ssfrCrop: String?,
        originScreen: String
    ) async {
        env.analytics.track(AnalyticsEvents.sendQueryInitiated, props: [
            "input_type": triggeredInputType,
            "screen": originScreen
        ])
        env.config.onMessageSent?(question) // C4 semantic callback
        await sendQuestionInternal(
            question,
            transcriptionId: transcriptionId,
            audioURL: audioURL,
            triggeredInputType: triggeredInputType,
            weatherCtaTriggered: weatherCtaTriggered,
            ssfrCrop: ssfrCrop,
            statementId: nil,
            replaceExistingUserBubble: false
        )
    }

    private func sendQuestionInternal(
        _ question: String,
        transcriptionId: String?,
        audioURL: URL?,
        triggeredInputType: String,
        weatherCtaTriggered: Bool,
        ssfrCrop: String?,
        statementId: FlexibleID?,
        replaceExistingUserBubble: Bool,
        isRetry: Bool = false
    ) async {
        guard !state.isLoading else { return }
        state.errorMessage = nil
        state.suggestedQuestions = nil
        state.clarificationRequired = false
        state.isLoading = true
        state.chatResponseState = .loading

        let userMessageId = UUID().uuidString
        if !replaceExistingUserBubble || state.messages.isEmpty {
            state.messages.append(.user(ChatMessage.UserMessage(text: question, audioURL: audioURL, id: userMessageId)))
        }
        let placeholderId = UUID().uuidString
        state.messages.append(.loadingPlaceholder(id: placeholderId))

        defer { state.isLoading = false }

        guard let convId = await ensureConversationId() else {
            failCurrent(
                placeholderId: placeholderId,
                userMessageId: userMessageId,
                message: env.labels.label("error_generic", fallback: "Something went wrong. Please try again."),
                retry: { [weak self] in
                    await self?.sendQuestionInternal(
                        question, transcriptionId: transcriptionId, audioURL: audioURL,
                        triggeredInputType: triggeredInputType, weatherCtaTriggered: weatherCtaTriggered,
                        ssfrCrop: ssfrCrop, statementId: statementId,
                        replaceExistingUserBubble: true, isRetry: true
                    )
                }
            )
            return
        }

        let request = TextPromptRequest(
            query: question,
            conversationId: convId,
            // App parity: message_id is sent empty (""); the response id is authoritative.
            messageId: "",
            statementId: statementId,
            weatherCtaTriggered: weatherCtaTriggered,
            triggeredInputType: triggeredInputType,
            ssfrCrop: ssfrCrop,
            transcriptionId: transcriptionId,
            retry: isRetry
        )
        env.analytics.track(AnalyticsEvents.sendQuery, props: [
            "input_type": triggeredInputType,
            "conversation_id": convId
        ])
        if !env.prefs.bool(.firstQueryAsked) {
            env.prefs.setBool(true, .firstQueryAsked)
            env.analytics.track(AnalyticsEvents.firstQueryAsked)
        }

        // 2.0.0 opt-in: stream #27a instead of one synchronous #27 reply. Text path only —
        // image analysis (#28) and voice transcription (#16) stay synchronous, matching Android's
        // `fetchTextPromptResponse`.
        if env.config.enableAgenticChat {
            await streamAgenticAnswer(
                request: request,
                placeholderId: placeholderId,
                retry: { [weak self] in
                    await self?.sendQuestionInternal(
                        question, transcriptionId: transcriptionId, audioURL: audioURL,
                        triggeredInputType: triggeredInputType, weatherCtaTriggered: weatherCtaTriggered,
                        ssfrCrop: ssfrCrop, statementId: statementId,
                        replaceExistingUserBubble: true, isRetry: true
                    )
                }
            )
            return
        }

        let result = await env.api.getAnswerForTextQuery(request)
        switch result {
        case .success(let response):
            if await handleTextPromptSuccess(response, placeholderId: placeholderId) { break }
            failCurrent(
                placeholderId: placeholderId,
                userMessageId: userMessageId,
                message: response.message ?? env.labels.label("chat_answer_failed", fallback: "We couldn't answer that right now. Please try again."),
                retry: { [weak self] in
                    await self?.sendQuestionInternal(
                        question, transcriptionId: transcriptionId, audioURL: audioURL,
                        triggeredInputType: triggeredInputType, weatherCtaTriggered: weatherCtaTriggered,
                        ssfrCrop: ssfrCrop, statementId: statementId,
                        replaceExistingUserBubble: true, isRetry: true
                    )
                }
            )
        case .error(let error):
            failCurrent(
                placeholderId: placeholderId,
                userMessageId: userMessageId,
                message: error.message ?? env.labels.label(
                    error.isNetworkError ? "no_internet_message" : "chat_answer_failed",
                    fallback: error.isNetworkError
                        ? "You appear to be offline. Check your connection and try again."
                        : "We couldn't answer that right now. Please try again."
                ),
                retry: { [weak self] in
                    await self?.sendQuestionInternal(
                        question, transcriptionId: transcriptionId, audioURL: audioURL,
                        triggeredInputType: triggeredInputType, weatherCtaTriggered: weatherCtaTriggered,
                        ssfrCrop: ssfrCrop, statementId: statementId,
                        replaceExistingUserBubble: true, isRetry: true
                    )
                }
            )
        }
    }

    /// Shared terminal handling for a #27 answer — and for the agentic stream's terminal
    /// `metadata` event, whose payload is field-compatible with `TextPromptResponse`. One path
    /// means the C4 callbacks, TTS gating and follow-ups (#29) are shared with the synchronous
    /// path rather than reimplemented for streaming.
    ///
    /// Returns false when the payload is an error or carries no answer at all, so the caller runs
    /// its own failure treatment (a failed user bubble on the synchronous path, an interrupted
    /// stream bubble on the agentic one).
    private func handleTextPromptSuccess(
        _ response: TextPromptResponse,
        placeholderId: String,
        streamId: String? = nil,
        isAgentic: Bool = false
    ) async -> Bool {
        let alignmentKind = AlignmentKind.fromType(response.alignments?.type)
        var text = response.translatedResponse ?? response.response ?? ""
        if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
           let alignmentKind, !alignmentKind.isAdditive {
            // An EXCLUSIVE alignment surface arrives with `response` EMPTY on purpose: its prompt
            // IS `alignments.message`. Falling through to the failure path here would show the
            // farmer an error instead of the question they are being asked.
            text = response.alignments?.message ?? ""
        }
        guard response.error != true,
              !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return false
        }

        state.messages.removeAll { $0.id == "loading_\(placeholderId)" }
        if let streamId {
            // Drop the streaming bubble; `metadata` is the authoritative, clean answer.
            state.messages.removeAll { $0.id == "ai_\(streamId)" }
        }
        let aiId = UUID().uuidString
        state.messages.append(.aiResponse(ChatMessage.AiResponse(
            text: text,
            id: aiId,
            messageId: response.messageId?.stringValue,
            isAgentic: isAgentic,
            // 2.0.0: an alignment surface asks the user to clarify/confirm instead of (or
            // alongside) answering. Exclusive surfaces replace the answer, additive ones sit
            // below it — see AlignmentKind.
            alignmentKind: alignmentKind,
            alignmentChips: response.alignments?.chips,
            alignmentMessage: alignmentKind?.isAdditive == true ? response.alignments?.message : nil,
            alignmentOriginalQuery: response.alignments?.originalQuery
        )))
        state.chatResponseState = .success(text)
        state.failedMessageId = nil
        lastRequest = nil
        if let mid = response.messageId?.stringValue {
            env.config.onAnswerReceived?(mid) // C4 semantic callback
        }
        if response.hideTtsSpeaker == true { state.isTtsEnabled = false }
        // Real follow-ups always come from endpoint #29.
        if response.hideFollowUpQuestion != true, let messageId = response.messageId?.stringValue {
            await fetchFollowUps(messageId: messageId, aiMessageLocalId: aiId)
        }
        return true
    }

    // MARK: - Agentic streaming (#27a, 2.0.0)

    /// Consumes the agentic stream (#27a — gated on `FarmerChatConfig.enableAgenticChat`).
    /// Faithful port of Android's `streamAgenticAnswer`, itself a port of the app's
    /// `consumeAgenticStream` (fc-compose-agentic @ c0524dd6, ChatViewModel.kt:1444).
    ///
    /// Accumulates `text_delta`s into the answer bubble for live typing, surfaces tool status
    /// labels while tools run, and finalizes on `metadata`. If the stream ends without one, falls
    /// back to `done`, then to the accumulated text.
    private func streamAgenticAnswer(
        request: TextPromptRequest,
        placeholderId: String,
        retry: @escaping @MainActor () async -> Void
    ) async {
        // Reuse the placeholder's id as the stream id so the loading bubble becomes the answer
        // bubble in place, with no remove/insert flicker.
        let streamId = placeholderId
        var builder = ""
        var finalized = false
        // Captured but NOT finalized on arrival: a `metadata` normally follows `done` and is
        // richer (message_id, follow-up ids), so it wins. `done` is only a fallback.
        var pendingDone: (answer: String?, followUps: [String])?

        // Single exit for every "no terminal metadata" outcome — clean EOF, a failure event, or a
        // thrown error. Runs at most once (guarded + latches `finalized`).
        func finalizeStreamOrFail(_ errorKind: StreamErrorKind? = nil) {
            if finalized { return }
            finalized = true
            let fallbackText = sanitizeAgenticStreamText(builder)
            let doneAnswer = pendingDone?.answer?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if let done = pendingDone, !doneAnswer.isEmpty || !fallbackText.isEmpty {
                // A `done` means the model actually finished → a complete answer, not an
                // interruption, even if the transport dropped right after.
                finalizeAgenticAnswer(
                    text: doneAnswer.isEmpty ? fallbackText : (done.answer ?? fallbackText),
                    followUps: done.followUps.isEmpty ? nil : done.followUps,
                    streamId: streamId
                )
            } else if let errorKind, !fallbackText.isEmpty {
                // Genuine error after some text arrived: keep the partial and mark it interrupted
                // so the UI can offer retry.
                interruptAgentic(streamId: streamId, text: fallbackText, kind: errorKind, retry: retry)
            } else if !fallbackText.isEmpty {
                // Clean EOF with partial text and no terminal event: some backends stream deltas
                // without a done/metadata. Treat it as the complete answer — flagging it
                // interrupted would make every normal answer on such a backend look broken.
                finalizeAgenticAnswer(text: fallbackText, followUps: nil, streamId: streamId)
            } else {
                // Nothing usable arrived.
                interruptAgentic(
                    streamId: streamId, text: "", kind: errorKind ?? .unknown, retry: retry
                )
            }
        }

        do {
            for try await event in env.api.streamAnswerForTextQueryAgentic(request) {
                switch event {
                case .toolCall(_, let statusText), .toolResult(_, let statusText):
                    guard let statusText,
                          !statusText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                        break
                    }
                    updateStreamingResponse(
                        streamId: streamId,
                        text: sanitizeAgenticStreamText(builder),
                        status: statusText
                    )
                    // Minimum dwell so back-to-back tool events are not collapsed into the last.
                    try? await Task.sleep(nanoseconds: fcToolStatusMinDwellNanoseconds)

                case .textDelta(let delta):
                    builder += delta
                    // Text is flowing; clear any transient tool status.
                    updateStreamingResponse(
                        streamId: streamId,
                        text: sanitizeAgenticStreamText(builder),
                        status: nil
                    )

                case .metadata(let response):
                    finalized = true
                    // `metadata` carries a TextPromptResponse — the same shape #27 returns — so
                    // finalize through the shared path and inherit its callbacks, TTS gating and
                    // follow-up handling for free.
                    let handled = await handleTextPromptSuccess(
                        response, placeholderId: placeholderId, streamId: streamId, isAgentic: true
                    )
                    if !handled {
                        // An error/blank terminal payload: keep whatever streamed and offer retry.
                        interruptAgentic(
                            streamId: streamId,
                            text: sanitizeAgenticStreamText(builder),
                            kind: .server,
                            retry: retry
                        )
                    }

                // Fallback terminal: remember it, let a following `metadata` win.
                case .done(let answer, let followUps):
                    pendingDone = (answer, followUps)

                // Don't discard a completed `done`: if it arrived before the failure the answer is
                // still finalized from it.
                case .failure(_, let kind):
                    finalizeStreamOrFail(kind)
                }
            }
            // Clean EOF with no terminal metadata: no transport error was observed.
            finalizeStreamOrFail()
        } catch is CancellationError {
            // Screen left / task cancelled: leave the thread alone, don't write a stale error card.
            return
        } catch {
            finalizeStreamOrFail(.network)
        }
    }

    /// Swaps the streamed answer into the slot the loading placeholder occupies (both share the
    /// stream id), so the bubble grows in place instead of being removed and re-appended.
    private func upsertStreamMessage(_ ai: ChatMessage.AiResponse) {
        if let index = state.messages.firstIndex(where: { $0.id == "ai_\(ai.id)" }) {
            state.messages[index] = .aiResponse(ai)
            return
        }
        if let index = state.messages.firstIndex(where: { $0.id == "loading_\(ai.id)" }) {
            state.messages[index] = .aiResponse(ai)
            return
        }
        state.messages.removeAll {
            if case .loadingPlaceholder = $0 { return true }
            return false
        }
        state.messages.append(.aiResponse(ai))
    }

    /// Replaces the loading placeholder / prior streaming bubble with the in-progress answer.
    private func updateStreamingResponse(streamId: String, text: String, status: String?) {
        upsertStreamMessage(ChatMessage.AiResponse(
            text: text,
            id: streamId,
            isStreaming: true,
            streamingStatus: status,
            isAgentic: true
        ))
        state.isLoading = true
        state.errorMessage = nil
        state.failedMessageId = nil
    }

    /// Settles a streamed answer that finished without a `metadata` event.
    private func finalizeAgenticAnswer(text: String, followUps: [String]?, streamId: String) {
        upsertStreamMessage(ChatMessage.AiResponse(
            text: text,
            followUpQuestions: followUps,
            id: streamId,
            isAgentic: true
        ))
        state.isLoading = false
        state.errorMessage = nil
        state.failedMessageId = nil
        state.chatResponseState = .success(text)
        state.suggestedQuestions = followUps
        state.suggestedQuestionIds = nil
        lastRequest = nil
    }

    /// Settles a stream that ended early; `text` may hold a preserved partial answer.
    private func interruptAgentic(
        streamId: String,
        text: String,
        kind: StreamErrorKind,
        retry: @escaping @MainActor () async -> Void
    ) {
        upsertStreamMessage(ChatMessage.AiResponse(
            text: text,
            id: streamId,
            isAgentic: true,
            isInterrupted: true,
            streamErrorKind: kind
        ))
        let message = env.labels.label(
            AgenticLabels.failedToGetResponse,
            fallback: AgenticLabels.failedToGetResponseFallback
        )
        state.isLoading = false
        // Deliberately NOT `state.errorMessage` (Android does set it): ChatView renders an inline
        // error banner from that field whenever the thread is non-empty, which would duplicate the
        // in-bubble StreamErrorCard. The card owns the message and the retry action instead.
        state.chatResponseState = .error(message: message, code: nil, isNetworkError: kind == .network)
        env.config.onError?(nil, message) // C4 semantic callback (all fail paths)
        // The card's "Try again" dispatches .retryLastRequest, which only fires `lastRequest`.
        lastRequest = retry
    }

    private func failCurrent(placeholderId: String, userMessageId: String, message: String, retry: @escaping @MainActor () async -> Void) {
        state.messages.removeAll { $0.id == "loading_\(placeholderId)" }
        // Mark user bubble failed.
        state.messages = state.messages.map { entry in
            if case .user(var user) = entry, user.id == userMessageId {
                user.isFailed = true
                return .user(user)
            }
            return entry
        }
        state.failedMessageId = userMessageId
        state.errorMessage = message
        state.chatResponseState = .error(message: message, code: nil, isNetworkError: false)
        env.config.onError?(nil, message) // C4 semantic callback (all fail paths)
        lastRequest = { [weak self] in
            // Remove the failed bubble; retry re-adds it.
            self?.state.messages.removeAll {
                if case .user(let user) = $0 { return user.id == userMessageId }
                return false
            }
            await retry()
        }
    }

    private func retryLastRequest() {
        guard let retry = lastRequest else { return }
        lastRequest = nil
        state.errorMessage = nil
        state.failedMessageId = nil
        Task { await retry() }
    }

    // MARK: - Capability chips (2.0.0)

    /// The GPS_PROMPT "Share my location" chip succeeded: show the resolved address as a
    /// ``ChatMessage/location(_:)`` bubble and re-send the surface's original query.
    ///
    /// Port of the app's `sendLocationSharedQuery` (mirrored from Android core). The location
    /// bubble takes the place of the user text bubble a normal send would add — the farmer never
    /// typed anything, they shared a location — and a **blank address yields no bubble at all**,
    /// matching the app.
    ///
    /// Two deliberate deltas from the app, both already accepted on Android and recorded in
    /// docs/04:
    ///  - **no `parent_message_id`.** The app sends the surface's server `message_id` back so the
    ///    backend correlates the answer to the prompt. ``TextPromptRequest`` has no such field, so
    ///    no alignment chip send carries it — an SDK-wide gap, not specific to this path.
    ///  - **no `agentic_chip_*` analytics properties.** The iOS analytics props are a flat
    ///    dictionary with no chip type/value/label/status fields, so this reports as an ordinary
    ///    text query. `triggered_input_type` IS sent as `align_chip_sel` (app parity).
    private func sendLocationSharedQuery(sourceMessageId: String, address: String) {
        // Checked BEFORE any mutation: `sendQuestionInternal`'s own guard would bail after the
        // location bubble had already been appended, orphaning it with no answer coming.
        guard !state.isLoading else { return }
        guard let index = state.messages.firstIndex(where: { entry in
            if case .aiResponse(let ai) = entry { return ai.id == sourceMessageId }
            return false
        }), case .aiResponse(var source) = state.messages[index] else { return }
        // No original query means nothing to ask — bail before mutating state (defensive; the
        // gps-prompt contract always carries original_query).
        guard let query = source.alignmentOriginalQuery,
              !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        // Mark share_precise_location as picked so the source chip locks/highlights exactly as a
        // plain chip tap would. `recordAlignmentPick` cannot do it — the chip's text is never sent
        // as the question, so there is nothing for it to match on.
        if !source.alignmentSelectedValues.contains(AlignmentChip.valueShareLocation) {
            source.alignmentSelectedValues.append(AlignmentChip.valueShareLocation)
            state.messages[index] = .aiResponse(source)
        }

        if !address.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            state.messages.append(.location(ChatMessage.LocationMessage(address: address)))
        }

        state.suggestedQuestions = nil
        env.analytics.track(AnalyticsEvents.sendQueryInitiated, props: [
            "input_type": FCAlignChipSelInputType,
            "screen": ScreenNames.chat
        ])
        env.config.onMessageSent?(query) // C4 semantic callback
        Task {
            // `replaceExistingUserBubble: true` with a non-empty thread suppresses the user text
            // bubble (the location bubble above IS the farmer's reply) and appends the loading
            // placeholder after it, giving location-bubble-then-placeholder ordering.
            await self.sendQuestionInternal(
                query,
                transcriptionId: nil,
                audioURL: nil,
                triggeredInputType: FCAlignChipSelInputType,
                weatherCtaTriggered: false,
                ssfrCrop: nil,
                statementId: nil,
                replaceExistingUserBubble: true
            )
        }
    }

    // MARK: - Alignment chip selection (2.0.0)

    /// Records a tapped alignment chip on its own message so the surface can render it as picked.
    ///
    /// Kept in core rather than duplicated per flavour: SwiftUI and UIKit both dispatch a plain
    /// ``ChatAction/sendFollowUpQuestion(question:followUpQuestionId:transcriptionId:audioURL:)``
    /// for a chip tap, so neither needs to know about selection state and both light up from this
    /// one place. Mirrors `recordAlignmentPick` in the Android core.
    ///
    /// Without this, ``ChatMessage/AiResponse/alignmentSelectedValues`` stays empty forever and
    /// the whole selected/locked chip treatment is dead code: the tapped chip never shows a
    /// check, never locks, and the unpicked chips never fade back.
    private func recordAlignmentPick(_ question: String) {
        guard !question.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        guard let idx = state.messages.lastIndex(where: { entry in
            if case .aiResponse(let ai) = entry { return ai.alignmentKind != nil }
            return false
        }) else { return }
        guard case .aiResponse(var surface) = state.messages[idx] else { return }
        // Only record a match against this surface's own chips — a follow-up the user typed
        // themselves must never mark a chip as chosen. Matched on value OR label because a
        // chip may carry only a label.
        let matches = (surface.alignmentChips ?? []).contains {
            $0.value == question || $0.label == question
        }
        guard matches, !surface.alignmentSelectedValues.contains(question) else { return }
        surface.alignmentSelectedValues.append(question)
        state.messages[idx] = .aiResponse(surface)
    }

    // MARK: - Follow-ups (#29)

    private func fetchFollowUps(messageId: String, aiMessageLocalId: String) async {
        let result = await env.api.followUpQuestions(messageId: messageId)
        guard case .success(let response) = result else { return }
        let questions = response.questions ?? []
        state.suggestedQuestions = questions.isEmpty ? nil : questions
        state.suggestedQuestionIds = questions.isEmpty ? nil : questions.map { _ in UUID().uuidString }
        state.clarificationRequired = response.clarificationRequired ?? false
        state.messages = state.messages.map { entry in
            if case .aiResponse(var ai) = entry, ai.id == aiMessageLocalId {
                ai.followUpQuestions = questions.isEmpty ? nil : questions
                return .aiResponse(ai)
            }
            return entry
        }
    }

    // MARK: - Voice question (transcribe → ask)

    private func sendVoiceQuestion(audioURL: URL, base64Audio: String) async {
        guard !state.isLoading else { return }
        state.isLoading = true
        let userMessageId = UUID().uuidString
        state.messages.append(.user(ChatMessage.UserMessage(text: "", audioURL: audioURL, id: userMessageId)))
        let placeholderId = UUID().uuidString
        state.messages.append(.loadingPlaceholder(id: placeholderId))

        guard let convId = await ensureConversationId() else {
            state.isLoading = false
            failCurrent(
                placeholderId: placeholderId,
                userMessageId: userMessageId,
                message: env.labels.label("error_generic", fallback: "Something went wrong. Please try again."),
                retry: { [weak self] in await self?.sendVoiceQuestion(audioURL: audioURL, base64Audio: base64Audio) }
            )
            return
        }

        let request = SetVoiceRequest(
            conversationId: convId,
            query: base64Audio,
            messageReferenceId: UUID().uuidString,
            inputAudioEncodingFormat: AudioRecorderService.audioFormatField,
            triggeredInputType: "voice"
        )
        let result = await env.api.transcribeAudio(request)
        state.isLoading = false

        switch result {
        case .success(let response) where response.isAcceptable:
            env.analytics.track(AnalyticsEvents.transcriptionSuccess, props: ["confidence": String(response.confidenceScore ?? 0)])
            let text = response.heardInputQuery ?? ""
            // Fill the transcription into the voice bubble.
            state.messages = state.messages.map { entry in
                if case .user(var user) = entry, user.id == userMessageId {
                    user.text = text
                    return .user(user)
                }
                return entry
            }
            state.messages.removeAll { $0.id == "loading_\(placeholderId)" }
            await sendQuestionInternal(
                text,
                transcriptionId: response.transcriptionId?.stringValue,
                audioURL: audioURL,
                triggeredInputType: "voice",
                weatherCtaTriggered: false,
                ssfrCrop: nil,
                statementId: nil,
                replaceExistingUserBubble: true
            )
        case .success:
            env.analytics.track(AnalyticsEvents.transcriptionFailed, props: ["reason": "low_confidence"])
            failCurrent(
                placeholderId: placeholderId,
                userMessageId: userMessageId,
                message: env.labels.label("transcription_failed", fallback: "We couldn't hear that. Please try again."),
                retry: { [weak self] in await self?.sendVoiceQuestion(audioURL: audioURL, base64Audio: base64Audio) }
            )
        case .error(let error):
            env.analytics.track(AnalyticsEvents.transcriptionFailed, props: ["reason": error.message ?? "network"])
            failCurrent(
                placeholderId: placeholderId,
                userMessageId: userMessageId,
                message: error.message ?? env.labels.label("transcription_failed", fallback: "We couldn't hear that. Please try again."),
                retry: { [weak self] in await self?.sendVoiceQuestion(audioURL: audioURL, base64Audio: base64Audio) }
            )
        }
    }

    // MARK: - Image question (#28)

    private func sendImageQuestion(question: String, imageData: Data, imageURL: URL?) async {
        guard !state.isLoading else { return }
        state.isLoading = true
        state.errorMessage = nil
        state.suggestedQuestions = nil
        let userMessageId = UUID().uuidString
        state.messages.append(.user(ChatMessage.UserMessage(
            text: question,
            imageURL: imageURL,
            userBubbleImageWideBanner: true,
            id: userMessageId
        )))
        let placeholderId = UUID().uuidString
        state.messages.append(.loadingPlaceholder(id: placeholderId))
        state.chatResponseState = .loading

        defer { state.isLoading = false }

        guard let convId = await ensureConversationId() else {
            failCurrent(
                placeholderId: placeholderId,
                userMessageId: userMessageId,
                message: env.labels.label("error_generic", fallback: "Something went wrong. Please try again."),
                retry: { [weak self] in await self?.sendImageQuestion(question: question, imageData: imageData, imageURL: imageURL) }
            )
            return
        }

        env.analytics.track(AnalyticsEvents.sendQuery, props: ["input_type": "camera", "conversation_id": convId])
        let request = PlantixRequest(
            conversationId: convId,
            image: imageData.base64EncodedString(),
            triggeredInputType: "image",
            query: question.isEmpty ? nil : question,
            // App parity: latitude/longitude sent as STRINGs.
            latitude: env.prefs.double(.latitude).map { String($0) },
            longitude: env.prefs.double(.longitude).map { String($0) },
            imageName: "fc_sdk_\(Int(Date().timeIntervalSince1970)).jpg",
            retry: false
        )
        let result = await env.api.imageAnalysis(request)
        switch result {
        case .success(let response) where response.error != true && response.response != nil:
            let text = response.response ?? ""
            state.messages.removeAll { $0.id == "loading_\(placeholderId)" }
            let aiId = UUID().uuidString
            state.messages.append(.aiResponse(ChatMessage.AiResponse(
                text: text,
                id: aiId,
                messageId: response.messageId?.stringValue
            )))
            state.chatResponseState = .success(text)
            lastRequest = nil
            if let messageId = response.messageId?.stringValue {
                await fetchFollowUps(messageId: messageId, aiMessageLocalId: aiId)
            }
        case .success(let response):
            failCurrent(
                placeholderId: placeholderId,
                userMessageId: userMessageId,
                message: response.message ?? env.labels.label("chat_answer_failed", fallback: "We couldn't answer that right now. Please try again."),
                retry: { [weak self] in await self?.sendImageQuestion(question: question, imageData: imageData, imageURL: imageURL) }
            )
        case .error(let error):
            failCurrent(
                placeholderId: placeholderId,
                userMessageId: userMessageId,
                message: error.message ?? env.labels.label("chat_answer_failed", fallback: "We couldn't answer that right now. Please try again."),
                retry: { [weak self] in await self?.sendImageQuestion(question: question, imageData: imageData, imageURL: imageURL) }
            )
        }
    }

    // MARK: - History (#32) with pagination

    private func loadChatHistory(conversationId: String, page: Int) async {
        self.conversationId = conversationId
        if page == 1 {
            state.isLoading = true
            state.chatResponseState = .loading
        }
        let result = await env.api.conversationChatHistory(conversationId: conversationId, page: page)
        state.isLoading = false
        switch result {
        case .success(let response):
            let mapped = Self.mapHistory(response.messages, page: page)
            if page == 1 {
                state.messages = mapped
                state.isInitialHistoryLoaded = true
            } else {
                // Prepend older page above current thread.
                state.messages = mapped + state.messages
            }
            // Hard guard: duplicate ids break SwiftUI list identity (and hard-crash the
            // equivalent Compose LazyColumn), so never trust the wire to be unique.
            var seenIds = Set<String>()
            state.messages = state.messages.filter { seenIds.insert($0.id).inserted }
            // The #32 response carries no pagination metadata (only
            // {conversation_id, data}); the app pages by "did this page return
            // any items" — page+1 until an empty page comes back. Base this on
            // the RAW items, not `mapped`: a page can hold only type-7 follow-up
            // or unknown-type items that map to zero bubbles yet still advance.
            state.historyNextPage = response.messages.isEmpty ? nil : page + 1
            state.chatResponseState = .success("")
            // Latest AI message's follow-ups become the suggestions.
            for entry in state.messages.reversed() {
                if case .aiResponse(let ai) = entry {
                    state.suggestedQuestions = ai.followUpQuestions
                    break
                }
            }
        case .error(let error):
            let message = error.message ?? env.labels.label("chat_history_failed", fallback: "We couldn't load this conversation.")
            state.errorMessage = message
            state.chatResponseState = .error(message: message, code: error.code, isNetworkError: error.isNetworkError)
            lastRequest = { [weak self] in
                await self?.loadChatHistory(conversationId: conversationId, page: page)
            }
        }
    }

    /// Maps thread-history items to chat messages
    /// (message_type_id: 1=query_text, 2=query_audio, 3=response_text,
    /// 7=follow_up_questions, 11=input_image).
    static func mapHistory(_ items: [ConversationChatHistoryMessageItem], page: Int = 1) -> [ChatMessage] {
        var result: [ChatMessage] = []
        for (index, item) in items.enumerated() {
            // A query and its response SHARE one `message_id` (verified live 2026-09-01: a single
            // turn returns type 1, 3 and 7 all carrying the same id). Using it directly as the
            // SwiftUI list identity collides two rows — app parity (fc-compose
            // ChatViewModel.kt:1027) keys on message_id + message_type_id + index. `messageId`
            // below keeps the raw API id for TTS/follow-ups.
            let rawId = item.messageId?.stringValue ?? UUID().uuidString
            let typeTag = item.messageTypeId.map(String.init) ?? "x"
            let idBase = "\(rawId)_\(typeTag)_\(page)_\(index)"
            switch item.typeId {
            case .queryText:
                result.append(.user(ChatMessage.UserMessage(
                    text: item.queryText ?? "",
                    id: idBase
                )))
            case .queryAudio:
                result.append(.user(ChatMessage.UserMessage(
                    text: item.heardQueryText ?? item.queryText ?? "",
                    audioURL: item.queryMediaFileUrl.flatMap(URL.init(string:)),
                    id: idBase
                )))
            case .inputImage:
                result.append(.user(ChatMessage.UserMessage(
                    text: item.queryText ?? "",
                    imageURL: item.queryMediaFileUrl.flatMap(URL.init(string:)),
                    userBubbleImageWideBanner: true,
                    id: idBase
                )))
            case .responseText:
                result.append(.aiResponse(ChatMessage.AiResponse(
                    text: item.responseText ?? "",
                    id: idBase,
                    messageId: item.messageId?.stringValue
                )))
            case .followUpQuestions:
                // Attach to the previous AI message.
                if case .aiResponse(var ai)? = result.last {
                    ai.followUpQuestions = item.questions
                    result[result.count - 1] = .aiResponse(ai)
                }
            case nil:
                continue
            }
        }
        return result
    }

    // MARK: - TTS (#31)

    private func synthesiseAudio() async {
        guard state.isTtsEnabled, !state.isLoadingSynthesiseAudio else { return }
        // Find the latest AI message with a server id.
        var target: ChatMessage.AiResponse?
        for entry in state.messages.reversed() {
            if case .aiResponse(let ai) = entry, ai.messageId != nil {
                target = ai
                break
            }
        }
        guard let target, let messageId = target.messageId, let userId = env.session.userId else { return }
        state.isLoadingSynthesiseAudio = true
        defer { state.isLoadingSynthesiseAudio = false }
        let result = await env.api.synthesiseAudio(SynthesiseAudioRequest(messageId: messageId, text: target.text, userId: userId))
        if case .success(let response) = result, let audio = response.audio, !audio.isEmpty {
            state.audioPlaybackUrl = audio
        } else {
            state.errorMessage = env.labels.label("tts_failed", fallback: "Audio is not available right now.")
        }
    }
}
