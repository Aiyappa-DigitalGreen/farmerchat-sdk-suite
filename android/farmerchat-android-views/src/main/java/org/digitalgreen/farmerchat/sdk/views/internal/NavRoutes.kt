package org.digitalgreen.farmerchat.sdk.views.internal

import android.os.Bundle
import androidx.core.os.bundleOf
import androidx.navigation.NavController
import androidx.navigation.NavOptions
import org.digitalgreen.farmerchat.sdk.core.navigation.PendingTarget
import org.digitalgreen.farmerchat.sdk.core.navigation.SplashRoute
import org.digitalgreen.farmerchat.sdk.views.R

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
     * C3 CHAT_ONLY: skip onboarding/home and land directly in a fresh chat,
     * clearing the whole back stack (mirrors Compose FarmerChatRoot).
     */
    fun navigateChatOnly(navController: NavController) {
        navController.navigate(
            R.id.fc_dest_chat,
            chatArgs(source = "chat_only"),
            clearStackOptions(navController)
        )
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
        channel: String? = null
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
        "channel" to channel
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
