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
                FCLogoSpinner(message: fcLabel(FCLabels.loadingLanguages, "Loading languages..."))
            case .error:
                // App shows the spinner and silently retries.
                FCLogoSpinner(message: fcLabel(FCLabels.farmerchatStarting, "FarmerChat is Starting..."))
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
                // App parity (LanguageScreen.kt:371-376): the mark is 32 pt and tinted
                // `borderActive` — the brand GREEN. iOS had 44 pt on `foregroundPrimary`, which
                // draws a BLACK flower. Same defect android had on this screen and on
                // EnterName; fixed on all of them 2026-09-08 (docs/04).
                FCLogoMark(size: 32, tint: theme.content.borderActive)
                    .padding(.top, 32)

                Text(fcLabel(FCLabels.chooseYourLanguage, "Choose your language"))
                    // App parity: titleLarge = 22/700, not 24.
                    .fcTextStyle(theme.typography.titleLarge)
                    .foregroundColor(theme.content.foregroundPrimary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 14)

                Text(fcLabel(FCLabels.youChangeLater, "You can change this later"))
                    .fcTextStyle(theme.typography.bodyMedium)
                    .foregroundColor(theme.content.foregroundSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.top, 8)

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
                            // App parity (LanguageScreen.kt:459-475): a FILLED PRIMARY chip —
                            // white on dark green, labelLarge (17/600), 20 pt horizontal, 16 pt
                            // above. iOS drew a light `surfaceSecondary` pill with dark text at
                            // 15 pt, the same way android did before this pass.
                            Text(fcLabel(FCLabels.allLanguages, "All languages"))
                                .fcTextStyle(theme.typography.labelLarge)
                                .foregroundColor(theme.content.buttonPrimaryForeground)
                                .padding(.horizontal, 20)
                                .padding(.vertical, 10)
                                .background(theme.content.buttonPrimarySurface)
                                .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .padding(.top, 16)
                    }
                }
                .padding(.top, 24)
            }
            .frame(maxWidth: .infinity)
            // App parity: 24 pt horizontal, 24 pt bottom.
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
    }

    private var bottomBar: some View {
        VStack(spacing: 12) {
            // App parity (LanguageScreen.kt:250-252): the tagline is titleLarge (22/700) on
            // foregroundPrimary — a bold dark headline above the CTA, not a 15 pt grey caption.
            Text(fcLabel(FCLabels.farmerchatTagline, "FarmerChat: Practical advice for your crops & livestock"))
                .fcTextStyle(theme.typography.titleLarge)
                .foregroundColor(theme.content.foregroundPrimary)
                .multilineTextAlignment(.center)

            FCPrimaryButton(
                title: viewModel.state.isSubmittingLanguage
                    ? fcLabel(FCLabels.settingLanguage, "Setting language")
                    : fcLabel(FCLabels.startUsingFarmerchat, "Start using FarmerChat"),
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

    // Custom-scheme URLs are the only way to make a span inside a single SwiftUI `Text`
    // tappable: `Text(a) + Text(b)` concatenation loses per-span hit-testing, and a Button
    // cannot live inside a run of text. `openURL` below intercepts both before anything
    // reaches the system.
    private static let termsLink = URL(string: "farmerchat-legal://terms")!
    private static let privacyLink = URL(string: "farmerchat-legal://privacy")!

    /// One flowing consent paragraph with the two legal links inline.
    ///
    /// App parity (LanguageScreen.kt 47bc8524): the intro and the links used to be a `Text`
    /// plus an `HStack`, which hard-broke the paragraph and left a short centred stub line
    /// between them. They are one attributed run now, joined by the served `also_see`
    /// connector instead of a bare "·", with the trailing "." outside the link span so it is
    /// neither underlined nor tappable.
    ///
    /// The app justifies this paragraph (`TextAlign.Justify`). SwiftUI has no justified
    /// alignment — `.multilineTextAlignment` is leading/center/trailing only — so this takes
    /// `.leading`, which is where the app's justified text puts its last line. Recorded in
    /// docs/04.
    private var legalParagraph: AttributedString {
        let intro = fcLabel(FCLabels.byContinuingYouAgreeToOur,
                            "FarmerChat uses AI. By continuing, you agree to our")
        let alsoSee = fcLabel(FCLabels.alsoSee, "also see")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        func link(_ text: String, _ url: URL) -> AttributedString {
            var run = AttributedString(text)
            run.link = url
            run.underlineStyle = .single
            // Without an explicit colour a linked run renders in the accent tint.
            run.foregroundColor = theme.content.foregroundPrimary
            return run
        }

        var paragraph = AttributedString(intro + " ")
        paragraph += link(fcLabel(FCLabels.termsOfUse, "Terms of use"), Self.termsLink)
        paragraph += AttributedString(" ")
        // The connector is served (`fc_v2_app_label_also_see` = "also see" on DEV). A tenant
        // that serves it empty gets the two links separated by one space, as the app degrades.
        if !alsoSee.isEmpty {
            paragraph += AttributedString(alsoSee + " ")
        }
        paragraph += link(fcLabel(FCLabels.privacyPolicy, "Privacy policy"), Self.privacyLink)
        paragraph += AttributedString(".")
        return paragraph
    }

    private var legalText: some View {
        Text(legalParagraph)
            .fcTextStyle(theme.typography.bodySmall)
            .foregroundColor(theme.content.foregroundSecondary)
            .multilineTextAlignment(.leading)
            .frame(maxWidth: 260)
            .environment(\.openURL, OpenURLAction { url in
                switch url {
                case Self.termsLink:
                    if let target = viewModel.state.termsOfUseUrl {
                        router.openLegal(url: target,
                                         title: fcLabel(FCLabels.termsOfUse, "Terms of use"))
                    }
                case Self.privacyLink:
                    if let target = viewModel.state.privacyPolicyUrl {
                        router.openLegal(url: target,
                                         title: fcLabel(FCLabels.privacyPolicy, "Privacy policy"))
                    }
                default:
                    return .systemAction
                }
                return .handled
            })
    }

}
