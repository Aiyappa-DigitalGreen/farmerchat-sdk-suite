import UIKit

/// The Material "history" glyph (24×24 viewport), as the chat-header history button's icon on
/// every SDK platform. Android `fc_icon_history.xml`, web `icon_history`. The app has no history
/// button; this is an SDK decision (2026-10-16) that replaced the lightbulb, which was the app's
/// Auth tip badge (`icon_timer`).
///
/// SVG source: M13,3a9,9 0 0,0 -9,9H1l3.89,3.89 0.07,0.14L9,12H6c0,-3.87 3.13,-7 7,-7s7,3.13 7,7
/// -3.13,7 -7,7c-1.93,0 -3.68,-0.79 -4.94,-2.06l-1.42,1.42C8.27,19.99 10.51,21 13,21c4.97,0 9,-4.03
/// 9,-9s-4.03,-9 -9,-9zM12,8v5l4.28,2.54 0.72,-1.21 -3.5,-2.08V8H12z
/// Relative commands and smooth curves are expanded to absolute points below. The one SVG arc is
/// a quarter circle about (13,12), r 9, from the top (13,3) to the left (4,12), counter-clockwise
/// on screen.
func fcHistoryGlyphPath(in rect: CGRect) -> CGPath {
    let p = CGMutablePath()
    // Ring + arrow.
    p.move(to: CGPoint(x: 13, y: 3))
    p.addArc(center: CGPoint(x: 13, y: 12), radius: 9, startAngle: -.pi / 2, endAngle: -.pi, clockwise: true)
    p.addLine(to: CGPoint(x: 1, y: 12))
    p.addLine(to: CGPoint(x: 4.89, y: 15.89))
    p.addLine(to: CGPoint(x: 4.96, y: 16.03))
    p.addLine(to: CGPoint(x: 9, y: 12))
    p.addLine(to: CGPoint(x: 6, y: 12))
    p.addCurve(to: CGPoint(x: 13, y: 5), control1: CGPoint(x: 6, y: 8.13), control2: CGPoint(x: 9.13, y: 5))
    p.addCurve(to: CGPoint(x: 20, y: 12), control1: CGPoint(x: 16.87, y: 5), control2: CGPoint(x: 20, y: 8.13))
    p.addCurve(to: CGPoint(x: 13, y: 19), control1: CGPoint(x: 20, y: 15.87), control2: CGPoint(x: 16.87, y: 19))
    p.addCurve(to: CGPoint(x: 8.06, y: 16.94), control1: CGPoint(x: 11.07, y: 19), control2: CGPoint(x: 9.32, y: 18.21))
    p.addLine(to: CGPoint(x: 6.64, y: 18.36))
    p.addCurve(to: CGPoint(x: 13, y: 21), control1: CGPoint(x: 8.27, y: 19.99), control2: CGPoint(x: 10.51, y: 21))
    p.addCurve(to: CGPoint(x: 22, y: 12), control1: CGPoint(x: 17.97, y: 21), control2: CGPoint(x: 22, y: 16.97))
    p.addCurve(to: CGPoint(x: 13, y: 3), control1: CGPoint(x: 22, y: 7.03), control2: CGPoint(x: 17.97, y: 3))
    p.closeSubpath()
    // Hands.
    p.move(to: CGPoint(x: 12, y: 8))
    p.addLine(to: CGPoint(x: 12, y: 13))
    p.addLine(to: CGPoint(x: 16.28, y: 15.54))
    p.addLine(to: CGPoint(x: 17, y: 14.33))
    p.addLine(to: CGPoint(x: 13.5, y: 12.25))
    p.addLine(to: CGPoint(x: 13.5, y: 8))
    p.closeSubpath()
    var t = CGAffineTransform(translationX: rect.minX, y: rect.minY)
        .scaledBy(x: rect.width / 24, y: rect.height / 24)
    return p.copy(using: &t) ?? p
}

/// [fcHistoryGlyphPath] as a template image, so the header tile's tint colours it exactly like the
/// SF Symbol it replaces.
func fcHistoryGlyphImage(size: CGFloat) -> UIImage {
    let format = UIGraphicsImageRendererFormat.preferred()
    format.opaque = false
    let image = UIGraphicsImageRenderer(size: CGSize(width: size, height: size), format: format).image { ctx in
        ctx.cgContext.addPath(fcHistoryGlyphPath(in: CGRect(x: 0, y: 0, width: size, height: size)))
        ctx.cgContext.setFillColor(UIColor.black.cgColor)
        ctx.cgContext.fillPath()
    }
    return image.withRenderingMode(.alwaysTemplate)
}
