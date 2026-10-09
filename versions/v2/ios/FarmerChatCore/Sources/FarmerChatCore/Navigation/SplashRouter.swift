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
///
/// CHAT_ONLY (`FarmerChatConfig.mode == .chatOnly`) uses `routeChatOnly` instead: the
/// language screen once on a first launch, otherwise straight to Chat (no Name, no Home).
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

    /// CHAT_ONLY decision (docs/07 C3), used in place of `routeFromSplash` when
    /// `config.mode == .chatOnly`:
    ///
    /// 1. First launch — `LANGUAGE_DONE` false and the host configured no language
    ///    (`languageCode` / `locale` blank) → Language (the existing onboarding screen). Its
    ///    "submitted" callback re-runs the route, which then lands here in step 2. The pending
    ///    chat target is NOT consumed, so it survives the language screen.
    /// 2. Otherwise → Chat, consuming the pending `openChat` target (question / thread).
    ///
    /// CHAT_ONLY never routes to Name or Home.
    @MainActor
    public static func routeChatOnly(env: FarmerChat = .shared) -> SplashRoute {
        if chatOnlyNeedsLanguageScreen(env: env) {
            return .language
        }
        let target = env.consumePendingChatTarget()
        return .chat(question: target?.question, conversationId: target?.conversationId)
    }

    /// True when a CHAT_ONLY journey must show the language onboarding screen before the chat:
    /// language onboarding never finished AND the host did not configure a language. Callers
    /// use it to (a) skip the headless `ensureChatOnlyBootstrap` (the language screen does that
    /// work itself) and (b) keep an `openChat` target pending while that screen is up.
    @MainActor
    public static func chatOnlyNeedsLanguageScreen(env: FarmerChat = .shared) -> Bool {
        chatOnlyNeedsLanguageScreen(prefs: env.prefs, config: env.config)
    }

    static func chatOnlyNeedsLanguageScreen(prefs: PreferenceStore, config: FarmerChatConfig) -> Bool {
        guard config.mode == .chatOnly else { return false }
        if prefs.bool(.languageDone) { return false }
        // Same fields ensureChatOnlyBootstrap reads as the host-configured language.
        let hostLanguageConfigured = config.locale?.nonBlank != nil || config.languageCode?.nonBlank != nil
        return !hostLanguageConfigured
    }
}
