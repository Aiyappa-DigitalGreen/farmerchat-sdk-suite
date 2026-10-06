/**
 * LocationPromptManager port (docs/01 §3.15) — a web port of the Android SDK's
 * `core/ui/location/LocationPromptManager.kt`, itself a port of the app's
 * `core/location/LocationPromptManager.kt` (fc-compose-agentic).
 *
 * Every trigger runs the app's `trigger()` decision tree:
 *
 *  1. offline                                       → Error(NoNetwork, canRetry)
 *  2. Weather entry with a stored fix               → run pending navigation, no flow
 *     (the Home pill / chat chip / Settings ALWAYS re-run: an explicit tap never no-ops)
 *  3. deny_count >= 2 and no permission             → Recovery (every source)
 *  4. permission granted + a stored fix             → RequestEnableGps (no UI)
 *  5. Weather, permission granted, no fix           → Interstitial
 *  6. LocalContext / Settings, or permission held   → RequestPermission (no interstitial)
 *  7. otherwise (Weather, first ask)                → Interstitial
 *
 * => ONLY the Weather entry ever shows the full-screen interstitial.
 *
 * Browser adaptation (the "host" half — Android's LocationPromptHost — lives in this hook too):
 *  • Permission is read with `navigator.permissions.query({ name: 'geolocation' })`; a browser
 *    without it reads as "not granted", which is harmless because `getCurrentPosition` resolves
 *    without a prompt when the permission is in fact held.
 *  • The permission prompt IS `getCurrentPosition`. RequestPermission calls it with the fresh-fix
 *    options: PERMISSION_DENIED → deny; a fix → grant, and that fix is handed to the fetch phase
 *    so the browser is not asked twice; TIMEOUT / POSITION_UNAVAILABLE → grant (the timeout clock
 *    only starts once the user allows) followed by a failed attempt 0.
 *  • There is no GPS-resolution dialog. RequestEnableGps passes straight through to the fetch
 *    unless the browser has no usable geolocation (no API / insecure context) — the "services
 *    unavailable" case: Weather continues without location, every other source gets
 *    Error(GpsUnavailable, canRetry = false).
 *  • Android's ON_RESUME re-check is the PermissionStatus `change` event (plus a re-query when the
 *    tab becomes visible again).
 *  • There is no Campaign entry on web (no Plotline / MoEngage / GPS deep link in the SDK), so the
 *    Campaign branches are not ported.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SdkServices } from '../core/services';
import { PrefKeys } from '../core/storage';
import { Events, Screens } from '../core/analytics';

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
 * Which surface started the flow (Kotlin `LocationTriggerSource`, minus Campaign).
 *  • `weather`      — Home weather chip (the only entry that shows the interstitial).
 *  • `localContext` — Home location pill, or the chat GPS_PROMPT capability chip.
 *  • `settings`     — Settings "My Farm" Location row.
 */
export type LocationTriggerSource = 'weather' | 'localContext' | 'settings';

export interface LocationPromptState {
  kind: LocationPromptStateKind;
  errorType: LocationErrorType | null;
  source: LocationTriggerSource | null;
  /** Error only: the CTA re-runs the trigger tree (true) or just closes the flow (false). */
  canRetry: boolean;
  /** FetchingLocation only: 0 for the first fix, 1 for the single retry. */
  attempt: number;
}

/**
 * How a location flow ended — Kotlin `LocationPromptEvent.Continue` / `.Cancel`.
 *
 * Success is `kind: 'continue'` with a reason in {@link LOCATION_SUCCESS_REASONS}. Everything else
 * (denied, skipped, dismissed, fetch failed) is a decline.
 */
export interface LocationOutcome {
  kind: 'continue' | 'cancel';
  /** Kotlin `LocationPromptEvent.Continue.reason`. Null on a cancel. */
  reason: string | null;
}

/** A terminal flow event, broadcast to every subscriber (Kotlin `events` SharedFlow). */
export interface LocationPromptEvent extends LocationOutcome {
  source: LocationTriggerSource;
}

/** `Continue` reasons that mean a fix is now stored. */
export const LOCATION_SUCCESS_REASONS: ReadonlySet<string> = new Set(['location_fetched', 'post_settings_preference_exists']);

export function isLocationSuccess(outcome: LocationOutcome): boolean {
  return outcome.kind === 'continue' && outcome.reason !== null && LOCATION_SUCCESS_REASONS.has(outcome.reason);
}

const IDLE: LocationPromptState = { kind: 'Idle', errorType: null, source: null, canRetry: false, attempt: 0 };

function st(
  kind: LocationPromptStateKind,
  source: LocationTriggerSource,
  extra: Partial<Pick<LocationPromptState, 'errorType' | 'canRetry' | 'attempt'>> = {},
): LocationPromptState {
  return { kind, source, errorType: extra.errorType ?? null, canRetry: extra.canRetry ?? false, attempt: extra.attempt ?? 0 };
}

export interface LocationPromptActions {
  /**
   * Weather chip. With a stored fix the app skips the flow and navigates at once; otherwise the
   * flow runs and [onLocationReady] fires when it ends (any outcome but the interstitial's Back).
   */
  triggerFromWeather: (onLocationReady: () => void) => void;
  /**
   * Home location pill (no argument) or the chat GPS_PROMPT "Share my location" chip (with
   * [onOutcome]). Goes straight to the browser permission prompt — never the interstitial.
   *
   * [onOutcome] is armed for exactly this flow and fires once, on the terminal event, and marks
   * the flow as chip-originated for analytics (app `activeAgenticChip`). No-op while another
   * location flow is running (the Compose `Idle` guard), so a caller must not assume it was armed.
   */
  triggerFromLocalContext: (onOutcome?: (outcome: LocationOutcome) => void) => void;
  /** Settings "My Farm" Location row. No-op while another flow is running. */
  triggerFromSettings: () => void;
  /** Drops an armed {@link triggerFromLocalContext} callback (e.g. the chat screen unmounted). */
  cancelPendingOutcome: () => void;
  /** Subscribe to terminal flow events. Returns the unsubscribe function. */
  subscribe: (listener: (event: LocationPromptEvent) => void) => () => void;

  /** Interstitial "Share Location" CTA. */
  onInterstitialCta: () => void;
  /** Interstitial Back: emit Cancel, DROP the pending navigation. */
  cancel: () => void;
  /** Interstitial Skip / Recovery close: emit Continue(reason) and RUN the pending navigation. */
  continueWithoutLocation: (reason?: string) => void;
  /** Recovery sheet closed without going to settings (close button / backdrop). */
  closeRecovery: (reason: 'recovery_closed' | 'recovery_dismissed') => void;
  /** Recovery "Turn on in settings". */
  openRecoverySettings: () => void;
  /** Error-screen CTA: retryable → re-run the trigger tree; otherwise {@link dismiss}. */
  onErrorCta: () => void;
  /**
   * Close the flow. With [emitContinue] (default) an active flow settles with
   * `Continue("dismissed")` and the pending navigation runs; without it, the pending navigation is
   * dropped silently.
   */
  dismiss: (emitContinue?: boolean) => void;

  /** App `isLocationEnabledOnce()`: a GPS fix has been saved. */
  hasKnownLocation: () => boolean;
  /** Last-read browser geolocation permission (`navigator.permissions`); false when unknown. */
  hasLocationPermission: () => boolean;
  /** App `isBlockedByPermission()`: denied twice and still not granted. */
  isBlockedByPermission: () => boolean;
}

/** App fresh-fix timeout. */
const GEO_TIMEOUT_MS = 10_000;
/** App last-known-fix timeout. */
const LAST_KNOWN_TIMEOUT_MS = 2_000;

/** `Trigger` property values, exactly as the app's analytics sheet defines them. */
const TRIGGER_LABEL: Record<LocationTriggerSource, string> = {
  weather: 'Weather Icon',
  localContext: 'Home Screen',
  settings: 'Settings Screen',
};
/** App literal `Trigger` when the GPS flow was raised by the chat `gps-prompt` chip. */
const TRIGGER_CHAT_SCREEN = 'Chat Screen';
/** Android `AnalyticsScreens.GPS`. */
const GPS_SCREEN = 'GPS Screen';

type Fix = { lat: number; lng: number };
/** What the RequestPermission probe learned, handed to the first fetch attempt. */
type Prefetched = { kind: 'fix'; fix: Fix } | { kind: 'failed'; timeout: boolean };

type GeoResult =
  | { kind: 'fix'; fix: Fix }
  | { kind: 'denied' }
  | { kind: 'timeout' }
  | { kind: 'unavailable' };

function geolocationUsable(): boolean {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return false;
  // Browsers refuse geolocation outside a secure context; treat that as "services unavailable".
  if (typeof window !== 'undefined' && window.isSecureContext === false) return false;
  return true;
}

function getPosition(options: PositionOptions): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (!geolocationUsable()) {
      resolve({ kind: 'unavailable' });
      return;
    }
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ kind: 'fix', fix: { lat: pos.coords.latitude, lng: pos.coords.longitude } }),
        (err) => {
          // Codes per the Geolocation API: 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT.
          if (err && err.code === 1) resolve({ kind: 'denied' });
          else if (err && err.code === 3) resolve({ kind: 'timeout' });
          else resolve({ kind: 'unavailable' });
        },
        options,
      );
    } catch {
      resolve({ kind: 'unavailable' });
    }
  });
}

const FRESH_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: 0 };
const LAST_KNOWN_OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: LAST_KNOWN_TIMEOUT_MS, maximumAge: Infinity };

export function useLocationPrompt(services: SdkServices): [LocationPromptState, LocationPromptActions] {
  const { api, session, store, analytics } = services;
  const [state, setState] = useState<LocationPromptState>(IDLE);
  /** Synchronous mirror of the machine — every transition goes through {@link setMachine}. */
  const stateRef = useRef<LocationPromptState>(IDLE);
  const setMachine = useCallback((next: LocationPromptState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  /** Navigation to run when the flow completes (weather → chat). */
  const pendingNavigationRef = useRef<(() => void) | null>(null);
  /** Callback armed by the chat chip; consumed by the first terminal event. */
  const pendingOutcomeRef = useRef<((outcome: LocationOutcome) => void) | null>(null);
  /** True while the ACTIVE flow was raised by the chat chip (app `activeAgenticChip`). */
  const agenticChipRef = useRef(false);
  /** The trigger that started the running flow (app `activeSource`). */
  const activeSourceRef = useRef<LocationTriggerSource | null>(null);
  const listenersRef = useRef(new Set<(event: LocationPromptEvent) => void>());
  /** Last-read browser permission state. */
  const permissionRef = useRef<PermissionState | null>(null);
  const prefetchedRef = useRef<Prefetched | null>(null);
  /** Bumped by every trigger so a slow permission query cannot resume a superseded trigger. */
  const triggerSeqRef = useRef(0);

  // ---------------------------------------------------------------- queries

  const hasKnownLocation = useCallback((): boolean => {
    const lat = store.getString(PrefKeys.FARMER_APP_LATITUDE);
    const lng = store.getString(PrefKeys.FARMER_APP_LONGITUDE);
    return (lat ?? '').trim().length > 0 && (lng ?? '').trim().length > 0;
  }, [store]);

  const denyCount = useCallback((): number => store.getInt(PrefKeys.PERMISSION_DENY_COUNT) ?? 0, [store]);

  const hasLocationPermission = useCallback(() => permissionRef.current === 'granted', []);

  const isBlockedByPermission = useCallback(
    () => denyCount() >= 2 && permissionRef.current !== 'granted',
    [denyCount],
  );

  /** Live permission read; falls back to the last known value, then to "not granted". */
  const queryPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
        const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        permissionRef.current = status.state;
      }
    } catch {
      // Unsupported / sandboxed: keep whatever we last knew.
    }
    return permissionRef.current === 'granted';
  }, []);

  // ---------------------------------------------------------------- analytics

  /** Port of the app's `trackGpsEvent` props, with the chat-chip re-attribution applied last. */
  const gpsProps = useCallback(
    (source: LocationTriggerSource, attempt?: number | string, extra: Record<string, unknown> = {}) => {
      const props: Record<string, unknown> = {
        screen_name: GPS_SCREEN,
        Trigger: TRIGGER_LABEL[source],
        ...(attempt !== undefined ? { Attempt: attempt } : {}),
        ...extra,
      };
      if (agenticChipRef.current) {
        props.screen_name = Screens.CHAT;
        props.Trigger = TRIGGER_CHAT_SCREEN;
        props.agentic_chip_type = 'gps-prompt';
      }
      return props;
    },
    [],
  );

  // ---------------------------------------------------------------- emit / settle

  const emit = useCallback((event: LocationPromptEvent) => {
    const pending = pendingOutcomeRef.current;
    pendingOutcomeRef.current = null;
    try {
      pending?.({ kind: event.kind, reason: event.reason });
    } catch {
      // A caller's error never breaks the machine.
    }
    for (const listener of Array.from(listenersRef.current)) {
      try {
        listener(event);
      } catch {
        // runCatching parity
      }
    }
  }, []);

  const executePendingNavigation = useCallback(() => {
    const nav = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    try {
      nav?.();
    } catch {
      // runCatching parity
    }
  }, []);

  const toIdle = useCallback(() => {
    setMachine(IDLE);
    activeSourceRef.current = null;
    prefetchedRef.current = null;
  }, [setMachine]);

  const dismiss = useCallback(
    (emitContinue = true) => {
      const src = activeSourceRef.current;
      if (emitContinue && src !== null) {
        emit({ kind: 'continue', reason: 'dismissed', source: src });
        executePendingNavigation();
      } else {
        pendingNavigationRef.current = null;
        // Kotlin emits nothing here. Web settles an armed chat callback as a cancel anyway, so the
        // blocking gps-prompt question always gets an answer.
        const pending = pendingOutcomeRef.current;
        pendingOutcomeRef.current = null;
        pending?.({ kind: 'cancel', reason: null });
      }
      toIdle();
    },
    [emit, executePendingNavigation, toIdle],
  );

  const continueWithoutLocation = useCallback(
    (reason = 'continue_without_location') => {
      const src = activeSourceRef.current;
      if (src === null) {
        dismiss(false);
        return;
      }
      emit({ kind: 'continue', reason, source: src });
      executePendingNavigation();
      dismiss(false);
    },
    [dismiss, emit, executePendingNavigation],
  );

  const cancel = useCallback(() => {
    const src = activeSourceRef.current;
    if (src === null) {
      dismiss(false);
      return;
    }
    emit({ kind: 'cancel', reason: null, source: src });
    pendingNavigationRef.current = null;
    dismiss(false);
  }, [dismiss, emit]);

  // ---------------------------------------------------------------- state entries

  const enterInterstitial = useCallback(
    (source: LocationTriggerSource) => {
      analytics.track(Events.GPS_FLOW_STEP, { step: 'interstitial_shown', source });
      setMachine(st('Interstitial', source));
    },
    [analytics, setMachine],
  );

  const enterRequestPermission = useCallback(
    (source: LocationTriggerSource) => {
      analytics.track(Events.PERMISSION_POPUP_SHOWN, gpsProps(source, 1, { Permission_type: 'Location' }));
      analytics.track(Events.LOCATION_PERMISSION_PROMPT_TRIGGERED, gpsProps(source, 1));
      setMachine(st('RequestPermission', source));
    },
    [analytics, gpsProps, setMachine],
  );

  const enterRecovery = useCallback(
    (source: LocationTriggerSource) => {
      analytics.track(Events.PERMISSION_FALLBACK_DEFAULT_SETTING_SHOWN, gpsProps(source, 1));
      setMachine(st('Recovery', source));
    },
    [analytics, gpsProps, setMachine],
  );

  const enterFetchingLocation = useCallback(
    (source: LocationTriggerSource, attempt = 0) => {
      analytics.track(Events.LOCATION_UPDATE_TRIGGERED, gpsProps(source, attempt + 1, { screen_name: Screens.HOME }));
      setMachine(st('FetchingLocation', source, { attempt }));
    },
    [analytics, gpsProps, setMachine],
  );

  // ---------------------------------------------------------------- trigger tree

  const trigger = useCallback(
    async (source: LocationTriggerSource) => {
      const seq = ++triggerSeqRef.current;
      const online = typeof navigator === 'undefined' || !('onLine' in navigator) ? true : navigator.onLine;
      if (!online) {
        activeSourceRef.current = source;
        setMachine(st('Error', source, { errorType: 'NoNetwork', canRetry: true }));
        return;
      }

      // Already enabled once: only the Weather entry no-ops. A tap on the pill / chip / Settings
      // row is an explicit request to refresh the location.
      if (hasKnownLocation() && source === 'weather') {
        executePendingNavigation();
        return;
      }

      activeSourceRef.current = source;
      const hasPermission = await queryPermission();
      if (seq !== triggerSeqRef.current) return; // superseded while the permission query ran

      const deny = denyCount();
      if (deny >= 2 && !hasPermission) {
        enterRecovery(source);
        return;
      }

      const shouldSkipInterstitial = hasPermission || source === 'localContext' || source === 'settings';
      const hasFix = hasKnownLocation();

      analytics.track(
        Events.LOCATION_UPDATE_TRIGGERED,
        gpsProps(source, undefined, { screen_name: Screens.HOME, Attempt: String(Math.min(Math.max(deny + 1, 1), 2)) }),
      );

      if (hasPermission && hasFix) setMachine(st('RequestEnableGps', source));
      else if (hasPermission && source === 'weather') enterInterstitial(source);
      else if (shouldSkipInterstitial) enterRequestPermission(source);
      else enterInterstitial(source);
    },
    [
      analytics,
      denyCount,
      enterInterstitial,
      enterRecovery,
      enterRequestPermission,
      executePendingNavigation,
      gpsProps,
      hasKnownLocation,
      queryPermission,
      setMachine,
    ],
  );

  const triggerFromWeather = useCallback(
    (onLocationReady: () => void) => {
      agenticChipRef.current = false;
      // A weather flow owns the machine from here; an armed chat outcome is dropped rather than
      // fired against the wrong surface.
      pendingOutcomeRef.current = null;
      pendingNavigationRef.current = onLocationReady;
      if (hasKnownLocation()) {
        executePendingNavigation();
        return;
      }
      void trigger('weather');
    },
    [executePendingNavigation, hasKnownLocation, trigger],
  );

  const triggerFromLocalContext = useCallback<LocationPromptActions['triggerFromLocalContext']>(
    (onOutcome) => {
      if (stateRef.current.kind !== 'Idle') return;
      agenticChipRef.current = onOutcome !== undefined;
      pendingOutcomeRef.current = onOutcome ?? null;
      pendingNavigationRef.current = null;
      void trigger('localContext');
    },
    [trigger],
  );

  const triggerFromSettings = useCallback(() => {
    if (stateRef.current.kind !== 'Idle') return;
    agenticChipRef.current = false;
    pendingOutcomeRef.current = null;
    pendingNavigationRef.current = null;
    void trigger('settings');
  }, [trigger]);

  const cancelPendingOutcome = useCallback(() => {
    pendingOutcomeRef.current = null;
  }, []);

  const subscribe = useCallback((listener: (event: LocationPromptEvent) => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  // ---------------------------------------------------------------- results

  const onPermissionResult = useCallback(
    (granted: boolean) => {
      const current = stateRef.current;
      if (
        current.source === null ||
        !(
          current.kind === 'RequestPermission' ||
          current.kind === 'Interstitial' ||
          current.kind === 'Error' ||
          current.kind === 'Recovery' ||
          // Web only: a PERMISSION_DENIED during the fetch (revoked mid-flow) also counts.
          current.kind === 'FetchingLocation'
        )
      ) {
        return;
      }
      const source = current.source;

      if (!granted) {
        const deny = denyCount() + 1;
        store.setInt(PrefKeys.PERMISSION_DENY_COUNT, deny);
        analytics.track(Events.PERMISSION_DENIED, gpsProps(source, deny, { Permission_type: 'Location' }));
        analytics.track(Events.LOCATION_PERMISSION_DENY, gpsProps(source, deny));
        // The 2nd deny escalates to the Recovery sheet, for every source.
        if (deny >= 2) {
          enterRecovery(source);
          return;
        }
        // Do not block app usage: carry on with IP-based location.
        setMachine(IDLE);
        emit({ kind: 'continue', reason: 'permission_denied', source });
        executePendingNavigation();
        activeSourceRef.current = null;
        prefetchedRef.current = null;
        return;
      }

      analytics.track(Events.PERMISSION_GRANTED, gpsProps(source, 1, { Permission_type: 'Location' }));
      analytics.track(Events.LOCATION_PERMISSION_ALLOW, gpsProps(source, 1));
      store.setInt(PrefKeys.PERMISSION_DENY_COUNT, 0);

      const isFromRecovery = current.kind === 'Recovery';
      if (isFromRecovery && hasKnownLocation()) {
        emit({ kind: 'continue', reason: 'post_settings_preference_exists', source });
        executePendingNavigation();
        toIdle();
        return;
      }
      if (isFromRecovery && source === 'weather') enterInterstitial(source);
      else setMachine(st('RequestEnableGps', source));
    },
    [analytics, denyCount, emit, enterInterstitial, enterRecovery, executePendingNavigation, gpsProps, hasKnownLocation, setMachine, store, toIdle],
  );

  /** The browser has no usable geolocation — Android's declined GPS-resolution dialog. */
  const onServicesUnavailable = useCallback(
    (source: LocationTriggerSource) => {
      if (source === 'weather') {
        continueWithoutLocation('gps_disabled_no_thanks');
        return;
      }
      activeSourceRef.current = source;
      setMachine(st('Error', source, { errorType: 'GpsUnavailable', canRetry: false }));
    },
    [continueWithoutLocation, setMachine],
  );

  const finishWithLocation = useCallback(
    (source: LocationTriggerSource) => {
      setMachine(IDLE);
      emit({ kind: 'continue', reason: 'location_fetched', source });
      executePendingNavigation();
      activeSourceRef.current = null;
      prefetchedRef.current = null;
    },
    [emit, executePendingNavigation, setMachine],
  );

  const saveLocation = useCallback(
    (fix: Fix) => {
      store.setString(PrefKeys.FARMER_APP_LATITUDE, String(fix.lat));
      store.setString(PrefKeys.FARMER_APP_LONGITUDE, String(fix.lng));
      store.setBool(PrefKeys.GPS_LOCATION_SHARED, true);
    },
    [store],
  );

  const onLocationFetched = useCallback(
    (fix: Fix) => {
      const s = stateRef.current;
      if (s.kind !== 'FetchingLocation' || s.source === null) return;
      const source = s.source;
      analytics.track(Events.LOCATION_FETCH_SUCCESS, gpsProps(source, s.attempt + 1));

      const userId = (session.userId ?? '').trim();
      if (userId.length === 0) {
        // Guest: nothing to sync, save at once.
        saveLocation(fix);
        finishWithLocation(source);
        return;
      }
      // Weather navigates as soon as the fix is in; the API finishes in the background.
      if (source === 'weather') finishWithLocation(source);

      void (async () => {
        const res = await api.updateUserLocation({ lat: fix.lat, long: fix.lng, user_id: userId });
        if (res.ok) {
          // Saved only on API success, as the app does. Web models these three response fields.
          if (res.data.country) store.setString(PrefKeys.USER_COUNTRY_NAME, res.data.country);
          if (res.data.state) store.setString(PrefKeys.USER_STATE, res.data.state);
          if (res.data.district) store.setString(PrefKeys.USER_DISTRICT, res.data.district);
          saveLocation(fix);
          if (source !== 'weather') finishWithLocation(source);
        } else if (source !== 'weather') {
          // App: LocalContext / Settings dismiss; nothing is saved.
          dismiss();
        }
      })();
    },
    [analytics, api, dismiss, finishWithLocation, gpsProps, saveLocation, session, store],
  );

  const onLocationFetchFailed = useCallback(
    (timeout: boolean) => {
      const s = stateRef.current;
      if (s.kind !== 'FetchingLocation' || s.source === null) return;
      analytics.track(timeout ? Events.LOCATION_FETCH_FAILED_TIMEOUT : Events.LOCATION_FETCH_FAILED, gpsProps(s.source, s.attempt + 1));
      if (s.attempt < 1) {
        enterFetchingLocation(s.source, s.attempt + 1);
        return;
      }
      // After the retry and the last-known fallback: end QUIETLY — no error screen.
      const source = s.source;
      emit({ kind: 'continue', reason: 'location_failed_fallback', source });
      executePendingNavigation();
      toIdle();
    },
    [analytics, emit, enterFetchingLocation, executePendingNavigation, gpsProps, toIdle],
  );

  // ---------------------------------------------------------------- host side effects

  /** Runs the browser permission prompt (= getCurrentPosition) and reports the result. */
  const requestBrowserPermission = useCallback(
    async (expected: LocationPromptState) => {
      if (!geolocationUsable()) {
        if (stateRef.current === expected && expected.source) onServicesUnavailable(expected.source);
        return;
      }
      const result = await getPosition(FRESH_OPTIONS);
      if (stateRef.current !== expected) return; // the flow moved on (dismissed / superseded)
      if (result.kind === 'denied') {
        onPermissionResult(false);
        return;
      }
      permissionRef.current = 'granted';
      prefetchedRef.current =
        result.kind === 'fix' ? { kind: 'fix', fix: result.fix } : { kind: 'failed', timeout: result.kind === 'timeout' };
      onPermissionResult(true);
    },
    [onPermissionResult, onServicesUnavailable],
  );

  useEffect(() => {
    const s = state;
    if (s.source === null) return;
    const source = s.source;
    let alive = true;

    if (s.kind === 'RequestPermission') {
      void requestBrowserPermission(s);
    } else if (s.kind === 'RequestEnableGps') {
      // No GPS-resolution dialog on the web: straight through unless geolocation is unusable.
      if (geolocationUsable()) enterFetchingLocation(source, 0);
      else onServicesUnavailable(source);
    } else if (s.kind === 'FetchingLocation') {
      void (async () => {
        const pre = prefetchedRef.current;
        prefetchedRef.current = null;
        if (pre && s.attempt === 0) {
          if (pre.kind === 'fix') onLocationFetched(pre.fix);
          else onLocationFetchFailed(pre.timeout);
          return;
        }
        let result = await getPosition(FRESH_OPTIONS);
        // After the retry the app falls back to the last known fix.
        if (result.kind !== 'fix' && result.kind !== 'denied' && s.attempt >= 1) {
          const last = await getPosition(LAST_KNOWN_OPTIONS);
          if (last.kind === 'fix') result = last;
        }
        if (!alive || stateRef.current !== s) return;
        if (result.kind === 'fix') onLocationFetched(result.fix);
        else if (result.kind === 'denied') onPermissionResult(false);
        else onLocationFetchFailed(result.kind === 'timeout');
      })();
    }
    return () => {
      alive = false;
    };
    // Driven by state transitions only (Compose `LaunchedEffect(state)`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  /**
   * Android's ON_RESUME re-check while Recovery is up: the farmer may have allowed location in
   * the browser's site settings. Every (non-campaign) source returns to the interstitial so the
   * farmer re-confirms with "Share Location".
   */
  const onPermissionMaybeChanged = useCallback(async () => {
    const before = stateRef.current;
    if (before.kind !== 'Recovery' || before.source === null) return;
    const granted = await queryPermission();
    if (!granted || stateRef.current !== before) return;
    enterInterstitial(before.source);
  }, [enterInterstitial, queryPermission]);

  useEffect(() => {
    let status: PermissionStatus | null = null;
    let disposed = false;
    const onChange = () => {
      if (status) permissionRef.current = status.state;
      void onPermissionMaybeChanged();
    };
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') void onPermissionMaybeChanged();
    };
    try {
      if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
        navigator.permissions
          .query({ name: 'geolocation' as PermissionName })
          .then((s) => {
            if (disposed) return;
            status = s;
            permissionRef.current = s.state;
            s.addEventListener('change', onChange);
          })
          .catch(() => undefined);
      }
    } catch {
      // ignore — permission tracking is best-effort
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      status?.removeEventListener('change', onChange);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    };
  }, [onPermissionMaybeChanged]);

  // ---------------------------------------------------------------- UI actions

  const onInterstitialCta = useCallback(() => {
    const s = stateRef.current;
    if (s.kind !== 'Interstitial' || s.source === null) return;
    enterRequestPermission(s.source);
  }, [enterRequestPermission]);

  const skipInterstitial = useCallback(
    (reason?: string) => {
      if (stateRef.current.kind === 'Interstitial') {
        analytics.track(Events.GPS_FLOW_STEP, { step: 'interstitial_skipped' });
      }
      continueWithoutLocation(reason);
    },
    [analytics, continueWithoutLocation],
  );

  const closeRecovery = useCallback(
    (reason: 'recovery_closed' | 'recovery_dismissed') => {
      const s = stateRef.current;
      if (s.kind !== 'Recovery' || s.source === null) return;
      analytics.track(Events.PERMISSION_FALLBACK_DEFAULT_SETTING_CANCELED, gpsProps(s.source, 1, { Permission_type: 'Location' }));
      continueWithoutLocation(reason);
    },
    [analytics, continueWithoutLocation, gpsProps],
  );

  /**
   * A page cannot open the browser's site settings. "Turn on in settings" therefore re-reads the
   * permission: granted → the grant-from-Recovery path; still promptable → ask again (an answer
   * goes through the normal grant/deny handling); blocked → nothing more the page can do, the
   * sheet stays up until the farmer changes it from the address bar (the `change` listener picks
   * that up).
   */
  const openRecoverySettings = useCallback(() => {
    const s = stateRef.current;
    if (s.kind !== 'Recovery' || s.source === null) return;
    analytics.track(Events.PERMISSION_FALLBACK_DEFAULT_SETTING_CLICKED, gpsProps(s.source, 1, { Permission_type: 'Location' }));
    void (async () => {
      const granted = await queryPermission();
      if (stateRef.current !== s) return;
      if (granted) {
        onPermissionResult(true);
        return;
      }
      if (permissionRef.current === 'denied') return;
      if (!geolocationUsable()) return;
      const result = await getPosition(FRESH_OPTIONS);
      if (stateRef.current !== s) return;
      if (result.kind === 'denied') {
        onPermissionResult(false);
        return;
      }
      permissionRef.current = 'granted';
      prefetchedRef.current =
        result.kind === 'fix' ? { kind: 'fix', fix: result.fix } : { kind: 'failed', timeout: result.kind === 'timeout' };
      onPermissionResult(true);
    })();
  }, [analytics, gpsProps, onPermissionResult, queryPermission]);

  const onErrorCta = useCallback(() => {
    const s = stateRef.current;
    if (s.kind !== 'Error' || s.source === null) return;
    if (s.canRetry) void trigger(s.source);
    else dismiss();
  }, [dismiss, trigger]);

  return [
    state,
    {
      triggerFromWeather,
      triggerFromLocalContext,
      triggerFromSettings,
      cancelPendingOutcome,
      subscribe,
      onInterstitialCta,
      cancel,
      continueWithoutLocation: skipInterstitial,
      closeRecovery,
      openRecoverySettings,
      onErrorCta,
      dismiss,
      hasKnownLocation,
      hasLocationPermission,
      isBlockedByPermission,
    },
  ];
}
