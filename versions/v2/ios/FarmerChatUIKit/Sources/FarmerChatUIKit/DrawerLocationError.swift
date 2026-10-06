#if canImport(UIKit)
import UIKit
import Combine
import FarmerChatCore

// MARK: - Slide-in drawer (port of components/drawer/ + FCDrawerView)

/// Native UIKit slide-in navigation drawer: header, Home, recent-8 questions
/// (typed icons + See all), History / Language / Settings / Help rows (C3
/// gated), and a sign-up card for unauthenticated users. Presented as a child
/// overlay of `FarmerChatViewController` (not an action sheet — full app parity).
final class FCUIDrawerViewController: UIViewController {
    private let chatHistoryVM: ChatHistoryViewModel
    private let settingsVM: SettingsViewModel
    private let currentRoute: String
    private let onNavigate: (String) -> Void
    private let onOpenQuestion: (DrawerQuestion) -> Void
    private let onSeeAll: () -> Void
    private let onSignUp: () -> Void
    private var cancellables = Set<AnyCancellable>()

    private let scrim = UIView()
    private let panel = UIView()
    private var panelLeading: NSLayoutConstraint!
    private let stack = UIStackView()
    private let recentContainer = UIStackView()
    private let panelWidth: CGFloat = 300

    init(
        chatHistoryVM: ChatHistoryViewModel,
        settingsVM: SettingsViewModel,
        currentRoute: String,
        onNavigate: @escaping (String) -> Void,
        onOpenQuestion: @escaping (DrawerQuestion) -> Void,
        onSeeAll: @escaping () -> Void,
        onSignUp: @escaping () -> Void
    ) {
        self.chatHistoryVM = chatHistoryVM
        self.settingsVM = settingsVM
        self.currentRoute = currentRoute
        self.onNavigate = onNavigate
        self.onOpenQuestion = onOpenQuestion
        self.onSeeAll = onSeeAll
        self.onSignUp = onSignUp
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .overFullScreen
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear

        scrim.backgroundColor = UIColor.black.withAlphaComponent(0.4)
        scrim.alpha = 0
        scrim.translatesAutoresizingMaskIntoConstraints = false
        scrim.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(dismissDrawer)))
        view.addSubview(scrim)

        panel.backgroundColor = FCUITheme.surfacePrimary
        panel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(panel)
        panelLeading = panel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: -panelWidth)
        NSLayoutConstraint.activate([
            scrim.topAnchor.constraint(equalTo: view.topAnchor),
            scrim.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            scrim.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrim.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            panelLeading,
            panel.topAnchor.constraint(equalTo: view.topAnchor),
            panel.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            panel.widthAnchor.constraint(equalToConstant: panelWidth)
        ])

        buildPanel()

        // Recent-chats live updates + silent refresh only for authenticated
        // users (OTP or HOST_TOKEN) with showHistory on. Guests get the sign-up
        // footer and never trigger a history fetch (android-compose parity).
        if showRecentChats {
            chatHistoryVM.$recentQuestions
                .receive(on: DispatchQueue.main)
                .sink { [weak self] _ in self?.rebuildRecent() }
                .store(in: &cancellables)
            chatHistoryVM.$historyErrorMessage
                .receive(on: DispatchQueue.main)
                .sink { [weak self] _ in self?.rebuildRecent() }
                .store(in: &cancellables)

            chatHistoryVM.refreshSilently()
        }
    }

    /// Recent-chats section + History row gate: authenticated (OTP or
    /// HOST_TOKEN) AND showHistory. Mirrors `isAuthenticated && showHistory`
    /// in android-compose DrawerContent.
    private var showRecentChats: Bool {
        FarmerChat.shared.isAuthenticated && FarmerChat.shared.config.showHistory
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        panelLeading.constant = 0
        UIView.animate(withDuration: 0.25) {
            self.scrim.alpha = 1
            self.view.layoutIfNeeded()
        }
    }

    @objc private func dismissDrawer() {
        panelLeading.constant = -panelWidth
        UIView.animate(withDuration: 0.22, animations: {
            self.scrim.alpha = 0
            self.view.layoutIfNeeded()
        }, completion: { _ in
            self.dismiss(animated: false)
        })
    }

    /// Closes the drawer, then runs `action` (navigation) once dismissed.
    private func close(then action: @escaping () -> Void) {
        panelLeading.constant = -panelWidth
        UIView.animate(withDuration: 0.22, animations: {
            self.scrim.alpha = 0
            self.view.layoutIfNeeded()
        }, completion: { _ in
            self.dismiss(animated: false) { action() }
        })
    }

    private func buildPanel() {
        // Header
        let logo = UIImageView(image: UIImage(systemName: "leaf.circle.fill"))
        logo.tintColor = FCUITheme.brandSurfacePrimary
        logo.contentMode = .scaleAspectFit
        logo.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 30, weight: .regular)
        let brand = UILabel()
        brand.text = "FarmerChat"
        brand.font = .systemFont(ofSize: 20, weight: .bold)
        brand.textColor = FCUITheme.foregroundPrimary
        let header = UIStackView(arrangedSubviews: [logo, brand])
        header.axis = .horizontal
        header.spacing = 10
        header.alignment = .center
        header.isLayoutMarginsRelativeArrangement = true
        header.layoutMargins = UIEdgeInsets(top: 18, left: 20, bottom: 14, right: 20)

        // Scrollable body
        let scroll = UIScrollView()
        scroll.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 2
        stack.translatesAutoresizingMaskIntoConstraints = false
        scroll.addSubview(stack)

        panel.addSubview(header)
        panel.addSubview(scroll)
        header.translatesAutoresizingMaskIntoConstraints = false

        // Sign-up footer for guests.
        var footer: UIView?
        if !FarmerChat.shared.isAuthenticated {
            let card = makeSignUpFooter()
            footer = card
            panel.addSubview(card)
            card.translatesAutoresizingMaskIntoConstraints = false
        }

        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: panel.safeAreaLayoutGuide.topAnchor),
            header.leadingAnchor.constraint(equalTo: panel.leadingAnchor),
            header.trailingAnchor.constraint(equalTo: panel.trailingAnchor),
            scroll.topAnchor.constraint(equalTo: header.bottomAnchor),
            scroll.leadingAnchor.constraint(equalTo: panel.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: panel.trailingAnchor),
            stack.topAnchor.constraint(equalTo: scroll.topAnchor),
            stack.leadingAnchor.constraint(equalTo: scroll.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: scroll.trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: scroll.bottomAnchor),
            stack.widthAnchor.constraint(equalTo: scroll.widthAnchor)
        ])
        if let footer {
            NSLayoutConstraint.activate([
                scroll.bottomAnchor.constraint(equalTo: footer.topAnchor),
                footer.leadingAnchor.constraint(equalTo: panel.leadingAnchor),
                footer.trailingAnchor.constraint(equalTo: panel.trailingAnchor),
                footer.bottomAnchor.constraint(equalTo: panel.safeAreaLayoutGuide.bottomAnchor)
            ])
        } else {
            scroll.bottomAnchor.constraint(equalTo: panel.safeAreaLayoutGuide.bottomAnchor).isActive = true
        }

        // Rows
        stack.addArrangedSubview(navRow(icon: "house.fill", title: fcuiLabel(FCLabels.home, "Home"), route: "home"))

        // Recent-chats section only for authenticated users with showHistory on.
        if showRecentChats {
            stack.addArrangedSubview(sectionHeader(fcuiLabel(FCLabels.recentChats, "Recent chats")))
            recentContainer.axis = .vertical
            recentContainer.spacing = 2
            stack.addArrangedSubview(recentContainer)
            rebuildRecent()
        }

        stack.addArrangedSubview(divider())

        // History row: authenticated (OTP or HOST_TOKEN) AND showHistory only —
        // keeps guests out of ChatHistory via the drawer. Settings row stays C3.
        if showRecentChats {
            stack.addArrangedSubview(navRow(icon: "clock.arrow.circlepath", title: fcuiLabel(FCLabels.recentChats, "Recent chats"), route: "chatHistory"))
        }
        let lang = settingsVM.currentLanguageDisplay
        stack.addArrangedSubview(navRow(icon: "globe", title: lang.isEmpty ? fcuiLabel(FCLabels.language, "Language") : lang, route: "settings/language"))
        if FarmerChat.shared.config.showSettings {
            stack.addArrangedSubview(navRow(icon: "gearshape.fill", title: fcuiLabel(FCLabels.settings, "Settings"), route: "settings"))
        }
        stack.addArrangedSubview(navRow(icon: "questionmark.circle.fill", title: fcuiLabel(FCLabels.help, "Help"), route: "help"))
    }

    private func rebuildRecent() {
        recentContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        if chatHistoryVM.state.isLoading && chatHistoryVM.recentQuestions.isEmpty {
            let label = rowLabel(fcuiLabel(FCLabels.loading, "Loading..."), color: FCUITheme.foregroundSecondary)
            recentContainer.addArrangedSubview(label)
            return
        }
        if let error = chatHistoryVM.historyErrorMessage, chatHistoryVM.recentQuestions.isEmpty {
            recentContainer.addArrangedSubview(rowLabel(error, color: FCUITheme.foregroundSecondary))
            let retry = UIButton(type: .system)
            retry.setTitle(fcuiLabel(FCLabels.tryAgain, "Try again"), for: .normal)
            retry.setTitleColor(FCUITheme.brandSurfacePrimary, for: .normal)
            retry.contentHorizontalAlignment = .leading
            retry.addAction(UIAction { [weak self] _ in self?.chatHistoryVM.refresh() }, for: .touchUpInside)
            retry.translatesAutoresizingMaskIntoConstraints = false
            let wrap = UIView()
            wrap.addSubview(retry)
            NSLayoutConstraint.activate([
                retry.topAnchor.constraint(equalTo: wrap.topAnchor, constant: 4),
                retry.bottomAnchor.constraint(equalTo: wrap.bottomAnchor, constant: -4),
                retry.leadingAnchor.constraint(equalTo: wrap.leadingAnchor, constant: 20),
                retry.trailingAnchor.constraint(lessThanOrEqualTo: wrap.trailingAnchor, constant: -20)
            ])
            recentContainer.addArrangedSubview(wrap)
            return
        }
        for question in chatHistoryVM.recentQuestions {
            recentContainer.addArrangedSubview(recentRow(question))
        }
        if !chatHistoryVM.recentQuestions.isEmpty {
            let seeAll = UIButton(type: .system)
            seeAll.setTitle(fcuiLabel(FCLabels.seeAll, "See all"), for: .normal)
            seeAll.setTitleColor(FCUITheme.brandSurfacePrimary, for: .normal)
            seeAll.titleLabel?.font = FCUITypography.current.labelMedium.font
            seeAll.contentHorizontalAlignment = .leading
            seeAll.addAction(UIAction { [weak self] _ in self?.close { self?.onSeeAll() } }, for: .touchUpInside)
            seeAll.translatesAutoresizingMaskIntoConstraints = false
            let wrap = UIView()
            wrap.addSubview(seeAll)
            NSLayoutConstraint.activate([
                seeAll.topAnchor.constraint(equalTo: wrap.topAnchor, constant: 8),
                seeAll.bottomAnchor.constraint(equalTo: wrap.bottomAnchor, constant: -8),
                seeAll.leadingAnchor.constraint(equalTo: wrap.leadingAnchor, constant: 20),
                seeAll.trailingAnchor.constraint(lessThanOrEqualTo: wrap.trailingAnchor, constant: -20)
            ])
            recentContainer.addArrangedSubview(wrap)
        }
    }

    // MARK: - Row builders

    private func navRow(icon: String, title: String, route: String) -> UIView {
        let isActive = currentRoute == route
        let button = UIButton(type: .system)
        var config = UIButton.Configuration.plain()
        config.image = UIImage(systemName: icon)
        config.title = title
        config.imagePadding = 12
        config.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 20, bottom: 12, trailing: 20)
        config.baseForegroundColor = FCUITheme.foregroundPrimary
        button.configuration = config
        button.tintColor = isActive ? FCUITheme.brandSurfacePrimary : FCUITheme.foregroundSecondary
        button.contentHorizontalAlignment = .leading
        button.backgroundColor = isActive ? FCUITheme.surfaceActive : .clear
        button.addAction(UIAction { [weak self] _ in self?.close { self?.onNavigate(route) } }, for: .touchUpInside)
        return button
    }

    private func recentRow(_ question: DrawerQuestion) -> UIView {
        let button = UIButton(type: .system)
        var config = UIButton.Configuration.plain()
        config.image = UIImage(systemName: iconName(question.inputType))
        config.title = question.question
        config.imagePadding = 10
        config.contentInsets = NSDirectionalEdgeInsets(top: 9, leading: 20, bottom: 9, trailing: 20)
        config.baseForegroundColor = FCUITheme.foregroundPrimary
        config.titleLineBreakMode = .byTruncatingTail
        button.configuration = config
        button.tintColor = FCUITheme.foregroundSecondary
        button.contentHorizontalAlignment = .leading
        button.addAction(UIAction { [weak self] _ in self?.close { self?.onOpenQuestion(question) } }, for: .touchUpInside)
        return button
    }

    private func sectionHeader(_ text: String) -> UIView {
        let label = UILabel()
        label.text = text
        label.font = FCUITypography.current.titleMedium.font
        label.textColor = FCUITheme.foregroundSecondary
        label.translatesAutoresizingMaskIntoConstraints = false
        let wrap = UIView()
        wrap.addSubview(label)
        NSLayoutConstraint.activate([
            label.topAnchor.constraint(equalTo: wrap.topAnchor, constant: 18),
            label.bottomAnchor.constraint(equalTo: wrap.bottomAnchor, constant: -4),
            label.leadingAnchor.constraint(equalTo: wrap.leadingAnchor, constant: 20),
            label.trailingAnchor.constraint(lessThanOrEqualTo: wrap.trailingAnchor, constant: -20)
        ])
        return wrap
    }

    private func rowLabel(_ text: String, color: UIColor) -> UIView {
        let label = UILabel()
        label.text = text
        label.font = FCUITypography.current.bodySmall.font
        label.textColor = color
        label.numberOfLines = 0
        label.translatesAutoresizingMaskIntoConstraints = false
        let wrap = UIView()
        wrap.addSubview(label)
        NSLayoutConstraint.activate([
            label.topAnchor.constraint(equalTo: wrap.topAnchor, constant: 8),
            label.bottomAnchor.constraint(equalTo: wrap.bottomAnchor, constant: -8),
            label.leadingAnchor.constraint(equalTo: wrap.leadingAnchor, constant: 20),
            label.trailingAnchor.constraint(equalTo: wrap.trailingAnchor, constant: -20)
        ])
        return wrap
    }

    private func divider() -> UIView {
        let line = UIView()
        line.backgroundColor = FCUITheme.borderDefault
        line.translatesAutoresizingMaskIntoConstraints = false
        line.heightAnchor.constraint(equalToConstant: 1).isActive = true
        let wrap = UIView()
        wrap.addSubview(line)
        NSLayoutConstraint.activate([
            line.topAnchor.constraint(equalTo: wrap.topAnchor, constant: 8),
            line.bottomAnchor.constraint(equalTo: wrap.bottomAnchor, constant: -8),
            line.leadingAnchor.constraint(equalTo: wrap.leadingAnchor, constant: 20),
            line.trailingAnchor.constraint(equalTo: wrap.trailingAnchor, constant: -20)
        ])
        return wrap
    }

    private func makeSignUpFooter() -> UIView {
        let container = UIView()
        let line = UIView()
        line.backgroundColor = FCUITheme.borderDefault
        line.translatesAutoresizingMaskIntoConstraints = false
        let button = UIButton(type: .system)
        var config = UIButton.Configuration.plain()
        config.image = UIImage(systemName: "person.crop.circle.badge.plus")
        config.title = fcuiLabel(FCLabels.signUp, "Sign up")
        config.imagePadding = 10
        config.contentInsets = NSDirectionalEdgeInsets(top: 16, leading: 20, bottom: 16, trailing: 20)
        config.baseForegroundColor = FCUITheme.brandSurfacePrimary
        button.configuration = config
        button.tintColor = FCUITheme.brandSurfacePrimary
        button.contentHorizontalAlignment = .leading
        button.addAction(UIAction { [weak self] _ in self?.close { self?.onSignUp() } }, for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(line)
        container.addSubview(button)
        NSLayoutConstraint.activate([
            line.topAnchor.constraint(equalTo: container.topAnchor),
            line.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            line.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            line.heightAnchor.constraint(equalToConstant: 1),
            button.topAnchor.constraint(equalTo: line.bottomAnchor),
            button.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            button.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            button.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])
        return container
    }

    private func iconName(_ type: DrawerQuestion.InputType) -> String {
        switch type {
        case .camera: return "camera"
        case .mic: return "mic"
        case .keyboard: return "keyboard"
        case .card: return "rectangle.on.rectangle"
        }
    }
}

// MARK: - Location prompt host (port of the app's ui/location/LocationPromptHost.kt)

/// Global overlay driven by `LocationPromptManager.state`, added above the whole nav stack by
/// `FarmerChatViewController`.
///
/// Only the WEATHER entry ever shows the full-screen interstitial. While the system dialog / GPS
/// check / fetch run, Weather keeps it up but INERT (no back/skip, CTA disabled); every other
/// source (chat gps-prompt chip, campaigns) shows nothing, so the system dialog appears over the
/// current screen. Screen_Viewed/Exited for the interstitial are emitted by the Core manager.
final class FCUILocationPromptHost: UIViewController {
    private let manager: LocationPromptManager
    private var cancellables = Set<AnyCancellable>()
    private var currentContent: UIView?

    init(manager: LocationPromptManager) {
        self.manager = manager
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        manager.$state
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in self?.render(state) }
            .store(in: &cancellables)

        NotificationCenter.default.addObserver(
            self, selector: #selector(appForeground),
            name: UIApplication.didBecomeActiveNotification, object: nil
        )
    }

    @objc private func appForeground() { manager.onAppForeground() }

    /// Whether the host should intercept touches (only when showing content).
    var isBlocking: Bool { currentContent != nil }

    private func render(_ state: LocationPromptState) {
        currentContent?.removeFromSuperview()
        currentContent = nil

        switch state {
        case .idle:
            break
        case .interstitial:
            mount(makeInterstitial(inert: false, fetching: false))
        case .requestPermission, .requestEnableGps, .fetchingLocation:
            if manager.source == .weather {
                mount(makeInterstitial(inert: true, fetching: state == .fetchingLocation))
            }
        case .recovery:
            let container = UIView()
            if manager.source == .weather {
                pin(makeInterstitial(inert: true, fetching: false), in: container)
            }
            pin(makeRecovery(), in: container)
            mount(container)
        case .error(let type):
            mount(makeError(type))
        }
        // Only intercept touches while showing content (clear pass-through otherwise).
        view.isUserInteractionEnabled = currentContent != nil
    }

    private func pin(_ content: UIView, in container: UIView) {
        content.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(content)
        NSLayoutConstraint.activate([
            content.topAnchor.constraint(equalTo: container.topAnchor),
            content.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            content.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            content.trailingAnchor.constraint(equalTo: container.trailingAnchor)
        ])
    }

    private func mount(_ content: UIView) {
        pin(content, in: view)
        currentContent = content
    }

    // MARK: Full-screen message with the app's DefaultAppBar (title, ← back, "Skip")

    private func makeMessage(
        barTitle: String,
        main: String,
        subtitle: String,
        symbolName: String,
        primaryTitle: String,
        chevron: Bool,
        loading: Bool,
        primaryEnabled: Bool,
        onPrimary: @escaping () -> Void,
        onBack: (() -> Void)?,
        skipTitle: String?,
        onSkip: (() -> Void)?
    ) -> UIView {
        let message = FCUIFullScreenMessageView(
            title: main, subtitle: subtitle, symbolName: symbolName,
            primaryTitle: primaryTitle, secondaryTitle: nil
        )
        let primary = message.primaryButton
        primary.isEnabled = primaryEnabled && !loading
        primary.addAction(UIAction { _ in onPrimary() }, for: .touchUpInside)
        if chevron && !loading {
            primary.setImage(UIImage(systemName: "chevron.right"), for: .normal)
            primary.tintColor = FCUITheme.green800
            primary.semanticContentAttribute = .forceRightToLeft
            primary.imageEdgeInsets = UIEdgeInsets(top: 0, left: 8, bottom: 0, right: -8)
        }
        if loading {
            let spinner = UIActivityIndicatorView(style: .medium)
            spinner.color = FCUITheme.green800
            spinner.startAnimating()
            spinner.translatesAutoresizingMaskIntoConstraints = false
            primary.addSubview(spinner)
            NSLayoutConstraint.activate([
                spinner.centerYAnchor.constraint(equalTo: primary.centerYAnchor),
                spinner.leadingAnchor.constraint(equalTo: primary.leadingAnchor, constant: 20)
            ])
        }

        let bar = UIStackView()
        bar.axis = .horizontal
        bar.spacing = 8
        bar.alignment = .center
        bar.translatesAutoresizingMaskIntoConstraints = false
        if let onBack {
            let back = UIButton(type: .system)
            back.setImage(UIImage(systemName: "arrow.left"), for: .normal)
            back.tintColor = .white
            back.widthAnchor.constraint(equalToConstant: 44).isActive = true
            back.heightAnchor.constraint(equalToConstant: 44).isActive = true
            back.addAction(UIAction { _ in onBack() }, for: .touchUpInside)
            bar.addArrangedSubview(back)
        }
        let title = UILabel()
        title.text = barTitle
        title.font = FCUITypography.current.titleMedium.font
        title.textColor = .white
        title.setContentHuggingPriority(.defaultLow, for: .horizontal)
        bar.addArrangedSubview(title)
        if let skipTitle, let onSkip {
            let skip = UIButton(type: .system)
            skip.setTitle(skipTitle, for: .normal)
            skip.titleLabel?.font = FCUITypography.current.labelLarge.font
            skip.setTitleColor(.white, for: .normal)
            skip.heightAnchor.constraint(equalToConstant: 44).isActive = true
            skip.addAction(UIAction { _ in onSkip() }, for: .touchUpInside)
            bar.addArrangedSubview(skip)
        }
        message.addSubview(bar)
        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo: message.safeAreaLayoutGuide.topAnchor, constant: 10),
            bar.leadingAnchor.constraint(equalTo: message.leadingAnchor, constant: onBack == nil ? 20 : 8),
            bar.trailingAnchor.constraint(equalTo: message.trailingAnchor, constant: -12)
        ])
        return message
    }

    private func makeInterstitial(inert: Bool, fetching: Bool) -> UIView {
        makeMessage(
            barTitle: fcuiLabel(FCLabels.shareLocation, "Share Location"),
            main: fcuiLabel(FCLabels.getAdviceYourArea, "Get advice for your area"),
            subtitle: fcuiLabel(
                FCLabels.locationHelpsSuggestions,
                "Your location helps us suggest crops, weather, and pests near you."
            ),
            symbolName: "iphone",
            primaryTitle: fetching
                ? fcuiLabel(FCLabels.gettingYourLocation, "Getting your location...")
                : fcuiLabel(FCLabels.shareLocation, "Share Location"),
            chevron: true,
            loading: fetching,
            primaryEnabled: !inert,
            onPrimary: { [weak self] in self?.manager.shareLocationTapped() },
            onBack: inert ? nil : { [weak self] in self?.manager.cancel() },
            skipTitle: inert ? nil : fcuiLabel(FCLabels.skip, "Skip"),
            onSkip: inert ? nil : { [weak self] in self?.manager.skipTapped() }
        )
    }

    /// Error screens have their own title and NO back/skip; the CTA retries when the error is
    /// retryable and otherwise closes the flow (`LocationPromptManager.onErrorCta`).
    private func makeError(_ type: LocationErrorType) -> UIView {
        let barTitle: String
        let main: String
        let sub: String
        let symbol: String
        switch type {
        case .noNetwork:
            barTitle = fcuiLabel(FCLabels.noInternetConnection, "No internet connection")
            main = fcuiLabel(FCLabels.farmerchatNeedsTheInternet, "FarmerChat needs \nthe internet")
            // Not in the generated FCLabels; the served key from Android
            // `Labels.CHECK_MOBILE_DATA_WIFI_SIGNAL`, through the usual fallback.
            sub = fcuiLabel("fc_v2_app_label_check_mobile_data_wi-fi_signal", "Check mobile data or Wi-Fi signal")
            symbol = "sun.max"
        case .gpsUnavailable:
            barTitle = fcuiLabel(FCLabels.turnOnGps, "Turn on GPS")
            main = fcuiLabel(FCLabels.getLocalAdvice, "Get local advice")
            sub = fcuiLabel(
                FCLabels.locationGpsTurnedOffTurningHelps,
                "Location and GPS are turned off. Turning this on helps us tailor answers to your area."
            )
            symbol = "iphone"
        case .locationFailed:
            barTitle = fcuiLabel(FCLabels.somethingWentWrong, "Something went wrong")
            main = fcuiLabel(FCLabels.couldntGetYourLocation, "Couldn't get your location")
            sub = fcuiLabel(FCLabels.pleaseTryAgain, "Please try again.")
            symbol = "iphone"
        }
        return makeMessage(
            barTitle: barTitle, main: main, subtitle: sub, symbolName: symbol,
            primaryTitle: fcuiLabel(FCLabels.tryAgain, "Try again"),
            chevron: false, loading: false, primaryEnabled: true,
            onPrimary: { [weak self] in self?.manager.onErrorCta() },
            onBack: nil, skipTitle: nil, onSkip: nil
        )
    }

    // MARK: Recovery sheet ("We need your location")

    private func makeRecovery() -> UIView {
        let dim = UIView()
        dim.backgroundColor = UIColor.black.withAlphaComponent(0.4)
        dim.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(closeRecovery)))

        let sheet = UIView()
        sheet.backgroundColor = FCUITheme.neutral150
        sheet.layer.cornerRadius = 24
        sheet.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        sheet.translatesAutoresizingMaskIntoConstraints = false
        sheet.addGestureRecognizer(UIPanGestureRecognizer(target: self, action: #selector(sheetPanned(_:))))

        // The app shows the country `farmer_looking_at_phone_square` image here. The iOS packages
        // are asset-free (SF-symbol illustrations), so the 382pt slot carries the symbol instead.
        let imagePanel = UIView()
        imagePanel.backgroundColor = FCUITheme.green800
        imagePanel.layer.cornerRadius = 24
        imagePanel.layer.cornerCurve = .continuous
        imagePanel.clipsToBounds = true
        imagePanel.heightAnchor.constraint(equalToConstant: 382).isActive = true
        let symbol = UIImageView(image: UIImage(systemName: "iphone"))
        symbol.tintColor = FCUITheme.green500
        symbol.contentMode = .scaleAspectFit
        symbol.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 120, weight: .light)
        symbol.translatesAutoresizingMaskIntoConstraints = false
        imagePanel.addSubview(symbol)
        let close = UIButton(type: .system)
        close.setImage(UIImage(systemName: "xmark"), for: .normal)
        close.tintColor = .black
        close.backgroundColor = .white
        close.layer.cornerRadius = 14
        close.layer.cornerCurve = .continuous
        close.accessibilityLabel = fcuiLabel(FCLabels.close, "Close")
        close.translatesAutoresizingMaskIntoConstraints = false
        close.addTarget(self, action: #selector(closeRecovery), for: .touchUpInside)
        imagePanel.addSubview(close)
        NSLayoutConstraint.activate([
            symbol.centerXAnchor.constraint(equalTo: imagePanel.centerXAnchor),
            symbol.centerYAnchor.constraint(equalTo: imagePanel.centerYAnchor),
            close.topAnchor.constraint(equalTo: imagePanel.topAnchor, constant: 12),
            close.trailingAnchor.constraint(equalTo: imagePanel.trailingAnchor, constant: -12),
            close.widthAnchor.constraint(equalToConstant: 44),
            close.heightAnchor.constraint(equalToConstant: 44)
        ])

        let title = UILabel()
        title.textColor = .black
        title.textAlignment = .center
        title.numberOfLines = 0
        title.text = fcuiLabel(FCLabels.weNeedYourLocation, "We need your location")
        title.font = UIFont.systemFont(ofSize: FCUITypography.current.titleLarge.font.pointSize, weight: .semibold)
        let body = UILabel()
        body.textColor = .black
        body.textAlignment = .center
        body.numberOfLines = 0
        body.text = fcuiLabel(
            FCLabels.locationTailorAdvice,
            "Sharing your location helps FarmerChat tailor advice to your farm."
        )
        body.font = FCUITypography.current.bodyMedium.font

        let settings = FCUIPrimaryButton(title: fcuiLabel(FCLabels.turnOnInSettings, "Turn on in settings"))
        settings.constraints.first { $0.firstAttribute == .height }?.constant = 56
        settings.setImage(UIImage(systemName: "chevron.right"), for: .normal)
        settings.tintColor = FCUITheme.green500
        settings.semanticContentAttribute = .forceRightToLeft
        settings.imageEdgeInsets = UIEdgeInsets(top: 0, left: 8, bottom: 0, right: -8)
        settings.addAction(UIAction { [weak self] _ in
            self?.manager.recoveryConfirmed()
            if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
        }, for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [imagePanel, title, body, settings])
        stack.axis = .vertical
        stack.spacing = 12
        stack.setCustomSpacing(16, after: imagePanel)
        stack.alignment = .fill
        stack.isLayoutMarginsRelativeArrangement = true
        stack.layoutMargins = UIEdgeInsets(top: 16, left: 20, bottom: 16, right: 20)
        stack.translatesAutoresizingMaskIntoConstraints = false
        sheet.addSubview(stack)

        let container = UIView()
        container.addSubview(dim)
        container.addSubview(sheet)
        dim.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            dim.topAnchor.constraint(equalTo: container.topAnchor),
            dim.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            dim.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            dim.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            sheet.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            sheet.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            sheet.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            sheet.topAnchor.constraint(greaterThanOrEqualTo: container.safeAreaLayoutGuide.topAnchor),
            stack.topAnchor.constraint(equalTo: sheet.topAnchor),
            stack.leadingAnchor.constraint(equalTo: sheet.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: sheet.trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: sheet.safeAreaLayoutGuide.bottomAnchor)
        ])
        return container
    }

    /// Close button / backdrop / swipe-down: `Permission_Fallback_Default_Setting_Canceled`, then
    /// continue without location (pending navigation runs).
    @objc private func closeRecovery() { manager.recoveryClosed() }

    @objc private func sheetPanned(_ pan: UIPanGestureRecognizer) {
        guard let sheet = pan.view else { return }
        let dy = max(0, pan.translation(in: sheet).y)
        switch pan.state {
        case .changed:
            sheet.transform = CGAffineTransform(translationX: 0, y: dy)
        case .ended, .cancelled:
            if dy > 100 {
                manager.recoveryClosed()
            } else {
                UIView.animate(withDuration: 0.2) { sheet.transform = .identity }
            }
        default:
            break
        }
    }
}
#endif
