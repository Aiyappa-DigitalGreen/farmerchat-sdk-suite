import SwiftUI
import FarmerChatCore

/// Port of ChatHistoryScreen: grouped list with section headers from API
/// `grouping`, icon by message_type, pagination near bottom, inline retry
/// for pagination errors, initial-load failure → Error route.
struct ChatHistoryView: View {
    @Environment(\.fcTheme) private var theme
    @EnvironmentObject var router: FCRouter
    @ObservedObject var viewModel: ChatHistoryViewModel
    let openDrawer: () -> Void

    @State private var didAppear = false

    var body: some View {
        VStack(spacing: 0) {
            FCAppBar(
                title: fcLabel(FCLabels.recentChats, "Recent chats"),
                leading: .menu,
                onLeadingTap: openDrawer
            )

            if viewModel.state.isLoading && viewModel.state.items.isEmpty {
                FCLogoSpinner(message: fcLabel(FCLabels.loading, "Loading..."))
            } else if viewModel.state.items.isEmpty {
                emptyState
            } else {
                historyList
            }
        }
        .background(theme.content.surfacePrimary.ignoresSafeArea())
        .task {
            guard !didAppear else { return }
            didAppear = true
            FarmerChat.shared.analytics.screenViewed(ScreenNames.chatHistory)
            viewModel.refresh()
        }
        .onChange(of: viewModel.state.errorMessage) { message in
            // Initial-load failure routes to the centralized Error screen.
            guard message != nil, viewModel.state.items.isEmpty else { return }
            router.errorNavigation.navigateToError(
                isNetworkError: viewModel.state.isNetworkError,
                fromScreen: "chatHistory",
                retry: { viewModel.refresh() }
            )
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 44))
                .foregroundColor(theme.content.foregroundTertiary)
            Text(fcLabel("chat_history_empty", "Your chats will appear here"))
                .fcTextStyle(theme.typography.bodyMedium)
                .foregroundColor(theme.content.foregroundSecondary)
            Spacer()
        }
    }

    private var historyList: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 2) {
                ForEach(viewModel.state.items) { row in
                    switch row {
                    case .header(let title):
                        // App parity (ChatHistoryScreen.kt:165-167): the date-group heading is
                        // labelLarge (17/600) on foregroundPrimary, in its natural case. iOS had
                        // it at 13/600, grey, and FORCED TO UPPERCASE — three deviations that
                        // together made it read as a system caption rather than a section title.
                        Text(title)
                            .fcTextStyle(theme.typography.labelLarge)
                            .foregroundColor(theme.content.foregroundPrimary)
                            .padding(.horizontal, 16)
                            .padding(.top, 18)
                            .padding(.bottom, 4)
                    case .item(let item):
                        FCListItem(
                            icon: icon(for: item.messageType),
                            title: item.title,
                            action: {
                                FarmerChat.shared.analytics.track(AnalyticsEvents.newChatClickEvent, props: [
                                    "conversation_id": item.conversationId ?? ""
                                ])
                                if let conversationId = item.conversationId {
                                    router.push(.chat(FCDestination.ChatArgs(source: "history", conversationId: conversationId)))
                                }
                            }
                        )
                        .background(theme.content.surfaceSecondary)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .padding(.horizontal, 12)
                        .onAppear {
                            // Pagination near bottom.
                            if case .item(let lastItem) = viewModel.state.items.last, lastItem.id == item.id {
                                viewModel.loadNextPage()
                            }
                        }
                    }
                }

                if viewModel.state.paginationError {
                    VStack(spacing: 8) {
                        Text(fcLabel(FCLabels.couldntLoadMoreChats, "Couldn't load more chats"))
                            .fcTextStyle(theme.typography.bodyMedium)
                            .foregroundColor(theme.content.foregroundSecondary)
                        FCPrimaryButton(title: fcLabel(FCLabels.tryAgain, "Try again")) {
                            viewModel.retryPagination()
                        }
                        .padding(.horizontal, 40)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                } else if viewModel.state.canLoadMore {
                    HStack(spacing: 8) {
                        ProgressView()
                        Text(fcLabel(FCLabels.loadingMore, "Loading more..."))
                            .fcTextStyle(theme.typography.bodyMedium)
                            .foregroundColor(theme.content.foregroundSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                }
            }
            .padding(.bottom, 24)
        }
    }

    private func icon(for messageType: String?) -> String {
        switch ChatHistoryViewModel.inputType(from: messageType) {
        case .camera: return "camera"
        case .mic: return "mic"
        case .keyboard: return "keyboard"
        case .card: return "rectangle.on.rectangle"
        }
    }
}
