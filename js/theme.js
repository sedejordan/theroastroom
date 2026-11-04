/**
 * Applies a club theme to the document by writing CSS custom properties on the
 * root element. Every colour in tailwind.config.js reads these variables, so a
 * single call reskins the whole page.
 */

import { THEME_VARIABLES } from './config.js';

/**
 * Find the browser theme colour meta tag and set it.
 * @param {string} [value] Colour to apply. Falls back to the background token.
 * @returns {void}
 */
function updateMetaThemeColor(value) {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;

  let next = typeof value === 'string' ? value.trim() : '';
  if (next.length === 0) {
    next = getComputedStyle(document.documentElement).getPropertyValue('--colorBackground').trim();
  }
  if (next.length > 0) {
    meta.setAttribute('content', next);
  }
}

/**
 * Remove every theme custom property from the root element so the defaults in
 * css/tokens.css apply again.
 * @returns {void}
 */
function resetThemeProperties() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  Object.values(THEME_VARIABLES).forEach((variable) => {
    root.style.removeProperty(variable);
  });
}

/**
 * Apply a theme. Every theme custom property is cleared from the root first, so
 * a partial theme falls back to the defaults in css/tokens.css for the keys it
 * does not set. The provided keys are then applied and the theme colour meta
 * tag is updated to match the resulting background.
 * @param {Partial<Record<string, string>>} theme Theme keys to apply.
 * @returns {void}
 */
export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  if (!theme || typeof theme !== 'object') return;

  const root = document.documentElement;

  resetThemeProperties();

  Object.entries(THEME_VARIABLES).forEach(([key, variable]) => {
    const value = theme[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      root.style.setProperty(variable, value.trim());
    }
  });

  updateMetaThemeColor(theme.background);
}

/**
 * Remove every inline theme property so the defaults in css/tokens.css apply
 * again, and restore the theme colour meta tag.
 * @returns {void}
 */
export function clearTheme() {
  if (typeof document === 'undefined') return;

  resetThemeProperties();
  updateMetaThemeColor();
}