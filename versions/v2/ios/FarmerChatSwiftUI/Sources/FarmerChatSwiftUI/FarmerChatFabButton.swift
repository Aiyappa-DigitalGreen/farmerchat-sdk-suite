import SwiftUI
import FarmerChatCore

/// Drop-in floating launcher (docs/04 row 52). A pinned circular (or extended)
/// button that presents the full FarmerChat journey via `.fullScreenCover`.
///
/// Unlike a bare `FarmerChat.openChat(...)` call, this *reveals* the SDK view,
/// so it works from a host screen that never renders `FarmerChatView` itself.
/// Place it in a `ZStack` / `.overlay` over your content — it fills the space
/// it's given and pins the button to a corner. Needs only a prior
/// `FarmerChat.initialize(config:)`.
///
/// ```swift
/// ZStack {
///     MyHostContent()
///     FarmerChatFabButton(label: "Ask FarmerChat")
/// }
/// ```
public struct FarmerChatFabButton: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var isPresented = false

    private let question: String?
    private let label: String?
    private let alignment: Alignment
    private let backgroundColorOverride: Color?
    private let contentColorOverride: Color?
    private let systemImage: String?

    /// - Parameters:
    ///   - question: when set, tapping deep-links straight into a chat asking it;
    ///     when nil the full journey opens.
    ///   - label: when set, renders as an extended launcher with this text;
    ///     defaults to `config.fabLabel`.
    ///   - bottomLeading: pin to the bottom-leading corner instead of trailing.
    ///   - backgroundColor: override the launcher background (else `config.fabBackgroundColor`, else theme brand).
    ///   - contentColor: override the icon/label color (else `config.fabContentColor`, else on-brand).
    ///   - systemImage: SF Symbol name to use instead of the FarmerChat logo mark.
    public init(
        question: String? = nil,
        label: String? = nil,
        bottomLeading: Bool = false,
        backgroundColor: Color? = nil,
        contentColor: Color? = nil,
        systemImage: String? = nil
    ) {
        precondition(FarmerChat.isInitialized, "Call FarmerChat.initialize(config:) before FarmerChatFabButton()")
        self.question = question
        self.label = label ?? FarmerChat.shared.config.fabLabel
        self.alignment = bottomLeading ? .bottomLeading : .bottomTrailing
        self.backgroundColorOverride = backgroundColor
        self.contentColorOverride = contentColor
        self.systemImage = systemImage
    }

    private var theme: FCTheme {
        FCTheme.theme(for: colorScheme, appearance: FarmerChat.shared.appearance)
    }

    public var body: some View {
        // Precedence: per-instance override → config default → theme brand.
        let bg = backgroundColorOverride ?? FarmerChat.shared.config.fabBackgroundColor ?? theme.brand.surfacePrimary
        let fg = contentColorOverride ?? FarmerChat.shared.config.fabContentColor ?? theme.brand.foregroundPrimary
        return Button {
            // Set the deep-link target before revealing, so the presented
            // view's router consumes it on init.
            if let question { FarmerChat.shared.openChat(question: question) }
            isPresented = true
        } label: {
            HStack(spacing: label == nil ? 0 : 10) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundColor(fg)
                } else {
                    FCLogoMark(size: 26, tint: fg)
                }
                if let label {
                    Text(label)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(fg)
                }
            }
            .frame(width: label == nil ? 56 : nil, height: 56)
            .padding(.horizontal, label == nil ? 0 : 22)
            .background(bg)
            .clipShape(Capsule())
            .shadow(color: .black.opacity(0.25), radius: 8, x: 0, y: 4)
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: alignment)
        .padding(20)
        .fullScreenCover(isPresented: $isPresented) {
            ZStack(alignment: .topTrailing) {
                FarmerChatView()
                Button {
                    isPresented = false
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.white)
                        .frame(width: 40, height: 40)
                        .background(Color.black.opacity(0.5))
                        .clipShape(Circle())
                }
                .padding(.top, 44)
                .padding(.trailing, 16)
            }
        }
    }
}
