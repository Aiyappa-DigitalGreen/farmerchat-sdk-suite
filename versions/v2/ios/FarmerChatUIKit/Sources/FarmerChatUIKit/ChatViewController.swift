#if canImport(UIKit)
import UIKit
import AVFoundation
import Combine
import FarmerChatCore

/// Chat route arguments (mirror of the app's Chat destination).
struct FCUIChatArgs {
    var source: String = "home"
    var question: String?
    var conversationId: String?
    var imagePath: String?
    var transcriptionId: String?
    var audioPath: String?
    var homeStatementId: String?
    var preGeneratedAnswer: String?
    var followUpQuestions: [String] = []
    var isWeatherAdviceCTA = false
    var isSSFR = false
    var ssfrCrop: String?
    var channel: String?
}

/// Native UIKit Chat: UICollectionView with bubble cells, follow-up chips,
/// retry, Listen TTS, voice clips, image queries, history pagination.
final class FCUIChatViewController: UIViewController {
    private enum Row: Hashable {
        case loadEarlier
        case message(String) // ChatMessage.id
        /// An EXCLUSIVE alignment surface (2.0.0) — a different cell class, so it gets its own
        /// case: the row identifier must change if a message ever switched shape under a stable id.
        case alignment(String) // ChatMessage.id
        /// The farmer's shared location (2.0.0) — a fixed-size card, so its own cell class.
        case location(String) // ChatMessage.id
        /// A numbered follow-up chip. Keyed by position as well as text (two identical questions
        /// must not collide in the snapshot) and carrying the clarify flag, so a flip of the
        /// chips' accent re-renders them.
        case followUp(index: Int, question: String, clarify: Bool, isLast: Bool)
        /// ChatResponseActions.kt follow-up title ("You can also ask" / clarify variant).
        case followUpTitle(String)
        /// InlineErrorContent.kt under the failed question (or a standalone one when the error is
        /// not tied to a question bubble). `isVoice` → the right-aligned Retry pill instead.
        case inlineError(isVoice: Bool)

        var messageId: String? {
            switch self {
            case .message(let id), .alignment(let id), .location(let id): return id
            case .loadEarlier, .followUp, .followUpTitle, .inlineError: return nil
            }
        }
    }

    private let args: FCUIChatArgs
    private let viewModel = ChatViewModel()
    private let playback = AudioPlaybackService()
    private let ttsPlayback = AudioPlaybackService()
    private let recorder = AudioRecorderService()
    private var cancellables = Set<AnyCancellable>()

    private var collectionView: UICollectionView!
    private var dataSource: UICollectionViewDiffableDataSource<Int, Row>!
    private var messagesById: [String: ChatMessage] = [:]
    /// InputComposer.kt (floating, anchored, compact) — the always-visible text field.
    private var composer: FCUIComposerView!
    /// Pins the composer to the keyboard (4pt gap) or the safe area (0 → the home-indicator inset).
    private var composerBottom: NSLayoutConstraint!
    /// Slides the composer 400pt down while an answer loads (ChatScreen.kt:1752).
    private var composerHidden = false
    /// Tips.kt pager over the bottom while the first answer is generated.
    private let tips = FCUITipsView()
    /// LogoAppBar.kt — the branded bar replacing the system navigation bar on this screen.
    private var appBar: FCUIChatAppBar!
    /// ScrollIndicator.kt — bottom-centre, 16 above the thread's bottom edge (the input bar sits
    /// below the list here rather than over it, so the app's `inputButtonsHeight` is not added).
    private let scrollIndicator = FCUIScrollIndicator()
    /// SDK addition: centred placeholder for an empty, idle, non-history chat (web
    /// `ChatEmptyState`). A sibling of the list pinned to its frame, so it sits above the input bar
    /// and never scrolls away.
    private var emptyState: FCUIChatEmptyStateView!
    /// The language the chrome's labels were resolved for (see `viewWillAppear`).
    private var builtLanguage: String?
    /// The answer id the indicator's timeline last started for (`remember(triggerKey)`).
    private var scrollIndicatorKey: String?
    private var didInitialize = false
    // History pagination: track the previous thread shape so a prepended older
    // page (load-earlier) preserves scroll position instead of jumping to the
    // newest message.
    private var prevMessageCount = 0
    private var prevLastMessageId: String?
    // 2.0.0 streaming: a delta changes an existing message's CONTENT, not the thread's shape, so
    // the diffable snapshot is identical and `apply` would be a no-op. These mirrors let `render`
    // detect content-only changes and reconfigure exactly those rows in place.
    private var prevRows: [Row] = []
    private var prevMessagesById: [String: ChatMessage] = [:]
    private var prevIsLoading = false
    private var prevListenKey = ""
    private var autoPlayedAudioUrl: String?
    /// The answer the current TTS clip belongs to.
    private var audioOwnerRowId: String?
    private var prevLastAiRowId: String?
    private var prevIsInitialHistoryLoaded = false
    /// The newest question row last rendered — a change is the auto-scroll trigger.
    private var prevQuestionRowId: String?
    // Reserve + pinning (port of Android core ChatReserve.kt; see `updateReserveInset`).
    /// `ChatMessage.id` of the row the reserve keeps reachable at the TOP of the viewport (the
    /// farmer's question above a reserve-holding final row). Nil when the final row holds none.
    private var reserveAnchorMessageId: String?
    /// History entry: true once the opened conversation has been scrolled to its FIRST message.
    private var historyInitialScrollDone = false
    /// History entry: the thread's tail when it was opened. No auto-scroll while it is unchanged.
    private var historyOpenedTailId: String?
    /// Coalesces the pin triggers of one burst of state emissions into a single scroll.
    private var pinScheduled = false
    private var contentSizeObservation: NSKeyValueObservation?
    /// The list's resting bottom inset (ChatThreadContent.kt bottom 16 less each row's own 8).
    /// The reserve only ever ADDS to it.
    private static let baseBottomInset: CGFloat = 8
    /// `ChatMessage.id` of the last `.aiResponse` — SwiftUI's `lastAiMessage` predicate. Gates the
    /// stream error card's retry and an alignment surface's escape hatch.
    private var lastAiRowId: String?
    /// Armed while a chat-initiated location flow is in progress; holds the raw `AiResponse.id` of
    /// the GPS_PROMPT surface whose chip started it (2.0.0). Nil leaves the outcome subscription
    /// inert, so an outcome belonging to Home or a widget trigger is ignored.
    private var pendingLocationSourceId: String?
    /// Armed while an UPLOAD_PHOTO capability chip's camera / gallery is open: the raw
    /// `AiResponse.id` of that surface (app `alignmentPhotoSourceId`). A pick sends the photo; a
    /// cancel or a camera-permission denial sends the app's decline query with `photo_declined`.
    private var alignmentPhotoSourceId: String?
    /// The UPLOAD_PHOTO chip that opened the camera / gallery (its value + label go on Send_Query).
    private var alignmentPhotoChip: AlignmentChip?
    /// A composer photo waiting for its caption (InputComposer `photoUris`, one image).
    private var composerPhoto: (data: Data, url: URL)?
    /// True once the location-outcome subscription is installed. Guards the share-location chip
    /// from starting a flow nothing is listening to (see `observeLocationOutcomes`).
    private var isObservingLocationOutcomes = false

    /// The CHAT_ONLY chat draws its own ✕ that exits the SDK, so a presenter's fallback close
    /// (FarmerChatFabButton) must not draw a second one over it.
    var hasOwnExit: Bool { args.source == "chatOnly" }

    init(args: FCUIChatArgs) {
        self.args = args
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    deinit {
        playback.stop()
        ttsPlayback.stop()
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = FCUITheme.surfaceReadingPrimary
        navigationItem.hidesBackButton = true
        buildAppBar()

        buildCollectionView()
        buildInputBar()

        viewModel.$state
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in self?.render(state) }
            .store(in: &cancellables)

        // ChatScreen.kt:1315-1329 `setOnCompletionListener`: when the answer audio ends, the clip is
        // dropped (`ClearAudioPlaybackUrl`) and the pill returns to "Listen". Without this the
        // UIKit pill stayed on Pause + animating bars forever after playback finished.
        ttsPlayback.didFinish
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.viewModel.onAction(.setAudioPlaying(false))
                self?.viewModel.onAction(.clearAudioPlaybackUrl)
            }
            .store(in: &cancellables)
        observeLocationOutcomes()
        initialize()
        FarmerChat.shared.analytics.screenViewed(ScreenNames.chat, extra: ["source": args.source])
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        // LogoAppBar replaces the system bar; every SDK screen draws its own bar
        // (FCUIAppBars.swift), so the system bar stays hidden throughout.
        navigationController?.setNavigationBarHidden(true, animated: animated)
        // A language Save in the chooser pushed over this chat changes the served labels; UIKit
        // views captured theirs at build time (SwiftUI re-renders on its own).
        let language = FarmerChat.shared.prefs.string(.selectedLanguageCode)
        if let builtLanguage, builtLanguage != language {
            emptyState.relabel()
            composer.relabel()
            render(viewModel.state)
        }
        builtLanguage = language
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        // MainActivity.kt: status icons follow the system (dark icons on a light system) over
        // the green bar.
        .default
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // The viewport height (keyboard, rotation) is an input to the reserve.
        updateReserveInset()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        if isMovingFromParent {
            playback.stop()
            ttsPlayback.stop()
            viewModel.onAction(.clearMessages)
            FarmerChat.shared.analytics.screenExited(ScreenNames.chat)
        }
    }

    /// LogoAppBar.kt. Left: CHAT_ONLY → the SDK's ✕ tile (exit to the host); History entry → a
    /// back tile; Home entry → the app's `leftbutton` disc. Right (drawer off, the CHAT_ONLY
    /// default): the globe tile (language) and, when `showHistory`, the history tile — SDK
    /// additions, gated as on Android (`!showDrawer`, `!showDrawer && showHistory`).
    private func buildAppBar() {
        let config = FarmerChat.shared.config
        let left: UIView
        if args.source == "chatOnly" {
            let close = FCUIHeaderTile(systemImage: "xmark", accessibilityLabel: fcuiLabel(FCLabels.close, "Close"), identifier: "fcChatClose")
            close.addAction(UIAction { [weak self] _ in self?.close() }, for: .touchUpInside)
            left = close
        } else if args.source == "history" {
            let back = FCUIHeaderTile(systemImage: "chevron.left", accessibilityLabel: "Back", identifier: "fcChatBack")
            back.addAction(UIAction { [weak self] _ in self?.close() }, for: .touchUpInside)
            left = back
        } else {
            let back = FCUILeftButton()
            back.accessibilityIdentifier = "fcChatBack"
            back.addAction(UIAction { [weak self] _ in self?.close() }, for: .touchUpInside)
            left = back
        }
        var right: [UIView] = []
        if !config.showDrawer {
            if config.showHistory {
                let history = FCUIHeaderTile(image: fcHistoryGlyphImage(size: 23), accessibilityLabel: "history", identifier: "fcChatHistory")
                history.addAction(UIAction { [weak self] _ in
                    self?.navigationController?.pushViewController(FCUIChatHistoryViewController(), animated: true)
                }, for: .touchUpInside)
                right.append(history)
            }
            let language = FCUIHeaderTile(systemImage: "globe", accessibilityLabel: "language", identifier: "fcChatLanguage")
            language.addAction(UIAction { [weak self] _ in
                self?.navigationController?.pushViewController(FCUILanguageViewController(mode: .settings), animated: true)
            }, for: .touchUpInside)
            right.append(language)
        }
        if right.isEmpty {
            // LogoAppBar.kt:144-146 — an empty 42pt spacer keeps the logo centred.
            let spacer = UIView()
            spacer.translatesAutoresizingMaskIntoConstraints = false
            spacer.widthAnchor.constraint(equalToConstant: 42).isActive = true
            right.append(spacer)
        }
        appBar = FCUIChatAppBar(left: [left], right: right)
        view.addSubview(appBar)
        NSLayoutConstraint.activate([
            appBar.topAnchor.constraint(equalTo: view.topAnchor),
            appBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            appBar.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
    }

    private func close() {
        if args.source == "chatOnly" {
            // CHAT_ONLY has no SDK Home — exit the SDK back to the host. Always tell the host
            // (`config.onExit`): an embedded journey (child VC, tab, SwiftUI representable)
            // cannot remove itself. Self-dismiss ONLY when the journey itself is the presented
            // controller (FAB, FCFarmerChat.present, host `present(...)`): for an embedded one,
            // `presentingViewController` is the presenter of an ANCESTOR, and dismissing it
            // would close the host's own modal.
            FarmerChat.shared.analytics.exit()
            let journey = navigationController ?? self
            if let presenter = journey.presentingViewController,
               presenter.presentedViewController === journey {
                presenter.dismiss(animated: true)
            }
        } else if args.source == "history" {
            navigationController?.popViewController(animated: true)
        } else {
            // popUpTo(Home){!inclusive}
            if let home = navigationController?.viewControllers.first(where: { $0 is FCUIHomeViewController }) {
                navigationController?.popToViewController(home, animated: true)
            } else {
                navigationController?.popViewController(animated: true)
            }
        }
    }

    // MARK: - Init path (one of, like the app)

    private func initialize() {
        guard !didInitialize else { return }
        didInitialize = true

        if let conversationId = args.conversationId, !conversationId.isEmpty {
            viewModel.setConversationId(conversationId)
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
        } else if let imagePath = args.imagePath, let data = try? Data(contentsOf: URL(fileURLWithPath: imagePath)) {
            viewModel.onAction(.sendQuestionWithImage(
                question: args.question ?? "",
                imageData: data,
                imageURL: URL(fileURLWithPath: imagePath)
            ))
        } else if (args.question ?? "").isEmpty, let audioPath = args.audioPath {
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

    // MARK: - UI construction

    private func buildCollectionView() {
        var listConfig = UICollectionLayoutListConfiguration(appearance: .plain)
        listConfig.backgroundColor = .clear
        listConfig.showsSeparators = false
        let layout = UICollectionViewCompositionalLayout.list(using: listConfig)
        collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collectionView.backgroundColor = .clear
        collectionView.translatesAutoresizingMaskIntoConstraints = false
        // ChatThreadContent.kt contentPadding: top 20, bottom 16 — less the 8 every row keeps
        // above / below itself (rows are 16 apart: 8 + 8).
        collectionView.contentInset = UIEdgeInsets(top: 12, left: 0, bottom: Self.baseBottomInset, right: 0)
        view.addSubview(collectionView)
        // The reserve tracks the real content: as a streamed answer grows the extra bottom space
        // shrinks by the same amount, so the pinned question never moves.
        contentSizeObservation = collectionView.observe(\.contentSize, options: [.new]) { [weak self] _, _ in
            self?.updateReserveInset()
        }

        let bubbleCell = UICollectionView.CellRegistration<FCUIChatBubbleCell, String> { [weak self] cell, _, messageId in
            guard let self, let message = self.messagesById[messageId] else { return }
            cell.configure(
                message: message,
                isTtsEnabled: self.viewModel.state.isTtsEnabled,
                listenState: self.listenState,
                isTranscribing: self.viewModel.state.isTranscribing,
                playback: self.playback,
                // ChatThreadContent.kt `isLastResponse`: once a follow-up is in flight (its
                // placeholder / stream is the last row) the previous answer drops its actions.
                isLatest: messageId == self.lastAiRowId
                    && !(self.viewModel.state.isLoading && self.viewModel.state.messages.last?.id != messageId),
                isBusy: self.viewModel.state.isLoading,
                readFullAdviceAvailable: self.readFullAdviceAvailable(messageId: messageId)
            )
            cell.onReadFullAdvice = { [weak self] in
                guard let self else { return }
                self.viewModel.onAction(.replacePreGeneratedWithQuestion(
                    question: self.args.question ?? "",
                    triggerInputType: "card"
                ))
            }
            cell.onRetry = { self.viewModel.onAction(.retryLastRequest) }
            cell.onListen = { self.listenTapped() }
            cell.onShare = { text in self.share(text: text) }
            cell.onPlayClip = { url, id in self.toggleClip(url: url, id: id) }
            // 2.0.0: the stream error card owns the retry for an interrupted stream (core
            // deliberately leaves `state.errorMessage` nil there, so there is no second banner).
            cell.onRetryStream = { [weak self] in self?.viewModel.onAction(.retryLastRequest) }
            // ADDITIVE surface below a real answer: its chips route through the same capability
            // handler, keyed on that answer's own id.
            cell.onAlignmentChipTap = { [weak self] chip in
                guard let self, case .aiResponse(let ai)? = self.messagesById[messageId] else { return }
                self.handleAlignmentChip(messageId: ai.id, kind: ai.alignmentKind, chip: chip)
            }
            cell.onLayoutInvalidated = { [weak self] in
                // The stall hint toggles on its own timer, outside a snapshot apply: nudge the
                // collection view to re-measure this self-sizing cell.
                self?.collectionView.performBatchUpdates(nil)
            }
        }
        // 2.0.0: an EXCLUSIVE alignment surface replaces the answer bubble entirely.
        let alignmentCell = UICollectionView.CellRegistration<FCUIAlignmentSurfaceCell, String> { [weak self] cell, _, messageId in
            guard let self, case .aiResponse(let ai)? = self.messagesById[messageId] else { return }
            cell.configure(
                message: ai,
                isLatest: messageId == self.lastAiRowId,
                isBusy: self.viewModel.state.isLoading,
                isTtsEnabled: self.viewModel.state.isTtsEnabled,
                listenState: self.listenState
            )
            cell.onChipTap = { [weak self] chip in
                self?.handleAlignmentChip(messageId: ai.id, kind: ai.alignmentKind, chip: chip)
            }
            // AlignmentSurface.kt Listen pill on the live prompt.
            cell.onListen = { [weak self] in self?.listenTapped() }
            // AlignmentSurface.kt `onTypeInstead` → ChatScreen.kt:1666 `focusTextInput`: focus the
            // composer's field (`typeTapped`).
            cell.onTypeInstead = { [weak self] in self?.typeTapped() }
        }
        // 2.0.0: the farmer's shared location, standing in for the text bubble they never typed.
        let locationCell = UICollectionView.CellRegistration<FCUILocationBubbleCell, String> { [weak self] cell, _, messageId in
            guard let self, case .location(let location)? = self.messagesById[messageId] else { return }
            cell.configure(message: location)
        }
        let chipCell = UICollectionView.CellRegistration<FCUIFollowUpChipCell, (index: Int, question: String, clarify: Bool, isLast: Bool)> { [weak self] cell, _, item in
            let question = item.question
            cell.configure(question: question, number: item.index + 1, clarificationRequired: item.clarify, isLast: item.isLast)
            cell.onTap = {
                self?.viewModel.onAction(.sendFollowUpQuestion(
                    question: question, followUpQuestionId: question, transcriptionId: nil, audioURL: nil
                ))
            }
        }
        let titleCell = UICollectionView.CellRegistration<FCUIFollowUpTitleCell, String> { cell, _, title in
            cell.configure(title: title)
        }
        let errorCell = UICollectionView.CellRegistration<FCUIInlineErrorCell, Bool> { [weak self] cell, _, isVoice in
            cell.configure(isVoice: isVoice)
            cell.onRetry = { self?.viewModel.onAction(.retryLastRequest) }
        }
        // "Load earlier messages" affordance at the top of a history thread —
        // tapping it (handled in didSelectItemAt) loads the next older page.
        let loadEarlierCell = UICollectionView.CellRegistration<UICollectionViewListCell, Void> { [weak self] cell, _, _ in
            var content = cell.defaultContentConfiguration()
            content.text = FarmerChat.shared.labels.label("load_earlier", fallback: "Load earlier messages")
            content.textProperties.alignment = .center
            content.textProperties.font = FCUITypography.current.labelMedium.font
            content.textProperties.color = self?.view.tintColor ?? .tintColor
            cell.contentConfiguration = content
        }

        dataSource = UICollectionViewDiffableDataSource<Int, Row>(collectionView: collectionView) { collectionView, indexPath, row in
            switch row {
            case .loadEarlier:
                return collectionView.dequeueConfiguredReusableCell(using: loadEarlierCell, for: indexPath, item: ())
            case .message(let id):
                return collectionView.dequeueConfiguredReusableCell(using: bubbleCell, for: indexPath, item: id)
            case .alignment(let id):
                return collectionView.dequeueConfiguredReusableCell(using: alignmentCell, for: indexPath, item: id)
            case .location(let id):
                return collectionView.dequeueConfiguredReusableCell(using: locationCell, for: indexPath, item: id)
            case .followUp(let index, let question, let clarify, let isLast):
                return collectionView.dequeueConfiguredReusableCell(
                    using: chipCell, for: indexPath, item: (index: index, question: question, clarify: clarify, isLast: isLast)
                )
            case .followUpTitle(let title):
                return collectionView.dequeueConfiguredReusableCell(using: titleCell, for: indexPath, item: title)
            case .inlineError(let isVoice):
                return collectionView.dequeueConfiguredReusableCell(using: errorCell, for: indexPath, item: isVoice)
            }
        }
        collectionView.delegate = self
    }

    private func buildInputBar() {
        let config = FarmerChat.shared.config
        composer = FCUIComposerView(showCamera: config.enableImages, showMic: config.enableVoice)
        composer.onSend = { [weak self] question in
            guard let self else { return }
            if let photo = self.composerPhoto {
                // ChatScreen.kt:1795-1803: the attached photo goes with the typed caption
                // (blank → image-only bubble; Core supplies the default prompt).
                self.composerPhoto = nil
                self.composer.attachment = nil
                self.viewModel.onAction(.sendQuestionWithImage(question: question, imageData: photo.data, imageURL: photo.url))
            } else {
                self.viewModel.onAction(.sendFollowUpQuestion(
                    question: question, followUpQuestionId: nil, transcriptionId: nil, audioURL: nil
                ))
            }
        }
        composer.onRemoveAttachment = { [weak self] in
            self?.composerPhoto = nil
            self?.composer.attachment = nil
        }
        composer.onCamera = { [weak self] in self?.photoTapped() }
        composer.onMic = { [weak self] in self?.speakTapped() }
        composer.onTextChange = { [weak self] in
            guard let self else { return }
            self.render(self.viewModel.state)
        }
        composer.onFocusChange = { [weak self] focused in
            guard let self else { return }
            self.composerBottom.constant = focused ? -4 : 0
            self.render(self.viewModel.state)
        }

        view.addSubview(composer)
        tips.isHidden = true
        view.addSubview(tips)
        scrollIndicator.addAction(UIAction { [weak self] _ in
            self?.scrollIndicator.cancel()
            self?.scrollToBottom()
        }, for: .touchUpInside)
        view.addSubview(scrollIndicator)
        // Photo / Speak / Type do exactly what the input bar's own controls do; Photo / Speak are
        // omitted when images / voice are disabled in config.
        emptyState = FCUIChatEmptyStateView(
            onPhoto: FarmerChat.shared.config.enableImages ? { [weak self] in self?.photoTapped() } : nil,
            onSpeak: FarmerChat.shared.config.enableVoice ? { [weak self] in self?.speakTapped() } : nil,
            onType: { [weak self] in self?.typeTapped() }
        )
        emptyState.isHidden = true
        view.addSubview(emptyState)
        composerBottom = composer.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor)
        NSLayoutConstraint.activate([
            emptyState.topAnchor.constraint(equalTo: collectionView.topAnchor),
            emptyState.bottomAnchor.constraint(equalTo: collectionView.bottomAnchor),
            emptyState.leadingAnchor.constraint(equalTo: collectionView.leadingAnchor),
            emptyState.trailingAnchor.constraint(equalTo: collectionView.trailingAnchor),
            scrollIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            scrollIndicator.bottomAnchor.constraint(equalTo: collectionView.bottomAnchor, constant: -16),
            collectionView.topAnchor.constraint(equalTo: appBar.bottomAnchor),
            collectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            collectionView.bottomAnchor.constraint(equalTo: composer.topAnchor),
            composer.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            composer.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            composerBottom,
            tips.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tips.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tips.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }

    // MARK: - Rendering

    private func render(_ state: ChatState) {
        messagesById = Dictionary(uniqueKeysWithValues: state.messages.map { ($0.id, $0) })
        lastAiRowId = lastAiResponseRowId(in: state.messages)

        // Classify this render against the previous one so a prepended older
        // page keeps the user in place, while a new bottom turn scrolls down.
        let newCount = state.messages.count
        let newLastId = state.messages.last?.id
        let isPrepend = newLastId != nil && newLastId == prevLastMessageId && newCount > prevMessageCount
        // ChatThreadContent.kt:228-285: the ONLY programmatic scroll is when a new question (user
        // bubble, or shared-location bubble) is appended — it goes to the top and stays there
        // while its answer loads, streams and settles into the reserve below it. The app never
        // re-scrolls on stream chunks or when the answer finalizes; re-pinning on the tail id /
        // `isLoading` (as this screen used to) jumped the thread at the placeholder → stream →
        // final-answer swaps. Plus the first history load.
        let newQuestionId = lastQuestionRowId(in: state.messages)
        let shouldPin = newQuestionId != prevQuestionRowId
            || state.isInitialHistoryLoaded != prevIsInitialHistoryLoaded
        prevQuestionRowId = newQuestionId
        let beforeOffsetY = collectionView.contentOffset.y
        let beforeHeight = collectionView.contentSize.height

        var rows: [Row] = []
        // Load-earlier affordance pinned to the top of the thread.
        if state.historyNextPage != nil {
            rows.append(.loadEarlier)
        }
        // ChatThreadContent.kt: the inline error sits directly UNDER the failed question
        // (Column(spacedBy 12) [bubble, InlineErrorContent]); an error not tied to a question
        // bubble (e.g. a history page) keeps a standalone trailing row.
        let showError = state.errorMessage != nil && !state.isLoading
        let failedRowId = state.failedMessageId.map { "user_\($0)" }
        var placedError = false
        for message in state.messages {
            rows.append(row(for: message))
            if showError, !placedError, message.id == failedRowId, case .user(let user) = message {
                rows.append(.inlineError(isVoice: user.audioURL != nil))
                placedError = true
            }
        }
        if showError, !placedError, !state.messages.isEmpty {
            rows.append(.inlineError(isVoice: false))
        }
        // 2.0.0: an EXCLUSIVE alignment surface owns the message area — it replaces the answer,
        // its action row AND its related-questions section. ChatResponseActions.kt
        // `showFollowUps = false` also when an additive surface with chips renders below the
        // answer. Follow-ups are NOT hidden by an error.
        if let suggestions = state.suggestedQuestions, !suggestions.isEmpty, !state.isLoading,
           !lastAiIsExclusiveSurface(), !lastAiHasAdditiveChips() {
            // App: a pre-generated answer's follow-ups never take the clarify accent.
            let clarify = state.clarificationRequired && !lastAiIsPreGenerated()
            rows.append(.followUpTitle(clarify
                ? fcuiLabel(FCLabels.chooseAFollowupOptionBelow, "Choose an option from the below")
                : fcuiLabel(FCLabels.relatedQuestions, "You can also ask")))
            rows.append(contentsOf: suggestions.enumerated().map {
                Row.followUp(index: $0.offset, question: $0.element, clarify: clarify, isLast: $0.offset == suggestions.count - 1)
            })
        }

        var snapshot = NSDiffableDataSourceSnapshot<Int, Row>()
        snapshot.appendSections([0])
        snapshot.appendItems(rows)

        // Content-only changes (a streamed delta, a tool status, a follow-up backfill, a user
        // bubble marked failed) keep the same row identifiers, so ask for an in-place reconfigure
        // of exactly those rows. `isLatest`/`isBusy` are render inputs too, so a change in either
        // reconfigures every surviving message row.
        // The Listen pill's Loading / Playing state lives on the thread state, not the message.
        let listenKey = "\(state.isLoadingSynthesiseAudio)-\(state.isAudioPlaying)-\(state.audioPlaybackUrl != nil)-\(state.isTranscribing)"
        let flagsChanged = state.isLoading != prevIsLoading || lastAiRowId != prevLastAiRowId
            || listenKey != prevListenKey
        prevListenKey = listenKey
        let survivingRows = Set(prevRows)
        let changedRows = rows.filter { row in
            guard let id = row.messageId, survivingRows.contains(row), let message = messagesById[id] else {
                return false
            }
            return flagsChanged || prevMessagesById[id] != message
        }
        if !changedRows.isEmpty {
            snapshot.reconfigureItems(changedRows)
        }
        // Animate only a real change of shape: animating a per-delta reconfigure would make a
        // streaming answer jitter.
        let structureChanged = rows != prevRows
        dataSource.apply(snapshot, animatingDifferences: !isPrepend && structureChanged) { [weak self] in
            guard let self else { return }
            if isPrepend {
                // Keep the previously-visible content in place after inserting
                // older messages above it (no maintainVisibleContentPosition on
                // UICollectionView, so adjust the offset by the height delta).
                let delta = self.collectionView.contentSize.height - beforeHeight
                self.collectionView.contentOffset.y = beforeOffsetY + delta
            }
            // From the CURRENT state, not this render's: a send appends the question and the
            // loading placeholder as two state changes, so two animated applies run back to back
            // and their completions can land out of order. With the captured state the stale
            // "question is last" render won, cleared the anchor and dropped the reserve inset, so
            // the pin clamped and the new question never reached the top.
            self.reserveAnchorMessageId = self.reserveAnchorId(in: self.viewModel.state)
            self.updateReserveInset()
        if !isPrepend && shouldPin {
                self.schedulePin()
            }
        }
        prevMessageCount = newCount
        prevLastMessageId = newLastId
        prevRows = rows
        prevMessagesById = messagesById
        prevIsLoading = state.isLoading
        prevLastAiRowId = lastAiRowId
        prevIsInitialHistoryLoaded = state.isInitialHistoryLoaded

        // ChatScreen.kt:1752 — the composer slides 400pt down while an answer loads (Thread &&
        // isLoading; tween 300 ms) and comes back on success or error.
        setComposerHidden(state.isLoading && !state.messages.isEmpty)
        // Tips.kt over the bottom while loading and before any streamed text (ChatThreadContent.kt:680-685).
        let awaitingText: Bool = {
            switch state.messages.last {
            case .loadingPlaceholder?: return true
            case .aiResponse(let ai)?: return ai.isStreaming && ai.text.isEmpty
            default: return false
            }
        }()
        let showTips = state.isLoading && awaitingText
        if showTips != !tips.isHidden {
            tips.isHidden = !showTips
            if showTips { tips.start() } else { tips.stop() }
        }

        // Empty-chat placeholder: `messages.isEmpty && !isLoading && !isHistoryEntry`. The UIKit
        // inputs are modal presentations (alert / sheet / picker) that cover it, so "no input
        // overlay open" needs no extra state. An entry carrying a question / answer / image /
        // clip fills the thread itself (its send starts in a Task), so it never shows there.
        let hasEntryPayload = [args.question, args.preGeneratedAnswer, args.imagePath, args.audioPath]
            .contains { !($0 ?? "").isEmpty }
        // `errorMessage == nil`: parity with SwiftUI, whose chat-error screen takes precedence.
        // …and no input open: while the composer is focused or holds a draft the placeholder
        // steps aside (compose 03-typed shows a blank thread above the keyboard).
        let composerActive = composer.isEditing || composer.hasText || composerPhoto != nil
        let showEmpty = state.messages.isEmpty && !state.isLoading && state.errorMessage == nil
            && (args.conversationId ?? "").isEmpty && !hasEntryPayload && !composerActive
        if showEmpty && emptyState.isHidden {
            emptyState.isHidden = false
            emptyState.playAppear()
        } else if !showEmpty && !emptyState.isHidden {
            emptyState.isHidden = true
        }

        // LogoAppBar.kt: the centre logo shows only for a settled thread (`Thread && !isLoading`,
        // and not the full-screen error) — fades in 600 ms / out 300 ms (EaseOut).
        let hasAnswer = state.messages.contains { if case .aiResponse = $0 { return true }; return false }
        appBar.setLogoVisible(!state.isLoading && hasAnswer)

        // ScrollIndicator: only with no error and not loading; one timeline per answer.
        let indicatorKey = (state.errorMessage == nil && !state.isLoading) ? lastAiRowId : nil
        if indicatorKey != scrollIndicatorKey {
            scrollIndicatorKey = indicatorKey
            if indicatorKey != nil {
                scrollIndicator.trigger { [weak self] in
                    guard let self else { return false }
                    let cv = self.collectionView!
                    // Measured against the REAL content: the reserve's extra bottom inset is empty
                    // space, never "content below" (compose suppresses the indicator there too).
                    let systemBottom = cv.adjustedContentInset.bottom - cv.contentInset.bottom
                    let visibleBottom = cv.contentOffset.y + cv.bounds.height - systemBottom - Self.baseBottomInset
                    // ScrollIndicator threshold: at least two lines' worth (48pt) below the fold.
                    return cv.contentSize.height - visibleBottom >= 48
                }
            } else {
                scrollIndicator.cancel()
            }
        }

        // Auto-play a freshly synthesised clip once. Keyed on the URL: re-playing whenever the
        // state says "not playing" made Pause restart the audio immediately.
        // Clip dropped (playback finished / new answer): a later Listen may synthesise the SAME
        // URL again, which must auto-play again.
        if state.audioPlaybackUrl == nil { autoPlayedAudioUrl = nil }
        if let urlString = state.audioPlaybackUrl, urlString != autoPlayedAudioUrl,
           let url = URL(string: urlString), !state.isAudioPlaying {
            autoPlayedAudioUrl = urlString
            ttsPlayback.play(url: url, id: "tts")
            viewModel.onAction(.setAudioPlaying(true))
        }
        // A new answer owns Listen: stop the previous answer's audio and drop its clip, or the
        // new pill would show Pause (and Listen would replay the old answer).
        if let previous = audioOwnerRowId, previous != lastAiRowId, state.audioPlaybackUrl != nil || state.isAudioPlaying {
            ttsPlayback.stop()
            DispatchQueue.main.async { [weak self] in self?.viewModel.onAction(.clearAudioPlaybackUrl) }
        }
        audioOwnerRowId = lastAiRowId
    }

    // MARK: - Row mapping (2.0.0)

    /// An EXCLUSIVE alignment surface and a location card each get their own cell; everything else
    /// is a bubble.
    private func row(for message: ChatMessage) -> Row {
        if case .aiResponse(let ai) = message, let kind = ai.alignmentKind, !kind.isAdditive {
            return .alignment(message.id)
        }
        if case .location = message {
            return .location(message.id)
        }
        return .message(message.id)
    }

    /// `ChatMessage.id` of the last `.aiResponse` (NOT the last message: a trailing failed user
    /// bubble must not take "latest" away from the answer that owns the retry card).
    private func lastAiResponseRowId(in messages: [ChatMessage]) -> String? {
        for message in messages.reversed() {
            if case .aiResponse = message { return message.id }
        }
        return nil
    }

    private func lastAiIsPreGenerated() -> Bool {
        guard let id = lastAiRowId, case .aiResponse(let ai)? = messagesById[id] else { return false }
        return ai.isPreGenerated
    }

    /// App parity (ChatThreadContent.kt `onReadFullAdviceClick`): only the latest pre-generated
    /// answer with a non-blank question that has not already been expanded offers
    /// "Read full advice" — and then in place of the Share / Listen row.
    private func readFullAdviceAvailable(messageId: String) -> Bool {
        guard messageId == lastAiRowId, case .aiResponse(let ai)? = messagesById[messageId] else {
            return false
        }
        return ai.isPreGenerated
            && !(args.question ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && viewModel.state.readFullAdviceRequestedForMessageId != ai.id
    }

    /// ChatResponseActions.kt `showFollowUps = !(additive && chips non-empty)`.
    private func lastAiHasAdditiveChips() -> Bool {
        guard let id = lastAiRowId,
              case .aiResponse(let ai)? = messagesById[id],
              let kind = ai.alignmentKind, kind.isAdditive else { return false }
        return !(ai.alignmentChips ?? []).isEmpty
    }

    private func lastAiIsExclusiveSurface() -> Bool {
        guard let id = lastAiRowId,
              case .aiResponse(let ai)? = messagesById[id],
              let kind = ai.alignmentKind else { return false }
        return !kind.isAdditive
    }

    // MARK: - Capability chips (2.0.0)

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
            // Permission dialog / GPS fetch / recovery are owned by the nav controller's
            // FCUILocationPromptHost; the outcome arrives on the subscription installed in
            // viewDidLoad. Only start when no other location flow is running (mirrors Home's
            // guard). A nil nav controller means no host is mounted, so no-op — never fall back to
            // sending the chip's text, which is the defect this replaces.
            guard let manager = locationPromptManager, manager.state == .idle else { return }
            // Never start a flow whose outcome nothing is listening for: that is exactly the
            // hang this feature exists to remove, and `observeLocationOutcomes()` in
            // `viewDidLoad` no-ops if the nav controller was not resolvable yet. Idempotent, so
            // this is a cheap re-attempt rather than a second subscription.
            observeLocationOutcomes()
            guard isObservingLocationOutcomes else { return }
            pendingLocationSourceId = messageId
            manager.triggerFromLocalContext()
        case .takePhoto:
            alignmentPhotoSourceId = messageId
            alignmentPhotoChip = chip
            launchAlignmentCamera()
        case .chooseFromGallery:
            alignmentPhotoSourceId = messageId
            alignmentPhotoChip = chip
            launchPicker(sourceType: .photoLibrary)
        case .none:
            // App `SendAlignmentChip` (ChatViewModel.kt:1015-1053): `align_chip_sel` +
            // `parent_message_id` = the surface's server message_id; the chip's value marks it.
            viewModel.sendAlignmentChip(chip, kind: kind, sourceMessageId: messageId)
        }
    }

    /// The nav-controller-scoped location prompt state machine (same instance Home drives).
    private var locationPromptManager: LocationPromptManager? {
        (navigationController as? FarmerChatViewController)?.locationPrompt
    }

    /// Observes outcomes of the chat share-location flow. Subscribed for the life of the screen
    /// but inert until armed — `events` is a `PassthroughSubject`, so it multicasts to every
    /// subscriber (the nav controller and Home also listen) with no replay, which is exactly why
    /// this subscribes up front and gates on `pendingLocationSourceId`.
    ///
    /// Idempotent: `handleAlignmentChip` calls it again before starting a flow, so a nav
    /// controller that was not resolvable at `viewDidLoad` cannot leave the flow running with
    /// nothing listening for its outcome.
    private func observeLocationOutcomes() {
        guard !isObservingLocationOutcomes, let manager = locationPromptManager else { return }
        isObservingLocationOutcomes = true
        manager.events
            .receive(on: DispatchQueue.main)
            .sink { [weak self] event in self?.handleLocationOutcome(event) }
            .store(in: &cancellables)
    }

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

    /// UPLOAD_PHOTO "Take photo": camera permission first. A chip-driven flow never blocks on the
    /// settings dialog — a denial is sent as the decline query (ChatScreen.kt:665-672). No camera
    /// (simulator) keeps the library fallback below.
    private func launchAlignmentCamera() {
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
            launchPicker(sourceType: .camera)
            return
        }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            launchPicker(sourceType: .camera)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async { [weak self] in
                    if granted { self?.launchPicker(sourceType: .camera) } else { self?.photoPermissionDeclined() }
                }
            }
        default:
            photoPermissionDeclined()
        }
    }

    private func photoPermissionDeclined() {
        sendAlignmentPhotoDecline(.photoPermissionDenied)
    }

    /// App `sendAlignmentPhotoDeclineQuery` (ChatScreen.kt:469-485): an alignment-chip send of
    /// `queryText` with `photo_declined = true` and the surface's `parent_message_id`. No-op
    /// outside a chip-driven flow.
    fileprivate func sendAlignmentPhotoDecline(_ decline: CapabilityDecline) {
        guard let source = alignmentPhotoSourceId else { return }
        alignmentPhotoSourceId = nil
        viewModel.sendCapabilityDecline(decline, sourceMessageId: source)
    }

    /// A capability chip already chose the source, so this opens it directly — no photo-source
    /// sheet, no composer. Falls back to the library if the camera is unavailable (simulator).
    private func launchPicker(sourceType: UIImagePickerController.SourceType) {
        let picker = UIImagePickerController()
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(sourceType)
            ? sourceType
            : .photoLibrary
        picker.delegate = self
        present(picker, animated: true)
    }

    /// The scroll indicator's tap: to the end of the REAL content, never the bottom of the reserve
    /// (`scrollToItem(.bottom)` would honour the reserve inset and overshoot by a screen).
    private func scrollToBottom() {
        let cv = collectionView!
        let systemBottom = cv.adjustedContentInset.bottom - cv.contentInset.bottom
        let end = cv.contentSize.height + systemBottom + Self.baseBottomInset - cv.bounds.height
        cv.setContentOffset(CGPoint(x: cv.contentOffset.x, y: max(-cv.adjustedContentInset.top, end)), animated: true)
    }

    // MARK: - Reserve + pinning (port of Android core ChatReserve.kt)

    /// Id of the newest question row — a user bubble or a shared-location bubble
    /// (ChatThreadContent.kt `lastUserMessageId` / `lastLocationMessageId`). A history prepend
    /// never changes it; sending a question always does.
    private func lastQuestionRowId(in messages: [ChatMessage]) -> String? {
        for message in messages.reversed() {
            switch message {
            case .user, .location: return message.id
            default: continue
            }
        }
        return nil
    }

    /// Whether the final row holds space the way `chatScrollAnchorIndex` counts it: the answer
    /// to the newest question or the in-flight loading placeholder. The final AI row always holds
    /// it on iOS — Kotlin's `!isLoading` clause exists because there the PREVIOUS answer stays the
    /// last response while a follow-up loads; here the placeholder is appended with the question,
    /// so a final AI row is always the newest answer, including the brief finalize window where
    /// `isLoading` is still true after the stream's `metadata` swapped in the settled answer
    /// (dropping the reserve there let the list clamp and drag the pinned question down).
    /// SwiftUI `ChatView.finalRowHoldsReserve` mirrors it.
    private func finalRowHoldsSpace(in state: ChatState) -> Bool {
        switch state.messages.last {
        case .aiResponse?: return true
        case .loadingPlaceholder?: return true
        default: return false
        }
    }

    /// `chatScrollAnchorIndex` (Android core ChatReserve.kt): when the final row holds space, the
    /// row ABOVE it (the farmer's question) goes to the top; otherwise the final row itself.
    private func scrollAnchorId(in state: ChatState) -> String? {
        let messages = state.messages
        guard let last = messages.last else { return nil }
        return finalRowHoldsSpace(in: state) && messages.count > 1 ? messages[messages.count - 2].id : last.id
    }

    /// The row the reserve must keep reachable at the viewport's top, or nil when the final row
    /// holds no reserve. A failed LAST question (inline error row under it) holds it too, and is
    /// itself the anchor.
    private func reserveAnchorId(in state: ChatState) -> String? {
        guard let last = state.messages.last else { return nil }
        if finalRowHoldsSpace(in: state) { return scrollAnchorId(in: state) }
        if case .user = last, state.errorMessage != nil, !state.isLoading,
           let failed = state.failedMessageId, last.id == "user_\(failed)" {
            return last.id
        }
        return nil
    }

    private func indexPath(forMessageId id: String) -> IndexPath? {
        guard let item = dataSource.snapshot().itemIdentifiers.firstIndex(where: { $0.messageId == id }) else {
            return nil
        }
        return IndexPath(item: item, section: 0)
    }

    /// Content offset that puts `indexPath`'s row 20pt below the viewport's top: the 12pt top
    /// inset plus the row's own 8pt — ChatThreadContent.kt's `contentPadding top = 20`.
    private func pinOffset(for indexPath: IndexPath) -> CGFloat? {
        guard let attributes = collectionView.layoutAttributesForItem(at: indexPath) else { return nil }
        return attributes.frame.minY - collectionView.adjustedContentInset.top
    }

    /// The reserve. Compose / SwiftUI give the final holder a viewport of minimum height; a
    /// self-sizing list cannot size one cell to "whatever is left", and the follow-up chips here
    /// are separate rows that must stay directly under the answer — so the same space is added as
    /// bottom inset instead: just enough that the anchor row can reach the top of the viewport.
    /// It shrinks as the answer grows, so the pinned question never moves.
    private func updateReserveInset() {
        guard let cv = collectionView else { return }
        var bottom = Self.baseBottomInset
        if let id = reserveAnchorMessageId, let indexPath = indexPath(forMessageId: id),
           let target = pinOffset(for: indexPath) {
            let systemBottom = cv.adjustedContentInset.bottom - cv.contentInset.bottom
            bottom = max(bottom, target + cv.bounds.height - cv.contentSize.height - systemBottom)
        }
        if abs(cv.contentInset.bottom - bottom) > 0.5 {
            cv.contentInset.bottom = bottom
        }
    }

    private func schedulePin() {
        guard !pinScheduled else { return }
        pinScheduled = true
        // ChatThreadContent.kt:263 `delay(150) // Let layout start` — pinning on the next turn
        // ran against the half-applied snapshot (the follow-up rows still leaving), so the
        // question stayed mid-screen under the tips while its answer loaded.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
            guard let self else { return }
            self.pinScheduled = false
            self.pinTail()
        }
    }

    /// The auto-scroll (ChatThreadContent.kt `scrollToAnchorId` effect + the first history load):
    /// the anchor row's top goes 20pt below the viewport's top — never the bottom of the reserve.
    private func pinTail() {
        let state = viewModel.state
        guard let last = state.messages.last else { return }
        let isHistoryEntry = !(args.conversationId ?? "").isEmpty
        let anchorId: String
        var animated = true
        if isHistoryEntry && !historyInitialScrollDone {
            // A conversation opened from Chat History starts at its FIRST message, once (shared
            // product decision with compose/web). The load-earlier row stays just above it.
            guard state.isInitialHistoryLoaded, let first = state.messages.first else { return }
            historyInitialScrollDone = true
            historyOpenedTailId = last.id
            anchorId = first.id
            animated = false
        } else {
            // Nothing new since the history thread was opened (only older pages): stay put.
            if isHistoryEntry && last.id == historyOpenedTailId { return }
            guard let id = scrollAnchorId(in: state) else { return }
            anchorId = id
        }
        guard let indexPath = indexPath(forMessageId: anchorId) else { return }
        collectionView.layoutIfNeeded()
        if collectionView.cellForItem(at: indexPath) == nil {
            // Off-screen: its frame may still be an estimate. Realize it first so the reserve and
            // the offset are computed from its measured height.
            collectionView.scrollToItem(at: indexPath, at: .top, animated: false)
            collectionView.layoutIfNeeded()
            animated = false
        }
        // The inset must exist BEFORE the offset is set, or the pin clamps short of the top.
        updateReserveInset()
        guard let target = pinOffset(for: indexPath) else { return }
        let maxOffset = collectionView.contentSize.height + collectionView.adjustedContentInset.bottom
            - collectionView.bounds.height
        let y = max(-collectionView.adjustedContentInset.top, min(target, maxOffset))
        collectionView.setContentOffset(CGPoint(x: collectionView.contentOffset.x, y: y), animated: animated)
    }

    private func setComposerHidden(_ hidden: Bool) {
        guard hidden != composerHidden else { return }
        composerHidden = hidden
        if hidden { composer.textView.resignFirstResponder() }
        composer.isUserInteractionEnabled = !hidden
        UIView.animate(withDuration: 0.3, delay: 0, options: [.curveEaseInOut, .beginFromCurrentState]) {
            self.composer.sheet.transform = hidden ? CGAffineTransform(translationX: 0, y: 400) : .identity
        }
    }

    private func loadMoreHistory() {
        guard let next = viewModel.state.historyNextPage,
              let conversationId = args.conversationId else { return }
        viewModel.onAction(.loadChatHistory(conversationId: conversationId, page: next))
    }

    // MARK: - Actions

    /// ListenButton.kt state: `isLoading` → Loading, `isPlaying` → Playing,
    /// `hasAudioUrl && !isPlaying` → Paused, else Default.
    private var listenState: FCUIListenState {
        let state = viewModel.state
        if state.isLoadingSynthesiseAudio { return .loading }
        if state.isAudioPlaying { return .playing }
        if state.audioPlaybackUrl != nil { return .paused }
        return .idle
    }

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

    private func toggleClip(url: URL, id: String) {
        if playback.isPlaying(id: id) {
            playback.pause()
        } else if playback.isActive(id: id) {
            playback.resume()
        } else {
            playback.play(url: url, id: id)
        }
    }

    private func share(text: String) {
        FarmerChat.shared.analytics.track(AnalyticsEvents.shareResponseClicked)
        let image = FCUIShareCardRenderer.render(answer: text)
        // ChatScreen.kt:2113-2117: the card image plus the `share_app_message` caption.
        let items: [Any] = image.map { [$0, FCShareCopy.caption()] } ?? [text]
        let activity = UIActivityViewController(activityItems: items, applicationActivities: nil)
        activity.popoverPresentationController?.sourceView = view
        present(activity, animated: true)
    }

    /// Type (empty-state chip) and the alignment escape hatch focus the composer's field.
    private func typeTapped() {
        composer.focus()
    }

    private func speakTapped() {
        Task { @MainActor in
            guard await recorder.requestPermission() else {
                showToast(fcuiLabel("mic_permission_denied", "Microphone access is needed to speak your question."))
                return
            }
            let sheet = FCUIVoiceRecordingViewController(recorder: recorder) { [weak self] clip in
                self?.viewModel.onAction(.sendFollowUpVoiceQuestion(audioURL: clip.fileURL, base64Audio: clip.base64Audio))
            }
            self.present(sheet, animated: true)
        }
    }

    /// The composer's camera: the app's photo input offers Camera and Gallery
    /// (`fc_v2_app_label_camera` / `fc_v2_app_label_gallery`); the photo then waits in the
    /// composer for a caption.
    private func photoTapped() {
        let sheet = UIAlertController(title: nil, message: nil, preferredStyle: .actionSheet)
        if UIImagePickerController.isSourceTypeAvailable(.camera) {
            sheet.addAction(UIAlertAction(title: fcuiLabel(FCLabels.camera, "Camera"), style: .default) { [weak self] _ in
                self?.presentComposerPicker(.camera)
            })
        }
        sheet.addAction(UIAlertAction(title: fcuiLabel(FCLabels.gallery, "Gallery"), style: .default) { [weak self] _ in
            self?.presentComposerPicker(.photoLibrary)
        })
        sheet.addAction(UIAlertAction(title: fcuiLabel(FCLabels.cancel, "Cancel"), style: .cancel))
        sheet.popoverPresentationController?.sourceView = composer
        present(sheet, animated: true)
    }

    private func presentComposerPicker(_ source: UIImagePickerController.SourceType) {
        let picker = UIImagePickerController()
        picker.sourceType = source
        picker.delegate = self
        present(picker, animated: true)
    }
}

extension FCUIChatViewController: UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    func imagePickerController(
        _ picker: UIImagePickerController,
        didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
    ) {
        picker.dismiss(animated: true)
        let photoChip = alignmentPhotoSourceId != nil ? alignmentPhotoChip : nil
        alignmentPhotoSourceId = nil
        alignmentPhotoChip = nil
        guard let image = info[.originalImage] as? UIImage,
              let data = image.jpegData(compressionQuality: 0.8) else { return }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("fc_sdk_img_\(UUID().uuidString).jpg")
        try? data.write(to: url)
        // A library pick hands over the original file, whose EXIF carries the photo's own GPS
        // (app ImageUtils.readGpsFromImage); Core re-encodes it (1000×1000, JPEG 80, GPS EXIF).
        let original = (info[.imageURL] as? URL).flatMap { try? Data(contentsOf: $0) }
        if let photoChip {
            // An UPLOAD_PHOTO chip's photo is reported as that chip's pick (ChatScreen.kt:425-460).
            viewModel.sendAlignmentPhoto(chip: photoChip, imageData: original ?? data, imageURL: url)
        } else {
            // InputComposer flow (ChatScreen.kt:497-503 `photoUris = listOf(uri)`): the photo
            // waits in the composer for an optional caption.
            composerPhoto = (original ?? data, url)
            composer.attachment = image
            composer.focus()
        }
    }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
        // An UPLOAD_PHOTO chip's camera / gallery closed with no photo (ChatScreen.kt:524-531,
        // 576-583): keep the blocking surface moving with the default query.
        sendAlignmentPhotoDecline(.photoNotShared)
    }
}

// MARK: - Share-card renderer (UIGraphicsImageRenderer)

enum FCUIShareCardRenderer {
    static func render(answer: String) -> UIImage? {
        let width: CGFloat = 720
        let padding: CGFloat = 48
        let font = UIFont.systemFont(ofSize: 30)
        let textRect = (answer as NSString).boundingRect(
            with: CGSize(width: width - padding * 2, height: 4000),
            options: [.usesLineFragmentOrigin],
            attributes: [.font: font],
            context: nil
        )
        let height = textRect.height + padding * 2 + 100
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: height))
        return renderer.image { context in
            FCUITheme.green800.setFill()
            context.fill(CGRect(x: 0, y: 0, width: width, height: height))
            ("FarmerChat" as NSString).draw(
                at: CGPoint(x: padding, y: padding),
                withAttributes: [
                    .font: UIFont.systemFont(ofSize: 36, weight: .bold),
                    .foregroundColor: UIColor.white
                ]
            )
            (answer as NSString).draw(
                in: CGRect(x: padding, y: padding + 70, width: width - padding * 2, height: textRect.height),
                withAttributes: [.font: font, .foregroundColor: UIColor.white]
            )
        }
    }
}

extension FCUIChatViewController: UICollectionViewDelegate {
    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        collectionView.deselectItem(at: indexPath, animated: false)
        if case .loadEarlier = dataSource.itemIdentifier(for: indexPath) {
            loadMoreHistory()
        }
    }
}

// MARK: - Empty-chat placeholder (SDK addition; web chatParts.tsx `ChatEmptyState`)

/// The FarmerChat mark in a 64pt brand disc with an 8pt halo at ~12% brand, the tagline, the
/// "ask by…" hint and Photo / Speak / Type pills. Existing label keys only. Pure UIKit (iOS 15).
final class FCUIChatEmptyStateView: UIView {
    private let stack = UIStackView()
    private let pillRow = UIStackView()
    private var pills: [FCUIEmptyStatePill] = []
    private let title = UILabel()
    private let subtitle = UILabel()

    init(onPhoto: (() -> Void)?, onSpeak: (() -> Void)?, onType: @escaping () -> Void) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .clear

        let mark = Self.makeMark()

        title.numberOfLines = 0
        title.textColor = FCUITheme.foregroundPrimary
        title.textAlignment = .center
        Self.setText(title, fcuiLabel(FCLabels.farmerchatTagline, "FarmerChat: Practical advice for your crops & livestock"),
                     size: 18, lineHeight: 24, weight: .semibold)

        subtitle.numberOfLines = 0
        subtitle.textColor = FCUITheme.foregroundSecondary
        subtitle.textAlignment = .center
        Self.setText(subtitle, fcuiLabel(FCLabels.getStartedByClickingOnPhotoSpeakOrTypeToAskYourQuestion,
                                         "Tap a button to ask a question"),
                     size: 14, lineHeight: 20, weight: .regular)

        if let onPhoto {
            pills.append(FCUIEmptyStatePill(icon: "camera.fill", labelKey: FCLabels.photo, fallback: "Photo", action: onPhoto))
        }
        if let onSpeak {
            pills.append(FCUIEmptyStatePill(icon: "mic.fill", labelKey: FCLabels.speak, fallback: "Speak", action: onSpeak))
        }
        pills.append(FCUIEmptyStatePill(icon: "keyboard", labelKey: FCLabels.type, fallback: "Type", action: onType))
        pills.forEach { pillRow.addArrangedSubview($0) }
        pillRow.axis = .horizontal
        pillRow.spacing = 8
        pillRow.alignment = .center

        // 10 between items, +6 under the mark (the halo adds no layout), +10 above the pills.
        [mark, title, subtitle, pillRow].forEach { stack.addArrangedSubview($0) }
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 10
        stack.setCustomSpacing(16, after: mark)
        stack.setCustomSpacing(20, after: subtitle)
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -32),
            stack.topAnchor.constraint(greaterThanOrEqualTo: topAnchor),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: bottomAnchor),
            title.widthAnchor.constraint(lessThanOrEqualToConstant: 300),
            subtitle.widthAnchor.constraint(lessThanOrEqualToConstant: 280),
        ])
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    /// Re-resolves every label (a language Save while this chat sat under the chooser).
    func relabel() {
        Self.setText(title, fcuiLabel(FCLabels.farmerchatTagline, "FarmerChat: Practical advice for your crops & livestock"),
                     size: 18, lineHeight: 24, weight: .semibold)
        Self.setText(subtitle, fcuiLabel(FCLabels.getStartedByClickingOnPhotoSpeakOrTypeToAskYourQuestion,
                                         "Tap a button to ask a question"),
                     size: 14, lineHeight: 20, weight: .regular)
        pills.forEach { $0.relabel() }
        setNeedsLayout()
    }

    /// Taps on the empty area fall through to the list below; only the content is interactive.
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        let hit = super.hitTest(point, with: event)
        return hit === self ? nil : hit
    }

    /// The pills wrap: one row when it fits within the 32pt side padding, otherwise stacked.
    override func layoutSubviews() {
        let available = bounds.width - 64
        if available > 0 {
            let rowWidth = pills.reduce(CGFloat(0)) {
                $0 + $1.systemLayoutSizeFitting(UIView.layoutFittingCompressedSize).width
            } + CGFloat(max(0, pills.count - 1)) * pillRow.spacing
            let axis: NSLayoutConstraint.Axis = rowWidth > available ? .vertical : .horizontal
            if pillRow.axis != axis { pillRow.axis = axis }
        }
        super.layoutSubviews()
    }

    /// 360ms fade + 6pt rise; none with Reduce Motion.
    func playAppear() {
        guard !UIAccessibility.isReduceMotionEnabled else {
            alpha = 1
            transform = .identity
            return
        }
        alpha = 0
        transform = CGAffineTransform(translationX: 0, y: 6)
        UIView.animate(withDuration: 0.36, delay: 0, options: [.curveEaseOut, .allowUserInteraction]) {
            self.alpha = 1
            self.transform = .identity
        }
    }

    private static func makeMark() -> UIView {
        let size: CGFloat = 64
        let disc = UIView()
        disc.backgroundColor = FCUITheme.brandSurfacePrimary
        disc.layer.cornerRadius = size / 2
        disc.layer.shadowColor = FCUITheme.brandSurfacePrimary.cgColor
        disc.layer.shadowOpacity = 0.35
        disc.layer.shadowRadius = 10
        disc.layer.shadowOffset = CGSize(width: 0, height: 8)
        disc.isAccessibilityElement = false
        disc.translatesAutoresizingMaskIntoConstraints = false

        // 8pt halo ring at ~12% brand. Drawn behind the disc without taking layout space.
        let halo = UIView()
        halo.backgroundColor = FCUITheme.brandSurfacePrimary.withAlphaComponent(0.12)
        halo.layer.cornerRadius = size / 2 + 8
        halo.isUserInteractionEnabled = false
        halo.translatesAutoresizingMaskIntoConstraints = false

        let glyphSize: CGFloat = 34
        let glyph = CAShapeLayer()
        glyph.path = FCUILogoMark.path(size: glyphSize)
        glyph.fillColor = UIColor.white.cgColor
        glyph.frame = CGRect(x: (size - glyphSize) / 2, y: (size - glyphSize) / 2, width: glyphSize, height: glyphSize)

        let container = UIView()
        container.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(halo)
        container.addSubview(disc)
        disc.layer.addSublayer(glyph)
        NSLayoutConstraint.activate([
            container.widthAnchor.constraint(equalToConstant: size),
            container.heightAnchor.constraint(equalToConstant: size),
            disc.widthAnchor.constraint(equalToConstant: size),
            disc.heightAnchor.constraint(equalToConstant: size),
            disc.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            disc.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            halo.widthAnchor.constraint(equalToConstant: size + 16),
            halo.heightAnchor.constraint(equalToConstant: size + 16),
            halo.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            halo.centerYAnchor.constraint(equalTo: container.centerYAnchor),
        ])
        return container
    }

    /// Off-scale sizes (no type-scale slot is 18/24 semibold or 14/20): honours the host
    /// `typeScale` / `fontName` the way `FCUITextStyle` does, with an exact line box.
    static func font(size: CGFloat, weight: UIFont.Weight) -> UIFont {
        let host = FarmerChat.isInitialized ? FarmerChat.shared.config.theme : nil
        let scaled = size * (host?.typeScale ?? 1.0)
        if let name = host?.fontName, let custom = UIFont(name: name, size: scaled) {
            let descriptor = custom.fontDescriptor.addingAttributes([
                .traits: [UIFontDescriptor.TraitKey.weight: weight]
            ])
            return UIFont(descriptor: descriptor, size: scaled)
        }
        return .systemFont(ofSize: scaled, weight: weight)
    }

    private static func setText(_ label: UILabel, _ text: String, size: CGFloat, lineHeight: CGFloat, weight: UIFont.Weight) {
        let font = font(size: size, weight: weight)
        let scale = FarmerChat.isInitialized ? (FarmerChat.shared.config.theme?.typeScale ?? 1.0) : 1.0
        let paragraph = NSMutableParagraphStyle()
        paragraph.minimumLineHeight = lineHeight * scale
        paragraph.maximumLineHeight = lineHeight * scale
        paragraph.alignment = label.textAlignment
        label.font = font
        label.attributedText = NSAttributedString(string: text, attributes: [
            .font: font,
            .foregroundColor: label.textColor ?? .label,
            .paragraphStyle: paragraph,
        ])
    }
}

/// 40pt fully-rounded pill: 1pt default border, surface fill, 14pt semibold label, leading 28pt
/// circle at ~12% brand holding a 20pt brand-green icon.
final class FCUIEmptyStatePill: UIControl {
    private let action: () -> Void
    private let labelKey: String
    private let fallback: String
    private let label = UILabel()

    init(icon: String, labelKey: String, fallback: String, action: @escaping () -> Void) {
        self.action = action
        self.labelKey = labelKey
        self.fallback = fallback
        let title = fcuiLabel(labelKey, fallback)
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = FCUITheme.surfacePrimary
        layer.cornerRadius = 20
        layer.borderWidth = 1
        layer.borderColor = FCUITheme.borderDefault.resolvedColor(with: traitCollection).cgColor
        accessibilityLabel = title
        accessibilityTraits = .button
        isAccessibilityElement = true

        let iconCircle = UIView()
        iconCircle.backgroundColor = FCUITheme.brandSurfacePrimary.withAlphaComponent(0.12)
        iconCircle.layer.cornerRadius = 14
        iconCircle.isUserInteractionEnabled = false
        iconCircle.translatesAutoresizingMaskIntoConstraints = false
        let image = UIImageView(image: UIImage(
            systemName: icon,
            withConfiguration: UIImage.SymbolConfiguration(pointSize: 16, weight: .semibold)
        ))
        image.tintColor = FCUITheme.brandSurfacePrimary
        image.contentMode = .center
        image.translatesAutoresizingMaskIntoConstraints = false
        iconCircle.addSubview(image)

        label.text = title
        label.font = FCUIChatEmptyStateView.font(size: 14, weight: .semibold)
        label.textColor = FCUITheme.foregroundPrimary
        label.isUserInteractionEnabled = false
        label.translatesAutoresizingMaskIntoConstraints = false

        addSubview(iconCircle)
        addSubview(label)
        NSLayoutConstraint.activate([
            heightAnchor.constraint(equalToConstant: 40),
            iconCircle.widthAnchor.constraint(equalToConstant: 28),
            iconCircle.heightAnchor.constraint(equalToConstant: 28),
            iconCircle.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            iconCircle.centerYAnchor.constraint(equalTo: centerYAnchor),
            image.widthAnchor.constraint(equalToConstant: 20),
            image.heightAnchor.constraint(equalToConstant: 20),
            image.centerXAnchor.constraint(equalTo: iconCircle.centerXAnchor),
            image.centerYAnchor.constraint(equalTo: iconCircle.centerYAnchor),
            label.leadingAnchor.constraint(equalTo: iconCircle.trailingAnchor, constant: 6),
            label.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -14),
            label.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
        addAction(UIAction { [weak self] _ in self?.action() }, for: .touchUpInside)
    }

    func relabel() {
        label.text = fcuiLabel(labelKey, fallback)
        accessibilityLabel = label.text
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override var isHighlighted: Bool {
        didSet { alpha = isHighlighted ? 0.6 : 1 }
    }

    /// `layer.borderColor` is a CGColor and does not follow light/dark on its own.
    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        layer.borderColor = FCUITheme.borderDefault.resolvedColor(with: traitCollection).cgColor
    }
}
#endif
