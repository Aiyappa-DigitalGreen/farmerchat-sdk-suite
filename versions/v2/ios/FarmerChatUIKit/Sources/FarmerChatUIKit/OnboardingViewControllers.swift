#if canImport(UIKit)
import UIKit
import Combine
import FarmerChatCore

// MARK: - Language selection / chooser (native UIKit, table-based)

final class FCUILanguageViewController: UIViewController, UITableViewDataSource, UITableViewDelegate {
    enum Mode {
        case onboarding
        case settings
    }

    private let mode: Mode
    private let onboardingVM = OnboardingViewModel()
    private let settingsVM = SettingsViewModel()
    private var cancellables = Set<AnyCancellable>()

    private let tableView = UITableView(frame: .zero, style: .insetGrouped)
    private let saveButton: FCUIPrimaryButton
    private let spinner = UIActivityIndicatorView(style: .large)

    init(mode: Mode) {
        self.mode = mode
        self.saveButton = FCUIPrimaryButton(
            title: mode == .onboarding ? "Start using FarmerChat" : "Save language"
        )
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = FCUITheme.surfacePrimary
        title = fcuiLabel("choose_language_title", "Choose your language")
        saveButton.setTitle(
            mode == .onboarding
                ? fcuiLabel("start_using", "Start using FarmerChat")
                : fcuiLabel("save_language", "Save language"),
            for: .normal
        )

        navigationController?.setNavigationBarHidden(false, animated: false)
        if mode == .settings {
            navigationItem.leftBarButtonItem = UIBarButtonItem(
                image: UIImage(systemName: "chevron.left"),
                primaryAction: UIAction { [weak self] _ in self?.navigationController?.popViewController(animated: true) }
            )
        }

        tableView.dataSource = self
        tableView.delegate = self
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "cell")
        tableView.translatesAutoresizingMaskIntoConstraints = false
        saveButton.isEnabled = false
        spinner.hidesWhenStopped = true
        spinner.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(tableView)
        view.addSubview(saveButton)
        view.addSubview(spinner)
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: saveButton.topAnchor, constant: -8),
            saveButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            saveButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            saveButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -12),
            spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])

        saveButton.addAction(UIAction { [weak self] _ in self?.save() }, for: .touchUpInside)
        bind()
        load()
        FarmerChat.shared.analytics.screenViewed(
            mode == .onboarding ? ScreenNames.language : ScreenNames.languageChooser
        )
    }

    private func bind() {
        if mode == .onboarding {
            onboardingVM.$state
                .receive(on: DispatchQueue.main)
                .sink { [weak self] state in self?.render(onboarding: state) }
                .store(in: &cancellables)
        } else {
            settingsVM.$state
                .receive(on: DispatchQueue.main)
                .sink { [weak self] state in self?.render(settings: state) }
                .store(in: &cancellables)
        }
    }

    private func load() {
        spinner.startAnimating()
        if mode == .onboarding {
            onboardingVM.onAction(.fetchLegalLinks)
            Task { await onboardingVM.bootstrapLanguages() }
        } else {
            settingsVM.loadLanguages()
        }
    }

    private func render(onboarding state: OnboardingState) {
        spinner.stopAnimating()
        if state.languageState.isLoading || state.languageState.value == nil {
            spinner.startAnimating()
        }
        saveButton.isEnabled = state.selectedLanguageId != nil && state.languageState.isSuccess
        saveButton.isLoading = state.isSubmittingLanguage
        tableView.reloadData()
        if state.languageSubmitSuccess {
            onboardingVM.onAction(.consumeLanguageResult)
            (navigationController as? FarmerChatViewController)?.routeFromSplash()
        }
    }

    private func render(settings state: LanguageSettingsState) {
        spinner.stopAnimating()
        if state.languageState.isLoading || state.languageState.value == nil {
            spinner.startAnimating()
        }
        saveButton.isEnabled = state.selectedLanguageId != nil && !state.isFetchingLabels
        saveButton.isLoading = state.isSubmittingLanguage
        tableView.reloadData()
        if state.languageSubmitSuccess {
            settingsVM.consumeLanguageResult()
            navigationController?.popToRootViewController(animated: true)
        }
    }

    private func save() {
        if mode == .onboarding {
            onboardingVM.onAction(.acceptTerms)
            onboardingVM.onAction(.getStartedClicked)
        } else {
            settingsVM.submitLanguage()
        }
    }

    // MARK: Table

    private var languages: [SupportedLanguage] {
        mode == .onboarding ? onboardingVM.state.visibleLanguages() : settingsVM.state.visibleLanguages()
    }

    private var hasExpandRow: Bool {
        if mode == .onboarding {
            return !onboardingVM.state.expandedLanguages && onboardingVM.state.hasExpandableLanguages()
        }
        return !settingsVM.state.expandedLanguages && settingsVM.state.hasExpandableLanguages()
    }

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        languages.count + (hasExpandRow ? 1 : 0)
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "cell", for: indexPath)
        cell.backgroundColor = FCUITheme.surfaceSecondary
        if indexPath.row >= languages.count {
            cell.textLabel?.text = fcuiLabel("all_languages", "All languages")
            cell.textLabel?.textColor = FCUITheme.brandSurfacePrimary
            cell.accessoryType = .disclosureIndicator
            return cell
        }
        let language = languages[indexPath.row]
        cell.textLabel?.text = language.displayName ?? language.name
        cell.textLabel?.textColor = FCUITheme.foregroundPrimary
        let selectedId = mode == .onboarding ? onboardingVM.state.selectedLanguageId : settingsVM.state.selectedLanguageId
        cell.accessoryType = selectedId == language.id ? .checkmark : .none
        cell.tintColor = FCUITheme.green500
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        if indexPath.row >= languages.count {
            if mode == .onboarding {
                onboardingVM.toggleExpandedLanguages()
            } else {
                settingsVM.toggleExpandedLanguages()
            }
            tableView.reloadData()
            return
        }
        let language = languages[indexPath.row]
        if mode == .onboarding {
            onboardingVM.onAction(.selectLanguage(languageId: language.id))
        } else {
            settingsVM.selectLanguage(id: language.id, code: language.code)
        }
    }
}

// MARK: - Enter name (onboarding + settings editor)

final class FCUINameViewController: UIViewController {
    enum Mode {
        case onboarding
        case settings
    }

    private let mode: Mode
    private let viewModel = EnterNameViewModel()
    private var cancellables = Set<AnyCancellable>()

    private let titleLabel = UILabel()
    private let textField = UITextField()
    private let saveButton: FCUIPrimaryButton
    private let skipButton = UIButton(type: .system)

    init(mode: Mode) {
        self.mode = mode
        self.saveButton = FCUIPrimaryButton(title: "Save name")
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = FCUITheme.surfacePrimary
        navigationController?.setNavigationBarHidden(mode == .onboarding, animated: false)
        saveButton.setTitle(fcuiLabel("save_name", "Save name"), for: .normal)

        titleLabel.text = mode == .onboarding
            ? fcuiLabel("enter_name_title", "What should we call you?")
            : fcuiLabel("settings_name_title", "Name")
        titleLabel.font = .systemFont(ofSize: 28, weight: .bold)
        titleLabel.textColor = FCUITheme.foregroundPrimary
        titleLabel.numberOfLines = 0

        textField.placeholder = fcuiLabel("enter_name_placeholder", "Your name")
        textField.borderStyle = .roundedRect
        textField.backgroundColor = FCUITheme.surfaceSecondary
        textField.font = .systemFont(ofSize: 17)
        textField.text = NameInputNormalizer.sanitizeStored(FarmerChat.shared.prefs.string(.userName))
        textField.addAction(UIAction { [weak self] _ in self?.textChanged() }, for: .editingChanged)

        skipButton.setTitle(fcuiLabel("skip_for_now", "Skip for now"), for: .normal)
        skipButton.setTitleColor(FCUITheme.foregroundSecondary, for: .normal)
        skipButton.isHidden = mode == .settings

        let stack = UIStackView(arrangedSubviews: [titleLabel, textField, saveButton, skipButton])
        stack.axis = .vertical
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 32),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            textField.heightAnchor.constraint(equalToConstant: 54)
        ])

        saveButton.addAction(UIAction { [weak self] _ in self?.save() }, for: .touchUpInside)
        skipButton.addAction(UIAction { [weak self] _ in self?.skip() }, for: .touchUpInside)

        viewModel.$state
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in self?.render(state) }
            .store(in: &cancellables)

        textChanged()
        textField.becomeFirstResponder()
        FarmerChat.shared.analytics.screenViewed(
            mode == .onboarding ? ScreenNames.enterName : ScreenNames.settingsName
        )
    }

    private func textChanged() {
        let normalized = NameInputNormalizer.normalize(textField.text ?? "")
        if normalized != textField.text { textField.text = normalized }
        saveButton.isEnabled = !normalized.trimmingCharacters(in: .whitespaces).isEmpty
        skipButton.isHidden = mode == .settings || !normalized.isEmpty
    }

    private func render(_ state: UpdateUserNameState) {
        saveButton.isLoading = state.updateUserNameState.isLoading
        switch state.updateUserNameState {
        case .success:
            viewModel.markNameDone()
            viewModel.onAction(.consumeUpdateResult, screenName: screenName)
            if mode == .onboarding {
                (navigationController as? FarmerChatViewController)?.routeFromSplash()
            } else {
                navigationController?.popViewController(animated: true)
            }
        case .error(let message, _, _):
            viewModel.onAction(.consumeUpdateResult, screenName: screenName)
            showToast(message)
        default:
            break
        }
    }

    private var screenName: String {
        mode == .onboarding ? ScreenNames.enterName : ScreenNames.settings
    }

    private func save() {
        let name = (textField.text ?? "").trimmingCharacters(in: .whitespaces)
        if let validation = NameInputNormalizer.validationError(for: name, labels: FarmerChat.shared.labels) {
            showToast(validation)
            return
        }
        guard let userId = FarmerChat.shared.session.userId else { return }
        viewModel.onAction(
            .updateUserName(body: UserNameRequest(userId: userId, name: name)),
            screenName: screenName
        )
    }

    private func skip() {
        viewModel.skipName()
        (navigationController as? FarmerChatViewController)?.routeFromSplash()
    }
}

// MARK: - Toast helper

extension UIViewController {
    @MainActor
    func showToast(_ message: String) {
        let label = UIPaddedLabel()
        label.text = message
        label.font = .systemFont(ofSize: 14, weight: .medium)
        label.textColor = FCUITheme.foregroundPrimary
        label.backgroundColor = FCUITheme.surfaceSecondary
        label.textAlignment = .center
        label.numberOfLines = 3
        label.layer.cornerRadius = 20
        label.layer.masksToBounds = true
        label.layer.shadowOpacity = 0.15
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -32),
            label.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 24),
            label.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -24)
        ])
        label.alpha = 0
        UIView.animate(withDuration: 0.25) { label.alpha = 1 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
            UIView.animate(withDuration: 0.25, animations: { label.alpha = 0 }) { _ in
                label.removeFromSuperview()
            }
        }
    }
}

final class UIPaddedLabel: UILabel {
    override func drawText(in rect: CGRect) {
        super.drawText(in: rect.insetBy(dx: 16, dy: 10))
    }

    override var intrinsicContentSize: CGSize {
        let size = super.intrinsicContentSize
        return CGSize(width: size.width + 32, height: size.height + 20)
    }
}
#endif
