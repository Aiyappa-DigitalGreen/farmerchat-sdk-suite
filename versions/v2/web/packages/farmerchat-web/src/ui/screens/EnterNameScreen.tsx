/**
 * Enter Name (docs/01 §3.3): normalized name input (letters/single spaces),
 * min 3 / max 100 validation with error toast, "Save name" primary button,
 * animated "Skip for now" hidden once text is typed. Navigation only on API
 * Success; skip sets KEY_NAME_DONE and routes.
 */

import { useEffect, useState } from 'react';
import { useLabel, useSdk } from '../context';
import { PrimaryButton, SecondaryButton, TextInput, Toast } from '../components/common';
import { FcIcon } from '../components/FcIcon';
import { useEnterName } from '../../state/useEnterName';
import { useUserProfile } from '../../state/useUserProfile';
import { normalizeNameInput, sanitizeName } from '../../state/helpers';
import { PrefKeys } from '../../core/storage';
import { Events, Screens } from '../../core/analytics';

const MIN_NAME = 3;
const MAX_NAME = 100;

export function EnterNameScreen(props: { onDone: () => void }) {
  const { services, toast } = useSdk();
  const label = useLabel();
  const [name, setName] = useState(() => sanitizeName(services.store.getString(PrefKeys.USER_NAME)));
  const [state, actions] = useEnterName(services);
  const [, profileActions] = useUserProfile(services);

  useEffect(() => {
    services.analytics.screenView(Screens.ENTER_NAME);
    // Prefer the server name when logged in (EnterNameRoute behavior).
    if (services.session.isAuthenticated()) {
      void profileActions.fetchProfile('enter_name').then((profile) => {
        const serverName = sanitizeName(profile?.userProfile?.first_name);
        if (serverName) setName(serverName);
      });
    }
    return () => services.analytics.screenExit(Screens.ENTER_NAME);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    const trimmed = name.trim();
    // EnterNameScreen.kt composes these from two served labels around the number.
    if (trimmed.length < MIN_NAME) {
      toast.show(
        `${label('fc_v2_app_label_name_must_be_at_least', 'Name must be at least')} ${MIN_NAME} ${label('fc_v2_app_label_characters', 'characters')}`,
        { kind: 'error' },
      );
      return;
    }
    if (trimmed.length > MAX_NAME) {
      toast.show(
        `${label('fc_v2_app_label_name_must_be_at_most', 'Name must be at most')} ${MAX_NAME} ${label('fc_v2_app_label_characters', 'characters')}`,
        { kind: 'error' },
      );
      return;
    }
    services.analytics.track(Events.NAME_SAVE_CLICK, {});
    const ok = await actions.updateUserName({ user_id: services.session.userId ?? '', name: trimmed }, Screens.ENTER_NAME);
    if (ok) {
      services.store.setBool(PrefKeys.KEY_NAME_DONE, true);
      services.store.setBool(PrefKeys.KEY_NAME_SCREEN_SEEN, true);
      actions.consumeUpdateResult();
      props.onDone();
    } else {
      const s = state.updateUserNameState;
      if (s.status === 'error') toast.show(s.message, { kind: 'error' });
    }
  };

  const skip = () => {
    services.analytics.track(Events.NAME_SKIP_CLICK, {});
    services.store.setBool(PrefKeys.KEY_NAME_DONE, true);
    services.store.setBool(PrefKeys.KEY_NAME_SCREEN_SEEN, true);
    props.onDone();
  };

  const isSaving = state.updateUserNameState.status === 'loading';
  const trimmedLength = name.trim().length;
  const canSave = trimmedLength >= 1 && trimmedLength <= MAX_NAME;

  // EnterNameScreen.kt: one centred column — mark, title, subtitle, input, Save, Skip — with
  // no bottom bar. Skip fades out once a name is typed (its 12dp spacer stays).
  return (
    <div className="fcsdk-screen fcsdk-c-screen">
      <div className="fcsdk-scroll fcsdk-c-name-scroll">
        <FcIcon name="logo_mark" size={32} tint="var(--fc-c-border-active)" title="FarmerChat" />
        <h2 className="fcsdk-c-title fc-t-titleLarge" style={{ marginTop: 14 }}>
          {label('fc_v2_app_label_what_should_we_call_you', 'What should we call you?')}
        </h2>
        <p className="fcsdk-c-subtitle fc-t-bodyMedium" style={{ marginTop: 8, maxWidth: 260 }}>
          {label('fc_v2_app_label_we_greet_you_name', 'So we can greet you by name')}
        </p>
        <div style={{ height: 24 }} />
        <TextInput
          value={name}
          onChange={(v) => setName(normalizeNameInput(v))}
          placeholder={label('fc_v2_app_label_your_name_or_nickname', 'Your name or nickname')}
          autoFocus
          onEnter={() => void save()}
          ariaLabel={label('fc_v2_app_label_your_name_or_nickname', 'Your name or nickname')}
        />
        <div style={{ height: 16 }} />
        <PrimaryButton
          height={56}
          label={isSaving ? label('fc_v2_app_label_saving', 'Saving') : label('fc_v2_app_label_save_name', 'Save name')}
          onClick={() => void save()}
          disabled={!canSave}
          state={isSaving ? 'loading' : trimmedLength > 0 ? 'chevron' : 'default'}
        />
        <div style={{ height: 12 }} />
        <div className={`fcsdk-c-fade${trimmedLength === 0 ? '' : ' fcsdk-c-fade--out'}`} style={{ width: '100%' }}>
          <SecondaryButton label={label('fc_v2_app_label_skip_for_now', 'Skip for now')} onClick={skip} disabled={trimmedLength !== 0} />
        </div>
      </div>
      <Toast message={toast.message} />
    </div>
  );
}
