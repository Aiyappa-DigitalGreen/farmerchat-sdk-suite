package org.digitalgreen.farmerchat.sdk.views.internal.ui

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

/** Help & Support (doc 01 §3.12): FAQ card (skeleton while loading), More (legal), footer. */
internal class HelpFragment : BaseFragment(R.layout.fc_fragment_help) {

    override val analyticsScreenName: String = AnalyticsScreens.HELP

    private lateinit var binding: FcFragmentHelpBinding
    private val skeletonAnimators = mutableListOf<ObjectAnimator>()

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FcFragmentHelpBinding.bind(view)

        binding.fcHelpAppBar.fcAppBarTitle.text = label(Labels.HELP, "Help")
        binding.fcHelpFaqTitle.text =
            label(Labels.HOW_TO_USE_FARMERCHAT, "How to use FarmerChat")
        binding.fcHelpMoreTitle.text = label(Labels.MORE, "More")
        binding.fcHelpVersion.text = "FarmerChat v.$SDK_VERSION"
        binding.fcHelpCopyright.text = label(Labels.DIGITAL_GREEN, "© Digital Green")
        binding.fcHelpAppBar.fcAppBarLeft.setOnClickListener { journeyHost()?.openDrawer() }

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
                    ContextCompat.getColor(requireContext(), R.color.fc_skeleton)
                )
            }
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 18.dp(requireContext())
            ).apply {
                val margin = 16.dp(requireContext())
                setMargins(margin, margin, margin, 0)
            }
            binding.fcHelpFaqCard.addView(row, params)
            skeletonAnimators += ObjectAnimator.ofFloat(row, "alpha", 1f, 0.4f, 1f).apply {
                duration = 1200L
                repeatCount = ObjectAnimator.INFINITE
                start()
            }
        }
        // Bottom padding for the last skeleton row.
        binding.fcHelpFaqCard.setPadding(0, 0, 0, 16.dp(requireContext()))
    }

    private fun clearSkeleton() {
        skeletonAnimators.forEach { it.cancel() }
        skeletonAnimators.clear()
    }

    // ------------------------------------------------------------------ content

    private fun renderHelp(data: HelpSupportData?) {
        if (!isAdded) return
        clearSkeleton()
        binding.fcHelpFaqCard.setPadding(0, 0, 0, 0)
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
                    graph.analytics.track(AnalyticsEvents.FAQ_CLICKED)
                    openUrl(faq.webviewUrl, faq.title)
                }
            }
        }

        val legal = data?.legal
        val terms = legal?.termsOfUse
        val privacy = legal?.privacyPolicy
        addRow(
            binding.fcHelpMoreCard,
            terms?.title ?: label(Labels.TERMS_OF_USE, "Terms of use")
        ) {
            openUrl(terms?.webviewUrl, terms?.title ?: label(Labels.TERMS_OF_USE, "Terms of use"))
        }
        addRow(
            binding.fcHelpMoreCard,
            privacy?.title ?: label(Labels.PRIVACY_POLICY, "Privacy policy")
        ) {
            openUrl(
                privacy?.webviewUrl,
                privacy?.title ?: label(Labels.PRIVACY_POLICY, "Privacy policy")
            )
        }
    }

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
        const val SDK_VERSION = "1.0.0"
    }
}
