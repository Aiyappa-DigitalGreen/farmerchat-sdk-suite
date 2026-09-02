import SwiftUI
import FarmerChatCore

// MARK: - Markdown text (port of components/MarkdownText.kt)

public struct FCMarkdownText: View {
    @Environment(\.fcTheme) private var theme
    let text: String

    public var body: some View {
        if let attributed = try? AttributedString(
            markdown: text,
            options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        ) {
            Text(attributed)
                .font(.system(size: 16))
                .foregroundColor(theme.content.foregroundPrimary)
                .fixedSize(horizontal: false, vertical: true)
        } else {
            Text(text)
                .font(.system(size: 16))
                .foregroundColor(theme.content.foregroundPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Client-side "typewriter" answer reveal (port of AiAnswer.kt AiAnswerBlock)
//
// HONESTY NOTE: on the 1.0.0 path the FarmerChat backend returns the whole
// answer in ONE synchronous JSON response (docs/02 — #27 is NOT streamed).
// This reveal is a purely cosmetic view-layer animation that re-renders a
// growing prefix of the already-received markdown. It never touches the
// ViewModel, network, or ChatState. History and pre-generated answers pass
// `animate: false` and render in full immediately.
//
// 2.0.0: an agentic answer (#27a) arrives a token at a time and is therefore
// rendered with `animate: false` — the text is already typing itself, and
// animating it again would double-type it.

/// Splits into "word + trailing whitespace" chunks so newlines / markdown
/// survive a prefix cut (mirrors the Android regex `\S+\s*`).
private func fcRevealChunks(_ text: String) -> [String] {
    guard let regex = try? NSRegularExpression(pattern: "\\S+\\s*") else { return [text] }
    let ns = text as NSString
    let matches = regex.matches(in: text, range: NSRange(location: 0, length: ns.length))
    let chunks = matches.map { ns.substring(with: $0.range) }
    return chunks.isEmpty ? [text] : chunks
}

public struct FCAiAnswerText: View {
    @Environment(\.fcTheme) private var theme
    let text: String
    let animate: Bool
    var color: Color?
    let onRevealComplete: () -> Void

    @State private var revealed: Int = 0
    @State private var finished: Bool = false
    @State private var caretOn: Bool = true

    public init(text: String, animate: Bool, color: Color? = nil, onRevealComplete: @escaping () -> Void = {}) {
        self.text = text
        self.animate = animate
        self.color = color
        self.onRevealComplete = onRevealComplete
    }

    public var body: some View {
        let chunks = fcRevealChunks(text)
        let total = chunks.count
        // Show full text unless we are actively revealing an animated answer.
        let showFull = finished || !animate
        let display: String = {
            if showFull { return text }
            let prefix = chunks.prefix(revealed).joined().trimmingCharacters(in: .whitespacesAndNewlines)
            return prefix + (caretOn ? " \u{258C}" : "")   // ▌ caret glyph, blinks
        }()

        FCMarkdownTextColored(text: display, color: color ?? theme.content.foregroundPrimary)
            .contentShape(Rectangle())
            .onTapGesture {
                // Tap anywhere on the answer to skip the reveal.
                guard animate, !finished else { return }
                revealed = total
                finished = true
                onRevealComplete()
            }
            // Drive the reveal. ~40 ms/word, but bounded so long answers never
            // crawl (chunks-per-tick scales up for large answers).
            .task(id: text) {
                if !animate || total == 0 {
                    revealed = total
                    finished = true
                    onRevealComplete()
                    return
                }
                revealed = 0
                finished = false
                let intervalNs: UInt64 = 40_000_000        // 40 ms
                let maxDurationMs = 6000.0
                let perTick = max(1, Int(ceil(Double(total) * 40.0 / maxDurationMs)))
                while revealed < total {
                    try? await Task.sleep(nanoseconds: intervalNs)
                    if Task.isCancelled { return }
                    revealed = min(total, revealed + perTick)
                }
                finished = true
                onRevealComplete()
            }
            // Blinking caret while revealing.
            .task(id: finished) {
                guard animate, !finished else { return }
                while !Task.isCancelled {
                    try? await Task.sleep(nanoseconds: 450_000_000)
                    caretOn.toggle()
                }
            }
    }
}

/// Markdown text with an explicit color override (used by the reveal so we can
/// keep the caret in the answer color).
private struct FCMarkdownTextColored: View {
    let text: String
    let color: Color

    var body: some View {
        if let attributed = try? AttributedString(
            markdown: text,
            options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        ) {
            Text(attributed)
                .font(.system(size: FarmerChat.shared.config.messageFontSize ?? 16))
                .foregroundColor(color)
                .fixedSize(horizontal: false, vertical: true)
        } else {
            Text(text)
                .font(.system(size: FarmerChat.shared.config.messageFontSize ?? 16))
                .foregroundColor(color)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - User bubble (port of components/chat/UserChatBubble.kt)

public struct FCUserChatBubble: View {
    @Environment(\.fcTheme) private var theme
    let message: ChatMessage.UserMessage
    @ObservedObject var playback: AudioPlaybackService

    public var body: some View {
        VStack(alignment: .trailing, spacing: 6) {
            if let imageURL = message.imageURL {
                imageContent(imageURL)
            }
            if message.audioURL != nil {
                FCVoiceClip(message: message, playback: playback)
            }
            if !message.text.isEmpty {
                // Port of UserChatBubble.kt: light reading surface, dark text,
                // asymmetric shape (3 corners XL=20, bottom-trailing sharp tail).
                Text(message.text)
                    .font(.system(size: FarmerChat.shared.config.messageFontSize ?? 16))
                    .foregroundColor(FarmerChat.shared.config.userBubbleTextColor ?? theme.content.foregroundPrimary)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .frame(maxWidth: 300, alignment: .leading)
                    .background(FarmerChat.shared.config.userBubbleColor ?? theme.content.surfaceReadingSecondary)
                    .clipShape(UnevenRoundedRectangle(
                        topLeadingRadius: FarmerChat.shared.config.bubbleCornerRadius ?? 20,
                        bottomLeadingRadius: FarmerChat.shared.config.bubbleCornerRadius ?? 20,
                        bottomTrailingRadius: 4,
                        topTrailingRadius: FarmerChat.shared.config.bubbleCornerRadius ?? 20,
                        style: .continuous
                    ))
            }
            if message.isFailed {
                HStack(spacing: 4) {
                    Image(systemName: "exclamationmark.circle.fill")
                    Text(fcLabel("message_failed", "Not sent"))
                }
                .font(.system(size: 12))
                .foregroundColor(FCPrimitive.red500)
            }
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
    }

    @ViewBuilder
    private func imageContent(_ url: URL) -> some View {
        Group {
            if url.isFileURL, let image = UIImage(contentsOfFile: url.path) {
                Image(uiImage: image).resizable().aspectRatio(contentMode: .fill)
            } else {
                FCRemoteImage(urlString: url.absoluteString)
            }
        }
        .frame(maxWidth: message.userBubbleImageWideBanner ? .infinity : 220)
        .frame(height: message.userBubbleImageWideBanner ? 160 : 160)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

// MARK: - Voice clip bubble (play/pause + progress)

public struct FCVoiceClip: View {
    @Environment(\.fcTheme) private var theme
    let message: ChatMessage.UserMessage
    @ObservedObject var playback: AudioPlaybackService

    public var body: some View {
        Button(action: toggle) {
            HStack(spacing: 10) {
                Image(systemName: playback.isPlaying(id: clipId) ? "pause.fill" : "play.fill")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(theme.content.foregroundPrimary)

                ProgressView(value: progress)
                    .tint(theme.content.borderActive)
                    .frame(width: 110)

                Text(durationText)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(theme.content.foregroundSecondary)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(theme.content.surfaceSecondary)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private var clipId: String { "clip_\(message.id)" }

    private var progress: Double {
        guard playback.isActive(id: clipId), playback.duration > 0 else { return 0 }
        return min(1, playback.position / playback.duration)
    }

    private var durationText: String {
        let seconds = playback.isActive(id: clipId) ? playback.duration : 0
        let total = Int(seconds)
        return String(format: "%d:%02d", total / 60, total % 60)
    }

    private func toggle() {
        guard let url = message.audioURL else { return }
        if playback.isPlaying(id: clipId) {
            playback.pause()
        } else if playback.isActive(id: clipId) {
            playback.resume()
        } else {
            playback.play(url: url, id: clipId)
        }
    }
}

// MARK: - AI response bubble + actions

public struct FCAiResponseBubble: View {
    @Environment(\.fcTheme) private var theme
    let message: ChatMessage.AiResponse
    var showActions: Bool
    var isTtsEnabled: Bool
    var isSynthesising: Bool
    var isAudioPlaying: Bool
    /// Fresh answers animate their reveal; history + pre-generated pass false.
    var animate: Bool
    let onListen: () -> Void
    let onShare: () -> Void
    let onDownload: () -> Void
    var onReadFullAdvice: (() -> Void)?
    /// Bubbled up when the reveal finishes (also fires immediately when
    /// `animate == false`) so the parent can un-gate the follow-up section.
    var onRevealComplete: () -> Void
    // ---- agentic streaming (2.0.0) ----
    /// True for the newest answer: gates the stream error card and the escape
    /// hatch on an alignment surface.
    var isLatest: Bool
    /// Thread-level busy flag; locks alignment chips while a send is in flight.
    var isBusy: Bool
    /// Retry for an interrupted stream (`.retryLastRequest`).
    var onRetryStream: (() -> Void)?
    /// Tap handler for an ADDITIVE alignment surface rendered below the answer.
    var onAlignmentChipTap: ((AlignmentChip) -> Void)?

    /// Reveal-finished mirror so the action row / read-full-advice fade in only
    /// after the answer has fully appeared.
    @State private var revealFinished: Bool

    public init(
        message: ChatMessage.AiResponse,
        showActions: Bool,
        isTtsEnabled: Bool,
        isSynthesising: Bool,
        isAudioPlaying: Bool,
        animate: Bool,
        onListen: @escaping () -> Void,
        onShare: @escaping () -> Void,
        onDownload: @escaping () -> Void,
        onReadFullAdvice: (() -> Void)? = nil,
        onRevealComplete: @escaping () -> Void = {},
        isLatest: Bool = false,
        isBusy: Bool = false,
        onRetryStream: (() -> Void)? = nil,
        onAlignmentChipTap: ((AlignmentChip) -> Void)? = nil
    ) {
        self.message = message
        self.showActions = showActions
        self.isTtsEnabled = isTtsEnabled
        self.isSynthesising = isSynthesising
        self.isAudioPlaying = isAudioPlaying
        self.animate = animate
        self.onListen = onListen
        self.onShare = onShare
        self.onDownload = onDownload
        self.onReadFullAdvice = onReadFullAdvice
        self.onRevealComplete = onRevealComplete
        self.isLatest = isLatest
        self.isBusy = isBusy
        self.onRetryStream = onRetryStream
        self.onAlignmentChipTap = onAlignmentChipTap
        _revealFinished = State(initialValue: !animate)
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 10) {
                FCLogoMark(size: 26, tint: theme.brand.surfacePrimary)
                FCAiAnswerText(
                    text: message.text,
                    // A streaming answer must never run the typewriter reveal — the text is
                    // already arriving a token at a time, and animating it again double-types it.
                    animate: animate && !message.isStreaming,
                    color: FarmerChat.shared.config.aiBubbleTextColor,
                    onRevealComplete: {
                        withAnimation(.easeOut(duration: 0.35)) { revealFinished = true }
                        onRevealComplete()
                    }
                )
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            // Tool progress, or the initial "getting your answer" state before any text arrived.
            if message.isStreaming,
               message.text.isEmpty || !(message.streamingStatus ?? "").trimmingCharacters(in: .whitespaces).isEmpty {
                FCThinkingIndicator(
                    label: message.streamingStatus
                        ?? fcLabel(
                            AgenticLabels.gettingYourAnswer,
                            AgenticLabels.gettingYourAnswerFallback
                        )
                )
            }

            // Text is flowing but has stalled with no tool status: a transient client-side hint,
            // NOT a failure. Keyed on the text length so the next delta clears it automatically.
            if message.isStreaming,
               !message.text.isEmpty,
               (message.streamingStatus ?? "").trimmingCharacters(in: .whitespaces).isEmpty {
                FCStreamStallHint(textLength: message.text.count)
            }

            // ADDITIVE surface: a nudge below the real answer (gender-select / commodity-confirm).
            // Single-tap; the answer above keeps its own action row.
            if let kind = message.alignmentKind, kind.isAdditive, let onAlignmentChipTap {
                FCAlignmentSurface(
                    kind: kind,
                    message: message.alignmentMessage ?? "",
                    chips: message.alignmentChips ?? [],
                    selectedValues: message.alignmentSelectedValues,
                    isLoading: isBusy,
                    isLatest: isLatest,
                    onChipTap: onAlignmentChipTap
                )
            }

            // Interrupted terminal state: keep any partial answer above and offer retry. Only the
            // latest answer shows the card — an older failed question keeps its partial text but
            // drops the retry action.
            if message.isInterrupted, isLatest, let onRetryStream {
                FCStreamErrorCard(
                    errorKind: message.streamErrorKind ?? .unknown,
                    hasPartial: !message.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                    onRetry: onRetryStream
                )
            }

            if revealFinished, message.isPreGenerated, let onReadFullAdvice {
                Button(action: onReadFullAdvice) {
                    HStack(spacing: 4) {
                        Text(fcLabel("read_full_advice", "Read full advice"))
                        Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold))
                    }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(theme.brand.surfacePrimary)
                }
                .buttonStyle(.plain)
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            }

            if revealFinished, showActions, !message.isStreaming, !message.isInterrupted {
                // Cleaner Share / Save / Listen row — bordered brand-accent
                // chips that recolor with the host theme; fade/slide in only
                // after the reveal completes.
                HStack(spacing: 10) {
                    actionChip(icon: "square.and.arrow.up", title: fcLabel("share", "Share"), loading: false, action: onShare)
                    actionChip(icon: "arrow.down.to.line", title: fcLabel("save", "Save"), loading: false, action: onDownload)
                    if isTtsEnabled {
                        actionChip(
                            icon: isAudioPlaying ? "pause.fill" : "speaker.wave.2.fill",
                            title: fcLabel("listen", "Listen"),
                            loading: isSynthesising,
                            action: onListen
                        )
                    }
                    Spacer(minLength: 0)
                }
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.content.surfaceReadingSecondary)
        .clipShape(RoundedRectangle(cornerRadius: FarmerChat.shared.config.bubbleCornerRadius ?? min(theme.shapes.card, 22), style: .continuous))
    }

    private func actionChip(icon: String, title: String, loading: Bool, action: @escaping () -> Void) -> some View {
        let accent = theme.content.borderActive
        return Button(action: action) {
            HStack(spacing: 7) {
                if loading {
                    ProgressView().scaleEffect(0.7).tint(accent)
                } else {
                    Image(systemName: icon).font(.system(size: 14, weight: .semibold)).foregroundColor(accent)
                }
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(theme.content.foregroundSecondary)
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 40)
            .background(theme.content.surfaceSecondary)
            .overlay(
                Capsule().stroke(accent.opacity(0.28), lineWidth: 1)
            )
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(loading)
    }
}

// MARK: - Follow-up chips (suggested/related questions)

public struct FCFollowUpChips: View {
    @Environment(\.fcTheme) private var theme
    let title: String
    let questions: [String]
    let onTap: (String) -> Void

    public var body: some View {
        // Titled "Related questions" section (accent dot + title) then modern
        // tappable suggestion cards. The dot, border and trailing affordance use
        // the brand accent so host theming recolors them automatically.
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Circle()
                    .fill(theme.content.borderActive)
                    .frame(width: 6, height: 6)
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(theme.content.foregroundSecondary)
            }
            .padding(.leading, 2)

            ForEach(questions, id: \.self) { question in
                FCSuggestedCard(text: question, onTap: { onTap(question) })
            }
        }
    }
}

// MARK: - Suggested / related question card (port of Cards.kt SuggestedCard)

public struct FCSuggestedCard: View {
    @Environment(\.fcTheme) private var theme
    let text: String
    let onTap: () -> Void

    public var body: some View {
        let accent = theme.content.borderActive
        let radius = min(theme.shapes.card, 18)
        Button(action: onTap) {
            HStack(spacing: 12) {
                Text(text)
                    .font(.system(size: 16))
                    .foregroundColor(theme.content.foregroundPrimary)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
                // Trailing accent affordance — reads as "ask this".
                ZStack {
                    Circle().fill(accent.opacity(0.16)).frame(width: 30, height: 30)
                    Image(systemName: "arrow.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(accent)
                }
            }
            .padding(.leading, 16)
            .padding(.trailing, 10)
            .padding(.vertical, 12)
            .frame(minHeight: 48)
            .frame(maxWidth: .infinity)
            .background(theme.content.surfaceSecondary)
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .stroke(accent.opacity(0.35), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(text)
        .accessibilityHint(fcLabel("ask", "Ask"))
    }
}

// MARK: - Thinking indicator (port of AiAnswer.kt ThinkingIndicator)

/// Branded "thinking" state shown before the answer arrives: a small spinning
/// logo mark + a pulsing "Getting your answer…" label with three animated dots.
public struct FCThinkingIndicator: View {
    @Environment(\.fcTheme) private var theme
    var label: String
    @State private var spin = false

    public init(label: String) { self.label = label }

    public var body: some View {
        let accent = theme.content.borderActive
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .trim(from: 0, to: 0.75)
                    .stroke(accent, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                    .frame(width: 26, height: 26)
                    .rotationEffect(.degrees(spin ? 360 : 0))
                FCLogoMark(size: 15, tint: accent)
            }
            .onAppear {
                withAnimation(.linear(duration: 1.0).repeatForever(autoreverses: false)) { spin = true }
            }
            HStack(spacing: 8) {
                Text(label)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(theme.content.foregroundSecondary)
                FCThreeDotPulse()
            }
        }
    }
}

private struct FCThreeDotPulse: View {
    @Environment(\.fcTheme) private var theme
    @State private var animating = false

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(theme.content.borderActive)
                    .frame(width: 6, height: 6)
                    .opacity(animating ? 1 : 0.25)
                    .animation(
                        .easeInOut(duration: 0.6)
                            .repeatForever(autoreverses: true)
                            .delay(Double(i) * 0.18),
                        value: animating
                    )
            }
        }
        .onAppear { animating = true }
    }
}

// MARK: - Loading placeholder bubble (refined "thinking" state)

public struct FCChatLoadingBubble: View {
    public init() {}
    public var body: some View {
        FCThinkingIndicator(label: fcLabel("getting_your_answer", "Getting your answer…"))
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Share card (rendered via ImageRenderer for share/download)

public struct FCShareCard: View {
    let question: String
    let answer: String

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 8) {
                FCLogoMark(size: 30, tint: .white)
                Text("FarmerChat")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(.white)
                Spacer()
            }
            if !question.isEmpty {
                Text(question)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(FCPrimitive.sun300)
            }
            Text(answer)
                .font(.system(size: 15))
                .foregroundColor(.white)
                .lineLimit(40)
            Spacer(minLength: 8)
            Text("© Digital Green")
                .font(.system(size: 11))
                .foregroundColor(.white.opacity(0.6))
        }
        .padding(24)
        .frame(width: 360)
        .background(FCPrimitive.green800)
    }
}

@MainActor
enum FCShareCardRenderer {
    static func render(question: String, answer: String) -> UIImage? {
        let renderer = ImageRenderer(content: FCShareCard(question: question, answer: answer))
        renderer.scale = 3
        return renderer.uiImage
    }
}

// MARK: - Scroll-to-bottom indicator

public struct FCScrollToBottomButton: View {
    @Environment(\.fcTheme) private var theme
    let action: () -> Void

    public var body: some View {
        Button(action: action) {
            Image(systemName: "chevron.down")
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(theme.content.foregroundPrimary)
                .frame(width: 42, height: 42)
                .background(theme.content.surfaceSecondary)
                .clipShape(Circle())
                .shadow(color: .black.opacity(0.15), radius: 8, y: 2)
        }
        .buttonStyle(.plain)
    }
}
