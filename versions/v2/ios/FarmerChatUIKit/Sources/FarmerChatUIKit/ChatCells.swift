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
    /// "Read full advice" on a pre-generated answer (`.replacePreGeneratedWithQuestion`).
    var onReadFullAdvice: (() -> Void)?
    // ---- agentic streaming (2.0.0) ----
    /// Retry for an interrupted stream (`.retryLastRequest`).
    var onRetryStream: (() -> Void)?
    /// Tap handler for an ADDITIVE alignment surface rendered below the answer.
    var onAlignmentChipTap: ((AlignmentChip) -> Void)?
    /// Called when the stall hint appears/disappears on its own timer, outside a snapshot apply,
    /// so the owner can let the collection view re-measure this cell's height.
    var onLayoutInvalidated: (() -> Void)?

    private let bubble = UIView()
    private let textLabel = UILabel()
    private let imageView = UIImageView()
    private let clipButton = UIButton(type: .system)
    private let failedLabel = UILabel()
    private let actionsRow = UIStackView()
    private let spinner = UIActivityIndicatorView(style: .medium)
    /// Tool progress / "getting your answer" line while a stream is in flight.
    private let streamStatusView = FCUIStreamStatusView()
    /// Transient "paused, resuming" hint (client-side only, never a failure).
    private let stallHint = FCUIStreamStallHintView()
    /// ADDITIVE alignment surface: a nudge below a real answer.
    private let additiveSurface = FCUIAlignmentSurfaceView()
    /// Interrupted-stream card with the "Try again" action.
    private let streamErrorCard = FCUIStreamErrorCardView()
    /// StreamErrorCard.kt `padding(top = 16)`: 8 of stack spacing + 8 here.
    private lazy var streamErrorWrap = FCUIInsetView(streamErrorCard, top: 8)
    /// ChatThreadContent.kt: `Spacer(16)` before the additive surface (8 + 8).
    private lazy var additiveWrap = FCUIInsetView(additiveSurface, top: 8)
    private var leadingConstraint: NSLayoutConstraint!
    private var trailingConstraint: NSLayoutConstraint!
    /// User row: `Row(padding(start = 64))` inside the 20pt list gutter, bubble `widthIn(max 290)`.
    private var userLeadingMinConstraint: NSLayoutConstraint!
    private var userMaxWidthConstraint: NSLayoutConstraint!
    private var aiMaxWidthConstraint: NSLayoutConstraint!
    /// The message whose "Read full advice" wobble has already been scheduled (once per answer).
    private var wobbledMessageId: String?
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
        textLabel.font = FCUITypography.current.bodyMedium(atSize: cfg.messageFontSize ?? 17).font

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

        failedLabel.font = FCUITypography.current.labelSmall.font
        failedLabel.textColor = FCUITheme.red500
        failedLabel.isHidden = true

        // Vertical: either the lone "Read full advice" button, or the "AI may be wrong" note
        // above the Share / Listen pills (ChatResponseActions.kt, app dev/v2.5). The column sits
        // 24 below the answer (`padding(top = 24)`: 8 stack spacing + 16 margin).
        actionsRow.axis = .vertical
        actionsRow.alignment = .fill
        actionsRow.spacing = 12
        actionsRow.isLayoutMarginsRelativeArrangement = true
        actionsRow.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 16, leading: 0, bottom: 1, trailing: 0)
        actionsRow.isHidden = true

        spinner.hidesWhenStopped = true

        // Agentic subviews, in the same vertical order SwiftUI's FCAiResponseBubble uses:
        // answer text → tool progress → stall hint → additive surface → stream error card →
        // action row.
        streamStatusView.isHidden = true
        additiveWrap.isHidden = true
        streamErrorWrap.isHidden = true
        streamErrorCard.onRetry = { [weak self] in self?.onRetryStream?() }
        additiveSurface.onChipTap = { [weak self] chip in self?.onAlignmentChipTap?(chip) }
        stallHint.onStallChanged = { [weak self] in self?.onLayoutInvalidated?() }

        let stack = UIStackView(arrangedSubviews: [
            imageView, clipButton, textLabel, failedLabel,
            streamStatusView, stallHint, streamErrorWrap,
            actionsRow, additiveWrap, spinner
        ])
        stack.axis = .vertical
        stack.spacing = 8
        stack.isLayoutMarginsRelativeArrangement = true
        stack.layoutMargins = UIEdgeInsets(top: 12, left: 14, bottom: 12, right: 14)
        stack.translatesAutoresizingMaskIntoConstraints = false
        bubble.addSubview(stack)

        // ChatThreadContent.kt: LazyColumn padding(horizontal = 20), spacedBy(16) — 8 + 8 here.
        leadingConstraint = bubble.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20)
        trailingConstraint = bubble.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20)
        userLeadingMinConstraint = bubble.leadingAnchor.constraint(greaterThanOrEqualTo: contentView.leadingAnchor, constant: 20 + 64)
        userMaxWidthConstraint = bubble.widthAnchor.constraint(lessThanOrEqualToConstant: 290)
        aiMaxWidthConstraint = bubble.widthAnchor.constraint(lessThanOrEqualTo: contentView.widthAnchor, multiplier: 0.86)
        NSLayoutConstraint.activate([
            bubble.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
            bubble.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -8),
            aiMaxWidthConstraint,
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
        // A recycled cell must not keep a stall countdown (or a shown hint) from another message.
        stallHint.reset()
        streamStatusView.isHidden = true
        additiveWrap.isHidden = true
        streamErrorWrap.isHidden = true
        actionsRow.layer.removeAllAnimations()
        actionsRow.transform = .identity
    }

    /// - Parameters:
    ///   - isLatest: true for the newest AI message in the thread — gates the stream error card's
    ///     retry and an alignment surface's escape hatch (2.0.0).
    ///   - isBusy: thread-level busy flag; locks alignment chips while a send is in flight.
    ///   - readFullAdviceAvailable: the latest pre-generated answer can still be expanded — it
    ///     then shows ONLY the "Read full advice" button in place of the action row.
    func configure(
        message: ChatMessage,
        isTtsEnabled: Bool,
        playback: AudioPlaybackService,
        isLatest: Bool = false,
        isBusy: Bool = false,
        readFullAdviceAvailable: Bool = false
    ) {
        switch message {
        case .user(let user):
            currentText = user.text
            alignRight(true)
            bubble.backgroundColor = FarmerChat.shared.config.userBubbleColor.map(UIColor.init) ?? FCUITheme.brandSurfacePrimary
            textLabel.textColor = FarmerChat.shared.config.userBubbleTextColor.map(UIColor.init) ?? .white
            textLabel.fcSetText(user.text, style: FCUITypography.current.bodyMedium(atSize: FarmerChat.shared.config.messageFontSize ?? 17))
            textLabel.isHidden = user.text.isEmpty
            spinner.stopAnimating()
            failedLabel.isHidden = !user.isFailed
            failedLabel.text = fcuiLabel("message_failed", "Not sent")
            actionsRow.isHidden = true
            hideAgenticViews()
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
            // A streaming answer grows IN PLACE with no typewriter/reveal animation — the text
            // already arrives token by token (2.0.0).
            textLabel.fcSetText(ai.text, style: FCUITypography.current.bodyMedium(atSize: FarmerChat.shared.config.messageFontSize ?? 17))
            textLabel.isHidden = ai.text.isEmpty
            spinner.stopAnimating()
            failedLabel.isHidden = true
            imageView.isHidden = true
            clipButton.isHidden = true

            let status = (ai.streamingStatus ?? "").trimmingCharacters(in: .whitespaces)
            // Tool progress, or the initial "getting your answer" state before any text arrived.
            let showStatus = ai.isStreaming && (ai.text.isEmpty || !status.isEmpty)
            streamStatusView.isHidden = !showStatus
            if showStatus {
                streamStatusView.configure(text: status.isEmpty
                    ? fcuiLabel(AgenticLabels.gettingYourAnswer, AgenticLabels.gettingYourAnswerFallback)
                    : status)
            }

            // Text is flowing but has stalled with no tool status: a transient client-side hint,
            // NOT a failure. Keyed on the text length so the next delta clears it automatically.
            stallHint.update(
                active: ai.isStreaming && !ai.text.isEmpty && status.isEmpty,
                textLength: ai.text.count
            )

            // ADDITIVE surface: a nudge below the real answer (gender-select / commodity-confirm),
            // AFTER the action block and never while the answer is still streaming.
            if let kind = ai.alignmentKind, kind.isAdditive, !ai.isStreaming {
                additiveWrap.isHidden = false
                additiveSurface.configure(
                    kind: kind,
                    message: ai.alignmentMessage ?? "",
                    chips: ai.alignmentChips ?? [],
                    selectedValues: ai.alignmentSelectedValues,
                    isLoading: isBusy,
                    isLatest: isLatest,
                    additive: true
                )
            } else {
                additiveWrap.isHidden = true
            }

            // Interrupted terminal state: keep any partial answer above and offer retry. Only the
            // latest answer shows the card — an older failed question keeps its partial text but
            // drops the retry action.
            let showErrorCard = ai.isInterrupted && isLatest
            streamErrorWrap.isHidden = !showErrorCard
            if showErrorCard {
                streamErrorCard.configure(
                    errorKind: ai.streamErrorKind ?? .unknown,
                    hasPartial: !ai.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                )
            }

            if ai.isStreaming || ai.isInterrupted || !isLatest {
                // No actions on an in-flight or broken answer, and — app parity
                // (ChatThreadContent.kt `isLastResponse`) — only the latest answer carries them.
                actionsRow.arrangedSubviews.forEach { $0.removeFromSuperview() }
                actionsRow.isHidden = true
            } else {
                // Listen needs a server message id to synthesise (core's synthesiseAudio no-ops
                // without one, e.g. on a pre-generated answer) — same gate as SwiftUI and web.
                // TTS off no longer hides it: ListenButton draws it dimmed (alpha 0.4).
                let wasHidden = actionsRow.isHidden
                buildActions(
                    showListen: ai.messageId != nil,
                    listenEnabled: isTtsEnabled,
                    readFullAdvice: readFullAdviceAvailable,
                    messageId: ai.id
                )
                // ChatThreadContent.kt: the block's AnimatedVisibility enter is fadeIn() only.
                if wasHidden {
                    actionsRow.alpha = 0
                    UIView.animate(withDuration: 0.3) { self.actionsRow.alpha = 1 }
                }
            }

        // 2.0.0: a location message is routed to `FCUILocationBubbleCell` by
        // `FCUIChatViewController.row(for:)`, so it never reaches this cell. Handled defensively
        // (right-aligned address text) rather than left as a blank bubble if that routing ever
        // regresses.
        case .location(let location):
            currentText = location.address
            alignRight(true)
            bubble.backgroundColor = FCUITheme.surfaceReadingSecondary
            textLabel.textColor = FCUITheme.foregroundPrimary
            textLabel.fcSetText(location.address, style: FCUITypography.current.bodyMedium)
            textLabel.isHidden = location.address.isEmpty
            spinner.stopAnimating()
            failedLabel.isHidden = true
            imageView.isHidden = true
            clipButton.isHidden = true
            actionsRow.isHidden = true
            hideAgenticViews()

        case .loadingPlaceholder:
            // App parity (ChatThreadContent.kt LoadingPlaceholder): a bare LogoSpinnerHorizontal
            // with the shimmering primary-colour label — no bubble, no muted text, no dots.
            currentText = ""
            alignRight(false)
            bubble.backgroundColor = .clear
            textLabel.text = nil
            textLabel.isHidden = true
            spinner.stopAnimating()
            failedLabel.isHidden = true
            imageView.isHidden = true
            clipButton.isHidden = true
            actionsRow.isHidden = true
            hideAgenticViews()
            // After hideAgenticViews(), which hides the status view.
            streamStatusView.configure(text: fcuiLabel(FCLabels.gettingYourAnswer, "Getting your answer…"))
            streamStatusView.isHidden = false
        }
    }

    /// Collapses every 2.0.0 surface (and cancels the stall countdown) for a non-AI row.
    private func hideAgenticViews() {
        stallHint.reset()
        streamStatusView.isHidden = true
        additiveWrap.isHidden = true
        streamErrorWrap.isHidden = true
    }

    private func alignRight(_ right: Bool) {
        if right {
            leadingConstraint.isActive = false
            aiMaxWidthConstraint.isActive = false
            trailingConstraint.isActive = true
            userLeadingMinConstraint.isActive = true
            userMaxWidthConstraint.isActive = true
        } else {
            trailingConstraint.isActive = false
            userLeadingMinConstraint.isActive = false
            userMaxWidthConstraint.isActive = false
            leadingConstraint.isActive = true
            aiMaxWidthConstraint.isActive = true
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

    /// App parity (ChatResponseActions.kt, app dev/v2.5): EXCLUSIVE branches. A pre-generated
    /// answer whose "Read full advice" is available shows ONLY that primary button; every other
    /// answer — agentic, legacy and pre-generated alike (`useChips = true` everywhere) — shows the
    /// "AI may be wrong" note above compact Share (accent sweep ring) + Listen pills. No Save.
    private func buildActions(showListen: Bool, listenEnabled: Bool, readFullAdvice: Bool, messageId: String) {
        actionsRow.arrangedSubviews.forEach { $0.removeFromSuperview() }
        actionsRow.isHidden = false

        if readFullAdvice {
            // `Spacer(16)` below the button replaces the row's `Spacer(1)`.
            actionsRow.directionalLayoutMargins.bottom = 16
            let button = FCUIPrimaryButton(title: fcuiLabel(FCLabels.readFullAdvice, "Read full advice"))
            button.addAction(UIAction { [weak self] _ in self?.onReadFullAdvice?() }, for: .touchUpInside)
            actionsRow.addArrangedSubview(button)
            if wobbledMessageId != messageId {
                wobbledMessageId = messageId
                Self.attentionWobble(button, delay: 1.8)
            }
            return
        }
        actionsRow.directionalLayoutMargins.bottom = 1

        let infoIcon = UIImageView(image: UIImage(
            systemName: "info.circle",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 15, weight: .regular)
        ))
        infoIcon.tintColor = FCUITheme.brandAccent
        infoIcon.setContentHuggingPriority(.required, for: .horizontal)
        let warning = UILabel()
        warning.font = FCUITypography.current.labelSmall.font
        warning.textColor = FCUITheme.foregroundSecondary
        warning.numberOfLines = 0
        warning.text = fcuiLabel(FCLabels.aiMayBeWrongPleaseDoubleCheck, "AI may be wrong. Please double-check.")
        let warningRow = UIStackView(arrangedSubviews: [infoIcon, warning])
        warningRow.axis = .horizontal
        warningRow.spacing = 6
        warningRow.alignment = .center
        actionsRow.addArrangedSubview(warningRow)

        let pills = UIStackView()
        pills.axis = .horizontal
        pills.spacing = 8
        pills.alignment = .center
        pills.addArrangedSubview(fcuiActionChip(
            systemImage: "square.and.arrow.up",
            title: fcuiLabel(FCLabels.shareDownload, "Share"),
            sweepBorder: true,
            action: { [weak self] in
                guard let self else { return }
                self.onShare?(self.currentText)
            }
        ))
        if showListen {
            pills.addArrangedSubview(fcuiActionChip(
                systemImage: "speaker.wave.2.fill",
                title: fcuiLabel(FCLabels.listen, "Listen"),
                enabled: listenEnabled,
                action: { [weak self] in self?.onListen?() }
            ))
        }
        pills.addArrangedSubview(UIView())
        actionsRow.addArrangedSubview(pills)
    }

    /// `Modifier.attentionWobble(delayMs = 1800)` defaults: one bounce (spring to 0.95 and back),
    /// then two rotation cycles of ±1.5° (60 / 120 / 60 ms, EaseInOut). The app also gates it on
    /// remote config + a once-per-day card-click rule; the SDK has neither, so it always runs once.
    private static func attentionWobble(_ view: UIView, delay: TimeInterval) {
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak view] in
            guard let view, view.window != nil else { return }
            UIView.animate(withDuration: 0.12, delay: 0, usingSpringWithDamping: 0.7, initialSpringVelocity: 0, options: [], animations: {
                view.transform = CGAffineTransform(scaleX: 0.95, y: 0.95)
            }) { _ in
                UIView.animate(withDuration: 0.35, delay: 0, usingSpringWithDamping: 0.35, initialSpringVelocity: 0, options: [], animations: {
                    view.transform = .identity
                }) { _ in
                    let angle = 1.5 * CGFloat.pi / 180
                    UIView.animateKeyframes(withDuration: 0.48, delay: 0, options: [.calculationModeCubic], animations: {
                        for cycle in 0..<2 {
                            let base = Double(cycle) * 0.5
                            UIView.addKeyframe(withRelativeStartTime: base, relativeDuration: 0.125) {
                                view.transform = CGAffineTransform(rotationAngle: angle)
                            }
                            UIView.addKeyframe(withRelativeStartTime: base + 0.125, relativeDuration: 0.25) {
                                view.transform = CGAffineTransform(rotationAngle: -angle)
                            }
                            UIView.addKeyframe(withRelativeStartTime: base + 0.375, relativeDuration: 0.125) {
                                view.transform = .identity
                            }
                        }
                    })
                }
            }
        }
    }
}

/// The Share pill's accent ring: a conic gradient — green at 12 o'clock, cyan at 3, green at 6,
/// yellow at 9 (SwiftUI `FCBrandColors.accentSweepBorder`, app `ColorBrandSemantic.kt`) —
/// stroked 3pt INSIDE the pill's rounded outline, as Compose's `Modifier.border` does.
final class FCUISweepBorderView: UIView {
    private static let lineWidth: CGFloat = 3
    // Fixed design primitives, exactly as SwiftUI's FCPrimitive.green500 / cyan400 / yellow300.
    private static let green = FCUITheme.green500
    private static let cyan = UIColor(rgb: 0x22D3EE)
    private static let yellow = UIColor(rgb: 0xFFF947)

    private let cornerRadius: CGFloat
    private let gradient = CAGradientLayer()
    private let ringMask = CAShapeLayer()

    init(cornerRadius: CGFloat) {
        self.cornerRadius = cornerRadius
        super.init(frame: .zero)
        isUserInteractionEnabled = false
        gradient.type = .conic
        gradient.startPoint = CGPoint(x: 0.5, y: 0.5)
        gradient.endPoint = CGPoint(x: 0.5, y: 0)
        gradient.colors = [Self.green, Self.cyan, Self.green, Self.yellow, Self.green].map(\.cgColor)
        gradient.locations = [0, 0.25, 0.5, 0.75, 1]
        ringMask.fillColor = UIColor.clear.cgColor
        ringMask.strokeColor = UIColor.black.cgColor
        ringMask.lineWidth = Self.lineWidth
        gradient.mask = ringMask
        layer.addSublayer(gradient)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func layoutSubviews() {
        super.layoutSubviews()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        gradient.frame = bounds
        ringMask.frame = bounds
        let inset = Self.lineWidth / 2
        let rect = bounds.insetBy(dx: inset, dy: inset)
        // The stroke runs along `rect` (already inset by half the line), so its radius is the
        // pill's own radius less that half-width — subtracting from rect's height would inset twice.
        let radius = min(cornerRadius, bounds.height / 2) - inset
        ringMask.path = UIBezierPath(roundedRect: rect, cornerRadius: max(radius, 0)).cgPath
        CATransaction.commit()
    }
}

// MARK: - Follow-up section (ChatResponseActions.kt follow-ups)

/// The follow-up title: `Spacer(16)`, a titleMedium foregroundPrimary title (no dot), `Spacer(10)`.
/// The answer cell above ends 8pt below its bubble, so the title adds 8 + 2 (the first chip cell
/// adds its own 4 + 4 → 10 to the chip).
final class FCUIFollowUpTitleCell: UICollectionViewCell {
    private let label = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        label.numberOfLines = 0
        label.textColor = FCUITheme.foregroundPrimary
        label.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(label)
        NSLayoutConstraint.activate([
            label.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
            label.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -6),
            label.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            label.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    func configure(title: String) {
        label.textColor = FCUITheme.foregroundPrimary
        label.fcSetText(title, style: FCUITypography.current.titleMedium)
        // AnimatedVisibility(fadeIn(tween(300))).
        contentView.alpha = 0
        UIView.animate(withDuration: 0.3) { self.contentView.alpha = 1 }
    }
}

final class FCUIFollowUpChipCell: UICollectionViewCell {
    var onTap: (() -> Void)?
    private let chip = FCUIAlignmentChipView()
    private var bottomConstraint: NSLayoutConstraint!

    override init(frame: CGRect) {
        super.init(frame: frame)
        // App parity (ChatResponseActions.kt, app dev/v2.5 — `useChips = true` for every answer):
        // follow-ups are ALWAYS numbered chips, never the legacy suggestion cards. 8 apart (4+4).
        chip.translatesAutoresizingMaskIntoConstraints = false
        chip.addAction(UIAction { [weak self] _ in self?.onTap?() }, for: .touchUpInside)
        contentView.addSubview(chip)
        bottomConstraint = chip.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -4)
        NSLayoutConstraint.activate([
            chip.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 4),
            bottomConstraint,
            chip.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            chip.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    /// - Parameters:
    ///   - number: 1-based position in the follow-up list (the chip's badge).
    ///   - clarificationRequired: clarify moment → green Agentic accent, else neutral Suggested.
    ///   - isLast: the last chip carries the section's trailing `Spacer(28) + Spacer(12)`.
    func configure(question: String, number: Int, clarificationRequired: Bool, isLast: Bool = false) {
        chip.configure(
            label: question,
            number: number,
            type: clarificationRequired ? .agentic : .suggested,
            selected: false,
            enabled: true
        )
        bottomConstraint.constant = isLast ? -40 : -4
        chip.accessibilityLabel = question
        chip.accessibilityHint = fcuiLabel(FCLabels.ask, "Ask")
        chip.isAccessibilityElement = true
        chip.accessibilityTraits = .button
        contentView.alpha = 0
        UIView.animate(withDuration: 0.3) { self.contentView.alpha = 1 }
    }
}

// MARK: - Inline error cell (InlineErrorContent.kt — under the failed question)

/// Port of `InlineErrorContent.kt`: Row(fillMaxWidth, padding start 4, CenterVertically) —
/// [48pt feedbackFail circle + white Close 24], 12, the FIXED "Something went wrong" label
/// (bodyMedium, foregroundPrimary, weight 1), 8, a "Try again" pill (surfaceTertiary, radius 12,
/// padding 10/12, spacedBy 4: Refresh 16 + labelMedium). The raw error string is never shown.
///
/// A failed VOICE question gets `LogoSpinnerHorizontal(state = Retry)` instead, right-aligned:
/// a surfaceTertiary radius-12 pill (padding 10/14/10/10, spacedBy 6: Refresh 23 + labelMedium).
final class FCUIInlineErrorCell: UICollectionViewCell {
    var onRetry: (() -> Void)?
    private let icon = UIView()
    private let label = UILabel()
    private let pill = UIControl()
    private let pillIcon = UIImageView()
    private let pillLabel = UILabel()
    private let pillRow = UIStackView()
    private var pillInsets: [NSLayoutConstraint] = []
    private var pillIconSize: [NSLayoutConstraint] = []
    private let row = UIStackView()
    private let spacerBeforePill = UIView()

    override init(frame: CGRect) {
        super.init(frame: frame)
        icon.backgroundColor = FCUITheme.red500
        icon.layer.cornerRadius = 24
        let close = UIImageView(image: UIImage(
            systemName: "xmark",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 18, weight: .bold)
        ))
        close.tintColor = .white
        close.translatesAutoresizingMaskIntoConstraints = false
        icon.addSubview(close)
        icon.translatesAutoresizingMaskIntoConstraints = false

        label.numberOfLines = 0
        label.setContentHuggingPriority(.defaultLow, for: .horizontal)
        label.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        pill.backgroundColor = FCUITheme.surfaceTertiary
        pill.layer.cornerRadius = 12
        pill.layer.cornerCurve = .continuous
        pillIcon.tintColor = FCUITheme.foregroundPrimary
        pillIcon.contentMode = .center
        pillIcon.translatesAutoresizingMaskIntoConstraints = false
        pillLabel.font = FCUITypography.current.labelMedium.font
        pillLabel.textColor = FCUITheme.foregroundPrimary
        pillLabel.text = fcuiLabel(AgenticLabels.tryAgain, AgenticLabels.tryAgainFallback)
        pillRow.addArrangedSubview(pillIcon)
        pillRow.addArrangedSubview(pillLabel)
        pillRow.axis = .horizontal
        pillRow.alignment = .center
        pillRow.isUserInteractionEnabled = false
        pillRow.translatesAutoresizingMaskIntoConstraints = false
        pill.addSubview(pillRow)
        pill.setContentHuggingPriority(.required, for: .horizontal)
        pill.setContentCompressionResistancePriority(.required, for: .horizontal)
        pill.isAccessibilityElement = true
        pill.accessibilityTraits = .button
        pill.accessibilityLabel = pillLabel.text
        pill.addAction(UIAction { [weak self] _ in
            fcuiTrackTryAgain()
            self?.onRetry?()
        }, for: .touchUpInside)

        spacerBeforePill.setContentHuggingPriority(.defaultLow, for: .horizontal)

        row.axis = .horizontal
        row.alignment = .center
        row.translatesAutoresizingMaskIntoConstraints = false
        [icon, label, spacerBeforePill, pill].forEach(row.addArrangedSubview)
        row.setCustomSpacing(12, after: icon)
        row.setCustomSpacing(8, after: label)
        contentView.addSubview(row)
        NSLayoutConstraint.activate([
            icon.widthAnchor.constraint(equalToConstant: 48),
            icon.heightAnchor.constraint(equalToConstant: 48),
            close.centerXAnchor.constraint(equalTo: icon.centerXAnchor),
            close.centerYAnchor.constraint(equalTo: icon.centerYAnchor),
            close.widthAnchor.constraint(equalToConstant: 24),
            close.heightAnchor.constraint(equalToConstant: 24),
            // 12 under the bubble (its cell keeps 8 below) and the list's 16 after (8 + 8).
            row.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 4),
            row.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -8),
            row.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20 + 4),
            row.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    /// - Parameter isVoice: the failed question was a voice clip → the right-aligned Retry pill.
    func configure(isVoice: Bool) {
        icon.isHidden = isVoice
        label.isHidden = isVoice
        spacerBeforePill.isHidden = !isVoice
        label.textColor = FCUITheme.foregroundPrimary
        label.fcSetText(
            fcuiLabel(AgenticLabels.somethingWentWrong, AgenticLabels.somethingWentWrongFallback),
            style: FCUITypography.current.bodyMedium
        )
        let iconSize: CGFloat = isVoice ? 23 : 16
        pillIcon.image = UIImage(
            systemName: "arrow.clockwise",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: isVoice ? 18 : 13, weight: .semibold)
        )
        NSLayoutConstraint.deactivate(pillIconSize + pillInsets)
        pillIconSize = [
            pillIcon.widthAnchor.constraint(equalToConstant: iconSize),
            pillIcon.heightAnchor.constraint(equalToConstant: iconSize)
        ]
        pillRow.spacing = isVoice ? 6 : 4
        pillInsets = [
            pillRow.topAnchor.constraint(equalTo: pill.topAnchor, constant: isVoice ? 10 : 12),
            pillRow.bottomAnchor.constraint(equalTo: pill.bottomAnchor, constant: isVoice ? -10 : -12),
            pillRow.leadingAnchor.constraint(equalTo: pill.leadingAnchor, constant: 10),
            pillRow.trailingAnchor.constraint(equalTo: pill.trailingAnchor, constant: isVoice ? -14 : -10)
        ]
        NSLayoutConstraint.activate(pillIconSize + pillInsets)
    }

    override func traitCollectionDidChange(_ previous: UITraitCollection?) {
        super.traitCollectionDidChange(previous)
        pill.backgroundColor = FCUITheme.surfaceTertiary
    }
}

// MARK: - Location bubble cell (2.0.0 — UIKit port of components/chat/LocationChatBubble.kt)

/// The farmer's resolved location, standing in for the text bubble they would otherwise have sent
/// in reply to a GPS_PROMPT alignment chip. Right-aligned like a user bubble.
///
/// Figma card: fixed 290x184 — a green-at-16% map band with a centred pin over a soft ellipse
/// "shadow", then a footer with the caption above the bold address. Three corners rounded, the
/// bottom-trailing (tail) one sharp, exactly like `FCUIChatBubbleCell`'s user bubble.
///
/// Honours the same two chat-customization knobs the other bubbles do: `bubbleCornerRadius` (the
/// three rounded corners; the tail stays sharp) and `messageFontSize` (caption + address). The pin
/// is an SF Symbol and the ellipse is a drawn layer because the package ships no image assets.
final class FCUILocationBubbleCell: UICollectionViewCell {
    private let bubble = UIView()
    private let mapBand = UIView()
    private let pinView = UIImageView()
    private let ellipseView = FCUIEllipseView()
    private let captionLabel = UILabel()
    private let addressLabel = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        let cfg = FarmerChat.shared.config
        let radius = cfg.bubbleCornerRadius ?? 20
        let fontSize = cfg.messageFontSize ?? 16

        bubble.backgroundColor = FCUITheme.surfaceReadingSecondary
        bubble.layer.cornerRadius = radius
        bubble.layer.cornerCurve = .continuous
        // Three corners rounded; the bottom-trailing tail stays sharp (Compose parity).
        bubble.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner, .layerMinXMaxYCorner]
        bubble.clipsToBounds = true
        bubble.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(bubble)

        mapBand.backgroundColor = FCUITheme.green500.withAlphaComponent(0.16)
        mapBand.translatesAutoresizingMaskIntoConstraints = false

        pinView.image = UIImage(systemName: "mappin.and.ellipse")
        pinView.tintColor = FCUITheme.green500
        pinView.contentMode = .scaleAspectFit
        pinView.translatesAutoresizingMaskIntoConstraints = false

        ellipseView.fillColor = FCUITheme.green500.withAlphaComponent(0.24)
        ellipseView.translatesAutoresizingMaskIntoConstraints = false

        let pinStack = UIStackView(arrangedSubviews: [pinView, ellipseView])
        pinStack.axis = .vertical
        pinStack.alignment = .center
        pinStack.spacing = 0
        pinStack.translatesAutoresizingMaskIntoConstraints = false
        mapBand.addSubview(pinStack)

        captionLabel.font = FCUITypography.current.bodyMedium(atSize: fontSize).font
        captionLabel.textColor = FCUITheme.foregroundSecondary
        captionLabel.numberOfLines = 1

        addressLabel.font = FCUITypography.current.bodyMedium(atSize: fontSize).font
        addressLabel.textColor = FCUITheme.foregroundPrimary
        addressLabel.numberOfLines = 0

        let footer = UIStackView(arrangedSubviews: [captionLabel, addressLabel])
        footer.axis = .vertical
        footer.spacing = 4
        footer.isLayoutMarginsRelativeArrangement = true
        footer.layoutMargins = UIEdgeInsets(top: 12, left: 16, bottom: 12, right: 16)
        footer.translatesAutoresizingMaskIntoConstraints = false

        let stack = UIStackView(arrangedSubviews: [mapBand, footer])
        stack.axis = .vertical
        stack.spacing = 0
        stack.translatesAutoresizingMaskIntoConstraints = false
        bubble.addSubview(stack)

        NSLayoutConstraint.activate([
            // Fixed 290x184 card, right-aligned with the same 16pt gutter the bubbles use.
            bubble.widthAnchor.constraint(equalToConstant: 290),
            bubble.heightAnchor.constraint(equalToConstant: 184),
            bubble.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
            bubble.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -8),
            bubble.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20),
            bubble.leadingAnchor.constraint(greaterThanOrEqualTo: contentView.leadingAnchor, constant: 20 + 64),

            stack.topAnchor.constraint(equalTo: bubble.topAnchor),
            stack.bottomAnchor.constraint(equalTo: bubble.bottomAnchor),
            stack.leadingAnchor.constraint(equalTo: bubble.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: bubble.trailingAnchor),

            pinStack.centerXAnchor.constraint(equalTo: mapBand.centerXAnchor),
            pinStack.centerYAnchor.constraint(equalTo: mapBand.centerYAnchor),
            pinView.widthAnchor.constraint(equalToConstant: 44),
            pinView.heightAnchor.constraint(equalToConstant: 44),
            ellipseView.widthAnchor.constraint(equalToConstant: 28),
            ellipseView.heightAnchor.constraint(equalToConstant: 8)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    func configure(message: ChatMessage.LocationMessage) {
        let caption = fcuiLabel(AgenticLabels.yourLocation, AgenticLabels.yourLocationFallback)
        captionLabel.text = caption
        addressLabel.text = message.address
        isAccessibilityElement = true
        accessibilityLabel = "\(caption) \(message.address)"
    }
}

/// A filled ellipse — the pin's soft ground "shadow" (Compose uses an `fc_ellipse_icon` drawable;
/// this package ships no image assets).
final class FCUIEllipseView: UIView {
    var fillColor: UIColor = .clear { didSet { setNeedsDisplay() } }

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func draw(_ rect: CGRect) {
        fillColor.setFill()
        UIBezierPath(ovalIn: rect).fill()
    }
}
#endif
