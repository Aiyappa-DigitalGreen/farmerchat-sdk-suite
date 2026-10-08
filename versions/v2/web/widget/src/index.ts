/**
 * @digitalgreenorg/farmerchat-widget — Intercom-style web widget for the
 * complete FarmerChat SDK.
 *
 *   <FarmerChatWidget config={...}/>         React component
 *   FarmerChatWidgetAPI.boot(options)        imperative mount (no React in the host)
 *   FarmerChatWidgetAPI.open(question?)      open (optionally deep-linking a question)
 *   FarmerChatWidgetAPI.close() / toggle() / isOpen()
 *   FarmerChatWidgetAPI.shutdown()           unmount the widget
 *   FarmerChatWidgetAPI.sdk                  the SDK's own static API (logout, sendQuestion, …)
 */
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { FarmerChat } from '@digitalgreenorg/farmerchat-web';
import { FarmerChatWidget, withWidget, currentWidget, ensureSdk, type FarmerChatWidgetProps } from './widget';

export { FarmerChatWidget };
export type { FarmerChatWidgetProps, WidgetHandle } from './widget';
export { shouldUseFullscreen } from './layout';
export { FARMERCHAT_WIDGET_VERSION } from './version';
export type { FarmerChatConfig } from '@digitalgreenorg/farmerchat-web';

/** Options for `boot()` — the component props plus an optional mount container. */
export interface WidgetBootOptions extends FarmerChatWidgetProps {
  /** Where to append the widget's host element (default `document.body`). */
  container?: Element;
}

let bootedRoot: Root | null = null;
let lastOptions: WidgetBootOptions | null = null;
let bootedEl: HTMLElement | null = null;

export interface FarmerChatWidgetStatics {
  boot(options: WidgetBootOptions): void;
  /**
   * Merge new options into the booted widget. Omit `config` (or pass the same
   * object) to keep the live session; a new `config` object rebuilds the SDK and
   * remounts the panel. Ignored before boot.
   */
  update(options: Partial<WidgetBootOptions>): void;
  shutdown(): void;
  open(question?: string): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  isBooted(): boolean;
  /** The SDK's static API, for logout / sendQuestion / openScreen / onAuthStateChanged … */
  sdk: typeof FarmerChat;
}

function render(options: WidgetBootOptions): void {
  lastOptions = options;
  // Synchronously, so `.sdk.*` works on the very next line after boot().
  ensureSdk(options.config);
  const { container: _container, ...props } = options;
  bootedRoot?.render(createElement(FarmerChatWidget, props));
}

export const FarmerChatWidgetAPI: FarmerChatWidgetStatics = {
  boot(options) {
    if (!options || !options.config) throw new Error('[FarmerChatWidget] boot({ config }) is required.');
    if (bootedRoot) {
      // The SDK is a page-level singleton, so there is only ever one widget: a
      // second boot re-renders the existing one instead of stacking another.
      console.warn('[FarmerChatWidget] already booted — updating instead. Call shutdown() first to remount.');
      render(options);
      return;
    }
    const el = document.createElement('div');
    el.setAttribute('data-farmerchat-widget-host', '');
    (options.container ?? document.body).appendChild(el);
    bootedEl = el;
    bootedRoot = createRoot(el);
    render(options);
  },

  update(options) {
    if (bootedRoot && lastOptions) render({ ...lastOptions, ...options });
  },

  shutdown() {
    bootedRoot?.unmount();
    bootedEl?.remove();
    bootedRoot = null;
    bootedEl = null;
    lastOptions = null;
  },

  open(question) {
    withWidget((w) => w.open(question));
  },

  close() {
    currentWidget()?.close();
  },

  toggle() {
    withWidget((w) => w.toggle());
  },

  isOpen() {
    return currentWidget()?.isOpen() ?? false;
  },

  isBooted() {
    return bootedRoot !== null;
  },

  sdk: FarmerChat,
};

export default FarmerChatWidgetAPI;
