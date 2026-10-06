package org.digitalgreen.farmerchat.sdk.compose

import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavController
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.dialog
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.components.AppDrawer
import org.digitalgreen.farmerchat.sdk.compose.components.DrawerRoutes
import org.digitalgreen.farmerchat.sdk.compose.components.Toast
import org.digitalgreen.farmerchat.sdk.compose.components.ToastState
import org.digitalgreen.farmerchat.sdk.compose.components.rememberToastState
import org.digitalgreen.farmerchat.sdk.compose.navigation.Destination
import org.digitalgreen.farmerchat.sdk.compose.screens.AccountBenefitsScreen
import org.digitalgreen.farmerchat.sdk.compose.screens.AccountSuccessScreen
import org.digitalgreen.farmerchat.sdk.compose.screens.AuthScreen
import org.digitalgreen.farmerchat.sdk.compose.screens.ChatHistoryScreen
import org.digitalgreen.farmerchat.sdk.compose.screens.ChatScreen
import org.digitalgreen.farmerchat.sdk.compose.screens.EnterNameScreen
import org.digitalgreen.farmerchat.sdk.compose.screens.ErrorScreen
import org.digitalgreen.farmerchat.sdk.compose.screens.ErrorType
import org.digitalgreen.farmerchat.sdk.compose.screens.HelpScreen
import org.digitalgreen.farmerchat.sdk.compose.screens.HomeScreen
import org.digitalgreen.farmerchat.sdk.compose.screens.LanguageChooserScreen
import org.digitalgreen.farmerchat.sdk.compose.screens.LanguageScreen
import org.digitalgreen.farmerchat.sdk.compose.screens.LegalContentScreen
import org.digitalgreen.farmerchat.sdk.compose.screens.LocationPromptHost
import org.digitalgreen.farmerchat.sdk.compose.screens.SettingsNameScreen
import org.digitalgreen.farmerchat.sdk.compose.screens.SettingsScreen
import org.digitalgreen.farmerchat.sdk.compose.screens.SplashScreen
import org.digitalgreen.farmerchat.sdk.compose.util.FcInsetTrim
import org.digitalgreen.farmerchat.sdk.compose.util.isNetworkAvailable
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.compose.vm.rememberCoreViewModel
import android.app.Activity
import org.digitalgreen.farmerchat.sdk.core.base.ApiResult
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.navigation.PendingTarget
import org.digitalgreen.farmerchat.sdk.core.navigation.SplashRoute
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.history.ChatHistoryViewModel
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptEvent

/**
 * 2.0.0: extra screen key accepted by `FarmerChat.openScreen(context, screen)` — lands on Home
 * and opens the in-app Terms-of-Use dialog (`TermsOfUseDialog`), the SDK's stand-in for the app's
 * Plotline `open_terms_of_use=true` card CTA. Not in
 * [org.digitalgreen.farmerchat.sdk.core.navigation.FarmerChatScreens] because that object lives
 * in farmerchat-core; it belongs there so android-views can honour the same key.
 */
private const val SCREEN_TERMS_OF_USE = "termsofuse"

/**
 * The complete FarmerChat journey as a drop-in composable: nav graph per
 * doc 01 §2 (all popUpTo semantics), shared AppDrawer, global error routing,
 * LocationPromptHost overlay and global toast.
 *
 * FarmerChat.initialize(...) must have been called before composing this.
 */
@Composable
fun FarmerChatRoot(
    modifier: Modifier = Modifier,
    onAppearanceModeChanged: (String) -> Unit = {},
    onLanguageChanged: (String) -> Unit = {},
    newIntentTick: Int = 0,
    /**
     * True when the activity is being RECREATED (non-null savedInstanceState) rather than cold
     * started — which is what happens after Android kills the app for a permission change made
     * in system Settings. Routes back to the farmer's last screen instead of re-deciding.
     */
    isRecreated: Boolean = false
) {
    val graph = FarmerChat.requireGraph()
    val context = LocalContext.current
    val navController = rememberNavController()
    val scope = rememberCoroutineScope()
    val globalToast = rememberToastState()

    // Shared across the drawer + ChatHistory screen (activity-scoped).
    val chatHistoryVm: ChatHistoryViewModel =
        rememberCoreViewModel("sharedChatHistory") { graph.chatHistoryViewModel() }
    val historyState by chatHistoryVm.state.collectAsState()

    // Graph-level drawer state.
    var isAuthenticated by remember {
        mutableStateOf(graph.prefs.getBoolean(SdkPreferences.Keys.OTP_VERIFIED, false))
    }
    var drawerLanguageDisplay by remember {
        mutableStateOf(
            graph.prefs.getString(SdkPreferences.Keys.SELECTED_LANGUAGE_DISPLAY_NAME, "English")
                .ifBlank { "English" }
        )
    }
    var showNameUpdatedToast by remember { mutableStateOf(false) }
    var currentRouteId by remember { mutableStateOf("splash") }

    // When the splash first became visible. The minimum-splash floor is measured from here so it
    // covers the session bootstrap too, rather than being added on top of it.
    val splashStartedAt = remember { android.os.SystemClock.elapsedRealtime() }

    /** Holds the splash until `config.minSplashDurationMs` have passed. A floor, not an added delay. */
    suspend fun holdSplash() {
        val elapsed = android.os.SystemClock.elapsedRealtime() - splashStartedAt
        val remaining = graph.config.minSplashDurationMs - elapsed
        if (remaining > 0) kotlinx.coroutines.delay(remaining)
    }

    // 2.0.0 in-app Terms-of-Use dialog. The app opens it from a Plotline card CTA
    // (`open_terms_of_use=true` → `PlotlineHomeEvents.openTermsOfUse`, MainActivity.kt:600). The
    // SDK carries no Plotline (root CLAUDE.md §6), so the request comes from the host through the
    // EXISTING public entry point — `FarmerChat.openScreen(context, "termsofuse")` — which lands on
    // Home and then raises this flag, exactly the app's "navigate Home + open Terms dialog".
    // Deliberately not a new public API: `FarmerChatScreens` lives in core (off-limits here), so
    // the key is a compose-module literal until core can host the constant. Reported as a gap.
    var termsOfUseRequested by remember { mutableStateOf(false) }
    // True when the host opened the journey directly on a screen (openScreen) — see leaveSecondaryScreen.
    var screenOpenedByHost by rememberSaveable { mutableStateOf(false) }

    // ------------------------------------------------------------------ navigation helpers

    fun navigateClearingStack(destination: Destination) {
        navController.navigate(destination) {
            popUpTo(0) { inclusive = true }
            launchSingleTop = true
        }
    }

    /**
     * The destination to restore after a process death, or null when there is nothing worth
     * restoring and the normal splash decision should run.
     *
     * Chat only resumes when there is a conversation to reopen; a thread that never got an id
     * cannot be restored, and dropping the farmer into an empty chat would be worse than Home.
     */
    fun resumeDestination(): Destination? {
        return when (graph.prefs.getString(SdkPreferences.Keys.RESUME_SCREEN, "")) {
            DrawerRoutes.CHAT -> {
                val conversationId = graph.prefs
                    .getString(SdkPreferences.Keys.NEW_CONVERSATION_ID, "")
                    .ifBlank { null }
                conversationId?.let {
                    Destination.Chat(source = "resume", conversationId = it)
                }
            }
            DrawerRoutes.CHAT_HISTORY -> Destination.ChatHistory
            DrawerRoutes.SETTINGS -> Destination.Settings
            DrawerRoutes.SETTINGS_LANGUAGE -> Destination.SettingsLanguage
            DrawerRoutes.HELP -> Destination.Help
            DrawerRoutes.HOME -> Destination.Home
            else -> null
        }
    }

    fun navigateFromSplash() {
        // C3: CHAT_ONLY skips onboarding/home and lands directly in a fresh chat.
        // Onboarding is normally where the guest session is established, so in
        // CHAT_ONLY we must guest-init here (idempotent) before entering chat —
        // otherwise the first authed call 401s ("Authorization credentials were
        // not provided"). Best-effort: navigate even if init fails (chat shows
        // its own retry); the splash stays up until this completes.
        val chatOnlyPending = graph.routeDecider.peekPendingTarget()
        if (graph.config.mode == org.digitalgreen.farmerchat.sdk.FarmerChatMode.CHAT_ONLY &&
            (chatOnlyPending == null ||
                chatOnlyPending is org.digitalgreen.farmerchat.sdk.core.navigation.PendingTarget.Screen)
        ) {
            scope.launch {
                // Each fresh journey = a new conversation (the app's per-Home-entry rule).
                graph.beginChatOnlyJourney()
                // Guest session + conversation bootstrap (shared with android-views).
                graph.ensureChatOnlySession()
                holdSplash()
                // A screen the HOST asked for (openScreen) is the journey's root: leaving it returns
                // to the host screen that opened it, not into a chat (views parity).
                val screen = (graph.routeDecider.consumePendingTarget()
                    as? org.digitalgreen.farmerchat.sdk.core.navigation.PendingTarget.Screen)?.screen
                val screenDestination: Destination? = when (screen) {
                    org.digitalgreen.farmerchat.sdk.core.navigation.FarmerChatScreens.HISTORY -> Destination.ChatHistory
                    org.digitalgreen.farmerchat.sdk.core.navigation.FarmerChatScreens.HELP -> Destination.Help
                    org.digitalgreen.farmerchat.sdk.core.navigation.FarmerChatScreens.LANGUAGE -> Destination.SettingsLanguage
                    org.digitalgreen.farmerchat.sdk.core.navigation.FarmerChatScreens.SETTINGS -> Destination.Settings
                    else -> null
                }
                if (screenDestination != null) {
                    screenOpenedByHost = true
                    navigateClearingStack(screenDestination)
                } else {
                    navigateClearingStack(Destination.Chat(source = "chat_only"))
                }
            }
            return
        }
        // If the language SCREEN was skipped (config.locale), run its API work headlessly
        // before routing so Home opens with real server labels instead of English fallbacks.
        // No-ops once labels exist, so a returning user routes immediately.
        scope.launch {
        graph.ensureSkippedOnboardingBootstrap()
        holdSplash()

        // A recreation after process death resumes where the farmer was, UNLESS a deep link is
        // pending — an explicit openChat/openScreen target must still win. routeFromSplash()'s
        // decision tree (docs/01 §2) is deliberately NOT touched here: this returns early
        // before it, so the frozen tree still governs every genuine cold start.
        if (isRecreated && graph.routeDecider.peekPendingTarget() == null) {
            val resumed = resumeDestination()
            if (resumed != null) {
                navigateClearingStack(resumed)
                return@launch
            }
        }

        when (val route = graph.routeDecider.routeFromSplash()) {
            is SplashRoute.Language -> navigateClearingStack(Destination.Language)
            is SplashRoute.Screen -> {
                navigateClearingStack(Destination.Home)
                when (route.screen) {
                    org.digitalgreen.farmerchat.sdk.core.navigation.FarmerChatScreens.SETTINGS ->
                        navController.navigate(Destination.Settings) { launchSingleTop = true }
                    org.digitalgreen.farmerchat.sdk.core.navigation.FarmerChatScreens.HISTORY ->
                        navController.navigate(Destination.ChatHistory) { launchSingleTop = true }
                    org.digitalgreen.farmerchat.sdk.core.navigation.FarmerChatScreens.HELP ->
                        navController.navigate(Destination.Help) { launchSingleTop = true }
                    org.digitalgreen.farmerchat.sdk.core.navigation.FarmerChatScreens.LANGUAGE ->
                        navController.navigate(Destination.SettingsLanguage) { launchSingleTop = true }
                    SCREEN_TERMS_OF_USE -> termsOfUseRequested = true
                    else -> { /* Home already shown */ }
                }
            }
            is SplashRoute.Name -> navigateClearingStack(Destination.Name)
            is SplashRoute.Home -> navigateClearingStack(Destination.Home)
            is SplashRoute.HomeWithGps -> {
                navigateClearingStack(Destination.Home)
                // App parity (AppNavigator.kt:66-75): a GPS deep link lands on Home and runs the
                // CAMPAIGN flow (no interstitial, Home's "Getting your location" spinner), tagged
                // "plotline" because the real source is unknown here.
                graph.locationPromptManager.triggerFromCampaign(
                    org.digitalgreen.farmerchat.sdk.core.ui.location.LocationCampaignConfig(
                        campaignId = route.action.substringBefore("?"),
                        triggerSource = "plotline"
                    )
                )
            }
            is SplashRoute.Chat -> {
                when (val target = route.target) {
                    is PendingTarget.Chat -> navigateClearingStack(
                        Destination.Chat(source = "history", conversationId = target.chatId)
                    )
                    is PendingTarget.ChatQuery -> navigateClearingStack(
                        Destination.Chat(
                            source = target.source,
                            question = target.question,
                            preGeneratedAnswer = target.preGeneratedAnswer,
                            followUpQuestions = target.followUpQuestions ?: emptyList(),
                            channel = target.channel
                        )
                    )
                    else -> navigateClearingStack(Destination.Home)
                }
            }
        }
        }
    }

    fun navigateDrawerRoute(route: String) {
        val destination: Destination = when (route) {
            DrawerRoutes.HOME -> Destination.Home
            DrawerRoutes.SETTINGS -> Destination.Settings
            DrawerRoutes.SETTINGS_LANGUAGE -> Destination.SettingsLanguage
            DrawerRoutes.HELP -> Destination.Help
            DrawerRoutes.CHAT_HISTORY -> Destination.ChatHistory
            else -> Destination.Home
        }
        navController.navigate(destination) {
            popUpTo(navController.graph.findStartDestination().id)
            launchSingleTop = true
        }
    }

    /**
     * Where "done" leads after a full-screen settings action.
     *
     * CHAT_ONLY hides Home entirely, so clearing the stack to Home would strand the farmer on a
     * screen the host switched off. Port of the views `NavRoutes.navigateHomeOrChat`.
     */
    fun navigateHomeOrChat() {
        val target = if (graph.config.mode == org.digitalgreen.farmerchat.sdk.FarmerChatMode.CHAT_ONLY) {
            Destination.Chat(source = "chat_only")
        } else {
            Destination.Home
        }
        // Reuse the proven helper: `popUpTo(0) { inclusive = true }`. Hand-rolling
        // `popUpTo(graph.startDestinationId)` here silently did nothing — the language save
        // completed (API 200, `languageSubmitSuccess` set) and the farmer stayed on the language
        // screen with no toast and no way to tell it had worked.
        navigateClearingStack(target)
    }

    /**
     * Leave a secondary screen (history, language): back to the host when the host opened it
     * as the root ([screenOpenedByHost], nothing beneath), else [navigateHomeOrChat].
     */
    fun leaveSecondaryScreen() {
        when {
            // Opened over an existing screen (the chat's toolbar): back to THAT screen, state
            // intact, instead of rebuilding a fresh one (views parity).
            navController.previousBackStackEntry != null -> navController.popBackStack()
            screenOpenedByHost -> (context as? Activity)?.finish()
            else -> navigateHomeOrChat()
        }
    }

    fun onSeeAllClick() {
        if (!isNetworkAvailable(context)) {
            navController.navigate(Destination.Error(isNetworkError = true, fromScreen = "chathistory")) {
                launchSingleTop = true
            }
        } else {
            navController.navigate(Destination.ChatHistory) { launchSingleTop = true }
        }
    }

    /** getUserQuestionCount → bypass_interstitial ? Auth : AccountBenefits (doc 01 §2). */
    fun handleSignUpClick() {
        scope.launch {
            var target: Destination = Destination.AccountBenefits
            runCatching {
                graph.homeUseCase.getUserQuestionCount().collect { result ->
                    if (result is ApiResult.Success && result.data.bypass_interstitial) {
                        target = Destination.Auth
                    }
                }
            }
            if (target == Destination.Auth && !isNetworkAvailable(context)) {
                target = Destination.AccountBenefits
            }
            navController.navigate(target)
        }
    }

    fun handleLogout() {
        FarmerChat.logout {
            navigateClearingStack(Destination.Splash)
        }
    }

    fun openChatFromDrawer(conversationId: String) {
        navController.navigate(
            Destination.Chat(source = "history", conversationId = conversationId)
        )
    }

    // ------------------------------------------------------------------ graph-level effects

    // One-shot error events → Error screen (singleTop).
    LaunchedEffect(Unit) {
        graph.errorNavigationManager.errorEvents.collect { event ->
            navController.navigate(
                Destination.Error(
                    isNetworkError = event.isNetworkError,
                    fromScreen = event.fromScreen
                )
            ) {
                launchSingleTop = true
            }
        }
    }

    // Refresh history when auth flips to true.
    LaunchedEffect(isAuthenticated) {
        if (isAuthenticated) {
            chatHistoryVm.refresh()
        }
    }

    // Location updated from a campaign source → toast + home refresh semantics.
    LaunchedEffect(Unit) {
        graph.locationPromptManager.events.collect { event ->
            if (event is LocationPromptEvent.LocationUpdatedFromWidget) {
                globalToast.show(
                    label(Labels.LOCATION_UPDATED, "Location updated"),
                    ToastState.Success
                )
            }
        }
    }

    // Destination change listener: active screen tracking + drawer re-sync.
    DisposableEffect(navController) {
        val listener = NavController.OnDestinationChangedListener { _, destination, _ ->
            val screenId = when {
                destination.hasRoute<Destination.Splash>() -> "splash"
                destination.hasRoute<Destination.Language>() -> "language"
                destination.hasRoute<Destination.Name>() -> "name"
                destination.hasRoute<Destination.Home>() -> "home"
                destination.hasRoute<Destination.Chat>() -> "chat"
                destination.hasRoute<Destination.Settings>() -> "settings"
                destination.hasRoute<Destination.SettingsName>() -> "settings"
                destination.hasRoute<Destination.SettingsLanguage>() -> "settings"
                destination.hasRoute<Destination.Help>() -> "help"
                destination.hasRoute<Destination.ChatHistory>() -> "chathistory"
                destination.hasRoute<Destination.Auth>() -> "auth"
                destination.hasRoute<Destination.AccountBenefits>() -> "auth"
                destination.hasRoute<Destination.AccountSuccess>() -> "auth"
                destination.hasRoute<Destination.Error>() -> "error"
                else -> ""
            }
            graph.errorNavigationManager.setActiveScreen(screenId)

            // Re-sync drawer language / auth from prefs (app parity).
            isAuthenticated = graph.prefs.getBoolean(SdkPreferences.Keys.OTP_VERIFIED, false)
            graph.sessionManager.refreshAuthState()
            drawerLanguageDisplay = graph.prefs
                .getString(SdkPreferences.Keys.SELECTED_LANGUAGE_DISPLAY_NAME, "English")
                .ifBlank { "English" }
            onLanguageChanged(
                graph.prefs.getString(SdkPreferences.Keys.SELECTED_LANGUAGE_CODE, "en").ifBlank { "en" }
            )

            currentRouteId = when {
                destination.hasRoute<Destination.Home>() -> DrawerRoutes.HOME
                destination.hasRoute<Destination.Chat>() -> DrawerRoutes.CHAT
                destination.hasRoute<Destination.Settings>() -> DrawerRoutes.SETTINGS
                destination.hasRoute<Destination.SettingsLanguage>() -> DrawerRoutes.SETTINGS_LANGUAGE
                destination.hasRoute<Destination.Help>() -> DrawerRoutes.HELP
                destination.hasRoute<Destination.ChatHistory>() -> DrawerRoutes.CHAT_HISTORY
                else -> ""
            }

            // Remember where the farmer is so a process death can put them back.
            //
            // Toggling a runtime permission in system Settings — which the SDK asks a farmer to
            // do for the microphone — makes Android kill the app. The activity is recreated with
            // the nav graph back at Splash, and `routeFromSplash()` re-decides from prefs, which
            // knows nothing about the thread they were reading. Only post-onboarding screens are
            // recorded; splash/language/name must always re-run their own decision.
            if (currentRouteId.isNotBlank()) {
                graph.prefs.putString(SdkPreferences.Keys.RESUME_SCREEN, currentRouteId)
            }
        }
        navController.addOnDestinationChangedListener(listener)
        onDispose { navController.removeOnDestinationChangedListener(listener) }
    }

    // Deep-link style re-entry (FarmerChat.openChat while activity alive).
    LaunchedEffect(newIntentTick) {
        if (newIntentTick > 0 && graph.routeDecider.peekPendingTarget() != null &&
            graph.routeDecider.isLanguageSelected()
        ) {
            navigateFromSplash()
        }
    }

    // ------------------------------------------------------------------ drawer wrapper

    @Composable
    fun WithDrawer(content: @Composable (openDrawer: () -> Unit) -> Unit) {
        // C3: showDrawer=false renders content with no navigation drawer.
        if (!graph.config.showDrawer) {
            content {}
            return
        }
        AppDrawer(
            currentRoute = currentRouteId,
            onNavigate = { route -> navigateDrawerRoute(route) },
            isAuthenticated = isAuthenticated,
            onSeeAllClick = { onSeeAllClick() },
            onSignUpClick = { handleSignUpClick() },
            currentLanguage = drawerLanguageDisplay,
            previousQuestions = chatHistoryVm.recentDrawerQuestions(),
            historyErrorMessage = historyState.errorMessage,
            onRetryHistory = { chatHistoryVm.refresh() },
            onDrawerOpened = { chatHistoryVm.refreshSilently() },
            isLoadingHistory = historyState.isLoading,
            onQuestionClick = { conversationId -> openChatFromDrawer(conversationId) },
            showSettings = graph.config.showSettings,
            showHistory = graph.config.showHistory,
            content = content
        )
    }

    // ------------------------------------------------------------------ nav graph

    // Embedded (FarmerChatInline / a host placing FarmerChatRoot in its own layout): pad for the
    // system bars only where they actually overlap this root — see util/FcInsets.kt. Full-window
    // (FarmerChatActivity) the measured gap is 0 and this is a no-op.
    FcInsetTrim(modifier = modifier.fillMaxSize()) {
    Box(modifier = Modifier.fillMaxSize()) {
        NavHost(
            navController = navController,
            startDestination = Destination.Splash,
            enterTransition = { fadeIn(animationSpec = tween(500)) },
            exitTransition = { fadeOut(animationSpec = tween(500)) },
            popEnterTransition = { fadeIn(animationSpec = tween(500)) },
            popExitTransition = { fadeOut(animationSpec = tween(500)) }
        ) {
            composable<Destination.Splash> {
                SplashScreen(onReady = { navigateFromSplash() })
            }

            composable<Destination.Language> {
                LanguageScreen(
                    onLanguageSubmitted = { navigateFromSplash() },
                    onNavigateToError = { isNetworkError, fromScreen ->
                        navController.navigate(
                            Destination.Error(isNetworkError = isNetworkError, fromScreen = fromScreen)
                        ) { launchSingleTop = true }
                    },
                    onOpenLegal = { url, title ->
                        navController.navigate(Destination.LegalContent(url = url, title = title)) {
                            launchSingleTop = true
                        }
                    },
                    onLabelsChanged = {
                        onLanguageChanged(
                            graph.prefs.getString(SdkPreferences.Keys.SELECTED_LANGUAGE_CODE, "en")
                                .ifBlank { "en" }
                        )
                    }
                )
            }

            composable<Destination.Name> {
                EnterNameScreen(onDone = { navigateFromSplash() })
            }

            composable<Destination.Home> {
                WithDrawer { openDrawer ->
                    HomeScreen(
                        openDrawer = openDrawer,
                        onNavigateToChat = { chat -> navController.navigate(chat) },
                        openTermsOfUseRequested = termsOfUseRequested,
                        onTermsOfUseRequestConsumed = { termsOfUseRequested = false },
                        onNavigateToError = { isNetworkError, fromScreen ->
                            navController.navigate(
                                Destination.Error(isNetworkError = isNetworkError, fromScreen = fromScreen)
                            ) { launchSingleTop = true }
                        }
                    )
                }
            }

            composable<Destination.Chat> { backStackEntry ->
                val args = backStackEntry.toRoute<Destination.Chat>()
                WithDrawer { openDrawer ->
                    ChatScreen(
                        args = args,
                        openDrawer = openDrawer,
                        onClose = {
                            // CHAT_ONLY has no SDK Home to return to — close should exit
                            // the SDK and hand control back to the host app.
                            if (graph.config.mode == org.digitalgreen.farmerchat.sdk.FarmerChatMode.CHAT_ONLY) {
                                (context as? Activity)?.finish()
                            } else {
                                navController.navigate(Destination.Home) {
                                    popUpTo<Destination.Home> { inclusive = false }
                                    launchSingleTop = true
                                }
                            }
                        },
                        // Chat app bar actions. Only rendered when the drawer is OFF (CHAT_ONLY),
                        // where they are the only route to either screen — parity with the views
                        // flavour's `setUpAppBarActions`. Opened ON TOP of the chat: popping to the
                        // start first destroyed this chat's back-stack entry (and its ViewModel), so
                        // returning rebuilt an empty chat and the thread was lost.
                        onNavigateToHistory = {
                            navController.navigate(Destination.ChatHistory) { launchSingleTop = true }
                        },
                        onNavigateToLanguage = {
                            navController.navigate(Destination.SettingsLanguage) { launchSingleTop = true }
                        },
                        onBackToHistory = {
                            if (!navController.popBackStack()) (context as? Activity)?.finish()
                        }
                    )
                }
            }

            composable<Destination.Settings> {
                WithDrawer { openDrawer ->
                    SettingsScreen(
                        openDrawer = openDrawer,
                        isAuthenticated = isAuthenticated,
                        showNameUpdatedToast = showNameUpdatedToast,
                        onNameUpdatedToastShown = { showNameUpdatedToast = false },
                        onNameClick = { navController.navigate(Destination.SettingsName) },
                        onSignUpClick = { handleSignUpClick() },
                        onLogOutClick = { handleLogout() },
                        onAppearanceModeChange = onAppearanceModeChanged
                    )
                }
            }

            composable<Destination.SettingsName> {
                SettingsNameScreen(
                    onBack = { navController.popBackStack() },
                    onSaveComplete = {
                        showNameUpdatedToast = true
                        navController.popBackStack()
                    }
                )
            }

            composable<Destination.SettingsLanguage> {
                WithDrawer { openDrawer ->
                    LanguageChooserScreen(
                        openDrawer = openDrawer,
                        onBack = {
                            if (navController.previousBackStackEntry == null ||
                                !navController.popBackStack()
                            ) leaveSecondaryScreen()
                        },
                        onLanguageSaved = {
                            // delay(500) already applied in the screen before this call.
                            // CHAT_ONLY has no Home to clear back to — parity with the views
                            // `NavRoutes.leaveSecondaryScreen`: the host, or the chat.
                            leaveSecondaryScreen()
                        },
                        onFetchLabelsFailure = { leaveSecondaryScreen() },
                        onLabelsChanged = {
                            onLanguageChanged(
                                graph.prefs.getString(SdkPreferences.Keys.SELECTED_LANGUAGE_CODE, "en")
                                    .ifBlank { "en" }
                            )
                        }
                    )
                }
            }

            composable<Destination.Help> {
                WithDrawer { openDrawer ->
                    HelpScreen(
                        openDrawer = openDrawer,
                        onOpenUrl = { title, url ->
                            navController.navigate(Destination.LegalContent(url = url, title = title)) {
                                launchSingleTop = true
                            }
                        }
                    )
                }
            }

            composable<Destination.ChatHistory> {
                WithDrawer { openDrawer ->
                    ChatHistoryScreen(
                        vm = chatHistoryVm,
                        openDrawer = openDrawer,
                        // Drawer-off (CHAT_ONLY): pop back to whatever opened this — the chat
                        // app bar's Past Advice icon. Falls back to the graph start so the
                        // farmer can never be stranded with a dead control.
                        onBack = {
                            if (screenOpenedByHost && navController.previousBackStackEntry == null) {
                                leaveSecondaryScreen()
                            } else if (!navController.popBackStack()) {
                                navController.navigate(Destination.Chat()) {
                                    popUpTo(navController.graph.startDestinationId) {
                                        inclusive = false
                                    }
                                    launchSingleTop = true
                                }
                            }
                        },
                        onOpenChatFromHistory = { conversationId ->
                            navController.navigate(
                                Destination.Chat(source = "history", conversationId = conversationId)
                            )
                        },
                        onNavigateToError = { isNetworkError ->
                            navController.navigate(
                                Destination.Error(
                                    isNetworkError = isNetworkError,
                                    fromScreen = "chathistory"
                                )
                            ) { launchSingleTop = true }
                        }
                    )
                }
            }

            composable<Destination.AccountBenefits> {
                AccountBenefitsScreen(
                    onSignUp = {
                        // Don't take the user into the Auth (phone input) screen when offline.
                        // Route through ErrorNavigationManager so a retry action is REGISTERED —
                        // navigating to Destination.Error directly leaves retryLastAction() a
                        // no-op (app parity, AppNavGraph.kt AccountBenefits onPrimaryCta).
                        if (!isNetworkAvailable(context)) {
                            scope.launch {
                                graph.errorNavigationManager.navigateToError(
                                    isNetworkError = true,
                                    fromScreen = "auth",
                                    retry = { navController.navigate(Destination.Auth) }
                                )
                            }
                        } else {
                            navController.navigate(Destination.Auth)
                        }
                    },
                    onSkip = { navController.popBackStack() }
                )
            }

            composable<Destination.Auth> {
                AuthScreen(
                    onClose = { navController.popBackStack() },
                    onSuccess = { _, _ ->
                        isAuthenticated = true
                        navController.navigate(Destination.AccountSuccess) {
                            popUpTo<Destination.Auth> { inclusive = true }
                            launchSingleTop = true
                        }
                    },
                    onOpenLegal = { url, title ->
                        navController.navigate(Destination.LegalContent(url = url, title = title)) {
                            launchSingleTop = true
                        }
                    }
                )
            }

            composable<Destination.AccountSuccess> {
                // Back from success goes to Home (the user is already logged in); do not
                // return into the auth back stack (doc 01 §2 / §3.6).
                val toHomeClearingAuth: () -> Unit = {
                    navController.navigate(Destination.Home) {
                        popUpTo<Destination.AccountBenefits> { inclusive = true }
                        launchSingleTop = true
                    }
                }
                androidx.activity.compose.BackHandler { toHomeClearingAuth() }
                AccountSuccessScreen(onContinue = toHomeClearingAuth)
            }

            composable<Destination.Error> { backStackEntry ->
                val args = backStackEntry.toRoute<Destination.Error>()
                // Display copy uses only args.isNetworkError so the message does not change
                // when the user reconnects (app parity, AppNavGraph.kt:316).
                ErrorScreen(
                    errorType = if (args.isNetworkError) ErrorType.NO_INTERNET else ErrorType.API_ERROR,
                    onTryAgain = {
                        // Per-fromScreen retry semantics — doc 01 §2 "Error | onTryAgain".
                        // Identical tree to android-views ErrorFragment.onTryAgain.

                        // Still offline → stay on the No Internet screen.
                        if (args.isNetworkError && !isNetworkAvailable(context)) {
                            return@ErrorScreen
                        }

                        when (args.fromScreen.lowercase()) {
                            // Drawer history strip: refresh in place, no re-navigation.
                            "drawer" -> {
                                chatHistoryVm.refresh()
                                navController.popBackStack()
                                return@ErrorScreen
                            }
                            // ChatHistory retries on load, so re-enter it.
                            "chathistory" -> {
                                navController.popBackStack()
                                navController.navigate(Destination.ChatHistory) {
                                    launchSingleTop = true
                                }
                                return@ErrorScreen
                            }
                            // Weather / content-card taps triggered no API — only pop back to
                            // Home; deliberately no retryLastAction().
                            "home_weather", "home_card" -> {
                                navController.popBackStack()
                                return@ErrorScreen
                            }
                        }

                        val popped = navController.popBackStack()
                        if (!popped) {
                            when (args.fromScreen.lowercase()) {
                                "language" -> navController.navigate(Destination.Language) {
                                    launchSingleTop = true
                                }
                                "name" -> navController.navigate(Destination.Name) {
                                    launchSingleTop = true
                                }
                                "auth" -> navController.navigate(Destination.Auth) {
                                    launchSingleTop = true
                                }
                            }
                        }
                        graph.errorNavigationManager.retryLastAction()
                    }
                )
            }

            dialog<Destination.LegalContent>(
                dialogProperties = androidx.compose.ui.window.DialogProperties(
                    usePlatformDefaultWidth = false,
                    dismissOnBackPress = true,
                    // The dialog gets its OWN window, which does not inherit the activity's
                    // edge-to-edge. With decor fitting system windows (the default) the window
                    // is inset below the status bar and above the nav bar, so `DefaultAppBar`'s
                    // own `WindowInsets.statusBars` read returned ZERO and the legal screen
                    // rendered with a dark band above the app bar and a grey strip below the
                    // content. Going edge-to-edge here lets the app bar extend behind the
                    // status bar exactly as it does on every other screen.
                    decorFitsSystemWindows = false
                )
            ) { backStackEntry ->
                val args = backStackEntry.toRoute<Destination.LegalContent>()
                LegalContentScreen(
                    url = args.url,
                    title = args.title,
                    onClose = { navController.popBackStack() }
                )
            }
        }

        // Global overlays (rendered after the nav graph).
        LocationPromptHost()

        Toast(
            message = globalToast.message,
            state = globalToast.state,
            visible = globalToast.isVisible,
            onDismiss = { globalToast.dismiss() }
        )
    }
    }
}
