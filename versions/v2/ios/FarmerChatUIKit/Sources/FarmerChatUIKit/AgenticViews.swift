#if canImport(UIKit)
import UIKit
import FarmerChatCore

// MARK: - Streaming status (tool progress / stall hint)

/// UIKit port of the app's `LogoSpinnerHorizontal` (SwiftUI: `FCLogoSpinner(vertical: false)`):
/// a 40pt Green500 progress ring around the static Green500 logo mark, then a `labelMedium`
/// label in `foregroundPrimary` that shimmers (`ShimmerText.kt`).
///
/// Used for every inline "still working" state in the thread, exactly where the app uses
/// `LogoSpinnerHorizontal`: the loading placeholder ("Getting your answer…"), the tool-progress
/// line (`streamingStatus`, e.g. "Checking weather forecast") and the transient stall hint.
final class FCUIStreamStatusView: UIView {
    private let logo = FCUILogoSpinnerView()
    private let label = FCUIShimmerLabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        let stack = UIStackView(arrangedSubviews: [logo, label])
        stack.axis = .horizontal
        // LogoSpinnerHorizontal.kt:97 — 12dp between the spinner and the label.
        stack.spacing = 12
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    func configure(text: String) {
        label.text = text
    }

    /// The ring spin and the shimmer cost a display link, so both are tied to visibility.
    override var isHidden: Bool {
        didSet {
            guard isHidden != oldValue else { return }
            logo.isAnimating = !isHidden
            label.isAnimating = !isHidden
        }
    }
}

/// The FarmerChat logo mark — the 6-petal flower from the app's `logo_mark.xml` (12 petal paths
/// on a 130×130 viewBox), the same data SwiftUI's `FCLogoMarkShape` draws. UIKit cannot import
/// the SwiftUI package, so the path data is duplicated here.
private enum FCUILogoMark {
    static let pathData: [String] = [
        "M32.56,0C50.54,0 65.12,14.59 65.12,32.59C47.14,32.59 32.56,18 32.56,0Z",
        "M97.56,0C79.58,0 65,14.59 65,32.59C82.98,32.59 97.56,18 97.56,0Z",
        "M32.68,65.06C14.7,65.06 0.12,50.47 0.12,32.47C18.1,32.47 32.68,47.06 32.68,65.06Z",
        "M65.12,32.47C47.14,32.47 32.56,47.06 32.56,65.06C50.54,65.06 65.12,50.47 65.12,32.47Z",
        "M65,32.47C82.98,32.47 97.56,47.06 97.56,65.06C79.58,65.06 65,50.47 65,32.47Z",
        "M97.44,65.06C115.42,65.06 130,50.47 130,32.47C112.02,32.47 97.44,47.06 97.44,65.06Z",
        "M32.56,64.94C14.58,64.94 0,79.53 0,97.53C17.98,97.53 32.56,82.94 32.56,64.94Z",
        "M32.56,64.94C50.54,64.94 65.12,79.53 65.12,97.53C47.14,97.53 32.56,82.94 32.56,64.94Z",
        "M97.56,64.94C79.58,64.94 65,79.53 65,97.53C82.98,97.53 97.56,82.94 97.56,64.94Z",
        "M97.44,64.94C115.42,64.94 130,79.53 130,97.53C112.02,97.53 97.44,82.94 97.44,64.94Z",
        "M65.12,97.41C47.14,97.41 32.56,112 32.56,130C50.54,130 65.12,115.41 65.12,97.41Z",
        "M65,97.41C82.98,97.41 97.56,112 97.56,130C79.58,130 65,115.41 65,97.41Z"
    ]

    /// The mark scaled to a `size`×`size` square. Only absolute M / C / Z occur in the data.
    static func path(size: CGFloat) -> CGPath {
        let path = CGMutablePath()
        for data in pathData {
            var numbers: [CGFloat] = []
            var current = ""
            var command: Character?
            func flush() {
                if !current.isEmpty, let value = Double(current) { numbers.append(CGFloat(value)) }
                current = ""
            }
            func run() {
                switch command {
                case "M":
                    if numbers.count >= 2 { path.move(to: CGPoint(x: numbers[0], y: numbers[1])) }
                case "C":
                    var i = 0
                    while i + 5 < numbers.count {
                        path.addCurve(
                            to: CGPoint(x: numbers[i + 4], y: numbers[i + 5]),
                            control1: CGPoint(x: numbers[i], y: numbers[i + 1]),
                            control2: CGPoint(x: numbers[i + 2], y: numbers[i + 3])
                        )
                        i += 6
                    }
                case "Z":
                    path.closeSubpath()
                default:
                    break
                }
                numbers.removeAll(keepingCapacity: true)
            }
            for ch in data {
                if ch.isLetter {
                    flush(); run(); command = ch
                } else if ch == "," || ch == " " {
                    flush()
                } else if ch == "-" {
                    flush(); current.append(ch)
                } else {
                    current.append(ch)
                }
            }
            flush(); run()
        }
        var transform = CGAffineTransform(scaleX: size / 130, y: size / 130)
        return path.copy(using: &transform) ?? path
    }
}

/// Port of `LogoSpinner.kt` `LogoWithSpinner` at the horizontal geometry (LogoSpinner.kt:90/101):
/// a 40pt ring (2.5pt stroke, 3/4 arc, round caps) spinning once a second around a static 23pt
/// mark, both Green500 — the app hard-codes Green500 here rather than following the host accent.
final class FCUILogoSpinnerView: UIView {
    private static let ringSize: CGFloat = 40
    private static let markSize: CGFloat = 23
    private static let spinKey = "fc.spin"

    private let ring = CAShapeLayer()
    private let mark = CAShapeLayer()

    /// Driven by the owner's visibility; the animation is also re-added on window changes,
    /// because Core Animation strips it when the view leaves the window.
    var isAnimating = true {
        didSet { updateAnimation() }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        let size = Self.ringSize
        ring.frame = CGRect(x: 0, y: 0, width: size, height: size)
        let inset: CGFloat = 1.25
        ring.path = UIBezierPath(
            arcCenter: CGPoint(x: size / 2, y: size / 2),
            radius: size / 2 - inset,
            startAngle: -.pi / 2,
            endAngle: -.pi / 2 + 1.5 * .pi,
            clockwise: true
        ).cgPath
        ring.fillColor = UIColor.clear.cgColor
        ring.strokeColor = FCUITheme.green500.cgColor
        ring.lineWidth = 2.5
        ring.lineCap = .round
        layer.addSublayer(ring)

        let markOrigin = (size - Self.markSize) / 2
        mark.frame = CGRect(x: markOrigin, y: markOrigin, width: Self.markSize, height: Self.markSize)
        mark.path = FCUILogoMark.path(size: Self.markSize)
        mark.fillColor = FCUITheme.green500.cgColor
        layer.addSublayer(mark)

        translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: size),
            heightAnchor.constraint(equalToConstant: size)
        ])
        isAccessibilityElement = false
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        updateAnimation()
    }

    private func updateAnimation() {
        if isAnimating && window != nil {
            guard ring.animation(forKey: Self.spinKey) == nil else { return }
            let spin = CABasicAnimation(keyPath: "transform.rotation.z")
            spin.fromValue = 0
            spin.toValue = 2 * Double.pi
            spin.duration = 1.0
            spin.repeatCount = .infinity
            ring.add(spin, forKey: Self.spinKey)
        } else {
            ring.removeAnimation(forKey: Self.spinKey)
        }
    }
}

/// Port of `components/ShimmerText.kt` (SwiftUI: `FCShimmerText`): the label fills with a slow
/// horizontal highlight sweep — base `foregroundPrimary`, highlight the accent — a band 1.2× the
/// text width travelling from just off the leading edge to just past the trailing one every 1.2 s.
///
/// Built as a highlight-coloured copy of the label masked by a moving gradient band, so the text
/// itself never changes colour mid-layout. Reduce Motion drops the sweep (the app drops it on
/// low-RAM devices; iOS has no equivalent signal, and Reduce Motion is the one that asks for it).
final class FCUIShimmerLabel: UIView {
    private static let sweepKey = "fc.shimmer"
    private static let duration: CFTimeInterval = 1.2

    private let base = UILabel()
    private let highlight = UILabel()
    private let band = CAGradientLayer()
    /// Width the running sweep was built for.
    private var sweptWidth: CGFloat = -1

    var text: String? {
        get { base.text }
        set {
            guard newValue != base.text else { return }
            base.text = newValue
            highlight.text = newValue
            setNeedsLayout()
        }
    }

    var isAnimating = true {
        didSet { updateAnimation() }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        for label in [base, highlight] {
            label.font = FCUITypography.current.labelMedium.font
            label.numberOfLines = 0
            label.translatesAutoresizingMaskIntoConstraints = false
            addSubview(label)
            NSLayoutConstraint.activate([
                label.topAnchor.constraint(equalTo: topAnchor),
                label.bottomAnchor.constraint(equalTo: bottomAnchor),
                label.leadingAnchor.constraint(equalTo: leadingAnchor),
                label.trailingAnchor.constraint(equalTo: trailingAnchor)
            ])
        }
        base.textColor = FCUITheme.foregroundPrimary
        highlight.textColor = FCUITheme.brandAccent
        highlight.isAccessibilityElement = false

        band.startPoint = CGPoint(x: 0, y: 0.5)
        band.endPoint = CGPoint(x: 1, y: 0.5)
        band.colors = [
            UIColor.clear.cgColor, UIColor.black.cgColor, UIColor.black.cgColor, UIColor.clear.cgColor
        ]
        band.locations = [0, 0.35, 0.65, 1]
        highlight.layer.mask = band

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(reduceMotionChanged),
            name: UIAccessibility.reduceMotionStatusDidChangeNotification,
            object: nil
        )
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func layoutSubviews() {
        super.layoutSubviews()
        let width = highlight.bounds.width
        let bandWidth = max(width * 1.2, 1)
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        band.frame = CGRect(x: 0, y: 0, width: bandWidth, height: highlight.bounds.height)
        CATransaction.commit()
        // The sweep's travel depends on the width, so only a NEW width restarts it — a cell
        // reconfigure on every streamed delta must not reset the sweep mid-pass.
        if width != sweptWidth {
            sweptWidth = width
            band.removeAnimation(forKey: Self.sweepKey)
        }
        updateAnimation()
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        updateAnimation()
    }

    override func traitCollectionDidChange(_ previous: UITraitCollection?) {
        super.traitCollectionDidChange(previous)
        base.textColor = FCUITheme.foregroundPrimary
        highlight.textColor = FCUITheme.brandAccent
    }

    @objc private func reduceMotionChanged() {
        updateAnimation()
    }

    private func updateAnimation() {
        let animate = isAnimating && window != nil && !UIAccessibility.isReduceMotionEnabled
            && highlight.bounds.width > 0
        highlight.isHidden = !animate
        guard animate else {
            band.removeAnimation(forKey: Self.sweepKey)
            return
        }
        guard band.animation(forKey: Self.sweepKey) == nil else { return }
        let width = highlight.bounds.width
        // Band centre travels -0.6w → 1.6w (FCShimmerText's unit-space -0.6 → 1.6).
        let sweep = CABasicAnimation(keyPath: "position.x")
        sweep.fromValue = -0.6 * width
        sweep.toValue = 1.6 * width
        sweep.duration = Self.duration
        sweep.repeatCount = .infinity
        band.add(sweep, forKey: Self.sweepKey)
    }
}

/// How long a streamed answer may stall, with no tool status, before the UI shows a transient
/// "Paused, resuming…" hint. Client-side only — NOT a failure, and it clears on the next delta.
/// Matches SwiftUI's `fcPauseHintDelayNanoseconds` (4 s).
private let fcuiPauseHintDelaySeconds: TimeInterval = 4.0

/// Transient "paused, resuming" hint for a stream that has text flowing but has gone quiet.
///
/// Keyed on the answer's LENGTH, exactly like SwiftUI's `.task(id: textLength)`: every delta
/// restarts the countdown, so the hint disappears the moment text resumes. ``update(active:textLength:)``
/// is idempotent for an unchanged length so a cell reconfigure (which re-runs `configure`) cannot
/// restart the timer and make the hint flicker.
final class FCUIStreamStallHintView: UIView {
    /// Fired when the hint appears/disappears so the owning cell can re-measure its height.
    var onStallChanged: (() -> Void)?

    private let indicator = FCUIStreamStatusView()
    private var pending: DispatchWorkItem?
    private var lastTextLength: Int?
    private var stalled = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        indicator.translatesAutoresizingMaskIntoConstraints = false
        addSubview(indicator)
        NSLayoutConstraint.activate([
            indicator.topAnchor.constraint(equalTo: topAnchor),
            indicator.bottomAnchor.constraint(equalTo: bottomAnchor),
            indicator.leadingAnchor.constraint(equalTo: leadingAnchor),
            indicator.trailingAnchor.constraint(equalTo: trailingAnchor)
        ])
        isHidden = true
        indicator.isHidden = true
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    deinit { pending?.cancel() }

    /// - Parameters:
    ///   - active: true only while streaming with text present and no tool status.
    ///   - textLength: identity that resets the countdown.
    func update(active: Bool, textLength: Int) {
        guard active else {
            reset()
            return
        }
        // Label text is resolved here (a main-actor context), never from the timer callback.
        indicator.configure(text: fcuiLabel(
            AgenticLabels.responsePausedResuming,
            AgenticLabels.responsePausedResumingFallback
        ))
        // Same length → the countdown (or the shown hint) stands. This is what keeps a
        // reconfigure from restarting the timer.
        if lastTextLength == textLength { return }
        lastTextLength = textLength
        pending?.cancel()
        setStalled(false)
        let work = DispatchWorkItem { [weak self] in
            self?.pending = nil
            self?.setStalled(true)
        }
        pending = work
        DispatchQueue.main.asyncAfter(deadline: .now() + fcuiPauseHintDelaySeconds, execute: work)
    }

    /// Cancels the countdown and hides the hint (cell reuse, or the stream ended).
    func reset() {
        pending?.cancel()
        pending = nil
        lastTextLength = nil
        setStalled(false)
    }

    private func setStalled(_ value: Bool) {
        guard stalled != value else { return }
        stalled = value
        isHidden = !value
        // Also stops the spinner's timer while the hint is not on screen.
        indicator.isHidden = !value
        onStallChanged?()
    }
}

// MARK: - Stream error card

/// Inline card shown when an agentic stream ends without a complete answer (2.0.0). Renders below
/// the AI response — below the preserved partial text, if any — with a state-specific message and
/// a full-width "Try again" action.
///
/// The copy is driven by both the error kind and whether a partial answer survived, because
/// "we lost the connection but kept what you have" and "nothing arrived" are very different
/// messages to a farmer:
/// - partial present → "Connection stopped. Your partial answer is saved."
/// - network         → "No internet connection"
/// - otherwise       → "Something went wrong"
///
/// The tint is derived from `FCUITheme.red500`, the failure colour the UIKit flavour already uses
/// for errors, so no new theme token is introduced.
final class FCUIStreamErrorCardView: UIView {
    var onRetry: (() -> Void)?

    private let iconView = UIImageView()
    private let titleLabel = UILabel()
    private let retryButton: FCUIPrimaryButton

    override init(frame: CGRect) {
        let fail = FCUITheme.red500
        retryButton = FCUIPrimaryButton(
            title: fcuiLabel(AgenticLabels.tryAgain, AgenticLabels.tryAgainFallback)
        )
        super.init(frame: frame)

        backgroundColor = fail.withAlphaComponent(0.08)
        layer.cornerRadius = 16
        layer.cornerCurve = .continuous
        layer.borderWidth = 1
        layer.borderColor = fail.withAlphaComponent(0.16).cgColor

        iconView.tintColor = fail
        iconView.contentMode = .center
        iconView.setContentHuggingPriority(.required, for: .horizontal)

        titleLabel.font = FCUITypography.current.titleSmall.font
        titleLabel.textColor = FCUITheme.foregroundPrimary
        titleLabel.numberOfLines = 0

        let header = UIStackView(arrangedSubviews: [iconView, titleLabel])
        header.axis = .horizontal
        header.spacing = 10
        header.alignment = .top

        retryButton.addAction(UIAction { [weak self] _ in self?.onRetry?() }, for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [header, retryButton])
        stack.axis = .vertical
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 16),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -16),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    func configure(errorKind: StreamErrorKind, hasPartial: Bool) {
        if hasPartial {
            titleLabel.text = fcuiLabel(
                AgenticLabels.connectionStoppedPartialSaved,
                AgenticLabels.connectionStoppedPartialSavedFallback
            )
        } else if errorKind == .network {
            titleLabel.text = fcuiLabel(
                AgenticLabels.noInternetConnection,
                AgenticLabels.noInternetConnectionFallback
            )
        } else {
            titleLabel.text = fcuiLabel(
                AgenticLabels.somethingWentWrong,
                AgenticLabels.somethingWentWrongFallback
            )
        }
        iconView.image = UIImage(
            systemName: errorKind == .network ? "wifi.slash" : "exclamationmark.triangle.fill",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 17, weight: .semibold)
        )
    }
}

// MARK: - Alignment chips

/// Visual treatments for an alignment chip, matching SwiftUI's `FCChipType` / Compose's `ChipType`.
enum FCUIChipType {
    /// A live option on an open surface.
    case agentic
    /// A live option on an urgent (escalate) surface.
    case escalate
    /// Faded back: another chip on this surface has already been picked.
    case suggested

    var accent: UIColor {
        switch self {
        case .agentic: return FCUITheme.brandAccent
        case .escalate: return FCUITheme.red500
        case .suggested: return FCUITheme.borderDefault
        }
    }
}

/// One numbered quick-reply chip. A `UIControl` (not a `UIButton`) so the number badge and the
/// multi-line label lay out with plain auto layout on iOS 15.
final class FCUIAlignmentChipView: UIControl {
    private let badge = UILabel()
    private let badgeBackground = UIView()
    private let titleLabel = UILabel()
    private var accent: UIColor = FCUITheme.brandAccent
    private var isPicked = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        layer.cornerRadius = 14
        layer.cornerCurve = .continuous
        layer.borderWidth = 1

        badgeBackground.layer.cornerRadius = 10
        badgeBackground.translatesAutoresizingMaskIntoConstraints = false
        badge.font = FCUITypography.current.labelMedium.font
        badge.textAlignment = .center
        badge.translatesAutoresizingMaskIntoConstraints = false
        badgeBackground.addSubview(badge)

        titleLabel.font = FCUITypography.current.labelMedium.font
        titleLabel.textColor = FCUITheme.foregroundPrimary
        titleLabel.numberOfLines = 0

        let stack = UIStackView(arrangedSubviews: [badgeBackground, titleLabel])
        stack.axis = .horizontal
        stack.spacing = 10
        stack.alignment = .center
        stack.isUserInteractionEnabled = false
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            badgeBackground.widthAnchor.constraint(equalToConstant: 20),
            badgeBackground.heightAnchor.constraint(equalToConstant: 20),
            badge.centerXAnchor.constraint(equalTo: badgeBackground.centerXAnchor),
            badge.centerYAnchor.constraint(equalTo: badgeBackground.centerYAnchor),
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -14)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    func configure(label: String, number: Int, type: FCUIChipType, selected: Bool, enabled: Bool) {
        accent = type.accent
        isPicked = selected
        titleLabel.text = label
        badge.text = "\(number)"
        badge.textColor = selected ? .white : accent
        badgeBackground.backgroundColor = selected ? accent : accent.withAlphaComponent(0.14)
        backgroundColor = selected ? accent.withAlphaComponent(0.12) : FCUITheme.surfaceSecondary
        isUserInteractionEnabled = enabled
        alpha = (enabled || selected) ? 1 : 0.6
        applyBorder()
    }

    override func traitCollectionDidChange(_ previous: UITraitCollection?) {
        super.traitCollectionDidChange(previous)
        // Keep a host-themed (dynamic) accent border correct across light/dark.
        applyBorder()
    }

    private func applyBorder() {
        layer.borderColor = accent.withAlphaComponent(isPicked ? 0.9 : 0.35).cgColor
    }
}

// MARK: - Alignment surface

/// A server-driven alignment surface (2.0.0): a short prompt the farmer answers by tapping a chip,
/// instead of reading a normal answer. UIKit port of SwiftUI's `FCAlignmentSurface`.
///
/// Two shapes, decided by `AlignmentKind.isAdditive`:
/// - **Exclusive** (clarify / confirm / escalate / capability prompts) — owns the message area and
///   replaces the answer, so it renders its own heading and, where appropriate, an escape hatch.
/// - **Additive** (gender-select / commodity-confirm) — a nudge BELOW a real answer, so it renders
///   no heading and no escape hatch; the answer above already owns the action row.
///
/// Escalate gets an urgent treatment derived from `FCUITheme.red500` (the flavour's existing
/// failure colour), keeping the card coherent instead of introducing a new theme token.
final class FCUIAlignmentSurfaceView: UIView {
    var onChipTap: ((AlignmentChip) -> Void)?
    var onTypeInstead: (() -> Void)?

    private let container = UIStackView()
    private let messageLabel = UILabel()
    private let headingLabel = UILabel()
    private let chipsStack = UIStackView()
    private let escapeHatch = UIStackView()
    private let escapeHatchLabel = UILabel()
    private let escapeHatchButton = UIButton(type: .system)
    private var containerInsets: [NSLayoutConstraint] = []

    override init(frame: CGRect) {
        super.init(frame: frame)
        layer.cornerRadius = 16
        layer.cornerCurve = .continuous

        messageLabel.font = FCUITypography.current.bodyLarge(atSize: FarmerChat.shared.config.messageFontSize ?? 19).font
        messageLabel.textColor = FCUITheme.foregroundPrimary
        messageLabel.numberOfLines = 0

        headingLabel.font = FCUITypography.current.titleMedium.font
        headingLabel.textColor = FCUITheme.foregroundPrimary
        headingLabel.numberOfLines = 0

        chipsStack.axis = .vertical
        chipsStack.spacing = 8

        let info = UIImageView(image: UIImage(
            systemName: "info.circle",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 13)
        ))
        info.tintColor = FCUITheme.brandAccent
        info.contentMode = .center
        info.setContentHuggingPriority(.required, for: .horizontal)
        escapeHatchLabel.font = FCUITypography.current.bodySmall.font
        escapeHatchLabel.textColor = FCUITheme.foregroundSecondary
        escapeHatchLabel.numberOfLines = 0
        escapeHatchButton.titleLabel?.font = FCUITypography.current.bodySmall.font
        escapeHatchButton.setTitleColor(FCUITheme.brandAccent, for: .normal)
        escapeHatchButton.addAction(
            UIAction { [weak self] _ in self?.onTypeInstead?() },
            for: .touchUpInside
        )
        escapeHatch.axis = .horizontal
        escapeHatch.spacing = 6
        escapeHatch.alignment = .center
        [info, escapeHatchLabel, escapeHatchButton, UIView()].forEach(escapeHatch.addArrangedSubview)

        container.axis = .vertical
        container.spacing = 0
        container.alignment = .fill
        container.translatesAutoresizingMaskIntoConstraints = false
        [messageLabel, headingLabel, chipsStack, escapeHatch].forEach(container.addArrangedSubview)
        addSubview(container)
        setInsets(0)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    /// - Parameters:
    ///   - selectedValues: chip values already tapped on this surface (see the parity note in
    ///     `ChatMessage.AiResponse.alignmentSelectedValues`).
    ///   - isLoading: thread-level busy flag; locks every chip while a send is in flight.
    ///   - isLatest: true for the newest AI message — gates the escape hatch.
    ///   - additive: true when rendering below a real answer; suppresses heading + escape hatch.
    func configure(
        kind: AlignmentKind,
        message: String,
        chips: [AlignmentChip],
        selectedValues: [String],
        isLoading: Bool,
        isLatest: Bool,
        additive: Bool
    ) {
        let isEscalate = kind == .escalate
        let isCapabilityPrompt = kind == .gpsPrompt || kind == .uploadPhoto
        let hasPick = !selectedValues.isEmpty
        // Capability and additive surfaces are single-shot: one tap settles them, so every chip
        // locks. Clarify/confirm stay open so the farmer can pick a different option.
        let chipsLocked = (isCapabilityPrompt || additive) && hasPick

        // Urgent surfaces get a tinted, bordered card so they read differently at a glance.
        if isEscalate {
            let fail = FCUITheme.red500
            backgroundColor = fail.withAlphaComponent(0.08)
            layer.borderWidth = 1
            layer.borderColor = fail.withAlphaComponent(0.16).cgColor
            setInsets(16)
        } else {
            backgroundColor = .clear
            layer.borderWidth = 0
            layer.borderColor = nil
            setInsets(0)
        }

        let trimmedMessage = message.trimmingCharacters(in: .whitespacesAndNewlines)
        messageLabel.fcSetText(message, style: FCUITypography.current.bodyLarge(atSize: FarmerChat.shared.config.messageFontSize ?? 19))
        messageLabel.isHidden = trimmedMessage.isEmpty

        let showHeading = !isEscalate && !additive
        headingLabel.isHidden = !showHeading
        if showHeading { headingLabel.text = headingText(for: kind) }

        chipsStack.arrangedSubviews.forEach {
            chipsStack.removeArrangedSubview($0)
            $0.removeFromSuperview()
        }
        for (index, chip) in chips.enumerated() {
            let isSelected = isSelected(chip, in: selectedValues)
            // Once a pick exists the unpicked chips fade back to Suggested, so the chosen one
            // reads as the answer rather than one of several live options.
            let type: FCUIChipType = {
                if isEscalate { return (!hasPick || isSelected) ? .escalate : .suggested }
                return (!hasPick || isSelected) ? .agentic : .suggested
            }()
            let view = FCUIAlignmentChipView()
            view.configure(
                label: chip.label ?? "",
                number: index + 1,
                type: type,
                selected: isSelected,
                enabled: !isSelected && !isLoading && !chipsLocked
            )
            view.addAction(UIAction { [weak self] _ in self?.onChipTap?(chip) }, for: .touchUpInside)
            chipsStack.addArrangedSubview(view)
        }
        chipsStack.isHidden = chips.isEmpty

        // Escape hatch: only on an open, exclusive, non-urgent surface that is still the latest.
        // Without it a farmer whose answer is not among the chips has no way forward.
        let showEscapeHatch = !chips.isEmpty && !isEscalate && !isCapabilityPrompt && !additive
            && !hasPick && isLatest && !isLoading
        escapeHatch.isHidden = !showEscapeHatch
        if showEscapeHatch {
            escapeHatchLabel.text = fcuiLabel(
                AgenticLabels.dontSeeYourOption,
                AgenticLabels.dontSeeYourOptionFallback
            )
            escapeHatchButton.setTitle(
                fcuiLabel(AgenticLabels.typeOrSayIt, AgenticLabels.typeOrSayItFallback),
                for: .normal
            )
        }

        // Spacing matches SwiftUI: 12 after the message on an escalate/additive card, 16 otherwise.
        container.setCustomSpacing(messageLabel.isHidden ? 0 : (isEscalate || additive ? 12 : 16), after: messageLabel)
        container.setCustomSpacing(showHeading ? 16 : 0, after: headingLabel)
        container.setCustomSpacing(showEscapeHatch ? 12 : 0, after: chipsStack)
    }

    private func setInsets(_ inset: CGFloat) {
        NSLayoutConstraint.deactivate(containerInsets)
        containerInsets = [
            container.topAnchor.constraint(equalTo: topAnchor, constant: inset),
            container.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -inset),
            container.leadingAnchor.constraint(equalTo: leadingAnchor, constant: inset),
            container.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -inset)
        ]
        NSLayoutConstraint.activate(containerInsets)
    }

    private func headingText(for kind: AlignmentKind) -> String {
        switch kind {
        case .gpsPrompt:
            return fcuiLabel(AgenticLabels.shareLocationTitle, AgenticLabels.shareLocationTitleFallback)
        case .uploadPhoto:
            return fcuiLabel(AgenticLabels.addOneClearPhoto, AgenticLabels.addOneClearPhotoFallback)
        case .confirm:
            return fcuiLabel(AgenticLabels.pleaseConfirm, AgenticLabels.pleaseConfirmFallback)
        default:
            return fcuiLabel(AgenticLabels.chooseOne, AgenticLabels.chooseOneFallback)
        }
    }

    private func isSelected(_ chip: AlignmentChip, in selectedValues: [String]) -> Bool {
        if let value = chip.value, !value.isEmpty, selectedValues.contains(value) { return true }
        if let label = chip.label, !label.isEmpty, selectedValues.contains(label) { return true }
        return false
    }
}

// MARK: - Exclusive alignment surface cell

/// Cell for an EXCLUSIVE alignment surface. It replaces the answer bubble entirely — no bubble
/// background, no action row, no follow-up section (the surface owns the message area).
final class FCUIAlignmentSurfaceCell: UICollectionViewCell {
    var onChipTap: ((AlignmentChip) -> Void)? {
        get { surface.onChipTap }
        set { surface.onChipTap = newValue }
    }
    var onTypeInstead: (() -> Void)? {
        get { surface.onTypeInstead }
        set { surface.onTypeInstead = newValue }
    }

    private let surface = FCUIAlignmentSurfaceView()

    override init(frame: CGRect) {
        super.init(frame: frame)
        surface.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(surface)
        NSLayoutConstraint.activate([
            surface.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 6),
            surface.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -6),
            surface.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 16),
            surface.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -16)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    func configure(message: ChatMessage.AiResponse, isLatest: Bool, isBusy: Bool) {
        guard let kind = message.alignmentKind else { return }
        surface.configure(
            kind: kind,
            // The prompt IS the message for an exclusive surface (see
            // ChatViewModel.handleTextPromptSuccess).
            message: message.text,
            chips: message.alignmentChips ?? [],
            selectedValues: message.alignmentSelectedValues,
            isLoading: isBusy,
            isLatest: isLatest,
            additive: false
        )
    }
}
#endif
