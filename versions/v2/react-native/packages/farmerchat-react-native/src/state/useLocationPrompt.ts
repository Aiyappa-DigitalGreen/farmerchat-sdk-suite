/**
 * useLocationPrompt — port of the Android core's `ui/location/LocationPromptManager.kt` (itself a
 * port of the app's `core/location/LocationPromptManager.kt`, fc-compose-agentic), docs/01 §3.15.
 *
 * States: Idle → Interstitial → RequestPermission → RequestEnableGps → FetchingLocation, plus
 * Recovery and Error. Unlike Android (where the Compose host owns the launchers), the platform
 * calls (`expo-location` permission / services / fetch, `Linking.openSettings`, `AppState`) live
 * here and `LocationPromptHost` only renders.
 *
 * Every trigger runs the app's `trigger()` decision tree:
 *
 *  1. offline                                    → Error(NoNetwork, canRetry)
 *  2. Weather entry with a stored fix            → run the pending navigation, no flow
 *  3. denied twice and still no permission       → Recovery ("We need your location" sheet)
 *  4. permission granted + a stored fix          → RequestEnableGps (no UI, straight to GPS/fetch)
 *  5. Weather, permission granted, no fix        → Interstitial
 *  6. Campaign, permission granted, no fix       → RequestEnableGps
 *  7. LocalContext / Settings / Campaign, or permission already granted
 *                                                → RequestPermission (system dialog, no interstitial)
 *  8. otherwise (Weather, first ask)             → Interstitial
 *
 * So ONLY the Weather entry ever shows the full-screen interstitial.
 *
 * Before 2026-10-06 this hook sent the weather/chip triggers through the interstitial, decided
 * "permanently denied" from `canAskAgain`, let the GPS-off error retry back into the same flow,
 * showed an error screen when the fix failed and wrote lat/lng before `update_user_location`
 * answered. All five diverged from the app.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import { AnalyticsEvents, ScreenNames } from '../core/analytics';
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
  | { kind: 'FetchingLocation'; attempt: number }
  | { kind: 'Recovery' }
  /**
   * `canRetry` false = the farmer can't fix it inside the app (GPS declined): the CTA closes the
   * flow instead of re-entering the same GPS prompt.
   */
  | { kind: 'Error'; errorType: LocationErrorType; canRetry: boolean };

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
  /**
   * Weather chip. With a stored fix [onLocationReady] runs at once; otherwise the flow runs and
   * [onLocationReady] fires when it ends with any outcome but [cancel].
   */
  triggerFromWeather: (onLocationReady: () => void) => void;
  /** Campaign / home-feed `enable_location` card (Android `triggerFromCampaign`). */
  triggerFromWidget: () => void;
  /**
   * Home location pill, or the 2.0.0 chat `gps-prompt` chip ([fromAgenticChip] = true, which
   * re-attributes the GPS analytics funnel to Chat, app parity).
   */
  triggerFromLocalContext: (fromAgenticChip?: boolean) => void;
  /** Settings "My Farm" Location row. */
  triggerFromSettings: () => void;
  /** Interstitial "Share Location" CTA. */
  shareLocation: () => void;
  /** Interstitial Skip → `continueWithoutLocation("skip")`. */
  skip: () => void;
  /** Interstitial back: emit Cancel and DROP the pending navigation. */
  cancel: () => void;
  /** Emit a non-success `Continue(reason)`, run the pending navigation, close the flow. */
  continueWithoutLocation: (reason: string) => void;
  /**
   * Close the flow. With [emitContinue] (default) an active flow settles with
   * `Continue("dismissed")` and the pending navigation runs; without, it is dropped silently.
   */
  dismiss: (emitContinue?: boolean) => void;
  /** Error-screen CTA: retryable → re-run the trigger tree; otherwise [dismiss]. */
  onErrorCta: () => void;
  /** Recovery "Turn on in settings": track + open the app's system settings page. */
  openRecoverySettings: () => void;
  /** Recovery close button / backdrop / back: track Canceled + `continueWithoutLocation`. */
  closeRecovery: (reason: 'recovery_closed' | 'recovery_dismissed') => void;
  /** Silent full reset (logout). Emits nothing. */
  clearState: () => void;
  /** Synchronous "no flow running (or starting)" — safe inside memoised callbacks. */
  isIdle: () => boolean;
  /** Synchronous offline probe the decision tree uses (see `isOnline` below). */
  isOnline: () => boolean;
  /** Live location-permission check (Android: FINE only, as the app checks). */
  hasLocationPermission: () => Promise<boolean>;
  /** Host screens listen for widget-driven refreshes / weather continuations. */
  addEventListener: (listener: (event: LocationPromptEvent) => void) => () => void;
  /** App `isLocationEnabledOnce()`: a GPS fix has been saved. */
  hasKnownLocation: () => boolean;
}

const FRESH_LOCATION_TIMEOUT_MS = 10_000;
const LAST_KNOWN_TIMEOUT_MS = 2_000;

/** Android `AnalyticsProps` names (app `trackGpsEvent`). */
const PROP_SCREEN_NAME = 'screen_name';
const PROP_TRIGGER = 'Trigger';
const PROP_ATTEMPT = 'Attempt';
const PROP_PERMISSION_TYPE = 'Permission_type';
const PROP_AGENTIC_CHIP_TYPE = 'agentic_chip_type';
/** App literal for the chat `gps-prompt` chip's `Trigger`. */
const TRIGGER_CHAT_SCREEN = 'Chat Screen';
const GPS_PROMPT_CHIP_TYPE = 'gps-prompt';

/** `Trigger` values exactly as the app's analytics sheet defines them (Android `gpsTriggerLabel`). */
function gpsTriggerLabel(source: LocationPromptSource): string {
  switch (source) {
    case 'weather':
      return 'Weather Icon';
    case 'localContext':
      return 'Home Screen';
    case 'settings':
      return 'Settings Screen';
    case 'widget':
      return 'Plotline Campaign';
  }
}

/**
 * Connectivity probe for tree step 1. This package has no connectivity dependency (NetInfo is
 * not a peer dependency and `CLAUDE.md` forbids adding custom native modules), so it reports
 * online and offline surfaces later as a failed `update_user_location` (→ `dismiss()`), exactly
 * as the rest of this package detects offline (from request results). Recorded as a deviation.
 */
function isOnline(): boolean {
  return true;
}

async function readLocationPermission(): Promise<boolean> {
  try {
    return isFineGrant(await Location.getForegroundPermissionsAsync());
  } catch {
    return false;
  }
}

/**
 * The app checks `ACCESS_FINE_LOCATION` only, so on Android an "Approximate" grant counts as a
 * deny. iOS has a single location permission.
 */
function isFineGrant(response: Location.LocationPermissionResponse): boolean {
  if (response.status !== 'granted') return false;
  if (Platform.OS === 'android' && response.android && response.android.accuracy !== 'fine') {
    return false;
  }
  return true;
}

export function useLocationPrompt(sdk: FarmerChatSdk): UseLocationPromptResult {
  const [state, setState] = useState<LocationPromptState>({ kind: 'Idle' });
  const [source, setSourceState] = useState<LocationPromptSource | null>(null);
  const mounted = useRef(true);
  const listeners = useRef(new Set<(event: LocationPromptEvent) => void>());
  const pendingNavigation = useRef<(() => void) | null>(null);
  const sourceRef = useRef<LocationPromptSource | null>(null);
  /** App `activeAgenticChip`: the running flow came from the chat `gps-prompt` chip. */
  const agenticChipOrigin = useRef(false);
  /**
   * True from the moment a trigger is accepted until its first state lands. The permission check
   * awaits before the machine leaves Idle, so without this a double tap could start two flows.
   */
  const starting = useRef(false);
  /**
   * Bumped on every new flow and every exit. Async continuations (permission dialog, fetch,
   * update_user_location) compare against it and drop themselves when the flow they belonged to
   * has ended — e.g. logout mid-fetch.
   */
  const generation = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * Synchronous mirror of `state`. A terminal action must ask "was a flow actually ACTIVE?"
   * before it clears it, and React state cannot be read back synchronously after a set — the
   * Android core reads its `_state` StateFlow for exactly this. Written only through `set`, so it
   * is authoritative.
   */
  const stateRef = useRef<LocationPromptState>({ kind: 'Idle' });

  const set = useCallback(
    (next: LocationPromptState) => {
      const prev = stateRef.current;
      stateRef.current = next;
      starting.current = false;
      // App LocationPromptHost: Screen_Viewed on entering the interstitial, Screen_Exit on
      // leaving it, for "GPS Interstitial Screen".
      const wasInterstitial = prev.kind === 'Interstitial';
      const isInterstitial = next.kind === 'Interstitial';
      if (wasInterstitial && !isInterstitial) {
        sdk.analytics.trackScreenExit(ScreenNames.GPS_INTERSTITIAL);
      }
      if (isInterstitial && !wasInterstitial) {
        sdk.analytics.trackScreenView(ScreenNames.GPS_INTERSTITIAL);
      }
      if (mounted.current) setState(next);
    },
    [sdk],
  );

  const setSource = useCallback((next: LocationPromptSource | null) => {
    sourceRef.current = next;
    if (mounted.current) setSourceState(next);
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

  const executePendingNavigation = useCallback(() => {
    const nav = pendingNavigation.current;
    pendingNavigation.current = null;
    if (!nav) return;
    try {
      nav();
    } catch {
      // a host navigation error never breaks the flow
    }
  }, []);

  // ------------------------------------------------------------------ analytics

  /**
   * Port of the app's `trackGpsEvent` / Android `gpsProps`: `screen_name` = GPS Screen unless an
   * extra overrides it, `Trigger` from the source, `Attempt` only when supplied. A chat-chip flow
   * is re-attributed to Chat AFTER the extras, so it wins over the Home override.
   */
  const gpsProps = useCallback(
    (attempt?: number, extra: Record<string, unknown> = {}): Record<string, unknown> => {
      const src = sourceRef.current ?? 'weather';
      const props: Record<string, unknown> = {
        [PROP_SCREEN_NAME]: ScreenNames.GPS,
        [PROP_TRIGGER]: gpsTriggerLabel(src),
      };
      if (attempt !== undefined) props[PROP_ATTEMPT] = attempt;
      Object.assign(props, extra);
      if (agenticChipOrigin.current) {
        props[PROP_SCREEN_NAME] = ScreenNames.CHAT;
        props[PROP_TRIGGER] = TRIGGER_CHAT_SCREEN;
        props[PROP_AGENTIC_CHIP_TYPE] = GPS_PROMPT_CHIP_TYPE;
      }
      return props;
    },
    [],
  );

  const trackStep = useCallback(
    (step: string) => {
      sdk.analytics.track(AnalyticsEvents.GPS_FLOW_STEP, {
        step,
        source: sourceRef.current,
      });
    },
    [sdk],
  );

  // ------------------------------------------------------------------ queries

  const hasKnownLocation = useCallback((): boolean => {
    return (
      sdk.store.getDouble(StorageKeys.FARMER_APP_LATITUDE) !== null &&
      sdk.store.getDouble(StorageKeys.FARMER_APP_LONGITUDE) !== null
    );
  }, [sdk]);

  const denyCount = useCallback(
    (): number => sdk.store.getInt(StorageKeys.PERMISSION_DENY_COUNT, 0),
    [sdk],
  );

  const isIdle = useCallback(
    (): boolean => stateRef.current.kind === 'Idle' && !starting.current,
    [],
  );

  // ------------------------------------------------------------------ exits

  const dismiss = useCallback(
    (emitContinue: boolean = true) => {
      const src = sourceRef.current;
      generation.current += 1;
      if (emitContinue && src !== null) {
        set({ kind: 'Idle' });
        setSource(null);
        agenticChipOrigin.current = false;
        // "dismissed" is NOT a success reason; it exists so an armed caller (weather → chat, the
        // chat gps-prompt) never waits forever.
        emit({ kind: 'Continue', source: src, reason: 'dismissed' });
        executePendingNavigation();
        return;
      }
      pendingNavigation.current = null;
      set({ kind: 'Idle' });
      setSource(null);
      agenticChipOrigin.current = false;
    },
    [emit, executePendingNavigation, set, setSource],
  );

  const continueWithoutLocation = useCallback(
    (reason: string) => {
      const src = sourceRef.current;
      if (src === null) {
        dismiss(false);
        return;
      }
      generation.current += 1;
      set({ kind: 'Idle' });
      setSource(null);
      agenticChipOrigin.current = false;
      emit({ kind: 'Continue', source: src, reason });
      executePendingNavigation();
    },
    [dismiss, emit, executePendingNavigation, set, setSource],
  );

  const cancel = useCallback(() => {
    const src = sourceRef.current;
    pendingNavigation.current = null;
    if (src === null) {
      dismiss(false);
      return;
    }
    emit({ kind: 'Cancel', source: src });
    dismiss(false);
  }, [dismiss, emit]);

  const clearState = useCallback(() => {
    generation.current += 1;
    pendingNavigation.current = null;
    agenticChipOrigin.current = false;
    set({ kind: 'Idle' });
    setSource(null);
  }, [set, setSource]);

  // ------------------------------------------------------------------ success

  const saveLocation = useCallback(
    (lat: number, long: number) => {
      sdk.store.set(StorageKeys.FARMER_APP_LATITUDE, lat);
      sdk.store.set(StorageKeys.FARMER_APP_LONGITUDE, long);
      sdk.store.set(StorageKeys.GPS_LOCATION_SHARED, true);
    },
    [sdk],
  );

  const finishWithLocation = useCallback(
    (src: LocationPromptSource) => {
      generation.current += 1;
      set({ kind: 'Idle' });
      setSource(null);
      agenticChipOrigin.current = false;
      if (src === 'weather') emit({ kind: 'LocationReady' });
      emit({ kind: 'Continue', source: src, reason: 'location_fetched' });
      executePendingNavigation();
    },
    [emit, executePendingNavigation, set, setSource],
  );

  /**
   * A fix was obtained (fresh or last-known). Saved only after `update_user_location` succeeds,
   * as the app does; a guest saves immediately. The Weather entry navigates at once and lets the
   * API finish in the background.
   */
  const onLocationFetched = useCallback(
    (lat: number, long: number, attempt: number) => {
      const src = sourceRef.current;
      if (src === null) return;
      sdk.analytics.track(AnalyticsEvents.LOCATION_FETCH_SUCCESS, gpsProps(attempt + 1));
      const userId = sdk.session.userId;
      if (!userId || !sdk.session.hasSession) {
        saveLocation(lat, long);
        finishWithLocation(src);
        return;
      }
      const gen = generation.current;
      const isWeather = src === 'weather';
      // Captured before a weather finish clears the source.
      const successProps = gpsProps();
      if (isWeather) finishWithLocation(src);

      void sdk.api.updateUserLocation({ lat, long, user_id: userId }).then((result) => {
        if (result.ok) {
          sdk.analytics.track(AnalyticsEvents.LOCATION_UPDATE_SUCCESS, successProps);
          if (result.data.country) {
            sdk.store.set(StorageKeys.USER_COUNTRY_NAME, result.data.country);
          }
          if (result.data.state) sdk.store.set(StorageKeys.USER_STATE, result.data.state);
          if (result.data.district) {
            sdk.store.set(StorageKeys.USER_DISTRICT, result.data.district);
          }
          saveLocation(lat, long);
          if (isWeather || generation.current !== gen) return;
          if (src === 'widget') emit({ kind: 'LocationUpdatedFromWidget' });
          finishWithLocation(src);
        } else {
          sdk.analytics.track(AnalyticsEvents.LOCATION_UPDATE_FAILURE, successProps);
          // App: Campaign / LocalContext / Settings dismiss; nothing is saved.
          if (isWeather || generation.current !== gen) return;
          dismiss();
        }
      });
    },
    [dismiss, emit, finishWithLocation, gpsProps, saveLocation, sdk],
  );

  // ------------------------------------------------------------------ fetch

  const enterFetchingLocation = useCallback(
    (attempt: number) => {
      const gen = generation.current;
      // Fetch-phase Location_Update_Triggered, screen_name overridden to the Dashboard screen.
      sdk.analytics.track(
        AnalyticsEvents.LOCATION_UPDATE_TRIGGERED,
        gpsProps(attempt + 1, { [PROP_SCREEN_NAME]: ScreenNames.HOME }),
      );
      set({ kind: 'FetchingLocation', attempt });
      if (attempt === 0) trackStep('fetching_location');

      void (async () => {
        let fix: { lat: number; long: number } | null = null;
        try {
          const loc = await withTimeout(
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
            FRESH_LOCATION_TIMEOUT_MS,
          );
          if (loc) fix = { lat: loc.coords.latitude, long: loc.coords.longitude };
        } catch {
          fix = null;
        }
        // After the retry the app falls back to the last-known fix.
        if (!fix && attempt >= 1) {
          try {
            const last = await withTimeout(
              Location.getLastKnownPositionAsync(),
              LAST_KNOWN_TIMEOUT_MS,
            );
            if (last) fix = { lat: last.coords.latitude, long: last.coords.longitude };
          } catch {
            fix = null;
          }
        }
        if (generation.current !== gen || stateRef.current.kind !== 'FetchingLocation') return;

        if (fix) {
          onLocationFetched(fix.lat, fix.long, attempt);
          return;
        }
        sdk.analytics.track(AnalyticsEvents.LOCATION_FETCH_FAILED_TIMEOUT, gpsProps(attempt + 1));
        if (attempt < 1) {
          enterFetchingLocation(attempt + 1);
          return;
        }
        // No error screen for a failed fix: end quietly and keep using IP-based location.
        continueWithoutLocation('location_failed_fallback');
      })();
    },
    // `enterFetchingLocation` recurses through its own binding, which is stable enough: every
    // dependency below is itself a stable useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [continueWithoutLocation, gpsProps, onLocationFetched, sdk, set, trackStep],
  );

  // ------------------------------------------------------------------ GPS services

  /**
   * RequestEnableGps. Android: when location services are off, `enableNetworkProviderAsync` is
   * the Play-Services resolution dialog (the app's SettingsClient prompt); accepted → fetch,
   * declined → the "declined" branch. iOS has no in-app resolution, so services off is
   * declined straight away.
   */
  const enterRequestEnableGps = useCallback(() => {
    const gen = generation.current;
    set({ kind: 'RequestEnableGps' });
    void (async () => {
      let enabled = false;
      try {
        enabled = await Location.hasServicesEnabledAsync();
      } catch {
        enabled = false;
      }
      if (!enabled && Platform.OS === 'android') {
        try {
          await Location.enableNetworkProviderAsync();
          enabled = await Location.hasServicesEnabledAsync();
        } catch {
          enabled = false;
        }
      }
      if (generation.current !== gen || stateRef.current.kind !== 'RequestEnableGps') return;
      if (enabled) {
        enterFetchingLocation(0);
        return;
      }
      sdk.analytics.track(AnalyticsEvents.LOCATION_FETCH_FAILED, gpsProps());
      if (sourceRef.current === 'weather') {
        continueWithoutLocation('gps_disabled_no_thanks');
        return;
      }
      set({ kind: 'Error', errorType: 'GpsUnavailable', canRetry: false });
    })();
  }, [continueWithoutLocation, enterFetchingLocation, gpsProps, sdk, set]);

  // ------------------------------------------------------------------ permission

  const enterRecovery = useCallback(() => {
    sdk.analytics.track(AnalyticsEvents.PERMISSION_FALLBACK_DEFAULT_SETTING_SHOWN, gpsProps(1));
    set({ kind: 'Recovery' });
  }, [gpsProps, sdk, set]);

  const onPermissionResult = useCallback(
    (granted: boolean, fromRecovery: boolean) => {
      const src = sourceRef.current;
      if (src === null) return;
      if (!granted) {
        const deny = denyCount() + 1;
        sdk.store.set(StorageKeys.PERMISSION_DENY_COUNT, deny);
        sdk.analytics.track(
          AnalyticsEvents.PERMISSION_DENIED,
          gpsProps(deny, { [PROP_PERMISSION_TYPE]: 'Location' }),
        );
        sdk.analytics.track(AnalyticsEvents.LOCATION_PERMISSION_DENY, gpsProps(deny));
        // The 2nd deny escalates to the Recovery sheet, for every source.
        if (deny >= 2) {
          enterRecovery();
          return;
        }
        // Do not block app usage: carry on with IP-based location.
        continueWithoutLocation('permission_denied');
        return;
      }

      sdk.analytics.track(
        AnalyticsEvents.PERMISSION_GRANTED,
        gpsProps(1, { [PROP_PERMISSION_TYPE]: 'Location' }),
      );
      sdk.analytics.track(AnalyticsEvents.LOCATION_PERMISSION_ALLOW, gpsProps(1));
      sdk.store.set(StorageKeys.PERMISSION_DENY_COUNT, 0);

      if (fromRecovery && hasKnownLocation()) {
        // A SUCCESS reason (`isLocationObtained`): the farmer granted it in Settings and a fix
        // is already stored.
        continueWithoutLocation('post_settings_preference_exists');
        return;
      }
      if (fromRecovery && src === 'weather') {
        set({ kind: 'Interstitial' });
        return;
      }
      enterRequestEnableGps();
    },
    [
      continueWithoutLocation,
      denyCount,
      enterRecovery,
      enterRequestEnableGps,
      gpsProps,
      hasKnownLocation,
      sdk,
      set,
    ],
  );

  /**
   * RequestPermission: `Permission_popup_shown` + `location_permission_prompt_triggered` (both
   * Attempt 1), then the system dialog. A dialog that fails to launch counts as a deny.
   */
  const enterRequestPermission = useCallback(() => {
    const gen = generation.current;
    sdk.analytics.track(
      AnalyticsEvents.PERMISSION_POPUP_SHOWN,
      gpsProps(1, { [PROP_PERMISSION_TYPE]: 'Location' }),
    );
    sdk.analytics.track(AnalyticsEvents.LOCATION_PERMISSION_PROMPT_TRIGGERED, gpsProps(1));
    set({ kind: 'RequestPermission' });
    void (async () => {
      let granted = false;
      try {
        granted = isFineGrant(await Location.requestForegroundPermissionsAsync());
      } catch {
        granted = false;
      }
      if (generation.current !== gen || stateRef.current.kind !== 'RequestPermission') return;
      onPermissionResult(granted, false);
    })();
  }, [gpsProps, onPermissionResult, sdk, set]);

  // ------------------------------------------------------------------ trigger

  /** The app's `trigger()` decision tree — see the module doc. */
  const trigger = useCallback(
    (src: LocationPromptSource) => {
      if (!isOnline()) {
        generation.current += 1;
        setSource(src);
        set({ kind: 'Error', errorType: 'NoNetwork', canRetry: true });
        return;
      }
      // Already enabled once: only the Weather entry no-ops. Campaign has its own gating, and a
      // manual tap on the pill / chip / Settings row is an explicit request to refresh.
      if (src === 'weather' && hasKnownLocation()) {
        executePendingNavigation();
        return;
      }

      generation.current += 1;
      const gen = generation.current;
      setSource(src);
      starting.current = true;

      void (async () => {
        const hasPermission = await readLocationPermission();
        if (generation.current !== gen) return;
        const deny = denyCount();
        if (deny >= 2 && !hasPermission) {
          enterRecovery();
          return;
        }
        // App trigger(): screen_name Home, Attempt = deny count + 1 clamped to 1..2, as a string.
        sdk.analytics.track(
          AnalyticsEvents.LOCATION_UPDATE_TRIGGERED,
          gpsProps(undefined, {
            [PROP_SCREEN_NAME]: ScreenNames.HOME,
            [PROP_ATTEMPT]: String(Math.min(Math.max(deny + 1, 1), 2)),
          }),
        );
        const hasFix = hasKnownLocation();
        const skipInterstitial =
          hasPermission || src === 'widget' || src === 'localContext' || src === 'settings';
        if (hasPermission && hasFix) {
          enterRequestEnableGps();
        } else if (hasPermission && src === 'weather') {
          set({ kind: 'Interstitial' });
          trackStep('interstitial_shown');
        } else if (hasPermission && src === 'widget') {
          enterRequestEnableGps();
        } else if (skipInterstitial) {
          enterRequestPermission();
        } else {
          set({ kind: 'Interstitial' });
          trackStep('interstitial_shown');
        }
      })();
    },
    [
      denyCount,
      enterRecovery,
      enterRequestEnableGps,
      enterRequestPermission,
      executePendingNavigation,
      gpsProps,
      hasKnownLocation,
      sdk,
      set,
      setSource,
      trackStep,
    ],
  );

  const triggerFromWeather = useCallback(
    (onLocationReady: () => void) => {
      agenticChipOrigin.current = false;
      pendingNavigation.current = onLocationReady;
      trigger('weather');
    },
    [trigger],
  );

  const triggerFromWidget = useCallback(() => {
    agenticChipOrigin.current = false;
    pendingNavigation.current = null;
    trigger('widget');
  }, [trigger]);

  const triggerFromLocalContext = useCallback(
    (fromAgenticChip: boolean = false) => {
      agenticChipOrigin.current = fromAgenticChip;
      pendingNavigation.current = null;
      trigger('localContext');
    },
    [trigger],
  );

  const triggerFromSettings = useCallback(() => {
    agenticChipOrigin.current = false;
    pendingNavigation.current = null;
    trigger('settings');
  }, [trigger]);

  // ------------------------------------------------------------------ UI actions

  const shareLocation = useCallback(() => {
    if (stateRef.current.kind !== 'Interstitial') return;
    trackStep('share_clicked');
    enterRequestPermission();
  }, [enterRequestPermission, trackStep]);

  const skip = useCallback(() => {
    trackStep('skipped');
    continueWithoutLocation('skip');
  }, [continueWithoutLocation, trackStep]);

  const onErrorCta = useCallback(() => {
    const s = stateRef.current;
    if (s.kind !== 'Error') return;
    const src = sourceRef.current;
    if (s.canRetry && src !== null) {
      trigger(src);
    } else {
      dismiss();
    }
  }, [dismiss, trigger]);

  const openRecoverySettings = useCallback(() => {
    sdk.analytics.track(
      AnalyticsEvents.PERMISSION_FALLBACK_DEFAULT_SETTING_CLICKED,
      gpsProps(1, { [PROP_PERMISSION_TYPE]: 'Location' }),
    );
    void Linking.openSettings().catch(() => undefined);
  }, [gpsProps, sdk]);

  const closeRecovery = useCallback(
    (reason: 'recovery_closed' | 'recovery_dismissed') => {
      sdk.analytics.track(
        AnalyticsEvents.PERMISSION_FALLBACK_DEFAULT_SETTING_CANCELED,
        gpsProps(1, { [PROP_PERMISSION_TYPE]: 'Location' }),
      );
      continueWithoutLocation(reason);
    },
    [continueWithoutLocation, gpsProps, sdk],
  );

  /**
   * App returns to the foreground while the Recovery sheet is up: the farmer may have granted the
   * permission in system Settings. Campaign resumes the flow; every other source goes back to the
   * interstitial so the farmer re-confirms with "Share Location".
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status !== 'active' || stateRef.current.kind !== 'Recovery') return;
      const gen = generation.current;
      void readLocationPermission().then((granted) => {
        if (!granted || generation.current !== gen) return;
        if (stateRef.current.kind !== 'Recovery') return;
        if (sourceRef.current === 'widget') {
          onPermissionResult(true, true);
        } else {
          set({ kind: 'Interstitial' });
        }
      });
    });
    return () => sub.remove();
  }, [onPermissionResult, set]);

  const addEventListener = useCallback(
    (listener: (event: LocationPromptEvent) => void) => {
      listeners.current.add(listener);
      return () => {
        listeners.current.delete(listener);
      };
    },
    [],
  );

  return {
    state,
    source,
    triggerFromWeather,
    triggerFromWidget,
    triggerFromLocalContext,
    triggerFromSettings,
    shareLocation,
    skip,
    cancel,
    continueWithoutLocation,
    dismiss,
    onErrorCta,
    openRecoverySettings,
    closeRecovery,
    clearState,
    isIdle,
    isOnline,
    hasLocationPermission: readLocationPermission,
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
