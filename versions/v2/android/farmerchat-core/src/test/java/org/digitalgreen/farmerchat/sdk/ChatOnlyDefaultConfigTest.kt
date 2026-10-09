package org.digitalgreen.farmerchat.sdk

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Guards the 2026-10-09 defaults: CHAT_ONLY is the default mode, `showDrawer` and `showHistory` are
 * unset by default and resolve to `mode == FULL_JOURNEY` (an explicit host value wins and survives
 * `newBuilder()`),
 * and the API-key overrides are optional (null unless the host sets one).
 */
class ChatOnlyDefaultConfigTest {

    private fun builder() = FarmerChatConfig.builder(FarmerChatEnvironment.PROD)

    @Test
    fun `defaults to CHAT_ONLY with no drawer and no history`() {
        val c = builder().build()
        assertEquals(FarmerChatMode.CHAT_ONLY, c.mode)
        assertFalse(c.showDrawer)
        assertFalse(c.showHistory)
        assertTrue(c.showSettings)
    }

    @Test
    fun `FULL_JOURNEY opts back in to the drawer`() {
        assertTrue(builder().mode(FarmerChatMode.FULL_JOURNEY).build().showDrawer)
    }

    @Test
    fun `an explicit showDrawer wins in either mode`() {
        assertTrue(builder().showDrawer(true).build().showDrawer)
        assertFalse(builder().mode(FarmerChatMode.FULL_JOURNEY).showDrawer(false).build().showDrawer)
    }

    @Test
    fun `newBuilder keeps showDrawer unset so a mode change still resolves it`() {
        val chatOnly = builder().build()
        assertTrue(chatOnly.newBuilder().mode(FarmerChatMode.FULL_JOURNEY).build().showDrawer)
    }

    @Test
    fun `newBuilder round-trips an explicit showDrawer`() {
        val c = builder().showDrawer(true).build().newBuilder().build()
        assertTrue(c.showDrawer)
    }

    @Test
    fun `showHistory unset resolves from mode and an explicit value wins`() {
        assertFalse(builder().mode(FarmerChatMode.CHAT_ONLY).build().showHistory)
        assertTrue(builder().mode(FarmerChatMode.FULL_JOURNEY).build().showHistory)
        assertTrue(builder().mode(FarmerChatMode.CHAT_ONLY).showHistory(true).build().showHistory)
        assertFalse(builder().mode(FarmerChatMode.FULL_JOURNEY).showHistory(false).build().showHistory)
    }

    @Test
    fun `newBuilder keeps showHistory unset and round-trips an explicit value`() {
        assertTrue(builder().build().newBuilder().mode(FarmerChatMode.FULL_JOURNEY).build().showHistory)
        assertTrue(builder().showHistory(true).build().newBuilder().build().showHistory)
    }

    @Test
    fun `API keys are optional overrides that round-trip`() {
        val plain = builder().build()
        assertNull(plain.farmerChatApiKey)
        assertNull(plain.geoApiKey)
        val c = builder().farmerChatApiKey("k1").geoApiKey("k2").build().newBuilder().build()
        assertEquals("k1", c.farmerChatApiKey)
        assertEquals("k2", c.geoApiKey)
    }
}
