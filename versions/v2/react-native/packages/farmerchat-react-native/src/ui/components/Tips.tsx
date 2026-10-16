/**
 * Tips — the bottom-anchored tip carousel shown for the whole answer-generation wait. Port of the
 * app's `components/Tips.kt` + `components/Tip.kt` (via the Android compose SDK's Tips.kt):
 *  - a 24dp fade from transparent into the page background, then a page-coloured band with 44dp
 *    bottom padding (Tips.kt:116-158);
 *  - a pager with 24dp content padding and 8dp page gap, so the neighbouring cards peek in,
 *    auto-advancing every 8000ms with a 400ms slide, looping forever in one direction;
 *  - a card: min height 104, radius 16, `brand.surfaceSecondary`, padding 20h/16v, a 36dp
 *    `feedbackSuccess` disc with a white 18dp lightbulb, 12 gap, labelLarge title, 6 gap,
 *    bodySmall body, all white (Tip.kt:64-107);
 *  - 14dp gap, then dots: 8dp `surfaceActive` dots 10 apart, the active one a 24×8 track that
 *    fills with `feedbackSuccess` as the 8s timer runs (Tips.kt:176-210).
 * Not ported: the haptic tick and the icon's attention wobble after each advance.
 *
 * Positioned absolutely at the bottom of its parent; render it inside the box it covers.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSdk, useSdkContext, useTheme } from '../context';
import { radius, typography, withAlpha } from '../theme';
import { FcIcon } from './Icon';

const TIP_DURATION_MS = 8000;
const TIP_SLIDE_DURATION_MS = 400;
const PAGE_PADDING = 24;
const PAGE_GAP = 8;

function shuffle<T>(items: T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function Tips(props: {
  /**
   * Extends the band below its parent's bottom edge by this much. ChatScreen passes the hidden
   * composer's height: the composer is a flow sibling that keeps its layout box while slid away,
   * but the app's carousel sits at the bottom of the screen (the composer is an overlay there).
   */
  bottomOffset?: number;
} = {}): React.ReactElement | null {
  const sdk = useSdk();
  const { labelsVersion } = useSdkContext();
  const theme = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tips = useMemo(() => shuffle(sdk.labels.answerGenerationTips()), [sdk, labelsVersion]);
  const count = tips.length;

  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;
  const timer = useRef(new Animated.Value(0)).current;

  const cardWidth = Math.max(0, width - PAGE_PADDING * 2);
  const step = cardWidth + PAGE_GAP;

  useEffect(() => {
    if (count === 0 || step <= 0) return;
    let cancelled = false;
    let current: Animated.CompositeAnimation | null = null;
    const cycle = () => {
      if (cancelled) return;
      timer.setValue(0);
      current = Animated.timing(timer, {
        toValue: 1,
        duration: TIP_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: false,
      });
      current.start(({ finished }) => {
        if (!finished || cancelled) return;
        current = Animated.timing(slide, {
          toValue: -step,
          duration: TIP_SLIDE_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        });
        current.start(({ finished: slid }) => {
          if (!slid || cancelled) return;
          // Re-centre on the next tip so the loop never runs out of pages.
          setIndex((i) => (i + 1) % count);
          slide.setValue(0);
          cycle();
        });
      });
    };
    cycle();
    return () => {
      cancelled = true;
      current?.stop();
    };
  }, [count, step, slide, timer]);

  if (count === 0) return null;

  const pageBg = theme.content.surfaceReadingPrimary;
  const at = (offset: number) => tips[(((index + offset) % count) + count) % count];
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setWidth((prev) => (prev === w ? prev : w));
  };

  return (
    <View
      pointerEvents="none"
      style={[styles.root, { bottom: -(props.bottomOffset ?? 0) }]}
      onLayout={onLayout}
    >
      {/* Fade only; a gradient needs no extra dependency at 24dp: stacked translucent bands. */}
      <View style={styles.fade}>
        {[0.15, 0.35, 0.6, 0.85].map((a) => (
          <View key={a} style={{ flex: 1, backgroundColor: withAlpha(pageBg, a) }} />
        ))}
      </View>
      <View style={[styles.band, { backgroundColor: pageBg }]}>
        <View style={styles.pagerClip}>
          <Animated.View
            style={[
              styles.pagerRow,
              { transform: [{ translateX: Animated.add(slide, -step + PAGE_PADDING) }] },
            ]}
          >
            {[-1, 0, 1, 2].map((offset) => (
              <TipCard key={offset} tip={at(offset)} width={cardWidth} />
            ))}
          </Animated.View>
        </View>
        <View style={{ height: 14 }} />
        <View style={styles.dots}>
          {tips.map((_, i) =>
            i === index ? (
              <View
                key={i}
                style={[styles.activeDot, { backgroundColor: theme.content.surfaceActive }]}
              >
                <Animated.View
                  style={{
                    height: 8,
                    backgroundColor: theme.brand.feedbackSuccess,
                    width: timer.interpolate({ inputRange: [0, 1], outputRange: [0, 24] }),
                  }}
                />
              </View>
            ) : (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: theme.content.surfaceActive }]}
              />
            ),
          )}
        </View>
      </View>
    </View>
  );
}

function TipCard(props: { tip: { title: string; body: string }; width: number }): React.ReactElement {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        { width: props.width, backgroundColor: theme.brand.surfaceSecondary },
      ]}
    >
      <View style={[styles.iconDisc, { backgroundColor: theme.brand.feedbackSuccess }]}>
        <FcIcon name="lightbulb" size={18} tint="#FFFFFF" />
      </View>
      <View style={{ width: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={[typography.labelLarge, { color: '#FFFFFF' }]}>{props.tip.title}</Text>
        <View style={{ height: 6 }} />
        <Text style={[typography.bodySmall, { color: '#FFFFFF' }]}>{props.tip.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  fade: { height: 24 },
  band: { paddingBottom: 44, alignItems: 'center' },
  pagerClip: { alignSelf: 'stretch', overflow: 'hidden' },
  pagerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: PAGE_GAP },
  card: {
    minHeight: 104,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  iconDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  activeDot: { width: 24, height: 8, borderRadius: 4, overflow: 'hidden' },
});
