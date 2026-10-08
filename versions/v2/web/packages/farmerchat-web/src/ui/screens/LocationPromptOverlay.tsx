/**
 * LocationPromptHost (docs/01 §3.15) — web port of the Android SDK's compose
 * `screens/LocationPromptHost.kt` (itself the app's `ui/location/LocationPromptHost.kt`).
 * The browser side effects (permission prompt, fetch) live in `useLocationPrompt`; this renders
 * per state:
 *
 *  • Interstitial — WEATHER entry only: "Share Location" full-screen message with Back + Skip.
 *  • RequestPermission / RequestEnableGps / FetchingLocation — Weather keeps the interstitial up
 *    but INERT (no Back/Skip, CTA disabled; "Getting your location" + spinner while fetching).
 *    Every other source renders nothing: the browser prompt appears over the current screen.
 *  • Recovery — "We need your location" bottom sheet (over the inert interstitial for Weather).
 *  • Error — full-screen message per type, NO Back/Skip; the CTA retries or closes the flow.
 *
 * Illustrations: the app's country `farmer_looking_at_*` images, served from `config.assetBaseUrl`
 * (see FarmerIllustration).
 */

import { FarmerIllustration, FullScreenMessage, PrimaryButton } from '../components/common';
import { FcIcon } from '../components/FcIcon';
import { useLabel } from '../context';
import type { LocationPromptState, LocationPromptActions } from '../../state/useLocationPrompt';

export function LocationPromptOverlay(props: {
  state: LocationPromptState;
  actions: LocationPromptActions;
  /**
   * True while Home is the visible screen: Home routes a location Error to the shared Error
   * screen itself (app HomeScreen.kt:258-266), so the overlay must not draw it too.
   */
  hideError?: boolean;
}) {
  const label = useLabel();
  const { state, actions } = props;

  if (state.kind === 'Idle') return null;

  if (state.kind === 'Error') {
    if (props.hideError) return null;
    const copy =
      state.errorType === 'NoNetwork'
        ? {
            title: label('fc_v2_app_label_no_internet_connection', 'No internet connection'),
            main: label('fc_v2_app_label_farmerchat_needs_the_internet', 'FarmerChat needs the internet'),
            sub: label('fc_v2_app_label_check_mobile_data_wi-fi_signal', 'Check mobile data or Wi-Fi signal'),
            image: 'sky' as const,
          }
        : state.errorType === 'GpsUnavailable'
          ? {
              title: label('fc_v2_app_label_turn_on_gps', 'Turn on GPS'),
              main: label('fc_v2_app_label_get_local_advice', 'Get local advice'),
              sub: label(
                'fc_v2_app_label_location_gps_turned_off_turning_helps',
                'Location and GPS are turned off. Turning this on helps us tailor answers to your area.',
              ),
              image: 'phone' as const,
            }
          : {
              title: label('fc_v2_app_label_something_went_wrong', 'Something went wrong'),
              main: label('fc_v2_app_label_couldnt_get_your_location', "Couldn't get your location"),
              sub: label('fc_v2_app_label_please_try_again', 'Please try again.'),
              image: 'phone' as const,
            };
    return (
      <div className="fcsdk-modal-scrim fcsdk-location-layer">
        <FullScreenMessage
          title={copy.title}
          mainMessage={copy.main}
          subtitle={copy.sub}
          image={copy.image}
          imageMode="crop"
          debounce
          primaryLabel={label('fc_v2_app_label_try_again', 'Try again')}
          onPrimary={actions.onErrorCta}
        />
      </div>
    );
  }

  const isWeather = state.source === 'weather';
  const isBusy = state.kind === 'RequestPermission' || state.kind === 'RequestEnableGps' || state.kind === 'FetchingLocation';

  // Non-weather sources: no overlay while the browser prompt / fetch runs.
  if (isBusy && !isWeather) return null;

  const fetching = state.kind === 'FetchingLocation';
  const interactive = state.kind === 'Interstitial';
  const showInterstitial = state.kind === 'Interstitial' || isWeather;

  const interstitial = showInterstitial ? (
    <div className="fcsdk-modal-scrim fcsdk-location-layer">
      <FullScreenMessage
        title={label('fc_v2_app_label_share_location', 'Share Location')}
        mainMessage={label('fc_v2_app_label_get_advice_your_area', 'Get advice for your area')}
        subtitle={label(
          'fc_v2_app_label_location_helps_suggestions',
          'Your location helps us suggest crops, weather, and pests near you.',
        )}
        image="phone"
        imageMode="fit"
        primaryLabel={
          fetching
            ? label('fc_v2_app_label_getting_your_location', 'Getting your location...')
            : label('fc_v2_app_label_share_location', 'Share Location')
        }
        primaryLoading={fetching}
        primaryInert={!interactive}
        primaryState="chevron"
        onPrimary={() => {
          if (interactive) actions.onInterstitialCta();
        }}
        left={interactive ? { icon: 'm_arrow_back', ariaLabel: 'back', radius: 'md', onClick: actions.cancel } : undefined}
        right={interactive ? { label: label('fc_v2_app_label_skip', 'Skip'), radius: 'md', onClick: () => actions.continueWithoutLocation('skip') } : undefined}
      />
    </div>
  ) : null;

  if (state.kind === 'Recovery') {
    return (
      <>
        {interstitial}
        <RecoverySheet
          onDismiss={() => actions.closeRecovery('recovery_dismissed')}
          onClose={() => actions.closeRecovery('recovery_closed')}
          onOpenSettings={actions.openRecoverySettings}
        />
      </>
    );
  }

  return interstitial;
}

/** App "We need your location" sheet: square farmer image with a close chip, centred copy, one CTA. */
/**
 * LocationPromptHost.kt Recovery sheet (M3 ModalBottomSheet): forced-light #ECECEE, top radius 24,
 * max 640 wide, a 382dp square-farmer image (radius 24) with a white close chip, a SemiBold
 * titleLarge, a bodyMedium body and a 56dp "Turn on in settings" button.
 */
function RecoverySheet(props: { onDismiss: () => void; onClose: () => void; onOpenSettings: () => void }) {
  const label = useLabel();
  return (
    <div className="fcsdk-c-sheet-host">
      <div className="fcsdk-c-sheet-scrim" onClick={props.onDismiss} />
      <div
        className="fcsdk-c-sheet fcsdk-c-recovery"
        role="dialog"
        aria-modal="true"
        aria-label={label('fc_v2_app_label_we_need_your_location', 'We need your location')}
      >
        <div className="fcsdk-c-recovery-image">
          <FarmerIllustration image="phone_square" mode="crop" />
          <button type="button" className="fcsdk-c-recovery-close" aria-label="close" onClick={props.onClose}>
            <FcIcon name="m_close" size={24} tint="#000000" />
          </button>
        </div>
        <div style={{ height: 4 }} />
        <div className="fc-t-titleLarge" style={{ fontWeight: 600, color: '#000000', textAlign: 'center' }}>
          {label('fc_v2_app_label_we_need_your_location', 'We need your location')}
        </div>
        <div className="fc-t-bodyMedium" style={{ color: '#000000', textAlign: 'center' }}>
          {label('fc_v2_app_label_location_tailor_advice', 'Sharing your location helps FarmerChat tailor advice to your farm.')}
        </div>
        <PrimaryButton
          height={56}
          label={label('fc_v2_app_label_turn_on_in_settings', 'Turn on in settings')}
          state="chevron"
          onClick={props.onOpenSettings}
        />
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}
