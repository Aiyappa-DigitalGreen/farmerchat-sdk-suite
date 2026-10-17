#if canImport(UIKit)
import UIKit
import Combine
import FarmerChatCore

/// Native UIKit Auth: phone entry (country picker + WhatsApp/SMS buttons)
/// and OTP entry (.oneTimeCode text field, 180 s countdown, resend/start-over).
final class FCUIAuthViewController: UIViewController {
    private var appBar: FCUIAppBar!
    private let viewModel = AuthViewModel()
    private var cancellables = Set<AnyCancellable>()
    private let onSuccess: () -> Void

    // Phone step
    private let phoneStack = UIStackView()
    private let countryButton = UIButton(type: .system)
    private let phoneField = UITextField()
    private let whatsappButton: FCUIPrimaryButton
    private let smsButton: FCUIPrimaryButton

    // OTP step
    private let otpStack = UIStackView()
    private let otpTitle = UILabel()
    private let otpField = UITextField()
    private let verifyButton: FCUIPrimaryButton
    private let timerLabel = UILabel()
    private let resendButton = UIButton(type: .system)
    private let startOverButton = UIButton(type: .system)

    init(onSuccess: @escaping () -> Void) {
        self.onSuccess = onSuccess
        self.whatsappButton = FCUIPrimaryButton(title: "Get code on WhatsApp")
        self.smsButton = FCUIPrimaryButton(title: "Get code by SMS")
        self.verifyButton = FCUIPrimaryButton(title: "Verify")
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = FCUITheme.surfacePrimary
        // AuthScreen.kt:426 — DefaultAppBar "Sign up" with a round close tile, both steps.
        appBar = fcuiInstallAppBar(title: fcuiLabel(FCLabels.signUp, "Sign up"), leading: .close) { [weak self] in
            self?.fcuiGoBack()
        }

        whatsappButton.setTitle(fcuiLabel("send_code_whatsapp", "Get code on WhatsApp"), for: .normal)
        smsButton.setTitle(fcuiLabel("send_code_sms", "Get code by SMS"), for: .normal)
        verifyButton.setTitle(fcuiLabel(FCLabels.verify, "Verify"), for: .normal)

        buildPhoneStep()
        buildOtpStep()
        bind()

        viewModel.trackVerificationStarted()
        viewModel.fetchCountries()
        FarmerChat.shared.analytics.screenViewed(ScreenNames.auth)
    }

    private func buildPhoneStep() {
        countryButton.setTitle("+91", for: .normal)
        countryButton.titleLabel?.font = FCUITypography.current.bodyMedium.font
        countryButton.setTitleColor(FCUITheme.foregroundPrimary, for: .normal)
        countryButton.backgroundColor = FCUITheme.surfaceSecondary
        countryButton.layer.cornerRadius = 14
        countryButton.layer.cornerCurve = .continuous
        countryButton.contentEdgeInsets = UIEdgeInsets(top: 0, left: 14, bottom: 0, right: 14)
        countryButton.addAction(UIAction { [weak self] _ in self?.showCountryPicker() }, for: .touchUpInside)

        phoneField.placeholder = fcuiLabel("phone_placeholder", "Phone number")
        phoneField.keyboardType = .phonePad
        phoneField.textContentType = .telephoneNumber
        phoneField.borderStyle = .roundedRect
        phoneField.backgroundColor = FCUITheme.surfaceSecondary
        phoneField.font = FCUITypography.current.bodyMedium.font
        phoneField.addAction(UIAction { [weak self] _ in
            self?.viewModel.setPhoneLocal(self?.phoneField.text ?? "")
            self?.refreshButtons()
        }, for: .editingChanged)

        let row = UIStackView(arrangedSubviews: [countryButton, phoneField])
        row.axis = .horizontal
        row.spacing = 10
        countryButton.heightAnchor.constraint(equalToConstant: 54).isActive = true
        phoneField.heightAnchor.constraint(equalToConstant: 54).isActive = true

        phoneStack.axis = .vertical
        phoneStack.spacing = 12
        phoneStack.addArrangedSubview(row)
        phoneStack.addArrangedSubview(whatsappButton)
        phoneStack.addArrangedSubview(smsButton)
        phoneStack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(phoneStack)
        NSLayoutConstraint.activate([
            phoneStack.topAnchor.constraint(equalTo: appBar.bottomAnchor, constant: 24),
            phoneStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            phoneStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20)
        ])

        whatsappButton.addAction(UIAction { [weak self] _ in self?.viewModel.sendOtp(channel: "whatsapp") }, for: .touchUpInside)
        smsButton.addAction(UIAction { [weak self] _ in self?.viewModel.sendOtp(channel: "sms") }, for: .touchUpInside)
        phoneField.becomeFirstResponder()
    }

    private func buildOtpStep() {
        otpTitle.font = FCUITypography.current.bodyMedium.font
        otpTitle.textColor = FCUITheme.foregroundSecondary
        otpTitle.numberOfLines = 0

        otpField.placeholder = "••••"
        otpField.keyboardType = .numberPad
        otpField.textContentType = .oneTimeCode
        otpField.font = .monospacedDigitSystemFont(ofSize: 28, weight: .semibold)
        otpField.textAlignment = .center
        otpField.borderStyle = .roundedRect
        otpField.backgroundColor = FCUITheme.surfaceSecondary
        otpField.heightAnchor.constraint(equalToConstant: 64).isActive = true
        otpField.addAction(UIAction { [weak self] _ in
            self?.viewModel.setOtp(self?.otpField.text ?? "")
            self?.otpField.text = self?.viewModel.state.otp
            self?.verifyButton.isEnabled = self?.viewModel.state.otp.count == AuthViewModel.otpLength
        }, for: .editingChanged)

        timerLabel.font = FCUITypography.current.bodySmall.font
        timerLabel.textColor = FCUITheme.foregroundSecondary
        timerLabel.textAlignment = .center

        resendButton.setTitle(fcuiLabel(FCLabels.resendCode, "Resend code"), for: .normal)
        resendButton.setTitleColor(FCUITheme.brandSurfacePrimary, for: .normal)
        resendButton.addAction(UIAction { [weak self] _ in self?.viewModel.resendOtp() }, for: .touchUpInside)

        startOverButton.setTitle(fcuiLabel(FCLabels.startOver, "Start over"), for: .normal)
        startOverButton.setTitleColor(FCUITheme.brandSurfacePrimary, for: .normal)
        startOverButton.addAction(UIAction { [weak self] _ in self?.viewModel.startOver() }, for: .touchUpInside)

        let resendRow = UIStackView(arrangedSubviews: [resendButton, startOverButton])
        resendRow.axis = .horizontal
        resendRow.spacing = 24
        resendRow.distribution = .fillEqually

        otpStack.axis = .vertical
        otpStack.spacing = 14
        otpStack.isHidden = true
        [otpTitle, otpField, verifyButton, timerLabel, resendRow].forEach(otpStack.addArrangedSubview)
        otpStack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(otpStack)
        NSLayoutConstraint.activate([
            otpStack.topAnchor.constraint(equalTo: appBar.bottomAnchor, constant: 24),
            otpStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            otpStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20)
        ])

        verifyButton.isEnabled = false
        verifyButton.addAction(UIAction { [weak self] _ in self?.viewModel.verifyOtp() }, for: .touchUpInside)
    }

    private func bind() {
        viewModel.$state
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in self?.render(state) }
            .store(in: &cancellables)
    }

    private func render(_ state: AuthState) {
        // Step switching.
        phoneStack.isHidden = state.step != .phoneEntry
        otpStack.isHidden = state.step != .otpEntry

        // Phone step widgets.
        let flag = state.selectedCountry?.flagText ?? ""
        countryButton.setTitle("\(flag) \(state.countryCode)".trimmingCharacters(in: .whitespaces), for: .normal)
        whatsappButton.isHidden = !state.availableChannels.whatsappEnabled
        smsButton.isHidden = !state.availableChannels.smsEnabled
        whatsappButton.isLoading = state.sendOtpState.isLoading && state.lastChannel == "whatsapp"
        smsButton.isLoading = state.sendOtpState.isLoading && state.lastChannel == "sms"
        refreshButtons()

        // OTP step widgets.
        otpTitle.text = fcuiLabel("otp_subtitle", "Sent to {phone}", params: ["phone": viewModel.phoneE164])
        verifyButton.isLoading = state.verifyOtpState.isLoading
        if state.otpSecondsRemaining > 0 {
            timerLabel.text = fcuiLabel(
                "otp_resend_in",
                "Resend code in {time}",
                params: ["time": String(format: "%d:%02d", state.otpSecondsRemaining / 60, state.otpSecondsRemaining % 60)]
            )
            timerLabel.isHidden = false
            resendButton.isHidden = true
            startOverButton.isHidden = true
        } else if state.step == .otpEntry {
            timerLabel.isHidden = true
            resendButton.isHidden = false
            startOverButton.isHidden = false
        }
        if state.step == .otpEntry, otpField.window != nil, !otpField.isFirstResponder {
            otpField.becomeFirstResponder()
        }

        if let toast = state.toast {
            showToast(toast.message)
            viewModel.consumeToast()
        }
        if let otpError = state.otpError, !otpError.isEmpty {
            // Error rendered inline as the timer label slot.
            timerLabel.text = otpError
            timerLabel.textColor = FCUITheme.red500
            timerLabel.isHidden = false
        } else {
            timerLabel.textColor = FCUITheme.foregroundSecondary
        }

        if state.verifyOtpState.isSuccess {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
                self?.onSuccess()
            }
        }
    }

    private func refreshButtons() {
        let valid = viewModel.isPhoneValid()
        whatsappButton.isEnabled = valid && !viewModel.state.sendOtpState.isLoading
        smsButton.isEnabled = valid && !viewModel.state.sendOtpState.isLoading
    }

    private func showCountryPicker() {
        let picker = FCUICountryPickerViewController(
            countries: viewModel.state.countries,
            selected: viewModel.state.selectedCountry
        ) { [weak self] country in
            self?.viewModel.selectCountry(country)
        }
        present(UINavigationController(rootViewController: picker), animated: true)
    }
}

// MARK: - Country picker (search + list)

final class FCUICountryPickerViewController: FCUITableScreen, UISearchBarDelegate {
    private let countries: [CountryItem]
    private var filtered: [CountryItem]
    private let selected: CountryItem?
    private let onSelect: (CountryItem) -> Void

    init(countries: [CountryItem], selected: CountryItem?, onSelect: @escaping (CountryItem) -> Void) {
        self.countries = countries
        self.filtered = countries
        self.selected = selected
        self.onSelect = onSelect
        super.init(style: .insetGrouped)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func appBarLeading() -> (FCUIAppBarLeading, () -> Void)? {
        (.close, { [weak self] in self?.dismiss(animated: true) })
    }

    override func viewDidLoad() {
        // AuthScreen.kt:710 — DefaultAppBar "Select country code", round close tile; the search
        // field sits in the content, not in a system navigation bar.
        title = fcuiLabel(FCLabels.selectCountryCode, "Select country code")
        super.viewDidLoad()
        let search = UISearchBar()
        search.searchBarStyle = .minimal
        search.delegate = self
        search.sizeToFit()
        tableView.tableHeaderView = search
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "cell")
    }

    func searchBar(_ searchBar: UISearchBar, textDidChange searchText: String) {
        let query = searchText.lowercased()
        filtered = query.isEmpty ? countries : countries.filter { country in
            (country.displayName ?? "").lowercased().contains(query)
                || (country.name ?? "").lowercased().contains(query)
                || (country.phoneCountryCode ?? "").contains(query)
        }
        tableView.reloadData()
    }

    override func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        filtered.count
    }

    override func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "cell", for: indexPath)
        let country = filtered[indexPath.row]
        let code = country.phoneCountryCode.map { $0.hasPrefix("+") ? $0 : "+\($0)" } ?? ""
        cell.textLabel?.text = "\(country.flagText ?? "") \(country.displayName ?? country.name ?? "")  \(code)"
        cell.accessoryType = selected == country ? .checkmark : .none
        cell.tintColor = FCUITheme.green500
        return cell
    }

    override func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        onSelect(filtered[indexPath.row])
        dismiss(animated: true)
    }
}

// MARK: - AccountBenefits + AccountSuccess (full-screen messages)

final class FCUIAccountBenefitsViewController: UIViewController {
    private let onSignUp: () -> Void

    init(onSignUp: @escaping () -> Void) {
        self.onSignUp = onSignUp
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        // AppNavGraph.kt:760-830: bar "Sign up" with a round ArrowBack and a round "Skip"; the
        // farmer looking at the camera; a chevron "Sign up with phone number".
        let message = FCUIFullScreenMessageView(
            barTitle: fcuiLabel(FCLabels.signUp, "Sign up"),
            mainMessage: fcuiLabel(FCLabels.saveYourQuestionsAnswers, "Save your questions\nand answers"),
            subtitle: fcuiLabel(FCLabels.wellSaveYourChatsYouContinue, "We'll save your chats so you can continue later."),
            subtitleLarge: true,
            illustration: .lookingAtCamera,
            fallbackSymbol: "person.crop.square.badge.camera",
            primaryTitle: fcuiLabel(FCLabels.signUpPhoneNumber, "Sign up with phone number"),
            primaryChevron: true,
            leading: .back,
            onLeading: { [weak self] in self?.navigationController?.popViewController(animated: true) },
            rightLabel: fcuiLabel(FCLabels.skip, "Skip"),
            onRight: { [weak self] in self?.navigationController?.popViewController(animated: true) },
            roundedBarActions: true
        )
        message.frame = view.bounds
        message.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(message)
        message.primaryButton.addAction(UIAction { [weak self] _ in self?.onSignUp() }, for: .touchUpInside)
        FarmerChat.shared.analytics.screenViewed(ScreenNames.accountBenefits)
    }
}

final class FCUIAccountSuccessViewController: UIViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        // AccountSuccessScreen.kt:56-85.
        let message = FCUIFullScreenMessageView(
            barTitle: fcuiLabel(FCLabels.signUp, "Sign up"),
            mainMessage: fcuiLabel(FCLabels.youreAllSet, "You're all set!"),
            subtitle: fcuiLabel(FCLabels.previousQuestionsMenu, "Find your previous questions in the menu and continue anytime."),
            subtitleLarge: true,
            illustration: .lookingAtSky,
            fallbackSymbol: "sun.max",
            primaryTitle: fcuiLabel(FCLabels.continue, "Continue"),
            primaryChevron: false,
            leading: nil, onLeading: nil, rightLabel: nil, onRight: nil,
            roundedBarActions: false
        )
        message.frame = view.bounds
        message.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(message)
        message.primaryButton.addAction(UIAction { [weak self] _ in
            FarmerChat.shared.analytics.track(AnalyticsEvents.signupContinueClicked)
            self?.navigationController?.popToRootViewController(animated: true)
        }, for: .touchUpInside)
        navigationItem.hidesBackButton = true
        FarmerChat.shared.analytics.screenViewed(ScreenNames.accountSuccess)
    }
}
#endif
