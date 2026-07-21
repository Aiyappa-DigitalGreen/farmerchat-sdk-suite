/**
 * AiAnswerBlock — client-side "typewriter" reveal for AI answers.
 *
 * IMPORTANT (honesty note): the FarmerChat backend returns the whole answer in a
 * single synchronous JSON response (docs/02 — chat replies are NOT streamed; no
 * SSE/WebSocket, guardrail #3). This reveal is a purely cosmetic UI-layer
 * animation that re-renders a growing prefix of the already-received markdown.
 * It never touches the hook, network, or ChatState. History and pre-generated
 * answers pass animate={false} and render in full immediately — only a fresh,
 * just-arrived answer animates, and only once.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context';
import { spacing, typography } from '../theme';
import { MarkdownText } from './Markdown';
import { LogoSpinner } from './Chrome';

/** Splits into "word + trailing whitespace" chunks so newlines / markdown survive a prefix cut. */
function revealChunks(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [];
}

const INTERVAL_MS = 40; // ~40 ms / word
const MAX_DURATION_MS = 6000; // long answers never crawl — chunks-per-tick scales up

export function AiAnswerBlock(props: {
  text: string;
  animate: boolean;
  color?: string;
  onRevealComplete?: () => void;
}): React.ReactElement {
  const { text, animate } = props;

  // Chunks + pacing are derived from the (immutable) message text.
  const chunks = React.useMemo(() => revealChunks(text), [text]);
  const total = chunks.length;
  const perTick = total <= 0 ? 1 : Math.max(1, Math.ceil((total * INTERVAL_MS) / MAX_DURATION_MS));

  // Per-word progress is LOCAL state — it must not live in the parent or every
  // ~40ms tick would re-render the whole message list.
  const [revealed, setRevealed] = useState(animate ? 0 : total);
  const [finished, setFinished] = useState(!animate);

  // Keep the latest completion callback without retriggering the reveal effect.
  const completeRef = useRef(props.onRevealComplete);
  completeRef.current = props.onRevealComplete;

  useEffect(() => {
    if (!animate || total === 0) {
      setRevealed(total);
      setFinished(true);
      completeRef.current?.();
      return;
    }
    setRevealed(0);
    setFinished(false);
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + perTick, total);
      setRevealed(current);
      if (current >= total) {
        clearInterval(timer);
        setFinished(true);
        completeRef.current?.();
      }
    }, INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, animate]);

  const skip = () => {
    if (finished) return;
    setRevealed(total);
    setFinished(true);
    completeRef.current?.();
  };

  const display = finished ? text : chunks.slice(0, revealed).join('').replace(/\s+$/, '');

  return (
    <Pressable onPress={skip} disabled={finished} accessibilityRole={finished ? undefined : 'button'}>
      <View style={styles.answerRow}>
        <View style={{ flex: 1 }}>
          <MarkdownText markdown={display} color={props.color} />
        </View>
        {!finished ? <BlinkingCaret color={props.color} /> : null}
      </View>
    </Pressable>
  );
}

/** Subtle blinking caret glyph shown at the tail of the answer while it reveals. */
function BlinkingCaret(props: { color?: string }): React.ReactElement {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 450, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.Text
      style={[
        typography.body,
        { color: props.color ?? theme.brand.foregroundSecondary, opacity, marginLeft: 1 },
      ]}
    >
      ▌
    </Animated.Text>
  );
}

// ---------------------------------------------------------------------------
// ThinkingIndicator — branded "thinking" state shown before the answer arrives.
// Reuses the LogoSpinner mark + a pulsing three-dot affordance.
// ---------------------------------------------------------------------------

export function ThinkingIndicator(props: { label: string }): React.ReactElement {
  return (
    <View style={styles.thinkingRow}>
      <LogoSpinner message={props.label} />
      <ThreeDotPulse />
    </View>
  );
}

function ThreeDotPulse(): React.ReactElement {
  const theme = useTheme();
  const dots = [useRef(new Animated.Value(0.25)).current, useRef(new Animated.Value(0.25)).current, useRef(new Animated.Value(0.25)).current];
  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(v, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.25, duration: 600, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={styles.dotsRow}>
      {dots.map((v, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, { backgroundColor: theme.brand.foregroundSecondary, opacity: v }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  answerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
