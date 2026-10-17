package org.digitalgreen.farmerchat.sdk.views

import org.digitalgreen.farmerchat.sdk.views.internal.util.CardLine.Kind
import org.digitalgreen.farmerchat.sdk.views.internal.util.parseTable
import org.digitalgreen.farmerchat.sdk.views.internal.util.tableCards
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * GFM tables in answers become the app's cards (app components/MarkdownText.kt MarkdownTable):
 * the views flavour used to print the raw pipes (RN-found, 2026-10-17).
 */
class MarkdownTableTest {

    @Test
    fun `a card table becomes one card of label value meaning readings`() {
        val t = parseTable(
            listOf(
                "| Today's Weather (17 Oct) | | |",
                "|---|---|---|",
                "| Temperature | 20-28 °C | Warm during the day. |",
                "| Rain Chance | 70% | Hold off on spraying. |"
            )
        )!!
        val cards = tableCards(t)
        assertEquals(1, cards.size)
        assertEquals(
            listOf(Kind.TITLE, Kind.LABEL, Kind.VALUE, Kind.MEANING, Kind.LABEL, Kind.VALUE, Kind.MEANING),
            cards[0].lines.map { it.kind }
        )
        assertEquals("Today's Weather (17 Oct)", cards[0].lines[0].text)
        assertEquals("70%", cards[0].lines[5].text)
    }

    @Test
    fun `a grid becomes one card per row with header labels`() {
        val t = parseTable(listOf("| Crop | Dose | Timing |", "| :--- | ---: | --- |", "| Maize | 50 kg | Sowing |"))!!
        val card = tableCards(t).single()
        assertEquals(listOf("Maize", "Dose", "50 kg", "Timing", "Sowing"), card.lines.map { it.text })
    }

    @Test
    fun `pipes without a separator row are not a table`() {
        assertNull(parseTable(listOf("| just | text |", "| more | text |")))
    }

    /** Compose MarkdownAnswerCard: a rule after the title and between readings, none after the last. */
    @Test
    fun `answer cards draw a rule after the title and between readings`() {
        val t = parseTable(listOf("| Day | | |", "|---|---|---|", "| A | 1 | x |", "| B | 2 | y |"))!!
        val lines = tableCards(t).single().lines
        assertEquals(listOf(null, 12, null, null, 12, null, null), lines.map { it.ruleAboveAtDp })
        assertEquals(listOf(0, 25, 2, 4, 25, 2, 4), lines.map { it.gapAboveDp })
    }

    /** Compose MarkdownRowCards: one rule after the title only; values in bodySmall. */
    @Test
    fun `row cards draw one rule after the title`() {
        val t = parseTable(listOf("| Crop | Dose | Timing |", "|---|---|---|", "| Maize | 50 kg | Sowing |"))!!
        val lines = tableCards(t).single().lines
        assertEquals(listOf(null, 10, null, null, null), lines.map { it.ruleAboveAtDp })
        assertEquals(listOf(false, false, true, false, true), lines.map { it.small })
    }
}
