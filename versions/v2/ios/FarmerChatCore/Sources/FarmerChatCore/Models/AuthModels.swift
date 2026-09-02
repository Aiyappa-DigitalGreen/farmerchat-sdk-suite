import Foundation

// MARK: - Guest init (#1)

public struct InitializeGuestUserRequest: Codable, Sendable {
    public var deviceId: String
    public var lat: Double?
    public var long: Double?
    public var accuracy: Double?
    public var utmSource: String?
    public var utmMedium: String?
    public var utmCampaign: String?
    public var moengageId: String?
    public var googleAdvertiseId: String?

    enum CodingKeys: String, CodingKey {
        case deviceId = "device_id"
        case lat, long, accuracy
        case utmSource = "utm_source"
        case utmMedium = "utm_medium"
        case utmCampaign = "utm_campaign"
        case moengageId = "moengage_id"
        case googleAdvertiseId = "google_advertise_id"
    }

    public init(
        deviceId: String,
        lat: Double? = nil,
        long: Double? = nil,
        accuracy: Double? = nil,
        utmSource: String? = nil,
        utmMedium: String? = nil,
        utmCampaign: String? = nil,
        moengageId: String? = nil,
        googleAdvertiseId: String? = nil
    ) {
        self.deviceId = deviceId
        self.lat = lat
        self.long = long
        self.accuracy = accuracy
        self.utmSource = utmSource
        self.utmMedium = utmMedium
        self.utmCampaign = utmCampaign
        self.moengageId = moengageId
        self.googleAdvertiseId = googleAdvertiseId
    }
}

public struct InitializeGuestUserResponse: Codable, Sendable {
    public var accessToken: String?
    public var refreshToken: String?
    @LossyOptional public var userId: FlexibleID?
    @FlexibleBool public var showCropsLivestocks: Bool?
    public var countryCode: String?
    public var country: String?
    public var state: String?
    public var dashboard: Bool?
    public var createdNow: Bool?
    @LossyOptional public var ipLocationFallbackTimeLimit: Int?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case userId = "user_id"
        case showCropsLivestocks = "show_crops_livestocks"
        case countryCode = "country_code"
        case country, state, dashboard
        case createdNow = "created_now"
        case ipLocationFallbackTimeLimit = "ip_location_fallback_time_limit"
    }
}

// MARK: - OTP (#17, #18, #19, #21)

public struct SendOtpRequest: Codable, Sendable {
    public var phone: String
    public var phoneCountryCode: String
    public var channel: [String]
    public var deviceId: String
    public var userId: String?

    enum CodingKeys: String, CodingKey {
        case phone
        case phoneCountryCode = "phone_country_code"
        case channel
        case deviceId = "device_id"
        case userId = "user_id"
    }

    public init(phone: String, phoneCountryCode: String, channel: [String], deviceId: String, userId: String?) {
        self.phone = phone
        self.phoneCountryCode = phoneCountryCode
        self.channel = channel
        self.deviceId = deviceId
        self.userId = userId
    }
}

public struct SendOtpResponse: Codable, Sendable {
    public var message: String?
    public var otp: String?
    public var error: Bool?
    @LossyOptional public var retryAfter: Int?

    enum CodingKeys: String, CodingKey {
        case message, otp, error
        case retryAfter = "retry_after"
    }
}

public struct CheckDeviceRequest: Codable, Sendable {
    public var deviceId: String
    public var phone: String?
    public var phoneCountryCode: String?

    enum CodingKeys: String, CodingKey {
        case deviceId = "device_id"
        case phone
        case phoneCountryCode = "phone_country_code"
    }

    public init(deviceId: String, phone: String? = nil, phoneCountryCode: String? = nil) {
        self.deviceId = deviceId
        self.phone = phone
        self.phoneCountryCode = phoneCountryCode
    }
}

public struct WhatsappVerificationRequest: Codable, Sendable {
    public var phoneCountryCode: String
    public var phone: String
    public var token: String

    enum CodingKeys: String, CodingKey {
        case phoneCountryCode = "phone_country_code"
        case phone, token
    }

    public init(phoneCountryCode: String, phone: String, token: String) {
        self.phoneCountryCode = phoneCountryCode
        self.phone = phone
        self.token = token
    }
}

public struct VerifyOtpRequest: Codable, Sendable {
    public var otp: String
    public var phone: String
    public var phoneCountryCode: String
    public var guestOnboarding: Bool
    public var userId: String?

    enum CodingKeys: String, CodingKey {
        case otp, phone
        case phoneCountryCode = "phone_country_code"
        case guestOnboarding = "guest_onboarding"
        case userId = "user_id"
    }

    public init(otp: String, phone: String, phoneCountryCode: String, guestOnboarding: Bool, userId: String?) {
        self.otp = otp
        self.phone = phone
        self.phoneCountryCode = phoneCountryCode
        self.guestOnboarding = guestOnboarding
        self.userId = userId
    }
}

public struct VerifyOtpResponse: Codable, Sendable {
    public var accessToken: String?
    public var refreshToken: String?
    @LossyOptional public var userId: FlexibleID?
    public var existingUser: Bool?
    public var message: String?
    public var error: Bool?
    public var preferredLanguage: PreferredLanguage?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case userId = "user_id"
        case existingUser = "existing_user"
        case message, error
        case preferredLanguage = "preferred_language"
    }
}

public struct PreferredLanguage: Codable, Sendable {
    @LossyOptional public var id: FlexibleID?
    public var code: String?
    public var displayName: String?
    public var asrBcpCode: String?
    public var asrEnabled: Bool?
    public var ttsBcpCode: String?
    public var ttsEnabled: Bool?
    public var ttsVoiceName: String?
    public var primarySpeakingCountries: [String]?

    enum CodingKeys: String, CodingKey {
        case id, code
        case displayName = "display_name"
        case asrBcpCode = "asr_bcp_code"
        case asrEnabled = "asr_enabled"
        case ttsBcpCode = "tts_bcp_code"
        case ttsEnabled = "tts_enabled"
        case ttsVoiceName = "tts_voice_name"
        case primarySpeakingCountries = "primary_speaking_countries"
    }
}

// MARK: - Communication channels (#20)

public struct CommunicationChannel: Codable, Sendable {
    public var smsEnabled: Bool?
    public var whatsappEnabled: Bool?

    enum CodingKeys: String, CodingKey {
        case smsEnabled = "sms_enabled"
        case whatsappEnabled = "whatsapp_enabled"
    }
}

// MARK: - Token endpoints (AuthApi)

public struct RefreshTokenRequest: Codable, Sendable {
    public var refreshToken: String

    enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
    }

    public init(refreshToken: String) {
        self.refreshToken = refreshToken
    }
}

public struct RefreshTokenResponse: Codable, Sendable {
    public var accessToken: String?
    public var refreshToken: String?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
    }
}

public struct SendNewTokenRequest: Codable, Sendable {
    public var deviceId: String
    public var userId: String?

    enum CodingKeys: String, CodingKey {
        case deviceId = "device_id"
        case userId = "user_id"
    }

    public init(deviceId: String, userId: String?) {
        self.deviceId = deviceId
        self.userId = userId
    }
}

// MARK: - Logout (#23)

public struct LogoutResponse: Codable, Sendable {
    public var message: String?
}
