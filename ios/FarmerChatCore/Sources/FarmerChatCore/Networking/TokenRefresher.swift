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
/// - Step 3 guest re-initialisation (SDK addition, doc 02): only when not
///   `HOST_TOKEN`, Step 2 produced no token, the session is a guest
///   (`OTP_VERIFIED` not set) and Step 2 failed because the identity was
///   rejected (`send_tokens` 400/401/403/404, or no `user_id`/`device_id` to
///   send — never a network error, timeout or 5xx): `initialize_user` with the
///   guest API key and `{device_id, lat?, long?}` (existing device id; lat/long
///   from the stored GPS fix `FARMER_APP_LATITUDE/LONGITUDE`, else the SAME
///   fallback onboarding uses — host `defaultLatitude/Longitude`, then the
///   device-locale country centroid; (0, 0)/unresolved sends no coordinates. A
///   guest re-initialised without coordinates has no server-side location, and
///   endpoint #12 then returns an empty feed forever). On an `access_token`:
///   save access + refresh tokens and `user_id`, remove `NEW_CONVERSATION_ID`
///   and the old user's place (`USER_DISTRICT`, `USER_STATE`,
///   `USER_COUNTRY_NAME`), store `country_code`/`country`/`state` from the
///   response exactly as the first guest init does, fire `onGuestReplaced`
///   (screens re-run their entry loads — the retried request still carries the
///   old `user_id`), keep everything else, and retry. Otherwise the session is
///   expired.
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
    /// Needed by Step 3 (guest detection, stored lat/long, conversation id).
    /// `nil` disables Step 3.
    private let prefs: PreferenceStore?
    /// Step 3 coordinates when no GPS fix is stored — the onboarding fallback
    /// (`FarmerChatConfig.resolvedFallbackCoordinates`). Checked with
    /// `CountryLatLngProvider.isResolved` here; `nil` means no fallback.
    private let fallbackCoordinates: (@Sendable () -> (lat: Double, lng: Double))?
    /// Step 3 succeeded: a NEW guest replaced the rejected one.
    private let onGuestReplaced: (@Sendable () -> Void)?

    /// `send_tokens` statuses meaning "the backend does not know this identity".
    static let identityRejectedStatuses: Set<Int> = [400, 401, 403, 404]

    /// Result of one raw POST to a token endpoint.
    private enum CallResult<Response> {
        case ok(Response)
        /// Non-2xx HTTP answer.
        case http(status: Int)
        /// Network error, timeout, non-HTTP response, or undecodable 2xx body.
        case failed
    }

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
        onSessionExpired: (@Sendable () -> Void)? = nil,
        prefs: PreferenceStore? = nil,
        fallbackCoordinates: (@Sendable () -> (lat: Double, lng: Double))? = nil,
        onGuestReplaced: (@Sendable () -> Void)? = nil
    ) {
        self.tokenStore = tokenStore
        self.baseURL = baseURL
        self.guestApiKey = guestApiKey
        self.session = session
        self.deviceInfo = deviceInfo
        self.authMode = authMode
        self.tokenProvider = tokenProvider
        self.onSessionExpired = onSessionExpired
        self.prefs = prefs
        self.fallbackCoordinates = fallbackCoordinates
        self.onGuestReplaced = onGuestReplaced
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
            if case .ok(let tokens) = await post(
                path: "api/user/get_new_access_token/",
                body: RefreshTokenRequest(refreshToken: refreshToken),
                includeApiKey: false,
                as: RefreshTokenResponse.self
            ), let access = tokens.accessToken, !access.isEmpty {
                tokenStore.saveTokens(access: access, refresh: tokens.refreshToken)
                lastRefreshedToken = access
                return .refreshed(accessToken: access)
            }
        }

        // Step 2 — guest-token fallback with API key.
        let deviceId = tokenStore.deviceId
        let userId = tokenStore.userId
        let fallbackBody = SendNewTokenRequest(deviceId: deviceId, userId: userId)
        let fallback = await post(
            path: "api/user/send_tokens/",
            body: fallbackBody,
            includeApiKey: true,
            as: RefreshTokenResponse.self
        )
        if case .ok(let tokens) = fallback, let access = tokens.accessToken, !access.isEmpty {
            tokenStore.saveTokens(access: access, refresh: tokens.refreshToken)
            lastRefreshedToken = access
            return .refreshed(accessToken: access)
        }

        // Step 3 — guest re-initialisation (identity rejected, guest only).
        let identityMissing = deviceId.isEmpty || (userId ?? "").isEmpty
        var identityRejected = identityMissing
        if case .http(let status) = fallback, Self.identityRejectedStatuses.contains(status) {
            identityRejected = true
        }
        if identityRejected, let prefs, !prefs.bool(.otpVerified) {
            let coordinates = Self.reinitCoordinates(
                storedLat: prefs.double(.latitude),
                storedLng: prefs.double(.longitude),
                fallback: fallbackCoordinates?()
            )
            let request = InitializeGuestUserRequest(
                deviceId: deviceId,
                lat: coordinates?.lat,
                long: coordinates?.lng
            )
            if case .ok(let response) = await post(
                path: "api/user/initialize_user/",
                body: request,
                includeApiKey: true,
                as: InitializeGuestUserResponse.self
            ), let access = response.accessToken, !access.isEmpty {
                tokenStore.saveTokens(access: access, refresh: response.refreshToken)
                if let newUserId = response.userId?.stringValue, !newUserId.isEmpty {
                    tokenStore.userId = newUserId
                }
                // The conversation and the place names belonged to the old user; the new
                // guest's place is whatever this response says (same writes as the first
                // guest init). Everything else is kept.
                prefs.remove(.newConversationId)
                prefs.remove(.userDistrict)
                prefs.remove(.userState)
                prefs.remove(.userCountryName)
                SessionManager.storePlace(from: response, in: prefs)
                lastRefreshedToken = access
                onGuestReplaced?()
                return .refreshed(accessToken: access)
            }
        }

        onSessionExpired?()
        return .sessionExpired
    }

    /// Stored GPS fix first (both values present and resolved), else the onboarding fallback;
    /// (0, 0) or a half-stored fix counts as unresolved. `nil` → send no coordinates.
    static func reinitCoordinates(
        storedLat: Double?,
        storedLng: Double?,
        fallback: (lat: Double, lng: Double)?
    ) -> (lat: Double, lng: Double)? {
        if let lat = storedLat, let lng = storedLng, CountryLatLngProvider.isResolved(lat: lat, lng: lng) {
            return (lat, lng)
        }
        if let fallback, CountryLatLngProvider.isResolved(lat: fallback.lat, lng: fallback.lng) {
            return fallback
        }
        return nil
    }

    private func post<Body: Encodable, Response: Decodable>(
        path: String,
        body: Body,
        includeApiKey: Bool,
        as type: Response.Type
    ) async -> CallResult<Response> {
        guard let url = URL(string: path, relativeTo: baseURL) else { return .failed }
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
            guard let http = response as? HTTPURLResponse else { return .failed }
            guard (200..<300).contains(http.statusCode) else { return .http(status: http.statusCode) }
            return .ok(try JSONDecoder().decode(Response.self, from: data))
        } catch {
            return .failed
        }
    }
}
