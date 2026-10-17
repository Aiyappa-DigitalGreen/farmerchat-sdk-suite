package org.digitalgreen.farmerchat.sdk.core.ui.chat

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Covers [synthesisStillWanted] (scenario pass 2026-10-17: a late #31 reply played the old answer). */
internal class SynthesisGuardTest {

    private fun ai(id: String) = ChatMessage.AiResponse(text = "a", id = "ui-$id", messageId = id)

    @Test
    fun `the reply plays while its answer is still the latest and idle`() {
        assertTrue(synthesisStillWanted("m1", ChatState(messages = listOf(ChatMessage.UserMessage("q"), ai("m1")))))
    }

    @Test
    fun `a reply that lands after a new question was sent is dropped`() {
        val loading = ChatState(
            messages = listOf(ai("m1"), ChatMessage.UserMessage("q2"), ChatMessage.LoadingPlaceholder(id = "p")),
            isLoading = true
        )
        assertFalse(synthesisStillWanted("m1", loading))
    }

    @Test
    fun `a reply for an answer that is no longer the latest is dropped`() {
        val answered = ChatState(messages = listOf(ai("m1"), ChatMessage.UserMessage("q2"), ai("m2")))
        assertFalse(synthesisStillWanted("m1", answered))
    }
}
