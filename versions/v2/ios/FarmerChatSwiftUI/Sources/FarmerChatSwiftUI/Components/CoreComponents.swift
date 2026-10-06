import SwiftUI
import FarmerChatCore

// MARK: - PrimaryButton (port of components/buttons/PrimaryButton.kt)

public enum PrimaryButtonState {
    case normal
    case chevron
    case loading
}

public struct FCPrimaryButton: View {
    @Environment(\.fcTheme) private var theme
    let title: String
    var state: PrimaryButtonState = .normal
    var enabled: Bool = true
    let action: () -> Void

    var height: CGFloat = 48

    public var body: some View {
        // Port of PrimaryButton.kt: the fill (buttonPrimarySurface = Green800)
        // NEVER dims — only the content (text/chevron) alpha drops to 0.5 when
        // disabled. Chevron uses buttonPrimaryAccent (Green500).
        let contentAlpha = enabled ? 1.0 : 0.5
        return Button(action: {
            guard enabled, state != .loading else { return }
            action()
        }) {
            HStack(spacing: 8) {
                Text(title)
                    .fcTextStyle(theme.typography.titleMedium)
                    .foregroundColor(theme.content.buttonPrimaryForeground.opacity(contentAlpha))
                if state == .chevron {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(theme.content.buttonPrimaryAccent.opacity(contentAlpha))
                } else if state == .loading {
                    ProgressView()
                        .tint(theme.content.buttonPrimaryAccent)
                        .padding(.leading, 4)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: height)
            .background(theme.content.buttonPrimarySurface)
            .clipShape(RoundedRectangle(cornerRadius: theme.shapes.button, style: .continuous))
        }
        // NOTE: intentionally NOT using .disabled() — SwiftUI dims the whole
        // button (fill included) when disabled, which would turn the dark
        // Green800 fill into a washed sage. Instead we gate hit-testing and
        // dim only the content alpha (above), matching PrimaryButton.kt.
        .allowsHitTesting(enabled && state != .loading)
        .buttonStyle(.plain)
    }
}

// MARK: - SecondaryButton

public struct FCSecondaryButton: View {
    @Environment(\.fcTheme) private var theme
    let title: String
    var destructive: Bool = false
    let action: () -> Void

    var height: CGFloat = 48

    public var body: some View {
        // Port of SecondaryButton.kt: filled surfaceSecondary, radius MD (12).
        Button(action: action) {
            Text(title)
                .fcTextStyle(theme.typography.titleMedium)
                .foregroundColor(destructive ? theme.brand.feedbackFail : theme.content.foregroundPrimary)
                .frame(maxWidth: .infinity)
                .frame(height: height)
                .background(theme.content.surfaceSecondary)
                .clipShape(RoundedRectangle(cornerRadius: theme.shapes.button, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Logo mark + spinner (port of LogoSpinner)

/// The FarmerChat logo mark — the 6-petal flower, faithfully ported from the
/// app's `logo_mark.xml` vector (12 petal paths on a 130×130 viewBox).
public struct FCLogoMarkShape: Shape {
    // Path data copied verbatim from res/drawable/logo_mark.xml.
    static let pathData: [String] = [
        "M32.56,0C50.54,0 65.12,14.59 65.12,32.59C47.14,32.59 32.56,18 32.56,0Z",
        "M97.56,0C79.58,0 65,14.59 65,32.59C82.98,32.59 97.56,18 97.56,0Z",
        "M32.68,65.06C14.7,65.06 0.12,50.47 0.12,32.47C18.1,32.47 32.68,47.06 32.68,65.06Z",
        "M65.12,32.47C47.14,32.47 32.56,47.06 32.56,65.06C50.54,65.06 65.12,50.47 65.12,32.47Z",
        "M65,32.47C82.98,32.47 97.56,47.06 97.56,65.06C79.58,65.06 65,50.47 65,32.47Z",
        "M97.44,65.06C115.42,65.06 130,50.47 130,32.47C112.02,32.47 97.44,47.06 97.44,65.06Z",
        "M32.56,64.94C14.58,64.94 0,79.53 0,97.53C17.98,97.53 32.56,82.94 32.56,64.94Z",
        "M32.56,64.94C50.54,64.94 65.12,79.53 65.12,97.53C47.14,97.53 32.56,82.94 32.56,64.94Z",
        "M97.56,64.94C79.58,64.94 65,79.53 65,97.53C82.98,97.53 97.56,82.94 97.56,64.94Z",
        "M97.44,64.94C115.42,64.94 130,79.53 130,97.53C112.02,97.53 97.44,82.94 97.44,64.94Z",
        "M65.12,97.41C47.14,97.41 32.56,112 32.56,130C50.54,130 65.12,115.41 65.12,97.41Z",
        "M65,97.41C82.98,97.41 97.56,112 97.56,130C79.58,130 65,115.41 65,97.41Z"
    ]

    public func path(in rect: CGRect) -> Path {
        let scale = min(rect.width, rect.height) / 130.0
        let dx = (rect.width - 130.0 * scale) / 2.0
        let dy = (rect.height - 130.0 * scale) / 2.0
        var path = Path()
        for data in Self.pathData {
            Self.appendSVGPath(data, into: &path)
        }
        return path.applying(CGAffineTransform(scaleX: scale, y: scale))
            .applying(CGAffineTransform(translationX: dx, y: dy))
    }

    /// Minimal SVG/Android path-data parser supporting absolute M, L, C and Z
    /// (the only commands used by logo_mark.xml).
    static func appendSVGPath(_ data: String, into path: inout Path) {
        var numbers: [CGFloat] = []
        var current = ""
        var command: Character?
        var start = CGPoint.zero
        var cursor = CGPoint.zero

        func flush() {
            if !current.isEmpty, let value = Double(current) {
                numbers.append(CGFloat(value))
            }
            current = ""
        }
        func run() {
            guard let cmd = command else { return }
            switch cmd {
            case "M":
                var i = 0
                while i + 1 < numbers.count {
                    let p = CGPoint(x: numbers[i], y: numbers[i + 1])
                    if i == 0 { path.move(to: p); start = p } else { path.addLine(to: p) }
                    cursor = p; i += 2
                }
            case "L":
                var i = 0
                while i + 1 < numbers.count {
                    let p = CGPoint(x: numbers[i], y: numbers[i + 1])
                    path.addLine(to: p); cursor = p; i += 2
                }
            case "C":
                var i = 0
                while i + 5 < numbers.count {
                    let c1 = CGPoint(x: numbers[i], y: numbers[i + 1])
                    let c2 = CGPoint(x: numbers[i + 2], y: numbers[i + 3])
                    let end = CGPoint(x: numbers[i + 4], y: numbers[i + 5])
                    path.addCurve(to: end, control1: c1, control2: c2)
                    cursor = end; i += 6
                }
            case "Z":
                path.closeSubpath(); cursor = start
            default:
                break
            }
            numbers.removeAll(keepingCapacity: true)
        }

        for ch in data {
            if ch.isLetter {
                flush(); run()
                command = ch
            } else if ch == "," || ch == " " {
                flush()
            } else if ch == "-" {
                flush(); current.append(ch)
            } else {
                current.append(ch)
            }
        }
        flush(); run()
        _ = cursor
    }
}

public struct FCLogoMark: View {
    var size: CGFloat = 48
    var tint: Color = .black
    var spinning: Bool = false
    @State private var rotation: Double = 0

    public var body: some View {
        FCLogoMarkShape()
            .fill(tint)
            .frame(width: size, height: size)
            .rotationEffect(.degrees(rotation))
            .onAppear {
                guard spinning else { return }
                withAnimation(.linear(duration: 1.4).repeatForever(autoreverses: false)) {
                    rotation = 360
                }
            }
    }
}

/// Port of `components/ShimmerText.kt`: text filled with a slow horizontal gradient sweep —
/// the "AI is thinking" treatment. The SDK had no equivalent, so the chat spinner's status
/// line was flat where android's shimmers.
///
/// (The two-tone "Soil data **received**" that shows up in android screenshots is this
/// shimmer caught mid-sweep, not two-colour text.)
public struct FCShimmerText: View {
    @Environment(\.fcTheme) private var theme
    let text: String
    var style: FCTextStyle?
    var baseColor: Color?
    var highlightColor: Color?
    var duration: Double = 1.2

    @State private var progress: CGFloat = 0

    public init(text: String,
                style: FCTextStyle? = nil,
                baseColor: Color? = nil,
                highlightColor: Color? = nil,
                duration: Double = 1.2) {
        self.text = text
        self.style = style
        self.baseColor = baseColor
        self.highlightColor = highlightColor
        self.duration = duration
    }

    public var body: some View {
        let resolvedStyle = style ?? theme.typography.bodyLarge
        let base = baseColor ?? theme.content.foregroundSecondary
        let highlight = highlightColor ?? theme.content.borderActive

        // Android disables the sweep on low-RAM devices. iOS has no `isLowRamDevice`; the
        // equivalent reason to drop a looping animation here is the accessibility setting
        // that asks for exactly that, so Reduce Motion takes its place.
        let animate = !UIAccessibility.isReduceMotionEnabled

        return Text(text)
            .fcTextStyle(resolvedStyle)
            .foregroundStyle(
                animate
                    ? AnyShapeStyle(LinearGradient(
                        stops: [
                            .init(color: base, location: 0.0),
                            .init(color: highlight, location: 0.35),
                            .init(color: highlight, location: 0.65),
                            .init(color: base, location: 1.0),
                        ],
                        // Android sweeps a band 1.2x the text width from just off the leading
                        // edge to just past the trailing one; expressed in unit space that is
                        // a centre travelling -0.6 -> 1.6, with the band spanning ±0.6.
                        startPoint: UnitPoint(x: bandCentre - 0.6, y: 0),
                        endPoint: UnitPoint(x: bandCentre + 0.6, y: 1)
                    ))
                    : AnyShapeStyle(base)
            )
            .onAppear {
                guard animate else { return }
                withAnimation(.linear(duration: duration).repeatForever(autoreverses: false)) {
                    progress = 1
                }
            }
    }

    private var bandCentre: CGFloat { -0.6 + progress * 2.2 }
}

public struct FCLogoSpinner: View {
    @Environment(\.fcTheme) private var theme
    let message: String
    var vertical: Bool = true

    public var body: some View {
        Group {
            if vertical {
                // App parity (LogoSpinner.kt:88): 12dp, not 16.
                VStack(spacing: 12) { spinnerContent }
            } else {
                HStack(spacing: 12) { spinnerContent }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @State private var spin = false

    @ViewBuilder private var spinnerContent: some View {
        // Port of LogoSpinner.kt: a Green500 progress ring with the static Green500 flower
        // mark centred inside it. Geometry per LogoSpinner.kt:90/101 — 55/32/3 vertical,
        // 40/23/2.5 horizontal. The stroke was 3 for both.
        ZStack {
            Circle()
                .trim(from: 0, to: 0.75)
                .stroke(
                    FCPrimitive.green500,
                    style: StrokeStyle(lineWidth: vertical ? 3 : 2.5, lineCap: .round)
                )
                .frame(width: vertical ? 55 : 40, height: vertical ? 55 : 40)
                .rotationEffect(.degrees(spin ? 360 : 0))
                .onAppear {
                    withAnimation(.linear(duration: 1.0).repeatForever(autoreverses: false)) {
                        spin = true
                    }
                }
            FCLogoMark(size: vertical ? 32 : 23, tint: FCPrimitive.green500)
        }

        // App parity (LogoSpinner.kt:143-160): the HORIZONTAL spinner shimmers its label, the
        // vertical one does not — the app splits these into two components (`LogoSpinner.kt`
        // uses a plain Text, `LogoSpinnerHorizontal.kt` uses ShimmerText). Both are
        // `labelMedium`; the shimmer is the only difference, NOT the weight. This label was
        // `labelLarge` because `LogoSpinner.kt:249` uses that — but :249 belongs to
        // `LogoSpinnerVertical`, the separate full-screen loader with its own error state.
        if vertical {
            Text(message)
                .fcTextStyle(theme.typography.labelMedium)
                .foregroundColor(theme.content.foregroundPrimary)
                .multilineTextAlignment(.center)
        } else {
            FCShimmerText(
                text: message,
                style: theme.typography.labelMedium,
                baseColor: theme.content.foregroundPrimary
            )
        }
    }
}

// MARK: - Toast (port of components/Toast.kt)

public enum FCToastKind {
    case info, success, error, loading
}

public struct FCToastData: Equatable, Identifiable {
    public let id = UUID()
    public var kind: FCToastKind
    public var message: String

    public static func == (lhs: FCToastData, rhs: FCToastData) -> Bool { lhs.id == rhs.id }
}

@MainActor
public final class FCToastState: ObservableObject {
    @Published public var current: FCToastData?
    private var dismissTask: Task<Void, Never>?

    public init() {}

    public func show(_ kind: FCToastKind, _ message: String, duration: TimeInterval = 2.5) {
        dismissTask?.cancel()
        current = FCToastData(kind: kind, message: message)
        dismissTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))
            guard !Task.isCancelled else { return }
            self?.current = nil
        }
    }

    public func dismiss() {
        dismissTask?.cancel()
        current = nil
    }
}

public struct FCToastView: View {
    @Environment(\.fcTheme) private var theme
    let toast: FCToastData

    public var body: some View {
        HStack(spacing: 10) {
            switch toast.kind {
            case .loading:
                ProgressView().tint(theme.content.foregroundPrimary)
            case .success:
                Image(systemName: "checkmark.circle.fill").foregroundColor(FCPrimitive.green500)
            case .error:
                Image(systemName: "exclamationmark.triangle.fill").foregroundColor(FCPrimitive.red500)
            case .info:
                Image(systemName: "info.circle.fill").foregroundColor(theme.content.foregroundSecondary)
            }
            Text(toast.message)
                .fcTextStyle(theme.typography.bodySmall)
                .foregroundColor(theme.content.foregroundPrimary)
                .lineLimit(3)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(theme.content.surfaceSecondary)
        .clipShape(Capsule())
        .shadow(color: .black.opacity(0.18), radius: 12, y: 4)
        .padding(.horizontal, 24)
        .transition(.move(edge: .bottom).combined(with: .opacity))
    }
}

extension View {
    public func fcToastHost(_ state: FCToastState) -> some View {
        overlay(alignment: .bottom) {
            if let toast = state.current {
                FCToastView(toast: toast)
                    .padding(.bottom, 32)
                    .animation(.spring(duration: 0.3), value: state.current)
            }
        }
    }
}

// MARK: - Radio row (port of components/form/RadioButton.kt)

public struct FCRadioRow: View {
    @Environment(\.fcTheme) private var theme
    let title: String
    var subtitle: String?
    var selected: Bool
    var loading: Bool = false
    let action: () -> Void

    public var body: some View {
        // Port of RadioButton.kt: full-width card, white (surfaceSecondary) by
        // default, translucent-green (surfaceActive) when selected. The radio
        // is a filled circle — gray (surfaceTertiary) unselected, a white ring
        // with a green (borderActive) dot when selected.
        let bg = selected ? theme.content.surfaceActive : theme.content.surfaceSecondary
        return Button(action: action) {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(theme.content.surfaceSecondary)
                        .frame(width: 20, height: 20)
                    Circle()
                        .fill(selected ? theme.content.borderActive : theme.content.surfaceTertiary)
                        .frame(width: selected ? 10 : 20, height: selected ? 10 : 20)
                }
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .fcTextStyle(theme.typography.bodyMedium)
                        .foregroundColor(theme.content.foregroundPrimary)
                        .lineLimit(1)
                    if let subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .fcTextStyle(theme.typography.bodySmall)
                            .foregroundColor(theme.content.foregroundSecondary)
                    }
                }
                Spacer(minLength: 0)
                if loading {
                    ProgressView().tint(theme.content.borderActive)
                }
            }
            .padding(.vertical, 14)
            .padding(.horizontal, 16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(bg)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Text input (port of components/form/TextInput.kt)

public struct FCTextField: View {
    @Environment(\.fcTheme) private var theme
    let placeholder: String
    @Binding var text: String
    var keyboard: UIKeyboardType = .default
    var contentType: UITextContentType?
    var autoFocus: Bool = false
    @FocusState private var focused: Bool

    public var body: some View {
        TextField(placeholder, text: $text)
            .keyboardType(keyboard)
            .textContentType(contentType)
            .focused($focused)
            .fcTextStyle(theme.typography.bodyLarge)
            .foregroundColor(theme.content.foregroundPrimary)
            .padding(.horizontal, 16)
            .frame(height: 56)
            .background(theme.content.surfaceSecondary)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(focused ? theme.content.borderActive : theme.content.borderDefault, lineWidth: focused ? 2 : 1)
            )
            .onAppear {
                if autoFocus {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                        focused = true
                    }
                }
            }
    }
}

// MARK: - OTP input (port of components/form/OtpInput.kt, .oneTimeCode autofill)

public struct FCOtpInput: View {
    @Environment(\.fcTheme) private var theme
    @Binding var otp: String
    var length: Int = 4
    @FocusState private var focused: Bool

    public var body: some View {
        ZStack {
            TextField("", text: $otp)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .focused($focused)
                .opacity(0.011) // keep interactive but invisible
                .frame(width: 1, height: 1)

            HStack(spacing: 8) {
                ForEach(0..<length, id: \.self) { index in
                    let character = digit(at: index)
                    Text(character)
                        .font(.system(size: 24, weight: .semibold, design: .monospaced))
                        .foregroundColor(theme.content.foregroundPrimary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 64)
                        .background(theme.content.surfaceSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(
                                    index == otp.count && focused ? theme.content.borderActive : theme.content.borderDefault,
                                    lineWidth: index == otp.count && focused ? 2 : 1
                                )
                        )
                }
            }
            .contentShape(Rectangle())
            .onTapGesture { focused = true }
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { focused = true }
        }
    }

    private func digit(at index: Int) -> String {
        guard index < otp.count else { return "" }
        let stringIndex = otp.index(otp.startIndex, offsetBy: index)
        return String(otp[stringIndex])
    }
}

// MARK: - App bars

public struct FCAppBar: View {
    public enum LeadingIcon {
        case menu, back, close, none
    }

    @Environment(\.fcTheme) private var theme
    let title: String
    var leading: LeadingIcon = .none
    var onLeadingTap: (() -> Void)?
    var trailing: AnyView?

    public var body: some View {
        HStack(spacing: 12) {
            if leading != .none {
                Button(action: { onLeadingTap?() }) {
                    Image(systemName: leadingSymbol)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(theme.content.foregroundPrimary)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            Text(title)
                .fcTextStyle(theme.typography.titleMedium)
                .foregroundColor(theme.content.foregroundPrimary)
                .lineLimit(1)
            Spacer()
            if let trailing {
                trailing
            }
        }
        .padding(.horizontal, 8)
        .frame(height: 56)
    }

    private var leadingSymbol: String {
        switch leading {
        case .menu: return "line.3.horizontal"
        case .back: return "chevron.left"
        case .close: return "xmark"
        case .none: return ""
        }
    }
}

// MARK: - List card / item (port of components/list/)

public struct FCListCard<Content: View>: View {
    @Environment(\.fcTheme) private var theme
    var title: String?
    @ViewBuilder let content: () -> Content

    public var body: some View {
        // App parity (Lists.kt:47-54): Radius.MD (12pt, not 18) and the card owns the
        // 16pt horizontal inset plus a 6/4 top/bottom — the rows inside add none.
        VStack(alignment: .leading, spacing: 0) {
            if let title, !title.isEmpty {
                Text(title)
                    .fcTextStyle(theme.typography.labelLarge)
                    .foregroundColor(theme.content.foregroundSecondary)
                    .padding(.top, 8)
                    .padding(.bottom, 6)
            }
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.top, 6)
        .padding(.bottom, 4)
        .background(theme.content.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

public struct FCListItem: View {
    @Environment(\.fcTheme) private var theme
    let icon: String
    let title: String
    var subtitle: String?
    var showChevron: Bool = true
    let action: () -> Void

    public var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(theme.content.foregroundSecondary)
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .fcTextStyle(theme.typography.bodyMedium)
                        .foregroundColor(theme.content.foregroundPrimary)
                        .multilineTextAlignment(.leading)
                    if let subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .fcTextStyle(theme.typography.bodySmall)
                            .foregroundColor(theme.content.foregroundSecondary)
                    }
                }
                Spacer()
                if showChevron {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(theme.content.foregroundTertiary)
                }
            }
            // App parity (Lists.kt:81-89): a FIXED 48pt row when the row is single-line,
            // 12pt vertical padding only when it wraps — and no horizontal padding, which
            // the enclosing ListCard provides. iOS had a uniform 13pt vertical inset inside
            // its own 16pt horizontal one, so rows drifted taller than 48 and the text sat
            // 32pt from the card edge instead of 16.
            .modifier(FCListRowMetrics(isMultiline: !(subtitle ?? "").isEmpty))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// The row's height rule, kept as a modifier so the single-line and wrapping cases stay
/// side by side rather than duplicated down two branches of the view body.
private struct FCListRowMetrics: ViewModifier {
    let isMultiline: Bool

    func body(content: Content) -> some View {
        if isMultiline {
            content.padding(.vertical, 12)
        } else {
            content.frame(height: 48)
        }
    }
}

// MARK: - Skeleton shimmer

public struct FCSkeletonRow: View {
    @Environment(\.fcTheme) private var theme
    @State private var pulse = false

    public var body: some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(theme.content.shimmer)
            .frame(height: 18)
            .opacity(pulse ? 0.45 : 1)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) {
                    pulse = true
                }
            }
    }
}
