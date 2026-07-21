/**
 * UserProfileViewModel port (docs/01 §3.16) — fetchProfile via #9, saving
 * USER_NAME to prefs; used by Settings, EnterName and Home profile cards.
 */

import { useCallback, useState } from 'react';
import type { SdkServices } from '../core/services';
import { PrefKeys } from '../core/storage';
import type { FarmerProfile } from '../core/types';
import { UiState, idle, loading } from './uiState';
import { sanitizeName, toUiState } from './helpers';

export interface UserProfileState {
  profileState: UiState<FarmerProfile>;
}

export interface UserProfileActions {
  fetchProfile: (fromScreen?: string) => Promise<FarmerProfile | null>;
}

export function useUserProfile(services: SdkServices): [UserProfileState, UserProfileActions] {
  const [state, setState] = useState<UserProfileState>({ profileState: idle() });
  const { api, session, store } = services;

  const fetchProfile = useCallback(
    async (_fromScreen?: string): Promise<FarmerProfile | null> => {
      const userId = session.userId;
      if (!userId) return null;
      setState({ profileState: loading() });
      const res = await api.viewUserProfile(userId);
      setState({ profileState: toUiState(res) });
      if (res.ok) {
        const serverName = sanitizeName(res.data.userProfile?.first_name);
        if (serverName) store.setString(PrefKeys.USER_NAME, serverName);
        else store.remove(PrefKeys.USER_NAME);
        return res.data;
      }
      return null;
    },
    [api, session, store],
  );

  return [state, { fetchProfile }];
}
