# -*- coding: utf-8 -*-
"""Content model for the FarmerChat SDK integration guide.
Every platform carries the SAME ordered section list, so format parity is
structural rather than a matter of hand-discipline."""

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

CONFIG_ROWS = [
 ("<code>environment</code>","Backend to talk to: <code>DEV</code>, <code>STAGE</code>, <code>DEMO</code>, <code>PROD</code>, <code>EKS</code>."),
 ("<code>guestApiKey</code>","Key for anonymous (guest) sessions. Required unless you supply your own token."),
 ("<code>geoApiKey</code>","Google Geolocation key. Effectively required &mdash; the advice feed stays empty until a country resolves."),
 ("<code>languageCode</code>","Initial language, e.g. <code>\"en\"</code>, <code>\"hi\"</code>. The farmer can change it in-journey."),
 ("<code>defaultCountryCode</code> / <code>defaultStateCode</code>","Seed geography used before the farmer shares a location."),
 ("<code>mode</code>","<code>FULL_JOURNEY</code> (onboarding + home + chat) or <code>CHAT_ONLY</code> (straight into chat)."),
 ("<code>showDrawer</code> / <code>showHistory</code> / <code>showSettings</code> / <code>showNameScreen</code>","Trim the journey surface by surface."),
 ("<code>enableVoice</code> / <code>enableImages</code> / <code>enableWeather</code> / <code>enableSsfr</code>","Turn individual question modes and features off."),
 ("<code>enableAgenticChat</code>","Opt into streaming agentic chat. Default off keeps the synchronous 1.0.0 contract."),
 ("<code>enableAnalytics</code>","Telemetry master switch. <strong>Default off</strong> &mdash; events are built but dropped until you opt in."),
 ("<code>authMode</code> + <code>accessToken</code> / <code>tokenProvider</code>","Supply your own identity instead of the SDK-owned phone/OTP flow."),
 ("<code>stringOverrides</code>","Replace any server label. Keys must be canonical <code>fc_v2_app_label_*</code> keys."),
]

DISTRIBUTION = ("warn","Before you start &mdash; read this",[
 "The SDK artifacts are <strong>not published to a public repository yet</strong>. There is no "
 "Maven Central / GitHub Packages release, no CocoaPods trunk entry, and no npm package "
 "(<code>npm view</code> returns 404 for both JavaScript packages). The install steps below are "
 "the shape your integration will take, and they work today against a local build.",
 "Until a release exists, build the SDK from source and consume it locally &mdash; each "
 "platform's install section shows the local path alongside the eventual remote one."])

CHAT_ONLY_NOTE = ("note","Why the icons appear",[
 "In <code>CHAT_ONLY</code>, <code>showDrawer(false)</code> is what moves history and language "
 "<em>into</em> the chat app bar &mdash; the drawer normally owns them. Setting "
 "<code>showHistory(true)</code> alone does nothing while the drawer is on."])

ANALYTICS_NOTE = ("note","Off by default",[
 "<code>enableAnalytics</code> defaults to <strong>false</strong> on every platform. Events are "
 "still constructed with their real names, properties and ordering &mdash; they are dropped at "
 "the single dispatch point, so enabling telemetry later cannot change any other behaviour."])

LABELS_NOTE = ("note","Use the generated key constants",[
 "Labels resolve as <code>&lt;key&gt;_&lt;lang&gt;</code> against the canonical "
 "<code>fc_v2_app_label_*</code> keys. A hand-typed short key silently never matches, and your "
 "override is ignored without an error. Always use the generated constants."])
