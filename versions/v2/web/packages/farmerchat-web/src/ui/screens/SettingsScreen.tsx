/**
 * Settings (docs/01 §3.10) + SettingsName (§3.11).
 * Appearance Day/Night/Auto selector, 2.0.0 "My Farm" Location row (shared location flow,
 * Settings source), Account details → "Your name" row,
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
import type { LocationPromptActions, LocationPromptState } from '../../state/useLocationPrompt';

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
  /** 2.0.0 "My Farm" row: the ONE shared location machine (overlay lives in FarmerChatRoot). */
  locationState: LocationPromptState;
  locationActions: LocationPromptActions;
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
        toast.show(label('fc_v2_app_label_your_name_has_updated', 'Your name has been updated.'));
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

  // ------------------------------------------------------------------ My Farm / location
  // Port of the Android SDK's Settings "My Farm" row. Place name: web has no
  // APPROX_LOCATION_NAME key, so the finest place the location flow stores stands in (district →
  // state → country), the same mapping Home's pill and the chat location bubble use.
  // "Exact" = a GPS fix is stored AND the browser permission is still granted.
  const { locationState, locationActions } = props;
  const isSettingsLocationFlowActive =
    locationState.source === 'settings' &&
    (locationState.kind === 'RequestPermission' ||
      locationState.kind === 'RequestEnableGps' ||
      locationState.kind === 'FetchingLocation');
  const hasExactLocation = locationActions.hasKnownLocation() && locationActions.hasLocationPermission();
  const locationPlaceName =
    [PrefKeys.USER_DISTRICT, PrefKeys.USER_STATE, PrefKeys.USER_COUNTRY_NAME]
      .map((key) => (services.store.getString(key) ?? '').trim())
      .find((value) => value.length > 0) ?? '';
  const locationRowValue = isSettingsLocationFlowActive
    ? label('fc_v2_app_label_getting_your_location', 'Getting your location')
    : locationPlaceName.length === 0
      ? '—'
      : !hasExactLocation
        ? `${locationPlaceName} (${label('fc_v2_app_label_approximate', 'approximate')})`
        : locationPlaceName;

  // "Location found" toast when THIS row's flow succeeds (Android: active → Idle with a fix).
  useEffect(
    () =>
      locationActions.subscribe((event) => {
        if (event.source === 'settings' && event.kind === 'continue' && event.reason === 'location_fetched') {
          toast.show(label('fc_v2_app_label_location_found', 'Location found'));
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locationActions.subscribe],
  );

  const modeLabel = (mode: AppearanceMode): string =>
    mode === 'day' ? label('fc_v2_app_label_day', 'Day') : mode === 'night' ? label('fc_v2_app_label_night', 'Night') : label('fc_v2_app_label_auto', 'Auto');

  return (
    <div className="fcsdk-screen">
      <DefaultAppBar title={label('fc_v2_app_label_settings', 'Settings')} leadingIcon="menu" onLeadingClick={props.onOpenDrawer} />
      <div className="fcsdk-scroll">
        <div className="fcsdk-sectionheader">{label('fc_v2_app_label_appearance', 'Appearance')}</div>
        <div className="fcsdk-appearance-row" role="radiogroup" aria-label={label('fc_v2_app_label_appearance', 'Appearance')}>
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

        <div className="fcsdk-sectionheader">{label('fc_v2_app_label_my_farm', 'My Farm')}</div>
        <ListCard>
          <ListItem
            icon={'\u{1F4CD}'}
            text={label('fc_v2_app_label_location', 'Location')}
            trailing={
              <span className="fcsdk-li-trailing-text">
                <span>{locationRowValue}</span>
                {isSettingsLocationFlowActive ? (
                  <span className="fcsdk-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} aria-hidden />
                ) : null}
              </span>
            }
            onClick={() => {
              if (locationState.kind === 'Idle') locationActions.triggerFromSettings();
            }}
          />
        </ListCard>
        <div className="fcsdk-settings-location-helper">
          {hasExactLocation ? (
            <>
              {label('fc_v2_app_label_advice_and_weather_for_this_area', 'Advice and weather for this area.')}{' '}
              <em>{label('fc_v2_app_label_change_anytime', 'Change anytime.')}</em>
            </>
          ) : (
            <>
              {label('fc_v2_app_label_estimated', 'Estimated')}.{' '}
              <em>{label('fc_v2_app_label_share_your_location_for_better_advice', 'Share your location for better advice.')}</em>
            </>
          )}
        </div>

        <div className="fcsdk-sectionheader">{label('fc_v2_app_label_account_details', 'Account details')}</div>
        <ListCard>
          <ListItem
            icon="👤"
            text={`${label('fc_v2_app_label_your_name', 'Your name')}${userName ? ` — ${userName}` : ''}`}
            onClick={() => {
              services.analytics.track(Events.EDIT_PROFILE_CLICK, {});
              props.onNameClick();
            }}
          />
        </ListCard>

        <div className="fcsdk-pad">
          {isAuthenticated ? (
            <SecondaryButton
              label={label('fc_v2_app_label_logout', 'Log out')}
              onClick={() => {
                services.analytics.track(Events.LOGOUT_CLICK_EVENT, {});
                props.onLogOutClick();
              }}
            />
          ) : (
            <SecondaryButton label={label('fc_v2_app_label_sign_up', 'Sign up')} onClick={props.onSignUpClick} />
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
      <DefaultAppBar title={label('fc_v2_app_label_name', 'Name')} leadingIcon="back" onLeadingClick={props.onBack} />
      <div className="fcsdk-scroll fcsdk-pad">
        <TextInput
          value={name}
          onChange={(v) => setName(normalizeNameInput(v))}
          placeholder={label('fc_v2_app_label_your_name_or_nickname', 'Your name')}
          autoFocus
          maxLength={100}
          onEnter={() => void save()}
        />
      </div>
      <div className="fcsdk-bottombar">
        <PrimaryButton
          label={label('fc_v2_app_label_save_name', 'Save name')}
          onClick={() => void save()}
          disabled={name.trim().length < 1}
          state={state.updateUserNameState.status === 'loading' ? 'loading' : 'default'}
        />
      </div>
      <Toast message={toast.message} />
    </div>
  );
}
