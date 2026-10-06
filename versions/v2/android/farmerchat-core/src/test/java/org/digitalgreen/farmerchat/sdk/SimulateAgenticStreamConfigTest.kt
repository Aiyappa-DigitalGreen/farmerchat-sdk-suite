package org.digitalgreen.farmerchat.sdk

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Guards [FarmerChatConfig.simulateAgenticStream]: agentic chat UI over the synchronous #27
 * endpoint, for a backend without #27a. It must default off, bring the composer with it unless
 * the host decides otherwise, and survive `newBuilder()`.
 */
class SimulateAgenticStreamConfigTest {

    private fun builder() = FarmerChatConfig.builder(FarmerChatEnvironment.PROD)

    @Test
    fun `off by default, and the composer still follows agentic chat`() {
        val c = builder().build()
        assertFalse(c.simulateAgenticStream)
        assertFalse(c.resolvedComposerUi)
    }

    @Test
    fun `simulated stream turns the composer on when the host leaves it unset`() {
        assertTrue(builder().simulateAgenticStream(true).build().resolvedComposerUi)
    }

    @Test
    fun `an explicit composer choice still wins`() {
        val c = builder().simulateAgenticStream(true).enableComposerUi(false).build()
        assertFalse(c.resolvedComposerUi)
    }

    @Test
    fun `newBuilder round-trips the flag`() {
        val c = builder().simulateAgenticStream(true).build().newBuilder().build()
        assertTrue(c.simulateAgenticStream)
    }
}
