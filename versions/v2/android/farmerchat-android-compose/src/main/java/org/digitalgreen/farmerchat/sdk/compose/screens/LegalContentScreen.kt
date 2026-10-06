package org.digitalgreen.farmerchat.sdk.compose.screens

import android.annotation.SuppressLint
import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import org.digitalgreen.farmerchat.sdk.compose.components.DefaultAppBar
import org.digitalgreen.farmerchat.sdk.compose.components.LogoSpinner
import org.digitalgreen.farmerchat.sdk.compose.components.LogoSpinnerType
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius

/**
 * Legal / FAQ WebView dialog content (doc 01 §3.17 — PolicyWebViewScreen port).
 * Full-width WebView with JS enabled, Close app bar, loading spinner.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun LegalContentScreen(
    url: String,
    title: String,
    onClose: () -> Unit
) {
    val colors = LocalContentColors.current
    var isLoading by remember { mutableStateOf(true) }

    // "faq_terms" is the SDK sentinel for the app's `faq_terms = (args.title == "faq")`
    // toggle (HelpScreen passes it). Matched case-insensitively, as android-views does.
    val displayTitle =
        if (title.equals("faq_terms", ignoreCase = true)) label(Labels.FAQ, "FAQ") else title

    Column(
        modifier = Modifier
            .fillMaxSize()
            // The dialog window is edge-to-edge (see the `decorFitsSystemWindows = false` in
            // FarmerChatRoot), so this Column owns the whole screen: it paints the reading
            // surface behind the navigation bar too, and consumes the bottom inset so the
            // WebView's last line is not hidden under the nav bar.
            .background(colors.surfaceReadingPrimary)
            .windowInsetsPadding(WindowInsets.navigationBars)
    ) {
        DefaultAppBar(
            title = displayTitle,
            leftIcon = Icons.Filled.Close,
            leftRadius = Radius.Rounded,
            onLeftClick = onClose,
            showGlow = false
        )

        Box(modifier = Modifier.fillMaxSize()) {
            AndroidView(
                factory = { context ->
                    WebView(context).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        webViewClient = object : WebViewClient() {
                            override fun onPageFinished(view: WebView?, url: String?) {
                                isLoading = false
                            }
                        }
                        loadUrl(url)
                    }
                },
                modifier = Modifier.fillMaxSize()
            )

            if (isLoading) {
                LogoSpinner(
                    type = LogoSpinnerType.Vertical,
                    label = label(Labels.LOADING, "Loading..."),
                    modifier = Modifier
                        .align(Alignment.Center)
                        .fillMaxWidth()
                )
            }
        }
    }
}
