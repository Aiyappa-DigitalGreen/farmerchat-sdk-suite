/**
 * SessionManager — guest init → OTP login → logout lifecycle
 * (docs/02 "Session & persistence", docs/03 principle 2: SDK owns auth).
 */

import { SessionStore, PrefKeys } from './storage';
import { FarmerChatApi } from './api';
import { getOrCreateDeviceId } from './device';
import type { ApiResult } from './http';
import type { InitializeGuestUserResponse, VerifyOtpResponse } from './types';
import type { Analytics } from './analytics';

export type AuthStateListener = (isAuthenticated: boolean) => void;

export class SessionManager {
  private listeners = new Set<AuthStateListener>();
  private guestInitInFlight: Promise<ApiResult<InitializeGuestUserResponse>> | null = null;
  private sessionStartFired = false;

  constructor(
    private store: SessionStore,
    private api: FarmerChatApi,
    private analytics?: Analytics,
  ) {}

  private fireSessionStart(): void {
    if (this.sessionStartFired) return;
    this.sessionStartFired = true;
    this.analytics?.sessionStart();
  }

  /**
   * C2 HOST_TOKEN: adopt host-supplied tokens and mark the user authenticated,
   * so the SDK skips the phone/OTP journey.
   */
  seedHostToken(accessToken?: string, refreshToken?: string): void {
    if (accessToken) this.store.setString(PrefKeys.ACCESS_TOKEN, accessToken);
    if (refreshToken) this.store.setString(PrefKeys.REFRESH_TOKEN, refreshToken);
    this.store.setBool(PrefKeys.OTP_VERIFIED, true);
    this.fireSessionStart();
    this.emit(true);
  }

  /**
   * Push a freshly-refreshed token into the active session at runtime
   * (HOST_TOKEN mode) — additive to the init seed + tokenProvider. `refreshToken`
   * omitted preserves the stored refresh token. Does not alter OTP auth markers.
   */
  updateTokens(accessToken: string, refreshToken?: string): void {
    this.store.setString(PrefKeys.ACCESS_TOKEN, accessToken);
    if (refreshToken) this.store.setString(PrefKeys.REFRESH_TOKEN, refreshToken);
  }

  get deviceId(): string {
    return getOrCreateDeviceId(this.store);
  }

  get userId(): string | null {
    return this.store.getString(PrefKeys.USER_ID);
  }

  get hasSession(): boolean {
    return this.store.getString(PrefKeys.ACCESS_TOKEN) !== null;
  }

  /** True only after OTP verification (entering a name does not authenticate). */
  isAuthenticated(): boolean {
    return this.store.getBool(PrefKeys.OTP_VERIFIED, false);
  }

  onAuthStateChanged(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Guest init (#1). Single-flight; no-op when a session already exists.
   * Saves tokens, user id and geo hints from the response.
   */
  async ensureGuestSession(coords?: {
    lat?: number | null;
    long?: number | null;
    accuracy?: number | null;
  }): Promise<ApiResult<InitializeGuestUserResponse> | null> {
    if (this.hasSession) return null;
    if (!this.guestInitInFlight) {
      this.guestInitInFlight = this.api
        .initializeUser({
          device_id: this.deviceId,
          lat: coords?.lat ?? null,
          long: coords?.long ?? null,
          accuracy: coords?.accuracy ?? null,
        })
        .then((res) => {
          if (res.ok) this.saveGuestSession(res.data);
          return res;
        })
        .finally(() => {
          this.guestInitInFlight = null;
        });
    }
    return this.guestInitInFlight;
  }

  private saveGuestSession(data: InitializeGuestUserResponse): void {
    this.fireSessionStart();
    this.store.setString(PrefKeys.ACCESS_TOKEN, data.access_token);
    this.store.setString(PrefKeys.REFRESH_TOKEN, data.refresh_token);
    if (data.user_id) this.store.setString(PrefKeys.USER_ID, data.user_id);
    if (data.country_code) this.store.setString(PrefKeys.USER_COUNTRY_CODE, data.country_code);
    if (data.country) this.store.setString(PrefKeys.USER_COUNTRY_NAME, data.country);
    if (data.state) this.store.setString(PrefKeys.USER_STATE, data.state);
  }

  /** OTP verified — persist login state (AppNavGraph Auth onSuccess edge). */
  completeOtpLogin(phoneE164: string, response: VerifyOtpResponse): void {
    if (response.access_token) this.store.setString(PrefKeys.ACCESS_TOKEN, response.access_token);
    if (response.refresh_token) this.store.setString(PrefKeys.REFRESH_TOKEN, response.refresh_token);
    if (response.user_id) this.store.setString(PrefKeys.USER_ID, response.user_id);
    this.store.setBool(PrefKeys.OTP_VERIFIED, true);
    this.store.setString(PrefKeys.PHONE_NUMBER_LOGIN, phoneE164);
    this.store.setBool(PrefKeys.KEY_NAME_SCREEN_SEEN, true);
    if (response.preferred_language?.code) {
      this.store.setString(PrefKeys.SELECTED_LANGUAGE_CODE, response.preferred_language.code);
    }
    this.fireSessionStart();
    this.emit(true);
  }

  /**
   * Full logout: `api/user/logout/` + clear all fc_sdk_ prefs
   * (preserving appearance) — mirrors the Settings logout edge.
   */
  async logout(): Promise<void> {
    try {
      await this.api.logout();
    } catch {
      // Server logout is best-effort; local clear always happens.
    }
    this.store.clearAll([PrefKeys.APPEARANCE_MODE]);
    this.sessionStartFired = false;
    this.emit(false);
  }

  private emit(isAuthenticated: boolean): void {
    for (const l of this.listeners) {
      try {
        l(isAuthenticated);
      } catch {
        // ignore listener failures
      }
    }
  }
}
