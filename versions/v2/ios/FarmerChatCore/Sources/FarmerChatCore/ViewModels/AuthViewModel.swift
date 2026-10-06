import Foundation
import Combine

// MARK: - State (port of AuthState / AuthStep / AuthToast / AvailableChannels)

public enum AuthStep: Sendable, Equatable {
    case phoneEntry
    case otpEntry
}

public struct AvailableChannels: Sendable, Equatable {
    public var smsEnabled: Bool
    public var whatsappEnabled: Bool

    public init(smsEnabled: Bool = true, whatsappEnabled: Bool = false) {
        self.smsEnabled = smsEnabled
        self.whatsappEnabled = whatsappEnabled
    }
}

public struct AuthToast: Sendable, Equatable {
    public enum Kind: Sendable { case error, success, info }
    public var kind: Kind
    public var message: String

    public init(kind: Kind, message: String) {
        self.kind = kind
        self.message = message
    }
}

public struct AuthState: Sendable {
    public var step: AuthStep = .phoneEntry
    public var countryCode: String = "+91"
    public var phoneLocal: String = ""
    public var otp: String = ""
    public var phoneError: String?
    public var otpError: String?
    public var sendOtpState: UiState<SendOtpResponse> = .idle
    public var verifyOtpState: UiState<VerifyOtpResponse> = .idle
    public var availableChannels: AvailableChannels = AvailableChannels()
    public var isLoadingChannels: Bool = false
    public var countries: [CountryItem] = []
    public var isLoadingCountries: Bool = false
    public var selectedCountry: CountryItem?
    public var toast: AuthToast?
    public var existingUser: Bool = false
    /// Seconds remaining on the 180 s resend countdown.
    public var otpSecondsRemaining: Int = 0
    /// Channel actually used to send the OTP ("whatsapp"/"sms").
    public var lastChannel: String?

    public init() {}

    public var canResend: Bool { otpSecondsRemaining <= 0 }
}

// MARK: - ViewModel (port of AuthViewModel)

@MainActor
public final class AuthViewModel: ObservableObject {
    public static let otpLength = 4
    public static let otpTimerSeconds = 180

    @Published public private(set) var state = AuthState()

    private let env: FarmerChat
    private var timerTask: Task<Void, Never>?

    public init(env: FarmerChat = .shared) {
        self.env = env
    }

    deinit {
        timerTask?.cancel()
    }

    // MARK: - Country handling

    public func fetchCountries() {
        guard state.countries.isEmpty, !state.isLoadingCountries else { return }
        state.isLoadingCountries = true
        Task {
            let result = await env.api.getAllCountries()
            state.isLoadingCountries = false
            if case .success(let countries) = result {
                state.countries = countries
                autoDetectCountryFromLocation()
            } else if case .error(let error) = result {
                state.toast = AuthToast(
                    kind: .error,
                    message: error.message ?? env.labels.label(FCLabels.somethingWentWrongPleaseTryAgain, fallback: "Something went wrong. Please try again.")
                )
            }
        }
    }

    /// Prefers the saved country (guest init geo), falls back to device region.
    public func autoDetectCountryFromLocation() {
        guard state.selectedCountry == nil, !state.countries.isEmpty else { return }
        let savedCode = env.prefs.string(.userCountryCode)?.uppercased()
        let regionCode = Locale.current.regionCode?.uppercased()
        let match = state.countries.first { $0.code?.uppercased() == savedCode }
            ?? state.countries.first { $0.code?.uppercased() == regionCode }
        if let match {
            selectCountry(match)
        } else {
            refreshOtpModeForCountry()
        }
    }

    public func showLocationDetectionError() {
        state.toast = AuthToast(
            kind: .error,
            message: env.labels.label("country_detect_failed", fallback: "We couldn't detect your country. Please pick it manually.")
        )
    }

    public func selectCountry(_ country: CountryItem) {
        state.selectedCountry = country
        if let phoneCode = country.phoneCountryCode {
            state.countryCode = phoneCode.hasPrefix("+") ? phoneCode : "+\(phoneCode)"
        }
        refreshOtpModeForCountry()
    }

    public func setCountryCode(_ code: String) {
        let trimmed = code.trimmingCharacters(in: .whitespaces)
        let normalized: String
        if trimmed.hasPrefix("+") {
            normalized = trimmed
        } else {
            normalized = "+" + trimmed
        }
        state.countryCode = normalized
        let numericTarget = normalized.replacingOccurrences(of: "+", with: "")
        let match = state.countries.first { country in
            let numeric = country.phoneCountryCode?.replacingOccurrences(of: "+", with: "")
            return numeric == numericTarget
        }
        state.selectedCountry = match
        refreshOtpModeForCountry()
    }

    /// iOS has no SIM-read API; kept for surface parity with the app —
    /// applies a caller-provided country code (e.g. from host context).
    public func setCountryCodeFromSim(_ code: String?) {
        guard let code, !code.isEmpty else { return }
        setCountryCode(code)
    }

    /// Fetches WhatsApp/SMS availability for the selected country (#20).
    public func refreshOtpModeForCountry() {
        let numeric = state.countryCode.replacingOccurrences(of: "+", with: "")
        guard !numeric.isEmpty else { return }
        state.isLoadingChannels = true
        Task {
            let result = await env.api.communicationChannel(phoneCountryCode: numeric)
            state.isLoadingChannels = false
            if case .success(let channels) = result, let first = channels.first {
                state.availableChannels = AvailableChannels(
                    smsEnabled: first.smsEnabled ?? true,
                    whatsappEnabled: first.whatsappEnabled ?? false
                )
            } else {
                state.availableChannels = AvailableChannels(smsEnabled: true, whatsappEnabled: false)
            }
        }
    }

    // MARK: - Phone entry

    public func setPhoneLocal(_ phone: String) {
        state.phoneLocal = String(phone.filter(\.isNumber).prefix(15))
        state.phoneError = nil
    }

    public func isPhoneValid() -> Bool {
        let phone = state.phoneLocal
        guard !phone.isEmpty else { return false }
        if let length = state.selectedCountry?.phoneLength, length > 0 {
            return phone.count == length
        }
        if let pattern = state.selectedCountry?.phoneNumberPattern, !pattern.isEmpty,
           let regex = try? NSRegularExpression(pattern: pattern) {
            let range = NSRange(phone.startIndex..., in: phone)
            return regex.firstMatch(in: phone, range: range) != nil
        }
        return phone.count >= 6 && phone.count <= 15
    }

    // MARK: - OTP send

    public func sendOtp(channel: String) {
        guard isPhoneValid() else {
            state.phoneError = env.labels.label("invalid_phone", fallback: "Please enter a valid phone number.")
            return
        }
        guard !state.sendOtpState.isLoading else { return }
        env.analytics.track(AnalyticsEvents.sendOtpClickEvent, props: ["channel": channel])
        state.sendOtpState = .loading
        state.lastChannel = channel
        let numericCode = state.countryCode.replacingOccurrences(of: "+", with: "")
        let request = SendOtpRequest(
            phone: state.phoneLocal,
            phoneCountryCode: numericCode,
            channel: [channel],
            deviceId: env.session.deviceId,
            userId: env.session.userId
        )
        Task {
            let result = await env.api.generateOtp(request)
            switch result {
            case .success(let response):
                state.sendOtpState = .success(response)
                state.step = .otpEntry
                state.otp = ""
                state.otpError = nil
                startOtpTimer()
                env.analytics.screenViewed(ScreenNames.verifyOtp)
            case .error(let error):
                state.sendOtpState = .error(
                    message: error.message ?? env.labels.label("otp_send_failed", fallback: "Could not send the code. Please try again."),
                    code: error.code,
                    isNetworkError: error.isNetworkError
                )
                state.toast = AuthToast(
                    kind: .error,
                    message: error.message ?? env.labels.label("otp_send_failed", fallback: "Could not send the code. Please try again.")
                )
            }
        }
    }

    // MARK: - OTP verify

    public func setOtp(_ otp: String) {
        state.otp = String(otp.filter(\.isNumber).prefix(Self.otpLength))
        state.otpError = nil
    }

    public func verifyOtp() {
        guard state.otp.count == Self.otpLength else {
            state.otpError = env.labels.label("invalid_otp", fallback: "Please enter the 4-digit code.")
            return
        }
        guard !state.verifyOtpState.isLoading else { return }
        env.analytics.track(AnalyticsEvents.submitOtp)
        state.verifyOtpState = .loading
        let numericCode = state.countryCode.replacingOccurrences(of: "+", with: "")
        let request = VerifyOtpRequest(
            otp: state.otp,
            phone: state.phoneLocal,
            phoneCountryCode: numericCode,
            guestOnboarding: true,
            userId: env.session.userId
        )
        Task {
            let result = await env.api.verifyOtp(request)
            switch result {
            case .success(let response):
                if response.error == true {
                    let message = response.message ?? env.labels.label("otp_incorrect", fallback: "That code doesn't look right. Please try again.")
                    state.verifyOtpState = .error(message: message, code: nil, isNetworkError: false)
                    state.otpError = message
                    return
                }
                state.existingUser = response.existingUser ?? false
                env.session.applyOtpLogin(response: response, phoneE164: phoneE164)
                state.verifyOtpState = .success(response)
            case .error(let error):
                let message = error.message ?? env.labels.label("otp_incorrect", fallback: "That code doesn't look right. Please try again.")
                state.verifyOtpState = .error(message: message, code: error.code, isNetworkError: error.isNetworkError)
                state.otpError = message
            }
        }
    }

    public var phoneE164: String {
        state.countryCode + state.phoneLocal
    }

    // MARK: - Timer (180 s countdown, resend after timeout)

    public func startOtpTimer() {
        timerTask?.cancel()
        state.otpSecondsRemaining = Self.otpTimerSeconds
        timerTask = Task { [weak self] in
            while let self, self.state.otpSecondsRemaining > 0, !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                guard !Task.isCancelled else { return }
                self.state.otpSecondsRemaining -= 1
            }
        }
    }

    public func stopOtpTimer() {
        timerTask?.cancel()
        timerTask = nil
    }

    /// Resend on the same channel after timeout.
    public func resendOtp() {
        guard state.canResend, let channel = state.lastChannel else { return }
        sendOtp(channel: channel)
    }

    /// Back to phone entry, everything reset (Start over).
    public func startOver() {
        stopOtpTimer()
        state.step = .phoneEntry
        state.otp = ""
        state.otpError = nil
        state.otpSecondsRemaining = 0
        state.sendOtpState = .idle
        state.verifyOtpState = .idle
    }

    public func consumeToast() {
        state.toast = nil
    }

    public func trackVerificationStarted() {
        env.analytics.track(AnalyticsEvents.mobileVerificationStarted)
    }
}
