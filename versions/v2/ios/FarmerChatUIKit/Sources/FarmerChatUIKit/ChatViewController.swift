#if canImport(UIKit)
import UIKit
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
        case followUp(String)
        case inlineError(String)

        var messageId: String? {
            switch self {
            case .message(let id), .alignment(let id), .location(let id): return id
            case .loadEarlier, .followUp, .inlineError: return nil
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
    private let inputBar = UIStackView()
    private let askButton = UIButton(type: .system)
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
    private var prevLastAiRowId: String?
    /// `ChatMessage.id` of the last `.aiResponse` — SwiftUI's `lastAiMessage` predicate. Gates the
    /// stream error card's retry and an alignment surface's escape hatch.
    private var lastAiRowId: String?
    /// Armed while a chat-initiated location flow is in progress; holds the raw `AiResponse.id` of
    /// the GPS_PROMPT surface whose chip started it (2.0.0). Nil leaves the outcome subscription
    /// inert, so an outcome belonging to Home or a widget trigger is ignored.
    private var pendingLocationSourceId: String?
    /// True once the location-outcome subscription is installed. Guards the share-location chip
    /// from starting a flow nothing is listening to (see `observeLocationOutcomes`).
    private var isObservingLocationOutcomes = false

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
        navigationController?.setNavigationBarHidden(false, animated: false)
        title = "FarmerChat"
        navigationItem.hidesBackButton = true
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            image: UIImage(systemName: args.source == "history" ? "chevron.left" : "xmark"),
            primaryAction: UIAction { [weak self] _ in self?.close() }
        )

        buildCollectionView()
        buildInputBar()

        viewModel.$state
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in self?.render(state) }
            .store(in: &cancellables)

        observeLocationOutcomes()
        initialize()
        FarmerChat.shared.analytics.screenViewed(ScreenNames.chat, extra: ["source": args.source])
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

    private func close() {
        if args.source == "chatOnly" {
            // CHAT_ONLY has no SDK Home — exit the SDK back to the host.
            (navigationController ?? self).presentingViewController?.dismiss(animated: true)
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
        view.addSubview(collectionView)

        let bubbleCell = UICollectionView.CellRegistration<FCUIChatBubbleCell, String> { [weak self] cell, _, messageId in
            guard let self, let message = self.messagesById[messageId] else { return }
            cell.configure(
                message: message,
                isTtsEnabled: self.viewModel.state.isTtsEnabled,
                playback: self.playback,
                isLatest: messageId == self.lastAiRowId,
                isBusy: self.viewModel.state.isLoading
            )
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
                isBusy: self.viewModel.state.isLoading
            )
            cell.onChipTap = { [weak self] chip in
                self?.handleAlignmentChip(messageId: ai.id, kind: ai.alignmentKind, chip: chip)
            }
            // The UIKit flavour's text input is a prompt sheet (there is no always-visible field
            // to focus), so the escape hatch opens it — the same affordance the input bar uses.
            cell.onTypeInstead = { [weak self] in self?.typeTapped() }
        }
        // 2.0.0: the farmer's shared location, standing in for the text bubble they never typed.
        let locationCell = UICollectionView.CellRegistration<FCUILocationBubbleCell, String> { [weak self] cell, _, messageId in
            guard let self, case .location(let location)? = self.messagesById[messageId] else { return }
            cell.configure(message: location)
        }
        let chipCell = UICollectionView.CellRegistration<FCUIFollowUpChipCell, String> { [weak self] cell, _, question in
            cell.configure(question: question)
            cell.onTap = {
                self?.viewModel.onAction(.sendFollowUpQuestion(
                    question: question, followUpQuestionId: question, transcriptionId: nil, audioURL: nil
                ))
            }
        }
        let errorCell = UICollectionView.CellRegistration<FCUIInlineErrorCell, String> { [weak self] cell, _, message in
            cell.configure(message: message)
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
            case .followUp(let question):
                return collectionView.dequeueConfiguredReusableCell(using: chipCell, for: indexPath, item: question)
            case .inlineError(let message):
                return collectionView.dequeueConfiguredReusableCell(using: errorCell, for: indexPath, item: message)
            }
        }
        collectionView.delegate = self
    }

    private func buildInputBar() {
        inputBar.axis = .horizontal
        inputBar.spacing = 10
        inputBar.isLayoutMarginsRelativeArrangement = true
        inputBar.layoutMargins = UIEdgeInsets(top: 10, left: 16, bottom: 10, right: 16)
        inputBar.translatesAutoresizingMaskIntoConstraints = false
        inputBar.backgroundColor = FCUITheme.surfaceReadingPrimary

        if FarmerChat.shared.config.enableImages {
            inputBar.addArrangedSubview(circleButton(icon: "camera.fill") { [weak self] in self?.photoTapped() })
        }
        if FarmerChat.shared.config.enableVoice {
            inputBar.addArrangedSubview(circleButton(icon: "mic.fill") { [weak self] in self?.speakTapped() })
        }

        askButton.setTitle(fcuiLabel(FCLabels.askAFollowupQuestions, "Ask a follow-up question 👇"), for: .normal)
        askButton.setTitleColor(FCUITheme.formPlaceholder, for: .normal)
        askButton.contentHorizontalAlignment = .leading
        askButton.backgroundColor = FCUITheme.surfaceReadingSecondary
        askButton.layer.cornerRadius = 23
        askButton.contentEdgeInsets = UIEdgeInsets(top: 0, left: 16, bottom: 0, right: 16)
        askButton.heightAnchor.constraint(equalToConstant: 46).isActive = true
        askButton.addAction(UIAction { [weak self] _ in self?.typeTapped() }, for: .touchUpInside)
        inputBar.addArrangedSubview(askButton)

        view.addSubview(inputBar)
        NSLayoutConstraint.activate([
            collectionView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            collectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            collectionView.bottomAnchor.constraint(equalTo: inputBar.topAnchor),
            inputBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            inputBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            inputBar.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor)
        ])
    }

    private func circleButton(icon: String, action: @escaping () -> Void) -> UIButton {
        let button = UIButton(type: .system)
        button.setImage(UIImage(systemName: icon), for: .normal)
        button.tintColor = .white
        button.backgroundColor = FCUITheme.buttonPrimarySurface
        button.layer.cornerRadius = 23
        button.heightAnchor.constraint(equalToConstant: 46).isActive = true
        button.widthAnchor.constraint(equalToConstant: 46).isActive = true
        button.addAction(UIAction { _ in action() }, for: .touchUpInside)
        return button
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
        let isNewBottom = newLastId != prevLastMessageId
        let beforeOffsetY = collectionView.contentOffset.y
        let beforeHeight = collectionView.contentSize.height

        var rows: [Row] = []
        // Load-earlier affordance pinned to the top of the thread.
        if state.historyNextPage != nil {
            rows.append(.loadEarlier)
        }
        rows.append(contentsOf: state.messages.map(row(for:)))
        if let errorMessage = state.errorMessage, !state.messages.isEmpty {
            rows.append(.inlineError(errorMessage))
        }
        // 2.0.0: an EXCLUSIVE alignment surface owns the message area — it replaces the answer,
        // its action row AND its related-questions section. (SwiftUI gets the same result by
        // never marking such a surface "revealed", which gates its follow-up section.)
        if let suggestions = state.suggestedQuestions, !suggestions.isEmpty, !state.isLoading,
           !lastAiIsExclusiveSurface() {
            rows.append(contentsOf: suggestions.map { Row.followUp($0) })
        }

        var snapshot = NSDiffableDataSourceSnapshot<Int, Row>()
        snapshot.appendSections([0])
        snapshot.appendItems(rows)

        // Content-only changes (a streamed delta, a tool status, a follow-up backfill, a user
        // bubble marked failed) keep the same row identifiers, so ask for an in-place reconfigure
        // of exactly those rows. `isLatest`/`isBusy` are render inputs too, so a change in either
        // reconfigures every surviving message row.
        let flagsChanged = state.isLoading != prevIsLoading || lastAiRowId != prevLastAiRowId
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
            } else if isNewBottom {
                self.scrollToBottom()
            }
        }
        prevMessageCount = newCount
        prevLastMessageId = newLastId
        prevRows = rows
        prevMessagesById = messagesById
        prevIsLoading = state.isLoading
        prevLastAiRowId = lastAiRowId

        inputBar.alpha = state.isLoading ? 0.5 : 1
        inputBar.isUserInteractionEnabled = !state.isLoading

        if let urlString = state.audioPlaybackUrl, let url = URL(string: urlString), !state.isAudioPlaying {
            ttsPlayback.play(url: url, id: "tts")
            viewModel.onAction(.setAudioPlaying(true))
        }
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
            launchPicker(sourceType: .camera)
        case .chooseFromGallery:
            launchPicker(sourceType: .photoLibrary)
        case .none:
            sendAlignmentChip(chip, kind: kind)
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
            // Denied / cancelled / fetch failed: still answer the blocking question, by sending the
            // decline text as an ordinary follow-up. The app sends this through `SendAlignmentChip`
            // with `locationDeclined` + parent_message_id; the SDK has neither, so the correlation
            // and the chip analytics are lost (docs/04).
            viewModel.onAction(.sendFollowUpQuestion(
                question: fcuiLabel(
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

    /// A non-capability alignment chip sends the chip's `value` (falling back to its label) as a
    /// follow-up — the same action a related-question tap uses, exactly as SwiftUI and Compose do.
    private func sendAlignmentChip(_ chip: AlignmentChip, kind: AlignmentKind?) {
        let question = chip.submittedQuery(for: kind)
        guard !question.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        viewModel.onAction(.sendFollowUpQuestion(
            question: question,
            followUpQuestionId: nil,
            transcriptionId: nil,
            audioURL: nil
        ))
    }

    private func scrollToBottom() {
        let count = collectionView.numberOfItems(inSection: 0)
        guard count > 0 else { return }
        collectionView.scrollToItem(at: IndexPath(item: count - 1, section: 0), at: .bottom, animated: true)
    }

    private func loadMoreHistory() {
        guard let next = viewModel.state.historyNextPage,
              let conversationId = args.conversationId else { return }
        viewModel.onAction(.loadChatHistory(conversationId: conversationId, page: next))
    }

    // MARK: - Actions

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
        let activity = UIActivityViewController(activityItems: [image ?? text], applicationActivities: nil)
        activity.popoverPresentationController?.sourceView = view
        present(activity, animated: true)
    }

    private func typeTapped() {
        let alert = UIAlertController(
            title: fcuiLabel(FCLabels.askAFollowupQuestions, "Ask a follow-up question 👇"),
            message: nil,
            preferredStyle: .alert
        )
        alert.addTextField()
        alert.addAction(UIAlertAction(title: fcuiLabel(FCLabels.send, "Send"), style: .default) { [weak self, weak alert] _ in
            guard let question = alert?.textFields?.first?.text?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !question.isEmpty else { return }
            self?.viewModel.onAction(.sendFollowUpQuestion(
                question: question, followUpQuestionId: nil, transcriptionId: nil, audioURL: nil
            ))
        })
        alert.addAction(UIAlertAction(title: fcuiLabel(FCLabels.cancel, "Cancel"), style: .cancel))
        present(alert, animated: true)
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

    private func photoTapped() {
        let picker = UIImagePickerController()
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
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
        guard let image = info[.originalImage] as? UIImage,
              let data = image.jpegData(compressionQuality: 0.8) else { return }
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("fc_sdk_img_\(UUID().uuidString).jpg")
        try? data.write(to: url)
        viewModel.onAction(.sendQuestionWithImage(question: "", imageData: data, imageURL: url))
    }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
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
#endif
