package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.navigation.fragment.findNavController
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.network.NetworkUtils
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.internal.BaseFragment
import org.digitalgreen.farmerchat.sdk.views.internal.NavRoutes
import org.digitalgreen.farmerchat.sdk.views.internal.activityCoreVm
import org.digitalgreen.farmerchat.sdk.views.internal.util.FarmerIllustrations
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.FullScreenMessageView
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.PrimaryButtonView

/**
 * NoInternet / API error screen (doc 01 §3.14) with per-fromScreen retry
 * semantics matching the app's AppNavGraph onTryAgain block.
 */
internal class ErrorFragment : BaseFragment(0) {

    override val analyticsScreenName: String = AnalyticsScreens.ERROR

    private val isNetworkError: Boolean get() = arguments?.getBoolean("isNetworkError", true) ?: true
    private val fromScreen: String get() = arguments?.getString("fromScreen").orEmpty()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = FullScreenMessageView(requireContext())

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val fsm = view as FullScreenMessageView

        val (title, main, subtitle) = if (isNetworkError) {
            Triple(
                label(Labels.NO_INTERNET_CONNECTION, "No internet connection"),
                label(Labels.FARMERCHAT_NEEDS_THE_INTERNET, "FarmerChat needs \nthe internet"),
                label(Labels.CHECK_MOBILE_DATA_WIFI_SIGNAL, "Check mobile data or Wi-Fi signal")
            )
        } else {
            Triple(
                label(Labels.SOMETHING_WENT_WRONG, "Something went wrong"),
                label(Labels.FARMERCHAT_COULDNT_LOAD, "FarmerChat couldn't load"),
                label(Labels.PLEASE_TRY_AGAIN, "Please try again")
            )
        }

        fsm.bind(
            title = title,
            mainMessage = main,
            subtitle = subtitle,
            primaryCtaLabel = label(Labels.TRY_AGAIN, "Try again"),
            primaryButtonState = PrimaryButtonView.State.DEFAULT,
            onPrimaryCta = { onTryAgain() },
            illustrationAsset = FarmerIllustrations.LOOKING_AT_SKY,
            leftIconRes = null,
            onLeftClick = null
        )
    }

    private fun onTryAgain() {
        val nav = findNavController()
        val context = requireContext()

        // Still offline → stay on the No Internet screen.
        if (isNetworkError && !NetworkUtils.isOnline(context)) return

        when (fromScreen.lowercase()) {
            "drawer" -> {
                activityCoreVm("chat_history") { graph.chatHistoryViewModel() }.refresh()
                nav.popBackStack()
                return
            }
            "chathistory" -> {
                nav.popBackStack()
                nav.navigate(R.id.fc_dest_chat_history, null, NavRoutes.singleTop())
                return
            }
            "home_weather", "home_card" -> {
                nav.popBackStack()
                return
            }
        }

        val popped = nav.popBackStack()
        if (!popped) {
            when (fromScreen.lowercase()) {
                "language" -> nav.navigate(R.id.fc_dest_language, null, NavRoutes.singleTop())
                "name" -> nav.navigate(R.id.fc_dest_name, null, NavRoutes.singleTop())
                "auth" -> nav.navigate(R.id.fc_dest_auth, null, NavRoutes.singleTop())
            }
        }
        graph.errorNavigationManager.retryLastAction()
    }
}
