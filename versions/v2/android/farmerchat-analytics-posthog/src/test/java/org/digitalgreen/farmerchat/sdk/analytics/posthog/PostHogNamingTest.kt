package org.digitalgreen.farmerchat.sdk.analytics.posthog

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pins the PostHog name translation to iOS's.
 *
 * Both platforms report into the ONE PostHog project, so these strings are a cross-platform wire
 * contract, not an implementation detail. A divergence here does not fail anything at runtime —
 * it quietly produces two differently-named events for one user action and splits every insight
 * built on them. That is exactly the class of bug a test has to catch.
 *
 * Every expectation below is taken from the iOS source of truth,
 * `FarmerChat-iOS-Agentic-v2.3/FarmerChat/Core/Analytics/CompositeAnalytics.swift` › `PostHogNaming`.
 */
class PostHogNamingTest {

    // ── snake(): the deterministic rule ────────────────────────────────────────────────────

    @Test
    fun `snake lowercases and keeps existing underscores`() {
        assertEquals("screen_viewed", PostHogNaming.snake("Screen_Viewed"))
        assertEquals("app_opened", PostHogNaming.snake("App_Opened"))
    }

    @Test
    fun `snake splits camel case at a lower-to-upper boundary`() {
        assertEquals(
            "first_time_dashboard_viewed",
            PostHogNaming.snake("FirstTimeDashboardViewed")
        )
    }

    @Test
    fun `snake converts spaces and hyphens to underscores`() {
        assertEquals("date_range", PostHogNaming.snake("Date Range"))
        assertEquals("chat_history_screen", PostHogNaming.snake("Chat-History Screen"))
    }

    /**
     * The rule iOS calls out explicitly: a break is inserted only at a lower→upper or
     * digit→upper boundary, so a RUN of capitals survives as one word. Without that,
     * `API_Call_Success` degrades to `a_p_i_call_success`.
     */
    @Test
    fun `snake keeps runs of capitals intact`() {
        assertEquals("api_call_success", PostHogNaming.snake("API_Call_Success"))
        assertEquals("gps_enabled", PostHogNaming.snake("GPS_Enabled"))
    }

    @Test
    fun `snake collapses doubled underscores and trims the edges`() {
        assertEquals("a_b", PostHogNaming.snake("A__B"))
        assertEquals("a_b", PostHogNaming.snake("_A B_"))
        assertEquals("a_b", PostHogNaming.snake("A - B"))
    }

    /**
     * The four case-collision pairs iOS names. Each pair must converge on ONE property name;
     * if they do not, PostHog shows them as two separate properties for the same thing.
     */
    @Test
    fun `snake collapses the four known case-collision pairs`() {
        for ((upper, lower) in listOf(
            "Asset_Name" to "asset_name",
            "Asset_Type" to "asset_type",
            "Concern" to "concern",
            "Stage" to "stage"
        )) {
            assertEquals(
                "both spellings of $upper must converge",
                PostHogNaming.snake(lower),
                PostHogNaming.snake(upper)
            )
        }
    }

    // ── overrides ──────────────────────────────────────────────────────────────────────────

    /** `ToS` has a capital inside a word, so the boundary rule would split it into `to_s`. */
    @Test
    fun `the ToS event is overridden, not snaked`() {
        assertEquals("tos_aug26_accept_terms", PostHogNaming.event("ToS_Aug26_Accept_Terms"))
        assertEquals("to_s_aug26_accept_terms", PostHogNaming.snake("ToS_Aug26_Accept_Terms"))
    }

    /** Typos in the SDK constants are corrected for PostHog only — the wire keeps the typo. */
    @Test
    fun `misspelled property keys are corrected`() {
        assertEquals("language_code", PostHogNaming.property("langauge_code"))
        assertEquals("is_onboarding_query", PostHogNaming.property("isOnnboarding_query"))
    }

    @Test
    fun `an unlisted key falls through to snake`() {
        assertEquals("question_id", PostHogNaming.property("Question_Id"))
    }

    /** A VALUE override, not a key one: the one screen name that shipped lower-case. */
    @Test
    fun `the lowercase screen-name value is normalised`() {
        val out = PostHogNaming.properties(mapOf("screen_name" to "Chat History screen"))
        assertEquals("Chat History Screen", out["screen_name"])
    }

    @Test
    fun `properties snake-cases keys and leaves other values alone`() {
        val out = PostHogNaming.properties(mapOf("Asset_Name" to "Sugarcane", "Count" to 3))
        assertEquals(mapOf("asset_name" to "Sugarcane", "count" to 3), out)
    }

    @Test
    fun `properties preserves a null value for the caller to drop`() {
        val out = PostHogNaming.properties(mapOf("Question_Id" to null))
        assertTrue(out.containsKey("question_id"))
        assertNull(out["question_id"])
    }

    // ── suppression and merging ────────────────────────────────────────────────────────────

    /**
     * Both fire alongside an event that already records the same action, so PostHog would
     * double-count. `FirstTimeDashboardViewed` is deliberately NOT suppressed — once-per-install
     * is a genuinely different signal.
     */
    @Test
    fun `exactly the two double-counting events are suppressed`() {
        assertEquals(
            setOf("Microphone_Click_Event", "Dashboard_Viewed"),
            PostHogNaming.suppressed
        )
        assertTrue("FirstTimeDashboardViewed" !in PostHogNaming.suppressed)
    }

    /**
     * Two names for one idea collapse to `card_viewed`, keeping WHICH detector fired as a
     * property so nothing is lost.
     */
    @Test
    fun `the two card events merge but stay distinguishable`() {
        val shown = PostHogNaming.merged.getValue("Card_Shown")
        val viewed = PostHogNaming.merged.getValue("Card_Viewed")

        assertEquals("card_viewed", shown.event)
        assertEquals("card_viewed", viewed.event)
        assertEquals(mapOf("detection" to "rendered"), shown.extra)
        assertEquals(mapOf("detection" to "scrolled_into_view"), viewed.extra)
    }
}
