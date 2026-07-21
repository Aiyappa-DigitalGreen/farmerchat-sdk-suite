import SwiftUI
import FarmerChatCore

/// Port of HomeScreen: app bar (hamburger + weather), greeting, sticky
/// Photo/Speak/Type header, SSFR card, feed sections
/// (content/single-select/multi-select), overlays (type/voice/photo),
/// permission dialogs, transcription routing into Chat.
struct HomeView: View {
    @Environment(\.fcTheme) private var theme
    @EnvironmentObject var router: FCRouter
    @EnvironmentObject var locationPrompt: LocationPromptManager
    @StateObject private var viewModel = HomeViewModel()
    @StateObject private var profileVM = EnterNameViewModel()
    @StateObject private var recorder = AudioRecorderService()
    @StateObject private var toast = FCToastState()

    let openDrawer: () -> Void

    @State private var didLoad = false
    @State private var showTextInput = false
    @State private var typedText = ""
    @State private var showVoiceInput = false
    @State private var showPhotoSheet = false
    @State private var showCamera = false
    @State private var showGallery = false
    @State private var showMicSettingsDialog = false
    @State private var showCameraSettingsDialog = false
    @State private var submittingSectionId: String?
    @State private var pendingCardSection: SectionDto?

    var body: some View {
        ZStack {
            theme.content.surfacePrimary.ignoresSafeArea()

            VStack(spacing: 0) {
                appBar
                content
            }

            if showTextInput {
                FCTextInputOverlay(
                    text: $typedText,
                    placeholder: fcLabel("type_placeholder", "Ask anything about your farm"),
                    onSend: { question in
                        showTextInput = false
                        typedText = ""
                        openChat(FCDestination.ChatArgs(question: question))
                    },
                    onDismiss: { showTextInput = false }
                )
            }

            if showVoiceInput {
                FCVoiceInputOverlay(
                    recorder: recorder,
                    onFinished: { clip in
                        showVoiceInput = false
                        transcribeAndOpenChat(clip: clip)
                    },
                    onCancel: { showVoiceInput = false }
                )
            }

            if showPhotoSheet {
                FCPhotoSourceSheet(
                    onCamera: {
                        showPhotoSheet = false
                        Task {
                            if await FCCameraPermission.request() {
                                showCamera = true
                            } else if FCCameraPermission.shouldShowSettingsDialog() {
                                showCameraSettingsDialog = true
                            }
                        }
                    },
                    onGallery: {
                        showPhotoSheet = false
                        showGallery = true
                    },
                    onCancel: { showPhotoSheet = false }
                )
            }

            if case .loading = viewModel.state.voiceTranscribeState {
                transcribingOverlay
            }
        }
        .fcToastHost(toast)
        .task { await initialLoad() }
        .onChange(of: transcribeResult?.transcriptionId?.stringValue) { _ in
            handleTranscription()
        }
        .onChange(of: imageStatement?.messageId?.stringValue) { _ in
            handleImageStatement()
        }
        .sheet(isPresented: $showCamera) {
            FCCameraPicker { picked in
                showCamera = false
                if let picked {
                    openChat(FCDestination.ChatArgs(question: "", imagePath: picked.fileURL.path))
                }
            }
            .ignoresSafeArea()
        }
        .sheet(isPresented: $showGallery) {
            FCPhotoLibraryPicker { picked in
                showGallery = false
                if let picked {
                    openChat(FCDestination.ChatArgs(question: "", imagePath: picked.fileURL.path))
                }
            }
        }
        .overlay {
            if showMicSettingsDialog {
                FCPermissionSettingsDialog(
                    title: fcLabel("mic_permission_title", "Microphone access needed"),
                    message: fcLabel("mic_permission_message", "Allow microphone access in Settings to ask questions with your voice."),
                    onDismiss: { showMicSettingsDialog = false }
                )
            }
            if showCameraSettingsDialog {
                FCPermissionSettingsDialog(
                    title: fcLabel("camera_permission_title", "Camera access needed"),
                    message: fcLabel("camera_permission_message", "Allow camera access in Settings to ask questions with photos."),
                    onDismiss: { showCameraSettingsDialog = false }
                )
            }
        }
    }

    // MARK: - App bar

    private var appBar: some View {
        HStack {
            Button {
                FarmerChat.shared.analytics.track(AnalyticsEvents.hamburgerMenuClicked)
                openDrawer()
            } label: {
                Image(systemName: "line.3.horizontal")
                    .font(.system(size: 19, weight: .semibold))
                    .foregroundColor(theme.content.foregroundPrimary)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)

            Spacer()

            if FarmerChat.shared.config.enableWeather {
                FCWeatherButton(
                    weather: viewModel.state.weatherState.value,
                    isLoading: viewModel.state.weatherState.isLoading,
                    action: weatherTapped
                )
            }
        }
        .padding(.horizontal, 12)
        .frame(height: 56)
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        switch viewModel.state.homeFeedState {
        case .idle, .loading:
            FCLogoSpinner(message: fcLabel("home_loading", "Getting today's advice"))
        case .error(let message, _, _):
            FCHomeFeedError(message: message) {
                FarmerChat.shared.analytics.track(AnalyticsEvents.contentTryAgainClicked)
                loadHome()
            }
            Spacer()
        case .success(let feed):
            feedList(feed)
        }
    }

    private func feedList(_ feed: HomeUdfResponse) -> some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 14, pinnedViews: [.sectionHeaders]) {
                // Greeting
                Text(greeting(feed))
                    .font(.system(size: 24, weight: .bold))
                    .foregroundColor(theme.content.foregroundPrimary)
                    .padding(.horizontal, 16)
                    .padding(.top, 4)

                Section {
                    if feed.ssfrEnable == true && FarmerChat.shared.config.enableSsfr { // C3
                        FCSsfrCard { crop in
                            openChat(FCDestination.ChatArgs(
                                question: fcLabel("ssfr_question", "Fertilizer advice for {crop}", params: ["crop": crop]),
                                isSSFR: true,
                                ssfrCrop: crop
                            ))
                        }
                        .padding(.horizontal, 16)
                    }

                    FCFeedHeader()
                        .padding(.horizontal, 16)
                        .padding(.top, 6)

                    ForEach(viewModel.state.visibleSections()) { section in
                        sectionView(section)
                            .padding(.horizontal, 16)
                            .onAppear { markViewedIfNeeded(section) }
                    }

                    FCFeedFooter()
                } header: {
                    FCPrimaryInputButtons(
                        showPhoto: FarmerChat.shared.config.enableImages,
                        showVoice: FarmerChat.shared.config.enableVoice,
                        onPhoto: { showPhotoSheet = true },
                        onSpeak: startVoice,
                        onType: { showTextInput = true }
                    )
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(theme.content.surfacePrimary)
                }
            }
            .padding(.bottom, 24)
        }
        .refreshable { loadHome(skipLoadingCheck: true) }
    }

    @ViewBuilder
    private func sectionView(_ section: SectionDto) -> some View {
        switch section.type {
        case "single_select":
            FCSingleSelectCard(
                section: section,
                isSubmitting: submittingSectionId == section.id,
                onSubmit: { option in submitSingleSelect(section: section, option: option) },
                onDismiss: { viewModel.dismissCard(sectionId: section.id) }
            )
        case "multi_select":
            FCMultiSelectCard(
                section: section,
                isSubmitting: submittingSectionId == section.id,
                onSubmit: { options in submitMultiSelect(section: section, options: options) },
                onDismiss: { viewModel.dismissCard(sectionId: section.id) }
            )
        default:
            FCContentCard(
                section: section,
                onTap: { contentCardTapped(section) },
                onDismiss: { viewModel.dismissCard(sectionId: section.id) }
            )
        }
    }

    private var transcribingOverlay: some View {
        ZStack {
            theme.content.scrim.ignoresSafeArea()
            FCLogoSpinner(message: fcLabel("transcribing", "Understanding your question…"))
                .frame(height: 160)
                .background(theme.content.surfacePrimary)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .padding(40)
        }
    }

    // MARK: - Lifecycle / loading

    private func initialLoad() async {
        guard !didLoad else { return }
        didLoad = true
        let env = FarmerChat.shared
        env.analytics.screenViewed(ScreenNames.home)
        if let userId = env.session.userId {
            viewModel.onAction(.newConversation(userId: userId, contentProviderId: nil))
            viewModel.onAction(.fetchUserProfile(userId: userId))
        }
        loadHome()
        viewModel.onAction(.loadWeather(userId: env.session.userId, skipLoadingCheck: false))
    }

    private func loadHome(skipLoadingCheck: Bool = false) {
        viewModel.onAction(.loadHome(
            userDeviceTime: HomeViewModel.currentDeviceTime(),
            userId: FarmerChat.shared.session.userId,
            skipLoadingCheck: skipLoadingCheck
        ))
    }

    private func greeting(_ feed: HomeUdfResponse) -> String {
        if let greeting = feed.greeting, !greeting.isEmpty {
            let name = FarmerChat.shared.prefs.string(.userName) ?? ""
            return LabelManager.applyTemplate(greeting, params: ["name": name])
        }
        return fcLabel("home_greeting", "Hello!")
    }

    // MARK: - Weather (routes through LocationPromptManager)

    private func weatherTapped() {
        FarmerChat.shared.analytics.track(AnalyticsEvents.weatherClicked)
        let question = fcLabel("weather_advice_question", "What does today's weather mean for my farm?")
        if locationPrompt.isLocationKnown {
            openChat(FCDestination.ChatArgs(question: question, isWeatherAdviceCTA: true))
        } else {
            locationPrompt.triggerFromWeather { [weak router] in
                router?.push(.chat(FCDestination.ChatArgs(question: question, isWeatherAdviceCTA: true)))
            }
        }
    }

    // MARK: - Cards

    private func markViewedIfNeeded(_ section: SectionDto) {
        guard section.isViewed != true,
              let statementId = section.statementId,
              let userId = FarmerChat.shared.session.userId else { return }
        viewModel.onAction(.markImageViewed(statementId: statementId, userId: userId))
    }

    private func contentCardTapped(_ section: SectionDto) {
        guard let statementId = section.statementId else {
            // Plain question card without statement — open chat with the question.
            if let question = section.questionText ?? section.title {
                openChat(FCDestination.ChatArgs(question: question))
            }
            return
        }
        pendingCardSection = section
        viewModel.onAction(.fetchImageStatement(statementId: statementId, triggeredInputType: "card"))
    }

    private var imageStatement: ImageStatementResponse? {
        viewModel.state.imageStatementState.value
    }

    private func handleImageStatement() {
        guard let response = imageStatement, let section = pendingCardSection else { return }
        pendingCardSection = nil
        viewModel.onAction(.consumeResult)
        openChat(FCDestination.ChatArgs(
            question: section.questionText ?? section.title ?? "",
            imagePath: nil,
            homeStatementId: response.messageId?.stringValue ?? section.statementId?.stringValue,
            preGeneratedAnswer: response.shortAnswer,
            followUpQuestions: response.followUpQuestions ?? []
        ))
    }

    private func submitSingleSelect(section: SectionDto, option: SectionOption) {
        guard let userId = FarmerChat.shared.session.userId else { return }
        submittingSectionId = section.id
        // Gender / profile single-selects go through update_user_profile.
        profileVM.onAction(
            .updateUserName(body: UserNameRequest(userId: userId, gender: option.text)),
            screenName: ScreenNames.home
        )
        Task {
            try? await Task.sleep(nanoseconds: 900_000_000)
            submittingSectionId = nil
            viewModel.dismissCard(sectionId: section.id)
            toast.show(.success, fcLabel("profile_saved", "Saved!"))
        }
    }

    private func submitMultiSelect(section: SectionDto, options: [SectionOption]) {
        guard let userId = FarmerChat.shared.session.userId else { return }
        submittingSectionId = section.id
        if section.uniqueKey?.contains("livestock") == true || section.statementType?.contains("livestock") == true {
            let details = options.map { LiveStockDetail(id: $0.rawId, name: $0.text) }
            profileVM.onAction(
                .updateUserName(body: UserNameRequest(userId: userId, liveStockDetails: details)),
                screenName: ScreenNames.home
            )
        } else {
            let cropIds = options.compactMap { $0.rawId?.intValue }
            viewModel.onAction(.updateCultivatedCrops(userId: userId, cropIds: cropIds))
        }
        Task {
            try? await Task.sleep(nanoseconds: 900_000_000)
            submittingSectionId = nil
            viewModel.dismissCard(sectionId: section.id)
            toast.show(.success, fcLabel("profile_saved", "Saved!"))
        }
    }

    // MARK: - Voice pipeline (record → transcribe → chat)

    private func startVoice() {
        Task {
            guard await FCMicPermission.request(recorder: recorder) else {
                if FCMicPermission.shouldShowSettingsDialog() {
                    showMicSettingsDialog = true
                } else {
                    toast.show(.error, fcLabel("mic_permission_denied", "Microphone access is needed to speak your question."))
                }
                return
            }
            do {
                try recorder.startRecording()
                showVoiceInput = true
            } catch {
                toast.show(.error, fcLabel("voice_start_failed", "Could not start recording."))
            }
        }
    }

    @State private var lastClip: RecordedClip?

    private func transcribeAndOpenChat(clip: RecordedClip) {
        guard let conversationId = viewModel.conversationId else {
            // No conversation yet — let Chat run the voice-prototype path.
            openChat(FCDestination.ChatArgs(question: "", audioPath: clip.fileURL.path))
            return
        }
        lastClip = clip
        viewModel.onAction(.transcribeAudio(
            conversationId: conversationId,
            base64Query: clip.base64Audio,
            messageReferenceId: UUID().uuidString,
            audioFormat: AudioRecorderService.audioFormatField,
            triggeredType: "voice"
        ))
    }

    private var transcribeResult: GetVoiceResponse? {
        viewModel.state.voiceTranscribeState.value
    }

    private func handleTranscription() {
        guard let response = transcribeResult else {
            if case .error(let message, _, _) = viewModel.state.voiceTranscribeState {
                toast.show(.error, message)
                viewModel.onAction(.clearTranscriptionState)
            }
            return
        }
        viewModel.onAction(.clearTranscriptionState)
        guard response.isAcceptable, let question = response.heardInputQuery else {
            toast.show(.error, fcLabel("transcription_failed", "We couldn't hear that. Please try again."))
            return
        }
        openChat(FCDestination.ChatArgs(
            question: question,
            transcriptionId: response.transcriptionId?.stringValue,
            audioPath: lastClip?.fileURL.path
        ))
        lastClip = nil
    }

    // MARK: - Navigation

    private func openChat(_ args: FCDestination.ChatArgs) {
        router.push(.chat(args))
    }
}
