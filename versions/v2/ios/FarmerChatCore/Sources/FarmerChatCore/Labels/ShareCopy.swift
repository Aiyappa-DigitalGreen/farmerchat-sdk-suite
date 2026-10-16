import Foundation

/// The caption the app attaches to a shared answer card (fc-compose-agentic
/// `ui/chat/ChatScreen.kt:2088-2116`: `Intent.EXTRA_TEXT` = `share_app_message`, else this English
/// fallback). Shared by both iOS flavours so the copy cannot drift.
public enum FCShareCopy {
    public static let captionFallback =
        "Sharing what FarmerChat taught me—super useful. \u{1F44D}\u{1F3FE} Give it a try: https://play.google.com/store/apps/details?id=org.digitalgreen.farmer.chat&hl=en_IN"

    /// `share_app_message` through LabelManager, falling back to the app's English caption.
    public static func caption(labels: LabelManager = FarmerChat.shared.labels) -> String {
        labels.label(FCLabels.shareAppMessage, fallback: captionFallback)
    }
}
