import SwiftUI
import FarmerChatCore

// MARK: - Stall hint

/// How long a streamed answer may stall, with no tool status, before the UI shows a transient
/// "Paused, resuming…" hint. Client-side only — not a failure, and it clears on the next delta.
private let fcPauseHintDelayNanoseconds: UInt64 = 4_000_000_000

/// Transient "paused, resuming" hint for a stream that has text flowing but has gone quiet.
///
/// Keyed on the answer's length: `.task(id:)` restarts on every delta, so the hint disappears the
/// moment text resumes. Port of the Compose behaviour in `ChatScreen.kt` (PAUSE_HINT_DELAY_MS).
struct FCStreamStallHint: View {
    /// Length of the streamed text so far — the identity that resets the timer.
    let textLength: Int
    @State private var stalled = false

    var body: some View {
        Group {
            if stalled {
                // App parity (ChatThreadContent.kt): the stall hint is a LogoSpinnerHorizontal.
                FCLogoSpinner(
                    message: fcLabel(
                        AgenticLabels.responsePausedResuming,
                        AgenticLabels.responsePausedResumingFallback
                    ),
                    vertical: false
                )
            }
        }
        .task(id: textLength) {
            stalled = false
            try? await Task.sleep(nanoseconds: fcPauseHintDelayNanoseconds)
            if Task.isCancelled { return }
            stalled = true
        }
    }
}

// MARK: - Stream error card

/// Inline card shown when an agentic stream ends without a complete answer (2.0.0). Renders below
/// the AI response — below the preserved partial text, if any — with a state-specific message and
/// a full-width "Try again" action.
///
/// The copy is driven by both `errorKind` and `hasPartial`, because "we lost the connection but
/// kept what you have" and "nothing arrived" are very different messages to a farmer:
/// - `hasPartial` → "Connection stopped. Your partial answer is saved."
/// - network      → "No internet connection"
/// - otherwise    → "Something went wrong"
///
/// The tint comes from `theme.brand.feedbackFail`, so a host that themes the SDK gets its own
/// failure colour rather than a hardcoded red.
public struct FCStreamErrorCard: View {
    @Environment(\.fcTheme) private var theme
    let errorKind: StreamErrorKind
    let hasPartial: Bool
    let onRetry: () -> Void

    public init(errorKind: StreamErrorKind, hasPartial: Bool, onRetry: @escaping () -> Void) {
        self.errorKind = errorKind
        self.hasPartial = hasPartial
        self.onRetry = onRetry
    }

    public var body: some View {
        let fail = theme.brand.feedbackFail
        let title: String = {
            if hasPartial {
                return fcLabel(
                    AgenticLabels.connectionStoppedPartialSaved,
                    AgenticLabels.connectionStoppedPartialSavedFallback
                )
            }
            if errorKind == .network {
                return fcLabel(
                    AgenticLabels.noInternetConnection,
                    AgenticLabels.noInternetConnectionFallback
                )
            }
            return fcLabel(AgenticLabels.somethingWentWrong, AgenticLabels.somethingWentWrongFallback)
        }()
        let icon = errorKind == .network ? "wifi.slash" : "exclamationmark.triangle.fill"

        // StreamErrorCard.kt: 12-radius card (Red500 8% fill, 1pt Red500 16% border, padding 16):
        // [24pt icon, 12, bold bodyMedium title], 16, then a full-width radius-12 button (14pt
        // vertical padding) holding a green 20pt Refresh, 8, and a bold labelLarge "Try again".
        // The 16pt above the card is the bubble's own spacing (see FCAiResponseBubble).
        return VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .semibold))
                    .frame(width: 24, height: 24)
                    .foregroundColor(fail)
                Text(title)
                    .fcTextStyle(theme.typography.bodyMedium)
                    .fontWeight(.bold)
                    .foregroundColor(theme.content.foregroundPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            Button {
                onRetry()
                FarmerChat.shared.analytics.track(
                    AnalyticsEvents.contentTryAgainClicked,
                    props: ["screen_name": ScreenNames.chat]
                )
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 17, weight: .semibold))
                        .frame(width: 20, height: 20)
                        .foregroundColor(theme.content.buttonPrimaryAccent)
                    Text(fcLabel(AgenticLabels.tryAgain, AgenticLabels.tryAgainFallback))
                        .fcTextStyle(theme.typography.labelLarge)
                        .fontWeight(.bold)
                        .foregroundColor(theme.content.buttonPrimaryForeground)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(theme.content.buttonPrimarySurface)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(fail.opacity(0.08))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(fail.opacity(0.16), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

// MARK: - Alignment chips

/// Visual treatments for an alignment chip, matching Compose's `ChipType`.
enum FCChipType {
    /// A live option on an open surface.
    case agentic
    /// A live option on an urgent (escalate) surface.
    case escalate
    /// Faded back: another chip on this surface has already been picked.
    case suggested
}

/// One numbered quick-reply chip. Port of `components/chips/Chip.kt`: radius 12, padding
/// 14/14/14/10, 8pt gaps, a 24pt number badge (a check badge once picked), a labelMedium label
/// (Bold only when selected) and a 24pt chevron while it still takes taps. Surface, label, chevron,
/// border and badge colours follow Chip.kt's tables exactly.
struct FCAlignmentChipView: View {
    @Environment(\.fcTheme) private var theme
    let label: String
    let number: Int?
    let type: FCChipType
    let selected: Bool
    let enabled: Bool
    let onTap: () -> Void

    var body: some View {
        let c = theme.content
        let red = theme.brand.feedbackFail
        let isEscalate = type == .escalate
        let clickable = enabled && !selected
        let selectedAccent = isEscalate ? red : c.buttonPrimaryAccent
        let surface: Color = {
            if selected { return isEscalate ? red.opacity(0.08) : c.surfaceActive }
            if !enabled { return c.surfaceTertiary }
            if isEscalate { return red }
            if type == .agentic { return c.surfaceActive }
            return c.surfaceReadingSecondary
        }()
        let labelColor: Color = {
            if selected { return c.foregroundPrimary }
            if !enabled { return c.foregroundSecondary }
            if isEscalate { return theme.brand.foregroundPrimary }
            return c.foregroundPrimary
        }()
        let chevronColor: Color = {
            if !enabled { return c.foregroundTertiary }
            if isEscalate { return theme.brand.foregroundPrimary }
            if type == .agentic { return c.buttonPrimaryAccent }
            return c.foregroundSecondary
        }()
        let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)

        Button(action: onTap) {
            HStack(spacing: 8) {
                if selected {
                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(c.buttonPrimaryForeground)
                        .frame(width: 24, height: 24)
                        .background(Circle().fill(selectedAccent))
                } else if let number {
                    let badge: Color = !enabled ? c.foregroundSecondary
                        : (isEscalate ? theme.brand.foregroundPrimary : c.buttonPrimaryAccent)
                    let numberColor: Color = !enabled ? c.surfaceTertiary
                        : (isEscalate ? red : c.buttonPrimaryForeground)
                    Text("\(number)")
                        .fcTextStyle(theme.typography.labelMedium)
                        .foregroundColor(numberColor)
                        .frame(width: 24, height: 24)
                        .background(Circle().fill(badge))
                }
                Text(label)
                    .fcTextStyle(theme.typography.labelMedium)
                    .fontWeight(selected ? .bold : nil)
                    .foregroundColor(labelColor)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if clickable {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(chevronColor)
                        .frame(width: 24, height: 24)
                }
            }
            .padding(.leading, 14)
            .padding(.trailing, 10)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(surface)
            .overlay(
                Group {
                    if selected {
                        shape.strokeBorder(selectedAccent, lineWidth: 1.5)
                    } else if !enabled {
                        shape.strokeBorder(c.borderDefault, lineWidth: 0.5)
                    }
                }
            )
            .clipShape(shape)
            .contentShape(shape)
        }
        .buttonStyle(.plain)
        .allowsHitTesting(clickable)
    }
}

// MARK: - Alignment surface

/// A server-driven alignment surface (2.0.0): a short prompt the farmer answers by tapping a chip,
/// instead of reading a normal answer. Port of Compose's `AlignmentSurface`.
///
/// Two shapes, decided by `AlignmentKind.isAdditive`:
/// - **Exclusive** (clarify / confirm / escalate / capability prompts) — owns the message area and
///   replaces the answer, so it renders its own heading and, where appropriate, an escape hatch.
/// - **Additive** (gender-select / commodity-confirm) — a nudge BELOW a real answer, so it renders
///   no heading and no escape hatch; the answer above already owns the action row.
///
/// Escalate gets an urgent treatment derived from `feedbackFail`, keeping the card coherent rather
/// than dropping the brand accent into a red surface.
public struct FCAlignmentSurface: View {
    @Environment(\.fcTheme) private var theme
    let kind: AlignmentKind
    let message: String
    let chips: [AlignmentChip]
    let selectedValues: [String]
    let isLoading: Bool
    let isLatest: Bool
    let onChipTap: (AlignmentChip) -> Void
    var onTypeInstead: () -> Void = {}
    /// True when rendering below a real answer; suppresses the heading and escape hatch.
    var additive: Bool
    /// AlignmentSurface.kt Listen pill — shown on the live, non-escalate, exclusive prompt only.
    /// Nil when the response has no server message id to synthesise.
    var listen: FCListenConfig?

    public init(
        kind: AlignmentKind,
        message: String,
        chips: [AlignmentChip],
        selectedValues: [String] = [],
        isLoading: Bool,
        isLatest: Bool,
        onChipTap: @escaping (AlignmentChip) -> Void,
        onTypeInstead: @escaping () -> Void = {},
        additive: Bool? = nil,
        listen: FCListenConfig? = nil
    ) {
        self.kind = kind
        self.message = message
        self.chips = chips
        self.selectedValues = selectedValues
        self.isLoading = isLoading
        self.isLatest = isLatest
        self.onChipTap = onChipTap
        self.onTypeInstead = onTypeInstead
        self.additive = additive ?? kind.isAdditive
        self.listen = listen
    }

    public var body: some View {
        let isEscalate = kind == .escalate
        if isEscalate {
            // Urgent surfaces get a tinted, bordered card so they read differently at a glance.
            let fail = theme.brand.feedbackFail
            content
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(fail.opacity(0.08))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(fail.opacity(0.16), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        } else {
            content.frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    /// AlignmentSurface.kt body: MarkdownText message (bodyMedium), [16 + Listen pill on the live
    /// prompt], 16, then the options — inside a 16-radius 1pt-bordered card for capability prompts —
    /// then the escape hatch. Escalate wraps the whole body in a 16-radius red-tinted card.
    @ViewBuilder
    private var content: some View {
        let isEscalate = kind == .escalate
        let isCapabilityPrompt = kind == .gpsPrompt || kind == .uploadPhoto
        let hasPick = !selectedValues.isEmpty

        VStack(alignment: .leading, spacing: 0) {
            if !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                FCMarkdownText(text: message)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            if !isEscalate && !additive && isLatest && !isLoading, let listen {
                Spacer().frame(height: 16)
                FCListenButton(config: listen)
            }

            Spacer().frame(height: 16)

            if isCapabilityPrompt {
                options
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .strokeBorder(theme.content.borderDefault, lineWidth: 1)
                    )
            } else {
                options
            }

            // Escape hatch: only on an open, exclusive, non-urgent surface that is still the
            // latest. Without it a farmer whose answer is not among the chips has no way forward.
            // One text run — hint (secondary) + " " + CTA (accent, SemiBold); only the CTA taps.
            if !chips.isEmpty && !isEscalate && !isCapabilityPrompt && !additive
                && !hasPick && isLatest && !isLoading {
                Spacer().frame(height: 12)
                HStack(spacing: 6) {
                    Image(systemName: "info.circle")
                        .font(.system(size: 13))
                        .frame(width: 16, height: 16)
                        .foregroundColor(theme.content.buttonPrimaryAccent)
                    Text(escapeHatchText)
                        .fcTextStyle(theme.typography.bodySmall)
                        // SwiftUI paints link runs with the tint, not their foregroundColor.
                        .tint(theme.content.buttonPrimaryAccent)
                        .environment(\.openURL, OpenURLAction { _ in
                            onTypeInstead()
                            return .handled
                        })
                }
            }
        }
    }

    /// Header (clarify / confirm / capability) + the numbered chips, 8pt apart.
    @ViewBuilder
    private var options: some View {
        let isEscalate = kind == .escalate
        let isCapabilityPrompt = kind == .gpsPrompt || kind == .uploadPhoto
        let hasPick = !selectedValues.isEmpty
        let showHeading = !isEscalate && !additive
        // Capability and additive surfaces are single-shot: one tap settles them, so every chip
        // locks. Clarify/confirm stay open so the farmer can pick a different option.
        let chipsLocked = (isCapabilityPrompt || additive) && hasPick

        VStack(alignment: .leading, spacing: 0) {
            if showHeading {
                Text(headingText)
                    .fcTextStyle(theme.typography.titleMedium)
                    .foregroundColor(theme.content.foregroundPrimary)
            }
            if !chips.isEmpty {
                if showHeading { Spacer().frame(height: 16) }
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(chips.enumerated()), id: \.offset) { index, chip in
                        let isSelected = isChipSelected(chip)
                        // Once a pick exists the unpicked chips fade back to Suggested, so the
                        // chosen one reads as the answer rather than one of several live options.
                        let type: FCChipType = {
                            if isEscalate { return (!hasPick || isSelected) ? .escalate : .suggested }
                            return (!hasPick || isSelected) ? .agentic : .suggested
                        }()
                        FCAlignmentChipView(
                            label: chip.label ?? "",
                            number: index + 1,
                            type: type,
                            selected: isSelected,
                            enabled: !isSelected && !isLoading && !chipsLocked,
                            onTap: { onChipTap(chip) }
                        )
                    }
                }
            }
        }
    }

    /// "Don't see your option? Type or say it." as ONE run so it wraps as a sentence; the CTA run
    /// carries a link that `.openURL` above routes to `onTypeInstead`.
    private var escapeHatchText: AttributedString {
        var hint = AttributedString(fcLabel(
            AgenticLabels.dontSeeYourOption,
            AgenticLabels.dontSeeYourOptionFallback
        ))
        hint.foregroundColor = theme.content.foregroundSecondary
        var cta = AttributedString(fcLabel(AgenticLabels.typeOrSayIt, AgenticLabels.typeOrSayItFallback))
        cta.foregroundColor = theme.content.buttonPrimaryAccent
        cta.font = theme.typography.bodySmall.font.weight(.semibold)
        cta.link = URL(string: "fcsdk-type-instead://")
        return hint + AttributedString(" ") + cta
    }

    private var headingText: String {
        switch kind {
        case .gpsPrompt:
            return fcLabel(AgenticLabels.shareLocationTitle, AgenticLabels.shareLocationTitleFallback)
        case .uploadPhoto:
            return fcLabel(AgenticLabels.addOneClearPhoto, AgenticLabels.addOneClearPhotoFallback)
        case .confirm:
            return fcLabel(AgenticLabels.pleaseConfirm, AgenticLabels.pleaseConfirmFallback)
        default:
            return fcLabel(AgenticLabels.chooseOne, AgenticLabels.chooseOneFallback)
        }
    }

    private func isChipSelected(_ chip: AlignmentChip) -> Bool {
        if let value = chip.value, !value.isEmpty, selectedValues.contains(value) { return true }
        if let label = chip.label, !label.isEmpty, selectedValues.contains(label) { return true }
        return false
    }
}
