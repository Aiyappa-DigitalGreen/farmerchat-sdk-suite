/**
 * AccountBenefits interstitial (docs/01 §3.5) + AccountSuccess (§3.6) —
 * both rendered with FullScreenMessage.
 */

import { useEffect } from 'react';
import { FullScreenMessage, Icon } from '../components/common';
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

  return (
    <FullScreenMessage
      title={label('account_benefits_title', 'Sign up')}
      subtitle={label('account_benefits_subtitle', 'Save your questions and answers')}
      illustration={Icon.farmer}
      primaryLabel={label('account_benefits_cta', 'Sign up with phone number')}
      onPrimary={() => {
        services.analytics.track(Events.ACCOUNT_BENEFIT_SCREEN_PROCEED, {});
        props.onSignUp();
      }}
      secondaryLabel={label('account_benefits_skip', 'Skip')}
      onSecondary={() => {
        services.analytics.track(Events.ACCOUNT_BENEFIT_SCREEN_SKIP, {});
        props.onSkip();
      }}
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
      title={label('account_success_title', "You're all set!")}
      subtitle={label('account_success_subtitle', 'Your questions and answers are now saved to your account.')}
      illustration={Icon.sky}
      primaryLabel={label('account_success_continue', 'Continue')}
      onPrimary={() => {
        services.analytics.track(Events.SIGNUP_CONTINUE_CLICKED, {});
        props.onContinue();
      }}
    />
  );
}
