#if canImport(UIKit)
import UIKit
import SwiftUI
import FarmerChatCore

/// Drop-in floating launcher (docs/04 row 52). A `UIButton` subclass the host
/// adds to any view and positions with constraints (parity with the Android
/// Views `FarmerChatFab`). On tap it presents the full `FarmerChatViewController`
/// journey from its owning view controller, with a close affordance overlaid.
///
/// Unlike a bare `FarmerChat.openChat(...)` call, this *reveals* the SDK — it
/// works from a host screen that never presents `FarmerChatViewController`
/// itself. Needs only a prior `FarmerChat.initialize(config:)`.
///
/// ```swift
/// let fab = FarmerChatFabButton(title: "Ask FarmerChat")
/// view.addSubview(fab)
/// fab.translatesAutoresizingMaskIntoConstraints = false
/// NSLayoutConstraint.activate([
///     fab.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
///     fab.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20),
/// ])
/// ```
public final class FarmerChatFabButton: UIButton {
    private let question: String?

    /// - Parameters:
    ///   - question: when set, tapping deep-links straight into a chat asking it;
    ///     when nil the full journey opens.
    ///   - title: when set, renders as an extended pill with this text; defaults
    ///     to `config.fabLabel`.
    ///   - backgroundColor: override the launcher background (else `config.fabBackgroundColor`, else theme brand).
    ///   - contentColor: override the icon/title color (else `config.fabContentColor`, else white).
    ///   - systemImage: SF Symbol name to use instead of the default leaf glyph.
    public init(
        question: String? = nil,
        title: String? = nil,
        backgroundColor: UIColor? = nil,
        contentColor: UIColor? = nil,
        systemImage: String? = nil
    ) {
        precondition(FarmerChat.isInitialized, "Call FarmerChat.initialize(config:) before FarmerChatFabButton()")
        self.question = question
        super.init(frame: .zero)
        let config = FarmerChat.shared.config
        // Precedence: per-instance override → config default → theme brand / white.
        let bg = backgroundColor ?? config.fabBackgroundColor.map(UIColor.init) ?? FCUITheme.brandSurfacePrimary
        let fg = contentColor ?? config.fabContentColor.map(UIColor.init) ?? .white
        configureAppearance(title: title ?? config.fabLabel, bg: bg, fg: fg, systemImage: systemImage)
        addTarget(self, action: #selector(handleTap), for: .touchUpInside)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("FarmerChatFabButton is created in code")
    }

    private func configureAppearance(title: String?, bg: UIColor, fg: UIColor, systemImage: String?) {
        backgroundColor = bg
        tintColor = fg
        // The FarmerChat mark (logo_mark), as the compose FAB draws it, unless the host asked for
        // a specific SF Symbol.
        let image: UIImage? = systemImage.map {
            UIImage(systemName: $0, withConfiguration: UIImage.SymbolConfiguration(pointSize: 26, weight: .regular))
        } ?? Self.logoImage(size: 26)
        setImage(image?.withRenderingMode(.alwaysTemplate), for: .normal)
        imageView?.contentMode = .scaleAspectFit
        // Material3 ExtendedFloatingActionButton: 56pt high, radius 16.
        layer.cornerRadius = 16
        layer.cornerCurve = .continuous
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.25
        layer.shadowRadius = 8
        layer.shadowOffset = CGSize(width: 0, height: 4)

        heightAnchor.constraint(equalToConstant: 56).isActive = true
        if let title {
            setTitle(title, for: .normal)
            setTitleColor(fg, for: .normal)
            titleLabel?.font = FCUITypography.current.labelLarge.font
            // 12pt icon-to-label gap: shift the title right and widen the content to match.
            contentEdgeInsets = UIEdgeInsets(top: 0, left: 20, bottom: 0, right: 22 + 12)
            titleEdgeInsets = UIEdgeInsets(top: 0, left: 12, bottom: 0, right: -12)
        } else {
            widthAnchor.constraint(equalToConstant: 56).isActive = true
        }
    }

    private static func logoImage(size: CGFloat) -> UIImage {
        UIGraphicsImageRenderer(size: CGSize(width: size, height: size)).image { context in
            context.cgContext.addPath(FCUILogoMark.path(size: size))
            context.cgContext.setFillColor(UIColor.black.cgColor)
            context.cgContext.fillPath()
        }
    }

    @objc private func handleTap() {
        guard let presenter = owningViewController() else { return }
        // Set the deep-link target before presenting so the journey's router
        // consumes it as it comes up.
        if let question { FarmerChat.shared.openChat(question: question) }
        let journey = FarmerChatViewController() // modalPresentationStyle = .fullScreen
        presenter.present(journey, animated: true) { [weak self, weak journey] in
            guard let self, let journey else { return }
            self.addCloseButton(to: journey)
        }
    }

    /// Fallback close for screens without their own exit (language, onboarding, Home); iOS has no
    /// system Back to fall back on. Hidden while the CHAT_ONLY chat — which draws its own ✕ — is on
    /// top (parity with the SwiftUI FAB, b26efcb), so two ✕'s never overlap the header.
    private func addCloseButton(to journey: FarmerChatViewController) {
        let close = FCUIHeaderTile(systemImage: "xmark", accessibilityLabel: fcuiLabel(FCLabels.close, "Close"), identifier: "fcFabClose")
        let update: (UIViewController?) -> Void = { [weak close, weak journey] top in
            // Also hidden on any pushed screen: its navigation Back is the way out there.
            let pushed = (journey?.viewControllers.count ?? 0) > 1
            close?.isHidden = pushed || (top as? FCUIChatViewController)?.hasOwnExit == true
        }
        update(journey.topViewController)
        let previous = journey.onTopScreenChanged
        journey.onTopScreenChanged = { top in
            previous?(top)
            update(top)
        }
        close.addAction(UIAction { [weak journey] _ in journey?.dismiss(animated: true) }, for: .touchUpInside)
        journey.view.addSubview(close)
        journey.hasFallbackClose = true
        NSLayoutConstraint.activate([
            close.topAnchor.constraint(equalTo: journey.view.safeAreaLayoutGuide.topAnchor, constant: 11),
            close.trailingAnchor.constraint(equalTo: journey.view.trailingAnchor, constant: -16),
        ])
    }

    private func owningViewController() -> UIViewController? {
        var responder: UIResponder? = self
        while let current = responder {
            if let vc = current as? UIViewController { return vc }
            responder = current.next
        }
        return nil
    }
}
#endif
