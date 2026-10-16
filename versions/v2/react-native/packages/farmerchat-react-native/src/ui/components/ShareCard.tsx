/**
 * ShareCard — port of the app's `ui/chat/component/ShareCard.kt`, rendered off-screen and
 * captured to PNG for Share (app ChatScreen.kt:904-935, 1719-1745, 2094-2124).
 *
 * Card (ShareCard.kt): 500 wide at 500:700, white. With a photo: the photo (aspect 1.85, radius
 * LG) inset 16/16/16, then title displaySmall + body, 14 apart, padding 32/20/32/32, truncated to
 * 50 / 460 chars. Text only: title displayMedium + body, 16 apart, padding 32, truncated to 70 /
 * 940. Both black; the body is Markdown. Footer: brand surfacePrimary, padding 32 x 22, the
 * wordmark (22 tall, white) over "Practical advice for your farm" (labelLarge, white), 10 apart,
 * and the Google Play badge (38 tall) on the right.
 *
 * Content: the LAST user message (title, and its photo) and the LAST answer (body), as the app.
 *
 * Sharing: the PNG goes out as an image when the optional peers allow it — `react-native-view-shot`
 * to capture, and on Android `expo-sharing` to attach the file (RN's `Share` attaches a file only on
 * iOS). Otherwise the answer is shared as text. The app's EXTRA_TEXT caption (`share_app_message`)
 * rides with the image on iOS; `expo-sharing` cannot attach a caption on Android.
 */
import React, { useRef } from 'react';
import { Image, Platform, Share, StyleSheet, Text, View } from 'react-native';
import { AnalyticsEvents } from '../../core/analytics';
import { Labels } from '../../core/labels';
import type { FarmerChatSdk } from '../../core/sdk';
import { Assets } from '../assets';
import { useLabel, useTheme } from '../context';
import { radius, typography } from '../theme';
import { MarkdownText } from './Markdown';
import { getSharingModule, getViewShotModule } from './optionalModules';
import { shareCardText } from '../../core/chatWire';

export interface ShareCardHandle {
  share: (sdk: FarmerChatSdk) => Promise<void>;
  download: (sdk: FarmerChatSdk) => Promise<void>;
}

/** App ChatScreen.kt:2088 `SHARE_CAPTION_FALLBACK`. */
const SHARE_CAPTION_FALLBACK =
  'Sharing what FarmerChat taught me—super useful. 👍🏾 Give it a try: https://play.google.com/store/apps/details?id=org.digitalgreen.farmer.chat&hl=en_IN';

const CARD_WIDTH = 500;
const CARD_HEIGHT = 700;

export function useShareCard(
  title: string,
  answer: string,
  imageUri: string | null = null,
): {
  cardElement: React.ReactElement;
  handle: ShareCardHandle;
} {
  const viewShotRef = useRef<{ capture?: () => Promise<string> } | null>(null);
  const theme = useTheme();
  const label = useLabel();
  const hasPhoto = imageUri != null && imageUri.length > 0;
  const text = shareCardText(title, answer, hasPhoto);

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
    // A photo-only question has no title: no leading blank lines.
    await Share.share({ message: [title.trim(), answer].filter((t) => t.length > 0).join('\n\n') });
  };

  /** Image share where the platform allows it; true when it went out as an image. */
  const shareImage = async (uri: string): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      await Share.share({ url: uri, message: label(Labels.SHARE_APP_MESSAGE, SHARE_CAPTION_FALLBACK) });
      return true;
    }
    const sharing = getSharingModule();
    if (!sharing?.shareAsync) return false;
    // expo-sharing's isAvailableAsync: the module's own check when it has one, else available.
    const available = sharing.isAvailableAsync
      ? await sharing.isAvailableAsync().catch(() => false)
      : true;
    if (!available) return false;
    // ChatScreen.kt:2113-2123: ACTION_SEND, image/png, through the system chooser.
    await sharing.shareAsync(uri, { mimeType: 'image/png' });
    return true;
  };

  const shareCard = async () => {
    const uri = await captureOrNull();
    try {
      if (uri === null || !(await shareImage(uri))) await shareText();
    } catch {
      // user dismissed the share sheet
    }
  };

  const handle: ShareCardHandle = {
    share: async (sdk) => {
      sdk.analytics.track(AnalyticsEvents.SHARE_BUTTON_CLICKED, {});
      await shareCard();
    },
    download: async (sdk) => {
      sdk.analytics.track(AnalyticsEvents.SAVE_BUTTON_CLICKED, {});
      // No MediaStore without another native module: the share sheet's "Save image" stands in.
      await shareCard();
    },
  };

  const viewShot = getViewShotModule();
  const inner = (
    <View collapsable={false} style={styles.card}>
      {hasPhoto ? (
        <View style={styles.photoBox}>
          <Image source={{ uri: imageUri ?? undefined }} resizeMode="cover" style={styles.photo} />
        </View>
      ) : null}
      <View style={[styles.body, hasPhoto ? styles.bodyPhoto : styles.bodyText]}>
        <Text style={[hasPhoto ? typography.displaySmall : typography.displayMedium, styles.black]}>
          {text.title}
        </Text>
        <MarkdownText markdown={text.body} color="#000000" />
      </View>
      <View style={[styles.footer, { backgroundColor: theme.brand.surfacePrimary }]}>
        <View style={styles.footerText}>
          <Image source={Assets.logoWordmark} resizeMode="contain" style={styles.wordmark} />
          <Text style={[typography.labelLarge, styles.white]}>
            {label(Labels.PRACTICAL_ADVICE_YOUR_FARM, 'Practical advice for your farm')}
          </Text>
        </View>
        <Image source={Assets.googlePlay} resizeMode="contain" style={styles.badge} />
      </View>
    </View>
  );

  const cardElement = (
    <View style={styles.offscreen} pointerEvents="none" collapsable={false}>
      {viewShot ? (
        <viewShot.default
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ref={viewShotRef as any}
          options={{ format: 'png', quality: 1, result: 'tmpfile' }}
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
  offscreen: { position: 'absolute', left: -10_000, top: 0, width: CARD_WIDTH },
  card: { width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: '#FFFFFF' },
  photoBox: { paddingTop: 16, paddingHorizontal: 16 },
  photo: { width: '100%', aspectRatio: 1.85, borderRadius: radius.lg },
  body: { flex: 1, paddingHorizontal: 32, paddingBottom: 32, overflow: 'hidden' },
  bodyPhoto: { paddingTop: 20, gap: 14 },
  bodyText: { paddingTop: 32, gap: 16 },
  black: { color: '#000000' },
  white: { color: '#FFFFFF' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 22,
  },
  footerText: { gap: 10 },
  // 400:51 wordmark at 22 tall.
  wordmark: { height: 22, width: (22 * 400) / 51, tintColor: '#FFFFFF' },
  // 130:39 badge at 38 tall.
  badge: { height: 38, width: (38 * 130) / 39 },
});
