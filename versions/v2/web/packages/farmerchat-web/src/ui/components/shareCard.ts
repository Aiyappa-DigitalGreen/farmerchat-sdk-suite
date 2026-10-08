/**
 * ShareCard — renders a question+answer card to a PNG via canvas, then shares
 * it with navigator.share (files) or triggers a download (docs/03 fidelity
 * map: "canvas + navigator.share/download"; app: graphicsLayer → PNG).
 */

import { ICONS } from '../icons';

// ChatScreen.kt ShareCard: 360dp wide, rendered at 2×.
const SCALE = 2;
const CARD_WIDTH = 360;
const PADDING = 24;
const FONT = '"FC Roboto", Roboto, "Noto Sans", system-ui, sans-serif';

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph.trim() === '') {
      out.push('');
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

/** Strips markdown decorations for the flat canvas rendering. */
function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?/g, ''))
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
}

/**
 * ShareCard: a #008236 column (padding 24, gap 16) — white 28dp mark + "FarmerChat" titleMedium,
 * the question in titleSmall #00C950, the answer on a white radius-16 card (padding 16, black
 * bodyMedium), and "Answered by FarmerChat" labelSmall. Markdown is flattened for the canvas.
 */
export async function renderAnswerCard(question: string, answer: string, appName: string, footer?: string): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  try {
    await Promise.all([
      document.fonts?.load(`700 18px ${FONT}`),
      document.fonts?.load(`400 17px ${FONT}`),
      document.fonts?.load(`600 13px ${FONT}`),
    ]);
  } catch {
    // Fall back to whatever the system renders.
  }

  const inner = CARD_WIDTH - PADDING * 2;
  const headerFont = `700 18px ${FONT}`;
  const questionFont = `700 16px ${FONT}`;
  const answerFont = `400 17px ${FONT}`;
  const footerFont = `600 13px ${FONT}`;

  ctx.font = questionFont;
  const questionLines = wrapText(ctx, plainText(question), inner);
  ctx.font = answerFont;
  const answerLines = wrapText(ctx, plainText(answer), inner - 32);

  const headerH = 28;
  const questionH = questionLines.length * 22;
  const answerH = 16 + answerLines.length * 25 + 16;
  const footerH = 18;
  const height = PADDING + headerH + 16 + questionH + 16 + answerH + 16 + footerH + PADDING;

  canvas.width = CARD_WIDTH * SCALE;
  canvas.height = height * SCALE;
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#008236';
  ctx.fillRect(0, 0, CARD_WIDTH, height);

  // Header: logo mark + app name.
  let y = PADDING;
  const mark = ICONS.logo_mark;
  ctx.save();
  ctx.translate(PADDING, y);
  ctx.scale(28 / mark.vw, 28 / mark.vh);
  ctx.fillStyle = '#FFFFFF';
  for (const p of mark.paths) ctx.fill(new Path2D(p.d));
  ctx.restore();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = headerFont;
  ctx.fillText(appName, PADDING + 28 + 8, y + headerH / 2);
  y += headerH + 16;

  ctx.fillStyle = '#00C950';
  ctx.font = questionFont;
  questionLines.forEach((line, i) => ctx.fillText(line, PADDING, y + i * 22 + 11));
  y += questionH + 16;

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(PADDING, y, inner, answerH, 16);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.font = answerFont;
  answerLines.forEach((line, i) => ctx.fillText(line, PADDING + 16, y + 16 + i * 25 + 12.5));
  y += answerH + 16;

  ctx.fillStyle = '#FFFFFF';
  ctx.font = footerFont;
  ctx.fillText(footer ?? `Answered by ${appName}`, PADDING, y + footerH / 2);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

/** Share via navigator.share(files) with clipboard-less download fallback. */
export async function shareAnswerCard(question: string, answer: string, appName: string, footer?: string): Promise<'shared' | 'downloaded' | 'failed'> {
  const blob = await renderAnswerCard(question, answer, appName, footer);
  if (!blob) return 'failed';
  const file = new File([blob], 'farmerchat-answer.png', { type: 'image/png' });
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav && typeof nav.share === 'function' && (!nav.canShare || nav.canShare({ files: [file] }))) {
    try {
      await nav.share({ files: [file], title: appName, text: footer });
      return 'shared';
    } catch {
      // user cancel / unsupported — fall through to download
    }
  }
  return downloadBlob(blob) ? 'downloaded' : 'failed';
}

export async function downloadAnswerCard(question: string, answer: string, appName: string, footer?: string): Promise<boolean> {
  const blob = await renderAnswerCard(question, answer, appName, footer);
  if (!blob) return false;
  return downloadBlob(blob);
}

function downloadBlob(blob: Blob): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `farmerchat-answer-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5_000);
    return true;
  } catch {
    return false;
  }
}
