import Foundation

/// Per-request priority controlling timeout + retry budget.
/// Matches the app's `ApiPriority` (`X-Timeout` header + per-request client clone).
public enum ApiPriority: Sendable {
    /// Onboarding fallback (geolocate): 5 s timeout, 1 retry.
    case p1
    /// Default, no-fallback: 10 s, 2 retries.
    case p2
    /// AI runtime (text prompt, plantix, follow-ups, synthesise, transcribe,
    /// chat history): 30 s, 3 retries.
    case p3

    public var timeoutSeconds: TimeInterval {
        switch self {
        case .p1: return 5
        case .p2: return 10
        case .p3: return 30
        }
    }

    public var maxRetries: Int {
        switch self {
        case .p1: return 1
        case .p2: return 2
        case .p3: return 3
        }
    }
}

/// Retry policy shared by all requests — the exact `executeApiCall` semantics.
enum RetryPolicy {
    /// Retryable HTTP statuses. 400 and 429 are never retried; 401 is the
    /// authenticator's job and is never retried here.
    static let retryableStatusCodes: Set<Int> = [408, 500, 502, 503, 504, 404]

    /// Exponential backoff: `min(500 * 2^attempt, 3000)` ms.
    static func backoffNanoseconds(attempt: Int) -> UInt64 {
        let ms = min(500.0 * pow(2.0, Double(attempt)), 3000.0)
        return UInt64(ms * 1_000_000)
    }

    static func isRetryable(status: Int) -> Bool {
        retryableStatusCodes.contains(status)
    }
}
