/**
 * AgenticChatDataSource — streams endpoint #27a
 * (`api/chat/get_answer_for_text_query_agentic/`) as an async iterable of {@link AgenticEvent}.
 * **SDK 2.0.0 only** — 1.0.0 keeps the synchronous #27 path.
 *
 * Port of the Android core's `core/remote/AgenticChatDataSource.kt` (fc-compose-agentic @
 * c0524dd6). The framing/parsing lives in `agenticModels.ts`; this file is transport only.
 *
 * ## Transport, verified live 2026-09-02 on dev / stage / prod
 * - The response is `Content-Type: text/event-stream`, `Transfer-Encoding: chunked`.
 * - The request must send `Accept: application/json`. The backend **406s**
 *   `Accept: text/event-stream`.
 * - There must be **no read timeout** — agentic answers stream for minutes — so this never goes
 *   through {@link HttpClient}/ApiPriority, whose per-request `AbortController` deadline (P1 5 s /
 *   P2 10 s / P3 30 s) would cut the stream short. Auth headers and the 401 refresh still apply:
 *   the same `Build-Version` / `Device-Info` / `Authorization` set as
 *   `AuthHeaderInterceptor`, and one 401 → `TokenAuthenticator.authenticate()` → replay.
 * - Header parity with the Android `agenticClient`, which deliberately omits the priority
 *   interceptors: **no `X-Request-ID` and no `X-Timeout`** are sent. Deriving an `X-Timeout`
 *   would state a deadline this request explicitly does not have.
 *
 * ## Why XMLHttpRequest and not fetch
 * React Native's `fetch` is polyfilled over the same native networking module and does **not**
 * expose a readable `response.body` stream (`ReadableStream` is absent from the RN runtime), so
 * `await fetch(...)` resolves only once the whole response has been buffered — no incremental
 * text. RN's `XMLHttpRequest`, in contrast, turns on native incremental delivery whenever an
 * `onprogress` or `onreadystatechange` handler is attached at `send()` time
 * (`Libraries/Network/XMLHttpRequest.js`: `incrementalEvents`), and then grows
 * `xhr.responseText` while `readyState === 3`. This reader therefore keeps a cursor into
 * `responseText`, slices only what is new, and holds back the tail after the last `\n` until more
 * arrives so a half-received line is never parsed.
 *
 * ### Known limitations of this approach (honest list)
 * - Requires `responseType = 'text'`; binary/blob streaming is not supported (not needed).
 * - `xhr.responseText` accumulates the ENTIRE response in memory for the life of the request.
 *   Fine for an answer; it is not a general-purpose large-payload streamer.
 * - Any host-side network interposer that buffers responses (Flipper's network plugin on
 *   Android, some proxies/`XMLHttpRequest` monkey-patches, Charles with buffering on) will
 *   deliver the body in one shot. The reader still produces correct events — it just stops being
 *   incremental, so the answer appears at the end instead of typing in.
 * - On React Native Web the browser XHR is used; incremental `responseText` is supported there,
 *   but a CORS-restricted or gzip-buffering intermediary can again collapse it to one chunk.
 * - Multi-byte UTF-8 characters split across native chunks are handled by RN's own progressive
 *   decoder, not here.
 * - Progress events cannot be awaited, so the 700 ms tool-status dwell is NOT implemented in the
 *   transport: events are pushed into a queue and the consumer pulls them, which is what gives
 *   the consumer real backpressure (see `useChat`).
 */
import type { ResolvedFarmerChatConfig } from './config';
import { BUILD_VERSION_HEADER_VALUE } from './config';
import { getDeviceInfoHeader } from './deviceInfo';
import {
  AgenticEventFramer,
  StreamErrorKinds,
  type AgenticEvent,
  type StreamErrorKind,
} from './agenticModels';
import type { SessionStore } from './sessionStore';
import type { TokenAuthenticator } from './tokenAuthenticator';
import type { TextPromptRequest } from './types';

/** #27a — agentic streaming answer. Returns `text/event-stream`. */
export const AGENTIC_TEXT_QUERY_PATH = 'api/chat/get_answer_for_text_query_agentic/';

/** Loop guard: at most one 401 → refresh → replay per stream (Android's authenticator does 1). */
const MAX_AUTH_ATTEMPTS = 1;

// ---------------------------------------------------------------------------
// Minimal structural XHR typing
// ---------------------------------------------------------------------------

/**
 * Only the members this reader touches. Declared locally rather than relying on an ambient DOM /
 * React Native global type, so `core/` stays importable from any TS target and a runtime without
 * XHR degrades gracefully instead of failing to compile.
 */
interface XhrLike {
  readyState: number;
  status: number;
  responseText: string;
  responseType: string;
  timeout: number;
  onreadystatechange: (() => void) | null;
  onprogress: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  ontimeout: (() => void) | null;
  open(method: string, url: string, async?: boolean): void;
  setRequestHeader(name: string, value: string): void;
  send(body?: string): void;
  abort(): void;
}

type XhrCtor = new () => XhrLike;

function resolveXhrCtor(): XhrCtor | null {
  const ctor = (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
  return typeof ctor === 'function' ? (ctor as XhrCtor) : null;
}

// ---------------------------------------------------------------------------
// Single-consumer async queue
// ---------------------------------------------------------------------------

/**
 * Bridges push-style XHR callbacks to a pull-style async iterator. Single consumer only.
 * Pulling is what lets the consumer hold the stream while it awaits (the 700 ms tool dwell)
 * without dropping events, which a plain callback fan-out cannot do.
 */
class AsyncEventQueue<T> {
  private readonly items: T[] = [];
  private waiter: ((r: IteratorResult<T>) => void) | null = null;
  private closed = false;

  push(value: T): void {
    if (this.closed) return;
    const waiter = this.waiter;
    if (waiter) {
      this.waiter = null;
      waiter({ value, done: false });
      return;
    }
    this.items.push(value);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    const waiter = this.waiter;
    if (waiter) {
      this.waiter = null;
      waiter({ value: undefined as never, done: true });
    }
  }

  next(): Promise<IteratorResult<T>> {
    if (this.items.length > 0) {
      return Promise.resolve({ value: this.items.shift() as T, done: false });
    }
    if (this.closed) {
      return Promise.resolve({ value: undefined as never, done: true });
    }
    return new Promise((resolve) => {
      this.waiter = resolve;
    });
  }
}

interface StreamAttempt {
  queue: AsyncEventQueue<AgenticEvent>;
  /** True when the attempt stopped on a 401 that the caller may retry after a refresh. */
  isUnauthorized(): boolean;
  abort(): void;
}

// ---------------------------------------------------------------------------
// Data source
// ---------------------------------------------------------------------------

export class AgenticChatDataSource {
  constructor(
    private readonly config: ResolvedFarmerChatConfig,
    private readonly store: SessionStore,
    private readonly authenticator: TokenAuthenticator,
  ) {}

  /**
   * Streams one agentic answer. The iterator ends after the terminal `metadata` event, at clean
   * EOF, or after a single `failure` event — never both a failure and more content.
   *
   * Breaking out of the `for await` (screen left, component unmounted) aborts the request via the
   * generator's `finally`, exactly like the Android `awaitClose { call.cancel() }`.
   */
  async *stream(request: TextPromptRequest): AsyncGenerator<AgenticEvent, void, void> {
    const ctor = resolveXhrCtor();
    if (!ctor) {
      // Degrade gracefully (react-native/CLAUDE.md): warn, emit one failure, never throw.
      console.warn(
        '[FarmerChat] Agentic chat needs XMLHttpRequest, which this runtime does not provide. ' +
          'Falling back is the host\'s call: set enableAgenticChat: false to use the ' +
          'synchronous #27 endpoint.',
      );
      yield {
        type: 'failure',
        message: 'XMLHttpRequest unavailable',
        kind: StreamErrorKinds.UNKNOWN,
      };
      return;
    }

    const url = this.config.baseUrl + AGENTIC_TEXT_QUERY_PATH;
    let authAttempts = 0;
    let attempt: StreamAttempt | null = null;

    try {
      for (;;) {
        const canRefresh = authAttempts < MAX_AUTH_ATTEMPTS;
        attempt = this.openAttempt(ctor, url, request, canRefresh);

        for (;;) {
          const next = await attempt.queue.next();
          if (next.done) break;
          yield next.value;
        }

        if (!attempt.isUnauthorized()) return;

        // 401 with nothing emitted: refresh once (single-flight, shared with HttpClient) and
        // replay the whole stream. Mirrors OkHttp's authenticator re-dispatch.
        authAttempts += 1;
        const token = await this.authenticator.authenticate();
        if (!token) {
          yield {
            type: 'failure',
            message: 'HTTP 401',
            kind: StreamErrorKinds.SERVER,
          };
          return;
        }
      }
    } finally {
      attempt?.abort();
    }
  }

  private openAttempt(
    Xhr: XhrCtor,
    url: string,
    request: TextPromptRequest,
    canRefreshAuth: boolean,
  ): StreamAttempt {
    const queue = new AsyncEventQueue<AgenticEvent>();
    const framer = new AgenticEventFramer();
    const xhr = new Xhr();

    let unauthorized = false;
    let terminated = false;
    let headersChecked = false;
    let sawFailure = false;
    /** How much of `responseText` has already been consumed. */
    let cursor = 0;
    /** Text after the last newline — a possibly half-arrived line. Never parsed until complete. */
    let pending = '';

    const finish = (): void => {
      if (terminated) return;
      terminated = true;
      queue.close();
      try {
        xhr.abort();
      } catch {
        // already finished
      }
    };

    const emit = (event: AgenticEvent | null): void => {
      if (event === null || terminated) return;
      queue.push(event);
      if (event.type === 'failure') sawFailure = true;
      // `metadata` is the terminal event — stop reading, exactly like the Android dispatch()
      // returning true. A `done` is NOT terminal: a richer `metadata` may still follow.
      if (event.type === 'metadata') finish();
    };

    const pump = (): void => {
      if (terminated) return;
      let text: string;
      try {
        text = xhr.responseText ?? '';
      } catch {
        // responseText is unavailable before LOADING on some engines.
        return;
      }
      // Progress can fire with no newly decodable text.
      if (text.length <= cursor) return;
      pending += text.slice(cursor);
      cursor = text.length;

      for (;;) {
        const nl = pending.indexOf('\n');
        if (nl < 0) break;
        const line = pending.slice(0, nl);
        pending = pending.slice(nl + 1);
        emit(framer.pushLine(line));
        if (terminated) return;
      }
    };

    const failAndFinish = (message: string, kind: StreamErrorKind): void => {
      if (terminated) return;
      queue.push({ type: 'failure', message, kind });
      sawFailure = true;
      finish();
    };

    xhr.onreadystatechange = (): void => {
      if (terminated) return;
      switch (xhr.readyState) {
        case 2: {
          // HEADERS_RECEIVED — the status is known before any body is read, so a non-2xx is
          // rejected here rather than being parsed as a stream (Android's `!isSuccessful`).
          if (headersChecked) return;
          headersChecked = true;
          const status = xhr.status;
          if (status === 401 && canRefreshAuth) {
            unauthorized = true;
            finish();
            return;
          }
          if (status !== 0 && (status < 200 || status >= 300)) {
            failAndFinish(`HTTP ${status}`, StreamErrorKinds.SERVER);
          }
          return;
        }
        case 3:
          pump();
          return;
        case 4: {
          pump();
          if (terminated) return;
          // Flush a final line with no trailing newline, then a final event with no trailing
          // blank line.
          if (pending.length > 0) {
            const tail = pending;
            pending = '';
            emit(framer.pushLine(tail));
          }
          if (!terminated) emit(framer.flush());
          if (!terminated) {
            // status 0 at DONE means the transport failed without an HTTP response.
            if (xhr.status === 0 && !sawFailure) {
              queue.push({
                type: 'failure',
                message: 'Connection closed',
                kind: StreamErrorKinds.NETWORK,
              });
            }
            finish();
          }
          return;
        }
        default:
          return;
      }
    };

    // Attaching onprogress (and onreadystatechange above) is what switches RN's native
    // networking into incremental mode; without it the body arrives in a single chunk.
    xhr.onprogress = (): void => {
      pump();
    };

    xhr.onerror = (): void => {
      failAndFinish('Network error', StreamErrorKinds.NETWORK);
    };

    xhr.ontimeout = (): void => {
      // Should be unreachable: timeout is 0. Kept so a host-patched XHR cannot hang the queue.
      failAndFinish('Request timed out', StreamErrorKinds.NETWORK);
    };

    xhr.onabort = (): void => {
      // Aborts are ours (terminal event, or the consumer left). Close quietly — never write a
      // stale error card, mirroring the Android CancellationException path.
      if (!terminated) {
        terminated = true;
        queue.close();
      }
    };

    try {
      xhr.open('POST', url, true);
      // Required for incremental `responseText` on both platforms.
      xhr.responseType = 'text';
      // 0 = no timeout. RN's `timeout` is a whole-request deadline, so any nonzero value would
      // kill a multi-minute agentic answer.
      xhr.timeout = 0;
      // Headers must be set after open().
      xhr.setRequestHeader('Content-Type', 'application/json');
      // Must NOT be text/event-stream — the server 406s that. application/json passes
      // negotiation; the streaming view sets its own response Content-Type regardless.
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('Build-Version', BUILD_VERSION_HEADER_VALUE);
      xhr.setRequestHeader('Device-Info', getDeviceInfoHeader());
      const token = this.store.accessToken;
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(JSON.stringify(request));
    } catch (e) {
      failAndFinish(
        e instanceof Error ? e.message : 'Failed to start agentic stream',
        StreamErrorKinds.UNKNOWN,
      );
    }

    return {
      queue,
      isUnauthorized: () => unauthorized,
      abort: finish,
    };
  }
}
