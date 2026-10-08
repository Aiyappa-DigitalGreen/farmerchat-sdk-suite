/**
 * HttpClient — typed fetch client replicating the app's OkHttp interceptor
 * chain + executeApiCall semantics (docs/02 §Networking behavior):
 *
 *  - Per-request timeout via AbortController per ApiPriority
 *    (P1 5 s / 1 retry, P2 10 s / 2, P3 30 s / 3).
 *  - Headers on every request: X-Request-ID, X-Timeout, Build-Version: v2,
 *    Device-Info (URL-encoded JSON), Authorization: Bearer <access> when present.
 *  - Retryable HTTP: 408/500/502/503/504/404. Never 400/429. 401 never retried
 *    here (authenticator's job).
 *  - Exceptions: retry only network errors; timeouts flagged isTimeout.
 *  - Backoff: min(500 * 2^attempt, 3000) ms.
 *  - 401 single-flight refresh via TokenAuthenticator with skip-list + loop guard.
 */
import { apiError, apiSuccess, type ApiResult } from './apiResult';
import { BUILD_VERSION_HEADER_VALUE, type ResolvedFarmerChatConfig } from './config';
import { getDeviceInfoHeader } from './deviceInfo';
import { extractBackendMessage } from './errorHandler';
import {
  ApiPriorities,
  backoffDelayMs,
  RETRYABLE_HTTP_CODES,
  type ApiPriority,
} from './priorities';
import type { SessionStore } from './sessionStore';
import { isAuthSkippedUrl, TokenAuthenticator } from './tokenAuthenticator';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestSpec {
  method: HttpMethod;
  /** Path relative to base URL, or an absolute http(s) URL. */
  path: string;
  apiName: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  priority?: ApiPriority;
  headers?: Record<string, string>;
  /** Attach Authorization: Bearer when a token exists. Default true. */
  auth?: boolean;
}

const MAX_AUTH_ATTEMPTS = 2; // loop guard: ≥2 prior auth responses → give up

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeRequestId(): string {
  return (
    Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 10)
  );
}

interface AttemptOutcome<T> {
  kind: 'success' | 'http-error' | 'network-error';
  result?: ApiResult<T>;
  status?: number;
  errorBody?: string | null;
  isTimeout?: boolean;
}

export class HttpClient {
  readonly authenticator: TokenAuthenticator;
  private readonly onError: ((code: number, message: string) => void) | null;

  constructor(
    private readonly config: ResolvedFarmerChatConfig,
    private readonly store: SessionStore,
    onSessionExpired: () => void,
    onError?: (code: number, message: string) => void,
    onGuestReplaced?: () => void,
  ) {
    this.authenticator = new TokenAuthenticator(config, store, onSessionExpired, onGuestReplaced);
    this.onError = onError ?? null;
  }

  buildUrl(spec: RequestSpec): string {
    const base = /^https?:\/\//.test(spec.path)
      ? spec.path
      : this.config.baseUrl + spec.path.replace(/^\//, '');
    if (!spec.query) return base;
    const params: string[] = [];
    for (const [key, value] of Object.entries(spec.query)) {
      if (value === null || value === undefined) continue;
      params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
    if (params.length === 0) return base;
    return base + (base.includes('?') ? '&' : '?') + params.join('&');
  }

  async request<T>(spec: RequestSpec): Promise<ApiResult<T>> {
    const priority = spec.priority ?? ApiPriorities.P2_NO_FALLBACK;
    const url = this.buildUrl(spec);
    let authAttempts = 0;
    let attempt = 0;

    // Retry loop: `attempt` counts retries triggered by retryable failures.
    // 401→refresh retries do not consume retry budget (mirrors OkHttp where
    // the authenticator drives its own re-dispatch).
    for (;;) {
      const outcome = await this.executeOnce<T>(spec, url, priority);

      if (outcome.kind === 'success') {
        return outcome.result as ApiResult<T>;
      }

      if (outcome.kind === 'http-error') {
        const status = outcome.status ?? 0;

        // 401 — never retried by executeApiCall; the authenticator's job.
        if (status === 401) {
          if (spec.auth === false || isAuthSkippedUrl(url)) {
            return this.httpErrorResult(spec, status, outcome.errorBody ?? null);
          }
          authAttempts += 1;
          if (authAttempts >= MAX_AUTH_ATTEMPTS) {
            return this.httpErrorResult(spec, status, outcome.errorBody ?? null);
          }
          const newToken = await this.authenticator.authenticate();
          if (newToken === null) {
            return this.httpErrorResult(spec, status, outcome.errorBody ?? null);
          }
          continue; // retry immediately with fresh Bearer
        }

        if (RETRYABLE_HTTP_CODES.has(status) && attempt < priority.maxRetries) {
          await sleep(backoffDelayMs(attempt));
          attempt += 1;
          continue;
        }
        return this.httpErrorResult(spec, status, outcome.errorBody ?? null);
      }

      // network-error — retry only transport failures (IOException equivalent)
      if (attempt < priority.maxRetries) {
        await sleep(backoffDelayMs(attempt));
        attempt += 1;
        continue;
      }
      const message = outcome.isTimeout ? 'Request timed out' : 'Network error';
      // Semantic onError (C4): code 0 signals a transport/timeout failure.
      this.onError?.(0, message);
      return apiError({
        apiName: spec.apiName,
        message,
        isTimeout: outcome.isTimeout ?? false,
        isNetworkError: true,
      });
    }
  }

  private httpErrorResult<T>(
    spec: RequestSpec,
    status: number,
    errorBody: string | null,
  ): ApiResult<T> {
    const message = extractBackendMessage(errorBody);
    // Semantic onError (C4) — final HTTP error surfaced to the caller.
    this.onError?.(status, message ?? `HTTP ${status}`);
    return apiError({
      code: status,
      apiName: spec.apiName,
      errorBody,
      message,
    });
  }

  private async executeOnce<T>(
    spec: RequestSpec,
    url: string,
    priority: ApiPriority,
  ): Promise<AttemptOutcome<T>> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, priority.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'X-Request-ID': makeRequestId(),
        'X-Timeout': String(Math.round(priority.timeoutMs / 1000)),
        'Build-Version': BUILD_VERSION_HEADER_VALUE,
        'Device-Info': getDeviceInfoHeader(),
        ...(spec.headers ?? {}),
      };
      if (spec.body !== undefined) headers['Content-Type'] = 'application/json';
      if (spec.auth !== false) {
        const token = this.store.accessToken;
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: spec.method,
        headers,
        body: spec.body !== undefined ? JSON.stringify(spec.body) : undefined,
        signal: controller.signal,
      });

      if (response.ok) {
        // 204 (e.g. daily feed empty) → null payload
        if (response.status === 204) {
          return { kind: 'success', result: apiSuccess(null as T) };
        }
        const text = await response.text();
        if (text.length === 0) {
          return { kind: 'success', result: apiSuccess(null as T) };
        }
        try {
          return { kind: 'success', result: apiSuccess(JSON.parse(text) as T) };
        } catch {
          return { kind: 'success', result: apiSuccess(text as unknown as T) };
        }
      }

      let errorBody: string | null = null;
      try {
        errorBody = await response.text();
      } catch {
        errorBody = null;
      }
      return { kind: 'http-error', status: response.status, errorBody };
    } catch (e) {
      const isAbort =
        typeof e === 'object' &&
        e !== null &&
        (e as { name?: string }).name === 'AbortError';
      return {
        kind: 'network-error',
        isTimeout: timedOut || isAbort,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
