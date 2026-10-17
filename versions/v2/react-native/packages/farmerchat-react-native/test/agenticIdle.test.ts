/**
 * Agentic stream idle read timeout (app NetworkModule.kt:32, readTimeout 60 s). Scenario pass
 * 2026-10-17: a DEMO stream that went silent left "Getting your answer…" up for 17 minutes.
 *
 *     node --import ./test/ts-extension-hook.mjs --import ./test/native-stubs-hook.mjs test/agenticIdle.test.ts
 */
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { AGENTIC_STREAM_IDLE_TIMEOUT_MS, AgenticChatDataSource } from '../src/core/agenticStream.ts';

class SilentXhr {
  readyState = 1;
  status = 0;
  responseText = '';
  responseType = '';
  timeout = 0;
  onreadystatechange: (() => void) | null = null;
  onprogress: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  static last: SilentXhr | null = null;
  constructor() {
    SilentXhr.last = this;
  }
  open(): void {}
  setRequestHeader(): void {}
  send(): void {}
  abort(): void {}
  /** Headers arrived, then nothing more. */
  headers(): void {
    this.readyState = 2;
    this.status = 200;
    this.onreadystatechange?.();
  }
  bytes(text: string): void {
    this.readyState = 3;
    this.responseText += text;
    this.onprogress?.();
  }
}

function source(): AgenticChatDataSource {
  const config = { baseUrl: 'https://example.invalid/', debugLogging: false } as never;
  const store = { accessToken: null } as never;
  const auth = { authenticate: async () => null } as never;
  return new AgenticChatDataSource(config, store, auth);
}

const req = { query: 'q', conversation_id: 'c', message_id: '', weather_cta_triggered: false, triggered_input_type: 'text', use_entity_extraction: true, retry: false };

test('a stream silent for 60 s ends with a NETWORK failure; bytes reset the clock', async () => {
  assert.equal(AGENTIC_STREAM_IDLE_TIMEOUT_MS, 60_000);
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = SilentXhr;
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const it = source().stream(req as never)[Symbol.asyncIterator]();
    const first = it.next();
    await Promise.resolve();
    SilentXhr.last!.headers();
    mock.timers.tick(59_000);
    SilentXhr.last!.bytes(': keep-alive\n');
    mock.timers.tick(59_000); // 118 s total, but only 59 s since the last bytes
    let settled = false;
    void first.then(() => { settled = true; });
    await new Promise((r) => setImmediate(r));
    assert.equal(settled, false, 'still streaming');
    mock.timers.tick(1_000);
    const ev = await first;
    assert.equal(ev.done, false);
    assert.deepEqual({ type: ev.value?.type, kind: (ev.value as { kind?: string }).kind }, { type: 'failure', kind: 'NETWORK' });
    assert.equal((await it.next()).done, true);
  } finally {
    mock.timers.reset();
    delete (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
  }
});
