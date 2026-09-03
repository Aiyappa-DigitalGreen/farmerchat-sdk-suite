package org.digitalgreen.farmerchat.sdk.core.remote

import com.google.gson.GsonBuilder
import okhttp3.OkHttpClient
import okio.Buffer
import org.digitalgreen.farmerchat.sdk.core.model.AgenticEvent
import org.digitalgreen.farmerchat.sdk.core.model.AlignmentChip
import org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind
import org.digitalgreen.farmerchat.sdk.core.ui.chat.sanitizeAgenticStreamText
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Replays the two REAL agentic streams — captured live from stage 2026-09-03 and checked in under
 * `docs/captures/` — through the production reader ([AgenticChatDataSource.readEvents]) byte for
 * byte, and asserts the whole parsed event sequence.
 *
 * This is the strongest test available for the wire contract and it only became possible once the
 * stream was captured: every earlier attempt got 0 bytes from the endpoint, so the framing had to
 * be pinned down with hand-written payloads (`AgenticEventParsingTest`, still valid — it covers the
 * permissive fallbacks the captures do not exercise).
 *
 * The captures are copied into `src/test/resources/wire-captures/` so the test is hermetic; their byte
 * lengths are asserted against the sizes documented in docs/02 §#27a so a stale copy cannot pass.
 */
class AgenticCaptureReplayTest {

    private val parser = AgenticChatDataSource(
        client = OkHttpClient(),
        gson = GsonBuilder().create(),
        baseUrl = "https://example.test/"
    )

    private fun capture(name: String): ByteArray =
        checkNotNull(javaClass.classLoader?.getResourceAsStream("wire-captures/$name")) {
            "missing checked-in capture: wire-captures/$name"
        }.use { it.readBytes() }

    /** Feeds a capture through the real reader and returns everything it emitted, in order. */
    private fun replay(name: String): List<AgenticEvent> {
        val bytes = capture(name)
        val events = mutableListOf<AgenticEvent>()
        parser.readEvents(Buffer().write(bytes)) { events += it }
        return events
    }

    private fun names(events: List<AgenticEvent>) = events.map { it::class.simpleName }

    // ---- prose answer ---------------------------------------------------------------------

    private val prose = "agentic_stream_prose_20260903.sse"

    @Test
    fun `the checked-in captures are the documented bytes`() {
        // docs/02 §#27a records both sizes; a re-export that changed them must fail here rather
        // than quietly weaken every assertion below.
        assertEquals(13273, capture(prose).size)
        assertEquals(4620, capture(gps).size)
    }

    @Test
    fun `prose capture yields the full 15-event sequence in order`() {
        val events = replay(prose)
        assertEquals(
            listOf(
                "Status",
                "ToolCall",
                "ToolResult",
                "TextDelta", "TextDelta", "TextDelta", "TextDelta", "TextDelta",
                "TextDelta", "TextDelta", "TextDelta", "TextDelta",
                "Done",
                "Surface",
                "Metadata"
            ),
            names(events)
        )
        // `metadata` is LAST and is what the reader treats as terminal; `done` is not.
        assertTrue(events.last() is AgenticEvent.Metadata)
    }

    @Test
    fun `the status ping arrives first, before any tool or delta`() {
        val events = replay(prose)
        assertEquals(AgenticEvent.Status("thinking"), events.first())
    }

    @Test
    fun `the nine deltas concatenate to the final answer`() {
        val events = replay(prose)
        val deltas = events.filterIsInstance<AgenticEvent.TextDelta>()
        assertEquals(9, deltas.size)

        val streamed = deltas.joinToString("") { it.delta }
        val metadata = events.filterIsInstance<AgenticEvent.Metadata>().single().response

        // The streamed prose IS the final answer — no reassembly, no lost chunk, no duplication.
        assertEquals(metadata.response, streamed)
        assertTrue(streamed.startsWith("To store harvested maize properly and prevent loss"))
        assertTrue(streamed.contains("**12-13%**"))
        assertTrue(streamed.trimEnd().endsWith("away from walls."))

        // What the farmer actually sees: the sanitizer is a pure trim on this answer (no control
        // tokens, no ```followups fence), so nothing of the real answer is stripped.
        assertEquals(metadata.response?.trimEnd(), sanitizeAgenticStreamText(streamed))
    }

    @Test
    fun `the tool events carry their farmer-facing status labels`() {
        val events = replay(prose)
        val call = events.filterIsInstance<AgenticEvent.ToolCall>().single()
        assertEquals("get_farmer_farms", call.name)
        assertEquals("Loading your farms", call.statusText)

        val result = events.filterIsInstance<AgenticEvent.ToolResult>().single()
        assertEquals("get_farmer_farms", result.name)
        assertEquals("Farms loaded", result.statusText)
    }

    @Test
    fun `the prose capture's mid-stream surface is the additive commodity-confirm`() {
        val surface = replay(prose).filterIsInstance<AgenticEvent.Surface>().single()
        assertEquals("eph_c425c04c25464d59a3fe37d2d21680f0", surface.id)
        // `type` lives on the envelope, not in `payload` — the reader lifts it across so this is
        // field-identical to metadata.alignments.
        assertEquals("commodity-confirm", surface.alignment.type)
        assertEquals(AlignmentKind.COMMODITY_CONFIRM, AlignmentKind.fromType(surface.alignment.type))
        assertTrue(AlignmentKind.COMMODITY_CONFIRM.isAdditive)
        assertEquals("profile", surface.alignment.intent)
        // Non-blocking: it accompanies a real answer, so it stays dismissible.
        assertEquals(false, surface.alignment.blocking)
        assertEquals("maize", surface.alignment.context?.subject)
        assertEquals(2, surface.alignment.chips?.size)
        assertEquals("confirm", surface.alignment.chips?.first()?.value)
        // No `behavior` on this surface's chips, and its `action` is the literal "select" — which
        // is NOT AlignmentChip.ACTION_SELECT ("invoke"), so it correctly routes as a text chip.
        assertNull(surface.alignment.chips?.first()?.behavior)
        assertEquals("select", surface.alignment.chips?.first()?.action)
        assertEquals("decline", surface.alignment.chips?.get(1)?.action)
        assertEquals("not_now", surface.alignment.chips?.get(1)?.value)
        // The `submit` object on this surface is the message flavour.
        assertEquals("message", surface.alignment.chips?.first()?.submit?.kind)
        assertEquals(
            "Yes, save my maize crop to my farmer profile",
            surface.alignment.chips?.first()?.submit?.text
        )
    }

    @Test
    fun `the mid-stream surface and metadata alignments are the SAME surface`() {
        // Which is why rendering on `surface` and finalizing on `metadata` must write ONE message:
        // two events, one question.
        val events = replay(prose)
        val fromSurface = events.filterIsInstance<AgenticEvent.Surface>().single().alignment
        val fromMetadata = events.filterIsInstance<AgenticEvent.Metadata>().single()
            .response.alignments
        assertNotNull(fromMetadata)
        assertEquals(fromSurface.type, fromMetadata?.type)
        assertEquals(fromSurface.message, fromMetadata?.message)
        assertEquals(fromSurface.chips?.map { it.value }, fromMetadata?.chips?.map { it.value })
    }

    @Test
    fun `the prose metadata carries the ids the SDK correlates on`() {
        val metadata = replay(prose).filterIsInstance<AgenticEvent.Metadata>().single().response
        assertEquals("0485ecce-1793-47b5-b6bf-258cf6251bc4", metadata.message_id)
        assertEquals("0485ecce-1793-47b5-b6bf-258cf6251bc4", metadata.section_message_id)
        assertFalse(metadata.error)
        // Root CLAUDE.md §3: follow-ups NEVER come from here.
        assertTrue(metadata.follow_up_questions.isNullOrEmpty())
    }

    // ---- gps-prompt surface ---------------------------------------------------------------

    private val gps = "agentic_stream_gps_surface_20260903.sse"

    @Test
    fun `gps capture yields status, surface, done, metadata and no deltas`() {
        val events = replay(gps)
        assertEquals(listOf("Status", "Surface", "Done", "Metadata"), names(events))
        // Zero text: the surface IS the answer. A finalize path that needs accumulated text to
        // avoid an error card would show one here.
        assertTrue(events.filterIsInstance<AgenticEvent.TextDelta>().isEmpty())
        val done = events.filterIsInstance<AgenticEvent.Done>().single()
        assertNull(done.answer)
        assertTrue(done.followUps.isEmpty())
    }

    @Test
    fun `gps capture yields a gps-prompt surface with both chips`() {
        val surface = replay(gps).filterIsInstance<AgenticEvent.Surface>().single()
        assertEquals("srf_e13c09d9", surface.id)
        val alignment = surface.alignment
        assertEquals("gps-prompt", alignment.type)
        assertEquals(AlignmentKind.GPS_PROMPT, AlignmentKind.fromType(alignment.type))
        assertEquals("capability", alignment.intent)
        assertEquals("capability", alignment.interaction_kind)
        // Blocking: the backend cannot proceed, so the flavours withhold the escape hatch.
        assertEquals(true, alignment.blocking)
        assertTrue(alignment.message!!.startsWith("Share your precise location"))
        assertEquals("coordinates", alignment.context?.required_precision)
        assertEquals("What fertiliser for maize?", alignment.context?.original_query)
        assertEquals("What fertiliser for maize?", alignment.original_query)
        assertEquals("What fertiliser for maize?", alignment.effectiveOriginalQuery)
        assertEquals(1, alignment.budget?.asked)
        assertEquals(2, alignment.budget?.max)

        val chips = alignment.chips!!
        assertEquals(2, chips.size)

        val share = chips[0]
        assertEquals("Give permission", share.label)
        assertEquals("gps.button", share.label_key)
        assertEquals("Give permission", share.label_en)
        assertEquals(AlignmentChip.VALUE_SHARE_LOCATION, share.value)
        assertEquals(AlignmentChip.BEHAVIOR_INVOKE_CAPABILITY, share.behavior)
        assertEquals(AlignmentChip.CAPABILITY_LOCATION, share.capability)
        assertEquals("gps", share.request)
        assertEquals(AlignmentChip.ACTION_SELECT, share.action)
        assertEquals("action", share.submit?.kind)
        assertEquals("grant", share.submit?.action)
        assertEquals("location", share.submit?.requires)
        assertEquals("gps-prompt", share.submit?.surface_type)
        assertEquals(emptyMap<String, Any?>(), share.submit?.data)

        val decline = chips[1]
        assertEquals("Continue without location", decline.label)
        assertEquals("gps.dismiss", decline.label_key)
        // The live decline value is NOT the app's `not_now` — docs/05.
        assertEquals(AlignmentChip.VALUE_USE_APPROXIMATE_LOCATION, decline.value)
        assertEquals(AlignmentChip.BEHAVIOR_CONTINUE, decline.behavior)
        assertEquals(AlignmentChip.CAPABILITY_LOCATION, decline.capability)
        assertEquals("use_current", decline.request)
        assertEquals(AlignmentChip.ACTION_CONTINUE, decline.action)
        assertEquals("dismiss", decline.submit?.action)
    }

    @Test
    fun `the gps metadata repeats the surface as alignments`() {
        val metadata = replay(gps).filterIsInstance<AgenticEvent.Metadata>().single().response
        assertEquals("be640ec6-8303-484a-909e-3c1b9a8d4a39", metadata.message_id)
        // The exclusive surface's `response` is empty ON PURPOSE — treating it as an error is the
        // failure mode docs/02 calls out.
        assertEquals("", metadata.response)
        val alignments = metadata.alignments!!
        assertEquals("gps-prompt", alignments.type)
        assertEquals(true, alignments.blocking)
        assertEquals(2, alignments.chips?.size)
        assertEquals(
            AlignmentChip.VALUE_USE_APPROXIMATE_LOCATION,
            alignments.chips?.get(1)?.value
        )
    }
}
