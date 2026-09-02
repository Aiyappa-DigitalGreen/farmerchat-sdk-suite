import SwiftUI
import FarmerChatCore

/// Port of LanguageScreen (onboarding): logo, title, radio list
/// (priority + expandable "All languages"), bottom bar with legal links and
/// "Start using FarmerChat".
struct LanguageSelectionView: View {
    @Environment(\.fcTheme) private var theme
    @EnvironmentObject var router: FCRouter
    @StateObject private var viewModel = OnboardingViewModel()
    @StateObject private var toast = FCToastState()
    @State private var didBootstrap = false

    var body: some View {
        VStack(spacing: 0) {
            switch viewModel.state.languageState {
            case .idle, .loading:
                FCLogoSpinner(message: fcLabel("loading_languages", "Loading languages…"))
            case .error:
                // App shows the spinner and silently retries.
                FCLogoSpinner(message: fcLabel("splash_starting", "FarmerChat is Starting…"))
                    .task { [viewModel] in
                        try? await Task.sleep(nanoseconds: 1_500_000_000)
                        guard !Task.isCancelled else { return }
                        // Unstructured on purpose: the retry flips state to
                        // .loading, which destroys this branch (and would
                        // cancel the in-flight bootstrap with it).
                        Task { await viewModel.bootstrapLanguages() }
                    }
            case .success:
                languageList
                bottomBar
            }
        }
        .background(theme.content.surfacePrimary.ignoresSafeArea())
        .fcToastHost(toast)
        .task {
            guard !didBootstrap else { return }
            didBootstrap = true
            let env = FarmerChat.shared
            env.analytics.screenViewed(ScreenNames.language)
            router.errorNavigation.setActiveScreen("language")
            if !env.prefs.bool(.languageDone) {
                viewModel.onAction(.resetState)
            }
            viewModel.onAction(.fetchLegalLinks)
            await viewModel.bootstrapLanguages()
        }
        .onChange(of: viewModel.state.languageSubmitSuccess) { success in
            guard success else { return }
            viewModel.onAction(.consumeLanguageResult)
            FarmerChat.shared.analytics.screenExited(ScreenNames.language)
            router.routeFromSplash()
        }
        .onChange(of: viewModel.state.submitErrorMessage) { message in
            if let message {
                toast.show(.error, message)
                viewModel.onAction(.consumeLanguageResult)
            }
        }
        .onChange(of: viewModel.state.shouldNavigateToError) { shouldNavigate in
            guard shouldNavigate else { return }
            viewModel.onAction(.consumeErrorNavigation)
            router.errorNavigation.navigateToError(
                isNetworkError: viewModel.state.errorIsNetworkError,
                fromScreen: "language"
            )
        }
        .sheet(item: $router.legalSheet) { item in
            LegalContentView(url: item.url, title: item.title)
        }
    }

    private var languageList: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Header (centered): logo mark, title, subtitle.
                FCLogoMark(size: 44, tint: theme.content.foregroundPrimary)
                    .padding(.top, 24)

                Text(fcLabel("choose_language_title", "Choose your language"))
                    .font(.system(size: 24, weight: .bold))
                    .foregroundColor(theme.content.foregroundPrimary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 20)

                Text(fcLabel("choose_language_subtitle", "You can change this later"))
                    .font(.system(size: 17))
                    .foregroundColor(theme.content.foregroundSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 6)

                // Language rows (full-width white cards), spaced 6.
                VStack(spacing: 6) {
                    ForEach(viewModel.state.visibleLanguages()) { language in
                        FCRadioRow(
                            title: language.displayName ?? language.name ?? "",
                            selected: viewModel.state.selectedLanguageId == language.id,
                            loading: viewModel.state.fetchingLabelsForId == language.id,
                            action: { viewModel.onAction(.selectLanguage(languageId: language.id)) }
                        )
                    }

                    if !viewModel.state.expandedLanguages && viewModel.state.hasExpandableLanguages() {
                        Button(action: { viewModel.toggleExpandedLanguages() }) {
                            Text(fcLabel("all_languages", "All languages"))
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundColor(theme.content.foregroundPrimary)
                                .padding(.horizontal, 18)
                                .padding(.vertical, 10)
                                .background(theme.content.surfaceSecondary)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .padding(.top, 10)
                    }
                }
                .padding(.top, 24)
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 20)
            .padding(.bottom, 16)
        }
    }

    private var bottomBar: some View {
        VStack(spacing: 12) {
            Text(fcLabel("fc_v2_app_label_farmerchat_tagline",
                         "Practical advice for your crops and animals"))
                .font(.system(size: 15))
                .foregroundColor(theme.content.foregroundSecondary)
                .multilineTextAlignment(.center)

            FCPrimaryButton(
                title: viewModel.state.isSubmittingLanguage
                    ? fcLabel("setting_language", "Setting language")
                    : fcLabel("start_using", "Start using FarmerChat"),
                state: viewModel.state.isSubmittingLanguage ? .loading : .chevron,
                enabled: viewModel.state.selectedLanguageId != nil && viewModel.state.languageState.isSuccess,
                action: {
                    viewModel.onAction(.acceptTerms)
                    viewModel.onAction(.getStartedClicked)
                },
                height: 56
            )

            legalText
        }
        .padding(.horizontal, 20)
        .padding(.top, 16)
        .padding(.bottom, 12)
        .frame(maxWidth: .infinity)
        .background(
            theme.content.surfaceSecondary
                .clipShape(UnevenRoundedRectangle(topLeadingRadius: 20, topTrailingRadius: 20))
                .ignoresSafeArea(edges: .bottom)
        )
    }

    private var legalText: some View {
        VStack(spacing: 2) {
            Text(fcLabel("legal_agree_prefix", "By continuing you agree to our"))
                .foregroundColor(theme.content.foregroundSecondary)
            HStack(spacing: 6) {
                Button(action: {
                    if let url = viewModel.state.termsOfUseUrl {
                        router.openLegal(url: url, title: fcLabel("terms_of_use", "Terms of use"))
                    }
                }) {
                    Text(fcLabel("terms_of_use", "Terms of use"))
                        .underline()
                        .foregroundColor(theme.content.foregroundPrimary)
                }
                Text("·")
                    .foregroundColor(theme.content.foregroundSecondary)
                Button(action: {
                    if let url = viewModel.state.privacyPolicyUrl {
                        router.openLegal(url: url, title: fcLabel("privacy_policy", "Privacy policy"))
                    }
                }) {
                    Text(fcLabel("privacy_policy", "Privacy policy"))
                        .underline()
                        .foregroundColor(theme.content.foregroundPrimary)
                }
            }
        }
        .font(.system(size: 13))
        .buttonStyle(.plain)
    }
}
