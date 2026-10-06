package org.digitalgreen.farmerchat.sdk.core.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Covers [PhoneNumberSplitter] — the SIM-number split that pre-fills the Auth screen.
 *
 * The app does this with libphonenumber; the SDK does it against the dial codes endpoint #5
 * already returned, to avoid a ~1 MB dependency in every host. That trade is only sound if the
 * split is actually correct, and the case that makes it non-trivial is **overlapping dial codes**:
 * `+1` and `+1876` both prefix a Jamaican number and only the longer one is right.
 */
internal class PhoneNumberSplitterTest {

    private val codes = listOf("+91", "+254", "+1", "+1876", "+251", "+255")

    @Test
    internal fun `an E164 number splits on its dial code`() {
        assertEquals("+91" to "9876543210", PhoneNumberSplitter.split("+919876543210", codes))
        assertEquals("+254" to "712345678", PhoneNumberSplitter.split("+254712345678", codes))
    }

    @Test
    internal fun `the LONGEST matching dial code wins`() {
        // Naive first-match would take "+1" and leave "8765550123" against Jamaica's "+1876".
        assertEquals("+1876" to "5550123", PhoneNumberSplitter.split("+18765550123", codes))
        // …and a genuine US number still takes "+1".
        assertEquals("+1" to "4155550123", PhoneNumberSplitter.split("+14155550123", codes))
    }

    @Test
    internal fun `separators in the SIM number are ignored`() {
        assertEquals("+91" to "9876543210", PhoneNumberSplitter.split("+91 98765-43210", codes))
        assertEquals("+254" to "712345678", PhoneNumberSplitter.split(" (+254) 712 345 678 ", codes))
    }

    @Test
    internal fun `a bare national number is not forced into a country`() {
        // No '+' and no dial-code prefix: the caller keeps whatever country the user or GPS chose.
        assertNull(PhoneNumberSplitter.split("9876543210", listOf("+254", "+251")))
    }

    @Test
    internal fun `a country code without a plus still splits`() {
        assertEquals("+91" to "9876543210", PhoneNumberSplitter.split("919876543210", codes))
    }

    @Test
    internal fun `dial codes are accepted with or without a plus`() {
        assertEquals("+91" to "9876543210", PhoneNumberSplitter.split("+919876543210", listOf("91")))
    }

    // ---- refusals: better to leave the field alone than to guess -------------------------

    @Test
    internal fun `an unknown country code does not split`() {
        assertNull(PhoneNumberSplitter.split("+441234567890", listOf("+91", "+254")))
    }

    @Test
    internal fun `a dial code with nothing after it does not split`() {
        assertNull(PhoneNumberSplitter.split("+91", codes))
    }

    @Test
    internal fun `blank and non-numeric input returns null`() {
        assertNull(PhoneNumberSplitter.split("", codes))
        assertNull(PhoneNumberSplitter.split("   ", codes))
        assertNull(PhoneNumberSplitter.split("not a number", codes))
    }

    @Test
    internal fun `an empty dial-code list never splits`() {
        assertNull(PhoneNumberSplitter.split("+919876543210", emptyList()))
    }
}
