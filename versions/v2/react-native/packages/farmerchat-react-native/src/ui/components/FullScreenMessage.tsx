/**
 * FullScreenMessage — shared green full-screen composable (docs/01 §3.14):
 * app bar with yellow glow, illustration, main/subtitle text, forced-light
 * primary button, optional secondary CTA, optional primary-button debounce.
 */
import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context';
import { spacing, typography } from '../theme';
import { ActionButton, PrimaryButton, type PrimaryButtonState } from './Buttons';
import { DefaultAppBar } from './Chrome';

export type Illustration =
  | 'LOOKING_AT_CAMERA'
  | 'LOOKING_AT_SKY'
  | 'LOOKING_AT_PHONE';

function illustrationGlyph(illustration: Illustration): string {
  switch (illustration) {
    case 'LOOKING_AT_CAMERA':
      return '🧑‍🌾';
    case 'LOOKING_AT_SKY':
      return '🌦️';
    case 'LOOKING_AT_PHONE':
      return '📍';
  }
}

export function FullScreenMessage(props: {
  title: string;
  subtitle?: string | null;
  illustration: Illustration;
  primaryLabel: string;
  onPrimary: () => void;
  primaryLoading?: boolean;
  secondaryLabel?: string | null;
  onSecondary?: () => void;
  onClose?: () => void;
  /** Debounce the primary CTA (Error screen uses this). */
  enablePrimaryDebounce?: boolean;
  /**
   * Optional Compose-`FullScreenMessage` app bar (location screens): when set, the bar renders
   * this title with an optional back chip ([onBack]) and right label chip ([rightLabel] /
   * [onRight]) instead of the plain glow bar + [onClose]. Omitted → unchanged layout.
   */
  appBarTitle?: string | null;
  onBack?: () => void;
  rightLabel?: string | null;
  onRight?: () => void;
  /** Explicit primary button state (e.g. `Chevron`); overrides [primaryLoading] when set. */
  primaryState?: PrimaryButtonState;
  /** False renders the primary CTA disabled (inert interstitial). Default true. */
  primaryEnabled?: boolean;
}): React.ReactElement {
  const theme = useTheme();
  const lastPress = useRef(0);

  const handlePrimary = () => {
    if (props.enablePrimaryDebounce) {
      const now = Date.now();
      if (now - lastPress.current < 1000) return;
      lastPress.current = now;
    }
    props.onPrimary();
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.surfaceFullScreen }]}
      edges={['top', 'bottom']}
    >
      {props.appBarTitle !== undefined ? (
        <DefaultAppBar
          title={props.appBarTitle}
          navIcon={props.onBack ? 'back' : 'none'}
          onNavPress={props.onBack}
          rightContent={
            props.rightLabel && props.onRight ? (
              <ActionButton
                onPress={props.onRight}
                label={props.rightLabel}
                background={theme.brand.surfaceSecondary}
                labelColor={theme.brand.foregroundPrimary}
              />
            ) : undefined
          }
        />
      ) : (
      <View style={styles.appBar}>
        {/* yellow glow accent behind the bar */}
        <View style={[styles.glow, { backgroundColor: theme.accentYellow }]} />
        {props.onClose ? (
          <Pressable accessibilityRole="button" onPress={props.onClose} hitSlop={12}>
            <Text style={{ color: theme.textOnBrand, fontSize: 20 }}>✕</Text>
          </Pressable>
        ) : null}
      </View>
      )}

      <View style={styles.body}>
        <Text style={styles.illustration}>{illustrationGlyph(props.illustration)}</Text>
        <Text style={[typography.title, { color: theme.textOnBrand, textAlign: 'center' }]}>
          {props.title}
        </Text>
        {props.subtitle ? (
          <Text
            style={[
              typography.body,
              { color: theme.textOnBrandSecondary, textAlign: 'center' },
            ]}
          >
            {props.subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          label={props.primaryLabel}
          onPress={handlePrimary}
          forceLight
          enabled={props.primaryEnabled}
          state={props.primaryState ?? (props.primaryLoading ? 'Loading' : 'Default')}
        />
        {props.secondaryLabel && props.onSecondary ? (
          <Pressable
            accessibilityRole="button"
            onPress={props.onSecondary}
            style={styles.secondary}
          >
            <Text
              style={[
                typography.button,
                { color: theme.textOnBrand, textDecorationLine: 'underline' },
              ]}
            >
              {props.secondaryLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  appBar: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  glow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.25,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  illustration: { fontSize: 84, marginBottom: spacing.md },
  footer: { padding: spacing.xl, gap: spacing.md },
  secondary: { alignItems: 'center', paddingVertical: spacing.sm },
});
