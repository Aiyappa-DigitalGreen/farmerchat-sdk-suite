package org.digitalgreen.farmerchat.sdk.compose.components

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.ModalBottomSheetProperties
import androidx.compose.material3.SheetValue
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import org.digitalgreen.farmerchat.sdk.compose.R
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalBrandColors
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.labels.Labels

/**
 * The mandatory Terms-of-Use acceptance gate (SDK 2.0.0), driven by endpoint **#7a**
 * (`policy_acceptance_status`). 1:1 port of the app's
 * `components/dialogs/TermsOfUseUpdatedBottomSheet.kt`.
 *
 * Shown on Home whenever `HomeState.policyAcceptanceState` reports
 * `requires_acceptance == true` and the paired #7 `accept_terms` has not yet succeeded.
 *
 * This sheet is **non-cancellable**: swipe-down, back press and scrim taps are all rejected.
 * The only ways out are the two actions, so the caller owns visibility and there is no
 * `onDismiss` — exactly as in the app.
 *
 * Unlike the app it does **not** self-track analytics (the app calls its
 * `AnalyticsManager`, which fans out to MoEngage/Firebase/Adjust/Plotline — banned in SDK
 * packages by root `CLAUDE.md` §6). `Terms_Of_Use_Sheet_Shown` and
 * `Terms_Of_Use_Read_Terms_Click_Event` are raised by the caller through
 * `FarmerChatAnalytics` instead, with the same names and `screen_name` property.
 *
 * @param onReadTerms Tapped the outlined "Read terms" button.
 * @param onAccept    Tapped the filled "Accept" button.
 * @param acceptState Drives the Accept button's loading state while #7 is in flight, so the
 *   sheet does not sit inert with no feedback. A `UiState.Error` re-enables both buttons.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TermsOfUseUpdatedBottomSheet(
    onReadTerms: () -> Unit,
    onAccept: () -> Unit,
    acceptState: UiState<*> = UiState.Idle,
    modifier: Modifier = Modifier
) {
    val colors = LocalContentColors.current
    val isAccepting = acceptState is UiState.Loading

    // Non-cancellable: reject any transition to Hidden so swipe-down cannot dismiss.
    val sheetState = rememberModalBottomSheetState(
        skipPartiallyExpanded = true,
        confirmValueChange = { it != SheetValue.Hidden }
    )

    ModalBottomSheet(
        // No-op: scrim taps route here, and we intentionally do not dismiss.
        onDismissRequest = {},
        sheetState = sheetState,
        modifier = modifier,
        dragHandle = null,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        containerColor = colors.surfaceSecondary,
        // Block back-press dismissal.
        properties = ModalBottomSheetProperties(shouldDismissOnBackPress = false)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 24.dp)
                .padding(top = 24.dp, bottom = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Image(
                painter = painterResource(R.drawable.fc_ic_tou_info),
                contentDescription = null
            )

            Text(
                text = label(Labels.TERMS_OF_USE_CHANGED, "Our Terms of Use have changed"),
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = colors.foregroundPrimary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )

            Text(
                text = label(
                    Labels.TERMS_OF_USE_DESCRIPTION,
                    "We changed how we keep your farm details safe, how we may use content that " +
                        "you provide to us, and how advice from the app should be used. Please " +
                        "review and accept to keep using FarmerChat."
                ),
                color = colors.foregroundPrimary,
                fontSize = 16.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(Modifier.height(4.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedActionButton(
                    label = label(Labels.TERMS_OF_USE_READ_TERMS, "Read terms"),
                    enabled = !isAccepting,
                    onClick = onReadTerms,
                    modifier = Modifier.weight(1f)
                )
                PrimaryButton(
                    label = label(Labels.TERMS_OF_USE_ACCEPT, "Accept"),
                    state = if (isAccepting) PrimaryButtonState.Loading else PrimaryButtonState.Default,
                    height = 56,
                    enabled = !isAccepting,
                    onClick = {
                        // Terms_Of_Use_Accept_Click_Event fires from the caller (HomeScreen)
                        // only after #7 actually succeeds, not on this raw tap.
                        if (!isAccepting) onAccept()
                    },
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

/**
 * Outlined "Read terms" variant: brand surface with the primary foreground label, matching
 * the app. Kept private to the gate since it is the only place it is used.
 */
@Composable
private fun OutlinedActionButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    val colors = LocalContentColors.current
    val shape = SmoothShapes.rounded(Radius.MD)

    Surface(
        modifier = modifier.height(56.dp),
        onClick = onClick,
        enabled = enabled,
        shape = shape,
        color = colors.surfacePrimary
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                text = label,
                fontWeight = FontWeight.SemiBold,
                style = MaterialTheme.typography.labelLarge,
                color = colors.foregroundPrimary,
                textAlign = TextAlign.Center
            )
        }
    }
}

/**
 * Full-screen "Read terms" content screen of the acceptance gate — the Terms-of-Use document in
 * a WebView with a single stateful "Accept terms" CTA (idle → loading → accepted). 1:1 port of
 * the app's `components/dialogs/TermsOfUseContentDialog.kt`.
 *
 * Deliberately separate from [TermsOfUseDialog] (the dismissible, #4-driven one): the close
 * action sits on the **right** here and the single accept button's label/icon reflect
 * [acceptState] rather than being a static "Accept and continue".
 *
 * Its [url] is `latest_policy_version.terms_of_service_url` from **#7a** — NOT
 * `HomeState.farmerchatTermsOfUse` (#4). The two are independent (doc 02 §Endpoint #7a).
 *
 * As with the sheet, analytics are raised by the caller, not here.
 *
 * @param acceptState   Drives idle / loading / accepted visuals on the bottom button.
 * @param onClose       Tapped the close (X) button. Ignored while #7 is in flight.
 * @param onAcceptTerms Tapped "Accept terms". Ignored once loading or already accepted.
 */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun TermsOfUseContentDialog(
    url: String,
    title: String,
    acceptState: UiState<*>,
    onClose: () -> Unit,
    onAcceptTerms: () -> Unit
) {
    val brand = LocalBrandColors.current
    var isLoading by remember { mutableStateOf(true) }

    val isAccepted = acceptState is UiState.Success<*>
    val isAccepting = acceptState is UiState.Loading

    Dialog(
        // Block back-press and outside-tap dismissal while accept_terms is in flight.
        onDismissRequest = { if (!isAccepting) onClose() },
        properties = DialogProperties(
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false
        )
    ) {
        Surface(modifier = Modifier.fillMaxSize()) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Close (X) sits on the RIGHT here, unlike TermsOfUseDialog.
                DefaultAppBar(
                    title = title,
                    rightIcon = Icons.Filled.Close,
                    rightRadius = Radius.Rounded,
                    // The app dims this while accepting via a `rightEnabled` param the SDK's
                    // shared DefaultAppBar does not have; guarding the callback keeps the
                    // behaviour (taps are inert) without changing a shared component.
                    onRightClick = { if (!isAccepting) onClose() },
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

                // Bottom action bar: single stateful Accept button (idle → loading → accepted).
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = brand.foregroundPrimary,
                    shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
                    shadowElevation = 12.dp
                ) {
                    PrimaryButton(
                        label = when {
                            isAccepted -> label(Labels.TERMS_OF_USE_ACCEPTED, "Accepted")
                            isAccepting -> label(Labels.TERMS_OF_USE_ACCEPTING_ONE_SECOND, "One second")
                            else -> label(Labels.TERMS_OF_USE_ACCEPT_TERMS, "Accept terms")
                        },
                        state = if (isAccepting) PrimaryButtonState.Loading else PrimaryButtonState.Default,
                        icon = if (isAccepted) Icons.Filled.Check else null,
                        height = 54,
                        // Only dim while the request is in flight — once accepted keep full
                        // opacity (matches the design) and just no-op further taps.
                        enabled = !isAccepting,
                        modifier = Modifier
                            .fillMaxWidth()
                            .navigationBarsPadding()
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        onClick = {
                            if (!isAccepting && !isAccepted) onAcceptTerms()
                        }
                    )
                }
            }
        }
    }
}
