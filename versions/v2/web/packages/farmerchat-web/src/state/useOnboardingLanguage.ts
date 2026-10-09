/**
 * Language onboarding state machine — port of OnboardingSharedViewModel +
 * splash/udf OnboardingAction/OnboardingState (docs/01 §3.1/§3.2).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SdkServices } from '../core/services';
import { PrefKeys } from '../core/storage';
import type { GeoResponse, SupportedLanguage, SupportedLanguageGroup } from '../core/types';
import { UiState, idle, loading } from './uiState';
import { toUiState } from './helpers';
import { Events } from '../core/analytics';
import { isResolved, resolveCountryCode, resolveFallbackCoordinates } from '../core/fallbackLocation';

export interface OnboardingLanguageState {
  geoState: UiState<GeoResponse>;
  guestInitState: UiState<unknown>;
  languageState: UiState<SupportedLanguageGroup[]>;
  expandedLanguages: boolean;
  selectedLanguageId: number | null;
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

const initialState: OnboardingLanguageState = {
  geoState: idle(),
  guestInitState: idle(),
  languageState: idle(),
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

export interface OnboardingLanguageActions {
  bootstrap: () => Promise<void>;
  fetchSupportedLanguages: (countryCode: string, state: string) => Promise<void>;
  selectLanguage: (language: SupportedLanguage) => Promise<void>;
  toggleExpanded: () => void;
  fetchLegalLinks: () => Promise<void>;
  getStartedClicked: () => Promise<void>;
  consumeLanguageResult: () => void;
  consumeErrorNavigation: () => void;
  resetState: () => void;
}

export function useOnboardingLanguage(services: SdkServices): [OnboardingLanguageState, OnboardingLanguageActions] {
  const [state, setState] = useState<OnboardingLanguageState>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const { api, session, store, labels, analytics, config } = services;

  const patch = useCallback((p: Partial<OnboardingLanguageState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  const fetchSupportedLanguages = useCallback(
    async (countryCode: string, regionState: string) => {
      patch({ languageState: loading() });
      const res = await api.getSupportedLanguages(countryCode, regionState);
      if (!res.ok && res.isNetworkError) {
        // Spec 3.2: language list errors keep the spinner and silently retry once.
        const retry = await api.getSupportedLanguages(countryCode, regionState);
        patch({ languageState: toUiState(retry) });
        return;
      }
      patch({ languageState: toUiState(res) });
    },
    [api, patch],
  );

  /** FetchGeoLocation → guest init (with coords) → FetchSupportedLanguages. */
  const bootstrap = useCallback(async () => {
    patch({ guestInitState: loading() });
    let lat: number | null = null;
    let lng: number | null = null;
    let accuracy: number | null = null;

    // The three host-overridable knobs, all "unset → derive from the device locale" by default.
    const fallbackConfig = {
      defaultCountryCode: config.defaultCountryCode,
      defaultLatitude: config.defaultLatitude,
      defaultLongitude: config.defaultLongitude,
    };

    if (config.geoApiKey) {
      patch({ geoState: loading() });
      const geo = await api.geolocate();
      patch({ geoState: toUiState(geo) });
      if (geo.ok && geo.data.location) {
        lat = geo.data.location.lat;
        lng = geo.data.location.lng;
        accuracy = geo.data.accuracy ?? null;
      }
    }

    if (lat === null || lng === null) {
      // GEO-FAILURE FALLBACK (port of OnboardingSharedViewModel's ApiResult.Error branch).
      // geolocate is a tolerated P1 failure — and on web it may never have been called at all,
      // when the host configured no `geoApiKey`. Either way the app does NOT then proceed with no
      // coordinates: it falls back to the DEVICE LOCALE's country centroid
      // (`CountryLatLngProvider.getLatLngFromDeviceLocale`) and accepts it ONLY when
      // `lat != 0 && lng != 0`. A browser language such as plain `en` carries no region and
      // yields (0, 0), which must stay unresolved — sending it would place the farmer in the
      // Gulf of Guinea. `geoState` is deliberately left untouched here: a call that was never
      // made is not a failed call.
      const fallback = resolveFallbackCoordinates(fallbackConfig);
      if (isResolved(fallback.lat, fallback.lng)) {
        lat = fallback.lat;
        lng = fallback.lng;
        accuracy = 0;
      }
    }

    const init = await session.ensureGuestSession({ lat, long: lng, accuracy });
    if (init && !init.ok) {
      patch({
        guestInitState: toUiState(init),
        shouldNavigateToError: true,
        errorIsNetworkError: init.isNetworkError || init.isTimeout,
        errorFromScreen: 'language',
      });
      return;
    }
    patch({ guestInitState: { status: 'success', data: init?.ok ? init.data : null } });

    // Endpoint #2 400s on a blank `country_code` (`{"error": "Country code is required"}`,
    // verified live 2026-09-03 on prod), and a fresh guest on an unresolvable IP comes back with
    // country_code == null (so nothing was persisted). Chain: server → persisted → host config
    // (when non-blank) → device-locale region → LAST_RESORT_COUNTRY_CODE. Never ''.
    const initData = init?.ok ? init.data : null;
    const countryCode = resolveCountryCode(
      initData?.country_code,
      store.getString(PrefKeys.USER_COUNTRY_CODE),
      config.defaultCountryCode,
    );
    // `state` is inert on every environment (verified live 2026-09-03) and defaults to '',
    // so no region is invented to pair with a derived country.
    const regionState =
      initData?.state?.trim() ||
      store.getString(PrefKeys.USER_STATE)?.trim() ||
      config.defaultStateCode;
    // GUEST HOME FIX: endpoint #12 returns an EMPTY feed until the backend has a resolved
    // location, and it resolves one ONLY from coordinates (a country name alone is rejected,
    // verified live 2026-09-01). Without this a guest the backend cannot place by IP lands on a
    // permanently blank home screen. Best-effort — a failure just leaves the feed empty.
    if (!initData?.country_code?.trim() && session.userId) {
      const seed = resolveFallbackCoordinates(fallbackConfig);
      // Nothing resolved — not the host's config, not the device locale. Send NOTHING rather
      // than guess: an unplaceable guest gets an empty feed, which is honest, where a guessed
      // city would silently give them another country's advice. (This is where the SDK used to
      // post a hardcoded Bengaluru for every such guest on earth.)
      if (isResolved(seed.lat, seed.lng)) {
        const seeded = await api.updateUserLocation({
          user_id: session.userId,
          lat: seed.lat,
          long: seed.lng,
        });
        if (seeded.ok) {
          // Same persistence the GPS path uses (useLocationPrompt): the response carries display
          // names, not codes, so USER_COUNTRY_CODE is deliberately not written here.
          if (seeded.data.country) store.setString(PrefKeys.USER_COUNTRY_NAME, seeded.data.country);
          if (seeded.data.state) store.setString(PrefKeys.USER_STATE, seeded.data.state);
        }
      }
    }

    await fetchSupportedLanguages(countryCode, regionState);
  }, [
    api,
    config.geoApiKey,
    config.defaultCountryCode,
    config.defaultStateCode,
    config.defaultLatitude,
    config.defaultLongitude,
    fetchSupportedLanguages,
    patch,
    session,
    store,
  ]);

  /** SelectLanguage — per-row label fetch (debounced by the disabled row UI). */
  const selectLanguage = useCallback(
    async (language: SupportedLanguage) => {
      if (stateRef.current.fetchingLabelsForId !== null) return;
      patch({ isFetchingLabels: true, fetchingLabelsForId: language.id });
      const res = await api.getLabels(language.id);
      if (res.ok) {
        labels.setLabels(res.data);
        if (language.code) labels.setLanguageCode(language.code);
        store.setInt(PrefKeys.SELECTED_LANGUAGE_ID, language.id);
        // App OnboardingSharedViewModel: persisted on language selection, default true.
        store.setBool(PrefKeys.STREAMING_REQUIRED, language.streaming_required ?? true);
        if (language.display_name ?? language.name) {
          store.setString(PrefKeys.SELECTED_LANGUAGE_DISPLAY_NAME, language.display_name ?? language.name ?? '');
        }
        patch({
          selectedLanguageId: language.id,
          languageCode: language.code ?? null,
          labelsRefreshToken: stateRef.current.labelsRefreshToken + 1,
          isFetchingLabels: false,
          fetchingLabelsForId: null,
        });
      } else {
        patch({
          isFetchingLabels: false,
          fetchingLabelsForId: null,
          submitErrorMessage: res.message,
        });
      }
    },
    [analytics, api, labels, patch, store],
  );

  /**
   * Auto-select the first language when nothing is chosen (app parity:
   * `OnboardingSharedViewModel.kt:597-609`).
   *
   * The app resolves a selection the moment `get_languages` succeeds — persisted/config first,
   * else `allLanguages.first()` — then applies it and fetches ITS labels. Web preselected nothing
   * at all, so a fresh visitor got no radio selected, a disabled "Get started", and the entire
   * screen in English even when their region resolved to another language. Verified as a real
   * regression on android by a side-by-side device comparison (docs/04, 2026-09-08) and fixed
   * there in core; this is the same omission on web.
   *
   * Written as an effect rather than a call inside `fetchSupportedLanguages` because
   * `selectLanguage` is declared after it — an effect also keeps it correct when the list arrives
   * from the silent retry. `autoSelectedRef` makes it fire once per mount, so it never fights a
   * farmer who then picks a different language (which would re-run the label fetch).
   */
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (autoSelectedRef.current) return;
    if (state.selectedLanguageId !== null) return;
    if (state.languageState.status !== 'success') return;
    const groups = state.languageState.data;
    const first =
      groups.flatMap((g) => g.priority_view ?? [])[0] ??
      groups.flatMap((g) => g.expanded_view ?? [])[0];
    if (!first) return;
    // A persisted language wins over the first one, matching the app's precedence.
    const storedId = store.getInt(PrefKeys.SELECTED_LANGUAGE_ID);
    const all = groups.flatMap((g) => [...(g.priority_view ?? []), ...(g.expanded_view ?? [])]);
    const preferred = (storedId ? all.find((l) => l.id === storedId) : undefined) ?? first;
    autoSelectedRef.current = true;
    void selectLanguage(preferred);
  }, [state.languageState, state.selectedLanguageId, selectLanguage, store]);

  const fetchLegalLinks = useCallback(async () => {
    const res = await api.getPrivacyPolicy();
    if (res.ok) {
      patch({
        privacyPolicyUrl: res.data.privacy_policy_url ?? res.data.privacy_policy ?? null,
        termsOfUseUrl: res.data.terms_of_use_url ?? res.data.terms_of_use ?? null,
      });
    }
  }, [api, patch]);

  /** GetStartedClicked + AcceptTerms: set language → accept T&C → done. */
  const getStartedClicked = useCallback(async () => {
    const s = stateRef.current;
    if (s.selectedLanguageId === null || s.isSubmittingLanguage) return;
    patch({ isSubmittingLanguage: true, submitErrorMessage: null });
    analytics.track(Events.WELCOME_SCREEN_GET_STARTED_BUTTON_CLICK, { language_id: s.selectedLanguageId });
    analytics.track(Events.SAVE_LANGUAGE_CLICK, { language_id: s.selectedLanguageId });

    const userId = session.userId ?? '';
    const setRes = await api.setPreferredLanguage({ user_id: userId, language_id: s.selectedLanguageId });
    if (!setRes.ok) {
      patch({
        isSubmittingLanguage: false,
        submitErrorMessage: setRes.message,
        shouldNavigateToError: setRes.isNetworkError || setRes.isTimeout,
        errorIsNetworkError: setRes.isNetworkError || setRes.isTimeout,
        errorFromScreen: 'language',
      });
      return;
    }

    const termsRes = await api.acceptTerms({ user_id: userId });
    if (!termsRes.ok) {
      patch({
        isSubmittingLanguage: false,
        submitErrorMessage: termsRes.message,
        shouldNavigateToError: termsRes.isNetworkError || termsRes.isTimeout,
        errorIsNetworkError: termsRes.isNetworkError || termsRes.isTimeout,
        errorFromScreen: 'language',
      });
      return;
    }
    store.setBool(PrefKeys.ACCEPT_TERMS_DONE, true);
    store.setBool(PrefKeys.LANGUAGE_DONE, true);
    analytics.track(Events.ONBOARDING_COMPLETED_STEP1, {});
    patch({ isSubmittingLanguage: false, languageSubmitSuccess: true });
  }, [analytics, api, patch, session, store]);

  const toggleExpanded = useCallback(() => {
    setState((s) => ({ ...s, expandedLanguages: !s.expandedLanguages }));
  }, []);

  const consumeLanguageResult = useCallback(() => {
    patch({ languageSubmitSuccess: false, submitErrorMessage: null });
  }, [patch]);

  const consumeErrorNavigation = useCallback(() => {
    patch({ shouldNavigateToError: false });
  }, [patch]);

  const resetState = useCallback(() => {
    setState(initialState);
  }, []);

  return [
    state,
    {
      bootstrap,
      fetchSupportedLanguages,
      selectLanguage,
      toggleExpanded,
      fetchLegalLinks,
      getStartedClicked,
      consumeLanguageResult,
      consumeErrorNavigation,
      resetState,
    },
  ];
}
