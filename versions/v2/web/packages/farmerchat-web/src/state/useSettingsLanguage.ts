/**
 * SettingsViewModel port — LanguageSettingsState for Settings → Language
 * (docs/01 §3.13). Same machine as onboarding language, plus submit-with-toast.
 */

import { useCallback, useRef, useState } from 'react';
import type { SdkServices } from '../core/services';
import { PrefKeys } from '../core/storage';
import type { SupportedLanguage, SupportedLanguageGroup } from '../core/types';
import { UiState, idle, loading } from './uiState';
import { toUiState } from './helpers';
import { resolveCountryCode } from '../core/fallbackLocation';
import { Events } from '../core/analytics';

export interface LanguageSettingsState {
  languageState: UiState<SupportedLanguageGroup[]>;
  expandedLanguages: boolean;
  selectedLanguageId: number | null;
  selectedLanguageCode: string | null;
  selectedLanguageDisplayName: string | null;
  fetchingLabelsForId: number | null;
  isSubmitting: boolean;
  submitSuccess: boolean;
  submitErrorMessage: string | null;
  labelsFetchFailed: boolean;
}

const initialState: LanguageSettingsState = {
  languageState: idle(),
  expandedLanguages: false,
  selectedLanguageId: null,
  selectedLanguageCode: null,
  selectedLanguageDisplayName: null,
  fetchingLabelsForId: null,
  isSubmitting: false,
  submitSuccess: false,
  submitErrorMessage: null,
  labelsFetchFailed: false,
};

export interface LanguageSettingsActions {
  loadLanguages: () => Promise<void>;
  selectLanguage: (language: SupportedLanguage) => Promise<void>;
  toggleExpanded: () => void;
  submitLanguage: () => Promise<void>;
  consumeLanguageResult: () => void;
}

export function useSettingsLanguage(services: SdkServices): [LanguageSettingsState, LanguageSettingsActions] {
  const [state, setState] = useState<LanguageSettingsState>(() => ({
    ...initialState,
    selectedLanguageId: services.store.getInt(PrefKeys.SELECTED_LANGUAGE_ID),
    selectedLanguageCode: services.store.getString(PrefKeys.SELECTED_LANGUAGE_CODE),
  }));
  const stateRef = useRef(state);
  stateRef.current = state;
  const { api, session, store, labels, analytics, config } = services;

  const patch = useCallback((p: Partial<LanguageSettingsState>) => setState((s) => ({ ...s, ...p })), []);

  const loadLanguages = useCallback(async () => {
    patch({ languageState: loading() });
    // Same chain as onboarding: endpoint #2 400s on a blank `country_code`, and the store is
    // empty whenever guest init never resolved one — persisted → host config (when non-blank) →
    // device-locale region → LAST_RESORT_COUNTRY_CODE.
    const countryCode = resolveCountryCode(
      null,
      store.getString(PrefKeys.USER_COUNTRY_CODE),
      config.defaultCountryCode,
    );
    const regionState =
      store.getString(PrefKeys.USER_STATE)?.trim() || config.defaultStateCode;
    const res = await api.getSupportedLanguages(countryCode, regionState);
    patch({ languageState: toUiState(res) });
  }, [api, config.defaultCountryCode, config.defaultStateCode, patch, store]);

  const selectLanguage = useCallback(
    async (language: SupportedLanguage) => {
      if (stateRef.current.fetchingLabelsForId !== null) return;
      patch({ fetchingLabelsForId: language.id, labelsFetchFailed: false });
      const res = await api.getLabels(language.id);
      if (res.ok) {
        labels.setLabels(res.data);
        patch({
          selectedLanguageId: language.id,
          selectedLanguageCode: language.code ?? null,
          selectedLanguageDisplayName: language.display_name ?? null,
          fetchingLabelsForId: null,
        });
      } else {
        patch({ fetchingLabelsForId: null, labelsFetchFailed: true });
      }
    },
    [api, labels, patch],
  );

  const toggleExpanded = useCallback(() => {
    setState((s) => ({ ...s, expandedLanguages: !s.expandedLanguages }));
  }, []);

  const submitLanguage = useCallback(async () => {
    const s = stateRef.current;
    if (s.selectedLanguageId === null || s.isSubmitting) return;
    patch({ isSubmitting: true, submitErrorMessage: null });
    const res = await api.setPreferredLanguage({
      user_id: session.userId ?? '',
      language_id: s.selectedLanguageId,
    });
    if (res.ok) {
      store.setInt(PrefKeys.SELECTED_LANGUAGE_ID, s.selectedLanguageId);
      if (s.selectedLanguageCode) labels.setLanguageCode(s.selectedLanguageCode);
      // App parity: persist the display name so the drawer's "Language: X" line
      // updates (previously only id/code were saved → stale drawer).
      if (s.selectedLanguageDisplayName) {
        store.setString(PrefKeys.SELECTED_LANGUAGE_DISPLAY_NAME, s.selectedLanguageDisplayName);
      }
      analytics.track(Events.SAVE_LANGUAGE_CLICK, {
        language_code: s.selectedLanguageCode ?? '',
      });
      patch({ isSubmitting: false, submitSuccess: true });
    } else {
      patch({ isSubmitting: false, submitErrorMessage: res.message });
    }
  }, [analytics, api, labels, patch, session, store]);

  const consumeLanguageResult = useCallback(() => {
    patch({ submitSuccess: false, submitErrorMessage: null });
  }, [patch]);

  return [state, { loadLanguages, selectLanguage, toggleExpanded, submitLanguage, consumeLanguageResult }];
}
