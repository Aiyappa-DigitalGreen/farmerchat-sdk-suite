package org.digitalgreen.farmerchat.sdk.compose.screens

import org.digitalgreen.farmerchat.sdk.compose.util.fcNavigationBarsBottom
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.delay
import org.digitalgreen.farmerchat.sdk.FarmerChat
import org.digitalgreen.farmerchat.sdk.compose.components.CountryCodeSelector
import org.digitalgreen.farmerchat.sdk.compose.components.DefaultAppBar
import org.digitalgreen.farmerchat.sdk.compose.components.OtpInput
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryButton
import org.digitalgreen.farmerchat.sdk.compose.components.PrimaryButtonState
import org.digitalgreen.farmerchat.sdk.compose.components.RadioButton
import org.digitalgreen.farmerchat.sdk.compose.components.SearchInput
import org.digitalgreen.farmerchat.sdk.compose.components.SecondaryButton
import org.digitalgreen.farmerchat.sdk.compose.components.TextInput
import org.digitalgreen.farmerchat.sdk.compose.components.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.TextButton
import androidx.compose.runtime.saveable.rememberSaveable
import org.digitalgreen.farmerchat.sdk.core.device.SimPhoneNumberProvider
import org.digitalgreen.farmerchat.sdk.compose.components.ToastState
import org.digitalgreen.farmerchat.sdk.compose.components.rememberToastState
import org.digitalgreen.farmerchat.sdk.compose.theme.LocalContentColors
import org.digitalgreen.farmerchat.sdk.compose.theme.Radius
import org.digitalgreen.farmerchat.sdk.compose.theme.SmoothShapes
import org.digitalgreen.farmerchat.sdk.compose.util.label
import org.digitalgreen.farmerchat.sdk.compose.vm.rememberCoreViewModel
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.CountryItem
import org.digitalgreen.farmerchat.sdk.core.ui.auth.AuthStep
import org.digitalgreen.farmerchat.sdk.core.ui.auth.AuthToastType
import org.digitalgreen.farmerchat.sdk.core.ui.auth.AuthViewModel
import org.digitalgreen.farmerchat.sdk.compose.components.IconPosition
import org.digitalgreen.farmerchat.sdk.compose.R

/**
 * Phone + OTP auth (doc 01 §3.4). PhoneEntry (country picker, WhatsApp/SMS
 * channel buttons) → OtpEntry (4 digits, 180 s timer, resend/start-over).
 * SMS Retriever is optional (Play Services guarded by runCatching).
 */
@Composable
fun AuthScreen(
    onClose: () -> Unit,
    onSuccess: (phoneE164: String, existingUser: Boolean) -> Unit,
    onOpenLegal: (url: String, title: String) -> Unit
) {
    val graph = FarmerChat.requireGraph()
    val colors = LocalContentColors.current
    val context = LocalContext.current
    val vm = rememberCoreViewModel("auth") { graph.authViewModel() }
    val state by vm.state.collectAsState()
    val toast = rememberToastState()

    var showCountryPicker by remember { mutableStateOf(false) }
    var resendSecondsLeft by remember { mutableIntStateOf(AuthViewModel.RESEND_TIMEOUT_SECONDS) }
    var successHandled by remember { mutableStateOf(false) }

    // ------------------------------------------------------------------ SIM number pre-fill
    //
    // App parity (AuthScreen.kt:266): when the permissions are ALREADY granted, the Auth screen
    // reads the device's SIM numbers — one SIM pre-fills the fields, several offer a picker — so
    // the farmer does not have to type a number their phone already knows.
    //
    // The SDK declares neither permission (see SimPhoneNumberProvider): a host opts in by
    // declaring them, and everything below degrades to "no SIMs" otherwise.
    var simNumbers by remember { mutableStateOf<List<String>>(emptyList()) }
    var showSimPicker by rememberSaveable { mutableStateOf(false) }
    var simAutoDetectDone by rememberSaveable { mutableStateOf(false) }

    val simPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        if (result.values.all { it }) {
            val sims = SimPhoneNumberProvider.getSimLineNumbers(context)
            when {
                sims.size > 1 -> { simNumbers = sims; showSimPicker = true }
                sims.size == 1 -> vm.applySimNumber(sims.first())
                else -> toast.show(
                    label(
                        Labels.PERMISSIONS_ARE_REQUIRED_TO_AUTO_DETECT_SIM_NUMBER,
                        "Permissions are required to auto-detect SIM number."
                    ),
                    ToastState.Error
                )
            }
        } else {
            toast.show(
                label(
                    Labels.PERMISSIONS_ARE_REQUIRED_TO_AUTO_DETECT_SIM_NUMBER,
                    "Permissions are required to auto-detect SIM number."
                ),
                ToastState.Error
            )
        }
    }

    // Runs once the country list is in: the split needs its dial codes.
    LaunchedEffect(state.countries.isNotEmpty()) {
        if (simAutoDetectDone || state.countries.isEmpty()) return@LaunchedEffect
        if (state.phoneLocal.isNotBlank()) return@LaunchedEffect
        // App parity: only when no country ISO is resolved yet — otherwise the deferred GPS
        // `applyIso` calls selectCountry afterwards and clears the SIM's number.
        if (!vm.shouldAutoDetectFromSim()) {
            simAutoDetectDone = true
            return@LaunchedEffect
        }
        if (!SimPhoneNumberProvider.canReadPhoneNumber(context)) {
            // Not granted yet. The APP declares a permission launcher for exactly this and then
            // never invokes it, so its own SIM pre-fill is unreachable on a fresh install — the
            // dangling `PERMISSIONS_ARE_REQUIRED_TO_AUTO_DETECT_SIM_NUMBER` label shows the
            // intent. The SDK asks, but ONLY when the host declared the permissions; a host that
            // did not opt in never sees a prompt. Deliberate divergence — docs/05.
            if (SimPhoneNumberProvider.isDeclaredByHost(context)) {
                simAutoDetectDone = true
                simPermissionLauncher.launch(SimPhoneNumberProvider.requiredPermissions)
            }
            return@LaunchedEffect
        }
        simAutoDetectDone = true
        val sims = SimPhoneNumberProvider.getSimLineNumbers(context)
        when {
            sims.size > 1 -> { simNumbers = sims; showSimPicker = true }
            sims.size == 1 -> vm.applySimNumber(sims.first())
        }
    }

    LaunchedEffect(Unit) {
        graph.analytics.trackScreenView(AnalyticsScreens.AUTH)
        graph.analytics.track(
                    AnalyticsEvents.MOBILE_VERIFICATION_STARTED,
                    mapOf(
                        AnalyticsProps.SCREEN_NAME to AnalyticsScreens.AUTH,
                        AnalyticsProps.TRIGGER_LOWER to "Signup button"
                    )
                )
        graph.errorNavigationManager.setActiveScreen("auth")
        vm.fetchCountries()
        vm.fetchLegalLinks()
        vm.autoDetectCountryFromLocation()
    }

    // Per-step screen views.
    LaunchedEffect(state.step) {
        if (state.step == AuthStep.OtpEntry) {
            graph.analytics.trackScreenView(AnalyticsScreens.VERIFY_OTP)
            resendSecondsLeft = AuthViewModel.RESEND_TIMEOUT_SECONDS
        }
    }

    // 180 s resend countdown while on OTP step.
    LaunchedEffect(state.step, state.sendOtpState) {
        if (state.step == AuthStep.OtpEntry) {
            while (resendSecondsLeft > 0) {
                delay(1000L)
                resendSecondsLeft--
            }
        }
    }

    // SMS Retriever: register only during the OTP step; absence never crashes.
    DisposableEffect(state.step) {
        var receiver: BroadcastReceiver? = null
        if (state.step == AuthStep.OtpEntry) {
            runCatching {
                val client = com.google.android.gms.auth.api.phone.SmsRetriever.getClient(context)
                client.startSmsRetriever()
                receiver = object : BroadcastReceiver() {
                    override fun onReceive(ctx: Context?, intent: Intent?) {
                        runCatching {
                            if (intent?.action ==
                                com.google.android.gms.auth.api.phone.SmsRetriever.SMS_RETRIEVED_ACTION
                            ) {
                                val extras = intent.extras ?: return@runCatching
                                val status = extras.get(
                                    com.google.android.gms.auth.api.phone.SmsRetriever.EXTRA_STATUS
                                ) as? com.google.android.gms.common.api.Status
                                if (status?.statusCode == com.google.android.gms.common.api.CommonStatusCodes.SUCCESS) {
                                    val message = extras.getString(
                                        com.google.android.gms.auth.api.phone.SmsRetriever.EXTRA_SMS_MESSAGE
                                    )
                                    val otp = message?.let {
                                        Regex("\\d{4}").find(it)?.value
                                    }
                                    if (!otp.isNullOrBlank()) {
                                        vm.setOtp(otp)
                                    }
                                }
                            }
                        }
                    }
                }
                ContextCompat.registerReceiver(
                    context,
                    receiver,
                    IntentFilter(com.google.android.gms.auth.api.phone.SmsRetriever.SMS_RETRIEVED_ACTION),
                    com.google.android.gms.auth.api.phone.SmsRetriever.SEND_PERMISSION,
                    null,
                    ContextCompat.RECEIVER_EXPORTED
                )
            }.onFailure { receiver = null }
        }
        onDispose {
            receiver?.let { runCatching { context.unregisterReceiver(it) } }
        }
    }

    // Verify success → delay 800 ms → onSuccess.
    LaunchedEffect(state.verifyOtpState) {
        if (state.verifyOtpState is UiState.Success && !successHandled) {
            successHandled = true
            delay(800L)
            onSuccess("${state.countryCode}${state.phoneLocal}", state.existingUser == true)
        }
    }

    // VM toast passthrough.
    LaunchedEffect(state.toast) {
        state.toast?.let {
            toast.show(
                it.message,
                if (it.type == AuthToastType.Error) ToastState.Error else ToastState.Success
            )
            vm.consumeToast()
        }
    }

    DisposableEffect(Unit) {
        onDispose { graph.analytics.trackScreenExit(AnalyticsScreens.AUTH) }
    }

    if (showCountryPicker) {
        CountryPickerScreen(
            countries = state.countries,
            selectedCountry = state.selectedCountry,
            onSave = { country ->
                vm.selectCountry(country)
                showCountryPicker = false
            },
            onClose = { showCountryPicker = false }
        )
        return
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.surfacePrimary)
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            DefaultAppBar(
                // App parity: the app's bar on this screen passes showGlow = false (solid Green700).
                showGlow = false,
title = when (state.step) {
                    AuthStep.PhoneEntry -> label(Labels.SIGN_UP, "Sign up")
                    AuthStep.OtpEntry -> label(Labels.VERIFY, "Verify")
                },
                leftIcon = Icons.Filled.Close,
                leftRadius = Radius.Rounded,
                onLeftClick = onClose
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    // App b72ea4da/7e968df3 made the phone-entry column scrollable and added
                    // navigationBarsPadding(); the SDK already scrolled here (one level up, so
                    // the OTP step scrolls too — adding the app's inner scroll would nest two
                    // scrollables), but it had no navigation-bar inset, so the last button sat
                    // under the gesture bar on a tall device with the keyboard down.
                    // union(), not imePadding().navigationBarsPadding(): the IME inset already
                    // includes the navigation bar, and chaining the two modifiers SUMS them —
                    // that would push the content up by the bar height a second time whenever the
                    // keyboard is open. union() takes the larger of the two.
                    .windowInsetsPadding(WindowInsets.ime.union(WindowInsets.navigationBars))
                    // App parity (AuthScreen.kt:440): 32dp top, 24dp bottom — not 24/24.
                    .padding(horizontal = 20.dp)
                    .padding(top = 32.dp, bottom = 24.dp)
            ) {
                when (state.step) {
                    AuthStep.PhoneEntry -> PhoneEntryContent(
                        vm = vm,
                        state = state,
                        onOpenCountryPicker = { showCountryPicker = true },
                        onOpenLegal = onOpenLegal
                    )

                    AuthStep.OtpEntry -> OtpEntryContent(
                        vm = vm,
                        state = state,
                        resendSecondsLeft = resendSecondsLeft,
                        onResend = {
                            vm.sendOtp(state.selectedChannel ?: "sms", isResend = true)
                            resendSecondsLeft = AuthViewModel.RESEND_TIMEOUT_SECONDS
                        }
                    )
                }
            }
        }

        if (showSimPicker && simNumbers.isNotEmpty()) {
            SimNumberPickerDialog(
                numbers = simNumbers,
                onPick = { number ->
                    showSimPicker = false
                    vm.applySimNumber(number)
                },
                onDismiss = { showSimPicker = false }
            )
        }

        Toast(
            message = toast.message,
            state = toast.state,
            visible = toast.isVisible,
            onDismiss = { toast.dismiss() }
        )
    }
}

@Composable
private fun PhoneEntryContent(
    vm: AuthViewModel,
    state: org.digitalgreen.farmerchat.sdk.core.ui.auth.AuthUiState,
    onOpenCountryPicker: () -> Unit,
    onOpenLegal: (url: String, title: String) -> Unit
) {
    val colors = LocalContentColors.current
    var phone by remember(state.phoneLocal) { mutableStateOf(state.phoneLocal) }

    val isSendingOtp = state.sendOtpState is UiState.Loading

    // App parity (AuthScreen.kt:802-818): heading, Spacer(8), subtitle, Spacer(24), phone row.
    // The outer gap is 24dp, not 16 — a 16dp arrangement pulled everything below the subtitle up
    // by 8dp.
    // App parity (AuthScreen.kt:802-928): the gaps down this column are NOT uniform —
    // heading 8 subtitle 24 phone-row 20 card 12 buttons 8 consent. A single spacedBy(24)
    // pushed the card 4dp, the buttons 16dp and the consent text 32dp below the app's.
    Column {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = if (isSendingOtp) {
                    label(Labels.ENTER_PHONE_NUMBER, "Enter phone number")
                } else {
                    label(Labels.ENTER_YOUR_PHONE_NUMBER, "Enter your phone number")
                },
                // App parity (AuthScreen.kt:801-804): titleLarge, CENTRED, and the copy swaps
                // to the short form while the code is being sent. The SDK had displaySmall (a
                // full type step larger), no textAlign, and no sending variant.
                style = MaterialTheme.typography.titleLarge,
                color = colors.foregroundPrimary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )

            // App parity (AuthScreen.kt:809-814). This subtitle was MISSING from the SDK
            // entirely — both of its labels were declared in `Labels.kt` and rendered by
            // nothing, so the farmer never saw the line explaining what the phone number is
            // for. It is the sign-up screen's only explanation of the OTP.
            Text(
                text = if (isSendingOtp) {
                    label(Labels.SEND_OTP_SIGNIN_SHORT, "And we will send you a one time code")
                } else {
                    label(Labels.SEND_OTP_SIGNIN, "We'll send a one-time code to sign you in")
                },
                style = MaterialTheme.typography.bodyMedium,
                color = colors.foregroundSecondary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        if (state.countries.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 24.dp),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = colors.borderActive)
            }
        } else {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.Top
            ) {
                Box(
                    modifier = Modifier.clickableNoIndication { onOpenCountryPicker() }
                ) {
                    CountryCodeSelector(
                        countryCode = state.countryCode,
                        flagUrl = state.selectedCountry?.flag
                    )
                }

                TextInput(
                    value = phone,
                    onValueChange = {
                        phone = it.filter { c -> c.isDigit() }
                        vm.setPhoneLocal(phone)
                    },
                    // App parity (AuthScreen.kt:861): a literal digit mask, not a label — the
                    // served ENTER_PHONE_NUMBER string is the HEADING's text, and using it here
                    // put a full Kannada sentence in the field.
                    placeholder = "00000 00000",
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                        keyboardType = KeyboardType.Phone,
                        imeAction = ImeAction.Done
                    ),
                    state = if (state.phoneError != null)
                        org.digitalgreen.farmerchat.sdk.compose.components.TextInputState.Error
                    else
                        org.digitalgreen.farmerchat.sdk.compose.components.TextInputState.Default,
                    hint = state.phoneError,
                    showHint = state.phoneError != null,
                    showLabel = false,
                    // App parity: the app auto-focuses only its OTP input (OtpInput.kt:43), never
                    // the phone field. Focusing here opened the keyboard on entry and covered the
                    // agreement card and both send-code buttons.
                    autofocus = false,
                    modifier = Modifier.weight(1f)
                )
            }

            // App parity (ui/auth/AuthScreen.kt PhoneEntryContent): the agreement card sits
            // between the phone row and the send-code buttons.
            Spacer(modifier = Modifier.height(20.dp))
            AgreementCard()
            Spacer(modifier = Modifier.height(12.dp))

            val isSending = state.sendOtpState is UiState.Loading
            // App parity (AuthScreen.kt:888 `canSend = !isSending && isPhoneValid`): both channel
            // buttons stay disabled (dimmed) until the number is valid. `state` is read above, so
            // a phone edit recomposes this and re-evaluates the check.
            val canSend = !isSending && vm.isPhoneValid()

            // App parity (AuthScreen.kt:899-922): BOTH channels are filled PrimaryButtons at
            // 48dp with a LEADING channel icon and no chevron, spaced 8dp. The SDK had a 56dp
            // chevron button for WhatsApp and a white SecondaryButton for SMS, so the pair read
            // as a primary/secondary choice rather than two equal channels.
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (state.availableChannels.whatsappEnabled) {
                    PrimaryButton(
                        label = if (isSending && state.selectedChannel == "whatsapp")
                            label(Labels.SENDING_CODE, "Sending code...")
                        else label(Labels.SEND_VIA_WHATSAPP, "Send via WhatsApp"),
                        state = if (isSending && state.selectedChannel == "whatsapp")
                            PrimaryButtonState.Loading else PrimaryButtonState.Default,
                        enabled = canSend,
                        onClick = { vm.sendOtp("whatsapp") },
                        modifier = Modifier.fillMaxWidth(),
                        height = 48,
                        iconRes = R.drawable.fc_icon_whatsapp,
                        iconPosition = IconPosition.Leading
                    )
                }
                if (state.availableChannels.smsEnabled) {
                    PrimaryButton(
                        label = if (isSending && state.selectedChannel == "sms")
                            label(Labels.SENDING_CODE, "Sending code...")
                        else label(Labels.SEND_VIA_SMS, "Send via SMS"),
                        state = if (isSending && state.selectedChannel == "sms")
                            PrimaryButtonState.Loading else PrimaryButtonState.Default,
                        enabled = canSend,
                        onClick = { vm.sendOtp("sms") },
                        modifier = Modifier.fillMaxWidth(),
                        height = 48,
                        iconRes = R.drawable.fc_icon_sms,
                        iconPosition = IconPosition.Leading
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // App parity: consent copy with a clickable Privacy Policy link, immediately below
            // the send-code buttons.
            AuthConsentText(
                onOpenPrivacyPolicy = {
                    // App AuthScreen.kt:474 — track first, navigate only when the URL resolved.
                    FarmerChat.requireGraph().analytics.track(
                        AnalyticsEvents.PRIVACY_POLICY_OPENED,
                        mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.AUTH)
                    )
                    val url = state.legalLinks?.privacyPolicyUrl.orEmpty()
                    if (url.isNotBlank()) {
                        onOpenLegal(url, label(Labels.PRIVACY_POLICY, "Privacy Policy"))
                    }
                }
            )

            // The app REMOVED this legacy "By Continuing to Verification…" terms+privacy row:
            // its call site is commented out at ui/auth/AuthScreen.kt:492 and has been since
            // before c0524dd6. Commit 9966b905 replaced it with AgreementCard + AuthConsentText
            // above, which link Privacy Policy only. Terms-of-Use consent did not disappear — it
            // moved to the MANDATORY Home gate (TermsOfUseUpdatedBottomSheet, docs/02 #7a), so
            // signup collects communications consent and the gate collects ToU acceptance.
            // Keeping this row active was an SDK-only divergence that showed the farmer two
            // consent blurbs at once.
        }
    }
}

/**
 * "What you are agreeing to:" card — 1:1 port of the app's `AgreementCard`
 * (ui/auth/AuthScreen.kt, commit 9966b905). Colours come from the SDK theme tokens
 * (`surfaceTertiary` == the app's literal `Neutral200`, `foregroundPrimary` == its black) so a
 * themed host and dark mode both work; the light-mode pixels are identical to the app.
 */
@Composable
private fun AgreementCard() {
    val colors = LocalContentColors.current

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(color = colors.surfaceTertiary, shape = SmoothShapes.rounded(Radius.LG))
            .padding(horizontal = 18.dp, vertical = 12.dp)
    ) {
        Text(
            text = label(Labels.AGREEMENT_CARD_TITLE, "What you are agreeing to:"),
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp,
            color = colors.foregroundPrimary
        )

        Spacer(modifier = Modifier.height(8.dp))

        // App 2a5cf2b8 collapsed three bullets into two — the surveys line folded into the
        // updates bullet — and moved the Digital Green / partners attribution into the italic
        // info line below. AGREEMENT_POINT_SURVEYS is still declared in Labels.kt (the app kept
        // it too) but is deliberately no longer rendered.
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            AgreementBulletPoint(
                label(
                    Labels.AGREEMENT_POINT_VERIFICATION_CODE,
                    "A verification code by SMS or WhatsApp"
                )
            )
            AgreementBulletPoint(
                label(
                    Labels.AGREEMENT_POINT_UPDATES,
                    "FarmerChat updates, farming information, and occasional surveys or " +
                        "research by SMS, phone, or WhatsApp"
                )
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = label(
                Labels.AGREEMENT_CARD_INFO_TEXT,
                "Surveys or research may be conducted by Digital Green or trusted partners " +
                    "working with us."
            ),
            fontWeight = FontWeight.Bold,
            fontSize = 14.sp,
            fontStyle = FontStyle.Italic,
            // The app hardcodes Color(0xFF000000); the token keeps it legible in dark mode.
            color = colors.foregroundPrimary
        )
    }
}

@Composable
private fun AgreementBulletPoint(text: String) {
    val colors = LocalContentColors.current
    Row(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "\u2022",
            fontWeight = FontWeight.Normal,
            fontSize = 15.sp,
            color = colors.foregroundPrimary,
            modifier = Modifier.width(16.dp)
        )
        Text(
            text = text,
            fontWeight = FontWeight.Normal,
            fontSize = 15.sp,
            color = colors.foregroundPrimary,
            modifier = Modifier.weight(1f)
        )
    }
}

/**
 * Consent copy with a clickable "Privacy Policy" link — port of the app's `AuthConsentText`.
 * The app's `remember {}` takes no keys; the SDK resolves labels asynchronously through
 * `LabelManager`, so the annotated string is keyed on the resolved strings — otherwise it would
 * freeze on the English fallback whenever the card composes before endpoint #3 lands.
 */
@Composable
private fun AuthConsentText(onOpenPrivacyPolicy: () -> Unit) {
    val colors = LocalContentColors.current
    val currentOnOpenPrivacyPolicy by rememberUpdatedState(onOpenPrivacyPolicy)

    val prefix = label(
        Labels.AUTH_CONSENT_PREFIX,
        "By continuing, you agree to these communications.\nSee our "
    )
    val privacyLabel = label(Labels.PRIVACY_POLICY, "Privacy Policy")
    // App ae37b28e: the trailing "." became a full sentence carried by its own label, and the
    // link span picked up the body colour so it stays legible in dark mode (the app switched off
    // its hardcoded 0xA3000000 to the secondary foreground — the token this screen already used).
    val suffix = label(
        Labels.AUTH_CONSENT_SUFFIX,
        "for more information, including how to withdraw your consent."
    )
    val consentColor = colors.foregroundSecondary

    val annotated = remember(prefix, privacyLabel, suffix, consentColor) {
        buildAnnotatedString {
            append(prefix)
            withLink(
                LinkAnnotation.Clickable(
                    tag = "PRIVACY",
                    linkInteractionListener = { currentOnOpenPrivacyPolicy() }
                )
            ) {
                withStyle(
                    SpanStyle(
                        color = consentColor,
                        textDecoration = TextDecoration.Underline
                    )
                ) {
                    append(privacyLabel)
                }
            }
            append(" ")
            append(suffix)
        }
    }

    BasicText(
        text = annotated,
        style = TextStyle(
            fontWeight = FontWeight.Normal,
            fontSize = 15.sp,
            color = consentColor,
            textAlign = TextAlign.Center
        ),
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
private fun OtpEntryContent(
    vm: AuthViewModel,
    state: org.digitalgreen.farmerchat.sdk.core.ui.auth.AuthUiState,
    resendSecondsLeft: Int,
    onResend: () -> Unit
) {
    val colors = LocalContentColors.current
    val isVerifying = state.verifyOtpState is UiState.Loading

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(
            text = label(Labels.ENTER_CODE_WE_SENT, "Enter the code we sent"),
            // App parity (AuthScreen.kt:1040-1042): titleLarge and CENTRED, same as the phone
            // step's heading above.
            style = MaterialTheme.typography.titleLarge,
            color = colors.foregroundPrimary,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )

        Text(
            // App parity (ui/auth/AuthScreen.kt OtpEntryContent): the label stands alone —
            // the app does NOT append the phone number here.
            text = label(Labels.CHECK_YOUR_MESSAGES_CODE, "Check your messages for the code"),
            style = MaterialTheme.typography.bodyMedium,
            color = colors.foregroundSecondary
        )

        OtpInput(
            value = state.otp,
            onValueChange = { vm.setOtp(it) },
            isError = state.otpError != null,
            enabled = !isVerifying,
            length = AuthViewModel.OTP_LENGTH
        )

        if (state.otpError != null) {
            Text(
                text = state.otpError!!,
                style = MaterialTheme.typography.labelSmall,
                color = org.digitalgreen.farmerchat.sdk.compose.theme.Red500
            )
        }

        PrimaryButton(
            label = if (isVerifying) label(Labels.VERIFYING, "Verifying")
            else label(Labels.VERIFY, "Verify"),
            state = if (isVerifying) PrimaryButtonState.Loading else PrimaryButtonState.Chevron,
            enabled = state.otp.length == AuthViewModel.OTP_LENGTH && !isVerifying,
            onClick = { vm.verifyOtp() },
            modifier = Modifier.fillMaxWidth(),
            height = 56
        )

        if (resendSecondsLeft > 0) {
            Text(
                text = "${label(Labels.RESEND_CODE, "Resend code")} · $resendSecondsLeft ${label(Labels.SECONDS, "seconds")}",
                style = MaterialTheme.typography.bodySmall,
                color = colors.foregroundSecondary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                SecondaryButton(
                    label = label(Labels.RESEND_CODE, "Resend code"),
                    onClick = onResend,
                    modifier = Modifier.fillMaxWidth()
                )
                SecondaryButton(
                    label = label(Labels.START_OVER, "Start over"),
                    onClick = { vm.startOver() },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

/** Full-screen country picker: search + radio list + Save (doc 01 §3.4). */
@Composable
private fun CountryPickerScreen(
    countries: List<CountryItem>,
    selectedCountry: CountryItem?,
    onSave: (CountryItem) -> Unit,
    onClose: () -> Unit
) {
    val colors = LocalContentColors.current
    var query by remember { mutableStateOf("") }
    var pendingSelection by remember { mutableStateOf(selectedCountry) }
    val bottomInset = fcNavigationBarsBottom()

    val filtered = remember(query, countries) {
        if (query.isBlank()) countries
        else countries.filter {
            it.name.contains(query, ignoreCase = true) ||
                it.display_name.contains(query, ignoreCase = true) ||
                it.phone_country_code.contains(query)
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.surfacePrimary)
    ) {
        DefaultAppBar(
            // App parity: the app's bar on this screen passes showGlow = false (solid Green700).
            showGlow = false,
title = label(Labels.SELECT_COUNTRY_CODE, "Select country code"),
            leftIcon = Icons.AutoMirrored.Filled.ArrowBack,
            leftRadius = Radius.Rounded,
            onLeftClick = onClose
        )

        Column(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 16.dp)
        ) {
            Spacer(modifier = Modifier.height(12.dp))

            SearchInput(
                value = query,
                onValueChange = { query = it },
                placeholder = label(Labels.SEARCH, "Search")
            )

            Spacer(modifier = Modifier.height(12.dp))

            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.weight(1f)
            ) {
                items(filtered, key = { it.id }) { country ->
                    RadioButton(
                        label = "${country.display_name.ifBlank { country.name }} (${country.phone_country_code})",
                        selected = pendingSelection?.id == country.id,
                        onClick = { pendingSelection = country },
                        countryCode = country.code,
                        flagUrl = country.flag,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 12.dp + bottomInset)
        ) {
            PrimaryButton(
                label = label(Labels.SAVE_SELECTION, "Save selection"),
                enabled = pendingSelection != null,
                onClick = { pendingSelection?.let(onSave) },
                modifier = Modifier.fillMaxWidth(),
                height = 56
            )
        }
    }
}

private fun Modifier.clickableNoIndication(onClick: () -> Unit): Modifier =
    composed {
        clickable(
            interactionSource = remember { androidx.compose.foundation.interaction.MutableInteractionSource() },
            indication = null,
            onClick = onClick
        )
    }

/**
 * SIM chooser shown when the device reports more than one SIM number.
 * App parity: `AuthScreen.kt:561` — a plain AlertDialog listing the numbers, with a Close action.
 */
@Composable
private fun SimNumberPickerDialog(
    numbers: List<String>,
    onPick: (String) -> Unit,
    onDismiss: () -> Unit
) {
    val colors = LocalContentColors.current
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = label(Labels.CHOOSE_SIM_NUMBER, "Choose SIM number"),
                color = colors.foregroundPrimary
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                numbers.forEach { number ->
                    Text(
                        text = number,
                        color = colors.foregroundPrimary,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onPick(number) }
                            .padding(vertical = 8.dp)
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text(label(Labels.CLOSE, "Close"))
            }
        }
    )
}
