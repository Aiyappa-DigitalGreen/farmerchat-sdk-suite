/**
 * LocationPromptHost (docs/01 §3.15), web-adapted: global non-blocking overlay
 * driven by the LocationPromptState machine. Interstitial → FullScreenMessage
 * "Share Location"; weather flow keeps the interstitial with a loading CTA
 * during permission/fetch; Recovery → bottom sheet "We need your location";
 * Error → FullScreenMessage per LocationErrorType.
 */

import { FullScreenMessage, Icon, PrimaryButton } from '../components/common';
import { useLabel } from '../context';
import type { LocationPromptState, LocationPromptActions } from '../../state/useLocationPrompt';

export function LocationPromptOverlay(props: { state: LocationPromptState; actions: LocationPromptActions }) {
  const label = useLabel();
  const { state, actions } = props;

  if (state.kind === 'Idle') return null;

  if (state.kind === 'Recovery') {
    return (
      <>
        <div className="fcsdk-drawer-scrim" onClick={actions.dismissError} />
        <div className="fcsdk-bottomsheet" role="dialog" aria-label={label('location_recovery_title', 'We need your location')}>
          <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 6 }}>{label('location_recovery_title', 'We need your location')}</div>
          <div style={{ color: 'var(--fc-text-muted)', marginBottom: 14 }}>
            {label('location_recovery_subtitle', 'Location access is blocked. Allow it in your browser settings, then try again.')}
          </div>
          <PrimaryButton label={label('location_recovery_cta', 'Try again')} onClick={() => void actions.retry()} />
          <div style={{ height: 8 }} />
          <PrimaryButton label={label('location_skip', 'Not now')} onClick={actions.dismissError} light />
        </div>
      </>
    );
  }

  if (state.kind === 'Error') {
    const copy =
      state.errorType === 'NoNetwork'
        ? {
            title: label('location_error_network_title', 'No internet connection'),
            sub: label('location_error_network_subtitle', 'Please check your network and try again.'),
          }
        : state.errorType === 'GpsUnavailable'
          ? {
              title: label('location_error_gps_title', 'Location unavailable'),
              sub: label('location_error_gps_subtitle', 'Your browser does not support location, or it is turned off.'),
            }
          : {
              title: label('location_error_failed_title', "Couldn't get your location"),
              sub: label('location_error_failed_subtitle', 'Something went wrong while finding your location. Please try again.'),
            };
    return (
      <div className="fcsdk-modal-scrim" style={{ padding: 0 }}>
        <div style={{ width: '100%', height: '100%', display: 'flex' }}>
          <FullScreenMessage
            title={copy.title}
            subtitle={copy.sub}
            illustration={Icon.sky}
            primaryLabel={label('location_error_retry', 'Try again')}
            onPrimary={() => void actions.retry()}
            secondaryLabel={label('location_skip', 'Not now')}
            onSecondary={actions.dismissError}
            onClose={actions.dismissError}
          />
        </div>
      </div>
    );
  }

  // Interstitial + weather-flow loading states keep the interstitial overlay.
  const isBusy = state.kind === 'RequestPermission' || state.kind === 'RequestEnableGps' || state.kind === 'FetchingLocation';
  if (isBusy && state.source !== 'weather' && state.kind !== 'RequestPermission') {
    // Widget flow shows nothing during fetch (docs/01 §3.15).
    return null;
  }

  return (
    <div className="fcsdk-modal-scrim" style={{ padding: 0 }}>
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        <FullScreenMessage
          title={label('location_interstitial_title', 'Share Location')}
          subtitle={label('location_interstitial_subtitle', 'Share your location to get weather updates and advice for your exact area.')}
          illustration={Icon.phone}
          primaryLabel={isBusy ? label('location_fetching', 'Getting your location…') : label('location_share_cta', 'Share location')}
          primaryLoading={isBusy}
          onPrimary={() => {
            if (!isBusy) void actions.shareLocation();
          }}
          secondaryLabel={label('location_skip', 'Not now')}
          onSecondary={actions.skip}
          onClose={actions.skip}
        />
      </div>
    </div>
  );
}
