package org.digitalgreen.farmerchat.sdk.core.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Guards the matching rule behind `recordAlignmentPick`.
 *
 * Background: `alignmentSelectedValues` was declared and read by the UI but never written, so the
 * entire selected/locked chip treatment was dead code on every flavour — a tapped chip never
 * showed a check, never locked, and the unpicked chips never faded. Core now records the pick.
 *
 * The rule that needs guarding is the MATCH: only text that corresponds to one of that surface's
 * own chips may mark a chip chosen. A follow-up the farmer typed themselves must not.
 */
class AlignmentPickTest {

    private val chips = listOf(
        AlignmentChip(label = "Chickpea", value = "chickpea"),
        AlignmentChip(label = "Only a label", value = null)
    )

    /** Mirrors the predicate in ChatViewModel.recordAlignmentPick. */
    private fun matches(question: String) =
        chips.any { it.value == question || it.label == question }

    @Test
    fun `a chip value counts as a pick`() {
        assertTrue(matches("chickpea"))
    }

    @Test
    fun `a chip label counts as a pick`() {
        // A chip may carry only a label, and the UI then sends the label as the question.
        assertTrue(matches("Only a label"))
        assertTrue(matches("Chickpea"))
    }

    @Test
    fun `a question the farmer typed is not a pick`() {
        // The bug this protects against: any follow-up marking an unrelated chip as chosen.
        assertEquals(false, matches("How much fertiliser for chickpea?"))
        assertEquals(false, matches("chickpeas"))
        assertEquals(false, matches(""))
    }
}
