#if canImport(UIKit)
import UIKit
import SwiftUI
import FarmerChatCore

// MARK: - Chat bubble cell (user / AI / loading)

final class FCUIChatBubbleCell: UICollectionViewCell {
    var onRetry: (() -> Void)?
    var onListen: (() -> Void)?
    var onShare: ((String) -> Void)?
    var onPlayClip: ((URL, String) -> Void)?

    private let bubble = UIView()
    private let textLabel = UILabel()
    private let imageView = UIImageView()
    private let clipButton = UIButton(type: .system)
    private let failedLabel = UILabel()
    private let actionsRow = UIStackView()
    private let spinner = UIActivityIndicatorView(style: .medium)
    private var leadingConstraint: NSLayoutConstraint!
    private var trailingConstraint: NSLayoutConstraint!
    private var imageTask: URLSessionDataTask?
    private var currentText = ""

    override init(frame: CGRect) {
        super.init(frame: frame)
        // Chat UI customization (nil = current defaults 18 / 16).
        let cfg = FarmerChat.shared.config
        bubble.layer.cornerRadius = cfg.bubbleCornerRadius ?? 18
        bubble.layer.cornerCurve = .continuous
        bubble.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(bubble)

        textLabel.numberOfLines = 0
        textLabel.font = .systemFont(ofSize: cfg.messageFontSize ?? 16)

        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        imageView.layer.cornerRadius = 12
        imageView.isHidden = true
        imageView.heightAnchor.constraint(equalToConstant: 150).isActive = true

        clipButton.setImage(UIImage(systemName: "play.fill"), for: .normal)
        clipButton.tintColor = .white
        clipButton.setTitle("  " + fcuiLabel("voice_clip", "Voice message"), for: .normal)
        clipButton.setTitleColor(.white, for: .normal)
        clipButton.isHidden = true

        failedLabel.font = .systemFont(ofSize: 12)
        failedLabel.textColor = FCUITheme.red500
        failedLabel.isHidden = true

        actionsRow.axis = .horizontal
        actionsRow.spacing = 18
        actionsRow.isHidden = true

        spinner.hidesWhenStopped = true

        let stack = UIStackView(arrangedSubviews: [imageView, clipButton, textLabel, failedLabel, actionsRow, spinner])
        stack.axis = .vertical
        stack.spacing = 8
        stack.isLayoutMarginsRelativeArrangement = true
        stack.layoutMargins = UIEdgeInsets(top: 12, left: 14, bottom: 12, right: 14)
        stack.translatesAutoresizingMaskIntoConstraints = false
        bubble.addSubview(stack)

        leadingConstraint = bubble.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16)
        trailingConstraint = bubble.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16)
        NSLayoutConstraint.activate([
            bubble.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 6),
            bubble.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -6),
            bubble.widthAnchor.constraint(lessThanOrEqualTo: contentView.widthAnchor, multiplier: 0.86),
            stack.topAnchor.constraint(equalTo: bubble.topAnchor),
            stack.bottomAnchor.constraint(equalTo: bubble.bottomAnchor),
            stack.leadingAnchor.constraint(equalTo: bubble.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: bubble.trailingAnchor)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func prepareForReuse() {
        super.prepareForReuse()
        imageTask?.cancel()
        imageView.image = nil
        actionsRow.arrangedSubviews.forEach { $0.removeFromSuperview() }
    }

    func configure(message: ChatMessage, isTtsEnabled: Bool, playback: AudioPlaybackService) {
        switch message {
        case .user(let user):
            currentText = user.text
            alignRight(true)
            bubble.backgroundColor = FarmerChat.shared.config.userBubbleColor.map(UIColor.init) ?? FCUITheme.brandSurfacePrimary
            textLabel.textColor = FarmerChat.shared.config.userBubbleTextColor.map(UIColor.init) ?? .white
            textLabel.text = user.text
            textLabel.isHidden = user.text.isEmpty
            spinner.stopAnimating()
            failedLabel.isHidden = !user.isFailed
            failedLabel.text = fcuiLabel("message_failed", "Not sent")
            actionsRow.isHidden = true
            configureImage(user.imageURL)
            clipButton.isHidden = user.audioURL == nil
            if let audioURL = user.audioURL {
                let clipId = "clip_\(user.id)"
                let playing = playback.isPlaying(id: clipId)
                clipButton.setImage(UIImage(systemName: playing ? "pause.fill" : "play.fill"), for: .normal)
                clipButton.removeTarget(nil, action: nil, for: .allEvents)
                clipButton.addAction(UIAction { [weak self] _ in
                    self?.onPlayClip?(audioURL, clipId)
                }, for: .touchUpInside)
            }

        case .aiResponse(let ai):
            currentText = ai.text
            alignRight(false)
            bubble.backgroundColor = FCUITheme.surfaceReadingSecondary
            textLabel.textColor = FarmerChat.shared.config.aiBubbleTextColor.map(UIColor.init) ?? FCUITheme.foregroundPrimary
            textLabel.text = ai.text
            textLabel.isHidden = false
            spinner.stopAnimating()
            failedLabel.isHidden = true
            imageView.isHidden = true
            clipButton.isHidden = true
            buildActions(isTtsEnabled: isTtsEnabled && !ai.isPreGenerated)

        case .loadingPlaceholder:
            currentText = ""
            alignRight(false)
            bubble.backgroundColor = FCUITheme.surfaceReadingSecondary
            textLabel.text = fcuiLabel("getting_your_answer", "Getting your answer…")
            textLabel.textColor = FCUITheme.foregroundSecondary
            textLabel.isHidden = false
            spinner.startAnimating()
            failedLabel.isHidden = true
            imageView.isHidden = true
            clipButton.isHidden = true
            actionsRow.isHidden = true
        }
    }

    private func alignRight(_ right: Bool) {
        leadingConstraint.isActive = !right
        trailingConstraint.isActive = right
        if right {
            leadingConstraint.isActive = false
            trailingConstraint.isActive = true
        } else {
            trailingConstraint.isActive = false
            leadingConstraint.isActive = true
        }
    }

    private func configureImage(_ url: URL?) {
        guard let url else {
            imageView.isHidden = true
            return
        }
        imageView.isHidden = false
        if url.isFileURL {
            imageView.image = UIImage(contentsOfFile: url.path)
        } else {
            imageTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
                guard let data, let image = UIImage(data: data) else { return }
                DispatchQueue.main.async { self?.imageView.image = image }
            }
            imageTask?.resume()
        }
    }

    private func buildActions(isTtsEnabled: Bool) {
        actionsRow.arrangedSubviews.forEach { $0.removeFromSuperview() }
        actionsRow.isHidden = false
        if isTtsEnabled {
            actionsRow.addArrangedSubview(makeActionChip(
                systemImage: "speaker.wave.2.fill",
                title: fcuiLabel("listen", "Listen"),
                action: { [weak self] in self?.onListen?() }
            ))
        }
        actionsRow.addArrangedSubview(makeActionChip(
            systemImage: "square.and.arrow.up",
            title: fcuiLabel("share", "Share"),
            action: { [weak self] in
                guard let self else { return }
                self.onShare?(self.currentText)
            }
        ))
        actionsRow.addArrangedSubview(UIView())
    }

    /// Cleaner bordered brand-accent action chip (Share / Listen).
    private func makeActionChip(systemImage: String, title: String, action: @escaping () -> Void) -> UIButton {
        let accent = FCUITheme.brandAccent
        var config = UIButton.Configuration.plain()
        config.image = UIImage(systemName: systemImage, withConfiguration: UIImage.SymbolConfiguration(pointSize: 13, weight: .semibold))
        config.title = title
        config.imagePadding = 6
        config.baseForegroundColor = FCUITheme.foregroundSecondary
        config.imageColorTransformer = UIConfigurationColorTransformer { _ in accent }
        config.background.backgroundColor = FCUITheme.surfaceSecondary
        config.background.cornerRadius = 20
        config.background.strokeColor = accent.withAlphaComponent(0.28)
        config.background.strokeWidth = 1
        config.contentInsets = NSDirectionalEdgeInsets(top: 9, leading: 14, bottom: 9, trailing: 14)
        let button = UIButton(configuration: config)
        button.titleLabel?.font = .systemFont(ofSize: 13, weight: .semibold)
        button.addAction(UIAction { _ in action() }, for: .touchUpInside)
        return button
    }
}

// MARK: - Follow-up chip cell

final class FCUIFollowUpChipCell: UICollectionViewCell {
    var onTap: (() -> Void)?
    private let card = UIView()
    private let label = UILabel()
    private let affordance = UIView()
    private let arrow = UIImageView()

    override init(frame: CGRect) {
        super.init(frame: frame)
        // Modern tappable suggestion card: card surface, brand-accent hairline
        // border, comfortable ≥44pt touch target, trailing accent "ask"
        // affordance. Recolors with host theme (accent = brandAccent token).
        let accent = FCUITheme.brandAccent

        card.backgroundColor = FCUITheme.surfaceSecondary
        card.layer.cornerRadius = 16
        card.layer.cornerCurve = .continuous
        card.layer.borderWidth = 1
        card.layer.borderColor = accent.withAlphaComponent(0.35).cgColor
        card.translatesAutoresizingMaskIntoConstraints = false

        label.font = .systemFont(ofSize: 16)
        label.textColor = FCUITheme.foregroundPrimary
        label.numberOfLines = 0
        label.translatesAutoresizingMaskIntoConstraints = false

        affordance.backgroundColor = accent.withAlphaComponent(0.16)
        affordance.layer.cornerRadius = 15
        affordance.translatesAutoresizingMaskIntoConstraints = false
        arrow.image = UIImage(systemName: "arrow.right", withConfiguration: UIImage.SymbolConfiguration(pointSize: 13, weight: .semibold))
        arrow.tintColor = accent
        arrow.contentMode = .center
        arrow.translatesAutoresizingMaskIntoConstraints = false
        affordance.addSubview(arrow)

        card.addSubview(label)
        card.addSubview(affordance)
        contentView.addSubview(card)

        let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap))
        card.addGestureRecognizer(tap)
        card.isUserInteractionEnabled = true

        NSLayoutConstraint.activate([
            card.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 5),
            card.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -5),
            card.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            card.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16),
            card.heightAnchor.constraint(greaterThanOrEqualToConstant: 48),

            label.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            label.topAnchor.constraint(equalTo: card.topAnchor, constant: 12),
            label.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -12),
            label.centerYAnchor.constraint(equalTo: card.centerYAnchor),

            affordance.leadingAnchor.constraint(equalTo: label.trailingAnchor, constant: 12),
            affordance.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -10),
            affordance.centerYAnchor.constraint(equalTo: card.centerYAnchor),
            affordance.widthAnchor.constraint(equalToConstant: 30),
            affordance.heightAnchor.constraint(equalToConstant: 30),

            arrow.centerXAnchor.constraint(equalTo: affordance.centerXAnchor),
            arrow.centerYAnchor.constraint(equalTo: affordance.centerYAnchor)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func traitCollectionDidChange(_ previous: UITraitCollection?) {
        super.traitCollectionDidChange(previous)
        // Keep the accent border correct across light/dark.
        card.layer.borderColor = FCUITheme.brandAccent.withAlphaComponent(0.35).cgColor
    }

    @objc private func handleTap() { onTap?() }

    func configure(question: String) {
        label.text = question
    }
}

// MARK: - Inline error cell (retry under failed message)

final class FCUIInlineErrorCell: UICollectionViewCell {
    var onRetry: (() -> Void)?
    private let label = UILabel()
    private let retryButton = UIButton(type: .system)

    override init(frame: CGRect) {
        super.init(frame: frame)
        label.font = .systemFont(ofSize: 14)
        label.textColor = FCUITheme.red500
        label.numberOfLines = 0
        label.textAlignment = .center

        retryButton.setTitle(fcuiLabel("try_again", "Try again"), for: .normal)
        retryButton.setTitleColor(FCUITheme.brandSurfacePrimary, for: .normal)
        retryButton.titleLabel?.font = .systemFont(ofSize: 14, weight: .semibold)
        retryButton.addAction(UIAction { [weak self] _ in self?.onRetry?() }, for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [label, retryButton])
        stack.axis = .vertical
        stack.spacing = 6
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
            stack.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -8),
            stack.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    func configure(message: String) {
        label.text = message
    }
}
#endif
