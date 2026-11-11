/**
 * Fixed parallax background controller for The Roast Room.
 * Builds the layer DOM inside a .clubBackground__svg wrapper, throttles scroll
 * updates through requestAnimationFrame, and does nothing when the user
 * prefers reduced motion. The SVG layers are the fallback when no photo is
 * available.
 */

import { prefersReducedMotion } from '../utils/dom.js';

/**
 * Mount the SVG parallax layers inside a container element.
 *
 * @param {HTMLElement | null} container
 * @param {import('./layers.js').BackgroundLayer[]} layers
 * @returns {() => void} Teardown function. Safe to call at any time.
 */
export function initScrollBackground(container, layers) {
  const noop = () => {};
  if (!container || typeof document === 'undefined') return noop;

  const root = document.createElement('div');
  root.className = 'clubBackground__svg';
  root.setAttribute('aria-hidden', 'true');
  container.append(root);

  const scrim = document.createElement('div');
  scrim.className = 'clubBackground__scrim';
  root.append(scrim);

  /** @type {HTMLElement[]} */
  const layerEls = [];
  const list = Array.isArray(layers) ? layers : [];

  for (const layer of list) {
    if (!layer || typeof layer.svg !== 'string') continue;
    const el = document.createElement('div');
    el.className =
      'clubBackground__layer' + (layer.fast ? ' clubBackground__layer--fast' : '');
    el.dataset.speed = String(layer.speed);
    el.innerHTML = layer.svg; // safe: authored by us, no user data
    root.append(el);
    layerEls.push(el);
  }

  const teardown = () => {
    root.remove();
  };

  if (layerEls.length === 0) return teardown;
  if (prefersReducedMotion()) return teardown;

  let ticking = false;

  const update = () => {
    const y = window.scrollY || 0;
    for (const el of layerEls) {
      const speed = parseFloat(el.dataset.speed) || 0;
      el.style.transform = `translate3d(0, ${-y * speed}px, 0)`;
    }
    ticking = false;
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  update();

  return () => {
    window.removeEventListener('scroll', onScroll);
    teardown();
  };
}