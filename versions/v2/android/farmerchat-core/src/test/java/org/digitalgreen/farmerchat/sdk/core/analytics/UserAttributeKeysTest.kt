package org.digitalgreen.farmerchat.sdk.core.analytics

import org.digitalgreen.farmerchat.sdk.core.device.DeviceTypeProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Character-for-character guards on the 7 device/carrier USER ATTRIBUTE keys and the values the
 * SDK raises for them.
 *
 * Every literal below is transcribed from the app's
 * `core/analytics/UserAttributeKeys.kt` / `utils/DeviceTypeProvider.kt`
 * (fc-compose-agentic @ 0c8c740f). A typo in an attribute key is invisible at runtime — the
 * host's dashboard just grows a second, empty column that nobody notices for weeks — so these
 * are asserted as literals, never by referencing the constant they check.
 */
class UserAttributeKeysTest {

    @Test
    fun `carrier attribute keys match the app`() {
        assertEquals("Carrier_Name", UserAttributeKeys.CARRIER_NAME)
        assertEquals("Carrier_Code", UserAttributeKeys.CARRIER_CODE)
    }

    @Test
    fun `device attribute keys match the app`() {
        assertEquals("Device_Type", UserAttributeKeys.DEVICE_TYPE)
        assertEquals("Brand", UserAttributeKeys.BRAND)
        assertEquals("Model", UserAttributeKeys.MODEL)
        assertEquals("Manufacturer", UserAttributeKeys.MANUFACTURER)
        assertEquals("OS", UserAttributeKeys.OS)
    }

    /** All 7 keys are distinct — a copy-paste collision would silently overwrite an attribute. */
    @Test
    fun `the seven attribute keys are distinct`() {
        val keys = listOf(
            UserAttributeKeys.CARRIER_NAME,
            UserAttributeKeys.CARRIER_CODE,
            UserAttributeKeys.DEVICE_TYPE,
            UserAttributeKeys.BRAND,
            UserAttributeKeys.MODEL,
            UserAttributeKeys.MANUFACTURER,
            UserAttributeKeys.OS
        )
        assertEquals(7, keys.size)
        assertEquals(7, keys.toSet().size)
    }

    /**
     * The `Device_Type` VALUES. The app's constant is named ACTUAL_DEVICE but its value is
     * "physical_device" — the value is what lands in the dashboard, so it is ported verbatim and
     * must not be "corrected" to match the name.
     */
    @Test
    fun `device type values match the app verbatim`() {
        assertEquals("emulator", DeviceTypeProvider.EMULATOR)
        assertEquals("physical_device", DeviceTypeProvider.ACTUAL_DEVICE)
    }

    /**
     * `UserAttributeKeys.OS` is a KEY ("OS"); `DeviceTypeProvider.OS` is its VALUE ("android").
     * Two different strings that are trivially easy to cross-wire, so both are pinned and the
     * pair asserted unequal.
     */
    @Test
    fun `OS key and OS value are different strings`() {
        assertEquals("OS", UserAttributeKeys.OS)
        assertEquals("android", DeviceTypeProvider.OS)
        assertNotEquals(UserAttributeKeys.OS, DeviceTypeProvider.OS)
    }

    /** No `Build` field is readable in a plain JVM unit test, which is exactly the hardening. */
    @Test
    fun `getDeviceType never throws and returns one of the two documented values`() {
        val type = DeviceTypeProvider.getDeviceType()
        assertTrue(
            "unexpected Device_Type value: $type",
            type == DeviceTypeProvider.EMULATOR || type == DeviceTypeProvider.ACTUAL_DEVICE
        )
    }

    @Test
    fun `brand model and manufacturer degrade to empty rather than throwing`() {
        // Non-null is the contract; the values themselves are device-dependent.
        DeviceTypeProvider.getBrand()
        DeviceTypeProvider.getModel()
        DeviceTypeProvider.getManufacturer()
    }
}
