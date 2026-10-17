import Foundation

// MARK: - Supported languages (#2)

public struct SupportedLanguageGroup: Codable, Sendable {
    public var displayName: String?
    public var flag: String?
    public var priorityView: [SupportedLanguage]?
    public var expandedView: [SupportedLanguage]?

    enum CodingKeys: String, CodingKey {
        case displayName = "display_name"
        case flag
        case priorityView = "priority_view"
        case expandedView = "expanded_view"
    }
}

public struct SupportedLanguage: Codable, Sendable, Identifiable, Hashable {
    @LossyOptional public var rawId: FlexibleID?
    public var name: String?
    public var code: String?
    public var bcpCode: String?
    public var latnCode: String?
    public var displayName: String?
    public var flag: String?
    public var ttsVoiceName: String?
    public var asrEnabled: Bool?
    public var ttsEnabled: Bool?
    public var countryPhoneCode: String?
    /// App `SupportedLanguage.streaming_required` (default true when absent). Persisted under
    /// ``PrefKey/streamingRequired`` when the language is selected and sent on every text query
    /// as ``TextPromptRequest/streamingRequired``. Without it stage answers the agentic endpoint
    /// in one `done` event; with it stage streams `status` + `text_delta` events.
    public var streamingRequired: Bool?

    enum CodingKeys: String, CodingKey {
        case rawId = "id"
        case name, code, bcpCode, latnCode
        case displayName = "display_name"
        case flag, ttsVoiceName
        case asrEnabled = "asr_enabled"
        case ttsEnabled = "tts_enabled"
        case countryPhoneCode = "country_phone_code"
        case streamingRequired = "streaming_required"
    }

    public var id: Int { rawId?.intValue ?? -1 }

    public static func == (lhs: SupportedLanguage, rhs: SupportedLanguage) -> Bool {
        lhs.id == rhs.id && lhs.code == rhs.code
    }

    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
        hasher.combine(code)
    }
}

// MARK: - Set preferred language (#6)

public struct SetPreferredLanguageRequest: Codable, Sendable {
    public var userId: String
    public var languageId: Int

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case languageId = "language_id"
    }

    public init(userId: String, languageId: Int) {
        self.userId = userId
        self.languageId = languageId
    }
}

public struct SetPreferredLanguageResponse: Codable, Sendable {
    @LossyOptional public var userId: FlexibleID?
    public var message: String?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case message
    }
}

// MARK: - Legal links (#4)

/// Endpoint #4 (`api/user/privacy_policy/`), exactly as the app's
/// `domain/model/privacypolicy/PrivacyPolicyResponse.kt`: `url` is the privacy policy and
/// `farmerchat_terms_of_use` the terms (GetSupportedLanguagesUseCase.kt:76-77).
///
/// The SDK decoded `privacy_policy` / `terms_of_use` — fields #4 does not send — so both links
/// were always nil: the language screen's legal links were empty and Sign up opened a guessed URL.
public struct PrivacyPolicyResponse: Codable, Sendable {
    public var url: String?
    public var leaderboardPrivacyPolicyUrl: String?
    public var farmerchatTermsOfUse: String?
    public var leaderboardTermsOfUse: String?
    public var message: String?

    /// The privacy-policy link (`url`). Kept for source compatibility.
    public var privacyPolicy: String? {
        get { url }
        set { url = newValue }
    }

    /// The terms-of-use link (`farmerchat_terms_of_use`). Kept for source compatibility.
    public var termsOfUse: String? {
        get { farmerchatTermsOfUse }
        set { farmerchatTermsOfUse = newValue }
    }

    enum CodingKeys: String, CodingKey {
        case url
        case leaderboardPrivacyPolicyUrl = "leaderboard_privacy_policy_url"
        case farmerchatTermsOfUse = "farmerchat_terms_of_use"
        case leaderboardTermsOfUse = "leaderboard_terms_of_use"
        case message
    }
}

// MARK: - Countries (#5)

public struct CountryItem: Codable, Sendable, Identifiable, Hashable {
    @LossyOptional public var rawId: FlexibleID?
    public var code: String?
    public var displayName: String?
    public var flag: String?
    public var name: String?
    public var phoneCountryCode: String?
    @LossyOptional public var phoneLength: Int?
    public var phoneNumberPattern: String?

    /// `flag` is an IMAGE URL on the live API (the app renders it with `flagUrl`, AuthScreen.kt:448);
    /// it was printed as text ("https://s3-ap-south-1…  +91"). The URL when it is one, else nil.
    public var flagImageURL: URL? {
        guard let flag, flag.hasPrefix("http") else { return nil }
        return URL(string: flag)
    }

    /// `flag` when it is a literal (emoji) flag, else nil — safe to print as text.
    public var flagText: String? {
        guard let flag, !flag.isEmpty, !flag.hasPrefix("http") else { return nil }
        return flag
    }

    enum CodingKeys: String, CodingKey {
        case rawId = "id"
        case code
        case displayName = "display_name"
        case flag, name
        case phoneCountryCode = "phone_country_code"
        case phoneLength = "phone_length"
        case phoneNumberPattern = "phone_number_pattern"
    }

    public var id: String { rawId?.stringValue ?? (code ?? UUID().uuidString) }

    public static func == (lhs: CountryItem, rhs: CountryItem) -> Bool {
        lhs.code == rhs.code && lhs.phoneCountryCode == rhs.phoneCountryCode
    }

    public func hash(into hasher: inout Hasher) {
        hasher.combine(code)
        hasher.combine(phoneCountryCode)
    }
}
