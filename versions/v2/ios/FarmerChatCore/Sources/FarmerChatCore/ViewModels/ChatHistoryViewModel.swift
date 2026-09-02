import Foundation
import Combine

/// Drawer question item (typed Camera/Mic/Keyboard/Card like the app).
public struct DrawerQuestion: Identifiable, Sendable, Equatable {
    public enum InputType: String, Sendable {
        case camera
        case mic
        case keyboard
        case card
    }

    public var id: String
    public var conversationId: String?
    public var question: String
    public var inputType: InputType

    public init(id: String, conversationId: String?, question: String, inputType: InputType) {
        self.id = id
        self.conversationId = conversationId
        self.question = question
        self.inputType = inputType
    }
}

/// Grouped list row for the ChatHistory screen.
public enum ChatHistoryRow: Identifiable, Sendable, Equatable {
    case header(String)
    case item(ConversationRowItem)

    public struct ConversationRowItem: Identifiable, Sendable, Equatable {
        public var id: String
        public var conversationId: String?
        public var title: String
        public var messageType: String?
        public var grouping: String?
    }

    public var id: String {
        switch self {
        case .header(let title): return "header_\(title)"
        case .item(let item): return "item_\(item.id)"
        }
    }
}

/// Port of `ChatHistoryUiState`.
public struct ChatHistoryUiState: Sendable {
    public var items: [ChatHistoryRow] = []
    public var isLoading: Bool = false
    public var errorMessage: String?
    public var isNetworkError: Bool = false
    public var canLoadMore: Bool = false
    public var query: String = ""
    /// True while a pagination (not initial) request failed — inline retry.
    public var paginationError: Bool = false

    public init() {}
}

// MARK: - ViewModel (port of ChatHistoryViewModel; shared across drawer)

@MainActor
public final class ChatHistoryViewModel: ObservableObject {
    @Published public private(set) var state = ChatHistoryUiState()
    /// Recent questions for the drawer (max 8).
    @Published public private(set) var recentQuestions: [DrawerQuestion] = []
    @Published public private(set) var historyErrorMessage: String?

    private let env: FarmerChat
    private var rawItems: [ConversationListItem] = []
    private var currentPage = 1
    private var nextPage: Int?
    private var isFetching = false

    public init(env: FarmerChat = .shared) {
        self.env = env
    }

    // MARK: - Loading

    public func refresh() {
        currentPage = 1
        nextPage = nil
        rawItems = []
        state.paginationError = false
        Task { await load(page: 1, silent: false) }
    }

    /// Drawer-open refresh that keeps existing content visible.
    public func refreshSilently() {
        Task { await load(page: 1, silent: true) }
    }

    public func loadNextPage() {
        guard let next = nextPage, !isFetching else { return }
        Task { await load(page: next, silent: false) }
    }

    public func retryPagination() {
        state.paginationError = false
        if rawItems.isEmpty {
            refresh()
        } else {
            loadNextPage()
        }
    }

    private func load(page: Int, silent: Bool) async {
        guard let userId = env.session.userId else {
            historyErrorMessage = env.labels.label("error_generic", fallback: "Something went wrong. Please try again.")
            return
        }
        isFetching = true
        if !silent && page == 1 {
            state.isLoading = true
            state.errorMessage = nil
        }
        defer { isFetching = false }

        let result = await env.api.conversationList(userId: userId, page: page)
        state.isLoading = false
        switch result {
        case .success(let response):
            historyErrorMessage = nil
            if page == 1 {
                rawItems = response.items
            } else {
                rawItems.append(contentsOf: response.items)
            }
            currentPage = page
            nextPage = response.nextPage
            state.canLoadMore = response.nextPage != nil
            state.errorMessage = nil
            state.paginationError = false
            rebuildRows()
            rebuildRecentQuestions()
        case .error(let error):
            let message = error.message ?? env.labels.label("chat_history_failed", fallback: "We couldn't load your chats.")
            if page == 1 && rawItems.isEmpty {
                // Initial-load failure — screen routes to the Error destination.
                state.errorMessage = message
                state.isNetworkError = error.isNetworkError
            } else {
                state.paginationError = true
            }
            historyErrorMessage = message
        }
    }

    // MARK: - Grouping / filtering

    public func setQuery(_ query: String) {
        state.query = query
        rebuildRows()
    }

    public func filteredItems() -> [ChatHistoryRow] {
        state.items
    }

    private func rebuildRows() {
        let query = state.query.trimmingCharacters(in: .whitespaces).lowercased()
        let source: [ConversationListItem]
        if query.isEmpty {
            source = rawItems
        } else {
            source = rawItems.filter { $0.displayText.lowercased().contains(query) }
        }
        var rows: [ChatHistoryRow] = []
        var lastGroup: String?
        for item in source {
            let group = item.grouping ?? ""
            if !group.isEmpty && group != lastGroup {
                rows.append(.header(group))
                lastGroup = group
            }
            rows.append(.item(ChatHistoryRow.ConversationRowItem(
                id: item.id,
                conversationId: item.conversationId?.stringValue,
                title: item.displayText,
                messageType: item.messageType,
                grouping: item.grouping
            )))
        }
        state.items = rows
    }

    private func rebuildRecentQuestions() {
        recentQuestions = rawItems.prefix(8).map { item in
            DrawerQuestion(
                id: item.id,
                conversationId: item.conversationId?.stringValue,
                question: item.displayText,
                inputType: Self.inputType(from: item.messageType)
            )
        }
    }

    public static func inputType(from messageType: String?) -> DrawerQuestion.InputType {
        switch messageType?.lowercased() {
        case "query_audio", "audio", "voice", "mic":
            return .mic
        case "input_image", "image", "camera":
            return .camera
        case "card", "statement", "qapair":
            return .card
        default:
            return .keyboard
        }
    }
}
