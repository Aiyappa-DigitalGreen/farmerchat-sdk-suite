package org.digitalgreen.farmerchat.sdk.analytics.posthog

/**
 * Translates the app's event and property names into PostHog's convention.
 *
 * A **line-for-line port of iOS** `CompositeAnalytics.swift` › `PostHogNaming`
 * (FarmerChat-iOS-Agentic-v2.3). It has to stay identical: both platforms report into the same
 * PostHog project, so any divergence here shows up as two differently-named events for one user
 * action and silently splits every insight built on them.
 *
 * Everything in this file is **PostHog-only**. The SDK hands every sink the identical
 * Android-cased name, and only this adapter rewrites it — so a host that also forwards events to
 * its own vendor still receives the app's exact strings, and platform parity is untouched.
 *
 * ⚠️ Renaming SPLITS HISTORY. Events sent under the old names cannot be merged with the new ones.
 * The iOS rollout accepted that on 2026-09-09; android joining now lands on the same names.
 */
public object PostHogNaming {

    /**
     * `Screen_Viewed` → `screen_viewed`, `FirstTimeDashboardViewed` → `first_time_dashboard_viewed`,
     * `Date Range` → `date_range`. Deterministic, so an event added later needs no table entry.
     *
     * It also collapses the four case-collision pairs on its own — `Asset_Name`/`asset_name`,
     * `Asset_Type`/`asset_type`, `Concern`/`concern` and `Stage`/`stage` each converge to one
     * name, which is what stops them appearing in PostHog as two separate properties.
     */
    public fun snake(raw: String): String {
        val out = StringBuilder()
        var previous: Char? = null
        for (ch in raw) {
            if (ch == ' ' || ch == '-') {
                out.append('_'); previous = '_'; continue
            }
            // Insert a break only at a lower-to-upper or digit-to-upper boundary, so runs of
            // capitals survive: `API_Call_Success` becomes `api_call_success`, not `a_p_i_...`.
            val p = previous
            if (ch.isUpperCase() && p != null && (p.isLowerCase() || p.isDigit())) {
                out.append('_')
            }
            out.append(ch.lowercaseChar())
            previous = ch
        }
        var result = out.toString()
        while (result.contains("__")) result = result.replace("__", "_")
        return result.trim('_')
    }

    /**
     * The one event the rule gets wrong: `ToS_Aug26_Accept_Terms` has a capital inside a word,
     * so the boundary rule splits "ToS" into `to_s`.
     */
    private val eventOverrides = mapOf("ToS_Aug26_Accept_Terms" to "tos_aug26_accept_terms")

    /**
     * Spelling mistakes carried over from the Kotlin constants. Corrected for PostHog only — the
     * SDK constants keep the typo so android and iOS still agree on the wire.
     */
    private val propertyOverrides = mapOf(
        "langauge_code" to "language_code",          // "language" misspelled
        "isOnnboarding_query" to "is_onboarding_query" // doubled "n"
    )

    /**
     * Values, not keys. Every other screen name ends "Screen"; this one shipped lower-case and
     * would sort and filter separately from its siblings.
     */
    private val valueOverrides = mapOf("Chat History screen" to "Chat History Screen")

    /**
     * Fires alongside an event that already records the same action, so PostHog would count the
     * action twice. Dropped here rather than at the call site, which other sinks still need.
     *  • `Microphone_Click_Event` always fires together with `Chat_Icon_Clicked` (Icon=Voice).
     *  • `Dashboard_Viewed` always fires together with `Screen_Viewed` for the same screen.
     *    `FirstTimeDashboardViewed` is NOT dropped: once-per-install is a different signal.
     */
    public val suppressed: Set<String> = setOf("Microphone_Click_Event", "Dashboard_Viewed")

    /** A [merged] target: one PostHog event name plus the properties that say which input fired. */
    public data class Merge(val event: String, val extra: Map<String, String>)

    /**
     * Two names for one idea. Both become `card_viewed`, keeping WHICH detector fired as a
     * property so nothing is lost: `Card_Shown` is emitted when a card renders, `Card_Viewed`
     * when it is actually scrolled into view.
     */
    public val merged: Map<String, Merge> = mapOf(
        "Card_Shown" to Merge("card_viewed", mapOf("detection" to "rendered")),
        "Card_Viewed" to Merge("card_viewed", mapOf("detection" to "scrolled_into_view"))
    )

    public fun event(name: String): String = eventOverrides[name] ?: snake(name)

    public fun property(key: String): String = propertyOverrides[key] ?: snake(key)

    /**
     * Rewrites a whole property map: keys to snake case, and the handful of known-bad values
     * normalised.
     */
    public fun properties(params: Map<String, Any?>): Map<String, Any?> =
        params.entries.associate { (key, value) ->
            val fixed = (value as? String)?.let { valueOverrides[it] } ?: value
            property(key) to fixed
        }
}
