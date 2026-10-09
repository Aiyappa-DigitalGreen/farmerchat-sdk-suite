import SwiftUI
import FarmerChatCore

// MARK: - Settings (port of SettingsScreen)

struct SettingsView: View {
    @Environment(\.fcTheme) private var theme
    @EnvironmentObject var router: FCRouter
    @ObservedObject var settingsVM: SettingsViewModel
    @StateObject private var profileVM = UserProfileViewModel()
    @StateObject private var toast = FCToastState()
    let openDrawer: () -> Void
    let showNameUpdatedToast: Bool
    let onToastConsumed: () -> Void

    @State private var isLoggingOut = false
    @State private var didAppear = false

    var body: some View {
        VStack(spacing: 0) {
            FCAppBar(
                title: fcLabel(FCLabels.settings, "Settings"),
                // Drawer off: back instead of a dead hamburger.
                leading: FarmerChat.shared.config.showDrawer ? .menu : .back,
                onLeadingTap: FarmerChat.shared.config.showDrawer ? openDrawer : { router.pop() }
            )

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    // Appearance selector (Day/Night/Auto)
                    FCListCard(title: fcLabel(FCLabels.appearance, "Appearance")) {
                        HStack(spacing: 10) {
                            appearanceButton(.day, icon: "sun.max.fill", label: fcLabel(FCLabels.day, "Day"))
                            appearanceButton(.night, icon: "moon.fill", label: fcLabel(FCLabels.night, "Night"))
                            appearanceButton(.auto, icon: "circle.lefthalf.filled", label: fcLabel(FCLabels.auto, "Auto"))
                        }
                        .padding(16)
                    }

                    // Account details
                    FCListCard(title: fcLabel(FCLabels.accountDetails, "Account details")) {
                        FCListItem(
                            icon: "person.fill",
                            title: fcLabel(FCLabels.yourName, "Your name"),
                            subtitle: userName,
                            action: { router.push(.settingsName) }
                        )
                    }

                    if settingsVM.isAuthenticated {
                        FCSecondaryButton(title: fcLabel(FCLabels.logout, "Logout"), destructive: true, action: logout)
                            .overlay { if isLoggingOut { ProgressView() } }
                    } else {
                        FCSecondaryButton(title: fcLabel(FCLabels.signUp, "Sign up")) {
                            handleSignUp()
                        }
                    }
                }
                .padding(16)
            }
        }
        .background(theme.content.surfacePrimary.ignoresSafeArea())
        .fcToastHost(toast)
        .task {
            guard !didAppear else { return }
            didAppear = true
            FarmerChat.shared.analytics.screenViewed(ScreenNames.settings)
            profileVM.fetchProfile(fromScreen: "settings")
            if showNameUpdatedToast {
                try? await Task.sleep(nanoseconds: 500_000_000)
                toast.show(.success, fcLabel(FCLabels.yourNameHasUpdated, "Your name has been updated."))
                onToastConsumed()
            }
        }
    }

    private var userName: String {
        let stored = settingsVM.userName
        return stored.isEmpty ? fcLabel("settings_no_name", "Add your name") : stored
    }

    private func appearanceButton(_ mode: FarmerChatAppearance, icon: String, label: String) -> some View {
        let isActive = settingsVM.appearanceMode == mode
        return Button {
            settingsVM.setAppearanceMode(mode)
        } label: {
            VStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 18, weight: .medium))
                Text(label).fcTextStyle(theme.typography.labelSmall)
            }
            .foregroundColor(isActive ? theme.brand.surfacePrimary : theme.content.foregroundSecondary)
            .frame(maxWidth: .infinity)
            .frame(height: 68)
            .background(isActive ? theme.content.surfaceActive : theme.content.surfaceTertiary)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func handleSignUp() {
        Task {
            let bypass = await settingsVM.shouldBypassInterstitial()
            router.push(bypass ? .auth : .accountBenefits)
        }
    }

    private func logout() {
        guard !isLoggingOut else { return }
        isLoggingOut = true
        Task {
            await FarmerChat.shared.logout()
            isLoggingOut = false
            router.onLogout()
        }
    }
}

// MARK: - SettingsName (port of SettingsNameScreen)

struct SettingsNameView: View {
    @Environment(\.fcTheme) private var theme
    @EnvironmentObject var router: FCRouter
    @StateObject private var viewModel = EnterNameViewModel()
    @StateObject private var toast = FCToastState()
    let onSaveComplete: () -> Void

    @State private var name = ""
    @State private var didAppear = false

    var body: some View {
        VStack(spacing: 0) {
            FCAppBar(
                title: fcLabel(FCLabels.name, "Name"),
                leading: .back,
                onLeadingTap: { router.pop() }
            )

            VStack(spacing: 20) {
                FCTextField(
                    placeholder: fcLabel(FCLabels.yourName, "Your name"),
                    text: Binding(
                        get: { name },
                        set: { name = NameInputNormalizer.normalize($0) }
                    ),
                    autoFocus: true
                )

                FCPrimaryButton(
                    title: fcLabel(FCLabels.saveName, "Save name"),
                    state: viewModel.state.updateUserNameState.isLoading ? .loading : .normal,
                    enabled: !name.trimmingCharacters(in: .whitespaces).isEmpty,
                    action: save
                )
                Spacer()
            }
            .padding(20)
        }
        .background(theme.content.surfacePrimary.ignoresSafeArea())
        .fcToastHost(toast)
        .onAppear {
            guard !didAppear else { return }
            didAppear = true
            FarmerChat.shared.analytics.screenViewed(ScreenNames.settingsName)
            name = NameInputNormalizer.sanitizeStored(FarmerChat.shared.prefs.string(.userName))
        }
        .onChange(of: viewModel.state.updateUserNameState.isSuccess) { success in
            guard success else { return }
            viewModel.onAction(.consumeUpdateResult, screenName: ScreenNames.settings)
            onSaveComplete()
            router.pop()
        }
    }

    private func save() {
        if let validation = NameInputNormalizer.validationError(for: name, labels: FarmerChat.shared.labels) {
            toast.show(.error, validation)
            return
        }
        guard let userId = FarmerChat.shared.session.userId else { return }
        viewModel.onAction(
            .updateUserName(body: UserNameRequest(userId: userId, name: name.trimmingCharacters(in: .whitespaces))),
            screenName: ScreenNames.settings
        )
    }
}

// MARK: - LanguageChooser (port of LanguageChooserScreen)

struct LanguageChooserView: View {
    @Environment(\.fcTheme) private var theme
    @EnvironmentObject var router: FCRouter
    @ObservedObject var settingsVM: SettingsViewModel
    @StateObject private var toast = FCToastState()
    let openDrawer: () -> Void
    let onLanguageSaved: () -> Void
    let onFetchLabelsFailure: () -> Void

    @State private var didAppear = false

    var body: some View {
        VStack(spacing: 0) {
            FCAppBar(
                title: fcLabel(FCLabels.chooseYourLanguage, "Choose your language"),
                // Drawer off: back instead of a dead hamburger.
                leading: FarmerChat.shared.config.showDrawer ? .menu : .back,
                onLeadingTap: FarmerChat.shared.config.showDrawer ? openDrawer : { router.pop() }
            )

            switch settingsVM.state.languageState {
            case .idle, .loading:
                FCLogoSpinner(message: fcLabel(FCLabels.loadingLanguages, "Loading languages..."))
            case .error:
                Color.clear.onAppear { onFetchLabelsFailure() }
            case .success:
                ScrollView {
                    VStack(spacing: 4) {
                        ForEach(settingsVM.state.visibleLanguages()) { language in
                            FCRadioRow(
                                title: language.displayName ?? language.name ?? "",
                                subtitle: language.name != language.displayName ? language.name : nil,
                                selected: settingsVM.state.selectedLanguageId == language.id,
                                loading: settingsVM.state.fetchingLabelsForId == language.id,
                                action: { settingsVM.selectLanguage(id: language.id, code: language.code) }
                            )
                        }
                        if !settingsVM.state.expandedLanguages && settingsVM.state.hasExpandableLanguages() {
                            Button(fcLabel(FCLabels.allLanguages, "All languages")) {
                                settingsVM.toggleExpandedLanguages()
                            }
                            // App parity (LanguageChooserScreen.kt:210): labelLarge = 17/600.
                            .fcTextStyle(theme.typography.labelLarge)
                            .foregroundColor(theme.brand.surfacePrimary)
                            .padding(.vertical, 10)
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.bottom, 16)
                }

                FCPrimaryButton(
                    title: settingsVM.state.isSubmittingLanguage
                        ? fcLabel(FCLabels.settingLanguage, "Setting language")
                        : fcLabel(FCLabels.saveLanguage, "Save language"),
                    state: settingsVM.state.isSubmittingLanguage ? .loading : .normal,
                    enabled: settingsVM.state.selectedLanguageId != nil && !settingsVM.state.isFetchingLabels,
                    action: { settingsVM.submitLanguage() }
                )
                .padding(16)
            }
        }
        .background(theme.content.surfacePrimary.ignoresSafeArea())
        .fcToastHost(toast)
        .onAppear {
            guard !didAppear else { return }
            didAppear = true
            FarmerChat.shared.analytics.screenViewed(ScreenNames.languageChooser)
            settingsVM.loadLanguages()
        }
        .onChange(of: settingsVM.state.languageSubmitSuccess) { success in
            guard success else { return }
            settingsVM.consumeLanguageResult()
            toast.show(.success, fcLabel(FCLabels.languageUpdated, "Language updated"))
            Task {
                try? await Task.sleep(nanoseconds: 500_000_000)
                onLanguageSaved()
            }
        }
        .onChange(of: settingsVM.state.submitErrorMessage) { message in
            if let message {
                toast.show(.error, message)
                settingsVM.consumeLanguageResult()
            }
        }
    }
}

// MARK: - Help (port of HelpScreen)

struct HelpView: View {
    @Environment(\.fcTheme) private var theme
    @EnvironmentObject var router: FCRouter
    @StateObject private var viewModel = HelpViewModel()
    let openDrawer: () -> Void

    @State private var didAppear = false

    var body: some View {
        VStack(spacing: 0) {
            FCAppBar(
                title: fcLabel(FCLabels.help, "Help"),
                // Drawer off: back instead of a dead hamburger.
                leading: FarmerChat.shared.config.showDrawer ? .menu : .back,
                onLeadingTap: FarmerChat.shared.config.showDrawer ? openDrawer : { router.pop() }
            )

            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    FCListCard(title: fcLabel(FCLabels.howToUseFarmerchat, "How to use FarmerChat")) {
                        switch viewModel.helpState {
                        case .idle, .loading:
                            VStack(spacing: 12) {
                                ForEach(0..<4, id: \.self) { _ in FCSkeletonRow() }
                            }
                            .padding(16)
                        case .error:
                            VStack(spacing: 8) {
                                Text(fcLabel("help_load_failed", "Couldn't load help topics."))
                                    .fcTextStyle(theme.typography.bodySmall)
                                    .foregroundColor(theme.content.foregroundSecondary)
                                Button(fcLabel(FCLabels.tryAgain, "Try again")) { viewModel.reload() }
                                    .fcTextStyle(theme.typography.labelMedium)
                                    .foregroundColor(theme.brand.surfacePrimary)
                                    .buttonStyle(.plain)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(16)
                        case .success:
                            if viewModel.faqs.isEmpty {
                                Text(fcLabel("help_empty", "No help topics yet."))
                                    .fcTextStyle(theme.typography.bodySmall)
                                    .foregroundColor(theme.content.foregroundSecondary)
                                    .padding(16)
                            } else {
                                ForEach(viewModel.faqs) { faq in
                                    FCListItem(icon: "questionmark.circle", title: faq.displayTitle) {
                                        if let url = faq.url {
                                            router.openLegal(url: url, title: "FAQ")
                                        }
                                    }
                                }
                            }
                        }
                    }

                    FCListCard(title: fcLabel(FCLabels.more, "More")) {
                        FCListItem(icon: "doc.text", title: fcLabel(FCLabels.termsOfUse, "Terms of use")) {
                            if let url = viewModel.legal?.termsOfUse {
                                router.openLegal(url: url, title: fcLabel(FCLabels.termsOfUse, "Terms of use"))
                            }
                        }
                        FCListItem(icon: "lock.shield", title: fcLabel(FCLabels.privacyPolicy, "Privacy policy")) {
                            if let url = viewModel.legal?.privacyPolicy {
                                router.openLegal(url: url, title: fcLabel(FCLabels.privacyPolicy, "Privacy policy"))
                            }
                        }
                    }

                    VStack(spacing: 4) {
                        Text("FarmerChat SDK \(FarmerChatSDK.version)")
                        Text("© Digital Green")
                    }
                    .fcTextStyle(theme.typography.caption)
                    .foregroundColor(theme.content.foregroundSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 8)
                }
                .padding(16)
            }
        }
        .background(theme.content.surfacePrimary.ignoresSafeArea())
        .onAppear {
            guard !didAppear else { return }
            didAppear = true
            FarmerChat.shared.analytics.screenViewed(ScreenNames.help)
            viewModel.load()
        }
        .sheet(item: $router.legalSheet) { item in
            LegalContentView(url: item.url, title: item.title)
        }
    }
}
