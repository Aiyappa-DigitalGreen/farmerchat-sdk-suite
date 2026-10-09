import XCTest
@testable import FarmerChatCore

/// Stubs every request on a URLSession built with it. The handler maps a request to
/// (status, body) or throws to simulate a transport failure.
final class StubURLProtocol: URLProtocol {
    typealias Handler = (URLRequest, Data?) throws -> (Int, Data)

    private static let lock = NSLock()
    private static var _handler: Handler?
    private static var _log: [(path: String, authorization: String?, apiKey: String?, body: Data?)] = []

    static var handler: Handler? {
        get { lock.lock(); defer { lock.unlock() }; return _handler }
        set { lock.lock(); defer { lock.unlock() }; _handler = newValue }
    }

    static var log: [(path: String, authorization: String?, apiKey: String?, body: Data?)] {
        lock.lock(); defer { lock.unlock() }; return _log
    }

    static func reset() {
        lock.lock(); defer { lock.unlock() }
        _handler = nil
        _log = []
    }

    static func calls(to fragment: String) -> Int {
        log.filter { $0.path.contains(fragment) }.count
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        // httpBody is moved to httpBodyStream by the time the protocol sees it.
        let body = request.httpBody ?? request.httpBodyStream.map(Self.readAll)
        Self.lock.lock()
        Self._log.append((
            request.url?.path ?? "",
            request.value(forHTTPHeaderField: "Authorization"),
            request.value(forHTTPHeaderField: "API-Key"),
            body
        ))
        let handler = Self._handler
        Self.lock.unlock()
        do {
            guard let handler else { throw URLError(.unknown) }
            let (status, data) = try handler(request, body)
            let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: "HTTP/1.1", headerFields: nil)!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}

    private static func readAll(_ stream: InputStream) -> Data {
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let read = stream.read(&buffer, maxLength: buffer.count)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        return data
    }
}

/// doc 02 §TokenAuthenticator, Step 3 — guest re-initialisation after a rejected `send_tokens`.
final class TokenRefresherGuestReinitTests: XCTestCase {
    private let baseURL = URL(string: "https://example.test/")!
    private let profilePath = "api/user/view_user_profile/"
    private var suiteName = ""
    private var defaults: UserDefaults!
    private var prefs: PreferenceStore!
    private var tokenStore: KeychainTokenStore!
    private var session: URLSession!
    private var expiredCount = 0
    private let expiredLock = NSLock()
    private var replacedCount = 0

    override func setUp() {
        super.setUp()
        StubURLProtocol.reset()
        suiteName = "fc_sdk_test_\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)!
        prefs = PreferenceStore(defaults: defaults)
        tokenStore = KeychainTokenStore(service: "org.digitalgreen.farmerchat.sdk.tests")
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [StubURLProtocol.self]
        session = URLSession(configuration: configuration)
        expiredCount = 0
        replacedCount = 0
    }

    override func tearDown() {
        tokenStore.clear()
        defaults.removePersistentDomain(forName: suiteName)
        StubURLProtocol.reset()
        super.tearDown()
    }

    private func makeClient(
        fallbackCoordinates: (@Sendable () -> (lat: Double, lng: Double))? = nil
    ) -> APIClient {
        let deviceInfo = DeviceInfoProvider(deviceId: tokenStore.deviceId)
        let refresher = TokenRefresher(
            tokenStore: tokenStore,
            baseURL: baseURL,
            farmerChatApiKey: "guest-key",
            session: session,
            deviceInfo: deviceInfo,
            onSessionExpired: { [weak self] in
                guard let self else { return }
                self.expiredLock.lock(); self.expiredCount += 1; self.expiredLock.unlock()
            },
            prefs: prefs,
            fallbackCoordinates: fallbackCoordinates,
            onGuestReplaced: { [weak self] in
                guard let self else { return }
                self.expiredLock.lock(); self.replacedCount += 1; self.expiredLock.unlock()
            }
        )
        return APIClient(baseURL: baseURL, tokenStore: tokenStore, refresher: refresher, deviceInfo: deviceInfo, session: session)
    }

    private func callProfile(_ client: APIClient) async -> ApiResult<UserProfileProbe> {
        await client.execute(Endpoint(method: .get, path: profilePath, name: "view_user_profile"), as: UserProfileProbe.self)
    }

    private func seedGuestSession() {
        tokenStore.saveTokens(access: "old-access", refresh: "old-refresh")
        tokenStore.userId = "old-user"
        prefs.setString("old-conversation", .newConversationId)
        prefs.setString("hi", .selectedLanguageCode)
        prefs.setDouble(12.5, .latitude)
        prefs.setDouble(77.25, .longitude)
    }

    func testKeychainRoundTripWorksUnderTest() {
        tokenStore.userId = "probe"
        XCTAssertEqual(tokenStore.userId, "probe", "Keychain writes must persist or the tests below prove nothing")
    }

    func testGuestRejectedBySendTokensIsReinitialisedAndRetried() async throws {
        seedGuestSession()
        let deviceId = tokenStore.deviceId
        StubURLProtocol.handler = { request, _ in
            let path = request.url?.path ?? ""
            let auth = request.value(forHTTPHeaderField: "Authorization")
            if path.contains("view_user_profile") {
                return auth == "Bearer new-access"
                    ? (200, Data(#"{"ok":true}"#.utf8))
                    : (401, Data(#"{"detail":"expired"}"#.utf8))
            }
            if path.contains("get_new_access_token") { return (401, Data("{}".utf8)) }
            if path.contains("send_tokens") { return (400, Data(#"{"detail":"User not found or inactive."}"#.utf8)) }
            if path.contains("initialize_user") {
                return (200, Data(#"{"access_token":"new-access","refresh_token":"new-refresh","user_id":4242}"#.utf8))
            }
            return (500, Data())
        }

        // The stored fix must win over the onboarding fallback.
        let result = await callProfile(makeClient(fallbackCoordinates: { (54.0, -2.0) }))

        guard case .success = result else { return XCTFail("expected the original request to succeed after re-init, got \(result)") }
        XCTAssertEqual(StubURLProtocol.calls(to: "initialize_user"), 1)
        XCTAssertEqual(StubURLProtocol.calls(to: "view_user_profile"), 2)
        XCTAssertEqual(StubURLProtocol.log.last?.authorization, "Bearer new-access")
        XCTAssertEqual(tokenStore.accessToken, "new-access")
        XCTAssertEqual(tokenStore.refreshToken, "new-refresh")
        XCTAssertEqual(tokenStore.userId, "4242")
        XCTAssertNil(prefs.string(.newConversationId))
        XCTAssertEqual(prefs.string(.selectedLanguageCode), "hi", "everything except the conversation id and place names is kept")
        XCTAssertEqual(prefs.double(.latitude), 12.5)
        XCTAssertEqual(expiredCount, 0)
        XCTAssertEqual(replacedCount, 1)

        let initCall = try XCTUnwrap(StubURLProtocol.log.first { $0.path.contains("initialize_user") })
        XCTAssertEqual(initCall.apiKey, "guest-key")
        let body = try XCTUnwrap(initCall.body)
        let json = try XCTUnwrap(try JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertEqual(json["device_id"] as? String, deviceId)
        XCTAssertEqual(json["lat"] as? Double, 12.5)
        XCTAssertEqual(json["long"] as? Double, 77.25)
    }

    func testPhoneVerifiedUserIsNeverReinitialised() async {
        seedGuestSession()
        prefs.setBool(true, .otpVerified)
        StubURLProtocol.handler = { request, _ in
            let path = request.url?.path ?? ""
            if path.contains("view_user_profile") { return (401, Data("{}".utf8)) }
            if path.contains("get_new_access_token") { return (401, Data("{}".utf8)) }
            if path.contains("send_tokens") { return (400, Data("{}".utf8)) }
            if path.contains("initialize_user") {
                return (200, Data(#"{"access_token":"new-access","refresh_token":"new-refresh","user_id":4242}"#.utf8))
            }
            return (500, Data())
        }

        let result = await callProfile(makeClient())

        guard case .error(let error) = result else { return XCTFail("expected session expiry") }
        XCTAssertEqual(error.code, 401)
        XCTAssertEqual(StubURLProtocol.calls(to: "initialize_user"), 0)
        XCTAssertEqual(tokenStore.userId, "old-user")
        XCTAssertEqual(prefs.string(.newConversationId), "old-conversation")
        XCTAssertEqual(expiredCount, 1)
        XCTAssertEqual(replacedCount, 0)
    }

    func testNetworkFailureOfSendTokensDoesNotReinitialise() async {
        seedGuestSession()
        StubURLProtocol.handler = { request, _ in
            let path = request.url?.path ?? ""
            if path.contains("view_user_profile") { return (401, Data("{}".utf8)) }
            if path.contains("get_new_access_token") { return (401, Data("{}".utf8)) }
            if path.contains("send_tokens") { throw URLError(.notConnectedToInternet) }
            if path.contains("initialize_user") {
                return (200, Data(#"{"access_token":"new-access","refresh_token":"new-refresh","user_id":4242}"#.utf8))
            }
            return (500, Data())
        }

        let result = await callProfile(makeClient())

        guard case .error(let error) = result else { return XCTFail("expected session expiry") }
        XCTAssertEqual(error.code, 401)
        XCTAssertEqual(StubURLProtocol.calls(to: "initialize_user"), 0)
        XCTAssertEqual(tokenStore.accessToken, "old-access")
        XCTAssertEqual(prefs.string(.newConversationId), "old-conversation")
        XCTAssertEqual(expiredCount, 1)
        XCTAssertEqual(replacedCount, 0)
    }

    func testServerErrorOfSendTokensDoesNotReinitialise() async {
        seedGuestSession()
        StubURLProtocol.handler = { request, _ in
            let path = request.url?.path ?? ""
            if path.contains("view_user_profile") { return (401, Data("{}".utf8)) }
            if path.contains("get_new_access_token") { return (401, Data("{}".utf8)) }
            if path.contains("send_tokens") { return (503, Data("{}".utf8)) }
            if path.contains("initialize_user") {
                return (200, Data(#"{"access_token":"new-access"}"#.utf8))
            }
            return (500, Data())
        }

        let result = await callProfile(makeClient())

        guard case .error = result else { return XCTFail("expected session expiry") }
        XCTAssertEqual(StubURLProtocol.calls(to: "initialize_user"), 0)
        XCTAssertEqual(expiredCount, 1)
        XCTAssertEqual(replacedCount, 0)
    }

    // MARK: - Step 3 coordinates, place rewrite, "guest replaced" signal

    /// Answers the probe with 200 only for the re-initialised token; `send_tokens` rejects.
    private func installRejectedGuestHandler(initResponse: String) {
        StubURLProtocol.handler = { request, _ in
            let path = request.url?.path ?? ""
            if path.contains("view_user_profile") {
                return request.value(forHTTPHeaderField: "Authorization") == "Bearer new-access"
                    ? (200, Data(#"{"ok":true}"#.utf8))
                    : (401, Data("{}".utf8))
            }
            if path.contains("get_new_access_token") { return (401, Data("{}".utf8)) }
            if path.contains("send_tokens") { return (400, Data(#"{"detail":"User not found or inactive."}"#.utf8)) }
            if path.contains("initialize_user") { return (201, Data(initResponse.utf8)) }
            return (500, Data())
        }
    }

    private func initBodyJSON() throws -> [String: Any] {
        let initCall = try XCTUnwrap(StubURLProtocol.log.first { $0.path.contains("initialize_user") })
        let body = try XCTUnwrap(initCall.body)
        return try XCTUnwrap(try JSONSerialization.jsonObject(with: body) as? [String: Any])
    }

    func testNoStoredFixSendsFallbackCoordinatesRewritesPlaceAndSignals() async throws {
        seedGuestSession()
        prefs.remove(.latitude)
        prefs.remove(.longitude)
        prefs.setString("Bengaluru Urban", .userDistrict)
        prefs.setString("Karnataka", .userState)
        prefs.setString("India", .userCountryName)
        prefs.setString("IN", .userCountryCode)
        installRejectedGuestHandler(initResponse:
            #"{"access_token":"new-access","refresh_token":"r","user_id":"new-user","country_code":"GB","country":"United Kingdom","state":null}"#
        )

        let result = await callProfile(makeClient(fallbackCoordinates: { (54.0, -2.0) }))

        guard case .success = result else { return XCTFail("expected success after re-init, got \(result)") }
        let json = try initBodyJSON()
        XCTAssertEqual(json["lat"] as? Double, 54.0)
        XCTAssertEqual(json["long"] as? Double, -2.0)
        XCTAssertNil(prefs.double(.latitude), "the fallback is never persisted as a GPS fix")
        XCTAssertNil(prefs.string(.userDistrict), "the old user's district is dropped")
        XCTAssertNil(prefs.string(.userState), "the old user's state is dropped and the response had none")
        XCTAssertEqual(prefs.string(.userCountryName), "United Kingdom")
        XCTAssertEqual(prefs.string(.userCountryCode), "GB")
        XCTAssertEqual(tokenStore.userId, "new-user")
        XCTAssertEqual(replacedCount, 1)
        XCTAssertEqual(expiredCount, 0)
    }

    func testNoStoredFixAndUnresolvedFallbackSendsNoCoordinates() async throws {
        seedGuestSession()
        prefs.remove(.latitude)
        prefs.remove(.longitude)
        installRejectedGuestHandler(initResponse: #"{"access_token":"new-access","user_id":"n"}"#)

        // (0, 0) is what `resolvedFallbackCoordinates` returns when nothing resolves.
        let result = await callProfile(makeClient(fallbackCoordinates: { (0.0, 0.0) }))

        guard case .success = result else { return XCTFail("expected success after re-init, got \(result)") }
        let json = try initBodyJSON()
        XCTAssertNil(json["lat"])
        XCTAssertNil(json["long"])
        XCTAssertNotNil(json["device_id"])
        XCTAssertEqual(replacedCount, 1)
    }

    func testZeroStoredFixFallsThroughToFallback() async throws {
        seedGuestSession()
        prefs.setDouble(0.0, .latitude)
        prefs.setDouble(0.0, .longitude)
        installRejectedGuestHandler(initResponse: #"{"access_token":"new-access","user_id":"n"}"#)

        _ = await callProfile(makeClient(fallbackCoordinates: { (-1.29, 36.82) }))

        let json = try initBodyJSON()
        XCTAssertEqual(json["lat"] as? Double, -1.29)
        XCTAssertEqual(json["long"] as? Double, 36.82)
    }

    func testFirstInitAndReinitShareThePlaceWrites() throws {
        let response = try JSONDecoder().decode(
            InitializeGuestUserResponse.self,
            from: Data(#"{"access_token":"a","country_code":"KE","country":"Kenya","state":"Nairobi"}"#.utf8)
        )
        SessionManager.storePlace(from: response, in: prefs)
        XCTAssertEqual(prefs.string(.userCountryCode), "KE")
        XCTAssertEqual(prefs.string(.userCountryName), "Kenya")
        XCTAssertEqual(prefs.string(.userState), "Nairobi")
    }
}

/// Minimal decodable for the stubbed original request.
struct UserProfileProbe: Decodable, Sendable {
    let ok: Bool?
}
