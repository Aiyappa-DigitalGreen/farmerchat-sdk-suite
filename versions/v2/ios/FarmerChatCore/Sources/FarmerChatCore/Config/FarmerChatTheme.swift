import SwiftUI

/// Host theming contract (docs/07 Part B). Everything is optional; omitted
/// values fall back to the built-in FarmerChat green brand. A host supplies a
/// theme via `FarmerChatConfig.theme`; ONE resolver in each UI layer overlays
/// these overrides onto the token layer (`FCTheme` for SwiftUI, `FCUITheme`
/// for UIKit) so every screen recolors with no per-screen edits.
///
/// ```swift
/// FarmerChatConfig(
///   environment: .prod,
///   theme: FarmerChatTheme(
///     brandPrimary: Color(hex: 0x1565C0),   // host blue instead of green
///     cardCornerRadius: 16,
///     fontName: "HostSans",
///     logo: Image("host_logo")
///   )
/// )
/// ```
///
/// Colors: provide a light set, and optionally a `dark…` counterpart. If only
/// the light value is given it is used for both appearances; on-brand text
/// color is derived from brand luminance when `onBrand` is omitted.
public struct FarmerChatTheme: Sendable {
    // MARK: Colors — light (each optional)
    /// App bars, primary brand surfaces (default Green700 `#008236`).
    public var brandPrimary: Color?
    /// Primary buttons, input tiles (default Green800 `#08361B`).
    public var brandPrimaryDark: Color?
    /// Chevrons, active radio dot, spinner (default Green500 `#00C950`).
    public var brandAccent: Color?
    /// Content/text on brand surfaces (default white).
    public var onBrand: Color?
    /// Screen background (default light zinc).
    public var background: Color?
    /// Chat reading background (default near-white).
    public var readingSurface: Color?
    /// Card / list background (default white).
    public var cardSurface: Color?
    /// Error accents (default app error red).
    public var error: Color?
    /// Text on `background`.
    public var onBackground: Color?
    /// Text on `cardSurface`.
    public var onSurface: Color?

    // MARK: Colors — optional dark-mode overrides (fall back to the light value)
    public var darkBrandPrimary: Color?
    public var darkBrandPrimaryDark: Color?
    public var darkBrandAccent: Color?
    public var darkOnBrand: Color?
    public var darkBackground: Color?
    public var darkReadingSurface: Color?
    public var darkCardSurface: Color?
    public var darkError: Color?
    public var darkOnBackground: Color?
    public var darkOnSurface: Color?

    // MARK: Shape
    public var cardCornerRadius: CGFloat?
    public var buttonCornerRadius: CGFloat?
    public var inputCornerRadius: CGFloat?

    // MARK: Typography
    /// Host font name (as registered with the system). Default: platform font.
    public var fontName: String?
    /// Multiplier applied to all text sizes (default 1.0).
    public var typeScale: CGFloat?

    // MARK: Branding
    /// Optional override of the built-in 6-petal mark.
    public var logo: Image?

    public init(
        brandPrimary: Color? = nil,
        brandPrimaryDark: Color? = nil,
        brandAccent: Color? = nil,
        onBrand: Color? = nil,
        background: Color? = nil,
        readingSurface: Color? = nil,
        cardSurface: Color? = nil,
        error: Color? = nil,
        onBackground: Color? = nil,
        onSurface: Color? = nil,
        darkBrandPrimary: Color? = nil,
        darkBrandPrimaryDark: Color? = nil,
        darkBrandAccent: Color? = nil,
        darkOnBrand: Color? = nil,
        darkBackground: Color? = nil,
        darkReadingSurface: Color? = nil,
        darkCardSurface: Color? = nil,
        darkError: Color? = nil,
        darkOnBackground: Color? = nil,
        darkOnSurface: Color? = nil,
        cardCornerRadius: CGFloat? = nil,
        buttonCornerRadius: CGFloat? = nil,
        inputCornerRadius: CGFloat? = nil,
        fontName: String? = nil,
        typeScale: CGFloat? = nil,
        logo: Image? = nil
    ) {
        self.brandPrimary = brandPrimary
        self.brandPrimaryDark = brandPrimaryDark
        self.brandAccent = brandAccent
        self.onBrand = onBrand
        self.background = background
        self.readingSurface = readingSurface
        self.cardSurface = cardSurface
        self.error = error
        self.onBackground = onBackground
        self.onSurface = onSurface
        self.darkBrandPrimary = darkBrandPrimary
        self.darkBrandPrimaryDark = darkBrandPrimaryDark
        self.darkBrandAccent = darkBrandAccent
        self.darkOnBrand = darkOnBrand
        self.darkBackground = darkBackground
        self.darkReadingSurface = darkReadingSurface
        self.darkCardSurface = darkCardSurface
        self.darkError = darkError
        self.darkOnBackground = darkOnBackground
        self.darkOnSurface = darkOnSurface
        self.cardCornerRadius = cardCornerRadius
        self.buttonCornerRadius = buttonCornerRadius
        self.inputCornerRadius = inputCornerRadius
        self.fontName = fontName
        self.typeScale = typeScale
        self.logo = logo
    }

    /// A convenience for hosts that only want to recolor: uses `brand` for the
    /// app-bar primary and derives the darker button tint automatically.
    public static func brand(_ primary: Color, accent: Color? = nil) -> FarmerChatTheme {
        FarmerChatTheme(brandPrimary: primary, brandAccent: accent)
    }
}

/// Hex initializer for SDK + host convenience: `Color(hex: 0x1565C0)`.
extension Color {
    public init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255.0,
            green: Double((hex >> 8) & 0xFF) / 255.0,
            blue: Double(hex & 0xFF) / 255.0
        )
    }
}
