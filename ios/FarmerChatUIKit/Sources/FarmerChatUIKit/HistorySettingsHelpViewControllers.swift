#if canImport(UIKit)
import UIKit
import Combine
import SafariServices
import FarmerChatCore

// MARK: - Chat history (grouped table, paginated)

final class FCUIChatHistoryViewController: UITableViewController {
    private let viewModel = ChatHistoryViewModel()
    private var cancellables = Set<AnyCancellable>()
    private var rows: [ChatHistoryRow] = []
    private let spinner = UIActivityIndicatorView(style: .large)

    init() {
        super.init(style: .insetGrouped)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = fcuiLabel("chat_history_title", "Recent Chats")
        navigationController?.setNavigationBarHidden(false, animated: false)
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "cell")
        tableView.backgroundView = spinner
        spinner.hidesWhenStopped = true

        viewModel.$state
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in self?.render(state) }
            .store(in: &cancellables)

        FarmerChat.shared.analytics.screenViewed(ScreenNames.chatHistory)
        viewModel.refresh()
    }

    private func render(_ state: ChatHistoryUiState) {
        rows = state.items
        if state.isLoading && rows.isEmpty {
            spinner.startAnimating()
        } else {
            spinner.stopAnimating()
        }
        tableView.reloadData()
        if state.errorMessage != nil, rows.isEmpty {
            // Centralized error route (per-fromScreen retry), not an ad-hoc VC.
            let nav = navigationController as? FarmerChatViewController
            nav?.errorNavigation.setActiveScreen("chatHistory")
            nav?.errorNavigation.navigateToError(
                isNetworkError: state.isNetworkError,
                fromScreen: "chatHistory",
                retry: { [weak self] in self?.viewModel.refresh() }
            )
        }
    }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        rows.count + (viewModel.state.paginationError ? 1 : 0)
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "cell", for: indexPath)
        guard indexPath.row < rows.count else {
            cell.textLabel?.text = fcuiLabel("try_again", "Try again")
            cell.textLabel?.textColor = FCUITheme.brandSurfacePrimary
            cell.imageView?.image = UIImage(systemName: "arrow.clockwise")
            return cell
        }
        switch rows[indexPath.row] {
        case .header(let title):
            cell.textLabel?.text = title.uppercased()
            cell.textLabel?.font = .systemFont(ofSize: 13, weight: .semibold)
            cell.textLabel?.textColor = FCUITheme.foregroundSecondary
            cell.imageView?.image = nil
            cell.selectionStyle = .none
        case .item(let item):
            cell.textLabel?.text = item.title
            cell.textLabel?.font = .systemFont(ofSize: 16)
            cell.textLabel?.textColor = FCUITheme.foregroundPrimary
            cell.textLabel?.numberOfLines = 2
            cell.imageView?.image = UIImage(systemName: iconName(item.messageType))
            cell.imageView?.tintColor = FCUITheme.foregroundSecondary
            cell.accessoryType = .disclosureIndicator
            cell.selectionStyle = .default
        }
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        guard indexPath.row < rows.count else {
            viewModel.retryPagination()
            return
        }
        guard case .item(let item) = rows[indexPath.row], let conversationId = item.conversationId else { return }
        FarmerChat.shared.analytics.track(AnalyticsEvents.newChatClickEvent, props: ["conversation_id": conversationId])
        navigationController?.pushViewController(
            FCUIChatViewController(args: FCUIChatArgs(source: "history", conversationId: conversationId)),
            animated: true
        )
    }

    override func tableView(_ tableView: UITableView, willDisplay cell: UITableViewCell, forRowAt indexPath: IndexPath) {
        if indexPath.row >= rows.count - 2 {
            viewModel.loadNextPage()
        }
    }

    private func iconName(_ messageType: String?) -> String {
        switch ChatHistoryViewModel.inputType(from: messageType) {
        case .camera: return "camera"
        case .mic: return "mic"
        case .keyboard: return "keyboard"
        case .card: return "rectangle.on.rectangle"
        }
    }
}

// MARK: - Settings (appearance + name + logout/sign-up)

final class FCUISettingsViewController: UITableViewController {
    private let settingsVM = SettingsViewModel()
    private var cancellables = Set<AnyCancellable>()

    init() {
        super.init(style: .insetGrouped)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = fcuiLabel("settings_title", "Settings")
        navigationController?.setNavigationBarHidden(false, animated: false)
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "cell")
        FarmerChat.shared.analytics.screenViewed(ScreenNames.settings)

        settingsVM.$appearanceMode
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.tableView.reloadData() }
            .store(in: &cancellables)
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        tableView.reloadData()
    }

    override func numberOfSections(in tableView: UITableView) -> Int { 3 }

    override func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        switch section {
        case 0: return fcuiLabel("settings_appearance", "Appearance")
        case 1: return fcuiLabel("settings_account", "Account details")
        default: return nil
        }
    }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        section == 0 ? 3 : 1
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "cell", for: indexPath)
        cell.tintColor = FCUITheme.green500
        switch indexPath.section {
        case 0:
            let modes: [(FarmerChatAppearance, String, String)] = [
                (.day, fcuiLabel("appearance_day", "Day"), "sun.max.fill"),
                (.night, fcuiLabel("appearance_night", "Night"), "moon.fill"),
                (.auto, fcuiLabel("appearance_auto", "Auto"), "circle.lefthalf.filled")
            ]
            let (mode, label, icon) = modes[indexPath.row]
            cell.textLabel?.text = label
            cell.imageView?.image = UIImage(systemName: icon)
            cell.imageView?.tintColor = FCUITheme.foregroundSecondary
            cell.accessoryType = settingsVM.appearanceMode == mode ? .checkmark : .none
        case 1:
            cell.textLabel?.text = fcuiLabel("settings_your_name", "Your name")
            let name = settingsVM.userName
            cell.detailTextLabel?.text = name
            cell.imageView?.image = UIImage(systemName: "person.fill")
            cell.imageView?.tintColor = FCUITheme.foregroundSecondary
            cell.accessoryType = .disclosureIndicator
        default:
            let isAuthenticated = FarmerChat.shared.isAuthenticated
            cell.textLabel?.text = isAuthenticated
                ? fcuiLabel("logout", "Log out")
                : fcuiLabel("sign_up", "Sign up")
            cell.textLabel?.textColor = isAuthenticated ? FCUITheme.red500 : FCUITheme.brandSurfacePrimary
            cell.imageView?.image = UIImage(systemName: isAuthenticated ? "rectangle.portrait.and.arrow.right" : "person.crop.circle.badge.plus")
            cell.imageView?.tintColor = cell.textLabel?.textColor
        }
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        switch indexPath.section {
        case 0:
            let modes: [FarmerChatAppearance] = [.day, .night, .auto]
            let mode = modes[indexPath.row]
            settingsVM.setAppearanceMode(mode)
            navigationController?.overrideUserInterfaceStyle = FCUITheme.interfaceStyle(for: mode)
        case 1:
            navigationController?.pushViewController(FCUINameViewController(mode: .settings), animated: true)
        default:
            if FarmerChat.shared.isAuthenticated {
                logout()
            } else {
                signUp()
            }
        }
    }

    private func logout() {
        let confirm = UIAlertController(
            title: fcuiLabel("logout", "Log out"),
            message: fcuiLabel("logout_confirm", "Are you sure you want to log out?"),
            preferredStyle: .alert
        )
        confirm.addAction(UIAlertAction(title: fcuiLabel("logout", "Log out"), style: .destructive) { [weak self] _ in
            Task { @MainActor in
                await FarmerChat.shared.logout()
                (self?.navigationController as? FarmerChatViewController)?.restartFromSplash()
            }
        })
        confirm.addAction(UIAlertAction(title: fcuiLabel("cancel", "Cancel"), style: .cancel))
        present(confirm, animated: true)
    }

    private func signUp() {
        Task { @MainActor in
            let result = await FarmerChat.shared.api.userQuestionCount()
            let bypass = result.value?.bypassInterstitial ?? false
            let pushAuth: () -> Void = { [weak self] in
                let auth = FCUIAuthViewController { [weak self] in
                    var stack = self?.navigationController?.viewControllers ?? []
                    stack.removeAll { $0 is FCUIAuthViewController || $0 is FCUIAccountBenefitsViewController }
                    stack.append(FCUIAccountSuccessViewController())
                    self?.navigationController?.setViewControllers(stack, animated: true)
                }
                self?.navigationController?.pushViewController(auth, animated: true)
            }
            if bypass {
                pushAuth()
            } else {
                let benefits = FCUIAccountBenefitsViewController(onSignUp: pushAuth)
                self.navigationController?.pushViewController(benefits, animated: true)
            }
        }
    }
}

// MARK: - Help (FAQ + legal)

final class FCUIHelpViewController: UITableViewController {
    private let viewModel = HelpViewModel()
    private var cancellables = Set<AnyCancellable>()

    init() {
        super.init(style: .insetGrouped)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = fcuiLabel("help_title", "Help")
        navigationController?.setNavigationBarHidden(false, animated: false)
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "cell")

        viewModel.$helpState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.tableView.reloadData() }
            .store(in: &cancellables)

        FarmerChat.shared.analytics.screenViewed(ScreenNames.help)
        viewModel.load()
    }

    override func numberOfSections(in tableView: UITableView) -> Int { 2 }

    override func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        section == 0
            ? fcuiLabel("help_faq_title", "How to use FarmerChat")
            : fcuiLabel("help_more", "More")
    }

    override func tableView(_ tableView: UITableView, titleForFooterInSection section: Int) -> String? {
        section == 1 ? "FarmerChat SDK \(FarmerChatSDK.version) — © Digital Green" : nil
    }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        section == 0 ? max(viewModel.faqs.count, 1) : 2
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "cell", for: indexPath)
        cell.textLabel?.numberOfLines = 2
        cell.textLabel?.textColor = FCUITheme.foregroundPrimary
        if indexPath.section == 0 {
            if viewModel.faqs.isEmpty {
                cell.textLabel?.text = viewModel.helpState.isLoading
                    ? fcuiLabel("loading", "Loading…")
                    : fcuiLabel("help_empty", "No help topics yet.")
                cell.textLabel?.textColor = FCUITheme.foregroundSecondary
                cell.accessoryType = .none
            } else {
                cell.textLabel?.text = viewModel.faqs[indexPath.row].displayTitle
                cell.imageView?.image = UIImage(systemName: "questionmark.circle")
                cell.imageView?.tintColor = FCUITheme.foregroundSecondary
                cell.accessoryType = .disclosureIndicator
            }
        } else {
            let isTerms = indexPath.row == 0
            cell.textLabel?.text = isTerms
                ? fcuiLabel("terms_of_use", "Terms of use")
                : fcuiLabel("privacy_policy", "Privacy policy")
            cell.imageView?.image = UIImage(systemName: isTerms ? "doc.text" : "lock.shield")
            cell.imageView?.tintColor = FCUITheme.foregroundSecondary
            cell.accessoryType = .disclosureIndicator
        }
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        var urlString: String?
        if indexPath.section == 0, indexPath.row < viewModel.faqs.count {
            urlString = viewModel.faqs[indexPath.row].url
        } else if indexPath.section == 1 {
            urlString = indexPath.row == 0 ? viewModel.legal?.termsOfUse : viewModel.legal?.privacyPolicy
        }
        guard let urlString, let url = URL(string: urlString) else { return }
        present(SFSafariViewController(url: url), animated: true)
    }
}
#endif
