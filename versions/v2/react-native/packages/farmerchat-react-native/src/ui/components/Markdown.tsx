/**
 * MarkdownText — dependency-free markdown renderer for chat answers
 * (headings, bold, italics, bullet/numbered lists, links). Matches the app's
 * `MarkdownText` component scope (docs/01 §5 misc).
 */
import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useSdk, useTheme } from '../context';
import { spacing, typography } from '../theme';

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
  const lines = props.markdown.replace(/\r\n/g, '\n').split('\n');

  // App MarkdownText.kt:519-580 parseMarkdownBlocks: blank lines are skipped (spacing is
  // derived from block kinds, never from blank lines).
  type Block =
    | { kind: 'divider' }
    | { kind: 'header'; level: number; text: string }
    | { kind: 'quote'; text: string }
    | { kind: 'bullet'; text: string }
    | { kind: 'numbered'; number: string; text: string }
    | { kind: 'paragraph'; text: string };
  const parsed: Block[] = [];
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
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

  // App MarkdownText.kt:106-122 vertical rhythm.
  const topSpacing = (block: Block, prev: Block | undefined): number => {
    if (!prev) return 0;
    if (block.kind === 'divider' || prev.kind === 'divider') return 24;
    if (block.kind === 'header') return 24;
    if (prev.kind === 'header') return 20;
    if (block.kind === 'bullet' && prev.kind === 'bullet') return 5;
    if (block.kind === 'numbered' && prev.kind === 'numbered') return 5;
    if (block.kind === 'paragraph' && prev.kind === 'paragraph') return 20;
    return 12;
  };

  const blocks: React.ReactElement[] = [];
  parsed.forEach((block, index) => {
    const key = `md-${index}`;
    const gap = topSpacing(block, parsed[index - 1]);
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
      case 'paragraph':
        blocks.push(
          <InlineText key={key} text={block.text} color={color} linkColor={theme.brandPrimary} baseStyle={sizeStyle} />,
        );
        return;
    }
  });

  return <View>{blocks}</View>;
}

const styles = StyleSheet.create({
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 10 },
  numberedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  quoteRow: {
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    marginVertical: spacing.xs,
  },
});
