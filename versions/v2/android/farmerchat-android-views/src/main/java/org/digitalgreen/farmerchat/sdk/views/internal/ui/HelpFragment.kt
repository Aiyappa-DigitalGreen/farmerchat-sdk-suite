package org.digitalgreen.farmerchat.sdk.views.internal.ui

import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcTokens
import android.animation.ObjectAnimator
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.LinearLayout
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.base.ApiResult
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.HelpSupportData
import org.digitalgreen.farmerchat.sdk.core.navigation.handleError
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcFragmentHelpBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcItemHelpRowBinding
import org.digitalgreen.farmerchat.sdk.views.internal.BaseFragment
import org.digitalgreen.farmerchat.sdk.views.internal.NavRoutes
import org.digitalgreen.farmerchat.sdk.views.internal.journeyHost
import org.digitalgreen.farmerchat.sdk.views.internal.util.dp
import java.util.Locale
import org.digitalgreen.farmerchat.sdk.FarmerChatVersion
import org.digitalgreen.farmerchat.sdk.views.internal.util.applySystemBarBackdrop
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcRecolor

/** Help & Support (doc 01 §3.12): FAQ card (skeleton while loading), More (legal), footer. */
internal class HelpFragment : BaseFragment(R.layout.fc_fragment_help) {

    override val analyticsScreenName: String = AnalyticsScreens.HELP

    private lateinit var binding: FcFragmentHelpBinding
    private val skeletonAnimators = mutableListOf<ObjectAnimator>()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FcFragmentHelpBinding.bind(view)
        // Green status-bar inset + surface nav-bar strip, as the app paints them.
        binding.root.applySystemBarBackdrop()

        binding.fcHelpAppBar.fcAppBarTitle.text = label(Labels.HELP, "Help")
        binding.fcHelpFaqTitle.text =
            label(Labels.HOW_TO_USE_FARMERCHAT, "How to use FarmerChat")
        binding.fcHelpMoreTitle.text = label(Labels.MORE, "More")
        binding.fcHelpVersion.text = "FarmerChat v.$SDK_VERSION"
        binding.fcHelpCopyright.text = label(Labels.DIGITAL_GREEN, "© Digital Green")
        binding.fcHelpAppBar.fcAppBarLeft.setOnClickListener { journeyHost()?.openDrawer() }
        // App parity (DefaultAppBar leftRadius @ 1b961130/b193a95c): the round chip, not the
        // 12dp square. The app left SettingsName and onboarding Language on Radius.MD.
        binding.fcHelpAppBar.fcAppBarLeft.setBackgroundResource(R.drawable.fc_bg_appbar_chip_round)
        // Set after inflation, so the inflater recolor never saw it.
        FcRecolor.maybeRecolor(binding.fcHelpAppBar.fcAppBarLeft)
        showFaqSkeleton()
        loadHelp()
    }

    private fun loadHelp() {
        val prefs = graph.prefs
        val lang = prefs.getString(SdkPreferences.Keys.SELECTED_LANGUAGE_CODE, "")
            .trim().ifBlank { Locale.getDefault().language }
        val savedMode = prefs.getString(SdkPreferences.Keys.APPEARANCE_MODE, "")
            .trim().lowercase()
        val theme = when (savedMode) {
            "day" -> "light"
            "night" -> "dark"
            "auto" -> "default"
            else -> "light"
        }
        val country = prefs.getString(SdkPreferences.Keys.USER_COUNTRY_CODE, "")
            .trim().ifBlank { null }

        viewLifecycleOwner.lifecycleScope.launch {
            graph.getHelpSupportUseCase.getHelpSupport(lang, 5, theme, country)
                .collect { result ->
                    when (result) {
                        is ApiResult.Success -> renderHelp(result.data.data)
                        is ApiResult.Error -> {
                            result.handleError(
                                graph.errorNavigationManager,
                                fromScreen = "help"
                            ) { if (isAdded) loadHelp() }
                        }
                    }
                }
        }
    }

    // ------------------------------------------------------------------ skeleton

    private fun showFaqSkeleton() {
        clearSkeleton()
        binding.fcHelpFaqCard.removeAllViews()
        repeat(3) {
            val row = View(requireContext()).apply {
                setBackgroundColor(
                    FcTokens.color(requireContext(), R.color.fc_skeleton)
                )
            }
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 18.dp(requireContext())
            ).apply {
                val margin = 16.dp(requireContext())
                setMargins(0, margin, 0, 0)
            }
            binding.fcHelpFaqCard.addView(row, params)
            skeletonAnimators += ObjectAnimator.ofFloat(row, "alpha", 1f, 0.4f, 1f).apply {
                duration = 1200L
                repeatCount = ObjectAnimator.INFINITE
                start()
            }
        }
        // Bottom padding for the last skeleton row.
        binding.fcHelpFaqCard.setPadding(listCardSide(), 0, listCardSide(), 16.dp(requireContext()))
    }

    private fun clearSkeleton() {
        skeletonAnimators.forEach { it.cancel() }
        skeletonAnimators.clear()
    }

    // ------------------------------------------------------------------ content

    private fun renderHelp(data: HelpSupportData?) {
        if (!isAdded) return
        clearSkeleton()
        // Back to the ListCard insets (16dp sides, 6dp top, 4dp bottom) — zeroing them put the
        // FAQ rows and their dividers flush against the card edge.
        binding.fcHelpFaqCard.setPadding(listCardSide(), 6.dp(requireContext()), listCardSide(), 4.dp(requireContext()))
        binding.fcHelpFaqCard.removeAllViews()
        binding.fcHelpMoreCard.removeAllViews()

        val faqs = data?.faqs.orEmpty()
        if (faqs.isEmpty()) {
            addRow(
                binding.fcHelpFaqCard,
                label(Labels.NO_FAQS_AVAILABLE, "No FAQs available")
            ) { }
        } else {
            faqs.forEach { faq ->
                addRow(binding.fcHelpFaqCard, faq.title) {
                    // App HelpScreen.kt:201.
                    graph.analytics.track(
                        AnalyticsEvents.FAQ_CLICKED,
                        mapOf(
                            AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HELP_LITERAL,
                            AnalyticsProps.QUESTION to faq.title,
                            AnalyticsProps.ID to faq.id
                        )
                    )
                    openUrl(faq.webviewUrl, faq.title)
                }
            }
        }

        val legal = data?.legal
        val terms = legal?.termsOfUse
        val privacy = legal?.privacyPolicy
        // App parity, and the same fix already made in the compose flavour (HelpScreen.kt:198):
        // the ROW TITLE is the served label, never `legal.*.title`. The #legal payload's own
        // title is English-only, so preferring it rendered "Terms of Use" / "Privacy Policy" in
        // English on a Kannada device while `fc_v2_app_label_terms_of_use` sat unused. The
        val termsTitle = label(Labels.TERMS_OF_USE, "Terms of use")
        val privacyTitle = label(Labels.PRIVACY_POLICY, "Privacy policy")
        addRow(
            binding.fcHelpMoreCard,
            termsTitle
        ) {
            // App HelpScreen.kt:245.
            graph.analytics.track(
                AnalyticsEvents.TERMS_OF_USE_OPENED,
                mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HELP_LITERAL)
            )
            // The WebView's own title is the SERVED LABEL too, not the payload title. My
            // earlier note here claimed the payload title was right for the page title — the app
            // disproves it: its legal screen bar reads "ಬಳಕೆಯ ನಿಯಮಗಳು", the Kannada label, while
            // the payload title is English-only.
            openUrl(terms?.webviewUrl, termsTitle)
        }
        addRow(
            binding.fcHelpMoreCard,
            privacyTitle
        ) {
            // App HelpScreen.kt:263.
            graph.analytics.track(
                AnalyticsEvents.PRIVACY_POLICY_OPENED,
                mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HELP_LITERAL)
            )
            openUrl(privacy?.webviewUrl, privacyTitle)
        }
    }

    private fun listCardSide(): Int = 16.dp(requireContext())

    private fun addRow(container: LinearLayout, title: String, onClick: () -> Unit) {
        val rowBinding = FcItemHelpRowBinding.inflate(
            LayoutInflater.from(requireContext()), container, false
        )
        rowBinding.fcHelpRowTitle.text = title
        rowBinding.root.setOnClickListener { onClick() }
        container.addView(rowBinding.root)
    }

    private fun openUrl(url: String?, title: String) {
        if (url.isNullOrBlank()) {
            // Link unavailable — no-op beyond a subtle title swap (app shows toast).
            android.widget.Toast.makeText(
                requireContext(),
                label(Labels.LINK_UNAVAILABLE, "Link unavailable"),
                android.widget.Toast.LENGTH_SHORT
            ).show()
            return
        }
        findNavController().navigate(
            R.id.fc_dest_legal_content,
            NavRoutes.legalArgs(url, title),
            NavRoutes.singleTop()
        )
    }

    override fun onDestroyView() {
        clearSkeleton()
        super.onDestroyView()
    }

    private companion object {
        /** Mirrors the core's Device-Info SDK version. */
        /**
         * App parity (HelpScreen.kt:287) — the app prints its own `BuildConfig.VERSION_NAME`, so
         * the SDK prints the SDK's. This was hardcoded "1.0.0" in a tree that publishes 2.0.0,
         * i.e. views' Help screen told users they were on the previous major version.
         */
        val SDK_VERSION: String = FarmerChatVersion.VERSION
    }
}
