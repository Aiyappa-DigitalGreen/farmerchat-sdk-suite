# -*- coding: utf-8 -*-
from content import *
from plat_android import S,P,SUB,CB,TBL

SWIFT_IDENTITY = [
 P("Guest by default, with phone/OTP sign-in inside the journey. Supply your own token to skip "
   "the SDK's auth UI."),
 CB([("Swift","swift",None,"""FarmerChatConfig(
    environment: .prod,
    authMode: .hostToken,
    accessToken: myAuth.currentAccessToken,
    // Called at init when no accessToken was given, and again on a 401.
    tokenProvider: { await myAuth.freshAccessToken() }
)""")]),
 CB([("Swift","swift",None,"""FarmerChat.shared.updateTokens(access: newAccess, refresh: newRefresh)

let signedIn = FarmerChat.shared.isAuthenticated
await FarmerChat.shared.logout()

// Cold + live auth state
let sub = FarmerChat.shared.onAuthStateChanged.sink { isAuthed in
    print("signed in:", isAuthed)
}""")])]

SWIFT_THEME = [
 P("Override only what must match your app; unset values keep the FarmerChat look."),
 CB([("Swift","swift",None,"""FarmerChatConfig(
    environment: .prod,
    appearance: .auto,               // .day, .night or .auto
    userBubbleColor: Color(.systemGray6),
    bubbleCornerRadius: 18,
    messageFontSize: 15
)""")]),
 ("note","Buttons are pills",[
  "The button corner radius defaults to <code>999</code> (a full pill), matching Android. A host "
  "<code>buttonCornerRadius</code> still overrides it."])]

SWIFT_LABELS = [
 P("Labels are served per language. Override individual strings with the generated "
   "<code>FCLabels</code> constants &mdash; never a hand-typed key."),
 CB([("Swift","swift",None,"""FarmerChatConfig(
    environment: .prod,
    stringOverrides: [
        FCLabels.recentChats: "Past advice",
        FCLabels.shareLocation: "Share my farm"
    ]
)""")]),
 LABELS_NOTE]

SWIFT_ANALYTICS = [
 P("The SDK emits the same events the FarmerChat app tracks, through a handler you provide. No "
   "third-party analytics SDK is bundled."),
 CB([("Swift","swift",None,"""FarmerChatConfig(
    environment: .prod,
    enableAnalytics: true, // default false
    onEvent: { name, props in MyAnalytics.track(name, props) },
    onChatOpened: { /* … */ },
    onMessageSent: { text in /* … */ },
    onAnswerReceived: { messageId in /* … */ },
    onScreenView: { screen in MyAnalytics.screen(screen) },
    onError: { code, message in MyLogger.warn(code, message) }
)""")]),
 ANALYTICS_NOTE]

IOS_PERMS = [
 P("Usage descriptions are a host responsibility &mdash; iOS terminates the app if one is missing "
   "when the SDK asks. Declare only what you enable."),
 CB([("Info.plist","xml","Info.plist",PERMS_IOS)])]

SWIFTUI = {
 "id":"ios-swiftui","name":"iOS","flavour":"SwiftUI","badge":"Swift · iOS 16+",
 "intro":["The SwiftUI SDK embeds the FarmerChat journey as a single view you can present or "
   "push. It targets iOS 16+ and ships as two Swift packages: <code>FarmerChatCore</code> (no UI) "
   "and <code>FarmerChatSwiftUI</code> (the screens).",
   "If your app is UIKit-based, use the UIKit flavour instead &mdash; it targets iOS 15 and keeps "
   "SwiftUI out of its public surface."],
 "sections":[
  S("install","Install the FarmerChat SDK",
    DISTRIBUTION,
    SUB("Add the package to your project"),
    P("Until a tagged release exists, depend on a local checkout. Swift Package Manager accepts a "
      "filesystem path anywhere it accepts a URL."),
    CB([("Local path","swift","Package.swift","""dependencies: [
    .package(path: "../farmerchat-sdk-suite/versions/v2/ios/FarmerChatSwiftUI")
],
targets: [
    .target(name: "MyApp", dependencies: ["FarmerChatSwiftUI"])
]"""),
        ("Remote (once tagged)","swift","Package.swift","""dependencies: [
    .package(
        url: "https://github.com/digitalgreenorg/farmerchat-sdk-suite.git",
        from: "1.0.0"
    )
],
targets: [
    .target(name: "MyApp", dependencies: ["FarmerChatSwiftUI"])
]""")]),
    P("In Xcode: <strong>File &rarr; Add Package Dependencies &rarr; Add Local&hellip;</strong> "
      "and pick the <code>FarmerChatSwiftUI</code> folder."),
    ("warn","No release tag yet",[
     "The repository currently has <strong>no git tags</strong>, so the remote form above cannot "
     "resolve. Use the local path until <code>ios-v1.0.0</code> is pushed."])),

  S("launch","Launch the journey",
    SUB("Initialize the SDK"),
    P("Call <code>initialize</code> once at app start, before presenting any FarmerChat view."),
    CB([("Swift","swift","MyApp.swift","""import SwiftUI
import FarmerChatCore

@main
struct MyApp: App {
    init() {
        _ = FarmerChat.initialize(
            config: FarmerChatConfig(
                environment: .prod,
                guestApiKey: "<your guest API key>",
                geoApiKey: "<your Google Geolocation key>",
                languageCode: "en",
                defaultCountryCode: "IN"
            )
        )
    }

    var body: some Scene {
        WindowGroup { ContentView() }
    }
}""")]),
    SUB("Present the journey"),
    P("<code>FarmerChatView</code> is the whole journey. Present it full-screen, or push it onto "
      "a navigation stack."),
    CB([("Swift","swift",None,"""import SwiftUI
import FarmerChatSwiftUI

struct ContentView: View {
    @State private var showFarmerChat = false

    var body: some View {
        Button("Ask FarmerChat") { showFarmerChat = true }
            .fullScreenCover(isPresented: $showFarmerChat) {
                FarmerChatView()
            }
    }
}""")]),
    SUB("Or use the floating launcher"),
    CB([("Swift","swift",None,"""ZStack(alignment: .bottomTrailing) {
    MyHomeScreen()
    FarmerChatFabButton()
        .padding(20)
}""")])),

  S("scope","Scope the experience",
    P("The configuration mirrors every other platform, field for field."),
    TBL(["Option","What it controls"], CONFIG_ROWS),
    SUB("Chat only"),
    CB([("Swift","swift",None,"""FarmerChatConfig(
    environment: .prod,
    guestApiKey: "<your guest API key>",
    mode: .chatOnly,
    showSettings: false,
    showHistory: true,
    showDrawer: false,      // moves history + language into the chat app bar
    showNameScreen: false
)""")]),
    CHAT_ONLY_NOTE,
    SUB("Turn off a question mode"),
    CB([("Swift","swift",None,"""FarmerChatConfig(
    environment: .prod,
    enableVoice: false,   // no mic
    enableImages: false   // no camera
)""")])),

  S("identity","Identity and authentication", *SWIFT_IDENTITY),
  S("theming","Theming", *SWIFT_THEME),
  S("labels","Labels and languages", *SWIFT_LABELS),
  S("analytics","Analytics", *SWIFT_ANALYTICS),
  S("permissions","Permissions", *IOS_PERMS),
  S("advanced","Advanced",
    SUB("Deep-link into a question"),
    CB([("Swift","swift",None,"""// Set the target, then present FarmerChatView
FarmerChat.shared.openChat(question: "Why are my tomato leaves yellow?")
FarmerChat.shared.openChat(conversationId: savedId)""")]),
    SUB("Streaming agentic chat"),
    CB([("Swift","swift",None,"FarmerChatConfig(environment: .prod, enableAgenticChat: true)")]),
    SUB("Point at your own backend"),
    CB([("Swift","swift",None,"""FarmerChatConfig(
    environment: .prod,
    customBaseURL: "https://farmerchat.internal.example/"
)""")])),
]}

UIKIT = {
 "id":"ios-uikit","name":"iOS","flavour":"UIKit","badge":"Swift · iOS 15+",
 "intro":["The UIKit SDK runs the journey through genuinely UIKit-native screens in a "
   "<code>UINavigationController</code>. It targets <strong>iOS 15</strong> and keeps SwiftUI out "
   "of its public surface, so it drops into older codebases without forcing a migration.",
   "Written in Swift. If your app is Objective-C, everything here works through the Objective-C "
   "facade &mdash; see that flavour."],
 "sections":[
  S("install","Install the FarmerChat SDK",
    DISTRIBUTION,
    SUB("Add the package to your project"),
    CB([("SPM — local path","swift","Package.swift","""dependencies: [
    .package(path: "../farmerchat-sdk-suite/versions/v2/ios/FarmerChatUIKit")
],
targets: [
    .target(name: "MyApp", dependencies: ["FarmerChatUIKit"])
]"""),
        ("CocoaPods","ruby","Podfile","""# Local development pod (no trunk release yet)
pod 'FarmerChatUIKit', :path => '../farmerchat-sdk-suite/versions/v2/ios/FarmerChatUIKit'

# Once a release is tagged:
# pod 'FarmerChatUIKit', '~> 1.0'""")]),
    ("warn","CocoaPods needs a tag",[
     "The podspec's <code>source</code> points at a git tag. The repository has <strong>no "
     "tags</strong> today, so only the <code>:path =&gt;</code> form resolves."]),
    ("note","One pod, both modules",[
     "The CocoaPods spec bundles <code>FarmerChatCore</code> into the same pod. SPM consumers "
     "take the two packages separately."])),

  S("launch","Launch the journey",
    SUB("Initialize the SDK"),
    CB([("Swift","swift","AppDelegate.swift","""import FarmerChatCore

func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
) -> Bool {
    _ = FarmerChat.initialize(
        config: FarmerChatConfig(
            environment: .prod,
            guestApiKey: "<your guest API key>",
            geoApiKey: "<your Google Geolocation key>",
            languageCode: "en",
            defaultCountryCode: "IN"
        )
    )
    return true
}""")]),
    SUB("Present the journey"),
    P("<code>FarmerChatViewController</code> is a <code>UINavigationController</code> running the "
      "whole journey. Present it or push it."),
    CB([("Swift","swift",None,"""import FarmerChatUIKit

@objc private func askTapped() {
    let vc = FarmerChatViewController()
    vc.modalPresentationStyle = .fullScreen
    present(vc, animated: true)
}""")]),
    SUB("Or use the floating launcher"),
    CB([("Swift","swift",None,"""let fab = FarmerChatFabButton(title: "Ask FarmerChat")
view.addSubview(fab)
fab.translatesAutoresizingMaskIntoConstraints = false
NSLayoutConstraint.activate([
    fab.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -20),
    fab.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20)
])""")])),

  S("scope","Scope the experience",
    TBL(["Option","What it controls"], CONFIG_ROWS),
    SUB("Chat only"),
    CB([("Swift","swift",None,"""FarmerChatConfig(
    environment: .prod,
    guestApiKey: "<your guest API key>",
    mode: .chatOnly,
    showSettings: false,
    showHistory: true,
    showDrawer: false,
    showNameScreen: false
)""")]),
    CHAT_ONLY_NOTE),

  S("identity","Identity and authentication", *SWIFT_IDENTITY),
  S("theming","Theming", *SWIFT_THEME),
  S("labels","Labels and languages", *SWIFT_LABELS),
  S("analytics","Analytics", *SWIFT_ANALYTICS),
  S("permissions","Permissions", *IOS_PERMS),
  S("advanced","Advanced",
    SUB("Deep-link into a question"),
    CB([("Swift","swift",None,'FarmerChat.shared.openChat(question: "Why are my tomato leaves yellow?")')]),
    SUB("Streaming agentic chat"),
    CB([("Swift","swift",None,"FarmerChatConfig(environment: .prod, enableAgenticChat: true)")])),
]}

OBJC = {
 "id":"ios-objc","name":"iOS","flavour":"Objective-C","badge":"Obj-C · iOS 15+",
 "intro":["Pure Objective-C codebases reach the SDK through a dedicated facade in "
   "<code>FarmerChatUIKit</code>. Import the module and use the <code>FC</code>-prefixed types "
   "&mdash; no Swift file is required anywhere in your project.",
   "The facade exists because Swift structs, <code>String</code>-backed enums, "
   "<code>async</code> functions and Combine publishers cannot cross into Objective-C. Each has "
   "an explicit equivalent below."],
 "sections":[
  S("install","Install the FarmerChat SDK",
    DISTRIBUTION,
    SUB("Add the package to your project"),
    CB([("CocoaPods","ruby","Podfile","""# Local development pod (no trunk release yet)
pod 'FarmerChatUIKit', :path => '../farmerchat-sdk-suite/versions/v2/ios/FarmerChatUIKit'"""),
        ("SPM — local path","swift","Package.swift","""dependencies: [
    .package(path: "../farmerchat-sdk-suite/versions/v2/ios/FarmerChatUIKit")
]""")]),
    SUB("Import the module"),
    P("The facade is a Swift module, so import it as a module rather than a header."),
    CB([("Objective-C","objc",None,"@import FarmerChatUIKit;")])),

  S("launch","Launch the journey",
    SUB("Initialize the SDK"),
    CB([("Objective-C","objc","AppDelegate.m","""@import FarmerChatUIKit;

- (BOOL)application:(UIApplication *)application
didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {

    FCFarmerChatConfiguration *cfg =
        [[FCFarmerChatConfiguration alloc] initWithEnvironment:FCEnvironmentProd];
    cfg.guestApiKey        = @"<your guest API key>";
    cfg.geoApiKey          = @"<your Google Geolocation key>";
    cfg.languageCode       = @"en";
    cfg.defaultCountryCode = @"IN";

    [FCFarmerChat initializeWithConfiguration:cfg];
    return YES;
}""")]),
    SUB("Present the journey"),
    CB([("Objective-C","objc",None,"""// Present modally from the current view controller
[FCFarmerChat presentFrom:self animated:YES completion:nil];

// Or take the view controller and place it yourself
UIViewController *journey = [FCFarmerChat makeViewController];
[self.navigationController pushViewController:journey animated:YES];""")]),
    SUB("Or use the floating launcher"),
    P("<code>FarmerChatFabButton</code>'s own initialisers have defaulted parameters, which do not "
      "bridge, so Objective-C gets factory methods instead."),
    CB([("Objective-C","objc",None,"""UIButton *fab = [FCFarmerChat makeFabButton];
[self.view addSubview:fab];

// …or fully specified
UIButton *custom =
    [FCFarmerChat makeFabButtonWithQuestion:@"Weather?"
                                      title:@"Ask"
                            backgroundColor:UIColor.systemGreenColor
                               contentColor:UIColor.whiteColor
                                systemImage:@"leaf.fill"];""")])),

  S("scope","Scope the experience",
    TBL(["Option","What it controls"], CONFIG_ROWS),
    SUB("Chat only"),
    CB([("Objective-C","objc",None,"""FCFarmerChatConfiguration *cfg =
    [[FCFarmerChatConfiguration alloc] initWithEnvironment:FCEnvironmentProd];
cfg.guestApiKey    = @"<your guest API key>";
cfg.mode           = FCModeChatOnly;
cfg.showDrawer     = NO;   // moves history + language into the chat app bar
cfg.showHistory    = YES;
cfg.showSettings   = NO;
cfg.showNameScreen = NO;""")]),
    CHAT_ONLY_NOTE,
    SUB("Turn off a question mode"),
    CB([("Objective-C","objc",None,"""cfg.enableVoice  = NO;   // no mic
cfg.enableImages = NO;   // no camera""")])),

  S("identity","Identity and authentication",
    P("The Swift <code>tokenProvider</code> is an <code>async</code> function, which Objective-C "
      "cannot express. You get a block that hands you a completion block to call."),
    CB([("Objective-C","objc",None,"""cfg.authMode    = FCAuthModeHostToken;
cfg.accessToken = [MyAuth currentAccessToken];

cfg.tokenProvider = ^(void (^done)(NSString *_Nullable)) {
    [MyAuth refreshWithCompletion:^(NSString *token) {
        done(token);   // safe to call from any queue; call it exactly once
    }];
};""")]),
    P("Session state and sign-out:"),
    CB([("Objective-C","objc",None,"""[FCFarmerChat updateTokensWithAccessToken:newAccess refreshToken:newRefresh];

BOOL signedIn = FCFarmerChat.isAuthenticated;
[FCFarmerChat logoutWithCompletion:^{ NSLog(@"signed out"); }];

// Combine is not representable in Obj-C, so auth state is a block + token.
FCAuthObservation *obs =
    [FCFarmerChat observeAuthState:^(BOOL isAuthed) { NSLog(@"%d", isAuthed); }];
// Keep obs alive; call -invalidate to stop.""")])),

  S("theming","Theming",
    P("Colours are <code>UIColor</code>. Optional numbers are <code>NSNumber *</code> &mdash; "
      "leaving one nil means &ldquo;SDK default&rdquo;, which is not the same as passing "
      "<code>0</code>."),
    CB([("Objective-C","objc",None,"""cfg.appearance         = FCAppearanceAuto;
cfg.userBubbleColor    = UIColor.systemGray6Color;
cfg.bubbleCornerRadius = @(18);
cfg.messageFontSize    = @(15);
cfg.fabBackgroundColor = UIColor.systemGreenColor;""")])),

  S("labels","Labels and languages",
    P("<code>FCLabels</code> is a Swift enum and therefore invisible to Objective-C. "
      "<code>FCLabelKeys</code> exposes the same canonical keys as class properties."),
    CB([("Objective-C","objc",None,"""cfg.stringOverrides = @{
    FCLabelKeys.recentChats   : @"Past advice",
    FCLabelKeys.shareLocation : @"Share my farm"
};""")]),
    LABELS_NOTE,
    ("note","Two renamed keys",[
     "Members whose name is a C keyword are suffixed <code>Label</code>: "
     "<code>FCLabelKeys.continueLabel</code> and <code>FCLabelKeys.autoLabel</code>. A bare "
     "<code>continue</code> cannot be a selector."])),

  S("analytics","Analytics",
    P("Callbacks are blocks. <code>onError</code>'s code is an <code>NSNumber *</code> and is nil "
      "when the failure carried no HTTP status &mdash; which is not the same as status 0."),
    CB([("Objective-C","objc",None,"""cfg.enableAnalytics = YES;   // default NO

cfg.onEvent = ^(NSString *name, NSDictionary<NSString *, NSString *> *props) {
    [MyAnalytics track:name properties:props];
};
cfg.onScreenView     = ^(NSString *screen)    { [MyAnalytics screen:screen]; };
cfg.onChatOpened     = ^{ };
cfg.onMessageSent    = ^(NSString *text)      { };
cfg.onAnswerReceived = ^(NSString *messageId) { };
cfg.onError = ^(NSNumber *_Nullable code, NSString *message) {
    [MyLogger warn:code message:message];
};""")]),
    ANALYTICS_NOTE),

  S("permissions","Permissions", *IOS_PERMS),

  S("advanced","Advanced",
    SUB("Deep-link into a question"),
    CB([("Objective-C","objc",None,"""[FCFarmerChat openChatWithQuestion:@"Why are my tomato leaves yellow?"
                    conversationId:nil];""")]),
    SUB("Bridging reference"),
    P("Every difference between the Swift and Objective-C surfaces, and why it exists:"),
    TBL(["Swift","Objective-C","Why"],[
     ("<code>FarmerChatConfig</code> (struct)","<code>FCFarmerChatConfiguration</code>","Swift structs cannot be exposed to Obj-C at all"),
     ("String-backed enums","<code>FCEnvironment</code>, <code>FCMode</code>, <code>FCAuthMode</code>, <code>FCAppearance</code>","<code>@objc</code> enums must be Int-backed"),
     ("<code>CGFloat?</code>","<code>NSNumber *</code>","Obj-C has no optional scalar; nil &ne; 0"),
     ("<code>Color?</code>","<code>UIColor *</code>","SwiftUI <code>Color</code> is not representable"),
     ("<code>() async -&gt; String?</code>","block taking a completion block","Obj-C has no <code>async</code>"),
     ("<code>logout() async</code>","<code>+logoutWithCompletion:</code>","same"),
     ("<code>AnyPublisher&lt;Bool&gt;</code>","<code>+observeAuthState:</code>","Combine is not representable")]),
    ("note","Not bridged",[
     "The full <code>theme</code> struct, and the SDK internals (<code>prefs</code>, "
     "<code>labels</code>, <code>analytics</code>, <code>api</code>, <code>session</code>). The "
     "individual colour options above cover most theming; full theming needs a one-file Swift "
     "bridge on your side."])),
]}
