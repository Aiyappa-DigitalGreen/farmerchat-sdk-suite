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
}
