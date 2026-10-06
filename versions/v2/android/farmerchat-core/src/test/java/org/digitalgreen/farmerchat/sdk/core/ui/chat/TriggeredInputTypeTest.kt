package org.digitalgreen.farmerchat.sdk.core.ui.chat

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Covers [resolveTriggeredInputType] — what the SDK tells the backend about where a query came
 * from, for every chat entry point that is not the composer.
 *
 * The ORDER is the contract. A single query can satisfy several branches at once (a push
 * notification that is also a weather CTA), and the app resolves the tie by a fixed precedence.
 * Getting the order wrong mislabels traffic in a way nothing crashes on and no one notices.
 *
 * `contentCardTriggerType` was the branch that did not exist at all: an agentic Home content-card
 * tap reached the backend with `triggered_input_type = null`, so `image_card` / `text_card`
 * traffic was invisible.
 */
internal class TriggeredInputTypeTest {

    private fun action(
        isPush: Boolean = false,
        isInApp: Boolean = false,
        isWeatherAdviceCTA: Boolean = false,
        isSSFR: Boolean = false,
        channel: String? = null,
        contentCardTriggerType: String? = null
    ) = ChatAction.InitializeWithQuestion(
        question = "what is wrong with my crop?",
        isWeatherAdviceCTA = isWeatherAdviceCTA,
        isPush = isPush,
        isInApp = isInApp,
        isSSFR = isSSFR,
        channel = channel,
        contentCardTriggerType = contentCardTriggerType
    )

    @Test
    internal fun `a plain question carries no override`() {
        assertNull(resolveTriggeredInputType(action()))
    }

    @Test
    internal fun `each entry point maps to its own value`() {
        assertEquals("push", resolveTriggeredInputType(action(isPush = true)))
        assertEquals("in-app", resolveTriggeredInputType(action(isInApp = true)))
        assertEquals("weather", resolveTriggeredInputType(action(isWeatherAdviceCTA = true)))
        assertEquals("ssfr", resolveTriggeredInputType(action(isSSFR = true)))
        assertEquals("whatsapp", resolveTriggeredInputType(action(channel = "whatsapp")))
    }

    // ---- the branch that was missing ----------------------------------------------------

    @Test
    internal fun `an agentic content-card tap carries its card type`() {
        assertEquals(
            "image_card",
            resolveTriggeredInputType(action(contentCardTriggerType = "image_card"))
        )
        assertEquals(
            "text_card",
            resolveTriggeredInputType(action(contentCardTriggerType = "text_card"))
        )
    }

    @Test
    internal fun `a blank card type is not an override`() {
        assertNull(resolveTriggeredInputType(action(contentCardTriggerType = "")))
    }

    // ---- precedence: the part that is easy to get subtly wrong ---------------------------

    @Test
    internal fun `push outranks everything`() {
        assertEquals(
            "push",
            resolveTriggeredInputType(
                action(
                    isPush = true,
                    isInApp = true,
                    isWeatherAdviceCTA = true,
                    isSSFR = true,
                    channel = "whatsapp",
                    contentCardTriggerType = "image_card"
                )
            )
        )
    }

    @Test
    internal fun `the content card is the lowest-priority override`() {
        // Every other entry point beats it.
        assertEquals("in-app", resolveTriggeredInputType(action(isInApp = true, contentCardTriggerType = "image_card")))
        assertEquals("weather", resolveTriggeredInputType(action(isWeatherAdviceCTA = true, contentCardTriggerType = "image_card")))
        assertEquals("ssfr", resolveTriggeredInputType(action(isSSFR = true, contentCardTriggerType = "image_card")))
        assertEquals("sms", resolveTriggeredInputType(action(channel = "sms", contentCardTriggerType = "image_card")))
    }

    @Test
    internal fun `channel outranks the card but loses to weather`() {
        assertEquals(
            "weather",
            resolveTriggeredInputType(
                action(isWeatherAdviceCTA = true, channel = "sms", contentCardTriggerType = "text_card")
            )
        )
    }
}
