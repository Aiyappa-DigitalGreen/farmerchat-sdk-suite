/**
 * useLocationPrompt — port of `LocationPromptManager` + `LocationPromptHost`
 * state machine (docs/01 §3.15): Idle → Interstitial → RequestPermission →
 * RequestEnableGps → FetchingLocation → Recovery / Error.
 *
 * Fresh location fetch (10 s, 1 retry) → last-known fallback (2 s).
 * Logged-in users call update_user_location (endpoint #11); guests save
 * locally only. Emits LocationUpdatedFromWidget for the campaign source.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { AnalyticsEvents } from '../core/analytics';
import type {
  LocationPromptEvent,
  LocationPromptSource,
} from '../core/locationOutcome';
import type { FarmerChatSdk } from '../core/sdk';
import { StorageKeys } from '../core/sessionStore';

export type LocationErrorType = 'NoNetwork' | 'GpsUnavailable' | 'LocationFailed';

export type LocationPromptState =
  | { kind: 'Idle' }
  | { kind: 'Interstitial' }
  | { kind: 'RequestPermission' }
  | { kind: 'RequestEnableGps' }
  | { kind: 'FetchingLocation' }
  | { kind: 'Recovery' }
  | { kind: 'Error'; errorType: LocationErrorType };

/**
 * The trigger sources and the terminal event vocabulary live in `core/locationOutcome.ts` — a
 * module with no runtime imports — so the "did we actually get a location?" rule can be
 * exercised without React or `expo-location`. Re-exported here because every existing importer
 * reads them from this module (Android's equivalent split: `LocationPromptModels.kt` vs
 * `LocationPromptManager.kt`).
 */
export type {
  LocationPromptEvent,
  LocationPromptSource,
} from '../core/locationOutcome';

export interface UseLocationPromptResult {
  state: LocationPromptState;
  source: LocationPromptSource | null;
  /** Weather CTA flow — keeps the interstitial overlay during fetch. */
  triggerFromWeather: (onLocationReady: () => void) => void;
  /** Campaign/widget flow — silent (no interstitial during fetch). */
  triggerFromWidget: () => void;
  /**
   * 2.0.0 chat capability chip flow (Android core `triggerFromLocalContext`). Goes through the
   * interstitial like the weather flow — the farmer asked a question, they did not ask for a
   * permission dialog — and raises a terminal `Continue` / `Cancel` carrying this source.
   */
  triggerFromLocalContext: () => void;
  shareLocation: () => void;
  skip: () => void;
  dismissError: () => void;
  retryFromRecovery: () => void;
  /** Host screens listen for widget-driven refreshes / weather continuations. */
  addEventListener: (listener: (event: LocationPromptEvent) => void) => () => void;
  hasKnownLocation: () => boolean;
}

const FRESH_LOCATION_TIMEOUT_MS = 10_000;
const LAST_KNOWN_TIMEOUT_MS = 2_000;

export function useLocationPrompt(sdk: FarmerChatSdk): UseLocationPromptResult {
  const [state, setState] = useState<LocationPromptState>({ kind: 'Idle' });
  const [source, setSource] = useState<LocationPromptSource | null>(null);
  const mounted = useRef(true);
  const listeners = useRef(new Set<(event: LocationPromptEvent) => void>());
  const pendingNavigation = useRef<(() => void) | null>(null);
  const sourceRef = useRef<LocationPromptSource | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * Synchronous mirror of `state`. A terminal action must ask "was a flow actually ACTIVE?"
   * before it clears it, and React state cannot be read back synchronously after a set — the
   * Android core reads its `_state` StateFlow for exactly this (`dismiss()`'s
   * capture-before-clearing). Written only through `set`, so it is authoritative.
   */
  const stateRef = useRef<LocationPromptState>({ kind: 'Idle' });

  const set = useCallback((next: LocationPromptState) => {
    if (!mounted.current) return;
    stateRef.current = next;
    setState(next);
  }, []);

  const emit = useCallback((event: LocationPromptEvent) => {
    for (const l of Array.from(listeners.current)) {
      try {
        l(event);
      } catch {
        // listener errors never break the flow
      }
    }
  }, []);

  const trackStep = useCallback(
    (step: string) => {
      sdk.analytics.track(AnalyticsEvents.GPS_FLOW_STEP, {
        step,
        source: sourceRef.current,
      });
    },
    [sdk],
  );

  const saveLocation = useCallback(
    async (lat: number, long: number) => {
      sdk.store.set(StorageKeys.FARMER_APP_LATITUDE, lat);
      sdk.store.set(StorageKeys.FARMER_APP_LONGITUDE, long);
      const userId = sdk.session.userId;
      if (userId && sdk.session.hasSession) {
        const result = await sdk.api.updateUserLocation({
          lat,
          long,
          user_id: userId,
        });
        if (result.ok) {
          if (result.data.country) {
            sdk.store.set(StorageKeys.USER_COUNTRY_NAME, result.data.country);
          }
          if (result.data.state) sdk.store.set(StorageKeys.USER_STATE, result.data.state);
          if (result.data.district) {
            sdk.store.set(StorageKeys.USER_DISTRICT, result.data.district);
          }
          sdk.store.set(StorageKeys.GPS_LOCATION_SHARED, true);
          sdk.analytics.track(AnalyticsEvents.LOCATION_UPDATE_SUCCESS, {});
        } else {
          sdk.analytics.track(AnalyticsEvents.LOCATION_UPDATE_FAILURE, {});
        }
      } else {
        // guest: save locally only
        sdk.store.set(StorageKeys.GPS_LOCATION_SHARED, true);
      }
    },
    [sdk],
  );

  const fetchLocation = useCallback(async () => {
    set({ kind: 'FetchingLocation' });
    trackStep('fetching_location');

    const getFresh = async (): Promise<Location.LocationObject | null> => {
      try {
        return await withTimeout(
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          }),
          FRESH_LOCATION_TIMEOUT_MS,
        );
      } catch {
        return null;
      }
    };

    // fresh fetch (10 s) with 1 retry
    let location = await getFresh();
    if (!location) location = await getFresh();

    // last-known fallback (2 s)
    if (!location) {
      try {
        location = await withTimeout(
          Location.getLastKnownPositionAsync(),
          LAST_KNOWN_TIMEOUT_MS,
        );
      } catch {
        location = null;
      }
    }

    if (!mounted.current) return;

    if (location) {
      sdk.analytics.track(AnalyticsEvents.LOCATION_FETCH_SUCCESS, {});
      await saveLocation(location.coords.latitude, location.coords.longitude);
      if (!mounted.current) return;
      set({ kind: 'Idle' });
      const src = sourceRef.current;
      if (src === 'widget') {
        emit({ kind: 'LocationUpdatedFromWidget' });
      } else if (src === 'weather') {
        emit({ kind: 'LocationReady' });
      }
      // Android parity (`LocationPromptManager.onLocationFetched`): a terminal Continue for
      // EVERY source, carrying the `location_fetched` reason a chat capability chip arms on.
      emit({ kind: 'Continue', source: src, reason: 'location_fetched' });
      // Only the weather flow ever registers one (triggerFromWidget/LocalContext clear it), so
      // hoisting this out of the branch above cannot fire a stray navigation.
      const nav = pendingNavigation.current;
      pendingNavigation.current = null;
      nav?.();
    } else {
      sdk.analytics.track(AnalyticsEvents.LOCATION_FETCH_FAILED_TIMEOUT, {});
      set({ kind: 'Error', errorType: 'LocationFailed' });
    }
  }, [emit, saveLocation, sdk, set, trackStep]);

  const requestPermissionAndFetch = useCallback(async () => {
    set({ kind: 'RequestPermission' });
    sdk.analytics.track(AnalyticsEvents.LOCATION_PERMISSION_PROMPT_TRIGGERED, {});
    sdk.analytics.track(AnalyticsEvents.PERMISSION_POPUP_SHOWN, { permission: 'location' });
    let response: Location.LocationPermissionResponse;
    try {
      response = await Location.requestForegroundPermissionsAsync();
    } catch {
      set({ kind: 'Error', errorType: 'LocationFailed' });
      return;
    }
    if (!mounted.current) return;

    if (response.status === 'granted') {
      sdk.analytics.track(AnalyticsEvents.LOCATION_PERMISSION_ALLOW, {});
      sdk.analytics.track(AnalyticsEvents.PERMISSION_GRANTED, { permission: 'location' });
      // GPS services check (RequestEnableGps equivalent)
      set({ kind: 'RequestEnableGps' });
      let servicesEnabled = true;
      try {
        servicesEnabled = await Location.hasServicesEnabledAsync();
      } catch {
        servicesEnabled = true; // assume enabled when the check itself fails
      }
      if (!mounted.current) return;
      if (!servicesEnabled) {
        sdk.analytics.track(AnalyticsEvents.LOCATION_FETCH_FAILED, {
          reason: 'gps_unavailable',
        });
        set({ kind: 'Error', errorType: 'GpsUnavailable' });
        return;
      }
      await fetchLocation();
    } else {
      sdk.analytics.track(AnalyticsEvents.LOCATION_PERMISSION_DENY, {});
      sdk.analytics.track(AnalyticsEvents.PERMISSION_DENIED, { permission: 'location' });
      if (response.canAskAgain === false) {
        sdk.analytics.track(
          AnalyticsEvents.PERMISSION_FALLBACK_DEFAULT_SETTING_SHOWN,
          { permission: 'location' },
        );
        // Permanently denied → the recovery sheet owns the flow; no terminal event yet, exactly
        // as in `LocationPromptManager.onPermissionResult`.
        set({ kind: 'Recovery' });
      } else {
        set({ kind: 'Idle' });
        emit({ kind: 'Cancel', source: sourceRef.current });
      }
    }
  }, [fetchLocation, sdk, set]);

  const triggerFromWeather = useCallback(
    (onLocationReady: () => void) => {
      sourceRef.current = 'weather';
      setSource('weather');
      pendingNavigation.current = onLocationReady;
      sdk.analytics.track(AnalyticsEvents.LOCATION_UPDATE_TRIGGERED, {
        source: 'weather',
      });
      set({ kind: 'Interstitial' });
      trackStep('interstitial_shown');
    },
    [sdk, set, trackStep],
  );

  const triggerFromWidget = useCallback(() => {
    sourceRef.current = 'widget';
    setSource('widget');
    pendingNavigation.current = null;
    sdk.analytics.track(AnalyticsEvents.LOCATION_UPDATE_TRIGGERED, {
      source: 'widget',
    });
    void requestPermissionAndFetch();
  }, [requestPermissionAndFetch, sdk]);

  /**
   * 2.0.0 chat capability chip. Mirrors Android's `triggerFromLocalContext`: straight to the
   * interstitial, no pending navigation. `LocationPromptHost` already renders the interstitial
   * for every non-widget source, so nothing there needs to change.
   */
  const triggerFromLocalContext = useCallback(() => {
    sourceRef.current = 'localContext';
    setSource('localContext');
    pendingNavigation.current = null;
    sdk.analytics.track(AnalyticsEvents.LOCATION_UPDATE_TRIGGERED, {
      source: 'localContext',
    });
    set({ kind: 'Interstitial' });
    trackStep('interstitial_shown');
  }, [sdk, set, trackStep]);

  const shareLocation = useCallback(() => {
    trackStep('share_clicked');
    void requestPermissionAndFetch();
  }, [requestPermissionAndFetch, trackStep]);

  const skip = useCallback(() => {
    trackStep('skipped');
    pendingNavigation.current = null;
    // Capture before clearing (Android's `wasActive`): emitting when no flow was running would
    // hand an armed chat surface a decline it never asked for.
    const wasActive = stateRef.current.kind !== 'Idle';
    set({ kind: 'Idle' });
    // Android parity (`onSkipClicked`): a skip is a terminal Cancel for whichever surface
    // started the flow.
    if (wasActive) emit({ kind: 'Cancel', source: sourceRef.current });
  }, [emit, set, trackStep]);

  const dismissError = useCallback(() => {
    // Capture before clearing (Android's `wasActive`). `handleLogout` calls this on an already
    // Idle machine, and an emission there would settle an armed chat surface with a decline the
    // farmer never triggered.
    const wasActive = stateRef.current.kind !== 'Idle';
    set({ kind: 'Idle' });
    // EVERY terminal exit must settle an armed caller, or a chat capability chip waits forever
    // and the farmer's blocking question is never answered — the bug the Android core fixed by
    // making `dismiss()` emit `Continue(reason = "dismissed")`. This is the only TERMINAL exit
    // from the Error and Recovery states (their primary buttons re-enter the flow instead), so
    // it emits: as `Cancel`, which is what Compose's own error card does (its buttons call
    // `onSkipClicked`). Cancel and `Continue("dismissed")` are equally non-success under
    // `isLocationObtained`, so the armed chat surface settles into its decline query either way
    // (recorded in docs/04).
    if (wasActive) emit({ kind: 'Cancel', source: sourceRef.current });
  }, [emit, set]);

  const retryFromRecovery = useCallback(() => {
    sdk.analytics.track(
      AnalyticsEvents.LOCATION_SETTINGS_LOCATION_PERMISSION_CLICKED,
      {},
    );
    void requestPermissionAndFetch();
  }, [requestPermissionAndFetch, sdk]);

  const addEventListener = useCallback(
    (listener: (event: LocationPromptEvent) => void) => {
      listeners.current.add(listener);
      return () => {
        listeners.current.delete(listener);
      };
    },
    [],
  );

  const hasKnownLocation = useCallback((): boolean => {
    return (
      sdk.store.getDouble(StorageKeys.FARMER_APP_LATITUDE) !== null &&
      sdk.store.getDouble(StorageKeys.FARMER_APP_LONGITUDE) !== null
    );
  }, [sdk]);

  return {
    state,
    source,
    triggerFromWeather,
    triggerFromWidget,
    triggerFromLocalContext,
    shareLocation,
    skip,
    dismissError,
    retryFromRecovery,
    addEventListener,
    hasKnownLocation,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
  });
}
