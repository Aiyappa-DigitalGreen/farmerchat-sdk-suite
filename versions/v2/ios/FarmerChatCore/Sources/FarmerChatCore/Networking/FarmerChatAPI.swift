import Foundation

/// Typed facade over all 34 main endpoints (doc 02) + Google geolocate.
/// Priorities: P1 = geolocate; P3 = AI runtime (text prompt, plantix,
/// follow-ups, synthesise, transcribe, chat/thread history); P2 = the rest.
public final class FarmerChatAPI: @unchecked Sendable {
    private let client: APIClient
    private let farmerChatApiKey: String?
    private let geoApiKey: String?
    private let session: URLSession
    /// #27a agentic streaming source (2.0.0). Constructed unconditionally — it is free; the
    /// `FarmerChatConfig.enableAgenticChat` flag decides whether the chat path uses it.
    private let agentic: AgenticChatDataSource

    init(client: APIClient, farmerChatApiKey: String?, geoApiKey: String?) {
        self.client = client
        self.farmerChatApiKey = farmerChatApiKey
        self.geoApiKey = geoApiKey
        self.session = URLSession(configuration: .default)
        self.agentic = AgenticChatDataSource(client: client)
    }

    // MARK: 1. Guest init

    public func initializeUser(_ body: InitializeGuestUserRequest) async -> ApiResult<InitializeGuestUserResponse> {
        await client.execute(Endpoint(
            method: .post,
            path: "api/user/initialize_user/",
            body: client.encodeBody(body, apiName: "initialize_user"),
            priority: .p2,
            apiKey: farmerChatApiKey,
            name: "initialize_user"
        ), as: InitializeGuestUserResponse.self)
    }

    // MARK: 2. Supported languages

    public func countryWiseSupportedLanguages(countryCode: String?, state: String?) async -> ApiResult<[SupportedLanguageGroup]> {
        // Android Retrofit parity: country_code and state are always sent
        // (empty when unknown), never omitted.
        let query: [URLQueryItem] = [
            URLQueryItem(name: "priority_view", value: "true"),
            URLQueryItem(name: "country_code", value: countryCode ?? ""),
            URLQueryItem(name: "state", value: state ?? "")
        ]
        return await client.execute(Endpoint(
            method: .get,
            path: "api/language/v2/country_wise_supported_languages/",
            query: query,
            name: "country_wise_supported_languages"
        ), as: [SupportedLanguageGroup].self)
    }

    // MARK: 3. Labels

    public func getLabels(languageId: Int) async -> ApiResult<[String: String]> {
        await client.execute(Endpoint(
            method: .get,
            path: "api/language/v2/get_labels/",
            query: [URLQueryItem(name: "language", value: String(languageId))],
            name: "get_labels"
        ), as: [String: String].self)
    }

    // MARK: 4. Legal links

    public func privacyPolicy() async -> ApiResult<PrivacyPolicyResponse> {
        await client.execute(Endpoint(
            method: .get,
            path: "api/user/privacy_policy/",
            name: "privacy_policy"
        ), as: PrivacyPolicyResponse.self)
    }

    // MARK: 5. Countries

    public func getAllCountries() async -> ApiResult<[CountryItem]> {
        await client.execute(Endpoint(
            method: .get,
            path: "api/geography/get_all_countries/",
            name: "get_all_countries"
        ), as: [CountryItem].self)
    }

    // MARK: 6. Set preferred language

    public func setPreferredLanguage(_ body: SetPreferredLanguageRequest) async -> ApiResult<SetPreferredLanguageResponse> {
        await client.execute(Endpoint(
            method: .post,
            path: "api/user/set_preferred_language/",
            body: client.encodeBody(body, apiName: "set_preferred_language"),
            name: "set_preferred_language"
        ), as: SetPreferredLanguageResponse.self)
    }

    // MARK: 7. Accept terms

    public func acceptTerms(_ body: AcceptPPandTCRequest) async -> ApiResult<AcceptPPandTCResponse> {
        await client.execute(Endpoint(
            method: .post,
            path: "api/user/accept_terms/",
            body: client.encodeBody(body, apiName: "accept_terms"),
            name: "accept_terms"
        ), as: AcceptPPandTCResponse.self)
    }

    // MARK: 8. Update profile / name

    public func updateUserProfile(_ body: UserNameRequest) async -> ApiResult<UserNameResponse> {
        await client.execute(Endpoint(
            method: .post,
            path: "api/user/update_user_profile/",
            body: client.encodeBody(body, apiName: "update_user_profile"),
            name: "update_user_profile"
        ), as: UserNameResponse.self)
    }

    // MARK: 9. View profile

    public func viewUserProfile(id: String) async -> ApiResult<FarmerProfile> {
        await client.execute(Endpoint(
            method: .get,
            path: "api/user/view_user_profile/",
            query: [URLQueryItem(name: "id", value: id)],
            name: "view_user_profile"
        ), as: FarmerProfile.self)
    }

    // MARK: 10. Build version

    public func updateBuildVersion(_ body: UpdateBuildVersionRequest) async -> ApiResult<UpdateBuildVersionResponse> {
        await client.execute(Endpoint(
            method: .patch,
            path: "api/user/v2/update_build_version/",
            body: client.encodeBody(body, apiName: "update_build_version"),
            name: "update_build_version"
        ), as: UpdateBuildVersionResponse.self)
    }

    // MARK: 11. Location

    public func updateUserLocation(_ body: UpdateLocationRequest) async -> ApiResult<GetLocationResponse> {
        await client.execute(Endpoint(
            method: .post,
            path: "api/user/update_user_location/",
            body: client.encodeBody(body, apiName: "update_user_location"),
            name: "update_user_location"
        ), as: GetLocationResponse.self)
    }

    // MARK: 12. Home feed

    public func dailyFeed(userDeviceTime: String, userId: String?) async -> ApiResult<HomeUdfResponse> {
        var query = [URLQueryItem(name: "user_device_time", value: userDeviceTime)]
        if let userId { query.append(URLQueryItem(name: "user_id", value: userId)) }
        return await client.execute(Endpoint(
            method: .get,
            path: "api/images/v2/daily/",
            query: query,
            name: "daily_feed"
        ), as: HomeUdfResponse.self)
    }

    // MARK: 13. Weather

    public func weatherForecastLite(userId: String?) async -> ApiResult<WeatherResponse> {
        await client.execute(Endpoint(
            method: .post,
            path: "api/weather/v2/weather_forecast_lite/",
            body: client.encodeBody(WeatherRequest(userId: userId), apiName: "weather_forecast_lite"),
            name: "weather_forecast_lite"
        ), as: WeatherResponse.self)
    }

    // MARK: 14. Crops

    public func updateCropDetails(_ body: SetCultivatedCropsRequest) async -> ApiResult<CropResponse> {
        await client.execute(Endpoint(
            method: .post,
            path: "api/user/update_crop_details/",
            body: client.encodeBody(body, apiName: "update_crop_details"),
            name: "update_crop_details"
        ), as: CropResponse.self)
    }

    // MARK: 15. New conversation

    public func newConversation(_ body: NewConversationRequest) async -> ApiResult<NewConversationResponse> {
        await client.execute(Endpoint(
            method: .post,
            path: "api/chat/new_conversation/",
            body: client.encodeBody(body, apiName: "new_conversation"),
            name: "new_conversation"
        ), as: NewConversationResponse.self)
    }

    // MARK: 16. Transcribe (STT) — P3

    public func transcribeAudio(_ body: SetVoiceRequest) async -> ApiResult<GetVoiceResponse> {
        await client.execute(Endpoint(
            method: .post,
            path: "api/chat/transcribe_audio/",
            body: client.encodeBody(body, apiName: "transcribe_audio"),
            priority: .p3,
            name: "transcribe_audio"
        ), as: GetVoiceResponse.self)
    }

    // MARK: 17. Generate OTP

    public func generateOtp(_ body: SendOtpRequest) async -> ApiResult<SendOtpResponse> {
        await client.execute(Endpoint(
            method: .post,
            path: "api/user/generate_otp/",
            body: client.encodeBody(body, apiName: "generate_otp"),
            name: "generate_otp"
        ), as: SendOtpResponse.self)
    }

    // MARK: 18. Device limit

    public func checkDeviceUserLimit(_ body: CheckDeviceRequest) async -> ApiResult<SendOtpResponse> {
        await client.execute(Endpoint(
            method: .post,
            path: "api/user/check_device_user_limit/",
            body: client.encodeBody(body, apiName: "check_device_user_limit"),
            name: "check_device_user_limit"
        ), as: SendOtpResponse.self)
    }

    // MARK: 19. WhatsApp OTP-less token

    public func verifyWhatsappToken(_ body: WhatsappVerificationRequest) async -> ApiResult<VerifyOtpResponse> {
        await client.execute(Endpoint(
            method: .post,
            path: "api/user/verify_otp_less_android_sdk_token/",
            body: client.encodeBody(body, apiName: "verify_otp_less_android_sdk_token"),
            name: "verify_otp_less_android_sdk_token"
        ), as: VerifyOtpResponse.self)
    }

    // MARK: 20. Communication channels

    public func communicationChannel(phoneCountryCode: String) async -> ApiResult<[CommunicationChannel]> {
        await client.execute(Endpoint(
            method: .get,
            path: "api/geography/communication_channel/",
            query: [URLQueryItem(name: "phone_country_code", value: phoneCountryCode)],
            name: "communication_channel"
        ), as: [CommunicationChannel].self)
    }

    // MARK: 21. Verify OTP

    public func verifyOtp(_ body: VerifyOtpRequest) async -> ApiResult<VerifyOtpResponse> {
        await client.execute(Endpoint(
            method: .post,
            path: "api/user/verify_otp/",
            body: client.encodeBody(body, apiName: "verify_otp"),
            name: "verify_otp"
        ), as: VerifyOtpResponse.self)
    }

    // MARK: 22. Conversation list — P2 request, dual-format response

    public func conversationList(userId: String, page: Int) async -> ApiResult<ConversationListResponse> {
        await client.execute(Endpoint(
            method: .get,
            path: "api/chat/conversation_list/",
            query: [
                URLQueryItem(name: "user_id", value: userId),
                URLQueryItem(name: "page", value: String(page))
            ],
            name: "conversation_list"
        ), as: ConversationListResponse.self)
    }

    // MARK: 23. Logout

    public func logout() async -> ApiResult<LogoutResponse> {
        await client.execute(Endpoint(
            method: .post,
            path: "api/user/logout/",
            body: Data("{}".utf8),
            name: "logout"
        ), as: LogoutResponse.self)
    }

    // MARK: 24. FAQ / Help

    public func faqs(lang: String, limit: Int = 5, theme: String?, country: String?) async -> ApiResult<HelpSupportResponse> {
        var query = [
            URLQueryItem(name: "lang", value: lang),
            URLQueryItem(name: "limit", value: String(limit))
        ]
        if let theme { query.append(URLQueryItem(name: "theme", value: theme)) }
        if let country { query.append(URLQueryItem(name: "country", value: country)) }
        return await client.execute(Endpoint(
            method: .get,
            // Trailing slash matches the app (`api/faqs/`) — see the android note.
            path: "api/faqs/",
            query: query,
            name: "faqs"
        ), as: HelpSupportResponse.self)
    }

    // MARK: 25. Mark card viewed

    public func markImageViewed(_ body: ImageViewedRequest) async -> ApiResult<ImageViewedResponse> {
        await client.execute(Endpoint(
            method: .patch,
            path: "api/images/v2/viewed/",
            body: client.encodeBody(body, apiName: "image_viewed"),
            name: "image_viewed"
        ), as: ImageViewedResponse.self)
    }

    // MARK: 26. Card pre-generated answer

    public func imageStatement(_ body: ImageStatementRequest) async -> ApiResult<ImageStatementResponse> {
        await client.execute(Endpoint(
            method: .post,
            path: "api/images/v2/statement/",
            body: client.encodeBody(body, apiName: "image_statement"),
            name: "image_statement"
        ), as: ImageStatementResponse.self)
    }

    // MARK: 27. Main AI answer — P3

    public func getAnswerForTextQuery(_ body: TextPromptRequest) async -> ApiResult<TextPromptResponse> {
        await client.execute(Endpoint(
            method: .post,
            path: "api/chat/get_answer_for_text_query/",
            body: client.encodeBody(body, apiName: "get_answer_for_text_query"),
            priority: .p3,
            name: "get_answer_for_text_query"
        ), as: TextPromptResponse.self)
    }

    // MARK: 27a. Agentic streaming answer (2.0.0) — no timeout, not an ApiPriority call

    /// Streams endpoint #27a. Events arrive as they are produced; a transport failure is surfaced
    /// as `AgenticEvent.failure` rather than thrown, and only cancellation throws. Gated by
    /// `FarmerChatConfig.enableAgenticChat` at the call site — see ``AgenticChatDataSource``.
    public func streamAnswerForTextQueryAgentic(
        _ body: TextPromptRequest
    ) -> AsyncThrowingStream<AgenticEvent, Error> {
        agentic.stream(body)
    }

    // MARK: 28. Image analysis (Plantix) — P3, mapped to the real path

    public func imageAnalysis(_ body: PlantixRequest) async -> ApiResult<PlantixResponse> {
        await client.execute(Endpoint(
            method: .post,
            path: "api/chat/image_analysis/",
            body: client.encodeBody(body, apiName: "image_analysis"),
            priority: .p3,
            name: "image_analysis"
        ), as: PlantixResponse.self)
    }

    // MARK: 29. Follow-up questions — P3

    public func followUpQuestions(messageId: String) async -> ApiResult<FollowUpQuestionsResponse> {
        await client.execute(Endpoint(
            method: .get,
            path: "api/chat/follow_up_questions/",
            query: [
                URLQueryItem(name: "message_id", value: messageId),
                URLQueryItem(name: "use_latest_prompt", value: "true")
            ],
            priority: .p3,
            name: "follow_up_questions"
        ), as: FollowUpQuestionsResponse.self)
    }

    // MARK: 30. Follow-up click tracking

    public func followUpQuestionClick(_ body: FollowUpClickRequest) async -> ApiResult<FollowUpClickResponse> {
        await client.execute(Endpoint(
            method: .post,
            path: "api/chat/follow_up_question_click/",
            body: client.encodeBody(body, apiName: "follow_up_question_click"),
            name: "follow_up_question_click"
        ), as: FollowUpClickResponse.self)
    }

    // MARK: 31. Synthesise audio (TTS) — P3

    public func synthesiseAudio(_ body: SynthesiseAudioRequest) async -> ApiResult<SynthesiseAudioResponse> {
        await client.execute(Endpoint(
            method: .post,
            path: "api/chat/synthesise_audio/",
            body: client.encodeBody(body, apiName: "synthesise_audio"),
            priority: .p3,
            name: "synthesise_audio"
        ), as: SynthesiseAudioResponse.self)
    }

    // MARK: 32. Thread history — P3 (matches app behavior, doc 02 quirks)

    public func conversationChatHistory(conversationId: String, page: Int) async -> ApiResult<ConversationChatHistoryResponse> {
        await client.execute(Endpoint(
            method: .get,
            path: "api/chat/conversation_chat_history/",
            query: [
                URLQueryItem(name: "conversation_id", value: conversationId),
                URLQueryItem(name: "page", value: String(page))
            ],
            priority: .p3,
            name: "conversation_chat_history"
        ), as: ConversationChatHistoryResponse.self)
    }

    // MARK: 33. MoEngage qapair insert

    public func addQueryToHistory(_ body: MoengageQueryHistoryRequest) async -> ApiResult<MoengageQueryHistoryResponse> {
        await client.execute(Endpoint(
            method: .post,
            path: "api/chat/add_query_to_history/",
            body: client.encodeBody(body, apiName: "add_query_to_history"),
            name: "add_query_to_history"
        ), as: MoengageQueryHistoryResponse.self)
    }

    // MARK: 34. Question count

    public func userQuestionCount() async -> ApiResult<UserQuestionCountResponse> {
        await client.execute(Endpoint(
            method: .get,
            path: "api/images/v2/user_question_count/",
            name: "user_question_count"
        ), as: UserQuestionCountResponse.self)
    }

    // MARK: Google Geolocation — P1 (5 s, 1 retry)

    public func geolocate() async -> ApiResult<GeoResponse> {
        guard let geoApiKey, !geoApiKey.isEmpty,
              let url = URL(string: "https://www.googleapis.com/geolocation/v1/geolocate?key=\(geoApiKey)") else {
            return .error(ApiError(message: "Missing geoApiKey", apiName: "geolocate"))
        }
        let priority = ApiPriority.p1
        var attempt = 0
        var lastError = ApiError(apiName: "geolocate")
        while attempt <= priority.maxRetries {
            if attempt > 0 {
                try? await Task.sleep(nanoseconds: RetryPolicy.backoffNanoseconds(attempt: attempt - 1))
            }
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.timeoutInterval = priority.timeoutSeconds
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try? JSONEncoder().encode(GeoRequestBody(considerIp: true))
            do {
                let (data, response) = try await session.data(for: request)
                guard let http = response as? HTTPURLResponse else {
                    return .error(ApiError(message: "Non-HTTP response", apiName: "geolocate"))
                }
                guard (200..<300).contains(http.statusCode) else {
                    let error = ApiError(
                        code: http.statusCode,
                        message: ErrorHandler.backendMessage(fromBody: data),
                        apiName: "geolocate",
                        errorBody: String(data: data, encoding: .utf8)
                    )
                    if RetryPolicy.isRetryable(status: http.statusCode) {
                        lastError = error
                        attempt += 1
                        continue
                    }
                    return .error(error)
                }
                let decoded = try JSONDecoder().decode(GeoResponse.self, from: data)
                return .success(decoded)
            } catch {
                let nsError = error as NSError
                let isTimeout = nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorTimedOut
                lastError = ApiError(message: nsError.localizedDescription, apiName: "geolocate", underlying: nsError, isTimeout: isTimeout)
                attempt += 1
            }
        }
        return .error(lastError)
    }
}
