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

            delay(200L) // minimum splash duration
            // Gate on a pending error: the error screen handles retry-driven routing.
            if (graph.errorNavigationManager.hasPendingError.value) return@launch

            val nav = findNavController()
            // C3: CHAT_ONLY skips onboarding/home and lands directly in a fresh chat
            // (unless a pending deep-link target should be honored first).
            if (graph.config.mode == org.digitalgreen.farmerchat.sdk.FarmerChatMode.CHAT_ONLY &&
                graph.routeDecider.peekPendingTarget() == null
            ) {
                NavRoutes.navigateChatOnly(nav)
                return@launch
            }
            NavRoutes.navigateFromSplash(nav, graph.routeDecider.routeFromSplash()) { _ ->
                graph.locationPromptManager.triggerFromCampaign(
                    org.digitalgreen.farmerchat.sdk.core.ui.location.LocationCampaignConfig(
                        triggerSource = "native"
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
}
