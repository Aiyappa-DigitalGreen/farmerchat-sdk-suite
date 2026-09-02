// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FarmerChatUIKit",
    platforms: [
        .iOS(.v15),
        .macOS(.v12) // dependency alignment only; the library is iOS-only
    ],
    products: [
        .library(name: "FarmerChatUIKit", targets: ["FarmerChatUIKit"])
    ],
    dependencies: [
        .package(path: "../FarmerChatCore")
    ],
    targets: [
        .target(
            name: "FarmerChatUIKit",
            dependencies: ["FarmerChatCore"],
            path: "Sources/FarmerChatUIKit"
        )
    ]
)
