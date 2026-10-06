package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.animation.ObjectAnimator
import android.os.Bundle
import android.view.View
import android.view.animation.LinearInterpolator
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcFragmentSplashBinding
import org.digitalgreen.farmerchat.sdk.views.internal.BaseFragment
import org.digitalgreen.farmerchat.sdk.views.internal.NavRoutes
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.ToastView

/**
 * Splash (doc 01 §3.1): boot bg + rotating logo, min 200 ms, APP_OPENED, then
 * routeFromSplash() — gated on errorNavigationManager.hasPendingError.
 */
internal class SplashFragment : BaseFragment(R.layout.fc_fragment_splash) {

    override val analyticsScreenName: String = AnalyticsScreens.SPLASH

    private var logoAnimator: ObjectAnimator? = null

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val binding = FcFragmentSplashBinding.bind(view)

        // Keyframe-style rotation: hold, then spin (app parity approximation).
        logoAnimator = ObjectAnimator.ofFloat(binding.fcSplashLogo, "rotation", 0f, 0f, 360f).apply {
            duration = 3000L
            repeatCount = ObjectAnimator.INFINITE
            interpolator = LinearInterpolator()
            start()
        }

        graph.analytics.track(AnalyticsEvents.APP_OPENED)

        viewLifecycleOwner.lifecycleScope.launch {
            // Loading toast after 2 s (in case routing is blocked on a pending error).
            launch {
                delay(2000L)
                if (view.isAttachedToWindow) {
                    binding.fcSplashToast.show(
                        label(Labels.FARMERCHAT_STARTING, "FarmerChat is starting..."),
                        ToastView.Type.LOADING
                    )
                }
            }

            // The floor covers the WHOLE splash, bootstrap included — not 200 ms plus however
            // long the network takes. Measured from here so the elapsed check below subtracts
            // whatever the session bootstrap already spent.
            val splashStartedAt = android.os.SystemClock.elapsedRealtime()
            val minSplashMs = graph.config.minSplashDurationMs
            // Gate on a pending error: the error screen handles retry-driven routing.
            if (graph.errorNavigationManager.hasPendingError.value) return@launch

            val nav = findNavController()
            // C3: CHAT_ONLY skips onboarding/home and lands directly in chat. A pending deep-link
            // target (openChat / FarmerChatFragment.newInstance) is honored here too, without
            // routeFromSplash(): its language/name gates and its Home-first back stack would
            // surface exactly the screens CHAT_ONLY hides.
            if (graph.config.mode == org.digitalgreen.farmerchat.sdk.FarmerChatMode.CHAT_ONLY) {
                // Each fresh journey = a new conversation (the app's per-Home-entry rule).
                graph.beginChatOnlyJourney()
                // Guest session + conversation bootstrap (shared with android-compose).
                graph.ensureChatOnlySession()
                holdSplash(splashStartedAt, minSplashMs)
                NavRoutes.navigateChatOnly(nav, graph.routeDecider.consumePendingTarget())
                return@launch
            }
            // If the language SCREEN was skipped (config.locale), run its API work headlessly
            // first so Home opens with real server labels instead of English fallbacks.
            graph.ensureSkippedOnboardingBootstrap()

            holdSplash(splashStartedAt, minSplashMs)
            NavRoutes.navigateFromSplash(nav, graph.routeDecider.routeFromSplash()) { action ->
                // App parity (AppNavigator.kt:66-75): source unknown here, tagged "plotline".
                graph.locationPromptManager.triggerFromCampaign(
                    org.digitalgreen.farmerchat.sdk.core.ui.location.LocationCampaignConfig(
                        campaignId = action.substringBefore("?"),
                        triggerSource = "plotline"
                    )
                )
            }
        }
    }

    override fun onDestroyView() {
        logoAnimator?.cancel()
        logoAnimator = null
        super.onDestroyView()
    }

    /**
     * Holds the splash until [minSplashMs] have passed since [startedAt].
     *
     * A floor, never an added delay: if the bootstrap already took longer, this returns at once.
     */
    private suspend fun holdSplash(startedAt: Long, minSplashMs: Long) {
        val elapsed = android.os.SystemClock.elapsedRealtime() - startedAt
        if (elapsed < minSplashMs) kotlinx.coroutines.delay(minSplashMs - elapsed)
    }

}
