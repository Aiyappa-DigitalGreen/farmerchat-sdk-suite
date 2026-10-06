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
        imageView.heightAnchor.constraint(equalToConstant: 170).isActive = true

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

        let titleRow = UIStackView(arrangedSubviews: [titleLabel, dismissButton])
        titleRow.axis = .horizontal
        titleRow.alignment = .top
        titleRow.spacing = 8

        let body = UIStackView(arrangedSubviews: [titleRow, statementLabel, optionsStack])
        body.axis = .vertical
        body.spacing = 8
        body.isLayoutMarginsRelativeArrangement = true
        body.layoutMargins = UIEdgeInsets(top: 14, left: 16, bottom: 14, right: 16)

        container.axis = .vertical
        container.addArrangedSubview(imageView)
        container.addArrangedSubview(body)
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
        optionsStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
    }

    @objc private func cellTapped() {
        // Selection cards use their own controls; only content cards navigate.
        guard section?.options?.isEmpty != false else { return }
        onTap?()
    }

    func configure(section: SectionDto) {
        self.section = section
        titleLabel.fcSetText(section.title ?? section.statement ?? section.questionText, style: FCUITypography.current.titleMedium)
        statementLabel.fcSetText(section.title != nil ? section.statement : nil, style: FCUITypography.current.bodyMedium)
        statementLabel.isHidden = statementLabel.text?.isEmpty != false

        // Image
        imageView.isHidden = true
        if let urlString = section.imageUrl, let url = URL(string: urlString) {
            imageView.isHidden = false
            imageTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
                guard let data, let image = UIImage(data: data) else { return }
                DispatchQueue.main.async { self?.imageView.image = image }
            }
            imageTask?.resume()
        }

        // Options (single/multi select)
        optionsStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        let options = section.options ?? []
        guard !options.isEmpty else { return }
        let isSingle = section.selectionType == "single" || section.type == "single_select"

        for option in options {
            var config = UIButton.Configuration.tinted()
            config.title = option.text
            config.baseForegroundColor = FCUITheme.foregroundPrimary
            config.baseBackgroundColor = FCUITheme.surfaceTertiary
            config.cornerStyle = .capsule
            let button = UIButton(configuration: config)
            button.addAction(UIAction { [weak self, weak button] _ in
                guard let self else { return }
                if isSingle {
                    self.onOptionSubmit?([option])
                } else {
                    if self.selectedOptionIds.contains(option.id) {
                        self.selectedOptionIds.remove(option.id)
                        button?.configuration?.baseBackgroundColor = FCUITheme.surfaceTertiary
                    } else {
                        self.selectedOptionIds.insert(option.id)
                        button?.configuration?.baseBackgroundColor = FCUITheme.surfaceActive
                    }
                }
            }, for: .touchUpInside)
            optionsStack.addArrangedSubview(button)
        }

        if !isSingle {
            let save = FCUIPrimaryButton(title: fcuiLabel(FCLabels.save, "Save"))
            save.addAction(UIAction { [weak self] _ in
                guard let self, let section = self.section else { return }
                let chosen = (section.options ?? []).filter { self.selectedOptionIds.contains($0.id) }
                guard !chosen.isEmpty else { return }
                self.onOptionSubmit?(chosen)
            }, for: .touchUpInside)
            optionsStack.addArrangedSubview(save)
        }
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
        cancel.addAction(UIAction { [weak self] _ in
            self?.recorder.cancelRecording()
            self?.dismiss(animated: true)
        }, for: .touchUpInside)

        let done = UIButton(type: .system)
        done.setImage(UIImage(systemName: "checkmark"), for: .normal)
        done.tintColor = .white
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
