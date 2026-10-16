/**
 * ListenButton — port of the app's `components/buttons/ListenButton.kt` in its `light = true`
 * (agentic) treatment, the only one the chat uses (ChatResponseActions.kt:131, AlignmentSurface.kt:250).
 *
 * 42dp pill (radius 50%), surfaceReadingSecondary, wrap width, 12dp horizontal padding. Four
 * states (ListenButton.kt:90-95), cross-faded by AnimatedContent(fadeIn(500) togetherWith fadeOut(500)):
 *  - Default: VolumeUp 23dp + 6 + "Listen";
 *  - Loading: CircularProgressIndicator 20dp (stroke 2, accent, track accent@0.3) + 8 + "Loading...";
 *  - Playing: Pause 23dp + 6 + a 54x26 sound wave of 14 animated bars;
 *  - Paused (a clip is loaded but not playing): PlayArrow 23dp + 6 + the wave at rest.
 * Icon and label use foregroundPrimary; the wave stays brand-green (buttonPrimaryAccent).
 * `enabled = false` (server TTS off) draws it at alpha 0.4 and makes it inert.
 *
 * Size: `fadeIn togetherWith fadeOut` carries Compose's default `SizeTransform()` (clip = true,
 * `spring(stiffness = StiffnessMediumLow (400), dampingRatio = 1)`), so the pill's width springs
 * from the old content's width to the new one while both stay centred and clipped. Here the new
 * content is measured off-screen and the pill width is a (JS-driven) spring with the same
 * stiffness and critical damping (damping = 2 * sqrt(400 * 1) = 40).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context';
import { typography, withAlpha } from '../theme';
import { MaterialIndeterminateRing } from './Chrome';
import { FcIcon } from './Icon';

type ListenState = 'Default' | 'Loading' | 'Playing' | 'Paused';

/** ListenButton.kt:90-95. */
export function listenButtonState(p: {
  isLoading: boolean;
  isPlaying: boolean;
  hasAudioUrl: boolean;
}): ListenState {
  if (p.isLoading) return 'Loading';
  if (p.isPlaying) return 'Playing';
  if (p.hasAudioUrl) return 'Paused';
  return 'Default';
}

const FADE_MS = 500;
/** ListenButton.kt:122 Row padding(horizontal = 12.dp). */
const PAD_H = 12;

export function ListenButton(props: {
  /** `Labels.LISTEN`, resolved. */
  label: string;
  /** `Labels.LOADING`, resolved. */
  loadingLabel: string;
  isLoading: boolean;
  isPlaying: boolean;
  hasAudioUrl: boolean;
  enabled?: boolean;
  onPress: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const c = theme.content;
  const enabled = props.enabled !== false;
  const state = listenButtonState(props);

  // AnimatedContent: the newest state is laid out (it sizes the pill); the one it replaced
  // stays on top, centred, and fades out while the new one fades in.
  const [layers, setLayers] = useState<Array<{ key: number; state: ListenState; initial: boolean }>>(
    () => [{ key: 0, state, initial: true }],
  );
  useEffect(() => {
    setLayers((prev) => {
      const top = prev[prev.length - 1];
      if (!top || top.state === state) return prev;
      return [top, { key: top.key + 1, state, initial: false }];
    });
  }, [state]);
  const current = layers[layers.length - 1];
  const leaving = layers.length > 1 ? layers[0] : undefined;

  // SizeTransform: the pill's width follows the measured width of the CURRENT content. Until the
  // first measurement the content lays out in flow (natural width, no animation).
  const width = useRef(new Animated.Value(0)).current;
  const [measured, setMeasured] = useState(false);
  const lastWidth = useRef<number | null>(null);
  const onMeasure = (w: number) => {
    const target = Math.ceil(w) + PAD_H * 2;
    if (lastWidth.current === target) return;
    if (lastWidth.current === null) {
      width.setValue(target);
      setMeasured(true);
    } else {
      Animated.spring(width, {
        toValue: target,
        stiffness: 400,
        damping: 40,
        mass: 1,
        useNativeDriver: false,
      }).start();
    }
    lastWidth.current = target;
  };

  const renderContent = (s: ListenState, forMeasure = false) => {
    switch (s) {
      case 'Loading':
        return (
          <>
            <View style={styles.ring}>
              <View
                style={[
                  StyleSheet.absoluteFill,
                  styles.track,
                  { borderColor: withAlpha(c.foregroundPrimary, 0.3) },
                ]}
              />
              {forMeasure ? null : (
                <MaterialIndeterminateRing size={20} strokeWidth={2} color={c.foregroundPrimary} />
              )}
            </View>
            <View style={{ width: 8 }} />
            <Text
              numberOfLines={1}
              style={[typography.labelMedium, { color: c.foregroundPrimary, flexShrink: 1 }]}
            >
              {props.loadingLabel}
            </Text>
          </>
        );
      case 'Playing':
      case 'Paused':
        return (
          <>
            <FcIcon name={s === 'Playing' ? 'pause' : 'play'} size={23} tint={c.foregroundPrimary} />
            <View style={{ width: 6 }} />
            {forMeasure ? (
              <View style={styles.wave} />
            ) : (
              <SoundWave animating={s === 'Playing'} color={c.buttonPrimaryAccent} />
            )}
          </>
        );
      default:
        return (
          <>
            <FcIcon name="speaker" size={23} tint={c.foregroundPrimary} />
            <View style={{ width: 6 }} />
            <Text style={[typography.labelMedium, { color: c.foregroundPrimary }]}>
              {props.label}
            </Text>
          </>
        );
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: !enabled, busy: state === 'Loading' }}
      onPress={props.onPress}
      // ListenButton.kt:103 — not clickable while loading or when TTS is off.
      disabled={!enabled || state === 'Loading'}
      style={styles.touch}
    >
      <Animated.View
        style={[
          styles.pill,
          { backgroundColor: c.surfaceReadingSecondary, opacity: enabled ? 1 : 0.4 },
          measured ? { width } : null,
        ]}
      >
        {/* Off-screen measurer for the current content's natural width. */}
        <View style={styles.measure} pointerEvents="none">
          <View
            style={styles.row}
            onLayout={(e) => onMeasure(e.nativeEvent.layout.width)}
          >
            {renderContent(current.state, true)}
          </View>
        </View>
        <FadeLayer
          key={`in-${current.key}`}
          fadeIn={!current.initial}
          style={measured ? styles.centered : undefined}
        >
          <View style={styles.row}>{renderContent(current.state)}</View>
        </FadeLayer>
        {leaving ? (
          <FadeLayer
            // A distinct key, so the outgoing content remounts at full opacity and fades out.
            key={`out-${leaving.key}`}
            fadeOut
            style={styles.centered}
            onDone={() =>
              setLayers((prev) => (prev.length > 1 && prev[0]?.key === leaving.key ? prev.slice(1) : prev))
            }
          >
            <View style={styles.row}>{renderContent(leaving.state)}</View>
          </FadeLayer>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

function FadeLayer(props: {
  children: React.ReactNode;
  fadeIn?: boolean;
  fadeOut?: boolean;
  style?: object;
  onDone?: () => void;
}): React.ReactElement {
  const opacity = useRef(new Animated.Value(props.fadeIn ? 0 : 1)).current;
  useEffect(() => {
    if (!props.fadeIn && !props.fadeOut) return;
    const anim = Animated.timing(opacity, {
      toValue: props.fadeOut ? 0 : 1,
      duration: FADE_MS,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) props.onDone?.();
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View pointerEvents="none" style={[props.style, { opacity }]}>
      {props.children}
    </Animated.View>
  );
}

/** ListenButton.kt:207-211 — the Figma resting heights (fraction of the 26dp row). */
const STATIC_HEIGHTS = [
  0.15, 0.23, 0.31, 0.5, 0.31, 0.54, 0.73, 0.5, 0.73, 0.38, 0.5, 0.5, 0.31, 0.15,
];
const WAVE_WIDTH = 54;
const WAVE_HEIGHT = 26;
const FAST_OUT_SLOW_IN = Easing.bezier(0.4, 0, 0.2, 1);

/**
 * ListenButton.kt `SoundWaveAnimation`: 14 bars, 2dp wide, radius 8, spread SpaceBetween over
 * 54x26 and centred vertically. While animating, every 100-150ms each bar heads for
 * `clamp(base*0.5 + (current*0.5 + rand*0.5)*0.5, 0.15, 0.85)` over 80-150ms (FastOutSlowIn);
 * at rest they ease back to the static heights over 200ms. Heights are drawn as a scaleY of a
 * full-height bar, so the native driver runs them.
 */
function SoundWave(props: { animating: boolean; color: string }): React.ReactElement {
  const bars = useRef(STATIC_HEIGHTS.map((h) => new Animated.Value(h))).current;
  const values = useRef(STATIC_HEIGHTS.slice()).current;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const running: Animated.CompositeAnimation[] = [];
    // Compose tween() defaults to FastOutSlowInEasing, so both branches use it.
    const animateTo = (i: number, target: number, duration: number) => {
      values[i] = target;
      const a = Animated.timing(bars[i] as Animated.Value, {
        toValue: target,
        duration,
        easing: FAST_OUT_SLOW_IN,
        useNativeDriver: true,
      });
      running.push(a);
      a.start();
    };
    if (props.animating) {
      const tick = () => {
        if (stopped) return;
        running.length = 0;
        for (let i = 0; i < bars.length; i += 1) {
          const base = STATIC_HEIGHTS[i] ?? 0.3;
          const bias = (values[i] ?? base) * 0.5 + Math.random() * 0.5;
          const target = Math.min(0.85, Math.max(0.15, base * 0.5 + bias * 0.5));
          animateTo(i, target, 80 + Math.floor(Math.random() * 70));
        }
        timer = setTimeout(tick, 100 + Math.floor(Math.random() * 50));
      };
      tick();
    } else {
      for (let i = 0; i < bars.length; i += 1) {
        animateTo(i, STATIC_HEIGHTS[i] ?? 0.3, 200);
      }
    }
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      running.forEach((a) => a.stop());
    };
  }, [props.animating, bars, values]);

  return (
    <View style={styles.wave}>
      {bars.map((v, i) => (
        <Animated.View
          key={i}
          style={[styles.bar, { backgroundColor: props.color, transform: [{ scaleY: v }] }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  touch: { alignSelf: 'flex-start' },
  pill: {
    height: 42,
    borderRadius: 21,
    paddingHorizontal: PAD_H,
    justifyContent: 'center',
    // SizeTransform(clip = true): content wider than the springing width is clipped.
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  centered: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Wide, invisible, out of flow: lets the content take its natural width.
  measure: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 1000,
    opacity: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ring: { width: 20, height: 20 },
  track: { borderRadius: 10, borderWidth: 2 },
  wave: {
    width: WAVE_WIDTH,
    height: WAVE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bar: { width: 2, height: WAVE_HEIGHT, borderRadius: 8 },
});
