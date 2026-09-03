package org.digitalgreen.farmerchat.sdk.core.remote

import com.google.gson.GsonBuilder
import okhttp3.OkHttpClient
import org.digitalgreen.farmerchat.sdk.core.model.AgenticEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Covers [AgenticChatDataSource.parseEvent] — the agentic wire mapping.
 *
 * These were written when the framing could not be verified against a live stream (the endpoint
 * opened but delivered 0 bytes to a guest). It CAN be now — see `AgenticCaptureReplayTest`, which
 * replays the two checked-in live captures through the real reader and is the authority on the
 * real contract.
 *
 * This class is still the right place for everything the captures do NOT exercise: the reader is
 * deliberately permissive (NDJSON framing, `type`-inside-the-payload, the delta aliases, typeless
 * recovery, malformed JSON), and these tests pin down what "permissive" means so a future backend
 * change that breaks an assumption fails here rather than silently showing farmers "Something went
 * wrong".
 */
class AgenticEventParsingTest {

    private val parser = AgenticChatDataSource(
        client = OkHttpClient(),
        gson = GsonBuilder().create(),
        baseUrl = "https://example.test/"
    )

    // ---- framing A: SSE, type from the `event:` line -------------------------------------

    @Test
    fun `sse event name drives the type`() {
        val e = parser.parseEvent("text_delta", """{"delta":"Aphids "}""")
        assertEquals(AgenticEvent.TextDelta("Aphids "), e)
    }

    @Test
    fun `event name matching ignores case and separators`() {
        // TOOL_CALL / tool_call / toolCall must all land on the same branch.
        for (name in listOf("TOOL_CALL", "tool_call", "toolCall")) {
            val e = parser.parseEvent(name, """{"name":"weather","status_text":"Checking weather"}""")
            assertTrue("$name should map to ToolCall", e is AgenticEvent.ToolCall)
            assertEquals("Checking weather", (e as AgenticEvent.ToolCall).statusText)
        }
    }

    // ---- framing B: bare NDJSON, type from inside the JSON -------------------------------

    @Test
    fun `type field inside the payload is used when no sse event line came`() {
        val e = parser.parseEvent(null, """{"type":"text_delta","delta":"on tomato"}""")
        assertEquals(AgenticEvent.TextDelta("on tomato"), e)
    }

    @Test
    fun `tool result carries its status label`() {
        val e = parser.parseEvent(null, """{"type":"tool_result","name":"weather","label":"Weather checked"}""")
        assertTrue(e is AgenticEvent.ToolResult)
        assertEquals("Weather checked", (e as AgenticEvent.ToolResult).statusText)
    }

    // ---- delta field aliases --------------------------------------------------------------

    @Test
    fun `delta is read from any of the known aliases`() {
        // Backends name the incremental chunk differently; losing it would silently break typing.
        for (field in listOf("delta", "text", "content", "token", "chunk")) {
            val e = parser.parseEvent("text_delta", """{"$field":"x"}""")
            assertEquals("alias $field should yield a delta", AgenticEvent.TextDelta("x"), e)
        }
    }

    @Test
    fun `empty delta is dropped rather than emitted`() {
        assertNull(parser.parseEvent("text_delta", """{"delta":""}"""))
    }

    // ---- terminal events -------------------------------------------------------------------

    @Test
    fun `metadata carries the full response and is what finalizes a stream`() {
        val e = parser.parseEvent(
            "metadata",
            """{"error":false,"response":"Use neem oil.","message_id":"m-1"}"""
        )
        assertTrue(e is AgenticEvent.Metadata)
        val r = (e as AgenticEvent.Metadata).response
        assertEquals("Use neem oil.", r.response)
        assertEquals("m-1", r.message_id)
    }

    @Test
    fun `done is a fallback carrying answer and follow ups`() {
        val e = parser.parseEvent(
            "done",
            """{"answer":"Use neem oil.","followups":["How often?","Is it safe?"]}"""
        )
        assertTrue(e is AgenticEvent.Done)
        val d = e as AgenticEvent.Done
        assertEquals("Use neem oil.", d.answer)
        assertEquals(listOf("How often?", "Is it safe?"), d.followUps)
    }

    @Test
    fun `done reads follow ups from any known alias`() {
        val e = parser.parseEvent("done", """{"answer":"a","follow_up_questions":["q"]}""")
        assertEquals(listOf("q"), (e as AgenticEvent.Done).followUps)
    }

    // ---- recovery: typeless payloads --------------------------------------------------------

    @Test
    fun `a typeless payload holding an answer is recovered as metadata`() {
        // Some backend variants stream the final response as a bare, typeless object. Dropping it
        // would surface to the farmer as "Something went wrong" despite a real answer arriving.
        val e = parser.parseEvent(null, """{"response":"Use neem oil.","error":false}""")
        assertTrue(e is AgenticEvent.Metadata)
        assertEquals("Use neem oil.", (e as AgenticEvent.Metadata).response.response)
    }

    @Test
    fun `a typeless payload holding a chunk is recovered as a delta`() {
        val e = parser.parseEvent(null, """{"content":"partial"}""")
        assertEquals(AgenticEvent.TextDelta("partial"), e)
    }

    @Test
    fun `a typeless payload carrying neither is ignored`() {
        // Section headers and similar scaffolding must not become spurious messages.
        assertNull(parser.parseEvent(null, """{"surface":"response"}"""))
    }

    // ---- robustness -------------------------------------------------------------------------

    @Test
    fun `blank data is ignored`() {
        assertNull(parser.parseEvent("text_delta", ""))
        assertNull(parser.parseEvent(null, "   "))
    }

    @Test
    fun `malformed json never throws`() {
        // A parse failure mid-stream must not take down the chat.
        assertNull(parser.parseEvent("metadata", "{not json"))
        assertNull(parser.parseEvent(null, "]["))
    }
}
