/**
 * TokenAuthenticator — 401 refresh replicating the app's OkHttp authenticator
 * (docs/02 §TokenAuthenticator):
 *  - Skip URLs containing: generate_otp, verify_otp, get_new_access_token,
 *    send_tokens, initialize_user.
 *  - Loop guard: ≥2 prior auth attempts on the same request → give up.
 *  - Step 1: refresh via get_new_access_token; save tokens; retry with Bearer.
 *  - Step 2 fallback: send_tokens(device_id, user_id) with guest API key.
 *  - Step 3 guest re-initialisation: only when not HOST_TOKEN, the session is
 *    a guest (`OTP_VERIFIED` not set) and Step 2 failed because the identity
 *    was rejected (send_tokens 400/401/403/404, or no user_id/device_id to
 *    send) — never on a network error, timeout or 5xx. initialize_user with
 *    the guest API key and {device_id, lat?, long?} — the stored GPS fix, else
 *    the onboarding fallback (host default lat/long → device-locale centroid);
 *    (0, 0) is unresolved and sent as nothing. On an access_token, save tokens +
 *    user_id, drop NEW_CONVERSATION_ID and the old place names (district /
 *    state / country name), persist country_code/country/state from the
 *    response (as the first guest init does), signal `onGuestReplaced` so
 *    screens re-run their entry loads, and retry. Otherwise session expired.
 *  - Single-flight: concurrent 401s share one refresh (mutex).
 */
import type { ResolvedFarmerChatConfig } from './config';
import { BUILD_VERSION_HEADER_VALUE, resolveFallbackCoordinates } from './config';
import { isResolved } from './countryLatLng';
import { getDeviceInfoHeader } from './deviceInfo';
import { SessionStore, StorageKeys } from './sessionStore';
import type { InitializeGuestUserResponse, RefreshTokenResponse } from './types';

/** send_tokens statuses that mean the backend rejected the stored identity (docs/02 Step 3). */
const IDENTITY_REJECTED_STATUSES = [400, 401, 403, 404] as const;

/**
 * Outcome of a token-endpoint call. `status` is the HTTP status of a non-OK
 * response; it is absent on a network error / timeout / abort, so callers can
 * tell "the server rejected this" apart from "we never got an answer".
 */
type TokenCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; status?: number };

export const AUTH_SKIP_URL_PARTS = [
  'generate_otp',
  'verify_otp',
  'get_new_access_token',
  'send_tokens',
  'initialize_user',
] as const;

export function isAuthSkippedUrl(url: string): boolean {
  return AUTH_SKIP_URL_PARTS.some((part) => url.includes(part));
}

export class TokenAuthenticator {
  private refreshInFlight: Promise<string | null> | null = null;

  constructor(
    private readonly config: ResolvedFarmerChatConfig,
    private readonly store: SessionStore,
    private readonly onSessionExpired: () => void,
    /**
     * Step 3 succeeded: a NEW guest replaced the rejected one. The request that 401'd is retried,
     * but it (and any concurrent one) was built with the old `user_id`, so screens must re-run
     * their entry loads (new conversation, feed, weather, profile).
     */
    private readonly onGuestReplaced?: () => void,
  ) {}

  /**
   * Returns a fresh access token, or null if refresh + guest fallback both
   * failed (session expired). Concurrent callers share one in-flight refresh.
   */
  authenticate(): Promise<string | null> {
    if (this.refreshInFlight) return this.refreshInFlight;
    const flight = this.doAuthenticate().finally(() => {
      this.refreshInFlight = null;
    });
    this.refreshInFlight = flight;
    return flight;
  }

  private async doAuthenticate(): Promise<string | null> {
    // HOST_TOKEN mode (C2): ask the host for a fresh token FIRST — the host owns
    // identity, so never call the SDK's own get_new_access_token / guest
    // send_tokens grants (parity with iOS/web, which short-circuit HOST_TOKEN
    // before Step 1). onSessionExpired if the host can't provide one.
    if (this.config.authMode === 'HOST_TOKEN') {
      if (this.config.tokenProvider) {
        try {
          const provided = await this.config.tokenProvider();
          if (provided?.accessToken) {
            this.store.saveTokens(provided.accessToken, provided.refreshToken ?? null);
            return provided.accessToken;
          }
        } catch {
          // fall through to session-expired
        }
      }
      this.onSessionExpired();
      return null;
    }

    // Step 1 — refresh token.
    const refreshToken = this.store.refreshToken;
    if (refreshToken) {
      const refreshed = await this.postTokenEndpoint<RefreshTokenResponse>(
        'api/user/get_new_access_token/',
        { refresh_token: refreshToken },
        null,
      );
      if (refreshed.ok && hasTokenPair(refreshed.data)) {
        this.store.saveTokens(refreshed.data.access_token, refreshed.data.refresh_token);
        return refreshed.data.access_token;
      }
    }

    // Step 2 — guest send_tokens fallback with API-Key.
    const deviceId = this.store.getOrCreateDeviceId();
    const userId = this.store.userId;
    // Step 3 eligibility (d): there was no identity to send (the device id is
    // always created above), or send_tokens rejected it — set below. A network
    // error, timeout or 5xx leaves it false.
    let identityRejected = !userId;
    if (userId) {
      const guest = await this.postTokenEndpoint<RefreshTokenResponse>(
        'api/user/send_tokens/',
        { device_id: deviceId, user_id: userId },
        this.config.guestApiKey,
      );
      if (guest.ok && hasTokenPair(guest.data)) {
        this.store.saveTokens(guest.data.access_token, guest.data.refresh_token);
        return guest.data.access_token;
      }
      if (!guest.ok && guest.status !== undefined) {
        identityRejected = (IDENTITY_REJECTED_STATUSES as readonly number[]).includes(
          guest.status,
        );
      }
    }

    // Step 3 — guest re-initialisation (HOST_TOKEN already returned above).
    // A phone-verified identity is never replaced.
    const isGuest = !this.store.getBoolean(StorageKeys.OTP_VERIFIED);
    if (isGuest && identityRejected) {
      const body: Record<string, string | number> = { device_id: deviceId };
      // Stored GPS fix first, then the onboarding fallback; (0, 0) counts as unresolved. A guest
      // re-initialised with no coordinates has no location server-side, and endpoint #12 then
      // returns an empty feed.
      const fixLat = this.store.getDouble(StorageKeys.FARMER_APP_LATITUDE);
      const fixLng = this.store.getDouble(StorageKeys.FARMER_APP_LONGITUDE);
      let coords: [number, number] | null =
        fixLat !== null && fixLng !== null && isResolved(fixLat, fixLng) ? [fixLat, fixLng] : null;
      if (!coords) {
        try {
          const [fbLat, fbLng] = resolveFallbackCoordinates(this.config);
          if (isResolved(fbLat, fbLng)) coords = [fbLat, fbLng];
        } catch {
          // a failing fallback just means no coordinates
        }
      }
      if (coords) {
        body.lat = coords[0];
        body.long = coords[1];
      }
      const init = await this.postTokenEndpoint<InitializeGuestUserResponse>(
        'api/user/initialize_user/',
        body,
        this.config.guestApiKey,
      );
      const accessToken = init.ok ? init.data.access_token : undefined;
      if (init.ok && typeof accessToken === 'string' && accessToken.trim() !== '') {
        this.store.saveTokens(accessToken, init.data.refresh_token || null);
        if (init.data.user_id) this.store.saveUserId(init.data.user_id);
        // The conversation and the place names belonged to the rejected user; the new guest's
        // location is whatever this response says (same writes as the first guest init).
        this.store.remove(StorageKeys.NEW_CONVERSATION_ID);
        for (const k of [
          StorageKeys.USER_DISTRICT,
          StorageKeys.USER_STATE,
          StorageKeys.USER_COUNTRY_NAME,
        ]) {
          this.store.remove(k);
        }
        if (init.data.country_code) this.store.set(StorageKeys.USER_COUNTRY_CODE, init.data.country_code);
        if (init.data.country) this.store.set(StorageKeys.USER_COUNTRY_NAME, init.data.country);
        if (init.data.state) this.store.set(StorageKeys.USER_STATE, init.data.state);
        try {
          this.onGuestReplaced?.();
        } catch {
          // listener errors never break the retry
        }
        return accessToken;
      }
    }

    this.onSessionExpired();
    return null;
  }

  private async postTokenEndpoint<T>(
    path: string,
    body: Record<string, string | number>,
    apiKey: string | null,
  ): Promise<TokenCallResult<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Build-Version': BUILD_VERSION_HEADER_VALUE,
        'Device-Info': getDeviceInfoHeader(),
      };
      if (apiKey) headers['API-Key'] = apiKey;
      const response = await fetch(this.config.baseUrl + path, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) return { ok: false, status: response.status };
      return { ok: true, data: (await response.json()) as T };
    } catch {
      // network error, timeout/abort, or an unparseable body — no status.
      return { ok: false };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Steps 1–2 keep their original contract: both tokens must be present. */
function hasTokenPair(json: RefreshTokenResponse): boolean {
  return Boolean(json.access_token) && Boolean(json.refresh_token);
}
