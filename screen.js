// screen.js — animated retro screen rendered to a 2D canvas, used as a
// CanvasTexture by main.js. The whole canvas IS the screen: most of it is
// black (the lit screen, with rounded outer corners formed by transparent
// regions that reveal the white body behind the plane).
//
// The text shown inside the screen swaps with the active route — home
// shows "my digital crib", work/studio/contact show their own short
// labels. Transitions cross-fade so the CRT feels alive without flicker.

const W = 1024;
const H = 880;

const CREAM = '#fafaf6';
const INK   = '#0a0a0a';

const easeOut = t => 1 - Math.pow(1 - t, 3);
const clamp01 = x => Math.max(0, Math.min(1, x));

const ROUTE_LABELS = {
  home:    ['my', 'digital', 'crib'],
  work:    ['selected', 'work'],
  studio:  ['the', 'studio'],
  contact: ['say', 'hello'],
};

const STATE = {
  current:  ROUTE_LABELS.home,
  previous: null,
  changedAt: -10, // seconds
};

const TRANSITION = 0.45; // seconds for crossfade

export function createScreenCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  return canvas;
}

export function setScreenLabel(routeOrLines, t = 0) {
  const lines = Array.isArray(routeOrLines)
    ? routeOrLines
    : (ROUTE_LABELS[routeOrLines] || ROUTE_LABELS.home);

  if (sameLabel(lines, STATE.current)) return;
  STATE.previous  = STATE.current;
  STATE.current   = lines;
  STATE.changedAt = t;
}

function sameLabel(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function drawScreen(ctx, t) {
  // transparent canvas — corners outside the rounded screen show through
  ctx.clearRect(0, 0, W, H);

  // ── black rounded screen ──────────────────────────────────────────
  const margin = 14;
  const radius = 110;
  ctx.save();
  roundedRectPath(ctx, margin, margin, W - margin * 2, H - margin * 2, radius);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.clip();

  // ── brand text — fades + crossfades on route change ──────────────
  const boot  = easeOut(Math.min(1, t / 0.6));
  const pulse = 0.94 + 0.06 * Math.sin(t * 0.7);
  const tT    = clamp01((t - STATE.changedAt) / TRANSITION);

  ctx.fillStyle = CREAM;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // outgoing label fades out + slides up slightly
  if (STATE.previous && tT < 1) {
    const a = (1 - tT) * boot * pulse;
    const slide = -tT * 28;
    drawLabel(ctx, STATE.previous, a, slide);
  }

  // incoming (= current) label fades in + slides up into place
  {
    const a = tT * boot * pulse;
    const slide = (1 - tT) * 28;
    drawLabel(ctx, STATE.current, a, slide);
  }

  ctx.globalAlpha = 1;

  // ── soft inner vignette + scanlines for CRT feel ─────────────────
  drawVignette(ctx);
  drawScanlines(ctx);

  ctx.restore();
}

function drawLabel(ctx, lines, alpha, dy) {
  if (alpha <= 0.001) return;
  ctx.globalAlpha = alpha;
  // size depends on number of lines so 2-line labels read as big as 3-line
  const fontPx = lines.length >= 3 ? 188 : 220;
  const lineH  = lines.length >= 3 ? 174 : 200;
  ctx.font = `900 ${fontPx}px "Inter", system-ui, sans-serif`;
  const cy = H / 2 + dy;
  const totalH = lineH * (lines.length - 1);
  const startY = cy - totalH / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], W / 2, startY + i * lineH);
  }
}

function drawScanlines(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = INK;
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  ctx.restore();
}

function drawVignette(ctx) {
  const grad = ctx.createRadialGradient(
    W/2, H/2, Math.min(W, H) * 0.30,
    W/2, H/2, Math.max(W, H) * 0.65
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function roundedRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}
