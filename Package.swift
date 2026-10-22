// swift-tools-version: 5.9
//
// Swift Package Manager entry for the FarmerChat iOS SDK (v2), published the same way as Android:
// from this repository, by the release tag (`v2.2.0`), with no extra repository or account.
//
//   .package(url: "https://github.com/digitalgreenorg/farmerchat-sdk-suite", from: "2.2.0")
//
// Products: FarmerChatCore (no UI), FarmerChatSwiftUI, FarmerChatUIKit. The package builds for
// iOS 15; FarmerChatSwiftUI's views are `@available(iOS 16, *)` (NavigationStack), so an iOS 15 host
// guards them with `if #available(iOS 16, *)` or uses FarmerChatUIKit.
//
// Sources stay in versions/v2/ios/<Package>/; each of those folders keeps its own Package.swift for
// local development and CI. Keep the targets and resources here in step with them.
import PackageDescription

let ios = "versions/v2/ios"

let package = Package(
    name: "FarmerChat",
    platforms: [
        .iOS(.v15)
    ],
    products: [
        .library(name: "FarmerChatCore", targets: ["FarmerChatCore"]),
        .library(name: "FarmerChatSwiftUI", targets: ["FarmerChatSwiftUI"]),
        .library(name: "FarmerChatUIKit", targets: ["FarmerChatUIKit"])
    ],
    targets: [
        .target(
            name: "FarmerChatCore",
            path: "\(ios)/FarmerChatCore/Sources/FarmerChatCore",
            resources: [
                .copy("PrivacyInfo.xcprivacy"),
                .copy("Resources/FarmerIllustrations")
            ]
        ),
        .target(
            name: "FarmerChatSwiftUI",
            dependencies: ["FarmerChatCore"],
            path: "\(ios)/FarmerChatSwiftUI/Sources/FarmerChatSwiftUI",
            resources: [.copy("PrivacyInfo.xcprivacy")]
        ),
        .target(
            name: "FarmerChatUIKit",
            dependencies: ["FarmerChatCore"],
            path: "\(ios)/FarmerChatUIKit/Sources/FarmerChatUIKit",
            resources: [.copy("PrivacyInfo.xcprivacy")]
        )
    ]
)
