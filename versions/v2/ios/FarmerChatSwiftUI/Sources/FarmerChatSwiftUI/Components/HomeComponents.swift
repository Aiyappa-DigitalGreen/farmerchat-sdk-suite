import SwiftUI
import FarmerChatCore

// MARK: - PrimaryInputButtons (Photo / Speak / Type sticky header)

public struct FCPrimaryInputButtons: View {
    @Environment(\.fcTheme) private var theme
    var showPhoto: Bool = true
    var showVoice: Bool = true
    let onPhoto: () -> Void
    let onSpeak: () -> Void
    let onType: () -> Void

    public var body: some View {
        HStack(spacing: 10) {
            if showPhoto {
                inputButton(icon: "camera.fill", title: fcLabel(FCLabels.photo, "Photo"), action: onPhoto)
            }
            if showVoice {
                inputButton(icon: "mic.fill", title: fcLabel(FCLabels.speak, "Speak"), action: onSpeak)
            }
            inputButton(icon: "keyboard", title: fcLabel(FCLabels.type, "Type"), action: onType)
        }
    }

    private func inputButton(icon: String, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .semibold))
                Text(title)
                    .fcTextStyle(theme.typography.labelMedium)
            }
            .foregroundColor(theme.content.buttonPrimaryForeground)
            .frame(maxWidth: .infinity)
            .frame(height: 74)
            .background(theme.content.buttonPrimarySurface)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Weather button (HomeAppBar)

public struct FCWeatherButton: View {
    @Environment(\.fcTheme) private var theme
    let weather: WeatherResponse?
    let isLoading: Bool
    let action: () -> Void

    public var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                if isLoading {
                    ProgressView().tint(theme.content.foregroundSecondary)
                } else if let weather {
                    if let icon = weather.weatherIcon, !icon.isEmpty, icon.hasPrefix("http") {
                        FCRemoteImage(urlString: icon, contentMode: .fit)
                            .frame(width: 22, height: 22)
                    } else {
                        Image(systemName: "cloud.sun.fill")
                            .foregroundColor(FCPrimitive.sky400)
                    }
                    if let temp = weather.currentTemp, !temp.isEmpty {
                        Text("\(temp)°")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(theme.content.foregroundPrimary)
                    }
                } else {
                    Image(systemName: "cloud.sun")
                        .foregroundColor(theme.content.foregroundSecondary)
                }
            }
            .padding(.horizontal, 12)
            .frame(height: 38)
            .background(theme.content.surfaceSecondary)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Feed header/footer

public struct FCFeedHeader: View {
    @Environment(\.fcTheme) private var theme

    public var body: some View {
        Text(fcLabel(FCLabels.forYourFarmToday, "For your farm today"))
            .fcTextStyle(theme.typography.titleMedium)
            .foregroundColor(theme.content.foregroundPrimary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, alignment: .center)
    }
}

public struct FCFeedFooter: View {
    @Environment(\.fcTheme) private var theme

    public var body: some View {
        VStack(spacing: 8) {
            FCLogoMark(size: 28, tint: theme.content.foregroundTertiary)
            Text(fcLabel("feed_footer", "You're all caught up for today"))
                .font(.system(size: 14))
                .foregroundColor(theme.content.foregroundSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
    }
}

// MARK: - HomeFeedErrorUI

public struct FCHomeFeedError: View {
    @Environment(\.fcTheme) private var theme
    let message: String
    let onRetry: () -> Void

    public var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 42))
                .foregroundColor(theme.content.foregroundSecondary)
            Text(message)
                .fcTextStyle(theme.typography.bodyLarge)
                .foregroundColor(theme.content.foregroundSecondary)
                .multilineTextAlignment(.center)
            Button(action: onRetry) {
                Text(fcLabel(FCLabels.tryAgain, "Try again"))
                    .fcTextStyle(theme.typography.bodyMedium)
                    .foregroundColor(theme.content.buttonPrimaryForeground)
                    .padding(.horizontal, 28)
                    .frame(height: 46)
                    .background(theme.content.buttonPrimarySurface)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
        .padding(.horizontal, 24)
    }
}

// MARK: - ContentCard (image/statement feed card)

public struct FCContentCard: View {
    @Environment(\.fcTheme) private var theme
    let section: SectionDto
    let onTap: () -> Void
    let onDismiss: () -> Void

    public var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 0) {
                if let imageUrl = section.imageUrl, !imageUrl.isEmpty {
                    FCRemoteImage(urlString: imageUrl)
                        .frame(height: 180)
                        .clipped()
                }
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .top) {
                        Text(section.title ?? section.statement ?? section.questionText ?? "")
                            .fcTextStyle(theme.typography.titleMedium)
                            .foregroundColor(theme.content.foregroundPrimary)
                            .multilineTextAlignment(.leading)
                        Spacer()
                        Button(action: onDismiss) {
                            Image(systemName: "xmark")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(theme.content.foregroundTertiary)
                                .frame(width: 30, height: 30)
                        }
                        .buttonStyle(.plain)
                    }
                    if section.title != nil, let statement = section.statement, !statement.isEmpty {
                        Text(statement)
                            .fcTextStyle(theme.typography.bodyMedium)
                            .foregroundColor(theme.content.foregroundSecondary)
                            .multilineTextAlignment(.leading)
                    }
                    if let cta = section.cta?.text, !cta.isEmpty {
                        HStack(spacing: 4) {
                            Text(cta)
                            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold))
                        }
                        .fcTextStyle(theme.typography.labelMedium)
                        .foregroundColor(theme.brand.surfacePrimary)
                        .padding(.top, 2)
                    }
                }
                .padding(16)
            }
            .background(theme.content.surfaceSecondary)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Select cards (gender / crop / livestock questions)
//
// Port of components/cards/SingleSelectCard.kt + MultiSelectCard.kt via the android SDK's
// Cards.kt:334-780.
//
// WHAT WAS WRONG
// `FCSingleSelectCard` committed the answer on option TAP. Android always requires an
// explicit Confirm, and tapping the selected radio *clears* it — so on iOS a farmer who
// mis-tapped could not change their mind, and the answer was already sent. The whole
// `Selecting → Saving → Feedback → Dismissed` machine was absent on both cards, as was the
// success acknowledgement, so the card simply vanished with no confirmation that the answer
// had been recorded. `FCMultiSelectCard` did require a Save, but rendered options as capsule
// chips in a grid rather than Android's full-width checkbox rows, and had no "none of the
// above" mutual exclusion.

private enum FCSelectCardState {
    case selecting, saving, feedback, dismissed
}

/// The shared card shell: owns the state machine, the confirm bar and the success panel, so
/// the two cards differ only in how they render their options. Android implements the machine
/// twice (Cards.kt:337 and :537) with identical timings; expressing it once here is the same
/// reasoning that put the type scale in Core — two copies of one state machine drift.
private struct FCSelectCardShell<Options: View>: View {
    @Environment(\.fcTheme) private var theme
    let title: String
    let hasSelection: Bool
    /// The host's in-flight flag. Kept alongside the internal `.saving` state because the
    /// parent owns the network call while the card owns the animation timeline.
    let isSubmitting: Bool
    let onConfirm: () -> Void
    let onDismissTapped: () -> Void
    /// Called when the card leaves `.saving` — the point Android notifies the parent, so the
    /// section can be removed from the feed while the acknowledgement is still on screen.
    let onDismissed: () -> Void
    /// `enabled` is false once the answer is being saved: Android disables the radios and
    /// checkboxes for every state after `Selecting`.
    @ViewBuilder var options: (Bool) -> Options

    @State private var state: FCSelectCardState = .selecting
    @State private var showCheckmark = false
    @State private var showText = false

    private var successMessage: String {
        fcLabel(FCLabels.thankYouYourAnswerHelpsUsGiveMoreAccurateAdvice, "Thank you. Your answer helps us give more accurate advice."
        )
    }

    var body: some View {
        Group {
            if state != .dismissed {
                card
            }
        }
        .animation(.easeInOut(duration: 0.25), value: state)
        // Saving -> Feedback after 1000ms, notifying the parent as android does.
        .task(id: state) {
            guard state == .saving else { return }
            try? await Task.sleep(nanoseconds: 1_000_000_000)
            guard !Task.isCancelled else { return }
            state = .feedback
            onDismissed()
        }
        // Feedback -> Dismissed after 3000ms.
        .task(id: state) {
            guard state == .feedback else { return }
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            guard !Task.isCancelled else { return }
            state = .dismissed
        }
        // The checkmark lands first, the text follows 150ms later.
        .task(id: state) {
            guard state == .feedback else {
                showCheckmark = false
                showText = false
                return
            }
            showCheckmark = true
            try? await Task.sleep(nanoseconds: 150_000_000)
            guard !Task.isCancelled else { return }
            showText = true
        }
    }

    private var card: some View {
        VStack(spacing: 0) {
            switch state {
            case .feedback, .dismissed:
                feedbackPanel
            case .selecting, .saving:
                selectingPanel
            }
        }
        .frame(maxWidth: .infinity)
        .background(theme.content.surfaceSecondary)
        // Radius.XXL, matching Containers.elevated on android.
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .transition(.opacity)
    }

    private var feedbackPanel: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle().fill(theme.content.borderActive)
                Image(systemName: "checkmark")
                    .font(.system(size: 24, weight: .semibold))
                    .foregroundColor(.white)
            }
            .frame(width: 40, height: 40)
            // Compose uses spring(DampingRatioMediumBouncy = 0.5, StiffnessLow = 200).
            // SwiftUI's interpolatingSpring takes damping, which for mass 1 is
            // 2 * ratio * sqrt(stiffness) = 2 * 0.5 * sqrt(200) ≈ 14.14.
            .scaleEffect(showCheckmark ? 1.0 : 0.3)
            .animation(.interpolatingSpring(stiffness: 200, damping: 14.14), value: showCheckmark)

            if showText {
                Text(successMessage)
                    .fcTextStyle(theme.typography.bodyLarge)
                    .foregroundColor(theme.content.foregroundPrimary)
                    .multilineTextAlignment(.center)
                    .transition(.opacity.animation(.easeInOut(duration: 0.4)))
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 40)
        .padding(.vertical, 24)
    }

    private var selectingPanel: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .top) {
                    Text(title)
                        .fcTextStyle(theme.typography.bodyLarge)
                        .foregroundColor(theme.content.foregroundPrimary)
                    Spacer()
                    Button(action: onDismissTapped) {
                        Image(systemName: "xmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(theme.content.foregroundTertiary)
                            .frame(width: 30, height: 30)
                    }
                    .buttonStyle(.plain)
                }

                VStack(spacing: 6) {
                    options(state == .selecting)
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 26)
            .padding(.bottom, 20)

            // The confirm bar exists only once something is picked, and is flush to the
            // card's edges — android wraps a PrimaryButton with `radius = Radius.NONE` in a
            // full-width Surface, so the card's own corner radius is what rounds it.
            if hasSelection {
                let saving = state == .saving || isSubmitting
                Button(action: {
                    guard !saving else { return }
                    onConfirm()
                    state = .saving
                }) {
                    HStack(spacing: 8) {
                        if saving {
                            ProgressView()
                                .tint(theme.content.buttonPrimaryForeground)
                        }
                        Text(saving
                             ? fcLabel(FCLabels.saving, "Saving")
                             : fcLabel(FCLabels.confirm, "Confirm"))
                            .fcTextStyle(theme.typography.labelLarge)
                    }
                    .foregroundColor(theme.content.buttonPrimaryForeground)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(theme.content.buttonPrimarySurface)
                }
                .buttonStyle(.plain)
                .disabled(saving)
            }
        }
    }
}

/// Android's `Checkbox` (Form.kt:352): a full-width selectable card, NOT a tick box — the
/// selected state is carried by the fill and border, which is why iOS's capsule chips with a
/// checkmark glyph read as a different control.
private struct FCCheckboxRow: View {
    @Environment(\.fcTheme) private var theme
    let label: String
    let checked: Bool
    let enabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .fcTextStyle(theme.typography.bodySmall)
                .foregroundColor(theme.content.foregroundPrimary)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 15)
                .padding(.vertical, 12)
                .background(checked ? theme.content.surfaceActive : theme.content.surfaceSecondary)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(checked ? theme.content.borderActive : theme.content.borderDefault,
                                lineWidth: 0.25)
                )
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }
}

public struct FCSingleSelectCard: View {
    let section: SectionDto
    var isSubmitting: Bool
    let onSubmit: (SectionOption) -> Void
    let onDismiss: () -> Void

    @State private var selectedId: String?

    public init(section: SectionDto,
                isSubmitting: Bool,
                onSubmit: @escaping (SectionOption) -> Void,
                onDismiss: @escaping () -> Void) {
        self.section = section
        self.isSubmitting = isSubmitting
        self.onSubmit = onSubmit
        self.onDismiss = onDismiss
    }

    public var body: some View {
        let options = section.options ?? []
        FCSelectCardShell(
            title: section.statement ?? section.title ?? "",
            hasSelection: selectedId != nil,
            isSubmitting: isSubmitting,
            onConfirm: {
                if let id = selectedId, let picked = options.first(where: { $0.id == id }) {
                    onSubmit(picked)
                }
            },
            onDismissTapped: onDismiss,
            onDismissed: {}
        ) { enabled in
            ForEach(options) { option in
                FCRadioRow(
                    title: option.text ?? "",
                    selected: selectedId == option.id,
                    action: {
                        guard enabled else { return }
                        // Re-tapping the selected radio CLEARS it (Cards.kt:492) — the
                        // farmer's escape hatch, and the reason tap must not commit.
                        selectedId = (selectedId == option.id) ? nil : option.id
                    }
                )
            }
        }
    }
}

public struct FCMultiSelectCard: View {
    let section: SectionDto
    var isSubmitting: Bool
    let onSubmit: ([SectionOption]) -> Void
    let onDismiss: () -> Void

    @State private var selectedIds = Set<String>()

    public init(section: SectionDto,
                isSubmitting: Bool,
                onSubmit: @escaping ([SectionOption]) -> Void,
                onDismiss: @escaping () -> Void) {
        self.section = section
        self.isSubmitting = isSubmitting
        self.onSubmit = onSubmit
        self.onDismiss = onDismiss
    }

    /// Port of the mutual exclusion at Cards.kt:705-735: picking "none of the above" clears
    /// everything else, and picking anything else clears "none of the above".
    private func isNoneOfTheAbove(_ option: SectionOption) -> Bool {
        let id = option.id.lowercased()
        if id == "none" || id.contains("none_of_the_above") { return true }
        return (option.text ?? "").trimmingCharacters(in: .whitespaces)
            .caseInsensitiveCompare("none of the above") == .orderedSame
    }

    private func toggle(_ option: SectionOption, in options: [SectionOption]) {
        if isNoneOfTheAbove(option) {
            selectedIds = selectedIds.contains(option.id) ? [] : [option.id]
            return
        }
        var updated = selectedIds
        for other in options where isNoneOfTheAbove(other) {
            updated.remove(other.id)
        }
        if updated.contains(option.id) {
            updated.remove(option.id)
        } else {
            updated.insert(option.id)
        }
        selectedIds = updated
    }

    public var body: some View {
        let options = section.options ?? []
        FCSelectCardShell(
            title: section.statement ?? section.title ?? "",
            hasSelection: !selectedIds.isEmpty,
            isSubmitting: isSubmitting,
            onConfirm: { onSubmit(options.filter { selectedIds.contains($0.id) }) },
            onDismissTapped: onDismiss,
            onDismissed: {}
        ) { enabled in
            ForEach(options) { option in
                FCCheckboxRow(
                    label: option.text ?? "",
                    checked: selectedIds.contains(option.id),
                    enabled: enabled,
                    action: { toggle(option, in: options) }
                )
            }
        }
    }
}


// MARK: - SsfrCard (wheat/maize)

public struct FCSsfrCard: View {
    @Environment(\.fcTheme) private var theme
    let onCropSelected: (String) -> Void

    public var body: some View {
        // App parity (Cards.kt:797-831): 4pt row spacing, a bold bodyMedium title over a
        // bodySmall description, then the crop row at 8pt.
        VStack(alignment: .leading, spacing: 4) {
            Text(fcLabel(FCLabels.ssfrAdvisory, "SSFR Advisory"))
                .fcTextStyle(theme.typography.bodyMedium)
                .fontWeight(.bold)
                .foregroundColor(theme.content.foregroundPrimary)
                .lineLimit(1)
                .truncationMode(.tail)

            Text(fcLabel(FCLabels.ssfrAdvisoryDescription, "Access site specific fertilizer recommendations"))
                .fcTextStyle(theme.typography.bodySmall)
                .foregroundColor(theme.content.foregroundPrimary)
                .lineLimit(2)
                .truncationMode(.tail)

            Spacer().frame(height: 4)

            HStack(spacing: 8) {
                cropButton(name: "wheat", emoji: "🌾", label: fcLabel(FCLabels.ssfrWheat, "Wheat"))
                cropButton(name: "maize", emoji: "🌽", label: fcLabel(FCLabels.ssfrMaize, "Maize"))
            }
            .frame(maxWidth: .infinity)
        }
        .padding(16)
        .background(theme.content.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    /// App parity (Cards.kt:848-889). The SDK drew a pale `surfaceActive` chip with an SF
    /// symbol and no trailing affordance; android's is a solid green `buttonPrimarySurface`
    /// pill with the crop EMOJI, the label, and a chevron in `buttonPrimaryAccent` — so the
    /// SDK's version did not read as the primary action it is.
    private func cropButton(name: String, emoji: String, label: String) -> some View {
        Button(action: { onCropSelected(name) }) {
            HStack(spacing: 8) {
                Text(emoji)
                    .font(.system(size: 16))
                    .multilineTextAlignment(.center)
                Text(label)
                    .fcTextStyle(theme.typography.labelMedium)
                    .fontWeight(.semibold)
                    .foregroundColor(theme.content.buttonPrimaryForeground)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.right")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(theme.content.buttonPrimaryAccent)
            }
            .padding(.leading, 10)
            .padding(.trailing, 8)
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .background(theme.content.buttonPrimarySurface)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Text input overlay (bottom sheet style, imePadding equivalent)

public struct FCTextInputOverlay: View {
    @Environment(\.fcTheme) private var theme
    @Binding var text: String
    let placeholder: String
    let onSend: (String) -> Void
    let onDismiss: () -> Void
    @FocusState private var focused: Bool

    public var body: some View {
        ZStack(alignment: .bottom) {
            theme.content.scrim
                .ignoresSafeArea()
                .onTapGesture(perform: onDismiss)

            HStack(spacing: 10) {
                TextField(placeholder, text: $text, axis: .vertical)
                    .lineLimit(1...4)
                    .focused($focused)
                    .fcTextStyle(theme.typography.bodyLarge)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 12)
                    .background(theme.content.surfaceSecondary)
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))

                Button {
                    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !trimmed.isEmpty else { return }
                    onSend(trimmed)
                } label: {
                    Image(systemName: "arrow.up")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.white)
                        .frame(width: 46, height: 46)
                        .background(theme.content.buttonPrimarySurface)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
            .padding(12)
            .background(theme.content.surfacePrimary)
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { focused = true }
        }
    }
}

// MARK: - Voice input overlay (recording sheet, port of VoiceInput)

public struct FCVoiceInputOverlay: View {
    @Environment(\.fcTheme) private var theme
    @ObservedObject var recorder: AudioRecorderService
    let onFinished: (RecordedClip) -> Void
    let onCancel: () -> Void

    public var body: some View {
        ZStack(alignment: .bottom) {
            theme.content.scrim
                .ignoresSafeArea()
                .onTapGesture { cancel() }

            VStack(spacing: 20) {
                Text(recorder.isRecording
                     ? fcLabel(FCLabels.listening, "Listening…")
                     : fcLabel("voice_preparing", "Getting ready…"))
                    .fcTextStyle(theme.typography.titleLarge)
                    .foregroundColor(theme.content.foregroundPrimary)

                // Simple level meter.
                HStack(spacing: 4) {
                    ForEach(0..<24, id: \.self) { index in
                        Capsule()
                            .fill(theme.brand.foregroundSecondary)
                            .frame(width: 4, height: barHeight(index))
                    }
                }
                .frame(height: 44)
                .animation(.easeOut(duration: 0.1), value: recorder.meterLevel)

                Text(timeString)
                    .font(.system(size: 15, design: .monospaced))
                    .foregroundColor(theme.content.foregroundSecondary)

                HStack(spacing: 40) {
                    Button(action: cancel) {
                        Image(systemName: "xmark")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundColor(theme.content.foregroundPrimary)
                            .frame(width: 56, height: 56)
                            .background(theme.content.surfaceTertiary)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)

                    Button(action: finish) {
                        Image(systemName: "checkmark")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundColor(.white)
                            .frame(width: 68, height: 68)
                            .background(theme.content.buttonPrimarySurface)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(24)
            .frame(maxWidth: .infinity)
            .background(theme.content.surfacePrimary)
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 24, topTrailingRadius: 24))
        }
    }

    private var timeString: String {
        let total = Int(recorder.elapsedSeconds)
        return String(format: "%d:%02d", total / 60, total % 60)
    }

    private func barHeight(_ index: Int) -> CGFloat {
        let base = CGFloat(8 + (index * 7919) % 18)
        return 6 + base * CGFloat(recorder.meterLevel)
    }

    private func finish() {
        guard let clip = try? recorder.stopRecording() else {
            onCancel()
            return
        }
        onFinished(clip)
    }

    private func cancel() {
        recorder.cancelRecording()
        onCancel()
    }
}

// MARK: - Photo input source chooser (port of PhotoInput)

public struct FCPhotoSourceSheet: View {
    @Environment(\.fcTheme) private var theme
    let onCamera: () -> Void
    let onGallery: () -> Void
    let onCancel: () -> Void

    public var body: some View {
        ZStack(alignment: .bottom) {
            theme.content.scrim
                .ignoresSafeArea()
                .onTapGesture(perform: onCancel)

            VStack(spacing: 10) {
                Capsule()
                    .fill(theme.content.borderDefault)
                    .frame(width: 42, height: 5)
                    .padding(.top, 10)
                Text(fcLabel("photo_source_title", "Add a photo"))
                    .fcTextStyle(theme.typography.titleMedium)
                    .foregroundColor(theme.content.foregroundPrimary)
                    .padding(.bottom, 4)
                FCListItem(icon: "camera.fill", title: fcLabel("photo_take", "Take a photo"), showChevron: false, action: onCamera)
                FCListItem(icon: "photo.on.rectangle", title: fcLabel("photo_gallery", "Choose from gallery"), showChevron: false, action: onGallery)
            }
            .padding(.bottom, 24)
            .frame(maxWidth: .infinity)
            .background(theme.content.surfacePrimary)
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 24, topTrailingRadius: 24))
        }
    }
}

// MARK: - Permission settings dialog (after 2 denials)

public struct FCPermissionSettingsDialog: View {
    let title: String
    let message: String
    let onDismiss: () -> Void

    public var body: some View {
        EmptyView()
            .alert(title, isPresented: .constant(true)) {
                Button(fcLabel("open_settings", "Open Settings")) {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                    onDismiss()
                }
                Button(fcLabel(FCLabels.cancel, "Cancel"), role: .cancel, action: onDismiss)
            } message: {
                Text(message)
            }
    }
}
