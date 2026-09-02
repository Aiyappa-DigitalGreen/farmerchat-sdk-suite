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

    /// Feed with host-unrenderable sections removed.
    ///
    /// `plotline_widget` sections carry only `type`/`unique_key`/`label` — no headline, image or
    /// statement id (verified live 2026-09-01: 14 of 21 prod sections were these). The app renders
    /// them with `PlotlineComposeWidget`, but root CLAUDE.md §6 forbids Plotline inside SDK
    /// packages, so the SDK DROPS them rather than rendering blank cards.
    public func renderableSections() -> [SectionDto] {
        (sections ?? []).filter { !$0.isHostOnlyWidget }
    }
}

public struct SectionDto: Codable, Sendable, Identifiable {
    /// True for sections the SDK deliberately cannot render (third-party host widgets).
    /// See `HomeUdfResponse.renderableSections()`.
    public var isHostOnlyWidget: Bool { type?.lowercased() == "plotline_widget" }

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
    // App parity (WeatherResponse.kt): these are Strings, rendered verbatim.
    @LossyOptional public var currentTemp: String?
    @LossyOptional public var precipitationProbability: String?
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

/// A #26 follow-up item. The wire sends objects
/// `{follow_up_question_id, sequence, question}`; a bare string is tolerated.
public struct HomeFollowUpQuestion: Codable, Sendable {
    public let text: String
    public let sequence: Int?

    enum CodingKeys: String, CodingKey { case question, sequence }

    public init(from decoder: Decoder) throws {
        if let single = try? decoder.singleValueContainer(), let s = try? single.decode(String.self) {
            text = s
            sequence = nil
            return
        }
        let c = try decoder.container(keyedBy: CodingKeys.self)
        text = (try? c.decode(String.self, forKey: .question)) ?? ""
        sequence = try? c.decode(Int.self, forKey: .sequence)
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(text, forKey: .question)
        try c.encodeIfPresent(sequence, forKey: .sequence)
    }
}

public struct ImageStatementResponse: Codable, Sendable {
    public var shortAnswer: String?
    /// Raw #26 follow-up items (string OR {question, sequence} object). The old
    /// `[String]` typing threw typeMismatch on the object form and broke decode.
    public var followUpQuestionsRaw: [HomeFollowUpQuestion]?
    @LossyOptional public var messageId: FlexibleID?
    @LossyOptional public var conversationId: FlexibleID?
    public var error: Bool?
    public var message: String?

    enum CodingKeys: String, CodingKey {
        case shortAnswer = "short_answer"
        case followUpQuestionsRaw = "follow_up_questions"
        case messageId = "message_id"
        case conversationId = "conversation_id"
        case error, message
    }

    /// Display strings, sorted by `sequence` (app parity).
    public var followUpQuestions: [String]? {
        guard let raw = followUpQuestionsRaw else { return nil }
        return raw.sorted { ($0.sequence ?? 0) < ($1.sequence ?? 0) }.map { $0.text }.filter { !$0.isEmpty }
    }
}
