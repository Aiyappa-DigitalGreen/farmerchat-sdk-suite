package org.digitalgreen.farmerchat.sdk.views.internal

import androidx.core.view.GravityCompat
import androidx.core.view.isVisible
import androidx.drawerlayout.widget.DrawerLayout
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.NavController
import androidx.recyclerview.widget.LinearLayoutManager
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.FarmerChatGraph
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.base.ApiResult
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.network.NetworkUtils
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.history.ChatHistoryViewModel
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptEvent
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcJourneyHostBinding
import org.digitalgreen.farmerchat.sdk.views.internal.drawer.DrawerQuestionAdapter
import org.digitalgreen.farmerchat.sdk.views.internal.location.LocationPromptHost
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.ToastView

/**
 * Shared wiring of the full journey host (used by both FarmerChatActivity and
 * FarmerChatFragment): drawer, error-event navigation, global location prompt
 * overlay and the widget-location toast.
 */
internal class JourneyController(
    private val activity: FragmentActivity,
    private val binding: FcJourneyHostBinding,
    private val navController: NavController,
    private val lifecycleOwner: LifecycleOwner,
    private val graph: FarmerChatGraph,
    private val chatHistoryVm: ChatHistoryViewModel
) {

    private val drawerAdapter = DrawerQuestionAdapter { question ->
        closeDrawer()
        navController.navigate(
            R.id.fc_dest_chat,
            NavRoutes.chatArgs(source = "history", conversationId = question.conversationId)
        )
    }

    /** Destinations wrapped by the shared drawer (doc 01 §4). */
    private val drawerDestinations = setOf(
        R.id.fc_dest_home, R.id.fc_dest_chat, R.id.fc_dest_settings,
        R.id.fc_dest_help, R.id.fc_dest_settings_language, R.id.fc_dest_chat_history
    )

    init {
        LocationPromptHost(
            activity = activity,
            container = binding.fcLocationPromptHost,
            lifecycleOwner = lifecycleOwner,
            manager = graph.locationPromptManager,
            labels = graph.labelManager
        )

        setupDrawer()
        observeDestinationChanges()
        observeErrorEvents()
        observeLocationEvents()
        observeAuthState()
    }

    fun openDrawer() {
        // C3: showDrawer=false disables the navigation drawer entirely.
        if (!graph.config.showDrawer) return
        graph.analytics.track(AnalyticsEvents.HAMBURGER_MENU_CLICKED)
        binding.fcDrawerLayout.openDrawer(GravityCompat.START)
    }

    fun closeDrawer() {
        binding.fcDrawerLayout.closeDrawer(GravityCompat.START)
    }

    // ------------------------------------------------------------------ drawer

    private fun label(key: String, fallback: String) = graph.labelManager.getLabel(key, fallback)

    private fun setupDrawer() {
        val d = binding.fcDrawer
        d.fcDrawerRecentList.layoutManager = LinearLayoutManager(activity)
        d.fcDrawerRecentList.adapter = drawerAdapter

        // C3: hide the Settings row / history section when toggled off; lock the
        // drawer permanently closed when the whole drawer is disabled.
        d.fcDrawerSettingsRow.isVisible = graph.config.showSettings
        if (!graph.config.showHistory) {
            d.fcDrawerRecentTitle.isVisible = false
            d.fcDrawerRecentList.isVisible = false
            d.fcDrawerHistoryLoading.isVisible = false
            d.fcDrawerHistoryError.isVisible = false
            d.fcDrawerNoChats.isVisible = false
            d.fcDrawerSeeAll.isVisible = false
        }
        if (!graph.config.showDrawer) {
            binding.fcDrawerLayout.setDrawerLockMode(DrawerLayout.LOCK_MODE_LOCKED_CLOSED)
        }

        d.fcDrawerHomeRow.setOnClickListener {
            closeDrawer()
            navController.navigate(R.id.fc_dest_home, null, NavRoutes.drawerOptions(navController))
        }
        d.fcDrawerSettingsRow.setOnClickListener {
            closeDrawer()
            navController.navigate(R.id.fc_dest_settings, null, NavRoutes.drawerOptions(navController))
        }
        d.fcDrawerLanguageRow.setOnClickListener {
            closeDrawer()
            navController.navigate(
                R.id.fc_dest_settings_language, null, NavRoutes.drawerOptions(navController)
            )
        }
        d.fcDrawerHelpRow.setOnClickListener {
            closeDrawer()
            navController.navigate(R.id.fc_dest_help, null, NavRoutes.drawerOptions(navController))
        }
        d.fcDrawerSeeAll.setOnClickListener {
            closeDrawer()
            if (!NetworkUtils.isOnline(activity)) {
                navController.navigate(
                    R.id.fc_dest_error,
                    NavRoutes.errorArgs(isNetworkError = true, fromScreen = "chathistory"),
                    NavRoutes.singleTop()
                )
            } else {
                navController.navigate(
                    R.id.fc_dest_chat_history, null, NavRoutes.singleTop()
                )
            }
        }
        d.fcDrawerHistoryRetry.setOnClickListener { chatHistoryVm.refresh() }
        d.fcDrawerSignUpButton.setOnClickListener { handleSignUpClick() }

        binding.fcDrawerLayout.addDrawerListener(object : DrawerLayout.SimpleDrawerListener() {
            override fun onDrawerOpened(drawerView: android.view.View) {
                refreshDrawerTexts()
                chatHistoryVm.refreshSilently()
            }
        })

        lifecycleOwner.lifecycleScope.launch {
            lifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                chatHistoryVm.state.collect { state ->
                    if (!graph.config.showHistory) return@collect  // C3: history section hidden
                    drawerAdapter.submit(chatHistoryVm.recentDrawerQuestions())
                    d.fcDrawerHistoryLoading.isVisible = state.isLoading && state.items.isEmpty()
                    val hasError = state.errorMessage != null && state.items.isEmpty()
                    d.fcDrawerHistoryError.isVisible = hasError
                    if (hasError) {
                        d.fcDrawerHistoryErrorTitle.text = if (state.isNetworkError) {
                            label(Labels.NO_INTERNET_CONNECTION, "No internet connection")
                        } else {
                            label(Labels.FAILED_TO_LOAD_CHATS, "Failed to load chats")
                        }
                    }
                    d.fcDrawerNoChats.isVisible =
                        !state.isLoading && state.errorMessage == null && state.items.isEmpty()
                    d.fcDrawerSeeAll.isVisible = state.items.isNotEmpty()
                }
            }
        }

        refreshDrawerTexts()
    }

    private fun refreshDrawerTexts() {
        val d = binding.fcDrawer
        d.fcDrawerHomeRow.text = label(Labels.HOME, "Home")
        d.fcDrawerRecentTitle.text = label(Labels.RECENT_CHATS, "Recent chats")
        d.fcDrawerSeeAll.text = label(Labels.SEE_ALL, "See all")
        d.fcDrawerSettingsRow.text = label(Labels.SETTINGS, "Settings")
        val languageDisplay = graph.prefs
            .getString(SdkPreferences.Keys.SELECTED_LANGUAGE_DISPLAY_NAME, "")
            .ifBlank { graph.prefs.getString(SdkPreferences.Keys.SELECTED_LANGUAGE_CODE, "") }
        d.fcDrawerLanguageRow.text =
            "${label(Labels.LANGUAGE, "Language")}: $languageDisplay"
        d.fcDrawerHelpRow.text = label(Labels.HELP_SUPPORT, "Help & Support")
        d.fcDrawerNoChats.text = label(Labels.NO_CHATS_YET, "No chats yet.")
        d.fcDrawerHistoryErrorSubtitle.text =
            label(Labels.PLEASE_CONNECT_INTERNET_TRY_AGAIN, "Check your connection and try again")
        d.fcDrawerHistoryRetry.text = label(Labels.TRY_AGAIN, "Try again")
        d.fcDrawerSignUpTitle.text =
            label(Labels.SAVE_YOUR_QUESTIONS_ANSWERS, "Save your past questions")
        d.fcDrawerSignUpSubtitle.text = label(
            Labels.WELL_SAVE_YOUR_CHATS_YOU_CONTINUE,
            "Keep your answers and come back anytime"
        )
        d.fcDrawerSignUpButton.text = label(Labels.SIGN_UP, "Sign up")
        d.fcDrawerSignUpSection.isVisible = !graph.sessionManager.isAuthenticated.value
    }

    /** Sign up: question count decides Auth vs AccountBenefits (bypass_interstitial). */
    private fun handleSignUpClick() {
        closeDrawer()
        if (!NetworkUtils.isOnline(activity)) {
            navController.navigate(
                R.id.fc_dest_error,
                NavRoutes.errorArgs(isNetworkError = true, fromScreen = "auth"),
                NavRoutes.singleTop()
            )
            return
        }
        lifecycleOwner.lifecycleScope.launch {
            val result = graph.homeUseCase.getUserQuestionCount().first()
            val bypass = (result as? ApiResult.Success)?.data?.bypass_interstitial == true
            navController.navigate(
                if (bypass) R.id.fc_dest_auth else R.id.fc_dest_account_benefits
            )
        }
    }

    // ------------------------------------------------------------------ nav-graph level effects

    private fun observeDestinationChanges() {
        navController.addOnDestinationChangedListener { _, destination, _ ->
            // C3: when the drawer is disabled it stays locked closed on every screen.
            val unlocked = graph.config.showDrawer && destination.id in drawerDestinations
            binding.fcDrawerLayout.setDrawerLockMode(
                if (unlocked) DrawerLayout.LOCK_MODE_UNLOCKED
                else DrawerLayout.LOCK_MODE_LOCKED_CLOSED
            )
            graph.errorNavigationManager.setActiveScreen(
                when (destination.id) {
                    R.id.fc_dest_splash -> "splash"
                    R.id.fc_dest_language -> "language"
                    R.id.fc_dest_name -> "name"
                    R.id.fc_dest_home -> "home"
                    R.id.fc_dest_chat -> "chat"
                    R.id.fc_dest_settings, R.id.fc_dest_settings_name -> "settings"
                    R.id.fc_dest_help -> "help"
                    R.id.fc_dest_settings_language -> "language"
                    R.id.fc_dest_chat_history -> "chathistory"
                    R.id.fc_dest_auth, R.id.fc_dest_account_benefits,
                    R.id.fc_dest_account_success -> "auth"
                    R.id.fc_dest_error -> "error"
                    else -> null
                }
            )
            refreshDrawerTexts()
        }
    }

    private fun observeErrorEvents() {
        lifecycleOwner.lifecycleScope.launch {
            lifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                graph.errorNavigationManager.errorEvents.collect { event ->
                    navController.navigate(
                        R.id.fc_dest_error,
                        NavRoutes.errorArgs(event.isNetworkError, event.fromScreen),
                        NavRoutes.singleTop()
                    )
                }
            }
        }
    }

    private fun observeLocationEvents() {
        lifecycleOwner.lifecycleScope.launch {
            lifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                graph.locationPromptManager.events.collect { event ->
                    if (event is LocationPromptEvent.LocationUpdatedFromWidget) {
                        binding.fcGlobalToast.show(
                            label(Labels.LOCATION_UPDATED, "Location updated"),
                            ToastView.Type.SUCCESS
                        )
                        // Refresh Home: navigate (recreates Home when already there).
                        if (navController.currentDestination?.id == R.id.fc_dest_home) {
                            navController.navigate(
                                R.id.fc_dest_home, null, NavRoutes.clearStackOptions(navController)
                            )
                        }
                    }
                }
            }
        }
    }

    private fun observeAuthState() {
        lifecycleOwner.lifecycleScope.launch {
            lifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                graph.sessionManager.isAuthenticated.collect { authenticated ->
                    binding.fcDrawer.fcDrawerSignUpSection.isVisible = !authenticated
                    if (authenticated) chatHistoryVm.refreshSilently()
                }
            }
        }
    }
}
