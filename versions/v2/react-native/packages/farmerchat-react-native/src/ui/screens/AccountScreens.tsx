/**
 * AccountBenefits interstitial (docs/01 §3.5) + AccountSuccess (docs/01 §3.6)
 * — both are FullScreenMessage layouts.
 */
import React, { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { AnalyticsEvents, ScreenNames } from '../../core/analytics';
import { useLabel, useSdk } from '../context';
import { FullScreenMessage } from '../components/FullScreenMessage';
import { Labels } from '../../core/labels';

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
    // App AppNavGraph.kt:800-835 (AccountBenefits): rounded ArrowBack (popBackStack) + rounded
    // "Skip", LOOKING_AT_CAMERA card, subtitle bodyLarge, chevron CTA.
    <FullScreenMessage
      title={label(Labels.SIGN_UP, 'Sign up')}
      mainMessage={label(Labels.SAVE_YOUR_QUESTIONS_ANSWERS, 'Save your questions\nand answers')}
      subtitle={label(
        Labels.WELL_SAVE_YOUR_CHATS_YOU_CONTINUE,
        "We'll save your chats so you can continue later.",
      )}
      subtitleLarge
      illustration="LOOKING_AT_CAMERA"
      illustrationStyle="card"
      primaryLabel={label(Labels.SIGN_UP_PHONE_NUMBER, 'Sign up with phone number')}
      primaryState="Chevron"
      onPrimary={() => {
        sdk.analytics.track(AnalyticsEvents.ACCOUNT_BENEFIT_SCREEN_PROCEED, {});
        props.onSignUp();
      }}
      onBack={() => {
        sdk.analytics.track(AnalyticsEvents.ACCOUNT_BENEFIT_SCREEN_SKIP, {});
        props.onSkip();
      }}
      rightLabel={label(Labels.SKIP, 'Skip')}
      onRight={() => {
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
    // App AccountSuccessScreen.kt:55-85: title SIGN_UP, "You're all set!", bodyLarge subtitle,
    // LOOKING_AT_SKY card, no bar buttons.
    <FullScreenMessage
      title={label(Labels.SIGN_UP, 'Sign up')}
      mainMessage={label(Labels.YOURE_ALL_SET, "You're all set!")}
      subtitle={label(
        Labels.PREVIOUS_QUESTIONS_MENU,
        'Find your previous questions in the menu and continue anytime.',
      )}
      subtitleLarge
      illustration="LOOKING_AT_SKY"
      illustrationStyle="card"
      primaryLabel={label(Labels.CONTINUE, 'Continue')}
      onPrimary={() => {
        sdk.analytics.track(AnalyticsEvents.SIGNUP_CONTINUE_CLICKED, {});
        props.onContinue();
      }}
    />
  );
}
