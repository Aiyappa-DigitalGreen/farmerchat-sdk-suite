import SwiftUI
import FarmerChatCore

/// Port of LocationPromptHost: global non-blocking overlay driven by
/// `LocationPromptManager.state`. Interstitial → permission → fetch →
/// recovery (settings sheet) / error, with weather-flow keeping the
/// interstitial visible during fetch.
struct LocationPromptHostView: View {
    @Environment(\.fcTheme) private var theme
    @Environment(\.scenePhase) private var scenePhase
    @ObservedObject var manager: LocationPromptManager

    var body: some View {
        ZStack {
            switch manager.state {
            case .idle:
                EmptyView()

            case .interstitial:
                interstitial(loading: false)

            case .requestPermission, .requestEnableGps, .fetchingLocation:
                // Weather and the 2.0.0 chat capability chip keep the interstitial overlay
                // (loading CTA) — Compose's host keeps it for every source; widget/deeplink are
                // silent triggers by design and show nothing.
                if manager.source == .weather || manager.source == .localContext {
                    interstitial(loading: true)
                }

            case .recovery:
                recoverySheet

            case .error(let errorType):
                errorScreen(errorType)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: manager.state)
        .onChange(of: scenePhase) { phase in
            if phase == .active {
                manager.onAppForeground()
            }
        }
    }

    private func interstitial(loading: Bool) -> some View {
        FCFullScreenMessage(
            title: fcLabel("location_title", "Share Location"),
            subtitle: fcLabel("location_subtitle", "Get weather alerts and advice specific to your farm's location"),
            illustration: .lookingAtPhone,
            primaryTitle: loading
                ? fcLabel("location_fetching", "Getting your location…")
                : fcLabel("location_share_cta", "Share location"),
            primaryLoading: loading,
            onPrimary: { manager.shareLocationTapped() },
            secondaryTitle: fcLabel("skip", "Skip"),
            onSecondary: { manager.skipTapped() },
            onClose: { manager.skipTapped() }
        )
        .onAppear {
            FarmerChat.shared.analytics.screenViewed(ScreenNames.locationPrompt)
        }
    }

    private var recoverySheet: some View {
        ZStack(alignment: .bottom) {
            theme.content.scrim
                .ignoresSafeArea()
                .onTapGesture { manager.dismissError() }

            VStack(spacing: 16) {
                Capsule()
                    .fill(theme.content.borderDefault)
                    .frame(width: 42, height: 5)
                    .padding(.top, 10)
                Image(systemName: "location.slash")
                    .font(.system(size: 36))
                    .foregroundColor(theme.content.foregroundSecondary)
                Text(fcLabel("location_recovery_title", "We need your location"))
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(theme.content.foregroundPrimary)
                Text(fcLabel("location_recovery_message", "Location access is turned off. Turn it on in Settings to get local advice."))
                    .font(.system(size: 15))
                    .foregroundColor(theme.content.foregroundSecondary)
                    .multilineTextAlignment(.center)
                FCPrimaryButton(title: fcLabel("location_open_settings", "Turn on in settings")) {
                    manager.recoveryConfirmed()
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                }
                FCSecondaryButton(title: fcLabel("cancel", "Cancel")) {
                    manager.dismissError()
                }
            }
            .padding(20)
            .padding(.bottom, 16)
            .frame(maxWidth: .infinity)
            .background(theme.content.surfacePrimary)
            .clipShape(UnevenRoundedRectangle(topLeadingRadius: 24, topTrailingRadius: 24))
        }
    }

    private func errorScreen(_ errorType: LocationErrorType) -> some View {
        let title: String
        let message: String
        switch errorType {
        case .noNetwork:
            title = fcLabel("no_internet_title", "No internet connection")
            message = fcLabel("no_internet_message", "You appear to be offline. Check your connection and try again.")
        case .gpsUnavailable:
            title = fcLabel("location_gps_unavailable_title", "Location is turned off")
            message = fcLabel("location_gps_unavailable_message", "Turn on Location Services to share your farm's location.")
        case .locationFailed:
            title = fcLabel("location_failed_title", "Couldn't get your location")
            message = fcLabel("location_failed_message", "We couldn't find your location. Please try again.")
        }
        return FCFullScreenMessage(
            title: title,
            subtitle: message,
            illustration: .lookingAtSky,
            primaryTitle: fcLabel("try_again", "Try again"),
            enablePrimaryDebounce: true,
            onPrimary: { manager.shareLocationTapped() },
            secondaryTitle: fcLabel("skip", "Skip"),
            onSecondary: { manager.dismissError() }
        )
    }
}
