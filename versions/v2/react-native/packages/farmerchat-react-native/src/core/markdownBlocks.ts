/**
 * Markdown block scanner for chat answers — the pure half of `ui/components/Markdown.tsx`, kept
 * free of React / react-native so `test/markdownBlocks.test.ts` runs on plain Node.
 *
 * Port of the app's `components/MarkdownText.kt` `parseMarkdownBlocks` (fc-compose-agentic
 * MarkdownText.kt:519-580), including its GFM table scanner (`looksLikeTableRow`,
 * `isTableSeparator`, `splitTableRow`, `parseAlignments`, `Table.isCard`). Blank lines are
 * skipped: spacing comes from block kinds, never from blank lines.
 *
 * RN supersets kept from the earlier renderer (no-regression): `>` quotes, `•` bullets and
 * `1)` numbering.
 */

export type TableAlign = 'start' | 'center' | 'end';

export type MarkdownBlock =
  | { kind: 'divider' }
  | { kind: 'header'; level: number; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'numbered'; number: string; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'table'; headers: string[]; alignments: TableAlign[]; rows: string[][] };

/** Kotlin `String.trim('|')` — strips pipes from both ends, however many. */
function stripPipes(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === '|') start++;
  while (end > start && value[end - 1] === '|') end--;
  return value.slice(start, end);
}

/** A line that could be a table row: contains a pipe and something between the pipes. */
export function looksLikeTableRow(trimmed: string): boolean {
  if (!trimmed.includes('|')) return false;
  return stripPipes(trimmed).trim().length > 0;
}

/** Splits a row into trimmed cells, dropping one leading and one trailing pipe. */
export function splitTableRow(trimmed: string): string[] {
  let core = trimmed.trim();
  if (core.startsWith('|')) core = core.slice(1);
  if (core.endsWith('|')) core = core.slice(0, -1);
  return core.split('|').map((cell) => cell.trim());
}

/** A GFM separator row: every cell matches `:?---+:?`. */
export function isTableSeparator(trimmed: string): boolean {
  if (!trimmed.includes('|') || !trimmed.includes('-')) return false;
  const cells = splitTableRow(trimmed);
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
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
 * App `MarkdownBlock.Table.isCard()`: a 3-column table whose header holds the card title in the
 * first cell and nothing in the other two (`| Saturday, 19 Sep | | |`).
 */
export function isCardTable(headers: readonly string[]): boolean {
  return (
    headers.length === 3 &&
    (headers[0] ?? '').trim().length > 0 &&
    headers.slice(1).every((h) => h.trim().length === 0)
  );
}

/** How the app draws a table (MarkdownText.kt `MarkdownTable`). */
export function tableLayout(headers: readonly string[]): 'card' | 'rowCards' | 'grid' | 'none' {
  if (headers.length === 0) return 'none';
  if (isCardTable(headers)) return 'card';
  return headers.length >= 2 ? 'rowCards' : 'grid';
}

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const parsed: MarkdownBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const trimmed = (lines[i] ?? '').trim();

    // Tables: 2-line look-ahead — a header row followed by a GFM separator row. Body rows
    // continue while subsequent lines still look like rows.
    if (looksLikeTableRow(trimmed) && i + 1 < lines.length && isTableSeparator((lines[i + 1] ?? '').trim())) {
      const headers = splitTableRow(trimmed);
      const alignments = parseAlignments((lines[i + 1] ?? '').trim(), headers.length);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length) {
        const next = (lines[j] ?? '').trim();
        if (!looksLikeTableRow(next)) break;
        const cells = splitTableRow(next);
        // Pad short rows / trim long ones to the header count.
        rows.push(headers.map((_, idx) => cells[idx] ?? ''));
        j++;
      }
      parsed.push({ kind: 'table', headers, alignments, rows });
      i = j;
      continue;
    }
    i++;

    if (trimmed.length === 0) continue;
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      parsed.push({ kind: 'divider' });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      parsed.push({
        kind: 'header',
        level: Math.min(3, (heading[1] ?? '#').length),
        text: (heading[2] ?? '').trim(),
      });
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      parsed.push({ kind: 'quote', text: quote[1] ?? '' });
      continue;
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      parsed.push({ kind: 'bullet', text: bullet[1] ?? '' });
      continue;
    }
    const numbered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed);
    if (numbered) {
      parsed.push({ kind: 'numbered', number: numbered[1] ?? '', text: numbered[2] ?? '' });
      continue;
    }
    parsed.push({ kind: 'paragraph', text: trimmed });
  }
  return parsed;
}

/** App MarkdownText.kt:106-122 vertical rhythm (space above `block`). */
export function blockTopSpacing(block: MarkdownBlock, prev: MarkdownBlock | undefined): number {
  if (!prev) return 0;
  if (block.kind === 'divider' || prev.kind === 'divider') return 24;
  if (block.kind === 'header') return 24;
  if (prev.kind === 'header') return 20;
  if (block.kind === 'table' || prev.kind === 'table') return 16;
  if (block.kind === 'bullet' && prev.kind === 'bullet') return 5;
  if (block.kind === 'numbered' && prev.kind === 'numbered') return 5;
  if (block.kind === 'paragraph' && prev.kind === 'paragraph') return 20;
  return 12;
}
