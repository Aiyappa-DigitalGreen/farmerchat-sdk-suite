/**
 * MarkdownText — tiny internal markdown renderer (no runtime deps, per
 * docs/03 web packaging). Supports headings, bold/italic, inline code, code
 * fences, ordered/unordered lists, links, blockquotes and paragraphs.
 * Renders React elements — never raw HTML injection.
 */

import { Fragment, ReactNode } from 'react';

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  // Tokenize: code spans, bold, italic, links.
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]]+\]\([^)\s]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) out.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const k = `${keyPrefix}-${key++}`;
    if (token.startsWith('`')) {
      out.push(<code key={k}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**') || token.startsWith('__')) {
      out.push(<strong key={k}>{renderInline(token.slice(2, -2), k)}</strong>);
    } else if (token.startsWith('*') || token.startsWith('_')) {
      out.push(<em key={k}>{renderInline(token.slice(1, -1), k)}</em>);
    } else if (token.startsWith('[')) {
      const m = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (m) {
        const href = m[2] ?? '';
        const safe = /^https?:\/\//i.test(href);
        out.push(
          safe ? (
            <a key={k} href={href} target="_blank" rel="noopener noreferrer">
              {m[1]}
            </a>
          ) : (
            <span key={k}>{m[1]}</span>
          ),
        );
      } else {
        out.push(token);
      }
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}

interface Block {
  type: 'p' | 'h' | 'ul' | 'ol' | 'code' | 'quote';
  level?: number;
  lines: string[];
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let current: Block | null = null;
  let inFence = false;

  const flush = () => {
    if (current && current.lines.length > 0) blocks.push(current);
    current = null;
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inFence) {
        inFence = false;
        flush();
      } else {
        flush();
        inFence = true;
        current = { type: 'code', lines: [] };
      }
      continue;
    }
    if (inFence) {
      current?.lines.push(line);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flush();
      blocks.push({ type: 'h', level: Math.min(heading[1]!.length, 4), lines: [heading[2] ?? ''] });
      continue;
    }
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) {
      if (current?.type !== 'ul') {
        flush();
        current = { type: 'ul', lines: [] };
      }
      current.lines.push(ul[1] ?? '');
      continue;
    }
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol) {
      if (current?.type !== 'ol') {
        flush();
        current = { type: 'ol', lines: [] };
      }
      current.lines.push(ol[1] ?? '');
      continue;
    }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      if (current?.type !== 'quote') {
        flush();
        current = { type: 'quote', lines: [] };
      }
      current.lines.push(quote[1] ?? '');
      continue;
    }
    if (line.trim() === '') {
      flush();
      continue;
    }
    if (current?.type !== 'p') {
      flush();
      current = { type: 'p', lines: [] };
    }
    current.lines.push(line.trim());
  }
  flush();
  return blocks;
}

export function MarkdownText(props: { text: string }) {
  const blocks = parseBlocks(props.text);
  return (
    <div className="fcsdk-md">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'h': {
            const content = renderInline(block.lines.join(' '), `h${i}`);
            if (block.level === 1) return <h1 key={i}>{content}</h1>;
            if (block.level === 2) return <h2 key={i}>{content}</h2>;
            if (block.level === 3) return <h3 key={i}>{content}</h3>;
            return <h4 key={i}>{content}</h4>;
          }
          case 'ul':
            return (
              <ul key={i}>
                {block.lines.map((li, j) => (
                  <li key={j}>{renderInline(li, `ul${i}-${j}`)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i}>
                {block.lines.map((li, j) => (
                  <li key={j}>{renderInline(li, `ol${i}-${j}`)}</li>
                ))}
              </ol>
            );
          case 'code':
            return (
              <pre key={i}>
                <code>{block.lines.join('\n')}</code>
              </pre>
            );
          case 'quote':
            return <blockquote key={i}>{renderInline(block.lines.join(' '), `q${i}`)}</blockquote>;
          case 'p':
          default:
            return (
              <p key={i}>
                {block.lines.map((l, j) => (
                  <Fragment key={j}>
                    {j > 0 ? <br /> : null}
                    {renderInline(l, `p${i}-${j}`)}
                  </Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}
