#if canImport(UIKit)
import UIKit
import Combine
import FarmerChatCore

// MARK: - Language selection / chooser (ui/onboarding/language/LanguageScreen.kt)

/// Port of the app's LanguageScreen: a `#ECECEE` page (no app bar) scrolling the 32pt green
/// `logo_mark`, "Choose your language" (titleLarge), "You can change this later" (bodyMedium
/// grey), radio rows 6pt apart and the "All languages" pill; and a white bottom panel (top
/// radius 24 — a Scaffold bottomBar, not a sheet) with the tagline, the 56pt pill "Start using
/// FarmerChat" button with its green chevron, and the justified terms paragraph.
///
/// The settings chooser (pushed from the chat's globe) reuses the page with the navigation bar
/// for Back and a panel holding only "Save language".
final class FCUILanguageViewController: UIViewController {
    enum Mode {
        case onboarding
        case settings
    }

    private let mode: Mode
    private let onboardingVM = OnboardingViewModel()
    private let settingsVM = SettingsViewModel()
    private var cancellables = Set<AnyCancellable>()

    private let scroll = UIScrollView()
    private let content = UIStackView()
    private let titleLabel = UILabel()
    private let subtitleLabel = UILabel()
    private let rows = UIStackView()
    private let allLanguages = UIButton(type: .custom)
    private let loadingStack = UIStackView()
    private let loadingLabel = UILabel()
    private let loadingSpinner = UIActivityIndicatorView(style: .large)

    private let panel = UIView()
    private let taglineLabel = UILabel()
    private let startButton = UIButton(type: .custom)
    private let startTitle = UILabel()
    private let startChevron = UIImageView()
    private let startSpinner = UIActivityIndicatorView(style: .medium)
    private let legal = UITextView()

    init(mode: Mode) {
        self.mode = mode
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = FCUITheme.surfacePrimary
        if mode == .settings {
            title = fcuiLabel(FCLabels.chooseYourLanguage, "Choose your language")
            navigationItem.leftBarButtonItem = UIBarButtonItem(
                image: UIImage(systemName: "chevron.left"),
                primaryAction: UIAction { [weak self] _ in self?.navigationController?.popViewController(animated: true) }
            )
        }
        buildPage()
        buildPanel()
        bind()
        load()
        FarmerChat.shared.analytics.screenViewed(
            mode == .onboarding ? ScreenNames.language : ScreenNames.languageChooser
        )
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationController?.setNavigationBarHidden(mode == .onboarding, animated: animated)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // LanguageScreen.kt:510 — the list stays clear of the panel.
        let inset = panel.frame.height - view.safeAreaInsets.bottom + 24
        if abs(scroll.contentInset.bottom - inset) > 0.5 { scroll.contentInset.bottom = inset }
    }

    // MARK: Page

    private func buildPage() {
        scroll.alwaysBounceVertical = true
        scroll.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scroll)

        let mark = UIView()
        let markLayer = CAShapeLayer()
        markLayer.path = FCUILogoMark.path(size: 32)
        markLayer.fillColor = FCUITheme.green500.cgColor
        mark.layer.addSublayer(markLayer)
        mark.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            mark.widthAnchor.constraint(equalToConstant: 32),
            mark.heightAnchor.constraint(equalToConstant: 32)
        ])
        mark.isHidden = mode == .settings

        for label in [titleLabel, subtitleLabel, loadingLabel] {
            label.numberOfLines = 0
            label.textAlignment = .center
        }
        titleLabel.textColor = FCUITheme.foregroundPrimary
        subtitleLabel.textColor = FCUITheme.foregroundSecondary
        loadingLabel.textColor = FCUITheme.foregroundPrimary
        titleLabel.isHidden = mode == .settings

        rows.axis = .vertical
        rows.spacing = 6

        // "All languages": a wrap-width centred pill, `#08361B`, white labelLarge, padding 20/10.
        allLanguages.backgroundColor = FCUITheme.buttonPrimarySurface
        allLanguages.setTitleColor(.white, for: .normal)
        allLanguages.titleLabel?.font = FCUITypography.current.labelLarge.font
        allLanguages.contentEdgeInsets = UIEdgeInsets(top: 10, left: 20, bottom: 10, right: 20)
        allLanguages.layer.cornerCurve = .continuous
        allLanguages.accessibilityIdentifier = "fcAllLanguages"
        allLanguages.addAction(UIAction { [weak self] _ in self?.toggleExpanded() }, for: .touchUpInside)

        // Loading: vertical LogoSpinner + "FarmerChat is Starting..." / "Loading languages...".
        loadingSpinner.color = FCUITheme.green500
        loadingSpinner.hidesWhenStopped = false
        loadingStack.axis = .vertical
        loadingStack.alignment = .center
        loadingStack.spacing = 16
        loadingStack.isLayoutMarginsRelativeArrangement = true
        loadingStack.layoutMargins = UIEdgeInsets(top: 40, left: 0, bottom: 40, right: 0)
        loadingStack.addArrangedSubview(loadingSpinner)
        loadingStack.addArrangedSubview(loadingLabel)

        content.axis = .vertical
        content.alignment = .fill
        content.translatesAutoresizingMaskIntoConstraints = false
        let allWrap = UIStackView(arrangedSubviews: [allLanguages])
        allWrap.axis = .vertical
        allWrap.alignment = .center
        [mark, titleLabel, subtitleLabel, loadingStack, rows, allWrap].forEach { content.addArrangedSubview($0) }
        let markWrap = mark
        content.setCustomSpacing(14, after: markWrap)
        content.setCustomSpacing(8, after: titleLabel)
        content.setCustomSpacing(24, after: subtitleLabel)
        content.setCustomSpacing(16, after: rows)
        scroll.addSubview(content)
        // Centre the mark (content aligns .fill).
        mark.removeFromSuperview()
        let markRow = UIStackView(arrangedSubviews: [mark])
        markRow.axis = .vertical
        markRow.alignment = .center
        content.insertArrangedSubview(markRow, at: 0)
        content.setCustomSpacing(14, after: markRow)
        markRow.isHidden = mode == .settings

        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scroll.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scroll.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            content.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor, constant: mode == .onboarding ? 32 : 16),
            content.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor, constant: -24),
            content.leadingAnchor.constraint(equalTo: scroll.frameLayoutGuide.leadingAnchor, constant: 24),
            content.trailingAnchor.constraint(equalTo: scroll.frameLayoutGuide.trailingAnchor, constant: -24)
        ])
    }

    // MARK: Bottom panel

    private func buildPanel() {
        panel.backgroundColor = FCUITheme.surfaceSecondary
        panel.layer.cornerRadius = 24
        panel.layer.cornerCurve = .continuous
        panel.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        panel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(panel)

        taglineLabel.numberOfLines = 0
        taglineLabel.textAlignment = .center
        taglineLabel.textColor = FCUITheme.foregroundPrimary
        taglineLabel.isHidden = mode == .settings

        // PrimaryButton.kt: 56pt smooth pill, `#08361B`, white labelLarge; enabled → a trailing
        // ChevronRight 24 `#00C950`; disabled → no chevron, label at 50%.
        startButton.backgroundColor = FCUITheme.buttonPrimarySurface
        startButton.layer.cornerRadius = 28
        startButton.layer.cornerCurve = .continuous
        startButton.accessibilityIdentifier = "fcLanguageStart"
        startButton.isAccessibilityElement = true
        startButton.accessibilityTraits = .button
        startButton.translatesAutoresizingMaskIntoConstraints = false
        startTitle.textColor = .white
        startTitle.font = FCUITypography.current.labelLarge.font
        startTitle.textAlignment = .center
        startTitle.adjustsFontSizeToFitWidth = true
        startTitle.minimumScaleFactor = 0.8
        startTitle.translatesAutoresizingMaskIntoConstraints = false
        startChevron.image = UIImage(systemName: "chevron.right", withConfiguration: UIImage.SymbolConfiguration(pointSize: 17, weight: .semibold))
        startChevron.tintColor = FCUITheme.green500
        startChevron.contentMode = .center
        startChevron.translatesAutoresizingMaskIntoConstraints = false
        startSpinner.color = .white
        startSpinner.hidesWhenStopped = true
        startSpinner.translatesAutoresizingMaskIntoConstraints = false
        let titleRow = UIStackView(arrangedSubviews: [startTitle, startChevron])
        titleRow.axis = .horizontal
        titleRow.spacing = 8
        titleRow.alignment = .center
        titleRow.isUserInteractionEnabled = false
        titleRow.translatesAutoresizingMaskIntoConstraints = false
        startButton.addSubview(titleRow)
        startButton.addSubview(startSpinner)
        startButton.addAction(UIAction { [weak self] _ in self?.save() }, for: .touchUpInside)
        NSLayoutConstraint.activate([
            startButton.heightAnchor.constraint(equalToConstant: 56),
            titleRow.centerXAnchor.constraint(equalTo: startButton.centerXAnchor),
            titleRow.centerYAnchor.constraint(equalTo: startButton.centerYAnchor),
            titleRow.leadingAnchor.constraint(greaterThanOrEqualTo: startButton.leadingAnchor, constant: 16),
            titleRow.trailingAnchor.constraint(lessThanOrEqualTo: startButton.trailingAnchor, constant: -16),
            startChevron.widthAnchor.constraint(equalToConstant: 24),
            startSpinner.centerXAnchor.constraint(equalTo: startButton.centerXAnchor),
            startSpinner.centerYAnchor.constraint(equalTo: startButton.centerYAnchor)
        ])

        legal.isEditable = false
        legal.isScrollEnabled = false
        legal.backgroundColor = .clear
        legal.textContainerInset = .zero
        legal.textContainer.lineFragmentPadding = 0
        legal.delegate = self
        legal.isHidden = mode == .settings
        legal.linkTextAttributes = [
            .foregroundColor: FCUITheme.foregroundSecondary,
            .underlineStyle: NSUnderlineStyle.single.rawValue
        ]
        legal.translatesAutoresizingMaskIntoConstraints = false
        legal.widthAnchor.constraint(lessThanOrEqualToConstant: 260).isActive = true

        let stack = UIStackView(arrangedSubviews: [taglineLabel, startButton, legal])
        stack.axis = .vertical
        stack.spacing = 20
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        panel.addSubview(stack)
        NSLayoutConstraint.activate([
            panel.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            panel.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            panel.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            stack.topAnchor.constraint(equalTo: panel.topAnchor, constant: 28),
            stack.leadingAnchor.constraint(equalTo: panel.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: panel.trailingAnchor, constant: -24),
            stack.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -16),
            startButton.widthAnchor.constraint(equalTo: stack.widthAnchor),
            taglineLabel.widthAnchor.constraint(equalTo: stack.widthAnchor)
        ])
    }

    // MARK: State

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
        if mode == .onboarding {
            onboardingVM.onAction(.fetchLegalLinks)
            Task { await onboardingVM.bootstrapLanguages() }
        } else {
            settingsVM.loadLanguages()
        }
    }

    private func render(onboarding state: OnboardingState) {
        let loading = state.languageState.isLoading || state.languageState.value == nil
        renderCommon(
            loading: loading,
            loadingText: state.guestInitState.isLoading
                ? fcuiLabel(FCLabels.farmerchatStarting, "FarmerChat is Starting...")
                : fcuiLabel(FCLabels.loadingLanguages, "Loading languages..."),
            languages: state.visibleLanguages(),
            selectedId: state.selectedLanguageId,
            fetchingId: state.isFetchingLabels ? state.fetchingLabelsForId : nil,
            canExpand: !state.expandedLanguages && state.hasExpandableLanguages(),
            enabled: state.selectedLanguageId != nil && state.languageState.isSuccess,
            submitting: state.isSubmittingLanguage,
            termsUrl: state.termsOfUseUrl,
            privacyUrl: state.privacyPolicyUrl
        )
        if state.languageSubmitSuccess {
            onboardingVM.onAction(.consumeLanguageResult)
            (navigationController as? FarmerChatViewController)?.routeFromSplash()
        }
    }

    private func render(settings state: LanguageSettingsState) {
        let loading = state.languageState.isLoading || state.languageState.value == nil
        renderCommon(
            loading: loading,
            loadingText: fcuiLabel(FCLabels.loadingLanguages, "Loading languages..."),
            languages: state.visibleLanguages(),
            selectedId: state.selectedLanguageId,
            fetchingId: state.isFetchingLabels ? state.fetchingLabelsForId : nil,
            canExpand: !state.expandedLanguages && state.hasExpandableLanguages(),
            enabled: state.selectedLanguageId != nil && !state.isFetchingLabels,
            submitting: state.isSubmittingLanguage,
            termsUrl: nil,
            privacyUrl: nil
        )
        if state.languageSubmitSuccess {
            settingsVM.consumeLanguageResult()
            navigationController?.popToRootViewController(animated: true)
        }
    }

    // swiftlint:disable:next function_parameter_count
    private func renderCommon(loading: Bool, loadingText: String, languages: [SupportedLanguage],
                              selectedId: Int?, fetchingId: Int?, canExpand: Bool, enabled: Bool,
                              submitting: Bool, termsUrl: String?, privacyUrl: String?) {
        // Labels re-resolve on every render: picking a language swaps the served strings.
        let typography = FCUITypography.current
        titleLabel.fcSetText(fcuiLabel(FCLabels.chooseYourLanguage, "Choose your language"), style: typography.titleLarge)
        subtitleLabel.fcSetText(fcuiLabel(FCLabels.youChangeLater, "You can change this later"), style: typography.bodyMedium)
        loadingLabel.fcSetText(loadingText, style: typography.labelLarge)
        taglineLabel.fcSetText(fcuiLabel(FCLabels.farmerchatTagline, "FarmerChat: Practical advice for your crops & livestock"),
                               style: typography.titleLarge)
        startTitle.text = mode == .onboarding
            ? fcuiLabel(FCLabels.startUsingFarmerchat, "Start using FarmerChat")
            : fcuiLabel(FCLabels.saveLanguage, "Save language")
        startButton.accessibilityLabel = startTitle.text
        allLanguages.setTitle(fcuiLabel(FCLabels.allLanguages, "All languages"), for: .normal)
        allLanguages.layer.cornerRadius = allLanguages.intrinsicContentSize.height / 2

        loadingStack.isHidden = !loading
        if loading { loadingSpinner.startAnimating() } else { loadingSpinner.stopAnimating() }
        rows.isHidden = loading
        allLanguages.superview?.isHidden = loading || !canExpand

        rows.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for language in languages {
            let row = FCUILanguageRow(
                name: language.displayName ?? language.name ?? "",
                selected: language.id == selectedId,
                loading: language.id == fetchingId
            )
            row.addAction(UIAction { [weak self] _ in self?.select(language) }, for: .touchUpInside)
            rows.addArrangedSubview(row)
        }

        startButton.isEnabled = enabled && !submitting
        startChevron.isHidden = !enabled || submitting
        startTitle.alpha = submitting ? 0 : (enabled ? 1 : 0.5)
        if submitting { startSpinner.startAnimating() } else { startSpinner.stopAnimating() }

        if mode == .onboarding { renderLegal(termsUrl: termsUrl, privacyUrl: privacyUrl) }
        view.setNeedsLayout()
    }

    /// LanguageScreen.kt:274-356 — one justified caption paragraph: intro, underlined Terms of
    /// Use, the served `also_see` connector, underlined Privacy Policy, ".". Links in the same grey.
    private func renderLegal(termsUrl: String?, privacyUrl: String?) {
        let caption = FCUITypography.current.caption
        let paragraph = caption.paragraphStyle(alignment: .justified).mutableCopy() as! NSMutableParagraphStyle
        let base: [NSAttributedString.Key: Any] = [
            .font: caption.font, .foregroundColor: FCUITheme.foregroundSecondary, .paragraphStyle: paragraph
        ]
        let text = NSMutableAttributedString(string: fcuiLabel(
            FCLabels.byContinuingYouAgreeToOur, "FarmerChat uses AI. By continuing, you agree to our"
        ) + " ", attributes: base)
        func link(_ title: String, _ url: String?) -> NSAttributedString {
            var attributes = base
            attributes[.underlineStyle] = NSUnderlineStyle.single.rawValue
            if let url, let parsed = URL(string: url) { attributes[.link] = parsed }
            return NSAttributedString(string: title, attributes: attributes)
        }
        text.append(link(fcuiLabel(FCLabels.termsOfUse, "Terms of use"), termsUrl))
        text.append(NSAttributedString(string: " ", attributes: base))
        let alsoSee = fcuiLabel(FCLabels.alsoSee, "also see").trimmingCharacters(in: .whitespaces)
        if !alsoSee.isEmpty { text.append(NSAttributedString(string: alsoSee + " ", attributes: base)) }
        text.append(link(fcuiLabel(FCLabels.privacyPolicy, "Privacy policy"), privacyUrl))
        text.append(NSAttributedString(string: ".", attributes: base))
        legal.attributedText = text
    }

    private func select(_ language: SupportedLanguage) {
        if mode == .onboarding {
            onboardingVM.onAction(.selectLanguage(languageId: language.id))
        } else {
            settingsVM.selectLanguage(id: language.id, code: language.code)
        }
    }

    private func toggleExpanded() {
        if mode == .onboarding {
            onboardingVM.toggleExpandedLanguages()
            render(onboarding: onboardingVM.state)
        } else {
            settingsVM.toggleExpandedLanguages()
            render(settings: settingsVM.state)
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
}

extension FCUILanguageViewController: UITextViewDelegate {
    func textView(_ textView: UITextView, shouldInteractWith URL: URL, in characterRange: NSRange,
                  interaction: UITextItemInteraction) -> Bool {
        UIApplication.shared.open(URL)
        return false
    }
}

/// RadioButton.kt row: full width, smooth radius 12, padding 16/14; white, or `#2900C950` when
/// selected; a 20pt indicator (unselected: solid `#E4E4E7` disc; selected: white disc with a
/// 10pt `#00C950` dot), 12, the name in bodyMedium (1 line, ellipsis); a loading row ends with a
/// 20pt green ring.
final class FCUILanguageRow: UIControl {
    init(name: String, selected: Bool, loading: Bool) {
        super.init(frame: .zero)
        backgroundColor = selected ? FCUITheme.surfaceActive : FCUITheme.surfaceSecondary
        layer.cornerRadius = 12
        layer.cornerCurve = .continuous
        let indicator = UIView()
        indicator.layer.cornerRadius = 10
        indicator.backgroundColor = selected ? .white : FCUITheme.surfaceTertiary
        indicator.isUserInteractionEnabled = false
        indicator.translatesAutoresizingMaskIntoConstraints = false
        if selected {
            let dot = UIView()
            dot.backgroundColor = FCUITheme.green500
            dot.layer.cornerRadius = 5
            dot.translatesAutoresizingMaskIntoConstraints = false
            indicator.addSubview(dot)
            NSLayoutConstraint.activate([
                dot.widthAnchor.constraint(equalToConstant: 10),
                dot.heightAnchor.constraint(equalToConstant: 10),
                dot.centerXAnchor.constraint(equalTo: indicator.centerXAnchor),
                dot.centerYAnchor.constraint(equalTo: indicator.centerYAnchor)
            ])
        }
        let label = UILabel()
        label.textColor = FCUITheme.foregroundPrimary
        label.lineBreakMode = .byTruncatingTail
        label.fcSetText(name, style: FCUITypography.current.bodyMedium)
        label.isUserInteractionEnabled = false
        label.translatesAutoresizingMaskIntoConstraints = false
        addSubview(indicator)
        addSubview(label)
        var constraints = [
            indicator.widthAnchor.constraint(equalToConstant: 20),
            indicator.heightAnchor.constraint(equalToConstant: 20),
            indicator.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            indicator.centerYAnchor.constraint(equalTo: centerYAnchor),
            label.leadingAnchor.constraint(equalTo: indicator.trailingAnchor, constant: 12),
            label.topAnchor.constraint(equalTo: topAnchor, constant: 14),
            label.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -14)
        ]
        if loading {
            let ring = UIActivityIndicatorView(style: .medium)
            ring.color = FCUITheme.green500
            ring.startAnimating()
            ring.translatesAutoresizingMaskIntoConstraints = false
            addSubview(ring)
            constraints += [
                ring.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
                ring.centerYAnchor.constraint(equalTo: centerYAnchor),
                label.trailingAnchor.constraint(lessThanOrEqualTo: ring.leadingAnchor, constant: -12)
            ]
        } else {
            constraints.append(label.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -16))
        }
        NSLayoutConstraint.activate(constraints)
        isAccessibilityElement = true
        accessibilityLabel = name
        accessibilityTraits = selected ? [.button, .selected] : .button
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override var isHighlighted: Bool {
        didSet { alpha = isHighlighted ? 0.7 : 1 }
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
        saveButton.setTitle(fcuiLabel(FCLabels.saveName, "Save name"), for: .normal)

        titleLabel.text = mode == .onboarding
            ? fcuiLabel(FCLabels.whatShouldWeCallYou, "What should we call you?")
            : fcuiLabel(FCLabels.name, "Name")
        titleLabel.font = FCUITypography.current.titleLarge.font
        titleLabel.textColor = FCUITheme.foregroundPrimary
        titleLabel.numberOfLines = 0

        textField.placeholder = fcuiLabel(FCLabels.yourName, "Your name")
        textField.borderStyle = .roundedRect
        textField.backgroundColor = FCUITheme.surfaceSecondary
        textField.font = FCUITypography.current.bodyMedium.font
        textField.text = NameInputNormalizer.sanitizeStored(FarmerChat.shared.prefs.string(.userName))
        textField.addAction(UIAction { [weak self] _ in self?.textChanged() }, for: .editingChanged)

        skipButton.setTitle(fcuiLabel(FCLabels.skipForNow, "Skip for now"), for: .normal)
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
        label.font = FCUITypography.current.bodySmall.font
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
