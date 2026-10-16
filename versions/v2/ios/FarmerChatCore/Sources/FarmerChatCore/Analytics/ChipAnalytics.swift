import Foundation

/// The alignment-chip fields the app stamps on EVERY `Send_Query` / `Send_Query_Initiated`
/// (fc-compose-agentic `core/analytics/SendQueryAnalytics.kt:118-150`, keys from
/// `core/analytics/AnalyticsProps.kt`; Android SDK `SendQueryProperties.toAnalyticsProperties`).
///
/// - `agentic_chip_status`: `selected` (a chip tap), `skipped` (chips were on screen unselected and
///   the farmer typed / spoke / sent a photo instead), `available`, or `none`.
/// - `agentic_chip_skipped_type`: the bypassed surface's wire type, only when `skipped`, else "".
/// - `agentic_chip_shown_type`: only when `available`, else "".
/// - `agentic_chip_type` / `_value` / `_label`: the tapped chip, "" otherwise.
/// - `click_type`: `align_chip_sel` for a chip tap (first in the app's precedence), else the
///   app's mapping of the send's trigger.
///
/// Internal: a value type the view model builds per send; nothing here is host API.
struct ChipAnalytics: Equatable, Sendable {
    static let keyStatus = "agentic_chip_status"
    static let keySkippedType = "agentic_chip_skipped_type"
    static let keyShownType = "agentic_chip_shown_type"
    static let keyType = "agentic_chip_type"
    static let keyValue = "agentic_chip_value"
    static let keyLabel = "agentic_chip_label"
    static let keyClickType = "click_type"

    static let statusSelected = "selected"
    static let statusSkipped = "skipped"
    static let statusAvailable = "available"
    static let statusNone = "none"

    var status: String = ChipAnalytics.statusNone
    var skippedType: String = ""
    var shownType: String = ""
    var type: String = ""
    var value: String = ""
    var label: String = ""

    var isAlignmentChip: Bool { status == Self.statusSelected }

    static let none = ChipAnalytics()

    /// A chip tap (`isAlignmentChip = true`, `agenticChipStatus = selected`; ChatViewModel.kt:1105).
    static func selected(type: String?, value: String?, label: String?) -> ChipAnalytics {
        ChipAnalytics(status: statusSelected, type: type ?? "", value: value ?? "", label: label ?? "")
    }

    /// App `manualSendChipContext()` (ChatViewModel.kt:148-158): for a typed / voice / photo send,
    /// `skipped` + the surface's wire type when the newest AI answer is an alignment surface whose
    /// chips are on screen and still unpicked; otherwise `none`. Call BEFORE the send mutates the
    /// thread.
    static func manualSend(messages: [ChatMessage]) -> ChipAnalytics {
        var lastAi: ChatMessage.AiResponse?
        for entry in messages.reversed() {
            if case .aiResponse(let ai) = entry { lastAi = ai; break }
        }
        guard let ai = lastAi, let kind = ai.alignmentKind,
              !(ai.alignmentChips ?? []).isEmpty, ai.alignmentSelectedValues.isEmpty else {
            return .none
        }
        return ChipAnalytics(status: statusSkipped, skippedType: kind.analyticsType)
    }

    /// The six `agentic_chip_*` keys, with the app's blanking rules.
    var props: [String: String] {
        let status = self.status.isEmpty ? Self.statusNone : self.status
        return [
            Self.keyStatus: status,
            Self.keySkippedType: status == Self.statusSkipped ? skippedType : "",
            Self.keyShownType: status == Self.statusAvailable ? shownType : "",
            Self.keyType: type,
            Self.keyValue: value,
            Self.keyLabel: label
        ]
    }

    /// `click_type` (SendQueryAnalytics.kt:100-113) from what iOS knows about a send: a chip tap
    /// first, then read-full-advice, follow-up, weather, SSFR, else the query type.
    static func clickType(triggeredInputType: String, isAlignmentChip: Bool) -> String {
        if isAlignmentChip { return FCAlignChipSelInputType }
        switch triggeredInputType {
        case FCAlignChipSelInputType: return FCAlignChipSelInputType
        case "read_full_advice": return "read_full_advice"
        case "follow_up": return "follow-up"
        case "weather": return "Weather"
        case "ssfr": return "SSFR"
        case "image": return "image"
        case "voice": return "voice"
        default: return "text"
        }
    }

    /// `props` + `click_type`, merged over `base`.
    func merged(into base: [String: String], triggeredInputType: String) -> [String: String] {
        var out = base
        for (k, v) in props { out[k] = v }
        out[Self.keyClickType] = Self.clickType(triggeredInputType: triggeredInputType, isAlignmentChip: isAlignmentChip)
        return out
    }
}
