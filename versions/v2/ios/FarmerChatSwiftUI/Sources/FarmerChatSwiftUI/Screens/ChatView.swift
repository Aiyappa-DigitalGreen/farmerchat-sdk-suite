import SwiftUI
import Photos
import FarmerChatCore

/// Port of ChatScreen: thread with user/AI bubbles, follow-up chips,
/// clarification labels, retry, Listen (TTS), share/download card
/// (ImageRenderer + share sheet), voice clips, image queries, history
/// pagination, input overlays.
struct ChatView: View {
    @Environment(\.fcTheme) private var theme
    @Environment(\.fcExitAction) private var exitAction
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
    @State private var typedText = ""
    /// The floating composer's focus (mirrored out of its FocusState) and a one-shot request to
    /// focus it — the empty state's Type pill and an alignment surface's "Type or say it" use it.
    @State private var composerFocused = false
    @State private var composerFocusRequest = false
    /// Measured height of the floating composer (sheet + bottom gap) — the thread's bottom reserve.
    @State private var composerHeight: CGFloat = 0
    @State private var showVoiceInput = false
    @State private var showPhotoSheet = false
    @State private var showCamera = false
    @State private var showGallery = false
    @State private var shareImage: UIImage?
    @State private var isLoadingMoreHistory = false
    /// History entry: true once the opened conversation has been scrolled to its FIRST message.
    @State private var historyInitialScrollDone = false
    /// History entry: the thread's tail when it was opened. No auto-scroll happens while the tail
    /// is still this id (older pages only prepend); the first NEW tail re-enables the pin.
    @State private var historyOpenedTailId: String?
    /// Coalesces the pin triggers (tail id / isLoading / first history load) of one update into a
    /// single scroll, applied on the next main-queue turn so the reserve has been laid out.
    @State private var pinScheduled = false
    /// The message that was at the top before a "load earlier" fetch — pinned
    /// back to the top after the older page is prepended to preserve position.
    @State private var pendingScrollAnchorId: String?
    /// How far the thread extends below the fold, in points. Drives the scroll indicator.
    @State private var hiddenBelow: CGFloat = 0

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
    /// Armed while an UPLOAD_PHOTO capability chip's camera / gallery is open: the raw
    /// `AiResponse.id` of that surface (app `alignmentPhotoSourceId`). A pick sends the photo; a
    /// cancel or a camera-permission denial sends the app's decline query with `photo_declined`.
    @State private var alignmentPhotoSourceId: String?
    /// The UPLOAD_PHOTO chip that opened the camera / gallery (its value + label go on Send_Query).
    @State private var alignmentPhotoChip: AlignmentChip?
    /// A composer photo waiting for its caption (InputComposer `photoUris`, one image).
    @State private var composerPhoto: FCPickedImage?
    /// Legacy input (composer UI off): the text input is open after Type / "Type or say it".
    @State private var legacyTyping = false

    var body: some View {
        ZStack {
            theme.content.surfaceReadingPrimary.ignoresSafeArea()

            VStack(spacing: 0) {
                appBar
                threadBody
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    // Tips.kt overlay: while an answer is pending and before streamed text shows.
                    .overlay(alignment: .bottom) {
                        if showTips {
                            FCTipsCarousel()
                                .transition(.opacity)
                        }
                    }
                    .animation(.easeInOut(duration: 0.3), value: showTips)
                    // ChatInputOverlays.kt: the floating InputComposer over the thread, sliding
                    // away while an answer is loading (ChatScreen.kt:1752).
                    .overlay(alignment: .bottom) { inputSurface }
                    .onPreferenceChange(FCComposerHeightKey.self) { composerHeight = $0 }
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
        .sheet(isPresented: $showCamera, onDismiss: alignmentPhotoNotShared) {
            FCCameraPicker { picked in
                showCamera = false
                if let picked { sendPicked(picked) }
            }
            .ignoresSafeArea()
        }
        .sheet(isPresented: $showGallery, onDismiss: alignmentPhotoNotShared) {
            FCPhotoLibraryPicker { picked in
                showGallery = false
                if let picked { sendPicked(picked) }
            }
        }
        .sheet(isPresented: Binding(get: { shareImage != nil }, set: { if !$0 { shareImage = nil } })) {
            if let shareImage {
                // ChatScreen.kt:2113-2117: the card image plus the `share_app_message` caption.
                FCShareSheet(items: [shareImage, FCShareCopy.caption()])
            }
        }
    }

    // MARK: - App bar (LogoAppBar: Close for Home entry / Menu for History)

    /// LogoAppBar.kt + ChatScreen.kt:1454: the white mark shows only in the Thread state while
    /// nothing is loading — hidden in the empty chat, the first-question loading state, the
    /// full-screen error and while an answer is pending.
    private var showHeaderLogo: Bool {
        let state = viewModel.state
        return !state.messages.isEmpty && !state.isLoading
    }

    private var appBar: some View {
        FCChatAppBar(showLogo: showHeaderLogo) {
            if args.source == "history" && !FarmerChat.shared.config.showDrawer {
                // Drawer off: the hamburger would be a dead button — pop back to the list.
                FCAppBarTile(symbol: "chevron.left", label: "back") { router.pop() }
            } else if args.source == "history" {
                // LogoAppBar.kt:94-101: Material Menu in a 42 radius-12 ActionButton.
                FCAppBarTile(symbol: "line.3.horizontal", label: "menu", action: openDrawer)
            } else if args.source == "chatOnly" {
                // SDK addition: CHAT_ONLY has no SDK Home — close exits the SDK to the host.
                FCAppBarTile(symbol: "xmark", label: "Close", identifier: "fcChatClose", action: exitSdk)
            } else {
                // Home entry: the app's R.drawable.leftbutton (stroked arrow on a #08361B disc);
                // popUpTo(Home){!inclusive}.
                Button { router.popToRoot() } label: {
                    FCLeftButtonGlyph().frame(width: 42, height: 42)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("back")
            }
        } trailing: {
            // SDK addition. Drawer off (the CHAT_ONLY default): these tiles are the only routes to
            // Past Advice and Language. Gated as on Android: history on `!showDrawer &&
            // showHistory`, language on `!showDrawer`. Otherwise the app's empty 42pt spacer.
            if !FarmerChat.shared.config.showDrawer {
                HStack(spacing: 8) {
                    if FarmerChat.shared.config.showHistory {
                        FCAppBarTile(symbol: "clock.arrow.circlepath", label: "history", identifier: "fcChatHistory", historyGlyph: true) {
                            router.push(.chatHistory)
                        }
                    }
                    FCAppBarTile(symbol: "globe", label: "language", identifier: "fcChatLanguage") {
                        router.push(.settingsLanguage)
                    }
                }
            } else {
                Color.clear.frame(width: 42, height: 42)
            }
        }
    }

    /// CHAT_ONLY exit: tell the host (`config.onExit` — the only signal an inline-embedded SDK
    /// has), then dismiss the container the SDK UI is shown in, when there is one to dismiss
    /// (FAB cover, `present(from:)`, or the host's own SwiftUI sheet/cover).
    private func exitSdk() {
        FarmerChat.shared.analytics.exit()
        exitAction?()
    }

    // MARK: - Thread

    @ViewBuilder
    private var threadBody: some View {
        if viewModel.state.messages.isEmpty && viewModel.state.isLoading {
            // ChatLoadingContent: first question bubble + branded thinking state.
            // ChatLoadingContent.kt: padding(horizontal 20, top 20), spacedBy 16; the bubble row
            // has 64pt start padding.
            VStack(alignment: .leading, spacing: 16) {
                if let question = args.question, !question.isEmpty {
                    FCUserChatBubble(
                        message: ChatMessage.UserMessage(text: question),
                        playback: playback
                    )
                    .padding(.leading, 64)
                }
                // App parity (ChatThreadContent.kt LoadingPlaceholder): LogoSpinnerHorizontal with
                // the shimmering primary-colour label.
                FCLogoSpinner(message: fcLabel(FCLabels.gettingYourAnswer, "Getting your answer…"), vertical: false)
                Spacer()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.top, 20)
        } else if let errorMessage = viewModel.state.errorMessage, viewModel.state.messages.isEmpty {
            chatError(errorMessage)
        } else {
            thread
                // SDK addition (no app equivalent — the app always enters chat with a question):
                // an empty, idle, non-history chat gets a centred placeholder. Overlaid on the
                // thread's frame — between the app bar and the input bar, never inside the
                // scrolling content — and gone with the first message.
                .overlay {
                    if showEmptyState {
                        FCChatEmptyState(
                            onPhoto: FarmerChat.shared.config.enableImages ? { showPhotoSheet = true } : nil,
                            onSpeak: FarmerChat.shared.config.enableVoice ? startVoice : nil,
                            // The non-composer UI: Type opens the text-input overlay, as the
                            // input bar's "Ask a follow-up question" field does.
                            onType: { composerFocusRequest = true }
                        )
                    }
                }
        }
    }

    /// `messages.isEmpty && !isLoading && !isHistoryEntry && no input overlay open` (web
    /// ChatScreen `ChatEmptyState` gate).
    private var hasEntryPayload: Bool {
        [args.question, args.preGeneratedAnswer, args.imagePath, args.audioPath]
            .contains { !($0 ?? "").isEmpty }
    }

    private var showEmptyState: Bool {
        // An entry that carries a question / answer / image / clip fills the thread itself; its
        // send starts in a `Task`, so without this the placeholder would flash for a frame or two
        // before `isLoading` lands.
        didInitialize
            && !hasEntryPayload
            && viewModel.state.messages.isEmpty
            && !viewModel.state.isLoading
            && !isHistoryEntry
            && !composerFocused && composerPhoto == nil && !showVoiceInput && !showPhotoSheet && !showCamera && !showGallery
    }

    private var thread: some View {
        ScrollViewReader { proxy in
            GeometryReader { viewport in
            ScrollView {
                // ChatThreadContent.kt: padding(horizontal 20), contentPadding top 20, spacedBy 16,
                // and a bottom reserve of the floating composer's height + 16 (ChatThreadContent.kt
                // :213, :305-308) so the last line clears the sheet.
                VStack(spacing: 16) {
                    // History pagination: load-more affordance at top.
                    if viewModel.state.historyNextPage != nil {
                        Button {
                            loadMoreHistory()
                        } label: {
                            if isLoadingMoreHistory {
                                ProgressView()
                            } else {
                                Text(fcLabel("load_earlier", "Load earlier messages"))
                                    .fcTextStyle(theme.typography.labelMedium)
                                    .foregroundColor(theme.brand.surfacePrimary)
                            }
                        }
                        .buttonStyle(.plain)
                        .padding(.top, 8)
                    }

                    let reserve = reserveRows
                    ForEach(viewModel.state.messages) { message in
                        // The reserve (Android core ChatReserve.kt): a row holding it is at least a
                        // viewport tall, so the row above it — the farmer's question — can sit at
                        // the TOP of the screen while the answer grows into the space below. The
                        // follow-ups live INSIDE the last answer's block (compose/web parity), so
                        // they are never pushed a screen below a short answer.
                        VStack(spacing: 16) {
                            messageRow(message)
                            if message.id == lastAiRowId {
                                followUpSection
                            }
                            if message.id == reserve.finalHolderId {
                                // Real-content end, ABOVE the reserve's empty space.
                                threadEndMarker(viewportHeight: viewport.size.height)
                            }
                        }
                        .frame(
                            minHeight: reserve.holderIds.contains(message.id) ? viewport.size.height : nil,
                            alignment: .top
                        )
                        .background(alignment: .top) { pinMarker(for: message.id) }
                        .id(message.id)
                    }

                    // An error not tied to a question bubble (e.g. a history page) keeps a
                    // standalone inline row; a failed question carries it under its bubble.
                    if viewModel.state.errorMessage != nil, !viewModel.state.isLoading,
                       !viewModel.state.messages.isEmpty, failedUserRowId == nil {
                        FCInlineErrorContent(onRetry: retry)
                    }

                    // No AI answer to host the follow-ups (not expected, but never drop them).
                    if lastAiRowId == nil {
                        followUpSection
                    }

                    if reserve.finalHolderId == nil {
                        threadEndMarker(viewportHeight: viewport.size.height)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 20)
                .padding(.bottom, composerHeight + 16)
                .animation(.easeOut(duration: 0.35), value: lastAnswerRevealed)
            }
            .coordinateSpace(name: Self.threadSpace)
            .onPreferenceChange(FCHiddenBelowKey.self) { hiddenBelow = $0 }
            .overlay(alignment: .bottom) {
                // App parity (ChatScreen.kt:1325-1355): only when there is REAL content
                // below, and at least two lines' worth of it — android's threshold is
                // 48dp = 2 × 24dp. Compose also suppresses the indicator when the last answer
                // fits inside its reserved viewport; here that falls out of where the marker
                // sits — at the end of the real content, above the reserve's empty space — so
                // `hiddenBelow` never counts reserved space.
                // ScrollIndicator.kt is also suppressed while an error is showing.
                if let lastAi = lastAiMessageId,
                   !viewModel.state.isLoading,
                   viewModel.state.errorMessage == nil,
                   hiddenBelow >= 48 {
                    FCScrollIndicator(triggerKey: lastAi) {
                        // To the end of the real content — never the bottom of the reserve.
                        withAnimation { proxy.scrollTo(Self.threadEndId, anchor: .bottom) }
                    }
                    // ChatThreadContent.kt:669-672: composer reserve + 16 above the bottom.
                    .padding(.bottom, composerHeight + 16)
                }
            }
            .onAppear { schedulePin(proxy) }
            // ChatThreadContent.kt:228-285: the ONLY programmatic scroll is when a new question
            // (user bubble, or a shared-location bubble) is appended — it goes to the top and stays
            // there while its answer loads, streams and settles in the reserve below it. The app
            // never re-scrolls on stream chunks or when the answer finalizes; re-pinning on the
            // tail id / `isLoading` (as this view used to) jumped the thread at the
            // placeholder → stream → final-answer swaps. Plus the first history load.
            .onChange(of: lastQuestionRowId) { _ in schedulePin(proxy) }
            .onChange(of: viewModel.state.isInitialHistoryLoaded) { _ in schedulePin(proxy) }
            .onChange(of: viewModel.state.messages.count) { _ in
                if let anchor = pendingScrollAnchorId {
                    // Older history was just prepended (load-earlier): keep the
                    // user in place by pinning the previously-top message to the
                    // top, rather than jumping to the newest message.
                    pendingScrollAnchorId = nil
                    isLoadingMoreHistory = false
                    proxy.scrollTo(anchor, anchor: .top)
                }
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
    }

    /// Follow-up section — appears only after the last answer's reveal completes (fresh, history
    /// and pre-generated all mark their last answer revealed; see FCAiAnswerText). App parity
    /// (ChatResponseActions.kt): NOT hidden by an error, but hidden when an additive alignment
    /// surface with chips owns the next action.
    @ViewBuilder
    private var followUpSection: some View {
        if let suggestions = viewModel.state.suggestedQuestions, !suggestions.isEmpty,
           !viewModel.state.isLoading, lastAnswerRevealed, !additiveSurfaceOpen {
            FCFollowUpChips(
                title: viewModel.state.clarificationRequired
                    ? fcLabel(FCLabels.chooseAFollowupOptionBelow, "Choose an option from the below")
                    : fcLabel(FCLabels.relatedQuestions, "You can also ask"),
                questions: suggestions,
                // App: a pre-generated answer's follow-ups never use the clarify accent.
                clarificationRequired: viewModel.state.clarificationRequired
                    && lastAiMessage?.isPreGenerated != true,
                onTap: { question in
                    viewModel.onAction(.sendFollowUpQuestion(question: question, followUpQuestionId: question, transcriptionId: nil, audioURL: nil))
                }
            )
            // ChatResponseActions.kt: 28 + 12 below the follow-ups.
            .padding(.bottom, 40)
            // App parity (ChatResponseActions.kt 0456f364): a 300ms fade, and fade
            // ONLY. The block used to also slide up from the bottom edge, which moves
            // the thread under it while it settles; the app is explicit that no
            // size/position animation may run here. `.animation` on the transition
            // overrides the container's 0.35s easeOut for this insertion alone, so the
            // answer-actions row above keeps its own timing.
            .transition(.opacity.animation(.easeOut(duration: 0.3)))
        }
    }

    /// Trailing marker at the end of the REAL content: its distance past the viewport's bottom
    /// edge IS the `hiddenBelow` compose computes from `layoutInfo`, and it is the scroll
    /// indicator's target. Exactly one is emitted per thread.
    private func threadEndMarker(viewportHeight: CGFloat) -> some View {
        Color.clear
            .frame(height: 1)
            .background(
                GeometryReader { marker in
                    Color.clear.preference(
                        key: FCHiddenBelowKey.self,
                        value: marker.frame(in: .named(Self.threadSpace)).minY - viewportHeight
                    )
                }
            )
            .id(Self.threadEndId)
    }

    /// A zero-size scroll target 20pt ABOVE a row, so `scrollTo(_, anchor: .top)` leaves the
    /// thread's 20pt top content padding visible above the pinned row (ChatScreen.kt anchors the
    /// item with `contentPadding top = 20` showing) instead of pressing the row flush to the edge.
    private func pinMarker(for messageId: String) -> some View {
        // An alignment guide on a `.background` view is not honoured for the scroll target's
        // frame (DEMO screenshots showed the pinned question flush under the app bar), so the
        // marker is laid out explicitly: a full-row box grown 20pt upward by negative padding,
        // with the 1pt marker at its top.
        Color.clear
            .frame(height: 1)
            .id(Self.pinId(messageId))
            .frame(maxHeight: .infinity, alignment: .top)
            .padding(.top, -Self.pinTopGap)
    }

    private static func pinId(_ messageId: String) -> String { "fc_pin_\(messageId)" }
    private static let threadEndId = "fc_thread_end"
    private static let pinTopGap: CGFloat = 20

    // MARK: - Reserve + pinning (port of Android core ChatReserve.kt)

    /// Whether the FINAL row holds the reserve: a reserve-holding last answer, the in-flight
    /// loading placeholder, or a failed last question with its inline error under it.
    private func finalRowHoldsReserve(_ last: ChatMessage) -> Bool {
        switch last {
        // The final AI row always holds it on iOS. Kotlin's `!isLoading` clause exists because
        // there the PREVIOUS answer stays the last response while a follow-up loads; here the
        // loading placeholder is appended with the question, so a final AI row is always the
        // answer to the newest question — including the brief finalize window where `isLoading`
        // is still true after the stream's `metadata` swapped in the settled answer (dropping the
        // reserve there let the ScrollView clamp and drag the pinned question down).
        case .aiResponse: return true
        case .loadingPlaceholder: return true
        case .user: return failedUserRowId == last.id
        case .location: return false
        }
    }

    /// The rows rendered at viewport minimum height this frame. `finalHolderId` is the final row
    /// when it holds the reserve (it then also hosts the real-content-end marker).
    private var reserveRows: (holderIds: Set<String>, finalHolderId: String?) {
        // Only the FINAL row ever holds it (Android core ChatReserve.kt `isLastResponse`): the
        // newest answer with a question below it, e.g. an unanswered alignment surface while a
        // typed follow-up is in flight, must collapse or it pushes the pin off the new question.
        var ids: Set<String> = []
        var finalId: String?
        if let last = viewModel.state.messages.last, finalRowHoldsReserve(last) {
            ids.insert(last.id)
            finalId = last.id
        }
        return (ids, finalId)
    }

    /// `chatScrollAnchorIndex` (Android core ChatReserve.kt): when the final row holds space, the
    /// row ABOVE it (the farmer's question) goes to the top; otherwise the final row itself. A
    /// failed last question holds space but IS the question, so it anchors itself.
    private func scrollAnchorId() -> String? {
        let messages = viewModel.state.messages
        guard let last = messages.last else { return nil }
        let holdsSpace: Bool
        switch last {
        case .aiResponse: holdsSpace = true
        case .loadingPlaceholder: holdsSpace = true
        case .user, .location: holdsSpace = false
        }
        return holdsSpace && messages.count > 1 ? messages[messages.count - 2].id : last.id
    }

    /// Id of the newest question row — a user bubble or a shared-location bubble
    /// (ChatThreadContent.kt `lastUserMessageId` / `lastLocationMessageId`). A history prepend
    /// never changes it; sending a question always does.
    private var lastQuestionRowId: String? {
        for message in viewModel.state.messages.reversed() {
            switch message {
            case .user, .location: return message.id
            default: continue
            }
        }
        return nil
    }

    private func schedulePin(_ proxy: ScrollViewProxy) {
        guard !pinScheduled else { return }
        pinScheduled = true
        // ChatThreadContent.kt:263 `delay(150) // Let layout start`: scrolling on the next turn
        // ran before the new question + reserve rows were laid out, so the scroll was a no-op
        // and the question sat mid-screen under the tips while its answer loaded.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            pinScheduled = false
            pinTail(proxy)
        }
    }

    /// The auto-scroll (ChatScreen.kt LaunchedEffect(lastMessageId, isLoading,
    /// isInitialHistoryLoaded)). Pins the anchor row's top 20pt below the viewport's top — never
    /// the bottom of the reserve.
    private func pinTail(_ proxy: ScrollViewProxy) {
        let state = viewModel.state
        // A load-earlier fetch is in flight: its prepend restores the position itself.
        guard pendingScrollAnchorId == nil, let last = state.messages.last else { return }
        if isHistoryEntry && !historyInitialScrollDone {
            // A conversation opened from Chat History starts at its FIRST message, once
            // (product decision shared with compose/web).
            guard state.isInitialHistoryLoaded, let first = state.messages.first else { return }
            historyInitialScrollDone = true
            historyOpenedTailId = last.id
            proxy.scrollTo(Self.pinId(first.id), anchor: .top)
            return
        }
        // Nothing new since the history thread was opened (only older pages prepended): stay put.
        if isHistoryEntry && last.id == historyOpenedTailId { return }
        guard let anchor = scrollAnchorId() else { return }
        withAnimation { proxy.scrollTo(Self.pinId(anchor), anchor: .top) }
    }

    /// Name for the thread's coordinate space, so the trailing marker can report its
    /// position relative to the scroll content rather than the screen.
    private static let threadSpace = "fcChatThread"

    /// The newest AI answer's id — the scroll indicator's `triggerKey`, so its timeline
    /// restarts once per answer exactly as android's `remember(triggerKey)` does.
    private var lastAiMessageId: String? {
        for message in viewModel.state.messages.reversed() {
            if case .aiResponse(let ai) = message { return ai.id }
        }
        return nil
    }

    // MARK: - Reveal helpers

    /// True when this chat was opened from history (bulk-loaded thread — never
    /// animate). Matches the Android `isHistoryEntry` predicate.
    private var isHistoryEntry: Bool {
        !(args.conversationId ?? "").isEmpty
    }

    /// The newest AI answer's ROW id (the prefixed `ChatMessage.id` the `ForEach` rows carry —
    /// `lastAiMessageId` is the raw `AiResponse.id`). Hosts the follow-up section.
    private var lastAiRowId: String? {
        lastAiMessage.map { ChatMessage.aiResponse($0).id }
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

    /// ChatResponseActions.kt `showFollowUps = false` case: the last answer carries an ADDITIVE
    /// alignment surface with chips, which owns the next action.
    private var additiveSurfaceOpen: Bool {
        guard let last = lastAiMessage, let kind = last.alignmentKind, kind.isAdditive else { return false }
        return !(last.alignmentChips ?? []).isEmpty
    }

    /// `ChatMessage.id` of the question whose send failed, while its error is showing — the row
    /// that carries InlineErrorContent (ChatThreadContent.kt `failedMessageId == message.id &&
    /// errorMessage != null`). Nil when the error is not tied to a bubble in the thread.
    private var failedUserRowId: String? {
        guard viewModel.state.errorMessage != nil, !viewModel.state.isLoading,
              let failed = viewModel.state.failedMessageId else { return nil }
        let rowId = "user_\(failed)"
        return viewModel.state.messages.contains { $0.id == rowId } ? rowId : nil
    }

    /// InlineErrorContent / ChatErrorContent retry (the tap's analytics are tracked by the view).
    private func retry() {
        viewModel.onAction(.retryLastRequest)
    }

    @ViewBuilder
    private func messageRow(_ message: ChatMessage) -> some View {
        switch message {
        case .user(let user):
            // ChatThreadContent.kt: Column(spacedBy 12) [bubble row (start padding 64, End),
            // + InlineErrorContent under the failed question], fading in over 500ms.
            let failedHere = failedUserRowId == message.id
            VStack(alignment: .leading, spacing: 12) {
                FCUserChatBubble(message: user, playback: playback)
                    .padding(.leading, 64)
                if failedHere {
                    if user.audioURL != nil {
                        FCVoiceRetryPill(onRetry: retry)
                    } else {
                        FCInlineErrorContent(onRetry: retry)
                    }
                }
            }
            .modifier(FCFadeInOnAppear(duration: 0.5))
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
                    onTypeInstead: { composerFocusRequest = true },
                    listen: ai.messageId != nil ? listenConfig : nil
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
                    // App parity (ChatThreadContent.kt, app dev/v2.5): the latest answer always
                    // gets the response actions — pre-generated included. Whether that is the
                    // "Read full advice" button or the Share/Listen row is decided in the bubble.
                    // ChatThreadContent.kt `isLastResponse && !isLoading`: once a follow-up is in
                    // flight (its placeholder / stream is the final row) the previous answer drops
                    // its disclaimer + Share/Listen row AT ONCE. Keeping it until the stream bubble
                    // replaced the placeholder collapsed ~150pt above the pinned question
                    // mid-load and scrolled it off the top. (UIKit `isLatest` mirrors this.)
                    showActions: isLastAi
                        && !(viewModel.state.isLoading && viewModel.state.messages.last?.id != message.id),
                    isTtsEnabled: viewModel.state.isTtsEnabled,
                    isSynthesising: viewModel.state.isLoadingSynthesiseAudio,
                    isAudioPlaying: viewModel.state.isAudioPlaying,
                    animate: shouldAnimate,
                    onListen: listenTapped,
                    onShare: { share(ai) },
                    onDownload: { download(ai) },
                    // "Read full advice" is available only on the latest pre-generated answer with
                    // a non-blank question that has not already been expanded (app:
                    // `isPreGenerated && questionForReadFull.isNotBlank() && id != requested`).
                    onReadFullAdvice: readFullAdviceAvailable(for: ai, isLastAi: isLastAi) ? {
                        viewModel.onAction(.replacePreGeneratedWithQuestion(question: args.question ?? "", triggerInputType: "card"))
                    } : nil,
                    onRevealComplete: { revealedIds.insert(ai.id) },
                    isLatest: isLastAi,
                    isBusy: viewModel.state.isLoading,
                    onRetryStream: { viewModel.onAction(.retryLastRequest) },
                    onAlignmentChipTap: { chip in
                        handleAlignmentChip(messageId: ai.id, kind: ai.alignmentKind, chip: chip)
                    },
                    hasAudio: viewModel.state.audioPlaybackUrl != nil
                )
            }
        // 2.0.0: the farmer's resolved location, standing in for the text bubble they would
        // otherwise have sent. Right-aligned because it is their reply to a GPS_PROMPT chip.
        case .location(let location):
            HStack {
                Spacer(minLength: 64)
                FCLocationChatBubble(
                    address: location.address,
                    label: fcLabel(AgenticLabels.yourLocation, AgenticLabels.yourLocationFallback)
                )
            }
        case .loadingPlaceholder:
            // ChatThreadContent.kt:615-633: no spinner while a voice clip is being transcribed.
            FCChatLoadingBubble()
                .opacity(viewModel.state.isTranscribing ? 0 : 1)
        }
    }

    /// App parity (ChatThreadContent.kt `onReadFullAdviceClick`): non-nil only for the latest
    /// pre-generated answer with a non-blank question that has not already been expanded.
    private func readFullAdviceAvailable(for ai: ChatMessage.AiResponse, isLastAi: Bool) -> Bool {
        ai.isPreGenerated
            && isLastAi
            && !(args.question ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && viewModel.state.readFullAdviceRequestedForMessageId != ai.id
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
            alignmentPhotoSourceId = messageId
            alignmentPhotoChip = chip
            Task {
                if await FCCameraPermission.request() {
                    showCamera = true
                } else {
                    // ChatScreen.kt:665-672: a chip-driven flow never blocks on the settings
                    // dialog — the denial is sent as the decline query.
                    sendAlignmentPhotoDecline(.photoPermissionDenied)
                }
            }
        case .chooseFromGallery:
            alignmentPhotoSourceId = messageId
            alignmentPhotoChip = chip
            showGallery = true
        case .none:
            // App `SendAlignmentChip` (ChatViewModel.kt:1015-1053): `align_chip_sel` +
            // `parent_message_id` = the surface's server message_id; the chip's value marks it.
            viewModel.sendAlignmentChip(chip, kind: kind, sourceMessageId: messageId)
        }
    }

    /// A picked photo: an UPLOAD_PHOTO chip's photo is reported as that chip's pick; a composer
    /// photo as a manual send. Core re-encodes either (ImageUtils port).
    private func sendPicked(_ picked: FCPickedImage) {
        if alignmentPhotoSourceId != nil, let chip = alignmentPhotoChip {
            alignmentPhotoSourceId = nil
            alignmentPhotoChip = nil
            viewModel.sendAlignmentPhoto(chip: chip, imageData: picked.sourceData, imageURL: picked.fileURL)
        } else {
            // InputComposer flow (ChatScreen.kt:497-503 `photoUris = listOf(uri)`): the photo
            // waits in the composer for an optional caption; Send sends both.
            alignmentPhotoSourceId = nil
            guard FarmerChat.shared.config.resolvedComposerUi else {
                // Legacy input (ChatScreen.kt:651-658): a picked photo is sent at once.
                viewModel.onAction(.sendQuestionWithImage(question: "", imageData: picked.sourceData, imageURL: picked.fileURL))
                return
            }
            composerPhoto = picked
            composerFocusRequest = true
        }
    }

    /// The UPLOAD_PHOTO camera / gallery closed without a photo (ChatScreen.kt:524-531, 576-583):
    /// send "I don't have a photo to share right now". No-op outside a chip-driven flow.
    private func alignmentPhotoNotShared() {
        guard alignmentPhotoSourceId != nil else { return }
        sendAlignmentPhotoDecline(.photoNotShared)
    }

    /// App `sendAlignmentPhotoDeclineQuery` (ChatScreen.kt:469-485): an alignment-chip send of
    /// `queryText` with `photo_declined = true` and the surface's `parent_message_id`.
    private func sendAlignmentPhotoDecline(_ decline: CapabilityDecline) {
        guard let source = alignmentPhotoSourceId else { return }
        alignmentPhotoSourceId = nil
        viewModel.sendCapabilityDecline(decline, sourceMessageId: source)
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
            // Denied / cancelled / fetch failed: still answer the blocking question with the
            // decline text, as the app does (ChatScreen.kt:377-380): an alignment-chip send with
            // `location_declined = true` and the surface's `parent_message_id`.
            viewModel.sendCapabilityDecline(.location, sourceMessageId: sourceId)
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

    /// ChatErrorContent.kt: padding(horizontal 20, top 20), spacedBy 16 — the failed question's
    /// bubble (start padding 64) then InlineErrorContent (or the Retry pill for a voice question).
    private func chatError(_ message: String) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            let audioURL = args.audioPath.map { URL(fileURLWithPath: $0) }
            let question = args.question ?? ""
            if !question.isEmpty || audioURL != nil {
                FCUserChatBubble(
                    message: ChatMessage.UserMessage(text: question, audioURL: audioURL, isFailed: true),
                    playback: playback
                )
                .padding(.leading, 64)
            }
            if audioURL != nil {
                FCVoiceRetryPill(onRetry: retry)
            } else {
                FCInlineErrorContent(onRetry: retry)
            }
            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 20)
        .padding(.top, 20)
    }

    /// Listen inputs shared by the answer bubble and the exclusive alignment surface.
    private var listenConfig: FCListenConfig {
        FCListenConfig(
            enabled: viewModel.state.isTtsEnabled,
            loading: viewModel.state.isLoadingSynthesiseAudio,
            playing: viewModel.state.isAudioPlaying,
            hasAudio: viewModel.state.audioPlaybackUrl != nil,
            onTap: listenTapped
        )
    }

    // MARK: - Composer (follow-up entry points)

    /// `resolvedComposerUi` (Android `FarmerChatConfig.resolvedComposerUi`): the floating
    /// InputComposer, or the legacy Photo / Speak / Type row (ChatScreen.kt:1709) that slides
    /// 150pt down while an answer generates or the text input is open; Type opens the text
    /// input (the composer, focused) over it.
    @ViewBuilder
    private var inputSurface: some View {
        if FarmerChat.shared.config.resolvedComposerUi {
            composer
        } else {
            ZStack(alignment: .bottom) {
                FCPrimaryInputButtons(
                    variant: .chat,
                    showPhoto: FarmerChat.shared.config.enableImages,
                    showVoice: FarmerChat.shared.config.enableVoice,
                    onPhoto: { showPhotoSheet = true },
                    onSpeak: startVoice,
                    onType: {
                        legacyTyping = true
                        composerFocusRequest = true
                    }
                )
                .background(
                    GeometryReader { proxy in
                        Color.clear.preference(key: FCComposerHeightKey.self, value: proxy.size.height)
                    }
                )
                .offset(y: viewModel.state.isLoading || legacyTyping ? 150 : 0)
                .animation(.easeInOut(duration: 0.45), value: viewModel.state.isLoading || legacyTyping)

                if legacyTyping {
                    composer
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .onChange(of: composerFocusRequest) { requested in
                // "Type or say it" and the empty state's Type open the text input here too.
                if requested { legacyTyping = true }
            }
            .onChange(of: composerFocused) { focused in
                if !focused && typedText.isEmpty { legacyTyping = false }
            }
        }
    }

    /// ChatInputOverlays.kt:64-77 — the floating InputComposer. Hidden (slid 400 down) while an
    /// answer is loading: the first-question loading state and `Thread && isLoading`.
    private var composer: some View {
        FCChatComposer(
            text: $typedText,
            placeholder: fcLabel(FCLabels.askAboutYourFarm, "Ask about your farm..."),
            showCamera: FarmerChat.shared.config.enableImages,
            showMic: FarmerChat.shared.config.enableVoice,
            visible: !viewModel.state.isLoading,
            attachment: composerPhoto?.image,
            onRemoveAttachment: { composerPhoto = nil },
            focusRequest: $composerFocusRequest,
            onFocusChange: { composerFocused = $0 },
            onSend: { question in
                if let photo = composerPhoto {
                    // ChatScreen.kt:1795-1803: the attached photo goes with the typed caption
                    // (blank → image-only bubble; Core supplies the default prompt).
                    composerPhoto = nil
                    viewModel.onAction(.sendQuestionWithImage(question: question, imageData: photo.sourceData, imageURL: photo.fileURL))
                } else {
                    viewModel.onAction(.sendFollowUpQuestion(question: question, followUpQuestionId: nil, transcriptionId: nil, audioURL: nil))
                }
            },
            onCamera: { showPhotoSheet = true },
            onMic: startVoice
        )
    }

    /// Tips.kt (ChatThreadContent.kt:680-685): shown while an answer is pending and before any
    /// streamed text has arrived; gone once text streams in.
    private var showTips: Bool {
        guard viewModel.state.isLoading else { return false }
        switch viewModel.state.messages.last {
        case .none, .loadingPlaceholder?, .user?: return true
        case .aiResponse(let ai)?: return ai.isStreaming && ai.text.isEmpty
        case .location?: return true
        }
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
        guard let image = FCShareCardRenderer.render(question: lastQuestion(before: ai), answer: ai.text, theme: theme) else {
            toast.show(.error, fcLabel(FCLabels.somethingWentWrongPleaseTryAgain, "Something went wrong. Please try again."))
            return
        }
        shareImage = image
    }

    private func download(_ ai: ChatMessage.AiResponse) {
        FarmerChat.shared.analytics.track(AnalyticsEvents.downloadResponseClicked)
        guard let image = FCShareCardRenderer.render(question: lastQuestion(before: ai), answer: ai.text, theme: theme) else {
            toast.show(.error, fcLabel(FCLabels.somethingWentWrongPleaseTryAgain, "Something went wrong. Please try again."))
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

// MARK: - Empty-chat placeholder (SDK addition; web chatParts.tsx `ChatEmptyState`)

/// Centred placeholder for a chat with no messages: the FarmerChat mark in a brand-green disc with
/// a soft halo, the tagline, the "ask by…" hint and Photo / Speak / Type pills that do exactly what
/// the chat's own input bar does. Labels only — existing keys, no new ones.
private struct FCChatEmptyState: View {
    @Environment(\.fcTheme) private var theme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// Nil hides the pill (images / voice disabled in config).
    let onPhoto: (() -> Void)?
    let onSpeak: (() -> Void)?
    let onType: () -> Void

    @State private var appeared = false

    var body: some View {
        VStack(spacing: 10) {
            mark
                .padding(.bottom, 6)
            Text(fcLabel(FCLabels.farmerchatTagline, "FarmerChat: Practical advice for your crops & livestock"))
                .font(theme.font(size: 18, weight: .semibold))
                .lineSpacing(Self.extraLeading(size: 18 * theme.typeScale, lineHeight: 24 * theme.typeScale, weight: .semibold, fontName: theme.fontName))
                .foregroundColor(theme.content.foregroundPrimary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 300)
                .fixedSize(horizontal: false, vertical: true)
            Text(fcLabel(
                FCLabels.getStartedByClickingOnPhotoSpeakOrTypeToAskYourQuestion,
                "Tap a button to ask a question"
            ))
                .font(theme.font(size: 14))
                .lineSpacing(Self.extraLeading(size: 14 * theme.typeScale, lineHeight: 20 * theme.typeScale, weight: .regular, fontName: theme.fontName))
                .foregroundColor(theme.content.foregroundSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 280)
                .fixedSize(horizontal: false, vertical: true)
            // 8 apart, wrapping: one row when it fits, else stacked.
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) { pills }
                VStack(spacing: 8) { pills }
            }
            .padding(.top, 10)
        }
        .padding(.horizontal, 32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        // 360ms fade + 6pt rise on appear; none with Reduce Motion.
        .opacity(appeared || reduceMotion ? 1 : 0)
        .offset(y: appeared || reduceMotion ? 0 : 6)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeOut(duration: 0.36)) { appeared = true }
        }
    }

    /// 64pt brand disc holding the white 34pt mark, with an 8pt halo ring at ~12% brand. The halo
    /// is a background, so (like the web box-shadow spread) it takes no layout space.
    private var mark: some View {
        let brand = theme.brand.surfacePrimary
        return Circle()
            .fill(brand)
            .frame(width: 64, height: 64)
            .overlay(FCLogoMark(size: 34, tint: .white))
            .background(Circle().fill(brand.opacity(0.12)).frame(width: 80, height: 80))
            .shadow(color: brand.opacity(0.35), radius: 10, x: 0, y: 8)
            .accessibilityHidden(true)
    }

    @ViewBuilder
    private var pills: some View {
        if let onPhoto {
            pill(icon: "camera.fill", title: fcLabel(FCLabels.photo, "Photo"), action: onPhoto)
        }
        if let onSpeak {
            pill(icon: "mic.fill", title: fcLabel(FCLabels.speak, "Speak"), action: onSpeak)
        }
        pill(icon: "keyboard", title: fcLabel(FCLabels.type, "Type"), action: onType)
    }

    /// 40pt fully-rounded pill: 1pt default border, surface fill, 14pt semibold label, leading
    /// 28pt circle at ~12% brand holding a 20pt brand-green icon.
    private func pill(icon: String, title: String, action: @escaping () -> Void) -> some View {
        let brand = theme.brand.surfacePrimary
        return Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(brand)
                    .frame(width: 20, height: 20)
                    .frame(width: 28, height: 28)
                    .background(Circle().fill(brand.opacity(0.12)))
                    .accessibilityHidden(true)
                Text(title)
                    .font(theme.font(size: 14, weight: .semibold))
                    .foregroundColor(theme.content.foregroundPrimary)
                    .lineLimit(1)
            }
            .padding(.leading, 8)
            .padding(.trailing, 14)
            .frame(height: 40)
            .background(Capsule().fill(theme.content.surfacePrimary))
            .overlay(Capsule().strokeBorder(theme.content.borderDefault, lineWidth: 1))
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    /// `.lineSpacing` is ADDITIVE to the font's natural line height (see FCTypography.swift), so
    /// the extra leading for a target pitch is `lineHeight - UIFont.lineHeight`.
    /// A host font is measured by name (system metrics if it does not resolve), as
    /// `FCTextStyle.naturalLineHeight` does.
    private static func extraLeading(size: CGFloat, lineHeight: CGFloat, weight: UIFont.Weight, fontName: String?) -> CGFloat {
        let natural = fontName.flatMap { UIFont(name: $0, size: size) }?.lineHeight
            ?? UIFont.systemFont(ofSize: size, weight: weight).lineHeight
        return max(0, lineHeight - natural)
    }
}
