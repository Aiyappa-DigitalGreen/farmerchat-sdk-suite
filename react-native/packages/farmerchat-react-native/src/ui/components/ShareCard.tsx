/**
 * ShareCard — branded answer card rendered off-screen and captured to PNG for
 * share/download (docs/01 §3.8; RN adaptation: react-native-view-shot optional
 * peer, falling back to text share when absent — docs/03 fidelity map).
 */
import React, { useRef } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { AnalyticsEvents } from '../../core/analytics';
import type { FarmerChatSdk } from '../../core/sdk';
import { useLabel, useTheme } from '../context';
import { radius, spacing, typography } from '../theme';
import { LogoMark } from './Chrome';
import { MarkdownText } from './Markdown';
import { getViewShotModule } from './optionalModules';

export interface ShareCardHandle {
  share: (sdk: FarmerChatSdk) => Promise<void>;
  download: (sdk: FarmerChatSdk) => Promise<void>;
}

export function useShareCard(question: string, answer: string): {
  cardElement: React.ReactElement;
  handle: ShareCardHandle;
} {
  const viewShotRef = useRef<{ capture?: () => Promise<string> } | null>(null);
  const theme = useTheme();
  const label = useLabel();

  const captureOrNull = async (): Promise<string | null> => {
    const viewShot = getViewShotModule();
    if (!viewShot || !viewShotRef.current?.capture) return null;
    try {
      return await viewShotRef.current.capture();
    } catch {
      return null;
    }
  };

  const shareText = async () => {
    await Share.share({ message: `${question}\n\n${answer}` });
  };

  const handle: ShareCardHandle = {
    share: async (sdk) => {
      sdk.analytics.track(AnalyticsEvents.SHARE_BUTTON_CLICKED, {});
      const uri = await captureOrNull();
      try {
        if (uri) {
          await Share.share({ url: uri, message: question });
        } else {
          await shareText();
        }
      } catch {
        // user dismissed share sheet
      }
    },
    download: async (sdk) => {
      sdk.analytics.track(AnalyticsEvents.SAVE_BUTTON_CLICKED, {});
      // RN has no MediaStore equivalent without extra native deps; the share
      // sheet's "Save image" flow is the platform-appropriate download path.
      const uri = await captureOrNull();
      try {
        if (uri) {
          await Share.share({ url: uri, message: question });
        } else {
          await shareText();
        }
      } catch {
        // user dismissed share sheet
      }
    },
  };

  const viewShot = getViewShotModule();
  const inner = (
    <View style={[styles.card, { backgroundColor: theme.surfaceReading }]}>
      <View style={styles.header}>
        <LogoMark size={32} />
        <Text style={[typography.subheading, { color: theme.brandPrimary }]}>FarmerChat</Text>
      </View>
      <Text style={[typography.subheading, { color: theme.textPrimary }]}>{question}</Text>
      <MarkdownText markdown={answer} color={theme.textPrimary} />
      <Text style={[typography.caption, { color: theme.textTertiary }]}>
        {label('share_card_footer', 'Advice from FarmerChat by Digital Green')}
      </Text>
    </View>
  );

  const cardElement = (
    <View style={styles.offscreen} pointerEvents="none">
      {viewShot ? (
        <viewShot.default
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={viewShotRef as any}
          options={{ format: 'png', quality: 1 }}
        >
          {inner}
        </viewShot.default>
      ) : (
        inner
      )}
    </View>
  );

  return { cardElement, handle };
}

const styles = StyleSheet.create({
  offscreen: { position: 'absolute', left: -10_000, top: 0, width: 360 },
  card: {
    width: 360,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
