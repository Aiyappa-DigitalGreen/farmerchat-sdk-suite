/**
 * Optional peer dependencies — resolved ONCE, here, so a host that installs none of them still
 * builds and runs (root/react-native CLAUDE.md: feature off + console.warn, never crash).
 *
 * Two kinds:
 *
 * 1. JS packages (react-native-view-shot, react-native-webview, expo-localization) are required at
 *    this module's TOP LEVEL inside try/catch. Metro bundles a throwing stub for a missing
 *    optional dependency; metro-runtime's `guardedLoadModule` (require.js) reports such a throw as a
 *    FATAL error (red box in dev, crash in release) when the `require` runs OUTSIDE a module load —
 *    e.g. from a render or a tap handler — before any try/catch sees it. During a module load the
 *    guard is already held, so the throw reaches the catch below. Hence: never `require` an
 *    optional package lazily at runtime; read the result from here.
 *
 * 2. Native-only Expo modules (expo-sharing → `ExpoSharing`, expo-image-manipulator →
 *    `ExpoImageManipulator`) are looked up on `globalThis.expo.modules`, where Expo installs every
 *    linked module's JSI object (this is what `requireOptionalNativeModule` reads). No JS package —
 *    and no `expo-modules-core` import — is needed, so a host without them is simply "absent".
 */
/* eslint-disable @typescript-eslint/no-var-requires */
import type * as ViewShotModule from 'react-native-view-shot';
import type * as WebViewModule from 'react-native-webview';

let viewShot: typeof ViewShotModule | null = null;
try {
  viewShot = require('react-native-view-shot') as typeof ViewShotModule;
} catch {
  viewShot = null;
}

let webView: typeof WebViewModule | null = null;
try {
  webView = require('react-native-webview') as typeof WebViewModule;
} catch {
  webView = null;
}

/** The slice of expo-localization the SDK reads. */
export interface LocalizationModule {
  getLocales?: () => Array<{ regionCode?: string | null; languageTag?: string | null }>;
  region?: string | null;
}
let localization: LocalizationModule | null = null;
try {
  localization = require('expo-localization') as LocalizationModule;
} catch {
  localization = null;
}

export const optionalViewShot = (): typeof ViewShotModule | null => viewShot;
export const optionalWebView = (): typeof WebViewModule | null => webView;
export const optionalLocalization = (): LocalizationModule | null => localization;

/** A linked Expo native module by name, or null (never throws). */
export function optionalExpoNativeModule<T>(name: string): T | null {
  try {
    const expo = (globalThis as { expo?: { modules?: Record<string, unknown> } }).expo;
    const mod = expo?.modules?.[name];
    return (mod as T | undefined) ?? null;
  } catch {
    return null;
  }
}

const warned = new Set<string>();
/** One console.warn per key for the life of the JS runtime. */
export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}
