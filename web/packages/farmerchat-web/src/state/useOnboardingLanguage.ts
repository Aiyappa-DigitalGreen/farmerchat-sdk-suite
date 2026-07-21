/**
 * Language onboarding state machine — port of OnboardingSharedViewModel +
 * splash/udf OnboardingAction/OnboardingState (docs/01 §3.1/§3.2).
 */

import { useCallback, useRef, useState } from 'react';
import type { SdkServices } from '../core/services';
import { PrefKeys } from '../core/storage';
import type { GeoResponse, SupportedLanguage, SupportedLanguageGroup } from '../core/types';
import { UiState, idle, loading } from './uiState';
import { toUiState } from './helpers';
import { Events } from '../core/analytics';

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

    const countryCode = store.getString(PrefKeys.USER_COUNTRY_CODE) ?? '';
    const regionState = store.getString(PrefKeys.USER_STATE) ?? '';
    await fetchSupportedLanguages(countryCode, regionState);
  }, [api, config.geoApiKey, fetchSupportedLanguages, patch, session, store]);

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
