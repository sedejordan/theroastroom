/**
 * Developer page that renders og.png and apple_touch_icon.png on canvases and
 * wires up the Download buttons. Uses the Man United theme from
 * data/clubs/manutd.json. Never throws.
 */

import { canvasToBlob, downloadBlob } from '../share/actions.js';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const ICON_SIZE = 180;
const FONT_DISPLAY = "Anton, 'Arial Narrow', Impact, sans-serif";
const FONT_BODY = "Inter, 'Helvetica Neue', Arial, system-ui, sans-serif";

/**
 * Wait for Anton and Inter with a short timeout, mirroring the share card
 * renderer.
 * @param {number} timeoutMs
 * @returns {Promise<void>}
 */
async function waitForFonts(timeoutMs) {
  if (typeof document === 'undefined' || !document.fonts || typeof document.fonts.load !== 'function') {
    return;
  }
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('400 96px Anton'),
        document.fonts.load('400 72px Anton'),
        document.fonts.load('400 32px Inter'),
      ]),
      new Promise((resolve) => {
        setTimeout(resolve, timeoutMs || 900);
      }),
    ]);
  } catch {
    // System fonts are used if the font set cannot load.
  }
}

/**
 * Fetch the Man United theme from the club data, with a safe fallback.
 * @returns {Promise<Record<string, string>>}
 */
async function loadTheme() {
  try {
    const response = await fetch('./data/clubs/manutd.json', {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('bad response');
    const data = await response.json();
    if (data && typeof data === 'object' && data.theme && typeof data.theme === 'object') {
      return data.theme;
    }
  } catch {
    // Fall through to the defaults below.
  }
  return {
    primary: '#DA291C',
    primaryContrast: '#FFFFFF',
    accent: '#FBE122',
    background: '#0A0A0A',
    surface: '#141414',
    surfaceRaised: '#1C1C1C',
    line: '#2A2A2A',
    text: '#F5F5F5',
    textMuted: '#A0A0A0',
  };
}

/**
 * Draw the low opacity pitch line motif.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {string} color
 * @returns {void}
 */
function drawPitchMotif(ctx, width, height, color) {
  if (!color) return;
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, width - 48, height - 48);
  ctx.beginPath();
  ctx.moveTo(width / 2, 24);
  ctx.lineTo(width / 2, height - 24);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw the 1200 by 630 social preview.
 * @param {HTMLCanvasElement} canvas
 * @param {Record<string, string>} theme
 * @returns {void}
 */
function drawOg(canvas, theme) {
  canvas.width = OG_WIDTH;
  canvas.height = OG_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = theme.background || '#0A0A0A';
  ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);

  drawPitchMotif(ctx, OG_WIDTH, OG_HEIGHT, theme.text || '#F5F5F5');

  // Club colour band along the top edge.
  ctx.fillStyle = theme.primary || '#DA291C';
  ctx.fillRect(0, 0, OG_WIDTH, 12);

  // Wordmark.
  ctx.fillStyle = theme.text || '#F5F5F5';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `400 96px ${FONT_DISPLAY}`;
  ctx.fillText('THE ROAST ROOM', 80, 190);

  // Main tagline.
  ctx.font = `400 72px ${FONT_DISPLAY}`;
  ctx.fillText('Every rivalry needs receipts.', 80, 300);

  // Sub line in the accent colour.
  ctx.fillStyle = theme.accent || '#FBE122';
  ctx.font = `400 32px ${FONT_BODY}`;
  ctx.fillText('Sourced, dated football banter', 80, 390);

  // Muted host label in the corner.
  ctx.fillStyle = theme.textMuted || '#A0A0A0';
  ctx.font = `400 26px ${FONT_BODY}`;
  ctx.fillText('roastroom.fritt.org', 80, OG_HEIGHT - 60);
}

/**
 * Draw the 180 by 180 app icon from the same flame geometry as favicon.svg.
 * @param {HTMLCanvasElement} canvas
 * @param {Record<string, string>} theme
 * @returns {void}
 */
function drawIcon(canvas, theme) {
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const scale = ICON_SIZE / 64;
  const radius = 14 * scale;

  ctx.fillStyle = theme.primary || '#DA291C';
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(ICON_SIZE - radius, 0);
  ctx.quadraticCurveTo(ICON_SIZE, 0, ICON_SIZE, radius);
  ctx.lineTo(ICON_SIZE, ICON_SIZE - radius);
  ctx.quadraticCurveTo(ICON_SIZE, ICON_SIZE, ICON_SIZE - radius, ICON_SIZE);
  ctx.lineTo(radius, ICON_SIZE);
  ctx.quadraticCurveTo(0, ICON_SIZE, 0, ICON_SIZE - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = theme.accent || '#FBE122';
  ctx.beginPath();
  ctx.moveTo(32 * scale, 10 * scale);
  ctx.bezierCurveTo(30 * scale, 18 * scale, 20 * scale, 22 * scale, 20 * scale, 34 * scale);
  ctx.bezierCurveTo(20 * scale, 44 * scale, 26 * scale, 52 * scale, 32 * scale, 54 * scale);
  ctx.bezierCurveTo(38 * scale, 52 * scale, 44 * scale, 44 * scale, 44 * scale, 34 * scale);
  ctx.bezierCurveTo(44 * scale, 22 * scale, 34 * scale, 18 * scale, 32 * scale, 10 * scale);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = theme.primary || '#DA291C';
  ctx.beginPath();
  ctx.moveTo(32 * scale, 30 * scale);
  ctx.bezierCurveTo(30 * scale, 36 * scale, 26 * scale, 38 * scale, 26 * scale, 44 * scale);
  ctx.bezierCurveTo(26 * scale, 48 * scale, 28 * scale, 50 * scale, 32 * scale, 52 * scale);
  ctx.bezierCurveTo(36 * scale, 50 * scale, 38 * scale, 48 * scale, 38 * scale, 44 * scale);
  ctx.bezierCurveTo(38 * scale, 38 * scale, 34 * scale, 36 * scale, 32 * scale, 30 * scale);
  ctx.closePath();
  ctx.fill();
}

/**
 * Wire a download button to a canvas. Never throws.
 * @param {HTMLButtonElement | null} button
 * @param {HTMLCanvasElement | null} canvas
 * @param {string} fileName
 * @param {HTMLElement | null} status
 * @returns {void}
 */
function wireDownload(button, canvas, fileName, status) {
  if (!button || !canvas) return;
  button.addEventListener('click', async () => {
    if (status) status.textContent = 'Preparing image';
    try {
      const result = await canvasToBlob(canvas);
      if (!result.ok || !result.blob) {
        if (status) status.textContent = 'Could not prepare the image.';
        return;
      }
      const download = downloadBlob(result.blob, fileName);
      if (status) {
        status.textContent = download.ok ? `Saved ${fileName}` : 'Could not save the image.';
      }
    } catch {
      if (status) status.textContent = 'Could not save the image.';
    }
  });
}

/**
 * Start the page.
 * @returns {Promise<void>}
 */
async function init() {
  const ogCanvas = document.getElementById('ogCanvas');
  const iconCanvas = document.getElementById('iconCanvas');
  if (!(ogCanvas instanceof HTMLCanvasElement) || !(iconCanvas instanceof HTMLCanvasElement)) {
    return;
  }

  await waitForFonts(900);
  const theme = await loadTheme();

  drawOg(ogCanvas, theme);
  drawIcon(iconCanvas, theme);

  wireDownload(
    document.getElementById('downloadOg'),
    ogCanvas,
    'og.png',
    document.getElementById('ogStatus')
  );
  wireDownload(
    document.getElementById('downloadIcon'),
    iconCanvas,
    'apple_touch_icon.png',
    document.getElementById('iconStatus')
  );
}

init();