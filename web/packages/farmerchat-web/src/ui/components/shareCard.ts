/**
 * ShareCard — renders a question+answer card to a PNG via canvas, then shares
 * it with navigator.share (files) or triggers a download (docs/03 fidelity
 * map: "canvas + navigator.share/download"; app: graphicsLayer → PNG).
 */

const CARD_WIDTH = 720;
const PADDING = 44;
const BRAND = '#146152';
const BRAND_DEEP = '#0e4a3e';

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

export async function renderAnswerCard(question: string, answer: string, appName: string): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const contentWidth = CARD_WIDTH - PADDING * 2;
  const questionFont = '600 30px system-ui, sans-serif';
  const answerFont = '400 25px system-ui, sans-serif';

  // Measure pass.
  ctx.font = questionFont;
  const questionLines = wrapText(ctx, plainText(question), contentWidth);
  ctx.font = answerFont;
  const answerLines = wrapText(ctx, plainText(answer), contentWidth).slice(0, 60);

  const headerH = 96;
  const questionH = questionLines.length * 40 + 30;
  const answerH = answerLines.length * 36 + 40;
  const footerH = 76;
  const height = headerH + questionH + answerH + footerH;

  const scale = 2;
  canvas.width = CARD_WIDTH * scale;
  canvas.height = height * scale;
  ctx.scale(scale, scale);

  // Background.
  ctx.fillStyle = '#f7f5ef';
  ctx.fillRect(0, 0, CARD_WIDTH, height);

  // Header band.
  const grad = ctx.createLinearGradient(0, 0, CARD_WIDTH, 0);
  grad.addColorStop(0, BRAND_DEEP);
  grad.addColorStop(1, BRAND);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_WIDTH, headerH);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 32px system-ui, sans-serif';
  ctx.fillText(`🌱 ${appName}`, PADDING, 60);

  // Question.
  let y = headerH + 52;
  ctx.fillStyle = BRAND_DEEP;
  ctx.font = questionFont;
  for (const line of questionLines) {
    ctx.fillText(line, PADDING, y);
    y += 40;
  }
  y += 14;

  // Divider.
  ctx.strokeStyle = '#d8d2c2';
  ctx.beginPath();
  ctx.moveTo(PADDING, y - 22);
  ctx.lineTo(CARD_WIDTH - PADDING, y - 22);
  ctx.stroke();

  // Answer.
  ctx.fillStyle = '#243830';
  ctx.font = answerFont;
  for (const line of answerLines) {
    ctx.fillText(line, PADDING, y);
    y += 36;
  }

  // Footer.
  ctx.fillStyle = '#7a8a83';
  ctx.font = '400 20px system-ui, sans-serif';
  ctx.fillText('© Digital Green', PADDING, height - 30);

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

/** Share via navigator.share(files) with clipboard-less download fallback. */
export async function shareAnswerCard(question: string, answer: string, appName: string): Promise<'shared' | 'downloaded' | 'failed'> {
  const blob = await renderAnswerCard(question, answer, appName);
  if (!blob) return 'failed';
  const file = new File([blob], 'farmerchat-answer.png', { type: 'image/png' });
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav && typeof nav.share === 'function' && (!nav.canShare || nav.canShare({ files: [file] }))) {
    try {
      await nav.share({ files: [file], title: appName });
      return 'shared';
    } catch {
      // user cancel / unsupported — fall through to download
    }
  }
  return downloadBlob(blob) ? 'downloaded' : 'failed';
}

export async function downloadAnswerCard(question: string, answer: string, appName: string): Promise<boolean> {
  const blob = await renderAnswerCard(question, answer, appName);
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
