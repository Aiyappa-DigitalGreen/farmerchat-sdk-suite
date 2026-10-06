import SwiftUI
import FarmerChatCore

/// Port of the app's `ui/location/LocationPromptHost.kt` (fc-compose-agentic): a global overlay
/// driven by `LocationPromptManager.state`.
///
/// Only the WEATHER entry ever shows the full-screen interstitial. While the system dialog / GPS
/// check / fetch run, Weather keeps the interstitial up but INERT (no back/skip, CTA disabled);
/// every other source (the chat gps-prompt chip, campaigns) shows nothing, so the system dialog
/// appears over the current screen. The permission dialog and the fix are driven by the manager
/// itself (iOS has no Activity-scoped launcher to hand them to).
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
                interstitial(inert: false, fetching: false)

            case .requestPermission, .requestEnableGps, .fetchingLocation:
                if manager.source == .weather {
                    interstitial(inert: true, fetching: manager.state == .fetchingLocation)
                }

            case .recovery:
                // Weather: the sheet sits over the inert interstitial.
                if manager.source == .weather {
                    interstitial(inert: true, fetching: false)
                }
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

    // MARK: - Interstitial (Weather only)

    private func interstitial(inert: Bool, fetching: Bool) -> some View {
        FCFullScreenMessage(
            title: fcLabel(FCLabels.getAdviceYourArea, "Get advice for your area"),
            subtitle: fcLabel(
                FCLabels.locationHelpsSuggestions,
                "Your location helps us suggest crops, weather, and pests near you."
            ),
            illustration: .lookingAtPhone,
            primaryTitle: fetching
                ? fcLabel(FCLabels.gettingYourLocation, "Getting your location...")
                : fcLabel(FCLabels.shareLocation, "Share Location"),
            primaryLoading: fetching,
            onPrimary: { if !inert { manager.shareLocationTapped() } },
            barTitle: fcLabel(FCLabels.shareLocation, "Share Location"),
            onBack: inert ? nil : { manager.cancel() },
            rightLabel: inert ? nil : fcLabel(FCLabels.skip, "Skip"),
            onRight: inert ? nil : { manager.skipTapped() },
            primaryChevron: true
        )
        // Swallow every touch so nothing reaches the screen underneath.
        .contentShape(Rectangle())
    }

    // MARK: - Recovery sheet ("We need your location")

    private var recoverySheet: some View {
        ZStack(alignment: .bottom) {
            theme.content.scrim
                .ignoresSafeArea()
                .onTapGesture { manager.recoveryClosed() }

            VStack(spacing: 12) {
                ZStack(alignment: .topTrailing) {
                    // The app shows the country `farmer_looking_at_phone_square` image here. The
                    // iOS packages are asset-free (FCIllustration uses SF symbols), so the same
                    // 382pt slot carries the looking-at-phone symbol on the brand green.
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .fill(FCPrimitive.green800)
                        .overlay(
                            Image(systemName: FCIllustration.lookingAtPhone.symbol)
                                .font(.system(size: 120, weight: .light))
                                .foregroundColor(FCPrimitive.green500)
                        )
                        .frame(maxWidth: .infinity)
                        .frame(height: 382)

                    Button(action: { manager.recoveryClosed() }) {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.black)
                            .frame(width: 44, height: 44)
                            .background(Color.white)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(fcLabel(FCLabels.close, "Close"))
                    .padding(12)
                }

                Spacer().frame(height: 4)

                Text(fcLabel(FCLabels.weNeedYourLocation, "We need your location"))
                    .fcTextStyle(theme.typography.titleLarge)
                    .fontWeight(.semibold)
                    .foregroundColor(.black)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                Text(fcLabel(
                    FCLabels.locationTailorAdvice,
                    "Sharing your location helps FarmerChat tailor advice to your farm."
                ))
                    .fcTextStyle(theme.typography.bodyMedium)
                    .foregroundColor(.black)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                FCPrimaryButton(
                    title: fcLabel(FCLabels.turnOnInSettings, "Turn on in settings"),
                    state: .chevron,
                    action: {
                        manager.recoveryConfirmed()
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    },
                    height: 56
                )
                Spacer().frame(height: 8)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .frame(maxWidth: .infinity)
            .background(
                FCPrimitive.neutral150
                    .clipShape(UnevenRoundedRectangle(topLeadingRadius: 24, topTrailingRadius: 24))
                    .ignoresSafeArea(edges: .bottom)
            )
            .gesture(
                DragGesture(minimumDistance: 20).onEnded { value in
                    if value.translation.height > 80 { manager.recoveryClosed() }
                }
            )
            .transition(.move(edge: .bottom))
        }
    }

    // MARK: - Error screens (no back / skip)

    private func errorScreen(_ errorType: LocationErrorType) -> some View {
        let barTitle: String
        let main: String
        let sub: String
        let illustration: FCIllustration
        switch errorType {
        case .noNetwork:
            barTitle = fcLabel(FCLabels.noInternetConnection, "No internet connection")
            main = fcLabel(FCLabels.farmerchatNeedsTheInternet, "FarmerChat needs \nthe internet")
            // Not in the generated FCLabels (it mirrors an older Labels.kt); the served key from
            // Android `Labels.CHECK_MOBILE_DATA_WIFI_SIGNAL`, through the usual fallback.
            sub = fcLabel("fc_v2_app_label_check_mobile_data_wi-fi_signal", "Check mobile data or Wi-Fi signal")
            illustration = .lookingAtSky
        case .gpsUnavailable:
            barTitle = fcLabel(FCLabels.turnOnGps, "Turn on GPS")
            main = fcLabel(FCLabels.getLocalAdvice, "Get local advice")
            sub = fcLabel(
                FCLabels.locationGpsTurnedOffTurningHelps,
                "Location and GPS are turned off. Turning this on helps us tailor answers to your area."
            )
            illustration = .lookingAtPhone
        case .locationFailed:
            barTitle = fcLabel(FCLabels.somethingWentWrong, "Something went wrong")
            main = fcLabel(FCLabels.couldntGetYourLocation, "Couldn't get your location")
            sub = fcLabel(FCLabels.pleaseTryAgain, "Please try again.")
            illustration = .lookingAtPhone
        }
        return FCFullScreenMessage(
            title: main,
            subtitle: sub,
            illustration: illustration,
            primaryTitle: fcLabel(FCLabels.tryAgain, "Try again"),
            enablePrimaryDebounce: true,
            onPrimary: { manager.onErrorCta() },
            barTitle: barTitle
        )
    }
}
