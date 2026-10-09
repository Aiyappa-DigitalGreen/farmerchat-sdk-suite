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
        // STAGE base URL switched to the agentic demo backend (requested 2026-09-08); applies
        // to debug and release alike. Previous host kept commented for a one-line revert.
        //   case .stage: return URL(string: "https://farmerchat.farmstack.co/mobile-app-stage/")!
        case .stage: return URL(string: "https://demo.agent.farmer.chat/")!
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

/// Journey scope (docs/07 C3). `chatOnly` (default) = skip onboarding/home, land
/// directly in chat. `fullJourney` = onboarding + home + chat (opt in).
public enum FarmerChatMode: String, Sendable {
    case fullJourney
    case chatOnly
}

/// Async token supplier for `authMode == .hostToken`: called at init (if no
/// `accessToken` was given) and again on a 401 to obtain a fresh token.
public typealias FarmerChatTokenProvider = @Sendable () async -> String?

/// SDK configuration. See `docs/03-sdk-architecture.md`.
public struct FarmerChatConfig: Sendable {
    /// Built-in FarmerChat `API-Key` (guest init + `send_tokens`); overridable via
    /// `farmerChatApiKey` (parity with Android `ApiConstants.DEFAULT_GUEST_USER_API_KEY`).
    static let defaultFarmerChatApiKey = "Y2K3kW5R9uQ0fL2X8zI7hT3aJ7"

    /// Built-in Google Geolocation key; overridable via `geoApiKey`
    /// (parity with Android `ApiConstants.DEFAULT_GEO_API_KEY`).
    static let defaultGeoApiKey = "AIzaSyBr13y53dIh6Pf6G0R6y_870o_x9d-jCSo"

    /// The FarmerChat API key actually sent: the host override, else the built-in default.
    var resolvedFarmerChatApiKey: String {
        farmerChatApiKey?.nonBlank ?? Self.defaultFarmerChatApiKey
    }

    /// The geolocation key actually used: the host override, else the built-in default.
    var resolvedGeoApiKey: String {
        geoApiKey?.nonBlank ?? Self.defaultGeoApiKey
    }

    /// The base URL actually used: `customBaseURL` when set (non-empty & valid), else `environment`'s.
    var resolvedBaseURL: URL {
        if let custom = customBaseURL, !custom.isEmpty, let url = URL(string: custom) {
            return url
        }
        return environment.baseURL
    }

    /// LAST RESORT country for endpoint #2 — used ONLY when the server returned no `country_code`,
    /// none is persisted, the host configured none, AND the device locale carries no region.
    ///
    /// The endpoint 400s on a blank value (verified live 2026-09-03: `country_code=` →
    /// `{"error": "Country code is required"}`), so *something* non-blank must be sent. The app
    /// does the same thing on its primary guest-init path, where the literal is `"KE"`. `"KE"`
    /// also matches the live data: dev, stage, prod and eks all return Kenya only (verified live
    /// 2026-09-03).
    ///
    /// This is a floor, not a default. The normal answer comes from the device locale via
    /// `CountryLatLngProvider` — see `resolvedFallbackCountryCode`.
    public static let lastResortCountryCode = "KE"

    /// No default state is invented.
    ///
    /// Endpoint #2's `state` is inert on every environment — dev, stage, prod and eks all return
    /// the identical set for `state=Karnataka`, `state=KA`, `state=` and the parameter omitted
    /// (verified live 2026-09-03). An earlier build shipped `"Karnataka"` as a default, which is
    /// both unfaithful to the app and wrong for a Kenya-only backend.
    public static let defaultStateCodeUnset = ""

    /// Sentinel meaning "no coordinates configured — derive them from the device locale".
    ///
    /// The app has NO hardcoded coordinates: on IP-geolocation failure it calls
    /// `CountryLatLngProvider.getLatLngFromDeviceLocale(context)` and uses that country's
    /// centroid, accepting it only when `lat != 0.0 && lng != 0.0`. An earlier build of this SDK
    /// shipped Bengaluru (12.9716, 77.5946) as a hardcoded default, which sent every unplaceable
    /// guest advice for Karnataka regardless of where they actually are.
    ///
    /// Endpoint #12 (home feed) is gated on the backend having resolved a location, and it
    /// resolves one ONLY from coordinates — a country name alone is rejected (verified live
    /// 2026-09-01) — which is why coordinates are needed at all.
    public static let coordinateUnset = 0.0

    /// The country actually sent when neither the server nor the preferences supplied one:
    /// the host's explicit config, else the DEVICE LOCALE's region, else `lastResortCountryCode`.
    ///
    /// Single source for both onboarding and the settings language chooser so the two cannot drift.
    public var resolvedFallbackCountryCode: String {
        defaultCountryCode.nonBlank
            ?? CountryLatLngProvider.fromDeviceLocale().countryCode.nonBlank
            ?? Self.lastResortCountryCode
    }

    /// The coordinates to use when neither guest init nor GPS resolved a location: the host's
    /// explicit config override, else the DEVICE LOCALE's country centroid — the app's own
    /// fallback. Returns (0.0, 0.0) when neither is available, which callers MUST treat as
    /// "no location"; see `CountryLatLngProvider.isResolved`.
    ///
    /// There is deliberately NO hardcoded city here.
    var resolvedFallbackCoordinates: (lat: Double, lng: Double) {
        if CountryLatLngProvider.isResolved(lat: defaultLatitude, lng: defaultLongitude) {
            return (defaultLatitude, defaultLongitude)
        }
        let locale = CountryLatLngProvider.fromDeviceLocale()
        return (locale.lat, locale.lng)
    }

    public var environment: FarmerChatEnvironment
    /// Optional custom base URL. When set (non-empty) it OVERRIDES `environment`'s
    /// base URL for the API + token clients — lets a host point the SDK at its own
    /// backend (and lets samples target a local mock). Should end with `/`.
    public var customBaseURL: String?
    /// OPTIONAL override for the Google Geolocation API key. The SDK ships a built-in key and
    /// uses it when this is nil or blank, so hosts do not need to supply one.
    public var geoApiKey: String?
    /// OPTIONAL override for the FarmerChat API key sent as the `API-Key` header on
    /// `initialize_user` and `send_tokens`. The SDK ships a built-in key and uses it when this
    /// is nil or blank, so hosts do not need to supply one.
    public var farmerChatApiKey: String?
    public var appearance: FarmerChatAppearance
    /// Optional host theme (docs/07 Part B). Nil = built-in green brand.
    public var theme: FarmerChatTheme?
    /// Preselect a language; skips the language screen when it resolves to a
    /// supported language.
    public var languageCode: String?
    /// OPTIONAL override for the country used in the language list when `initialize_user` returns
    /// a null/blank `country_code` (the normal case for a fresh guest on an IP the backend cannot
    /// resolve — verified live 2026-09-03 on prod).
    ///
    /// **Leave this empty (the default) and the SDK derives the country from the device locale**,
    /// exactly as the app does. Endpoint #2 rejects a blank `country_code` with HTTP 400, so if
    /// the locale carries no region either, `lastResortCountryCode` is sent.
    ///
    /// Set it only to pin the SDK to one region regardless of where the device is.
    public var defaultCountryCode: String
    /// OPTIONAL `state` query param for endpoint #2. Empty by default and safe to leave empty:
    /// the parameter is inert on every environment (verified live 2026-09-03).
    public var defaultStateCode: String
    /// OPTIONAL override for the coordinates posted to endpoint #11 when nothing else resolved a
    /// location. **Leave these at `coordinateUnset` (the default) and the SDK uses the device
    /// locale's country centroid**, exactly as the app does on IP-geolocation failure.
    ///
    /// If both these and the device locale are unset, NO coordinates are sent — a guess would put
    /// the farmer's advice in the wrong place. Set them to pin a region deliberately.
    public var defaultLatitude: Double
    public var defaultLongitude: Double
    public var enableVoice: Bool
    public var enableImages: Bool
    public var enableWeather: Bool
    /// Opt in to agentic streaming chat (SDK 2.0.0, endpoint #27a).
    ///
    /// Default **false**: on 2.0.0 artifacts a host that does nothing keeps the 1.0.0 synchronous
    /// chat contract (#27) unchanged. When true, text queries stream — the answer accretes from
    /// `text_delta` events and tool progress is surfaced as it happens.
    ///
    /// See `versions/v2/README.md`. Note the wire framing is not yet confirmed against a real
    /// stream (docs/05-open-questions.md), so treat this as preview until it is.
    public var enableAgenticChat: Bool

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
    /// Journey scope. Default **`.chatOnly`**: the SDK lands directly in a fresh chat (guest
    /// init + new conversation + labels run headlessly). Pass `.fullJourney` for onboarding +
    /// Home + drawer.
    public var mode: FarmerChatMode
    public var showSettings: Bool
    /// History entry point. Default true: in the drawer (full journey) or, when the drawer is
    /// off, as an icon in the chat app bar.
    public var showHistory: Bool
    /// The host's explicit `showDrawer`, or nil when it did not set one.
    private var showDrawerOverride: Bool?
    /// Navigation drawer. Unset by default, in which case it resolves to `mode == .fullJourney`
    /// (no drawer in chat-only; the chat app bar then carries the history and language icons).
    /// An explicit host value always wins.
    public var showDrawer: Bool {
        get { showDrawerOverride ?? (mode == .fullJourney) }
        set { showDrawerOverride = newValue }
    }
    /// Mirrors the app's `show_name_screen` RemoteConfig flag and Android's
    /// `FarmerChatConfig.showNameScreen`. When false the Enter-Name step is skipped and the
    /// profile is marked done, so the farmer goes straight past it. Added 2026-09-16 — iOS,
    /// react-native and web had no equivalent, so hosts could suppress the step on Android only
    /// (docs/04 "Config-parity audit").
    public var showNameScreen: Bool
    /// Telemetry master switch, default **false** — matches android's
    /// `FarmerChatConfig.enableAnalytics`. Until 2026-09-16 iOS emitted every event to a host's
    /// `onEvent` unconditionally while android dropped them, so the same host code saw different
    /// behaviour per platform (docs/04 "Config-parity audit").
    public var enableAnalytics: Bool
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
        farmerChatApiKey: String? = nil,
        appearance: FarmerChatAppearance = .auto,
        theme: FarmerChatTheme? = nil,
        languageCode: String? = nil,
        defaultCountryCode: String = "",
        defaultStateCode: String = FarmerChatConfig.defaultStateCodeUnset,
        defaultLatitude: Double = FarmerChatConfig.coordinateUnset,
        defaultLongitude: Double = FarmerChatConfig.coordinateUnset,
        enableVoice: Bool = true,
        enableImages: Bool = true,
        enableWeather: Bool = true,
        enableAgenticChat: Bool = false,
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
        mode: FarmerChatMode = .chatOnly,
        showSettings: Bool = true,
        showHistory: Bool = true,
        showDrawer: Bool? = nil,
        showNameScreen: Bool = true,
        enableAnalytics: Bool = false,
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
        self.farmerChatApiKey = farmerChatApiKey
        self.appearance = appearance
        self.theme = theme
        self.languageCode = languageCode
        // NO coercion: empty means "unset — derive from the device locale", not "substitute a
        // hardcoded region". A host that passes a value explicitly still wins.
        self.defaultCountryCode = defaultCountryCode
        self.defaultStateCode = defaultStateCode
        self.defaultLatitude = defaultLatitude
        self.defaultLongitude = defaultLongitude
        self.enableVoice = enableVoice
        self.enableImages = enableImages
        self.enableWeather = enableWeather
        self.enableAgenticChat = enableAgenticChat
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
        self.showDrawerOverride = showDrawer
        self.showNameScreen = showNameScreen
        self.enableAnalytics = enableAnalytics
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
