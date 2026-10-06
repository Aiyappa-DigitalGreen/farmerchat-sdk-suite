package org.digitalgreen.farmerchat.sdk.core.ui.chat

import org.digitalgreen.farmerchat.sdk.core.model.AlignmentChip
import org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The chat reserve rule and its scroll anchor (`ui/chat/ChatReserve.kt`).
 *
 * These are pinned by tests rather than by eye because the reserve and the auto-scroll fight each
 * other when they disagree — commit `28be342` ("streaming thread went blank — reserve and
 * auto-scroll were fighting") is what that looks like in production, and the symptom is a blank
 * thread for over a second, not a subtle misalignment. The wire cannot be exercised for agentic
 * chat (see `versions/v2/README.md` §"Not verified"), so tests are the only guard.
 */
class ChatReserveTest {

    private fun answer(
        id: String = "a1",
        streaming: Boolean = false,
        interrupted: Boolean = false,
        alignmentKind: AlignmentKind? = null,
        alignmentSelectedValues: List<String> = emptyList()
    ) = ChatMessage.AiResponse(
        text = "some answer",
        followUpQuestions = emptyList(),
        id = id,
        isStreaming = streaming,
        isInterrupted = interrupted,
        alignmentKind = alignmentKind,
        alignmentChips = if (alignmentKind != null) {
            listOf(AlignmentChip(label = "Yes", value = "yes"))
        } else {
            null
        },
        alignmentSelectedValues = alignmentSelectedValues
    )

    private fun question(id: String = "q1") =
        ChatMessage.UserMessage(text = "my question", id = id)

    // ---------------------------------------------------------------- holdsChatReserve

    @Test
    fun `a response that is not the newest never reserves`() {
        // Every other term is true; isLastResponse alone must veto.
        assertFalse(
            answer(streaming = true).holdsChatReserve(isLastResponse = false, isLoading = false)
        )
    }

    @Test
    fun `a streaming answer reserves even though core keeps isLoading true`() {
        // This is the case the app's `!isLoading` alone would MISS in the SDK:
        // updateStreamingResponse sets isLoading = true for the whole stream.
        assertTrue(
            answer(streaming = true).holdsChatReserve(isLastResponse = true, isLoading = true)
        )
    }

    @Test
    fun `an interrupted answer reserves so the error card sits near the top`() {
        assertTrue(
            answer(interrupted = true).holdsChatReserve(isLastResponse = true, isLoading = true)
        )
    }

    @Test
    fun `a finished short answer reserves - the app parity widening`() {
        // The whole point of 9023b57f: without this the reserve collapsed the instant a stream
        // settled and the thread jumped one last time.
        assertTrue(answer().holdsChatReserve(isLastResponse = true, isLoading = false))
    }

    @Test
    fun `the previous answer does NOT reserve while a follow-up is in flight`() {
        // It is still the newest AI response at this moment, and it must stay collapsed so it
        // scrolls up out of the new question's way.
        assertFalse(answer().holdsChatReserve(isLastResponse = true, isLoading = true))
    }

    @Test
    fun `an unanswered alignment surface reserves even while loading`() {
        // Core keeps isLoading true for a blocking surface on purpose (to hold chips disabled),
        // so without the alignment clause the surface would lose its reserve and the thread would
        // collapse upward the moment the surface arrived.
        assertTrue(
            answer(alignmentKind = AlignmentKind.CLARIFY)
                .holdsChatReserve(isLastResponse = true, isLoading = true)
        )
    }

    @Test
    fun `an answered alignment surface falls back to the isLoading rule`() {
        val picked = answer(
            alignmentKind = AlignmentKind.CLARIFY,
            alignmentSelectedValues = listOf("yes")
        )
        // Chip already picked and another answer in flight -> no reserve.
        assertFalse(picked.holdsChatReserve(isLastResponse = true, isLoading = true))
        // Chip picked and nothing in flight -> reserves as a finished answer.
        assertTrue(picked.holdsChatReserve(isLastResponse = true, isLoading = false))
    }

    // ------------------------------------------------------------ chatScrollAnchorIndex

    @Test
    fun `an empty thread anchors at zero rather than at minus one`() {
        assertEquals(0, ChatState().chatScrollAnchorIndex())
    }

    @Test
    fun `the anchor is the question above a reserving answer`() {
        val state = ChatState(
            messages = listOf(question("q1"), answer("a1")),
            isLoading = false
        )
        // Index 1 holds the reserve, so anchor index 0 — the question — to the top.
        assertEquals(0, state.chatScrollAnchorIndex())
    }

    @Test
    fun `the anchor is the last row when the last answer does not reserve`() {
        val state = ChatState(
            messages = listOf(question("q1"), answer("a1")),
            isLoading = true
        )
        assertEquals(1, state.chatScrollAnchorIndex())
    }

    @Test
    fun `the anchor does not shift when a question is rendered below the answer`() {
        // The reserve holder is no longer the final row: a newly sent question is. Anchoring
        // above the final row would put the OLD answer at the top instead of the new question.
        val state = ChatState(
            messages = listOf(question("q1"), answer("a1"), question("q2")),
            isLoading = true
        )
        assertEquals(2, state.chatScrollAnchorIndex())
    }

    @Test
    fun `a lone reserving answer anchors to itself rather than to index minus one`() {
        // Guards the `lastIndex > 0` clause: a thread whose only row is a pre-generated answer.
        val state = ChatState(messages = listOf(answer("a1")), isLoading = false)
        assertEquals(0, state.chatScrollAnchorIndex())
    }

    @Test
    fun `the anchor agrees with the reserve predicate on every isLoading value`() {
        // The two must never disagree about the final row — that disagreement IS the bug.
        for (isLoading in listOf(true, false)) {
            for (streaming in listOf(true, false)) {
                val last = answer(streaming = streaming)
                val state = ChatState(
                    messages = listOf(question("q1"), last),
                    isLoading = isLoading
                )
                val reserves = last.holdsChatReserve(isLastResponse = true, isLoading = isLoading)
                val anchoredAboveIt = state.chatScrollAnchorIndex() == 0
                assertEquals(
                    "reserve=$reserves but anchoredAbove=$anchoredAboveIt " +
                        "(isLoading=$isLoading, streaming=$streaming)",
                    reserves,
                    anchoredAboveIt
                )
            }
        }
    }
}
