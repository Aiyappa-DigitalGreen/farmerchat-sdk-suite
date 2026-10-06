package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.view.isVisible
import androidx.fragment.app.DialogFragment
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcFragmentLegalDialogBinding
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcRecolor

/** Full-width legal WebView dialog (doc 01 §3.17). */
internal class LegalContentDialogFragment : DialogFragment() {

    override fun getTheme(): Int = R.style.Theme_FarmerChatSdk_LegalDialog

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = FcFragmentLegalDialogBinding.inflate(inflater, container, false).root

    override fun onStart() {
        super.onStart()
        dialog?.window?.setLayout(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val binding = FcFragmentLegalDialogBinding.bind(view)
        val labels = FarmerChat.requireGraph().labelManager

        val url = arguments?.getString("url").orEmpty()
        val titleArg = arguments?.getString("title").orEmpty()
        binding.fcLegalAppBar.fcAppBarTitle.text = if (titleArg.equals("faq_terms", ignoreCase = true)) {
            labels.getLabel(Labels.FAQ, "FAQ")
        } else {
            titleArg
        }

        // App parity (LegalContentScreen.kt:64): CLOSE in the round chip, not the shared bar's
        // default hamburger.
        binding.fcLegalAppBar.fcAppBarLeft.setImageResource(R.drawable.fc_ic_close)
        binding.fcLegalAppBar.fcAppBarLeft.setBackgroundResource(R.drawable.fc_bg_appbar_chip_round)
        // Set after inflation, so the inflater recolor never saw it.
        FcRecolor.maybeRecolor(binding.fcLegalAppBar.fcAppBarLeft)
        binding.fcLegalAppBar.fcAppBarLeft.contentDescription = labels.getLabel(Labels.CLOSE, "Close")
        binding.fcLegalAppBar.fcAppBarLeft.setOnClickListener { dismissAllowingStateLoss() }

        binding.fcLegalWebView.settings.javaScriptEnabled = true
        binding.fcLegalWebView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                binding.fcLegalProgress.isVisible = true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                binding.fcLegalProgress.isVisible = false
            }
        }
        if (url.isNotBlank()) {
            binding.fcLegalWebView.loadUrl(url)
        } else {
            binding.fcLegalProgress.isVisible = false
        }
    }

    override fun onDestroyView() {
        (view?.findViewById<WebView>(R.id.fcLegalWebView))?.destroy()
        super.onDestroyView()
    }
}
