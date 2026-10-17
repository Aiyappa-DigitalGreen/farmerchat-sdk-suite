/**
 * useSettings — port of `SettingsViewModel` (`LanguageSettingsState`,
 * docs/01 §3.13 LanguageChooser) plus Help/FAQ data (docs/01 §3.12,
 * `GetHelpSupportUseCase`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { UiStates, type UiState } from '../core/apiResult';
import { AnalyticsEvents } from '../core/analytics';
import { resolveCountryCode } from '../core/config';
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
  /** The picked language's streaming_required, saved with it (app SettingsViewModel). */
  selectedStreamingRequired: boolean;
  /** The picked language's display name, stored on Save (drawer "Language: X"). */
  selectedDisplayName: string | null;
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
  selectedStreamingRequired: true,
  selectedDisplayName: null,
  fetchingLabelsForId: null,
  isSubmitting: false,
  submitSuccess: false,
  submitErrorMessage: null,
  labelsFetchFailed: false,
};

export interface UseLanguageSettingsResult {
  state: LanguageSettingsState;
  loadLanguages: () => void;
  selectLanguage: (
    id: number,
    code: string,
    displayName?: string,
    streamingRequired?: boolean | null,
  ) => void;
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
    // Seeded from the stored flag so re-saving the current language keeps it.
    selectedStreamingRequired: sdk.store.getBoolean(StorageKeys.STREAMING_REQUIRED, true),
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
    // Same chain as onboarding: endpoint #2 400s on a blank `country_code`, and the store is
    // empty whenever guest init never resolved one — so fall through host config → device-locale
    // region → 'KE' last resort rather than sending a blank (or an invented 'IN').
    const countryCode = resolveCountryCode(
      sdk.config,
      sdk.store.getString(StorageKeys.USER_COUNTRY_CODE),
    );
    const stateName =
      sdk.store.getString(StorageKeys.USER_STATE)?.trim() || sdk.config.defaultStateCode;
    void sdk.api.getSupportedLanguages(countryCode, stateName).then((result) => {
      if (!mounted.current) return;
      patch({
        languageState: UiStates.fromResult(result, 'Could not load languages'),
      });
    });
  }, [patch, sdk]);

  /**
   * A row tap only SELECTS (app SettingsViewModel: the radio moves, nothing else). Labels, the
   * stored language and the UI language change on Save — tapping a row and going Back leaves the
   * old language in place (Android scenario pass, 2026-10-17).
   */
  const selectLanguage = useCallback(
    (id: number, code: string, displayName?: string, streamingRequired?: boolean | null) => {
      patch({
        selectedLanguageId: id,
        selectedLanguageCode: code,
        selectedDisplayName: displayName ?? null,
        selectedStreamingRequired: streamingRequired ?? true,
        labelsFetchFailed: false,
      });
    },
    [patch],
  );

  /**
   * Save — app SettingsViewModel.submitLanguage (:205-300): fetch the language's labels AND call
   * set_preferred_language; on success store id / code / display name / streaming_required and
   * switch the labels.
   */
  const submitLanguage = useCallback(() => {
    const s = stateRef.current;
    const userId = sdk.session.userId;
    if (!userId || s.selectedLanguageId === null || s.isSubmitting) return;
    const languageId = s.selectedLanguageId;
    patch({ isSubmitting: true, submitErrorMessage: null, fetchingLabelsForId: languageId });
    void Promise.all([
      sdk.api.getLabels(languageId),
      sdk.api.setPreferredLanguage({ user_id: userId, language_id: languageId }),
    ]).then(([labels, saved]) => {
      if (!mounted.current) return;
      if (!labels.ok) {
        patch({ isSubmitting: false, fetchingLabelsForId: null, labelsFetchFailed: true });
        return;
      }
      if (saved.ok) {
        sdk.store.set(StorageKeys.SELECTED_LANGUAGE_ID, languageId);
        if (s.selectedLanguageCode) sdk.store.set(StorageKeys.SELECTED_LANGUAGE_CODE, s.selectedLanguageCode);
        // App parity: the display name feeds the drawer's "Language: X" line.
        if (s.selectedDisplayName) {
          sdk.store.set(StorageKeys.SELECTED_LANGUAGE_DISPLAY_NAME, s.selectedDisplayName);
        }
        // App SettingsViewModel: the language's streaming_required is saved with it.
        sdk.store.set(StorageKeys.STREAMING_REQUIRED, s.selectedStreamingRequired);
        sdk.labels.setLabels(labels.data);
        sdk.analytics.track(AnalyticsEvents.SAVE_LANGUAGE_CLICK, {
          language_id: languageId,
          language_code: s.selectedLanguageCode,
          from_screen: 'settings',
        });
        patch({ isSubmitting: false, fetchingLabelsForId: null, submitSuccess: true });
      } else {
        patch({
          isSubmitting: false,
          fetchingLabelsForId: null,
          submitErrorMessage:
            saved.message ??
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
    // App parity: FAQ `theme` derives from appearance (Day→light, Night→dark, Auto→default).
    const mode = (sdk.store.getString(StorageKeys.APPEARANCE_MODE) ?? 'auto').toLowerCase();
    const theme = mode === 'day' ? 'light' : mode === 'night' ? 'dark' : 'default';
    void sdk.api
      .getHelpSupport({ lang, limit: 5, theme, country })
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
