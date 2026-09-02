import Foundation
import Combine

/// Port of `UserProfileViewModel` (used by Settings + EnterName; no screen).
@MainActor
public final class UserProfileViewModel: ObservableObject {
    @Published public private(set) var profileState: UiState<FarmerProfile> = .idle

    private let env: FarmerChat

    public init(env: FarmerChat = .shared) {
        self.env = env
    }

    public func fetchProfile(fromScreen: String) {
        guard let userId = env.session.userId, !profileState.isLoading else { return }
        profileState = .loading
        Task {
            let result = await env.api.viewUserProfile(id: userId)
            switch result {
            case .success(let profile):
                // Clears/saves USER_NAME like the app.
                if let name = profile.userProfile?.displayName {
                    env.prefs.setString(name, .userName)
                } else {
                    env.prefs.setString(nil, .userName)
                }
                profileState = .success(profile)
            case .error(let error):
                profileState = .error(
                    message: error.message ?? env.labels.label("error_generic", fallback: "Something went wrong. Please try again."),
                    code: error.code,
                    isNetworkError: error.isNetworkError
                )
            }
        }
    }

    public func consume() {
        profileState = .idle
    }
}
