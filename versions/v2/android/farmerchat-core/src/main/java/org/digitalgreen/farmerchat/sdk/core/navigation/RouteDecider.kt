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
        val followUpQuestions: List<String>? = null,
        /** Host-supplied photo (content/file URI) sent with [question] on arrival. */
        val imageUri: String? = null,
        /** Host-supplied voice recording (content/file URI) transcribed + asked on arrival. */
        val audioUri: String? = null
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
    /** The in-chat language chooser (the chat toolbar's globe). */
    const val LANGUAGE = "language"
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
    private val showNameScreen: () -> Boolean = { true },
    /**
     * True when the host configured the language (a non-blank `languageCode` or `locale`).
     * Only the CHAT_ONLY first-launch gate ([chatOnlyNeedsLanguage]) reads it.
     */
    private val hostLanguageConfigured: () -> Boolean = { false }
) {

    private var pendingTarget: PendingTarget? = null

    fun savePendingTarget(target: PendingTarget) {
        pendingTarget = target
    }

    fun peekPendingTarget(): PendingTarget? = pendingTarget

    /**
     * Takes the pending target without running the onboarding gates of [routeFromSplash].
     * CHAT_ONLY has no name/home screens (and shows the language screen only on a first launch,
     * see [chatOnlyNeedsLanguage]), so it consumes a deep-link target directly once in chat.
     */
    fun consumePendingTarget(): PendingTarget? = pendingTarget.also { pendingTarget = null }

    fun isLanguageSelected(): Boolean =
        prefs.getBoolean(SdkPreferences.Keys.LANGUAGE_DONE, false)

    /**
     * CHAT_ONLY first-launch gate (2026-10-09): CHAT_ONLY shows the existing language onboarding
     * screen once — when the language step was never completed (LANGUAGE_DONE false) AND the host
     * configured no language (`languageCode` / `locale`). Otherwise CHAT_ONLY goes straight to
     * chat. The pending target is NOT touched here, so it survives the language screen and is
     * honoured when the CHAT_ONLY route runs again after the screen completes.
     *
     * Deliberately separate from [routeFromSplash], whose tree (docs/01 §2) is FULL_JOURNEY's and
     * stays frozen.
     */
    fun chatOnlyNeedsLanguage(): Boolean =
        !isLanguageSelected() && !hostLanguageConfigured()

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
