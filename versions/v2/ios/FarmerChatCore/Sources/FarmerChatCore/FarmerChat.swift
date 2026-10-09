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

        // Env-scoped cache invalidation: a conversation id is only valid on the
        // backend that created it — drop the stored id if the base URL changed
        // since last init (else the answer endpoint 500s on a stale/foreign id).
        let currentBase = config.resolvedBaseURL.absoluteString
        // FarmerChatGraph.kt parity: tokens, user id, labels and conversation all belong to the
        // backend that issued them. On a base-URL change wipe them (keeping appearance), or the new
        // backend 401s the foreign token and the guest fallback (send_tokens with the foreign
        // user_id) 400s, so the SDK can never recover.
        if let last = prefs.string(.lastBaseURL), !last.isEmpty, last != currentBase {
            prefs.clearAll(preservingAppearance: true)
        }
        prefs.setString(currentBase, .lastBaseURL)

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
            onChatOpened: config.onChatOpened,
            enabled: config.enableAnalytics
        )

        // docs/02 Step 3 "guest replaced" signal: built before the refresher (which fires it)
        // and handed to the SessionManager (which exposes it to the view models).
        let guestReplaced = PassthroughSubject<Void, Never>()
        let refresher = TokenRefresher(
            tokenStore: tokenStore,
            baseURL: config.resolvedBaseURL,
            farmerChatApiKey: config.resolvedFarmerChatApiKey,
            deviceInfo: deviceInfo,
            authMode: config.authMode,
            tokenProvider: config.tokenProvider,
            onSessionExpired: config.onSessionExpired,
            prefs: prefs,
            // The SAME fallback onboarding uses when IP geolocation fails.
            fallbackCoordinates: { [config] in config.resolvedFallbackCoordinates },
            onGuestReplaced: { DispatchQueue.main.async { guestReplaced.send() } }
        )
        let client = APIClient(
            baseURL: config.resolvedBaseURL,
            tokenStore: tokenStore,
            refresher: refresher,
            deviceInfo: deviceInfo
        )
        self.api = FarmerChatAPI(client: client, farmerChatApiKey: config.resolvedFarmerChatApiKey, geoApiKey: config.resolvedGeoApiKey)
        self.session = SessionManager(tokenStore: tokenStore, prefs: prefs, api: api, analytics: analytics, guestReplaced: guestReplaced)

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

    // MARK: - CHAT_ONLY headless bootstrap

    /// Set when the language list 404s in this process: a backend without endpoint #2 (a host's
    /// own server) would otherwise pay P2 retries on every chat open for an English fallback.
    private let bootstrapLock = NSLock()
    private var _labelBootstrapUnavailable = false
    private var labelBootstrapUnavailable: Bool {
        get { bootstrapLock.lock(); defer { bootstrapLock.unlock() }; return _labelBootstrapUnavailable }
        set { bootstrapLock.lock(); _labelBootstrapUnavailable = newValue; bootstrapLock.unlock() }
    }

    /// A CHAT_ONLY journey opening fresh is the app's "Home entry", and the app starts a NEW
    /// conversation on every Home entry. Port of Android `FarmerChatGraph.beginChatOnlyJourney`:
    /// drop the stored conversation id so the first send creates a new one (#15), unless the
    /// journey is opening a specific history thread (`openChat(conversationId:)`), which keeps
    /// its own id. Call once per journey start (the splash), before routing consumes the target.
    public func beginChatOnlyJourney() {
        Self.beginChatOnlyJourney(prefs: prefs, pendingTarget: pendingChatTarget.value)
    }

    static func beginChatOnlyJourney(prefs: PreferenceStore, pendingTarget: PendingChatTarget?) {
        if pendingTarget?.conversationId?.nonBlank == nil {
            prefs.remove(.newConversationId)
        }
    }

    /// CHAT_ONLY bootstrap — port of Android `FarmerChatGraph.ensureChatOnlySession()` /
    /// `ensureLabelsLoaded()`. CHAT_ONLY skips onboarding, which is the only other caller of
    /// #3 `get_labels` and #6 `set_preferred_language`; without this the chat renders hardcoded
    /// English fallbacks and the backend never learns the language.
    ///
    /// Runs: guest init (#1, idempotent) → #2 languages → resolve the stored/configured code
    /// (else `en`) → #3 labels → #6 preferred language. The conversation (#15) is created by
    /// `ChatViewModel` on first send. Best-effort and idempotent: no-ops once server labels
    /// exist, and any failure leaves the English fallbacks in place.
    public func ensureChatOnlyBootstrap() async {
        if session.userId == nil {
            _ = await session.ensureGuestSession()
        }
        if labels.hasServerLabels || labelBootstrapUnavailable { return }

        let code = (prefs.string(.selectedLanguageCode)?.nonBlank
            ?? config.locale?.nonBlank
            ?? config.languageCode?.nonBlank
            ?? "en").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let country = prefs.string(.userCountryCode)?.nonBlank ?? config.resolvedFallbackCountryCode
        let regionState = prefs.string(.userState)?.nonBlank ?? config.defaultStateCode

        let groups: [SupportedLanguageGroup]
        switch await api.countryWiseSupportedLanguages(countryCode: country, state: regionState) {
        case .success(let value):
            groups = value
        case .error(let error):
            // 404 = this backend has no such endpoint; offline/5xx may succeed next open.
            if error.code == 404 { labelBootstrapUnavailable = true }
            return
        }
        let all = groups.flatMap { ($0.priorityView ?? []) + ($0.expandedView ?? []) }
        guard let match = all.first(where: { $0.code?.lowercased() == code })
            ?? all.first(where: { $0.code?.lowercased() == "en" }) else { return }

        if case .success(let map) = await api.getLabels(languageId: match.id) {
            prefs.setInt(match.id, .selectedLanguageId)
            if let matchCode = match.code { prefs.setString(matchCode, .selectedLanguageCode) }
            if let display = match.displayName?.nonBlank {
                prefs.setString(display, .selectedLanguageDisplayName)
            }
            // Same as onboarding's selection: the language's streaming_required (default true).
            prefs.setBool(match.streamingRequired ?? true, .streamingRequired)
            labels.update(labels: map)
        }

        if let userId = session.userId?.nonBlank {
            _ = await api.setPreferredLanguage(SetPreferredLanguageRequest(userId: userId, languageId: match.id))
        }
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
