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
                inputButton(icon: "camera.fill", title: fcLabel("input_photo", "Photo"), action: onPhoto)
            }
            if showVoice {
                inputButton(icon: "mic.fill", title: fcLabel("input_speak", "Speak"), action: onSpeak)
            }
            inputButton(icon: "keyboard", title: fcLabel("input_type", "Type"), action: onType)
        }
    }

    private func inputButton(icon: String, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .semibold))
                Text(title)
                    .font(.system(size: 14, weight: .semibold))
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
        Text(fcLabel("feed_header", "For your farm today"))
            .font(.system(size: 18, weight: .bold))
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
                .font(.system(size: 16))
                .foregroundColor(theme.content.foregroundSecondary)
                .multilineTextAlignment(.center)
            Button(action: onRetry) {
                Text(fcLabel("try_again", "Try again"))
                    .font(.system(size: 16, weight: .semibold))
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
                            .font(.system(size: 17, weight: .semibold))
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
                            .font(.system(size: 15))
                            .foregroundColor(theme.content.foregroundSecondary)
                            .multilineTextAlignment(.leading)
                    }
                    if let cta = section.cta?.text, !cta.isEmpty {
                        HStack(spacing: 4) {
                            Text(cta)
                            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold))
                        }
                        .font(.system(size: 15, weight: .semibold))
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

// MARK: - SingleSelectCard (gender question)

public struct FCSingleSelectCard: View {
    @Environment(\.fcTheme) private var theme
    let section: SectionDto
    @State private var selectedId: String?
    var isSubmitting: Bool
    let onSubmit: (SectionOption) -> Void
    let onDismiss: () -> Void

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                Text(section.statement ?? section.title ?? "")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(theme.content.foregroundPrimary)
                Spacer()
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(theme.content.foregroundTertiary)
                        .frame(width: 30, height: 30)
                }
                .buttonStyle(.plain)
            }
            ForEach(section.options ?? []) { option in
                FCRadioRow(
                    title: option.text ?? "",
                    selected: selectedId == option.id,
                    action: {
                        selectedId = option.id
                        onSubmit(option)
                    }
                )
            }
            if isSubmitting {
                ProgressView()
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(16)
        .background(theme.content.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

// MARK: - MultiSelectCard (crops / livestock)

public struct FCMultiSelectCard: View {
    @Environment(\.fcTheme) private var theme
    let section: SectionDto
    @State private var selectedIds = Set<String>()
    var isSubmitting: Bool
    let onSubmit: ([SectionOption]) -> Void
    let onDismiss: () -> Void

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                Text(section.statement ?? section.title ?? "")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundColor(theme.content.foregroundPrimary)
                Spacer()
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(theme.content.foregroundTertiary)
                        .frame(width: 30, height: 30)
                }
                .buttonStyle(.plain)
            }

            FlowChips(options: section.options ?? [], selectedIds: $selectedIds)

            FCPrimaryButton(
                title: fcLabel("save", "Save"),
                state: isSubmitting ? .loading : .normal,
                enabled: !selectedIds.isEmpty,
                action: {
                    let picked = (section.options ?? []).filter { selectedIds.contains($0.id) }
                    onSubmit(picked)
                }
            )
        }
        .padding(16)
        .background(theme.content.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    private struct FlowChips: View {
        @Environment(\.fcTheme) private var theme
        let options: [SectionOption]
        @Binding var selectedIds: Set<String>

        var body: some View {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), spacing: 8)], spacing: 8) {
                ForEach(options) { option in
                    let isSelected = selectedIds.contains(option.id)
                    Button {
                        if isSelected {
                            selectedIds.remove(option.id)
                        } else {
                            selectedIds.insert(option.id)
                        }
                    } label: {
                        HStack(spacing: 6) {
                            if isSelected {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 11, weight: .bold))
                            }
                            Text(option.text ?? "")
                                .font(.system(size: 14, weight: .medium))
                                .lineLimit(1)
                        }
                        .foregroundColor(isSelected ? theme.brand.surfacePrimary : theme.content.foregroundPrimary)
                        .padding(.horizontal, 12)
                        .frame(height: 38)
                        .frame(maxWidth: .infinity)
                        .background(isSelected ? theme.content.surfaceActive : theme.content.surfaceTertiary)
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

// MARK: - SsfrCard (wheat/maize)

public struct FCSsfrCard: View {
    @Environment(\.fcTheme) private var theme
    let onCropSelected: (String) -> Void

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(fcLabel("ssfr_title", "Get fertilizer advice for your crop"))
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(theme.content.foregroundPrimary)
            HStack(spacing: 10) {
                cropButton(name: "wheat", label: fcLabel("ssfr_wheat", "Wheat"), symbol: "laurel.leading")
                cropButton(name: "maize", label: fcLabel("ssfr_maize", "Maize"), symbol: "leaf.fill")
            }
        }
        .padding(16)
        .background(theme.content.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    }

    private func cropButton(name: String, label: String, symbol: String) -> some View {
        Button(action: { onCropSelected(name) }) {
            HStack(spacing: 8) {
                Image(systemName: symbol)
                Text(label).font(.system(size: 15, weight: .semibold))
            }
            .foregroundColor(theme.brand.surfacePrimary)
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .background(theme.content.surfaceActive)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
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
                    .font(.system(size: 17))
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
                     ? fcLabel("voice_listening", "Listening…")
                     : fcLabel("voice_preparing", "Getting ready…"))
                    .font(.system(size: 17, weight: .medium))
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
                    .font(.system(size: 17, weight: .semibold))
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
                Button(fcLabel("cancel", "Cancel"), role: .cancel, action: onDismiss)
            } message: {
                Text(message)
            }
    }
}
