package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.os.Bundle
import android.view.View
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import androidx.navigation.fragment.findNavController
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.UserNameRequest
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.name.EnterNameViewModel
import org.digitalgreen.farmerchat.sdk.core.ui.name.UserNameAction
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcFragmentEnterNameBinding
import org.digitalgreen.farmerchat.sdk.views.internal.BaseFragment
import org.digitalgreen.farmerchat.sdk.views.internal.NavRoutes
import org.digitalgreen.farmerchat.sdk.views.internal.coreVm
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.PrimaryButtonView
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.ToastView

/**
 * Enter Name onboarding (doc 01 §3.3): normalized input, Save (min 3 / max 100),
 * Skip hidden once text entered; success/skip → KEY_NAME_DONE + routeFromSplash.
 */
internal class EnterNameFragment : BaseFragment(R.layout.fc_fragment_enter_name) {

    override val analyticsScreenName: String = AnalyticsScreens.NAME

    private val vm: EnterNameViewModel by lazy { coreVm("enter_name") { graph.enterNameViewModel() } }

    private lateinit var binding: FcFragmentEnterNameBinding
    private var navigated = false

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FcFragmentEnterNameBinding.bind(view)

        graph.routeDecider.markNameScreenSeen()

        binding.fcNameTitle.text = label(Labels.WHAT_SHOULD_WE_CALL_YOU, "What should we call you?")
        binding.fcNameSubtitle.text = label(Labels.WE_GREET_YOU_NAME, "So we can greet you by name")
        binding.fcNameInput.hint = label(Labels.YOUR_NAME_OR_NICKNAME, "Your name or nickname")
        binding.fcNameSaveButton.text = label(Labels.SAVE_NAME, "Save name")
        binding.fcNameSkipButton.text = label(Labels.SKIP_FOR_NOW, "Skip for now")

        // Prefill saved name (sanitized against backend placeholders).
        val savedName = EnterNameViewModel.sanitizeName(
            graph.prefs.getString(SdkPreferences.Keys.USER_NAME, "")
        )
        if (savedName.isNotBlank()) binding.fcNameInput.setText(savedName)

        binding.fcNameInput.doAfterTextChanged { editable ->
            val raw = editable?.toString().orEmpty()
            val normalized = EnterNameViewModel.normalizeNameInput(raw)
            if (normalized != raw) {
                binding.fcNameInput.setText(normalized)
                binding.fcNameInput.setSelection(normalized.length)
                return@doAfterTextChanged
            }
            binding.fcNameSkipButton.isVisible = normalized.isBlank()
            binding.fcNameSaveButton.state = if (normalized.isNotBlank()) {
                PrimaryButtonView.State.CHEVRON
            } else {
                PrimaryButtonView.State.DEFAULT
            }
            binding.fcNameSaveButton.setButtonEnabled(
                normalized.isNotBlank() && normalized.length <= EnterNameViewModel.MAX_NAME_LENGTH
            )
        }
        binding.fcNameSkipButton.isVisible = binding.fcNameInput.text.isNullOrBlank()
        binding.fcNameSaveButton.setButtonEnabled(!binding.fcNameInput.text.isNullOrBlank())

        binding.fcNameSaveButton.setOnClickListener { save() }
        binding.fcNameSkipButton.setOnClickListener { skip() }

        binding.fcNameInput.requestFocus()

        vm.state.collectWhenStarted { state ->
            when (val update = state.updateUserNameState) {
                is UiState.Loading -> {
                    binding.fcNameSaveButton.state = PrimaryButtonView.State.LOADING
                    binding.fcNameSaveButton.text = label(Labels.SAVING, "Saving")
                }
                is UiState.Success -> {
                    binding.fcNameSaveButton.state = PrimaryButtonView.State.DEFAULT
                    binding.fcNameSaveButton.text = label(Labels.SAVE_NAME, "Save name")
                    if (!navigated) {
                        navigated = true
                        graph.prefs.putBoolean(SdkPreferences.Keys.KEY_NAME_DONE, true)
                        vm.onAction(UserNameAction.ConsumeUpdateResult, AnalyticsScreens.NAME)
                        NavRoutes.navigateFromSplash(
                            findNavController(), graph.routeDecider.routeFromSplash()
                        )
                    }
                }
                is UiState.Error -> {
                    binding.fcNameSaveButton.state = PrimaryButtonView.State.DEFAULT
                    binding.fcNameSaveButton.text = label(Labels.SAVE_NAME, "Save name")
                    binding.fcNameToast.show(update.message, ToastView.Type.ERROR)
                    vm.onAction(UserNameAction.ConsumeUpdateResult, AnalyticsScreens.NAME)
                }
                is UiState.Idle -> binding.fcNameSaveButton.state = PrimaryButtonView.State.DEFAULT
            }
        }
    }

    private fun save() {
        val name = EnterNameViewModel.normalizeNameInput(
            binding.fcNameInput.text?.toString().orEmpty()
        ).trim()
        if (name.length < EnterNameViewModel.MIN_NAME_LENGTH) {
            binding.fcNameToast.show(
                "${label(Labels.NAME_MUST_BE_AT_LEAST, "Name must be at least")} " +
                    "${EnterNameViewModel.MIN_NAME_LENGTH} ${label(Labels.CHARACTERS, "characters")}",
                ToastView.Type.ERROR
            )
            return
        }
        if (name.length > EnterNameViewModel.MAX_NAME_LENGTH) {
            binding.fcNameToast.show(
                "${label(Labels.NAME_MUST_BE_AT_MOST, "Name must be at most")} " +
                    "${EnterNameViewModel.MAX_NAME_LENGTH} ${label(Labels.CHARACTERS, "characters")}",
                ToastView.Type.ERROR
            )
            return
        }
        val userId = graph.prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "")
        vm.onAction(
            UserNameAction.UpdateUserName(UserNameRequest(user_id = userId, name = name)),
            AnalyticsScreens.NAME
        )
    }

    private fun skip() {
        graph.analytics.track(
            AnalyticsEvents.NAME_SKIP_CLICK,
            mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.NAME)
        )
        graph.prefs.putBoolean(SdkPreferences.Keys.KEY_NAME_DONE, true)
        NavRoutes.navigateFromSplash(findNavController(), graph.routeDecider.routeFromSplash())
    }
}
