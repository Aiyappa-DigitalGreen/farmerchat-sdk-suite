/**
 * Error / NoInternet screen (docs/01 §3.14) — FullScreenMessage with
 * NO_INTERNET vs API_ERROR copy, LOOKING_AT_SKY illustration and a debounced
 * Try-again whose behavior varies by `fromScreen` (handled in the nav graph).
 */
import React, { useEffect } from 'react';
import { useLabel, useSdk } from '../context';
import { FullScreenMessage } from '../components/FullScreenMessage';
import { Labels } from '../../core/labels';

export function ErrorScreen(props: {
  isNetworkError: boolean;
  fromScreen: string;
  onTryAgain: () => void;
}): React.ReactElement {
  const sdk = useSdk();
  const label = useLabel();

  useEffect(() => {
    sdk.analytics.trackScreenView('Error Screen', {
      error_type: props.isNetworkError ? 'NO_INTERNET' : 'API_ERROR',
      from_screen: props.fromScreen,
    });
    return () => sdk.analytics.trackScreenExit('Error Screen');
  }, [props.fromScreen, props.isNetworkError, sdk]);

  // App NoInternetScreen.kt (NO_INTERNET / API_ERROR copy; compose ErrorScreen.kt:40-74).
  const [title, mainMessage, subtitle] = props.isNetworkError
    ? [
        label(Labels.NO_INTERNET_CONNECTION, 'No internet connection'),
        label(Labels.FARMERCHAT_NEEDS_THE_INTERNET, 'FarmerChat needs \nthe internet'),
        label(Labels.CHECK_MOBILE_DATA_WIFI_SIGNAL, 'Check mobile data or Wi-Fi signal'),
      ]
    : [
        label(Labels.SOMETHING_WENT_WRONG, 'Something went wrong'),
        label(Labels.FARMERCHAT_COULDNT_LOAD, "FarmerChat couldn't load"),
        label(Labels.PLEASE_TRY_AGAIN, 'Please try again'),
      ];

  return (
    <FullScreenMessage
      title={title}
      mainMessage={mainMessage}
      subtitle={subtitle}
      illustration="LOOKING_AT_SKY"
      illustrationStyle="fit"
      primaryLabel={label(Labels.TRY_AGAIN, 'Try again')}
      onPrimary={props.onTryAgain}
      enablePrimaryDebounce
    />
  );
}
