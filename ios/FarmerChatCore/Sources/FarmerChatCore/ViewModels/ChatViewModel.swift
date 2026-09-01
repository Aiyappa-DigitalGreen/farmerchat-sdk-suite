import Foundation
import Combine

// MARK: - Message model (port of chat/udf ChatMessage)

public enum ChatMessage: Identifiable, Sendable, Equatable {
    case user(UserMessage)
    case aiResponse(AiResponse)
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

        public init(
            text: String,
            followUpQuestions: [String]? = nil,
            id: String = UUID().uuidString,
            isPreGenerated: Bool = false,
            messageId: String? = nil
        ) {
            self.text = text
            self.followUpQuestions = followUpQuestions
            self.id = id
            self.isPreGenerated = isPreGenerated
            self.messageId = messageId
        }
    }

    public var id: String {
        switch self {
        case .user(let message): return "user_\(message.id)"
        case .aiResponse(let message): return "ai_\(message.id)"
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

        let result = await env.api.getAnswerForTextQuery(request)
        switch result {
        case .success(let response) where response.error != true && (response.response ?? response.translatedResponse) != nil:
            let text = response.translatedResponse ?? response.response ?? ""
            state.messages.removeAll { $0.id == "loading_\(placeholderId)" }
            let aiId = UUID().uuidString
            state.messages.append(.aiResponse(ChatMessage.AiResponse(
                text: text,
                id: aiId,
                messageId: response.messageId?.stringValue
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
        case .success(let response):
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
