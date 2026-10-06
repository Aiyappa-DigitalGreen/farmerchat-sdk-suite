/**
 * AccountBenefits interstitial (docs/01 §3.5) + AccountSuccess (docs/01 §3.6)
 * — both are FullScreenMessage layouts.
 */
import React, { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { AnalyticsEvents, ScreenNames } from '../../core/analytics';
import { useLabel, useSdk } from '../context';
import { FullScreenMessage } from '../components/FullScreenMessage';

export function AccountBenefitsScreen(props: {
  onSignUp: () => void;
  onSkip: () => void;
}): React.ReactElement {
  const sdk = useSdk();
  const label = useLabel();

  useEffect(() => {
    sdk.analytics.trackScreenView(ScreenNames.ACCOUNT_BENEFIT);
    return () => sdk.analytics.trackScreenExit(ScreenNames.ACCOUNT_BENEFIT);
  }, [sdk]);

  return (
    <FullScreenMessage
      title={label('fc_v2_app_label_sign_up', 'Sign up')}
      subtitle={label(
        'account_benefits_subtitle',
        'Save your questions and answers',
      )}
      illustration="LOOKING_AT_CAMERA"
      primaryLabel={label('fc_v2_app_label_sign_up_phone_number', 'Sign up with phone number')}
      onPrimary={() => {
        sdk.analytics.track(AnalyticsEvents.ACCOUNT_BENEFIT_SCREEN_PROCEED, {});
        props.onSignUp();
      }}
      secondaryLabel={label('fc_v2_app_label_skip', 'Skip')}
      onSecondary={() => {
        sdk.analytics.track(AnalyticsEvents.ACCOUNT_BENEFIT_SCREEN_SKIP, {});
        props.onSkip();
      }}
    />
  );
}

export function AccountSuccessScreen(props: {
  onContinue: () => void;
}): React.ReactElement {
  const sdk = useSdk();
  const label = useLabel();

  useEffect(() => {
    sdk.analytics.trackScreenView(ScreenNames.ACCOUNT_SUCCESS);
    // BackHandler → Home (popUpTo(AccountBenefits){inclusive}) — same as Continue
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      props.onContinue();
      return true;
    });
    return () => {
      sub.remove();
      sdk.analytics.trackScreenExit(ScreenNames.ACCOUNT_SUCCESS);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <FullScreenMessage
      title={label('account_success_title', "You're all set!")}
      subtitle={label(
        'account_success_subtitle',
        'Your questions and answers are now saved to your account',
      )}
      illustration="LOOKING_AT_SKY"
      primaryLabel={label('fc_v2_app_label_continue', 'Continue')}
      onPrimary={() => {
        sdk.analytics.track(AnalyticsEvents.SIGNUP_CONTINUE_CLICKED, {});
        props.onContinue();
      }}
    />
  );
}
