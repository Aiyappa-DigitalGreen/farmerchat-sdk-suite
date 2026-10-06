package org.digitalgreen.farmerchat.sdk.core.util

/**
 * Splits a SIM line number into (dial code, local number) so the Auth screen can pre-fill both
 * fields.
 *
 * The app uses **libphonenumber** for this. The SDK deliberately does not: a ~1 MB metadata
 * dependency in every host, for one optional pre-fill, is a bad trade when the SDK already holds
 * the authoritative dial codes — endpoint #5 (`api/geography/get_all_countries/`) returns every
 * supported country with its `phone_country_code`, and that list is already loaded on the Auth
 * screen before this runs.
 *
 * Matching is LONGEST-PREFIX-FIRST, which is what makes it correct where a naive split is not:
 * `+1` (US) and `+1876` (Jamaica) both match a Jamaican number, and only the longer one is right.
 *
 * Recorded as a deliberate adaptation in `docs/05-open-questions.md`.
 */
object PhoneNumberSplitter {

    /**
     * @param raw a SIM line number, typically E.164 (`+919876543210`) but not guaranteed.
     * @param dialCodes every known `phone_country_code`, e.g. `["+91", "+254", "+1"]`.
     * @return `(dialCode, localNumber)`, or null when [raw] carries no recognisable country code —
     *   in which case the caller should leave the user's country selection alone rather than guess.
     */
    fun split(raw: String, dialCodes: Collection<String>): Pair<String, String>? {
        val cleaned = raw.trim()
        if (cleaned.isEmpty()) return null

        // Keep a single leading '+', drop every separator the SIM might carry (spaces, dashes,
        // parentheses) so prefix matching sees digits only.
        val hasPlus = cleaned.startsWith("+")
        val digits = cleaned.filter { it.isDigit() }
        if (digits.isEmpty()) return null
        val normalized = if (hasPlus) "+$digits" else digits

        val candidates = dialCodes
            .asSequence()
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .map { if (it.startsWith("+")) it else "+$it" }
            .distinct()
            .sortedByDescending { it.length }

        // A '+' number: the country code is a prefix of it.
        if (hasPlus) {
            val match = candidates.firstOrNull { normalized.startsWith(it) } ?: return null
            val local = normalized.removePrefix(match)
            return if (local.isEmpty()) null else match to local
        }

        // No '+': some SIMs report a bare national number, and some report the country code
        // without the plus. Only treat it as international when a dial code matches AND something
        // is left over — otherwise it is a local number and the country stays as the user set it.
        val match = candidates.firstOrNull { digits.startsWith(it.removePrefix("+")) }
        if (match != null) {
            val local = digits.removePrefix(match.removePrefix("+"))
            if (local.isNotEmpty()) return match to local
        }
        return null
    }
}
