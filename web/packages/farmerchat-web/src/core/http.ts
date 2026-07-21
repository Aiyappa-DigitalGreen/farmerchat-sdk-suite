/**
 * Fetch client reproducing the app's OkHttp behavior
 * (docs/02 "Networking behavior"):
 *
 * - ApiPriority timeouts/retries: P1 5s/1, P2 10s/2, P3 30s/3 (AbortController).
 * - Headers: X-Request-ID, X-Timeout, Build-Version: v2, Device-Info
 *   (URL-encoded JSON), Authorization: Bearer <access> when present.
 * - Retryable HTTP: 408/500/502/503/504/404. Never 400/429. 401 is never
 *   retried by the retry loop — it belongs to the authenticator.
 * - Network exceptions retried; timeouts flagged isTimeout.
 * - Exponential backoff: min(500 * 2^attempt, 3000) ms.
 * - 401 → single-flight token refresh with skip-list, loop guard (≥2 gives up)
 *   and guest-token fallback (TokenAuthenticator).
 */

import { SessionStore, PrefKeys } from './storage';
import { deviceInfoHeaderValue, generateUuid, getOrCreateDeviceId } from './device';
import { LabelManager } from './labels';
import { messageForHttpStatus, networkErrorMessage } from './errors';
import type { RefreshTokenResponse } from './types';
import type { AuthMode, TokenProvider, HostToken } from './config';

export type ApiPriority = 'P1' | 'P2' | 'P3';

export const PRIORITY_CONFIG: Record<ApiPriority, { timeoutMs: number; retries: number }> = {
  /** P1 onboarding-fallback — geolocate. 5 s in code (doc-comment says 2 s; SDKs use 5 s). */
  P1: { timeoutMs: 5_000, retries: 1 },
  /** P2 no-fallback (default) — most endpoints. */
  P2: { timeoutMs: 10_000, retries: 2 },
  /** P3 AI runtime — text prompt, plantix, follow-ups, synthesise, transcribe, chat history. */
  P3: { timeoutMs: 30_000, retries: 3 },
};

const RETRYABLE_STATUS = new Set([408, 500, 502, 503, 504, 404]);
const NEVER_RETRY_STATUS = new Set([400, 429]);

/** URLs the authenticator must skip (docs/02 TokenAuthenticator). */
const AUTH_SKIP_SUBSTRINGS = ['generate_otp', 'verify_otp', 'get_new_access_token', 'send_tokens', 'initialize_user'];

export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | {
      ok: false;
      code?: number;
      message: string;
      apiName: string;
      errorBody?: string;
      isTimeout: boolean;
      isNetworkError: boolean;
    };

export function apiSuccess<T>(data: T, status = 200): ApiResult<T> {
  return { ok: true, data, status };
}

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  /** Absolute URL override (Google geolocate). */
  absoluteUrl?: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  priority?: ApiPriority;
  /** Send `API-Key` header (guest init / send_tokens). */
  apiKey?: string;
  /** Do not attach Authorization (external URLs). */
  skipAuthHeader?: boolean;
  apiName?: string;
}

export interface HttpClientDeps {
  baseUrl: string;
  guestApiKey: string;
  store: SessionStore;
  labels: LabelManager;
  onSessionExpired?: () => void;
  /** C2 — auth mode; HOST_TOKEN recovers 401s via `tokenProvider` instead of OTP/refresh. */
  authMode?: AuthMode;
  tokenProvider?: TokenProvider;
}

const backoffDelay = (attempt: number): number => Math.min(500 * 2 ** attempt, 3000);

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class HttpClient {
  /** Single-flight refresh: concurrent 401s share one refresh promise. */
  private refreshInFlight: Promise<boolean> | null = null;

  constructor(private deps: HttpClientDeps) {}

  get accessToken(): string | null {
    return this.deps.store.getString(PrefKeys.ACCESS_TOKEN);
  }

  async request<T>(opts: RequestOptions): Promise<ApiResult<T>> {
    const priority: ApiPriority = opts.priority ?? 'P2';
    const { timeoutMs, retries } = PRIORITY_CONFIG[priority];
    const url = this.buildUrl(opts);
    const apiName = opts.apiName ?? opts.path;

    let lastError: ApiResult<T> | null = null;
    /** 401-refresh attempts for this logical request (loop guard: ≥2 gives up). */
    let authAttempts = 0;
    let attempt = 0;

    while (attempt <= retries) {
      let response: Response;
      try {
        response = await this.doFetch(url, opts, timeoutMs);
      } catch (err) {
        const isTimeout = err instanceof DOMException && err.name === 'AbortError';
        lastError = {
          ok: false,
          message: networkErrorMessage(this.deps.labels, isTimeout),
          apiName,
          isTimeout,
          isNetworkError: true,
        };
        // Network exceptions (≈ IOException) are retried; timeout flagged.
        if (attempt < retries) {
          await sleep(backoffDelay(attempt));
          attempt++;
          continue;
        }
        return lastError;
      }

      if (response.ok) {
        return this.parseSuccess<T>(response);
      }

      const status = response.status;
      const errorBody = await safeText(response);

      if (status === 401) {
        // Never retried by the retry loop — authenticator's job.
        if (!this.isAuthSkipped(url) && authAttempts < 2) {
          authAttempts++;
          const refreshed = await this.authenticate();
          if (refreshed) continue; // replay with new Bearer, same attempt budget
        }
        return {
          ok: false,
          code: 401,
          message: messageForHttpStatus(401, errorBody, this.deps.labels),
          apiName,
          errorBody,
          isTimeout: false,
          isNetworkError: false,
        };
      }

      const result: ApiResult<T> = {
        ok: false,
        code: status,
        message: messageForHttpStatus(status, errorBody, this.deps.labels),
        apiName,
        errorBody,
        isTimeout: status === 408,
        isNetworkError: false,
      };

      if (NEVER_RETRY_STATUS.has(status) || !RETRYABLE_STATUS.has(status)) {
        return result;
      }

      lastError = result;
      if (attempt < retries) {
        await sleep(backoffDelay(attempt));
        attempt++;
        continue;
      }
      return result;
    }

    return (
      lastError ?? {
        ok: false,
        message: networkErrorMessage(this.deps.labels, false),
        apiName,
        isTimeout: false,
        isNetworkError: true,
      }
    );
  }

  // -------------------------------------------------------------------------
  // TokenAuthenticator port
  // -------------------------------------------------------------------------

  /**
   * Single-flight 401 recovery:
   *  Step 1 — POST get_new_access_token with the refresh token; save tokens.
   *  Step 2 — fallback: POST send_tokens (device_id, user_id) with guest API key.
   * Both failing → tokens cleared + onSessionExpired.
   */
  private authenticate(): Promise<boolean> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.doAuthenticate().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  private async doAuthenticate(): Promise<boolean> {
    const { store } = this.deps;

    // C2 HOST_TOKEN: the host owns identity. Ask its tokenProvider for a fresh
    // token on 401; if it can't supply one, fall through to onSessionExpired.
    // We never fall back to SDK OTP/guest grants in HOST_TOKEN mode.
    if (this.deps.authMode === 'HOST_TOKEN') {
      const provided = await this.resolveHostToken();
      if (provided) {
        const access = typeof provided === 'string' ? provided : provided.accessToken;
        const refresh = typeof provided === 'string' ? undefined : provided.refreshToken;
        if (access) {
          store.setString(PrefKeys.ACCESS_TOKEN, access);
          if (refresh) store.setString(PrefKeys.REFRESH_TOKEN, refresh);
          return true;
        }
      }
      store.clearTokens();
      try {
        this.deps.onSessionExpired?.();
      } catch {
        // host callback errors are swallowed
      }
      return false;
    }

    // Step 1: refresh token grant.
    const refreshToken = store.getString(PrefKeys.REFRESH_TOKEN);
    if (refreshToken) {
      const refreshed = await this.tokenCall('api/user/get_new_access_token/', { refresh_token: refreshToken });
      if (refreshed?.access_token) {
        store.setString(PrefKeys.ACCESS_TOKEN, refreshed.access_token);
        if (refreshed.refresh_token) store.setString(PrefKeys.REFRESH_TOKEN, refreshed.refresh_token);
        return true;
      }
    }

    // Step 2: guest-token fallback with the guest API key.
    const userId = store.getString(PrefKeys.USER_ID);
    if (userId) {
      const deviceId = getOrCreateDeviceId(store);
      const fallback = await this.tokenCall(
        'api/user/send_tokens/',
        { device_id: deviceId, user_id: userId },
        this.deps.guestApiKey,
      );
      if (fallback?.access_token) {
        store.setString(PrefKeys.ACCESS_TOKEN, fallback.access_token);
        if (fallback.refresh_token) store.setString(PrefKeys.REFRESH_TOKEN, fallback.refresh_token);
        return true;
      }
    }

    store.clearTokens();
    try {
      this.deps.onSessionExpired?.();
    } catch {
      // host callback errors are swallowed
    }
    return false;
  }

  /** Invoke the host tokenProvider defensively (never throws into the retry loop). */
  private async resolveHostToken(): Promise<HostToken | null> {
    if (!this.deps.tokenProvider) return null;
    try {
      return (await this.deps.tokenProvider()) ?? null;
    } catch {
      return null;
    }
  }

  /** Plain token call — no retry loop, no authenticator (mirrors non-suspend AuthApi). */
  private async tokenCall(path: string, body: unknown, apiKey?: string): Promise<RefreshTokenResponse | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PRIORITY_CONFIG.P2.timeoutMs);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Build-Version': 'v2',
        'Device-Info': deviceInfoHeaderValue(),
        'X-Request-ID': generateUuid(),
      };
      if (apiKey) headers['API-Key'] = apiKey;
      const res = await fetch(this.deps.baseUrl + path, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as RefreshTokenResponse;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private isAuthSkipped(url: string): boolean {
    return AUTH_SKIP_SUBSTRINGS.some((s) => url.includes(s));
  }

  private buildUrl(opts: RequestOptions): string {
    const base = opts.absoluteUrl ?? this.deps.baseUrl + opts.path;
    if (!opts.query) return base;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) params.set(k, String(v));
    }
    const qs = params.toString();
    return qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;
  }

  private async doFetch(url: string, opts: RequestOptions, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {
        'X-Request-ID': generateUuid(),
        'X-Timeout': String(Math.round(timeoutMs / 1000)),
      };
      if (!opts.skipAuthHeader) {
        headers['Build-Version'] = 'v2';
        headers['Device-Info'] = deviceInfoHeaderValue();
        const token = this.accessToken;
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
      if (opts.apiKey !== undefined) headers['API-Key'] = opts.apiKey;

      const init: RequestInit = { method: opts.method, headers, signal: controller.signal };
      if (opts.body !== undefined) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(opts.body);
      }
      return await fetch(url, init);
    } finally {
      clearTimeout(timer);
    }
  }

  private async parseSuccess<T>(response: Response): Promise<ApiResult<T>> {
    // 204 (e.g. daily feed) → null payload; callers map to their empty shape.
    if (response.status === 204) {
      return { ok: true, data: null as unknown as T, status: 204 };
    }
    const text = await safeText(response);
    if (!text) {
      return { ok: true, data: null as unknown as T, status: response.status };
    }
    try {
      return { ok: true, data: JSON.parse(text) as T, status: response.status };
    } catch {
      // Non-JSON success body (rare) — hand back the raw text.
      return { ok: true, data: text as unknown as T, status: response.status };
    }
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
