import Foundation
import Combine

// MARK: - UDF (port of name/udf/)

public enum UserNameAction: Sendable {
    case updateUserName(body: UserNameRequest)
    case consumeUpdateResult
}

public struct UpdateUserNameState: Sendable {
    public var updateUserNameState: UiState<UserNameResponse> = .idle
    public init() {}
}

/// Name-input sanitization matching the app's `normalizeNameInput`:
/// letters + single spaces only, no leading space, no double spaces.
public enum NameInputNormalizer {
    public static let minLength = 3
    public static let maxLength = 100

    public static func normalize(_ input: String) -> String {
        var result = ""
        var lastWasSpace = true // suppress leading space
        for character in input {
            if character.isLetter {
                result.append(character)
                lastWasSpace = false
            } else if character == " " && !lastWasSpace {
                result.append(character)
                lastWasSpace = true
            }
        }
        return String(result.prefix(maxLength))
    }

    /// Sanitizes placeholder junk names the backend has stored historically.
    public static func sanitizeStored(_ name: String?) -> String {
        guard let name else { return "" }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let junk = ["no name", "null", "none"]
        if junk.contains(trimmed.lowercased()) { return "" }
        return trimmed
    }

    public static func validationError(for name: String, labels: LabelManager) -> String? {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        if trimmed.count < minLength {
            return labels.label("name_too_short", fallback: "Please enter at least 3 characters.")
        }
        if trimmed.count > maxLength {
            return labels.label("name_too_long", fallback: "Name is too long.")
        }
        return nil
    }
}

// MARK: - ViewModel (port of EnterNameViewModel)

@MainActor
public final class EnterNameViewModel: ObservableObject {
    @Published public private(set) var state = UpdateUserNameState()

    private let env: FarmerChat

    public init(env: FarmerChat = .shared) {
        self.env = env
    }

    public func onAction(_ action: UserNameAction, screenName: String) {
        switch action {
        case .updateUserName(let body):
            Task { await updateUserName(body: body, screenName: screenName) }
        case .consumeUpdateResult:
            state.updateUserNameState = .idle
        }
    }

    private func updateUserName(body: UserNameRequest, screenName: String) async {
        state.updateUserNameState = .loading
        let result = await env.api.updateUserProfile(body)
        switch result {
        case .success(let response):
            if let name = body.name {
                env.prefs.setString(name, .userName)
                env.prefs.setBool(true, .userNameAdded)
                env.analytics.track(AnalyticsEvents.nameUpdated, props: ["screen": screenName])
            }
            if let gender = body.gender {
                env.prefs.setString(gender, .userGender)
            }
            state.updateUserNameState = .success(response)
        case .error(let error):
            state.updateUserNameState = .error(
                message: error.message ?? env.labels.label("error_generic", fallback: "Something went wrong. Please try again."),
                code: error.code,
                isNetworkError: error.isNetworkError
            )
        }
    }

    /// Skip path: track + mark `KEY_NAME_DONE` (route decision happens upstream).
    public func skipName() {
        env.analytics.track(AnalyticsEvents.nameSkipped)
        env.prefs.setBool(true, .nameDone)
        env.prefs.setBool(true, .nameScreenSeen)
    }

    /// Save-success path bookkeeping (`KEY_NAME_DONE`, `USER_NAME`, `USER_NAME_ADDED`).
    public func markNameDone() {
        env.prefs.setBool(true, .nameDone)
        env.prefs.setBool(true, .nameScreenSeen)
    }
}
