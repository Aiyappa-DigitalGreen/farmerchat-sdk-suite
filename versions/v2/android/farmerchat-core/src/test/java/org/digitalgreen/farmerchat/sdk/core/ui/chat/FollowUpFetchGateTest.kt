package org.digitalgreen.farmerchat.sdk.core.ui.chat

import org.digitalgreen.farmerchat.sdk.core.model.AlignmentKind
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Covers [fetchesFollowUpsAfter] (app ChatViewModel.kt:2020-2025). Before this gate the SDK
 * called #29 after every answer, including an exclusive surface such as a gps-prompt or a clarify
 * question, where the app does not.
 */
internal class FollowUpFetchGateTest {

    @Test
    fun `a normal answer fetches follow-ups`() {
        assertTrue(fetchesFollowUpsAfter(null))
    }

    @Test
    fun `an additive nudge is a normal answer and fetches follow-ups`() {
        assertTrue(fetchesFollowUpsAfter(AlignmentKind.GENDER_SELECT))
        assertTrue(fetchesFollowUpsAfter(AlignmentKind.COMMODITY_CONFIRM))
    }

    @Test
    fun `an exclusive surface skips follow-ups`() {
        listOf(
            AlignmentKind.CLARIFY, AlignmentKind.CONFIRM, AlignmentKind.ESCALATE,
            AlignmentKind.GPS_PROMPT, AlignmentKind.UPLOAD_PHOTO
        ).forEach { assertFalse(it.name, fetchesFollowUpsAfter(it)) }
    }
}
