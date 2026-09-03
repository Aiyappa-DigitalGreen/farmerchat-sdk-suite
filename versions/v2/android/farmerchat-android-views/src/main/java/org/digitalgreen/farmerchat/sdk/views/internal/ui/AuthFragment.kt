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
import android.text.style.BulletSpan
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
import org.digitalgreen.farmerchat.sdk.views.internal.widgets.ToastView

/**
 * Phone + OTP auth (doc 01 §3.4): country picker, WhatsApp/SMS channels,
 * 4-digit OTP with 180 s resend timer, SMS Retriever (guarded), start-over.
 */
internal class AuthFragment : BaseFragment(R.layout.fc_fragment_auth) {

    private val vm: AuthViewModel by lazy { coreVm("auth") { graph.authViewModel() } }

    private lateinit var binding: FcFragmentAuthBinding
    private var countdown: CountDownTimer? = null
    private var currentStep: AuthStep? = null
    private var smsReceiver: BroadcastReceiver? = null
    private var navigatedToSuccess = false
    private var lastToastMessage: String? = null

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        binding = FcFragmentAuthBinding.bind(view)

        graph.analytics.trackScreenView(AnalyticsScreens.AUTH)
        graph.analytics.track(
            AnalyticsEvents.MOBILE_VERIFICATION_STARTED,
            mapOf(
                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.AUTH,
                AnalyticsProps.TRIGGER_LOWER to "Signup button"
            )
            )

        renderStaticTexts()

        binding.fcAuthClose.setOnClickListener { findNavController().popBackStack() }
        binding.fcCountrySelector.setOnClickListener { openCountryPicker() }
        binding.fcPhoneInput.doAfterTextChanged { editable ->
            vm.setPhoneLocal(editable?.toString().orEmpty())
        }
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
            binding.fcCountryLoading.isVisible = state.countries.isEmpty()
            val flagUrl = state.selectedCountry?.flag
            if (!flagUrl.isNullOrBlank()) {
                binding.fcCountryFlag.load(flagUrl)
            }
            binding.fcPhoneError.isVisible = state.phoneError != null
            binding.fcPhoneError.text = state.phoneError

            val sending = state.sendOtpState is UiState.Loading
            binding.fcWhatsappButton.isVisible = state.availableChannels.whatsappEnabled
            binding.fcSmsButton.isVisible = state.availableChannels.smsEnabled
            binding.fcWhatsappButton.state =
                if (sending && state.selectedChannel == "whatsapp") PrimaryButtonView.State.LOADING
                else PrimaryButtonView.State.DEFAULT
            binding.fcSmsButton.state =
                if (sending && state.selectedChannel == "sms") PrimaryButtonView.State.LOADING
                else PrimaryButtonView.State.DEFAULT
            binding.fcWhatsappButton.text =
                if (sending && state.selectedChannel == "whatsapp") {
                    label(Labels.SENDING_CODE, "Sending code...")
                } else label(Labels.SEND_VIA_WHATSAPP, "Send via WhatsApp")
            binding.fcSmsButton.text =
                if (sending && state.selectedChannel == "sms") {
                    label(Labels.SENDING_CODE, "Sending code...")
                } else label(Labels.SEND_VIA_SMS, "Send via SMS")

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
        binding.fcAuthTitle.text = label(Labels.SIGN_UP, "Sign up")
        binding.fcPhoneTitle.text = label(Labels.ENTER_YOUR_PHONE_NUMBER, "Enter your phone number")
        binding.fcPhoneSubtitle.text =
            label(Labels.SEND_OTP_SIGNIN, "We'll send a one-time code to sign you in")
        binding.fcPhoneInput.hint = label(Labels.ENTER_PHONE_NUMBER, "Enter phone number")
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
     * (ui/auth/AuthScreen.kt, commit 9966b905). `BulletSpan` reproduces the app's 16 dp bullet
     * column with the hanging indent for wrapped lines.
     */
    private fun renderAgreementCard() {
        binding.fcAgreementTitle.text =
            label(Labels.AGREEMENT_CARD_TITLE, "What you are agreeing to:")
        binding.fcAgreementPoint1.text = bulletLine(
            label(
                Labels.AGREEMENT_POINT_VERIFICATION_CODE,
                "A verification code by SMS, phone, or WhatsApp"
            )
        )
        binding.fcAgreementPoint2.text = bulletLine(
            label(Labels.AGREEMENT_POINT_UPDATES, "FarmerChat updates and farming information")
        )
        binding.fcAgreementPoint3.text = bulletLine(
            label(
                Labels.AGREEMENT_POINT_SURVEYS,
                "Occasional surveys or research by Digital Green or trusted partners"
            )
        )
    }

    private fun bulletLine(text: String): CharSequence {
        val gap = (BULLET_GAP_DP * resources.displayMetrics.density).toInt()
        return SpannableStringBuilder(text).apply {
            setSpan(BulletSpan(gap), 0, length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        }
    }

    /**
     * Consent copy below the send-code buttons with only the "Privacy Policy" span clickable —
     * port of the app's `AuthConsentText`. The app underlines the span without recolouring it,
     * so `updateDrawState` keeps the TextView's own colour.
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
        builder.append(".")

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

    override fun onDestroyView() {
        stopTimer()
        unregisterSmsReceiver()
        super.onDestroyView()
    }
}

/** App parity: the agreement bullet sits in a 16 dp column (AuthScreen.kt AgreementBulletPoint). */
private const val BULLET_GAP_DP = 16
