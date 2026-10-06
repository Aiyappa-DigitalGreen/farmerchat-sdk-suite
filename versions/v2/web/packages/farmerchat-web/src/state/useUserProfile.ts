/**
 * UserProfileViewModel port (docs/01 §3.16) — fetchProfile via #9, saving
 * USER_NAME to prefs; used by Settings, EnterName and Home profile cards.
 */

import { useCallback, useState } from 'react';
import type { SdkServices } from '../core/services';
import { PrefKeys } from '../core/storage';
import type { FarmerProfile, UserProfile } from '../core/types';
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

  /**
   * Fills the geography keys from the profile when they are empty (app parity:
   * `HomeViewModel.fetchUserProfile`, fc-compose-agentic b72ea4da).
   *
   * `USER_DISTRICT` / `USER_STATE` / `USER_COUNTRY_NAME` are normally written by the GPS flow
   * from #16, and `HomeScreen`'s location pill reads exactly this chain
   * (`USER_DISTRICT → USER_STATE → USER_COUNTRY_NAME`) for its place name. A farmer whose
   * geography exists SERVER-side but not in this browser's storage therefore sees the "Share your
   * location" invite even though the place is known. The profile carries it, so fill from there.
   *
   * Fill-WHEN-BLANK, never overwrite: a live GPS fix is more precise than the profile's coarse
   * geography.
   *
   * CAVEAT, recorded in docs/04: unlike the app, android and RN, **web's Home does not fetch the
   * profile on entry** — nothing on web calls #9 from Home. So this backfill lands on the next
   * Settings / EnterName visit, not on first Home entry, and the pill stays on the invite until
   * then. Adding a Home-entry profile fetch to web is a separate change.
   */
  const backfillGeographyKeys = useCallback(
    (profile: UserProfile | null | undefined) => {
      if (!profile) return;
      const fillIfBlank = (value: string | null | undefined, key: string) => {
        if (!value || value.trim().length === 0) return;
        const existing = store.getString(key);
        if (existing && existing.trim().length > 0) return;
        store.setString(key, value);
      };
      fillIfBlank(profile.geography_level3, PrefKeys.USER_DISTRICT);
      fillIfBlank(profile.geography_level2_name, PrefKeys.USER_STATE);
      fillIfBlank(profile.country_name, PrefKeys.USER_COUNTRY_NAME);
    },
    [store],
  );

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
        backfillGeographyKeys(res.data.userProfile);
        return res.data;
      }
      return null;
    },
    [api, backfillGeographyKeys, session, store],
  );

  return [state, { fetchProfile }];
}
