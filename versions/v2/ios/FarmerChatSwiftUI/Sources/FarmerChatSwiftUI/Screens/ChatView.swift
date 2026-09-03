import SwiftUI
import Photos
import FarmerChatCore

/// Port of ChatScreen: thread with user/AI bubbles, follow-up chips,
/// clarification labels, retry, Listen (TTS), share/download card
/// (ImageRenderer + share sheet), voice clips, image queries, history
/// pagination, input overlays.
struct ChatView: View {
    @Environment(\.fcTheme) private var theme
    @EnvironmentObject var router: FCRouter
    /// The global location prompt state machine (provided by `FarmerChatView`). 2.0.0: the
    /// GPS_PROMPT capability chip drives it and consumes the outcome.
    @EnvironmentObject var locationPrompt: LocationPromptManager
    let args: FCDestination.ChatArgs
    let openDrawer: () -> Void

    @StateObject private var viewModel = ChatViewModel()
    @StateObject private var playback = AudioPlaybackService()
    @StateObject private var ttsPlayback = AudioPlaybackService()
    @StateObject private var recorder = AudioRecorderService()
    @StateObject private var toast = FCToastState()

    @State private var didInitialize = false
    @State private var showTextInput = false
    @State private var typedText = ""
    @State private var showVoiceInput = false
    @State private var showPhotoSheet = false
    @State private var showCamera = false
    @State private var showGallery = false
    @State private var shareImage: UIImage?
    @State private var isLoadingMoreHistory = false
    /// Tracks the newest message so auto-scroll-to-bottom fires only on new
    /// turns, not when older history is prepended at the top.
    @State private var lastBottomMessageId: String?
    /// The message that was at the top before a "load earlier" fetch — pinned
    /// back to the top after the older page is prepended to preserve position.
    @State private var pendingScrollAnchorId: String?

    // Client-side answer-reveal bookkeeping (view-only; see FCAiAnswerText).
    // Ids whose reveal has finished. Fresh answers animate once; history +
    // pre-generated answers are marked complete immediately (no reveal). The
    // follow-up section + action row only appear after the last answer reveals.
    @State private var revealedIds: Set<String> = []

    // ---------------------------------------------------------------- capability chips (2.0.0)
    /// Armed while a chat-initiated location flow is in progress; holds the raw `AiResponse.id` of
    /// the GPS_PROMPT surface whose chip started it. Nil means the collector below is inert, so an
    /// outcome belonging to Home or Settings is ignored.
    @State private var pendingLocationSourceId: String?

    var body: some View {
        ZStack {
            theme.content.surfaceReadingPrimary.ignoresSafeArea()

            VStack(spacing: 0) {
                appBar
                threadBody
                // Hide the Photo/Speak/Type bar while the text composer is open
                // (the composer overlays the bottom — avoids overlap).
                if !showTextInput { inputBar }
            }

            if showTextInput {
                FCTextInputOverlay(
                    text: $typedText,
                    placeholder: fcLabel("type_placeholder", "Ask anything about your farm"),
                    onSend: { question in
                        showTextInput = false
                        typedText = ""
                        viewModel.onAction(.sendFollowUpQuestion(question: question, followUpQuestionId: nil, transcriptionId: nil, audioURL: nil))
                    },
                    onDismiss: { showTextInput = false }
                )
            }

            if showVoiceInput {
                FCVoiceInputOverlay(
                    recorder: recorder,
                    onFinished: { clip in
                        showVoiceInput = false
                        viewModel.onAction(.sendFollowUpVoiceQuestion(audioURL: clip.fileURL, base64Audio: clip.base64Audio))
                    },
                    onCancel: { showVoiceInput = false }
                )
            }

            if showPhotoSheet {
                FCPhotoSourceSheet(
                    onCamera: {
                        showPhotoSheet = false
                        Task {
                            if await FCCameraPermission.request() { showCamera = true }
                        }
                    },
                    onGallery: {
                        showPhotoSheet = false
                        showGallery = true
                    },
                    onCancel: { showPhotoSheet = false }
                )
            }
        }
        .fcToastHost(toast)
        .task { initialize() }
        .onDisappear {
            playback.stop()
            ttsPlayback.stop()
            viewModel.onAction(.clearMessages)
            FarmerChat.shared.analytics.screenExited(ScreenNames.chat)
        }
        .onChange(of: viewModel.state.audioPlaybackUrl) { urlString in
            guard let urlString, let url = URL(string: urlString) else { return }
            ttsPlayback.play(url: url, id: "tts")
            viewModel.onAction(.setAudioPlaying(true))
        }
        .onReceive(ttsPlayback.didFinish) { _ in
            viewModel.onAction(.setAudioPlaying(false))
            viewModel.onAction(.clearAudioPlaybackUrl)
        }
        // 2.0.0: outcomes of the chat share-location capability flow. `events` is a
        // PassthroughSubject, so it multicasts to every subscriber (Home also listens) — but it
        // has no replay, hence subscribing for the life of the screen and gating on
        // `pendingLocationSourceId` rather than subscribing on the chip tap.
        .onReceive(locationPrompt.events) { event in
            handleLocationOutcome(event)
        }
        .sheet(isPresented: $showCamera) {
            FCCameraPicker { picked in
                showCamera = false
                if let picked {
                    viewModel.onAction(.sendQuestionWithImage(question: "", imageData: picked.jpegData, imageURL: picked.fileURL))
                }
            }
            .ignoresSafeArea()
        }
        .sheet(isPresented: $showGallery) {
            FCPhotoLibraryPicker { picked in
                showGallery = false
                if let picked {
                    viewModel.onAction(.sendQuestionWithImage(question: "", imageData: picked.jpegData, imageURL: picked.fileURL))
                }
            }
        }
        .sheet(isPresented: Binding(get: { shareImage != nil }, set: { if !$0 { shareImage = nil } })) {
            if let shareImage {
                FCShareSheet(items: [shareImage])
            }
        }
    }

    // MARK: - App bar (LogoAppBar: Close for Home entry / Menu for History)

    private var appBar: some View {
        HStack(spacing: 8) {
            if args.source == "history" {
                Button(action: openDrawer) {
                    Image(systemName: "line.3.horizontal")
                        .font(.system(size: 19, weight: .semibold))
                        .foregroundColor(theme.content.foregroundPrimary)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
            } else {
                Button {
                    // CHAT_ONLY has no SDK Home — close exits the SDK to the host;
                    // otherwise popUpTo(Home){!inclusive}.
                    if args.source == "chatOnly" { exitSdk() } else { router.popToRoot() }
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(theme.content.foregroundPrimary)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
            }

            if !viewModel.state.isLoading {
                FCLogoMark(size: 28, tint: theme.brand.surfacePrimary)
                Text("FarmerChat")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(theme.content.foregroundPrimary)
            }
            Spacer()
        }
        .padding(.horizontal, 8)
        .frame(height: 56)
    }

    /// CHAT_ONLY exit: dismiss the modally-presented SDK (present(from:)) back to
    /// the host. No-op when embedded inline (host owns the surface).
    private func exitSdk() {
        var top = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        top?.dismiss(animated: true)
    }

    // MARK: - Thread

    @ViewBuilder
    private var threadBody: some View {
        if viewModel.state.messages.isEmpty && viewModel.state.isLoading {
            // ChatLoadingContent: first question bubble + branded thinking state.
            VStack(alignment: .leading, spacing: 24) {
                if let question = args.question, !question.isEmpty {
                    FCUserChatBubble(
                        message: ChatMessage.UserMessage(text: question),
                        playback: playback
                    )
                }
                FCThinkingIndicator(label: fcLabel("getting_your_answer", "Getting your answer…"))
                Spacer()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
        } else if let errorMessage = viewModel.state.errorMessage, viewModel.state.messages.isEmpty {
            chatError(errorMessage)
        } else {
            thread
        }
    }

    private var thread: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 14) {
                    // History pagination: load-more affordance at top.
                    if viewModel.state.historyNextPage != nil {
                        Button {
                            loadMoreHistory()
                        } label: {
                            if isLoadingMoreHistory {
                                ProgressView()
                            } else {
                                Text(fcLabel("load_earlier", "Load earlier messages"))
                                    .font(.system(size: 14, weight: .semibold))
                                    .foregroundColor(theme.brand.surfacePrimary)
                            }
                        }
                        .buttonStyle(.plain)
                        .padding(.top, 8)
                    }

                    ForEach(viewModel.state.messages) { message in
                        messageRow(message).id(message.id)
                    }

                    // Inline error under a failed message.
                    if let errorMessage = viewModel.state.errorMessage, !viewModel.state.messages.isEmpty {
                        inlineError(errorMessage)
                    }

                    // Follow-up section — appears only after the last answer's
                    // reveal completes (fresh, history and pre-generated all
                    // mark their last answer revealed; see FCAiAnswerText).
                    if let suggestions = viewModel.state.suggestedQuestions, !suggestions.isEmpty,
                       !viewModel.state.isLoading, viewModel.state.errorMessage == nil,
                       lastAnswerRevealed {
                        FCFollowUpChips(
                            title: viewModel.state.clarificationRequired
                                ? fcLabel("choose_a_followup_option_below", "Choose a follow-up option below")
                                : fcLabel("related_questions", "Related questions"),
                            questions: suggestions,
                            onTap: { question in
                                viewModel.onAction(.sendFollowUpQuestion(question: question, followUpQuestionId: question, transcriptionId: nil, audioURL: nil))
                            }
                        )
                        .padding(.top, 4)
                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                    }
                }
                .padding(16)
                .animation(.easeOut(duration: 0.35), value: lastAnswerRevealed)
            }
            .onChange(of: viewModel.state.messages.count) { _ in
                if let anchor = pendingScrollAnchorId {
                    // Older history was just prepended (load-earlier): keep the
                    // user in place by pinning the previously-top message to the
                    // top, rather than jumping to the newest message.
                    pendingScrollAnchorId = nil
                    isLoadingMoreHistory = false
                    lastBottomMessageId = viewModel.state.messages.last?.id
                    proxy.scrollTo(anchor, anchor: .top)
                    return
                }
                // Content appended at the bottom (a new turn) → scroll to it.
                // A prepend leaves `last` unchanged, so this won't fire for it.
                let newLastId = viewModel.state.messages.last?.id
                if newLastId != lastBottomMessageId {
                    lastBottomMessageId = newLastId
                    if let last = viewModel.state.messages.last {
                        withAnimation { proxy.scrollTo(last.id, anchor: .bottom) }
                    }
                }
            }
            .onChange(of: viewModel.state.isInitialHistoryLoaded) { loaded in
                guard loaded, let last = viewModel.state.messages.last else { return }
                lastBottomMessageId = last.id
                proxy.scrollTo(last.id, anchor: .bottom)
            }
            .onChange(of: viewModel.state.errorMessage) { message in
                // A failed "load earlier" won't change the message count, so
                // clear the pending-load state here to avoid a stuck spinner.
                if message != nil {
                    isLoadingMoreHistory = false
                    pendingScrollAnchorId = nil
                }
            }
        }
    }

    // MARK: - Reveal helpers

    /// True when this chat was opened from history (bulk-loaded thread — never
    /// animate). Matches the Android `isHistoryEntry` predicate.
    private var isHistoryEntry: Bool {
        !(args.conversationId ?? "").isEmpty
    }

    private var lastAiMessage: ChatMessage.AiResponse? {
        for message in viewModel.state.messages.reversed() {
            if case .aiResponse(let ai) = message { return ai }
        }
        return nil
    }

    private var lastAnswerRevealed: Bool {
        guard let last = lastAiMessage else { return false }
        return revealedIds.contains(last.id)
    }

    @ViewBuilder
    private func messageRow(_ message: ChatMessage) -> some View {
        switch message {
        case .user(let user):
            FCUserChatBubble(message: user, playback: playback)
        case .aiResponse(let ai):
            let isLastAi = ai.id == lastAiMessage?.id
            // 2.0.0: an EXCLUSIVE alignment surface owns the message area — it replaces the
            // answer, its action row and its related-questions section. An ADDITIVE one falls
            // through to the normal answer branch and renders below it as a nudge.
            if let kind = ai.alignmentKind, !kind.isAdditive {
                FCAlignmentSurface(
                    kind: kind,
                    // The prompt IS the message for an exclusive surface (see
                    // ChatViewModel.handleTextPromptSuccess).
                    message: ai.text,
                    chips: ai.alignmentChips ?? [],
                    selectedValues: ai.alignmentSelectedValues,
                    isLoading: viewModel.state.isLoading,
                    isLatest: isLastAi,
                    onChipTap: { chip in
                        handleAlignmentChip(messageId: ai.id, kind: kind, chip: chip)
                    },
                    onTypeInstead: { showTextInput = true }
                )
            } else {
                // Only fresh answers animate: newest AI message, not from history,
                // not pre-generated, and not already revealed once. A finalized agentic answer
                // never animates — it already typed itself once as it streamed (deviation from
                // Compose, which re-types the `metadata` answer under a fresh message id).
                let shouldAnimate = isLastAi && !isHistoryEntry && !ai.isPreGenerated
                    && !ai.isAgentic && !revealedIds.contains(ai.id)
                FCAiResponseBubble(
                    message: ai,
                    showActions: isLastAi && !ai.isPreGenerated,
                    isTtsEnabled: viewModel.state.isTtsEnabled,
                    isSynthesising: viewModel.state.isLoadingSynthesiseAudio,
                    isAudioPlaying: viewModel.state.isAudioPlaying,
                    animate: shouldAnimate,
                    onListen: listenTapped,
                    onShare: { share(ai) },
                    onDownload: { download(ai) },
                    onReadFullAdvice: ai.isPreGenerated ? {
                        viewModel.onAction(.replacePreGeneratedWithQuestion(question: args.question ?? "", triggerInputType: "card"))
                    } : nil,
                    onRevealComplete: { revealedIds.insert(ai.id) },
                    isLatest: isLastAi,
                    isBusy: viewModel.state.isLoading,
                    onRetryStream: { viewModel.onAction(.retryLastRequest) },
                    onAlignmentChipTap: { chip in
                        handleAlignmentChip(messageId: ai.id, kind: ai.alignmentKind, chip: chip)
                    }
                )
            }
        // 2.0.0: the farmer's resolved location, standing in for the text bubble they would
        // otherwise have sent. Right-aligned because it is their reply to a GPS_PROMPT chip.
        case .location(let location):
            HStack {
                Spacer(minLength: 0)
                FCLocationChatBubble(
                    address: location.address,
                    label: fcLabel(AgenticLabels.yourLocation, AgenticLabels.yourLocationFallback)
                )
            }
        case .loadingPlaceholder:
            FCChatLoadingBubble()
        }
    }

    // MARK: - Alignment chips (2.0.0)

    /// Routes an alignment chip tap. Port of the app's `onAlignmentChipClick`.
    ///
    /// A CAPABILITY chip (`gps-prompt` / `upload-photo` marked `action:"invoke"`) does NOT send its
    /// text — it invokes a device capability and only the OUTCOME is sent. Every other chip,
    /// including "Not now" on a capability prompt, stays on the plain follow-up path.
    ///
    /// - Parameter messageId: the raw `AiResponse.id` of the surface that offered the chip (not the
    ///   prefixed `ChatMessage.id` — core matches on the raw one).
    private func handleAlignmentChip(messageId: String, kind: AlignmentKind?, chip: AlignmentChip) {
        switch chip.capability(for: kind) {
        case .shareLocation:
            // Permission dialog / GPS fetch / recovery are owned by LocationPromptHostView; the
            // outcome arrives on the collector above. Only start when no other location flow is
            // running (mirrors Home's guard).
            guard locationPrompt.state == .idle else { return }
            pendingLocationSourceId = messageId
            locationPrompt.triggerFromLocalContext()
        case .takePhoto:
            // Straight to the camera — no photo-source sheet, the chip already chose.
            Task { if await FCCameraPermission.request() { showCamera = true } }
        case .chooseFromGallery:
            showGallery = true
        case .none:
            sendAlignmentChip(chip)
        }
    }

    /// A non-capability alignment chip sends the chip's `value` (falling back to its label) as a
    /// follow-up — the same action a related-question tap uses, exactly as Compose does.
    private func sendAlignmentChip(_ chip: AlignmentChip) {
        let question = chip.submittedQuery
        guard !question.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        viewModel.onAction(.sendFollowUpQuestion(
            question: question,
            followUpQuestionId: nil,
            transcriptionId: nil,
            audioURL: nil
        ))
    }

    /// Terminal outcome of the chat share-location flow. Inert unless this screen armed it, so an
    /// outcome belonging to Home (weather chip) or a widget trigger is ignored.
    private func handleLocationOutcome(_ event: LocationPromptEvent) {
        guard let sourceId = pendingLocationSourceId else { return }
        // Not a terminal per-flow outcome, or one belonging to Home / a widget trigger.
        guard event.terminalSource == .localContext else { return }
        // A terminal event for OUR request — disarm before dispatching.
        pendingLocationSourceId = nil

        // `isLocationObtained` lives in Core so both flavours share one rule: a settled flow is
        // NOT the same as a successful one.
        if event.isLocationObtained {
            viewModel.onAction(.sendLocationSharedQuery(
                sourceMessageId: sourceId,
                address: resolvedAddress()
            ))
        } else {
            // Denied / cancelled / fetch failed: still answer the blocking question, by sending the
            // decline text as an ordinary follow-up. The app sends this through `SendAlignmentChip`
            // with `locationDeclined` + parent_message_id; the SDK has neither, so the correlation
            // and the chip analytics are lost (docs/04).
            viewModel.onAction(.sendFollowUpQuestion(
                question: fcLabel(
                    AgenticLabels.locationPermissionDeclined,
                    AgenticLabels.locationPermissionDeclinedFallback
                ),
                followUpQuestionId: nil,
                transcriptionId: nil,
                audioURL: nil
            ))
        }
    }

    /// The address shown in the location bubble.
    ///
    /// The app composes `display_address, geography_level2_name, country_name`; iOS's `#11`
    /// response (`GetLocationResponse`) carries `district / state / country` instead, and those are
    /// the only location prefs this SDK writes — no `fc_sdk_` key is invented for the rest
    /// (root CLAUDE.md §2). Recorded as a delta in docs/04.
    private func resolvedAddress() -> String {
        let prefs = FarmerChat.shared.prefs
        let parts = [
            prefs.string(.userDistrict),
            prefs.string(.userState),
            prefs.string(.userCountryName)
        ]
        var seen: Set<String> = []
        return parts
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty && seen.insert($0).inserted }
            .joined(separator: ", ")
    }

    private func chatError(_ message: String) -> some View {
        // ChatErrorContent: message, retry, question bubble, input buttons.
        VStack(spacing: 18) {
            if let question = args.question, !question.isEmpty {
                FCUserChatBubble(message: ChatMessage.UserMessage(text: question, isFailed: true), playback: playback)
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
            }
            Spacer()
            Image(systemName: "exclamationmark.bubble")
                .font(.system(size: 44))
                .foregroundColor(theme.content.foregroundSecondary)
            Text(message)
                .font(.system(size: 16))
                .foregroundColor(theme.content.foregroundSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
            Button {
                viewModel.onAction(.retryLastRequest)
            } label: {
                Text(fcLabel("try_again", "Try again"))
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(theme.content.buttonPrimaryForeground)
                    .padding(.horizontal, 28)
                    .frame(height: 46)
                    .background(theme.content.buttonPrimarySurface)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            Spacer()
        }
    }

    private func inlineError(_ message: String) -> some View {
        VStack(spacing: 10) {
            Text(message)
                .font(.system(size: 14))
                .foregroundColor(FCPrimitive.red500)
                .multilineTextAlignment(.center)
            Button {
                viewModel.onAction(.retryLastRequest)
            } label: {
                Text(fcLabel("try_again", "Try again"))
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(theme.brand.surfacePrimary)
            }
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    // MARK: - Input bar (follow-up entry points)

    private var inputBar: some View {
        HStack(spacing: 10) {
            if FarmerChat.shared.config.enableImages {
                inputIcon("camera.fill") { showPhotoSheet = true }
            }
            if FarmerChat.shared.config.enableVoice {
                inputIcon("mic.fill", action: startVoice)
            }
            Button {
                showTextInput = true
            } label: {
                HStack {
                    Text(fcLabel("ask_follow_up", "Ask a follow-up question"))
                        .font(.system(size: 15))
                        .foregroundColor(theme.content.formPlaceholder)
                    Spacer()
                }
                .padding(.horizontal, 16)
                .frame(height: 46)
                .background(theme.content.surfaceReadingSecondary)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 10)
        .background(
            theme.content.surfaceReadingPrimary
                .overlay(alignment: .top) {
                    Rectangle()
                        .fill(theme.content.borderDefault.opacity(0.4))
                        .frame(height: 0.5)
                }
                .ignoresSafeArea(edges: .bottom)
        )
        .disabled(viewModel.state.isLoading)
        .opacity(viewModel.state.isLoading ? 0.5 : 1)
    }

    private func inputIcon(_ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(theme.content.buttonPrimaryForeground)
                .frame(width: 46, height: 46)
                .background(theme.content.buttonPrimarySurface)
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Initialization (one path, matching the app's LaunchedEffect)

    private func initialize() {
        guard !didInitialize else { return }
        didInitialize = true
        FarmerChat.shared.analytics.screenViewed(ScreenNames.chat, extra: ["source": args.source])

        if let conversationId = args.conversationId, !conversationId.isEmpty {
            viewModel.onAction(.loadChatHistory(conversationId: conversationId, page: 1))
        } else if let answer = args.preGeneratedAnswer, !answer.isEmpty {
            viewModel.onAction(.initializeWithPreGeneratedContent(
                question: args.question ?? "",
                answer: answer,
                followUpQuestions: args.followUpQuestions.isEmpty ? nil : args.followUpQuestions,
                isFromCampaign: args.source != "home",
                homeStatementId: args.homeStatementId,
                userMessageImageURL: args.imagePath.map { URL(fileURLWithPath: $0) }
            ))
        } else if let imagePath = args.imagePath, !imagePath.isEmpty {
            let url = URL(fileURLWithPath: imagePath)
            if let data = try? Data(contentsOf: url) {
                viewModel.onAction(.sendQuestionWithImage(question: args.question ?? "", imageData: data, imageURL: url))
            }
        } else if (args.question ?? "").isEmpty, let audioPath = args.audioPath, !audioPath.isEmpty {
            viewModel.onAction(.initializeVoicePrototype(
                audioURL: URL(fileURLWithPath: audioPath),
                originScreenName: args.source
            ))
        } else if let question = args.question, !question.isEmpty {
            viewModel.onAction(.initializeWithQuestion(
                question: question,
                transcriptionId: args.transcriptionId,
                audioURL: args.audioPath.map { URL(fileURLWithPath: $0) },
                originScreenName: args.source,
                isWeatherAdviceCTA: args.isWeatherAdviceCTA,
                isSSFR: args.isSSFR,
                ssfrCrop: args.ssfrCrop,
                channel: args.channel
            ))
        }
    }

    private func loadMoreHistory() {
        guard let next = viewModel.state.historyNextPage,
              let conversationId = args.conversationId,
              !isLoadingMoreHistory else { return }
        isLoadingMoreHistory = true
        // Remember the current top message; the messages.count handler restores
        // it to the top once the older page is prepended (position preserved).
        pendingScrollAnchorId = viewModel.state.messages.first?.id
        viewModel.onAction(.loadChatHistory(conversationId: conversationId, page: next))
    }

    // MARK: - Listen / share / download

    private func listenTapped() {
        if viewModel.state.isAudioPlaying {
            ttsPlayback.pause()
            viewModel.onAction(.setAudioPlaying(false))
        } else if let urlString = viewModel.state.audioPlaybackUrl, let url = URL(string: urlString) {
            ttsPlayback.play(url: url, id: "tts")
            viewModel.onAction(.setAudioPlaying(true))
        } else {
            viewModel.onAction(.synthesiseAudio)
        }
    }

    private func share(_ ai: ChatMessage.AiResponse) {
        FarmerChat.shared.analytics.track(AnalyticsEvents.shareResponseClicked)
        guard let image = FCShareCardRenderer.render(question: lastQuestion(before: ai), answer: ai.text) else {
            toast.show(.error, fcLabel("error_generic", "Something went wrong. Please try again."))
            return
        }
        shareImage = image
    }

    private func download(_ ai: ChatMessage.AiResponse) {
        FarmerChat.shared.analytics.track(AnalyticsEvents.downloadResponseClicked)
        guard let image = FCShareCardRenderer.render(question: lastQuestion(before: ai), answer: ai.text) else {
            toast.show(.error, fcLabel("error_generic", "Something went wrong. Please try again."))
            return
        }
        UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
        toast.show(.success, fcLabel("downloaded", "Saved to Photos"))
    }

    private func lastQuestion(before ai: ChatMessage.AiResponse) -> String {
        var question = args.question ?? ""
        for message in viewModel.state.messages {
            if case .aiResponse(let candidate) = message, candidate.id == ai.id { break }
            if case .user(let user) = message, !user.text.isEmpty { question = user.text }
        }
        return question
    }

    // MARK: - Voice follow-up

    private func startVoice() {
        Task {
            guard await FCMicPermission.request(recorder: recorder) else {
                toast.show(.error, fcLabel("mic_permission_denied", "Microphone access is needed to speak your question."))
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
}
