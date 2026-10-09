package org.digitalgreen.farmerchat.sdk

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * The close (X) button must reach the host (2026-10-09 "close doesn't close" report): the
 * `onExit` hook has to survive `build()` and `newBuilder()`, which is exactly where the web SDK
 * dropped it.
 */
class ExitHookConfigTest {

    private fun builder() = FarmerChatConfig.builder(FarmerChatEnvironment.PROD)

    @Test
    fun `onExit is unset by default`() {
        assertNull(builder().build().hooks.onExit)
    }

    @Test
    fun `onExit is carried into the built config`() {
        var calls = 0
        val c = builder().onExit { calls++ }.build()
        c.hooks.onExit?.invoke()
        assertEquals(1, calls)
    }

    @Test
    fun `newBuilder round-trips onExit`() {
        var calls = 0
        val c = builder().onExit { calls++ }.build().newBuilder().mode(FarmerChatMode.FULL_JOURNEY).build()
        c.hooks.onExit?.invoke()
        assertEquals(1, calls)
    }
}
