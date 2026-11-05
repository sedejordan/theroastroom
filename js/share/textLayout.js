/**
 * Pure text layout helpers. No DOM and no canvas.
 * A measure function is injected so the same logic works in tests and on canvas.
 */

/**
 * Wrap text into lines that fit inside maxWidth.
 * Words longer than maxWidth are broken by character.
 * @param {string} text Text to wrap.
 * @param {number} maxWidth Maximum line width.
 * @param {(text: string) => number} measure Function returning the width of a string.
 * @returns {string[]} Wrapped lines. Empty input returns an empty array.
 */
export function wrapText(text, maxWidth, measure) {
  const source = text === undefined || text === null ? '' : String(text);
  if (source.trim().length === 0) return [];

  const safeWidth = Number.isFinite(maxWidth) && maxWidth > 0 ? maxWidth : 1;
  if (typeof measure !== 'function') {
    return source.split(/\s+/).filter(Boolean);
  }

  const words = source.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  const push = () => {
    if (current.length > 0) {
      lines.push(current);
      current = '';
    }
  };

  for (const word of words) {
    if (measure(word) <= safeWidth) {
      if (current.length === 0) {
        current = word;
      } else {
        const candidate = `${current} ${word}`;
        if (measure(candidate) <= safeWidth) {
          current = candidate;
        } else {
          push();
          current = word;
        }
      }
      continue;
    }

    push();

    for (const char of Array.from(word)) {
      if (current.length === 0) {
        current = char;
      } else if (measure(`${current}${char}`) <= safeWidth) {
        current = `${current}${char}`;
      } else {
        push();
        current = char;
      }
    }
  }

  push();
  return lines;
}

/**
 * Truncate text to fit inside maxWidth and add an ellipsis.
 * @param {string} text Text to truncate.
 * @param {number} maxWidth Maximum line width.
 * @param {(text: string) => number} measure Function returning the width of a string.
 * @returns {string} The original text when it fits, otherwise a truncated string with an ellipsis.
 */
export function truncateToWidth(text, maxWidth, measure) {
  const source = text === undefined || text === null ? '' : String(text);
  if (source.length === 0) return '';

  const safeWidth = Number.isFinite(maxWidth) && maxWidth > 0 ? maxWidth : 0;
  if (safeWidth === 0 || typeof measure !== 'function') return '';

  if (measure(source) <= safeWidth) return source;

  const ellipsis = '…';
  if (measure(ellipsis) > safeWidth) return '';

  let low = 0;
  let high = source.length;

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const candidate = `${source.slice(0, mid).trimEnd()}${ellipsis}`;
    if (measure(candidate) <= safeWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  if (low <= 0) return ellipsis;
  return `${source.slice(0, low).trimEnd()}${ellipsis}`;
}

/**
 * Pick the largest font size that fits inside a box.
 * @param {{
 *   text: string,
 *   maxWidth: number,
 *   maxHeight: number,
 *   maxLines?: number,
 *   minFontSize?: number,
 *   maxFontSize?: number,
 *   step?: number,
 *   lineHeightRatio?: number,
 *   measure: (text: string, fontSize: number) => number
 * }} options Fit options.
 * @returns {{ fontSize: number, lines: string[], truncated: boolean }} Fit result.
 */
export function fitText(options) {
  const source =
    options && options.text !== undefined && options.text !== null ? String(options.text) : '';

  const minSize =
    options && Number.isFinite(options.minFontSize) ? Number(options.minFontSize) : 30;
  const maxSize =
    options && Number.isFinite(options.maxFontSize) ? Number(options.maxFontSize) : 42;
  const sizeStep = options && Number.isFinite(options.step) && options.step > 0 ? options.step : 2;
  const safeMaxLines =
    options && Number.isFinite(options.maxLines) && options.maxLines > 0
      ? Math.floor(options.maxLines)
      : 8;
  const safeMaxWidth =
    options && Number.isFinite(options.maxWidth) && options.maxWidth > 0 ? options.maxWidth : 1;
  const safeMaxHeight =
    options && Number.isFinite(options.maxHeight) && options.maxHeight > 0
      ? options.maxHeight
      : Infinity;
  const safeLineHeight =
    options && Number.isFinite(options.lineHeightRatio) && options.lineHeightRatio > 0
      ? options.lineHeightRatio
      : 1.35;
  const measure = options && typeof options.measure === 'function' ? options.measure : null;

  if (source.trim().length === 0) {
    return { fontSize: minSize, lines: [], truncated: false };
  }

  if (!measure) {
    return { fontSize: minSize, lines: [source], truncated: true };
  }

  const topSize = Math.max(minSize, maxSize);

  for (let candidate = topSize; candidate >= minSize; candidate -= sizeStep) {
    const lines = wrapText(source, safeMaxWidth, (value) => measure(value, candidate));
    const maxByHeight =
      safeMaxHeight === Infinity
        ? safeMaxLines
        : Math.max(1, Math.floor(safeMaxHeight / (candidate * safeLineHeight)));
    const allowed = Math.min(safeMaxLines, maxByHeight);

    if (lines.length <= allowed) {
      return { fontSize: candidate, lines, truncated: false };
    }
  }

  const finalSize = minSize;
  const finalLines = wrapText(source, safeMaxWidth, (value) => measure(value, finalSize));
  const finalMaxByHeight =
    safeMaxHeight === Infinity
      ? safeMaxLines
      : Math.max(1, Math.floor(safeMaxHeight / (finalSize * safeLineHeight)));
  const finalAllowed = Math.min(safeMaxLines, finalMaxByHeight);

  if (finalLines.length <= finalAllowed) {
    return { fontSize: finalSize, lines: finalLines, truncated: false };
  }

  const kept = finalLines.slice(0, Math.max(1, finalAllowed));
  const lastIndex = kept.length - 1;
  if (lastIndex >= 0) {
    kept[lastIndex] = truncateToWidth(`${kept[lastIndex]}…`, safeMaxWidth, (value) =>
      measure(value, finalSize)
    );
  }

  return { fontSize: finalSize, lines: kept, truncated: true };
}