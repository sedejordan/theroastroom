/**
 * Landing page logic.
 * Renders the club picker from the registry, the recent roast ticker and the
 * hero call to action target, all from data files at runtime.
 */

import { initSuggestSection } from '../suggest/suggestSection.js';
import { applyFrittLinks } from '../brand/applyFrittLinks.js';
import { DEFAULT_CLUB_ID } from '../config.js';
import { getComingSoonClubs, getLiveClubs, loadClub, loadRegistry } from '../registry.js';
import { clear, createElement } from '../utils/dom.js';
import { initScrollBackground } from '../background/scrollBackground.js';
import { backgroundLayersFor } from '../background/layers.js';

const liveContainer = document.getElementById('liveClubs');
const comingSoonContainer = document.getElementById('comingSoonClubs');
const tickerSection = document.getElementById('tickerSection');
const tickerTrack = document.getElementById('tickerTrack');

/**
 * Point every CTA at the default club from config.
 * @returns {void}
 */
function setCallToActions() {
  const links = document.querySelectorAll('[data-cta-club]');
  for (const link of links) {
    if (link instanceof HTMLAnchorElement) {
      link.href = `./room.html?club=${encodeURIComponent(DEFAULT_CLUB_ID)}`;
    }
  }
}

/**
 * Build one live club card linking to its roast room.
 * @param {{ id: string, name: string }} entry Registry entry.
 * @param {number} roastCount Number of publishable roasts in the club.
 * @returns {HTMLAnchorElement}
 */
function renderLiveClub(entry, roastCount) {
  const link = createElement('a', {
    className:
      'block rounded-sharp border border-line bg-surface p-6 no-underline transition-colors duration-fast ease-standard hover:border-primary',
    attrs: { href: `./room.html?club=${encodeURIComponent(entry.id)}` },
  });

  link.append(
    createElement('p', {
      className: 'font-display text-2xl uppercase text-text',
      text: entry.name,
    })
  );

  link.append(
    createElement('p', {
      className: 'mt-2 text-sm text-textMuted',
      text: roastCount === 1 ? '1 roast ready' : `${roastCount} roasts ready`,
    })
  );

  return link;
}

/**
 * Build one coming soon card. Not a link and marked disabled for assistive tech.
 * @param {{ name: string }} entry Registry entry.
 * @returns {HTMLElement}
 */
function renderComingSoonClub(entry) {
  const wrap = createElement('div', {
    className: 'rounded-sharp border border-line bg-surface p-4',
    attrs: { 'aria-disabled': 'true' },
    children: [
      createElement('p', {
        className: 'font-display text-lg uppercase text-textMuted',
        text: entry.name,
      }),
      createElement('p', {
        className: 'mt-1 tokenLabel',
        text: 'Coming soon',
      }),
    ],
  });
  return wrap;
}

/**
 * Render the ticker with the first six headlines.
 * Duplicates the items once so the CSS translate loop is seamless; only the
 * first copy is exposed to screen readers.
 * @param {Array<{ headline: string, clubShortName: string }>} roasts
 * @returns {void}
 */
function renderTicker(roasts) {
  if (!tickerTrack || !tickerSection) return;

  clear(tickerTrack);

  if (!Array.isArray(roasts) || roasts.length === 0) {
    tickerSection.classList.add('hidden');
    return;
  }

  const items = roasts.slice(0, 6);

  for (const roast of items) {
    tickerTrack.append(
      createElement('span', {
        className: 'whitespace-nowrap text-sm text-textMuted',
        text: `${roast.clubShortName}: ${roast.headline}`,
      })
    );
  }

  for (const roast of items) {
    tickerTrack.append(
      createElement('span', {
        className: 'whitespace-nowrap text-sm text-textMuted',
        text: `${roast.clubShortName}: ${roast.headline}`,
        attrs: { 'aria-hidden': 'true' },
      })
    );
  }

  tickerSection.classList.remove('hidden');
}

/**
 * Show a friendly error inside the picker when the registry cannot load.
 * @param {string} message
 * @returns {void}
 */
function showPickerError(message) {
  if (!liveContainer) return;
  clear(liveContainer);
  liveContainer.append(
    createElement('p', {
      className: 'text-textMuted',
      text: message,
    })
  );
}

/**
 * Load the registry and render every section of the page.
 * @returns {Promise<void>}
 */
async function init() {
  setCallToActions();
  applyFrittLinks();

  const bgEl = document.getElementById('clubBackground');
  if (bgEl) {
    initScrollBackground(bgEl, backgroundLayersFor('manutd'));
  }

  try {
    const registry = await loadRegistry();
    const live = getLiveClubs(registry);
    const comingSoon = getComingSoonClubs(registry);

    /** @type {Array<{ headline: string, clubShortName: string }>} */
    const roastPool = [];

    for (const entry of live) {
      try {
        const club = await loadClub(entry.id);
        if (liveContainer) {
          liveContainer.append(renderLiveClub(entry, Array.isArray(club.roasts) ? club.roasts.length : 0));
        }
        if (Array.isArray(club.roasts)) {
          for (const roast of club.roasts) {
            roastPool.push({ headline: roast.headline, clubShortName: String(entry.shortName) });
          }
        }
      } catch (error) {
        console.warn('[roastRoom] could not load live club', entry.id, error);
      }
    }

    if (comingSoonContainer) {
      for (const entry of comingSoon) {
        comingSoonContainer.append(renderComingSoonClub(entry));
      }
    }

      renderTicker(roastPool);
    } catch (error) {
      console.warn('[roastRoom] could not load the registry', error);
      showPickerError('Could not load the club list. Serve the site over http and reload.');
    }

    initSuggestSection();
}

init();