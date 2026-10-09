//
//  FarmerChatObjC.swift
//  FarmerChatUIKit
//
//  The Objective-C channel (PRD "Channels: Mobile SDKs" → "iOS SDK for Objective-C").
//
//  ## Why a facade is required rather than annotations
//
//  `FarmerChatUIKit` is a UIKit SDK, which is NOT the same thing as an Objective-C SDK. Before
//  this file, four separate things made the SDK unreachable from a `.m`:
//
//   1. `FarmerChat` is a `public final class`, not `NSObject`-derived — invisible to Objective-C.
//   2. `FarmerChatConfig` is a `public struct`. **Swift structs cannot be exposed to Objective-C
//      at all**, so the entire configuration surface was unreachable.
//   3. `FarmerChatEnvironment` / `Mode` / `AuthMode` / `Appearance` are `String`-raw-value enums;
//      an `@objc` enum must be `Int`-backed.
//   4. Optional scalars (`bubbleCornerRadius`, `messageFontSize`) and SwiftUI `Color` have no
//      Objective-C representation.
//
//  None of that is fixable by sprinkling `@objc`. This file is the bridge: `NSObject` types with
//  Objective-C-representable members that map onto the Swift API.
//
//  ## Scope
//
//  Mirrors the shared public API named in root `CLAUDE.md` §3 — initialize / launch / openChat /
//  logout / isAuthenticated / onAuthStateChanged, plus the `FarmerChatConfig` fields. It
//  deliberately does NOT expose `prefs`, `labels`, `analytics`, `api` or `session`: Swift-only
//  infrastructure with a large surface and no PRD benefit. Omissions are listed in
//  `docs/04-parity-matrix.md`.
//
//  ## Verification
//
//  `swift build` and `xcodebuild` pass whether or not a symbol is visible to Objective-C, so they
//  cannot prove this file works. `Sources/FarmerChatObjCSmoke/FCObjCSmoke.m` is compiled by clang
//  as Objective-C against the generated interface and exercises every member below — that target
//  is the real assertion, and it fails if any of this stops being `@objc`-exposed.
//

import Foundation
import UIKit
import SwiftUI   // only for `Color`, which FarmerChatConfig uses; the PUBLIC path here is UIColor
import Combine
import FarmerChatCore

// MARK: - Enums (Int-backed; @objc enums cannot carry String raw values)

@objc(FCEnvironment)
public enum FCEnvironment: Int {
    case dev = 0
    case stage = 1
    case demo = 2
    case prod = 3
    case eks = 4

    var swiftValue: FarmerChatEnvironment {
        switch self {
        case .dev: return .dev
        case .stage: return .stage
        case .demo: return .demo
        case .prod: return .prod
        case .eks: return .eks
        }
    }
}

@objc(FCAppearance)
public enum FCAppearance: Int {
    case day = 0
    case night = 1
    case auto = 2

    var swiftValue: FarmerChatAppearance {
        switch self {
        case .day: return .day
        case .night: return .night
        case .auto: return .auto
        }
    }
}

@objc(FCAuthMode)
public enum FCAuthMode: Int {
    case sdkOtp = 0
    case hostToken = 1

    var swiftValue: FarmerChatAuthMode {
        switch self {
        case .sdkOtp: return .sdkOtp
        case .hostToken: return .hostToken
        }
    }
}

@objc(FCMode)
public enum FCMode: Int {
    case fullJourney = 0
    case chatOnly = 1

    var swiftValue: FarmerChatMode {
        switch self {
        case .fullJourney: return .fullJourney
        case .chatOnly: return .chatOnly
        }
    }
}

// MARK: - Configuration

/// Objective-C mirror of `FarmerChatConfig` (which is a struct, and therefore unreachable from
/// Objective-C). Defaults match the Swift type exactly; set only what you need.
///
/// Optional scalars are `NSNumber *` because Objective-C has no optional `CGFloat`. Leaving one
/// nil means "use the SDK default", which is NOT the same as passing 0.
@objc(FCFarmerChatConfiguration)
public final class FCFarmerChatConfiguration: NSObject {

    // --- Environment / networking
    @objc public var environment: FCEnvironment = .prod
    @objc public var customBaseURL: String?
    /// OPTIONAL override; nil/blank = the SDK's built-in Google Geolocation key.
    @objc public var geoApiKey: String?
    /// OPTIONAL override; nil/blank = the SDK's built-in FarmerChat API key (`API-Key` header).
    @objc public var farmerChatApiKey: String?

    // --- Appearance / theming
    @objc public var appearance: FCAppearance = .auto
    /// Individual colour knobs. The full `FarmerChatTheme` struct is NOT bridged — see docs/04.
    @objc public var fabBackgroundColor: UIColor?
    @objc public var fabContentColor: UIColor?
    @objc public var userBubbleColor: UIColor?
    @objc public var userBubbleTextColor: UIColor?
    @objc public var aiBubbleTextColor: UIColor?
    /// `NSNumber *` wrapping a CGFloat; nil = SDK default.
    @objc public var bubbleCornerRadius: NSNumber?
    /// `NSNumber *` wrapping a CGFloat; nil = SDK default.
    @objc public var messageFontSize: NSNumber?
    @objc public var fabLabel: String?

    // --- Locale / geography
    @objc public var languageCode: String?
    @objc public var locale: String?
    @objc public var defaultCountryCode: String = "IN"
    @objc public var defaultStateCode: String = ""
    /// Defaults mirror the Swift type; override together with `defaultLongitude`.
    @objc public var defaultLatitude: Double = 0
    @objc public var defaultLongitude: Double = 0

    // --- Feature flags
    @objc public var enableVoice: Bool = true
    @objc public var enableImages: Bool = true
    @objc public var enableWeather: Bool = true
    @objc public var enableSsfr: Bool = true
    @objc public var enableAgenticChat: Bool = false
    /// Telemetry master switch, default false — matches Android. Events are dropped at the
    /// dispatch point until a host opts in.
    @objc public var enableAnalytics: Bool = false

    // --- Journey scope
    /// Default `FCModeChatOnly` (lands directly in chat; the language screen once on a first
    /// launch when no `languageCode`/`locale` is set); `FCModeFullJourney` opts in to
    /// onboarding + Home + drawer.
    @objc public var mode: FCMode = .chatOnly
    @objc public var showSettings: Bool = true
    /// The host's explicit value, or nil when never set.
    private var showHistoryOverride: Bool?
    /// Unset by default, resolving to `mode == FCModeFullJourney` (no history button in
    /// chat-only). Setting it pins the value.
    @objc public var showHistory: Bool {
        get { showHistoryOverride ?? (mode == .fullJourney) }
        set { showHistoryOverride = newValue }
    }
    /// The host's explicit value, or nil when never set.
    private var showDrawerOverride: Bool?
    /// Unset by default, resolving to `mode == FCModeFullJourney` (no drawer in chat-only, where
    /// the chat bar carries the language icon, plus history when `showHistory` resolves YES).
    /// Setting it pins the value.
    @objc public var showDrawer: Bool {
        get { showDrawerOverride ?? (mode == .fullJourney) }
        set { showDrawerOverride = newValue }
    }
    @objc public var showNameScreen: Bool = true

    // --- Identity
    @objc public var authMode: FCAuthMode = .sdkOtp
    @objc public var accessToken: String?
    @objc public var refreshToken: String?
    /// Objective-C form of the async `tokenProvider`: you are handed a completion block and must
    /// call it with a fresh token (or nil). Called at init when no `accessToken` was supplied, and
    /// again on a 401.
    @objc public var tokenProvider: ((@escaping (String?) -> Void) -> Void)?

    /// Host string overrides. **Keys must be canonical `fc_v2_app_label_*` keys** — use
    /// `FCLabelKeys` rather than typing them, or the override silently never applies.
    @objc public var stringOverrides: [String: String] = [:]

    // --- Callbacks (blocks; the SDK does not retain your host object beyond these)
    @objc public var onEvent: ((String, [String: String]) -> Void)?
    @objc public var onSessionExpired: (() -> Void)?
    @objc public var onChatOpened: (() -> Void)?
    @objc public var onMessageSent: ((String) -> Void)?
    @objc public var onAnswerReceived: ((String) -> Void)?
    @objc public var onScreenView: ((String) -> Void)?
    /// `code` is an `NSNumber *` and is **nil when the failure carried no HTTP status** — which
    /// is not the same as status 0. Same reasoning as `bubbleCornerRadius`.
    @objc public var onError: ((NSNumber?, String) -> Void)?
    @objc public var onSessionStart: (() -> Void)?
    /// The user closed the SDK (CHAT_ONLY chat Close). A modally presented journey also
    /// dismisses itself; an embedded one cannot, so hide/remove it here.
    @objc public var onExit: (() -> Void)?

    @objc public override init() { super.init() }

    /// Convenience for the common case.
    @objc public convenience init(environment: FCEnvironment) {
        self.init()
        self.environment = environment
    }

    /// Builds the Swift value type this bridges to.
    func swiftValue() -> FarmerChatConfig {
        let provider = tokenProvider
        let swiftProvider: FarmerChatTokenProvider? = provider.map { block in
            { @Sendable in
                await withCheckedContinuation { (cont: CheckedContinuation<String?, Never>) in
                    // A host that calls the completion twice would resume the continuation twice,
                    // which TRAPS. The host's completion can arrive on any queue (nothing about
                    // `[MyAuth refreshWithCompletion:]` promises a thread), so the guard has to be
                    // atomic — a plain Bool would let two racing calls both observe `false`.
                    let resumed = FCAtomicFlag()
                    // Hop to main to CALL the block: Objective-C hosts overwhelmingly expect to
                    // start a refresh on the main thread. This says nothing about where the
                    // completion comes back, which is why the flag above is still required.
                    DispatchQueue.main.async {
                        block { token in
                            guard resumed.takeIfUnset() else { return }
                            cont.resume(returning: token)
                        }
                    }
                }
            }
        }

        let onErrorBlock = onError
        return FarmerChatConfig(
            environment: environment.swiftValue,
            customBaseURL: customBaseURL,
            geoApiKey: geoApiKey,
            farmerChatApiKey: farmerChatApiKey,
            appearance: appearance.swiftValue,
            languageCode: languageCode,
            defaultCountryCode: defaultCountryCode,
            defaultStateCode: defaultStateCode,
            defaultLatitude: defaultLatitude,
            defaultLongitude: defaultLongitude,
            enableVoice: enableVoice,
            enableImages: enableImages,
            enableWeather: enableWeather,
            enableAgenticChat: enableAgenticChat,
            fabLabel: fabLabel,
            fabBackgroundColor: fabBackgroundColor.map { Color($0) },
            fabContentColor: fabContentColor.map { Color($0) },
            userBubbleColor: userBubbleColor.map { Color($0) },
            userBubbleTextColor: userBubbleTextColor.map { Color($0) },
            aiBubbleTextColor: aiBubbleTextColor.map { Color($0) },
            bubbleCornerRadius: bubbleCornerRadius.map { CGFloat($0.doubleValue) },
            messageFontSize: messageFontSize.map { CGFloat($0.doubleValue) },
            authMode: authMode.swiftValue,
            accessToken: accessToken,
            refreshToken: refreshToken,
            tokenProvider: swiftProvider,
            mode: mode.swiftValue,
            showSettings: showSettings,
            showHistory: showHistoryOverride,
            showDrawer: showDrawerOverride,
            showNameScreen: showNameScreen,
            enableAnalytics: enableAnalytics,
            enableSsfr: enableSsfr,
            stringOverrides: stringOverrides,
            locale: locale,
            onEvent: onEvent.map { block in { @Sendable name, props in block(name, props) } },
            onSessionExpired: onSessionExpired.map { block in { @Sendable in block() } },
            onChatOpened: onChatOpened.map { block in { @Sendable in block() } },
            onMessageSent: onMessageSent.map { block in { @Sendable text in block(text) } },
            onAnswerReceived: onAnswerReceived.map { block in { @Sendable id in block(id) } },
            onScreenView: onScreenView.map { block in { @Sendable name in block(name) } },
            onError: onErrorBlock.map { block in
                { @Sendable code, message in block(code.map(NSNumber.init(value:)), message) }
            },
            onSessionStart: onSessionStart.map { block in { @Sendable in block() } },
            onExit: onExit.map { block in { @Sendable in block() } }
        )
    }
}

// MARK: - Internals

/// One-shot thread-safe flag. Exists so a host completion block that fires twice — from any queue —
/// cannot resume a `CheckedContinuation` more than once.
private final class FCAtomicFlag {
    private let lock = NSLock()
    private var isSet = false
    /// Returns true exactly once, to the first caller.
    func takeIfUnset() -> Bool {
        lock.lock(); defer { lock.unlock() }
        if isSet { return false }
        isSet = true
        return true
    }
}

// MARK: - Auth observation token

/// Opaque handle returned by `observeAuthState:`. Call `invalidate` (or release it) to stop.
@objc(FCAuthObservation)
public final class FCAuthObservation: NSObject {
    private var cancellable: AnyCancellable?
    init(_ cancellable: AnyCancellable) { self.cancellable = cancellable }
    @objc public func invalidate() {
        cancellable?.cancel()
        cancellable = nil
    }
    deinit { cancellable?.cancel() }
}

// MARK: - Facade

/// Objective-C entry point to the FarmerChat SDK.
///
/// ```objc
/// FCFarmerChatConfiguration *cfg = [[FCFarmerChatConfiguration alloc] initWithEnvironment:FCEnvironmentProd];
/// cfg.languageCode = @"en";
/// [FCFarmerChat initializeWithConfiguration:cfg];
/// [FCFarmerChat presentFrom:self animated:YES completion:nil];
/// ```
@objc(FCFarmerChat)
public final class FCFarmerChat: NSObject {

    private override init() { super.init() }

    // --- Lifecycle

    /// Initialises the SDK. Call once, before any other member — everything else traps or no-ops
    /// until you do.
    @objc(initializeWithConfiguration:)
    public static func initialize(configuration: FCFarmerChatConfiguration) {
        _ = FarmerChat.initialize(config: configuration.swiftValue())
    }

    /// Whether `initializeWithConfiguration:` has run.
    @objc public static var isInitialized: Bool { FarmerChat.isInitialized }

    // --- Presentation

    /// A fresh journey view controller, for hosts that want to present or push it themselves.
    @objc public static func makeViewController() -> UIViewController {
        FarmerChatViewController()
    }

    /// Presents the journey modally from `presenter`.
    @objc(presentFrom:animated:completion:)
    public static func present(
        from presenter: UIViewController,
        animated: Bool,
        completion: (() -> Void)?
    ) {
        let vc = FarmerChatViewController()
        vc.modalPresentationStyle = .fullScreen
        presenter.present(vc, animated: animated, completion: completion)
    }

    /// Deep-links into chat. Pass `question` to ask immediately, `conversationId` to reopen a
    /// thread; both nil opens the normal journey. Set the target BEFORE presenting.
    @objc(openChatWithQuestion:conversationId:)
    public static func openChat(question: String?, conversationId: String?) {
        guard FarmerChat.isInitialized else { return }
        FarmerChat.shared.openChat(question: question, conversationId: conversationId)
    }

    // --- Session

    @objc public static var isAuthenticated: Bool {
        FarmerChat.isInitialized && FarmerChat.shared.isAuthenticated
    }

    /// `logout()` is `async` in Swift; Objective-C gets the completion-block form. `completion`
    /// is called on the main queue.
    @objc(logoutWithCompletion:)
    public static func logout(completion: (() -> Void)?) {
        guard FarmerChat.isInitialized else {
            completion?()
            return
        }
        Task {
            await FarmerChat.shared.logout()
            await MainActor.run { completion?() }
        }
    }

    /// Push a refreshed token into the active session (`FCAuthModeHostToken`). Pass nil for
    /// `refreshToken` to keep the stored one.
    @objc(updateTokensWithAccessToken:refreshToken:)
    public static func updateTokens(accessToken: String, refreshToken: String?) {
        guard FarmerChat.isInitialized else { return }
        FarmerChat.shared.updateTokens(access: accessToken, refresh: refreshToken)
    }

    /// Block form of the Combine `onAuthStateChanged` publisher (Combine is not representable in
    /// Objective-C). Fires immediately with the current value, then on every change, on the main
    /// queue. Keep the returned token alive for as long as you want callbacks.
    @objc(observeAuthState:)
    public static func observeAuthState(_ handler: @escaping (Bool) -> Void) -> FCAuthObservation? {
        guard FarmerChat.isInitialized else { return nil }
        let cancellable = FarmerChat.shared.onAuthStateChanged
            .receive(on: DispatchQueue.main)
            .sink { handler($0) }
        return FCAuthObservation(cancellable)
    }

    // --- Launcher

    /// A floating launcher button. The Swift initialiser has defaulted parameters, which do not
    /// bridge, so Objective-C gets this factory instead.
    @objc(makeFabButtonWithQuestion:title:backgroundColor:contentColor:systemImage:)
    public static func makeFabButton(
        question: String?,
        title: String?,
        backgroundColor: UIColor?,
        contentColor: UIColor?,
        systemImage: String?
    ) -> UIButton {
        FarmerChatFabButton(
            question: question,
            title: title,
            backgroundColor: backgroundColor,
            contentColor: contentColor,
            systemImage: systemImage
        )
    }

    /// The launcher with every default applied.
    @objc public static func makeFabButton() -> UIButton {
        FarmerChatFabButton()
    }
}
