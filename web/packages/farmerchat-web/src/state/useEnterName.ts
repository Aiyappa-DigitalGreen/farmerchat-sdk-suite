/**
 * EnterNameViewModel port — name/udf UserNameAction / UpdateUserNameState
 * (docs/01 §3.3, §3.11). Also used by Settings→Name and the Home profile cards
 * (gender / livestock updates go through the same UpdateUserName action).
 */

import { useCallback, useState } from 'react';
import type { SdkServices } from '../core/services';
import { PrefKeys } from '../core/storage';
import type { UserNameRequest, UserNameResponse } from '../core/types';
import { UiState, idle, loading } from './uiState';
import { toUiState } from './helpers';

export interface UpdateUserNameState {
  updateUserNameState: UiState<UserNameResponse>;
}

export interface EnterNameActions {
  updateUserName: (body: UserNameRequest, screenName: string) => Promise<boolean>;
  consumeUpdateResult: () => void;
}

export function useEnterName(services: SdkServices): [UpdateUserNameState, EnterNameActions] {
  const [state, setState] = useState<UpdateUserNameState>({ updateUserNameState: idle() });
  const { api, store } = services;

  const updateUserName = useCallback(
    async (body: UserNameRequest, _screenName: string): Promise<boolean> => {
      setState({ updateUserNameState: loading() });
      const res = await api.updateUserProfile(body);
      setState({ updateUserNameState: toUiState(res) });
      if (res.ok && typeof body.name === 'string' && body.name.trim().length > 0) {
        store.setString(PrefKeys.USER_NAME, body.name.trim());
        store.setBool(PrefKeys.USER_NAME_ADDED, true);
      }
      return res.ok;
    },
    [api, store],
  );

  const consumeUpdateResult = useCallback(() => {
    setState({ updateUserNameState: idle() });
  }, []);

  return [state, { updateUserName, consumeUpdateResult }];
}
