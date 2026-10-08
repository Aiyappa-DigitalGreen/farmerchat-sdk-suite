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

window.FarmerChatWidget = FarmerChatWidgetAPI;

const settings = window.farmerChatWidgetSettings;
if (settings) {
  const boot = () => FarmerChatWidgetAPI.boot(settings);
  if (document.body) boot();
  else document.addEventListener('DOMContentLoaded', boot, { once: true });
}
