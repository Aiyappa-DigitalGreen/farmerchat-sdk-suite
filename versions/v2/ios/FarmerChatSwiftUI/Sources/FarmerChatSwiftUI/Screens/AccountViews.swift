import SwiftUI
import FarmerChatCore

/// AccountBenefits interstitial (port of the inline FullScreenMessage in
/// AppNavGraph): "Sign up" / "Save your questions and answers" + Skip.
struct AccountBenefitsView: View {
    @EnvironmentObject var router: FCRouter
    @State private var didAppear = false

    var body: some View {
        FCFullScreenMessage(
            title: fcLabel(FCLabels.signUp, "Sign up"),
            subtitle: fcLabel(FCLabels.saveYourQuestionsAnswers, "Save your past questions"),
            illustration: .lookingAtCamera,
            primaryTitle: fcLabel(FCLabels.signUpPhoneNumber, "Sign up with phone number"),
            onPrimary: { router.push(.auth) },
            secondaryTitle: fcLabel(FCLabels.skip, "Skip"),
            onSecondary: { router.pop() },
            onClose: { router.pop() }
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
        FCFullScreenMessage(
            title: fcLabel(FCLabels.youreAllSet, "You're all set!"),
            subtitle: fcLabel("account_success_subtitle", "Your questions and answers are now saved to your account"),
            illustration: .lookingAtSky,
            primaryTitle: fcLabel(FCLabels.continue, "Continue"),
            onPrimary: {
                FarmerChat.shared.analytics.track(AnalyticsEvents.signupContinueClicked)
                router.onAccountSuccessContinue()
            }
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
        FCFullScreenMessage(
            title: isNetworkError
                ? fcLabel(FCLabels.noInternetConnection, "No internet connection")
                : fcLabel(FCLabels.somethingWentWrong, "Something went wrong"),
            subtitle: isNetworkError
                ? fcLabel("no_internet_message", "You appear to be offline. Check your connection and try again.")
                : fcLabel("api_error_message", "We're having trouble right now. Please try again."),
            illustration: .lookingAtSky,
            primaryTitle: fcLabel(FCLabels.tryAgain, "Try again"),
            enablePrimaryDebounce: true,
            onPrimary: { router.onErrorTryAgain(fromScreen: fromScreen) }
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
