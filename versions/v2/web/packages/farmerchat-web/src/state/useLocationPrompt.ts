/**
 * LocationPromptManager port (docs/01 §3.15), simplified for web with
 * navigator.geolocation while keeping the same state machine states:
 * Idle → Interstitial → RequestPermission → FetchingLocation → Recovery/Error.
 * (RequestEnableGps has no browser equivalent — permission covers it; a
 * blocked permission maps to Recovery.)
 */

import { useCallback, useRef, useState } from 'react';
import type { SdkServices } from '../core/services';
import { PrefKeys } from '../core/storage';
import { Events } from '../core/analytics';

export type LocationPromptStateKind =
  | 'Idle'
  | 'Interstitial'
  | 'RequestPermission'
  | 'RequestEnableGps'
  | 'FetchingLocation'
  | 'Recovery'
  | 'Error';

export type LocationErrorType = 'NoNetwork' | 'GpsUnavailable' | 'LocationFailed';

/**
 * Which surface started the flow. `'chat'` is the 2.0.0 GPS_PROMPT capability chip — Kotlin's
 * `LocationTriggerSource.LocalContext` (`core/ui/location/LocationPromptModels.kt`). It behaves
 * like `'widget'` in the overlay: interstitial and permission are shown, the fetch is silent.
 */
export type LocationTriggerSource = 'weather' | 'widget' | 'chat';

export interface LocationPromptState {
  kind: LocationPromptStateKind;
  errorType: LocationErrorType | null;
  /** Weather flow keeps the interstitial overlay during permission/fetch. */
  source: LocationTriggerSource | null;
}

/**
 * How a location flow ended, handed to the callback {@link LocationPromptActions.triggerFromLocalContext}
 * armed with. Port of Kotlin's `LocationPromptEvent.Continue` / `.Cancel`
 * (`core/ui/location/LocationPromptModels.kt`), narrowed to the one caller that needs it.
 *
 * Success is `kind: 'continue'` with `reason === 'location_fetched'` — the same string the Kotlin
 * emits and the same string chat checks for. Everything else (denied, cancelled, fetch failed) is
 * a decline.
 */
export interface LocationOutcome {
  kind: 'continue' | 'cancel';
  /** Kotlin `LocationPromptEvent.Continue.reason`. Null on a cancel. */
  reason: string | null;
}

const IDLE: LocationPromptState = { kind: 'Idle', errorType: null, source: null };

export interface LocationPromptActions {
  /** Weather CTA → interstitial (or straight through when location is known). */
  triggerFromWeather: (onLocationReady: () => void) => void;
  /**
   * 2.0.0: the chat GPS_PROMPT "Share my location" chip (Kotlin
   * `LocationPromptManager.triggerFromLocalContext`). Straight to the interstitial — deliberately
   * WITHOUT the `hasKnownLocation()` short-circuit `triggerFromWeather` has, because the chip is
   * asking for a fresh fix, not for whatever is in prefs.
   *
   * [onOutcome] is armed for exactly this flow and fires once, on the terminal event; a flow
   * started from Home or Settings never reaches it. No-op while another location flow is running
   * (mirrors the Compose guard `state.value is LocationPromptState.Idle`), so the caller must not
   * assume it was armed.
   */
  triggerFromLocalContext: (onOutcome: (outcome: LocationOutcome) => void) => void;
  /** Drops an armed {@link triggerFromLocalContext} callback (e.g. the chat screen unmounted). */
  cancelPendingOutcome: () => void;
  shareLocation: () => Promise<void>;
  skip: () => void;
  dismissError: () => void;
  retry: () => Promise<void>;
  hasKnownLocation: () => boolean;
}

const GEO_TIMEOUT_MS = 10_000;

export function useLocationPrompt(services: SdkServices): [LocationPromptState, LocationPromptActions] {
  const [state, setState] = useState<LocationPromptState>(IDLE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const pendingNavigationRef = useRef<(() => void) | null>(null);
  /**
   * Callback armed by {@link LocationPromptActions.triggerFromLocalContext}, consumed by the first
   * terminal event. Held in a ref (not state) so `retry()` — which re-enters `shareLocation` —
   * cannot lose it, and so a re-render of the arming screen cannot re-arm it.
   */
  const pendingOutcomeRef = useRef<((outcome: LocationOutcome) => void) | null>(null);

  /** Fires the armed callback exactly once, and disarms. */
  const settleOutcome = useCallback((outcome: LocationOutcome) => {
    const pending = pendingOutcomeRef.current;
    pendingOutcomeRef.current = null;
    pending?.(outcome);
  }, []);
  const { api, session, store, analytics } = services;

  const hasKnownLocation = useCallback((): boolean => {
    return (
      store.getString(PrefKeys.FARMER_APP_LATITUDE) !== null &&
      store.getString(PrefKeys.FARMER_APP_LONGITUDE) !== null
    );
  }, [store]);

  const triggerFromWeather = useCallback(
    (onLocationReady: () => void) => {
      // A weather flow owns the machine from here; an outcome it produces belongs to Home, not to
      // a chat surface, so anything armed is dropped rather than fired against the wrong source.
      pendingOutcomeRef.current = null;
      if (hasKnownLocation()) {
        onLocationReady();
        return;
      }
      pendingNavigationRef.current = onLocationReady;
      analytics.track(Events.GPS_FLOW_STEP, { step: 'interstitial_shown', source: 'weather' });
      setState({ kind: 'Interstitial', errorType: null, source: 'weather' });
    },
    [analytics, hasKnownLocation],
  );

  const triggerFromLocalContext = useCallback<LocationPromptActions['triggerFromLocalContext']>(
    (onOutcome) => {
      // Only start when no other location flow is in progress (Compose: the `Idle` guard in
      // `handleAlignmentChip`). Read through the ref: the tap handler may hold a stale render.
      if (stateRef.current.kind !== 'Idle') return;
      pendingOutcomeRef.current = onOutcome;
      pendingNavigationRef.current = null;
      setState({ kind: 'Interstitial', errorType: null, source: 'chat' });
    },
    [],
  );

  const cancelPendingOutcome = useCallback(() => {
    pendingOutcomeRef.current = null;
  }, []);

  const getPosition = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject(new Error('unsupported'));
        return;
      }
      // Fresh fix (10 s) → last-known fallback (maximumAge) mirrors the app's
      // fresh-fetch-then-last-known strategy.
      navigator.geolocation.getCurrentPosition(
        resolve,
        () => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 2_000,
            maximumAge: 600_000,
          });
        },
        { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: 0 },
      );
    });
  }, []);

  const shareLocation = useCallback(async () => {
    setState((s) => ({ kind: 'RequestPermission', errorType: null, source: s.source }));
    analytics.track(Events.LOCATION_PERMISSION_PROMPT_TRIGGERED, {});
    let position: GeolocationPosition;
    try {
      setState((s) => ({ kind: 'FetchingLocation', errorType: null, source: s.source }));
      position = await getPosition();
    } catch (err) {
      const geoErr = typeof GeolocationPositionError !== 'undefined' && err instanceof GeolocationPositionError ? err : null;
      if (geoErr && geoErr.code === geoErr.PERMISSION_DENIED) {
        analytics.track(Events.LOCATION_PERMISSION_DENY, {});
        // Blocked permission → Recovery bottom sheet ("Turn on in settings").
        setState((s) => ({ kind: 'Recovery', errorType: null, source: s.source }));
      } else {
        const isTimeout = geoErr !== null && geoErr.code === geoErr.TIMEOUT;
        analytics.track(isTimeout ? Events.LOCATION_FETCH_FAILED_TIMEOUT : Events.LOCATION_FETCH_FAILED, {});
        const unsupported = err instanceof Error && err.message === 'unsupported';
        setState((s) => ({
          kind: 'Error',
          errorType: unsupported ? 'GpsUnavailable' : 'LocationFailed',
          source: s.source,
        }));
      }
      return;
    }

    analytics.track(Events.LOCATION_PERMISSION_ALLOW, {});
    const { latitude, longitude } = position.coords;
    store.setString(PrefKeys.FARMER_APP_LATITUDE, String(latitude));
    store.setString(PrefKeys.FARMER_APP_LONGITUDE, String(longitude));
    analytics.track(Events.LOCATION_FETCH_SUCCESS, { lat: latitude, lng: longitude });

    // Logged-in users sync to the server; guests save locally only (docs/01 §3.15).
    if (session.isAuthenticated()) {
      const res = await api.updateUserLocation({ lat: latitude, long: longitude, user_id: session.userId ?? '' });
      if (res.ok) {
        if (res.data.country) store.setString(PrefKeys.USER_COUNTRY_NAME, res.data.country);
        if (res.data.state) store.setString(PrefKeys.USER_STATE, res.data.state);
        if (res.data.district) store.setString(PrefKeys.USER_DISTRICT, res.data.district);
        store.setBool(PrefKeys.GPS_LOCATION_SHARED, true);
      } else if (res.isNetworkError || res.isTimeout) {
        setState((s) => ({ kind: 'Error', errorType: 'NoNetwork', source: s.source }));
        return;
      }
    } else {
      store.setBool(PrefKeys.GPS_LOCATION_SHARED, true);
    }

    setState(IDLE);
    // Kotlin emits `Continue(source, reason = "location_fetched")` here; the reason string is what
    // the chat surface tests for, so it travels verbatim.
    settleOutcome({ kind: 'continue', reason: 'location_fetched' });
    const pending = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    pending?.();
  }, [analytics, api, getPosition, session, settleOutcome, store]);

  const skip = useCallback(() => {
    analytics.track(Events.GPS_FLOW_STEP, { step: 'interstitial_skipped' });
    pendingNavigationRef.current = null;
    setState(IDLE);
    // Kotlin `onSkipClicked` → `LocationPromptEvent.Cancel`.
    settleOutcome({ kind: 'cancel', reason: null });
  }, [analytics, settleOutcome]);

  const dismissError = useCallback(() => {
    pendingNavigationRef.current = null;
    setState(IDLE);
    // Recovery / Error dismissed. Kotlin's `dismiss()` emits nothing here, which leaves a chat
    // surface armed forever; web settles it as a cancel so the blocking question always gets an
    // answer (recorded in docs/04).
    settleOutcome({ kind: 'cancel', reason: null });
  }, [settleOutcome]);

  const retry = useCallback(async () => {
    await shareLocation();
  }, [shareLocation]);

  return [
    state,
    {
      triggerFromWeather,
      triggerFromLocalContext,
      cancelPendingOutcome,
      shareLocation,
      skip,
      dismissError,
      retry,
      hasKnownLocation,
    },
  ];
}
