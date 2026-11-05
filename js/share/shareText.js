/**
 * Pure share text and share URL helpers.
 */

import { roastUrl } from '../utils/links.js';

/**
 * Sanitise one file name part to lowercase letters, digits and underscores.
 * @param {unknown} value Raw value.
 * @returns {string} Sanitised part.
 */
function sanitisePart(value) {
  return String(value === undefined || value === null ? '' : value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Build the message used by the system share sheet.
 * @param {{ headline?: string }} roast Roast data.
 * @param {string} url Absolute roast URL.
 * @returns {string} Share message.
 */
export function buildShareText(roast, url) {
  const headline = roast && roast.headline ? String(roast.headline) : '';
  const link = url === undefined || url === null ? '' : String(url);
  return `${headline}\n\nReceipts included. Check them yourself: ${link}`;
}

/**
 * Build a downloaded PNG file name.
 * @param {unknown} clubId Club id.
 * @param {unknown} roastId Roast id.
 * @param {unknown} formatId Format id such as post or story.
 * @returns {string} File name such as roastroom_manutd_roastid_post.png.
 */
export function buildFileName(clubId, roastId, formatId) {
  const club = sanitisePart(clubId) || 'club';
  const roast = sanitisePart(roastId) || 'roast';
  const format = sanitisePart(formatId) || 'post';
  return `roastroom_${club}_${roast}_${format}.png`;
}

/**
 * Build an absolute roast URL from a base href.
 * @param {string} baseHref Page href used as the base.
 * @param {string} clubId Club id.
 * @param {string} roastId Roast id.
 * @returns {string} Absolute URL with the club query and roast hash.
 */
export function absoluteRoastUrl(baseHref, clubId, roastId) {
  const relative = roastUrl(clubId, roastId);
  try {
    return new URL(relative, baseHref).href;
  } catch {
    return relative;
  }
}

/**
 * Return the override when set, otherwise the host.
 * @param {string} host Current host.
 * @param {string} override Host override from shareConfig.
 * @returns {string} Host label.
 */
export function hostLabel(host, override) {
  const trimmed = typeof override === 'string' ? override.trim() : '';
  if (trimmed.length > 0) return trimmed;
  return host === undefined || host === null ? '' : String(host);
}