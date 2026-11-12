/**
 * Builds and controls the share panel for one roast.
 */

import { CARD_FORMATS } from './cardFormats.js';
import { SHARE_HOST_OVERRIDE } from './shareConfig.js';
import { renderRoastCard } from './renderCard.js';
import { absoluteRoastUrl, buildFileName, buildShareText, hostLabel } from './shareText.js';
import { canvasToBlob, copyText, downloadBlob, shareImage } from './actions.js';
import { clear, createElement } from '../utils/dom.js';

/**
 * Create the share panel inside a container.
 * @param {{ container: HTMLElement }} options Panel options.
 * @returns {{
 *   update: (roast: Record<string, unknown>, category: Record<string, unknown> | null, club: Record<string, unknown>) => void,
 *   hide: () => void,
 *   show: () => void
 * }} Panel controller.
 */
export function createSharePanel(options) {
  const container = options && options.container ? options.container : null;

  if (!container || typeof document === 'undefined') {
    return {
      update() {},
      hide() {},
      show() {},
    };
  }

  clear(container);

  const heading = createElement('h2', {
    className: 'sharePanelHeading',
    text: 'Share this roast',
    attrs: { id: 'sharePanelHeading' },
  });

  const formatToggle = createElement('div', {
    className: 'shareFormatToggle',
    attrs: {
      role: 'group',
      'aria-label': 'Card format',
    },
  });

  /** @type {Map<string, HTMLButtonElement>} */
  const formatButtons = new Map();

  for (const format of Object.values(CARD_FORMATS)) {
    const button = createElement('button', {
      className: 'shareFormatButton',
      text: format.label,
      attrs: {
        type: 'button',
        'aria-pressed': format.id === 'post' ? 'true' : 'false',
      },
    });
    button.addEventListener('click', () => {
      currentFormatId = format.id;
      updatePressed();
      hideFallback();
      setStatus('');
      schedulePreview();
    });
    formatButtons.set(format.id, button);
    formatToggle.append(button);
  }

  const previewWrap = createElement('div', { className: 'sharePreviewWrap' });
  const previewCanvas = createElement('canvas', {
    className: 'sharePreviewCanvas',
    attrs: {
      role: 'img',
      'aria-label': 'Roast card preview',
    },
  });
  const previewImage = createElement('img', {
    className: 'sharePreviewImage hidden',
    attrs: { alt: 'Roast card preview', decoding: 'async' },
  });
  previewWrap.append(previewCanvas, previewImage);
  let previewUrl = '';

  previewImage.addEventListener('error', () => {
    if (workCanvas.width > 0) {
      previewCanvas.width = workCanvas.width;
      previewCanvas.height = workCanvas.height;
      const ctx = previewCanvas.getContext('2d');
      if (ctx) ctx.drawImage(workCanvas, 0, 0);
      previewCanvas.classList.remove('hidden');
      previewImage.classList.add('hidden');
    }
  });

  const actions = createElement('div', { className: 'shareActions' });

  const shareButton = createElement('button', {
    className: 'shareActionPrimary',
    text: 'Share',
    attrs: { type: 'button' },
  });

  const downloadButton = createElement('button', {
    className: 'shareActionSecondary',
    text: 'Download image',
    attrs: { type: 'button' },
  });

  const copyButton = createElement('button', {
    className: 'shareActionSecondary',
    text: 'Copy link',
    attrs: { type: 'button' },
  });

  actions.append(shareButton, downloadButton, copyButton);

  const status = createElement('p', {
    className: 'shareStatus',
    attrs: {
      role: 'status',
      'aria-live': 'polite',
    },
  });

  const fallback = createElement('div', { className: 'shareFallback hidden' });
  const fallbackLabel = createElement('label', {
    className: 'tokenLabel',
    text: 'Copy this link',
    attrs: { for: 'shareFallbackInput' },
  });
  const fallbackInput = createElement('input', {
    className: 'shareFallbackInput',
    attrs: {
      id: 'shareFallbackInput',
      type: 'text',
      readonly: 'readonly',
      'aria-label': 'Roast link',
    },
  });
  fallback.append(fallbackLabel, fallbackInput);

  container.append(heading, formatToggle, actions, previewWrap, status, fallback);
  container.setAttribute('aria-labelledby', 'sharePanelHeading');

  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    shareButton.hidden = true;
  }

  const workCanvas = document.createElement('canvas');

  let currentRoast = null;
  let currentCategory = null;
  let currentClub = null;
  let currentFormatId = 'post';
  let visible = false;
  let lastKey = '';
  let cachedBlob = null;
  let renderBusy = false;
  let renderPending = false;

  /**
   * Set the live status message.
   * @param {string} message Status text.
   * @returns {void}
   */
  function setStatus(message) {
    status.textContent = message || '';
  }

  /**
   * Hide the copy fallback input.
   * @returns {void}
   */
  function hideFallback() {
    fallback.classList.add('hidden');
  }

  /**
   * Update the format button pressed state.
   * @returns {void}
   */
  function updatePressed() {
    for (const [id, button] of formatButtons) {
      button.setAttribute('aria-pressed', id === currentFormatId ? 'true' : 'false');
    }
  }

  /**
   * Return the selected format.
   * @returns {{ id: string, label: string, width: number, height: number, safeTop: number, safeBottom: number }} Format.
   */
  function currentFormat() {
    return CARD_FORMATS[currentFormatId] || CARD_FORMATS.post;
  }

  /**
   * Build the absolute roast URL.
   * @returns {string} Absolute URL.
   */
  function currentUrl() {
    if (!currentRoast || !currentClub) return '';
    return absoluteRoastUrl(window.location.href, currentClub.id, currentRoast.id);
  }

  /**
   * Draw the preview once.
   * @returns {Promise<void>}
   */
  async function drawPreview() {
    const roast = currentRoast;
    const category = currentCategory;
    const club = currentClub;
    const format = currentFormat();
    const host = hostLabel(window.location.host, SHARE_HOST_OVERRIDE);
    const key = `${club.id}|${roast.id}|${format.id}|${host}`;

    if (key === lastKey && cachedBlob) {
      return;
    }

    lastKey = key;
    cachedBlob = null;
    setStatus('Preparing image');

    const result = await renderRoastCard({
      canvas: workCanvas,
      roast,
      category,
      club,
      format,
      host,
    });

    if (!visible || lastKey !== key) return;

    const blobResult = await canvasToBlob(workCanvas);
    if (!visible || lastKey !== key) return;

    if (blobResult.ok && blobResult.blob) {
      cachedBlob = blobResult.blob;
      const nextUrl = URL.createObjectURL(blobResult.blob);
      previewImage.src = nextUrl;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = nextUrl;
      previewImage.alt = `Roast card preview for ${String(roast.headline || '')} in ${format.label} format`;
      previewImage.classList.remove('hidden');
      previewCanvas.classList.add('hidden');
    } else {
      // Fall back to showing the canvas if the PNG could not be made.
      previewCanvas.width = workCanvas.width;
      previewCanvas.height = workCanvas.height;
      const ctx = previewCanvas.getContext('2d');
      if (ctx) ctx.drawImage(workCanvas, 0, 0);
      previewCanvas.classList.remove('hidden');
      previewImage.classList.add('hidden');
    }

    setStatus(result.truncated ? 'Preview ready (some text was shortened)' : 'Preview ready');
  }

  /**
   * Render the preview when the panel is visible.
   * @returns {Promise<void>}
   */
  async function renderPreview() {
    if (!visible || !currentRoast || !currentClub) return;

    if (renderBusy) {
      renderPending = true;
      return;
    }

    renderBusy = true;

    try {
      do {
        renderPending = false;
        await drawPreview();
      } while (renderPending && visible);
    } catch {
      setStatus('Could not prepare the image. Try again.');
    } finally {
      renderBusy = false;
    }
  }

  /**
   * Schedule a preview render.
   * @returns {void}
   */
  function schedulePreview() {
    if (!visible) return;
    renderPreview().catch(() => {
      setStatus('Could not prepare the image. Try again.');
    });
  }

  /**
   * Handle the Share button.
   * @returns {Promise<void>}
   */
  async function handleShare() {
    try {
      if (!currentRoast || !currentClub) return;

      let blob = cachedBlob;
      if (!blob) {
        const blobResult = await canvasToBlob(workCanvas);
        if (!blobResult.ok || !blobResult.blob) {
          setStatus('Could not prepare the image. Try Download image instead.');
          return;
        }
        blob = blobResult.blob;
        cachedBlob = blob;
      }

      const fileName = buildFileName(currentClub.id, currentRoast.id, currentFormat().id);
      const url = currentUrl();
      const text = buildShareText(currentRoast, url);
      const result = await shareImage({ blob, fileName, title: 'The Roast Room', text, url });

      if (result.ok) {
        setStatus('Shared');
      } else if (result.reason === 'cancelled') {
        setStatus('Share cancelled');
      } else if (result.reason === 'unsupported') {
        setStatus('Sharing is not available here. Use Download image instead.');
      } else {
        setStatus('Could not share. Try Download image instead.');
      }
    } catch {
      setStatus('Could not share. Try Download image instead.');
    }
  }

  /**
   * Handle the Download image button.
   * @returns {Promise<void>}
   */
  async function handleDownload() {
    try {
      let blob = cachedBlob;
      if (!blob) {
        const blobResult = await canvasToBlob(workCanvas);
        if (!blobResult.ok || !blobResult.blob) {
          setStatus('Could not save the image. Use Share on your phone instead.');
          return;
        }
        blob = blobResult.blob;
        cachedBlob = blob;
      }

      const fileName = buildFileName(currentClub.id, currentRoast.id, currentFormat().id);
      const result = downloadBlob(blob, fileName);

      if (result.ok) {
        setStatus('Image saved');
      } else {
        setStatus('Could not save the image. Use Share on your phone instead.');
      }
    } catch {
      setStatus('Could not save the image. Use Share on your phone instead.');
    }
  }

  /**
   * Handle the Copy link button.
   * @returns {Promise<void>}
   */
  async function handleCopy() {
    try {
      const url = currentUrl();
      if (!url) return;

      const result = await copyText(url);

      if (result.ok) {
        setStatus('Link copied');
        hideFallback();
        return;
      }

      setStatus('Could not copy, select the link below');
      fallbackInput.value = url;
      fallback.classList.remove('hidden');
      fallbackInput.focus();
      fallbackInput.select();
      fallbackInput.setSelectionRange(0, fallbackInput.value.length);
    } catch {
      setStatus('Could not copy, select the link below');
      const url = currentUrl();
      fallbackInput.value = url;
      fallback.classList.remove('hidden');
      fallbackInput.focus();
      fallbackInput.select();
    }
  }

  shareButton.addEventListener('click', handleShare);
  downloadButton.addEventListener('click', handleDownload);
  copyButton.addEventListener('click', handleCopy);

  /**
   * Show the panel.
   * @returns {void}
   */
  function show() {
    visible = true;
    container.classList.remove('hidden');
    container.removeAttribute('aria-hidden');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        schedulePreview();
      });
    });
  }

  /**
   * Hide the panel.
   * @returns {void}
   */
  function hide() {
    visible = false;
    container.classList.add('hidden');
    container.setAttribute('aria-hidden', 'true');
    hideFallback();
    setStatus('');
  }

  /**
   * Update the panel for a roast.
   * @param {Record<string, unknown>} roast Roast data.
   * @param {Record<string, unknown> | null} category Category metadata.
   * @param {Record<string, unknown>} club Club data.
   * @returns {void}
   */
  function update(roast, category, club) {
    if (!roast || !club) {
      hide();
      return;
    }

    currentRoast = roast;
    currentCategory = category;
    currentClub = club;
    hideFallback();
    setStatus('');
    updatePressed();
    show();
  }

  updatePressed();

  return { update, hide, show };
}
