package org.digitalgreen.farmerchat.sdk.core.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Guards the capability-chip routing rule and the exact wire strings behind it.
 *
 * Background: every alignment chip used to send its own text as the question, so the two
 * CAPABILITY surfaces did nothing — `gps-prompt` never started the location flow and
 * `upload-photo` never opened a picker. A capability chip must invoke a capability and send only
 * the OUTCOME; every other chip still sends text.
 *
 * The constants are asserted literally because they are easy to "helpfully" normalize and a
 * mismatch fails silently — the chip would fall through to the text path and the farmer would send
 * the string "share_precise_location" as their question.
 */
class CapabilityChipTest {

    /** Mirrors the `when` in the flavours' alignment chip handlers. */
    private enum class Route { LOCATION, CAMERA, GALLERY, TEXT }

    private fun route(kind: AlignmentKind?, chip: AlignmentChip): Route {
        val isInvoke = chip.action == AlignmentChip.ACTION_SELECT
        val isPhoto = kind == AlignmentKind.UPLOAD_PHOTO && isInvoke
        return when {
            kind == AlignmentKind.GPS_PROMPT && isInvoke &&
                chip.value == AlignmentChip.VALUE_SHARE_LOCATION -> Route.LOCATION
            isPhoto && chip.value == AlignmentChip.VALUE_TAKE_PHOTO -> Route.CAMERA
            isPhoto && chip.value == AlignmentChip.VALUE_CHOOSE_FROM_GALLERY -> Route.GALLERY
            else -> Route.TEXT
        }
    }

    private fun invoke(value: String) =
        AlignmentChip(label = "l", value = value, action = AlignmentChip.ACTION_SELECT)

    @Test
    fun `wire constants are exactly the app's strings`() {
        // ACTION_SELECT is "invoke", NOT "select"; and the location value is the *precise* one —
        // the app has a `share_location` constant commented out directly above it.
        assertEquals("invoke", AlignmentChip.ACTION_SELECT)
        assertEquals("share_precise_location", AlignmentChip.VALUE_SHARE_LOCATION)
        assertEquals("take_photo", AlignmentChip.VALUE_TAKE_PHOTO)
        assertEquals("choose_from_gallery", AlignmentChip.VALUE_CHOOSE_FROM_GALLERY)
        assertEquals("not_now", AlignmentChip.VALUE_NOT_NOW)
    }

    @Test
    fun `capability chips invoke their capability`() {
        assertEquals(Route.LOCATION, route(AlignmentKind.GPS_PROMPT, invoke("share_precise_location")))
        assertEquals(Route.CAMERA, route(AlignmentKind.UPLOAD_PHOTO, invoke("take_photo")))
        assertEquals(Route.GALLERY, route(AlignmentKind.UPLOAD_PHOTO, invoke("choose_from_gallery")))
    }

    @Test
    fun `a decline chip sends text, it does not invoke anything`() {
        // "Not now" on a capability prompt is an ordinary answer to the blocking question.
        assertEquals(Route.TEXT, route(AlignmentKind.GPS_PROMPT, invoke("not_now")))
        assertEquals(Route.TEXT, route(AlignmentKind.UPLOAD_PHOTO, invoke("not_now")))
    }

    @Test
    fun `action must be invoke for a capability chip to fire`() {
        // A chip carrying the same value but no `invoke` action is a plain text chip.
        val noAction = AlignmentChip(label = "l", value = "share_precise_location", action = null)
        assertEquals(Route.TEXT, route(AlignmentKind.GPS_PROMPT, noAction))
    }

    @Test
    fun `the value must match its own kind`() {
        // take_photo under gps-prompt, or share_location under upload-photo, is not a capability.
        assertEquals(Route.TEXT, route(AlignmentKind.GPS_PROMPT, invoke("take_photo")))
        assertEquals(Route.TEXT, route(AlignmentKind.UPLOAD_PHOTO, invoke("share_precise_location")))
    }

    @Test
    fun `non-capability surfaces always send text`() {
        for (k in listOf(
            AlignmentKind.CLARIFY, AlignmentKind.CONFIRM, AlignmentKind.ESCALATE,
            AlignmentKind.GENDER_SELECT, AlignmentKind.COMMODITY_CONFIRM
        )) {
            assertEquals(Route.TEXT, route(k, invoke("share_precise_location")))
        }
        assertEquals(Route.TEXT, route(null, invoke("take_photo")))
    }

    @Test
    fun `only the two capability kinds are non-additive prompts that invoke`() {
        // Sanity-check the additive split the surfaces depend on.
        assertFalse(AlignmentKind.GPS_PROMPT.isAdditive)
        assertFalse(AlignmentKind.UPLOAD_PHOTO.isAdditive)
        assertTrue(AlignmentKind.GENDER_SELECT.isAdditive)
        assertTrue(AlignmentKind.COMMODITY_CONFIRM.isAdditive)
    }
}
