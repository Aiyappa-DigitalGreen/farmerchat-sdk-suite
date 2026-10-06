package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.os.Bundle
import android.view.View
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.recyclerview.widget.LinearLayoutManager
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.ui.settings.SettingsViewModel
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcFragmentLanguageChooserBinding
import org.digitalgreen.farmerchat.sdk.views.internal.BaseFragment
import org.digitalgreen.farmerchat.sdk.views.internal.NavRoutes
import org.digitalgreen.farmerchat.sdk.views.internal.coreVm
import org.digitalgreen.farmerchat.sdk.views.internal.journeyHost
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.PrimaryButtonView
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.ToastView
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.views.internal.util.applySystemBarBackdrop
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcRecolor

/** Settings → Language chooser (doc 01 §3.13). */
internal class LanguageChooserFragment : BaseFragment(R.layout.fc_fragment_language_chooser) {

    override val analyticsScreenName: String = AnalyticsScreens.LANGUAGE_SETTINGS

    private val vm: SettingsViewModel by lazy {
        coreVm("settings_language") { graph.settingsViewModel() }
    }

    private lateinit var binding: FcFragmentLanguageChooserBinding
    private lateinit var adapter: LanguageListAdapter
    private var navigated = false

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FcFragmentLanguageChooserBinding.bind(view)
        // Green status-bar inset + surface nav-bar strip, as the app paints them.
        binding.root.applySystemBarBackdrop(bottomRes = R.color.fc_surface_secondary)

        binding.fcChooserAppBar.fcAppBarTitle.text = label(Labels.CHOOSE_YOUR_LANGUAGE, "Choose your language")
        // With the drawer off (CHAT_ONLY) openDrawer() is a no-op, which would strand the user
        // on the language screen — fall back to a plain back navigation.
        // App parity (DefaultAppBar leftRadius @ 1b961130/b193a95c): the round chip, not the
        // 12dp square. The app left SettingsName and onboarding Language on Radius.MD.
        binding.fcChooserAppBar.fcAppBarLeft.setBackgroundResource(R.drawable.fc_bg_appbar_chip_round)
        // Set after inflation, so the inflater recolor never saw it.
        FcRecolor.maybeRecolor(binding.fcChooserAppBar.fcAppBarLeft)
        binding.fcChooserAppBar.fcAppBarLeft.setOnClickListener {
            if (FarmerChat.requireGraph().config.showDrawer) {
                journeyHost()?.openDrawer()
            } else if (findNavController().previousBackStackEntry == null ||
                !findNavController().popBackStack()
            ) {
                // Nothing beneath (a host-opened root): popping would empty the graph.
                NavRoutes.leaveSecondaryScreen(this@LanguageChooserFragment)
            }
        }
        if (!FarmerChat.requireGraph().config.showDrawer) {
            binding.fcChooserAppBar.fcAppBarLeft.setImageResource(R.drawable.fc_ic_back)
        }
        binding.fcChooserSave.text = label(Labels.SAVE_LANGUAGE, "Save language")
        binding.fcChooserLoading.text = label(Labels.LOADING_LANGUAGES, "Loading languages...")

        adapter = LanguageListAdapter(showHeader = false) { language ->
            vm.selectLanguage(language.id, language.code)
        }
        adapter.expanderLabel = label(Labels.ALL_LANGUAGES, "All languages")
        binding.fcChooserList.layoutManager = LinearLayoutManager(requireContext())
        binding.fcChooserList.adapter = adapter

        binding.fcChooserSave.setOnClickListener { vm.submitLanguage() }

        vm.loadLanguages()

        vm.state.collectWhenStarted { state ->
            val loaded = state.languageState is UiState.Success
            binding.fcChooserLoading.isVisible = !loaded && state.languageState is UiState.Loading
            adapter.expanderLabel = label(Labels.ALL_LANGUAGES, "All languages")

            (state.languageState as? UiState.Success)?.let { success ->
                adapter.submit(
                    priorityLanguages = success.data,
                    expandedLanguages = state.expandedLanguages,
                    selectedLanguageId = state.selectedLanguageId,
                    fetchingLabelsForId = state.fetchingLabelsForId
                )
            }

            // Label-fetch / list failure → Home popUpTo(Home) (doc 01 §2).
            if (state.languageState is UiState.Error && !navigated) {
                navigated = true
                // CHAT_ONLY hides Home, so navigateHomeOrChat returns to the chat instead.
                NavRoutes.leaveSecondaryScreen(this@LanguageChooserFragment)
                return@collectWhenStarted
            }

            binding.fcChooserSave.state = if (state.isSubmittingLanguage) {
                PrimaryButtonView.State.LOADING
            } else {
                // App parity (LanguageChooserScreen.kt:285, and compose :238): the idle save
                // button carries a CHEVRON, not the plain Default state.
                PrimaryButtonView.State.CHEVRON
            }
            binding.fcChooserSave.text = if (state.isSubmittingLanguage) {
                label(Labels.SETTING_LANGUAGE, "Setting language")
            } else {
                label(Labels.SAVE_LANGUAGE, "Save language")
            }
            binding.fcChooserSave.setButtonEnabled(
                state.selectedLanguageId != null && loaded &&
                    !state.isFetchingLabels && !state.isSubmittingLanguage
            )

            state.submitErrorMessage?.let { message ->
                binding.fcChooserToast.show(message, ToastView.Type.ERROR)
                vm.consumeLanguageResult()
            }

            // Saved → toast + delayed 500 ms → Home, popUpTo(0){inclusive} (doc 01 §2).
            if (state.languageSubmitSuccess && !navigated) {
                navigated = true
                vm.consumeLanguageResult()
                binding.fcChooserToast.show(
                    label(Labels.LANGUAGE_UPDATED, "Language updated"),
                    ToastView.Type.SUCCESS
                )
                viewLifecycleOwner.lifecycleScope.launch {
                    delay(500L)
                    if (isAdded) {
                        // CHAT_ONLY hides Home — return to the chat with the new language.
                        NavRoutes.leaveSecondaryScreen(this@LanguageChooserFragment)
                    }
                }
            }
        }
    }
}
