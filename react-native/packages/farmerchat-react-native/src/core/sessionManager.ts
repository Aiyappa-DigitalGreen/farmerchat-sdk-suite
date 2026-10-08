/**
 * SessionManager — token lifecycle owned by the SDK (docs/03 §Principles #2):
 * guest init → OTP login → refresh (TokenAuthenticator) → logout.
 * Host never touches tokens.
 */
import type { ApiResult } from './apiResult';
import type { FarmerChatApi } from './api';
import { AnalyticsEvents, type AnalyticsManager } from './analytics';
import type { ResolvedFarmerChatConfig } from './config';
import { SessionStore, StorageKeys } from './sessionStore';
import type {
  InitializeGuestUserResponse,
  VerifyOtpResponse,
} from './types';

export type AuthStateListener = (isAuthenticated: boolean) => void;

export class SessionManager {
  private authListeners = new Set<AuthStateListener>();
  private guestReplacedListeners = new Set<() => void>();
  private guestGen = 0;
  private guestInitInFlight: Promise<ApiResult<InitializeGuestUserResponse>> | null =
    null;
  private sessionStarted = false;

  constructor(
    private readonly api: FarmerChatApi,
    private readonly store: SessionStore,
    private readonly analytics: AnalyticsManager,
    private readonly config: ResolvedFarmerChatConfig,
  ) {}

  private get isHostToken(): boolean {
    return this.config.authMode === 'HOST_TOKEN';
  }

  /** Fire onSessionStart (C4) exactly once, when tokens are first obtained. */
  private markSessionStarted(): void {
    if (this.sessionStarted) return;
    this.sessionStarted = true;
    this.analytics.fireCallback('onSessionStart');
  }

  /**
   * True once the user is signed in. In SDK_OTP mode that's `OTP_VERIFIED`;
   * in HOST_TOKEN mode the host-supplied token means the user is authenticated
   * (docs/07 C2 — "treats the user as authenticated").
   */
  get isAuthenticated(): boolean {
    if (this.isHostToken) return this.store.accessToken !== null;
    return this.store.getBoolean(StorageKeys.OTP_VERIFIED);
  }

  /**
   * HOST_TOKEN init (C2): seed the SDK with the host's access/refresh token or
   * `tokenProvider` result. Skips OTP entirely. Idempotent.
   */
  async initHostToken(): Promise<void> {
    if (!this.isHostToken) return;
    if (this.store.accessToken === null) {
      let access = this.config.accessToken;
      let refresh = this.config.refreshToken;
      if (!access && this.config.tokenProvider) {
        try {
          const provided = await this.config.tokenProvider();
          if (provided) {
            access = provided.accessToken;
            refresh = provided.refreshToken ?? null;
          }
        } catch {
          // provider failure → onSessionExpired handled later on 401
        }
      }
      if (access) this.store.saveTokens(access, refresh ?? null);
    }
    if (this.store.accessToken !== null) {
      this.markSessionStarted();
      this.notifyAuthState();
    }
  }

  /** True once we hold tokens (guest or logged-in). */
  get hasSession(): boolean {
    return this.store.accessToken !== null && this.store.userId !== null;
  }

  get userId(): string | null {
    return this.store.userId;
  }

  /**
   * Push a freshly-refreshed token into the active session at runtime
   * (HOST_TOKEN mode) — additive to the init seed + tokenProvider. When
   * `refreshToken` is undefined the stored refresh token is preserved. Does not
   * alter OTP auth markers.
   */
  updateTokens(accessToken: string, refreshToken?: string): void {
    this.store.saveTokens(accessToken, refreshToken ?? this.store.refreshToken);
  }

  addAuthStateListener(listener: AuthStateListener): () => void {
    this.authListeners.add(listener);
    return () => {
      this.authListeners.delete(listener);
    };
  }

  /**
   * docs/02 Step 3: the 401 authenticator replaced a rejected guest with a new one. Screens that
   * loaded data for the old `user_id` (Home: conversation, feed, weather, profile) reload on this.
   */
  addGuestReplacedListener(listener: () => void): () => void {
    this.guestReplacedListeners.add(listener);
    return () => {
      this.guestReplacedListeners.delete(listener);
    };
  }

  /**
   * Bumped on every guest replacement, before listeners run. A load that started under an older
   * generation was built with the old `user_id` (or is its stale retry) and must drop its result,
   * or it can land after — and overwrite — the reload.
   */
  get guestGeneration(): number {
    return this.guestGen;
  }

  notifyGuestReplaced(): void {
    this.guestGen += 1;
    for (const l of Array.from(this.guestReplacedListeners)) {
      try {
        l();
      } catch {
        // listener errors never break the SDK
      }
    }
  }

  private notifyAuthState(): void {
    const authed = this.isAuthenticated;
    for (const l of Array.from(this.authListeners)) {
      try {
        l(authed);
      } catch {
        // listener errors never break the SDK
      }
    }
  }

  /**
   * Guest init (endpoint #1) — issues tokens + user id. Single-flight and a
   * no-op when a session already exists (unless force).
   */
  async ensureGuestSession(
    options: { lat?: number | null; long?: number | null; accuracy?: number | null } = {},
  ): Promise<ApiResult<InitializeGuestUserResponse> | null> {
    if (this.hasSession) return null;
    if (this.guestInitInFlight) return this.guestInitInFlight;

    const flight = this.api
      .initializeGuestUser({
        device_id: this.store.getOrCreateDeviceId(),
        lat: options.lat ?? this.store.getDouble(StorageKeys.FARMER_APP_LATITUDE),
        long: options.long ?? this.store.getDouble(StorageKeys.FARMER_APP_LONGITUDE),
        accuracy: options.accuracy ?? null,
        utm_source: this.store.getString(StorageKeys.UTM_SOURCE),
        utm_medium: this.store.getString(StorageKeys.UTM_MEDIUM),
        utm_campaign: this.store.getString(StorageKeys.UTM_CAMPAIGN),
        moengage_id: null,
        google_advertise_id: null,
      })
      .then((result) => {
        if (result.ok) {
          const data = result.data;
          // In HOST_TOKEN mode the host's token is the identity — keep it and
          // only harvest the user_id/country from guest-init (C2).
          if (!this.isHostToken) {
            this.store.saveTokens(data.access_token, data.refresh_token);
          }
          if (data.user_id) this.store.saveUserId(data.user_id);
          if (data.country_code) this.store.set(StorageKeys.USER_COUNTRY_CODE, data.country_code);
          if (data.country) this.store.set(StorageKeys.USER_COUNTRY_NAME, data.country);
          if (data.state) this.store.set(StorageKeys.USER_STATE, data.state);
          this.markSessionStarted();
        }
        return result;
      })
      .finally(() => {
        this.guestInitInFlight = null;
      });
    this.guestInitInFlight = flight;
    return flight;
  }

  /**
   * Post-OTP session promotion (endpoint #21 success path). Saves tokens,
   * OTP_VERIFIED, phone, marks name screen seen, preferred language config.
   */
  completeOtpLogin(response: VerifyOtpResponse, phoneE164: string): void {
    if (response.access_token && response.refresh_token) {
      this.store.saveTokens(response.access_token, response.refresh_token);
    }
    if (response.user_id) this.store.saveUserId(response.user_id);
    this.store.set(StorageKeys.OTP_VERIFIED, true);
    this.store.set(StorageKeys.PHONE_NUMBER_LOGIN, phoneE164);
    this.store.set(StorageKeys.KEY_NAME_SCREEN_SEEN, true);
    if (!this.store.getBoolean(StorageKeys.FIRST_LOGIN_DONE)) {
      this.store.set(StorageKeys.FIRST_LOGIN_DONE, true);
    }
    if (response.name) this.store.set(StorageKeys.USER_NAME, response.name);
    const lang = response.preferred_language;
    if (lang?.code) this.store.set(StorageKeys.SELECTED_LANGUAGE_CODE, lang.code);
    if (lang?.id !== null && lang?.id !== undefined) {
      this.store.set(StorageKeys.SELECTED_LANGUAGE_ID, lang.id);
    }
    if (lang?.display_name) {
      this.store.set(StorageKeys.SELECTED_LANGUAGE_DISPLAY_NAME, lang.display_name);
    }
    this.analytics.track(
      response.existing_user
        ? AnalyticsEvents.LOGIN_COMPLETED
        : AnalyticsEvents.REGISTRATION_COMPLETED,
      { phone: phoneE164, existing_user: response.existing_user === true },
    );
    this.notifyAuthState();
  }

  /**
   * Full logout (docs/01 §Settings onLogOutClick + docs/02 §Session):
   * `api/user/logout/` + clear all prefs (preserving appearance) + reset identity.
   */
  async logout(): Promise<void> {
    this.analytics.track(AnalyticsEvents.LOGOUT_CLICK_EVENT, {});
    try {
      await this.api.logout();
    } catch {
      // logout API failure never blocks local logout
    }
    await this.store.clearAllPreservingAppearance();
    this.notifyAuthState();
  }
}
