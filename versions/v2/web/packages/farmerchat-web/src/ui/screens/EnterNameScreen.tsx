/**
 * Enter Name (docs/01 §3.3): normalized name input (letters/single spaces),
 * min 3 / max 100 validation with error toast, "Save name" primary button,
 * animated "Skip for now" hidden once text is typed. Navigation only on API
 * Success; skip sets KEY_NAME_DONE and routes.
 */

import { useEffect, useState } from 'react';
import { useLabel, useSdk } from '../context';
import { LogoGlyph, PrimaryButton, SecondaryButton, TextInput, Toast } from '../components/common';
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
    if (trimmed.length < MIN_NAME) {
      toast.show(label('name_too_short', 'Please enter at least 3 characters.'));
      return;
    }
    if (trimmed.length > MAX_NAME) {
      toast.show(label('name_too_long', 'Name is too long.'));
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
      toast.show(s.status === 'error' ? s.message : label('name_save_failed', 'Could not save your name. Please try again.'));
    }
  };

  const skip = () => {
    services.analytics.track(Events.NAME_SKIP_CLICK, {});
    services.store.setBool(PrefKeys.KEY_NAME_DONE, true);
    services.store.setBool(PrefKeys.KEY_NAME_SCREEN_SEEN, true);
    props.onDone();
  };

  const isSaving = state.updateUserNameState.status === 'loading';

  return (
    <div className="fcsdk-screen">
      <div className="fcsdk-scroll fcsdk-pad">
        <div style={{ fontSize: 40, marginBottom: 8 }} aria-hidden>
          <LogoGlyph />
        </div>
        <h2 style={{ margin: '4px 0 2px', fontSize: 22 }}>{label('fc_v2_app_label_what_should_we_call_you', 'What should we call you?')}</h2>
        <p style={{ margin: '0 0 16px', color: 'var(--fc-text-muted)' }}>
          {label('name_subtitle', 'We will use this to personalize your advice')}
        </p>
        <TextInput
          value={name}
          onChange={(v) => setName(normalizeNameInput(v))}
          placeholder={label('fc_v2_app_label_your_name_or_nickname', 'Your name')}
          autoFocus
          maxLength={MAX_NAME}
          onEnter={() => void save()}
          ariaLabel={label('fc_v2_app_label_your_name_or_nickname', 'Your name')}
        />
      </div>
      <div className="fcsdk-bottombar">
        <PrimaryButton
          label={label('fc_v2_app_label_save_name', 'Save name')}
          onClick={() => void save()}
          disabled={name.trim().length < 1}
          state={isSaving ? 'loading' : 'chevron'}
        />
        {name.trim().length === 0 ? <SecondaryButton label={label('fc_v2_app_label_skip_for_now', 'Skip for now')} onClick={skip} /> : null}
      </div>
      <Toast message={toast.message} />
    </div>
  );
}
