package org.digitalgreen.farmerchat.sdk.core.analytics

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The host-facing user IDENTITY / ATTRIBUTE surface. `onEvent(name, props)` structurally cannot
 * carry either (docs/04 "Event-boundary gaps"), so these are separate config callbacks — and a
 * callback that is declared but never dispatched is worse than none, hence these tests.
 */
class AnalyticsUserSurfaceTest {

    @Test
    fun `identifyUser reaches the config callback`() {
        val seen = mutableListOf<String>()
        val analytics = FarmerChatAnalytics(configOnUserIdentified = { seen += it })
        analytics.identifyUser("user-42")
        assertEquals(listOf("user-42"), seen)
    }

    /** The app returns early on an empty id; so do we — a blank identity is noise. */
    @Test
    fun `identifyUser drops blank ids and trims`() {
        val seen = mutableListOf<String>()
        val analytics = FarmerChatAnalytics(configOnUserIdentified = { seen += it })
        analytics.identifyUser("")
        analytics.identifyUser("   ")
        analytics.identifyUser("  user-7 ")
        assertEquals(listOf("user-7"), seen)
    }

    @Test
    fun `setUserAttribute reaches the config callback`() {
        val seen = mutableListOf<Pair<String, String>>()
        val analytics = FarmerChatAnalytics(configOnUserAttribute = { k, v -> seen += k to v })
        analytics.setUserAttribute(UserAttributeKeys.CARRIER_NAME, "Safaricom")
        analytics.setUserAttribute(UserAttributeKeys.OS, "android")
        assertEquals(
            listOf("Carrier_Name" to "Safaricom", "OS" to "android"),
            seen
        )
    }

    @Test
    fun `setUserAttribute drops blank keys and values`() {
        val seen = mutableListOf<Pair<String, String>>()
        val analytics = FarmerChatAnalytics(configOnUserAttribute = { k, v -> seen += k to v })
        analytics.setUserAttribute("", "x")
        analytics.setUserAttribute(UserAttributeKeys.BRAND, "")
        assertTrue(seen.isEmpty())
    }

    /** A throwing host callback must never break the session it is describing. */
    @Test
    fun `a throwing host callback is swallowed`() {
        val analytics = FarmerChatAnalytics(
            configOnUserIdentified = { throw RuntimeException("host blew up") },
            configOnUserAttribute = { _, _ -> throw RuntimeException("host blew up") }
        )
        analytics.identifyUser("user-42")
        analytics.setUserAttribute(UserAttributeKeys.MODEL, "Pixel 7")
    }

    /** No host sink configured is the default; both calls must be no-ops, not NPEs. */
    @Test
    fun `no configured sink is a no-op`() {
        val analytics = FarmerChatAnalytics()
        analytics.identifyUser("user-42")
        analytics.setUserAttribute(UserAttributeKeys.DEVICE_TYPE, "emulator")
    }
}
