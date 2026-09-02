import Foundation
import Combine

/// Port of `core/navigation/ErrorNavigationManager`: central one-shot error
/// navigation with per-source retry semantics.
@MainActor
public final class ErrorNavigationManager: ObservableObject {
    public struct ErrorEvent: Sendable, Equatable {
        public var isNetworkError: Bool
        public var fromScreen: String

        public init(isNetworkError: Bool, fromScreen: String) {
            self.isNetworkError = isNetworkError
            self.fromScreen = fromScreen
        }
    }

    /// Buffered one-shot channel equivalent.
    public let errorEvents = PassthroughSubject<ErrorEvent, Never>()
    @Published public private(set) var hasPendingError = false

    private var activeScreen: String = ""
    private var retryAction: (@MainActor () -> Void)?

    public init() {}

    public func setActiveScreen(_ screen: String) {
        activeScreen = screen
    }

    /// Ignores errors raised by a screen that is no longer visible.
    public func navigateToError(isNetworkError: Bool, fromScreen: String, retry: (@MainActor () -> Void)? = nil) {
        guard activeScreen.isEmpty || activeScreen == fromScreen else { return }
        retryAction = retry
        hasPendingError = true
        errorEvents.send(ErrorEvent(isNetworkError: isNetworkError, fromScreen: fromScreen))
    }

    public func retryLastAction() {
        let action = retryAction
        retryAction = nil
        hasPendingError = false
        action?()
    }

    public func clearRetryAction() {
        retryAction = nil
        hasPendingError = false
    }
}
