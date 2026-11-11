/**
 * Reveal animation for a roast card.
 * Runs a short slot machine style reel on the headline, then plays one reveal
 * beat (glow, sweep, settle) and fades the facts, receipts and verified line
 * in with a small stagger.
 *
 * Under prefers-reduced motion the reel and effects are skipped unless the
 * caller explicitly forces the reel.
 */

import { prefersReducedMotion } from '../utils/dom.js';

const REEL_DURATION_MS = 600;
const REEL_INTERVAL_MS = 80;
const STAGGER_MS = 60;
const CLEANUP_MS = 900;

/**
 * Reveal a roast inside an already mounted card.
 *
 * @param {{
 *   headlineElement: HTMLElement,
 *   finalHeadline: string,
 *   reelPool: string[],
 *   hiddenElements: HTMLElement[],
 *   forceAnimate?: boolean,
 *   cardElement?: HTMLElement | null,
 *   onReveal?: () => void
 * }} options
 * @returns {Promise<void>}
 */
export async function revealRoast(options) {
  const {
    headlineElement,
    finalHeadline,
    reelPool,
    hiddenElements,
    forceAnimate,
    cardElement,
    onReveal,
  } = options || {};

  if (!headlineElement) return;

  const hidden = Array.isArray(hiddenElements) ? hiddenElements.filter(Boolean) : [];
  const pool = Array.isArray(reelPool) ? reelPool : [];
  const reduced = prefersReducedMotion();
  const canReel = pool.length >= 2 && (!reduced || forceAnimate === true);
  const card =
    cardElement ||
    (typeof headlineElement.closest === 'function'
      ? headlineElement.closest('.roastCard')
      : null);

  const finishInstant = () => {
    headlineElement.textContent = finalHeadline;
    for (const el of hidden) el.classList.add('isVisible');
    if (card) {
      card.classList.remove('isCharging');
      card.classList.remove('isRevealed');
    }
  };

  if (!canReel) {
    finishInstant();
    return;
  }

  if (card) {
    card.classList.remove('isRevealed');
    card.classList.add('isCharging');
  }

  headlineElement.setAttribute('aria-hidden', 'true');
  headlineElement.textContent = pool[Math.floor(Math.random() * pool.length)];

  const start = Date.now();

  await new Promise((resolve) => {
    const tick = () => {
      const elapsed = Date.now() - start;
      if (elapsed >= REEL_DURATION_MS) {
        resolve();
        return;
      }
      headlineElement.textContent = pool[Math.floor(Math.random() * pool.length)];
      window.setTimeout(tick, REEL_INTERVAL_MS);
    };
    tick();
  });

  headlineElement.removeAttribute('aria-hidden');
  headlineElement.textContent = finalHeadline;

  if (card) {
    card.classList.remove('isCharging');
    void card.offsetWidth;
    card.classList.add('isRevealed');
  }

  if (typeof onReveal === 'function') {
    try {
      onReveal();
    } catch {
      // Effects are best effort only.
    }
  }

  if (reduced) {
    for (const el of hidden) el.classList.add('isVisible');
  } else {
    hidden.forEach((el, index) => {
      window.setTimeout(() => {
        if (el.isConnected) el.classList.add('isVisible');
      }, index * STAGGER_MS);
    });
  }

  if (card) {
    window.setTimeout(() => {
      card.classList.remove('isCharging');
      card.classList.remove('isRevealed');
    }, CLEANUP_MS);
  }
}