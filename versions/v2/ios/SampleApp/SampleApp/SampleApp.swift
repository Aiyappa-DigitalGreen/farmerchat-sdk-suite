import SwiftUI
import FarmerChatCore
import FarmerChatSwiftUI

/// Sample host app. Add this file set to an iOS App target (iOS 16+) with the
/// local packages FarmerChatCore, FarmerChatSwiftUI and FarmerChatUIKit —
/// see SampleApp/README.md.
@main
struct SampleApp: App {
    init() {
        // Optional host theme (docs/07 Part B). `-fcThemeBlue` swaps the green
        // brand for a host blue palette to demonstrate theming.
        let theme: FarmerChatTheme? = ProcessInfo.processInfo.arguments.contains("-fcThemeBlue")
            ? FarmerChatTheme(
                brandPrimary: Color(hex: 0x1565C0),      // app bars / brand surfaces
                brandPrimaryDark: Color(hex: 0x0D47A1),  // primary buttons / input tiles
                brandAccent: Color(hex: 0x42A5F5),       // chevrons / active dot / spinner
                onBrand: .white,
                cardCornerRadius: 16,
                buttonCornerRadius: 12
              )
            : nil

        let args = ProcessInfo.processInfo.arguments
        // `-fcMock` points the SDK at the local mock backend (tools/mock-server)
        // so chat answers, OTP, voice transcribe/synthesise and the SSFR feed
        // resolve deterministically for e2e verification. Otherwise use dev.
        let mockURL = args.contains("-fcMock") ? "http://localhost:8899/" : nil
        // C3: the SDK defaults to CHAT_ONLY. `-fcFullJourney` opts in to onboarding + Home +
        // drawer; the onboarding/drawer automation hooks in HostHomeView need it.
        let fullJourney = args.contains("-fcFullJourney")

        // 1. Initialize the SDK once, as early as possible.
        FarmerChat.initialize(config: FarmerChatConfig(
            environment: .dev,
            customBaseURL: mockURL,
            // farmerChatApiKey / geoApiKey: both built in — pass only to override.
            appearance: .auto,
            theme: theme,
            languageCode: nil,                 // preselect to skip language screen
            enableVoice: true,
            enableImages: true,
            enableWeather: true,
            mode: fullJourney ? .fullJourney : .chatOnly,
            stringOverrides: args.contains("-fcOverride")
                ? ["fc_v2_app_label_farmerchat_tagline": "HOST OVERRIDE tagline"]
                : [:],
            onEvent: { name, props in
                // 2. Forward SDK analytics into your own stack.
                print("[FarmerChat event] \(name) \(props)")
            },
            onSessionExpired: {
                print("[FarmerChat] session expired")
            }
        ))
    }

    var body: some Scene {
        WindowGroup {
            HostHomeView()
        }
    }
}
