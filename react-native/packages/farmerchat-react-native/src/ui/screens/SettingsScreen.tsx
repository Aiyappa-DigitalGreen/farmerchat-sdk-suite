/**
 * Settings (docs/01 §3.10) — 1:1 with the Compose SettingsScreen: DefaultAppBar,
 * Day/Night/Auto mode buttons (mode icons, translucent-green selected fill),
 * appearance hint line, "Account details" ListCard with the name row, and a
 * Logout/Sign up secondary button. "Your name has been updated." toast.
 */
import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnalyticsEvents, ScreenNames } from '../../core/analytics';
import type { AppearanceMode } from '../../core/config';
import { Labels } from '../../core/labels';
import { StorageKeys } from '../../core/sessionStore';
import { useLabel, useSdk, useSdkContext, useTheme } from '../context';
import { SecondaryButton } from '../components/Buttons';
import { DefaultAppBar, Toast, useToastState } from '../components/Chrome';
import { ListCard, ListItem } from '../components/Cards';
import { FcIcon } from '../components/Icon';
import type { IconName } from '../assets';
import { radius, spacing, typography } from '../theme';

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
        <Text style={[typography.titleSmall, { color: c.foregroundPrimary }]}>
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

        <Text style={[typography.titleSmall, { color: c.foregroundPrimary, marginTop: 4 }]}>
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
  appearanceButton: {
    flex: 1,
    height: 76,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    paddingVertical: 12,
  },
});
