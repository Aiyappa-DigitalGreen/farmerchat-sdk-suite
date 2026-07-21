#if canImport(UIKit)
import UIKit
import SwiftUI
import FarmerChatCore

/// Design tokens ported from the app theme (ColorPrimitives / semantic
/// palettes), as dynamic UIColors honoring Day/Night/Auto. Host overrides
/// (docs/07 Part B, `FarmerChatConfig.theme`) are overlaid by the ONE resolver
/// below (`hostColor`) so every UIKit screen recolors with no per-screen edits.
public enum FCUITheme {
    // Primitives
    public static let green500 = UIColor(rgb: 0x00C950)
    public static let green700 = UIColor(rgb: 0x008236)
    public static let green800 = UIColor(rgb: 0x08361B)
    public static let green950 = UIColor(rgb: 0x032E15)
    public static let sun300 = UIColor(rgb: 0xF9FF47)
    public static let red500 = UIColor(rgb: 0xE5533D)

    // MARK: - Host theme resolver (docs/07 Part B)

    private static var hostTheme: FarmerChatTheme? {
        FarmerChat.isInitialized ? FarmerChat.shared.config.theme : nil
    }

    /// Resolves a host override to a dynamic UIColor (light/dark), or nil if the
    /// host didn't theme this slot (so the built-in green default stays).
    private static func hostColor(_ light: KeyPath<FarmerChatTheme, Color?>,
                                  _ dark: KeyPath<FarmerChatTheme, Color?>) -> UIColor? {
        guard let t = hostTheme else { return nil }
        let l = t[keyPath: light]
        let d = t[keyPath: dark] ?? l
        guard let l else { return nil }
        return UIColor { traits in
            UIColor(traits.userInterfaceStyle == .dark ? (d ?? l) : l)
        }
    }

    /// Host `brandPrimaryDark`, else a derived darker tint of the themed
    /// `brandPrimary`, else nil (keep green default).
    private static func resolvedButtonSurface() -> UIColor? {
        if let c = hostColor(\.brandPrimaryDark, \.darkBrandPrimaryDark) { return c }
        if let t = hostTheme, let p = t.brandPrimary {
            let derived = UIColor(p).fcDarkened(0.35)
            return UIColor { traits in derived }
        }
        return nil
    }

    static let neutral150 = UIColor(rgb: 0xECECEE)
    static let neutral200 = UIColor(rgb: 0xE4E4E7)
    static let neutral300 = UIColor(rgb: 0xD4D4D8)
    static let neutral400 = UIColor(rgb: 0x9F9FA9)
    static let neutral500 = UIColor(rgb: 0x71717B)
    static let neutral600 = UIColor(rgb: 0x52525C)
    static let neutral700 = UIColor(rgb: 0x3F3F46)
    static let neutral800 = UIColor(rgb: 0x27272A)
    static let neutral900 = UIColor(rgb: 0x18181B)

    // Brand (host brandPrimary / brandPrimaryDark override, else green default)
    public static var brandSurfacePrimary: UIColor { hostColor(\.brandPrimary, \.darkBrandPrimary) ?? green700 }
    public static var brandSurfaceSecondary: UIColor { resolvedButtonSurface() ?? green800 }

    // Content (dynamic)
    public static var surfacePrimary: UIColor { hostColor(\.background, \.darkBackground) ?? dynamic(light: neutral150, dark: neutral900) }
    public static var surfaceSecondary: UIColor { hostColor(\.cardSurface, \.darkCardSurface) ?? dynamic(light: .white, dark: neutral800) }
    public static var surfaceTertiary: UIColor { dynamic(light: neutral200, dark: neutral700) }
    public static var surfaceActive: UIColor { brandAccent.withAlphaComponent(0.16) }
    public static var surfaceReadingPrimary: UIColor { hostColor(\.readingSurface, \.darkReadingSurface) ?? dynamic(light: .white, dark: neutral900) }
    public static var surfaceReadingSecondary: UIColor { dynamic(light: neutral150, dark: neutral800) }
    public static var foregroundPrimary: UIColor { hostColor(\.onBackground, \.darkOnBackground) ?? dynamic(light: .black, dark: .white) }
    public static var foregroundSecondary: UIColor { dynamic(light: neutral600, dark: neutral400) }
    public static var foregroundTertiary: UIColor { dynamic(light: neutral300, dark: neutral700) }
    public static var buttonPrimarySurface: UIColor { resolvedButtonSurface() ?? dynamic(light: green800, dark: green700) }
    /// Accent (chevrons/active dot/spinner): host brandAccent else green500.
    public static var brandAccent: UIColor { hostColor(\.brandAccent, \.darkBrandAccent) ?? green500 }
    public static var borderDefault: UIColor { dynamic(light: neutral300, dark: neutral700) }
    public static var formPlaceholder: UIColor { dynamic(light: neutral500, dark: neutral400) }

    private static func dynamic(light: UIColor, dark: UIColor) -> UIColor {
        UIColor { traits in
            traits.userInterfaceStyle == .dark ? dark : light
        }
    }

    /// Maps the SDK appearance to a UIKit interface style override.
    public static func interfaceStyle(for appearance: FarmerChatAppearance) -> UIUserInterfaceStyle {
        switch appearance {
        case .day: return .light
        case .night: return .dark
        case .auto: return .unspecified
        }
    }
}

extension UIColor {
    convenience init(rgb: UInt32) {
        self.init(
            red: CGFloat((rgb >> 16) & 0xFF) / 255.0,
            green: CGFloat((rgb >> 8) & 0xFF) / 255.0,
            blue: CGFloat(rgb & 0xFF) / 255.0,
            alpha: 1
        )
    }

    /// Darkens toward black by `amount` (0…1) — used by the host-theme resolver.
    func fcDarkened(_ amount: CGFloat) -> UIColor {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        getRed(&r, green: &g, blue: &b, alpha: &a)
        let f = max(0, 1 - amount)
        return UIColor(red: r * f, green: g * f, blue: b * f, alpha: a)
    }
}

/// Label shorthand for UIKit screens.
@MainActor
func fcuiLabel(_ key: String, _ fallback: String, params: [String: String] = [:]) -> String {
    guard FarmerChat.isInitialized else { return fallback }
    return FarmerChat.shared.labels.label(key, fallback: fallback, params: params)
}

// MARK: - Shared UIKit widgets

/// Primary button with loading state (PrimaryButton port).
public final class FCUIPrimaryButton: UIButton {
    private let spinner = UIActivityIndicatorView(style: .medium)

    public var isLoading = false {
        didSet {
            isEnabled = !isLoading
            if isLoading {
                spinner.startAnimating()
                titleLabel?.alpha = 0.35
            } else {
                spinner.stopAnimating()
                titleLabel?.alpha = 1
            }
        }
    }

    public init(title: String) {
        super.init(frame: .zero)
        setTitle(title, for: .normal)
        titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        setTitleColor(.white, for: .normal)
        backgroundColor = FCUITheme.buttonPrimarySurface
        layer.cornerRadius = 16
        layer.cornerCurve = .continuous
        translatesAutoresizingMaskIntoConstraints = false
        heightAnchor.constraint(equalToConstant: 54).isActive = true

        spinner.color = .white
        spinner.translatesAutoresizingMaskIntoConstraints = false
        addSubview(spinner)
        NSLayoutConstraint.activate([
            spinner.centerXAnchor.constraint(equalTo: centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: centerYAnchor)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    public override var isEnabled: Bool {
        didSet { alpha = isEnabled || isLoading ? 1 : 0.4 }
    }
}

/// Full-screen green message layout (FullScreenMessage port).
public final class FCUIFullScreenMessageView: UIView {
    public let titleLabel = UILabel()
    public let subtitleLabel = UILabel()
    public let iconView = UIImageView()
    public let primaryButton = UIButton(type: .system)
    public let secondaryButton = UIButton(type: .system)

    public init(
        title: String,
        subtitle: String,
        symbolName: String,
        primaryTitle: String,
        secondaryTitle: String?
    ) {
        super.init(frame: .zero)
        backgroundColor = FCUITheme.green800

        iconView.image = UIImage(systemName: symbolName)
        iconView.tintColor = FCUITheme.green500
        iconView.contentMode = .scaleAspectFit
        iconView.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 84, weight: .light)

        titleLabel.text = title
        titleLabel.font = .systemFont(ofSize: 30, weight: .bold)
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center
        titleLabel.numberOfLines = 0

        subtitleLabel.text = subtitle
        subtitleLabel.font = .systemFont(ofSize: 17)
        subtitleLabel.textColor = UIColor.white.withAlphaComponent(0.85)
        subtitleLabel.textAlignment = .center
        subtitleLabel.numberOfLines = 0

        primaryButton.setTitle(primaryTitle, for: .normal)
        primaryButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        primaryButton.setTitleColor(FCUITheme.green800, for: .normal)
        primaryButton.backgroundColor = .white
        primaryButton.layer.cornerRadius = 16
        primaryButton.layer.cornerCurve = .continuous
        primaryButton.heightAnchor.constraint(equalToConstant: 54).isActive = true

        secondaryButton.setTitle(secondaryTitle, for: .normal)
        secondaryButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .medium)
        secondaryButton.setTitleColor(.white, for: .normal)
        secondaryButton.isHidden = secondaryTitle == nil

        let stack = UIStackView(arrangedSubviews: [iconView, titleLabel, subtitleLabel])
        stack.axis = .vertical
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false

        let buttons = UIStackView(arrangedSubviews: [primaryButton, secondaryButton])
        buttons.axis = .vertical
        buttons.spacing = 10
        buttons.translatesAutoresizingMaskIntoConstraints = false

        addSubview(stack)
        addSubview(buttons)
        NSLayoutConstraint.activate([
            stack.centerYAnchor.constraint(equalTo: centerYAnchor, constant: -40),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -32),
            buttons.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 24),
            buttons.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -24),
            buttons.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.bottomAnchor, constant: -20)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
}
#endif
