package org.digitalgreen.farmerchat.sdk

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Guards the fallback-country chain, which must NEVER return blank.
 *
 * Background: making the location fallback locale-derived meant `defaultCountryCode` had to
 * default to "" ("derive it"). Three call sites still read that field raw — the settings language
 * chooser, the graph's label bootstrap and onboarding — so they would have sent
 * `country_code=` and taken an HTTP 400 (`{"error": "Country code is required"}`, verified live
 * 2026-09-03). They now all go through the resolver tested here.
 */
class FallbackCountryTest {

    private fun config(country: String = "") = FarmerChatConfig.builder(FarmerChatEnvironment.PROD)
        .defaultCountryCode(country)
        .build()

    @Test
    fun `an explicit host country always wins`() {
        assertEquals("NG", config("NG").resolvedFallbackCountryCode(localeRegion = "KE"))
        assertEquals("NG", config("NG").resolvedFallbackCountryCode(localeRegion = ""))
    }

    @Test
    fun `with no host country the device locale is used`() {
        assertEquals("KE", config().resolvedFallbackCountryCode(localeRegion = "KE"))
        assertEquals("IN", config().resolvedFallbackCountryCode(localeRegion = "IN"))
    }

    @Test
    fun `with neither, the last resort is used and it is never blank`() {
        // The actual bug: a blank here is an immediate HTTP 400 on endpoint #2.
        assertEquals(FarmerChatConfig.LAST_RESORT_COUNTRY_CODE, config().resolvedFallbackCountryCode(""))
        assertTrue(config().resolvedFallbackCountryCode("").isNotBlank())
    }

    @Test
    fun `the default config really is unset, so the derivation is reachable`() {
        // If a default ever creeps back in, the locale branch becomes dead code and the SDK
        // silently pins everyone to one region again.
        val c = FarmerChatConfig.builder(FarmerChatEnvironment.PROD).build()
        assertEquals("", c.defaultCountryCode)
        assertEquals("", c.defaultStateCode)
        assertEquals(0.0, c.defaultLatitude, 0.0)
        assertEquals(0.0, c.defaultLongitude, 0.0)
    }
}
