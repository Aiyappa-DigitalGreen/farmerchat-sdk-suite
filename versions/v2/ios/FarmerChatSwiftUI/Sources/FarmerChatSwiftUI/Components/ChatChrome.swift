import SwiftUI
import FarmerChatCore

// Chat chrome ported from the app (fc-compose-agentic dev/v2.5): the green LogoAppBar with its
// yellow bloom, the floating InputComposer with its shimmer placeholder and breathing aura, and
// the answer-generation Tips carousel. SwiftUI technique follows the FarmerChat iOS app
// (FarmerChat-iOS-Agentic-v2.3 AppBars.swift / InputComposer.swift); values follow the app.

// MARK: - App bar (components/appbars/LogoAppBar.kt)

/// LogoAppBar.kt:53-70: a solid brand-green bar `64 + status inset` tall, with the 80dp
/// `glow_yellow.png` drawn top-aligned across the full width. The PNG is not bundled (the package
/// ships no image resources, and the binary xcframework path would have to carry it); its bloom
/// is drawn instead from the sampled alpha: Sun300 #F9FF47, an ellipse centred on the top edge
/// with semi-axes (width / 2, 80), alpha 50% at the centre falling linearly to 0 at its rim —
/// ≈37% / 25% / 12% at 25 / 50 / 75% height on the centre column and ≈12% at the top at
/// x = 100/804, as the PNG sample in the reference checklist reads.
struct FCChatGlow: View {
    var height: CGFloat = 80

    var body: some View {
        Canvas { context, size in
            guard size.width > 0 else { return }
            let semiX = size.width / 2
            // Squash a circle of radius `height` into the (semiX, height) ellipse.
            context.scaleBy(x: semiX / height, y: 1)
            let centre = CGPoint(x: height, y: 0)
            context.fill(
                Path(CGRect(x: 0, y: 0, width: height * 2, height: height)),
                with: .radialGradient(
                    Gradient(stops: [
                        .init(color: FCPrimitive.sun300.opacity(0.5), location: 0),
                        .init(color: FCPrimitive.sun300.opacity(0), location: 1)
                    ]),
                    center: centre,
                    startRadius: 0,
                    endRadius: height
                )
            )
        }
        .frame(height: height)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

/// ActionButton.kt as LogoAppBar uses it: a 42×42 radius-12 (Radius.MD, smooth) square on
/// brand.surfaceSecondary #08361B holding a white 23pt icon.
struct FCAppBarTile: View {
    @Environment(\.fcTheme) private var theme
    let symbol: String
    let label: String
    var identifier: String? = nil
    /// Draw [FCHistoryGlyph] (the Material "history" vector, 23pt like Android's 42dp tile with
    /// 9.5dp padding) instead of the SF Symbol. Used by the chat-header history button only.
    var historyGlyph: Bool = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if historyGlyph {
                    FCHistoryGlyph().fill(theme.brand.foregroundPrimary)
                } else {
                    Image(systemName: symbol)
                        .font(.system(size: 19, weight: .semibold))
                }
            }
                .frame(width: 23, height: 23)
                .foregroundColor(theme.brand.foregroundPrimary)
                .frame(width: 42, height: 42)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(theme.brand.surfaceSecondary)
                )
                .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier(identifier ?? "")
    }
}

/// The chat app bar: green + bloom, a 42pt left control, the centred white 36pt mark that fades in
/// (600ms EaseOut) only once an answer is showing and out (300ms) while one is pending, and the
/// SDK's right-side tiles.
struct FCChatAppBar<Leading: View, Trailing: View>: View {
    @Environment(\.fcTheme) private var theme
    let showLogo: Bool
    @ViewBuilder let leading: () -> Leading
    @ViewBuilder let trailing: () -> Trailing

    @State private var logoOpacity: Double = 0

    var body: some View {
        ZStack {
            HStack(spacing: 0) {
                leading()
                Spacer(minLength: 8)
                trailing()
            }
            FCLogoMark(size: 36, tint: theme.brand.foregroundPrimary)
                .opacity(logoOpacity)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, 16)
        .frame(height: 64)
        .frame(maxWidth: .infinity)
        // The green bleeds up behind the status bar while the controls stay in the safe area.
        // The 80pt glow is aligned to the SCREEN top, so its brightest band sits behind the
        // status bar exactly as on Android (the bar there is `64.dp + topInset` tall).
        .background(alignment: .top) {
            ZStack(alignment: .top) {
                theme.brand.surfacePrimary
                FCChatGlow(height: 80)
            }
            .ignoresSafeArea(edges: .top)
        }
        .onAppear { logoOpacity = showLogo ? 1 : 0 }
        .onChange(of: showLogo) { visible in
            withAnimation(.easeOut(duration: visible ? 0.6 : 0.3)) { logoOpacity = visible ? 1 : 0 }
        }
    }
}

// MARK: - Floating composer (components/userinput/InputComposer.kt)

/// Measured height of the floating composer (sheet + its bottom gap), so the thread can reserve
/// exactly that much space and the scroll indicator can sit 16 above it.
struct FCComposerHeightKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}

/// Material `Icons.AutoMirrored.Filled.Send` (24×24 viewBox: M2.01,21 L23,12 2.01,3 2,10 l15,2
/// -15,2z) — what the app's `icon_send` draws.
struct FCSendGlyph: Shape {
    func path(in rect: CGRect) -> Path {
        let s = min(rect.width, rect.height) / 24
        let ox = rect.minX + (rect.width - 24 * s) / 2
        let oy = rect.minY + (rect.height - 24 * s) / 2
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: ox + x * s, y: oy + y * s) }
        var path = Path()
        path.move(to: p(2.01, 21))
        path.addLine(to: p(23, 12))
        path.addLine(to: p(2.01, 3))
        path.addLine(to: p(2, 10))
        path.addLine(to: p(17, 12))
        path.addLine(to: p(2, 14))
        path.closeSubpath()
        return path
    }
}

/// The app's chat composer: `InputComposer(floating = true, isAnchored = true, compact = true,
/// showAura = true)` on a brand-green sheet (ChatInputOverlays.kt:64-77).
///
/// - Sheet: brand green, radius 24 (smooth), 10 side margins, inner padding 10h / 12 top / 12
///   bottom at rest (10 / 10 while focused — `compact` only applies while typing), above a
///   full-width white wrapper; gap below = max(nav inset, 20), or 4 above the keyboard.
/// - Row (6 apart, bottom-aligned): camera | field | mic-or-send. Circles are 48 (42 focused) on
///   #08361B with a #00C950 22pt (20 focused) glyph, light palette forced. Camera hides once text
///   is typed.
/// - Field: white, radius 16, min 48, 14 side padding, bodyMedium black, 1-3 lines. Placeholder
///   is black while idle and #71717B once active (220ms), with the 2250ms green shimmer sweep while
///   unfocused, and the rotating sweep-gradient aura (7s/turn) that breathes while idle.
/// - `visible == false` slides the whole composer 400 down over a 300ms FastOutSlowIn tween.
struct FCChatComposer: View {
    @Environment(\.fcTheme) private var theme
    @Binding var text: String
    let placeholder: String
    var showCamera: Bool = true
    var showMic: Bool = true
    var visible: Bool = true
    @Binding var focusRequest: Bool
    var onFocusChange: (Bool) -> Void = { _ in }
    let onSend: (String) -> Void
    let onCamera: () -> Void
    let onMic: () -> Void

    @FocusState private var isFocused: Bool
    @State private var auraRotation: Double = 0
    @State private var auraIntensity: Double = 0.8
    @State private var previousText: String = ""

    private static let auraColors: [UInt32] = [0x00C950, 0x22D3EE, 0x00C950, 0xFFF947, 0x00C950]
    /// The circles always use the LIGHT content palette (InputComposer.kt:687-731).
    private static let circleSurface = FCPrimitive.green800
    private static let circleAccent = FCPrimitive.green500

    private var isBlank: Bool { text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    private var isActive: Bool { isFocused || !isBlank }
    private var compact: Bool { isFocused }
    private var buttonSize: CGFloat { compact ? 42 : 48 }
    private var iconSize: CGFloat { compact ? 20 : 22 }

    var body: some View {
        sheet
            .padding(.horizontal, 10)
            .padding(.bottom, isFocused ? 4 : max(0, 20 - FCWindowSafeArea.bottom))
            .frame(maxWidth: .infinity)
            .background(
                theme.content.surfaceReadingPrimary
                    .ignoresSafeArea(edges: .bottom)
            )
            .background(
                GeometryReader { proxy in
                    Color.clear.preference(key: FCComposerHeightKey.self, value: proxy.size.height)
                }
            )
            .offset(y: visible ? 0 : 400)
            .animation(.timingCurve(0.4, 0, 0.2, 1, duration: 0.3), value: visible)
            .allowsHitTesting(visible)
            .onChange(of: isFocused) { onFocusChange($0) }
            .onChange(of: focusRequest) { requested in
                guard requested else { return }
                isFocused = true
                focusRequest = false
            }
            .onAppear {
                if focusRequest {
                    isFocused = true
                    focusRequest = false
                }
                startAuraRotation()
            }
            .task { await breathe() }
    }

    private var sheet: some View {
        HStack(alignment: .bottom, spacing: 6) {
            if showCamera && isBlank {
                circleButton(label: "Camera", identifier: "fcComposerCamera", action: {
                    isFocused = false
                    onCamera()
                }) {
                    Image(systemName: "camera.fill")
                        .font(.system(size: iconSize * 0.82, weight: .semibold))
                }
            }

            field

            if !isBlank {
                circleButton(label: "Send", identifier: "fcComposerSend", action: send) {
                    FCSendGlyph().frame(width: iconSize, height: iconSize)
                }
            } else if showMic {
                circleButton(label: "Voice", identifier: "fcComposerMic", action: {
                    isFocused = false
                    onMic()
                }) {
                    Image(systemName: "mic.fill")
                        .font(.system(size: iconSize * 0.86, weight: .semibold))
                }
            }
        }
        .padding(.horizontal, 10)
        .padding(.top, compact ? 10 : 12)
        .padding(.bottom, compact ? 10 : 12)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(theme.brand.surfacePrimary)
        )
        .animation(.easeInOut(duration: 0.25), value: compact)
        .animation(.easeInOut(duration: 0.2), value: isBlank)
    }

    private func send() {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        isFocused = false
        text = ""
        onSend(trimmed)
    }

    private var field: some View {
        ZStack(alignment: .leading) {
            if text.isEmpty {
                FCShimmerText(
                    text: placeholder,
                    style: theme.typography.bodyMedium,
                    baseColor: isActive ? theme.content.formPlaceholder : theme.content.foregroundPrimary,
                    highlightColor: FCPrimitive.green500,
                    duration: 2.25,
                    enabled: !isFocused,
                    lineLimit: 1
                )
                .id(isFocused)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
            }
            TextField("", text: $text, axis: .vertical)
                .lineLimit(1...3)
                .focused($isFocused)
                // `.font` rather than `.fcTextStyle`: a vertical TextField sizes its lines from the
                // natural line height and clips the third line when `.lineSpacing` is added (the
                // iOS app's InputComposer documents the same trap).
                .font(theme.typography.bodyMedium.font)
                .foregroundColor(theme.content.foregroundPrimary)
                .tint(theme.content.foregroundPrimary)
                .submitLabel(.done)
                .accessibilityLabel(placeholder)
                .accessibilityIdentifier("fcComposerField")
                // InputComposer.kt:645-654 `ImeAction.Done` + `onDone`: Return never inserts a
                // newline and never sends — it clears focus. A vertical TextField inserts "\n" on
                // Return, so a single typed newline is undone and treated as Done.
                .onChange(of: text) { new in
                    defer { previousText = text }
                    guard new.count == previousText.count + 1,
                          new.filter({ $0 == "\n" }).count == previousText.filter({ $0 == "\n" }).count + 1
                    else { return }
                    text = previousText
                    isFocused = false
                }
        }
        .frame(minHeight: 24)
        .padding(.horizontal, 14)
        .frame(minHeight: buttonSize)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(isActive ? theme.content.surfaceReadingTertiary : theme.content.surfaceSecondary)
        )
        .animation(.easeInOut(duration: 0.22), value: isActive)
        .overlay { aura }
        .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .onTapGesture { isFocused = true }
    }

    // MARK: Aura

    /// Three strokes of one rotating sweep gradient — halo / mid / core — inside the field
    /// outline (Compose strokes the edge centred at 10.8 / 7.2 / 4.8 and clips, so the inner
    /// halves show: 5.4 / 3.6 / 2.4) at 16% / 30% / 100% of the breathing intensity.
    @ViewBuilder
    private var aura: some View {
        if !isFocused && isBlank && !UIAccessibility.isReduceMotionEnabled {
            let gradient = AngularGradient(stops: auraStops(rotation: auraRotation), center: .center)
            let shape = RoundedRectangle(cornerRadius: 16, style: .continuous)
            ZStack {
                shape.strokeBorder(gradient, lineWidth: 5.4).opacity(auraIntensity * 0.16)
                shape.strokeBorder(gradient, lineWidth: 3.6).opacity(auraIntensity * 0.30)
                shape.strokeBorder(gradient, lineWidth: 2.4).opacity(auraIntensity)
            }
            .allowsHitTesting(false)
            .transition(.opacity)
        }
    }

    private func auraStops(rotation: Double) -> [Gradient.Stop] {
        let steps = 18
        return (0...steps).map { index in
            let position = Double(index) / Double(steps)
            var shifted = (position - rotation).truncatingRemainder(dividingBy: 1)
            if shifted < 0 { shifted += 1 }
            return Gradient.Stop(color: Self.auraColor(at: shifted), location: position)
        }
    }

    /// `lerp(AuraColors[i], AuraColors[i+1], f)` — Compose interpolates in Oklab.
    private static func auraColor(at t: Double) -> Color {
        let segment = min(max(t, 0), 1) * Double(auraColors.count - 1)
        let index = min(max(Int(segment), 0), auraColors.count - 2)
        let f = segment - Double(index)
        let a = oklab(auraColors[index]), b = oklab(auraColors[index + 1])
        let lab = zip(a, b).map { $0 + ($1 - $0) * f }
        let rgb = srgb(fromOklab: lab)
        return Color(red: rgb[0], green: rgb[1], blue: rgb[2])
    }

    private static func oklab(_ value: UInt32) -> [Double] {
        func linear(_ shift: UInt32) -> Double {
            let c = Double((value >> shift) & 0xFF) / 255
            return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
        }
        let r = linear(16), g = linear(8), b = linear(0)
        let l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
        let m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
        let s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
        return [
            0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
        ]
    }

    private static func srgb(fromOklab lab: [Double]) -> [Double] {
        let l = pow(lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2], 3)
        let m = pow(lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2], 3)
        let s = pow(lab[0] - 0.0894841775 * lab[1] - 1.2914855480 * lab[2], 3)
        let linear = [
            4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
        ]
        return linear.map { c in
            let v = c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1 / 2.4) - 0.055
            return min(max(v, 0), 1)
        }
    }

    private func startAuraRotation() {
        guard auraRotation == 0, !UIAccessibility.isReduceMotionEnabled else { return }
        withAnimation(.linear(duration: 7).repeatForever(autoreverses: false)) { auraRotation = 1 }
    }

    /// InputComposer.kt:373-386: start at 0.8; 1.0↔0.5 (2400ms EaseInOut) ×2, ebb to 0.04
    /// (2800ms), swell to 1.0 (2600ms), repeat.
    private func breathe() async {
        guard !UIAccessibility.isReduceMotionEnabled else { return }
        while !Task.isCancelled {
            for _ in 0..<2 {
                await animateIntensity(to: 1.0, duration: 2.4)
                await animateIntensity(to: 0.5, duration: 2.4)
            }
            await animateIntensity(to: 0.04, duration: 2.8)
            await animateIntensity(to: 1.0, duration: 2.6)
        }
    }

    private func animateIntensity(to value: Double, duration: Double) async {
        guard !Task.isCancelled else { return }
        withAnimation(.easeInOut(duration: duration)) { auraIntensity = value }
        try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))
    }

    private func circleButton<Glyph: View>(
        label: String,
        identifier: String,
        action: @escaping () -> Void,
        @ViewBuilder glyph: () -> Glyph
    ) -> some View {
        Button(action: action) {
            glyph()
                .foregroundColor(Self.circleAccent)
                .frame(width: iconSize, height: iconSize)
                .frame(width: buttonSize, height: buttonSize)
                .background(Circle().fill(Self.circleSurface))
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityIdentifier(identifier)
    }
}

/// The key window's bottom safe-area inset (the home-indicator area), for the composer's
/// `max(navInset, 20)` gap — the composer itself lives inside the safe area.
@MainActor
enum FCWindowSafeArea {
    static var bottom: CGFloat {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let window = scenes.flatMap(\.windows).first { $0.isKeyWindow } ?? scenes.first?.windows.first
        return window?.safeAreaInsets.bottom ?? 0
    }
}

// MARK: - Tips carousel (components/Tips.kt + Tip.kt)

/// Tips.kt (`components/Tips.kt`), shown for the whole answer-generation wait
/// (ChatThreadContent.kt:676-685): a 24pt fade into the page background, then a page-coloured band
/// (44 bottom padding) holding a pager — content padding 24, page gap 8, so the neighbouring cards
/// peek in on BOTH sides — that auto-advances every 8000ms with a 400ms slide, forever forward
/// (the app's 10 000-page virtual pager starts mid-range), not user-scrollable
/// (`userScrollEnabled = false`); 14, then the dots.
///
/// The tip set is the server's (`LabelManager.answerGenerationTips()`, port of
/// ChatLoadingContent.kt `answerGenerationTips()`), shuffled once per show as `Tips.kt` does.
/// Not ported: the haptic tick and the lightbulb's attention wobble after each advance.
struct FCTipsCarousel: View {
    @Environment(\.fcTheme) private var theme

    @State private var tips: [AnswerGenerationTip]
    /// Virtual page, only ever increasing; the shown tip is `page % tips.count`.
    @State private var page = 0
    /// Horizontal slide of the card strip while advancing (0 at rest, -step at the end).
    @State private var slide: CGFloat = 0
    @State private var progress: CGFloat = 0
    @State private var cardHeight: CGFloat = 104

    private static let tipDuration: Double = 8
    private static let slideDuration: Double = 0.4

    init() {
        _tips = State(initialValue: FarmerChat.shared.labels.answerGenerationTips().shuffled())
    }

    var body: some View {
        VStack(spacing: 0) {
            LinearGradient(
                colors: [theme.content.surfaceReadingPrimary.opacity(0), theme.content.surfaceReadingPrimary],
                startPoint: .top, endPoint: .bottom
            )
            .frame(height: 24)
            VStack(spacing: 14) {
                pager
                dots
            }
            .padding(.bottom, 44)
            .frame(maxWidth: .infinity)
            .background(theme.content.surfaceReadingPrimary.ignoresSafeArea(edges: .bottom))
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("fcTips")
        .task { await cycle() }
    }

    /// Tips.kt's LaunchedEffect loop: fill the 8s timer, slide one page, repeat.
    private func cycle() async {
        guard !tips.isEmpty else { return }
        while !Task.isCancelled {
            var reset = Transaction()
            reset.disablesAnimations = true
            withTransaction(reset) { progress = 0 }
            withAnimation(.linear(duration: Self.tipDuration)) { progress = 1 }
            try? await Task.sleep(nanoseconds: UInt64(Self.tipDuration * 1_000_000_000))
            guard !Task.isCancelled else { return }
            withAnimation(.easeInOut(duration: Self.slideDuration)) { slide = -1 }
            try? await Task.sleep(nanoseconds: UInt64(Self.slideDuration * 1_000_000_000))
            guard !Task.isCancelled else { return }
            // Re-centre on the next page without animation, so the loop never runs out.
            withTransaction(reset) {
                page += 1
                slide = 0
                progress = 0
            }
        }
    }

    private func tip(at offset: Int) -> AnswerGenerationTip {
        let n = tips.count
        return tips[((page + offset) % n + n) % n]
    }

    private var pager: some View {
        GeometryReader { geo in
            let cardWidth = max(0, geo.size.width - 48)
            let step = cardWidth + 8
            // prev | current | next | next+1 — the strip is offset so `current` sits at x = 24.
            HStack(alignment: .bottom, spacing: 8) {
                ForEach(-1..<3, id: \.self) { offset in
                    let t = tip(at: offset)
                    FCTipCard(title: t.title, text: t.body)
                        .frame(width: cardWidth)
                        .background(GeometryReader { card in
                            Color.clear.preference(key: FCTipCardHeightKey.self, value: card.size.height)
                        })
                }
            }
            .offset(x: 24 - step + slide * step)
        }
        .frame(height: cardHeight)
        .onPreferenceChange(FCTipCardHeightKey.self) { cardHeight = max(104, $0) }
        .allowsHitTesting(false)
    }

    /// Tips.kt:176-210: 8pt dots 10 apart; the active one is a 24×8 track that fills with
    /// feedbackSuccess as the 8s timer runs.
    private var dots: some View {
        let current = tips.isEmpty ? 0 : page % tips.count
        return HStack(spacing: 10) {
            ForEach(0..<tips.count, id: \.self) { index in
                let active = index == current
                Capsule()
                    .fill(FCPrimitive.green500Alpha16)
                    .frame(width: active ? 24 : 8, height: 8)
                    .overlay(alignment: .leading) {
                        if active {
                            Capsule()
                                .fill(FCPrimitive.green500)
                                .frame(width: 24 * progress, height: 8)
                        }
                    }
                    .clipShape(Capsule())
            }
        }
        .accessibilityHidden(true)
    }
}

/// Tallest tip card in the strip — the pager is as tall as its tallest page (HorizontalPager).
private struct FCTipCardHeightKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) { value = max(value, nextValue()) }
}

/// Tip.kt:64-107: min height 104, radius 16, #08361B, padding 20h / 16v; a 36pt #00C950 disc with
/// a white 18pt lightbulb, 12, then the title (labelLarge white), 6, the body (bodySmall white).
struct FCTipCard: View {
    @Environment(\.fcTheme) private var theme
    let title: String
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "lightbulb")
                .font(.system(size: 16, weight: .semibold))
                .frame(width: 18, height: 18)
                .foregroundColor(.white)
                .frame(width: 36, height: 36)
                .background(Circle().fill(FCPrimitive.green500))
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .fcTextStyle(theme.typography.labelLarge)
                    .foregroundColor(.white)
                Text(text)
                    .fcTextStyle(theme.typography.bodySmall)
                    .foregroundColor(.white)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        // Tip.kt: heightIn(min = 104), Row verticalAlignment = Top — icon + title anchor to the top.
        .frame(minHeight: 104, alignment: .top)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(FCPrimitive.green800)
        )
    }
}
