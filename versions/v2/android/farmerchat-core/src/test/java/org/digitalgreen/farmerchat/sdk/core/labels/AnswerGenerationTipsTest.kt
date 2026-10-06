package org.digitalgreen.farmerchat.sdk.core.labels

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Covers [AnswerGenerationTips.discover] — the tips a farmer stares at for the whole answer wait.
 *
 * The point of these cases is that the tip set is a **convention over the label payload**, not a
 * list in the SDK. That makes two things silent-failure-shaped and worth pinning:
 *
 *  - discovery finds a tip only if BOTH halves resolve, so a half-translated tip must disappear
 *    rather than render a card with an empty body;
 *  - the fallback triggers on "nothing discovered", so a regex that stops matching turns into
 *    three hardcoded English tips shown to every farmer in every language — which looks like
 *    working software.
 */
internal class AnswerGenerationTipsTest {

    /** Stand-in for `LabelManager::getLabel` — English default, no host overrides. */
    private val resolve: (String, String) -> String = { _, default -> default }

    private fun tip(name: String, lang: String, title: String, statement: String) = mapOf(
        "fc_v2_app_label_tips_${name}_title_$lang" to title,
        "fc_v2_app_label_tips_${name}_statement_$lang" to statement
    )

    @Test
    fun `discovers a tip pair in the selected language`() {
        val labels = tip("soil", "en", "Soil check", "Test your soil every season")

        val tips = AnswerGenerationTips.discover(labels, "en", resolve)

        assertEquals(listOf(TipData("Soil check", "Test your soil every season")), tips)
    }

    @Test
    fun `prefers the selected language over english for the same tip`() {
        val labels = tip("soil", "en", "Soil check", "Test your soil") +
            tip("soil", "hi", "मिट्टी जाँच", "हर मौसम में मिट्टी जाँचें")

        val tips = AnswerGenerationTips.discover(labels, "hi", resolve)

        assertEquals(listOf(TipData("मिट्टी जाँच", "हर मौसम में मिट्टी जाँचें")), tips)
    }

    @Test
    fun `falls back to english for a tip missing the selected language`() {
        // Discovery scans title keys in ANY language, so an English-only tip is still found
        // for a Hindi farmer — the alternative is a farmer who switches language losing tips.
        val labels = tip("soil", "en", "Soil check", "Test your soil")

        val tips = AnswerGenerationTips.discover(labels, "hi", resolve)

        assertEquals(listOf(TipData("Soil check", "Test your soil")), tips)
    }

    @Test
    fun `drops a tip whose statement half is missing entirely`() {
        val labels = mapOf("fc_v2_app_label_tips_soil_title_en" to "Soil check")

        val tips = AnswerGenerationTips.discover(labels, "en", resolve)

        // No usable dynamic tip -> the built-in three, not a card with an empty body.
        assertEquals(3, tips.size)
        assertTrue(tips.none { it.title == "Soil check" })
    }

    @Test
    fun `drops a tip whose statement is present but blank`() {
        val labels = mapOf(
            "fc_v2_app_label_tips_soil_title_en" to "Soil check",
            "fc_v2_app_label_tips_soil_statement_en" to "   ",
            "fc_v2_app_label_tips_water_title_en" to "Water",
            "fc_v2_app_label_tips_water_statement_en" to "Irrigate at dawn"
        )

        val tips = AnswerGenerationTips.discover(labels, "en", resolve)

        assertEquals(listOf(TipData("Water", "Irrigate at dawn")), tips)
    }

    @Test
    fun `orders tips by name so the carousel is stable across launches`() {
        val labels = tip("zinc", "en", "Zinc", "z") +
            tip("apple", "en", "Apple", "a") +
            tip("mango", "en", "Mango", "m")

        val tips = AnswerGenerationTips.discover(labels, "en", resolve)

        assertEquals(listOf("Apple", "Mango", "Zinc"), tips.map { it.title })
    }

    @Test
    fun `ignores tips labels that are not title statement pairs`() {
        // TIPS_LIST_CANNOT_BE_EMPTY is a real tips-prefixed label that is NOT a tip.
        val labels = mapOf(
            "fc_v2_app_label_tips_list_cannot_be_empty_en" to "Tips list cannot be empty",
            "fc_v2_app_label_ask_your_farming_question_en" to "Ask your farming question"
        )

        val tips = AnswerGenerationTips.discover(labels, "en", resolve)

        assertEquals(3, tips.size)
        assertTrue(tips.none { it.title.contains("cannot be empty") })
    }

    @Test
    fun `empty label payload yields the three built-in tips`() {
        val tips = AnswerGenerationTips.discover(emptyMap(), "en", resolve)

        assertEquals(
            listOf("Did you know?", "Quick tip", "Try this"),
            tips.map { it.title }
        )
        assertEquals(
            listOf(
                "You can ask follow-up questions to get more details",
                "Try asking about specific crops or problems",
                "Upload photos for plant disease identification"
            ),
            tips.map { it.body }
        )
    }

    @Test
    fun `built-in tips resolve through the label manager so host overrides win`() {
        val overriding: (String, String) -> String = { key, default ->
            if (key == Labels.QUICK_TIP) "Host tip" else default
        }

        val tips = AnswerGenerationTips.discover(emptyMap(), "en", overriding)

        assertEquals("Host tip", tips[1].title)
    }

    @Test
    fun `blank language code is treated as english`() {
        val labels = tip("soil", "en", "Soil check", "Test your soil")

        assertEquals(
            AnswerGenerationTips.discover(labels, "en", resolve),
            AnswerGenerationTips.discover(labels, "  ", resolve)
        )
    }
}
