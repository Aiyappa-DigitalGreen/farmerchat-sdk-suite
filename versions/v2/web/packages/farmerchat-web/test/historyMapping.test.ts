/**
 * Unit tests for the #32 history mapping (`src/state/historyMapping.ts`).
 *
 * Pins two things verified against DEMO on 2026-10-16:
 *  - the server returns a page NEWEST turn first, and the app sorts by `message_input_time`
 *    (ChatViewModel.kt:1255), so the thread must come out oldest-first and the trailing chips
 *    must be the newest answer's;
 *  - type-7 items carry `follow_up_question_id`, but the app keeps only the question strings
 *    (ChatViewModel.kt:1296-1300), so history exposes no ids and a tapped chip sends no #30.
 *
 * RUNNER: none (see test/agentic.test.ts):
 *
 *     node --import ./test/ts-extension-hook.mjs test/historyMapping.test.ts
 */

import { mapHistoryItems, sortHistoryItems } from '../src/state/historyMapping.ts';
import type { ConversationChatHistoryMessageItem } from '../src/core/types.ts';

let passed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) passed++;
  else failures.push(`${name}\n    expected: ${b}\n    actual:   ${a}`);
}

// Shape and order of a real DEMO #32 page (ids shortened): newest turn ("Rice") first.
const page: ConversationChatHistoryMessageItem[] = [
  { message_type_id: 1, message_type: 'query_text', message_id: 'm2', message_input_time: '2026-10-16T09:07:24.164669Z', query_text: 'Rice' },
  { message_type_id: 3, message_type: 'response_text', message_id: 'm2', message_input_time: '2026-10-16T09:07:24.164669Z', response_text: 'What stage is your rice crop at right now?', clarification_required: false },
  {
    message_type_id: 7, message_type: 'follow_up_questions', message_id: 'm2', message_input_time: '2026-10-16T09:07:24.164669Z',
    questions: [
      { follow_up_question_id: 'f2b', sequence: 2, question: 'What fertilizer schedule should I follow for rice now?' },
      { follow_up_question_id: 'f2a', sequence: 1, question: 'How should I adjust irrigation for rice in this season?' },
      { follow_up_question_id: null, sequence: 3, question: 'How might upcoming weather affect my rice crop?' },
      { follow_up_question_id: 'f2x', sequence: 4, question: '' },
    ],
  },
  { message_type_id: 1, message_type: 'query_text', message_id: 'm1', message_input_time: '2026-10-16T09:07:15.238133Z', query_text: 'fertilizer' },
  { message_type_id: 3, message_type: 'response_text', message_id: 'm1', message_input_time: '2026-10-16T09:07:15.238133Z', response_text: 'Which crop do you need fertilizer for?' },
  {
    message_type_id: 7, message_type: 'follow_up_questions', message_id: 'm1', message_input_time: '2026-10-16T09:07:15.238133Z',
    questions: [{ follow_up_question_id: 'f1a', sequence: 1, question: 'What types of fertilizers are best for my crops in this region?' }],
  },
];

// --- order --------------------------------------------------------------------------------------
const mapped = mapHistoryItems(page, 1);
check(
  'thread renders oldest turn first (app sorts by message_input_time)',
  mapped.messages.map((m) => (m.kind === 'user' ? `U:${m.text}` : m.kind === 'ai' ? `A:${m.messageId}` : m.kind)),
  ['U:fertilizer', 'A:m1', 'U:Rice', 'A:m2'],
);
check('row ids stay unique', new Set(mapped.messages.map((m) => m.id)).size, mapped.messages.length);

// --- follow-up ids ------------------------------------------------------------------------------
check(
  'trailing chips are the NEWEST answer\'s, in server order, blanks dropped',
  mapped.trailingQuestions,
  [
    'What fertilizer schedule should I follow for rice now?',
    'How should I adjust irrigation for rice in this season?',
    'How might upcoming weather affect my rice crop?',
  ],
);
check('no follow-up ids leave the mapping (app drops them)', 'trailingQuestionIds' in mapped, false);
check('mapped keys are exactly the app-parity set', Object.keys(mapped).sort(), ['clarification', 'messages', 'trailingQuestions']);
const lastAi = mapped.messages.filter((m) => m.kind === 'ai').pop();
check('the follow-ups attach to the answer they belong to', lastAi && lastAi.kind === 'ai' ? lastAi.followUpQuestions?.length : -1, 3);

// A question after the last follow-ups clears the trailing chips (and their ids) together.
const open = mapHistoryItems([...page, { message_type_id: 1, message_id: 'm3', message_input_time: '2026-10-16T09:08:00Z', query_text: 'and wheat?' }]);
check('a newer question clears trailing chips', open.trailingQuestions, null);

// Plain-string follow-ups (tolerated legacy form) have no id.
const legacy = mapHistoryItems([
  { message_type_id: 1, message_id: 'x', query_text: 'q' },
  { message_type_id: 3, message_id: 'x', response_text: 'a' },
  { message_type_id: 7, message_id: 'x', questions: ['One?', '', 'Two?'] },
]);
check('string follow-ups are tolerated, blanks dropped', legacy.trailingQuestions, ['One?', 'Two?']);

// --- sort semantics (nullsLast, stable) ---------------------------------------------------------
check(
  'items without a time sort last; ties keep server order',
  sortHistoryItems([
    { message_id: 'n1' },
    { message_id: 'b', message_input_time: '2026-01-02T00:00:00Z' },
    { message_id: 'a1', message_input_time: '2026-01-01T00:00:00Z' },
    { message_id: 'a2', message_input_time: '2026-01-01T00:00:00Z' },
    { message_id: 'n2', message_input_time: null },
  ]).map((i) => i.message_id),
  ['a1', 'a2', 'b', 'n1', 'n2'],
);

// --- voice turns (ChatViewModel.kt:1273: query_text ?: heard_query_text ?: "") ------------------
const voice = (item: ConversationChatHistoryMessageItem) =>
  mapHistoryItems([{ message_type_id: 2, message_id: 'v', ...item }]).messages[0];
check('voice turn shows query_text first', voice({ query_text: 'edited text', heard_query_text: 'heard text' }), {
  kind: 'user', id: 'v_2_1_0', text: 'edited text', audioUri: undefined, isFailed: false,
});
check('…falls back to heard_query_text when query_text is null', voice({ query_text: null, heard_query_text: 'heard text' })?.kind === 'user' ? (voice({ query_text: null, heard_query_text: 'heard text' }) as { text: string }).text : null, 'heard text');
check('…a blank query_text is kept, like Kotlin ?:', (voice({ query_text: '', heard_query_text: 'heard' }) as { text: string }).text, '');
check('…neither -> empty', (voice({}) as { text: string }).text, '');
check('…audio url carried', (voice({ query_text: 'q', query_media_file_url: 'https://x/a.wav' }) as { audioUri?: string }).audioUri, 'https://x/a.wav');

if (failures.length > 0) {
  console.log(`\n${passed} passed, ${failures.length} FAILED\n`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  throw new Error(`${failures.length} historyMapping test(s) failed`);
}
console.log(`historyMapping: ${passed} assertions passed`);
