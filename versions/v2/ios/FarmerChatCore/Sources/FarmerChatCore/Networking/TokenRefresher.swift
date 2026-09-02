import Foundation

/// Actor-based replica of the app's `TokenAuthenticator`.
///
/// Semantics (doc 02 §TokenAuthenticator):
/// - Skip URLs containing `generate_otp`, `verify_otp`, `get_new_access_token`,
///   `send_tokens`, `initialize_user` — a 401 on those is a plain error.
/// - Loop guard: a request that has already been retried after 2 refresh
///   attempts gives up.
/// - Step 1: refresh via `get_new_access_token` with the stored refresh token.
/// - Step 2 fallback: `send_tokens(device_id, user_id)` with the guest API key.
/// - Concurrent 401s share one in-flight refresh (actor serialization).
/// - Never runs on the main thread (actors hop off it by construction).
actor TokenRefresher {
    enum Outcome: Sendable {
        /// New access token available — caller should retry with it.
        case refreshed(accessToken: String)
        /// Both refresh and guest fallback failed — session is expired.
        case sessionExpired
    }

    static let skipURLFragments = [
        "generate_otp",
        "verify_otp",
        "get_new_access_token",
        "send_tokens",
        "initialize_user"
    ]

    private let tokenStore: KeychainTokenStore
    private let baseURL: URL
    private let guestApiKey: String?
    private let session: URLSession
    private let deviceInfo: DeviceInfoProvider
    private let authMode: FarmerChatAuthMode
    private let tokenProvider: FarmerChatTokenProvider?
    private let onSessionExpired: (@Sendable () -> Void)?

    /// Token value that was current when the last successful refresh finished.
    /// Lets a queued waiter reuse a refresh that already happened.
    private var lastRefreshedToken: String?
    private var inFlight: Task<Outcome, Never>?

    init(
        tokenStore: KeychainTokenStore,
        baseURL: URL,
        guestApiKey: String?,
        session: URLSession = .shared,
        deviceInfo: DeviceInfoProvider,
        authMode: FarmerChatAuthMode = .sdkOtp,
        tokenProvider: FarmerChatTokenProvider? = nil,
        onSessionExpired: (@Sendable () -> Void)? = nil
    ) {
        self.tokenStore = tokenStore
        self.baseURL = baseURL
        self.guestApiKey = guestApiKey
        self.session = session
        self.deviceInfo = deviceInfo
        self.authMode = authMode
        self.tokenProvider = tokenProvider
        self.onSessionExpired = onSessionExpired
    }

    static func shouldSkip(url: URL?) -> Bool {
        guard let absolute = url?.absoluteString else { return false }
        return skipURLFragments.contains { absolute.contains($0) }
    }

    /// Called by the API client after receiving a 401.
    /// `staleToken` is the Bearer that produced the 401 — if the stored token
    /// already differs, another request refreshed first and we simply reuse it.
    func authenticate(staleToken: String?) async -> Outcome {
        // Someone already refreshed while we were queued.
        if let current = tokenStore.accessToken, current != staleToken, !current.isEmpty {
            return .refreshed(accessToken: current)
        }
        if let inFlight {
            return await inFlight.value
        }
        let task = Task<Outcome, Never> { [weak self] in
            guard let self else { return .sessionExpired }
            return await self.performRefresh()
        }
        inFlight = task
        let outcome = await task.value
        inFlight = nil
        return outcome
    }

    private func performRefresh() async -> Outcome {
        // C2 host-token mode: ask the host for a fresh token instead of the
        // SDK guest/OTP refresh chain. On failure the session is expired.
        if authMode == .hostToken {
            if let provider = tokenProvider, let token = await provider(), !token.isEmpty {
                tokenStore.saveTokens(access: token, refresh: tokenStore.refreshToken)
                lastRefreshedToken = token
                return .refreshed(accessToken: token)
            }
            onSessionExpired?()
            return .sessionExpired
        }

        // Step 1 — refresh token.
        if let refreshToken = tokenStore.refreshToken, !refreshToken.isEmpty {
            if let tokens = await callTokenEndpoint(
                path: "api/user/get_new_access_token/",
                body: RefreshTokenRequest(refreshToken: refreshToken),
                includeApiKey: false
            ), let access = tokens.accessToken, !access.isEmpty {
                tokenStore.saveTokens(access: access, refresh: tokens.refreshToken)
                lastRefreshedToken = access
                return .refreshed(accessToken: access)
            }
        }

        // Step 2 — guest-token fallback with API key.
        let fallbackBody = SendNewTokenRequest(deviceId: tokenStore.deviceId, userId: tokenStore.userId)
        if let tokens = await callTokenEndpoint(
            path: "api/user/send_tokens/",
            body: fallbackBody,
            includeApiKey: true
        ), let access = tokens.accessToken, !access.isEmpty {
            tokenStore.saveTokens(access: access, refresh: tokens.refreshToken)
            lastRefreshedToken = access
            return .refreshed(accessToken: access)
        }

        onSessionExpired?()
        return .sessionExpired
    }

    private func callTokenEndpoint<Body: Encodable>(
        path: String,
        body: Body,
        includeApiKey: Bool
    ) async -> RefreshTokenResponse? {
        guard let url = URL(string: path, relativeTo: baseURL) else { return nil }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = ApiPriority.p2.timeoutSeconds
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(FarmerChatSDK.buildVersionHeader, forHTTPHeaderField: "Build-Version")
        request.setValue(deviceInfo.deviceInfoHeaderValue(), forHTTPHeaderField: "Device-Info")
        if includeApiKey, let guestApiKey, !guestApiKey.isEmpty {
            request.setValue(guestApiKey, forHTTPHeaderField: "API-Key")
        }
        request.httpBody = try? JSONEncoder().encode(body)
        do {
            let (data, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                return nil
            }
            return try JSONDecoder().decode(RefreshTokenResponse.self, from: data)
        } catch {
            return nil
        }
    }
}
