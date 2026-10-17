#if canImport(UIKit)
import UIKit
import Combine
import FarmerChatCore

/// Native UIKit Home — the app's composer Home (HomeScreen.kt, `getComposerUiEnabled()` hard-wired
/// true there): the green band behind a transparent feed, HomeAppBar (round menu tile + weather
/// pill), the fixed header (logo, "For your farm today", Location 2.0 pill) over a
/// UICollectionView of feed cards whose top fades into the band, and the floating InputComposer
/// (camera / text / mic; a picked photo is attached and sent with the typed caption).
///
/// It used to be the 1.0 Home: a system navigation bar titled "FarmerChat", a greeting cell and
/// the pinned Photo/Speak/Type buttons.
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

    private let weatherPill = FCUIWeatherPill()
    private let band = FCUIHomeBandView()
    private var appBar: FCUIAppBar!
    private let header = UIStackView()
    private let locationPill = FCUILocationPillButton()
    private let feedMask = CAGradientLayer()
    private let feedContainer = UIView()
    private var composer: FCUIComposerView!
    private var composerBottom: NSLayoutConstraint!
    /// A composer photo waiting for its caption (InputComposer `photoUris`, one image).
    private var composerPhoto: URL?
    private var pillSuccess = false
    private var pillFlowWasActive = false
    private var fetchingSectionId: String?
    private var sectionHeader: FCUISectionHeaderView?
    private var builtLanguage: String?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = FCUITheme.surfacePrimary
        navigationItem.hidesBackButton = true

        band.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(band)
        NSLayoutConstraint.activate([
            band.topAnchor.constraint(equalTo: view.topAnchor),
            band.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            band.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            band.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        // HomeAppBar.kt: 52pt, the round menu tile (C3: only with the drawer) and the weather
        // pill; no background — the band behind supplies the green.
        var menu: UIView?
        if FarmerChat.shared.config.showDrawer {
            let tile = FCUIHeaderTile(systemImage: "line.3.horizontal", accessibilityLabel: "menu", identifier: "fcHomeMenu", radius: 21)
            tile.addAction(UIAction { [weak self] _ in self?.openMenu() }, for: .touchUpInside)
            menu = tile
        }
        weatherPill.addAction(UIAction { [weak self] _ in self?.weatherTapped() }, for: .touchUpInside)
        weatherPill.alpha = 0
        let right = UIStackView(arrangedSubviews: [weatherPill])
        right.axis = .horizontal
        right.alignment = .center
        if (navigationController as? FarmerChatViewController)?.hasFallbackClose == true {
            // SDK addition: keep the pill clear of a presenter's fallback ✕.
            let inset = UIView()
            inset.widthAnchor.constraint(equalToConstant: 48).isActive = true
            right.addArrangedSubview(inset)
        }
        appBar = FCUIAppBar(title: nil, left: menu ?? FCUIAppBar.spacer(), right: right, height: 52, background: false)
        view.addSubview(appBar)
        NSLayoutConstraint.activate([
            appBar.topAnchor.constraint(equalTo: view.topAnchor),
            appBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            appBar.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])

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
        // Back from a language Save: re-resolve every label the UIKit chrome captured.
        let language = FarmerChat.shared.prefs.string(.selectedLanguageCode)
        if let builtLanguage, builtLanguage != language {
            sectionHeader?.titleLabel.text = fcuiLabel(FCLabels.forYourFarmToday, "For your farm today")
            composer.relabel()
            collectionView.reloadData()
            render(viewModel.state)
        }
        builtLanguage = language
        renderPill()
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
                self.pillStateChanged(state, prompt: prompt)
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
        let layout = UICollectionViewCompositionalLayout { _, _ in
            let itemSize = NSCollectionLayoutSize(widthDimension: .fractionalWidth(1), heightDimension: .estimated(320))
            let item = NSCollectionLayoutItem(layoutSize: itemSize)
            let group = NSCollectionLayoutGroup.vertical(layoutSize: itemSize, subitems: [item])
            let section = NSCollectionLayoutSection(group: group)
            // HomeScreen.kt:1310/1507 — 16pt sides, a 16pt gap after every card.
            section.interGroupSpacing = 16
            section.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: 16, bottom: 16, trailing: 16)
            return section
        }

        // The feed scrolls in a container whose top strip fades to transparent, so cards
        // dissolve into the band as they pass under the fixed header (HomeScreen.kt 70adc5fd).
        feedContainer.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(feedContainer)
        feedMask.colors = [UIColor.clear.cgColor, UIColor.clear.cgColor, UIColor.black.cgColor, UIColor.black.cgColor]
        feedContainer.layer.mask = feedMask

        collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collectionView.backgroundColor = .clear
        collectionView.delegate = self
        collectionView.keyboardDismissMode = .interactive
        collectionView.translatesAutoresizingMaskIntoConstraints = false
        feedContainer.addSubview(collectionView)

        // The fixed header: 42pt logo, the leaf-flanked "For your farm today", the location pill
        // — 12pt apart, 16pt below; transparent over the band.
        let logo = UIView()
        let mark = CAShapeLayer()
        mark.path = FCUILogoMark.path(size: 42)
        mark.fillColor = UIColor.white.cgColor
        logo.layer.addSublayer(mark)
        logo.isAccessibilityElement = false
        logo.translatesAutoresizingMaskIntoConstraints = false
        logo.widthAnchor.constraint(equalToConstant: 42).isActive = true
        logo.heightAnchor.constraint(equalToConstant: 42).isActive = true
        let sectionHeader = FCUISectionHeaderView(
            title: fcuiLabel(FCLabels.forYourFarmToday, "For your farm today"),
            titleColor: .white
        )
        locationPill.addAction(UIAction { [weak self] _ in self?.pillTapped() }, for: .touchUpInside)
        header.axis = .vertical
        header.alignment = .center
        header.spacing = 12
        header.isLayoutMarginsRelativeArrangement = true
        header.directionalLayoutMargins = NSDirectionalEdgeInsets(top: 0, leading: 0, bottom: 16, trailing: 0)
        header.addArrangedSubview(logo)
        header.addArrangedSubview(sectionHeader)
        self.sectionHeader = sectionHeader
        header.addArrangedSubview(locationPill)
        header.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(header)

        let config = FarmerChat.shared.config
        composer = FCUIComposerView(showCamera: config.enableImages, showMic: config.enableVoice)
        // Floating over the feed: no reading-surface strip behind the sheet.
        composer.backgroundColor = .clear
        composer.onSend = { [weak self] question in
            guard let self else { return }
            let photo = self.composerPhoto
            self.composerPhoto = nil
            self.composer.attachment = nil
            // HomeScreen.kt sendMessage(query, photoUris.firstOrNull()): Chat sends both.
            self.openChat(FCUIChatArgs(question: question, imagePath: photo?.path))
        }
        composer.onRemoveAttachment = { [weak self] in
            self?.composerPhoto = nil
            self?.composer.attachment = nil
        }
        // Camera is offered only while nothing is attached (one image).
        composer.onCamera = { [weak self] in
            guard let self, self.composerPhoto == nil else { return }
            self.photoTapped()
        }
        composer.onMic = { [weak self] in self?.speakTapped() }
        composer.onFocusChange = { [weak self] focused in
            self?.composerBottom.constant = focused ? -4 : 0
        }
        view.addSubview(composer)
        composerBottom = composer.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor)

        NSLayoutConstraint.activate([
            feedContainer.topAnchor.constraint(equalTo: appBar.bottomAnchor),
            feedContainer.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            feedContainer.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            feedContainer.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            collectionView.topAnchor.constraint(equalTo: feedContainer.topAnchor),
            collectionView.leadingAnchor.constraint(equalTo: feedContainer.leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: feedContainer.trailingAnchor),
            collectionView.bottomAnchor.constraint(equalTo: feedContainer.bottomAnchor),
            header.topAnchor.constraint(equalTo: appBar.bottomAnchor),
            header.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            header.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            sectionHeader.widthAnchor.constraint(equalTo: header.widthAnchor),
            composer.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            composer.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            composerBottom
        ])

        let cardCell = UICollectionView.CellRegistration<FCUIFeedCardCell, SectionDto> { [weak self] cell, _, section in
            cell.configure(section: section, isLoading: self?.fetchingSectionId == section.id)
            cell.onTap = { self?.cardTapped(section) }
            cell.onDismiss = { self?.viewModel.dismissCard(sectionId: section.id) }
            cell.onOptionSubmit = { options in self?.submitOptions(section: section, options: options) }
        }
        let ssfrCell = UICollectionView.CellRegistration<FCUISsfrCell, Int> { [weak self] cell, _, _ in
            cell.onCropSelected = { crop in self?.ssfrCropSelected(crop) }
        }
        let emptyCell = UICollectionView.CellRegistration<UICollectionViewCell, Int> { _, _, _ in }
        dataSource = UICollectionViewDiffableDataSource<Int, Item>(collectionView: collectionView) { [weak self] collectionView, indexPath, item in
            switch item {
            case .greeting:
                return collectionView.dequeueConfiguredReusableCell(using: emptyCell, for: indexPath, item: 0)
            case .ssfr:
                return collectionView.dequeueConfiguredReusableCell(using: ssfrCell, for: indexPath, item: 0)
            case .section(let id):
                guard let section = self?.sectionsById[id] else {
                    return collectionView.dequeueConfiguredReusableCell(using: emptyCell, for: indexPath, item: 0)
                }
                return collectionView.dequeueConfiguredReusableCell(using: cardCell, for: indexPath, item: section)
            }
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // Item 0's reservation = the fixed header's height; the bottom reserves the composer.
        let headerHeight = header.frame.height
        let bottom = max(0, view.bounds.maxY - composer.frame.minY) - view.safeAreaInsets.bottom + 8
        let insets = UIEdgeInsets(top: headerHeight, left: 0, bottom: max(bottom, 0), right: 0)
        if collectionView.contentInset != insets {
            let atTop = collectionView.contentOffset.y <= -collectionView.contentInset.top + 1
            collectionView.contentInset = insets
            collectionView.verticalScrollIndicatorInsets = insets
            if atTop { collectionView.contentOffset.y = -headerHeight }
        }
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        feedMask.frame = feedContainer.bounds
        let h = max(feedContainer.bounds.height, 1)
        let fadeEnd = headerHeight / h
        feedMask.locations = [0, NSNumber(value: Double(fadeEnd * 0.8)), NSNumber(value: Double(fadeEnd)), 1]
        CATransaction.commit()
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
        // The fixed header belongs to the feed (HomeScreen.kt draws it in the Success branch).
        header.isHidden = collectionView.isHidden

        // HomeScreen.kt: the pill shows once weather is loading or loaded; `current_temp` verbatim
        // (the server already sends the unit, "21 °C").
        let showWeather = FarmerChat.shared.config.enableWeather
            && (state.weatherState.value != nil || state.weatherState.isLoading)
        weatherPill.configure(loading: state.weatherState.isLoading, weather: state.weatherState.value)
        if (weatherPill.alpha > 0) != showWeather {
            UIView.animate(withDuration: 0.4) { self.weatherPill.alpha = showWeather ? 1 : 0 }
        }
        weatherPill.isUserInteractionEnabled = showWeather
        renderPill()

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
        snapshot.appendSections([1])
        // The composer Home has no greeting and no in-feed header: "For your farm today" is in
        // the fixed header. C3 + feed flag: SSFR card above the feed cards.
        if feed.ssfrEnable == true && FarmerChat.shared.config.enableSsfr {
            snapshot.appendItems([.ssfr], toSection: 1)
        }
        sectionsById = Dictionary(uniqueKeysWithValues: state.visibleSections().map { ($0.id, $0) })
        snapshot.appendItems(state.visibleSections().map { .section($0.id) }, toSection: 1)
        dataSource.apply(snapshot, animatingDifferences: true)
    }

    // MARK: - Location pill (HomeScreen.kt `HomeLocationPill`)

    private func renderPill() {
        guard let prompt = (navigationController as? FarmerChatViewController)?.locationPrompt else { return }
        let state = FCLocationPillState.resolve(
            isBlocked: prompt.isBlockedByPermission,
            isSearching: FCLocationPillState.isSearching(state: prompt.state, source: prompt.source),
            showSuccess: pillSuccess,
            hasStoredFix: prompt.isLocationKnown,
            hasPermission: prompt.hasCurrentLocationPermission,
            placeName: prompt.approxPlaceName
        )
        locationPill.configure(state: state, placeName: prompt.approxPlaceName)
    }

    private func pillStateChanged(_ state: LocationPromptState, prompt: LocationPromptManager) {
        if pillFlowWasActive, state == .idle, prompt.isLocationKnown {
            // The pill's own flow just succeeded — hold the checkmark briefly.
            pillSuccess = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
                self?.pillSuccess = false
                self?.renderPill()
            }
        }
        pillFlowWasActive = FCLocationPillState.isFlowActive(state: state, source: prompt.source)
        renderPill()
    }

    private func pillTapped() {
        // Re-run the flow rather than jumping to Settings: denied twice → Recovery, whose sheet
        // carries its own Settings button.
        guard let prompt = (navigationController as? FarmerChatViewController)?.locationPrompt,
              prompt.state == .idle else { return }
        prompt.triggerFromLocalContext()
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

    /// The composer's camera: Camera / Gallery (`fc_v2_app_label_camera` / `_gallery`); the photo
    /// then waits in the composer for a caption (HomeScreen.kt:350/386).
    private func photoTapped() {
        let sheet = UIAlertController(title: nil, message: nil, preferredStyle: .actionSheet)
        if UIImagePickerController.isSourceTypeAvailable(.camera) {
            sheet.addAction(UIAlertAction(title: fcuiLabel(FCLabels.camera, "Camera"), style: .default) { [weak self] _ in
                self?.presentPicker(.camera)
            })
        }
        sheet.addAction(UIAlertAction(title: fcuiLabel(FCLabels.gallery, "Gallery"), style: .default) { [weak self] _ in
            self?.presentPicker(.photoLibrary)
        })
        sheet.addAction(UIAlertAction(title: fcuiLabel(FCLabels.cancel, "Cancel"), style: .cancel))
        sheet.popoverPresentationController?.sourceView = composer
        present(sheet, animated: true)
    }

    private func presentPicker(_ source: UIImagePickerController.SourceType) {
        let picker = UIImagePickerController()
        picker.sourceType = source
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
        guard fetchingSectionId == nil else { return }
        setFetching(section.id)
        Task { @MainActor in
            let result = await FarmerChat.shared.api.imageStatement(
                ImageStatementRequest(statementId: statementId, triggeredInputType: triggerType)
            )
            self.setFetching(nil)
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

    /// ContentCard `isButtonLoading`: the tapped card's button spins while #26 loads.
    private func setFetching(_ id: String?) {
        let changed = [fetchingSectionId, id].compactMap { $0 }
        fetchingSectionId = id
        var snapshot = dataSource.snapshot()
        let items = changed.map { Item.section($0) }.filter { snapshot.indexOfItem($0) != nil }
        guard !items.isEmpty else { return }
        snapshot.reconfigureItems(items)
        dataSource.apply(snapshot, animatingDifferences: false)
    }

    /// The card runs Saving → "Thank you" → gone itself (Cards.kt timings) and removes itself
    /// from the feed through `onDismiss`; this only sends the answer.
    private func submitOptions(section: SectionDto, options: [SectionOption]) {
        guard let userId = FarmerChat.shared.session.userId else { return }
        if section.selectionType == "single" || section.type == "single_select" {
            Task { @MainActor in
                _ = await FarmerChat.shared.api.updateUserProfile(
                    UserNameRequest(userId: userId, gender: options.first?.text)
                )
            }
        } else if section.uniqueKey?.contains("livestock") == true || section.statementType?.contains("livestock") == true {
            let details = options.map { LiveStockDetail(id: $0.rawId, name: $0.text) }
            Task { @MainActor in
                _ = await FarmerChat.shared.api.updateUserProfile(UserNameRequest(userId: userId, liveStockDetails: details))
            }
        } else {
            let cropIds = options.compactMap { $0.rawId?.intValue }
            viewModel.onAction(.updateCultivatedCrops(userId: userId, cropIds: cropIds))
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
              // Image cards only (HomeScreen.kt:2092) — statement cards are never marked viewed.
              HomeViewModel.shouldMarkViewed(section),
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
        // Composer Home: the photo is ATTACHED for an optional caption; a new pick replaces it.
        composerPhoto = url
        composer.attachment = image
        composer.focus()
    }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
    }
}
#endif
