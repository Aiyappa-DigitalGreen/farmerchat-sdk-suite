/**
 * TokenAuthenticator — 401 refresh replicating the app's OkHttp authenticator
 * (docs/02 §TokenAuthenticator):
 *  - Skip URLs containing: generate_otp, verify_otp, get_new_access_token,
 *    send_tokens, initialize_user.
 *  - Loop guard: ≥2 prior auth attempts on the same request → give up.
 *  - Step 1: refresh via get_new_access_token; save tokens; retry with Bearer.
 *  - Step 2 fallback: send_tokens(device_id, user_id) with guest API key.
 *  - Single-flight: concurrent 401s share one refresh (mutex).
 */
import type { ResolvedFarmerChatConfig } from './config';
import { BUILD_VERSION_HEADER_VALUE } from './config';
import { getDeviceInfoHeader } from './deviceInfo';
import { SessionStore } from './sessionStore';
import type { RefreshTokenResponse } from './types';

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
    // Step 1 — refresh token.
    const refreshToken = this.store.refreshToken;
    if (refreshToken) {
      const refreshed = await this.postTokenEndpoint(
        'api/user/get_new_access_token/',
        { refresh_token: refreshToken },
        null,
      );
      if (refreshed) {
        this.store.saveTokens(refreshed.access_token, refreshed.refresh_token);
        return refreshed.access_token;
      }
    }

    // HOST_TOKEN mode (C2): ask the host for a fresh token instead of the
    // guest send_tokens fallback; onSessionExpired if it can't provide one.
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

    // Step 2 — guest send_tokens fallback with API-Key.
    const deviceId = this.store.getOrCreateDeviceId();
    const userId = this.store.userId;
    if (userId) {
      const guest = await this.postTokenEndpoint(
        'api/user/send_tokens/',
        { device_id: deviceId, user_id: userId },
        this.config.guestApiKey,
      );
      if (guest) {
        this.store.saveTokens(guest.access_token, guest.refresh_token);
        return guest.access_token;
      }
    }

    this.onSessionExpired();
    return null;
  }

  private async postTokenEndpoint(
    path: string,
    body: Record<string, string>,
    apiKey: string | null,
  ): Promise<RefreshTokenResponse | null> {
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
      if (!response.ok) return null;
      const json = (await response.json()) as RefreshTokenResponse;
      if (!json.access_token || !json.refresh_token) return null;
      return json;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
