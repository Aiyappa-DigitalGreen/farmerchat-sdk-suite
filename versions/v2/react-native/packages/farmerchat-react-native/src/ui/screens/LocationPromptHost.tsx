/**
 * LocationPromptHost (docs/01 §3.15) — global overlay driven by the `useLocationPrompt` state
 * machine; a port of the Android compose host (itself the app's `ui/location/LocationPromptHost`).
 *
 *  - Interstitial: ONLY entered by the Weather chip (or after Recovery when the permission was
 *    granted in Settings). Back = cancel, Skip = continue without location.
 *  - RequestPermission / RequestEnableGps / FetchingLocation: Weather keeps the interstitial up
 *    INERT (no back/skip, CTA disabled; "Getting your location" + spinner while fetching). Every
 *    other source shows NO overlay — the system dialogs appear over the current screen.
 *  - Recovery: "We need your location" bottom sheet (square farmer image + close chip, centred
 *    copy, one "Turn on in settings" CTA). For Weather it sits over the inert interstitial inside
 *    the SAME Modal (iOS does not reliably present two stacked Modals).
 *  - Error: full-screen message per error type, NO back/skip; the CTA retries when retryable,
 *    otherwise closes the flow.
 */
import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLabel, useSdk } from '../context';
import type { UseLocationPromptResult } from '../../state/useLocationPrompt';
import { FullScreenMessage } from '../components/FullScreenMessage';
import { PrimaryButton } from '../components/Buttons';
import { FcIcon } from '../components/Icon';
import { Labels } from '../../core/labels';
import { StorageKeys } from '../../core/sessionStore';
import { farmerLookingAtPhoneSquare } from '../assets';
import { LightContentColors, typography } from '../theme';

export function LocationPromptHost(props: {
  prompt: UseLocationPromptResult;
  /**
   * True while Home is the visible screen: a location Error is then routed to the shared Error
   * screen by the graph (app HomeScreen.kt:258-266), so this host must not also render it.
   */
  suppressError?: boolean;
}): React.ReactElement | null {
  const label = useLabel();
  const { prompt, suppressError } = props;
  const { state, source } = prompt;

  if (state.kind === 'Idle') return null;

  const interstitial = (busy: 'none' | 'inert' | 'fetching') => (
    <FullScreenMessage
      appBarTitle={label(Labels.SHARE_LOCATION, 'Share Location')}
      title={label(Labels.GET_ADVICE_YOUR_AREA, 'Get advice for your area')}
      subtitle={label(
        Labels.LOCATION_HELPS_SUGGESTIONS,
        'Your location helps us suggest crops, weather, and pests near you.',
      )}
      illustration="LOOKING_AT_PHONE"
      primaryLabel={
        busy === 'fetching'
          ? label(Labels.GETTING_YOUR_LOCATION, 'Getting your location...')
          : label(Labels.SHARE_LOCATION, 'Share Location')
      }
      primaryState={busy === 'fetching' ? 'Loading' : 'Chevron'}
      primaryEnabled={busy === 'none'}
      onPrimary={busy === 'none' ? prompt.shareLocation : () => undefined}
      onBack={busy === 'none' ? prompt.cancel : undefined}
      rightLabel={busy === 'none' ? label(Labels.SKIP, 'Skip') : null}
      onRight={busy === 'none' ? prompt.skip : undefined}
    />
  );

  if (state.kind === 'Interstitial') {
    return (
      <Modal animationType="slide" onRequestClose={prompt.cancel}>
        {interstitial('none')}
      </Modal>
    );
  }

  if (
    state.kind === 'RequestPermission' ||
    state.kind === 'RequestEnableGps' ||
    state.kind === 'FetchingLocation'
  ) {
    if (source !== 'weather') return null;
    return (
      <Modal animationType="none" onRequestClose={() => undefined}>
        {interstitial(state.kind === 'FetchingLocation' ? 'fetching' : 'inert')}
      </Modal>
    );
  }

  if (state.kind === 'Recovery') {
    const sheet = (
      <RecoverySheet
        onClose={() => prompt.closeRecovery('recovery_closed')}
        onDismiss={() => prompt.closeRecovery('recovery_dismissed')}
        onOpenSettings={prompt.openRecoverySettings}
      />
    );
    if (source === 'weather') {
      return (
        <Modal
          animationType="none"
          onRequestClose={() => prompt.closeRecovery('recovery_dismissed')}
        >
          {interstitial('inert')}
          <View style={StyleSheet.absoluteFill}>{sheet}</View>
        </Modal>
      );
    }
    return (
      <Modal
        transparent
        animationType="slide"
        onRequestClose={() => prompt.closeRecovery('recovery_dismissed')}
      >
        {sheet}
      </Modal>
    );
  }

  // Error
  if (suppressError) return null;
  const copy = (() => {
    switch (state.errorType) {
      case 'NoNetwork':
        return {
          title: label(Labels.NO_INTERNET_CONNECTION, 'No internet connection'),
          main: label(Labels.FARMERCHAT_NEEDS_THE_INTERNET, 'FarmerChat needs \nthe internet'),
          sub: label(Labels.CHECK_MOBILE_DATA_WIFI_SIGNAL, 'Check mobile data or Wi-Fi signal'),
          illustration: 'LOOKING_AT_SKY' as const,
        };
      case 'GpsUnavailable':
        return {
          title: label(Labels.TURN_ON_GPS, 'Turn on GPS'),
          main: label(Labels.GET_LOCAL_ADVICE, 'Get local advice'),
          sub: label(
            Labels.LOCATION_GPS_TURNED_OFF_TURNING_HELPS,
            'Location and GPS are turned off. Turning this on helps us tailor answers to your area.',
          ),
          illustration: 'LOOKING_AT_PHONE' as const,
        };
      case 'LocationFailed':
        return {
          title: label(Labels.SOMETHING_WENT_WRONG, 'Something went wrong'),
          main: label(Labels.COULDNT_GET_YOUR_LOCATION, "Couldn't get your location"),
          sub: label(Labels.PLEASE_TRY_AGAIN, 'Please try again.'),
          illustration: 'LOOKING_AT_PHONE' as const,
        };
    }
  })();

  return (
    <Modal animationType="fade" onRequestClose={() => prompt.dismiss()}>
      <FullScreenMessage
        appBarTitle={copy.title}
        title={copy.main}
        subtitle={copy.sub}
        illustration={copy.illustration}
        primaryLabel={label(Labels.TRY_AGAIN, 'Try again')}
        onPrimary={prompt.onErrorCta}
        enablePrimaryDebounce
      />
    </Modal>
  );
}

/**
 * App "We need your location" sheet: no drag handle, 24 top corners, light surfacePrimary
 * (#ECECEE), 20/16 padding, 12 spacing; a 382-tall country farmer image (cover, 24 corners) with a
 * 44×44 white close chip (14 corners, black X) inset 12 at its top-end; centred titleLarge
 * semibold title, centred body, one 56-tall chevron CTA. Backdrop tap = dismiss.
 */
function RecoverySheet(props: {
  onClose: () => void;
  onDismiss: () => void;
  onOpenSettings: () => void;
}): React.ReactElement {
  const sdk = useSdk();
  const label = useLabel();
  const countryCode = sdk.store.getString(StorageKeys.USER_COUNTRY_CODE);
  return (
    <View style={styles.backdropRoot}>
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        onPress={props.onDismiss}
        accessibilityLabel={label(Labels.CLOSE, 'Close')}
      />
      <View style={styles.sheet}>
        <View>
          <Image
            source={farmerLookingAtPhoneSquare(countryCode)}
            resizeMode="cover"
            style={styles.image}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label(Labels.CLOSE, 'Close')}
            onPress={props.onClose}
            style={styles.closeChip}
          >
            <FcIcon name="close" size={22} tint="#000000" />
          </Pressable>
        </View>
        <View style={{ height: 4 }} />
        <Text
          style={[
            typography.titleLarge,
            styles.centered,
            { fontWeight: '600', color: LightContentColors.foregroundPrimary },
          ]}
        >
          {label(Labels.WE_NEED_YOUR_LOCATION, 'We need your location')}
        </Text>
        <Text
          style={[
            typography.bodyMedium,
            styles.centered,
            { color: LightContentColors.foregroundPrimary },
          ]}
        >
          {label(
            Labels.LOCATION_TAILOR_ADVICE,
            'Sharing your location helps FarmerChat tailor advice to your farm.',
          )}
        </Text>
        <PrimaryButton
          label={label(Labels.TURN_ON_IN_SETTINGS, 'Turn on in settings')}
          state="Chevron"
          height={56}
          onPress={props.onOpenSettings}
        />
        <View style={{ height: 8 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdropRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: LightContentColors.surfacePrimary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  image: { width: '100%', height: 382, borderRadius: 24 },
  closeChip: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: { textAlign: 'center' },
});
