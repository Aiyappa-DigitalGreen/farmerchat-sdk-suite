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

export type LocationPromptSource = 'weather' | 'widget';

export type LocationPromptEvent =
  | { kind: 'LocationUpdatedFromWidget' }
  | { kind: 'LocationReady' };

export interface UseLocationPromptResult {
  state: LocationPromptState;
  source: LocationPromptSource | null;
  /** Weather CTA flow — keeps the interstitial overlay during fetch. */
  triggerFromWeather: (onLocationReady: () => void) => void;
  /** Campaign/widget flow — silent (no interstitial during fetch). */
  triggerFromWidget: () => void;
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

  const set = useCallback((next: LocationPromptState) => {
    if (!mounted.current) return;
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
      if (sourceRef.current === 'widget') {
        emit({ kind: 'LocationUpdatedFromWidget' });
      } else {
        emit({ kind: 'LocationReady' });
        const nav = pendingNavigation.current;
        pendingNavigation.current = null;
        nav?.();
      }
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
        set({ kind: 'Recovery' });
      } else {
        set({ kind: 'Idle' });
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

  const shareLocation = useCallback(() => {
    trackStep('share_clicked');
    void requestPermissionAndFetch();
  }, [requestPermissionAndFetch, trackStep]);

  const skip = useCallback(() => {
    trackStep('skipped');
    pendingNavigation.current = null;
    set({ kind: 'Idle' });
  }, [set, trackStep]);

  const dismissError = useCallback(() => {
    set({ kind: 'Idle' });
  }, [set]);

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
