#if canImport(UIKit)
import UIKit
import Combine
import FarmerChatCore

/// UIKit entry point (iOS 15+): a navigation controller that runs the full
/// journey with genuinely UIKit-native screens.
///
/// iOS 16+ hosts that prefer the SwiftUI experience can instead import
/// `FarmerChatSwiftUI` and call `FarmerChat.shared.present(from:)` — that
/// package hosts the SwiftUI flow in a `UIHostingController`. This package
/// stays iOS 15-compatible and has no SwiftUI in its public path.
public final class FarmerChatViewController: UINavigationController {
    private var cancellables = Set<AnyCancellable>()

    // Shared, nav-controller-scoped view models & managers (app parity: the
    // drawer's recent-8 list + language label, and the global location prompt).
    let chatHistoryVM = ChatHistoryViewModel()
    let settingsVM = SettingsViewModel()
    let locationPrompt = LocationPromptManager()
    /// Centralized error route (per-fromScreen retry) — replaces ad-hoc error VCs.
    let errorNavigation = ErrorNavigationManager()
    private var locationHost: FCUILocationPromptHost?

    public convenience init() {
        precondition(FarmerChat.isInitialized, "Call FarmerChat.initialize(config:) before FarmerChatViewController()")
        self.init(rootViewController: FCUISplashViewController())
        modalPresentationStyle = .fullScreen
        setNavigationBarHidden(true, animated: false)
        overrideUserInterfaceStyle = FCUITheme.interfaceStyle(for: FarmerChat.shared.appearance)

        // FarmerChat.openChat while running.
        FarmerChat.shared.pendingChatTarget
            .receive(on: DispatchQueue.main)
            .compactMap { $0 }
            .sink { [weak self] target in
                guard let self, !(self.topViewController is FCUISplashViewController) else { return }
                _ = FarmerChat.shared.consumePendingChatTarget()
                self.pushViewController(FCUIChatViewController(args: FCUIChatArgs(
                    source: "deeplink",
                    question: target.question,
                    conversationId: target.conversationId
                )), animated: true)
            }
            .store(in: &cancellables)

        // C4: FarmerChat.openScreen while running → top-level navigation.
        FarmerChat.shared.pendingScreenTarget
            .receive(on: DispatchQueue.main)
            .compactMap { $0 }
            .sink { [weak self] screen in
                guard let self, !(self.topViewController is FCUISplashViewController) else { return }
                _ = FarmerChat.shared.consumePendingScreenTarget()
                switch screen {
                case .home: self.navigateDrawerRoute("home")
                case .chatHistory: self.navigateDrawerRoute("chatHistory")
                case .settings: self.navigateDrawerRoute("settings")
                case .help: self.navigateDrawerRoute("help")
                case .language: self.navigateDrawerRoute("settings/language")
                }
            }
            .store(in: &cancellables)

        // Centralized error route: any screen firing errorNavigation surfaces
        // the full-screen error VC; Try again runs the stored retry action.
        errorNavigation.errorEvents
            .receive(on: DispatchQueue.main)
            .sink { [weak self] event in
                guard let self, !(self.presentedViewController is FCUIErrorViewController) else { return }
                let error = FCUIErrorViewController(isNetworkError: event.isNetworkError) { [weak self] in
                    self?.errorNavigation.retryLastAction()
                }
                self.present(error, animated: true)
            }
            .store(in: &cancellables)
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        installLocationHost()
    }

    /// Global location-prompt overlay above the whole nav stack.
    private func installLocationHost() {
        let host = FCUILocationPromptHost(manager: locationPrompt)
        addChild(host)
        host.view.frame = view.bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        host.view.isUserInteractionEnabled = false
        view.addSubview(host.view)
        host.didMove(toParent: self)
        locationHost = host
    }

    public override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        if let hostView = locationHost?.view { view.bringSubviewToFront(hostView) }
    }

    // MARK: - Drawer

    /// Opens the slide-in navigation drawer (app parity, not an action sheet).
    @MainActor
    func openDrawer(currentRoute: String) {
        guard FarmerChat.shared.config.showDrawer else { return } // C3
        settingsVM.loadLanguages()
        let drawer = FCUIDrawerViewController(
            chatHistoryVM: chatHistoryVM,
            settingsVM: settingsVM,
            currentRoute: currentRoute,
            onNavigate: { [weak self] route in self?.navigateDrawerRoute(route) },
            onOpenQuestion: { [weak self] question in
                self?.pushViewController(FCUIChatViewController(args: FCUIChatArgs(
                    source: "history",
                    question: question.conversationId == nil ? question.question : nil,
                    conversationId: question.conversationId
                )), animated: true)
            },
            onSeeAll: { [weak self] in self?.navigateDrawerRoute("chatHistory") },
            onSignUp: { [weak self] in self?.drawerSignUp() }
        )
        present(drawer, animated: false)
    }

    /// Drawer route dispatch (popUpTo(Home) + push, singleTop) — parity with
    /// FCRouter.navigateDrawerRoute.
    @MainActor
    func navigateDrawerRoute(_ route: String) {
        let home = ensureHomeRoot()
        switch route {
        case "home":
            popToViewController(home, animated: true)
        case "chatHistory":
            popToViewController(home, animated: false)
            pushViewController(FCUIChatHistoryViewController(), animated: true)
        case "settings":
            popToViewController(home, animated: false)
            pushViewController(FCUISettingsViewController(), animated: true)
        case "settings/language":
            popToViewController(home, animated: false)
            pushViewController(FCUILanguageViewController(mode: .settings), animated: true)
        case "help":
            popToViewController(home, animated: false)
            pushViewController(FCUIHelpViewController(), animated: true)
        default:
            popToViewController(home, animated: true)
        }
    }

    /// Guarantees a Home root exists at the bottom of the stack, returns it.
    @discardableResult
    private func ensureHomeRoot() -> UIViewController {
        if let home = viewControllers.first(where: { $0 is FCUIHomeViewController }) {
            return home
        }
        let home = FCUIHomeViewController()
        setViewControllers([home], animated: false)
        return home
    }

    private func drawerSignUp() {
        Task { @MainActor in
            let result = await FarmerChat.shared.api.userQuestionCount()
            let bypass = result.value?.bypassInterstitial ?? false
            let pushAuth: () -> Void = { [weak self] in
                guard let self else { return }
                let auth = FCUIAuthViewController { [weak self] in
                    var stack = self?.viewControllers ?? []
                    stack.removeAll { $0 is FCUIAuthViewController || $0 is FCUIAccountBenefitsViewController }
                    stack.append(FCUIAccountSuccessViewController())
                    self?.setViewControllers(stack, animated: true)
                }
                self.pushViewController(auth, animated: true)
            }
            if bypass {
                pushAuth()
            } else {
                self.pushViewController(FCUIAccountBenefitsViewController(onSignUp: pushAuth), animated: true)
            }
        }
    }

    /// `routeFromSplash()` — shared decision tree from Core (+ C3 chatOnly).
    @MainActor
    func routeFromSplash() {
        // C3 CHAT_ONLY: skip onboarding/home, land directly in a fresh Chat.
        if FarmerChat.shared.config.mode == .chatOnly {
            let target = FarmerChat.shared.consumePendingChatTarget()
            setViewControllers([FCUIChatViewController(args: FCUIChatArgs(
                source: "chatOnly",
                question: target?.question,
                conversationId: target?.conversationId
            ))], animated: true)
            return
        }
        switch SplashRouter.routeFromSplash() {
        case .language:
            setViewControllers([FCUILanguageViewController(mode: .onboarding)], animated: true)
        case .name:
            setViewControllers([FCUINameViewController(mode: .onboarding)], animated: true)
        case .chat(let question, let conversationId):
            let home = FCUIHomeViewController()
            let chat = FCUIChatViewController(args: FCUIChatArgs(
                source: "deeplink",
                question: question,
                conversationId: conversationId
            ))
            setViewControllers([home, chat], animated: true)
        case .home:
            setViewControllers([FCUIHomeViewController()], animated: true)
        }
        runVerificationAutomation()
    }

    /// e2e verification hooks (parity with the SwiftUI sample's `-fcAuto*`):
    /// after Home is reachable, a launch arg drives the flow to a target
    /// UIKit screen so it can be screenshotted headlessly. DEBUG-only — these
    /// are stripped from release SDK builds (the distributed xcframework).
    private func runVerificationAutomation() {
#if DEBUG
        let args = ProcessInfo.processInfo.arguments
        guard args.contains(where: { $0.hasPrefix("-fcUI") }) else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) { [weak self] in
            guard let self else { return }
            if args.contains("-fcUIDrawer") {
                self.openDrawer(currentRoute: "home")
            } else if args.contains("-fcUILocation") {
                self.locationPrompt.triggerFromWeather { [weak self] in
                    self?.pushViewController(FCUIChatViewController(args: FCUIChatArgs(
                        question: "What does today's weather mean for my farm?", isWeatherAdviceCTA: true
                    )), animated: true)
                }
            } else if args.contains("-fcUISettings") {
                self.navigateDrawerRoute("settings")
            } else if args.contains("-fcUIHelp") {
                self.navigateDrawerRoute("help")
            } else if args.contains("-fcUIHistory") {
                self.navigateDrawerRoute("chatHistory")
            } else if args.contains("-fcUILanguage") {
                self.navigateDrawerRoute("settings/language")
            } else if args.contains("-fcUIChat") {
                self.pushViewController(FCUIChatViewController(args: FCUIChatArgs(
                    question: "How do I protect my maize from armyworm?"
                )), animated: true)
            } else if args.contains("-fcUIError") {
                self.errorNavigation.setActiveScreen("home")
                self.errorNavigation.navigateToError(isNetworkError: false, fromScreen: "home", retry: {})
            }
        }
#endif
    }

    /// Logout → Splash with a fully reset stack.
    @MainActor
    func restartFromSplash() {
        setViewControllers([FCUISplashViewController()], animated: true)
    }
}

// MARK: - Splash

final class FCUISplashViewController: UIViewController {
    private let logoView = UIImageView(image: UIImage(systemName: "leaf.circle.fill"))
    private var didFire = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = FCUITheme.green800
        logoView.tintColor = .white
        logoView.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 88, weight: .regular)
        logoView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(logoView)
        NSLayoutConstraint.activate([
            logoView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            logoView.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !didFire else { return }
        didFire = true

        // Rotating logo (hold, then spin).
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak self] in
            guard let self, self.view.window != nil else { return }
            let rotation = CABasicAnimation(keyPath: "transform.rotation.z")
            rotation.toValue = Double.pi * 2
            rotation.duration = 1.2
            rotation.repeatCount = .infinity
            self.logoView.layer.add(rotation, forKey: "spin")
        }

        let env = FarmerChat.shared
        env.analytics.screenViewed(ScreenNames.splash)
        env.analytics.track(AnalyticsEvents.appOpened, props: ["build_version": "V2"])
        env.prefs.setBool(true, .isProfileLoaded)

        Task { @MainActor in
            let result = await env.session.ensureGuestSession()
            try? await Task.sleep(nanoseconds: 200_000_000)
            env.analytics.screenExited(ScreenNames.splash)
            let nav = self.navigationController as? FarmerChatViewController
            // Guest-init failure (no existing tokens) → centralized error route.
            if case .error(let error) = result, env.session.userId == nil {
                nav?.errorNavigation.setActiveScreen("splash")
                nav?.errorNavigation.navigateToError(
                    isNetworkError: error.isNetworkError,
                    fromScreen: "splash",
                    retry: { [weak self] in
                        Task { @MainActor in
                            _ = await FarmerChat.shared.session.ensureGuestSession()
                            (self?.navigationController as? FarmerChatViewController)?.routeFromSplash()
                        }
                    }
                )
                return
            }
            nav?.routeFromSplash()
        }
    }
}

// MARK: - Error (full-screen, per-source retry)

final class FCUIErrorViewController: UIViewController {
    private let isNetworkError: Bool
    private let onRetry: () -> Void

    init(isNetworkError: Bool, onRetry: @escaping () -> Void) {
        self.isNetworkError = isNetworkError
        self.onRetry = onRetry
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .fullScreen
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        let message = FCUIFullScreenMessageView(
            title: isNetworkError
                ? fcuiLabel("no_internet_title", "No internet connection")
                : fcuiLabel("api_error_title", "Something went wrong"),
            subtitle: isNetworkError
                ? fcuiLabel("no_internet_message", "You appear to be offline. Check your connection and try again.")
                : fcuiLabel("api_error_message", "We're having trouble right now. Please try again."),
            symbolName: "sun.max",
            primaryTitle: fcuiLabel("try_again", "Try again"),
            secondaryTitle: nil
        )
        message.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(message)
        NSLayoutConstraint.activate([
            message.topAnchor.constraint(equalTo: view.topAnchor),
            message.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            message.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            message.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        message.primaryButton.addAction(UIAction { [weak self] _ in
            self?.dismiss(animated: true) { self?.onRetry() }
        }, for: .touchUpInside)
        FarmerChat.shared.analytics.screenViewed(ScreenNames.error)
    }
}
#endif
