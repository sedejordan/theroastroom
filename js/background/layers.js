/**
 * Background SVG layers for The Roast Room.
 *
 * All artwork is original, abstract and drawn with plain SVG shapes.
 * Nothing here reproduces a club crest, player likeness, sponsor or logo.
 * Colours read from the active club theme via CSS custom properties, so the
 * same layers recolour when applyTheme() runs on the room page.
 *
 * @typedef {Object} BackgroundLayer
 * @property {number} speed Parallax speed. 0 = static, 1 = scrolls with page.
 * @property {string} svg Inline SVG string.
 * @property {boolean} [fast] True for the nearest layer, hidden on small screens.
 */

const VIEW_BOX = '0 0 1200 800';

/**
 * Wrap SVG inner markup in a root svg element.
 * @param {string} inner
 * @returns {string}
 */
function wrap(inner) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEW_BOX}" ` +
    `preserveAspectRatio="xMidYMid slice" focusable="false" aria-hidden="true">` +
    inner +
    `</svg>`
  );
}

// Far layer: pitch lines and a big downward arrow (decline, no numbers, no claims).
const PITCH_AND_ARROW = wrap(`
  <g fill="none" stroke="var(--colorText)" stroke-width="2" opacity="0.18">
    <rect x="60" y="60" width="1080" height="680" />
    <line x1="600" y1="60" x2="600" y2="740" />
    <circle cx="600" cy="400" r="120" />
    <rect x="60" y="220" width="150" height="360" />
    <rect x="990" y="220" width="150" height="360" />
  </g>
  <g fill="var(--colorText)" opacity="0.06"><path d="M420 260 L600 420 L780 260 L720 260 L600 340 L480 260 Z"/><path d="M420 440 L600 600 L780 440 L720 440 L600 520 L480 440 Z"/></g>
`);

// Mid layer: a stylised broken trophy cup.
const BROKEN_TROPHY = wrap(`
  <g fill="var(--colorPrimary)" opacity="0.28">
    <path d="M480 160 L720 160 L700 340
             C700 430 650 490 600 510
             L600 590 L680 610 L680 630 L520 630 L520 610 L600 590
             L600 510 C550 490 500 430 500 340 Z" />
    <path d="M440 180 C400 180 390 230 410 270
             C430 310 470 330 500 320"
          fill="none" stroke="var(--colorPrimary)" stroke-width="14" />
    <path d="M760 180 C800 180 810 230 790 270
             C770 310 730 330 700 320"
          fill="none" stroke="var(--colorPrimary)" stroke-width="14" />
  </g>
  <path d="M600 210 L558 340 L612 362 L566 480"
        fill="none" stroke="var(--colorBackground)" stroke-width="8" opacity="0.9" />
`);

// Near layer: floating receipt and ticket stubs (on-brand with "receipts included").
const RECEIPTS = wrap(`
  <g fill="var(--colorText)" opacity="0.10">
    <rect x="120" y="120" width="120" height="160" rx="2" />
    <rect x="900" y="240" width="140" height="180" rx="2" />
    <rect x="200" y="560" width="100" height="140" rx="2" />
    <rect x="820" y="560" width="160" height="120" rx="2" />
  </g>
  <g fill="none" stroke="var(--colorText)" stroke-width="2" opacity="0.18">
    <line x1="130" y1="150" x2="230" y2="150" />
    <line x1="130" y1="170" x2="220" y2="170" />
    <line x1="130" y1="190" x2="200" y2="190" />
    <line x1="910" y1="270" x2="1030" y2="270" />
    <line x1="910" y1="290" x2="1010" y2="290" />
    <line x1="910" y1="310" x2="1040" y2="310" />
  </g>
`);

/** @type {Record<string, BackgroundLayer[]>} */
export const BACKGROUND_LAYERS = {
  manutd: [
    { speed: 0.05, svg: PITCH_AND_ARROW },
    { speed: 0.15, svg: BROKEN_TROPHY },
    { speed: 0.30, svg: RECEIPTS, fast: true },
  ],
};

/**
 * Return the background layers for a club id, falling back to Man Utd.
 * @param {string} [clubId]
 * @returns {BackgroundLayer[]}
 */
export function backgroundLayersFor(clubId) {
  return BACKGROUND_LAYERS[clubId] || BACKGROUND_LAYERS.manutd;
}