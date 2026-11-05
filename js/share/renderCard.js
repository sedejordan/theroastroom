/**
 * Draws a branded roast card with the Canvas 2D API.
 * Colours come from club.theme. No images and no remote assets are used.
 */

import { CARD_FORMATS } from './cardFormats.js';
import { fitText, truncateToWidth } from './textLayout.js';

const MARGIN = 72;
const TOP_BAND_HEIGHT = 120;
const FOOTER_HEIGHT = 112;
const FONT_DISPLAY = "Anton, 'Arial Narrow', Impact, sans-serif";
const FONT_BODY = "Inter, 'Helvetica Neue', Arial, system-ui, sans-serif";

const THEME_VARIABLES = Object.freeze({
  primary: '--colorPrimary',
  primaryContrast: '--colorPrimaryContrast',
  accent: '--colorAccent',
  background: '--colorBackground',
  surface: '--colorSurface',
  surfaceRaised: '--colorSurfaceRaised',
  line: '--colorLine',
  text: '--colorText',
  textMuted: '--colorTextMuted',
});

/**
 * Resolve a theme colour from the club theme, then from CSS tokens.
 * @param {Record<string, string>} theme Club theme.
 * @param {string} key Theme key.
 * @returns {string} Colour value or empty string.
 */
function resolveColor(theme, key) {
  const direct = theme && typeof theme[key] === 'string' ? theme[key].trim() : '';
  if (direct.length > 0) return direct;

  if (typeof document !== 'undefined' && typeof getComputedStyle === 'function') {
    const variable = THEME_VARIABLES[key];
    if (variable) {
      const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
      if (value.length > 0) return value;
    }
  }

  return '';
}

/**
 * Wait for Anton and Inter with a short timeout.
 * @param {number} timeoutMs Timeout in milliseconds.
 * @returns {Promise<void>}
 */
async function waitForFonts(timeoutMs) {
  if (
    typeof document === 'undefined' ||
    !document.fonts ||
    typeof document.fonts.load !== 'function'
  ) {
    return;
  }

  const loads = [];

  try {
    loads.push(document.fonts.load('400 64px Anton'));
    loads.push(document.fonts.load('400 32px Inter'));
    loads.push(document.fonts.load('600 32px Inter'));

    await Promise.race([
      Promise.allSettled(loads),
      new Promise((resolve) => {
        setTimeout(resolve, timeoutMs || 900);
      }),
    ]);
  } catch {
    // System fonts are used when the font set cannot load.
  }
}

/**
 * Draw the low contrast pitch line motif behind the card.
 * @param {CanvasRenderingContext2D} ctx Canvas context.
 * @param {number} width Canvas width.
 * @param {number} height Canvas height.
 * @param {string} color Stroke colour.
 * @returns {void}
 */
function drawPitchTexture(ctx, width, height, color) {
  if (!color) return;

  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  const pad = 36;
  ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);

  ctx.beginPath();
  ctx.moveTo(width / 2, pad);
  ctx.lineTo(width / 2, height - pad);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.12, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  const boxWidth = width * 0.12;
  const boxHeight = height * 0.24;
  ctx.strokeRect(pad, (height - boxHeight) / 2, boxWidth, boxHeight);
  ctx.strokeRect(width - pad - boxWidth, (height - boxHeight) / 2, boxWidth, boxHeight);

  ctx.restore();
}

/**
 * Draw the top club band.
 * @param {CanvasRenderingContext2D} ctx Canvas context.
 * @param {{
 *   width: number,
 *   safeTop: number,
 *   theme: Record<string, string>,
 *   club: Record<string, unknown>,
 *   category: Record<string, unknown> | null
 * }} options Band options.
 * @returns {void}
 */
function drawTopBand(ctx, options) {
  const { width, safeTop, theme, club, category } = options;
  const primary = resolveColor(theme, 'primary');
  const contrast = resolveColor(theme, 'primaryContrast');

  if (primary) {
    ctx.fillStyle = primary;
    ctx.fillRect(0, safeTop, width, TOP_BAND_HEIGHT);
  }

  if (!contrast) return;

  const baseline = safeTop + TOP_BAND_HEIGHT / 2;
  const maxWidth = (width - MARGIN * 2) / 2 - 24;

  ctx.save();
  ctx.fillStyle = contrast;
  ctx.font = `600 28px ${FONT_BODY}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const clubName = club && (club.shortName || club.name) ? String(club.shortName || club.name) : '';
  const clubText = clubName.toUpperCase();
  const clubLine = truncateToWidth(clubText, maxWidth, (value) => ctx.measureText(value).width);
  ctx.fillText(clubLine, MARGIN, baseline);

  const categoryText =
    category && category.displayLabel ? String(category.displayLabel).toUpperCase() : '';

  if (categoryText.length > 0) {
    ctx.textAlign = 'right';
    const categoryLine = truncateToWidth(categoryText, maxWidth, (value) =>
      ctx.measureText(value).width
    );
    ctx.fillText(categoryLine, width - MARGIN, baseline);
  }

  ctx.restore();
}

/**
 * Draw a small uppercase label.
 * @param {CanvasRenderingContext2D} ctx Canvas context.
 * @param {string} text Label text.
 * @param {number} x X position.
 * @param {number} y Y position.
 * @param {string} color Text colour.
 * @returns {void}
 */
function drawLabel(ctx, text, x, y, color) {
  if (!color) return;

  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `600 24px ${FONT_BODY}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Draw fitted headline lines.
 * @param {CanvasRenderingContext2D} ctx Canvas context.
 * @param {{ fontSize: number, lines: string[] }} fit Fitted text.
 * @param {number} top Top position.
 * @param {string} color Text colour.
 * @returns {void}
 */
function drawHeadline(ctx, fit, top, color) {
  if (!color) return;

  ctx.save();
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = `400 ${fit.fontSize}px ${FONT_DISPLAY}`;

  let y = top;
  for (const line of fit.lines) {
    ctx.fillText(line, MARGIN, y);
    y += fit.fontSize;
  }

  ctx.restore();
}

/**
 * Draw fitted explanation lines.
 * @param {CanvasRenderingContext2D} ctx Canvas context.
 * @param {{ fontSize: number, lines: string[] }} fit Fitted text.
 * @param {number} top Top position.
 * @param {string} color Text colour.
 * @returns {void}
 */
function drawExplanation(ctx, fit, top, color) {
  if (!color) return;

  ctx.save();
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = `400 ${fit.fontSize}px ${FONT_BODY}`;

  let y = top;
  for (const line of fit.lines) {
    ctx.fillText(line, MARGIN, y);
    y += fit.fontSize * 1.35;
  }

  ctx.restore();
}

/**
 * Draw the dashed perforation and side notches.
 * @param {CanvasRenderingContext2D} ctx Canvas context.
 * @param {number} width Canvas width.
 * @param {number} y Perforation y position.
 * @param {Record<string, string>} theme Club theme.
 * @returns {void}
 */
function drawPerforation(ctx, width, y, theme) {
  const line = resolveColor(theme, 'line');
  const background = resolveColor(theme, 'background');

  if (line) {
    ctx.save();
    ctx.strokeStyle = line;
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 12]);
    ctx.beginPath();
    ctx.moveTo(MARGIN, y);
    ctx.lineTo(width - MARGIN, y);
    ctx.stroke();
    ctx.restore();
  }

  if (background) {
    ctx.save();
    ctx.fillStyle = background;

    ctx.beginPath();
    ctx.arc(0, y, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(width, y, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

/**
 * Read the hostname from an evidence source URL.
 * @param {{ sourceUrl?: string } | null} evidence Evidence item.
 * @returns {string} Hostname or empty string.
 */
function sourceHost(evidence) {
  if (!evidence || typeof evidence.sourceUrl !== 'string') return '';
  try {
    return new URL(evidence.sourceUrl).hostname;
  } catch {
    return '';
  }
}

/**
 * Draw the source line and hostname.
 * @param {CanvasRenderingContext2D} ctx Canvas context.
 * @param {{ sourceName?: string, period?: string, sourceUrl?: string } | null} evidence First evidence item.
 * @param {number} top Top position.
 * @param {number} width Canvas width.
 * @param {Record<string, string>} theme Club theme.
 * @returns {void}
 */
function drawSource(ctx, evidence, top, width, theme) {
  const muted = resolveColor(theme, 'textMuted');
  if (!evidence || !muted) return;

  ctx.save();
  ctx.fillStyle = muted;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  ctx.font = `600 26px ${FONT_BODY}`;
  const sourceText = `Source: ${String(evidence.sourceName || '')}, ${String(
    evidence.period || ''
  )}`;
  const sourceLine = truncateToWidth(sourceText, width - MARGIN * 2, (value) =>
    ctx.measureText(value).width
  );
  ctx.fillText(sourceLine, MARGIN, top);

  const host = sourceHost(evidence);
  if (host.length > 0) {
    ctx.font = `400 22px ${FONT_BODY}`;
    const hostLine = truncateToWidth(host, width - MARGIN * 2, (value) =>
      ctx.measureText(value).width
    );
    ctx.fillText(hostLine, MARGIN, top + 38);
  }

  ctx.restore();
}

/**
 * Draw the footer wordmark, host and checked date.
 * @param {CanvasRenderingContext2D} ctx Canvas context.
 * @param {{
 *   width: number,
 *   top: number,
 *   theme: Record<string, string>,
 *   host: string,
 *   verifiedOn: string
 * }} options Footer options.
 * @returns {void}
 */
function drawFooter(ctx, options) {
  const { width, top, theme, host, verifiedOn } = options;
  const text = resolveColor(theme, 'text');
  const muted = resolveColor(theme, 'textMuted');

  if (text) {
    ctx.save();
    ctx.fillStyle = text;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.font = `400 42px ${FONT_DISPLAY}`;
    ctx.fillText('THE ROAST ROOM', MARGIN, top);
    ctx.restore();
  }

  if (muted) {
    ctx.save();
    ctx.fillStyle = muted;
    ctx.textBaseline = 'top';

    ctx.textAlign = 'right';
    ctx.font = `600 24px ${FONT_BODY}`;
    const hostText = truncateToWidth(String(host || ''), width * 0.4, (value) =>
      ctx.measureText(value).width
    );
    ctx.fillText(hostText, width - MARGIN, top + 8);

    ctx.textAlign = 'left';
    ctx.font = `400 22px ${FONT_BODY}`;
    const checked = `Checked ${String(verifiedOn || '')}`.trim();
    if (checked.length > 0) {
      ctx.fillText(checked, MARGIN, top + 56);
    }

    ctx.restore();
  }
}

/**
 * Render one roast card into a canvas.
 * Never throws. Returns font sizes and whether text was truncated.
 * @param {{
 *   canvas: HTMLCanvasElement,
 *   roast: Record<string, unknown>,
 *   category: Record<string, unknown> | null,
 *   club: Record<string, unknown>,
 *   format: { id: string, label: string, width: number, height: number, safeTop: number, safeBottom: number },
 *   host: string
 * }} options Render options.
 * @returns {Promise<{ truncated: boolean, headlineFontSize: number, explanationFontSize: number }>} Render result.
 */
export async function renderRoastCard(options) {
  const fallback = { truncated: true, headlineFontSize: 0, explanationFontSize: 0 };

  try {
    const { canvas, roast, category, club, format, host } = options || {};

    if (!canvas || typeof canvas.getContext !== 'function' || !roast) return fallback;

    const chosen =
      format && Number.isFinite(format.width) && Number.isFinite(format.height)
        ? format
        : CARD_FORMATS.post;

    canvas.width = chosen.width;
    canvas.height = chosen.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return fallback;

    await waitForFonts(900);

    const theme = club && club.theme ? club.theme : {};
    const background = resolveColor(theme, 'background');
    const text = resolveColor(theme, 'text');
    const accent = resolveColor(theme, 'accent');

    if (background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, chosen.width, chosen.height);
    }

    drawPitchTexture(ctx, chosen.width, chosen.height, text);
    drawTopBand(ctx, {
      width: chosen.width,
      safeTop: chosen.safeTop,
      theme,
      club,
      category,
    });

    const contentBottom = chosen.height - chosen.safeBottom - MARGIN;
    const contentTop = chosen.safeTop + TOP_BAND_HEIGHT + 48;

    drawLabel(ctx, 'THE JOKE', MARGIN, contentTop, accent);

    const headlineTop = contentTop + 48;
    const headlineBoxHeight = chosen.height * (chosen.id === 'story' ? 0.34 : 0.38);
    const measureAnton = (value, size) => {
      ctx.font = `400 ${size}px ${FONT_DISPLAY}`;
      return ctx.measureText(value).width;
    };

    const headlineFit = fitText({
      text: String(roast.headline || '').toUpperCase(),
      maxWidth: chosen.width - MARGIN * 2,
      maxHeight: headlineBoxHeight,
      maxLines: 8,
      minFontSize: 64,
      maxFontSize: 140,
      step: 4,
      lineHeightRatio: 1,
      measure: measureAnton,
    });

    drawHeadline(ctx, headlineFit, headlineTop, text);

    const headlineHeight = headlineFit.lines.length * headlineFit.fontSize;
    const perforationY = headlineTop + headlineHeight + 48;

    drawPerforation(ctx, chosen.width, perforationY, theme);

    const receiptLabelY = perforationY + 48;
    drawLabel(ctx, 'THE RECEIPT', MARGIN, receiptLabelY, accent);

    const footerTop = contentBottom - FOOTER_HEIGHT;
    const explanationTop = receiptLabelY + 48;
    const sourceReserve = 26 + 12 + 22 + 32;
    const explanationMaxHeight = Math.max(60, footerTop - explanationTop - sourceReserve);
    const measureInter = (value, size) => {
      ctx.font = `400 ${size}px ${FONT_BODY}`;
      return ctx.measureText(value).width;
    };

    const explanationFit = fitText({
      text: String(roast.explanation || ''),
      maxWidth: chosen.width - MARGIN * 2,
      maxHeight: explanationMaxHeight,
      maxLines: 8,
      minFontSize: 30,
      maxFontSize: 42,
      step: 2,
      lineHeightRatio: 1.35,
      measure: measureInter,
    });

    drawExplanation(ctx, explanationFit, explanationTop, text);

    const explanationHeight = explanationFit.lines.length * explanationFit.fontSize * 1.35;
    const evidence =
      Array.isArray(roast.evidence) && roast.evidence.length > 0 ? roast.evidence[0] : null;

    drawSource(ctx, evidence, explanationTop + explanationHeight + 24, chosen.width, theme);

    drawFooter(ctx, {
      width: chosen.width,
      top: footerTop,
      theme,
      host,
      verifiedOn: roast.verifiedOn,
    });

    return {
      truncated: headlineFit.truncated || explanationFit.truncated,
      headlineFontSize: headlineFit.fontSize,
      explanationFontSize: explanationFit.fontSize,
    };
  } catch (error) {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[roastRoom] could not render the share card', error);
    }
    return fallback;
  }
}