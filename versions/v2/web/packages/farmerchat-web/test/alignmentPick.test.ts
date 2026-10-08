/**
 * Unit tests for `recordAlignmentPick` — the reducer behind the 2.0.0 selected/locked chip
 * treatment on an alignment surface.
 *
 * Worth pinning: before this existed, `alignmentSelectedValues` was declared, initialised to `[]`
 * and READ by the renderer, but nothing ever appended to it — so the whole selected/locked chip
 * path was unreachable on every platform. These assertions are what keep it wired.
 *
 * RUNNER: none (see test/agentic.test.ts). The reducer lives in a React-free module precisely so
 * it can run here:
 *
 *     node --import ./test/ts-extension-hook.mjs test/alignmentPick.test.ts
 */

import { alignmentChipSend, recordAlignmentPick } from '../src/core/alignment.ts';

let passed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) passed++;
  else failures.push(`${name}\n    expected: ${b}\n    actual:   ${a}`);
}

interface Msg {
  kind: string;
  id: string;
  alignmentSelectedValues?: string[];
}

const thread: Msg[] = [
  { kind: 'user', id: 'u1' },
  { kind: 'ai', id: 'a1', alignmentSelectedValues: [] },
  { kind: 'user', id: 'u2' },
  { kind: 'ai', id: 'a2', alignmentSelectedValues: [] },
];

// --- the pick lands on the RIGHT message ------------------------------------------------------

check(
  'records the pick on the named surface only',
  recordAlignmentPick(thread, 'a2', 'wheat').map((m) => m.alignmentSelectedValues ?? null),
  [null, [], null, ['wheat']],
);
check(
  'an earlier surface can be picked without touching the later one',
  recordAlignmentPick(thread, 'a1', 'maize').map((m) => m.alignmentSelectedValues ?? null),
  [null, ['maize'], null, []],
);

// --- accumulation + idempotence ---------------------------------------------------------------

check(
  'a second, different pick accumulates',
  recordAlignmentPick(recordAlignmentPick(thread, 'a1', 'maize'), 'a1', 'wheat')[1]!
    .alignmentSelectedValues,
  ['maize', 'wheat'],
);
check(
  'an already-recorded pick is not duplicated',
  recordAlignmentPick(recordAlignmentPick(thread, 'a1', 'maize'), 'a1', 'maize')[1]!
    .alignmentSelectedValues,
  ['maize'],
);
{
  // Referential stability matters: the caller's setState short-circuits on an unchanged array.
  const once = recordAlignmentPick(thread, 'a1', 'maize');
  check('re-recording the same pick returns the SAME array', recordAlignmentPick(once, 'a1', 'maize') === once, true);
}

// --- no-ops -----------------------------------------------------------------------------------

check('unknown message id is a no-op', recordAlignmentPick(thread, 'nope', 'wheat') === thread, true);
check('empty pick is a no-op', recordAlignmentPick(thread, 'a1', '') === thread, true);
check(
  'a user message is never treated as a surface',
  recordAlignmentPick(thread, 'u1', 'wheat') === thread,
  true,
);
check(
  'a message with no prior list starts one',
  recordAlignmentPick<Msg>([{ kind: 'ai', id: 'a9' }], 'a9', 'wheat')[0]!.alignmentSelectedValues,
  ['wheat'],
);

// --- verbatim storage -------------------------------------------------------------------------
// AlignmentSurface compares selectedValues against chip.value / chip.label UNTRIMMED, so trimming
// here would record a string that can never match and the chip would stay unhighlighted.
check(
  'the pick is stored verbatim, whitespace included',
  recordAlignmentPick(thread, 'a1', ' wheat ')[1]!.alignmentSelectedValues,
  [' wheat '],
);
check(
  'a trimmed variant is therefore a DIFFERENT pick',
  recordAlignmentPick(recordAlignmentPick(thread, 'a1', ' wheat '), 'a1', 'wheat')[1]!
    .alignmentSelectedValues,
  [' wheat ', 'wheat'],
);

// --- what a chip tap sends (alignmentChipSend, app ChatScreen.kt:1639-1663) -------------------
// The bug this pins: a confirm chip sent its VALUE, so the bubble read "written_plan".
check(
  'confirm: the LABEL is shown and sent, the VALUE only marks the chip',
  alignmentChipSend('CONFIRM', { label: 'Step-by-step plan', value: 'written_plan' }),
  { query: 'Step-by-step plan', selectionValue: 'written_plan', displayText: 'Step-by-step plan' },
);
check(
  'clarify behaves the same',
  alignmentChipSend('CLARIFY', { label: 'Wheat', value: 'crop_wheat' }),
  { query: 'Wheat', selectionValue: 'crop_wheat', displayText: 'Wheat' },
);
check(
  'gender-select sends the VALUE under its LABEL',
  alignmentChipSend('GENDER_SELECT', { label: 'Female', value: 'female' }),
  { query: 'female', selectionValue: 'female', displayText: 'Female' },
);
check(
  'a blank label falls back to the value',
  alignmentChipSend('CONFIRM', { label: '  ', value: 'yes' }),
  { query: 'yes', selectionValue: 'yes', displayText: 'yes' },
);
check(
  'a missing value falls back to the label for the selection',
  alignmentChipSend('CONFIRM', { label: 'Yes' }),
  { query: 'Yes', selectionValue: 'Yes', displayText: 'Yes' },
);
check('a chip with neither sends nothing', alignmentChipSend('CONFIRM', { label: '', value: null }), null);

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.log(`\n${passed} passed, ${failures.length} FAILED\n`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  throw new Error(`${failures.length} alignmentPick test(s) failed`);
}
console.log(`alignmentPick: ${passed} assertions passed`);
