import SwiftUI

// iOS 15 shims for the SwiftUI APIs the screens use that arrived in iOS 16. On iOS 16+ each one calls
// the real API, so rendering there is unchanged; iOS 15 gets the closest equivalent.

extension View {
    /// `fontWeight(_:)` on a View is iOS 16+. On iOS 15 the weight goes onto `style`'s font instead,
    /// so call this right after `.fcTextStyle(style)` with the same style. (`Text.fontWeight` directly
    /// on a `Text` is iOS 13+ and needs no shim.)
    @ViewBuilder
    func fcFontWeight(_ weight: Font.Weight, of style: FCTextStyle) -> some View {
        if #available(iOS 16.0, macOS 13.0, *) {
            fontWeight(weight)
        } else {
            font(style.font.weight(weight))
        }
    }

    /// `clipShape(UnevenRoundedRectangle(...))` with the same corner order; iOS 15 uses `FCCornerRectangle`.
    @ViewBuilder
    func fcClipCorners(topLeading: CGFloat = 0, bottomLeading: CGFloat = 0,
                       bottomTrailing: CGFloat = 0, topTrailing: CGFloat = 0) -> some View {
        if #available(iOS 16.0, macOS 13.0, *) {
            clipShape(UnevenRoundedRectangle(topLeadingRadius: topLeading, bottomLeadingRadius: bottomLeading,
                                             bottomTrailingRadius: bottomTrailing, topTrailingRadius: topTrailing,
                                             style: .continuous))
        } else {
            clipShape(FCCornerRectangle(topLeading: topLeading, bottomLeading: bottomLeading,
                                        bottomTrailing: bottomTrailing, topTrailing: topTrailing))
        }
    }

    /// Only the top corners rounded: a bottom sheet's top edge.
    func fcClipTopCorners(_ radius: CGFloat) -> some View {
        fcClipCorners(topLeading: radius, topTrailing: radius)
    }
}

/// iOS 15 stand-in for `UnevenRoundedRectangle`. Circular corners where iOS 16 draws continuous ones;
/// the difference is sub-pixel at these radii.
struct FCCornerRectangle: Shape {
    var topLeading: CGFloat
    var bottomLeading: CGFloat
    var bottomTrailing: CGFloat
    var topTrailing: CGFloat

    func path(in rect: CGRect) -> Path {
        let cap = min(rect.width, rect.height) / 2
        let tl = min(topLeading, cap), bl = min(bottomLeading, cap)
        let br = min(bottomTrailing, cap), tr = min(topTrailing, cap)
        var p = Path()
        p.move(to: CGPoint(x: rect.minX + tl, y: rect.minY))
        p.addLine(to: CGPoint(x: rect.maxX - tr, y: rect.minY))
        p.addArc(tangent1End: CGPoint(x: rect.maxX, y: rect.minY), tangent2End: CGPoint(x: rect.maxX, y: rect.maxY), radius: tr)
        p.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - br))
        p.addArc(tangent1End: CGPoint(x: rect.maxX, y: rect.maxY), tangent2End: CGPoint(x: rect.minX, y: rect.maxY), radius: br)
        p.addLine(to: CGPoint(x: rect.minX + bl, y: rect.maxY))
        p.addArc(tangent1End: CGPoint(x: rect.minX, y: rect.maxY), tangent2End: CGPoint(x: rect.minX, y: rect.minY), radius: bl)
        p.addLine(to: CGPoint(x: rect.minX, y: rect.minY + tl))
        p.addArc(tangent1End: CGPoint(x: rect.minX, y: rect.minY), tangent2End: CGPoint(x: rect.maxX, y: rect.minY), radius: tl)
        p.closeSubpath()
        return p
    }
}
