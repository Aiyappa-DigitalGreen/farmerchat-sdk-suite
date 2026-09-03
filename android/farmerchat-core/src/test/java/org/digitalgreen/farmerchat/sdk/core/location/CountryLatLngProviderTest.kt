package org.digitalgreen.farmerchat.sdk.core.location

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Guards the device-locale location fallback.
 *
 * Background: this SDK used to hardcode Bengaluru (12.9716, 77.5946) as the fallback location, so
 * every guest the backend could not place — anywhere on earth — was seeded with Karnataka and got
 * Karnataka's advice. The app never did that: it derives the country from the device locale and
 * uses that country's centroid, accepting it only when both parts are non-zero.
 *
 * The centroid table is generated verbatim from the app's `utils/CountryLatLngProvider.kt`; a
 * wrong entry fails silently, so the count and a few spot values are asserted here.
 */
class CountryLatLngProviderTest {

    @Test
    fun `a known country returns its exact centroid`() {
        assertEquals(-0.023559 to 37.906193, CountryLatLngProvider.getLatLng("KE"))
        assertEquals(20.593684 to 78.96288, CountryLatLngProvider.getLatLng("IN"))
        assertEquals(9.081999 to 8.675277, CountryLatLngProvider.getLatLng("NG"))
    }

    @Test
    fun `an unknown or blank country returns zero, not a guess`() {
        // The critical one: nothing may silently stand in for an unresolved country.
        assertEquals(0.0 to 0.0, CountryLatLngProvider.getLatLng("ZZ"))
        assertEquals(0.0 to 0.0, CountryLatLngProvider.getLatLng(""))
        assertEquals(0.0 to 0.0, CountryLatLngProvider.getLatLng("in"))  // case-sensitive, as the app
    }

    @Test
    fun `zero coordinates are never treated as resolved`() {
        // (0,0) is a real point in the Gulf of Guinea; sending it would be a wrong answer, not a
        // missing one. isResolved is what stops that.
        assertFalse(CountryLatLngProvider.isResolved(0.0, 0.0))
        assertFalse(CountryLatLngProvider.isResolved(0.0, 37.9))
        assertFalse(CountryLatLngProvider.isResolved(-0.02, 0.0))
        assertTrue(CountryLatLngProvider.isResolved(-0.023559, 37.906193))
    }

    @Test
    fun `Bengaluru is not the fallback for anything`() {
        // The exact regression: no country's centroid may be the old hardcoded default.
        val bengaluru = 12.9716 to 77.5946
        val hits = listOf("IN", "KE", "ZZ", "", "US", "NG").map { CountryLatLngProvider.getLatLng(it) }
        assertFalse(hits.contains(bengaluru))
    }

    @Test
    fun `the table matches the app's entry count`() {
        // Ported verbatim from the app: 247 entries. A drift here means the port was edited by
        // hand instead of regenerated.
        assertEquals(247, CountryLatLngProvider.entryCount)
    }
}
