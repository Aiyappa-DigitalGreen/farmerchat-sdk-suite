import Foundation

// MARK: - Help / FAQ (#24)

public struct HelpSupportResponse: Codable, Sendable {
    public var data: HelpSupportData?
    public var message: String?
}

public struct HelpSupportData: Codable, Sendable {
    public var faqs: [FaqItem]?
    public var legal: HelpLegal?
    public var mode: String?
}

public struct FaqItem: Codable, Sendable, Identifiable {
    @LossyOptional public var rawId: FlexibleID?
    public var title: String?
    public var question: String?
    public var url: String?

    enum CodingKeys: String, CodingKey {
        case rawId = "id"
        case title, question, url
    }

    public var id: String { rawId?.stringValue ?? (url ?? UUID().uuidString) }

    public var displayTitle: String { title ?? question ?? "" }
}

public struct HelpLegal: Codable, Sendable {
    public var termsOfUse: String?
    public var privacyPolicy: String?

    enum CodingKeys: String, CodingKey {
        case termsOfUse = "terms_of_use"
        case privacyPolicy = "privacy_policy"
    }
}
