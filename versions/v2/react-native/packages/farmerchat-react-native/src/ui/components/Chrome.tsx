/**
 * Chrome — 1:1 port of the Compose SDK AppBars.kt (Glow, DefaultAppBar,
 * HomeAppBar, LogoAppBar), LogoSpinner.kt (circular spinner around the logo
 * mark) and Feed.kt (FeedHeader/FeedFooter), plus Toast and skeletons.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Assets } from '../assets';
import { useTheme } from '../context';
import { brandLogo, radius, typography } from '../theme';
import { ActionButton, WeatherButton, type WeatherButtonState } from './Buttons';
import { FcIcon } from './Icon';
import { ShimmerText } from './Gradients';
import type { IconName } from '../assets';

// ---------------------------------------------------------------------------
// Glow (fc_glow_yellow / fc_glow_green rasters)
// ---------------------------------------------------------------------------

export type GlowType = 'green' | 'yellow';

export function Glow(props: {
  type: GlowType;
  height?: number;
  flipVertical?: boolean;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  return (
    <Image
      source={props.type === 'yellow' ? Assets.glowYellow : Assets.glowGreen}
      resizeMode="stretch"
      style={[
        {
          width: '100%',
          height: props.height ?? 88,
          opacity: props.opacity ?? 1,
          transform: props.flipVertical ? [{ scaleY: -1 }] : undefined,
        },
        props.style as object,
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Logo mark (rasterized fc_logo_mark, runtime-tinted)
// ---------------------------------------------------------------------------

export function LogoMark(props: {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const theme = useTheme();
  const size = props.size ?? 44;
  // Host logo override (docs/07 Part B): render as-is (no tint) so the host's
  // own colors show; fall back to the built-in 6-petal mark, runtime-tinted.
  const hostLogo = brandLogo;
  return (
    <Image
      source={hostLogo ?? Assets.logoMark}
      resizeMode="contain"
      style={[
        {
          width: size,
          height: size,
          tintColor: hostLogo ? undefined : props.color ?? theme.content.foregroundPrimary,
        },
        props.style as object,
      ]}
    />
  );
}

/** Rotating logo used on Splash. */
export function SpinningLogo(props: { size?: number; color?: string }): React.ReactElement {
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(rotation, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [rotation]);
  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  return (
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <LogoMark size={props.size} color={props.color} />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// LogoSpinner — circular progress ring around a static logo (LogoSpinner.kt)
// ---------------------------------------------------------------------------

function LogoWithSpinner(props: {
  spinnerSize: number;
  logoSize: number;
  color?: string;
}): React.ReactElement {
  const theme = useTheme();
  const color = props.color ?? theme.brand.foregroundSecondary;
  return (
    <View
      style={{
        width: props.spinnerSize,
        height: props.spinnerSize,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator
        size={props.spinnerSize >= 48 ? 'large' : 'small'}
        color={color}
        style={StyleSheet.absoluteFill}
      />
      <LogoMark size={props.logoSize} color={color} />
    </View>
  );
}

function useCyclingLabel(message: string | null | undefined, messages?: string[]): string | null {
  const [index, setIndex] = useState(0);
  const list = messages ?? [];
  useEffect(() => {
    if (list.length <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % list.length), 3000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);
  if (list.length > 0) return list[index % list.length] ?? null;
  return message ?? null;
}

export function LogoSpinner(props: {
  message?: string | null;
  messages?: string[];
}): React.ReactElement {
  const theme = useTheme();
  const label = useCyclingLabel(props.message, props.messages);
  return (
    <View style={styles.spinnerRow}>
      <LogoWithSpinner spinnerSize={40} logoSize={23} />
      {label ? (
        // LogoSpinnerHorizontal.kt LabelTextMedium: a labelMedium ShimmerText in
        // foregroundPrimary, highlight = ShimmerText's default borderActive.
        <ShimmerText
          key={label}
          text={label}
          style={typography.labelMedium}
          baseColor={theme.content.foregroundPrimary}
          highlightColor={theme.content.borderActive}
        />
      ) : null}
    </View>
  );
}

export function LogoSpinnerVertical(props: {
  message?: string | null;
  messages?: string[];
}): React.ReactElement {
  const theme = useTheme();
  const label = useCyclingLabel(props.message, props.messages);
  return (
    <View style={styles.spinnerColumn}>
      <LogoWithSpinner spinnerSize={55} logoSize={32} />
      {label ? (
        <Text
          style={[
            typography.bodyMedium,
            { color: theme.content.foregroundPrimary, textAlign: 'center' },
          ]}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// App bars — brand green surface + yellow glow + 42dp chip buttons
// ---------------------------------------------------------------------------

export type AppBarNavIcon = 'menu' | 'back' | 'close' | 'none';

function navIconName(icon: AppBarNavIcon): IconName | null {
  switch (icon) {
    case 'menu':
      return 'menu';
    case 'back':
      return 'back';
    case 'close':
      return 'close';
    case 'none':
      return null;
  }
}

function AppBarShell(props: {
  children: React.ReactNode;
  showGlow?: boolean;
  glowOpacity?: number;
  /**
   * Compose parity (`HomeAppBar(showBackground = ...)`): agentic Home draws the green and the
   * glow in the gradient band behind the whole top section, so the bar itself goes transparent.
   */
  showBackground?: boolean;
  /**
   * Compose parity (`HomeAppBar` @ 2cd71328): Home trims its bar to 52 so the logo below it is
   * not left with a large gap under the vertically-centered menu/weather buttons. Every other
   * bar — DefaultAppBar, LogoAppBar — keeps 64, exactly as in the app.
   */
  barHeightDp?: number;
}): React.ReactElement {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const barHeight = (props.barHeightDp ?? 64) + insets.top;
  const showBackground = props.showBackground !== false;
  return (
    <View
      style={{
        height: barHeight,
        backgroundColor: showBackground ? theme.brand.surfacePrimary : 'transparent',
        overflow: 'hidden',
      }}
    >
      {showBackground && props.showGlow !== false ? (
        <Glow
          type="yellow"
          height={80}
          opacity={props.glowOpacity ?? 1}
          style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        />
      ) : null}
      <View
        style={[
          styles.appBarRow,
          { paddingTop: insets.top, height: barHeight },
        ]}
      >
        {props.children}
      </View>
    </View>
  );
}

export function DefaultAppBar(props: {
  title?: string | null;
  navIcon: AppBarNavIcon;
  onNavPress?: () => void;
  rightContent?: React.ReactNode;
  /**
   * Compose parity (`DefaultAppBar(showGlow = ...)`): the yellow glow is dropped on bars that
   * sit above their own content surface — e.g. `TermsOfUseDialog`. Defaults to on.
   */
  showGlow?: boolean;
  testID?: string;
}): React.ReactElement {
  const theme = useTheme();
  const brand = theme.brand;
  const icon = navIconName(props.navIcon);
  return (
    <AppBarShell showGlow={props.showGlow}>
      {icon ? (
        <ActionButton
          testID={props.testID ? `${props.testID}-nav` : undefined}
          onPress={props.onNavPress ?? (() => undefined)}
          icon={icon}
          background={brand.surfaceSecondary}
          iconColor={brand.foregroundPrimary}
          // Compose parity (DefaultAppBar `leftRadius` @ 1b961130): every back/close/menu bar
          // button is the round chip now, matching Home's hamburger. The app kept Radius.MD only
          // on SettingsName and onboarding Language.
          style={{ borderRadius: radius.rounded }}
        />
      ) : (
        <View style={{ width: 42 }} />
      )}
      <Text
        numberOfLines={1}
        style={[
          typography.titleMedium,
          { color: brand.foregroundPrimary, flex: 1, textAlign: 'center' },
        ]}
      >
        {props.title ?? ''}
      </Text>
      {props.rightContent ?? <View style={{ width: 42 }} />}
    </AppBarShell>
  );
}

export function HomeAppBar(props: {
  onMenuPress: () => void;
  showMenu?: boolean;
  showWeather: boolean;
  weatherState: WeatherButtonState;
  weatherText: string;
  weatherIconUrl?: string | null;
  weatherLoadingLabel: string;
  onWeatherPress: () => void;
  /**
   * Compose parity (`HomeAppBar(showBackground = !isComposerUi)`): transparent in agentic mode —
   * the green (and the glow) come from the gradient band drawn behind the whole top section.
   */
  showBackground?: boolean;
}): React.ReactElement {
  const theme = useTheme();
  const brand = theme.brand;
  return (
    <AppBarShell showBackground={props.showBackground} barHeightDp={52}>
      {props.showMenu !== false ? (
        <ActionButton
          onPress={props.onMenuPress}
          icon="menu"
          background={brand.surfaceSecondary}
          iconColor={brand.foregroundPrimary}
          style={{ borderRadius: radius.rounded }}
          testID="fc-home-menu"
        />
      ) : (
        <View style={{ width: 42 }} />
      )}
      <View style={{ flex: 1 }} />
      {props.showWeather ? (
        <WeatherButton
          onPress={props.onWeatherPress}
          state={props.weatherState}
          text={props.weatherText}
          weatherIconUrl={props.weatherIconUrl}
          loadingLabel={props.weatherLoadingLabel}
        />
      ) : null}
    </AppBarShell>
  );
}

export function LogoAppBar(props: {
  navIcon: AppBarNavIcon;
  onNavPress?: () => void;
  showLogo: boolean;
}): React.ReactElement {
  const theme = useTheme();
  const brand = theme.brand;
  const icon = navIconName(props.navIcon);
  return (
    <AppBarShell>
      {icon ? (
        <ActionButton
          onPress={props.onNavPress ?? (() => undefined)}
          icon={icon}
          background={brand.surfaceSecondary}
          iconColor={brand.foregroundPrimary}
        />
      ) : (
        <View style={{ width: 42 }} />
      )}
      <View style={{ flex: 1, alignItems: 'center' }}>
        {props.showLogo ? <LogoMark size={36} color={brand.foregroundPrimary} /> : null}
      </View>
      <View style={{ width: 42 }} />
    </AppBarShell>
  );
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

export type ToastKind = 'info' | 'error' | 'success' | 'loading';

export interface ToastState {
  message: string;
  kind: ToastKind;
}

export function useToastState(): {
  toast: ToastState | null;
  showToast: (message: string, kind?: ToastKind, durationMs?: number) => void;
  hideToast: () => void;
} {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const showToast = (message: string, kind: ToastKind = 'info', durationMs = 2500) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, kind });
    if (durationMs > 0) {
      timer.current = setTimeout(() => setToast(null), durationMs);
    }
  };
  const hideToast = () => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  };
  return { toast, showToast, hideToast };
}

export function Toast(props: { toast: ToastState | null }): React.ReactElement | null {
  const theme = useTheme();
  if (!props.toast) return null;
  const isError = props.toast.kind === 'error';
  return (
    <View pointerEvents="none" style={styles.toastWrap}>
      <View
        style={[
          styles.toast,
          {
            backgroundColor: isError
              ? theme.brand.feedbackFail
              : theme.content.foregroundPrimary,
          },
        ]}
      >
        {props.toast.kind === 'loading' ? (
          <ActivityIndicator
            size="small"
            color={theme.content.surfaceSecondary}
            style={{ marginRight: 8 }}
          />
        ) : null}
        <Text
          style={[
            typography.labelMedium,
            { color: isError ? '#FFFFFF' : theme.content.surfaceSecondary },
          ]}
        >
          {props.toast.message}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Feed header / footer (Feed.kt)
// ---------------------------------------------------------------------------

/**
 * SectionHeader — port of the Compose SDK `components/SectionHeader.kt` (2.0.0).
 *
 * Centered section title flanked by a tiled divider on each side; the divider fills whatever
 * width is left beside the title, so the pattern stretches or shrinks with the title length.
 * Matches the "For your farm today" header in Figma 1.2 Home.
 *
 * Deviation from the Compose reference (deliberate): Compose tiles the `fc_leaf` drawable,
 * alternating each leaf's facing direction, drawn on a Canvas. This package's asset set
 * (`ui/assets.ts`) carries no leaf raster and there is no vector primitive in the dependency
 * set, so the divider tiles 4x4 rounded pips at the same `LeafSize` and gapless spacing — the
 * same subtle texture at the same metrics, without the leaf silhouette.
 */
export function SectionHeader(props: {
  title: string;
  titleColor?: string;
  accentColor?: string;
  horizontalPadding?: number;
  /** Compose default 16 (the Figma component's py-16); the agentic Home header passes 0. */
  verticalPadding?: number;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.sectionHeaderRow,
        {
          paddingHorizontal: props.horizontalPadding ?? 24,
          paddingVertical: props.verticalPadding ?? 16,
        },
      ]}
    >
      <PipDivider color={props.accentColor ?? theme.content.buttonPrimaryAccent} />
      <Text
        style={[
          typography.titleMedium,
          styles.sectionHeaderTitle,
          { color: props.titleColor ?? theme.content.foregroundPrimary },
        ]}
      >
        {props.title}
      </Text>
      <PipDivider color={props.accentColor ?? theme.content.buttonPrimaryAccent} />
    </View>
  );
}

/** Compose `LeafSize` — small + gapless reads as a texture rather than a row of dots. */
const LEAF_SIZE = 4;

function PipDivider(props: { color: string }): React.ReactElement {
  const [width, setWidth] = useState(0);
  const count = Math.max(0, Math.floor(width / LEAF_SIZE));
  return (
    <View
      style={styles.pipDivider}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={{
            width: LEAF_SIZE,
            height: LEAF_SIZE,
            borderRadius: LEAF_SIZE / 2,
            backgroundColor: props.color,
            // Alternate the opacity the way Compose alternates the leaf facing, so the row
            // still reads as a repeating pattern rather than a solid rule.
            opacity: index % 2 === 0 ? 1 : 0.55,
          }}
        />
      ))}
    </View>
  );
}

export function FeedHeader(props: { title: string; color?: string }): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.feedHeader}>
      <Text
        style={[
          typography.titleMedium,
          {
            color: props.color ?? theme.brand.foregroundPrimary,
            textAlign: 'center',
          },
        ]}
      >
        {props.title}
      </Text>
    </View>
  );
}

export function FeedFooter(props: { text: string }): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ width: '100%' }}>
      <Glow
        type="green"
        height={100}
        flipVertical
        opacity={0.8}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
      />
      <View style={styles.feedFooterBody}>
        <LogoMark size={34} color={theme.content.borderActive} />
        <Text
          style={[
            typography.titleMedium,
            { color: theme.brand.foregroundPrimary, textAlign: 'center' },
          ]}
        >
          {props.text}
        </Text>
      </View>
    </View>
  );
}

/** Home feed error UI: red circle + "Can't load right now" + retry (Feed.kt). */
export function HomeFeedErrorUI(props: {
  title: string;
  retryLabel: string;
  onRetry: () => void;
  textColor?: string;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={styles.feedError}>
      <View style={[styles.feedErrorCircle, { backgroundColor: theme.brand.feedbackFail }]}>
        <FcIcon name="close" size={32} tint="#FFFFFF" />
      </View>
      <Text
        style={[
          typography.bodyLarge,
          {
            color: props.textColor ?? theme.brand.foregroundPrimary,
            textAlign: 'center',
          },
        ]}
      >
        {props.title}
      </Text>
      <View style={{ alignItems: 'center' }}>
        <View
          style={[styles.feedErrorRetry, { backgroundColor: theme.content.surfaceTertiary }]}
          onStartShouldSetResponder={() => true}
          onResponderRelease={props.onRetry}
        >
          <FcIcon name="refresh" size={20} tint={theme.content.foregroundPrimary} />
          <Text
            style={[
              typography.bodyMedium,
              { color: theme.content.foregroundPrimary, marginLeft: 8 },
            ]}
          >
            {props.retryLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

export function SkeletonBlock(props: {
  width: number | `${number}%`;
  height: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          width: props.width,
          height: props.height,
          borderRadius: radius.sm,
          backgroundColor: props.color ?? theme.content.shimmer,
        },
        props.style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  sectionHeaderTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  pipDivider: {
    flex: 1,
    height: LEAF_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
  },
  spinnerColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  appBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  toastWrap: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.rounded,
    paddingHorizontal: 18,
    paddingVertical: 10,
    maxWidth: '85%',
  },
  feedHeader: {
    width: '100%',
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  feedFooterBody: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  feedError: { alignItems: 'center', gap: 24, padding: 16 },
  feedErrorCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedErrorRetry: {
    height: 48,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
});
