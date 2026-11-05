/**
 * Reveal animation for a roast card.
 * Runs a short slot machine style reel on the headline, then fades the facts,
 * receipts and verified line in. Under prefers reduced motion everything is
 * skipped and the roast appears immediately.
 */

import { prefersReducedMotion } from '../utils/dom.js';

const REEL_DURATION_MS = 600;
const REEL_INTERVAL_MS = 80;

/**
 * Reveal a roast inside an already mounted card.
 *
 * The headline cycles through random entries from the pool for about 600 ms
 * with aria hidden set so screen readers do not narrate the churn. When the
 * reel settles, the final headline is written, aria hidden is removed, and the
 * hidden elements are shown by adding the isVisible class.
 *
 * @param {{
 *   headlineElement: HTMLElement,
 *   finalHeadline: string,
 *   reelPool: string[],
 *   hiddenElements: HTMLElement[]
 * }} options
 * @returns {Promise<void>}
 */
export async function revealRoast(options) {
  const { headlineElement, finalHeadline, reelPool, hiddenElements } = options;

  if (!headlineElement) return;

  const hidden = Array.isArray(hiddenElements) ? hiddenElements.filter(Boolean) : [];
  const pool = Array.isArray(reelPool) ? reelPool : [];

  const finish = () => {
    headlineElement.textContent = finalHeadline;
    for (const el of hidden) {
      el.classList.add('isVisible');
    }
  };

  if (prefersReducedMotion() || pool.length < 2) {
    finish();
    return;
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
      const pick = pool[Math.floor(Math.random() * pool.length)];
      headlineElement.textContent = pick;
      window.setTimeout(tick, REEL_INTERVAL_MS);
    };
    tick();
  });

  headlineElement.removeAttribute('aria-hidden');
  finish();
}