#if canImport(UIKit)
import UIKit
import Combine
import FarmerChatCore

// MARK: - Greeting cell

final class FCUIGreetingCell: UICollectionViewCell {
    private let label = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        label.font = FCUITypography.current.titleMedium.font
        label.textColor = FCUITheme.foregroundPrimary
        label.numberOfLines = 0
        label.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(label)
        NSLayoutConstraint.activate([
            label.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 4),
            label.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            label.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            label.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -4)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    func configure(text: String) {
        label.text = text
    }
}

// MARK: - Photo/Speak/Type pinned header

final class FCUIInputButtonsHeader: UICollectionReusableView {
    var onPhoto: (() -> Void)?
    var onSpeak: (() -> Void)?
    var onType: (() -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = FCUITheme.surfacePrimary

        let photo = makeButton(icon: "camera.fill", title: fcuiLabel(FCLabels.photo, "Photo"))
        photo.addAction(UIAction { [weak self] _ in self?.onPhoto?() }, for: .touchUpInside)
        let speak = makeButton(icon: "mic.fill", title: fcuiLabel(FCLabels.speak, "Speak"))
        speak.addAction(UIAction { [weak self] _ in self?.onSpeak?() }, for: .touchUpInside)
        let type = makeButton(icon: "keyboard", title: fcuiLabel(FCLabels.type, "Type"))
        type.addAction(UIAction { [weak self] _ in self?.onType?() }, for: .touchUpInside)

        var buttons: [UIView] = []
        if FarmerChat.shared.config.enableImages { buttons.append(photo) }
        if FarmerChat.shared.config.enableVoice { buttons.append(speak) }
        buttons.append(type)

        let stack = UIStackView(arrangedSubviews: buttons)
        stack.axis = .horizontal
        stack.spacing = 10
        stack.distribution = .fillEqually
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    private func makeButton(icon: String, title: String) -> UIButton {
        var config = UIButton.Configuration.filled()
        config.image = UIImage(systemName: icon)
        config.title = title
        config.imagePlacement = .top
        config.imagePadding = 6
        config.baseBackgroundColor = FCUITheme.buttonPrimarySurface
        config.baseForegroundColor = .white
        config.cornerStyle = .large
        return UIButton(configuration: config)
    }
}

// MARK: - SSFR card cell (wheat / maize fertilizer advice)

final class FCUISsfrCell: UICollectionViewCell {
    var onCropSelected: ((String) -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        contentView.backgroundColor = FCUITheme.surfaceSecondary
        contentView.layer.cornerRadius = 24
        contentView.layer.cornerCurve = .continuous
        contentView.layer.masksToBounds = true

        let title = UILabel()
        title.text = fcuiLabel("ssfr_title", "Get fertilizer advice for your crop")
        title.font = FCUITypography.current.titleMedium.font
        title.textColor = FCUITheme.foregroundPrimary
        title.numberOfLines = 0

        let wheat = cropButton(icon: "laurel.leading", title: fcuiLabel(FCLabels.ssfrWheat, "Wheat"), crop: "wheat")
        let maize = cropButton(icon: "leaf.fill", title: fcuiLabel(FCLabels.ssfrMaize, "Maize"), crop: "maize")
        let row = UIStackView(arrangedSubviews: [wheat, maize])
        row.axis = .horizontal
        row.spacing = 10
        row.distribution = .fillEqually

        let stack = UIStackView(arrangedSubviews: [title, row])
        stack.axis = .vertical
        stack.spacing = 12
        stack.isLayoutMarginsRelativeArrangement = true
        stack.layoutMargins = UIEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
        stack.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: contentView.topAnchor),
            stack.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: contentView.bottomAnchor)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    private func cropButton(icon: String, title: String, crop: String) -> UIButton {
        var config = UIButton.Configuration.plain()
        config.image = UIImage(systemName: icon)
        config.title = title
        config.imagePadding = 8
        config.baseForegroundColor = FCUITheme.brandSurfacePrimary
        config.background.backgroundColor = FCUITheme.surfaceActive
        config.background.cornerRadius = 14
        config.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 12, bottom: 12, trailing: 12)
        let button = UIButton(configuration: config)
        button.tintColor = FCUITheme.brandSurfacePrimary
        button.addAction(UIAction { [weak self] _ in self?.onCropSelected?(crop) }, for: .touchUpInside)
        return button
    }
}

// MARK: - Feed card cell (content / single-select / multi-select / SSFR)

final class FCUIFeedCardCell: UICollectionViewCell {
    var onTap: (() -> Void)?
    var onDismiss: (() -> Void)?
    var onOptionSubmit: (([SectionOption]) -> Void)?

    private let container = UIStackView()
    private let imageView = UIImageView()
    private let titleLabel = UILabel()
    private let statementLabel = UILabel()
    private let optionsStack = UIStackView()
    private let dismissButton = UIButton(type: .system)
    private var titleRow: UIStackView!
    private var body: UIStackView!
    /// ContentCard.kt: the 16:9 picture inset 8pt, radius 16.
    private let imageWrap = UIView()
    private let headlineLabel = UILabel()
    private let startButton = UIButton(type: .custom)
    private let startSpinner = UIActivityIndicatorView(style: .medium)
    private var contentStack: UIStackView!
    private var imageTask: URLSessionDataTask?
    private var section: SectionDto?
    private var selectedOptionIds = Set<String>()

    override init(frame: CGRect) {
        super.init(frame: frame)
        contentView.backgroundColor = FCUITheme.surfaceSecondary
        contentView.layer.cornerRadius = 20
        contentView.layer.cornerCurve = .continuous
        contentView.layer.masksToBounds = true

        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true

        titleLabel.font = FCUITypography.current.titleMedium.font
        titleLabel.textColor = FCUITheme.foregroundPrimary
        titleLabel.numberOfLines = 0

        statementLabel.font = FCUITypography.current.bodyMedium.font
        statementLabel.textColor = FCUITheme.foregroundSecondary
        statementLabel.numberOfLines = 0

        optionsStack.axis = .vertical
        optionsStack.spacing = 8

        dismissButton.setImage(UIImage(systemName: "xmark"), for: .normal)
        dismissButton.tintColor = FCUITheme.foregroundTertiary
        dismissButton.addAction(UIAction { [weak self] _ in self?.onDismiss?() }, for: .touchUpInside)

        titleRow = UIStackView(arrangedSubviews: [titleLabel, dismissButton])
        titleRow.axis = .horizontal
        titleRow.alignment = .top
        titleRow.spacing = 8

        body = UIStackView(arrangedSubviews: [titleRow, statementLabel, optionsStack])
        body.axis = .vertical
        body.spacing = 8
        body.isLayoutMarginsRelativeArrangement = true
        body.layoutMargins = UIEdgeInsets(top: 14, left: 16, bottom: 14, right: 16)

        // ContentCard.kt (Cards.kt:109-245): picture inset 8pt (16:9, radius 16), then the
        // headline in bodyLarge (max 3 lines) and a full-width 42pt rounded "Start chat" button
        // with a chevron, 24pt side padding — no ✕, no statement (the 1.0 card had both).
        imageView.removeConstraints(imageView.constraints)
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.layer.cornerRadius = 16
        imageView.layer.cornerCurve = .continuous
        imageView.backgroundColor = FCUITheme.surfacePrimary
        imageWrap.addSubview(imageView)
        NSLayoutConstraint.activate([
            imageView.topAnchor.constraint(equalTo: imageWrap.topAnchor, constant: 8),
            imageView.leadingAnchor.constraint(equalTo: imageWrap.leadingAnchor, constant: 8),
            imageView.trailingAnchor.constraint(equalTo: imageWrap.trailingAnchor, constant: -8),
            imageView.bottomAnchor.constraint(equalTo: imageWrap.bottomAnchor),
            imageView.heightAnchor.constraint(equalTo: imageView.widthAnchor, multiplier: 9.0 / 16.0)
        ])
        headlineLabel.numberOfLines = 3
        headlineLabel.textColor = FCUITheme.foregroundPrimary
        var buttonConfig = UIButton.Configuration.filled()
        buttonConfig.baseBackgroundColor = FCUITheme.buttonPrimarySurface
        buttonConfig.baseForegroundColor = .white
        buttonConfig.cornerStyle = .capsule
        buttonConfig.image = UIImage(systemName: "chevron.right", withConfiguration: UIImage.SymbolConfiguration(pointSize: 15, weight: .semibold))?
            .withTintColor(FCUITheme.brandAccent, renderingMode: .alwaysOriginal)
        buttonConfig.imagePlacement = .trailing
        buttonConfig.imagePadding = 8
        startButton.configuration = buttonConfig
        startButton.accessibilityIdentifier = "fcHomeCardStart"
        startButton.heightAnchor.constraint(equalToConstant: 42).isActive = true
        startButton.addAction(UIAction { [weak self] _ in self?.onTap?() }, for: .touchUpInside)
        startSpinner.color = FCUITheme.brandAccent
        startSpinner.hidesWhenStopped = true
        startSpinner.translatesAutoresizingMaskIntoConstraints = false
        startButton.addSubview(startSpinner)
        NSLayoutConstraint.activate([
            startSpinner.centerXAnchor.constraint(equalTo: startButton.centerXAnchor),
            startSpinner.centerYAnchor.constraint(equalTo: startButton.centerYAnchor)
        ])
        contentStack = UIStackView(arrangedSubviews: [headlineLabel, startButton])
        contentStack.axis = .vertical
        contentStack.spacing = 16
        contentStack.isLayoutMarginsRelativeArrangement = true

        container.axis = .vertical
        container.addArrangedSubview(imageWrap)
        container.addArrangedSubview(body)
        container.addArrangedSubview(contentStack)
        container.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(container)
        NSLayoutConstraint.activate([
            container.topAnchor.constraint(equalTo: contentView.topAnchor),
            container.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            container.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            container.bottomAnchor.constraint(equalTo: contentView.bottomAnchor)
        ])

        contentView.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(cellTapped)))
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func prepareForReuse() {
        super.prepareForReuse()
        imageTask?.cancel()
        imageView.image = nil
        selectedOptionIds = []
        stateToken += 1
        selectState = .selecting
        body.isHidden = false
        confirmBar.removeFromSuperview()
        feedbackView.removeFromSuperview()
        optionsStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
    }

    @objc private func cellTapped() {
        // Selection cards use their own controls; only content cards navigate.
        guard section?.options?.isEmpty != false else { return }
        onTap?()
    }

    func configure(section: SectionDto, isLoading: Bool = false) {
        self.section = section
        let isContent = section.options?.isEmpty != false && section.type?.lowercased() != "question"
        body.isHidden = isContent
        contentStack.isHidden = !isContent
        // Elevated card (Containers.elevated): the shadow lives on the cell, the clip on its content.
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = isContent ? 0.08 : 0
        layer.shadowRadius = 14
        layer.shadowOffset = CGSize(width: 0, height: 6)
        contentView.layer.cornerRadius = isContent ? 24 : 20
        if isContent {
            let headline = (section.questionText?.isEmpty == false ? section.questionText : section.title) ?? ""
            headlineLabel.fcSetText(headline, style: FCUITypography.current.bodyLarge)
            headlineLabel.numberOfLines = 3
            startButton.configuration?.attributedTitle = AttributedString(
                fcuiLabel(FCLabels.startChat, "Start chat"),
                attributes: AttributeContainer([.font: FCUITypography.current.titleMedium.font])
            )
            startButton.configuration?.showsActivityIndicator = false
            startButton.isEnabled = !isLoading
            if isLoading { startSpinner.startAnimating() } else { startSpinner.stopAnimating() }
            startButton.titleLabel?.alpha = isLoading ? 0 : 1
            let hasImage = section.imageUrl?.isEmpty == false
            contentStack.layoutMargins = UIEdgeInsets(top: hasImage ? 12 : 22, left: 24, bottom: 20, right: 24)
        }
        titleLabel.fcSetText(section.title ?? section.statement ?? section.questionText, style: FCUITypography.current.titleMedium)
        statementLabel.fcSetText(section.title != nil ? section.statement : nil, style: FCUITypography.current.bodyMedium)
        statementLabel.isHidden = statementLabel.text?.isEmpty != false

        // Image
        imageWrap.isHidden = true
        if let urlString = section.imageUrl, let url = URL(string: urlString) {
            imageWrap.isHidden = false
            imageTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
                guard let data, let image = UIImage(data: data) else { return }
                DispatchQueue.main.async { self?.imageView.image = image }
            }
            imageTask?.resume()
        }

        // Options (single/multi select) — Cards.kt SingleSelectCard / MultiSelectCard (via the
        // Android SDK's Cards.kt:334-780, as the SwiftUI shell ports it): radio / checkbox rows
        // that only SELECT (re-tapping a radio clears it), a flush Confirm bar once something is
        // picked, Saving → a "Thank you" acknowledgement → the card leaves the feed. The 1.0
        // card committed a single-select on the first tap and drew capsule chips.
        optionsStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        let options = section.options ?? []
        guard !options.isEmpty else { return }
        titleLabel.fcSetText(section.statement ?? section.title ?? section.questionText, style: FCUITypography.current.bodyLarge)
        statementLabel.isHidden = true
        body.layoutMargins = UIEdgeInsets(top: 26, left: 24, bottom: 20, right: 24)
        body.spacing = 18
        optionsStack.spacing = 6
        let isSingle = section.selectionType == "single" || section.type == "single_select"
        selectState = .selecting
        renderOptions(options, single: isSingle)
    }

    private enum SelectState { case selecting, saving, feedback }
    private var selectState: SelectState = .selecting
    private var stateToken = 0
    private let confirmBar = UIButton(type: .custom)
    private let feedbackView = UIStackView()

    /// Port of the multi-select mutual exclusion (Cards.kt:705-735).
    private func isNoneOfTheAbove(_ option: SectionOption) -> Bool {
        let id = option.id.lowercased()
        if id == "none" || id.contains("none_of_the_above") { return true }
        return (option.text ?? "").trimmingCharacters(in: .whitespaces)
            .caseInsensitiveCompare("none of the above") == .orderedSame
    }

    private func renderOptions(_ options: [SectionOption], single: Bool) {
        optionsStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        let enabled = selectState == .selecting
        for option in options {
            let selected = selectedOptionIds.contains(option.id)
            let row = UIButton(type: .custom)
            var config = UIButton.Configuration.plain()
            config.attributedTitle = AttributedString(option.text ?? "", attributes: AttributeContainer([
                .font: (single ? FCUITypography.current.bodyMedium : FCUITypography.current.bodySmall).font,
                .foregroundColor: FCUITheme.foregroundPrimary
            ]))
            if single {
                config.image = UIImage(systemName: selected ? "largecircle.fill.circle" : "circle")?
                    .withTintColor(selected ? FCUITheme.green500 : FCUITheme.borderDefault, renderingMode: .alwaysOriginal)
                config.imagePadding = 12
                config.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 8, bottom: 12, trailing: 8)
            } else {
                // Android `Checkbox` (Form.kt:352): a full-width card — fill + border carry state.
                config.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 15, bottom: 12, trailing: 15)
                config.background.backgroundColor = selected ? FCUITheme.surfaceActive : FCUITheme.surfaceSecondary
                config.background.cornerRadius = 12
                config.background.strokeColor = selected ? FCUITheme.green500 : FCUITheme.borderDefault
                config.background.strokeWidth = 0.5
            }
            row.configuration = config
            row.contentHorizontalAlignment = .leading
            row.isEnabled = enabled
            row.accessibilityTraits = selected ? [.button, .selected] : .button
            row.addAction(UIAction { [weak self] _ in
                guard let self, self.selectState == .selecting else { return }
                if single {
                    self.selectedOptionIds = selected ? [] : [option.id]
                } else if self.isNoneOfTheAbove(option) {
                    self.selectedOptionIds = selected ? [] : [option.id]
                } else {
                    for other in options where self.isNoneOfTheAbove(other) { self.selectedOptionIds.remove(other.id) }
                    if selected { self.selectedOptionIds.remove(option.id) } else { self.selectedOptionIds.insert(option.id) }
                }
                self.renderOptions(options, single: single)
            }, for: .touchUpInside)
            optionsStack.addArrangedSubview(row)
        }
        // The flush Confirm bar (PrimaryButton, Radius.NONE) — only once something is picked.
        container.arrangedSubviews.filter { $0 === confirmBar || $0 === feedbackView }.forEach { $0.removeFromSuperview() }
        guard !selectedOptionIds.isEmpty else {
            invalidateCardLayout()
            return
        }
        var bar = UIButton.Configuration.filled()
        bar.baseBackgroundColor = FCUITheme.buttonPrimarySurface
        bar.baseForegroundColor = .white
        bar.cornerStyle = .fixed
        bar.background.cornerRadius = 0
        bar.showsActivityIndicator = selectState == .saving
        bar.imagePadding = 8
        bar.attributedTitle = AttributedString(
            selectState == .saving ? fcuiLabel(FCLabels.saving, "Saving") : fcuiLabel(FCLabels.confirm, "Confirm"),
            attributes: AttributeContainer([.font: FCUITypography.current.labelLarge.font])
        )
        confirmBar.configuration = bar
        confirmBar.accessibilityIdentifier = "fcHomeCardConfirm"
        if confirmBar.constraints.isEmpty {
            confirmBar.heightAnchor.constraint(equalToConstant: 48).isActive = true
        }
        confirmBar.addAction(UIAction(identifier: UIAction.Identifier("confirm")) { [weak self] _ in
            self?.confirm(options, single: single)
        }, for: .touchUpInside)
        container.addArrangedSubview(confirmBar)
        invalidateCardLayout()
    }

    private func confirm(_ options: [SectionOption], single: Bool) {
        guard selectState == .selecting else { return }
        let chosen = options.filter { selectedOptionIds.contains($0.id) }
        guard !chosen.isEmpty else { return }
        onOptionSubmit?(chosen)
        selectState = .saving
        renderOptions(options, single: single)
        stateToken += 1
        let token = stateToken
        // Saving → Feedback after 1000 ms; Feedback → gone after 3000 ms (Cards.kt timings).
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            guard let self, self.stateToken == token else { return }
            self.showFeedback()
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak self] in
                guard let self, self.stateToken == token else { return }
                self.onDismiss?()
            }
        }
    }

    private func showFeedback() {
        selectState = .feedback
        body.isHidden = true
        confirmBar.removeFromSuperview()
        feedbackView.arrangedSubviews.forEach { $0.removeFromSuperview() }
        feedbackView.axis = .vertical
        feedbackView.alignment = .center
        feedbackView.spacing = 16
        feedbackView.isLayoutMarginsRelativeArrangement = true
        feedbackView.layoutMargins = UIEdgeInsets(top: 24, left: 40, bottom: 24, right: 40)
        let check = UIImageView(image: UIImage(systemName: "checkmark", withConfiguration: UIImage.SymbolConfiguration(pointSize: 20, weight: .semibold)))
        check.tintColor = .white
        check.contentMode = .center
        check.backgroundColor = FCUITheme.green500
        check.layer.cornerRadius = 20
        check.translatesAutoresizingMaskIntoConstraints = false
        check.widthAnchor.constraint(equalToConstant: 40).isActive = true
        check.heightAnchor.constraint(equalToConstant: 40).isActive = true
        let text = UILabel()
        text.fcSetText(fcuiLabel(FCLabels.thankYouYourAnswerHelpsUsGiveMoreAccurateAdvice, "Thank you. Your answer helps us give more accurate advice."), style: FCUITypography.current.bodyLarge)
        text.textColor = FCUITheme.foregroundPrimary
        text.textAlignment = .center
        text.numberOfLines = 0
        text.alpha = 0
        feedbackView.addArrangedSubview(check)
        feedbackView.addArrangedSubview(text)
        container.addArrangedSubview(feedbackView)
        check.transform = CGAffineTransform(scaleX: 0.3, y: 0.3)
        UIView.animate(withDuration: 0.5, delay: 0, usingSpringWithDamping: 0.5, initialSpringVelocity: 0) {
            check.transform = .identity
        }
        UIView.animate(withDuration: 0.4, delay: 0.15) { text.alpha = 1 }
        invalidateCardLayout()
    }

    /// Self-sizing: tell the compositional layout the card's height changed.
    private func invalidateCardLayout() {
        invalidateIntrinsicContentSize()
        (superview as? UICollectionView)?.collectionViewLayout.invalidateLayout()
    }
}

// MARK: - Voice recording sheet

final class FCUIVoiceRecordingViewController: UIViewController {
    private let recorder: AudioRecorderService
    private let onFinished: (RecordedClip) -> Void
    private let timeLabel = UILabel()
    private var cancellables = Set<AnyCancellable>()

    init(recorder: AudioRecorderService, onFinished: @escaping (RecordedClip) -> Void) {
        self.recorder = recorder
        self.onFinished = onFinished
        super.init(nibName: nil, bundle: nil)
        modalPresentationStyle = .pageSheet
        if let sheet = sheetPresentationController {
            sheet.detents = [.medium()]
        }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = FCUITheme.surfacePrimary

        let title = UILabel()
        title.text = fcuiLabel("voice_listening", "Listening…")
        title.font = FCUITypography.current.titleMedium.font
        title.textColor = FCUITheme.foregroundPrimary
        title.textAlignment = .center

        timeLabel.font = .monospacedDigitSystemFont(ofSize: 17, weight: .regular)
        timeLabel.textColor = FCUITheme.foregroundSecondary
        timeLabel.textAlignment = .center
        timeLabel.text = "0:00"

        let cancel = UIButton(type: .system)
        cancel.setImage(UIImage(systemName: "xmark"), for: .normal)
        cancel.tintColor = FCUITheme.foregroundPrimary
        cancel.accessibilityLabel = fcuiLabel(FCLabels.cancel, "Cancel")
        cancel.accessibilityIdentifier = "fcVoiceCancel"
        cancel.addAction(UIAction { [weak self] _ in
            self?.recorder.cancelRecording()
            self?.dismiss(animated: true)
        }, for: .touchUpInside)

        let done = UIButton(type: .system)
        done.setImage(UIImage(systemName: "checkmark"), for: .normal)
        done.tintColor = .white
        // VoiceOver read the bare glyph as "selected".
        done.accessibilityLabel = fcuiLabel(FCLabels.send, "Send")
        done.accessibilityIdentifier = "fcVoiceSend"
        done.backgroundColor = FCUITheme.buttonPrimarySurface
        done.layer.cornerRadius = 34
        done.heightAnchor.constraint(equalToConstant: 68).isActive = true
        done.widthAnchor.constraint(equalToConstant: 68).isActive = true
        done.addAction(UIAction { [weak self] _ in
            guard let self else { return }
            guard let clip = try? self.recorder.stopRecording() else {
                self.dismiss(animated: true)
                return
            }
            self.dismiss(animated: true) { self.onFinished(clip) }
        }, for: .touchUpInside)

        let buttonRow = UIStackView(arrangedSubviews: [cancel, done])
        buttonRow.axis = .horizontal
        buttonRow.spacing = 48
        buttonRow.alignment = .center

        let stack = UIStackView(arrangedSubviews: [title, timeLabel, buttonRow])
        stack.axis = .vertical
        stack.spacing = 24
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])

        recorder.$elapsedSeconds
            .receive(on: DispatchQueue.main)
            .sink { [weak self] seconds in
                let total = Int(seconds)
                self?.timeLabel.text = String(format: "%d:%02d", total / 60, total % 60)
            }
            .store(in: &cancellables)

        try? recorder.startRecording()
    }
}
#endif
