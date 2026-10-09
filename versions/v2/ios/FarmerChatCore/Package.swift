// swift-tools-version: 5.9
// FarmerChat iOS SDK — Core. Package version is set by the git tag
// (ios-v2.2.0); the single source of the version string is
// FarmerChatSDK.version ("2.2.0"). Source (path/URL) consumers use THIS
// manifest; binary (.xcframework) consumers use ../Package.binary.swift.
import PackageDescription

let package = Package(
    name: "FarmerChatCore",
    platforms: [
        .iOS(.v15),
        .macOS(.v12) // allows headless `swift build` verification on macOS hosts
    ],
    products: [
        .library(name: "FarmerChatCore", targets: ["FarmerChatCore"])
    ],
    targets: [
        .target(
            name: "FarmerChatCore",
            path: "Sources/FarmerChatCore"
        ),
        .testTarget(
            name: "FarmerChatCoreTests",
            dependencies: ["FarmerChatCore"],
            path: "Tests/FarmerChatCoreTests"
        )
    ]
)
