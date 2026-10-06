import SwiftUI
import FarmerChatCore

// MARK: - Color primitives (ported from app theme/ColorPrimitives.kt)

enum FCPrimitive {
    static let white = Color(hex: 0xFFFFFF)
    static let black = Color(hex: 0x000000)

    // Neutral (Zinc)
    static let neutral50 = Color(hex: 0xFAFAFA)
    static let neutral100 = Color(hex: 0xF4F4F5)
    static let neutral150 = Color(hex: 0xECECEE)
    static let neutral200 = Color(hex: 0xE4E4E7)
    static let neutral300 = Color(hex: 0xD4D4D8)
    static let neutral400 = Color(hex: 0x9F9FA9)
    static let neutral500 = Color(hex: 0x71717B)
    static let neutral600 = Color(hex: 0x52525C)
    static let neutral700 = Color(hex: 0x3F3F46)
    static let neutral800 = Color(hex: 0x27272A)
    static let neutral900 = Color(hex: 0x18181B)
    static let neutral950 = Color(hex: 0x09090B)

    // Brand — Green
    static let green500 = Color(hex: 0x00C950)
    static let green700 = Color(hex: 0x008236)
    static let green800 = Color(hex: 0x08361B)
    static let green950 = Color(hex: 0x032E15)
    static let green500Alpha16 = Color(hex: 0x00C950).opacity(0.16)

    // Accent gradient stops (Share chip conic/sweep border)
    static let cyan400 = Color(hex: 0x22D3EE)
    static let yellow300 = Color(hex: 0xFFF947)

    // Sky / Sun / Red
    static let sky400 = Color(hex: 0x00BCFF)
    static let sky700 = Color(hex: 0x0069A8)
    static let sun300 = Color(hex: 0xF9FF47)
    static let red500 = Color(hex: 0xE5533D)
}

// `Color(hex:)` now lives (public) in FarmerChatCore.

// MARK: - Semantic palettes (ported from ColorBrandSemantic.kt / ColorContentSemantic.kt)

public struct FCBrandColors {
    public var surfacePrimary = FCPrimitive.green700
    public var surfaceSecondary = FCPrimitive.green800
    public var surfaceTertiary = FCPrimitive.green950
    public var foregroundPrimary = FCPrimitive.white
    public var foregroundSecondary = FCPrimitive.green500
    public var feedbackSuccess = FCPrimitive.green500
    public var feedbackFail = FCPrimitive.red500

    // Accent gradient stops for the Share chip's conic/sweep border. The green stop follows the
    // host accent so the border stays coherent with a host brand; cyan and yellow are fixed
    // design primitives, exactly as in the app (ColorBrandSemantic.kt @ bda80659).
    public var accentGradientGreen = FCPrimitive.green500
    public var accentGradientCyan = FCPrimitive.cyan400
    public var accentGradientYellow = FCPrimitive.yellow300

    /// SwiftUI equivalent of the design's
    /// `conic-gradient(from 0deg at 50% 50%, green 0deg, cyan 90deg, green 180deg, yellow 270deg, green 360deg)`.
    ///
    /// `AngularGradient` IS the conic gradient, and unlike Compose's sweep its angle is measured
    /// from 12 o'clock — the same origin CSS uses — so these stops are NOT rotated the way the
    /// Kotlin ones are. The rendered orientation is identical: top green, right cyan, bottom
    /// green, left yellow.
    public var accentSweepBorder: AngularGradient {
        AngularGradient(
            gradient: Gradient(stops: [
                .init(color: accentGradientGreen, location: 0.00),
                .init(color: accentGradientCyan, location: 0.25),
                .init(color: accentGradientGreen, location: 0.50),
                .init(color: accentGradientYellow, location: 0.75),
                .init(color: accentGradientGreen, location: 1.00),
            ]),
            center: .center
        )
    }
}

public struct FCContentColors {
    public var surfacePrimary: Color
    public var surfaceSecondary: Color
    public var surfaceTertiary: Color
    public var surfaceActive: Color
    public var surfaceReadingPrimary: Color
    public var surfaceReadingSecondary: Color
    public var surfaceReadingTertiary: Color
    public var foregroundPrimary: Color
    public var foregroundSecondary: Color
    public var foregroundTertiary: Color
    public var buttonPrimarySurface: Color
    public var buttonPrimaryForeground: Color
    public var buttonPrimaryAccent: Color
    public var borderDefault: Color
    public var borderActive: Color
    public var formPlaceholder: Color
    public var scrim: Color
    public var shimmer: Color
    public var shine: Color

    static let light = FCContentColors(
        surfacePrimary: FCPrimitive.neutral150,
        surfaceSecondary: FCPrimitive.white,
        surfaceTertiary: FCPrimitive.neutral200,
        surfaceActive: FCPrimitive.green500Alpha16,
        surfaceReadingPrimary: FCPrimitive.white,
        surfaceReadingSecondary: FCPrimitive.neutral150,
        surfaceReadingTertiary: FCPrimitive.white,
        foregroundPrimary: FCPrimitive.black,
        foregroundSecondary: FCPrimitive.neutral600,
        foregroundTertiary: FCPrimitive.neutral300,
        buttonPrimarySurface: FCPrimitive.green800,
        buttonPrimaryForeground: FCPrimitive.white,
        buttonPrimaryAccent: FCPrimitive.green500,
        borderDefault: FCPrimitive.neutral300,
        borderActive: FCPrimitive.green500,
        formPlaceholder: FCPrimitive.neutral500,
        scrim: FCPrimitive.black.opacity(0.5),
        shimmer: FCPrimitive.neutral100,
        shine: FCPrimitive.black
    )

    static let dark = FCContentColors(
        surfacePrimary: FCPrimitive.neutral900,
        surfaceSecondary: FCPrimitive.neutral800,
        surfaceTertiary: FCPrimitive.neutral700,
        surfaceActive: FCPrimitive.green500Alpha16,
        surfaceReadingPrimary: FCPrimitive.neutral900,
        surfaceReadingSecondary: FCPrimitive.neutral800,
        surfaceReadingTertiary: FCPrimitive.neutral900,
        foregroundPrimary: FCPrimitive.white,
        foregroundSecondary: FCPrimitive.neutral400,
        foregroundTertiary: FCPrimitive.neutral700,
        buttonPrimarySurface: FCPrimitive.green700,
        buttonPrimaryForeground: FCPrimitive.white,
        buttonPrimaryAccent: FCPrimitive.green500,
        borderDefault: FCPrimitive.neutral700,
        borderActive: FCPrimitive.green500,
        formPlaceholder: FCPrimitive.neutral400,
        scrim: FCPrimitive.black.opacity(0.6),
        shimmer: FCPrimitive.neutral900,
        shine: FCPrimitive.white
    )
}

// MARK: - Theme container + environment

public struct FCShapes {
    public var card: CGFloat = 24
    /// Android `Radius.Rounded` (999.dp) — buttons are fully rounded pills as of the
    /// 2026-09-15 app pass. A host `buttonCornerRadius` overrides it.
    ///
    /// Read by `FCPrimaryButton` / `FCSecondaryButton`. Until 2026-09-16 NOTHING read this
    /// property — both buttons hardcoded `cornerRadius: 12` — so the host's
    /// `buttonCornerRadius` theming option was silently dead on iOS. Keep the buttons
    /// reading the token; inputs and cards deliberately do not.
    public var button: CGFloat = 999
    public var input: CGFloat = 12
}

public struct FCTheme {
    public var content: FCContentColors
    public var brand = FCBrandColors()
    public var shapes = FCShapes()
    public var isDark: Bool
    /// Host type-size multiplier (docs/07 typeScale). Default 1.0.
    public var typeScale: CGFloat = 1.0
    /// Host font name, if supplied. Default: platform font.
    public var fontName: String? = nil
    /// Script-correct, host-scaled type scale. Resolved in `theme(for:appearance:)` once
    /// `typeScale`/`fontName` are known — see FCTypography.swift for why leading cannot be
    /// baked into a static table here. Reached as `theme.typography.bodyLarge`.
    public var typography: FCTypography = .roman
    /// Host logo override, if supplied.
    public var logo: Image? = nil

    public static func theme(for colorScheme: ColorScheme, appearance: FarmerChatAppearance) -> FCTheme {
        let isDark: Bool
        switch appearance {
        case .day: isDark = false
        case .night: isDark = true
        case .auto: isDark = colorScheme == .dark
        }
        var theme = FCTheme(content: isDark ? .dark : .light, isDark: isDark)
        if FarmerChat.isInitialized, let host = FarmerChat.shared.config.theme {
            theme.applyHostOverrides(host, isDark: isDark)
        }
        // Typography resolves LAST: it depends on `typeScale`/`fontName`, which the host
        // overrides above may have just changed. The language comes from the same
        // preference the rest of the SDK reads, seeded at `initialize` from
        // `config.languageCode` or the device locale, so a script-specific scale is picked
        // even before the farmer has visited language selection.
        let languageCode = FarmerChat.isInitialized
            ? (FarmerChat.shared.prefs.string(.selectedLanguageCode) ?? "en")
            : "en"
        theme.typography = FCTypography.forLanguage(
            languageCode,
            typeScale: theme.typeScale,
            fontName: theme.fontName
        )
        return theme
    }

    /// The ONE resolver (docs/07 implementation rule): overlays a host
    /// `FarmerChatTheme` onto the SDK token layer so every screen recolors with
    /// no per-screen edits. Omitted values keep the built-in green defaults;
    /// dark-mode overrides fall back to their light counterpart.
    mutating func applyHostOverrides(_ host: FarmerChatTheme, isDark: Bool) {
        func pick(_ light: Color?, _ dark: Color?) -> Color? { isDark ? (dark ?? light) : light }

        let brandPrimary = pick(host.brandPrimary, host.darkBrandPrimary)
        let brandPrimaryDark = pick(host.brandPrimaryDark, host.darkBrandPrimaryDark)
        let brandAccent = pick(host.brandAccent, host.darkBrandAccent)
        let onBrand = pick(host.onBrand, host.darkOnBrand)
        let background = pick(host.background, host.darkBackground)
        let readingSurface = pick(host.readingSurface, host.darkReadingSurface)
        let cardSurface = pick(host.cardSurface, host.darkCardSurface)
        let error = pick(host.error, host.darkError)
        let onBackground = pick(host.onBackground, host.darkOnBackground)
        let onSurface = pick(host.onSurface, host.darkOnSurface)

        // Auto on-brand contrast when a brand color is themed but onBrand isn't.
        let resolvedOnBrand = onBrand ?? brandPrimary.map { $0.fcContrastingOnColor() }

        // Brand surface tokens (app bars, brand headers, buttons).
        if let brandPrimary { brand.surfacePrimary = brandPrimary }
        if let brandPrimaryDark {
            brand.surfaceSecondary = brandPrimaryDark
            brand.surfaceTertiary = brandPrimaryDark.fcDarkened(0.25)
            content.buttonPrimarySurface = brandPrimaryDark
        } else if let brandPrimary {
            // Derive a darker button/surface tint from the primary so buttons
            // don't stay green when only brandPrimary is themed.
            let derived = brandPrimary.fcDarkened(0.35)
            brand.surfaceSecondary = derived
            brand.surfaceTertiary = brandPrimary.fcDarkened(0.5)
            content.buttonPrimarySurface = derived
        }
        if let brandAccent {
            brand.foregroundSecondary = brandAccent
            brand.feedbackSuccess = brandAccent
            content.buttonPrimaryAccent = brandAccent
            content.borderActive = brandAccent
            content.surfaceActive = brandAccent.opacity(0.16)
        }
        if let resolvedOnBrand {
            brand.foregroundPrimary = resolvedOnBrand
            content.buttonPrimaryForeground = resolvedOnBrand
        }
        if let error { brand.feedbackFail = error }

        // Content surfaces/text.
        if let background { content.surfacePrimary = background }
        if let readingSurface {
            content.surfaceReadingPrimary = readingSurface
            content.surfaceReadingTertiary = readingSurface
        }
        if let cardSurface { content.surfaceSecondary = cardSurface }
        if let onBackground { content.foregroundPrimary = onBackground }
        _ = onSurface // onBackground/onSurface share foregroundPrimary in this token model

        // Shape.
        if let r = host.cardCornerRadius { shapes.card = r }
        if let r = host.buttonCornerRadius { shapes.button = r }
        if let r = host.inputCornerRadius { shapes.input = r }

        // Typography + branding.
        if let scale = host.typeScale { typeScale = scale }
        if let name = host.fontName { fontName = name }
        if let logo = host.logo { self.logo = logo }
    }

    /// Themed font honoring host `fontName` + `typeScale` (docs/07 typography).
    ///
    /// Prefer `fcTextStyle(theme.typography.<slot>)`, which also applies the script-correct
    /// leading. This remains for the genuinely off-scale sizes (glyph-as-text, the 96pt
    /// splash mark) that have no type-scale slot to name.
    public func font(size: CGFloat, weight: Font.Weight = .regular) -> Font {
        let scaled = size * typeScale
        if let fontName {
            return .custom(fontName, size: scaled).weight(weight)
        }
        return .system(size: scaled, weight: weight)
    }
}

// MARK: - Color derivation helpers (contrast + darken) for the resolver

extension Color {
    /// White or black, whichever contrasts better with this color.
    func fcContrastingOnColor() -> Color {
        #if canImport(UIKit)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(self).getRed(&r, green: &g, blue: &b, alpha: &a)
        let luminance = 0.299 * r + 0.587 * g + 0.114 * b
        return luminance > 0.6 ? FCPrimitive.black : FCPrimitive.white
        #else
        return FCPrimitive.white
        #endif
    }

    /// Darkens toward black by `amount` (0…1).
    func fcDarkened(_ amount: CGFloat) -> Color {
        #if canImport(UIKit)
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        UIColor(self).getRed(&r, green: &g, blue: &b, alpha: &a)
        let f = max(0, 1 - amount)
        return Color(red: Double(r * f), green: Double(g * f), blue: Double(b * f)).opacity(Double(a))
        #else
        return self
        #endif
    }
}

private struct FCThemeKey: EnvironmentKey {
    static let defaultValue = FCTheme(content: .light, isDark: false)
}

private struct FCLabelsKey: EnvironmentKey {
    static let defaultValue: LabelManager? = nil
}

extension EnvironmentValues {
    public var fcTheme: FCTheme {
        get { self[FCThemeKey.self] }
        set { self[FCThemeKey.self] = newValue }
    }
}

// MARK: - Label helper

/// Resolves a server-driven label with English fallback.
@MainActor
func fcLabel(_ key: String, _ fallback: String, params: [String: String] = [:]) -> String {
    guard FarmerChat.isInitialized else { return fallback }
    return FarmerChat.shared.labels.label(key, fallback: fallback, params: params)
}
