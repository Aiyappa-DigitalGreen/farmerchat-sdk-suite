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
  Pressable,
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

// ---------------------------------------------------------------------------
// LogoSpinnerHorizontal ring — Material3 1.4.0 indeterminate CircularProgressIndicator, from Views
// ---------------------------------------------------------------------------

/** Material3 1.4.0 (compose-bom 2026.02.01) indeterminate cycle. */
const M3_CYCLE_MS = 6000;
const M3_ARC_MIN = 0.1;
const M3_ARC_MAX = 0.87;

/**
 * Sweep fraction over one cycle: 10% → 87% linearly over the first half, then back to 10% with
 * cubic-bezier(0.2, 0, 0, 1) over the second (the same curve the web port's keyframes use).
 * Sampled into an interpolation table so a single native-driven value drives everything.
 */
const M3_SWEEP_TABLE: { input: number[]; output: number[] } = (() => {
  const ease = Easing.bezier(0.2, 0, 0, 1);
  const input: number[] = [0, 0.5];
  const output: number[] = [M3_ARC_MIN, M3_ARC_MAX];
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    input.push(0.5 + t * 0.5);
    output.push(M3_ARC_MAX - (M3_ARC_MAX - M3_ARC_MIN) * ease(t));
  }
  return { input, output };
})();

/**
 * Global rotation over one cycle: 1080° linear plus a +90° step (300ms) at 0 / 1500 / 3000 /
 * 4500ms — 1440° per cycle, so the loop restart is seamless.
 */
const M3_ROTATION_INPUT = [0, 0.05, 0.25, 0.3, 0.5, 0.55, 0.75, 0.8, 1];
const M3_ROTATION_OUTPUT = [0, 144, 360, 504, 720, 864, 1080, 1224, 1440].map((d) => `${d}deg`);

/**
 * The indeterminate ring with ROUND caps, built from plain Views (this package has no SVG):
 * - two half-width clip windows, each holding a full ring whose top + right borders are the only
 *   coloured sides (an arc covering [-45°, 135°] from 12 o'clock); rotating each ring fills its
 *   half up to the sweep angle θ — right half [0, min(θ, 180)], left half [180, θ];
 * - a stroke-wide dot at 0° and another at θ for the round caps;
 * - the whole assembly turning with the M3 global rotation.
 * Every animated property is a transform/opacity, so it runs on the native driver.
 */
function MaterialIndeterminateRing(props: {
  size: number;
  strokeWidth: number;
  color: string;
}): React.ReactElement {
  const { size, strokeWidth: w, color } = props;
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: M3_CYCLE_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  const sweep = progress.interpolate({
    inputRange: M3_SWEEP_TABLE.input,
    outputRange: M3_SWEEP_TABLE.output,
  });
  const rightRotate = sweep.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-135deg', '45deg', '45deg'],
  });
  const leftRotate = sweep.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['45deg', '45deg', '225deg'],
  });
  const endCapRotate = sweep.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const globalRotate = progress.interpolate({
    inputRange: M3_ROTATION_INPUT,
    outputRange: M3_ROTATION_OUTPUT,
  });

  const half = size / 2;
  const ring = {
    position: 'absolute' as const,
    top: 0,
    width: size,
    height: size,
    borderRadius: half,
    borderWidth: w,
    borderColor: 'transparent',
    borderTopColor: color,
    borderRightColor: color,
  };
  const cap = {
    position: 'absolute' as const,
    top: 0,
    left: half - w / 2,
    width: w,
    height: w,
    borderRadius: w / 2,
    backgroundColor: color,
  };
  return (
    <Animated.View
      pointerEvents="none"
      style={{ width: size, height: size, transform: [{ rotate: globalRotate }] }}
    >
      <View style={{ position: 'absolute', top: 0, left: half, width: half, height: size, overflow: 'hidden' }}>
        <Animated.View style={[ring, { left: -half, transform: [{ rotate: rightRotate }] }]} />
      </View>
      <View style={{ position: 'absolute', top: 0, left: 0, width: half, height: size, overflow: 'hidden' }}>
        <Animated.View style={[ring, { left: 0, transform: [{ rotate: leftRotate }] }]} />
      </View>
      <View style={StyleSheet.absoluteFill}>
        <View style={cap} />
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: endCapRotate }] }]}>
        <View style={cap} />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * LogoSpinnerHorizontal.kt `LogoWithSpinner`: a 40dp Green500 ring (stroke 2.5, round caps)
 * around a 23dp Green500 mark that turns 360° every 3s (600ms EaseOut).
 */
function LogoWithMaterialSpinner(): React.ReactElement {
  // The app hard-codes Green500; `content.borderActive` IS Green500 in day and night, and keeps a
  // host brand override (high-contrast / custom accent) working on every LogoSpinner call site.
  const color = useTheme().content.borderActive;
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(3000),
        Animated.timing(turn, {
          toValue: 1,
          duration: 600,
          // Compose EaseOut = CubicBezierEasing(0, 0, 0.58, 1).
          easing: Easing.bezier(0, 0, 0.58, 1),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
      <View style={StyleSheet.absoluteFill}>
        <MaterialIndeterminateRing size={40} strokeWidth={2.5} color={color} />
      </View>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <LogoMark size={23} color={color} />
      </Animated.View>
    </View>
  );
}

/**
 * LogoSpinnerHorizontal.kt (Loading): ring + mark, 12dp, then a labelMedium ShimmerText.
 *
 * `style` overrides the row: the app's Row has no padding and is start-aligned; the 16dp padding
 * + centring kept here is what the non-chat call sites (history, drawer, legal…) were laid out
 * against, so chat passes {@link INLINE_SPINNER_STYLE} instead of moving those screens.
 */
export function LogoSpinner(props: {
  message?: string | null;
  messages?: string[];
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const theme = useTheme();
  const label = useCyclingLabel(props.message, props.messages);
  return (
    <View style={[styles.spinnerRow, props.style]}>
      <LogoWithMaterialSpinner />
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

/** The app's bare LogoSpinnerHorizontal Row: no padding, start-aligned. */
export const INLINE_SPINNER_STYLE: ViewStyle = { padding: 0, justifyContent: 'flex-start' };

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

/**
 * `homeBack` is LogoAppBar's `leftPainter = R.drawable.leftbutton` (chat entered from Home): a
 * self-contained 42dp #08361B disc with a stroked white arrow, drawn by {@link LeftButtonGlyph}.
 */
export type AppBarNavIcon = 'menu' | 'back' | 'close' | 'none' | 'homeBack';

function navIconName(icon: AppBarNavIcon): IconName | null {
  switch (icon) {
    case 'menu':
      return 'menu';
    case 'back':
      return 'back';
    case 'close':
      return 'close';
    case 'none':
    case 'homeBack':
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

/**
 * res/drawable/leftbutton.xml, drawn with Views: a 42dp #08361B circle and the white arrow
 * `M27.708 21.261H14.292 M21 27.97L14.292 21.261L21 14.553` (42×42 viewport) stroked 2dp with
 * round caps/joins. Each segment is a bar of length L + 2 (the round caps add half the stroke at
 * each end) centred on the segment's midpoint and rotated to its angle, with radius 1.
 */
function LeftButtonGlyph(): React.ReactElement {
  // #08361B is Green800 = `brand.surfaceSecondary`; the token keeps host theming working.
  const disc = useTheme().brand.surfaceSecondary;
  const stroke = 2;
  const bar = (cx: number, cy: number, length: number, angleDeg: number) => {
    const l = length + stroke;
    return (
      <View
        style={{
          position: 'absolute',
          left: cx - l / 2,
          top: cy - stroke / 2,
          width: l,
          height: stroke,
          borderRadius: stroke / 2,
          backgroundColor: '#FFFFFF',
          transform: [{ rotate: `${angleDeg}deg` }],
        }}
      />
    );
  };
  // Shaft (27.708,21.261)→(14.292,21.261); heads (21,27.97)→(14.292,21.261) and
  // (14.292,21.261)→(21,14.553), each 9.487 long at ±45°.
  const head = Math.hypot(21 - 14.292, 27.97 - 21.261);
  return (
    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: disc }}>
      {bar((27.708 + 14.292) / 2, 21.261, 27.708 - 14.292, 0)}
      {bar((21 + 14.292) / 2, (27.97 + 21.261) / 2, head, 45)}
      {bar((14.292 + 21) / 2, (21.261 + 14.553) / 2, head, -45)}
    </View>
  );
}

export function LogoAppBar(props: {
  navIcon: AppBarNavIcon;
  onNavPress?: () => void;
  showLogo: boolean;
  /** Trailing actions (chat bar with the drawer off: history + language). Omitted → spacer. */
  rightContent?: React.ReactNode;
}): React.ReactElement {
  const theme = useTheme();
  const brand = theme.brand;
  const icon = navIconName(props.navIcon);
  // LogoAppBar.kt: the centre mark fades in over 600ms EaseOut and out over 300ms EaseOut, and is
  // only composed while its alpha is above zero.
  const logoAlpha = useRef(new Animated.Value(0)).current;
  const [logoMounted, setLogoMounted] = useState(props.showLogo);
  useEffect(() => {
    if (props.showLogo) setLogoMounted(true);
    const anim = Animated.timing(logoAlpha, {
      toValue: props.showLogo ? 1 : 0,
      duration: props.showLogo ? 600 : 300,
      easing: Easing.bezier(0, 0, 0.58, 1),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished && !props.showLogo) setLogoMounted(false);
    });
    return () => anim.stop();
  }, [props.showLogo, logoAlpha]);
  return (
    <AppBarShell>
      {props.navIcon === 'homeBack' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="back"
          onPress={props.onNavPress}
          hitSlop={4}
        >
          <LeftButtonGlyph />
        </Pressable>
      ) : icon ? (
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
        {logoMounted ? (
          <Animated.View style={{ opacity: logoAlpha }}>
            <LogoMark size={36} color={brand.foregroundPrimary} />
          </Animated.View>
        ) : null}
      </View>
      {props.rightContent ?? <View style={{ width: 42 }} />}
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
