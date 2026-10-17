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

/// Why a capability prompt (GPS_PROMPT / UPLOAD_PHOTO) ended without its capability.
public enum CapabilityDecline: Sendable, Equatable {
    /// Location permission denied, the flow cancelled, or the fix failed.
    case location
    /// Camera permission denied on an UPLOAD_PHOTO "take photo" chip.
    case photoPermissionDenied
    /// The camera / gallery closed without a photo.
    case photoNotShared
}

/// The wire + analytics fields of one ``CapabilityDecline`` (pure, for tests).
struct CapabilityDeclineSend: Equatable {
    let query: String
    let locationDeclined: Bool
    let photoDeclined: Bool
    let chipType: String

    init(_ decline: CapabilityDecline, labels: LabelManager) {
        switch decline {
        case .location:
            query = labels.label(AgenticLabels.locationPermissionDeclined, fallback: AgenticLabels.locationPermissionDeclinedFallback)
            locationDeclined = true
            photoDeclined = false
            chipType = AlignmentKind.gpsPrompt.analyticsType
        case .photoPermissionDenied:
            query = labels.label(FCLabels.photoPermissionDeclined, fallback: "I don't want to share a photo right now")
            locationDeclined = false
            photoDeclined = true
            chipType = AlignmentKind.uploadPhoto.analyticsType
        case .photoNotShared:
            query = labels.label(FCLabels.photoNotShared, fallback: "I don't have a photo to share right now")
            locationDeclined = false
            photoDeclined = true
            chipType = AlignmentKind.uploadPhoto.analyticsType
        }
    }
}

/// What one alignment-chip tap sends — the arguments the app's `onAlignmentChipClick`
/// (`ui/chat/ChatScreen.kt:1639-1663`) passes to `SendAlignmentChip`:
/// - `query`: the chip LABEL (gender-select: its VALUE, which the backend expects raw);
/// - `selectionValue`: the chip VALUE (label when blank) — marks the picked chip, never sent;
/// - `displayLabel`: the bubble override, non-nil only when it differs from `query`
///   (gender-select shows the label while the value is sent).
/// Nil when the chip carries neither a label nor a value.
struct AlignmentChipSend: Equatable {
    let query: String
    let selectionValue: String
    let displayLabel: String?

    init?(chip: AlignmentChip, kind: AlignmentKind?) {
        let label = chip.label.flatMap { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : $0 }
        let value = chip.value.flatMap { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : $0 }
        let query = chip.submittedQuery(for: kind)
        guard !query.isEmpty else { return nil }
        self.query = query
        self.selectionValue = value ?? label ?? query
        if kind == .genderSelect, let label, label != query {
            self.displayLabel = label
        } else {
            self.displayLabel = nil
        }
    }
}

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

/// Clean-up for a SETTLED agentic answer (terminal `metadata.response` or `done.answer`).
///
/// The stage backend (mobile-app-stage, 2026-10-06) was observed leaking the control block into
/// `metadata.response`: a weather answer ended with a literal ```` ```followups [...] ``` ```` that
/// the renderer printed as raw text (Android v2 fix: `sanitizeAgenticFinalText`). Strips that block
/// (closed, or unclosed at the end) and complete `<<...>>` markers; unlike
/// `sanitizeAgenticStreamText` it does not cut at a lone `<<`. A pure trim on a clean answer.
func sanitizeAgenticFinalText(_ raw: String) -> String {
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
    /// A voice clip is being transcribed (#16): the bubble reads "One second..." and the thinking
    /// spinner is hidden (ChatThreadContent.kt:615-633 `isTranscribing`).
    public var isTranscribing: Bool = false
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
    private var cancellables = Set<AnyCancellable>()

    public init(env: FarmerChat = .shared) {
        self.env = env
        state.isTtsEnabled = true
        // docs/02 Step 3: the conversation belonged to the replaced guest; the next send uses the
        // one Home creates for the new guest (NEW_CONVERSATION_ID) or creates one.
        env.session.guestReplaced
            .receive(on: DispatchQueue.main)
            .sink { [weak self] in
                Task { @MainActor [weak self] in self?.conversationId = nil }
            }
            .store(in: &cancellables)
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
                // App rule (ChatViewModel.kt:952-963): #30 only for a tapped suggested follow-up, and
                // it carries that follow-up's server id, never the question text. A typed question
                // (followUpQuestionId == nil) sends nothing.
                if followUpQuestionId != nil, let id = self.serverFollowUpId(for: question, passed: followUpQuestionId) {
                    _ = await self.env.api.followUpQuestionClick(FollowUpClickRequest(followUpQuestion: id))
                    self.env.analytics.track(AnalyticsEvents.followUpQuestionClicked, props: ["question": question])
                }
                await self.sendQuestion(
                    question,
                    transcriptionId: transcriptionId,
                    audioURL: audioURL,
                    triggeredInputType: Self.followUpTriggeredInputType(
                        followUpQuestionId: followUpQuestionId,
                        audioURL: audioURL
                    ),
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
            notifyMessageSent(question)
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
            // File read + base64 off the main actor; the result is handled back on it.
            let base64 = await Task.detached(priority: .userInitiated) {
                try? Data(contentsOf: audioURL).base64EncodedString()
            }.value
            guard let base64 else {
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
        notifyMessageSent(question)
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
        // App: typed / voice sends carry `manualSendChipContext()` (ChatScreen.kt:1780-1791);
        // suggestion chips, cards, weather and SSFR sends carry no chip context.
        let chip = ["text", "voice"].contains(triggeredInputType)
            ? ChipAnalytics.manualSend(messages: state.messages) : .none
        env.analytics.track(AnalyticsEvents.sendQueryInitiated, props: chip.merged(into: [
            "input_type": triggeredInputType,
            "screen": originScreen
        ], triggeredInputType: triggeredInputType))
        notifyMessageSent(question)
        await sendQuestionInternal(
            question,
            transcriptionId: transcriptionId,
            audioURL: audioURL,
            triggeredInputType: triggeredInputType,
            weatherCtaTriggered: weatherCtaTriggered,
            ssfrCrop: ssfrCrop,
            statementId: nil,
            replaceExistingUserBubble: false,
            chip: chip
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
        isRetry: Bool = false,
        bubbleText: String? = nil,
        parentMessageId: String? = nil,
        locationDeclined: Bool = false,
        photoDeclined: Bool = false,
        chip: ChipAnalytics = .none
    ) async {
        guard !state.isLoading else { return }
        state.errorMessage = nil
        state.suggestedQuestions = nil
        state.clarificationRequired = false
        state.isLoading = true
        state.chatResponseState = .loading

        let userMessageId = UUID().uuidString
        if !replaceExistingUserBubble || state.messages.isEmpty {
            state.messages.append(.user(ChatMessage.UserMessage(text: bubbleText ?? question, audioURL: audioURL, id: userMessageId)))
        }
        let placeholderId = UUID().uuidString
        state.messages.append(.loadingPlaceholder(id: placeholderId))

        defer { state.isLoading = false }

        guard let convId = await ensureConversationId() else {
            failCurrent(
                placeholderId: placeholderId,
                userMessageId: userMessageId,
                message: env.labels.label(FCLabels.somethingWentWrongPleaseTryAgain, fallback: "Something went wrong. Please try again."),
                retry: { [weak self] in
                    await self?.sendQuestionInternal(
                        question, transcriptionId: transcriptionId, audioURL: audioURL,
                        triggeredInputType: triggeredInputType, weatherCtaTriggered: weatherCtaTriggered,
                        ssfrCrop: ssfrCrop, statementId: statementId,
                        replaceExistingUserBubble: true, isRetry: true,
                        bubbleText: bubbleText, parentMessageId: parentMessageId,
                        locationDeclined: locationDeclined, photoDeclined: photoDeclined,
                        chip: chip
                    )
                }
            )
            return
        }

        let request = Self.makeTextPromptRequest(
            query: question,
            conversationId: convId,
            statementId: statementId,
            weatherCtaTriggered: weatherCtaTriggered,
            triggeredInputType: triggeredInputType,
            ssfrCrop: ssfrCrop,
            transcriptionId: transcriptionId,
            retry: isRetry,
            // Per-LANGUAGE flag persisted on language selection (app ChatViewModel); default true.
            streamingRequired: env.prefs.bool(.streamingRequired, default: true),
            parentMessageId: parentMessageId,
            locationDeclined: locationDeclined,
            photoDeclined: photoDeclined
        )
        // debugLogging only. Routing fields, never the query text or tokens.
        NetworkLog.note("text-prompt request triggered_input_type=\(triggeredInputType) parent_message_id=\(parentMessageId ?? "nil") location_declined=\(request.locationDeclined.map(String.init) ?? "nil") photo_declined=\(request.photoDeclined.map(String.init) ?? "nil")")
        // App parity: Send_Query fires on the RESPONSE (ChatViewModel.kt:1706-1722, 2027-2045,
        // failures :1852/:1908/:2153), carrying Valid_Query, the intent fields and — when the
        // response presents chips — `agentic_chip_status = available`. Armed here, fired by
        // `firePendingSendQuery`.
        pendingSendQuery = PendingSendQuery(
            base: ["input_type": triggeredInputType, "conversation_id": convId],
            chip: chip,
            triggeredInputType: triggeredInputType
        )
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
                        replaceExistingUserBubble: true, isRetry: true,
                        bubbleText: bubbleText, parentMessageId: parentMessageId,
                        locationDeclined: locationDeclined, photoDeclined: photoDeclined,
                        chip: chip
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
                        replaceExistingUserBubble: true, isRetry: true,
                        bubbleText: bubbleText, parentMessageId: parentMessageId,
                        locationDeclined: locationDeclined, photoDeclined: photoDeclined,
                        chip: chip
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
                        replaceExistingUserBubble: true, isRetry: true,
                        bubbleText: bubbleText, parentMessageId: parentMessageId,
                        locationDeclined: locationDeclined, photoDeclined: photoDeclined,
                        chip: chip
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
        if isAgentic { text = sanitizeAgenticFinalText(text) }
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

        firePendingSendQuery(
            valid: true,
            response: response,
            shownChipType: (response.alignments?.chips ?? []).isEmpty ? nil : alignmentKind?.analyticsType
        )
        if let alignmentKind, let chips = response.alignments?.chips {
            // debugLogging only: the routing fields of a surface's chips (no user text).
            NetworkLog.note("alignment \(alignmentKind.analyticsType) chips=" + chips.map {
                "[value=\($0.value ?? "nil") action=\($0.action ?? "nil")]"
            }.joined(separator: " "))
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
        notifyAnswerReceived(response.messageId?.stringValue)
        if response.hideTtsSpeaker == true { state.isTtsEnabled = false }
        // Real follow-ups always come from endpoint #29.
        if Self.fetchesFollowUps(alignmentKind: alignmentKind, hideFollowUpQuestion: response.hideFollowUpQuestion),
           let messageId = response.messageId?.stringValue, !messageId.isEmpty {
            // App parity (`applyFollowUpQuestionsFromApi` launches; finalize sets isLoading=false
            // first): #29 runs AFTER the answer settles, never inside the loading window. Awaiting
            // it here held `isLoading` true for the whole #29 round trip — tips stayed over the
            // finished answer, the composer stayed hidden and the thread's pin anchor flipped.
            Task { await self.fetchFollowUps(messageId: messageId, aiMessageLocalId: aiId) }
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
            let doneAnswer = sanitizeAgenticFinalText(pendingDone?.answer ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if let done = pendingDone, !doneAnswer.isEmpty || !fallbackText.isEmpty {
                // A `done` means the model actually finished → a complete answer, not an
                // interruption, even if the transport dropped right after.
                finalizeAgenticAnswer(
                    text: doneAnswer.isEmpty ? fallbackText : doneAnswer,
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
        firePendingSendQuery(valid: true)
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
        // A streamed answer that ended without `metadata` has no server id.
        notifyAnswerReceived(nil)
    }

    /// Settles a stream that ended early; `text` may hold a preserved partial answer.
    private func interruptAgentic(
        streamId: String,
        text: String,
        kind: StreamErrorKind,
        retry: @escaping @MainActor () async -> Void
    ) {
        firePendingSendQuery(valid: !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
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
        firePendingSendQuery(valid: false)
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
    /// Sends `triggered_input_type = align_chip_sel` and the surface's SERVER `message_id` as
    /// `parent_message_id` (app `ChatViewModel.kt:1069-1118`). One delta remains: **no
    /// `agentic_chip_*` analytics properties** — the iOS analytics props are a flat dictionary
    /// with no chip type/value/label/status fields, so this reports as an ordinary text query.
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
        // App ChatViewModel.kt:1090-1110: a successful share is reported as a chip pick.
        let chip = ChipAnalytics.selected(
            type: AlignmentKind.gpsPrompt.analyticsType,
            value: AlignmentChip.valueShareLocation,
            label: env.labels.label(FCLabels.shareLocation, fallback: "Share my location")
        )
        env.analytics.track(AnalyticsEvents.sendQueryInitiated, props: chip.merged(into: [
            "input_type": FCAlignChipSelInputType,
            "screen": ScreenNames.chat
        ], triggeredInputType: FCAlignChipSelInputType))
        notifyMessageSent(query)
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
                replaceExistingUserBubble: true,
                parentMessageId: source.messageId,
                chip: chip
            )
        }
    }

    // MARK: - Alignment chip send (2.0.0, app `sendAlignmentChip`)

    /// The farmer tapped a non-capability alignment chip. Convenience over
    /// ``sendAlignmentChip(sourceMessageId:query:selectionValue:displayLabel:locationDeclined:photoDeclined:)``
    /// that derives what the app's `onAlignmentChipClick` passes (see ``AlignmentChipSend``).
    ///
    /// - Parameter sourceMessageId: the raw ``ChatMessage/AiResponse/id`` of the surface that
    ///   offered the chip (NOT the prefixed ``ChatMessage/id``).
    public func sendAlignmentChip(_ chip: AlignmentChip, kind: AlignmentKind?, sourceMessageId: String) {
        guard let send = AlignmentChipSend(chip: chip, kind: kind) else { return }
        sendAlignmentChip(
            sourceMessageId: sourceMessageId,
            query: send.query,
            selectionValue: send.selectionValue,
            displayLabel: send.displayLabel,
            chipType: kind?.analyticsType,
            chipValue: chip.value,
            chipLabel: chip.label
        )
    }

    /// 1:1 port of the app's `sendAlignmentChip` (fc-compose-agentic `ui/chat/ChatViewModel.kt:1015-1053`):
    ///  1. `parent_message_id` = the SOURCE surface's SERVER `message_id` (looked up by its local id);
    ///  2. appends `selectionValue` to that surface's ``ChatMessage/AiResponse/alignmentSelectedValues``
    ///     so the tapped chip highlights and locks;
    ///  3. echoes a user bubble with `displayLabel ?? query`;
    ///  4. sends `query` with `triggered_input_type = "align_chip_sel"`, plus `location_declined` /
    ///     `photo_declined` when the chip was a capability decline. No #30 (that is for #29
    ///     suggestions only).
    public func sendAlignmentChip(
        sourceMessageId: String,
        query: String,
        selectionValue: String,
        displayLabel: String? = nil,
        locationDeclined: Bool = false,
        photoDeclined: Bool = false,
        chipType: String? = nil,
        chipValue: String? = nil,
        chipLabel: String? = nil
    ) {
        guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        // Checked BEFORE any mutation (app: `if (_state.value.isLoading) return`).
        guard !state.isLoading else { return }
        var parentMessageId: String?
        var sourceKind: AlignmentKind?
        if let index = state.messages.firstIndex(where: { entry in
            if case .aiResponse(let ai) = entry { return ai.id == sourceMessageId }
            return false
        }), case .aiResponse(var source) = state.messages[index] {
            parentMessageId = source.messageId
            sourceKind = source.alignmentKind
            if !source.alignmentSelectedValues.contains(selectionValue) {
                source.alignmentSelectedValues.append(selectionValue)
                state.messages[index] = .aiResponse(source)
            }
        }
        state.suggestedQuestions = nil
        // App `SendAlignmentChip` analytics (ChatScreen.kt:1639-1663 → ChatViewModel.kt:1105):
        // `selected`, the surface's wire type (falls back to the source surface's kind), the chip
        // value and label; `click_type = align_chip_sel`.
        let chip = ChipAnalytics.selected(
            type: chipType ?? sourceKind?.analyticsType,
            value: chipValue ?? selectionValue,
            label: chipLabel ?? displayLabel ?? query
        )
        env.analytics.track(AnalyticsEvents.sendQueryInitiated, props: chip.merged(into: [
            "input_type": FCAlignChipSelInputType,
            "screen": ScreenNames.chat
        ], triggeredInputType: FCAlignChipSelInputType))
        notifyMessageSent(query)
        Task {
            await self.sendQuestionInternal(
                query,
                transcriptionId: nil,
                audioURL: nil,
                triggeredInputType: FCAlignChipSelInputType,
                weatherCtaTriggered: false,
                ssfrCrop: nil,
                statementId: nil,
                replaceExistingUserBubble: false,
                bubbleText: displayLabel,
                parentMessageId: parentMessageId,
                locationDeclined: locationDeclined,
                photoDeclined: photoDeclined,
                chip: chip
            )
        }
    }

    // MARK: - Send_Query (fired on the response, as the app does)

    struct PendingSendQuery {
        var base: [String: String]
        var chip: ChipAnalytics
        var triggeredInputType: String
    }

    /// The Send_Query armed by the in-flight send; fired once by its outcome.
    private var pendingSendQuery: PendingSendQuery?

    private func firePendingSendQuery(valid: Bool, response: TextPromptResponse? = nil, shownChipType: String? = nil) {
        guard let pending = pendingSendQuery else { return }
        pendingSendQuery = nil
        env.analytics.track(AnalyticsEvents.sendQuery, props: Self.sendQueryProps(
            pending, valid: valid, intent: response?.intentClassificationOutput, shownChipType: shownChipType
        ))
    }

    /// The Send_Query payload: the send's base keys, the chip keys (upgraded to `available` when
    /// the response presents chips and the send was not itself a chip reaction —
    /// `withResponseChipStatus`, ChatViewModel.kt:169-176), `click_type`, `Valid_Query` and the
    /// intent fields (`SendQueryAnalytics.kt:152-160`).
    nonisolated static func sendQueryProps(
        _ pending: PendingSendQuery,
        valid: Bool,
        intent: IntentClassificationOutput?,
        shownChipType: String?
    ) -> [String: String] {
        var chip = pending.chip
        if let shownChipType, chip.status == ChipAnalytics.statusNone {
            chip.status = ChipAnalytics.statusAvailable
            chip.shownType = shownChipType
        }
        var props = chip.merged(into: pending.base, triggeredInputType: pending.triggeredInputType)
        props["Valid_Query"] = valid ? "true" : "false"
        props["asset_type"] = intent?.assetType ?? ""
        props["asset_name"] = intent?.assetName ?? ""
        props["concern"] = intent?.concern ?? ""
        props["stage"] = intent?.stage ?? ""
        props["intent"] = intent?.intent ?? ""
        props["clarification_needed_asset"] = intent?.clarificationNeeded?.asset == true ? "true" : "false"
        props["clarification_needed_concern"] = intent?.clarificationNeeded?.concern == true ? "true" : "false"
        return props
    }

    /// The photo an UPLOAD_PHOTO "take photo" / "choose from gallery" chip produced. Sent like any
    /// photo (`SendQuestionWithImage`), but its analytics are a chip pick, as the app's
    /// `sendAlignmentPhotoDirect` stamps them (ChatScreen.kt:425-460).
    public func sendAlignmentPhoto(chip: AlignmentChip, imageData: Data, imageURL: URL?) {
        let analytics = ChipAnalytics.selected(
            type: AlignmentKind.uploadPhoto.analyticsType, value: chip.value, label: chip.label
        )
        Task { await self.sendImageQuestion(question: "", imageData: imageData, imageURL: imageURL, chipOverride: analytics) }
    }

    // MARK: - Capability declines (2.0.0)

    /// The farmer did not complete a capability prompt. Port of the app's two decline sends:
    /// GPS (ChatScreen.kt:377-380) and UPLOAD_PHOTO (`sendAlignmentPhotoDeclineQuery`,
    /// ChatScreen.kt:469-485 — permission denied :665-672, nothing picked/taken :524-531, :576-583).
    /// Each is an alignment-chip send of the label text, flagged `location_declined` /
    /// `photo_declined`, with `parent_message_id` = the surface's server id.
    ///
    /// - Parameter sourceMessageId: the raw ``ChatMessage/AiResponse/id`` of the surface.
    public func sendCapabilityDecline(_ decline: CapabilityDecline, sourceMessageId: String) {
        let send = CapabilityDeclineSend(decline, labels: env.labels)
        sendAlignmentChip(
            sourceMessageId: sourceMessageId,
            query: send.query,
            selectionValue: send.query,
            locationDeclined: send.locationDeclined,
            photoDeclined: send.photoDeclined,
            chipType: send.chipType,
            chipValue: AlignmentChip.valueNotNow,
            chipLabel: send.query
        )
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

    /// App `queryForApi` (ChatViewModel.kt:1854): the typed caption, else the default prompt.
    nonisolated static func imageQueryForApi(_ question: String, defaultQuery: String) -> String {
        let trimmed = question.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? defaultQuery : question
    }

    /// The #27 / #27a body, exactly as the app's `fetchTextPromptResponse` builds it
    /// (ChatViewModel.kt:1403-1420): `message_id` "", `use_entity_extraction` true, and the three
    /// alignment fields only when set — `parent_message_id` on an `align_chip_sel` send,
    /// `location_declined` / `photo_declined` only as `true` (else omitted). `image` +
    /// `image_name` carry a photo on the agentic path (ChatViewModel.kt:1866-1880).
    nonisolated static func makeTextPromptRequest(
        query: String,
        conversationId: String,
        statementId: FlexibleID? = nil,
        weatherCtaTriggered: Bool = false,
        triggeredInputType: String,
        ssfrCrop: String? = nil,
        transcriptionId: String? = nil,
        retry: Bool = false,
        streamingRequired: Bool,
        parentMessageId: String? = nil,
        locationDeclined: Bool = false,
        photoDeclined: Bool = false,
        image: String? = nil,
        imageName: String? = nil
    ) -> TextPromptRequest {
        var request = TextPromptRequest(
            query: query,
            conversationId: conversationId,
            // App parity: message_id is sent empty (""); the response id is authoritative.
            messageId: "",
            statementId: statementId,
            weatherCtaTriggered: weatherCtaTriggered,
            triggeredInputType: triggeredInputType,
            ssfrCrop: ssfrCrop,
            transcriptionId: transcriptionId,
            retry: retry,
            streamingRequired: streamingRequired
        )
        request.parentMessageId = parentMessageId
        request.locationDeclined = locationDeclined ? true : nil
        request.photoDeclined = photoDeclined ? true : nil
        request.image = image
        request.imageName = imageName
        return request
    }

    /// Whether an answer fetches #29 follow-ups. App `handleTextPromptResult`
    /// (ChatViewModel.kt:2020-2025): only an EXCLUSIVE alignment surface (clarify / confirm /
    /// escalate / gps-prompt / upload-photo) owns the chip area and skips #29; a normal answer and
    /// an ADDITIVE surface (gender-select / commodity-confirm) still fetch. `hide_follow_up_question`
    /// suppresses it too.
    nonisolated static func fetchesFollowUps(alignmentKind: AlignmentKind?, hideFollowUpQuestion: Bool?) -> Bool {
        guard hideFollowUpQuestion != true else { return false }
        guard let alignmentKind else { return true }
        return alignmentKind.isAdditive
    }

    /// `triggered_input_type` of a ``ChatAction/sendFollowUpQuestion(question:followUpQuestionId:transcriptionId:audioURL:)``
    /// — app `sendFollowUpQuestion` (ChatViewModel.kt:992-996): `voice` for a dictated question,
    /// `follow_up` for a suggestion-chip tap (`handleFollowUp`, ChatScreen.kt:960-971, sets
    /// `isFollowupPrompt = true`), and `text` for a question typed into the composer
    /// (ChatScreen.kt:1775-1811, `isFollowupPrompt = false`). The flavours pass a non-nil
    /// `followUpQuestionId` exactly for chip taps (history chips included).
    nonisolated static func followUpTriggeredInputType(followUpQuestionId: String?, audioURL: URL?) -> String {
        if audioURL != nil { return "voice" }
        return followUpQuestionId != nil ? "follow_up" : "text"
    }

    // MARK: - Follow-ups (#29)
    /// The server `follow_up_question_id` of a tapped suggestion. Callers pass either the id or (UI
    /// chips that only know the text) the question itself, so resolve the text to its id.
    func serverFollowUpId(for question: String, passed: String?) -> String? {
        if let passed, passed != question, !passed.isEmpty { return passed }
        guard let index = state.suggestedQuestions?.firstIndex(of: question),
              let ids = state.suggestedQuestionIds, index < ids.count, !ids[index].isEmpty else { return nil }
        return ids[index]
    }


    /// True when `aiId` is still the thread's FINAL row — the only time #29's suggestions may be
    /// applied. Structural, not `isLoading`: on the agentic path `isLoading` stays true until the
    /// stream reaches EOF, which can be after #29 returns; a newer send always appends its
    /// question + placeholder after the answer, so "is it still last" is the staleness test.
    nonisolated static func isLatestSettledAnswer(_ aiId: String, in state: ChatState) -> Bool {
        if case .aiResponse(let ai)? = state.messages.last { return ai.id == aiId }
        return false
    }

    private func fetchFollowUps(messageId: String, aiMessageLocalId: String) async {
        let result = await env.api.followUpQuestions(messageId: messageId)
        guard case .success(let response) = result else { return }
        // Server order, with the server's ids: #30 must report the tapped follow_up_question_id.
        let options = (response.questions ?? [])
            .filter { !($0.question ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .sorted { ($0.sequence ?? Int.max) < ($1.sequence ?? Int.max) }
        let questions = options.compactMap(\.question)
        NetworkLog.note("follow_up_questions decoded \(questions.count) question(s), clarification_required=\(response.clarificationRequired ?? false)")
        // A newer question was sent while #29 was in flight: these follow-ups belong to an answer
        // that is no longer the latest, so they must not replace the thread's suggestions.
        guard Self.isLatestSettledAnswer(aiMessageLocalId, in: state) else { return }
        state.suggestedQuestions = questions.isEmpty ? nil : questions
        state.suggestedQuestionIds = questions.isEmpty ? nil : options.map { $0.followUpQuestionId?.stringValue ?? "" }
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
        // App `sendFollowUpVoiceQuestion` (ChatViewModel.kt:508-530): the voice bubble reads
        // "One second..." while the clip is transcribed, and the thinking spinner stays hidden
        // until the transcription is accepted (ChatThreadContent.kt:615-633 `isTranscribing`).
        state.messages.append(.user(ChatMessage.UserMessage(
            text: env.labels.label(FCLabels.oneSecondPlease, fallback: "One second..."),
            audioURL: audioURL,
            id: userMessageId
        )))
        let placeholderId = UUID().uuidString
        state.messages.append(.loadingPlaceholder(id: placeholderId))
        state.isTranscribing = true
        defer { state.isTranscribing = false }

        guard let convId = await ensureConversationId() else {
            state.isLoading = false
            failCurrent(
                placeholderId: placeholderId,
                userMessageId: userMessageId,
                message: env.labels.label(FCLabels.somethingWentWrongPleaseTryAgain, fallback: "Something went wrong. Please try again."),
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
            state.isTranscribing = false
            notifyMessageSent(text)
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
        case .success(let response):
            env.analytics.track(AnalyticsEvents.transcriptionFailed, props: ["reason": "low_confidence"])
            // ChatViewModel.kt:598-617: a rejected transcription shows what was heard in the
            // (failed) voice bubble, and that text is the error too.
            let heard = Self.voiceFailureText(heard: response.heardInputQuery ?? "", accepted: false, labels: env.labels)
            setUserText(heard, id: userMessageId)
            failCurrent(
                placeholderId: placeholderId,
                userMessageId: userMessageId,
                message: heard,
                retry: { [weak self] in await self?.sendVoiceQuestion(audioURL: audioURL, base64Audio: base64Audio) }
            )
        case .error(let error):
            env.analytics.track(AnalyticsEvents.transcriptionFailed, props: ["reason": error.message ?? "network"])
            // ChatViewModel.kt:620-636: "Something went wrong" in the failed voice bubble.
            let text = Self.voiceFailureText(heard: nil, accepted: false, labels: env.labels)
            setUserText(text, id: userMessageId)
            failCurrent(
                placeholderId: placeholderId,
                userMessageId: userMessageId,
                message: text,
                retry: { [weak self] in await self?.sendVoiceQuestion(audioURL: audioURL, base64Audio: base64Audio) }
            )
        }
    }

    private func setUserText(_ text: String, id: String) {
        state.messages = state.messages.map { entry in
            if case .user(var user) = entry, user.id == id {
                user.text = text
                return .user(user)
            }
            return entry
        }
    }

    /// The failed voice bubble's text: the heard text for a rejected transcription (app
    /// `heard_input_query.toString()`), else `something_went_wrong`.
    nonisolated static func voiceFailureText(heard: String?, accepted: Bool, labels: LabelManager) -> String {
        if let heard { return heard }
        return labels.label(FCLabels.somethingWentWrong, fallback: "Something went wrong")
    }

    // MARK: - Image question (#28)

    private func sendImageQuestion(question: String, imageData: Data, imageURL: URL?, chipOverride: ChipAnalytics? = nil) async {
        guard !state.isLoading else { return }
        // App: a composer photo carries `manualSendChipContext()` like a typed send
        // (ChatScreen.kt:1780); an UPLOAD_PHOTO chip's photo is reported as that chip's pick
        // (ChatScreen.kt:430-452 `isAlignmentChip = true`, type upload-photo, the chip's value/label).
        let chip = chipOverride ?? ChipAnalytics.manualSend(messages: state.messages)
        // App (Android ChatViewModel SendQuestionWithImage): Send_Query_Initiated fires for a photo
        // send too — the SDK tracked it for every send except this one.
        env.analytics.track(AnalyticsEvents.sendQueryInitiated, props: chip.merged(into: [
            // Same `input_type` the photo's Send_Query carries (PendingSendQuery below).
            "input_type": "camera",
            "screen": ScreenNames.chat
        ], triggeredInputType: "image"))
        // The caption as typed; "" for a photo sent without one.
        notifyMessageSent(question)
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
                message: env.labels.label(FCLabels.somethingWentWrongPleaseTryAgain, fallback: "Something went wrong. Please try again."),
                retry: { [weak self] in await self?.sendImageQuestion(question: question, imageData: imageData, imageURL: imageURL) }
            )
            return
        }

        pendingSendQuery = PendingSendQuery(
            base: ["input_type": "camera", "conversation_id": convId],
            chip: chip,
            triggeredInputType: "image"
        )
        // App `fetchPlantixResponse` (ChatViewModel.kt:1819-1895): the bubble shows only what the
        // farmer typed, but the API always gets a prompt — the typed text, else the
        // `what_is_wrong_with_my_crop` label — and the image is named `image_<uuid>.jpg`.
        let queryForApi = Self.imageQueryForApi(
            question,
            defaultQuery: env.labels.label(FCLabels.whatIsWrongWithMyCrop, fallback: "What is wrong with my crop?")
        )
        let imageName = "image_\(UUID().uuidString.lowercased()).jpg"
        // App `ImageUtils.addGpsToImageAndConvertToBase64` (ImageUtils.kt:170-245): the photo's
        // own GPS, else the current location if permission is ALREADY granted (no prompt); fit
        // 1000×1000; JPEG 80; GPS written into the EXIF. A photo that cannot be decoded fails the
        // send ("Failed to process image", Valid_Query false) as in the app (ChatViewModel.kt:1840-1854).
        let deviceLocation = PhotoUploadEncoder.readGPS(from: imageData) == nil
            ? await PhotoUploadEncoder.currentLocationIfAuthorized()
            : nil
        guard let encoded = await Task.detached(priority: .userInitiated, operation: {
            PhotoUploadEncoder.encode(imageData, fallbackLocation: deviceLocation)
        }).value else {
            failCurrent(
                placeholderId: placeholderId,
                userMessageId: userMessageId,
                message: env.labels.label(FCLabels.failedToProcessImage, fallback: "Failed to process image"),
                retry: { [weak self] in await self?.sendImageQuestion(question: question, imageData: imageData, imageURL: imageURL) }
            )
            return
        }
        let base64 = encoded.base64
        NetworkLog.note("photo encoded \(encoded.pixelWidth)x\(encoded.pixelHeight) bytes=\(encoded.data.count) (source \(imageData.count)) gps=\(encoded.latitude != nil)")
        if env.config.enableAgenticChat {
            // Agentic chat on: the photo goes through the agentic text stream (#27a) with `image` +
            // `image_name` and `triggered_input_type = image` — NOT #28 — and the answer streams
            // like any text answer (ChatViewModel.kt:1862-1880).
            let request = Self.makeTextPromptRequest(
                query: queryForApi,
                conversationId: convId,
                triggeredInputType: "image",
                streamingRequired: env.prefs.bool(.streamingRequired, default: true),
                image: base64,
                imageName: imageName
            )
            NetworkLog.note("text-prompt request triggered_input_type=image image_name=\(imageName) image_base64_chars=\(base64.count) default_query=\(question.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)")
            await streamAgenticAnswer(
                request: request,
                placeholderId: placeholderId,
                retry: { [weak self] in await self?.sendImageQuestion(question: question, imageData: imageData, imageURL: imageURL) }
            )
            return
        }
        let request = PlantixRequest(
            conversationId: convId,
            image: base64,
            triggeredInputType: "image",
            query: queryForApi,
            // App parity: the location the image was stamped with, as STRINGs
            // (`imageResult.latitude?.toString()`, ChatViewModel.kt:1884-1885).
            latitude: encoded.latitude.map { String($0) },
            longitude: encoded.longitude.map { String($0) },
            imageName: imageName,
            retry: false
        )
        let result = await env.api.imageAnalysis(request)
        switch result {
        case .success(let response) where response.error != true && response.response != nil:
            firePendingSendQuery(valid: true) // ChatViewModel.kt:2125
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
            notifyAnswerReceived(response.messageId?.stringValue)
            if let messageId = response.messageId?.stringValue {
                // App parity (`applyFollowUpQuestionsFromApi` launches; finalize sets isLoading=false
            // first): #29 runs AFTER the answer settles, never inside the loading window. Awaiting
            // it here held `isLoading` true for the whole #29 round trip — tips stayed over the
            // finished answer, the composer stayed hidden and the thread's pin anchor flipped.
            Task { await self.fetchFollowUps(messageId: messageId, aiMessageLocalId: aiId) }
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
            // Latest AI message's follow-ups become the suggestions (app `fetchChatHistoryPage`,
            // ChatViewModel.kt:1210-1230). The app keeps only their TEXT for history — it never
            // sets `suggestedQuestionIds` there — so a history chip tap carries no id and fires no
            // #30, and is still sent as `follow_up`. Clear any ids so nothing stale resolves.
            for entry in state.messages.reversed() {
                if case .aiResponse(let ai) = entry {
                    state.suggestedQuestions = ai.followUpQuestions
                    state.suggestedQuestionIds = nil
                    if page == 1, ai.followUpQuestions != nil {
                        state.clarificationRequired = Self.lastResponseClarification(in: response.messages) ?? false
                    }
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

    /// `clarification_required` of the newest type-3 response on a page (app: `lastAiMessage
    /// ?.clarification_required`, read off the sorted page).
    nonisolated static func lastResponseClarification(in items: [ConversationChatHistoryMessageItem]) -> Bool? {
        sortedHistory(items).last { $0.typeId == .responseText }?.clarificationRequired
    }

    /// App parity (`ChatViewModel.kt:1255`): `data.sortedWith(compareBy(nullsLast(naturalOrder()))
    /// { it.message_input_time })`. DEMO returns a page's turns NEWEST first (verified 2026-10-16),
    /// so without this a reopened conversation read bottom-up. Stable, so the items of one turn
    /// (which share a timestamp) keep their 1 → 3 → 7 order; a missing time sorts last. The
    /// ISO-8601 strings compare correctly as text, exactly as Kotlin's natural String order does.
    nonisolated static func sortedHistory(_ items: [ConversationChatHistoryMessageItem]) -> [ConversationChatHistoryMessageItem] {
        items.enumerated().sorted { a, b in
            switch (a.element.messageInputTime, b.element.messageInputTime) {
            case let (x?, y?) where x != y: return x < y
            case (nil, _?): return false
            case (_?, nil): return true
            default: return a.offset < b.offset
            }
        }.map(\.element)
    }

    /// Maps thread-history items to chat messages
    /// (message_type_id: 1=query_text, 2=query_audio, 3=response_text,
    /// 7=follow_up_questions, 11=input_image).
    static func mapHistory(_ items: [ConversationChatHistoryMessageItem], page: Int = 1) -> [ChatMessage] {
        var result: [ChatMessage] = []
        for (index, item) in sortedHistory(items).enumerated() {
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
                    // App ChatViewModel.kt:1273: `query_text ?: heard_query_text ?: ""`.
                    text: item.queryText ?? item.heardQueryText ?? "",
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

    // MARK: - C4 semantic callbacks

    /// `onMessageSent(text)`: the farmer's question, at the moment the chat sends it (a photo
    /// without a caption reports ""). Not telemetry — fires whether or not analytics is enabled.
    private func notifyMessageSent(_ text: String) {
        env.config.onMessageSent?(text)
    }

    /// `onAnswerReceived(messageId)`: only once a real answer has landed (never for a failure),
    /// with its server `message_id` ("" when the reply carried none).
    private func notifyAnswerReceived(_ messageId: String?) {
        env.config.onAnswerReceived?(messageId ?? "")
    }

    // MARK: - TTS (#31)

    /// A #31 reply may still play only while its answer is the latest AI response and no new
    /// answer is loading. A slow reply that lands after the farmer moved on (a new question, a
    /// follow-up chip) would otherwise start the OLD answer's audio over the new turn — seen on
    /// DEMO in the 2026-10-17 scenario pass (Android SynthesisGuard.kt).
    nonisolated static func synthesisStillWanted(requestedMessageId: String, state: ChatState) -> Bool {
        if state.isLoading { return false }
        for entry in state.messages.reversed() {
            if case .aiResponse(let ai) = entry { return ai.messageId == requestedMessageId }
        }
        return false
    }

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
        guard Self.synthesisStillWanted(requestedMessageId: messageId, state: state) else {
            NetworkLog.note("synthesise_audio reply dropped: message \(messageId) is no longer the latest answer")
            return
        }
        if case .success(let response) = result, let audio = response.audio, !audio.isEmpty {
            state.audioPlaybackUrl = audio
        } else {
            state.errorMessage = env.labels.label("tts_failed", fallback: "Audio is not available right now.")
        }
    }
}
