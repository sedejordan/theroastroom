/**
 * Logic for the developer only card lab page.
 * Renders every roast of every live club in both formats.
 */

import { CARD_FORMATS } from '../share/cardFormats.js';
import { SHARE_HOST_OVERRIDE } from '../share/shareConfig.js';
import { renderRoastCard } from '../share/renderCard.js';
import { hostLabel } from '../share/shareText.js';
import { getLiveClubs, loadClub, loadRegistry } from '../registry.js';
import { clear, createElement } from '../utils/dom.js';

const summaryEl = document.getElementById('cardLabSummary');
const warningEl = document.getElementById('cardLabWarning');
const gridEl = document.getElementById('cardLabGrid');

/**
 * Set the summary line.
 * @param {string} text Summary text.
 * @returns {void}
 */
function setSummary(text) {
  if (summaryEl) summaryEl.textContent = text;
}

/**
 * Show the warning badge area.
 * @param {string} text Warning text.
 * @returns {void}
 */
function showWarning(text) {
  if (!warningEl) return;
  warningEl.textContent = text;
  warningEl.classList.remove('hidden');
}

/**
 * Hide the warning badge area.
 * @returns {void}
 */
function hideWarning() {
  if (!warningEl) return;
  warningEl.classList.add('hidden');
}

/**
 * Build one card holder in the grid.
 * @param {Record<string, unknown>} club Club data.
 * @param {Record<string, unknown>} roast Roast data.
 * @param {{ id: string, label: string, width: number, height: number }} format Card format.
 * @returns {{ card: HTMLElement, canvas: HTMLCanvasElement, meta: HTMLElement }} Holder.
 */
function buildHolder(club, roast, format) {
  const card = createElement('article', {
    className: 'rounded-sharp border border-line bg-surface p-4',
  });

  const title = createElement('h2', {
    className: 'font-display text-lg uppercase text-text',
    text: `${String(club.shortName || club.name || '')} ${format.label}`,
  });

  const canvas = createElement('canvas', {
    className: 'mt-3 block w-full',
    attrs: {
      role: 'img',
      'aria-label': `Roast card ${format.label} for ${String(roast.headline || '')}`,
    },
  });

  canvas.style.width = '100%';
  canvas.style.height = 'auto';
  canvas.style.maxHeight = '320px';
  canvas.style.objectFit = 'contain';
  canvas.style.backgroundColor = 'var(--colorBackground)';

  const meta = createElement('p', {
    className: 'mt-2 text-xs text-textMuted',
    text: 'Rendering',
  });

  card.append(title, canvas, meta);
  gridEl.append(card);

  return { card, canvas, meta };
}

/**
 * Start the card lab.
 * @returns {Promise<void>}
 */
async function init() {
  if (!gridEl) return;

  clear(gridEl);
  hideWarning();

  let rendered = 0;
  let truncatedCount = 0;
  let failed = 0;

  try {
    const registry = await loadRegistry();
    const live = getLiveClubs(registry);
    const host = hostLabel(window.location.host, SHARE_HOST_OVERRIDE);

    for (const entry of live) {
      let club;

      try {
        club = await loadClub(entry.id);
      } catch {
        failed += 1;
        continue;
      }

      const roasts = Array.isArray(club.roasts) ? club.roasts : [];
      const categories = Array.isArray(club.categories) ? club.categories : [];

      for (const roast of roasts) {
        const category =
          categories.find((item) => item && item.id === roast.category) || null;

        for (const format of Object.values(CARD_FORMATS)) {
          const holder = buildHolder(club, roast, format);

          try {
            const result = await renderRoastCard({
              canvas: holder.canvas,
              roast,
              category,
              club,
              format,
              host,
            });

            rendered += 1;

            if (result.truncated) {
              truncatedCount += 1;
              holder.meta.textContent = `Headline ${result.headlineFontSize} / Explanation ${result.explanationFontSize} / TRUNCATED`;
              const badge = createElement('span', {
                className:
                  'ml-2 inline-block rounded-sharp bg-primary px-2 py-1 text-xs font-bold text-primaryContrast',
                text: 'TRUNCATED',
              });
              holder.meta.append(badge);
              holder.card.classList.add('border-primary');
            } else {
              holder.meta.textContent = `Headline ${result.headlineFontSize} / Explanation ${result.explanationFontSize}`;
            }
          } catch {
            failed += 1;
            holder.meta.textContent = 'Render failed';
          }
        }
      }
    }
  } catch {
    setSummary('Could not load the card lab data. Serve the site over http and reload.');
    showWarning('Card lab could not start.');
    return;
  }

  const failedText = failed > 0 ? `, ${failed} failed` : '';
  setSummary(`${rendered} cards rendered, ${truncatedCount} truncated${failedText}`);

  if (truncatedCount > 0) {
    showWarning(`${truncatedCount} card(s) are truncated. Check the font sizes and content.`);
  } else {
    hideWarning();
  }
}

init();