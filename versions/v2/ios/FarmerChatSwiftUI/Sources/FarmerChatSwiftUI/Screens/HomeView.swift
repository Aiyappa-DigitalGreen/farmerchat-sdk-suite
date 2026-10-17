import SwiftUI
import FarmerChatCore

/// Port of the app's composer Home (HomeScreen.kt with `getComposerUiEnabled()` — hard-wired true
/// in the app): the green band behind a transparent feed, HomeAppBar (menu + weather), the fixed
/// header (logo, "For your farm today", location pill) over the feed, SSFR card, feed sections
/// (content/single-select/multi-select), the floating InputComposer (camera / text / mic; a picked
/// photo is attached and sent with the typed caption), voice/photo overlays, permission dialogs,
/// transcription routing into Chat.
///
/// The SDK used to draw the 1.0 Home: a plain white bar, a black greeting and the big sticky
/// Photo/Speak/Type buttons — which the app's composer Home replaces.
struct HomeView: View {
    @Environment(\.fcFallbackCloseShown) private var fallbackCloseShown
    @Environment(\.fcTheme) private var theme
    @EnvironmentObject var router: FCRouter
    @EnvironmentObject var locationPrompt: LocationPromptManager
    @StateObject private var viewModel = HomeViewModel()
    @StateObject private var profileVM = EnterNameViewModel()
    @StateObject private var recorder = AudioRecorderService()
    @StateObject private var toast = FCToastState()

    let openDrawer: () -> Void

    @State private var didLoad = false
    @State private var typedText = ""
    @State private var showVoiceInput = false
    @State private var showPhotoSheet = false
    @State private var showCamera = false
    @State private var showGallery = false
    @State private var showMicSettingsDialog = false
    @State private var showCameraSettingsDialog = false
    @State private var submittingSectionId: String?
    @State private var pendingCardSection: SectionDto?
    @State private var composerPhoto: FCPickedImage?
    @State private var composerFocusRequest = false
    @State private var composerHeight: CGFloat = 0
    @State private var headerHeight: CGFloat = 0
    @State private var pillSuccess = false
    @State private var pillFlowWasActive = false
    @State private var pillTick = 0

    var body: some View {
        ZStack {
            theme.content.surfacePrimary.ignoresSafeArea()
            FCHomeBand()

            VStack(spacing: 0) {
                appBar
                content
            }

            VStack(spacing: 0) {
                Spacer(minLength: 0)
                composer
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
        // Permission changes in Settings: re-read the pill on every foreground.
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            pillTick += 1
        }
        // App HomeScreen.kt:256-266: a location Error while Home is the visible screen goes to the
        // shared Error screen and the flow is closed silently. Gated on Home being on top — Home
        // stays alive under Chat, and the chat chip's errors belong to the global host there.
        .onReceive(locationPrompt.$state) { state in
            pillStateChanged(state)
            guard case .error(let type) = state, router.current == .home else { return }
            router.push(.error(isNetworkError: type == .noNetwork, fromScreen: "home"))
            locationPrompt.dismiss(emitContinue: false)
        }
        // App HomeScreen.kt:282-298: reload feed AND weather on a Campaign update or a
        // LocalContext success (never on a dismiss/deny).
        .onReceive(locationPrompt.events) { event in
            let isLocalContextSuccess = event == .locationSaved(source: .localContext)
            guard event == .locationUpdatedFromWidget || isLocalContextSuccess else { return }
            loadHome(skipLoadingCheck: true)
            viewModel.onAction(.loadWeather(userId: FarmerChat.shared.session.userId, skipLoadingCheck: true))
        }
        .onChange(of: transcribeResult?.transcriptionId?.stringValue) { _ in
            handleTranscription()
        }
        .onChange(of: imageStatement?.messageId?.stringValue) { _ in
            handleImageStatement()
        }
        .sheet(isPresented: $showCamera) {
            FCCameraPicker { picked in
                showCamera = false
                // Composer Home: the photo is ATTACHED so it can go with a typed caption
                // (HomeScreen.kt:350/386); a new pick replaces the old.
                if let picked { attach(picked) }
            }
            .ignoresSafeArea()
        }
        .sheet(isPresented: $showGallery) {
            FCPhotoLibraryPicker { picked in
                showGallery = false
                if let picked { attach(picked) }
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
        // SDK addition: a presenter's fallback close (X) sits at the bar's trailing end; keep the
        // weather pill clear of it.
        FCHomeAppBar(
            showMenu: FarmerChat.shared.config.showDrawer,
            // HomeScreen.kt: the pill shows once weather is loading or loaded.
            showWeather: FarmerChat.shared.config.enableWeather
                && (viewModel.state.weatherState.value != nil || viewModel.state.weatherState.isLoading),
            weather: viewModel.state.weatherState.value,
            weatherLoading: viewModel.state.weatherState.isLoading,
            trailingInset: fallbackCloseShown ? 48 : 0,
            onMenu: {
                FarmerChat.shared.analytics.track(AnalyticsEvents.hamburgerMenuClicked)
                openDrawer()
            },
            onWeather: weatherTapped
        )
    }

    // MARK: - Composer (InputComposer, floating)

    private var composer: some View {
        FCChatComposer(
            text: $typedText,
            placeholder: fcLabel(FCLabels.askAboutYourFarm, "Ask about your farm..."),
            showCamera: FarmerChat.shared.config.enableImages,
            showMic: FarmerChat.shared.config.enableVoice,
            backdrop: .clear,
            attachment: composerPhoto?.image,
            onRemoveAttachment: { composerPhoto = nil },
            focusRequest: $composerFocusRequest,
            onSend: { question in
                let photo = composerPhoto
                composerPhoto = nil
                typedText = ""
                // HomeScreen.kt sendMessage(query, photoUris.firstOrNull()): text and/or photo
                // open Chat, which sends them together.
                openChat(FCDestination.ChatArgs(question: question, imagePath: photo?.fileURL.path))
            },
            // Camera is offered only while nothing is attached (one image).
            onCamera: { if composerPhoto == nil { showPhotoSheet = true } },
            onMic: startVoice
        )
        .onPreferenceChange(FCComposerHeightKey.self) { composerHeight = $0 }
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        if locationPrompt.isCampaignLocationLoading {
            // App `isWidgetGpsLoading`: only a CAMPAIGN flow replaces the feed with this spinner.
            FCLogoSpinner(message: fcLabel(FCLabels.gettingYourLocation, "Getting your location..."))
        } else {
            feedContent
        }
    }

    @ViewBuilder
    private var feedContent: some View {
        switch viewModel.state.homeFeedState {
        case .idle, .loading:
            FCLogoSpinner(message: fcLabel(FCLabels.gettingTodaysAdvice, "Getting today's advice"))
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
        ZStack(alignment: .top) {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    // Item 0 reserves exactly the fixed header's height, so the first card rests
                    // right below it (HomeScreen.kt 70adc5fd).
                    Color.clear.frame(height: max(headerHeight, 1))

                    if feed.ssfrEnable == true && FarmerChat.shared.config.enableSsfr { // C3
                        FCSsfrCard { crop in
                            openChat(FCDestination.ChatArgs(
                                question: fcLabel("ssfr_question", "Fertilizer advice for {crop}", params: ["crop": crop]),
                                isSSFR: true,
                                ssfrCrop: crop
                            ))
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 16)
                    }

                    // The composer Home shows "For your farm today" in the fixed header, so the
                    // in-feed FeedHeader is skipped (HomeScreen.kt:1308).
                    ForEach(viewModel.state.visibleSections()) { section in
                        sectionView(section)
                            .padding(.horizontal, 16)
                            // HomeScreen.kt:1507 — a trailing 16pt gap after every card.
                            .padding(.bottom, 16)
                            .onAppear { markViewedIfNeeded(section) }
                    }

                    FCFeedFooter()
                }
                // Reserve the floating composer so the last card is not hidden behind it.
                .padding(.bottom, composerHeight + 8)
            }
            .refreshable { loadHome(skipLoadingCheck: true) }
            // Cards dissolve into the band as they scroll up behind the fixed header: the mask is
            // transparent through the header body and ramps to opaque over its last fifth.
            .mask(
                VStack(spacing: 0) {
                    LinearGradient(
                        stops: [
                            .init(color: .clear, location: 0),
                            .init(color: .clear, location: 0.8),
                            .init(color: .black, location: 1)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: max(headerHeight, 1))
                    Color.black
                }
            )

            fixedHeader
        }
    }

    /// The fixed header content (HomeScreen.kt 70adc5fd): 42pt logo, the leaf-flanked
    /// "For your farm today", and the Location 2.0 pill — 12pt apart, 16pt below; transparent so
    /// the band shows through.
    private var fixedHeader: some View {
        VStack(spacing: 12) {
            FCLogoMark(size: 42, tint: theme.brand.foregroundPrimary)
                .accessibilityHidden(true)
            FCSectionHeader(
                title: fcLabel(FCLabels.forYourFarmToday, "For your farm today"),
                titleColor: theme.brand.foregroundPrimary,
                verticalPadding: 0
            )
            FCLocationButton(state: pillState, placeName: locationPrompt.approxPlaceName, onTap: pillTapped)
        }
        .padding(.bottom, 16)
        .frame(maxWidth: .infinity)
        .background(
            GeometryReader { proxy in
                Color.clear.onAppear { headerHeight = proxy.size.height }
                    .onChange(of: proxy.size.height) { headerHeight = $0 }
            }
        )
    }

    // MARK: - Location pill (HomeScreen.kt `HomeLocationPill`)

    private var pillState: FCLocationPillState {
        _ = pillTick // re-read permission on foreground / profile updates
        _ = viewModel.state.userProfileState.isLoading
        return FCLocationPillState.resolve(
            isBlocked: locationPrompt.isBlockedByPermission,
            isSearching: FCLocationPillState.isSearching(state: locationPrompt.state, source: locationPrompt.source),
            showSuccess: pillSuccess,
            hasStoredFix: locationPrompt.isLocationKnown,
            hasPermission: locationPrompt.hasCurrentLocationPermission,
            placeName: locationPrompt.approxPlaceName
        )
    }

    private func pillTapped() {
        // Re-run the flow rather than jumping to Settings: denied twice → the manager lands on
        // Recovery, which shows the "We need your location" sheet with its own Settings button.
        guard locationPrompt.state == .idle else { return }
        locationPrompt.triggerFromLocalContext()
    }

    private func pillStateChanged(_ state: LocationPromptState) {
        let active = FCLocationPillState.isFlowActive(state: state, source: locationPrompt.source)
        if pillFlowWasActive, state == .idle, locationPrompt.isLocationKnown {
            // The pill's own flow just succeeded — hold the checkmark briefly.
            pillSuccess = true
            Task {
                try? await Task.sleep(nanoseconds: 1_500_000_000)
                pillSuccess = false
            }
        }
        pillFlowWasActive = active
        pillTick += 1
    }

    @ViewBuilder
    private func sectionView(_ section: SectionDto) -> some View {
        // App parity: question cards arrive as `type == "question"` discriminated
        // by `selection_type` ("single"/"multiple") — NOT `type == "single_select"`.
        // (Mirror UIKit HomeCells, which keys off `options` + `selectionType`.)
        let isSelect = section.type == "question" || section.options?.isEmpty == false
        if isSelect {
            if section.selectionType == "single" || section.type == "single_select" {
                FCSingleSelectCard(
                    section: section,
                    isSubmitting: submittingSectionId == section.id,
                    onSubmit: { option in submitSingleSelect(section: section, option: option) },
                    onDismiss: { viewModel.dismissCard(sectionId: section.id) }
                )
            } else {
                FCMultiSelectCard(
                    section: section,
                    isSubmitting: submittingSectionId == section.id,
                    onSubmit: { options in submitMultiSelect(section: section, options: options) },
                    onDismiss: { viewModel.dismissCard(sectionId: section.id) }
                )
            }
        } else {
            FCContentCard(
                section: section,
                isLoading: pendingCardSection?.id == section.id && viewModel.state.imageStatementState.isLoading,
                onTap: { contentCardTapped(section) }
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

    // MARK: - Weather (routes through LocationPromptManager)

    private func weatherTapped() {
        // App HomeScreen.kt:545-575 order: offline → No Internet error (home_weather); ignore while
        // the feed is loading; track; ignore while a location flow is already running.
        if !locationPrompt.isOnline {
            router.push(.error(isNetworkError: true, fromScreen: "home_weather"))
            return
        }
        if viewModel.state.homeFeedState.isLoading { return }
        FarmerChat.shared.analytics.track(AnalyticsEvents.weatherClicked)
        guard locationPrompt.state == .idle else { return }
        // App parity: weather CTA asks the app's label WHAT_IS_THE_PRESENT_WEATHER.
        let question = fcLabel(FCLabels.whatIsThePresentWeather, "What is the present weather?")
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
        // Image cards only (HomeScreen.kt:2092) — statement cards are never marked viewed.
        guard HomeViewModel.shouldMarkViewed(section),
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
        // App parity (HomeScreen.kt:580-584): content-card tap sends image_card / text_card by type.
        let triggerType: String
        switch section.type?.lowercased() {
        case "image": triggerType = "image_card"
        case "statement": triggerType = "text_card"
        default: triggerType = "card"
        }
        viewModel.onAction(.fetchImageStatement(statementId: statementId, triggeredInputType: triggerType))
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
        // The card runs Saving → "Thank you" → gone itself (Cards.kt) and removes itself from
        // the feed through `onDismiss`; no toast (the app shows none).
        Task {
            try? await Task.sleep(nanoseconds: 900_000_000)
            submittingSectionId = nil
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
        // The card runs Saving → "Thank you" → gone itself (Cards.kt) and removes itself from
        // the feed through `onDismiss`; no toast (the app shows none).
        Task {
            try? await Task.sleep(nanoseconds: 900_000_000)
            submittingSectionId = nil
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

    private func attach(_ picked: FCPickedImage) {
        composerPhoto = picked
        composerFocusRequest = true
    }

    // MARK: - Navigation

    private func openChat(_ args: FCDestination.ChatArgs) {
        router.push(.chat(args))
    }
}
