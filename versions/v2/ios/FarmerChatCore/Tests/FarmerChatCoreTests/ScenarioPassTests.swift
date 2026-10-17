import XCTest
@testable import FarmerChatCore

/// Fixes from the SCENARIOS.md pass.
final class ScenarioPassTests: XCTestCase {
    private var suiteName = ""
    private var defaults: UserDefaults!

    override func setUp() {
        super.setUp()
        suiteName = "fc_sdk_test_\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)!
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        super.tearDown()
    }

    /// D5: a rejected transcription shows what was heard (ChatViewModel.kt:598-617); a failed
    /// request shows `something_went_wrong` (:620-636).
    func testVoiceFailureTexts() {
        let labels = LabelManager(prefs: PreferenceStore(defaults: defaults))
        XCTAssertEqual(ChatViewModel.voiceFailureText(heard: "hmm", accepted: false, labels: labels), "hmm")
        XCTAssertEqual(ChatViewModel.voiceFailureText(heard: "", accepted: false, labels: labels), "")
        XCTAssertEqual(ChatViewModel.voiceFailureText(heard: nil, accepted: false, labels: labels), "Something went wrong")
    }

    func testChatStateStartsNotTranscribing() {
        XCTAssertFalse(ChatState().isTranscribing)
    }

    /// C3: the #11 reply is `{error_message, user_profile{…}}` (app GetLocationResponse.kt); the
    /// shared place must come from `user_profile`, or the location bubble shows the old place.
    func testUpdateLocationReplyDecodesUserProfile() throws {
        let json = #"{"error_message":null,"user_profile":{"user_id":"u1","country_name":"United States","country_code":"US","geography_level2_name":"South Dakota","geography_level3":"Minnehaha","display_address":"Sioux Falls","latitude":43.5446,"longitude":-96.7311}}"#
        let r = try JSONDecoder().decode(GetLocationResponse.self, from: Data(json.utf8))
        XCTAssertEqual(r.resolvedCountryName, "United States")
        XCTAssertEqual(r.resolvedState, "South Dakota")
        XCTAssertEqual(r.resolvedDistrict, "Minnehaha")
        XCTAssertEqual(r.userProfile?.displayAddress, "Sioux Falls")
        // Legacy flat shape still resolves.
        let legacy = try JSONDecoder().decode(GetLocationResponse.self, from: Data(#"{"country":"India","state":"KA"}"#.utf8))
        XCTAssertEqual(legacy.resolvedState, "KA")
        XCTAssertNil(legacy.resolvedDistrict)
    }

    /// Home location pill (app HomeScreen.kt `HomeLocationPill`): precedence and the pill's own
    /// flow detection.
    func testLocationPillPrecedence() {
        typealias P = FCLocationPillState
        XCTAssertEqual(P.resolve(isBlocked: true, isSearching: true, showSuccess: true, hasStoredFix: true, hasPermission: true, placeName: "X"), .blocked)
        XCTAssertEqual(P.resolve(isBlocked: false, isSearching: true, showSuccess: true, hasStoredFix: true, hasPermission: true, placeName: "X"), .searching)
        XCTAssertEqual(P.resolve(isBlocked: false, isSearching: false, showSuccess: true, hasStoredFix: false, hasPermission: false, placeName: ""), .success)
        XCTAssertEqual(P.resolve(isBlocked: false, isSearching: false, showSuccess: false, hasStoredFix: false, hasPermission: false, placeName: "Minnehaha"), .located)
        // A stored fix outlives a revoked permission: no name + no permission → invite.
        XCTAssertEqual(P.resolve(isBlocked: false, isSearching: false, showSuccess: false, hasStoredFix: true, hasPermission: false, placeName: " "), .invite)
        XCTAssertEqual(P.resolve(isBlocked: false, isSearching: false, showSuccess: false, hasStoredFix: true, hasPermission: true, placeName: ""), .located)
        XCTAssertTrue(P.isSearching(state: .fetchingLocation, source: .localContext))
        XCTAssertFalse(P.isSearching(state: .requestPermission, source: .localContext))
        XCTAssertFalse(P.isSearching(state: .fetchingLocation, source: .weather))
        XCTAssertTrue(P.isFlowActive(state: .requestPermission, source: .localContext))
        XCTAssertFalse(P.isFlowActive(state: .idle, source: .localContext))
    }

    /// The pill's place name: district › state › country, as #11 / the profile backfill stored them.
    func testApproxPlaceNamePrecedence() {
        let prefs = PreferenceStore(defaults: defaults)
        XCTAssertEqual(LocationPromptManager.approxPlaceName(prefs: prefs), "")
        prefs.setString("India", .userCountryName)
        XCTAssertEqual(LocationPromptManager.approxPlaceName(prefs: prefs), "India")
        prefs.setString("Karnataka", .userState)
        XCTAssertEqual(LocationPromptManager.approxPlaceName(prefs: prefs), "Karnataka")
        prefs.setString("Bengaluru Urban", .userDistrict)
        XCTAssertEqual(LocationPromptManager.approxPlaceName(prefs: prefs), "Bengaluru Urban")
    }

    /// E8: the live `flag` is an image URL (app AuthScreen.kt `flagUrl`); it must never print.
    func testCountryFlagURLIsNotText() throws {
        let url = try JSONDecoder().decode(CountryItem.self, from: Data(#"{"id":1,"flag":"https://s3-ap-south-1.amazonaws.com/x/in.png","phone_country_code":"+91"}"#.utf8))
        XCTAssertNil(url.flagText)
        XCTAssertEqual(url.flagImageURL?.host, "s3-ap-south-1.amazonaws.com")
        let emoji = try JSONDecoder().decode(CountryItem.self, from: Data(#"{"id":2,"flag":"🇮🇳"}"#.utf8))
        XCTAssertEqual(emoji.flagText, "🇮🇳")
        XCTAssertNil(emoji.flagImageURL)
    }

    /// Home: only IMAGE cards are marked viewed (app HomeScreen.kt:2092), with `statement_id`
    /// as a string (ImageViewedRequest). DEMO 404s a statement card's PATCH.
    func testOnlyImageCardsAreMarkedViewedWithStringId() throws {
        func section(_ json: String) throws -> SectionDto { try JSONDecoder().decode(SectionDto.self, from: Data(json.utf8)) }
        XCTAssertTrue(HomeViewModel.shouldMarkViewed(try section(#"{"id":"a","type":"image","statement_id":12}"#)))
        XCTAssertFalse(HomeViewModel.shouldMarkViewed(try section(#"{"id":"b","type":"statement","statement_id":13}"#)))
        XCTAssertFalse(HomeViewModel.shouldMarkViewed(try section(#"{"id":"c","type":"image","statement_id":14,"is_viewed":true}"#)))
        XCTAssertFalse(HomeViewModel.shouldMarkViewed(try section(#"{"id":"d","type":"image"}"#)))
        let body = try JSONEncoder().encode(ImageViewedRequest(statementId: .int(12), userId: "u"))
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertEqual(object["statement_id"] as? String, "12")
        XCTAssertEqual(object["status"] as? String, "viewed")
    }

    /// Full-screen messages: the app's country farmer illustrations ship as Core resources;
    /// unsupported / blank countries fall back to Kenya (CountryImageAssets.kt).
    func testFarmerIllustrationsResolvePerCountry() throws {
        XCTAssertEqual(FCFarmerIllustration.folder(for: "IN"), "in")
        XCTAssertEqual(FCFarmerIllustration.folder(for: "us"), "ke")
        XCTAssertEqual(FCFarmerIllustration.folder(for: nil), "ke")
        for illustration in FCFarmerIllustration.allCases {
            for country in ["in", "ke", "et", "ng", "us"] {
                let url = try XCTUnwrap(illustration.url(countryCode: country), "\(illustration) \(country)")
                XCTAssertTrue(url.path.contains("/\(FCFarmerIllustration.folder(for: country))/"))
                XCTAssertGreaterThan(try Data(contentsOf: url).count, 1000)
            }
        }
    }

    /// `enableComposerUi` mirrors Android's `FarmerChatConfig.resolvedComposerUi`: nil follows
    /// `enableAgenticChat`; an explicit value wins either way.
    func testComposerUiFollowsAgenticUnlessSet() {
        var config = FarmerChatConfig(environment: .demo, enableAgenticChat: false)
        XCTAssertNil(config.enableComposerUi)
        XCTAssertFalse(config.resolvedComposerUi)
        config.enableAgenticChat = true
        XCTAssertTrue(config.resolvedComposerUi)
        config.enableComposerUi = false
        XCTAssertFalse(config.resolvedComposerUi)
        config.enableAgenticChat = false
        config.enableComposerUi = true
        XCTAssertTrue(config.resolvedComposerUi)
    }

    /// #4 privacy_policy reply, as the app's PrivacyPolicyResponse.kt: `url` = privacy policy,
    /// `farmerchat_terms_of_use` = terms. The SDK read `privacy_policy` / `terms_of_use` (absent).
    func testPrivacyPolicyResponseUsesAppFields() throws {
        let json = #"{"url":"https://example.org/privacy","leaderboard_privacy_policy_url":"https://example.org/lb-privacy","farmerchat_terms_of_use":"https://example.org/terms","leaderboard_terms_of_use":"https://example.org/lb-terms"}"#
        let r = try JSONDecoder().decode(PrivacyPolicyResponse.self, from: Data(json.utf8))
        XCTAssertEqual(r.privacyPolicy, "https://example.org/privacy")
        XCTAssertEqual(r.termsOfUse, "https://example.org/terms")
        XCTAssertEqual(r.leaderboardTermsOfUse, "https://example.org/lb-terms")
    }
}
