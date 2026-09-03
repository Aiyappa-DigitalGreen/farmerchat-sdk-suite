package org.digitalgreen.farmerchat.sdk.core.ui.location

/** 1:1 port of the app's LocationPromptModels. */

enum class LocationTriggerSource {
    Weather,
    LocalContext,
    Campaign,
    /**
     * 2.0.0: the Settings "My Farm" row. Distinct from [LocalContext] because Settings is an
     * explicit, user-initiated change rather than an in-flow nudge — so it skips the
     * interstitial and reports its own analytics origin.
     */
    Settings
}

data class LocationCampaignConfig(
    val campaignId: String? = null,
    /** Analytics tag: "native" | "plotline" | "moengage" */
    val triggerSource: String? = null,
    val skipInterstitial: Boolean = false,
    val minIntervalMs: Long = 0L,
    val maxShows: Int = Int.MAX_VALUE,
    val allowRetrigger: Boolean = false
)

sealed interface LocationPromptState {
    data object Idle : LocationPromptState

    data class Interstitial(
        val source: LocationTriggerSource,
        val campaign: LocationCampaignConfig? = null
    ) : LocationPromptState

    data class Recovery(
        val source: LocationTriggerSource,
        val campaign: LocationCampaignConfig? = null
    ) : LocationPromptState

    /** Host should launch the Android permission popup. */
    data class RequestPermission(
        val source: LocationTriggerSource,
        val campaign: LocationCampaignConfig? = null
    ) : LocationPromptState

    /** Host should launch the GPS enable resolution popup (SettingsClient). */
    data class RequestEnableGps(
        val source: LocationTriggerSource,
        val campaign: LocationCampaignConfig? = null
    ) : LocationPromptState

    /** Host should fetch GPS location (fused provider / LocationManager). */
    data class FetchingLocation(
        val source: LocationTriggerSource,
        val campaign: LocationCampaignConfig? = null,
        val attempt: Int = 0
    ) : LocationPromptState

    data class Error(
        val type: LocationErrorType,
        val source: LocationTriggerSource,
        val campaign: LocationCampaignConfig? = null,
        val canRetry: Boolean = true
    ) : LocationPromptState
}

enum class LocationErrorType {
    NoNetwork,
    GpsUnavailable,
    LocationFailed
}

/**
 * One-off events emitted by [LocationPromptManager] so feature screens can decide
 * whether to continue the user's original navigation or cancel it.
 */
sealed interface LocationPromptEvent {
    data class Continue(
        val source: LocationTriggerSource,
        val campaign: LocationCampaignConfig? = null,
        val reason: String
    ) : LocationPromptEvent

    data class Cancel(
        val source: LocationTriggerSource,
        val campaign: LocationCampaignConfig? = null
    ) : LocationPromptEvent

    /** Location updated from a campaign source — show toast + refresh home. */
    data class LocationUpdatedFromWidget(
        val campaign: LocationCampaignConfig? = null
    ) : LocationPromptEvent

    companion object {
        /**
         * [Continue.reason] values that mean a usable location was actually obtained.
         *
         * `Continue` alone does NOT mean success — `dismiss()` emits
         * `Continue(reason = "dismissed")` so that a caller armed for the flow always settles,
         * and the weather flow continues navigation without a location. A caller that treats any
         * `Continue` as success would show the chat GPS_PROMPT bubble for a location the farmer
         * never shared.
         */
        // The SDK currently only ever emits "location_fetched"; the other two are the app's
        // reasons for its post-Settings recovery paths, which the SDK does not port (docs/04).
        // They are listed so the rule stays correct if those paths are added.
        val LOCATION_OBTAINED_REASONS = setOf(
            "location_fetched",
            "location_fetched_pending_api",
            "post_settings_preference_exists"
        )
    }
}

/**
 * True when this event ends a location flow WITH a usable location.
 *
 * Kept in core so both flavours share one rule; the duplicate `reason == "location_fetched"`
 * string comparisons they used to carry could drift apart silently.
 */
fun LocationPromptEvent.isLocationObtained(): Boolean =
    this is LocationPromptEvent.Continue &&
        reason in LocationPromptEvent.LOCATION_OBTAINED_REASONS
