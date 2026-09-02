/**
 * Settings (docs/01 §3.10) + SettingsName (§3.11).
 * Appearance Day/Night/Auto selector, Account details → "Your name" row,
 * Logout (authenticated) / Sign up, name-updated toast.
 */

import { useEffect, useState } from 'react';
import { useLabel, useSdk } from '../context';
import { DefaultAppBar, ListCard, ListItem, PrimaryButton, SecondaryButton, TextInput, Toast } from '../components/common';
import { useEnterName } from '../../state/useEnterName';
import { useUserProfile } from '../../state/useUserProfile';
import { normalizeNameInput, sanitizeName } from '../../state/helpers';
import { PrefKeys } from '../../core/storage';
import { Events, Screens } from '../../core/analytics';
import type { AppearanceMode } from '../../core/config';

const MODES: Array<{ mode: AppearanceMode; icon: string }> = [
  { mode: 'day', icon: '☀️' },
  { mode: 'night', icon: '🌙' },
  { mode: 'auto', icon: '🌓' },
];

export function SettingsScreen(props: {
  onOpenDrawer: () => void;
  onNameClick: () => void;
  onSignUpClick: () => void;
  onLogOutClick: () => void;
  showNameUpdatedToast: boolean;
  onToastConsumed: () => void;
}) {
  const { services, toast, appearance, setAppearance } = useSdk();
  const label = useLabel();
  const [, profileActions] = useUserProfile(services);
  const [userName, setUserName] = useState(() => sanitizeName(services.store.getString(PrefKeys.USER_NAME)));
  const isAuthenticated = services.session.isAuthenticated();

  useEffect(() => {
    services.analytics.screenView(Screens.SETTINGS);
    // Graph fetches profile on Settings entry (docs/01 §3.10).
    if (isAuthenticated) {
      void profileActions.fetchProfile('settings').then(() => {
        setUserName(sanitizeName(services.store.getString(PrefKeys.USER_NAME)));
      });
    }
    if (props.showNameUpdatedToast) {
      const t = window.setTimeout(() => {
        toast.show(label('settings_name_updated', 'Your name has been updated.'));
        props.onToastConsumed();
      }, 500);
      return () => {
        window.clearTimeout(t);
        services.analytics.screenExit(Screens.SETTINGS);
      };
    }
    return () => services.analytics.screenExit(Screens.SETTINGS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modeLabel = (mode: AppearanceMode): string =>
    mode === 'day' ? label('settings_appearance_day', 'Day') : mode === 'night' ? label('settings_appearance_night', 'Night') : label('settings_appearance_auto', 'Auto');

  return (
    <div className="fcsdk-screen">
      <DefaultAppBar title={label('settings_title', 'Settings')} leadingIcon="menu" onLeadingClick={props.onOpenDrawer} />
      <div className="fcsdk-scroll">
        <div className="fcsdk-sectionheader">{label('settings_appearance', 'Appearance')}</div>
        <div className="fcsdk-appearance-row" role="radiogroup" aria-label={label('settings_appearance', 'Appearance')}>
          {MODES.map(({ mode, icon }) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={appearance === mode}
              className={`fcsdk-appearance-btn${appearance === mode ? ' fcsdk-appearance-btn--active' : ''}`}
              onClick={() => {
                services.analytics.track(Events.SETTINGS_OPTION_SELECTED, { option: 'appearance', value: mode });
                setAppearance(mode);
              }}
            >
              <span aria-hidden style={{ fontSize: 20 }}>
                {icon}
              </span>
              {modeLabel(mode)}
            </button>
          ))}
        </div>

        <div className="fcsdk-sectionheader">{label('settings_account', 'Account details')}</div>
        <ListCard>
          <ListItem
            icon="👤"
            text={`${label('settings_your_name', 'Your name')}${userName ? ` — ${userName}` : ''}`}
            onClick={() => {
              services.analytics.track(Events.EDIT_PROFILE_CLICK, {});
              props.onNameClick();
            }}
          />
        </ListCard>

        <div className="fcsdk-pad">
          {isAuthenticated ? (
            <SecondaryButton
              label={label('settings_logout', 'Log out')}
              onClick={() => {
                services.analytics.track(Events.LOGOUT_CLICK_EVENT, {});
                props.onLogOutClick();
              }}
            />
          ) : (
            <SecondaryButton label={label('settings_sign_up', 'Sign up')} onClick={props.onSignUpClick} />
          )}
        </div>
      </div>
      <Toast message={toast.message} />
    </div>
  );
}

/** SettingsName (docs/01 §3.11): Back app bar, normalized input, min-3/max-100. */
export function SettingsNameScreen(props: { onBack: () => void; onSaveComplete: () => void }) {
  const { services, toast } = useSdk();
  const label = useLabel();
  const [state, actions] = useEnterName(services);
  const [name, setName] = useState(() => sanitizeName(services.store.getString(PrefKeys.USER_NAME)));

  useEffect(() => {
    services.analytics.screenView(Screens.SETTINGS_NAME);
    return () => services.analytics.screenExit(Screens.SETTINGS_NAME);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      toast.show(label('name_too_short', 'Please enter at least 3 characters.'));
      return;
    }
    if (trimmed.length > 100) {
      toast.show(label('name_too_long', 'Name is too long.'));
      return;
    }
    const ok = await actions.updateUserName({ user_id: services.session.userId ?? '', name: trimmed }, Screens.SETTINGS);
    if (ok) {
      actions.consumeUpdateResult();
      props.onSaveComplete();
    } else {
      const s = state.updateUserNameState;
      toast.show(s.status === 'error' ? s.message : label('name_save_failed', 'Could not save your name. Please try again.'));
    }
  };

  return (
    <div className="fcsdk-screen">
      <DefaultAppBar title={label('settings_name_title', 'Name')} leadingIcon="back" onLeadingClick={props.onBack} />
      <div className="fcsdk-scroll fcsdk-pad">
        <TextInput
          value={name}
          onChange={(v) => setName(normalizeNameInput(v))}
          placeholder={label('name_placeholder', 'Your name')}
          autoFocus
          maxLength={100}
          onEnter={() => void save()}
        />
      </div>
      <div className="fcsdk-bottombar">
        <PrimaryButton
          label={label('name_save_button', 'Save name')}
          onClick={() => void save()}
          disabled={name.trim().length < 1}
          state={state.updateUserNameState.status === 'loading' ? 'loading' : 'default'}
        />
      </div>
      <Toast message={toast.message} />
    </div>
  );
}
