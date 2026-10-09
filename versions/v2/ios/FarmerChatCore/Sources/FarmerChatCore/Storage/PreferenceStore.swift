import Foundation
import Combine

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
    /// The selected language's `streaming_required` — the app's `PreferenceKeys.STREAMING_REQUIRED`
    /// key name verbatim (`is_streaming_required`). Read with ``PreferenceStore/bool(_:default:)``
    /// so an unset value means true, as in the app.
    case streamingRequired = "is_streaming_required"

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
    /// Location permission deny count — the app's `PreferenceKeys.PERMISSION_DENY_COUNT`.
    case permissionDenyCount = "PERMISSION_DENY_COUNT"

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

    /// Emits the new language code whenever `selectedLanguageCode` is written.
    ///
    /// UI that derives from the language — the per-script type scale in particular — has no
    /// other way to learn about the change: `UserDefaults` is outside SwiftUI's observation
    /// graph, and the six writers live in three different view models, one of which
    /// (`OnboardingViewModel`) is created per screen and observed by nothing above it. Every
    /// writer goes through `setString`, so publishing here catches all of them without each
    /// one having to remember.
    public let languageDidChange = PassthroughSubject<String, Never>()

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    // MARK: - Typed accessors

    public func string(_ key: PrefKey) -> String? {
        defaults.string(forKey: key.namespaced)
    }

    public func setString(_ value: String?, _ key: PrefKey) {
        let previous = key == .selectedLanguageCode ? defaults.string(forKey: key.namespaced) : nil
        if let value {
            defaults.set(value, forKey: key.namespaced)
        } else {
            defaults.removeObject(forKey: key.namespaced)
        }
        // Only on an actual change: the language is re-written on several paths that often
        // set the same value (session restore, label reload), and each one would otherwise
        // rebuild the theme for nothing.
        if key == .selectedLanguageCode, let value, value != previous {
            languageDidChange.send(value)
        }
    }

    public func bool(_ key: PrefKey) -> Bool {
        defaults.bool(forKey: key.namespaced)
    }

    /// Like ``bool(_:)`` but returns `defaultValue` when the key was never written.
    public func bool(_ key: PrefKey, default defaultValue: Bool) -> Bool {
        defaults.object(forKey: key.namespaced) == nil ? defaultValue : defaults.bool(forKey: key.namespaced)
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
