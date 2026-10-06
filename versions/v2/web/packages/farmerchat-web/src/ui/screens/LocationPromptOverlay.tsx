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
 * Illustrations: the web SDK bundles no image assets (every illustration is a glyph — see
 * `components/common.tsx` Icon), so the app's country `farmer_looking_at_*` images are rendered as
 * the existing glyphs in the same slots and sizes.
 */

import { FullScreenMessage, Icon, PrimaryButton } from '../components/common';
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
            image: Icon.sky,
          }
        : state.errorType === 'GpsUnavailable'
          ? {
              title: label('fc_v2_app_label_turn_on_gps', 'Turn on GPS'),
              main: label('fc_v2_app_label_get_local_advice', 'Get local advice'),
              sub: label(
                'fc_v2_app_label_location_gps_turned_off_turning_helps',
                'Location and GPS are turned off. Turning this on helps us tailor answers to your area.',
              ),
              image: Icon.phone,
            }
          : {
              title: label('fc_v2_app_label_something_went_wrong', 'Something went wrong'),
              main: label('fc_v2_app_label_couldnt_get_your_location', "Couldn't get your location"),
              sub: label('fc_v2_app_label_please_try_again', 'Please try again.'),
              image: Icon.phone,
            };
    return (
      <div className="fcsdk-modal-scrim fcsdk-location-layer">
        <FullScreenMessage
          title={copy.title}
          mainMessage={copy.main}
          subtitle={copy.sub}
          illustration={copy.image}
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
        illustration={Icon.phone}
        illustrationNode={
          <div className="fcsdk-location-illustration">
            <span>{Icon.phone}</span>
          </div>
        }
        primaryLabel={
          fetching
            ? label('fc_v2_app_label_getting_your_location', 'Getting your location...')
            : label('fc_v2_app_label_share_location', 'Share Location')
        }
        primaryLoading={fetching}
        primaryDisabled={!interactive}
        primaryState="chevron"
        onPrimary={() => {
          if (interactive) actions.onInterstitialCta();
        }}
        onBack={interactive ? actions.cancel : undefined}
        rightLabel={interactive ? label('fc_v2_app_label_skip', 'Skip') : undefined}
        onRight={interactive ? () => actions.continueWithoutLocation('skip') : undefined}
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
function RecoverySheet(props: { onDismiss: () => void; onClose: () => void; onOpenSettings: () => void }) {
  const label = useLabel();
  return (
    <>
      <div className="fcsdk-drawer-scrim fcsdk-location-sheet-scrim" onClick={props.onDismiss} />
      <div
        className="fcsdk-bottomsheet fcsdk-location-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label('fc_v2_app_label_we_need_your_location', 'We need your location')}
      >
        <div className="fcsdk-location-sheet-image">
          <span aria-hidden>{Icon.farmer}</span>
          <button type="button" className="fcsdk-location-sheet-close" aria-label="close" onClick={props.onClose}>
            {Icon.close}
          </button>
        </div>
        <div className="fcsdk-location-sheet-spacer" />
        <div className="fcsdk-location-sheet-title">
          {label('fc_v2_app_label_we_need_your_location', 'We need your location')}
        </div>
        <div className="fcsdk-location-sheet-body">
          {label(
            'fc_v2_app_label_location_tailor_advice',
            'Sharing your location helps FarmerChat tailor advice to your farm.',
          )}
        </div>
        <div className="fcsdk-location-sheet-cta">
          <PrimaryButton
            label={label('fc_v2_app_label_turn_on_in_settings', 'Turn on in settings')}
            state="chevron"
            onClick={props.onOpenSettings}
          />
        </div>
      </div>
    </>
  );
}
