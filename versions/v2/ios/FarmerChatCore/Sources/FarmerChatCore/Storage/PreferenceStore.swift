import Foundation

/// All preference keys the SDK persists, grouped exactly like the app's
/// `PreferenceHelperManager` key groups (doc 02 §Session & persistence).
/// Every key is namespaced with `fc_sdk_` in UserDefaults so the SDK never
/// collides with the host app.
public enum PrefKey: String, CaseIterable, Sendable {
    // Auth / session
    case otpVerified = "OTP_VERIFIED"
    case phoneNumberLogin = "PHONE_NUMBER_LOGIN"
    case firstLoginDone = "FIRST_LOGIN_DONE"
    case isProfileLoaded = "IS_PROFILE_LOADED"

    // Onboarding steps
    case languageDone = "LANGUAGE_DONE"
    case nameDone = "KEY_NAME_DONE"
    case nameScreenSeen = "KEY_NAME_SCREEN_SEEN"
    case userNameAdded = "USER_NAME_ADDED"
    case buildVersionApiCalled = "BUILD_VERSION_API_CALLED"
    case termsAccepted = "TERMS_ACCEPTED"

    // Language
    case selectedLanguageId = "SELECTED_LANGUAGE_ID"
    case selectedLanguageCode = "SELECTED_LANGUAGE_CODE"
    case selectedLanguageDisplayName = "SELECTED_LANGUAGE_DISPLAY_NAME"
    case languageLabelsJson = "LANGUAGE_LABELS_JSON"
    case languageLabelsLoaded = "LANGUAGE_LABELS_LOADED"

    // Profile
    case userName = "USER_NAME"
    case userGender = "USER_GENDER"
    case cultivatedCrops = "CULTIVATED_CROPS"
    case liveStockDetails = "LIVE_STOCK_DETAILS"

    // Location
    case latitude = "FARMER_APP_LATITUDE"
    case longitude = "FARMER_APP_LONGITUDE"
    case userCountryCode = "USER_COUNTRY_CODE"
    case userCountryName = "USER_COUNTRY_NAME"
    case userState = "USER_STATE"
    case userDistrict = "USER_DISTRICT"
    case gpsLocationShared = "GPS_LOCATION_SHARED"
    case locationPromptSkipped = "LOCATION_PROMPT_SKIPPED"

    // Chat
    case newConversationId = "NEW_CONVERSATION_ID"
    case lastBaseURL = "LAST_BASE_URL"
    case firstQueryAsked = "FIRST_QUERY_ASKED"
    case cachedHomeFeedResponse = "CACHED_HOME_FEED_RESPONSE"

    // Permissions bookkeeping
    case micDenyCount = "MIC_DENY_COUNT"
    case micAttemptCount = "MIC_ATTEMPT_COUNT"
    case cameraDenyCount = "CAMERA_DENY_COUNT"
    case cameraAttemptCount = "CAMERA_ATTEMPT_COUNT"

    // UI
    case appearanceMode = "APPEARANCE_MODE"
    case fontSize = "FONT_SIZE"

    // UTM
    case utmSource = "UTM_SOURCE"
    case utmMedium = "UTM_MEDIUM"
    case utmCampaign = "UTM_CAMPAIGN"

    var namespaced: String { "fc_sdk_" + rawValue }
}

/// Namespaced UserDefaults wrapper — the SDK equivalent of
/// `PreferenceHelperManager`. `clearAll(preservingAppearance:)` matches the
/// app's logout semantics (everything cleared except appearance).
public final class PreferenceStore: @unchecked Sendable {
    private let defaults: UserDefaults

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    // MARK: - Typed accessors

    public func string(_ key: PrefKey) -> String? {
        defaults.string(forKey: key.namespaced)
    }

    public func setString(_ value: String?, _ key: PrefKey) {
        if let value {
            defaults.set(value, forKey: key.namespaced)
        } else {
            defaults.removeObject(forKey: key.namespaced)
        }
    }

    public func bool(_ key: PrefKey) -> Bool {
        defaults.bool(forKey: key.namespaced)
    }

    public func setBool(_ value: Bool, _ key: PrefKey) {
        defaults.set(value, forKey: key.namespaced)
    }

    public func int(_ key: PrefKey) -> Int {
        defaults.integer(forKey: key.namespaced)
    }

    public func setInt(_ value: Int, _ key: PrefKey) {
        defaults.set(value, forKey: key.namespaced)
    }

    public func double(_ key: PrefKey) -> Double? {
        defaults.object(forKey: key.namespaced) == nil ? nil : defaults.double(forKey: key.namespaced)
    }

    public func setDouble(_ value: Double?, _ key: PrefKey) {
        if let value {
            defaults.set(value, forKey: key.namespaced)
        } else {
            defaults.removeObject(forKey: key.namespaced)
        }
    }

    public func remove(_ key: PrefKey) {
        defaults.removeObject(forKey: key.namespaced)
    }

    /// Full logout wipe. Appearance is preserved, matching the app.
    public func clearAll(preservingAppearance: Bool = true) {
        let appearance = string(.appearanceMode)
        for key in PrefKey.allCases {
            defaults.removeObject(forKey: key.namespaced)
        }
        if preservingAppearance, let appearance {
            setString(appearance, .appearanceMode)
        }
    }
}
