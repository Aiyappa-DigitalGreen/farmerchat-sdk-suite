package org.digitalgreen.farmerchat.sdk.core.model

import org.digitalgreen.farmerchat.sdk.core.ui.chat.AlignmentChipRoute
import org.digitalgreen.farmerchat.sdk.core.ui.chat.routeAlignmentChip
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Guards the capability-chip routing rule and the exact wire strings behind it.
 *
 * Background: every alignment chip used to send its own text as the question, so the two
 * CAPABILITY surfaces did nothing — `gps-prompt` never started the location flow and
 * `upload-photo` never opened a picker. A capability chip must invoke a capability and send only
 * the OUTCOME; every other chip still sends text.
 *
 * The constants are asserted literally because they are easy to "helpfully" normalize and a
 * mismatch fails silently — the chip would fall through to the text path and the farmer would send
 * the string "share_precise_location" as their question.
 */
class CapabilityChipTest {

    private enum class Route { LOCATION, CAMERA, GALLERY, TEXT, IGNORE }

    /**
     * Calls the REAL routing function the two flavours call. It used to be a local mirror of the
     * `when` inside each screen — which passes while the screens drift from it — so the table was
     * lifted into core (`routeAlignmentChip`) and this collapses onto it.
     */
    private fun route(kind: AlignmentKind?, chip: AlignmentChip): Route =
        when (routeAlignmentChip(kind, chip)) {
            AlignmentChipRoute.ShareLocation -> Route.LOCATION
            AlignmentChipRoute.TakePhoto -> Route.CAMERA
            AlignmentChipRoute.ChooseFromGallery -> Route.GALLERY
            AlignmentChipRoute.Ignore -> Route.IGNORE
            is AlignmentChipRoute.SendText -> Route.TEXT
        }

    /** The two chips the live `gps-prompt` capture actually sends (docs/captures/, 2026-09-03). */
    private val liveShareChip = AlignmentChip(
        label = "Give permission",
        label_key = "gps.button",
        label_en = "Give permission",
        value = "share_precise_location",
        behavior = "invoke_capability",
        capability = "location",
        request = "gps",
        action = "invoke",
        submit = AlignmentChipSubmit(
            kind = "action", surface_type = "gps-prompt", action = "grant",
            data = emptyMap(), requires = "location"
        )
    )

    private val liveDeclineChip = AlignmentChip(
        label = "Continue without location",
        label_key = "gps.dismiss",
        label_en = "Continue without location",
        value = "use_approximate_location",
        behavior = "continue",
        capability = "location",
        request = "use_current",
        action = "continue",
        submit = AlignmentChipSubmit(
            kind = "action", surface_type = "gps-prompt", action = "dismiss", data = emptyMap()
        )
    )

    private fun invoke(value: String) =
        AlignmentChip(label = "l", value = value, action = AlignmentChip.ACTION_SELECT)

    @Test
    fun `wire constants are exactly the app's strings`() {
        // ACTION_SELECT is "invoke", NOT "select"; and the location value is the *precise* one —
        // the app has a `share_location` constant commented out directly above it.
        assertEquals("invoke", AlignmentChip.ACTION_SELECT)
        assertEquals("share_precise_location", AlignmentChip.VALUE_SHARE_LOCATION)
        assertEquals("take_photo", AlignmentChip.VALUE_TAKE_PHOTO)
        assertEquals("choose_from_gallery", AlignmentChip.VALUE_CHOOSE_FROM_GALLERY)
        assertEquals("not_now", AlignmentChip.VALUE_NOT_NOW)
    }

    @Test
    fun `capability chips invoke their capability`() {
        assertEquals(Route.LOCATION, route(AlignmentKind.GPS_PROMPT, invoke("share_precise_location")))
        assertEquals(Route.CAMERA, route(AlignmentKind.UPLOAD_PHOTO, invoke("take_photo")))
        assertEquals(Route.GALLERY, route(AlignmentKind.UPLOAD_PHOTO, invoke("choose_from_gallery")))
    }

    @Test
    fun `a decline chip sends text, it does not invoke anything`() {
        // "Not now" on a capability prompt is an ordinary answer to the blocking question.
        assertEquals(Route.TEXT, route(AlignmentKind.GPS_PROMPT, invoke("not_now")))
        assertEquals(Route.TEXT, route(AlignmentKind.UPLOAD_PHOTO, invoke("not_now")))
    }

    @Test
    fun `action must be invoke for a capability chip to fire`() {
        // A chip carrying the same value but no `invoke` action is a plain text chip.
        val noAction = AlignmentChip(label = "l", value = "share_precise_location", action = null)
        assertEquals(Route.TEXT, route(AlignmentKind.GPS_PROMPT, noAction))
    }

    @Test
    fun `the value must match its own kind`() {
        // take_photo under gps-prompt, or share_location under upload-photo, is not a capability.
        assertEquals(Route.TEXT, route(AlignmentKind.GPS_PROMPT, invoke("take_photo")))
        assertEquals(Route.TEXT, route(AlignmentKind.UPLOAD_PHOTO, invoke("share_precise_location")))
    }

    @Test
    fun `non-capability surfaces always send text`() {
        for (k in listOf(
            AlignmentKind.CLARIFY, AlignmentKind.CONFIRM, AlignmentKind.ESCALATE,
            AlignmentKind.GENDER_SELECT, AlignmentKind.COMMODITY_CONFIRM
        )) {
            assertEquals(Route.TEXT, route(k, invoke("share_precise_location")))
        }
        assertEquals(Route.TEXT, route(null, invoke("take_photo")))
    }

    // ---- the LIVE payload, captured from stage 2026-09-03 (docs/02 §#27a) ------------------

    @Test
    fun `the live share chip invokes the location flow`() {
        assertEquals(Route.LOCATION, route(AlignmentKind.GPS_PROMPT, liveShareChip))
    }

    @Test
    fun `the live decline chip sends text and flags location_declined`() {
        // It is value "use_approximate_location" / behavior "continue" — NOT the app's "not_now"
        // (docs/05). Routing it as an invoke would re-open the permission dialog the farmer just
        // refused; failing to flag the decline leaves the backend waiting for coordinates.
        val route = routeAlignmentChip(AlignmentKind.GPS_PROMPT, liveDeclineChip)
        assertTrue(route is AlignmentChipRoute.SendText)
        route as AlignmentChipRoute.SendText
        assertTrue("the decline must set location_declined", route.locationDeclined)
        assertFalse(route.photoDeclined)
        // The LABEL is sent and shown; the value only marks the chip.
        assertEquals("Continue without location", route.query)
        assertEquals("use_approximate_location", route.selectionValue)
    }

    @Test
    fun `behavior beats action when both are present`() {
        // A chip whose `action` still says "invoke" but whose `behavior` says "continue" is a
        // decline — behavior is the backend's explicit intent.
        val contradictory = liveShareChip.copy(behavior = AlignmentChip.BEHAVIOR_CONTINUE)
        assertEquals(Route.TEXT, route(AlignmentKind.GPS_PROMPT, contradictory))

        // ...and the converse: `behavior: invoke_capability` fires even with no `action`.
        val behaviorOnly = AlignmentChip(
            label = "Share", value = "share_precise_location",
            behavior = AlignmentChip.BEHAVIOR_INVOKE_CAPABILITY, action = null
        )
        assertEquals(Route.LOCATION, route(AlignmentKind.GPS_PROMPT, behaviorOnly))
    }

    @Test
    fun `capability location widens the value match but never selects the invoke path alone`() {
        // A future share chip with an unfamiliar value still reaches the location flow...
        val newValue = AlignmentChip(
            label = "Share", value = "share_gps_now",
            behavior = AlignmentChip.BEHAVIOR_INVOKE_CAPABILITY,
            capability = AlignmentChip.CAPABILITY_LOCATION
        )
        assertEquals(Route.LOCATION, route(AlignmentKind.GPS_PROMPT, newValue))
        // ...but capability alone cannot: BOTH live chips carry capability "location", so keying on
        // it without `behavior` would send the decline chip into the permission dialog.
        assertEquals(AlignmentChip.CAPABILITY_LOCATION, liveDeclineChip.capability)
        assertEquals(Route.TEXT, route(AlignmentKind.GPS_PROMPT, liveDeclineChip))
    }

    @Test
    fun `the richer live chip fields are parsed and preserved`() {
        assertEquals("gps.button", liveShareChip.label_key)
        assertEquals("Give permission", liveShareChip.label_en)
        assertEquals("gps", liveShareChip.request)
        assertEquals("action", liveShareChip.submit?.kind)
        assertEquals("grant", liveShareChip.submit?.action)
        assertEquals("location", liveShareChip.submit?.requires)
        assertEquals("gps-prompt", liveShareChip.submit?.surface_type)
    }

    @Test
    fun `both decline spellings are recognised`() {
        assertEquals("use_approximate_location", AlignmentChip.VALUE_USE_APPROXIMATE_LOCATION)
        assertEquals("invoke_capability", AlignmentChip.BEHAVIOR_INVOKE_CAPABILITY)
        assertEquals("continue", AlignmentChip.BEHAVIOR_CONTINUE)
        assertEquals("location", AlignmentChip.CAPABILITY_LOCATION)
        // The app's `not_now` still declines (commodity-confirm really does send it live).
        val notNow = AlignmentChip(label = "Not now", value = "not_now", action = "decline")
        val route = routeAlignmentChip(AlignmentKind.GPS_PROMPT, notNow)
        assertTrue((route as AlignmentChipRoute.SendText).locationDeclined)
    }

    @Test
    fun `gender select sends the value and shows the label`() {
        val chip = AlignmentChip(label = "Male", value = "male")
        val route = routeAlignmentChip(AlignmentKind.GENDER_SELECT, chip)
        assertTrue(route is AlignmentChipRoute.SendText)
        route as AlignmentChipRoute.SendText
        assertEquals("male", route.query)
        assertEquals("Male", route.displayLabel)
    }

    @Test
    fun `an empty chip is ignored rather than sending a blank query`() {
        assertEquals(Route.IGNORE, route(AlignmentKind.CLARIFY, AlignmentChip()))
        assertEquals(Route.IGNORE, route(AlignmentKind.CLARIFY, AlignmentChip(label = "  ", value = "")))
    }

    @Test
    fun `only the two capability kinds are non-additive prompts that invoke`() {
        // Sanity-check the additive split the surfaces depend on.
        assertFalse(AlignmentKind.GPS_PROMPT.isAdditive)
        assertFalse(AlignmentKind.UPLOAD_PHOTO.isAdditive)
        assertTrue(AlignmentKind.GENDER_SELECT.isAdditive)
        assertTrue(AlignmentKind.COMMODITY_CONFIRM.isAdditive)
    }
}
