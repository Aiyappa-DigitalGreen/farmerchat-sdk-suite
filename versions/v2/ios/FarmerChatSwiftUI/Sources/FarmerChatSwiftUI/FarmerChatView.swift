import SwiftUI
import FarmerChatCore

/// Root SwiftUI entry (`FarmerChat.launch` equivalent): NavigationStack
/// router matching doc 01 §2, shared drawer overlay on
/// Home/Chat/Settings/Help/SettingsLanguage/ChatHistory, centralized error
/// route, global LocationPromptHost.
public struct FarmerChatView: View {
    @Environment(\.colorScheme) private var colorScheme
    /// Set by the SDK's own presenters (FAB cover, `present(from:)`) — see ``FCExitActionKey``.
    @Environment(\.fcExitAction) private var sdkExitAction
    /// The HOST's presentation context (outside this view's NavigationStack): when the host put
    /// `FarmerChatView` in its own `.sheet`/`.fullScreenCover`, this dismisses it with the host's
    /// binding kept in sync.
    @Environment(\.dismiss) private var hostDismiss
    @Environment(\.isPresented) private var hostIsPresented
    @StateObject private var router: FCRouter
    @StateObject private var chatHistoryVM: ChatHistoryViewModel
    @StateObject private var settingsVM: SettingsViewModel
    @StateObject private var locationPrompt: LocationPromptManager
    @State private var showNameUpdatedToast = false
    @State private var appearanceTick = 0
    /// Mirrors `appearanceTick` for language. `theme` resolves the per-script type scale from
    /// the persisted language code, which SwiftUI cannot observe — and the onboarding language
    /// screen, the first screen a farmer sees, writes it through a view model this view does
    /// not hold. Without this the Devanagari/Ethiopic/Kannada/Oriya/Telugu tables would not
    /// take effect until the next launch.
    @State private var languageTick = 0

    /// Inline embedding (`FarmerChatInlineView`): the Close (X) must not dismiss the HOST's
    /// presentation — `isPresented` is also true for an inline view inside a host sheet or a
    /// pushed host screen, and dismissing would close the host's whole screen.
    private let inline: Bool

    public init() {
        self.init(inline: false)
    }

    init(inline: Bool) {
        precondition(FarmerChat.isInitialized, "Call FarmerChat.initialize(config:) before FarmerChatView()")
        self.inline = inline
        _router = StateObject(wrappedValue: FCRouter())
        _chatHistoryVM = StateObject(wrappedValue: ChatHistoryViewModel())
        _settingsVM = StateObject(wrappedValue: SettingsViewModel())
        _locationPrompt = StateObject(wrappedValue: LocationPromptManager())
    }

    private var theme: FCTheme {
        _ = appearanceTick // re-evaluate when appearance changes
        _ = languageTick // ...and when the language (hence the type scale) changes
        return FCTheme.theme(for: colorScheme, appearance: FarmerChat.shared.appearance)
    }

    public var body: some View {
        ZStack {
            NavigationStack(path: $router.path) {
                screen(for: router.root)
                    .navigationBarHidden(true)
                    .navigationDestination(for: FCDestination.self) { destination in
                        screen(for: destination)
                            .navigationBarHidden(true)
                    }
            }

            // Drawer overlay (side overlay, not a nav destination).
            // C3: suppressed entirely when the host disables `showDrawer`.
            if router.isDrawerOpen && FarmerChat.shared.config.showDrawer {
                FCDrawerView(
                    currentRoute: drawerRoute,
                    isAuthenticated: FarmerChat.shared.isAuthenticated,
                    currentLanguage: settingsVM.currentLanguageDisplay,
                    recentQuestions: chatHistoryVM.recentQuestions,
                    historyErrorMessage: chatHistoryVM.historyErrorMessage,
                    isLoadingHistory: chatHistoryVM.state.isLoading,
                    onNavigate: { router.navigateDrawerRoute($0) },
                    onOpenQuestion: { question in
                        router.isDrawerOpen = false
                        router.push(.chat(FCDestination.ChatArgs(
                            source: "history",
                            question: question.conversationId == nil ? question.question : nil,
                            conversationId: question.conversationId
                        )))
                    },
                    onSeeAll: {
                        router.isDrawerOpen = false
                        router.push(.chatHistory)
                    },
                    onSignUp: {
                        router.isDrawerOpen = false
                        handleSignUpClick()
                    },
                    onRetryHistory: { chatHistoryVM.refresh() },
                    onClose: { router.isDrawerOpen = false }
                )
                .zIndex(10)
                .transition(.opacity)
            }

            // Global location prompt host (rendered above everything, like
            // MainActivity's LocationPromptHost).
            LocationPromptHostView(manager: locationPrompt)
                .zIndex(20)
        }
        .environment(\.fcTheme, theme)
        .environment(\.fcExitAction, resolvedExitAction)
        .environmentObject(router)
        .environmentObject(locationPrompt)
        .preferredColorScheme(preferredScheme)
        .animation(.easeInOut(duration: 0.2), value: router.isDrawerOpen)
        .onReceive(FarmerChat.shared.onAuthStateChanged) { isAuthenticated in
            if isAuthenticated {
                chatHistoryVM.refresh()
            }
        }
        // Home reloads its feed + weather itself on a location success (HomeView), as the app's
        // HomeScreen does — no root rebuild here, which reloaded Home a second time.
    }

    /// What the CHAT_ONLY Close (X) does after firing `config.onExit`: the SDK presenter's own
    /// dismiss, else (non-inline only) the host's SwiftUI presentation dismiss, else nothing —
    /// the host hides the SDK from `onExit`.
    private var resolvedExitAction: (@MainActor () -> Void)? {
        if let sdkExitAction { return sdkExitAction }
        guard !inline, hostIsPresented else { return nil }
        let dismiss = hostDismiss
        return { dismiss() }
    }

    private var preferredScheme: ColorScheme? {
        switch FarmerChat.shared.appearance {
        case .day: return .light
        case .night: return .dark
        case .auto: return nil
        }
    }

    private var drawerRoute: String {
        switch router.current {
        case .home: return "home"
        case .settings: return "settings"
        case .settingsLanguage: return "settings/language"
        case .help: return "help"
        case .chatHistory: return "chatHistory"
        default: return ""
        }
    }

    private func openDrawer() {
        guard FarmerChat.shared.config.showDrawer else { return } // C3
        // Silent history refresh only for authenticated users (OTP or
        // HOST_TOKEN); guests never trigger a history fetch (android parity).
        if FarmerChat.shared.isAuthenticated {
            chatHistoryVM.refreshSilently()
        }
        router.isDrawerOpen = true
    }

    /// Drawer/Settings sign-up: `getUserQuestionCount()` → bypass_interstitial.
    private func handleSignUpClick() {
        Task {
            let bypass = await settingsVM.shouldBypassInterstitial()
            router.push(bypass ? .auth : .accountBenefits)
        }
    }

    // MARK: - Destination dispatch

    @ViewBuilder
    private func screen(for destination: FCDestination) -> some View {
        switch destination {
        case .splash:
            SplashView()
        case .language:
            LanguageSelectionView()
        case .name:
            EnterNameView()
        case .home:
            HomeView(openDrawer: openDrawer)
        case .chat(let args):
            ChatView(args: args, openDrawer: openDrawer)
        case .settings:
            SettingsView(
                settingsVM: settingsVM,
                openDrawer: openDrawer,
                showNameUpdatedToast: showNameUpdatedToast,
                onToastConsumed: { showNameUpdatedToast = false }
            )
            .id(appearanceTick)
            .onChange(of: settingsVM.appearanceMode) { _ in appearanceTick += 1 }
            .onReceive(FarmerChat.shared.prefs.languageDidChange) { _ in languageTick += 1 }
        case .settingsName:
            SettingsNameView(onSaveComplete: { showNameUpdatedToast = true })
        case .help:
            HelpView(openDrawer: openDrawer)
        case .settingsLanguage:
            LanguageChooserView(
                settingsVM: settingsVM,
                openDrawer: openDrawer,
                onLanguageSaved: { router.navigateHomeOrChat() },
                onFetchLabelsFailure: { router.navigateHomeOrChat() }
            )
        case .chatHistory:
            ChatHistoryView(viewModel: chatHistoryVM, openDrawer: openDrawer)
        case .error(let isNetworkError, let fromScreen):
            ErrorScreenView(isNetworkError: isNetworkError, fromScreen: fromScreen)
        case .accountBenefits:
            AccountBenefitsView()
        case .auth:
            AuthView()
        case .accountSuccess:
            AccountSuccessView()
        case .legalContent(let url, let title):
            LegalContentView(url: url, title: title)
        }
    }
}

// MARK: - C1 Inline embeddable view

/// Host-placeable FarmerChat journey/chat (docs/07 C1). Unlike a full-screen
/// `.fullScreenCover(FarmerChatView())`, this is meant to be dropped into any
/// container — it fills the space its parent gives it and makes no
/// full-viewport assumptions. Pair with `mode: .chatOnly` to embed just chat.
///
/// ```swift
/// VStack {
///     MyHeader()
///     FarmerChatInlineView()          // fills the remaining space
/// }
/// ```
public struct FarmerChatInlineView: View {
    public init() {
        precondition(FarmerChat.isInitialized, "Call FarmerChat.initialize(config:) before FarmerChatInlineView()")
    }

    public var body: some View {
        FarmerChatView(inline: true)
    }
}

// MARK: - UIKit presentation helper (FarmerChat.present(from:))

extension FarmerChat {
    /// Presents the full SwiftUI journey modally from UIKit (iOS 16+).
    @MainActor
    public func present(from presenter: UIViewController, animated: Bool = true) {
        let box = FCWeakViewController()
        let hosting = UIHostingController(rootView: FarmerChatView()
            .environment(\.fcExitAction) { box.controller?.dismiss(animated: true) })
        box.controller = hosting
        hosting.modalPresentationStyle = .fullScreen
        presenter.present(hosting, animated: animated)
    }
}

// MARK: - Exit (CHAT_ONLY Close)

/// How the SDK's chat Close (X) removes the SDK UI. Each SDK presenter (FAB cover,
/// `present(from:)`) installs the dismiss of exactly the container it created; the chat never
/// walks the window hierarchy (that dismissed whatever happened to be on top — a host's own
/// sheet, or a SwiftUI cover behind its binding's back, so the FAB could not reopen).
struct FCExitActionKey: EnvironmentKey {
    static let defaultValue: (@MainActor () -> Void)? = nil
}

extension EnvironmentValues {
    var fcExitAction: (@MainActor () -> Void)? {
        get { self[FCExitActionKey.self] }
        set { self[FCExitActionKey.self] = newValue }
    }
}

/// Lets `present(from:)` hand the hosting controller to its own root view without a cycle.
final class FCWeakViewController {
    weak var controller: UIViewController?
}
