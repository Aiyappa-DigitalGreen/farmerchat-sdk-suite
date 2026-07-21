package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.navigation.fragment.findNavController
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.network.NetworkUtils
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.internal.BaseFragment
import org.digitalgreen.farmerchat.sdk.views.internal.NavRoutes
import org.digitalgreen.farmerchat.sdk.views.internal.util.FarmerIllustrations
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.FullScreenMessageView

/** AccountBenefits interstitial (doc 01 §3.5). */
internal class AccountBenefitsFragment : BaseFragment(0) {

    override val analyticsScreenName: String = AnalyticsScreens.ACCOUNT_BENEFIT

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = FullScreenMessageView(requireContext())

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        (view as FullScreenMessageView).bind(
            title = label(Labels.SIGN_UP, "Sign up"),
            mainMessage = label(Labels.SAVE_YOUR_QUESTIONS_ANSWERS, "Save your questions\nand answers"),
            subtitle = label(
                Labels.WELL_SAVE_YOUR_CHATS_YOU_CONTINUE,
                "We'll save your chats so you can continue later."
            ),
            primaryCtaLabel = label(Labels.SIGN_UP_PHONE_NUMBER, "Sign up with phone number"),
            onPrimaryCta = {
                graph.analytics.track(AnalyticsEvents.ACCOUNT_BENEFIT_SCREEN_PROCEED)
                if (!NetworkUtils.isOnline(requireContext())) {
                    findNavController().navigate(
                        R.id.fc_dest_error,
                        NavRoutes.errorArgs(isNetworkError = true, fromScreen = "auth"),
                        NavRoutes.singleTop()
                    )
                } else {
                    findNavController().navigate(R.id.fc_dest_auth)
                }
            },
            illustrationAsset = FarmerIllustrations.LOOKING_AT_CAMERA,
            leftIconRes = R.drawable.fc_ic_back,
            onLeftClick = { findNavController().popBackStack() },
            rightLabel = label(Labels.SKIP, "Skip"),
            onRightClick = {
                graph.analytics.track(AnalyticsEvents.ACCOUNT_BENEFIT_SCREEN_SKIP)
                findNavController().popBackStack()
            }
        )
    }
}
