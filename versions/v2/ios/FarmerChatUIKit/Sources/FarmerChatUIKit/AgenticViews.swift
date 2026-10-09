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

/// Port of `LogoSpinnerHorizontal.kt` `LogoWithSpinner`: a 40pt Material3 indeterminate ring
/// (2.5pt, ROUND caps, Green500) around a 23pt Green500 mark that turns 360° every 3 s.
///
/// The ring approximates Material3 1.4.0's indeterminate cycle: one 6 s period in which the arc
/// grows 10% → 87% linearly over 3 s and shrinks back with an emphasized ease, while the whole
/// ring turns 1440° linearly. The mark waits 3 s, then turns +360° over 600 ms (EaseOut).
final class FCUILogoSpinnerView: UIView {
    private static let ringSize: CGFloat = 40
    private static let markSize: CGFloat = 23
    private static let spinKey = "fc.spin"
    private static let arcKey = "fc.arc"
    private static let markKey = "fc.mark"

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
            endAngle: -.pi / 2 + 2 * .pi,
            clockwise: true
        ).cgPath
        ring.fillColor = UIColor.clear.cgColor
        ring.strokeColor = FCUITheme.green500.cgColor
        ring.lineWidth = 2.5
        ring.lineCap = .round
        ring.strokeStart = 0
        ring.strokeEnd = 0.10
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
            spin.toValue = 8 * Double.pi
            spin.duration = 6.0
            spin.repeatCount = .infinity
            ring.add(spin, forKey: Self.spinKey)

            let arc = CAKeyframeAnimation(keyPath: "strokeEnd")
            arc.values = [0.10, 0.87, 0.10]
            arc.keyTimes = [0, 0.5, 1]
            arc.timingFunctions = [
                CAMediaTimingFunction(name: .linear),
                CAMediaTimingFunction(controlPoints: 0.2, 0, 0, 1)
            ]
            arc.duration = 6.0
            arc.repeatCount = .infinity
            ring.add(arc, forKey: Self.arcKey)

            // 3 s rest, then +360° over 600 ms EaseOut — one 3.6 s period, repeated.
            let turn = CAKeyframeAnimation(keyPath: "transform.rotation.z")
            turn.values = [0, 0, 2 * Double.pi]
            turn.keyTimes = [0, NSNumber(value: 3.0 / 3.6), 1]
            turn.timingFunctions = [
                CAMediaTimingFunction(name: .linear),
                CAMediaTimingFunction(name: .easeOut)
            ]
            turn.duration = 3.6
            turn.repeatCount = .infinity
            mark.add(turn, forKey: Self.markKey)
        } else {
            ring.removeAnimation(forKey: Self.spinKey)
            ring.removeAnimation(forKey: Self.arcKey)
            mark.removeAnimation(forKey: Self.markKey)
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

// MARK: - Small layout helpers

/// Hosts one view with fixed insets — lets a stack-arranged child carry its own "N pt above"
/// gap that disappears with it when the wrapper is hidden (a stack's custom spacing does not).
final class FCUIInsetView: UIView {
    let content: UIView

    init(_ content: UIView, top: CGFloat = 0, leading: CGFloat = 0, bottom: CGFloat = 0, trailing: CGFloat = 0) {
        self.content = content
        super.init(frame: .zero)
        content.translatesAutoresizingMaskIntoConstraints = false
        addSubview(content)
        NSLayoutConstraint.activate([
            content.topAnchor.constraint(equalTo: topAnchor, constant: top),
            content.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -bottom),
            content.leadingAnchor.constraint(equalTo: leadingAnchor, constant: leading),
            content.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -trailing)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
}

/// A font at `style`'s size with the weight forced (Chip.kt `fontWeight = Bold`, StreamErrorCard's
/// `bodyMedium.copy(fontWeight = Bold)`), keeping a host font family when one is set.
func fcuiFont(_ style: FCUITextStyle, weight: UIFont.Weight) -> UIFont {
    let descriptor = style.font.fontDescriptor.addingAttributes([
        .traits: [UIFontDescriptor.TraitKey.weight: weight]
    ])
    return UIFont(descriptor: descriptor, size: style.font.pointSize)
}

/// The Share / Listen action pill used by the answer's action row and the alignment surface.
/// `enabled = false` is ListenButton.kt's TTS-off treatment: still drawn, at alpha 0.4, not
/// tappable. `sweepBorder` is the Share pill's accent ring.
func fcuiActionChip(
    systemImage: String,
    title: String,
    sweepBorder: Bool = false,
    enabled: Bool = true,
    action: @escaping () -> Void
) -> UIButton {
    let accent = FCUITheme.brandAccent
    var config = UIButton.Configuration.plain()
    config.image = UIImage(systemName: systemImage, withConfiguration: UIImage.SymbolConfiguration(pointSize: 13, weight: .semibold))
    config.title = title
    config.imagePadding = 6
    config.baseForegroundColor = FCUITheme.foregroundSecondary
    config.imageColorTransformer = UIConfigurationColorTransformer { _ in accent }
    config.background.backgroundColor = FCUITheme.surfaceSecondary
    config.cornerStyle = .capsule
    if sweepBorder {
        config.background.strokeWidth = 0
    } else {
        config.background.strokeColor = accent.withAlphaComponent(0.28)
        config.background.strokeWidth = 1
    }
    config.contentInsets = NSDirectionalEdgeInsets(top: 9, leading: 14, bottom: 9, trailing: 14)
    let button = UIButton(configuration: config)
    button.titleLabel?.font = FCUITypography.current.labelSmall.font
    button.addAction(UIAction { _ in action() }, for: .touchUpInside)
    if !enabled {
        button.alpha = 0.4
        button.isUserInteractionEnabled = false
    }
    if sweepBorder {
        let ring = FCUISweepBorderView(cornerRadius: .greatestFiniteMagnitude)
        ring.translatesAutoresizingMaskIntoConstraints = false
        button.addSubview(ring)
        NSLayoutConstraint.activate([
            ring.topAnchor.constraint(equalTo: button.topAnchor),
            ring.bottomAnchor.constraint(equalTo: button.bottomAnchor),
            ring.leadingAnchor.constraint(equalTo: button.leadingAnchor),
            ring.trailingAnchor.constraint(equalTo: button.trailingAnchor)
        ])
    }
    return button
}

/// Tracks `Content_Try_Again_Clicked` exactly as InlineErrorContent.kt / StreamErrorCard.kt do.
func fcuiTrackTryAgain() {
    FarmerChat.shared.analytics.track(
        AnalyticsEvents.contentTryAgainClicked,
        props: ["screen_name": ScreenNames.chat]
    )
}

// MARK: - Stream error card

/// Port of `StreamErrorCard.kt` (2.0.0): shown when an agentic stream ends without a complete
/// answer. A 12-radius red-tinted card (Red500 8% fill, 1pt Red500 16% border, 16 padding):
/// [24pt icon, 12, bold bodyMedium title], 16, then a full-width radius-12 button
/// (buttonPrimarySurface, 14 vertical padding) holding a 20pt accent Refresh, 8, and a bold
/// labelLarge "Try again" in buttonPrimaryForeground.
///
/// The copy is driven by both the error kind and whether a partial answer survived:
/// - partial present → "Connection stopped. Your partial answer is saved."
/// - network         → "No internet connection"
/// - otherwise       → "Something went wrong"
final class FCUIStreamErrorCardView: UIView {
    var onRetry: (() -> Void)?

    private let iconView = UIImageView()
    private let titleLabel = UILabel()
    private let retryButton = UIControl()

    override init(frame: CGRect) {
        let fail = FCUITheme.red500
        super.init(frame: frame)

        backgroundColor = fail.withAlphaComponent(0.08)
        layer.cornerRadius = 12
        layer.cornerCurve = .continuous
        layer.borderWidth = 1
        layer.borderColor = fail.withAlphaComponent(0.16).cgColor

        iconView.tintColor = fail
        iconView.contentMode = .center
        iconView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            iconView.widthAnchor.constraint(equalToConstant: 24),
            iconView.heightAnchor.constraint(equalToConstant: 24)
        ])

        titleLabel.font = fcuiFont(FCUITypography.current.bodyMedium, weight: .bold)
        titleLabel.textColor = FCUITheme.foregroundPrimary
        titleLabel.numberOfLines = 0

        let header = UIStackView(arrangedSubviews: [iconView, titleLabel])
        header.axis = .horizontal
        header.spacing = 12
        header.alignment = .center

        // Full-width "Try again": radius 12 (NOT a pill), centred [Refresh 20 accent, 8, label].
        retryButton.backgroundColor = FCUITheme.buttonPrimarySurface
        retryButton.layer.cornerRadius = 12
        retryButton.layer.cornerCurve = .continuous
        let refresh = UIImageView(image: UIImage(
            systemName: "arrow.clockwise",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 16, weight: .semibold)
        ))
        refresh.tintColor = FCUITheme.brandAccent
        refresh.contentMode = .center
        refresh.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            refresh.widthAnchor.constraint(equalToConstant: 20),
            refresh.heightAnchor.constraint(equalToConstant: 20)
        ])
        let retryLabel = UILabel()
        retryLabel.font = fcuiFont(FCUITypography.current.labelLarge, weight: .bold)
        retryLabel.textColor = .white
        retryLabel.text = fcuiLabel(AgenticLabels.tryAgain, AgenticLabels.tryAgainFallback)
        let retryRow = UIStackView(arrangedSubviews: [refresh, retryLabel])
        retryRow.axis = .horizontal
        retryRow.spacing = 8
        retryRow.alignment = .center
        retryRow.isUserInteractionEnabled = false
        retryRow.translatesAutoresizingMaskIntoConstraints = false
        retryButton.addSubview(retryRow)
        NSLayoutConstraint.activate([
            retryRow.topAnchor.constraint(equalTo: retryButton.topAnchor, constant: 14),
            retryRow.bottomAnchor.constraint(equalTo: retryButton.bottomAnchor, constant: -14),
            retryRow.centerXAnchor.constraint(equalTo: retryButton.centerXAnchor),
            retryRow.leadingAnchor.constraint(greaterThanOrEqualTo: retryButton.leadingAnchor, constant: 12)
        ])
        retryButton.accessibilityLabel = retryLabel.text
        retryButton.isAccessibilityElement = true
        retryButton.accessibilityTraits = .button
        retryButton.addAction(UIAction { [weak self] _ in
            fcuiTrackTryAgain()
            self?.onRetry?()
        }, for: .touchUpInside)

        let stack = UIStackView(arrangedSubviews: [header, retryButton])
        stack.axis = .vertical
        stack.spacing = 16
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

    override func traitCollectionDidChange(_ previous: UITraitCollection?) {
        super.traitCollectionDidChange(previous)
        layer.borderColor = FCUITheme.red500.withAlphaComponent(0.16).cgColor
        retryButton.backgroundColor = FCUITheme.buttonPrimarySurface
    }

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
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 20, weight: .semibold)
        )
    }
}

// MARK: - Alignment chips

/// Visual treatments for a chip — Compose's `ChipType` (components/chips/Chip.kt).
enum FCUIChipType {
    /// Neutral grey surface, grey chevron — related / follow-up questions, reopened options.
    case suggested
    /// Soft green surface, green chevron — clarify / confirm options.
    case agentic
    /// Solid red surface, white label + chevron — urgent escalate options.
    case escalate
}

/// Port of `components/chips/Chip.kt`: the one option chip used across every agentic surface.
/// Radius 12, padding 14/14/14/10, spacing 8: [24pt number badge or check badge], labelMedium
/// label (Bold only when selected), [24pt chevron while tappable]. Colours per Chip.kt's tables.
final class FCUIAlignmentChipView: UIControl {
    private let badgeBackground = UIView()
    private let badgeNumber = UILabel()
    private let badgeCheck = UIImageView()
    private let titleLabel = UILabel()
    private let chevron = UIImageView()
    private var borderColor: UIColor?
    private var borderWidth: CGFloat = 0

    override init(frame: CGRect) {
        super.init(frame: frame)
        layer.cornerRadius = 12
        layer.cornerCurve = .continuous

        badgeBackground.layer.cornerRadius = 12
        badgeBackground.translatesAutoresizingMaskIntoConstraints = false
        badgeNumber.font = FCUITypography.current.labelMedium.font
        badgeNumber.textAlignment = .center
        badgeNumber.translatesAutoresizingMaskIntoConstraints = false
        badgeCheck.image = UIImage(
            systemName: "checkmark",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 12, weight: .bold)
        )
        badgeCheck.tintColor = .white
        badgeCheck.contentMode = .center
        badgeCheck.translatesAutoresizingMaskIntoConstraints = false
        badgeBackground.addSubview(badgeNumber)
        badgeBackground.addSubview(badgeCheck)

        titleLabel.numberOfLines = 0

        chevron.image = UIImage(
            systemName: "chevron.right",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 14, weight: .semibold)
        )
        chevron.contentMode = .center
        chevron.translatesAutoresizingMaskIntoConstraints = false

        let stack = UIStackView(arrangedSubviews: [badgeBackground, titleLabel, chevron])
        stack.axis = .horizontal
        stack.spacing = 8
        stack.alignment = .center
        stack.isUserInteractionEnabled = false
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            badgeBackground.widthAnchor.constraint(equalToConstant: 24),
            badgeBackground.heightAnchor.constraint(equalToConstant: 24),
            badgeNumber.centerXAnchor.constraint(equalTo: badgeBackground.centerXAnchor),
            badgeNumber.centerYAnchor.constraint(equalTo: badgeBackground.centerYAnchor),
            badgeCheck.centerXAnchor.constraint(equalTo: badgeBackground.centerXAnchor),
            badgeCheck.centerYAnchor.constraint(equalTo: badgeBackground.centerYAnchor),
            chevron.widthAnchor.constraint(equalToConstant: 24),
            chevron.heightAnchor.constraint(equalToConstant: 24),
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 14),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -14),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -10)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    func configure(label: String, number: Int?, type: FCUIChipType, selected: Bool, enabled: Bool) {
        let isEscalate = type == .escalate
        let white = UIColor.white
        let red = FCUITheme.red500
        let accent = FCUITheme.brandAccent
        let selectedAccent = isEscalate ? red : accent
        let clickable = enabled && !selected

        // Chip.kt surfaceColor / labelColor / chevronColor / border tables.
        if selected {
            backgroundColor = isEscalate ? red.withAlphaComponent(0.08) : FCUITheme.surfaceActive
        } else if !enabled {
            backgroundColor = FCUITheme.surfaceTertiary
        } else if isEscalate {
            backgroundColor = red
        } else if type == .agentic {
            backgroundColor = FCUITheme.surfaceActive
        } else {
            backgroundColor = FCUITheme.surfaceReadingSecondary
        }
        let labelColor: UIColor = selected ? FCUITheme.foregroundPrimary
            : !enabled ? FCUITheme.foregroundSecondary
            : isEscalate ? white
            : FCUITheme.foregroundPrimary
        chevron.tintColor = !enabled ? FCUITheme.foregroundTertiary
            : isEscalate ? white
            : type == .agentic ? accent
            : FCUITheme.foregroundSecondary
        if selected {
            borderColor = selectedAccent; borderWidth = 1.5
        } else if !enabled {
            borderColor = FCUITheme.borderDefault; borderWidth = 0.5
        } else {
            borderColor = nil; borderWidth = 0
        }
        applyBorder()

        // Badge: a check on the pick; otherwise the number (white-on-red inverted on escalate).
        badgeCheck.isHidden = !selected
        badgeNumber.isHidden = selected || number == nil
        badgeBackground.isHidden = !selected && number == nil
        if selected {
            badgeBackground.backgroundColor = selectedAccent
        } else if let number {
            badgeNumber.text = "\(number)"
            badgeBackground.backgroundColor = !enabled ? FCUITheme.foregroundSecondary
                : isEscalate ? white
                : accent
            badgeNumber.textColor = !enabled ? FCUITheme.surfaceTertiary
                : isEscalate ? red
                : white
        }

        // labelMedium (SemiBold); Bold only on the pick.
        titleLabel.textColor = labelColor
        let style = FCUITypography.current.labelMedium
        titleLabel.fcSetText(label, style: style)
        if selected {
            titleLabel.attributedText = NSAttributedString(string: label, attributes: [
                .font: fcuiFont(style, weight: .bold),
                .foregroundColor: labelColor,
                .paragraphStyle: style.paragraphStyle()
            ])
        }

        chevron.isHidden = !clickable
        isUserInteractionEnabled = clickable
        alpha = 1
    }

    override func traitCollectionDidChange(_ previous: UITraitCollection?) {
        super.traitCollectionDidChange(previous)
        applyBorder()
    }

    private func applyBorder() {
        layer.borderWidth = borderWidth
        layer.borderColor = borderColor?.cgColor
    }
}

// MARK: - Alignment surface

/// Port of `AlignmentSurface.kt` (2.0.0): a short prompt the farmer answers by tapping a chip.
///
/// Body order, as the app: message (bodyMedium), [16 + Listen pill on the live, non-escalate,
/// non-additive prompt], 16, then the options — header (titleMedium, not on escalate/additive),
/// 16 (only under a header), chips 8 apart — inside a 16-radius 1pt borderDefault card (padding
/// 16) for the capability prompts (GPS_PROMPT / UPLOAD_PHOTO), then the escape hatch (clarify /
/// confirm only). Escalate wraps the whole body in a 16-radius red-tinted card.
///
/// The UIKit flavour has no markdown renderer, so the message is plain bodyMedium text.
final class FCUIAlignmentSurfaceView: UIView {
    var onChipTap: ((AlignmentChip) -> Void)?
    var onTypeInstead: (() -> Void)?
    var onListen: (() -> Void)?

    private let container = UIStackView()
    private let messageLabel = UILabel()
    private let listenRow = UIStackView()
    private lazy var listenWrap = FCUIInsetView(listenRow, top: 16)
    private let optionsStack = UIStackView()
    private let optionsCardInsets: [NSLayoutConstraint]
    private let optionsHolder = UIView()
    private let headingLabel = UILabel()
    private let chipsStack = UIStackView()
    private let escapeHatchLabel = UILabel()
    private let escapeHatch = UIStackView()
    private lazy var escapeWrap = FCUIInsetView(escapeHatch, top: 12)
    private var containerInsets: [NSLayoutConstraint] = []
    private var isCapabilityCard = false

    override init(frame: CGRect) {
        optionsStack.translatesAutoresizingMaskIntoConstraints = false
        optionsHolder.addSubview(optionsStack)
        optionsCardInsets = [
            optionsStack.topAnchor.constraint(equalTo: optionsHolder.topAnchor),
            optionsStack.bottomAnchor.constraint(equalTo: optionsHolder.bottomAnchor),
            optionsStack.leadingAnchor.constraint(equalTo: optionsHolder.leadingAnchor),
            optionsStack.trailingAnchor.constraint(equalTo: optionsHolder.trailingAnchor)
        ]
        super.init(frame: frame)
        layer.cornerRadius = 16
        layer.cornerCurve = .continuous
        NSLayoutConstraint.activate(optionsCardInsets)
        optionsHolder.layer.cornerRadius = 16
        optionsHolder.layer.cornerCurve = .continuous

        messageLabel.textColor = FCUITheme.foregroundPrimary
        messageLabel.numberOfLines = 0

        listenRow.axis = .horizontal
        listenRow.alignment = .center

        headingLabel.font = FCUITypography.current.titleMedium.font
        headingLabel.textColor = FCUITheme.foregroundPrimary
        headingLabel.numberOfLines = 0

        chipsStack.axis = .vertical
        chipsStack.spacing = 8

        optionsStack.axis = .vertical
        optionsStack.spacing = 0
        optionsStack.addArrangedSubview(headingLabel)
        optionsStack.addArrangedSubview(chipsStack)

        // Escape hatch: info icon 16 + ONE text run "hint" + " " + "Type or say it." (accent,
        // SemiBold), bodySmall. The whole line takes the tap (the app hit-tests the CTA span).
        let info = UIImageView(image: UIImage(
            systemName: "info.circle",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 13)
        ))
        info.tintColor = FCUITheme.brandAccent
        info.contentMode = .center
        info.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            info.widthAnchor.constraint(equalToConstant: 16),
            info.heightAnchor.constraint(equalToConstant: 16)
        ])
        escapeHatchLabel.numberOfLines = 0
        escapeHatchLabel.isUserInteractionEnabled = true
        escapeHatchLabel.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(typeInsteadTapped)))
        escapeHatch.axis = .horizontal
        escapeHatch.spacing = 6
        escapeHatch.alignment = .center
        [info, escapeHatchLabel].forEach(escapeHatch.addArrangedSubview)

        let spacer16 = UIView()
        spacer16.translatesAutoresizingMaskIntoConstraints = false
        spacer16.heightAnchor.constraint(equalToConstant: 16).isActive = true

        container.axis = .vertical
        container.spacing = 0
        container.alignment = .fill
        container.translatesAutoresizingMaskIntoConstraints = false
        [messageLabel, listenWrap, spacer16, optionsHolder, escapeWrap].forEach(container.addArrangedSubview)
        addSubview(container)
        setInsets(0)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    @objc private func typeInsteadTapped() { onTypeInstead?() }

    /// - Parameters:
    ///   - selectedValues: chip values already tapped on this surface.
    ///   - isLoading: thread-level busy flag; locks every chip while a send is in flight.
    ///   - isLatest: true for the newest AI message — gates the Listen pill and the escape hatch.
    ///   - additive: true when rendering below a real answer; suppresses heading, Listen, hatch.
    ///   - listen: the Listen pill state, or nil when no pill may show (no server message id).
    func configure(
        kind: AlignmentKind,
        message: String,
        chips: [AlignmentChip],
        selectedValues: [String],
        isLoading: Bool,
        isLatest: Bool,
        additive: Bool,
        listenEnabled: Bool? = nil
    ) {
        let isEscalate = kind == .escalate
        let isCapabilityPrompt = kind == .gpsPrompt || kind == .uploadPhoto
        let hasPick = !selectedValues.isEmpty
        // Capability and additive surfaces are single-shot: one tap settles them, so every chip
        // locks. Clarify/confirm stay open so the farmer can pick a different option.
        let chipsLocked = (isCapabilityPrompt || additive) && hasPick

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
        messageLabel.fcSetText(message, style: FCUITypography.current.bodyMedium(atSize: FarmerChat.shared.config.messageFontSize ?? 17))
        messageLabel.isHidden = trimmedMessage.isEmpty

        // Listen pill: only on the live prompt (latest + idle), never on escalate / additive.
        listenRow.arrangedSubviews.forEach { $0.removeFromSuperview() }
        let showListen = !isEscalate && !additive && isLatest && !isLoading && listenEnabled != nil
        listenWrap.isHidden = !showListen
        if showListen {
            listenRow.addArrangedSubview(fcuiActionChip(
                systemImage: "speaker.wave.2.fill",
                title: fcuiLabel(FCLabels.listen, "Listen"),
                enabled: listenEnabled ?? false,
                action: { [weak self] in self?.onListen?() }
            ))
            listenRow.addArrangedSubview(UIView())
        }

        let showHeading = !isEscalate && !additive
        headingLabel.isHidden = !showHeading
        if showHeading { headingLabel.text = headingText(for: kind) }
        optionsStack.setCustomSpacing(showHeading && !chips.isEmpty ? 16 : 0, after: headingLabel)

        // Capability prompts present their options in a thin-bordered 16-radius card.
        isCapabilityCard = isCapabilityPrompt
        let cardInset: CGFloat = isCapabilityPrompt ? 16 : 0
        optionsCardInsets[0].constant = cardInset
        optionsCardInsets[1].constant = -cardInset
        optionsCardInsets[2].constant = cardInset
        optionsCardInsets[3].constant = -cardInset
        optionsHolder.layer.borderWidth = isCapabilityPrompt ? 1 : 0
        optionsHolder.layer.borderColor = isCapabilityPrompt ? FCUITheme.borderDefault.cgColor : nil

        chipsStack.arrangedSubviews.forEach {
            chipsStack.removeArrangedSubview($0)
            $0.removeFromSuperview()
        }
        for (index, chip) in chips.enumerated() {
            let isSelected = isSelected(chip, in: selectedValues)
            // Escalate keeps its red only as the fresh prompt or the pick; reopened others go grey.
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
        optionsHolder.isHidden = !showHeading && chips.isEmpty

        // Escape hatch: only on an open, exclusive, non-urgent surface that is still the latest.
        let showEscapeHatch = !chips.isEmpty && !isEscalate && !isCapabilityPrompt && !additive
            && !hasPick && isLatest && !isLoading
        escapeWrap.isHidden = !showEscapeHatch
        if showEscapeHatch {
            let style = FCUITypography.current.bodySmall
            let text = NSMutableAttributedString(
                string: fcuiLabel(AgenticLabels.dontSeeYourOption, AgenticLabels.dontSeeYourOptionFallback) + " ",
                attributes: [
                    .font: style.font,
                    .foregroundColor: FCUITheme.foregroundSecondary,
                    .paragraphStyle: style.paragraphStyle()
                ]
            )
            text.append(NSAttributedString(
                string: fcuiLabel(AgenticLabels.typeOrSayIt, AgenticLabels.typeOrSayItFallback),
                attributes: [
                    .font: fcuiFont(style, weight: .semibold),
                    .foregroundColor: FCUITheme.brandAccent,
                    .paragraphStyle: style.paragraphStyle()
                ]
            ))
            escapeHatchLabel.attributedText = text
        }
    }

    override func traitCollectionDidChange(_ previous: UITraitCollection?) {
        super.traitCollectionDidChange(previous)
        if isCapabilityCard { optionsHolder.layer.borderColor = FCUITheme.borderDefault.cgColor }
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
    var onListen: (() -> Void)? {
        get { surface.onListen }
        set { surface.onListen = newValue }
    }

    private let surface = FCUIAlignmentSurfaceView()

    override init(frame: CGRect) {
        super.init(frame: frame)
        surface.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(surface)
        NSLayoutConstraint.activate([
            surface.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 8),
            surface.bottomAnchor.constraint(equalTo: contentView.bottomAnchor, constant: -8),
            surface.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 20),
            surface.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -20)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    /// - Parameter isTtsEnabled: ListenButton `enabled`; the pill only shows when the answer has a
    ///   server message id to synthesise.
    func configure(message: ChatMessage.AiResponse, isLatest: Bool, isBusy: Bool, isTtsEnabled: Bool = true) {
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
            additive: false,
            listenEnabled: message.messageId != nil ? isTtsEnabled : nil
        )
    }
}

// MARK: - Home-entry back button (res/drawable/leftbutton.xml)

/// The app's `R.drawable.leftbutton`: a 42pt #08361B disc with a STROKED white back arrow (2pt,
/// round caps/joins) — path `M27.708 21.261H14.292M21 27.97L14.292 21.261L21 14.553` on a 42×42
/// viewBox. Rendered un-tinted, exactly as `LogoAppBar(leftPainter =)` draws it.
final class FCUILeftButton: UIControl {
    override init(frame: CGRect) {
        super.init(frame: CGRect(x: 0, y: 0, width: 42, height: 42))
        let disc = CAShapeLayer()
        disc.path = UIBezierPath(ovalIn: CGRect(x: 0, y: 0, width: 42, height: 42)).cgPath
        disc.fillColor = FCUITheme.green800.cgColor
        layer.addSublayer(disc)

        let arrow = UIBezierPath()
        arrow.move(to: CGPoint(x: 27.708, y: 21.261))
        arrow.addLine(to: CGPoint(x: 14.292, y: 21.261))
        arrow.move(to: CGPoint(x: 21, y: 27.97))
        arrow.addLine(to: CGPoint(x: 14.292, y: 21.261))
        arrow.addLine(to: CGPoint(x: 21, y: 14.553))
        let stroke = CAShapeLayer()
        stroke.path = arrow.cgPath
        stroke.strokeColor = UIColor.white.cgColor
        stroke.fillColor = UIColor.clear.cgColor
        stroke.lineWidth = 2
        stroke.lineCap = .round
        stroke.lineJoin = .round
        layer.addSublayer(stroke)

        translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: 42),
            heightAnchor.constraint(equalToConstant: 42)
        ])
        isAccessibilityElement = true
        accessibilityTraits = .button
        accessibilityLabel = "Back"
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
}

// MARK: - Scroll indicator (components/ScrollIndicator.kt)

/// A 40pt `buttonPrimaryAccent` circle with a white 20pt down arrow. 1500 ms after `trigger` it
/// fades in (200 ms); 300 ms later it bounces 3× (280 ms down EaseInOut / 320 ms up / 150 ms rest);
/// 400 ms after the last bounce it fades out (300 ms). The bounce is `IntOffset(0, 14)` — 14 device
/// PIXELS, not dp — hence `14 / displayScale` points.
final class FCUIScrollIndicator: UIControl {
    private var generation = 0

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = FCUITheme.brandAccent
        layer.cornerRadius = 20
        let arrow = UIImageView(image: UIImage(
            systemName: "arrow.down",
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 17, weight: .semibold)
        ))
        arrow.tintColor = .white
        arrow.translatesAutoresizingMaskIntoConstraints = false
        addSubview(arrow)
        translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: 40),
            heightAnchor.constraint(equalToConstant: 40),
            arrow.centerXAnchor.constraint(equalTo: centerXAnchor),
            arrow.centerYAnchor.constraint(equalTo: centerYAnchor),
            arrow.widthAnchor.constraint(equalToConstant: 20),
            arrow.heightAnchor.constraint(equalToConstant: 20)
        ])
        alpha = 0
        isHidden = true
        accessibilityLabel = "Scroll for more"
        accessibilityTraits = .button
        isAccessibilityElement = true
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    /// Restarts the timeline (android's `remember(triggerKey)`); `hasContentBelow` is asked at the
    /// moment it would appear.
    func trigger(hasContentBelow: @escaping () -> Bool) {
        cancel()
        let gen = generation
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            guard let self, self.generation == gen, hasContentBelow() else { return }
            self.isHidden = false
            UIView.animate(withDuration: 0.2) { self.alpha = 1 }
            self.bounce(remaining: 3, after: 0.3, generation: gen)
        }
    }

    func cancel() {
        generation += 1
        layer.removeAllAnimations()
        transform = .identity
        alpha = 0
        isHidden = true
    }

    private func bounce(remaining: Int, after delay: TimeInterval, generation gen: Int) {
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
            guard let self, self.generation == gen else { return }
            guard remaining > 0 else {
                UIView.animate(withDuration: 0.3, animations: { self.alpha = 0 }) { _ in
                    if self.generation == gen { self.isHidden = true }
                }
                return
            }
            let scale = self.traitCollection.displayScale > 0 ? self.traitCollection.displayScale : 1
            let depth = 14 / scale
            UIView.animate(withDuration: 0.28, delay: 0, options: [.curveEaseInOut], animations: {
                self.transform = CGAffineTransform(translationX: 0, y: depth)
            }) { _ in
                UIView.animate(withDuration: 0.32, delay: 0, options: [.curveEaseInOut], animations: {
                    self.transform = .identity
                }) { _ in
                    // 150 ms rest between bounces; 400 ms after the last one before fading out.
                    self.bounce(remaining: remaining - 1, after: remaining - 1 > 0 ? 0.15 : 0.15 + 0.4, generation: gen)
                }
            }
        }
    }
}
#endif
