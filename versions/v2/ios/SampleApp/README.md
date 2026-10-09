# FarmerChat iOS Sample App

Minimal host app showing `FarmerChat.initialize` plus presentation from both
SwiftUI (`FarmerChatView()`) and UIKit (`FarmerChatViewController`), and the
deep-link style `FarmerChat.openChat(question:)` entry.

## Run it (xcodegen — recommended)

```bash
brew install xcodegen        # once
cd ios/SampleApp
xcodegen generate            # creates SampleApp.xcodeproj from project.yml
open SampleApp.xcodeproj     # or build from the CLI:
xcodebuild -project SampleApp.xcodeproj -scheme SampleApp \
  -destination 'platform=iOS Simulator,name=iPhone 17' build
```

`project.yml` defines the app target (bundle id
`org.digitalgreen.farmerchat.sample`, iOS 16.0) with local SPM dependencies on
`../FarmerChatCore`, `../FarmerChatSwiftUI` and `../FarmerChatUIKit`, the
Info.plist usage descriptions from `ios/README.md` (mic, camera, photo
library, photo add, location), and ad-hoc signing (`CODE_SIGN_IDENTITY: "-"`)
— **required**: a completely unsigned simulator app cannot write to the
Keychain, so SDK tokens would silently fail to persist.

Verified end-to-end on an iPhone 17 simulator (iOS 26.1) against the live dev
environment (language onboarding, home feed, chat answer) on 2026-07-17.

## Manual alternative (Xcode UI)

1. Xcode → File → New → Project → iOS App
   - Product name: `SampleApp`, Interface: SwiftUI, iOS 16.0 deployment target.
2. Delete the generated `ContentView.swift` / `SampleAppApp.swift` and drag in
   `SampleApp/SampleApp.swift` and `SampleApp/HostHomeView.swift`.
3. File → Add Package Dependencies → Add Local…
   - `ios/FarmerChatCore`
   - `ios/FarmerChatSwiftUI`
   - `ios/FarmerChatUIKit`
   Link all three products to the app target.
4. Add the Info.plist usage descriptions listed in `ios/README.md`
   (microphone, camera, photo library, location).

## Configuration notes

- `farmerChatApiKey` and `geoApiKey` are **built into the SDK** and optional —
  the sample passes neither. Pass either only to override the built-in key.
- Mode: the SDK defaults to **chat-only** (lands directly in a fresh chat, no
  drawer; the chat bar carries the history and language icons; a first launch
  without `languageCode`/`locale` shows the language screen once first). Launch with
  `-fcFullJourney` for onboarding + Home + drawer — the onboarding/drawer
  automation hooks below assume it.
- Environment: `.dev`/`.stage`/`.demo`/`.prod`/`.eks` in `SampleApp.swift`.

## Automation hooks (launch arguments)

Used for scripted simulator runs (`xcrun simctl launch <udid>
org.digitalgreen.farmerchat.sample <flag>`):

- `-fcAutoOpen` — present `FarmerChatView()` immediately.
- `-fcAutoOpenChat` — call `openChat(question:)` first, then present.
- `-fcAutoOnboard` — complete real language onboarding through the public
  `OnboardingViewModel` (guest init + geolocate + languages +
  `set_preferred_language`), then present; combine with `-fcAutoOpenChat`.
