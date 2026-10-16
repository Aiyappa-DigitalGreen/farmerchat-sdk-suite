/**
 * Share / Save card. Canvas port of the app's `ShareCard` (fc-compose-agentic
 * `ui/chat/component/ShareCard.kt`), which the app renders off-screen, captures with
 * `graphicsLayer.toImageBitmap()` and shares as `farmerchat_share.png` with the caption
 * `Labels.SHARE_APP_MESSAGE` (ChatScreen.kt:904-926, 2093-2128), or saves as
 * `FarmerChat_<millis>.png` (ChatScreen.kt:928-956, 2133-2160).
 *
 * Card (500×700 dp, white):
 * - photo (only when the asked question carried one): 16 dp inset, full width, 1.85:1, radius 16,
 *   centre-cropped;
 * - body: padding 32 (top 20 with a photo), the QUESTION (displaySmall 24/32 bold with a photo,
 *   displayMedium 28/36 bold without; truncated to 50 / 70 chars) then 14 / 16 dp, then the ANSWER
 *   as markdown in black (truncated to 460 / 940 chars) — paragraphs bodyMedium 17/25, headers
 *   titleLarge/Medium/Small, 5 dp bullet dots, "n." numbers, the MarkdownText block rhythm;
 * - footer: #008236 (brand surfacePrimary), padding 32 × 22: white FarmerChat wordmark 22 dp high,
 *   10 dp, "Practical advice for your farm" labelLarge 17/22 w600 white; the Google Play badge
 *   38 dp high on the right.
 *
 * Canvas has no layout engine, so tables / code / quotes (which the card never sizes for) are drawn
 * as plain wrapped text rows. Rendered at 2× (1000×1400 px); the app captures at device density.
 */

import { ICONS, type IconDef } from '../icons';
import { GOOGLE_PLAY_BADGE } from './googlePlayBadge';
import { blockTopSpacing, parseInline, parseMarkdownBlocks, type InlineNode, type MarkdownBlock } from './markdownParse';

const SCALE = 2;
const CARD_W = 500;
const CARD_H = 700;
const FONT = '"FC Roboto", Roboto, "Noto Sans", system-ui, sans-serif';

// ShareCard.kt:30-33 (Figma character limits).
const PHOTO_TITLE_MAX_CHARS = 50;
const PHOTO_BODY_MAX_CHARS = 460;
const TEXT_ONLY_TITLE_MAX_CHARS = 70;
const TEXT_ONLY_BODY_MAX_CHARS = 940;

// Footer geometry (ShareCard.kt ShareCardFooter): padding 22 vertical around the taller of the
// [22 wordmark + 10 + 22 labelLarge line] column (54) and the 38 badge.
const FOOTER_PAD_X = 32;
const FOOTER_PAD_Y = 22;
const FOOTER_H = FOOTER_PAD_Y * 2 + 22 + 10 + 22;

export interface ShareCardContent {
  /** The asked question — the app's last user message text (may be blank for a photo-only ask). */
  title: string;
  /** The answer markdown — the app's last AI response text. */
  body: string;
  /** The question's photo (object / http URL), or null. Its presence switches to the photo layout. */
  imageUrl?: string | null;
  /** `Labels.PRACTICAL_ADVICE_YOUR_FARM` ("Practical advice for your farm"). */
  tagline: string;
}

/** The text-only / photo limits applied before drawing (ShareCard.kt:45-49). */
export function truncateShareCard(title: string, body: string, hasPhoto: boolean): { title: string; body: string } {
  return {
    title: title.slice(0, hasPhoto ? PHOTO_TITLE_MAX_CHARS : TEXT_ONLY_TITLE_MAX_CHARS),
    body: body.slice(0, hasPhoto ? PHOTO_BODY_MAX_CHARS : TEXT_ONLY_BODY_MAX_CHARS),
  };
}

interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
}

function flatten(nodes: InlineNode[], bold = false, italic = false, out: Run[] = []): Run[] {
  for (const n of nodes) {
    if (n.type === 'text' || n.type === 'code') out.push({ text: n.text, bold, italic });
    else if (n.type === 'bold') flatten(n.children, true, italic, out);
    else if (n.type === 'italic') flatten(n.children, bold, true, out);
    else flatten(n.children, bold, italic, out);
  }
  return out;
}

interface Style {
  size: number;
  lineHeight: number;
  weight: number;
}

const BODY: Style = { size: 17, lineHeight: 25, weight: 400 };
const HEADERS: Record<1 | 2 | 3, Style> = {
  1: { size: 22, lineHeight: 28, weight: 700 },
  2: { size: 18, lineHeight: 24, weight: 700 },
  3: { size: 16, lineHeight: 22, weight: 700 },
};

function font(style: Style, run?: { bold: boolean; italic: boolean }): string {
  const weight = run?.bold ? 700 : style.weight;
  return `${run?.italic ? 'italic ' : ''}${weight} ${style.size}px ${FONT}`;
}

type Line = Array<{ text: string; font: string; width: number }>;

/** Greedy word wrap over styled runs. */
function wrapRuns(ctx: CanvasRenderingContext2D, runs: Run[], style: Style, maxWidth: number): Line[] {
  const lines: Line[] = [];
  let line: Line = [];
  let lineWidth = 0;
  const push = () => {
    lines.push(line);
    line = [];
    lineWidth = 0;
  };
  for (const run of runs) {
    const f = font(style, run);
    ctx.font = f;
    for (const piece of run.text.split(/(\s+)/)) {
      if (piece === '') continue;
      if (/\n/.test(piece)) {
        push();
        continue;
      }
      const isSpace = /^\s+$/.test(piece);
      if (isSpace && line.length === 0) continue;
      const w = ctx.measureText(isSpace ? ' ' : piece).width;
      if (!isSpace && lineWidth + w > maxWidth && line.length > 0) {
        // Drop a trailing space before breaking.
        const last = line[line.length - 1];
        if (last && /^\s+$/.test(last.text)) {
          lineWidth -= last.width;
          line.pop();
        }
        push();
      }
      line.push({ text: isSpace ? ' ' : piece, font: f, width: w });
      lineWidth += w;
    }
  }
  if (line.length > 0) push();
  return lines;
}

function drawLines(ctx: CanvasRenderingContext2D, lines: Line[], x: number, y: number, lineHeight: number): number {
  lines.forEach((line, i) => {
    let cx = x;
    const cy = y + i * lineHeight + lineHeight / 2;
    for (const seg of line) {
      ctx.font = seg.font;
      ctx.fillText(seg.text, cx, cy);
      cx += seg.width;
    }
  });
  return lines.length * lineHeight;
}

function drawIcon(ctx: CanvasRenderingContext2D, icon: IconDef, x: number, y: number, height: number, tint?: string): number {
  const width = (height * icon.vw) / icon.vh;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width / icon.vw, height / icon.vh);
  for (const p of icon.paths) {
    ctx.fillStyle = tint ?? p.fill;
    ctx.fill(new Path2D(p.d), p.fillRule === 'evenodd' ? 'evenodd' : 'nonzero');
  }
  ctx.restore();
  return width;
}

function blockText(block: MarkdownBlock): string {
  switch (block.type) {
    case 'header':
    case 'paragraph':
    case 'bullet':
    case 'numbered':
      return block.text;
    case 'table':
      return [block.headers.join(' | '), ...block.rows.map((r) => r.join(' | '))].join('\n');
    case 'code':
    case 'quote':
      return block.lines.join('\n');
    case 'divider':
      return '';
  }
}

/** Markdown body (MarkdownText.kt block rhythm). Returns the height drawn. */
function drawMarkdown(ctx: CanvasRenderingContext2D, markdown: string, x: number, y: number, width: number): number {
  const blocks = parseMarkdownBlocks(markdown);
  let cy = y;
  blocks.forEach((block, index) => {
    cy += blockTopSpacing(blocks, index);
    ctx.fillStyle = '#000000';
    if (block.type === 'divider') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.beginPath();
      ctx.roundRect(x, cy, width, 3, 1.5);
      ctx.fill();
      cy += 3;
      return;
    }
    const style = block.type === 'header' ? HEADERS[block.level] : BODY;
    const runs = flatten(parseInline(blockText(block)));
    if (block.type === 'bullet') {
      // 5 dp dot, 10 dp from the top, 10 dp gap (MarkdownText.kt BulletItem row).
      ctx.beginPath();
      ctx.arc(x + 2.5, cy + 10 + 2.5, 2.5, 0, Math.PI * 2);
      ctx.fill();
      const lines = wrapRuns(ctx, runs, style, width - 15);
      cy += drawLines(ctx, lines, x + 15, cy, style.lineHeight);
      return;
    }
    if (block.type === 'numbered') {
      ctx.font = font(style);
      const label = `${block.number}.`;
      ctx.fillText(label, x, cy + style.lineHeight / 2);
      const indent = ctx.measureText(label).width + 4;
      const lines = wrapRuns(ctx, runs, style, width - indent);
      cy += drawLines(ctx, lines, x + indent, cy, style.lineHeight);
      return;
    }
    const lines = wrapRuns(ctx, runs, style, width);
    cy += drawLines(ctx, lines, x, cy, style.lineHeight);
  });
  return cy - y;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Renders the app's share card to a PNG blob. */
export async function renderAnswerCard(content: ShareCardContent): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  try {
    await Promise.all([
      document.fonts?.load(`700 28px ${FONT}`),
      document.fonts?.load(`400 17px ${FONT}`),
      document.fonts?.load(`600 17px ${FONT}`),
    ]);
  } catch {
    // Fall back to whatever the system renders.
  }
  const photo = content.imageUrl ? await loadImage(content.imageUrl) : null;
  const hasPhoto = !!content.imageUrl;
  const { title, body } = truncateShareCard(content.title, content.body, hasPhoto);

  canvas.width = CARD_W * SCALE;
  canvas.height = CARD_H * SCALE;
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  let y = 0;
  if (hasPhoto) {
    const px = 16;
    const pw = CARD_W - 32;
    const ph = pw / 1.85;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(px, 16, pw, ph, 16);
    ctx.clip();
    if (photo) {
      // ContentScale.Crop: cover, centred.
      const s = Math.max(pw / photo.naturalWidth, ph / photo.naturalHeight);
      const dw = photo.naturalWidth * s;
      const dh = photo.naturalHeight * s;
      ctx.drawImage(photo, px + (pw - dw) / 2, 16 + (ph - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = '#E5E5E5';
      ctx.fillRect(px, 16, pw, ph);
    }
    ctx.restore();
    y = 16 + ph;
  }

  // Body column.
  const x = 32;
  const width = CARD_W - 64;
  y += hasPhoto ? 20 : 32;
  const titleStyle: Style = hasPhoto ? { size: 24, lineHeight: 32, weight: 700 } : { size: 28, lineHeight: 36, weight: 700 };
  ctx.fillStyle = '#000000';
  const titleLines = wrapRuns(ctx, [{ text: title, bold: false, italic: false }], titleStyle, width);
  // A blank title (photo-only question) still takes one line, like an empty Compose Text.
  y += Math.max(titleStyle.lineHeight, drawLines(ctx, titleLines, x, y, titleStyle.lineHeight));
  y += hasPhoto ? 14 : 16;
  drawMarkdown(ctx, body, x, y, width);

  // Footer, drawn last so an over-long body never paints over it.
  const fy = CARD_H - FOOTER_H;
  ctx.fillStyle = '#008236';
  ctx.fillRect(0, fy, CARD_W, FOOTER_H);
  drawIcon(ctx, ICONS.logo_wordmark, FOOTER_PAD_X, fy + FOOTER_PAD_Y, 22, '#FFFFFF');
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `600 17px ${FONT}`;
  ctx.fillText(content.tagline, FOOTER_PAD_X, fy + FOOTER_PAD_Y + 22 + 10 + 11);
  const badgeH = 38;
  const badgeW = (badgeH * GOOGLE_PLAY_BADGE.vw) / GOOGLE_PLAY_BADGE.vh;
  drawIcon(ctx, GOOGLE_PLAY_BADGE, CARD_W - FOOTER_PAD_X - badgeW, fy + (FOOTER_H - badgeH) / 2, badgeH);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

/**
 * Share the card: `navigator.share` with the PNG file and the app's caption (ChatScreen.kt
 * shareImage: image/png `farmerchat_share.png` + EXTRA_TEXT caption), else download it.
 */
export async function shareAnswerCard(content: ShareCardContent, caption: string): Promise<'shared' | 'downloaded' | 'failed'> {
  const blob = await renderAnswerCard(content);
  if (!blob) return 'failed';
  const file = new File([blob], 'farmerchat_share.png', { type: 'image/png' });
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav && typeof nav.share === 'function' && (!nav.canShare || nav.canShare({ files: [file] }))) {
    try {
      await nav.share({ files: [file], text: caption });
      return 'shared';
    } catch (err) {
      // The farmer closed the share sheet: done, like dismissing Android's chooser.
      if (err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError') return 'shared';
      // Unsupported payload: fall through to a download.
    }
  }
  return downloadBlob(blob) ? 'downloaded' : 'failed';
}

/** Save the card (ChatScreen.kt downloadImage: `FarmerChat_<millis>.png`). */
export async function downloadAnswerCard(content: ShareCardContent): Promise<boolean> {
  const blob = await renderAnswerCard(content);
  if (!blob) return false;
  return downloadBlob(blob);
}

function downloadBlob(blob: Blob): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FarmerChat_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5_000);
    return true;
  } catch {
    return false;
  }
}
