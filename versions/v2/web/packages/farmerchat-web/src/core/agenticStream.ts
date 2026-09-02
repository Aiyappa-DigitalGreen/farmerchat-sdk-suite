/**
 * Browser transport for the agentic stream (#27a) — the web counterpart of Android's
 * `AgenticChatDataSource`. Framing/parsing lives in `./agentic`; this file only turns a
 * `Response` body into an async iterable of {@link AgenticEvent}.
 *
 * VERIFIED transport facts (confirmed live on dev/stage/prod 2026-09-02):
 * - The request must send `Accept: application/json`. The backend **406s**
 *   `Accept: text/event-stream` — which is exactly why `EventSource` is unusable here:
 *   it cannot set headers, cannot POST, and forces that Accept value.
 * - The response is `Content-Type: text/event-stream`, `Transfer-Encoding: chunked`.
 * - No request timeout may cut a long stream (agentic answers stream for a long time), so
 *   `HttpClient.openStream` deliberately skips the ApiPriority timeout/retry table. Cancellation
 *   is the host's job via `AbortController` — leaving the chat aborts the request.
 *
 * Bytes → text is decoded incrementally with a single `TextDecoder` and
 * `decode(value, { stream: true })`, so a multi-byte UTF-8 character split across two reads is
 * reassembled rather than turned into U+FFFD (matters for every Indic-script answer).
 */

import { AgenticStreamDecoder } from './agentic';
import type { AgenticEvent, StreamErrorKind } from './agentic';

/** True when an error (or the signal) means "the caller cancelled", not "the stream failed". */
export function isAbortError(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (typeof DOMException !== 'undefined' && err instanceof DOMException) return err.name === 'AbortError';
  return !!err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError';
}

function failure(message: string | null, kind: StreamErrorKind): AgenticEvent {
  return { type: 'failure', message, kind };
}

/** Human-readable message from an unknown thrown value. */
export function thrownMessage(err: unknown): string | null {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return null;
}

/**
 * Reads an open agentic response as a sequence of events.
 *
 * Behaviour mirrors `AgenticChatDataSource.stream`:
 * - non-2xx → a single `SERVER` failure (fetch does not throw on HTTP errors, unlike okhttp's
 *   `isSuccessful` check this replaces);
 * - missing body → a single `SERVER` failure;
 * - a throw mid-read → `NETWORK` failure, EXCEPT when it is an abort, which yields nothing at all
 *   (Android rethrows `CancellationException` for the same reason: a cancelled stream must never
 *   leave an error card behind);
 * - a `metadata` event is terminal — the loop stops and the body reader is cancelled, so the
 *   request does not stay open.
 */
export async function* readAgenticStream(response: Response, signal?: AbortSignal): AsyncGenerator<AgenticEvent> {
  if (!response.ok) {
    yield failure(`HTTP ${response.status}`, 'SERVER');
    return;
  }
  const body = response.body;
  if (!body) {
    yield failure('Empty agentic response body', 'SERVER');
    return;
  }

  const reader = body.getReader();
  const textDecoder = new TextDecoder();
  const framing = new AgenticStreamDecoder();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // `{ stream: true }` belongs on decode(), not on the constructor: it is what keeps a
      // partial multi-byte sequence buffered until the next chunk arrives.
      const text = value ? textDecoder.decode(value, { stream: true }) : '';
      if (text.length === 0) continue;
      for (const event of framing.feed(text)) {
        yield event;
        if (event.type === 'metadata') return; // terminal — finally{} cancels the reader
      }
    }
    // EOF: flush the decoder's byte tail, then any event not closed by a trailing blank line.
    const tail = textDecoder.decode();
    const pending = tail.length > 0 ? framing.feed(tail).concat(framing.flush()) : framing.flush();
    for (const event of pending) {
      yield event;
      if (event.type === 'metadata') return;
    }
  } catch (err) {
    if (isAbortError(err, signal)) return;
    yield failure(thrownMessage(err), 'NETWORK');
  } finally {
    try {
      await reader.cancel();
    } catch {
      // already closed / already cancelled — nothing to recover
    }
  }
}
