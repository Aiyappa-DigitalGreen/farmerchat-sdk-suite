/**
 * Error / NoInternet screen (docs/01 §3.14) — FullScreenMessage with
 * NO_INTERNET vs API_ERROR copy, LOOKING_AT_SKY illustration and a debounced
 * Try-again whose behavior varies by `fromScreen` (handled in the nav graph).
 */
import React, { useEffect } from 'react';
import { useLabel, useSdk } from '../context';
import { FullScreenMessage } from '../components/FullScreenMessage';

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

  const title = props.isNetworkError
    ? label('error_no_internet_title', 'No internet connection')
    : label('error_api_title', 'Something went wrong');
  const subtitle = props.isNetworkError
    ? label(
        'error_no_internet_subtitle',
        'Please check your mobile data or Wi-Fi and try again.',
      )
    : label(
        'error_api_subtitle',
        'We had trouble reaching FarmerChat. Please try again in a moment.',
      );

  return (
    <FullScreenMessage
      title={title}
      subtitle={subtitle}
      illustration="LOOKING_AT_SKY"
      primaryLabel={label('error_try_again', 'Try again')}
      onPrimary={props.onTryAgain}
      enablePrimaryDebounce
    />
  );
}
