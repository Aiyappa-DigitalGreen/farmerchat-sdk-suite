package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.os.Bundle
import android.view.View
import androidx.core.widget.doAfterTextChanged
import androidx.navigation.fragment.findNavController
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.UserNameRequest
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.name.EnterNameViewModel
import org.digitalgreen.farmerchat.sdk.core.ui.name.UserNameAction
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcFragmentSettingsNameBinding
import org.digitalgreen.farmerchat.sdk.views.internal.BaseFragment
import org.digitalgreen.farmerchat.sdk.views.internal.coreVm
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.PrimaryButtonView
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.ToastView

/** Settings → Name (doc 01 §3.11). */
internal class SettingsNameFragment : BaseFragment(R.layout.fc_fragment_settings_name) {

    override val analyticsScreenName: String = AnalyticsScreens.SETTINGS_NAME

    private val vm: EnterNameViewModel by lazy {
        coreVm("settings_name") { graph.enterNameViewModel() }
    }

    private lateinit var binding: FcFragmentSettingsNameBinding
    private var completed = false

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FcFragmentSettingsNameBinding.bind(view)

        binding.fcSettingsNameAppBar.fcAppBarTitle.text = label(Labels.NAME, "Name")
        binding.fcSettingsNameAppBar.fcAppBarLeft.setImageResource(R.drawable.fc_ic_back)
        binding.fcSettingsNameInput.hint = label(Labels.ENTER_YOUR_NAME, "Enter your name")
        binding.fcSettingsNameSave.text = label(Labels.SAVE_NAME, "Save name")
        binding.fcSettingsNameAppBar.fcAppBarLeft.setOnClickListener { findNavController().popBackStack() }

        val savedName = EnterNameViewModel.sanitizeName(
            graph.prefs.getString(SdkPreferences.Keys.USER_NAME, "")
        )
        binding.fcSettingsNameInput.setText(savedName)
        binding.fcSettingsNameInput.setSelection(savedName.length)

        binding.fcSettingsNameInput.doAfterTextChanged { editable ->
            val raw = editable?.toString().orEmpty()
            val normalized = EnterNameViewModel.normalizeNameInput(raw)
            if (normalized != raw) {
                binding.fcSettingsNameInput.setText(normalized)
                binding.fcSettingsNameInput.setSelection(normalized.length)
            }
        }

        binding.fcSettingsNameSave.setOnClickListener { save() }

        vm.state.collectWhenStarted { state ->
            when (val update = state.updateUserNameState) {
                is UiState.Loading ->
                    binding.fcSettingsNameSave.state = PrimaryButtonView.State.LOADING
                is UiState.Success -> {
                    binding.fcSettingsNameSave.state = PrimaryButtonView.State.DEFAULT
                    if (!completed) {
                        completed = true
                        vm.onAction(UserNameAction.ConsumeUpdateResult, AnalyticsScreens.SETTINGS)
                        findNavController().previousBackStackEntry?.savedStateHandle?.set(
                            SettingsFragment.NAME_UPDATED_TOAST_FLAG, true
                        )
                        findNavController().popBackStack()
                    }
                }
                is UiState.Error -> {
                    binding.fcSettingsNameSave.state = PrimaryButtonView.State.DEFAULT
                    binding.fcSettingsNameToast.show(update.message, ToastView.Type.ERROR)
                    vm.onAction(UserNameAction.ConsumeUpdateResult, AnalyticsScreens.SETTINGS)
                }
                is UiState.Idle ->
                    binding.fcSettingsNameSave.state = PrimaryButtonView.State.DEFAULT
            }
        }
    }

    private fun save() {
        val name = EnterNameViewModel.normalizeNameInput(
            binding.fcSettingsNameInput.text?.toString().orEmpty()
        ).trim()
        if (name.length < EnterNameViewModel.MIN_NAME_LENGTH) {
            binding.fcSettingsNameToast.show(
                "${label(Labels.NAME_MUST_BE_AT_LEAST, "Name must be at least")} " +
                    "${EnterNameViewModel.MIN_NAME_LENGTH} ${label(Labels.CHARACTERS, "characters")}",
                ToastView.Type.ERROR
            )
            return
        }
        if (name.length > EnterNameViewModel.MAX_NAME_LENGTH) {
            binding.fcSettingsNameToast.show(
                "${label(Labels.NAME_MUST_BE_AT_MOST, "Name must be at most")} " +
                    "${EnterNameViewModel.MAX_NAME_LENGTH} ${label(Labels.CHARACTERS, "characters")}",
                ToastView.Type.ERROR
            )
            return
        }
        val userId = graph.prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "")
        vm.onAction(
            UserNameAction.UpdateUserName(UserNameRequest(user_id = userId, name = name)),
            AnalyticsScreens.SETTINGS
        )
    }
}
