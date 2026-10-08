/**
 * Composition root — builds the whole core object graph from a FarmerChatConfig.
 */

import { FarmerChatConfig, ResolvedConfig, resolveConfig } from './config';
import { SessionStore, PrefKeys } from './storage';
import { LabelManager } from './labels';
import { HttpClient } from './http';
import { FarmerChatApi } from './api';
import { SessionManager } from './session';
import { Analytics } from './analytics';
import { resolveFallbackCoordinates } from './fallbackLocation';
import { isResolved } from './countryLatLng';

export interface SdkServices {
  config: ResolvedConfig;
  store: SessionStore;
  labels: LabelManager;
  http: HttpClient;
  api: FarmerChatApi;
  session: SessionManager;
  analytics: Analytics;
}

export function createServices(config: FarmerChatConfig): SdkServices {
  const resolved = resolveConfig(config);
  const store = new SessionStore();
  // FarmerChatGraph.kt parity: everything the SDK stores — tokens, user id, labels, conversation,
  // location — belongs to the backend that issued it. When the base URL changes since the last
  // init, wipe it all (keeping only the appearance choice), or the new backend receives another
  // backend's token, rejects it, and the guest-token fallback fails too.
  const lastBase = store.getString(PrefKeys.LAST_BASE_URL);
  if (lastBase && lastBase !== resolved.baseUrl) {
    store.clearAll([PrefKeys.APPEARANCE_MODE]);
  }
  store.setString(PrefKeys.LAST_BASE_URL, resolved.baseUrl);
  const labels = new LabelManager(store, {
    stringOverrides: resolved.stringOverrides,
    forcedLocale: resolved.locale,
  });
  const http = new HttpClient({
    baseUrl: resolved.baseUrl,
    guestApiKey: resolved.guestApiKey,
    store,
    labels,
    onSessionExpired: resolved.onSessionExpired,
    authMode: resolved.authMode,
    tokenProvider: resolved.tokenProvider,
    fallbackCoordinates: () => {
      const fb = resolveFallbackCoordinates(resolved);
      return isResolved(fb.lat, fb.lng) ? { lat: fb.lat, lng: fb.lng } : null;
    },
    // `session` is created below; this only runs on a 401, long after construction.
    onGuestReplaced: () => session.notifyGuestReplaced(),
  });
  const api = new FarmerChatApi(http, resolved.guestApiKey, resolved.geoApiKey);
  const analytics = new Analytics(resolved.onEvent, resolved.callbacks, resolved.enableAnalytics);
  const session = new SessionManager(store, api, analytics, resolved.authMode);

  // Preselect language from config: skips the language screen when provided.
  if (resolved.languageCode && !store.getBool(PrefKeys.LANGUAGE_DONE, false)) {
    labels.setLanguageCode(resolved.languageCode);
  }

  // C2 HOST_TOKEN: seed host-supplied tokens and treat the user as authenticated,
  // so the phone/OTP UI is skipped entirely (docs/07 Part C).
  if (resolved.authMode === 'HOST_TOKEN') {
    session.seedHostToken(resolved.accessToken, resolved.refreshToken);
  }

  return { config: resolved, store, labels, http, api, session, analytics };
}
