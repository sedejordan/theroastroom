/**
 * Photo background layer for The Roast Room.
 *
 * Two stacked <img> elements. The incoming image is always above the outgoing
 * image and fades from 0 to 1 while the outgoing image stays fully opaque
 * underneath. The outgoing image is hidden only after the fade completes.
 *
 * Never throws. All DOM work is guarded.
 */

import { prefersReducedMotion } from '../utils/dom.js';

const CROSSFADE_MS = 1000;
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
  let fadeTimer = 0;
  let fadeToken = 0;
  let fading = false;

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
   * Stop and reset the slow zoom on a photo. Only call while hidden.
   * @param {HTMLImageElement} img
   * @returns {void}
   */
  function resetZoom(img) {
    img.classList.remove('isZooming');
    img.style.animation = 'none';
    void img.offsetWidth;
    img.style.animation = '';
  }

  /**
   * Start the slow zoom on a photo. Resets any previous animation first.
   * @param {HTMLImageElement} img
   * @returns {void}
   */
  function startZoom(img) {
    img.classList.remove('isZooming');
    img.style.animation = 'none';
    void img.offsetWidth;
    img.style.animation = '';
    img.classList.add('isZooming');
  }

  /**
   * Hide a photo without transitioning and reset its zoom.
   * @param {HTMLImageElement} img
   * @returns {void}
   */
  function hidePhoto(img) {
    img.style.transitionDuration = '0ms';
    img.style.transitionTimingFunction = 'linear';
    img.style.opacity = '0';
    img.style.zIndex = '0';
    resetZoom(img);
  }

  /**
   * Load and decode an image off screen before assigning it to a hidden photo.
   * @param {string} src
   * @returns {Promise<boolean>}
   */
  function loadSource(src) {
    return new Promise((resolve) => {
      const img = new Image();
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

      img.decoding = 'async';
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
   * Finish any running crossfade instantly so the hidden photo can be reused.
   * @returns {void}
   */
  function finishFadeInstantly() {
    if (!fading) return;
    fadeToken += 1;
    window.clearTimeout(fadeTimer);

    front.style.transitionDuration = '0ms';
    front.style.transitionTimingFunction = 'linear';
    front.style.opacity = '1';
    front.style.zIndex = '2';

    if (back) hidePhoto(back);

    fading = false;
  }

  /**
   * Show the SVG fallback and clear the photos.
   * @returns {void}
   */
  function fallback() {
    fadeToken += 1;
    fading = false;
    window.clearTimeout(fadeTimer);
    container.classList.remove('hasPhoto');

    hidePhoto(imgA);
    hidePhoto(imgB);
    imgA.removeAttribute('src');
    imgB.removeAttribute('src');

    front = imgA;
    back = imgB;
    currentSrc = '';
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
      setFocal(entry);
      container.classList.add('hasPhoto');
      return;
    }

    const id = ++requestId;
    const ok = await loadSource(entry.src);

    if (destroyed || id !== requestId) return;

    if (!ok) {
      if (currentSrc.length === 0) fallback();
      return;
    }

    if (fading) finishFadeInstantly();

    setFocal(entry);

    const oldFront = front;
    const target = back;
    const fadeMs = prefersReducedMotion() ? REDUCED_CROSSFADE_MS : CROSSFADE_MS;

    target.src = entry.src;
    target.style.transitionDuration = '0ms';
    target.style.transitionTimingFunction = 'linear';
    target.style.opacity = '0';
    target.style.zIndex = '2';
    startZoom(target);

    oldFront.style.zIndex = '1';
    if (currentSrc.length > 0) {
      oldFront.style.transitionDuration = '0ms';
      oldFront.style.transitionTimingFunction = 'linear';
      oldFront.style.opacity = '1';
      if (!oldFront.classList.contains('isZooming')) startZoom(oldFront);
    }

    // Force the browser to accept the initial opacity before enabling the fade.
    void target.offsetWidth;

    target.style.transitionDuration = `${fadeMs}ms`;
    target.style.transitionTimingFunction = 'ease-in-out';
    target.style.opacity = '1';

    currentSrc = entry.src;
    container.classList.add('hasPhoto');

    front = target;
    back = oldFront;
    fading = true;

    const token = ++fadeToken;
    window.clearTimeout(fadeTimer);
    fadeTimer = window.setTimeout(() => {
      if (destroyed || token !== fadeToken || front !== target) return;
      hidePhoto(back);
      fading = false;
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
    fadeToken += 1;
    window.clearTimeout(pulseTimer);
    window.clearTimeout(fadeTimer);
    root.remove();
    tint.remove();
  }

  return { show, preload, pulse, cancelPulse, destroy };
}