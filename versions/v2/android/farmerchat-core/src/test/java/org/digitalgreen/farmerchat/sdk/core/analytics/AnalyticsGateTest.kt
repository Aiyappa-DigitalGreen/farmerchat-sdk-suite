package org.digitalgreen.farmerchat.sdk.core.analytics

import org.digitalgreen.farmerchat.sdk.FarmerChatAnalyticsListener
import org.digitalgreen.farmerchat.sdk.FarmerChatHooks
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Covers `FarmerChatConfig.enableAnalytics` — the telemetry master switch, default **false**.
 *
 * The contract has two halves, and the second is the one that is easy to get wrong:
 *
 *  1. While the gate is closed, NOTHING reaches the host's analytics sinks — not events, not
 *     user identity, not user attributes.
 *  2. The C4 semantic hooks are NOT telemetry and must keep firing regardless. They are product
 *     callbacks a host wired for behaviour (`onChatOpened`, `onMessageSent`, `onAnswerReceived`,
 *     `onScreenView`, `onError`); silencing them along with analytics would be a functional
 *     regression dressed up as a privacy setting.
 */
internal class AnalyticsGateTest {

    private fun hooks(
        screens: MutableList<String>,
        chatOpened: MutableList<Unit>
    ) = FarmerChatHooks(
        onChatOpened = { chatOpened += Unit },
        onMessageSent = null,
        onAnswerReceived = null,
        onScreenView = { screens += it },
        onError = null,
        onSessionStart = null
    )

    // ---- gate closed (the default) -------------------------------------------------------

    @Test
    internal fun `events do not reach the host by default`() {
        val events = mutableListOf<String>()
        val analytics = FarmerChatAnalytics(configOnEvent = { name, _ -> events += name })
        analytics.track(AnalyticsEvents.SEND_QUERY_INITIATED, mapOf("a" to 1))
        analytics.trackScreenView(AnalyticsScreens.CHAT)
        assertTrue("no telemetry may leave the SDK while the gate is closed", events.isEmpty())
    }

    @Test
    internal fun `identity and attributes do not reach the host by default`() {
        val ids = mutableListOf<String>()
        val attrs = mutableListOf<Pair<String, String>>()
        val analytics = FarmerChatAnalytics(
            configOnUserIdentified = { ids += it },
            configOnUserAttribute = { k, v -> attrs += k to v }
        )
        analytics.identifyUser("user-42")
        analytics.setUserAttribute(UserAttributeKeys.MODEL, "Pixel 7")
        assertTrue(ids.isEmpty())
        assertTrue(attrs.isEmpty())
    }

    @Test
    internal fun `the listener sink is gated too, not just the config callback`() {
        val seen = mutableListOf<String>()
        val analytics = FarmerChatAnalytics()
        analytics.listener = FarmerChatAnalyticsListener { name, _ -> seen += name }
        analytics.track(AnalyticsEvents.SEND_QUERY_INITIATED)
        assertTrue(seen.isEmpty())
    }

    // ---- the half that must survive the gate ----------------------------------------------

    @Test
    internal fun `semantic hooks still fire while telemetry is off`() {
        val screens = mutableListOf<String>()
        val chatOpened = mutableListOf<Unit>()
        val events = mutableListOf<String>()
        val analytics = FarmerChatAnalytics(
            configOnEvent = { name, _ -> events += name },
            hooks = hooks(screens, chatOpened)
        )
        analytics.trackScreenView(AnalyticsScreens.CHAT)

        assertTrue("telemetry stays off", events.isEmpty())
        assertEquals("the host's onScreenView hook is behaviour, not telemetry", 1, screens.size)
        assertEquals(AnalyticsScreens.CHAT, screens.first())
        assertEquals("onChatOpened must still fire", 1, chatOpened.size)
    }

    // ---- gate open ------------------------------------------------------------------------

    @Test
    internal fun `enabling the gate restores every sink`() {
        val events = mutableListOf<String>()
        val ids = mutableListOf<String>()
        val attrs = mutableListOf<Pair<String, String>>()
        val analytics = FarmerChatAnalytics(
            configOnEvent = { name, _ -> events += name },
            configOnUserIdentified = { ids += it },
            configOnUserAttribute = { k, v -> attrs += k to v },
            enabled = true
        )
        analytics.track(AnalyticsEvents.SEND_QUERY_INITIATED)
        analytics.identifyUser("user-42")
        analytics.setUserAttribute(UserAttributeKeys.MODEL, "Pixel 7")

        assertEquals(listOf(AnalyticsEvents.SEND_QUERY_INITIATED), events)
        assertEquals(listOf("user-42"), ids)
        assertEquals(1, attrs.size)
    }
}
