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
        buildPage()
        buildPanel()
        bind()
        load()
        FarmerChat.shared.analytics.screenViewed(
            mode == .onboarding ? ScreenNames.language : ScreenNames.languageChooser
        )
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // LanguageScreen.kt:510 — the list stays clear of the panel.
        let inset = panel.frame.height - view.safeAreaInsets.bottom + 24
        if abs(scroll.contentInset.bottom - inset) > 0.5 { scroll.contentInset.bottom = inset }
        justifyLegalIfNeeded()
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

        // LanguageChooserScreen.kt:160 — DefaultAppBar "Choose your language"; menu (drawer) or,
        // with the drawer off (pushed from the chat globe), back.
        var scrollTop = view.safeAreaLayoutGuide.topAnchor
        if mode == .settings {
            let (leading, action) = fcuiDrawerScreenLeading(route: "settings/language")
            scrollTop = fcuiInstallAppBar(
                title: fcuiLabel(FCLabels.chooseYourLanguage, "Choose your language"),
                leading: leading,
                action: action
            ).bottomAnchor
        }

        NSLayoutConstraint.activate([
            scroll.topAnchor.constraint(equalTo: scrollTop),
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
        // A multi-line `widthIn(max = 260.dp)` Text fills its max width; the inter-word
        // justification below needs that fixed width to lay the lines out against.
        let preferredWidth = legal.widthAnchor.constraint(equalToConstant: 260)
        preferredWidth.priority = .defaultHigh
        preferredWidth.isActive = true

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
        // Laid out LEFT, then justified by widening the SPACES only (`fcuiInterWordJustified`):
        // TextKit's `.justified` also spreads the glyphs inside Kannada / Devanagari words, which
        // read as unevenly letter-spaced; Android's `TextAlign.Justify` is inter-word only.
        let paragraph = caption.paragraphStyle(alignment: .natural).mutableCopy() as! NSMutableParagraphStyle
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
        legalSource = text
        legalJustifiedWidth = 0
        justifyLegalIfNeeded()
    }

    /// The un-justified legal paragraph and the width it was last justified for.
    private var legalSource: NSAttributedString?
    private var legalJustifiedWidth: CGFloat = 0

    private func justifyLegalIfNeeded() {
        guard let source = legalSource else { return }
        let width = legal.bounds.width > 0 ? legal.bounds.width : 260
        guard abs(width - legalJustifiedWidth) > 0.5 else { return }
        legalJustifiedWidth = width
        legal.attributedText = fcuiInterWordJustified(source, width: width)
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
        saveButton.setTitle(fcuiLabel(FCLabels.saveName, "Save name"), for: .normal)

        // EnterNameScreen.kt (onboarding): a 32pt green logo, the centred titleLarge question
        // and bodyMedium subtitle, the 56pt field, and Save name / Skip for now pinned to the
        // bottom. SettingsNameScreen.kt:121 (settings): a DefaultAppBar "Name" + Back, then the
        // field and Save name directly under it (20pt sides, 32pt top, 16pt apart).
        // The 1.0 screen had a left-aligned title, a rounded-rect system field and the buttons
        // stacked under the field in both modes.
        titleLabel.text = fcuiLabel(FCLabels.whatShouldWeCallYou, "What should we call you?")
        titleLabel.font = FCUITypography.current.titleLarge.font
        titleLabel.textColor = FCUITheme.foregroundPrimary
        titleLabel.textAlignment = .center
        titleLabel.numberOfLines = 0
        let subtitle = UILabel()
        subtitle.text = fcuiLabel(FCLabels.weGreetYouName, "We'll greet you by your name")
        subtitle.font = FCUITypography.current.bodyMedium.font
        subtitle.textColor = FCUITheme.foregroundSecondary
        subtitle.textAlignment = .center
        subtitle.numberOfLines = 0

        textField.placeholder = fcuiLabel(FCLabels.yourNameOrNickname, "Your name or nickname")
        textField.borderStyle = .none
        textField.backgroundColor = FCUITheme.surfaceSecondary
        textField.font = FCUITypography.current.bodyMedium.font
        textField.textColor = FCUITheme.foregroundPrimary
        textField.layer.cornerRadius = 12
        textField.layer.cornerCurve = .continuous
        textField.layer.borderWidth = 2
        textField.layer.borderColor = FCUITheme.green500.cgColor
        textField.leftView = UIView(frame: CGRect(x: 0, y: 0, width: 16, height: 1))
        textField.leftViewMode = .always
        textField.rightView = UIView(frame: CGRect(x: 0, y: 0, width: 16, height: 1))
        textField.rightViewMode = .always
        textField.accessibilityIdentifier = "fcNameField"
        textField.text = NameInputNormalizer.sanitizeStored(FarmerChat.shared.prefs.string(.userName))
        textField.addAction(UIAction { [weak self] _ in self?.textChanged() }, for: .editingChanged)
        saveButton.accessibilityIdentifier = "fcNameSave"

        var skipConfig = UIButton.Configuration.filled()
        skipConfig.baseBackgroundColor = FCUITheme.surfaceSecondary
        skipConfig.baseForegroundColor = FCUITheme.foregroundPrimary
        skipConfig.cornerStyle = .capsule
        skipConfig.attributedTitle = AttributedString(
            fcuiLabel(FCLabels.skipForNow, "Skip for now"),
            attributes: AttributeContainer([.font: FCUITypography.current.titleMedium.font])
        )
        skipButton.configuration = skipConfig
        skipButton.heightAnchor.constraint(equalToConstant: 56).isActive = true
        skipButton.isHidden = mode == .settings

        if mode == .settings {
            let bar = fcuiInstallAppBar(title: fcuiLabel(FCLabels.name, "Name"), leading: .back) { [weak self] in
                self?.fcuiGoBack()
            }
            let stack = UIStackView(arrangedSubviews: [textField, saveButton])
            stack.axis = .vertical
            stack.spacing = 16
            stack.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(stack)
            NSLayoutConstraint.activate([
                stack.topAnchor.constraint(equalTo: bar.bottomAnchor, constant: 32),
                stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
                stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
                textField.heightAnchor.constraint(equalToConstant: 56)
            ])
        } else {
            let logo = UIView()
            let mark = CAShapeLayer()
            mark.path = FCUILogoMark.path(size: 32)
            mark.fillColor = FCUITheme.green500.cgColor
            logo.layer.addSublayer(mark)
            logo.translatesAutoresizingMaskIntoConstraints = false
            let top = UIStackView(arrangedSubviews: [logo, titleLabel, subtitle, textField])
            top.axis = .vertical
            top.alignment = .center
            top.spacing = 6
            top.setCustomSpacing(20, after: logo)
            top.setCustomSpacing(28, after: subtitle)
            top.translatesAutoresizingMaskIntoConstraints = false
            let bottom = UIStackView(arrangedSubviews: [saveButton, skipButton])
            bottom.axis = .vertical
            bottom.spacing = 12
            bottom.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(top)
            view.addSubview(bottom)
            NSLayoutConstraint.activate([
                logo.widthAnchor.constraint(equalToConstant: 32),
                logo.heightAnchor.constraint(equalToConstant: 32),
                top.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 40),
                top.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
                top.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
                textField.widthAnchor.constraint(equalTo: top.widthAnchor),
                textField.heightAnchor.constraint(equalToConstant: 56),
                bottom.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
                bottom.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
                bottom.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor, constant: -16)
            ])
        }

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
        // EnterNameScreen.kt: PrimaryButtonState.Chevron once a name is typed (onboarding).
        let chevron = mode == .onboarding && saveButton.isEnabled
        saveButton.setImage(chevron ? UIImage(systemName: "chevron.right", withConfiguration: UIImage.SymbolConfiguration(pointSize: 17, weight: .medium))?
            .withTintColor(FCUITheme.green500, renderingMode: .alwaysOriginal) : nil, for: .normal)
        saveButton.semanticContentAttribute = .forceRightToLeft
        saveButton.imageEdgeInsets = UIEdgeInsets(top: 0, left: 8, bottom: 0, right: -8)
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
/// Android `TextAlign.Justify` (inter-word): every line but the last of a paragraph is widened
/// to `width` by adding kerning to its interior SPACES only — never between the letters of a word,
/// which is what TextKit's `.justified` does to Kannada / Devanagari and what read as uneven
/// letter-spacing on the language screen. Lay `text` out with a natural (left) alignment first.
func fcuiInterWordJustified(_ text: NSAttributedString, width: CGFloat) -> NSAttributedString {
    guard width > 0, text.length > 0 else { return text }
    let storage = NSTextStorage(attributedString: text)
    let layout = NSLayoutManager()
    let container = NSTextContainer(size: CGSize(width: width, height: .greatestFiniteMagnitude))
    container.lineFragmentPadding = 0
    layout.addTextContainer(container)
    storage.addLayoutManager(layout)
    layout.ensureLayout(for: container)

    let result = NSMutableAttributedString(attributedString: text)
    let ns = text.string as NSString
    var lines: [(range: NSRange, used: CGFloat)] = []
    layout.enumerateLineFragments(forGlyphRange: NSRange(location: 0, length: layout.numberOfGlyphs)) { _, used, _, glyphRange, _ in
        lines.append((layout.characterRange(forGlyphRange: glyphRange, actualGlyphRange: nil), used.width))
        _ = used
    }
    for (index, line) in lines.enumerated() where index < lines.count - 1 {
        // Trailing whitespace / a hard break does not count; the paragraph's last line stays ragged.
        var end = line.range.location + line.range.length
        var trailing = 0
        while end > line.range.location,
              let scalar = UnicodeScalar(ns.character(at: end - 1)),
              CharacterSet.whitespacesAndNewlines.contains(scalar) {
            if CharacterSet.newlines.contains(scalar) { trailing = -1; break }
            end -= 1
            trailing += 1
        }
        if trailing < 0 { continue }
        // The ink width of the line WITHOUT its trailing spaces.
        let contentWidth = layout.boundingRect(
            forGlyphRange: layout.glyphRange(forCharacterRange: NSRange(location: line.range.location, length: end - line.range.location), actualCharacterRange: nil),
            in: container
        ).width
        var spaces: [Int] = []
        for i in line.range.location..<end where ns.character(at: i) == 0x20 { spaces.append(i) }
        let extra = width - contentWidth - 1
        guard !spaces.isEmpty, extra > 0 else { continue }
        let perSpace = extra / CGFloat(spaces.count)
        for i in spaces {
            let existing = (result.attribute(.kern, at: i, effectiveRange: nil) as? CGFloat) ?? 0
            result.addAttribute(.kern, value: existing + perSpace, range: NSRange(location: i, length: 1))
        }
    }
    return result
}
#endif
