//
//  FCTypeScale.swift
//  The type scale as DATA — no UI framework types.
//
//  Port of the numbers in the app's `theme/Type.kt`: 13 slots, and six per-script tables,
//  because Android varies *line height* per script (Devanagari/Ethiopic/Kannada/Oriya/Telugu
//  need more leading than Roman at the same point size) while holding size and weight fixed.
//
//  WHY THIS LIVES IN CORE
//  Both UI flavours need these numbers, and each must express them differently:
//
//    - SwiftUI has no line-height property. Leading is applied with `.lineSpacing`, which is
//      added ON TOP OF the font's natural line height, so `FarmerChatSwiftUI` subtracts
//      `UIFont.lineHeight` to hit the target pitch.
//    - UIKit applies line height through `NSParagraphStyle.minimumLineHeight` /
//      `maximumLineHeight`, which IS a total line box like Compose's `lineHeight` — so
//      `FarmerChatUIKit` uses the number directly, with no subtraction.
//
//  Two different formulas over one set of numbers is exactly the shape that drifts if each
//  flavour keeps its own copy of the tables (the same reasoning as the android rule that
//  state machines live in core and "the two flavours must not drift"). So the numbers live
//  here once and neither flavour restates them.
//

import Foundation

/// Weight as data. Deliberately not `Font.Weight` or `UIFont.Weight` — this type must not
/// drag a UI framework into Core, and each flavour maps it to its own weight type.
public enum FCFontWeight: Sendable {
    case regular
    case medium
    case semibold
    case bold
}

/// One slot, unscaled: point size + TOTAL line box + weight (mirrors Compose `TextStyle`).
/// Carries no leading — leading only exists once a font family and scale are known.
public struct FCTypeSpec: Sendable {
    public let size: CGFloat
    public let lineHeight: CGFloat
    public let weight: FCFontWeight

    public init(size: CGFloat, lineHeight: CGFloat, weight: FCFontWeight) {
        self.size = size
        self.lineHeight = lineHeight
        self.weight = weight
    }
}

/// The 13 slots the Android app uses: the Material3 scale plus a separate `caption`.
public struct FCTypeScale: Sendable {
    public let displayLarge, displayMedium, displaySmall: FCTypeSpec
    public let titleLarge, titleMedium, titleSmall: FCTypeSpec
    public let bodyLarge, bodyMedium, bodySmall: FCTypeSpec
    public let labelLarge, labelMedium, labelSmall: FCTypeSpec
    public let caption: FCTypeSpec
}

/// Which per-script table a language uses. A named type (rather than a bare string) so the
/// flavours' resolution caches can key on it without inventing their own vocabulary.
public enum FCScript: String, Sendable, CaseIterable {
    case roman, devanagari, ethiopic, kannada, oriya, telugu

    /// Port of `typographyForLanguage(code)`.
    public static func forLanguage(_ code: String) -> FCScript {
        switch code.lowercased().trimmingCharacters(in: .whitespaces) {
        case "hi", "mr", "ne", "bho", "mai", "doi", "kok", "sa", "brx", "raj":
            return .devanagari
        case "am", "ti", "om", "so", "aa":
            return .ethiopic
        case "kn":
            return .kannada
        case "or", "od":
            return .oriya
        case "te":
            return .telugu
        default:
            return .roman
        }
    }
}

extension FCTypeScale {

    public static func forScript(_ script: FCScript) -> FCTypeScale {
        switch script {
        case .roman: return .roman
        case .devanagari: return .devanagari
        case .ethiopic: return .ethiopic
        case .kannada: return .kannada
        case .oriya: return .oriya
        case .telugu: return .telugu
        }
    }

    /// Roman / default (en, sw, fr, …)
    public static let roman = FCTypeScale(
        displayLarge: .init(size: 35, lineHeight: 42, weight: .bold),
        displayMedium: .init(size: 28, lineHeight: 36, weight: .bold),
        displaySmall: .init(size: 24, lineHeight: 32, weight: .bold),
        titleLarge: .init(size: 22, lineHeight: 28, weight: .bold),
        titleMedium: .init(size: 18, lineHeight: 24, weight: .bold),
        titleSmall: .init(size: 16, lineHeight: 22, weight: .bold),
        bodyLarge: .init(size: 19, lineHeight: 27, weight: .regular),
        bodyMedium: .init(size: 17, lineHeight: 25, weight: .regular),
        bodySmall: .init(size: 15, lineHeight: 22, weight: .regular),
        labelLarge: .init(size: 17, lineHeight: 22, weight: .semibold),
        labelMedium: .init(size: 15, lineHeight: 20, weight: .semibold),
        labelSmall: .init(size: 13, lineHeight: 18, weight: .semibold),
        caption: .init(size: 13, lineHeight: 18, weight: .regular)
    )

    /// Devanagari (hi, mr, ne, bho, mai, doi, kok, sa, brx, raj)
    public static let devanagari = FCTypeScale(
        displayLarge: .init(size: 35, lineHeight: 48, weight: .bold),
        displayMedium: .init(size: 28, lineHeight: 36, weight: .bold),
        displaySmall: .init(size: 24, lineHeight: 34, weight: .bold),
        titleLarge: .init(size: 22, lineHeight: 28, weight: .bold),
        titleMedium: .init(size: 18, lineHeight: 26, weight: .bold),
        titleSmall: .init(size: 16, lineHeight: 24, weight: .bold),
        bodyLarge: .init(size: 19, lineHeight: 27, weight: .regular),
        bodyMedium: .init(size: 17, lineHeight: 25, weight: .regular),
        bodySmall: .init(size: 15, lineHeight: 22, weight: .regular),
        labelLarge: .init(size: 17, lineHeight: 22, weight: .semibold),
        labelMedium: .init(size: 15, lineHeight: 20, weight: .semibold),
        labelSmall: .init(size: 13, lineHeight: 18, weight: .semibold),
        caption: .init(size: 13, lineHeight: 18, weight: .regular)
    )

    /// Ethiopic (am, ti, om, so, aa)
    public static let ethiopic = FCTypeScale(
        displayLarge: .init(size: 35, lineHeight: 46, weight: .bold),
        displayMedium: .init(size: 28, lineHeight: 34, weight: .bold),
        displaySmall: .init(size: 24, lineHeight: 30, weight: .bold),
        titleLarge: .init(size: 22, lineHeight: 30, weight: .bold),
        titleMedium: .init(size: 18, lineHeight: 24, weight: .bold),
        titleSmall: .init(size: 16, lineHeight: 20, weight: .bold),
        bodyLarge: .init(size: 19, lineHeight: 28, weight: .regular),
        bodyMedium: .init(size: 17, lineHeight: 25, weight: .regular),
        bodySmall: .init(size: 15, lineHeight: 22, weight: .regular),
        labelLarge: .init(size: 17, lineHeight: 22, weight: .semibold),
        labelMedium: .init(size: 15, lineHeight: 20, weight: .semibold),
        labelSmall: .init(size: 13, lineHeight: 18, weight: .semibold),
        caption: .init(size: 13, lineHeight: 18, weight: .regular)
    )

    /// Kannada (kn)
    public static let kannada = FCTypeScale(
        displayLarge: .init(size: 35, lineHeight: 48, weight: .bold),
        displayMedium: .init(size: 28, lineHeight: 40, weight: .bold),
        displaySmall: .init(size: 24, lineHeight: 34, weight: .bold),
        titleLarge: .init(size: 22, lineHeight: 32, weight: .bold),
        titleMedium: .init(size: 18, lineHeight: 26, weight: .bold),
        titleSmall: .init(size: 16, lineHeight: 24, weight: .bold),
        bodyLarge: .init(size: 19, lineHeight: 28, weight: .regular),
        bodyMedium: .init(size: 17, lineHeight: 26, weight: .regular),
        bodySmall: .init(size: 15, lineHeight: 23, weight: .regular),
        labelLarge: .init(size: 17, lineHeight: 22, weight: .semibold),
        labelMedium: .init(size: 15, lineHeight: 20, weight: .semibold),
        labelSmall: .init(size: 13, lineHeight: 18, weight: .semibold),
        caption: .init(size: 13, lineHeight: 18, weight: .regular)
    )

    /// Oriya (or, od)
    public static let oriya = FCTypeScale(
        displayLarge: .init(size: 35, lineHeight: 46, weight: .bold),
        displayMedium: .init(size: 28, lineHeight: 34, weight: .bold),
        displaySmall: .init(size: 24, lineHeight: 30, weight: .bold),
        titleLarge: .init(size: 22, lineHeight: 30, weight: .bold),
        titleMedium: .init(size: 18, lineHeight: 24, weight: .bold),
        titleSmall: .init(size: 16, lineHeight: 20, weight: .bold),
        bodyLarge: .init(size: 19, lineHeight: 28, weight: .regular),
        bodyMedium: .init(size: 17, lineHeight: 25, weight: .regular),
        bodySmall: .init(size: 15, lineHeight: 22, weight: .regular),
        labelLarge: .init(size: 17, lineHeight: 22, weight: .semibold),
        labelMedium: .init(size: 15, lineHeight: 20, weight: .semibold),
        labelSmall: .init(size: 13, lineHeight: 18, weight: .semibold),
        caption: .init(size: 13, lineHeight: 18, weight: .regular)
    )

    /// Telugu (te)
    public static let telugu = FCTypeScale(
        displayLarge: .init(size: 35, lineHeight: 44, weight: .bold),
        displayMedium: .init(size: 28, lineHeight: 36, weight: .bold),
        displaySmall: .init(size: 24, lineHeight: 30, weight: .bold),
        titleLarge: .init(size: 22, lineHeight: 28, weight: .bold),
        titleMedium: .init(size: 18, lineHeight: 24, weight: .bold),
        titleSmall: .init(size: 16, lineHeight: 22, weight: .bold),
        bodyLarge: .init(size: 19, lineHeight: 27, weight: .regular),
        bodyMedium: .init(size: 17, lineHeight: 25, weight: .regular),
        bodySmall: .init(size: 15, lineHeight: 22, weight: .regular),
        labelLarge: .init(size: 17, lineHeight: 22, weight: .semibold),
        labelMedium: .init(size: 15, lineHeight: 20, weight: .semibold),
        labelSmall: .init(size: 13, lineHeight: 18, weight: .semibold),
        caption: .init(size: 13, lineHeight: 18, weight: .regular)
    )
}
