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
        analytics.track(
            AnalyticsEvents.COUNTRY_SELECTED,
            mapOf(AnalyticsProps.COUNTRY to country.name)
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

    fun setPhoneLocal(phone: String) {
        val digits = phone.filter { it.isDigit() }
        _state.update { it.copy(phoneLocal = digits, phoneError = null) }
    }

    fun setOtp(otp: String) {
        val digits = otp.filter { it.isDigit() }.take(OTP_LENGTH)
        _state.update { it.copy(otp = digits, otpError = null) }
    }

    fun isPhoneValid(): Boolean {
        val s = _state.value
        val phone = s.phoneLocal
        if (phone.isBlank()) return false
        val country = s.selectedCountry ?: return phone.length in 6..15
        val pattern = country.phone_number_pattern
        if (!pattern.isNullOrBlank()) {
            return runCatching { Regex(pattern).matches(phone) }.getOrDefault(
                phone.length == country.phone_length
            )
        }
        return if (country.phone_length > 0) phone.length == country.phone_length
        else phone.length in 6..15
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
                        "Please enter a valid number"
                    )
                )
            }
            return
        }
        val s = _state.value
        _state.update { it.copy(sendOtpState = UiState.Loading, selectedChannel = channel) }
        analytics.track(
            if (isResend) AnalyticsEvents.RESEND_OTP_CLICK_EVENT else AnalyticsEvents.SEND_OTP_CLICK_EVENT,
            mapOf(
                AnalyticsProps.SCREEN_NAME to AnalyticsScreens.AUTH,
                AnalyticsProps.TYPE to channel
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
        analytics.track(
            AnalyticsEvents.SUBMIT_OTP,
            mapOf(AnalyticsProps.SCREEN_NAME to AnalyticsScreens.VERIFY_OTP)
        )
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
                        val existing = data.existing_user == true
                        analytics.track(
                            if (existing) AnalyticsEvents.LOGIN_COMPLETED
                            else AnalyticsEvents.REGISTRATION_COMPLETED
                        )
                        _state.update {
                            it.copy(
                                verifyOtpState = UiState.Success(Unit),
                                existingUser = existing
                            )
                        }
                    }
                    is ApiResult.Error -> {
                        val attempts = s.otpAttempts + 1
                        if (attempts >= s.maxOtpAttempts) {
                            analytics.track(AnalyticsEvents.OTP_LOCKOUT_REACHED)
                        }
                        _state.update {
                            it.copy(
                                verifyOtpState = result.toUiError(),
                                otpAttempts = attempts,
                                otpError = result.message
                                    ?: labelManager.getLabel(
                                        Labels.PLEASE_CHECK_TRY_AGAIN,
                                        "Please check and try again"
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
        analytics.track(AnalyticsEvents.START_OVER_CLICKED)
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
