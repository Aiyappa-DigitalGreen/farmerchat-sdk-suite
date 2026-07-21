package org.digitalgreen.farmerchat.sdk.core.ui.auth

import org.digitalgreen.farmerchat.sdk.core.base.UiState
import org.digitalgreen.farmerchat.sdk.core.model.CountryItem
import org.digitalgreen.farmerchat.sdk.core.model.LegalLinks

/** 1:1 port of the app's auth UI state types (AuthViewModel.kt). */

enum class AuthToastType { Success, Error }

data class AuthToast(
    val message: String,
    val type: AuthToastType
)

enum class AuthStep { PhoneEntry, OtpEntry }

data class AvailableChannels(
    val smsEnabled: Boolean = true,
    val whatsappEnabled: Boolean = true
)

data class AuthUiState(
    val step: AuthStep = AuthStep.PhoneEntry,
    val countryCode: String = "+91",
    val selectedCountry: CountryItem? = null,
    val countries: List<CountryItem> = emptyList(),
    val phoneLocal: String = "",
    val otp: String = "",
    val availableChannels: AvailableChannels = AvailableChannels(),
    /** "sms" | "whatsapp" */
    val selectedChannel: String? = null,
    val sendOtpState: UiState<Unit> = UiState.Idle,
    val verifyOtpState: UiState<Unit> = UiState.Idle,
    val legalLinks: LegalLinks? = null,
    val existingUser: Boolean? = null,
    val phoneError: String? = null,
    val otpError: String? = null,
    val toast: AuthToast? = null,
    val otpAttempts: Int = 0,
    val maxOtpAttempts: Int = 3
)
