import SwiftUI
import FarmerChatCore

/// Root SwiftUI entry (`FarmerChat.launch` equivalent): NavigationStack
/// router matching doc 01 §2, shared drawer overlay on
/// Home/Chat/Settings/Help/SettingsLanguage/ChatHistory, centralized error
/// route, global LocationPromptHost.
public struct FarmerChatView: View {
    @Environment(\.colorScheme) private var colorScheme
    @StateObject private var router: FCRouter
    @StateObject private var chatHistoryVM: ChatHistoryViewModel
    @StateObject private var settingsVM: SettingsViewModel
    @StateObject private var locationPrompt: LocationPromptManager
    @State private var showNameUpdatedToast = false
    @State private var appearanceTick = 0

    public init() {
        precondition(FarmerChat.isInitialized, "Call FarmerChat.initialize(config:) before FarmerChatView()")
        _router = StateObject(wrappedValue: FCRouter())
        _chatHistoryVM = StateObject(wrappedValue: ChatHistoryViewModel())
        _settingsVM = StateObject(wrappedValue: SettingsViewModel())
        _locationPrompt = StateObject(wrappedValue: LocationPromptManager())
    }

    private var theme: FCTheme {
        _ = appearanceTick // re-evaluate when appearance changes
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
        .environmentObject(router)
        .environmentObject(locationPrompt)
        .preferredColorScheme(preferredScheme)
        .animation(.easeInOut(duration: 0.2), value: router.isDrawerOpen)
        .onReceive(FarmerChat.shared.onAuthStateChanged) { isAuthenticated in
            if isAuthenticated {
                chatHistoryVM.refresh()
            }
        }
        .onReceive(locationPrompt.events) { event in
            if event == .locationUpdatedFromWidget {
                // Refresh Home in place (shouldRefreshHome parity).
                if router.current == .home {
                    router.setRoot(.home)
                }
            }
        }
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
        chatHistoryVM.refreshSilently()
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
        case .settingsName:
            SettingsNameView(onSaveComplete: { showNameUpdatedToast = true })
        case .help:
            HelpView(openDrawer: openDrawer)
        case .settingsLanguage:
            LanguageChooserView(
                settingsVM: settingsVM,
                openDrawer: openDrawer,
                onLanguageSaved: { router.setRoot(.home) },
                onFetchLabelsFailure: { router.setRoot(.home) }
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
        FarmerChatView()
    }
}

// MARK: - UIKit presentation helper (FarmerChat.present(from:))

extension FarmerChat {
    /// Presents the full SwiftUI journey modally from UIKit (iOS 16+).
    @MainActor
    public func present(from presenter: UIViewController, animated: Bool = true) {
        let hosting = UIHostingController(rootView: FarmerChatView())
        hosting.modalPresentationStyle = .fullScreen
        presenter.present(hosting, animated: animated)
    }
}
