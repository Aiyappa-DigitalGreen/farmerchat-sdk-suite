package org.digitalgreen.farmerchat.sdk.core.ui.auth

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsEvents
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsProps
import org.digitalgreen.farmerchat.sdk.core.analytics.AnalyticsScreens
import org.digitalgreen.farmerchat.sdk.core.analytics.FarmerChatAnalytics
import org.digitalgreen.farmerchat.sdk.core.auth.SessionManager
import org.digitalgreen.farmerchat.sdk.core.base.ApiResult
import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.base.toUiError
import org.digitalgreen.farmerchat.sdk.core.labels.LabelManager
import org.digitalgreen.farmerchat.sdk.core.labels.Labels
import org.digitalgreen.farmerchat.sdk.core.model.CountryItem
import org.digitalgreen.farmerchat.sdk.core.model.SendOtpRequest
import org.digitalgreen.farmerchat.sdk.core.model.VerifyOtpRequest
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.CoreViewModel
import org.digitalgreen.farmerchat.sdk.core.usecase.GetSupportedLanguagesUseCase
import org.digitalgreen.farmerchat.sdk.core.usecase.PhoneAuthUseCases

/**
 * Phone + OTP auth state machine (port of the app's AuthViewModel).
 * PhoneEntry (country picker, channel buttons) → OtpEntry (4 digits, 180 s timer,
 * resend / start-over). Verify success persists session via [SessionManager].
 */
class AuthViewModel(
    private val phoneAuth: PhoneAuthUseCases,
    private val legalLinksUseCase: GetSupportedLanguagesUseCase,
    private val sessionManager: SessionManager,
    private val prefs: SdkPreferences,
    private val labelManager: LabelManager,
    private val analytics: FarmerChatAnalytics
) : CoreViewModel() {

    companion object {
        const val OTP_LENGTH = 4

        /**
         * 1:1 port of the app's `isPhoneValid` (ui/auth/AuthViewModel.kt:861).
         *
         * Order matters: the Ethiopia special case short-circuits, then the country
         * `phone_length` is a hard gate, then `phone_number_pattern` is a hard gate,
         * and finally an unknown country falls back to a plausible 6..15 digits.
         *
         * The app additionally runs Google libphonenumber as a safety net but
         * explicitly does NOT hard-fail when the library is absent (`libOk == false`
         * only). The SDK ships no libphonenumber dependency, so this is the app's own
         * library-absent path — recorded in docs/04.
         */
        fun isPhoneValid(
            countryCode: String,
            phoneLocal: String,
            country: CountryItem?
        ): Boolean {
            val digits = phoneLocal.filter { it.isDigit() }

            // Special rule retained from v1 for Ethiopia (+251).
            if (countryCode == "+251") {
                return (digits.startsWith("7") || digits.startsWith("9")) && digits.length == 9
            }

            if (digits.isBlank()) return false

            // Country phone_length when available.
            if (country != null && country.phone_length > 0 &&
                digits.length != country.phone_length
            ) {
                return false
            }

            // Country regex pattern when provided.
            val pattern = country?.phone_number_pattern?.takeIf { it.isNotBlank() }
            if (pattern != null) {
                val ok = runCatching { Regex(pattern).matches(digits) }.getOrDefault(false)
                if (!ok) return false
            }

            // Don't hard-block unknown countries; require a plausible minimum length.
            return digits.length in 6..15
        }

        const val RESEND_TIMEOUT_SECONDS = 180
    }

    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state

    /** ISO detected before the countries list loaded; applied after fetchCountries. */
    private var pendingAutoIso: String? = null

    // ------------------------------------------------------------------ country selection

    fun setCountryCode(code: String) {
        val normalized = code.trim()
        if (normalized.isBlank()) return
        val match = _state.value.countries.firstOrNull { it.phone_country_code == normalized }
        if (match != null) {
            selectCountry(match)
            return
        }
        _state.update { it.copy(countryCode = normalized, selectedCountry = null, phoneLocal = "") }
        refreshOtpModeForCountry(normalized)
    }

    /** Auto-set phone country code from SIM. */
    fun setCountryCodeFromSim(code: String) {
        setCountryCode(code)
    }

    fun selectCountry(country: CountryItem) {
        _state.update {
            it.copy(
                selectedCountry = country,
                countryCode = country.phone_country_code,
                phoneLocal = "",
                phoneError = null
            )
        }
        prefs.putString(
            SdkPreferences.Keys.GET_USER_SELECTED_COUNTRY_PHONE_CODE,
            country.phone_country_code
        )
        // App AuthScreen.kt:227 — `screen_name` + `country_code` (the ISO code, not the name).
        analytics.track(
            AnalyticsEvents.COUNTRY_SELECTED,
            mapOf(
                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.SELECT_COUNTRY,
                AnalyticsProps.COUNTRY_CODE to country.code
            )
        )
        refreshOtpModeForCountry(country.phone_country_code)
    }

    /**
     * Auto-detect country from stored guest-init location (USER_COUNTRY_CODE ISO).
     * The app resolves via Geocoder/IP detectors; the SDK uses the persisted
     * guest-init country which comes from the same backend signal.
     */
    fun autoDetectCountryFromLocation() {
        val iso = prefs.getString(SdkPreferences.Keys.USER_COUNTRY_CODE, "").trim()
        if (iso.isBlank()) return
        val countries = _state.value.countries
        if (countries.isEmpty()) {
            pendingAutoIso = iso
            return
        }
        applyIso(iso)
    }

    private fun applyIso(iso: String) {
        val match = _state.value.countries.firstOrNull { it.code.equals(iso, ignoreCase = true) }
        if (match != null) selectCountry(match)
    }

    fun showLocationDetectionError() {
        _state.update {
            it.copy(
                toast = AuthToast(
                    message = labelManager.getLabel(
                        Labels.COULDNT_GET_YOUR_LOCATION,
                        "Couldn't get your location"
                    ),
                    type = AuthToastType.Error
                )
            )
        }
    }

    fun fetchCountries() {
        if (_state.value.countries.isNotEmpty()) return
        scope.launch {
            phoneAuth.getAllCountries().collect { result ->
                when (result) {
                    is ApiResult.Success -> {
                        _state.update { it.copy(countries = result.data) }
                        // Preselect persisted or detected country.
                        val savedCode = prefs.getString(
                            SdkPreferences.Keys.GET_USER_SELECTED_COUNTRY_PHONE_CODE, ""
                        )
                        val pending = pendingAutoIso
                        pendingAutoIso = null
                        when {
                            pending != null -> applyIso(pending)
                            savedCode.isNotBlank() ->
                                result.data.firstOrNull { it.phone_country_code == savedCode }
                                    ?.let { country ->
                                        _state.update {
                                            it.copy(
                                                selectedCountry = country,
                                                countryCode = country.phone_country_code
                                            )
                                        }
                                        refreshOtpModeForCountry(country.phone_country_code)
                                    }
                            else -> {
                                val current = _state.value.countryCode
                                result.data.firstOrNull { it.phone_country_code == current }
                                    ?.let { country ->
                                        _state.update { it.copy(selectedCountry = country) }
                                    }
                                refreshOtpModeForCountry(current)
                            }
                        }
                    }
                    is ApiResult.Error -> {
                        _state.update {
                            it.copy(
                                toast = AuthToast(
                                    message = result.message ?: "",
                                    type = AuthToastType.Error
                                )
                            )
                        }
                    }
                }
            }
        }
    }

    /** Endpoint #20: which OTP channels (SMS / WhatsApp) are enabled for the country. */
    fun refreshOtpModeForCountry(phoneCountryCode: String) {
        scope.launch {
            phoneAuth.getOtpMode(phoneCountryCode).collect { result ->
                when (result) {
                    is ApiResult.Success -> {
                        val item = result.data.firstOrNull()
                        _state.update {
                            it.copy(
                                availableChannels = AvailableChannels(
                                    smsEnabled = item?.sms_enabled ?: true,
                                    whatsappEnabled = item?.whatsapp_enabled ?: true
                                )
                            )
                        }
                    }
                    is ApiResult.Error -> {
                        // Conservative default: both channels available.
                        _state.update { it.copy(availableChannels = AvailableChannels()) }
                    }
                }
            }
        }
    }

    // ------------------------------------------------------------------ phone / otp input

    /**
     * Digits only, hard-capped at the selected country's `phone_length` (15 when no
     * country is selected) — 1:1 with the app's `setPhoneLocal`
     * (ui/auth/AuthViewModel.kt:135). The cap is what physically stops the user from
     * typing an over-long number.
     */
    fun setPhoneLocal(phone: String) {
        val maxLen = _state.value.selectedCountry?.phone_length?.takeIf { it > 0 } ?: 15
        val digits = phone.filter { it.isDigit() }.take(maxLen)
        _state.update { it.copy(phoneLocal = digits, phoneError = null) }
    }

    /**
     * Digits only. `otpError` is deliberately STICKY — the app keeps the OTP boxes red
     * after a failed attempt until the user explicitly retries verification
     * (ui/auth/AuthViewModel.kt:144 `otpError = it.otpError`).
     */
    fun setOtp(otp: String) {
        val digits = otp.filter { it.isDigit() }.take(OTP_LENGTH)
        _state.update { it.copy(otp = digits, otpError = it.otpError) }
    }

    /**
     * 1:1 port of the app's `isPhoneValid` (ui/auth/AuthViewModel.kt:861).
     *
     * Order matters: the Ethiopia special case short-circuits, then the country
     * `phone_length` is a hard gate, then `phone_number_pattern` is a hard gate, and
     * finally an unknown country falls back to a plausible 6..15 digits.
     *
     * The app additionally runs Google libphonenumber as a safety net but explicitly
     * does NOT hard-fail when the library is absent (`libOk == false` only). The SDK
     * ships no libphonenumber dependency, so that branch is the app's own
     * library-absent path — recorded in docs/04.
     */
    fun isPhoneValid(): Boolean = _state.value.let {
        isPhoneValid(it.countryCode, it.phoneLocal, it.selectedCountry)
    }

    fun consumeToast() {
        _state.update { it.copy(toast = null) }
    }

    // ------------------------------------------------------------------ send / verify

    /** @param channel "whatsapp" or "sms" */
    fun sendOtp(channel: String, isResend: Boolean = false) {
        if (!isPhoneValid()) {
            _state.update {
                it.copy(
                    phoneError = labelManager.getLabel(
                        Labels.PLEASE_ENTER_A_VALID_NUMBER,
                        "Please enter a valid number..."
                    )
                )
            }
            return
        }
        val s = _state.value
        _state.update { it.copy(sendOtpState = UiState.Loading, selectedChannel = channel) }
        // App AuthScreen.kt:161/178 (send, Login Screen) and :198 (resend, Verify OTP Screen).
        // The key is `channel`, NOT `type`.
        analytics.track(
            if (isResend) AnalyticsEvents.RESEND_OTP_CLICK_EVENT else AnalyticsEvents.SEND_OTP_CLICK_EVENT,
            mapOf(
                AnalyticsProps.SCREEN_NAME to
                    if (isResend) AnalyticsScreens.VERIFY_OTP else AnalyticsScreens.AUTH,
                AnalyticsProps.CHANNEL to channel
            )
        )
        scope.launch {
            phoneAuth.sendOtp(
                SendOtpRequest(
                    phone = s.phoneLocal,
                    phone_country_code = s.countryCode,
                    channel = listOf(channel),
                    device_id = sessionManager.deviceId(),
                    user_id = sessionManager.currentUserId()
                )
            ).collect { result ->
                when (result) {
                    is ApiResult.Success -> {
                        _state.update {
                            it.copy(
                                sendOtpState = UiState.Success(Unit),
                                step = AuthStep.OtpEntry,
                                otp = "",
                                otpError = null,
                                otpAttempts = 0
                            )
                        }
                    }
                    is ApiResult.Error -> {
                        _state.update {
                            it.copy(
                                sendOtpState = result.toUiError(),
                                toast = AuthToast(
                                    message = result.message ?: "",
                                    type = AuthToastType.Error
                                )
                            )
                        }
                    }
                }
            }
        }
    }

    fun verifyOtp() {
        val s = _state.value
        if (s.otp.length != OTP_LENGTH) {
            _state.update {
                it.copy(
                    otpError = labelManager.getLabel(
                        Labels.PLEASE_ENTER_A_VALID_OTP,
                        "Please enter a valid OTP"
                    )
                )
            }
            return
        }
        if (s.verifyOtpState is UiState.Loading) return
        _state.update { it.copy(verifyOtpState = UiState.Loading) }
        scope.launch {
            phoneAuth.verifyOtp(
                VerifyOtpRequest(
                    otp = s.otp,
                    phone = s.phoneLocal,
                    phone_country_code = s.countryCode,
                    guest_onboarding = "True",
                    user_id = sessionManager.currentUserId()
                )
            ).collect { result ->
                when (result) {
                    is ApiResult.Success -> {
                        val data = result.data
                        val e164 = "${s.countryCode}${s.phoneLocal}"
                        sessionManager.onOtpVerified(data, e164)
                        // Re-identify on the verified user's id, which replaces the guest id.
                        // Identity is not an event, so it leaves through config.onUserIdentified.
                        // App AuthViewModel.kt:652 passes `data.id ?: ""` and
                        // AnalyticsUserIdentityManager then falls back to PREF_USER_ID on an
                        // empty id — so guard blank/"null" here, not just null, or the fallback
                        // is dead in exactly the case it exists for.
                        analytics.identifyUser(
                            data.id?.takeIf {
                                it.isNotBlank() && !it.equals("null", ignoreCase = true)
                            } ?: sessionManager.currentUserId()
                        )
                        val existing = data.existing_user == true
                        // App AuthViewModel.kt:724 — Submit_OTP carries only
                        // `verification_status` + `error_message` (no screen_name).
                        analytics.track(
                            AnalyticsEvents.SUBMIT_OTP,
                            mapOf(
                                AnalyticsProps.VERIFICATION_STATUS to "Success",
                                AnalyticsProps.ERROR_MESSAGE to ""
                            )
                        )
                        // App AuthViewModel.kt:635 — Login_Completed fires for ALL users and
                        // carries `is_new_user` (as a String) rather than splitting into a
                        // separate registration event.
                        analytics.track(
                            AnalyticsEvents.LOGIN_COMPLETED,
                            mapOf(
                                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.VERIFY_OTP,
                                AnalyticsProps.USER_ID to
                                    (data.id ?: prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "")),
                                AnalyticsProps.IS_NEW_USER to (data.existing_user == false).toString()
                            )
                        )
                        // SDK-only extra (the name is declared in the app's constants but the app
                        // has no live call site) — see docs/04-parity-matrix.md.
                        if (!existing) analytics.track(AnalyticsEvents.REGISTRATION_COMPLETED)
                        _state.update {
                            it.copy(
                                verifyOtpState = UiState.Success(Unit),
                                existingUser = existing
                            )
                        }
                    }
                    is ApiResult.Error -> {
                        val attempts = s.otpAttempts + 1
                        val failMessage = result.message ?: ""
                        // App AuthViewModel.kt:798.
                        analytics.track(
                            AnalyticsEvents.SUBMIT_OTP,
                            mapOf(
                                AnalyticsProps.VERIFICATION_STATUS to "Failure",
                                AnalyticsProps.ERROR_MESSAGE to failMessage,
                                AnalyticsProps.ATTEMPT_NUMBER to attempts.toString()
                            )
                        )
                        // App AuthViewModel.kt:479/494 — `lockout_type` is "rate_limit" on a 429
                        // or a "Maximum OTP attempts" message, else "device_limit".
                        if (attempts >= s.maxOtpAttempts ||
                            result.code == 429 ||
                            failMessage.contains("Maximum OTP attempts", ignoreCase = true) ||
                            failMessage.contains("Maximum phone numbers", ignoreCase = true) ||
                            failMessage.contains("device limit", ignoreCase = true)
                        ) {
                            val lockoutType =
                                if (result.code == 429 ||
                                    failMessage.contains("Maximum OTP attempts", ignoreCase = true)
                                ) "rate_limit" else "device_limit"
                            analytics.track(
                                AnalyticsEvents.OTP_LOCKOUT_REACHED,
                                mapOf(
                                    AnalyticsProps.SCREEN_NAME to AnalyticsScreens.AUTH,
                                    AnalyticsProps.LOCKOUT_TYPE to lockoutType,
                                    AnalyticsProps.ERROR_MESSAGE to failMessage,
                                    AnalyticsProps.CHANNEL to (s.selectedChannel ?: "")
                                )
                            )
                        }
                        _state.update {
                            it.copy(
                                verifyOtpState = result.toUiError(),
                                otpAttempts = attempts,
                                otpError = result.message
                                    ?: labelManager.getLabel(
                                        Labels.PLEASE_CHECK_TRY_AGAIN,
                                        "Please check and try again."
                                    )
                            )
                        }
                    }
                }
            }
        }
    }

    /** Back to phone entry, clearing OTP state ("Start over"). */
    fun startOver() {
        // App AuthScreen.kt:213 — Verify OTP Screen.
        analytics.track(
            AnalyticsEvents.START_OVER_CLICKED,
            mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.VERIFY_OTP)
        )
        _state.update {
            it.copy(
                step = AuthStep.PhoneEntry,
                otp = "",
                otpError = null,
                otpAttempts = 0,
                sendOtpState = UiState.Idle,
                verifyOtpState = UiState.Idle
            )
        }
    }

    fun fetchLegalLinks() {
        if (_state.value.legalLinks != null) return
        scope.launch {
            legalLinksUseCase.fetchPrivacyPolicy().collect { result ->
                if (result is ApiResult.Success) {
                    _state.update { it.copy(legalLinks = result.data) }
                }
            }
        }
    }
}
