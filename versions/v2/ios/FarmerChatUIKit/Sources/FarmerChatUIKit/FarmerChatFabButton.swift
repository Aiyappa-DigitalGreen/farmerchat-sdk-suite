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
        configureAppearance(title: title ?? config.fabLabel, bg: bg, fg: fg, systemImage: systemImage ?? "leaf.circle.fill")
        addTarget(self, action: #selector(handleTap), for: .touchUpInside)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("FarmerChatFabButton is created in code")
    }

    private func configureAppearance(title: String?, bg: UIColor, fg: UIColor, systemImage: String) {
        backgroundColor = bg
        tintColor = fg
        let symbol = UIImage(systemName: systemImage,
                             withConfiguration: UIImage.SymbolConfiguration(pointSize: 26, weight: .regular))
        setImage(symbol, for: .normal)
        imageView?.contentMode = .scaleAspectFit
        layer.cornerRadius = 28
        layer.shadowColor = UIColor.black.cgColor
        layer.shadowOpacity = 0.25
        layer.shadowRadius = 8
        layer.shadowOffset = CGSize(width: 0, height: 4)

        heightAnchor.constraint(equalToConstant: 56).isActive = true
        if let title {
            setTitle(title, for: .normal)
            setTitleColor(fg, for: .normal)
            titleLabel?.font = FCUITypography.current.labelMedium.font
            contentEdgeInsets = UIEdgeInsets(top: 0, left: 20, bottom: 0, right: 22)
            imageEdgeInsets = UIEdgeInsets(top: 0, left: 0, bottom: 0, right: 10)
        } else {
            widthAnchor.constraint(equalToConstant: 56).isActive = true
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

    private func addCloseButton(to journey: UIViewController) {
        let close = UIButton(type: .system)
        close.setImage(UIImage(systemName: "xmark"), for: .normal)
        close.tintColor = .white
        close.backgroundColor = UIColor.black.withAlphaComponent(0.5)
        close.layer.cornerRadius = 20
        close.translatesAutoresizingMaskIntoConstraints = false
        close.addAction(UIAction { [weak journey] _ in journey?.dismiss(animated: true) }, for: .touchUpInside)
        journey.view.addSubview(close)
        NSLayoutConstraint.activate([
            close.widthAnchor.constraint(equalToConstant: 40),
            close.heightAnchor.constraint(equalToConstant: 40),
            close.topAnchor.constraint(equalTo: journey.view.safeAreaLayoutGuide.topAnchor, constant: 8),
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
