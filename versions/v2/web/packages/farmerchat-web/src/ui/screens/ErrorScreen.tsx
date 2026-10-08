/**
 * Error / NoInternet (docs/01 §3.14): full-screen green FullScreenMessage,
 * NO_INTERNET vs API_ERROR copy, illustration, primary "Try again" with
 * debounce, per-fromScreen retry semantics handled by the router.
 */

import { useEffect } from 'react';
import { FullScreenMessage } from '../components/common';
import { useLabel, useSdk } from '../context';
import { Screens } from '../../core/analytics';

export function ErrorScreen(props: { isNetworkError: boolean; fromScreen: string; onTryAgain: () => void }) {
  const { services } = useSdk();
  const label = useLabel();

  useEffect(() => {
    services.analytics.screenView(Screens.ERROR, { from_screen: props.fromScreen, is_network_error: props.isNetworkError });
    return () => services.analytics.screenExit(Screens.ERROR);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ErrorScreen.kt: app-bar title + headline + subtitle per type, the sky farmer fitted into the
  // illustration box, and "Try again" with the 1500ms Loading debounce.
  const title = props.isNetworkError
    ? label('fc_v2_app_label_no_internet_connection', 'No internet connection')
    : label('fc_v2_app_label_something_went_wrong', 'Something went wrong');
  const main = props.isNetworkError
    ? label('fc_v2_app_label_farmerchat_needs_the_internet', 'FarmerChat needs \nthe internet')
    : label('fc_v2_app_label_farmerchat_couldnt_load', "FarmerChat couldn't load");
  const subtitle = props.isNetworkError
    ? label('fc_v2_app_label_check_mobile_data_wi-fi_signal', 'Check mobile data or Wi-Fi signal')
    : label('fc_v2_app_label_please_try_again', 'Please try again');

  return (
    <FullScreenMessage
      title={title}
      mainMessage={main}
      subtitle={subtitle}
      image="sky"
      imageMode="fit"
      debounce
      primaryLabel={label('fc_v2_app_label_try_again', 'Try again')}
      onPrimary={props.onTryAgain}
    />
  );
}
