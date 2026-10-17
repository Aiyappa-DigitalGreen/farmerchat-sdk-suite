import Foundation

// MARK: - Accept terms (#7)

public struct AcceptPPandTCRequest: Codable, Sendable {
    public var userId: String

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
    }

    public init(userId: String) {
        self.userId = userId
    }
}

public struct AcceptPPandTCResponse: Codable, Sendable {
    public var message: String?
    @LossyOptional public var userId: FlexibleID?

    enum CodingKeys: String, CodingKey {
        case message
        case userId = "user_id"
    }
}

// MARK: - Update profile / name (#8)

public struct LiveStockDetail: Codable, Sendable, Hashable {
    @LossyOptional public var id: FlexibleID?
    public var name: String?
    @LossyOptional public var count: Int?

    public init(id: FlexibleID? = nil, name: String? = nil, count: Int? = nil) {
        self.id = id
        self.name = name
        self.count = count
    }
}

public struct UserNameRequest: Codable, Sendable {
    public var age: Int?
    public var farmerReachCount: Int?
    public var gender: String?
    public var landHolding: Double?
    public var liveStockDetails: [LiveStockDetail]?
    public var name: String?
    public var profilePicture: String?
    public var receiveComViaWhatsapp: Bool?
    public var role: String?
    public var specialization: String?
    public var userId: String

    enum CodingKeys: String, CodingKey {
        case age
        case farmerReachCount = "farmer_reach_count"
        case gender
        case landHolding = "land_holding"
        case liveStockDetails = "live_stock_details"
        case name
        case profilePicture = "profile_picture"
        case receiveComViaWhatsapp = "receive_com_via_whatsapp"
        case role, specialization
        case userId = "user_id"
    }

    public init(
        userId: String,
        name: String? = nil,
        age: Int? = nil,
        gender: String? = nil,
        farmerReachCount: Int? = nil,
        landHolding: Double? = nil,
        liveStockDetails: [LiveStockDetail]? = nil,
        profilePicture: String? = nil,
        receiveComViaWhatsapp: Bool? = nil,
        role: String? = nil,
        specialization: String? = nil
    ) {
        self.userId = userId
        self.name = name
        self.age = age
        self.gender = gender
        self.farmerReachCount = farmerReachCount
        self.landHolding = landHolding
        self.liveStockDetails = liveStockDetails
        self.profilePicture = profilePicture
        self.receiveComViaWhatsapp = receiveComViaWhatsapp
        self.role = role
        self.specialization = specialization
    }
}

public struct UserNameResponse: Codable, Sendable {
    public var message: String?
    public var name: String?
    @LossyOptional public var userId: FlexibleID?
    public var error: Bool?

    enum CodingKeys: String, CodingKey {
        case message, name, error
        case userId = "user_id"
    }
}

// MARK: - Profile (#9)

public struct FarmerProfile: Codable, Sendable {
    public var userProfile: UserProfile?
    public var roleAssigned: Bool?

    enum CodingKeys: String, CodingKey {
        case userProfile = "user_profile"
        case roleAssigned = "role_assigned"
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        // Backend has shipped both `user_profile` and a camelCase variant.
        if let profile = try? container.decodeIfPresent(UserProfile.self, forKey: .userProfile) {
            userProfile = profile
        } else {
            let dynamic = try decoder.container(keyedBy: DynamicKey.self)
            userProfile = try? dynamic.decodeIfPresent(UserProfile.self, forKey: DynamicKey(stringValue: "userProfile")!)
        }
        roleAssigned = try? container.decodeIfPresent(Bool.self, forKey: .roleAssigned)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(userProfile, forKey: .userProfile)
        try container.encodeIfPresent(roleAssigned, forKey: .roleAssigned)
    }

    private struct DynamicKey: CodingKey {
        var stringValue: String
        var intValue: Int? { nil }
        init?(stringValue: String) { self.stringValue = stringValue }
        init?(intValue: Int) { return nil }
    }
}

public struct UserProfile: Codable, Sendable {
    public var address: Address?
    @LossyOptional public var age: Int?
    public var country: String?
    public var cropDetails: [Crop]?
    public var farmlandDetails: [FarmlandDetails]?
    public var firstName: String?
    public var lastName: String?
    public var gender: String?
    public var geographyLevel2: String?
    // Present in the app's `FarmerProfile` (#9) and in android's `ProfileUser`, but omitted from
    // this port until now. They are the readable place names the location pill needs — the bare
    // `geographyLevel2` is an id — so `HomeViewModel.fetchUserProfile` could not backfill without
    // them. Field names are the wire's, unchanged.
    public var geographyLevel2Name: String?
    public var countryName: String?
    public var geographyLevel3: String?
    public var geographyLevel4: String?
    public var geographyLevel5: String?
    public var geographyLevel6: String?
    @LossyOptional public var id: FlexibleID?
    @LossyOptional public var landHolding: Double?
    public var lat: Double?
    public var long: Double?
    public var liveStockDetails: [LiveStockDetail]?
    public var llmModel: String?
    public var memory: [Memory]?
    public var preferredLanguage: PreferredLanguage?
    public var phone: String?
    public var phoneCountryCode: String?
    public var profilePicture: String?
    public var receiveComViaWhatsapp: Bool?
    public var role: Role?
    public var showFeedbackPrompt: Bool?
    public var specialization: String?
    @LossyOptional public var userId: FlexibleID?

    enum CodingKeys: String, CodingKey {
        case address, age, country
        case cropDetails = "crop_details"
        case farmlandDetails = "farmland_details"
        case firstName = "first_name"
        case lastName = "last_name"
        case gender
        case geographyLevel2 = "geography_level2"
        case geographyLevel2Name = "geography_level2_name"
        case countryName = "country_name"
        case geographyLevel3 = "geography_level3"
        case geographyLevel4 = "geography_level4"
        case geographyLevel5 = "geography_level5"
        case geographyLevel6 = "geography_level6"
        case id
        case landHolding = "land_holding"
        case lat, long
        case liveStockDetails = "live_stock_details"
        case llmModel = "llm_model"
        case memory
        case preferredLanguage = "preferred_language"
        case phone
        case phoneCountryCode = "phone_country_code"
        case profilePicture = "profile_picture"
        case receiveComViaWhatsapp = "receive_com_via_whatsapp"
        case role
        case showFeedbackPrompt = "show_feedback_prompt"
        case specialization
        case userId = "user_id"
    }

    /// Display name the app derives (first + last, sanitized upstream).
    public var displayName: String? {
        let joined = [firstName, lastName].compactMap { $0 }.joined(separator: " ").trimmingCharacters(in: .whitespaces)
        return joined.isEmpty ? nil : joined
    }
}

public struct Address: Codable, Sendable {
    public var displayAddress: String?
    public var country: String?
    public var state: String?
    public var district: String?

    enum CodingKeys: String, CodingKey {
        case displayAddress = "display_address"
        case country, state, district
    }
}

public struct Crop: Codable, Sendable, Hashable {
    @LossyOptional public var id: FlexibleID?
    public var name: String?
    public var displayName: String?

    enum CodingKeys: String, CodingKey {
        case id, name
        case displayName = "display_name"
    }

    public init(id: FlexibleID? = nil, name: String? = nil, displayName: String? = nil) {
        self.id = id
        self.name = name
        self.displayName = displayName
    }
}

public struct FarmlandDetails: Codable, Sendable {
    @LossyOptional public var id: FlexibleID?
    public var name: String?
    @LossyOptional public var area: Double?
    public var unit: String?
}

public struct Memory: Codable, Sendable {
    @LossyOptional public var id: FlexibleID?
    public var content: String?
    public var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, content
        case createdAt = "created_at"
    }
}

public struct Role: Codable, Sendable {
    @LossyOptional public var id: FlexibleID?
    public var name: String?
    public var displayName: String?

    enum CodingKeys: String, CodingKey {
        case id, name
        case displayName = "display_name"
    }
}

// MARK: - Build version (#10)

public struct UpdateBuildVersionRequest: Codable, Sendable {
    public var userId: String
    public var buildVersion: String?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case buildVersion = "build_version"
    }

    public init(userId: String, buildVersion: String? = "v2") {
        self.userId = userId
        self.buildVersion = buildVersion
    }
}

public struct UpdateBuildVersionResponse: Codable, Sendable {
    public var message: String?
}

// MARK: - Location (#11)

public struct UpdateLocationRequest: Codable, Sendable {
    public var lat: Double?
    public var long: Double?
    public var userId: String
    public var country: String?
    public var level2: String?
    public var level3: String?
    public var level4: String?
    public var level5: String?
    public var level6: String?
    public var displayAddress: String?
    public var osmResponse: JSONValue?

    enum CodingKeys: String, CodingKey {
        case lat, long
        case userId = "user_id"
        case country
        case level2 = "level_2"
        case level3 = "level_3"
        case level4 = "level_4"
        case level5 = "level_5"
        case level6 = "level_6"
        case displayAddress = "display_address"
        case osmResponse = "osm_response"
    }

    /// `lat`/`long` go on the wire as strings, as the app sends them
    /// (`UpdateLocationRequest(lat: String?, long: String?)`) and as the Android SDK does. Numbers
    /// made DEMO fail the weather question re-sent after a GPS share (2026-10-16).
    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(lat.map { String($0) }, forKey: .lat)
        try c.encodeIfPresent(long.map { String($0) }, forKey: .long)
        try c.encode(userId, forKey: .userId)
        try c.encodeIfPresent(country, forKey: .country)
        try c.encodeIfPresent(level2, forKey: .level2)
        try c.encodeIfPresent(level3, forKey: .level3)
        try c.encodeIfPresent(level4, forKey: .level4)
        try c.encodeIfPresent(level5, forKey: .level5)
        try c.encodeIfPresent(level6, forKey: .level6)
        try c.encodeIfPresent(displayAddress, forKey: .displayAddress)
        try c.encodeIfPresent(osmResponse, forKey: .osmResponse)
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        func coord(_ key: CodingKeys) throws -> Double? {
            if let d = try? c.decodeIfPresent(Double.self, forKey: key) { return d }
            return try c.decodeIfPresent(String.self, forKey: key).flatMap(Double.init)
        }
        lat = try coord(.lat)
        long = try coord(.long)
        userId = try c.decode(String.self, forKey: .userId)
        country = try c.decodeIfPresent(String.self, forKey: .country)
        level2 = try c.decodeIfPresent(String.self, forKey: .level2)
        level3 = try c.decodeIfPresent(String.self, forKey: .level3)
        level4 = try c.decodeIfPresent(String.self, forKey: .level4)
        level5 = try c.decodeIfPresent(String.self, forKey: .level5)
        level6 = try c.decodeIfPresent(String.self, forKey: .level6)
        displayAddress = try c.decodeIfPresent(String.self, forKey: .displayAddress)
        osmResponse = try c.decodeIfPresent(JSONValue.self, forKey: .osmResponse)
    }

    public init(
        userId: String,
        lat: Double? = nil,
        long: Double? = nil,
        country: String? = nil,
        level2: String? = nil,
        level3: String? = nil,
        level4: String? = nil,
        level5: String? = nil,
        level6: String? = nil,
        displayAddress: String? = nil,
        osmResponse: JSONValue? = nil
    ) {
        self.userId = userId
        self.lat = lat
        self.long = long
        self.country = country
        self.level2 = level2
        self.level3 = level3
        self.level4 = level4
        self.level5 = level5
        self.level6 = level6
        self.displayAddress = displayAddress
        self.osmResponse = osmResponse
    }
}

/// #11 `update_user_location` reply. The app's model (`domain/model/location/GetLocationResponse.kt`)
/// is `{ error_message, user_profile { country_name, geography_level2_name, geography_level3, … } }`;
/// the flat `country` / `state` / `district` fields below were never sent, so a shared location
/// was not stored and the chat's location bubble kept showing the PREVIOUS place. Kept for
/// source compatibility; read ``userProfile``.
public struct GetLocationResponse: Codable, Sendable {
    public var message: String?
    public var country: String?
    public var state: String?
    public var district: String?
    public var error: Bool?
    public var errorMessage: String? = nil
    public var userProfile: LocationUserProfile? = nil

    enum CodingKeys: String, CodingKey {
        case message, country, state, district, error
        case errorMessage = "error_message"
        case userProfile = "user_profile"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        message = try? c.decodeIfPresent(String.self, forKey: .message)
        country = try? c.decodeIfPresent(String.self, forKey: .country)
        state = try? c.decodeIfPresent(String.self, forKey: .state)
        district = try? c.decodeIfPresent(String.self, forKey: .district)
        error = try? c.decodeIfPresent(Bool.self, forKey: .error)
        errorMessage = try? c.decodeIfPresent(String.self, forKey: .errorMessage)
        userProfile = try? c.decodeIfPresent(LocationUserProfile.self, forKey: .userProfile)
    }

    init(message: String?, country: String?, state: String?, district: String?, error: Bool?,
         errorMessage: String? = nil, userProfile: LocationUserProfile? = nil) {
        self.message = message
        self.country = country
        self.state = state
        self.district = district
        self.error = error
        self.errorMessage = errorMessage
        self.userProfile = userProfile
    }

    /// The resolved place: `user_profile` first (the real wire), else the legacy flat fields.
    public var resolvedCountryName: String? { userProfile?.countryName?.nonBlank ?? country?.nonBlank }
    public var resolvedState: String? { userProfile?.geographyLevel2Name?.nonBlank ?? state?.nonBlank }
    public var resolvedDistrict: String? { userProfile?.geographyLevel3?.nonBlank ?? district?.nonBlank }
}

/// `user_profile` of the #11 reply (app `UserProfile` in GetLocationResponse.kt).
public struct LocationUserProfile: Codable, Sendable, Equatable {
    public var userId: String?
    public var countryName: String?
    public var countryCode: String?
    public var geographyLevel2Name: String?
    public var geographyLevel3: String?
    public var displayAddress: String?
    @LossyOptional public var latitude: Double?
    @LossyOptional public var longitude: Double?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case countryName = "country_name"
        case countryCode = "country_code"
        case geographyLevel2Name = "geography_level2_name"
        case geographyLevel3 = "geography_level3"
        case displayAddress = "display_address"
        case latitude, longitude
    }

    public init(userId: String? = nil, countryName: String? = nil, countryCode: String? = nil,
                geographyLevel2Name: String? = nil, geographyLevel3: String? = nil,
                displayAddress: String? = nil, latitude: Double? = nil, longitude: Double? = nil) {
        self.userId = userId
        self.countryName = countryName
        self.countryCode = countryCode
        self.geographyLevel2Name = geographyLevel2Name
        self.geographyLevel3 = geographyLevel3
        self.displayAddress = displayAddress
        self.latitude = latitude
        self.longitude = longitude
    }
}

// MARK: - Question count (#34)

public struct UserQuestionCountResponse: Codable, Sendable {
    @LossyOptional public var totalQuestionsAsked: Int?
    public var bypassInterstitial: Bool?

    enum CodingKeys: String, CodingKey {
        case totalQuestionsAsked = "total_questions_asked"
        case bypassInterstitial = "bypass_interstitial"
    }
}
