/**
 * Settings (docs/01 §3.10) — 1:1 with the Compose SettingsScreen: DefaultAppBar,
 * Day/Night/Auto mode buttons (mode icons, translucent-green selected fill),
 * appearance hint line, "Account details" ListCard with the name row, and a
 * Logout/Sign up secondary button. "Your name has been updated." toast.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AnalyticsEvents, ScreenNames } from '../../core/analytics';
import type { AppearanceMode } from '../../core/config';
import { Labels } from '../../core/labels';
import { StorageKeys } from '../../core/sessionStore';
import type { UseLocationPromptResult } from '../../state/useLocationPrompt';
import { isLocationObtained } from '../../core/locationOutcome';
import { LocationPinGlyph } from '../components/LocationChatBubble';
import { useLabel, useSdk, useSdkContext, useTheme } from '../context';
import { SecondaryButton } from '../components/Buttons';
import { DefaultAppBar, Toast, useToastState } from '../components/Chrome';
import { ListCard, ListItem } from '../components/Cards';
import { FcIcon } from '../components/Icon';
import type { IconName } from '../assets';
import { Green700, radius, spacing, typography } from '../theme';

function AppearanceModeButton(props: {
  icon: IconName;
  labelText: string;
  selected: boolean;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const c = theme.content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.selected }}
      onPress={props.onPress}
      style={[
        styles.appearanceButton,
        { backgroundColor: props.selected ? c.surfaceActive : c.surfaceSecondary },
      ]}
    >
      <FcIcon
        name={props.icon}
        size={26}
        tint={props.selected ? c.borderActive : c.foregroundPrimary}
      />
      <Text style={[typography.labelMedium, { color: c.foregroundPrimary }]}>
        {props.labelText}
      </Text>
    </Pressable>
  );
}

export function SettingsScreen(props: {
  onOpenDrawer: () => void;
  onNameClick: () => void;
  onSignUpClick: () => void;
  onLogOutClick: () => void;
  showNameUpdatedToast: boolean;
  onNameToastShown: () => void;
  /** Shared location flow — drives the "My Farm" Location row (2.0.0). */
  locationPrompt: UseLocationPromptResult;
}): React.ReactElement {
  const theme = useTheme();
  const c = theme.content;
  const sdk = useSdk();
  const label = useLabel();
  const { appearanceMode, setAppearanceMode } = useSdkContext();
  const { toast, showToast } = useToastState();
  const isAuthenticated = sdk.session.isAuthenticated;
  const userName = sdk.store.getString(StorageKeys.USER_NAME);

  useEffect(() => {
    sdk.analytics.trackScreenView(ScreenNames.SETTINGS);
    return () => sdk.analytics.trackScreenExit(ScreenNames.SETTINGS);
  }, [sdk]);

  useEffect(() => {
    if (!props.showNameUpdatedToast) return;
    const timer = setTimeout(() => {
      showToast(
        label(Labels.YOUR_NAME_HAS_UPDATED, 'Your name has been updated.'),
        'success',
      );
      props.onNameToastShown();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.showNameUpdatedToast]);

  // ---- My Farm → Location row (app SettingsScreen.kt:230-300) ----
  const { locationPrompt } = props;
  // A stored fix only counts as "exact" while the permission is still held; re-checked whenever
  // the flow changes state and when the app returns to the foreground (permission changes in
  // system Settings).
  const [hasPermission, setHasPermission] = useState(false);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void locationPrompt.hasLocationPermission().then((granted) => {
        if (alive) setHasPermission(granted);
      });
    };
    refresh();
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') refresh();
    });
    return () => {
      alive = false;
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationPrompt.state.kind]);
  const hasExactLocation = locationPrompt.hasKnownLocation() && hasPermission;
  // The RN store has no APPROX_LOCATION_NAME; same district → state → country chain as the Home
  // pill.
  const locationPlaceName = (
    sdk.store.getString(StorageKeys.USER_DISTRICT) ??
    sdk.store.getString(StorageKeys.USER_STATE) ??
    sdk.store.getString(StorageKeys.USER_COUNTRY_NAME) ??
    ''
  ).trim();
  // Only reacts to states raised by THIS row, so Home's own flow does not animate it.
  const isSettingsLocationFlowActive =
    locationPrompt.source === 'settings' &&
    (locationPrompt.state.kind === 'RequestPermission' ||
      locationPrompt.state.kind === 'RequestEnableGps' ||
      locationPrompt.state.kind === 'FetchingLocation');
  const labelRef = useRef(label);
  labelRef.current = label;
  useEffect(
    () =>
      locationPrompt.addEventListener((event) => {
        if (event.kind !== 'Continue' || event.source !== 'settings') return;
        if (!isLocationObtained(event)) return;
        showToast(labelRef.current(Labels.LOCATION_FOUND, 'Location found'), 'success');
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locationPrompt],
  );
  const locationRightText = isSettingsLocationFlowActive
    ? label(Labels.GETTING_YOUR_LOCATION, 'Getting your location')
    : locationPlaceName.length === 0
      ? '—'
      : !hasExactLocation
        ? `${locationPlaceName} (${label(Labels.APPROXIMATE, 'approximate')})`
        : locationPlaceName;

  const appearanceHint =
    appearanceMode === 'day'
      ? label(Labels.FARMERCHAT_ALWAYS_LIGHT_MODE, 'FarmerChat is always in light mode')
      : appearanceMode === 'night'
        ? label(Labels.FARMERCHAT_ALWAYS_DARK_MODE, 'FarmerChat is always in dark mode')
        : label(
            Labels.FARMERCHAT_ADJUSTS_YOUR_PHONE_SETTINGS,
            'FarmerChat adjusts to your phone settings',
          );

  const selectAppearance = (mode: AppearanceMode) => {
    sdk.analytics.track(AnalyticsEvents.SETTINGS_OPTION_SELECTED, { option: 'appearance', value: mode });
    setAppearanceMode(mode);
  };

  return (
    <View style={[styles.container, { backgroundColor: c.surfacePrimary }]}>
      <DefaultAppBar
        title={label(Labels.SETTINGS, 'Settings')}
        navIcon="menu"
        onNavPress={props.onOpenDrawer}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* App parity (SettingsScreen.kt:137): labelLarge, not titleSmall. */}
        <Text style={[typography.labelLarge, { color: c.foregroundPrimary }]}>
          {label(Labels.APPEARANCE, 'Appearance')}
        </Text>
        <View style={styles.appearanceRow}>
          <AppearanceModeButton
            icon="modeDay"
            labelText={label(Labels.DAY, 'Day')}
            selected={appearanceMode === 'day'}
            onPress={() => selectAppearance('day')}
          />
          <AppearanceModeButton
            icon="modeNight"
            labelText={label(Labels.NIGHT, 'Night')}
            selected={appearanceMode === 'night'}
            onPress={() => selectAppearance('night')}
          />
          <AppearanceModeButton
            icon="modeAuto"
            labelText={label(Labels.AUTO, 'Auto')}
            selected={appearanceMode === 'auto'}
            onPress={() => selectAppearance('auto')}
          />
        </View>
        <Text style={[typography.bodySmall, { color: c.foregroundSecondary }]}>
          {appearanceHint}
        </Text>

        {/* My Farm (2.0.0) — app SettingsScreen.kt:195-300. */}
        <Text style={[typography.labelLarge, { color: c.foregroundPrimary, marginTop: 4 }]}>
          {label(Labels.MY_FARM, 'My Farm')}
        </Text>
        <View style={{ gap: 10 }}>
          <ListCard>
            <Pressable
              accessibilityRole="button"
              testID="fc-settings-location"
              onPress={() => {
                if (locationPrompt.isIdle()) locationPrompt.triggerFromSettings();
              }}
              style={({ pressed }) => [styles.locationRow, pressed && { opacity: 0.7 }]}
            >
              <LocationPinGlyph size={22} color={c.foregroundPrimary} holeColor={c.surfaceSecondary} />
              <Text style={[typography.bodyMedium, { color: c.foregroundPrimary }]}>
                {label(Labels.LOCATION, 'Location')}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  typography.bodyMedium,
                  { color: c.foregroundSecondary, flex: 1, textAlign: 'right' },
                ]}
              >
                {locationRightText}
              </Text>
              {isSettingsLocationFlowActive ? (
                <ActivityIndicator size="small" color={c.foregroundSecondary} />
              ) : null}
            </Pressable>
          </ListCard>
          <Text style={[typography.bodySmall, { color: c.foregroundSecondary }]}>
            {hasExactLocation
              ? label(Labels.LOCATION_HELPER_ADVICE_WEATHER, 'Advice and weather for this area.')
              : `${label(Labels.ESTIMATED, 'Estimated')}.`}{' '}
            <Text style={{ color: Green700 }}>
              {hasExactLocation
                ? label(Labels.LOCATION_HELPER_CHANGE_ANYTIME, 'Change anytime.')
                : label(Labels.LOCATION_HELPER_SHARE, 'Share your location for better advice.')}
            </Text>
          </Text>
        </View>

        {/* App parity (SettingsScreen.kt:302): labelLarge, not titleSmall. */}
        <Text style={[typography.labelLarge, { color: c.foregroundPrimary, marginTop: 4 }]}>
          {label(Labels.ACCOUNT_DETAILS, 'Account details')}
        </Text>
        <ListCard>
          <ListItem
            label={label(Labels.YOUR_NAME, 'Your name')}
            sublabel={userName ?? null}
            onPress={() => {
              sdk.analytics.track(AnalyticsEvents.EDIT_PROFILE_CLICK, {});
              props.onNameClick();
            }}
            testID="fc-settings-name"
          />
        </ListCard>

        {isAuthenticated ? (
          <SecondaryButton
            label={label(Labels.LOGOUT, 'Logout')}
            onPress={props.onLogOutClick}
            testID="fc-settings-logout"
          />
        ) : (
          <SecondaryButton
            label={label(Labels.SIGN_UP, 'Sign up')}
            onPress={props.onSignUpClick}
            testID="fc-settings-signup"
          />
        )}
      </ScrollView>
      <Toast toast={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  appearanceRow: { flexDirection: 'row', gap: spacing.sm },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  appearanceButton: {
    flex: 1,
    height: 76,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    paddingVertical: 12,
  },
});
