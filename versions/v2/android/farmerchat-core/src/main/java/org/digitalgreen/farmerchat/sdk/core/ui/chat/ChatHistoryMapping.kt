package org.digitalgreen.farmerchat.sdk.core.ui.chat

import android.net.Uri
import org.digitalgreen.farmerchat.sdk.core.model.ConversationChatHistoryMessageItem

/**
 * One page of endpoint `conversation_chat_history`, mapped for the chat thread.
 *
 * @property messages the turns, oldest first.
 * @property followUps the follow-up questions attached to the page's LAST AI response, as plain
 *   strings; null when that response has none. Their `follow_up_question_id`s are deliberately
 *   dropped: the app keeps only the strings (`ChatViewModel.kt:1296-1299`), so a history chip
 *   goes out as a plain `follow_up` query with no #30 click.
 * @property clarificationRequired the `clarification_required` flag of that last AI response.
 */
internal data class ChatHistoryPage(
    val messages: List<ChatMessage>,
    val followUps: List<String>?,
    val clarificationRequired: Boolean
)

/**
 * Port of the app's `mapConversationChatHistoryToChatHistoryMessages`
 * (fc-compose-agentic `ui/chat/ChatViewModel.kt:1254-1316`).
 *
 * - **Order.** The wire order cannot be trusted: DEMO returns turns NEWEST first. The app sorts
 *   by `message_input_time` ascending, with nulls last, before mapping
 *   (`ChatViewModel.kt:1255`). Kotlin's sort is stable, so items with the same time (a query
 *   and its response often share one) keep their relative wire order, exactly as in the app.
 * - **Follow-ups.** A type-7 item attaches to the message mapped just before it, and only when
 *   that message is an AI response. The page's chips are the follow-ups of the LAST AI response.
 *   Before this port, the SDK used whichever type-7 item came last in WIRE order, which on a
 *   newest-first page meant the OLDEST turn's chips.
 * - **Clarification.** This comes from the type-3 response item, as in the app, not from the
 *   type-7 item.
 *
 * List ids stay `message_id + type + page + index`. The index is taken AFTER the sort, as in the
 * app, and `page` is added because the index restarts on every page.
 */
internal fun mapChatHistoryPage(
    items: List<ConversationChatHistoryMessageItem>,
    page: Int,
    agenticUi: Boolean
): ChatHistoryPage {
    val sorted = items.sortedWith(compareBy(nullsLast(naturalOrder())) { it.message_input_time })
    val mapped = mutableListOf<ChatMessage>()
    // Follow-ups and clarification per AI response, keyed by list id (ChatMessage has no slot
    // for the clarification flag, and the app keeps both on its intermediate history model).
    val followUpsById = mutableMapOf<String, List<String>>()
    val clarificationById = mutableMapOf<String, Boolean>()
    sorted.forEachIndexed { index, item ->
        val uiId = "${item.message_id}_${item.message_type_id}_${page}_$index"
        when (item.message_type_id) {
            1 -> mapped += ChatMessage.UserMessage(
                text = item.query_text.orEmpty(),
                imageUri = item.query_media_file_url?.let(Uri::parse),
                userBubbleImageWideBanner = item.query_media_file_url != null,
                id = uiId
            )
            // App parity (ChatViewModel.kt:1270-1276): a voice turn shows query_text first and
            // falls back to heard_query_text. The SDK used to prefer heard_query_text.
            2 -> mapped += ChatMessage.UserMessage(
                text = item.query_text ?: item.heard_query_text.orEmpty(),
                audioUri = item.query_media_file_url?.let(Uri::parse),
                id = uiId
            )
            3 -> {
                mapped += ChatMessage.AiResponse(
                    text = item.response_text.orEmpty(),
                    id = uiId,
                    messageId = item.message_id,
                    // History has no per-message agentic flag: mirror the current UI, as the
                    // app does (ChatViewModel.kt:1343-1357).
                    isAgentic = agenticUi
                )
                clarificationById[uiId] = item.clarification_required == true
            }
            7 -> (mapped.lastOrNull() as? ChatMessage.AiResponse)?.let { last ->
                followUpsById[last.id] = item.questions?.map { it.question }.orEmpty()
            }
            11 -> mapped += ChatMessage.UserMessage(
                text = item.query_text.orEmpty(),
                imageUri = item.query_media_file_url?.let(Uri::parse),
                userBubbleImageWideBanner = false,
                id = uiId
            )
        }
    }
    val lastAi = mapped.lastOrNull { it is ChatMessage.AiResponse }
    return ChatHistoryPage(
        messages = mapped,
        followUps = lastAi?.let { followUpsById[it.id] },
        clarificationRequired = lastAi?.let { clarificationById[it.id] } ?: false
    )
}
