/**
 * Markdown parsing for chat answers (**SDK 2.0.0**) — the pure half of `markdown.tsx`.
 *
 * Port of the Compose reference `components/MarkdownText.kt`: its `parseMarkdownBlocks`,
 * its GFM table scanner, its `appendEmphasis` / `findItalicClose` inline scanner, and its
 * block-pair vertical rhythm. Kept in a plain `.ts` module with NO DOM or React access so
 * `test/markdown.test.ts` can execute it on Node's native TypeScript support (this package has
 * no test framework — see `test/agentic.test.ts`).
 *
 * Two deliberate supersets of the Kotlin, both pre-existing web behaviour that root CLAUDE.md §3
 * (no-regression) forbids dropping: fenced code blocks, blockquotes, links and inline code spans
 * have no Compose counterpart but web has rendered them since 1.0.0, so they are carried through
 * the new scanner rather than removed. Parity here is additive.
 */

/** Per-column text alignment from a GFM separator row (`| :--- | ---: |`). */
export type TableAlign = 'start' | 'center' | 'end';

/**
 * One inline span. A tree rather than a flat token list because emphasis NESTS —
 * `*italic **bold** italic*` is an italic node containing a bold node, which the old
 * regex tokenizer structurally could not express (its `\*[^*\n]+\*` class broke on the inner `*`).
 */
export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: InlineNode[] }
  | { type: 'italic'; children: InlineNode[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: InlineNode[] };

/**
 * One block. Bullets and numbered items are emitted ONE PER ITEM, exactly as Kotlin's
 * `MarkdownBlock.BulletItem` / `NumberedItem` are, because the vertical rhythm is defined on
 * block PAIRS (a bullet following a bullet is 5dp, anything else 12dp). The renderer regroups
 * consecutive items into a single `<ul>` / `<ol>` so the list keeps its semantics for screen
 * readers — Compose has no such concern, drawing its own dots into plain rows.
 */
export type MarkdownBlock =
  | { type: 'header'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'numbered'; number: string; text: string }
  | { type: 'table'; headers: string[]; alignments: TableAlign[]; rows: string[][] }
  | { type: 'divider' }
  | { type: 'code'; lines: string[] }
  | { type: 'quote'; lines: string[] };

// ---------------------------------------------------------------------------
// Inline scanner — Kotlin appendEmphasis / findItalicClose
// ---------------------------------------------------------------------------

/**
 * Finds the next LONE emphasis marker at or after `from`, skipping doubled ones so an italic span
 * can wrap a nested bold run. Returns -1 when there is none.
 * (Kotlin `findItalicClose`, generalised over the marker character so `_` behaves like `*`.)
 */
function findItalicClose(text: string, from: number, marker: string): number {
  let k = from;
  while (k < text.length) {
    if (
      text[k] === marker &&
      (k + 1 >= text.length || text[k + 1] !== marker) &&
      (k === 0 || text[k - 1] !== marker)
    ) {
      return k;
    }
    k++;
  }
  return -1;
}

/** Appends `text` to `out` as a text node, merging into a trailing text node when possible. */
function pushText(out: InlineNode[], text: string): void {
  if (text.length === 0) return;
  const last = out[out.length - 1];
  if (last && last.type === 'text') last.text += text;
  else out.push({ type: 'text', text });
}

/**
 * Parses inline markup within a string: `**bold**`, `*italic*` (and the `__`/`_` forms), inline
 * `` `code` `` spans and `[label](href)` links, recursing into span content so bold-inside-italic
 * and the reverse both style correctly.
 *
 * A marker with no valid, non-empty closing partner is emitted LITERALLY, so a stray asterisk
 * never eats the rest of the line — the invariant the Kotlin is careful about and the single most
 * visible symptom when it is missing.
 */
export function parseInline(text: string): InlineNode[] {
  const out: InlineNode[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;

    // Inline code span: opaque, so it is checked before emphasis (a `*` inside stays literal).
    if (ch === '`') {
      const close = text.indexOf('`', i + 1);
      if (close > i + 1) {
        out.push({ type: 'code', text: text.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
    }

    // Link: [label](href). Only http(s) is linkified; anything else renders as plain label text
    // so a `javascript:` href can never become a clickable target.
    if (ch === '[') {
      const match = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(text.slice(i));
      if (match) {
        const label = match[1]!;
        const href = match[2]!;
        if (/^https?:\/\//i.test(href)) out.push({ type: 'link', href, children: parseInline(label) });
        else pushText(out, label);
        i += match[0].length;
        continue;
      }
    }

    if (ch === '*' || ch === '_') {
      const isBold = i + 1 < text.length && text[i + 1] === ch;
      const markerLen = isBold ? 2 : 1;
      const contentStart = i + markerLen;
      // Bold closes on the next doubled marker; italic on the next LONE one.
      const close = isBold
        ? text.indexOf(ch + ch, contentStart)
        : findItalicClose(text, contentStart, ch);
      if (close !== -1 && close > contentStart) {
        const children = parseInline(text.slice(contentStart, close));
        out.push(isBold ? { type: 'bold', children } : { type: 'italic', children });
        i = close + markerLen;
        continue;
      }
    }

    pushText(out, ch);
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Table scanner — Kotlin looksLikeTableRow / isTableSeparator / splitTableRow / parseAlignments
// ---------------------------------------------------------------------------

/** A line that could be a table row: contains a pipe and something between the pipes. */
export function looksLikeTableRow(trimmed: string): boolean {
  if (!trimmed.includes('|')) return false;
  return stripPipes(trimmed).trim().length > 0;
}

/** Kotlin `String.trim('|')` — strips pipes from BOTH ends, however many. */
function stripPipes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === '|') start++;
  while (end > start && value[end - 1] === '|') end--;
  return value.slice(start, end);
}

/** A GFM separator row: every cell matches `:?---+:?`. */
export function isTableSeparator(trimmed: string): boolean {
  if (!trimmed.includes('|') || !trimmed.includes('-')) return false;
  const cells = splitTableRow(trimmed);
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

/** Splits a row into trimmed cells, dropping one leading and one trailing pipe (Kotlin parity). */
export function splitTableRow(trimmed: string): string[] {
  let core = trimmed.trim();
  if (core.startsWith('|')) core = core.slice(1);
  if (core.endsWith('|')) core = core.slice(0, -1);
  return core.split('|').map((cell) => cell.trim());
}

/** Per-column alignment from the separator row; missing columns default to `start`. */
export function parseAlignments(separatorRow: string, columnCount: number): TableAlign[] {
  const cells = splitTableRow(separatorRow);
  const out: TableAlign[] = [];
  for (let idx = 0; idx < columnCount; idx++) {
    const cell = (cells[idx] ?? '').trim();
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    out.push(left && right ? 'center' : right ? 'end' : 'start');
  }
  return out;
}

/**
 * Any multi-column (2+) table renders as one stacked card per data row, so it reads
 * top-to-bottom and never pans sideways inside a vertically scrolling thread. Only a lone
 * single-column table falls back to the weighted grid — app parity, Kotlin `columnCount >= 2`
 * (MarkdownText.kt @ 10a87f9c..04b38e8f, which lowered the threshold from 3).
 */
export function isWideTable(columnCount: number): boolean {
  return columnCount >= 2;
}

/**
 * A "card" is a 3-column table whose header row holds the card title in the first cell and
 * nothing in the other two — e.g. `| Saturday, 19 Sep | | |`. This is the sole test that
 * separates a card from an ordinary grid (a grid has text in at least one trailing header cell).
 * Kotlin: `MarkdownBlock.Table.isCard()`.
 */
export function isCardTable(headers: readonly string[]): boolean {
  return (
    headers.length === 3 &&
    headers[0]!.trim().length > 0 &&
    headers.slice(1).every((h) => h.trim().length === 0)
  );
}

// ---------------------------------------------------------------------------
// Block scanner — Kotlin parseMarkdownBlocks
// ---------------------------------------------------------------------------

/**
 * Splits markdown into blocks.
 *
 * Kotlin emits one `Paragraph` per non-blank line and drops blank lines entirely; that is kept,
 * so the 20dp consecutive-paragraph rhythm below lands the same way on both platforms. Fenced
 * code blocks are consumed verbatim BEFORE table detection, so pipes inside a fence are never
 * mistaken for a table.
 */
export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');

  let i = 0;
  let quote: string[] | null = null;

  const flushQuote = () => {
    if (quote && quote.length > 0) blocks.push({ type: 'quote', lines: quote });
    quote = null;
  };

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Fenced code block (web-only; no Compose counterpart). Runs to the closing fence or EOF.
    if (trimmed.startsWith('```')) {
      flushQuote();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith('```')) {
        body.push(lines[i]!);
        i++;
      }
      i++; // consume the closing fence (a no-op at EOF)
      blocks.push({ type: 'code', lines: body });
      continue;
    }

    // Blockquote (web-only). Consecutive `>` lines group into one block.
    const quoteMatch = /^\s*>\s?(.*)$/.exec(line);
    if (quoteMatch) {
      if (quote === null) quote = [];
      quote.push(quoteMatch[1] ?? '');
      i++;
      continue;
    }
    flushQuote();

    // Table: 2-line look-ahead — a header row followed by a GFM separator row. Body rows
    // continue while subsequent lines still look like rows.
    if (looksLikeTableRow(trimmed) && i + 1 < lines.length && isTableSeparator(lines[i + 1]!.trim())) {
      const headers = splitTableRow(trimmed);
      const alignments = parseAlignments(lines[i + 1]!.trim(), headers.length);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length) {
        const next = lines[j]!.trim();
        if (!looksLikeTableRow(next)) break;
        const cells = splitTableRow(next);
        // Pad short rows / trim long ones to the header count.
        rows.push(headers.map((_, idx) => cells[idx] ?? ''));
        j++;
      }
      blocks.push({ type: 'table', headers, alignments, rows });
      i = j;
      continue;
    }

    if (trimmed.length === 0) {
      i++;
      continue;
    }

    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      blocks.push({ type: 'divider' });
      i++;
      continue;
    }

    // ATX header: one-to-six leading '#' then a space. The count maps to a level clamped 1..3,
    // matching Kotlin's `coerceIn(1, 3)` — deeper levels share the smallest title style.
    if (trimmed.startsWith('#')) {
      const hashes = /^#+/.exec(trimmed)![0];
      const rest = trimmed.slice(hashes.length);
      if (rest.startsWith(' ')) {
        const level = Math.min(Math.max(hashes.length, 1), 3) as 1 | 2 | 3;
        blocks.push({ type: 'header', level, text: rest.trim() });
        i++;
        continue;
      }
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('+ ')) {
      blocks.push({ type: 'bullet', text: trimmed.slice(2) });
      i++;
      continue;
    }

    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);
    if (numbered) {
      blocks.push({ type: 'numbered', number: numbered[1]!, text: numbered[2]!.trim() });
      i++;
      continue;
    }

    blocks.push({ type: 'paragraph', text: trimmed });
    i++;
  }

  flushQuote();
  return blocks;
}

// ---------------------------------------------------------------------------
// Vertical rhythm — Kotlin's `topSpacing` when-expression, verbatim
// ---------------------------------------------------------------------------

/**
 * Space above the block at `index`, in px (Compose dp 1:1). Defined on block PAIRS, which is why
 * list items are parsed one block each: consecutive items tighten to 5, consecutive paragraphs
 * open up to 20, and headers/dividers/tables get their own inset on both sides.
 */
export function blockTopSpacing(blocks: readonly MarkdownBlock[], index: number): number {
  if (index === 0) return 0;
  const block = blocks[index]!;
  const prev = blocks[index - 1];
  if (block.type === 'divider') return 24;
  if (prev?.type === 'divider') return 24;
  if (block.type === 'header') return 24;
  if (prev?.type === 'header') return 20;
  if (block.type === 'table') return 16;
  if (prev?.type === 'table') return 16;
  if (block.type === 'bullet' && prev?.type === 'bullet') return 5;
  if (block.type === 'numbered' && prev?.type === 'numbered') return 5;
  if (block.type === 'paragraph' && prev?.type === 'paragraph') return 20;
  return 12;
}
