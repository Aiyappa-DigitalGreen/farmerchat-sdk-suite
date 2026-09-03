package org.digitalgreen.farmerchat.sdk.core.ui.location

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Guards the "did we actually get a location?" rule.
 *
 * Background: the chat GPS_PROMPT flow arms itself on a chip tap and waits for a terminal event.
 * Two bugs lived here:
 *
 *  1. `dismiss()` emitted nothing at all, so the error branch (`onLocationFetchFailed` /
 *     `onNoNetwork` / `onGpsEnableResult(false)` all park in `State.Error`, and dismiss is the
 *     only way out) left the chat armed forever and the farmer's blocking question unanswered.
 *     `dismiss()` now emits `Continue(reason = "dismissed")`.
 *  2. That fix creates the opposite trap: `Continue` no longer implies success. Treating any
 *     `Continue` as success would show a location bubble for a location that was never shared.
 */
class LocationOutcomeTest {

    private fun cont(reason: String) = LocationPromptEvent.Continue(
        source = LocationTriggerSource.LocalContext,
        reason = reason
    )

    @Test
    fun `a fetched location is obtained`() {
        assertTrue(cont("location_fetched").isLocationObtained())
    }

    @Test
    fun `a dismissed flow is NOT obtained`() {
        // The whole point of the dismiss emission: it settles the caller WITHOUT claiming success.
        assertFalse(cont("dismissed").isLocationObtained())
    }

    @Test
    fun `continuing without location is NOT obtained`() {
        assertFalse(cont("continue_without_location").isLocationObtained())
        assertFalse(cont("").isLocationObtained())
        assertFalse(cont("LOCATION_FETCHED").isLocationObtained())
    }

    @Test
    fun `cancel and widget updates are not a location-obtained outcome`() {
        assertFalse(
            LocationPromptEvent.Cancel(source = LocationTriggerSource.LocalContext)
                .isLocationObtained()
        )
        // A widget update refreshes Home; it is not an answer to an armed chat request.
        assertFalse(LocationPromptEvent.LocationUpdatedFromWidget().isLocationObtained())
    }

    @Test
    fun `the reason set is exactly the app's three`() {
        assertTrue(
            LocationPromptEvent.LOCATION_OBTAINED_REASONS == setOf(
                "location_fetched",
                "location_fetched_pending_api",
                "post_settings_preference_exists"
            )
        )
    }
}
