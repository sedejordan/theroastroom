/**
 * Loads approved fan roasts and filters them through validateRoast before they
 * are merged into the club's roast list. Silent on failure.
 */

import { validateRoast } from '../schema.js';
import { fetchApprovedRoasts } from './roastClient.js';

/**
 * Fetch approved fan roasts for one club, validate each with validateRoast
 * using the club category ids, and drop invalid or duplicate ids. Returns an
 * empty array on any failure so the room works exactly as today.
 * @param {string} clubId
 * @param {Array<Record<string, unknown>>} categories
 * @param {string[]} [existingIds] Ids already present in the club data file.
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function loadFanRoasts(clubId, categories, existingIds) {
  if (typeof clubId !== 'string' || clubId.length === 0) return [];
  if (!Array.isArray(categories)) return [];

  const categoryIds = categories
    .map((category) => (category && typeof category.id === 'string' ? category.id : ''))
    .filter((id) => id.length > 0);
  if (categoryIds.length === 0) return [];

  const result = await fetchApprovedRoasts(clubId);
  if (!result.ok) return [];

  const seenIds = Array.isArray(existingIds) ? existingIds.slice() : [];
  const valid = [];

  for (const roast of result.roasts) {
    if (!roast || typeof roast !== 'object') continue;
    if (typeof roast.id !== 'string' || roast.id.length === 0) continue;
    if (seenIds.includes(roast.id)) continue;
    const check = validateRoast(roast, {
      path: `fanRoasts[${valid.length}]`,
      clubId,
      categoryIds,
      seenIds: [],
    });
    if (!check.valid) continue;
    valid.push(roast);
    seenIds.push(roast.id);
  }

  return valid;
}