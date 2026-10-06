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

public struct GetLocationResponse: Codable, Sendable {
    public var message: String?
    public var country: String?
    public var state: String?
    public var district: String?
    public var error: Bool?
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
