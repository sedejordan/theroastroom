/**
 * Photo background layer for The Roast Room.
 *
 * Sits inside #clubBackground, below the scrim. Uses two stacked <img>
 * elements and crossfades between them. The SVG parallax layers act as the
 * fallback and are hidden (via the hasPhoto class) while a photo is showing.
 *
 * Never throws. All DOM work is guarded.
 */

import { prefersReducedMotion } from '../utils/dom.js';

const CROSSFADE_MS = 700;
const REDUCED_CROSSFADE_MS = 150;
const LOAD_TIMEOUT_MS = 10000;
const PULSE_MS = 700;

/**
 * Create a background image controller inside a container.
 * @param {HTMLElement | null} container
 * @returns {{
 *   show: (entry: { src: string, focal?: { desktop?: string, mobile?: string } } | null) => Promise<void>,
 *   preload: (entries: Array<{ src: string }>) => void,
 *   pulse: () => void,
 *   cancelPulse: () => void,
 *   destroy: () => void
 * }}
 */
export function createImageBackground(container) {
  const noop = () => {};
  const noopAsync = async () => {};

  if (!container || typeof document === 'undefined') {
    return { show: noopAsync, preload: noop, pulse: noop, cancelPulse: noop, destroy: noop };
  }

  const root = document.createElement('div');
  root.className = 'clubBackground__images';

  const imgA = createPhoto();
  const imgB = createPhoto();
  root.append(imgA, imgB);
  container.append(root);

  const tint = document.createElement('div');
  tint.className = 'clubBackground__tint';
  container.append(tint);

  let front = imgA;
  let back = imgB;
  let currentSrc = '';
  let requestId = 0;
  let preloadToken = 0;
  let destroyed = false;
  let pulseTimer = 0;

  /**
   * Build one photo element.
   * @returns {HTMLImageElement}
   */
  function createPhoto() {
    const img = document.createElement('img');
    img.className = 'clubBackground__photo';
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'eager';
    img.draggable = false;
    img.setAttribute('aria-hidden', 'true');
    return img;
  }

  /**
   * Apply focal point CSS variables for the current image.
   * @param {{ focal?: { desktop?: string, mobile?: string } }} entry
   * @returns {void}
   */
  function setFocal(entry) {
    const desktop =
      entry && entry.focal && typeof entry.focal.desktop === 'string'
        ? entry.focal.desktop
        : '50% 50%';
    const mobile =
      entry && entry.focal && typeof entry.focal.mobile === 'string'
        ? entry.focal.mobile
        : '50% 50%';
    root.style.setProperty('--bgFocalDesktop', desktop);
    root.style.setProperty('--bgFocalMobile', mobile);
  }

  /**
   * Load a source into an image element and resolve true only after it has
   * loaded and decoded.
   * @param {HTMLImageElement} img
   * @param {string} src
   * @returns {Promise<boolean>}
   */
  function loadInto(img, src) {
    return new Promise((resolve) => {
      let settled = false;
      let timer = 0;

      const done = (ok) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        img.onload = null;
        img.onerror = null;
        resolve(ok);
      };

      img.onload = () => done(true);
      img.onerror = () => done(false);
      timer = window.setTimeout(() => done(false), LOAD_TIMEOUT_MS);

      img.src = src;

      if (typeof img.decode === 'function') {
        img.decode().then(() => done(true)).catch(() => {
          // onload/onerror or the timeout decides the outcome.
        });
      }
    });
  }

  /**
   * Show the SVG fallback and clear the photos.
   * @returns {void}
   */
  function fallback() {
    container.classList.remove('hasPhoto');
    imgA.classList.remove('isActive');
    imgB.classList.remove('isActive');
    imgA.removeAttribute('src');
    imgB.removeAttribute('src');
    imgA.style.opacity = '0';
    imgB.style.opacity = '0';
    imgA.style.transitionDuration = '0ms';
    imgB.style.transitionDuration = '0ms';
    front = imgA;
    back = imgB;
  }

  /**
   * Show an image. Stale requests are ignored; the latest call wins.
   * @param {{ src: string, focal?: { desktop?: string, mobile?: string } } | null} entry
   * @returns {Promise<void>}
   */
  async function show(entry) {
    if (destroyed) return;

    if (!entry || typeof entry.src !== 'string' || entry.src.length === 0) {
      requestId += 1;
      currentSrc = '';
      fallback();
      return;
    }

    if (entry.src === currentSrc) {
      container.classList.add('hasPhoto');
      return;
    }

    const id = ++requestId;
    setFocal(entry);

    const target = back;
    const ok = await loadInto(target, entry.src);

    if (destroyed || id !== requestId) return;

    if (!ok) {
      fallback();
      return;
    }

    const fadeMs = prefersReducedMotion() ? REDUCED_CROSSFADE_MS : CROSSFADE_MS;
    const oldFront = front;

    currentSrc = entry.src;
    container.classList.add('hasPhoto');

    target.style.transitionDuration = `${fadeMs}ms`;
    oldFront.style.transitionDuration = `${fadeMs}ms`;

    target.classList.add('isActive');
    oldFront.classList.remove('isActive');

    target.style.opacity = '1';
    oldFront.style.opacity = '0';

    front = target;
    back = oldFront;

    window.setTimeout(() => {
      if (destroyed || front !== target) return;
      back.style.transitionDuration = '0ms';
      back.style.opacity = '0';
      void back.offsetWidth;
    }, fadeMs + 40);
  }

  /**
   * Preload images one at a time during idle time.
   * @param {Array<{ src: string }>} entries
   * @returns {void}
   */
  function preload(entries) {
    if (destroyed || !Array.isArray(entries)) return;

    const connection = navigator && navigator.connection;
    if (connection && connection.saveData) return;

    const seen = new Set();
    const list = entries.filter((entry) => {
      if (!entry || typeof entry.src !== 'string') return false;
      if (entry.src === currentSrc) return false;
      if (seen.has(entry.src)) return false;
      seen.add(entry.src);
      return true;
    });

    if (list.length === 0) return;

    const token = ++preloadToken;
    const schedule =
      typeof window.requestIdleCallback === 'function'
        ? (fn) => window.requestIdleCallback(fn, { timeout: 2000 })
        : (fn) => window.setTimeout(fn, 200);

    const run = (index) => {
      if (destroyed || token !== preloadToken || index >= list.length) return;
      const img = new Image();
      img.decoding = 'async';
      img.src = list[index].src;
      if (typeof img.decode === 'function') {
        img.decode().catch(() => {});
      }
      schedule(() => run(index + 1));
    };

    schedule(() => run(0));
  }

  /**
   * A short red pulse behind the page content.
   * @returns {void}
   */
  function pulse() {
    if (destroyed || prefersReducedMotion()) return;
    tint.classList.remove('isPulsing');
    void tint.offsetWidth;
    tint.classList.add('isPulsing');
    window.clearTimeout(pulseTimer);
    pulseTimer = window.setTimeout(() => tint.classList.remove('isPulsing'), PULSE_MS);
  }

  /**
   * Cancel a running pulse, for example when the filter changes.
   * @returns {void}
   */
  function cancelPulse() {
    window.clearTimeout(pulseTimer);
    tint.classList.remove('isPulsing');
  }

  /**
   * Remove everything and stop pending work.
   * @returns {void}
   */
  function destroy() {
    destroyed = true;
    requestId += 1;
    preloadToken += 1;
    window.clearTimeout(pulseTimer);
    root.remove();
    tint.remove();
  }

  return { show, preload, pulse, cancelPulse, destroy };
}