/**
 * Buttons — 1:1 port of the Compose SDK components/Buttons.kt:
 * PrimaryButton (Default/Chevron/Loading; Green800 surface, labelLarge, green
 * chevron/spinner accents; disabled dims content only), SecondaryButton (flat
 * surfaceSecondary), ActionButton (42dp app-bar chip), WeatherButton
 * (Green800 pill with icon + temp + green chevron), ScrollToBottomButton,
 * ListenButton.
 */
import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Assets, type IconName } from '../assets';
import { useTheme } from '../context';
import { dayTheme, radius, typography } from '../theme';
import { FcIcon } from './Icon';

export type PrimaryButtonState = 'Default' | 'Chevron' | 'Loading';

export function PrimaryButton(props: {
  label: string;
  onPress: () => void;
  state?: PrimaryButtonState;
  enabled?: boolean;
  height?: number;
  radiusOverride?: number;
  /** Force light-mode button colors regardless of theme. */
  forceLight?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}): React.ReactElement {
  const theme = useTheme();
  const state = props.state ?? 'Default';
  const enabled = props.enabled !== false && state !== 'Loading';
  const contentAlpha = props.enabled === false ? 0.5 : 1;
  const surface = props.forceLight
    ? dayTheme.content.buttonPrimarySurface
    : theme.content.buttonPrimarySurface;
  const foreground = props.forceLight
    ? dayTheme.content.buttonPrimaryForeground
    : theme.content.buttonPrimaryForeground;
  const accent = theme.content.buttonPrimaryAccent;

  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.primary,
        {
          height: props.height ?? 48,
          borderRadius: props.radiusOverride ?? radius.md,
          backgroundColor: surface,
          opacity: pressed ? 0.9 : 1,
        },
        props.style,
      ]}
    >
      <View style={styles.primaryRow}>
        <Text
          style={[
            typography.labelLarge,
            { color: foreground, opacity: contentAlpha, textAlign: 'center' },
          ]}
        >
          {props.label}
        </Text>
        {state === 'Chevron' ? (
          <FcIcon
            name="chevronRight"
            size={22}
            tint={accent}
            style={{ marginLeft: 8, opacity: contentAlpha }}
          />
        ) : null}
        {state === 'Loading' ? (
          <ActivityIndicator size="small" color={accent} style={{ marginLeft: 12 }} />
        ) : null}
      </View>
    </Pressable>
  );
}

export function SecondaryButton(props: {
  label: string;
  onPress: () => void;
  enabled?: boolean;
  isLoading?: boolean;
  icon?: IconName;
  height?: number;
  backgroundColor?: string;
  contentColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}): React.ReactElement {
  const theme = useTheme();
  const enabled = props.enabled !== false && props.isLoading !== true;
  const bg = props.backgroundColor ?? theme.content.surfaceSecondary;
  const fg = props.contentColor ?? theme.content.foregroundPrimary;
  const contentAlpha = enabled ? 1 : 0.5;
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      disabled={!enabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.secondary,
        {
          height: props.height ?? 48,
          backgroundColor: bg,
          opacity: pressed ? 0.85 : 1,
        },
        props.style,
      ]}
    >
      {props.icon ? (
        <FcIcon
          name={props.icon}
          size={24}
          tint={fg}
          style={{ marginRight: 8, opacity: contentAlpha }}
        />
      ) : null}
      <Text style={[typography.labelLarge, { color: fg, opacity: contentAlpha }]}>
        {props.label}
      </Text>
      {props.isLoading ? (
        <ActivityIndicator size="small" color={fg} style={{ marginLeft: 12 }} />
      ) : null}
    </Pressable>
  );
}

/** App-bar square/pill action chip (42dp, radius 12) — Compose ActionButton. */
export function ActionButton(props: {
  onPress: () => void;
  icon?: IconName;
  label?: string;
  background?: string;
  iconColor?: string;
  labelColor?: string;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}): React.ReactElement {
  const theme = useTheme();
  const bg = props.background ?? theme.content.buttonPrimarySurface;
  const iconColor = props.iconColor ?? theme.content.buttonPrimaryAccent;
  const labelColor = props.labelColor ?? theme.content.buttonPrimaryForeground;
  const hasLabel = !!props.label;
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      onPress={props.onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: bg,
          width: hasLabel ? undefined : 42,
          paddingHorizontal: hasLabel ? 14 : 0,
          opacity: pressed ? 0.85 : 1,
        },
        props.style,
      ]}
    >
      {props.icon ? (
        <FcIcon name={props.icon} size={props.iconSize ?? 23} tint={iconColor} />
      ) : null}
      {hasLabel ? (
        <Text
          numberOfLines={1}
          style={[
            typography.labelMedium,
            { color: labelColor, marginLeft: props.icon ? 10 : 0 },
          ]}
        >
          {props.label}
        </Text>
      ) : null}
    </Pressable>
  );
}

export type WeatherButtonState = 'Default' | 'Loading';

export function WeatherButton(props: {
  onPress: () => void;
  state?: WeatherButtonState;
  text: string;
  weatherIconUrl?: string | null;
  loadingLabel: string;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const theme = useTheme();
  const brand = theme.brand;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.weather,
        { backgroundColor: brand.surfaceSecondary, opacity: pressed ? 0.85 : 1 },
        props.style,
      ]}
    >
      {props.state === 'Loading' ? (
        <>
          <ActivityIndicator size="small" color={brand.foregroundPrimary} />
          <Text
            style={[
              typography.labelMedium,
              { color: brand.foregroundPrimary, marginLeft: 8 },
            ]}
          >
            {props.loadingLabel}
          </Text>
        </>
      ) : (
        <>
          {props.weatherIconUrl ? (
            <Image
              source={{ uri: props.weatherIconUrl }}
              style={{ width: 24, height: 24 }}
              resizeMode="contain"
            />
          ) : (
            <Image
              source={Assets.weatherSunClouds}
              style={{ width: 24, height: 24 }}
              resizeMode="contain"
            />
          )}
          <Text
            style={[
              typography.labelMedium,
              { color: brand.foregroundPrimary, marginLeft: 8 },
            ]}
          >
            {props.text}
          </Text>
          <FcIcon
            name="chevronRight"
            size={18}
            tint={brand.foregroundSecondary}
            style={{ marginLeft: 2 }}
          />
        </>
      )}
    </Pressable>
  );
}

export function ScrollToBottomButton(props: {
  visible: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement | null {
  const theme = useTheme();
  if (!props.visible) return null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={[
        styles.scrollToBottom,
        { backgroundColor: theme.content.surfaceSecondary },
        props.style,
      ]}
    >
      <FcIcon name="arrowDown" size={18} tint={theme.content.foregroundPrimary} />
    </Pressable>
  );
}

/** Listen (TTS) pill under the latest answer. */
export function ListenButton(props: {
  label: string;
  isLoading: boolean;
  isPlaying: boolean;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const c = theme.content;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.listen,
        { backgroundColor: c.surfaceReadingSecondary, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      {props.isLoading ? (
        <ActivityIndicator size="small" color={c.buttonPrimaryAccent} />
      ) : (
        <FcIcon
          name={props.isPlaying ? 'pause' : 'speaker'}
          size={18}
          tint={c.foregroundPrimary}
        />
      )}
      <Text
        style={[typography.labelMedium, { color: c.foregroundPrimary, marginLeft: 8 }]}
      >
        {props.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingHorizontal: 16,
  },
  action: {
    height: 42,
    minWidth: 42,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weather: {
    height: 42,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 8,
  },
  scrollToBottom: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  listen: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.rounded,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
});
