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
 * Which surface started the flow. `localContext` is the 2.0.0 chat capability chip
 * ("Share my location" on a `gps-prompt` alignment surface) — the RN counterpart of the Android
 * core's `LocationTriggerSource.LocalContext`, so the chat screen can tell ITS outcome apart
 * from one belonging to Home or Settings.
 */
export type LocationPromptSource = 'weather' | 'widget' | 'localContext';

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
 * Only `location_fetched` is emitted by this package today; the other two are the app's reasons
 * for its post-Settings recovery paths, which the SDK does not port (docs/04). They are listed
 * verbatim from the Android core so the rule stays correct if those paths are added.
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
