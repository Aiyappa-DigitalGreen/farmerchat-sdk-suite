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

public struct PrivacyPolicyResponse: Codable, Sendable {
    public var privacyPolicy: String?
    public var termsOfUse: String?
    public var message: String?

    enum CodingKeys: String, CodingKey {
        case privacyPolicy = "privacy_policy"
        case termsOfUse = "terms_of_use"
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
