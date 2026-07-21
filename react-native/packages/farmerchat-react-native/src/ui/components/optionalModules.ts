/**
 * Optional peer modules — react-native-webview and react-native-view-shot are
 * optional peers (react-native/CLAUDE.md): the SDK degrades gracefully
 * (feature off + console.warn) when absent and never crashes on import.
 */
import type * as ViewShotModule from 'react-native-view-shot';
import type * as WebViewModule from 'react-native-webview';

let webViewModule: typeof WebViewModule | null | undefined;
let viewShotModule: typeof ViewShotModule | null | undefined;

export function getWebViewModule(): typeof WebViewModule | null {
  if (webViewModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      webViewModule = require('react-native-webview') as typeof WebViewModule;
    } catch {
      webViewModule = null;
      console.warn(
        '[FarmerChat] react-native-webview is not installed — legal/FAQ pages will open in the external browser instead.',
      );
    }
  }
  return webViewModule;
}

export function getViewShotModule(): typeof ViewShotModule | null {
  if (viewShotModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      viewShotModule = require('react-native-view-shot') as typeof ViewShotModule;
    } catch {
      viewShotModule = null;
      console.warn(
        '[FarmerChat] react-native-view-shot is not installed — answers will be shared as text instead of an image card.',
      );
    }
  }
  return viewShotModule;
}
