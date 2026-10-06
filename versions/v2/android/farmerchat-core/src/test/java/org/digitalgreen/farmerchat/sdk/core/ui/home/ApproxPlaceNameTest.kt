package org.digitalgreen.farmerchat.sdk.core.ui.home

import org.digitalgreen.farmerchat.sdk.core.model.ProfileUser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Precedence for the location pill's profile-derived place name (`HomeUdf.kt.approxPlaceName`).
 *
 * The precedence is the app's (fc-compose-agentic `HomeViewModel.fetchUserProfile`, `b72ea4da`)
 * and it is user-visible: get it wrong and a farmer in a named district sees their country
 * instead, or — worse, if blank is not treated as absent — an empty pill that reads as broken.
 */
class ApproxPlaceNameTest {

    private fun profile(
        level3: String? = null,
        level2Name: String? = null,
        countryName: String? = null
    ) = ProfileUser(
        geography_level3 = level3,
        geography_level2_name = level2Name,
        country_name = countryName
    )

    @Test
    fun `district wins when everything is present`() {
        assertEquals(
            "Bagalkot",
            profile(
                level3 = "Bagalkot",
                level2Name = "Karnataka",
                countryName = "India"
            ).approxPlaceName()
        )
    }

    @Test
    fun `falls through to state when the district is missing`() {
        assertEquals(
            "Karnataka",
            profile(level2Name = "Karnataka", countryName = "India").approxPlaceName()
        )
    }

    @Test
    fun `falls through to country when only it is present`() {
        assertEquals("India", profile(countryName = "India").approxPlaceName())
    }

    @Test
    fun `an empty profile yields null rather than an empty string`() {
        // The caller returns early on null; an empty string would be written to prefs and render
        // as a name-less pill.
        assertNull(profile().approxPlaceName())
    }

    @Test
    fun `blank is treated as absent at every level, not just null`() {
        // The API returns "" for unset geography as often as it omits the key. Falling through on
        // "" is what stops the pill rendering an empty name.
        assertEquals(
            "Karnataka",
            profile(level3 = "", level2Name = "Karnataka", countryName = "India").approxPlaceName()
        )
        assertEquals(
            "India",
            profile(level3 = "   ", level2Name = "", countryName = "India").approxPlaceName()
        )
        assertNull(profile(level3 = "", level2Name = "  ", countryName = "").approxPlaceName())
    }
}
