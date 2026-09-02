/**
 * VoiceClip — user voice-clip bubble with play/pause + position polling
 * (docs/01 §3.8 chat-bubble audio playback), on expo-av. Single shared
 * player: starting one clip stops any other.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { useTheme } from '../context';
import { radius, spacing, typography } from '../theme';

// Module-level "single MediaPlayer" semantics.
let activeSound: Audio.Sound | null = null;
let activeStop: (() => void) | null = null;

async function stopActiveSound(): Promise<void> {
  const sound = activeSound;
  const notify = activeStop;
  activeSound = null;
  activeStop = null;
  notify?.();
  if (sound) {
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch {
      // already released
    }
  }
}

export function VoiceClip(props: {
  audioUri: string;
  tint?: 'onBrand' | 'default';
}): React.ReactElement {
  const theme = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (soundRef.current === activeSound) {
        void stopActiveSound();
      } else if (soundRef.current) {
        void soundRef.current.unloadAsync().catch(() => undefined);
      }
      soundRef.current = null;
    };
  }, []);

  const onStatus = useCallback((status: AVPlaybackStatus) => {
    if (!mounted.current || !status.isLoaded) return;
    setPositionMs(status.positionMillis);
    if (status.durationMillis !== undefined) setDurationMs(status.durationMillis);
    setIsPlaying(status.isPlaying);
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionMs(0);
    }
  }, []);

  const toggle = useCallback(async () => {
    try {
      if (isPlaying && soundRef.current) {
        await soundRef.current.pauseAsync();
        return;
      }
      if (soundRef.current && soundRef.current === activeSound) {
        await soundRef.current.playAsync();
        return;
      }
      await stopActiveSound();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: props.audioUri },
        { shouldPlay: true, progressUpdateIntervalMillis: 250 },
        onStatus,
      );
      soundRef.current = sound;
      activeSound = sound;
      activeStop = () => {
        if (mounted.current) setIsPlaying(false);
      };
    } catch {
      if (mounted.current) setIsPlaying(false);
    }
  }, [isPlaying, onStatus, props.audioUri]);

  const color = props.tint === 'onBrand' ? theme.bubbleUserText : theme.textPrimary;
  const progress =
    durationMs !== null && durationMs > 0 ? Math.min(positionMs / durationMs, 1) : 0;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        onPress={() => void toggle()}
        style={[styles.playButton, { borderColor: color }]}
      >
        <Text style={{ color, fontSize: 14 }}>{isPlaying ? '⏸' : '▶'}</Text>
      </Pressable>
      <View style={[styles.track, { backgroundColor: `${color}40` }]}>
        <View
          style={[
            styles.trackFill,
            { backgroundColor: color, width: `${Math.round(progress * 100)}%` },
          ]}
        />
      </View>
      <Text style={[typography.caption, { color }]}>
        {formatMs(isPlaying || positionMs > 0 ? positionMs : durationMs ?? 0)}
      </Text>
    </View>
  );
}

function formatMs(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Stops any currently playing clip (chat ON_STOP lifecycle). */
export async function stopAllVoiceClips(): Promise<void> {
  await stopActiveSound();
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 160,
  },
  playButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  trackFill: { height: '100%' },
});
