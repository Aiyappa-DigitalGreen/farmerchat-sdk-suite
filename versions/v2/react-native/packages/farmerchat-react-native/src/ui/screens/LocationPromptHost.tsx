/**
 * LocationPromptHost (docs/01 §3.15) — global non-blocking overlay driven by
 * the LocationPromptState machine: Interstitial → RequestPermission →
 * RequestEnableGps → FetchingLocation → Recovery / Error. Weather flow keeps
 * the interstitial overlay during fetch; widget flow shows nothing.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLabel, useTheme } from '../context';
import type { UseLocationPromptResult } from '../../state/useLocationPrompt';
import { FullScreenMessage } from '../components/FullScreenMessage';
import { PrimaryButton } from '../components/Buttons';
import { radius, spacing, typography } from '../theme';

export function LocationPromptHost(props: {
  prompt: UseLocationPromptResult;
}): React.ReactElement | null {
  const theme = useTheme();
  const label = useLabel();
  const { prompt } = props;
  const { state, source } = prompt;

  if (state.kind === 'Idle') return null;

  // Widget flow is silent during permission/GPS/fetch (docs/01 §3.15).
  const silentDuringFetch =
    source === 'widget' &&
    (state.kind === 'RequestPermission' ||
      state.kind === 'RequestEnableGps' ||
      state.kind === 'FetchingLocation');
  if (silentDuringFetch) return null;

  if (
    state.kind === 'Interstitial' ||
    state.kind === 'RequestPermission' ||
    state.kind === 'RequestEnableGps' ||
    state.kind === 'FetchingLocation'
  ) {
    const isFetching = state.kind !== 'Interstitial';
    return (
      <Modal animationType="slide" onRequestClose={prompt.skip}>
        <FullScreenMessage
          title={label('gps_interstitial_title', 'Share Location')}
          subtitle={label(
            'gps_interstitial_subtitle',
            'Sharing your location helps us give you weather and advice for your exact area.',
          )}
          illustration="LOOKING_AT_PHONE"
          primaryLabel={
            isFetching
              ? label('gps_fetching', 'Getting your location…')
              : label('gps_share', 'Share location')
          }
          primaryLoading={isFetching}
          onPrimary={prompt.shareLocation}
          secondaryLabel={label('gps_skip', 'Skip')}
          onSecondary={prompt.skip}
          onClose={prompt.skip}
        />
      </Modal>
    );
  }

  if (state.kind === 'Recovery') {
    // "We need your location" bottom sheet → "Turn on in settings"
    return (
      <Modal transparent animationType="slide" onRequestClose={prompt.dismissError}>
        <Pressable
          style={[styles.sheetBackdrop, { backgroundColor: theme.overlay }]}
          onPress={prompt.dismissError}
        >
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.surfaceElevated }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[typography.subheading, { color: theme.textPrimary }]}>
              {label('gps_recovery_title', 'We need your location')}
            </Text>
            <Text style={[typography.body, { color: theme.textSecondary }]}>
              {label(
                'gps_recovery_subtitle',
                'Location permission is turned off. Allow it in settings to get local advice.',
              )}
            </Text>
            <PrimaryButton
              label={label('gps_recovery_cta', 'Turn on in settings')}
              onPress={prompt.retryFromRecovery}
            />
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  // Error states per LocationErrorType
  const errorCopy = (() => {
    switch (state.errorType) {
      case 'NoNetwork':
        return {
          title: label('gps_error_no_network_title', 'No internet connection'),
          subtitle: label(
            'gps_error_no_network_subtitle',
            'Please check your network and try again.',
          ),
        };
      case 'GpsUnavailable':
        return {
          title: label('gps_error_gps_title', 'Turn on GPS'),
          subtitle: label(
            'gps_error_gps_subtitle',
            'Your GPS is turned off. Turn it on to share your location.',
          ),
        };
      case 'LocationFailed':
        return {
          title: label('gps_error_failed_title', "Couldn't get your location"),
          subtitle: label(
            'gps_error_failed_subtitle',
            'We could not find your location. Please try again.',
          ),
        };
    }
  })();

  return (
    <Modal animationType="fade" onRequestClose={prompt.dismissError}>
      <FullScreenMessage
        title={errorCopy.title}
        subtitle={errorCopy.subtitle}
        illustration="LOOKING_AT_SKY"
        primaryLabel={label('gps_error_retry', 'Try again')}
        onPrimary={prompt.shareLocation}
        secondaryLabel={label('gps_skip', 'Skip')}
        onSecondary={prompt.dismissError}
        onClose={prompt.dismissError}
        enablePrimaryDebounce
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
  },
});
