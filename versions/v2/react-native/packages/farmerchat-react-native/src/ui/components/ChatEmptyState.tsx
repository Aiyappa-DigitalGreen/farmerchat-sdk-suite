/**
 * ChatEmptyState — SDK addition (the app always enters chat with a question, so it has no chat
 * empty state). Shown centred in the chat body while the thread has no messages: the logo mark in
 * a brand-green disc with a soft halo, the tagline, the "ask by voice, photo or text" line, and
 * Photo / Speak / Type pills that do what the chat's own input controls do.
 * Port of the web reference `ChatEmptyState` (chatParts.tsx + `.fcsdk-c-empty*` CSS).
 * Labels only — no new keys.
 */
import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { IconName } from '../assets';
import { Labels } from '../../core/labels';
import { useLabel, useTheme } from '../context';
import { withAlpha } from '../theme';
import { LogoMark } from './Chrome';
import { FcIcon } from './Icon';

export function ChatEmptyState(props: {
  /** Omitted ⇒ the Photo pill is hidden (host `enableImages = false`). */
  onPhoto?: () => void;
  /** Omitted ⇒ the Speak pill is hidden (host `enableVoice = false`). */
  onSpeak?: () => void;
  onType: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const label = useLabel();
  const brand = theme.brand.surfacePrimary;
  const tint12 = withAlpha(brand, 0.12);

  // 360ms fade + 6dp rise on appear; skipped when the OS reduce-motion setting is on.
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (!alive) return;
        if (reduce) {
          progress.setValue(1);
        } else {
          Animated.timing(progress, {
            toValue: 1,
            duration: 360,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }).start();
        }
      });
    return () => {
      alive = false;
    };
  }, [progress]);

  const ways: { key: string; icon: IconName; text: string; onPress?: () => void }[] = [
    { key: 'photo', icon: 'camera', text: label(Labels.PHOTO, 'Photo'), onPress: props.onPhoto },
    { key: 'speak', icon: 'mic', text: label(Labels.SPEAK, 'Speak'), onPress: props.onSpeak },
    { key: 'type', icon: 'keyboard', text: label(Labels.TYPE, 'Type'), onPress: props.onType },
  ];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.root,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
          ],
        },
      ]}
    >
      {/* 64dp brand disc + 8dp halo ring at ~12% brand (the halo is the outer disc). */}
      <View style={[styles.halo, { backgroundColor: tint12 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.mark, { backgroundColor: brand }]}>
          <LogoMark size={34} color="#FFFFFF" />
        </View>
      </View>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: theme.content.foregroundPrimary }]}
      >
        {label(Labels.FARMERCHAT_TAGLINE, 'FarmerChat: Practical advice for your crops & livestock')}
      </Text>
      <Text style={[styles.subtitle, { color: theme.content.foregroundSecondary }]}>
        {label(
          Labels.GET_STARTED_BY_CLICKING_ON_PHOTO_SPEAK_OR_TYPE_TO_ASK_YOUR_QUESTION,
          'Tap a button to ask a question',
        )}
      </Text>
      <View style={styles.ways}>
        {ways
          .filter((w) => w.onPress)
          .map((w) => (
            <Pressable
              key={w.key}
              testID={`fc-chat-empty-${w.key}`}
              accessibilityRole="button"
              accessibilityLabel={w.text}
              onPress={w.onPress}
              style={({ pressed }) => [
                styles.way,
                {
                  borderColor: pressed ? brand : theme.content.borderDefault,
                  backgroundColor: theme.content.surfacePrimary,
                },
              ]}
            >
              <View style={[styles.wayIcon, { backgroundColor: tint12 }]}>
                <FcIcon name={w.icon} size={20} tint={brand} />
              </View>
              <Text style={[styles.wayText, { color: theme.content.foregroundPrimary }]}>
                {w.text}
              </Text>
            </Pressable>
          ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  // 64dp disc + 8dp ring each side = 80dp; the extra 6dp under the mark is the margin.
  halo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    // The ring sits outside the 64dp mark and takes no layout space (like the web box-shadow):
    // -8 top, and -8 + the spec's extra 6 below.
    marginTop: -8,
    marginBottom: -2,
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    maxWidth: 300,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 280,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  ways: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  way: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  wayIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wayText: { fontSize: 14, fontWeight: '600' },
});
