/**
 * ApiPriority — per-request timeout/retry classes.
 * docs/02-api-reference.md §ApiPriority:
 *   P1 onboarding-fallback : 5 s timeout, 1 retry (geolocate)
 *   P2 no-fallback (default): 10 s timeout, 2 retries (most endpoints)
 *   P3 AI runtime          : 30 s timeout, 3 retries (text prompt, plantix,
 *                            follow-ups, synthesise, transcribe, chat history)
 */

export interface ApiPriority {
  readonly name: 'P1' | 'P2' | 'P3';
  readonly timeoutMs: number;
  readonly maxRetries: number;
}

export const ApiPriorities = {
  /** Onboarding fallback (Google geolocate). 5 s in code (doc comment said 2 s — SDKs use 5 s). */
  P1_ONBOARDING_FALLBACK: { name: 'P1', timeoutMs: 5_000, maxRetries: 1 } as ApiPriority,
  /** Default for most endpoints. */
  P2_NO_FALLBACK: { name: 'P2', timeoutMs: 10_000, maxRetries: 2 } as ApiPriority,
  /** AI runtime endpoints. */
  P3_AI_RUNTIME: { name: 'P3', timeoutMs: 30_000, maxRetries: 3 } as ApiPriority,
} as const;

/** HTTP codes that are retried. 400/429 are never retried; 401 is the authenticator's job. */
export const RETRYABLE_HTTP_CODES: ReadonlySet<number> = new Set([
  408, 500, 502, 503, 504, 404,
]);

export const NON_RETRYABLE_HTTP_CODES: ReadonlySet<number> = new Set([400, 429]);

/** Exponential backoff: min(500 * 2^attempt, 3000) ms. */
export function backoffDelayMs(attempt: number): number {
  return Math.min(500 * Math.pow(2, attempt), 3_000);
}
