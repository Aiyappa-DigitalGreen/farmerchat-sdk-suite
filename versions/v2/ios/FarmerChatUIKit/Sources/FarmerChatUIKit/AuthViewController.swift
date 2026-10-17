#if canImport(UIKit)
import UIKit
import Combine
import FarmerChatCore

/// Native UIKit Auth: phone entry (country picker + WhatsApp/SMS buttons)
/// and OTP entry (.oneTimeCode text field, 180 s countdown, resend/start-over).
final class FCUIAuthViewController: UIViewController {
    private var appBar: FCUIAppBar!
    /// #4 `url` (AuthViewModel.fetchLegalLinks).
    private var privacyPolicyURL: String?
    private let viewModel = AuthViewModel()
    private var cancellables = Set<AnyCancellable>()
    private let onSuccess: () -> Void

    // Phone step
    private let phoneStack = UIStackView()
    private let countryButton = UIButton(type: .system)
    private let phoneField = UITextField()
    private let phoneTitle = UILabel()
    private let phoneSubtitle = UILabel()
    private let flagView = UIImageView()
    private var flagTask: URLSessionDataTask?
    private var flagURL: URL?
    private let whatsappButton = UIButton(type: .custom)
    private let smsButton = UIButton(type: .custom)
    private let sendingButton: FCUIPrimaryButton

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
        self.sendingButton = FCUIPrimaryButton(title: "Sending code...")
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

        verifyButton.setTitle(fcuiLabel(FCLabels.verify, "Verify"), for: .normal)

        buildPhoneStep()
        buildOtpStep()
        bind()

        viewModel.trackVerificationStarted()
        viewModel.fetchCountries()
        Task { @MainActor [weak self] in
            if case .success(let legal) = await FarmerChat.shared.api.privacyPolicy(),
               let url = legal.privacyPolicy, !url.isEmpty {
                self?.privacyPolicyURL = url
            }
        }
        FarmerChat.shared.analytics.screenViewed(ScreenNames.auth)
    }

    /// AuthScreen.kt PhoneEntryContent: centred titleLarge + bodyMedium heading, the country
    /// selector (flag image + code) beside a 56pt phone field, the AgreementCard, "Send via
    /// WhatsApp" / "Send via SMS" (48pt, leading icon) — or one "Sending code..." while sending —
    /// and the consent line with an underlined Privacy Policy link.
    private func buildPhoneStep() {
        phoneTitle.font = FCUITypography.current.titleLarge.font
        phoneTitle.textColor = FCUITheme.foregroundPrimary
        phoneTitle.textAlignment = .center
        phoneTitle.numberOfLines = 0
        phoneSubtitle.font = FCUITypography.current.bodyMedium.font
        phoneSubtitle.textColor = FCUITheme.foregroundSecondary
        phoneSubtitle.textAlignment = .center
        phoneSubtitle.numberOfLines = 0

        var countryConfig = UIButton.Configuration.plain()
        countryConfig.baseForegroundColor = FCUITheme.foregroundPrimary
        countryConfig.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 40, bottom: 0, trailing: 12)
        countryButton.configuration = countryConfig
        countryButton.backgroundColor = FCUITheme.surfaceSecondary
        countryButton.layer.cornerRadius = 12
        countryButton.layer.cornerCurve = .continuous
        countryButton.layer.borderWidth = 0.5
        countryButton.layer.borderColor = FCUITheme.borderDefault.cgColor
        countryButton.accessibilityIdentifier = "fcAuthCountry"
        countryButton.addAction(UIAction { [weak self] _ in self?.showCountryPicker() }, for: .touchUpInside)
        flagView.contentMode = .scaleAspectFit
        flagView.isUserInteractionEnabled = false
        flagView.translatesAutoresizingMaskIntoConstraints = false
        countryButton.addSubview(flagView)

        phoneField.placeholder = "00000 00000"
        phoneField.keyboardType = .phonePad
        phoneField.textContentType = .telephoneNumber
        phoneField.borderStyle = .none
        phoneField.backgroundColor = FCUITheme.surfaceSecondary
        phoneField.font = FCUITypography.current.bodyMedium.font
        phoneField.layer.cornerRadius = 12
        phoneField.layer.cornerCurve = .continuous
        phoneField.layer.borderWidth = 2
        phoneField.layer.borderColor = FCUITheme.green500.cgColor
        phoneField.leftView = UIView(frame: CGRect(x: 0, y: 0, width: 16, height: 1))
        phoneField.leftViewMode = .always
        phoneField.accessibilityIdentifier = "fcAuthPhone"
        phoneField.addAction(UIAction { [weak self] _ in
            self?.viewModel.setPhoneLocal(self?.phoneField.text ?? "")
            self?.refreshButtons()
        }, for: .editingChanged)

        let row = UIStackView(arrangedSubviews: [countryButton, phoneField])
        row.axis = .horizontal
        row.spacing = 8
        // CountryCodeSelector hugs its content (min 90pt); the phone field takes the rest.
        countryButton.setContentHuggingPriority(.required, for: .horizontal)
        countryButton.setContentCompressionResistancePriority(.required, for: .horizontal)
        phoneField.setContentHuggingPriority(.defaultLow, for: .horizontal)

        configureSend(whatsappButton, title: fcuiLabel(FCLabels.sendViaWhatsapp, "Send via WhatsApp"),
                      icon: "phone.bubble.left.fill", id: "fcAuthSendWhatsapp")
        configureSend(smsButton, title: fcuiLabel(FCLabels.sendViaSms, "Send via SMS"),
                      icon: "message.fill", id: "fcAuthSendSms")
        sendingButton.setTitle(fcuiLabel(FCLabels.sendingCode, "Sending code..."), for: .normal)
        sendingButton.isLoading = true
        sendingButton.isHidden = true

        let consent = UIButton(type: .custom)
        let prefix = fcuiLabel(FCLabels.authConsentPrefix, "By continuing, you agree to these communications.\nSee our ")
        let link = fcuiLabel(FCLabels.privacyPolicy, "Privacy Policy")
        let suffix = " " + fcuiLabel(FCLabels.authConsentSuffix, "for more information, including how to withdraw your consent.")
        let para = NSMutableParagraphStyle()
        para.alignment = .center
        let base: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 15), .foregroundColor: FCUITheme.foregroundSecondary, .paragraphStyle: para]
        let text = NSMutableAttributedString(string: prefix, attributes: base)
        var linkAttrs = base
        linkAttrs[.underlineStyle] = NSUnderlineStyle.single.rawValue
        text.append(NSAttributedString(string: link, attributes: linkAttrs))
        text.append(NSAttributedString(string: suffix, attributes: base))
        consent.setAttributedTitle(text, for: .normal)
        consent.titleLabel?.numberOfLines = 0
        consent.addAction(UIAction { [weak self] _ in
            // AuthScreen.kt:480-492 — the #4 privacy URL; nothing opens while it is unknown.
            guard let string = self?.privacyPolicyURL, let url = URL(string: string) else { return }
            let page = FCUIWebPageViewController(title: link, url: url)
            page.modalPresentationStyle = .fullScreen
            self?.present(page, animated: true)
        }, for: .touchUpInside)

        phoneStack.axis = .vertical
        phoneStack.spacing = 8
        for v in [phoneTitle, phoneSubtitle, row, makeAgreementCard(), sendingButton, whatsappButton, smsButton, consent] {
            phoneStack.addArrangedSubview(v)
        }
        phoneStack.setCustomSpacing(24, after: phoneSubtitle)
        phoneStack.setCustomSpacing(20, after: row)
        phoneStack.setCustomSpacing(12, after: phoneStack.arrangedSubviews[3])
        phoneStack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(phoneStack)
        NSLayoutConstraint.activate([
            phoneStack.topAnchor.constraint(equalTo: appBar.bottomAnchor, constant: 24),
            phoneStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            phoneStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            countryButton.heightAnchor.constraint(equalToConstant: 56),
            countryButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 90),
            phoneField.heightAnchor.constraint(equalToConstant: 56),
            flagView.leadingAnchor.constraint(equalTo: countryButton.leadingAnchor, constant: 12),
            flagView.centerYAnchor.constraint(equalTo: countryButton.centerYAnchor),
            flagView.widthAnchor.constraint(equalToConstant: 22),
            flagView.heightAnchor.constraint(equalToConstant: 16)
        ])

        whatsappButton.addAction(UIAction { [weak self] _ in
            guard let self, self.viewModel.isPhoneValid(), !self.viewModel.state.sendOtpState.isLoading else { return }
            self.viewModel.sendOtp(channel: "whatsapp")
        }, for: .touchUpInside)
        smsButton.addAction(UIAction { [weak self] _ in
            guard let self, self.viewModel.isPhoneValid(), !self.viewModel.state.sendOtpState.isLoading else { return }
            self.viewModel.sendOtp(channel: "sms")
        }, for: .touchUpInside)
        phoneField.becomeFirstResponder()
    }

    /// PrimaryButton with a leading icon, 48pt.
    private func configureSend(_ button: UIButton, title: String, icon: String, id: String) {
        var config = UIButton.Configuration.filled()
        config.baseBackgroundColor = FCUITheme.buttonPrimarySurface
        config.baseForegroundColor = .white
        config.cornerStyle = .fixed
        config.background.cornerRadius = 16
        config.image = UIImage(systemName: icon, withConfiguration: UIImage.SymbolConfiguration(pointSize: 16, weight: .semibold))?
            .withTintColor(FCUITheme.green500, renderingMode: .alwaysOriginal)
        config.imagePadding = 8
        config.attributedTitle = AttributedString(title, attributes: AttributeContainer([.font: FCUITypography.current.titleMedium.font]))
        button.configuration = config
        button.accessibilityIdentifier = id
        button.heightAnchor.constraint(equalToConstant: 48).isActive = true
    }

    /// AuthScreen.kt AgreementCard: Neutral200, radius 16, 18/12 padding; bold 18pt title, two
    /// 15pt bullets, a bold-italic 14pt note, black.
    private func makeAgreementCard() -> UIView {
        let card = UIView()
        card.backgroundColor = UIColor(red: 0xE4 / 255, green: 0xE4 / 255, blue: 0xE7 / 255, alpha: 1)
        card.layer.cornerRadius = 16
        card.layer.cornerCurve = .continuous
        card.accessibilityIdentifier = "fcAuthAgreement"
        let title = UILabel()
        title.text = fcuiLabel(FCLabels.agreementCardTitle, "What you are agreeing to:")
        title.font = .systemFont(ofSize: 18, weight: .bold)
        title.textColor = .black
        title.numberOfLines = 0
        func bullet(_ text: String) -> UIView {
            let dot = UILabel()
            dot.text = "•"
            dot.font = .systemFont(ofSize: 15)
            dot.textColor = .black
            dot.widthAnchor.constraint(equalToConstant: 16).isActive = true
            dot.setContentHuggingPriority(.required, for: .horizontal)
            let label = UILabel()
            label.text = text
            label.font = .systemFont(ofSize: 15)
            label.textColor = .black
            label.numberOfLines = 0
            let row = UIStackView(arrangedSubviews: [dot, label])
            row.alignment = .top
            return row
        }
        let bullets = UIStackView(arrangedSubviews: [
            bullet(fcuiLabel(FCLabels.agreementPointVerificationCode, "A verification code by SMS or WhatsApp")),
            bullet(fcuiLabel(FCLabels.agreementPointUpdates, "FarmerChat updates, farming information, and occasional surveys or research by SMS, phone, or WhatsApp"))
        ])
        bullets.axis = .vertical
        bullets.spacing = 2
        let note = UILabel()
        note.text = fcuiLabel(FCLabels.agreementCardInfoText, "Surveys or research may be conducted by Digital Green or trusted partners working with us.")
        let italicBold = UIFont.systemFont(ofSize: 14, weight: .bold).fontDescriptor.withSymbolicTraits([.traitBold, .traitItalic])
        note.font = italicBold.map { UIFont(descriptor: $0, size: 14) } ?? .italicSystemFont(ofSize: 14)
        note.textColor = .black
        note.numberOfLines = 0
        let stack = UIStackView(arrangedSubviews: [title, bullets, note])
        stack.axis = .vertical
        stack.spacing = 8
        stack.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: card.topAnchor, constant: 12),
            stack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -12),
            stack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 18),
            stack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -18)
        ])
        return card
    }

    private func loadFlag(_ url: URL?) {
        guard url != flagURL else { return }
        flagURL = url
        flagTask?.cancel()
        flagView.image = nil
        guard let url else { return }
        flagTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let data, let image = UIImage(data: data) else { return }
            DispatchQueue.main.async { self?.flagView.image = image }
        }
        flagTask?.resume()
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
        let sending = state.sendOtpState.isLoading
        phoneTitle.text = sending
            ? fcuiLabel(FCLabels.enterPhoneNumber, "Enter phone number")
            : fcuiLabel(FCLabels.enterYourPhoneNumber, "Enter your phone number")
        phoneSubtitle.text = sending
            ? fcuiLabel(FCLabels.sendOtpSigninShort, "And we will send you a one time code")
            : fcuiLabel(FCLabels.sendOtpSignin, "We'll send a one-time code to sign you in")
        let flagText = state.selectedCountry?.flagText.map { $0 + " " } ?? ""
        countryButton.configuration?.contentInsets.leading = state.selectedCountry?.flagImageURL != nil ? 40 : 12
        countryButton.configuration?.attributedTitle = AttributedString(
            flagText + state.countryCode,
            attributes: AttributeContainer([.font: FCUITypography.current.bodyMedium.font])
        )
        loadFlag(state.selectedCountry?.flagImageURL)
        whatsappButton.isHidden = sending || !state.availableChannels.whatsappEnabled
        smsButton.isHidden = sending || !state.availableChannels.smsEnabled
        sendingButton.isHidden = !sending
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

    /// PrimaryButton.kt: the Green800 fill never dims — only the content drops to 50% — so the
    /// buttons stay enabled (a UIKit-disabled filled button greys its fill) and the send action
    /// checks validity itself.
    private func refreshButtons() {
        let enabled = viewModel.isPhoneValid() && !viewModel.state.sendOtpState.isLoading
        for button in [whatsappButton, smsButton] {
            let dim: CGFloat = enabled ? 1 : 0.5
            if var config = button.configuration {
                config.attributedTitle?.foregroundColor = UIColor.white.withAlphaComponent(dim)
                config.image = config.image?.withTintColor(FCUITheme.green500.withAlphaComponent(dim), renderingMode: .alwaysOriginal)
                button.configuration = config
            }
            button.accessibilityTraits = enabled ? .button : [.button, .notEnabled]
        }
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
