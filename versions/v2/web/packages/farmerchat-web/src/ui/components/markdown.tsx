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
  isTableScrollable,
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
  const scrollable = isTableScrollable(headers.length);

  return (
    // The scroll container is the wrapper, never the page: wide tables must not make the whole
    // thread scroll sideways.
    <div className={'fcsdk-md-tablewrap' + (scrollable ? ' fcsdk-md-tablewrap--scroll' : '')}>
      <table className={'fcsdk-md-table' + (scrollable ? ' fcsdk-md-table--wide' : '')}>
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
      {/* Right-edge scroll hint, only when the table can actually overflow. */}
      {scrollable ? <span className="fcsdk-md-tablefade" aria-hidden /> : null}
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
      if (block.level === 1) return <h1 key={key}>{content}</h1>;
      if (block.level === 2) return <h2 key={key}>{content}</h2>;
      return <h3 key={key}>{content}</h3>;
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
        <blockquote key={key}>
          {block.lines.map((line, j) => (
            <Fragment key={j}>
              {j > 0 ? <br /> : null}
              {inline(line, `q${index}-${j}`)}
            </Fragment>
          ))}
        </blockquote>
      );
    case 'paragraph':
      return <p key={key}>{inline(block.text, `p${index}`)}</p>;
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
      const children = items.map((item, j) => (
        <li key={j}>
          {inline(item.type === 'bullet' || item.type === 'numbered' ? item.text : '', `li${start}-${j}`)}
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
