package org.digitalgreen.farmerchat.sdk.core.ui.chat

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Covers [sanitizeAgenticStreamText].
 *
 * The agentic stream carries control tokens that the clean `metadata.response` does not. They are
 * invisible in the final answer but very visible while the answer types itself, so getting this
 * wrong means farmers watch `<<commodities:chickpea>>` appear mid-sentence.
 */
class AgenticStreamTextTest {

    @Test
    fun `plain text is untouched`() {
        assertEquals("Use neem oil weekly.", sanitizeAgenticStreamText("Use neem oil weekly."))
    }

    @Test
    fun `completed control tokens are stripped`() {
        assertEquals(
            "Use neem oil.",
            sanitizeAgenticStreamText("Use neem oil.<<commodities:chickpea>>")
        )
    }

    @Test
    fun `multiple control tokens are all stripped`() {
        assertEquals(
            "Spray early.",
            sanitizeAgenticStreamText("Spray<<a:1>> early.<<resolution:plan_created>>")
                .replace("  ", " ")
        )
    }

    @Test
    fun `a completed followups block is stripped`() {
        val raw = "Use neem oil.\n```followups\nHow often?\nIs it safe?\n```"
        assertEquals("Use neem oil.", sanitizeAgenticStreamText(raw))
    }

    // ---- the mid-stream cases: tokens arrive character by character ----------------------

    @Test
    fun `a half-arrived control token is cut, not shown`() {
        // Mid-stream the text can end in a partial token. Showing "<<comm" would be visible junk.
        assertEquals("Use neem oil.", sanitizeAgenticStreamText("Use neem oil.<<comm"))
    }

    @Test
    fun `an unterminated followups fence is cut`() {
        assertEquals(
            "Use neem oil.",
            sanitizeAgenticStreamText("Use neem oil.\n```followups\nHow often?")
        )
    }

    @Test
    fun `text consisting only of a token becomes empty`() {
        assertEquals("", sanitizeAgenticStreamText("<<resolution:plan_created>>"))
    }

    @Test
    fun `trailing whitespace left by stripping is trimmed`() {
        assertEquals("Use neem oil.", sanitizeAgenticStreamText("Use neem oil.   <<a:1>>  "))
    }

    @Test
    fun `empty input stays empty`() {
        assertEquals("", sanitizeAgenticStreamText(""))
    }
}
