import SwiftUI
import FarmerChatCore

/// Shared drawer (port of components/drawer/): side overlay on
/// Home/Chat/Settings/Help/SettingsLanguage/ChatHistory.
public struct FCDrawerView: View {
    @Environment(\.fcTheme) private var theme
    let currentRoute: String
    let isAuthenticated: Bool
    let currentLanguage: String
    let recentQuestions: [DrawerQuestion]
    let historyErrorMessage: String?
    let isLoadingHistory: Bool
    let onNavigate: (String) -> Void
    let onOpenQuestion: (DrawerQuestion) -> Void
    let onSeeAll: () -> Void
    let onSignUp: () -> Void
    let onRetryHistory: () -> Void
    let onClose: () -> Void

    public var body: some View {
        ZStack(alignment: .leading) {
            theme.content.scrim
                .ignoresSafeArea()
                .onTapGesture(perform: onClose)

            VStack(alignment: .leading, spacing: 0) {
                // Header
                HStack(spacing: 10) {
                    FCLogoMark(size: 34, tint: theme.brand.surfacePrimary)
                    Text("FarmerChat")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(theme.content.foregroundPrimary)
                    Spacer()
                }
                .padding(.horizontal, 20)
                .padding(.top, 18)
                .padding(.bottom, 14)

                ScrollView {
                    VStack(alignment: .leading, spacing: 4) {
                        drawerRow(icon: "house.fill", title: fcLabel(FCLabels.home, "Home"), route: "home")

                        // Recent-chats section: authenticated (OTP or HOST_TOKEN)
                        // AND showHistory only — guests see the sign-up card
                        // instead (parity with android-compose DrawerContent).
                        if isAuthenticated && FarmerChat.shared.config.showHistory {
                        // Recent questions (max 8)
                        Text(fcLabel(FCLabels.recentChats, "Recent chats"))
                            .fcTextStyle(theme.typography.titleMedium)
                            .foregroundColor(theme.content.foregroundSecondary)
                            .textCase(.uppercase)
                            .padding(.horizontal, 20)
                            .padding(.top, 18)
                            .padding(.bottom, 4)

                        if isLoadingHistory && recentQuestions.isEmpty {
                            ForEach(0..<3, id: \.self) { _ in
                                FCSkeletonRow().padding(.horizontal, 20).padding(.vertical, 8)
                            }
                        } else if let historyErrorMessage, recentQuestions.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(historyErrorMessage)
                                    .fcTextStyle(theme.typography.bodySmall)
                                    .foregroundColor(theme.content.foregroundSecondary)
                                Button(fcLabel(FCLabels.tryAgain, "Try again"), action: onRetryHistory)
                                    .fcTextStyle(theme.typography.bodyMedium)
                                    .foregroundColor(theme.brand.surfacePrimary)
                            }
                            .padding(.horizontal, 20)
                            .padding(.vertical, 8)
                        } else {
                            ForEach(recentQuestions) { question in
                                Button(action: { onOpenQuestion(question) }) {
                                    HStack(spacing: 10) {
                                        Image(systemName: icon(for: question.inputType))
                                            .font(.system(size: 13))
                                            .foregroundColor(theme.content.foregroundSecondary)
                                            .frame(width: 22)
                                        Text(question.question)
                                            .fcTextStyle(theme.typography.bodyMedium)
                                            .foregroundColor(theme.content.foregroundPrimary)
                                            .lineLimit(1)
                                        Spacer()
                                    }
                                    .padding(.horizontal, 20)
                                    .padding(.vertical, 9)
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                            }
                            if !recentQuestions.isEmpty {
                                Button(action: onSeeAll) {
                                    Text(fcLabel(FCLabels.seeAll, "See all"))
                                        .fcTextStyle(theme.typography.labelMedium)
                                        .foregroundColor(theme.brand.surfacePrimary)
                                        .padding(.horizontal, 20)
                                        .padding(.vertical, 10)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        } // end auth-gated recent-chats section

                        Divider().padding(.vertical, 8)

                        // History row: authenticated (OTP or HOST_TOKEN) AND
                        // showHistory only. C3 showHistory toggle plus the auth
                        // gate keeps guests out of ChatHistory via the drawer.
                        // Order matches the app (components/drawer/DrawerContent.kt) and the
                        // Android SDK: Language -> Settings -> Help, then the history row.
                        drawerRow(icon: "globe", title: currentLanguage.isEmpty ? fcLabel(FCLabels.language, "Language") : currentLanguage, route: "settings/language")
                        if FarmerChat.shared.config.showSettings {
                            drawerRow(icon: "gearshape.fill", title: fcLabel(FCLabels.settings, "Settings"), route: "settings")
                        }
                        drawerRow(icon: "questionmark.circle.fill", title: fcLabel(FCLabels.help, "Help"), route: "help")
                        // History row: authenticated (OTP or HOST_TOKEN) AND showHistory only.
                        if isAuthenticated && FarmerChat.shared.config.showHistory {
                            drawerRow(icon: "clock.arrow.circlepath", title: fcLabel(FCLabels.recentChats, "Recent chats"), route: "chatHistory")
                        }
                    }
                    .padding(.bottom, 20)
                }

                if !isAuthenticated {
                    VStack(spacing: 0) {
                        Divider()
                        Button(action: onSignUp) {
                            HStack(spacing: 10) {
                                Image(systemName: "person.crop.circle.badge.plus")
                                Text(fcLabel(FCLabels.signUp, "Sign up"))
                                    .fcTextStyle(theme.typography.labelLarge)
                                Spacer()
                            }
                            .foregroundColor(theme.brand.surfacePrimary)
                            .padding(.horizontal, 20)
                            .padding(.vertical, 16)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .frame(width: 300)
            .frame(maxHeight: .infinity)
            .background(theme.content.surfacePrimary)
            .transition(.move(edge: .leading))
        }
    }

    private func drawerRow(icon: String, title: String, route: String) -> some View {
        let isActive = currentRoute == route
        return Button(action: { onNavigate(route) }) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 15))
                    .foregroundColor(isActive ? theme.brand.surfacePrimary : theme.content.foregroundSecondary)
                    .frame(width: 24)
                Text(title)
                    .fcTextStyle(theme.typography.labelMedium).fontWeight(isActive ? .semibold : .regular)
                    .foregroundColor(theme.content.foregroundPrimary)
                Spacer()
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(isActive ? theme.content.surfaceActive : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func icon(for inputType: DrawerQuestion.InputType) -> String {
        switch inputType {
        case .camera: return "camera"
        case .mic: return "mic"
        case .keyboard: return "keyboard"
        case .card: return "rectangle.on.rectangle"
        }
    }
}
