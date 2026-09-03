package org.digitalgreen.farmerchat.sdk.core.ui.auth

import org.digitalgreen.farmerchat.sdk.core.model.CountryItem
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Guards the app's `isPhoneValid` rules (ui/auth/AuthViewModel.kt:861) — the Ethiopia
 * special case, the `phone_length` gate, the `phone_number_pattern` gate and the
 * unknown-country 6..15 fallback.
 */
public class PhoneValidationTest {

    private fun country(
        code: String,
        dial: String,
        length: Int,
        pattern: String? = null
    ) = CountryItem(
        code = code,
        display_name = code,
        flag = "",
        id = 1,
        name = code,
        phone_country_code = dial,
        phone_length = length,
        phone_number_pattern = pattern
    )

    private val india = country("IN", "+91", 10)
    private val ethiopia = country("ET", "+251", 9)

    // ---- Ethiopia special case -------------------------------------------------

    @Test
    public fun `ethiopia accepts 9 digits starting with 7 or 9`() {
        assertTrue(AuthViewModel.isPhoneValid("+251", "912345678", ethiopia))
        assertTrue(AuthViewModel.isPhoneValid("+251", "712345678", ethiopia))
    }

    @Test
    public fun `ethiopia rejects a wrong leading digit`() {
        assertFalse(AuthViewModel.isPhoneValid("+251", "812345678", ethiopia))
    }

    @Test
    public fun `ethiopia rejects a wrong length`() {
        assertFalse(AuthViewModel.isPhoneValid("+251", "91234567", ethiopia))
        assertFalse(AuthViewModel.isPhoneValid("+251", "9123456789", ethiopia))
    }

    @Test
    public fun `ethiopia rule applies even with no country selected`() {
        assertTrue(AuthViewModel.isPhoneValid("+251", "912345678", null))
    }

    // ---- phone_length gate -----------------------------------------------------

    @Test
    public fun `country phone_length is a hard gate`() {
        assertTrue(AuthViewModel.isPhoneValid("+91", "9876543210", india))
        assertFalse(AuthViewModel.isPhoneValid("+91", "987654321", india))
        assertFalse(AuthViewModel.isPhoneValid("+91", "98765432101", india))
    }

    @Test
    public fun `blank is never valid`() {
        assertFalse(AuthViewModel.isPhoneValid("+91", "", india))
        assertFalse(AuthViewModel.isPhoneValid("+91", "abc", india))
    }

    @Test
    public fun `non-digits are stripped before validating`() {
        assertTrue(AuthViewModel.isPhoneValid("+91", "98765 43210", india))
    }

    // ---- phone_number_pattern gate --------------------------------------------

    @Test
    public fun `pattern must match the local digits`() {
        val patterned = country("KE", "+254", 9, "^[71]\\d{8}$")
        assertTrue(AuthViewModel.isPhoneValid("+254", "712345678", patterned))
        assertFalse(AuthViewModel.isPhoneValid("+254", "312345678", patterned))
    }

    @Test
    public fun `a malformed pattern rejects rather than throwing`() {
        val broken = country("XX", "+1", 10, "([unclosed")
        assertFalse(AuthViewModel.isPhoneValid("+1", "1234567890", broken))
    }

    // ---- unknown-country fallback ----------------------------------------------

    @Test
    public fun `unknown country falls back to 6 to 15 digits`() {
        assertTrue(AuthViewModel.isPhoneValid("+44", "123456", null))
        assertTrue(AuthViewModel.isPhoneValid("+44", "123456789012345", null))
        assertFalse(AuthViewModel.isPhoneValid("+44", "12345", null))
        assertFalse(AuthViewModel.isPhoneValid("+44", "1234567890123456", null))
    }
}
