#if canImport(UIKit)
import UIKit
import FarmerChatCore

// Chat chrome for the UIKit flavour, ported from the app (fc-compose-agentic dev/v2.5):
// the branded app bar (LogoAppBar.kt), the floating composer (InputComposer.kt), the answer
// markdown (MarkdownText.kt) and the answer-generation tips (Tips.kt / Tip.kt). Pure UIKit, iOS 15.

// MARK: - Header tile (components/buttons/ActionButton.kt)

/// A 42×42 smooth square, radius 12, `#08361B`, white 23pt icon (ActionButton.kt:60-63). The SDK's
/// CHAT_ONLY ✕ and globe use it; the app's History-entry menu button is the same component.
final class FCUIHeaderTile: UIControl {
    convenience init(systemImage: String, accessibilityLabel label: String, identifier: String, radius: CGFloat = 12) {
        self.init(image: UIImage(
            systemName: systemImage,
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 19, weight: .medium)
        ), accessibilityLabel: label, identifier: identifier, radius: radius)
    }

    /// A tile with a given template image (e.g. [fcHistoryGlyphImage]), tinted white like the
    /// SF Symbol tiles.
    /// `radius`: ActionButton's Radius.MD (12) square, or 21 for the round Radius.Rounded tile
    /// (DefaultAppBar menu/close, HomeAppBar menu).
    init(image: UIImage?, accessibilityLabel label: String, identifier: String, radius: CGFloat = 12) {
        super.init(frame: CGRect(x: 0, y: 0, width: 42, height: 42))
        backgroundColor = FCUITheme.brandSurfaceSecondary
        layer.cornerRadius = radius
        layer.cornerCurve = .continuous
        let icon = UIImageView(image: image)
        icon.tintColor = .white
        icon.contentMode = .center
        icon.isUserInteractionEnabled = false
        icon.translatesAutoresizingMaskIntoConstraints = false
        addSubview(icon)
        translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            widthAnchor.constraint(equalToConstant: 42),
            heightAnchor.constraint(equalToConstant: 42),
            icon.centerXAnchor.constraint(equalTo: centerXAnchor),
            icon.centerYAnchor.constraint(equalTo: centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 23),
            icon.heightAnchor.constraint(equalToConstant: 23)
        ])
        isAccessibilityElement = true
        accessibilityTraits = .button
        accessibilityLabel = label
        accessibilityIdentifier = identifier
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override var isHighlighted: Bool {
        didSet { alpha = isHighlighted ? 0.7 : 1 }
    }
}

// MARK: - App bar (components/appbars/LogoAppBar.kt)

/// LogoAppBar: solid brand green `#008236`, 64pt + the status-bar inset (edge to edge), the
/// `glow_yellow.png` bloom drawn over its top 80pt, a 16pt-padded row of [left | logo | right].
///
/// The glow is drawn in code: the PNG is a Sun300 (`#F9FF47`) elliptical bloom whose centre column
/// is ≈50% alpha at the top, ≈37/25/12% at 25/50/75% height and 0 at the bottom, ≈12% at x=12.5%
/// of the width and 0 at the edge — a radial gradient with a half-width × 80pt radius reproduces
/// those samples. Logo: `logo_mark` 36pt white, fading in 600 ms / out 300 ms (EaseOut).
final class FCUIChatAppBar: UIView {
    static let barHeight: CGFloat = 64
    private static let glowHeight: CGFloat = 80

    private let glow = CAGradientLayer()
    private let logo = CAShapeLayer()
    private let logoHost = UIView()
    private let leftSlot = UIStackView()
    private let rightSlot = UIStackView()

    init(left: [UIView], right: [UIView]) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = FCUITheme.brandSurfacePrimary

        glow.type = .radial
        let sun = FCUITheme.sun300
        glow.colors = [0.5, 0.37, 0.25, 0.12, 0].map { sun.withAlphaComponent($0).cgColor }
        glow.locations = [0, 0.25, 0.5, 0.75, 1]
        layer.addSublayer(glow)

        logo.path = FCUILogoMark.path(size: 36)
        logo.fillColor = UIColor.white.cgColor
        logo.frame = CGRect(x: 0, y: 0, width: 36, height: 36)
        logoHost.layer.addSublayer(logo)
        logoHost.isUserInteractionEnabled = false
        logoHost.alpha = 0
        logoHost.isAccessibilityElement = false
        logoHost.translatesAutoresizingMaskIntoConstraints = false
        addSubview(logoHost)

        for (slot, views) in [(leftSlot, left), (rightSlot, right)] {
            slot.axis = .horizontal
            slot.spacing = 8
            slot.alignment = .center
            slot.translatesAutoresizingMaskIntoConstraints = false
            views.forEach { slot.addArrangedSubview($0) }
            addSubview(slot)
        }
        let row = UILayoutGuide()
        addLayoutGuide(row)
        NSLayoutConstraint.activate([
            row.topAnchor.constraint(equalTo: safeAreaLayoutGuide.topAnchor),
            row.bottomAnchor.constraint(equalTo: bottomAnchor),
            row.heightAnchor.constraint(equalToConstant: Self.barHeight),
            row.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 16),
            row.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -16),
            leftSlot.leadingAnchor.constraint(equalTo: row.leadingAnchor),
            leftSlot.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            leftSlot.heightAnchor.constraint(equalToConstant: 42),
            rightSlot.trailingAnchor.constraint(equalTo: row.trailingAnchor),
            rightSlot.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            rightSlot.heightAnchor.constraint(equalToConstant: 42),
            logoHost.centerXAnchor.constraint(equalTo: row.centerXAnchor),
            logoHost.centerYAnchor.constraint(equalTo: row.centerYAnchor),
            logoHost.widthAnchor.constraint(equalToConstant: 36),
            logoHost.heightAnchor.constraint(equalToConstant: 36)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func layoutSubviews() {
        super.layoutSubviews()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        glow.frame = CGRect(x: 0, y: 0, width: bounds.width, height: Self.glowHeight)
        glow.startPoint = CGPoint(x: 0.5, y: 0)
        glow.endPoint = CGPoint(x: 1, y: 1)
        CATransaction.commit()
    }

    /// LogoAppBar.kt:110-121 — shown only for a settled thread (`Thread && !isLoading`).
    func setLogoVisible(_ visible: Bool, animated: Bool = true) {
        let target: CGFloat = visible ? 1 : 0
        guard logoHost.alpha != target else { return }
        guard animated else { logoHost.alpha = target; return }
        UIView.animate(withDuration: visible ? 0.6 : 0.3, delay: 0, options: [.curveEaseOut, .beginFromCurrentState]) {
            self.logoHost.alpha = target
        }
    }
}

// MARK: - Aura (InputComposer.kt:147-161, 361-386, 539-571)

/// The idle composer field's breathing sweep-gradient outline: green → cyan → green → yellow →
/// green, one turn per 7 s; three strokes (halo 10.8pt @16%, mid 7.2pt @30%, core 4.8pt @100%)
/// clipped to the field, so about half of each shows inside the field edge.
final class FCUIAuraView: UIView {
    private let rings: [(width: CGFloat, alpha: Float)] = [(10.8, 0.16), (7.2, 0.30), (4.8, 1.0)]
    private var gradients: [CAGradientLayer] = []
    private var masks: [CAShapeLayer] = []
    private let cornerRadius: CGFloat

    init(cornerRadius: CGFloat) {
        self.cornerRadius = cornerRadius
        super.init(frame: .zero)
        isUserInteractionEnabled = false
        clipsToBounds = true
        layer.cornerRadius = cornerRadius
        layer.cornerCurve = .continuous
        let colors = [FCUITheme.green500, UIColor(rgb: 0x22D3EE), FCUITheme.green500, UIColor(rgb: 0xFFF947), FCUITheme.green500]
        for ring in rings {
            let holder = CALayer()
            let gradient = CAGradientLayer()
            gradient.type = .conic
            gradient.startPoint = CGPoint(x: 0.5, y: 0.5)
            gradient.endPoint = CGPoint(x: 0.5, y: 0)
            gradient.colors = colors.map(\.cgColor)
            gradient.locations = [0, 0.25, 0.5, 0.75, 1]
            let mask = CAShapeLayer()
            mask.fillColor = UIColor.clear.cgColor
            mask.strokeColor = UIColor.black.cgColor
            mask.lineWidth = ring.width
            holder.mask = mask
            holder.opacity = ring.alpha
            holder.addSublayer(gradient)
            layer.addSublayer(holder)
            gradients.append(gradient)
            masks.append(mask)
        }
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func layoutSubviews() {
        super.layoutSubviews()
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        let side = hypot(bounds.width, bounds.height)
        for (index, gradient) in gradients.enumerated() {
            gradient.superlayer?.frame = bounds
            gradient.bounds = CGRect(x: 0, y: 0, width: side, height: side)
            gradient.position = CGPoint(x: bounds.midX, y: bounds.midY)
            masks[index].frame = bounds
            masks[index].path = UIBezierPath(roundedRect: bounds, cornerRadius: cornerRadius).cgPath
        }
        CATransaction.commit()
        startAnimating()
    }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        startAnimating()
    }

    private func startAnimating() {
        guard window != nil, bounds.width > 0, !UIAccessibility.isReduceMotionEnabled else { return }
        for gradient in gradients where gradient.animation(forKey: "fc.aura.spin") == nil {
            let spin = CABasicAnimation(keyPath: "transform.rotation.z")
            spin.fromValue = 0
            spin.toValue = 2 * Double.pi
            spin.duration = 7.0
            spin.repeatCount = .infinity
            gradient.add(spin, forKey: "fc.aura.spin")
        }
        guard layer.animation(forKey: "fc.aura.breathe") == nil else { return }
        // Intensity: 1.0↔0.5 twice (2400 ms legs), ebb to 0.04 (2800 ms), swell to 1.0 (2600 ms).
        let legs: [(value: Float, ms: Double)] = [(0.5, 2400), (1.0, 2400), (0.5, 2400), (1.0, 2400), (0.04, 2800), (1.0, 2600)]
        let total = legs.reduce(0) { $0 + $1.ms }
        var values: [Float] = [1.0]
        var times: [NSNumber] = [0]
        var elapsed = 0.0
        for leg in legs {
            elapsed += leg.ms
            values.append(leg.value)
            times.append(NSNumber(value: elapsed / total))
        }
        let breathe = CAKeyframeAnimation(keyPath: "opacity")
        breathe.values = values
        breathe.keyTimes = times
        breathe.timingFunctions = Array(repeating: CAMediaTimingFunction(name: .easeInEaseOut), count: legs.count)
        breathe.duration = total / 1000
        breathe.repeatCount = .infinity
        layer.add(breathe, forKey: "fc.aura.breathe")
    }
}

// MARK: - Composer (components/userinput/InputComposer.kt, floating + anchored + compact)

/// The floating composer: a brand-green sheet (smooth radius 24, 10pt side margins) on a white
/// full-width wrapper, holding [camera 48 | field | mic/send 48] 6pt apart, bottom-aligned.
///
/// The camera hides once text is typed; the mic glyph swaps to send (same `#08361B` circle). The
/// field is white, smooth radius 16, min 48pt, 14pt horizontal padding, bodyMedium 17/25, 1–3
/// lines. Placeholder `fc_v2_app_label_ask_about_your_farm`, single line: black + green shimmer
/// (2.25 s) when idle, grey `#71717B` once focused. The breathing aura shows only idle + unfocused.
final class FCUIComposerView: UIView, UITextViewDelegate {
    var onSend: ((String) -> Void)?
    var onCamera: (() -> Void)?
    var onMic: (() -> Void)?
    var onFocusChange: ((Bool) -> Void)?
    var onTextChange: (() -> Void)?
    /// InputComposer.kt `photoUris` (one image): a picked photo waits here as a 64pt thumbnail
    /// (PhotoThumbnail.kt) so the farmer can add a caption; Send sends both.
    var attachment: UIImage? {
        didSet {
            thumb.image = attachment
            thumbWrap.isHidden = attachment == nil
            textTopToField.isActive = attachment == nil
            textTopToThumb.isActive = attachment != nil
            refresh(animated: true)
        }
    }
    var onRemoveAttachment: (() -> Void)?
    private let thumbWrap = UIView()
    private let thumb = UIImageView()
    private let thumbRemove = UIButton(type: .custom)
    private var textTopToField: NSLayoutConstraint!
    private var textTopToThumb: NSLayoutConstraint!

    let sheet = UIView()
    private let row = UIStackView()
    private let cameraButton = UIButton(type: .custom)
    private let actionButton = UIButton(type: .custom)
    private let field = UIView()
    let textView = UITextView()
    private let placeholder = FCUIShimmerLabel()
    private let aura = FCUIAuraView(cornerRadius: 16)
    private var textHeight: NSLayoutConstraint!
    private var sheetTop: NSLayoutConstraint!
    private var sheetBottomPad: NSLayoutConstraint!
    private var rowTop: NSLayoutConstraint!
    private var buttonSizes: [NSLayoutConstraint] = []
    private let showCamera: Bool
    private let showMic: Bool
    private static let maxLines: CGFloat = 3
    private static let micGlyph = UIImage(systemName: "mic.fill", withConfiguration: UIImage.SymbolConfiguration(pointSize: 20, weight: .semibold))
    /// `icon_send`: a right-pointing paper plane — SF `paperplane.fill` turned 45° and baked
    /// into the image (a transform on UIButton's imageView does not survive its layout).
    private static let sendGlyph: UIImage? = {
        guard let plane = UIImage(systemName: "paperplane.fill", withConfiguration: UIImage.SymbolConfiguration(pointSize: 19, weight: .semibold)) else { return nil }
        let side = ceil(max(plane.size.width, plane.size.height) * 1.3)
        let image = UIGraphicsImageRenderer(size: CGSize(width: side, height: side)).image { context in
            let cg = context.cgContext
            cg.translateBy(x: side / 2, y: side / 2)
            cg.rotate(by: .pi / 4)
            plane.draw(in: CGRect(x: -plane.size.width / 2, y: -plane.size.height / 2, width: plane.size.width, height: plane.size.height))
        }
        return image.withRenderingMode(.alwaysTemplate)
    }()

    private var bodyStyle: FCUITextStyle { FCUITypography.current.bodyMedium }

    /// Re-resolves the placeholder and control labels after a language change.
    func relabel() {
        let ask = fcuiLabel(FCLabels.askAboutYourFarm, "Ask about your farm...")
        placeholder.text = ask
        textView.accessibilityLabel = ask
        cameraButton.accessibilityLabel = fcuiLabel(FCLabels.photo, "Photo")
        refresh(animated: false)
    }

    init(showCamera: Bool, showMic: Bool) {
        self.showCamera = showCamera
        self.showMic = showMic
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        // The wrapper behind the floating sheet is the reading surface (ChatInputOverlays.kt).
        backgroundColor = FCUITheme.surfaceReadingPrimary

        sheet.backgroundColor = FCUITheme.brandSurfacePrimary
        sheet.layer.cornerRadius = 24
        sheet.layer.cornerCurve = .continuous
        sheet.translatesAutoresizingMaskIntoConstraints = false
        addSubview(sheet)

        configureCircle(cameraButton, symbol: "camera.fill", label: fcuiLabel(FCLabels.photo, "Photo"), id: "fcComposerCamera")
        cameraButton.addAction(UIAction { [weak self] _ in self?.onCamera?() }, for: .touchUpInside)
        configureCircle(actionButton, symbol: "mic.fill", label: fcuiLabel(FCLabels.speak, "Speak"), id: "fcComposerMic")
        actionButton.addAction(UIAction { [weak self] _ in self?.actionTapped() }, for: .touchUpInside)

        field.backgroundColor = .white
        field.layer.cornerRadius = 16
        field.layer.cornerCurve = .continuous
        field.translatesAutoresizingMaskIntoConstraints = false

        textView.backgroundColor = .clear
        textView.isScrollEnabled = false
        textView.textContainerInset = .zero
        textView.textContainer.lineFragmentPadding = 0
        textView.font = bodyStyle.font
        textView.textColor = .black
        textView.tintColor = FCUITheme.green700
        textView.typingAttributes = [
            .font: bodyStyle.font,
            .foregroundColor: UIColor.black,
            .paragraphStyle: bodyStyle.paragraphStyle()
        ]
        textView.delegate = self
        textView.accessibilityIdentifier = "fcComposerField"
        textView.accessibilityLabel = fcuiLabel(FCLabels.askAboutYourFarm, "Ask about your farm...")
        textView.translatesAutoresizingMaskIntoConstraints = false

        placeholder.text = fcuiLabel(FCLabels.askAboutYourFarm, "Ask about your farm...")
        placeholder.font = bodyStyle.font
        placeholder.numberOfLines = 1
        placeholder.period = 2.25
        placeholder.baseColor = .black
        placeholder.isUserInteractionEnabled = false
        placeholder.isAccessibilityElement = false
        placeholder.translatesAutoresizingMaskIntoConstraints = false

        aura.translatesAutoresizingMaskIntoConstraints = false
        field.addSubview(aura)
        field.addSubview(placeholder)
        field.addSubview(textView)

        // PhotoThumbnail.kt: 64pt, radius SM (8), crop; a 20pt surfaceSecondary circle with a 14pt
        // close glyph 3pt in from the top-right corner.
        thumb.contentMode = .scaleAspectFill
        thumb.clipsToBounds = true
        thumb.layer.cornerRadius = 8
        thumb.layer.cornerCurve = .continuous
        thumb.translatesAutoresizingMaskIntoConstraints = false
        thumb.accessibilityIdentifier = "fcComposerPhoto"
        thumb.isAccessibilityElement = true
        thumbRemove.backgroundColor = FCUITheme.surfaceSecondary
        thumbRemove.layer.cornerRadius = 10
        thumbRemove.tintColor = FCUITheme.foregroundPrimary
        thumbRemove.setImage(UIImage(systemName: "xmark", withConfiguration: UIImage.SymbolConfiguration(pointSize: 9, weight: .bold)), for: .normal)
        thumbRemove.accessibilityLabel = "Remove photo"
        thumbRemove.accessibilityIdentifier = "fcComposerRemovePhoto"
        thumbRemove.translatesAutoresizingMaskIntoConstraints = false
        thumbRemove.addAction(UIAction { [weak self] _ in self?.onRemoveAttachment?() }, for: .touchUpInside)
        thumbWrap.translatesAutoresizingMaskIntoConstraints = false
        thumbWrap.isHidden = true
        thumbWrap.addSubview(thumb)
        thumbWrap.addSubview(thumbRemove)
        field.addSubview(thumbWrap)

        row.axis = .horizontal
        row.spacing = 6
        row.alignment = .bottom
        row.translatesAutoresizingMaskIntoConstraints = false
        if showCamera { row.addArrangedSubview(cameraButton) }
        row.addArrangedSubview(field)
        row.addArrangedSubview(actionButton)
        sheet.addSubview(row)

        textHeight = textView.heightAnchor.constraint(equalToConstant: bodyStyle.lineHeight)
        textTopToField = textView.topAnchor.constraint(equalTo: field.topAnchor, constant: 12)
        textTopToThumb = textView.topAnchor.constraint(equalTo: thumbWrap.bottomAnchor, constant: 10)
        textTopToField.isActive = true
        sheetTop = sheet.topAnchor.constraint(equalTo: topAnchor)
        rowTop = row.topAnchor.constraint(equalTo: sheet.topAnchor, constant: 12)
        sheetBottomPad = sheet.bottomAnchor.constraint(equalTo: row.bottomAnchor, constant: 12)
        NSLayoutConstraint.activate([
            sheetTop,
            sheet.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 10),
            sheet.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -10),
            sheet.bottomAnchor.constraint(equalTo: bottomAnchor),
            rowTop,
            sheetBottomPad,
            row.leadingAnchor.constraint(equalTo: sheet.leadingAnchor, constant: 10),
            row.trailingAnchor.constraint(equalTo: sheet.trailingAnchor, constant: -10),
            field.heightAnchor.constraint(greaterThanOrEqualToConstant: 48),
            textView.bottomAnchor.constraint(equalTo: field.bottomAnchor, constant: -12),
            thumbWrap.topAnchor.constraint(equalTo: field.topAnchor, constant: 10),
            thumbWrap.leadingAnchor.constraint(equalTo: field.leadingAnchor, constant: 14),
            thumbWrap.widthAnchor.constraint(equalToConstant: 64),
            thumbWrap.heightAnchor.constraint(equalToConstant: 64),
            thumb.topAnchor.constraint(equalTo: thumbWrap.topAnchor),
            thumb.bottomAnchor.constraint(equalTo: thumbWrap.bottomAnchor),
            thumb.leadingAnchor.constraint(equalTo: thumbWrap.leadingAnchor),
            thumb.trailingAnchor.constraint(equalTo: thumbWrap.trailingAnchor),
            thumbRemove.widthAnchor.constraint(equalToConstant: 20),
            thumbRemove.heightAnchor.constraint(equalToConstant: 20),
            thumbRemove.topAnchor.constraint(equalTo: thumbWrap.topAnchor, constant: 3),
            thumbRemove.trailingAnchor.constraint(equalTo: thumbWrap.trailingAnchor, constant: -3),
            textView.leadingAnchor.constraint(equalTo: field.leadingAnchor, constant: 14),
            textView.trailingAnchor.constraint(equalTo: field.trailingAnchor, constant: -14),
            textHeight,
            placeholder.leadingAnchor.constraint(equalTo: textView.leadingAnchor),
            placeholder.trailingAnchor.constraint(lessThanOrEqualTo: textView.trailingAnchor),
            // On the text line, not the field's centre: with a photo attached the field grows
            // and a centred placeholder sat on the thumbnail.
            placeholder.centerYAnchor.constraint(equalTo: textView.centerYAnchor),
            aura.topAnchor.constraint(equalTo: field.topAnchor),
            aura.bottomAnchor.constraint(equalTo: field.bottomAnchor),
            aura.leadingAnchor.constraint(equalTo: field.leadingAnchor),
            aura.trailingAnchor.constraint(equalTo: field.trailingAnchor)
        ])
        refresh(animated: false)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    private func configureCircle(_ button: UIButton, symbol: String, label: String, id: String) {
        button.backgroundColor = FCUITheme.green800 // light palette forced, also in dark
        button.layer.cornerRadius = 24
        button.tintColor = FCUITheme.green500
        button.setImage(UIImage(systemName: symbol, withConfiguration: UIImage.SymbolConfiguration(pointSize: 20, weight: .semibold)), for: .normal)
        button.accessibilityLabel = label
        button.accessibilityIdentifier = id
        button.translatesAutoresizingMaskIntoConstraints = false
        let w = button.widthAnchor.constraint(equalToConstant: 48)
        let h = button.heightAnchor.constraint(equalToConstant: 48)
        NSLayoutConstraint.activate([w, h])
        buttonSizes += [w, h]
    }

    private var trimmedText: String {
        textView.text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func actionTapped() {
        let text = trimmedText
        if text.isEmpty && attachment == nil {
            onMic?()
        } else {
            onSend?(text)
            clear()
            textView.resignFirstResponder()
        }
    }

    func clear() {
        textView.text = ""
        refresh(animated: true)
    }

    func focus() {
        textView.becomeFirstResponder()
    }

    /// Re-applies every state-dependent detail (InputComposer.kt sizes at rest vs focused).
    private func refresh(animated: Bool) {
        let focused = textView.isFirstResponder
        let hasText = !textView.text.isEmpty
        // InputComposer.kt:284 `hasContent = text.isNotBlank() || photoUris.isNotEmpty()`.
        let hasContent = hasText || attachment != nil
        placeholder.isHidden = hasText
        placeholder.baseColor = focused ? FCUITheme.formPlaceholder : .black
        placeholder.isAnimating = !focused
        aura.isHidden = focused || hasContent
        // Camera hides once there is content; mic → send glyph swap, same circle.
        if showCamera { cameraButton.isHidden = hasContent }
        let sending = hasContent || !showMic
        actionButton.isHidden = !sending && !showMic
        actionButton.setImage(sending ? Self.sendGlyph : Self.micGlyph, for: .normal)
        actionButton.accessibilityLabel = sending ? fcuiLabel(FCLabels.send, "Send") : fcuiLabel(FCLabels.speak, "Speak")
        actionButton.accessibilityIdentifier = sending ? "fcComposerSend" : "fcComposerMic"
        // Focused: 42pt buttons, 10/8 sheet padding (12/12 at rest).
        buttonSizes.forEach { $0.constant = focused ? 42 : 48 }
        cameraButton.layer.cornerRadius = focused ? 21 : 24
        actionButton.layer.cornerRadius = focused ? 21 : 24
        rowTop.constant = focused ? 10 : 12
        sheetBottomPad.constant = focused ? 8 : 12
        updateTextHeight()
        if animated {
            UIView.animate(withDuration: 0.22) { self.superview?.layoutIfNeeded() }
        }
    }

    private func updateTextHeight() {
        let width = textView.bounds.width > 0 ? textView.bounds.width : 200
        let fitted = textView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude)).height
        let maxHeight = bodyStyle.lineHeight * Self.maxLines
        textHeight.constant = min(max(fitted, bodyStyle.lineHeight), maxHeight)
        textView.isScrollEnabled = fitted > maxHeight
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let before = textHeight.constant
        updateTextHeight()
        if textHeight.constant != before { setNeedsLayout() }
    }

    func textViewDidChange(_ textView: UITextView) { refresh(animated: false); onTextChange?() }
    var isEditing: Bool { textView.isFirstResponder }
    var hasText: Bool { !textView.text.isEmpty }

    func textViewDidBeginEditing(_ textView: UITextView) { refresh(animated: true); onFocusChange?(true) }
    func textViewDidEndEditing(_ textView: UITextView) { refresh(animated: true); onFocusChange?(false) }
}

// MARK: - Markdown (components/MarkdownText.kt)

/// Port of the app's `MarkdownText` (and SwiftUI's `fcParseMarkdownBlocks`) to one attributed
/// string: paragraphs bodyMedium 17/25; `#` / `##` / `###+` titleLarge / titleMedium / titleSmall
/// bold; bullets a 5pt filled dot with a 10pt gap and hanging indent; numbered "N." with a 4pt gap;
/// the block-pair spacing table (paragraph→paragraph 20, before a header 24, after a header 20,
/// list item→item 5, divider 24, other 12). Inline `**bold**` / `*italic*` via
/// `AttributedString(markdown:)` on the already-stripped block text.
enum FCUIMarkdown {
    enum Block {
        case header(String, Int)
        case paragraph(String)
        case bullet(String)
        case numbered(String, String)
        case divider
        /// GFM table: header cells, per-column alignment from the separator row, body rows.
        case table(headers: [String], alignments: [NSTextAlignment], rows: [[String]])
    }

    /// A run of consecutive non-table blocks (one attributed string), or one table.
    enum Segment {
        case text(NSAttributedString)
        case table(headers: [String], alignments: [NSTextAlignment], rows: [[String]])
    }

    static func parse(_ text: String) -> [Block] {
        var blocks: [Block] = []
        let lines = text.components(separatedBy: .newlines)
        var i = 0
        func isTableRow(_ s: String) -> Bool {
            s.contains("|") && !s.trimmingCharacters(in: CharacterSet(charactersIn: "| ")).isEmpty
        }
        func cells(_ s: String) -> [String] {
            var core = s.trimmingCharacters(in: .whitespaces)
            if core.hasPrefix("|") { core.removeFirst() }
            if core.hasSuffix("|") { core.removeLast() }
            return core.components(separatedBy: "|").map { $0.trimmingCharacters(in: .whitespaces) }
        }
        func isSeparator(_ s: String) -> Bool {
            guard s.contains("|"), s.contains("-") else { return false }
            return cells(s).allSatisfy { $0.range(of: "^:?-{3,}:?$", options: .regularExpression) != nil }
        }
        while i < lines.count {
            let trimmed = lines[i].trimmingCharacters(in: .whitespaces)
            if isTableRow(trimmed), i + 1 < lines.count, isSeparator(lines[i + 1].trimmingCharacters(in: .whitespaces)) {
                let headers = cells(trimmed)
                // MarkdownText.kt parseAlignments: ":--:" centre, "--:" end, else start.
                let separator = cells(lines[i + 1].trimmingCharacters(in: .whitespaces))
                let alignments: [NSTextAlignment] = headers.indices.map { idx in
                    let cell = idx < separator.count ? separator[idx] : ""
                    switch (cell.hasPrefix(":"), cell.hasSuffix(":")) {
                    case (true, true): return .center
                    case (false, true): return .right
                    default: return .natural
                    }
                }
                var rows: [[String]] = []
                var j = i + 2
                while j < lines.count, isTableRow(lines[j].trimmingCharacters(in: .whitespaces)) {
                    rows.append(cells(lines[j]))
                    j += 1
                }
                blocks.append(.table(headers: headers, alignments: alignments, rows: rows))
                i = j
                continue
            }
            defer { i += 1 }
            if trimmed.isEmpty { continue }
            if trimmed == "---" || trimmed == "***" || trimmed == "___" {
                blocks.append(.divider)
            } else if trimmed.hasPrefix("#"), trimmed.drop(while: { $0 == "#" }).hasPrefix(" ") {
                let level = min(max(trimmed.prefix(while: { $0 == "#" }).count, 1), 3)
                blocks.append(.header(trimmed.drop(while: { $0 == "#" }).trimmingCharacters(in: .whitespaces), level))
            } else if trimmed.hasPrefix("- ") || trimmed.hasPrefix("* ") || trimmed.hasPrefix("• ") {
                blocks.append(.bullet(String(trimmed.dropFirst(2))))
            } else if let match = trimmed.range(of: "^\\d+\\.\\s", options: .regularExpression) {
                blocks.append(.numbered(String(trimmed.prefix(while: { $0.isNumber })),
                                        trimmed[match.upperBound...].trimmingCharacters(in: .whitespaces)))
            } else {
                blocks.append(.paragraph(trimmed))
            }
        }
        return blocks
    }

    private static func spacing(_ block: Block, after previous: Block?) -> CGFloat {
        guard let previous else { return 0 }
        switch (previous, block) {
        case (.divider, _), (_, .divider): return 24
        case (_, .header): return 24
        case (.header, _): return 20
        case (.table, _), (_, .table): return 16
        case (.bullet, .bullet), (.numbered, .numbered): return 5
        case (.paragraph, .paragraph): return 20
        default: return 12
        }
    }

    /// ``inline(_:font:color:paragraph:)`` for table cells.
    static func inlineText(_ text: String, font: UIFont, color: UIColor, paragraph: NSParagraphStyle) -> NSAttributedString {
        inline(text, font: font, color: color, paragraph: paragraph)
    }

    /// Inline emphasis on `font`'s family: bold → `.bold`, italic → italic trait.
    private static func inline(_ text: String, font: UIFont, color: UIColor, paragraph: NSParagraphStyle) -> NSAttributedString {
        let out = NSMutableAttributedString()
        let parsed = (try? AttributedString(
            markdown: text,
            options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        )) ?? AttributedString(text)
        for run in parsed.runs {
            var runFont = font
            if let intent = run.inlinePresentationIntent {
                var traits = font.fontDescriptor.symbolicTraits
                if intent.contains(.stronglyEmphasized) { traits.insert(.traitBold) }
                if intent.contains(.emphasized) { traits.insert(.traitItalic) }
                if let descriptor = font.fontDescriptor.withSymbolicTraits(traits) {
                    runFont = UIFont(descriptor: descriptor, size: font.pointSize)
                }
            }
            out.append(NSAttributedString(string: String(parsed[run.range].characters), attributes: [
                .font: runFont, .foregroundColor: color, .paragraphStyle: paragraph
            ]))
        }
        return out
    }

    private static func dot(color: UIColor, size: CGFloat) -> UIImage {
        UIGraphicsImageRenderer(size: CGSize(width: size, height: size)).image { _ in
            color.setFill()
            UIBezierPath(ovalIn: CGRect(x: 0, y: 0, width: size, height: size)).fill()
        }
    }

    static func render(_ text: String, color: UIColor, body: FCUITextStyle) -> NSAttributedString {
        render(blocks: parse(text), color: color, body: body)
    }

    /// MarkdownText.kt renders a table as its own composable (cards / grid), not as text: the
    /// answer becomes text runs and tables, in order. A table is 16pt from its neighbours
    /// (the block-pair table), which the owning stack applies.
    static func segments(_ text: String, color: UIColor, body: FCUITextStyle) -> [Segment] {
        var out: [Segment] = []
        var run: [Block] = []
        func flush() {
            if !run.isEmpty { out.append(.text(render(blocks: run, color: color, body: body))) }
            run = []
        }
        for block in parse(text) {
            if case .table(let headers, let alignments, let rows) = block {
                flush()
                out.append(.table(headers: headers, alignments: alignments, rows: rows))
            } else {
                run.append(block)
            }
        }
        flush()
        return out
    }

    static func hasTable(_ text: String) -> Bool {
        parse(text).contains { if case .table = $0 { return true }; return false }
    }

    static func render(blocks: [Block], color: UIColor, body: FCUITextStyle) -> NSAttributedString {
        let typography = FCUITypography.current
        let out = NSMutableAttributedString()
        var previous: Block?
        for block in blocks {
            let style: FCUITextStyle
            var weight: UIFont.Weight? = nil
            switch block {
            case .header(_, let level):
                style = level == 1 ? typography.titleLarge : (level == 2 ? typography.titleMedium : typography.titleSmall)
                weight = .bold
            default:
                style = body
            }
            let paragraph = style.paragraphStyle().mutableCopy() as! NSMutableParagraphStyle
            paragraph.paragraphSpacingBefore = spacing(block, after: previous)
            let font = weight.map { fcuiFont(style, weight: $0) } ?? style.font
            if out.length > 0 { out.append(NSAttributedString(string: "\n", attributes: [.font: font, .paragraphStyle: paragraph])) }
            switch block {
            case .paragraph(let s), .header(let s, _):
                out.append(inline(s, font: font, color: color, paragraph: paragraph))
            case .bullet(let s):
                // 5pt dot in the text colour, then a 10pt gap; wrapped lines hang under the text.
                paragraph.headIndent = 15
                paragraph.tabStops = [NSTextTab(textAlignment: .natural, location: 15)]
                let attachment = NSTextAttachment()
                attachment.image = dot(color: color, size: 5)
                let capCenter = (font.capHeight - 5) / 2
                attachment.bounds = CGRect(x: 0, y: capCenter, width: 5, height: 5)
                let item = NSMutableAttributedString(attachment: attachment)
                item.append(NSAttributedString(string: "\t"))
                item.addAttributes([.paragraphStyle: paragraph, .font: font], range: NSRange(location: 0, length: item.length))
                out.append(item)
                out.append(inline(s, font: font, color: color, paragraph: paragraph))
            case .numbered(let number, let s):
                let marker = "\(number)."
                let markerWidth = (marker as NSString).size(withAttributes: [.font: font]).width
                paragraph.headIndent = ceil(markerWidth + 4)
                paragraph.tabStops = [NSTextTab(textAlignment: .natural, location: paragraph.headIndent)]
                out.append(NSAttributedString(string: marker + "\t", attributes: [.font: font, .foregroundColor: color, .paragraphStyle: paragraph]))
                out.append(inline(s, font: font, color: color, paragraph: paragraph))
            case .divider:
                // 3pt `#D4D4D8` pill.
                let attachment = NSTextAttachment()
                attachment.image = UIGraphicsImageRenderer(size: CGSize(width: 320, height: 3)).image { _ in
                    FCUITheme.neutral300.setFill()
                    UIBezierPath(roundedRect: CGRect(x: 0, y: 0, width: 320, height: 3), cornerRadius: 1.5).fill()
                }
                attachment.bounds = CGRect(x: 0, y: 0, width: 320, height: 3)
                let item = NSMutableAttributedString(attachment: attachment)
                item.addAttribute(.paragraphStyle, value: paragraph, range: NSRange(location: 0, length: item.length))
                out.append(item)
            case .table:
                // Never reached: `segments` lifts tables out into `FCUIMarkdownTableView`.
                break
            }
            previous = block
        }
        return out
    }
}

/// MarkdownText.kt `MarkdownTable` (:214-490), one of three treatments:
/// - **answer card** — 3 columns, header = `| Title | | |`: the title (labelLarge bold), a 1pt
///   divider, then per row a label (bodySmall, secondary) / value (bodyMedium bold) / meaning
///   (bodyMedium, secondary) reading, dividers between readings;
/// - **row cards** — any other 2+ column table: one card per row, its first cell the bold title
///   over a divider, then each further column as header label (bodySmall, secondary) above the
///   value (bodySmall bold);
/// - **weighted grid** — a lone single-column table: bordered (1pt, radius 8), labelSmall bold
///   header on surfaceTertiary, body rows alternating surfaceSecondary / surfaceReadingSecondary.
/// Cards: surfaceReadingSecondary, radius 16, padding 16h / 14v, 12 between cards.
final class FCUIMarkdownTableView: UIStackView {
    init(headers: [String], alignments: [NSTextAlignment], rows: [[String]], ink: UIColor) {
        super.init(frame: .zero)
        axis = .vertical
        let type = FCUITypography.current
        let isCard = headers.count == 3 && !headers[0].isEmpty && headers.dropFirst().allSatisfy(\.isEmpty)
        func cell(_ row: [String], _ i: Int) -> String { i < row.count ? row[i] : "" }
        func label(_ text: String, _ style: FCUITextStyle, bold: Bool, color: UIColor,
                   alignment: NSTextAlignment = .natural) -> UILabel {
            let l = UILabel()
            l.numberOfLines = 0
            l.textAlignment = alignment
            let font = bold ? fcuiFont(style, weight: .bold) : style.font
            l.attributedText = FCUIMarkdown.inlineText(text, font: font, color: color,
                                                       paragraph: style.paragraphStyle(alignment: alignment))
            return l
        }
        func divider() -> UIView {
            let v = UIView()
            v.backgroundColor = FCUITheme.borderDefault
            v.heightAnchor.constraint(equalToConstant: 1).isActive = true
            return v
        }
        func card(spacing: CGFloat, _ views: [UIView]) -> UIView {
            let inner = UIStackView(arrangedSubviews: views)
            inner.axis = .vertical
            inner.spacing = spacing
            inner.isLayoutMarginsRelativeArrangement = true
            inner.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 14, leading: 16, bottom: 14, trailing: 16)
            inner.backgroundColor = FCUITheme.surfaceReadingSecondary
            inner.layer.cornerRadius = 16
            inner.layer.cornerCurve = .continuous
            inner.clipsToBounds = true
            return inner
        }
        func pair(_ top: UIView, _ bottom: UIView?, gap: CGFloat = 2) -> UIView {
            let v = UIStackView(arrangedSubviews: [top] + (bottom.map { [$0] } ?? []))
            v.axis = .vertical
            v.spacing = gap
            return v
        }

        if isCard {
            var views: [UIView] = []
            if !headers[0].isEmpty {
                views.append(label(headers[0], type.labelLarge, bold: true, color: ink))
                views.append(divider())
            }
            for (index, row) in rows.enumerated() {
                var parts: [UIView] = []
                if !cell(row, 0).isEmpty { parts.append(label(cell(row, 0), type.bodySmall, bold: false, color: FCUITheme.foregroundSecondary)) }
                parts.append(label(cell(row, 1), type.bodyMedium, bold: true, color: ink))
                let reading = UIStackView(arrangedSubviews: parts)
                reading.axis = .vertical
                reading.spacing = 2
                if !cell(row, 2).isEmpty {
                    // `padding(top = 2)` on the meaning: 2 of spacing + 2.
                    reading.setCustomSpacing(4, after: parts.last!)
                    reading.addArrangedSubview(label(cell(row, 2), type.bodyMedium, bold: false, color: FCUITheme.foregroundSecondary))
                }
                views.append(reading)
                if index != rows.count - 1 { views.append(divider()) }
            }
            addArrangedSubview(card(spacing: 12, views))
        } else if headers.count >= 2 {
            spacing = 12
            for row in rows {
                var views: [UIView] = []
                let title = cell(row, 0)
                if !title.isEmpty {
                    views.append(label(title, type.labelLarge, bold: true, color: ink))
                    views.append(divider())
                }
                for column in 1..<headers.count {
                    views.append(pair(
                        label(headers[column], type.bodySmall, bold: false, color: FCUITheme.foregroundSecondary),
                        label(cell(row, column), type.bodySmall, bold: true, color: ink)
                    ))
                }
                addArrangedSubview(card(spacing: 10, views))
            }
        } else {
            layer.borderWidth = 1
            layer.borderColor = FCUITheme.borderDefault.cgColor
            layer.cornerRadius = 8
            layer.cornerCurve = .continuous
            clipsToBounds = true
            func gridRow(_ text: String, header: Bool, background: UIColor) -> UIView {
                let style = header ? type.labelSmall : type.bodySmall
                let l = label(text, style, bold: header, color: ink, alignment: alignments.first ?? .natural)
                let wrap = FCUIInsetView(l, top: 10, leading: 12, bottom: 10, trailing: 12)
                wrap.backgroundColor = background
                return wrap
            }
            addArrangedSubview(gridRow(cell(headers, 0), header: true, background: FCUITheme.surfaceTertiary))
            for (index, row) in rows.enumerated() {
                addArrangedSubview(gridRow(cell(row, 0), header: false,
                                           background: index % 2 == 0 ? FCUITheme.surfaceSecondary : FCUITheme.surfaceReadingSecondary))
            }
        }
        accessibilityIdentifier = "fcMarkdownTable"
    }

    required init(coder: NSCoder) { fatalError("init(coder:) is not supported") }
}

// MARK: - Answer-generation tips (components/Tips.kt + Tip.kt)

/// Tips.kt (`components/Tips.kt` + `Tip.kt`), shown for the whole answer-generation wait
/// (ChatThreadContent.kt:676-685): a 24pt fade, then a page-coloured band (44 bottom padding)
/// holding a pager — content padding 24, page gap 8, so the neighbouring cards peek in on BOTH
/// sides — that auto-advances every 8000ms with a 400ms slide, forever forward (the app's
/// 10 000-page virtual pager starts mid-range) and is not user-scrollable; 14, then the dots
/// (8pt `#2900C950`, gap 10; the active one a 24×8 track filling with `#00C950` over the 8s).
/// Card: min height 104, radius 16, `#08361B`, padding 20/16, top-aligned; a 36pt `#00C950`
/// disc with a white 18pt lightbulb, 12, title labelLarge, 6, body bodySmall, all white.
///
/// The tip set is the server's (`LabelManager.answerGenerationTips()`, port of
/// ChatLoadingContent.kt `answerGenerationTips()`), re-read and shuffled on every `start()`, as
/// `Tips.kt` shuffles per show. Not ported: the haptic tick and the lightbulb wobble.
final class FCUITipsView: UIView {
    private static let advance: TimeInterval = 8
    private static let slideDuration: TimeInterval = 0.4
    /// Cards in the strip: previous, current, next, and the one after (visible mid-slide).
    private static let stripCount = 4

    private let band = UIView()
    private let pagerClip = UIView()
    private let strip = UIStackView()
    private let dots = UIStackView()
    private var stripLeading: NSLayoutConstraint!
    private var cards: [FCUITipCardView] = []
    private var dotWidths: [NSLayoutConstraint] = []
    private var fills: [UIView] = []
    private var fillWidths: [NSLayoutConstraint] = []
    private var tips: [AnswerGenerationTip] = []
    /// Virtual page, only ever increasing; the shown tip is `page % tips.count`.
    private var page = 0
    private var timer: Timer?
    private var running = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        translatesAutoresizingMaskIntoConstraints = false
        // The app's pager has `userScrollEnabled = false`; the overlay never eats thread touches.
        isUserInteractionEnabled = false

        let fade = CAGradientLayer()
        fade.colors = [FCUITheme.surfaceReadingPrimary.withAlphaComponent(0).cgColor, FCUITheme.surfaceReadingPrimary.cgColor]
        let fadeView = FCUIGradientView(layer: fade)
        fadeView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(fadeView)
        band.backgroundColor = FCUITheme.surfaceReadingPrimary
        band.translatesAutoresizingMaskIntoConstraints = false
        addSubview(band)

        pagerClip.clipsToBounds = true
        pagerClip.translatesAutoresizingMaskIntoConstraints = false
        band.addSubview(pagerClip)

        strip.axis = .horizontal
        strip.spacing = 8
        strip.alignment = .bottom
        strip.translatesAutoresizingMaskIntoConstraints = false
        pagerClip.addSubview(strip)
        for _ in 0..<Self.stripCount {
            let card = FCUITipCardView()
            strip.addArrangedSubview(card)
            // Each page is the pager width minus the 24 + 24 content padding.
            card.widthAnchor.constraint(equalTo: pagerClip.widthAnchor, constant: -48).isActive = true
            cards.append(card)
        }

        dots.axis = .horizontal
        dots.spacing = 10
        dots.alignment = .center
        dots.translatesAutoresizingMaskIntoConstraints = false
        band.addSubview(dots)

        // At rest the CURRENT card (index 1) sits 24 in: strip leading = 24 - (cardWidth + 8).
        stripLeading = strip.leadingAnchor.constraint(equalTo: pagerClip.leadingAnchor)
        NSLayoutConstraint.activate([
            fadeView.topAnchor.constraint(equalTo: topAnchor),
            fadeView.leadingAnchor.constraint(equalTo: leadingAnchor),
            fadeView.trailingAnchor.constraint(equalTo: trailingAnchor),
            fadeView.heightAnchor.constraint(equalToConstant: 24),
            band.topAnchor.constraint(equalTo: fadeView.bottomAnchor),
            band.leadingAnchor.constraint(equalTo: leadingAnchor),
            band.trailingAnchor.constraint(equalTo: trailingAnchor),
            band.bottomAnchor.constraint(equalTo: bottomAnchor),
            pagerClip.topAnchor.constraint(equalTo: band.topAnchor),
            pagerClip.leadingAnchor.constraint(equalTo: band.leadingAnchor),
            pagerClip.trailingAnchor.constraint(equalTo: band.trailingAnchor),
            stripLeading,
            strip.topAnchor.constraint(equalTo: pagerClip.topAnchor),
            strip.bottomAnchor.constraint(equalTo: pagerClip.bottomAnchor),
            dots.topAnchor.constraint(equalTo: pagerClip.bottomAnchor, constant: 14),
            dots.centerXAnchor.constraint(equalTo: band.centerXAnchor),
            dots.bottomAnchor.constraint(equalTo: band.bottomAnchor, constant: -44)
        ])
        accessibilityIdentifier = "fcTips"
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func layoutSubviews() {
        super.layoutSubviews()
        if !isSliding { stripLeading.constant = restingLeading }
    }

    private var isSliding = false
    private var step: CGFloat { max(0, pagerClip.bounds.width - 48) + 8 }
    private var restingLeading: CGFloat { 24 - step }

    func start() {
        guard !running else { return }
        running = true
        tips = FarmerChat.shared.labels.answerGenerationTips().shuffled()
        page = 0
        rebuildDots()
        configureCards()
        startTimer()
    }

    func stop() {
        running = false
        timer?.invalidate()
        timer = nil
        isSliding = false
        layer.removeAllAnimations()
        strip.layer.removeAllAnimations()
        fills.forEach { $0.layer.removeAllAnimations() }
    }

    private func tip(at offset: Int) -> AnswerGenerationTip? {
        let n = tips.count
        guard n > 0 else { return nil }
        return tips[((page + offset) % n + n) % n]
    }

    private func configureCards() {
        for (i, card) in cards.enumerated() {
            if let tip = tip(at: i - 1) { card.configure(title: tip.title, body: tip.body) }
        }
        let current = tips.isEmpty ? 0 : page % tips.count
        for (index, width) in dotWidths.enumerated() {
            width.constant = index == current ? 24 : 8
            fillWidths[index].constant = 0
            fills[index].layer.removeAllAnimations()
        }
        stripLeading.constant = restingLeading
        layoutIfNeeded()
    }

    private func rebuildDots() {
        dots.arrangedSubviews.forEach { $0.removeFromSuperview() }
        dotWidths = []; fills = []; fillWidths = []
        for _ in tips.indices {
            let dot = UIView()
            dot.backgroundColor = FCUITheme.green500.withAlphaComponent(0.16)
            dot.layer.cornerRadius = 4
            dot.clipsToBounds = true
            dot.translatesAutoresizingMaskIntoConstraints = false
            let fill = UIView()
            fill.backgroundColor = FCUITheme.green500
            fill.translatesAutoresizingMaskIntoConstraints = false
            dot.addSubview(fill)
            let width = dot.widthAnchor.constraint(equalToConstant: 8)
            let fillWidth = fill.widthAnchor.constraint(equalToConstant: 0)
            NSLayoutConstraint.activate([
                width, dot.heightAnchor.constraint(equalToConstant: 8),
                fill.leadingAnchor.constraint(equalTo: dot.leadingAnchor),
                fill.topAnchor.constraint(equalTo: dot.topAnchor),
                fill.bottomAnchor.constraint(equalTo: dot.bottomAnchor),
                fillWidth
            ])
            dots.addArrangedSubview(dot)
            dotWidths.append(width)
            fills.append(fill)
            fillWidths.append(fillWidth)
        }
    }

    /// One Tips.kt loop turn: fill the active dot over 8s, then slide one page.
    private func startTimer() {
        guard running, !tips.isEmpty else { return }
        let current = page % tips.count
        fillWidths[current].constant = 24
        UIView.animate(withDuration: Self.advance, delay: 0, options: [.curveLinear]) {
            self.dots.layoutIfNeeded()
        }
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: Self.advance, repeats: false) { [weak self] _ in
            self?.slide()
        }
    }

    private func slide() {
        guard running else { return }
        isSliding = true
        stripLeading.constant = restingLeading - step
        UIView.animate(withDuration: Self.slideDuration, delay: 0, options: [.curveEaseInOut]) {
            self.pagerClip.layoutIfNeeded()
        } completion: { [weak self] _ in
            guard let self, self.running else { return }
            // Re-centre on the next page without animation, so the loop never runs out.
            self.page += 1
            self.isSliding = false
            self.configureCards()
            self.startTimer()
        }
    }
}

/// Tip.kt:64-107 — one card of ``FCUITipsView``.
final class FCUITipCardView: UIView {
    private let titleLabel = UILabel()
    private let bodyLabel = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = FCUITheme.green800
        layer.cornerRadius = 16
        layer.cornerCurve = .continuous
        translatesAutoresizingMaskIntoConstraints = false
        let circle = UIView()
        circle.backgroundColor = FCUITheme.green500
        circle.layer.cornerRadius = 18
        circle.translatesAutoresizingMaskIntoConstraints = false
        let bulb = UIImageView(image: UIImage(systemName: "lightbulb", withConfiguration: UIImage.SymbolConfiguration(pointSize: 16, weight: .medium)))
        bulb.tintColor = .white
        bulb.contentMode = .center
        bulb.translatesAutoresizingMaskIntoConstraints = false
        circle.addSubview(bulb)
        titleLabel.numberOfLines = 0
        titleLabel.textColor = .white
        bodyLabel.numberOfLines = 0
        bodyLabel.textColor = .white
        let text = UIStackView(arrangedSubviews: [titleLabel, bodyLabel])
        text.axis = .vertical
        text.spacing = 6
        text.translatesAutoresizingMaskIntoConstraints = false
        addSubview(circle)
        addSubview(text)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(greaterThanOrEqualToConstant: 104),
            circle.widthAnchor.constraint(equalToConstant: 36),
            circle.heightAnchor.constraint(equalToConstant: 36),
            circle.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 20),
            circle.topAnchor.constraint(equalTo: topAnchor, constant: 16),
            bulb.centerXAnchor.constraint(equalTo: circle.centerXAnchor),
            bulb.centerYAnchor.constraint(equalTo: circle.centerYAnchor),
            text.leadingAnchor.constraint(equalTo: circle.trailingAnchor, constant: 12),
            text.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -20),
            text.topAnchor.constraint(equalTo: topAnchor, constant: 16),
            text.bottomAnchor.constraint(lessThanOrEqualTo: bottomAnchor, constant: -16)
        ])
        isAccessibilityElement = true
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    func configure(title: String, body: String) {
        titleLabel.fcSetText(title, style: FCUITypography.current.labelLarge)
        bodyLabel.fcSetText(body, style: FCUITypography.current.bodySmall)
        accessibilityLabel = "\(title). \(body)"
    }
}

/// A view whose backing layer is the given gradient (resized with the view).
final class FCUIGradientView: UIView {
    private let gradient: CAGradientLayer
    init(layer gradient: CAGradientLayer) {
        self.gradient = gradient
        super.init(frame: .zero)
        isUserInteractionEnabled = false
        self.layer.addSublayer(gradient)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
    override func layoutSubviews() {
        super.layoutSubviews()
        gradient.frame = bounds
    }
}
#endif
