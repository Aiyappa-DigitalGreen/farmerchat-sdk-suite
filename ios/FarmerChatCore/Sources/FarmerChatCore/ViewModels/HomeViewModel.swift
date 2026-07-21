import Foundation
import Combine

// MARK: - UDF Action (port of home/udf/HomeAction.kt)

public enum HomeAction: Sendable {
    case loadHome(userDeviceTime: String, userId: String?, skipLoadingCheck: Bool)
    case loadWeather(userId: String?, skipLoadingCheck: Bool)
    case fetchUserProfile(userId: String)
    case updateCultivatedCrops(userId: String, cropIds: [Int])
    case newConversation(userId: String, contentProviderId: Int?)
    case transcribeAudio(conversationId: String, base64Query: String, messageReferenceId: String, audioFormat: String, triggeredType: String)
    case markImageViewed(statementId: FlexibleID, userId: String)
    case fetchImageStatement(statementId: FlexibleID, triggeredInputType: String)
    case clearTranscriptionState
    case consumeResult
    case setLoadingState
}

// MARK: - UDF State (port of home/udf/HomeState.kt)

public struct HomeState: Sendable {
    public var homeFeedState: UiState<HomeUdfResponse> = .idle
    public var weatherState: UiState<WeatherResponse> = .idle
    public var cropUpdateState: UiState<CropResponse> = .idle
    public var newConversationState: UiState<NewConversationResponse> = .idle
    public var voiceTranscribeState: UiState<GetVoiceResponse> = .idle
    public var imageViewedState: UiState<ImageViewedResponse> = .idle
    public var imageStatementState: UiState<ImageStatementResponse> = .idle
    public var userProfileState: UiState<FarmerProfile> = .idle
    public var dismissedCardIds: Set<String> = []

    public init() {}

    /// Sections after dismissal filtering.
    public func visibleSections() -> [SectionDto] {
        guard case .success(let feed) = homeFeedState else { return [] }
        return (feed.sections ?? []).filter { !dismissedCardIds.contains($0.id) }
    }
}

// MARK: - ViewModel (port of HomeViewModel)

@MainActor
public final class HomeViewModel: ObservableObject {
    @Published public private(set) var state = HomeState()

    private let env: FarmerChat
    private var markedViewedIds = Set<String>()

    public init(env: FarmerChat = .shared) {
        self.env = env
    }

    public var conversationId: String? {
        env.prefs.string(.newConversationId)
    }

    public func onAction(_ action: HomeAction) {
        switch action {
        case .loadHome(let userDeviceTime, let userId, let skipLoadingCheck):
            Task { await loadHome(userDeviceTime: userDeviceTime, userId: userId, skipLoadingCheck: skipLoadingCheck) }
        case .loadWeather(let userId, let skipLoadingCheck):
            Task { await loadWeather(userId: userId, skipLoadingCheck: skipLoadingCheck) }
        case .fetchUserProfile(let userId):
            Task { await fetchUserProfile(userId: userId) }
        case .updateCultivatedCrops(let userId, let cropIds):
            Task { await updateCultivatedCrops(userId: userId, cropIds: cropIds) }
        case .newConversation(let userId, let contentProviderId):
            Task { await newConversation(userId: userId, contentProviderId: contentProviderId) }
        case .transcribeAudio(let conversationId, let base64Query, let messageReferenceId, let audioFormat, let triggeredType):
            Task {
                await transcribeAudio(
                    conversationId: conversationId,
                    base64Query: base64Query,
                    messageReferenceId: messageReferenceId,
                    audioFormat: audioFormat,
                    triggeredType: triggeredType
                )
            }
        case .markImageViewed(let statementId, let userId):
            Task { await markImageViewed(statementId: statementId, userId: userId) }
        case .fetchImageStatement(let statementId, let triggeredInputType):
            Task { await fetchImageStatement(statementId: statementId, triggeredInputType: triggeredInputType) }
        case .clearTranscriptionState:
            state.voiceTranscribeState = .idle
        case .consumeResult:
            state.cropUpdateState = .idle
            state.imageStatementState = .idle
        case .setLoadingState:
            state.homeFeedState = .loading
        }
    }

    // MARK: - Feed

    /// ISO-ish device time string the daily endpoint expects.
    public static func currentDeviceTime() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter.string(from: Date())
    }

    private func loadHome(userDeviceTime: String, userId: String?, skipLoadingCheck: Bool) async {
        if state.homeFeedState.isLoading && !skipLoadingCheck { return }
        state.homeFeedState = .loading
        let result = await env.api.dailyFeed(userDeviceTime: userDeviceTime, userId: userId)
        switch result {
        case .success(let feed):
            state.homeFeedState = .success(feed)
            saveFeedToCache(feed)
            env.analytics.track(AnalyticsEvents.dashboardViewed, props: [
                "sections": String(feed.sections?.count ?? 0)
            ])
            for section in feed.sections ?? [] {
                env.analytics.track(AnalyticsEvents.cardShown, props: [
                    "section_id": section.id,
                    "type": section.type ?? ""
                ])
            }
        case .error(let error):
            // Fall back to cached feed if available (CACHED_HOME_FEED_RESPONSE).
            if let cached = loadFeedFromCache() {
                state.homeFeedState = .success(cached)
            } else {
                state.homeFeedState = .error(
                    message: error.message ?? env.labels.label("home_feed_error", fallback: "We couldn't load today's advice."),
                    code: error.code,
                    isNetworkError: error.isNetworkError
                )
            }
        }
    }

    private func saveFeedToCache(_ feed: HomeUdfResponse) {
        if let data = try? JSONEncoder().encode(feed), let json = String(data: data, encoding: .utf8) {
            env.prefs.setString(json, .cachedHomeFeedResponse)
        }
    }

    private func loadFeedFromCache() -> HomeUdfResponse? {
        guard let json = env.prefs.string(.cachedHomeFeedResponse),
              let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(HomeUdfResponse.self, from: data)
    }

    // MARK: - Weather

    private func loadWeather(userId: String?, skipLoadingCheck: Bool) async {
        guard env.config.enableWeather else { return }
        if state.weatherState.isLoading && !skipLoadingCheck { return }
        state.weatherState = .loading
        let result = await env.api.weatherForecastLite(userId: userId)
        state.weatherState = UiState.from(result, fallbackMessage: env.labels.label("weather_error", fallback: "Weather unavailable"))
    }

    // MARK: - Profile

    private func fetchUserProfile(userId: String) async {
        state.userProfileState = .loading
        let result = await env.api.viewUserProfile(id: userId)
        if case .success(let profile) = result {
            if let name = profile.userProfile?.displayName {
                env.prefs.setString(name, .userName)
            }
        }
        state.userProfileState = UiState.from(result, fallbackMessage: env.labels.label("error_generic", fallback: "Something went wrong. Please try again."))
    }

    // MARK: - Crops (multi-select card)

    private func updateCultivatedCrops(userId: String, cropIds: [Int]) async {
        state.cropUpdateState = .loading
        let request = SetCultivatedCropsRequest(userId: userId, cropDetails: cropIds.map(CropDetailPayload.init(cropId:)))
        let result = await env.api.updateCropDetails(request)
        state.cropUpdateState = UiState.from(result, fallbackMessage: env.labels.label("error_generic", fallback: "Something went wrong. Please try again."))
        if case .success = result {
            env.prefs.setString(cropIds.map(String.init).joined(separator: ","), .cultivatedCrops)
        }
    }

    // MARK: - Conversation

    private func newConversation(userId: String, contentProviderId: Int?) async {
        state.newConversationState = .loading
        let result = await env.api.newConversation(NewConversationRequest(userId: userId, contentProviderId: contentProviderId))
        state.newConversationState = UiState.from(result, fallbackMessage: env.labels.label("error_generic", fallback: "Something went wrong. Please try again."))
        if case .success(let response) = result, let conversationId = response.conversationId?.stringValue {
            env.prefs.setString(conversationId, .newConversationId)
        }
    }

    // MARK: - Voice transcription (mic input on Home)

    private func transcribeAudio(
        conversationId: String,
        base64Query: String,
        messageReferenceId: String,
        audioFormat: String,
        triggeredType: String
    ) async {
        state.voiceTranscribeState = .loading
        let request = SetVoiceRequest(
            conversationId: conversationId,
            query: base64Query,
            messageReferenceId: messageReferenceId,
            inputAudioEncodingFormat: audioFormat,
            triggeredInputType: triggeredType
        )
        let result = await env.api.transcribeAudio(request)
        switch result {
        case .success(let response):
            env.analytics.track(
                response.isAcceptable ? AnalyticsEvents.transcriptionSuccess : AnalyticsEvents.transcriptionFailed,
                props: ["confidence": String(response.confidenceScore ?? 0)]
            )
            state.voiceTranscribeState = .success(response)
        case .error(let error):
            env.analytics.track(AnalyticsEvents.transcriptionFailed, props: ["reason": error.message ?? "network"])
            state.voiceTranscribeState = .error(
                message: error.message ?? env.labels.label("transcription_failed", fallback: "We couldn't hear that. Please try again."),
                code: error.code,
                isNetworkError: error.isNetworkError
            )
        }
    }

    // MARK: - Cards

    private func markImageViewed(statementId: FlexibleID, userId: String) async {
        let key = statementId.stringValue
        guard markedViewedIds.insert(key).inserted else { return }
        let result = await env.api.markImageViewed(ImageViewedRequest(statementId: statementId, userId: userId))
        state.imageViewedState = UiState.from(result, fallbackMessage: "")
        env.analytics.track(AnalyticsEvents.cardViewed, props: ["statement_id": key])
    }

    private func fetchImageStatement(statementId: FlexibleID, triggeredInputType: String) async {
        state.imageStatementState = .loading
        env.analytics.track(AnalyticsEvents.cardClicked, props: ["statement_id": statementId.stringValue])
        let result = await env.api.imageStatement(ImageStatementRequest(statementId: statementId, triggeredInputType: triggeredInputType))
        state.imageStatementState = UiState.from(result, fallbackMessage: env.labels.label("error_generic", fallback: "Something went wrong. Please try again."))
    }

    /// Local dismissal only (parity with app's `dismissCard(sectionId)`).
    public func dismissCard(sectionId: String) {
        state.dismissedCardIds.insert(sectionId)
        env.analytics.track(AnalyticsEvents.cardDismissed, props: ["section_id": sectionId])
    }
}
