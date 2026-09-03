package org.digitalgreen.farmerchat.sdk.core.device

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * The carrier read sits on the splash path and touches telephony over Binder. Telephony may be
 * absent entirely (Wi-Fi-only tablets, some TV/auto builds) and OEM stacks are known to throw
 * from `simState` / `createForSubscriptionId`, so the contract under test is: NEVER throw, return
 * null instead. App `utils/sim/CarrierInfoProvider.kt` @ 0c8c740f (hardening 2fbe0924).
 */
class CarrierInfoProviderTest {

    /** No TelephonyManager at all — `getSystemService` returned null / the cast failed. */
    @Test
    fun `absent telephony yields null instead of throwing`() {
        assertNull(CarrierInfoProvider.read(null))
    }

    /** An OEM stack that throws from simState must not take down onboarding. */
    @Test
    fun `a throwing sim state yields null`() {
        val info = CarrierInfoProvider.readCarrier(
            simReady = { throw SecurityException("telephony unavailable") },
            operatorName = { "Safaricom" },
            operatorCode = { "63902" }
        )
        assertNull(info)
    }

    /** No SIM / eSIM with no profile: the operator reads would be meaningless. */
    @Test
    fun `a sim that is not ready yields null`() {
        val info = CarrierInfoProvider.readCarrier(
            simReady = { false },
            operatorName = { "Safaricom" },
            operatorCode = { "63902" }
        )
        assertNull(info)
    }

    /** A ready SIM whose operator reads throw: null, not a crash. */
    @Test
    fun `throwing operator reads yield null rather than propagating`() {
        val info = CarrierInfoProvider.readCarrier(
            simReady = { true },
            operatorName = { throw IllegalStateException("boom") },
            operatorCode = { throw IllegalStateException("boom") }
        )
        assertNull(info)
    }

    /** A ready SIM that reports nothing usable is null, not an empty CarrierInfo. */
    @Test
    fun `blank operator values yield null`() {
        val info = CarrierInfoProvider.readCarrier(
            simReady = { true },
            operatorName = { "   " },
            operatorCode = { null }
        )
        assertNull(info)
    }

    /** Happy path: trimmed name + MCC+MNC code. */
    @Test
    fun `ready sim returns trimmed name and code`() {
        val info = CarrierInfoProvider.readCarrier(
            simReady = { true },
            operatorName = { " Safaricom " },
            operatorCode = { " 63902 " }
        )
        assertEquals(CarrierInfoProvider.CarrierInfo("Safaricom", "63902"), info)
    }

    /** Half a reading is still worth reporting — the code alone segments cleanly. */
    @Test
    fun `code without name is still returned`() {
        val info = CarrierInfoProvider.readCarrier(
            simReady = { true },
            operatorName = { "" },
            operatorCode = { "63902" }
        )
        assertEquals(CarrierInfoProvider.CarrierInfo("", "63902"), info)
    }
}
