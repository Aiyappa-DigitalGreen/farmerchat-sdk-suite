// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FarmerChatSwiftUI",
    platforms: [
        .iOS(.v16),
        .macOS(.v12) // dependency alignment only; the library is iOS-only
    ],
    products: [
        .library(name: "FarmerChatSwiftUI", targets: ["FarmerChatSwiftUI"])
    ],
    dependencies: [
        .package(path: "../FarmerChatCore")
    ],
    targets: [
        .target(
            name: "FarmerChatSwiftUI",
            dependencies: ["FarmerChatCore"],
            path: "Sources/FarmerChatSwiftUI"
        )
    ]
)
