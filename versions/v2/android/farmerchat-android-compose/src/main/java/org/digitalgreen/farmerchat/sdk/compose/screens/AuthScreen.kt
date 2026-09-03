package org.digitalgreen.farmerchat.sdk.compose.screens

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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
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
                title = when (state.step) {
                    AuthStep.PhoneEntry -> label(Labels.SIGN_UP, "Sign up")
                    AuthStep.OtpEntry -> label(Labels.VERIFY, "Verify")
                },
                leftIcon = Icons.Filled.Close,
                onLeftClick = onClose
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .imePadding()
                    .padding(horizontal = 20.dp, vertical = 24.dp)
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

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(
            text = label(Labels.ENTER_YOUR_PHONE_NUMBER, "Enter your phone number"),
            style = MaterialTheme.typography.displaySmall,
            color = colors.foregroundPrimary
        )

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
                    placeholder = label(Labels.ENTER_PHONE_NUMBER, "Enter phone number"),
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
                    autofocus = true,
                    modifier = Modifier.weight(1f)
                )
            }

            // App parity (ui/auth/AuthScreen.kt PhoneEntryContent): the agreement card sits
            // between the phone row and the send-code buttons.
            AgreementCard()

            val isSending = state.sendOtpState is UiState.Loading

            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                if (state.availableChannels.whatsappEnabled) {
                    PrimaryButton(
                        label = if (isSending && state.selectedChannel == "whatsapp")
                            label(Labels.SENDING_CODE, "Sending code...")
                        else label(Labels.SEND_VIA_WHATSAPP, "Send via WhatsApp"),
                        state = if (isSending && state.selectedChannel == "whatsapp")
                            PrimaryButtonState.Loading else PrimaryButtonState.Chevron,
                        enabled = !isSending,
                        onClick = { vm.sendOtp("whatsapp") },
                        modifier = Modifier.fillMaxWidth(),
                        height = 56
                    )
                }
                if (state.availableChannels.smsEnabled) {
                    if (state.availableChannels.whatsappEnabled) {
                        SecondaryButton(
                            label = if (isSending && state.selectedChannel == "sms")
                                label(Labels.SENDING_CODE, "Sending code...")
                            else label(Labels.SEND_VIA_SMS, "Send via SMS"),
                            isLoading = isSending && state.selectedChannel == "sms",
                            enabled = !isSending,
                            onClick = { vm.sendOtp("sms") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    } else {
                        PrimaryButton(
                            label = if (isSending && state.selectedChannel == "sms")
                                label(Labels.SENDING_CODE, "Sending code...")
                            else label(Labels.SEND_ONE_TIME_CODE, "Send one-time code"),
                            state = if (isSending && state.selectedChannel == "sms")
                                PrimaryButtonState.Loading else PrimaryButtonState.Chevron,
                            enabled = !isSending,
                            onClick = { vm.sendOtp("sms") },
                            modifier = Modifier.fillMaxWidth(),
                            height = 56
                        )
                    }
                }
            }

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

        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            AgreementBulletPoint(
                label(
                    Labels.AGREEMENT_POINT_VERIFICATION_CODE,
                    "A verification code by SMS, phone, or WhatsApp"
                )
            )
            AgreementBulletPoint(
                label(Labels.AGREEMENT_POINT_UPDATES, "FarmerChat updates and farming information")
            )
            AgreementBulletPoint(
                label(
                    Labels.AGREEMENT_POINT_SURVEYS,
                    "Occasional surveys or research by Digital Green or trusted partners"
                )
            )
        }
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

    val annotated = remember(prefix, privacyLabel) {
        buildAnnotatedString {
            append(prefix)
            withLink(
                LinkAnnotation.Clickable(
                    tag = "PRIVACY",
                    linkInteractionListener = { currentOnOpenPrivacyPolicy() }
                )
            ) {
                withStyle(SpanStyle(textDecoration = TextDecoration.Underline)) {
                    append(privacyLabel)
                }
            }
            append(".")
        }
    }

    BasicText(
        text = annotated,
        style = TextStyle(
            fontWeight = FontWeight.Normal,
            fontSize = 15.sp,
            color = colors.foregroundSecondary,
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
            style = MaterialTheme.typography.displaySmall,
            color = colors.foregroundPrimary
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
    val bottomInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()

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
            title = label(Labels.SELECT_COUNTRY_CODE, "Select country code"),
            leftIcon = Icons.AutoMirrored.Filled.ArrowBack,
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
