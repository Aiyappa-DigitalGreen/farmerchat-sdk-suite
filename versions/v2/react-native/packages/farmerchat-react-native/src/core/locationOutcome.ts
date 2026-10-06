/**
 * Location-flow outcome vocabulary — port of the Android core's `LocationPromptModels.kt`
 * (the event union + `isLocationObtained`).
 *
 * Kept OUT of `state/useLocationPrompt.ts` on purpose: that module imports `expo-location` and
 * React, so the rule below could not be exercised without a device or a renderer. Here it is a
 * pure function over plain data, shared by the state machine that emits the events and by every
 * screen that listens for them, so the two cannot drift apart.
 */

/**
 * Which surface started the flow — the Android core's `LocationTriggerSource`:
 *  - `weather`      → `Weather` (Home weather chip; the ONLY entry that shows the interstitial)
 *  - `widget`       → `Campaign` (home-feed `enable_location` card / campaign widget)
 *  - `localContext` → `LocalContext` (Home location pill, and the 2.0.0 chat `gps-prompt`
 *                     "Share my location" chip)
 *  - `settings`     → `Settings` (Settings "My Farm" Location row)
 */
export type LocationPromptSource = 'weather' | 'widget' | 'localContext' | 'settings';

export type LocationPromptEvent =
  | { kind: 'LocationUpdatedFromWidget' }
  | { kind: 'LocationReady' }
  /**
   * Terminal success-shaped event for EVERY source (Android core
   * `LocationPromptEvent.Continue`). **`Continue` does NOT by itself mean a location was
   * obtained** — see {@link isLocationObtained}.
   */
  | { kind: 'Continue'; source: LocationPromptSource | null; reason: string }
  /**
   * Terminal decline / cancel / dismissed-failure for every source (Android core
   * `LocationPromptEvent.Cancel`). A listener armed on a capability chip answers the blocking
   * question with the decline text when this arrives.
   */
  | { kind: 'Cancel'; source: LocationPromptSource | null };

/**
 * `Continue.reason` values that mean a usable location was actually obtained.
 *
 * `Continue` alone does NOT mean success: the Android core's `dismiss()` emits
 * `Continue(reason = "dismissed")` so that a caller armed for the flow always settles (the error
 * branch has no other exit), and the weather flow continues navigation without a location. A
 * caller that treated any `Continue` as success would show the chat `gps-prompt` location bubble
 * for a location the farmer never shared.
 *
 * This package emits `location_fetched` and `post_settings_preference_exists` (permission granted
 * from system Settings while the Recovery sheet was up, with a fix already stored).
 * `location_fetched_pending_api` is listed verbatim from the Android core so the rule stays
 * correct if that path is added.
 *
 * Every other `Continue.reason` the state machine emits is a NON-success: `permission_denied`,
 * `skip`, `recovery_closed`, `recovery_dismissed`, `gps_disabled_no_thanks`,
 * `location_failed_fallback`, `dismissed`.
 */
export const LOCATION_OBTAINED_REASONS: readonly string[] = [
  'location_fetched',
  'location_fetched_pending_api',
  'post_settings_preference_exists',
];

/**
 * True when this event ends a location flow WITH a usable location.
 *
 * The one rule every armed caller uses, instead of the inline `reason === 'location_fetched'`
 * comparisons that could drift apart silently (the Android flavours had exactly that, and it is
 * why this moved into core there too).
 */
export function isLocationObtained(event: LocationPromptEvent): boolean {
  return event.kind === 'Continue' && LOCATION_OBTAINED_REASONS.includes(event.reason);
}

/**
 * True when this event ENDS an armed request, whatever the outcome. Every terminal exit must be
 * one of these, or a caller armed for the flow waits forever — the bug the Android core's
 * `dismiss()` emission fixed.
 */
export function isTerminalLocationOutcome(
  event: LocationPromptEvent,
): event is Extract<LocationPromptEvent, { kind: 'Continue' } | { kind: 'Cancel' }> {
  return event.kind === 'Continue' || event.kind === 'Cancel';
}
