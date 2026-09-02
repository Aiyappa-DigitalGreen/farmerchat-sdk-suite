import Foundation

/// The `routeFromSplash()` decision tree (doc 01 §2), shared by both UI
/// packages so SwiftUI and UIKit route identically:
///
/// 1. `!isLanguageSelected` → Language
/// 2. `!isProfileDone && !hasSeenNameScreenOnce` → Name
///    (the app additionally consults RemoteConfig `show_name_screen`; the SDK
///    has no Firebase — see docs/05-open-questions.md — so the name screen is
///    shown unless already done/seen)
/// 3. else consume PendingTarget → Chat / Home
public enum SplashRoute: Equatable, Sendable {
    case language
    case name
    case chat(question: String?, conversationId: String?)
    case home
}

public enum SplashRouter {
    @MainActor
    public static func routeFromSplash(env: FarmerChat = .shared) -> SplashRoute {
        let prefs = env.prefs

        // 1. Language onboarding not finished.
        if !prefs.bool(.languageDone) {
            return .language
        }

        // 2. Name step (unless done or already seen once).
        let profileDone = prefs.bool(.nameDone)
        let seenNameScreen = prefs.bool(.nameScreenSeen)
        if !profileDone && !seenNameScreen {
            return .name
        }

        // 3. Pending deep-link target (FarmerChat.openChat).
        if let target = env.consumePendingChatTarget() {
            if target.question != nil || target.conversationId != nil {
                return .chat(question: target.question, conversationId: target.conversationId)
            }
        }
        return .home
    }
}
