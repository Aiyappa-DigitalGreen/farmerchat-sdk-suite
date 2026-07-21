# iOS rules (adds to root CLAUDE.md — read that first)

- Packages: `FarmerChatCore` (iOS 15+, no UI), `FarmerChatSwiftUI` (iOS 16+), `FarmerChatUIKit` (iOS 15+, + podspec). Core holds all view models / state machines.
- Wire models: snake_case exactly as API sends (explicit CodingKeys or a shared decoder strategy — pick ONE approach and use it everywhere). `id`/`statement_id` can be Int OR String → use the shared `FlexibleID` type; any helper property wrapper (`@LossyOptional` etc.) must actually exist in Core and every model using it must compile.
- Trust `swift build`, not SourceKit: editor diagnostics like "No such module 'PackageDescription'" / "Cannot find type X in scope" for same-module types are indexing noise. BUT they can also mask real errors — the ONLY acceptable proof is a clean `swift build` (`xcrun swift build --sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" -Xswiftc -target -Xswiftc arm64-apple-ios15.0-simulator` or macOS-target build if simulator SDK unavailable). Run it, fix everything real, record the exact command + result in docs/04.
- Token store: Keychain for tokens, UserDefaults (prefix `fc_sdk_`) for the rest. 401 refresh in an actor (single-flight).
- Keep UIKit package genuinely usable on iOS 15 (no SwiftUI-only APIs in its public path).
- Mic/camera/photo/location usage descriptions are HOST responsibilities — document required Info.plist keys in ios/README.md; SDK must check availability gracefully.
