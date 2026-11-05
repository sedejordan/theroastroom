/**
 * Browser share, download and clipboard actions.
 * Every exported function returns an object and never throws.
 */

/**
 * Convert a canvas to a PNG blob.
 * @param {HTMLCanvasElement} canvas Canvas to convert.
 * @returns {Promise<{ ok: boolean, reason: string, blob?: Blob }>} Result with blob when ok.
 */
export function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    try {
      if (!canvas || typeof canvas.toBlob !== 'function') {
        resolve({ ok: false, reason: 'unsupported' });
        return;
      }

      canvas.toBlob((blob) => {
        if (blob) {
          resolve({ ok: true, reason: 'blob', blob });
        } else {
          resolve({ ok: false, reason: 'empty' });
        }
      }, 'image/png');
    } catch {
      resolve({ ok: false, reason: 'failed' });
    }
  });
}

/**
 * Download a blob with a file name.
 * @param {Blob} blob File contents.
 * @param {string} fileName Download file name.
 * @returns {{ ok: boolean, reason: string }} Result.
 */
export function downloadBlob(blob, fileName) {
  try {
    if (!blob || typeof document === 'undefined' || typeof URL === 'undefined') {
      return { ok: false, reason: 'unsupported' };
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = String(fileName || 'roastroom.png');
    link.rel = 'noopener';
    link.style.display = 'none';

    document.body.append(link);
    link.click();
    link.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1500);

    return { ok: true, reason: 'downloaded' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/**
 * Share an image through the system share sheet when available.
 * Falls back to sharing text and URL only.
 * @param {{
 *   blob?: Blob,
 *   fileName?: string,
 *   title?: string,
 *   text?: string,
 *   url?: string
 * }} options Share options.
 * @returns {Promise<{ ok: boolean, reason: string }>} Result.
 */
export async function shareImage(options) {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      return { ok: false, reason: 'unsupported' };
    }

    const { blob, fileName, title, text, url } = options || {};
    const payload = {
      title: title === undefined ? '' : String(title),
      text: text === undefined ? '' : String(text),
      url: url === undefined ? '' : String(url),
    };

    if (blob && typeof File === 'function') {
      const file = new File([blob], String(fileName || 'roastroom.png'), {
        type: blob.type || 'image/png',
      });
      const files = [file];

      if (typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
        try {
          await navigator.share({ ...payload, files });
          return { ok: true, reason: 'shared' };
        } catch (error) {
          if (error && error.name === 'AbortError') {
            return { ok: false, reason: 'cancelled' };
          }
        }
      }
    }

    await navigator.share(payload);
    return { ok: true, reason: 'shared' };
  } catch (error) {
    if (error && error.name === 'AbortError') {
      return { ok: false, reason: 'cancelled' };
    }
    return { ok: false, reason: 'failed' };
  }
}

/**
 * Copy text with the Clipboard API.
 * @param {string} text Text to copy.
 * @returns {Promise<{ ok: boolean, reason: string }>} Result.
 */
export async function copyText(text) {
  try {
    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== 'function'
    ) {
      return { ok: false, reason: 'unsupported' };
    }

    await navigator.clipboard.writeText(String(text === undefined || text === null ? '' : text));
    return { ok: true, reason: 'copied' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}