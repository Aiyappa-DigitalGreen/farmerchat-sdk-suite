/**
 * Unit tests for the agentic (#27a) wire parser, the framing decoder and the streamed-text
 * sanitizer — the pieces that cannot be verified against a live stream yet (docs/05), so they are
 * pinned here instead.
 *
 * RUNNER: none. This package has no test framework (devDependencies: typescript, vite, React
 * types) and adding one was out of scope, so these tests run on Node's native TypeScript support
 * with a hand-rolled `check`:
 *
 *     npm test    # or: node --import ./test/ts-extension-hook.mjs test/agentic.test.ts
 *
 * It prints one line per run and throws (non-zero exit) if any assertion failed.
 * It imports nothing but the modules under test — no node: builtins — so `tsconfig.test.json`
 * typechecks it with the package's own `types: []` setting.
 */

import {
  AgenticStreamDecoder,
  parseAgenticEvent,
  sanitizeAgenticFinalText,
  sanitizeAgenticStreamText,
} from '../src/core/agentic.ts';
import type { AgenticEvent } from '../src/core/agentic.ts';
import {
  alignmentAnalyticsType,
  alignmentKindFromType,
  isAdditiveAlignment,
} from '../src/core/alignment.ts';

let passed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) {
    passed++;
  } else {
    failures.push(`${name}\n    expected: ${b}\n    actual:   ${a}`);
  }
}

/** Feeds chunks in order and returns every event emitted, including the EOF flush. */
function drain(decoder: AgenticStreamDecoder, chunks: string[]): AgenticEvent[] {
  const events: AgenticEvent[] = [];
  for (const chunk of chunks) events.push(...decoder.feed(chunk));
  events.push(...decoder.flush());
  return events;
}

// ---------------------------------------------------------------------------
// parseAgenticEvent — type resolution
// ---------------------------------------------------------------------------

check(
  'SSE event: line drives the type',
  parseAgenticEvent('text_delta', '{"delta":"hello"}'),
  { type: 'text_delta', delta: 'hello' },
);
check(
  'type is case/separator-insensitive (TOOL_CALL)',
  parseAgenticEvent('TOOL_CALL', '{"name":"weather","status_text":"Checking weather"}'),
  { type: 'tool_call', name: 'weather', statusText: 'Checking weather' },
);
check(
  'type is case/separator-insensitive (toolCall)',
  parseAgenticEvent('toolCall', '{"name":"w","statusText":"S"}'),
  { type: 'tool_call', name: 'w', statusText: 'S' },
);
check(
  'type read from the JSON body when no event: line came',
  parseAgenticEvent(null, '{"type":"tool_result","name":"w","status":"Done"}'),
  { type: 'tool_result', name: 'w', statusText: 'Done' },
);
check(
  'an `event` field in the body also works as the discriminator',
  parseAgenticEvent(null, '{"event":"text_delta","chunk":"x"}'),
  { type: 'text_delta', delta: 'x' },
);
check('blank payload → null', parseAgenticEvent('text_delta', '   '), null);
check('non-JSON payload → null', parseAgenticEvent('text_delta', 'not json'), null);
check('empty delta → null (nothing to append)', parseAgenticEvent('text_delta', '{"delta":""}'), null);

// ---------------------------------------------------------------------------
// parseAgenticEvent — payload field aliases
// ---------------------------------------------------------------------------

for (const key of ['delta', 'text', 'content', 'token', 'chunk']) {
  check(`text_delta alias "${key}"`, parseAgenticEvent('text_delta', `{"${key}":"D"}`), {
    type: 'text_delta',
    delta: 'D',
  });
}
for (const key of ['status_text', 'statusText', 'status', 'label']) {
  check(`tool_call alias "${key}"`, parseAgenticEvent('tool_call', `{"${key}":"S"}`), {
    type: 'tool_call',
    name: null,
    statusText: 'S',
  });
}
for (const key of ['answer', 'response', 'text', 'final_answer']) {
  check(`done alias "${key}"`, parseAgenticEvent('done', `{"${key}":"A"}`), {
    type: 'done',
    answer: 'A',
    followUps: [],
  });
}
for (const key of ['followups', 'follow_ups', 'followUps', 'follow_up_questions']) {
  check(`done follow-up alias "${key}"`, parseAgenticEvent('done', `{"answer":"A","${key}":["q1","q2"]}`), {
    type: 'done',
    answer: 'A',
    followUps: ['q1', 'q2'],
  });
}
check(
  'done follow-ups also accept the #27 object shape',
  parseAgenticEvent('done', '{"answer":"A","followups":[{"question":"q1","sequence":1}]}'),
  { type: 'done', answer: 'A', followUps: ['q1'] },
);

// ---------------------------------------------------------------------------
// parseAgenticEvent — metadata and the typeless-payload recovery
// ---------------------------------------------------------------------------

check(
  'metadata carries the whole TextPromptResponse through',
  parseAgenticEvent('metadata', '{"error":false,"response":"Full answer","message_id":"m1"}'),
  { type: 'metadata', response: { error: false, response: 'Full answer', message_id: 'm1' } },
);
check(
  'typeless payload with answer text is recovered as metadata',
  parseAgenticEvent(null, '{"response":"Recovered","message_id":"m2"}'),
  { type: 'metadata', response: { response: 'Recovered', message_id: 'm2' } },
);
check(
  'typeless payload with only follow-ups is recovered as metadata',
  parseAgenticEvent(null, '{"follow_up_questions":[{"question":"q"}]}'),
  { type: 'metadata', response: { follow_up_questions: [{ question: 'q' }] } },
);
check(
  'typeless payload with only a chunk is recovered as a delta',
  parseAgenticEvent(null, '{"content":"tick"}'),
  { type: 'text_delta', delta: 'tick' },
);
check('typeless payload carrying nothing usable → null', parseAgenticEvent(null, '{"section":"header"}'), null);
check(
  'an EXCLUSIVE alignment surface keeps its empty response (never dropped)',
  parseAgenticEvent(
    'metadata',
    '{"error":false,"response":"","alignments":{"type":"alignment-clarify","message":"Which crop?"}}',
  ),
  {
    type: 'metadata',
    response: { error: false, response: '', alignments: { type: 'alignment-clarify', message: 'Which crop?' } },
  },
);

// ---------------------------------------------------------------------------
// AgenticStreamDecoder — framing
// ---------------------------------------------------------------------------

check(
  'SSE framing: event: + data: + blank line',
  drain(new AgenticStreamDecoder(), ['event: text_delta\ndata: {"delta":"a"}\n\n']),
  [{ type: 'text_delta', delta: 'a' }],
);
check(
  'SSE framing with CRLF line endings',
  drain(new AgenticStreamDecoder(), ['event: text_delta\r\ndata: {"delta":"a"}\r\n\r\n']),
  [{ type: 'text_delta', delta: 'a' }],
);
check(
  'SSE comments / keep-alives are ignored',
  drain(new AgenticStreamDecoder(), [': keep-alive\n\ndata: {"type":"text_delta","delta":"a"}\n\n']),
  [{ type: 'text_delta', delta: 'a' }],
);
check(
  'bare NDJSON objects dispatch one per line',
  drain(new AgenticStreamDecoder(), [
    '{"type":"text_delta","delta":"a"}\n{"type":"text_delta","delta":"b"}\n',
  ]),
  [
    { type: 'text_delta', delta: 'a' },
    { type: 'text_delta', delta: 'b' },
  ],
);
check(
  'a final event with no trailing blank line is flushed at EOF',
  drain(new AgenticStreamDecoder(), ['data: {"type":"done","answer":"A"}']),
  [{ type: 'done', answer: 'A', followUps: [] }],
);
check(
  'multiple data: lines in one event join with a newline',
  drain(new AgenticStreamDecoder(), ['data: {"type":"text_delta",\ndata: "delta":"a"}\n\n']),
  [{ type: 'text_delta', delta: 'a' }],
);
check(
  'metadata is terminal: nothing after it is emitted',
  drain(new AgenticStreamDecoder(), [
    'data: {"type":"metadata","response":"R"}\n\ndata: {"type":"text_delta","delta":"late"}\n\n',
  ]),
  [{ type: 'metadata', response: { type: 'metadata', response: 'R' } }],
);
check(
  'a full ordered stream parses end to end',
  drain(new AgenticStreamDecoder(), [
    'event: tool_call\ndata: {"name":"weather","status_text":"Checking weather"}\n\n',
    'event: text_delta\ndata: {"delta":"It "}\n\n',
    'event: text_delta\ndata: {"delta":"will rain."}\n\n',
    'event: done\ndata: {"answer":"It will rain.","followups":["When?"]}\n\n',
    'event: metadata\ndata: {"error":false,"response":"It will rain.","message_id":"m9"}\n\n',
  ]),
  [
    { type: 'tool_call', name: 'weather', statusText: 'Checking weather' },
    { type: 'text_delta', delta: 'It ' },
    { type: 'text_delta', delta: 'will rain.' },
    { type: 'done', answer: 'It will rain.', followUps: ['When?'] },
    { type: 'metadata', response: { error: false, response: 'It will rain.', message_id: 'm9' } },
  ],
);

// ---------------------------------------------------------------------------
// AgenticStreamDecoder — chunk boundaries (the failure mode unique to the web reader)
// ---------------------------------------------------------------------------

check(
  'a JSON object split across two chunks is parsed once, correctly',
  drain(new AgenticStreamDecoder(), ['data: {"type":"text_delta","del', 'ta":"split"}\n\n']),
  [{ type: 'text_delta', delta: 'split' }],
);
check(
  'a bare NDJSON object split across two chunks is parsed correctly',
  drain(new AgenticStreamDecoder(), ['{"type":"text_delta","delta":"nd', 'json"}\n']),
  [{ type: 'text_delta', delta: 'ndjson' }],
);
check(
  'the newline itself may land in the next chunk',
  drain(new AgenticStreamDecoder(), ['data: {"type":"text_delta","delta":"a"}', '\n\n']),
  [{ type: 'text_delta', delta: 'a' }],
);
check(
  'a byte-at-a-time stream yields exactly the same events',
  drain(
    new AgenticStreamDecoder(),
    'event: text_delta\ndata: {"delta":"drip"}\n\nevent: done\ndata: {"answer":"drip"}\n\n'.split(''),
  ),
  [
    { type: 'text_delta', delta: 'drip' },
    { type: 'done', answer: 'drip', followUps: [] },
  ],
);
check(
  'two events arriving in one chunk both emit',
  drain(new AgenticStreamDecoder(), [
    'data: {"type":"text_delta","delta":"a"}\n\ndata: {"type":"text_delta","delta":"b"}\n\n',
  ]),
  [
    { type: 'text_delta', delta: 'a' },
    { type: 'text_delta', delta: 'b' },
  ],
);
check(
  'a partial trailing line is retained, not emitted, until completed',
  (() => {
    const decoder = new AgenticStreamDecoder();
    const first = decoder.feed('data: {"type":"text_delta","del');
    const second = decoder.feed('ta":"x"}\n\n');
    return { firstCount: first.length, second };
  })(),
  { firstCount: 0, second: [{ type: 'text_delta', delta: 'x' }] },
);

// ---------------------------------------------------------------------------
// sanitizeAgenticStreamText
// ---------------------------------------------------------------------------

check('passes clean text through', sanitizeAgenticStreamText('Plain answer.'), 'Plain answer.');
check(
  'strips a complete control token',
  sanitizeAgenticStreamText('Sow now. <<commodities:chickpea>> Water well.'),
  'Sow now.  Water well.',
);
check('strips several control tokens', sanitizeAgenticStreamText('a<<x>>b<<y>>c'), 'abc');
check(
  'strips a complete ```followups fence',
  sanitizeAgenticStreamText('Answer.\n```followups\nq1\nq2\n```\n'),
  'Answer.',
);
check(
  'cuts a half-arrived control token mid-stream',
  sanitizeAgenticStreamText('Answer so far <<comm'),
  'Answer so far',
);
check(
  'cuts an unterminated followups fence mid-stream',
  sanitizeAgenticStreamText('Answer so far\n```followups\nq1'),
  'Answer so far',
);
check('trims only trailing whitespace', sanitizeAgenticStreamText('  keep leading  \n\n'), '  keep leading');
check('an all-control-token text sanitizes to empty', sanitizeAgenticStreamText('<<only:token>>'), '');

// ---------------------------------------------------------------------------
// Alignment kinds
// ---------------------------------------------------------------------------

const alignmentWireTypes = [
  ['alignment-clarify', 'CLARIFY'],
  ['alignment-confirm', 'CONFIRM'],
  ['alignment-escalate', 'ESCALATE'],
  ['gps-prompt', 'GPS_PROMPT'],
  ['upload-photo', 'UPLOAD_PHOTO'],
  ['gender-select', 'GENDER_SELECT'],
  ['commodity-confirm', 'COMMODITY_CONFIRM'],
] as const;

for (const [wire, kind] of alignmentWireTypes) {
  check(`fromType("${wire}")`, alignmentKindFromType(wire), kind);
  check(`analyticsType round-trips "${wire}"`, alignmentAnalyticsType(kind), wire);
}
check('fromType is trimmed + case-insensitive', alignmentKindFromType('  GPS-Prompt '), 'GPS_PROMPT');
check('fromType(unknown) → null', alignmentKindFromType('alignment-teleport'), null);
check('fromType(null) → null', alignmentKindFromType(null), null);
check('fromType(undefined) → null', alignmentKindFromType(undefined), null);
check(
  'only gender-select and commodity-confirm are additive',
  alignmentWireTypes.filter(([, kind]) => isAdditiveAlignment(kind)).map(([wire]) => wire),
  ['gender-select', 'commodity-confirm'],
);

// ---------------------------------------------------------------------------
// sanitizeAgenticFinalText (settled answer — stage backend leak, 2026-10-06)
// ---------------------------------------------------------------------------

check('final: clean answer untouched', sanitizeAgenticFinalText('Use neem oil weekly.'), 'Use neem oil weekly.');
check(
  'final: closed followups block removed',
  sanitizeAgenticFinalText('Conditions are fine.\n\n```followups\n["Will it rain later today?"]\n```'),
  'Conditions are fine.',
);
check('final: unclosed trailing block removed', sanitizeAgenticFinalText('Answer.\n```followups\n["Q?"]'), 'Answer.');
check('final: control marker removed', sanitizeAgenticFinalText('Answer.<<commodities:chickpea>>'), 'Answer.');
check('final: lone << kept', sanitizeAgenticFinalText('Ratio a << b holds.'), 'Ratio a << b holds.');

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.log(`\n${passed} passed, ${failures.length} FAILED\n`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  throw new Error(`${failures.length} agentic test(s) failed`);
}
console.log(`agentic: ${passed} assertions passed`);
