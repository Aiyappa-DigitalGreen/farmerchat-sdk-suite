package org.digitalgreen.farmerchat.sdk.core.ui.chat

import org.digitalgreen.farmerchat.sdk.core.model.AlignmentChip
import org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Covers the upload-photo chip outcomes (app fc-compose-agentic ChatScreen.kt:431-483). When no
 * photo comes back, the surface is answered as a chip pick with `photo_declined`, and core turns
 * the pick into `parent_message_id` + `triggered_input_type = "align_chip_sel"`. A photo is
 * reported as a chip pick of the upload-photo kind.
 */
internal class PhotoChipOutcomeTest {

    @Test
    fun `no photo answers the surface it came from, flagged photo_declined`() {
        val a = photoChipDeclineAction("surface-1", "I don't have a photo to share right now")
        assertEquals("surface-1", a.sourceMessageId)
        assertEquals("I don't have a photo to share right now", a.query)
        assertEquals(a.query, a.selectionValue)
        assertTrue(a.photoDeclined)
        assertFalse(a.locationDeclined)
        assertNull(a.displayLabel)
        assertEquals(AlignmentKind.UPLOAD_PHOTO.analyticsType, a.chipType)
        assertEquals(AlignmentChip.VALUE_NOT_NOW, a.chipValue)
        assertEquals(a.query, a.chipLabel)
    }

    @Test
    fun `a chip photo is reported as an upload-photo chip pick`() {
        val p = photoChipSendProperties(42, AlignmentChip.VALUE_TAKE_PHOTO, "Take a photo")
        assertTrue(p.isImageQuery)
        assertFalse(p.isTextQuery)
        assertFalse(p.isFollowupPrompt)
        assertEquals(0, p.lengthOfTextQuery)
        assertEquals(42, p.sizeOfImageKb)
        assertTrue(p.isAlignmentChip)
        assertEquals(AlignmentKind.UPLOAD_PHOTO.analyticsType, p.agenticChipType)
        assertEquals(AlignmentChip.VALUE_TAKE_PHOTO, p.agenticChipValue)
        assertEquals("Take a photo", p.agenticChipLabel)
    }
}
