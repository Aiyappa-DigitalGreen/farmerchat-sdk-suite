package org.digitalgreen.farmerchat.sdk.views.internal.ui

import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens
import android.os.Bundle
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.method.LinkMovementMethod
import android.text.style.ClickableSpan
import android.view.View
import androidx.core.view.isVisible
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import kotlinx.coroutines.launch
import androidx.recyclerview.widget.LinearLayoutManager
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.GeoRequestBody
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.onboarding.OnboardingAction
import org.digitalgreen.farmerchat.sdk.core.ui.onboarding.OnboardingSharedViewModel
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcFragmentLanguageBinding
import org.digitalgreen.farmerchat.sdk.views.internal.BaseFragment
import org.digitalgreen.farmerchat.sdk.views.internal.NavRoutes
import org.digitalgreen.farmerchat.sdk.views.internal.activityCoreVm
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.PrimaryButtonView

/**
 * Language onboarding (doc 01 §3.2): geo → guest init → languages list,
 * per-row label fetch, legal links, "Start using FarmerChat".
 */
internal class LanguageFragment : BaseFragment(R.layout.fc_fragment_language) {

    override val analyticsScreenName: String = AnalyticsScreens.LANGUAGE

    // Shared between Splash and Language in the app (OnboardingSharedViewModel).
    private val vm: OnboardingSharedViewModel by lazy {
        activityCoreVm("onboarding") { graph.onboardingViewModel() }
    }

    private lateinit var binding: FcFragmentLanguageBinding
    private lateinit var adapter: LanguageListAdapter
    private var navigatedOnSuccess = false

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FcFragmentLanguageBinding.bind(view)

        adapter = LanguageListAdapter(showHeader = true) { language ->
            vm.onAction(OnboardingAction.SelectLanguage(language.id))
        }
        binding.fcLanguageList.layoutManager = LinearLayoutManager(requireContext())
        binding.fcLanguageList.adapter = adapter

        binding.fcLanguageStartButton.setOnClickListener {
            vm.onAction(OnboardingAction.AcceptTerms)
            vm.onAction(OnboardingAction.GetStartedClicked)
        }

        if (!graph.prefs.getBoolean(SdkPreferences.Keys.LANGUAGE_DONE, false)) {
            // ResetState only when re-entering before completion (app parity).
            if (vm.state.value.languageSubmitSuccess) {
                vm.onAction(OnboardingAction.ResetState)
            }
        }
        vm.onAction(OnboardingAction.FetchGeoLocation(GeoRequestBody(), fromScreen = "language"))
        vm.onAction(OnboardingAction.FetchLegalLinks)

        vm.state.collectWhenStarted { state ->
            renderTexts()

            val languagesLoaded = state.languageState is UiState.Success
            binding.fcLanguageLoading.isVisible = !languagesLoaded
            binding.fcLanguageContent.isVisible = languagesLoaded
            if (!languagesLoaded) {
                binding.fcLanguageLoading.text = when (state.languageState) {
                    is UiState.Loading -> label(Labels.LOADING_LANGUAGES, "Loading languages...")
                    else -> label(Labels.FARMERCHAT_STARTING, "FarmerChat is Starting...")
                }
            }

            (state.languageState as? UiState.Success)?.let { success ->
                adapter.submit(
                    priorityLanguages = success.data,
                    expandedLanguages = state.expandedLanguages,
                    selectedLanguageId = state.selectedLanguageId,
                    fetchingLabelsForId = state.fetchingLabelsForId
                )
            }

            binding.fcLanguageStartButton.state = when {
                state.isSubmittingLanguage -> PrimaryButtonView.State.LOADING
                else -> PrimaryButtonView.State.CHEVRON
            }
            binding.fcLanguageStartButton.text = if (state.isSubmittingLanguage) {
                label(Labels.SETTING_LANGUAGE, "Setting language")
            } else {
                label(Labels.START_USING_FARMERCHAT, "Start using FarmerChat")
            }
            binding.fcLanguageStartButton.setButtonEnabled(
                state.selectedLanguageId != null && !state.isFetchingLabels
            )

            renderLegal(state.termsOfUseUrl, state.privacyPolicyUrl)

            if (state.languageSubmitSuccess && !navigatedOnSuccess) {
                navigatedOnSuccess = true
                vm.onAction(OnboardingAction.ConsumeLanguageResult)
                if (graph.config.mode == org.digitalgreen.farmerchat.sdk.FarmerChatMode.CHAT_ONLY) {
                    // CHAT_ONLY's first-launch language screen: on to the chat (never Name/Home),
                    // honouring any pending openChat target. ensureChatOnlySession is required —
                    // this screen never creates the conversation (new_conversation); its session
                    // and labels make the rest of that bootstrap a no-op.
                    val nav = findNavController()
                    viewLifecycleOwner.lifecycleScope.launch { NavRoutes.enterChatOnly(nav) }
                } else {
                    NavRoutes.navigateFromSplash(findNavController(), graph.routeDecider.routeFromSplash())
                }
            }

            if (state.shouldNavigateToError) {
                vm.onAction(OnboardingAction.ConsumeErrorNavigation)
                findNavController().navigate(
                    R.id.fc_dest_error,
                    NavRoutes.errorArgs(state.errorIsNetworkError, state.errorFromScreen),
                    NavRoutes.singleTop()
                )
            }
        }
    }

    private fun renderTexts() {
        adapter.headerTitle = label(Labels.CHOOSE_YOUR_LANGUAGE, "Choose your language")
        adapter.headerSubtitle = label(Labels.YOU_CHANGE_LATER, "You can change this later")
        adapter.expanderLabel = label(Labels.ALL_LANGUAGES, "All languages")
        binding.fcLanguageTagline.text = label(
            Labels.FARMERCHAT_TAGLINE,
            "FarmerChat: Practical advice for your crops & livestock"
        )
    }

    /**
     * One flowing, justified consent paragraph with the two legal links inline.
     *
     * App parity (LanguageScreen.kt 47bc8524): the intro and the links used to be two separate
     * TextViews, which hard-broke the paragraph and left a short centred stub line between them.
     * They are one span now, joined by the served `also_see` connector instead of a bare "·",
     * with the trailing "." outside the link span so it is neither underlined nor clickable.
     */
    private fun renderLegal(termsUrl: String?, privacyUrl: String?) {
        val intro = label(
            Labels.BY_CONTINUING_YOU_AGREE_TO_OUR,
            // App b72ea4da widened this fallback to name the AI up front.
            "FarmerChat uses AI. By continuing, you agree to our"
        )
        val terms = label(Labels.TERMS_OF_USE, "Terms of use")
        val privacy = label(Labels.PRIVACY_POLICY, "Privacy policy")
        val alsoSee = label(Labels.ALSO_SEE, "also see").trim()

        // Resolved ONCE, here: `updateDrawState` runs at draw time, and `requireContext()`
        // inside it throws the moment the fragment detaches mid-animation.
        // App `TextLinkStyles(color = foregroundSecondary)` (LanguageScreen.kt) — the links keep
        // the paragraph's grey and differ only by the underline.
        val linkColor = FcTokens.color(requireContext(), R.color.fc_foreground_secondary)

        val builder = SpannableStringBuilder()
        builder.append(intro)
        builder.append(" ")
        appendLink(builder, terms, termsUrl, linkColor) { url ->
            graph.analytics.track(
                AnalyticsEvents.TERMS_OF_USE_OPENED,
                mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.LANGUAGE)
            ) // app LanguageScreen.kt:315
            openLegal(url, terms)
        }
        builder.append(" ")
        // The connector is served (`fc_v2_app_label_also_see` = "also see" on DEV). A tenant that
        // serves it empty simply gets the two links separated by one space, as the app degrades.
        if (alsoSee.isNotEmpty()) {
            builder.append(alsoSee)
            builder.append(" ")
        }
        appendLink(builder, privacy, privacyUrl, linkColor) { url ->
            graph.analytics.track(
                AnalyticsEvents.PRIVACY_POLICY_OPENED,
                mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.LANGUAGE)
            ) // app LanguageScreen.kt:339
            openLegal(url, privacy)
        }
        builder.append(".")

        binding.fcLanguageLegal.text = builder
        binding.fcLanguageLegal.movementMethod = LinkMovementMethod.getInstance()
    }

    private fun appendLink(
        builder: SpannableStringBuilder,
        text: String,
        url: String?,
        linkColor: Int,
        onClick: (String) -> Unit
    ) {
        val start = builder.length
        builder.append(text)
        builder.setSpan(
            android.text.style.UnderlineSpan(),
            start, builder.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
        )
        if (!url.isNullOrBlank()) {
            builder.setSpan(
                object : ClickableSpan() {
                    override fun onClick(widget: View) {
                        onClick(url)
                    }

                    override fun updateDrawState(ds: android.text.TextPaint) {
                        ds.isUnderlineText = true
                        // No link blue: the span restates the paragraph's own secondary grey.
                        ds.color = linkColor
                    }
                },
                start, builder.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            )
        }
    }

    private fun openLegal(url: String, title: String) {
        findNavController().navigate(
            R.id.fc_dest_legal_content,
            NavRoutes.legalArgs(url, title),
            NavRoutes.singleTop()
        )
    }
}
