/**
 * Script-tag entry (IIFE, React bundled). Exposes `window.FarmerChatWidget`.
 *
 * Two ways to boot, Intercom-style:
 *   1. Set `window.farmerChatWidgetSettings = { config: {...}, ... }` BEFORE the
 *      script tag — the widget boots itself on load.
 *   2. Call `FarmerChatWidget.boot({ config: {...} })` any time after load.
 *
 * Callbacks (`onEvent`, `tokenProvider`, …) are functions, so configuration is
 * JavaScript, not `data-*` attributes.
 */
import { FarmerChatWidgetAPI, type WidgetBootOptions } from './index';

declare global {
  interface Window {
    FarmerChatWidget?: typeof FarmerChatWidgetAPI;
    farmerChatWidgetSettings?: WidgetBootOptions;
  }
}

// The illustrations ship in `illustrations/` beside this script (copied at build time), so a host
// that only drops in the script tag still gets them. A host-set `config.assetBaseUrl` wins.
const scriptSrc = (document.currentScript as HTMLScriptElement | null)?.src;
const defaultAssetBase = scriptSrc ? new URL('illustrations/', scriptSrc).href : '';
// Memoised per host config object: the widget rebuilds the SDK when the config IDENTITY changes,
// so the same host config must always map to the same wrapped object.
const wrapped = new WeakMap<object, WidgetBootOptions['config']>();
function withAssetBase(options: WidgetBootOptions): WidgetBootOptions {
  const config = options.config;
  if (!defaultAssetBase || !config || config.assetBaseUrl !== undefined) return options;
  let next = wrapped.get(config);
  if (!next) {
    next = { ...config, assetBaseUrl: defaultAssetBase };
    wrapped.set(config, next);
  }
  return { ...options, config: next };
}
const api: typeof FarmerChatWidgetAPI = {
  ...FarmerChatWidgetAPI,
  boot: (options) => FarmerChatWidgetAPI.boot(withAssetBase(options)),
  update: (options) =>
    FarmerChatWidgetAPI.update(options.config ? withAssetBase(options as WidgetBootOptions) : options),
};

window.FarmerChatWidget = api;

const settings = window.farmerChatWidgetSettings;
if (settings) {
  const boot = () => api.boot(settings);
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot, { once: true });
}
