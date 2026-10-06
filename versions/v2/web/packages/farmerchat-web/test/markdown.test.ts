/**
 * Unit tests for the 2.0.0 markdown parser (`ui/components/markdownParse.ts`) — the pure half of
 * `MarkdownText`, ported from the Compose `components/MarkdownText.kt`.
 *
 * The two things most worth pinning: the recursive emphasis scanner (the old regex tokenizer
 * structurally could not match `*italic **bold** italic*`, and a stray asterisk used to eat the
 * rest of the line), and the GFM table scanner's 2-line look-ahead.
 *
 * RUNNER: none (see test/agentic.test.ts):
 *
 *     node --import ./test/ts-extension-hook.mjs test/markdown.test.ts
 */

import {
  blockTopSpacing,
  isCardTable,
  isWideTable,
  isTableSeparator,
  looksLikeTableRow,
  parseAlignments,
  parseInline,
  parseMarkdownBlocks,
  splitTableRow,
} from '../src/ui/components/markdownParse.ts';
import type { InlineNode } from '../src/ui/components/markdownParse.ts';

let passed = 0;
const failures: string[] = [];

function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) passed++;
  else failures.push(`${name}\n    expected: ${b}\n    actual:   ${a}`);
}

/** Flattens an inline tree to a compact string, so assertions stay readable: bold → [b …]. */
function shape(nodes: readonly InlineNode[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return node.text;
        case 'bold':
          return `[b ${shape(node.children)}]`;
        case 'italic':
          return `[i ${shape(node.children)}]`;
        case 'code':
          return `[c ${node.text}]`;
        case 'link':
          return `[a ${node.href} ${shape(node.children)}]`;
      }
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Inline emphasis — the recursive scanner (Kotlin appendEmphasis / findItalicClose)
// ---------------------------------------------------------------------------

check('plain text', shape(parseInline('hello world')), 'hello world');
check('bold', shape(parseInline('a **b** c')), 'a [b b] c');
check('italic', shape(parseInline('a *b* c')), 'a [i b] c');
check('underscore bold', shape(parseInline('a __b__ c')), 'a [b b] c');
check('underscore italic', shape(parseInline('a _b_ c')), 'a [i b] c');

// The regression the old tokenizer could not express at all.
check('bold nested inside italic', shape(parseInline('*it **bo** it*')), '[i it [b bo] it]');
check('italic nested inside bold', shape(parseInline('**bo *it* bo**')), '[b bo [i it] bo]');
check('adjacent spans', shape(parseInline('**a***b*')), '[b a][i b]');

// Unmatched / empty markers must render literally — a stray asterisk never eats the line.
check('unmatched bold marker is literal', shape(parseInline('a ** b')), 'a ** b');
check('unmatched italic marker is literal', shape(parseInline('2 * 3 = 6')), '2 * 3 = 6');
check('empty bold span is literal', shape(parseInline('a **** b')), 'a **** b');
check('trailing marker is literal', shape(parseInline('done*')), 'done*');

// Code spans are opaque, so emphasis inside one stays literal.
check('code span', shape(parseInline('use `a*b` now')), 'use [c a*b] now');
check('unmatched backtick is literal', shape(parseInline('a ` b')), 'a ` b');

// Links: http(s) only; anything else degrades to its label text.
check('http link', shape(parseInline('[FC](https://x.test/a)')), '[a https://x.test/a FC]');
// The safety property: a non-http(s) scheme is never linkified, only its label survives.
check('non-http link renders as plain label', shape(parseInline('[x](javascript:alert)')), 'x');
check('mailto is not linkified either', shape(parseInline('[m](mailto:a@b.test)')), 'm');
// A href containing parentheses is NOT supported — the pattern stops at the first ')', which is
// pre-existing 1.0.0 behaviour (its regex was `\([^)\s]+\)`) and so deliberately unchanged.
check(
  'parens in a href are not supported (pre-1.0.0 behaviour)',
  shape(parseInline('[x](https://a.test/b(c))')),
  // The href stops at the first ')', so the trailing one falls through as literal text.
  '[a https://a.test/b(c x])',
);
check('bold inside a link label', shape(parseInline('[**FC**](http://x.test)')), '[a http://x.test [b FC]]');

// ---------------------------------------------------------------------------
// Block scanner
// ---------------------------------------------------------------------------

check(
  'headers clamp to level 1..3',
  parseMarkdownBlocks('# a\n## b\n### c\n#### d\n###### e').map((b) => (b.type === 'header' ? b.level : b.type)),
  [1, 2, 3, 3, 3],
);
check('a bare # with no space is a paragraph', parseMarkdownBlocks('#nospace')[0]!.type, 'paragraph');
check(
  'dividers',
  parseMarkdownBlocks('a\n\n---\n\nb\n\n***\n\nc\n\n___\n\nd').filter((b) => b.type === 'divider').length,
  3,
);
check(
  'bullets are one block each, all three markers',
  parseMarkdownBlocks('- a\n* b\n+ c').map((b) => (b.type === 'bullet' ? b.text : b.type)),
  ['a', 'b', 'c'],
);
check(
  'numbered items keep their own number',
  parseMarkdownBlocks('3. a\n4) b').map((b) => (b.type === 'numbered' ? `${b.number}:${b.text}` : b.type)),
  ['3:a', '4:b'],
);
check(
  'each non-blank line is its own paragraph (Kotlin parity)',
  parseMarkdownBlocks('one\ntwo\n\nthree').map((b) => (b.type === 'paragraph' ? b.text : b.type)),
  ['one', 'two', 'three'],
);
check(
  'fenced code is captured verbatim and never scanned',
  parseMarkdownBlocks('```\n| a | b |\n# not a header\n```')[0],
  { type: 'code', lines: ['| a | b |', '# not a header'] },
);
check('an unterminated fence still closes at EOF', parseMarkdownBlocks('```\nx')[0], {
  type: 'code',
  lines: ['x'],
});
check('consecutive blockquote lines group', parseMarkdownBlocks('> a\n> b')[0], {
  type: 'quote',
  lines: ['a', 'b'],
});

// ---------------------------------------------------------------------------
// GFM tables
// ---------------------------------------------------------------------------

check('looksLikeTableRow needs content between pipes', [looksLikeTableRow('| a |'), looksLikeTableRow('||'), looksLikeTableRow('no pipes')], [true, false, false]);
check('isTableSeparator', [isTableSeparator('| --- | :---: |'), isTableSeparator('| -- |'), isTableSeparator('| a |')], [true, false, false]);
check('splitTableRow trims cells and outer pipes', splitTableRow('|  a |  b  |'), ['a', 'b']);
check('parseAlignments', parseAlignments('| :--- | :---: | ---: | --- |', 4), ['start', 'center', 'end', 'start']);
check('missing separator columns default to start', parseAlignments('| ---: |', 3), ['end', 'start', 'start']);

check(
  'a header + separator + rows becomes one table block',
  parseMarkdownBlocks('| Crop | Dose |\n| --- | ---: |\n| Wheat | 50kg |\n| Maize | 40kg |')[0],
  {
    type: 'table',
    headers: ['Crop', 'Dose'],
    alignments: ['start', 'end'],
    rows: [
      ['Wheat', '50kg'],
      ['Maize', '40kg'],
    ],
  },
);
check(
  'short rows pad and long rows trim to the header count',
  (() => {
    const block = parseMarkdownBlocks('| a | b |\n| --- | --- |\n| 1 |\n| 1 | 2 | 3 |')[0];
    return block!.type === 'table' ? block.rows : null;
  })(),
  [
    ['1', ''],
    ['1', '2'],
  ],
);
check(
  'a pipe row with no separator stays a paragraph',
  parseMarkdownBlocks('| a | b |\njust text').map((b) => b.type),
  ['paragraph', 'paragraph'],
);
check(
  'the table ends where the rows stop, and later blocks still parse',
  parseMarkdownBlocks('| a |\n| --- |\n| 1 |\n\nafter').map((b) => b.type),
  ['table', 'paragraph'],
);
check('only a lone single column stays weighted; 2+ stack into row cards', [1, 2, 3, 4].map(isWideTable), [false, true, true, true]);

// A card is `| Title | | |` — 3 columns, title in cell 0, the other two empty. Anything with text
// in a trailing header cell is an ordinary grid, and a 2- or 4-column table is never a card.
check('card detection is strict about the empty trailing headers', [
  isCardTable(['Saturday, 19 Sep', '', '']),
  isCardTable(['Saturday, 19 Sep', '   ', '']),
  isCardTable(['Reading', 'Value', 'Meaning']),
  isCardTable(['Saturday, 19 Sep', '', 'Meaning']),
  isCardTable(['', '', '']),
  isCardTable(['Title', '']),
  isCardTable(['Title', '', '', '']),
], [true, true, false, false, false, false, false]);

// ---------------------------------------------------------------------------
// Vertical rhythm — the Kotlin `topSpacing` when-expression
// ---------------------------------------------------------------------------

{
  const blocks = parseMarkdownBlocks('- a\n- b\n\npara one\n\npara two\n\n# H\n\ntail');
  //             0:bullet 1:bullet 2:para 3:para 4:header 5:para
  const spacing = blocks.map((_, i) => blockTopSpacing(blocks, i));
  check('block-pair rhythm: 0 / bullet-after-bullet 5 / 12 / para-after-para 20 / header 24 / after-header 20', spacing, [0, 5, 12, 20, 24, 20]);
}
{
  const blocks = parseMarkdownBlocks('a\n\n---\n\nb');
  check('a divider gets 24 on both sides', blocks.map((_, i) => blockTopSpacing(blocks, i)), [0, 24, 24]);
}
{
  const blocks = parseMarkdownBlocks('a\n\n| h |\n| --- |\n| 1 |\n\nb');
  check('a table gets 16 on both sides', blocks.map((_, i) => blockTopSpacing(blocks, i)), [0, 16, 16]);
}
{
  const blocks = parseMarkdownBlocks('1. a\n2. b');
  check('numbered-after-numbered tightens to 5', blockTopSpacing(blocks, 1), 5);
}

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.log(`\n${passed} passed, ${failures.length} FAILED\n`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  throw new Error(`${failures.length} markdown test(s) failed`);
}
console.log(`markdown: ${passed} assertions passed`);
