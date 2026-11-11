/**
 * Landing page logic.
 * Renders the club picker from the registry, the recent roast ticker, the
 * hero call to action and the crossfading section backgrounds.
 */

import { initSuggestSection } from '../suggest/suggestSection.js';
import { applyFrittLinks } from '../brand/applyFrittLinks.js';
import { DEFAULT_CLUB_ID } from '../config.js';
import { getComingSoonClubs, getLiveClubs, loadClub, loadRegistry } from '../registry.js';
import { clear, createElement, prefersReducedMotion } from '../utils/dom.js';
import { initScrollBackground } from '../background/scrollBackground.js';
import { backgroundLayersFor } from '../background/layers.js';
import { createImageBackground } from '../background/imageBackground.js';
import {
  collectHomeBackgrounds,
  homeBackgroundFor,
} from '../background/backgroundConfig.js';

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

function setupTickerToggle() {
  const toggle = document.getElementById('tickerToggle');
  if (!toggle || !tickerTrack || toggle.dataset.ready === 'true') return;
  toggle.dataset.ready = 'true';

  let running = true;

  const apply = () => {
    const duration = window.matchMedia('(max-width: 767px)').matches ? '26s' : '40s';
    // Inline `!important` is required: css/base.css sets
    // `* { animation-duration: 1ms !important; animation-iteration-count: 1 !important; }`
    // under prefers-reduced-motion, which would otherwise kill the ticker even
    // after the user clicks Play.
    tickerTrack.style.setProperty(
      'animation',
      `tickerScroll ${duration} linear infinite`,
      'important'
    );
    tickerTrack.style.setProperty(
      'animation-play-state',
      running ? 'running' : 'paused',
      'important'
    );
    toggle.textContent = running ? 'Pause ticker' : 'Play ticker';
    toggle.setAttribute('aria-pressed', running ? 'false' : 'true');
  };

  toggle.addEventListener('click', () => {
    running = !running;
    apply();
  });

  apply();
}

/**
 * Render the ticker with the first six headlines.
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
  setupTickerToggle();
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
 * Observe the sections with data-bg and crossfade the background.
 * @param {ReturnType<typeof createImageBackground>} controller
 * @returns {void}
 */
function setupSectionBackgrounds(controller) {
  const sections = Array.from(document.querySelectorAll('[data-bg]'));
  if (sections.length === 0) return;
  if (typeof IntersectionObserver !== 'function') return;

  let pending = 0;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const key = entry.target.getAttribute('data-bg');
        const image = homeBackgroundFor(key);
        if (!image) continue;
        window.clearTimeout(pending);
        pending = window.setTimeout(() => controller.show(image), 120);
      }
    },
    { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
  );

  for (const section of sections) observer.observe(section);
}

/**
 * Load the registry and render every section of the page.
 * @returns {Promise<void>}
 */
async function init() {
  setCallToActions();
  applyFrittLinks();

  const bgEl = document.getElementById('clubBackground');
  let imageBackground = null;

  if (bgEl) {
    imageBackground = createImageBackground(bgEl);
    initScrollBackground(bgEl, backgroundLayersFor('manutd'));
    imageBackground.show(homeBackgroundFor('hero'));
    setupSectionBackgrounds(imageBackground);

    const startPreload = () => {
      if (imageBackground) imageBackground.preload(collectHomeBackgrounds());
    };
    if (document.readyState === 'complete') {
      startPreload();
    } else {
      window.addEventListener('load', startPreload, { once: true });
    }
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
          liveContainer.append(
            renderLiveClub(entry, Array.isArray(club.roasts) ? club.roasts.length : 0)
          );
        }
        if (Array.isArray(club.roasts)) {
          for (const roast of club.roasts) {
            roastPool.push({
              headline: roast.headline,
              clubShortName: String(entry.shortName),
            });
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