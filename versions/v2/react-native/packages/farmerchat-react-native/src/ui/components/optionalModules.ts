/**
 * Optional peer modules used by the UI. All are OPTIONAL peers (react-native/CLAUDE.md): the SDK
 * degrades gracefully (feature off + one console.warn) when one is absent and never crashes.
 * Resolution lives in core/optionalPeers.ts — see there for why nothing is `require`d lazily.
 *
 *  - react-native-webview     legal/FAQ pages in-app            (else external browser)
 *  - react-native-view-shot   capture the answer share card     (else share text)
 *  - expo-sharing             attach the card PNG on Android    (else share text on Android)
 *  (expo-image-manipulator, for the photo-upload downscale, is resolved in core/imageShrink.ts.)
 */
import type * as ViewShotModule from 'react-native-view-shot';
import type * as WebViewModule from 'react-native-webview';
import {
  optionalExpoNativeModule,
  optionalViewShot,
  optionalWebView,
  warnOnce,
} from '../../core/optionalPeers';

export function getWebViewModule(): typeof WebViewModule | null {
  const mod = optionalWebView();
  if (!mod) {
    warnOnce(
      'webview',
      '[FarmerChat] react-native-webview is not installed — legal/FAQ pages will open in the external browser instead.',
    );
  }
  return mod;
}

export function getViewShotModule(): typeof ViewShotModule | null {
  const mod = optionalViewShot();
  if (!mod) {
    warnOnce(
      'view-shot',
      '[FarmerChat] react-native-view-shot is not installed — answers will be shared as text instead of an image card.',
    );
  }
  return mod;
}

/** The slice of the `ExpoSharing` native module the share card uses. */
export interface SharingModule {
  isAvailableAsync?(): Promise<boolean>;
  shareAsync(
    url: string,
    options?: { mimeType?: string; dialogTitle?: string; UTI?: string },
  ): Promise<void>;
}

/**
 * `expo-sharing` — React Native's own `Share` attaches a file only on iOS (`url` is iOS-only), so
 * on Android sharing the card as an IMAGE needs it. Absent: Android shares text.
 */
export function getSharingModule(): SharingModule | null {
  const mod = optionalExpoNativeModule<SharingModule>('ExpoSharing');
  if (!mod?.shareAsync) {
    warnOnce(
      'sharing',
      '[FarmerChat] expo-sharing is not installed — on Android, answers will be shared as text instead of an image card.',
    );
    return null;
  }
  return mod;
}
