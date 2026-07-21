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

export interface LocationPromptState {
  kind: LocationPromptStateKind;
  errorType: LocationErrorType | null;
  /** Weather flow keeps the interstitial overlay during permission/fetch. */
  source: 'weather' | 'widget' | null;
}

const IDLE: LocationPromptState = { kind: 'Idle', errorType: null, source: null };

export interface LocationPromptActions {
  /** Weather CTA → interstitial (or straight through when location is known). */
  triggerFromWeather: (onLocationReady: () => void) => void;
  shareLocation: () => Promise<void>;
  skip: () => void;
  dismissError: () => void;
  retry: () => Promise<void>;
  hasKnownLocation: () => boolean;
}

const GEO_TIMEOUT_MS = 10_000;

export function useLocationPrompt(services: SdkServices): [LocationPromptState, LocationPromptActions] {
  const [state, setState] = useState<LocationPromptState>(IDLE);
  const pendingNavigationRef = useRef<(() => void) | null>(null);
  const { api, session, store, analytics } = services;

  const hasKnownLocation = useCallback((): boolean => {
    return (
      store.getString(PrefKeys.FARMER_APP_LATITUDE) !== null &&
      store.getString(PrefKeys.FARMER_APP_LONGITUDE) !== null
    );
  }, [store]);

  const triggerFromWeather = useCallback(
    (onLocationReady: () => void) => {
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
    const pending = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    pending?.();
  }, [analytics, api, getPosition, session, store]);

  const skip = useCallback(() => {
    analytics.track(Events.GPS_FLOW_STEP, { step: 'interstitial_skipped' });
    pendingNavigationRef.current = null;
    setState(IDLE);
  }, [analytics]);

  const dismissError = useCallback(() => {
    pendingNavigationRef.current = null;
    setState(IDLE);
  }, []);

  const retry = useCallback(async () => {
    await shareLocation();
  }, [shareLocation]);

  return [state, { triggerFromWeather, shareLocation, skip, dismissError, retry, hasKnownLocation }];
}
