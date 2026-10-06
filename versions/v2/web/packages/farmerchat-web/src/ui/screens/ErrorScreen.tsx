/**
 * Error / NoInternet (docs/01 §3.14): full-screen green FullScreenMessage,
 * NO_INTERNET vs API_ERROR copy, illustration, primary "Try again" with
 * debounce, per-fromScreen retry semantics handled by the router.
 */

import { useEffect, useRef } from 'react';
import { FullScreenMessage, Icon } from '../components/common';
import { useLabel, useSdk } from '../context';
import { Screens } from '../../core/analytics';

export function ErrorScreen(props: { isNetworkError: boolean; fromScreen: string; onTryAgain: () => void }) {
  const { services } = useSdk();
  const label = useLabel();
  const debounceRef = useRef(0);

  useEffect(() => {
    services.analytics.screenView(Screens.ERROR, { from_screen: props.fromScreen, is_network_error: props.isNetworkError });
    return () => services.analytics.screenExit(Screens.ERROR);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title = props.isNetworkError
    ? label('fc_v2_app_label_no_internet_connection', 'No internet connection')
    : label('fc_v2_app_label_something_went_wrong', 'Something went wrong');
  const subtitle = props.isNetworkError
    ? label('error_no_internet_subtitle', 'Please check your network and try again.')
    : label('error_api_subtitle', 'We had trouble reaching FarmerChat. Please try again.');

  return (
    <FullScreenMessage
      title={title}
      subtitle={subtitle}
      illustration={Icon.sky}
      primaryLabel={label('fc_v2_app_label_try_again', 'Try again')}
      onPrimary={() => {
        // enablePrimaryDebounce parity (docs/01 §3.14).
        const now = Date.now();
        if (now - debounceRef.current < 800) return;
        debounceRef.current = now;
        props.onTryAgain();
      }}
    />
  );
}
