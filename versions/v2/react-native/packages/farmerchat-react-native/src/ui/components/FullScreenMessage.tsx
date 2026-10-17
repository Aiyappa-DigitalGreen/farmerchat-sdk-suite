/**
 * FullScreenMessage — port of the app's shared green full-screen composable
 * (fc-compose-agentic ui/error/NoInternetScreen.kt:74-260; the Android Compose SDK's
 * components/FullScreenMessage.kt is the same):
 *
 *  - `DefaultAppBar(title, yellow glow)` with an optional rounded back chip on the left and an
 *    optional rounded label chip ("Skip") on the right;
 *  - the per-country farmer illustration (`rememberCountryFarmerPainter`) in the flexible space,
 *    16 dp vertical padding, inside 28 dp side padding;
 *  - the main message (displaySmall) and the subtitle (bodyMedium, or bodyLarge where the screen
 *    asks for it), centred, 10 apart, 28 above the button;
 *  - a forced-light 64 dp primary button, 20 dp side padding, 8 + nav-bar inset below;
 *  - an optional secondary text CTA under it.
 */
import React, { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StorageKeys } from '../../core/sessionStore';
import { countryFarmerIllustration, type FarmerIllustration } from '../assets';
import { useSdk, useTheme } from '../context';
import { typography } from '../theme';
import { ActionButton, PrimaryButton, type PrimaryButtonState } from './Buttons';
import { DefaultAppBar } from './Chrome';

export type Illustration = FarmerIllustration;

/**
 * How the illustration is drawn (the app passes a different `illustrationContent` per screen):
 *  - `card`: `FarmerIllustration` — max 322 wide, 300:450, fully rounded corners, crop
 *    (AccountBenefits / AccountSuccess, AppNavGraph.kt:832, AccountSuccessScreen.kt:82);
 *  - `fit`: the image fills the box with ContentScale.Fit, max 322 wide (Error screen,
 *    location interstitial);
 *  - `cover`: fills the box with ContentScale.Crop (location error screens).
 */
export type IllustrationStyle = 'card' | 'fit' | 'cover';

/** Primary debounce window (app NoInternetScreen.kt:103-108). */
const PRIMARY_DEBOUNCE_MS = 1500;

export function FullScreenMessage(props: {
  /** App-bar title. */
  title: string;
  /** Main message (displaySmall). */
  mainMessage: string;
  subtitle?: string | null;
  /** `bodyLarge` for screens that override it (AccountBenefits / AccountSuccess). */
  subtitleLarge?: boolean;
  illustration: Illustration;
  illustrationStyle?: IllustrationStyle;
  /** Bottom 23 % black gradient over the illustration (location interstitial). */
  illustrationGradient?: boolean;
  primaryLabel: string;
  onPrimary: () => void;
  /** Explicit primary state (`Chevron` / `Loading`). Default `Default`. */
  primaryState?: PrimaryButtonState;
  /** False renders the primary CTA disabled (inert interstitial). Default true. */
  primaryEnabled?: boolean;
  /** Rounded ArrowBack chip on the left (app `leftIcon = ArrowBack, leftRadius = Rounded`). */
  onBack?: () => void;
  /** Rounded label chip on the right (app `rightLabel`, e.g. "Skip"). */
  rightLabel?: string | null;
  onRight?: () => void;
  secondaryLabel?: string | null;
  onSecondary?: () => void;
  /** Debounce the primary CTA, showing it Loading meanwhile (Error / Try again). */
  enablePrimaryDebounce?: boolean;
}): React.ReactElement {
  const theme = useTheme();
  const sdk = useSdk();
  const brand = theme.brand;
  const [debouncing, setDebouncing] = useState(false);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countryCode = sdk.store.getString(StorageKeys.USER_COUNTRY_CODE);
  const source = countryFarmerIllustration(props.illustration, countryCode);
  const style = props.illustrationStyle ?? 'card';

  const handlePrimary = () => {
    if (props.enablePrimaryDebounce) {
      if (debouncing) return;
      setDebouncing(true);
      timer.current = setTimeout(() => setDebouncing(false), PRIMARY_DEBOUNCE_MS);
    }
    props.onPrimary();
  };
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: brand.surfacePrimary }]}
      edges={['bottom']}
    >
      <DefaultAppBar
        title={props.title}
        navIcon={props.onBack ? 'back' : 'none'}
        onNavPress={props.onBack}
        rightContent={
          props.rightLabel && props.onRight ? (
            <ActionButton
              onPress={props.onRight}
              label={props.rightLabel}
              background={brand.surfaceSecondary}
              labelColor={brand.foregroundPrimary}
              style={{ borderRadius: 21 }}
            />
          ) : undefined
        }
      />

      <View style={styles.content}>
        <View
          style={styles.illustrationBox}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            // Inner size: minus the 16 dp vertical padding.
            const next = { width: Math.round(width), height: Math.round(height - 32) };
            if (!box || box.width !== next.width || box.height !== next.height) setBox(next);
          }}
        >
          {style === 'card' ? (
            // App FarmerIllustration: max 322 wide, 300:450, Radius.Rounded clip, Crop. The asset
            // is already a 600x900 (2:3) stadium on transparency, so the app's clip and crop are
            // no-ops; the whole image is drawn at the size the app's box takes.
            box ? (
              <View style={cardSize(box)}>
                <Image source={source} resizeMode="contain" style={cardSize(box)} />
                {props.illustrationGradient ? <BottomShade /> : null}
              </View>
            ) : null
          ) : box ? (
            // Explicit sizes, never absoluteFill: on Android a WebP Image under absoluteFill drew
            // at the wrong scale and overflowed its frame (scenario pass 2026-10-17).
            <View style={fillSize(box, style)}>
              <Image
                source={source}
                resizeMode={style === 'fit' ? 'contain' : 'cover'}
                style={fillSize(box, style)}
              />
              {props.illustrationGradient ? <BottomShade /> : null}
            </View>
          ) : null}
        </View>

        <View style={styles.texts}>
          <Text
            style={[typography.displaySmall, { color: brand.foregroundPrimary, textAlign: 'center' }]}
          >
            {props.mainMessage}
          </Text>
          {props.subtitle ? (
            <Text
              style={[
                props.subtitleLarge ? typography.bodyLarge : typography.bodyMedium,
                { color: brand.foregroundPrimary, textAlign: 'center' },
              ]}
            >
              {props.subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          label={props.primaryLabel}
          onPress={handlePrimary}
          forceLight
          height={64}
          enabled={props.primaryEnabled}
          state={debouncing ? 'Loading' : props.primaryState ?? 'Default'}
        />
      </View>
      {props.secondaryLabel && props.onSecondary ? (
        <Pressable accessibilityRole="button" onPress={props.onSecondary} style={styles.secondary}>
          <Text style={[typography.bodyMedium, { color: brand.foregroundPrimary, textAlign: 'center' }]}>
            {props.secondaryLabel}
          </Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

/** `widthIn(max = 322).aspectRatio(300 / 450)` inside the measured space. */
export function cardSize(box: { width: number; height: number }): { width: number; height: number } {
  const width = Math.max(0, Math.min(322, box.width, (box.height * 300) / 450));
  return { width, height: (width * 450) / 300 };
}

/** `fit`: fillMaxSize().widthIn(max = 322); `cover`: fillMaxSize(). */
export function fillSize(
  box: { width: number; height: number },
  style: IllustrationStyle,
): { width: number; height: number } {
  return { width: style === 'fit' ? Math.min(322, box.width) : box.width, height: box.height };
}

/** App: vertical gradient, transparent until 77 %, then black 40 % at the bottom. */
function BottomShade(): React.ReactElement {
  const steps = 12;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { top: '77%' }]}>
      {Array.from({ length: steps }, (_, i) => (
        <View
          key={i}
          style={{ flex: 1, backgroundColor: `rgba(0,0,0,${((0.4 * (i + 1)) / steps).toFixed(3)})` }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 28, alignItems: 'center' },
  illustrationBox: {
    flex: 1,
    alignSelf: 'stretch',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { alignSelf: 'stretch', paddingBottom: 28, gap: 10, alignItems: 'center' },
  footer: { paddingHorizontal: 20, paddingBottom: 8 },
  secondary: { paddingVertical: 12 },
});
