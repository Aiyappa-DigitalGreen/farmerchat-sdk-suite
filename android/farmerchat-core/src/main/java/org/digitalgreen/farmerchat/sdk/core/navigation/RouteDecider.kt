package org.digitalgreen.farmerchat.sdk.core.navigation

import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences

/**
 * Pending deep-link/campaign target consumed by routeFromSplash
 * (port of the app's PendingTarget in AppNavigator/OnboardingStore).
 */
sealed interface PendingTarget {
    data class Chat(val chatId: String) : PendingTarget
    data class ChatQuery(
        val question: String,
        val source: String,
        val channel: String? = null,
        val preGeneratedAnswer: String? = null,
        val followUpQuestions: List<String>? = null
    ) : PendingTarget
    data class Gps(val action: String) : PendingTarget
    data object Home : PendingTarget
    /** C4: programmatic FarmerChat.openScreen(...) target. [screen] is a well-known key. */
    data class Screen(val screen: String) : PendingTarget
}

/** Well-known screen keys for [FarmerChat.openScreen] / [PendingTarget.Screen]. */
object FarmerChatScreens {
    const val HOME = "home"
    const val CHAT = "chat"
    const val HISTORY = "chathistory"
    const val SETTINGS = "settings"
    const val HELP = "help"
}

/** Route targets produced by [RouteDecider.routeFromSplash]. */
sealed interface SplashRoute {
    data object Language : SplashRoute
    data object Name : SplashRoute
    data object Home : SplashRoute
    /** Home + trigger the GPS prompt overlay. */
    data class HomeWithGps(val action: String) : SplashRoute
    data class Chat(val target: PendingTarget) : SplashRoute
    /** C4: land on Home then navigate to a well-known [screen]. */
    data class Screen(val screen: String) : SplashRoute
}

/**
 * The routeFromSplash() decision tree (doc 01 §2, AppNavigator):
 *
 * 1. `!isLanguageSelected` → Language
 * 2. `!isProfileDone && !hasSeenNameScreenOnce` →
 *      showNameScreen=false ⇒ markProfileDone + fall through; true ⇒ Name
 * 3. else consume PendingTarget → Chat / ChatQuery / Gps(Home+prompt) / Home
 *
 * All targets navigate with popUpTo(0){inclusive} in the UI layer.
 */
class RouteDecider(
    private val prefs: SdkPreferences,
    /** RemoteConfig `show_name_screen` equivalent; SDK default true. */
    private val showNameScreen: () -> Boolean = { true }
) {

    private var pendingTarget: PendingTarget? = null

    fun savePendingTarget(target: PendingTarget) {
        pendingTarget = target
    }

    fun peekPendingTarget(): PendingTarget? = pendingTarget

    /**
     * Takes the pending target without running the onboarding gates of [routeFromSplash].
     * CHAT_ONLY has no language/name/home screens, so it consumes a deep-link target directly.
     */
    fun consumePendingTarget(): PendingTarget? = pendingTarget.also { pendingTarget = null }

    fun isLanguageSelected(): Boolean =
        prefs.getBoolean(SdkPreferences.Keys.LANGUAGE_DONE, false)

    fun isProfileDone(): Boolean =
        prefs.getBoolean(SdkPreferences.Keys.KEY_NAME_DONE, false)

    fun hasSeenNameScreenOnce(): Boolean =
        prefs.getBoolean(SdkPreferences.Keys.KEY_NAME_SCREEN_SEEN, false)

    fun markProfileDone() {
        prefs.putBoolean(SdkPreferences.Keys.KEY_NAME_DONE, true)
    }

    fun markNameScreenSeen() {
        prefs.putBoolean(SdkPreferences.Keys.KEY_NAME_SCREEN_SEEN, true)
    }

    fun routeFromSplash(): SplashRoute {
        if (!isLanguageSelected()) return SplashRoute.Language

        if (!isProfileDone() && !hasSeenNameScreenOnce()) {
            if (!showNameScreen()) {
                markProfileDone()
                // fall through
            } else {
                return SplashRoute.Name
            }
        }

        val target = pendingTarget
        pendingTarget = null
        return when (target) {
            is PendingTarget.Chat -> SplashRoute.Chat(target)
            is PendingTarget.ChatQuery -> SplashRoute.Chat(target)
            is PendingTarget.Gps -> SplashRoute.HomeWithGps(target.action)
            is PendingTarget.Screen -> SplashRoute.Screen(target.screen)
            is PendingTarget.Home, null -> SplashRoute.Home
        }
    }
}
