package org.digitalgreen.farmerchat.sdk.core.ui.chat

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Covers [sanitizeAgenticFinalText] — the settled-answer clean-up. Regression for the stage backend
 * leaking the follow-up control block into `metadata.response` (weather answer, 2026-10-06).
 */
class AgenticFinalTextTest {

    @Test
    fun `clean answer is untouched`() {
        assertEquals("Use neem oil weekly.", sanitizeAgenticFinalText("Use neem oil weekly."))
    }

    @Test
    fun `closed followups block is removed`() {
        val raw = "Current conditions are suitable.\n\n```followups\n" +
            "[\"Will it rain later today?\", \"What is the forecast for tomorrow?\"]\n```"
        assertEquals("Current conditions are suitable.", sanitizeAgenticFinalText(raw))
    }

    @Test
    fun `unclosed trailing followups block is removed`() {
        assertEquals("Answer.", sanitizeAgenticFinalText("Answer.\n```followups\n[\"Q?\"]"))
    }

    @Test
    fun `complete control markers are removed but a lone angle pair is kept`() {
        assertEquals("Answer.", sanitizeAgenticFinalText("Answer.<<commodities:chickpea>>"))
        assertEquals("Ratio a << b holds.", sanitizeAgenticFinalText("Ratio a << b holds."))
    }
}
