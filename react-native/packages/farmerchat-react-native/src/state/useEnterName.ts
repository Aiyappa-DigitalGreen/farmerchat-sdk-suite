/**
 * useEnterName — port of `EnterNameViewModel` + name UDF
 * (docs/01 §3.3: UserNameAction / UpdateUserNameState) and the
 * `UserProfileViewModel` profile fetch used by EnterName/Settings.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { UiStates, type UiState } from '../core/apiResult';
import { AnalyticsEvents } from '../core/analytics';
import type { FarmerChatSdk } from '../core/sdk';
import { StorageKeys } from '../core/sessionStore';
import type { FarmerProfile, UserNameRequest, UserNameResponse } from '../core/types';

export type UserNameAction =
  | { type: 'UpdateUserName'; body: UserNameRequest; screenName: string }
  | { type: 'ConsumeUpdateResult' };

export interface UpdateUserNameState {
  updateUserNameState: UiState<UserNameResponse>;
}

export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 100;

/** Letters + single spaces only — port of `normalizeNameInput`. */
export function normalizeNameInput(raw: string): string {
  return raw
    .replace(/[^\p{L} ]+/gu, '')
    .replace(/ {2,}/g, ' ')
    .replace(/^ +/, '');
}

/** Sanitizes placeholder names like "No Name"/"null" (EnterNameRoute). */
export function sanitizeStoredName(name: string | null | undefined): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (trimmed.length === 0) return '';
  const lowered = trimmed.toLowerCase();
  if (lowered === 'no name' || lowered === 'null') return '';
  return trimmed;
}

export interface UseEnterNameResult {
  state: UpdateUserNameState;
  dispatch: (action: UserNameAction) => void;
  profileState: UiState<FarmerProfile>;
  fetchProfile: (fromScreen: string) => void;
  validateName: (name: string) => string | null;
}

export function useEnterName(sdk: FarmerChatSdk): UseEnterNameResult {
  const [state, setState] = useState<UpdateUserNameState>({
    updateUserNameState: UiStates.idle(),
  });
  const [profileState, setProfileState] = useState<UiState<FarmerProfile>>(
    UiStates.idle(),
  );
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const updateUserName = useCallback(
    async (body: UserNameRequest, screenName: string) => {
      setState({ updateUserNameState: UiStates.loading() });
      const result = await sdk.api.updateUserProfile(body);
      if (!mounted.current) return;
      if (result.ok) {
        if (body.name) {
          sdk.store.set(StorageKeys.USER_NAME, body.name);
          sdk.store.set(StorageKeys.USER_NAME_ADDED, true);
        }
        sdk.analytics.track(AnalyticsEvents.NAME_SAVE_CLICK, {
          screen_name: screenName,
        });
        setState({ updateUserNameState: UiStates.success(result.data) });
      } else {
        setState({
          updateUserNameState: UiStates.error(
            result.message ?? 'Could not save your name. Please try again.',
            result.code,
            result.isNetworkError || result.isTimeout,
          ),
        });
      }
    },
    [sdk],
  );

  const dispatch = useCallback(
    (action: UserNameAction) => {
      switch (action.type) {
        case 'UpdateUserName':
          void updateUserName(action.body, action.screenName);
          break;
        case 'ConsumeUpdateResult':
          setState({ updateUserNameState: UiStates.idle() });
          break;
      }
    },
    [updateUserName],
  );

  const fetchProfile = useCallback(
    (fromScreen: string) => {
      const userId = sdk.session.userId;
      if (!userId) return;
      setProfileState(UiStates.loading());
      void sdk.api.viewUserProfile(userId).then((result) => {
        if (!mounted.current) return;
        if (result.ok) {
          const first = result.data.userProfile?.first_name ?? '';
          const last = result.data.userProfile?.last_name ?? '';
          const full = sanitizeStoredName(`${first} ${last}`.trim());
          if (full) {
            sdk.store.set(StorageKeys.USER_NAME, full);
          } else {
            sdk.store.remove(StorageKeys.USER_NAME);
          }
          setProfileState(UiStates.success(result.data));
        } else {
          setProfileState(
            UiStates.error(
              result.message ?? 'Could not load profile',
              result.code,
              result.isNetworkError || result.isTimeout,
            ),
          );
          sdk.analytics.track(AnalyticsEvents.API_CALL_FAILED, {
            api_name: 'view_user_profile',
            from_screen: fromScreen,
          });
        }
      });
    },
    [sdk],
  );

  const validateName = useCallback(
    (name: string): string | null => {
      const trimmed = name.trim();
      if (trimmed.length < NAME_MIN_LENGTH) {
        return sdk.labels.getLabel(
          'name_too_short',
          'Please enter at least 3 characters.',
        );
      }
      if (trimmed.length > NAME_MAX_LENGTH) {
        return sdk.labels.getLabel(
          'name_too_long',
          'Name must be under 100 characters.',
        );
      }
      return null;
    },
    [sdk],
  );

  return { state, dispatch, profileState, fetchProfile, validateName };
}
