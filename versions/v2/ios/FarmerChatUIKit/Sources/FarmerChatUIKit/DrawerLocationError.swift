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
        stack.addArrangedSubview(navRow(icon: "house.fill", title: fcuiLabel("drawer_home", "Home"), route: "home"))

        // Recent-chats section only for authenticated users with showHistory on.
        if showRecentChats {
            stack.addArrangedSubview(sectionHeader(fcuiLabel("drawer_recent", "Recent chats")))
            recentContainer.axis = .vertical
            recentContainer.spacing = 2
            stack.addArrangedSubview(recentContainer)
            rebuildRecent()
        }

        stack.addArrangedSubview(divider())

        // History row: authenticated (OTP or HOST_TOKEN) AND showHistory only —
        // keeps guests out of ChatHistory via the drawer. Settings row stays C3.
        if showRecentChats {
            stack.addArrangedSubview(navRow(icon: "clock.arrow.circlepath", title: fcuiLabel("drawer_history", "Recent Chats"), route: "chatHistory"))
        }
        let lang = settingsVM.currentLanguageDisplay
        stack.addArrangedSubview(navRow(icon: "globe", title: lang.isEmpty ? fcuiLabel("drawer_language", "Language") : lang, route: "settings/language"))
        if FarmerChat.shared.config.showSettings {
            stack.addArrangedSubview(navRow(icon: "gearshape.fill", title: fcuiLabel("drawer_settings", "Settings"), route: "settings"))
        }
        stack.addArrangedSubview(navRow(icon: "questionmark.circle.fill", title: fcuiLabel("drawer_help", "Help"), route: "help"))
    }

    private func rebuildRecent() {
        recentContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        if chatHistoryVM.state.isLoading && chatHistoryVM.recentQuestions.isEmpty {
            let label = rowLabel(fcuiLabel("loading", "Loading…"), color: FCUITheme.foregroundSecondary)
            recentContainer.addArrangedSubview(label)
            return
        }
        if let error = chatHistoryVM.historyErrorMessage, chatHistoryVM.recentQuestions.isEmpty {
            recentContainer.addArrangedSubview(rowLabel(error, color: FCUITheme.foregroundSecondary))
            let retry = UIButton(type: .system)
            retry.setTitle(fcuiLabel("try_again", "Try again"), for: .normal)
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
            seeAll.setTitle(fcuiLabel("drawer_see_all", "See all"), for: .normal)
            seeAll.setTitleColor(FCUITheme.brandSurfacePrimary, for: .normal)
            seeAll.titleLabel?.font = .systemFont(ofSize: 15, weight: .semibold)
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
        label.text = text.uppercased()
        label.font = .systemFont(ofSize: 13, weight: .semibold)
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
        label.font = .systemFont(ofSize: 14)
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
        config.title = fcuiLabel("drawer_sign_up", "Sign up")
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

// MARK: - Location prompt host (port of LocationPromptHost / LocationPromptHostView)

/// Global overlay driven by `LocationPromptManager.state`: interstitial →
/// permission/fetch (interstitial stays for the weather flow) → recovery sheet /
/// error. Added above the whole nav stack by `FarmerChatViewController`.
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
            showInterstitial(loading: false)
        case .requestPermission, .requestEnableGps, .fetchingLocation:
            // Weather and the 2.0.0 chat capability chip keep the interstitial overlay (loading
            // CTA) — Compose's host keeps it for every source; widget/deeplink are silent triggers
            // by design and show nothing.
            if manager.source == .weather || manager.source == .localContext {
                showInterstitial(loading: true)
            }
        case .recovery:
            showRecovery()
        case .error(let type):
            showError(type)
        }
        // Only intercept touches while showing content (clear pass-through otherwise).
        view.isUserInteractionEnabled = currentContent != nil
    }

    private func mount(_ content: UIView) {
        content.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(content)
        NSLayoutConstraint.activate([
            content.topAnchor.constraint(equalTo: view.topAnchor),
            content.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            content.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            content.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        currentContent = content
    }

    private func showInterstitial(loading: Bool) {
        FarmerChat.shared.analytics.screenViewed(ScreenNames.locationPrompt)
        let message = FCUIFullScreenMessageView(
            title: fcuiLabel("location_title", "Share Location"),
            subtitle: fcuiLabel("location_subtitle", "Get weather alerts and advice specific to your farm's location"),
            symbolName: "location.circle",
            primaryTitle: loading
                ? fcuiLabel("location_fetching", "Getting your location…")
                : fcuiLabel("location_share_cta", "Share location"),
            secondaryTitle: fcuiLabel("skip", "Skip")
        )
        message.primaryButton.isEnabled = !loading
        message.primaryButton.addAction(UIAction { [weak self] _ in self?.manager.shareLocationTapped() }, for: .touchUpInside)
        message.secondaryButton.addAction(UIAction { [weak self] _ in self?.manager.skipTapped() }, for: .touchUpInside)
        mount(message)
    }

    private func showError(_ type: LocationErrorType) {
        let title: String
        let subtitle: String
        switch type {
        case .noNetwork:
            title = fcuiLabel("no_internet_title", "No internet connection")
            subtitle = fcuiLabel("no_internet_message", "You appear to be offline. Check your connection and try again.")
        case .gpsUnavailable:
            title = fcuiLabel("location_gps_unavailable_title", "Location is turned off")
            subtitle = fcuiLabel("location_gps_unavailable_message", "Turn on Location Services to share your farm's location.")
        case .locationFailed:
            title = fcuiLabel("location_failed_title", "Couldn't get your location")
            subtitle = fcuiLabel("location_failed_message", "We couldn't find your location. Please try again.")
        }
        let message = FCUIFullScreenMessageView(
            title: title, subtitle: subtitle, symbolName: "sun.max",
            primaryTitle: fcuiLabel("try_again", "Try again"),
            secondaryTitle: fcuiLabel("skip", "Skip")
        )
        message.primaryButton.addAction(UIAction { [weak self] _ in self?.manager.shareLocationTapped() }, for: .touchUpInside)
        message.secondaryButton.addAction(UIAction { [weak self] _ in self?.manager.dismissError() }, for: .touchUpInside)
        mount(message)
    }

    private func showRecovery() {
        let dim = UIView()
        dim.backgroundColor = UIColor.black.withAlphaComponent(0.4)
        dim.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(dismissRecovery)))

        let sheet = UIView()
        sheet.backgroundColor = FCUITheme.surfacePrimary
        sheet.layer.cornerRadius = 24
        sheet.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        sheet.translatesAutoresizingMaskIntoConstraints = false

        let icon = UIImageView(image: UIImage(systemName: "location.slash"))
        icon.tintColor = FCUITheme.foregroundSecondary
        icon.contentMode = .scaleAspectFit
        icon.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 36, weight: .regular)
        let title = UILabel()
        title.text = fcuiLabel("location_recovery_title", "We need your location")
        title.font = .systemFont(ofSize: 20, weight: .bold)
        title.textColor = FCUITheme.foregroundPrimary
        title.textAlignment = .center
        title.numberOfLines = 0
        let body = UILabel()
        body.text = fcuiLabel("location_recovery_message", "Location access is turned off. Turn it on in Settings to get local advice.")
        body.font = .systemFont(ofSize: 15)
        body.textColor = FCUITheme.foregroundSecondary
        body.textAlignment = .center
        body.numberOfLines = 0
        let settings = FCUIPrimaryButton(title: fcuiLabel("location_open_settings", "Turn on in settings"))
        settings.addAction(UIAction { [weak self] _ in
            self?.manager.recoveryConfirmed()
            if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
        }, for: .touchUpInside)
        let cancel = UIButton(type: .system)
        cancel.setTitle(fcuiLabel("cancel", "Cancel"), for: .normal)
        cancel.setTitleColor(FCUITheme.foregroundSecondary, for: .normal)
        cancel.addAction(UIAction { [weak self] _ in self?.manager.dismissError() }, for: .touchUpInside)

        let sheetStack = UIStackView(arrangedSubviews: [icon, title, body, settings, cancel])
        sheetStack.axis = .vertical
        sheetStack.spacing = 14
        sheetStack.alignment = .fill
        sheetStack.isLayoutMarginsRelativeArrangement = true
        sheetStack.layoutMargins = UIEdgeInsets(top: 24, left: 20, bottom: 28, right: 20)
        sheetStack.translatesAutoresizingMaskIntoConstraints = false
        sheet.addSubview(sheetStack)

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
            sheetStack.topAnchor.constraint(equalTo: sheet.topAnchor),
            sheetStack.leadingAnchor.constraint(equalTo: sheet.leadingAnchor),
            sheetStack.trailingAnchor.constraint(equalTo: sheet.trailingAnchor),
            sheetStack.bottomAnchor.constraint(equalTo: sheet.safeAreaLayoutGuide.bottomAnchor)
        ])
        mount(container)
    }

    @objc private func dismissRecovery() { manager.dismissError() }
}
#endif
