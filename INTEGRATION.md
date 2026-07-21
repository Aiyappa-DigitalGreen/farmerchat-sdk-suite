# FarmerChat SDK — Integration Quick-Starts

One entry point per platform; the SDK owns the whole journey (splash → language → name → home → chat) including phone+OTP auth and token lifecycle. Full options per platform are in each platform's README; behavior contract is in `docs/`.

## Shared concepts (all platforms)

```
initialize(config)      once at app startup
launch()                open the full FarmerChat journey
openChat(question | conversationId)   deep-link straight into chat
logout()                server logout + clear SDK state
isAuthenticated / onAuthStateChanged  OTP-verified state (guests = false)
setAnalyticsListener / config.onEvent every app-parity analytics event
config: environment dev|stage|demo|prod|eks · appearance day|night|auto ·
        geoApiKey · guestApiKey · enableVoice/Images/Weather · onSessionExpired
```

## Android — Compose host (`farmerchat-android-compose`)

```kotlin
// settings.gradle: include SDK modules or Maven coords org.digitalgreen:farmerchat-android-compose
// Application.onCreate
FarmerChat.initialize(this,
    FarmerChatConfig.builder(FarmerChatEnvironment.PROD)
        .appearance(FarmerChatAppearance.AUTO)
        .onEvent { name, props -> /* forward to your analytics */ }
        .build())
// anywhere
FarmerChat.launch(context)
FarmerChat.openChat(context, question = "How do I treat leaf rust?")

// or the zero-wiring floating bubble — put it in any Scaffold:
Scaffold(floatingActionButton = { FarmerChatFab() }) { ... }
// FarmerChatFab(question = "...") deep-links; FarmerChatFab(label = "Ask FarmerChat") renders extended
```
Working example: `android/sample-compose/`. XML hosts: depend on `farmerchat-android-views` instead — identical `FarmerChat` API (`launch()` resolves whichever UI artifact is present; Compose wins if both). XML FAB:

```xml
<org.digitalgreen.farmerchat.sdk.views.FarmerChatFab
    android:layout_width="wrap_content" android:layout_height="wrap_content"
    android:layout_gravity="bottom|end" android:layout_margin="16dp" />
```
Example: `android/sample-views/`. Host needs no manifest changes (SDK declares its Activity + FileProvider); camera/mic/location permissions are declared by the SDK and requested at use.

## iOS — SwiftUI (`FarmerChatSwiftUI`, iOS 16+)

```swift
// SPM: add ios/FarmerChatCore + ios/FarmerChatSwiftUI packages
import FarmerChatCore, FarmerChatSwiftUI

FarmerChat.shared.initialize(config: FarmerChatConfig(environment: .prod))
// SwiftUI:
FarmerChatView()                       // embed the full journey
// UIKit host on iOS 16+:
FarmerChat.shared.present(from: viewController)
```

## iOS — UIKit (`FarmerChatUIKit`, iOS 15+, SPM or CocoaPods)

```swift
import FarmerChatCore, FarmerChatUIKit
FarmerChat.shared.initialize(config: FarmerChatConfig(environment: .prod))
let vc = FarmerChatViewController()
present(vc, animated: true)
```
Add to host Info.plist: `NSMicrophoneUsageDescription`, `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`, `NSLocationWhenInUseUsageDescription`. iOS 16+ hosts should prefer the SwiftUI package (higher fidelity — see docs/04 UIKit notes).

## React Native (`@digitalgreenorg/farmerchat-react-native`, Expo 52+/RN 0.76+)

```tsx
import { FarmerChat, FarmerChatProvider, FarmerChatView } from '@digitalgreenorg/farmerchat-react-native';

FarmerChat.initialize({ environment: 'prod', appearance: 'auto',
  onEvent: (name, props) => {/* forward */} });

export default () => (
  <FarmerChatProvider>
    <FarmerChatView />
  </FarmerChatProvider>
);
```
Peer deps: react-navigation (native-stack), expo-av, expo-image-picker, expo-location, async-storage; optional: react-native-webview, react-native-view-shot (features degrade gracefully without them). Example: `react-native/example/`.

## Web (`@digitalgreenorg/farmerchat-web`, React 18)

```tsx
import { FarmerChat } from '@digitalgreenorg/farmerchat-web';
<FarmerChat config={{ environment: 'prod', appearance: 'auto' }} />
// or imperative:
FarmerChatSDK.mount(document.getElementById('chat')!, { environment: 'prod' });
```
Styles are scoped (`.fcsdk-*`); embeds in any container. Mic/camera/geolocation are capability-detected. Example: `web/example/`.

## Before production

1. Supply `geoApiKey` (Google Geolocation) or language auto-detect falls back to IP/default.
2. Decide guest API key strategy (`guestApiKey` override — see docs/05 #2).
3. Review `docs/04-parity-matrix.md` "Open verification debts": all packages are build/type-check verified but not yet runtime-tested against a live backend — run one manual pass per platform (onboarding → OTP → question → voice → image → history) on dev before shipping.
4. Resolve docs/05 open questions with the backend team (audio container formats, feed-card `selection_type` values, label-key mapping for full server-driven translations).
