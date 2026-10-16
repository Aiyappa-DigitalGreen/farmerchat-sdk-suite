# -*- coding: utf-8 -*-
"""Content model for the FarmerChat SDK integration guide.
Every platform carries the SAME ordered section list, so format parity is
structural rather than a matter of hand-discipline.

Every v2 package ships the same version. Sources (keep in step when bumping):
  versions/v2/android/build.gradle.kts            farmerChatVersion / farmerChatGroup
  versions/v2/ios/FarmerChatCore/.../DeviceInfoProvider.swift  version
  versions/v2/ios/FarmerChatUIKit/FarmerChatUIKit.podspec       s.version (git tag ios-v<version>)
  versions/v2/react-native/packages/farmerchat-react-native/package.json
  versions/v2/web/packages/farmerchat-web/package.json + src/core/version.ts"""

VERSION = "2.2.0"
VERSION_MINOR = ".".join(VERSION.split(".")[:2])   # CocoaPods "~> 2.2"
MAVEN_GROUP = "io.github.aiyappa-digitalgreen"

PERMS_ANDROID = """<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- Voice questions -->
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<!-- Photo questions -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
<!-- Weather + location-specific advice -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-feature android:name="android.hardware.location.gps" android:required="false" />"""

PERMS_IOS = """<key>NSMicrophoneUsageDescription</key>
<string>Ask FarmerChat a question by speaking.</string>

<key>NSCameraUsageDescription</key>
<string>Take a photo of your crop so FarmerChat can diagnose it.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Attach a photo of your crop to your question.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>Show weather and advice for your farm's location.</string>"""

# SwiftUI's answer-card "Download" calls UIImageWriteToSavedPhotosAlbum (ChatView.swift), which
# needs the add-only Photos key. UIKit / React Native do not save to Photos.
PERMS_IOS_SWIFTUI = PERMS_IOS + """

<key>NSPhotoLibraryAddUsageDescription</key>
<string>Save an answer card to your photos.</string>"""

CONFIG_ROWS = [
 ("<code>environment</code>","Backend to talk to: <code>DEV</code>, <code>STAGE</code>, <code>DEMO</code>, <code>PROD</code>, <code>EKS</code>. Use <code>DEMO</code> while you test. <code>STAGE</code>'s backend is currently unavailable."),
 ("<code>farmerChatApiKey</code> / <code>geoApiKey</code>","Optional. The SDK bundles a FarmerChat API key and a Google Geolocation key; set these only to use your own."),
 ("<code>languageCode</code>","Initial language, e.g. <code>\"en\"</code>, <code>\"hi\"</code>. The farmer can change it in-journey."),
 ("<code>defaultCountryCode</code> / <code>defaultStateCode</code>","Seed geography used before the farmer shares a location."),
 ("<code>mode</code>","<code>CHAT_ONLY</code> (<strong>default</strong>: opens straight into chat) or <code>FULL_JOURNEY</code> (onboarding + home + chat)."),
 ("<code>showDrawer</code> / <code>showHistory</code> / <code>showSettings</code> / <code>showNameScreen</code>","Trim the journey surface by surface. <code>showDrawer</code> and <code>showHistory</code> follow the mode unless you set them: off in chat-only, on in the full journey."),
 ("<code>enableVoice</code> / <code>enableImages</code> / <code>enableWeather</code> / <code>enableSsfr</code>","Turn individual question modes and features off."),
 ("<code>enableAgenticChat</code>","Opt into streaming agentic chat. Default off keeps the synchronous 1.0.0 contract."),
 ("<code>enableAnalytics</code>","Telemetry master switch. <strong>Default off</strong> &mdash; events are built but dropped until you opt in."),
 ("<code>authMode</code> + <code>accessToken</code> / <code>tokenProvider</code>","Supply your own identity instead of the SDK-owned phone/OTP flow."),
 ("<code>stringOverrides</code>","Replace any server label. Keys must be canonical <code>fc_v2_app_label_*</code> keys."),
]

DISTRIBUTION = ("warn","Release status",[
 "<strong>Android</strong> installs from <strong>Maven Central</strong> as <code>%s:*:%s</code>, "
 "the same way as any other library. The first release is being set up: until it is published, "
 "Gradle reports <code>Could not find %s</code>. In the meantime, build the SDK from source "
 "with the <code>mavenLocal()</code> fallback shown in the Android install section." % (MAVEN_GROUP, VERSION, MAVEN_GROUP),
 "<strong>iOS, React Native and Web</strong> are not on CocoaPods, Swift Package Manager or npm "
 "yet. Build from source and consume the package locally, as each install section shows."])

# CHAT_ONLY is the default mode, and showDrawer / showHistory both resolve to
# `mode == FULL_JOURNEY` when unset (FarmerChatConfig.kt / .swift, web + RN core/config.ts).
CHAT_ONLY_P = ("Out of the box the farmer lands directly in chat, with the language button in the "
 "chat bar. The settings below spell that default out and add the past-chats button with "
 "<code>showHistory</code>; pass <code>FULL_JOURNEY</code> as the mode for onboarding, Home and "
 "the drawer too.")

CHAT_ONLY_NOTE = ("note","Where history and language live",[
 "In chat-only mode the drawer and history are off by default (<code>showDrawer</code> and "
 "<code>showHistory</code> follow the mode), so the chat app bar carries only the language "
 "button. Turn <code>showHistory</code> on to add the past-chats button there; set "
 "<code>showDrawer</code> yourself to bring the drawer back."])

ANALYTICS_NOTE = ("note","Off by default",[
 "<code>enableAnalytics</code> defaults to <strong>false</strong> on every platform. Events are "
 "still constructed with their real names, properties and ordering &mdash; they are dropped at "
 "the single dispatch point, so enabling telemetry later cannot change any other behaviour."])

LABELS_NOTE = ("note","Use the generated key constants",[
 "Labels resolve as <code>&lt;key&gt;_&lt;lang&gt;</code> against the canonical "
 "<code>fc_v2_app_label_*</code> keys. A hand-typed short key silently never matches, and your "
 "override is ignored without an error. Always use the generated constants."])
