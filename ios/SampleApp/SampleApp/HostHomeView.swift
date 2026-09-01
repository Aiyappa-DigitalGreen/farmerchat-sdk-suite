import SwiftUI
import Combine
import FarmerChatCore
import FarmerChatSwiftUI
import FarmerChatUIKit

/// Demonstrates all three entry styles:
/// 1. SwiftUI `FarmerChatView()` presented full-screen.
/// 2. UIKit `FarmerChatViewController` (native UIKit screens, iOS 15 path).
/// 3. Deep-link style `FarmerChat.openChat(question:)`.
struct HostHomeView: View {
    @State private var showSwiftUIFlow = false
    @State private var showUIKitFlow = false
    @State private var isAuthenticated = FarmerChat.shared.isAuthenticated

    var body: some View {
        NavigationStack {
            List {
                Section("Launch") {
                    Button("Open FarmerChat (SwiftUI)") {
                        showSwiftUIFlow = true
                    }
                    Button("Open FarmerChat (UIKit-native)") {
                        showUIKitFlow = true
                    }
                    Button("Deep link: openChat(question:)") {
                        FarmerChat.shared.openChat(question: "How do I protect my maize from armyworm?")
                        showSwiftUIFlow = true
                    }
                }
                // "Log out" is intentionally hidden: the demo surface is the launch
                // entry points above plus the FAB. FarmerChat.shared.logout() remains
                // public API and is unaffected.
                Section("Session") {
                    LabeledContent("Authenticated", value: isAuthenticated ? "Yes" : "No")
                }
            }
            .navigationTitle("FarmerChat SDK Demo")
        }
        .fullScreenCover(isPresented: $showSwiftUIFlow) {
            FarmerChatView()
        }
        .fullScreenCover(isPresented: $showUIKitFlow) {
            UIKitFlowHost()
                .ignoresSafeArea()
        }
        .onReceive(FarmerChat.shared.onAuthStateChanged.receive(on: DispatchQueue.main)) { value in
            isAuthenticated = value
        }
        .onAppear {
            // Automation/UI-test hooks: `-fcAutoOpen` presents the SDK
            // immediately; `-fcAutoOpenChat` also deep-links into Chat;
            // `-fcAutoOnboard` completes language onboarding (real server
            // calls through the public OnboardingViewModel) before opening;
            // `-fcUIKit` presents the native UIKit flow instead of SwiftUI.
            let args = ProcessInfo.processInfo.arguments
            if args.contains("-fcAutoOnboard") {
                autoOnboardThenOpen()
            } else if args.contains("-fcUIKit") {
                showUIKitFlow = true
            } else if args.contains("-fcAutoOpenChat") {
                FarmerChat.shared.openChat(question: "How do I protect my maize from armyworm?")
                showSwiftUIFlow = true
            } else if args.contains("-fcAutoOpen") {
                showSwiftUIFlow = true
            }
        }
    }

    /// Automation hook: performs the real language-onboarding flow (guest
    /// init + geolocate + languages + set_preferred_language) through the
    /// public OnboardingViewModel, then presents the SDK.
    private func autoOnboardThenOpen() {
        Task { @MainActor in
            let vm = OnboardingViewModel()
            await vm.bootstrapLanguages()
            if case .success = vm.state.languageState,
               let english = vm.state.visibleLanguages().first(where: { $0.code == "en" })
                ?? vm.state.visibleLanguages().first {
                vm.onAction(.selectLanguage(languageId: english.id))
                vm.onAction(.acceptTerms)
                vm.onAction(.getStartedClicked)
                var waited = 0
                while !vm.state.languageSubmitSuccess && waited < 40 {
                    try? await Task.sleep(nanoseconds: 500_000_000)
                    waited += 1
                }
            }
            let args = ProcessInfo.processInfo.arguments
            if args.contains("-fcAutoOpenChat") {
                FarmerChat.shared.openChat(question: "How do I protect my maize from armyworm?")
            }
            // Present the UIKit-native flow (onboarding already complete →
            // its splash routes straight to Home).
            if args.contains("-fcUIKit") {
                showUIKitFlow = true
            } else {
                showSwiftUIFlow = true
            }
        }
    }
}

/// Hosts the UIKit-native entry inside SwiftUI (what a pure-UIKit host would
/// do directly with `present(FarmerChatViewController(), animated: true)`).
struct UIKitFlowHost: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> FarmerChatViewController {
        FarmerChatViewController()
    }

    func updateUIViewController(_ uiViewController: FarmerChatViewController, context: Context) {}
}
