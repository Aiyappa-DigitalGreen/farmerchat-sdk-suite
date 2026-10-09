import SwiftUI
import FarmerChatCore

/// Port of SplashScreen: full-bleed brand background + rotating logo
/// (holds ~3 s then spins), "starting" toast after 2 s, min-duration delay,
/// APP_OPENED analytics, then `onReady` unless an error is pending.
struct SplashView: View {
    @EnvironmentObject var router: FCRouter
    @State private var rotation: Double = 0
    @State private var showStartingToast = false
    @State private var didFire = false

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [FCPrimitive.green800, FCPrimitive.green950],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            FCLogoMark(size: 96, tint: .white)
                .rotationEffect(.degrees(rotation))

            if showStartingToast {
                VStack {
                    Spacer()
                    FCToastView(toast: FCToastData(
                        kind: .loading,
                        message: fcLabel(FCLabels.farmerchatStarting, "FarmerChat is Starting...")
                    ))
                    .padding(.bottom, 48)
                }
            }
        }
        .task {
            guard !didFire else { return }
            didFire = true
            let env = FarmerChat.shared

            env.analytics.screenViewed(ScreenNames.splash)
            env.analytics.track(AnalyticsEvents.appOpened, props: ["build_version": "V2"])
            env.prefs.setBool(true, .isProfileLoaded)

            // Rotating logo: hold, then spin (keyframe parity).
            Task {
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) {
                    rotation = 360
                }
            }
            // "Starting…" toast after 2 s.
            Task {
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                withAnimation { showStartingToast = true }
            }

            // CHAT_ONLY: every journey start is a fresh conversation (unless opening a thread).
            if env.config.mode == .chatOnly {
                env.beginChatOnlyJourney()
            }

            // Bootstrap: guest session (idempotent) then min-duration delay.
            _ = await env.session.ensureGuestSession()
            // CHAT_ONLY skips onboarding, so run its label/language work headlessly
            // (best-effort, no-op once server labels exist).
            // Only once a guest session exists, so a failed init reaches the error route fast.
            if env.config.mode == .chatOnly, env.session.userId != nil {
                await env.ensureChatOnlyBootstrap()
            }
            try? await Task.sleep(nanoseconds: 200_000_000)

            guard !router.errorNavigation.hasPendingError else { return }
            env.analytics.screenExited(ScreenNames.splash)
            router.routeFromSplash()
        }
    }
}
