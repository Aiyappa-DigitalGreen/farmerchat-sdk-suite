//
//  FCUITypography.swift
//  UIKit resolution of the shared type scale (FarmerChatCore/Theme/FCTypeScale.swift).
//
//  The numbers — 13 slots × 6 per-script tables, ported from the app's `theme/Type.kt` —
//  live in Core so both UI flavours read one copy.
//
//  WHY THE UIKIT ARITHMETIC IS DIFFERENT FROM THE SWIFTUI ONE
//  `NSParagraphStyle.minimumLineHeight` / `maximumLineHeight` are a TOTAL line box, exactly
//  like Compose's `lineHeight`. So UIKit uses the Core number directly, with no subtraction.
//  The SwiftUI flavour cannot: its `.lineSpacing` is leading added ON TOP OF the font's
//  natural line height, so it has to subtract `UIFont.lineHeight` first. Same numbers, two
//  formulas — which is precisely why the numbers are not duplicated into either flavour.
//
//  A UIKIT CONSTRAINT WORTH KNOWING
//  `UILabel` has no line-height property; line height only exists via attributed text. So
//  `fcApplyFont` (font + weight only) is safe to call anywhere, while `fcSetText` — which
//  also applies the line height — has to be the call that sets the string, and bakes in the
//  label's `textColor` at that moment because attributed runs ignore a later `textColor`
//  assignment. Single-line labels lose nothing by using only `fcApplyFont`.
//

import UIKit
import FarmerChatCore

/// One Core spec resolved against a concrete `typeScale` and font family.
public struct FCUITextStyle {
    public let size: CGFloat
    /// Total line box, applied directly — see the header note.
    public let lineHeight: CGFloat
    public let font: UIFont

    fileprivate init(_ spec: FCTypeSpec, typeScale: CGFloat, fontName: String?) {
        let scaledSize = spec.size * typeScale
        self.size = scaledSize
        self.lineHeight = spec.lineHeight * typeScale

        let weight = spec.weight.fcUIFontWeight
        if let fontName, let custom = UIFont(name: fontName, size: scaledSize) {
            // Ask for the weight-matched face of the host family; fall back to the plain
            // face rather than synthesising a weight the family may not have.
            let descriptor = custom.fontDescriptor.addingAttributes([
                .traits: [UIFontDescriptor.TraitKey.weight: weight]
            ])
            self.font = UIFont(descriptor: descriptor, size: scaledSize)
        } else {
            self.font = .systemFont(ofSize: scaledSize, weight: weight)
        }
    }

    /// A paragraph style pinning the line box to `lineHeight`. Both bounds are set: minimum
    /// alone would let a tall glyph run grow the line, maximum alone would let a short one
    /// shrink it, and Android's `lineHeight` is exact.
    public func paragraphStyle(alignment: NSTextAlignment = .natural,
                               lineBreakMode: NSLineBreakMode = .byWordWrapping) -> NSParagraphStyle {
        let p = NSMutableParagraphStyle()
        p.minimumLineHeight = lineHeight
        p.maximumLineHeight = lineHeight
        p.alignment = alignment
        p.lineBreakMode = lineBreakMode
        return p
    }
}

private extension FCFontWeight {
    var fcUIFontWeight: UIFont.Weight {
        switch self {
        case .regular: return .regular
        case .medium: return .medium
        case .semibold: return .semibold
        case .bold: return .bold
        }
    }
}

// MARK: - The resolved scale

public struct FCUITypography {
    public let displayLarge, displayMedium, displaySmall: FCUITextStyle
    public let titleLarge, titleMedium, titleSmall: FCUITextStyle
    public let bodyLarge, bodyMedium, bodySmall: FCUITextStyle
    public let labelLarge, labelMedium, labelSmall: FCUITextStyle
    public let caption: FCUITextStyle

    private let script: FCScript
    private let resolvedTypeScale: CGFloat
    private let resolvedFontName: String?

    fileprivate init(script: FCScript, typeScale: CGFloat, fontName: String?) {
        self.script = script
        self.resolvedTypeScale = typeScale
        self.resolvedFontName = fontName

        let scale = FCTypeScale.forScript(script)
        func r(_ s: FCTypeSpec) -> FCUITextStyle {
            FCUITextStyle(s, typeScale: typeScale, fontName: fontName)
        }
        displayLarge = r(scale.displayLarge)
        displayMedium = r(scale.displayMedium)
        displaySmall = r(scale.displaySmall)
        titleLarge = r(scale.titleLarge)
        titleMedium = r(scale.titleMedium)
        titleSmall = r(scale.titleSmall)
        bodyLarge = r(scale.bodyLarge)
        bodyMedium = r(scale.bodyMedium)
        bodySmall = r(scale.bodySmall)
        labelLarge = r(scale.labelLarge)
        labelMedium = r(scale.labelMedium)
        labelSmall = r(scale.labelSmall)
        caption = r(scale.caption)
    }

    /// The body slot at a host-supplied point size (`FarmerChatConfig.messageFontSize`).
    /// Expressed as a per-slot `typeScale` so each script's line-height ratio survives.
    public func bodyMedium(atSize pointSize: CGFloat) -> FCUITextStyle {
        resolve(FCTypeScale.forScript(script).bodyMedium, atSize: pointSize, fallback: bodyMedium)
    }

    /// As `bodyMedium(atSize:)`, for the slots Android renders at `bodyLarge` — the
    /// alignment-surface message (AlignmentSurface.kt:90) and the composer field.
    public func bodyLarge(atSize pointSize: CGFloat) -> FCUITextStyle {
        resolve(FCTypeScale.forScript(script).bodyLarge, atSize: pointSize, fallback: bodyLarge)
    }

    private func resolve(_ spec: FCTypeSpec,
                         atSize pointSize: CGFloat,
                         fallback: FCUITextStyle) -> FCUITextStyle {
        guard spec.size > 0, pointSize > 0 else { return fallback }
        return FCUITextStyle(spec,
                             typeScale: (pointSize / spec.size) * resolvedTypeScale,
                             fontName: resolvedFontName)
    }
}

// MARK: - Resolution + cache

extension FCUITypography {

    private static let cacheLock = NSLock()
    nonisolated(unsafe) private static var cache: [String: FCUITypography] = [:]

    public static func forLanguage(
        _ code: String,
        typeScale: CGFloat = 1.0,
        fontName: String? = nil
    ) -> FCUITypography {
        let script = FCScript.forLanguage(code)
        let key = "\(script.rawValue)|\(typeScale)|\(fontName ?? "")"

        cacheLock.lock()
        if let hit = cache[key] { cacheLock.unlock(); return hit }
        cacheLock.unlock()

        let resolved = FCUITypography(script: script, typeScale: typeScale, fontName: fontName)

        cacheLock.lock()
        cache[key] = resolved
        cacheLock.unlock()
        return resolved
    }

    /// The scale for the farmer's current language and the host's theme.
    ///
    /// UIKit has no environment to inherit from, so this reads the same sources the SwiftUI
    /// flavour's `FCTheme` does: the persisted language code (seeded at `initialize` from
    /// `config.languageCode` or the device locale) and the host `typeScale`/`fontName`.
    /// Cheap to call repeatedly — the resolve is cached.
    public static var current: FCUITypography {
        guard FarmerChat.isInitialized else { return .roman }
        let host = FarmerChat.shared.config.theme
        return forLanguage(
            FarmerChat.shared.prefs.string(.selectedLanguageCode) ?? "en",
            typeScale: host?.typeScale ?? 1.0,
            fontName: host?.fontName
        )
    }

    public static let roman = FCUITypography(script: .roman, typeScale: 1.0, fontName: nil)
}

// MARK: - Call-site helpers

extension UILabel {
    /// Font + weight only. Safe to call at any point in a label's life, and enough for
    /// single-line labels, which have no line box to correct.
    public func fcApplyFont(_ style: FCUITextStyle) {
        font = style.font
    }

    /// Sets the string WITH the script-correct line height.
    ///
    /// Must be the call that sets the text: `UILabel` exposes no line-height property, so
    /// this goes through `attributedText`. The label's current `textColor` and
    /// `textAlignment` are baked in, because attributed runs ignore a later `textColor`
    /// assignment — set those first, then call this.
    public func fcSetText(_ string: String?, style: FCUITextStyle) {
        font = style.font
        guard let string, !string.isEmpty else {
            attributedText = nil
            text = nil
            return
        }
        attributedText = NSAttributedString(string: string, attributes: [
            .font: style.font,
            .foregroundColor: textColor ?? .label,
            .paragraphStyle: style.paragraphStyle(alignment: textAlignment,
                                                  lineBreakMode: lineBreakMode),
        ])
    }
}

extension UIButton {
    /// Font + weight for a button's title label. Button titles are single-line in this SDK,
    /// so no line box is involved.
    public func fcApplyTitleFont(_ style: FCUITextStyle) {
        titleLabel?.font = style.font
    }
}

extension UITextField {
    public func fcApplyFont(_ style: FCUITextStyle) {
        font = style.font
    }
}
