/**
 * Small DOM helpers used across the pages.
 * Never touches innerHTML with data, so nothing user visible can inject markup.
 */

/**
 * True when the user has asked the operating system to reduce motion.
 * Returns false in environments without a window, so it is safe to call from
 * any browser entry point without guarding.
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Create an element with a class name, text content, attributes and children,
 * all set through safe DOM APIs.
 * @param {string} tag HTML tag name.
 * @param {{
 *   className?: string,
 *   text?: string | number,
 *   attrs?: Record<string, string | number | undefined | null>,
 *   children?: Array<Node | string | null | undefined>
 * }} [options]
 * @returns {HTMLElement}
 */
export function createElement(tag, options = {}) {
  const element = document.createElement(tag);

  if (typeof options.className === 'string' && options.className.length > 0) {
    element.className = options.className;
  }

  if (options.text !== undefined && options.text !== null) {
    element.textContent = String(options.text);
  }

  if (options.attrs && typeof options.attrs === 'object') {
    for (const [key, value] of Object.entries(options.attrs)) {
      if (value === undefined || value === null) continue;
      element.setAttribute(key, String(value));
    }
  }

  if (Array.isArray(options.children)) {
    for (const child of options.children) {
      if (child === undefined || child === null) continue;
      if (child instanceof Node) {
        element.append(child);
      } else {
        element.append(document.createTextNode(String(child)));
      }
    }
  }

  return element;
}

/**
 * Set the text content of an element, safely coerced to a string.
 * @param {Element | null | undefined} element
 * @param {string | number | null | undefined} text
 * @returns {void}
 */
export function setText(element, text) {
  if (!element) return;
  element.textContent = text === undefined || text === null ? '' : String(text);
}

/**
 * Remove every child of an element.
 * @param {Element | null | undefined} element
 * @returns {void}
 */
export function clear(element) {
  if (!element) return;
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}