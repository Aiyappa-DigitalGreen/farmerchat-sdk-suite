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
        titleLabel?.font = FCUITypography.current.titleMedium.font
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

/// Port of the app's `FullScreenMessage` (ui/error/NoInternetScreen.kt): the green full-screen
/// layout behind Sign up, You're all set, No internet / Something went wrong and the location
/// interstitial.
///
/// `brand.surfacePrimary` ground; a DefaultAppBar with its 80pt yellow glow (centred white
/// title, optional 42pt left tile and right label tile); the country farmer illustration (Fit,
/// max 322pt) in the flexible space; the displaySmall main message and the subtitle, white,
/// 10pt apart, 28pt sides, 28pt above the CTA; a forced-light 64pt PrimaryButton (Green800,
/// white titleMedium, Green500 chevron), 20pt sides.
///
/// The SDK drew a Green800 ground, an SF symbol, a white CTA with green text and a bottom Skip
/// link instead of the app's bar actions.
public final class FCUIFullScreenMessageView: UIView {
    public let titleLabel = UILabel()
    public let subtitleLabel = UILabel()
    public let iconView = UIImageView()
    public let primaryButton = UIButton(type: .system)
    public let secondaryButton = UIButton(type: .system)
    private let primarySpinner = UIActivityIndicatorView(style: .medium)
    private let primaryChevron: Bool

    /// Kept for source compatibility: no app bar actions, the given SF symbol as the fallback.
    public convenience init(
        title: String,
        subtitle: String,
        symbolName: String,
        primaryTitle: String,
        secondaryTitle: String?
    ) {
        self.init(
            barTitle: nil, mainMessage: title, subtitle: subtitle, subtitleLarge: false,
            illustration: .lookingAtSky, fallbackSymbol: symbolName,
            primaryTitle: primaryTitle, primaryChevron: false,
            leading: nil, onLeading: nil, rightLabel: nil, onRight: nil,
            roundedBarActions: false, secondaryTitle: secondaryTitle
        )
    }

    init(
        barTitle: String?,
        mainMessage: String,
        subtitle: String,
        subtitleLarge: Bool,
        illustration: FCFarmerIllustration,
        fallbackSymbol: String,
        primaryTitle: String,
        primaryChevron: Bool,
        leading: FCUIAppBarLeading?,
        onLeading: (() -> Void)?,
        rightLabel: String?,
        onRight: (() -> Void)?,
        roundedBarActions: Bool,
        secondaryTitle: String? = nil
    ) {
        self.primaryChevron = primaryChevron
        super.init(frame: .zero)
        backgroundColor = FCUITheme.brandSurfacePrimary

        // App bar.
        var left: UIView?
        if let leading, let onLeading {
            let tile = FCUIHeaderTile(systemImage: leading.symbol, accessibilityLabel: leading.accessibilityLabel,
                                      identifier: "fcAppBarLeading", radius: roundedBarActions ? 21 : 12)
            tile.addAction(UIAction { _ in onLeading() }, for: .touchUpInside)
            left = tile
        }
        var right: UIView?
        if let rightLabel, let onRight {
            var config = UIButton.Configuration.filled()
            config.baseBackgroundColor = FCUITheme.brandSurfaceSecondary
            config.baseForegroundColor = .white
            config.background.cornerRadius = roundedBarActions ? 21 : 12
            config.cornerStyle = .fixed
            config.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16)
            config.attributedTitle = AttributedString(rightLabel, attributes: AttributeContainer([.font: FCUITypography.current.labelLarge.font]))
            let button = UIButton(configuration: config)
            button.accessibilityIdentifier = "fcAppBarTrailing"
            button.translatesAutoresizingMaskIntoConstraints = false
            button.heightAnchor.constraint(equalToConstant: 42).isActive = true
            button.addAction(UIAction { _ in onRight() }, for: .touchUpInside)
            right = button
        }
        let bar = FCUIAppBar(title: barTitle, left: left, right: right, glow: true)
        addSubview(bar)

        // Illustration: the app's country farmer, else the fallback symbol.
        if let url = illustration.url(prefs: FarmerChat.shared.prefs), let image = UIImage(contentsOfFile: url.path) {
            iconView.image = image
            iconView.contentMode = .scaleAspectFit
        } else {
            iconView.image = UIImage(systemName: fallbackSymbol)
            iconView.tintColor = FCUITheme.green500
            iconView.contentMode = .scaleAspectFit
            iconView.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 84, weight: .light)
        }
        iconView.isAccessibilityElement = false
        iconView.setContentCompressionResistancePriority(.defaultLow, for: .vertical)
        iconView.setContentHuggingPriority(.defaultLow, for: .vertical)
        iconView.translatesAutoresizingMaskIntoConstraints = false

        // Colour and alignment first: `fcSetText` goes through `attributedText`.
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center
        titleLabel.numberOfLines = 0
        titleLabel.fcSetText(mainMessage, style: FCUITypography.current.displaySmall)
        subtitleLabel.textColor = .white
        subtitleLabel.textAlignment = .center
        subtitleLabel.numberOfLines = 0
        subtitleLabel.fcSetText(subtitle, style: subtitleLarge ? FCUITypography.current.bodyLarge : FCUITypography.current.bodyMedium)
        for label in [titleLabel, subtitleLabel] {
            label.setContentCompressionResistancePriority(.required, for: .vertical)
        }

        var config = UIButton.Configuration.filled()
        config.baseBackgroundColor = FCUITheme.green800
        config.baseForegroundColor = .white
        config.cornerStyle = .fixed
        config.background.cornerRadius = 16
        config.attributedTitle = AttributedString(primaryTitle, attributes: AttributeContainer([.font: FCUITypography.current.titleMedium.font]))
        if primaryChevron {
            config.image = UIImage(systemName: "chevron.right", withConfiguration: UIImage.SymbolConfiguration(pointSize: 17, weight: .medium))?
                .withTintColor(FCUITheme.green500, renderingMode: .alwaysOriginal)
            config.imagePlacement = .trailing
            config.imagePadding = 8
        }
        primaryButton.configuration = config
        primaryButton.accessibilityIdentifier = "fcFullScreenPrimary"
        primaryButton.translatesAutoresizingMaskIntoConstraints = false
        primarySpinner.color = FCUITheme.green500
        primarySpinner.hidesWhenStopped = true
        primarySpinner.translatesAutoresizingMaskIntoConstraints = false
        primaryButton.addSubview(primarySpinner)

        secondaryButton.setTitle(secondaryTitle, for: .normal)
        secondaryButton.titleLabel?.font = FCUITypography.current.bodyMedium.font
        secondaryButton.setTitleColor(.white, for: .normal)
        secondaryButton.isHidden = secondaryTitle == nil

        let text = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel])
        text.axis = .vertical
        text.spacing = 10
        text.translatesAutoresizingMaskIntoConstraints = false

        let buttons = UIStackView(arrangedSubviews: [primaryButton, secondaryButton])
        buttons.axis = .vertical
        buttons.spacing = 0
        buttons.translatesAutoresizingMaskIntoConstraints = false

        addSubview(iconView)
        addSubview(text)
        addSubview(buttons)
        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo: topAnchor),
            bar.leadingAnchor.constraint(equalTo: leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: trailingAnchor),
            iconView.topAnchor.constraint(equalTo: bar.bottomAnchor, constant: 16),
            iconView.centerXAnchor.constraint(equalTo: centerXAnchor),
            iconView.widthAnchor.constraint(lessThanOrEqualToConstant: 322),
            iconView.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 28),
            iconView.bottomAnchor.constraint(equalTo: text.topAnchor, constant: -16),
            text.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 28),
            text.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -28),
            text.bottomAnchor.constraint(equalTo: buttons.topAnchor, constant: -28),
            primaryButton.heightAnchor.constraint(equalToConstant: 64),
            primarySpinner.centerYAnchor.constraint(equalTo: primaryButton.centerYAnchor),
            primarySpinner.leadingAnchor.constraint(equalTo: primaryButton.leadingAnchor, constant: 20),
            buttons.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 20),
            buttons.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -20),
            buttons.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.bottomAnchor, constant: -8)
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    /// PrimaryButtonState.Loading.
    func setPrimaryLoading(_ loading: Bool) {
        primaryButton.isEnabled = !loading
        if loading { primarySpinner.startAnimating() } else { primarySpinner.stopAnimating() }
    }
}
#endif
