package org.digitalgreen.farmerchat.sdk.views

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.view.LayoutInflaterCompat
import androidx.navigation.NavController
import androidx.navigation.fragment.NavHostFragment
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.core.navigation.PendingTarget
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.views.databinding.FcJourneyHostBinding
import org.digitalgreen.farmerchat.sdk.views.internal.JourneyController
import org.digitalgreen.farmerchat.sdk.views.internal.JourneyHost
import org.digitalgreen.farmerchat.sdk.views.internal.NavRoutes
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcThemeInflaterFactory
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcViewTheme
import org.digitalgreen.farmerchat.sdk.views.internal.viewModelOwnerCoreVm

/**
 * Views entry point of the FarmerChat SDK: hosts the full journey
 * (splash → language → name → home → chat/history → settings, auth from drawer).
 */
class FarmerChatActivity : AppCompatActivity(), JourneyHost {

    private lateinit var binding: FcJourneyHostBinding
    private var controller: JourneyController? = null
    private var navController: NavController? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        // Appearance mode from prefs, scoped to this activity (never the host app).
        runCatching {
            applyLocalNightMode(
                FarmerChat.requireGraph().prefs.getString(SdkPreferences.Keys.APPEARANCE_MODE, "")
            )
        }
        // Host theme recolor: install BEFORE super.onCreate so it becomes the sole
        // LayoutInflater factory (delegating creation to AppCompat) and propagates
        // to fragment + RecyclerView-item inflation.
        installHostThemeFactory()
        super.onCreate(savedInstanceState)
        binding = FcJourneyHostBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val graph = FarmerChat.requireGraph()
        val navHost = supportFragmentManager.findFragmentById(R.id.fcNavHost) as NavHostFragment
        val nav = navHost.navController
        navController = nav

        controller = JourneyController(
            activity = this,
            binding = binding,
            navController = nav,
            lifecycleOwner = this,
            graph = graph,
            chatHistoryVm = viewModelOwnerCoreVm(this, "chat_history") { graph.chatHistoryViewModel() }
        )

        // Launch extras (openChat): pending target consumed by routeFromSplash.
        captureIntentTarget(intent, navigateNow = false)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        captureIntentTarget(intent, navigateNow = true)
    }

    private fun captureIntentTarget(intent: Intent?, navigateNow: Boolean) {
        intent ?: return
        val graph = FarmerChat.requireGraph()
        val question = intent.getStringExtra(FarmerChat.EXTRA_OPEN_CHAT_QUESTION)
        val conversationId = intent.getStringExtra(FarmerChat.EXTRA_OPEN_CHAT_CONVERSATION_ID)
        when {
            conversationId != null ->
                graph.routeDecider.savePendingTarget(PendingTarget.Chat(conversationId))
            question != null ->
                graph.routeDecider.savePendingTarget(
                    PendingTarget.ChatQuery(question = question, source = "deeplink")
                )
            else -> return
        }
        if (navigateNow && graph.routeDecider.isLanguageSelected()) {
            navController?.let { nav ->
                NavRoutes.navigateFromSplash(nav, graph.routeDecider.routeFromSplash()) { }
            }
        }
    }

    override fun openDrawer() {
        controller?.openDrawer()
    }

    override fun closeDrawer() {
        controller?.closeDrawer()
    }

    override fun applyAppearance(mode: String) {
        applyLocalNightMode(mode)
    }

    /** Installs the [FcThemeInflaterFactory] when a host theme is configured. */
    private fun installHostThemeFactory() {
        val theme = runCatching { FarmerChat.requireGraph().config.theme }.getOrNull() ?: return
        val resolved = FcViewTheme.resolve(theme, FcViewTheme.isNight(this)) ?: return
        LayoutInflaterCompat.setFactory2(
            layoutInflater,
            FcThemeInflaterFactory(resolved) { parent, name, context, attrs ->
                delegate.createView(parent, name, context, attrs)
            }
        )
    }
}

/** Maps the APPEARANCE_MODE pref to a per-activity night mode. */
internal fun AppCompatActivity.applyLocalNightMode(mode: String) {
    delegate.localNightMode = when (mode.trim().lowercase()) {
        "day" -> AppCompatDelegate.MODE_NIGHT_NO
        "night" -> AppCompatDelegate.MODE_NIGHT_YES
        else -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
    }
}
