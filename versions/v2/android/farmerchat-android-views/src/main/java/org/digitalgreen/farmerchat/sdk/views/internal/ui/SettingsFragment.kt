package org.digitalgreen.farmerchat.sdk.views.internal.ui

import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens
import android.os.Bundle
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
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
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationPromptState
import org.digitalgreen.farmerchat.sdk.core.ui.location.LocationTriggerSource
import org.digitalgreen.farmerchat.sdk.core.ui.name.EnterNameViewModel
import org.digitalgreen.farmerchat.sdk.core.ui.profile.UserProfileViewModel
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcFragmentSettingsBinding
import org.digitalgreen.farmerchat.sdk.views.internal.BaseFragment
import org.digitalgreen.farmerchat.sdk.views.internal.NavRoutes
import org.digitalgreen.farmerchat.sdk.views.internal.coreVm
import org.digitalgreen.farmerchat.sdk.views.internal.journeyHost
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.ToastView
import org.digitalgreen.farmerchat.sdk.views.internal.util.applySystemBarBackdrop
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcRecolor

/** Settings (doc 01 §3.10): appearance selector, name row, logout / sign up. */
internal class SettingsFragment : BaseFragment(R.layout.fc_fragment_settings) {

    override val analyticsScreenName: String = AnalyticsScreens.SETTINGS

    private val profileVm: UserProfileViewModel by lazy {
        coreVm("settings_profile") { graph.userProfileViewModel() }
    }

    private lateinit var binding: FcFragmentSettingsBinding

    /** True while a location flow started FROM THIS ROW is running; drives the completion toast. */
    private var wasLocationFlowActive: Boolean = false

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FcFragmentSettingsBinding.bind(view)
        // Green status-bar inset + surface nav-bar strip, as the app paints them.
        binding.root.applySystemBarBackdrop()

        renderTexts()
        binding.fcSettingsAppBar.fcAppBarLeft.setOnClickListener { journeyHost()?.openDrawer() }
        // App parity (DefaultAppBar leftRadius @ 1b961130/b193a95c): the round chip, not the
        // 12dp square. The app left SettingsName and onboarding Language on Radius.MD.
        binding.fcSettingsAppBar.fcAppBarLeft.setBackgroundResource(R.drawable.fc_bg_appbar_chip_round)
        // Set after inflation, so the inflater recolor never saw it.
        FcRecolor.maybeRecolor(binding.fcSettingsAppBar.fcAppBarLeft)
        binding.fcModeDay.setOnClickListener { onAppearanceSelected("day") }
        binding.fcModeNight.setOnClickListener { onAppearanceSelected("night") }
        binding.fcModeAuto.setOnClickListener { onAppearanceSelected("auto") }
        renderAppearanceSelection()

        binding.fcNameRow.setOnClickListener {
            graph.analytics.track(AnalyticsEvents.EDIT_PROFILE_CLICK)
            findNavController().navigate(R.id.fc_dest_settings_name)
        }

        binding.fcLocationRow.setOnClickListener {
            // App parity (SettingsScreen.kt:300): the row only starts a flow when none is running.
            if (graph.locationPromptManager.state.value == LocationPromptState.Idle) {
                graph.locationPromptManager.triggerFromSettings()
            }
        }
        observeLocationRow()

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
        profileVm.profileState.collectWhenStarted { renderNameValue() }

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

    /**
     * App parity (compose SettingsScreen.kt:394): an empty name shows the em-dash placeholder,
     * exactly like the phone row above.
     *
     * ONE function because there are TWO writers — `renderTexts()` on entry and the profile-state
     * collector once the fetch lands. They had drifted: only one applied the placeholder, and the
     * collector ran second, so it overwrote the em-dash with an empty string every time and the
     * row rendered with a blank value column.
     */
    private fun renderNameValue() {
        binding.fcNameRowValue.text = EnterNameViewModel.sanitizeName(
            graph.prefs.getString(SdkPreferences.Keys.USER_NAME, "")
        ).trim().takeIf { it.isNotEmpty() } ?: "\u2014"
    }

    private fun renderTexts() {
        binding.fcSettingsAppBar.fcAppBarTitle.text = label(Labels.SETTINGS, "Settings")
        binding.fcAppearanceTitle.text = label(Labels.APPEARANCE, "Appearance")
        binding.fcModeDayLabel.text = label(Labels.DAY, "Day")
        binding.fcModeNightLabel.text = label(Labels.NIGHT, "Night")
        binding.fcModeAutoLabel.text = label(Labels.AUTO, "Auto")
        binding.fcAccountTitle.text = label(Labels.ACCOUNT_DETAILS, "Account details")
        // Read-only phone row — app parity (SettingsScreen.kt:310). The number comes from
        // PHONE_NUMBER_LOGIN, written by SessionManager.onOtpVerified, so a guest sees an em dash
        // exactly as on the compose flavour.
        binding.fcMyFarmTitle.text = label(Labels.MY_FARM, "My Farm")
        binding.fcLocationRowLabel.text = label(Labels.LOCATION, "Location")
        binding.fcPhoneRowLabel.text = label(Labels.YOUR_PHONE, "Your phone")
        binding.fcPhoneRowValue.text = graph.prefs
            .getString(SdkPreferences.Keys.PHONE_NUMBER_LOGIN, "")
            .trim()
            .takeIf { it.isNotEmpty() }
            ?: "\u2014"
        binding.fcNameRowLabel.text = label(Labels.YOUR_NAME, "Your name")
        renderNameValue()
        binding.fcLogoutButton.text = if (graph.sessionManager.isAuthenticated.value) {
            label(Labels.LOGOUT, "Logout")
        } else {
            label(Labels.SIGN_UP, "Sign up")
        }
    }

    private fun currentMode(): String =
        graph.prefs.getString(SdkPreferences.Keys.APPEARANCE_MODE, "auto")
            .trim().lowercase().ifBlank { "auto" }

    /**
     * "My Farm" location row. Compose parity (SettingsScreen.kt:279-345).
     *
     * Only reacts to states raised by THIS row (`source == Settings`) so a location flow started
     * from Home does not make Settings look like it is updating too — the same filter the compose
     * flavour applies.
     */
    private fun observeLocationRow() {
        // `collectWhenStarted` (BaseFragment) rather than a bare lifecycleScope.launch: the row
        // touches `binding`, so the collector must not run while the view is stopped.
        //
        // It also removes the need for a separate resume hook. A permission granted or revoked in
        // system Settings does not change the flow's value, but StateFlow replays its current
        // value to every new collector, and repeatOnLifecycle re-collects on each STARTED — so
        // coming back from system Settings re-renders the row anyway.
        graph.locationPromptManager.state.collectWhenStarted { renderLocationRow(it) }
    }

    private fun renderLocationRow(state: LocationPromptState) {
        if (!isAdded) return

        val isActive = when (state) {
            is LocationPromptState.RequestPermission -> state.source == LocationTriggerSource.Settings
            is LocationPromptState.RequestEnableGps -> state.source == LocationTriggerSource.Settings
            is LocationPromptState.FetchingLocation -> state.source == LocationTriggerSource.Settings
            else -> false
        }

        val hasExact = graph.locationPromptManager.hasStoredLocation() && hasLocationPermission()
        val placeName = graph.prefs.getString(SdkPreferences.Keys.APPROX_LOCATION_NAME, "")

        binding.fcLocationRowSpinner.isVisible = isActive
        binding.fcLocationRowValue.text = when {
            isActive -> label(Labels.GETTING_YOUR_LOCATION, "Getting your location")
            placeName.isBlank() -> "\u2014"
            // An approximate (pre-permission) place is qualified inline, worded separately from
            // the "Estimated" helper below — the app words the two differently on purpose.
            !hasExact -> "$placeName (${label(Labels.APPROXIMATE, "approximate")})"
            else -> placeName
        }

        val accent = FcTokens.color(requireContext(), R.color.fc_green700)
        binding.fcLocationHelper.text = SpannableStringBuilder().apply {
            if (hasExact) {
                append(label(Labels.LOCATION_HELPER_ADVICE_WEATHER, "Advice and weather for this area."))
                append(" ")
                val start = length
                append(label(Labels.LOCATION_HELPER_CHANGE_ANYTIME, "Change anytime."))
                setSpan(ForegroundColorSpan(accent), start, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            } else {
                append(label(Labels.ESTIMATED, "Estimated"))
                append(". ")
                val start = length
                append(label(Labels.LOCATION_HELPER_SHARE, "Share your location for better advice."))
                setSpan(ForegroundColorSpan(accent), start, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
        }

        // Flow just finished successfully → the app confirms with a toast.
        if (wasLocationFlowActive && state == LocationPromptState.Idle && hasExact) {
            binding.fcSettingsToast.show(
                label(Labels.LOCATION_FOUND, "Location found"),
                ToastView.Type.SUCCESS
            )
        }
        wasLocationFlowActive = isActive
    }

    /** FINE only — the same check the location manager's decision tree uses (app parity). */
    private fun hasLocationPermission(): Boolean =
        graph.locationPromptManager.hasCurrentLocationPermission()


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
                if (selected) R.drawable.fc_bg_appearance_tile_selected
                else R.drawable.fc_bg_appearance_tile
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
