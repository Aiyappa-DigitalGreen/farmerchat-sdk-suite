//
//  FCObjCSmoke.m
//  The Objective-C channel's ONLY real assertion.
//
//  `swift build` and `xcodebuild` succeed whether or not a symbol is visible to Objective-C, so
//  they cannot show that the PRD's "iOS SDK for Objective-C" row is satisfied. This file can: it
//  is compiled by clang as Objective-C against the generated FarmerChatUIKit interface, so
//  everything it touches is provably reachable from a partner's `.m`. If a facade member stops
//  being `@objc`-exposed, or an enum/selector name changes, THIS TARGET FAILS TO BUILD.
//
//  It is compile-only on purpose — it is never run, so it must not call `initialize` for real.
//
#import "include/FCObjCSmoke.h"
@import UIKit;
@import FarmerChatUIKit;

// ---------------------------------------------------------------------------------------------
// The @objc enums are Int-backed, and their raw values are ABI for every Objective-C host that
// has already compiled against them. A shifted value does not fail to build on the Swift side —
// it silently selects a DIFFERENT environment / mode, which is the worst failure available here
// (prod traffic to a dev backend, or vice versa). Lock them at compile time.
_Static_assert(FCEnvironmentDev   == 0, "FCEnvironment raw values are ABI; do not reorder");
_Static_assert(FCEnvironmentStage == 1, "FCEnvironment raw values are ABI; do not reorder");
_Static_assert(FCEnvironmentDemo  == 2, "FCEnvironment raw values are ABI; do not reorder");
_Static_assert(FCEnvironmentProd  == 3, "FCEnvironment raw values are ABI; do not reorder");
_Static_assert(FCEnvironmentEks   == 4, "FCEnvironment raw values are ABI; do not reorder");
_Static_assert(FCAppearanceDay    == 0, "FCAppearance raw values are ABI; do not reorder");
_Static_assert(FCAppearanceNight  == 1, "FCAppearance raw values are ABI; do not reorder");
_Static_assert(FCAppearanceAuto   == 2, "FCAppearance raw values are ABI; do not reorder");
_Static_assert(FCAuthModeSdkOtp    == 0, "FCAuthMode raw values are ABI; do not reorder");
_Static_assert(FCAuthModeHostToken == 1, "FCAuthMode raw values are ABI; do not reorder");
_Static_assert(FCModeFullJourney == 0, "FCMode raw values are ABI; do not reorder");
_Static_assert(FCModeChatOnly    == 1, "FCMode raw values are ABI; do not reorder");

@implementation FCObjCSmoke

+ (void)exercise {
    // ---- Configuration: every bridged member, in Objective-C ----
    FCFarmerChatConfiguration *cfg =
        [[FCFarmerChatConfiguration alloc] initWithEnvironment:FCEnvironmentProd];

    cfg.environment      = FCEnvironmentStage;
    cfg.customBaseURL    = @"https://example.invalid/";
    cfg.geoApiKey        = @"geo";
    cfg.farmerChatApiKey = @"fc-key";

    cfg.appearance           = FCAppearanceAuto;
    cfg.fabBackgroundColor   = UIColor.systemGreenColor;
    cfg.fabContentColor      = UIColor.whiteColor;
    cfg.userBubbleColor      = UIColor.lightGrayColor;
    cfg.userBubbleTextColor  = UIColor.blackColor;
    cfg.aiBubbleTextColor    = UIColor.darkGrayColor;
    cfg.bubbleCornerRadius   = @(18);   // NSNumber: Obj-C has no optional CGFloat
    cfg.messageFontSize      = @(15);
    cfg.fabLabel             = @"Ask";

    cfg.languageCode       = @"en";
    cfg.locale             = @"en";
    cfg.defaultCountryCode = @"IN";
    cfg.defaultStateCode   = @"Karnataka";
    cfg.defaultLatitude    = 12.97;
    cfg.defaultLongitude   = 77.59;

    cfg.enableVoice       = YES;
    cfg.enableImages      = YES;
    cfg.enableWeather     = YES;
    cfg.enableSsfr        = YES;
    cfg.enableAgenticChat = YES;
    cfg.enableAnalytics   = YES;

    cfg.mode           = FCModeChatOnly;
    cfg.showSettings   = NO;
    cfg.showHistory    = YES;
    cfg.showDrawer     = NO;
    cfg.showNameScreen = NO;

    cfg.authMode      = FCAuthModeHostToken;
    cfg.accessToken   = @"access";
    cfg.refreshToken  = @"refresh";
    cfg.tokenProvider = ^(void (^done)(NSString *_Nullable)) { done(@"fresh"); };

    // Canonical keys must be reachable from Obj-C, or a host hand-types bare keys and the
    // override silently never applies.
    cfg.stringOverrides = @{ FCLabelKeys.recentChats  : @"Past advice",
                             FCLabelKeys.shareLocation: @"Share my farm",
                             FCLabelKeys.continueLabel: @"Next" };

    cfg.onEvent          = ^(NSString *name, NSDictionary<NSString *, NSString *> *props) { (void)name; (void)props; };
    cfg.onSessionExpired = ^{ };
    cfg.onChatOpened     = ^{ };
    cfg.onMessageSent    = ^(NSString *text) { (void)text; };
    cfg.onAnswerReceived = ^(NSString *messageId) { (void)messageId; };
    cfg.onScreenView     = ^(NSString *screen) { (void)screen; };
    cfg.onError          = ^(NSNumber *_Nullable code, NSString *message) { (void)code; (void)message; };
    cfg.onSessionStart   = ^{ };

    // ---- Facade surface (compile-only; deliberately not invoked) ----
    if (NO) {
        [FCFarmerChat initializeWithConfiguration:cfg];

        BOOL ready = FCFarmerChat.isInitialized;
        BOOL authed = FCFarmerChat.isAuthenticated;
        (void)ready; (void)authed;

        UIViewController *journey = [FCFarmerChat makeViewController];
        (void)journey;
        // Present from a plain host VC, matching the README example — not from the journey itself.
        UIViewController *host = [[UIViewController alloc] init];
        [FCFarmerChat presentFrom:host animated:YES completion:^{ }];
        [FCFarmerChat openChatWithQuestion:@"Why are my leaves yellow?" conversationId:nil];

        [FCFarmerChat updateTokensWithAccessToken:@"a" refreshToken:@"r"];
        [FCFarmerChat logoutWithCompletion:^{ }];

        FCAuthObservation *obs = [FCFarmerChat observeAuthState:^(BOOL isAuthed) { (void)isAuthed; }];
        [obs invalidate];

        UIButton *fab = [FCFarmerChat makeFabButton];
        UIButton *fab2 = [FCFarmerChat makeFabButtonWithQuestion:@"Weather?"
                                                           title:@"Ask"
                                                 backgroundColor:UIColor.systemGreenColor
                                                    contentColor:UIColor.whiteColor
                                                     systemImage:@"leaf.fill"];
        (void)fab; (void)fab2;

        // The pre-existing presentation path must keep working.
        FarmerChatViewController *direct = [[FarmerChatViewController alloc] init];
        (void)direct;
    }
}

@end
