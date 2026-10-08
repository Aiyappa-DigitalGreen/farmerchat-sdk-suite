/**
 * MarkdownText (**SDK 2.0.0**) — renders chat answers with no runtime deps (docs/03 web
 * packaging). React elements only; raw HTML is never injected.
 *
 * Brought to parity with the Compose reference `components/MarkdownText.kt`. All parsing lives in
 * the pure, unit-tested `./markdownParse`; this file is only the render half. What 2.0.0 adds over
 * the 1.0.0 renderer:
 *
 * - **GFM tables** — 2-line look-ahead on a `| :--- | ---: |` separator, per-column alignment,
 *   1–2 columns weighted to the full width / 3+ columns horizontally scrollable with a right-edge
 *   fade hint, alternating row backgrounds.
 * - **Dividers** — `---` / `***` / `___` as a 3px rounded rule.
 * - **Nested emphasis** — `*italic **bold** italic*` and the reverse, via the recursive scanner
 *   that replaced the old regex tokenizer (which structurally could not match it).
 * - **The block-pair vertical rhythm** — 24 / 20 / 16 / 12 / 5px, per `blockTopSpacing`.
 *
 * Header levels clamp to 1..3 as in the Kotlin. Fenced code, blockquotes, links and inline code
 * have no Compose counterpart but are pre-existing web behaviour, so they are kept (root
 * CLAUDE.md §3 — parity here is additive, never a removal).
 */

import { Fragment, ReactNode } from 'react';
import {
  InlineNode,
  MarkdownBlock,
  blockTopSpacing,
  isCardTable,
  isWideTable,
  parseInline,
  parseMarkdownBlocks,
} from './markdownParse';

/** Renders one inline tree. Recurses, so emphasis nests to any depth. */
function renderInline(nodes: readonly InlineNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}-${i}`;
    switch (node.type) {
      case 'text':
        return <Fragment key={key}>{node.text}</Fragment>;
      case 'bold':
        return <strong key={key}>{renderInline(node.children, key)}</strong>;
      case 'italic':
        return <em key={key}>{renderInline(node.children, key)}</em>;
      case 'code':
        return <code key={key}>{node.text}</code>;
      case 'link':
        return (
          <a key={key} href={node.href} target="_blank" rel="noopener noreferrer">
            {renderInline(node.children, key)}
          </a>
        );
    }
  });
}

/** Convenience: parse + render a single string of inline markup. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  return renderInline(parseInline(text), keyPrefix);
}

function MarkdownTable(props: { block: Extract<MarkdownBlock, { type: 'table' }>; keyPrefix: string }) {
  const { headers, alignments, rows } = props.block;
  if (headers.length === 0) return null;

  // App parity (MarkdownText.kt @ 10a87f9c..04b38e8f): the answer format now sends "cards" —
  // a 3-column table whose header carries the title in cell 0 and leaves the other two empty,
  // each body row a label / value / meaning triple. Detected strictly by isCardTable.
  if (isCardTable(headers)) {
    const title = (headers[0] ?? '').trim();
    return (
      <div className="fcsdk-md-answercard">
        {title ? (
          <p className="fcsdk-md-answercard-title">
            {inline(title, `${props.keyPrefix}-act`)}
          </p>
        ) : null}
        {rows.map((row, rowIdx) => {
          const cellLabel = (row[0] ?? '').trim();
          const value = (row[1] ?? '').trim();
          // The meaning is the whole point of the format — the line a farmer who cannot read the
          // figure relies on — so it stays readable and is dropped only when the cell is empty.
          const meaning = (row[2] ?? '').trim();
          return (
            <div className="fcsdk-md-answercard-reading" key={rowIdx}>
              {cellLabel ? (
                <p className="fcsdk-md-answercard-label">
                  {inline(cellLabel, `${props.keyPrefix}-acl${rowIdx}`)}
                </p>
              ) : null}
              <p className="fcsdk-md-answercard-value">
                {inline(value, `${props.keyPrefix}-acv${rowIdx}`)}
              </p>
              {meaning ? (
                <p className="fcsdk-md-answercard-meaning">
                  {inline(meaning, `${props.keyPrefix}-acm${rowIdx}`)}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  // Any other multi-column (2+) table stacks into one card per data row — cell 0 as the title,
  // the remaining columns as label/value pairs — so it reads top-to-bottom with no panning.
  if (isWideTable(headers.length)) {
    return (
      <div className="fcsdk-md-rowcards">
        {rows.map((row, rowIdx) => {
          const title = (row[0] ?? '').trim();
          return (
            <div className="fcsdk-md-rowcard" key={rowIdx}>
              {title ? (
                <p className="fcsdk-md-rowcard-title">
                  {inline(title, `${props.keyPrefix}-rt${rowIdx}`)}
                </p>
              ) : null}
              <dl className="fcsdk-md-rowcard-pairs">
                {headers.slice(1).map((header, offset) => {
                  const colIdx = offset + 1;
                  return (
                    <div className="fcsdk-md-rowcard-pair" key={colIdx}>
                      {/* Label above value, each full width: a side-by-side split wrapped long
                          labels and values inside a narrow half-column. */}
                      <dt>{inline(header.trim(), `${props.keyPrefix}-rl${rowIdx}-${colIdx}`)}</dt>
                      <dd>
                        {inline((row[colIdx] ?? '').trim(), `${props.keyPrefix}-rv${rowIdx}-${colIdx}`)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="fcsdk-md-tablewrap">
      <table className="fcsdk-md-table">
        <thead>
          <tr>
            {headers.map((cell, idx) => (
              <th key={idx} style={{ textAlign: alignments[idx] ?? 'start' }}>
                {inline(cell.trim(), `${props.keyPrefix}-th${idx}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {headers.map((_, colIdx) => (
                <td key={colIdx} style={{ textAlign: alignments[colIdx] ?? 'start' }}>
                  {inline((row[colIdx] ?? '').trim(), `${props.keyPrefix}-td${rowIdx}-${colIdx}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Renders one non-list block. */
function renderBlock(block: MarkdownBlock, index: number): ReactNode {
  const key = `b${index}`;
  switch (block.type) {
    case 'divider':
      return <div key={key} className="fcsdk-md-divider" role="separator" />;
    case 'header': {
      const content = inline(block.text, `h${index}`);
      // MarkdownText.kt: H1 titleLarge, H2 titleMedium, H3+ titleSmall.
      if (block.level === 1) return <h1 key={key} className="fc-t-titleLarge">{content}</h1>;
      if (block.level === 2) return <h2 key={key} className="fc-t-titleMedium">{content}</h2>;
      return <h3 key={key} className="fc-t-titleSmall">{content}</h3>;
    }
    case 'table':
      return <MarkdownTable key={key} block={block} keyPrefix={`t${index}`} />;
    case 'code':
      return (
        <pre key={key}>
          <code>{block.lines.join('\n')}</code>
        </pre>
      );
    case 'quote':
      return (
        // One row per `>` line: a 3dp pill bar in borderDefault, 12dp, normal-colour text; 5dp apart.
        <blockquote key={key} className="fcsdk-c-md-quote">
          {block.lines.map((line, j) => (
            <div key={j} className="fcsdk-c-md-quoteline">
              <span className="fcsdk-c-md-quotebar" aria-hidden />
              <span className="fc-t-bodyMedium">{inline(line, `q${index}-${j}`)}</span>
            </div>
          ))}
        </blockquote>
      );
    case 'paragraph':
      return <p key={key} className="fc-t-bodyMedium">{inline(block.text, `p${index}`)}</p>;
    // Handled by the list grouping in MarkdownText; unreachable here.
    case 'bullet':
    case 'numbered':
      return null;
  }
}

export function MarkdownText(props: { text: string }) {
  const blocks = parseMarkdownBlocks(props.text);
  const out: ReactNode[] = [];

  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i]!;
    const marginTop = blockTopSpacing(blocks, i);

    // Consecutive list items regroup into ONE <ul>/<ol> so the list keeps its semantics for
    // screen readers, while the parser's per-item blocks still supply the tighter 5px rhythm
    // between them (applied by .fcsdk-md li + li). Compose has no such concern — it draws its
    // own bullet glyphs into plain rows.
    if (block.type === 'bullet' || block.type === 'numbered') {
      const kind = block.type;
      const items: MarkdownBlock[] = [];
      const start = i;
      while (i < blocks.length && blocks[i]!.type === kind) {
        items.push(blocks[i]!);
        i++;
      }
      // MarkdownText.kt draws its own rows: a bullet is a 5dp dot (10dp down, 10dp gap); a numbered
      // item prints "N." verbatim with a 4dp gap. Consecutive items sit 5dp apart.
      const children = items.map((item, j) => (
        <li key={j} className={kind === 'bullet' ? 'fcsdk-c-md-bullet' : 'fcsdk-c-md-numbered'}>
          {kind === 'bullet' ? (
            <span className="fcsdk-c-md-dot" aria-hidden />
          ) : (
            <span className="fc-t-bodyMedium" aria-hidden>
              {(item as Extract<MarkdownBlock, { type: 'numbered' }>).number}.
            </span>
          )}
          <span className="fc-t-bodyMedium fcsdk-c-md-litext">
            {inline(item.type === 'bullet' || item.type === 'numbered' ? item.text : '', `li${start}-${j}`)}
          </span>
        </li>
      ));
      out.push(
        kind === 'bullet' ? (
          <ul key={`b${start}`} style={{ marginTop }}>
            {children}
          </ul>
        ) : (
          <ol
            key={`b${start}`}
            style={{ marginTop }}
            // Honour the source's own first number, as Compose does by printing it verbatim.
            start={Number((items[0] as Extract<MarkdownBlock, { type: 'numbered' }>).number) || 1}
          >
            {children}
          </ol>
        ),
      );
      continue;
    }

    const rendered = renderBlock(block, i);
    out.push(
      <div key={`w${i}`} className="fcsdk-md-block" style={{ marginTop }}>
        {rendered}
      </div>,
    );
    i++;
  }

  return <div className="fcsdk-md">{out}</div>;
}
