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
                FCThinkingIndicator(
                    label: fcLabel(
                        AgenticLabels.responsePausedResuming,
                        AgenticLabels.responsePausedResumingFallback
                    )
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

        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(fail)
                Text(title)
                    .fcTextStyle(theme.typography.titleSmall)
                    .foregroundColor(theme.content.foregroundPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            FCPrimaryButton(
                title: fcLabel(AgenticLabels.tryAgain, AgenticLabels.tryAgainFallback),
                action: onRetry
            )
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(fail.opacity(0.08))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(fail.opacity(0.16), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
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

/// One numbered quick-reply chip.
struct FCAlignmentChipView: View {
    @Environment(\.fcTheme) private var theme
    let label: String
    let number: Int
    let type: FCChipType
    let selected: Bool
    let enabled: Bool
    let onTap: () -> Void

    var body: some View {
        let accent: Color = {
            switch type {
            case .agentic: return theme.content.borderActive
            case .escalate: return theme.brand.feedbackFail
            case .suggested: return theme.content.borderDefault
            }
        }()
        Button(action: onTap) {
            HStack(spacing: 10) {
                Text("\(number)")
                    .fcTextStyle(theme.typography.labelMedium)
                    .foregroundColor(selected ? theme.content.buttonPrimaryForeground : accent)
                    .frame(width: 20, height: 20)
                    .background(selected ? accent : accent.opacity(0.14))
                    .clipShape(Circle())
                Text(label)
                    .fcTextStyle(theme.typography.labelMedium)
                    .foregroundColor(theme.content.foregroundPrimary)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(selected ? accent.opacity(0.12) : theme.content.surfaceSecondary)
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(accent.opacity(selected ? 0.9 : 0.35), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .allowsHitTesting(enabled)
        .opacity(enabled || selected ? 1 : 0.6)
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

    public init(
        kind: AlignmentKind,
        message: String,
        chips: [AlignmentChip],
        selectedValues: [String] = [],
        isLoading: Bool,
        isLatest: Bool,
        onChipTap: @escaping (AlignmentChip) -> Void,
        onTypeInstead: @escaping () -> Void = {},
        additive: Bool? = nil
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

    @ViewBuilder
    private var content: some View {
        let isEscalate = kind == .escalate
        let isCapabilityPrompt = kind == .gpsPrompt || kind == .uploadPhoto
        let hasPick = !selectedValues.isEmpty
        // Capability and additive surfaces are single-shot: one tap settles them, so every chip
        // locks. Clarify/confirm stay open so the farmer can pick a different option.
        let chipsLocked = (isCapabilityPrompt || additive) && hasPick

        VStack(alignment: .leading, spacing: 0) {
            if !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                FCMarkdownText(text: message)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Spacer().frame(height: isEscalate || additive ? 12 : 16)
            }

            if !isEscalate && !additive {
                Text(headingText)
                    .fcTextStyle(theme.typography.titleMedium)
                    .foregroundColor(theme.content.foregroundPrimary)
                Spacer().frame(height: 16)
            }

            if !chips.isEmpty {
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

            // Escape hatch: only on an open, exclusive, non-urgent surface that is still the
            // latest. Without it a farmer whose answer is not among the chips has no way forward.
            if !chips.isEmpty && !isEscalate && !isCapabilityPrompt && !additive
                && !hasPick && isLatest && !isLoading {
                Spacer().frame(height: 12)
                HStack(spacing: 6) {
                    Image(systemName: "info.circle")
                        .font(.system(size: 13))
                        .foregroundColor(theme.content.buttonPrimaryAccent)
                    Text(fcLabel(
                        AgenticLabels.dontSeeYourOption,
                        AgenticLabels.dontSeeYourOptionFallback
                    ))
                    .fcTextStyle(theme.typography.bodySmall)
                    .foregroundColor(theme.content.foregroundSecondary)
                    Button(action: onTypeInstead) {
                        Text(fcLabel(AgenticLabels.typeOrSayIt, AgenticLabels.typeOrSayItFallback))
                            .fcTextStyle(theme.typography.bodySmall)
                            .foregroundColor(theme.content.buttonPrimaryAccent)
                    }
                    .buttonStyle(.plain)
                    Spacer(minLength: 0)
                }
            }
        }
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
