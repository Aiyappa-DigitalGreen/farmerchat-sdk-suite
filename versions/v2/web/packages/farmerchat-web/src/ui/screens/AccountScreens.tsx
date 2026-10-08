/**
 * AccountBenefits interstitial (docs/01 §3.5) + AccountSuccess (§3.6) —
 * both rendered with FullScreenMessage.
 */

import { useEffect } from 'react';
import { FullScreenMessage } from '../components/common';
import { useLabel, useSdk } from '../context';
import { Events, Screens } from '../../core/analytics';

export function AccountBenefitsScreen(props: { onSignUp: () => void; onSkip: () => void }) {
  const { services } = useSdk();
  const label = useLabel();

  useEffect(() => {
    services.analytics.screenView(Screens.ACCOUNT_BENEFITS);
    return () => services.analytics.screenExit(Screens.ACCOUNT_BENEFITS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = () => {
    services.analytics.track(Events.ACCOUNT_BENEFIT_SCREEN_SKIP, {});
    props.onSkip();
  };

  return (
    // AccountScreens.kt AccountBenefits: back circle + "Skip" pill in the glow app bar, the farmer
    // looking at the camera, and a Chevron CTA.
    <FullScreenMessage
      title={label('fc_v2_app_label_sign_up', 'Sign up')}
      mainMessage={label('fc_v2_app_label_save_your_questions_answers', 'Save your questions\nand answers')}
      subtitle={label('fc_v2_app_label_well_save_your_chats_you_continue', "We'll save your chats so you can continue later.")}
      image="camera"
      primaryLabel={label('fc_v2_app_label_sign_up_phone_number', 'Sign up with phone number')}
      primaryState="chevron"
      onPrimary={() => {
        services.analytics.track(Events.ACCOUNT_BENEFIT_SCREEN_PROCEED, {});
        props.onSignUp();
      }}
      left={{ icon: 'm_arrow_back', ariaLabel: 'back', radius: 'rounded', onClick: skip }}
      right={{ label: label('fc_v2_app_label_skip', 'Skip'), radius: 'rounded', onClick: skip }}
    />
  );
}

export function AccountSuccessScreen(props: { onContinue: () => void }) {
  const { services } = useSdk();
  const label = useLabel();

  useEffect(() => {
    services.analytics.screenView(Screens.ACCOUNT_SUCCESS);
    return () => services.analytics.screenExit(Screens.ACCOUNT_SUCCESS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <FullScreenMessage
      title={label('fc_v2_app_label_sign_up', 'Sign up')}
      mainMessage={label('fc_v2_app_label_youre_all_set', "You're all set!")}
      subtitle={label('fc_v2_app_label_previous_questions_menu', 'Find your previous questions in the menu and continue anytime.')}
      subtitleLarge
      image="sky"
      primaryLabel={label('fc_v2_app_label_continue', 'Continue')}
      onPrimary={() => {
        services.analytics.track(Events.SIGNUP_CONTINUE_CLICKED, {});
        props.onContinue();
      }}
    />
  );
}
