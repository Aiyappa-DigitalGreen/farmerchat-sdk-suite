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
        case message(String) // ChatMessage.id
        case followUp(String)
        case inlineError(String)
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
        if args.source == "history" {
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
                playback: self.playback
            )
            cell.onRetry = { self.viewModel.onAction(.retryLastRequest) }
            cell.onListen = { self.listenTapped() }
            cell.onShare = { text in self.share(text: text) }
            cell.onPlayClip = { url, id in self.toggleClip(url: url, id: id) }
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

        dataSource = UICollectionViewDiffableDataSource<Int, Row>(collectionView: collectionView) { collectionView, indexPath, row in
            switch row {
            case .message(let id):
                return collectionView.dequeueConfiguredReusableCell(using: bubbleCell, for: indexPath, item: id)
            case .followUp(let question):
                return collectionView.dequeueConfiguredReusableCell(using: chipCell, for: indexPath, item: question)
            case .inlineError(let message):
                return collectionView.dequeueConfiguredReusableCell(using: errorCell, for: indexPath, item: message)
            }
        }
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

        askButton.setTitle(fcuiLabel("ask_follow_up", "Ask a follow-up question"), for: .normal)
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
        var snapshot = NSDiffableDataSourceSnapshot<Int, Row>()
        snapshot.appendSections([0])
        snapshot.appendItems(state.messages.map { .message($0.id) })
        if let errorMessage = state.errorMessage, !state.messages.isEmpty {
            snapshot.appendItems([.inlineError(errorMessage)])
        }
        if let suggestions = state.suggestedQuestions, !suggestions.isEmpty, !state.isLoading {
            snapshot.appendItems(suggestions.map { .followUp($0) })
        }
        dataSource.apply(snapshot, animatingDifferences: true) { [weak self] in
            self?.scrollToBottom()
        }

        inputBar.alpha = state.isLoading ? 0.5 : 1
        inputBar.isUserInteractionEnabled = !state.isLoading

        if let urlString = state.audioPlaybackUrl, let url = URL(string: urlString), !state.isAudioPlaying {
            ttsPlayback.play(url: url, id: "tts")
            viewModel.onAction(.setAudioPlaying(true))
        }
    }

    private func scrollToBottom() {
        let count = collectionView.numberOfItems(inSection: 0)
        guard count > 0 else { return }
        collectionView.scrollToItem(at: IndexPath(item: count - 1, section: 0), at: .bottom, animated: true)
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
            title: fcuiLabel("ask_follow_up", "Ask a follow-up question"),
            message: nil,
            preferredStyle: .alert
        )
        alert.addTextField()
        alert.addAction(UIAlertAction(title: fcuiLabel("send", "Send"), style: .default) { [weak self, weak alert] _ in
            guard let question = alert?.textFields?.first?.text?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !question.isEmpty else { return }
            self?.viewModel.onAction(.sendFollowUpQuestion(
                question: question, followUpQuestionId: nil, transcriptionId: nil, audioURL: nil
            ))
        })
        alert.addAction(UIAlertAction(title: fcuiLabel("cancel", "Cancel"), style: .cancel))
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
#endif
