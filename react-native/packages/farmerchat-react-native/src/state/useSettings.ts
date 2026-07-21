/**
 * useSettings — port of `SettingsViewModel` (`LanguageSettingsState`,
 * docs/01 §3.13 LanguageChooser) plus Help/FAQ data (docs/01 §3.12,
 * `GetHelpSupportUseCase`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { UiStates, type UiState } from '../core/apiResult';
import { AnalyticsEvents } from '../core/analytics';
import type { FarmerChatSdk } from '../core/sdk';
import { StorageKeys } from '../core/sessionStore';
import type { HelpSupportData, SupportedLanguageGroup } from '../core/types';

// ---------------------------------------------------------------------------
// Language chooser (Settings → Language)
// ---------------------------------------------------------------------------

export interface LanguageSettingsState {
  languageState: UiState<SupportedLanguageGroup[]>;
  expandedLanguages: boolean;
  selectedLanguageId: number | null;
  selectedLanguageCode: string | null;
  fetchingLabelsForId: number | null;
  isSubmitting: boolean;
  submitSuccess: boolean;
  submitErrorMessage: string | null;
  /** Set when the labels fetch fails after language change (→ onFetchLabelsFailure). */
  labelsFetchFailed: boolean;
}

const initialLanguageSettingsState: LanguageSettingsState = {
  languageState: UiStates.idle(),
  expandedLanguages: false,
  selectedLanguageId: null,
  selectedLanguageCode: null,
  fetchingLabelsForId: null,
  isSubmitting: false,
  submitSuccess: false,
  submitErrorMessage: null,
  labelsFetchFailed: false,
};

export interface UseLanguageSettingsResult {
  state: LanguageSettingsState;
  loadLanguages: () => void;
  selectLanguage: (id: number, code: string) => void;
  submitLanguage: () => void;
  consumeLanguageResult: () => void;
  toggleExpanded: () => void;
}

export function useLanguageSettings(sdk: FarmerChatSdk): UseLanguageSettingsResult {
  const [state, setState] = useState<LanguageSettingsState>(() => ({
    ...initialLanguageSettingsState,
    selectedLanguageId: sdk.store.getInt(StorageKeys.SELECTED_LANGUAGE_ID, -1) >= 0
      ? sdk.store.getInt(StorageKeys.SELECTED_LANGUAGE_ID, -1)
      : null,
    selectedLanguageCode: sdk.store.getString(StorageKeys.SELECTED_LANGUAGE_CODE),
  }));
  const mounted = useRef(true);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const patch = useCallback((partial: Partial<LanguageSettingsState>) => {
    if (!mounted.current) return;
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const loadLanguages = useCallback(() => {
    patch({ languageState: UiStates.loading() });
    const countryCode = sdk.store.getString(StorageKeys.USER_COUNTRY_CODE) ?? 'IN';
    const stateName = sdk.store.getString(StorageKeys.USER_STATE);
    void sdk.api.getSupportedLanguages(countryCode, stateName).then((result) => {
      if (!mounted.current) return;
      patch({
        languageState: UiStates.fromResult(result, 'Could not load languages'),
      });
    });
  }, [patch, sdk]);

  const selectLanguage = useCallback(
    (id: number, code: string) => {
      patch({
        selectedLanguageId: id,
        selectedLanguageCode: code,
        fetchingLabelsForId: id,
        labelsFetchFailed: false,
      });
      void sdk.api.getLabels(id).then((result) => {
        if (!mounted.current) return;
        if (result.ok) {
          sdk.store.set(StorageKeys.SELECTED_LANGUAGE_ID, id);
          sdk.store.set(StorageKeys.SELECTED_LANGUAGE_CODE, code);
          sdk.labels.setLabels(result.data);
          patch({ fetchingLabelsForId: null });
        } else {
          patch({ fetchingLabelsForId: null, labelsFetchFailed: true });
        }
      });
    },
    [patch, sdk],
  );

  const submitLanguage = useCallback(() => {
    const s = stateRef.current;
    const userId = sdk.session.userId;
    if (!userId || s.selectedLanguageId === null) return;
    patch({ isSubmitting: true, submitErrorMessage: null });
    void sdk.api
      .setPreferredLanguage({ user_id: userId, language_id: s.selectedLanguageId })
      .then((result) => {
        if (!mounted.current) return;
        if (result.ok) {
          sdk.analytics.track(AnalyticsEvents.SAVE_LANGUAGE_CLICK, {
            language_id: s.selectedLanguageId,
            language_code: s.selectedLanguageCode,
            from_screen: 'settings',
          });
          patch({ isSubmitting: false, submitSuccess: true });
        } else {
          patch({
            isSubmitting: false,
            submitErrorMessage:
              result.message ??
              sdk.labels.getLabel('language_save_failed', 'Could not save your language.'),
          });
        }
      });
  }, [patch, sdk]);

  const consumeLanguageResult = useCallback(() => {
    patch({ submitSuccess: false, submitErrorMessage: null, labelsFetchFailed: false });
  }, [patch]);

  const toggleExpanded = useCallback(() => {
    setState((prev) => ({ ...prev, expandedLanguages: !prev.expandedLanguages }));
  }, []);

  return {
    state,
    loadLanguages,
    selectLanguage,
    submitLanguage,
    consumeLanguageResult,
    toggleExpanded,
  };
}

// ---------------------------------------------------------------------------
// Help / FAQ (docs/01 §3.12)
// ---------------------------------------------------------------------------

export interface UseHelpResult {
  helpState: UiState<HelpSupportData>;
  reload: () => void;
}

export function useHelp(sdk: FarmerChatSdk): UseHelpResult {
  const [helpState, setHelpState] = useState<UiState<HelpSupportData>>(
    UiStates.idle(),
  );
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(() => {
    setHelpState(UiStates.loading());
    const lang = sdk.store.getString(StorageKeys.SELECTED_LANGUAGE_CODE) ?? 'en';
    const country = sdk.store.getString(StorageKeys.USER_COUNTRY_CODE);
    void sdk.api
      .getHelpSupport({ lang, limit: 5, theme: null, country })
      .then((result) => {
        if (!mounted.current) return;
        if (result.ok && result.data.data) {
          setHelpState(UiStates.success(result.data.data));
        } else if (result.ok) {
          setHelpState(UiStates.success({ faqs: [] }));
        } else {
          setHelpState(
            UiStates.error(
              result.message ?? 'Could not load help content',
              result.code,
              result.isNetworkError || result.isTimeout,
            ),
          );
        }
      });
  }, [sdk]);

  return { helpState, reload };
}
