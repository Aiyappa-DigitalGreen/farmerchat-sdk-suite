//
//  FCTypography.swift
//  SwiftUI resolution of the shared type scale (FarmerChatCore/Theme/FCTypeScale.swift).
//
//  The numbers — 13 slots × 6 per-script tables, ported from the app's `theme/Type.kt` —
//  live in Core so both UI flavours read one copy. This file is only the SwiftUI half of
//  the arithmetic.
//
//  THE SWIFTUI-SPECIFIC TRAP
//  Compose's `lineHeight` (and UIKit's `NSParagraphStyle.maximumLineHeight`, and CSS
//  `line-height`) is the TOTAL line box. SwiftUI's `.lineSpacing` is leading added ON TOP OF
//  the font's own natural line height. The obvious-looking `lineHeight - size` therefore
//  double-counts the font's built-in leading — in the reference iOS app that put `bodyLarge`
//  (19/27) at a 31pt pitch against Android's 27.1, making every multi-line string ~15% too
//  airy and pushing everything below one down with it. The font's *natural line height* is
//  what must be subtracted, which is why this asks UIFont for it.
//
//  HOW THIS DIFFERS FROM THE REFERENCE APP'S COPY
//  The app renders one fixed scale. The SDK is themable: a host may supply `typeScale` and
//  `fontName` (docs/07). Both change the arithmetic — `typeScale` scales the target line
//  height as well as the point size, and a custom family has different natural metrics — so
//  leading cannot be baked into a static table the way the app bakes it. It is resolved per
//  (script, typeScale, fontName) and cached.
//

import SwiftUI
import FarmerChatCore
#if canImport(UIKit)
import UIKit
#endif

// MARK: - Resolved style

/// One Core spec resolved against a concrete `typeScale` and font family.
public struct FCTextStyle {
    /// Scaled point size. Exposed because call sites size icons to match adjacent text.
    public let size: CGFloat
    /// Scaled total line box — the Compose `lineHeight` equivalent, kept for callers that
    /// need to reserve an exact row height.
    public let lineHeight: CGFloat
    /// Extra leading so the rendered *pitch* equals `lineHeight`. This is the value
    /// `.lineSpacing` wants, and it is the whole point of the file.
    public let lineSpacing: CGFloat
    public let weight: Font.Weight
    public let font: Font

    fileprivate init(_ spec: FCTypeSpec, typeScale: CGFloat, fontName: String?) {
        let scaledSize = spec.size * typeScale
        let scaledLineHeight = spec.lineHeight * typeScale
        let weight = spec.weight.fcSwiftUIWeight
        self.size = scaledSize
        self.lineHeight = scaledLineHeight
        self.weight = weight

        if let fontName {
            self.font = .custom(fontName, size: scaledSize).weight(weight)
        } else {
            self.font = .system(size: scaledSize, weight: weight)
        }

        self.lineSpacing = max(
            0,
            scaledLineHeight - FCTextStyle.naturalLineHeight(
                size: scaledSize,
                weight: spec.weight,
                fontName: fontName
            )
        )
    }

    /// What one line occupies with no extra leading (ascender + descender + the font's own
    /// leading), asked of the same family SwiftUI will lay out.
    ///
    /// A host font is asked by name so its real metrics are used. If that name does not
    /// resolve — a host may name a family it never bundled — this falls back to the system
    /// font's metrics rather than guessing, the conservative reading: text stays at the app's
    /// pitch instead of inheriting an arbitrary one. `max(0, …)` then absorbs families whose
    /// natural height already exceeds Android's target: such a font gets no extra leading
    /// rather than a negative value SwiftUI would reject.
    private static func naturalLineHeight(
        size: CGFloat,
        weight: FCFontWeight,
        fontName: String?
    ) -> CGFloat {
        #if canImport(UIKit)
        if let fontName, let custom = UIFont(name: fontName, size: size) {
            return custom.lineHeight
        }
        return UIFont.systemFont(ofSize: size, weight: weight.fcUIFontWeight).lineHeight
        #else
        // Non-UIKit targets (macOS previews of this package) cannot measure; the spec's own
        // line height is the closest honest answer and keeps layout deterministic.
        return size
        #endif
    }
}

private extension FCFontWeight {
    var fcSwiftUIWeight: Font.Weight {
        switch self {
        case .regular: return .regular
        case .medium: return .medium
        case .semibold: return .semibold
        case .bold: return .bold
        }
    }

    #if canImport(UIKit)
    var fcUIFontWeight: UIFont.Weight {
        switch self {
        case .regular: return .regular
        case .medium: return .medium
        case .semibold: return .semibold
        case .bold: return .bold
        }
    }
    #endif
}

// MARK: - The resolved scale

/// The 13 slots, resolved for one script + host theme. Reached as `theme.typography.<slot>`.
public struct FCTypography {
    public let displayLarge: FCTextStyle
    public let displayMedium: FCTextStyle
    public let displaySmall: FCTextStyle

    public let titleLarge: FCTextStyle
    public let titleMedium: FCTextStyle
    public let titleSmall: FCTextStyle

    public let bodyLarge: FCTextStyle
    public let bodyMedium: FCTextStyle
    public let bodySmall: FCTextStyle

    public let labelLarge: FCTextStyle
    public let labelMedium: FCTextStyle
    public let labelSmall: FCTextStyle

    /// Not part of the Material3 scale — Android declares it separately.
    public let caption: FCTextStyle

    /// How this scale was resolved, kept so a slot can be re-resolved at an explicit point
    /// size (see `bodyMedium(atSize:)`).
    private let script: FCScript
    private let resolvedTypeScale: CGFloat
    private let resolvedFontName: String?

    fileprivate init(script: FCScript, typeScale: CGFloat, fontName: String?) {
        self.script = script
        self.resolvedTypeScale = typeScale
        self.resolvedFontName = fontName

        let scale = FCTypeScale.forScript(script)
        func r(_ s: FCTypeSpec) -> FCTextStyle {
            FCTextStyle(s, typeScale: typeScale, fontName: fontName)
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
}

// MARK: - Host point sizes

extension FCTypography {

    /// The chat-answer / user-bubble body slot at an explicit point size, for hosts that set
    /// `FarmerChatConfig.messageFontSize`. Android renders both bubbles' text through
    /// `MarkdownText`, which uses `bodyMedium` (MarkdownText.kt:168 and UserChatBubble.kt:116).
    ///
    /// A host asking for 22pt against a 17/25 spec is simply `typeScale: 22/17`, so this
    /// reuses the ordinary resolver rather than inventing a second formula — which matters
    /// because each script's line-height *ratio* is preserved (roman `bodyMedium` is 17/25
    /// but kannada is 17/26, and a host point size must not flatten that).
    ///
    /// The theme's own `typeScale` still composes on top: `messageFontSize` replaces the
    /// slot's *spec* size, it does not opt out of the host's global multiplier. That is the
    /// conservative reading — both knobs keep behaving as docs/07 documents them.
    public func bodyMedium(atSize pointSize: CGFloat) -> FCTextStyle {
        resolve(FCTypeScale.forScript(script).bodyMedium, atSize: pointSize, fallback: bodyMedium)
    }

    /// As `bodyMedium(atSize:)`, for the slots Android renders at `bodyLarge` — the composer
    /// field and the feed's error body.
    public func bodyLarge(atSize pointSize: CGFloat) -> FCTextStyle {
        resolve(FCTypeScale.forScript(script).bodyLarge, atSize: pointSize, fallback: bodyLarge)
    }

    private func resolve(
        _ spec: FCTypeSpec,
        atSize pointSize: CGFloat,
        fallback: FCTextStyle
    ) -> FCTextStyle {
        guard spec.size > 0, pointSize > 0 else { return fallback }
        return FCTextStyle(
            spec,
            typeScale: (pointSize / spec.size) * resolvedTypeScale,
            fontName: resolvedFontName
        )
    }
}

// MARK: - Resolution + cache

extension FCTypography {

    /// Resolved scales, keyed by script + host theme. `FCTheme.theme(for:appearance:)` is a
    /// computed property re-evaluated on every SwiftUI body pass, and resolving a scale
    /// measures 13 fonts, so an uncached resolve would re-measure 13 fonts per frame in a
    /// scrolling feed. The key space is tiny and bounded (6 scripts × the handful of host
    /// configurations an app ships), so this never grows unbounded.
    private static let cacheLock = NSLock()
    nonisolated(unsafe) private static var cache: [String: FCTypography] = [:]

    /// The script-correct, host-scaled type scale for a language code.
    public static func forLanguage(
        _ code: String,
        typeScale: CGFloat = 1.0,
        fontName: String? = nil
    ) -> FCTypography {
        let script = FCScript.forLanguage(code)
        let cacheKey = "\(script.rawValue)|\(typeScale)|\(fontName ?? "")"

        cacheLock.lock()
        if let hit = cache[cacheKey] {
            cacheLock.unlock()
            return hit
        }
        cacheLock.unlock()

        let resolved = FCTypography(script: script, typeScale: typeScale, fontName: fontName)

        cacheLock.lock()
        cache[cacheKey] = resolved
        cacheLock.unlock()

        return resolved
    }

    /// Roman at scale 1.0 — the environment default before a theme resolves.
    public static let roman = FCTypography(script: .roman, typeScale: 1.0, fontName: nil)
}

// MARK: - Call-site modifier

extension View {
    /// Applies size, weight and the script-correct leading in one call, so call sites read
    /// like Compose's `style = MaterialTheme.typography.bodyMedium`.
    public func fcTextStyle(_ style: FCTextStyle) -> some View {
        self.font(style.font)
            .lineSpacing(style.lineSpacing)
    }
}
