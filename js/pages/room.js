/**
 * Roast room logic.
 * Reads the club id from the query string, loads the club, wires the category
 * filter and the shuffle bag, and shows roasts on demand with a short reel.
 */

import { CLUB_STATUS, DEFAULT_CLUB_ID } from '../config.js';
import { loadClub, loadRegistry } from '../registry.js';
import { applyTheme } from '../theme.js';
import { buildCategoryFilter } from '../ui/categoryFilter.js';
import { createRoastCard } from '../ui/roastCard.js';
import { createShuffleBag } from '../ui/shuffleBag.js';
import { revealRoast } from '../ui/reveal.js';
import { clear, prefersReducedMotion } from '../utils/dom.js';
import { parseRoastHash } from '../utils/links.js';
import { createSharePanel } from '../share/sharePanel.js';

const params = new URLSearchParams(window.location.search);
const clubIdParam = params.get('club') || DEFAULT_CLUB_ID;

const loadingEl = document.getElementById('loadingState');
const errorEl = document.getElementById('errorState');
const errorMessageEl = document.getElementById('errorMessage');
const roomEl = document.getElementById('roomState');
const filterContainer = document.getElementById('categoryFilter');
const roastButton = document.getElementById('roastButton');
const progressEl = document.getElementById('progress');
const roastContainer = document.getElementById('roastContainer');
const clubBadge = document.getElementById('clubBadge');
const emptyEl = document.getElementById('emptyState');
const liveRegion = document.getElementById('roastLiveRegion');
const pageHeading = document.getElementById('pageHeading');
const sharePanelEl = document.getElementById('sharePanel');

/** @type {Record<string, unknown> | null} */
let club = null;
let selectedCategory = 'all';
/** @type {ReturnType<typeof createShuffleBag> | null} */
let bag = null;
/** @type {Record<string, unknown> | null} */
let currentRoast = null;
let busy = false;
/** @type {ReturnType<typeof createSharePanel> | null} */
let sharePanel = null;

function showLoading() {
  if (loadingEl) loadingEl.classList.remove('hidden');
  if (errorEl) errorEl.classList.add('hidden');
  if (roomEl) roomEl.classList.add('hidden');
}

/**
 * Show the error state with a friendly message.
 * @param {string} message
 * @returns {void}
 */
function showError(message) {
  if (loadingEl) loadingEl.classList.add('hidden');
  if (roomEl) roomEl.classList.add('hidden');
  if (errorEl) errorEl.classList.remove('hidden');
  if (errorMessageEl) errorMessageEl.textContent = message;
  if (clubBadge) clubBadge.textContent = 'Club unavailable';
}

function showRoom() {
  if (loadingEl) loadingEl.classList.add('hidden');
  if (errorEl) errorEl.classList.add('hidden');
  if (roomEl) roomEl.classList.remove('hidden');
}

/**
 * Roasts in the current filter.
 * @returns {Array<Record<string, unknown>>}
 */
function getFilteredRoasts() {
  if (!club) return [];
  const roasts = Array.isArray(club.roasts) ? club.roasts : [];
  if (selectedCategory === 'all') return roasts;
  return roasts.filter((roast) => roast.category === selectedCategory);
}

/**
 * Update the "Roast N of M" line. Nothing is shown before the first serve or
 * when the current cycle has already served everything once.
 * @returns {void}
 */
function updateProgress() {
  if (!progressEl) return;
  if (!bag || !currentRoast || bag.size() === 0) {
    progressEl.textContent = '';
    return;
  }
  const size = bag.size();
  const remaining = bag.remaining();
  const n = size - remaining;
  if (n <= 0) {
    progressEl.textContent = '';
    return;
  }
  progressEl.textContent = `Roast ${n} of ${size}`;
}

/**
 * Look up the category metadata for a roast.
 * @param {string} id
 * @returns {Record<string, unknown> | null}
 */
function findCategory(id) {
  if (!club || !Array.isArray(club.categories)) return null;
  return club.categories.find((category) => category && category.id === id) || null;
}

/**
 * Show a roast in the card area, reveal it, announce it and update the URL hash.
 * @param {Record<string, unknown>} roast
 * @param {{ animate?: boolean }} [options]
 * @returns {Promise<void>}
 */
async function showRoast(roast, options = {}) {
  if (!roast || !roastContainer) return;

  const shouldAnimate = options.animate !== false;
  currentRoast = roast;

  const category = findCategory(String(roast.category));
  const built = createRoastCard(roast, category);

  clear(roastContainer);
  roastContainer.append(built.element);

  const base = window.location.pathname + window.location.search;
  try {
    window.history.replaceState(null, '', `${base}#${encodeURIComponent(String(roast.id))}`);
  } catch {
    // Ignore history errors, the page still works.
  }

  const animate = shouldAnimate && !prefersReducedMotion();

  if (animate) {
    const pool = (Array.isArray(club?.roasts) ? club.roasts : [])
      .map((entry) => String(entry.headline))
      .filter((headline) => headline.length > 0);
    await revealRoast({
      headlineElement: built.headlineElement,
      finalHeadline: String(roast.headline),
      reelPool: pool,
      hiddenElements: built.hiddenElements,
    });
  } else {
    built.headlineElement.textContent = String(roast.headline);
    for (const el of built.hiddenElements) {
      el.classList.add('isVisible');
    }
  }

  if (liveRegion) {
    liveRegion.textContent = String(roast.headline);
  }

  if (sharePanel) {
    try {
      sharePanel.update(roast, category, club);
    } catch (error) {
      console.warn('[roastRoom] could not update the share panel', error);
    }
  }

  updateProgress();
}

/**
 * Rebuild the bag and the filter chips for the current selection.
 * @returns {void}
 */
function rebuildBagAndFilter() {
  if (!club) return;

  const filtered = getFilteredRoasts();

  if (bag) {
    bag.reset(filtered);
  } else {
    bag = createShuffleBag(filtered);
  }

  if (filterContainer) {
    buildCategoryFilter({
      container: filterContainer,
      categories: Array.isArray(club.categories) ? club.categories : [],
      roasts: Array.isArray(club.roasts) ? club.roasts : [],
      selectedId: selectedCategory,
      onChange: handleFilterChange,
    });
  }

  const isEmpty = filtered.length === 0;
  if (roastButton) roastButton.disabled = isEmpty;
  if (emptyEl) emptyEl.classList.toggle('hidden', !isEmpty);

  if (isEmpty) {
    clear(roastContainer);
    currentRoast = null;
    if (progressEl) progressEl.textContent = '';
    if (sharePanel) sharePanel.hide();
  }
}

/**
 * Handle a filter chip click. Resets the current roast and the bag.
 * @param {string} newId
 * @returns {void}
 */
function handleFilterChange(newId) {
  if (busy) return;
  selectedCategory = newId;
  currentRoast = null;
  if (roastContainer) clear(roastContainer);
  if (liveRegion) liveRegion.textContent = '';
  if (sharePanel) sharePanel.hide();
  rebuildBagAndFilter();
}

/**
 * Handle the Roast them button click.
 * @returns {Promise<void>}
 */
async function handleRoastClick() {
  if (busy || !bag) return;
  const items = getFilteredRoasts();
  if (items.length === 0) return;

  busy = true;
  if (roastButton) roastButton.disabled = true;

  try {
    const roast = bag.next();
    if (roast) {
      await showRoast(roast, { animate: true });
    }
  } finally {
    busy = false;
    if (roastButton) {
      roastButton.disabled = getFilteredRoasts().length === 0;
    }
  }
}

/**
 * Boot the page. Reads the club id, loads the club, wires everything up.
 * @returns {Promise<void>}
 */
async function init() {
  showLoading();

  try {
    const registry = await loadRegistry();
    const clubs = Array.isArray(registry.clubs) ? registry.clubs : [];
    const entry = clubs.find((candidate) => candidate && candidate.id === clubIdParam);

    if (!entry) {
      showError(`That club isn't in the registry. Pick one from the picker instead.`);
      return;
    }

    if (entry.status !== CLUB_STATUS.LIVE) {
      showError(`${entry.name} is coming soon. There isn't a roast room for it yet.`);
      return;
    }

    club = await loadClub(clubIdParam);
    applyTheme(club.theme || {});

    if (clubBadge) clubBadge.textContent = String(club.name || 'Roast Room');
    if (pageHeading) pageHeading.textContent = `${club.name || 'Roast Room'} Roast Room`;
    document.title = `${club.shortName || club.name || 'Roast Room'} Roast Room | The Roast Room`;

    const hash = parseRoastHash(window.location.hash);
    const deepRoast =
      hash && Array.isArray(club.roasts)
        ? club.roasts.find((roast) => roast && roast.id === hash) || null
        : null;

    selectedCategory = 'all';
    rebuildBagAndFilter();
    showRoom();

    if (sharePanelEl && !sharePanel) {
      try {
        sharePanel = createSharePanel({ container: sharePanelEl });
      } catch (error) {
        console.warn('[roastRoom] could not create the share panel', error);
      }
    }

    if (deepRoast) {
      await showRoast(deepRoast, { animate: false });
    }

    if (roastButton) {
      roastButton.addEventListener('click', handleRoastClick);
    }
  } catch (error) {
    console.warn('[roastRoom] could not open the roast room', error);
    showError('We could not load this club. Please try again in a moment.');
  }
}

init();