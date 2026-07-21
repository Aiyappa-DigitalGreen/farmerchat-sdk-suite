import SwiftUI
import FarmerChatCore   // from FarmerChatCore.xcframework (binary)
import FarmerChatSwiftUI // from FarmerChatSwiftUI.xcframework (binary)
import FarmerChatUIKit  // from FarmerChatUIKit.xcframework (binary)

/// Consumer app that depends on the SDK ONLY as prebuilt .xcframework binaries.
/// It never references the in-repo source packages. This is the binary-artifact
/// consumption proof required by docs/07 Part A.
@main
struct ConsumerApp: App {
    init() {
        // Public API surface, resolved from the binary .swiftinterface:
        FarmerChat.initialize(config: FarmerChatConfig(
            environment: .dev,
            appearance: .auto,
            theme: FarmerChatTheme(brandPrimary: Color(hex: 0x1565C0)),
            onEvent: { name, props in print("[binary-consumer] \(name) \(props)") }
        ))
        // Networking internals (APIClient, TokenRefresher, KeychainTokenStore,
        // DeviceInfoProvider, HTTPMethod) are `internal` in Core and therefore
        // NOT visible here — attempting to reference them would fail to compile,
        // which is the API-hardening guarantee.
        _ = FarmerChat.isInitialized
        _ = FarmerChat.shared.config.environment
        _ = FarmerChatSDK.version
    }

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                List {
                    // C1 inline embeddable view from the SwiftUI binary.
                    Section("Inline (binary FarmerChatSwiftUI)") {
                        NavigationLink("Open inline chat") {
                            FarmerChatInlineView()
                        }
                    }
                    Section("Full-screen launch") {
                        NavigationLink("SwiftUI journey") { FarmerChatView() }
                    }
                    Section("Programmatic API") {
                        Button("sendQuestion") {
                            FarmerChat.shared.sendQuestion("How do I treat leaf rust?")
                        }
                    }
                }
                .navigationTitle("Binary Consumer")
            }
        }
    }
}
