import Foundation
import Combine

/// SDK entry singleton — the shared public surface (doc 03):
///
/// ```swift
/// FarmerChat.initialize(config: FarmerChatConfig(environment: .prod))
/// FarmerChat.shared.openChat(question: "…")
/// FarmerChat.shared.logout()
/// FarmerChat.shared.isAuthenticated
/// FarmerChat.shared.setAnalyticsListener { name, props in … }
/// ```
///
/// UI entry points live in the UI packages
/// (`FarmerChatView()` in FarmerChatSwiftUI, `FarmerChatViewController` in
/// FarmerChatUIKit); both read this environment.
public final class FarmerChat: @unchecked Sendable {
    private static let lock = NSLock()
    private static var _shared: FarmerChat?

    public static var shared: FarmerChat {
        lock.lock()
        defer { lock.unlock() }
        guard let instance = _shared else {
            fatalError("FarmerChat.initialize(config:) must be called before FarmerChat.shared")
        }
        return instance
    }

    public static var isInitialized: Bool {
        lock.lock()
        defer { lock.unlock() }
        return _shared != nil
    }

    /// Initializes (or re-initializes) the SDK environment.
    @discardableResult
    public static func initialize(config: FarmerChatConfig) -> FarmerChat {
        lock.lock()
        defer { lock.unlock() }
        let instance = FarmerChat(config: config)
        _shared = instance
        return instance
    }

    // MARK: - Environment

    public private(set) var config: FarmerChatConfig
    let tokenStore: KeychainTokenStore
    public let prefs: PreferenceStore
    public let labels: LabelManager
    public let analytics: AnalyticsDispatcher
    public let api: FarmerChatAPI
    public let session: SessionManager
    let deviceInfo: DeviceInfoProvider

    /// One-shot deep-link style entry consumed by the UI router
    /// (`FarmerChat.openChat` equivalent of the app's PendingTarget).
    public struct PendingChatTarget: Sendable, Equatable {
        public var question: String?
        public var conversationId: String?

        public init(question: String? = nil, conversationId: String? = nil) {
            self.question = question
            self.conversationId = conversationId
        }
    }

    public let pendingChatTarget = CurrentValueSubject<PendingChatTarget?, Never>(nil)

    /// Programmatic navigation target (`openScreen`) consumed by the UI router.
    public enum Screen: String, Sendable {
        case home, chatHistory, settings, help, language
    }
    public let pendingScreenTarget = CurrentValueSubject<Screen?, Never>(nil)

    /// Runtime analytics listener; `setAnalyticsListener` may be called any
    /// time after initialize. The dispatcher closure reads through this box.
    private final class ListenerBox: @unchecked Sendable {
        private let lock = NSLock()
        private var _handler: FarmerChatEventHandler?
        var handler: FarmerChatEventHandler? {
            get { lock.lock(); defer { lock.unlock() }; return _handler }
            set { lock.lock(); defer { lock.unlock() }; _handler = newValue }
        }
    }
    private let listenerBox = ListenerBox()

    private init(config: FarmerChatConfig) {
        self.config = config
        let tokenStore = KeychainTokenStore()
        let prefs = PreferenceStore()
        self.tokenStore = tokenStore
        self.prefs = prefs
        self.labels = LabelManager(prefs: prefs)
        self.deviceInfo = DeviceInfoProvider(deviceId: tokenStore.deviceId)

        let box = listenerBox
        let configHandler = config.onEvent
        self.analytics = AnalyticsDispatcher(
            handler: { name, props in
                configHandler?(name, props)
                box.handler?(name, props)
            },
            onScreenView: config.onScreenView,
            onChatOpened: config.onChatOpened
        )

        let refresher = TokenRefresher(
            tokenStore: tokenStore,
            baseURL: config.resolvedBaseURL,
            guestApiKey: config.resolvedGuestApiKey,
            deviceInfo: deviceInfo,
            authMode: config.authMode,
            tokenProvider: config.tokenProvider,
            onSessionExpired: config.onSessionExpired
        )
        let client = APIClient(
            baseURL: config.resolvedBaseURL,
            tokenStore: tokenStore,
            refresher: refresher,
            deviceInfo: deviceInfo
        )
        self.api = FarmerChatAPI(client: client, guestApiKey: config.resolvedGuestApiKey, geoApiKey: config.geoApiKey)
        self.session = SessionManager(tokenStore: tokenStore, prefs: prefs, api: api, analytics: analytics)

        // C5: host string overrides + forced locale.
        self.labels.configure(overrides: config.stringOverrides, forcedLocale: config.locale)
        if let locale = config.locale {
            prefs.setString(locale, .selectedLanguageCode)
        }

        // Config-preselected values.
        if let code = config.languageCode, prefs.string(.selectedLanguageCode) == nil {
            prefs.setString(code, .selectedLanguageCode)
        }
        if prefs.string(.appearanceMode) == nil {
            prefs.setString(config.appearance.rawValue, .appearanceMode)
        }

        // C2: host-token identity injection — seed the token store and treat
        // the user as authenticated, skipping SDK OTP.
        if config.authMode == .hostToken, let access = config.accessToken, !access.isEmpty {
            tokenStore.saveTokens(access: access, refresh: config.refreshToken)
            session.markHostAuthenticated()
        }

        // C4: session start.
        config.onSessionStart?()
    }

    // MARK: - Public surface

    /// Deep-link style entry: makes the running UI (or the next launch)
    /// navigate to Chat with the given question or conversation.
    public func openChat(question: String? = nil, conversationId: String? = nil) {
        pendingChatTarget.send(PendingChatTarget(question: question, conversationId: conversationId))
    }

    /// Marks the current pending target consumed by the router.
    public func consumePendingChatTarget() -> PendingChatTarget? {
        let target = pendingChatTarget.value
        pendingChatTarget.send(nil)
        return target
    }

    // MARK: - C4 programmatic API

    /// Opens Chat and asks `text` (deep-link + auto-send).
    public func sendQuestion(_ text: String) {
        openChat(question: text)
    }

    /// Opens an existing conversation by id.
    public func openConversation(_ id: String) {
        openChat(conversationId: id)
    }

    /// Navigates the running UI to a top-level screen.
    public func openScreen(_ screen: Screen) {
        pendingScreenTarget.send(screen)
    }

    public func consumePendingScreenTarget() -> Screen? {
        let target = pendingScreenTarget.value
        pendingScreenTarget.send(nil)
        return target
    }

    public func logout() async {
        await session.logout()
    }

    /// Push a freshly-refreshed token into the active session (HOST_TOKEN mode).
    /// Call after the host refreshes its own auth so subsequent SDK requests use
    /// the new token — no reconfigure needed. `refresh` nil preserves the stored
    /// refresh token.
    public func updateTokens(access: String, refresh: String? = nil) {
        session.updateTokens(access: access, refresh: refresh)
    }

    public var isAuthenticated: Bool { session.isAuthenticated }

    /// Cold + live auth state (`onAuthStateChanged`).
    public var onAuthStateChanged: AnyPublisher<Bool, Never> {
        session.$isAuthenticated.eraseToAnyPublisher()
    }

    /// Replaces the runtime analytics listener (config.onEvent still fires).
    public func setAnalyticsListener(_ listener: FarmerChatEventHandler?) {
        listenerBox.handler = listener
    }

    /// Appearance override at runtime (persisted like `APPEARANCE_MODE`).
    public func setAppearance(_ appearance: FarmerChatAppearance) {
        prefs.setString(appearance.rawValue, .appearanceMode)
    }

    public var appearance: FarmerChatAppearance {
        FarmerChatAppearance(rawValue: prefs.string(.appearanceMode) ?? "") ?? config.appearance
    }
}
