/**
 * MarkdownText — dependency-free markdown renderer for chat answers
 * (headings, bold, italics, bullet/numbered lists, links). Matches the app's
 * `MarkdownText` component scope (docs/01 §5 misc).
 */
import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useSdk, useTheme } from '../context';
import {
  blockTopSpacing,
  parseMarkdownBlocks,
  tableLayout,
  type MarkdownBlock,
} from '../../core/markdownBlocks';
import { radius, spacing, typography } from '../theme';

interface InlineSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  link: string | null;
}

function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  // tokenize links first, then bold/italic inside remaining plain runs
  const linkRegex = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const pushStyled = (chunk: string, link: string | null) => {
    const styleRegex = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3/g;
    let idx = 0;
    let m: RegExpExecArray | null;
    while ((m = styleRegex.exec(chunk)) !== null) {
      if (m.index > idx) {
        segments.push({ text: chunk.slice(idx, m.index), bold: false, italic: false, link });
      }
      if (m[2] !== undefined) {
        segments.push({ text: m[2], bold: true, italic: false, link });
      } else if (m[4] !== undefined) {
        segments.push({ text: m[4], bold: false, italic: true, link });
      }
      idx = m.index + m[0].length;
    }
    if (idx < chunk.length) {
      segments.push({ text: chunk.slice(idx), bold: false, italic: false, link });
    }
  };
  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) pushStyled(text.slice(lastIndex, match.index), null);
    // Only http(s) is tappable (web markdownParse parity). Answers are model output, and
    // Linking.openURL hands any other scheme (tel:, intent:, upi:, app deep links) to the OS.
    const href = match[2] ?? '';
    pushStyled(match[1] ?? '', /^https?:\/\//i.test(href) ? href : null);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) pushStyled(text.slice(lastIndex), null);
  return segments;
}

/**
 * Open an answer link: the host's `config.onLinkClick` first (true = handled, SDK does nothing),
 * else — no hook, false, or a throwing hook — the default `Linking.openURL`. Only reached for
 * links that passed the http(s) filter in {@link parseInline}.
 */
function openAnswerLink(url: string, onLinkClick: ((url: string) => boolean) | null): void {
  let handled = false;
  try {
    handled = onLinkClick?.(url) === true;
  } catch {
    handled = false;
  }
  if (!handled) void Linking.openURL(url);
}

function InlineText(props: {
  text: string;
  color: string;
  linkColor: string;
  baseStyle?: object;
}): React.ReactElement {
  const onLinkClick = useSdk().config.onLinkClick;
  const segments = parseInline(props.text);
  return (
    <Text style={[typography.body, { color: props.color }, props.baseStyle]}>
      {segments.map((seg, i) => (
        <Text
          key={i}
          onPress={seg.link ? () => openAnswerLink(seg.link as string, onLinkClick) : undefined}
          style={{
            fontWeight: seg.bold ? '700' : undefined,
            fontStyle: seg.italic ? 'italic' : undefined,
            color: seg.link ? props.linkColor : undefined,
            textDecorationLine: seg.link ? 'underline' : undefined,
          }}
        >
          {seg.text}
        </Text>
      ))}
    </Text>
  );
}

export function MarkdownText(props: {
  markdown: string;
  color?: string;
  fontSize?: number;
}): React.ReactElement {
  const theme = useTheme();
  const color = props.color ?? theme.bubbleAiText;
  // Chat UI customization: message body font size (undefined = typography.body).
  const sizeStyle = props.fontSize != null ? { fontSize: props.fontSize } : undefined;
  // App MarkdownText.kt:519-580 parseMarkdownBlocks (tables included), see core/markdownBlocks.
  const parsed: MarkdownBlock[] = parseMarkdownBlocks(props.markdown);

  const blocks: React.ReactElement[] = [];
  parsed.forEach((block, index) => {
    const key = `md-${index}`;
    const gap = blockTopSpacing(block, parsed[index - 1]);
    if (gap > 0) blocks.push(<View key={`${key}-gap`} style={{ height: gap }} />);
    switch (block.kind) {
      case 'divider':
        // 3dp borderDefault pill (MarkdownText.kt:125-133).
        blocks.push(
          <View
            key={key}
            style={{ height: 3, borderRadius: 2, backgroundColor: theme.content.borderDefault }}
          />,
        );
        return;
      case 'header': {
        // # titleLarge, ## titleMedium, ###+ titleSmall (MarkdownText.kt:140-149).
        const headerStyle =
          block.level === 1
            ? typography.titleLarge
            : block.level === 2
              ? typography.titleMedium
              : typography.titleSmall;
        blocks.push(
          <InlineText
            key={key}
            text={block.text}
            color={color}
            linkColor={theme.brandPrimary}
            baseStyle={headerStyle}
          />,
        );
        return;
      }
      case 'quote':
        blocks.push(
          <View key={key} style={[styles.quoteRow, { borderLeftColor: theme.brandPrimary }]}>
            <InlineText
              text={block.text}
              color={theme.textSecondary}
              linkColor={theme.brandPrimary}
              baseStyle={{ fontStyle: 'italic', ...sizeStyle }}
            />
          </View>,
        );
        return;
      case 'bullet':
        // 5dp filled circle in the text colour, 10dp from the top, 10dp gap (:161-182).
        blocks.push(
          <View key={key} style={styles.bulletRow}>
            <View style={[styles.bulletDot, { backgroundColor: color }]} />
            <View style={{ flex: 1 }}>
              <InlineText text={block.text} color={color} linkColor={theme.brandPrimary} baseStyle={sizeStyle} />
            </View>
          </View>,
        );
        return;
      case 'numbered':
        // "N." then a 4dp gap (:184-198).
        blocks.push(
          <View key={key} style={styles.numberedRow}>
            <Text style={[typography.body, { color }, sizeStyle]}>{`${block.number}.`}</Text>
            <View style={{ flex: 1 }}>
              <InlineText text={block.text} color={color} linkColor={theme.brandPrimary} baseStyle={sizeStyle} />
            </View>
          </View>,
        );
        return;
      case 'table':
        blocks.push(<MarkdownTable key={key} block={block} textColor={color} />);
        return;
      case 'paragraph':
        blocks.push(
          <InlineText key={key} text={block.text} color={color} linkColor={theme.brandPrimary} baseStyle={sizeStyle} />,
        );
        return;
    }
  });

  return <View>{blocks}</View>;
}

type TableBlock = Extract<MarkdownBlock, { kind: 'table' }>;

/**
 * App MarkdownText.kt:214-236 `MarkdownTable`: a "card" table (`| Title | | |`) draws as one
 * titled card of label / value / meaning readings; any other 2+ column table draws as one
 * stacked card per row (never pans sideways); a lone single-column table is a bordered grid.
 */
function MarkdownTable(props: { block: TableBlock; textColor: string }): React.ReactElement | null {
  const theme = useTheme();
  const c = theme.content;
  const { block, textColor } = props;
  const linkColor = theme.brandPrimary;
  const line = <View style={[styles.tableRule, { backgroundColor: c.borderDefault }]} />;
  const layout = tableLayout(block.headers);
  if (layout === 'none') return null;

  if (layout === 'card') {
    // MarkdownAnswerCard (:262-344).
    const title = (block.headers[0] ?? '').trim();
    return (
      <View style={[styles.tableCard, { backgroundColor: c.surfaceReadingSecondary, gap: 12 }]}>
        {title ? (
          <>
            <InlineText text={title} color={textColor} linkColor={linkColor} baseStyle={[typography.labelLarge, styles.bold]} />
            {line}
          </>
        ) : null}
        {block.rows.map((row, rowIdx) => {
          const label = (row[0] ?? '').trim();
          const value = (row[1] ?? '').trim();
          const meaning = (row[2] ?? '').trim();
          return (
            <React.Fragment key={rowIdx}>
              <View style={{ gap: 2 }}>
                {label ? (
                  <InlineText text={label} color={c.foregroundSecondary} linkColor={linkColor} baseStyle={typography.bodySmall} />
                ) : null}
                <InlineText text={value} color={textColor} linkColor={linkColor} baseStyle={[typography.bodyMedium, styles.bold]} />
                {meaning ? (
                  <InlineText
                    text={meaning}
                    color={c.foregroundSecondary}
                    linkColor={linkColor}
                    baseStyle={[typography.bodyMedium, { paddingTop: 2 }]}
                  />
                ) : null}
              </View>
              {rowIdx !== block.rows.length - 1 ? line : null}
            </React.Fragment>
          );
        })}
      </View>
    );
  }

  if (layout === 'rowCards') {
    // MarkdownRowCards (:346-416): first cell is the title, then label / value per column.
    return (
      <View style={{ gap: 12 }}>
        {block.rows.map((row, rowIdx) => {
          const title = (row[0] ?? '').trim();
          return (
            <View key={rowIdx} style={[styles.tableCard, { backgroundColor: c.surfaceReadingSecondary, gap: 10 }]}>
              {title ? (
                <>
                  <InlineText text={title} color={textColor} linkColor={linkColor} baseStyle={[typography.labelLarge, styles.bold]} />
                  {line}
                </>
              ) : null}
              {block.headers.slice(1).map((header, i) => (
                <View key={i} style={{ gap: 2 }}>
                  <InlineText text={header.trim()} color={c.foregroundSecondary} linkColor={linkColor} baseStyle={typography.bodySmall} />
                  <InlineText
                    text={(row[i + 1] ?? '').trim()}
                    color={textColor}
                    linkColor={linkColor}
                    baseStyle={[typography.bodySmall, styles.bold]}
                  />
                </View>
              ))}
            </View>
          );
        })}
      </View>
    );
  }

  // MarkdownWeightedTable (:422-498): header on surfaceTertiary, rows alternate
  // surfaceSecondary / surfaceReadingSecondary, 1dp borderDefault, radius SM.
  const align = (i: number) => {
    const a = block.alignments[i] ?? 'start';
    return a === 'center' ? 'center' : a === 'end' ? 'right' : 'left';
  };
  return (
    <View style={[styles.grid, { borderColor: c.borderDefault }]}>
      <View style={[styles.gridRow, { backgroundColor: c.surfaceTertiary }]}>
        {block.headers.map((h, i) => (
          <View key={i} style={styles.gridCell}>
            <InlineText
              text={h.trim()}
              color={textColor}
              linkColor={linkColor}
              baseStyle={[typography.labelSmall, styles.bold, { textAlign: align(i) }]}
            />
          </View>
        ))}
      </View>
      {block.rows.map((row, rowIdx) => (
        <View
          key={rowIdx}
          style={[styles.gridRow, { backgroundColor: rowIdx % 2 === 0 ? c.surfaceSecondary : c.surfaceReadingSecondary }]}
        >
          {block.headers.map((_, i) => (
            <View key={i} style={styles.gridCell}>
              <InlineText
                text={(row[i] ?? '').trim()}
                color={textColor}
                linkColor={linkColor}
                baseStyle={[typography.bodySmall, { textAlign: align(i) }]}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  tableCard: { borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 14 },
  tableRule: { height: 1, alignSelf: 'stretch' },
  grid: { borderWidth: 1, borderRadius: radius.sm, overflow: 'hidden' },
  gridRow: { flexDirection: 'row' },
  gridCell: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 10 },
  numberedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  quoteRow: {
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    marginVertical: spacing.xs,
  },
});
