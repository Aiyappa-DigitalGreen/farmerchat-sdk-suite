package org.digitalgreen.farmerchat.sdk.core.ui.chat

import com.google.gson.Gson
import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Covers [buildAgenticImageRequest]: with agentic chat on, the app sends a photo through the
 * agentic text endpoint (#27a), not `image_analysis` (fc-compose-agentic ChatViewModel.kt:1863-1879).
 * The test pins the exact wire body the app builds.
 */
internal class AgenticImageRequestTest {

    private fun body(retry: Boolean = false) = JsonParser.parseString(
        Gson().toJson(
            buildAgenticImageRequest(
                conversationId = "conv-1",
                query = "What is wrong with my crop?",
                base64Image = "QUJD",
                imageName = "image_x.jpg",
                retry = retry,
                streamingRequired = true
            )
        )
    ).asJsonObject

    @Test
    fun `the photo rides on the agentic request as image plus image_name`() {
        val b = body()
        assertEquals("image", b["triggered_input_type"].asString)
        assertEquals("QUJD", b["image"].asString)
        assertEquals("image_x.jpg", b["image_name"].asString)
        assertEquals("What is wrong with my crop?", b["query"].asString)
        assertEquals("conv-1", b["conversation_id"].asString)
        assertEquals("", b["message_id"].asString)
        assertTrue(b["use_entity_extraction"].asBoolean)
        assertTrue(b["streaming_required"].asBoolean)
        assertFalse(b["retry"].asBoolean)
    }

    @Test
    fun `no location, parent or decline fields go out, as in the app`() {
        val b = body()
        listOf(
            "latitude", "longitude", "parent_message_id", "photo_declined",
            "location_declined", "transcription_id", "statement_id"
        ).forEach { assertFalse("unexpected field $it", b.has(it)) }
    }

    @Test
    fun `a retry is flagged`() {
        assertTrue(body(retry = true)["retry"].asBoolean)
    }
}
