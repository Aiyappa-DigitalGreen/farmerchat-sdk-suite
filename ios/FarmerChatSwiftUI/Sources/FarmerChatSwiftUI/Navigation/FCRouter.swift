import SwiftUI
import Combine
import FarmerChatCore

// MARK: - Destinations (port of navigation/Destination.kt)

/// All routes. `chat` carries the full argument set of the app's only
/// parameterized non-dialog route.
public enum FCDestination: Hashable {
    case splash
    case language
    case name
    case home
    case chat(ChatArgs)
    case settings
    case settingsName
    case help
    case settingsLanguage
    case chatHistory
    case error(isNetworkError: Bool, fromScreen: String)
    case accountBenefits
    case auth
    case accountSuccess
    case legalContent(url: String, title: String)

    public struct ChatArgs: Hashable {
        public var source: String = "home"
        public var question: String?
        public var conversationId: String?
        public var imagePath: String?
        public var transcriptionId: String?
        public var audioPath: String?
        public var statementId: Int?
        public var homeStatementId: String?
        public var preGeneratedAnswer: String?
        public var followUpQuestions: [String] = []
        public var isWeatherAdviceCTA: Bool = false
        public var isSSFR: Bool = false
        public var ssfrCrop: String?
        public var channel: String?

        public init(
            source: String = "home",
            question: String? = nil,
            conversationId: String? = nil,
            imagePath: String? = nil,
            transcriptionId: String? = nil,
            audioPath: String? = nil,
            statementId: Int? = nil,
            homeStatementId: String? = nil,
            preGeneratedAnswer: String? = nil,
            followUpQuestions: [String] = [],
            isWeatherAdviceCTA: Bool = false,
            isSSFR: Bool = false,
            ssfrCrop: String? = nil,
            channel: String? = nil
        ) {
            self.source = source
            self.question = question
            self.conversationId = conversationId
            self.imagePath = imagePath
            self.transcriptionId = transcriptionId
            self.audioPath = audioPath
            self.statementId = statementId
            self.homeStatementId = homeStatementId
            self.preGeneratedAnswer = preGeneratedAnswer
            self.followUpQuestions = followUpQuestions
            self.isWeatherAdviceCTA = isWeatherAdviceCTA
            self.isSSFR = isSSFR
            self.ssfrCrop = ssfrCrop
            self.channel = channel
        }
    }
}

// MARK: - Router (AppNavGraph + AppNavigator semantics)

/// Root-swapping + push navigation replicating the app's back-stack rules:
/// `popUpTo(0){inclusive}` == replace `root` and clear `path`;
/// push == append to `path`; `popUpTo(Home)` == clear path back to root Home.
@MainActor
public final class FCRouter: ObservableObject {
    /// The bottom of the stack (start destination equivalent).
    @Published public var root: FCDestination = .splash
    /// Pushed destinations above root.
    @Published public var path: [FCDestination] = []
    /// Drawer overlay (Home/Chat/Settings/Help/SettingsLanguage/ChatHistory).
    @Published public var isDrawerOpen = false
    /// Legal content is a dialog route in the app → sheet here.
    @Published public var legalSheet: LegalSheetItem?

    public struct LegalSheetItem: Identifiable, Hashable {
        public var id: String { url }
        public var url: String
        public var title: String

        public init(url: String, title: String) {
            self.url = url
            self.title = title
        }
    }

    public func openLegal(url: String, title: String) {
        legalSheet = LegalSheetItem(url: url, title: title)
    }

    let env: FarmerChat
    public let errorNavigation = ErrorNavigationManager()
    private var cancellables = Set<AnyCancellable>()

    public init(env: FarmerChat = .shared) {
        self.env = env
        // Error events → centralized Error route (singleTop).
        errorNavigation.errorEvents
            .receive(on: DispatchQueue.main)
            .sink { [weak self] event in
                guard let self else { return }
                let destination = FCDestination.error(isNetworkError: event.isNetworkError, fromScreen: event.fromScreen)
                if self.path.last != destination {
                    self.path.append(destination)
                }
            }
            .store(in: &cancellables)

        // FarmerChat.openChat while running.
        env.pendingChatTarget
            .receive(on: DispatchQueue.main)
            .compactMap { $0 }
            .sink { [weak self] target in
                guard let self, self.root != .splash else { return }
                _ = self.env.consumePendingChatTarget()
                self.push(.chat(FCDestination.ChatArgs(
                    source: "deeplink",
                    question: target.question,
                    conversationId: target.conversationId
                )))
            }
            .store(in: &cancellables)

        // C4 FarmerChat.openScreen while running.
        env.pendingScreenTarget
            .receive(on: DispatchQueue.main)
            .compactMap { $0 }
            .sink { [weak self] screen in
                guard let self, self.root != .splash else { return }
                _ = self.env.consumePendingScreenTarget()
                switch screen {
                case .home: self.navigateDrawerRoute("home")
                case .chatHistory: self.navigateDrawerRoute("chatHistory")
                case .settings: self.navigateDrawerRoute("settings")
                case .help: self.navigateDrawerRoute("help")
                case .language: self.navigateDrawerRoute("settings/language")
                }
            }
            .store(in: &cancellables)
    }

    public var current: FCDestination {
        path.last ?? root
    }

    /// Screen id used by ErrorNavigationManager.activeScreen.
    public var currentScreenId: String {
        Self.screenId(for: current)
    }

    public static func screenId(for destination: FCDestination) -> String {
        switch destination {
        case .splash: return "splash"
        case .language: return "language"
        case .name: return "name"
        case .home: return "home"
        case .chat: return "chat"
        case .settings: return "settings"
        case .settingsName: return "settingsName"
        case .help: return "help"
        case .settingsLanguage: return "settingsLanguage"
        case .chatHistory: return "chatHistory"
        case .error: return "error"
        case .accountBenefits: return "accountBenefits"
        case .auth: return "auth"
        case .accountSuccess: return "accountSuccess"
        case .legalContent: return "legalContent"
        }
    }

    // MARK: - Primitives

    /// `popUpTo(0){inclusive}` + navigate.
    public func setRoot(_ destination: FCDestination) {
        withAnimation(.easeInOut(duration: 0.3)) {
            root = destination
            path = []
        }
        syncActiveScreen()
    }

    public func push(_ destination: FCDestination) {
        // singleTop for repeated destinations.
        guard path.last != destination else { return }
        path.append(destination)
        syncActiveScreen()
    }

    public func pop() {
        guard !path.isEmpty else { return }
        path.removeLast()
        syncActiveScreen()
    }

    /// `popUpTo(Home){!inclusive}` — back to root (Home stays).
    public func popToRoot() {
        path = []
        syncActiveScreen()
    }

    private func syncActiveScreen() {
        errorNavigation.setActiveScreen(currentScreenId)
    }

    // MARK: - routeFromSplash (AppNavigator)

    public func routeFromSplash() {
        // C3 CHAT_ONLY: skip onboarding/home, land directly in Chat.
        if env.config.mode == .chatOnly {
            let target = env.consumePendingChatTarget()
            setRoot(.chat(FCDestination.ChatArgs(
                source: "chatOnly",
                question: target?.question,
                conversationId: target?.conversationId
            )))
            return
        }
        switch SplashRouter.routeFromSplash(env: env) {
        case .language:
            setRoot(.language)
        case .name:
            setRoot(.name)
        case .chat(let question, let conversationId):
            setRoot(.home)
            push(.chat(FCDestination.ChatArgs(
                source: "deeplink",
                question: question,
                conversationId: conversationId
            )))
        case .home:
            setRoot(.home)
        }
    }

    // MARK: - Drawer routes (popUpTo(startDestinationId), singleTop)

    public func navigateDrawerRoute(_ route: String) {
        isDrawerOpen = false
        switch route {
        case "home":
            setRoot(.home)
        case "settings":
            setRoot(.home)
            push(.settings)
        case "settings/language":
            setRoot(.home)
            push(.settingsLanguage)
        case "help":
            setRoot(.home)
            push(.help)
        case "chatHistory":
            setRoot(.home)
            push(.chatHistory)
        default:
            setRoot(.home)
        }
    }

    // MARK: - Flows

    /// Auth success: `popUpTo(Auth){inclusive}` → AccountSuccess.
    public func onAuthSuccess() {
        if path.last == .auth { path.removeLast() }
        push(.accountSuccess)
    }

    /// AccountSuccess continue: Home with AccountBenefits cleared
    /// (`popUpTo(AccountBenefits){inclusive}`).
    public func onAccountSuccessContinue() {
        setRoot(.home)
    }

    /// Settings logout → Splash with full reset (`popUpTo(0){inclusive}`).
    public func onLogout() {
        setRoot(.splash)
    }

    /// Error screen retry routing (per-fromScreen semantics, doc 01 §2).
    public func onErrorTryAgain(fromScreen: String) {
        pop() // leave the error screen
        switch fromScreen {
        case "chatHistory", "chathistory":
            push(.chatHistory)
        case "auth":
            push(.auth)
        case "language":
            setRoot(.language)
        case "name":
            setRoot(.name)
        default:
            break // drawer/home_weather/home_card retry in place
        }
        errorNavigation.retryLastAction()
    }
}
