package org.digitalgreen.farmerchat.sdk.core.ui.history

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import org.digitalgreen.farmerchat.sdk.core.base.ApiResult
import org.digitalgreen.farmerchat.sdk.core.base.isNetworkError
import org.digitalgreen.farmerchat.sdk.core.model.ConversationListItem
import org.digitalgreen.farmerchat.sdk.core.prefs.SdkPreferences
import org.digitalgreen.farmerchat.sdk.core.ui.CoreViewModel
import org.digitalgreen.farmerchat.sdk.core.usecase.HistoryUseCase

/** Icon type per `message_type` of a recent-question row (drawer + history list). */
enum class DrawerQuestionType { Camera, Mic, Keyboard, Card }

/** A recent question shown in the drawer (max 8). */
data class DrawerQuestion(
    val conversationId: String,
    val title: String,
    val type: DrawerQuestionType
)

/** State for the ChatHistory screen (port of the app's ChatHistoryUiState). */
data class ChatHistoryUiState(
    val items: List<ConversationListItem> = emptyList(),
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
    val isNetworkError: Boolean = false,
    val canLoadMore: Boolean = false,
    val query: String = ""
)

/**
 * Grouped, paginated conversation list. Shared between the drawer (recent 8)
 * and the ChatHistory screen, mirroring the app's shared ChatHistoryViewModel.
 */
class ChatHistoryViewModel(
    private val historyUseCase: HistoryUseCase,
    private val prefs: SdkPreferences
) : CoreViewModel() {

    private val _state = MutableStateFlow(ChatHistoryUiState())
    val state: StateFlow<ChatHistoryUiState> = _state

    private var currentPage = 1
    private var isFetching = false

    private fun userId(): String = prefs.getString(SdkPreferences.Keys.PREF_USER_ID, "")

    /** Full refresh (page 1), showing the loading state. */
    fun refresh() {
        loadPage(page = 1, silent = false)
    }

    /** Refresh without toggling isLoading (drawer open). */
    fun refreshSilently() {
        loadPage(page = 1, silent = true)
    }

    fun loadNextPage() {
        if (isFetching || !_state.value.canLoadMore) return
        loadPage(page = currentPage + 1, silent = false, append = true)
    }

    fun setQuery(query: String) {
        _state.update { it.copy(query = query) }
    }

    fun filteredItems(): List<ConversationListItem> {
        val q = _state.value.query.trim()
        val items = _state.value.items
        if (q.isBlank()) return items
        return items.filter { it.conversation_title?.contains(q, ignoreCase = true) == true }
    }

    /** Recent 8 questions for the drawer, typed by message_type. */
    fun recentDrawerQuestions(): List<DrawerQuestion> =
        _state.value.items.take(8).map { item ->
            DrawerQuestion(
                conversationId = item.conversation_id,
                title = item.conversation_title.orEmpty(),
                type = when (item.message_type?.lowercase()) {
                    "image", "input_image", "camera" -> DrawerQuestionType.Camera
                    "voice", "audio", "query_audio", "mic" -> DrawerQuestionType.Mic
                    "card", "statement", "pre_generated" -> DrawerQuestionType.Card
                    else -> DrawerQuestionType.Keyboard
                }
            )
        }

    private fun loadPage(page: Int, silent: Boolean, append: Boolean = false) {
        val uid = userId()
        if (uid.isBlank()) {
            _state.update {
                it.copy(items = emptyList(), isLoading = false, canLoadMore = false)
            }
            return
        }
        if (isFetching) return
        isFetching = true
        if (!silent) {
            _state.update { it.copy(isLoading = true, errorMessage = null, isNetworkError = false) }
        }
        scope.launch {
            historyUseCase.getConversationList(uid, page).collect { result ->
                isFetching = false
                when (result) {
                    is ApiResult.Success -> {
                        currentPage = page
                        val newItems = result.data.getItems()
                        _state.update { current ->
                            current.copy(
                                items = if (append) current.items + newItems else newItems,
                                isLoading = false,
                                errorMessage = null,
                                isNetworkError = false,
                                canLoadMore = result.data.canLoadMore(page) && newItems.isNotEmpty()
                            )
                        }
                    }
                    is ApiResult.Error -> {
                        _state.update { current ->
                            current.copy(
                                isLoading = false,
                                errorMessage = result.message,
                                isNetworkError = result.isNetworkError()
                            )
                        }
                    }
                }
            }
        }
    }
}
