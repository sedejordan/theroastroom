/**
 * URL helpers for deep links between pages.
 */

/**
 * Build a stable shareable URL for one roast inside one club.
 * @param {string} clubId Club identifier from the registry.
 * @param {string} roastId Roast identifier, unique inside the club.
 * @returns {string} Relative URL with the club query string and the roast hash.
 */
export function roastUrl(clubId, roastId) {
  const safeClub = encodeURIComponent(String(clubId));
  const safeRoast = encodeURIComponent(String(roastId));
  return `room.html?club=${safeClub}#${safeRoast}`;
}

/**
 * Read the roast id from a location hash, ignoring a leading #.
 * Returns an empty string when the hash is missing or empty.
 * @param {string} hash Value such as "#trophies_last_league_title" or "trophies_last_league_title".
 * @returns {string} The decoded roast id, or an empty string.
 */
export function parseRoastHash(hash) {
  if (typeof hash !== 'string') return '';
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (raw.length === 0) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}