/**
 * Scenario C5 (2026-10-17): DEMO answered the weather outlook with GFM "card" tables and the RN
 * renderer drew every `| … |` row as a raw paragraph. App MarkdownText.kt parses tables.
 *
 *     node --import ./test/ts-extension-hook.mjs test/markdownBlocks.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  blockTopSpacing,
  isCardTable,
  isTableSeparator,
  parseMarkdownBlocks,
  tableLayout,
} from '../src/core/markdownBlocks.ts';

const weather = [
  'Here is the weather outlook for your general region over the coming days:',
  '',
  '| Today (17 Oct) | | |',
  '| --- | --- | ---',
  '| Temperature | 21-28 °C | Warm during the day, cooling down at night. |',
  '| Rain Chance | 60% | Likely rain showers; delay chemical spraying. |',
  '',
  '| Sunday (18 Oct) | | |',
  '| --- | --- | --- |',
  '| Rain Chance | 0% | Dry weather. |',
].join('\n');

test('weather card tables parse as two card tables, not paragraphs', () => {
  const blocks = parseMarkdownBlocks(weather);
  assert.deepEqual(blocks.map((b) => b.kind), ['paragraph', 'table', 'table']);
  const t = blocks[1];
  assert.ok(t && t.kind === 'table');
  assert.deepEqual(t.headers, ['Today (17 Oct)', '', '']);
  assert.equal(t.rows.length, 2);
  assert.deepEqual(t.rows[0], ['Temperature', '21-28 °C', 'Warm during the day, cooling down at night.']);
  assert.equal(tableLayout(t.headers), 'card');
  assert.equal(blockTopSpacing(t, blocks[0]), 16);
  assert.ok(!blocks.some((b) => b.kind === 'paragraph' && b.text.startsWith('|')));
});

test('table layout follows MarkdownTable: card / row cards / grid', () => {
  assert.ok(isCardTable(['Mon', '', '']));
  assert.ok(!isCardTable(['Crop', 'Dose', '']));
  assert.equal(tableLayout(['Crop', 'Dose']), 'rowCards');
  assert.equal(tableLayout(['Only']), 'grid');
  assert.ok(isTableSeparator('| :--- | ---: |'));
  assert.ok(!isTableSeparator('| -- | --- |'));
});

test('rows are padded / trimmed to the header count; a pipe-less line ends the table', () => {
  const blocks = parseMarkdownBlocks('| A | B |\n|---|---|\n| 1 |\n| 2 | 3 | 4 |\nAfter');
  const t = blocks[0];
  assert.ok(t && t.kind === 'table');
  assert.deepEqual(t.rows, [['1', ''], ['2', '3']]);
  assert.equal(blocks[1]?.kind, 'paragraph');
});

test('no separator row means no table (app 2-line look-ahead)', () => {
  assert.deepEqual(parseMarkdownBlocks('| a | b |\n| c | d |').map((b) => b.kind), ['paragraph', 'paragraph']);
});

test('Markdown.tsx renders tables through the shared parser', () => {
  const src = readFileSync('src/ui/components/Markdown.tsx', 'utf8');
  assert.ok(src.includes('parseMarkdownBlocks(props.markdown)'));
  assert.ok(src.includes("case 'table':"));
});
