package org.digitalgreen.farmerchat.sdk.core.ui.chat

import org.digitalgreen.farmerchat.sdk.core.model.ConversationChatHistoryMessageItem
import org.digitalgreen.farmerchat.sdk.core.model.ConversationChatHistoryQuestion
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Covers [mapChatHistoryPage], the port of the app's
 * `mapConversationChatHistoryToChatHistoryMessages` (fc-compose-agentic `ChatViewModel.kt:1254`).
 *
 * The fixture uses the shape DEMO actually returned on 2026-10-16 for a three-turn conversation:
 * turns NEWEST first, and within each turn the items `1, 3, 7` all carry the same
 * `message_input_time`. Before the port, the SDK rendered that page upside down. Its chips also
 * came from the OLDEST turn, and their ids made a history chip fire #30, which the app never does.
 */
internal class ChatHistoryMappingTest {

    private fun item(
        type: Int,
        id: String,
        time: String?,
        query: String? = null,
        response: String? = null,
        questions: List<String>? = null,
        clarification: Boolean? = null
    ) = ConversationChatHistoryMessageItem(
        message_type_id = type,
        message_type = "t$type",
        message_id = id,
        message_input_time = time,
        query_text = query,
        response_text = response,
        questions = questions?.mapIndexed { i, q ->
            ConversationChatHistoryQuestion(follow_up_question_id = "$id-q$i", sequence = i + 1, question = q)
        },
        clarification_required = clarification
    )

    private fun turn(id: String, time: String, q: String, a: String, chips: List<String>, clarify: Boolean = false) =
        listOf(
            item(1, id, time, query = q),
            item(3, id, time, response = a, clarification = clarify),
            item(7, id, time, questions = chips)
        )

    /** DEMO's wire order: newest turn first. */
    private val newestFirst =
        turn("c", "2026-10-16T09:09:41.003873Z", "Knee high", "A3", listOf("c1", "c2"), clarify = true) +
            turn("b", "2026-10-16T09:08:34.415001Z", "What fertilizer?", "A2", listOf("b1")) +
            turn("a", "2026-10-16T09:07:25.859891Z", "Armyworm?", "A1", listOf("a1", "a2", "a3"))

    private fun texts(page: ChatHistoryPage) = page.messages.map {
        when (it) {
            is ChatMessage.UserMessage -> "U:${it.text}"
            is ChatMessage.AiResponse -> "A:${it.text}"
            else -> "?"
        }
    }

    @Test
    fun `a newest-first page renders oldest first, query before its answer`() {
        val page = mapChatHistoryPage(newestFirst, page = 1, agenticUi = true)
        assertEquals(
            listOf("U:Armyworm?", "A:A1", "U:What fertilizer?", "A:A2", "U:Knee high", "A:A3"),
            texts(page)
        )
    }

    @Test
    fun `chips come from the last answer, as plain strings`() {
        val page = mapChatHistoryPage(newestFirst, page = 1, agenticUi = true)
        assertEquals(listOf("c1", "c2"), page.followUps)
        // Clarification comes from the type-3 response item of that last answer.
        assertTrue(page.clarificationRequired)
    }

    @Test
    fun `an already chronological page is unchanged`() {
        val chronological =
            turn("a", "2026-10-16T09:07:25.859891Z", "Armyworm?", "A1", listOf("a1")) +
                turn("b", "2026-10-16T09:08:34.415001Z", "What fertilizer?", "A2", listOf("b1"))
        val page = mapChatHistoryPage(chronological, page = 1, agenticUi = false)
        assertEquals(listOf("U:Armyworm?", "A:A1", "U:What fertilizer?", "A:A2"), texts(page))
        assertEquals(listOf("b1"), page.followUps)
        assertFalse(page.clarificationRequired)
    }

    @Test
    fun `items without a time sort last, as in the app`() {
        val items = listOf(item(1, "x", null, query = "late")) +
            turn("a", "2026-10-16T09:07:25.859891Z", "early", "A1", emptyList())
        assertEquals(listOf("U:early", "A:A1", "U:late"), texts(mapChatHistoryPage(items, 1, true)))
    }

    @Test
    fun `follow-ups only attach to an answer, and a last answer without them yields null`() {
        // A type-7 item right after a user bubble attaches to nothing (app: lastOrNull ai_ only).
        val items = listOf(
            item(1, "a", "2026-10-16T09:00:00Z", query = "q"),
            item(7, "a", "2026-10-16T09:00:00Z", questions = listOf("orphan")),
            item(3, "a", "2026-10-16T09:00:00Z", response = "ans")
        )
        assertNull(mapChatHistoryPage(items, 1, true).followUps)
    }

    @Test
    fun `list ids stay unique across a turn that shares one message_id`() {
        val page = mapChatHistoryPage(newestFirst, page = 2, agenticUi = true)
        assertEquals(page.messages.size, page.messages.map { it.id }.toSet().size)
        assertEquals("c", (page.messages.last() as ChatMessage.AiResponse).messageId)
    }

    @Test
    fun `a voice turn shows query_text first, then heard_query_text, as in the app`() {
        val t = "2026-10-16T09:00:00Z"
        val both = item(2, "v", t, query = "typed form").copy(heard_query_text = "heard form")
        val heardOnly = item(2, "w", t).copy(heard_query_text = "heard only")
        val neither = item(2, "x", t)
        val page = mapChatHistoryPage(listOf(both, heardOnly, neither), 1, true)
        assertEquals(listOf("U:typed form", "U:heard only", "U:"), texts(page))
    }
}
