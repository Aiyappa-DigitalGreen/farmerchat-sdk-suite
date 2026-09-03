package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.os.Bundle
import android.view.View
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.analytics.appearanceAnalyticsValue
import org.digitalgreen.farmerchat.sdk.core.base.ApiResult
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.network.NetworkUtils
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.name.EnterNameViewModel
import org.digitalgreen.farmerchat.sdk.core.ui.profile.UserProfileViewModel
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcFragmentSettingsBinding
import org.digitalgreen.farmerchat.sdk.views.internal.BaseFragment
import org.digitalgreen.farmerchat.sdk.views.internal.NavRoutes
import org.digitalgreen.farmerchat.sdk.views.internal.coreVm
import org.digitalgreen.farmerchat.sdk.views.internal.journeyHost
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.ToastView

/** Settings (doc 01 §3.10): appearance selector, name row, logout / sign up. */
internal class SettingsFragment : BaseFragment(R.layout.fc_fragment_settings) {

    override val analyticsScreenName: String = AnalyticsScreens.SETTINGS

    private val profileVm: UserProfileViewModel by lazy {
        coreVm("settings_profile") { graph.userProfileViewModel() }
    }

    private lateinit var binding: FcFragmentSettingsBinding

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FcFragmentSettingsBinding.bind(view)

        renderTexts()
        binding.fcSettingsAppBar.fcAppBarLeft.setOnClickListener { journeyHost()?.openDrawer() }

        binding.fcModeDay.setOnClickListener { onAppearanceSelected("day") }
        binding.fcModeNight.setOnClickListener { onAppearanceSelected("night") }
        binding.fcModeAuto.setOnClickListener { onAppearanceSelected("auto") }
        renderAppearanceSelection()

        binding.fcNameRow.setOnClickListener {
            graph.analytics.track(AnalyticsEvents.EDIT_PROFILE_CLICK)
            findNavController().navigate(R.id.fc_dest_settings_name)
        }

        binding.fcLogoutButton.setOnClickListener {
            if (graph.sessionManager.isAuthenticated.value) {
                logout()
            } else {
                // App SettingsScreen.kt:353 — `option` only, no `value`.
                graph.analytics.track(
                    AnalyticsEvents.SETTINGS_OPTION_SELECTED,
                    mapOf(AnalyticsProps.OPTION_LOWER to "Signup")
                )
                handleSignUpClick()
            }
        }

        // Fetch profile on entry (graph parity) — updates USER_NAME pref.
        profileVm.fetchProfile(fromScreen = "settings")
        profileVm.profileState.collectWhenStarted {
            binding.fcNameRowValue.text = EnterNameViewModel.sanitizeName(
                graph.prefs.getString(SdkPreferences.Keys.USER_NAME, "")
            )
        }

        // "Your name has been updated." toast, delayed 500 ms (doc 01 §3.10),
        // flagged by SettingsName via the back-stack savedStateHandle.
        val savedStateHandle = findNavController().currentBackStackEntry?.savedStateHandle
        if (savedStateHandle?.get<Boolean>(NAME_UPDATED_TOAST_FLAG) == true) {
            savedStateHandle.remove<Boolean>(NAME_UPDATED_TOAST_FLAG)
            viewLifecycleOwner.lifecycleScope.launch {
                delay(500L)
                binding.fcSettingsToast.show(
                    label(Labels.YOUR_NAME_HAS_UPDATED, "Your name has been updated."),
                    ToastView.Type.SUCCESS
                )
            }
        }
    }

    private fun renderTexts() {
        binding.fcSettingsAppBar.fcAppBarTitle.text = label(Labels.SETTINGS, "Settings")
        binding.fcAppearanceTitle.text = label(Labels.APPEARANCE, "Appearance")
        binding.fcModeDayLabel.text = label(Labels.DAY, "Day")
        binding.fcModeNightLabel.text = label(Labels.NIGHT, "Night")
        binding.fcModeAutoLabel.text = label(Labels.AUTO, "Auto")
        binding.fcAccountTitle.text = label(Labels.ACCOUNT_DETAILS, "Account details")
        binding.fcNameRowLabel.text = label(Labels.YOUR_NAME, "Your name")
        binding.fcNameRowValue.text = EnterNameViewModel.sanitizeName(
            graph.prefs.getString(SdkPreferences.Keys.USER_NAME, "")
        )
        binding.fcLogoutButton.text = if (graph.sessionManager.isAuthenticated.value) {
            label(Labels.LOGOUT, "Logout")
        } else {
            label(Labels.SIGN_UP, "Sign up")
        }
    }

    private fun currentMode(): String =
        graph.prefs.getString(SdkPreferences.Keys.APPEARANCE_MODE, "auto")
            .trim().lowercase().ifBlank { "auto" }

    private fun onAppearanceSelected(mode: String) {
        graph.prefs.putString(SdkPreferences.Keys.APPEARANCE_MODE, mode)
        graph.analytics.track(
            AnalyticsEvents.SETTINGS_OPTION_SELECTED,
            // App SettingsScreen.kt:150 — lowercase `option`/`value` keys, and the
            // value is the app's AppearanceMode label (Light / Dark / Default).
            mapOf(
                AnalyticsProps.OPTION_LOWER to "Appearance",
                AnalyticsProps.VALUE_LOWER to appearanceAnalyticsValue(mode)
            )
        )
        journeyHost()?.applyAppearance(mode)
        renderAppearanceSelection()
    }

    private fun renderAppearanceSelection() {
        val mode = currentMode()
        fun styleButton(container: View, selected: Boolean) {
            container.background = ContextCompat.getDrawable(
                requireContext(),
                if (selected) R.drawable.fc_bg_selected_option else R.drawable.fc_bg_card_md
            )
        }
        styleButton(binding.fcModeDay, mode == "day")
        styleButton(binding.fcModeNight, mode == "night")
        styleButton(binding.fcModeAuto, mode == "auto")
        binding.fcAppearanceHint.text = when (mode) {
            "day" -> label(Labels.FARMERCHAT_ALWAYS_LIGHT_MODE, "FarmerChat is always in light mode")
            "night" -> label(Labels.FARMERCHAT_ALWAYS_DARK_MODE, "FarmerChat is always in dark mode")
            else -> label(
                Labels.FARMERCHAT_ADJUSTS_YOUR_PHONE_SETTINGS,
                "FarmerChat adjusts with your phone settings"
            )
        }
    }

    /** Logout (doc 01 §2): clear session → Splash, popUpTo(0){inclusive}. */
    private fun logout() {
        graph.analytics.track(
            AnalyticsEvents.LOGOUT_CLICK_EVENT,
            // App AppNavGraph.kt:586.
            mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.SETTINGS)
        )
        val nav = findNavController()
        FarmerChat.logout {
            if (isAdded) {
                nav.navigate(R.id.fc_dest_splash, null, NavRoutes.clearStackOptions(nav))
            }
        }
    }

    private fun handleSignUpClick() {
        if (!NetworkUtils.isOnline(requireContext())) {
            findNavController().navigate(
                R.id.fc_dest_error,
                NavRoutes.errorArgs(isNetworkError = true, fromScreen = "auth"),
                NavRoutes.singleTop()
            )
            return
        }
        viewLifecycleOwner.lifecycleScope.launch {
            val result = graph.homeUseCase.getUserQuestionCount().first()
            val bypass = (result as? ApiResult.Success)?.data?.bypass_interstitial == true
            if (isAdded) {
                findNavController().navigate(
                    if (bypass) R.id.fc_dest_auth else R.id.fc_dest_account_benefits
                )
            }
        }
    }

    companion object {
        /** savedStateHandle flag set by SettingsName on success (toast on return). */
        const val NAME_UPDATED_TOAST_FLAG = "fc_views_show_name_updated_toast"
    }
}
