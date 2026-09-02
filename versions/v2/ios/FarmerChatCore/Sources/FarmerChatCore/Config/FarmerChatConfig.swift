import Foundation
import SwiftUI

/// Backend environment. Base URLs match `docs/02-api-reference.md` exactly.
public enum FarmerChatEnvironment: String, CaseIterable, Sendable {
    case dev
    case stage
    case demo
    case prod
    case eks

    public var baseURL: URL {
        switch self {
        case .dev: return URL(string: "https://farmerchat.farmstack.co/mobile-app-dev/")!
        case .stage: return URL(string: "https://farmerchat.farmstack.co/mobile-app-stage/")!
        case .demo: return URL(string: "https://farmerchat.farmstack.co/mobile-app-demo/")!
        case .prod: return URL(string: "https://v2.api.farmer.chat/")!
        case .eks: return URL(string: "https://api.farmerchat.in/")!
        }
    }
}

/// Day / Night / Auto appearance, persisted like the app's `APPEARANCE_MODE` pref.
public enum FarmerChatAppearance: String, CaseIterable, Sendable {
    case day
    case night
    case auto
}

/// Host-pluggable analytics listener. The SDK emits every event the app
/// tracks (same names & props); hosts forward to their own stacks.
public typealias FarmerChatEventHandler = @Sendable (_ name: String, _ props: [String: String]) -> Void

/// Identity injection (docs/07 C2). `sdkOtp` (default) = SDK-owned phone/OTP.
/// `hostToken` = host supplies the auth token; the SDK skips the OTP UI.
public enum FarmerChatAuthMode: String, Sendable {
    case sdkOtp
    case hostToken
}

/// Journey scope (docs/07 C3). `fullJourney` (default) = onboarding + home +
/// chat. `chatOnly` = skip onboarding/home, land directly in chat.
public enum FarmerChatMode: String, Sendable {
    case fullJourney
    case chatOnly
}

/// Async token supplier for `authMode == .hostToken`: called at init (if no
/// `accessToken` was given) and again on a 401 to obtain a fresh token.
public typealias FarmerChatTokenProvider = @Sendable () async -> String?

/// SDK configuration. See `docs/03-sdk-architecture.md`.
public struct FarmerChatConfig: Sendable {
    /// Default guest-init `API-Key`; overridable via `guestApiKey`
    /// (parity with Android `ApiConstants.DEFAULT_GUEST_USER_API_KEY`).
    static let defaultGuestApiKey = "Y2K3kW5R9uQ0fL2X8zI7hT3aJ7"

    /// The key actually sent: the host override, else the built-in default.
    var resolvedGuestApiKey: String {
        guestApiKey?.isEmpty == false ? guestApiKey! : Self.defaultGuestApiKey
    }

    /// The base URL actually used: `customBaseURL` when set (non-empty & valid), else `environment`'s.
    var resolvedBaseURL: URL {
        if let custom = customBaseURL, !custom.isEmpty, let url = URL(string: custom) {
            return url
        }
        return environment.baseURL
    }

    /// Fallback country for endpoint #2 when `initialize_user` returns no `country_code`.
    /// The endpoint 400s on a blank value, so a non-empty default is required.
    public static let defaultCountryCodeFallback = "IN"

    /// Fallback state/region paired with `defaultCountryCodeFallback`.
    ///
    /// Endpoint #2 matches `state` on the **display name**, not the ISO code, and uses it only to
    /// rank languages. Verified live 2026-09-01: `state=Karnataka` surfaces Kannada in
    /// `priority_view`, while `state=KA` pushes it into `expanded_view` ("All languages").
    public static let defaultStateCodeFallback = "Karnataka"

    /// Coordinates representing the fallback region (Bengaluru, Karnataka).
    ///
    /// Endpoint #12 (home feed) is gated on the backend having a resolved location, and it
    /// resolves one ONLY from coordinates — a country name alone is rejected (verified live
    /// 2026-09-01). Seeding #11 with these keeps a guest's home screen populated.
    public static let defaultLatitudeFallback = 12.9716
    public static let defaultLongitudeFallback = 77.5946

    public var environment: FarmerChatEnvironment
    /// Optional custom base URL. When set (non-empty) it OVERRIDES `environment`'s
    /// base URL for the API + token clients — lets a host point the SDK at its own
    /// backend (and lets samples target a local mock). Should end with `/`.
    public var customBaseURL: String?
    /// Google Geolocation API key (language auto-detect fallback). Optional.
    public var geoApiKey: String?
    /// Overrides the built-in guest-init API key sent as `API-Key` header on
    /// `initialize_user` and `send_tokens`.
    public var guestApiKey: String?
    public var appearance: FarmerChatAppearance
    /// Optional host theme (docs/07 Part B). Nil = built-in green brand.
    public var theme: FarmerChatTheme?
    /// Preselect a language; skips the language screen when it resolves to a
    /// supported language.
    public var languageCode: String?
    /// Country code used for the language list when `initialize_user` returns a null/blank
    /// `country_code` (the normal case for a fresh guest on an IP the backend cannot resolve).
    /// Endpoint #2 rejects a blank `country_code` with HTTP 400, so this must never be empty.
    public var defaultCountryCode: String
    /// State/region paired with `defaultCountryCode` for the endpoint #2 `state` query param.
    public var defaultStateCode: String
    /// Coordinates for `defaultCountryCode`/`defaultStateCode`, used to seed endpoint #11 when
    /// nothing else resolved a location so the home feed is never empty.
    public var defaultLatitude: Double
    public var defaultLongitude: Double
    public var enableVoice: Bool
    public var enableImages: Bool
    public var enableWeather: Bool

    // MARK: - FAB customization (config-level defaults; per-instance params win)
    /// Default launcher label; nil = round icon-only FAB (current behavior).
    public var fabLabel: String?
    /// Default launcher background; nil = theme brand.
    public var fabBackgroundColor: Color?
    /// Default launcher icon/text color; nil = on-brand.
    public var fabContentColor: Color?

    // MARK: - Chat UI customization (nil = current theme behavior)
    /// User message bubble background; nil = theme default.
    public var userBubbleColor: Color?
    /// User message bubble text color; nil = theme default.
    public var userBubbleTextColor: Color?
    /// AI message body text color; nil = theme default.
    public var aiBubbleTextColor: Color?
    /// Message bubble corner radius; nil = theme default.
    public var bubbleCornerRadius: CGFloat?
    /// Chat message body font size; nil = theme default.
    public var messageFontSize: CGFloat?

    // MARK: - C2 Identity injection
    public var authMode: FarmerChatAuthMode
    /// Host-supplied access token (used when `authMode == .hostToken`).
    public var accessToken: String?
    /// Optional host refresh token.
    public var refreshToken: String?
    /// Async token supplier; called on 401 (and at init when `accessToken` is nil).
    public var tokenProvider: FarmerChatTokenProvider?

    // MARK: - C3 Screen/feature toggles
    public var mode: FarmerChatMode
    public var showSettings: Bool
    public var showHistory: Bool
    public var showDrawer: Bool
    public var enableSsfr: Bool

    // MARK: - C5 String overrides + forced locale
    /// Host label overrides (highest precedence): `labelKey → String`.
    public var stringOverrides: [String: String]
    /// Force a language code regardless of device/onboarding.
    public var locale: String?

    // MARK: - Analytics + semantic callbacks (C4)
    /// Raw analytics fan-out to the host.
    public var onEvent: FarmerChatEventHandler?
    /// Called when both token refresh and the guest-token fallback fail.
    public var onSessionExpired: (@Sendable () -> Void)?
    public var onChatOpened: (@Sendable () -> Void)?
    public var onMessageSent: (@Sendable (_ text: String) -> Void)?
    public var onAnswerReceived: (@Sendable (_ messageId: String) -> Void)?
    public var onScreenView: (@Sendable (_ name: String) -> Void)?
    public var onError: (@Sendable (_ code: Int?, _ message: String) -> Void)?
    public var onSessionStart: (@Sendable () -> Void)?

    public init(
        environment: FarmerChatEnvironment = .prod,
        customBaseURL: String? = nil,
        geoApiKey: String? = nil,
        guestApiKey: String? = nil,
        appearance: FarmerChatAppearance = .auto,
        theme: FarmerChatTheme? = nil,
        languageCode: String? = nil,
        defaultCountryCode: String = FarmerChatConfig.defaultCountryCodeFallback,
        defaultStateCode: String = FarmerChatConfig.defaultStateCodeFallback,
        defaultLatitude: Double = FarmerChatConfig.defaultLatitudeFallback,
        defaultLongitude: Double = FarmerChatConfig.defaultLongitudeFallback,
        enableVoice: Bool = true,
        enableImages: Bool = true,
        enableWeather: Bool = true,
        fabLabel: String? = nil,
        fabBackgroundColor: Color? = nil,
        fabContentColor: Color? = nil,
        userBubbleColor: Color? = nil,
        userBubbleTextColor: Color? = nil,
        aiBubbleTextColor: Color? = nil,
        bubbleCornerRadius: CGFloat? = nil,
        messageFontSize: CGFloat? = nil,
        authMode: FarmerChatAuthMode = .sdkOtp,
        accessToken: String? = nil,
        refreshToken: String? = nil,
        tokenProvider: FarmerChatTokenProvider? = nil,
        mode: FarmerChatMode = .fullJourney,
        showSettings: Bool = true,
        showHistory: Bool = true,
        showDrawer: Bool = true,
        enableSsfr: Bool = true,
        stringOverrides: [String: String] = [:],
        locale: String? = nil,
        onEvent: FarmerChatEventHandler? = nil,
        onSessionExpired: (@Sendable () -> Void)? = nil,
        onChatOpened: (@Sendable () -> Void)? = nil,
        onMessageSent: (@Sendable (_ text: String) -> Void)? = nil,
        onAnswerReceived: (@Sendable (_ messageId: String) -> Void)? = nil,
        onScreenView: (@Sendable (_ name: String) -> Void)? = nil,
        onError: (@Sendable (_ code: Int?, _ message: String) -> Void)? = nil,
        onSessionStart: (@Sendable () -> Void)? = nil
    ) {
        self.environment = environment
        self.customBaseURL = customBaseURL
        self.geoApiKey = geoApiKey
        self.guestApiKey = guestApiKey
        self.appearance = appearance
        self.theme = theme
        self.languageCode = languageCode
        self.defaultCountryCode = defaultCountryCode.isEmpty
            ? FarmerChatConfig.defaultCountryCodeFallback : defaultCountryCode
        self.defaultStateCode = defaultStateCode.isEmpty
            ? FarmerChatConfig.defaultStateCodeFallback : defaultStateCode
        self.defaultLatitude = defaultLatitude
        self.defaultLongitude = defaultLongitude
        self.enableVoice = enableVoice
        self.enableImages = enableImages
        self.enableWeather = enableWeather
        self.fabLabel = fabLabel
        self.fabBackgroundColor = fabBackgroundColor
        self.fabContentColor = fabContentColor
        self.userBubbleColor = userBubbleColor
        self.userBubbleTextColor = userBubbleTextColor
        self.aiBubbleTextColor = aiBubbleTextColor
        self.bubbleCornerRadius = bubbleCornerRadius
        self.messageFontSize = messageFontSize
        self.authMode = authMode
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.tokenProvider = tokenProvider
        self.mode = mode
        self.showSettings = showSettings
        self.showHistory = showHistory
        self.showDrawer = showDrawer
        self.enableSsfr = enableSsfr
        self.stringOverrides = stringOverrides
        self.locale = locale
        self.onEvent = onEvent
        self.onSessionExpired = onSessionExpired
        self.onChatOpened = onChatOpened
        self.onMessageSent = onMessageSent
        self.onAnswerReceived = onAnswerReceived
        self.onScreenView = onScreenView
        self.onError = onError
        self.onSessionStart = onSessionStart
    }
}
