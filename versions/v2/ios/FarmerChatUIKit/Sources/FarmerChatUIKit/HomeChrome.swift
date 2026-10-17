#if canImport(UIKit)
import UIKit
import FarmerChatCore

// Home chrome for the UIKit flavour, ported from the app's composer Home (fc-compose-agentic
// HomeScreen.kt, Figma 1.2 Home — `getComposerUiEnabled()` is hard-wired true in the app): the
// green → transparent band with sunbeams and the yellow bloom, the weather pill, the leaf-flanked
// section header and the Location 2.0 pill. Same values as the SwiftUI flavour (HomeChrome.swift).

// MARK: - Band

/// Solid brand green to 58.8% of a band 36.6% of the screen tall, transparent by its bottom, with
/// 280pt of sunbeams and the 148pt yellow bloom. Edge to edge (behind the status bar).
final class FCUIHomeBandView: UIView {
    private let gradient = CAGradientLayer()
    private let glow = CAGradientLayer()
    private let beams = FCUISunbeamsView()

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
        isAccessibilityElement = false
        let green = FCUITheme.brandSurfacePrimary
        gradient.colors = [green.cgColor, green.cgColor, green.withAlphaComponent(0).cgColor]
        gradient.locations = [0, 0.588, 1]
        layer.addSublayer(gradient)
        addSubview(beams)
        glow.type = .radial
        let sun = FCUITheme.sun300
        glow.colors = [0.5, 0.37, 0.25, 0.12, 0].map { sun.withAlphaComponent($0).cgColor }
        glow.locations = [0, 0.25, 0.5, 0.75, 1]
        layer.addSublayer(glow)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func layoutSubviews() {
        super.layoutSubviews()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        let band = bounds.height * 0.366
        gradient.frame = CGRect(x: 0, y: 0, width: bounds.width, height: band)
        glow.frame = CGRect(x: 0, y: 0, width: bounds.width, height: 148)
        glow.startPoint = CGPoint(x: 0.5, y: 0)
        glow.endPoint = CGPoint(x: 1, y: 1)
        CATransaction.commit()
        beams.frame = CGRect(x: 0, y: 0, width: bounds.width, height: 280)
    }
}

// MARK: - Sunbeams (components/Sunbeams.kt)

/// Eight soft rays from a sun 40pt above the top edge, in two groups each rendered and blurred
/// ONCE into an image; a frame only rotates (±1.4° over 16 s) and fades (8 s / 4 s rhythms) the
/// two layers — no per-frame drawing, as the app's half-resolution bitmaps.
final class FCUISunbeamsView: UIView {
    private let groupA = CALayer()
    private let groupB = CALayer()
    private var renderedWidth: CGFloat = 0
    private static let beams: [(angle: CGFloat, length: CGFloat, alpha: CGFloat)] = [
        (-52, 0.62, 0.07), (-36, 0.95, 0.10), (-22, 0.72, 0.07), (-8, 1.00, 0.11),
        (7, 0.78, 0.07), (21, 1.00, 0.10), (37, 0.68, 0.07), (51, 0.90, 0.08)
    ]

    override init(frame: CGRect) {
        super.init(frame: frame)
        isUserInteractionEnabled = false
        layer.addSublayer(groupA)
        layer.addSublayer(groupB)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func layoutSubviews() {
        super.layoutSubviews()
        guard bounds.width > 0, abs(bounds.width - renderedWidth) > 0.5 else { return }
        renderedWidth = bounds.width
        for (layer, parity) in [(groupA, 0), (groupB, 1)] {
            layer.frame = bounds
            layer.contents = render(parity: parity, size: bounds.size)?.cgImage
            // Rotate about the sun (40pt above the top edge).
            layer.anchorPoint = CGPoint(x: 0.5, y: -40 / bounds.height)
            layer.position = CGPoint(x: bounds.midX, y: -40)
        }
        animate()
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window != nil { animate() }
    }

    private func animate() {
        guard groupA.contents != nil else { return }
        for layer in [groupA, groupB] {
            let sway = CABasicAnimation(keyPath: "transform.rotation.z")
            sway.fromValue = -1.4 * CGFloat.pi / 180
            sway.toValue = 1.4 * CGFloat.pi / 180
            sway.duration = 16
            sway.autoreverses = true
            sway.repeatCount = .infinity
            sway.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            layer.add(sway, forKey: "sway")
        }
        for (layer, period, delay) in [(groupA, 8.0, 0.0), (groupB, 4.0, 0.8)] {
            let breathe = CABasicAnimation(keyPath: "opacity")
            breathe.fromValue = 0.1
            breathe.toValue = 1.0
            breathe.duration = period / 2
            breathe.beginTime = CACurrentMediaTime() + delay
            breathe.autoreverses = true
            breathe.repeatCount = .infinity
            breathe.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
            layer.add(breathe, forKey: "breathe")
        }
    }

    private func render(parity: Int, size: CGSize) -> UIImage? {
        let warm = UIColor(red: 1, green: 246 / 255, blue: 214 / 255, alpha: 1)
        let sharp = UIGraphicsImageRenderer(size: size).image { ctx in
            let cg = ctx.cgContext
            let origin = CGPoint(x: size.width / 2, y: -40)
            for (index, beam) in Self.beams.enumerated() where index % 2 == parity {
                let rad = beam.angle * .pi / 180
                let dir = CGPoint(x: sin(rad), y: cos(rad))
                let perp = CGPoint(x: dir.y, y: -dir.x)
                let startR: CGFloat = 30, endR = size.height * beam.length * 1.35
                let path = CGMutablePath()
                path.move(to: CGPoint(x: origin.x + dir.x * startR - perp.x * 3, y: origin.y + dir.y * startR - perp.y * 3))
                path.addLine(to: CGPoint(x: origin.x + dir.x * startR + perp.x * 3, y: origin.y + dir.y * startR + perp.y * 3))
                path.addLine(to: CGPoint(x: origin.x + dir.x * endR + perp.x * 17, y: origin.y + dir.y * endR + perp.y * 17))
                path.addLine(to: CGPoint(x: origin.x + dir.x * endR - perp.x * 17, y: origin.y + dir.y * endR - perp.y * 17))
                path.closeSubpath()
                cg.saveGState()
                cg.addPath(path)
                cg.clip()
                let colors = [warm.withAlphaComponent(beam.alpha).cgColor, warm.withAlphaComponent(0).cgColor] as CFArray
                if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1]) {
                    cg.drawLinearGradient(gradient, start: .zero, end: CGPoint(x: 0, y: size.height * 0.85), options: [])
                }
                cg.restoreGState()
            }
        }
        // Real sun has no hard edges — a 7pt Gaussian blur, applied once.
        guard let input = CIImage(image: sharp),
              let filter = CIFilter(name: "CIGaussianBlur") else { return sharp }
        filter.setValue(input, forKey: kCIInputImageKey)
        filter.setValue(7 * sharp.scale, forKey: kCIInputRadiusKey)
        guard let output = filter.outputImage?.cropped(to: input.extent),
              let cg = CIContext().createCGImage(output, from: input.extent) else { return sharp }
        return UIImage(cgImage: cg, scale: sharp.scale, orientation: .up)
    }
}

// MARK: - SectionHeader (components/SectionHeader.kt)

/// A gapless row of 4pt leaves (`drawable/leaf.xml`), alternately mirrored, centred.
final class FCUILeafDividerView: UIView {
    var color: UIColor = FCUITheme.brandAccent { didSet { setNeedsDisplay() } }

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        contentMode = .redraw
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override var intrinsicContentSize: CGSize { CGSize(width: UIView.noIntrinsicMetric, height: 4) }

    static func leafPath(size s: CGFloat) -> UIBezierPath {
        let k = s / 11
        let path = UIBezierPath()
        path.move(to: CGPoint(x: 10.5191 * k, y: 0))
        path.addCurve(to: CGPoint(x: 0, y: 10.5286 * k), controlPoint1: CGPoint(x: 4.70952 * k, y: 0), controlPoint2: CGPoint(x: 0, y: 4.71382 * k))
        path.addCurve(to: CGPoint(x: 10.5191 * k, y: 0), controlPoint1: CGPoint(x: 5.8095 * k, y: 10.5286 * k), controlPoint2: CGPoint(x: 10.5191 * k, y: 5.81477 * k))
        path.close()
        return path
    }

    override func draw(_ rect: CGRect) {
        let s = bounds.height
        guard s > 0, bounds.width > 0 else { return }
        let count = Int(floor(bounds.width / s))
        let startX = (bounds.width - CGFloat(count) * s) / 2
        color.setFill()
        for i in 0..<count {
            let leaf = Self.leafPath(size: s)
            var t = CGAffineTransform(translationX: startX + CGFloat(i) * s, y: 0)
            if i % 2 == 1 { t = t.translatedBy(x: s, y: 0).scaledBy(x: -1, y: 1) }
            leaf.apply(t)
            leaf.fill()
        }
    }
}

/// Centred 18pt SemiBold title between leaf dividers, 24pt side padding, 10pt gaps.
final class FCUISectionHeaderView: UIView {
    let titleLabel = UILabel()

    init(title: String, titleColor: UIColor) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        titleLabel.text = title
        titleLabel.font = .systemFont(ofSize: 18, weight: .semibold)
        titleLabel.textColor = titleColor
        titleLabel.textAlignment = .center
        titleLabel.numberOfLines = 0
        titleLabel.accessibilityTraits = .header
        titleLabel.setContentCompressionResistancePriority(.required, for: .horizontal)
        titleLabel.setContentHuggingPriority(.required, for: .horizontal)
        let left = FCUILeafDividerView(), right = FCUILeafDividerView()
        let row = UIStackView(arrangedSubviews: [left, titleLabel, right])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 10
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        NSLayoutConstraint.activate([
            row.topAnchor.constraint(equalTo: topAnchor),
            row.bottomAnchor.constraint(equalTo: bottomAnchor),
            row.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 24),
            row.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -24),
            left.widthAnchor.constraint(equalTo: right.widthAnchor),
            left.heightAnchor.constraint(equalToConstant: 4),
            right.heightAnchor.constraint(equalToConstant: 4),
            titleLabel.widthAnchor.constraint(lessThanOrEqualTo: row.widthAnchor, multiplier: 0.8)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
}

// MARK: - LocationButton (components/buttons/LocationButton.kt)

/// The Location 2.0 pill: Green800 (72% while inviting), 14/22 padding, 22pt icon, white
/// labelMedium; 42pt tall, 40pt once located.
final class FCUILocationPillButton: UIControl {
    private let icon = UIImageView()
    private let spinner = UIActivityIndicatorView(style: .medium)
    private let label = UILabel()
    private var heightConstraint: NSLayoutConstraint!
    private var gap: NSLayoutConstraint!

    override init(frame: CGRect) {
        super.init(frame: frame)
        translatesAutoresizingMaskIntoConstraints = false
        layer.cornerCurve = .continuous
        icon.tintColor = FCUITheme.brandAccent
        icon.contentMode = .center
        icon.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 16, weight: .semibold)
        spinner.color = FCUITheme.brandAccent
        spinner.hidesWhenStopped = true
        label.font = FCUITypography.current.labelMedium.font
        label.textColor = .white
        for v in [icon, spinner, label] as [UIView] {
            v.translatesAutoresizingMaskIntoConstraints = false
            v.isUserInteractionEnabled = false
            addSubview(v)
        }
        heightConstraint = heightAnchor.constraint(equalToConstant: 42)
        gap = label.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 6)
        NSLayoutConstraint.activate([
            heightConstraint, gap,
            icon.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
            icon.centerYAnchor.constraint(equalTo: centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 22),
            icon.heightAnchor.constraint(equalToConstant: 22),
            spinner.centerXAnchor.constraint(equalTo: icon.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: icon.centerYAnchor),
            label.centerYAnchor.constraint(equalTo: centerYAnchor),
            label.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -22)
        ])
        isAccessibilityElement = true
        accessibilityTraits = .button
        accessibilityIdentifier = "fcHomeLocationPill"
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func layoutSubviews() {
        super.layoutSubviews()
        layer.cornerRadius = bounds.height / 2
    }

    func configure(state: FCLocationPillState, placeName: String) {
        backgroundColor = FCUITheme.brandSurfaceSecondary.withAlphaComponent(state == .invite ? 0.72 : 1)
        heightConstraint.constant = state == .located || state == .success ? 40 : 42
        switch state {
        case .searching: gap.constant = 8
        case .success, .located: gap.constant = 4
        default: gap.constant = 6
        }
        if state == .searching {
            icon.image = nil
            spinner.startAnimating()
        } else {
            spinner.stopAnimating()
            let symbol: String
            switch state {
            case .invite: symbol = "location.circle"
            case .success: symbol = "checkmark"
            case .blocked: symbol = "location.slash"
            default: symbol = "mappin.and.ellipse"
            }
            icon.image = UIImage(systemName: symbol)
        }
        let text: NSAttributedString
        switch state {
        case .invite: text = NSAttributedString(string: fcuiLabel(FCLabels.setYourLocation, "Set your location"))
        case .searching: text = NSAttributedString(string: fcuiLabel(FCLabels.gettingYourLocation, "Getting your location"))
        case .success: text = NSAttributedString(string: fcuiLabel(FCLabels.locationFound, "Location found"))
        case .blocked: text = NSAttributedString(string: fcuiLabel(FCLabels.allowLocationInSettings, "Allow location in Settings"))
        case .located:
            let s = NSMutableAttributedString(string: placeName + " - ")
            s.append(NSAttributedString(string: fcuiLabel(FCLabels.change, "Change"), attributes: [.foregroundColor: FCUITheme.brandAccent]))
            text = s
        }
        label.attributedText = text
        accessibilityLabel = text.string
    }
}

// MARK: - WeatherButton (components/buttons/WeatherButton.kt)

/// 44pt fully-rounded pill on `brand.surfaceSecondary`: 14/8 padding, 24pt icon, 8pt, white
/// labelMedium `current_temp` (verbatim), 2pt, a 22pt chevron in `brand.foregroundSecondary`.
final class FCUIWeatherPill: UIControl {
    private let icon = UIImageView()
    private let label = UILabel()
    private let chevron = UIImageView(image: UIImage(systemName: "chevron.right", withConfiguration: UIImage.SymbolConfiguration(pointSize: 13, weight: .semibold)))
    private let spinner = UIActivityIndicatorView(style: .medium)
    private var iconTask: URLSessionDataTask?
    private var iconURL: String?
    private var trailing: NSLayoutConstraint!

    override init(frame: CGRect) {
        super.init(frame: frame)
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = FCUITheme.brandSurfaceSecondary
        layer.cornerRadius = 22
        icon.contentMode = .scaleAspectFit
        icon.image = Self.fallbackIcon
        label.font = FCUITypography.current.labelMedium.font
        label.textColor = .white
        chevron.tintColor = FCUITheme.brandAccent
        chevron.contentMode = .center
        spinner.color = .white
        spinner.hidesWhenStopped = true
        let row = UIStackView(arrangedSubviews: [spinner, icon, label, chevron])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = 8
        row.setCustomSpacing(2, after: label)
        row.isUserInteractionEnabled = false
        row.translatesAutoresizingMaskIntoConstraints = false
        addSubview(row)
        // The pill hugs its content: it must not stretch into the app bar's empty title space.
        row.setContentHuggingPriority(.required, for: .horizontal)
        setContentHuggingPriority(.required, for: .horizontal)
        trailing = row.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(equalToConstant: 44),
            row.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 14),
            trailing,
            row.centerYAnchor.constraint(equalTo: centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 24),
            icon.heightAnchor.constraint(equalToConstant: 24),
            chevron.widthAnchor.constraint(equalToConstant: 22),
            chevron.heightAnchor.constraint(equalToConstant: 22)
        ])
        isAccessibilityElement = true
        accessibilityTraits = .button
        accessibilityIdentifier = "fcHomeWeather"
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    private static let fallbackIcon = UIImage(systemName: "cloud.sun.fill")?
        .applyingSymbolConfiguration(UIImage.SymbolConfiguration(paletteColors: [.white, .systemYellow]))

    func configure(loading: Bool, weather: WeatherResponse?) {
        if loading {
            spinner.startAnimating()
            icon.isHidden = true
            chevron.isHidden = true
            label.text = fcuiLabel(FCLabels.loading, "Loading...")
            trailing.constant = -16
        } else {
            spinner.stopAnimating()
            icon.isHidden = false
            chevron.isHidden = false
            label.text = weather?.currentTemp ?? ""
            trailing.constant = -8
            loadIcon(weather?.weatherIcon)
        }
        accessibilityLabel = label.text
    }

    /// The server icon; SVGs (which UIImage cannot decode — the app uses an SvgImage) keep the
    /// condition glyph.
    private func loadIcon(_ urlString: String?) {
        guard urlString != iconURL else { return }
        iconURL = urlString
        iconTask?.cancel()
        icon.image = Self.fallbackIcon
        guard let urlString, !urlString.lowercased().hasSuffix(".svg"), let url = URL(string: urlString) else { return }
        iconTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let data, let image = UIImage(data: data) else { return }
            DispatchQueue.main.async { self?.icon.image = image }
        }
        iconTask?.resume()
    }
}
#endif
