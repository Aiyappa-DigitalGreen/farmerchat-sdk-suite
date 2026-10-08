/**
 * Gradient primitives built from plain Views — this package has no gradient/shader dependency
 * (no react-native-svg, no expo-linear-gradient), and SVG could not draw a sweep (conic) gradient
 * anyway. Two app effects need one:
 *
 * - {@link SweepGradient} / {@link SweepBorder}: Compose `Brush.sweepGradient`, used by the
 *   Share pill's `accentSweepBorder` (`ColorBrandSemantic.kt`) and the composer's "alive" aura
 *   (`InputComposer.kt`). Drawn as {@link SPOKES} thin coloured spokes rotated around the centre,
 *   each taking the colour of its angle; at 5° per spoke the steps are below what a 2–3dp ring
 *   can show.
 * - {@link ShimmerText}: Compose `ShimmerText` — a highlight band sweeping across the label.
 *   Drawn as the text twice: the base copy, and a highlight copy inside a clipping window that
 *   slides across while the text inside counter-slides so the glyphs stay put. Three nested
 *   windows at falling opacity give the band the brush's soft 0 → 35% → 65% → 100% edges.
 *
 * Both honour Reduce Motion: the sweep stops rotating and the shimmer renders static.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

/** Spokes per full turn. 72 = one per 5°. */
const SPOKES = 72;

/** One colour stop: `pos` in [0, 1], measured clockwise from 3 o'clock (Compose sweepGradient). */
export type SweepStop = readonly [pos: number, color: string];

/**
 * `brand.accentSweepBorder` (ColorBrandSemantic.kt): right = cyan, bottom = green, left = yellow,
 * top = green, back to cyan.
 */
export const ACCENT_SWEEP_STOPS: readonly SweepStop[] = [
  [0, '#22D3EE'],
  [0.25, '#00C950'],
  [0.5, '#FFF947'],
  [0.75, '#00C950'],
  [1, '#22D3EE'],
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Linear interpolation between the two stops around `pos` (stops sorted, hex colours). */
export function colorAt(stops: readonly SweepStop[], pos: number): string {
  const p = ((pos % 1) + 1) % 1;
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i]!;
    const [p1, c1] = stops[i + 1]!;
    if (p >= p0 && p <= p1) {
      const t = p1 === p0 ? 0 : (p - p0) / (p1 - p0);
      const a = hexToRgb(c0);
      const b = hexToRgb(c1);
      const mix = (k: number) => Math.round(a[k]! + (b[k]! - a[k]!) * t);
      return `rgb(${mix(0)},${mix(1)},${mix(2)})`;
    }
  }
  return stops[stops.length - 1]?.[1] ?? '#000000';
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setReduce(v);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/**
 * Fills its parent (absoluteFill) with a sweep gradient centred on the parent. Clip it with the
 * parent's `overflow: 'hidden'` + `borderRadius`. `rotateMs` > 0 rotates it clockwise forever
 * (the composer aura's 7s flow).
 */
export function SweepGradient(props: { stops: readonly SweepStop[]; rotateMs?: number }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const reduceMotion = useReduceMotion();
  const spin = useRef(new Animated.Value(0)).current;
  const rotateMs = props.rotateMs ?? 0;

  useEffect(() => {
    if (rotateMs <= 0 || reduceMotion) return;
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: rotateMs, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [rotateMs, reduceMotion, spin]);

  const spokes = useMemo(() => {
    if (!size) return null;
    const d = Math.ceil(Math.hypot(size.w, size.h)) + 2;
    // Height of a spoke at the rim: the chord of one step, plus overlap so no gaps show.
    const h = Math.max(2, d * Math.tan(Math.PI / SPOKES) * 1.4);
    return { d, h, colors: Array.from({ length: SPOKES }, (_, i) => colorAt(props.stops, i / SPOKES)) };
  }, [size, props.stops]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || size.w !== width || size.h !== height) setSize({ w: width, h: height });
  };

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {spokes && size ? (
        <Animated.View
          style={{
            position: 'absolute',
            width: spokes.d,
            height: spokes.d,
            left: (size.w - spokes.d) / 2,
            top: (size.h - spokes.d) / 2,
            transform: [{ rotate }],
          }}
        >
          {spokes.colors.map((color, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                width: spokes.d,
                height: spokes.h,
                left: 0,
                top: (spokes.d - spokes.h) / 2,
                flexDirection: 'row',
                transform: [{ rotate: `${(i / SPOKES) * 360}deg` }],
              }}
            >
              <View style={{ flex: 1 }} />
              <View style={{ flex: 1, backgroundColor: color }} />
            </View>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * A rounded shape with a sweep-gradient border: the gradient fills the clipped shape and the
 * children sit inset by `width` on `innerStyle` (which must carry the fill colour), so only a
 * `width`-wide ring of gradient shows — with true rounded corners.
 *
 * `visible = false` keeps the layout identical (same inset) but hides the ring behind
 * `idleColor`, so toggling it never shifts the content.
 */
export function SweepBorder(props: {
  width: number;
  radius: number;
  stops?: readonly SweepStop[];
  rotateMs?: number;
  /** Ring opacity, e.g. the aura's breathing value. */
  opacity?: number | Animated.Value | Animated.AnimatedInterpolation<number>;
  visible?: boolean;
  /** Ring colour while hidden — normally the inner fill, so the shape reads as one surface. */
  idleColor?: string | Animated.AnimatedInterpolation<string>;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle> | Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
  children?: React.ReactNode;
}) {
  const visible = props.visible ?? true;
  return (
    <Animated.View
      style={[
        { borderRadius: props.radius, overflow: 'hidden', padding: props.width },
        props.idleColor !== undefined ? { backgroundColor: props.idleColor as string } : null,
        props.style,
      ]}
    >
      {visible ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: props.opacity ?? 1 }]} pointerEvents="none">
          <SweepGradient stops={props.stops ?? ACCENT_SWEEP_STOPS} rotateMs={props.rotateMs} />
        </Animated.View>
      ) : null}
      <Animated.View style={[{ borderRadius: Math.max(0, props.radius - props.width) }, props.innerStyle as ViewStyle]}>
        {props.children}
      </Animated.View>
    </Animated.View>
  );
}

/** Highlight band as nested windows: [fraction of band width, opacity], widest first. */
const SHIMMER_LAYERS: ReadonlyArray<readonly [number, number]> = [
  [1.0, 0.25],
  [0.65, 0.45],
  [0.3, 1],
];

/**
 * Compose `ShimmerText`: `text` in `baseColor` with a `highlightColor` band sweeping left → right
 * every `durationMs` (1200ms, linear). The band is 1.2× the text width and travels from fully off
 * the left edge to fully off the right, as in the app.
 */
export function ShimmerText(props: {
  text: string;
  style?: StyleProp<TextStyle>;
  baseColor: string;
  highlightColor: string;
  durationMs?: number;
  numberOfLines?: number;
}) {
  const [width, setWidth] = useState(0);
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const duration = props.durationMs ?? 1200;
  const animate = width > 0 && !reduceMotion;

  useEffect(() => {
    if (!animate) return;
    progress.setValue(0);
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, duration, progress]);

  const band = width * 1.2;
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Text style={[props.style, { color: props.baseColor }]} numberOfLines={props.numberOfLines}>
        {props.text}
      </Text>
      {animate
        ? SHIMMER_LAYERS.map(([fraction, opacity]) => {
            const w = band * fraction;
            // Window centre runs from -band/2 to width + band/2.
            const left = progress.interpolate({
              inputRange: [0, 1],
              outputRange: [-band / 2 - w / 2, width + band / 2 - w / 2],
            });
            const counter = Animated.multiply(left, -1);
            return (
              <Animated.View
                key={fraction}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: w,
                  overflow: 'hidden',
                  opacity,
                  transform: [{ translateX: left }],
                }}
              >
                <Animated.Text
                  style={[props.style, { color: props.highlightColor, width, transform: [{ translateX: counter }] }]}
                  numberOfLines={props.numberOfLines}
                >
                  {props.text}
                </Animated.Text>
              </Animated.View>
            );
          })
        : null}
    </View>
  );
}
