import SwiftUI
import FarmerChatCore

/// Port of EnterNameScreen + EnterNameRoute: normalized name input, Save name
/// (Loading/Chevron), animated Skip (hidden once text typed),
/// min-3/max-100 validation with error toast, routeFromSplash on success.
struct EnterNameView: View {
    @Environment(\.fcTheme) private var theme
    @EnvironmentObject var router: FCRouter
    @StateObject private var viewModel = EnterNameViewModel()
    @StateObject private var profileVM = UserProfileViewModel()
    @StateObject private var toast = FCToastState()
    @State private var name = ""
    @State private var didAppear = false

    var body: some View {
        VStack(spacing: 0) {
            // App parity (EnterNameScreen.kt:116-119): 32 pt, tinted borderActive (brand GREEN).
            FCLogoMark(size: 32, tint: theme.content.borderActive)
                .padding(.top, 40)

            Text(fcLabel(FCLabels.whatShouldWeCallYou, "What should we call you?"))
                // App parity: titleLarge = 22/700, not 24.
                .fcTextStyle(theme.typography.titleLarge)
                .foregroundColor(theme.content.foregroundPrimary)
                .multilineTextAlignment(.center)
                .padding(.top, 20)

            Text(fcLabel(FCLabels.weGreetYouName, "We'll greet you by your name"))
                .fcTextStyle(theme.typography.bodyMedium)
                .foregroundColor(theme.content.foregroundSecondary)
                .multilineTextAlignment(.center)
                .padding(.top, 6)

            FCTextField(
                placeholder: fcLabel(FCLabels.yourNameOrNickname, "Your name or nickname"),
                text: Binding(
                    get: { name },
                    set: { name = NameInputNormalizer.normalize($0) }
                ),
                autoFocus: true
            )
            .padding(.top, 28)

            Spacer()

            FCPrimaryButton(
                title: viewModel.state.updateUserNameState.isLoading
                    ? fcLabel(FCLabels.saving, "Saving")
                    : fcLabel(FCLabels.saveName, "Save name"),
                state: viewModel.state.updateUserNameState.isLoading
                    ? .loading
                    : (name.trimmingCharacters(in: .whitespaces).isEmpty ? .normal : .chevron),
                enabled: !name.trimmingCharacters(in: .whitespaces).isEmpty,
                action: save,
                height: 56
            )

            if name.isEmpty {
                FCSecondaryButton(title: fcLabel(FCLabels.skipForNow, "Skip for now"), height: 56) {
                    viewModel.skipName()
                    router.routeFromSplash()
                }
                .padding(.top, 12)
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
        .frame(maxWidth: .infinity)
        .animation(.easeInOut(duration: 0.25), value: name.isEmpty)
        .padding(.horizontal, 20)
        .padding(.bottom, 16)
        .background(theme.content.surfacePrimary.ignoresSafeArea())
        .fcToastHost(toast)
        .task {
            guard !didAppear else { return }
            didAppear = true
            let env = FarmerChat.shared
            env.analytics.screenViewed(ScreenNames.enterName)
            // Prefer server name when logged in.
            if env.session.isAuthenticated {
                profileVM.fetchProfile(fromScreen: "name")
            }
            name = NameInputNormalizer.sanitizeStored(env.prefs.string(.userName))
        }
        .onChange(of: profileVM.profileState.value?.userProfile?.displayName) { serverName in
            let sanitized = NameInputNormalizer.sanitizeStored(serverName)
            if !sanitized.isEmpty {
                name = NameInputNormalizer.normalize(sanitized)
            }
        }
        .onChange(of: viewModel.state.updateUserNameState.isSuccess) { success in
            guard success else { return }
            viewModel.markNameDone()
            viewModel.onAction(.consumeUpdateResult, screenName: ScreenNames.enterName)
            FarmerChat.shared.analytics.screenExited(ScreenNames.enterName)
            router.routeFromSplash()
        }
        .onChange(of: errorMessage) { message in
            if let message {
                toast.show(.error, message)
                viewModel.onAction(.consumeUpdateResult, screenName: ScreenNames.enterName)
            }
        }
    }

    private var errorMessage: String? {
        if case .error(let message, _, _) = viewModel.state.updateUserNameState {
            return message
        }
        return nil
    }

    private func save() {
        if let validation = NameInputNormalizer.validationError(for: name, labels: FarmerChat.shared.labels) {
            toast.show(.error, validation)
            return
        }
        guard let userId = FarmerChat.shared.session.userId else {
            toast.show(.error, fcLabel(FCLabels.somethingWentWrongPleaseTryAgain, "Something went wrong. Please try again."))
            return
        }
        viewModel.onAction(
            .updateUserName(body: UserNameRequest(userId: userId, name: name.trimmingCharacters(in: .whitespaces))),
            screenName: ScreenNames.enterName
        )
    }
}
