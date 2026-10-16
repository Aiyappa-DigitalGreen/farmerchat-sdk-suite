import Foundation
import os

/// HTTP method for endpoint descriptors.
enum HTTPMethod: String, Sendable {
    case get = "GET"
    case post = "POST"
    case patch = "PATCH"
    case put = "PUT"
    case delete = "DELETE"
}

/// Description of a single API call.
struct Endpoint: Sendable {
    var method: HTTPMethod
    var path: String
    var query: [URLQueryItem] = []
    var body: Data?
    var priority: ApiPriority = .p2
    /// `API-Key` header value (guest init / send_tokens).
    var apiKey: String?
    /// Human-readable name for ApiError.apiName / analytics.
    var name: String
}

/// async/await URLSession API client replicating the app's OkHttp stack:
/// - `X-Request-ID` per request (PriorityRequestIdInterceptor)
/// - `X-Timeout` = priority timeout (ApiPriorityHeaderInterceptor)
/// - per-request `timeoutInterval` (TimeoutTypeInterceptor)
/// - `Build-Version: v2`, `Device-Info`, `Authorization: Bearer` (AuthHeaderInterceptor)
/// - retry loop with the exact retryable-code table + backoff (executeApiCall)
/// - 401 handling via the actor-based `TokenRefresher` (TokenAuthenticator)
final class APIClient: @unchecked Sendable {
    let baseURL: URL
    let session: URLSession
    let tokenStore: KeychainTokenStore
    let refresher: TokenRefresher
    let deviceInfo: DeviceInfoProvider
    let decoder: JSONDecoder
    let encoder: JSONEncoder
    /// False when the caller injected the session (tests): teardown leaves it alone.
    private let ownsSession: Bool

    init(
        baseURL: URL,
        tokenStore: KeychainTokenStore,
        refresher: TokenRefresher,
        deviceInfo: DeviceInfoProvider,
        session: URLSession? = nil
    ) {
        self.baseURL = baseURL
        self.tokenStore = tokenStore
        self.refresher = refresher
        self.deviceInfo = deviceInfo
        self.ownsSession = session == nil
        if let session {
            self.session = session
        } else {
            let configuration = URLSessionConfiguration.default
            configuration.timeoutIntervalForRequest = 30 // default; overridden per request
            configuration.waitsForConnectivity = false
            self.session = URLSession(configuration: configuration)
        }
        self.decoder = JSONDecoder()
        self.encoder = JSONEncoder()
    }

    /// Re-initialize / shutdown teardown: cancels this client's in-flight requests. The session
    /// is NOT invalidated — a view still holding the old instance would crash creating a task
    /// on an invalidated session; a cancelled one just fails the call.
    func cancelInFlight() {
        guard ownsSession else { return }
        APIClient.cancelTasks(of: session)
    }

    static func cancelTasks(of session: URLSession) {
        session.getAllTasks { tasks in tasks.forEach { $0.cancel() } }
    }

    // MARK: - Request execution

    func execute<T: Decodable & Sendable>(_ endpoint: Endpoint, as type: T.Type) async -> ApiResult<T> {
        let maxRetries = endpoint.priority.maxRetries
        var attempt = 0
        var lastError: ApiError?

        while attempt <= maxRetries {
            if attempt > 0 {
                try? await Task.sleep(nanoseconds: RetryPolicy.backoffNanoseconds(attempt: attempt - 1))
            }
            let outcome = await executeOnce(endpoint, as: type)
            switch outcome {
            case .success:
                return outcome
            case .error(let error):
                lastError = error
                let status = error.code
                // 401 is terminal here (authenticator already ran inside executeOnce).
                if status == 401 { return outcome }
                if let status {
                    guard RetryPolicy.isRetryable(status: status) else { return outcome }
                } else {
                    // Transport error: only IO-shaped failures are retried.
                    guard isRetryableTransport(error.underlying) else { return outcome }
                }
                attempt += 1
            }
        }
        return .error(lastError ?? ApiError(apiName: endpoint.name))
    }

    /// One HTTP round trip including 401→refresh→retry (loop-guarded to 2 auth attempts).
    private func executeOnce<T: Decodable & Sendable>(_ endpoint: Endpoint, as type: T.Type) async -> ApiResult<T> {
        var authAttempts = 0
        var bearer = tokenStore.accessToken

        while true {
            guard var request = buildRequest(endpoint) else {
                return .error(ApiError(message: "Invalid URL for \(endpoint.path)", apiName: endpoint.name))
            }
            if let bearer, !bearer.isEmpty {
                request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization")
            }

            let data: Data
            let response: URLResponse
            let started = DispatchTime.now()
            do {
                (data, response) = try await session.data(for: request)
                NetworkLog.completed(request, status: (response as? HTTPURLResponse)?.statusCode, started: started)
            } catch {
                let nsError = error as NSError
                let isTimeout = nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorTimedOut
                NetworkLog.failed(request, error: nsError, started: started)
                return .error(ApiError(
                    message: nsError.localizedDescription,
                    apiName: endpoint.name,
                    underlying: nsError,
                    isTimeout: isTimeout
                ))
            }

            guard let http = response as? HTTPURLResponse else {
                return .error(ApiError(message: "Non-HTTP response", apiName: endpoint.name))
            }

            if http.statusCode == 401 {
                // Authenticator semantics: skip-list + loop guard.
                if TokenRefresher.shouldSkip(url: request.url) || authAttempts >= 2 {
                    return httpError(status: 401, data: data, endpoint: endpoint)
                }
                authAttempts += 1
                switch await refresher.authenticate(staleToken: bearer) {
                case .refreshed(let newToken):
                    bearer = newToken
                    continue
                case .sessionExpired:
                    return httpError(status: 401, data: data, endpoint: endpoint)
                }
            }

            guard (200..<300).contains(http.statusCode) else {
                return httpError(status: http.statusCode, data: data, endpoint: endpoint)
            }

            // 204 / empty body — decode from an empty JSON object when possible.
            let payload = data.isEmpty ? Data("{}".utf8) : data
            do {
                let decoded = try decoder.decode(T.self, from: payload)
                return .success(decoded)
            } catch {
                return .error(ApiError(
                    code: http.statusCode,
                    message: "Failed to decode \(endpoint.name): \(error.localizedDescription)",
                    apiName: endpoint.name,
                    errorBody: String(data: data, encoding: .utf8),
                    underlying: error as NSError
                ))
            }
        }
    }

    private func httpError<T>(status: Int, data: Data, endpoint: Endpoint) -> ApiResult<T> {
        let message = ErrorHandler.backendMessage(fromBody: data)
        return .error(ApiError(
            code: status,
            message: message,
            apiName: endpoint.name,
            errorBody: String(data: data, encoding: .utf8),
            isTimeout: status == 408
        ))
    }

    private func isRetryableTransport(_ error: (any Error)?) -> Bool {
        guard let nsError = error as NSError? else { return false }
        guard nsError.domain == NSURLErrorDomain else { return false }
        switch nsError.code {
        case NSURLErrorCancelled, NSURLErrorBadURL, NSURLErrorUnsupportedURL,
             NSURLErrorUserCancelledAuthentication:
            return false
        default:
            // Everything else in NSURLErrorDomain is IO-shaped (timeout, DNS,
            // connection lost, offline) — the IOException analogue.
            return true
        }
    }

    // MARK: - Request building (interceptor chain equivalent)

    private func buildRequest(_ endpoint: Endpoint) -> URLRequest? {
        guard var components = URLComponents(
            url: URL(string: endpoint.path, relativeTo: baseURL) ?? baseURL,
            resolvingAgainstBaseURL: true
        ) else { return nil }
        if !endpoint.query.isEmpty {
            components.queryItems = (components.queryItems ?? []) + endpoint.query
        }
        guard let url = components.url else { return nil }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue
        // TimeoutTypeInterceptor: per-request timeout from priority.
        request.timeoutInterval = endpoint.priority.timeoutSeconds
        // PriorityRequestIdInterceptor.
        request.setValue(UUID().uuidString, forHTTPHeaderField: "X-Request-ID")
        // ApiPriorityHeaderInterceptor.
        request.setValue(String(Int(endpoint.priority.timeoutSeconds)), forHTTPHeaderField: "X-Timeout")
        // AuthHeaderInterceptor (Authorization added by caller loop).
        request.setValue(FarmerChatSDK.buildVersionHeader, forHTTPHeaderField: "Build-Version")
        request.setValue(deviceInfo.deviceInfoHeaderValue(), forHTTPHeaderField: "Device-Info")
        if let apiKey = endpoint.apiKey, !apiKey.isEmpty {
            request.setValue(apiKey, forHTTPHeaderField: "API-Key")
        }
        if endpoint.body != nil {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        request.httpBody = endpoint.body
        return request
    }

    func encodeBody<Body: Encodable>(_ body: Body, apiName: String) -> Data? {
        try? encoder.encode(body)
    }

    /// Builds the POST request for a **streaming** endpoint (#27a, 2.0.0).
    ///
    /// Deliberately NOT built on `buildRequest`: that stamps
    /// `request.timeoutInterval = priority.timeoutSeconds`, and a `URLRequest` timeout **overrides**
    /// the session configuration — so a P3 request would cap an agentic stream at 30 s no matter
    /// how the streaming session is configured. The `X-Timeout` / `X-Request-ID` priority headers
    /// are omitted for the same reason (Android's agentic client skips those interceptors too).
    ///
    /// Auth-relevant headers are identical to every other call; `Authorization` is added by the
    /// caller's refresh loop.
    func streamingRequest(path: String, body: Data?) -> URLRequest? {
        guard let url = URL(string: path, relativeTo: baseURL) else { return nil }
        var request = URLRequest(url: url)
        request.httpMethod = HTTPMethod.post.rawValue
        // Effectively no timeout — see AgenticChatDataSource.noTimeoutInterval.
        request.timeoutInterval = AgenticChatDataSource.noTimeoutInterval
        // MUST NOT be text/event-stream: the backend 406s that (verified live 2026-09-02). The
        // streaming view sets its own response Content-Type regardless.
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(FarmerChatSDK.buildVersionHeader, forHTTPHeaderField: "Build-Version")
        request.setValue(deviceInfo.deviceInfoHeaderValue(), forHTTPHeaderField: "Device-Info")
        request.httpBody = body
        return request
    }
}

/// `FarmerChatConfig.debugLogging` sink (Android `FcLog` parity): one line per completed request,
/// `[FarmerChat] <METHOD> <path> -> <status> (<ms>ms) rid=<X-Request-ID>`. Path only — no host,
/// query, headers or bodies (they carry tokens and personal data). Off unless the host opts in.
enum NetworkLog {
    private static let lock = NSLock()
    private static var _enabled = false
    static var enabled: Bool {
        get { lock.lock(); defer { lock.unlock() }; return _enabled }
        set { lock.lock(); _enabled = newValue; lock.unlock() }
    }

    private static let logger = Logger(subsystem: "org.digitalgreen.farmerchat", category: "network")

    static func completed(_ request: URLRequest, status: Int?, started: DispatchTime) {
        guard enabled else { return }
        emit(request, outcome: status.map(String.init) ?? "ERR non-HTTP", started: started)
    }

    static func failed(_ request: URLRequest, error: NSError, started: DispatchTime) {
        guard enabled else { return }
        emit(request, outcome: "ERR " + shortReason(error), started: started)
    }

    /// A fixed token, never `localizedDescription` (which can echo the URL).
    static func shortReason(_ error: NSError) -> String {
        guard error.domain == NSURLErrorDomain else { return "error" }
        switch error.code {
        case NSURLErrorTimedOut: return "timeout"
        case NSURLErrorCancelled: return "cancelled"
        case NSURLErrorNotConnectedToInternet, NSURLErrorNetworkConnectionLost: return "offline"
        case NSURLErrorCannotFindHost, NSURLErrorDNSLookupFailed: return "dns"
        case NSURLErrorCannotConnectToHost: return "connect"
        case NSURLErrorSecureConnectionFailed, NSURLErrorServerCertificateUntrusted: return "tls"
        default: return "urlerror \(error.code)"
        }
    }

    /// A non-HTTP diagnostic line (debugLogging only), e.g. what a response decoded to.
    static func note(_ text: String) {
        guard enabled else { return }
        logger.debug("[FarmerChat] \(text, privacy: .public)")
    }

    static func line(_ request: URLRequest, outcome: String, ms: Int) -> String {
        let method = request.httpMethod ?? "GET"
        // percentEncodedPath keeps the trailing slash every endpoint path ends with (`url.path`
        // drops it); no host, no query.
        let path = request.url.flatMap { URLComponents(url: $0, resolvingAgainstBaseURL: true)?.percentEncodedPath } ?? ""
        let rid = request.value(forHTTPHeaderField: "X-Request-ID") ?? "-"
        return "[FarmerChat] \(method) \(path) -> \(outcome) (\(ms)ms) rid=\(rid)"
    }

    private static func emit(_ request: URLRequest, outcome: String, started: DispatchTime) {
        let ms = Int((DispatchTime.now().uptimeNanoseconds - started.uptimeNanoseconds) / 1_000_000)
        let text = line(request, outcome: outcome, ms: ms)
        // The line is already scrubbed to method/path/status/rid, so it is safe to mark public;
        // otherwise os.Logger redacts it to <private> outside a debugger.
        logger.debug("\(text, privacy: .public)")
    }
}
