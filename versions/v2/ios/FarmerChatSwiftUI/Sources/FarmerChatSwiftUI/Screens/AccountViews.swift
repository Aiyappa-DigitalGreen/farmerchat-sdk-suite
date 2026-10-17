import SwiftUI
import FarmerChatCore

/// AccountBenefits interstitial (port of the inline FullScreenMessage in
/// AppNavGraph): "Sign up" / "Save your questions and answers" + Skip.
struct AccountBenefitsView: View {
    @EnvironmentObject var router: FCRouter
    @State private var didAppear = false

    var body: some View {
        // AppNavGraph.kt:760-830: bar "Sign up" with a round ArrowBack and a round "Skip"; the
        // farmer looking at the camera; "Save your questions and answers" / "We'll save your
        // chats…" (bodyLarge); a chevron "Sign up with phone number".
        FCFullScreenMessage(
            title: fcLabel(FCLabels.saveYourQuestionsAnswers, "Save your questions\nand answers"),
            subtitle: fcLabel(FCLabels.wellSaveYourChatsYouContinue, "We'll save your chats so you can continue later."),
            illustration: .lookingAtCamera,
            primaryTitle: fcLabel(FCLabels.signUpPhoneNumber, "Sign up with phone number"),
            onPrimary: { router.push(.auth) },
            barTitle: fcLabel(FCLabels.signUp, "Sign up"),
            onBack: { router.pop() },
            rightLabel: fcLabel(FCLabels.skip, "Skip"),
            onRight: { router.pop() },
            primaryChevron: true,
            subtitleLarge: true,
            roundedBarActions: true
        )
        .onAppear {
            guard !didAppear else { return }
            didAppear = true
            FarmerChat.shared.analytics.screenViewed(ScreenNames.accountBenefits)
        }
        .onDisappear {
            FarmerChat.shared.analytics.screenExited(ScreenNames.accountBenefits)
        }
    }
}

/// Port of AccountSuccessScreen: "You're all set!" + Continue → Home
/// (back also goes Home — the stack below was already reset).
struct AccountSuccessView: View {
    @EnvironmentObject var router: FCRouter
    @State private var didAppear = false

    var body: some View {
        // AccountSuccessScreen.kt:56-85.
        FCFullScreenMessage(
            title: fcLabel(FCLabels.youreAllSet, "You're all set!"),
            subtitle: fcLabel(FCLabels.previousQuestionsMenu, "Find your previous questions in the menu and continue anytime."),
            illustration: .lookingAtSky,
            primaryTitle: fcLabel(FCLabels.continue, "Continue"),
            onPrimary: {
                FarmerChat.shared.analytics.track(AnalyticsEvents.signupContinueClicked)
                router.onAccountSuccessContinue()
            },
            barTitle: fcLabel(FCLabels.signUp, "Sign up"),
            subtitleLarge: true
        )
        .onAppear {
            guard !didAppear else { return }
            didAppear = true
            FarmerChat.shared.analytics.screenViewed(ScreenNames.accountSuccess)
        }
        // BackHandler → Home parity: swipe-back is disabled for full-screen roots;
        // Continue is the only exit.
        .navigationBarBackButtonHidden(true)
    }
}

/// Port of ErrorScreen (NoInternetScreen.kt): NO_INTERNET vs API_ERROR copy,
/// LOOKING_AT_SKY illustration, primary debounce, per-source retry.
struct ErrorScreenView: View {
    @EnvironmentObject var router: FCRouter
    let isNetworkError: Bool
    let fromScreen: String

    var body: some View {
        // NoInternetScreen.kt ErrorScreen: bar title + main message + subtitle per error type.
        FCFullScreenMessage(
            title: isNetworkError
                ? fcLabel(FCLabels.farmerchatNeedsTheInternet, "FarmerChat needs \nthe internet")
                : fcLabel(FCLabels.farmerchatCouldntLoad, "FarmerChat couldn't load"),
            subtitle: isNetworkError
                ? fcLabel(FCLabels.checkMobileDataWifiSignal, "Check mobile data or Wi-Fi signal")
                : fcLabel(FCLabels.pleaseTryAgain, "Please try again"),
            illustration: .lookingAtSky,
            primaryTitle: fcLabel(FCLabels.tryAgain, "Try again"),
            enablePrimaryDebounce: true,
            onPrimary: { router.onErrorTryAgain(fromScreen: fromScreen) },
            barTitle: isNetworkError
                ? fcLabel(FCLabels.noInternetConnection, "No internet connection")
                : fcLabel(FCLabels.somethingWentWrong, "Something went wrong")
        )
        .onAppear {
            FarmerChat.shared.analytics.screenViewed(ScreenNames.error, extra: ["from_screen": fromScreen])
        }
        .onDisappear {
            FarmerChat.shared.analytics.screenExited(ScreenNames.error)
        }
    }
}

/// Port of LegalContent dialog (PolicyWebViewScreen): WebView with JS,
/// Close app bar, loading spinner.
struct LegalContentView: View {
    @Environment(\.fcTheme) private var theme
    @Environment(\.dismiss) private var dismiss
    let url: String
    let title: String
    @State private var isLoading = true

    var body: some View {
        VStack(spacing: 0) {
            FCAppBar(
                title: title,
                leading: .close,
                onLeadingTap: { dismiss() }
            )
            ZStack {
                if let parsed = URL(string: url) {
                    FCWebView(url: parsed, isLoading: $isLoading)
                } else {
                    Text(fcLabel(FCLabels.somethingWentWrongPleaseTryAgain, "Something went wrong. Please try again."))
                        .foregroundColor(theme.content.foregroundSecondary)
                }
                if isLoading {
                    FCLogoSpinner(message: fcLabel(FCLabels.loading, "Loading..."))
                        .background(theme.content.surfacePrimary)
                }
            }
        }
        .background(theme.content.surfacePrimary.ignoresSafeArea())
    }
}
