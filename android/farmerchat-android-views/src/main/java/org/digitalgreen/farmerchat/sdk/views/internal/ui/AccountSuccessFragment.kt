package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.OnBackPressedCallback
import androidx.navigation.NavOptions
import androidx.navigation.fragment.findNavController
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.internal.BaseFragment
import org.digitalgreen.farmerchat.sdk.views.internal.util.FarmerIllustrations
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.FullScreenMessageView

/** AccountSuccess (doc 01 §3.6): Continue / back → Home, popUpTo(AccountBenefits){inclusive}. */
internal class AccountSuccessFragment : BaseFragment(0) {

    override val analyticsScreenName: String = AnalyticsScreens.ACCOUNT_SUCCESS

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = FullScreenMessageView(requireContext())

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        (view as FullScreenMessageView).bind(
            title = label(Labels.ALL_SET, "All set"),
            mainMessage = label(Labels.YOURE_ALL_SET, "You're all set!"),
            subtitle = label(
                Labels.PREVIOUS_QUESTIONS_MENU,
                "Find your previous questions in the menu and continue anytime."
            ),
            primaryCtaLabel = label(Labels.CONTINUE, "Continue"),
            onPrimaryCta = { goHome() },
            illustrationAsset = FarmerIllustrations.LOOKING_AT_SKY,
            leftIconRes = null,
            onLeftClick = null
        )

        requireActivity().onBackPressedDispatcher.addCallback(
            viewLifecycleOwner,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    goHome()
                }
            }
        )
    }

    private fun goHome() {
        graph.analytics.track(AnalyticsEvents.SIGNUP_CONTINUE_CLICKED)
        val nav = findNavController()
        // popUpTo(AccountBenefits){inclusive}; falls back to clearing the stack
        // when Auth was reached directly (bypass_interstitial).
        val options = NavOptions.Builder()
            .setLaunchSingleTop(true)
            .setPopUpTo(R.id.fc_dest_account_benefits, inclusive = true)
            .build()
        nav.navigate(R.id.fc_dest_home, null, options)
    }
}
