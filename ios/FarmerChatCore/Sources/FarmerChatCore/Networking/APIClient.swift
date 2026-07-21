import Foundation

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
            do {
                (data, response) = try await session.data(for: request)
            } catch {
                let nsError = error as NSError
                let isTimeout = nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorTimedOut
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
}
