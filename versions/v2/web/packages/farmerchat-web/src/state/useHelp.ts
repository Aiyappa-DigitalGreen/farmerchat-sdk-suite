/**
 * Help screen data — GetHelpSupportUseCase port (docs/01 §3.12).
 */

import { useCallback, useState } from 'react';
import type { SdkServices } from '../core/services';
import { PrefKeys } from '../core/storage';
import type { HelpSupportResponse } from '../core/types';
import { UiState, idle, loading } from './uiState';
import { toUiState } from './helpers';

export interface HelpState {
  helpState: UiState<HelpSupportResponse>;
  reloadToken: number;
}

export interface HelpActions {
  loadHelp: () => Promise<void>;
  reload: () => void;
}

export function useHelp(services: SdkServices): [HelpState, HelpActions] {
  const [state, setState] = useState<HelpState>({ helpState: idle(), reloadToken: 0 });
  const { api, store, labels } = services;

  const loadHelp = useCallback(async () => {
    setState((s) => ({ ...s, helpState: loading() }));
    const lang = labels.languageCode || 'en';
    const country = store.getString(PrefKeys.USER_COUNTRY_CODE) ?? undefined;
    // App parity: FAQ `theme` derives from appearance (Day→light, Night→dark, Auto→default).
    const mode = (store.getString(PrefKeys.APPEARANCE_MODE) ?? 'auto').toLowerCase();
    const theme = mode === 'day' ? 'light' : mode === 'night' ? 'dark' : 'default';
    const res = await api.getHelpSupport(lang, 5, theme, country);
    setState((s) => ({ ...s, helpState: toUiState(res) }));
  }, [api, labels, store]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, reloadToken: s.reloadToken + 1 }));
  }, []);

  return [state, { loadHelp, reload }];
}
