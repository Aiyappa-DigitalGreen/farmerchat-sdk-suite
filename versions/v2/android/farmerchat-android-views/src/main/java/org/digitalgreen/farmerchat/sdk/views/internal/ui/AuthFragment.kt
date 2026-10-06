package org.digitalgreen.farmerchat.sdk.views.internal.ui

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Bundle
import android.os.CountDownTimer
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.TextPaint
import android.text.method.LinkMovementMethod
import android.text.style.ClickableSpan
import android.text.style.UnderlineSpan
import android.view.View
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import androidx.lifecycle.lifecycleScope
import androidx.navigation.NavOptions
import androidx.navigation.fragment.findNavController
import coil.load
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.ui.auth.AuthStep
import org.digitalgreen.farmerchat.sdk.core.ui.auth.AuthViewModel
import org.digitalgreen.farmerchat.sdk.views.R
import org.digitalgreen.farmerchat.sdk.views.databinding.FcFragmentAuthBinding
import org.digitalgreen.farmerchat.sdk.views.internal.BaseFragment
import org.digitalgreen.farmerchat.sdk.views.internal.NavRoutes
import org.digitalgreen.farmerchat.sdk.views.internal.coreVm
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.PrimaryButtonView
import androidx.activity.result.contract.ActivityResultContracts
import org.digitalgreen.farmerchat.sdk.core.device.SimPhoneNumberProvider
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.ToastView
import org.digitalgreen.farmerchat.sdk.views.internal.util.applySystemBarBackdrop
import org.digitalgreen.farmerchat.sdk.views.internal.util.loadSvgOrImage
import org.digitalgreen.farmerchat.sdk.views.internal.theme.FcRecolor

/**
 * Phone + OTP auth (doc 01 §3.4): country picker, WhatsApp/SMS channels,
 * 4-digit OTP with 180 s resend timer, SMS Retriever (guarded), start-over.
 */
internal class AuthFragment : BaseFragment(R.layout.fc_fragment_auth) {

    private val vm: AuthViewModel by lazy { coreVm("auth") { graph.authViewModel() } }

    private lateinit var binding: FcFragmentAuthBinding
    private var countdown: CountDownTimer? = null
    private var loadedFlagUrl: String? = null
    private var currentStep: AuthStep? = null
    private var smsReceiver: BroadcastReceiver? = null
    private var navigatedToSuccess = false
    private var lastToastMessage: String? = null

    /**
     * SIM pre-fill runs once per screen; see [maybeAutoDetectSimNumber].
     *
     * Saved across recreation: a plain field resets on rotation, which on a device where the
     * guard passes would put a SECOND permission dialog in front of the farmer.
     */
    private var simAutoDetectDone = false

    /**
     * App parity (`AuthScreen.kt:377`). The app declares this launcher and never invokes it, so
     * its SIM pre-fill is unreachable on a fresh install; the SDK asks, but only when the HOST
     * declared the permissions. Deliberate divergence — docs/05.
     */
    private val simPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
            if (result.values.all { it }) {
                applySimNumbers(SimPhoneNumberProvider.getSimLineNumbers(requireContext()))
            } else {
                showSimPermissionError()
            }
        }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FcFragmentAuthBinding.bind(view)
        // Green status-bar inset + surface nav-bar strip, as the app paints them.
        binding.root.applySystemBarBackdrop()
        simAutoDetectDone = savedInstanceState?.getBoolean(STATE_SIM_AUTO_DETECT_DONE) ?: false

        graph.analytics.trackScreenView(AnalyticsScreens.AUTH)
        graph.analytics.track(
            AnalyticsEvents.MOBILE_VERIFICATION_STARTED,
            mapOf(
                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.AUTH,
                AnalyticsProps.TRIGGER_LOWER to "Signup button"
            )
            )

        renderStaticTexts()

        // App parity (AuthScreen.kt:321): the left action is CLOSE, not the drawer hamburger
        // the shared bar defaults to.
        binding.fcAuthAppBar.fcAppBarLeft.setImageResource(R.drawable.fc_ic_close)
        binding.fcAuthAppBar.fcAppBarLeft.setBackgroundResource(R.drawable.fc_bg_appbar_chip_round)
        // Set after inflation, so the inflater recolor never saw it.
        FcRecolor.maybeRecolor(binding.fcAuthAppBar.fcAppBarLeft)
        binding.fcAuthAppBar.fcAppBarLeft.setOnClickListener { findNavController().popBackStack() }
        binding.fcCountrySelector.setOnClickListener { openCountryPicker() }
        binding.fcPhoneInput.doAfterTextChanged { editable ->
            vm.setPhoneLocal(editable?.toString().orEmpty())
        }
        // App parity (AuthScreen.kt:515,530): each channel button carries its leading glyph.
        binding.fcWhatsappButton.setLeadingIcon(R.drawable.fc_icon_whatsapp)
        binding.fcSmsButton.setLeadingIcon(R.drawable.fc_icon_sms)
        binding.fcWhatsappButton.setOnClickListener { vm.sendOtp("whatsapp") }
        binding.fcSmsButton.setOnClickListener { vm.sendOtp("sms") }

        binding.fcOtpView.onOtpChanged = { otp -> vm.setOtp(otp) }
        binding.fcVerifyButton.setOnClickListener { vm.verifyOtp() }
        binding.fcResendButton.setOnClickListener {
            vm.state.value.selectedChannel?.let { channel -> vm.sendOtp(channel, isResend = true) }
        }
        binding.fcStartOverButton.setOnClickListener { vm.startOver() }

        vm.fetchCountries()
        vm.autoDetectCountryFromLocation()
        vm.fetchLegalLinks()

        vm.state.collectWhenStarted { state ->
            // Step switch
            if (state.step != currentStep) {
                currentStep = state.step
                onStepChanged(state.step)
            }

            // Phone entry
            binding.fcCountryCode.text = state.countryCode
            // App: while the preferred country is loading the selector shows ONLY a spinner.
            val countryLoading = state.countries.isEmpty() && state.selectedCountry == null
            binding.fcCountryLoading.isVisible = countryLoading
            binding.fcCountryFlag.isVisible = !countryLoading
            binding.fcCountryCode.isVisible = !countryLoading
            // The split needs the dial codes from endpoint #5, so this waits for the list.
            if (state.countries.isNotEmpty() && state.phoneLocal.isBlank()) {
                maybeAutoDetectSimNumber()
            }

            // State -> field, for PROGRAMMATIC writes only (the SIM pre-fill). The EditText is
            // otherwise the sole source of truth — `doAfterTextChanged` pushes one way — so a
            // number set by the view model never appeared on screen.
            //
            // `!hasFocus()` is the important half. Syncing on raw inequality alone fights the
            // farmer while they type: `setPhoneLocal` truncates to the country's `phone_length`,
            // so typing one digit past the limit made state and field disagree, and this branch
            // then called setText + setSelection(end) — eating the keystroke and yanking the
            // caret out of the middle of a number being edited. An unfocused field is never
            // being typed into, which is exactly when a programmatic pre-fill lands.
            if (!binding.fcPhoneInput.hasFocus() &&
                state.phoneLocal != binding.fcPhoneInput.text?.toString()
            ) {
                binding.fcPhoneInput.setText(state.phoneLocal)
                binding.fcPhoneInput.setSelection(state.phoneLocal.length)
            }
            val flagUrl = state.selectedCountry?.flag
            if (!flagUrl.isNullOrBlank() && flagUrl != loadedFlagUrl) {
                // Flags are SVG (the app renders them with SvgImage); the plain loader cannot
                // decode them and left the bundled India PNG on screen for every country.
                loadedFlagUrl = flagUrl
                binding.fcCountryFlag.loadSvgOrImage(flagUrl)
            }
            binding.fcPhoneError.isVisible = state.phoneError != null
            binding.fcPhoneError.text = state.phoneError

            // App PhoneEntryContent: while sending, ONE loading "Sending code..." button replaces
            // both channel buttons; otherwise each enabled channel shows, enabled only when the
            // number is valid for the country (`canSend`).
            val sending = state.sendOtpState is UiState.Loading
            val canSend = !sending && vm.isPhoneValid()
            binding.fcWhatsappButton.isVisible = !sending && state.availableChannels.whatsappEnabled
            binding.fcSmsButton.isVisible = sending || state.availableChannels.smsEnabled
            binding.fcWhatsappButton.state = PrimaryButtonView.State.DEFAULT
            binding.fcWhatsappButton.text = label(Labels.SEND_VIA_WHATSAPP, "Send via WhatsApp")
            binding.fcWhatsappButton.setButtonEnabled(canSend)
            if (sending) {
                binding.fcSmsButton.setLeadingIcon(null)
                binding.fcSmsButton.state = PrimaryButtonView.State.LOADING
                binding.fcSmsButton.text = label(Labels.SENDING_CODE, "Sending code...")
                binding.fcSmsButton.setButtonEnabled(true)
            } else {
                binding.fcSmsButton.setLeadingIcon(R.drawable.fc_icon_sms)
                binding.fcSmsButton.state = PrimaryButtonView.State.DEFAULT
                binding.fcSmsButton.text = label(Labels.SEND_VIA_SMS, "Send via SMS")
                binding.fcSmsButton.setButtonEnabled(canSend)
            }
            binding.fcPhoneTitle.text =
                if (sending) label(Labels.ENTER_PHONE_NUMBER, "Enter phone number")
                else label(Labels.ENTER_YOUR_PHONE_NUMBER, "Enter your phone number")
            binding.fcPhoneSubtitle.text =
                if (sending) label(Labels.SEND_OTP_SIGNIN_SHORT, "And we will send you a one time code")
                else label(Labels.SEND_OTP_SIGNIN, "We'll send a one-time code to sign you in")
            binding.fcPhoneInput.isEnabled = !sending
            binding.fcCountrySelector.isEnabled = !sending

            // OTP entry
            binding.fcOtpView.setOtp(state.otp)
            binding.fcOtpError.isVisible = state.otpError != null
            binding.fcOtpError.text = state.otpError
            val verifying = state.verifyOtpState is UiState.Loading
            binding.fcVerifyButton.state =
                if (verifying) PrimaryButtonView.State.LOADING else PrimaryButtonView.State.DEFAULT
            binding.fcVerifyButton.text =
                if (verifying) label(Labels.VERIFYING, "Verifying") else label(Labels.VERIFY, "Verify")
            binding.fcVerifyButton.setButtonEnabled(
                state.otp.length == AuthViewModel.OTP_LENGTH && !verifying
            )

            // Toast
            state.toast?.let { toast ->
                if (toast.message != lastToastMessage) {
                    lastToastMessage = toast.message
                    binding.fcAuthToast.show(
                        toast.message,
                        if (toast.type == org.digitalgreen.farmerchat.sdk.core.ui.auth.AuthToastType.Error) {
                            ToastView.Type.ERROR
                        } else ToastView.Type.SUCCESS
                    )
                    vm.consumeToast()
                }
            }

            // Verify success → delay 800 ms → AccountSuccess, popUpTo(Auth){inclusive}.
            if (state.verifyOtpState is UiState.Success && !navigatedToSuccess) {
                navigatedToSuccess = true
                viewLifecycleOwner.lifecycleScope.launch {
                    delay(800L)
                    findNavController().navigate(
                        R.id.fc_dest_account_success,
                        null,
                        NavOptions.Builder()
                            .setLaunchSingleTop(true)
                            .setPopUpTo(R.id.fc_dest_auth, inclusive = true)
                            .build()
                    )
                }
            }
        }
    }

    private fun renderStaticTexts() {
        binding.fcAuthAppBar.fcAppBarTitle.text = label(Labels.SIGN_UP, "Sign up")
        binding.fcPhoneTitle.text = label(Labels.ENTER_YOUR_PHONE_NUMBER, "Enter your phone number")
        binding.fcPhoneSubtitle.text =
            label(Labels.SEND_OTP_SIGNIN, "We'll send a one-time code to sign you in")
        // App parity, and the same label-key misuse already fixed on compose/iOS/RN/web:
        // ENTER_PHONE_NUMBER is the screen's HEADING, so using it as the field hint put a whole
        // Kannada sentence inside the input. The app uses the literal digit mask.
        binding.fcPhoneInput.hint = "00000 00000"
        renderAgreementCard()
        renderAuthConsent()
        // The app REMOVED this legacy "By Continuing to Verification…" terms+privacy line:
        // its call site is commented out at ui/auth/AuthScreen.kt:492 and has been since before
        // c0524dd6. Commit 9966b905 replaced it with the agreement card + consent text rendered
        // just above, which link Privacy Policy only. Terms-of-Use consent moved to the MANDATORY
        // Home gate (TermsOfUseUpdatedBottomSheet, docs/02 #7a). The view stays in the layout as
        // GONE so a host that needs the old combined link can re-enable it in one line.
        binding.fcAuthLegal.visibility = android.view.View.GONE
        binding.fcOtpTitle.text = label(Labels.ENTER_CODE_WE_SENT, "Enter the code we sent")
        binding.fcOtpSubtitle.text =
            label(Labels.CHECK_YOUR_MESSAGES_CODE, "Check your messages for the code")
        binding.fcVerifyButton.text = label(Labels.VERIFY, "Verify")
        binding.fcResendButton.text = label(Labels.RESEND_CODE, "Resend code")
        binding.fcStartOverButton.text = label(Labels.START_OVER, "Start over")
    }

    /**
     * "What you are agreeing to:" card — port of the app's `AgreementCard`
     * (ui/auth/AuthScreen.kt, commit 9966b905). The "•" and its 16dp column are separate
     * views in the layout (the app's Row), so wrapped lines hang-indent like the app's.
     */
    private fun renderAgreementCard() {
        binding.fcAgreementTitle.text =
            label(Labels.AGREEMENT_CARD_TITLE, "What you are agreeing to:")
        binding.fcAgreementPoint1.text = (
            label(
                Labels.AGREEMENT_POINT_VERIFICATION_CODE,
                "A verification code by SMS or WhatsApp"
            )
        )
        binding.fcAgreementPoint2.text = (
            label(
                Labels.AGREEMENT_POINT_UPDATES,
                "FarmerChat updates, farming information, and occasional surveys or " +
                    "research by SMS, phone, or WhatsApp"
            )
        )
        // App 2a5cf2b8: the surveys bullet folded into the line above and the Digital Green /
        // partners attribution moved to this un-bulleted bold-italic line.
        // AGREEMENT_POINT_SURVEYS stays declared in Labels.kt but is no longer rendered.
        binding.fcAgreementInfo.text = label(
            Labels.AGREEMENT_CARD_INFO_TEXT,
            "Surveys or research may be conducted by Digital Green or trusted partners " +
                "working with us."
        )
    }

    /**
     * Consent copy below the send-code buttons with only the "Privacy Policy" span clickable —
     * port of the app's `AuthConsentText`. The app now colours the span with the same secondary
     * foreground as the body (ae37b28e, so it stays legible in dark mode), which is what this
     * TextView is already tinted with — so `updateDrawState` still just keeps the TextView's own
     * colour and no explicit ForegroundColorSpan is needed.
     */
    private fun renderAuthConsent() {
        val prefix = label(
            Labels.AUTH_CONSENT_PREFIX,
            "By continuing, you agree to these communications.\nSee our "
        )
        val privacy = label(Labels.PRIVACY_POLICY, "Privacy Policy")

        val builder = SpannableStringBuilder(prefix)
        val start = builder.length
        builder.append(privacy)
        builder.setSpan(UnderlineSpan(), start, builder.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        builder.setSpan(
            object : ClickableSpan() {
                override fun onClick(widget: View) = openPrivacyPolicy(privacy)
                override fun updateDrawState(ds: TextPaint) {
                    ds.isUnderlineText = true
                }
            },
            start, builder.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
        )
        // App ae37b28e: the trailing "." became a full sentence carried by its own label.
        builder.append(" ")
        builder.append(
            label(
                Labels.AUTH_CONSENT_SUFFIX,
                "for more information, including how to withdraw your consent."
            )
        )

        binding.fcAuthConsent.text = builder
        binding.fcAuthConsent.movementMethod = LinkMovementMethod.getInstance()
    }

    /** App AuthScreen.kt:474 — track first, navigate only when the URL resolved. */
    private fun openPrivacyPolicy(title: String) {
        graph.analytics.track(
            AnalyticsEvents.PRIVACY_POLICY_OPENED,
            mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.AUTH)
        )
        val url = vm.state.value.legalLinks?.privacyPolicyUrl.orEmpty()
        if (url.isNotBlank()) {
            findNavController().navigate(
                R.id.fc_dest_legal_content,
                NavRoutes.legalArgs(url, title),
                NavRoutes.singleTop()
            )
        }
    }

    private fun onStepChanged(step: AuthStep) {
        when (step) {
            AuthStep.PhoneEntry -> {
                binding.fcAuthFlipper.displayedChild = 0
                stopTimer()
                unregisterSmsReceiver()
            }
            AuthStep.OtpEntry -> {
                binding.fcAuthFlipper.displayedChild = 1
                graph.analytics.trackScreenView(AnalyticsScreens.VERIFY_OTP)
                binding.fcOtpView.focusInput()
                startTimer()
                startSmsRetriever()
            }
        }
    }

    // ------------------------------------------------------------------ timer

    private fun startTimer() {
        stopTimer()
        binding.fcOtpTimer.isVisible = true
        binding.fcOtpResendRow.isVisible = false
        countdown = object : CountDownTimer(
            AuthViewModel.RESEND_TIMEOUT_SECONDS * 1000L, 1000L
        ) {
            override fun onTick(millisUntilFinished: Long) {
                if (view == null) return
                binding.fcOtpTimer.text =
                    "${millisUntilFinished / 1000} ${label(Labels.SECONDS, "seconds")}"
            }

            override fun onFinish() {
                if (view == null) return
                binding.fcOtpTimer.isVisible = false
                binding.fcOtpResendRow.isVisible = true
            }
        }.start()
    }

    private fun stopTimer() {
        countdown?.cancel()
        countdown = null
    }

    // ------------------------------------------------------------------ SMS Retriever (optional)

    private fun startSmsRetriever() {
        runCatching {
            val client = com.google.android.gms.auth.api.phone.SmsRetriever.getClient(requireActivity())
            client.startSmsRetriever()
            registerSmsReceiver()
        }
    }

    private fun registerSmsReceiver() {
        if (smsReceiver != null) return
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                runCatching {
                    val extras = intent?.extras ?: return@runCatching
                    val status = extras.get(
                        com.google.android.gms.auth.api.phone.SmsRetriever.EXTRA_STATUS
                    ) as? com.google.android.gms.common.api.Status ?: return@runCatching
                    if (status.statusCode == com.google.android.gms.common.api.CommonStatusCodes.SUCCESS) {
                        val message = extras.getString(
                            com.google.android.gms.auth.api.phone.SmsRetriever.EXTRA_SMS_MESSAGE
                        ).orEmpty()
                        extractOtpFromMessage(message)?.let { otp ->
                            vm.setOtp(otp)
                            binding.fcOtpView.setOtp(otp)
                        }
                    }
                }
            }
        }
        runCatching {
            val filter = IntentFilter(
                com.google.android.gms.auth.api.phone.SmsRetriever.SMS_RETRIEVED_ACTION
            )
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                requireContext().registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
            } else {
                @Suppress("UnspecifiedRegisterReceiverFlag")
                requireContext().registerReceiver(receiver, filter)
            }
            smsReceiver = receiver
        }
    }

    private fun unregisterSmsReceiver() {
        smsReceiver?.let { receiver ->
            runCatching { requireContext().unregisterReceiver(receiver) }
        }
        smsReceiver = null
    }

    private fun extractOtpFromMessage(message: String): String? =
        Regex("\\b(\\d{4})\\b").find(message)?.groupValues?.getOrNull(1)

    // ------------------------------------------------------------------ country picker

    private fun openCountryPicker() {
        val state = vm.state.value
        if (state.countries.isEmpty()) return
        CountryPickerDialogFragment(
            countries = state.countries,
            initialSelection = state.selectedCountry,
            onSave = { country -> vm.selectCountry(country) }
        ).show(childFragmentManager, "fc_country_picker")
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean(STATE_SIM_AUTO_DETECT_DONE, simAutoDetectDone)
    }

    override fun onDestroyView() {
        stopTimer()
        unregisterSmsReceiver()
        super.onDestroyView()
    }

    // ------------------------------------------------------------------ SIM number pre-fill

    /**
     * Reads the device's SIM numbers so the farmer does not have to type a number their phone
     * already knows: one SIM pre-fills the fields, several open a chooser.
     *
     * The SDK declares neither `READ_PHONE_STATE` nor `READ_PHONE_NUMBERS` — a library manifest
     * merges into every host, and these are sensitive. A host opts in by declaring them; this is
     * silent otherwise. See `SimPhoneNumberProvider`.
     */
    private fun maybeAutoDetectSimNumber() {
        if (simAutoDetectDone || !isAdded) return
        // App parity: the SIM is consulted ONLY when no country ISO is resolved yet. Without this
        // the deferred GPS `applyIso` runs afterwards, calls selectCountry, and clears the number
        // the SIM had just pre-filled.
        if (!vm.shouldAutoDetectFromSim()) {
            simAutoDetectDone = true
            return
        }
        val ctx = requireContext()
        if (!SimPhoneNumberProvider.canReadPhoneNumber(ctx)) {
            if (SimPhoneNumberProvider.isDeclaredByHost(ctx)) {
                simAutoDetectDone = true
                simPermissionLauncher.launch(SimPhoneNumberProvider.requiredPermissions)
            }
            return
        }
        simAutoDetectDone = true
        applySimNumbers(SimPhoneNumberProvider.getSimLineNumbers(ctx))
    }

    private fun applySimNumbers(numbers: List<String>) {
        if (!isAdded) return
        when {
            numbers.size > 1 -> showSimPicker(numbers)
            numbers.size == 1 -> vm.applySimNumber(numbers.first())
        }
    }

    /** App parity (`AuthScreen.kt:561`): a plain list dialog with a Close action. */
    private fun showSimPicker(numbers: List<String>) {
        androidx.appcompat.app.AlertDialog.Builder(requireContext())
            .setTitle(label(Labels.CHOOSE_SIM_NUMBER, "Choose SIM number"))
            .setItems(numbers.toTypedArray()) { dialog, which ->
                dialog.dismiss()
                numbers.getOrNull(which)?.let { vm.applySimNumber(it) }
            }
            .setPositiveButton(label(Labels.CLOSE, "Close")) { dialog, _ -> dialog.dismiss() }
            .show()
    }

    private fun showSimPermissionError() {
        if (!isAdded) return
        binding.fcAuthToast.show(
            label(
                Labels.PERMISSIONS_ARE_REQUIRED_TO_AUTO_DETECT_SIM_NUMBER,
                "Permissions are required to auto-detect SIM number."
            ),
            ToastView.Type.ERROR
        )
    }
}

/** App parity: the agreement bullet sits in a 16 dp column (AuthScreen.kt AgreementBulletPoint). */

private const val STATE_SIM_AUTO_DETECT_DONE = "fc_sim_auto_detect_done"
