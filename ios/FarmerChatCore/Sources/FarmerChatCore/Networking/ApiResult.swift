import Foundation

/// Result of an API call — port of the app's `ApiResult`.
public enum ApiResult<T: Sendable>: Sendable {
    case success(T)
    case error(ApiError)

    public var value: T? {
        if case .success(let value) = self { return value }
        return nil
    }

    public var error: ApiError? {
        if case .error(let error) = self { return error }
        return nil
    }
}

public struct ApiError: Error, Sendable {
    public let code: Int?
    public let message: String?
    public let apiName: String
    public let errorBody: String?
    public let underlying: (any Error & Sendable)?
    public let isTimeout: Bool

    public init(
        code: Int? = nil,
        message: String? = nil,
        apiName: String,
        errorBody: String? = nil,
        underlying: (any Error & Sendable)? = nil,
        isTimeout: Bool = false
    ) {
        self.code = code
        self.message = message
        self.apiName = apiName
        self.errorBody = errorBody
        self.underlying = underlying
        self.isTimeout = isTimeout
    }

    /// True when the failure is connectivity-shaped (offline / timeout / DNS).
    public var isNetworkError: Bool {
        if isTimeout { return true }
        if code == nil { return true }
        return false
    }
}

/// UI state for view models — port of the app's `UiState` sealed class.
public enum UiState<T: Sendable>: Sendable {
    case idle
    case loading
    case success(T)
    case error(message: String, code: Int?, isNetworkError: Bool)

    public var isLoading: Bool {
        if case .loading = self { return true }
        return false
    }

    public var isSuccess: Bool {
        if case .success = self { return true }
        return false
    }

    public var value: T? {
        if case .success(let value) = self { return value }
        return nil
    }

    public static func from(_ result: ApiResult<T>, fallbackMessage: String) -> UiState<T> {
        switch result {
        case .success(let value):
            return .success(value)
        case .error(let error):
            return .error(
                message: error.message ?? fallbackMessage,
                code: error.code,
                isNetworkError: error.isNetworkError
            )
        }
    }
}

/// Maps HTTP failures to human-readable messages, preferring the backend
/// message extracted from well-known JSON keys — port of `ErrorHandler.fromHttp`.
public enum ErrorHandler {
    static let backendMessageKeys = ["message", "otp", "error", "detail", "msg", "error_message", "description", "non_field_errors"]

    public static func backendMessage(fromBody body: Data?) -> String? {
        guard let body,
              let object = try? JSONSerialization.jsonObject(with: body) as? [String: Any] else {
            return nil
        }
        for key in backendMessageKeys {
            if let value = object[key] as? String, !value.isEmpty {
                return value
            }
            if let values = object[key] as? [Any], let first = values.first as? String, !first.isEmpty {
                return first
            }
        }
        return nil
    }

    public static func message(forStatus status: Int, body: Data?, labels: LabelManager) -> String {
        if let backend = backendMessage(fromBody: body) {
            return backend
        }
        switch status {
        case 400:
            return labels.label("error_bad_request", fallback: "Something went wrong with that request. Please try again.")
        case 401:
            return labels.label("error_unauthorized", fallback: "Your session has expired. Please try again.")
        case 403:
            return labels.label("error_forbidden", fallback: "You don't have permission to do that.")
        case 404:
            return labels.label("error_not_found", fallback: "We couldn't find what you were looking for.")
        case 408:
            return labels.label("error_timeout", fallback: "The request timed out. Please try again.")
        case 429:
            return labels.label("error_too_many_requests", fallback: "Too many attempts. Please wait a moment and try again.")
        case 500...599:
            return labels.label("error_server", fallback: "Our servers are having trouble. Please try again shortly.")
        default:
            return labels.label("error_generic", fallback: "Something went wrong. Please try again.")
        }
    }
}
