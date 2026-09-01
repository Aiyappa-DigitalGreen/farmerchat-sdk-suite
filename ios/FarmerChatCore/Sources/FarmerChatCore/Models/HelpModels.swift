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
    // App parity (HelpSupportResponse.kt): the FAQ link is `webview-url`
    // (alt `webview_url`), not a flat `url`. `open-mode` controls the presentation.
    public var webviewUrl: String?
    public var webviewUrlAlt: String?
    public var openMode: String?

    enum CodingKeys: String, CodingKey {
        case rawId = "id"
        case title, question
        case webviewUrl = "webview-url"
        case webviewUrlAlt = "webview_url"
        case openMode = "open-mode"
    }

    /// The resolved FAQ link (consumers read this).
    public var url: String? { webviewUrl ?? webviewUrlAlt }
    public var id: String { rawId?.stringValue ?? (url ?? UUID().uuidString) }
    public var displayTitle: String { title ?? question ?? "" }
}

/// App parity: legal entries are nested objects carrying their own `webview-url`.
public struct HelpLegalLink: Codable, Sendable {
    public var webviewUrl: String?
    public var webviewUrlAlt: String?
    enum CodingKeys: String, CodingKey {
        case webviewUrl = "webview-url"
        case webviewUrlAlt = "webview_url"
    }
    public var url: String? { webviewUrl ?? webviewUrlAlt }
}

public struct HelpLegal: Codable, Sendable {
    // App parity: nested `terms-of-use` / `privacy-policy` objects, each with a webview-url.
    public var termsOfUseLink: HelpLegalLink?
    public var privacyPolicyLink: HelpLegalLink?

    enum CodingKeys: String, CodingKey {
        case termsOfUseLink = "terms-of-use"
        case privacyPolicyLink = "privacy-policy"
    }

    /// Resolved legal URLs (consumers read these).
    public var termsOfUse: String? { termsOfUseLink?.url }
    public var privacyPolicy: String? { privacyPolicyLink?.url }
}
