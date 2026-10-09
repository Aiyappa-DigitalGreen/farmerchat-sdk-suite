package org.digitalgreen.farmerchat.sdk.views.internal

import android.os.Bundle
import androidx.core.os.bundleOf
import androidx.fragment.app.Fragment
import androidx.navigation.NavController
import androidx.navigation.fragment.findNavController
import androidx.navigation.NavOptions
import org.digitalgreen.farmerchat.sdk.core.navigation.PendingTarget
import org.digitalgreen.farmerchat.sdk.core.navigation.SplashRoute
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.FarmerChatMode

/** Navigation helpers implementing the app's popUpTo back-stack semantics (doc 01 §2). */
internal object NavRoutes {

    const val FOLLOW_UP_SEPARATOR = "||"

    /** popUpTo(0){inclusive} equivalent: clear the whole back stack. */
    fun clearStackOptions(navController: NavController): NavOptions =
        NavOptions.Builder()
            .setLaunchSingleTop(true)
            .setPopUpTo(navController.graph.id, inclusive = true)
            .build()

    fun singleTop(): NavOptions =
        NavOptions.Builder().setLaunchSingleTop(true).build()

    /**
     * C3 CHAT_ONLY entry, shared by the splash and the first-launch language screen: start a
     * fresh journey (new conversation unless a history thread is pending), run the headless
     * guest/labels/conversation bootstrap, then [navigateChatOnly] with the pending target.
     * [beforeNavigate] runs just before navigating (the splash's minimum-duration floor).
     *
     * Never call it while [org.digitalgreen.farmerchat.sdk.core.navigation.RouteDecider.chatOnlyNeedsLanguage]
     * is true — the language screen must run first and does that bootstrap work itself.
     */
    suspend fun enterChatOnly(navController: NavController, beforeNavigate: suspend () -> Unit = {}) {
        val graph = FarmerChat.requireGraph()
        // Each fresh journey = a new conversation (the app's per-Home-entry rule).
        graph.beginChatOnlyJourney()
        // Guest session + conversation bootstrap (shared with android-compose).
        graph.ensureChatOnlySession()
        beforeNavigate()
        navigateChatOnly(navController, graph.routeDecider.consumePendingTarget())
    }

    /**
     * C3 CHAT_ONLY: skip name/home and land directly in a fresh chat,
     * clearing the whole back stack (mirrors Compose FarmerChatRoot). The first-launch language
     * screen, when it shows, comes before this ([enterChatOnly]).
     */
    fun navigateChatOnly(navController: NavController, target: PendingTarget? = null) {
        // A screen the HOST asked for (FarmerChatLaunch.screen / openScreen) is the journey's
        // root, marked [ARG_EXIT_TO_HOST]: Back from it returns to the host screen that opened
        // it (e.g. the host's settings or menu), not into a chat the farmer never opened.
        if (target is PendingTarget.Screen) {
            val dest = screenDestination(target.screen)
            if (dest != null) {
                navController.navigate(dest, bundleOf(ARG_EXIT_TO_HOST to true), clearStackOptions(navController))
                return
            }
        }
        val args = when (target) {
            // "history" is what makes ChatFragment load the thread; with the drawer off its
            // back control pops, finds nothing beneath, and exits to the host.
            is PendingTarget.Chat -> chatArgs(source = "history", conversationId = target.chatId)
            is PendingTarget.ChatQuery -> chatArgs(
                source = "chat_only",
                question = target.question,
                channel = target.channel,
                preGeneratedAnswer = target.preGeneratedAnswer,
                followUpQuestions = target.followUpQuestions,
                imageUri = target.imageUri,
                audioUri = target.audioUri
            )
            else -> chatArgs(source = "chat_only")
        }
        navController.navigate(R.id.fc_dest_chat, args, clearStackOptions(navController))
    }

    /** Arg on a host-requested root screen: leaving it leaves the journey (see navigateChatOnly). */
    const val ARG_EXIT_TO_HOST = "fc_exit_to_host"

    private fun screenDestination(screen: String): Int? = when (screen) {
        org.digitalgreen.farmerchat.sdk.core.navigation.FarmerChatScreens.HISTORY -> R.id.fc_dest_chat_history
        org.digitalgreen.farmerchat.sdk.core.navigation.FarmerChatScreens.HELP -> R.id.fc_dest_help
        org.digitalgreen.farmerchat.sdk.core.navigation.FarmerChatScreens.LANGUAGE -> R.id.fc_dest_settings_language
        org.digitalgreen.farmerchat.sdk.core.navigation.FarmerChatScreens.SETTINGS -> R.id.fc_dest_settings
        else -> null
    }

    /**
     * Leave a secondary screen (chat history, language chooser): back to the host when the host
     * opened it directly ([ARG_EXIT_TO_HOST]), else Home — or the chat in CHAT_ONLY.
     */
    fun leaveSecondaryScreen(fragment: Fragment) {
        val nav = fragment.findNavController()
        when {
            // Opened over an existing screen (the chat's toolbar): go back to THAT screen, state
            // intact, instead of rebuilding a fresh one.
            nav.previousBackStackEntry != null -> nav.popBackStack()
            fragment.arguments?.getBoolean(ARG_EXIT_TO_HOST) == true ->
                fragment.journeyHost()?.exitJourney() ?: fragment.requireActivity().finish()
            else -> navigateHomeOrChat(nav)
        }
    }

    /**
     * Where a secondary screen (language chooser, chat history) returns to.
     *
     * Normally Home. In CHAT_ONLY there IS no Home — it is deliberately hidden — so returning
     * there would dump the user on a dashboard the host switched off. Goes back to the chat
     * instead, which is the only surface CHAT_ONLY exposes.
     *
     * Home is hidden, never removed: flip the mode back to FULL_JOURNEY and this returns to
     * Home exactly as before.
     */
    fun navigateHomeOrChat(navController: NavController) {
        if (FarmerChat.requireGraph().config.mode == FarmerChatMode.CHAT_ONLY) {
            navController.navigate(
                R.id.fc_dest_chat,
                chatArgs(source = "chat_only"),
                clearStackOptions(navController)
            )
        } else {
            navController.navigate(
                R.id.fc_dest_home, null, clearStackOptions(navController)
            )
        }
    }

    /** Drawer routes: popUpTo(startDestinationId), singleTop. */
    fun drawerOptions(navController: NavController): NavOptions =
        NavOptions.Builder()
            .setLaunchSingleTop(true)
            .setPopUpTo(navController.graph.startDestinationId, inclusive = false)
            .build()

    fun chatArgs(
        source: String = "home",
        question: String? = null,
        conversationId: String? = null,
        imageUri: String? = null,
        transcriptionId: String? = null,
        audioUri: String? = null,
        statementId: Int = -1,
        homeStatementId: String? = null,
        preGeneratedAnswer: String? = null,
        followUpQuestions: List<String>? = null,
        isWeatherAdviceCTA: Boolean = false,
        isSSFR: Boolean = false,
        ssfrCrop: String? = null,
        channel: String? = null,
        /**
         * AGENTIC content-card tap: the card artwork, shown as a DISPLAY-ONLY banner on the user
         * bubble. Kept separate from [imageUri] on purpose — that one routes the query through
         * image analysis (#28), which this path must not do.
         */
        contentCardImageUrl: String? = null,
        /** AGENTIC content-card tap: "image_card" / "text_card" → triggered_input_type + click_type. */
        contentCardTriggerType: String? = null
    ): Bundle = bundleOf(
        "source" to source,
        "question" to question,
        "conversationId" to conversationId,
        "imageUri" to imageUri,
        "transcriptionId" to transcriptionId,
        "audioUri" to audioUri,
        "statementId" to statementId,
        "homeStatementId" to homeStatementId,
        "preGeneratedAnswer" to preGeneratedAnswer,
        "followUpQuestions" to followUpQuestions?.joinToString(FOLLOW_UP_SEPARATOR),
        "isWeatherAdviceCTA" to isWeatherAdviceCTA,
        "isSSFR" to isSSFR,
        "ssfrCrop" to ssfrCrop,
        "channel" to channel,
        "contentCardImageUrl" to contentCardImageUrl,
        "contentCardTriggerType" to contentCardTriggerType
    )

    fun errorArgs(isNetworkError: Boolean, fromScreen: String): Bundle = bundleOf(
        "isNetworkError" to isNetworkError,
        "fromScreen" to fromScreen
    )

    fun legalArgs(url: String, title: String): Bundle = bundleOf(
        "url" to url,
        "title" to title
    )

    /**
     * routeFromSplash() navigation: all targets clear the back stack; pending chat
     * targets land on Home first so Chat close pops back to Home.
     */
    fun navigateFromSplash(navController: NavController, route: SplashRoute, onGpsAction: ((String) -> Unit)? = null) {
        when (route) {
            is SplashRoute.Language ->
                navController.navigate(R.id.fc_dest_language, null, clearStackOptions(navController))
            is SplashRoute.Name ->
                navController.navigate(R.id.fc_dest_name, null, clearStackOptions(navController))
            is SplashRoute.Home ->
                navController.navigate(R.id.fc_dest_home, null, clearStackOptions(navController))
            is SplashRoute.HomeWithGps -> {
                navController.navigate(R.id.fc_dest_home, null, clearStackOptions(navController))
                onGpsAction?.invoke(route.action)
            }
            is SplashRoute.Chat -> {
                navController.navigate(R.id.fc_dest_home, null, clearStackOptions(navController))
                when (val target = route.target) {
                    is PendingTarget.Chat -> navController.navigate(
                        R.id.fc_dest_chat,
                        chatArgs(source = "history", conversationId = target.chatId)
                    )
                    is PendingTarget.ChatQuery -> navController.navigate(
                        R.id.fc_dest_chat,
                        chatArgs(
                            source = target.source,
                            question = target.question,
                            channel = target.channel,
                            preGeneratedAnswer = target.preGeneratedAnswer,
                            followUpQuestions = target.followUpQuestions
                        )
                    )
                    else -> Unit
                }
            }
            is SplashRoute.Screen -> {
                // C4 openScreen: land on Home, then route to the well-known screen.
                navController.navigate(R.id.fc_dest_home, null, clearStackOptions(navController))
                when (route.screen) {
                    org.digitalgreen.farmerchat.sdk.core.navigation.FarmerChatScreens.SETTINGS ->
                        navController.navigate(R.id.fc_dest_settings)
                    org.digitalgreen.farmerchat.sdk.core.navigation.FarmerChatScreens.HISTORY ->
                        navController.navigate(R.id.fc_dest_chat_history)
                    org.digitalgreen.farmerchat.sdk.core.navigation.FarmerChatScreens.HELP ->
                        navController.navigate(R.id.fc_dest_help)
                    org.digitalgreen.farmerchat.sdk.core.navigation.FarmerChatScreens.LANGUAGE ->
                        navController.navigate(R.id.fc_dest_settings_language)
                    else -> Unit
                }
            }
        }
    }

    /** Chat close (Home entry): back to Home — popUpTo(Home){!inclusive}, singleTop. */
    fun navigateChatClose(navController: NavController) {
        val popped = navController.popBackStack(R.id.fc_dest_home, false)
        if (!popped) {
            navController.navigate(
                R.id.fc_dest_home,
                null,
                NavOptions.Builder()
                    .setLaunchSingleTop(true)
                    .setPopUpTo(navController.graph.id, inclusive = true)
                    .build()
            )
        }
    }
}
