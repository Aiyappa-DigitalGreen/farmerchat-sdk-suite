// swift-tools-version: 5.9
//
// BINARY distribution manifest variant for the FarmerChat iOS SDK.
//
// The three products are backed by prebuilt .xcframeworks produced by
// `./build-xcframework.sh` (output under ios/dist/). This is the manifest a
// *binary* distribution repository would ship as its `Package.swift`: consumers
// resolve the package by git URL + tag and receive compiled frameworks, never
// the source. `FarmerChatSwiftUI` / `FarmerChatUIKit` each bundle the Core
// binary target too, so a consumer links a single product.
//
// For a remote binary release, swap `path:` for `url:` + `checksum:` on each
// binaryTarget (checksum via `swift package compute-checksum X.xcframework.zip`).
//
// Version: 2.2.0 (FarmerChatCore FarmerChatSDK.version).
import PackageDescription

let package = Package(
    name: "FarmerChat",
    platforms: [
        .iOS(.v15)
    ],
    products: [
        .library(name: "FarmerChatCore", targets: ["FarmerChatCoreBinary"]),
        .library(name: "FarmerChatSwiftUI", targets: ["FarmerChatSwiftUIBinary", "FarmerChatCoreBinary"]),
        .library(name: "FarmerChatUIKit", targets: ["FarmerChatUIKitBinary", "FarmerChatCoreBinary"])
    ],
    targets: [
        .binaryTarget(name: "FarmerChatCoreBinary", path: "dist/FarmerChatCore.xcframework"),
        .binaryTarget(name: "FarmerChatSwiftUIBinary", path: "dist/FarmerChatSwiftUI.xcframework"),
        .binaryTarget(name: "FarmerChatUIKitBinary", path: "dist/FarmerChatUIKit.xcframework")
    ]
)
