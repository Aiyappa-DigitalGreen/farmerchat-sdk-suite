import Foundation

/// The `routeFromSplash()` decision tree (doc 01 §2), shared by both UI
/// packages so SwiftUI and UIKit route identically:
///
/// 1. `!isLanguageSelected` → Language
/// 2. `!isProfileDone && !hasSeenNameScreenOnce` → Name, unless
///    `FarmerChatConfig.showNameScreen` is false, which stands in for the app's
///    `show_name_screen` RemoteConfig flag (the SDK has no Firebase). When it is
///    false the profile is marked done and the step is skipped — matching
///    Android `RouteDecider.routeFromSplash`.
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
            if env.config.showNameScreen {
                return .name
            }
            // Host suppressed the step: mark the profile done and fall through, so a later
            // launch does not re-evaluate it. Android does the same in RouteDecider:90.
            prefs.setBool(true, .nameDone)
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
