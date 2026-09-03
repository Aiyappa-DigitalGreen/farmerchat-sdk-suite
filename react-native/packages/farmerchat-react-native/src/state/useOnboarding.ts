/**
 * useOnboarding — port of `OnboardingSharedViewModel` + splash/language UDF
 * (docs/01 §3.1/§3.2: OnboardingAction / OnboardingState).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { UiStates, type UiState } from '../core/apiResult';
import { AnalyticsEvents } from '../core/analytics';
import { resolveCountryCode, resolveFallbackCoordinates } from '../core/config';
import { isResolved } from '../core/countryLatLng';
import type { FarmerChatSdk } from '../core/sdk';
import { StorageKeys } from '../core/sessionStore';
import type {
  GeoResponse,
  InitializeGuestUserResponse,
  SupportedLanguage,
  SupportedLanguageGroup,
} from '../core/types';

export type OnboardingAction =
  | { type: 'FetchGeoLocation'; fromScreen: string }
  | { type: 'ConsumeGeoResult' }
  | { type: 'FetchSupportedLanguages'; countryCode: string; state?: string | null }
  | { type: 'SelectLanguage'; languageId: number }
  | { type: 'ApplyLanguageFromModal'; languageId: number; languageCode: string }
  | { type: 'FetchLegalLinks' }
  | { type: 'GetStartedClicked' }
  | { type: 'AcceptTerms' }
  | { type: 'ConsumeLanguageResult' }
  | { type: 'ConsumeErrorNavigation' }
  | { type: 'ResetState' };

export interface OnboardingState {
  geoState: UiState<GeoResponse>;
  guestInitState: UiState<InitializeGuestUserResponse>;
  languageState: UiState<SupportedLanguageGroup[]>;
  expandedLanguages: boolean;
  selectedLanguageId: number | null;
  /** Kept as `langauge_code` in the app UDF (typo preserved in spec). */
  languageCode: string | null;
  labelsRefreshToken: number;
  isFetchingLabels: boolean;
  fetchingLabelsForId: number | null;
  isApplyingLanguageFromModal: boolean;
  privacyPolicyUrl: string | null;
  termsOfUseUrl: string | null;
  isSubmittingLanguage: boolean;
  languageSubmitSuccess: boolean;
  submitErrorMessage: string | null;
  shouldNavigateToError: boolean;
  errorIsNetworkError: boolean;
  errorFromScreen: string;
}

const initialState: OnboardingState = {
  geoState: UiStates.idle(),
  guestInitState: UiStates.idle(),
  languageState: UiStates.idle(),
  expandedLanguages: false,
  selectedLanguageId: null,
  languageCode: null,
  labelsRefreshToken: 0,
  isFetchingLabels: false,
  fetchingLabelsForId: null,
  isApplyingLanguageFromModal: false,
  privacyPolicyUrl: null,
  termsOfUseUrl: null,
  isSubmittingLanguage: false,
  languageSubmitSuccess: false,
  submitErrorMessage: null,
  shouldNavigateToError: false,
  errorIsNetworkError: false,
  errorFromScreen: '',
};

export interface UseOnboardingResult {
  state: OnboardingState;
  dispatch: (action: OnboardingAction) => void;
  /** Flat helper for the screen: all languages of the current view. */
  visibleLanguages: (groups: SupportedLanguageGroup[]) => SupportedLanguage[];
  toggleExpanded: () => void;
}

export function useOnboarding(sdk: FarmerChatSdk): UseOnboardingResult {
  const [state, setState] = useState<OnboardingState>(initialState);
  const mounted = useRef(true);
  const selectSeq = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const patch = useCallback((partial: Partial<OnboardingState>) => {
    if (!mounted.current) return;
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const fail = useCallback(
    (fromScreen: string, isNetworkError: boolean, message: string | null) => {
      patch({
        shouldNavigateToError: true,
        errorIsNetworkError: isNetworkError,
        errorFromScreen: fromScreen,
        submitErrorMessage: message,
        isSubmittingLanguage: false,
      });
    },
    [patch],
  );

  const fetchSupportedLanguages = useCallback(
    async (countryCode: string, stateName?: string | null) => {
      patch({ languageState: UiStates.loading() });
      const result = await sdk.api.getSupportedLanguages(countryCode, stateName);
      if (result.ok) {
        patch({ languageState: UiStates.success(result.data) });
      } else {
        // App shows the spinner and silently retries on error (docs/01 §3.2);
        // we surface the Error state and let the screen re-dispatch.
        patch({
          languageState: UiStates.error(
            result.message ?? 'Could not load languages',
            result.code,
            result.isNetworkError || result.isTimeout,
          ),
        });
      }
    },
    [patch, sdk],
  );

  const bootstrapLanguages = useCallback(
    async (fromScreen: string) => {
      // Geolocate FIRST (P1, best-effort), then pass the coords into guest init — app parity
      // (fc-compose OnboardingSharedViewModel) and parity with android/ios/web.
      //
      // Order is load-bearing, not cosmetic: `initialize_user` resolves country/state from the
      // coords when present and only falls back to IP geolocation otherwise. Verified live
      // 2026-09-01 — guest init WITH lat/long comes back with a resolved country/state and a
      // 21-section home feed; WITHOUT them on an unresolvable IP it returns `country_code: null`
      // and `daily/` comes back `{"sections": []}`. (The country it echoes is whatever the
      // coordinates say — that run reported Karnataka only because the SDK was then sending
      // hardcoded Bengaluru coordinates, which is the bug this path no longer has.)
      // `ensureGuestSession` no-ops once a session exists, so a late geolocate can never repair
      // the first (and only) guest init.
      let lat: number | null = null;
      let lng: number | null = null;
      let accuracy: number | null = null;
      if (sdk.config.geoApiKey) {
        patch({ geoState: UiStates.loading() });
        const geo = await sdk.api.geolocate();
        if (geo.ok) {
          patch({ geoState: UiStates.success(geo.data) });
          lat = geo.data.location.lat;
          lng = geo.data.location.lng;
          accuracy = geo.data.accuracy ?? null;
          sdk.store.set(StorageKeys.FARMER_APP_LATITUDE, lat);
          sdk.store.set(StorageKeys.FARMER_APP_LONGITUDE, lng);
        } else {
          patch({ geoState: UiStates.error(geo.message ?? 'geo failed', geo.code, true) });
        }
      }

      // GEO FAILURE (or no `geoApiKey` at all) → DEVICE LOCALE, exactly as the app does. The app
      // does NOT proceed with no coordinates when IP geolocation fails: it falls back to the
      // device locale's country centroid (`CountryLatLngProvider.getLatLngFromDeviceLocale`) and
      // accepts it ONLY when `lat != 0.0 && lng != 0.0`. A locale carrying no region yields
      // (0, 0), which must stay unresolved — sending it would place the farmer off West Africa.
      //
      // Keyed on `lat === null` rather than on the error branch so it also covers a host that
      // configured no `geoApiKey`, where the geolocate call never ran at all.
      if (lat === null) {
        const [localeLat, localeLng] = resolveFallbackCoordinates(sdk.config);
        if (isResolved(localeLat, localeLng)) {
          lat = localeLat;
          lng = localeLng;
          accuracy = 0;
        }
      }

      patch({ guestInitState: UiStates.loading() });
      const init = await sdk.session.ensureGuestSession({ lat, long: lng, accuracy });
      // Endpoint #2 400s on a blank `country_code`, so the chain never yields one:
      // persisted → host config (when non-blank) → device-locale region → 'KE' last resort.
      // The init response overrides it below when it actually resolved one.
      let countryCode = resolveCountryCode(
        sdk.config,
        sdk.store.getString(StorageKeys.USER_COUNTRY_CODE),
      );
      let stateName =
        sdk.store.getString(StorageKeys.USER_STATE)?.trim() || sdk.config.defaultStateCode;
      if (init && !init.ok) {
        patch({ guestInitState: UiStates.fromResult(init, 'Could not start session') });
        fail(fromScreen, init.isNetworkError || init.isTimeout, init.message);
        return;
      }
      if (init && init.ok) {
        patch({ guestInitState: UiStates.success(init.data) });
        if (init.data.country_code?.trim()) countryCode = init.data.country_code;
        if (init.data.state?.trim()) stateName = init.data.state;
      } else {
        patch({ guestInitState: UiStates.idle() });
      }

      // GUEST HOME FIX: endpoint #12 returns an EMPTY feed until the backend has a resolved
      // location, and it resolves one ONLY from coordinates (a country name alone is rejected,
      // verified live 2026-09-01). Without this a guest the backend cannot place by IP lands on
      // a permanently blank home screen. Best-effort — a failure just leaves the feed empty.
      const resolvedCountry = init?.ok ? init.data.country_code?.trim() : null;
      const seedUserId = sdk.store.getString(StorageKeys.USER_ID);
      if (!resolvedCountry && seedUserId) {
        const [seedLat, seedLng] = resolveFallbackCoordinates(sdk.config);
        // Nothing resolved — not the host's config, not the device locale. Send NOTHING rather
        // than guess: an unplaceable guest gets an empty feed, which is honest, where a guessed
        // city would silently hand them another country's advice.
        if (isResolved(seedLat, seedLng)) {
          await sdk.api.updateUserLocation({
            user_id: seedUserId,
            lat: seedLat,
            long: seedLng,
          });
        }
      }

      await fetchSupportedLanguages(countryCode, stateName);
    },
    [fail, fetchSupportedLanguages, patch, sdk],
  );

  const fetchLabelsFor = useCallback(
    async (languageId: number, languageCode: string): Promise<boolean> => {
      const seq = ++selectSeq.current;
      patch({ isFetchingLabels: true, fetchingLabelsForId: languageId });
      const result = await sdk.api.getLabels(languageId);
      if (seq !== selectSeq.current) return false; // superseded by a newer selection
      if (result.ok) {
        sdk.store.set(StorageKeys.SELECTED_LANGUAGE_ID, languageId);
        sdk.store.set(StorageKeys.SELECTED_LANGUAGE_CODE, languageCode);
        sdk.labels.setLabels(result.data);
        patch({
          isFetchingLabels: false,
          fetchingLabelsForId: null,
          labelsRefreshToken: Date.now(),
        });
        return true;
      }
      patch({ isFetchingLabels: false, fetchingLabelsForId: null });
      return false;
    },
    [patch, sdk],
  );

  const submitLanguage = useCallback(async () => {
    const userId = sdk.session.userId;
    const languageId = sdk.store.getInt(StorageKeys.SELECTED_LANGUAGE_ID, -1);
    if (!userId || languageId < 0) {
      fail('language', false, 'No language selected');
      return;
    }
    patch({ isSubmittingLanguage: true, submitErrorMessage: null });
    const result = await sdk.api.setPreferredLanguage({
      user_id: userId,
      language_id: languageId,
    });
    if (result.ok) {
      sdk.store.set(StorageKeys.LANGUAGE_DONE, true);
      sdk.analytics.track(AnalyticsEvents.SAVE_LANGUAGE_CLICK, {
        language_id: languageId,
        language_code: sdk.store.getString(StorageKeys.SELECTED_LANGUAGE_CODE),
      });
      sdk.analytics.track(AnalyticsEvents.ONBOARDING_COMPLETED_STEP1, {});
      patch({ isSubmittingLanguage: false, languageSubmitSuccess: true });
    } else {
      fail('language', result.isNetworkError || result.isTimeout, result.message);
    }
  }, [fail, patch, sdk]);

  const acceptTerms = useCallback(async () => {
    const userId = sdk.session.userId;
    if (!userId) return;
    const result = await sdk.api.acceptTerms({ user_id: userId });
    if (result.ok) {
      sdk.store.set(StorageKeys.TERMS_ACCEPTED, true);
    }
  }, [sdk]);

  const fetchLegalLinks = useCallback(async () => {
    const result = await sdk.api.getPrivacyPolicy();
    if (result.ok) {
      patch({
        privacyPolicyUrl:
          result.data.privacy_policy_url ?? result.data.privacy_policy ?? null,
        termsOfUseUrl:
          result.data.terms_of_use_url ?? result.data.terms_of_use ?? null,
      });
    }
  }, [patch, sdk]);

  const dispatch = useCallback(
    (action: OnboardingAction) => {
      switch (action.type) {
        case 'FetchGeoLocation':
          void bootstrapLanguages(action.fromScreen);
          break;
        case 'ConsumeGeoResult':
          patch({ geoState: UiStates.idle() });
          break;
        case 'FetchSupportedLanguages':
          void fetchSupportedLanguages(action.countryCode, action.state);
          break;
        case 'SelectLanguage': {
          const groups =
            state.languageState.kind === 'success' ? state.languageState.data : [];
          const all = groups.flatMap((g) => [...g.priority_view, ...g.expanded_view]);
          const selected = all.find((l) => l.id === action.languageId);
          if (!selected) break;
          patch({ selectedLanguageId: action.languageId, languageCode: selected.code });
          sdk.store.set(StorageKeys.SELECTED_LANGUAGE_DISPLAY_NAME, selected.display_name);
          void fetchLabelsFor(selected.id, selected.code);
          break;
        }
        case 'ApplyLanguageFromModal':
          patch({
            isApplyingLanguageFromModal: true,
            selectedLanguageId: action.languageId,
            languageCode: action.languageCode,
          });
          void fetchLabelsFor(action.languageId, action.languageCode).then(() =>
            patch({ isApplyingLanguageFromModal: false }),
          );
          break;
        case 'FetchLegalLinks':
          void fetchLegalLinks();
          break;
        case 'GetStartedClicked':
          sdk.analytics.track(
            AnalyticsEvents.WELCOME_SCREEN_GET_STARTED_BUTTON_CLICK,
            {},
          );
          void submitLanguage();
          break;
        case 'AcceptTerms':
          void acceptTerms();
          break;
        case 'ConsumeLanguageResult':
          patch({ languageSubmitSuccess: false, submitErrorMessage: null });
          break;
        case 'ConsumeErrorNavigation':
          patch({ shouldNavigateToError: false });
          break;
        case 'ResetState':
          setState(initialState);
          break;
      }
    },
    [
      acceptTerms,
      bootstrapLanguages,
      fetchLabelsFor,
      fetchLegalLinks,
      fetchSupportedLanguages,
      patch,
      sdk,
      state.languageState,
      submitLanguage,
    ],
  );

  const visibleLanguages = useCallback(
    (groups: SupportedLanguageGroup[]): SupportedLanguage[] => {
      const priority = groups.flatMap((g) => g.priority_view);
      if (!state.expandedLanguages) return priority;
      const expanded = groups.flatMap((g) => g.expanded_view);
      const seen = new Set(priority.map((l) => l.id));
      return [...priority, ...expanded.filter((l) => !seen.has(l.id))];
    },
    [state.expandedLanguages],
  );

  const toggleExpanded = useCallback(() => {
    setState((prev) => ({ ...prev, expandedLanguages: !prev.expandedLanguages }));
  }, []);

  return { state, dispatch, visibleLanguages, toggleExpanded };
}
