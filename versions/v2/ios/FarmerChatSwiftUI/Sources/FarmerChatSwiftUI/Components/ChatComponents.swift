import SwiftUI
import FarmerChatCore

// MARK: - Markdown text (port of components/MarkdownText.kt)

/// Port of `components/MarkdownText.kt`.
///
/// WHAT WAS WRONG
/// The SDK parsed the answer with `AttributedString(markdown:)` using
/// `.inlineOnlyPreservingWhitespace`, which handles inline `**bold**` / `*italic*` and
/// deliberately ignores every BLOCK construct. So a `# Heading` rendered as the literal text
/// "# Heading" at body size, `- item` as "- item" with no dot and no hanging indent, `1. item`
/// with the marker inline, `---` as three hyphens, and a GFM table as raw pipe soup. Answers
/// are the primary product surface, so this was the most visible remaining gap on iOS.
///
/// Now parses into typed blocks and renders each the way android does, including Compose's
/// per-block-pair spacing table (which is not uniform — consecutive list items tighten to 5pt
/// while consecutive paragraphs open up to 20pt).
///
/// Inline emphasis is still delegated to `AttributedString(markdown:)` per block, which is
/// correct once the block markers are already stripped: it gives `**bold**` and `*italic*`
/// (including nested) without touching block syntax.
enum FCMarkdownBlock: Identifiable {
    case header(text: String, level: Int)
    case paragraph(String)
    case bullet(String)
    case numbered(number: String, text: String)
    case divider
    case table(headers: [String], alignments: [FCTableAlignment], rows: [[String]])

    var id: String {
        switch self {
        case .header(let t, let l): return "h\(l)-\(t)"
        case .paragraph(let t): return "p-\(t)"
        case .bullet(let t): return "b-\(t)"
        case .numbered(let n, let t): return "n\(n)-\(t)"
        case .divider: return "divider-\(UUID().uuidString)"
        case .table(let h, _, let r): return "t-\(h.joined())-\(r.count)"
        }
    }
}

enum FCTableAlignment {
    case leading, center, trailing

    var textAlignment: TextAlignment {
        switch self {
        case .leading: return .leading
        case .center: return .center
        case .trailing: return .trailing
        }
    }

    var frameAlignment: Alignment {
        switch self {
        case .leading: return .leading
        case .center: return .center
        case .trailing: return .trailing
        }
    }
}

/// Inline emphasis only — the block markers have already been consumed by the parser.
func fcInlineMarkdown(_ text: String) -> AttributedString {
    (try? AttributedString(
        markdown: text,
        options: AttributedString.MarkdownParsingOptions(
            interpretedSyntax: .inlineOnlyPreservingWhitespace
        )
    )) ?? AttributedString(text)
}

/// Port of `parseMarkdownBlocks`.
func fcParseMarkdownBlocks(_ text: String) -> [FCMarkdownBlock] {
    var blocks: [FCMarkdownBlock] = []
    let lines = text.components(separatedBy: .newlines)
    var i = 0

    func looksLikeTableRow(_ s: String) -> Bool {
        guard s.contains("|") else { return false }
        return !s.trimmingCharacters(in: CharacterSet(charactersIn: "|"))
            .trimmingCharacters(in: .whitespaces).isEmpty
    }
    func splitTableRow(_ s: String) -> [String] {
        var core = s.trimmingCharacters(in: .whitespaces)
        if core.hasPrefix("|") { core.removeFirst() }
        if core.hasSuffix("|") { core.removeLast() }
        return core.components(separatedBy: "|").map { $0.trimmingCharacters(in: .whitespaces) }
    }
    func isTableSeparator(_ s: String) -> Bool {
        guard s.contains("|"), s.contains("-") else { return false }
        let cells = splitTableRow(s)
        guard !cells.isEmpty else { return false }
        let re = try? NSRegularExpression(pattern: "^:?-{3,}:?$")
        return cells.allSatisfy { cell in
            let c = cell.trimmingCharacters(in: .whitespaces)
            let range = NSRange(c.startIndex..., in: c)
            return re?.firstMatch(in: c, range: range) != nil
        }
    }

    while i < lines.count {
        let trimmed = lines[i].trimmingCharacters(in: .whitespaces)

        // Tables are detected with a 2-line look-ahead: a header row followed by a separator.
        if looksLikeTableRow(trimmed), i + 1 < lines.count,
           isTableSeparator(lines[i + 1].trimmingCharacters(in: .whitespaces)) {
            let headers = splitTableRow(trimmed)
            let alignments = splitTableRow(lines[i + 1].trimmingCharacters(in: .whitespaces))
                .map { cell -> FCTableAlignment in
                    let c = cell.trimmingCharacters(in: .whitespaces)
                    if c.hasPrefix(":") && c.hasSuffix(":") { return .center }
                    if c.hasSuffix(":") { return .trailing }
                    return .leading
                }
            var rows: [[String]] = []
            var j = i + 2
            while j < lines.count {
                let next = lines[j].trimmingCharacters(in: .whitespaces)
                if !looksLikeTableRow(next) { break }
                rows.append(splitTableRow(next))
                j += 1
            }
            blocks.append(.table(headers: headers, alignments: alignments, rows: rows))
            i = j
            continue
        }

        if trimmed.isEmpty {
            i += 1
            continue
        }
        if trimmed == "---" || trimmed == "***" || trimmed == "___" {
            blocks.append(.divider)
        } else if trimmed.hasPrefix("#"),
                  trimmed.drop(while: { $0 == "#" }).hasPrefix(" ") {
            // ATX headers: one-to-six leading '#' then a space. The count maps to a level
            // clamped to 1...3, which selects the render style.
            let level = min(max(trimmed.prefix(while: { $0 == "#" }).count, 1), 3)
            let headerText = trimmed.drop(while: { $0 == "#" })
                .trimmingCharacters(in: .whitespaces)
            blocks.append(.header(text: headerText, level: level))
        } else if trimmed.hasPrefix("- ") || trimmed.hasPrefix("* ") {
            blocks.append(.bullet(String(trimmed.dropFirst(2))))
        } else if let match = trimmed.range(of: "^\\d+\\.\\s", options: .regularExpression) {
            let number = trimmed[trimmed.startIndex..<match.lowerBound]
                + trimmed[match.lowerBound..<match.upperBound]
                    .prefix(while: { $0.isNumber })
            let numberText = trimmed.prefix(while: { $0.isNumber })
            let content = trimmed[match.upperBound...].trimmingCharacters(in: .whitespaces)
            _ = number
            blocks.append(.numbered(number: String(numberText), text: content))
        } else {
            blocks.append(.paragraph(trimmed))
        }
        i += 1
    }
    return blocks
}

/// Compose's per-block-pair spacing table (MarkdownText.kt:118-133). Not uniform: dividers,
/// headers and tables get generous room, consecutive list items tighten, consecutive
/// paragraphs open up.
func fcMarkdownTopSpacing(index: Int, block: FCMarkdownBlock, previous: FCMarkdownBlock?) -> CGFloat {
    guard index > 0, let previous else { return 0 }
    func isDivider(_ b: FCMarkdownBlock) -> Bool { if case .divider = b { return true }; return false }
    func isHeader(_ b: FCMarkdownBlock) -> Bool { if case .header = b { return true }; return false }
    func isTable(_ b: FCMarkdownBlock) -> Bool { if case .table = b { return true }; return false }
    func isBullet(_ b: FCMarkdownBlock) -> Bool { if case .bullet = b { return true }; return false }
    func isNumbered(_ b: FCMarkdownBlock) -> Bool { if case .numbered = b { return true }; return false }
    func isParagraph(_ b: FCMarkdownBlock) -> Bool { if case .paragraph = b { return true }; return false }

    if isDivider(block) || isDivider(previous) { return 24 }
    if isHeader(block) { return 24 }
    if isHeader(previous) { return 20 }
    if isTable(block) || isTable(previous) { return 16 }
    if isBullet(block) && isBullet(previous) { return 5 }
    if isNumbered(block) && isNumbered(previous) { return 5 }
    if isParagraph(block) && isParagraph(previous) { return 20 }
    return 12
}

/// Renders the parsed blocks. `color` lets the streaming reveal keep the caret in the answer
/// colour, which is why the old file carried a near-duplicate `FCMarkdownTextColored`.
public struct FCMarkdownText: View {
    @Environment(\.fcTheme) private var theme
    let text: String
    var color: Color?

    public init(text: String, color: Color? = nil) {
        self.text = text
        self.color = color
    }

    public var body: some View {
        let blocks = fcParseMarkdownBlocks(text)
        let ink = color ?? theme.content.foregroundPrimary
        VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { index, block in
                let spacing = fcMarkdownTopSpacing(
                    index: index,
                    block: block,
                    previous: index > 0 ? blocks[index - 1] : nil
                )
                if spacing > 0 {
                    Spacer().frame(height: spacing)
                }
                blockView(block, ink: ink)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .fixedSize(horizontal: false, vertical: true)
    }

    /// The host's `messageFontSize` knob, resolved once and used by every text-bearing block.
    /// docs/04 requires it at every markdown paragraph/bullet/numbered site, not just the
    /// first — and before the block port only the reveal path honoured it at all, so a host
    /// that set it saw the streaming answer resize and the settled one snap back.
    /// Headers keep their own title slots, as android does.
    private var bodyStyle: FCTextStyle {
        theme.typography.bodyMedium(atSize: FarmerChat.shared.config.messageFontSize ?? 17)
    }

    @ViewBuilder
    private func blockView(_ block: FCMarkdownBlock, ink: Color) -> some View {
        switch block {
        case .divider:
            // 3pt, fully rounded, borderDefault (MarkdownText.kt:140-148).
            Capsule()
                .fill(theme.content.borderDefault)
                .frame(height: 3)
                .frame(maxWidth: .infinity)

        case .header(let text, let level):
            // #, ##, ### map onto the type scale so they stay visually distinct; deeper
            // levels clamp to titleSmall (MarkdownText.kt:153-158).
            Text(fcInlineMarkdown(text))
                .fcTextStyle(level == 1 ? theme.typography.titleLarge
                             : level == 2 ? theme.typography.titleMedium
                             : theme.typography.titleSmall)
                .foregroundColor(ink)

        case .paragraph(let text):
            Text(fcInlineMarkdown(text))
                .fcTextStyle(bodyStyle)
                .foregroundColor(ink)
                .frame(maxWidth: .infinity, alignment: .leading)

        case .bullet(let text):
            // A real 5pt dot with a 10pt top offset and a 10pt gap, so the text hangs —
            // the SDK previously had no dot at all.
            HStack(alignment: .top, spacing: 10) {
                Circle()
                    .fill(ink)
                    .frame(width: 5, height: 5)
                    .padding(.top, 10)
                Text(fcInlineMarkdown(text))
                    .fcTextStyle(bodyStyle)
                    .foregroundColor(ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

        case .numbered(let number, let text):
            HStack(alignment: .top, spacing: 4) {
                Text("\(number).")
                    .fcTextStyle(bodyStyle)
                    .foregroundColor(ink)
                Text(fcInlineMarkdown(text))
                    .fcTextStyle(bodyStyle)
                    .foregroundColor(ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

        case .table(let headers, let alignments, let rows):
            FCMarkdownTable(headers: headers, alignments: alignments, rows: rows, ink: ink)
        }
    }
}

/// GFM table.
///
/// App parity (MarkdownText.kt 69a6db10 + 1b0553d2): 1–2 column tables already fit the answer
/// column and render as a weighted grid. 3+ column tables used to be horizontally scrollable —
/// the farmer had to pan a table sideways inside a vertically scrolling thread. Each data row is
/// now stacked into its own card (cell 0 as the title, the remaining columns as label/value
/// rows) so the data reads top-to-bottom with no panning.
private struct FCMarkdownTable: View {
    @Environment(\.fcTheme) private var theme
    let headers: [String]
    let alignments: [FCTableAlignment]
    let rows: [[String]]
    let ink: Color

    /// Any multi-column table stacks into one card per data row — Kotlin `columnCount >= 2`
    /// (MarkdownText.kt @ 10a87f9c..04b38e8f lowered this from 3). Only a lone single-column
    /// table falls back to the weighted grid.
    private var isWide: Bool { headers.count >= 2 }

    /// A card is a 3-column table whose header row holds the title in the first cell and nothing
    /// in the other two — e.g. `| Saturday, 19 Sep | | |`. This is the sole test that separates a
    /// card from an ordinary grid (a grid has text in at least one trailing header cell).
    private var isCard: Bool {
        headers.count == 3
            && !headers[0].trimmingCharacters(in: .whitespaces).isEmpty
            && headers.dropFirst().allSatisfy { $0.trimmingCharacters(in: .whitespaces).isEmpty }
    }

    private func alignment(_ column: Int) -> FCTableAlignment {
        column < alignments.count ? alignments[column] : .leading
    }

    var body: some View {
        if isCard {
            answerCard
        } else if isWide {
            rowCards
        } else {
            grid.clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    // MARK: 2+ columns — one card per data row

    /// Label is leading and muted; value is trailing and bold — regardless of the source GFM
    /// alignment, which is why this branch ignores `alignments`.
    private var rowCards: some View {
        VStack(spacing: 12) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, cells in
                VStack(alignment: .leading, spacing: 10) {
                    let title = cells.first?.trimmingCharacters(in: .whitespaces) ?? ""
                    if !title.isEmpty {
                        Text(fcInlineMarkdown(title))
                            .fcTextStyle(theme.typography.labelLarge)
                            .foregroundColor(ink)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        theme.content.borderDefault.frame(height: 1)
                    }

                    ForEach(1..<max(headers.count, 1), id: \.self) { column in
                        // Label above value, each full width. The earlier side-by-side pair
                        // wrapped long labels and values inside a narrow half-column.
                        VStack(alignment: .leading, spacing: 2) {
                            Text(fcInlineMarkdown(cell(headers, column)))
                                .fcTextStyle(theme.typography.bodySmall)
                                .foregroundColor(theme.content.foregroundSecondary)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            Text(fcInlineMarkdown(cell(cells, column)))
                                .fcTextStyle(theme.typography.bodySmall)
                                .foregroundColor(ink)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(theme.content.surfaceReadingSecondary)
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
    }

    // MARK: answer card — `| Title | | |` with label / value / meaning body rows

    /// The header's first cell is the card title; each body row is a reading. A divider sits
    /// under the title and between readings, and the card edge closes the last one. The meaning
    /// (row[2]) is the whole point of the format — the line a farmer who cannot read the figure
    /// relies on — so it stays readable and is dropped only when the source cell is empty.
    private var answerCard: some View {
        let title = headers.first?.trimmingCharacters(in: .whitespaces) ?? ""
        return VStack(alignment: .leading, spacing: 12) {
            if !title.isEmpty {
                Text(fcInlineMarkdown(title))
                    .fcTextStyle(theme.typography.labelLarge)
                    .foregroundColor(ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
                theme.content.borderDefault.frame(height: 1)
            }

            ForEach(Array(rows.enumerated()), id: \.offset) { index, cells in
                VStack(alignment: .leading, spacing: 2) {
                    let rowLabel = cell(cells, 0)
                    let value = cell(cells, 1)
                    let meaning = cell(cells, 2)
                    if !rowLabel.isEmpty {
                        Text(fcInlineMarkdown(rowLabel))
                            .fcTextStyle(theme.typography.bodySmall)
                            .foregroundColor(theme.content.foregroundSecondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    Text(fcInlineMarkdown(value))
                        .fcTextStyle(theme.typography.bodyMedium)
                        .fontWeight(.bold)
                        .foregroundColor(ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    if !meaning.isEmpty {
                        Text(fcInlineMarkdown(meaning))
                            .fcTextStyle(theme.typography.bodyMedium)
                            .foregroundColor(theme.content.foregroundSecondary)
                            .padding(.top, 2)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                if index != rows.count - 1 {
                    theme.content.borderDefault.frame(height: 1)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(theme.content.surfaceReadingSecondary)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func cell(_ cells: [String], _ column: Int) -> String {
        column < cells.count ? cells[column].trimmingCharacters(in: .whitespaces) : ""
    }

    // MARK: 1–2 columns — weighted grid

    private var grid: some View {
        VStack(spacing: 0) {
            row(headers, isHeader: true, index: 0)
            ForEach(Array(rows.enumerated()), id: \.offset) { index, cells in
                row(cells, isHeader: false, index: index + 1)
            }
        }
    }

    private func row(_ cells: [String], isHeader: Bool, index: Int) -> some View {
        HStack(spacing: 0) {
            ForEach(Array(cells.enumerated()), id: \.offset) { column, cell in
                Text(fcInlineMarkdown(cell))
                    .fcTextStyle(isHeader ? theme.typography.labelMedium : theme.typography.bodySmall)
                    .foregroundColor(ink)
                    .multilineTextAlignment(alignment(column).textAlignment)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .frame(maxWidth: .infinity, alignment: alignment(column).frameAlignment)
            }
        }
        .background(
            isHeader
                ? theme.content.surfaceSecondary
                : (index.isMultiple(of: 2)
                   ? theme.content.surfaceReadingTertiary
                   : theme.content.surfaceReadingSecondary)
        )
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

/// The reveal path's variant: markdown with an explicit colour so the caret stays in the
/// answer colour. Now a thin wrapper — `FCMarkdownText` takes the colour directly, so the
/// two near-identical bodies (which had already drifted: only one of them read the theme)
/// have collapsed into one.
private struct FCMarkdownTextColored: View {
    let text: String
    let color: Color

    var body: some View {
        FCMarkdownText(text: text, color: color)
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
                    .fcTextStyle(theme.typography.bodyMedium(atSize: FarmerChat.shared.config.messageFontSize ?? 17))
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
                .fcTextStyle(theme.typography.labelSmall)
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
                        Text(fcLabel(FCLabels.readFullAdvice, "Read full advice"))
                        Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold))
                    }
                    .fcTextStyle(theme.typography.labelMedium)
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
                    actionChip(
                        icon: "square.and.arrow.up",
                        title: fcLabel(FCLabels.shareDownload, "Share"),
                        loading: false,
                        sweepBorder: message.isAgentic && !message.isPreGenerated,
                        action: onShare
                    )
                    actionChip(icon: "arrow.down.to.line", title: fcLabel(FCLabels.save, "Save"), loading: false, action: onDownload)
                    if isTtsEnabled {
                        actionChip(
                            icon: isAudioPlaying ? "pause.fill" : "speaker.wave.2.fill",
                            title: fcLabel(FCLabels.listen, "Listen"),
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

    /// `sweepBorder` is the agentic Share chip's accent ring — SwiftUI's equivalent of the
    /// Compose `ActionButton(borderBrush = brand.accentSweepBorder)` (app @ bda80659). The legacy
    /// Share chip and every other action keep the plain 1pt accent hairline.
    private func actionChip(
        icon: String,
        title: String,
        loading: Bool,
        sweepBorder: Bool = false,
        action: @escaping () -> Void
    ) -> some View {
        let accent = theme.content.borderActive
        return Button(action: action) {
            HStack(spacing: 7) {
                if loading {
                    ProgressView().scaleEffect(0.7).tint(accent)
                } else {
                    Image(systemName: icon).font(.system(size: 14, weight: .semibold)).foregroundColor(accent)
                }
                Text(title)
                    .fcTextStyle(theme.typography.labelSmall)
                    .foregroundColor(theme.content.foregroundSecondary)
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 40)
            .background(theme.content.surfaceSecondary)
            .overlay(
                Group {
                    if sweepBorder {
                        // 3pt to match the Compose borderWidth; strokeBorder (not stroke) keeps
                        // the ring INSIDE the bounds, as Modifier.border and Surface(border:) do.
                        Capsule().strokeBorder(theme.brand.accentSweepBorder, lineWidth: 3)
                    } else {
                        Capsule().stroke(accent.opacity(0.28), lineWidth: 1)
                    }
                }
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
                    .fcTextStyle(theme.typography.labelMedium)
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
                    .fcTextStyle(theme.typography.bodyMedium)
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
        .accessibilityHint(fcLabel(FCLabels.ask, "Ask"))
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
                    .fcTextStyle(theme.typography.labelMedium)
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
        FCThinkingIndicator(label: fcLabel(FCLabels.gettingYourAnswer, "Getting your answer…"))
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Share card (rendered via ImageRenderer for share/download)

public struct FCShareCard: View {
    /// Supplied by the environment when previewed in-tree, and injected explicitly by
    /// `FCShareCardRenderer` — `ImageRenderer` builds its content outside the hierarchy, so
    /// nothing is inherited there (the app documents the same trap in ShareCard.swift:130).
    @Environment(\.fcTheme) private var theme
    let question: String
    let answer: String

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 8) {
                FCLogoMark(size: 30, tint: .white)
                Text("FarmerChat")
                    .fcTextStyle(theme.typography.titleMedium)
                    .foregroundColor(.white)
                Spacer()
            }
            if !question.isEmpty {
                Text(question)
                    .fcTextStyle(theme.typography.titleSmall)
                    .foregroundColor(FCPrimitive.sun300)
            }
            Text(answer)
                .fcTextStyle(theme.typography.bodyMedium)
                .foregroundColor(.white)
                .lineLimit(40)
            Spacer(minLength: 8)
            Text("© Digital Green")
                .fcTextStyle(theme.typography.labelSmall)
                .foregroundColor(.white.opacity(0.6))
        }
        .padding(24)
        .frame(width: 360)
        .background(FCPrimitive.green800)
    }
}

@MainActor
enum FCShareCardRenderer {
    static func render(question: String, answer: String, theme: FCTheme) -> UIImage? {
        let card = FCShareCard(question: question, answer: answer)
            // The renderer builds the view outside the hierarchy, so it inherits no
            // environment — the theme has to be handed over explicitly or the card falls
            // back to the default roman scale at typeScale 1.0.
            .environment(\.fcTheme, theme)
        let renderer = ImageRenderer(content: card)
        renderer.scale = 3
        return renderer.uiImage
    }
}

// MARK: - Scroll-to-bottom indicator

/// Port of `components/ScrollIndicator.kt`: a 40pt circle that appears 1500ms after a new
/// answer renders, bounces three times, then fades itself out.
///
/// It replaces `FCScrollToBottomButton`, which existed but was never rendered anywhere — so
/// when an answer ran past the fold there was nothing to say so and nothing to tap. The
/// reference iOS app hit the same thing and records why it matters (`PARITY.md:598`): the
/// streaming auto-scroll is deliberately absent (the thread must stay still while an answer
/// grows), which means an affordance is the *only* thing telling a farmer there is more.
///
/// `triggerKey` restarts the whole timeline — pass the last answer's id, as android does.
public struct FCScrollIndicator: View {
    @Environment(\.fcTheme) private var theme
    let triggerKey: String
    let action: () -> Void

    @State private var isVisible = false
    @State private var bounceOffset: CGFloat = 0

    public init(triggerKey: String, action: @escaping () -> Void) {
        self.triggerKey = triggerKey
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            Image(systemName: "arrow.down")
                .font(.system(size: 20, weight: .semibold))
                .foregroundColor(theme.content.foregroundPrimary)
                .frame(width: 40, height: 40)
                .background(theme.content.surfaceReadingSecondary)
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
        .offset(y: bounceOffset)
        .opacity(isVisible ? 1 : 0)
        .animation(.easeInOut(duration: isVisible ? 0.2 : 0.3), value: isVisible)
        .allowsHitTesting(isVisible)
        // The android timeline exactly: 1500ms wait, show, 300ms settle, three bounces of
        // 280ms down / 320ms up with a 150ms gap, then 400ms before fading out.
        .task(id: triggerKey) {
            isVisible = false
            bounceOffset = 0
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            guard !Task.isCancelled else { return }
            isVisible = true
            try? await Task.sleep(nanoseconds: 300_000_000)
            for _ in 0..<3 {
                guard !Task.isCancelled else { return }
                withAnimation(.easeInOut(duration: 0.28)) { bounceOffset = 14 }
                try? await Task.sleep(nanoseconds: 280_000_000)
                withAnimation(.easeInOut(duration: 0.32)) { bounceOffset = 0 }
                try? await Task.sleep(nanoseconds: 320_000_000)
                try? await Task.sleep(nanoseconds: 150_000_000)
            }
            try? await Task.sleep(nanoseconds: 400_000_000)
            guard !Task.isCancelled else { return }
            isVisible = false
        }
    }
}

/// How far the thread's content extends below the viewport, published by the thread's trailing
/// marker. Zero (or negative) means the farmer is at the bottom.
struct FCHiddenBelowKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

// MARK: - Location bubble (2.0.0 — port of components/chat/LocationChatBubble.kt)

/// The farmer's resolved location, standing in for the text bubble they would otherwise have sent
/// in reply to a GPS_PROMPT alignment chip. Right-aligned like a user bubble (`ChatView` wraps it
/// the way Compose wraps it in a `fillMaxWidth` Box with `contentAlignment = CenterEnd`).
///
/// Figma card: fixed 290x184 — a green-at-16% map band with a centred pin over a soft ellipse
/// "shadow", then a footer with the caption above the bold address. Three corners rounded, the
/// bottom-trailing one sharp, exactly like `FCUserChatBubble`.
///
/// Honours the same two chat-customization knobs the other bubbles do: `bubbleCornerRadius` (the
/// three rounded corners; the tail stays sharp) and `messageFontSize` (caption + address). The pin
/// and its ellipse are drawn with SF Symbols / shapes because the package ships no image assets.
public struct FCLocationChatBubble: View {
    @Environment(\.fcTheme) private var theme
    let address: String
    let label: String

    public init(address: String, label: String) {
        self.address = address
        self.label = label
    }

    private var radius: CGFloat { FarmerChat.shared.config.bubbleCornerRadius ?? 20 }
    private var fontSize: CGFloat { FarmerChat.shared.config.messageFontSize ?? 16 }

    public var body: some View {
        VStack(spacing: 0) {
            // Map-style band with the centred pin — fills the height left above the footer.
            ZStack {
                FCPrimitive.green500Alpha16
                VStack(spacing: 0) {
                    Image(systemName: "mappin.and.ellipse")
                        .font(.system(size: 34))
                        .foregroundColor(FCPrimitive.green500)
                        .frame(width: 44, height: 44)
                    Ellipse()
                        .fill(FCPrimitive.green500.opacity(0.24))
                        .frame(width: 28, height: 8)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            // Footer: caption + resolved address.
            VStack(alignment: .leading, spacing: 4) {
                Text(label)
                    .fcTextStyle(theme.typography.bodyMedium(atSize: fontSize))
                    .foregroundColor(theme.content.foregroundSecondary)
                Text(address)
                    .fcTextStyle(theme.typography.bodyMedium(atSize: fontSize)).fontWeight(.bold)
                    .foregroundColor(theme.content.foregroundPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .frame(width: 290, height: 184)
        .background(theme.content.surfaceReadingSecondary)
        .clipShape(UnevenRoundedRectangle(
            topLeadingRadius: radius,
            bottomLeadingRadius: radius,
            bottomTrailingRadius: 0,
            topTrailingRadius: radius,
            style: .continuous
        ))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label) \(address)")
    }
}
