import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');

// Police embarquée dans le repo : Railway (image Docker minimale) n'a souvent aucune police
// système installée, donc on ne peut pas compter sur les polices "sans-serif" du serveur.
const FONT_FAMILY = 'DejaVu Sans';
let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  GlobalFonts.registerFromPath(path.join(FONT_DIR, 'DejaVuSans.ttf'), FONT_FAMILY);
  GlobalFonts.registerFromPath(path.join(FONT_DIR, 'DejaVuSans-Bold.ttf'), `${FONT_FAMILY} Bold`);
  fontsRegistered = true;
}

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

// Rend un titre + texte sous forme d'image PNG (texte non sélectionnable/copiable),
// contrairement à un embed Discord classique dont le texte reste toujours copiable.
export function renderTextImage({ title, text, color }) {
  ensureFonts();

  const contentWidth = WIDTH - PADDING * 2 - ACCENT_WIDTH - 16;

  const measureCanvas = createCanvas(10, 10);
  const mctx = measureCanvas.getContext('2d');

  mctx.font = `bold 30px "${FONT_FAMILY} Bold"`;
  const titleLines = title ? wrapText(mctx, title, contentWidth) : [];

  mctx.font = `20px "${FONT_FAMILY}"`;
  const bodyLines = text ? wrapText(mctx, text, contentWidth) : [];

  let height = PADDING * 2;
  height += titleLines.length * 38;
  if (bodyLines.length) height += 12 + bodyLines.length * 28;
  height = Math.max(height, 120);

  const canvas = createCanvas(WIDTH, height);
  const ctx = canvas.getContext('2d');

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

  ctx.fillStyle = parseColor(color);
  ctx.fillRect(0, 0, ACCENT_WIDTH, height);

  let y = PADDING;
  const x = PADDING + ACCENT_WIDTH + 12;

  ctx.fillStyle = TEXT_COLOR;
  ctx.font = `bold 30px "${FONT_FAMILY} Bold"`;
  for (const line of titleLines) {
    y += 30;
    ctx.fillText(line, x, y);
    y += 8;
  }

  if (bodyLines.length) {
    y += 12;
    ctx.fillStyle = MUTED_COLOR;
    ctx.font = `20px "${FONT_FAMILY}"`;
    for (const line of bodyLines) {
      y += 22;
      ctx.fillText(line, x, y);
      y += 6;
    }
  }

  return canvas.toBuffer('image/png');
}
