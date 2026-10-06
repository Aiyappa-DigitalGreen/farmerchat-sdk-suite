package org.digitalgreen.farmerchat.sdk.core.ui.chat

import org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind
import org.digitalgreen.farmerchat.sdk.core.model.TextPromptResponse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Covers [buildSettledAiResponse] — the message the UI actually renders once an answer settles.
 *
 * Why this exists: the agentic stream (#27a) finalizes through the SAME builder as a synchronous
 * #27 reply, and that builder REBUILDS the message rather than copying the streaming one. A field
 * it forgets is destroyed. `isAgentic` was forgotten, so every streamed answer arrived at the UI
 * with the flag cleared and rendered the LEGACY footer — Share + **Save** + Listen with no
 * accuracy note — where the app shows the note above Share + Listen and no Save
 * (fc-compose-agentic `ChatResponseActions.kt:85`). Nothing failed; the answer was simply wrong.
 *
 * These tests pin the flags so the next field added to the settled message can't repeat it.
 */
internal class SettledAiResponseTest {

    private fun response(
        messageId: String? = "m-1",
        response: String? = "Use neem oil weekly.",
        alignments: org.digitalgreen.farmerchat.sdk.core.model.Alignment? = null
    ) = TextPromptResponse(
        error = false,
        message = null,
        message_id = messageId,
        query = "aphids on chickpea",
        response = response,
        resource_url = null,
        translated_response = null,
        follow_up_questions = null,
        section_message_id = null,
        actual_content_provider = null,
        content_provider_logo = null,
        points = null,
        alignments = alignments
    )

    // ---- the regression this file was written for ---------------------------------------

    @Test
    internal fun `an agentic finalize keeps isAgentic`() {
        val settled = buildSettledAiResponse(
            data = response(),
            answerText = "Use neem oil weekly.",
            aiId = "stream-1",
            alignmentKind = null,
            isAgentic = true
        )
        assertTrue(
            "A #27a metadata finalize must stay agentic — the answer footer depends on it",
            settled.isAgentic
        )
    }

    @Test
    internal fun `a synchronous finalize is not agentic`() {
        val settled = buildSettledAiResponse(
            data = response(),
            answerText = "Use neem oil weekly.",
            aiId = "ai-1",
            alignmentKind = null,
            isAgentic = false
        )
        assertFalse("A #27 reply must not claim to be agentic", settled.isAgentic)
    }

    @Test
    internal fun `the agentic path reuses the stream id so the reveal set still matches`() {
        val settled = buildSettledAiResponse(
            data = response(),
            answerText = "Use neem oil weekly.",
            aiId = "stream-42",
            alignmentKind = null,
            isAgentic = true
        )
        assertEquals("stream-42", settled.id)
        assertEquals("m-1", settled.messageId)
    }

    // ---- the alignment fields the same builder owns --------------------------------------

    @Test
    internal fun `an additive surface keeps its nudge alongside the answer`() {
        val settled = buildSettledAiResponse(
            data = response(),
            answerText = "Use neem oil weekly.",
            aiId = "stream-1",
            alignmentKind = AlignmentKind.COMMODITY_CONFIRM,
            isAgentic = true
        )
        assertTrue(settled.isAgentic)
        assertEquals(AlignmentKind.COMMODITY_CONFIRM, settled.alignmentKind)
        assertEquals("Use neem oil weekly.", settled.text)
    }

    @Test
    internal fun `an exclusive surface carries no additive message`() {
        val settled = buildSettledAiResponse(
            data = response(response = ""),
            answerText = "",
            aiId = "stream-1",
            alignmentKind = AlignmentKind.CLARIFY,
            isAgentic = true
        )
        assertNull(
            "alignmentMessage is only for ADDITIVE surfaces; an exclusive one IS the message",
            settled.alignmentMessage
        )
    }
}
