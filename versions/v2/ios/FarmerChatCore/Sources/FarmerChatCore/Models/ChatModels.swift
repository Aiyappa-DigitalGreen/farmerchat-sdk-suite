import Foundation

// MARK: - New conversation (#15)

public struct NewConversationRequest: Codable, Sendable {
    public var userId: String
    public var contentProviderId: Int?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case contentProviderId = "content_provider_id"
    }

    public init(userId: String, contentProviderId: Int? = nil) {
        self.userId = userId
        self.contentProviderId = contentProviderId
    }
}

public struct NewConversationResponse: Codable, Sendable {
    @LossyOptional public var conversationId: FlexibleID?
    public var message: String?
    public var showPopup: Bool?

    enum CodingKeys: String, CodingKey {
        case conversationId = "conversation_id"
        case message
        case showPopup = "show_popup"
    }
}

// MARK: - Transcription / STT (#16)

public struct SetVoiceRequest: Codable, Sendable {
    public var conversationId: String
    /// Base64-encoded audio payload.
    public var query: String
    public var messageReferenceId: String
    public var inputAudioEncodingFormat: String
    public var triggeredInputType: String
    public var editableTranscription: String

    enum CodingKeys: String, CodingKey {
        case conversationId = "conversation_id"
        case query
        case messageReferenceId = "message_reference_id"
        case inputAudioEncodingFormat = "input_audio_encoding_format"
        case triggeredInputType = "triggered_input_type"
        case editableTranscription = "editable_transcription"
    }

    public init(
        conversationId: String,
        query: String,
        messageReferenceId: String,
        inputAudioEncodingFormat: String,
        triggeredInputType: String,
        editableTranscription: String = "True"
    ) {
        self.conversationId = conversationId
        self.query = query
        self.messageReferenceId = messageReferenceId
        self.inputAudioEncodingFormat = inputAudioEncodingFormat
        self.triggeredInputType = triggeredInputType
        self.editableTranscription = editableTranscription
    }
}

public struct GetVoiceResponse: Codable, Sendable {
    public var heardInputQuery: String?
    @LossyOptional public var confidenceScore: Double?
    public var error: Bool?
    @LossyOptional public var messageId: FlexibleID?
    @LossyOptional public var transcriptionId: FlexibleID?
    public var message: String?

    enum CodingKeys: String, CodingKey {
        case heardInputQuery = "heard_input_query"
        case confidenceScore = "confidence_score"
        case error
        case messageId = "message_id"
        case transcriptionId = "transcription_id"
        case message
    }

    /// Accept transcription only when `!error && confidence > 0.7 && text not blank`.
    public var isAcceptable: Bool {
        guard error != true,
              let text = heardInputQuery?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty,
              let confidence = confidenceScore, confidence > 0.7 else {
            return false
        }
        return true
    }
}

// MARK: - Main AI answer (#27)

public struct TextPromptRequest: Codable, Sendable {
    public var query: String
    public var conversationId: String
    public var messageId: String
    public var statementId: FlexibleID?
    public var weatherCtaTriggered: Bool
    public var triggeredInputType: String
    public var ssfrCrop: String?
    public var useEntityExtraction: Bool
    public var transcriptionId: String?
    public var retry: Bool

    enum CodingKeys: String, CodingKey {
        case query
        case conversationId = "conversation_id"
        case messageId = "message_id"
        case statementId = "statement_id"
        case weatherCtaTriggered = "weather_cta_triggered"
        case triggeredInputType = "triggered_input_type"
        case ssfrCrop = "ssfr_crop"
        case useEntityExtraction = "use_entity_extraction"
        case transcriptionId = "transcription_id"
        case retry
    }

    public init(
        query: String,
        conversationId: String,
        messageId: String,
        statementId: FlexibleID? = nil,
        weatherCtaTriggered: Bool = false,
        triggeredInputType: String,
        ssfrCrop: String? = nil,
        useEntityExtraction: Bool = true,
        transcriptionId: String? = nil,
        retry: Bool = false
    ) {
        self.query = query
        self.conversationId = conversationId
        self.messageId = messageId
        self.statementId = statementId
        self.weatherCtaTriggered = weatherCtaTriggered
        self.triggeredInputType = triggeredInputType
        self.ssfrCrop = ssfrCrop
        self.useEntityExtraction = useEntityExtraction
        self.transcriptionId = transcriptionId
        self.retry = retry
    }
}

/// Mirrors the app's `IntentClassificationOutput` (TextPromptResponse.kt).
public struct IntentClassificationOutput: Codable, Sendable {
    public var assetName: String?
    public var assetStatus: String?
    public var assetType: String?
    public var clarificationNeeded: ClarificationNeeded?
    public var concern: String?
    public var confidence: String?
    public var intent: String?
    public var likelyActivity: String?
    public var rephrasedQuery: String?
    public var seasonalRelevance: String?
    public var stage: String?

    enum CodingKeys: String, CodingKey {
        case assetName = "asset_name"
        case assetStatus = "asset_status"
        case assetType = "asset_type"
        case clarificationNeeded = "clarification_needed"
        case concern, confidence, intent
        case likelyActivity = "likely_activity"
        case rephrasedQuery = "rephrased_query"
        case seasonalRelevance = "seasonal_relevance"
        case stage
    }
}

/// Mirrors the app's `ClarificationNeeded` (TextPromptResponse.kt).
public struct ClarificationNeeded: Codable, Sendable {
    public var additionalContext: String?
    public var asset: Bool?
    public var concern: Bool?

    enum CodingKeys: String, CodingKey {
        case additionalContext = "additional_context"
        case asset, concern
    }
}

public struct TextPromptResponse: Codable, Sendable {
    public var error: Bool?
    public var message: String?
    @LossyOptional public var messageId: FlexibleID?
    public var query: String?
    public var response: String?
    public var resourceUrl: String?
    public var translatedResponse: String?
    /// Always null in practice — real follow-ups come from endpoint #29.
    public var followUpQuestions: [String]?
    @LossyOptional public var sectionMessageId: FlexibleID?
    public var actualContentProvider: String?
    public var contentProviderLogo: String?
    public var hideFeedbackIcons: Bool?
    public var hideFollowUpQuestion: Bool?
    public var hideShareIcon: Bool?
    public var hideTtsSpeaker: Bool?
    public var hideSource: Bool?
    @LossyOptional public var points: Int?
    public var intentClassificationOutput: IntentClassificationOutput?
    /// Server-driven alignment surface (clarify / confirm / escalate) — **2.0.0**. Present when
    /// the backend needs the user to disambiguate, confirm, or respond to an urgent situation
    /// instead of (or before) giving a normal answer. In that case ``response`` is typically empty
    /// and this carries the prompt message plus quick-reply chips. Nil for a normal answer.
    public var alignments: AlignmentSurface?

    enum CodingKeys: String, CodingKey {
        case error, message
        case messageId = "message_id"
        case query, response
        case resourceUrl = "resource_url"
        case translatedResponse = "translated_response"
        case followUpQuestions = "follow_up_questions"
        case sectionMessageId = "section_message_id"
        case actualContentProvider = "actual_content_provider"
        case contentProviderLogo = "content_provider_logo"
        case hideFeedbackIcons = "hide_feedback_icons"
        case hideFollowUpQuestion = "hide_follow_up_question"
        case hideShareIcon = "hide_share_icon"
        case hideTtsSpeaker = "hide_tts_speaker"
        case hideSource = "hide_source"
        case points
        case intentClassificationOutput = "intent_classification_output"
        case alignments
    }
}

// MARK: - Image analysis / Plantix (#28)

public struct PlantixRequest: Codable, Sendable {
    public var conversationId: String
    /// Base64-encoded image bytes.
    public var image: String
    /// App parity: defaults to "image" on the image path.
    public var triggeredInputType: String
    public var query: String?
    /// App `PlantixRequest.kt` sends latitude/longitude as STRINGs (not lat/lng numbers).
    public var latitude: String?
    public var longitude: String?
    public var imageName: String
    /// True only when the user retries a failed image query.
    public var retry: Bool

    enum CodingKeys: String, CodingKey {
        case conversationId = "conversation_id"
        case image
        case triggeredInputType = "triggered_input_type"
        case query
        case latitude, longitude
        case imageName = "image_name"
        case retry
    }

    public init(conversationId: String, image: String, triggeredInputType: String = "image", query: String? = nil, latitude: String? = nil, longitude: String? = nil, imageName: String, retry: Bool = false) {
        self.conversationId = conversationId
        self.image = image
        self.triggeredInputType = triggeredInputType
        self.query = query
        self.latitude = latitude
        self.longitude = longitude
        self.imageName = imageName
        self.retry = retry
    }
}

public struct PlantixResponse: Codable, Sendable {
    public var error: Bool?
    public var message: String?
    @LossyOptional public var messageId: FlexibleID?
    public var response: String?
    public var query: String?
    public var resourceUrl: String?
    public var actualContentProvider: String?
    public var contentProviderLogo: String?
    public var hideTtsSpeaker: Bool?
    public var hideSource: Bool?

    enum CodingKeys: String, CodingKey {
        case error, message
        case messageId = "message_id"
        case response, query
        case resourceUrl = "resource_url"
        case actualContentProvider = "actual_content_provider"
        case contentProviderLogo = "content_provider_logo"
        case hideTtsSpeaker = "hide_tts_speaker"
        case hideSource = "hide_source"
    }
}

// MARK: - Follow-ups (#29, #30)

public struct FollowUpQuestionsResponse: Codable, Sendable {
    public var questions: [String]?
    public var clarificationRequired: Bool?

    enum CodingKeys: String, CodingKey {
        case questions
        case clarificationRequired = "clarification_required"
    }
}

public struct FollowUpClickRequest: Codable, Sendable {
    public var followUpQuestion: String

    enum CodingKeys: String, CodingKey {
        case followUpQuestion = "follow_up_question"
    }

    public init(followUpQuestion: String) {
        self.followUpQuestion = followUpQuestion
    }
}

public struct FollowUpClickResponse: Codable, Sendable {
    public var message: String?
}

// MARK: - TTS (#31)

public struct SynthesiseAudioRequest: Codable, Sendable {
    public var messageId: String
    public var text: String
    public var userId: String

    enum CodingKeys: String, CodingKey {
        case messageId = "message_id"
        case text
        case userId = "user_id"
    }

    public init(messageId: String, text: String, userId: String) {
        self.messageId = messageId
        self.text = text
        self.userId = userId
    }
}

public struct SynthesiseAudioResponse: Codable, Sendable {
    /// URL of the synthesised audio clip.
    public var audio: String?
    public var error: Bool?
    public var message: String?
}

// MARK: - Conversation list (#22) — dual format

public struct ConversationListItem: Codable, Sendable, Identifiable {
    @LossyOptional public var conversationId: FlexibleID?
    /// Real API field (`conversation_title`, per app `ConversationListItem.kt`).
    public var conversationTitle: String?
    public var messageType: String?
    public var grouping: String?
    public var createdOn: String?

    enum CodingKeys: String, CodingKey {
        case conversationId = "conversation_id"
        case conversationTitle = "conversation_title"
        case messageType = "message_type"
        case grouping
        case createdOn = "created_on"
    }

    public var id: String { conversationId?.stringValue ?? (conversationTitle ?? UUID().uuidString) }

    /// The app displays `conversation_title` (falling back to a "New
    /// conversation" label in the UI layer). It never keys off a `question`
    /// field — that field does not exist on this model in the app source.
    public var displayText: String {
        if let title = conversationTitle, !title.isEmpty { return title }
        return ""
    }
}

/// Custom deserializer handling both response shapes the backend serves:
/// a bare array of items, or `{results/data/conversations: [...], next_page, total_pages, count}`.
public struct ConversationListResponse: Codable, Sendable {
    public var items: [ConversationListItem]
    public var nextPage: Int?
    public var totalPages: Int?
    public var count: Int?

    public init(items: [ConversationListItem], nextPage: Int? = nil, totalPages: Int? = nil, count: Int? = nil) {
        self.items = items
        self.nextPage = nextPage
        self.totalPages = totalPages
        self.count = count
    }

    enum CodingKeys: String, CodingKey {
        case results, data, conversations
        case nextPage = "next_page"
        case totalPages = "total_pages"
        case count
    }

    public init(from decoder: Decoder) throws {
        // Format 1: bare array.
        if var unkeyed = try? decoder.unkeyedContainer() {
            var collected: [ConversationListItem] = []
            while !unkeyed.isAtEnd {
                if let item = try? unkeyed.decode(ConversationListItem.self) {
                    collected.append(item)
                } else {
                    _ = try? unkeyed.decode(JSONValue.self) // skip malformed entry
                }
            }
            self.init(items: collected)
            return
        }
        // Format 2: paginated object.
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let items = (try? container.decodeIfPresent([ConversationListItem].self, forKey: .results))
            ?? (try? container.decodeIfPresent([ConversationListItem].self, forKey: .data))
            ?? (try? container.decodeIfPresent([ConversationListItem].self, forKey: .conversations))
            ?? []
        let nextPage = (try? container.decodeIfPresent(Int.self, forKey: .nextPage)) ?? nil
        let totalPages = (try? container.decodeIfPresent(Int.self, forKey: .totalPages)) ?? nil
        let count = (try? container.decodeIfPresent(Int.self, forKey: .count)) ?? nil
        self.init(items: items, nextPage: nextPage, totalPages: totalPages, count: count)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(items, forKey: .results)
        try container.encodeIfPresent(nextPage, forKey: .nextPage)
        try container.encodeIfPresent(totalPages, forKey: .totalPages)
        try container.encodeIfPresent(count, forKey: .count)
    }
}

// MARK: - Thread history (#32)

public enum ChatMessageTypeId: Int, Sendable {
    case queryText = 1
    case queryAudio = 2
    case responseText = 3
    case followUpQuestions = 7
    case inputImage = 11
}

public struct ConversationChatHistoryMessageItem: Codable, Sendable {
    @LossyOptional public var messageTypeId: Int?
    public var messageType: String?
    @LossyOptional public var messageId: FlexibleID?
    public var messageInputTime: String?
    @LossyOptional public var sectionMessageId: FlexibleID?
    public var queryText: String?
    public var heardQueryText: String?
    public var responseText: String?
    public var questions: [String]?
    public var queryMediaFileUrl: String?
    public var reaction: String?
    public var responseMediaFileUrl: String?
    @LossyOptional public var resourceId: FlexibleID?
    public var resourceUrl: String?
    public var actualContentProvider: String?
    public var contentProviderLogo: String?
    public var hideSource: Bool?
    public var hideTtsSpeaker: Bool?
    public var clarificationRequired: Bool?

    enum CodingKeys: String, CodingKey {
        case messageTypeId = "message_type_id"
        case messageType = "message_type"
        case messageId = "message_id"
        case messageInputTime = "message_input_time"
        case sectionMessageId = "section_message_id"
        case queryText = "query_text"
        case heardQueryText = "heard_query_text"
        case responseText = "response_text"
        case questions
        case queryMediaFileUrl = "query_media_file_url"
        case reaction
        case responseMediaFileUrl = "response_media_file_url"
        case resourceId = "resource_id"
        case resourceUrl = "resource_url"
        case actualContentProvider = "actual_content_provider"
        case contentProviderLogo = "content_provider_logo"
        case hideSource = "hide_source"
        case hideTtsSpeaker = "hide_tts_speaker"
        case clarificationRequired = "clarification_required"
    }

    public var typeId: ChatMessageTypeId? {
        messageTypeId.flatMap(ChatMessageTypeId.init(rawValue:))
    }
}

public struct ConversationChatHistoryResponse: Codable, Sendable {
    public var messages: [ConversationChatHistoryMessageItem]
    public var nextPage: Int?
    public var totalPages: Int?

    enum CodingKeys: String, CodingKey {
        case messages, data, results
        case nextPage = "next_page"
        case totalPages = "total_pages"
    }

    public init(messages: [ConversationChatHistoryMessageItem], nextPage: Int? = nil, totalPages: Int? = nil) {
        self.messages = messages
        self.nextPage = nextPage
        self.totalPages = totalPages
    }

    public init(from decoder: Decoder) throws {
        if var unkeyed = try? decoder.unkeyedContainer() {
            var collected: [ConversationChatHistoryMessageItem] = []
            while !unkeyed.isAtEnd {
                if let item = try? unkeyed.decode(ConversationChatHistoryMessageItem.self) {
                    collected.append(item)
                } else {
                    _ = try? unkeyed.decode(JSONValue.self)
                }
            }
            self.init(messages: collected)
            return
        }
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let messages = (try? container.decodeIfPresent([ConversationChatHistoryMessageItem].self, forKey: .messages))
            ?? (try? container.decodeIfPresent([ConversationChatHistoryMessageItem].self, forKey: .data))
            ?? (try? container.decodeIfPresent([ConversationChatHistoryMessageItem].self, forKey: .results))
            ?? []
        self.init(
            messages: messages,
            nextPage: (try? container.decodeIfPresent(Int.self, forKey: .nextPage)) ?? nil,
            totalPages: (try? container.decodeIfPresent(Int.self, forKey: .totalPages)) ?? nil
        )
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(messages, forKey: .messages)
        try container.encodeIfPresent(nextPage, forKey: .nextPage)
        try container.encodeIfPresent(totalPages, forKey: .totalPages)
    }
}

// MARK: - MoEngage qapair insert (#33)

public struct MoengageQueryHistoryRequest: Codable, Sendable {
    public var userId: String?
    public var conversationId: String?
    public var query: String
    public var response: String?
    public var followUpQuestions: [String]?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case conversationId = "conversation_id"
        case query, response
        case followUpQuestions = "follow_up_questions"
    }

    public init(userId: String?, conversationId: String?, query: String, response: String?, followUpQuestions: [String]? = nil) {
        self.userId = userId
        self.conversationId = conversationId
        self.query = query
        self.response = response
        self.followUpQuestions = followUpQuestions
    }
}

public struct MoengageQueryHistoryResponse: Codable, Sendable {
    public var message: String?
}

// MARK: - Geolocate (Google)

public struct GeoRequestBody: Codable, Sendable {
    public var considerIp: Bool

    public init(considerIp: Bool = true) {
        self.considerIp = considerIp
    }
}

public struct GeoResponse: Codable, Sendable {
    public struct Location: Codable, Sendable {
        public var lat: Double
        public var lng: Double
    }

    public var location: Location?
    public var accuracy: Double?
}

// MARK: - Alignment surfaces (2.0.0)

/// A short prompt the user answers by tapping a chip, instead of receiving a normal answer.
///
/// `type` selects the visual treatment (see ``AlignmentKind``); `chips` are the quick replies;
/// `original_query` is the query that triggered the surface, kept for context — it is the chip's
/// `value` that gets sent on tap.
///
/// Named `AlignmentSurface`, not `Alignment` as on Android: `SwiftUI.Alignment` already owns that
/// name, and a public `Alignment` in Core would make every `Alignment` reference ambiguous in any
/// host file that imports both modules. The wire key stays `alignments`.
public struct AlignmentSurface: Codable, Sendable, Equatable {
    public var type: String?
    public var message: String?
    public var chips: [AlignmentChip]?
    public var originalQuery: String?
    /// True when the backend needs this answered before it can proceed.
    public var blocking: Bool?
    /// Backend intent tag (e.g. "capability", "profile"); informational for the client.
    public var intent: String?

    enum CodingKeys: String, CodingKey {
        case type, message, chips
        case originalQuery = "original_query"
        case blocking, intent
    }

    public init(
        type: String? = nil,
        message: String? = nil,
        chips: [AlignmentChip]? = nil,
        originalQuery: String? = nil,
        blocking: Bool? = nil,
        intent: String? = nil
    ) {
        self.type = type
        self.message = message
        self.chips = chips
        self.originalQuery = originalQuery
        self.blocking = blocking
        self.intent = intent
    }
}

/// One quick-reply chip. `label` is shown, `value` is sent on tap.
///
/// `action` describes how the chip behaves: "select" invokes a capability (take a photo, share
/// location), "decline" lets the user opt out (use an approximate location). Today every chip's
/// value/label is sent back as a follow-up; `action` is parsed so device flows can be wired to
/// "select" chips without another wire change.
public struct AlignmentChip: Codable, Sendable, Equatable, Identifiable {
    public var label: String?
    public var value: String?
    public var action: String?

    public init(label: String? = nil, value: String? = nil, action: String? = nil) {
        self.label = label
        self.value = value
        self.action = action
    }

    /// Stable-enough identity for SwiftUI lists (chips are short, fixed sets).
    public var id: String { "\(label ?? "")|\(value ?? "")|\(action ?? "")" }

    /// What a tap sends: the chip's `value`, falling back to its visible `label`.
    public var submittedQuery: String {
        if let value, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return value }
        return label ?? ""
    }
}

/// The alignment surfaces the backend can ask for.
public enum AlignmentKind: String, Sendable, Equatable, CaseIterable {
    case clarify
    case confirm
    case escalate
    case gpsPrompt
    case uploadPhoto
    case genderSelect
    case commodityConfirm

    /// Additive surfaces accompany a normal answer — they render BELOW it as an optional nudge and
    /// never suppress the answer or its follow-ups. Exclusive surfaces (clarify / confirm /
    /// escalate / capability prompts) own the message area and replace the answer.
    ///
    /// The backend marks the additive ones non-blocking (`blocking:false`, `intent:"profile"`).
    /// Both are single-select: one tap sends immediately and locks the card.
    public var isAdditive: Bool { self == .genderSelect || self == .commodityConfirm }

    /// The exact wire `type` string, reported as the `agentic_chip_type` analytics property so
    /// funnels can be segmented by which surface was tapped. Keep these stable and in sync with
    /// ``fromType(_:)`` — dashboards depend on them.
    public var analyticsType: String {
        switch self {
        case .clarify: return "alignment-clarify"
        case .confirm: return "alignment-confirm"
        case .escalate: return "alignment-escalate"
        case .gpsPrompt: return "gps-prompt"
        case .uploadPhoto: return "upload-photo"
        case .genderSelect: return "gender-select"
        case .commodityConfirm: return "commodity-confirm"
        }
    }

    /// Wire `type` → kind. Nil for an unknown or absent type: render as a normal answer.
    public static func fromType(_ type: String?) -> AlignmentKind? {
        switch type?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "alignment-clarify": return .clarify
        case "alignment-confirm": return .confirm
        case "alignment-escalate": return .escalate
        case "gps-prompt": return .gpsPrompt
        case "upload-photo": return .uploadPhoto
        case "gender-select": return .genderSelect
        case "commodity-confirm": return .commodityConfirm
        default: return nil
        }
    }
}
