import Foundation

// MARK: - Home feed (#12)

public struct HomeUdfResponse: Codable, Sendable {
    public var greeting: String?
    public var sections: [SectionDto]?
    public var ssfrEnable: Bool?

    enum CodingKeys: String, CodingKey {
        case greeting, sections
        case ssfrEnable = "ssfr_enable"
    }

    public init(greeting: String? = nil, sections: [SectionDto]? = nil, ssfrEnable: Bool? = nil) {
        self.greeting = greeting
        self.sections = sections
        self.ssfrEnable = ssfrEnable
    }
}

public struct SectionDto: Codable, Sendable, Identifiable {
    public var type: String?
    @LossyOptional public var rawId: FlexibleID?
    public var imageUrl: String?
    public var title: String?
    public var questionText: String?
    @LossyOptional public var statementId: FlexibleID?
    public var badge: SectionBadge?
    public var cta: SectionCta?
    public var statement: String?
    public var selectionType: String?
    public var options: [SectionOption]?
    public var statementType: String?
    public var isViewed: Bool?
    public var meta: JSONValue?
    public var uniqueKey: String?
    public var label: String?

    enum CodingKeys: String, CodingKey {
        case type
        case rawId = "id"
        case imageUrl = "image_url"
        case title
        case questionText = "question_text"
        case statementId = "statement_id"
        case badge, cta, statement
        case selectionType = "selection_type"
        case options
        case statementType = "statement_type"
        case isViewed = "is_viewed"
        case meta
        case uniqueKey = "unique_key"
        case label
    }

    /// Stable section identity used for dismissal bookkeeping.
    public var id: String {
        rawId?.stringValue ?? uniqueKey ?? statementId?.stringValue ?? (title ?? UUID().uuidString)
    }
}

public struct SectionBadge: Codable, Sendable {
    public var icon: String?
    @LossyOptional public var count: Int?
    public var show: Bool?
}

public struct SectionCta: Codable, Sendable {
    public var text: String?
    public var action: String?
}

public struct SectionOption: Codable, Sendable, Identifiable, Hashable {
    @LossyOptional public var rawId: FlexibleID?
    public var text: String?

    enum CodingKeys: String, CodingKey {
        case rawId = "id"
        case text
    }

    public var id: String { rawId?.stringValue ?? (text ?? UUID().uuidString) }
}

// MARK: - Weather (#13)

public struct WeatherRequest: Codable, Sendable {
    public var userId: String?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
    }

    public init(userId: String?) {
        self.userId = userId
    }
}

public struct WeatherResponse: Codable, Sendable {
    @LossyOptional public var currentTemp: Double?
    @LossyOptional public var precipitationProbability: Double?
    public var weatherIcon: String?
    public var message: String?

    enum CodingKeys: String, CodingKey {
        case currentTemp = "current_temp"
        case precipitationProbability = "precipitation_probability"
        case weatherIcon = "weather_icon"
        case message
    }
}

// MARK: - Crops (#14)

public struct CropDetailPayload: Codable, Sendable {
    public var cropId: Int

    enum CodingKeys: String, CodingKey {
        case cropId = "crop_id"
    }

    public init(cropId: Int) {
        self.cropId = cropId
    }
}

public struct SetCultivatedCropsRequest: Codable, Sendable {
    public var userId: String
    public var cropDetails: [CropDetailPayload]

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case cropDetails = "crop_details"
    }

    public init(userId: String, cropDetails: [CropDetailPayload]) {
        self.userId = userId
        self.cropDetails = cropDetails
    }
}

public struct CropResponse: Codable, Sendable {
    public var message: String?
}

// MARK: - Image cards (#25, #26)

public struct ImageViewedRequest: Codable, Sendable {
    public var statementId: FlexibleID
    public var userId: String
    public var status: String

    enum CodingKeys: String, CodingKey {
        case statementId = "statement_id"
        case userId = "user_id"
        case status
    }

    public init(statementId: FlexibleID, userId: String, status: String = "viewed") {
        self.statementId = statementId
        self.userId = userId
        self.status = status
    }
}

public struct ImageViewedResponse: Codable, Sendable {
    public var message: String?
}

public struct ImageStatementRequest: Codable, Sendable {
    public var statementId: FlexibleID
    public var triggeredInputType: String

    enum CodingKeys: String, CodingKey {
        case statementId = "statement_id"
        case triggeredInputType = "triggered_input_type"
    }

    public init(statementId: FlexibleID, triggeredInputType: String) {
        self.statementId = statementId
        self.triggeredInputType = triggeredInputType
    }
}

public struct ImageStatementResponse: Codable, Sendable {
    public var shortAnswer: String?
    public var followUpQuestions: [String]?
    @LossyOptional public var messageId: FlexibleID?
    @LossyOptional public var conversationId: FlexibleID?
    public var error: Bool?
    public var message: String?

    enum CodingKeys: String, CodingKey {
        case shortAnswer = "short_answer"
        case followUpQuestions = "follow_up_questions"
        case messageId = "message_id"
        case conversationId = "conversation_id"
        case error, message
    }
}
