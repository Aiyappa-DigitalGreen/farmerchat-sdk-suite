/**
 * Covers `sanitizeAgenticFinalText` — the settled-answer clean-up. Regression for the stage backend
 * leaking the follow-up control block into `metadata.response` (weather answer, 2026-10-06).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeAgenticFinalText } from '../src/core/agenticModels.ts';

test('clean answer is untouched', () => {
  assert.equal(sanitizeAgenticFinalText('Use neem oil weekly.'), 'Use neem oil weekly.');
});

test('closed followups block is removed', () => {
  const raw = 'Conditions are fine.\n\n```followups\n["Will it rain later today?"]\n```';
  assert.equal(sanitizeAgenticFinalText(raw), 'Conditions are fine.');
});

test('unclosed trailing block is removed', () => {
  assert.equal(sanitizeAgenticFinalText('Answer.\n```followups\n["Q?"]'), 'Answer.');
});

test('markers removed but a lone << is kept', () => {
  assert.equal(sanitizeAgenticFinalText('Answer.<<commodities:chickpea>>'), 'Answer.');
  assert.equal(sanitizeAgenticFinalText('Ratio a << b holds.'), 'Ratio a << b holds.');
});
