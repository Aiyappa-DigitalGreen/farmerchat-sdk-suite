package org.digitalgreen.farmerchat.sdk.core.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Covers [AlignmentKind] — the wire-string mapping for 2.0.0 alignment surfaces.
 *
 * Two things make this worth pinning. The `analyticsType` strings are consumed by MoEngage
 * funnels, so a silent rename breaks dashboards rather than the build. And an unknown type must
 * map to null so the response falls through to a normal answer — a future backend surface the SDK
 * has never heard of should degrade to plain text, not to a blank screen.
 */
class AlignmentKindTest {

    @Test
    fun `every wire type maps to its kind`() {
        assertEquals(AlignmentKind.CLARIFY, AlignmentKind.fromType("alignment-clarify"))
        assertEquals(AlignmentKind.CONFIRM, AlignmentKind.fromType("alignment-confirm"))
        assertEquals(AlignmentKind.ESCALATE, AlignmentKind.fromType("alignment-escalate"))
        assertEquals(AlignmentKind.GPS_PROMPT, AlignmentKind.fromType("gps-prompt"))
        assertEquals(AlignmentKind.UPLOAD_PHOTO, AlignmentKind.fromType("upload-photo"))
        assertEquals(AlignmentKind.GENDER_SELECT, AlignmentKind.fromType("gender-select"))
        assertEquals(AlignmentKind.COMMODITY_CONFIRM, AlignmentKind.fromType("commodity-confirm"))
    }

    @Test
    fun `mapping tolerates case and surrounding whitespace`() {
        assertEquals(AlignmentKind.CLARIFY, AlignmentKind.fromType("  ALIGNMENT-CLARIFY "))
    }

    @Test
    fun `an unknown or absent type is null so the answer renders normally`() {
        assertNull(AlignmentKind.fromType("alignment-something-new"))
        assertNull(AlignmentKind.fromType(""))
        assertNull(AlignmentKind.fromType(null))
    }

    @Test
    fun `analyticsType round-trips through fromType`() {
        // Dashboards key off these exact strings; a rename must fail here, not in MoEngage.
        for (kind in AlignmentKind.entries) {
            assertEquals(kind, AlignmentKind.fromType(kind.analyticsType))
        }
    }

    @Test
    fun `only profile surfaces are additive`() {
        // Additive surfaces sit BELOW a real answer; exclusive ones replace it. Getting this
        // backwards would either hide an answer or show an orphaned nudge.
        assertTrue(AlignmentKind.GENDER_SELECT.isAdditive)
        assertTrue(AlignmentKind.COMMODITY_CONFIRM.isAdditive)
        for (kind in listOf(
            AlignmentKind.CLARIFY, AlignmentKind.CONFIRM, AlignmentKind.ESCALATE,
            AlignmentKind.GPS_PROMPT, AlignmentKind.UPLOAD_PHOTO
        )) {
            assertFalse("$kind must be exclusive", kind.isAdditive)
        }
    }
}
