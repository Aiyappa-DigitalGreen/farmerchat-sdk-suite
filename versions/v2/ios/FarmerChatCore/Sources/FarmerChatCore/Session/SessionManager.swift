import Foundation
import Combine

/// Owns the session lifecycle: guest init → OTP login → logout.
/// The host never touches tokens (SDK-owns-auth principle, doc 03 §2).
public final class SessionManager: ObservableObject, @unchecked Sendable {
    let tokenStore: KeychainTokenStore
    let prefs: PreferenceStore
    private let api: FarmerChatAPI
    private let analytics: AnalyticsDispatcher

    /// True once OTP has been verified (`OTP_VERIFIED`). Guest sessions are
    /// not "authenticated" in the app's sense.
    @Published public private(set) var isAuthenticated: Bool

    init(tokenStore: KeychainTokenStore, prefs: PreferenceStore, api: FarmerChatAPI, analytics: AnalyticsDispatcher) {
        self.tokenStore = tokenStore
        self.prefs = prefs
        self.api = api
        self.analytics = analytics
        self.isAuthenticated = prefs.bool(.otpVerified)
    }

    public var userId: String? { tokenStore.userId }
    public var deviceId: String { tokenStore.deviceId }
    public var hasSession: Bool { !(tokenStore.accessToken ?? "").isEmpty }

    // MARK: - Guest init

    /// Guest init (endpoint #1). Safe to call repeatedly — the server returns
    /// the same guest user per device. Always calls the API (Android
    /// `SessionManager.initializeGuestUser` parity): the server resolves
    /// IP-derived location asynchronously, so repeat calls refresh the stored
    /// country/state hints that the language endpoint requires.
    @discardableResult
    public func ensureGuestSession(lat: Double? = nil, long: Double? = nil, accuracy: Double? = nil) async -> ApiResult<InitializeGuestUserResponse> {
        let request = InitializeGuestUserRequest(
            deviceId: tokenStore.deviceId,
            lat: lat,
            long: long,
            accuracy: accuracy,
            utmSource: prefs.string(.utmSource),
            utmMedium: prefs.string(.utmMedium),
            utmCampaign: prefs.string(.utmCampaign)
        )
        let result = await api.initializeUser(request)
        if case .success(let response) = result {
            tokenStore.saveTokens(access: response.accessToken, refresh: response.refreshToken)
            if let userId = response.userId?.stringValue {
                tokenStore.userId = userId
            }
            if let countryCode = response.countryCode {
                prefs.setString(countryCode, .userCountryCode)
            }
            if let country = response.country {
                prefs.setString(country, .userCountryName)
            }
            if let state = response.state {
                prefs.setString(state, .userState)
            }
        }
        return result
    }

    // MARK: - OTP login

    /// Applies a successful `verify_otp` response: swaps tokens, marks
    /// `OTP_VERIFIED`, stores the phone and preferred language.
    public func applyOtpLogin(response: VerifyOtpResponse, phoneE164: String) {
        tokenStore.saveTokens(access: response.accessToken, refresh: response.refreshToken)
        if let userId = response.userId?.stringValue {
            tokenStore.userId = userId
        }
        prefs.setBool(true, .otpVerified)
        prefs.setString(phoneE164, .phoneNumberLogin)
        prefs.setBool(true, .nameScreenSeen)
        if let language = response.preferredLanguage {
            if let id = language.id?.intValue { prefs.setInt(id, .selectedLanguageId) }
            if let code = language.code { prefs.setString(code, .selectedLanguageCode) }
            if let display = language.displayName { prefs.setString(display, .selectedLanguageDisplayName) }
        }
        DispatchQueue.main.async { [weak self] in
            self?.isAuthenticated = true
        }
        analytics.track(
            response.existingUser == true ? AnalyticsEvents.loginCompleted : AnalyticsEvents.registrationCompleted,
            props: ["phone": phoneE164]
        )
    }

    // MARK: - Logout

    /// `api/user/logout/` + clear all prefs (preserving appearance) + token wipe.
    public func logout() async {
        analytics.track(AnalyticsEvents.logoutClickEvent)
        _ = await api.logout()
        tokenStore.clear()
        prefs.clearAll(preservingAppearance: true)
        DispatchQueue.main.async { [weak self] in
            self?.isAuthenticated = false
        }
    }

    /// C2: marks the session authenticated from a host-supplied token
    /// (`authMode == .hostToken`). Skips the SDK OTP UI and the name step;
    /// language onboarding still applies unless a `locale` is forced.
    public func markHostAuthenticated() {
        prefs.setBool(true, .otpVerified)
        prefs.setBool(true, .nameScreenSeen)
        DispatchQueue.main.async { [weak self] in
            self?.isAuthenticated = true
        }
    }

    /// Push a freshly-refreshed token into the active session at runtime
    /// (HOST_TOKEN mode) — additive to the init-time seed + `tokenProvider`.
    /// `refresh` nil preserves the stored refresh token. Does not alter OTP
    /// auth markers.
    public func updateTokens(access: String, refresh: String? = nil) {
        tokenStore.saveTokens(access: access, refresh: refresh)
    }

    /// Local-only session reset (used when the guest fallback also fails).
    public func expireSession() {
        tokenStore.clear()
        DispatchQueue.main.async { [weak self] in
            self?.isAuthenticated = false
        }
    }
}
