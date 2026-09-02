package org.digitalgreen.farmerchat.sdk.compose.components

import android.graphics.Bitmap
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors

/**
 * Full-screen in-app dialog that renders a Terms-of-Use / policy [url] in a WebView,
 * with an "Accept and continue" button pinned to the bottom.
 * Used on Home when a Plotline card carries open_terms_of_use=true; the URL comes
 * from the cached farmerchat_terms_of_use (HomeState.farmerchatTermsOfUse).
 *
 * @param url    Terms-of-use URL to load (caller ensures it is non-blank).
 * @param title  Dialog header title.
 * @param onDismiss Called when the user closes the dialog (tap outside, back, or the X).
 * @param onAcceptAndContinue Called when the user taps "Accept and continue".
 */
@Composable
fun TermsOfUseDialog(
    url: String,
    title: String,
    onDismiss: () -> Unit,
    onAcceptAndContinue: () -> Unit,
) {
    val brand = LocalBrandColors.current
    val context = LocalContext.current
    var isLoading by remember { mutableStateOf(true) }

    Dialog(
        onDismissRequest = onDismiss,
        // Full-screen dialog: fill the whole window and draw edge-to-edge so the green
        // app bar extends up under the status bar (matches LegalContentDialog).
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false
        )
    ) {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = brand.surfacePrimary
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Shared app bar: close button on the left, centered white title on the
                // green brand bar (handles the status-bar inset itself).
                DefaultAppBar(
                    title = title,
                    leftIcon = Icons.Filled.Close,
                    onLeftClick = onDismiss,
                    showGlow = false,
                    containerColor = brand.surfacePrimary
                )

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                ) {
                    var webViewRef by remember { mutableStateOf<WebView?>(null) }
                    AndroidView(
                        modifier = Modifier.fillMaxSize(),
                        factory = { ctx ->
                            WebView(ctx).apply {
                                settings.javaScriptEnabled = true
                                setBackgroundColor(android.graphics.Color.WHITE)
                                webViewClient = object : WebViewClient() {
                                    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                                        isLoading = true
                                    }

                                    override fun onPageFinished(view: WebView?, url: String?) {
                                        isLoading = false
                                    }
                                }
                                loadUrl(url)
                            }
                        },
                        update = { view -> webViewRef = view }
                    )
                    DisposableEffect(Unit) {
                        onDispose {
                            webViewRef?.post {
                                webViewRef?.destroy()
                                webViewRef = null
                            }
                        }
                    }

                    if (isLoading) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(Color.White),
                            contentAlignment = Alignment.TopCenter
                        ) {
                            LogoSpinner(
                                type = LogoSpinnerType.Vertical,
                                label = label(Labels.LOADING, "Loading..."),
                                color = brand.surfacePrimary,
                                modifier = Modifier.padding(top = 24.dp)
                            )
                        }
                    }
                }

                // Bottom action bar: an elevated footer surface lifts the accept button
                // above the scrolling terms content with a soft top shadow.
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = brand.surfacePrimary,
                    shadowElevation = 12.dp
                ) {
                    PrimaryButton(
                        label = label(Labels.ACCEPT_AND_CONTINUE, "Accept and continue"),
                        state = PrimaryButtonState.Chevron,
                        height = 54,
                        modifier = Modifier
                            .fillMaxWidth()
                            .navigationBarsPadding()
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        onClick = {
                            // The app tracks a Plotline ToS event here. The SDK never calls the
                            // app's AnalyticsManager (root CLAUDE.md §6 bans third-party analytics
                            // inside SDK packages) — events reach the host through
                            // FarmerChatAnalytics / config.onEvent instead. The caller owns
                            // tracking for this dialog, so this is a plain callback.
                            onAcceptAndContinue()
                        }
                    )
                }
            }
        }
    }
}