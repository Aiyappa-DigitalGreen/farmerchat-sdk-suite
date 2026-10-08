/**
 * Settings (docs/01 §3.10) + SettingsName (§3.11).
 * Appearance Day/Night/Auto selector, 2.0.0 "My Farm" Location row (shared location flow,
 * Settings source), Account details → "Your name" row,
 * Logout (authenticated) / Sign up, name-updated toast.
 */

import { useEffect, useState } from 'react';
import { useLabel, useSdk } from '../context';
import { DefaultAppBar, ListCard, ListItem, PrimaryButton, SecondaryButton, TextInput, Toast } from '../components/common';
import { FcIcon, type IconName } from '../components/FcIcon';
import { useEnterName } from '../../state/useEnterName';
import { useUserProfile } from '../../state/useUserProfile';
import { normalizeNameInput, sanitizeName } from '../../state/helpers';
import { PrefKeys } from '../../core/storage';
import { Events, Screens } from '../../core/analytics';
import type { AppearanceMode } from '../../core/config';
import type { LocationPromptActions, LocationPromptState } from '../../state/useLocationPrompt';

const MODES: Array<{ mode: AppearanceMode; icon: IconName }> = [
  { mode: 'day', icon: 'icon_mode_day' },
  { mode: 'night', icon: 'icon_mode_night' },
  { mode: 'auto', icon: 'icon_mode_auto' },
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
          toast.show(label('fc_v2_app_label_location_found', 'Location found'), { kind: 'success' });
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locationActions.subscribe],
  );

  const modeLabel = (mode: AppearanceMode): string =>
    mode === 'day' ? label('fc_v2_app_label_day', 'Day') : mode === 'night' ? label('fc_v2_app_label_night', 'Night') : label('fc_v2_app_label_auto', 'Auto');

  const modeHint =
    appearance === 'day'
      ? label('fc_v2_app_label_farmerchat_always_light_mode', 'FarmerChat always uses light mode')
      : appearance === 'night'
        ? label('fc_v2_app_label_farmerchat_always_dark_mode', 'FarmerChat always uses dark mode')
        : label('fc_v2_app_label_farmerchat_adjusts_your_phone_settings', 'FarmerChat adjusts with your phone settings');
  const phone = (services.store.getString(PrefKeys.PHONE_NUMBER_LOGIN) ?? '').trim();

  // SettingsScreen.kt: a 32/20 padded column of sections 28 apart, each a labelLarge title and
  // its content 10 apart.
  return (
    <div className="fcsdk-screen fcsdk-c-screen">
      <DefaultAppBar title={label('fc_v2_app_label_settings', 'Settings')} leadingIcon="menu" onLeadingClick={props.onOpenDrawer} />
      <div className="fcsdk-scroll">
        <div className="fcsdk-c-page" style={{ gap: 28 }}>
          <section className="fcsdk-c-section">
            <h3 className="fcsdk-c-section-title fc-t-labelLarge">{label('fc_v2_app_label_appearance', 'Appearance')}</h3>
            <div className="fcsdk-c-modes" role="radiogroup" aria-label={label('fc_v2_app_label_appearance', 'Appearance')}>
              {MODES.map(({ mode, icon }) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={appearance === mode}
                  className={`fcsdk-c-mode${appearance === mode ? ' fcsdk-c-mode--active' : ''}`}
                  onClick={() => {
                    services.analytics.track(Events.SETTINGS_OPTION_SELECTED, { option: 'appearance', value: mode });
                    setAppearance(mode);
                  }}
                >
                  <FcIcon name={icon} size={18} tint="var(--fc-c-fg-primary)" />
                  <span className="fc-t-labelSmall">{modeLabel(mode)}</span>
                </button>
              ))}
            </div>
            <p className="fcsdk-c-muted fc-t-caption" style={{ margin: 0 }}>{modeHint}</p>
          </section>

          <section className="fcsdk-c-section">
            <h3 className="fcsdk-c-section-title fc-t-labelLarge">{label('fc_v2_app_label_my_farm', 'My Farm')}</h3>
            <ListCard>
              <ListItem
                icon="icon_location"
                text={label('fc_v2_app_label_location', 'Location')}
                rightText={locationRowValue}
                loading={isSettingsLocationFlowActive}
                onClick={() => {
                  if (locationState.kind === 'Idle') locationActions.triggerFromSettings();
                }}
              />
            </ListCard>
            <p className="fcsdk-c-muted fc-t-bodySmall" style={{ margin: 0 }}>
              {hasExactLocation ? (
                <>
                  {label('fc_v2_app_label_advice_and_weather_for_this_area', 'Advice and weather for this area.')}{' '}
                  <span className="fcsdk-c-accent">{label('fc_v2_app_label_change_anytime', 'Change anytime.')}</span>
                </>
              ) : (
                <>
                  {label('fc_v2_app_label_estimated', 'Estimated')}.{' '}
                  <span className="fcsdk-c-accent">
                    {label('fc_v2_app_label_share_your_location_for_better_advice', 'Share your location for better advice.')}
                  </span>
                </>
              )}
            </p>
          </section>

          <section className="fcsdk-c-section">
            <h3 className="fcsdk-c-section-title fc-t-labelLarge">{label('fc_v2_app_label_account_details', 'Account details')}</h3>
            <ListCard>
              <ListItem icon="icon_phone" text={label('fc_v2_app_label_your_phone', 'Your phone')} rightText={phone || '—'} noChevron divider />
              <ListItem
                icon="icon_name"
                text={label('fc_v2_app_label_your_name', 'Your name')}
                rightText={userName || '—'}
                rightMaxLines={4}
                onClick={() => {
                  services.analytics.track(Events.EDIT_PROFILE_CLICK, {});
                  props.onNameClick();
                }}
              />
            </ListCard>
          </section>

          {isAuthenticated ? (
            <SecondaryButton
              label={label('fc_v2_app_label_logout', 'Logout')}
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
      toast.show(
        `${label('fc_v2_app_label_name_must_be_at_least', 'Name must be at least')} 3 ${label('fc_v2_app_label_characters', 'characters')}`,
        { kind: 'error' },
      );
      return;
    }
    if (trimmed.length > 100) {
      toast.show(
        `${label('fc_v2_app_label_name_must_be_at_most', 'Name must be at most')} 100 ${label('fc_v2_app_label_characters', 'characters')}`,
        { kind: 'error' },
      );
      return;
    }
    const ok = await actions.updateUserName({ user_id: services.session.userId ?? '', name: trimmed }, Screens.SETTINGS);
    if (ok) {
      actions.consumeUpdateResult();
      props.onSaveComplete();
    } else {
      const s = state.updateUserNameState;
      if (s.status === 'error') toast.show(s.message, { kind: 'error' });
    }
  };

  const saving = state.updateUserNameState.status === 'loading';
  // SettingsNameScreen.kt: labelled field and the Save button inline under it (16 apart), a
  // 12dp rounded-square back button.
  return (
    <div className="fcsdk-screen fcsdk-c-screen">
      <DefaultAppBar title={label('fc_v2_app_label_name', 'Name')} leadingIcon="back" leadingRadius="md" onLeadingClick={props.onBack} />
      <div className="fcsdk-scroll">
        <div className="fcsdk-c-page" style={{ gap: 16 }}>
          <label className="fcsdk-c-section" style={{ gap: 8 }}>
            <span className="fc-t-labelMedium" style={{ color: 'var(--fc-c-fg-primary)' }}>
              {label('fc_v2_app_label_your_name', 'Your name')}
            </span>
            <TextInput
              value={name}
              onChange={(v) => setName(normalizeNameInput(v))}
              placeholder={label('fc_v2_app_label_enter_your_name', 'Enter your name')}
              autoFocus
              onEnter={() => void save()}
            />
          </label>
          <PrimaryButton
            label={saving ? label('fc_v2_app_label_saving', 'Saving') : label('fc_v2_app_label_save_name', 'Save name')}
            onClick={() => void save()}
            disabled={name.trim().length < 1}
            state={saving ? 'loading' : 'default'}
          />
        </div>
      </div>
      <Toast message={toast.message} />
    </div>
  );
}
