#if canImport(UIKit)
import UIKit
import Combine
import FarmerChatCore

/// Native UIKit Home: UICollectionView compositional layout — greeting,
/// pinned Photo/Speak/Type header, feed cards (content/single/multi-select),
/// footer. Weather chip in the nav bar; text/voice inputs route into Chat.
final class FCUIHomeViewController: UIViewController {
    private enum Item: Hashable {
        case greeting(String)
        case ssfr
        case section(String) // SectionDto.id — resolved via lookup
    }

    private let viewModel = HomeViewModel()
    private let recorder = AudioRecorderService()
    private var cancellables = Set<AnyCancellable>()
    private var collectionView: UICollectionView!
    private var dataSource: UICollectionViewDiffableDataSource<Int, Item>!
    private var sectionsById: [String: SectionDto] = [:]
    private let spinner = UIActivityIndicatorView(style: .large)
    private let errorStack = UIStackView()
    private var didLoad = false
    private var lastClip: RecordedClip?
    private var didBindLocation = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = FCUITheme.surfacePrimary
        navigationController?.setNavigationBarHidden(false, animated: false)
        navigationItem.hidesBackButton = true
        title = "FarmerChat"

        // C3: hamburger only when the drawer is enabled.
        if FarmerChat.shared.config.showDrawer {
            navigationItem.leftBarButtonItem = UIBarButtonItem(
                image: UIImage(systemName: "line.3.horizontal"),
                primaryAction: UIAction { [weak self] _ in self?.openMenu() }
            )
        }
        if FarmerChat.shared.config.enableWeather {
            navigationItem.rightBarButtonItem = UIBarButtonItem(
                image: UIImage(systemName: "cloud.sun"),
                primaryAction: UIAction { [weak self] _ in self?.weatherTapped() }
            )
        }

        buildCollectionView()
        buildErrorView()
        spinner.hidesWhenStopped = true
        spinner.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(spinner)
        NSLayoutConstraint.activate([
            spinner.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])

        viewModel.$state
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in self?.render(state) }
            .store(in: &cancellables)

        initialLoad()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        bindLocationPrompt()
    }

    /// App HomeScreen.kt location wiring, bound once the nav controller is reachable.
    private func bindLocationPrompt() {
        guard !didBindLocation, let nav = navigationController as? FarmerChatViewController else { return }
        didBindLocation = true
        let prompt = nav.locationPrompt

        prompt.$state
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                guard let self else { return }
                // Campaign-only "Getting your location" spinner (app `isWidgetGpsLoading`).
                self.render(self.viewModel.state)
                // A location Error while Home is the visible screen → shared Error screen, flow
                // closed silently (app HomeScreen.kt:256-266). Gated on Home being on top: it
                // stays alive under Chat, where the chat chip's errors belong to the global host.
                guard case .error(let type) = state, self.isVisibleTopScreen else { return }
                self.presentError(isNetworkError: type == .noNetwork, fromScreen: "home")
                prompt.dismiss(emitContinue: false)
            }
            .store(in: &cancellables)

        // Reload feed AND weather on a Campaign update or a LocalContext success
        // (app HomeScreen.kt:282-298) — never on a dismiss/deny.
        prompt.events
            .receive(on: DispatchQueue.main)
            .sink { [weak self] event in
                guard event == .locationUpdatedFromWidget || event == .locationSaved(source: .localContext) else { return }
                let userId = FarmerChat.shared.session.userId
                self?.viewModel.onAction(.loadHome(
                    userDeviceTime: HomeViewModel.currentDeviceTime(),
                    userId: userId,
                    skipLoadingCheck: true
                ))
                self?.viewModel.onAction(.loadWeather(userId: userId, skipLoadingCheck: true))
            }
            .store(in: &cancellables)
    }

    private var isVisibleTopScreen: Bool {
        navigationController?.topViewController === self
            && navigationController?.presentedViewController == nil
    }

    private func presentError(isNetworkError: Bool, fromScreen: String) {
        guard let nav = navigationController, !(nav.presentedViewController is FCUIErrorViewController) else { return }
        // The error VC dismisses itself on "Try again", which lands back on Home (the app's
        // `fromScreen` "home" / "home_weather" retry in place); `fromScreen` is kept for parity
        // with the SwiftUI route, which carries it on the destination.
        _ = fromScreen
        nav.present(FCUIErrorViewController(isNetworkError: isNetworkError) {}, animated: true)
    }

    private func initialLoad() {
        guard !didLoad else { return }
        didLoad = true
        let env = FarmerChat.shared
        env.analytics.screenViewed(ScreenNames.home)
        if let userId = env.session.userId {
            viewModel.onAction(.newConversation(userId: userId, contentProviderId: nil))
            viewModel.onAction(.fetchUserProfile(userId: userId))
        }
        viewModel.onAction(.loadHome(
            userDeviceTime: HomeViewModel.currentDeviceTime(),
            userId: env.session.userId,
            skipLoadingCheck: false
        ))
        viewModel.onAction(.loadWeather(userId: env.session.userId, skipLoadingCheck: false))
    }

    // MARK: - Layout

    private func buildCollectionView() {
        let layout = UICollectionViewCompositionalLayout { [weak self] sectionIndex, _ in
            let itemSize = NSCollectionLayoutSize(widthDimension: .fractionalWidth(1), heightDimension: .estimated(120))
            let item = NSCollectionLayoutItem(layoutSize: itemSize)
            let group = NSCollectionLayoutGroup.vertical(layoutSize: itemSize, subitems: [item])
            let section = NSCollectionLayoutSection(group: group)
            section.interGroupSpacing = 14
            section.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: 16, bottom: 16, trailing: 16)
            if sectionIndex == 1, let self, !self.sectionsById.isEmpty || true {
                // Pinned input-buttons header over the feed section.
                let headerSize = NSCollectionLayoutSize(widthDimension: .fractionalWidth(1), heightDimension: .absolute(90))
                let header = NSCollectionLayoutBoundarySupplementaryItem(
                    layoutSize: headerSize,
                    elementKind: UICollectionView.elementKindSectionHeader,
                    alignment: .top
                )
                header.pinToVisibleBounds = true
                section.boundarySupplementaryItems = [header]
            }
            return section
        }

        collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collectionView.backgroundColor = .clear
        collectionView.delegate = self
        collectionView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(collectionView)
        NSLayoutConstraint.activate([
            collectionView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            collectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            collectionView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        let greetingCell = UICollectionView.CellRegistration<FCUIGreetingCell, String> { cell, _, greeting in
            cell.configure(text: greeting)
        }
        let cardCell = UICollectionView.CellRegistration<FCUIFeedCardCell, SectionDto> { [weak self] cell, _, section in
            cell.configure(section: section)
            cell.onTap = { self?.cardTapped(section) }
            cell.onDismiss = { self?.viewModel.dismissCard(sectionId: section.id) }
            cell.onOptionSubmit = { options in self?.submitOptions(section: section, options: options) }
        }
        let ssfrCell = UICollectionView.CellRegistration<FCUISsfrCell, Int> { [weak self] cell, _, _ in
            cell.onCropSelected = { crop in self?.ssfrCropSelected(crop) }
        }
        dataSource = UICollectionViewDiffableDataSource<Int, Item>(collectionView: collectionView) { [weak self] collectionView, indexPath, item in
            switch item {
            case .greeting(let text):
                return collectionView.dequeueConfiguredReusableCell(using: greetingCell, for: indexPath, item: text)
            case .ssfr:
                return collectionView.dequeueConfiguredReusableCell(using: ssfrCell, for: indexPath, item: 0)
            case .section(let id):
                guard let section = self?.sectionsById[id] else {
                    return collectionView.dequeueConfiguredReusableCell(using: greetingCell, for: indexPath, item: "")
                }
                return collectionView.dequeueConfiguredReusableCell(using: cardCell, for: indexPath, item: section)
            }
        }

        let headerRegistration = UICollectionView.SupplementaryRegistration<FCUIInputButtonsHeader>(
            elementKind: UICollectionView.elementKindSectionHeader
        ) { [weak self] header, _, _ in
            header.onPhoto = { self?.photoTapped() }
            header.onSpeak = { self?.speakTapped() }
            header.onType = { self?.typeTapped() }
        }
        dataSource.supplementaryViewProvider = { collectionView, kind, indexPath in
            collectionView.dequeueConfiguredReusableSupplementary(using: headerRegistration, for: indexPath)
        }
    }

    private func buildErrorView() {
        errorStack.axis = .vertical
        errorStack.spacing = 14
        errorStack.alignment = .center
        errorStack.isHidden = true
        errorStack.translatesAutoresizingMaskIntoConstraints = false

        let label = UILabel()
        label.tag = 1
        label.font = FCUITypography.current.bodyLarge.font
        label.textColor = FCUITheme.foregroundSecondary
        label.textAlignment = .center
        label.numberOfLines = 0

        let retry = UIButton(type: .system)
        retry.setTitle(fcuiLabel(FCLabels.tryAgain, "Try again"), for: .normal)
        retry.setTitleColor(.white, for: .normal)
        retry.backgroundColor = FCUITheme.buttonPrimarySurface
        retry.layer.cornerRadius = 22
        retry.contentEdgeInsets = UIEdgeInsets(top: 10, left: 28, bottom: 10, right: 28)
        retry.addAction(UIAction { [weak self] _ in
            FarmerChat.shared.analytics.track(AnalyticsEvents.contentTryAgainClicked)
            self?.viewModel.onAction(.loadHome(
                userDeviceTime: HomeViewModel.currentDeviceTime(),
                userId: FarmerChat.shared.session.userId,
                skipLoadingCheck: true
            ))
        }, for: .touchUpInside)

        errorStack.addArrangedSubview(label)
        errorStack.addArrangedSubview(retry)
        view.addSubview(errorStack)
        NSLayoutConstraint.activate([
            errorStack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            errorStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 32),
            errorStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -32)
        ])
    }

    // MARK: - Rendering

    private func render(_ state: HomeState) {
        let campaignGpsLoading = (navigationController as? FarmerChatViewController)?
            .locationPrompt.isCampaignLocationLoading ?? false
        if campaignGpsLoading {
            // App `isWidgetGpsLoading`: only a CAMPAIGN flow replaces the feed with the spinner.
            spinner.startAnimating()
            errorStack.isHidden = true
            collectionView.isHidden = true
        } else {
        switch state.homeFeedState {
        case .idle, .loading:
            spinner.startAnimating()
            errorStack.isHidden = true
            collectionView.isHidden = true
        case .error(let message, _, _):
            spinner.stopAnimating()
            collectionView.isHidden = true
            errorStack.isHidden = false
            (errorStack.viewWithTag(1) as? UILabel)?.text = message
        case .success(let feed):
            spinner.stopAnimating()
            errorStack.isHidden = true
            collectionView.isHidden = false
            applySnapshot(feed, state: state)
        }
        }

        if let weather = state.weatherState.value, let temp = weather.currentTemp, !temp.isEmpty {
            navigationItem.rightBarButtonItem?.title = "\(temp)°"
        }

        if case .success(let voice) = state.voiceTranscribeState {
            viewModel.onAction(.clearTranscriptionState)
            if voice.isAcceptable, let question = voice.heardInputQuery {
                openChat(FCUIChatArgs(
                    question: question,
                    transcriptionId: voice.transcriptionId?.stringValue,
                    audioPath: lastClip?.fileURL.path
                ))
                lastClip = nil
            } else {
                showToast(fcuiLabel("transcription_failed", "We couldn't hear that. Please try again."))
            }
        }
        if case .error(let message, _, _) = state.voiceTranscribeState {
            viewModel.onAction(.clearTranscriptionState)
            showToast(message)
        }
    }

    private func applySnapshot(_ feed: HomeUdfResponse, state: HomeState) {
        var snapshot = NSDiffableDataSourceSnapshot<Int, Item>()
        snapshot.appendSections([0, 1])
        let name = FarmerChat.shared.prefs.string(.userName) ?? ""
        let greeting = feed.greeting.map { LabelManager.applyTemplate($0, params: ["name": name]) }
            ?? fcuiLabel("home_greeting", "Hello!")
        snapshot.appendItems([.greeting(greeting)], toSection: 0)
        // C3 + feed flag: SSFR card above the feed cards.
        if feed.ssfrEnable == true && FarmerChat.shared.config.enableSsfr {
            snapshot.appendItems([.ssfr], toSection: 1)
        }
        sectionsById = Dictionary(uniqueKeysWithValues: state.visibleSections().map { ($0.id, $0) })
        snapshot.appendItems(state.visibleSections().map { .section($0.id) }, toSection: 1)
        dataSource.apply(snapshot, animatingDifferences: true)
    }

    // MARK: - Actions

    private func openMenu() {
        FarmerChat.shared.analytics.track(AnalyticsEvents.hamburgerMenuClicked)
        // Real slide-in drawer (recent-8 + nav), app parity.
        (navigationController as? FarmerChatViewController)?.openDrawer(currentRoute: "home")
    }

    private func weatherTapped() {
        let question = fcuiLabel(FCLabels.whatIsThePresentWeather, "What is the present weather?")
        guard let nav = navigationController as? FarmerChatViewController else {
            FarmerChat.shared.analytics.track(AnalyticsEvents.weatherClicked)
            openChat(FCUIChatArgs(question: question, isWeatherAdviceCTA: true))
            return
        }
        // App HomeScreen.kt:545-575 order: offline → No Internet error (home_weather); ignore while
        // the feed is loading; track; ignore while a location flow is already running.
        if !nav.locationPrompt.isOnline {
            presentError(isNetworkError: true, fromScreen: "home_weather")
            return
        }
        if viewModel.state.homeFeedState.isLoading { return }
        FarmerChat.shared.analytics.track(AnalyticsEvents.weatherClicked)
        guard nav.locationPrompt.state == .idle else { return }
        // Route through the LocationPromptManager, then open Chat (app parity).
        if nav.locationPrompt.isLocationKnown {
            openChat(FCUIChatArgs(question: question, isWeatherAdviceCTA: true))
        } else {
            nav.locationPrompt.triggerFromWeather { [weak self] in
                self?.openChat(FCUIChatArgs(question: question, isWeatherAdviceCTA: true))
            }
        }
    }

    private func typeTapped() {
        let alert = UIAlertController(
            title: fcuiLabel(FCLabels.type, "Type"),
            message: fcuiLabel("type_placeholder", "Ask anything about your farm"),
            preferredStyle: .alert
        )
        alert.addTextField()
        alert.addAction(UIAlertAction(title: fcuiLabel(FCLabels.send, "Send"), style: .default) { [weak self, weak alert] _ in
            guard let question = alert?.textFields?.first?.text?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !question.isEmpty else { return }
            self?.openChat(FCUIChatArgs(question: question))
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
                guard let self else { return }
                self.lastClip = clip
                if let conversationId = self.viewModel.conversationId {
                    self.viewModel.onAction(.transcribeAudio(
                        conversationId: conversationId,
                        base64Query: clip.base64Audio,
                        messageReferenceId: UUID().uuidString,
                        audioFormat: AudioRecorderService.audioFormatField,
                        triggeredType: "voice"
                    ))
                } else {
                    self.openChat(FCUIChatArgs(question: "", audioPath: clip.fileURL.path))
                }
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

    private func cardTapped(_ section: SectionDto) {
        guard let statementId = section.statementId else {
            if let question = section.questionText ?? section.title {
                openChat(FCUIChatArgs(question: question))
            }
            return
        }
        FarmerChat.shared.analytics.track(AnalyticsEvents.cardClicked, props: ["statement_id": statementId.stringValue])
        // App parity (HomeScreen.kt:580-584): content-card tap sends image_card / text_card by type.
        let triggerType: String
        switch section.type?.lowercased() {
        case "image": triggerType = "image_card"
        case "statement": triggerType = "text_card"
        default: triggerType = "card"
        }
        Task { @MainActor in
            let result = await FarmerChat.shared.api.imageStatement(
                ImageStatementRequest(statementId: statementId, triggeredInputType: triggerType)
            )
            if case .success(let response) = result {
                self.openChat(FCUIChatArgs(
                    question: section.questionText ?? section.title ?? "",
                    homeStatementId: response.messageId?.stringValue ?? statementId.stringValue,
                    preGeneratedAnswer: response.shortAnswer,
                    followUpQuestions: response.followUpQuestions ?? []
                ))
            } else {
                self.showToast(fcuiLabel(FCLabels.somethingWentWrongPleaseTryAgain, "Something went wrong. Please try again."))
            }
        }
    }

    private func submitOptions(section: SectionDto, options: [SectionOption]) {
        guard let userId = FarmerChat.shared.session.userId else { return }
        if section.selectionType == "single" || section.type == "single_select" {
            Task { @MainActor in
                _ = await FarmerChat.shared.api.updateUserProfile(
                    UserNameRequest(userId: userId, gender: options.first?.text)
                )
                self.viewModel.dismissCard(sectionId: section.id)
                self.showToast(fcuiLabel("profile_saved", "Saved!"))
            }
        } else {
            let cropIds = options.compactMap { $0.rawId?.intValue }
            viewModel.onAction(.updateCultivatedCrops(userId: userId, cropIds: cropIds))
            viewModel.dismissCard(sectionId: section.id)
            showToast(fcuiLabel("profile_saved", "Saved!"))
        }
    }

    private func ssfrCropSelected(_ crop: String) {
        openChat(FCUIChatArgs(
            question: fcuiLabel("ssfr_question", "Fertilizer advice for {crop}", params: ["crop": crop]),
            isSSFR: true,
            ssfrCrop: crop
        ))
    }

    private func openChat(_ args: FCUIChatArgs) {
        navigationController?.pushViewController(FCUIChatViewController(args: args), animated: true)
    }
}

extension FCUIHomeViewController: UICollectionViewDelegate {
    func collectionView(
        _ collectionView: UICollectionView,
        willDisplay cell: UICollectionViewCell,
        forItemAt indexPath: IndexPath
    ) {
        // Mark card viewed (endpoint #25) when it becomes visible.
        guard let item = dataSource.itemIdentifier(for: indexPath),
              case .section(let id) = item,
              let section = sectionsById[id],
              section.isViewed != true,
              let statementId = section.statementId,
              let userId = FarmerChat.shared.session.userId else { return }
        viewModel.onAction(.markImageViewed(statementId: statementId, userId: userId))
    }
}

extension FCUIHomeViewController: UIImagePickerControllerDelegate, UINavigationControllerDelegate {
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
        openChat(FCUIChatArgs(question: "", imagePath: url.path))
    }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
    }
}
#endif
