@file:OptIn(InternalFarmerChatApi::class)

package org.digitalgreen.farmerchat.sdk

import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.core.navigation.PendingTarget

/**
 * Public entry point of the FarmerChat Android SDK. Identical shape on every
 * platform (doc 03):
 *
 * ```
 * FarmerChat.initialize(context, config)
 * FarmerChat.launch(activityContext)
 * FarmerChat.openChat(activityContext, question = "...", conversationId = null)
 * FarmerChat.logout()
 * FarmerChat.isAuthenticated / FarmerChat.onAuthStateChanged { ... }
 * FarmerChat.setAnalyticsListener(listener)
 * ```
 *
 * The SDK owns auth (guest init → OTP login → refresh → guest fallback); the host
 * never touches tokens.
 */
object FarmerChat {

    /** Intent extras understood by both UI packages' FarmerChatActivity. */
    const val EXTRA_OPEN_CHAT_QUESTION = "fc_sdk_extra_open_chat_question"
    const val EXTRA_OPEN_CHAT_CONVERSATION_ID = "fc_sdk_extra_open_chat_conversation_id"

    private const val COMPOSE_ACTIVITY = "org.digitalgreen.farmerchat.sdk.compose.FarmerChatActivity"
    private const val VIEWS_ACTIVITY = "org.digitalgreen.farmerchat.sdk.views.FarmerChatActivity"

    @Volatile
    private var graphInternal: FarmerChatGraph? = null

    private val sdkScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var authObserverJob: Job? = null
    private val authListeners = mutableListOf<(Boolean) -> Unit>()

    val isInitialized: Boolean get() = graphInternal != null

    /**
     * Must be called once (e.g. from Application.onCreate) before [launch]/[openChat].
     * Re-initializing with a different environment recreates the graph.
     */
    @JvmStatic
    fun initialize(context: Context, config: FarmerChatConfig) {
        synchronized(this) {
            val existing = graphInternal
            if (existing != null && existing.config.environment == config.environment) {
                return
            }
            val graph = FarmerChatGraph(context.applicationContext, config)
            graphInternal = graph
            authObserverJob?.cancel()
            authObserverJob = sdkScope.launch {
                graph.sessionManager.isAuthenticated.collect { authenticated ->
                    synchronized(authListeners) { authListeners.toList() }
                        .forEach { runCatching { it(authenticated) } }
                }
            }
            // C4: deterministic session-start hook.
            runCatching { config.hooks.onSessionStart?.invoke() }
        }
    }

    /**
     * Internal service graph, exposed for the SDK's own UI artifacts.
     * Host apps must not use this — it is gated behind [InternalFarmerChatApi].
     */
    @InternalFarmerChatApi
    @JvmStatic
    fun requireGraph(): FarmerChatGraph =
        graphInternal ?: error(
            "FarmerChat is not initialized. Call FarmerChat.initialize(context, config) first."
        )

    /**
     * Launches the full FarmerChat journey (splash → language → name → home → chat).
     * Resolves whichever UI artifact is on the classpath: Compose first, then Views.
     */
    @JvmStatic
    fun launch(context: Context) {
        requireGraph()
        context.startActivity(buildLaunchIntent(context))
    }

    /**
     * Deep-link style entry directly into a chat. When [question] is set the chat
     * opens and asks it; when [conversationId] is set the existing thread opens.
     * Onboarding-incomplete users still route through the pending-target flow
     * (routeFromSplash consumes it after language/name).
     */
    @JvmStatic
    fun openChat(context: Context, question: String? = null, conversationId: String? = null) {
        val graph = requireGraph()
        when {
            conversationId != null ->
                graph.routeDecider.savePendingTarget(PendingTarget.Chat(conversationId))
            question != null ->
                graph.routeDecider.savePendingTarget(
                    PendingTarget.ChatQuery(question = question, source = "deeplink")
                )
        }
        val intent = buildLaunchIntent(context).apply {
            question?.let { putExtra(EXTRA_OPEN_CHAT_QUESTION, it) }
            conversationId?.let { putExtra(EXTRA_OPEN_CHAT_CONVERSATION_ID, it) }
        }
        context.startActivity(intent)
    }

    /** C4 programmatic API: ask a question (opens chat and asks it). Alias of [openChat]. */
    @JvmStatic
    fun sendQuestion(context: Context, text: String) = openChat(context, question = text)

    /** C4 programmatic API: open an existing conversation by id. Alias of [openChat]. */
    @JvmStatic
    fun openConversation(context: Context, conversationId: String) =
        openChat(context, conversationId = conversationId)

    /**
     * C4 programmatic API: launch the journey and route to a well-known screen
     * (see [org.digitalgreen.farmerchat.sdk.core.navigation.FarmerChatScreens]).
     */
    @JvmStatic
    fun openScreen(context: Context, screen: String) {
        val graph = requireGraph()
        if (screen == org.digitalgreen.farmerchat.sdk.core.navigation.FarmerChatScreens.CHAT) {
            openChat(context)
            return
        }
        graph.routeDecider.savePendingTarget(PendingTarget.Screen(screen))
        context.startActivity(buildLaunchIntent(context))
    }

    private fun buildLaunchIntent(context: Context): Intent {
        val activityClass = resolveActivityClass()
            ?: error(
                "No FarmerChat UI artifact found. Add farmerchat-android-compose or " +
                    "farmerchat-android-views to your dependencies."
            )
        return Intent(context, activityClass).apply {
            if (context !is android.app.Activity) {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        }
    }

    private fun resolveActivityClass(): Class<*>? {
        for (name in listOf(COMPOSE_ACTIVITY, VIEWS_ACTIVITY)) {
            runCatching { return Class.forName(name) }
        }
        return null
    }

    /** True only after OTP verification; guest sessions are not authenticated. */
    @JvmStatic
    val isAuthenticated: Boolean
        get() = graphInternal?.sessionManager?.isAuthenticated?.value ?: false

    /** Observable auth state (StateFlow variant). */
    @JvmStatic
    val authState: StateFlow<Boolean>?
        get() = graphInternal?.sessionManager?.isAuthenticated

    /** Callback variant of auth-state observation. Returns an unsubscribe function. */
    @JvmStatic
    fun onAuthStateChanged(listener: (Boolean) -> Unit): () -> Unit {
        synchronized(authListeners) { authListeners.add(listener) }
        // Emit current value immediately.
        listener(isAuthenticated)
        return {
            synchronized(authListeners) { authListeners.remove(listener) }
        }
    }

    /**
     * Logout: POST api/user/logout/ best-effort, clear all fc_sdk_ prefs (preserving
     * appearance), clear tokens, reset auth state.
     */
    @JvmStatic
    fun logout(onComplete: ((success: Boolean) -> Unit)? = null) {
        val graph = graphInternal ?: return
        sdkScope.launch {
            val success = graph.sessionManager.logout()
            graph.locationPromptManager.clearState()
            onComplete?.invoke(success)
        }
    }

    /** Host-pluggable analytics sink; receives every app-parity event. */
    @JvmStatic
    fun setAnalyticsListener(listener: FarmerChatAnalyticsListener?) {
        graphInternal?.analytics?.listener = listener
    }
}
