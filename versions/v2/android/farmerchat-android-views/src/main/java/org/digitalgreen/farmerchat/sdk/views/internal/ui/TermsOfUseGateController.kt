package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.annotation.SuppressLint
import android.app.Dialog
import android.graphics.Bitmap
import android.view.LayoutInflater
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.google.android.material.bottomsheet.BottomSheetDialog
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.ui.home.HomeState
import org.digitalgreen.farmerchat.sdk.core.ui.home.latestTermsOfServiceUrl
import org.digitalgreen.farmerchat.sdk.core.ui.home.requiresTermsAcceptance
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcFragmentTermsContentBinding
import org.digitalgreen.farmerchat.sdk.views.databinding.FcSheetTermsOfUseUpdatedBinding
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.PrimaryButtonView

/**
 * The mandatory Terms-of-Use acceptance gate on Home (SDK 2.0.0), driven by endpoint **#7a**
 * (`policy_acceptance_status`). Views counterpart of the Compose
 * `TermsOfUseUpdatedBottomSheet` + `TermsOfUseContentDialog` pair, and of the app's
 * `HomeScreen.kt:1818-1880` render block.
 *
 * Owns the whole gate so [HomeFragment] only has to call [render] from its single state
 * collector and [destroy] from `onDestroyView`:
 *
 *  * a **non-cancellable** `BottomSheetDialog` while
 *    `policyAcceptanceState.requires_acceptance == true && acceptTermsState !is Success`
 *  * a full-screen "Read terms" content dialog whose URL is
 *    `latest_policy_version.terms_of_service_url` from **#7a** — never `farmerchatTermsOfUse`
 *    (#4), which belongs to the *other*, dismissible terms dialog
 *  * the five app analytics events, raised through `FarmerChatAnalytics` (the app self-tracks
 *    them inside its composables via `AnalyticsManager`, which is banned in SDK packages by
 *    root `CLAUDE.md` §6)
 *
 * [render] is called on **every** state emission, so every show is guarded on the dialog being
 * null — a naive `show()` inside the collector would stack duplicate sheets.
 *
 * @param onAccept dispatches `HomeAction.AcceptTerms`; both CTAs call it, exactly as in the app.
 * @param onError  surfaces a failed #7 (the app has no error slot in the sheet either); the
 *   buttons re-enable on `UiState.Error` so the farmer can retry.
 */
internal class TermsOfUseGateController(
    private val fragment: Fragment,
    private val onAccept: () -> Unit,
    private val onError: (String) -> Unit
) {

    private val graph get() = FarmerChat.requireGraph()
    private fun label(key: String, fallback: String) = graph.labelManager.getLabel(key, fallback)

    private var sheet: BottomSheetDialog? = null
    private var sheetBinding: FcSheetTermsOfUseUpdatedBinding? = null

    private var contentDialog: Dialog? = null
    private var contentBinding: FcFragmentTermsContentBinding? = null

    /**
     * Local UI state, matching the app's `remember { mutableStateOf(false) }` — deliberately
     * not persisted, so it is lost on a config change exactly as it is in the app.
     */
    private var showContentScreen = false

    /**
     * Which CTA (sheet "Accept" vs content screen "Accept terms") most recently dispatched
     * `AcceptTerms`. Read once #7 succeeds, since `Terms_Of_Use_Accept_Click_Event` only fires
     * on a successful response, not on the raw tap (app parity: `HomeScreen.kt:1856`).
     */
    private var pendingAcceptSource: String? = null

    /** Guards the once-per-terminal-state side effects against repeated state emissions. */
    private var handledSuccess = false
    private var handledErrorMessage: String? = null

    private var closeContentJob: Job? = null

    // ------------------------------------------------------------------ entry point

    fun render(state: HomeState) {
        // Both predicates live in core so this flavour and Compose cannot drift on them.
        val requiresAcceptance = state.requiresTermsAcceptance()
        val termsUrl = state.latestTermsOfServiceUrl()

        // A fresh #7a check resets acceptTermsState to Idle in core, so clear the local
        // once-per-terminal-state guards with it or a re-required acceptance could not retry.
        if (state.acceptTermsState is UiState.Idle) {
            handledSuccess = false
            handledErrorMessage = null
        }

        lastTermsUrl = termsUrl

        if (requiresAcceptance) showSheet() else dismissSheet()
        sheetBinding?.let { applyAcceptState(it.fcTouAccept, it.fcTouReadTerms, state) }

        // The content screen is opened by the "Read terms" tap (nothing about that tap changes
        // HomeState, so it cannot wait for an emission). Here we only close it — either because
        // the user tapped X, or because the delayed post-accept close below cleared the flag.
        if (!showContentScreen) dismissContentDialog()
        contentBinding?.let { applyContentAcceptState(it.fcTouContentAccept, state) }

        // Terms_Of_Use_Accept_Click_Event fires only once #7 actually succeeds.
        val source = pendingAcceptSource
        if (state.acceptTermsState is UiState.Success<*> && source != null && !handledSuccess) {
            handledSuccess = true
            pendingAcceptSource = null
            graph.analytics.track(
                AnalyticsEvents.TERMS_OF_USE_ACCEPT_CLICK_EVENT,
                mapOf(AnalyticsProps.SCREEN_NAME to source)
            )
        }

        // App parity (HomeScreen.kt:1874): let the user see the "Accepted" checkmark for a beat
        // before the content screen closes. requiresAcceptance is already false by now, so the
        // sheet has gone; only the content dialog is still up.
        if (state.acceptTermsState is UiState.Success<*> && contentDialog != null &&
            closeContentJob == null
        ) {
            closeContentJob = fragment.viewLifecycleOwner.lifecycleScope.launch {
                delay(1200)
                showContentScreen = false
                dismissContentDialog()
                // Reset, or a SECOND gate cycle in this view lifetime (accepted, then #7a
                // re-reports requires_acceptance=true) would fail the `== null` guard above and
                // never auto-close the content screen.
                closeContentJob = null
            }
        }

        (state.acceptTermsState as? UiState.Error)?.let { error ->
            if (error.message != handledErrorMessage) {
                handledErrorMessage = error.message
                onError(
                    error.message.ifBlank {
                        label(Labels.SOMETHING_WENT_WRONG, "Something went wrong")
                    }
                )
            }
        }
    }

    fun destroy() {
        closeContentJob?.cancel()
        closeContentJob = null
        dismissContentDialog()
        dismissSheet()
    }

    // ------------------------------------------------------------------ sheet

    private fun showSheet() {
        if (sheet != null) return
        val binding = FcSheetTermsOfUseUpdatedBinding.inflate(
            LayoutInflater.from(fragment.requireContext())
        )
        sheetBinding = binding

        binding.fcTouTitle.text =
            label(Labels.TERMS_OF_USE_CHANGED, "Our Terms of Use have changed")
        binding.fcTouMessage.text = label(
            Labels.TERMS_OF_USE_DESCRIPTION,
            "We changed how we keep your farm details safe, how we may use content that you " +
                "provide to us, and how advice from the app should be used. Please review and " +
                "accept to keep using FarmerChat."
        )
        binding.fcTouReadTerms.text = label(Labels.TERMS_OF_USE_READ_TERMS, "Read terms")
        binding.fcTouAccept.text = label(Labels.TERMS_OF_USE_ACCEPT, "Accept")

        binding.fcTouReadTerms.setOnClickListener {
            graph.analytics.track(
                AnalyticsEvents.TERMS_OF_USE_READ_TERMS_CLICK_EVENT,
                mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME)
            )
            showContentScreen = true
            // render() is state-driven, so open immediately rather than waiting for the next
            // emission (which may never come — nothing about this tap changes HomeState).
            val url = lastTermsUrl
            if (!url.isNullOrBlank()) {
                showContentDialog(url)
            } else {
                onError(label(Labels.UNABLE_TO_LOAD_LEGAL_LINKS, "Unable to load Terms of Use"))
                showContentScreen = false
            }
        }
        binding.fcTouAccept.setOnClickListener {
            if (binding.fcTouAccept.state != PrimaryButtonView.State.LOADING) {
                pendingAcceptSource = AnalyticsScreens.HOME
                onAccept()
            }
        }

        sheet = BottomSheetDialog(fragment.requireContext()).apply {
            setContentView(binding.root)
            // Non-cancellable, all three axes: back press, scrim tap, and swipe-down. The
            // first two alone still leave the sheet draggable off-screen.
            setCancelable(false)
            setCanceledOnTouchOutside(false)
            behavior.isDraggable = false
            behavior.skipCollapsed = true
            show()
        }

        graph.analytics.track(
            AnalyticsEvents.TERMS_OF_USE_SHEET_SHOWN,
            mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.HOME)
        )
    }

    private fun dismissSheet() {
        runCatching { sheet?.dismiss() }
        sheet = null
        sheetBinding = null
    }

    private fun applyAcceptState(
        accept: PrimaryButtonView,
        readTerms: android.widget.TextView,
        state: HomeState
    ) {
        val isAccepting = state.acceptTermsState is UiState.Loading
        accept.state =
            if (isAccepting) PrimaryButtonView.State.LOADING else PrimaryButtonView.State.DEFAULT
        accept.setButtonEnabled(!isAccepting)
        readTerms.isEnabled = !isAccepting
        readTerms.alpha = if (isAccepting) 0.5f else 1f
    }

    // ------------------------------------------------------------------ content screen

    /**
     * Last known #7a `terms_of_service_url`, refreshed on every [render] so the "Read terms" tap
     * can open the content screen without waiting for a state round-trip.
     */
    private var lastTermsUrl: String? = null

    @SuppressLint("SetJavaScriptEnabled")
    private fun showContentDialog(url: String) {
        if (contentDialog != null) return
        val binding = FcFragmentTermsContentBinding.inflate(
            LayoutInflater.from(fragment.requireContext())
        )
        contentBinding = binding

        binding.fcTouContentTitle.text = label(Labels.TERMS_OF_USE, "Terms of Use")
        binding.fcTouContentClose.setOnClickListener {
            // Ignored while #7 is in flight, matching the app's `rightEnabled = !isAccepting`.
            if (contentBinding?.fcTouContentAccept?.state != PrimaryButtonView.State.LOADING) {
                showContentScreen = false
                dismissContentDialog()
            }
        }
        binding.fcTouContentAccept.text = label(Labels.TERMS_OF_USE_ACCEPT_TERMS, "Accept terms")
        binding.fcTouContentAccept.setOnClickListener {
            val btn = binding.fcTouContentAccept
            if (btn.state != PrimaryButtonView.State.LOADING && !isAcceptedButton) {
                pendingAcceptSource = AnalyticsScreens.TERMS_OF_USE_CONTENT_SCREEN
                onAccept()
            }
        }

        binding.fcTouContentWebView.settings.javaScriptEnabled = true
        binding.fcTouContentWebView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                contentBinding?.fcTouContentProgress?.isVisible = true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                contentBinding?.fcTouContentProgress?.isVisible = false
            }
        }
        binding.fcTouContentWebView.loadUrl(url)

        contentDialog = Dialog(
            fragment.requireContext(),
            R.style.Theme_FarmerChatSdk_LegalDialog
        ).apply {
            setContentView(binding.root)
            // Back press and outside taps are blocked while accepting; otherwise they close,
            // matching the Compose `onDismissRequest = { if (!isAccepting) onClose() }`.
            setCancelable(true)
            setCanceledOnTouchOutside(false)
            setOnCancelListener {
                if (contentBinding?.fcTouContentAccept?.state == PrimaryButtonView.State.LOADING) {
                    // Re-show: the accept call is in flight and must not be abandoned.
                    show()
                } else {
                    showContentScreen = false
                    dismissContentDialog()
                }
            }
            window?.setLayout(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            show()
        }

        graph.analytics.track(
            AnalyticsEvents.TERMS_OF_USE_CONTENT_SCREEN_VIEWED,
            mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.TERMS_OF_USE_CONTENT_SCREEN)
        )
    }

    private var isAcceptedButton = false

    private fun applyContentAcceptState(accept: PrimaryButtonView, state: HomeState) {
        val isAccepted = state.acceptTermsState is UiState.Success<*>
        val isAccepting = state.acceptTermsState is UiState.Loading
        isAcceptedButton = isAccepted
        accept.text = when {
            isAccepted -> label(Labels.TERMS_OF_USE_ACCEPTED, "Accepted")
            isAccepting -> label(Labels.TERMS_OF_USE_ACCEPTING_ONE_SECOND, "One second")
            else -> label(Labels.TERMS_OF_USE_ACCEPT_TERMS, "Accept terms")
        }
        accept.state =
            if (isAccepting) PrimaryButtonView.State.LOADING else PrimaryButtonView.State.DEFAULT
        // Only dim while in flight — once accepted keep full opacity and no-op further taps.
        accept.setButtonEnabled(!isAccepting)
    }

    private fun dismissContentDialog() {
        if (contentDialog == null) return
        contentBinding?.fcTouContentWebView?.let { web ->
            web.stopLoading()
            web.destroy()
        }
        contentDialog?.setOnCancelListener(null)
        runCatching { contentDialog?.dismiss() }
        contentDialog = null
        contentBinding = null
        graph.analytics.track(
            AnalyticsEvents.TERMS_OF_USE_CONTENT_SCREEN_EXITED,
            mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.TERMS_OF_USE_CONTENT_SCREEN)
        )
    }
}
