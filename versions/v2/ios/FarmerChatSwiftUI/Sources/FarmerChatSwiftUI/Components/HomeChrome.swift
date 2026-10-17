import SwiftUI
import FarmerChatCore

// Home chrome ported from the app's composer Home (fc-compose-agentic HomeScreen.kt, Figma 1.2
// Home; `OnboardingRemoteConfig.getComposerUiEnabled()` is hard-wired true there): the green →
// transparent band with sunbeams and the yellow bloom behind the feed, HomeAppBar (round menu
// tile + weather pill), the fixed header (logo, leaf-flanked "For your farm today", location
// pill) and the restyled ContentCard. Values come from the app; the Android SDK's port
// (versions/v2/android compose HomeScreen.kt / Sunbeams.kt / SectionHeader.kt /
// LocationButton.kt) was the second reference.

// MARK: - Band (HomeScreen.kt: the BACKGROUND gradient band behind the transparent feed)

/// Solid brand green to 58.8% of a band 36.6% of the screen tall, transparent by its bottom, with
/// the sunbeams (280pt) and the 148pt yellow bloom on top. Bleeds behind the status bar.
struct FCHomeBand: View {
    @Environment(\.fcTheme) private var theme

    var body: some View {
        GeometryReader { proxy in
            let bandHeight = proxy.size.height * 0.366
            ZStack(alignment: .top) {
                LinearGradient(
                    stops: [
                        .init(color: theme.brand.surfacePrimary, location: 0),
                        .init(color: theme.brand.surfacePrimary, location: 0.588),
                        .init(color: theme.brand.surfacePrimary.opacity(0), location: 1)
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                FCSunbeams().frame(height: 280)
                FCChatGlow(height: 148)
            }
            .frame(width: proxy.size.width, height: bandHeight, alignment: .top)
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

// MARK: - Sunbeams (components/Sunbeams.kt)

/// Soft blurred rays fanning down from a sun 40pt above the top edge: eight beams in two groups,
/// a ±1.4° sway over 16 s, and the groups breathing on different rhythms (8 s and 4 s). Each
/// group is drawn and blurred ONCE (rasterised by `drawingGroup`); a frame only rotates and fades
/// the two layers, as the app's half-resolution bitmaps do.
struct FCSunbeams: View {
    private struct Beam { let angle: Double; let length: CGFloat; let alpha: Double }
    private static let beams: [Beam] = [
        Beam(angle: -52, length: 0.62, alpha: 0.07), Beam(angle: -36, length: 0.95, alpha: 0.10),
        Beam(angle: -22, length: 0.72, alpha: 0.07), Beam(angle: -8, length: 1.00, alpha: 0.11),
        Beam(angle: 7, length: 0.78, alpha: 0.07), Beam(angle: 21, length: 1.00, alpha: 0.10),
        Beam(angle: 37, length: 0.68, alpha: 0.07), Beam(angle: 51, length: 0.90, alpha: 0.08)
    ]
    private static let warm = Color(red: 1, green: 246 / 255, blue: 214 / 255)

    @State private var sway = false
    @State private var breatheA = false
    @State private var breatheB = false

    var body: some View {
        GeometryReader { proxy in
            let originY: CGFloat = -40
            let anchor = UnitPoint(x: 0.5, y: proxy.size.height > 0 ? originY / proxy.size.height : 0)
            ZStack {
                group(parity: 0, size: proxy.size)
                    .opacity(breatheA ? 1.0 : 0.1)
                group(parity: 1, size: proxy.size)
                    .opacity(breatheB ? 1.0 : 0.1)
            }
            .rotationEffect(.degrees(sway ? 1.4 : -1.4), anchor: anchor)
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 16).repeatForever(autoreverses: true)) { sway = true }
            withAnimation(.easeInOut(duration: 4).repeatForever(autoreverses: true)) { breatheA = true }
            withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true).delay(0.8)) { breatheB = true }
        }
    }

    private func group(parity: Int, size: CGSize) -> some View {
        Canvas { context, size in
            let origin = CGPoint(x: size.width / 2, y: -40)
            let shading = GraphicsContext.Shading.linearGradient(
                Gradient(colors: [Self.warm, Self.warm.opacity(0)]),
                startPoint: .zero,
                endPoint: CGPoint(x: 0, y: size.height * 0.85)
            )
            for (index, beam) in Self.beams.enumerated() where index % 2 == parity {
                let rad = beam.angle * .pi / 180
                let dir = CGPoint(x: sin(rad), y: cos(rad))
                let perp = CGPoint(x: dir.y, y: -dir.x)
                let startR: CGFloat = 30, endR = size.height * beam.length * 1.35
                let startHalf: CGFloat = 3, endHalf: CGFloat = 17
                var path = Path()
                path.move(to: CGPoint(x: origin.x + dir.x * startR - perp.x * startHalf, y: origin.y + dir.y * startR - perp.y * startHalf))
                path.addLine(to: CGPoint(x: origin.x + dir.x * startR + perp.x * startHalf, y: origin.y + dir.y * startR + perp.y * startHalf))
                path.addLine(to: CGPoint(x: origin.x + dir.x * endR + perp.x * endHalf, y: origin.y + dir.y * endR + perp.y * endHalf))
                path.addLine(to: CGPoint(x: origin.x + dir.x * endR - perp.x * endHalf, y: origin.y + dir.y * endR - perp.y * endHalf))
                path.closeSubpath()
                var layer = context
                layer.opacity = beam.alpha
                layer.fill(path, with: shading)
            }
        }
        .blur(radius: 7)
        .drawingGroup()
        .frame(width: size.width, height: size.height)
    }
}

// MARK: - SectionHeader (components/SectionHeader.kt)

/// `drawable/leaf.xml` (11×11 viewport): M10.5191 0 C4.70952 0 0 4.71382 0 10.5286
/// C5.8095 10.5286 10.5191 5.81477 10.5191 0 Z.
struct FCLeafShape: Shape {
    func path(in rect: CGRect) -> Path {
        let sx = rect.width / 11, sy = rect.height / 11
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: rect.minX + x * sx, y: rect.minY + y * sy) }
        var path = Path()
        path.move(to: p(10.5191, 0))
        path.addCurve(to: p(0, 10.5286), control1: p(4.70952, 0), control2: p(0, 4.71382))
        path.addCurve(to: p(10.5191, 0), control1: p(5.8095, 10.5286), control2: p(10.5191, 5.81477))
        path.closeSubpath()
        return path
    }
}

/// A gapless row of 4pt leaves tiled across the width, alternately mirrored, centred.
struct FCLeafDivider: View {
    let color: Color

    var body: some View {
        Canvas { context, size in
            let s = size.height
            guard s > 0, size.width > 0 else { return }
            let count = Int(floor(size.width / s))
            let startX = (size.width - CGFloat(count) * s) / 2
            let leaf = FCLeafShape().path(in: CGRect(x: 0, y: 0, width: s, height: s))
            for i in 0..<count {
                var t = CGAffineTransform(translationX: startX + CGFloat(i) * s, y: 0)
                if i % 2 == 1 {
                    t = t.translatedBy(x: s, y: 0).scaledBy(x: -1, y: 1)
                }
                context.fill(leaf.applying(t), with: .color(color))
            }
        }
        .frame(height: 4)
    }
}

/// Centred title flanked by leaf dividers: 24pt side padding, 10pt gaps, 18pt SemiBold title.
struct FCSectionHeader: View {
    @Environment(\.fcTheme) private var theme
    let title: String
    var titleColor: Color?
    var verticalPadding: CGFloat = 16

    var body: some View {
        HStack(spacing: 10) {
            FCLeafDivider(color: theme.content.buttonPrimaryAccent)
            Text(title)
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(titleColor ?? theme.content.foregroundPrimary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .layoutPriority(1)
                .accessibilityAddTraits(.isHeader)
            FCLeafDivider(color: theme.content.buttonPrimaryAccent)
        }
        .padding(.horizontal, 24)
        .padding(.vertical, verticalPadding)
    }
}

// MARK: - LocationButton (components/buttons/LocationButton.kt)

/// The Location 2.0 pill under the Home section header: Green800 (72% while inviting), 14/22
/// padding, a 22pt icon, white labelMedium text; 42pt tall, 40pt once located.
struct FCLocationButton: View {
    @Environment(\.fcTheme) private var theme
    let state: FCLocationPillState
    let placeName: String
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: iconGap) {
                icon
                label
                    .fcTextStyle(theme.typography.labelMedium)
                    .foregroundColor(theme.brand.foregroundPrimary)
                    .lineLimit(1)
            }
            .padding(.leading, 14)
            .padding(.trailing, 22)
            .frame(height: state == .located || state == .success ? 40 : 42)
            .background(
                Capsule().fill(theme.brand.surfaceSecondary.opacity(state == .invite ? 0.72 : 1))
            )
            .contentShape(Capsule())
            .animation(.spring(response: 0.35, dampingFraction: 0.85), value: state)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("fcHomeLocationPill")
    }

    private var iconGap: CGFloat {
        switch state {
        case .searching: return 8
        case .success, .located: return 4
        default: return 6
        }
    }

    @ViewBuilder
    private var icon: some View {
        switch state {
        case .searching:
            ProgressView()
                .tint(theme.brand.foregroundSecondary)
                .scaleEffect(0.8)
                .frame(width: 18, height: 18)
        default:
            Image(systemName: iconName)
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(theme.brand.foregroundSecondary)
                .frame(width: 22, height: 22)
        }
    }

    private var iconName: String {
        switch state {
        case .invite: return "location.circle"
        case .success: return "checkmark"
        case .located: return "mappin.and.ellipse"
        case .blocked: return "location.slash"
        case .searching: return ""
        }
    }

    private var label: Text {
        switch state {
        case .invite: return Text(fcLabel(FCLabels.setYourLocation, "Set your location"))
        case .searching: return Text(fcLabel(FCLabels.gettingYourLocation, "Getting your location"))
        case .success: return Text(fcLabel(FCLabels.locationFound, "Location found"))
        case .blocked: return Text(fcLabel(FCLabels.allowLocationInSettings, "Allow location in Settings"))
        case .located:
            return Text(placeName + " - ")
                + Text(fcLabel(FCLabels.change, "Change")).foregroundColor(theme.brand.foregroundSecondary)
        }
    }
}

// MARK: - HomeAppBar (components/appbars/HomeAppBar.kt)

/// 52pt row (+ status inset), 16pt side padding: the round menu ActionButton and the weather pill.
/// No background of its own on the composer Home — the band behind supplies the green.
struct FCHomeAppBar: View {
    let showMenu: Bool
    let showWeather: Bool
    let weather: WeatherResponse?
    let weatherLoading: Bool
    var trailingInset: CGFloat = 0
    /// HomeAppBar `showBackground`: the legacy (non-composer) Home paints the bar green with the
    /// 80pt glow; the composer Home leaves it transparent over the band.
    var showBackground: Bool = false
    let onMenu: () -> Void
    let onWeather: () -> Void
    @Environment(\.fcTheme) private var theme

    var body: some View {
        HStack(spacing: 0) {
            if showMenu {
                FCAppBarTile(symbol: "line.3.horizontal", label: "menu", identifier: "fcHomeMenu", radius: 21, action: onMenu)
            }
            Spacer(minLength: 8)
            if showWeather {
                FCWeatherButton(weather: weather, isLoading: weatherLoading, action: onWeather)
                    .transition(.opacity)
            }
        }
        .padding(.leading, 16)
        .padding(.trailing, 16 + trailingInset)
        .frame(height: 52)
        .background(alignment: .top) {
            if showBackground {
                ZStack(alignment: .top) {
                    theme.brand.surfacePrimary
                    FCChatGlow(height: 80)
                }
                .ignoresSafeArea(edges: .top)
            }
        }
        .animation(.easeInOut(duration: 0.4), value: showWeather)
    }
}
