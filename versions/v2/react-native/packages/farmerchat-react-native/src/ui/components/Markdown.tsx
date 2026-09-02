/**
 * MarkdownText — dependency-free markdown renderer for chat answers
 * (headings, bold, italics, bullet/numbered lists, links). Matches the app's
 * `MarkdownText` component scope (docs/01 §5 misc).
 */
import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../context';
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
    pushStyled(match[1] ?? '', match[2] ?? null);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) pushStyled(text.slice(lastIndex), null);
  return segments;
}

function InlineText(props: {
  text: string;
  color: string;
  linkColor: string;
  baseStyle?: object;
}): React.ReactElement {
  const segments = parseInline(props.text);
  return (
    <Text style={[typography.body, { color: props.color }, props.baseStyle]}>
      {segments.map((seg, i) => (
        <Text
          key={i}
          onPress={seg.link ? () => void Linking.openURL(seg.link as string) : undefined}
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
  const blocks: React.ReactElement[] = [];

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd();
    const key = `md-${index}`;
    if (line.trim().length === 0) {
      blocks.push(<View key={key} style={{ height: spacing.sm }} />);
      return;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = (heading[1] ?? '#').length;
      blocks.push(
        <Text
          key={key}
          style={[
            level <= 2 ? typography.heading : typography.subheading,
            { color, marginTop: spacing.sm },
          ]}
        >
          {heading[2] ?? ''}
        </Text>,
      );
      return;
    }
    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      blocks.push(
        <View key={key} style={[styles.quoteRow, { borderLeftColor: theme.brandPrimary }]}>
          <InlineText
            text={quote[1] ?? ''}
            color={theme.textSecondary}
            linkColor={theme.brandPrimary}
            baseStyle={{ fontStyle: 'italic', ...sizeStyle }}
          />
        </View>,
      );
      return;
    }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      blocks.push(
        <View key={key} style={styles.listRow}>
          <Text style={[typography.body, { color }, sizeStyle]}>{'• '}</Text>
          <View style={{ flex: 1 }}>
            <InlineText text={bullet[1] ?? ''} color={color} linkColor={theme.brandPrimary} baseStyle={sizeStyle} />
          </View>
        </View>,
      );
      return;
    }
    const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      blocks.push(
        <View key={key} style={styles.listRow}>
          <Text style={[typography.body, { color }, sizeStyle]}>{`${numbered[1]}. `}</Text>
          <View style={{ flex: 1 }}>
            <InlineText
              text={numbered[2] ?? ''}
              color={color}
              linkColor={theme.brandPrimary}
              baseStyle={sizeStyle}
            />
          </View>
        </View>,
      );
      return;
    }
    blocks.push(
      <InlineText key={key} text={line} color={color} linkColor={theme.brandPrimary} baseStyle={sizeStyle} />,
    );
  });

  return <View>{blocks}</View>;
}

const styles = StyleSheet.create({
  listRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 2 },
  quoteRow: {
    borderLeftWidth: 3,
    paddingLeft: spacing.sm,
    marginVertical: spacing.xs,
  },
});
