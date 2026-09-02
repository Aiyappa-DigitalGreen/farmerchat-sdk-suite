/**
 * Byte-level tests for `readAgenticStream` — the web-only half of the agentic transport that
 * Android does not have (okio hands it whole lines; `fetch` hands it arbitrary byte slices).
 *
 * Covers the two independent chunk-boundary mechanisms:
 *  1. `TextDecoder.decode(value, { stream: true })` — a multi-byte UTF-8 character split across
 *     two reads must be reassembled, not turned into U+FFFD (every Indic-script answer depends
 *     on this);
 *  2. the line buffer in `AgenticStreamDecoder` — a JSON object split across two reads must be
 *     parsed once, correctly.
 *
 * RUNNER: none (see `agentic.test.ts`). Run with:
 *
 *     npm test    # or: node --import ./test/ts-extension-hook.mjs test/agenticStream.test.ts
 */

import { readAgenticStream } from '../src/core/agenticStream.ts';
import type { AgenticEvent } from '../src/core/agentic.ts';

let passed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) passed++;
  else failures.push(`${name}\n    expected: ${b}\n    actual:   ${a}`);
}

/** A 200 `text/event-stream` response whose body yields exactly these byte chunks. */
function streamingResponse(chunks: Uint8Array[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

async function collect(response: Response, signal?: AbortSignal): Promise<AgenticEvent[]> {
  const out: AgenticEvent[] = [];
  for await (const event of readAgenticStream(response, signal)) out.push(event);
  return out;
}

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

async function main(): Promise<void> {
  // --- happy path ----------------------------------------------------------
  check(
    'a whole SSE stream in one chunk',
    await collect(
      streamingResponse([
        encode(
          'event: tool_call\ndata: {"name":"weather","status_text":"Checking weather"}\n\n' +
            'event: text_delta\ndata: {"delta":"It will rain."}\n\n' +
            'event: metadata\ndata: {"error":false,"response":"It will rain.","message_id":"m1"}\n\n',
        ),
      ]),
    ),
    [
      { type: 'tool_call', name: 'weather', statusText: 'Checking weather' },
      { type: 'text_delta', delta: 'It will rain.' },
      { type: 'metadata', response: { error: false, response: 'It will rain.', message_id: 'm1' } },
    ],
  );

  // --- 1. JSON object split across two byte chunks -------------------------
  check(
    'a JSON object split across two chunks is parsed correctly',
    await collect(
      streamingResponse([encode('data: {"type":"text_delta","del'), encode('ta":"split"}\n\n')]),
    ),
    [{ type: 'text_delta', delta: 'split' }],
  );

  // --- 2. multi-byte UTF-8 character split across two byte chunks ----------
  const devanagari = encode('data: {"type":"text_delta","delta":"नमस्ते"}\n\n');
  // Cut inside a 3-byte Devanagari sequence: a per-chunk `new TextDecoder().decode()` (or a
  // decode() without { stream: true }) yields U+FFFD here and corrupts the answer.
  const cut = 40;
  check(
    'a multi-byte character split across two chunks survives',
    await collect(streamingResponse([devanagari.slice(0, cut), devanagari.slice(cut)])),
    [{ type: 'text_delta', delta: 'नमस्ते' }],
  );

  check(
    'one byte per chunk still yields the same events',
    await collect(
      streamingResponse(
        Array.from(encode('data: {"type":"done","answer":"drip"}\n\n')).map((b) => new Uint8Array([b])),
      ),
    ),
    [{ type: 'done', answer: 'drip', followUps: [] }],
  );

  // --- terminal / EOF behaviour -------------------------------------------
  check(
    'a stream that ends without a blank line still flushes its last event',
    await collect(streamingResponse([encode('data: {"type":"done","answer":"A"}')])),
    [{ type: 'done', answer: 'A', followUps: [] }],
  );
  check(
    'nothing is emitted after the terminal metadata event',
    await collect(
      streamingResponse([
        encode('data: {"type":"metadata","response":"R"}\n\ndata: {"type":"text_delta","delta":"late"}\n\n'),
      ]),
    ),
    [{ type: 'metadata', response: { type: 'metadata', response: 'R' } }],
  );
  check('an empty body yields no events', await collect(streamingResponse([])), []);

  // --- failure mapping ----------------------------------------------------
  check(
    'non-2xx becomes a SERVER failure (fetch does not throw on HTTP errors)',
    await collect(new Response('nope', { status: 500 })),
    [{ type: 'failure', message: 'HTTP 500', kind: 'SERVER' }],
  );
  check(
    'a 406 (what the backend answers for Accept: text/event-stream) is a SERVER failure',
    await collect(new Response('', { status: 406 })),
    [{ type: 'failure', message: 'HTTP 406', kind: 'SERVER' }],
  );
  check('a missing body is a SERVER failure', await collect(new Response(null, { status: 200 })), [
    { type: 'failure', message: 'Empty agentic response body', kind: 'SERVER' },
  ]);
  check(
    'a mid-stream throw is a NETWORK failure',
    await collect(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encode('data: {"type":"text_delta","delta":"a"}\n\n'));
          },
          pull() {
            throw new Error('socket closed');
          },
        }),
        { status: 200 },
      ),
    ),
    [
      { type: 'text_delta', delta: 'a' },
      { type: 'failure', message: 'socket closed', kind: 'NETWORK' },
    ],
  );

  // --- cancellation --------------------------------------------------------
  const controller = new AbortController();
  controller.abort();
  check(
    'an aborted read yields NO events at all (the consumer then finalizes nothing)',
    await collect(
      new Response(
        new ReadableStream<Uint8Array>({
          pull() {
            throw new Error('aborted');
          },
        }),
        { status: 200 },
      ),
      controller.signal,
    ),
    [],
  );

  if (failures.length > 0) {
    console.log(`\n${passed} passed, ${failures.length} FAILED\n`);
    for (const failure of failures) console.log(`  ✗ ${failure}`);
    throw new Error(`${failures.length} agentic stream test(s) failed`);
  }
  console.log(`agenticStream: ${passed} assertions passed`);
}

await main();
