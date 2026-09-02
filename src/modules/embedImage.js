import { createCanvas } from '@napi-rs/canvas';

const WIDTH = 900;
const PADDING = 32;
const ACCENT_WIDTH = 6;
const BG_COLOR = '#2b2d31';
const TEXT_COLOR = '#f2f3f5';
const MUTED_COLOR = '#b5bac1';

function parseColor(raw) {
  if (!raw) return '#5865F2';
  const hex = raw.trim();
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#5865F2';
}

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph) {
      lines.push('');
      continue;
    }
    const words = paragraph.split(' ');
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

// Rend le brouillon d'embed sous forme d'image PNG (texte non sélectionnable/copiable),
// contrairement à un embed Discord classique dont le texte reste toujours copiable.
export function renderEmbedImage(draft) {
  const contentWidth = WIDTH - PADDING * 2 - ACCENT_WIDTH - 16;

  const measureCanvas = createCanvas(10, 10);
  const mctx = measureCanvas.getContext('2d');

  mctx.font = 'bold 30px sans-serif';
  const titleLines = draft.title ? wrapText(mctx, draft.title, contentWidth) : [];

  mctx.font = '20px sans-serif';
  const bodyLines = draft.description ? wrapText(mctx, draft.description, contentWidth) : [];

  mctx.font = '16px sans-serif';
  const footerLines = draft.footerText ? wrapText(mctx, draft.footerText, contentWidth) : [];

  const fieldLines = [];
  for (const field of draft.fields ?? []) {
    mctx.font = 'bold 17px sans-serif';
    fieldLines.push({ type: 'name', text: field.name });
    mctx.font = '17px sans-serif';
    for (const line of wrapText(mctx, field.value, contentWidth)) {
      fieldLines.push({ type: 'value', text: line });
    }
  }

  let height = PADDING * 2;
  if (draft.authorName) height += 30;
  height += titleLines.length * 38;
  if (bodyLines.length) height += 12 + bodyLines.length * 28;
  if (fieldLines.length) height += 16 + fieldLines.length * 24;
  if (footerLines.length) height += 20 + footerLines.length * 22;
  height = Math.max(height, 120);

  const canvas = createCanvas(WIDTH, height);
  const ctx = canvas.getContext('2d');

  // Fond arrondi
  const radius = 16;
  ctx.fillStyle = BG_COLOR;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.arcTo(WIDTH, 0, WIDTH, height, radius);
  ctx.arcTo(WIDTH, height, 0, height, radius);
  ctx.arcTo(0, height, 0, 0, radius);
  ctx.arcTo(0, 0, WIDTH, 0, radius);
  ctx.closePath();
  ctx.fill();

  // Barre d'accent façon embed Discord
  ctx.fillStyle = parseColor(draft.color);
  ctx.fillRect(0, 0, ACCENT_WIDTH, height);

  let y = PADDING;
  const x = PADDING + ACCENT_WIDTH + 12;

  if (draft.authorName) {
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(draft.authorName, x, y + 14);
    y += 30;
  }

  ctx.fillStyle = TEXT_COLOR;
  ctx.font = 'bold 30px sans-serif';
  for (const line of titleLines) {
    y += 30;
    ctx.fillText(line, x, y);
    y += 8;
  }

  if (bodyLines.length) {
    y += 12;
    ctx.fillStyle = MUTED_COLOR;
    ctx.font = '20px sans-serif';
    for (const line of bodyLines) {
      y += 22;
      ctx.fillText(line, x, y);
      y += 6;
    }
  }

  if (fieldLines.length) {
    y += 16;
    for (const entry of fieldLines) {
      y += 20;
      if (entry.type === 'name') {
        ctx.fillStyle = TEXT_COLOR;
        ctx.font = 'bold 17px sans-serif';
      } else {
        ctx.fillStyle = MUTED_COLOR;
        ctx.font = '17px sans-serif';
      }
      ctx.fillText(entry.text, x, y);
      y += 4;
    }
  }

  if (footerLines.length) {
    y += 20;
    ctx.fillStyle = MUTED_COLOR;
    ctx.font = '16px sans-serif';
    for (const line of footerLines) {
      y += 18;
      ctx.fillText(line, x, y);
      y += 4;
    }
  }

  return canvas.toBuffer('image/png');
}
